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

// for sfx.js: the audio context and the output every sound goes through (null until the user has started the game)
export const audio = () => ({ ctx, master });

// QA only (src/qa-audio.js): point every sound at another context (an offline one, rendered to numbers) and back again
export function useAudio(c, m) { const old = { ctx, master }; ctx = c; master = m; return () => { ctx = old.ctx; master = old.master; }; }

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

// ---------------------------------------------------------------------------------------------------------------
// The genre records. Every tune and chord loop here is original. A track is a loop of 8-step bars (eighth notes) written as
// chord names, a key and a seed: `makeLine` writes a melody that lands on chord tones on the strong beats, walks by step in
// between and comes home to the tonic, so every track has its own tune and each one plays the same every time. `jam` gives the
// piano and guitar a scale and one chord per bar to play along with. `bars` is the length of the form: a record plays it a few
// times (see trackSeconds, at most 20 s) and then moves on to the next track on the record.
// ---------------------------------------------------------------------------------------------------------------
const distGtrAt = (t, m, d = 0.4, g = 0.05) => tone(t, m, d, { partials: [[1, 1, 'sawtooth'], [1.006, 0.8, 'square'], [0.5, 0.4, 'sawtooth']], gain: g, attack: 0.004, cutoff: 2200, endCutoff: 700 });
const powerChord = (t, root, d, g = 0.04) => { distGtrAt(t, root, d, g); distGtrAt(t, root + 7, d, g); distGtrAt(t, root + 12, d, g * 0.8); };
const organAt = (t, m, d = 2, g = 0.04) => tone(t, m, d, { partials: [[1, 1, 'sine'], [2, 0.6, 'sine'], [3, 0.35, 'sine'], [4, 0.2, 'sine']], gain: g, attack: 0.03, cutoff: 3500 });
const epAt = (t, m, d = 1.4, g = 0.07) => tone(t, m, d, { partials: [[1, 1, 'sine'], [2, 0.35, 'sine'], [4, 0.08, 'sine']], gain: g, attack: 0.004, cutoff: 3200 });
const fiddleAt = (t, m, d = 0.5, g = 0.06) => tone(t, m, d, { partials: [[1, 1, 'sawtooth'], [1.003, 0.6, 'sawtooth']], gain: g, attack: 0.03, cutoff: 3200, vibrato: 0.8 });
const hornAt = (t, m, d = 0.5, g = 0.06) => tone(t, m, d, { partials: [[1, 1, 'sawtooth'], [2, 0.3, 'square']], gain: g, attack: 0.05, cutoff: 1700, endCutoff: 1000, vibrato: 0.5 });
const uprightAt = (t, m, d = 0.5, g = 0.16) => tone(t, m, d, { partials: [[1, 1, 'triangle'], [2, 0.2, 'sine']], gain: g, attack: 0.008, cutoff: 900 });
const bendAt = (t, m, d = 0.8, g = 0.08) => tone(t, m, d, { partials: [[1, 1, 'sawtooth'], [1.003, 0.5, 'square']], gain: g, attack: 0.01, cutoff: 2200, endCutoff: 800, vibrato: 1, glide: 1 });
const stabAt = (t, m, d = 0.25, g = 0.035) => tone(t, m, d, { partials: [[1, 1, 'sawtooth'], [1.005, 0.7, 'sawtooth']], gain: g, attack: 0.004, cutoff: 2600, endCutoff: 700 });
function sub808(t, midi, dur = 0.9, level = 0.22) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(midiToHz(midi) * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(midiToHz(midi), t + 0.06);
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
const jamOf = (scale, chords) => ({ scale, bars: chords.map((c) => ({ bass: [c.bass, c.bass + 7], chord: c.notes })) });
const swung = (t, i, e) => t + (i % 2 === 1 ? e * 0.34 : 0);   // the off-beats land late

// ---- a little theory ----
const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11] };
// 'Am' -> { bass: 45, notes: [57, 60, 64] }. `lift` moves the voicing up by whole octaves.
function chordFromName(name, lift = 0) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  const pc = (NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  let root = 48 + pc;
  if (root < 53) root += 12;
  return chordOf(36 + pc, ...QUALITY[m[3]].map((i) => root + i + lift * 12));
}
const asChords = (list, lift = 0) => list.map((c) => (typeof c === 'string' ? chordFromName(c, lift) : c));
const SCALES = { majPent: [0, 2, 4, 7, 9], minPent: [0, 3, 5, 7, 10], major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], blues: [0, 3, 5, 6, 7, 10] };
const scaleMidi = (pc, kind, lo, hi) => { const out = []; for (let m = lo; m <= hi; m++) if (SCALES[kind].includes((((m - pc) % 12) + 12) % 12)) out.push(m); return out; };
const rng = (seed) => {            // a small seeded random number generator: the same seed always gives the same tune
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
// each rhythm adds up to 8 steps (one bar of eighth notes)
const RHYTHMS = {
  flowing: [[2, 2, 2, 2], [1, 1, 2, 2, 2], [2, 1, 1, 2, 2], [3, 1, 2, 2], [1, 1, 1, 1, 4], [2, 2, 4]],
  smooth: [[2, 2, 2, 2], [4, 2, 2], [2, 2, 4], [3, 1, 2, 2], [1, 1, 2, 4], [2, 1, 1, 2, 2]],
  driving: [[2, 1, 1, 2, 2], [1, 1, 2, 1, 1, 2], [3, 1, 2, 2], [2, 2, 1, 1, 2], [1, 1, 1, 1, 2, 2]],
  fiddle: [[1, 1, 2, 2, 2], [2, 1, 1, 1, 1, 2], [1, 1, 1, 1, 2, 2], [2, 2, 2, 2], [1, 1, 1, 1, 1, 1, 2]],
  jazz: [[2, 1, 1, 2, 2], [1, 1, 1, 1, 2, 2], [3, 1, 1, 1, 2], [2, 2, 1, 1, 2]],
  blues: [[3, 1, 2, 2], [2, 2, 3, 1], [4, 2, 2], [2, 1, 1, 4], [1, 1, 2, 4]],
  kids: [[1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 2, 1, 1, 2], [2, 1, 1, 2, 1, 1], [1, 1, 1, 1, 2, 2]],
};
// A melody, one bar at a time: [[midi, steps], ...] (midi -1 = a rest). `from` = the first bar that has notes.
function makeLine(chords, scale, { seed, rhythms, from = 0, rest = 0, tonic = null }) {
  const rand = rng(seed), bars = [], last = scale.length - 1;
  let idx = Math.floor(scale.length / 2);
  chords.forEach((c, b) => {
    if (b < from) { bars.push([]); return; }
    const pcs = new Set(c.notes.map((m) => m % 12));
    pcs.add(c.bass % 12);
    const rhythm = rhythms[Math.floor(rand() * rhythms.length)];
    const bar = [];
    let pos = 0;
    rhythm.forEach((len, k) => {
      if (pos % 4 === 0) {                                  // beats 1 and 3: a chord tone close to where the tune is
        let best = idx, bd = 99;
        scale.forEach((m, j) => { if (pcs.has(m % 12)) { const d = Math.abs(j - idx) + rand() * 1.5; if (d < bd) { bd = d; best = j; } } });
        idx = best;
      } else {
        let dir = rand() < 0.5 ? -1 : 1;
        if (idx > last * 0.75) dir = -1; else if (idx < last * 0.25) dir = 1;       // stay in the middle of the range
        idx = Math.max(0, Math.min(last, idx + dir * (rand() < 0.7 ? 1 : 2)));
      }
      let m = scale[idx];
      if (tonic !== null && b === chords.length - 1 && k === rhythm.length - 1) {   // the last note of the loop comes home
        let bj = idx, bd = 99;
        scale.forEach((s, j) => { if (s % 12 === tonic && Math.abs(j - idx) < bd) { bd = Math.abs(j - idx); bj = j; } });
        m = scale[bj];
      }
      bar.push([k > 0 && rest > 0 && rand() < rest ? -1 : m, len]);
      pos += len;
    });
    bars.push(bar);
  });
  return bars;
}
// [step, midi, steps] events -> runs (the hand-written blues licks)
const runsFromSteps = (list) => { const out = []; let pos = 0; for (const [st, m, len] of list) { if (st > pos) out.push([-1, st - pos]); out.push([m, len]); pos = st + len; } if (pos < 8) out.push([-1, 8 - pos]); return out; };
const jamOctaves = (d, kind, lo = 68, hi = 94) => scaleMidi(d.pc, kind, lo, hi).slice(0, 8);

// ---- engines: one per genre; each takes { label, bpm, pc (key), seed, chords, ... } and returns a track ----

// rock: palm-muted power chords, a driving kick and snare, a pentatonic lead from the fourth bar
function rockTrack(d) {
  const chords = asChords(d.chords).map((c) => chordOf(c.bass, c.bass + 12, c.bass + 19, c.bass + 24));
  const lead = d.lead || makeLine(chords, scaleMidi(d.pc, 'minPent', 64, 88), { seed: d.seed, rhythms: RHYTHMS.driving, from: 3, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 8, drums: 'rock', jam: jamOf(jamOctaves(d, 'minPent', 64, 90), chords),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, root = chords[bar].bass, e = beatLen / 2;
      if (bar === 0 && i === 0) cymbalAt(t, 1.5, 4500, 0.18);
      if (i === 0 || i === 4 || (i === 6 && bar % 4 === 3)) kick(t);
      if (i === 2 || i === 6) snareAt(t, 0.9);
      hat(t, i === 7);
      bass(t, root, e * 0.8);
      const accent = i === 0 || i === 3 || i === 6;                                  // palm-muted eighths, accents on 1, the 'and' of 2 and 4
      powerChord(t, root + 12, accent ? e * 2 : e * 0.7, accent ? 0.045 : 0.028);
      runAt(lead[bar], i, (m, len) => bendAt(t, m, e * len * 1.1, 0.08));
    },
  };
}

// hip-hop: boom-bap drums, a long 808 bass, electric-piano chords and a bell hook from the fifth bar
function hiphopTrack(d) {
  const chords = asChords(d.chords);
  const hook = d.hook || makeLine(chords, scaleMidi(d.pc, 'minPent', 69, 84), { seed: d.seed, rhythms: RHYTHMS.flowing, from: 4, rest: 0.15, tonic: d.pc });
  const kicks = d.kicks || [[0, 3], [0, 3, 5]];
  return {
    bpm: d.bpm, label: d.label, bars: 8, drums: 'boombap', jam: jamOf(jamOctaves(d, 'minPent', 69, 95), chords),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = chords[bar], e = beatLen / 2, ts = swung(t, i, e);
      if (kicks[bar % 2].includes(i)) kick(t);
      if (i === 2 || i === 6) snareAt(t, 0.8);
      hat(ts, i === 7 && bar % 2 === 1);
      if (i === 0) sub808(t, c.bass, e * 5);
      if (i === 5 && bar % 2) sub808(t, c.bass + 12, e * 2);
      if (i === 0) for (const m of c.notes) epAt(t, m, e * 6, 0.05);
      if (i === 3 || (i === 6 && bar % 2)) for (const m of c.notes) epAt(ts, m + 12, e * 1.2, 0.035);
      runAt(hook[bar], i, (m, len) => bellAt(t, m + 12, e * len * 1.4, 0.06));
    },
  };
}

