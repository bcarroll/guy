// QA harness for Guy's room. NOT imported by the game: load it from the browser console / test tooling with
//
//     const T = (await import('/src/devtools.js')).default;      // page opened with ?nostart&fresh&skills=none
//
// It drives the real game objects (window.brain, window.guy, window.scene ...), so what it tests is what you play.
// It is data driven: the object / book / record / track lists come from the game's own catalogues, and
// T.coverage() reports anything the MANIFEST below does not know about yet. When you add an asset or an
// activity, add it to MANIFEST (and to .claude/skills/test-guy-game/assets.md). See that skill for the workflow.
import { OBJECT_CATALOG } from './machine.js';
import { BOOK_CATALOG, SKILL_INFO } from './skills.js';
import { ALBUM_CATALOG } from './albums.js';
import { TRACKS, trackSeconds } from './audio.js';
import { POSES } from './brain.js';

// ---------------------------------------------------------------------------------------------------------------
// MANIFEST: what the test knows about each asset. Keep in sync with the game (T.coverage() tells you what is missing).
// ---------------------------------------------------------------------------------------------------------------
export const MANIFEST = {
  // interact: the name passed to brain.interact (what the long-press "Interact" button does)
  objects: {
    piano: { skills: ['piano'] }, bench: { skills: ['piano'] }, table: { skills: ['stereo'] }, shelf: { skills: [], fixed: true },
    lamp: { skills: ['lighting'] }, armchair: { skills: [] }, plant: { skills: [] }, ball: { skills: ['ball'] }, guitar: { skills: ['guitar'] },
    workbench: { locked: true }, drums: { skills: ['drums'] }, easel: { skills: ['easel'] }, telescope: { skills: ['telescope'] },
    // decor (world.decor): no interaction; tested by sweepDecor (remove / put back through the Skill Machine, wall limits)
    rug: { decor: true }, picture: { decor: true, wall: 'back' }, window: { decor: true, wall: 'left' }, window2: { decor: true, wall: 'back', startsOut: true },
    art_mountains: { decor: true, wall: 'left', startsOut: true }, art_abstract: { decor: true, wall: 'back', startsOut: true }, art_moon: { decor: true, wall: 'left', startsOut: true },
    sconce: { decor: true, wall: 'back', startsOut: true }, rug2: { decor: true, startsOut: true }, rug3: { decor: true, startsOut: true },
    // decor furniture and plants (real objects): the plants are tended, the tables are only furniture
    flowerplant: { skills: [] }, tree: { skills: [] }, coffeetable: { skills: [] }, nightstand: { skills: [] },
  },
  // activities: objects that must be in the room, skills needed, `music` = needs the stereo already playing,
  // touches = objects Guy's arms may legitimately be inside the bounding box of (hands on keys, pushing, ...)
  activities: {
    wander: {}, stretch: {}, wave: {},
    piano: { objects: ['piano'], skills: ['piano'], touches: ['piano'] },
    sitpiano: { objects: ['piano', 'bench'], skills: ['piano'], touches: ['piano', 'bench'] },
    plink: { objects: ['piano'], touches: ['piano'] },
    jam: { objects: ['piano', 'table'], skills: ['stereo', 'piano'], touches: ['piano', 'table', 'shelf'] },
    jampiano: { objects: ['piano', 'table'], skills: ['stereo', 'piano'], touches: ['piano', 'table', 'shelf'] },
    jamsit: { objects: ['piano', 'bench', 'table'], skills: ['stereo', 'piano'], touches: ['piano', 'bench', 'table', 'shelf'] },
    dance: { objects: ['table'], skills: ['stereo'], touches: ['table', 'shelf', 'lamp'] },
    lamp: { objects: ['lamp'], touches: ['lamp'] },
    mood: { objects: ['lamp'], skills: ['lighting'], touches: ['lamp'] },
    plant: { objects: ['plant'], touches: ['plant', 'flowerplant', 'tree'] },
    dust: { objects: ['picture'], skills: ['decorate'], touches: [] },
    read: { objects: ['shelf'], touches: ['shelf', 'armchair'] },
    rearrange: { objects: ['lamp', 'plant', 'armchair'], touches: ['lamp', 'plant', 'armchair', 'table', 'bench', 'flowerplant', 'coffeetable', 'nightstand', 'guitar', 'easel', 'telescope'] },
    ball: { touches: [] },
    dribble: { skills: ['ball'], touches: [] },
    toss: { skills: ['ball'], touches: [] },
    guitar: { objects: ['guitar'], skills: ['guitar'], touches: ['guitar'] },
    jamguitar: { objects: ['guitar'], skills: ['guitar'], music: true, touches: ['guitar'] },
    dancemoves: { objects: ['table'], skills: ['dance.moves'], touches: ['table', 'shelf', 'lamp'] },
    ballroom: { objects: ['table'], skills: ['dance.ballroom'], touches: ['table', 'shelf', 'lamp'] },
    bang: { objects: ['drums'], touches: ['drums'] },
    drums: { objects: ['drums'], skills: ['drums'], touches: ['drums'] },
    drumsolo: { objects: ['drums'], skills: ['drums.solo'], touches: ['drums'] },
    jamdrums: { objects: ['drums'], skills: ['drums.band'], music: true, touches: ['drums'] },
    scribble: { objects: ['easel'], touches: ['easel'] },
    paint: { objects: ['easel'], skills: ['easel'], touches: ['easel'] },
    mixpaint: { objects: ['easel'], skills: ['easel.colour'], touches: ['easel'] },
    portrait: { objects: ['easel'], skills: ['easel.portrait'], touches: ['easel'] },
    peek: { objects: ['telescope'], touches: ['telescope'] },
    stargaze: { objects: ['telescope'], skills: ['telescope'], touches: ['telescope'] },
    darkstargaze: { objects: ['telescope', 'lamp'], skills: ['telescope.dark'], touches: ['telescope', 'lamp'] },
    scopecare: { objects: ['telescope'], skills: ['telescope.care'], touches: ['telescope'] },
    // internal recovery activities and aliases: exercised through the interruption sweep, not on their own
    books: { alias: true }, putback: { internal: true }, putguitar: { internal: true }, dropball: { internal: true }, lighton: { internal: true },
  },
  // what to do after reading each book: an activity that should now be possible
  books: { stereo: { then: 'dance' }, piano: { then: 'piano' }, ball: { then: 'dribble' }, lighting: { then: 'mood' }, piano2: { then: 'piano' }, guitar: { then: 'guitar' },
    dancemoves: { then: 'dancemoves' }, ballroom: { then: 'ballroom' },
    drumming: { then: 'drums' }, drumsolo: { then: 'drumsolo' }, drumband: { then: 'jamdrums' },
    painting: { then: 'paint' }, colour: { then: 'mixpaint' }, portrait: { then: 'portrait' },
    stars: { then: 'stargaze' }, darksky: { then: 'darkstargaze' }, scopecare: { then: 'scopecare' },
    decorating: { then: 'dust' },
  },
  // records and tracks that must exist
  albums: {
    happy: {}, rock: {}, hiphop: {}, twostep: {}, pop: {}, jazz: {}, slowblues: {}, party: {},
    classical: { premium: true }, country: { premium: true }, blues: { premium: true }, lullaby: { premium: true },
  },
  tracks: ['default', ...ALBUM_CATALOG.flatMap((a) => a.tracks)],     // every track on every record; coverage fails for a track no record lists
  // the visual checkpoints: freeze Guy at (activity, pose, t) and look from `view`. See assets.md for the full checklist.
  visual: [
    { id: 'read-grab-mid', activity: 'read', pose: 'grab', t: 1.2, view: 'hand:Right', expect: 'handshake grip, thumb up, hand reaches the book, arm in front of him' },
    { id: 'read-sit', activity: 'read', pose: 'readSit', t: 8, view: 'front', expect: 'book open with pages facing Guy, both hands on the lower edges, seated in the chair with legs clear of it' },
    { id: 'read-turn', activity: 'read', pose: 'readSit', t: 0, view: 'front', turning: true, expect: 'right hand on the reader side of the page while a page flips' },
    { id: 'guitar-play', activity: 'guitar', pose: 'guitar', t: 7, view: 'front', expect: 'guitar rests on his belly on a strap; right fingers hang over the strings; left wrist under the neck, fingers up, thumb to the headstock; nothing passes through the body' },
    { id: 'piano-sit', activity: 'sitpiano', pose: 'pianoSit', t: 6, view: 'side', expect: 'seated on the bench, hands on the keys, knees under the key shelf' },
    { id: 'piano-stand', activity: 'piano', pose: 'piano', t: 5, view: 'side', expect: 'standing at the keys, both hands on keys, leaning in' },
    { id: 'stereo-button', activity: 'dance', pose: 'reach', t: 1.1, view: 'front', expect: 'index finger on the boombox button, LED lit when music starts' },
    { id: 'lamp-switch', activity: 'lamp', pose: 'reach', t: 1.1, view: 'front', expect: 'finger on the switch on the lamp stem' },
    { id: 'push-furniture', activity: 'rearrange', pose: 'walk', t: 1, view: 'side', push: true, expect: 'both hands flat on the near face of the object, leaning in, object moves with him' },
    { id: 'ball-dribble', activity: 'dribble', pose: 'dribble', t: 4, view: 'side', expect: 'hand over the ball as it bounces, ball does not penetrate the floor or his hand' },
    { id: 'ball-toss', activity: 'toss', pose: 'toss', t: 3, view: 'front', expect: 'ball rises above him, head follows it, hands catch it at the chest' },
    { id: 'drums-sit', activity: 'drums', pose: 'drumSit', t: 9, view: 'front', expect: 'seated on the stool, a stick in each fist held like a knife (pointing forward, only slightly down, not steeply down), tips over the pads, kit not passing through his legs' },
    { id: 'drums-solo', activity: 'drumsolo', pose: 'drumSit', t: 12, view: 'side', expect: 'arms reach the toms and crash without the elbows folding into his chest' },
    { id: 'easel-paint', activity: 'paint', pose: 'paintStand', t: 9, view: 'side', expect: 'brush tip on the canvas with a stroke being drawn, palette on the left palm, standing a step from the easel' },
    { id: 'easel-mix', activity: 'mixpaint', pose: 'paintStand', t: 6, view: 'front', expect: 'brush circling on the palette held in the left hand' },
    { id: 'scope-peer', activity: 'stargaze', pose: 'scopePeer', t: 6, view: 'side', expect: 'eye at the eyepiece (rear end), knees bent, left hand on the focus knob, right hand on the barrel' },
    { id: 'scope-aim', activity: 'stargaze', pose: 'scopeAim', t: 2.2, view: 'top', expect: 'one hand on top of the barrel while the tube swings round' },
    { id: 'scope-wrong', activity: 'peek', pose: 'scopeWrong', t: 2.8, view: 'side', expect: 'eye at the big lens end, hand on the barrel, other hand on his knee' },
    { id: 'scope-care', activity: 'scopecare', pose: 'scopeCare', t: 13, view: 'front', expect: 'squatting beside the tripod with a hand on one leg' },
    { id: 'dust-frame', activity: 'dust', pose: 'reach', t: 2.5, view: 'front', expect: 'facing the wall, right hand wiping along the lower edge of a frame (not inside the wall or his own head)' },
    { id: 'dance-twist', activity: 'dancemoves', pose: 'twist', t: 4, view: 'front', expect: 'hips and shoulders twisting opposite ways, knees bent and apart, elbows bent, feet flat' },
    { id: 'dance-shuffle', activity: 'dancemoves', pose: 'shuffle', t: 4, view: 'front', expect: 'one foot slides forward at a time, elbows bent and pumping alternately' },
    { id: 'dance-twirl', activity: 'dancemoves', pose: 'twirl', t: 2.5, view: 'front', expect: 'arms out to the sides, spinning on the spot without drifting or hitting furniture' },
    { id: 'dance-waltz', activity: 'ballroom', pose: 'waltz', t: 5, view: 'front', expect: 'dance hold: left arm out and bent, right arm curved as if round a partner, slowly turning' },
    { id: 'dance-swing', activity: 'ballroom', pose: 'swing', t: 4, view: 'front', expect: 'arms swinging wide in opposition, alternate knee kicks on the beat' },
    { id: 'record-carry', activity: 'dance', pose: 'walk', t: 0, view: 'front', album: true, expect: 'sleeve hangs from his hand by its top edge (only when a record is used)' },
  ],
};

