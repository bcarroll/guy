// Two engines: "natural" (Kokoro, tts-natural.js: downloaded once, then cached by the browser) and "robot" (below).
// Offline robot voices. No network and no browser voices: the small eSpeak-based mespeak engine (loaded the first time somebody
// speaks, a separate chunk) renders each line to a WAV in the browser, and the line plays through the game's own AudioContext
// (so the music can duck and the sound can be muted with the rest). GUY is lower and slower, GAL higher and brighter.
// Subtitles show whatever is said, with or without sound. Settings: guy.voice.v1 (not read or written with ?fresh).
import { audio } from './audio.js';

export const VOICES = {
  guy: { pitch: 28, speed: 158, variant: 'm3', color: '#7fd1ff', name: 'GUY' },
  gal: { pitch: 72, speed: 172, variant: 'f3', color: '#ff7ac0', name: 'GAL' },
};
const KEY = 'guy.voice.v1';
export const CHATTER = ['silent', 'quiet', 'chatty'];      // silent: subtitles only; quiet (default): speaks only in an interaction or when the two talk; chatty: and a remark when starting something

let engine = null, loading = null;
async function load() {
  if (engine) return engine;
  if (!loading) loading = (async () => {
    const m = (await import('./vendor/mespeak/index.js')).default;
    m.loadConfig((await import('mespeak/src/mespeak_config.json')).default);
    m.loadVoice((await import('mespeak/voices/en/en-us.json')).default);
    engine = m; return m;
  })();
  return loading;
}
// WAV bytes for a line (cached): the render takes about 0.3 s, so a repeated line is free
const cache = new Map();
export async function render(who, text) {
  const k = who + '|' + text;
  if (cache.has(k)) return cache.get(k);
  const m = await load(), v = VOICES[who] || VOICES.guy;
  const raw = m.speak(text, { rawdata: 'array', pitch: v.pitch, speed: v.speed, variant: v.variant, amplitude: 100, wordgap: 1 });
  const bytes = raw ? new Uint8Array(raw).buffer : null;
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  cache.set(k, bytes);
  return bytes;
}

export function initVoice({ subs, onSpeakStart = () => {}, onSpeakEnd = () => {}, onVoiceStatus = () => {}, persist = true } = {}) {
  const st = { chatter: 'quiet', muted: false, engine: 'natural' };
  // the natural voices (tts-natural.js) are a ~90 MB one-time download; the QA runs (persist false) stay offline and use eSpeak
  let natural = null;
  const startNatural = () => {
    if (!persist || natural || window.__voiceNoAudio) return;
    import('./tts-natural.js').then((m) => { natural = m; natural.onStatus(onVoiceStatus); m.load().catch(() => {}); });
  };
  if (persist) { try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage blocked */ } }
  if (!CHATTER.includes(st.chatter)) st.chatter = 'quiet';
  if (!['natural', 'robot'].includes(st.engine)) st.engine = 'natural';
  const save = () => { if (persist) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage blocked */ } } };
  const q = [];                       // lines waiting: { who, text, kind }
  let busy = false, node = null, subTimer = 0, current = null, wake = null;
  const sleep = (ms) => new Promise((r) => { wake = r; setTimeout(r, ms); });
  const log = [];                     // everything said (the QA harness and the HUD read it)
  const subtitle = (who, text) => {
    if (!subs) return;
    const v = VOICES[who] || VOICES.guy;
    subs.innerHTML = ''; const b = document.createElement('b'); b.style.color = v.color; b.textContent = v.name + ': '; subs.append(b, document.createTextNode(text));
    subs.hidden = false; clearTimeout(subTimer); subTimer = setTimeout(() => { subs.hidden = true; }, 2500 + text.length * 70);
  };
  async function pump() {
    if (busy) return; busy = true;
    while (q.length) {
      const line = q.shift(); current = line;
      subtitle(line.who, line.text);
      onSpeakStart(line);
      let played = false;
      const a = audio();
      if (!st.muted && st.chatter !== 'silent' && a.ctx && !window.__voiceNoAudio) {
        try {
          let wav = null;
          if (st.engine === 'natural' && natural) { try { wav = await natural.render(line.who, line.text); } catch (e) { line.error = String(e && e.message || e); } }
          if (!wav) wav = await render(line.who, line.text);             // eSpeak: the robot engine, and the stand-in while the natural voices download
          if (wav) {
            const buf = await a.ctx.decodeAudioData(wav.slice(0));
            await new Promise((done) => {
              wake = done;
              const src = a.ctx.createBufferSource(); src.buffer = buf; node = src;
              const g = a.ctx.createGain(); g.gain.value = 0.9; src.connect(g); g.connect(a.master || a.ctx.destination);
              src.onended = done; src.start();
              line.seconds = buf.duration; played = true;
              setTimeout(done, buf.duration * 1000 + 800);          // never hang on a suspended context
            });
          }
        } catch (e) { line.error = String(e && e.message || e); }
      }
      if (!played) await sleep(Math.min(2500, 400 + line.text.length * 55));       // silent or no sound: leave the subtitle up for a while
      line.played = played; onSpeakEnd(line); current = null; node = null;
    }
    busy = false;
  }
  // kind: 'reply' (to the user), 'peer' (GUY and GAL to each other), 'bark' (a remark while starting something)
  function say(who, text, kind = 'reply') {
    if (kind === 'bark' && st.chatter !== 'chatty') return false;
    log.push({ who, text, kind, t: Date.now() }); if (log.length > 60) log.shift();
    if (kind === 'bark' && q.length > 1) return false;
    if (q.length > 4) q.shift();                                 // drop the stalest line rather than fall behind
    if (st.engine === 'natural') startNatural();
    q.push({ who, text, kind }); pump(); return true;
  }
  const stop = () => { q.length = 0; try { node && node.stop(); } catch { /* already stopped */ } if (wake) wake(); };
  return {
    say, stop, log, get settings() { return { ...st }; }, get speaking() { return busy; }, get current() { return current; },
    set(k, v) { if (k === 'muted') st.muted = !!v; else if (k === 'chatter' && CHATTER.includes(v)) st.chatter = v; else if (k === 'engine' && ['natural', 'robot'].includes(v)) { st.engine = v; if (v === 'natural') startNatural(); } else return false; save(); return true; },
    warm: () => { if (st.engine === 'natural') startNatural(); return load().then(() => true); },
    get naturalStatus() { return natural ? { ...natural.status } : { state: 'idle', progress: 0, error: '' }; },
  };
}
