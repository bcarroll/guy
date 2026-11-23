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
// the user's own words in the subtitle bar, while they talk to GUY through the microphone (a third colour)
export const YOU = { color: '#ffd166', name: 'YOU' };
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

// One voice per exchange: the natural voices used to be picked line by line (only once the model had loaded, and eSpeak on any error),
// so after every page load GAL could answer in the robot voice and GUY reply a second later in the natural one. Now the engine is chosen
// when an exchange starts (nobody has spoken for GAP ms) and kept until it ends. A device that has downloaded the natural voices before
// loads them as the page opens and waits for them (up to WAIT ms) instead of speaking the robot voice meanwhile; a natural line that
// fails is tried again and otherwise shown as a subtitle only, never in the robot voice. Every line records which engine spoke it and
// why the robot voice was used (line.engine, line.why), and a fallback is logged to the console.
export const GAP = 4000, WAIT = 25000, RENDER_LIMIT = 30000;
const CACHED = 'guy.voice.natural.cached';     // set once the natural voices have loaded on this device (they stay in the browser's cache)
const wasCached = () => { try { return localStorage.getItem(CACHED) === '1'; } catch { return false; } };
const markCached = () => { try { localStorage.setItem(CACHED, '1'); } catch { /* storage blocked */ } };

// opts.natural / opts.robot / opts.cached replace the natural engine module, the eSpeak render and the "downloaded before" check, and
// opts.gap / opts.wait shorten GAP and WAIT (the QA sweep uses them)
export function initVoice({ subs, onSpeakStart = () => {}, onSpeakEnd = () => {}, onVoiceStatus = () => {}, persist = true, natural: naturalLoader = null, robot = render, cached = null, gap = GAP, wait = WAIT } = {}) {
  const st = { chatter: 'quiet', muted: false, engine: 'natural' };
  // the natural voices (tts-natural.js) are a ~90 MB one-time download; the QA runs (persist false) stay offline and use eSpeak
  let natural = null, naturalP = null, retryAt = 0;
  const useNatural = () => (persist || naturalLoader) && !window.__voiceNoAudio;
  const hadNatural = () => (cached ? cached() : persist && wasCached());
  const startNatural = () => {
    if (!useNatural()) return Promise.resolve(null);
    if (!naturalP) {
      naturalP = (naturalLoader ? naturalLoader() : import('./tts-natural.js')).then((m) => {
        natural = m;
        m.onStatus((s) => { if (s.state === 'ready' && persist) markCached(); onVoiceStatus(s); });
        m.load().catch(() => {});
        return m;
      }).catch((e) => { naturalP = null; console.warn('[voice] natural voices could not start:', e); return null; });
    }
    return naturalP;
  };
  if (persist) { try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage blocked */ } }
  if (!CHATTER.includes(st.chatter)) st.chatter = 'quiet';
  if (!['natural', 'robot'].includes(st.engine)) st.engine = 'natural';
  const save = () => { if (persist) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage blocked */ } } };
  const q = [];                       // lines waiting: { who, text, kind }
  let busy = false, node = null, subTimer = 0, current = null, wake = null, gen = 0;
  let lock = null, lastEnd = -Infinity;   // the engine of the exchange under way, and when its last line ended
  const sleep = (ms) => new Promise((r) => { wake = r; setTimeout(r, ms); });
  const log = [];                     // everything said (the QA harness and the HUD read it)
  const subtitle = (who, text) => {
    if (!subs) return;
    const v = who === 'you' ? YOU : VOICES[who] || VOICES.guy;
    subs.innerHTML = ''; const b = document.createElement('b'); b.style.color = v.color; b.textContent = v.name + ': '; subs.append(b, document.createTextNode(text));
    subs.hidden = false; clearTimeout(subTimer); subTimer = setTimeout(() => { subs.hidden = true; }, 2500 + text.length * 70);
  };
  // which engine speaks the exchange that is starting: { engine, why }
  async function chooseEngine() {
    if (st.engine !== 'natural') return { engine: 'robot', why: 'the robot voice is selected' };
    const m = await startNatural();
    if (!m) return { engine: 'robot', why: 'the natural voices are not available here' };
    if (m.ready()) return { engine: 'natural' };
    if (m.status.state === 'failed') {
      if (performance.now() > retryAt) { retryAt = performance.now() + 60000; m.load().catch(() => {}); }    // try the download again, at most once a minute
      return { engine: 'robot', why: 'the natural voices failed to load: ' + (m.status.error || 'unknown error') };
    }
    if (hadNatural()) {                // downloaded before: they are on their way from the cache, so wait rather than mix voices
      const ok = await Promise.race([m.load().then(() => true, () => false), sleep(wait).then(() => false)]);
      if (ok) return { engine: 'natural' };
      return { engine: 'robot', why: m.status.state === 'failed' ? 'the natural voices failed to load: ' + (m.status.error || 'unknown error') : 'the natural voices took too long to load' };
    }
    return { engine: 'robot', why: 'the natural voices are still downloading (first time on this device)' };
  }
  const withLimit = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('the natural voice took too long')), ms))]);
  async function pump() {
    if (busy) return; busy = true;
    while (q.length) {
      const line = q.shift(); current = line;
      const g = gen;
      subtitle(line.who, line.text);
      onSpeakStart(line);
      let played = false;
      const a = audio();
      if (!st.muted && st.chatter !== 'silent' && a.ctx && !window.__voiceNoAudio) {
        try {
          if (!lock || performance.now() - lastEnd > gap) {
            lock = await chooseEngine();
            if (lock.why && st.engine === 'natural') console.info('[voice] this exchange uses the robot voice:', lock.why);
          }
          line.engine = lock.engine; if (lock.why) line.why = lock.why;
          let wav = null;
          if (g !== gen) { /* stopped while waiting */ } else if (lock.engine === 'natural') {
            for (let i = 0; i < 2 && !wav && g === gen; i++) {
              try { wav = await withLimit(natural.render(line.who, line.text), RENDER_LIMIT); } catch (e) { line.error = String(e && e.message || e); }
            }
            if (!wav && g === gen) { line.why = 'the natural voice failed on this line, shown as a subtitle only: ' + (line.error || 'no audio'); console.warn('[voice]', line.why); }
          } else wav = await robot(line.who, line.text);
          if (wav && g === gen) {
            const buf = await a.ctx.decodeAudioData(wav.slice(0));
            await new Promise((done) => {
              wake = done;
              const src = a.ctx.createBufferSource(); src.buffer = buf; node = src;
              const gn = a.ctx.createGain(); gn.gain.value = 0.9; src.connect(gn); gn.connect(a.master || a.ctx.destination);
              src.onended = done; src.start();
              line.seconds = buf.duration; played = true;
              setTimeout(done, buf.duration * 1000 + 800);          // never hang on a suspended context
            });
          }
        } catch (e) { line.error = String(e && e.message || e); }
      }
      if (!played && g === gen) await sleep(Math.min(2500, 400 + line.text.length * 55));       // silent or no sound: leave the subtitle up for a while
      line.played = played; onSpeakEnd(line); current = null; node = null; lastEnd = performance.now();
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
  const stop = () => { gen++; q.length = 0; try { node && node.stop(); } catch { /* already stopped */ } if (wake) wake(); };
  if (st.engine === 'natural' && hadNatural()) startNatural();     // downloaded before: load them now, so they are ready when someone speaks
  return {
    say, stop, log, caption: (who, text) => subtitle(who, text), get settings() { return { ...st }; }, get speaking() { return busy; }, get current() { return current; },
    set(k, v) { if (k === 'muted') st.muted = !!v; else if (k === 'chatter' && CHATTER.includes(v)) st.chatter = v; else if (k === 'engine' && ['natural', 'robot'].includes(v)) { st.engine = v; lock = null; if (v === 'natural') startNatural(); } else return false; save(); return true; },
    warm: () => { if (st.engine === 'natural') startNatural(); return load().then(() => true); },
    get exchange() { return lock ? { ...lock } : null; },
    get naturalStatus() { return natural ? { ...natural.status } : { state: 'idle', progress: 0, error: '' }; },
  };
}
