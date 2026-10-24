// QA harness for Guy's room. NOT imported by the game: load it from the browser console / test tooling with
//
//     const T = (await import('/src/devtools.js')).default;      // page opened with ?nostart&fresh&skills=none
//
// It drives the real game objects (window.brain, window.guy, window.scene ...), so what it tests is what you play.
// It is data driven: the object / book / record / track lists come from the game's own catalogs, and
// T.coverage() reports anything the MANIFEST below does not know about yet. When you add an asset or an
// activity, add it to MANIFEST (and to .claude/skills/test-guy-game/assets.md). See that skill for the workflow.
import { OBJECT_CATALOG } from './machine.js';
import { BOOK_CATALOG, SKILL_INFO, TIMING_SKILLS } from './skills.js';
import { BAND } from './gal.js';
import { wants } from './needs.js';
import { ROOM_CATALOG } from './rooms.js';
import { initLayout } from './layout.js';
import { RECIPES as RECIPES_DEF } from './workshop.js';
import { DISHES } from './restobjects.js';
import { dev } from './devunlock.js';
import { invent, judge, GOOD, STEPS as RIFF_STEPS, keepRiff, loadRiffs, nextRiff, riffAt, forgetMemoryRiffs } from './riffs.js';
import { ALBUM_CATALOG } from './albums.js';
import { TRACKS, trackSeconds } from './audio.js';
import { POSES } from './brain.js';
import { install as installCharacters } from './qa-characters.js';
import { install as installAudio } from './qa-audio.js';
import { install as installShots } from './qa-shots.js';
import { counts as sfxCounts } from './sfx.js';
import { BARKS, NO_BARK, resetBarks } from './barks.js';

