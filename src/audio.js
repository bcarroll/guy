// Tiny WebAudio synth: piano-ish notes and a looping boombox beat.
let ctx = null;
let master = null;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function playNote(midi, dur = 0.8, gain = 0.25) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(gain, t + 0.01);
  out.gain.exponentialRampToValueAtTime(0.001, t + dur);
  out.connect(master);
  for (const [mult, g, type] of [[1, 1, 'triangle'], [2, 0.3, 'sine'], [3, 0.1, 'sine']]) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = type;
    o.frequency.value = midiToHz(midi) * mult;
    og.gain.value = g;
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function kick(t) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.3);
}

let noiseBuf = null;
function hat(t, open) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  const len = open ? 0.18 : 0.04;
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + len + 0.02);
}

function bass(t, midi, len) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.value = midiToHz(midi);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 400;
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + len + 0.02);
}

export const BPM = 110;
export const BEAT = 60 / BPM;
const BASS_LINE = [33, 33, 40, 33, 36, 36, 43, 36]; // A1 A1 E2 A1 C2 C2 G2 C2 (midi)

// Looping 4-on-the-floor beat scheduled ahead of time; returns a stop function.
export function startBeat() {
  if (!ctx) return () => {};
  let step = 0;
  let next = ctx.currentTime + 0.05;
  const origin = next;
  const id = setInterval(() => {
    while (next < ctx.currentTime + 0.3) {
      if (step % 2 === 0) kick(next);
      if (step % 2 === 1) hat(next, step % 4 === 1);
      bass(next, BASS_LINE[step % BASS_LINE.length], BEAT * 0.45);
      next += BEAT / 2; // eighth-note steps
      step++;
    }
  }, 50);
  startBeat.origin = origin;
  return () => clearInterval(id);
}

export const audioNow = () => (ctx ? ctx.currentTime : 0);

// A plucked guitar-ish string: bright attack that darkens as it decays. `delay` staggers the strings of a strum.
export function playPluck(midi, delay = 0, dur = 1.6, gain = 0.15) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(450, t + dur * 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  f.connect(g).connect(master);
  for (const [type, mult, level] of [['triangle', 1, 1], ['sawtooth', 1.004, 0.35]]) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = type;
    o.frequency.value = midiToHz(midi) * mult;
    og.gain.value = level;
    o.connect(og).connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Album tracks for the stereo. Each is a looping backing track; `jam` tells the piano what scale and chords fit it.
// ---------------------------------------------------------------------------------------------------------------
function clap(t) {
  if (!noiseBuf) hat(t, false); // make sure the noise buffer exists
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + 0.16);
}

function lead(t, midi, len, gainLevel = 0.11) {
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = midiToHz(midi);
  f.type = 'lowpass';
  f.frequency.value = 2600;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gainLevel, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + len + 0.02);
}

const C_MAJ = { bass: [48, 55], chord: [60, 64, 67] };
const F_MAJ = { bass: [41, 48], chord: [60, 65, 69] };
const G_MAJ = { bass: [43, 50], chord: [59, 62, 67] };

export const TRACKS = {
  default: { bpm: 110, label: "the stereo's own beat", jam: null },
  // Kids' energetic songs: C F C G, oom-pah bass, claps on 2 and 4, a bouncy square-wave tune
  happy: {
    bpm: 132,
    label: 'Happy Time Parade',
    bars: [C_MAJ, F_MAJ, C_MAJ, G_MAJ],
    melody: [
      [72, 76, 79, 76, 72, 76, 79, 76],
      [77, 81, 84, 81, 77, 81, 84, 81],
      [79, 76, 72, 76, 79, 76, 84, 79],
      [79, 83, 86, 83, 79, 83, 86, 79],
    ],
    jam: { scale: [72, 74, 76, 79, 81, 84, 86, 88], bars: [C_MAJ, F_MAJ, C_MAJ, G_MAJ] },
    // one eighth-note step of the loop (32 steps = 4 bars)
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 4, i = n % 8, b = this.bars[bar];
      if (i % 2 === 0) kick(t);
      if (i === 2 || i === 6) clap(t);
      hat(t, i % 2 === 1);
      bass(t, i % 4 < 2 ? b.bass[0] : b.bass[1], beatLen * 0.4);
      lead(t, this.melody[bar][i], beatLen * 0.42);
      if (i % 2 === 1) for (const m of b.chord) lead(t, m - 12, beatLen * 0.18, 0.035); // off-beat chord chops
    },
  },
};