// upbeat country: boom-chick guitar, a chugging brush train beat and a fiddle
function twostepTrack(d) {
  const chords = asChords(d.chords);
  const fiddle = d.fiddle || makeLine(chords, scaleMidi(d.pc, 'major', 66, 90), { seed: d.seed, rhythms: RHYTHMS.fiddle, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 8, drums: 'train', jam: jamOf(jamOctaves(d, 'majPent', 74, 96), chords),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = chords[bar], e = beatLen / 2;
      if (i === 0) bassSine(t, c.bass, e * 3, 0.13);
      if (i === 4) bassSine(t, c.bass + 7, e * 3, 0.13);
      if (i === 2 || i === 6) { c.notes.forEach((m, k) => guitarAt(t + k * 0.012, m, e * 1.8, 0.05)); snareAt(t, 0.35); }
      brush(t, i === 2 || i === 6 ? 0.14 : 0.07);
      runAt(fiddle[bar], i, (m, len) => fiddleAt(t, m, e * len * 1.05, 0.06));
    },
  };
}

// pop: four on the floor, offbeat bass, plucky arpeggios, a pad and a square-wave hook from the fifth bar
function popTrack(d) {
  const chords = asChords(d.chords);
  const hook = d.hook || makeLine(chords, scaleMidi(d.pc, d.kind || 'major', 72, 88), { seed: d.seed, rhythms: RHYTHMS.flowing, from: 4, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 8, drums: 'disco', jam: jamOf(jamOctaves(d, 'majPent', 72, 96), chords),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = chords[bar], e = beatLen / 2;
      if (i % 2 === 0) kick(t);
      if (i === 2 || i === 6) clap(t);
      if (i % 2 === 1) { hat(t, i % 4 === 3); bass(t, c.bass, e * 0.8); }
      if (i === 0) for (const m of c.notes) stringsAt(t, m, beatLen * 4, 0.02);
      lead(t, [c.notes[0], c.notes[1], c.notes[2], c.notes[1]][i % 4] + 12, e * 0.8, 0.045);
      runAt(hook[bar], i, (m, len) => lead(t, m, e * len * 0.95, 0.09));
    },
  };
}

