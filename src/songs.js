// Piano material. Every song is { name, bpm, events }, events = [{ beat, r: [midi], l: [midi], dur }] (dur in beats).
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Lay out a melody line [[midi, beats], ...] (midi 0 = rest) starting at `start`.
function line(start, notes, hand = 'r') {
  const out = [];
  let b = start;
  for (const [m, len] of notes) {
    if (m) out.push({ beat: b, [hand]: [m], dur: len * 1.4 });
    b += len;
  }
  return out;
}

const merge = (...lists) => lists.flat().sort((a, b) => a.beat - b.beat);

// Chords per bar -> left-hand events (a bass note then the chord a beat later)
const CH = {
  C: [48, 55, 60, 64], G: [43, 55, 59, 62], F: [41, 53, 57, 60], Am: [45, 57, 60, 64], Em: [40, 55, 59, 64],
  Dm: [38, 53, 57, 62], E: [40, 56, 59, 64], D: [38, 54, 57, 62], Bm: [47, 54, 59, 62],
};
function comp(chords, beatsPerBar = 4) {
  const out = [];
  chords.forEach((c, i) => {
    const [bass, ...rest] = CH[c];
    const b = i * beatsPerBar;
    out.push({ beat: b, l: [bass], dur: 2 });
    out.push({ beat: b + beatsPerBar / 2, l: rest, dur: 2 });
  });
  return out;
}

function odeToJoy() {
  const [C, D, E, F, G] = [72, 74, 76, 77, 79];
  const A = [[E, 1], [E, 1], [F, 1], [G, 1], [G, 1], [F, 1], [E, 1], [D, 1], [C, 1], [C, 1], [D, 1], [E, 1]];
  const r = [...A, [E, 1.5], [D, 0.5], [D, 2], ...A, [D, 1.5], [C, 0.5], [C, 2]];
  return { name: 'Ode to Joy', bpm: 112, events: merge(line(0, r), comp(['C', 'C', 'C', 'G', 'C', 'C', 'G', 'C'])) };
}

function twinkle() {
  const [C, D, E, F, G, A] = [72, 74, 76, 77, 79, 81];
  const p1 = [[C, 1], [C, 1], [G, 1], [G, 1], [A, 1], [A, 1], [G, 2], [F, 1], [F, 1], [E, 1], [E, 1], [D, 1], [D, 1], [C, 2]];
  const p2 = [[G, 1], [G, 1], [F, 1], [F, 1], [E, 1], [E, 1], [D, 2]];
  const r = [...p1, ...p2, ...p2, ...p1];
  return { name: 'Twinkle Twinkle', bpm: 96, events: merge(line(0, r), comp(['C', 'F', 'C', 'G', 'C', 'F', 'C', 'G', 'C', 'F', 'C', 'G', 'C', 'F', 'C', 'C'])) };
}

function furElise() {
  const H = 0.5;
  const phrase = [[76, H], [75, H], [76, H], [75, H], [76, H], [71, H], [74, H], [72, H], [69, 1.5]];
  const p2 = [[60, H], [64, H], [69, H], [71, 1.5], [64, H], [68, H], [71, H], [72, 1.5]];
  const r = [...phrase, ...p2, ...phrase, [64, H], [72, H], [71, H], [69, 2]];
  // left hand arpeggios in Am / E
  const l = [];
  const arp = (b, root) => [[root, 0], [root + 7, 0.5], [root + 12, 1]].forEach(([n, o]) => l.push({ beat: b + o, l: [n], dur: 1 }));
  arp(1.5, 45); arp(4.5, 45); arp(6.5, 40); arp(8.5, 45); arp(10, 45); arp(12.5, 45); arp(14.5, 40);
  arp(16.5, 45); arp(19.5, 45); arp(21.5, 40);
  return { name: 'Für Elise', bpm: 128, events: merge(line(0, r), l) };
}

function blues() {
  const prog = ['C', 'C', 'C', 'C', 'F', 'F', 'C', 'C', 'G', 'F', 'C', 'G'];
  const roots = { C: 48, F: 53, G: 55 };
  const events = [];
  const scale = [72, 75, 77, 78, 79, 82, 84];
  prog.forEach((c, bar) => {
    const r0 = roots[c];
    [0, 4, 7, 9].forEach((o, i) => events.push({ beat: bar * 4 + i, l: [r0 + o], dur: 1 }));
    const slots = [0, 0.67, 1, 1.67, 2, 2.67, 3, 3.67].filter(() => Math.random() < 0.55);
    let k = Math.floor(rand(0, scale.length));
    for (const s of slots) { k = Math.max(0, Math.min(scale.length - 1, k + pick([-2, -1, -1, 0, 1, 1, 2]))); events.push({ beat: bar * 4 + s, r: [scale[k]], dur: 1 }); }
    if (bar === 11) events.push({ beat: bar * 4 + 3, r: [84], l: [48, 52, 55], dur: 3 });
  });
  return { name: 'Twelve-Bar Blues', bpm: 100, events: events.sort((a, b) => a.beat - b.beat) };
}