// ---- extra voices for the album tracks (all take an absolute start time) ----
// partials: [[freqMultiple, level, waveform], ...]; slow `attack` for strings/pads, fast for plucks and bells.
function tone(t, midi, dur, o = {}) {
  const { partials = [[1, 1, 'triangle']], gain = 0.12, attack = 0.01, cutoff = 4000, endCutoff = null, vibrato = 0, glide = 0 } = o;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  if (endCutoff) f.frequency.exponentialRampToValueAtTime(endCutoff, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  f.connect(g).connect(master);
  const hz = midiToHz(midi);
  for (const [mult, level, type] of partials) {
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = type;
    if (glide) {
      osc.frequency.setValueAtTime(hz * mult * Math.pow(2, -glide / 12), t);
      osc.frequency.exponentialRampToValueAtTime(hz * mult, t + 0.18);
    } else osc.frequency.value = hz * mult;
    og.gain.value = level;
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.2;
      lg.gain.value = hz * mult * 0.006 * vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t + 0.25);
      lfo.stop(t + dur + 0.05);
    }
    osc.connect(og).connect(f);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}
const pianoAt = (t, m, d = 1.2, g = 0.1) => tone(t, m, d, { partials: [[1, 1, 'triangle'], [2, 0.3, 'sine'], [3, 0.1, 'sine']], gain: g, cutoff: 3500 });
const stringsAt = (t, m, d = 2, g = 0.045) => tone(t, m, d, { partials: [[1, 1, 'sawtooth'], [1.005, 0.7, 'sawtooth']], gain: g, attack: 0.25, cutoff: 1800, vibrato: 0.6 });
const bellAt = (t, m, d = 1.6, g = 0.07) => tone(t, m, d, { partials: [[1, 1, 'sine'], [3, 0.25, 'sine'], [5.4, 0.08, 'sine']], gain: g, attack: 0.004 });
const guitarAt = (t, m, d = 1.5, g = 0.09) => tone(t, m, d, { partials: [[1, 1, 'triangle'], [2, 0.35, 'sawtooth']], gain: g, attack: 0.004, cutoff: 3200, endCutoff: 500 });
const steelAt = (t, m, d = 2, g = 0.08) => tone(t, m, d, { partials: [[1, 1, 'sine'], [2, 0.15, 'sine']], gain: g, attack: 0.08, vibrato: 1, glide: 1.5 });
const leadGtrAt = (t, m, d = 0.5, g = 0.09) => tone(t, m, d, { partials: [[1, 1, 'sawtooth'], [1.003, 0.5, 'square']], gain: g, attack: 0.006, cutoff: 2400, endCutoff: 900, vibrato: 0.6 });
const bassSine = (t, m, d = 0.8, g = 0.16) => tone(t, m, d, { partials: [[1, 1, 'sine'], [2, 0.2, 'triangle']], gain: g, attack: 0.01, cutoff: 700 });

function brush(t, level = 0.12) {
  if (!noiseBuf) hat(t, false);
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 3500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(level, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + 0.25);
}

function timpani(t, midi = 38) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(midiToHz(midi) * 1.25, t);
  o.frequency.exponentialRampToValueAtTime(midiToHz(midi), t + 0.12);
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 1);
}

const chordOf = (bass, ...notes) => ({ bass, notes });

