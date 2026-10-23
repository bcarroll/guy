// Guy's guitar riffs: he makes them up from a scale, judges them, and remembers the good ones between visits.
//
// A riff is two bars of eighth notes: 16 steps, each a MIDI note or 0 (a rest), in a key (`root`, `mode`). It is played as single
// plucked notes over a bass note on each bar (see computeGuitar in brain.js). `invent()` makes a riff the way a player noodles:
// a short phrase that wanders up and down the pentatonic scale, then an answer that repeats it or goes somewhere new, and ends
// near home. `judge()` scores it from what makes a riff stick: a singable range, mostly steps with a few leaps, a phrase that
// repeats, a tune that is neither empty nor frantic, and landing on the key note. The good ones are kept (the best 8).
const KEY = 'guy.riffs.v1';
export const STEPS = 16;
export const GOOD = 0.72;                        // a riff scoring this or more is worth keeping
const KEEP = 8;

const PENTA = { minor: [0, 3, 5, 7, 10], major: [0, 2, 4, 7, 9] };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Scale degree (any integer, 0 = root) -> MIDI note
const degree = (root, mode, d) => { const sc = PENTA[mode]; return root + 12 * Math.floor(d / 5) + sc[((d % 5) + 5) % 5]; };

// A phrase of `len` steps wandering from degree `start`: mostly steps, now and then a leap, with rests.
function phrase(root, mode, start, len, messy) {
  const out = [];
  let d = start;
  for (let i = 0; i < len; i++) {
    if (i > 0 && Math.random() < (messy ? 0.35 : 0.22)) { out.push(0); continue; }
    out.push(degree(root, mode, d));
    const r = Math.random();
    d += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.8 ? 0 : r < 0.9 ? 2 : -2;
    if (messy && Math.random() < 0.25) d += pick([-4, 4, 5, -5]);   // a wild jump
    d = Math.max(-3, Math.min(8, d));
  }
  return out;
}

// Make up a riff. `messy` ideas are looser (more rests and jumps): some of them are not worth keeping.
export function invent(messy = Math.random() < 0.4) {
  const mode = Math.random() < 0.6 ? 'minor' : 'major';
  const root = pick([45, 47, 48, 50, 52]);          // A, B, C, D, E (the guitar's low register)
  const half = STEPS / 2;
  const a = phrase(root, mode, pick([0, 2, 3]), half, messy);
  const again = Math.random() < (messy ? 0.3 : 0.65);
  let b;
  if (again) b = a.map((m, i) => (i === half - 1 ? degree(root, mode, 5) : m));     // the same phrase, closing a step higher
  else b = phrase(root, mode, pick([0, 2, 3]), half, messy);
  if (!messy) b[half - 1] = degree(root, mode, 0) + 12;                              // come home on the key note
  return { root, mode, steps: [...a, ...b], made: Date.now() };
}

// 0..1: how good the riff is. Pure function of the riff.
export function judge(r) {
  const notes = r.steps.filter((m) => m > 0);
  if (notes.length < 4) return 0;
  const lo = Math.min(...notes), hi = Math.max(...notes);
  const range = hi - lo <= 12 ? 1 : Math.max(0, 1 - (hi - lo - 12) / 12);
  let leaps = 0, moves = 0;
  for (let i = 1; i < notes.length; i++) { moves++; if (Math.abs(notes[i] - notes[i - 1]) > 5) leaps++; }
  const smooth = moves ? 1 - Math.min(1, (leaps / moves) / 0.3) * 0.8 : 0;            // up to 30% leaps is fine
  const h = STEPS / 2, a = r.steps.slice(0, h), b = r.steps.slice(h);
  let same = 0, both = 0;
  for (let i = 0; i < h; i++) { if (a[i] || b[i]) both++; if (a[i] === b[i]) same++; }
  const repeat = both ? Math.min(1, same / both / 0.6) : 0;                           // a phrase that comes back
  const density = notes.length >= 6 && notes.length <= 13 ? 1 : notes.length < 6 ? notes.length / 6 : Math.max(0, 1 - (notes.length - 13) / 3);
  const last = notes[notes.length - 1];
  const home = (last - r.root) % 12 === 0 ? 1 : (last - r.root) % 12 === 7 ? 0.6 : 0.2;
  const start = r.steps[0] ? 1 : 0.5;
  return +(0.22 * range + 0.2 * smooth + 0.22 * repeat + 0.16 * density + 0.14 * home + 0.06 * start).toFixed(3);
}

// Where the kept riffs live. `config.persist` false (the ?fresh test page) keeps them in memory only, so QA never writes to
// the real save; a custom `key` (the QA harness) always uses storage.
export const config = { persist: true };
let memory = [];
export const forgetMemoryRiffs = () => { memory = []; };       // QA: start a test from an empty in-memory book
const useStorage = (key) => key !== KEY || config.persist;

const valid = (r) => r && typeof r === 'object' && Number.isFinite(r.root) && (r.mode === 'minor' || r.mode === 'major')
  && Array.isArray(r.steps) && r.steps.length === STEPS && r.steps.every((m) => Number.isFinite(m) && m >= 0 && m < 128);

// The riffs he has kept: { riff, score }[], best first. Anything unreadable is ignored.
export function loadRiffs(key = KEY) {
  if (!useStorage(key)) return memory.slice();
  try {
    const list = JSON.parse(localStorage.getItem(key));
    return (Array.isArray(list) ? list : []).filter((e) => e && valid(e.riff) && Number.isFinite(e.score)).sort((x, y) => y.score - x.score).slice(0, KEEP);
  } catch { return []; }
}

// Keep a riff if it is good and new (and better than his worst favourite once he has 8). Returns the new list, or null if it was not kept.
export function keepRiff(riff, key = KEY) {
  const score = judge(riff);
  if (score < GOOD || !valid(riff)) return null;
  const list = loadRiffs(key);
  if (list.some((e) => e.riff.root === riff.root && e.riff.steps.join() === riff.steps.join())) return null;
  if (list.length >= KEEP && list[list.length - 1].score >= score) return null;
  const next = [...list, { riff, score }].sort((x, y) => y.score - x.score).slice(0, KEEP);
  if (!useStorage(key)) memory = next;
  else { try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* no storage: he forgets it next visit */ } }
  return next;
}

// What to play for a session: a new idea (the best of a few tries, so most are worth keeping) or one of his favourites.
// `favourite` is true when he is replaying a kept riff.
export function nextRiff(key = KEY) {
  const kept = loadRiffs(key);
  if (kept.length && Math.random() < 0.4) return { riff: pick(kept).riff, favourite: true, score: null };
  let best = null;
  for (let i = 0; i < 3; i++) { const r = invent(); const s = judge(r); if (!best || s > best.score) best = { riff: r, score: s }; }
  return { riff: best.riff, favourite: false, score: best.score };
}

// The note to pluck (and a bass note) on step `n` of a session: `list` of riffs, each played twice through before the next.
export function riffAt(list, n) {
  const r = list[Math.floor(n / (STEPS * 2)) % list.length], i = n % STEPS;
  return { note: r.steps[i] || 0, bass: i === 0 || i === STEPS / 2 ? r.root - 12 + (i === 0 ? 0 : 7) : 0, root: r.root };
}
