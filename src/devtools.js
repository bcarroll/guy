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
import { ROOM_CATALOG } from './rooms.js';
import { initLayout } from './layout.js';
import { RECIPES as RECIPES_DEF } from './workshop.js';
import { DISHES } from './restobjects.js';
import { invent, judge, GOOD, STEPS as RIFF_STEPS, keepRiff, loadRiffs, nextRiff, riffAt, forgetMemoryRiffs } from './riffs.js';
import { ALBUM_CATALOG } from './albums.js';
import { TRACKS, trackSeconds } from './audio.js';
import { POSES } from './brain.js';
import { counts as sfxCounts } from './sfx.js';

// ---------------------------------------------------------------------------------------------------------------
// MANIFEST: what the test knows about each asset. Keep in sync with the game (T.coverage() tells you what is missing).
// ---------------------------------------------------------------------------------------------------------------
export const MANIFEST = {
  // interact: the name passed to brain.interact (what the long-press "Interact" button does)
  objects: {
    piano: { skills: ['piano'] }, bench: { skills: ['piano'] }, table: { skills: ['stereo'] }, shelf: { skills: [], fixed: true },
    lamp: { skills: ['lighting'] }, armchair: { skills: [] }, armchair2: { skills: [] }, chair: { skills: [] }, chair2: { skills: [] }, plant: { skills: [] }, ball: { skills: ['ball'] }, guitar: { skills: ['guitar'] },
    drums: { skills: ['drums'] }, easel: { skills: ['easel'] }, telescope: { skills: ['telescope'] },
    // decor (world.decor): no interaction; tested by sweepDecor (remove / put back through the Catalogue, wall limits)
    rug: { decor: true }, picture: { decor: true, wall: 'back' }, window: { decor: true, wall: 'left' }, window2: { decor: true, wall: 'back', startsOut: true },
    art_mountains: { decor: true, wall: 'left', startsOut: true }, art_abstract: { decor: true, wall: 'back', startsOut: true }, art_moon: { decor: true, wall: 'left', startsOut: true },
    sconce: { decor: true, wall: 'back', startsOut: true }, rug2: { decor: true, startsOut: true }, rug3: { decor: true, startsOut: true },
    // decor furniture and plants (real objects): the plants are tended, the tables are only furniture
    flowerplant: { skills: [] }, tree: { skills: [] }, coffeetable: { skills: [] }, nightstand: { skills: [] },
    // the Workshop (a room added from the Rooms tab: T.addObject adds it first) and what Guy builds there (counted in storage, added one at a time)
    workbench: { room: 'workshop', skills: ['workshop'] }, toolbox: { room: 'workshop', skills: ['workshop'] }, mallet: { room: 'workshop', skills: ['workshop'] },
    woodfactory: { room: 'workshop', skills: ['workshop.materials'] }, saw: { room: 'workshop', skills: ['workshop.materials'] }, sander: { room: 'workshop', skills: ['workshop.materials'] },
    footstool: { room: 'workshop', built: true }, woodshelves: { room: 'workshop', built: true }, builtchair: { room: 'workshop', built: true },
    // the Restaurant (another added room): the kitchen and the dining room
    stove: { room: 'restaurant', skills: ['restaurant'] }, kitchencounter: { room: 'restaurant', skills: ['restaurant'] }, register: { room: 'restaurant', skills: ['restaurant'] },
    diningtable: { room: 'restaurant', skills: ['restaurant'] }, diningtable2: { room: 'restaurant', skills: ['restaurant'] },
  },
  // rooms the user can add from the Catalogue's Rooms tab (tested by sweepRooms / sweepDoors / sweepGating / sweepSaves)
  rooms: { workshop: {}, restaurant: {} },
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
    read: { objects: ['shelf'], touches: ['shelf', 'armchair', 'armchair2', 'chair', 'chair2', 'builtchair'] },
    rearrange: { objects: ['lamp', 'plant', 'armchair'], touches: ['lamp', 'plant', 'armchair', 'table', 'bench', 'flowerplant', 'coffeetable', 'nightstand', 'guitar', 'easel', 'telescope', 'footstool', 'woodshelves', 'builtchair'] },
    ball: { touches: [] },
    dribble: { skills: ['ball'], touches: [] },
    toss: { skills: ['ball'], touches: [] },
    guitar: { objects: ['guitar'], skills: ['guitar'], touches: ['guitar'] },
    riff: { objects: ['guitar'], skills: ['guitar'], touches: ['guitar'] },
    // the Workshop: `room` is added first, `stock` is what the Workshop has when it starts, `max` how long (simulated seconds) it may take
    makewood: { objects: ['woodfactory', 'workbench'], skills: ['workshop.materials'], room: 'workshop', stock: { wood: 0, parts: 0 }, touches: ['woodfactory', 'workbench'] },
    sawwood: { objects: ['saw', 'workbench'], skills: ['workshop.materials'], room: 'workshop', stock: { wood: 2, parts: 0 }, touches: ['saw', 'workbench'] },
    tap: { objects: ['mallet'], skills: ['workshop'], room: 'workshop', stock: { wood: 0, parts: 0 }, touches: ['mallet'] },
    sand: { objects: ['sander', 'workbench'], skills: ['workshop.materials'], room: 'workshop', stock: { wood: 2, parts: 0 }, touches: ['sander', 'workbench'] },
    tidytools: { objects: ['toolbox'], skills: ['workshop'], room: 'workshop', stock: { wood: 0, parts: 0 }, touches: ['toolbox'] },
    build: { objects: ['workbench', 'saw', 'mallet', 'toolbox'], skills: ['workshop'], room: 'workshop', stock: { wood: 0, parts: 4 }, max: 260, touches: ['workbench', 'saw', 'mallet', 'toolbox', 'sander', 'woodfactory'] },
    // the Restaurant: `customer` is the state of a customer set up before it starts (customers.js stage()); the rest as for the Workshop
    takeorder: { objects: ['stove', 'kitchencounter', 'register', 'diningtable'], skills: ['restaurant'], room: 'restaurant', customer: 'waiting', touches: ['diningtable'] },
    cook: { objects: ['stove', 'kitchencounter', 'register', 'diningtable'], skills: ['restaurant'], room: 'restaurant', customer: 'ordered', max: 200, touches: ['stove', 'kitchencounter'] },
    serve: { objects: ['stove', 'kitchencounter', 'register', 'diningtable'], skills: ['restaurant'], room: 'restaurant', customer: 'cooked', touches: ['kitchencounter', 'diningtable'] },
    takepay: { objects: ['stove', 'kitchencounter', 'register', 'diningtable'], skills: ['restaurant'], room: 'restaurant', customer: 'paying', touches: ['register'] },
    jamguitar: { objects: ['guitar'], skills: ['guitar'], music: true, touches: ['guitar'] },
    dancemoves: { objects: ['table'], skills: ['dance.moves'], touches: ['table', 'shelf', 'lamp'] },
    ballroom: { objects: ['table'], skills: ['dance.ballroom'], touches: ['table', 'shelf', 'lamp'] },
    sit: { objects: ['armchair'], touches: ['armchair', 'armchair2', 'chair', 'chair2', 'builtchair'] },
    sitguitar: { objects: ['guitar', 'armchair'], skills: ['guitar'], touches: ['guitar', 'armchair', 'armchair2', 'chair', 'chair2', 'builtchair'] },
    slouch: { objects: ['drums'], touches: ['drums'] },
    stereoon: { objects: ['table'], skills: ['stereo'], touches: ['table', 'shelf'] },
    stereooff: { objects: ['table'], skills: ['stereo'], music: true, touches: ['table', 'shelf'] },
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
    hangpaint: { objects: ['easel'], painted: true, max: 220, touches: ['easel'] }, putcanvas: { internal: true },      // hanging a painting (sweepPaintings tests it in depth)
    visit: { internal: true }, leave: { internal: true }, rwait: { internal: true },      // rwait: waiting by the till for customers (tested by sweepRestaurant)
         // through the door of an added room and back: tested by sweepVisit
  },
  // what to do after reading each book: an activity that should now be possible
  books: { stereo: { then: 'dance' }, piano: { then: 'piano' }, ball: { then: 'dribble' }, lighting: { then: 'mood' }, piano2: { then: 'piano' }, guitar: { then: 'guitar' },
    speedread: { then: 'read' }, dancemoves: { then: 'dancemoves' }, ballroom: { then: 'ballroom' },
    drumming: { then: 'drums' }, drumsolo: { then: 'drumsolo' }, drumband: { then: 'jamdrums' },
    painting: { then: 'paint' }, colour: { then: 'mixpaint' }, portrait: { then: 'portrait' },
    stars: { then: 'stargaze' }, darksky: { then: 'darkstargaze' }, scopecare: { then: 'scopecare' },
    decorating: { then: 'dust' },
    workshop: { then: 'build' }, woodmetal: { then: 'makewood' }, furniture: { then: 'build' }, restaurant: { then: 'takeorder' },
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
    { id: 'sit-rest', activity: 'sit', pose: 'sitRest', t: 5, view: 'side', expect: 'sitting on the seat (not hovering), thighs level, hands resting on the knees, head turning slowly' },
    { id: 'sit-guitar', activity: 'sitguitar', pose: 'sitGuitar', t: 6, view: 'front', expect: 'seated, the guitar held on the lap and chest, left hand on the neck, right hand strumming; the chair does not pass through the guitar' },
    { id: 'slouch', activity: 'slouch', pose: 'slouch', t: 6, view: 'side', expect: 'on the drum stool, round-shouldered, knees apart, hands hanging between the knees' },
    { id: 'paint-takedown', activity: 'hangpaint', pose: 'reach', t: 1.5, view: 'front', expect: 'at the easel, one hand on the canvas as he lifts it off (the easel goes blank at that moment), then he carries it held up in front of him' },
    { id: 'cook-stir', activity: 'cook', pose: 'workTap', t: 4, view: 'front', expect: 'standing at the stove, lid off the pot, a wooden spoon in the right hand circling in the pot, left hand resting on the hob, steam rising' },
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
  rooms: ROOM_CATALOG.map((r) => r.id),
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
    rooms: inv.rooms.filter((x) => !(x in MANIFEST.rooms)),
  };
  const stale = {
    rooms: Object.keys(MANIFEST.rooms).filter((x) => !inv.rooms.includes(x)),
    objects: Object.keys(MANIFEST.objects).filter((x) => !inv.objects.includes(x)),
    activities: Object.keys(MANIFEST.activities).filter((x) => !inv.activities.includes(x)),
  };
  return { complete: Object.values(missing).every((a) => !a.length), missing, stale };
};

