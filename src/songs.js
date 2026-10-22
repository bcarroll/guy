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
];

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