// jazz: swung ride cymbal, a walking upright bass, comping electric piano and a horn
function jazzTrack(d) {
  const chords = asChords(d.chords);
  const fit = (n) => { while (n > 52) n -= 12; while (n < 36) n += 12; return n; };
  const walk = d.walk || chords.map((c, b) => {                       // root, third, fifth, then a step to the next chord's root
    const nr = chords[(b + 1) % chords.length].bass, r = c.bass;
    return [r, r + (c.notes[1] - c.notes[0]), r + (c.notes[2] - c.notes[0]), nr + (nr > r ? -1 : 1)].map(fit);
  });
  const horn = d.horn || makeLine(chords, scaleMidi(d.pc, 'major', 64, 86), { seed: d.seed, rhythms: RHYTHMS.jazz, rest: 0.2, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 8, drums: 'swing', jam: jamOf(jamOctaves(d, 'majPent', 72, 96), chords),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = chords[bar], e = beatLen / 2, ts = swung(t, i, e);
      if ([0, 2, 3, 4, 6, 7].includes(i)) cymbalAt(ts, 0.5, 7000, i === 3 || i === 7 ? 0.05 : 0.08);
      if (i === 2 || i === 6) hat(t, false);
      if (i % 2 === 0) uprightAt(t, walk[bar][i / 2], beatLen * 0.9);
      if (i === 3 || (i === 7 && bar % 2 === 1)) for (const m of c.notes) epAt(ts, m, e * 1.4, 0.04);
      runAt(horn[bar], i, (m, len) => hornAt(ts, m, e * len * 1.05, 0.055));
    },
  };
}

