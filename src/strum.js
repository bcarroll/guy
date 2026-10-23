// Guy's guitar songs when he just strums (as opposed to making up riffs, riffs.js). He used to play the same four chords (Am F C G) in the
// same pattern for 26 seconds every time. Now each time he makes up a song: a key, a chord progression, a strumming or picking pattern,
// a tempo and how long each chord lasts. Chords are built from shapes (major, minor, seventh ...), so every progression works in every key.
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHAPES = {                                   // semitones above the chord's root, spread over two octaves like open guitar chords
  maj: { notes: [0, 7, 12, 16, 19], tag: '' }, min: { notes: [0, 7, 12, 15, 19], tag: 'm' },
  dom7: { notes: [0, 7, 10, 16, 19], tag: '7' }, min7: { notes: [0, 7, 10, 15, 19], tag: 'm7' },
  maj7: { notes: [0, 7, 11, 16, 19], tag: 'maj7' }, sus4: { notes: [0, 7, 12, 17, 19], tag: 'sus4' },
};
// [semitones above the key note, chord shape]
const PROGRESSIONS = [
  { name: 'a bright pop tune', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
  { name: 'a wistful tune', chords: [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']] },
  { name: 'an old-time tune', chords: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] },
  { name: 'a folk song', chords: [[0, 'maj'], [5, 'maj'], [0, 'maj'], [7, 'maj']] },
  { name: 'a bit of blues', chords: [[0, 'dom7'], [5, 'dom7'], [0, 'dom7'], [7, 'dom7']] },
  { name: 'a jazzy tune', chords: [[2, 'min7'], [7, 'dom7'], [0, 'maj7'], [9, 'min7']] },
  { name: 'a rock tune', chords: [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']] },
  { name: 'a moody tune', chords: [[9, 'min'], [7, 'maj'], [5, 'maj'], [4, 'maj']] },
  { name: 'a dreamy tune', chords: [[0, 'sus4'], [0, 'maj'], [5, 'sus4'], [5, 'maj']] },
  { name: 'a sunny tune', chords: [[0, 'maj'], [5, 'maj'], [9, 'min'], [7, 'maj']] },
];
// eight steps to the bar: D down-strum, U up-strum, . rest, B the bass note alone, 0-4 one string of the chord (picking)
const PATTERNS = ['D.DU.UDU', 'DDUUDUDU', 'D.D.D.DU', 'D.DUDUDU', 'B.DUB.DU', 'DUDUDUDU', 'D...D.DU', '0.1.2.1.', 'B.123.21', 'D.UU.UD.'];
const KEYS = [43, 45, 48, 50, 52];                     // G, A, C, D, E

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

export function chordFor(tonic, semis, shape) {
  let root = tonic + semis;
  while (root < 40) root += 12;
  while (root > 52) root -= 12;
  return { notes: SHAPES[shape].notes.map((o) => root + o), fret: Math.max(-0.01, Math.min(0.1, (root - 40) / 12 * 0.1)), name: NAMES[root % 12] + SHAPES[shape].tag };
}

// A new song: { name, chords, pat, step (seconds per eighth note), bars (per chord), secs (how long to play it), key }
export function makeStrum() {
  const prog = pick(PROGRESSIONS), tonic = pick(KEYS);
  const chords = prog.chords.map(([semis, shape]) => chordFor(tonic, semis, shape));
  return { name: prog.name, key: NAMES[tonic % 12], chords, pat: pick(PATTERNS), step: +rand(0.24, 0.36).toFixed(3), bars: Math.random() < 0.25 ? 2 : 1, secs: Math.round(rand(24, 36)) };
}
export const strumPattern = () => pick(PATTERNS);
export { PATTERNS, PROGRESSIONS };