function waltz() {
  // 3/4 Gymnopedie-style
  const bars = [['G', 43, [59, 62, 66]], ['D', 38, [57, 61, 66]], ['G', 43, [59, 62, 66]], ['D', 38, [57, 61, 66]]];
  const events = [];
  const mel = [[78, 3], [81, 3], [83, 3], [81, 3], [78, 3], [74, 3], [78, 3], [76, 3]];
  bars.forEach(([, bass, ch], i) => {
    for (let rep = 0; rep < 2; rep++) {
      const b = (i + rep * 4) * 3;
      events.push({ beat: b, l: [bass], dur: 2 });
      events.push({ beat: b + 1, l: ch, dur: 1.5 });
      events.push({ beat: b + 2, l: ch, dur: 1.5 });
    }
  });
  return { name: 'Moonlit Waltz', bpm: 66 * 1.4, events: merge(events, line(0, mel)) };
}

function improv() {
  const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
  const events = [];
  let k = 5;
  for (let beat = 0; beat < 32; beat += 0.5) {
    if (Math.random() < 0.7) { k = Math.max(0, Math.min(scale.length - 1, k + pick([-2, -1, -1, 1, 1, 2, 3, -3]))); events.push({ beat, r: [scale[k]], dur: 1.2 }); }
    if (beat % 4 === 0) events.push({ beat, l: [pick([[45, 52, 57], [41, 48, 53], [48, 55, 60], [43, 50, 55]])].flat(), dur: 3 });
  }
  return { name: 'Free Improvisation', bpm: 92, events };
}

// Scales from the beginner's book: up and down slowly, then again quickly, with the tonic in the left hand.
function scaleSong(name, root, intervals) {
  const up = intervals.map((i) => root + 12 + i);
  const run = [...up, ...up.slice(0, -1).reverse()];
  const events = [];
  let beat = 0;
  for (const step of [0.75, 0.5]) {
    run.forEach((n, i) => events.push({ beat: beat + i * step, r: [n], dur: step * 1.3 }));
    events.push({ beat, l: [root - 12, root - 5], dur: 3 });
    beat += run.length * step + 1;
  }
  events.push({ beat: beat - 0.5, l: [root - 12, root - 5, root], r: [root + 24], dur: 3 });
  return { name, bpm: 100, events: events.sort((a, b) => a.beat - b.beat) };
}
const cMajorScale = () => scaleSong('C Major Scale', 60, [0, 2, 4, 5, 7, 9, 11, 12]);
const aMinorScale = () => scaleSong('A Minor Scale', 57, [0, 2, 3, 5, 7, 8, 10, 12]);
const gMajorScale = () => scaleSong('G Major Scale', 55, [0, 2, 4, 5, 7, 9, 11, 12]);