// slow blues: twelve bars, organ pads, a walking bass, a backbeat and a bending lead
function slowBluesTrack(d) {
  const wrap = (x) => (x > 49 ? x - 12 : x), i0 = 36 + d.pc, I = wrap(i0), IV = wrap(i0 + 5), V = wrap(i0 + 7);
  const roots = d.roots || [I, I, I, I, IV, IV, I, I, V, IV, I, V];
  const voicing = d.voicing || ((r) => (r === V ? [r + 16, r + 19, r + 22] : [r + 15, r + 19, r + 22]));
  const licks = d.licks || makeLine(roots.map((r) => chordOf(r, ...voicing(r))), scaleMidi(d.pc, 'blues', 62, 84), { seed: d.seed, rhythms: RHYTHMS.blues, rest: 0.1, tonic: d.pc }).map((bar, b) => (b === 2 || b === 7 ? null : bar));
  return {
    bpm: d.bpm, label: d.label, bars: 12, drums: 'soft', jam: jamOf(jamOctaves(d, 'blues', 69, 92), roots.map((r) => chordOf(r, ...voicing(r)))),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 12, i = n % 8, root = roots[bar], e = beatLen / 2, ts = swung(t, i, e);
      if (i === 0) { for (const m of voicing(root)) organAt(t, m, beatLen * 4.2, 0.03); kick(t); }
      if (i % 2 === 0) bassSine(t, root + [0, 7, 10, 7][i / 2], beatLen * 0.9, 0.14);
      if (i === 2 || i === 6) snareAt(t, 0.4);
      if (i % 2 === 1) brush(ts, 0.06);
      if (licks[bar]) runAt(licks[bar], i, (m, len) => bendAt(ts, m, e * len * 1.15, 0.075));
    },
  };
}

// party: a kick on every beat, offbeat bass, clap and open hat, synth stabs and a chant hook from the fifth bar
function partyTrack(d) {
  const chords = asChords(d.chords);
  const hook = d.hook || makeLine(chords, scaleMidi(d.pc, d.kind || 'minPent', 72, 90), { seed: d.seed, rhythms: RHYTHMS.driving, from: 4, rest: 0.2, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 8, drums: 'disco', jam: jamOf(jamOctaves(d, d.kind || 'minPent', 67, 92), chords),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = chords[bar], e = beatLen / 2;
      if (i % 2 === 0) kick(t);
      if (i === 2 || i === 6) clap(t);
      if (i % 2 === 1) { hat(t, true); bass(t, c.bass, e * 0.75); }
      if (i === 3 || i === 6) for (const m of c.notes) stabAt(t, m, e * 1.1, 0.035);
      if (bar === 7 && i === 6) cymbalAt(t, 1, 4500, 0.15);
      runAt(hook[bar], i, (m, len) => lead(t, m, e * len * 0.9, 0.09));
    },
  };
}

// kids' songs: a four-bar loop, oom-pah bass, claps on 2 and 4, a bouncy square-wave tune and off-beat chord chops
function kidsTrack(d) {
  const chords = asChords(d.chords);
  const melody = makeLine(chords, scaleMidi(d.pc, 'majPent', 72, 88), { seed: d.seed, rhythms: RHYTHMS.kids, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 4, drums: 'rock', jam: jamOf(jamOctaves(d, 'majPent', 72, 96), chords),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 4, i = n % 8, c = chords[bar], e = beatLen / 2;
      if (i % 2 === 0) kick(t);
      if (i === 2 || i === 6) clap(t);
      hat(t, i % 2 === 1);
      bass(t, i % 4 < 2 ? c.bass + 12 : c.bass + 19, beatLen * 0.4);
      runAt(melody[bar], i, (m, len) => lead(t, m, e * len * 0.84, 0.11));
      if (i % 2 === 1) for (const m of c.notes) lead(t, m, beatLen * 0.18, 0.035);
    },
  };
}

