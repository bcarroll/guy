// QA for what the game sounds like (installed onto the harness by devtools.js; NOT imported by the game).
//
// sweepSounds (devtools.js) checks that the right event makes the right sound. This checks the sound itself: every sound effect, the
// piano note, the guitar pluck and the drum hits are rendered offline (no speakers, no autoplay rules, the same result every time)
// and measured: is it audible, is it clipping, how long does it last, does it start at once, is it as bright or as deep as it should
// be, is it about as loud as its neighbours, is it silent afterwards (no stuck notes, no DC offset). A sound with no entry in SPEC
// fails, so a new sound cannot be added without saying what it should be like.
import { useAudio, playNote, playPluck, drumHit } from './audio.js';
import { SOUNDS } from './sfx.js';
import { makeStrum, PATTERNS, PROGRESSIONS } from './strum.js';

const SR = 44100, LEN = 4;                               // seconds rendered per sound
// dur: [shortest, longest] seconds the sound is audible; bright: spectral centroid class (low < 700 Hz, mid 700-2500, high > 2500, any);
// onset: seconds before it is first audible (designed delays); amount: what is passed to it (hardness / speed)
const SPEC = {
  bounce: { dur: [0.05, 0.4], bright: 'low', amount: 4 }, wallbump: { dur: [0.05, 0.4], bright: 'low', amount: 4 },
  kick: { dur: [0.08, 0.5], bright: 'low', amount: 1 }, knock: { dur: [0.04, 0.3], bright: 'any', amount: 2 }, thud: { dur: [0.05, 0.5], bright: 'low', amount: 0.5 },
  page: { dur: [0.1, 0.6], bright: 'high' }, bookopen: { dur: [0.05, 0.5], bright: 'low' }, bookclose: { dur: [0.05, 0.4], bright: 'any' }, bookgrab: { dur: [0.08, 0.5], bright: 'any' },
  sleeve: { dur: [0.08, 0.5], bright: 'high' }, guitar: { dur: [0.4, 2.2], bright: 'any' },
  click: { dur: [0.005, 0.1], bright: 'high' }, tick: { dur: [0.005, 0.1], bright: 'high' }, sit: { dur: [0.1, 0.8], bright: 'any' }, leaf: { dur: [0.08, 0.6], bright: 'high' },
  brush: { dur: [0.03, 0.3], bright: 'high', soft: true }, dab: { dur: [0.03, 0.3], bright: 'any', soft: true }, wipe: { dur: [0.1, 0.6], bright: 'high' }, step: { dur: [0.02, 0.3], bright: 'low' },
  place: { dur: [0.05, 0.5], bright: 'low' },
  machine: { dur: [0.3, 1.0], bright: 'any' }, lid: { dur: [0.03, 0.4], bright: 'any' },
  ding: { dur: [0.2, 1.0], bright: 'mid' }, cash: { dur: [0.12, 0.6], bright: 'high' }, sizzle: { dur: [0.3, 1.2], bright: 'high' }, plate: { dur: [0.02, 0.3], bright: 'high' }, lift: { dur: [0.3, 1.0], bright: 'mid' },
  splash: { dur: [0.1, 0.6], bright: 'high' }, swish: { dur: [0.1, 0.6], bright: 'high' }, motor: { dur: [0.1, 0.5], bright: 'low' },
  chime: { dur: [0.4, 1.2], bright: 'mid' }, pop: { dur: [0.03, 0.3], bright: 'any' }, whoosh: { dur: [0.1, 0.6], bright: 'high' },
};
// the instruments: how to play one note / hit
const INSTRUMENTS = {
  'piano C4': { play: () => playNote(60, 0.8, 0.25), dur: [0.3, 1.2], bright: 'low' },
  'piano C6': { play: () => playNote(84, 0.8, 0.25), dur: [0.3, 1.2], bright: 'mid' },
  'guitar E3': { play: () => playPluck(52, 0, 1.6, 0.15), dur: [0.5, 2.2], bright: 'low' },
  'drum kick': { play: () => drumHit('kick'), dur: [0.1, 0.5], bright: 'low' },
  'drum snare': { play: () => drumHit('snare'), dur: [0.05, 0.5], bright: 'any' },
  'drum hat': { play: () => drumHit('hat'), dur: [0.02, 0.4], bright: 'high' },
  'drum tom': { play: () => drumHit('tom1'), dur: [0.05, 0.6], bright: 'low' },
  'drum crash': { play: () => drumHit('crash'), dur: [0.3, 2.5], bright: 'high' },
};

