// The lines GUY and GAL say again and again (answering a command, waiting, finishing up), each with several ways of saying it, and the
// picker that keeps them from saying the same thing twice running: line(key, vars) never repeats one of the last two lines it gave for that
// key (the last one, for a key with only two). The choice comes from a little generator of its own, not Math.random: the seeded test runs
// (pictures, sweeps) must draw exactly the numbers they drew before, so a line that used to be picked with Math.random (the short yeses, "did
// not catch that", a remark that existed before) still draws one number from it and throws it away, and a line that used to be fixed draws none.
// A test that checks what was said uses variants(key, vars): every way the line can come out.
// {label} is what he will do ("play the piano"), {Label} the same as he starts it ("Playing the piano"), {doing} what he is busy with
// ("cooking"), {thing} what he is talking about ("the guitar").
export const LINES = {
  // GUY, taking a command
  ok: ['Sure thing.', 'On it.', 'Okay!', 'You got it.', 'Coming right up.', 'Will do.', 'No problem.', 'Right away.', 'Good idea.', 'Alright!', 'Happy to.', 'Consider it done.'],
  // GAL, taking a command
  galOk: ['On it.', 'Right away.', 'Okay, I will.', 'Leave it to me.', 'Sure!', 'Got it.', 'No problem.', 'With pleasure.', "I'm on it.", 'Happy to help.'],
  // nothing in it was understood
  huh: ['Sorry, I did not catch that.', 'Hmm? Say that again?', "I didn't get that. One more time?", 'Sorry, what was that?', 'Could you say that a different way?', 'My ears must need dusting. Again?'],
  // GUY is busy and hands it to GAL
  handoff: ['GAL will get right on that.', 'GAL can take that one.', "I'll pass that to GAL.", "GAL's free. She'll do it.", 'GAL, this one is yours.'],
  // the user asked GAL by name
  handoffAsked: ['Okay, GAL will take care of it.', 'Okay, over to GAL.', 'Sure, GAL will handle it.', 'Alright, GAL has it.'],
  // GUY cannot (no skill, a locked door ...) and GAL can
  cantGal: ['I cannot do that yet. GAL will get right on that.', "I can't do that yet, but GAL can.", "I haven't learned that yet. GAL can do it.", "That one's beyond me for now. GAL will do it."],
  // the first words, by the time limit that applies (the design's "Lines by time limit")
  quick: ['One sec.', 'Just a moment.', 'Hang on a sec.', 'Give me a second.', 'Be right with you.'],
  quickBook: ['One sec, putting the book back.', 'Just putting this book back first.', 'Let me put the book away first.'],
  stepPaint: ["Finishing this stroke first, then I'll {label}.", "Just this last stroke, then I'll {label}.", "Let me finish this brushstroke, then I'll {label}."],
  stepMow: ["Let me finish this row, then I'll {label}.", "Just this row, then I'll {label}.", "One more row, then I'll {label}."],
  stepBuild: ["Let me finish this piece, then I'll {label}.", "Almost done with this piece, then I'll {label}.", "Just this last bit, then I'll {label}."],
  stepBed: ["Let me finish the bed, then I'll {label}.", "Just tucking the corners in, then I'll {label}.", "The bed's nearly made, then I'll {label}."],
  step: ["Let me finish this first, then I'll {label}.", "Almost done here, then I'll {label}.", "Let me wrap this up, then I'll {label}.", "Nearly finished, then I'll {label}."],
  // what he was busy with is over, or he was told to stop it
  done: ['Done {doing}. {Label} now.', 'All done {doing}. {Label} now.', 'Finished {doing}. {Label} now.'],
  stop: ["Okay, I'll stop {doing}. {Label} now.", "Alright, I'll stop {doing}. {Label} now.", "Sure, I'll stop {doing}. {Label} now."],
  // a work step or a chain step cut short
  enough: ["That'll do for now.", 'Good enough for now.', "I'll leave it there for now.", 'That will have to do.'],
  // answers to a "no"
  neverMind: ['Okay, never mind.', 'No problem, never mind.', 'Alright, forget it.', 'Okay, maybe later.'],
  leaveIt: ["Okay, I'll leave it.", "Alright, I'll leave it.", "Sure, I'll leave it there."],
  later: ["I'll leave {thing} for later.", "I'll come back to {thing} later.", "Let's do {thing} another time."],
  sayAgain: ['Okay, say it again.', 'Okay, try me again.', 'Sure, say it once more.'],
  okay: ['Okay.', 'Alright.', 'Sure.', 'No problem.'],
  // GUY and GAL, between themselves: a jam ({mine} is GUY's instrument, {theirs} GAL's)
  jamAsk: ["Hey GAL, want to jam? I'll take the {mine}.", "GAL, fancy a jam? I've got the {mine}.", "Let's play something, GAL. I'm on the {mine}."],
  jamRead: ['Sure! Let me read up on the {theirs} first.', 'Love to. I just need to learn the {theirs} first.', 'Give me a minute to study the {theirs}.'],
  jamYes: ["Sounds good! I'll find you.", "I'm in! I'll come and find you.", "Yes! Be right there."],
  jamJoin: ['Joining in on the {theirs}!', 'Here comes the {theirs}!', 'Mind if I add some {theirs}?'],
};

const recent = {};
// the keys whose line used to be picked with Math.random (one draw each, kept so the seeded runs keep their numbers)
const DREW = new Set(['ok', 'galOk', 'huh']);
let seed = 0x9e3779b9;
const next = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
// every way line(key, vars) can come out
export const variants = (key, vars = {}) => (LINES[key] || []).map((t) => fill(t, vars));
// a fresh pick from `list` for `key`: not one of the last ones given for that key. `drew`: it used to be a Math.random pick (draw one, as then)
export function fresh(key, list, drew = false) {
  if (drew) Math.random();
  if (!list || !list.length) return null;
  const avoid = (recent[key] || []).slice(-Math.min(2, list.length - 1));
  const ok = list.filter((t) => !avoid.includes(t)), from = ok.length ? ok : list;
  const t = from[Math.floor(next() * from.length)];
  recent[key] = [...(recent[key] || []), t].slice(-2);
  return t;
}
// `opts.drew` overrides whether it draws from Math.random (GAL's "did not catch that" was always the same line: it draws none)
export const line = (key, vars = {}, opts = {}) => fill(fresh(key, LINES[key], opts.drew ?? DREW.has(key)) || '', vars);
export const resetLines = () => { for (const k of Object.keys(recent)) delete recent[k]; seed = 0x9e3779b9; };