// ---------------------------------------------------------------------------------------------------------------
const T = {};
export default T;

const errors = [];
if (!window.__guyTestErrors) {
  window.__guyTestErrors = errors;
  const orig = console.error;
  console.error = (...a) => { errors.push(a.map((x) => (x && x.message) || String(x)).join(' ').slice(0, 240)); orig(...a); };
}
const B = () => window.brain;
const G = () => window.guy;
const W = () => window.brain.w;
const step = (sec) => window.sim(sec);
const label = () => document.getElementById('activity').textContent;
const skillsOf = () => B().skills;
T.errors = errors;
T.MANIFEST = MANIFEST;

const result = (name, pass, notes = {}) => ({ name, pass: !!pass, ...notes });

// ---- inventory and coverage -------------------------------------------------------------------------------------
T.inventory = () => ({
  objects: OBJECT_CATALOG.map((d) => d.id),
  books: BOOK_CATALOG.map((b) => b.id),
  albums: ALBUM_CATALOG.map((a) => a.id),
  tracks: Object.keys(TRACKS),
  skills: Object.keys(SKILL_INFO),
  activities: Object.keys(B().activities()),
  poses: Object.keys(POSES),
});

// Anything in the game that the manifest does not mention: add it to MANIFEST and the skill's assets.md.
T.coverage = () => {
  const inv = T.inventory();
  const missing = {
    objects: inv.objects.filter((x) => !(x in MANIFEST.objects)),
    activities: inv.activities.filter((x) => !(x in MANIFEST.activities)),
    books: inv.books.filter((x) => !(x in MANIFEST.books) && !(BOOK_CATALOG.find((b) => b.id === x) || {}).locked),
    albums: inv.albums.filter((x) => !(x in MANIFEST.albums)),
    tracks: inv.tracks.filter((x) => !MANIFEST.tracks.includes(x)),
    skills: inv.skills.filter((x) => !BOOK_CATALOG.some((b) => b.teaches === x)),
  };
  const stale = {
    objects: Object.keys(MANIFEST.objects).filter((x) => !inv.objects.includes(x)),
    activities: Object.keys(MANIFEST.activities).filter((x) => !inv.activities.includes(x)),
  };
  return { complete: Object.values(missing).every((a) => !a.length), missing, stale };
};

