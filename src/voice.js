// Voice and typed commands. The user talks only to GUY; if GUY is busy (or is asked to) he hands the request to GAL, who then answers
// the user herself and takes the user's orders until what she was asked to do is finished (an audience, see Gal.audience).
// The parser is rules only (no network): normalise the sentence, match it against a small table, run it through the same entry
// points the menus use (interact, requestRead, visitRoom, lockOn), and speak the answer. English only.
// run(text) returns { ok, intent, lines: [{ who, text }] }; every line is also sent to the speaker (tts.js).
// What happens to a command once a robot has it (wrapping up within a time limit, waiting behind a busy job, the start watchdog) is
// commands.js; the microphone that feeds run() / runAlternatives() is mic.js.
// One sentence can hold up to three steps ("turn on the stereo and then dance"): splitSteps() cuts it into pieces, each parsed on its
// own, and one robot does them in order (a chain, commands.js). A sentence with one piece takes exactly the single-command path.
import { barkFor, barkReady, barkSpoke } from './barks.js';
import { createCommands, classOf, busyJob, labelOf, firstWords, chainLabel, MAX_STEPS, yesNo as yesNoText } from './commands.js';
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const OK = ['Sure thing.', 'On it.', 'Okay!', 'You got it.'];
export const GAL_OK = ['On it.', 'Right away.', 'Okay, I will.'];
const norm = (t) => ' ' + String(t || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

// what a sentence can mean: [regex, intent]; first match wins. 'object' goes through interact(name), 'act' is an activity name.
const OBJECTS = [
  // the Backyard first: its words ("lawn chair", "basketball", "soccer ball") would otherwise be taken for the chair or the ball in his room
  [/ lawn ?chair /, 'lawnchair'], [/ (mow|mows|mowing|mowed|mower|lawn ?mower|lawn|grass|shed) /, 'mower'],
  [/ (basketball|hoops?|dunk) /, 'basketballhoop'], [/ (soccer|football|goal|penalty|penalties) /, 'soccergoal'],
  [/ (bird ?baths?|birds?) /, 'birdbath'],
  [/ (blasters?|shooting|shoot|shoot ?out|target practice|firing range|range) /, 'blasterrack'],
  // the Restaurant: the counter before the stove ("kitchen counter" is not "kitchen"), and the dining table before the stereo's table
  [/ (kitchen counter|counter|serve|serving|deliver) /, 'kitchencounter'], [/ (stove|cook|cooks|cooking|kitchen) /, 'stove'],
  [/ (register|till|cashier|checkout|payments?|take the money) /, 'register'], [/ (dining table|dining tables|take orders?|take the orders?|waiter|waiting tables|customers?|diners?) /, 'diningtable'],
  [/ (piano|keys|keyboard) /, 'piano'], [/ (guitar|strum) /, 'guitar'], [/ (drums?|drum kit|sticks) /, 'drums'],
  [/ (lamp|lights?) /, 'lamp'], [/ (stereo|music|tunes|radio|record player) /, 'table'], [/ (ball|dribble|toss) /, 'ball'],
  [/ (paint|painting|easel|draw|sketch|scribble) /, 'easel'], [/ (telescope|stars?|stargaze|sky) /, 'telescope'],
  [/ (sky switch|night|nighttime|daytime|sunrise|sunset|sunshine|moon|sun) /, 'skyswitch'],           // (after the telescope: "look at the night sky" is still the stars)
  [/ (workbench|work bench|tinker|build) /, 'workbench'], [/ (toolbox|tool box|tools?) /, 'toolbox'],
  [/ (plants?|tree|flowers?|water) /, 'plant'], [/ (chair|armchair|couch) /, 'sit'], [/ (workstation|work station|terminal|computer) /, 'workstation'],
];
const ACTS = [[/ (dance|boogie|groove) /, 'dance'], [/ (sit|rest|relax) /, 'sit'], [/ (look around|ponder|think) /, 'ponder'], [/ (wave|hello|hi|hey) /, 'wave'], [/ (wander|walk around|stroll) /, 'wander']];

export function parse(text, ctx = {}) {
  let t = norm(text);
  if (t.trim() === '') return { type: 'empty' };
  t = t.replace(/^ (hey |ok |okay |hi )?(guy|gal) /, ' ').replace(/ (please|now|for me|thanks|thank you) /g, ' ').replace(/^ (can|could|would|will) you /, ' ').replace(/^ (lets|let us) /, ' you ').replace(/^ (i want you to|i would like you to|i d like you to|go ahead and) /, ' ');
  t = ' ' + t.trim() + ' ';
  // GAL: "tell GAL to ...", "ask gal to ...", "have gal ...", "gal, ..."
  let m = t.match(/ (?:tell|ask|have|get|let|make) gal (?:to )?(.+)/) || (/^ gal /.test(norm(text)) ? [0, norm(text).replace(/^ gal /, ' ')] : null);
  if (m) { const inner = parse(m[1], ctx); return inner.type === 'unknown' || inner.type === 'empty' ? inner : { type: 'gal', inner }; }
  // the screen lock
  if (/ screen /.test(t) && / (unlock|unfreeze|release) /.test(t)) return { type: 'screen', mode: 'off' };
  if (/ screen /.test(t) && / camera /.test(t)) return { type: 'screen', mode: 'camera' };
  if (/ screen /.test(t) && / (lock|freeze) /.test(t)) return { type: 'screen', mode: 'on' };
  // doors and rooms
  const rooms = ctx.rooms || [];
  const roomIn = () => rooms.find((r) => t.includes(' ' + r.name.toLowerCase() + ' ')) || null;
  if (/ (unlock|lock) /.test(t) && / door /.test(t) || (/ (unlock|lock) /.test(t) && roomIn())) {
    const r = roomIn() || (rooms.length === 1 ? rooms[0] : null);
    return { type: 'doorlock', room: r && r.id, lock: !/ unlock /.test(t), ask: !r };
  }
  if (/ (go|walk|head|step|get) (in|into|inside|to|over to) /.test(t) || / (visit|enter|check out) /.test(t)) { const r = roomIn(); if (r) return { type: 'visit', room: r.id }; if (/ door /.test(t) && rooms.length === 1) return { type: 'visit', room: rooms[0].id }; }
  if (/ (come back|go back|leave|get out|come out|exit|return) /.test(t)) return { type: 'comeback' };
  // music off, stopping, something else
  if (/ (stop|turn off|switch off|shut off|kill) (the )?(music|stereo|radio|tunes) /.test(t)) return { type: 'object', name: 'table', off: true };
  if (/ (keep|keep on|continue|dont stop|do not stop) /.test(t)) { for (const [re, name] of OBJECTS) if (re.test(t)) return { type: 'object', name, lock: true }; return { type: 'unknown' }; }
  if (/ (stop|enough|never ?mind|something else|do something else|surprise me|next|im bored|bored|do anything|whatever you like|free) /.test(t)) return { type: 'next' };
  if (/ (its|it s|is) (too )?dark | cant see /.test(t)) return { type: 'object', name: 'lamp' };
  // jamming and reading
  if (/ (jam|play together|play along|band) /.test(t)) return { type: 'jam' };
  // the Learning Workstation: "learn everything", "use the workstation to learn piano", "download the stargazing book"
  if (/ (learn|know|download|study|absorb) (everything|all|every skill|all skills|all the skills|all of the skills|all the books|every book) /.test(t) || / (everything|all skills|all the skills) /.test(t) && / (learn|know|download) /.test(t)) return { type: 'learn', query: null };
  if (/ (workstation|work station|terminal|computer|download|instantly|immediately|at once) /.test(t) && / (learn|know|download|study|teach|skill) /.test(t)) {
    const stop = new Set('use using the a an to at on with workstation work station terminal computer download instantly immediately once learn know study teach skill skills book about how and then go over her him it please now'.split(' '));
    const q = t.trim().split(' ').filter((w) => w && !stop.has(w)).join(' ');
    return q ? { type: 'learn', query: q } : { type: 'object', name: 'workstation' };
  }
  if (/ read /.test(t) || / (study|learn) /.test(t)) {
    const q = t.replace(/ (read|study|learn|the|a|an|book|called|named|about|me|some|something|from|shelf) /g, ' ').replace(/ (read|study|learn|the|a|an|book|about|from|shelf) /g, ' ').trim();
    return { type: 'read', query: q };
  }
  for (const [re, name] of OBJECTS) if (re.test(t)) return { type: 'object', name, off: / (turn off|switch off|off) /.test(t) };
  for (const [re, act] of ACTS) if (re.test(t)) return { type: 'act', act };
  if (/ (play|do|try) (something|anything) /.test(t)) return { type: 'next' };
  return { type: 'unknown' };
}

// ---- one sentence, several steps. Speech arrives without commas, so nothing here relies on punctuation.
const SEQ = / (?:and then|and after that|after that|and afterwards|afterwards|when youre done|when you re done|then) /;
const DET = new Set(['the', 'a', 'an', 'some', 'my', 'your', 'that', 'this']);
const known = (p) => p && !['unknown', 'empty'].includes(p.type);
// a name at the start of a piece: { addr: 'guy' | 'gal' | null, rest }
function nameOf(t) {
  const m = t.match(/^ (?:(?:hey|ok|okay|hi) )?(?:(?:tell|ask|have|get|let|make) )?(guy|gal) (?:to )?(.*)$/);
  return m ? { addr: m[1], rest: ' ' + m[2].trim() + ' ' } : { addr: null, rest: t };
}
// a piece with no verb of its own ("the stereo" in "turn off the lamp and the stereo") borrows the previous piece's verb
function withVerb(piece, prev) {
  const w = piece.trim().split(' ');
  if (!prev || !DET.has(w[0])) return piece;
  const pw = prev.trim().split(' '), k = pw.findIndex((x) => DET.has(x));
  return k > 0 ? ' ' + pw.slice(0, k).join(' ') + ' ' + piece.trim() + ' ' : piece;
}
// Cut a sentence into its steps: [{ text, addr, it }] (it: the piece parsed on its own), plus `over` when more than three were asked for.
// Sequence words always cut; a plain "and" cuts only when every piece makes sense by itself ("rock and roll" stays whole).
export function splitSteps(text, ctx = {}) {
  let t = norm(text).replace(/^ first /, ' ');
  const seq = t.split(SEQ).map((x) => ' ' + x.trim() + ' ').filter((x) => x.trim());
  const pieces = [];
  for (const part of seq) {
    const ands = part.split(/ and /).map((x) => ' ' + x.trim() + ' ').filter((x) => x.trim());
    if (ands.length > 1) {
      const lead = nameOf(ands[0]);
      let prev = lead.rest;
      const tried = ands.map((a, i) => { if (i === 0) return a; const nm = nameOf(a); const v = nm.addr ? a : withVerb(a, prev); prev = nm.addr ? nm.rest : v; return v; });
      if (tried.every((a) => { const nm = nameOf(a); return known(parse(nm.rest, ctx)); })) { pieces.push(...tried); continue; }
    }
    pieces.push(part);
  }
  let addr = null;
  const out = [];
  for (const p of pieces) {
    const nm = nameOf(p);
    if (nm.addr) addr = nm.addr;
    const it = parse(nm.rest, ctx);
    if (it.type === 'next' && pieces.length > 1) continue;            // "stop" or "something else" inside a chain: the next step stops him anyway
    out.push({ text: nm.rest, addr, it });
  }
  for (let i = 0; i < out.length - 1; i++) if (out[i].it.lock) out[i].it = { ...out[i].it, lock: false };      // "keep playing": only as the last step
  const over = out.length > MAX_STEPS;
  return { pieces: out.slice(0, MAX_STEPS), over };
}

// GUY is too busy to do something new: working, serving, painting, locked in on something, shut in, or away from the room
const BUSY = ['build', 'tidytools', 'takeorder', 'cook', 'serve', 'takepay', 'rwait', 'paint', 'portrait', 'mixpaint', 'putcanvas', 'hangpaint', 'buildbot', 'orderbuild', 'bandplay', 'bandjam'];
// `here`: the thing he was asked to use is in the room he is standing in, so being away from his own room does not count as busy
export const guyBusy = (b, here = false) => !!(b.lock || b.stuckIn() || (!here && !b.inMain()) || (b.restStays && b.restStays()) || (b.step || b.queue.length) && BUSY.includes(b.last));

export function createVoice({ world, brain, say = () => {}, speaking = null, screen = null, toast = () => {} }) {
  const gal = () => world.gal;
  const galOk = () => { const g = gal(); return !!(g && g.exists && g.exists() && !g.emerge && g.brain); };
  const roomList = () => Object.entries(world.doors || {}).map(([id, d]) => ({ id, name: d.name }));
  const lines = [];
  const speak = (who, text, kind = 'reply') => { lines.push({ who, text }); say(who, text, kind); };
  const fix = (m, who) => String(m || '').replace(/\bGuy\b/g, who === 'gal' ? 'GAL' : 'I').replace(/^I is /, 'I am ').replace(/^I will /, 'I will ').replace(/I's /g, 'my ');

  // GAL's audience with the user: starts when GUY hands her a request, ends when what she was asked to do is over (or never, while locked in)
  function audienceOn() {
    const g = gal(), a = g && g.audience;
    if (!a) return false;
    const b = g.brain, alive = !!b.lock || b.pendingActivity === a.act || b.last === a.act || !!commands.chainFor(b) || a.fresh-- > 0;
    if (!alive) g.audience = null;
    return alive;
  }
  function startAudience() { const g = gal(); g.audience = { act: g.brain.pendingActivity || g.brain.last, fresh: 30 }; }

  // do an intent on a brain; returns { ok, message }
  function doIt(b, it) {
    switch (it.type) {
      case 'object': {
        if (it.off && it.name !== 'table') return { ok: false, message: 'Switch it off? Just ask for something else.' };
        if (it.name === 'table' && it.off && !b.music) return { ok: false, message: 'The music is not on.' };
        if (it.name === 'table' && !it.off && b.music) return { ok: false, message: 'The music is already on.' };
        if (it.name === 'sit') { const c = b.chairs && b.chairs()[0]; return c ? b.interact(c.name) : { ok: false, message: 'There is nothing to sit on.' }; }
        if (it.lock) return b.lockOn(it.name);
        return b.interact(it.name);
      }
      case 'act': {
        if (!b.available(it.act)) return { ok: false, message: b.whyNot && b.whyNot(it.act) === 'the other robot is using it' ? 'The other robot is using that right now.' : 'I cannot do that right now.' };
        b.unlock(false); b.skip(true); b.pendingActivity = it.act; return { ok: true };
      }
      case 'read': {
        const sh = b.obj('shelf'); if (!sh) return { ok: false, message: 'There is no bookshelf.' };
        if (it.book) return b.requestRead(it.book);                    // (the book he offered to read first)
        const q = (it.query || '').trim(), words = q.split(' ').filter((w) => w.length > 2);
        const books = sh.books.filter((x) => x.mesh.visible);
        const hit = words.length ? books.find((x) => words.every((w) => (x.def.title + ' ' + x.def.teaches + ' ' + x.def.id).toLowerCase().includes(w))) || books.find((x) => words.some((w) => (x.def.title + ' ' + x.def.id).toLowerCase().includes(w))) : null;
        if (hit) return b.requestRead(hit.def.id);
        if (q && words.length) return { ok: false, message: `I cannot find a book about ${q}.` };
        return b.interact('shelf');
      }
      case 'learn': return b.learnOrder(it.query);
      case 'visit': return b.visitRoom(it.room);
      case 'comeback': { if (b.inMain()) return { ok: false, message: 'I am already here.' }; const p = b.g.root.position, r = world.roomIdAt(p.x, p.z); return b.visitRoom(r); }
      case 'next': b.unlock(false); b.skip(); return { ok: true };
      default: return { ok: false, message: 'I did not catch that.' };
    }
  }

  // a step no robot does: the screen lock, a door (in a chain, when its turn comes)
  function instant(it) {
    if (it.type === 'screen') { if (!screen) return { ok: false, message: 'I cannot lock the screen here.' }; screen.setMode(it.mode, { quiet: true }); return { ok: true }; }
    if (it.type === 'doorlock') { if (it.ask || !it.room) return { ok: false, message: 'I did not know which door.' }; world.rooms.setDoorLocked(it.room, it.lock); return { ok: true }; }
    return { ok: false, message: 'I did not catch that.' };
  }
  const onStep = (b) => { const g = gal(); if (g && b === g.brain && g.audience) { g.audience.act = b.pendingActivity || b.last; g.audience.fresh = 30; } };
  const onQuestion = (q) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('guy-question', { detail: q })); };
  const commands = createCommands({ speak: (who, t) => speak(who, t), perform: (b, it, cls) => act(b, it, cls || 'quick'), fix, whoOf: (b) => (b === brain ? 'guy' : 'gal'), instant, onStep, onQuestion });
  brain.commands = commands;
  world.commands = commands;           // (GAL's brain asks it for a chain's next step too: brain.update)
  const rooms = () => Object.fromEntries(roomList().map((r) => [r.id, r.name]));
  // "never mind the dancing": what to drop. "the dancing" is read as "dance", "the playing the piano" as "play the piano"
  const ING = { dancing: 'dance', waving: 'wave', singing: 'sing', reading: 'read', sitting: 'sit down', thinking: 'have a think', cooking: 'cook', mowing: 'mow the lawn', painting: 'paint', napping: 'nap', sleeping: 'sleep', stretching: 'stretch' };
  const neverMind = (t) => {
    const n = norm(t);
    if (!/ never ?mind /.test(n)) return null;
    const rest = n.replace(/^.* never ?mind (about )?/, ' ');
    let r = parse(rest, { rooms: roomList() });
    if (r.type === 'unknown' || r.type === 'empty') {
      const g = rest.replace(/^ (the )?/, ' ').replace(/ (\w+ing) /, (m, w) => ` ${ING[w] || (w === 'playing' ? 'play' : w)} `);
      r = parse(g, { rooms: roomList() });
    }
    return r;
  };
  const isCmd = (t) => {                // a command, not an answer ("never mind the guitar" drops the guitar; a plain "never mind" is a no)
    let p = parse(t, { rooms: roomList() });
    if (p.type === 'gal') p = p.inner;
    if (p.type === 'next') { const r = neverMind(t); return !!r && known(r) && r.type !== 'next'; }
    return known(p) || splitSteps(t, { rooms: roomList() }).pieces.length > 1;
  };

  function run(text) {
    lines.length = 0;
    // an open yes/no question ("Still cooking. Should I stop and mow?"): a short yes or no answers it; a new command closes it
    if (commands.question) {
      const cmd = isCmd(text);
      if (!cmd && commands.answer(text)) return { ok: true, intent: { type: 'answer' }, lines: lines.slice() };
      if (cmd) commands.dismiss();
    }
    const sp = splitSteps(text, { rooms: roomList() });
    if (sp.pieces.length > 1) return runSteps(sp);
    return runOne(text);
  }
  const res = (ok, it) => ({ ok, intent: it, lines: lines.slice() });

  // ---- several steps in one sentence
  function runSteps(sp) {
    const ps = sp.pieces, good = ps.filter((p) => known(p.it)), it = { type: 'chain', steps: ps.map((p) => p.it) };
    if (!good.length) { speak('guy', pick(['Sorry, I did not catch that.', 'Hmm? Say that again?'])); return res(false, it); }
    const who0 = ps[0].addr === 'gal' || (!ps[0].addr && audienceOn()) ? (galOk() ? 'gal' : 'guy') : 'guy';
    if (good.length < ps.length) {                                   // part of it not understood: ask about the rest
      const k = ps.findIndex((p) => !known(p.it));
      const where = k === 0 ? 'the first part' : `the part after ${labelOf(ps[k - 1].it, rooms())[2]}`;
      commands.ask(who0, `I didn't catch ${where}. Should I just ${chainLabel(good.map((p) => labelOf(p.it, rooms())))}?`, {
        yes: () => { runGroups(good); },
        no: () => speak(who0, 'Okay, say it again.'),
      });
      return res(false, it);
    }
    if (sp.over) speak(who0, "That's a lot. I'll do the first three.");
    return res(runGroups(ps), it);
  }
  // the pieces by who they are for: a name addresses its piece and every later one ("GAL water the plants and GUY play the piano": both start)
  function runGroups(ps) {
    const groups = [];
    for (const p of ps) { const g = groups[groups.length - 1]; if (g && g.addr === p.addr) g.ps.push(p); else groups.push({ addr: p.addr, ps: [p] }); }
    if (groups.length > 1 && groups.some((g) => !g.addr)) { groups[1].ps.unshift(...groups[0].ps); groups.shift(); }      // (the steps before the first name go with it)
    let ok = false;
    for (const g of groups) ok = runChain(g.ps.map((p) => ({ it: p.it, label: labelOf(p.it, rooms()) })), g.addr) || ok;
    return ok;
  }
  // a chain for one robot: who does it is decided once, for its first step, by the rule single commands follow; then every step is
  // checked up front (a step that cannot be done at all is said before anything moves)
  function runChain(steps, addr) {
    const prefix = addr ? addr + ' ' : '';
    if (steps.length === 1) return runParsed(addr === 'gal' ? { type: 'gal', inner: steps[0].it } : steps[0].it, prefix + 'x').ok;
    const robotSteps = steps.filter((s) => s.it.type !== 'screen' && s.it.type !== 'doorlock');
    if (!robotSteps.length) { let ok = true; for (const s of steps) { const r = instant(s.it); if (!r.ok) { speak('guy', fix(r.message, 'guy')); ok = false; break; } } if (ok) speak('guy', pick(OK)); return ok; }
    const first = robotSteps[0].it;
    const explicit = addr === 'gal', named = addr === 'guy', aud = !explicit && !named && audienceOn();
    const here = first.type === 'object' && first.name !== 'sit' && !!brain.obj(first.name) && world.roomIdAt(brain.obj(first.name).x, brain.obj(first.name).z) === world.roomIdAt(brain.g.root.position.x, brain.g.root.position.z);
    const guyFree = !guyBusy(brain, here), galFree = galOk() && !busyJob(gal().brain);
    let b = brain, viaGal = false;
    if (aud || explicit || (!guyFree && !named && galFree)) {
      if (!galOk()) { speak('guy', explicit ? 'GAL is not here.' : 'I am busy, and GAL is not here.'); return false; }
      b = gal().brain; viaGal = true;
    }
    let bad = steps.map((s) => dryCheck(b, s.it));
    if (bad.every((m, i) => m || isInst(steps[i].it)) && !viaGal && galFree) {           // GUY can do none of it: GAL might
      const gbad = steps.map((s) => dryCheck(gal().brain, s.it));
      if (gbad.some((m, i) => !m && !isInst(steps[i].it))) { b = gal().brain; viaGal = true; bad = gbad; if (!aud) speak('guy', 'I cannot do that yet. GAL will get right on that.'); }
    }
    const who = b === brain ? 'guy' : 'gal';
    const can = steps.filter((s, i) => !bad[i]);
    if (!can.some((s) => !isInst(s.it))) { speak(who, fix(bad.find(Boolean), who)); return false; }        // nothing in it can be done: the first reason, as today
    if (can.length < steps.length) {                                  // some of it cannot be done: say which, and ask about the rest
      const no = steps.filter((s, i) => bad[i]).map((s) => s.label[0]);
      commands.ask(who, `I can't ${no.join(' or ')} yet. Should I just ${chainLabel(can.map((s) => s.label))}?`, {
        yes: () => { if (can.length === 1) runParsed(viaGal ? { type: 'gal', inner: can[0].it } : can[0].it, (viaGal ? 'gal ' : named ? 'guy ' : '') + 'x'); else startChain(b, can, viaGal, explicit, aud, named, true); },
        no: () => speak(who, 'Okay, never mind.'),
      });
      return false;
    }
    return startChain(b, steps, viaGal, explicit, aud, named, false);
  }
  const isInst = (it) => it.type === 'screen' || it.type === 'doorlock';
  function startChain(b, steps, viaGal, explicit, aud, named, answered) {
    const L = chainLabel(steps.map((s) => s.label));
    if (b === brain && busyJob(brain)) {                              // his job keeps him: the whole chain waits as one item
      const q = commands.enqueue(brain, steps[0].it, steps[0].label, !named, steps);
      if (q.line) speak('guy', q.line);
      return q.ok;
    }
    const who = b === brain ? 'guy' : 'gal';
    const dropped = commands.dropChain(b);
    if (dropped && dropped.length) speak(who, `Okay, I'll skip ${dropped.map((l) => l[2]).join(' and ')}.`);
    const cls = classOf(b);
    if (viaGal) {
      if (!aud && !answered) speak('guy', explicit ? 'Okay, GAL will take care of it.' : 'GAL will get right on that.');
      speak('gal', `${pick(GAL_OK)} I'll ${L}.`);
    } else if (cls === 'step') speak('guy', firstWords(b, cls, L));
    else if (cls === 'quick') speak('guy', `${firstWords(b, cls, L)} Then I'll ${L}.`);
    else speak('guy', `${pick(OK)} I'll ${L}.`);
    commands.chain(b, steps, cls);
    if (viaGal) startAudience();
    return true;
  }
  // can this step be done at all (a missing skill, a missing thing, a locked door)? the reason, or null. Things that change (the other
  // robot using it, the music already on) are not counted: the step tries again when its turn comes.
  function dryCheck(b, it) {
    switch (it.type) {
      case 'object':
        if (it.name === 'sit') return b.chairs && b.chairs()[0] ? null : 'There is nothing to sit on.';
        if (it.name === 'table' && it.off) return null;
        if (it.off) return 'Switch it off? Just ask for something else.';
        return b.refusal ? b.refusal(it.name) : null;
      case 'act': {
        if (b.available(it.act)) return null;
        const why = b.whyNot && b.whyNot(it.act);
        return why === 'the other robot is using it' ? null : `I cannot ${labelOf(it)[0]} right now${why && !/^\(/.test(why) ? `: ${why}` : ''}.`;
      }
      case 'read': return b.obj('shelf') ? null : 'There is no bookshelf.';
      case 'jam': return 'I can only jam on its own.';
      default: return null;
    }
  }

  // ---- one command (today's path)
  function runOne(text) { return runParsed(parse(text, { rooms: roomList() }), text); }
  function runParsed(it, text) {
    const res = (ok) => ({ ok, intent: it, lines: lines.slice() });
    if (it.type === 'empty') return res(false);
    if (it.type === 'unknown') {
      if (audienceOn()) { speak('gal', 'Sorry, I did not catch that.'); return res(false); }
      speak('guy', pick(['Sorry, I did not catch that.', 'Hmm? Say that again?'])); return res(false);
    }
    if (it.type === 'screen') {
      if (!screen) { speak('guy', 'I cannot lock the screen here.'); return res(false); }
      screen.setMode(it.mode, { quiet: true });
      speak(audienceOn() ? 'gal' : 'guy', it.mode === 'off' ? 'Screen unlocked.' : it.mode === 'on' ? 'Screen locked. Voice only.' : 'Screen locked. Camera controls still work.');
      return res(true);
    }
    if (it.type === 'doorlock') {
      if (it.ask) { speak('guy', 'Which door? Tell me the room.'); return res(false); }
      world.rooms.setDoorLocked(it.room, it.lock);
      speak('guy', it.lock ? 'Door locked.' : 'Door unlocked.'); return res(true);
    }
    // a request for a robot. Who does it (the design's queue rule): GUY when he is free or wraps up quickly; GAL when GUY is busy
    // and she is free (or when she is asked, or has the user's audience); GUY keeps it when he is named ("GUY, mow the lawn"), and
    // when GAL cannot take it he queues it behind his job and starts it when the job ends. Nothing is dropped without a word.
    const explicit = it.type === 'gal';
    const named = !explicit && /^ (hey |ok |okay |hi )?guy /.test(norm(text));
    const req = explicit ? it.inner : it;
    const aud = !explicit && !named && audienceOn();
    if (req.type === 'jam') {
      const g = gal();
      const plan = galOk() && g.planDuo && g.planDuo();
      if (!plan || !g.startDuo(plan)) { speak('guy', galOk() ? 'We cannot jam right now.' : 'I need GAL to jam. She is not here.'); return res(false); }
      return res(true);                                // the lines come from the duo itself (gal.js)
    }
    const label = labelOf(req, rooms());
    // "stop", "never mind": whatever is waiting goes too ("never mind the lawn" drops just that one, a step of a chain too)
    if (req.type === 'next') {
      const b = aud || explicit ? (galOk() ? gal().brain : null) : brain;
      const rest = neverMind(text);
      if (b && rest && rest.type !== 'next' && rest.type !== 'unknown' && rest.type !== 'empty' && commands.cancel(b, rest)) { speak(b === brain ? 'guy' : 'gal', `Okay, I'll leave ${labelOf(rest)[2]}.`); return res(true); }
      if (b) commands.cancel(b);
    }
    // a new command for a robot that is working through a chain: the chain goes, and he says what he is dropping
    const skipLine = (b) => { const d = req.type !== 'next' && commands.dropChain(b); if (d && d.length) speak(b === brain ? 'guy' : 'gal', `Okay, I'll skip ${d.map((l) => l[2]).join(' and ')}.`); };
    // the object he was asked to use is in the room he is in (the yard, say): then he does it himself, he does not hand it to GAL
    const here = req.type === 'object' && req.name !== 'sit' && !!brain.obj(req.name) && world.roomIdAt(brain.obj(req.name).x, brain.obj(req.name).z) === world.roomIdAt(brain.g.root.position.x, brain.g.root.position.z);
    const guyFree = !guyBusy(brain, here);
    const galFree = galOk() && !busyJob(gal().brain);
    if (aud || explicit || (!guyFree && !named && galFree)) {
      if (!galOk()) { speak('guy', explicit ? 'GAL is not here.' : 'I am busy, and GAL is not here.'); return res(false); }
      const gb = gal().brain, cls = classOf(gb);
      const chained = !!commands.chainFor(gb);
      const r = act(gb, req, cls);
      if (!r.ok) { speak('gal', fix(r.message, 'gal')); return res(false); }                  // she was asked, so she answers (with the reason)
      if (chained) skipLine(gb);
      if (!aud) speak('guy', explicit ? 'Okay, GAL will take care of it.' : 'GAL will get right on that.');
      startAudience(); speak('gal', pick(GAL_OK)); commands.track(gb, req, cls, label); return res(true);
    }
    // GUY's job keeps him (cooking, serving...) and GAL cannot take it: it waits for the job, and he says how long
    if (busyJob(brain) && req.type !== 'next') {
      const q = commands.enqueue(brain, req, label, !named);
      if (q.line) speak('guy', q.line); return res(q.ok);
    }
    const cls = classOf(brain);
    const r = act(brain, req, cls);
    if (r.ok) { skipLine(brain); speak('guy', firstWords(brain, cls, label[0], pick(OK))); commands.track(brain, req, cls, label); return res(true); }
    // GUY cannot (no skill, no book, locked door...): GAL might be able to
    if (galFree && req.type !== 'visit' && req.type !== 'comeback') {
      const gb = gal().brain, gcls = classOf(gb);
      const r2 = act(gb, req, gcls);
      if (r2.ok) { speak('guy', 'I cannot do that yet. GAL will get right on that.'); startAudience(); speak('gal', pick(GAL_OK)); commands.track(gb, req, gcls, label); return res(true); }
    }
    // he has not learned it, and the book that teaches it is on the shelf: he offers to read it first (then does it: a chain)
    const book = req.type === 'object' || req.type === 'act' ? bookFor(brain, req) : null;
    if (book) {
      commands.ask('guy', `I haven't learned ${SKILL_WORDS[book.def.teaches] || 'that'} yet. Should I read ${book.def.title} first?`, {
        yes: () => { const steps = [{ it: { type: 'read', query: book.def.id, book: book.def.id }, label: ['read ' + book.def.title, 'Reading ' + book.def.title, 'the book'] }, { it: req, label }]; startChain(brain, steps, false, false, false, named, true); },
        no: () => speak('guy', 'Okay.'),
      });
      return res(false);
    }
    speak('guy', fix(r.message, 'guy')); return res(false);
  }
  // the book on the shelf that teaches what a command needs, when he has not read it yet (the skill-book offer)
  const NEEDS = { guitar: 'guitar', table: 'stereo', soccergoal: 'outdoor.soccer', basketballhoop: 'outdoor.basketball', workbench: 'workshop', toolbox: 'workshop', stove: 'restaurant', kitchencounter: 'restaurant', register: 'restaurant', diningtable: 'restaurant' };
  const SKILL_WORDS = { guitar: 'the guitar', stereo: 'the stereo', 'outdoor.soccer': 'soccer', 'outdoor.basketball': 'basketball', workshop: 'the workshop', restaurant: 'how to run the restaurant' };
  function bookFor(b, req) {
    const skill = req.type === 'act' ? (b.skillNeeds(req.act) || []).find((k) => !b.skills.has(k)) : NEEDS[req.name];
    if (!skill || b.skills.has(skill)) return null;
    const sh = b.obj('shelf');
    return sh && sh.books.find((x) => x.mesh.visible && x.def.teaches === skill && (!b.wantsBook || b.wantsBook(x))) || null;
  }
  // do an intent, wrapping up the way the robot's current activity calls for: a work step (painting, mowing...) is finished first
  function act(b, req, cls) {
    b.finishStep = cls === 'step';
    try { return doIt(b, req); } finally { b.finishStep = false; }
  }
  // speech gives a few guesses at what was said: the first one the parser understands wins ("guy play the pie and oh" vs "... piano")
  function runAlternatives(alts) {
    const list = (alts || []).map((a) => (typeof a === 'string' ? a : a && a.text) || '').filter((t) => t.trim());
    if (!list.length) return run('');
    if (commands.question && list.some((t) => yesNoText(t) && !isCmd(t))) return run(list.find((t) => yesNoText(t) && !isCmd(t)));
    const full = list.find((t) => { const sp = splitSteps(t, { rooms: roomList() }); return sp.pieces.length > 1 && sp.pieces.every((p) => known(p.it)); });
    if (full) return run(full);                                       // (an alternative whose every step makes sense wins)
    const hit = list.find((t) => { const p = parse(t, { rooms: roomList() }); return p.type !== 'unknown' && p.type !== 'empty'; });
    return run(hit || list[0]);
  }
  // a short remark as a robot starts something (chatty mode only; at most one every 25 s per robot, and never over a line being spoken)
  function bark(who, act) {
    if (!say || (typeof speaking === 'function' && speaking())) return false;
    const text = barkFor(act); if (!text) return false;
    const now = performance.now();
    if (!barkReady(who, now)) return false;
    const said = say(who, text, 'bark') !== false;
    if (said) barkSpoke(who, now);
    return said;
  }
  return { run, runAlternatives, bark, parse: (t) => parse(t, { rooms: roomList() }), split: (t) => splitSteps(t, { rooms: roomList() }), audienceOn, lines, commands };
}