// spectral centroid of the loudest 4096 samples (a plain DFT over a few bins would be slow: a radix-2 FFT)
function centroid(x, sr) {
  const N = 4096;
  let best = 0, bi = 0;
  for (let i = 0; i + N <= x.length; i += N / 2) { let e = 0; for (let k = 0; k < N; k++) e += x[i + k] * x[i + k]; if (e > best) { best = e; bi = i; } }
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let k = 0; k < N; k++) re[k] = (x[bi + k] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (N - 1)));
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = i + k + len / 2;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); num += m * ((k * sr) / N); den += m; }
  return den ? num / den : 0;
}

// render one sound offline and measure it
async function render(play) {
  const ctx = new OfflineAudioContext(1, SR * LEN, SR), master = ctx.createGain();
  master.gain.value = 0.5;                                // what the game uses
  master.connect(ctx.destination);
  const restore = useAudio(ctx, master);
  try { play(ctx, master); } finally { restore(); }
  const buf = await ctx.startRendering(), x = buf.getChannelData(0);
  let peak = 0, sum = 0, first = -1, last = -1, dc = 0, peakI = 0;
  const floor = 0.003;                                     // about -50 dBFS
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (!Number.isFinite(x[i])) return { bad: true };
    if (a > peak) { peak = a; peakI = i; }
    sum += x[i] * x[i]; dc += x[i];
    if (a > floor) { if (first < 0) first = i; last = i; }
  }
  const audible = first < 0 ? 0 : (last - first) / SR;
  const tail = x.slice(Math.floor(SR * (LEN - 0.3))).reduce((m, v) => Math.max(m, Math.abs(v)), 0);       // anything still sounding at the end?
  return { peak, peakAfter: first < 0 ? 0 : (peakI - first) / SR, rms: Math.sqrt(sum / x.length), dur: audible, onset: first < 0 ? null : first / SR, dc: Math.abs(dc / x.length), tail, centroid: first < 0 ? 0 : centroid(x, SR) };
}

const brightOk = (cls, hz) => cls === 'any' || (cls === 'low' && hz < 1200) || (cls === 'mid' && hz >= 600 && hz < 3500) || (cls === 'high' && hz >= 1800);