// ---- state helpers ----------------------------------------------------------------------------------------------
const OVERLAP_FAIL = 4;   // samples (one every 5 frames) before arm-inside-object counts as a failure rather than a graze
const serious = (o) => Object.fromEntries(Object.entries(o).filter(([, n]) => n >= OVERLAP_FAIL));
const grazes = (o) => Object.fromEntries(Object.entries(o).filter(([, n]) => n < OVERLAP_FAIL));

T.state = () => {
  const b = B();
  return {
    activity: label(), pose: b.pose, last: b.last, held: b.held ? b.held.def.title : null, ballHeld: b.ballHeld, guitarHeld: b.gtr.held,
    albumOnTable: b.albumOnTable, music: b.music ? b.track : null, userMusic: !!b.userMusic, pending: b.pendingActivity,
    guy: [+G().pos.x.toFixed(2), +G().pos.z.toFixed(2)], errors: errors.length,
  };
};
const holdingNothing = () => { const b = B(); return !b.held && !b.ballHeld && !b.gtr.held && !b.albumOnTable; };
const seated = () => { const s = B().step; return !!(s && s.fx && (s.fx.sit || s.fx.chairSit)); };

// Put Guy in the middle of the room facing +z (tests start from the same place; this is a test-only teleport).
T.home = () => { G().root.position.set(0, 0, 2); G().root.rotation.y = 0; };

// Wrap up whatever Guy is doing: stand up, put everything away, stop his own music, then wander.
T.settle = (maxSec = 90) => {
  const b = B();
  b.skip();
  b.pendingActivity = 'wander';
  let t = 0;
  while (t < maxSec) {
    step(0.25); t += 0.25;
    if (holdingNothing() && !seated() && (!b.music || b.userMusic) && b.last === 'wander' && b.step) break;
  }
  return { ok: holdingNothing() && !seated() && (!b.music || b.userMusic), seconds: t };
};

// ---- room set-up through the real UI ----------------------------------------------------------------------------
const machine = () => document.getElementById('machine');
function machineClick(tab, title) {
  const m = machine();
  m.hidden = false;
  m.querySelector(`[data-tab=${tab}]`).click();
  const card = [...m.querySelectorAll('.card')].find((c) => c.querySelector('.title').textContent === title);
  const btn = card && card.querySelector('.act');
  if (btn) btn.click();
  m.hidden = true;
  return !!btn;
}
T.removeAll = () => {
  for (const name of Object.keys(W().objects)) {
    if (W().objects[name].removable === false) continue;
    W().removeObject(name); B().objectRemoved(name);
  }
  for (const name of Object.keys(W().decor)) { W().removeObject(name); B().objectRemoved(name); }
  if (!W().ballGone) { W().removeBall(); B().ballRemoved(); }
};
const isPresent = (id) => (id === 'ball' ? !W().ballGone : !!(W().objects[id] || W().decor[id]));
T.addObject = (id) => { // through the Skill Machine, like a user would
  const def = OBJECT_CATALOG.find((d) => d.id === id);
  if (isPresent(id)) return true;
  if (def.locked) return false;
  return machineClick('objects', def.name) && isPresent(id);
};
T.addBook = (id) => {
  const def = BOOK_CATALOG.find((b) => b.id === id);
  if (W().objects.shelf.books.some((r) => r.def.id === id)) return true;
  return !def.locked && machineClick('books', def.title) && W().objects.shelf.books.some((r) => r.def.id === id);
};
T.addAlbum = (id) => { // premium records are locked in the UI: the harness adds them directly (flagged as a dev bypass)
  const def = ALBUM_CATALOG.find((a) => a.id === id);
  const shelf = W().objects.shelf;
  if (shelf.albums.some((r) => r.def.id === id)) return { ok: true };
  if (!def.premium) return { ok: machineClick('records', def.title) && shelf.albums.some((r) => r.def.id === id) };
  shelf.addAlbum(def);
  return { ok: true, devBypass: true };
};
T.learn = (ids) => ids.forEach((id) => skillsOf().learn(id));
T.forget = () => skillsOf().known.clear();

// make sure an activity can run: objects present, skills learnt, music playing if it needs to
T.prep = (name) => {
  const m = MANIFEST.activities[name] || {};
  const done = [];
  for (const id of m.objects || []) if (T.addObject(id)) done.push(id);
  T.learn(m.skills || []);
  // dribbling and tossing need the ball clear of furniture (he kicks it free first in real play): put it in open floor
  if (['dribble', 'toss'].includes(name) && W().ball) { W().ball.position.x = 0.8; W().ball.position.z = 2.4; W().ball.userData.vel.set(0, 0, 0); }
  if (m.music && !B().music) B().stereoControl('play');
  if (!m.music && B().userMusic) B().stereoControl('stop');
  return done;
};