// classical: a broken-chord piano under a tune, doubled by strings the second time round (sixteen bars)
function classicalTrack(d) {
  const low = asChords(d.chords), chords = asChords(d.chords, 1);
  const tune = makeLine(low, scaleMidi(d.pc, d.kind || 'major', 64, 88), { seed: d.seed, rhythms: RHYTHMS.smooth, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 16, drums: 'march', jam: jamOf(jamOctaves(d, d.kind === 'major' || !d.kind ? 'majPent' : 'minPent', 70, 96), low),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 16, i = n % 8, second = bar >= 8, c = chords[bar % 8], e = beatLen / 2;
      pianoAt(t, [c.notes[0] - 12, c.notes[2] - 12, c.notes[1] - 12, c.notes[2] - 12][i % 4], e * 1.6, 0.05);
      if (i === 0) { pianoAt(t, c.bass, beatLen * 3, 0.1); if (second) timpani(t, c.bass); }
      runAt(tune[bar % 8], i, (m, len) => { pianoAt(t, m, e * len * 1.1, 0.13); if (second) stringsAt(t, m, e * len * 1.15, 0.05); });
      if (second && i === 0) for (const m of c.notes) stringsAt(t, m - 12, beatLen * 4, 0.03);
    },
  };
}

// a slow country ballad: fingerpicked guitar, boom-chick bass, brushes and a weeping pedal steel
function sadCountryTrack(d) {
  const chords = asChords(d.chords);
  const steel = makeLine(chords, scaleMidi(d.pc, d.kind || 'majPent', 62, 86), { seed: d.seed, rhythms: RHYTHMS.smooth, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 8, drums: 'soft', jam: jamOf(jamOctaves(d, d.kind || 'majPent', 67, 92), chords),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = chords[bar], e = beatLen / 2;
      if (i === 0) bassSine(t, c.bass, e * 3);
      if (i === 4) bassSine(t, c.bass + 7, e * 3);
      if (i === 2 || i === 6) brush(t, 0.16);
      if (i % 2 === 1) brush(t, 0.05);
      const order = [c.notes[0], c.notes[2], c.notes[1], c.notes[2], c.notes[0], c.notes[2], c.notes[1], c.notes[2]];
      guitarAt(t, order[i], e * 4, i % 2 === 0 ? 0.07 : 0.05);
      runAt(steel[bar], i, (m, len) => steelAt(t, m, e * len * 1.05, 0.085));
    },
  };
}

// a twelve-bar shuffle blues: walking bass, a lead guitar that answers itself and comping stabs
function shuffleBluesTrack(d) {
  const wrap = (x) => (x > 49 ? x - 12 : x), i0 = 36 + d.pc, I = wrap(i0), IV = wrap(i0 + 5), V = wrap(i0 + 7);
  const roots = [I, I, I, I, IV, IV, I, I, V, IV, I, V], sevenths = (r) => [r + 16, r + 19, r + 22];
  const licks = makeLine(roots.map((r) => chordOf(r, ...sevenths(r))), scaleMidi(d.pc, 'blues', 70, 90), { seed: d.seed, rhythms: RHYTHMS.blues, rest: 0.1, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 12, drums: 'rock', jam: jamOf(jamOctaves(d, 'blues', 72, 94), roots.map((r) => chordOf(r, ...sevenths(r)))),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 12, i = n % 8, root = roots[bar], e = beatLen / 2, ts = swung(t, i, e);
      if (i === 0 || i === 4) kick(t);
      if (i === 2 || i === 6) clap(t);
      if (i % 2 === 0 || i % 4 === 3) hat(ts, i % 2 === 1);
      if (i % 2 === 0) bass(t, root + [0, 4, 7, 9][i / 2], beatLen * 0.8);
      if (bar % 2 === 1 || bar >= 8) runAt(licks[bar], i, (m, len) => leadGtrAt(ts, m, e * len * 1.1));
      if (i === 3 || i === 7) for (const m of sevenths(root)) guitarAt(ts, m, e * 1.4, 0.04);
    },
  };
}

// a lullaby: a music-box tune over a soft pad and a slow rocking bass
function lullabyTrack(d) {
  const chords = asChords(d.chords);
  const tune = makeLine(chords, scaleMidi(d.pc, 'majPent', 72, 91), { seed: d.seed, rhythms: RHYTHMS.smooth, tonic: d.pc });
  return {
    bpm: d.bpm, label: d.label, bars: 8, drums: 'soft', jam: jamOf(jamOctaves(d, 'majPent', 72, 96), chords.map((c) => chordOf(c.bass + 12, ...c.notes))),
    step(t, n, beatLen) {
      const bar = Math.floor(n / 8) % 8, i = n % 8, c = chords[bar], e = beatLen / 2;
      if (i === 0 || i === 4) bassSine(t, c.bass, e * 3, 0.1);
      if (i === 0) for (const m of c.notes) stringsAt(t, m, beatLen * 4.2, 0.022);
      bellAt(t, [c.notes[0], c.notes[1], c.notes[2], c.notes[1]][i % 4] + 12, e * 3, 0.035);
      runAt(tune[bar], i, (m, len) => bellAt(t, m, e * len * 1.3, 0.085));
    },
  };
}

