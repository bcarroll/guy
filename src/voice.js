// Voice and typed commands. The user talks only to GUY; if GUY is busy (or is asked to) he hands the request to GAL, who then answers
// the user herself and takes the user's orders until what she was asked to do is finished (an audience, see Gal.audience).
// The parser is rules only (no network): normalise the sentence, match it against a small table, run it through the same entry
// points the menus use (interact, requestRead, visitRoom, lockOn), and speak the answer. English only.
// run(text) returns { ok, intent, lines: [{ who, text }] }; every line is also sent to the speaker (tts.js).
// What happens to a command once a robot has it (wrapping up within a time limit, waiting behind a busy job, the start watchdog) is
// commands.js; the microphone that feeds run() / runAlternatives() is mic.js.
import { barkFor, barkReady, barkSpoke } from './barks.js';
import { createCommands, classOf, busyJob, labelOf, firstWords, yesNo as yesNoText } from './commands.js';
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
    const b = g.brain, alive = !!b.lock || b.pendingActivity === a.act || b.last === a.act || a.fresh-- > 0;
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
        if (!b.available(it.act)) return { ok: false, message: 'I cannot do that right now.' };
        b.unlock(false); b.skip(true); b.pendingActivity = it.act; return { ok: true };
      }
      case 'read': {
        const sh = b.obj('shelf'); if (!sh) return { ok: false, message: 'There is no bookshelf.' };
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

  const commands = createCommands({ speak: (who, t) => speak(who, t), perform: (b, it) => act(b, it, 'quick'), fix, whoOf: (b) => (b === brain ? 'guy' : 'gal') });
  brain.commands = commands;
  function run(text) {
    lines.length = 0;
    // an open yes/no question ("Still cooking. Should I stop and mow?"): a short yes or no answers it
    if (commands.answer(text)) return { ok: true, intent: { type: 'answer' }, lines: lines.slice() };
    const it = parse(text, { rooms: roomList() });
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
    const label = labelOf(req, Object.fromEntries(roomList().map((r) => [r.id, r.name])));
    // "stop", "never mind": whatever is waiting goes too ("never mind the lawn" drops just that one)
    if (req.type === 'next') {
      const b = aud || explicit ? (galOk() ? gal().brain : null) : brain;
      const rest = / never ?mind /.test(norm(text)) ? parse(norm(text).replace(/ never ?mind (about )?/, ' '), { rooms: roomList() }) : null;
      if (b && rest && rest.type !== 'next' && rest.type !== 'unknown' && rest.type !== 'empty' && commands.cancel(b, rest)) { speak(b === brain ? 'guy' : 'gal', `Okay, I'll leave ${labelOf(rest)[2]}.`); return res(true); }
      if (b) commands.cancel(b);
    }
    // the object he was asked to use is in the room he is in (the yard, say): then he does it himself, he does not hand it to GAL
    const here = req.type === 'object' && req.name !== 'sit' && !!brain.obj(req.name) && world.roomIdAt(brain.obj(req.name).x, brain.obj(req.name).z) === world.roomIdAt(brain.g.root.position.x, brain.g.root.position.z);
    const guyFree = !guyBusy(brain, here);
    const galFree = galOk() && !busyJob(gal().brain);
    if (aud || explicit || (!guyFree && !named && galFree)) {
      if (!galOk()) { speak('guy', explicit ? 'GAL is not here.' : 'I am busy, and GAL is not here.'); return res(false); }
      const gb = gal().brain, cls = classOf(gb);
      const r = act(gb, req, cls);
      if (!r.ok) { speak('gal', fix(r.message, 'gal')); return res(false); }                  // she was asked, so she answers (with the reason)
      if (!aud) speak('guy', explicit ? 'Okay, GAL will take care of it.' : 'GAL will get right on that.');
      startAudience(); speak('gal', pick(GAL_OK)); commands.track(gb, req, cls, label); return res(true);
    }
    // GUY's job keeps him (cooking, serving...) and GAL cannot take it: it waits for the job, and he says how long
    if (busyJob(brain) && req.type !== 'next') {
      const q = commands.enqueue(brain, req, label, !named);
      speak('guy', q.line); return res(q.ok);
    }
    const cls = classOf(brain);
    const r = act(brain, req, cls);
    if (r.ok) { speak('guy', firstWords(brain, cls, label[0], pick(OK))); commands.track(brain, req, cls, label); return res(true); }
    // GUY cannot (no skill, no book, locked door...): GAL might be able to
    if (galFree && req.type !== 'visit' && req.type !== 'comeback') {
      const gb = gal().brain, gcls = classOf(gb);
      const r2 = act(gb, req, gcls);
      if (r2.ok) { speak('guy', 'I cannot do that yet. GAL will get right on that.'); startAudience(); speak('gal', pick(GAL_OK)); commands.track(gb, req, gcls, label); return res(true); }
    }
    speak('guy', fix(r.message, 'guy')); return res(false);
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
    if (commands.question && list.some((t) => yesNoText(t))) return run(list.find((t) => yesNoText(t)));
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
  return { run, runAlternatives, bark, parse: (t) => parse(t, { rooms: roomList() }), audienceOn, lines, commands };
}