// ---- measuring --------------------------------------------------------------------------------------------------
const SPARSE = ['lamp', 'guitar'];
const CHAINS = [['LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandMiddle3'], ['RightArm', 'RightForeArm', 'RightHand', 'RightHandMiddle3']];
function sampleOverlaps(acc, touches) {
  const g = G(), THREE = window.THREE, b = B();
  const allowed = new Set(touches);
  if (b.step && b.step.push) allowed.add(b.step.push.obj.name);
  const pts = [];
  for (const c of CHAINS) {
    const P = c.map((n) => g.boneWorld(n));
    for (let i = 0; i < P.length - 1; i++) for (let k = 0; k <= 4; k++) pts.push(new THREE.Vector3().lerpVectors(P[i], P[i + 1], k / 4));
  }
  // the drum kit is mostly air: only a hand near a drum, a cymbal, the kick or the stool counts as being inside it
  const kit = W().objects.drums;
  if (kit) kit.group.updateWorldMatrix(true, false);
  const inKit = (p) => {
    const l = kit.group.worldToLocal(p.clone());
    return [...Object.values(kit.pads), { x: 0, y: 0.29, z: -0.42 }, { x: 0, y: 0.47, z: 0.42 }].some((q) => Math.hypot(l.x - q.x, l.y - q.y, l.z - q.z) < 0.26);
  };
  for (const o of W().obstacles) {
    if (allowed.has(o.name)) continue;
    // thin things (lamp pole, guitar stand) fill little of their bounding box: only count the middle column
    const sparse = SPARSE.includes(o.name), cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
    for (const p of pts) {
      if (!(p.x > o.x0 && p.x < o.x1 && p.z > o.z0 && p.z < o.z1 && p.y < o.h && p.y > 0.02)) continue;
      if (sparse && (Math.abs(p.x - cx) > 0.16 || Math.abs(p.z - cz) > 0.16)) continue;
      if (o.name === 'drums' && kit && !inKit(p)) continue;
      acc[o.name] = (acc[o.name] || 0) + 1;
      T.lastOverlap = { object: o.name, pose: B().pose, activity: B().last, label: label().slice(0, 50), guy: [+G().pos.x.toFixed(2), +G().pos.z.toFixed(2)], point: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], box: [o.x0, o.x1, o.z0, o.z1].map((v) => +v.toFixed(2)) };
      break;
    }
  }
}
T.feet = () => { const g = G(); const y = Math.min(...['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map((n) => g.boneWorld(n).y)); return +y.toFixed(3); };
T.hands = () => {
  const g = G(), r = g.root;
  const l = (n) => { const v = r.worldToLocal(g.boneWorld(n)); return [v.x, v.y, v.z].map((x) => +x.toFixed(2)); };
  return { L: { wrist: l('LeftHand'), tip: l('LeftHandMiddle3') }, R: { wrist: l('RightHand'), tip: l('RightHandMiddle3') } };
};

// ---- running an activity and judging it ---------------------------------------------------------------------------
// Runs `name` to completion. pass = finished, no exceptions, Guy's arms never inside objects they should not touch,
// nothing left in his hands, feet on the floor throughout.
T.run = (name, { max = 150, prep = true } = {}) => {
  const b = B();
  if (prep) T.prep(name);
  T.settle(); T.home();
  const base = errors.length;
  const rep = { name, seconds: 0, poses: new Set(), labels: [], overlaps: {}, completed: false, minFeet: 9, maxFeet: -9 };
  const touches = (MANIFEST.activities[name] || {}).touches || [];
  b.queue = []; b.step = null; b.choose(name);
  let frames = 0;
  while (rep.seconds < max) {
    step(1 / 30); rep.seconds += 1 / 30; frames++;
    if (b.step) rep.poses.add(b.pose);
    const l = label();
    if (rep.labels[rep.labels.length - 1] !== l) rep.labels.push(l.slice(0, 70));
    if (frames % 5 === 0) { sampleOverlaps(rep.overlaps, touches); const f = T.feet(); rep.minFeet = Math.min(rep.minFeet, f); }
    if (b.last !== name && frames > 30) { rep.completed = true; break; }
  }
  rep.poses = [...rep.poses];
  rep.seconds = +rep.seconds.toFixed(1);
  rep.errors = errors.slice(base);
  if (b.userMusic) b.stereoControl('stop');
  const s = T.settle();
  rep.idleAfter = s.ok;
  rep.warnings = grazes(rep.overlaps);
  rep.pass = rep.completed && !rep.errors.length && !Object.keys(serious(rep.overlaps)).length && rep.idleAfter && rep.minFeet > -0.05;
  return rep;
};

// Ask Guy to interact with an object exactly like the long-press menu does, and follow it through.
T.interact = (name, { max = 150, partial = false } = {}) => {
  const b = B();
  T.settle(); T.home();
  const base = errors.length;
  const r = b.interact(name);
  if (!r.ok) return { name, refused: r.message, pass: true };
  const act = b.pendingActivity;
  let t = 0, started = false;
  const rep = { name, activity: act, labels: [], overlaps: {} };
  const touches = (MANIFEST.activities[act] || {}).touches || [];
  while (t < max) {
    step(1 / 30); t += 1 / 30;
    if (b.last === act) started = true;
    const l = label();
    if (rep.labels[rep.labels.length - 1] !== l) rep.labels.push(l.slice(0, 70));
    if (Math.round(t * 30) % 5 === 0) sampleOverlaps(rep.overlaps, touches);
    if (started && b.last !== act) break;
  }
  rep.completed = started && b.last !== act;
  rep.started = started;
  rep.errors = errors.slice(base);
  if (b.userMusic) b.stereoControl('stop');          // music the harness started for this test
  rep.idleAfter = T.settle().ok;
  rep.warnings = grazes(rep.overlaps);
  rep.pass = (partial ? started : rep.completed) && !rep.errors.length && !Object.keys(serious(rep.overlaps)).length && rep.idleAfter;
  return rep;
};

// ---- the sweeps -------------------------------------------------------------------------------------------------
// 1. Add the objects one at a time (Skill Machine UI), check placement, interact before and after he has the skill.
T.sweepObjects = () => {
  T.removeAll();
  T.forget();
  const out = [];
  for (const def of OBJECT_CATALOG) {
    const m = MANIFEST.objects[def.id] || {};
    if (def.locked) { out.push(result(def.id, true, { skipped: 'locked (premium): listed, cannot be added' })); continue; }
    if (m.decor) { // the rug, windows and picture: nothing to interact with; just check they come back and sit on their wall/floor
      const added = T.addObject(def.id);
      const d = W().decor[def.id];
      out.push(result(def.id, added && !!d && d.group.parent === W().room && W().decorFits(d, d.u, d.v), { added, decor: true }));
      continue;
    }
    const added = T.addObject(def.id);
    const o = def.id === 'ball' ? null : W().objects[def.id];
    const fits = o ? W().fits(o, o.x, o.z) : true;
    const gdist = o ? Math.hypot(G().pos.x - o.x, G().pos.z - o.z) : 9;
    T.forget();                                  // he may have read the new book by himself while idle: start from no skills
    const before = T.interact(def.id);          // with the skills he has so far
    T.learn(m.skills || []);
    const after = T.interact(def.id);           // with this object's skills learnt
    out.push(result(def.id, added && fits && gdist > 0.35 && before.pass && after.pass, {
      added, fits, beforeSkill: before.refused ? 'refused: ' + before.refused : before.labels && before.labels[0],
      afterSkill: after.refused ? 'REFUSED: ' + after.refused : after.labels && after.labels[0],
      errors: [...(before.errors || []), ...(after.errors || [])], overlaps: { ...before.overlaps, ...after.overlaps },
    }));
  }
  return out;
};

// 2. Every activity, prepared and run to completion.
// ---- pose sanity: what the overlap check cannot see ------------------------------------------------------------------
// Samples every few frames of an activity and records, per pose and arm: how far the hand is behind his body (root frame),
// how far the wrist is bent from its rest angle, and (where the game knows the intended wrist position) how far the hand is from it.
const sideName = { L: 'Left', R: 'Right' };
T.poseStats = (name, max = 150) => {
  const b = B(), g = G();
  T.prep(name); T.settle(); T.home();
  b.queue = []; b.step = null; b.choose(name);
  const stats = {};
  let t = 0, frames = 0;
  while (t < max) {
    step(1 / 30); t += 1 / 30; frames++;
    if (b.last !== name && frames > 30) break;
    if (frames % 2 || !b.step) continue;
    const pose = b.pose, ctx = b.lastCtx || {};
    for (const side of ['Left', 'Right']) {
      const st = (stats[pose] ||= { behind: -9, wrist: 0, err: 0, n: 0, errs: [] });
      const hand = g.root.worldToLocal(g.boneWorld(`${side}Hand`));
      st.behind = Math.max(st.behind, -hand.z);
      // wrist bend: angle between the forearm (elbow -> wrist) and the hand (wrist -> knuckle), degrees; 0 = straight
      const fa = g.boneWorld(`${side}ForeArm`), wr = g.boneWorld(`${side}Hand`), kn = g.boneWorld(`${side}HandMiddle1`);
      st.wrist = Math.max(st.wrist, Math.acos(Math.max(-1, Math.min(1, wr.clone().sub(fa).normalize().dot(kn.clone().sub(wr).normalize())))) * 57.3);
      st.n++;
      // intended wrist position, where the game computed one
      const k = side === 'Left' ? 'L' : 'R';
      let want = null, w = 0;
      if (ctx.hob && ctx.hob[k] && ctx.hob[k].wrist) { want = ctx.hob[k].wrist; w = ctx.hob[k].w ?? ctx.hob.w ?? 1; }
      else if (ctx.guitar && ctx.guitar[k] && ctx.guitar['w' + k] > 0.95) { want = ctx.guitar[k]; w = 1; }
      if (want && w > 0.95) st.errs.push(g.boneWorld(`${side}Hand`).distanceTo(want));
    }
  }
  if (b.userMusic) b.stereoControl('stop');
  T.settle();
  for (const s of Object.values(stats)) {            // hand-to-intended-position error: 90th percentile (the arm lags a moving target briefly)
    s.errs.sort((a, c) => a - c);
    s.err = s.errs.length ? s.errs[Math.floor(s.errs.length * 0.9)] : 0;
    delete s.errs;
    for (const k of ['behind', 'wrist', 'err']) s[k] = +s[k].toFixed(k === 'wrist' ? 0 : 2);
  }
  return stats;
};

// Limits for the pose-sanity sweep. `behind`: m behind his body (a hand reaching a world point behind him once measured 0.53;
// walking and waltzing peak at ~0.35). `wrist`: degrees of wrist bend (a real wrist manages ~90). `err`: m between the hand and the
// wrist position the game asked for (90th percentile; drum, brush and guitar poses expose one).
export const POSE_LIMITS = { behind: 0.45, wrist: 100, err: 0.32 };
T.sweepPoses = () => {
  const out = [];
  for (const [name, m] of Object.entries(MANIFEST.activities)) {
    if (m.alias || m.internal) continue;
    const stats = T.poseStats(name);
    const bad = [];
    for (const [pose, s] of Object.entries(stats)) {
      for (const k of Object.keys(POSE_LIMITS)) if (s[k] > POSE_LIMITS[k]) bad.push(`${pose}: ${k} ${s[k]} > ${POSE_LIMITS[k]}`);
    }
    out.push(result(name, !bad.length, { bad, poses: Object.keys(stats) }));
  }
  return out;
};

T.sweepActivities = () => {
  const out = [];
  for (const name of Object.keys(MANIFEST.activities)) {
    const m = MANIFEST.activities[name];
    if (m.alias || m.internal) continue;
    out.push(T.run(name));
  }
  return out;
};

// 3. Every track: select it, check tempo, join in on piano and guitar, stop.
T.sweepTracks = () => {
  T.addObject('table'); T.addObject('piano'); T.addObject('bench'); T.addObject('guitar'); T.learn(['stereo', 'piano', 'guitar']);
  for (const a of ALBUM_CATALOG) T.addAlbum(a.id);
  const out = [];
  for (const id of MANIFEST.tracks) {
    T.settle();
    const base = errors.length;
    const b = B();
    b.stereoControl('select', id);
    const tr = TRACKS[id];
    const tempoOk = Math.abs(60 / b.beatLen - tr.bpm) < 0.5 && b.track === id;
    const piano = T.interact('piano', { max: 25, partial: true });
    b.stereoControl('select', id);
    const guitar = T.interact('guitar', { max: 25, partial: true });
    b.stereoControl('stop');
    out.push(result(`track:${id}`, tempoOk && piano.pass && guitar.pass && errors.length === base, {
      tempoOk, pianoJoined: piano.labels && piano.labels[0], guitarJoined: guitar.labels && guitar.labels[0], errors: errors.slice(base),
    }));
  }
  return out;
};

// 4. Every book: add it to the shelf (UI), make him read it, check he learned the skill and can use it.
T.sweepBooks = () => {
  const out = [];
  T.addObject('table'); T.addObject('piano'); T.addObject('bench'); T.addObject('guitar'); T.addObject('lamp');
  for (const def of BOOK_CATALOG) {
    if (def.locked) { out.push(result(`book:${def.id}`, true, { skipped: 'locked (premium)' })); continue; }
    if (def.requires && def.requires.object) T.addObject(def.requires.object);
    const added = T.addBook(def.id);
    skillsOf().known.delete(def.teaches);
    T.settle();
    const base = errors.length;
    const b = B();
    const rec = W().objects.shelf.books.find((r) => r.def.id === def.id);
    const [lbl, ...steps] = b.readSteps(rec);
    b.ui(lbl); b.queue = steps; b.step = null; b.last = 'read';
    let t = 0;
    const trail = [lbl];
    while (t < 200 && !skillsOf().has(def.teaches)) { step(0.5); t += 0.5; const l = label(); if (trail[trail.length - 1] !== l) trail.push(l.slice(0, 60)); }
    const learned = skillsOf().has(def.teaches);
    const where = learned ? null : T.state();
    T.settle();
    const then = MANIFEST.books[def.id] && MANIFEST.books[def.id].then;
    const use = then ? T.run(then) : null;
    out.push(result(`book:${def.id}`, added && learned && (!use || use.pass) && errors.length === base, {
      added, learned, seconds: t, trail: learned ? undefined : trail, stateWhenStuck: where, then, usedOk: use ? use.pass : null, useDetail: use && !use.pass ? { completed: use.completed, overlaps: use.overlaps, errors: use.errors, idleAfter: use.idleAfter } : null, errors: errors.slice(base),
    }));
  }
  return out;
};

// 5. Every record: fetch it, play it, return it.
T.sweepRecords = () => {
  T.addObject('table'); T.learn(['stereo']);
  if (B().music) B().stereoControl('stop');
  const out = [];
  for (const a of ALBUM_CATALOG) {
    const add = T.addAlbum(a.id);
    const rec = W().objects.shelf.albums.find((r) => r.def.id === a.id);
    T.settle();
    const base = errors.length;
    const b = B();
    b.forceAlbum = a.id;
    let sawOnTable = false, sawTrack = null, sawHeld = false;
    b.queue = []; b.step = null; b.choose('dance');
    let t = 0;
    while (t < 240 && !(b.last !== 'dance' && t > 1)) {
      step(0.1); t += 0.1;
      if (b.albumOnTable) sawOnTable = true;
      if (b.held && b.held.def.id === a.id) sawHeld = true;
      if (b.music) sawTrack = b.track;
    }
    const idle = T.settle().ok;
    out.push(result(`record:${a.id}`, add.ok && sawHeld && sawOnTable && a.tracks.includes(sawTrack) && rec.mesh.visible && !b.music && idle && errors.length === base, {
      premiumDevBypass: !!add.devBypass, fetched: sawHeld, onTable: sawOnTable, trackPlayed: sawTrack, returnedToShelf: rec.mesh.visible, errors: errors.slice(base),
    }));
  }
  return out;
};

// 5b. The playlist: every record has several songs with titles of their own, the stereo list shows them all, next / previous /
// pick work, a track hands over to the next song on the same record after its minute, and Guy does not play the same song
// (or the same record) twice in a row.
T.sweepPlaylist = () => {
  const out = [], b = B();
  T.addObject('table'); T.learn(['stereo']);
  for (const a of ALBUM_CATALOG) T.addAlbum(a.id);
  if (b.music) b.stereoControl('stop');
  const labels = Object.entries(TRACKS).filter(([id]) => id !== 'default').map(([, t]) => t.label);
  out.push(result('playlist: every record has at least 3 playable songs', ALBUM_CATALOG.every((a) => a.tracks.length >= 3 && a.tracks.every((id) => TRACKS[id] && TRACKS[id].step)),
    { short: ALBUM_CATALOG.filter((a) => a.tracks.length < 3).map((a) => a.id) }));
  out.push(result('playlist: every song has its own title', new Set(labels).size === labels.length && labels.every(Boolean), { songs: labels.length, unique: new Set(labels).size }));
  const list = b.trackList();
  out.push(result('playlist: the stereo lists every song on the shelf', list.length === 1 + ALBUM_CATALOG.reduce((n, a) => n + a.tracks.length, 0), { listed: list.length }));
  // next / previous / pick
  b.stereoControl('stop'); b.trackIndex = 0;
  b.stereoControl('select', 'rock'); step(0.5);
  const startedOn = b.track;
  b.stereoControl('next'); step(0.5);
  const afterNext = b.track;
  b.stereoControl('prev'); step(0.5);
  const afterPrev = b.track;
  b.stereoControl('select', 'jazz3'); step(0.5);
  out.push(result('playlist: select, next and previous change the song', startedOn === 'rock' && afterNext === 'rock2' && afterPrev === 'rock' && b.track === 'jazz3' && b.userMusic, { startedOn, afterNext, afterPrev, now: b.track }));
  // auto-advance: a track hands over to the next one on its record, in order, and wraps round
  T.settle(); T.home();
  b.stereoControl('select', 'rock');
  b.queue = []; b.step = b.play('idle', 1e9); b.step.t = 0;            // keep him standing still so only the stereo is being tested
  const seen = [b.track];
  for (let k = 0; k < 5; k++) { step(trackSeconds(TRACKS[b.track]) + 1); if (seen[seen.length - 1] !== b.track) seen.push(b.track); }
  out.push(result('playlist: a track hands over to the next song on its record', seen.slice(0, 5).join(',') === 'rock,rock2,rock3,rock4,rock' && b.userMusic, { seen, userMusicKept: b.userMusic }));
  b.stereoControl('stop'); b.step = null; b.queue = [];
  // Guy: the same record forced again and again must not repeat its song; the record he plays should change too when he can
  const songs = [], albums = [];
  for (let k = 0; k < 8; k++) {
    T.settle(); T.home(); b.queue = []; b.step = null; b.pendingActivity = null;
    b.forceAlbum = 'party'; b.choose('dance');
    let t = 0; while (t < 60 && !b.music) { step(0.25); t += 0.25; }
    songs.push(b.track);
    T.settle(120);
  }
  const repeats = songs.filter((s, i) => i && s === songs[i - 1]).length;
  out.push(result('playlist: Guy does not play the same song twice in a row from a record', repeats === 0 && new Set(songs).size >= 3, { songs, repeats }));
  for (let k = 0; k < 12; k++) {
    T.settle(); T.home(); b.queue = []; b.step = null; b.pendingActivity = null;
    b.choose('dance');
    let t = 0; while (t < 60 && !b.music) { step(0.25); t += 0.25; }
    albums.push(b.albumOf(b.track) ? b.albumOf(b.track).id : 'none');
    T.settle(120);
  }
  const recordRepeats = albums.filter((s, i) => i && s === albums[i - 1] && s !== 'none').length;
  out.push(result('playlist: Guy picks different records from session to session', recordRepeats === 0 && new Set(albums).size >= 3, { albums, recordRepeats }));
  out.push(result('playlist: no errors', true, { errors: errors.length }));
  return out;
};

// 6. Several objects at once.
T.combos = () => {
  const out = [];
  const setup = () => { for (const id of ['piano', 'bench', 'table', 'guitar', 'lamp']) T.addObject(id); T.learn(['stereo', 'piano', 'guitar', 'lighting', 'ball']); T.settle(); };
  const timed = (fn) => { const base = errors.length; const r = fn(); return { ...r, errors: errors.slice(base) }; };

  setup(); // stereo playing, then told to use an instrument
  out.push(result('stereo + piano (play along)', ...(() => { const r = timed(() => { B().stereoControl('play'); const x = T.interact('piano', { max: 30, partial: true }); B().stereoControl('stop'); return x; }); return [r.pass && /along/.test((r.labels || []).join(' ')) && !r.errors.length, { labels: r.labels }]; })()));
  out.push(result('stereo + guitar (play along, in time)', ...(() => { const r = timed(() => { B().stereoControl('play'); T.settle(); B().stereoControl('play'); const x = T.interact('guitar', { max: 30, partial: true }); B().stereoControl('stop'); return x; }); return [r.pass && /along/.test((r.labels || []).join(' ')), { labels: r.labels }]; })()));
  out.push(result('stereo + dance (joins the music)', ...(() => { const r = timed(() => { B().stereoControl('play'); const x = T.interact('table', { max: 90 }); B().stereoControl('stop'); return x; }); return [r.pass, { labels: r.labels }]; })()));
  // stopping the music ends what he was playing along to
  out.push(result('stop music mid-song ends the play-along', ...(() => {
    const r = timed(() => {
      T.settle(); B().stereoControl('play'); B().interact('guitar');
      let t = 0; while (t < 40 && !(B().pose === 'guitar' && B().step && B().step.t > 3)) { step(0.1); t += 0.1; }
      B().stereoControl('stop'); const settled = T.settle(45).ok;
      return { settled, gtrHeld: B().gtr.held };
    });
    return [r.settled && !r.gtrHeld && !r.errors.length, r];
  })()));
  // lamp party: lighting + stereo -> the lamp goes into party mode and comes back
  out.push(result('lamp party during a dance', ...(() => {
    const r = timed(() => {
      T.settle(); let party = false; const b = B(); b.queue = []; b.step = null; b.choose('dance');
      let t = 0; while (t < 240 && !(b.last !== 'dance' && t > 1)) { step(0.2); t += 0.2; if (W().lamp.mode === 'party') party = true; }
      T.settle(); return { party, lampBack: W().lamp.mode === 'normal' };
    });
    return [r.party && r.lampBack && !r.errors.length, r];
  })()));
  // user-started music is left alone by Guy when he is told to do something else
  out.push(result('user music survives skip()', ...(() => {
    const r = timed(() => { T.settle(); B().stereoControl('play'); B().skip(); step(20); const still = !!B().music; B().stereoControl('stop'); return { still }; });
    return [r.still && !r.errors.length, r];
  })()));
  return out;
};

// 7. Interrupt every activity part-way through; he must tidy up and end idle.
T.sweepInterrupts = () => {
  const out = [];
  for (const name of Object.keys(MANIFEST.activities)) {
    const m = MANIFEST.activities[name];
    if (m.alias || m.internal) continue;
    T.prep(name); T.settle();
    const base = errors.length;
    const b = B();
    b.queue = []; b.step = null; b.choose(name);
    step(3 + Math.random() * 12);
    b.skip();
    const idle = T.settle().ok;
    out.push(result(`interrupt:${name}`, idle && errors.length === base, { idle, errors: errors.slice(base) }));
  }
  return out;
};

// 8. Remove each object a running activity depends on, part-way through. No exception, he recovers, object comes back.
// 7b. Carrying things: asking for another book while he is reading one must make him put the first back and then read the
// new one, doing nothing else in between, even if the "record by the stereo" flag is stuck on. Stopping the stereo from the
// player part-way through a record session must also end with the record back on the shelf and the flag cleared.
T.sweepHolding = () => {
  const out = [], b = B(), shelfBooks = () => W().objects.shelf.books.filter((x) => x.mesh.visible);
  const okLabel = (l) => /wrapping up|putting the book back|putting the record back|reading/.test(l);
  const readThenAsk = (stuck) => {
    T.settle(); T.home(); b.queue = []; b.step = null; b.pendingActivity = null; b.forceBook = null; b.albumOnTable = false;
    b.choose('read');
    let t = 0;
    while (t < 120 && !(b.step && b.step.fx && b.step.fx.chairSit && b.step.t > 6)) { step(0.25); t += 0.25; }
    const cur = b.held && b.held.def.id;
    if (stuck) b.albumOnTable = true;
    const target = shelfBooks().find((x) => x.def.id !== cur);
    const base = errors.length;
    b.requestRead(target.def.id);
    const wrong = []; let readTarget = false, e = 0;
    while (e < 100) {
      step(0.25); e += 0.25;
      const l = label();
      // a record in his hand during a normal stereo session is fine; a book in his hand during anything else is the bug
      if (b.held && b.held.kind !== 'album' && b.held.def.id !== target.def.id && !okLabel(l)) wrong.push([+e.toFixed(1), l.slice(0, 40)]);
      if (b.held && b.held.def.id === target.def.id) readTarget = true;
      if (readTarget && !b.held) break;                // he has read it and put it back: after that he may do as he likes
    }
    return { cur, target: target.def.id, wrong: wrong.slice(0, 3), readTarget, errors: errors.slice(base) };
  };
  for (const stuck of [false, true]) {
    const r = readThenAsk(stuck);
    out.push(result(`holding: ask for another book while reading${stuck ? ' (record flag stuck on)' : ''}`, !r.wrong.length && r.readTarget && !r.errors.length, r));
  }
  // stop the stereo from the player while he has a record out
  T.addObject('table'); T.learn(['stereo']); T.addAlbum('rock');
  T.settle(); T.home(); b.queue = []; b.step = null; b.pendingActivity = null; b.forceAlbum = 'rock'; b.choose('dance');
  let t = 0; while (t < 90 && !(b.music && b.albumOnTable)) { step(0.25); t += 0.25; }
  const had = !!b.held && b.held.kind === 'album';
  b.stereoControl('stop');
  const settled = T.settle(120);
  const rec = W().objects.shelf.albums.find((r) => r.def.id === 'rock');
  out.push(result('holding: stop the stereo while a record is out', had && settled.ok && !b.held && !b.albumOnTable && rec.mesh.visible, { had, settled: settled.ok, held: !!b.held, flag: b.albumOnTable, backOnShelf: rec.mesh.visible }));
  return out;
};

T.sweepRemovals = () => {
  const out = [];
  for (const name of Object.keys(MANIFEST.activities)) {
    const m = MANIFEST.activities[name];
    if (m.alias || m.internal || !(m.objects || []).length) continue;
    for (const id of m.objects) {
      if (W().objects[id] && W().objects[id].removable === false) continue;
      T.prep(name); T.settle();
      const base = errors.length;
      const b = B();
      b.queue = []; b.step = null; b.choose(name);
      step(4 + Math.random() * 6);
      if (W().objects[id]) { W().removeObject(id); b.objectRemoved(id); }
      step(25);
      const idle = T.settle(40).ok;
      T.addObject(id);
      out.push(result(`remove:${id} during ${name}`, errors.length === base && idle, { idle, errors: errors.slice(base) }));
    }
  }
  return out;
};

// 8. Decor (rug, windows, picture): remove each through the Skill Machine's Remove button, check it is really gone and offered
// as "Put back", put it back, and check the wall pieces keep to their wall and out of each other's and the machine's way.
const machineCard = (title) => [...machine().querySelectorAll('.card')].find((c) => c.querySelector('.title').textContent === title);
const openObjects = (cat = 'all') => {
  const m = machine();
  m.hidden = false;
  m.querySelector('[data-tab=objects]').click();
  const chip = m.querySelector(`.chip[data-cat=${cat}]`);
  if (chip) chip.click();
  return m;
};
T.sweepDecor = () => {
  const out = [];
  for (const def of OBJECT_CATALOG.filter((d) => d.decor)) {
    const id = def.id, base = errors.length;
    T.addObject(id);                                    // make sure it is in the room first (window2 starts out of it)
    const d0 = W().decor[id];
    const placed = !!d0 && d0.group.parent === W().room && W().decorFits(d0, d0.u, d0.v);
    openObjects();
    const rm = machineCard(def.name) && machineCard(def.name).querySelector('.act.rm');
    if (rm) rm.click();
    step(3);
    const gone = !W().decor[id] && !!W().removed[id] && !W().room.children.includes(d0.group);
    openObjects();
    const put = machineCard(def.name) && machineCard(def.name).querySelector('.act');
    const offered = !!put && put.textContent === 'Put back';
    if (put) put.click();
    machine().hidden = true;
    step(3);
    const back = !!W().decor[id] && W().decor[id].group.parent === W().room && W().decorFits(W().decor[id], W().decor[id].u, W().decor[id].v);
    out.push(result(`decor:${id}`, placed && !!rm && gone && offered && back && errors.length === base, { placed, hadRemoveButton: !!rm, gone, offeredPutBack: offered, back, errors: errors.slice(base) }));
  }
  // wall limits: a window may not be dragged over the Skill Machine, the other window, or below a piano standing against its wall
  const w = W();
  T.addObject('window2'); T.addObject('picture'); T.addObject('window'); T.addObject('piano');
  const win = w.decor.window, pic = w.decor.picture, win2 = w.decor.window2, piano = w.objects.piano;
  out.push(result('decor:window keeps off the Skill Machine', !!win && !w.decorFits(win, -2.3, 1.5) && w.decorFits(win, win.u, win.v)));
  out.push(result('decor:window stays on its wall', !!win && !w.decorFits(win, 4.5, 1.8) && !w.decorFits(win, 0, 3.4)));
  out.push(result('decor:two windows and the picture do not overlap', !!win2 && !!pic && !w.decorFits(win2, pic.u, pic.v) && w.decorFits(win2, win2.u, win2.v)));
  // a rectangular rug turns a quarter, a round one does not; the wall light glows with the floor lamp
  T.addObject('rug2'); T.addObject('rug3'); T.addObject('rug'); T.addObject('sconce'); T.addObject('lamp');
  const r2 = w.decor.rug2, r1 = w.decor.rug;
  if (r2) { r2.rot = 0; r2.set(r2.home.u, r2.home.v); }          // start from the rug as it was first laid, whatever an earlier run did
  const ex0 = r2 && r2.ex;
  out.push(result('decor:woven rug turns a quarter, round rug does not', !!r2 && r2.turn(1) && r2.ex === r2.hz && ex0 === r2.hx && !!r1 && r1.turn(1) === false));
  if (r2) { r2.rot = 0; r2.set(r2.home.u, r2.home.v); }
  const sc = w.decor.sconce, glow = sc && sc.group.children.find((c) => c.material && c.material.blending === 2);
  const lamp = w.lamp;
  lamp.set(true); const onOp = glow && glow.material.opacity;
  lamp.set(false); const offOp = glow && glow.material.opacity;
  lamp.set(true);
  out.push(result('decor:wall light glows with the lamp', !!glow && onOp > 0.3 && offOp === 0, { onOp, offOp }));
  // a tall piece of furniture (the tree, 2.4 m) cannot stand against the back wall under the picture; with the picture taken down it can
  T.addObject('tree');
  const tree = w.objects.tree;
  tree.rot = 0; tree.set(tree.x, tree.z);
  // (find a stretch of the back wall where the tree fits when the picture is down, whatever else the room holds, and hang the picture there)
  w.removeObject('picture');
  const free = [];
  for (let u = -4.0; u <= 4.0; u += 0.25) if (tree && w.fits(tree, u, -3.55, tree.w, tree.d)) free.push(u);
  w.restoreObject('picture');
  const p2 = w.decor.picture;
  let tested = null;
  for (const u of free) {
    if (p2 && w.decorFits(p2, u, p2.v)) { p2.set(u, p2.v); tested = { u, treeFitsUnderIt: w.fits(tree, u, -3.55, tree.w, tree.d) }; break; }
  }
  out.push(result('decor:furniture cannot be pushed into a wall piece', !!tree && !!p2 && (!tested || !tested.treeFitsUnderIt), { freeStretches: free.length, tested, note: tested ? undefined : 'no free stretch of back wall to test in this layout' }));
  return out;
};

// 9. The Skill Machine's Objects tab: category chips, one section per category, counts that match the room.
T.sweepMachine = () => {
  const out = [];
  const cats = [...new Set(OBJECT_CATALOG.map((d) => d.cat))];
  out.push(result('machine: every object has a category', OBJECT_CATALOG.every((d) => d.cat), { uncategorised: OBJECT_CATALOG.filter((d) => !d.cat).map((d) => d.id) }));
  let m = openObjects('all');
  const titles = () => [...m.querySelectorAll('.card .title')].map((e) => e.textContent);
  out.push(result('machine: All shows every object once', titles().length === OBJECT_CATALOG.length && new Set(titles()).size === OBJECT_CATALOG.length, { shown: titles().length, catalog: OBJECT_CATALOG.length }));
  for (const c of cats) {
    m = openObjects(c);
    const want = OBJECT_CATALOG.filter((d) => d.cat === c).map((d) => d.name).sort();
    const got = titles().sort();
    const heads = [...m.querySelectorAll('h4')].length;
    out.push(result(`machine: filter ${c}`, JSON.stringify(want) === JSON.stringify(got) && heads === 1, { want, got, headings: heads }));
  }
  m = openObjects('all');
  const chipCounts = [...m.querySelectorAll('.chip')].map((c) => c.textContent.trim());
  const inRoomNow = OBJECT_CATALOG.filter((d) => isPresent(d.id) && !d.locked).length;
  out.push(result('machine: the All chip counts what is in the room', chipCounts[0] === `All ${inRoomNow}/${OBJECT_CATALOG.length}`, { chip: chipCounts[0], inRoomNow }));
  const shelfCard = machineCard('Bookshelf');
  out.push(result('machine: the bookshelf cannot be removed', !!shelfCard && !shelfCard.querySelector('.act')));
  openObjects('all'); machine().hidden = true;
  return out;
};

// ---- visual checkpoints -----------------------------------------------------------------------------------------
// Freeze Guy in a pose and put the camera somewhere useful. Take a screenshot afterwards (wait ~2 s: the pane renders lazily).
let frozen = null;
T.unfreeze = () => { if (frozen) { B().update = frozen; frozen = null; } };
T.freeze = () => { if (!frozen) { frozen = B().update; B().update = () => {}; } };
T.look = (view = 'front', dist = 2.1) => {
  const g = G(), THREE = window.THREE, r = g.root;
  window.controls.dispatchEvent({ type: 'start' });             // stops the auto-framing taking the camera back
  window.scene.updateMatrixWorld(true);
  const fw = new THREE.Vector3(Math.sin(r.rotation.y), 0, Math.cos(r.rotation.y)), lf = new THREE.Vector3(Math.cos(r.rotation.y), 0, -Math.sin(r.rotation.y));
  const p = g.pos;
  let pos, target = new THREE.Vector3(p.x, 1.0, p.z);
  if (view === 'front') pos = new THREE.Vector3(p.x, 1.35, p.z).addScaledVector(fw, dist).addScaledVector(lf, 0.5);
  else if (view === 'side') pos = new THREE.Vector3(p.x, 1.2, p.z).addScaledVector(lf, -dist);
  else if (view === 'back') pos = new THREE.Vector3(p.x, 1.6, p.z).addScaledVector(fw, -dist);
  else if (view === 'top') { pos = new THREE.Vector3(p.x, 3.4, p.z + 0.6); }
  else if (view.startsWith('hand:')) { const h = g.boneWorld(view.slice(5) + 'Hand'); target = h.clone(); pos = h.clone().addScaledVector(fw, 0.9).addScaledVector(lf, view.endsWith('Right') ? -0.35 : 0.35).add(new THREE.Vector3(0, 0.15, 0)); }
  window.camera.position.copy(pos); window.controls.target.copy(target); window.controls.update();
  return { view };
};
// Run an activity until Guy reaches (pose, t), freeze and frame him. `opts.turning` waits for a page turn.
T.moment = (activity, pose, t = 0, view = 'front', opts = {}) => {
  T.unfreeze(); T.prep(activity); T.settle();
  const b = B();
  if (opts.album) b.forceAlbum = (W().objects.shelf.albums[0] || { def: {} }).def.id;
  b.queue = []; b.step = null; b.choose(activity);
  let guard = 0;
  const ok = () => b.step && b.pose === pose && b.step.t >= t && (!opts.turning || (b.read && b.read.turning && b.read.turnT > 0.8)) && (!opts.push || b.step.push);
  while (!ok() && guard++ < 40000) step(1 / 30);
  T.freeze(); T.look(view);
  return { reached: guard < 40000, state: T.state(), hands: T.hands() };
};
T.visualChecklist = () => MANIFEST.visual;

// ---- everything ---------------------------------------------------------------------------------------------------
const summarise = (list) => ({ total: list.length, passed: list.filter((r) => r.pass).length, failed: list.filter((r) => !r.pass) });
T.summarise = summarise;
T.runAll = () => {
  const report = { coverage: T.coverage() };
  report.objects = summarise(T.sweepObjects());
  report.activities = summarise(T.sweepActivities());
  report.poses = summarise(T.sweepPoses());
  report.tracks = summarise(T.sweepTracks());
  report.books = summarise(T.sweepBooks());
  report.records = summarise(T.sweepRecords());
  report.playlist = summarise(T.sweepPlaylist());
  report.combos = summarise(T.combos());
  report.interrupts = summarise(T.sweepInterrupts());
  report.removals = summarise(T.sweepRemovals());
  report.holding = summarise(T.sweepHolding());
  report.decor = summarise(T.sweepDecor());
  report.machine = summarise(T.sweepMachine());
  report.errorsLogged = errors.length;
  return report;
};
window.guyTest = T;