// ---- the first tune of each record keeps its hand-written melody; the rest come from the generators ----
const ROCK_LEAD = [
  [], [], [], [[-1, 4], [76, 1], [79, 1], [81, 2]],
  [[76, 2], [79, 1], [76, 1], [74, 2], [71, 2]], [[71, 2], [74, 2], [76, 3], [-1, 1]],
  [[79, 1], [81, 1], [79, 2], [76, 2], [74, 1], [76, 1]], [[74, 2], [71, 2], [69, 2], [71, 2]],
];
const HIPHOP_CHORDS = [chordOf(45, 55, 60, 64), chordOf(41, 57, 60, 64), chordOf(38, 57, 60, 65), chordOf(40, 56, 59, 62),
  chordOf(45, 55, 60, 64), chordOf(41, 57, 60, 64), chordOf(38, 57, 60, 65), chordOf(40, 56, 59, 62)];
const HIPHOP_HOOK = [
  [], [], [], [],
  [[81, 1], [79, 1], [76, 2], [-1, 2], [72, 2]], [[77, 2], [76, 1], [72, 1], [69, 4]],
  [[74, 1], [77, 1], [81, 2], [79, 2], [77, 2]], [[76, 3], [-1, 1], [72, 2], [71, 2]],
].map((bar) => bar.map(([m, len]) => [m > 0 ? m - 12 : m, len]));      // the engine plays the hook an octave up
const TWOSTEP_CHORDS = ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D'];
const TWOSTEP_FIDDLE = [
  [[78, 2], [81, 1], [78, 1], [74, 2], [78, 2]], [[78, 2], [76, 2], [74, 2], [71, 2]],
  [[74, 1], [78, 1], [81, 2], [78, 2], [74, 2]], [[81, 3], [-1, 1], [78, 2], [76, 2]],
  [[78, 1], [81, 1], [83, 2], [81, 2], [78, 2]], [[79, 2], [78, 1], [76, 1], [74, 2], [71, 2]],
  [[76, 2], [78, 2], [81, 2], [85, 2]], [[86, 4], [81, 2], [78, 2]],
];
const POP_HOOK = [
  [], [], [], [],
  [[76, 1], [76, 1], [79, 2], [76, 1], [74, 1], [72, 2]], [[77, 1], [77, 1], [81, 2], [77, 1], [76, 1], [72, 2]],
  [[79, 2], [79, 1], [76, 1], [72, 2], [76, 2]], [[74, 1], [74, 1], [79, 2], [77, 2], [74, 2]],
];
const JAZZ_CHORDS = [chordOf(38, 53, 57, 60, 64), chordOf(43, 59, 62, 65, 69), chordOf(48, 55, 59, 62, 64), chordOf(45, 55, 60, 64, 67),
  chordOf(38, 53, 57, 60, 64), chordOf(43, 59, 62, 65, 69), chordOf(48, 55, 59, 62, 64), chordOf(43, 59, 62, 65, 69)];
const JAZZ_WALK = [[38, 41, 45, 42], [43, 47, 50, 47], [48, 52, 55, 46], [45, 48, 52, 39], [38, 41, 45, 42], [43, 47, 50, 47], [48, 52, 55, 50], [43, 47, 50, 53]];
const JAZZ_HORN = [
  [[-1, 2], [69, 1], [72, 1], [74, 2], [72, 2]], [[71, 2], [74, 1], [77, 1], [76, 2], [74, 2]],
  [[72, 3], [-1, 1], [67, 2], [69, 2]], [[72, 2], [71, 1], [69, 1], [67, 4]],
  [[74, 2], [77, 1], [81, 1], [79, 2], [77, 2]], [[74, 1], [71, 1], [74, 2], [77, 2], [79, 2]],
  [[84, 3], [81, 1], [79, 2], [76, 2]], [[74, 2], [71, 2], [67, 4]],
];
const SLOW_LICKS = {
  a: [[0, 72, 3], [3, 69, 1], [4, 67, 2], [6, 64, 2]],
  b: [[0, 67, 1], [1, 69, 1], [2, 72, 3], [5, 70, 1], [6, 69, 2]],
  c: [[0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 69, 2]],
  d: [[0, 64, 2], [2, 67, 2], [4, 69, 3], [7, 67, 1]],
};
const SLOW_ORDER = ['a', 'b', null, 'c', 'd', 'c', 'a', null, 'b', 'd', 'a', 'c'];
const PARTY_HOOK = [
  [], [], [], [],
  [[79, 1], [79, 1], [-1, 1], [79, 1], [82, 2], [79, 2]], [[77, 1], [77, 1], [-1, 1], [77, 1], [81, 2], [77, 2]],
  [[79, 1], [79, 1], [-1, 1], [82, 1], [84, 2], [82, 2]], [[81, 2], [77, 2], [74, 2], [-1, 2]],
];