export function install(T, h) {
  const { result } = h;
  T.sweepAudio = async () => {
    const out = [], base = T.errors.length;
    out.push(result('audio: every sound effect has a spec saying what it should be like (no sound without one)', Object.keys(SOUNDS).every((n) => n in SPEC) && Object.keys(SPEC).every((n) => n in SOUNDS), { missing: Object.keys(SOUNDS).filter((n) => !(n in SPEC)), stale: Object.keys(SPEC).filter((n) => !(n in SOUNDS)) }));
    const loud = {};
    for (const [name, fn] of Object.entries(SOUNDS)) {
      const sp = SPEC[name];
      if (!sp) continue;
      const m = await render((ctx, master) => fn(ctx, master, sp.amount));
      loud[name] = m.peak;
      const why = [];
      if (m.bad) why.push('not a number in the output');
      else {
        if (m.peak < 0.04) why.push(`too quiet (peak ${m.peak.toFixed(3)}, at least 0.04)`);
        if (m.peak > 0.9) why.push(`clips (peak ${m.peak.toFixed(2)})`);
        if (m.dur < sp.dur[0] || m.dur > sp.dur[1]) why.push(`lasts ${m.dur.toFixed(2)} s, expected ${sp.dur[0]} to ${sp.dur[1]}`);
        if (m.onset !== null && m.onset > 0.12) why.push(`starts late (${m.onset.toFixed(2)} s)`);
        if (m.dc > 0.01) why.push(`DC offset ${m.dc.toFixed(3)}`);
        // a soft sound (a brush stroke is repeated many times a second) must swell, not strike: a sharp start repeated sounds like hammering
        if (sp.soft && m.peakAfter < 0.02) why.push(`hits at once (loudest ${(m.peakAfter * 1000).toFixed(0)} ms after it starts): repeated, it sounds like hammering`);
        if (m.tail > 0.003) why.push('still sounding at the end (a stuck note)');
        if (!brightOk(sp.bright, m.centroid)) why.push(`sounds ${m.centroid < 700 ? 'too dull' : 'too bright'} for a ${sp.bright} sound (centre ${Math.round(m.centroid)} Hz)`);
      }
      out.push(result(`audio ${name}: audible, not clipping, ${sp.dur[0]}-${sp.dur[1]} s long, starts at once, ${sp.bright}`, !why.length, { why, peak: m.peak && +m.peak.toFixed(3), dur: m.dur && +m.dur.toFixed(2), centre: m.centroid && Math.round(m.centroid) }));
    }
    for (const [name, sp] of Object.entries(INSTRUMENTS)) {
      const m = await render(sp.play);
      const why = [];
      if (m.bad) why.push('not a number in the output');
      else {
        if (m.peak < 0.02) why.push(`silent (peak ${m.peak.toFixed(3)})`);
        if (m.peak > 0.95) why.push(`clips (peak ${m.peak.toFixed(2)})`);
        if (m.dur < sp.dur[0] || m.dur > sp.dur[1]) why.push(`lasts ${m.dur.toFixed(2)} s, expected ${sp.dur[0]} to ${sp.dur[1]}`);
        if (m.tail > 0.003) why.push('still sounding at the end');
        if (!brightOk(sp.bright, m.centroid)) why.push(`wrong brightness (centre ${Math.round(m.centroid)} Hz)`);
      }
      out.push(result(`audio ${name}: audible, not clipping, the right length and brightness`, !why.length, { why, peak: m.peak && +m.peak.toFixed(3), dur: m.dur && +m.dur.toFixed(2), centre: m.centroid && Math.round(m.centroid) }));
    }
    // balance: no effect is wildly louder or quieter than the rest (more than 24 dB between the loudest and the quietest)
    const peaks = Object.values(loud).filter((p) => p > 0);
    const spread = 20 * Math.log10(Math.max(...peaks) / Math.min(...peaks));
    out.push(result(`audio: the sound effects are balanced (${spread.toFixed(0)} dB between the loudest and the quietest, at most 24)`, spread <= 24, { loudest: Object.entries(loud).sort((a, b) => b[1] - a[1])[0], quietest: Object.entries(loud).sort((a, b) => a[1] - b[1])[0] }));
    out.push(result('audio: no errors were logged', T.errors.length === base, { errors: T.errors.slice(base) }));
    return out;
  };

  // The guitar must not play the same song every time (it once strummed Am F C G in the same pattern, 26 seconds, on every go).
  T.sweepGuitarSongs = async () => {
    const out = [], base = T.errors.length;
    const songs = Array.from({ length: 40 }, () => makeStrum());
    const key = (x) => `${x.key}|${x.chords.map((c) => c.name).join(' ')}|${x.pat}`;
    const distinct = new Set(songs.map(key)).size;
    out.push(result(`guitar: forty goes at "play the guitar" give ${distinct} different songs (at least 25), not the same one over and over`, distinct >= 25, { distinct }));
    let repeats = 0;
    for (let i = 1; i < songs.length; i++) if (key(songs[i]) === key(songs[i - 1])) repeats++;
    out.push(result('guitar: he almost never plays the same song twice in a row', repeats <= 2, { repeats }));
    out.push(result(`guitar: across many songs he uses every kind of progression (${PROGRESSIONS.length}) and every pattern (${PATTERNS.length})`,
      new Set(Array.from({ length: 400 }, () => makeStrum()).map((x) => x.name)).size === PROGRESSIONS.length && new Set(Array.from({ length: 400 }, () => makeStrum()).map((x) => x.pat)).size === PATTERNS.length));
    const bad = songs.filter((x) => x.chords.length !== 4 || x.pat.length !== 8 || x.step < 0.23 || x.step > 0.37 || x.secs < 20 || x.secs > 40 || x.chords.some((c) => c.notes.length < 4 || c.notes.some((m) => m < 38 || m > 84) || !Number.isFinite(c.fret)));
    out.push(result('guitar: every song is playable (four chords of four or more notes in the range of a guitar, an eight-step pattern, a steady tempo, a sensible length)', !bad.length, { bad: bad.slice(0, 2).map(key) }));
    // and it sounds like a guitar: a strummed chord of every progression is audible and not clipping
    const names = new Set(), weak = [];
    for (const x of songs) {
      for (const c of x.chords) {
        if (names.has(c.name + x.key)) continue;
        names.add(c.name + x.key);
        const m = await render(() => c.notes.forEach((n, i) => playPluck(n, i * 0.018, 1.8, 0.15)));
        if (m.bad || m.peak < 0.04 || m.peak > 0.95 || m.tail > 0.003) weak.push(`${c.name}: peak ${m.peak && m.peak.toFixed(2)}`);
        if (names.size >= 24) break;
      }
      if (names.size >= 24) break;
    }
    out.push(result(`guitar: ${names.size} different strummed chords all sound (audible, not clipping, nothing stuck)`, !weak.length, { weak: weak.slice(0, 3) }));
    out.push(result('guitar: no errors were logged', T.errors.length === base, { errors: T.errors.slice(base) }));
    return out;
  };
}
