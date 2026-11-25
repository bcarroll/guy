// Spoken commands, finish-then-obey (docs: "Guy's Room: Voice Command Design", sections 3 and 4).
// Every command a robot accepts gets one ending: it starts, it fails with a reason said out loud, it is cancelled by the user, or it
// is dropped after a question. voice.js decides who does a command (GUY, or GAL when GUY is busy); this file then
//   - picks GUY's first words from what he is doing, so the user knows how long to expect (the time limits below),
//   - makes sure the wrap-up never takes longer than its limit (5 s for a quick activity, 10 s to finish a work step),
//   - keeps a short queue of commands waiting behind a busy job (cooking, serving...) when GAL cannot take them, asks the user
//     after 30 s, and starts them when the job is over,
//   - watches that an accepted command really started, and says why when it did not,
//   - runs a chain of two or three steps said in one sentence ("turn on the stereo and then dance"): one robot does them in order,
//     each step after the last one ends (brain.update() asks nextFor() before choose() picks something), and a step that is not the
//     last is wrapped up after 20 s so the next one comes soon,
//   - asks yes/no questions (ask()): one at a time, a 20 s window, answered by voice, the typed box or the Yes and No buttons.
// Times are game seconds (the clock window.sim() fast-forwards), so the QA harness can test them without waiting.

// What a robot is doing decides how a new command is handled (the "activity classes" of the design)
export const IDLE_ACTS = ['', 'idle', 'wander', 'lookaround', 'sway', 'akimbo', 'ponder', 'wave', 'stuck'];
export const STEP_ACTS = ['paint', 'scribble', 'mixpaint', 'portrait', 'putcanvas', 'hangpaint', 'build', 'tidytools', 'mow', 'makebed', 'yardtidy'];
export const BUSY_ACTS = ['takeorder', 'cook', 'serve', 'takepay', 'rwait', 'buildbot', 'orderbuild', 'bandplay', 'bandjam'];
export const LIMITS = { idle: 1, quick: 5, step: 10, busy: 30 };
export const START_WATCHDOG = 30;          // an accepted command that has not started after this long has failed (and he says why)
export const MAX_WAITING = 3;              // commands waiting behind a busy job, per robot
export const MAX_STEPS = 3;                // steps in one sentence ("... and then ... and then ...")
export const CHAIN_CAP = 20;               // a step of a chain that is not the last is wrapped up after this long (decided Nov 24)
export const ASK_WINDOW = 20;              // how long a yes/no question stays open
export const RETRY_EVERY = 5, RETRY_FOR = 60;   // a step whose thing the other robot is using is tried again this often, for this long

export const doingNow = (b) => !!(b.step || b.queue.length);
// a job GAL could take over, or that a command has to wait for (the restaurant keeps him while customers are about)
export const busyJob = (b) => !!(doingNow(b) && BUSY_ACTS.includes(b.last) || (b.restStays && b.restStays()));
export function classOf(b) {
  if (busyJob(b)) return 'busy';
  if (!doingNow(b) || IDLE_ACTS.includes(b.last)) return 'idle';
  return STEP_ACTS.includes(b.last) ? 'step' : 'quick';
}

// what he is doing, as he would say it ("I'm cooking")
const DOING = {
  cook: 'cooking', serve: 'serving', takeorder: 'taking orders', takepay: 'taking payments', rwait: 'looking after the customers',
  buildbot: 'building GAL', orderbuild: 'ordering parts', bandplay: 'playing with the band', bandjam: 'jamming with the band',
  paint: 'painting', scribble: 'drawing', mixpaint: 'mixing paint', portrait: 'painting', putcanvas: 'putting the painting away', hangpaint: 'hanging a painting',
  build: 'building', tidytools: 'tidying the tools', mow: 'mowing', makebed: 'making the bed', yardtidy: 'tidying the yard',
};
export const doingLabel = (b) => DOING[b.last] || (b.restStays && b.restStays() ? 'looking after the restaurant' : 'busy');