// Play the note that starts at step `i` of a bar given [midi, length-in-steps] runs (midi -1 = rest).
function runAt(bar, i, fn) {
  let pos = 0;
  for (const [m, len] of bar) {
    if (pos === i) { if (m > 0) fn(m, len); return; }
    pos += len;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Hits from the Old Days: Beethoven's "Ode to Joy" (D major) over a broken-chord piano and, the second time round,
// strings and timpani. 100 bpm, 16 bars.
// ---------------------------------------------------------------------------------------------------------------
const OLD = {
  chords: [chordOf(38, 62, 66, 69), chordOf(45, 61, 64, 69), chordOf(47, 62, 66, 71), chordOf(45, 61, 64, 69),
    chordOf(38, 62, 66, 69), chordOf(43, 62, 67, 71), chordOf(45, 61, 64, 69), chordOf(38, 62, 66, 69)],
  ode: [
    [[78, 2], [78, 2], [79, 2], [81, 2]], [[81, 2], [79, 2], [78, 2], [76, 2]],
    [[74, 2], [74, 2], [76, 2], [78, 2]], [[78, 3], [76, 1], [76, 4]],
    [[78, 2], [78, 2], [79, 2], [81, 2]], [[81, 2], [79, 2], [78, 2], [76, 2]],
    [[74, 2], [74, 2], [76, 2], [78, 2]], [[76, 3], [74, 1], [74, 4]],
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// Sad Country: a slow G major ballad (72 bpm): fingerpicked guitar, boom-chick bass, brushes, a weeping pedal steel.
// ---------------------------------------------------------------------------------------------------------------
const SAD = {
  chords: [chordOf(43, 55, 59, 62), chordOf(40, 55, 59, 64), chordOf(48, 55, 60, 64), chordOf(38, 54, 57, 62),
    chordOf(43, 55, 59, 62), chordOf(40, 55, 59, 64), chordOf(48, 55, 60, 64), chordOf(38, 54, 57, 62)],
  fifth: [50, 47, 55, 45, 50, 47, 55, 45],
  steel: [
    [[74, 4], [71, 2], [69, 2]], [[71, 4], [67, 4]], [[72, 2], [71, 2], [69, 4]], [[66, 4], [69, 4]],
    [[74, 4], [76, 2], [74, 2]], [[71, 4], [67, 2], [71, 2]], [[72, 2], [71, 2], [69, 2], [67, 2]], [[66, 6], [-1, 2]],
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// Blues Collection: twelve-bar blues in E (94 bpm), shuffle feel, walking bass and a lead guitar that answers itself.
// ---------------------------------------------------------------------------------------------------------------
const BLUES_ROOTS = [40, 40, 40, 40, 45, 45, 40, 40, 47, 45, 40, 47];          // E E E E | A A E E | B A E B
const sevenths = (root) => (root === 40 ? [56, 59, 62] : root === 45 ? [55, 61, 64] : [57, 63, 66]); // E7, A7, B7
const LICKS = {
  A: [[0, 76, 2], [2, 74, 1], [3, 71, 1], [4, 69, 2], [6, 67, 1], [7, 64, 1]],
  B: [[0, 64, 1], [1, 67, 1], [2, 69, 2], [4, 70, 1], [5, 71, 2], [7, 69, 1]],
  C: [[0, 71, 3], [3, 69, 1], [4, 67, 2], [6, 64, 2]],
  D: [[0, 76, 1], [1, 76, 1], [2, 74, 2], [4, 71, 2]],
};
const LICK_ORDER = ['A', 'B', 'A', 'C', 'B', 'A', 'C', 'D', 'A', 'B', 'C', 'D'];

// ---------------------------------------------------------------------------------------------------------------
// Out like a Lamb: a slow music-box lullaby in C major over a soft pad (66 bpm).
// ---------------------------------------------------------------------------------------------------------------
const LAMB = {
  chords: [chordOf(36, 60, 64, 67), chordOf(33, 60, 64, 69), chordOf(41, 60, 65, 69), chordOf(43, 59, 62, 67),
    chordOf(36, 60, 64, 67), chordOf(33, 60, 64, 69), chordOf(41, 60, 65, 69), chordOf(43, 59, 62, 67)],
  tune: [
    [[76, 2], [79, 2], [81, 2], [79, 2]], [[81, 2], [79, 2], [76, 4]], [[77, 2], [81, 2], [84, 2], [81, 2]], [[79, 4], [76, 2], [74, 2]],
    [[76, 2], [79, 2], [84, 2], [81, 2]], [[79, 2], [76, 2], [72, 4]], [[77, 2], [76, 2], [74, 2], [72, 2]], [[74, 4], [72, 4]],
  ],
};

Object.assign(TRACKS, {
  classical: {
    bpm: 100,
    label: 'Hits from the Old Days',
    jam: { scale: [74, 76, 78, 81, 83, 86, 88, 90], bars: OLD.chords.map((c) => ({ bass: [c.bass, c.bass + 7], chord: c.notes })) },
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 16, i = n % 8, second = bar >= 8;
      const c = OLD.chords[bar % 8], e = beatLen / 2;
      // broken-chord ("Alberti") piano accompaniment: low, high, middle, high
      pianoAt(t, [c.notes[0] - 12, c.notes[2] - 12, c.notes[1] - 12, c.notes[2] - 12][i % 4], e * 1.6, 0.05);
      if (i === 0) { pianoAt(t, c.bass, beatLen * 3, 0.1); if (second) timpani(t, c.bass); }
      // the tune on piano, doubled by strings the second time round
      runAt(OLD.ode[bar % 8], i, (m, len) => {
        pianoAt(t, m, e * len * 1.1, 0.13);
        if (second) stringsAt(t, m, e * len * 1.15, 0.05);
      });
      if (second && i === 0) for (const m of c.notes) stringsAt(t, m - 12, beatLen * 4, 0.03);
    },
  },

  country: {
    bpm: 72,
    label: 'Sad Country',
    jam: { scale: [67, 69, 71, 74, 76, 79, 81, 83], bars: SAD.chords.map((c) => ({ bass: [c.bass, c.bass + 7], chord: c.notes })) },
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = SAD.chords[bar], e = beatLen / 2;
      // boom-chick: root on 1, fifth on 3, brushes on 2 and 4 and a soft sweep between
      if (i === 0) bassSine(t, c.bass, e * 3);
      if (i === 4) bassSine(t, SAD.fifth[bar], e * 3);
      if (i === 2 || i === 6) brush(t, 0.16);
      if (i % 2 === 1) brush(t, 0.05);
      // fingerpicked guitar: thumb on the beat, fingers between
      const order = [c.notes[0], c.notes[2], c.notes[1], c.notes[2], c.notes[0], c.notes[2], c.notes[1], c.notes[2]];
      guitarAt(t, order[i], e * 4, i % 2 === 0 ? 0.07 : 0.05);
      // the lonesome pedal steel
      runAt(SAD.steel[bar], i, (m, len) => steelAt(t, m, e * len * 1.05, 0.085));
    },
  },

  blues: {
    bpm: 94,
    label: 'Blues Collection',
    jam: { scale: [76, 79, 81, 82, 83, 86, 88, 91], bars: BLUES_ROOTS.map((r) => ({ bass: [r, r + 7], chord: sevenths(r) })) },
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 12, i = n % 8, root = BLUES_ROOTS[bar];
      const ts = t + (i % 2 === 1 ? beatLen * 0.5 * 0.34 : 0);         // shuffle: the off-beats land late
      const e = beatLen / 2;
      // drums: kick on 1 and 3, clap on 2 and 4, hat on the beat and the swung off-beat
      if (i === 0 || i === 4) kick(t);
      if (i === 2 || i === 6) clap(t);
      if (i % 2 === 0 || i % 4 === 3) hat(ts, i % 2 === 1);
      // walking bass: root, third, fifth, sixth
      if (i % 2 === 0) bass(t, root + [0, 4, 7, 9][i / 2], beatLen * 0.8);
      // lead guitar answers in the second half of each pair of bars, and all through the last four
      if (bar % 2 === 1 || bar >= 8) {
        const shift = root - 40;
        for (const [st, m, len] of LICKS[LICK_ORDER[bar]]) if (st === i) leadGtrAt(ts, m + shift, e * len * 1.1);
      }
      // comping stabs on the 'and' of 2 and 4
      if (i === 3 || i === 7) for (const m of sevenths(root)) guitarAt(ts, m, e * 1.4, 0.04);
    },
  },

  lullaby: {
    bpm: 66,
    label: 'Out like a Lamb',
    jam: { scale: [72, 74, 76, 79, 81, 84, 86, 88], bars: LAMB.chords.map((c) => ({ bass: [c.bass + 12, c.bass + 19], chord: c.notes })) },
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = LAMB.chords[bar], e = beatLen / 2;
      // a quiet rocking bass on 1 and 3 and a pad that swells every bar
      if (i === 0 || i === 4) bassSine(t, c.bass, e * 3, 0.1);
      if (i === 0) for (const m of c.notes) stringsAt(t, m - 12, beatLen * 4.2, 0.022);
      // a music-box arpeggio under the tune
      bellAt(t, [c.notes[0], c.notes[1], c.notes[2], c.notes[1]][i % 4] + 12, e * 3, 0.035);
      runAt(LAMB.tune[bar], i, (m, len) => bellAt(t, m, e * len * 1.3, 0.085));
    },
  },
});

// Loop a track; returns a stop function (like startBeat).
export function startTrack(id) {
  const tr = TRACKS[id];
  if (!ctx || !tr || !tr.step) return startBeat();
  const beatLen = 60 / tr.bpm;
  let n = 0;
  let next = ctx.currentTime + 0.05;
  const timer = setInterval(() => {
    while (next < ctx.currentTime + 0.3) {
      tr.step(next, n, beatLen);
      next += beatLen / 2;
      n++;
    }
  }, 50);
  return () => clearInterval(timer);
}

// ---- drum kit voices (used by Guy at the kit) ----
function snareAt(t, vel = 1) {
  if (!noiseBuf) hat(t, false);
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.45 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + 0.2);
  const o = ctx.createOscillator(), og = ctx.createGain();
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  og.gain.setValueAtTime(0.3 * vel, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(og).connect(master);
  o.start(t); o.stop(t + 0.12);
}
function tomAt(t, hz, vel = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(hz * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.12);
  g.gain.setValueAtTime(0.5 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.45);
}
function cymbalAt(t, len, hp, level) {
  if (!noiseBuf) hat(t, false);
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + len + 0.05);
}
// kind: kick | snare | hat | hatOpen | tom1 | tom2 | floor | crash | ride ; vel 0..1
export function drumHit(kind, vel = 1, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  if (kind === 'kick') kick(t);
  else if (kind === 'snare') snareAt(t, vel);
  else if (kind === 'hat') hat(t, false);
  else if (kind === 'hatOpen') hat(t, true);
  else if (kind === 'tom1') tomAt(t, 190, vel);
  else if (kind === 'tom2') tomAt(t, 150, vel);
  else if (kind === 'floor') tomAt(t, 100, vel);
  else if (kind === 'crash') cymbalAt(t, 1.5, 4500, 0.22 * vel);
  else if (kind === 'ride') cymbalAt(t, 0.6, 7000, 0.12 * vel);
}