// ---------------------------------------------------------------------------------------------------------------
// MANIFEST: what the test knows about each asset. Keep in sync with the game (T.coverage() tells you what is missing).
// ---------------------------------------------------------------------------------------------------------------
export const MANIFEST = {
  // interact: the name passed to brain.interact (what the long-press "Interact" button does)
  objects: {
    piano: { skills: ['piano'] }, bench: { skills: ['piano'] }, table: { skills: ['stereo'] }, shelf: { skills: [], fixed: true },
    lamp: { skills: ['lighting'] }, armchair: { skills: [] }, armchair2: { skills: [] }, chair: { skills: [] }, chair2: { skills: [] }, plant: { skills: [] }, ball: { skills: ['ball'] }, guitar: { skills: ['guitar'] },
    drums: { skills: ['drums'] }, easel: { skills: ['easel'] }, telescope: { skills: ['telescope'] },
    // decor (world.decor): no interaction; tested by sweepDecor (remove / put back through the Catalog, wall limits)
    rug: { decor: true }, picture: { decor: true, wall: 'back' }, window: { decor: true, wall: 'left' }, window2: { decor: true, wall: 'back', startsOut: true },
    art_mountains: { decor: true, wall: 'left', startsOut: true }, art_abstract: { decor: true, wall: 'back', startsOut: true }, art_moon: { decor: true, wall: 'left', startsOut: true },
    sconce: { decor: true, wall: 'back', startsOut: true }, rug2: { decor: true, startsOut: true }, rug3: { decor: true, startsOut: true },
    // decor furniture and plants (real objects): the plants are tended, the tables are only furniture
    flowerplant: { skills: [] }, tree: { skills: [] }, coffeetable: { skills: [] }, nightstand: { skills: [] },
    // the Workshop (a room added from the Rooms tab: T.addObject adds it first) and what Guy builds there (counted in storage, added one at a time)
    workbench: { room: 'workshop', skills: ['workshop'] }, toolbox: { room: 'workshop', skills: ['workshop'] },
    woodfactory: { room: 'workshop', skills: ['workshop.materials'] }, metalfactory: { room: 'workshop', skills: ['workshop.metal'] },
    botprinter: { skills: [] },       // the Build a Bot machine (premium, one use): tested by sweepGal
    workstation: { skills: [] },      // the Learning Workstation (premium): tested by sweepWorkstation
    footstool: { room: 'workshop', built: true }, woodshelves: { room: 'workshop', built: true }, builtchair: { room: 'workshop', built: true }, metalchair: { room: 'workshop', built: true }, bookshelf2: { room: 'workshop', built: true }, eguitar: { room: 'workshop', built: true },
    diningtable3: { room: 'workshop', built: true, alsoRoom: 'restaurant' }, diningtable4: { room: 'workshop', built: true, alsoRoom: 'restaurant' },       // (they go in the Restaurant, so it has to be there)
    // the Restaurant (another added room): the kitchen and the dining room
    stove: { room: 'restaurant', skills: ['restaurant'] }, kitchencounter: { room: 'restaurant', skills: ['restaurant'] }, register: { room: 'restaurant', skills: ['restaurant'] },
    diningtable: { room: 'restaurant', skills: ['restaurant'] }, diningtable2: { room: 'restaurant', skills: ['restaurant'] },
    // the Backyard (another added room, outdoors). The shed and the mower are premium: the harness adds them with the dev unlock
    soccergoal: { room: 'backyard', skills: ['outdoor.soccer'] }, basketballhoop: { room: 'backyard', skills: ['outdoor.basketball'] },
    lawnchair: { room: 'backyard', skills: ['outdoor'] }, birdbath: { room: 'backyard', skills: ['outdoor'] }, skyswitch: { room: 'backyard', skills: ['outdoor'] },
    shed: { room: 'backyard', skills: ['outdoor'], premium: true }, mower: { room: 'backyard', skills: ['outdoor'], premium: true },
  },
  // rooms the user can add from the Catalog's Rooms tab (tested by sweepRooms / sweepDoors / sweepGating / sweepSaves)
  rooms: { workshop: {}, restaurant: {}, backyard: {} },
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
    read: { objects: ['shelf', 'armchair'], touches: ['shelf', 'armchair', 'armchair2', 'chair', 'chair2', 'builtchair'] },
    rearrange: { objects: ['lamp', 'plant', 'armchair'], touches: ['lamp', 'plant', 'armchair', 'table', 'bench', 'flowerplant', 'coffeetable', 'nightstand', 'guitar', 'easel', 'telescope', 'footstool', 'woodshelves', 'builtchair'] },
    ball: { touches: [] },
    dribble: { skills: ['ball'], touches: [] },
    toss: { skills: ['ball'], touches: [] },
    guitar: { objects: ['guitar'], skills: ['guitar'], touches: ['guitar'] },
    riff: { objects: ['guitar'], skills: ['guitar'], touches: ['guitar'] },
    // the Workshop: `room` is added first, `stock` is what the Workshop has when it starts, `max` how long (simulated seconds) it may take
    tidytools: { objects: ['toolbox'], skills: ['workshop'], room: 'workshop', touches: ['toolbox'] },
    dusttop: { objects: ['window', 'window2', 'footstool'], skills: ['decorate'], room: 'workshop', max: 90, touches: ['footstool'] },
    build: { objects: ['woodfactory', 'metalfactory'], skills: ['workshop', 'decorate'], room: 'workshop', recipe: 'footstool', max: 260, touches: ['woodfactory', 'metalfactory', 'tree', 'telescope', 'flowerplant', 'plant', 'footstool', 'chair', 'chair2', 'armchair', 'armchair2', 'builtchair', 'metalchair'] },
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
    // the Backyard (outdoors). The ball sports need the outdoor skill books; the shed and mower are premium
    yardsit: { objects: ['lawnchair'], room: 'backyard', touches: ['lawnchair'] },
    birdbath: { objects: ['birdbath'], room: 'backyard', touches: ['birdbath'] },
    skyswitch: { objects: ['skyswitch'], room: 'backyard', touches: ['skyswitch'] },
    mow: { objects: ['shed', 'mower'], room: 'backyard', max: 240, touches: ['shed', 'mower'] },
    yardpoke: { objects: ['soccergoal'], skills: ['outdoor.soccer'], room: 'backyard', touches: ['soccergoal', 'basketballhoop'] },
    goalshot: { objects: ['soccergoal'], skills: ['outdoor.soccer'], room: 'backyard', max: 200, touches: ['soccergoal'] },
    soccertoss: { objects: ['soccergoal'], skills: ['outdoor.soccer'], room: 'backyard', max: 200, touches: ['soccergoal'] },
    hoopshoot: { objects: ['basketballhoop'], skills: ['outdoor.basketball'], room: 'backyard', max: 200, touches: ['basketballhoop'] },
    hoopdribble: { objects: ['basketballhoop'], skills: ['outdoor.basketball'], room: 'backyard', max: 200, touches: ['basketballhoop'] },
    // internal recovery activities and aliases: exercised through the interruption sweep, not on their own
    books: { alias: true }, putback: { internal: true }, putguitar: { internal: true }, dropball: { internal: true }, lighton: { internal: true },
    hangpaint: { objects: ['easel'], painted: true, max: 220, touches: ['easel'] }, putcanvas: { internal: true },      // hanging a painting (sweepPaintings tests it in depth)
    learn: { internal: true },      // using the Learning Workstation: tested by sweepWorkstation
    buildbot: { internal: true }, bandjam: { internal: true }, bandplay: { internal: true }, orderbuild: { internal: true },      // Guy and GAL: tested by sweepGal
    visit: { internal: true }, leave: { internal: true }, stuck: { internal: true }, rwait: { internal: true },      // rwait: waiting by the till for customers (tested by sweepRestaurant)
         // through the door of an added room and back: tested by sweepVisit
  },
  // what to do after reading each book: an activity that should now be possible
  books: { stereo: { then: 'dance' }, piano: { then: 'piano' }, ball: { then: 'dribble' }, lighting: { then: 'mood' }, piano2: { then: 'piano' }, guitar: { then: 'guitar' },
    speedread: { then: 'read' }, dancemoves: { then: 'dancemoves' }, ballroom: { then: 'ballroom' },
    drumming: { then: 'drums' }, drumsolo: { then: 'drumsolo' }, drumband: { then: 'jamdrums' },
    painting: { then: 'paint' }, colour: { then: 'mixpaint' }, portrait: { then: 'portrait' },
    stars: { then: 'stargaze' }, darksky: { then: 'darkstargaze' }, scopecare: { then: 'scopecare' },
    decorating: { then: 'dust' },
    outdoor: { then: 'yardsit' }, soccer: { then: 'goalshot' }, basketball: { then: 'hoopshoot' },
    workshop: { then: 'build' }, woodmetal: { then: 'build' }, furniture: { then: 'build' }, metalfab: { then: 'build' }, restaurant: { then: 'takeorder' },
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
    { id: 'yard-shoot', activity: 'hoopshoot', pose: 'shoot', t: 0.9, view: 'side', expect: 'knees dipped then extended, both hands up at the release with the basketball just leaving them, facing the hoop' },
    { id: 'yard-sit', activity: 'yardsit', pose: 'sitRest', t: 6, view: 'side', expect: 'seated in the lawn chair, back against it, legs clear of the frame' },
    { id: 'yard-mow', activity: 'mow', pose: 'walk', t: 1, view: 'side', push: true, expect: 'both hands on the mower handle, walking behind it, stripes cut in the grass' },
    { id: 'scope-care', activity: 'scopecare', pose: 'scopeCare', t: 13, view: 'front', expect: 'squatting beside the tripod with a hand on one leg' },
    { id: 'stool-dust', activity: 'dusttop', pose: 'reach', t: 4, view: 'front', dist: 3.6, expect: 'standing ON the foot stool (feet on top of it, not in the floor), right hand wiping along the top of the window frame, the stool not passing through him' },
    { id: 'dust-frame', activity: 'dust', pose: 'reach', t: 2.5, view: 'front', expect: 'facing the wall, right hand wiping along the lower edge of a frame (not inside the wall or his own head)' },
    { id: 'dance-twist', activity: 'dancemoves', pose: 'twist', t: 4, view: 'front', expect: 'hips and shoulders twisting opposite ways, knees bent and apart, elbows bent, feet flat' },
    { id: 'dance-shuffle', activity: 'dancemoves', pose: 'shuffle', t: 4, view: 'front', expect: 'one foot slides forward at a time, elbows bent and pumping alternately' },
    { id: 'dance-twirl', activity: 'dancemoves', pose: 'twirl', t: 2.5, view: 'front', expect: 'arms out to the sides, spinning on the spot without drifting or hitting furniture' },
    { id: 'dance-waltz', activity: 'ballroom', pose: 'waltz', t: 5, view: 'front', expect: 'dance hold: left arm out and bent, right arm curved as if round a partner, slowly turning' },
    { id: 'dance-swing', activity: 'ballroom', pose: 'swing', t: 4, view: 'front', expect: 'arms swinging wide in opposition, alternate knee kicks on the beat' },
    { id: 'sit-rest', activity: 'sit', pose: 'sitRest', t: 5, view: 'side', expect: 'sitting on the seat (not hovering), thighs level, hands resting on the knees, head turning slowly' },
    { id: 'sit-guitar', activity: 'sitguitar', pose: 'sitGuitar', t: 6, view: 'front', expect: 'seated, the guitar held on the lap and chest, left hand on the neck, right hand strumming; the chair does not pass through the guitar' },
    { id: 'slouch', activity: 'slouch', pose: 'slouch', t: 6, view: 'side', expect: 'on the drum stool, round-shouldered, knees apart, hands hanging between the knees' },
    { id: 'paint-takedown', activity: 'hangpaint', pose: 'reach', t: 1.5, view: 'side', expect: 'at the easel, one hand on the canvas as he lifts it off (the easel goes blank at that moment), then he carries it held up in front of him' },
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
  let t = 0;
  // free activities now happen in whatever room he is in, so a tidy-up that must end in his own room sends him home first
  if (!b.inMain() && !b.stuckIn() && !b.lockedInside()) { b.pendingActivity = 'leave'; while (t < maxSec && !b.inMain()) { step(0.25); t += 0.25; } b.stayRoom = null; b.skip(); }
  b.pendingActivity = 'wander';
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
T.addObject = (id) => { // through the Catalog, like a user would
  const def = OBJECT_CATALOG.find((d) => d.id === id);
  if (isPresent(id)) return true;
  const premium = def.locked && (MANIFEST.objects[id] || {}).premium;       // a premium thing: the harness uses the dev unlock, like the premium records
  if (def.locked && !premium) return false;
  if (def.room && !W().rooms.isAdded(def.room)) { unlockRoom(def.room); W().rooms.add(def.room); }          // the Catalog lists a room's things only once the room is added
  if (def.built && !((W().stock.items[id] || 0) > 0)) W().stock.items[id] = 1;      // something Guy built: make sure there is one in storage to add
  if (def.needsSkill && !skillsOf().has(def.needsSkill)) skillsOf().learn(def.needsSkill);        // listed only once Guy (or GAL) has the book's skill
  const also = MANIFEST.objects[id] && MANIFEST.objects[id].alsoRoom;
  if (also && !W().rooms.isAdded(also)) { unlockRoom(also); W().rooms.add(also); }
  const was = dev.all; if (premium) dev.all = true;
  const ok = machineClick('objects', def.name) && isPresent(id);
  dev.all = was;
  return ok;
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
  if (m.room && !R().isAdded(m.room)) { unlockRoom(m.room); R().add(m.room); }
  if (m.room === 'backyard' && W().yard) W().yard.snapNight(false);                                          // always the same daylight for the pictures                           // the room the activity happens in
  for (const id of m.objects || []) if (T.addObject(id)) done.push(id);
  T.learn(m.skills || []);
  if (m.recipe) {                                                                                    // what to build (the house's real needs are tested by sweepNeeds)
    const r = RECIPES_DEF[m.recipe];
    for (const [n, o] of Object.entries(W().objects)) if (o.kind === r.object) { W().storeInstance(n); B().objectRemoved(n); }       // (and none of them already: he stops at the recipe's cap)
    delete W().stock.items[r.object];
    B().forceRecipe = m.recipe;
  }
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
T.feetOf = (guy) => { const y = Math.min(...['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map((n) => guy.boneWorld(n).y)); return +y.toFixed(3); };
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
// 1. Add the objects one at a time (Catalog UI), check placement, interact before and after he has the skill.
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

// 8. Decor (rug, windows, picture): remove each through the Catalog's Remove button, check it is really gone and offered
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
  // wall limits: a window may not be dragged over the Catalog, the other window, or below a piano standing against its wall
  const w = W();
  T.addObject('window2'); T.addObject('picture'); T.addObject('window'); T.addObject('piano');
  const win = w.decor.window, pic = w.decor.picture, win2 = w.decor.window2, piano = w.objects.piano;
  out.push(result('decor:window keeps off the Catalog', !!win && !w.decorFits(win, -2.3, 1.5) && w.decorFits(win, win.u, win.v)));
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

// 9. The Catalog's Objects tab: category chips, one section per category, counts that match the room.
T.sweepMachine = () => {
  const out = [];
  const LISTED = OBJECT_CATALOG.filter((d) => (!d.room || W().rooms.isLive(d.room)) && (!d.needsSkill || dev.all || skillsOf().has(d.needsSkill) || isPresent(d.id) || !!W().removed[d.id]));      // objects of rooms that are not added are not listed, nor are those that need a skill nobody has yet (the chairs)
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
  // never film from outside a wall (the picture would be black, or the wall in the way): swing round to the nearest angle that is inside a room
  const inside = (p) => { const b = W().boundsAt(p.x, p.z); return p.x > b.minX + 0.3 && p.x < b.maxX - 0.3 && p.z > b.minZ + 0.3 && p.z < b.maxZ - 0.3; };
  if (view !== 'top' && !inside(pos)) {
    const off = pos.clone().sub(target); off.y = 0;
    for (let k = 1; k <= 11; k++) for (const sgn of [1, -1]) {
      const ang = sgn * k * Math.PI / 6, q = new THREE.Vector3(off.x * Math.cos(ang) - off.z * Math.sin(ang), 0, off.x * Math.sin(ang) + off.z * Math.cos(ang));
      const cand = new THREE.Vector3(target.x + q.x, pos.y, target.z + q.z);
      if (inside(cand)) { pos = cand; k = 99; break; }
    }
  }
  window.camera.position.copy(pos); window.controls.target.copy(target); window.controls.update();
  return { view };
};
// Run an activity until Guy reaches (pose, t), freeze and frame him. `opts.turning` waits for a page turn.
T.moment = (activity, pose, t = 0, view = 'front', opts = {}) => {
  T.unfreeze(); T.prep(activity); T.settle();
  const b = B();
  if (opts.album && !(W().objects.shelf.albums || []).length) T.addAlbum(ALBUM_CATALOG.find((x) => !x.premium).id);       // a record on the shelf to carry
  if (opts.album) b.forceAlbum = (W().objects.shelf.albums[0] || { def: {} }).def.id;
  b.queue = []; b.step = null; b.choose(activity);
  let guard = 0;
  const ok = () => b.step && b.pose === pose && b.step.t >= t && (!opts.turning || (b.read && b.read.turning && b.read.turnT > 0.8)) && (!opts.push || b.step.push) && (!opts.album || (b.held && b.held.kind === 'album'));
  while (!ok() && guard++ < 40000) step(1 / 30);
  T.freeze(); T.look(view, opts.dist);                                       // (opts.dist: how far back the camera stands, for a picture of someone up on a stool)
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

  // forgetting: the book goes back to the catalog at once, what it taught fades gradually, and reading it again restores it
  sk.known.add('piano');
  const r = b.forgetBook('piano');
  const listed = (() => { const root = document.getElementById('machine'); return r.ok && !onShelf('piano') && T.addBook('piano') === true && onShelf('piano'); })();
  b.forgetBook('piano');                                   // (put back through the catalog, forget again)
  const s0 = sk.strength('piano'); step(60); const s60 = sk.strength('piano'); step(120);
  out.push(result('forget: the book returns to the catalog and the lesson fades gradually (150 s)', listed && s0 === 1 && s60 > 0.4 && s60 < 0.8 && !sk.has('piano') && !b.available('piano'), { s0, s60, gone: !sk.has('piano') }));
  T.addBook('piano'); sk.known.add('piano'); b.forgetBook('piano'); step(30); T.addBook('piano');
  const rec = w.objects.shelf.books.find((x) => x.def.id === 'piano');
  const relearn = (() => { sk.learn('piano'); return sk.strength('piano') === 1; })();
  out.push(result('forget: reading it again while it fades restores it in full', !!rec && relearn));

  // "Remove" is not "Forget": the book goes back to the catalog but he keeps what he learned
  sk.known.add('stereo');
  const rem = b.removeBook('stereo');
  const kept = sk.has('stereo') && sk.strength('stereo') === 1 && !onShelf('stereo');
  step(200);
  const stillKept = sk.has('stereo') && sk.strength('stereo') === 1;
  const putBack = T.addBook('stereo') === true && onShelf('stereo');
  out.push(result('remove: the book leaves the shelf, comes back from the catalog, and Guy keeps the skill (no fading)', rem.ok && kept && stillKept && putBack, { kept, stillKept, putBack, message: rem.message }));
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
  act('a factory runs', 'machine', 'build');
  act('the toolbox lid', 'lid', 'tidytools', 2);
  act('he sits down in a chair', 'sit', 'sit');
  sound('learning something chimes', 'chime', () => { /* main.js asks for it when brain.onLearn fires */ if (brain.onLearn) brain.onLearn({ blurb: 'a test' }); });
  return out;
};

// ---- 10. Rooms and doors (src/rooms.js; the Catalog's Rooms tab) ----------------------------------------------------------------
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
  const st = W().stock; st.items = {}; st.coins = 0;   // and what the Workshop made and the Restaurant earned
  if (W().gal.exists()) W().gal.remove();                                       // GAL goes too (the machine is not given back)
  delete W().removed.botprinter;
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

// ---- 12b. Telling him to use the goal or the hoop (src/brain.js interact, yardbrain.js) ----
// Before the sport's book he used to just poke the ball about with his foot, whatever he was told, and locking in kept him at it.
T.sweepYardOrders = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('backyard'); R().add('backyard');
  for (const id of ['soccergoal', 'basketballhoop']) T.addObject(id);
  T.forget();
  const kind = (m) => !/\b(fail|failed|error|wrong|can't|cannot|lost|broken|dangerous)\b/i.test(m);
  for (const [obj, title] of [['basketballhoop', 'Basketball for Robots'], ['soccergoal', 'Soccer for Robots']]) {
    b.queue = []; b.step = null; b.pendingActivity = null;
    const r = b.interact(obj), l = b.lockOn(obj);
    out.push(result(`yard orders: told to use the ${obj} before reading, he says which books he needs (Outdoor Sports, then ${title}) and does not just poke the ball`, !r.ok && !l.ok && r.message.includes('Outdoor Sports') && r.message.includes(title) && kind(r.message) && b.pendingActivity !== 'yardpoke' && !b.lock, { r, l }));
    T.learn(['outdoor']);
    const r2 = b.interact(obj);
    out.push(result(`yard orders: with Outdoor Sports read he names only ${title}`, !r2.ok && r2.message.includes(title) && !r2.message.includes('Outdoor Sports'), { r2 }));
    T.forget();
  }
  // with the book: told to shoot hoops and locked in, he really shoots (and keeps doing hoop things, not kicking)
  T.learn(['outdoor', 'outdoor.basketball']); T.settle();
  b.queue = []; b.step = null; b.pendingActivity = null;
  const r3 = b.interact('basketballhoop'), l3 = b.lockOn('basketballhoop');
  const chosen = [], orig = b.choose.bind(b); b.choose = (f) => { orig(f); chosen.push(b.last); };
  const s0 = w.yard.score.shots;
  let t = 0; try { while (t < 260) { step(0.25); t += 0.25; } } finally { b.choose = orig; }
  out.push(result('yard orders: with the book, told to shoot hoops and locked in, he shoots at the hoop and keeps at the hoop (never the kicking)', r3.ok && l3.ok && w.yard.score.shots - s0 >= 3 && !chosen.includes('yardpoke') && chosen.every((n) => ['hoopshoot', 'hoopdribble', 'dropball', 'putback'].includes(n)), { r3, l3, shots: w.yard.score.shots - s0, chosen }));
  b.unlock(true); T.settle();
  T.resetRooms(); T.removeAll(); T.settle();
  out.push(result('yard orders: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 12c. Telling him to mow the lawn (and the other yard jobs) by voice, and while he is already out in the yard (src/voice.js, brain.js update) ----
// "mow the lawn" used to come back as "I did not catch that" (the parser knew nothing of the yard), and an order for the yard given while he was
// already out there made him walk back indoors first (and, with no GAL, was refused as "busy").
T.sweepYardVoice = () => {
  const out = [], base = errors.length, w = W(), b = B(), V = window.__voice;
  window.__voiceNoAudio = true;
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('backyard'); R().add('backyard');
  for (const id of ['lawnchair', 'shed', 'mower']) T.addObject(id);
  T.settle();
  const reset = () => { b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; };
  // 1. from his own room: the sentence is understood, and he really mows (the mower leaves its spot)
  reset(); T.home(); T.settle();
  const m0 = w.objects.mower && { x: w.objects.mower.x, z: w.objects.mower.z };
  const r1 = V.run('Guy, mow the lawn please');
  out.push(result('yard voice: "mow the lawn" is understood and he says he is on it', r1.ok && r1.intent.type === 'object' && r1.intent.name === 'mower' && r1.lines.length === 1 && r1.lines[0].who === 'guy' && b.pendingActivity === 'mow', { intent: r1.intent, lines: r1.lines, pending: b.pendingActivity }));
  const seen1 = []; const orig1 = b.choose.bind(b); b.choose = (f) => { orig1(f); seen1.push(b.last); };
  let t = 0, moved = 0; try { while (t < 260 && moved < 0.8) { step(0.25); t += 0.25; const m = w.objects.mower; if (m && m0) moved = Math.max(moved, Math.hypot(m.x - m0.x, m.z - m0.z)); } } finally { b.choose = orig1; }
  out.push(result('yard voice: told "mow the lawn" he walks out and pushes the mower across the lawn', seen1.includes('mow') && moved >= 0.8, { seen: seen1, moved }));
  // 2. already out in the yard doing something else: he finishes it quickly and mows, without walking indoors first, and without needing GAL
  reset(); T.home(); T.settle();
  const ri = b.interact('lawnchair');
  let t2 = 0; while (t2 < 90 && !(b.inYard() && b.step && b.step.fx && b.step.fx.chairSit)) { step(0.25); t2 += 0.25; }
  const seated = b.inYard() && !!(b.step && b.step.fx && b.step.fx.chairSit);
  const seen2 = []; const orig2 = b.choose.bind(b); b.choose = (f) => { orig2(f); seen2.push(b.last); };
  let r2 = null, mowing = false, t3 = 0;
  try {
    r2 = V.run('mow the lawn');
    while (t3 < 20 && !mowing) { step(0.25); t3 += 0.25; mowing = b.last === 'mow' && !!b.step; }
  } finally { b.choose = orig2; }
  out.push(result('yard voice: out in the yard (in the lawn chair) "mow the lawn" is his to do, not handed to GAL or refused as busy', ri.ok && seated && r2.ok && r2.lines.length === 1 && r2.lines[0].who === 'guy' && !/GAL|busy/.test(r2.lines[0].text), { ri, seated, r2: r2 && r2.lines }));
  out.push(result('yard voice: he finishes sitting quickly and starts mowing within seconds, without leaving the yard first', mowing && t3 < 12 && !seen2.includes('leave') && b.inYard(), { seen: seen2, t3, inYard: b.inYard() }));
  // 2b. cut short while mowing (the shed door is open): he shuts it again, it is not left hanging open
  reset(); T.home(); T.settle();
  b.interact('mower');
  let t4 = 0; while (t4 < 120 && !(w.objects.shed && w.objects.shed.openTo === 1)) { step(0.25); t4 += 0.25; }
  const openedShed = !!w.objects.shed && w.objects.shed.openTo === 1;
  b.interact('lawnchair');
  let t5 = 0; while (t5 < 30 && w.objects.shed && w.objects.shed.openTo === 1) { step(0.25); t5 += 0.25; }
  out.push(result('yard voice: cut short with the shed door open, he shuts it again', openedShed && !!w.objects.shed && w.objects.shed.openTo === 0, { openedShed, openTo: w.objects.shed && w.objects.shed.openTo }));
  // 2c. long-press > Mow the Lawn with no clear lawn (the mower jammed in a corner): he says so kindly and does not go and open the shed
  reset(); T.home(); T.settle();
  const mw = w.objects.mower, bd = w.doors.backyard.shell.bounds;
  if (mw) mw.set(bd.minX + 0.3, bd.minZ + 0.3);
  const r5 = b.interact('mower'), r5b = b.interact('shed');
  out.push(result('yard voice: long-press the mower or shed with no clear lawn: a kind message, nothing started, and he does not choose to mow on his own', !r5.ok && !r5b.ok && /clear stretch of lawn/.test(r5.message) && !/\b(fail|failed|error|wrong|can't|cannot)\b/i.test(r5.message) && !b.pendingActivity && b.available('mow') === false, { r5, r5b, pending: b.pendingActivity, avail: b.available('mow') }));
  // (and back with room to spare it is on again)
  if (mw) mw.set(bd.minX + (bd.maxX - bd.minX) * 0.42, (bd.minZ + bd.maxZ) / 2);
  out.push(result('yard voice: with room round the mower again he is willing to mow', b.available('mow') === true, { avail: b.available('mow') }));
  // 2d. things in the way of the mowing: the light ones (chair, bird bath, plant, small cabinet) he shifts aside himself, then he mows
  reset(); T.home(); T.settle();
  for (const id of ['birdbath', 'flowerplant', 'nightstand']) T.addObject(id);
  T.settle();
  const mw3 = w.objects.mower;
  if (m0 && mw3) mw3.set(m0.x, m0.z);
  const ring = [['lawnchair', 1.0, 0], ['birdbath', -1.0, 0], ['flowerplant', 0, 1.0], ['nightstand', 0, -1.0]];
  for (const [n, dx, dz] of ring) if (w.objects[n] && mw3) w.objects[n].set(mw3.x + dx, mw3.z + dz);
  const spots0 = ring.map(([n]) => ({ n, x: w.objects[n].x, z: w.objects[n].z }));
  const plain = b.mowRoute(), pushy = b.mowRoute({ pushable: true });
  out.push(result('yard voice: with light things all round the mower there is no plain loop, but there is one if Guy shifts them', !plain && !!pushy && pushy.blockers.length >= 1, { plain: !!plain, blockers: pushy && pushy.blockers }));
  const r6 = b.interact('mower');
  const seen6 = []; const orig6 = b.choose.bind(b); b.choose = (f) => { orig6(f); seen6.push(b.last); };
  let t6 = 0, moved6 = 0;
  try { while (t6 < 500 && moved6 < 0.8) { step(0.25); t6 += 0.25; const mm = w.objects.mower; moved6 = mm && m0 ? Math.hypot(mm.x - m0.x, mm.z - m0.z) : 0; } } finally { b.choose = orig6; }
  const shifted = spots0.filter((s) => Math.hypot(w.objects[s.n].x - s.x, w.objects[s.n].z - s.z) > 0.5).map((s) => s.n);
  out.push(result('yard voice: long-press Mow the Lawn with light things in the way: he shifts them aside, then mows', r6.ok && shifted.length >= 1 && moved6 >= 0.8 && seen6.includes('mow'), { r6, shifted, moved6, seen: seen6, t6 }));
  // 3. an order for the yard that he cannot do says why (the door is locked), it does not vanish
  reset(); T.home(); T.settle();
  R().setDoorLocked('backyard', true);
  const r4 = V.run('mow the lawn');
  out.push(result('yard voice: with the yard door locked he says so instead of silently doing nothing', !r4.ok && r4.lines.length >= 1 && r4.lines[0].text.length > 5 && !b.pendingActivity, { lines: r4.lines, pending: b.pendingActivity }));
  R().setDoorLocked('backyard', false);
  reset();
  T.resetRooms(); T.removeAll(); T.settle();
  out.push(result('yard voice: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// The lawn mower lives in the shed: when the lawn is done Guy pushes it to the door and in, and shuts the door; the next mow takes it out
// again; a shed that is dragged about takes its mower with it.
T.sweepMowerShed = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('backyard'); R().add('backyard');
  for (const id of ['shed', 'mower']) T.addObject(id);
  T.settle();
  const reset = () => { b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; };
  const inside = () => { const m = w.objects.mower, s = w.objects.shed; return !!m && !!s && Math.hypot(m.x - s.x, m.z - s.z) < 0.1; };
  const mowOnce = (limit = 420) => {
    reset(); T.home(); T.settle();
    const r = b.interact('mower');
    let t = 0, went = 0, done = false;
    const s = w.objects.shed;
    while (t < limit && !done) {
      step(0.25); t += 0.25;
      const m = w.objects.mower; if (m && s) went = Math.max(went, Math.hypot(m.x - s.x, m.z - s.z));
      done = false;
      if (t > 20 && went > 0.8 && inside() && s.open < 0.05 && s.openTo === 0) done = true;
    }
    return { r, t, went, done };
  };
  // 1. a first mow (the mower stands out on the lawn): when it is done the mower is in the shed and the door is shut
  const a = mowOnce();
  out.push(result('mower shed: after mowing the mower has been put back in the shed and the door is shut', a.r.ok && a.went > 0.8 && inside() && w.objects.shed.openTo === 0, a));
  // 2. the next mow takes it out of the shed (it is not stuck in there) and puts it back again
  const b2 = mowOnce();
  out.push(result('mower shed: told to mow again, he takes it out of the shed, mows, and puts it away again', b2.r.ok && b2.went > 1.0 && inside() && w.objects.shed.openTo === 0, b2));
  // 3. drag the shed: the mower inside goes with it
  const sh = w.objects.shed, mw = w.objects.mower;
  b.mowerSync();                                              // (what every new activity does first; Guy himself is not stepped here: he would go mowing)
  const bd = w.doors.backyard.shell.bounds;
  sh.set(sh.x + (sh.x > (bd.minX + bd.maxX) / 2 ? -1.2 : 1.2), sh.z);
  mw.update(0.03);
  out.push(result('mower shed: the shed is dragged to another spot and the mower inside goes with it', inside(), { shed: [sh.x, sh.z], mower: [mw.x, mw.z] }));
  // 4. cut short mid-mow: the door is shut again (the mower stays on the lawn, nothing is stuck)
  reset(); T.home(); T.settle();
  b.interact('mower');
  let t4 = 0; while (t4 < 200 && !(w.objects.mower && Math.hypot(w.objects.mower.x - sh.x, w.objects.mower.z - sh.z) > 1.2 && b.last === 'mow')) { step(0.25); t4 += 0.25; }
  b.interact('lawnchair');
  let t5 = 0; while (t5 < 40 && sh.openTo === 1) { step(0.25); t5 += 0.25; }
  const far = Math.hypot(mw.x - sh.x, mw.z - sh.z);
  out.push(result('mower shed: cut short on the lawn: the door is shut again and the mower is either put away or left clear of the shed', sh.openTo === 0 && (inside() || far > 1.0), { openTo: sh.openTo, t4, far }));
  T.settle(); T.resetRooms(); T.removeAll(); T.settle();
  out.push(result('mower shed: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// Every skill works in every room: an object dragged into another room is used there (he goes out and in through the doors), the
// free activities happen in whichever room he is in, and a two-thing activity needs both things in the same room.
T.sweepAllRooms = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('workshop'); R().add('workshop');
  T.addObject('piano'); T.addObject('table');
  T.learn(['piano', 'stereo']);                                   // (playing along needs the skill: without it the checks below would pass for the wrong reason)
  T.settle();
  const bd = w.doors.workshop.shell.bounds, cx = (bd.minX + bd.maxX) / 2, cz = (bd.minZ + bd.maxZ) / 2;
  const reset = () => { b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; b.stayRoom = null; };
  const PIANO = ['plink', 'piano', 'sitpiano'];
  // 1. the piano is dragged into the Workshop and he is told to play it from his own room
  const pi = w.objects.piano; pi.set(cx, cz - 0.8);
  reset(); T.home(); T.settle();
  const r1 = b.interact('piano');
  const seen = []; const o1 = b.choose.bind(b); b.choose = (f) => { o1(f); seen.push(b.last); };
  let t = 0, playing = false;
  try { while (t < 160 && !playing) { step(0.25); t += 0.25; playing = b.hereId() === 'workshop' && PIANO.includes(b.last) && !!b.step; } } finally { b.choose = o1; }
  out.push(result('allrooms: the piano is in the Workshop and he is told to play it: he goes in through the door and plays it there', r1.ok && playing, { r1, seen, t, room: b.hereId() }));
  // 2. afterwards a free activity happens right there, not after a walk back to his own room
  b.pendingActivity = 'wander'; b.skip();
  let t2 = 0, wandered = false; while (t2 < 40 && !wandered) { step(0.25); t2 += 0.25; wandered = b.last === 'wander' && !!b.step; }
  const seen2 = [], ws = b.waveSpot(), ds = b.danceSpot(), fs = b.freeSpot();
  for (let i = 0; i < 12 && b.last === 'wander'; i++) { step(0.25); seen2.push(b.hereId()); }       // (while that wander lasts)
  out.push(result('allrooms: wandering happens in the Workshop he is in (he does not walk home first), and stays on its floor', wandered && seen2.length > 0 && seen2.every((r) => r === 'workshop') && b.onFloor(b.g.root.position.x, b.g.root.position.z, 0), { wandered, room: b.hereId(), seen2: [...new Set(seen2)] }));
  // 3. the stretch / wave / dance spots are on the floor of the room he is in
  out.push(result('allrooms: the wave, dance and free spots are inside the room he is in', [ws, ds, fs].every((p) => w.roomIdAt(p.x, p.z) === 'workshop'), { ws, ds, fs }));
  // 4. two things in one activity: the stereo is in the other room, so playing along is not on offer; bring it in and it is
  const tb = w.objects.table; tb.set(0, 0);
  const apart = ['jam', 'jampiano', 'jamsit'].map((a) => b.available(a));
  tb.set(cx + 1.6, cz + 0.8);
  const together = ['jam', 'jampiano', 'jamsit'].map((a) => b.available(a));
  out.push(result('allrooms: the stereo in another room: no playing along with it; in the same room it is on offer', apart.every((x) => x === false) && together.some((x) => x === true), { apart, together }));
  // 5. the object is taken away while he is in there: he stops and comes out, with no errors
  w.removeObject('piano'); b.objectRemoved('piano');
  T.settle();
  out.push(result('allrooms: the piano taken away: he comes out and carries on in his own room', b.inMain(), { room: b.hereId() }));
  T.settle(); reset();
  for (const [n, x, z] of [['piano', -2.5, -2.4], ['table', 2.5, -2.4]]) if (w.objects[n]) w.objects[n].set(x, z);     // (taking a room away in the test deletes what stands in it: they go back to his own room first)
  T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); b.lastSong = null; T.settle(); T.home();
  R().setUnlocked('workshop', false);                           // (as it was found)
  out.push(result('allrooms: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
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
  out.push(result('rooms: the Rooms tab offers the Workshop, the Backyard and the Restaurant ("Add to my home") and not the main room', [...titles()].sort().join() === ROOM_CATALOG.map((x) => x.name).sort().join() && !!btn && btn.textContent === 'Add to my home', { titles: titles() }));
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
    out.push(result(`doors: on the ${wall} wall only, the door is clear and what it moved is in the Catalog`, res.ok ? !probs.length && gone && w.doors.workshop.wall === wall : friendly(res.messages), { res: { ok: res.ok, u: res.u, displaced: res.displaced }, probs }));
    // every added room is as big as Guy's room: the same width (x) and the same depth (z), whichever wall the door is on
    const sb = res.ok ? w.doors.workshop.shell.bounds : null;
    out.push(result(`doors: ${wall} wall: the room behind it has the same width and depth as Guy's room`, !res.ok || (near(sb.maxX - sb.minX, 10) && near(sb.maxZ - sb.minZ, 8)), { bounds: sb }));
    // what was moved can be put back, and none of it ends up in the doorway
    putBackSince(before);
    out.push(result(`doors: ${wall} wall: put back, nothing returns into the doorway`, !res.ok || !doorProblems('workshop').length, { probs: doorProblems('workshop') }));
    T.resetRooms();
  }
  // 2. a piece of furniture standing where the door is pinned is taken out, and goes to the Catalog
  T.removeAll(); T.addObject('plant'); T.addObject('picture');
  const before = new Set(Object.keys(w.removed));
  w.objects.plant.set(4.5, 2.6);                              // test-only teleport into the doorway
  const f = R().add('workshop', { at: { wall: 'right', u: 2.6 } });
  out.push(result('doors: a plant in the doorway is moved to the Catalog', f.ok && f.displaced.includes('plant') && !w.objects.plant && !!w.removed.plant && !doorProblems('workshop').length && friendly(f.messages), { f }));
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
  // 5. the default choice: leaves the left wall (the Catalog) alone and prefers the right wall when it is clear
  const plan = w.planDoor();
  out.push(result('doors: the default plan uses an allowed wall, never the left (the Catalog)', !!plan && ['right', 'front', 'back'].includes(plan.wall), { plan }));
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
  // The premium unlock must be read before the saved rooms are restored (a premium room is refused while premium is locked: the Restaurant
  // used to disappear on every reload). Also the saved Restaurant must come back when premium is unlocked, locked or not.
  const boot = window.__boot || [];
  out.push(result('saves: the saved premium unlock is applied before the saved rooms are restored (the Restaurant survives a reload)', boot.indexOf('devunlock') >= 0 && boot.indexOf('devunlock') < boot.indexOf('rooms.restore'), { boot }));
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
  out.push(result('layout: what the user took out stays out (and can be put back from the Catalog)', !w.objects.bench && !!w.removed.bench && did.removed.includes('bench')));
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
  // 7b. the Backyard's day or night is saved and comes back
  { const wasYard = !!R().isAdded('backyard'); if (!wasYard) { unlockRoom('backyard'); R().add('backyard'); }
    const y = w.yard; y.snapNight(true);
    const night = clone(L().snapshot());
    y.snapNight(false); L().apply(clone(night));
    const sk = y.isNight();
    y.snapNight(false);
    const day = clone(L().snapshot()); y.snapNight(true); L().apply(clone(day));
    out.push(result('layout: the backyard remembers night and day', night.sky === true && sk === true && day.sky === false && y.isNight() === false, { sk }));
    y.snapNight(false); if (!wasYard) R().reset('backyard'); }
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
    out.push(result(`visit: ${wall} wall: long-pressing the door offers "Go into the Workshop" and "Lock the door"`, visible.length === 2 && /Go into the Workshop/.test(visible[0].textContent) && /Lock the door/.test(visible[1].textContent), { shown: visible.map((x) => x.textContent) }));
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
const SHOP = ['workbench', 'toolbox', 'woodfactory'];
const ALL_SHOP_SKILLS = ['workshop', 'workshop.materials', 'workshop.furniture', 'decorate'];
const METAL = ['metalfactory'];
const shopSetup = (wall = 'right', skills = ALL_SHOP_SKILLS) => {
  T.settle();                                                                      // (a cut-short job puts its stock back while he settles: do that first)
  T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  W().stock.items = {};
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
    out.push(result(`workshop: ${wall} wall: the room and its three pieces of furniture are added through the Catalog`, res.ok && SHOP.every((id) => !!w.objects[id]), { res: res.ok }));
    const objs = SHOP.map((id) => w.objects[id]).filter(Boolean);
    const inside = objs.every((o) => w.roomIdAt(o.x, o.z) === 'workshop' && w.fits(o, o.x, o.z));
    let overlap = null;
    for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) if (rectsOv(objs[i].obstacle, objs[j].obstacle)) overlap = [objs[i].name, objs[j].name];
    out.push(result(`workshop: ${wall} wall: everything stands inside the room, clear of the door and of each other`, inside && !overlap, { inside, overlap }));
    // where he stands to use each one is free floor in the room
    const axes = w.shellAxes('workshop');
    const stands = [['workbench', 0.78], ['toolbox', 0.6], ['woodfactory', 0.78]].map(([n, f]) => { const o = w.objects[n], l = o.local(0, f); return { n, x: o.x + l.x, z: o.z + l.z }; });
    const badStand = stands.filter((p) => w.roomIdAt(p.x, p.z) !== 'workshop' || w.obstacles.some((o) => p.x > o.x0 - 0.25 && p.x < o.x1 + 0.25 && p.z > o.z0 - 0.25 && p.z < o.z1 + 0.25 && o !== w.objects[p.n].obstacle));
    out.push(result(`workshop: ${wall} wall: the place he stands to use each one is free floor`, !badStand.length, { badStand: badStand.map((p) => p.n) }));
    const wbq = w.objects.workbench.local(0, 1);
    out.push(result(`workshop: ${wall} wall: the workbench faces the door`, wbq.x * axes.toDoor.x + wbq.z * axes.toDoor.z > 0.9));
  }
  // 2. what he says when he cannot (kind messages)
  shopSetup('right', []);
  b.queue = []; b.step = null;
  const noBook = b.interact('woodfactory');
  const kind = (m) => !BANNED.test(m);                       // kind wording (these messages are longer than a toast)
  out.push(result('workshop: without the book he is refused kindly and told which book', !noBook.ok && /Workshop Basics/.test(noBook.message) && kind(noBook.message), { noBook }));
  const noBench = b.interact('workbench');
  out.push(result('workshop: the workbench names the book he still needs (Workshop Basics)', !noBench.ok && /Workshop Basics/.test(noBench.message) && kind(noBench.message), { noBench }));
  T.learn(['workshop']);
  w.removeObject('woodfactory'); b.objectRemoved('woodfactory');
  const noFac = b.interact('workbench');
  out.push(result('workshop: with the book but no factory he says he needs one', !noFac.ok && /Factory/.test(noFac.message) && kind(noFac.message), { noFac }));
  // 3. a whole build from nothing: the factory alone makes it, he takes it off the tray, and it is put together where it is needed
  const builds = [['footstool', 'right'], ['footstool', 'front'], ['footstool', 'back'], ['builtchair', 'right']];
  for (const [recipe, wall] of builds) {
    shopSetup(wall);
    const R0 = RECIPES_DEF[recipe];
    b.pickRecipe = () => recipe;
    const door = w.doors.workshop, s0 = sfxNow();
    const r = b.interact('woodfactory');
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
    const st = w.stock, s1 = sfxNow(), fac = w.objects.woodfactory;
    const made = Object.values(w.objects).filter((o) => o.kind === R0.object), item = made.length, where = made.map((o) => w.roomIdAt(o.x, o.z)).join();       // flat-packed, carried out and put together where it is needed
    const stored0 = st.items[R0.object] || 0, wantRoom = 'main';
    out.push(result(`workshop: build ${recipe} from nothing (${wall} wall): he goes in, presses the Wood Factory's button, takes it off the tray, and it is put together where it is needed (in the ${wantRoom} room)`, r.ok && wentIn && doorOpened && item === 1 && where === wantRoom && stored0 === 0 && b.inMain() && door.open === 0, { r, wentIn, doorOpened, item, where, stored0, inMain: b.inMain(), open: door.open, t }));
    out.push(result(`workshop: build ${recipe} (${wall}): nothing is left on the factory's tray or in his hands`, b.carry === null && !fac.tray.children.length && fac.running === 0 && !(w.building || []).length, { carry: b.carry, tray: fac.tray.children.length, running: fac.running }));
    const needSounds = ['click', 'machine', 'chime'];
    out.push(result(`workshop: build ${recipe} (${wall}): every step makes its sound`, needSounds.every((k) => heard(s0, s1, k) > 0), { silent: needSounds.filter((k) => !(heard(s0, s1, k) > 0)) }));
    out.push(result(`workshop: build ${recipe} (${wall}): he never stands where he should not, and there are no errors`, bad === 0 && errors.length === base, { bad, errors: errors.slice(base) }));
  }
  // 4. cut short, or the factory taken away: nothing is lost or left behind
  const cut = (label, cond, remove = false, kept = 0) => {
    shopSetup('right');
    b.pickRecipe = () => 'builtchair';
    b.queue = []; b.step = null; b.choose('build');
    const fac = w.objects.woodfactory;
    const t = runUntil(cond, 90), had = { carry: b.carry, tray: fac.tray.children.length, running: fac.running };
    if (remove) { w.removeObject('woodfactory'); b.objectRemoved('woodfactory'); } else b.skip();
    T.settle();
    delete b.pickRecipe;
    out.push(result(`workshop: ${label}: nothing is left on the tray or in his hands, nothing is half-made, and he is back in the room`, t < 90 && b.carry === null && !fac.tray.children.length && Object.values(w.objects).filter((o) => o.kind).length + (w.stock.items.builtchair || 0) === kept && !(w.building || []).length && b.inMain(), { had, t, carry: b.carry, room: b.hereId(), last: b.last, stay: b.stayRoom, building: (w.building || []).length, tray: fac.tray.children.length }));
  };
  cut('cut short while the factory runs', () => w.objects.woodfactory.running > 0.5);
  cut('cut short with the finished thing on the tray', () => w.objects.woodfactory.tray.children.length > 0);
  cut('cut short while carrying it out flat-packed (the finished chair is set down, not lost)', () => b.carry === 'flat', false, 1);
  cut('the Wood Factory taken away while it runs', () => w.objects.woodfactory.running > 0.5, true);
  // 5. locked on the workbench he stays in the Workshop between jobs and comes out when told to stop
  shopSetup('right');
  const siteOrig = b.siteFor; b.siteFor = () => null;            // (what he builds stays in the Workshop: a delivery would take him out, which is tested by sweepNeeds)
  const lk = b.lockOn('toolbox');
  const chosen = []; const origChoose = b.choose.bind(b);
  b.choose = (f) => { origChoose(f); chosen.push(b.last); };
  let stayed = true, lt = 0;
  try { while (lt < 240) { step(0.25); lt += 0.25; if (lt > 40 && !b.inWorkshop() && !b.step) stayed = false; } } finally { b.choose = origChoose; b.siteFor = siteOrig; }
  const stillIn = b.inWorkshop() && !!b.lock;
  b.unlock(true);
  const t5 = runUntil(() => b.inMain() && w.doors.workshop.open === 0, 120);
  out.push(result('workshop: locked on the toolbox he keeps working in the Workshop without going out between jobs, and comes out when told to stop', lk.ok && stayed && stillIn && chosen.length >= 2 && chosen.every((n) => ['tidytools', 'putback', 'dropball'].includes(n)) && t5 < 120 && b.inMain(), { lk: lk.ok, stayed, stillIn, chosen, t5 }));
  // 6. what he makes is counted in storage and added to the room from the Catalog, one at a time, as real objects
  T.resetRooms(); T.removeAll(); R().add('workshop'); w.stock.items = { footstool: 2, builtchair: 1 };
  openObjects('all');
  const card = machineCard('Wooden Foot Stool');
  out.push(result('workshop: the Catalog shows what is in storage and offers Add', !!card && /In storage: 2/.test(card.textContent) && !!card.querySelector('.act') && !!machineCard('Wooden Shelves') && /None in storage/.test(machineCard('Wooden Shelves').textContent)));
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
  out.push(result('workshop: taking the room away takes its furniture and stock with it, and nobody is left inside', !SHOP.some((id) => w.objects[id]) && b.inMain() && Object.keys(w.stock.items).length === 0));
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
      out.push(result(`restaurant: ${wall} wall: the room, its elevator and all five pieces of furniture are added through the Catalog`, res.ok && REST.every((id) => !!w.objects[id]) && !!door && !!door.elevator, { res: res.ok }));
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
  ['woodfactory', 'build', 'workshop', null, null, (s) => s.made], ['toolbox', 'tidytools', 'workshop', null, null, (s) => s.lid],
  ['stove', 'cook', 'restaurant', null, 'ordered', (s) => s.poses.has('workTap') && s.cooked], ['kitchencounter', 'serve', 'restaurant', null, 'cooked', (s) => s.served],
  ['register', 'takepay', 'restaurant', null, 'paying', (s) => s.coins > 0],
  ['metalfactory', 'build', 'workshop', null, null, (s) => s.made],
];
// ---- Locking a door: the robots stay out of the room behind it; the door menu goes to the room on the far side of the face that was pressed ----
const WORK_NAMES = ['tidytools', 'build', 'dusttop'];
T.sweepDoorLock = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  const menu = document.getElementById('menu'), vis = () => [...menu.querySelectorAll('[data-act]')].filter((x) => !x.hidden);
  const note = () => menu.querySelector('.note').textContent, title = () => menu.querySelector('.title').textContent;
  const inAdded = (p) => { const r = w.roomIdAt(p.x, p.z); return r !== 'main' && r !== 'door' ? r : null; };
  try {
    // 1. which face of the door a point is on, on every wall
    for (const wall of ['right', 'front', 'back']) {
      T.settle(); T.resetRooms(); T.removeAll(); T.home();
      const res = R().add('workshop', { walls: [wall] });
      const pm = w.doorPoint('workshop', 0.6), pr = w.doorPoint('workshop', -0.6), V = (q) => new g.root.position.constructor(q.x, 1.0, q.z);
      out.push(result(`doorlock: ${wall} wall: a point in Guy's room is on the 'main' face of the door and one in the workshop is on the 'room' face`, res.ok && w.doorSide('workshop', V(pm)) === 'main' && w.doorSide('workshop', V(pr)) === 'room', { main: w.doorSide('workshop', V(pm)), room: w.doorSide('workshop', V(pr)) }));
    }
    // 2. the menu: the first button goes to the room on the far side of the face pressed (and the other way if he is already there)
    T.settle(); T.resetRooms(); T.removeAll(); T.home();
    R().add('workshop', { walls: ['right'] });
    const door = w.doors.workshop, bnd = door.shell.bounds;
    const first = (side) => { window.__guyOpenDoorMenu('workshop', side); const v = vis(); return { text: v[0] && v[0].textContent, note: note(), n: v.length }; };
    let m1 = first('main'), m2 = first('room');
    out.push(result('doorlock: Guy in his room, pressing the room-side face: it offers the way into the Workshop and says he is already in his room', /Go into the Workshop/.test(m2.text) && /already in Guy's room/.test(m2.note) && /Go into the Workshop/.test(m1.text) && m1.note === '', { m1, m2 }));
    g.root.position.set((bnd.minX + bnd.maxX) / 2, 0, (bnd.minZ + bnd.maxZ) / 2);
    m1 = first('main'); m2 = first('room');
    out.push(result('doorlock: Guy inside the Workshop: the room-side face offers "Go into Guy\'s room", the main-side face "Come back" (he is already inside)', /Go into Guy's room/.test(m2.text) && m2.note === '' && /Come back/.test(m1.text) && /already in the Workshop/.test(m1.note), { m1, m2 }));
    T.home(); T.settle(); menu.hidden = true;
    // 3. the Lock button: padlock shows, state is kept, the title and button say so, and it toggles back
    window.__guyOpenDoorMenu('workshop'); let v = vis();
    out.push(result('doorlock: the door menu has just "Go into" and "Lock the door", and the padlock is hidden while it is unlocked', v.length === 2 && /Lock the door/.test(v[1].textContent) && !door.group.userData.padlock.visible && !R().isDoorLocked('workshop')));
    v[1].click();
    out.push(result('doorlock: pressing Lock the door locks it (state, padlock, rooms) and the menu then offers "Unlock the door"', door.locked === true && door.group.userData.padlock.visible && R().isDoorLocked('workshop') && w.isDoorLocked('workshop')
      && (window.__guyOpenDoorMenu('workshop'), vis().some((x) => /Unlock the door/.test(x.textContent)) && /locked/.test(title()))));
    vis().find((x) => /Unlock the door/.test(x.textContent)).click();
    out.push(result('doorlock: Unlock the door puts it back', door.locked === false && !door.group.userData.padlock.visible && !R().isDoorLocked('workshop')));
    // 4. it is saved with the rooms (and a locked room that comes back is still locked)
    R().setDoorLocked('workshop', true);
    const snap = JSON.parse(JSON.stringify(R().snapshot()));
    T.resetRooms(); T.removeAll();
    R().restoreFrom(snap);
    out.push(result('doorlock: the lock is saved with the rooms and is still there when the room is restored', snap.rooms.workshop && snap.rooms.workshop.doorLocked === true && !!w.doors.workshop && w.doors.workshop.locked === true && w.doors.workshop.group.userData.padlock.visible));
    // 5. he is asked to go in (button, or one of its objects): refused kindly
    T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
    R().add('workshop', { walls: ['right'] }); for (const id of SHOP) T.addObject(id); T.learn(ALL_SHOP_SKILLS);
    R().setDoorLocked('workshop', true);
    const rv = b.visitRoom('workshop'), ri = b.interact('workbench');
    out.push(result('doorlock: with the door locked, asking him to go in, or to use something in there, is refused with a message about the lock', !rv.ok && /locked/i.test(rv.message) && !ri.ok && /locked/i.test(ri.message) && !b.pendingActivity, { rv, ri }));
    // 6. left to himself with everything in there to do, he never goes in while it is locked; unlocked, he does
    const e0 = errors.length;
    let t = 0, entered = 0;
    while (t < 400) { step(0.25); t += 0.25; if (inAdded(g.pos)) entered++; }
    out.push(result('doorlock: 400 seconds with the Workshop locked and work to do in it: he never goes in', entered === 0 && errors.length === e0, { entered }));
    R().setDoorLocked('workshop', false);
    t = 0; entered = 0;
    while (t < 400 && !entered) { step(0.25); t += 0.25; if (inAdded(g.pos)) entered++; }
    out.push(result('doorlock: unlocked again, he goes in to work (so the check above is not an empty one)', entered > 0, { t }));
    // 7. a robot who is inside when it is locked is shut in (a lock works both ways) until it is unlocked; he does what can be done in there
    b.skip(); T.settle(); T.home();
    const dw = () => w.doors.workshop;                              // (the room was taken away and added again above: not the door from the start)
    b.visitRoom('workshop');
    let t7 = 0, inside = false;
    while (t7 < 90 && !inside) { step(0.25); t7 += 0.25; inside = !!inAdded(g.pos); }
    R().setDoorLocked('workshop', true);
    const rb = b.visitRoom('workshop'), rread = b.requestRead('piano'), rint = b.interact('piano');
    // (a door that was open when it was locked swings shut within a second or two, once nobody is in the doorway: only look after that)
    let t8 = 0, left = 0, doorOpened = 0, workedOrWandered = new Set();
    while (t8 < 240) { step(0.25); t8 += 0.25; if (!inAdded(g.pos)) left++; if (t8 > 3 && dw().open > 0.05) doorOpened++; workedOrWandered.add(b.last); }
    out.push(result('doorlock: locked while he is inside, he is shut in: asked to come out or to do something outside, he says so, and for 240 seconds he stays in with the door shut', inside && !rb.ok && /shut in/i.test(rb.message) && !rread.ok && !rint.ok && /shut in/i.test(rint.message) && left === 0 && doorOpened === 0 && !!inAdded(g.pos), { inside, rb, left, doorOpened, did: [...workedOrWandered] }));
    out.push(result('doorlock: shut in, he only does what can be done in the room (work, or wandering about), never anything of the main room', [...workedOrWandered].every((a) => WORK_NAMES.includes(a) || ['stuck', 'idle', 'visit'].includes(a)), { did: [...workedOrWandered] }));
    R().setDoorLocked('workshop', false);
    t8 = 0; while (t8 < 400 && !(b.inMain() && dw().open === 0)) { step(0.25); t8 += 0.25; }
    out.push(result('doorlock: unlocked, he comes out through the door and shuts it', b.inMain() && dw().open === 0 && !dw().locked, { t8, last: b.last, room: w.roomIdAt(g.pos.x, g.pos.z), stuck: b.stuckIn(), open: dw().open, queue: b.queue.length, lock: b.lock && b.lock.name, carry: b.carry, label: label() }));
    // ... unless another door of the room is unlocked
    b.visitRoom('workshop');
    t7 = 0; inside = false; while (t7 < 90 && !inside) { step(0.25); t7 += 0.25; inside = !!inAdded(g.pos); }
    R().setDoorLocked('workshop', true);
    const only = b.stuckIn();
    b.exitsOf = () => [dw(), { locked: false }];                  // (rooms have the one door today: pretend this one has a second, unlocked, door)
    const withSecond = b.stuckIn();
    delete b.exitsOf;
    out.push(result('doorlock: he is shut in only while every door out of the room is locked (an unlocked second door lets him out)', inside && only === 'workshop' && withSecond === null, { inside, only, withSecond }));
    R().setDoorLocked('workshop', false);
    t8 = 0; while (t8 < 120 && !b.inMain()) { step(0.25); t8 += 0.25; }
    // 8. both robots stay out of a locked Restaurant (and customers do not arrive at a locked, unattended restaurant)
    T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
    if (w.gal.exists()) w.gal.remove();
    unlockRoom('restaurant'); R().add('restaurant', { walls: ['front'] });
    for (const id of REST) T.addObject(id);
    T.learn(['restaurant']);
    const rs = w.restaurant, wasHead = rs.headless; rs.headless = true; rs.paused = true;
    const galOk = !!(w.gal.g && w.gal.g.loaded);
    if (galOk) { w.gal.spawn(-2, 1.5); w.gal.brain.skills.known.clear(); w.gal.brain.skills.learn('restaurant'); }
    const cs = [rs.stage('ordered'), rs.stage('waiting')];
    R().setDoorLocked('restaurant', true);
    const rr = b.interact('stove');
    out.push(result('doorlock: the Restaurant is closed while its door is locked, and asking him to cook there is refused', !rs.isOpen() && !rr.ok && /locked/i.test(rr.message), { rr }));
    t = 0; let inG = 0, inGal = 0, served = 0;
    while (t < 300) { step(0.25); t += 0.25; if (inAdded(g.pos)) inG++; if (galOk && inAdded(w.gal.g.pos)) inGal++; if (cs.some((c) => ['cooking', 'cooked', 'eating', 'paying'].includes(c.state))) served++; }
    out.push(result(`doorlock: 300 seconds with the Restaurant locked and customers waiting: ${galOk ? 'neither Guy nor GAL' : 'Guy'} goes in, and nobody is served`, inG === 0 && inGal === 0 && served === 0, { inG, inGal, served, states: cs.map((c) => c.state) }));
    R().setDoorLocked('restaurant', false);
    rs.stage('ordered');
    t = 0; let anyIn = false;
    while (t < 300 && !anyIn) { step(0.25); t += 0.25; anyIn = !!inAdded(g.pos) || (galOk && !!inAdded(w.gal.g.pos)); }
    out.push(result('doorlock: unlocked again, somebody goes in to look after the customers', anyIn, { t }));
    rs.headless = wasHead; rs.paused = false;
    if (w.gal.exists()) w.gal.remove();
  } finally {
    T.resetRooms(); T.home(); T.removeAll(); T.settle(); menu.hidden = true;
  }
  out.push(result('doorlock: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

T.sweepSides = (only = null, onlyRot = null, onlyWall = null) => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  const wallSpots = (o, bnd, gap = 0.03) => {                  // the object's centre when it is `gap` metres from each wall, in the middle of that wall
    const hw = o.w / 2, hd = o.d / 2, mx = (bnd.minX + bnd.maxX) / 2, mz = (bnd.minZ + bnd.maxZ) / 2;
    return [['minX', bnd.minX + hw + gap, mz], ['maxX', bnd.maxX - hw - gap, mz], ['minZ', mx, bnd.minZ + hd + gap], ['maxZ', mx, bnd.maxZ - hd - gap]];
  };
  for (const [id, act, room, stock, customer, proof] of SIDES_TESTS) {
    if (only && id !== only) continue;
    let tried = 0, passed = 0; const bad = [];
    for (const gap of [0.03, 0.45, 0.7]) for (let rot = 0; rot < 4; rot++) {                // touching the wall, and a gap too narrow to stand in, and a little wider
      for (let wi = 0; wi < 4; wi++) {
        if ((onlyRot !== null && rot !== onlyRot) || (onlyWall !== null && wi !== onlyWall)) continue;
        // start from a clean room each time
        T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
        unlockRoom(room); R().add(room, { walls: ['right'] });
        const m = MANIFEST.activities[act];
        for (const need of m.objects) T.addObject(need);
        T.learn(m.skills || []);
        const o = w.objects[id], bnd = w.doors[room].shell.bounds;
        const [wallName, x, z] = wallSpots(o, bnd, gap)[wi];
        while (o.rot !== rot) o.rotate(1);
        const [, x2, z2] = wallSpots(o, bnd, gap)[wi];                  // (the footprint changes with the turn)
        o.set(x2, z2); void x; void z;
        const clash = w.obstacles.some((p) => p !== o.obstacle && p.x0 < o.obstacle.x1 && p.x1 > o.obstacle.x0 && p.z0 < o.obstacle.z1 && p.z1 > o.obstacle.z0);
        if (clash || !w.fits(o, o.x, o.z)) { o.rotate(0); continue; }          // that spot is taken by another piece: not a test of this one
        if (customer) { w.restaurant.clear(); w.restaurant.paused = true; w.restaurant.headless = true; w.restaurant.stage(customer); }
        tried++;
        b.queue = []; b.step = null;
        const siteOrig = b.siteFor;
        if (act === 'build') { T.learn(['workshop', 'workshop.metal']); b.pickRecipe = () => (id === 'metalfactory' ? 'metalchair' : 'footstool'); b.siteFor = () => null; }       // (what he makes stays in the Workshop)
        b.choose(act);
        let t = 0, off = 0, done = false, pressed = 0; const e0 = errors.length, hist = [];
        const labels = [];
        const seen = { poses: new Set(), lid: false, cooked: false, served: false, made: false, coins: 0 };
        while (t < 260) {
          step(0.25); t += 0.25;
          if (b.step) seen.poses.add(b.pose);
          if (labels[labels.length - 1] !== label()) labels.push(label().slice(0, 50) + '@' + g.pos.x.toFixed(1) + ',' + g.pos.z.toFixed(1));
          if (w.objects.toolbox && w.objects.toolbox.open > 0.2) seen.lid = true;
          if (customer && w.restaurant.list[0] && ['cooked', 'eating'].includes(w.restaurant.list[0].state)) seen.cooked = true;
          seen.served = w.restaurant.nServed > 0; seen.coins = w.stock.coins; if (w.objects[id] && w.objects[id].tray && w.objects[id].tray.children.length) seen.made = true;
          if (!w.walkable(g.pos.x, g.pos.z) && !w.inMain(g.pos.x, g.pos.z)) off++;
          hist.push([g.pos.x, g.pos.z]);
          if (hist.length > 4) { const a = hist[hist.length - 5]; if (b.moving && Math.hypot(a[0] - g.pos.x, a[1] - g.pos.z) < 0.12) pressed += 0.25; }       // walking but getting nowhere: pushing against a wall
          if (b.last !== act && t > 1) { done = true; break; }
        }
        if (customer) w.restaurant.clear();
        delete b.pickRecipe; b.siteFor = siteOrig;
        const ok = done && off === 0 && pressed < 2 && errors.length === e0 && b.carry === null && proof(seen);
        const ls = b.lastStand, nowhere = !ok && ls && ls.name === id && Object.keys(ls.why).length >= 4;
        if (nowhere) { tried--; T.settle(); continue; }                                 // every side is walled in or taken by other furniture: nothing to test
        if (ok) passed++; else bad.push({ rot, wall: wallName, gap, pressed, done, off, t, errs: errors.slice(e0, e0 + 1), poses: [...seen.poses].join('/'), labels: labels.slice(0, 6), obj: [+o.x.toFixed(2), +o.z.toFixed(2), o.rot] });
        T.settle();
      }
    }
    out.push(result(`sides: ${id}: ${act} works against every wall at three distances, turned every way (${tried} placements)`, tried > 0 && passed === tried, { tried, passed, bad: bad.slice(0, 3) }));
  }
  T.resetRooms(); T.removeAll(); T.settle();
  out.push(result('sides: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 18b. The Workshop's metal line: Metal Factory, Metal Cutter, Welder, Hammer & Anvil, and what Guy builds from metal (workobjects.js, workbrain.js) ----
const metalSetup = (wall = 'right') => {
  const res = shopSetup(wall, [...ALL_SHOP_SKILLS, 'workshop.metal']);
  for (const id of METAL) T.addObject(id);
  return res;
};
T.sweepMetal = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  const kind = (m) => !BANNED.test(m);
  // 1. the Metal Factory is added through the Catalog with its book, and stands in the room
  for (const wall of ['right', 'front', 'back']) {
    const res = metalSetup(wall);
    const objs = [...SHOP, ...METAL].map((id) => w.objects[id]).filter(Boolean);
    out.push(result(`metal: ${wall} wall: the Metal Factory is added through the Catalog, with its book on the shelf`, res.ok && METAL.every((id) => !!w.objects[id]) && w.objects.shelf.books.some((r) => r.def.id === 'metalfab'), { res: res.ok, have: METAL.filter((id) => !!w.objects[id]) }));
    const inside = objs.every((o) => w.roomIdAt(o.x, o.z) === 'workshop' && w.fits(o, o.x, o.z));
    let overlap = null;
    for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) if (rectsOv(objs[i].obstacle, objs[j].obstacle)) overlap = [objs[i].name, objs[j].name];
    out.push(result(`metal: ${wall} wall: everything stands inside the room, clear of the door and of each other`, inside && !overlap, { inside, overlap }));
    const o = w.objects.metalfactory, l = o.local(0, 0.78), p = { x: o.x + l.x, z: o.z + l.z };
    const blocked = w.roomIdAt(p.x, p.z) !== 'workshop' || w.obstacles.some((q) => p.x > q.x0 - 0.25 && p.x < q.x1 + 0.25 && p.z > q.z0 - 0.25 && p.z < q.z1 + 0.25 && q !== o.obstacle);
    out.push(result(`metal: ${wall} wall: the place he stands to use the Metal Factory is free floor`, !blocked, { p }));
  }
  // 2. what he says when he cannot (kind messages)
  shopSetup('right', ['workshop']); for (const id of METAL) T.addObject(id);
  b.queue = []; b.step = null;
  const noBook = b.interact('metalfactory');
  out.push(result('metal: without the book he is refused kindly and told which book', !noBook.ok && /Metal Fabrication for Robots/.test(noBook.message) && kind(noBook.message), { noBook }));
  // 3. a whole metal build from nothing: the Metal Factory alone makes it (a guitar uses both factories, metal first)
  for (const [recipe, wall] of [['metalchair', 'right'], ['metalchair', 'front'], ['metalchair', 'back'], ['eguitar', 'right']]) {
    metalSetup(wall);
    const R0 = RECIPES_DEF[recipe];
    b.pickRecipe = () => recipe;
    const door = w.doors.workshop, s0 = sfxNow();
    const r = b.interact(recipe === 'eguitar' ? 'workbench' : 'metalfactory');
    let t = 0, wentIn = false, bad = 0, armed = false; const order = [];
    while (t < 700) {
      step(0.25); t += 0.25;
      if (!armed && b.last === 'build') { armed = true; b.pendingActivity = 'wander'; }
      if (b.inWorkshop()) wentIn = true;
      for (const f of ['metalfactory', 'woodfactory']) if (w.objects[f] && w.objects[f].running > 0 && !order.includes(f)) order.push(f);
      if (!w.walkable(g.pos.x, g.pos.z) && !w.inMain(g.pos.x, g.pos.z)) bad++;
      if (armed && wentIn && b.inMain() && b.last !== 'build' && door.open === 0) break;
    }
    delete b.pickRecipe;
    const st = w.stock, s1 = sfxNow(), mf = w.objects.metalfactory, wf = w.objects.woodfactory;
    const made = Object.values(w.objects).filter((o) => o.kind === R0.object), item = made.length, where = made.map((o) => w.roomIdAt(o.x, o.z)).join();
    const want = recipe === 'eguitar' ? 'metalfactory,woodfactory' : 'metalfactory';
    out.push(result(`metal: build ${recipe} from nothing (${wall} wall): he goes in, uses ${recipe === 'eguitar' ? 'the Metal Factory and then the Wood Factory' : 'the Metal Factory alone'}, comes out, and it is put together in the room`, r.ok && wentIn && item === 1 && where === 'main' && (st.items[R0.object] || 0) === 0 && order.join() === want && b.inMain() && door.open === 0, { r, wentIn, item, where, order, inMain: b.inMain(), open: door.open, t }));
    out.push(result(`metal: build ${recipe} (${wall}): nothing is left on a factory's tray or in his hands`, b.carry === null && !mf.tray.children.length && !wf.tray.children.length && !(w.building || []).length, { carry: b.carry }));
    const need = ['machine', 'click', 'chime'];
    out.push(result(`metal: build ${recipe} (${wall}): every step makes its sound`, need.every((k) => heard(s0, s1, k) > 0), { silent: need.filter((k) => !(heard(s0, s1, k) > 0)) }));
    out.push(result(`metal: build ${recipe} (${wall}): he never stands where he should not, and there are no errors`, bad === 0 && errors.length === base, { bad, errors: errors.slice(base) }));
  }
  // 4. cut short, or a factory taken away part-way through the guitar: nothing is left behind
  const cut = (label, cond, remove = null) => {
    metalSetup('right');
    b.pickRecipe = () => 'eguitar';
    b.queue = []; b.step = null; b.choose('build');
    const t = runUntil(cond, 200);
    if (remove) { w.removeObject(remove); b.objectRemoved(remove); } else b.skip();
    T.settle();
    delete b.pickRecipe;
    const mf = w.objects.metalfactory, wf = w.objects.woodfactory;
    out.push(result(`metal: ${label}: nothing is left on a tray or in his hands, nothing is half-made, and he is back in the room`, t < 200 && b.carry === null && !(mf && mf.tray.children.length) && !(wf && wf.tray.children.length) && !Object.values(w.objects).some((o) => o.kind) && !w.stock.items.eguitar && !(w.building || []).length && b.inMain(), { t, carry: b.carry }));
  };
  cut('cut short while the Metal Factory runs', () => w.objects.metalfactory.running > 0.5);
  cut('cut short carrying the hardware to the Wood Factory', () => b.carry === 'bars');
  cut('the Wood Factory taken away while the hardware is carried to it', () => b.carry === 'bars', 'woodfactory');
  // 5. the Catalog lists what is in storage, and Add makes a real chair he can sit on
  T.resetRooms(); T.removeAll(); R().add('workshop'); w.stock.items = { metalchair: 1 };
  openObjects('all');
  const card = machineCard('Metal Chair (built by Guy)');
  out.push(result('metal: the Catalog shows the metal chair in storage and offers Add', !!card && /In storage: 1/.test(card.textContent) && !!card.querySelector('.act')));
  card.querySelector('.act').click(); machine().hidden = true;
  out.push(result('metal: a metal chair Guy built is a chair he can sit on', b.chairs().some((c) => c.name === 'metalchair_1') && !w.stock.items.metalchair));
  T.resetRooms(); T.removeAll(); T.settle(); machine().hidden = true;
  out.push(result('metal: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 18c. Building only what the house needs, and where it goes (src/needs.js, workbrain.js; Catalog gating in machine.js) ----
const clearBooks = () => {
  const sh = W().objects.shelf; if (!sh) return;
  for (const rec of [...sh.books]) if (!rec.def.start) sh.removeBook(rec);
  for (const r of sh.albums.splice(0)) r.mesh.parent && r.mesh.parent.remove(r.mesh);                  // (and the records a test added)
};        // the books a test put on the shelf
const needSetup = (wall = 'right', skills = [], { metal = false, chair = true } = {}) => {
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); clearBooks(); T.settle(); T.home();
  R().add('workshop', { walls: [wall] });
  for (const id of SHOP) T.addObject(id);
  if (metal) for (const id of METAL) T.addObject(id);
  if (chair) T.addObject('armchair');                                       // (a seat for Guy: nothing missing unless a scenario takes it away)
  T.learn(skills);
};
// run his 'build' to the end (the delivery is part of it); returns the simulated seconds, or -1 if it never finished
const buildToEnd = (brain, max = 1100) => {
  brain.queue = []; brain.step = null; brain.choose('build');
  let t = 0, armed = false;
  while (t < max) {
    step(0.25); t += 0.25;
    if (!armed && brain.last === 'build') { armed = true; brain.pendingActivity = 'wander'; }
    if (armed && brain.last !== 'build' && !(W().building || []).length) return t;
  }
  return -1;
};
const kindIn = (w, kind, room) => Object.values(w.objects).filter((o) => o.kind === kind && (!room || w.roomIdAt(o.x, o.z) === room));
T.sweepNeeds = () => {
  const out = [], base = errors.length, w = W(), b = B();
  const seat = () => wants(b).some((x) => x.serves === 'seat');
  // 1. the Catalog lists the wooden chairs only once Guy or GAL has read the book that teaches building them
  T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); machine().hidden = true;
  delete w.removed.chair; delete w.removed.chair2;                       // (earlier sweeps took them out: a chair that was put away is listed, one never added is not)
  openObjects('all');
  const before = !machineCard('Wooden Chair') && !machineCard('Second Wooden Chair');
  T.learn(['workshop.furniture']); openObjects('all');
  const after = !!machineCard('Wooden Chair') && !!machineCard('Second Wooden Chair') && !!machineCard('Wooden Chair').querySelector('.act');
  T.forget(); openObjects('all');
  const gone = !machineCard('Wooden Chair');
  out.push(result('needs: the wooden chairs are not in the Catalog by default, appear once Guy has read "Furniture for Robots", and go again if he forgets it', before && after && gone, { before, after, gone }));
  T.resetRooms(); T.removeAll(); T.settle(); machine().hidden = true;
  // 2. nothing is built when nothing is needed
  needSetup('right', ['workshop', 'workshop.materials', 'workshop.furniture']);
  out.push(result('needs: with a seat in the room and nothing else wanted he builds nothing (no recipe, no build activity)', !wants(b).length && b.pickRecipe() === null && !b.available('build'), { wants: wants(b) }));
  // 3. no chair: he builds one, it is carried out flat-packed and put together in the room, and then he builds no more
  needSetup('right', ['workshop', 'workshop.materials', 'workshop.furniture'], { chair: false });
  const e3 = errors.length, picked = b.pickRecipe();
  out.push(result('needs: with no chair in the room a chair is wanted and he picks to build one', seat() && picked === 'builtchair' && b.available('build'), { picked, wants: wants(b) }));
  const t3 = buildToEnd(b);
  const chairs = kindIn(w, 'builtchair', 'main');
  out.push(result('needs: he builds it, carries it out of the Workshop and puts it together in the room where it can be sat on; then no chair is wanted', t3 > 0 && chairs.length === 1 && !seat() && b.chairs().some((c) => c.name === chairs[0].name) && b.inMain() && b.carry === null && errors.length === e3, { t3, chairs: chairs.length, seat: seat(), inMain: b.inMain(), carry: b.carry, errs: errors.slice(e3, e3 + 1) }));
  out.push(result('needs: and the next time he looks there is nothing to build', b.pickRecipe() === null && !b.available('build')));
  // 4. a metal chair when he only knows metalwork
  needSetup('front', ['workshop', 'workshop.metal'], { metal: true, chair: false });
  const e4 = errors.length, t4 = buildToEnd(b);
  out.push(result('needs: knowing only metalwork he builds a metal chair (welded) and puts it together in the room', t4 > 0 && kindIn(w, 'metalchair', 'main').length === 1 && errors.length === e4, { t4, errs: errors.slice(e4, e4 + 1) }));
  // 5. the top of a window is out of reach: a foot stool, put together right by the window; and he can then stand on it to clean
  needSetup('back', ['workshop', 'decorate'], { chair: true });
  for (const id of ['window', 'window2']) T.addObject(id);
  const e5 = errors.length, wantReach = wants(b).some((x) => x.serves === 'reach'), t5 = buildToEnd(b);
  const stool = kindIn(w, 'footstool', 'main')[0];
  const nearWall = !!stool && (Math.abs(stool.x + 4.45) < 0.2 || Math.abs(stool.z + 3.45) < 0.2);
  out.push(result('needs: a window top out of reach wants a foot stool; he builds it and puts it together by the wall under a window', wantReach && t5 > 0 && !!stool && nearWall && errors.length === e5, { wantReach, t5, stool: stool && [stool.x, stool.z], errs: errors.slice(e5, e5 + 1) }));
  // 6. books on the floor: a bookshelf, and the stacked books move onto it
  needSetup('right', ['workshop', 'workshop.materials', 'workshop.furniture']);
  const sh = w.objects.shelf;
  for (const d of BOOK_CATALOG) { if (d.room || d.locked) continue; if (d.requires && d.requires.object && !w.objects[d.requires.object]) T.addObject(d.requires.object); T.addBook(d.id); }
  const stacked0 = sh.books.filter((r) => r.stack).length, wantBooks = wants(b).some((x) => x.serves === 'books');
  const e6 = errors.length, t6 = buildToEnd(b);
  const shelf2 = kindIn(w, 'bookshelf2', 'main')[0];
  out.push(result('needs: books stacked on the floor want another bookshelf; he builds one and the stacked books stand on it', stacked0 > 0 && wantBooks && t6 > 0 && !!shelf2 && sh.books.filter((r) => r.stack).length === 0 && sh.books.filter((r) => r.host === shelf2.name).length === stacked0 && errors.length === e6, { stacked0, wantBooks, t6, hosted: shelf2 && sh.books.filter((r) => r.host === shelf2.name).length, errs: errors.slice(e6, e6 + 1) }));
  // he can read a book that stands on the new shelf (and learns from it)
  const rec = sh.books.find((r) => r.host);
  T.forget(); skillsOf().fading.clear();
  b.queue = []; b.step = null; b.skip(); T.settle();
  b.forceBook = rec; b.pendingActivity = null; b.choose('read');
  const got = runUntil(() => b.skills.has(rec.def.teaches), 120);
  out.push(result('needs: he reads a book from the built bookshelf like from the first one', got < 120 && b.skills.has(rec.def.teaches), { book: rec.def.id, got }));
  // records too: past the top shelf's twelve they stand on the built shelf, and Guy fetches one from there for the stereo
  T.addObject('table'); for (const a of ALBUM_CATALOG) T.addAlbum(a.id);
  const albumsAfter = () => { for (const r of [...sh.albums]) { sh.albums.splice(sh.albums.indexOf(r), 1); r.mesh.parent && r.mesh.parent.remove(r.mesh); } };
  const hostedRec = sh.albums.filter((r) => r.host === shelf2.name).length;
  out.push(result('needs: records past the eight on the top shelf of the first bookshelf stand on the built one', sh.albums.length > 8 && hostedRec === sh.albums.length - 8, { albums: sh.albums.length, hostedRec }));
  albumsAfter();
  // taking the built bookshelf away puts its books back on the floor stack
  b.skip(); T.settle(); const nm = shelf2.name; w.storeInstance(nm); b.objectRemoved(nm); T.settle();
  out.push(result('needs: taking the built bookshelf away puts its books back on the floor (none are lost)', sh.books.filter((r) => r.stack).length === stacked0 && sh.books.every((r) => !r.host || w.objects[r.host]) && !!w.stock.items.bookshelf2));
  // 7. the restaurant is full: a table
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); clearBooks(); T.settle(); T.home();
  unlockRoom('restaurant'); R().add('restaurant', { walls: ['front'] }); for (const id of REST) T.addObject(id);
  R().add('workshop', { walls: ['right'] }); for (const id of SHOP) T.addObject(id); T.addObject('armchair');
  T.learn(['restaurant', 'workshop', 'workshop.materials', 'workshop.furniture']);
  const r = w.restaurant; r.paused = true; r.headless = true; r.clear();
  const calm = !wants(b).some((x) => x.serves === 'diners');
  r.turnedAway = 3;
  const wantTable = wants(b).some((x) => x.serves === 'diners'), e7 = errors.length, nTables = r.tables().length, t7 = buildToEnd(b, 1500);
  const nowTables = r.tables().length;
  out.push(result('needs: customers turned away from a full restaurant want a table; he builds one, carries it there and the restaurant has more seats', calm && wantTable && t7 > 0 && nowTables === nTables + 1 && kindIn(w, 'diningtable3', 'restaurant').length === 1 && r.maxCustomers() > 3 - 1 && errors.length === e7, { calm, wantTable, t7, nTables, nowTables, errs: errors.slice(e7, e7 + 1) }));
  r.headless = false; r.paused = false;
  // 8. an electric guitar when both workshop lines are there: put together in the room, and both robots can play a guitar at once
  needSetup('right', ['workshop', 'workshop.materials', 'workshop.furniture', 'workshop.metal', 'guitar'], { metal: true });
  T.addObject('guitar');
  const wantBand = wants(b).some((x) => x.serves === 'band'), e8 = errors.length, t8 = buildToEnd(b, 1500);
  const eg = kindIn(w, 'eguitar', 'main')[0];
  out.push(result('needs: with both workshop lines and a guitar he builds an electric guitar (metal hardware, wooden body) and puts it together in the room', wantBand && t8 > 0 && !!eg && eg.guitar && eg.electric && errors.length === e8, { wantBand, t8, eg: !!eg, errs: errors.slice(e8, e8 + 1) }));
  clearBooks(); T.removeAll(); T.settle(); machine().hidden = true;
  out.push(result('needs: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 21. GAL: the Build a Bot machine, the second robot, and how she and Guy work together (src/gal.js, botobjects.js) ----
// (her model is loaded when the page starts: `world.gal.ready`)
const galReset = () => {
  const w = W();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear();
  if (w.gal.exists()) w.gal.remove();
  delete w.removed.botprinter;
  const shelf = w.objects.shelf;
  if (shelf) for (const rec of [...shelf.books]) if (!rec.def.start) shelf.removeBook(rec);        // the books the last test put on the shelf
  T.home(); T.settle();
};
// build her through the real machine: add it (the harness unlocks premium), Guy uses it
const galBuild = () => {
  const w = W(), b = B();
  const was = dev.all; dev.all = true;
  w.addNew('botprinter', null);
  dev.all = was;
  b.queue = []; b.step = null; b.choose('buildbot');
  let t = 0; while (t < 80 && !(w.gal.exists() && !w.gal.emerge)) { step(0.5); t += 0.5; }
  return { ok: w.gal.exists() && !w.gal.emerge, t };
};
T.sweepGal = () => {
  const out = [], base = errors.length, w = W(), b = B(), gal = w.gal;
  if (!gal.g || !gal.g.loaded) return [result('gal: her model is loaded (wait a moment after the page opens)', false)];
  galReset();
  try {
  // 1. the machine is a premium thing: locked in the Catalog until unlocked, then added like anything else
  openObjects('all');
  const card0 = machineCard('Build a Bot Machine');
  out.push(result('gal: the Build a Bot machine is listed in the Catalog as locked (no Add button)', !!card0 && !card0.querySelector('.act') && /Locked/.test(card0.textContent) && !T.addObject('botprinter')));
  machine().hidden = true;
  dev.all = true; openObjects('all');
  const card1 = machineCard('Build a Bot Machine');
  out.push(result('gal: with premium unlocked it can be added, and it stands on free floor', !!card1 && !!card1.querySelector('.act')));
  card1.querySelector('.act').click(); machine().hidden = true; dev.all = false;
  const m = w.objects.botprinter;
  out.push(result('gal: the machine stands in the room, clear of everything', !!m && w.fits(m, m.x, m.z)));
  // the long-press menu: its button makes Guy use it (it used to say he could not do anything with it)
  window.__guyOpenMenu('botprinter');
  const menu = document.getElementById('menu'), useBtn = [...menu.querySelectorAll('[data-act]')].find((x) => !x.hidden && /Build GAL|Use/.test(x.textContent));
  b.queue = []; b.step = null; b.skip();
  if (useBtn) useBtn.click();
  menu.hidden = true;
  out.push(result('gal: long-pressing the machine and choosing its button sends Guy to build her (not the old refusal)', !!useBtn && b.pendingActivity === 'buildbot', { btn: useBtn && useBtn.textContent, pending: b.pendingActivity }));
  b.pendingActivity = null;
  // 2. Guy uses it and it folds itself into GAL
  b.queue = []; b.step = null; b.choose('buildbot');
  const seen = [], s0 = sfxNow();
  let t = 0, sawRun = false, scaleMin = 1;
  while (t < 80 && !(gal.exists() && !gal.emerge)) {
    step(0.25); t += 0.25;
    if (m.running > 0) sawRun = true;
    if (gal.exists() && gal.emerge) scaleMin = Math.min(scaleMin, m.group.scale.y);
    if (seen[seen.length - 1] !== label()) seen.push(label().slice(0, 30));
  }
  const s1 = sfxNow();
  out.push(result('gal: Guy goes to the machine, presses the button, it prints and then folds itself into GAL (the machine shrinks away)', gal.exists() && !gal.emerge && sawRun && scaleMin < 0.3 && !w.objects.botprinter && seen[0] === 'building GAL', { seen, sawRun, scaleMin, t }));
  out.push(result('gal: the machine is used up: it is not in the Catalog to put back, and its card says GAL is here', !w.removed.botprinter && (() => { dev.all = true; openObjects('all'); const c = machineCard('Build a Bot Machine'); const ok = !!c && !c.querySelector('.act') && /GAL is here/.test(c.textContent); dev.all = false; machine().hidden = true; return ok; })()));
  out.push(result('gal: building her makes its sounds (machine, chime)', heard(s0, s1, 'machine') > 0 && heard(s0, s1, 'chime') > 0));
  let gb = gal.brain; const gr = gal.g.root;
  out.push(result('gal: she starts with no skills, stands on the floor at full size, and is an obstacle for Guy (and he for her)', gb.skills.known.size === 0 && Math.abs(gr.scale.y - 1) < 0.01 && T.feetOf(gal.g) < 0.06 && w.obstacles.filter((o) => o.char).length === 2 && b.selfOb !== gb.selfOb));
  // 3. a long stretch of free time: both do their own things, apart from each other, with no errors
  let t3 = 0, close = 0, bothAt = {}, galActs = new Set(), guyActs = new Set(), e3 = errors.length;
  const shared = ['piano', 'drums', 'guitar', 'easel', 'telescope'];
  while (t3 < 420) {
    step(0.25); t3 += 0.25;
    galActs.add(gb.last); guyActs.add(b.last);
    const d = Math.hypot(G().pos.x - gal.g.pos.x, G().pos.z - gal.g.pos.z);
    if (d < 0.25) close++;                      // (walking past each other can touch for a moment)
    for (const n of shared) if (b.using.has(n) && gb.using.has(n)) bothAt[n] = (bothAt[n] || 0) + 1;      // both claim the same thing
  }
  out.push(result('gal: for 7 minutes the two of them do their own things (she reads books, plays, wanders) without errors', errors.length === e3 && galActs.size >= 4 && guyActs.size >= 4, { gal: [...galActs], guy: [...guyActs], errs: errors.slice(e3, e3 + 1) }));
  out.push(result('gal: they never use the same piano, drums, guitar, easel or telescope at once, and never stand on each other', Object.keys(bothAt).length === 0 && close <= 24, { bothAt, closeFrames: close }));
  // 4. her skills are her own: she learns by reading, Guy's stay his
  galReset(); galBuild(); gb = gal.brain;
  const sh = w.objects.shelf; T.addObject('telescope'); T.addBook('stars');           // (the object first: a book for something that is not there is not shown)
  skillsOf().known.clear(); gb.skills.known.clear();
  gb.queue = []; gb.step = null; gb.orders.push({ kind: 'read', book: 'stars' }); gb.choose();
  const availGuy = b.available.bind(b); b.available = (a) => a !== 'read' && availGuy(a);        // (Guy has no mind to read just now: the question is what her reading does, not who reads the book first)
  let t4 = 0; try { while (t4 < 420 && !gb.skills.has('telescope')) { step(0.5); t4 += 0.5; } } finally { b.available = availGuy; }
  out.push(result('gal: she must read a book to gain a skill (ordered to read the stargazing book she learns it), and Guy does not learn it from her reading', gb.skills.has('telescope') && !skillsOf().has('telescope'), { t4 }));
  void sh;
  // 5. Guy asks her to read and come and find him, then they jam: the drums
  galReset(); galBuild(); gb = gal.brain;
  for (const id of ['drums', 'piano', 'table']) T.addObject(id);
  for (const id of ['drumming', 'drumsolo', 'drumband']) T.addBook(id);
  skillsOf().known.clear(); T.learn(['piano', 'stereo']); gb.skills.known.clear();
  const plan = gal.planDuo();
  out.push(result('gal: with drums and the drumming books on the shelf, Guy can plan a jam and she has to read all three drumming books first', !!plan && plan.galInst === 'drums' && plan.books.length === 3 && plan.guyInst === 'piano', { plan }));
  const noBook = (() => { const rec = w.objects.shelf.books.find((x) => x.def.id === 'drumband'); const was = rec.mesh.visible; rec.mesh.visible = false; const p = gal.planDuo(); rec.mesh.visible = was; return p; })();
  out.push(result('gal: if the book she needs is not on the shelf there is no plan for drums', !noBook || noBook.galInst !== 'drums'));
  b.queue = []; b.step = null; b.choose('bandjam');
  const talk = [], jam = { guyPlays: false, galPlays: false, both: false };
  let t5 = 0; const e5 = errors.length, s5 = sfxNow();
  while (t5 < 700) {
    step(0.25); t5 += 0.25;
    if (gb.last === 'jamdrums' && gb.step) jam.galPlays = true;
    if (b.last === 'bandplay' && b.pose === 'piano' && gb.pose === 'drumSit') jam.both = true;
    if (!gal.duo && t5 > 30) break;
  }
  const said = gal.log.join(' | ');
  out.push(result('gal: Guy asks her to go and read the drumming books and find him: she reads all three, comes to find him, says she is ready', gb.skills.has('drums') && gb.skills.has('drums.solo') && gb.skills.has('drums.band') && /GUY asks GAL: read drumming, drumsolo, drumband/.test(said) && /GAL: I am ready/.test(said), { said, t5 }));
  out.push(result('gal: then they jam together: Guy on the piano and GAL on the drums at the same time, to the stereo', jam.galPlays && /GAL and GUY jam: piano \+ drums/.test(said) && jam.both, { jam, said }));
  out.push(result('gal: nothing broke while they did it (no errors, nothing carried)', errors.length === e5 && b.carry === null && gb.carry === null, { errs: errors.slice(e5, e5 + 1) }));
  // if she already has the skills the plan needs no reading
  gb.skills.learn('drums.band');
  const plan2 = gal.planDuo();
  out.push(result('gal: when she already has the skills there is nothing to read: Guy just asks her to come and play', !plan2 || plan2.galInst !== 'drums' || plan2.books.every((id) => id !== 'drumband')));
  // 6. her own idea: switch the stereo on, ask Guy to dance, dance, and the last one to stop switches the music off
  galReset(); galBuild(); gb = gal.brain;
  for (const id of ['table']) T.addObject(id);
  skillsOf().known.clear(); gb.skills.known.clear(); gb.skills.learn('stereo');
  T.settle();
  gb.queue = []; gb.step = null; gb.skip(true); gb.choose('invitedance');
  const seen6 = []; let t6 = 0, wasOn = false; const e6 = errors.length;
  while (t6 < 150) {
    step(0.25); t6 += 0.25;
    if (b.music) wasOn = true;
    const s = `${b.last}/${gb.last}`; if (seen6[seen6.length - 1] !== s) seen6.push(s);
    if (wasOn && !b.music && t6 > 20) break;
  }
  const said6 = gal.log.join(' | ');
  out.push(result('gal: her own idea: she switches the stereo on, asks Guy to dance, he stops what he is doing, they dance, and the music goes off when they have both finished', wasOn && !b.music && /GAL asks GUY: dance/.test(said6) && seen6.some((s) => s === 'dance/dance') && errors.length === e6, { seen6: seen6.slice(0, 10), said6, t6 }));
  out.push(result('gal: she asks nothing of Guy while he is locked on something', (() => { const was = b.lock; b.lock = { name: 'piano' }; const ok = !gal.canInvite() && !gal.askGuy('dance'); b.lock = was; return ok; })()));
  // 6b. keeping time: Guy plays the guitar on his own tempo and GAL plays beside him (each instrument in BAND that keeps a beat).
  // With only the basic book her beat is her own; once she has read an advanced one she locks onto his tempo (Brain.tempoToFollow).
  out.push(result('gal: every instrument that can be jammed has an entry in TIMING_SKILLS (keeping time)', Object.values(BAND).every((x) => Object.keys(TIMING_SKILLS).includes(x.label))));
  const TIMED = { drums: { act: 'drums', basic: ['drums'], adv: 'drums.solo', objs: ['drums'] }, piano: { act: 'sitpiano', basic: ['piano'], adv: 'piano.advanced', objs: ['piano', 'bench'] } };
  for (const [inst, spec] of Object.entries(TIMED)) for (const skilled of [false, true]) {
    galReset(); galBuild(); gb = gal.brain;
    for (const id of [...spec.objs, 'guitar']) T.addObject(id);
    skillsOf().known.clear(); T.learn(['guitar']); gb.skills.known.clear(); for (const k of spec.basic) gb.skills.learn(k); if (skilled) gb.skills.learn(spec.adv);
    T.settle();
    const e6b = errors.length; let n6 = 0, tight = 0, tt = 0;
    try {
      b.queue = []; b.step = null; b.skip(true); gb.queue = []; gb.step = null; gb.skip(true);
      b.choose('riff'); gb.choose(spec.act);
      while (tt < 120) {
        step(0.25); tt += 0.25;
        const k = gb.keptTime, clk = b.bandClock;
        if (k && k.inst === inst && clk && b.time - clk.seen < 0.5 && gb.step && gb.step.fx && (gb.step.fx.guitar || gb.step.fx.song || gb.step.fx.style)) {
          n6++; if (k.ref !== null && Math.abs(k.bl - clk.bl) < 1e-6 && Math.abs(((k.mine - k.ref) % 1 + 1.5) % 1 - 0.5) < 0.05) tight++;
        }
      }
    } finally { gb.queue = []; gb.step = null; }
    out.push(result(skilled
      ? `gal: with an advanced ${inst} book she keeps time with the tempo Guy is playing`
      : `gal: with only the basic ${inst} book her beat is her own (not locked to his)`,
      n6 > 10 && (skilled ? tight / n6 > 0.9 : tight === 0) && errors.length === e6b, { samples: n6, tight }));
  }
  // 6c. Guy has not read the book for chairs but GAL has: the house needs chairs, so he asks her to build one, and she does
  galReset(); galBuild(); gb = gal.brain;
  R().add('workshop', { walls: ['right'] }); for (const id of SHOP) T.addObject(id);
  skillsOf().known.clear(); T.learn(['workshop']); gb.skills.known.clear(); for (const k of ['workshop', 'workshop.materials', 'workshop.furniture']) gb.skills.learn(k);
  T.settle();
  const e6c = errors.length, guyCan = b.canBuild('builtchair'), galCan = gb.canBuild('builtchair'), helper = b.recipeForHelper(gb);
  b.queue = []; b.step = null; b.skip(true); gb.queue = []; gb.step = null; gb.skip(true);
  b.choose('orderbuild');
  let t6c = 0, galBuilt = false;
  while (t6c < 1400) { step(0.25); t6c += 0.25; if (gb.last === 'build') galBuilt = true; if (galBuilt && kindIn(w, 'builtchair', 'main').length >= 1) break; }
  const said6c = gal.log.join(' | ');
  out.push(result('gal: Guy has not read the chair book but GAL has: he cannot build one, tells her to, and she builds a chair and puts it together in the room', !guyCan && galCan && helper === 'builtchair' && /GUY asks GAL: build a Wooden Chair/.test(said6c) && galBuilt && kindIn(w, 'builtchair', 'main').length >= 1 && errors.length === e6c, { guyCan, galCan, helper, said6c, galBuilt, t6c, chairs: kindIn(w, 'builtchair', 'main').length, errs: errors.slice(e6c, e6c + 1) }));
  // 6d. a second guitar: the acoustic one and an electric one, one each, at the same time
  galReset(); galBuild(); gb = gal.brain;
  T.addObject('guitar'); T.addObject('eguitar');
  skillsOf().known.clear(); T.learn(['guitar']); gb.skills.known.clear(); gb.skills.learn('guitar');
  T.settle();
  const e6d = errors.length;
  b.queue = []; b.step = null; b.skip(true); gb.queue = []; gb.step = null; gb.skip(true);
  b.choose('guitar'); gb.choose('guitar');
  let t6d = 0, both = 0, close6d = 0, electric = false; const used = new Set();
  while (t6d < 70) {
    step(0.25); t6d += 0.25;
    if (b.pose === 'guitar' && gb.pose === 'guitar') { both++; used.add(b.gname + '+' + gb.gname); electric = electric || b.electric() || gb.electric(); }
    if (Math.hypot(b.g.pos.x - gb.g.pos.x, b.g.pos.z - gb.g.pos.z) < 0.25) close6d++;
  }
  out.push(result('gal: with an electric guitar as well as the acoustic one, Guy and GAL both play a guitar at the same time, one each, and the electric one sounds electric', both > 20 && used.size === 1 && !used.has('guitar+guitar') && ![...used][0].split('+').every((n, _i, a) => n === a[0]) && electric && close6d <= 6 && errors.length === e6d, { both, used: [...used], electric, close6d, errs: errors.slice(e6d, e6d + 1) }));
  // 7. both help in the restaurant: customers are looked after by whoever gets there, nothing is done twice
  galReset(); galBuild(); gb = gal.brain;
  const wasHead = w.restaurant.headless; w.restaurant.headless = true;
  unlockRoom('restaurant'); R().add('restaurant', { walls: ['front'] });
  for (const id of ['stove', 'kitchencounter', 'register', 'diningtable', 'diningtable2']) T.addObject(id);
  skillsOf().known.clear(); T.learn(['restaurant']); gb.skills.known.clear(); gb.skills.learn('restaurant');
  w.restaurant.paused = true;
  const cs = [w.restaurant.spawn(), w.restaurant.spawn(), w.restaurant.spawn()];
  let t7 = 0; const e7 = errors.length; const workers = new Set();
  while (t7 < 900 && w.restaurant.list.length) { step(0.25); t7 += 0.25; if (['takeorder', 'cook', 'serve', 'takepay'].includes(b.last)) workers.add('guy'); if (['takeorder', 'cook', 'serve', 'takepay'].includes(gb.last)) workers.add('gal'); }
  const paid = cs.reduce((a, c) => a + DISHES[c.dish].price, 0);
  out.push(result('gal: with both of them able to run the restaurant, three customers are served, pay the right amount once, and leave (no errors)', !w.restaurant.list.length && w.stock.coins === paid && errors.length === e7, { t7, coins: w.stock.coins, paid, workers: [...workers], left: w.restaurant.list.map((c) => c.state) }));
  // 7b. both cook at the one stove at the same moment: they stand apart (both used to pick the same spot and stood inside each other)
  {
    const r7 = w.restaurant, cs7 = [r7.stage('ordered'), r7.stage('ordered')];
    b.queue = []; b.step = null; gb.queue = []; gb.step = null;
    // side by side, the same distance from the stove: both plan their walk in the same moment (that is when they both picked the same spot)
    const sv = w.objects.stove, sl1 = sv.local(0.45, 2.2), sl2 = sv.local(-0.45, 2.2);
    G().pos.x = sv.x + sl1.x; G().pos.z = sv.z + sl1.z; gal.g.pos.x = sv.x + sl2.x; gal.g.pos.z = sv.z + sl2.z;
    b.choose('cook'); gb.choose('cook');
    const stirs = (s) => !!(s && s.fx && s.fx.work && s.fx.work.obj === 'stove');
    let both7 = 0, minD7 = 9;
    for (let i = 0; i < 400 && (i < 20 || b.restJob || gb.restJob); i++) {
      step(0.25);
      if (stirs(b.step) && stirs(gb.step)) { both7 += 0.25; minD7 = Math.min(minD7, Math.hypot(G().pos.x - gal.g.pos.x, G().pos.z - gal.g.pos.z)); }
    }
    out.push(result('gal: Guy and GAL both cooking at the stove at the same moment stand apart (not in the same spot)', cs7.every(Boolean) && both7 > 1 && minD7 > 0.45, { both7, minD7 }));
  }
  w.restaurant.headless = wasHead; w.restaurant.paused = false;
  // 8. she is saved and comes back (not under ?fresh: the harness switches saving on for a moment with its own keys)
  galReset(); galBuild(); gb = gal.brain;
  const keep = gal.opts.persist; gal.opts.persist = true;
  gal.save();
  const stored = localStorage.getItem('guy.gal.v1');
  gal.remove();
  const gone = !gal.exists();
  gal.restore();
  out.push(result('gal: she is saved (she exists next visit, without the machine)', /"present":true/.test(stored || '') && gone));
  gal.opts.persist = keep;
  try { localStorage.removeItem('guy.gal.v1'); } catch { /* no storage */ }
  // 9. things taken away while he builds her
  galReset();
  { w.addNew('botprinter', null); b.queue = []; b.step = null; b.choose('buildbot'); runUntil(() => b.pose === 'idle' && b.step && b.step.fx && b.step.fx.needs && b.step.t > 1, 60); w.removeObject('botprinter'); b.objectRemoved('botprinter'); b.skip(); T.settle(); delete w.removed.botprinter; }
  out.push(result('gal: take the machine away while he is using it and nothing is built, nothing is left half done, and he carries on', !gal.exists() && b.carry === null && b.inMain() && errors.length === base));
  } catch (e) { out.push(result('gal: the sweep threw: ' + e.message, false, { stack: String(e.stack).slice(0, 400) })); }
  w.restaurant.paused = false; w.restaurant.headless = false;
  galReset();
  T.removeAll(); T.settle(); machine().hidden = true; dev.all = false;
  out.push(result('gal: no errors', errors.length === base, { errors: errors.slice(base) }));
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
// room's walls, the Catalog, saving, and being cut short.
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
    out.push(result('paintings: he stands in front of the wall to hang it, and the painting fits there (clear of windows, pictures and the Catalog)', dist > 0.4 && dist < 1.1 && allFit(), { dist: +dist.toFixed(2) }));
    out.push(result('paintings: the toast says where he hung it, kindly', one.msgs.length === 1 && /hung a painting in your room/.test(one.msgs[0]) && !BANNED.test(one.msgs[0]), { msgs: one.msgs }));
    out.push(result('paintings: the hung painting is a wall piece the user can drag and remove like any picture (it is in world.decor, removable)', !!d && d.decor === true && d.removable === true));

    // 3. at most three per wall; he spreads them out; when every wall is full the oldest is replaced and goes to the Catalog
    for (let i = 0; i < 9; i++) hangOne();
    const hungN = P.hung().length;
    out.push(result('paintings: never more than 3 of his paintings on one wall', wallsOk() && hungN <= 6, { counts: counts(), hungN }));
    const stored = P.stored(), hung = P.hung();
    out.push(result('paintings: with every wall full he takes the oldest down and hangs the new one; the old ones are in the Catalog (nothing is thrown away)', stored.length > 0 && P.items.length === 10 && stored.every((s) => hung.every((h) => s.t < h.t)), { stored: stored.map((r) => r.id), hung: hung.map((r) => r.id) }));
    out.push(result('paintings: every hung painting still fits its wall (no overlaps, nothing over the Catalog, a window or a door)', allFit()));
    out.push(result('paintings: he spreads them over the walls instead of filling one first', Object.keys(counts()).length >= 2, { counts: counts() }));

    // 4. the Catalog: a thumbnail of each picture, Take down for the hung ones, Hang it for the stored ones
    openObjects('all');
    const head = [...machine().querySelectorAll('h4')].find((h) => /Guy's paintings/.test(h.textContent));
    const cards = head ? (() => { const c = []; for (let n = head.nextElementSibling; n && n.tagName !== 'H4'; n = n.nextElementSibling) if (n.classList.contains('card')) c.push(n); return c; })() : [];
    const thumbs = cards.filter((c) => c.querySelector('img.thumb') && /^data:image\//.test(c.querySelector('img.thumb').getAttribute('src'))).length;
    out.push(result('paintings: the Catalog lists every painting with a thumbnail of the picture', !!head && cards.length === P.items.length && thumbs === P.items.length, { cards: cards.length, items: P.items.length, thumbs }));
    const takeBtn = cards.map((c) => c.querySelector('.act.rm')).find(Boolean);
    const total0 = P.items.length, hung0 = P.hung().length;
    if (takeBtn) takeBtn.click();
    out.push(result('paintings: "Take down" in the Catalog takes a painting off its wall into storage (still listed)', P.hung().length === hung0 - 1 && P.items.length === total0 && allFit(), { hung0, now: P.hung().length }));
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
    out.push(result('paintings: taking a room away puts the paintings on its walls into the Catalog (none lost, none left floating)', inWorkshop > 0 && P.items.length === before && !P.hung().some((r) => r.room === 'workshop') && P.stored().length >= inWorkshop && Object.keys(w.removed).every((k) => !k.startsWith('guypaint_')) && allFit(), { inWorkshop }));
    const target = P.hung()[0];
    if (target) { const nm = P.name(target); w.removeObject(nm); b.objectRemoved(nm); step(1); }
    out.push(result('paintings: a painting the user removes from the wall goes to the Catalog as a stored painting', !!target && !P.get(target.id).room && !w.decor[P.name(target)] && !w.removed[P.name(target)], { id: target && target.id }));

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
    out.push(result('paintings: a saved painting whose room is no longer there is kept in the Catalog', !!P.get(99) && !P.get(99).room && !w.decor[P.name(P.get(99))]));
    const before2 = P.items.length;
    P.load({ v: 7 }); P.load(null); P.load({ v: 1, items: 'x' });
    out.push(result('paintings: a damaged save does nothing', P.items.length === before2));
    const KEYP = 'guy.paintings.v1', was2 = localStorage.getItem(KEYP), persist = P.persist;
    let stored2 = false;
    try { P.persist = true; P.save(); const raw = localStorage.getItem(KEYP); stored2 = !!raw && JSON.parse(raw).items.length === P.items.length; } finally { P.persist = persist; if (was2 === null) localStorage.removeItem(KEYP); else localStorage.setItem(KEYP, was2); }
    out.push(result('paintings: they are written to the browser storage', stored2));

    // 7. cut short while carrying: the painting goes back on the easel; with no easel it goes to the Catalog
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
    out.push(result('paintings: if the easel is taken away while he carries it the painting goes to the Catalog, not lost', !b.carry && !P.carried && P.items.length === 1 && !P.items[0].room, { items: P.items.length }));

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
  report.doorLock = S(T.sweepDoorLock);
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
  report.metal = S(T.sweepMetal);
  report.yardOrders = S(T.sweepYardOrders);
  report.yardVoice = S(T.sweepYardVoice);
  report.mowerShed = S(T.sweepMowerShed);
  report.allRooms = S(T.sweepAllRooms);
  report.needs = S(T.sweepNeeds);
  report.gal = S(T.sweepGal);
  report.workstation = S(T.sweepWorkstation);
  report.paintings = S(T.sweepPaintings);
  report.errorsLogged = errors.length;
  return report;
};
// ---- The Learning Workstation (premium): a panel of the shelf's books, Learn teaches at once, the book stays for the other robot ----
T.sweepWorkstation = () => {
  const out = [], base = errors.length, w = W(), b = B(), ws = window.__workstation;
  const panel = document.getElementById('wstation'), row = (id) => panel.querySelector(`.row[data-book="${id}"]`), btnOf = (id) => row(id) && row(id).querySelector('button');
  const gone = () => { if (w.objects.workstation) { w.removeObject('workstation'); b.objectRemoved('workstation'); if (w.gal && w.gal.brain) w.gal.brain.objectRemoved('workstation'); } delete w.removed.workstation; };
  try {
    galReset(); T.settle(); T.resetRooms(); T.removeAll(); T.forget(); T.home(); T.settle(); gone();
    // 1. premium: listed in the Catalog as locked, no Add button, until the development unlock
    const wasDev = dev.all; dev.all = false; openObjects('all');
    const card0 = [...document.querySelectorAll('#machine .card')].find((c) => /Learning Workstation/.test(c.textContent));
    out.push(result('workstation: listed in the Catalog as a locked premium object (no Add button)', !!card0 && !card0.querySelector('.act') && /Locked/.test(card0.textContent) && !T.addObject('workstation')));
    dev.all = true; w.addNew('workstation', null); dev.all = wasDev;
    const m = w.objects.workstation;
    out.push(result('workstation: with the premium unlock it is added and fits in the room', !!m && w.fits(m, m.x, m.z)));
    if (!m) throw new Error('no workstation');
    // 2. what is on the shelf, and what Guy knows
    T.addObject('telescope'); T.addBook('stars');
    skillsOf().known.clear(); skillsOf().learn('ball');
    const shelfBooks = w.objects.shelf.books.length;
    window.__guyOpenMenu('workstation');
    const mb = [...document.getElementById('menu').querySelectorAll('[data-act="interact"]')].map((x) => x.textContent).join('|');
    document.getElementById('menu').hidden = true;
    out.push(result('workstation: its long-press menu offers "Use Workstation"', /Use Workstation/.test(mb), { mb }));
    // 3. Guy goes to it, taps the screen and the panel opens
    b.queue = []; b.step = null;
    const r = b.interact('workstation');
    const t = runUntil(() => ws.isOpen(), 60);
    const sp = m.screenPoint(), gp = G().root.position;
    out.push(result('workstation: asked to use it, Guy walks up, taps the screen and the panel opens for GUY', r.ok && ws.isOpen() && /GUY/.test(panel.querySelector('.who').textContent) && Math.hypot(sp.x - gp.x, sp.z - gp.z) < 1.6, { msg: r.message, t, d: Math.hypot(sp.x - gp.x, sp.z - gp.z) }));
    const rows = [...panel.querySelectorAll('.row')];
    out.push(result('workstation: every book on the shelf is a row with its title, the skill it teaches and a Learn button', rows.length === shelfBooks && rows.every((x) => x.querySelector('b').textContent.length > 2 && /Teaches:/.test(x.textContent) && x.querySelector('button')), { rows: rows.length, shelfBooks }));
    out.push(result('workstation: a skill he already has shows "Learned" with a disabled button; the others show an enabled Learn', btnOf('ball').disabled && btnOf('ball').textContent === 'Learned' && !btnOf('stars').disabled && btnOf('stars').textContent === 'Learn'));
    // 4. Learn: instant, no reading
    const t0 = performance.now(), had = skillsOf().has('telescope');
    btnOf('stars').click();
    out.push(result('workstation: pressing Learn teaches the skill at once (no reading step) and the row switches to Learned, disabled', !had && skillsOf().has('telescope') && btnOf('stars').disabled && btnOf('stars').textContent === 'Learned', { ms: Math.round(performance.now() - t0) }));
    const rec = w.objects.shelf.books.find((x) => x.def.id === 'stars');
    out.push(result('workstation: the book is not used up: it stays on the shelf', !!rec && w.objects.shelf.books.length === shelfBooks));
    const before = skillsOf().known.size; btnOf('stars').click();
    out.push(result('workstation: a disabled row does nothing', skillsOf().known.size === before));
    // 5. the other robot: the book is still there for her, and she can use the workstation too
    ws.close(); out.push(result('workstation: the panel closes', !ws.isOpen()));
    const gb = galBuild();
    if (!gb.ok) { out.push(result('workstation: GAL could be built for the test', false, gb)); throw new Error('no GAL'); }
    const gal = w.gal, gbr = gal.brain;
    gbr.skills.known.clear();
    out.push(result('workstation: the book Guy learned from is still there for GAL to read (and she does not know it)', !!gbr.shelfBook('stars') && !gbr.skills.has('telescope')));
    gbr.queue = []; gbr.step = null; gbr.pendingActivity = null;
    const r2 = gbr.interact('workstation');
    const t2 = runUntil(() => ws.isOpen(), 80);
    out.push(result('workstation: GAL can use it too: the panel opens for GAL', r2.ok && ws.isOpen() && /GAL/.test(panel.querySelector('.who').textContent), { msg: r2.message, t: t2 }));
    if (btnOf('stars')) btnOf('stars').click();
    out.push(result('workstation: Learn there teaches GAL, and not Guy a second time', gbr.skills.has('telescope') && btnOf('stars') && btnOf('stars').disabled));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    out.push(result('workstation: Escape closes the panel', !ws.isOpen()));
    // 5b. Learn all (the panel): every book on the shelf at once
    skillsOf().known.clear(); gbr.queue = []; gbr.step = null;
    ws.open(b);
    const allBtn = panel.querySelector('.all'), left0 = [...panel.querySelectorAll('.learn:not(:disabled)')].length;
    const t5 = performance.now(); allBtn.click();
    out.push(result('workstation: "Learn all" teaches every book on the shelf at once and every row switches to Learned', left0 === shelfBooks && w.objects.shelf.books.every((x) => skillsOf().has(x.def.teaches)) && [...panel.querySelectorAll('.learn')].every((x) => x.disabled && x.textContent === 'Learned') && allBtn.disabled, { left0, shelfBooks, ms: Math.round(performance.now() - t5) }));
    ws.close();
    // 5c. Guy tells GAL: read one book, or use the workstation for one skill or for everything
    const V5 = window.__voice, L5 = (r) => r.lines.map((l) => `${l.who}: ${l.text}`).join(' | ');
    skillsOf().known.clear(); gbr.skills.known.clear(); b.unlock(false); b.queue = []; b.step = null; b.last = 'wander'; b.pendingActivity = null; gbr.queue = []; gbr.step = null; gbr.pendingActivity = null; gal.audience = null;
    const rr = V5.run('tell GAL to read the stargazing book');
    out.push(result('workstation: "tell GAL to read the stargazing book": Guy hands it over and she is sent to read that very book', rr.ok && rr.lines[0].who === 'guy' && gbr.pendingActivity === 'read' && !!gbr.forceBook && gbr.forceBook.def.id === 'stars', { lines: L5(rr), pending: gbr.pendingActivity, book: gbr.forceBook && gbr.forceBook.def.id }));
    gbr.pendingActivity = null; gbr.forceBook = null; gbr.skip(true); gal.audience = null; gbr.queue = []; gbr.step = null; b.pendingActivity = null;
    const r1 = V5.run('tell GAL to use the workstation to learn stargazing');
    const t6 = runUntil(() => gbr.skills.has('telescope'), 90);
    out.push(result('workstation: "tell GAL to use the workstation to learn stargazing": she walks up, taps the screen and learns just that, with no panel', r1.ok && r1.lines.some((l) => l.who === 'gal') && gbr.skills.has('telescope') && !gbr.skills.has('stereo') && !skillsOf().has('telescope') && !ws.isOpen(), { lines: L5(r1), t: t6, galKnows: [...gbr.skills.known], guyKnows: [...skillsOf().known] }));
    gbr.skip(true); gbr.queue = []; gbr.step = null; gal.audience = null;
    const r2b = V5.run('tell GAL to learn everything');
    const t7 = runUntil(() => w.objects.shelf.books.every((x) => gbr.skills.has(x.def.teaches)), 120);
    out.push(result('workstation: "tell GAL to learn everything": she uses the workstation and knows every book on the shelf, and Guy is unchanged', r2b.ok && w.objects.shelf.books.every((x) => gbr.skills.has(x.def.teaches)) && skillsOf().known.size === 0 && !ws.isOpen(), { lines: L5(r2b), t: t7 }));
    gbr.skip(true); gbr.queue = []; gbr.step = null; gal.audience = null; b.queue = []; b.step = null; b.last = 'wander'; b.pendingActivity = null;
    const r3b = V5.run('learn everything');
    const t8 = runUntil(() => w.objects.shelf.books.every((x) => skillsOf().has(x.def.teaches)), 120);
    out.push(result('workstation: Guy told "learn everything" uses it himself and knows every book on the shelf', r3b.ok && r3b.lines[0].who === 'guy' && w.objects.shelf.books.every((x) => skillsOf().has(x.def.teaches)), { lines: L5(r3b), t: t8 }));
    const r4b = V5.run('learn everything');
    out.push(result('workstation: when there is nothing left to learn he says so', !r4b.ok && /already knows/.test(L5(r4b)), { lines: L5(r4b) }));
    gone(); b.queue = []; b.step = null; skillsOf().known.clear();
    const r5b = V5.run('learn everything');
    out.push(result('workstation: with no workstation in the room the request is refused in words', !r5b.ok && /workstation/.test(L5(r5b)), { lines: L5(r5b) }));
    // 6. a voice request goes through the same door
    const V = window.__voice, it = V.parse('use the workstation');
    out.push(result('workstation: "use the workstation" is understood by the voice commands', it.type === 'object' && it.name === 'workstation', { it }));
  } catch (e) { if (!/no workstation|no GAL/.test(e.message)) out.push(result('workstation: sweep ran without throwing', false, { error: String(e && e.stack || e).slice(0, 400) })); }
  finally { try { ws.close(); } catch { /* none */ } gone(); galReset(); T.resetRooms(); T.home(); T.removeAll(); T.settle(); }
  out.push(result('workstation: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};
// ---- Screen lock: off / camera only / on (needs real time for the hold-to-unlock, so it runs with runAsync) ----
T.sweepScreenLock = async () => {
  const out = [], base = errors.length, SL = window.__screenLock, body = document.body;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const at = (el) => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); };
  const canvas = document.querySelector('canvas'), btn = document.getElementById('lockscreen-btn');
  const key = (k) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k === ' ' ? 'Space' : undefined, cancelable: true, bubbles: true }));
  const follow = document.getElementById('follow-btn'), skills = document.getElementById('skills');
  const was = SL.mode;
  try {
    SL.setMode('off', { quiet: true });
    out.push(result('screenlock: off: the HUD buttons take touches, the canvas takes the canvas, the lock button is there', at(follow) === follow && body.dataset.lock === 'off' && !!btn && btn.title.includes('Off')));
    const f0 = follow.classList.contains('on'); key('f'); const f1 = follow.classList.contains('on'); key('f');
    out.push(result('screenlock: off: the F key still toggles follow', f0 !== f1));
    // on
    document.getElementById('menu').hidden = false; skills.hidden = false;
    SL.setMode('on', { quiet: true });
    out.push(result('screenlock: on: menus and panels close when the screen locks', document.getElementById('menu').hidden && skills.hidden));
    out.push(result('screenlock: on: the HUD buttons, the canvas and the catalog do not take touches, the lock button still does', at(follow) !== follow && at(document.getElementById('skip-btn')) !== document.getElementById('skip-btn') && at(canvas) !== canvas && at(btn) === btn));
    const g0 = follow.classList.contains('on'); key('f'); key('k'); key(' ');
    out.push(result('screenlock: on: keys do nothing (follow, skills panel, next)', follow.classList.contains('on') === g0 && skills.hidden));
    out.push(result('screenlock: on: the camera is frozen', window.__ui.controlsEnabled() === false));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: innerWidth / 2, clientY: innerHeight / 2, button: 0, bubbles: true, pointerId: 31 }));
    out.push(result('screenlock: on: pressing the canvas starts no object press', window.__ui.pending === null));
    // camera only
    SL.setMode('camera', { quiet: true });
    out.push(result('screenlock: camera only: the canvas takes touches (camera), the HUD buttons do not', at(canvas) === canvas && at(follow) !== follow && body.dataset.lock === 'camera'));
    out.push(result('screenlock: camera only: the camera is live, keys still do nothing', window.__ui.controlsEnabled() === true && (key('f'), follow.classList.contains('on') === g0)));
    canvas.setPointerCapture = canvas.releasePointerCapture = () => {};     // a synthetic pointer has no capture to give OrbitControls
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: innerWidth / 2, clientY: innerHeight * 0.8, button: 0, bubbles: true, pointerId: 32 }));
    out.push(result('screenlock: camera only: pressing the canvas still starts no object press (no drag, no menu)', window.__ui.pending === null && document.getElementById('menu').hidden));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 32 })); delete canvas.setPointerCapture; delete canvas.releasePointerCapture;
    // saved
    let saved = null; try { saved = localStorage.getItem('guy.screenlock.v1'); } catch { /* blocked */ }
    out.push(result('screenlock: the mode is saved only when not ?fresh', new URLSearchParams(location.search).has('fresh') ? saved === null : saved === 'camera', { saved }));
    // unlocking: a tap only reminds, a hold unlocks
    SL.setMode('on', { quiet: true });
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 33 })); await wait(300);
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 33 })); btn.click(); await wait(1000);
    out.push(result('screenlock: a short tap on the lock button does not unlock', SL.mode === 'on'));
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 34 })); await wait(1500);
    out.push(result('screenlock: holding the lock button unlocks', SL.mode === 'off' && body.dataset.lock === 'off' && at(follow) === follow && window.__ui.controlsEnabled() === true));
    // the menu from off
    btn.click();
    const pop = document.getElementById('lockscreen-menu'), opened = !pop.hidden;
    pop.querySelector('[data-lock="camera"]').click();
    out.push(result('screenlock: the button opens On / Camera only / Off and choosing one sets it', opened && SL.mode === 'camera' && pop.hidden));
    out.push(result('screenlock: voice can set every mode', ['on', 'off', 'camera', 'off'].every((m) => SL.setMode(m, { quiet: true }) && SL.mode === m) && SL.setMode('bogus') === false));
  } finally {
    SL.setMode(was, { quiet: true }); SL.setMode('off', { quiet: true });
    document.getElementById('menu').hidden = true;
  }
  out.push(result('screenlock: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};
// ---- Voice and typed commands (src/voice.js, src/tts.js): the parser, Guy handing a request to GAL, her audience, the offline voices ----
const VOICE_PHRASES = [
  ['play the piano', 'object', 'piano'], ['Guy, play the guitar please', 'object', 'guitar'], ['can you play the drums', 'object', 'drums'], ['turn on the lamp', 'object', 'lamp'],
  ['it is dark in here', 'object', 'lamp'], ['put some music on', 'object', 'table'], ['play ball', 'object', 'ball'], ['let us paint something', 'object', 'easel'],
  ['look at the stars', 'object', 'telescope'], ['water the plant', 'object', 'plant'], ['keep playing the guitar', 'object', 'guitar'],
  ['stop the music', 'object', 'table'], ['dance', 'act', 'dance'], ['wave', 'act', 'wave'], ['read the astronomy book', 'read', null], ['read', 'read', null],
  ['go into the workshop', 'visit', null], ['come back', 'comeback', null], ['lock the door', 'doorlock', null], ['unlock the workshop door', 'doorlock', null],
  ['lock the screen', 'screen', null], ['unlock the screen', 'screen', null], ['lock the screen camera only', 'screen', null],
  ['tell GAL to play the guitar', 'gal', null], ['ask gal to jam', 'gal', null], ['jam', 'jam', null], ['I am bored', 'next', null], ['something else', 'next', null],
  ['learn everything', 'learn', null], ['use the workstation to learn piano', 'learn', null], ['tell GAL to learn all skills', 'gal', null], ['use the workstation', 'object', 'workstation'],
  ['mow the lawn', 'object', 'mower'], ['Guy, go and mow the grass please', 'object', 'mower'], ['use the shed', 'object', 'mower'], ['sit in the lawn chair', 'object', 'lawnchair'],
  ['shoot some hoops', 'object', 'basketballhoop'], ['play basketball', 'object', 'basketballhoop'], ['take some shots at the goal', 'object', 'soccergoal'], ['kick the soccer ball', 'object', 'soccergoal'],
  ['cook dinner', 'object', 'stove'], ['serve the food', 'object', 'kitchencounter'], ['take payment at the register', 'object', 'register'], ['look after the customers', 'object', 'diningtable'],
  ['look at the bird bath', 'object', 'birdbath'], ['switch to night', 'object', 'skyswitch'], ['look at the night sky', 'object', 'telescope'], ['build something', 'object', 'workbench'], ['tidy the tools', 'object', 'toolbox'],
  ['xyzzy plugh', 'unknown', null], ['what is the capital of France', 'unknown', null], ['', 'empty', null],
];
T.sweepVoice = async () => {
  const out = [], base = errors.length, w = W(), b = B(), V = window.__voice;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const L = (r) => r.lines.map((l) => `${l.who}: ${l.text}`).join(' | ');
  window.__voiceNoAudio = true;                                // the sentences are checked as text and subtitles here; the voices are rendered below
  try {
    galReset(); T.settle(); T.resetRooms(); T.removeAll(); T.forget(); T.home(); T.settle();
    T.learn(['piano', 'guitar', 'stereo']); T.addObject('piano'); T.addObject('guitar'); T.addObject('lamp'); T.addObject('table');
    R().add('workshop', { walls: ['right'] });
    // 1. the parser: a table of sentences
    const bad = [];
    for (const [text, type, name] of VOICE_PHRASES) {
      const it = V.parse(text);
      if (it.type !== type || (name && (it.name || it.act) !== name)) bad.push(`${text} -> ${JSON.stringify(it)}`);
    }
    out.push(result(`voice: the parser understands ${VOICE_PHRASES.length} sentences`, !bad.length, { bad }));
    const a = V.parse('tell GAL to play the drums'), c = V.parse('lock the screen camera only'), d = V.parse('unlock the workshop door');
    out.push(result('voice: "tell GAL to ..." wraps the request; the screen and door requests carry their mode', a.type === 'gal' && a.inner.name === 'drums' && c.mode === 'camera' && V.parse('unlock the screen').mode === 'off' && d.lock === false && d.room === 'workshop'));
    // 2. Guy is free: he answers and does it himself
    b.unlock(false); b.queue = []; b.step = null; b.last = 'wander';
    const r1 = V.run('play the guitar');
    out.push(result('voice: Guy free: he answers and starts the activity himself', r1.ok && r1.lines.length === 1 && r1.lines[0].who === 'guy' && !!b.pendingActivity, { lines: L(r1), pending: b.pendingActivity }));
    const r2 = V.run('xyzzy');
    out.push(result('voice: an unknown sentence gets a polite "say it again" from Guy', !r2.ok && r2.lines.length === 1 && r2.lines[0].who === 'guy', { lines: L(r2) }));
    // 3. no GAL yet: Guy cannot hand anything over
    const r3 = V.run('tell GAL to play the guitar');
    out.push(result('voice: with no GAL he says so (and nothing breaks)', !r3.ok && /GAL/.test(L(r3)), { lines: L(r3) }));
    // 4. GAL arrives
    const gb = galBuild();
    if (!gb.ok) { out.push(result('voice: GAL could be built for the test', false, gb)); throw new Error('no GAL'); }
    const gal = w.gal, gbr = gal.brain;
    b.pendingActivity = null; b.skip(true); T.settle(); T.home();      // (the first command left Guy with the guitar)
    gbr.skills.learn('guitar'); gbr.skills.learn('piano');
    b.unlock(false); b.queue = []; b.step = null; b.last = 'wander'; b.pendingActivity = null; gbr.pendingActivity = null; gal.audience = null;
    // 4a. explicitly: Guy tells GAL
    const r4 = V.run('tell GAL to play the guitar');
    out.push(result('voice: "tell GAL ..." Guy says GAL will do it, GAL answers, she is sent to do it and gets an audience', r4.ok && r4.lines.length === 2 && r4.lines[0].who === 'guy' && r4.lines[1].who === 'gal' && !!gbr.pendingActivity && V.audienceOn(), { lines: L(r4), pending: gbr.pendingActivity }));
    out.push(result('voice: Guy himself did not start anything (GAL has it)', !b.pendingActivity, { pending: b.pendingActivity }));
    // 4b. while she has the audience the user's orders go to her, and she answers
    const r5 = V.run('turn on the lamp');
    out.push(result('voice: while GAL has the audience, the next order goes to her and she answers', r5.lines.length >= 1 && r5.lines.every((l) => l.who === 'gal') && V.audienceOn(), { lines: L(r5) }));
    // 4c. she plays; the audience lasts as long as the activity
    const act = gal.audience && gal.audience.act;
    runUntil(() => gbr.last === gbr.pendingActivity || !!gbr.step, 10);
    out.push(result('voice: she starts (her activity is the one chosen for her)', !!gbr.last, { last: gbr.last, act }));
    // 4d. locked in: she keeps the audience for as long as the lock lasts
    gbr.lock = { name: 'guitar' };
    runUntil(() => false, 20);
    const stillLocked = V.audienceOn();
    gbr.lock = null;
    out.push(result('voice: locked in on an object, she keeps the audience while she keeps performing it', stillLocked));
    // 4e. when she moves on to something else the audience ends and the user talks to Guy again
    gbr.last = 'wander'; gbr.pendingActivity = null; gal.audience.fresh = 0; gal.audience.act = 'guitar';
    out.push(result('voice: the audience ends when her activity is over', V.audienceOn() === false && !gal.audience));
    const r6 = V.run('play the piano');
    out.push(result('voice: after that the user is talking to Guy again', r6.lines[0] && r6.lines[0].who === 'guy', { lines: L(r6) }));
    // 5. Guy busy: he hands it over by himself (first he puts down whatever he picked up on his own while the clock ran)
    b.skip(true); b.queue = []; b.step = null; T.settle(); T.home();
    gbr.skip(true); gbr.pendingActivity = null; b.pendingActivity = null; b.queue = []; b.step = null; b.last = 'wander'; gal.audience = null;
    b.lock = { name: 'ball' };
    const r7 = V.run('play the guitar');
    out.push(result('voice: Guy busy (locked in on the ball): he says GAL will get right on that, and she answers', r7.ok && r7.lines[0].who === 'guy' && /GAL will get right on that/.test(r7.lines[0].text) && r7.lines[1] && r7.lines[1].who === 'gal' && !!gbr.pendingActivity, { lines: L(r7), pending: gbr.pendingActivity }));
    b.lock = null; gal.audience = null; gbr.pendingActivity = null; gbr.skip(true);
    // 6. refusal comes back in words, from the one who was asked
    b.last = 'wander'; b.queue = []; b.step = null;
    const r8 = V.run('read the quantum chromodynamics book');
    out.push(result('voice: asked for something that cannot be done, Guy says why instead of doing nothing', !r8.ok && r8.lines.length >= 1 && r8.lines[0].text.length > 5, { lines: L(r8) }));
    // 7. the screen and the door by voice
    const r9 = V.run('lock the screen');
    const lockedNow = window.__screenLock.mode === 'on';
    V.run('unlock the screen');
    out.push(result('voice: "lock the screen" / "unlock the screen" set the screen lock', r9.ok && lockedNow && window.__screenLock.mode === 'off'));
    V.run('lock the door'); const dl = R().isDoorLocked('workshop'); V.run('unlock the door');
    out.push(result('voice: "lock the door" / "unlock the door" lock the one door', dl && !R().isDoorLocked('workshop')));
    // 8. jamming through voice: Guy asks GAL and she answers out loud, then plays along
    gbr.skip(true); b.skip(true); T.settle(); b.last = 'wander'; b.lock = null;
    const before = V.tts.log.length;
    for (let i = 0; i < 5 && !gal.duo; i++) { V.run('jam'); step(1); }
    const peer = V.tts.log.slice(before).filter((l) => l.kind === 'peer');
    out.push(result('voice: "jam" starts the two of them jamming and each says a line to the other', !!gal.duo && peer.some((l) => l.who === 'guy') && peer.some((l) => l.who === 'gal'), { duo: !!gal.duo, peer: peer.map((l) => `${l.who}: ${l.text}`) }));
    // 9. the quiet default: barks are not spoken
    const n0 = V.tts.log.length; V.tts.say('guy', 'Starting the piano.', 'bark');
    out.push(result('voice: by default they only speak in an interaction (a bark is not spoken)', V.tts.settings.chatter === 'quiet' && V.tts.log.length === n0));
    V.tts.set('chatter', 'chatty'); V.tts.say('guy', 'Starting the piano.', 'bark'); const spoke = V.tts.log.length === n0 + 1; V.tts.set('chatter', 'quiet');
    out.push(result('voice: "chatty" lets them remark on what they are doing', spoke));
    // 10. remarks as they start something (chatty only): every activity has a line or is on the silent list; quiet says nothing; chatty speaks, at most one every 25 s
    const acts = Object.keys(MANIFEST.activities).filter((k) => !MANIFEST.activities[k].alias);
    const noLine = acts.filter((k) => !BARKS[k] && !NO_BARK.includes(k)), stale = Object.keys(BARKS).filter((k) => !acts.includes(k)), both = Object.keys(BARKS).filter((k) => NO_BARK.includes(k));
    out.push(result('voice: every activity has a line to say as it starts, or is on the silent list (a new activity needs one)', !noLine.length && !stale.length && !both.length, { noLine, stale, both }));
    V.tts.stop(); for (let i = 0; i < 40 && V.tts.speaking; i++) await wait(100);            // (a robot does not remark over a line being spoken)
    resetBarks(); V.tts.set('chatter', 'quiet'); const nb = V.tts.log.length;
    b.queue = []; b.step = null; b.choose('stretch');
    out.push(result('voice: quiet (the default): starting an activity says nothing', V.tts.log.length === nb));
    V.tts.set('chatter', 'chatty'); resetBarks(); b.queue = []; b.step = null; b.choose('stretch');
    const first = V.tts.log.slice(nb).filter((l) => l.kind === 'bark');
    b.queue = []; b.step = null; b.choose('wave');
    const second = V.tts.log.slice(nb).filter((l) => l.kind === 'bark');
    out.push(result('voice: chatty: Guy remarks as he starts something, but not twice within 25 s', first.length === 1 && first[0].who === 'guy' && BARKS.stretch.includes(first[0].text) && second.length === 1, { first, second: second.length }));
    V.tts.set('chatter', 'quiet'); V.tts.stop(); resetBarks();
    V.tts.stop();
  } catch (e) { if (e.message !== 'no GAL') out.push(result('voice: sweep ran without throwing', false, { error: String(e && e.stack || e).slice(0, 400) })); }
  finally { window.__voiceNoAudio = false; window.__screenLock.setMode('off', { quiet: true }); b.lock = null; galReset(); T.resetRooms(); T.home(); T.removeAll(); T.settle(); }
  // 10. the offline voices: each robot's line is rendered to real audio, and the two sound different
  try {
    const { render, VOICES } = await import('/src/tts.js');
    const dec = async (who, text) => {
      const bytes = await render(who, text);
      if (!bytes) return null;
      const ac = new OfflineAudioContext(1, 22050, 22050), buf = await ac.decodeAudioData(bytes.slice(0));
      const x = buf.getChannelData(0); let e = 0, z = 0, peak = 0;
      for (let i = 0; i < x.length; i++) { e += x[i] * x[i]; peak = Math.max(peak, Math.abs(x[i])); if (i && (x[i] >= 0) !== (x[i - 1] >= 0)) z++; }
      return { seconds: buf.duration, rms: Math.sqrt(e / x.length), peak, zcr: z / buf.duration };
    };
    const t0 = performance.now();
    const gy = await dec('guy', 'GAL will get right on that.'), gl = await dec('gal', 'GAL will get right on that.');
    const ms = performance.now() - t0;
    out.push(result('voice: the offline voices render real speech (0.5 to 6 s, audible, not clipped) with no network', !!gy && !!gl && [gy, gl].every((x) => x.seconds > 0.5 && x.seconds < 6 && x.rms > 0.02 && x.peak < 1.01), { guy: gy, gal: gl, ms: Math.round(ms) }));
    out.push(result('voice: GAL sounds higher than Guy', !!gy && !!gl && gl.zcr > gy.zcr * 1.1, { guy: gy && gy.zcr, gal: gl && gl.zcr }));
    out.push(result('voice: every robot has a voice, a colour and a subtitle name', ['guy', 'gal'].every((k) => VOICES[k] && VOICES[k].pitch && VOICES[k].color && VOICES[k].name)));
    const subs = document.getElementById('subs'); V.tts.say('gal', 'Subtitle check.'); await wait(100);
    out.push(result('voice: every line shows as a subtitle with the speaker named', !subs.hidden && /GAL/.test(subs.textContent) && /Subtitle check/.test(subs.textContent), { text: subs.textContent }));
    V.tts.stop();
  } catch (e) { out.push(result('voice: offline voices ran without throwing', false, { error: String(e && e.stack || e).slice(0, 400) })); }
  out.push(result('voice: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};
// the sweeps that need real time (models load, pictures are taken): `await T.runAsync()`
installCharacters(T, { result, summarise });
installAudio(T, { result, summarise });
installShots(T, { result, summarise });
T.runAsync = async (which = ['sweepRigs', 'sweepCustomers', 'sweepAudio', 'sweepGuitarSongs', 'sweepScreenLock', 'sweepVoice']) => {
  const report = {};
  for (const k of which) { report[k.replace(/^sweep/, '').toLowerCase()] = summarise(await T[k]()); T.resetRooms(); }
  return report;
};
window.guyTest = T;