Object.assign(TRACKS, {
  // ---- Garage Thunder (rock) ----
  rock: rockTrack({ label: 'Garage Thunder', bpm: 124, pc: 4, chords: ['E', 'E', 'G', 'A', 'E', 'E', 'D', 'A'], lead: ROCK_LEAD }),
  rock2: rockTrack({ label: 'Loose Gravel', bpm: 112, pc: 9, seed: 11, chords: ['A', 'A', 'D', 'E', 'A', 'A', 'G', 'D'] }),
  rock3: rockTrack({ label: 'Basement Lightning', bpm: 138, pc: 2, seed: 12, chords: ['D', 'D', 'F', 'G', 'D', 'D', 'C', 'G'] }),
  rock4: rockTrack({ label: 'Last Amp Standing', bpm: 100, pc: 7, seed: 13, chords: ['G', 'G', 'Bb', 'C', 'G', 'G', 'F', 'C'] }),
  // ---- Rooftop Beats (hip-hop) ----
  hiphop: hiphopTrack({ label: 'Rooftop Beats', bpm: 88, pc: 9, chords: HIPHOP_CHORDS, hook: HIPHOP_HOOK }),
  hiphop2: hiphopTrack({ label: 'Late Bus Loop', bpm: 84, pc: 2, seed: 21, chords: ['Dm7', 'Bbmaj7', 'Gm7', 'A7', 'Dm7', 'Bbmaj7', 'Gm7', 'A7'] }),
  hiphop3: hiphopTrack({ label: 'Corner Store Cipher', bpm: 92, pc: 4, seed: 22, kicks: [[0, 3, 6], [0, 5]], chords: ['Em7', 'Cmaj7', 'Am7', 'B7', 'Em7', 'Cmaj7', 'Am7', 'B7'] }),
  hiphop4: hiphopTrack({ label: 'Neon Puddles', bpm: 78, pc: 5, seed: 23, chords: ['Fm7', 'Dbmaj7', 'Abmaj7', 'Eb', 'Fm7', 'Dbmaj7', 'Abmaj7', 'C7'] }),
  // ---- Dusty Road Two-Step (upbeat country) ----
  twostep: twostepTrack({ label: 'Dusty Road Two-Step', bpm: 118, pc: 2, chords: TWOSTEP_CHORDS, fiddle: TWOSTEP_FIDDLE }),
  twostep2: twostepTrack({ label: 'Barn Dance Hustle', bpm: 126, pc: 7, seed: 31, chords: ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G'] }),
  twostep3: twostepTrack({ label: 'Creekbed Shuffle', bpm: 108, pc: 9, seed: 32, chords: ['A', 'D', 'A', 'E', 'A', 'D', 'E', 'A'] }),
  twostep4: twostepTrack({ label: 'Sundown Hoedown', bpm: 134, pc: 4, seed: 33, chords: ['E', 'A', 'E', 'B', 'E', 'A', 'B', 'E'] }),
  // ---- Neon Sugar (pop) ----
  pop: popTrack({ label: 'Neon Sugar', bpm: 118, pc: 0, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], hook: POP_HOOK }),
  pop2: popTrack({ label: 'Glitter Static', bpm: 124, pc: 0, seed: 41, chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'] }),
  pop3: popTrack({ label: 'Skyline Heart', bpm: 112, pc: 5, seed: 42, chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'] }),
  pop4: popTrack({ label: 'Confetti Signal', bpm: 128, pc: 7, seed: 43, chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'] }),
  // ---- Midnight Swing Club (jazz) ----
  jazz: jazzTrack({ label: 'Midnight Swing Club', bpm: 132, pc: 0, chords: JAZZ_CHORDS, walk: JAZZ_WALK, horn: JAZZ_HORN }),
  jazz2: jazzTrack({ label: 'Blue Corner Booth', bpm: 118, pc: 0, seed: 51, chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', 'G7'] }),
  jazz3: jazzTrack({ label: 'Velvet Elevator', bpm: 104, pc: 5, seed: 52, chords: ['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Fmaj7', 'Dm7', 'Gm7', 'C7'] }),
  jazz4: jazzTrack({ label: 'Last Call Cool', bpm: 140, pc: 5, seed: 53, chords: ['Gm7', 'C7', 'Fmaj7', 'Bbmaj7', 'Em7', 'A7', 'Dm7', 'Dm7'] }),
  // ---- Rainy Day Blues (slow blues) ----
  slowblues: slowBluesTrack({
    label: 'Rainy Day Blues', bpm: 62, pc: 9,
    roots: [45, 45, 45, 45, 38, 38, 45, 45, 40, 38, 45, 40],
    voicing: (r) => (r === 45 ? [55, 60, 64] : r === 38 ? [53, 57, 60] : [56, 59, 62]),
    licks: SLOW_ORDER.map((k) => (k ? runsFromSteps(SLOW_LICKS[k]) : null)),
  }),
  slowblues2: slowBluesTrack({ label: 'Porch Rain Slow Drag', bpm: 56, pc: 4, seed: 61 }),
  slowblues3: slowBluesTrack({ label: 'Kettle on the Stove', bpm: 64, pc: 7, seed: 62 }),
  slowblues4: slowBluesTrack({ label: 'Streetlight Lament', bpm: 60, pc: 2, seed: 63 }),
  // ---- Party Time Mixtape (party) ----
  party: partyTrack({ label: 'Party Time Mixtape', bpm: 126, pc: 7, chords: ['Gm', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'Bb', 'F'], hook: PARTY_HOOK }),
  party2: partyTrack({ label: 'Glow Stick Rush', bpm: 128, pc: 9, seed: 71, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'] }),
  party3: partyTrack({ label: 'Confetti Cannon', bpm: 122, pc: 2, seed: 72, chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C'] }),
  party4: partyTrack({ label: 'Balloon Drop', bpm: 132, pc: 4, seed: 73, chords: ['Em', 'D', 'C', 'D', 'Em', 'D', 'C', 'B'] }),
  // ---- Happy Time Parade (kids): the first tune is the hand-written one defined earlier ----
  happy2: kidsTrack({ label: 'Bubble Bounce', bpm: 126, pc: 7, seed: 81, chords: ['G', 'C', 'G', 'D'] }),
  happy3: kidsTrack({ label: 'Sunny Side Skip', bpm: 138, pc: 5, seed: 82, chords: ['F', 'Bb', 'C', 'F'] }),
  happy4: kidsTrack({ label: 'Pancake Polka', bpm: 144, pc: 2, seed: 83, chords: ['D', 'G', 'A', 'D'] }),
  // ---- Hits from the Old Days (classical): the first is Beethoven's Ode to Joy defined earlier; these are original ----
  classical2: classicalTrack({ label: 'Sonata in the Garden', bpm: 112, pc: 0, seed: 91, chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G'] }),
  classical3: classicalTrack({ label: 'Minuet for a Quiet Room', bpm: 92, pc: 9, kind: 'harmonic', seed: 92, chords: ['Am', 'Dm', 'E', 'Am', 'F', 'Dm', 'E', 'Am'] }),
  classical4: classicalTrack({ label: 'Allegro Over the Rooftops', bpm: 132, pc: 7, seed: 93, chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'] }),
  // ---- Sad Country ----
  country2: sadCountryTrack({ label: 'Fence Line Blues', bpm: 68, pc: 4, kind: 'minPent', seed: 101, chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'] }),
  country3: sadCountryTrack({ label: 'Highway Moon', bpm: 76, pc: 2, seed: 102, chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D'] }),
  country4: sadCountryTrack({ label: 'Letter I Never Sent', bpm: 62, pc: 9, kind: 'minPent', seed: 103, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'] }),
  // ---- Blues Collection ----
  blues2: shuffleBluesTrack({ label: 'Gravel Road Shuffle', bpm: 104, pc: 9, seed: 111 }),
  blues3: shuffleBluesTrack({ label: 'Hammer and Nails', bpm: 88, pc: 7, seed: 112 }),
  blues4: shuffleBluesTrack({ label: 'Midnight Train Home', bpm: 112, pc: 2, seed: 113 }),
  // ---- Out like a Lamb (lullabies) ----
  lullaby2: lullabyTrack({ label: 'Moon Mobile', bpm: 60, pc: 5, seed: 121, chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'] }),
  lullaby3: lullabyTrack({ label: 'Counting Clouds', bpm: 68, pc: 7, seed: 122, chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'] }),
  lullaby4: lullabyTrack({ label: 'Blanket Fort', bpm: 56, pc: 3, seed: 123, chords: ['Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb', 'Ab', 'Bb'] }),
});

// The earlier hand-written tunes: give them song titles of their own and the length of their form.
Object.assign(TRACKS.happy, { label: 'Parade Day', bars: 4, drums: 'rock' });
Object.assign(TRACKS.classical, { label: 'Ode to Joy', bars: 16, drums: 'march' });
Object.assign(TRACKS.country, { label: 'Empty Porch Swing', bars: 8, drums: 'soft' });
Object.assign(TRACKS.blues, { label: 'Twelve Bar Sunrise', bars: 12, drums: 'rock' });
Object.assign(TRACKS.lullaby, { label: 'Little Lamb Dream', bars: 8, drums: 'soft' });

// How long a record plays a track before it moves on to the next one: whole runs through the form that fit in 20 seconds, or
// the first 20 seconds of a form that is longer than that (short songs keep the game lively).
export const MAX_TRACK_SECONDS = 20;
export function trackSeconds(tr) {
  const loop = (tr.bars || 8) * 4 * (60 / tr.bpm);
  return loop >= MAX_TRACK_SECONDS ? MAX_TRACK_SECONDS : loop * Math.floor(MAX_TRACK_SECONDS / loop);
}

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