// the command itself: [what he will do, starting it now, what he leaves for later]
const OBJ = {
  piano: ['play the piano', 'Playing the piano', 'the piano'], bench: ['play the piano', 'Playing the piano', 'the piano'],
  mower: ['mow', 'Mowing the lawn', 'the lawn'], shed: ['mow', 'Mowing the lawn', 'the lawn'],
  lamp: ['see to the lamp', 'Getting the lamp', 'the lamp'], ball: ['play with the ball', 'Playing with the ball', 'the ball'],
  plant: ['water the plants', 'Watering the plants', 'the plants'], sit: ['sit down', 'Sitting down', 'the chair'],
  guitar: ['play the guitar', 'Playing the guitar', 'the guitar'], drums: ['play the drums', 'Playing the drums', 'the drums'],
  easel: ['paint', 'Painting', 'the painting'], telescope: ['look at the stars', 'Looking at the stars', 'the stars'],
  stove: ['cook', 'Cooking', 'the cooking'], kitchencounter: ['serve', 'Serving', 'the serving'], register: ['take the payments', 'Taking the payments', 'the payments'],
  diningtable: ['take the orders', 'Taking the orders', 'the orders'], workbench: ['build something', 'Building something', 'the building'],
  toolbox: ['tidy the tools', 'Tidying the tools', 'the tools'], workstation: ['use the workstation', 'Using the workstation', 'the workstation'],
  lawnchair: ['sit in the lawn chair', 'Sitting in the lawn chair', 'the lawn chair'], basketballhoop: ['shoot some hoops', 'Shooting some hoops', 'the hoops'],
  soccergoal: ['take some shots at the goal', 'Taking some shots', 'the goal'], birdbath: ['see to the bird bath', 'Seeing to the bird bath', 'the bird bath'],
  skyswitch: ['flip the sky switch', 'Flipping the sky switch', 'the sky switch'], blasterrack: ['do some target practice', 'Target practice', 'the range'],
  recordwall: ['spin a record', 'Spinning a record', 'the record'], djbooth: ['put on a show', 'Putting on a show', 'the show'],
  bass: ['play the bass', 'Playing the bass', 'the bass'], keyboard: ['play the keyboard', 'Playing the keyboard', 'the keyboard'],
  xylophone: ['play the xylophone', 'Playing the xylophone', 'the xylophone'], bongos: ['play the bongos', 'Playing the bongos', 'the bongos'],
};
const ACT = { dance: ['dance', 'Dancing', 'the dancing'], sit: ['sit down', 'Sitting down', 'the chair'], ponder: ['have a think', 'Thinking', 'the thinking'], wave: ['wave', 'Waving', 'the waving'], wander: ['have a wander', 'Wandering', 'the wander'] };
export function labelOf(it, rooms = {}) {
  if (!it) return ['do that', 'Doing it', 'that'];
  if (it.type === 'object') {
    if (it.name === 'table') return it.off ? ['turn the music off', 'Turning the music off', 'the music'] : ['put some music on', 'Putting some music on', 'the music'];
    return OBJ[it.name] || ['do that', 'Doing it', 'that'];
  }
  if (it.type === 'act') return ACT[it.act] || ['do that', 'Doing it', 'that'];
  if (it.type === 'read') return ['read', 'Reading', 'the book'];
  if (it.type === 'learn') return ['use the workstation', 'Using the workstation', 'the workstation'];
  if (it.type === 'visit') { const n = (rooms[it.room] || 'room').toLowerCase(); return [`go to the ${n}`, `Heading to the ${n}`, `the ${n}`]; }
  if (it.type === 'comeback') return ['come back', 'Coming back', 'coming back'];
  if (it.type === 'doorlock') { const n = it.room && rooms[it.room] ? ` to the ${rooms[it.room].toLowerCase()}` : ''; return it.lock ? [`lock the door${n}`, `Locking the door${n}`, 'the door'] : [`unlock the door${n}`, `Unlocking the door${n}`, 'the door']; }
  if (it.type === 'screen') return it.mode === 'off' ? ['unlock the screen', 'Unlocking the screen', 'the screen'] : ['lock the screen', 'Locking the screen', 'the screen'];
  return ['do that', 'Doing it', 'that'];
}

// a chain as he would say it: "put some music on, then dance"
export const chainLabel = (labels) => labels.map((l) => l[0]).join(', then ');