// ---- state helpers ----------------------------------------------------------------------------------------------
const OVERLAP_FAIL = 6;   // samples (one every 5 frames) before arm-inside-object counts as a failure rather than a graze (every real clip so far was 8+; 4-5 was walking past a box at the edge of the safety margin)
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
    const o = W().objects[name];
    if (o.removable === false) continue;
    if (o.kind) W().storeInstance(name); else W().removeObject(name);      // something Guy built goes back into storage
    B().objectRemoved(name);
  }
  for (const name of Object.keys(W().decor)) { W().removeObject(name); B().objectRemoved(name); }
  if (!W().ballGone) { W().removeBall(); B().ballRemoved(); }
};
const isPresent = (id) => (id === 'ball' ? !W().ballGone : !!(W().objects[id] || W().decor[id] || Object.values(W().objects).some((o) => o.kind === id)));
// a premium room is locked until it is paid for: the harness unlocks it directly (a dev bypass, like the premium records)
const unlockRoom = (id) => { if (!W().rooms.isUnlocked(id)) W().rooms.setUnlocked(id, true); };
T.addObject = (id) => { // through the Catalogue, like a user would
  const def = OBJECT_CATALOG.find((d) => d.id === id);
  if (isPresent(id)) return true;
  if (def.locked) return false;
  if (def.room && !W().rooms.isAdded(def.room)) { unlockRoom(def.room); W().rooms.add(def.room); }          // the Catalogue lists a room's things only once the room is added
  if (def.built && !((W().stock.items[id] || 0) > 0)) W().stock.items[id] = 1;      // something Guy built: make sure there is one in storage to add
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
  if (m.room && !R().isAdded(m.room)) { unlockRoom(m.room); R().add(m.room); }                           // the room the activity happens in
  for (const id of m.objects || []) if (T.addObject(id)) done.push(id);
  T.learn(m.skills || []);
  if (m.stock) { Object.assign(W().stock, { wood: 0, parts: 0 }, m.stock); W().syncStock(); }
  if (m.painted) { const e = W().objects.easel; if (e && !e.painted) { e.paint.dab(0.5, 0.5, '#2a62d8', 60); e.paint.stroke(0.1, 0.2, 0.9, 0.8, '#d0312d', 14); e.painted = true; } }       // a painting on the easel to hang
  if (m.customer) { const r = W().restaurant; r.clear(); r.paused = true; r.stage(m.customer); }       // a customer in the right state, and no others arriving
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
    const built = W().objects[o.name];
    if (built && built.kind && allowed.has(built.kind)) continue;                 // a thing Guy built is allowed where its kind is (a built chair where chairs are)
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
T.run = (name, { max = (MANIFEST.activities[name] || {}).max || 150, prep = true } = {}) => {
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
  if ((MANIFEST.activities[name] || {}).customer) W().restaurant.clear();           // nobody is left in the restaurant to keep him there
  if (name === 'hangpaint') W().paintings.reset();                                  // and the painting he hung comes down again
  const s = T.settle();
  rep.idleAfter = s.ok;
  rep.warnings = grazes(rep.overlaps);
  if (Object.keys(serious(rep.overlaps)).length) rep.where = T.lastOverlap;      // where the last overlap was (for chasing intermittent failures)
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
// 1. Add the objects one at a time (Catalogue UI), check placement, interact before and after he has the skill.
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
    if (m.built) {                               // something Guy builds: one is added from storage, as a real object of its own
      const added = T.addObject(def.id);
      const o = Object.values(W().objects).find((x) => x.kind === def.id);
      out.push(result(def.id, added && !!o && W().fits(o, o.x, o.z) && o.name.startsWith(def.id + '_') && (W().stock.items[def.id] || 0) === 0, { added, built: true, name: o && o.name }));
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
      const st = (stats[pose] ||= { behind: -9, wrist: 0, err: 0, neck: 0, n: 0, errs: [], necks: [] });
      const hand = g.root.worldToLocal(g.boneWorld(`${side}Hand`));
      st.behind = Math.max(st.behind, -hand.z);
      // wrist bend: angle between the forearm (elbow -> wrist) and the hand (wrist -> knuckle), degrees; 0 = straight
      const fa = g.boneWorld(`${side}ForeArm`), wr = g.boneWorld(`${side}Hand`), kn = g.boneWorld(`${side}HandMiddle1`);
      st.wrist = Math.max(st.wrist, Math.acos(Math.max(-1, Math.min(1, wr.clone().sub(fa).normalize().dot(kn.clone().sub(wr).normalize())))) * 57.3);
      st.n++;
      if (side === 'Left' && pose === 'guitar' && ctx.guitar && ctx.guitar.cur) {      // fretting hand on the neck?
        const F = ctx.guitar.cur, a0 = b.gp(F, 0.2, 0, 0), ab = b.gp(F, 0.8, 0, 0).sub(a0), p = g.boneWorld('LeftHandMiddle2');
        const u = Math.max(0, Math.min(1, p.clone().sub(a0).dot(ab) / ab.lengthSq()));
        st.necks.push(a0.clone().addScaledVector(ab, u).distanceTo(p));
      }
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
    s.necks.sort((a, c) => a - c);
    s.neck = s.necks.length ? s.necks[Math.floor(s.necks.length * 0.9)] : 0;
    delete s.necks;
    for (const k of ['behind', 'wrist', 'err', 'neck']) s[k] = +s[k].toFixed(k === 'wrist' ? 0 : 3);
  }
  return stats;
};

// Limits for the pose-sanity sweep. `behind`: m behind his body (a hand reaching a world point behind him once measured 0.53;
// walking and waltzing peak at ~0.35). `wrist`: degrees of wrist bend (a real wrist manages ~90). `err`: m between the hand and the
// wrist position the game asked for (90th percentile; drum, brush and guitar poses expose one). `neck`: m between the fretting
// hand's middle finger joint and the guitar neck (90th percentile; the hand must be on the neck).
export const POSE_LIMITS = { behind: 0.45, wrist: 110, err: 0.32, neck: 0.05 };
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
      added, learned, seconds: t, trail: learned ? undefined : trail, stateWhenStuck: where, then, usedOk: use ? use.pass : null, useDetail: use && !use.pass ? { completed: use.completed, overlaps: use.overlaps, errors: use.errors, idleAfter: use.idleAfter, where: use.where } : null, errors: errors.slice(base),
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
  const lens = Object.entries(TRACKS).filter(([, tr]) => tr.step && tr.bpm).map(([id, tr]) => [id, +trackSeconds(tr).toFixed(1)]);
  out.push(result('every song on a record plays 20 s or less', lens.length > 20 && lens.every(([, sec]) => sec <= 20 && sec >= 5), { longest: lens.sort((a, c) => c[1] - a[1])[0], shortest: lens.sort((a, c) => a[1] - c[1])[0], n: lens.length }));
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
  out.push(result('stereo + dance (joins the music)', ...(() => {
    const r = timed(() => {
      const b = B();
      T.settle(); T.home(); b.stereoControl('play'); b.queue = []; b.step = null; b.pendingActivity = null; b.choose('dance');
      let t = 0, danced = false; while (t < 90 && !(b.last !== 'dance' && t > 1)) { step(0.25); t += 0.25; if (b.last === 'dance' && /dance/.test(b.pose)) danced = true; if (['disco', 'robot', 'pump'].includes(b.pose)) danced = true; }
      b.stereoControl('stop');
      return { pass: b.last !== 'dance' && danced, labels: [label()] };
    });
    return [r.pass && !r.errors.length, { labels: r.labels }];
  })()));
  // the stereo's long-press button: "Turn Stereo On" has Guy switch it on (the selected song, left on), "Turn Stereo Off" switches it off
  out.push(result('stereo menu button: Guy turns it on, then off', ...(() => {
    const r = timed(() => {
      const b = B();
      T.settle(); T.home(); b.stereoControl('stop');
      const a = b.interact('table'); let t = 0; while (t < 30 && !(b.music && b.last === 'stereoon' && !b.step)) { step(0.25); t += 0.25; if (b.music) break; }
      const wasOn = !!b.music; step(3);
      const c = b.interact('table'); t = 0; while (t < 30 && b.music) { step(0.25); t += 0.25; }
      return { pass: a.ok && wasOn && c.ok && !b.music, wasOn, off: !b.music };
    });
    return [r.pass && !r.errors.length, { wasOn: r.wasOn, off: r.off }];
  })()));
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

// 7c. Furniture against a wall: with the drum kit or the easel pushed up to a wall in every rotation, Guy must either use it
// promptly (sitting down within about 15 s) or decline (the Interact button explains), and a forced attempt at a spot he cannot
// reach must be dropped within a few seconds, not after 50 s of walking into the wall.
T.sweepWalls = () => {
  const out = [], b = B(), G_ = G();
  T.addObject('table'); T.addObject('drums'); T.addObject('easel'); T.learn(['drums', 'easel']);
  const places = {
    back: (o, r) => [0.5, -4 + (r % 2 ? o.bw / 2 : o.bd / 2) + 0.02],
    left: (o, r) => [-5 + (r % 2 ? o.bd / 2 : o.bw / 2) + 0.02, 0.8],
  };
  for (const [name, seat, act] of [['drums', 'drumSit', 'drums'], ['easel', 'paintStand', 'paint']]) {
    const o = W().objects[name];
    const other = name === 'drums' ? 'easel' : 'drums';           // park the other one clear, so earlier sweeps cannot leave it next to this one
    W().objects[other].set(...(other === 'drums' ? [3.0, 1.8] : [-3.0, 2.4]));
    for (const [wall, place] of Object.entries(places)) {
      for (let r = 0; r < 4; r++) {
        T.settle(); T.home(); o.rot = r;
        const [x, z] = place(o, r);
        o.set(x, z);
        if (!W().fits(o, x, z)) continue;
        const base = errors.length;
        const reply = b.interact(name);
        const ok = b.standOk(name);
        let sat = false, t = 0, gaveUp = null;
        if (reply.ok) {
          while (t < 40 && !sat) { step(0.1); t += 0.1; if (b.pose === seat || (name === 'easel' && b.pose.startsWith('paint'))) sat = true; }
          out.push(result(`wall: ${name} against the ${wall} wall, turned ${r}: he uses it promptly`, ok && sat && t < 15 && errors.length === base, { ok, sat, seconds: +t.toFixed(1) }));
        } else {
          // he declines; forcing the activity anyway must be dropped quickly
          b.queue = []; b.step = null; b.pendingActivity = null; b.choose(act);
          while (t < 40 && b.last === act) { step(0.1); t += 0.1; }
          gaveUp = +t.toFixed(1);
          out.push(result(`wall: ${name} against the ${wall} wall, turned ${r}: he declines, and a forced try is dropped quickly`, !ok && /Move it away/.test(reply.message) && gaveUp < 20 && errors.length === base, { ok, message: reply.message, gaveUpAfter: gaveUp }));
        }
      }
    }
    o.rot = 0; T.removeAll(); T.addObject('table'); T.addObject('drums'); T.addObject('easel');
  }
  void G_;
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

// 8. Decor (rug, windows, picture): remove each through the Catalogue's Remove button, check it is really gone and offered
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
  // wall limits: a window may not be dragged over the Catalogue, the other window, or below a piano standing against its wall
  const w = W();
  T.addObject('window2'); T.addObject('picture'); T.addObject('window'); T.addObject('piano');
  const win = w.decor.window, pic = w.decor.picture, win2 = w.decor.window2, piano = w.objects.piano;
  out.push(result('decor:window keeps off the Catalogue', !!win && !w.decorFits(win, -2.3, 1.5) && w.decorFits(win, win.u, win.v)));
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

// 9. The Catalogue's Objects tab: category chips, one section per category, counts that match the room.
T.sweepMachine = () => {
  const out = [];
  const LISTED = OBJECT_CATALOG.filter((d) => !d.room || W().rooms.isLive(d.room));      // objects of rooms that are not added are not listed
  const cats = [...new Set(LISTED.map((d) => d.cat))];
  out.push(result('machine: every object has a category', OBJECT_CATALOG.every((d) => d.cat), { uncategorised: OBJECT_CATALOG.filter((d) => !d.cat).map((d) => d.id) }));
  let m = openObjects('all');
  const titles = () => [...m.querySelectorAll('.card .title')].map((e) => e.textContent);
  out.push(result('machine: All shows every object once', titles().length === LISTED.length && new Set(titles()).size === LISTED.length, { shown: titles().length, catalog: LISTED.length }));
  for (const c of cats) {
    m = openObjects(c);
    const want = LISTED.filter((d) => d.cat === c).map((d) => d.name).sort();
    const got = titles().sort();
    const heads = [...m.querySelectorAll('h4')].length;
    out.push(result(`machine: filter ${c}`, JSON.stringify(want) === JSON.stringify(got) && heads === 1, { want, got, headings: heads }));
  }
  m = openObjects('all');
  const chipCounts = [...m.querySelectorAll('.chip')].map((c) => c.textContent.trim());
  const inRoomNow = LISTED.filter((d) => isPresent(d.id) && !d.locked).length;
  out.push(result('machine: the All chip counts what is in the room', chipCounts[0] === `All ${inRoomNow}/${LISTED.length}`, { chip: chipCounts[0], inRoomNow }));
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
// Dragging or turning something Guy is using must make him let go (stand up, step back) instead of stretching his arms after it.
T.sweepMoves = () => {
  const out = [], b = B();
  const cases = [['piano', 'piano', 'piano'], ['sitpiano', 'pianoSit', 'piano'], ['drums', 'drumSit', 'drums'], ['paint', 'paintStand', 'easel'],
    ['stargaze', 'scopePeer', 'telescope'], ['guitar', 'guitar', 'guitar'], ['read', 'readSit', 'armchair']];
  for (const [act, pose, name] of cases) {
    const base = errors.length;
    let reached = false;
    for (let attempt = 0; attempt < 3 && !reached; attempt++) {      // some layouts leave no room to use the telescope: try again
      T.removeAll(); T.forget(); skillsOf().fading.clear(); T.prep(act); T.addObject(name); T.settle(); T.home(); b.queue = []; b.step = null; b.pendingActivity = null; b.choose(act);
      let t = 0; while (t < 80 && !(b.step && b.pose === pose && b.step.t > 4)) { step(0.1); t += 0.1; }
      reached = !!(b.step && b.pose === pose);
    }
    const o = W().objects[name];
    const ox = o.x, oz = o.z, rot = o.rot;
    o.set(ox + 0.6, oz);
    step(1.2);
    const letGo = reached && (b.pose !== pose || (b.step && b.step.t >= b.step.dur - 3));
    const settled = T.settle(120);
    o.set(ox, oz);
    out.push(result(`moved while in use: ${act}`, reached && letGo && settled.ok && errors.length === base, { reached, letGo, pose: b.pose, idleAfter: settled.ok, errors: errors.slice(base) }));
  }
  return out;
};

// Forgetting a book, and Speed Reading.
T.sweepBookRules = () => {
  const out = [], b = B(), sk = skillsOf(), w = W();
  T.removeAll(); T.forget(); sk.fading.clear(); T.settle(); T.home();
  T.addObject('armchair');
  const onShelf = (id) => w.objects.shelf.books.some((x) => x.def.id === id);
  const base = errors.length;

  // forgetting: the book goes back to the catalogue at once, what it taught fades gradually, and reading it again restores it
  sk.known.add('piano');
  const r = b.forgetBook('piano');
  const listed = (() => { const root = document.getElementById('machine'); return r.ok && !onShelf('piano') && T.addBook('piano') === true && onShelf('piano'); })();
  b.forgetBook('piano');                                   // (put back through the catalogue, forget again)
  const s0 = sk.strength('piano'); step(60); const s60 = sk.strength('piano'); step(120);
  out.push(result('forget: the book returns to the catalogue and the lesson fades gradually (150 s)', listed && s0 === 1 && s60 > 0.4 && s60 < 0.8 && !sk.has('piano') && !b.available('piano'), { s0, s60, gone: !sk.has('piano') }));
  T.addBook('piano'); sk.known.add('piano'); b.forgetBook('piano'); step(30); T.addBook('piano');
  const rec = w.objects.shelf.books.find((x) => x.def.id === 'piano');
  const relearn = (() => { sk.learn('piano'); return sk.strength('piano') === 1; })();
  out.push(result('forget: reading it again while it fades restores it in full', !!rec && relearn));

  // "Remove" is not "Forget": the book goes back to the catalogue but he keeps what he learned
  sk.known.add('stereo');
  const rem = b.removeBook('stereo');
  const kept = sk.has('stereo') && sk.strength('stereo') === 1 && !onShelf('stereo');
  step(200);
  const stillKept = sk.has('stereo') && sk.strength('stereo') === 1;
  const putBack = T.addBook('stereo') === true && onShelf('stereo');
  out.push(result('remove: the book leaves the shelf, comes back from the catalogue, and Guy keeps the skill (no fading)', rem.ok && kept && stillKept && putBack, { kept, stillKept, putBack, message: rem.message }));
  // an unread book can be forgotten too, and a book in his hands cannot
  const held = w.objects.shelf.books.find((x) => x.def.id === 'ball');
  b.takeBook(held);
  const refuse = b.forgetBook('ball');
  b.returnBook();
  out.push(result('forget: refused while he is holding the book', !refuse.ok && onShelf('ball'), { message: refuse.message }));

  // Speed Reading: at the shelf, quick, and he still learns from the book
  T.settle(); T.home(); sk.known.delete('speedreading'); sk.fading.clear(); sk.known.delete('ball');
  T.addBook('speedread');
  // read one exact book (settle first: while settling he may start reading something else and use up the request)
  const readRun = (id) => {
    const rec2 = w.objects.shelf.books.find((x) => x.def.id === id);
    sk.known.delete(rec2.def.teaches);
    T.settle(); T.home(); b.queue = []; b.step = null; b.pendingActivity = null; b.forceBook = rec2; b.choose('read');
    const poses = new Set(); let t = 0; const labels = [label()];
    while (t < 150 && b.last === 'read') { step(0.1); t += 0.1; if (b.step) poses.add(b.pose); }
    return { seconds: +t.toFixed(1), poses: [...poses], learned: sk.has(rec2.def.teaches), labels };
  };
  const normal = readRun('lighting');
  sk.known.add('speedreading');
  const fast = readRun('lighting');
  out.push(result('speed reading: reads standing at the shelf, much faster, and still learns from the book', normal.learned && fast.learned && !fast.poses.includes('readSit') && fast.seconds < normal.seconds * 0.7, { normal, fast }));
  out.push(result('speed reading: without it he sits in a chair to read', normal.poses.includes('readSit'), { poses: normal.poses }));

  // forgetting Speed Reading is slow (5 minutes) and the effect fades with it
  b.forgetBook('speedread');
  const sp0 = b.readSpeed(); step(150); const sp150 = b.readSpeed(); step(160);
  out.push(result('speed reading: forgetting takes 5 minutes, the reading speed falls gradually back to normal', sp0 === 2.5 && sp150 > 1.4 && sp150 < 2.0 && b.readSpeed() === 1 && !sk.has('speedreading'), { sp0, sp150, end: b.readSpeed() }));
  out.push(result('forget: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// Sound effects: every kind of event must ask for its sound (sfx.js counts the requests even with no audio running).
T.sweepSounds = () => {
  const out = [], b = B(), w = W();
  const heard = (name, fn) => { const c0 = sfxCounts[name] || 0; fn(); return (sfxCounts[name] || 0) - c0; };
  const sound = (label, name, fn, min = 1) => { const base = errors.length; let n = 0; try { n = heard(name, fn); } catch (e) { out.push(result(`sound: ${label}`, false, { error: String(e) })); return; } out.push(result(`sound: ${label}`, n >= min && errors.length === base, { name, heard: n })); };
  T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  for (const id of ['table', 'armchair', 'lamp', 'plant', 'guitar', 'easel', 'telescope', 'piano', 'bench']) T.addObject(id);
  // the ball
  T.addObject('ball');
  const ball = w.ball;
  sound('the ball hits the floor', 'bounce', () => { ball.position.set(-1.5, 2.2, 2.4); ball.userData.vel.set(0, 0, 0); step(2); });
  sound('the ball is kicked', 'kick', () => { b.kickBall(new THREE.Vector3(1, 0, 0), true); });
  sound('the ball hits a wall', 'wallbump', () => { ball.position.set(3.5, 0.18, 2.8); ball.userData.vel.set(9, 0, 0); step(1.5); });
  sound('the ball hits furniture', 'knock', () => { const o = w.objects.armchair; ball.position.set(o.x - 1.6, 0.18, o.z); ball.userData.vel.set(5, 0, 0); step(1.2); });
  // reading: grab, open, page turns, close, sit
  T.learn([]); T.settle(); T.home();
  const readBase = {}; for (const k of ['bookgrab', 'bookopen', 'page', 'bookclose', 'sit', 'step']) readBase[k] = sfxCounts[k] || 0;
  b.queue = []; b.step = null; b.pendingActivity = null; b.choose('read'); let t = 0; while (t < 120 && b.last === 'read') { step(0.25); t += 0.25; }
  for (const k of ['bookgrab', 'bookopen', 'page', 'bookclose', 'sit', 'step']) out.push(result(`sound: reading makes a "${k}" sound`, (sfxCounts[k] || 0) > readBase[k], { heard: (sfxCounts[k] || 0) - readBase[k] }));
  // activities
  const act = (label, name, activity, min = 1) => sound(label, name, () => { T.prep(activity); T.run(activity, { prep: false }); }, min);
  act('the guitar is lifted and put back', 'guitar', 'guitar', 2);
  act('the lamp switch clicks', 'click', 'lamp');
  act('furniture is pushed along the floor', 'drag', 'rearrange');
  act('a plant leaf rustles', 'leaf', 'plant');
  act('the brush and the paint', 'brush', 'paint');
  act('the telescope focus ticks', 'tick', 'stargaze');
  act('wiping the telescope', 'wipe', 'scopecare');
  act('the Wood Factory runs', 'machine', 'makewood');
  act('sawing a plank', 'saw', 'sawwood');
  act('tapping with the rubber mallet', 'tap', 'tap');
  act('sanding', 'sand', 'sand');
  act('the toolbox lid', 'lid', 'tidytools', 2);
  act('he sits down in a chair', 'sit', 'sit');
  sound('learning something chimes', 'chime', () => { /* main.js asks for it when brain.onLearn fires */ if (brain.onLearn) brain.onLearn({ blurb: 'a test' }); });
  return out;
};

// ---- 10. Rooms and doors (src/rooms.js; the Catalogue's Rooms tab) ----------------------------------------------------------------
const R = () => W().rooms;
const BANNED = /\b(fail|failed|error|wrong|can't|cannot|lost|broken|dangerous)\b/i;
const friendly = (msgs) => msgs.length > 0 && msgs.every((m) => m.length < 80 && !BANNED.test(m));    // short, kind wording (section 16 of the plan)
const openTab = (tab) => { const m = machine(); m.hidden = false; m.querySelector(`[data-tab=${tab}]`).click(); return m; };
const rectsOv = (a, b) => a.x1 > b.x0 && a.x0 < b.x1 && a.z1 > b.z0 && a.z0 < b.z1;
// Take every added room away again (a test-only reset: the game never removes a room).
T.resetRooms = () => {
  const b = B();
  for (const r of ROOM_CATALOG) R().reset(r.id);                                  // its furniture goes with it
  for (const [name, o] of Object.entries(W().objects)) if (o.kind) { W().storeInstance(name); b.objectRemoved(name); }       // and what Guy built that stands in his room
  W().paintings.reset();                                                          // Guy's paintings come down and the list is emptied
  const st = W().stock; st.wood = 0; st.parts = 0; st.items = {}; st.coins = 0;   // and what the Workshop made and the Restaurant earned
  W().restaurant.clear(); W().restaurant.paused = false; W().restaurant.nServed = 0; W().restaurant.stats = { arrived: 0, paid: 0, gaveUp: 0 };
  b.carry = null; b.restJob = null;
  if (!b.inMain()) T.home();                                                     // nobody is left standing in a room that is gone
};
// Put back what a door took out of the room (only what was not already out before the sweep began).
const putBackSince = (before) => { for (const name of Object.keys(W().removed)) if (!before.has(name)) W().restoreObject(name, { x: G().pos.x, z: G().pos.z }); };
// What is wrong with a room's door? [] means nothing: on an allowed wall, nothing in the doorway, no wall piece over it.
const doorProblems = (id) => {
  const w = W(), d = w.doors[id], bad = [];
  if (!d) return ['no door'];
  if (!ROOM_CATALOG.find((r) => r.id === id).doorWalls.includes(d.wall)) bad.push(`wall ${d.wall} is not allowed`);
  for (const [n, o] of Object.entries(w.objects)) if (rectsOv(d.rect, o.obstacle)) bad.push(`${n} is in the doorway`);
  for (const dc of Object.values(w.decor)) {
    if (dc.wall === d.wall && dc.u + dc.hw > d.u - w.DOOR.w / 2 && dc.u - dc.hw < d.u + w.DOOR.w / 2 && dc.v - dc.hh < w.DOOR.h) bad.push(`${dc.name} hangs over the door`);
  }
  return bad;
};

T.sweepRooms = () => {
  const out = [], base = errors.length, w = W();
  T.resetRooms(); T.settle(); T.home();
  const before = new Set(Object.keys(w.removed));
  const messages = [];
  out.push(result('rooms: before adding there is no door', !R().isAdded('workshop') && !Object.keys(w.doors).length));
  let m = openTab('rooms');
  const titles = () => [...m.querySelectorAll('.card .title')].map((e) => e.textContent);
  const btn = machineCard('Workshop') && machineCard('Workshop').querySelector('.act');
  out.push(result('rooms: the Rooms tab offers the Workshop and the Restaurant ("Add to my home") and not the main room', titles().join() === ROOM_CATALOG.map((x) => x.name).join() && !!btn && btn.textContent === 'Add to my home', { titles: titles() }));
  if (btn) btn.click();
  step(1);
  const door = w.doors.workshop;
  const toast = document.getElementById('toast').textContent;
  messages.push(toast);
  out.push(result('rooms: tapping Add puts exactly one door on an allowed wall, with nothing in the way', !!door && Object.keys(w.doors).length === 1 && !doorProblems('workshop').length, { door: door && { wall: door.wall, u: door.u }, problems: doorProblems('workshop') }));
  out.push(result('rooms: the toast says the Workshop was added', /Workshop added/.test(toast), { toast }));
  m = openTab('rooms');
  const after = machineCard('Workshop');
  out.push(result('rooms: the Workshop then shows "In your home" with no Add button', !!after && !after.querySelector('.act') && /In your home/.test(after.textContent)));
  const e = w.extent(), v = new THREE.Vector3();
  let inView = true;
  for (const x of [e.minX, e.maxX]) for (const y of [0, 3.2]) for (const z of [e.minZ, e.maxZ]) { v.set(x, y, z).project(window.camera); if (Math.abs(v.x) > 1.001 || Math.abs(v.y) > 1.001) inView = false; }
  out.push(result('rooms: the camera frames the main room and the Workshop together', (e.maxX - e.minX) * (e.maxZ - e.minZ) > 80 && inView, { extent: e }));
  const twice = R().add('workshop');
  messages.push(...twice.messages);
  out.push(result('rooms: adding the Workshop again does nothing, and says so kindly', !twice.ok && twice.already && Object.keys(w.doors).length === 1 && friendly(twice.messages), { twice }));
  R().reset('workshop');
  out.push(result('rooms: taking the room away removes the door and its room, and the camera frames the main room again',
    !Object.keys(w.doors).length && !w.room.children.includes(door.group) && !w.room.children.includes(door.shell.group) && w.extent().maxX === 5 && w.extent().minZ === -4));
  const none = R().add('workshop', { walls: [] });
  messages.push(...none.messages);
  out.push(result('rooms: with no wall free it explains, and nothing changes', !none.ok && friendly(none.messages) && !Object.keys(w.doors).length && Object.keys(w.removed).length === before.size, { none }));
  out.push(result('rooms: every message is short and kind', friendly(messages.filter(Boolean)), { messages }));
  T.resetRooms(); putBackSince(before); machine().hidden = true;
  out.push(result('rooms: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

T.sweepDoors = () => {
  const out = [], base = errors.length, w = W(), at = () => ({ x: G().pos.x, z: G().pos.z });
  T.resetRooms(); T.settle(); T.home();
  // 1. each wall on its own, with the room as it is: the door lands where nothing fixed is, whatever it has to move
  for (const wall of ['right', 'front', 'back']) {
    const before = new Set(Object.keys(w.removed));
    const res = R().add('workshop', { walls: [wall] });
    const probs = doorProblems('workshop');
    const gone = res.ok ? res.displaced.every((n) => !!w.removed[n]) : true;
    out.push(result(`doors: on the ${wall} wall only, the door is clear and what it moved is in the Catalogue`, res.ok ? !probs.length && gone && w.doors.workshop.wall === wall : friendly(res.messages), { res: { ok: res.ok, u: res.u, displaced: res.displaced }, probs }));
    // every added room is as big as Guy's room: the same width (x) and the same depth (z), whichever wall the door is on
    const sb = res.ok ? w.doors.workshop.shell.bounds : null;
    out.push(result(`doors: ${wall} wall: the room behind it has the same width and depth as Guy's room`, !res.ok || (near(sb.maxX - sb.minX, 10) && near(sb.maxZ - sb.minZ, 8)), { bounds: sb }));
    // what was moved can be put back, and none of it ends up in the doorway
    putBackSince(before);
    out.push(result(`doors: ${wall} wall: put back, nothing returns into the doorway`, !res.ok || !doorProblems('workshop').length, { probs: doorProblems('workshop') }));
    T.resetRooms();
  }
  // 2. a piece of furniture standing where the door is pinned is taken out, and goes to the Catalogue
  T.removeAll(); T.addObject('plant'); T.addObject('picture');
  const before = new Set(Object.keys(w.removed));
  w.objects.plant.set(4.5, 2.6);                              // test-only teleport into the doorway
  const f = R().add('workshop', { at: { wall: 'right', u: 2.6 } });
  out.push(result('doors: a plant in the doorway is moved to the Catalogue', f.ok && f.displaced.includes('plant') && !w.objects.plant && !!w.removed.plant && !doorProblems('workshop').length && friendly(f.messages), { f }));
  const back = w.restoreObject('plant', at());
  out.push(result('doors: the plant can be put back and stays out of the doorway', back && !!w.objects.plant && !rectsOv(w.doors.workshop.rect, w.objects.plant.obstacle)));
  T.resetRooms();
  // 3. a picture hanging where the door is pinned comes down, and goes back up beside the door
  const g = R().add('workshop', { at: { wall: 'back', u: 0.2 } });
  out.push(result('doors: a picture over the doorway comes down', g.ok && g.displaced.includes('picture') && !w.decor.picture && !!w.removed.picture && !doorProblems('workshop').length, { g }));
  const up = w.restoreObject('picture', at());
  out.push(result('doors: the picture can be hung again, but not over the door', up && !!w.decor.picture && !doorProblems('workshop').length && w.decorFits(w.decor.picture, w.decor.picture.u, w.decor.picture.v), { problems: doorProblems('workshop') }));
  out.push(result('doors: a wall piece cannot be dragged over the door', !w.decorFits(w.decor.picture, w.doors.workshop.u, 1.9)));
  out.push(result('doors: furniture cannot be put or pushed into the strip in front of the door', !w.fits(w.objects.plant || (T.addObject('plant'), w.objects.plant), 0.5 * (w.doors.workshop.rect.x0 + w.doors.workshop.rect.x1), 0.5 * (w.doors.workshop.rect.z0 + w.doors.workshop.rect.z1))));
  T.resetRooms();
  // 4. nothing that is fixed ever moves for a door: the bookshelf, the heavy piano
  const shelf = w.objects.shelf, sx = shelf.x, sz = shelf.z, rm0 = Object.keys(w.removed).length;
  const s1 = R().add('workshop', { at: { wall: 'right', u: shelf.z } });
  out.push(result('doors: a door cannot go over the bookshelf', !s1.ok && !Object.keys(w.doors).length && shelf.x === sx && shelf.z === sz && Object.keys(w.removed).length === rm0 && friendly(s1.messages), { s1 }));
  T.addObject('piano');
  const s2 = R().add('workshop', { at: { wall: 'back', u: w.objects.piano.x } });
  out.push(result('doors: a door cannot go over the heavy piano', !s2.ok && !Object.keys(w.doors).length && !!w.objects.piano, { s2 }));
  T.resetRooms();
  // 5. the default choice: leaves the left wall (the Catalogue) alone and prefers the right wall when it is clear
  const plan = w.planDoor();
  out.push(result('doors: the default plan uses an allowed wall, never the left (the Catalogue)', !!plan && ['right', 'front', 'back'].includes(plan.wall), { plan }));
  out.push(result('doors: no errors', errors.length === base, { errors: errors.slice(base) }));
  T.resetRooms(); putBackSince(new Set()); machine().hidden = true;
  return out;
};

T.sweepGating = () => {
  const out = [], base = errors.length;
  T.resetRooms();
  const fakeObj = { id: '__gate_obj', cat: 'hobbies', name: 'Gate Test Object', icon: '🧪', desc: 'test', free: true, room: 'workshop' };
  const fakeBook = { id: '__gate_book', title: 'Gate Test Book', desc: 'test', room: 'workshop' };
  OBJECT_CATALOG.push(fakeObj); BOOK_CATALOG.push(fakeBook);
  const listedObj = () => { openObjects('all'); return !!machineCard('Gate Test Object'); };
  const listedBook = () => { openTab('books'); return !!machineCard('Gate Test Book'); };
  const total = () => { openObjects('all'); return +machine().querySelector('.chip').textContent.trim().split('/')[1]; };
  try {
    const t0 = total();
    out.push(result('gating: a room\'s object and book are not listed while the room is not added', !listedObj() && !listedBook()));
    R().add('workshop');
    out.push(result('gating: they are listed once the room is added', listedObj() && listedBook()));
    const roomItems = OBJECT_CATALOG.filter((d) => d.room === 'workshop' && d !== fakeObj).length;       // the Workshop's real furniture is listed too
    out.push(result('gating: the Objects count grows with the room', total() === t0 + 1 + roomItems, { before: t0, after: total(), roomItems }));
    R().setUnlocked('workshop', false);
    out.push(result('gating: a locked room\'s items are hidden entirely, not shown as locked', !listedObj() && !listedBook()));
    R().setUnlocked('workshop', true);
    out.push(result('gating: unlocking lists them again with no reload', listedObj() && listedBook()));
    R().reset('workshop');
    out.push(result('gating: gone again when the room is taken away', !listedObj() && !listedBook() && total() === t0));
    openTab('records');
    out.push(result('gating: premium records keep their "Premium · coming soon" listing', /Premium · coming soon/.test(machine().textContent)));
  } finally {
    OBJECT_CATALOG.splice(OBJECT_CATALOG.indexOf(fakeObj), 1); BOOK_CATALOG.splice(BOOK_CATALOG.indexOf(fakeBook), 1);
    T.resetRooms(); machine().hidden = true;
  }
  out.push(result('gating: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// Saving: what the game keeps between visits is R().snapshot(); a visit starts by calling R().restoreFrom() on it.
T.sweepSaves = () => {
  const out = [], base = errors.length, w = W(), at = () => ({ x: G().pos.x, z: G().pos.z });
  T.resetRooms(); T.removeAll(); T.addObject('picture');
  const before = new Set(Object.keys(w.removed));
  R().add('workshop', { at: { wall: 'back', u: 0.2 } });                    // takes the picture down
  const snap = JSON.parse(JSON.stringify(R().snapshot()));
  out.push(result('saves: the saved state records the room and its door', snap.rooms.workshop && snap.rooms.workshop.added && snap.rooms.workshop.wall === 'back' && snap.rooms.workshop.u === 0.2, { snap }));
  R().reset('workshop');
  w.restoreObject('picture', at());                                          // a new visit starts with the picture on the wall again
  const res = R().restoreFrom(snap);
  const d = w.doors.workshop;
  out.push(result('saves: restoring brings the door back where it was and takes the picture down again', res.length === 1 && res[0].ok && d && d.wall === 'back' && d.u === 0.2 && !w.decor.picture && !doorProblems('workshop').length, { res }));
  R().setUnlocked('workshop', false);
  const locked = JSON.parse(JSON.stringify(R().snapshot()));
  out.push(result('saves: a locked room stays locked after a restore', locked.rooms.workshop.unlocked === false));
  R().reset('workshop'); putBackSince(before);
  out.push(result('saves: nothing saved, or junk, restores nothing and does not throw', R().restoreFrom(null).length === 0 && R().restoreFrom({}).length === 0 && R().restoreFrom({ rooms: { nonsense: { added: true } } }).length === 0 && !Object.keys(w.doors).length));
  const shelf = w.objects.shelf;
  const moved = R().restoreFrom({ rooms: { workshop: { added: true, wall: 'right', u: shelf.z } } });   // the saved spot is now taken by the bookshelf
  out.push(result('saves: a saved door whose spot is taken by something fixed finds a new spot', moved.some((x) => x.moved && x.ok) && !!w.doors.workshop && !doorProblems('workshop').length, { moved }));
  T.resetRooms(); putBackSince(before); machine().hidden = true;
  out.push(result('saves: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 11. Layout: where everything is (and what was taken out) is remembered between visits (src/layout.js) ----------------------
const roomDrop = (id) => { if (id === 'ball') { W().removeBall(); B().ballRemoved(); } else { W().removeObject(id); B().objectRemoved(id); } };
const near = (a, b) => Math.abs(a - b) < 0.011;
T.sweepLayout = () => {
  const out = [], base = errors.length, w = W(), L = () => w.layout;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rot0 = Object.fromEntries([...Object.entries(w.objects), ...Object.entries(w.removed)].filter(([, o]) => !o.decor).map(([n, o]) => [n, o.rot]));     // (this sweep turns things: put them back as they were at the end)
  T.resetRooms(); T.removeAll(); T.settle(); T.home();
  for (const id of ['armchair', 'plant', 'lamp', 'bench', 'telescope', 'piano', 'table', 'rug', 'picture', 'ball']) T.addObject(id);
  const moveTo = (name, pref) => { const o = w.objects[name], s = w.findSpot(o, pref, null); if (s) o.set(s.x, s.z); return !!s; };
  // 1. a snapshot is stable, and survives being written out as JSON and read back
  const s0 = JSON.stringify(L().snapshot());
  out.push(result('layout: a snapshot of an unchanged room is the same every time', s0 === JSON.stringify(L().snapshot()) && s0 === JSON.stringify(JSON.parse(s0))));
  // 2. move, turn and remove things the way the user and Guy do
  moveTo('armchair', { x: -3.2, z: 0.5 }); w.objects.armchair.rotate(1);
  moveTo('plant', { x: 2, z: 1.5 }); moveTo('lamp', { x: -4.2, z: -1 });
  w.objects.telescope.setAim(0.7, 0.3);
  const pic = w.decor.picture, rug = w.decor.rug;
  for (let u = -3.5; u <= 3.5; u += 0.5) { if (Math.abs(u - pic.u) > 1 && w.decorFits(pic, u, 2.0)) { pic.set(u, 2.0); break; } }
  rug.set(-1.5, 1.0);
  w.ball.position.set(-2.2, 0.18, 2.4);
  roomDrop('bench');
  const s1 = clone(L().snapshot());
  // 3. a new visit: the pieces start in their default places, then the saved layout is put back
  moveTo('armchair', { x: 3, z: 2 }); w.objects.armchair.rotate(1); moveTo('plant', { x: -3, z: -1 }); moveTo('lamp', { x: 3.5, z: -1 });
  w.objects.telescope.setAim(-1.2, 0.8); rug.set(1, -1); w.restoreObject('bench', { x: G().pos.x, z: G().pos.z });
  const did = L().apply(clone(s1));
  const nowSnap = L().snapshot();
  const keyDiff = []; for (const n of Object.keys(s1.objects)) { const a = s1.objects[n], b = nowSnap.objects[n]; if (!b || !near(a.x, b.x) || !near(a.z, b.z) || a.rot !== b.rot) keyDiff.push(n); }
  out.push(result('layout: restoring puts every piece back at its saved spot and turn', did.applied && !keyDiff.length && JSON.stringify(Object.keys(nowSnap.objects).sort()) === JSON.stringify(Object.keys(s1.objects).sort()), { keyDiff, replaced: did.replaced }));
  out.push(result('layout: restoring is exact: a snapshot taken straight after equals the one restored', JSON.stringify(nowSnap) === JSON.stringify(s1)));
  const arm = w.objects.armchair;
  out.push(result('layout: a turned piece faces the saved way at once (no spinning round on the first frame)', near(arm.group.rotation.y, arm.yaw) && arm.rot === s1.objects.armchair.rot));
  out.push(result('layout: the telescope keeps its aim', near(w.objects.telescope.aim.yaw, s1.objects.telescope.aim.yaw) && near(w.objects.telescope.aim.pitch, s1.objects.telescope.aim.pitch)));
  out.push(result('layout: wall pieces and the rug keep their places', near(w.decor.picture.u, s1.decor.picture.u) && near(w.decor.picture.v, s1.decor.picture.v) && near(w.decor.rug.u, s1.decor.rug.u) && near(w.decor.rug.v, s1.decor.rug.v)));
  out.push(result('layout: what the user took out stays out (and can be put back from the Catalogue)', !w.objects.bench && !!w.removed.bench && did.removed.includes('bench')));
  out.push(result('layout: the ball is where it was left', near(w.ball.position.x, -2.2) && near(w.ball.position.z, 2.4) && !w.ballGone));
  // 4. the ball can be gone too
  L().apply({ ...clone(s1), ball: null });
  out.push(result('layout: a ball the user took out stays out', w.ballGone === true));
  T.addObject('ball');
  // 5. a damaged save: a piece saved on top of the piano or outside the room is moved to a free spot, junk is ignored
  const bad = clone(s1);
  bad.objects.plant = { x: w.objects.piano.x, z: w.objects.piano.z, rot: 0 };
  bad.objects.lamp = { x: 99, z: -99, rot: 0 };
  bad.decor.picture = { u: 50, v: 9, rot: 0 };
  const dBad = L().apply(bad);
  out.push(result('layout: pieces saved where they cannot be are moved to a free spot', Object.values(w.objects).every((o) => w.fits(o, o.x, o.z)) && Object.values(w.decor).every((d) => w.decorFits(d, d.u, d.v)) && dBad.replaced.includes('plant') && dBad.replaced.includes('lamp'), { replaced: dBad.replaced }));
  const before = JSON.stringify(L().snapshot());
  let threw = null;
  try { for (const j of [null, undefined, {}, [], 'x', { v: 2, objects: {} }, { v: 1, objects: { plant: { x: 'a', z: NaN } }, decor: { picture: { u: null } }, out: [5, null], ball: 'x' }]) L().apply(j); } catch (e) { threw = String(e); }
  out.push(result('layout: nothing, junk or a newer format changes nothing and does not throw', !threw && before === JSON.stringify(L().snapshot()), { threw }));
  out.push(result('layout: with saving off (?fresh) restore does nothing', L().restore().applied === false));
  // 6. through real storage: a second copy of the module writes only when something changed, and a visit reads it back
  const L2 = initLayout({ world: w, guy: G(), remove: roomDrop, persist: true, key: 'guy.layout.test' });
  try {
    const first = L2.save(), again = L2.save();
    moveTo('plant', { x: 2.5, z: 2.5 });
    const changed = L2.save();
    const savedPlant = [w.objects.plant.x, w.objects.plant.z];
    moveTo('plant', { x: -3, z: -2 });
    const back = L2.restore();
    out.push(result('layout: saving writes once, skips an unchanged room, writes again after a change; restoring reads it back', first && !again && changed && back.applied && near(w.objects.plant.x, savedPlant[0]) && near(w.objects.plant.z, savedPlant[1]), { first, again, changed }));
  } finally { try { localStorage.removeItem('guy.layout.test'); } catch { /* no storage */ } }
  // 7. with a door: the door goes back last, and a piece saved in its way comes out
  const free = clone(L().snapshot());
  const dr = R().add('workshop', { at: { wall: 'right', u: 2.6 } });
  const rs = clone(R().snapshot()), ls = clone(L().snapshot());
  R().reset('workshop'); L().apply(clone(free));
  const legacy = clone(free); legacy.objects.plant = { x: 4.5, z: 2.6, rot: 0 };          // an older save with a piece standing where the door goes
  L().apply(legacy);
  const rr = R().restoreFrom(rs);
  out.push(result('layout: the saved door goes back last and clears the way', dr.ok && rr.length === 1 && rr[0].ok && !doorProblems('workshop').length && !!w.removed.plant, { rr, problems: doorProblems('workshop') }));
  R().reset('workshop'); L().apply(clone(ls));
  // 8. Guy stands on a free spot even if the saved layout has furniture where he starts
  G().root.position.set(w.objects.armchair.x, 0, w.objects.armchair.z);
  const moved = L().unstickGuy();
  const gp = G().pos;
  out.push(result('layout: Guy never starts inside furniture', moved && !w.obstacles.some((o) => gp.x > o.x0 - 0.4 && gp.x < o.x1 + 0.4 && gp.z > o.z0 - 0.4 && gp.z < o.z1 + 0.4)));
  T.home(); T.resetRooms(); machine().hidden = true;
  for (const [n, o] of [...Object.entries(w.objects), ...Object.entries(w.removed)]) if (!o.decor && n in rot0 && o.rot !== rot0[n]) { o.rot = rot0[n]; o.group.rotation.y = o.yaw; if (w.objects[n]) o.set(o.x, o.z); }
  out.push(result('layout: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 16. The bookshelf holds 16 books; the rest lie flat in a stack on the floor beside it ----------------------------------------
T.sweepShelf = () => {
  const out = [], base = errors.length, w = W(), b = B(), sh = w.objects.shelf;
  const recs = [];
  T.settle(); T.home();
  for (const r of [...sh.books]) if (!r.def.start) sh.removeBook(r);          // start from the shelf as it begins (earlier sweeps leave books on it)
  for (const d of BOOK_CATALOG) if (!d.locked && !sh.books.some((r) => r.def.id === d.id)) recs.push(sh.addBook(d));
  const onShelf = sh.books.filter((r) => !r.stack), stack = sh.books.filter((r) => r.stack).sort((x, y) => x.slot - y.slot);
  out.push(result('shelf: with every book added, the shelf holds 16 and the rest are stacked', sh.books.length > 16 && onShelf.length === 16 && stack.length === sh.books.length - 16, { total: sh.books.length, onShelf: onShelf.length, stacked: stack.length }));
  out.push(result('shelf: every book on the shelf is inside the frame, none sticks out of the end', onShelf.every((r) => r.z - r.w / 2 >= -0.875 && r.z + r.w / 2 <= 0.875), { out: onShelf.filter((r) => r.z - r.w / 2 < -0.875 || r.z + r.w / 2 > 0.875).map((r) => r.def.id) }));
  const flat = stack.every((r) => Math.abs(r.mesh.rotation.x - Math.PI / 2) < 0.01);
  const lowest = stack.length ? stack[0].mesh.position.y - stack[0].w / 2 : 0;
  let resting = true;
  for (let i = 1; i < stack.length; i++) resting = resting && Math.abs((stack[i].mesh.position.y - stack[i].w / 2) - (stack[i - 1].mesh.position.y + stack[i - 1].w / 2)) < 0.01;
  out.push(result('shelf: stacked books lie flat on their side, the first on the floor and each resting on the one below (nothing floats)', stack.length > 0 && flat && Math.abs(lowest) < 0.01 && resting, { flat, lowest, resting }));
  const l = stack.length ? stack[0].mesh.getWorldPosition(new THREE.Vector3()) : null;
  out.push(result('shelf: the stack is beside the shelf, inside the room and clear of furniture', !!l && Math.abs(stack[0].z) > 1.15 && Math.abs(l.x) < 4.7 && Math.abs(l.z) < 3.6 && w.obstacles.some((o) => o.name === 'bookstack'), { l }));
  const obs = w.obstacles.find((o) => o.name === 'bookstack');
  const lamp = (T.addObject('lamp'), w.objects.lamp);
  out.push(result('shelf: nothing can be put on top of the stack', !!obs && !w.fits(lamp, (obs.x0 + obs.x1) / 2, (obs.z0 + obs.z1) / 2)));
  // the stack goes with the shelf when it is moved
  const x0 = sh.x, z0 = sh.z, spot = w.findSpot(sh, { x: 2.5, z: -2.6 }, null);
  if (spot) {
    sh.set(spot.x, spot.z);
    const o2 = w.obstacles.find((o) => o.name === 'bookstack'), p2 = stack[0].mesh.getWorldPosition(new THREE.Vector3());
    out.push(result('shelf: the stack moves with the shelf', !!o2 && p2.x > o2.x0 && p2.x < o2.x1 && p2.z > o2.z0 && p2.z < o2.z1, { o2, p2 }));
    sh.set(x0, z0);
  }
  // Guy reads the top book of the stack, squatting to it, and puts it back on top
  const top = sh.stackTop(), topY = top.mesh.position.y;
  b.forgetBook && skillsOf().known.delete(top.def.teaches);
  b.requestRead(top.def.id);
  let t = 0, held = false, squatted = false;
  while (t < 120) {
    step(0.25); t += 0.25;
    if (b.held === top) held = true;
    if (b.held === top && b.pose === 'grab' && b.step && b.step.t > 0.6 && b.step.t < 1.2) { const lg = b.g.bones.RightLeg && b.g.bones.RightLeg.rotation.x; if (Math.abs(lg) > 0.5) squatted = true; }
    if (held && !b.held && top.mesh.visible && t > 15) break;
  }
  out.push(result('shelf: Guy reads the top book of the stack and puts it back where it was', held && top.mesh.visible && Math.abs(top.mesh.position.y - topY) < 0.005 && b.skills.has(top.def.teaches), { held, back: top.mesh.visible, t }));
  out.push(result('shelf: he squats down to take it from the floor stack', squatted));
  T.settle();
  // the book list: all of them, on the screen, and scrolls when it is long
  window.__guyOpenBooks();
  const am = document.getElementById('albummenu'), r = am.getBoundingClientRect();
  out.push(result('shelf: the long-press book list lists every book and stays on the screen (it scrolls when it is long)', r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1 && am.querySelectorAll('.brow').length === sh.books.filter((x) => x.mesh.visible).length && getComputedStyle(am).overflowY === 'auto', { top: r.top, bottom: r.bottom, h: innerHeight, rows: am.querySelectorAll('.brow').length }));
  am.hidden = true;
  // taking stacked books away leaves the rest settled, and an empty stack leaves no obstacle
  for (const r2 of stack.slice(0, 1)) sh.removeBook(r2);
  const rest = sh.books.filter((x) => x.stack).sort((x, y) => x.slot - y.slot);
  let settled = rest.length === 0 || Math.abs(rest[0].mesh.position.y - rest[0].w / 2) < 0.01;
  for (let i = 1; i < rest.length; i++) settled = settled && Math.abs((rest[i].mesh.position.y - rest[i].w / 2) - (rest[i - 1].mesh.position.y + rest[i - 1].w / 2)) < 0.01;
  out.push(result('shelf: when a stacked book is taken away the others settle', settled));
  for (const r2 of recs) sh.removeBook(r2);
  out.push(result('shelf: with the extra books gone there is no stack and no obstacle', !sh.books.some((x) => x.stack) && !w.obstacles.some((o) => o.name === 'bookstack')));
  T.removeAll(); T.settle();
  out.push(result('shelf: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 17. Doors: long-press a door and Guy goes in (src/room.js doors, brain.js visit / leave) -------------------------------------
T.sweepVisit = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  for (const wall of ['right', 'front', 'back']) {
    T.resetRooms(); T.removeAll(); T.settle(); T.home();
    const res = R().add('workshop', { walls: [wall] });
    if (!res.ok) { out.push(result(`visit: ${wall} wall: a door could be put there`, false, { res })); continue; }
    const door = w.doors.workshop, bnd = door.shell.bounds;
    out.push(result(`visit: ${wall} wall: the wall has a real doorway and the door is shut`, !door.cut.parent === false && door.open === 0 && w.walkable(w.doorPoint('workshop', 0).x, w.doorPoint('workshop', 0).z) === false));
    // the menu on the door
    window.__guyOpenDoorMenu('workshop');
    const menu = document.getElementById('menu'), visible = [...menu.querySelectorAll('[data-act]')].filter((x) => !x.hidden);
    out.push(result(`visit: ${wall} wall: long-pressing the door offers just "Go into the Workshop"`, visible.length === 1 && /Go into the Workshop/.test(visible[0].textContent), { shown: visible.map((x) => x.textContent) }));
    visible[0].click();
    // he walks to the door, it opens, he goes in, looks round, comes out and shuts it
    let t = 0, opened = false, inside = false, outside = 0, badSpot = 0, fullyOpen = false;
    while (t < 150) {
      step(0.25); t += 0.25;
      if (door.open > 0.9) fullyOpen = true;
      if (door.open > 0.05) opened = true;
      const p = g.pos;
      if (p.x > bnd.minX + 0.4 && p.x < bnd.maxX - 0.4 && p.z > bnd.minZ + 0.4 && p.z < bnd.maxZ - 0.4) inside = true;
      if (!w.walkable(p.x, p.z) && !w.inMain(p.x, p.z)) badSpot++;
      if (inside && b.inMain() && door.open === 0 && !b.step) outside++;
      if (inside && b.inMain() && door.open === 0 && t > 30) break;
    }
    const back = b.inMain();
    out.push(result(`visit: ${wall} wall: he opens the door, goes into the room, comes back and shuts the door`, opened && fullyOpen && inside && back && door.open === 0, { opened, fullyOpen, inside, back, open: door.open, t }));
    out.push(result(`visit: ${wall} wall: he never stands anywhere he should not (walls, outside the rooms)`, badSpot === 0, { badSpot }));
    // interrupted while inside: he leaves by the door (and does not try to path across the wall); a request for his own room waits until he is back
    b.visitRoom('workshop');
    let t2 = 0, nowInside = false;
    while (t2 < 60 && !nowInside) { step(0.25); t2 += 0.25; const p = g.pos; nowInside = p.x > bnd.minX + 0.6 && p.x < bnd.maxX - 0.6 && p.z > bnd.minZ + 0.6 && p.z < bnd.maxZ - 0.6; }
    T.addObject('plant');
    b.skip(); b.interact('plant');
    let t3 = 0, plantDone = false;
    while (t3 < 120) { step(0.25); t3 += 0.25; if (b.last === 'plant' && b.inMain()) plantDone = true; if (plantDone && door.open === 0) break; }
    out.push(result(`visit: ${wall} wall: cut short inside, he comes out through the door first and then does what was asked`, nowInside && b.inMain() && plantDone && door.open === 0, { nowInside, plantDone, open: door.open }));
    // asked to come back while inside
    b.visitRoom('workshop');
    t2 = 0; nowInside = false;
    while (t2 < 60 && !nowInside) { step(0.25); t2 += 0.25; const p = g.pos; nowInside = p.x > bnd.minX + 0.6 && p.x < bnd.maxX - 0.6 && p.z > bnd.minZ + 0.6 && p.z < bnd.maxZ - 0.6; }
    const msg = b.visitRoom('workshop');
    let t4 = 0; while (t4 < 60 && !(b.inMain() && door.open === 0)) { step(0.25); t4 += 0.25; }
    out.push(result(`visit: ${wall} wall: asked to come back from inside, he does`, nowInside && /coming back/i.test(msg.message) && b.inMain() && door.open === 0, { msg: msg.message, t4 }));
    T.settle();
  }
  T.resetRooms(); T.home(); T.removeAll(); T.settle(); machine().hidden = true; document.getElementById('menu').hidden = true;
  out.push(result('visit: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 18. The Workshop: the furniture and tools, and what Guy builds with them (src/workobjects.js, workbrain.js, workshop.js) ----
const SHOP = ['workbench', 'toolbox', 'woodfactory', 'saw', 'mallet', 'sander'];
const ALL_SHOP_SKILLS = ['workshop', 'workshop.materials', 'workshop.furniture'];
const shopSetup = (wall = 'right', skills = ALL_SHOP_SKILLS) => {
  T.settle();                                                                      // (a cut-short job puts its stock back while he settles: do that first)
  T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  const st0 = W().stock; st0.wood = 0; st0.parts = 0; st0.items = {};
  const res = R().add('workshop', { walls: [wall] });
  for (const id of SHOP) T.addObject(id);
  T.learn(skills);
  return res;
};
const runUntil = (cond, max = 120, dt = 0.25) => { let t = 0; while (t < max && !cond()) { step(dt); t += dt; } return t; };
const sfxNow = () => ({ ...sfxCounts });
const heard = (a, b, k) => (b[k] || 0) - (a[k] || 0);
T.sweepWorkshop = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  // 1. nothing of the Workshop is listed until the room is added
  T.resetRooms(); T.removeAll();
  openObjects('all');
  out.push(result('workshop: before the room is added none of its furniture or books is listed', !SHOP.some((id) => machineCard(OBJECT_CATALOG.find((d) => d.id === id).name)) && !machineCard('Workshop Basics')));
  const ax = (id) => { const o = w.objects[id]; return o ? { x: o.x, z: o.z } : null; };
  for (const wall of ['right', 'front', 'back']) {
    const res = shopSetup(wall);
    out.push(result(`workshop: ${wall} wall: the room and all six pieces of furniture are added through the Catalogue`, res.ok && SHOP.every((id) => !!w.objects[id]), { res: res.ok }));
    const objs = SHOP.map((id) => w.objects[id]).filter(Boolean);
    const inside = objs.every((o) => w.roomIdAt(o.x, o.z) === 'workshop' && w.fits(o, o.x, o.z));
    let overlap = null;
    for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) if (rectsOv(objs[i].obstacle, objs[j].obstacle)) overlap = [objs[i].name, objs[j].name];
    out.push(result(`workshop: ${wall} wall: everything stands inside the room, clear of the door and of each other`, inside && !overlap, { inside, overlap }));
    // where he stands to use each one is free floor in the room
    const axes = w.shellAxes('workshop');
    const stands = [['workbench', 0.78], ['toolbox', 0.6], ['woodfactory', 0.78], ['saw', 0.72], ['mallet', 0.55], ['sander', 0.52]].map(([n, f]) => { const o = w.objects[n], l = o.local(0, f); return { n, x: o.x + l.x, z: o.z + l.z }; });
    const badStand = stands.filter((p) => w.roomIdAt(p.x, p.z) !== 'workshop' || w.obstacles.some((o) => p.x > o.x0 - 0.25 && p.x < o.x1 + 0.25 && p.z > o.z0 - 0.25 && p.z < o.z1 + 0.25 && o !== w.objects[p.n].obstacle));
    out.push(result(`workshop: ${wall} wall: the place he stands to use each one is free floor`, !badStand.length, { badStand: badStand.map((p) => p.n) }));
    const wbq = w.objects.workbench.local(0, 1);
    out.push(result(`workshop: ${wall} wall: the workbench faces the door`, wbq.x * axes.toDoor.x + wbq.z * axes.toDoor.z > 0.9));
  }
  // 2. what he says when he cannot (kind messages)
  shopSetup('right', []);
  b.queue = []; b.step = null;
  const noBook = b.interact('saw');
  const kind = (m) => !BANNED.test(m);                       // kind wording (these messages are longer than a toast)
  out.push(result('workshop: without the book he is refused kindly and told which book', !noBook.ok && /Wood & Metal Basics/.test(noBook.message) && kind(noBook.message), { noBook }));
  T.learn(['workshop.materials']);
  const noWood = b.interact('saw');
  out.push(result('workshop: with the book but no planks he says to make some at the Wood Factory', !noWood.ok && /Wood Factory/.test(noWood.message) && kind(noWood.message), { noWood }));
  const noBench = b.interact('workbench');
  out.push(result('workshop: the workbench names the book he still needs (Workshop Basics)', !noBench.ok && /Workshop Basics/.test(noBench.message) && kind(noBench.message), { noBench }));
  // 3. a whole build from nothing: planks from the factory, sawn, tapped, sanded, finished and counted in storage
  const builds = [['footstool', 'right'], ['footstool', 'front'], ['footstool', 'back'], ['woodshelves', 'right'], ['chair', 'right']];
  for (const [recipe, wall] of builds) {
    shopSetup(wall);
    const R0 = RECIPES_DEF[recipe];
    b.pickRecipe = () => recipe;
    const door = w.doors.workshop, s0 = sfxNow();
    const planks = Math.ceil(R0.parts / 2), runs = Math.ceil(planks / 4);
    const r = b.interact('workbench');
    let t = 0, wentIn = false, bad = 0, doorOpened = false, armed = false;
    while (t < 520) {
      step(0.25); t += 0.25;
      if (!armed && b.last === 'build') { armed = true; b.pendingActivity = 'wander'; }      // the next thing he does is just wander, so the end is easy to see
      if (b.inWorkshop()) wentIn = true;
      if (door.open > 0.5) doorOpened = true;
      if (!w.walkable(g.pos.x, g.pos.z) && !w.inMain(g.pos.x, g.pos.z)) bad++;
      if (armed && wentIn && b.inMain() && b.last !== 'build' && door.open === 0) break;
    }
    delete b.pickRecipe;
    const st = w.stock, s1 = sfxNow(), saw = w.objects.saw, ml = w.objects.mallet, fac = w.objects.woodfactory, tb = w.objects.toolbox, wb = w.objects.workbench;
    const item = Object.values(w.objects).filter((o) => o.kind === R0.object && w.roomIdAt(o.x, o.z) === 'workshop').length;   // standing in the Workshop
    const stored0 = st.items[R0.object] || 0;
    const left = runs * 4 - planks;
    out.push(result(`workshop: build ${recipe} from nothing (${wall} wall): it goes in, makes planks, saws, taps${R0.sand ? ', sands' : ''}, finishes and comes out, and the thing it made stands in the Workshop`, r.ok && wentIn && doorOpened && item === 1 && stored0 === 0 && b.inMain() && door.open === 0, { r, wentIn, doorOpened, item, stored0, inMain: b.inMain(), open: door.open, t }));
    out.push(result(`workshop: build ${recipe} (${wall}): the stock adds up (${planks} planks sawn, ${left} left over, no parts left, nothing carried or left on a machine)`, st.wood === left && st.parts === 0 && b.carry === null && !saw.plankA.visible && !ml.assembly.children.length && !fac.tray.children.length && tb.open === 0, { stock: JSON.parse(JSON.stringify(st)), left, carry: b.carry }));
    const needSounds = ['saw', 'tap', 'machine', 'lid', 'chime', ...(R0.sand ? ['sand'] : [])];
    out.push(result(`workshop: build ${recipe} (${wall}): every step makes its sound`, needSounds.every((k) => heard(s0, s1, k) > 0), { silent: needSounds.filter((k) => !(heard(s0, s1, k) > 0)) }));
    out.push(result(`workshop: build ${recipe} (${wall}): he never stands where he should not, and there are no errors`, bad === 0 && errors.length === base, { bad, errors: errors.slice(base) }));
  }
  // 4. cut short: nothing is lost or left behind
  const cut = (label, cond, expect) => {
    shopSetup('right');
    w.stock.wood = 3; w.syncStock();
    b.queue = []; b.step = null; b.choose('sawwood');
    const t = runUntil(cond, 90);
    const had = { carry: b.carry, wood: w.stock.wood, parts: w.stock.parts };
    b.skip(); T.settle();
    const st = w.stock, saw = w.objects.saw;
    out.push(result(`workshop: cut short ${label}: the stock is put back and nothing is left on the sawhorse or in his hands`, t < 90 && st.wood === expect.wood && st.parts === expect.parts && b.carry === null && !saw.plankA.visible && b.inMain(), { had, stock: { wood: st.wood, parts: st.parts }, expect, t }));
  };
  cut('while carrying the plank to the sawhorse', () => b.carry === 'plank', { wood: 3, parts: 0 });
  cut('while sawing', () => b.pose === 'workSaw', { wood: 3, parts: 0 });
  cut('while carrying the parts away', () => b.carry === 'parts', { wood: 2, parts: 2 });
  {
    shopSetup('right');
    w.stock.wood = 0; w.stock.parts = 4; w.syncStock();
    b.pickRecipe = () => 'footstool';
    b.queue = []; b.step = null; b.choose('build');
    const t = runUntil(() => b.pose === 'workTap' && b.step && b.step.t > 2, 120);
    const during = w.stock.parts;
    b.skip(); T.settle();
    delete b.pickRecipe;
    out.push(result('workshop: cut short while tapping the parts together: they go back in the stock', t < 120 && during === 0 && w.stock.parts === 4 && !w.objects.mallet.assembly.children.length && b.carry === null && b.inMain(), { during, after: w.stock.parts, t }));
  }
  // 5. locked on the workbench he stays in the Workshop between jobs and comes out when told to stop
  shopSetup('right');
  w.stock.wood = 2; w.syncStock();
  const lk = b.lockOn('workbench');
  const chosen = []; const origChoose = b.choose.bind(b);
  b.choose = (f) => { origChoose(f); chosen.push(b.last); };
  let stayed = true, lt = 0;
  try { while (lt < 240) { step(0.25); lt += 0.25; if (lt > 40 && !b.inWorkshop() && !b.step) stayed = false; } } finally { b.choose = origChoose; }
  const stillIn = b.inWorkshop() && !!b.lock;
  b.unlock(true);
  const t5 = runUntil(() => b.inMain() && w.doors.workshop.open === 0, 120);
  out.push(result('workshop: locked on the workbench he keeps working in the Workshop without going out between jobs, and comes out when told to stop', lk.ok && stayed && stillIn && chosen.length >= 2 && chosen.every((n) => ['build', 'makewood', 'sawwood', 'putback', 'dropball'].includes(n)) && t5 < 120 && b.inMain(), { lk: lk.ok, stayed, stillIn, chosen, t5 }));
  // 6. what he makes is counted in storage and added to the room from the Catalogue, one at a time, as real objects
  T.resetRooms(); T.removeAll(); R().add('workshop'); w.stock.items = { footstool: 2, builtchair: 1 };
  openObjects('all');
  const card = machineCard('Wooden Foot Stool');
  out.push(result('workshop: the Catalogue shows what is in storage and offers Add', !!card && /In storage: 2/.test(card.textContent) && !!card.querySelector('.act') && !!machineCard('Wooden Shelves') && /None in storage/.test(machineCard('Wooden Shelves').textContent)));
  card.querySelector('.act').click(); machine().hidden = true;
  const fsNames = Object.values(w.objects).filter((o) => o.kind === 'footstool').map((o) => o.name);
  out.push(result('workshop: Add takes one out of storage and makes a real object of its own', fsNames.length === 1 && fsNames[0] === 'footstool_1' && w.stock.items.footstool === 1 && w.fits(w.objects.footstool_1, w.objects.footstool_1.x, w.objects.footstool_1.z)));
  T.addObject('builtchair'); const ch = b.chairs().some((c) => c.name === 'builtchair_1');
  out.push(result('workshop: a chair Guy built is a chair he can sit on', ch));
  const snap = JSON.parse(JSON.stringify(w.layout.snapshot()));
  out.push(result('workshop: the saved layout records what is in the room that he built and what is in storage', snap.instances.length === 2 && snap.stock.items.footstool === 1));
  const px = w.objects.footstool_1.x, pz = w.objects.footstool_1.z;
  T.removeAll();
  out.push(result('workshop: taking a built thing out of the room puts it back in storage (nothing is lost)', !Object.values(w.objects).some((o) => o.kind) && w.stock.items.footstool === 2 && w.stock.items.builtchair === 1, { items: { ...w.stock.items } }));
  w.layout.apply(snap);
  out.push(result('workshop: a restored layout brings the built things back where they were, with the storage counts as saved', !!w.objects.footstool_1 && near(w.objects.footstool_1.x, px) && near(w.objects.footstool_1.z, pz) && !!w.objects.builtchair_1 && w.stock.items.footstool === 1 && !w.stock.items.builtchair, { items: { ...w.stock.items } }));
  // 7. the room takes its furniture and stock with it
  T.resetRooms();
  out.push(result('workshop: taking the room away takes its furniture and stock with it, and nobody is left inside', !SHOP.some((id) => w.objects[id]) && b.inMain() && w.stock.wood === 0 && Object.keys(w.stock.items).length === 0));
  T.removeAll(); T.settle(); machine().hidden = true;
  out.push(result('workshop: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 19. The Restaurant: the room, its customers and what Guy does for them (src/restobjects.js, customers.js, restbrain.js) ----
const REST = ['stove', 'kitchencounter', 'register', 'diningtable', 'diningtable2'];
const dishPrice = (c) => DISHES[c.dish].price;
const restSetup = (wall = 'front', { skill = true } = {}) => {
  T.settle();
  T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('restaurant');
  const res = R().add('restaurant', { walls: [wall] });
  for (const id of REST) T.addObject(id);
  if (skill) T.learn(['restaurant']);
  const r = W().restaurant;
  r.paused = true; r.headless = true;                                              // no arrivals by themselves, and no figures to load
  return res;
};
T.sweepRestaurant = () => {
  const out = [], base = errors.length, w = W(), b = B(), r = w.restaurant;
  const wasHeadless = r.headless;
  try {
    // 0. it is a premium room: listed locked, with no Add button, and adding it does nothing until it is unlocked
    T.resetRooms(); T.removeAll();
    openTab('rooms');
    const rc = machineCard('Restaurant');
    const refused = R().add('restaurant');
    out.push(result('restaurant: the Rooms tab lists it as premium and locked (no Add button), and adding it is refused', !!rc && !rc.querySelector('.act') && /Premium/.test(rc.textContent) && !refused.ok && !R().isAdded('restaurant'), { refused: refused.messages }));
    // the development button beside the build id turns every premium thing on (and off again)
    const dbtn = document.getElementById('devunlock');
    dbtn.click();
    const onNow = R().isUnlocked('restaurant') && R().isLive('restaurant') === false;
    openTab('rooms'); const rc2 = machineCard('Restaurant'); const canAdd = !!(rc2 && rc2.querySelector('.act'));
    dbtn.click();
    out.push(result('restaurant: the development unlock button makes the premium room addable, and pressing it again locks it', onNow && canAdd && !R().isUnlocked('restaurant') && dbtn.textContent === '🔓 unlock premium', { onNow, canAdd }));
    // 1. nothing of the Restaurant is listed until the room is added
    openObjects('all');
    out.push(result('restaurant: before the room is added none of its furniture or its book is listed', !REST.some((id) => machineCard(OBJECT_CATALOG.find((d) => d.id === id).name)) && !machineCard('Restaurant Basics')));
    for (const wall of ['front', 'back', 'right']) {
      const res = restSetup(wall);
      const door = w.doors.restaurant;
      out.push(result(`restaurant: ${wall} wall: the room, its elevator and all five pieces of furniture are added through the Catalogue`, res.ok && REST.every((id) => !!w.objects[id]) && !!door && !!door.elevator, { res: res.ok }));
      const objs = REST.map((id) => w.objects[id]).filter(Boolean);
      const inside = objs.every((o) => w.roomIdAt(o.x, o.z) === 'restaurant' && w.fits(o, o.x, o.z));
      let overlap = null;
      for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) if (rectsOv(objs[i].obstacle, objs[j].obstacle)) overlap = [objs[i].name, objs[j].name];
      for (const o of objs) if (rectsOv(door.elevator.obstacle, o.obstacle)) overlap = [o.name, 'elevator'];
      out.push(result(`restaurant: ${wall} wall: everything stands inside the room, clear of the door, the elevator and each other`, inside && !overlap && objs.every((o) => !rectsOv(door.rect, o.obstacle)), { inside, overlap }));
      // where he stands for each job, and where the customers stand and sit, is free floor inside the room
      const at = (n, dx, dz) => { const o = w.objects[n], l = o.local(dx, dz); return { n, x: o.x + l.x, z: o.z + l.z }; };
      const pay = r.paySpot();
      const spots = [at('stove', 0, 0.62), at('kitchencounter', -0.1, 0.62), at('kitchencounter', 0.46, 0.62), at('register', -0.25, 0.62), { n: 'register', x: pay.x, z: pay.z },
        ...['diningtable', 'diningtable2'].flatMap((t) => [at(t, 0, 1.42), at(t, 0, -1.42), at(t, 0.78, 0.45), at(t, 0.78, -0.45)])];
      const badSpot = spots.filter((p) => w.roomIdAt(p.x, p.z) !== 'restaurant' || w.obstacles.some((o) => p.x > o.x0 - 0.2 && p.x < o.x1 + 0.2 && p.z > o.z0 - 0.2 && p.z < o.z1 + 0.2 && o !== w.objects[p.n].obstacle));
      out.push(result(`restaurant: ${wall} wall: the places he and the customers stand are free floor`, !badSpot.length, { badSpot: badSpot.map((p) => `${p.n}@${p.x.toFixed(1)},${p.z.toFixed(1)}`) }));
    }

    // 2. what he says when he cannot (kind messages)
    restSetup('front', { skill: false });
    const noBook = b.interact('stove');
    out.push(result('restaurant: without the book he is refused kindly and told which book', !noBook.ok && /Restaurant Basics/.test(noBook.message) && !BANNED.test(noBook.message), { noBook }));
    T.learn(['restaurant']);
    w.removeObject('register'); b.objectRemoved('register');
    const noTill = b.interact('stove');
    out.push(result('restaurant: with the book but a part of it missing he says what the restaurant needs', !noTill.ok && /cash register/.test(noTill.message) && !BANNED.test(noTill.message), { noTill }));
    out.push(result('restaurant: customers do not arrive while the restaurant cannot open', !r.isOpen() && r.spawn() === null));

    // 3. nobody comes if Guy has not read the book; once he has, they do
    restSetup('front', { skill: false });
    r.paused = false; r.spawnIn = 0; step(10);
    out.push(result('restaurant: without the book nobody arrives', r.list.length === 0 && r.stats.arrived === 0));
    T.learn(['restaurant']); r.spawnIn = 0; step(2);
    out.push(result('restaurant: once Guy has read the book a customer arrives and the elevator doors open', r.list.length === 1 && w.doors.restaurant.elevator.group.userData.openTo === 1, { n: r.list.length }));

    // 4. a whole visit from the elevator to the elevator, looked after by Guy
    for (const wall of ['front', 'back', 'right']) {
      restSetup(wall);
      const s0 = sfxNow(), lift = w.doors.restaurant.elevator.group.userData;
      const c = r.spawn('aj'), seen = [];
      let t = 0, bad = 0, opened = false, openAtEnter = false, wentIn = false;
      while (t < 400 && r.list.includes(c)) {
        step(0.25); t += 0.25;
        if (seen[seen.length - 1] !== c.state) seen.push(c.state);
        if (lift.open > 0.9) opened = true;
        if (b.inRestaurant()) wentIn = true;
        if (w.roomIdAt(c.x, c.z) !== 'restaurant') bad++;
        if (c.state === 'ridden' && lift.open > 0.5) openAtEnter = true;
      }
      const want = ['ride', 'exit', 'walk', 'sitdown', 'seated', 'waiting', 'ordered', 'cooking', 'cooked', 'eating', 'standup', 'walk', 'paying', 'thanks', 'leave', 'enter', 'ridden'];
      const inOrder = (() => { let i = 0; for (const s of seen) if (s === want[i]) i++; return i === want.length; })();
      const k = w.objects.kitchencounter, tb = [w.objects.diningtable, w.objects.diningtable2];
      out.push(result(`restaurant: ${wall} wall: a customer comes in by the elevator, sits, orders, is cooked for and served, eats, pays and leaves by the elevator`, inOrder && !r.list.includes(c) && opened && openAtEnter && wentIn, { seen: seen.join('>'), t, opened, openAtEnter, wentIn }));
      out.push(result(`restaurant: ${wall} wall: they paid for the dish, and nothing is left on the tables, the counter or the stove`,
        w.stock.coins === dishPrice(c) && k.slots.every((s) => !s.children.length) && tb.every((x) => x.seats.every((s) => !s.plate.children.length && !s.who)) && w.objects.stove.cooking === 0, { coins: w.stock.coins, dish: c.dish }));
      const back = runUntil(() => b.inMain() && !b.carry && lift.open === 0, 120);
      out.push(result(`restaurant: ${wall} wall: Guy ends up back in his own room with his hands empty, the elevator doors shut, and the customer never left the floor`, back < 120 && b.carry === null && bad === 0, { bad, back }));
      const s1 = sfxNow(), needSounds = ['ding', 'sizzle', 'plate', 'cash', 'lift'];
      out.push(result(`restaurant: ${wall} wall: every step makes its sound`, needSounds.every((n) => heard(s0, s1, n) > 0), { silent: needSounds.filter((n) => !(heard(s0, s1, n) > 0)) }));
    }

    // 5. three customers at once: each has a seat of their own, everybody is served and pays, and nobody walks through anybody
    restSetup('front');
    const cs = [r.spawn(), r.spawn(), r.spawn()];
    out.push(result('restaurant: three customers at once sit at three different seats, and a fourth is not let in', cs.every(Boolean) && new Set(cs.map((c) => c.seat.table + c.seat.i)).size === 3 && r.spawn() === null));
    let t5 = 0, minGap = 9;
    const moving = (c) => ['walk', 'exit', 'leave'].includes(c.state);
    while (t5 < 900 && r.list.length) {
      step(0.25); t5 += 0.25;
      for (const c of r.list) if (moving(c)) for (const o of r.list) if (o !== c && moving(o)) minGap = Math.min(minGap, Math.hypot(c.x - o.x, c.z - o.z));
    }
    const paid = cs.reduce((a, c) => a + dishPrice(c), 0);
    out.push(result('restaurant: all three are served, pay the right amount and leave', !r.list.length && w.stock.coins === paid && r.stats.paid === 3, { t5, coins: w.stock.coins, paid, left: r.list.map((c) => c.state) }));
    out.push(result('restaurant: customers do not walk through each other', minGap > 0.25, { minGap: +minGap.toFixed(2) }));

    // 6. patience: nobody to look after them, they give up politely and do not pay
    restSetup('front');
    const realFind = r.find; r.find = () => undefined;
    const imp = r.stage('waiting'); const coins0 = w.stock.coins;
    let t6 = 0; while (t6 < 200 && r.list.includes(imp)) { step(0.5); t6 += 0.5; }
    r.find = realFind;
    out.push(result('restaurant: a customer nobody comes to gives up after a while, leaves by the elevator and pays nothing', !r.list.includes(imp) && w.stock.coins === coins0 && r.stats.gaveUp === 1 && t6 > 60, { t6, gaveUp: r.stats.gaveUp }));

    // 7. cut short: nothing is lost or left behind
    const cutCook = (label, cond) => {
      restSetup('front');
      const c = r.stage('ordered');
      b.queue = []; b.step = null; b.choose('cook');
      const t = runUntil(cond, 120);
      const real = r.find; b.skip(); r.find = () => undefined; step(1);                // cut short, and nothing else for him to pick up just now
      r.find = real;
      out.push(result(`restaurant: cut short ${label}: the order is waiting again, the stove is off and nothing is carried`, t < 120 && c.state === 'ordered' && w.objects.stove.cooking === 0 && b.carry === null && !c.claim && w.objects.kitchencounter.slots.every((s) => !s.children.length), { t, state: c.state }));
      r.clear(); T.settle();
    };
    cutCook('while stirring', () => b.pose === 'workTap' && b.step && b.step.t > 3);
    cutCook('while carrying the plate to the counter', () => b.carry === 'plate');
    {
      restSetup('front');
      const c = r.stage('cooked');
      b.queue = []; b.step = null; b.choose('serve');
      const t = runUntil(() => b.carry === 'plate', 120);
      const real = r.find; b.skip(); r.find = () => undefined; step(1);
      r.find = real;
      const k = w.objects.kitchencounter;
      out.push(result('restaurant: cut short while carrying the dish to the table: it goes back on the counter and the customer is still waiting for it', t < 120 && c.state === 'cooked' && k.slots[c.slot].children.length > 0 && b.carry === null && !c.claim, { t, state: c.state }));
      r.clear(); T.settle();
    }

    // 8. things taken away: the table under a customer, the stove under a cook
    restSetup('front');
    const sat = r.stage('waiting'), tname = sat.seat.table;
    w.removeObject(tname); b.objectRemoved(tname);
    let t8 = 0; while (t8 < 120 && r.list.includes(sat)) { step(0.25); t8 += 0.25; }
    out.push(result('restaurant: take their table away and the customer stands up and leaves (no fuss, no payment)', !r.list.includes(sat) && w.stock.coins === 0, { t8 }));
    restSetup('front');
    r.stage('ordered');
    b.queue = []; b.step = null; b.choose('cook');
    runUntil(() => b.pose === 'workTap', 60);
    w.removeObject('stove'); b.objectRemoved('stove');
    b.skip(); r.clear(); T.settle();
    out.push(result('restaurant: take the stove away in the middle of cooking and he stops, drops nothing and comes out', b.carry === null && b.inMain() && errors.length === base, { carry: b.carry }));

    // 9. locked on the register: he stays in the restaurant between customers and comes out when told to stop
    restSetup('front');
    const lk = b.lockOn('register');
    const chosen = []; const origChoose = b.choose.bind(b);
    b.choose = (f) => { origChoose(f); chosen.push(b.last); };
    let stayed = true, lt = 0;
    try { r.paused = false; r.spawnIn = 5; while (lt < 240) { step(0.25); lt += 0.25; if (lt > 30 && !b.inRestaurant() && !b.step) stayed = false; } } finally { b.choose = origChoose; }
    const inNow = b.inRestaurant() && !!b.lock;
    b.unlock(true); r.paused = true;
    const t9 = runUntil(() => b.inMain() && w.doors.restaurant.open === 0 && !r.list.length, 300);
    out.push(result('restaurant: locked on the register he works the restaurant without going out between customers, and comes out when told to stop', lk.ok && stayed && inNow && chosen.some((n) => ['takeorder', 'cook', 'serve', 'takepay'].includes(n)) && chosen.includes('rwait') && b.inMain(), { lk: lk.ok, stayed, inNow, chosen: [...new Set(chosen)], t9 }));

    // 10. coins are saved with the layout and come back
    restSetup('front');
    w.stock.coins = 17; w.syncStock();
    const snap = JSON.parse(JSON.stringify(w.layout.snapshot()));
    w.stock.coins = 0; w.layout.apply(snap);
    out.push(result('restaurant: the coins earned are saved with the layout and restored', snap.stock.coins === 17 && w.stock.coins === 17, { coins: w.stock.coins }));

    // 11. the room takes its customers, furniture and coins with it
    r.stage('waiting');
    T.resetRooms();
    out.push(result('restaurant: taking the room away takes its customers, furniture and coins with it, and nobody is left inside', !REST.some((id) => w.objects[id]) && r.list.length === 0 && w.stock.coins === 0 && b.inMain()));
  } finally {
    r.headless = wasHeadless; r.paused = false;
  }
  T.resetRooms(); T.removeAll(); T.settle(); machine().hidden = true;
  out.push(result('restaurant: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 20. Stations used from any side (src/approach.js): turned to face a wall, or pushed against one, he uses them from a free side ----
// [object, activity, room, stock, customer, proof]: each is put against each of the four walls of its room, turned every way, and the job has to be
// really done (`proof` is what must have happened), not just given up on
const SIDES_TESTS = [
  ['woodfactory', 'makewood', 'workshop', { wood: 0, parts: 0 }, null, (s) => s.wood >= 4], ['toolbox', 'tidytools', 'workshop', { wood: 0, parts: 0 }, null, (s) => s.lid],
  ['saw', 'sawwood', 'workshop', { wood: 2, parts: 0 }, null, (s) => s.poses.has('workSaw')], ['mallet', 'tap', 'workshop', { wood: 0, parts: 0 }, null, (s) => s.poses.has('workTap')],
  ['sander', 'sand', 'workshop', { wood: 2, parts: 0 }, null, (s) => s.poses.has('workSand')], ['workbench', 'sawwood', 'workshop', { wood: 2, parts: 0 }, null, (s) => s.poses.has('workSaw')],
  ['stove', 'cook', 'restaurant', null, 'ordered', (s) => s.poses.has('workTap') && s.cooked], ['kitchencounter', 'serve', 'restaurant', null, 'cooked', (s) => s.served],
  ['register', 'takepay', 'restaurant', null, 'paying', (s) => s.coins > 0],
];
T.sweepSides = (only = null, onlyRot = null, onlyWall = null) => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  const wallSpots = (o, bnd) => {                              // the object's centre when it touches each wall, in the middle of that wall
    const hw = o.w / 2, hd = o.d / 2, mx = (bnd.minX + bnd.maxX) / 2, mz = (bnd.minZ + bnd.maxZ) / 2;
    return [['minX', bnd.minX + hw + 0.03, mz], ['maxX', bnd.maxX - hw - 0.03, mz], ['minZ', mx, bnd.minZ + hd + 0.03], ['maxZ', mx, bnd.maxZ - hd - 0.03]];
  };
  for (const [id, act, room, stock, customer, proof] of SIDES_TESTS) {
    if (only && id !== only) continue;
    let tried = 0, passed = 0; const bad = [];
    for (let rot = 0; rot < 4; rot++) {
      for (let wi = 0; wi < 4; wi++) {
        if ((onlyRot !== null && rot !== onlyRot) || (onlyWall !== null && wi !== onlyWall)) continue;
        // start from a clean room each time
        T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
        unlockRoom(room); R().add(room, { walls: ['right'] });
        const m = MANIFEST.activities[act];
        for (const need of m.objects) T.addObject(need);
        T.learn(m.skills || []);
        const o = w.objects[id], bnd = w.doors[room].shell.bounds;
        const [wallName, x, z] = wallSpots(o, bnd)[wi];
        while (o.rot !== rot) o.rotate(1);
        const [, x2, z2] = wallSpots(o, bnd)[wi];                  // (the footprint changes with the turn)
        o.set(x2, z2); void x; void z;
        const clash = w.obstacles.some((p) => p !== o.obstacle && p.x0 < o.obstacle.x1 && p.x1 > o.obstacle.x0 && p.z0 < o.obstacle.z1 && p.z1 > o.obstacle.z0);
        if (clash || !w.fits(o, o.x, o.z)) { o.rotate(0); continue; }          // that spot is taken by another piece: not a test of this one
        if (stock) { Object.assign(w.stock, { wood: 0, parts: 0 }, stock); w.syncStock(); }
        if (customer) { w.restaurant.clear(); w.restaurant.paused = true; w.restaurant.headless = true; w.restaurant.stage(customer); }
        tried++;
        b.queue = []; b.step = null; b.choose(act);
        let t = 0, off = 0, done = false; const e0 = errors.length;
        const labels = [];
        const seen = { poses: new Set(), lid: false, cooked: false, served: false, wood: 0, coins: 0 };
        while (t < 260) {
          step(0.25); t += 0.25;
          if (b.step) seen.poses.add(b.pose);
          if (labels[labels.length - 1] !== label()) labels.push(label().slice(0, 50) + '@' + g.pos.x.toFixed(1) + ',' + g.pos.z.toFixed(1));
          if (w.objects.toolbox && w.objects.toolbox.open > 0.2) seen.lid = true;
          if (customer && w.restaurant.list[0] && ['cooked', 'eating'].includes(w.restaurant.list[0].state)) seen.cooked = true;
          seen.served = w.restaurant.nServed > 0; seen.coins = w.stock.coins; seen.wood = Math.max(seen.wood, w.stock.wood);
          if (!w.walkable(g.pos.x, g.pos.z) && !w.inMain(g.pos.x, g.pos.z)) off++;
          if (b.last !== act && t > 1) { done = true; break; }
        }
        if (customer) w.restaurant.clear();
        const ok = done && off === 0 && errors.length === e0 && b.carry === null && proof(seen);
        if (ok) passed++; else bad.push({ rot, wall: wallName, done, off, t, errs: errors.slice(e0, e0 + 1), poses: [...seen.poses].join('/'), labels: labels.slice(0, 6), obj: [+o.x.toFixed(2), +o.z.toFixed(2), o.rot], wood: seen.wood });
        T.settle();
      }
    }
    out.push(result(`sides: ${id}: ${act} works against every wall, turned every way (${tried} placements)`, tried > 0 && passed === tried, { tried, passed, bad: bad.slice(0, 3) }));
  }
  T.resetRooms(); T.removeAll(); T.settle();
  out.push(result('sides: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 13. Guitar riffs: made up, judged, and the good ones remembered (src/riffs.js) -----------------------------------------------
T.sweepRiffs = () => {
  const out = [], base = errors.length, key = 'guy.riffs.test';
  const clear = () => { try { localStorage.removeItem(key); } catch { /* no storage */ } };
  const goodRiff = () => { for (let i = 0; i < 500; i++) { const r = invent(false); if (judge(r) >= GOOD) return r; } return null; };
  try {
    clear();
    let formed = true;
    for (let i = 0; i < 300; i++) { const r = invent(); if (r.steps.length !== RIFF_STEPS || !r.steps.every((m) => Number.isFinite(m) && m >= 0 && m < 128) || r.steps.filter(Boolean).length < 2) formed = false; }
    out.push(result('riffs: every invented riff is 16 steps of notes and rests, in range', formed));
    const tidy = { root: 45, mode: 'minor', steps: [57, 0, 60, 62, 64, 62, 60, 0, 57, 0, 60, 62, 64, 62, 60, 57] };
    const noise = { root: 45, mode: 'minor', steps: [40, 90, 0, 41, 88, 39, 95, 0, 0, 60, 100, 35, 0, 0, 88, 41] };
    out.push(result('riffs: a tidy riff that repeats and comes home is good; random jumping about is not', judge(tidy) >= GOOD && judge(noise) < 0.5 && judge({ ...tidy, steps: new Array(16).fill(0) }) === 0, { tidy: judge(tidy), noise: judge(noise) }));
    let tidyGood = 0, messyGood = 0;
    for (let i = 0; i < 400; i++) { if (judge(invent(false)) >= GOOD) tidyGood++; if (judge(invent(true)) >= GOOD) messyGood++; }
    out.push(result('riffs: most tidy ideas are worth keeping and fewer messy ones are', tidyGood > 200 && messyGood < tidyGood * 0.8 && messyGood > 0, { tidyGood, messyGood }));
    // keeping: only good ones, never twice, at most 8, best first
    out.push(result('riffs: a bad riff is not kept', keepRiff(noise, key) === null && loadRiffs(key).length === 0));
    const a = goodRiff();
    out.push(result('riffs: a good riff is kept, and a second copy of it is not', !!a && !!keepRiff(a, key) && keepRiff(a, key) === null && loadRiffs(key).length === 1));
    for (let i = 0; i < 14; i++) { const r = goodRiff(); if (r) keepRiff(r, key); }
    const kept = loadRiffs(key);
    out.push(result('riffs: he keeps his best 8, best first', kept.length === 8 && kept.every((e, i) => i === 0 || kept[i - 1].score >= e.score) && kept.every((e) => e.score >= GOOD), { n: kept.length }));
    try { for (const junk of ['not json', '{"x":1}', '[{"riff":{},"score":1}]', '[null]', '[{"riff":{"root":45,"mode":"x","steps":[]},"score":1}]']) { localStorage.setItem(key, junk); if (loadRiffs(key).length) throw new Error('junk read: ' + junk); } out.push(result('riffs: an unreadable save is ignored', true)); }
    catch (e) { out.push(result('riffs: an unreadable save is ignored', false, { e: String(e) })); }
    // choosing what to play
    clear();
    let favouritesWhenEmpty = 0; for (let i = 0; i < 100; i++) if (nextRiff(key).favourite) favouritesWhenEmpty++;
    for (let i = 0; i < 4; i++) { const r = goodRiff(); if (r) keepRiff(r, key); }
    let favourites = 0; for (let i = 0; i < 200; i++) if (nextRiff(key).favourite) favourites++;
    out.push(result('riffs: with nothing kept he always invents; once he has favourites he sometimes replays one', favouritesWhenEmpty === 0 && favourites > 30 && favourites < 140, { favourites }));
    // the notes of a session: each riff twice through, bass notes on the bars
    const r1 = tidy, r2 = { ...tidy, root: 50, steps: tidy.steps.map((m) => (m ? m + 5 : 0)) };
    let ok = true;
    for (let n = 0; n < 32; n++) { const e = riffAt([r1, r2], n); if (e.note !== r1.steps[n % 16] || (e.bass !== 0) !== (n % 8 === 0) && n % 16 !== 8 && n % 16 !== 0) ok = false; }
    for (let n = 32; n < 64; n++) if (riffAt([r1, r2], n).note !== r2.steps[n % 16]) ok = false;
    out.push(result('riffs: a session plays each riff twice through and then the next', ok && riffAt([r1, r2], 64).note === r1.steps[0]));
  } finally { clear(); }
  // the activity itself: he makes up riffs, plays them with the fretting hand following, and remembers the good ones (in memory on this page)
  forgetMemoryRiffs();
  T.removeAll(); T.settle(); T.home(); T.prep('riff');
  const b = B(), oldOn = b.onRiff;
  let toasts = 0;
  b.onRiff = (m) => { toasts++; void m; };
  const run = T.run('riff', { prep: false });
  out.push(result('riffs: the riff activity runs to the end with no errors', run.completed && !run.errors.length && run.idleAfter !== false, { run: { completed: run.completed, seconds: run.seconds, errors: run.errors } }));
  for (let i = 0; i < 6; i++) T.run('riff', { prep: false });
  b.onRiff = oldOn;
  const kept2 = loadRiffs();
  out.push(result('riffs: after a few sessions he has kept good riffs he made up, and said so (in memory here: ?fresh never writes the real save)', kept2.length > 0 && kept2.length <= 8 && toasts > 0 && kept2.every((e) => e.score >= GOOD) && !localStorage.getItem('guy.riffs.v1'), { kept: kept2.length, toasts }));
  forgetMemoryRiffs();
  out.push(result('riffs: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 14. Lock in: keep using one object until told to stop (long-press > Lock in) -------------------------------------------------
T.sweepLock = () => {
  const out = [], base = errors.length, b = B(), w = W();
  const chores = ['putback', 'dropball', 'putguitar', 'lighton'];
  // object -> an activity that prepares what it needs (objects, skills, music)
  const cases = [['guitar', 'riff'], ['piano', 'sitpiano'], ['drums', 'drumsolo'], ['easel', 'mixpaint'], ['telescope', 'stargaze'], ['lamp', 'mood'], ['plant', 'plant'], ['armchair', 'read'], ['ball', 'dribble'], ['table', 'dance'], ['shelf', 'read']];
  for (const [id, prep] of cases) {
    T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
    T.prep(prep);
    if (id === 'armchair' || id === 'ball') T.addObject(id);
    T.settle(); T.home();
    const chosen = [], allowed = new Set(chores);
    const orig = b.choose.bind(b);
    b.choose = (f) => { for (const a of b.lockActs(id)) allowed.add(a); orig(f); chosen.push(b.last); };
    let r, t = 0;
    try {
      r = b.lockOn(id);
      const unlockedEarly = [];
      const poseCount = {}; let lastPose = null;
      while (t < 150) { step(0.25); t += 0.25; if (!b.lock) { unlockedEarly.push(t); break; } if (b.pose !== lastPose) { poseCount[b.pose] = (poseCount[b.pose] || 0) + 1; lastPose = b.pose; } }
      if (id === 'guitar') {
        out.push(result('lock: guitar: he keeps the guitar in his hands between riffs and songs (picked up once, never put down while locked)', (poseCount.takeGuitar || 0) <= 1 && !(poseCount.putGuitar) && chosen.length >= 3 && b.gtr.held, { poseCount, chosen, held: b.gtr.held }));
      }
      const still = !!b.lock && b.lock.name === id;
      const outside = chosen.filter((n) => !allowed.has(n));
      out.push(result(`lock: ${id}: he keeps using it for 150 s, cycling through what he can do there`, r.ok && still && chosen.length >= 2 && !outside.length, { ok: r.ok, still, chosen, outside, message: r.message }));
      const when = b.unlock(true);
      step(8);
      if (id === 'guitar') out.push(result('lock: guitar: told to stop, he puts the guitar back on its stand', !b.gtr.held));
      out.push(result(`lock: ${id}: telling him to stop lets him go and he wraps up`, when && !b.lock && !errors.length - base));
    } finally { b.choose = orig; if (b.lock) b.unlock(false); }
  }
  // other ways out and what is refused
  T.removeAll(); T.forget(); T.settle(); T.home(); T.prep('riff'); T.prep('sitpiano'); T.prep('dribble');
  out.push(result('lock: with a skill missing it is refused with the same message as Interact, and no lock is set', (() => { T.forget(); const r = b.lockOn('guitar'); return !r.ok && !b.lock && /learned the guitar/.test(r.message); })()));
  T.learn(['guitar', 'piano', 'ball']); T.addObject('ball');
  b.lockOn('guitar'); step(2);
  b.interact('ball');
  out.push(result('lock: asking him to use something else ends the lock', !b.lock));
  b.lockOn('piano'); step(2);
  b.skip(); step(1);
  out.push(result('lock: cutting the activity short does not end the lock, he goes back to it', !!b.lock && b.lock.name === 'piano'));
  const skipBtn = document.getElementById('skip-btn');
  skipBtn.click();
  out.push(result('lock: the Next button ends the lock', !b.lock));
  b.lockOn('piano'); step(2);
  w.removeObject('piano'); b.objectRemoved('piano');
  out.push(result('lock: removing the object ends the lock', !b.lock));
  T.addObject('piano'); T.addObject('bench');
  // the long-press menu and the chip
  const menu = document.getElementById('menu'), chip = document.getElementById('lock-btn');
  window.__guyOpenMenu('guitar');
  const lockBtn = menu.querySelector('[data-act=lock]');
  out.push(result('lock: the long-press menu offers "Lock in" for something he can use', !lockBtn.hidden && /Lock in/.test(lockBtn.textContent)));
  lockBtn.click();
  out.push(result('lock: tapping Lock in locks him on it and shows the Locked chip', !!b.lock && b.lock.name === 'guitar' && !chip.hidden && /Locked on guitar/.test(chip.textContent) && /🔒/.test(document.getElementById('activity').textContent + (b.lock ? '🔒' : '')), { chip: chip.textContent }));
  window.__guyOpenMenu('guitar');
  out.push(result('lock: the menu then offers "Unlock" for that object', /Unlock/.test(menu.querySelector('[data-act=lock]').textContent) && !menu.querySelector('[data-act=lock]').hidden));
  menu.querySelector('[data-act=lock]').click();
  out.push(result('lock: Unlock lets him go and hides the chip', !b.lock && chip.hidden));
  b.lockOn('guitar'); step(1);
  chip.click();
  out.push(result('lock: tapping the chip lets him go', !b.lock && chip.hidden));
  T.addObject('coffeetable');
  window.__guyOpenMenu('coffeetable');
  out.push(result('lock: nothing to lock on for something he cannot use (the coffee table has no Lock in)', menu.querySelector('[data-act=lock]').hidden));
  menu.hidden = true; T.settle();
  out.push(result('lock: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 15. Speed: walking and the pauses between interactions follow the dropdown; the interactions never do ---------------------------
T.sweepSpeed = () => {
  const out = [], b = B(), g = G(), base = errors.length, sel = document.getElementById('speed-sel');
  const old = b.speed;
  T.removeAll(); T.settle(); T.home();
  const walkTime = (k) => {
    b.speed = k; T.home(); b.skip(); b.queue = [b.walk(-3, -2.5, 0)]; b.step = null; b.pendingActivity = null;
    const t0 = b.time, ph0 = b.walkPhase;               // measured on his own clock: step(0.05) is not exactly 0.05 s of simulation
    step(0.05);
    while (b.time - t0 < 40 && b.step && b.step.type === 'walk' && b.step.x === -3) step(0.05);
    return { t: b.time - t0, dist: Math.hypot(g.pos.x + 3, g.pos.z + 2.5), phase: b.walkPhase - ph0 };
  };
  const t1 = walkTime(1), t3 = walkTime(3);
  out.push(result('speed: at 3x he walks the same route in less than half the time, and his legs go faster', t1.t > 3 && t3.t < t1.t * 0.5 && t3.dist < 0.3 && t3.phase / t3.t > (t1.phase / t1.t) * 1.8, { t1: +t1.t.toFixed(2), t3: +t3.t.toFixed(2), p1: +(t1.phase / t1.t).toFixed(1), p3: +(t3.phase / t3.t).toFixed(1) }));
  const pause = (k, pose, secs) => { b.speed = k; b.skip(); b.queue = [b.play(pose, secs)]; b.step = null; b.pendingActivity = null; const t0 = b.time; step(0.05); while (b.time - t0 < secs + 2 && b.step && b.step.pose === pose) step(0.05); return b.time - t0; };
  const p1 = pause(1, 'idle', 4), p4 = pause(4, 'idle', 4);
  out.push(result('speed: a pause between interactions is shorter at 4x', p1 > 3.5 && p4 < 1.4, { p1: +p1.toFixed(2), p4: +p4.toFixed(2) }));
  const w1 = pause(1, 'wave', 3), w4 = pause(4, 'wave', 3);
  out.push(result('speed: an interaction (waving) takes just as long at 4x', w1 > 2.8 && w4 > 2.8, { w1: +w1.toFixed(2), w4: +w4.toFixed(2) }));
  // at 4x he wanders for two minutes without error and without ever standing inside furniture
  b.speed = 4; T.settle(); b.queue = []; b.step = null; b.pendingActivity = 'wander';
  let inside = 0, t = 0;
  while (t < 120) { step(0.2); t += 0.2; for (const o of W().obstacles) if (o.active !== false && g.pos.x > o.x0 + 0.1 && g.pos.x < o.x1 - 0.1 && g.pos.z > o.z0 + 0.1 && g.pos.z < o.z1 - 0.1) inside++; }
  out.push(result('speed: two minutes of wandering at 4x never puts him inside furniture', inside === 0, { inside }));
  // the dropdown
  const values = [...sel.options].map((o) => Number(o.value));
  out.push(result('speed: the dropdown offers 1x to 4x and is at least 44 px high', JSON.stringify(values) === '[1,2,3,4]' && sel.getBoundingClientRect().height >= 44, { values, h: sel.getBoundingClientRect().height }));
  sel.value = '3'; sel.dispatchEvent(new Event('change'));
  out.push(result('speed: choosing 3x in the dropdown sets his speed', b.speed === 3));
  sel.value = '1'; sel.dispatchEvent(new Event('change'));
  out.push(result('speed: and 1x puts it back', b.speed === 1));
  b.speed = old; T.settle();
  out.push(result('speed: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 12. Automatic refresh when a newer build is deployed (src/update.js) ----------------------------------------------------------
T.sweepUpdate = () => {
  const out = [], base = errors.length, U = window.__guyUpdate;
  if (!U) return [result('update: the QA hook exists', false)];
  const oldReload = U.reloadFn, oldSave = window.__guySave;
  let reloads = 0, saves = 0;
  U.reloadFn = () => { reloads++; }; window.__guySave = () => { saves++; };
  const bar = () => document.getElementById('update-bar');
  const showing = () => !!bar() && !bar().hidden;
  try {
    U.reset();
    out.push(result('update: the same build id is not an update (no bar, no refresh)', U.apply(U.buildId, 'poll') === false && !showing() && !U.pending() && !reloads));
    // found while the tab is open: a friendly bar, a countdown, then the refresh, with the layout saved first
    const stale = U.apply('newer-1', 'poll');
    out.push(result('update: a newer build found while the tab is open shows a "Refreshing…" bar and waits', stale && showing() && /Refreshing/.test(bar().textContent) && U.pending() && reloads === 0));
    const bh = [...bar().querySelectorAll('button')].map((b) => b.getBoundingClientRect().height);
    out.push(result('update: the bar has Refresh and Later buttons, 44 px high', bh.length === 2 && bh.every((h) => h >= 44), { bh }));
    U.flush();
    out.push(result('update: when the countdown ends it saves the layout, then refreshes once', reloads === 1 && saves === 1 && !U.pending()));
    // "Later" puts it off, and it stays off
    U.reset(); reloads = 0;
    U.apply('newer-2', 'poll');
    bar().querySelector('.later').click();
    U.flush();
    const again = U.apply('newer-2', 'poll');
    out.push(result('update: Later cancels the refresh and keeps the bar away', again && reloads === 0 && !showing() && !U.pending()));
    // the tab coming back into view refreshes at once, with no bar
    U.reset(); reloads = 0; saves = 0;
    U.apply('newer-3', 'visible');
    out.push(result('update: a tab coming back into view refreshes at once, saving first, with no bar', reloads === 1 && saves === 1 && !showing()));
    // a refresh that does not bring the new build must not loop
    U.apply('newer-3', 'visible');
    out.push(result('update: the same build is not refreshed for twice in a row; the bar offers a manual Refresh instead', reloads === 1 && showing() && !/Refreshing/.test(bar().textContent)));
    bar().querySelector('.go').click();
    out.push(result('update: the manual Refresh button refreshes', reloads === 2));
    U.apply('newer-4', 'visible');
    out.push(result('update: a build newer still is refreshed for', reloads === 3));
    // how often it looks (30 s while developing, a day when live), and the "what is new" notice after a refresh
    out.push(result('update: it checks every 30 s in debug mode and every 24 h otherwise (or ?updates=)', U.everyMs === 30000 || U.everyMs === 86400000 || /[?&]updates=/.test(location.search), { every: U.everyMs }));
    U.reset(); reloads = 0;
    U.setNews([{ id: 'qa-new-entry', items: ['QA: a brand new room'] }]);
    U.apply('newer-5', 'visible');
    const toast = () => document.getElementById('news-toast');
    U.showInstalled();
    out.push(result('update: after a refresh a notice lists what is new, and OK closes it', !!toast() && /QA: a brand new room/.test(toast().textContent) && (toast().querySelector('button').click(), !toast())));
    U.showInstalled();
    out.push(result('update: the notice shows once only', !toast()));
    U.setNews(null);
  } finally {
    U.reloadFn = oldReload; window.__guySave = oldSave; U.reset();
  }
  out.push(result('update: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 13. No start screen: the sound starts on the first real touch (main.js, UNLOCK_EVENTS) ----------------------------------------
// A real tap cannot be made from here (pretend events are not trusted, which is the point), so what is checked is that there is
// no overlay in the way and that pretend events leave the audio alone. The real-tap check is in SKILL.md section 4.
T.sweepStart = () => {
  const out = [], base = errors.length;
  const ctx0 = window.__guyAudio ? window.__guyAudio().ctx : undefined;
  out.push(result('start: there is no "click to start" overlay', !document.getElementById('start')));
  out.push(result('start: the audio hook exists', typeof window.__guyAudio === 'function'));
  for (const type of ['pointerup', 'touchend', 'click']) window.dispatchEvent(new Event(type));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
  const ctx1 = window.__guyAudio ? window.__guyAudio().ctx : undefined;
  out.push(result('start: pretend (untrusted) events do not start the audio', ctx1 === ctx0));
  const icon = document.getElementById('sound-btn'), running = !!(ctx1 && ctx1.state === 'running');
  out.push(result('start: the speaker is always shown, red and pulsing while the audio is not running', !!icon && !icon.hidden && (running || icon.className === 'off'), { running, cls: icon && icon.className }));
  // the speaker is also the mute button (the audio itself may not be running in the harness, so the state is checked through the hook)
  const snd = window.__guySound, before = snd.muted();
  snd.mute(true);
  out.push(result('start: muting turns the speaker red (muted) or keeps it red (off), and silences the master volume', icon.className !== 'on' && (!window.__guyAudio().master || window.__guyAudio().master.gain.value === 0) && snd.muted()));
  snd.mute(false);
  out.push(result('start: unmuting restores the master volume and, with the audio running, the faint speaker', (!window.__guyAudio().master || window.__guyAudio().master.gain.value === 0.5) && !snd.muted() && (!running || icon.className === 'on')));
  out.push(result('start: the speaker is a 44 px button', icon.tagName === 'BUTTON' && icon.getBoundingClientRect().width >= 44 && icon.getBoundingClientRect().height >= 44));
  snd.mute(before);
  out.push(result('start: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// Guy's paintings (paintings.js / paintbrain.js): hanging from the easel's menu, the three-per-wall limit, replacing the oldest, every
// room's walls, the Catalogue, saving, and being cut short.
T.sweepPaintings = () => {
  const out = [], base = errors.length, w = W(), b = B(), P = w.paintings;
  const COLS = ['#d0312d', '#2a62d8', '#f2c500', '#2e9e4a', '#8e44ad', '#e67e22', '#16a085', '#c0392b', '#34495e', '#e84393'];
  let ci = 0;
  const easel = () => w.objects.easel;
  const paintIt = () => { const e = easel(); e.paint.dab(0.5, 0.5, COLS[ci % COLS.length], 60); e.paint.stroke(0.1, 0.2, 0.9, 0.8, COLS[(ci + 3) % COLS.length], 14); e.painted = true; ci++; };
  const fresh = () => { T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home(); T.addObject('easel'); easel().paint.clear(); easel().painted = false; P.reset(); };
  // paint something and ask for it to be hung (through the real menu button if asked); follow Guy until it is done
  const hangOne = ({ viaMenu = false } = {}) => {
    for (let i = 0; i < 20 && (b.paintingNow() || b.carry); i++) { b.skip(); step(1); }        // he is not in the middle of painting (he likes to paint again once a painting is hung)
    paintIt();
    const n0 = P.items.length, msgs = [], old = b.onBuilt;
    let at = null;
    b.onBuilt = (m) => { msgs.push(m); at = { x: G().pos.x, z: G().pos.z }; };
    let ok;
    if (viaMenu) { window.__guyOpenMenu('easel'); const btn = document.querySelector('#menu [data-act="hang"]'); ok = !btn.hidden; btn.click(); } else ok = b.hangPainting().ok;
    let t = 0;
    while (t < 240) { step(0.5); t += 0.5; if (P.items.length > n0 && b.last !== 'hangpaint' && !P.carried && !b.carry) break; }
    b.onBuilt = old;
    return { ok, at, secs: t, msgs, rec: P.items[P.items.length - 1] };
  };
  const counts = () => { const c = {}; for (const r of P.hung()) c[r.wall] = (c[r.wall] || 0) + 1; return c; };
  const wallsOk = () => Object.values(counts()).every((n) => n <= 3);
  const allFit = () => P.hung().every((r) => { const d = w.decor[P.name(r)]; return d && d.wall === r.wall && w.decorFits(d, d.u, d.v); });
  try {
    // 1. the long-press menu of the easel: the button is there only when there is a painting to hang
    fresh();
    window.__guyOpenMenu('easel');
    const hidden0 = document.querySelector('#menu [data-act="hang"]').hidden;
    paintIt();
    window.__guyOpenMenu('easel');
    const hidden1 = document.querySelector('#menu [data-act="hang"]').hidden;
    T.addObject('piano'); window.__guyOpenMenu('piano'); const hiddenOther = document.querySelector('#menu [data-act="hang"]').hidden;
    document.getElementById('menu').hidden = true;
    out.push(result('paintings: the easel menu shows "Hang painting" only while a painting is on the easel (never for other things)', hidden0 && !hidden1 && hiddenOther, { hidden0, hidden1, hiddenOther }));
    easel().paint.clear(); easel().painted = false;
    const none = b.hangPainting();
    out.push(result('paintings: with no painting he says so kindly and does nothing', !none.ok && !BANNED.test(none.message) && b.pendingActivity !== 'hangpaint', { none }));

    // 2. one painting through the real button: off the easel, carried, hung on a main-room wall by Guy's choice, he stands in front of it
    fresh();
    const one = hangOne({ viaMenu: true });
    const rec = one.rec, d = rec && w.decor[P.name(rec)], F = rec && w.wallFrame(rec.wall);
    const wallPt = F && F.at(rec.u, 0), dist = wallPt && one.at ? Math.hypot(one.at.x - wallPt.x, one.at.z - wallPt.z) : 99;
    out.push(result('paintings: "Hang painting" sends Guy to the easel, he takes the painting off (the easel is blank), carries it and hangs it on a wall', one.ok && !!d && !P.easelHas() && !easel().painted && P.hung().length === 1 && rec.room === 'main' && !b.carry && !P.carried, { ok: one.ok, secs: one.secs, rec }));
    out.push(result('paintings: he stands in front of the wall to hang it, and the painting fits there (clear of windows, pictures and the Catalogue)', dist > 0.4 && dist < 1.1 && allFit(), { dist: +dist.toFixed(2) }));
    out.push(result('paintings: the toast says where he hung it, kindly', one.msgs.length === 1 && /hung a painting in your room/.test(one.msgs[0]) && !BANNED.test(one.msgs[0]), { msgs: one.msgs }));
    out.push(result('paintings: the hung painting is a wall piece the user can drag and remove like any picture (it is in world.decor, removable)', !!d && d.decor === true && d.removable === true));

    // 3. at most three per wall; he spreads them out; when every wall is full the oldest is replaced and goes to the Catalogue
    for (let i = 0; i < 9; i++) hangOne();
    const hungN = P.hung().length;
    out.push(result('paintings: never more than 3 of his paintings on one wall', wallsOk() && hungN <= 6, { counts: counts(), hungN }));
    const stored = P.stored(), hung = P.hung();
    out.push(result('paintings: with every wall full he takes the oldest down and hangs the new one; the old ones are in the Catalogue (nothing is thrown away)', stored.length > 0 && P.items.length === 10 && stored.every((s) => hung.every((h) => s.t < h.t)), { stored: stored.map((r) => r.id), hung: hung.map((r) => r.id) }));
    out.push(result('paintings: every hung painting still fits its wall (no overlaps, nothing over the Catalogue, a window or a door)', allFit()));
    out.push(result('paintings: he spreads them over the walls instead of filling one first', Object.keys(counts()).length >= 2, { counts: counts() }));

    // 4. the Catalogue: a thumbnail of each picture, Take down for the hung ones, Hang it for the stored ones
    openObjects('all');
    const head = [...machine().querySelectorAll('h4')].find((h) => /Guy's paintings/.test(h.textContent));
    const cards = head ? (() => { const c = []; for (let n = head.nextElementSibling; n && n.tagName !== 'H4'; n = n.nextElementSibling) if (n.classList.contains('card')) c.push(n); return c; })() : [];
    const thumbs = cards.filter((c) => c.querySelector('img.thumb') && /^data:image\//.test(c.querySelector('img.thumb').getAttribute('src'))).length;
    out.push(result('paintings: the Catalogue lists every painting with a thumbnail of the picture', !!head && cards.length === P.items.length && thumbs === P.items.length, { cards: cards.length, items: P.items.length, thumbs }));
    const takeBtn = cards.map((c) => c.querySelector('.act.rm')).find(Boolean);
    const total0 = P.items.length, hung0 = P.hung().length;
    if (takeBtn) takeBtn.click();
    out.push(result('paintings: "Take down" in the Catalogue takes a painting off its wall into storage (still listed)', P.hung().length === hung0 - 1 && P.items.length === total0 && allFit(), { hung0, now: P.hung().length }));
    openObjects('all');
    const hangBtn = [...machine().querySelectorAll('.card')].filter((c) => c.querySelector('img.thumb') && /Hang it/.test(c.textContent)).map((c) => c.querySelector('.act'))[0];
    const stored0 = P.stored().length;
    if (hangBtn) hangBtn.click();
    out.push(result('paintings: "Hang it" puts a stored painting on a free wall at once (never beyond three a wall)', P.stored().length === stored0 - 1 && wallsOk() && allFit(), { stored0, now: P.stored().length }));
    let guard = 0;
    while (P.stored().length && guard++ < 20 && /^Hung in/.test(P.hangStored(P.stored()[0].id))) { /* fill every free place */ }
    const full = P.stored().length ? P.hangStored(P.stored()[0].id) : null;
    out.push(result('paintings: with no free wall "Hang it" says so kindly and the painting stays stored', full === null || (/full or blocked/.test(full) && !BANNED.test(full)), { full }));
    machine().hidden = true;

    // 5. the Workshop and the Restaurant have walls too: paintings hang there and he goes through the door for them
    fresh();
    unlockRoom('workshop'); R().add('workshop');
    unlockRoom('restaurant'); R().add('restaurant', { walls: ['front', 'back'] });
    for (let i = 0; i < 14; i++) hangOne();
    const inRooms = P.hung().filter((r) => r.room !== 'main'), roomsSeen = new Set(inRooms.map((r) => r.room));
    out.push(result('paintings: with more rooms he hangs paintings in the Workshop and the Restaurant too, three to a wall at most', inRooms.length >= 4 && roomsSeen.has('workshop') && roomsSeen.has('restaurant') && wallsOk(), { counts: counts() }));
    out.push(result('paintings: the ones in added rooms fit their walls (the elevator, furniture and windows are never covered)', allFit()));
    for (let i = 0; i < 40 && !b.inMain(); i++) step(2);
    out.push(result('paintings: afterwards he comes back to his own room', b.inMain()));
    T.settle();                                                                              // the door is shut behind him before the room goes
    const before = P.items.length, inWorkshop = P.hung().filter((r) => r.room === 'workshop').length;
    R().reset('workshop'); step(1);
    out.push(result('paintings: taking a room away puts the paintings on its walls into the Catalogue (none lost, none left floating)', inWorkshop > 0 && P.items.length === before && !P.hung().some((r) => r.room === 'workshop') && P.stored().length >= inWorkshop && Object.keys(w.removed).every((k) => !k.startsWith('guypaint_')) && allFit(), { inWorkshop }));
    const target = P.hung()[0];
    if (target) { const nm = P.name(target); w.removeObject(nm); b.objectRemoved(nm); step(1); }
    out.push(result('paintings: a painting the user removes from the wall goes to the Catalogue as a stored painting', !!target && !P.get(target.id).room && !w.decor[P.name(target)] && !w.removed[P.name(target)], { id: target && target.id }));

    // 6. saving: what hangs where, what is stored, and what is on the easel come back
    fresh();
    for (let i = 0; i < 4; i++) hangOne();
    const dd = w.decor[P.name(P.hung()[0])];
    if (dd) dd.set(dd.u + 0.3 > 4 ? dd.u - 0.3 : dd.u + 0.3, dd.v);                              // the user slides one along its wall
    step(1);
    paintIt(); easel().paint.ver++; P.tSave = 4; P.update(0.1);                                 // a painting left on the easel is saved too
    const snap = JSON.parse(JSON.stringify(P.snapshot()));
    const key = (r) => `${r.id}:${r.room}:${r.wall}:${r.u}:${r.v}`;
    const was = P.items.map(key).join('|');
    P.load(snap); step(1);
    const now = P.items.map(key).join('|');
    out.push(result('paintings: saving and loading brings every painting back where it was (including one the user slid along its wall)', was === now && P.hung().every((r) => !!w.decor[P.name(r)]) && allFit(), { was, now }));
    out.push(result('paintings: the picture on the easel is saved too', typeof snap.easel === 'string' && /^data:image\//.test(snap.easel)));
    const ghost = JSON.parse(JSON.stringify(snap));
    ghost.items.push({ id: 99, img: snap.items[0].img, room: 'nowhere', wall: 'nowhere:far', u: 0, v: 1.6, t: 99 });
    P.load(ghost); step(1);
    out.push(result('paintings: a saved painting whose room is no longer there is kept in the Catalogue', !!P.get(99) && !P.get(99).room && !w.decor[P.name(P.get(99))]));
    const before2 = P.items.length;
    P.load({ v: 7 }); P.load(null); P.load({ v: 1, items: 'x' });
    out.push(result('paintings: a damaged save does nothing', P.items.length === before2));
    const KEYP = 'guy.paintings.v1', was2 = localStorage.getItem(KEYP), persist = P.persist;
    let stored2 = false;
    try { P.persist = true; P.save(); const raw = localStorage.getItem(KEYP); stored2 = !!raw && JSON.parse(raw).items.length === P.items.length; } finally { P.persist = persist; if (was2 === null) localStorage.removeItem(KEYP); else localStorage.setItem(KEYP, was2); }
    out.push(result('paintings: they are written to the browser storage', stored2));

    // 7. cut short while carrying: the painting goes back on the easel; with no easel it goes to the Catalogue
    fresh();
    paintIt(); b.hangPainting();
    let t7 = 0; while (t7 < 90 && b.carry !== 'canvas') { step(0.25); t7 += 0.25; }
    const carried = b.carry === 'canvas' && !P.easelHas();
    b.skip();
    let t8 = 0; while (t8 < 120 && (b.carry || P.carried || b.last === 'hangpaint' || !P.easelHas())) { step(0.5); t8 += 0.5; }
    out.push(result('paintings: told to stop with the painting in his hands he takes it back to the easel', carried && P.easelHas() && !b.carry && !P.carried && P.hung().length === 0 && P.stored().length === 0, { carried, t8, last: b.last }));
    paintIt(); P.reset(); easel().painted = true;
    b.hangPainting();
    t7 = 0; while (t7 < 90 && b.carry !== 'canvas') { step(0.25); t7 += 0.25; }
    w.removeObject('easel'); b.objectRemoved('easel');
    t8 = 0; while (t8 < 120 && (b.carry || P.carried)) { step(0.5); t8 += 0.5; }
    out.push(result('paintings: if the easel is taken away while he carries it the painting goes to the Catalogue, not lost', !b.carry && !P.carried && P.items.length === 1 && !P.items[0].room, { items: P.items.length }));

    // 8. no wall at all: he says so kindly and the painting stays on the easel
    fresh();
    const savedWalls = w.hangWalls;
    w.hangWalls = () => [];
    paintIt();
    const noWall = b.hangPainting();
    w.hangWalls = savedWalls;
    out.push(result('paintings: with no wall to hang on he says so kindly and the painting stays on the easel', !noWall.ok && !BANNED.test(noWall.message) && P.easelHas(), { noWall }));
  } finally {
    P.reset(); T.resetRooms(); T.settle(); T.home();
  }
  out.push(result('paintings: no errors were logged', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

T.runAll = () => {
  const report = { coverage: T.coverage() };
  // each sweep starts with no added room: the Workshop (and what it made) is taken away again after any sweep that added it
  const S = (fn) => { const r = summarise(fn()); T.resetRooms(); return r; };
  report.objects = S(T.sweepObjects);
  report.activities = S(T.sweepActivities);
  report.poses = S(T.sweepPoses);
  report.tracks = S(T.sweepTracks);
  report.books = S(T.sweepBooks);
  report.records = S(T.sweepRecords);
  report.playlist = S(T.sweepPlaylist);
  report.combos = S(T.combos);
  report.interrupts = S(T.sweepInterrupts);
  report.removals = S(T.sweepRemovals);
  report.moves = S(T.sweepMoves);
  report.bookRules = S(T.sweepBookRules);
  report.sounds = S(T.sweepSounds);
  report.holding = S(T.sweepHolding);
  report.walls = S(T.sweepWalls);
  report.decor = S(T.sweepDecor);
  report.machine = S(T.sweepMachine);
  report.rooms = S(T.sweepRooms);
  report.doors = S(T.sweepDoors);
  report.gating = S(T.sweepGating);
  report.saves = S(T.sweepSaves);
  report.layout = S(T.sweepLayout);
  report.update = S(T.sweepUpdate);
  report.start = S(T.sweepStart);
  report.riffs = S(T.sweepRiffs);
  report.lock = S(T.sweepLock);
  report.speed = S(T.sweepSpeed);
  report.shelf = S(T.sweepShelf);
  report.workshop = S(T.sweepWorkshop);
  report.visit = S(T.sweepVisit);
  report.restaurant = S(T.sweepRestaurant);
  report.sides = S(T.sweepSides);
  report.paintings = S(T.sweepPaintings);
  report.errorsLogged = errors.length;
  return report;
};
window.guyTest = T;
