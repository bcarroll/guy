// Spoken commands, finish-then-obey (docs: "Guy's Room: Voice Command Design", sections 3 and 4).
// Every command a robot accepts gets one ending: it starts, it fails with a reason said out loud, it is cancelled by the user, or it
// is dropped after a question. voice.js decides who does a command (GUY, or GAL when GUY is busy); this file then
//   - picks GUY's first words from what he is doing, so the user knows how long to expect (the time limits below),
//   - makes sure the wrap-up never takes longer than its limit (5 s for a quick activity, 10 s to finish a work step),
//   - keeps a short queue of commands waiting behind a busy job (cooking, serving...) when GAL cannot take them, asks the user
//     after 30 s, and starts them when the job is over,
//   - watches that an accepted command really started, and says why when it did not.
// Times are game seconds (the clock window.sim() fast-forwards), so the QA harness can test them without waiting.

// What a robot is doing decides how a new command is handled (the "activity classes" of the design)
export const IDLE_ACTS = ['', 'idle', 'wander', 'lookaround', 'sway', 'akimbo', 'ponder', 'wave', 'stuck'];
export const STEP_ACTS = ['paint', 'scribble', 'mixpaint', 'portrait', 'putcanvas', 'hangpaint', 'build', 'tidytools', 'mow', 'makebed', 'yardtidy'];
export const BUSY_ACTS = ['takeorder', 'cook', 'serve', 'takepay', 'rwait', 'buildbot', 'orderbuild', 'bandplay', 'bandjam'];
export const LIMITS = { idle: 1, quick: 5, step: 10, busy: 30 };
export const START_WATCHDOG = 30;          // an accepted command that has not started after this long has failed (and he says why)
export const MAX_WAITING = 3;              // commands waiting behind a busy job, per robot

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
  return ['do that', 'Doing it', 'that'];
}

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

const YES = / (yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|please do|stop|go on|alright|all right) /;
const NO = / (no|nope|nah|not now|not yet|keep (going|cooking|at it)|dont|do not|wait|finish (first|it)|later) /;
export function yesNo(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  if (t.split(' ').filter(Boolean).length > 6) return null;          // a whole new sentence, not an answer
  if (NO.test(t)) return 'no';
  if (YES.test(t)) return 'yes';
  return null;
}

// speak(who, text), perform(brain, intent) -> { ok, message } (voice.js doIt), fix(message, who) -> first person,
// whoOf(brain) -> 'guy' | 'gal'
export function createCommands({ speak, perform, fix = (m) => m, whoOf = () => 'guy' }) {
  const list = [];                 // command records (in memory only: a reload drops them, nobody is waiting to hear about them)
  let question = null;             // { rec, until } a yes/no question that is open
  let seq = 0;
  const remove = (rec) => { const i = list.indexOf(rec); if (i >= 0) list.splice(i, 1); if (question && question.rec === rec) question = null; };
  const waiting = (b) => list.filter((r) => r.b === b && r.state === 'waiting');
  const sameThing = (a, c) => a.type === c.type && (a.name || a.act || a.room || a.query || '') === (c.name || c.act || c.room || c.query || '');
  const noted = (b) => {           // the brain reports what its status line says (so "no room to stand at the piano" can be told)
    if (b.__cmdUi) return;
    const ui = b.ui; b.__cmdUi = true;
    b.ui = (m) => { b.lastUi = m; b.lastUiAt = b.time; return ui && ui(m); };
  };

  // a command the robot has just accepted (its pendingActivity is set): watch the wrap-up and the start
  function track(b, it, cls, label) {
    if (!b.pendingActivity) return null;
    noted(b);
    for (const r of list.filter((x) => x.b === b && x.state === 'starting')) remove(r);       // (a newer command replaces one still starting)
    const rec = { id: ++seq, b, who: whoOf(b), it, label, cls, state: 'starting', act: b.pendingActivity, t: 0, limit: LIMITS[cls] || LIMITS.quick, err0: b.lastPlanError || null, forced: false };
    list.push(rec);
    return rec;
  }

  // a command for a robot whose job keeps it (cooking with customers waiting...): wait for the job, then do it.
  // Returns the line to say (the caller says it).
  function enqueue(b, it, label, galAsked) {
    const doing = doingLabel(b);
    const same = waiting(b).find((r) => sameThing(r.it, it));
    if (same) remove(same);                                          // asked again: replace it, not a second copy
    else if (waiting(b).length >= MAX_WAITING) return { ok: false, line: `I've already got ${MAX_WAITING} things to do. Want me to drop one?` };
    const rec = { id: ++seq, b, who: whoOf(b), it, label, state: 'waiting', doing, t: 0, asks: 0, answer: null };
    list.push(rec);
    return { ok: true, line: waitLine(doing, label[0], galAsked), rec };
  }

  function start(rec, force) {
    remove(rec);
    const r = perform(rec.b, rec.it);
    if (!r.ok) { speak(rec.who, fix(r.message, rec.who)); return false; }
    speak(rec.who, force ? `Okay, I'll stop ${rec.doing}. ${rec.label[1]} now.` : `Done ${rec.doing}. ${rec.label[1]} now.`);
    track(rec.b, rec.it, 'quick', rec.label);
    return true;
  }

  // the user answered a yes/no question; returns true when the text was taken as the answer
  function answer(text) {
    if (!question) return false;
    const a = yesNo(text);
    if (!a) return false;
    const rec = question.rec; question = null;
    if (a === 'yes') { start(rec, true); return true; }
    rec.answer = 'no';
    speak(rec.who, `Okay, I'll ${rec.label[0]} when I'm done ${rec.doing}.`);
    return true;
  }

  // "stop" / "never mind": everything waiting for that robot is dropped; "never mind the lawn" drops just that one
  function cancel(b, it = null) {
    const hit = list.filter((r) => r.b === b && (!it || r.state === 'waiting' && sameThing(r.it, it)));
    for (const r of hit) remove(r);
    return hit.length;
  }

  function tick(dt) {
    if (question && (question.until -= dt) <= 0) question = null;
    for (const rec of list.slice()) {
      const b = rec.b;
      rec.t += dt;
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
          if (question && question.rec !== rec) continue;              // one question at a time
          rec.asks++;
          question = { rec, until: 20 };
          speak(rec.who, `Still ${rec.doing}. Should I stop and ${rec.label[0]}?`);
          continue;
        }
        if (rec.asks >= 2 && rec.t >= LIMITS.busy * 2 + 20) { remove(rec); speak(rec.who, `I'll leave ${rec.label[2]} for later.`); }
      }
    }
  }

  const clear = () => { list.length = 0; question = null; };
  return {
    track, enqueue, answer, cancel, tick, clear,
    get question() { return question ? { who: question.rec.who, text: question.rec.label[0], until: question.until } : null; },
    get list() { return list.map((r) => ({ id: r.id, who: r.who, state: r.state, act: r.act || null, label: r.label[0], t: Math.round(r.t * 10) / 10, cls: r.cls || null, asks: r.asks || 0 })); },
    waitingFor: (b) => waiting(b).length,
  };
}