// GUY's first words, by the limit that applies (the design's "Lines by time limit")
export function firstWords(b, cls, label, ok) {
  if (cls === 'quick') {
    const book = b.held && b.held.kind !== 'album';
    return book ? 'One sec, putting the book back.' : 'One sec.';
  }
  if (cls === 'step') {
    if (['paint', 'scribble', 'mixpaint', 'portrait'].includes(b.last)) return `Finishing this stroke first, then I'll ${label}.`;
    if (b.last === 'mow') return `Let me finish this row, then I'll ${label}.`;
    if (b.last === 'build') return `Let me finish this piece, then I'll ${label}.`;
    if (b.last === 'makebed') return `Let me finish the bed, then I'll ${label}.`;
    return `Let me finish this first, then I'll ${label}.`;
  }
  return ok;
}
export const waitLine = (doing, label, galAsked) => galAsked
  ? `I'm ${doing} and GAL can't take it. Give me about half a minute, then I'll ${label}.`
  : `I'm ${doing}. Give me about half a minute, then I'll ${label}.`;

const YES = / (yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|go for it|please|please do|go on|alright|all right) /;
const NO = / (no|nope|nah|not now|not yet|no thanks|skip it|forget it|never ?mind|keep (going|cooking|at it)|dont|do not|wait|finish (first|it)|later) /;
const AGAIN = / (what|say (that )?again|say it again|repeat( that)?|pardon|come again|sorry) /;
const words = (text) => ' ' + String(text || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
// "yes" | "no" | null. `stop`: "stop" counts as yes (only the busy question: "Should I stop and mow?")
export function yesNo(text, stop = true) {
  const t = words(text);
  if (t.split(' ').filter(Boolean).length > 6) return null;          // a whole new sentence, not an answer
  if (NO.test(t)) return 'no';
  if (YES.test(t) || (stop && / stop /.test(t))) return 'yes';
  return null;
}
const askAgain = (text) => { const t = words(text); return t.split(' ').filter(Boolean).length <= 4 && AGAIN.test(t) && !YES.test(t) && !NO.test(t); };

// what a message from the brain says, as the robot would say it ("GUY doesn't know how to use the stereo yet. Maybe ..." ->
// "I don't know how to use the stereo yet"): the first sentence, in the first person
export function reasonOf(msg, who = 'guy') {
  let m = String(msg || '').split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, '');
  const me = who === 'gal' ? 'GAL' : 'GUY';
  m = m.replace(new RegExp(`^${me} (doesn't|does not)`, 'i'), "I don't").replace(new RegExp(`^${me} (hasn't|has not)`, 'i'), "I haven't")
    .replace(new RegExp(`^${me} (can't|cannot|can not)`, 'i'), "I can't").replace(new RegExp(`^${me} is`, 'i'), "I'm").replace(new RegExp(`^${me} has`, 'i'), "I've")
    .replace(new RegExp(`^${me} needs`, 'i'), 'I need').replace(new RegExp(`^${me} `, 'i'), 'I ')
    .replace(/^(he|she) (has not|hasn't)/, "I haven't").replace(/^(he|she) is /, "I'm ").replace(/^(he|she) /, 'I ');
  return m;
}
const BUSY_ELSEWHERE = /is using that right now|the other robot is using/;


// speak(who, text), perform(brain, intent, cls) -> { ok, message } (voice.js doIt), fix(message, who) -> first person,
// whoOf(brain) -> 'guy' | 'gal', instant(intent) -> { ok, message } for a step no robot does (a door, the screen lock),
// onQuestion(question | null) as a question opens and closes (the Yes and No buttons), onStep(brain) as a chain starts a step
export function createCommands({ speak, perform, fix = (m) => m, whoOf = () => 'guy', instant = null, onQuestion = () => {}, onStep = () => {} }) {
  const list = [];                 // command records (in memory only: a reload drops them, nobody is waiting to hear about them)
  let question = null;             // the open yes/no question: { who, text, yes, no, silence, stop, keep, until, repeated, rec }
  const asking = [];               // questions waiting their turn: one is asked at a time
  let seq = 0;
  const pub = () => question && { who: question.who, text: question.text, until: question.until, label: question.rec && question.rec.label ? question.rec.label[0] : null };
  const remove = (rec) => {
    const i = list.indexOf(rec); if (i >= 0) list.splice(i, 1);
    for (let k = asking.length - 1; k >= 0; k--) if (asking[k].rec === rec) asking.splice(k, 1);
    if (question && question.rec === rec) settle(question, () => {});
  };
  const waiting = (b) => list.filter((r) => r.b === b && r.state === 'waiting');
  const chainOf = (b) => list.find((r) => r.b === b && r.state === 'chain') || null;
  const sameThing = (a, c) => a.type === c.type && (a.name || a.act || a.room || a.query || '') === (c.name || c.act || c.room || c.query || '');
  const isInstant = (it) => it.type === 'screen' || it.type === 'doorlock';
  const noted = (b) => {           // the brain reports what its status line says (so "no room to stand at the piano" can be told)
    if (b.__cmdUi) return;
    const ui = b.ui; b.__cmdUi = true;
    b.ui = (m) => { b.lastUi = m; b.lastUiAt = b.time; return ui && ui(m); };
  };
  // the label of a chain: [what he will do, starting it now, what he leaves for later]
  const labelsOf = (steps) => {
    const ls = steps.map((s) => s.label);
    return [chainLabel(ls), ls.map((l, i) => (i ? l[1].charAt(0).toLowerCase() + l[1].slice(1) : l[1])).join(', then '), ls.map((l) => l[2]).join(' and ')];
  };

  // ---- yes/no questions: one at a time, each open for ASK_WINDOW seconds; yes(), no() and silence() say and do the outcome
  function open(q) { question = q; q.until = ASK_WINDOW; speak(q.who, q.text); onQuestion(pub()); }
  function settle(q, fn) {
    if (question !== q) return;
    question = null; onQuestion(null);
    fn();
    if (!question && asking.length) open(asking.shift());
  }
  // stop: "stop" means yes (the busy question); keep: a new command does not close it with its no-answer outcome (the busy question)
  function ask(who, text, { yes = () => {}, no = () => {}, silence = null, stop = false, keep = false, rec = null } = {}) {
    const q = { who, text, yes, no, silence: silence || no, stop, keep, rec };
    if (question) asking.push(q); else open(q);
    return q;
  }
  // the user answered by voice or the typed box; returns true when the text was taken as the answer
  function answer(text) {
    if (!question) return false;
    if (askAgain(text) && !question.repeated) { question.repeated = true; question.until = ASK_WINDOW; speak(question.who, question.text); return true; }     // "what?": once
    const a = yesNo(text, question.stop);
    if (!a) return false;
    const q = question; settle(q, a === 'yes' ? q.yes : q.no);
    return true;
  }
  // the Yes or No button under the subtitle
  function press(a) { if (!question) return false; const q = question; settle(q, a === 'yes' ? q.yes : q.no); return true; }
  // a new command instead of an answer: the question closes with its no-answer outcome (the busy question stays: the command keeps waiting)
  function dismiss() { if (!question) return false; const q = question; settle(q, q.keep ? () => {} : q.silence); return true; }
  // the user is talking (the mic is held): the window starts again
  function hold() { if (question) question.until = ASK_WINDOW; }

  // a command the robot has just accepted (its pendingActivity is set): watch the wrap-up and the start
  function track(b, it, cls, label) {
    if (!b.pendingActivity) return null;
    noted(b);
    for (const r of list.filter((x) => x.b === b && (x.state === 'starting' || x.state === 'chain'))) remove(r);       // (a newer command replaces one still starting, and a chain)
    const rec = { id: ++seq, b, who: whoOf(b), it, label, cls, state: 'starting', act: b.pendingActivity, t: 0, limit: LIMITS[cls] || LIMITS.quick, err0: b.lastPlanError || null, forced: false };
    list.push(rec);
    return rec;
  }

  // a command for a robot whose job keeps it (cooking with customers waiting...): wait for the job, then do it. `steps`: a chain waits
  // as one item. Returns the line to say (the caller says it; none when a question was asked instead).
  function enqueue(b, it, label, galAsked, steps = null) {
    const doing = doingLabel(b), who = whoOf(b);
    const same = !steps && waiting(b).find((r) => !r.steps && sameThing(r.it, it));
    if (same) remove(same);                                          // asked again: replace it, not a second copy
    else if (waiting(b).length >= MAX_WAITING) {                    // full: ask to drop the oldest
      ask(who, `I've already got ${MAX_WAITING} things to do. Should I drop the oldest?`, {
        yes: () => { const old = waiting(b)[0]; if (old) remove(old); const q = enqueue(b, it, label, galAsked, steps); speak(who, old ? `Okay, I'll leave ${old.label[2]}. ${q.line}` : q.line); },
        no: () => speak(who, `Okay, I'll keep the ${MAX_WAITING} I've got.`),
      });
      return { ok: false, line: '', asked: true };
    }
    const rec = { id: ++seq, b, who, it, label: steps ? labelsOf(steps) : label, steps, state: 'waiting', doing, t: 0, asks: 0, answer: null };
    list.push(rec);
    return { ok: true, line: waitLine(doing, rec.label[0], galAsked), rec };
  }

  function start(rec, force) {
    remove(rec);
    if (rec.steps) {
      speak(rec.who, force ? `Okay, I'll stop ${rec.doing}. ${rec.label[1]} now.` : `Done ${rec.doing}. ${rec.label[1]} now.`);
      chain(rec.b, rec.steps, 'quick');
      return true;
    }
    const r = perform(rec.b, rec.it, 'quick');
    if (!r.ok) { speak(rec.who, fix(r.message, rec.who)); return false; }
    speak(rec.who, force ? `Okay, I'll stop ${rec.doing}. ${rec.label[1]} now.` : `Done ${rec.doing}. ${rec.label[1]} now.`);
    track(rec.b, rec.it, 'quick', rec.label);
    return true;
  }

  // ---- chains: "turn on the stereo and then dance". steps: [{ it, label }], all for robot b (voice.js decided who and checked them).
  // Step after step: the next starts when the current one's activity is over (nextFor, from brain.update before choose()), quietly; a
  // step that is not the last is wrapped up at CHAIN_CAP; the last one is an ordinary command (its natural length, the start watchdog).
  function chain(b, steps, cls = 'idle') {
    noted(b);
    for (const r of list.filter((x) => x.b === b && (x.state === 'starting' || x.state === 'chain'))) remove(r);
    const rec = { id: ++seq, b, who: whoOf(b), steps: steps.slice(), i: 0, state: 'chain', phase: 'new', t: 0 };
    rec.label = labelsOf(rec.steps);
    list.push(rec);
    return stepOn(rec, cls);
  }
  function stepOn(rec, cls = 'idle') {
    const b = rec.b;
    while (rec.i < rec.steps.length) {
      const st = rec.steps[rec.i], last = rec.i === rec.steps.length - 1;
      if (isInstant(st.it)) {                                         // a door or the screen: done when its turn comes
        const r = instant ? instant(st.it) : { ok: false, message: 'I cannot do that here.' };
        if (!r.ok) return fail(rec, r.message);
        rec.i++; continue;
      }
      const r = perform(b, st.it, cls);
      if (!r.ok) return retryOrFail(rec, r.message);
      delete rec.retryFor;
      if (!b.pendingActivity) { rec.i++; continue; }                 // (nothing to wait for)
      if (last) { remove(rec); track(b, st.it, cls, st.label); onStep(b); return true; }
      Object.assign(rec, { phase: 'starting', act: b.pendingActivity, t: 0, cls, limit: LIMITS[cls] || LIMITS.quick, forced: false, capped: false, err0: b.lastPlanError || null });
      onStep(b);
      return true;
    }
    remove(rec);
    return true;
  }
  // the other robot is using what the step needs: try again every RETRY_EVERY s for up to RETRY_FOR s, then ask about the rest
  function retryOrFail(rec, msg) {
    if (BUSY_ELSEWHERE.test(msg) && (rec.retryFor || 0) < RETRY_FOR) { rec.retryFor ??= 0; rec.phase = 'retry'; rec.retryT = 0; return true; }
    return fail(rec, msg);
  }
  // a step failed: he says why, and asks about the rest ("I couldn't put the music on: I don't know how to use the stereo yet. Should I still dance?")
  function fail(rec, msg) {
    const st = rec.steps[rec.i], rest = rec.steps.slice(rec.i + 1);
    const why = reasonOf(fix(msg, rec.who), rec.who);
    delete rec.retryFor;
    if (!rest.length) { remove(rec); speak(rec.who, `I couldn't ${st.label[0]}: ${why}.`); return false; }
    rec.phase = 'asking';
    ask(rec.who, `I couldn't ${st.label[0]}: ${why}. Should I still ${chainLabel(rest.map((s) => s.label))}?`, {
      rec,
      yes: () => { rec.i++; stepOn(rec, 'idle'); },
      no: () => { remove(rec); speak(rec.who, "Okay, I'll leave it."); },
    });
    return false;
  }
  // brain.update(), when the robot has nothing left to do and nothing pending: start the chain's next step (true when it did something)
  function nextFor(b) {
    const rec = chainOf(b);
    if (!rec) return false;
    if (rec.phase === 'running') { rec.i++; stepOn(rec, 'idle'); return true; }
    if (rec.phase === 'retry' || rec.phase === 'asking') { b.queue.push(b.play('idle', 0.5)); return true; }      // he waits where he is
    return false;
  }

  // "stop" / "never mind": everything for that robot is dropped (a chain too); "never mind the lawn" drops just that one (a step of a chain)
  function cancel(b, it = null) {
    if (!it) { const hit = list.filter((r) => r.b === b); for (const r of hit) remove(r); return hit.length; }
    let n = 0;
    for (const r of list.slice()) {
      if (r.b !== b) continue;
      if (r.state === 'waiting' && !r.steps && sameThing(r.it, it)) { remove(r); n++; continue; }
      if (r.steps && (r.state === 'waiting' || r.state === 'chain')) {
        const from = r.state === 'chain' ? r.i : 0;
        const k = r.steps.findIndex((s, j) => j >= from && s.it.type !== 'screen' && sameThing(s.it, it));
        if (k < 0) continue;
        n++;
        if (r.state === 'chain' && k === r.i) {                          // the step he is on: he stops it and goes on with the rest
          if (r.phase === 'running' || r.phase === 'starting') { if (r.phase === 'starting') { b.pendingActivity = null; r.act = b.last; r.t = 0; r.startAt = b.time; } r.phase = 'running'; r.capped = true; r.capT = 0; b.skip(true); }
          continue;
        }
        r.steps.splice(k, 1); r.label = labelsOf(r.steps);
        if (r.state === 'waiting' && !r.steps.length) remove(r);
        else if (r.state === 'waiting' && r.steps.length === 1) { r.it = r.steps[0].it; r.label = r.steps[0].label; r.steps = null; }
      }
    }
    return n;
  }
  // a new command for a robot doing a chain: the chain goes; returns what was left of it (the labels of the steps after the current one)
  function dropChain(b) {
    const rec = chainOf(b);
    if (!rec) return null;
    const rest = rec.steps.slice(rec.i + 1).map((s) => s.label);
    remove(rec);
    return rest;
  }

  function tick(dt) {
    if (question && (question.until -= dt) <= 0) settle(question, question.silence);
    for (const rec of list.slice()) {
      if (!list.includes(rec)) continue;
      const b = rec.b;
      rec.t += dt;
      if (rec.state === 'chain') { tickChain(rec, dt); continue; }
      if (rec.state === 'starting') {
        if (b.pendingActivity !== rec.act) {                          // taken up (or replaced by something else the user asked for)
          if (b.last === rec.act) { rec.state = 'running'; rec.t = 0; rec.startAt = b.time; } else remove(rec);
          continue;
        }
        if (!rec.forced && rec.t >= rec.limit) {                      // the wrap-up limit: stop where he is so the command can start
          rec.forced = true;
          if (rec.cls === 'step') speak(rec.who, "That'll do for now.");
          b.queue = []; b.step = null;                                // (a book in his hands still goes back first: update() sees to that)
          continue;
        }
        if (rec.t >= START_WATCHDOG) {                                // the start watchdog: it never started; say why rather than nothing
          remove(rec);
          b.pendingActivity = null;
          const why = b.whyNot && b.whyNot(rec.act);
          speak(rec.who, why ? fix(`I couldn't ${rec.label[0]}: ${why}.`, rec.who) : `Sorry, I couldn't get started on that.`);
        }
        continue;
      }
      if (rec.state === 'running') {
        if (b.lastPlanError && b.lastPlanError !== rec.err0 && b.last === rec.act) {        // the plan fell apart (something it needed is gone)
          remove(rec); speak(rec.who, `I couldn't ${rec.label[0]}. Something's in the way.`); continue;
        }
        const ui = b.lastUi || '';
        if (b.lastUiAt >= rec.startAt && /^no room to stand at the (.+) where it is$/.test(ui)) {
          remove(rec); speak(rec.who, `I can't get to the ${ui.match(/^no room to stand at the (.+) where it is$/)[1]} where it is.`); continue;
        }
        if (b.last !== rec.act || rec.t >= START_WATCHDOG) remove(rec);              // under way (finishing is visible: nothing said)
        continue;
      }
      if (rec.state === 'waiting') {
        if (!busyJob(b)) { start(rec, false); continue; }
        if (rec.answer === 'no') { if (rec.t >= 300) { remove(rec); speak(rec.who, `I'll leave ${rec.label[2]} for later.`); } continue; }
        if (rec.asks === 0 && rec.t >= LIMITS.busy || rec.asks === 1 && rec.t >= LIMITS.busy * 2) {
          if (question || asking.length) continue;                     // one question at a time (this one is asked when that is done)
          rec.asks++;
          ask(rec.who, `Still ${rec.doing}. Should I stop and ${rec.label[0]}?`, {
            rec, stop: true, keep: true,
            yes: () => start(rec, true),
            no: () => { rec.answer = 'no'; speak(rec.who, `Okay, I'll ${rec.label[0]} when I'm done ${rec.doing}.`); },
            silence: () => {},
          });
          continue;
        }
        if (rec.asks >= 2 && rec.t >= LIMITS.busy * 2 + 20) { remove(rec); speak(rec.who, `I'll leave ${rec.label[2]} for later.`); }
      }
    }
  }
  function tickChain(rec, dt) {
    const b = rec.b;
    if (rec.phase === 'asking') return;
    if (rec.phase === 'retry') {
      rec.retryT += dt; rec.retryFor += dt;
      if (rec.retryT >= RETRY_EVERY) { rec.retryT = 0; stepOn(rec, 'idle'); }
      return;
    }
    if (rec.phase === 'starting') {
      if (b.pendingActivity !== rec.act) {
        if (b.last === rec.act) { rec.phase = 'running'; rec.t = 0; rec.startAt = b.time; } else remove(rec);      // (replaced by something else: the rest goes)
        return;
      }
      if (!rec.forced && rec.t >= rec.limit) {
        rec.forced = true;
        if (rec.cls === 'step') speak(rec.who, "That'll do for now.");
        b.queue = []; b.step = null;
        return;
      }
      if (rec.t >= START_WATCHDOG) {
        b.pendingActivity = null;
        const why = b.whyNot && b.whyNot(rec.act);
        fail(rec, why || 'I could not get started');
      }
      return;
    }
    if (rec.phase !== 'running') return;
    if (b.lastPlanError && b.lastPlanError !== rec.err0 && b.last === rec.act) { b.queue = []; b.step = null; fail(rec, "something's in the way"); return; }
    const ui = b.lastUi || '';
    if (b.lastUiAt >= rec.startAt && /^no room to stand at the (.+) where it is$/.test(ui)) { fail(rec, `I can't get to the ${ui.match(/^no room to stand at the (.+) where it is$/)[1]} where it is`); return; }
    if (b.last !== rec.act) { remove(rec); return; }                 // he went on to something else (the user picked it): the rest goes
    const open = !['read', 'learn', 'visit', 'comeback'].includes(rec.steps[rec.i].it.type);       // (reading a book, walking to a room: they end by themselves)
    if (open && !rec.capped && rec.t >= CHAIN_CAP) {                  // not the last step: wrapped up after 20 s so the next comes soon
      rec.capped = true; rec.capT = 0;
      b.skip(true);                                                   // (stands up, puts things down; the music stays for the next step)
      return;
    }
    if (rec.capped && (rec.capT += dt) >= LIMITS.quick && (b.step || b.queue.length)) { b.queue = []; b.step = null; }     // the wrap-up's own limit
  }

  const clear = () => { list.length = 0; asking.length = 0; if (question) { question = null; onQuestion(null); } };
  return {
    track, enqueue, answer, press, dismiss, hold, ask, cancel, chain, nextFor, dropChain, tick, clear,
    get question() { return pub(); },
    get asking() { return asking.length; },
    get list() { return list.map((r) => ({ id: r.id, who: r.who, state: r.state, act: r.act || null, label: r.label[0], t: Math.round(r.t * 10) / 10, cls: r.cls || null, asks: r.asks || 0, step: r.state === 'chain' ? r.i : null, steps: r.steps ? r.steps.length : null, phase: r.phase || null })); },
    waitingFor: (b) => waiting(b).length,
    chainFor: (b) => { const r = chainOf(b); return r ? { i: r.i, steps: r.steps.map((s) => s.label[0]), phase: r.phase } : null; },
  };
}