// ---- Chapter tunes (skills.js CHAPTERS): each one waits for the chapter named in MAKERS ----
// note name -> MIDI (C5 = 72, like the tunes above): n('E5') = 76
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const n = (s) => { const m = /^([A-G])([#b]?)(\d)$/.exec(s); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
// "E5:1 D5:1 R:2" -> [[midi, beats], ...] (R = a rest)
const tune = (str) => str.trim().split(/\s+/).map((t) => { const [a, b] = t.split(':'); return [a === 'R' ? 0 : n(a), +b]; });
const bass3 = (chords, per) => chords.flatMap((c, i) => [{ beat: i * per, l: [CH[c][0]], dur: per * 0.6 }, { beat: i * per + 1, l: CH[c].slice(1), dur: 1.2 }, ...(per > 2 ? [{ beat: i * per + 2, l: CH[c].slice(1), dur: 1.2 }] : [])]);

function maryLamb() {
  const m = tune('E5:1 D5:1 C5:1 D5:1 E5:1 E5:1 E5:2 D5:1 D5:1 D5:2 E5:1 G5:1 G5:2 E5:1 D5:1 C5:1 D5:1 E5:1 E5:1 E5:1 E5:1 D5:1 D5:1 E5:1 D5:1 C5:4');
  return { name: 'Mary Had a Little Lamb', bpm: 108, events: merge(line(0, m), comp(['C', 'C', 'G', 'C', 'C', 'C', 'G', 'C'])) };
}
function rowBoat() {         // 6/8 written in eighth notes (0.5 beat)
  const e = 0.5, q = 1, dq = 1.5;
  const m = [['C5', dq], ['C5', dq], ['C5', q], ['D5', e], ['E5', dq], ['E5', q], ['D5', e], ['E5', q], ['F5', e], ['G5', dq + dq],
    ['C6', e], ['C6', e], ['C6', e], ['G5', e], ['G5', e], ['G5', e], ['E5', e], ['E5', e], ['E5', e], ['C5', e], ['C5', e], ['C5', e],
    ['G5', q], ['F5', e], ['E5', q], ['D5', e], ['C5', dq + dq]].map(([a, b]) => [n(a), b]);
  return { name: 'Row, Row, Row Your Boat', bpm: 126, events: merge(line(0, m), comp(['C', 'C', 'C', 'G', 'C', 'C', 'G', 'C'], 3)) };
}
function saints() {
  const m = tune('C5:1 E5:1 F5:1 G5:4 R:1 C5:1 E5:1 F5:1 G5:4 R:1 C5:1 E5:1 F5:1 G5:2 E5:2 C5:2 E5:2 D5:4 E5:1 E5:1 D5:1 D5:1 C5:2 C5:2 C5:4');
  return { name: 'When the Saints Go Marching In', bpm: 120, events: merge(line(0, m), comp(['C', 'C', 'C', 'C', 'C', 'G', 'C', 'C'])) };
}
function amazingGrace() {    // 3/4
  const m = tune('R:2 G4:1 C5:2 E5:0.5 C5:0.5 E5:2 D5:1 C5:2 A4:1 G4:2 G4:1 C5:2 E5:0.5 C5:0.5 E5:2 D5:1 G5:3 E5:3');
  const m2 = tune('E5:1 G5:1 G5:0.5 E5:0.5 G5:2 E5:1 D5:1 C5:2 A4:1 G4:2 G4:1 C5:2 E5:0.5 C5:0.5 E5:2 D5:1 C5:3');
  return { name: 'Amazing Grace', bpm: 84, events: merge(line(0, m), line(m.reduce((a, [, b]) => a + b, 0), m2), bass3(['C', 'C', 'C', 'F', 'C', 'C', 'G', 'C', 'C', 'C', 'F', 'C', 'C', 'G', 'C', 'C'].slice(0, 16), 3).slice(0, 48)) };
}
function greensleeves() {    // 3/4, A minor
  const m = tune('A4:1 C5:2 D5:1 E5:1.5 F5:0.5 E5:1 D5:2 B4:1 G4:1.5 A4:0.5 B4:1 C5:2 A4:1 A4:1.5 G#4:0.5 A4:1 B4:2 G#4:1 E4:3');
  return { name: 'Greensleeves', bpm: 96, events: merge(line(0, m), bass3(['Am', 'Am', 'G', 'G', 'Am', 'Am', 'E', 'E'], 3)) };
}
function minuetG() {         // after Petzold, 3/4
  const m = tune('D6:1 G5:0.5 A5:0.5 B5:0.5 C6:0.5 D6:1 G5:1 G5:1 E6:1 C6:0.5 D6:0.5 E6:0.5 F#6:0.5 G6:1 G5:1 G5:1 C6:1 D6:0.5 C6:0.5 B5:0.5 A5:0.5 B5:1 C6:0.5 B5:0.5 A5:0.5 G5:0.5 F#5:1 G5:0.5 A5:0.5 B5:0.5 G5:0.5 B5:2 R:1');
  return { name: 'Minuet in G', bpm: 116, events: merge(line(0, m), bass3(['G', 'G', 'C', 'C', 'G', 'D', 'G', 'G'], 3)) };
}
function canon() {           // a simplified Canon in D: the ground bass over a rising melody, 4/4
  const bass = [38, 45, 47, 42, 43, 38, 43, 45];
  const chords = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [54, 57, 61], [55, 59, 62], [50, 54, 57], [55, 59, 62], [57, 61, 64]];
  const mel = tune('F#5:2 E5:2 D5:2 C#5:2 B4:2 A4:2 B4:2 C#5:2 D5:1 F#5:1 A5:1 G5:1 F#5:1 D5:1 F#5:1 E5:1 D5:1 B4:1 D5:1 A5:1 G5:1 B5:1 A5:1 G5:1');
  const events = [];
  bass.forEach((b, i) => { events.push({ beat: i * 4, l: [b], dur: 3.5 }); events.push({ beat: i * 4 + 2, l: chords[i], dur: 1.8 }); });
  return { name: 'Canon', bpm: 76, events: merge(events, line(8, mel.slice(0, 8)), line(24, mel.slice(8))) };
}
function prelude() {         // broken chords, one pattern of eight notes per bar (after the shape of Bach's first prelude)
  const bars = [[48, 52, 55, 60, 64], [48, 50, 57, 62, 65], [47, 50, 55, 62, 65], [48, 52, 55, 60, 64], [48, 52, 57, 64, 69], [48, 50, 54, 57, 62], [47, 50, 55, 62, 67], [47, 48, 52, 55, 60]];
  const events = [];
  bars.forEach((c, i) => {
    events.push({ beat: i * 4, l: [c[0], c[1]], dur: 4 });
    for (let k = 0; k < 8; k++) events.push({ beat: i * 4 + k * 0.5, r: [c[2 + (k % 2 ? ((k >> 1) % 2) + 1 : 0) % 3] + 12], dur: 0.9 });
  });
  return { name: 'Broken Chord Prelude', bpm: 88, events: events.sort((a, b) => a.beat - b.beat) };
}
function ragtime() {         // a stride left hand (bass, chord, bass, chord) under a syncopated right hand, 4/4
  const prog = [['C', 48, [60, 64, 67]], ['C', 48, [60, 64, 67]], ['G', 43, [59, 62, 67]], ['C', 48, [60, 64, 67]], ['F', 41, [57, 60, 65]], ['C', 48, [60, 64, 67]], ['G', 43, [59, 62, 67]], ['C', 48, [60, 64, 67]]];
  const events = [];
  prog.forEach(([, bass, ch], i) => {
    events.push({ beat: i * 4, l: [bass], dur: 0.9 }); events.push({ beat: i * 4 + 1, l: ch, dur: 0.8 });
    events.push({ beat: i * 4 + 2, l: [bass + 7], dur: 0.9 }); events.push({ beat: i * 4 + 3, l: ch, dur: 0.8 });
  });
  const mel = tune('E5:0.5 G5:0.5 C6:1 B5:0.5 G5:0.5 E5:1 D5:0.5 F5:0.5 B5:1 G5:0.5 D5:0.5 B4:1 C5:0.5 E5:0.5 G5:1 A5:0.5 F5:0.5 C5:1 D5:0.5 F5:0.5 A5:1 G5:0.5 E5:0.5 C5:1 B4:0.5 D5:0.5 G5:1 E5:0.5 C5:0.5 G4:1 C5:1.5 E5:0.5 C5:2');
  return { name: 'Easy Ragtime', bpm: 104, events: merge(events, line(0, mel)) };
}
function lullaby() {         // after Brahms' lullaby, 3/4
  const m = tune('E5:1 E5:1 G5:2 E5:1 E5:1 G5:2 E5:1 G5:1 C6:1 B5:2 A5:1 A5:1 G5:2 D5:1 E5:1 F5:1 D5:2 D5:1 E5:1 F5:1 D5:2 D5:1 F5:1 B5:1 A5:2 G5:1 C6:3');
  return { name: 'Cradle Song', bpm: 72, events: merge(line(0, m), bass3(['C', 'C', 'C', 'G', 'G', 'G', 'C', 'F', 'C', 'G'], 3)) };
}
const dMajorScale = () => scaleSong('D Major Scale', 62, [0, 2, 4, 5, 7, 9, 11, 12]);
const eMinorScale = () => scaleSong('E Minor Scale', 52, [0, 2, 3, 5, 7, 8, 10, 12]);
const fMajorScale = () => scaleSong('F Major Scale', 53, [0, 2, 4, 5, 7, 9, 11, 12]);
const cBluesScale = () => scaleSong('C Blues Scale', 60, [0, 3, 5, 6, 7, 10, 12]);

// Someone with no lessons yet: one finger, random keys, long pauses.
export function plinkSong() {
  const events = [];
  let beat = 0;
  for (let i = 0; i < 9; i++) {
    beat += rand(0.9, 2.4);
    events.push({ beat, r: [60 + Math.floor(rand(0, 26))], dur: 1.2 });
  }
  return { name: 'Poking at the keys', bpm: 60, events, length: beat + 2, seconds: beat + 3 };
}

// `needs` is the skill (see skills.js) required to play it. The 'piano.advanced' ones wait for a future book.
const MAKERS = [
  { make: cMajorScale, needs: 'piano' }, { make: aMinorScale, needs: 'piano' }, { make: gMajorScale, needs: 'piano' },
  { make: odeToJoy, needs: 'piano' }, { make: twinkle, needs: 'piano' },
  { make: furElise, needs: 'piano.advanced' }, { make: blues, needs: 'piano.advanced' },
  { make: waltz, needs: 'piano.advanced' }, { make: improv, needs: 'piano.advanced' },
  // chapters learned by practice (skills.js CHAPTERS)
  { make: maryLamb, needs: 'piano.ch2' }, { make: rowBoat, needs: 'piano.ch2' }, { make: saints, needs: 'piano.ch2' },
  { make: dMajorScale, needs: 'piano.ch2' }, { make: eMinorScale, needs: 'piano.ch2' },
  { make: amazingGrace, needs: 'piano.ch3' }, { make: greensleeves, needs: 'piano.ch3' },
  { make: fMajorScale, needs: 'piano.ch3' }, { make: cBluesScale, needs: 'piano.ch3' },
  { make: minuetG, needs: 'piano.advanced.ch2' }, { make: canon, needs: 'piano.advanced.ch2' }, { make: prelude, needs: 'piano.advanced.ch2' },
  { make: ragtime, needs: 'piano.advanced.ch3' }, { make: lullaby, needs: 'piano.advanced.ch3' },
];
export const SONG_NEEDS = MAKERS.map((m) => m.needs);
export const allSongs = () => MAKERS.map((m) => ({ ...m.make(), needs: m.needs }));

export function randomSong(avoid, has = () => true) {
  const pool = MAKERS.filter((m) => has(m.needs));
  if (!pool.length) return null;
  let s;
  for (let i = 0; i < 12; i++) { s = pick(pool).make(); if (s.name !== avoid || pool.length === 1) break; }
  s.length = Math.max(...s.events.map((e) => e.beat + (e.dur || 1))) + 2; // beats
  s.seconds = (s.length * 60) / s.bpm;
  return s;
}

// ---- Endless A-minor jam for playing along with the stereo (4/4, bass = A A E A | C C G C) ----
const AMP = [69, 72, 74, 76, 79, 81, 84, 86]; // A minor pentatonic

export function makeJam(track = null) {
  const cfg = track && track.jam;         // { scale, bars: [{ bass, chord }] } for a track in a different key
  const SCALE = cfg ? cfg.scale : AMP;
  let motif = null;
  let deg = 3;
  const newMotif = () => {
    const slots = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].filter((s) => s === 0 || Math.random() < 0.55);
    return slots.map((pos) => {
      deg = Math.max(0, Math.min(SCALE.length - 1, deg + pick([-2, -1, -1, 0, 1, 1, 2])));
      return { pos, deg };
    });
  };
  // Returns events for one 4-beat bar (beats relative to the bar start).
  return function bar(i) {
    if (i % 2 === 0 || !motif) motif = newMotif();
    const ev = [];
    motif.forEach((m, n) => {
      let d = m.deg;
      if (i % 2 === 1 && n === motif.length - 1) d = Math.max(0, Math.min(SCALE.length - 1, d + pick([-1, 1, 2])));
      ev.push({ beat: m.pos, r: [SCALE[d]], dur: 0.9 });
    });
    if (cfg) {                       // one chord per bar, in the track's own progression
      const b = cfg.bars[((i % cfg.bars.length) + cfg.bars.length) % cfg.bars.length];
      ev.push({ beat: 0, l: b.bass, dur: 2 });
      ev.push({ beat: 0.5, l: b.chord, dur: 1 });
      ev.push({ beat: 2, l: b.bass, dur: 2 });
      ev.push({ beat: 2.5, l: b.chord, dur: 1 });
      return ev;
    }
    ev.push({ beat: 0, l: [45, 57], dur: 2 });
    ev.push({ beat: 0.5, l: [60, 64], dur: 1 });
    ev.push({ beat: 2, l: [48, 55], dur: 2 });
    ev.push({ beat: 2.5, l: [60, 64], dur: 1 });
    if (Math.random() < 0.6) ev.push({ beat: 3.5, l: [60, 64], dur: 0.8 });
    return ev;
  };
}
