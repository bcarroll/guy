// Sound effects: everything in the room makes a noise when it is touched, moved or used. Synthesised with WebAudio (no files).
//
//   sfx('name', amount, extra)   one-shot sound; `amount` is usually how hard (0..1, or m/s for the ball)
//   drag(level, weight)          a continuous scrape while something heavy is pushed or dragged (call every frame; it dies away by itself)
//
// Every call is counted in `counts` even when no audio is running, so the QA harness can check that the right events make a sound.
import { audio, playPluck } from './audio.js';

export const counts = {};
let muted = false;
export const setMuted = (m) => { muted = !!m; if (muted) dragOff(); };
export const isMuted = () => muted;

const last = {};
const MIN_GAP = { bounce: 40, knock: 60, thud: 60, page: 250, step: 150, tick: 70, brush: 80, wipe: 160, leaf: 220, click: 40, sit: 400, kick: 60 };

let noise = null;
const noiseBuf = (ctx) => {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
};

// a burst of filtered noise
function burst(ctx, out, { dur = 0.1, type = 'bandpass', f = 1000, f2 = null, q = 1, gain = 0.2, delay = 0, attack = 0.003 }) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf(ctx);
  s.loop = true;
  const flt = ctx.createBiquadFilter();
  flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t);
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(flt).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}

// a pitched thump / blip
function tone(ctx, out, { f0 = 150, f1 = 60, dur = 0.12, type = 'sine', gain = 0.3, delay = 0, attack = 0.002 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const SOUNDS = {
  // the ball: v is the speed of the hit in m/s
  bounce(ctx, out, v) { const k = clamp(v / 5, 0.1, 1); tone(ctx, out, { f0: 170, f1: 65, dur: 0.14, gain: 0.55 * k }); burst(ctx, out, { dur: 0.05, f: 500, gain: 0.18 * k }); },
  wallbump(ctx, out, v) { const k = clamp(v / 5, 0.1, 1); tone(ctx, out, { f0: 130, f1: 60, dur: 0.12, gain: 0.4 * k }); burst(ctx, out, { dur: 0.06, type: 'lowpass', f: 700, gain: 0.2 * k }); },
  kick(ctx, out, v = 1) { const k = clamp(v, 0.3, 1); tone(ctx, out, { f0: 120, f1: 45, dur: 0.2, gain: 0.7 * k }); burst(ctx, out, { dur: 0.09, type: 'lowpass', f: 900, gain: 0.3 * k }); },
  knock(ctx, out, v = 1) { const k = clamp(v / 3, 0.15, 1); tone(ctx, out, { f0: 280, f1: 170, dur: 0.09, type: 'triangle', gain: 0.4 * k }); burst(ctx, out, { dur: 0.05, f: 1500, q: 2, gain: 0.15 * k }); },
  thud(ctx, out, w = 0.4) { tone(ctx, out, { f0: 110, f1: 50, dur: 0.16, gain: 0.5 * w }); burst(ctx, out, { dur: 0.08, type: 'lowpass', f: 500, gain: 0.25 * w }); },
  // books and paper
  page(ctx, out) { burst(ctx, out, { dur: 0.22, f: 2400, f2: 5800, q: 0.8, gain: 0.2 }); burst(ctx, out, { dur: 0.12, f: 3500, f2: 2200, q: 1.5, gain: 0.1, delay: 0.1 }); },
  bookopen(ctx, out) { burst(ctx, out, { dur: 0.16, type: 'lowpass', f: 1000, f2: 400, gain: 0.2 }); tone(ctx, out, { f0: 95, f1: 70, dur: 0.12, gain: 0.2 }); },
  bookclose(ctx, out) { tone(ctx, out, { f0: 100, f1: 55, dur: 0.12, gain: 0.35 }); burst(ctx, out, { dur: 0.06, f: 1200, gain: 0.12 }); },
  bookgrab(ctx, out) { burst(ctx, out, { dur: 0.14, f: 1800, f2: 900, gain: 0.13 }); tone(ctx, out, { f0: 200, f1: 120, dur: 0.07, type: 'triangle', gain: 0.18, delay: 0.1 }); },
  sleeve(ctx, out) { burst(ctx, out, { dur: 0.18, f: 2600, f2: 1400, gain: 0.12 }); },
  // instruments handled
  guitar(ctx, out) {          // picking the guitar up or putting it down: a knock on the wood and a soft open-string strum
    tone(ctx, out, { f0: 190, f1: 110, dur: 0.12, type: 'triangle', gain: 0.35 });
    burst(ctx, out, { dur: 0.06, f: 900, q: 1.5, gain: 0.15 });
    [40, 45, 50, 55, 59, 64].forEach((m, i) => playPluck(m, 0.05 + i * 0.035, 1.4, 0.07));
  },
  // switches and small things
  click(ctx, out) { tone(ctx, out, { f0: 1900, f1: 1100, dur: 0.025, type: 'square', gain: 0.1 }); burst(ctx, out, { dur: 0.015, type: 'highpass', f: 4000, gain: 0.1 }); },
  tick(ctx, out) { tone(ctx, out, { f0: 2400, f1: 2200, dur: 0.012, type: 'square', gain: 0.07 }); },
  sit(ctx, out, w = 0.5) {
    burst(ctx, out, { dur: 0.12, type: 'lowpass', f: 500, gain: 0.25 * w });
    tone(ctx, out, { f0: 95, f1: 55, dur: 0.14, gain: 0.35 * w });
    tone(ctx, out, { f0: 150, f1: 105, dur: 0.28, type: 'sawtooth', gain: 0.03 * w, delay: 0.05 });                     // the creak
  },
  leaf(ctx, out) { burst(ctx, out, { dur: 0.16, type: 'highpass', f: 3500, gain: 0.1 }); burst(ctx, out, { dur: 0.12, type: 'highpass', f: 4200, gain: 0.07, delay: 0.1 }); },
  brush(ctx, out, v = 0.5) { burst(ctx, out, { dur: 0.08, f: 3800, q: 2, gain: 0.05 + 0.05 * clamp(v, 0, 1) }); },
  dab(ctx, out) { tone(ctx, out, { f0: 320, f1: 140, dur: 0.06, gain: 0.18 }); burst(ctx, out, { dur: 0.05, type: 'lowpass', f: 1200, gain: 0.1 }); },
  wipe(ctx, out) { burst(ctx, out, { dur: 0.26, f: 1800, f2: 3200, q: 0.9, gain: 0.07 }); },
  step(ctx, out) { burst(ctx, out, { dur: 0.05, type: 'lowpass', f: 700, gain: 0.07 }); tone(ctx, out, { f0: 100, f1: 65, dur: 0.05, gain: 0.08 }); },
  place(ctx, out, w = 0.4) { SOUNDS.thud(ctx, out, w); },
  // the game itself
  chime(ctx, out) { [880, 1175, 1568].forEach((f, i) => tone(ctx, out, { f0: f, f1: f * 0.99, dur: 0.55, gain: 0.12, delay: i * 0.1, attack: 0.01 })); },
  pop(ctx, out) { tone(ctx, out, { f0: 380, f1: 900, dur: 0.09, gain: 0.18 }); },
  whoosh(ctx, out) { burst(ctx, out, { dur: 0.25, f: 600, f2: 2400, q: 0.7, gain: 0.12 }); },
};

export function sfx(name, a, b) {
  counts[name] = (counts[name] || 0) + 1;
  const { ctx, master } = audio();
  if (!ctx || muted) return;
  const now = performance.now();
  if (now - (last[name] || 0) < (MIN_GAP[name] || 0)) return;
  last[name] = now;
  const fn = SOUNDS[name];
  if (fn) fn(ctx, master, a, b);
}

// ---- the scrape of something being pushed or dragged along the floor ----
let voice = null, dragTimer = 0;
function dragOff() {
  clearTimeout(dragTimer);
  if (voice) { const { ctx } = audio(); voice.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
}
export function drag(level = 1, weight = 'medium') {
  counts.drag = (counts.drag || 0) + 1;
  const { ctx, master } = audio();
  if (!ctx || muted) return;
  if (!voice) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf(ctx); src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 1.2;
    const wob = ctx.createGain(); wob.gain.value = 0.7;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 8; lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(wob.gain);
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(flt).connect(wob).connect(g).connect(master);
    src.start(); lfo.start();
    voice = { gain: g, filter: flt };
  }
  const cutoff = weight === 'heavy' ? 320 : weight === 'light' ? 750 : 480;
  voice.filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.05);
  voice.gain.gain.setTargetAtTime(0.32 * clamp(level, 0, 1), ctx.currentTime, 0.04);
  clearTimeout(dragTimer);
  dragTimer = setTimeout(dragOff, 140);              // quiet again as soon as nothing keeps calling this
}
