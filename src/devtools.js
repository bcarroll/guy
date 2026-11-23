// QA harness for GUY's room. NOT imported by the game: load it from the browser console / test tooling with
//
//     const T = (await import('/src/devtools.js')).default;      // page opened with ?nostart&fresh&skills=none
//
// It drives the real game objects (window.brain, window.guy, window.scene ...), so what it tests is what you play.
// It is data driven: the object / book / record / track lists come from the game's own catalogs, and
// T.coverage() reports anything the MANIFEST below does not know about yet. When you add an asset or an
// activity, add it to MANIFEST (and to .claude/skills/test-guy-game/assets.md). See that skill for the workflow.
import { OBJECT_CATALOG } from './machine.js';
import { SKILL_USES, SKILL_GROUPS } from './skillrun.js';
import { BOOK_CATALOG, SKILL_INFO, TIMING_SKILLS, CHAPTERS, CHAPTER_IDS, PRACTICE_ACTS, Skills } from './skills.js';
import { allSongs, randomSong, SONG_NEEDS } from './songs.js';
import { makeStrum, PATTERN_NEEDS, PROGRESSIONS } from './strum.js';
import { drumStep, DRUM_STYLES, PAD_SIDE, paintPlan } from './hobbies.js';
import { lampLooks, LAMP_LOOKS } from './brain.js';
import { BAND } from './gal.js';
import { wants } from './needs.js';
import { ROOM_CATALOG } from './rooms.js';
import { ROOM as ROOM_MAIN, WALK } from './room.js';
import { initLayout } from './layout.js';
import { RECIPES as RECIPES_DEF } from './workshop.js';
import { DISHES } from './restobjects.js';
import { dev } from './devunlock.js';
import { invent, judge, GOOD, STEPS as RIFF_STEPS, keepRiff, loadRiffs, nextRiff, riffAt, forgetMemoryRiffs } from './riffs.js';
import { ALBUM_CATALOG } from './albums.js';
import { TRACKS, trackSeconds } from './audio.js';
import { POSES } from './brain.js';
import { bowlSkill } from './bowlbrain.js';
import { strapLine } from './strap.js';
import { throwBall } from './bowlrules.js';
import { createMic, MIC_ERRORS } from './mic.js';
import { LIMITS } from './commands.js';
import { install as installCharacters } from './qa-characters.js';
import { install as installAudio } from './qa-audio.js';
import { install as installShots } from './qa-shots.js';
import { counts as sfxCounts } from './sfx.js';
import { BARKS, NO_BARK, resetBarks } from './barks.js';
import { WHATS_NEW } from './whatsnew.js';
import { TABS as HELP_TABS, ROOM_NOTES, helpHtml } from './help.js';
import { CHANGELOG } from './changelog.js';
const lcg = (seed) => { let a = seed | 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) | 0; return (a >>> 0) / 4294967296; }; };      // (a small seeded generator: for a check that must not depend on the sweep's seed)

// ---------------------------------------------------------------------------------------------------------------
// MANIFEST: what the test knows about each asset. Keep in sync with the game (T.coverage() tells you what is missing).
// ---------------------------------------------------------------------------------------------------------------
export const MANIFEST = {
  // interact: the name passed to brain.interact (what the long-press "Interact" button does)
  objects: {
    piano: { skills: ['piano'] }, bench: { skills: ['piano'] }, table: { skills: ['stereo'] }, shelf: { skills: [], fixed: true },
    lamp: { skills: ['lighting'] }, armchair: { skills: [] }, armchair2: { skills: [] }, chair: { skills: [] }, chair2: { skills: [] }, plant: { skills: [] }, ball: { skills: ['ball'] }, guitar: { skills: ['guitar'] },
    bass: { room: 'studio' }, keyboard: { room: 'studio' }, xylophone: { room: 'studio' }, bongos: { room: 'studio' },
    drums: { skills: ['drums'] }, easel: { skills: ['easel'] }, telescope: { skills: ['telescope'] },
    // the easter eggs (last, so the objects before them are placed as they always were)
    mirrorball: { room: 'workshop', built: true }, trophy: { room: 'workshop', built: true }, lavalamp: { room: 'workshop', built: true }, crystalball: { room: 'workshop', built: true }, rubberduck: { room: 'workshop', built: true }, gnome: { room: 'workshop', built: true }, toyrocket: { room: 'workshop', built: true }, arcade: { room: 'workshop', built: true }, piggybank: { room: 'workshop', built: true }, grandfatherclock: { room: 'workshop', built: true }, bubblemachine: { room: 'workshop', built: true }, snowglobe: { room: 'workshop', built: true }, petrock: { room: 'workshop', built: true },
    // printed by the Build a Bot machine (line 'bot'): they need it standing in the Workshop; the last four are combinations
    fishtank: { room: 'workshop', built: true }, rubberchicken: { room: 'workshop', built: true }, flamingo: { room: 'workshop', built: true }, neonsign: { room: 'workshop', built: true }, aquarium: { room: 'workshop', built: true }, jukebox: { room: 'workshop', built: true }, plasmaglobe: { room: 'workshop', built: true }, robopet: { room: 'workshop', built: true },
    // decor (world.decor): no interaction; tested by sweepDecor (remove / put back through the Catalog, wall limits)
    rug: { decor: true }, picture: { decor: true, wall: 'back' }, window: { decor: true, wall: 'left' }, window2: { decor: true, wall: 'back', startsOut: true },
    art_mountains: { decor: true, wall: 'left', startsOut: true }, art_abstract: { decor: true, wall: 'back', startsOut: true }, art_moon: { decor: true, wall: 'left', startsOut: true },
    sconce: { decor: true, wall: 'back', startsOut: true }, rug2: { decor: true, startsOut: true }, rug3: { decor: true, startsOut: true },
    // decor furniture and plants (real objects): the plants are tended, the tables are only furniture
    flowerplant: { skills: [] }, tree: { skills: [] }, coffeetable: { skills: [] }, nightstand: { skills: [] },
    // the Workshop (a room added from the Rooms tab: T.addObject adds it first) and what GUY builds there (counted in storage, added one at a time)
    workbench: { room: 'workshop', skills: ['workshop'] }, toolbox: { room: 'workshop', skills: ['workshop'] },
    woodfactory: { room: 'workshop', skills: ['workshop.materials'] }, metalfactory: { room: 'workshop', skills: ['workshop.metal'] },
    botprinter: { room: 'workshop', premium: true, skills: [] },       // the Build a Bot machine (premium, a Workshop object that never leaves it; prints GAL, then other things): tested by sweepGal
    workstation: { skills: [] },      // the Learning Workstation (premium): tested by sweepWorkstation
    footstool: { room: 'workshop', built: true }, woodshelves: { room: 'workshop', built: true }, builtchair: { room: 'workshop', built: true }, metalchair: { room: 'workshop', built: true }, bookshelf2: { room: 'workshop', built: true }, eguitar: { room: 'workshop', built: true },
    bowlingpins: { room: 'workshop', built: true, alsoRoom: 'bowling' }, bowlingball: { room: 'workshop', built: true, alsoRoom: 'bowling' }, pinsetter: { room: 'workshop', built: true, alsoRoom: 'bowling' },      // (the Bowling Alley's equipment: it goes in the alley, so that has to be there; the pinsetter is an easter egg)
    // furniture GUY and GAL build for the Bedroom and the Library once those rooms are added (they go into the room, so it has to be there)
    bed: { room: 'workshop', built: true, alsoRoom: 'bedroom' }, wardrobe: { room: 'workshop', built: true, alsoRoom: 'bedroom' }, bedside: { room: 'workshop', built: true, alsoRoom: 'bedroom' },
    libshelf: { room: 'workshop', built: true, alsoRoom: 'library' }, readingchair: { room: 'workshop', built: true, alsoRoom: 'library' },
    libdesk: { room: 'workshop', built: true, alsoRoom: 'library' }, globe: { room: 'workshop', built: true, alsoRoom: 'library' },
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
  rooms: { workshop: {}, restaurant: {}, backyard: {}, range: {}, bowling: {}, studio: {}, library: {}, bedroom: {}, garage: {}, gameroom: {} },
  // activities: objects that must be in the room, skills needed, `music` = needs the stereo already playing,
  // touches = objects GUY's arms may legitimately be inside the bounding box of (hands on keys, pushing, ...)
  activities: {
    wander: {}, lookaround: {}, sway: {}, akimbo: {}, ponder: {}, wave: {},
    // the Shooting Range (rangebrain.js): shots from his lane at the bullseyes and enemies (no objects of its own)
    rangeshoot: { room: 'range', max: 150, touches: ['round controller', 'blaster case'], skills: ['range.pistol'] },
    rangehang: { room: 'range', max: 60, touches: [] },
    bowl: { room: 'bowling', max: 260, touches: ['ball rack', 'scoreboard', 'ball return 1', 'ball return 2', 'ball return 3'] },
    bowlwatch: { room: 'bowling', max: 60, touches: [] },
    // the Studio (studiobrain.js): records off the wall onto the decks, shows on the stage, dance parties on the floor (no objects of its own)
    studiodj: { room: 'studio', max: 120, touches: ['record wall', 'DJ booth'] },
    studioshow: { room: 'studio', max: 160, touches: ['record wall', 'DJ booth'] },
    studioparty: { room: 'studio', max: 160, touches: ['record wall', 'DJ booth'] },
    studiowatch: { room: 'studio', max: 60, touches: [] },
    // the Studio's instruments (instruments.js): he stands at one on the stage and plays it, each hand touching where it sounds
    playbass: { room: 'studio', objects: ['bass'], max: 90, touches: ['bass'] },
    playkeys: { room: 'studio', objects: ['keyboard'], max: 90, touches: ['keyboard'] },
    playxylo: { room: 'studio', objects: ['xylophone'], max: 90, touches: ['xylophone'] },
    playbongos: { room: 'studio', objects: ['bongos'], max: 90, touches: ['bongos'] },
    rangefool: { room: 'range', max: 90, touches: [] },
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
    // the Bedroom and the Library (corner rooms): the furniture they built there (homebrain.js)
    makebed: { objects: ['bed'], room: 'bedroom', max: 120, touches: ['bed'] },
    homesit: { objects: ['bed', 'readingchair'], room: 'bedroom', max: 120, touches: ['bed', 'readingchair'] },
    wardrobe: { objects: ['wardrobe', 'bedside'], room: 'bedroom', max: 120, touches: ['wardrobe', 'bedside'] },
    browse: { objects: ['libshelf'], room: 'library', max: 120, touches: ['libshelf'] },
    study: { objects: ['libdesk'], room: 'library', max: 120, touches: ['libdesk'] },
    spinglobe: { objects: ['globe'], room: 'library', max: 120, touches: ['globe'] },
    // the Library (librarybrain.js): its dust and cobwebs wiped away; the bookshelf carried in from his room (the skill shelf: it is always there)
    libclean: { room: 'library', max: 150, touches: [] },
    moveshelf: { objects: ['shelf'], room: 'library', max: 200, touches: ['shelf'] },
    // a thing built for another room left standing in the Workshop (`strand`: moved there first): carried flat to its own room (workbrain.js)
    carryhome: { objects: ['bed'], room: 'workshop', strand: ['bed'], max: 200, touches: ['bed'] },
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
    mow: { objects: ['shed', 'mower'], room: 'backyard', max: 420, touches: ['shed', 'mower'] },
    yardpoke: { objects: ['soccergoal'], skills: ['outdoor.soccer'], room: 'backyard', touches: ['soccergoal', 'basketballhoop'] },
    goalshot: { objects: ['soccergoal'], skills: ['outdoor.soccer'], room: 'backyard', max: 200, touches: ['soccergoal'] },
    soccertoss: { objects: ['soccergoal'], skills: ['outdoor.soccer'], room: 'backyard', max: 200, touches: ['soccergoal'] },
    hoopshoot: { objects: ['basketballhoop'], skills: ['outdoor.basketball'], room: 'backyard', max: 200, touches: ['basketballhoop'] },
    hoopdribble: { objects: ['basketballhoop'], skills: ['outdoor.basketball'], room: 'backyard', max: 200, touches: ['basketballhoop'] },
    // the other robot joining in: defence against a shooter, goalkeeper (invited by whoever shoots; alone they run a short practice)
    hoopdefend: { objects: ['basketballhoop'], skills: ['outdoor.basketball'], room: 'backyard', max: 200, touches: ['basketballhoop'] },
    goalkeep: { objects: ['soccergoal'], skills: ['outdoor.soccer'], room: 'backyard', max: 200, touches: ['soccergoal'] },
    // internal recovery activities and aliases: exercised through the interruption sweep, not on their own
    books: { alias: true }, putback: { internal: true }, putguitar: { internal: true }, dropball: { internal: true }, lighton: { internal: true }, yardtidy: { internal: true, objects: ['shed', 'lawnchair'], room: 'backyard' },
    hangpaint: { objects: ['easel'], painted: true, max: 220, touches: ['easel'] }, putcanvas: { internal: true },      // hanging a painting (sweepPaintings tests it in depth)
    skillwait: { internal: true }, bringpiece: { internal: true }, musicon: { internal: true },      // a skill chosen in the Skills menu (skillrun.js): tested by sweepSkillMenu
    learn: { internal: true },      // using the Learning Workstation: tested by sweepWorkstation
    arrange: { internal: true },    // ordering things into / out of any room at the Learning Workstation: tested by sweepArrange
    buildbot: { internal: true }, bandjam: { internal: true }, bandplay: { internal: true }, orderbuild: { internal: true },      // GUY and GAL: tested by sweepGal
    visit: { internal: true }, leave: { internal: true }, stuck: { internal: true }, rwait: { internal: true },      // rwait: waiting by the till for customers (tested by sweepRestaurant)
         // through the door of an added room and back: tested by sweepVisit
  },
  // what to do after reading each book: an activity that should now be possible
  books: { stereo: { then: 'dance' }, piano: { then: 'piano' }, ball: { then: 'dribble' }, lighting: { then: 'mood' }, piano2: { then: 'piano' }, guitar: { then: 'guitar' },
    bowling: { then: null },       // (the alley is not added here: sweepBowl tests the bowling and what the book changes)
    pulsepistol: { then: null }, arcrifle: { then: null },      // (the range is not added here: it takes a wall and moves the other rooms; sweepRange tests the blasters)
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
  // chapters learned by practice (skills.js CHAPTERS): where the content each one opens up lives
  chapters: {
    'piano.ch2': { content: 'songs' }, 'piano.ch3': { content: 'songs' }, 'piano.advanced.ch2': { content: 'songs' }, 'piano.advanced.ch3': { content: 'songs' },
    'guitar.ch2': { content: 'strum' }, 'guitar.ch3': { content: 'strum' },
    'drums.band.ch2': { content: 'steps' }, 'drums.band.ch3': { content: 'steps' }, 'drums.solo.ch3': { content: 'drums', styles: ['solo3'] },
    'dance.moves.ch2': { content: 'steps' }, 'dance.moves.ch3': { content: 'steps' }, 'dance.ballroom.ch2': { content: 'steps' }, 'dance.ballroom.ch3': { content: 'steps' },
    'lighting.ch2': { content: 'steps' }, 'lighting.ch3': { content: 'steps' },
    'easel.ch2': { content: 'steps' }, 'easel.ch3': { content: 'steps' }, 'easel.colour.ch2': { content: 'steps' }, 'easel.colour.ch3': { content: 'steps' },
    'easel.portrait.ch2': { content: 'steps' }, 'easel.portrait.ch3': { content: 'steps' }, 'decorate.ch2': { content: 'steps' }, 'decorate.ch3': { content: 'steps' },
    'telescope.ch2': { content: 'steps' }, 'telescope.ch3': { content: 'steps' }, 'telescope.dark.ch2': { content: 'steps' }, 'telescope.dark.ch3': { content: 'steps' },
    'telescope.care.ch2': { content: 'steps' }, 'telescope.care.ch3': { content: 'steps' },
    'ball.ch2': { content: 'steps' }, 'ball.ch3': { content: 'steps' }, 'outdoor.ch2': { content: 'steps' }, 'outdoor.ch3': { content: 'steps' },
    'outdoor.soccer.ch2': { content: 'steps' }, 'outdoor.soccer.ch3': { content: 'steps' }, 'outdoor.basketball.ch2': { content: 'steps' }, 'outdoor.basketball.ch3': { content: 'steps' },
    'workshop.ch2': { content: 'steps' }, 'workshop.ch3': { content: 'steps' }, 'workshop.materials.ch2': { content: 'steps' }, 'workshop.materials.ch3': { content: 'steps' },
    'workshop.materials.ch4': { content: 'steps' }, 'workshop.materials.ch5': { content: 'steps' }, 'bowling.ch2': { content: 'steps' }, 'bowling.ch3': { content: 'steps' },       // (ch4 and ch5 unlock the recipes for the alley's pins and ball, ch2 and ch3 the hook and spares: sweepBowl)
    'workshop.furniture.ch2': { content: 'steps' }, 'workshop.furniture.ch3': { content: 'steps' }, 'workshop.metal.ch2': { content: 'steps' }, 'workshop.metal.ch3': { content: 'steps' },
    'drums.ch2': { content: 'drums', styles: ['reggae', 'funk'] }, 'drums.ch3': { content: 'drums', styles: ['paradiddle'] }, 'drums.ch4': { content: 'drums', styles: ['halftime', 'bossa'] }, 'drums.solo.ch2': { content: 'drums', styles: ['solo2'] },
  },
  tracks: ['default', ...ALBUM_CATALOG.flatMap((a) => a.tracks)],     // every track on every record; coverage fails for a track no record lists
  // the visual checkpoints: freeze GUY at (activity, pose, t) and look from `view`. See assets.md for the full checklist.
  visual: [
    // the Bedroom and the Library (homebrain.js)
    { id: 'makebed-smooth', activity: 'makebed', pose: 'reach', t: 2.4, view: 'front', expect: 'standing at the side of the bed, one hand flat on the blanket smoothing it, the other arm down, the blanket flat and the pillows plump' },
    { id: 'homesit-bed', activity: 'homesit', pose: 'sitRest', t: 6, view: 'side', expect: 'seated on the foot of the bed, thighs on the mattress, shins over the edge, feet on the floor, hands on his knees' },
    { id: 'wardrobe-reach', activity: 'wardrobe', pose: 'reach', t: 2.0, view: 'front', expect: 'both wardrobe doors swung open, one hand reaching in among the hanging clothes (or the bedside drawer pulled out with his hand in it)' },
    { id: 'browse-shelf', activity: 'browse', pose: 'reach', t: 1.8, view: 'front', expect: 'standing at the library shelf, one hand touching the spines of the books on a shelf, no hand through the shelf' },
    { id: 'study-page', on: 'libdesk', activity: 'study', pose: 'reach', t: 1.4, view: 'front', expect: 'standing at the reading desk, the green banker lamp lit, fingertips on the open book turning a page over; no hand through the desk' },
    { id: 'spinglobe-hand', on: 'globe', activity: 'spinglobe', pose: 'reach', t: 0.7, view: 'front', expect: 'standing at the globe, the flat of his hand on the front of the globe, sweeping it round; the globe on its tripod, tilted in its brass ring' },
    { id: 'libclean-floor', inRoom: 'library', dist: 3.4, activity: 'libclean', pose: 'reach', t: 2.0, view: 'side', expect: 'squatting with both feet flat on the floor, leaning out over his knees, one hand down at a grey patch of dust on the Library floor (not floating, not kneeling through the floor)' },
    { id: 'carryhome-setup', inRoom: 'bedroom', activity: 'carryhome', pose: 'reach', t: 2.2, view: 'side', expect: 'crouched in the Bedroom beside the bed he carried out of the Workshop as it grows back into place, head to the far wall; the flat pack gone from his hands' },
    { id: 'moveshelf-setup', inRoom: 'library', activity: 'moveshelf', pose: 'reach', t: 2.2, view: 'side', expect: 'crouched beside a side wall of the Library where the bookshelf he carried in is growing back into place, its books on it; the flat pack gone from his hands' },
    { id: 'read-grab-mid', activity: 'read', pose: 'grab', t: 1.2, view: 'hand:Right', expect: 'palm on the book spine, fingers pointing in and a little up (never the back of the hand towards the book), arm in front of him' },
    { id: 'read-stand-shelf', activity: 'read', pose: 'readStand', t: 8, view: 'side', skills: ['speedreading'], expect: 'speed reading standing a step back from the bookshelf: the open book floats in front of his chest, clear of the shelf, both hands on its lower edges' },
    { id: 'read-sit', activity: 'read', pose: 'readSit', t: 8, view: 'front', expect: 'book open with pages facing GUY, both hands on the lower edges, seated in the chair with legs clear of it' },
    { id: 'read-turn', activity: 'read', pose: 'readSit', t: 0, view: 'front', turning: true, expect: 'right hand on the reader side of the page while a page flips' },
    { id: 'guitar-play', activity: 'guitar', pose: 'guitar', t: 7, view: 'front', expect: 'guitar rests on his belly on a strap; right fingers hang over the strings; left hand behind the neck, thumb on its back, fingers curled over the top edge of the neck with the tips on the strings (not through the neck); nothing passes through the body' },
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
    { id: 'wave-hand', activity: 'wave', pose: 'wave', t: 1.5, view: 'front', expect: 'right hand up beside his head, palm out, fingers up, wrist straight, elbow down and out' },
    { id: 'lookaround-left', activity: 'lookaround', pose: 'lookaround', t: 1.3, view: 'front', expect: 'standing, head turned well to one side, arms hanging, body turned a little with it' },
    { id: 'sway-lean', activity: 'sway', pose: 'sway', t: 1.0, view: 'front', expect: 'weight shifted to one side, hips and shoulders tilted gently opposite, arms hanging, feet flat' },
    { id: 'akimbo-hands', activity: 'akimbo', pose: 'akimbo', t: 2.5, view: 'front', expect: 'both hands on his hips, fingers pointing down and forward, elbows out, no hand inside the body' },
    { id: 'ponder-chin', activity: 'ponder', pose: 'ponder', t: 2.5, view: 'front', expect: 'right hand at his chin, left forearm across his middle, head tilted, no hand through the face' },
    { id: 'easel-mix', activity: 'mixpaint', pose: 'paintStand', t: 6, view: 'front', expect: 'brush circling on the palette held in the left hand' },
    { id: 'scope-peer', activity: 'stargaze', pose: 'scopePeer', t: 6, view: 'side', expect: 'eye at the eyepiece (rear end), knees bent, left hand on the focus knob, right hand on the barrel' },
    { id: 'dance-sprinkler', activity: 'dancemoves', pose: 'sprinkler', t: 2.0, view: 'front', skills: ['dance.moves', 'dance.moves.ch2'], expect: 'right arm held out level at the side, left hand raised bent at the head, knees soft, no hand through the head' },
    { id: 'dance-moonwalk', activity: 'dancemoves', pose: 'moonwalk', t: 2.0, view: 'side', skills: ['dance.moves', 'dance.moves.ch2'], expect: 'one foot flat and the other heel lifted, upper body upright, arms bent a little and swinging, no hand in front of or through the face' },
    { id: 'dance-headbang', activity: 'dancemoves', pose: 'headbang', t: 1.0, view: 'side', skills: ['dance.moves', 'dance.moves.ch3'], expect: 'head nodding forward, knees bent in a wide stance, both fists pumping in front of the face or chest, none through the head' },
    { id: 'dance-armwave', activity: 'dancemoves', pose: 'armwave', t: 2.0, view: 'front', skills: ['dance.moves', 'dance.moves.ch3'], expect: 'both arms out sideways with the wave running along them, shoulders level, knees soft' },
    { id: 'dance-tango', activity: 'ballroom', pose: 'tango', t: 3.0, view: 'front', skills: ['dance.ballroom', 'dance.ballroom.ch2'], expect: 'arms held out in a ballroom hold, head turned to one side, knees slightly bent' },
    { id: 'dance-foxtrot', activity: 'ballroom', pose: 'foxtrot', t: 3.0, view: 'front', skills: ['dance.ballroom', 'dance.ballroom.ch2'], expect: 'arms held out in a ballroom hold, upright, a slow gliding step' },
    { id: 'dance-jive', activity: 'ballroom', pose: 'jive', t: 1.9, view: 'front', skills: ['dance.ballroom', 'dance.ballroom.ch3'], expect: 'arms bent and swinging, one knee kicked up, hips turned, bouncing' },
    { id: 'dance-dip', activity: 'ballroom', pose: 'dip', t: 5.0, view: 'side', skills: ['dance.ballroom', 'dance.ballroom.ch3'], expect: 'a deep lunge with the weight on one bent knee, back leaning, arm round the partner, head tilted' },
    { id: 'yard-warmup', activity: 'goalshot', pose: 'warmup', t: 2.5, view: 'front', yard: true, skills: ['outdoor', 'outdoor.ch2'], expect: 'arms out to the sides, circling, knees soft, body twisting a little, no hand through the body' },
    { id: 'yard-cooldown', activity: 'goalshot', pose: 'cooldown', t: 2.5, view: 'side', yard: true, skills: ['outdoor', 'outdoor.ch3'], expect: 'folded forward from the waist, arms hanging down in front, head down, knees a little bent' },
    { id: 'scope-aim', activity: 'stargaze', pose: 'scopeAim', t: 2.2, view: 'top', expect: 'one hand on top of the barrel while the tube swings round' },
    { id: 'scope-wrong', activity: 'peek', pose: 'scopeWrong', t: 2.8, view: 'side', expect: 'eye at the big lens end, hand on the barrel, other hand on his knee' },
    { id: 'yard-shoot', activity: 'hoopshoot', pose: 'shoot', t: 0.9, view: 'side', expect: 'knees dipped then extended, both hands up at the release with the basketball just leaving them, facing the hoop' },
    { id: 'yard-defend', activity: 'hoopdefend', pose: 'defend', t: 1.2, view: 'front', yard: true, expect: 'knees bent, both arms spread wide and up with open hands, weight on the balls of the feet, facing the camera (the shooter)' },
    { id: 'yard-block', activity: 'hoopdefend', pose: 'block', t: 0.5, view: 'front', yard: true, dist: 4, expect: 'off the floor, both arms straight up, legs tucked a little, no limb inside the body' },
    { id: 'yard-keeper', activity: 'goalkeep', pose: 'keeper', t: 1.2, view: 'front', yard: true, dist: 4, expect: 'wide low crouch, arms out low with open hands, knees apart, leaning forward' },
    { id: 'yard-dive', activity: 'goalkeep', pose: 'dive', t: 0.5, view: 'front', yard: true, dist: 4, expect: 'lunging sideways at full stretch, both arms reaching the same way, body tilted, the near hand at the end of the reach' },
    { id: 'yard-sit', activity: 'yardsit', pose: 'sitRest', t: 6, view: 'side', expect: 'seated in the lawn chair, back against it, legs clear of the frame' },
    { id: 'yard-shed-open', activity: 'yardtidy', pose: 'reach', t: 1.3, view: 'side', yard: true, expect: 'standing at the shed door, one hand on the knob, the door swung wide open showing the dark inside; the lawn chair still out on the grass' },
    { id: 'yard-mow', activity: 'mow', pose: 'walk', t: 1, view: 'side', push: true, expect: 'both hands on the mower handle, walking behind it, stripes cut in the grass' },
    { id: 'range-aim', activity: 'rangeshoot', pose: 'aim', t: 0.45, view: 'side', room: 'range', range: 'shoot', expect: 'standing on the firing line facing down the range, right arm straight out with the blaster in the hand (glowing tip), left hand under the grip, a holographic bullseye ahead' },
    { id: 'range-fire', activity: 'rangeshoot', pose: 'aim', t: 0.25, view: 'side', room: 'range', range: 'fired', expect: 'the arm out and the blaster level, the bright tracer starting at the glowing tip of the blaster (not at his chest) and running down the range, a flash at the tip' },
    { id: 'range-carry', activity: 'rangeshoot', pose: 'walk', t: 0.8, view: 'front', room: 'range', range: 'carry', expect: 'walking with the blaster carried low: right hand by his hip, fingers round the grip, barrel pointing forward and down (not out at the target), left arm swinging free' },
    { id: 'range-press', activity: 'rangeshoot', pose: 'aim', t: 0.5, view: 'side', room: 'range', range: 'press', expect: 'facing the side wall, one arm out and the hand on the green START ROUND button of the round controller (the other arm hanging), not through the panel' },
    { id: 'range-take', activity: 'rangeshoot', pose: 'aim', t: 0.5, view: 'back', room: 'range', range: 'take', expect: 'seen from behind, facing the glass blaster case on the side wall, one arm out reaching for the blaster on the shelf, the other arm hanging, standing clear of the case' },
    { id: 'bowl-backswing', activity: 'bowl', pose: 'bowl', t: 0.5, view: 'side', room: 'bowling', expect: 'standing upright on the approach, the red bowling ball (three finger holes) held in the right hand swung back behind him, the left arm out for balance' },
    { id: 'bowl-release', activity: 'bowl', pose: 'bowl', t: 1.25, view: 'side', room: 'bowling', expect: 'a deep lunge towards the pins: left leg forward and bent, right leg trailing, the back leaning, the arm swung down and forward to knee height with the hand open as the ball leaves it' },
    { id: 'bowl-follow', activity: 'bowl', pose: 'bowl', t: 1.55, view: 'side', room: 'bowling', expect: 'the follow-through: the arm up and forward, legs still in the lunge, the ball rolling away down the lane' },
    { id: 'studio-sing', activity: 'studioshow', pose: 'sing', t: 1.0, view: 'front', room: 'studio', expect: 'standing at a microphone on the stage, one hand up at the microphone, the other arm out, swaying a little' },
    { id: 'studio-dj', activity: 'studiodj', pose: 'studiodj', t: 0.8, view: 'side', room: 'studio', expect: 'standing behind the DJ booth with the right hand on the turntable platter and the left hand on the mixer' },
    { id: 'studio-bow', activity: 'studioshow', pose: 'bow', t: 0.9, view: 'side', room: 'studio', expect: 'bowing from the hips with both arms hanging, the head down' },
    { id: 'studio-bass', activity: 'playbass', pose: 'guitar', t: 5, view: 'front', room: 'studio', objects: ['bass'], expect: 'wearing the electric bass (off its empty stand, which is behind him with the amp), strap over the left shoulder, the strings facing the camera, the neck out to his left and up; the left hand round the neck, the right hand over the pickups' },
    { id: 'studio-bass-side', activity: 'playbass', pose: 'guitar', t: 5, view: 'side', room: 'studio', objects: ['bass'], expect: 'the same from the side: the bass in front of his body with its back to him, not through him; the empty stand and the amp behind him' },
    { id: 'studio-bass-take', activity: 'playbass', pose: 'takeGuitar', t: 0.95, view: 'side', room: 'studio', objects: ['bass'], expect: 'leaning in to the bass on its stand, the right hand closed round its neck (fingers behind it, thumb over the strings) to lift it off; no strap yet' },
    { id: 'guitar-take', activity: 'guitar', pose: 'takeGuitar', t: 0.95, view: 'side', expect: 'leaning in to the guitar on its stand, the right hand closed round its neck to lift it off; no strap yet' },
    { id: 'studio-keys', activity: 'playkeys', pose: 'studioplay', t: 5, view: 'front', room: 'studio', objects: ['keyboard'], expect: 'standing behind the keyboard with both hands on the keys, leaning in a little' },
    { id: 'studio-xylo', activity: 'playxylo', pose: 'studioplay', t: 5, view: 'front', room: 'studio', objects: ['xylophone'], expect: 'standing at the xylophone, a hand on a bar, the other lifted between hits' },
    { id: 'studio-bongos', activity: 'playbongos', pose: 'studioplay', t: 5, view: 'front', room: 'studio', objects: ['bongos'], expect: 'standing at the bongos, hands slapping the skins' },
    { id: 'bowl-reach', activity: 'bowl', pose: 'bowlreach', t: 0.5, view: 'side', room: 'bowling', expect: 'one hand out and down to the ball rack (taking a house ball), bending at the knees for it, the other arm hanging, standing clear of the rack' },
    { id: 'scope-care', activity: 'scopecare', pose: 'scopeCare', t: 13, view: 'front', expect: 'squatting beside the tripod with a hand on one leg' },
    { id: 'stool-dust', activity: 'dusttop', pose: 'reach', t: 4, view: 'front', dist: 3.6, expect: 'standing ON the foot stool (feet on top of it, not in the floor), right hand wiping along the top of the window frame, the stool not passing through him' },
    { id: 'dust-frame', activity: 'dust', pose: 'reach', t: 2.5, view: 'front', expect: 'facing the wall, right hand wiping along the lower edge of a frame (not inside the wall or his own head)' },
    { id: 'dance-twist', activity: 'dancemoves', pose: 'twist', t: 4, view: 'front', expect: 'hips and shoulders twisting opposite ways, knees bent and apart, elbows bent, feet flat' },
    { id: 'dance-shuffle', activity: 'dancemoves', pose: 'shuffle', t: 4, view: 'front', expect: 'one foot slides forward at a time, elbows bent and pumping alternately' },
    { id: 'dance-airguitar', activity: 'dancemoves', pose: 'airguitar', t: 2, view: 'front', objects: ['eguitar'], expect: 'secret move: left hand up an invisible neck, right arm strumming across the body, head nodding, wide knees-bent stance, no hand through the face' },
    { id: 'dance-windmill', activity: 'dancemoves', pose: 'windmill', t: 1, view: 'front', objects: ['eguitar'], expect: 'secret move: one arm sweeping a big circle, the other out to the side, knees bent and apart' },
    { id: 'dance-kneeslide', activity: 'dancemoves', pose: 'kneeslide', t: 2, view: 'side', objects: ['eguitar'], expect: 'secret move: dropped low on one deep-bent knee, back leaning right back, head up, arms playing, nothing through the floor' },
    { id: 'dance-twirl', activity: 'dancemoves', pose: 'twirl', t: 2.5, view: 'front', expect: 'arms out to the sides, spinning on the spot without drifting or hitting furniture' },
    { id: 'dance-waltz', activity: 'ballroom', pose: 'waltz', t: 5, view: 'front', expect: 'dance hold: left arm out and bent, right arm curved as if round a partner, slowly turning' },
    { id: 'dance-swing', activity: 'ballroom', pose: 'swing', t: 4, view: 'front', expect: 'arms swinging wide in opposition, alternate knee kicks on the beat' },
    { id: 'sit-rest', activity: 'sit', pose: 'sitRest', t: 5, view: 'side', expect: 'sitting on the seat (not hovering), thighs level, hands resting on the knees, head turning slowly' },
    { id: 'sit-guitar', activity: 'sitguitar', pose: 'sitGuitar', t: 6, view: 'front', expect: 'seated, the guitar held on the lap and chest, left thumb behind the neck and fingertips curled over it onto the strings, right hand strumming; the chair does not pass through the guitar' },
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
    chapters: CHAPTER_IDS.filter((x) => !(x in MANIFEST.chapters)),
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

// Put GUY in the middle of the room facing +z (tests start from the same place; this is a test-only teleport).
T.home = () => { G().root.position.set(0, 0, 2); G().root.rotation.y = 0; };

// Wrap up whatever GUY is doing: stand up, put everything away, stop his own music, then wander.
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
    if (o.kind) W().storeInstance(name); else W().removeObject(name);      // something GUY built goes back into storage
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
  if (def.built && !((W().stock.items[id] || 0) > 0)) W().stock.items[id] = 1;      // something GUY built: make sure there is one in storage to add
  if (def.needsSkill && !skillsOf().has(def.needsSkill)) skillsOf().learn(def.needsSkill);        // listed only once GUY (or GAL) has the book's skill
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
// Leave a built thing of `kind` standing in the Workshop (as when he is cut short carrying it to its room): returns its name, or null.
T.strand = (kind) => {
  const w = W(), o = Object.values(w.objects).find((x) => x.kind === kind);
  if (!o || !w.doors.workshop) return null;
  const { n } = w.shellSize('workshop'), c = w.shellPoint('workshop', n * 0.5, 0), at = w.findSpot(o, { x: c.x, z: c.z }, null);
  if (!at) return null;
  o.home = { x: at.x, z: at.z }; o.set(at.x, at.z);
  return o.name;
};
T.forget = () => skillsOf().known.clear();

// make sure an activity can run: objects present, skills learnt, music playing if it needs to
T.prep = (name) => {
  const m = MANIFEST.activities[name] || {};
  const done = [];
  if (m.room && !R().isAdded(m.room)) {
    unlockRoom(m.room);
    // the rooms share the three walls of GUY's room: when there is no wall left for this one, the other added rooms make way (as a player would)
    if (!R().add(m.room).ok) { for (const r of ROOM_CATALOG) if (r.id !== m.room && R().isAdded(r.id)) R().reset(r.id); R().add(m.room); }
  }
  if (m.room === 'backyard' && W().yard) W().yard.snapNight(false);                                          // always the same daylight for the pictures                           // the room the activity happens in
  for (const id of m.objects || []) if (T.addObject(id)) done.push(id);
  T.learn(m.skills || []);
  for (const k of m.strand || []) T.strand(k);
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
    if (built && built.kind && allowed.has(built.kind)) continue;                 // a thing GUY built is allowed where its kind is (a built chair where chairs are)
    // thin things (lamp pole, guitar stand) fill little of their bounding box: only count the middle column
    const sparse = SPARSE.includes(o.name), cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
    for (const p of pts) {
      const m = 0.05;                                                   // (a point less than 5 cm inside the box is touching it, not clipping through it: the arm itself is 4 cm thick)
      if (!(p.x > o.x0 + m && p.x < o.x1 - m && p.z > o.z0 + m && p.z < o.z1 - m && p.y < o.h && p.y > 0.02)) continue;
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
// Runs `name` to completion. pass = finished, no exceptions, GUY's arms never inside objects they should not touch,
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
  for (const k of (MANIFEST.activities[name] || {}).skills || []) skillsOf().known.delete(k);   // a skill taught only for this activity (the blaster at the range) is unlearned again, so later sweeps see what they saw before
  const s = T.settle();
  rep.idleAfter = s.ok;
  rep.warnings = grazes(rep.overlaps);
  if (Object.keys(serious(rep.overlaps)).length) rep.where = T.lastOverlap;      // where the last overlap was (for chasing intermittent failures)
  rep.pass = rep.completed && !rep.errors.length && !Object.keys(serious(rep.overlaps)).length && rep.idleAfter && rep.minFeet > -0.05;
  return rep;
};

// Ask GUY to interact with an object exactly like the long-press menu does, and follow it through.
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
    if (m.built) {                               // something GUY builds: one is added from storage, as a real object of its own
      const added = T.addObject(def.id);
      const o = Object.values(W().objects).find((x) => x.kind === def.id);
      out.push(result(def.id, added && !!o && W().fits(o, o.x, o.z) && o.name.startsWith(def.id + '_') && (W().stock.items[def.id] || 0) === 0, { added, built: true, name: o && o.name }));
      continue;
    }
    if (def.room === 'studio' && !W().rooms.isAdded('studio')) T.resetRooms();      // (the Studio takes a whole wall of the room: free the walls the rooms before it used)
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
  // the easter eggs have no activity of their own: put them away again, so the sweeps after this one run in the same room as without them
  for (const [n, o] of Object.entries(W().objects)) if (o.kind && RECIPES_DEF[o.kind] && RECIPES_DEF[o.kind].egg) { W().storeInstance(n); B().objectRemoved(n); }
  for (const r of Object.values(RECIPES_DEF)) if (r.egg) delete W().stock.items[r.object];
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
      const st = (stats[pose] ||= { behind: -9, wrist: 0, err: 0, neck: 0, grip: -9, n: 0, errs: [], necks: [], thumbs: [], tips: [] });
      const hand = g.root.worldToLocal(g.boneWorld(`${side}Hand`));
      st.behind = Math.max(st.behind, -hand.z);
      // wrist bend: angle between the forearm (elbow -> wrist) and the hand (wrist -> knuckle), degrees; 0 = straight
      const fa = g.boneWorld(`${side}ForeArm`), wr = g.boneWorld(`${side}Hand`), kn = g.boneWorld(`${side}HandMiddle1`);
      st.wrist = Math.max(st.wrist, Math.acos(Math.max(-1, Math.min(1, wr.clone().sub(fa).normalize().dot(kn.clone().sub(wr).normalize())))) * 57.3);
      st.n++;
      if (side === 'Left' && (pose === 'guitar' || pose === 'sitGuitar') && ctx.guitar && ctx.guitar.cur) {      // fretting hand on the neck?
        const F = ctx.guitar.cur, a0 = b.gp(F, 0.2, 0, 0), ab = b.gp(F, 0.8, 0, 0).sub(a0), p = g.boneWorld('LeftHandMiddle2');
        const u = Math.max(0, Math.min(1, p.clone().sub(a0).dot(ab) / ab.lengthSq()));
        st.necks.push(a0.clone().addScaledVector(ab, u).distanceTo(p));
        // ...and the right way round: the thumb behind the neck (towards him), the fingertips over the neck's edge on the strings side
        // (in the guitar's own frame the soundboard is +z; the hand once wrapped the other way and its fingers went through the neck)
        const Fi = F.q.clone().invert(), loc = (n) => g.boneWorld(n).sub(F.pos).applyQuaternion(Fi).z;
        st.thumbs.push(loc('LeftHandThumb3'));
        st.tips.push((loc('LeftHandIndex3') + loc('LeftHandMiddle3') + loc('LeftHandRing3') + loc('LeftHandPinky3')) / 4);
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
    if (s.tips.length) {                              // the thumb's usual place (90th percentile) minus the fingertips' (10th): negative when the thumb is behind and the fingers in front
      s.thumbs.sort((a, c) => a - c); s.tips.sort((a, c) => a - c);
      s.grip = s.thumbs[Math.floor(s.thumbs.length * 0.9)] - s.tips[Math.floor(s.tips.length * 0.1)];
    }
    delete s.thumbs; delete s.tips;
    for (const k of ['behind', 'wrist', 'err', 'neck', 'grip']) s[k] = +s[k].toFixed(k === 'wrist' ? 0 : 3);
  }
  return stats;
};

// Limits for the pose-sanity sweep. `behind`: m behind his body (a hand reaching a world point behind him once measured 0.53;
// walking and waltzing peak at ~0.35). `wrist`: degrees of wrist bend (a real wrist manages ~90). `err`: m between the hand and the
// wrist position the game asked for (90th percentile; drum, brush and guitar poses expose one). `neck`: m between the fretting
// hand's middle finger joint and the guitar neck (90th percentile; the hand must be on the neck). `grip`: m (guitar's z axis)
// from the fingertips (10th percentile) to the thumb (90th): at most -0.02, the thumb behind the neck and the fingers over it.
export const POSE_LIMITS = { behind: 0.45, wrist: 110, err: 0.32, neck: 0.055, grip: -0.02 };
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
  out.push(T.kickContact());
  return out;
};

// The kick must really meet the ball: with the ball beside him, at the moment it is launched the toe is inside the ball.
T.kickContact = () => {
  const br = window.brain, g = br.g, b = br.w.ball, V = b.position.constructor, miss = [];
  const r = (b.geometry && b.geometry.parameters && b.geometry.parameters.radius) || 0.18;
  const sx = g.root.position.x, sz = g.root.position.z, sy = g.root.rotation.y;
  // open floor, well clear of every piece of furniture (the margin rule would nudge him about near one)
  let spot = { x: 0, z: 0 }, best = -1;
  for (let x = -2; x <= 2; x += 0.5) for (let z = -1.5; z <= 2.5; z += 0.5) {
    let m = 9;
    for (const o of br.w.obstacles) { if (o.active === false) continue; m = Math.min(m, Math.hypot(Math.max(o.x0 - x, 0, x - o.x1), Math.max(o.z0 - z, 0, z - o.z1))); }
    if (m > best) { best = m; spot = { x, z }; }
  }
  for (const [lat, ahead] of [[0, 0.5], [0.15, 0.5], [-0.15, 0.5], [0.25, 0.45]]) {
    br.queue.length = 0; br.step = null;
    g.root.rotation.y = 0;
    g.root.position.set(spot.x, 0, spot.z);
    b.position.set(spot.x + lat, 0.12, spot.z + ahead); b.userData.vel.set(0, 0, 0);
    let d = null;
    br.queue.push(br.play('kick', 1.2, { at: [0.5, () => { d = g.boneWorld('RightToeBase').distanceTo(b.position); br.kickBall(new V(0, 0, 1), true); }] }));
    window.sim(2);
    if (d === null || d > r) miss.push({ lat, ahead, d });
  }
  br.queue.length = 0; br.step = null; g.root.position.set(sx, 0, sz); g.root.rotation.y = sy;
  return result('kick: the toe meets the ball when it is launched (ball beside him)', !miss.length, { miss });
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
    if (def.room && !def.requires && !W().rooms.isAdded(def.room)) { unlockRoom(def.room); W().rooms.add(def.room); }       // (a book of a room with no equipment: the Bowling Alley)
    if (def.requires && def.requires.object) T.addObject(def.requires.object);
    if (def.requires && def.requires.anyObject) T.addObject(def.requires.anyObject[0]);
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
    // "What GUY learned": a learned skill is clickable and sends him to its object; a skill with no object stays plain
  {
    const b = B(); skillsOf().learn('guitar');
    const panel = document.getElementById('skills'), row = (id) => panel.querySelector(`.skill[data-skill="${id}"]`);
    const r = row('guitar'), plain = row('decorate');
    b.skip(); T.settle();
    const was = b.pendingActivity;
    if (r) r.click();
    out.push(result('skills panel: a learned skill is clickable (Guitar) and the click orders GUY to use that object', !!r && r.classList.contains('do') && !!b.pendingActivity && b.pendingActivity !== was, { has: !!r, cls: r && r.className, pending: b.pendingActivity, toast: document.getElementById('toast').textContent, music: b.music }));
    out.push(result('skills panel: every learned skill is clickable, also one with no object of its own (Decorating)', !plain || plain.classList.contains('do')));
    // only learned skills are listed, each as one button: what he will do, and how it would go from here (no book, unlocks or chapters)
    const rows = [...panel.querySelectorAll('.skill')];
    out.push(result('skills panel: only learned skills are listed, each as one button with a short note (no book, unlocks or chapters)', rows.length > 0 && rows.every((x) => skillsOf().has(x.dataset.skill) && x.querySelector('.name').textContent.trim() && x.querySelector('.note').textContent.trim().length < 48 && !x.querySelector('.book, ul, .chapters')), { rows: rows.map((x) => x.dataset.skill) }));
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
    let sawOnTable = false, sawTrack = null, sawHeld = false, sawAlbumTrack = false;
    b.queue = []; b.step = null; b.choose('dance');
    let t = 0;
    while (t < 240 && !(b.last !== 'dance' && t > 1)) {
      step(0.1); t += 0.1;
      if (b.albumOnTable) sawOnTable = true;
      if (b.held && b.held.def.id === a.id) sawHeld = true;
      if (b.music) { sawTrack = b.track; if (a.tracks.includes(b.track)) sawAlbumTrack = true; }          // (as the music stops the track goes back to the default for a frame: any frame of the record's own track will do)
    }
    const idle = T.settle().ok;
    out.push(result(`record:${a.id}`, add.ok && sawHeld && sawOnTable && sawAlbumTrack && rec.mesh.visible && !b.music && idle && errors.length === base, {
      premiumDevBypass: !!add.devBypass, fetched: sawHeld, onTable: sawOnTable, trackPlayed: sawTrack, returnedToShelf: rec.mesh.visible, errors: errors.slice(base),
    }));
  }
  return out;
};

// 5b. The playlist: every record has several songs with titles of their own, the stereo list shows them all, next / previous /
// pick work, a track hands over to the next song on the same record after its minute, and GUY does not play the same song
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
  // GUY: the same record forced again and again must not repeat its song; the record he plays should change too when he can
  const songs = [], albums = [];
  for (let k = 0; k < 8; k++) {
    T.settle(); T.home(); b.queue = []; b.step = null; b.pendingActivity = null;
    b.forceAlbum = 'party'; b.choose('dance');
    let t = 0; while (t < 60 && !b.music) { step(0.25); t += 0.25; }
    songs.push(b.track);
    T.settle(120);
  }
  const repeats = songs.filter((s, i) => i && s === songs[i - 1]).length;
  out.push(result('playlist: GUY does not play the same song twice in a row from a record', repeats === 0 && new Set(songs).size >= 3, { songs, repeats }));
  for (let k = 0; k < 12; k++) {
    T.settle(); T.home(); b.queue = []; b.step = null; b.pendingActivity = null;
    b.choose('dance');
    let t = 0; while (t < 60 && !b.music) { step(0.25); t += 0.25; }
    albums.push(b.albumOf(b.track) ? b.albumOf(b.track).id : 'none');
    T.settle(120);
  }
  const recordRepeats = albums.filter((s, i) => i && s === albums[i - 1] && s !== 'none').length;
  out.push(result('playlist: GUY picks different records from session to session', recordRepeats === 0 && new Set(albums).size >= 3, { albums, recordRepeats }));
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
  out.push(result('stereo + guitar (play along, in time)', ...(() => { const r = timed(() => { B().stereoControl('play'); T.settle(); B().stereoControl('play'); let x = T.interact('guitar', { max: 30, partial: true }); for (const at of [[-1, 1.6], [1, 1.2], [0, 0.4]]) { if (!(x.labels || []).some((l) => /no room to stand/.test(l))) break; W().objects.guitar.set(at[0], at[1]); T.settle(); B().stereoControl('play'); x = T.interact('guitar', { max: 30, partial: true }); } B().stereoControl('stop'); return x; }); return [r.pass && /along/.test((r.labels || []).join(' ')), { labels: r.labels }]; })()));
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
  // the stereo's long-press button: "Turn Stereo On" has GUY switch it on (the selected song, left on), "Turn Stereo Off" switches it off
  out.push(result('stereo menu button: GUY turns it on, then off', ...(() => {
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
  // user-started music is left alone by GUY when he is told to do something else
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
    skillsOf().known.delete(target.def.teaches); skillsOf().fading.delete(target.def.teaches);          // (a book he already knows is not read again: this is one he has not read)
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

// 7c. Furniture against a wall: with the drum kit or the easel pushed up to a wall in every rotation, GUY must either use it
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
          const trail2 = []; let nl2 = 0;
          while (t < 40 && !sat) { step(0.1); t += 0.1; if (b.pose === seat || (name === 'easel' && b.pose.startsWith('paint'))) sat = true; if (t >= nl2) { nl2 += 4; const st = b.step; trail2.push([+t.toFixed(0), b.last, b.pose, +G().pos.x.toFixed(2), +G().pos.z.toFixed(2), st ? st.type + (st.anchor ? ':' + st.anchor.name : '') + (st.x !== undefined ? '->' + (+st.x).toFixed(2) + ',' + (+st.z).toFixed(2) : '') : '-', b.queue.length, b.blockedBy]); } }
          if (!sat) window.__wallTrail2 = trail2;
          out.push(result(`wall: ${name} against the ${wall} wall, turned ${r}: he uses it promptly`, ok && sat && t < 15 && errors.length === base, { ok, sat, seconds: +t.toFixed(1), trail: sat ? undefined : window.__wallTrail2, drums: name === 'drums' ? [o.x, o.z, o.rot] : undefined }));
        } else {
          // he declines; forcing the activity anyway must be dropped quickly
          b.queue = []; b.step = null; b.pendingActivity = null; b.choose(act);
          const trail = []; let nextLog = 0, satAnyway = false;
          while (t < 40 && b.last === act) { step(0.1); t += 0.1; if (b.pose === seat || (name === 'easel' && b.pose.startsWith('paint'))) satAnyway = true; if (t >= nextLog) { nextLog += 3; const st = b.step; trail.push([+t.toFixed(0), b.pose, +G().pos.x.toFixed(1), +G().pos.z.toFixed(1), st ? st.type + (st.anchor ? ':' + st.anchor.name : '') + (st.x !== undefined ? '->' + (+st.x).toFixed(1) + ',' + (+st.z).toFixed(1) : '') : '-', b.queue.length]); } }
          gaveUp = +t.toFixed(1); if (gaveUp >= 20) window.__wallTrail = trail;
          out.push(result(`wall: ${name} against the ${wall} wall, turned ${r}: he declines, and a forced try is dropped quickly (or, if the place turns out to be reachable after all, carried out)`, !ok && /Move it away/.test(reply.message) && (gaveUp < 20 || satAnyway) && errors.length === base, { ok, message: reply.message, gaveUpAfter: gaveUp, trail: gaveUp >= 20 ? window.__wallTrail : undefined }));
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
  for (let u = -4.0; u <= 4.0; u += 0.25) if (tree && w.fits(tree, u, -ROOM_MAIN.d / 2 + 0.45, tree.w, tree.d)) free.push(u);
  w.restoreObject('picture');
  const p2 = w.decor.picture;
  let tested = null;
  for (const u of free) {
    if (p2 && w.decorFits(p2, u, p2.v)) { p2.set(u, p2.v); tested = { u, treeFitsUnderIt: w.fits(tree, u, -ROOM_MAIN.d / 2 + 0.45, tree.w, tree.d) }; break; }
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
  out.push(...catalogUi(LISTED));
  return out;
};

// The Catalog as a menu, like Help and the Skills menu: a dialog, search, the show filter, folding sections, keys, a phone's bottom sheet.
function catalogUi(LISTED) {
  const out = [], m = machine(), ui = window.__catalog, search = m.querySelector('.search');
  const titles = () => [...m.querySelectorAll('.card .title')].map((e) => e.textContent);
  const type = (q) => { search.value = q; search.dispatchEvent(new Event('input')); };
  const showOnly = (k) => m.querySelector(`.show [data-show=${k}]`).click();
  if (!ui) return [result('catalog: the page exposes the Catalog to the harness (window.__catalog)', false)];
  ui.close(); ui.open();
  out.push(result('catalog: it is a labelled dialog with tabs and a close button you can find, like Help', m.getAttribute('role') === 'dialog' && m.getAttribute('aria-modal') === 'true' && m.getAttribute('aria-label') === 'Catalog'
    && m.querySelector('[role=tablist]') && m.querySelectorAll('[role=tab]').length === 4 && m.querySelector('.close').getAttribute('aria-label') === 'Close' && m.querySelector('.tab.on').getAttribute('aria-selected') === 'true'));
  // search: "rug" shows only rugs (every card it shows has the word in it), and the tabs say what they found
  m.querySelector('[data-tab=objects]').click();
  type('rug');
  const rugs = LISTED.filter((d) => /rug/i.test(`${d.name} ${d.desc} ${d.sub || ''}`)).map((d) => d.name).sort();      // (the Striped Runner is found by its heading, Rugs)
  out.push(result('catalog: search finds every object with the word, and nothing else', rugs.length > 0 && JSON.stringify(titles().sort()) === JSON.stringify(rugs), { want: rugs, got: titles() }));
  out.push(result('catalog: while searching, the Objects tab says how many it found', (m.querySelector('[data-tab=objects] .n') || {}).textContent === String(rugs.length)));
  type('armchairs');
  out.push(result('catalog: a plural finds the singular ("armchairs" finds the Armchair)', titles().includes('Armchair')));
  type('zzqx nothing');
  out.push(result('catalog: a search that finds nothing says so', titles().length === 0 && /Nothing here matches/.test(m.querySelector('.body').textContent)));
  const book = BOOK_CATALOG.find((b) => { type(b.title); return m.querySelector('[data-jump-tab=books]') && !titles().length; });
  const jump = book && m.querySelector('[data-jump-tab=books]');
  if (jump) jump.click();
  out.push(result('catalog: a book searched for on the Objects tab offers a jump to Books, which shows it', !!book && m.querySelector('.tab.on').dataset.tab === 'books' && titles().includes(book.title), { book: book && book.title }));
  // keys typed in the search box stay there: K (the Skills menu) does not open behind the Catalog
  const skillsPanel = document.getElementById('skills'), skillsWas = skillsPanel.hidden;
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
  out.push(result('catalog: typing in the search box does not work the room\'s keys (K)', skillsPanel.hidden === skillsWas));
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  out.push(result('catalog: Escape in the search box clears the search first and leaves the Catalog open', search.value === '' && !m.hidden));
  // the show filter: "In the room" shows only what is in the room, "To add" only what can be added or put back
  m.querySelector('[data-tab=objects]').click(); openObjects('all');
  showOnly('here');
  const hereCards = [...m.querySelectorAll('.card')];
  const inRoomNow = LISTED.filter((d) => !d.built && isPresent(d.id) && (!d.locked || dev.all)).length + LISTED.filter((d) => d.built && isPresent(d.id)).length;
  out.push(result('catalog: "In the room" shows only what is in the room', hereCards.length === inRoomNow && hereCards.every((c) => c.classList.contains('inroom') || /In the room: [1-9]/.test(c.textContent)), { shown: hereCards.length, inRoomNow }));
  showOnly('add');
  const addCards = [...m.querySelectorAll('.card')];
  out.push(result('catalog: "To add" shows only what can be added or put back, each with its button', addCards.length > 0 && addCards.every((c) => { const b = c.querySelector('.act'); return b && !b.classList.contains('rm'); })));
  showOnly('all');
  out.push(result('catalog: Everything shows the whole list again', titles().length === LISTED.length));
  // folding a section hides its cards (they stay in the page) and is undone by a second tap
  const fold = m.querySelector('.sec-head'), sec = fold && fold.closest('.sec');
  if (fold) fold.click();
  const sec2 = sec && m.querySelector(`.sec[data-sec="${sec.dataset.sec}"]`);
  const folded = !!sec2 && sec2.classList.contains('closed') && sec2.querySelector('.sec-head').getAttribute('aria-expanded') === 'false' && getComputedStyle(sec2.querySelector('.cards')).display === 'none' && titles().length === LISTED.length;
  if (sec2) sec2.querySelector('.sec-head').click();
  const sec3 = sec && m.querySelector(`.sec[data-sec="${sec.dataset.sec}"]`);
  out.push(result('catalog: a section folds away and opens again', folded && !!sec3 && !sec3.classList.contains('closed')));
  // tapping a card shows its whole description; tapping its button does not
  const card = m.querySelector('.card .info');
  if (card) card.click();
  out.push(result('catalog: tapping a card shows its whole description', !!card && card.parentElement.classList.contains('open')));
  // keys: C opens and closes it, / goes to the search box, opening it closes the Skills menu and Help
  ui.close();
  document.getElementById('skills-btn').click();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
  out.push(result('catalog: C opens it, and opening it closes the Skills menu', ui.isOpen() && skillsPanel.hidden));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
  out.push(result('catalog: / goes to the search box', document.activeElement === search));
  search.blur();
  window.__help.open();
  out.push(result('catalog: opening Help closes the Catalog', !ui.isOpen() && window.__help.isOpen()));
  window.__help.close();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C' }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C' }));
  out.push(result('catalog: C again closes it', !ui.isOpen() && m.hidden));
  ui.open('studio');
  out.push(result('catalog: the Studio Machine has its own title and no tabs or search', /Studio Machine/.test(m.querySelector('header h3').textContent) && m.querySelector('.tabs').hidden && m.querySelector('.tools').hidden));
  ui.close(); ui.open();
  out.push(result('catalog: after the Studio Machine the Catalog is whole again', /Catalog/.test(m.querySelector('header h3').textContent) && !m.querySelector('.tabs').hidden && !m.querySelector('.tools').hidden));
  ui.close();
  // the layout: a bottom sheet on a phone, a centred panel on a wide screen, and nothing runs off the side (the chips used to)
  {
    const frame = document.createElement('iframe'); frame.style.cssText = 'position:fixed;left:0;top:0;border:0;visibility:hidden;height:844px';
    document.body.appendChild(frame);
    const d = frame.contentDocument, bad = [];
    d.head.innerHTML = [...document.querySelectorAll('style')].map((x) => `<style>${x.textContent}</style>`).join('');
    ui.open(); d.body.innerHTML = m.outerHTML; ui.close();
    d.getElementById('machine').hidden = false;
    for (const wide of [320, 390, 700, 701, 1024, 1440]) {
      frame.style.width = `${wide}px`;
      const panel = d.querySelector('#machine .panel').getBoundingClientRect();
      const sheet = wide <= 700;
      if (sheet && (Math.round(panel.bottom) !== 844 || Math.round(panel.width) !== wide)) bad.push(`${wide}: not a bottom sheet`);
      if (!sheet && (panel.left < 8 || panel.right > wide - 8 || panel.width > 880)) bad.push(`${wide}: not a centred panel`);
      for (const sel of ['.panel', '.tools', '.body']) { const el = d.querySelector(`#machine ${sel}`); if (el.scrollWidth > el.clientWidth + 1) bad.push(`${wide}: ${sel} runs off the side`); }
      for (const el of d.querySelectorAll('#machine .card')) { const r = el.getBoundingClientRect(); if (r.right > panel.right + 1) { bad.push(`${wide}: a card runs off the side`); break; } }
    }
    frame.remove();
    out.push(result('catalog: a bottom sheet on a phone, a centred panel on a wider screen, and nothing runs off the side', !bad.length, { bad: bad.slice(0, 6) }));
  }
  return out;
}

// ---- visual checkpoints -----------------------------------------------------------------------------------------
// Freeze GUY in a pose and put the camera somewhere useful. Take a screenshot afterwards (wait ~2 s: the pane renders lazily).
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
// Run an activity until GUY reaches (pose, t), freeze and frame him. `opts.turning` waits for a page turn.
T.moment = (activity, pose, t = 0, view = 'front', opts = {}) => {
  T.unfreeze(); T.prep(activity); if (opts.skills) T.learn(opts.skills); for (const o of opts.objects || []) T.addObject(o); T.settle();      // (opts.objects: extras that must be in the room, e.g. the electric guitar for the secret dance moves)
  const b = B();
  if (opts.album && !(W().objects.shelf.albums || []).length) T.addAlbum(ALBUM_CATALOG.find((x) => !x.premium).id);       // a record on the shelf to carry
  if (opts.album) b.forceAlbum = (W().objects.shelf.albums[0] || { def: {} }).def.id;
  b.queue = []; b.step = null; b.choose(activity);
  let guard = 0;
  const ok = () => b.step && b.pose === pose && b.step.t >= t && (!opts.turning || (b.read && b.read.turning && b.read.turnT > 0.8)) && (!opts.push || b.step.push) && (!opts.range || (opts.range === 'carry' ? (b.rangeHold && b.step.type === 'walk') : opts.range === 'fired' ? (b.step.fx && b.step.fx.range && b.step.fx.range.fired) : (b.step.fx && b.step.fx.range && (opts.range === 'shoot' ? !b.step.fx.range.single : b.step.fx.range.tag === opts.range)))) && (!opts.yard || (b.inYard() && b.step.t >= t)) && (!opts.album || (b.held && b.held.kind === 'album'))
    && (!opts.on || (b.step.fx && (b.step.fx.needs || []).some((n) => n === opts.on || (W().objects[n] || {}).kind === opts.on))) && (!opts.inRoom || b.hereId() === opts.inRoom);      // (opts.on: at that object, not a door knob on the way; opts.inRoom: in that room)
  while (!ok() && guard++ < 40000) step(1 / 30);
  T.freeze(); T.look(view, opts.dist);                                       // (opts.dist: how far back the camera stands, for a picture of someone up on a stool)
  return { reached: guard < 40000, state: T.state(), hands: T.hands() };
};
T.visualChecklist = () => MANIFEST.visual;
// Replay one sweep under the seed it had in `T.runAll({ seed })`: its number is its place in the list (the first sweep is 1).
T.runSweep = (name, seed = 1, no = 1) => { if (T.seed) T.seed(seed * 1000 + no); try { return T[name](); } finally { if (T.unseed) T.unseed(); } };

// ---- everything ---------------------------------------------------------------------------------------------------
const summarise = (list) => ({ total: list.length, passed: list.filter((r) => r.pass).length, failed: list.filter((r) => !r.pass) });
T.summarise = summarise;
// Dragging or turning something GUY is using must make him let go (stand up, step back) instead of stretching his arms after it.
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
  b.queue = []; b.step = null; if (b.held) b.returnBook(); T.settle();          // (not in his hands just now: while he holds a book it cannot be taken off the shelf)
  const rem = b.removeBook('stereo');
  const kept = sk.has('stereo') && sk.strength('stereo') === 1 && !onShelf('stereo');
  step(200);
  const stillKept = sk.has('stereo') && sk.strength('stereo') === 1;
  const putBack = T.addBook('stereo') === true && onShelf('stereo');
  out.push(result('remove: the book leaves the shelf, comes back from the catalog, and GUY keeps the skill (no fading)', rem.ok && kept && stillKept && putBack, { kept, stillKept, putBack, message: rem.message }));
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
    // how close the open book floats to the bookshelf while he reads standing up (it is not an object: only where he stands keeps it clear)
    const ob = w.objects.shelf.obstacle; let minGap = Infinity;
    while (t < 150 && b.last === 'read') {
      step(0.1); t += 0.1; if (b.step) poses.add(b.pose);
      if (b.pose === 'readStand' && b.read && b.read.open > 0.5) {
        const a = b.readAnchor();
        minGap = Math.min(minGap, Math.hypot(Math.max(ob.x0 - a.x, 0, a.x - ob.x1), Math.max(ob.z0 - a.z, 0, a.z - ob.z1)));
      }
    }
    return { seconds: +t.toFixed(1), poses: [...poses], learned: sk.has(rec2.def.teaches), labels, minGap: +minGap.toFixed(2) };
  };
  const normal = readRun('lighting');
  sk.known.add('speedreading');
  const fast = readRun('lighting');
  out.push(result('speed reading: reads standing at the shelf, much faster, and still learns from the book', normal.learned && fast.learned && !fast.poses.includes('readSit') && fast.seconds < normal.seconds * 0.7, { normal, fast }));
  out.push(result('speed reading: without it he sits in a chair to read', normal.poses.includes('readSit'), { poses: normal.poses }));
  // the open book must not be inside the bookshelf: he steps back from it to read standing (found by hand: it clipped into the shelf)
  out.push(result('speed reading: the open book floats clear of the bookshelf (he steps back to read)', fast.minGap >= 0.08 && fast.minGap < Infinity, { minGap: fast.minGap }));
  sk.known.delete('speedreading');
  w.removeObject('armchair'); b.objectRemoved('armchair'); T.settle();
  const noChair = readRun('ball');
  T.addObject('armchair');
  out.push(result('reading: with no chair he reads standing, and the open book is clear of the bookshelf too', noChair.poses.includes('readStand') && noChair.minGap >= 0.08 && noChair.minGap < Infinity && noChair.learned, { noChair }));
  sk.known.add('speedreading');

  // a book is not held back because the object it is about is not in the room: it is added from the Catalog and read like any other
  if (w.objects.easel) { w.removeObject('easel'); b.objectRemoved('easel'); }
  const easelAbsent = !w.objects.easel;
  const addedAbout = T.addBook('painting');
  const aboutRec = w.objects.shelf.books.find((x) => x.def.id === 'painting');
  out.push(result('books: a book about an object that is not in the room can be added from the Catalog', easelAbsent && addedAbout && !!aboutRec && !w.objects.easel, { easelAbsent, addedAbout }));
  sk.known.delete('easel'); sk.fading.clear();
  const aboutRun = aboutRec ? readRun('painting') : null;
  out.push(result('books: and he reads it and learns it with the object still missing', !!aboutRun && aboutRun.learned && !w.objects.easel, { aboutRun }));
  if (aboutRec) b.removeBook('painting');

  // forgetting Speed Reading is slow (5 minutes) and the effect fades with it
  b.forgetBook('speedread');
  const sp0 = b.readSpeed(); step(150); const sp150 = b.readSpeed(); step(160);
  out.push(result('speed reading: forgetting takes 5 minutes, the reading speed falls gradually back to normal', sp0 === 2.5 && sp150 > 1.4 && sp150 < 2.0 && b.readSpeed() === 1 && !sk.has('speedreading'), { sp0, sp150, end: b.readSpeed() }));
  // (palm measured from the thumb bone reads about 25 degrees further down than the hand's palm; the old bug read -0.7 towards the shelf)
  // taking a book down: the palm faces the spine and the fingers point into it, a little up, at a high and at a mid-height book (found by hand: at mid height
  // the back of his hand went to the book with the fingers sweeping sideways)
  const grabHand = (id) => {
    T.unfreeze(); T.removeAll(); T.forget(); sk.fading.clear(); T.settle(); T.home();
    b.forceBook = w.objects.shelf.books.find((x) => x.def.id === id);
    T.prep('read'); b.queue = []; b.step = null; b.choose('read');             // (not T.moment: its camera framing would switch the auto-framing off for the sweeps after this one)
    let guard = 0;
    while (!(b.step && b.pose === 'grab' && b.step.t >= 0.85) && guard++ < 40000) step(1 / 30);
    T.freeze();
    const mr = { reached: guard < 40000 };
    step(0.6);                                                           // (the frozen brain still lets the bones catch up with their targets)
    const g = window.guy, THREE = window.THREE, V = (n) => g.boneWorld(n), yaw = b.g.root.rotation.y;
    const wr = V('RightHand'), fc = V('RightHandMiddle1').sub(wr).normalize(), sv = V('RightHandThumb1').sub(wr);      // (the knuckle, not the fingertip: the fingers are curling)
    sv.addScaledVector(fc, -sv.dot(fc)).normalize();
    const palm = sv.clone().cross(fc), fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    T.unfreeze(); b.forceBook = null;
    return { reached: mr.reached, palmToShelf: +palm.dot(fwd).toFixed(2), palmUp: +palm.y.toFixed(2), fingersUp: +fc.y.toFixed(2), fingersIn: +fc.dot(fwd).toFixed(2) };
  };
  for (const [id, what] of [['stereo', 'a high'], ['piano', 'a mid-height']]) {
    const gh = grabHand(id);
    out.push(result(`grab: taking ${what} book, the palm faces the spine and the fingers point into it, a little up`, gh.reached && gh.palmToShelf > 0.3 && gh.palmUp < 0 && gh.fingersUp > 0.2 && gh.fingersIn > 0.6, gh));
  }
  T.settle(); T.home();

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
  // (a layout can leave no room to use the telescope or to sit down: when nothing was heard, the thing is put somewhere else and he tries again)
  const act = (label, name, activity, min = 1) => sound(label, name, () => {
    const c0 = sfxCounts[name] || 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      T.prep(activity); T.run(activity, { prep: false });
      if ((sfxCounts[name] || 0) - c0 >= min) return;
      const obj = { stargaze: 'telescope', scopecare: 'telescope', sit: 'armchair' }[activity];
      if (!obj || !w.objects[obj]) return;
      w.removeObject(obj); b.objectRemoved(obj); T.addObject(obj); T.settle();
    }
  }, min);
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
// Take every added room away again (a test-only reset: it also deletes the furniture; the game's own removal is rooms.remove, tested by sweepRoomRemoval).
T.resetRooms = () => {
  const b = B();
  for (const r of ROOM_CATALOG) R().reset(r.id);                                  // its furniture goes with it
  for (const [name, o] of Object.entries(W().objects)) if (o.kind) { W().storeInstance(name); b.objectRemoved(name); }       // and what GUY built that stands in his room
  W().paintings.reset();                                                          // GUY's paintings come down and the list is emptied
  const st = W().stock; st.items = {}; st.coins = 0;   // and what the Workshop made and the Restaurant earned
  if (W().gal.exists()) W().gal.remove();                                       // GAL goes too (the machine is not given back)
  delete W().removed.botprinter;
  W().restaurant.clear(); W().restaurant.paused = false; W().restaurant.nServed = 0; W().restaurant.stats = { arrived: 0, paid: 0, gaveUp: 0 };
  b.carry = null; b.restJob = null; b.shelfMove = null; b.skillRun = null; b.bringJob = null; W().skillMusic = false; for (const pp of b.popping || []) pp.o.group.scale.setScalar(1); b.popping = [];
  const sh = W().objects.shelf;                                                   // the skill shelf back in its own place (a Library sweep carries it off)
  if (sh) { if (sh.packed) W().unpackShelf('shelf', null); sh.rot = 0; sh.group.rotation.y = 0; sh.group.scale.setScalar(1); sh.home = { x: 4.7, z: 0.2 }; sh.set(4.7, 0.2); }
  if (!b.inMain()) T.home();                                                     // nobody is left standing in a room that is gone
};
// Put back what a door took out of the room (only what was not already out before the sweep began).
const putBackSince = (before) => { for (const name of Object.keys(W().removed)) if (!before.has(name)) W().restoreObject(name, { x: G().pos.x, z: G().pos.z }); };
// What is wrong with a room's door? [] means nothing: on an allowed wall, nothing in the doorway, no wall piece over it.
const doorProblems = (id) => {
  const w = W(), d = w.doors[id], bad = [];
  if (!d) return ['no door'];
  if (d.parent !== 'main') { if (!w.doors[d.parent] || d.wall.split(':')[0] !== d.parent) bad.push(`door is not in the side wall of ${d.parent}`); }
  else if (!ROOM_CATALOG.find((r) => r.id === id).doorWalls.includes(d.wall)) bad.push(`wall ${d.wall} is not allowed`);
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

// ---- 12d. Spoken commands: finish-then-obey (src/commands.js, src/voice.js, src/mic.js). The design's time limits: 5 s to wrap up a quick
// activity ("One sec."), 10 s to finish a work step ("Let me finish this row, then I'll ..."), 30 s waiting behind a busy job when GAL
// cannot take it ("I'm cooking and GAL can't take it. Give me about half a minute, then I'll ..."), then a question. Every command ends
// in a start, a reason said out loud, a cancel or a "later": none is dropped without a word. The microphone is a stand-in that "hears".
T.sweepCommands = () => {
  const out = [], base = errors.length, w = W(), b = B(), V = window.__voice, C = V.commands;
  window.__voiceNoAudio = true;
  const said = (from) => V.tts.log.slice(from).map((l) => `${l.who}: ${l.text}`);
  const L = (r) => r.lines.map((l) => `${l.who}: ${l.text}`).join(' | ');
  const reset = () => { b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; b.using = new Set(); C.clear(); V.tts.stop(); };
  const busyWith = (act, sec) => { b.queue = []; b.pendingActivity = null; b.step = b.play('idle', sec); b.step.t = 0; b.last = act; b.using = new Set(b.exclusiveFor(act)); };   // a stand-in for a long job
  const started = (names) => names.includes(b.last) && b.pendingActivity === null;
  try {
    galReset(); T.settle(); T.resetRooms(); T.removeAll(); T.forget(); T.home(); T.settle();
    T.learn(['piano', 'guitar', 'stereo']); for (const id of ['piano', 'guitar', 'lamp', 'table']) T.addObject(id);
    T.settle();
    // 1. idle: he just starts, "Sure thing." (or another short yes)
    reset();
    const r1 = V.run('play the guitar');
    out.push(result('commands: idle, he answers with a short yes and the command is tracked until it starts', r1.ok && r1.lines.length === 1 && ['Sure thing.', 'On it.', 'Okay!', 'You got it.'].includes(r1.lines[0].text) && C.list.length === 1 && C.list[0].cls === 'idle', { lines: L(r1), list: C.list }));
    const t1 = runUntil(() => started(['guitar']), 15);
    out.push(result('commands: ... and he starts it within a second or so', started(['guitar']) && t1 <= 2, { t: t1, last: b.last }));
    // 2. a quick activity (playing the piano): "One sec.", and he starts the new command within 5 s
    reset(); T.home(); T.settle();
    b.interact('piano'); runUntil(() => ['sitpiano', 'piano'].includes(b.last) && !!b.step && b.step.type === 'play', 60);
    const playing = ['sitpiano', 'piano'].includes(b.last);
    const r2 = V.run('turn on the lamp');
    const t2 = runUntil(() => started(['lamp', 'mood']), 15);
    out.push(result('commands: playing the piano, "turn on the lamp": "One sec." and the lamp within 5 s', playing && r2.ok && r2.lines.length === 1 && r2.lines[0].text === 'One sec.' && started(['lamp', 'mood']) && t2 <= LIMITS.quick + 0.5, { playing, lines: L(r2), t: t2, last: b.last }));
    // 2b. the wrap-up limit holds even when the wrap-up would run on (a long step after the command)
    reset(); busyWith('dance', 100);
    const r2b = V.run('turn on the lamp');
    b.step = b.play('idle', 100); b.step.t = 0;                   // (a wrap-up that would take 100 s)
    const t2b = runUntil(() => started(['lamp', 'mood']), 20);
    out.push(result('commands: a wrap-up never takes longer than its limit: he stops where he is at 5 s and starts the command', r2b.ok && r2b.lines[0].text === 'One sec.' && started(['lamp', 'mood']) && t2b >= LIMITS.quick - 0.5 && t2b <= LIMITS.quick + 1, { lines: L(r2b), t: t2b }));
    // 3. a work step (mowing): he finishes the step he is on ("Let me finish this row, then I'll play the piano.")
    reset(); busyWith('mow', 3); const row = b.step;
    const n3 = V.tts.log.length;
    const r3 = V.run('play the piano');
    const kept = b.step === row;
    const t3 = runUntil(() => started(['sitpiano', 'piano']), 20);
    out.push(result('commands: mowing, "play the piano": "Let me finish this row, then I\'ll play the piano." and he finishes the step he is on, then plays', r3.ok && r3.lines[0].text === "Let me finish this row, then I'll play the piano." && kept && started(['sitpiano', 'piano']) && t3 >= 2.5 && t3 <= 4.5 && !said(n3).some((l) => /That'll do/.test(l)), { lines: L(r3), kept, t: t3, said: said(n3) }));
    reset(); busyWith('mow', 100);
    const n3b = V.tts.log.length;
    V.run('play the piano');
    const t3b = runUntil(() => started(['sitpiano', 'piano']), 20);
    out.push(result('commands: a work step that runs on is cut at 10 s, with "That\'ll do for now."', started(['sitpiano', 'piano']) && t3b >= LIMITS.step - 0.5 && t3b <= LIMITS.step + 1 && said(n3b).includes("guy: That'll do for now."), { t: t3b, said: said(n3b) }));
    reset(); busyWith('paint', 100);
    const r3c = V.run('play the piano');
    out.push(result('commands: painting, he says he finishes this stroke first', /^Finishing this stroke first, then I'll play the piano\.$/.test(r3c.lines[0] && r3c.lines[0].text || ''), { lines: L(r3c) }));
    // 4. a busy job and no GAL: it waits, he says how long, and he starts it when the job is over
    reset(); busyWith('cook', 12);
    const n4 = V.tts.log.length;
    const r4 = V.run('play the piano');
    out.push(result('commands: cooking with no GAL: "I\'m cooking and GAL can\'t take it. Give me about half a minute, then I\'ll play the piano." and it waits', r4.ok && r4.lines.length === 1 && r4.lines[0].text === "I'm cooking and GAL can't take it. Give me about half a minute, then I'll play the piano." && !b.pendingActivity && C.list.length === 1 && C.list[0].state === 'waiting', { lines: L(r4), list: C.list }));
    const t4 = runUntil(() => started(['sitpiano', 'piano']), 30);
    out.push(result('commands: ... when the cooking ends he says "Done cooking. Playing the piano now." and plays', started(['sitpiano', 'piano']) && t4 <= 14 && said(n4).includes('guy: Done cooking. Playing the piano now.'), { t: t4, said: said(n4) }));
    reset(); busyWith('cook', 100);
    const r4b = V.run('GUY, play the piano');
    out.push(result('commands: named ("GUY, ...") while cooking: he keeps it himself and does not mention GAL', r4b.ok && r4b.lines[0].text === "I'm cooking. Give me about half a minute, then I'll play the piano.", { lines: L(r4b) }));
    // 5. the 30 s question, and the answers
    reset(); busyWith('cook', 300);
    const n5 = V.tts.log.length;
    V.run('play the guitar');
    runUntil(() => !!C.question, 40);
    const asked = said(n5).includes('guy: Still cooking. Should I stop and play the guitar?');
    const r5 = V.run('yes please');
    const t5 = runUntil(() => started(['guitar']), 10);
    out.push(result('commands: after 30 s he asks "Still cooking. Should I stop and play the guitar?" and "yes" makes him stop and play', asked && r5.ok && r5.lines[0] && r5.lines[0].text === "Okay, I'll stop cooking. Playing the guitar now." && started(['guitar']) && t5 <= 6, { said: said(n5), lines: L(r5), t: t5 }));
    reset(); busyWith('cook', 300);
    const n5b = V.tts.log.length;
    V.run('play the guitar'); runUntil(() => !!C.question, 40);
    const r5b = V.run('no');
    runUntil(() => false, 40);
    out.push(result('commands: "no" keeps him cooking, he says he will do it when he is done, and he does not ask again', r5b.lines[0] && r5b.lines[0].text === "Okay, I'll play the guitar when I'm done cooking." && C.list.length === 1 && C.list[0].state === 'waiting' && said(n5b).filter((l) => /Should I stop/.test(l)).length === 1 && b.last === 'cook', { lines: L(r5b), said: said(n5b), list: C.list }));
    reset(); busyWith('cook', 300);
    const n5c = V.tts.log.length;
    V.run('play the guitar'); runUntil(() => false, 85);
    const s5c = said(n5c);
    out.push(result('commands: no answer: he asks once more at 60 s, then leaves it for later with a line (it is not dropped silently)', s5c.filter((l) => /Should I stop/.test(l)).length === 2 && s5c.includes("guy: I'll leave the guitar for later.") && C.list.length === 0, { said: s5c }));
    // 6. the queue: asking again replaces, three at most, "never mind the ..." drops one, "stop" drops them all
    reset(); busyWith('cook', 300);
    V.run('play the guitar'); V.run('play the guitar'); V.run('play the piano'); V.run('turn on the lamp');
    const r6 = V.run('dance');
    out.push(result('commands: asking for the same thing again replaces it; a fourth command is refused kindly', C.waitingFor(b) === 3 && !r6.ok && r6.lines[0].text === "I've already got 3 things to do. Want me to drop one?", { list: C.list, lines: L(r6) }));
    const r6b = V.run('never mind the guitar');
    out.push(result('commands: "never mind the guitar" drops just that one, and he says so', r6b.lines[0] && r6b.lines[0].text === "Okay, I'll leave the guitar." && C.waitingFor(b) === 2, { lines: L(r6b), list: C.list }));
    V.run('stop');
    out.push(result('commands: "stop" drops everything waiting', C.waitingFor(b) === 0, { list: C.list }));
    // 7. the start watchdog: a command that never gets going is reported with a reason, not forgotten
    reset();
    const n7 = V.tts.log.length;
    const choose0 = b.choose;
    b.choose = function (f) { if (f === 'guitar') { this.pendingActivity = 'guitar'; return; } return choose0.call(this, f); };     // (something keeps it from starting)
    try { V.run('play the guitar'); runUntil(() => !b.pendingActivity, 40); } finally { b.choose = choose0; }
    out.push(result('commands: a command that has not started after 30 s is reported as failed, out loud', !b.pendingActivity && C.list.length === 0 && said(n7).some((l) => /^guy: (I couldn't play the guitar|Sorry, I couldn't get started)/.test(l)), { said: said(n7), pending: b.pendingActivity }));
    reset();
    const n7b = V.tts.log.length;
    V.run('play the guitar'); runUntil(() => started(['guitar']), 10);
    b.lastPlanError = new Error('test: the guitar went missing'); step(0.1);
    out.push(result('commands: when the plan of a started command falls apart he says so', said(n7b).includes("guy: I couldn't play the guitar. Something's in the way."), { said: said(n7b) }));
    b.lastPlanError = null;
    // 8. a few guesses from the microphone: the first one that makes sense wins
    reset();
    const r8 = V.runAlternatives([{ text: 'guy play the pie and oh', confidence: 0.6 }, { text: 'guy play the piano', confidence: 0.5 }]);
    out.push(result('commands: of the guesses "guy play the pie and oh" / "guy play the piano" the piano is taken', r8.ok && r8.intent.type === 'object' && r8.intent.name === 'piano', { intent: r8.intent }));
    // 9. the microphone (a stand-in recogniser that "hears" when the button is let go)
    reset();
    const heard = [], states = [];
    let say = [[{ transcript: 'guy turn on the lamp', confidence: 0.9 }]];
    class FakeRec {
      start() { FakeRec.last = this; }
      stop() { this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'guy turn on' }], { isFinal: false })] }); for (const alts of say) this.onresult({ resultIndex: 0, results: [Object.assign(alts.slice(), { isFinal: true })] }); this.onend(); }
      abort() { this.onerror({ error: 'aborted' }); this.onend(); }
    }
    const partial = [];
    const mic = createMic({ Recognition: FakeRec, onPartial: (t) => partial.push(t), onState: (st, d) => states.push([st, d]), onFinal: (alts) => { heard.push(alts); V.runAlternatives(alts); } });
    const okStart = mic.start(); const listening = mic.listening; mic.stop();
    out.push(result('commands: the microphone: hold, talk, let go: the words go the same way as the typed box and he turns the lamp on', okStart && listening && !mic.listening && heard.length === 1 && heard[0][0].text === 'guy turn on the lamp' && partial[0] === 'guy turn on' && ['lamp', 'mood'].includes(b.pendingActivity) && states.map((s) => s[0]).join(',') === 'listening,thinking,idle' && FakeRec.last.maxAlternatives === 3 && FakeRec.last.interimResults && !FakeRec.last.continuous, { okStart, heard, partial, states, pending: b.pendingActivity }));
    class DeniedRec { start() {} stop() { this.onerror({ error: 'not-allowed' }); this.onend(); } abort() {} }
    const st2 = []; const mic2 = createMic({ Recognition: DeniedRec, onState: (st, d) => st2.push([st, d]) }); mic2.start(); mic2.stop();
    out.push(result('commands: the microphone permission refused: he says so and points to the typed box', st2.some(([st, d]) => st === 'error' && d === MIC_ERRORS['not-allowed']) && /type to me/.test(MIC_ERRORS['not-allowed']), { st2 }));
    const btn = document.getElementById('mic-btn'), real = window.__mic;
    out.push(result('commands: the 🎤 button is there beside 💬 Talk, shown only where the browser can recognise speech', !!btn && btn.nextElementSibling && btn.nextElementSibling.id === 'talk-btn' && btn.hidden === !real.supported, { hidden: btn && btn.hidden, supported: real && real.supported }));
    // 10. with GAL: she takes it when GUY is busy and she is free; named, GUY keeps it; both busy, it waits with GUY
    reset();
    const gb = galBuild();
    if (!gb.ok) throw new Error('no GAL');
    const gal = w.gal, gbr = gal.brain;
    gbr.skills.learn('guitar'); gbr.skills.learn('piano');
    reset(); gbr.queue = []; gbr.step = null; gbr.pendingActivity = null; gbr.last = 'wander'; gal.audience = null;
    busyWith('cook', 300);
    const r10 = V.run('play the guitar');
    out.push(result('commands: GUY cooking, GAL free: "GAL will get right on that." and she does it', r10.ok && r10.lines[0].who === 'guy' && r10.lines[0].text === 'GAL will get right on that.' && r10.lines[1] && r10.lines[1].who === 'gal' && !!gbr.pendingActivity && C.waitingFor(b) === 0, { lines: L(r10), pending: gbr.pendingActivity }));
    gal.audience = null; gbr.skip(true); gbr.pendingActivity = null; C.clear();
    const r10b = V.run('GUY, play the piano');
    out.push(result('commands: GUY cooking, GAL free, but GUY named: he keeps it ("I\'m cooking. Give me about half a minute, then I\'ll play the piano.")', r10b.ok && r10b.lines.length === 1 && r10b.lines[0].text === "I'm cooking. Give me about half a minute, then I'll play the piano." && !gbr.pendingActivity && C.waitingFor(b) === 1, { lines: L(r10b) }));
    C.clear(); gal.audience = null;
    gbr.queue = []; gbr.step = gbr.play('idle', 300); gbr.step.t = 0; gbr.last = 'serve';
    const r10c = V.run('play the piano');
    out.push(result('commands: GUY cooking and GAL serving: it waits with GUY, "I\'m cooking and GAL can\'t take it ..."', r10c.ok && r10c.lines[0].text === "I'm cooking and GAL can't take it. Give me about half a minute, then I'll play the piano." && C.waitingFor(b) === 1, { lines: L(r10c) }));
  } catch (e) { if (e.message !== 'no GAL') out.push(result('commands: sweep ran without throwing', false, { error: String(e && e.stack || e).slice(0, 500) })); else out.push(result('commands: GAL could be built for the test', false)); }
  finally { window.__voiceNoAudio = false; C.clear(); b.lock = null; try { galReset(); } catch { /* none */ } T.resetRooms(); T.home(); T.removeAll(); T.settle(); }
  out.push(result('commands: no errors', errors.length === base, { errors: errors.slice(base) }));
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
  const reset = () => { b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; b.using = new Set(); };
  // 1. from his own room: the sentence is understood, and he really mows (the mower leaves its spot)
  reset(); T.home(); T.settle();
  const m0 = w.objects.mower && { x: w.objects.mower.x, z: w.objects.mower.z };
  const r1 = V.run('GUY, mow the lawn please');
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
  out.push(result('yard voice: with light things all round the mower there is no plain loop, but there is one if GUY shifts them', !plain && !!pushy && pushy.blockers.length >= 1, { plain: !!plain, blockers: pushy && pushy.blockers }));
  const r6 = b.interact('mower');
  const seen6 = []; const orig6 = b.choose.bind(b); b.choose = (f) => { orig6(f); seen6.push(b.last); };
  let t6 = 0, moved6 = 0;
  try { while (t6 < 500 && moved6 < 0.8) { step(0.25); t6 += 0.25; const mm = w.objects.mower; moved6 = mm && m0 ? Math.hypot(mm.x - m0.x, mm.z - m0.z) : 0; } } finally { b.choose = orig6; }
  const shifted = spots0.filter((s) => Math.hypot(w.objects[s.n].x - s.x, w.objects[s.n].z - s.z) > 0.5).map((s) => s.n);
  out.push(result('yard voice: long-press Mow the Lawn with light things in the way: he mows, steering round them', r6.ok && moved6 >= 0.8 && seen6.includes('mow'), { r6, shifted, moved6, seen: seen6, t6 }));
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

// The lawn mower lives in the shed: when the lawn is done GUY pushes it to the door and in, and shuts the door; the next mow takes it out
// again; a shed that is dragged about takes its mower with it.
T.sweepMowerShed = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('backyard'); R().add('backyard');
  for (const id of ['shed', 'mower']) T.addObject(id);
  T.settle();
  const reset = () => { b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; b.using = new Set(); };
  const inside = () => w.yard.isStowed('mower');          // (put away in the shed: hidden)
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
  // 3. drag the shed: the mower in it is still put away, and the next mow starts from the shed's new place
  const sh = w.objects.shed, mw = w.objects.mower;
  const bd = w.doors.backyard.shell.bounds;
  sh.set(sh.x + (sh.x > (bd.minX + bd.maxX) / 2 ? -1.2 : 1.2), sh.z);
  const c3 = mowOnce();
  out.push(result('mower shed: the shed is dragged to another spot: the mower is still in it and the next mow starts at its new door', c3.r.ok && c3.went > 0.8 && inside() && w.objects.shed.openTo === 0, c3));
  // 4. cut short mid-mow: the door is shut again (the mower stays on the lawn, nothing is stuck)
  reset(); T.home(); T.settle();
  b.interact('mower');
  let t4 = 0; while (t4 < 200 && !(w.objects.mower && Math.hypot(w.objects.mower.x - sh.x, w.objects.mower.z - sh.z) > 1.2 && b.last === 'mow')) { step(0.25); t4 += 0.25; }
  b.interact('lawnchair');
  let t5 = 0; while (t5 < 40 && sh.openTo === 1) { step(0.25); t5 += 0.25; }
  const far = Math.hypot(mw.x - sh.x, mw.z - sh.z);
  out.push(result('mower shed: cut short on the lawn: the door is shut again and the mower is either put away or left clear of the shed', sh.openTo === 0 && (inside() || far > 1.0) && !mw.group.visible === inside(), { openTo: sh.openTo, t4, far, hidden: !mw.group.visible }));
  T.settle(); T.resetRooms(); T.removeAll(); T.settle();
  out.push(result('mower shed: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- The shed works like the skill bookshelf: it holds the yard's things (goal, hoop, balls, chair, bird bath, sky switch, mower) ----
// Put away they are hidden and no longer block anything; an activity that needs one takes it out first; before mowing GUY puts everything
// (all but the mower) away; the long-press list shows what is inside and takes orders; the contents are saved; a removed shed gives them back.
T.sweepShed = () => {
  const out = [], base = errors.length, w = W(), b = B(), y = w.yard;
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('backyard'); R().add('backyard');
  const ids = ['shed', 'mower', 'soccergoal', 'basketballhoop', 'lawnchair', 'birdbath', 'skyswitch'];
  for (const id of ids) T.addObject(id);
  T.learn(['outdoor', 'outdoor.soccer', 'outdoor.basketball']); T.settle();
  const reset = () => { b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; b.using = new Set(); b.ballHeld = false; };
  const keys = () => y.items().map((i) => i.key);
  const allOut = () => { for (const k of y.stowedKeys()) y.unstow(k); };
  const until = (cond, limit) => { let t = 0; while (t < limit && !cond()) { step(0.25); t += 0.25; } return t; };
  const out_ = () => y.items().filter((i) => !i.stowed).map((i) => i.key);
  // 1. the list: eight things, all out in the yard to begin with
  out.push(result('shed: it can hold the goal, the hoop, both balls, the chair, the bird bath, the sky switch and the mower', keys().length === 8 && ['soccergoal', 'basketballhoop', 'ball:soccer', 'ball:basketball', 'lawnchair', 'birdbath', 'skyswitch', 'mower'].every((k) => keys().includes(k)), { keys: keys() }));
  out.push(result('shed: everything starts out in the yard', out_().length === 8, { out: out_() }));
  // (a mower that stands inside the shed, as in older saves and the first version of the shed, counts as put away)
  const mw0 = w.objects.mower, mwHome = { x: mw0.x, z: mw0.z };
  mw0.set(w.objects.shed.x, w.objects.shed.z); step(0.25);
  out.push(result('shed: a mower standing inside the shed (as older saves have it) is put away in it', y.isStowed('mower') && !mw0.group.visible, { out: out_() }));
  y.unstow('mower', mwHome);
  // 2. put away: hidden, not an obstacle, cannot be picked; taken out: back on the grass, solid
  const ch = w.objects.lawnchair, before = { x: ch.x, z: ch.z };
  y.stow('lawnchair');
  out.push(result('shed: a chair put away is hidden and no longer in the way', ch.stowed && !ch.group.visible && !w.obstacles.includes(ch.obstacle), { vis: ch.group.visible }));
  y.stow('ball:soccer');
  out.push(result('shed: a ball put away is hidden and stays where it is put (it does not roll about)', !y.balls.soccer.visible && y.balls.soccer.userData.stowed, {}));
  for (let i = 0; i < 20; i++) step(0.25);
  y.unstow('lawnchair'); y.unstow('ball:soccer');
  out.push(result('shed: taken out again the chair is back, solid, and where it stood; the ball is on the grass', !ch.stowed && ch.group.visible && w.obstacles.includes(ch.obstacle) && Math.hypot(ch.x - before.x, ch.z - before.z) < 0.01 && y.balls.soccer.visible && !y.balls.soccer.userData.stowed, { at: [ch.x, ch.z] }));
  // 3. the contents are saved with the layout and put back after a reload
  y.stow('birdbath'); y.stow('ball:basketball');
  const snap = JSON.parse(JSON.stringify(w.layout.snapshot()));
  y.unstow('birdbath'); y.unstow('ball:basketball');
  w.layout.apply(snap);
  for (let i = 0; i < 4; i++) step(0.25);
  out.push(result('shed: what was put away is saved, and put away again after a reload', snap.stowed.includes('birdbath') && snap.stowed.includes('ball:basketball') && y.isStowed('birdbath') && y.isStowed('ball:basketball'), { saved: snap.stowed, now: y.stowedKeys() }));
  allOut();
  // 4. told to sit in a chair that is in the shed: he takes it out first, sits in it, shuts the shed
  y.stow('lawnchair');
  reset(); T.home(); T.settle();
  const r1 = b.interact('lawnchair');
  const t1 = until(() => !!(b.step && b.step.fx && b.step.fx.chairSit), 200);
  out.push(result('shed: told to sit in the lawn chair while it is in the shed, he takes it out, and sits in it', r1.ok && !y.isStowed('lawnchair') && ch.group.visible && !!(b.step && b.step.fx && b.step.fx.chairSit), { r1, t1, stowed: y.stowedKeys() }));
  // 5. soccer with the goal and the ball both in the shed: both come out, then he really kicks
  reset(); T.home(); T.settle(); allOut(); y.stow('soccergoal'); y.stow('ball:soccer');
  const sh0 = y.score.shots;
  const r2 = b.interact('soccergoal');
  if (b.pendingActivity === 'soccertoss') b.pendingActivity = 'goalshot';            // (a toss counts no shots, and afterwards he is free to do anything: ask for the kicking)
  const t2 = until(() => y.score.shots > sh0, 400);
  const goal = w.objects.soccergoal, ball = y.balls.soccer;
  out.push(result('shed: told to take shots with goal and ball in the shed, he takes both out and kicks at the goal', r2.ok && y.score.shots > sh0 && !y.isStowed('soccergoal') && !y.isStowed('ball:soccer') && goal.group.visible && ball.visible && w.obstacles.includes(goal.obstacle), { r2, t2, shots: y.score.shots - sh0 }));
  // 6. the long-press list shows what is in the shed and takes orders
  reset(); T.home(); T.settle(); allOut(); y.stow('lawnchair'); y.stow('ball:soccer');
  window.__guyOpenShed();
  const menu = document.getElementById('albummenu');
  const rows = [...menu.querySelectorAll('.brow[data-shed]')];
  const rowOf = (k) => rows.find((r) => r.dataset.shed === k);
  out.push(result('shed: the long-press list has a row for each thing, saying which are inside', !menu.hidden && rows.length === 8 && rowOf('lawnchair') && rowOf('lawnchair').dataset.mode === 'out' && rowOf('birdbath').dataset.mode === 'away' && !!menu.querySelector('[data-shed-all]'), { rows: rows.map((r) => r.dataset.shed + ':' + r.dataset.mode) }));
  rowOf('lawnchair').click();
  const t3 = until(() => !y.isStowed('lawnchair') && w.objects.shed.openTo === 0, 200);          // (the last thing he does is shut the door: he may start something else at once, so do not wait for him to be idle)
  out.push(result('shed: tapping a thing that is in the shed has GUY take it out', !y.isStowed('lawnchair') && w.objects.shed.openTo === 0 && t3 < 200, { t3 }));
  window.__guyOpenShed();
  menu.querySelector('[data-shed-all]').click();
  const t4 = until(() => out_().length === 0 && w.objects.shed.openTo === 0, 600);
  const away = out_().length === 0 && w.objects.shed.openTo === 0;
  reset();                                                  // (with the yard tidy he would go and mow on his own: stop him here)
  out.push(result('shed: "Put everything away" has GUY put all of it in the shed (the mower too) and shut the door', away, { t4, out: out_() }));
  const none = b.requestShed('away'), out2 = b.requestShed('out', 'lawnchair');
  out.push(result('shed: told to put away what is already away he says so kindly and does nothing', !none.ok && out2.ok && /already|nothing/i.test(none.message) && !/\b(fail|error|wrong)\b/i.test(none.message), { none }));
  reset(); T.home(); T.settle(); allOut();
  // 7. mowing: first everything but the mower goes into the shed; only then does the mower come out
  y.stow('mower');
  reset(); T.home(); T.settle();
  const r3 = b.interact('mower');
  let cleared = null, after = null, t5 = 0;
  while (t5 < 900 && !after) {
    step(0.25); t5 += 0.25;
    if (cleared === null && !y.isStowed('mower')) cleared = out_().filter((k) => k !== 'mower');         // (what was still out when the mower came out)
    if (cleared !== null && y.isStowed('mower') && w.objects.shed.openTo === 0) after = out_();           // (the mowing is done: the mower is away and the door shut)
  }
  out.push(result('shed: before mowing he puts the goal, hoop, balls, chair, bird bath and sky switch in the shed; only then does the mower come out', r3.ok && cleared !== null && cleared.length === 0, { r3, cleared, t5 }));
  out.push(result('shed: after mowing everything is in the shed and the door is shut', !!after && after.length === 0, { after }));
  reset();
  // 8. with the yard put away, a bird bath order fetches it, and the mow stays possible with the goal and hoop standing in the way
  reset(); T.home(); T.settle(); allOut(); y.stow('mower');
  const sh = w.objects.shed, gl = w.objects.soccergoal;
  const f = sh.local(0, 2.2); gl.set(sh.x + f.x, sh.z + f.z);
  out.push(result('shed: the goal standing right in front of the shed does not stop him mowing (it goes in the shed first)', b.available('mow') === true && b.interact('mower').ok, { avail: b.available('mow') }));
  reset(); T.home(); T.settle();
  // 9. a shed taken out of the yard gives everything back
  y.stow('lawnchair'); y.stow('ball:basketball'); y.stow('soccergoal');
  w.removeObject('shed');
  out.push(result('shed: removing the shed gives back everything that was in it', y.stowedKeys().length === 0 && ch.group.visible && w.obstacles.includes(ch.obstacle) && y.balls.basketball.visible && w.objects.soccergoal.group.visible, { stowed: y.stowedKeys() }));
  T.settle(); T.resetRooms(); T.removeAll(); T.settle();
  out.push(result('shed: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// Things move between rooms only through a door: dragged at a wall they stop at the wall; through the doorway they pass if they are no
// wider than the door; let go in the doorway they go back; the bookshelves never leave his own room. (`world.dragTo` is the drag itself.)
T.sweepDoorMoves = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('workshop'); R().add('workshop');
  T.addObject('lamp'); T.addObject('piano');
  T.settle();
  const dr = w.doors.workshop, bd = dr.shell.bounds;
  // a point `n` metres into the room from the wall line (negative: on GUY's side) and `l` along the wall from the middle of the door
  const P = dr.wall === 'right' ? bd.minX : dr.wall === 'front' ? bd.minZ : bd.maxZ;
  const at = (n, l) => (dr.wall === 'right' ? { x: P + n, z: dr.u + l } : dr.wall === 'front' ? { x: dr.u + l, z: P + n } : { x: dr.u + l, z: P - n });
  const lamp = w.objects.lamp, piano = w.objects.piano;
  const start0 = [lamp, piano].map((o) => o && ({ x: o.x, z: o.z, rot: o.rot }));          // (where the Catalog put them: they go back there, or the sweeps that follow find them elsewhere)
  if (!lamp || !piano) return [result('doormoves: the lamp and the piano could be added', false, { lamp: !!lamp, piano: !!piano })];
  const room = (o) => w.roomIdAt(o.x, o.z);
  const put = (o, q) => { o.set(q.x, q.z); w.beginDrag(o); };
  const sideL = dr.u > 0 ? -2 : 2;
  // 1. dragged straight at a wall (not at the door) it stops at the wall: no jumping into the next room
  let q = at(-1.6, sideL); put(lamp, q);
  w.dragTo(lamp, at(2.4, sideL).x, at(2.4, sideL).z);
  out.push(result('doormoves: dragged straight at the wall away from the door, it stops at the wall (still in GUY\'s room, nothing across it)', room(lamp) === 'main' && w.fits(lamp, lamp.x, lamp.z), { room: room(lamp), at: [lamp.x, lamp.z] }));
  // 2. dragged at the door in one jump it goes through and ends in the room
  q = at(-1.6, 0); put(lamp, q);
  const goal = at(2.4, 0);
  w.dragTo(lamp, goal.x, goal.z);
  w.dropObject(lamp);
  out.push(result('doormoves: dragged at the door it goes through the doorway and stands in the Workshop', room(lamp) === 'workshop' && w.fits(lamp, lamp.x, lamp.z), { room: room(lamp), at: [lamp.x, lamp.z] }));
  // 3. and the same in small pointer steps, and back out again
  q = at(-1.6, 0); put(lamp, q);
  for (let i = 1; i <= 40; i++) { const f = i / 40, pt = at(-1.6 + 4.0 * f, 0); w.dragTo(lamp, pt.x, pt.z); }
  w.dropObject(lamp);
  const inWork = room(lamp) === 'workshop';
  w.beginDrag(lamp);
  for (let i = 1; i <= 40; i++) { const f = i / 40, pt = at(2.4 - 4.0 * f, 0); w.dragTo(lamp, pt.x, pt.z); }
  w.dropObject(lamp);
  out.push(result('doormoves: in small steps too, in through the door and out again', inWork && room(lamp) === 'main' && w.fits(lamp, lamp.x, lamp.z), { inWork, room: room(lamp) }));
  // 4. a thing wider than the door cannot be taken through it (it stops at the wall); turned, it can
  lamp.set(at(-1.6, sideL).x, at(-1.6, sideL).z);                  // (out of the way)
  const wide = (o) => (dr.wall === 'right' ? o.d : o.w);
  let turns = 0; while (wide(piano) <= DOOR_W() && turns < 4) { piano.rotate(1); turns++; }
  const canWide = wide(piano) > DOOR_W();
  put(piano, at(-2.4, 0));
  w.dragTo(piano, at(2.6, 0).x, at(2.6, 0).z); w.dropObject(piano);
  const stoppedWide = room(piano) === 'main';
  while (wide(piano) > DOOR_W() && turns < 8) { piano.rotate(1); turns++; }
  const narrowOk = wide(piano) <= DOOR_W();
  put(piano, at(-2.4, 0));
  w.dragTo(piano, at(2.6, 0).x, at(2.6, 0).z); w.dropObject(piano);
  out.push(result('doormoves: the piano wider than the door stops at the wall; turned to fit the door it goes through', canWide && stoppedWide && narrowOk && room(piano) === 'workshop', { canWide, stoppedWide, narrowOk, room: room(piano), w: piano.w, d: piano.d }));
  // 5. let go in the doorway: it goes back to the last place it could stand
  put(lamp, at(-1.6, 0));
  w.dragTo(lamp, at(0, 0).x, at(0, 0).z);                       // (on the wall line: in the doorway)
  const inDoor = !w.fits(lamp, lamp.x, lamp.z);
  w.dropObject(lamp);
  out.push(result('doormoves: let go in the doorway it is put back where it could stand', inDoor && w.fits(lamp, lamp.x, lamp.z), { inDoor, at: [lamp.x, lamp.z] }));
  // 6. the bookshelf never leaves GUY's room, not even through the door
  piano.set(at(-2.4, sideL).x, at(-2.4, sideL).z);              // (the piano out of the Workshop, so the lamp has free floor to be tried on)
  piano.rot = 0; piano.set(piano.x, piano.z);                    // (turned the way it was: a piano left turned breaks the sweeps that follow)
  const shelf = w.objects.shelf, g0 = at(0, 0), mid = at(1.8, 0);
  out.push(result('doormoves: the bookshelf may not stand in the Workshop (a lamp may), nor pass the doorway', !!shelf && shelf.mainOnly && !w.fits(shelf, mid.x, mid.z) && w.fits(lamp, mid.x, mid.z) && !w.canTransit(shelf, g0.x, g0.z) && w.canTransit(lamp, g0.x, g0.z), { mainOnly: shelf && shelf.mainOnly }));
  const sx = shelf.x, sz = shelf.z; w.beginDrag(shelf);
  w.dragTo(shelf, sx + 20, sz); w.dragTo(shelf, sx, sz + 20); w.dragTo(shelf, sx - 20, sz); w.dragTo(shelf, sx, sz - 20); w.dropObject(shelf);
  out.push(result('doormoves: dragged hard in every direction the bookshelf stays in GUY\'s room', room(shelf) === 'main', { room: room(shelf) }));
  shelf.set(sx, sz);                                             // (back where it stood: other sweeps expect the bookshelf there)
  [lamp, piano].forEach((o, i) => { o.rot = start0[i].rot; o.set(start0[i].x, start0[i].z); });
  // 7. nothing in the game moves a thing through a wall: GUY rearranges only his own room's things
  T.settle(); T.resetRooms(); T.removeAll(); T.settle();
  out.push(result('doormoves: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};
const DOOR_W = () => W().DOOR.w;

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
  const reset = () => { b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; b.using = new Set(); b.stayRoom = null; };
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
  const rmBtn = after && after.querySelector('.act');
  out.push(result('rooms: the Workshop then shows "In your home" with a Remove room button and no Add button', !!after && /In your home/.test(after.textContent) && !!rmBtn && rmBtn.textContent === 'Remove room', { text: after && after.textContent }));
  const e = w.extent(), v = new THREE.Vector3();
  let inView = true;
  for (const x of [e.minX, e.maxX]) for (const y of [0, 3.2]) for (const z of [e.minZ, e.maxZ]) { v.set(x, y, z).project(window.camera); if (Math.abs(v.x) > 1.001 || Math.abs(v.y) > 1.001) inView = false; }
  out.push(result('rooms: the camera frames the main room and the Workshop together', (e.maxX - e.minX) * (e.maxZ - e.minZ) > 80 && inView, { extent: e }));
  const twice = R().add('workshop');
  messages.push(...twice.messages);
  out.push(result('rooms: adding the Workshop again does nothing, and says so kindly', !twice.ok && twice.already && Object.keys(w.doors).length === 1 && friendly(twice.messages), { twice }));
  R().reset('workshop');
  out.push(result('rooms: taking the room away removes the door and its room, and the camera frames the main room again',
    !Object.keys(w.doors).length && !w.room.children.includes(door.group) && !w.room.children.includes(door.shell.group) && w.extent().maxX === 5 && w.extent().minZ === -5));
  // the Shooting Range and the Bowling Alley are as wide as any other room on the same wall (a wall of GUY's room is 10 m or 8 m long)
  {
    const widths = {};
    for (const wall of ['front', 'right']) for (const id of ['workshop', 'range', 'bowling']) {
      T.resetRooms(); R().add(id, { walls: [wall] });
      widths[`${id}@${wall}`] = w.doors[id] && +w.doors[id].shell.L.toFixed(2);
    }
    T.resetRooms();
    out.push(result('rooms: the Shooting Range and the Bowling Alley are as wide as the Workshop on the same wall',
      ['front', 'right'].every((wl) => widths[`workshop@${wl}`] > 0 && widths[`range@${wl}`] === widths[`workshop@${wl}`] && widths[`bowling@${wl}`] === widths[`workshop@${wl}`]), widths));
  }
  // taking a room away from the Catalog: two taps (the first asks), the room and its door go, its furniture goes back to the Catalog
  {
    unlockRoom('workshop'); R().add('workshop'); T.settle(); T.home();
    T.addObject('toolbox');
    const tb = w.objects.toolbox, bd = w.doors.workshop.shell.bounds;
    if (tb) tb.set((bd.minX + bd.maxX) / 2, (bd.minZ + bd.maxZ) / 2);
    m = openTab('rooms');
    machineCard('Workshop').querySelector('.act').click();
    const asked = machineCard('Workshop').querySelector('.act');
    const still = !!w.doors.workshop;
    asked.click(); step(0.1);
    const toastRm = document.getElementById('toast').textContent;
    messages.push(toastRm);
    m = openTab('rooms');
    const back = machineCard('Workshop'), backBtn = back && back.querySelector('.act');
    out.push(result('rooms: Remove room asks first (Tap to confirm), then takes the room and its door away and says so',
      still && asked.textContent === 'Tap to confirm' && !w.doors.workshop && !R().isAdded('workshop') && /removed/.test(toastRm) && !!backBtn && backBtn.textContent === 'Add to my home', { asked: asked.textContent, toastRm }));
    out.push(result('rooms: the furniture of a removed room goes back to the Catalog, not lost', !w.objects.toolbox && !!w.removed.toolbox, { inRoom: !!w.objects.toolbox, removed: !!w.removed.toolbox }));
    R().add('workshop'); T.settle();
    out.push(result('rooms: added again, its furniture can be put back from the Catalog', !!w.removed.toolbox && W().catalogOps.status('toolbox') === 'removed', { status: W().catalogOps.status('toolbox') }));
    // GUY is in the room when it is removed: he walks out through the door first (nobody is moved by magic), then it goes
    const b = window.brain;
    b.unlock(false); b.queue = []; b.step = null;
    b.visitRoom('workshop');
    let t = 0; while (t < 60 && b.hereId() !== 'workshop') { step(0.25); t += 0.25; }
    const wasIn = b.hereId() === 'workshop';
    const res = R().remove('workshop');
    messages.push(...res.messages);
    const waiting = res.waiting && !!w.doors.workshop && R().isClosing('workshop') && !R().snapshot().rooms.workshop;
    let t2 = 0, jump = 0; const path = [], door = w.doorPoint('workshop', 0);
    let near = 9, last = b.g.root.position.clone();
    while (t2 < 90 && w.doors.workshop) {
      step(0.1); t2 += 0.1;
      const p = b.g.root.position;
      path.push(w.roomIdAt(p.x, p.z)); jump = Math.max(jump, p.distanceTo(last)); last = p.clone();
      near = Math.min(near, Math.hypot(p.x - door.x, p.z - door.z));
    }
    out.push(result('rooms: removed while GUY is in it, he walks out through the door first and then the room goes', wasIn && waiting && /coming out/.test(res.messages[0]) && !w.doors.workshop && b.inMain() && near < 0.4 && jump < 0.3, { wasIn, waiting, res, t2, near, jump, room: b.hereId() }));
    T.settle(); T.home();
    delete w.removed.toolbox;                                       // (the room is gone: the toolbox is not kept for later tests)
  }
  T.resetRooms();
  const none = R().add('workshop', { walls: [] });
  messages.push(...none.messages);
  out.push(result('rooms: with no wall free it explains, and nothing changes', !none.ok && friendly(none.messages) && !Object.keys(w.doors).length && Object.keys(w.removed).length === before.size, { none }));
  out.push(result('rooms: every message is short and kind', friendly(messages.filter(Boolean)), { messages }));
  // four rooms fill all four walls (the left one beside the Catalog); the Restaurant never takes the left wall
  T.resetRooms();
  R().setUnlocked('restaurant', true);
  const four = ['restaurant', 'backyard', 'range', 'workshop'].map((id) => R().add(id));
  const sides = Object.values(w.doors).map((d) => d.wall).sort().join();
  const clearOfCatalog = Object.values(w.doors).every((d) => d.wall !== 'left' || d.u - w.DOOR.w / 2 >= w.MACHINE_RECT.u1 || d.u + w.DOOR.w / 2 <= w.MACHINE_RECT.u0);
  out.push(result('rooms: four rooms get a door each on all four walls, the left one clear of the Catalog, and the Restaurant is not on the left',
    four.every((r) => r.ok) && sides === 'back,front,left,right' && clearOfCatalog && w.doors.restaurant.wall !== 'left' && Object.values(w.doors).every((d) => !doorProblems(d.id).length), { sides, four: four.map((r) => r.ok) }));
  // more than four rooms: each room hangs off a wall of GUY's room and only one room fits a wall, so a fifth has no place. It must be
  // refused cleanly (a message, nothing added, nothing moved) and no two rooms may overlap. The four corner areas beside the rooms stay
  // empty ground: no room is built there, so there is no room with two neighbours and no door between two added rooms.
  {
    const bs = Object.values(w.doors).map((d) => ({ id: d.id, ...d.shell.bounds }));
    const overlap = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], c = bs[j]; if (a.minX < c.maxX && c.minX < a.maxX && a.minZ < c.maxZ && c.minZ < a.maxZ) overlap.push([a.id, c.id]); }
    const mainHalf = { x: ROOM_MAIN.w / 2, z: ROOM_MAIN.d / 2 };
    const inCorner = bs.filter((b) => (b.minX > mainHalf.x - 1e-6 || b.maxX < -mainHalf.x + 1e-6) && (b.minZ > mainHalf.z - 1e-6 || b.maxZ < -mainHalf.z + 1e-6)).map((b) => b.id);
    out.push(result('rooms: four rooms never overlap and none is built in a corner area (a corner room is only there when it is added: see sweepCorners)', !overlap.length && !inCorner.length, { overlap, inCorner }));
    ROOM_CATALOG.push({ ...ROOM_CATALOG[0], id: 'qa-fifth', name: 'QA Fifth' });
    const doorsBefore = Object.keys(w.doors).join(), toastBefore = document.getElementById('toast').textContent;
    const fifth = R().add('qa-fifth');
    ROOM_CATALOG.pop();
    out.push(result('rooms: a fifth room is refused with a message, and no door is added or moved', !fifth.ok && /No clear wall/.test(fifth.messages[0]) && friendly(fifth.messages) && fifth.messages.filter((m) => /wall has the/.test(m)).length === 4 && Object.keys(w.doors).join() === doorsBefore && !w.doors['qa-fifth'], { fifth, doorsBefore, now: Object.keys(w.doors).join() }));
  }
  T.resetRooms(); putBackSince(before); machine().hidden = true;
  out.push(result('rooms: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 10b. Removing a room (rooms.remove), the parts sweepRooms does not cover: a rug on its floor and the corner rooms that open through it ----
T.sweepRoomRemoval = () => {
  const lostPlant = (() => {                              // (a test's own reset of a room must not destroy what his room came with: later sweeps then had no plant)
    const w = W(); T.resetRooms(); T.removeAll(); T.settle(); T.home(); R().add('workshop', { walls: ['right'] }); T.addObject('plant');
    const o = w.objects.plant, c = w.roomSpot('workshop'), at = w.findSpot(o, c, null); o.home = { x: at.x, z: at.z }; o.set(at.x, at.z);
    const inside = w.roomIdAt(o.x, o.z); R().reset('workshop');
    const kept = !!w.removed.plant, back = T.addObject('plant'), p = w.objects.plant;
    const r = { inside, kept, back, room: p && w.roomIdAt(p.x, p.z) }; T.removeAll(); T.resetRooms(); return r;
  })();
  const out = [], base = errors.length, w = W();
  out.push(result('room removal: a test reset of a room his plant stands in leaves the plant in the Catalog, and it can be put back in his room', lostPlant.inside === 'workshop' && lostPlant.kept && lostPlant.back && lostPlant.room === 'main', lostPlant));
  T.resetRooms(); T.settle(); T.home();
  const before = new Set(Object.keys(w.removed));
  unlockRoom('workshop'); R().add('workshop');
  unlockRoom('library'); R().add('library');                                           // (a corner room: opens through the Workshop when it is beside one)
  const kid = !!w.doors.library && w.doors.library.parent === 'workshop';
  T.addObject('rug');
  const rug = w.decor.rug, bd = w.doors.workshop.shell.bounds;
  if (rug) rug.set((bd.minX + bd.maxX) / 2, (bd.minZ + bd.maxZ) / 2);                   // a rug laid on the Workshop's floor
  const rugIn = !!rug && w.roomIdAt(rug.u, rug.v) === 'workshop';
  const res = R().remove('workshop');
  let t = 0; while (t < 30 && w.doors.workshop) { step(0.25); t += 0.25; }               // (waits only if a robot happened to be in there)
  out.push(result('room removal: the room, its door and walls are gone', !R().isAdded('workshop') && !w.doors.workshop && w.extent().maxX === 5, { res, doors: Object.keys(w.doors) }));
  out.push(result('room removal: a rug on its floor goes back to the Catalog too, not left floating', rugIn && !w.decor.rug && !!w.removed.rug, { rugIn, inRoom: !!w.decor.rug, removed: !!w.removed.rug }));
  if (kid) out.push(result('room removal: the Library that opened through it goes too', !w.doors.library && !R().isAdded('library')));
  const gone = R().remove('workshop');
  out.push(result('room removal: removing a room that is not in the home does nothing', !gone.ok && !w.doors.workshop));
  T.resetRooms(); putBackSince(before); machine().hidden = true;
  out.push(result('room removal: no errors', errors.length === base, { errors: errors.slice(base) }));
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
    // every added room is as big as GUY's room: the same width (x) and the same depth (z), whichever wall the door is on
    const sb = res.ok ? w.doors.workshop.shell.bounds : null;
    out.push(result(`doors: ${wall} wall: the room behind it has the same width and depth as GUY's room`, !res.ok || (near(sb.maxX - sb.minX, 10) && near(sb.maxZ - sb.minZ, 10)), { bounds: sb }));
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
  // 0. an old save with too many built things in storage (13 foot stools) or kinds that are not built any more (the old shelves) is brought into line
  { const keep = JSON.stringify(w.stock.items), snap = clone(L().snapshot());
    snap.stock = { items: { footstool: 13, builtchair: 9, woodshelves: 4, mystery: 2, eguitar: 1 }, coins: 0 };
    L().apply(snap);
    const it = w.stock.items;
    out.push(result('layout: saved storage obeys the Workshop limits (one foot stool, three chairs), and the retired shelves and unknown kinds are dropped', it.footstool === 1 && it.builtchair === 3 && it.eguitar === 1 && !it.woodshelves && !it.mystery, { it }));
    w.stock.items = JSON.parse(keep); w.syncStock(); }
  // 1. a snapshot is stable, and survives being written out as JSON and read back
  const s0 = JSON.stringify(L().snapshot());
  out.push(result('layout: a snapshot of an unchanged room is the same every time', s0 === JSON.stringify(L().snapshot()) && s0 === JSON.stringify(JSON.parse(s0))));
  // 2. move, turn and remove things the way the user and GUY do
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
  // 7c. pieces in walls: GUY's shoving never leaves one there, a saved one is put back on the floor, and one stuck there can still be dragged out
  { if (!R().isAdded('workshop')) { unlockRoom('workshop'); R().add('workshop'); }
    T.addObject('chair'); T.settle();
    const ch = w.objects.chair, b = B(), home = { x: ch.x, z: ch.z }, room = { fr: w.frameOf('workshop'), bd: w.doors.workshop.shell.bounds };
    let plans = 0; const bad = [];
    for (const [cx, cz] of [[4.4, -2.6], [4.4, 2.4], [-4.4, 2.4], [2, 3.4], [2, -3.4], [5.6, 0.2], [5.6, 3.4], [14.4, 0]]) {
      if (!w.fits(ch, cx, cz)) continue;
      ch.set(cx, cz);
      for (const d of [0.8, 1.2, 1.6]) for (let k = 0; k < 8; k++) for (const rm of [room, null]) {
        const p = b.planPush(ch, cx + Math.cos(k * Math.PI / 4) * d, cz + Math.sin(k * Math.PI / 4) * d, null, rm);
        if (!p) continue;
        plans++;
        const ends = p.filter((st) => st.push).map((st) => [st.x + st.push.relx, st.z + st.push.relz]);
        if (ends.some(([x, z]) => !w.wallOk(ch, x, z)) || !w.insideRoom(ch, ...ends.at(-1))) bad.push([cx, cz, ends.at(-1).map((v) => +v.toFixed(2))]);
      }
    }
    out.push(result('layout: GUY shoving a chair out of his way (near the walls, in both rooms) never leaves it half in a wall', plans > 0 && !bad.length, { plans, bad: bad.slice(0, 4) }));
    const wd = w.doors.workshop, stuckAt = { x: 5.0, z: Math.abs(wd.u - 2.6) > 1.2 ? 2.6 : -2.6 };          // (on the wall line, away from the door)
    ch.set(stuckAt.x, stuckAt.z);
    const snap = clone(L().snapshot()); L().apply(clone(snap));
    out.push(result('layout: a saved chair standing in a wall is put back on a floor when the game loads', w.insideRoom(ch, ch.x, ch.z) && w.fits(ch, ch.x, ch.z), { at: [ch.x, ch.z] }));
    ch.set(stuckAt.x, stuckAt.z);
    w.beginDrag(ch); for (let i = 0; i < 30; i++) w.dragTo(ch, stuckAt.x - 1.2, stuckAt.z); w.dropObject(ch);
    out.push(result('layout: a chair stuck in a wall can be dragged out of it', w.insideRoom(ch, ch.x, ch.z) && w.fits(ch, ch.x, ch.z), { at: [+ch.x.toFixed(2), +ch.z.toFixed(2)] }));
    ch.set(home.x, home.z);
    R().reset('workshop'); }
  // 8. GUY stands on a free spot even if the saved layout has furniture where he starts
  G().root.position.set(w.objects.armchair.x, 0, w.objects.armchair.z);
  const moved = L().unstickGuy();
  const gp = G().pos;
  out.push(result('layout: GUY never starts inside furniture', moved && !w.obstacles.some((o) => gp.x > o.x0 - 0.4 && gp.x < o.x1 + 0.4 && gp.z > o.z0 - 0.4 && gp.z < o.z1 + 0.4)));
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
  out.push(result('shelf: the stack is beside the shelf, inside the room and clear of furniture', !!l && Math.abs(stack[0].z) > 1.15 && Math.abs(l.x) < 4.7 && Math.abs(l.z) < 4.6 && w.obstacles.some((o) => o.name === 'bookstack'), { l }));
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
  // GUY reads the top book of the stack, squatting to it, and puts it back on top
  const top = sh.stackTop(), topY = top.mesh.position.y;
  b.forgetBook && skillsOf().known.delete(top.def.teaches);
  b.requestRead(top.def.id);
  let t = 0, held = false, squatted = false, deepest = 0;
  while (t < 120) {
    step(0.25); t += 0.25;
    if (b.held === top) held = true;
    if (b.held === top && b.pose === 'grab' && b.step && b.step.t > 0.6 && b.step.t < 1.2) { const lg = b.g.bones.RightLeg && b.g.bones.RightLeg.rotation.x; deepest = Math.max(deepest, Math.abs(lg) || 0); if (Math.abs(lg) > 0.15) squatted = true; }      // (0.15: the stack is taller with the blaster and bowling books on it, so the top one needs less squatting)
    if (held && !b.held && top.mesh.visible && t > 15) break;
  }
  out.push(result('shelf: GUY reads the top book of the stack and puts it back where it was', held && top.mesh.visible && Math.abs(top.mesh.position.y - topY) < 0.005 && b.skills.has(top.def.teaches), { held, back: top.mesh.visible, t }));
  out.push(result('shelf: he squats down to take it from the floor stack', squatted, { deepest }));
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

// ---- 17. Doors: long-press a door and GUY goes in (src/room.js doors, brain.js visit / leave) -------------------------------------
// ---- Corner rooms: no wall of GUY's room of their own, a door in the side wall of the room beside them (room.js planCorner, rooms.js) ----
T.sweepCorners = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  T.resetRooms(); T.removeAll(); T.settle(); T.home();
  const before = new Set(Object.keys(w.removed));
  const overlaps = () => {
    const bs = [{ id: 'main', minX: -ROOM_MAIN.w / 2, maxX: ROOM_MAIN.w / 2, minZ: -ROOM_MAIN.d / 2, maxZ: ROOM_MAIN.d / 2 }, ...Object.values(w.doors).map((d) => ({ id: d.id, ...d.shell.bounds }))], bad = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const p = bs[i], q = bs[j]; if (p.minX < q.maxX - 1e-6 && q.minX < p.maxX - 1e-6 && p.minZ < q.maxZ - 1e-6 && q.minZ < p.maxZ - 1e-6) bad.push([p.id, q.id]); }
    return bad;
  };
  // 1. a corner has no wall of its own, but no room needs another: with no room beside a corner the room gets an ordinary door on GUY's room
  const lone = R().add('library');
  const ld = w.doors.library;
  out.push(result('corners: with no room beside a corner the room is still added, on a wall of GUY\'s room (it does not need the Workshop)', lone.ok && !!ld && ld.parent === 'main' && !lone.parent && !/workshop/i.test(lone.messages.join(' ')), { lone }));
  R().reset('library'); T.settle();
  out.push(result('corners: taking that room away leaves nothing behind', !Object.keys(w.doors).length, { doors: Object.keys(w.doors) }));
  // 2. the Workshop on the right wall touches two corners: each gets its door in the side wall of the Workshop
  const wk = R().add('workshop', { walls: ['right'] });
  const lib = R().add('library'), bed = R().add('bedroom');
  const dw = w.doors.workshop, dl = w.doors.library, db = w.doors.bedroom;
  out.push(result('corners: the Library and the Bedroom are added in the two corners beside the Workshop', wk.ok && lib.ok && bed.ok && !!dl && !!db && dl.parent === 'workshop' && db.parent === 'workshop', { wk: wk.ok, lib, bed }));
  if (!dl || !db) { T.resetRooms(); return out; }
  const eq = (p, q) => Math.abs(p - q) < 1e-6;
  out.push(result('corners: each corner room fills its whole corner, 10 x 10 like the others, and no room overlaps another', eq(dl.shell.bounds.minX, 5) && eq(dl.shell.bounds.maxX, 15) && eq(dl.shell.bounds.minZ, -15) && eq(dl.shell.bounds.maxZ, -5)
    && eq(db.shell.bounds.minX, 5) && eq(db.shell.bounds.maxX, 15) && eq(db.shell.bounds.minZ, 5) && eq(db.shell.bounds.maxZ, 15) && !overlaps().length, { l: dl.shell.bounds, b: db.shell.bounds, overlaps: overlaps() }));
  out.push(result('corners: each door is in the Workshop\'s side wall, in the middle stretch the two rooms share, with nothing in the way', !doorProblems('library').length && !doorProblems('bedroom').length && dl.wall !== db.wall && w.doors.workshop.shell.sides[dl.wall.split(':')[1]].visible === false && w.doors.workshop.shell.sides[db.wall.split(':')[1]].visible === false, { l: dl.wall, b: db.wall, pl: doorProblems('library'), pb: doorProblems('bedroom') }));
  // 3. the doorway: the way through only while the door is open
  const probe = { w: 0.5, d: 0.5, obstacle: null };
  for (const id of ['library', 'bedroom']) {
    const d = w.doors[id], at = (n, lat = 0) => { const p = w.doorPoint(id, n); const t = w.shellAxes(id).lat; return { x: p.x + t.x * lat, z: p.z + t.z * lat }; };
    const mid = at(0), off = at(0, 2.5), inRoom = at(-3), beside = at(0.9);
    out.push(result(`corners: ${id}: a thing can be moved through the doorway but not through the wall beside it`, w.canTransit(probe, mid.x, mid.z) && !w.canTransit(probe, off.x, off.z) && w.canTransit(probe, inRoom.x, inRoom.z) && w.canTransit(probe, beside.x, beside.z), { mid, off }));
    out.push(result(`corners: ${id}: the doorway is walkable only when the door is open`, !w.walkable(mid.x, mid.z) && (w.setDoorOpen(id, true), step(1.2), w.walkable(mid.x, mid.z)) && (w.setDoorOpen(id, false), step(1.2), !w.walkable(mid.x, mid.z)), { open: d.open }));
    out.push(result(`corners: ${id}: a point inside is in that room, and the doorway is neither room`, w.roomIdAt(inRoom.x, inRoom.z) === id && w.roomIdAt(beside.x, beside.z) === 'workshop' && w.roomIdAt(mid.x, mid.z) === 'door', { a: w.roomIdAt(inRoom.x, inRoom.z), b: w.roomIdAt(beside.x, beside.z), c: w.roomIdAt(mid.x, mid.z) }));
  }
  // 4. the others have no neighbour that can have a door: each still gets an ordinary door on a free wall of GUY's room
  const gar = R().add('garage'), gm = R().add('gameroom');
  out.push(result('corners: the Garage (no room beside a free corner) gets a door on GUY\'s room, and the Game Room is added too (in a corner beside the Garage)', gar.ok && gm.ok && !!w.doors.garage && !!w.doors.gameroom && w.doors.garage.parent === 'main' && !overlaps().length, { gar, gm }));
  R().reset('garage'); R().reset('gameroom'); T.settle();
  // 5. GUY goes in through the Workshop, looks round and comes back, shutting both doors behind him
  const trip = (id) => {
    const rooms = [], bad = [];
    const msg = b.visitRoom(id);
    let t = 0, inside = false;
    while (t < 200) {
      step(0.25); t += 0.25;
      const r = w.roomIdAt(g.pos.x, g.pos.z);
      if (rooms[rooms.length - 1] !== r) rooms.push(r);
      if (!w.walkable(g.pos.x, g.pos.z) && !w.inMain(g.pos.x, g.pos.z)) bad.push(`${g.pos.x.toFixed(1)},${g.pos.z.toFixed(1)}`);
      if (r === id) inside = true;
      if (inside && r === 'main' && Object.values(w.doors).every((d) => d.open === 0)) break;               // (back in his own room with both doors shut: before he thinks of anything else)
    }
    return { msg, rooms, bad, t, inside };
  };
  for (const id of ['library', 'bedroom']) {
    const tr = trip(id);
    const order = tr.rooms.filter((r) => r !== 'door');
    out.push(result(`corners: ${id}: he goes in through the Workshop (main, Workshop, ${id}), looks round and comes back by the same way`, tr.msg.ok && order.join() === ['main', 'workshop', id, 'workshop', 'main'].join() && b.inMain(), { rooms: tr.rooms, t: tr.t }));
    out.push(result(`corners: ${id}: both doors are shut behind him and he never stood where he should not`, Object.values(w.doors).every((d) => d.open === 0) && !tr.bad.length, { open: Object.values(w.doors).map((d) => `${d.id}:${d.open}`), bad: tr.bad.slice(0, 5) }));
  }
  // 6. asked for from inside the Workshop: straight in, not out and in again
  b.visitRoom('workshop');
  { let t = 0; while (t < 80 && b.hereId() !== 'workshop') { step(0.25); t += 0.25; } step(1); }
  const direct = b.visitRoom('library');
  { let t = 0, seen = new Set(); while (t < 80) { step(0.25); t += 0.25; seen.add(w.roomIdAt(g.pos.x, g.pos.z)); if (b.hereId() === 'library') break; } out.push(result('corners: asked for the Library while he is in the Workshop, he goes straight in without going home first', direct.ok && /going into/i.test(direct.message) && seen.has('library') && !seen.has('main'), { direct, seen: [...seen] })); }
  // 7. locked doors: the Library door locked keeps him out; shut in, he is shut in the Library, not the Workshop
  b.visitRoom('library'); step(0.5);
  b.skip(); T.home();
  R().setDoorLocked('library', true);
  const refused = b.visitRoom('library');
  out.push(result('corners: a locked corner door keeps him out and says so', !refused.ok && /locked/i.test(refused.message), { refused }));
  R().setDoorLocked('library', false);
  b.visitRoom('library');
  { let t = 0; while (t < 120 && b.hereId() !== 'library') { step(0.25); t += 0.25; } }
  step(2);
  R().setDoorLocked('library', true);
  out.push(result('corners: locked while he is inside, he is shut in the Library (and not the Workshop)', b.stuckIn() === 'library', { stuck: b.stuckIn(), here: b.hereId() }));
  R().setDoorLocked('library', false);
  { let t = 0; while (t < 200 && !b.inMain()) { step(0.25); t += 0.25; } }
  out.push(result('corners: unlocked, he leaves through the Workshop to his own room', b.inMain(), { here: b.hereId() }));
  // the Workshop's own door locked while he is in the Library: he can get as far as the Workshop, and is shut in there
  b.visitRoom('library');
  { let t = 0; while (t < 120 && b.hereId() !== 'library') { step(0.25); t += 0.25; } }
  step(2);
  R().setDoorLocked('workshop', true);
  out.push(result('corners: with only the Workshop door locked he cannot get home from the Library, but the way to the Workshop is open', b.stuckIn() === 'library' && b.canReach('workshop') && !b.canReach('main'), { stuck: b.stuckIn(), reach: [...b.roomsInReach()] }));
  b.skip(); b.visitRoom('workshop');
  { let t = 0; while (t < 200 && b.hereId() !== 'workshop') { step(0.25); t += 0.25; } step(3); }
  out.push(result('corners: he comes out of the Library into the Workshop and is shut in there', b.stuckIn() === 'workshop', { stuck: b.stuckIn(), here: b.hereId() }));
  R().setDoorLocked('workshop', false);
  { let t = 0; while (t < 200 && !b.inMain()) { step(0.25); t += 0.25; } }
  out.push(result('corners: unlocked, he gets home', b.inMain(), { here: b.hereId() }));
  // 8. something that stands in the Library: he goes in through the Workshop to use it, and comes back out
  T.addObject('piano');
  const pi = w.objects.piano, lb = dl.shell.bounds, PIANO = ['plink', 'piano', 'sitpiano'];
  pi.set((lb.minX + lb.maxX) / 2, (lb.minZ + lb.maxZ) / 2 - 0.8);
  b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; b.stayRoom = null; T.home(); T.settle();
  const ri = b.interact('piano');
  let tt = 0, played = false; const went = new Set();
  while (tt < 200) { step(0.25); tt += 0.25; const r = w.roomIdAt(g.pos.x, g.pos.z); went.add(r); if (r === 'library' && PIANO.includes(b.last) && b.step) { played = true; break; } }
  out.push(result('corners: a piano in the Library: he goes in through the Workshop and plays it there', ri.ok && played && went.has('workshop'), { ri, went: [...went], last: b.last }));
  b.skip(); b.queue = []; b.step = null; b.pendingActivity = 'leave';
  let home = false;
  { let t = 0; while (t < 200 && !home) { step(0.25); t += 0.25; home = w.roomIdAt(g.pos.x, g.pos.z) === 'main' && Object.values(w.doors).every((d) => d.open === 0); } }
  out.push(result('corners: he comes back out through both doors and shuts them', home && Object.values(w.doors).every((d) => d.open === 0), { here: b.hereId(), open: Object.values(w.doors).map((d) => `${d.id}:${d.open}`) }));
  pi.set(-2.5, -2.4);
  // 9. saved with the rooms, and a corner room comes back whatever order they are read in
  const snap = R().snapshot();
  out.push(result('corners: the save records the corner and the room its door is in', snap.rooms.library && snap.rooms.library.parent === 'workshop' && snap.rooms.library.corner === 'right-back' && snap.rooms.bedroom.corner === 'right-front' && !snap.rooms.workshop.parent, { snap }));
  const dlWall = dl.wall, dlU = dl.u;
  T.resetRooms();
  out.push(result('corners: taking the Workshop away takes the rooms behind it too (and their walls whole again)', !Object.keys(w.doors).length, { doors: Object.keys(w.doors) }));
  const reversed = { rooms: { bedroom: snap.rooms.bedroom, library: snap.rooms.library, workshop: snap.rooms.workshop } };
  const res = R().restoreFrom(reversed);
  const back = w.doors.library;
  out.push(result('corners: restoring puts the Workshop back first, then both corner rooms where they were', res.every((r) => r.ok) && !!back && back.wall === dlWall && back.u === dlU && !!w.doors.bedroom && !overlaps().length, { res }));
  // 10. taking only a corner room away puts the Workshop's wall back whole
  R().reset('library');
  out.push(result('corners: taking a corner room away puts the side wall back whole', !w.doors.library && w.doors.workshop.shell.sides[dlWall.split(':')[1]].visible === true && !!w.doors.bedroom, { visible: w.doors.workshop.shell.sides[dlWall.split(':')[1]].visible }));
  // 11. the Shooting Range takes a corner room's door in its side wall, clear of the blaster case, the controller and the scoreboard
  const walkTo = (id) => {                                   // he goes in (main, the room beside it, the corner room) and back again: the rooms he passed through
    T.home(); b.queue = []; b.step = null;
    const r = b.visitRoom(id), seen = [];
    let t = 0;
    while (t < 160) { step(0.25); t += 0.25; const h = w.roomIdAt(g.pos.x, g.pos.z); if (h !== 'door' && seen[seen.length - 1] !== h) seen.push(h); if (b.hereId() === id) break; }
    return { ok: !!(r && r.ok), seen, t };
  };
  {
    T.resetRooms(); T.home();
    R().add('range', { walls: ['front'] });
    const gr = R().add('bedroom');
    const d = w.doors.bedroom, pad = (o) => ({ x0: o.x0 - 0.2, x1: o.x1 + 0.2, z0: o.z0 - 0.2, z1: o.z1 + 0.2 });
    const hits = d ? w.range.obstacles.filter((o) => { const p = pad(o); return [d.rect, d.rectIn].some((r) => r.x1 > p.x0 && r.x0 < p.x1 && r.z1 > p.z0 && r.z0 < p.z1); }).map((o) => o.name || 'screen') : ['no door'];
    out.push(result('corners: beside the Shooting Range a corner room gets its door in the Range\'s side wall, where nothing of the Range stands', gr.ok && !!d && d.parent === 'range' && /^range:[ab]$/.test(d.wall) && !hits.length && !overlaps().length, { gr, wall: d && d.wall, hits }));
    const tr = walkTo('bedroom');
    out.push(result('corners: he gets to it through the Range (main, Range, Bedroom)', tr.ok && tr.seen.join() === ['main', 'range', 'bedroom'].join(), tr));
  }
  // 12. the Backyard's side fences take a gate into a corner room (the fence is cut round it; a fence is still no place for a picture)
  {
    T.resetRooms(); T.home();
    R().add('backyard', { walls: ['left'] });
    const gl = R().add('library');
    const d = w.doors.library, yard = w.doors.backyard;
    const side = d && d.wall.split(':')[1];
    out.push(result('corners: beside the Backyard a corner room gets a garden gate in the side fence, and the fence there is cut round it', gl.ok && !!d && d.parent === 'backyard' && /^backyard:[ab]$/.test(d.wall) && d.gate && yard.shell.sides[side].visible === false && d.cut.children.length >= 2 && !overlaps().length, { gl, wall: d && d.wall, gate: d && d.gate }));
    out.push(result('corners: the fences are not walls to hang a painting on', !w.hangWalls().some((h) => h.key.startsWith('backyard:')), { walls: w.hangWalls().map((h) => h.key) }));
    const tr = walkTo('library');
    out.push(result('corners: he gets to it across the lawn and through the gate (main, Backyard, Library)', tr.ok && tr.seen.join() === ['main', 'backyard', 'library'].join(), tr));
    R().reset('library');
    out.push(result('corners: taking that room away puts the fence back whole', !w.doors.library && yard.shell.sides[side].visible === true));
  }
  T.resetRooms(); T.home(); T.removeAll(); putBackSince(before); T.settle(); machine().hidden = true;
  out.push(result('corners: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- The Restaurant with no free wall (rooms.js explainNoWall, offerFor; machine.js roomOffer) ----
// Every wall it can use (front, back, right) taken by a room: the Catalog says which room has which wall, and nothing changes. Only things
// that can come out of GUY's room in the way (a window, a picture): its card asks first, "Not now" leaves everything as it was, "Remove and
// add" takes exactly those out and adds it. A clear wall: added at once, no question.
T.sweepRestaurantWall = () => {
  const out = [], base = errors.length, w = W(), toast = () => document.getElementById('toast').textContent;
  const fakes = [];
  // a panel on a wall of GUY's room: decor, like a window or a picture, as wide as asked
  const panel = (name, wall, u, hw) => { const g = new THREE.Group(); w.room.add(g); w.decor[name] = { name, label: 'QA panel', decor: true, removable: true, group: g, wall, hw, hh: 0.6, u, v: 1.5, home: { u, v: 1.5 }, rot: 0, hx: 0, hz: 0 }; fakes.push(name); };
  const card = () => machineCard('Restaurant'), btns = () => [...(card() ? card().querySelectorAll('.act') : [])].map((x) => x.textContent);
  const press = (label) => { const el = [...card().querySelectorAll('.act')].find((x) => x.textContent === label); if (el) el.click(); step(0.5); return !!el; };
  const fresh = () => { T.resetRooms(); T.removeAll(); T.settle(); T.home(); unlockRoom('restaurant'); };
  try {
    // 1. a clear wall: added straight away, nothing asked
    fresh(); R().add('workshop', { walls: ['right'] });
    openTab('rooms');
    out.push(result('restaurant wall: its card says it asks first if something is in the way', !!card() && /asked first/.test(card().textContent) && btns().join() === 'Add to my home', { text: card() && card().textContent }));
    press('Add to my home');
    out.push(result('restaurant wall: with a wall clear it is added at once, with no question', R().isAdded('restaurant') && w.doors.restaurant.wall !== 'right' && /Restaurant added/.test(toast()), { toast: toast() }));
    // 2. every wall it can use has a room: it says which, and nothing changes
    fresh();
    for (const [id, wall] of [['workshop', 'right'], ['backyard', 'front'], ['bowling', 'back']]) R().add(id, { walls: [wall] });
    const doorsBefore = Object.keys(w.doors).join(), removedBefore = Object.keys(w.removed).length;
    const full = R().add('restaurant', { ask: true });
    openTab('rooms'); press('Add to my home');
    out.push(result('restaurant wall: with the front, back and right walls taken by rooms it says so, wall by wall, and offers nothing',
      !full.ok && !full.offer && /No clear wall for the Restaurant/.test(full.messages[0]) && ['Workshop', 'Backyard', 'Bowling Alley'].every((n) => full.messages.some((m) => m.includes(n))) && /Remove one of those rooms/.test(full.messages.at(-1))
      && friendly(full.messages) && /No clear wall for the Restaurant/.test(toast()) && btns().join() === 'Add to my home', { messages: full.messages, toast: toast(), btns: btns() }));
    out.push(result('restaurant wall: ... and no door is added and nothing is moved', !R().isAdded('restaurant') && Object.keys(w.doors).join() === doorsBefore && Object.keys(w.removed).length === removedBefore, {}));
    // 3. the two walls it could use have rooms, and the back wall is covered by things that can come out: the window and panels
    fresh();
    R().add('workshop', { walls: ['right'] }); R().add('backyard', { walls: ['front'] });
    T.addObject('window2');
    panel('qa-a1', 'back', -1.85, 3.15); panel('qa-a2', 'back', -1.85, 3.15); panel('qa-b1', 'back', 4.45, 0.55); panel('qa-b2', 'back', 4.45, 0.55);
    const ask = R().add('restaurant', { ask: true });
    out.push(result('restaurant wall: with only a window in the way it does not add the room: it names the window and asks',
      !ask.ok && !!ask.offer && ask.offer.wall === 'back' && ask.offer.remove.join() === 'window2' && /No wall is free/.test(ask.messages[0]) && /window/i.test(ask.messages[1]) && /\?$/.test(ask.messages.at(-1)) && friendly(ask.messages)
      && !R().isAdded('restaurant') && !!w.decor.window2, { ask }));
    openTab('rooms'); press('Add to my home');
    out.push(result('restaurant wall: the card then asks, with "Remove and add" and "Not now"', btns().join() === 'Remove and add,Not now' && /window/i.test(card().textContent) && !R().isAdded('restaurant'), { btns: btns(), text: card() && card().textContent }));
    press('Not now');
    out.push(result('restaurant wall: "Not now" leaves everything as it was', !R().isAdded('restaurant') && !!w.decor.window2 && fakes.every((n) => !!w.decor[n]) && btns().join() === 'Add to my home', { btns: btns() }));
    press('Add to my home'); press('Remove and add');
    const door = w.doors.restaurant;
    out.push(result('restaurant wall: "Remove and add" takes the window out (to the Catalog) and adds the Restaurant on the back wall, the panels left alone',
      R().isAdded('restaurant') && door.wall === 'back' && !w.decor.window2 && !!w.removed.window2 && fakes.every((n) => !!w.decor[n]) && !doorProblems('restaurant').length && /Restaurant added/.test(toast()) && /Moved the/.test(toast()),
      { toast: toast(), wall: door && door.wall, problems: door && doorProblems('restaurant') }));
    // 4. something else is put there between the question and the answer: it asks again, naming that too
    fresh();
    R().add('workshop', { walls: ['right'] }); R().add('backyard', { walls: ['front'] });
    panel('qa-c', 'back', 0, 5.2);
    const first = R().add('restaurant', { ask: true });
    panel('qa-d', 'back', 0, 5.2);
    const again = R().add('restaurant', { clear: first.offer });
    const last = R().add('restaurant', { clear: again.offer });
    out.push(result('restaurant wall: if more is in the way by the time the player says yes, it asks again before moving anything, then adds it',
      !!first.offer && first.offer.remove.join() === 'qa-c' && !again.ok && !!again.offer && again.offer.remove.sort().join() === 'qa-c,qa-d' && last.ok && !w.decor['qa-c'] && !w.decor['qa-d'] && w.doors.restaurant.wall === 'back',
      { first: first.offer, again: again.offer, last: last.ok }));
  } finally {
    for (const n of fakes) { if (w.decor[n]) w.room.remove(w.decor[n].group); delete w.decor[n]; delete w.removed[n]; }
    T.resetRooms(); T.removeAll(); machine().hidden = true;
  }
  out.push(result('restaurant wall: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- Every room the same square, and a door into every neighbour (room.js ROOM, links; rooms.js linkRooms; workbrain.js route) ----
// every door of a room (its own, and the ones between it and the corner rooms beside it)
T.lockRoom = (id, on) => { R().setDoorLocked(id, on); for (const l of Object.values(W().links)) if (l.room === id || l.to === id) R().setDoorLocked(l.id, on); };
T.sweepFloorplan = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  const before = new Set(Object.keys(w.removed)), places = T.keepPlaces(), box = (d) => d.shell.bounds, all = () => [{ id: 'main', ...w.MAIN_BOUNDS }, ...Object.values(w.doors).map((d) => ({ id: d.id, ...box(d) }))];
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  // square, the same size, and on the grid: every edge is a wall line of the 3 x 3 grid, so nothing overlaps and nothing is short of its neighbour
  const problems = () => all().flatMap((q) => [
    r6(q.maxX - q.minX) === 10 && r6(q.maxZ - q.minZ) === 10 ? null : `${q.id} is ${r6(q.maxX - q.minX)} x ${r6(q.maxZ - q.minZ)}`,
    [q.minX, q.maxX, q.minZ, q.maxZ].every((v) => [-15, -5, 5, 15].includes(r6(v))) ? null : `${q.id} is off the grid (${[q.minX, q.maxX, q.minZ, q.maxZ].map(r6)})`,
    all().some((o) => o.id !== q.id && r6(o.minX) === r6(q.minX) && r6(o.minZ) === r6(q.minZ)) ? `${q.id} stands on another room` : null]).filter(Boolean);
  out.push(result('floor plan: GUY\'s own room is a square', ROOM_MAIN.w === 10 && ROOM_MAIN.d === 10));
  const ids = Object.keys(MANIFEST.rooms);
  for (const id of ids) {
    const bad = [];
    for (const wall of ['right', 'front', 'back', 'left']) {
      T.resetRooms(); T.removeAll();
      unlockRoom(id);
      if (!R().add(id, { walls: [wall] }).ok) continue;
      bad.push(...problems().map((p) => `${wall}: ${p}`));
      const sh = w.doors[id].shell; if (sh.N !== 10 || sh.L !== 10) bad.push(`${wall}: built ${sh.L} x ${sh.N}`);
    }
    out.push(result(`floor plan: the ${id} is a 10 m square whichever wall its door is in`, !bad.length, { bad }));
  }
  // the house in the report: the Bedroom between the Workshop and the Studio
  const house = () => {
    T.resetRooms(); T.removeAll(); T.settle(); T.home();
    for (const [id, o] of [['workshop', { walls: ['right'] }], ['studio', { walls: ['front'] }], ['bowling', { walls: ['back'] }], ['library', { corners: ['right-back'] }], ['bedroom', { corners: ['right-front'] }]]) R().add(id, o);
  };
  house();
  out.push(result('floor plan: the Workshop, Studio, Bowling Alley, Library and Bedroom line up with no overlap and no gap', !problems().length && Object.keys(w.doors).length === 5, { problems: problems() }));
  const pair = (x, y) => w.allDoors().filter((d) => { const r = d.link ? d.room : d.id; return (r === x && d.parent === y) || (r === y && d.parent === x); });
  const ways = { ws: pair('bedroom', 'workshop').length, st: pair('bedroom', 'studio').length, lib: pair('library', 'workshop').length, bowl: pair('library', 'bowling').length };
  out.push(result('floor plan: the Bedroom has a door into the Workshop and one into the Studio (the Library one into the Workshop; the Bowling Alley\'s side walls take none)', ways.ws === 1 && ways.st === 1 && ways.lib === 1 && ways.bowl === 0, ways));
  const link = Object.values(w.links)[0];
  if (!link) { T.resetRooms(); return out; }
  const cell = (d) => { const c = [d.rect, d.rectIn], hits = w.obstacles.filter((o) => o.active !== false && !o.char && c.some((r) => o.x1 > r.x0 && o.x0 < r.x1 && o.z1 > r.z0 && o.z0 < r.z1)); return hits.map((o) => o.name); };
  out.push(result('floor plan: that door is cut in the wall of each of the two rooms, with nothing standing in front of it on either side', link.hide.length === 2 && link.hide.every((m) => !m.visible) && link.cut.children.length === 2 && !cell(link).length, { hits: cell(link) }));
  {
    const p = (n) => w.doorPoint(link.id, n), mid = p(0), probe = { w: 0.5, d: 0.5, obstacle: null };
    out.push(result('floor plan: its two sides are the two rooms, a thing can be moved through it, and the doorway is walkable only while it is open', w.roomIdAt(p(1).x, p(1).z) === link.to && w.roomIdAt(p(-1).x, p(-1).z) === link.room && w.roomIdAt(mid.x, mid.z) === 'door' && w.canTransit(probe, mid.x, mid.z)
      && !w.walkable(mid.x, mid.z) && (w.setDoorOpen(link.id, true), step(1.2), w.walkable(mid.x, mid.z)) && (w.setDoorOpen(link.id, false), step(1.2), !w.walkable(mid.x, mid.z)), { mid }));
    const n0 = p(0.6); out.push(result('floor plan: furniture cannot be left in front of it', !w.fits({ name: 'x', w: 0.5, d: 0.5, h: 0.5, obstacle: null }, n0.x, n0.z), {}));
  }
  // he walks round: in by one door and out by the other, and shuts what he opened behind him on the way out
  const go = (max, stop) => { const seen = [], bad = []; let t = 0; while (t < max) { step(0.1); t += 0.1; const r = w.roomIdAt(g.pos.x, g.pos.z); if (r !== 'door' && seen.at(-1) !== r) seen.push(r); if (!w.walkable(g.pos.x, g.pos.z) && !w.inMain(g.pos.x, g.pos.z)) bad.push([+g.pos.x.toFixed(2), +g.pos.z.toFixed(2)]); if (stop(seen)) break; } return { seen, bad, t: +t.toFixed(0) }; };
  const stand = (room, n = 5, lat = 0) => { const p = w.shellPoint(room, n, lat); b.skip(true); b.queue = []; b.step = null; b.pendingActivity = null; g.root.position.set(p.x, 0, p.z); b.stayRoom = room; };
  for (const d of w.allDoors()) w.setDoorOpen(d.id, false);
  step(1.2);
  const other = link.to === 'studio' ? 'workshop' : 'studio';
  for (const [from, to] of [[link.to, link.room], [link.room, link.to], [link.room, other], [other, link.room]]) {
    stand(from, from === 'studio' ? 4.5 : 5); for (const d of w.allDoors()) { d.open = 0; d.openTo = 0; }
    const ask = b.visitRoom(to, true);
    const tr = go(60, () => b.hereId() === to && w.roomIdAt(g.pos.x, g.pos.z) === to);
    out.push(result(`floor plan: from the ${from} he goes straight into the ${to} through the door between them`, ask.ok && tr.seen.at(-1) === to && !tr.seen.includes('main') && !tr.bad.length, { ask, ...tr }));
  }
  // the menu on it
  window.__guyOpenDoorMenu(link.id, 'main');
  const txt = [...document.getElementById('menu').querySelectorAll('[data-act]')].filter((x) => !x.hidden).map((x) => x.textContent);
  out.push(result('floor plan: long-pressing it offers the room on the other side and the lock', txt.length === 2 && txt[0].includes('Go into') && /Lock the door/.test(txt[1]), { txt }));
  document.getElementById('menu').hidden = true;
  // locked: the way round it; both locked: shut in
  stand('bedroom'); b.choose('wander');
  R().setDoorLocked('bedroom', true);
  out.push(result('floor plan: with one of its doors locked the Bedroom is not shut: he goes in and out by the other', b.stuckIn() === null && !b.doorLockedFor('bedroom') && (b.route('bedroom', 'main') || []).every((e) => e.id !== 'bedroom'), { way: b.route('bedroom', 'main') }));
  { b.skip(true); b.queue = []; b.step = null; b.pendingActivity = 'leave'; const tr = go(90, () => b.inMain() && w.roomIdAt(g.pos.x, g.pos.z) === 'main'); out.push(result('floor plan: ... and he gets home that way', tr.seen.at(-1) === 'main' && tr.seen.includes(link.to) && !tr.bad.length, tr)); }
  R().setDoorLocked(link.id, true);
  out.push(result('floor plan: with both locked nobody can go in', w.isDoorLocked(link.id) && b.doorLockedFor('bedroom') && !b.route('main', 'bedroom'), {}));
  stand('bedroom'); step(0.2);
  out.push(result('floor plan: ... and whoever is in there is shut in', b.stuckIn() === 'bedroom', { stuck: b.stuckIn() }));
  R().setDoorLocked('bedroom', false);
  out.push(result('floor plan: unlocking either lets him out', b.stuckIn() === null, {}));
  // saved with the rooms (and where it is, and that it is locked)
  b.skip(true); b.queue = []; b.step = null; T.home(); T.settle();
  const snap = JSON.parse(JSON.stringify(R().snapshot())), was = { id: link.id, u: link.u };
  T.resetRooms();
  out.push(result('floor plan: taking the rooms away takes the door with them', !Object.keys(w.links).length));
  R().restoreFrom(snap);
  out.push(result('floor plan: it comes back where it was, locked as it was', !!w.links[was.id] && w.links[was.id].u === was.u && w.isDoorLocked(was.id) && !problems().length, { links: Object.keys(w.links) }));
  // an older save: no links, and a Studio that stood 12 m wide: the doors are added once everything is back
  const old = JSON.parse(JSON.stringify(snap)); for (const s of Object.values(old.rooms)) delete s.links; old.rooms.studio.span = { lo: -6, hi: 5 };
  T.resetRooms(); R().restoreFrom(old);
  const none = Object.keys(w.links).length, made = R().linkRooms();
  out.push(result('floor plan: an older save gets the missing door, and its wide Studio comes back square', none === 0 && made.length === 1 && Object.keys(w.links).length === 1 && !problems().length, { none, made, problems: problems() }));
  // one room goes, the wall of the other is whole again
  { const l = Object.values(w.links)[0], mine = w.doors[l.room].shell.sides[l.wall2.split(':')[1]], cutWas = mine.visible;
    R().reset(l.to);
    out.push(result('floor plan: taking a neighbour away closes the wall of the room that stays', !Object.keys(w.links).length && !cutWas && mine.visible && !!w.doors[l.room] && !w.room.children.includes(l.cut) && !w.room.children.includes(l.group), { links: Object.keys(w.links) })); }
  // the third room arrives last: the corner room that was there gets its second door then
  T.resetRooms(); T.settle(); T.home();
  R().add('workshop', { walls: ['right'] }); R().add('bedroom', { corners: ['right-front'] });
  const n0 = Object.keys(w.links).length, late = R().add('backyard', { walls: ['front'] }), gate = Object.values(w.links)[0];
  out.push(result('floor plan: a room added beside a corner room later gets a door into it too (a gate, in the Backyard\'s fence), and the toast says so', n0 === 0 && late.ok && !!gate && gate.to === 'backyard' && gate.gate && late.messages.some((x) => /between the Bedroom and the Backyard/.test(x)), { late }));
  // a layout from when his room was 8 m deep: what stood by the front and back walls still does, the rest has not moved
  T.resetRooms(); T.removeAll(); T.settle(); T.home();
  for (const id of ['piano', 'lamp', 'plant']) T.addObject(id);
  { const v1 = JSON.parse(JSON.stringify(w.layout.snapshot())); v1.v = 1;
    v1.objects.piano = { x: -2.5, z: -3.5, rot: 0 }; v1.objects.lamp = { x: -4.3, z: 3.7, rot: 0 }; v1.objects.plant = { x: 2, z: 1.2, rot: 0 };
    const did = w.layout.apply(v1), q = (n) => [r6(w.objects[n].x), r6(w.objects[n].z)].join();
    out.push(result('floor plan: an old layout: the piano is still against the back wall, the lamp by the front one, the plant where it was', did.applied && q('piano') === '-2.5,-4.5' && q('lamp') === '-4.3,4.7' && q('plant') === '2,1.2', { piano: q('piano'), lamp: q('lamp'), plant: q('plant'), did }));
    out.push(result('floor plan: and it is saved as a new one', w.layout.snapshot().v === 2)); }
  T.resetRooms(); T.removeAll(); places(); putBackSince(before); T.settle(); T.home(); machine().hidden = true;
  out.push(result('floor plan: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

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

// ---- 18. The Workshop: the furniture and tools, and what GUY builds with them (src/workobjects.js, workbrain.js, workshop.js) ----
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
  out.push(result('workshop: a chair GUY built is a chair he can sit on', ch));
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

// ---- 19. The Restaurant: the room, its customers and what GUY does for them (src/restobjects.js, customers.js, restbrain.js) ----
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

    // 3. nobody comes if GUY has not read the book; once he has, they do
    restSetup('front', { skill: false });
    r.paused = false; r.spawnIn = 0; step(10);
    out.push(result('restaurant: without the book nobody arrives', r.list.length === 0 && r.stats.arrived === 0));
    T.learn(['restaurant']); r.spawnIn = 0; step(2);
    out.push(result('restaurant: once GUY has read the book a customer arrives and the elevator doors open', r.list.length === 1 && w.doors.restaurant.elevator.group.userData.openTo === 1, { n: r.list.length }));

    // 4. a whole visit from the elevator to the elevator, looked after by GUY
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
      out.push(result(`restaurant: ${wall} wall: GUY ends up back in his own room with his hands empty, the elevator doors shut, and the customer never left the floor`, back < 120 && b.carry === null && bad === 0, { bad, back }));
      const s1 = sfxNow(), needSounds = ['ding', 'sizzle', 'plate', 'cash', 'lift'];
      out.push(result(`restaurant: ${wall} wall: every step makes its sound`, needSounds.every((n) => heard(s0, s1, n) > 0), { silent: needSounds.filter((n) => !(heard(s0, s1, n) > 0)) }));
    }

    // 5. three customers at once: each has a seat of their own, everybody is served and pays, and nobody walks through anybody
    restSetup('front');
    const cs = [r.spawn(), r.spawn(), r.spawn()];
    out.push(result('restaurant: three customers at once sit at three different seats, and a fourth is not let in', cs.every(Boolean) && new Set(cs.map((c) => c.seat.table + c.seat.i)).size === 3 && r.spawn() === null));
    let t5 = 0, minGap = 9, ready5 = false;
    const moving = (c) => ['walk', 'exit', 'leave'].includes(c.state);
    while (t5 < 900 && r.list.length) {
      if (!ready5 && cs.some((c) => c.state === 'waiting')) { ready5 = true; b.pendingActivity = null; }
      if (!ready5) b.pendingActivity = 'wander';       // (with a book just opened as they sit down he is 70 s late, and one of them gives up: not what is tested here)
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
      out.push(result(`doorlock: ${wall} wall: a point in GUY's room is on the 'main' face of the door and one in the workshop is on the 'room' face`, res.ok && w.doorSide('workshop', V(pm)) === 'main' && w.doorSide('workshop', V(pr)) === 'room', { main: w.doorSide('workshop', V(pm)), room: w.doorSide('workshop', V(pr)) }));
    }
    // 2. the menu: the first button goes to the room on the far side of the face pressed (and the other way if he is already there)
    T.settle(); T.resetRooms(); T.removeAll(); T.home();
    R().add('workshop', { walls: ['right'] });
    const door = w.doors.workshop, bnd = door.shell.bounds;
    const first = (side) => { window.__guyOpenDoorMenu('workshop', side); const v = vis(); return { text: v[0] && v[0].textContent, note: note(), n: v.length }; };
    let m1 = first('main'), m2 = first('room');
    out.push(result('doorlock: GUY in his room, pressing the room-side face: it offers the way into the Workshop and says he is already in his room', /Go into the Workshop/.test(m2.text) && /already in GUY's room/.test(m2.note) && /Go into the Workshop/.test(m1.text) && m1.note === '', { m1, m2 }));
    g.root.position.set((bnd.minX + bnd.maxX) / 2, 0, (bnd.minZ + bnd.maxZ) / 2);
    m1 = first('main'); m2 = first('room');
    out.push(result('doorlock: GUY inside the Workshop: the room-side face offers "Go into GUY\'s room", the main-side face "Come back" (he is already inside)', /Go into GUY's room/.test(m2.text) && m2.note === '' && /Come back/.test(m1.text) && /already in the Workshop/.test(m1.note), { m1, m2 }));
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
    const all0 = w.allDoors;
    w.allDoors = () => [...all0(), { id: 'second', link: true, room: 'workshop', parent: 'main', locked: false }];     // (pretend this room has a second, unlocked, door)
    const withSecond = b.stuckIn();
    w.allDoors = all0;
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
    out.push(result(`doorlock: 300 seconds with the Restaurant locked and customers waiting: ${galOk ? 'neither GUY nor GAL' : 'GUY'} goes in, and nobody is served`, inG === 0 && inGal === 0 && served === 0, { inG, inGal, served, states: cs.map((c) => c.state) }));
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

// ---- 18b. The Workshop's metal line: Metal Factory, Metal Cutter, Welder, Hammer & Anvil, and what GUY builds from metal (workobjects.js, workbrain.js) ----
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
  const card = machineCard('Metal Chair (built by GUY)');
  out.push(result('metal: the Catalog shows the metal chair in storage and offers Add', !!card && /In storage: 1/.test(card.textContent) && !!card.querySelector('.act')));
  card.querySelector('.act').click(); machine().hidden = true;
  out.push(result('metal: a metal chair GUY built is a chair he can sit on', b.chairs().some((c) => c.name === 'metalchair_1') && !w.stock.items.metalchair));
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
  if (chair) T.addObject('armchair');                                       // (a seat for GUY: nothing missing unless a scenario takes it away)
  T.learn(skills);
};
// run his 'build' to the end (the delivery is part of it); returns the simulated seconds, or -1 if it never finished
const buildToEnd = (brain, max = 1100) => {
  const had = new Set(Object.keys(W().objects)); buildToEnd.clear = null;        // (how far outside the piece he stands the moment it is put together, m; below 0: in it)
  brain.queue = []; brain.step = null; brain.choose('build');
  let t = 0, armed = false;
  while (t < max) {
    step(0.25); t += 0.25;
    if (buildToEnd.clear === null) { const o = Object.values(W().objects).find((x) => x.kind && !had.has(x.name)), p = brain.g.root.position; if (o) buildToEnd.clear = +Math.max(Math.abs(p.x - o.x) - o.w / 2, Math.abs(p.z - o.z) - o.d / 2).toFixed(2); }
    if (!armed && brain.last === 'build') { armed = true; brain.pendingActivity = 'wander'; }
    if (armed && brain.last !== 'build' && !(W().building || []).length) return t;
  }
  return -1;
};
const kindIn = (w, kind, room) => Object.values(w.objects).filter((o) => o.kind === kind && (!room || w.roomIdAt(o.x, o.z) === room));
T.sweepNeeds = () => {
  const out = [], base = errors.length, w = W(), b = B();
  const seat = () => wants(b).some((x) => x.serves === 'seat');
  // 1. the Catalog lists the wooden chairs only once GUY or GAL has read the book that teaches building them
  T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); machine().hidden = true;
  delete w.removed.chair; delete w.removed.chair2;                       // (earlier sweeps took them out: a chair that was put away is listed, one never added is not)
  openObjects('all');
  const before = !machineCard('Wooden Chair') && !machineCard('Second Wooden Chair');
  T.learn(['workshop.furniture']); openObjects('all');
  const after = !!machineCard('Wooden Chair') && !!machineCard('Second Wooden Chair') && !!machineCard('Wooden Chair').querySelector('.act');
  T.forget(); openObjects('all');
  const gone = !machineCard('Wooden Chair');
  out.push(result('needs: the wooden chairs are not in the Catalog by default, appear once GUY has read "Furniture for Robots", and go again if he forgets it', before && after && gone, { before, after, gone }));
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
  // 4b. the stool is never put down in furniture: with the stereo table under the second window he finds room beside it, and with the wall under a window full that window is left alone
  {
    needSetup('right', ['decorate', 'workshop']); for (const id of ['window', 'window2', 'table']) T.addObject(id);
    w.stock.items.footstool = 1; const sn = w.addInstance('footstool', null, null), st = w.objects[sn], tb = w.objects.table, w2 = w.decor.window2;
    const along = [];
    for (let x = w2.u - 1.2; x <= w2.u + 1.2; x += 0.2) { tb.set(x, -4.5); const s = b.stoolSpot(st, w2); along.push(!s || w.fits(st, s.x, s.z)); }
    const free = [w2.u - 1.2, w2.u + 1.2].some((x) => { tb.set(x, -4.5); return !!b.stoolSpot(st, w2); });
    tb.set(w2.u, -4.5); const job = b.stoolJob();
    out.push(result('needs: the foot stool is only ever put where it fits: beside the stereo table under a window, never in it, and a window with no room is left alone', !!sn && along.every(Boolean) && free && (!job || [...job.spots.values()].every((s) => w.fits(st, s.x, s.z))) && b.stoolSpot(st, { ...w2, hw: 0.2 }) === null, { along, free }));
    tb.set(3.2, -4.5);
  }
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
  for (const d of BOOK_CATALOG) { if (d.room || d.locked) continue; if (d.requires && d.requires.object && !w.objects[d.requires.object]) T.addObject(d.requires.object); if (d.requires && d.requires.anyObject) T.addObject(d.requires.anyObject[0]); T.addBook(d.id); }
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
  // the built bookshelf is a clone of the skill bookshelf: the same look, size and weight, its own list of what stands on it, the same
  // long-press list, and told to use it he reads from that shelf (not from the first one)
  const mat0 = (o) => { const m = o.group.children.find((c) => c.material && c.material.color); return m ? m.material.color.getHex() : null; };
  out.push(result('needs: the built bookshelf is a clone of the skill bookshelf (same look, size and weight)', !!shelf2 && mat0(shelf2) === mat0(sh) && shelf2.weight === sh.weight && shelf2.bw === sh.bw && shelf2.bd === sh.bd && shelf2.h === sh.h, { a: shelf2 && mat0(shelf2), b: mat0(sh), wa: shelf2 && shelf2.weight, wb: sh.weight }));
  const onBuilt = shelf2 ? shelf2.heldBooks() : [], onFirst = sh.heldBooks();
  out.push(result('needs: each bookshelf lists what stands on it (the first one, its stack and the built one together are all the books)', onBuilt.length > 0 && onBuilt.every((r) => r.host === shelf2.name) && onFirst.every((r) => !r.host) && onBuilt.length + onFirst.length === sh.books.length, { built: onBuilt.length, first: onFirst.length, all: sh.books.length }));
  window.__guyOpenBooks(shelf2.name);
  const rows = document.querySelectorAll('#albummenu .brow').length, shown = onBuilt.filter((r) => r.mesh.visible).length;
  out.push(result('needs: long-pressing the built bookshelf lists the books standing on it', rows === shown && rows > 0, { rows, shown }));
  document.getElementById('albummenu').hidden = true;
  T.forget(); skillsOf().fading.clear(); b.queue = []; b.step = null; b.skip(); T.settle();
  const said = b.interact(shelf2.name);
  let heldHost = null, tt = 0; while (tt < 60 && !heldHost) { step(0.25); tt += 0.25; if (b.held && b.held.host) heldHost = b.held.host; else if (b.held) heldHost = '(first)'; }
  out.push(result('needs: told to use the built bookshelf he takes a book from that shelf, not from the first one', said.ok && heldHost === shelf2.name, { said, heldHost }));
  b.queue = []; b.step = null; b.skip(); T.settle();
  // records too: past the top shelf's twelve they stand on the built shelf, and GUY fetches one from there for the stereo
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
  // 9. easter eggs: in no book. Built only when every object the recipe lists is in the room, then never again
  const eggs = () => wants(b).filter((x) => /^egg\./.test(x.serves)).map((x) => x.serves);
  needSetup('right', ['workshop'], { metal: true });
  T.addObject('table');
  out.push(result('needs: eggs: with the factories and the basic book but the drums missing, no egg is wanted', !eggs().length, { eggs: eggs() }));
  T.addObject('drums');
  const w9 = eggs(), e9 = errors.length;
  out.push(result('needs: eggs: once the stereo and the drums are there a Mirror Ball is wanted (and nothing else: the trophy needs a band, the lava lamp a cosy corner)', w9.length === 1 && w9[0] === 'egg.mirrorball', { w9 }));
  const t9 = buildToEnd(b, 1500), mb = kindIn(w, 'mirrorball', 'main')[0];
  mb && mb.group.userData.tick && mb.group.userData.tick(0.5);
  out.push(result('needs: eggs: he builds it with no special book, puts it together in the room, it turns by itself, and it is not wanted again', t9 > 0 && !!mb && mb.group.userData.tick && !eggs().length && errors.length === e9, { t9, mb: !!mb, left: eggs(), errs: errors.slice(e9, e9 + 1) }));
  for (const id of ['piano', 'guitar', 'lamp', 'nightstand', 'coffeetable']) T.addObject(id);
  out.push(result('needs: eggs: a full band (piano, guitar, drums) wants the Golden Trophy and a lamp with a nightstand and a coffee table wants the Lava Lamp', ['egg.trophy', 'egg.lavalamp'].every((x) => eggs().includes(x)), { eggs: eggs() }));
  // every egg: wanted exactly when all its ingredients are in the room (and each ingredient matters)
  {
    const bad = [];
    for (const [id, r] of Object.entries(RECIPES_DEF)) {
      if (!r.egg || r.eggRoom) continue;                                   // (the Automatic Pinsetter lives in the Bowling Alley: sweepBowl)
      needSetup('right', ['workshop'], { metal: true, chair: false });
      if (r.line === 'bot') T.addObject('botprinter');                       // (what the Build a Bot machine prints is wanted only while it stands in the Workshop)
      for (const k of r.egg.slice(0, -1)) T.addObject(k);
      const partial = eggs().includes(r.serves);
      T.addObject(r.egg[r.egg.length - 1]);
      if (partial || !eggs().includes(r.serves)) bad.push(id);
    }
    out.push(result('needs: eggs: every egg is wanted only once all of its ingredients are in the room', !bad.length, { bad }));
    // an egg of the wooden line and one that needs both lines are built end to end
    for (const id of ['rubberduck', 'snowglobe', 'fishtank', 'aquarium', 'robopet']) {
      needSetup('right', ['workshop'], { metal: true });
      if (RECIPES_DEF[id].line === 'bot') T.addObject('botprinter');
      for (const k of RECIPES_DEF[id].egg) T.addObject(k);
      const e = errors.length;
      b.pickRecipe = () => id; const t = buildToEnd(b, 1500); delete b.pickRecipe;
      const o = kindIn(w, id, 'main')[0];
      out.push(result(`needs: eggs: the ${RECIPES_DEF[id].name} is built (line: ${RECIPES_DEF[id].line}), put together in the room, and it animates`, t > 0 && !!o && !!o.group.userData.tick && errors.length === e, { t, o: !!o, errs: errors.slice(e, e + 1) }));
    }
  }
  T.forget(); T.learn([]);
  out.push(result('needs: eggs: without even the basic Workshop book nothing is built', b.pickRecipe() === null, { picked: b.pickRecipe() }));
  clearBooks(); T.removeAll(); T.settle(); machine().hidden = true;
  out.push(result('needs: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 21. GAL: the Build a Bot machine, the second robot, and how she and GUY work together (src/gal.js, botobjects.js) ----
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
// build her through the real machine: add it to the Workshop (the harness unlocks premium and adds the room), GUY goes in and uses it. The tests
// that only need her get the house as it was before (no Workshop, no machine, both robots in GUY's room); the ones that already have a Workshop
// keep it, with the machine in it.
const galBuild = () => {
  const w = W(), b = B();
  const hadShop = !!w.doors.workshop;
  T.addObject('botprinter');
  b.queue = []; b.step = null; b.choose('buildbot');
  let t = 0; while (t < 150 && !(w.gal.exists() && !w.gal.emerge)) { step(0.5); t += 0.5; }
  const ok = w.gal.exists() && !w.gal.emerge;
  if (ok && !hadShop) {
    for (const r of [G().root, w.gal.g.root]) r.position.set(r === G().root ? 0 : 0.5, 0, r === G().root ? 2 : -0.5);
    for (const br of [b, w.gal.brain]) { br.queue = []; br.step = null; br.stayRoom = null; }
    R().reset('workshop'); delete w.removed.botprinter; w.stock.items = {};
    T.settle();
  }
  return { ok, t };
};
T.galBuild = () => galBuild(); T.galReset = () => galReset();         // (the pictures use them: GAL playing the guitar)
T.sweepGal = () => {
  const out = [], base = errors.length, w = W(), b = B(), gal = w.gal;
  if (!gal.g || !gal.g.loaded) return [result('gal: her model is loaded (wait a moment after the page opens)', false)];
  galReset();
  try {
  // 1. the machine is a premium Workshop thing: listed (under Machines) once the Workshop is there, locked until unlocked, then added like anything else
  openObjects('all');
  out.push(result('gal: the machine is not listed at all until the Workshop has been added', !machineCard('Build a Bot Machine')));
  machine().hidden = true;
  unlockRoom('workshop'); R().add('workshop', { walls: ['right'] }); openObjects('all');
  const card0 = machineCard('Build a Bot Machine');
  out.push(result('gal: with the Workshop added the Build a Bot machine is listed in the Catalog as locked (no Add button)', !!card0 && !card0.querySelector('.act') && /Locked/.test(card0.textContent) && !w.objects.botprinter));
  machine().hidden = true;
  dev.all = true; openObjects('all');
  const card1 = machineCard('Build a Bot Machine');
  out.push(result('gal: with premium unlocked it can be added, and it stands on free floor', !!card1 && !!card1.querySelector('.act')));
  card1.querySelector('.act').click(); machine().hidden = true; dev.all = false;
  const m = w.objects.botprinter;
  out.push(result('gal: the machine stands in the Workshop, clear of everything', !!m && w.fits(m, m.x, m.z) && w.roomIdAt(m.x, m.z) === 'workshop'));
  // it never leaves the Workshop: not by being dragged, not by being put anywhere else
  {
    const home = { x: m.x, z: m.z }, to = [{ x: 0, z: 0 }, { x: 0, z: 3 }, { x: -2, z: -3 }];
    const nowhere = to.every((p) => !w.fits(m, p.x, p.z));
    const sh = w.doors.workshop.shell.bounds;
    const inside = w.fits(m, (sh.minX + sh.maxX) / 2, (sh.minZ + sh.maxZ) / 2) || w.findSpot(m, { x: (sh.minX + sh.maxX) / 2, z: (sh.minZ + sh.maxZ) / 2 }, null);
    m.set(home.x, home.z);
    // dragged right across the doorway into GUY's room it stops at the wall
    for (let i = 0; i < 80; i++) w.dragTo(m, 0, 0, () => true);
    out.push(result('gal: the machine can be moved about inside the Workshop but never out of it (not into his own room, not through the door)', nowhere && !!inside && w.roomIdAt(m.x, m.z) === 'workshop' && w.wallOk(m, m.x, m.z) && !w.canTransit(m, 0, 0), { nowhere, room: w.roomIdAt(m.x, m.z) }));
    m.set(home.x, home.z);
  }
  // the long-press menu: its button makes GUY use it (it used to say he could not do anything with it)
  window.__guyOpenMenu('botprinter');
  const menu = document.getElementById('menu'), useBtn = [...menu.querySelectorAll('[data-act]')].find((x) => !x.hidden && /Build GAL|Use/.test(x.textContent));
  b.queue = []; b.step = null; b.skip();
  if (useBtn) useBtn.click();
  menu.hidden = true;
  out.push(result('gal: long-pressing the machine and choosing its button sends GUY to build her (not the old refusal)', !!useBtn && b.pendingActivity === 'buildbot', { btn: useBtn && useBtn.textContent, pending: b.pendingActivity }));
  b.pendingActivity = null;
  // 2. GUY goes in, uses it, and she steps out in front of it: the machine stays
  b.queue = []; b.step = null; b.choose('buildbot');
  const seen = [], s0 = sfxNow();
  let t = 0, sawRun = false, scaleMin = 1, ghostMax = 0;
  while (t < 150 && !(gal.exists() && !gal.emerge)) {
    step(0.25); t += 0.25;
    if (m.running > 0) sawRun = true;
    if (gal.exists() && gal.emerge) { scaleMin = Math.min(scaleMin, m.group.scale.y); ghostMax = Math.max(ghostMax, m.ghost.visible ? 1 : 0); }
    if (seen[seen.length - 1] !== label()) seen.push(label().slice(0, 30));
  }
  const s1 = sfxNow();
  const gp = gal.g.root.position, front = m.at(0, 0, 1.3);
  out.push(result('gal: GUY goes to the machine, presses the button, it prints and she steps out in front of it (the machine is still there, whole, in the Workshop)', gal.exists() && !gal.emerge && sawRun && scaleMin > 0.99 && w.objects.botprinter === m && w.roomIdAt(m.x, m.z) === 'workshop' && !m.ghost.visible && seen[0] === 'building GAL' && Math.hypot(gp.x - front.x, gp.z - front.z) < 1.5, { seen, sawRun, scaleMin, t, gal: [gp.x, gp.z] }));
  out.push(result('gal: the machine is not used up: its Catalog card says it is in the room', !w.removed.botprinter && (() => { dev.all = true; openObjects('all'); const c = machineCard('Build a Bot Machine'); const ok = !!c && /inroom/.test(c.className) && !/Locked|GAL is here|Used/.test(c.textContent); dev.all = false; machine().hidden = true; return ok; })()));
  out.push(result('gal: once she is here its button says it prints other things, and long-pressing it sends GUY to build, not to make another GAL', (() => { window.__guyOpenMenu('botprinter'); const mm = document.getElementById('menu'), btn = [...mm.querySelectorAll('[data-act]')].find((x) => !x.hidden && /Print Something/.test(x.textContent)); mm.hidden = true; return !!btn && b.lockActs('botprinter').every((a) => a !== 'buildbot') && !b.available('buildbot'); })()));
  out.push(result('gal: building her makes its sounds (machine, chime)', heard(s0, s1, 'machine') > 0 && heard(s0, s1, 'chime') > 0));
  let gb = gal.brain; const gr = gal.g.root;
  out.push(result('gal: she starts with no skills, stands on the floor at full size, and is an obstacle for GUY (and he for her)', gb.skills.known.size === 0 && Math.abs(gr.scale.y - 1) < 0.01 && T.feetOf(gal.g) < 0.06 && w.obstacles.filter((o) => o.char).length === 2 && b.selfOb !== gb.selfOb));
  // 2b. the machine stays and prints other things (RECIPES with line 'bot'): only while it stands in the Workshop
  {
    const e2 = errors.length;
    T.learn(['workshop']); T.addObject('coffeetable');
    const wantTank = wants(b).filter((x) => /^egg\./.test(x.serves)).map((x) => x.serves);
    const tp = buildToEnd(b, 1500), ft = kindIn(w, 'fishtank', 'main')[0];
    out.push(result('gal: with the machine in the Workshop a coffee table makes GUY print a Fish Tank (glass): it is carried into his room, put together, it moves, and the machine is still there', wantTank.length === 1 && wantTank[0] === 'egg.fishtank' && tp > 0 && !!ft && !!ft.group.userData.tick && w.objects.botprinter === m && !m.tray.children.length && !m.ghost.visible && errors.length === e2, { wantTank, tp, ft: !!ft, errs: errors.slice(e2, e2 + 1) }));
    w.removeObject('botprinter'); b.objectRemoved('botprinter'); T.addObject('nightstand');
    out.push(result('gal: take the machine away and what it prints is not wanted and cannot be built (a nightstand would have meant a Rubber Chicken)', !wants(b).some((x) => x.serves === 'egg.rubberchicken') && !b.canBuild('rubberchicken') && b.pickRecipe() === null));
    T.addObject('botprinter');
    out.push(result('gal: put the machine back in the Workshop and the Rubber Chicken is wanted again', wants(b).some((x) => x.serves === 'egg.rubberchicken') && b.canBuild('rubberchicken') && w.roomIdAt(w.objects.botprinter.x, w.objects.botprinter.z) === 'workshop'));
  }
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
  // 4. her skills are her own: she learns by reading, GUY's stay his
  galReset(); galBuild(); gb = gal.brain;
  const sh = w.objects.shelf; T.addObject('telescope'); T.addBook('stars');           // (the object first: a book for something that is not there is not shown)
  skillsOf().known.clear(); gb.skills.known.clear();
  gb.queue = []; gb.step = null; gb.orders.push({ kind: 'read', book: 'stars' }); gb.choose();
  const availGuy = b.available.bind(b); b.available = (a) => a !== 'read' && availGuy(a);        // (GUY has no mind to read just now: the question is what her reading does, not who reads the book first)
  let t4 = 0; try { while (t4 < 420 && !gb.skills.has('telescope')) { step(0.5); t4 += 0.5; } } finally { b.available = availGuy; }
  out.push(result('gal: she must read a book to gain a skill (ordered to read the stargazing book she learns it), and GUY does not learn it from her reading', gb.skills.has('telescope') && !skillsOf().has('telescope'), { t4 }));
  void sh;
  // 5. GUY asks her to read and come and find him, then they jam: the drums
  galReset(); galBuild(); gb = gal.brain;
  for (const id of ['drums', 'piano', 'table']) T.addObject(id);
  for (const id of ['drumming', 'drumsolo', 'drumband']) T.addBook(id);
  skillsOf().known.clear(); T.learn(['piano', 'stereo']); gb.skills.known.clear();
  const plan = gal.planDuo();
  out.push(result('gal: with drums and the drumming books on the shelf, GUY can plan a jam and she has to read all three drumming books first', !!plan && plan.galInst === 'drums' && plan.books.length === 3 && plan.guyInst === 'piano', { plan }));
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
  out.push(result('gal: GUY asks her to go and read the drumming books and find him: she reads all three, comes to find him, says she is ready', gb.skills.has('drums') && gb.skills.has('drums.solo') && gb.skills.has('drums.band') && /GUY asks GAL: read drumming, drumsolo, drumband/.test(said) && /GAL: I am ready/.test(said), { said, t5 }));
  out.push(result('gal: then they jam together: GUY on the piano and GAL on the drums at the same time, to the stereo', jam.galPlays && /GAL and GUY jam: piano \+ drums/.test(said) && jam.both, { jam, said }));
  out.push(result('gal: nothing broke while they did it (no errors, nothing carried)', errors.length === e5 && b.carry === null && gb.carry === null, { errs: errors.slice(e5, e5 + 1) }));
  // if she already has the skills the plan needs no reading
  gb.skills.learn('drums.band');
  const plan2 = gal.planDuo();
  out.push(result('gal: when she already has the skills there is nothing to read: GUY just asks her to come and play', !plan2 || plan2.galInst !== 'drums' || plan2.books.every((id) => id !== 'drumband')));
  // 5b. she plays a solo on her own while GUY does something else. The kit's resting sticks are shared: GUY's brain used to put them
  // back on the snare every frame while hers held them (sticks on the kit and in her hands), and on a crash hit her fist went over
  // her head with the wrist bent back (the stick kept the snare's downward tilt for a cymbal at shoulder height).
  {
    galReset(); galBuild(); gb = gal.brain;
    T.addObject('drums'); skillsOf().known.clear();
    for (const s of ['drums', 'drums.solo']) gb.skills.learn(s);
    b.queue = []; b.step = null; gb.queue = []; gb.step = null; gb.choose('drumsolo');
    const kit = w.objects.drums, e5b = errors.length;
    let held = 0, both = 0, high = -9, tb = 0;
    while (tb < 60 && !(held && gb.last !== 'drumsolo')) {
      step(0.05); tb += 0.05;
      if (gb.last !== 'drumsolo' || b.pose === 'drumSit' || !gb.hobProps.sticks) continue;
      held++;
      if (kit.restSticks && kit.restSticks.some((m) => m.visible)) both++;
      for (const side of ['Left', 'Right']) high = Math.max(high, gb.handFrame(side).wrist.y - gal.g.boneWorld(`${side}Arm`).y);
    }
    out.push(result('gal: while she drums (GUY busy elsewhere) the sticks are in her hands only, not also lying on the snare', held > 40 && both === 0 && errors.length === e5b, { held, both }));
    out.push(result('gal: drumming, crash included, her wrists stay below her head (at most 15 cm above the shoulder)', held > 40 && high < 0.15, { high: +high.toFixed(2) }));
  }
  // 6. her own idea: switch the stereo on, ask GUY to dance, dance, and the last one to stop switches the music off
  galReset(); galBuild(); gb = gal.brain;
  for (const id of ['table']) T.addObject(id);
  skillsOf().known.clear(); gb.skills.known.clear(); gb.skills.learn('stereo');
  T.settle();
  gb.queue = []; gb.step = null; gb.skip(true); gb.choose('invitedance');
  const seen6 = []; let t6 = 0, wasOn = false; const e6 = errors.length;
  while (t6 < 300) {                                   // (he may be in the middle of reading when she asks: that has to finish first)
    step(0.25); t6 += 0.25;
    if (b.music) wasOn = true;
    const s = `${b.last}/${gb.last}`; if (seen6[seen6.length - 1] !== s) seen6.push(s);
    if (wasOn && !b.music && t6 > 20) break;
  }
  const said6 = gal.log.join(' | ');
  out.push(result('gal: her own idea: she switches the stereo on, asks GUY to dance, he stops what he is doing, they dance, and the music goes off when they have both finished', wasOn && !b.music && /GAL asks GUY: dance/.test(said6) && seen6.some((s) => s === 'dance/dance') && errors.length === e6, { seen6: seen6.slice(0, 10), said6, t6 }));
  // ... and when he comes to stand on the very spot she is walking to (he was on his way somewhere when she set off), she goes round to him and asks
  {
    b.musicOff(); gal.partyMusic = false; T.settle(); T.home(); gal.guyBrain.unlock(false);
    const bp = b.g.root.position, gp2 = gal.g.root.position, log0 = gal.log.length;
    bp.set(0, 0, 3); gp2.set(0, 0, -3);
    b.queue = []; b.step = b.play('idle', 60); b.step.t = 0; b.last = 'wander'; b.pendingActivity = null;
    gb.pendingActivity = null; gb.orders.length = 0; gb.queue = [gb.walkToLeader(), gb.play('wave', 2.6, { at: [1.0, () => gal.askGuy('dance')] })]; gb.step = null; gb.last = 'invitedance';
    let tw = 0, moved = false, asked = -1;
    while (tw < 25 && asked < 0) {
      step(0.05); tw += 0.05;
      const s = gb.step;
      if (!moved && s && s.beside && gp2.z > -1.2) { bp.set(s.x, 0, s.z); moved = true; }                      // (he is standing on her spot now)
      if (gal.log.slice(log0).some((x) => /GAL asks GUY: dance/.test(x))) asked = tw;
    }
    out.push(result('gal: GUY comes to stand on the spot she is walking to: she goes up to him where he is now and asks, instead of waiting for the spot and giving up', moved && asked > 0 && asked < 15, { moved, asked, t: tw, last: gb.last }));
    gb.skip(true); b.skip(true); b.pendingActivity = null; gb.pendingActivity = null; T.settle(); T.home();
  }
  out.push(result('gal: she asks nothing of GUY while he is locked on something', (() => { const was = b.lock; b.lock = { name: 'piano' }; const ok = !gal.canInvite() && !gal.askGuy('dance'); b.lock = was; return ok; })()));
  // 6b. keeping time: GUY plays the guitar on his own tempo and GAL plays beside him (each instrument in BAND that keeps a beat).
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
      ? `gal: with an advanced ${inst} book she keeps time with the tempo GUY is playing`
      : `gal: with only the basic ${inst} book her beat is her own (not locked to his)`,
      n6 > 10 && (skilled ? tight / n6 > 0.9 : tight === 0) && errors.length === e6b, { samples: n6, tight }));
  }
  // 6c. GUY has not read the book for chairs but GAL has: the house needs chairs, so he asks her to build one, and she does
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
  out.push(result('gal: GUY has not read the chair book but GAL has: he cannot build one, tells her to, and she builds a chair and puts it together in the room', !guyCan && galCan && helper === 'builtchair' && /GUY asks GAL: build a Wooden Chair/.test(said6c) && galBuilt && kindIn(w, 'builtchair', 'main').length >= 1 && errors.length === e6c, { guyCan, galCan, helper, said6c, galBuilt, t6c, chairs: kindIn(w, 'builtchair', 'main').length, errs: errors.slice(e6c, e6c + 1) }));
  // 6d. a second guitar: the acoustic one and an electric one, one each, at the same time
  galReset(); galBuild(); gb = gal.brain;
  T.addObject('guitar'); T.addObject('eguitar');
  skillsOf().known.clear(); T.learn(['guitar']); gb.skills.known.clear(); gb.skills.learn('guitar');
  T.settle();
  const e6d = errors.length;
  b.queue = []; b.step = null; b.skip(true); gb.queue = []; gb.step = null; gb.skip(true);
  b.choose('guitar'); gb.choose('guitar');
  let t6d = 0, both = 0, close6d = 0, electric = false; const used = new Set(), fretGal = [], fretGuy = [];
  while (t6d < 70) {
    step(0.25); t6d += 0.25;
    if (b.pose === 'guitar' && gb.pose === 'guitar') { both++; used.add(b.gname + '+' + gb.gname); electric = electric || b.electric() || gb.electric(); }
    if (Math.hypot(b.g.pos.x - gb.g.pos.x, b.g.pos.z - gb.g.pos.z) < 0.25) close6d++;
    // her fretting hand, in the guitar's own frame (neck top edge at y 0.026, strings side +z): knuckles at the top edge, fingertips over it
    for (const [x, arr] of [[gb, fretGal], [b, fretGuy]]) {
      const F = x.pose === 'guitar' && x.step && x.step.t > 2 && x.lastCtx && x.lastCtx.guitar && x.lastCtx.guitar.cur;
      if (!F) continue;
      const Fi = F.q.clone().invert(), loc = (n) => x.g.boneWorld(n).sub(F.pos).applyQuaternion(Fi);
      arr.push({ kY: loc('LeftHandMiddle1').y, tipsZ: ['Index', 'Middle', 'Ring', 'Pinky'].reduce((a, f) => a + loc(`LeftHand${f}3`).z, 0) / 4 });
    }
  }
  {
    const med = (a, k) => { const v = a.map((o) => o[k]).sort((p, q) => p - q); return v.length ? +v[Math.floor(v.length / 2)].toFixed(3) : null; };
    const g = { kY: med(fretGal, 'kY'), tipsZ: med(fretGal, 'tipsZ') }, u = { kY: med(fretGuy, 'kY'), tipsZ: med(fretGuy, 'tipsZ') };
    out.push(result('gal: her fretting hand sits like his: knuckles at the top edge of the neck and fingertips over it on the strings (her shorter hand used to make a fist under the neck, upside down)', fretGal.length > 10 && g.kY > 0.015 && g.tipsZ > 0.03 && Math.abs(g.kY - u.kY) < 0.012, { gal: g, guy: u, n: fretGal.length }));
  }
  out.push(result('gal: with an electric guitar as well as the acoustic one, GUY and GAL both play a guitar at the same time, one each, and the electric one sounds electric', both > 20 && used.size === 1 && !used.has('guitar+guitar') && ![...used][0].split('+').every((n, _i, a) => n === a[0]) && electric && close6d <= 6 && errors.length === e6d, { both, used: [...used], electric, close6d, errs: errors.slice(e6d, e6d + 1) }));
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
    out.push(result('gal: GUY and GAL both cooking at the stove at the same moment stand apart (not in the same spot)', cs7.every(Boolean) && both7 > 1 && minD7 > 0.45, { both7, minD7 }));
  }
  w.restaurant.headless = wasHead; w.restaurant.paused = false;
  // 7b. a bed left in the Workshop: GUY and GAL never carry the same one (both used to set off for it), and GAL carries one by herself
  {
    galReset(); galBuild(); gb = gal.brain;
    R().add('workshop', { walls: ['right'] }); R().add('bedroom'); T.addObject('bed');
    const bed = () => Object.values(w.objects).find((o) => o.kind === 'bed'), home = () => { const o = bed(); return !!o && !o.packed && w.roomIdAt(o.x, o.z) === 'bedroom'; };
    T.strand('bed');
    b.queue = []; b.step = null; gb.queue = []; gb.step = null; b.homeTried = gb.homeTried = -999;
    const stranded = !!bed() && w.roomIdAt(bed().x, bed().z) === 'workshop';
    b.choose('carryhome');
    const offered = gb.available('carryhome');
    gb.choose('carryhome');
    let t7 = 0, both = 0; while (t7 < 200 && !home()) { step(0.25); t7 += 0.25; if (b.homeMove && gb.homeMove) both += 0.25; }
    out.push(result('gal: a bed GUY has set off to carry home is left to him: GAL is not offered it, they never both carry it, and it gets to the Bedroom', stranded && !offered && both === 0 && home(), { stranded, offered, both, t7 }));
    T.settle(); T.strand('bed');
    b.queue = []; b.step = null; b.choose('wander'); gb.queue = []; gb.step = null; gb.homeTried = -999; gb.choose('carryhome');
    let t8 = 0, hers = false; while (t8 < 200 && !home()) { b.homeTried = b.time; step(0.25); t8 += 0.25; if (gb.homeMove && gb.carry === 'flat') hers = true; }
    out.push(result('gal: she carries a bed left in the Workshop to the Bedroom herself', hers && home(), { hers, t8 }));
    T.settle(); T.strand('bed'); gb.queue = []; gb.step = null; gb.homeTried = -999; b.homeTried = b.time + 999; gb.choose('carryhome');
    let t9 = 0; while (t9 < 120 && !bed().packed) { b.homeTried = b.time; step(0.25); t9 += 0.25; }
    const wasPacked = bed().packed; gb.beginBuild('footstool'); w.gal.remove();
    out.push(result('gal: taken away with a bed flat in her arms and a stool half built, the bed stands again and nothing is left "being built"', wasPacked && !bed().packed && bed().group.visible && w.fits(bed(), bed().x, bed().z) && !(w.building || []).length, { wasPacked, building: (w.building || []).length }));
    galReset();
  }
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
  { T.addObject('botprinter'); b.queue = []; b.step = null; b.choose('buildbot'); runUntil(() => b.pose === 'idle' && b.step && b.step.fx && b.step.fx.needs && b.step.t > 1, 90); w.removeObject('botprinter'); b.objectRemoved('botprinter'); b.skip(); T.settle(); delete w.removed.botprinter; }
  out.push(result('gal: take the machine away while he is using it and nothing is built, nothing is left half done, and he carries on', !gal.exists() && b.carry === null && (b.inMain() || b.inWorkshop()) && !(w.building || []).length && errors.length === base));
  } catch (e) { out.push(result('gal: the sweep threw: ' + e.message, false, { stack: String(e.stack).slice(0, 400) })); }
  w.restaurant.paused = false; w.restaurant.headless = false;
  galReset();
  T.removeAll(); T.settle(); machine().hidden = true; dev.all = false;
  out.push(result('gal: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 12b. Chapters: later parts of a book, learned by practice (skills.js CHAPTERS) --------------------------------------------------
T.sweepChapters = () => {
  const out = [], base = errors.length, b = B();
  const parents = Object.keys(CHAPTERS);
  // 1. the data hangs together
  out.push(result('chapters: every chapter belongs to a book skill, is numbered 2, 3 ... in order, needs more practice than the one before, and has something it lets him do',
    parents.every((p) => p in SKILL_INFO && p in PRACTICE_ACTS && CHAPTERS[p].every((c, i) => c.id === `${p}.ch${i + 2}` && c.title && c.unlocks.length && (!i || c.after > CHAPTERS[p][i - 1].after))), { parents }));
  out.push(result('chapters: the manifest lists every chapter (and nothing that is gone)', CHAPTER_IDS.every((id) => id in MANIFEST.chapters) && Object.keys(MANIFEST.chapters).every((id) => CHAPTER_IDS.includes(id))));
  out.push(result('chapters: the practice activities of every book are real activities', Object.values(PRACTICE_ACTS).flat().every((a) => a in b.activities())));
  // 2. each chapter has content behind it, and it is gated on that chapter
  const strumNeeds = new Set([...Object.values(PATTERN_NEEDS), ...PROGRESSIONS.map((p) => p.needs).filter(Boolean)]);
  for (const id of CHAPTER_IDS) {
    const c = MANIFEST.chapters[id];
    const has = c.content === 'steps' ? true : c.content === 'songs' ? SONG_NEEDS.includes(id) : c.content === 'strum' ? strumNeeds.has(id) : c.styles.every((st) => DRUM_STYLES.includes(st));
    out.push(result(`chapters: ${id} has ${c.content} behind it`, has));
  }
  // 3. the tunes: every one is well formed
  const songs = allSongs();
  const badSong = songs.filter((sg) => !sg.events.length || !(sg.bpm >= 40 && sg.bpm <= 200) || sg.events.some((e) => !Number.isFinite(e.beat) || e.beat < 0 || !(e.dur > 0)) ||
    sg.events.flatMap((e) => [...(e.r || []), ...(e.l || [])]).some((m) => !Number.isFinite(m) || m < 36 || m > 96) || Math.max(...sg.events.map((e) => e.beat + e.dur)) < 12);
  out.push(result(`chapters: all ${songs.length} piano tunes are well formed (notes on the keyboard, a sane tempo, at least 12 beats long)`, !badSong.length, { bad: badSong.map((sg) => sg.name) }));
  out.push(result('chapters: no two piano tunes share a name', new Set(songs.map((sg) => sg.name)).size === songs.length));
  const draw = (has) => new Set(Array.from({ length: 400 }, () => randomSong(null, has).name));
  const names = (need) => new Set(songs.filter((sg) => sg.needs === need).map((sg) => sg.name));
  const basic = draw((k) => k === 'piano'), ch2 = draw((k) => k === 'piano' || k === 'piano.ch2');
  out.push(result('chapters: with only the basic piano book he plays none of the chapter tunes', [...basic].every((n) => !CHAPTER_IDS.some((id) => names(id).has(n)))));
  out.push(result('chapters: with chapter 2 he plays its tunes (all of them in 400 goes) and none from chapter 3', [...names('piano.ch2')].every((n) => ch2.has(n)) && [...names('piano.ch3')].every((n) => !ch2.has(n))));
  out.push(result('chapters: advanced-book chapters need the advanced book chapter, not just the basic one', [...draw((k) => k !== 'piano.advanced.ch2' && k !== 'piano.advanced.ch3')].every((n) => !names('piano.advanced.ch2').has(n) && !names('piano.advanced.ch3').has(n))));
  // 4. practice unlocks them, in order
  const sk = new Skills('none');
  sk.learn('piano');
  const gotNow = [];
  sk.onChapter((c) => gotNow.push(c.id));
  sk.practice('sitpiano'); sk.practice('jam');
  out.push(result('chapters: two practice sessions are not enough for chapter 2 (it needs three)', !sk.has('piano.ch2') && sk.progress('piano').done === 2 && sk.progress('piano').of === 3));
  const g3 = sk.practice('piano');
  out.push(result('chapters: the third practice session teaches chapter 2, and the listener hears of it once', g3.length === 1 && sk.has('piano.ch2') && gotNow.join() === 'piano.ch2' && sk.has('piano') && !sk.has('piano.ch3')));
  for (let i = 0; i < 4; i++) sk.practice('piano');
  out.push(result('chapters: chapter 3 waits for its own count (not there after 7 sessions)', !sk.has('piano.ch3')));
  sk.practice('piano');
  out.push(result('chapters: chapter 3 comes at the eighth session; there is nothing left to wait for', sk.has('piano.ch3') && sk.progress('piano') === null));
  sk.practice('stargaze'); sk.practice('bang');
  out.push(result('chapters: practising something else counts for nothing here', !sk.has('guitar.ch2') && (sk.practiced.get('guitar') || 0) === 0));
  out.push(result('chapters: practice does not count for a skill he does not know (no advanced piano yet)', !sk.practiced.has('piano.advanced')));
  // 5. forgetting the book fades the chapters with it; practice stops while it fades; they are gone together
  sk.forget('piano');
  const was = sk.practiced.get('piano');
  sk.practice('piano');
  out.push(result('chapters: forgetting a book makes its chapters fade too, and fading skills are not practised', sk.fading.has('piano.ch2') && sk.fading.has('piano.ch3') && sk.practiced.get('piano') === was));
  sk.learn('piano');
  out.push(result('chapters: reading the book again brings its chapters back in full', !sk.fading.has('piano') && !sk.fading.has('piano.ch2') && !sk.fading.has('piano.ch3') && sk.has('piano.ch3')));
  sk.forget('piano');
  for (let i = 0; i < 400; i++) sk.tick(1);
  out.push(result('chapters: a forgotten book takes its chapters and its practice count with it', !sk.has('piano') && !sk.has('piano.ch2') && !sk.has('piano.ch3') && !sk.practiced.has('piano')));
  // 6. saved, per robot
  const keys = { known: 'guy.test.chap.k', fade: 'guy.test.chap.f' };
  const clean = () => ['guy.test.chap.k', 'guy.test.chap.f', 'guy.test.chap.k.practice'].forEach((k) => { try { localStorage.removeItem(k); } catch { /* no storage */ } });
  clean();
  const a = new Skills(null, keys); a.learn('guitar'); a.practice('riff'); a.practice('guitar');
  const a2 = new Skills(null, keys);
  out.push(result('chapters: the practice count is saved and comes back on the next visit', a2.practiced.get('guitar') === 2 && a2.progress('guitar').done === 2));
  a2.practice('jamguitar');
  out.push(result('chapters: a chapter learned by practice is still there on the next visit', new Skills(null, keys).has('guitar.ch2')));
  clean();
  out.push(result('chapters: GAL counts her practice separately from GUY (her own save key)', new Skills(null, { known: 'guy.gal.skills.v1', fade: 'guy.gal.fade.v1' }).keys.practice !== new Skills(null).keys.practice));
  out.push(result('chapters: skills=all includes every chapter', (() => { const all = new Skills('all'); return CHAPTER_IDS.every((id) => all.has(id)); })()));
  // 7. the guitar and the drums use only what he has learned
  const has1 = (k) => k === 'guitar';
  const gs = Array.from({ length: 300 }, () => makeStrum(has1));
  out.push(result('chapters: with only the basic guitar book none of the new patterns or chord progressions turn up', gs.every((x) => !PATTERN_NEEDS[x.pat] && !PROGRESSIONS.some((p) => p.needs && p.name === x.name))));
  const gs2 = Array.from({ length: 400 }, () => makeStrum(() => true));
  out.push(result('chapters: with every chapter all the new patterns and progressions turn up', Object.keys(PATTERN_NEEDS).every((p) => gs2.some((x) => x.pat === p)) && PROGRESSIONS.filter((p) => p.needs).every((p) => gs2.some((x) => x.name === p.name))));
  const hitsOf = (style) => { const pads = new Set(); let n = 0; for (let i = 0; i < 64; i++) for (const h of drumStep(style, i)) { n++; pads.add(h.k); if (!(h.k in PAD_SIDE) && h.k !== 'kick') return null; if (!['L', 'R', 'F'].includes(h.h) || !(h.v > 0 && h.v <= 1)) return null; } return { n, pads: pads.size }; };
  out.push(result(`chapters: every drum style (${DRUM_STYLES.length}) plays real pads with the right hands, at a sensible loudness`, DRUM_STYLES.every((st) => { const h = hitsOf(st); return h && h.n >= 16; }), { bad: DRUM_STYLES.filter((st) => !hitsOf(st)) }));
  const styleOf = (act) => { const st = b.activities()[act]().find((x) => x && x.type === 'play' && x.fx && x.fx.style); return st && st.fx.style; };
  const sk0 = skillsOf();
  T.addObject('drums'); T.settle();
  sk0.known.clear(); sk0.fading.clear(); T.learn(['drums', 'drums.solo']);
  const seen = (act, n = 150) => new Set(Array.from({ length: n }, () => styleOf(act)));
  const plain = seen('drums'), solo1 = seen('drumsolo');
  out.push(result('chapters: with only the basic drum books he plays none of the chapter grooves and solos', !['reggae', 'funk', 'paradiddle', 'halftime', 'bossa'].some((x) => plain.has(x)) && !solo1.has('solo2'), { plain: [...plain], solo1: [...solo1] }));
  T.learn(['drums.ch2', 'drums.ch3', 'drums.solo.ch2']);
  const full = seen('drums'), solo2 = seen('drumsolo');
  out.push(result('chapters: with the drum chapters learned the new grooves and the long solo turn up', ['reggae', 'funk', 'paradiddle'].every((x) => full.has(x)) && solo2.has('solo2') && solo2.has('solo'), { full: [...full], solo2: [...solo2] }));
  out.push(result('chapters: before chapter 4 of the drumming book he plays no half-time or bossa nova', !full.has('halftime') && !full.has('bossa'), { full: [...full] }));
  T.learn(['drums.ch4']);
  const slow = seen('drums', 200);
  out.push(result('chapters: with chapter 4 learned the half-time and bossa nova grooves turn up, and the older ones still do', ['halftime', 'bossa', 'rock', 'reggae', 'paradiddle'].every((x) => slow.has(x)), { slow: [...slow] }));
  // the two chapter 4 grooves are what they say: half-time has one snare a bar, on beat 3; the bossa nova's rim clicks follow a two-bar clave
  const at = (style, k, from = 0, to = 64) => { const out2 = []; for (let n = from; n < to; n++) if (drumStep(style, n).some((h) => h.k === k)) out2.push(n); return out2; };
  const half = at('halftime', 'snare'), bossaRim = at('bossa', 'snare'), rimBar = (n) => at('bossa', 'snare', n * 8, n * 8 + 8).map((x) => x % 8).join();
  out.push(result('chapters: half-time plays the snare once a bar, on beat 3, and keeps the kick on beat 1', half.length === 8 && half.every((n) => n % 8 === 4) && at('halftime', 'kick').filter((n) => n % 8 === 0).length === 8, { half }));
  out.push(result('chapters: the bossa nova rim clicks repeat every two bars, not every bar, and its kick lands on the and of 2', rimBar(0) !== rimBar(1) && rimBar(0) === rimBar(2) && rimBar(1) === rimBar(3) && bossaRim.length === 20 && at('bossa', 'kick').some((n) => n % 8 === 3), { bar0: rimBar(0), bar1: rimBar(1) }));
  // 8. in the game: starting an instrument activity is a practice session
  sk0.known.clear(); sk0.fading.clear(); sk0.practiced.clear(); T.learn(['piano']);
  T.addObject('piano'); T.addObject('bench'); T.settle();
  const toast = [], said = [], ui0 = b.ui;
  b.onChapter = (c) => toast.push(c.id);
  b.ui = (m) => { said.push(String(m)); return ui0(m); };
  for (let i = 0; i < 3; i++) { b.queue = []; b.step = null; b.skip(true); b.choose('piano'); }
  out.push(result('chapters: in the game, three goes at the piano teach chapter 2 and he says so', sk0.has('piano.ch2') && toast.join() === 'piano.ch2' && said.some((m) => /learned chapter 2/i.test(m)), { said: said.slice(-3), practiced: sk0.practiced.get('piano') }));
  b.onChapter = null; b.ui = ui0;
  b.queue = []; b.step = null; b.skip(true);
  T.removeAll(); sk0.known.clear(); sk0.fading.clear(); sk0.practiced.clear(); T.settle();
  // 9. chapters whose content is in the steps an activity builds (dance poses, lamp looks, painting plans, telescope and dusting rounds, drumming along)
  {
    const covered = new Set();
    const only = (...ids) => { sk0.known.clear(); sk0.fading.clear(); T.learn(ids); };
    const acts = () => b.activities();
    const posesOf = (act) => new Set([].concat(acts()[act]()).filter((x) => x && x.type === 'play').map((x) => x.pose));
    const manyPoses = (act, n = 60) => { const all = new Set(); for (let i = 0; i < n; i++) posesOf(act).forEach((p) => all.add(p)); return all; };
    T.addObject('table'); T.settle();
    // dance
    for (const [skill, act, ch2, ch3] of [['dance.moves', 'dancemoves', ['sprinkler', 'moonwalk'], ['headbang', 'armwave']], ['dance.ballroom', 'ballroom', ['tango', 'foxtrot'], ['jive', 'dip']]]) {
      only(skill);
      const base = manyPoses(act);
      out.push(result(`chapters: ${skill} with no chapters never dances the new moves`, [...ch2, ...ch3].every((p) => !base.has(p)), { base: [...base] }));
      only(skill, `${skill}.ch2`);
      const a = manyPoses(act);
      out.push(result(`chapters: ${skill}.ch2 brings in ${ch2.join(' and ')} and not the chapter 3 moves`, ch2.every((p) => a.has(p)) && ch3.every((p) => !a.has(p)), { a: [...a] }));
      only(skill, `${skill}.ch3`);
      const c = manyPoses(act);
      out.push(result(`chapters: ${skill}.ch3 brings in ${ch3.join(' and ')} and not the chapter 2 moves`, ch3.every((p) => c.has(p)) && ch2.every((p) => !c.has(p)), { c: [...c] }));
      covered.add(`${skill}.ch2`); covered.add(`${skill}.ch3`);
      out.push(result(`chapters: every dance pose of ${skill} exists`, [...ch2, ...ch3].every((p) => p in POSES)));
    }
    // secret dance moves: in no book or chapter, only once an electric guitar stands in the room
    {
      const secret = ['airguitar', 'windmill', 'kneeslide'];
      only('dance.moves', 'dance.moves.ch2', 'dance.moves.ch3', 'dance.ballroom');
      const before = new Set([...manyPoses('dancemoves'), ...manyPoses('dance'), ...manyPoses('ballroom')]);
      out.push(result('secret moves: with no electric guitar in the room nothing dances them', secret.every((p) => !before.has(p)), { before: [...before] }));
      T.addObject('eguitar'); T.settle();
      const moves = manyPoses('dancemoves'), free = manyPoses('dance');
      out.push(result('secret moves: once the electric guitar is there, the dance moves and the free dance bring them in', secret.every((p) => moves.has(p)) && secret.some((p) => free.has(p)), { moves: [...moves], free: [...free] }));
      only('dance.moves');
      const noBooks = manyPoses('dancemoves');
      out.push(result('secret moves: they need no book or chapter', secret.every((p) => noBooks.has(p)), { noBooks: [...noBooks] }));
      out.push(result('secret moves: every one has a pose, and none is mentioned in a book, chapter or the What\'s New list', secret.every((p) => p in POSES) && !JSON.stringify([SKILL_INFO, CHAPTERS, WHATS_NEW]).match(/air ?guitar|windmill|knee ?slide/i)));
    }
    // the lamp
    const base = lampLooks(() => false), c2 = lampLooks((k) => k === 'lighting.ch2'), c3 = lampLooks((k) => k === 'lighting.ch3');
    out.push(result('chapters: lighting looks: five to begin with, ch2 adds colours, ch3 adds moving looks', base.length === 5 && c2.length === 8 && c3.length === 8 && c2.every((l) => !l.animate) && c3.slice(5).every((l) => l.animate), { base: base.length, c2: c2.length, c3: c3.length }));
    const lamp = W().lamp;
    const moving = LAMP_LOOKS.filter((l) => l.animate);
    const seenColors = moving.map((l) => { lamp.setLook(l.color, l.base); lamp.animate(l.animate); const c0 = lamp.color.getHex(), i0 = lamp.base; lamp.tick(0); return { name: l.name, ok: Number.isFinite(lamp.base) && lamp.base > 0 && lamp.mode === l.animate, c: lamp.color.getHex() !== undefined && (c0 !== undefined || i0 !== undefined) }; });
    out.push(result('chapters: each moving lamp look runs in the lamp (mode kept, a sensible brightness)', seenColors.every((x) => x.ok), { seenColors }));
    lamp.set(false); lamp.set(true);
    out.push(result('chapters: switching the lamp off and on again ends a moving look', lamp.mode === 'normal'));
    covered.add('lighting.ch2'); covered.add('lighting.ch3');
    // painting
    const kinds = [['basic', null], ['dabs', null], ['bands', null], ['spiral', null], ['splash', null], ['mix', null], ['gradient', null], ['tints', null], ...['landscape', 'face', 'still life', 'seascape', 'skyline', 'night sky', 'robot'].map((sb) => ['portrait', sb])];
    const badPlans = kinds.filter(([kind, sb]) => {
      const plan = paintPlan(kind, false, sb), strokes = plan.segs.filter((x) => x.type === 'stroke');
      return !strokes.length || !(plan.total > 3 && plan.total < 120) || strokes.some((x) => !x.pts.length || x.pts.some(([u, v]) => !(u > -0.1 && u < 1.1 && v > -0.1 && v < 1.1)) || !(x.dur > 0) || !/^#[0-9a-f]{6}$/i.test(x.color)) || (sb && plan.subject !== sb);
    });
    out.push(result(`chapters: all ${kinds.length} painting plans are well formed (strokes on the canvas, valid colours, a sensible length, the subject asked for)`, !badPlans.length, { bad: badPlans.map((x) => x.join(':')) }));
    const subjectsSeen = (skills) => { only('easel.portrait', ...skills); const set = new Set(); for (let i = 0; i < 160; i++) { const st = [].concat(acts().portrait()); set.add(st[0]); } return set; };
    const labelsOf = (skillIds, act) => { only(...skillIds); const set = new Set(); for (let i = 0; i < 160; i++) set.add([].concat(acts()[act]())[0]); return set; };
    const pb = labelsOf(['easel'], 'paint'), p2 = labelsOf(['easel', 'easel.ch2'], 'paint'), p3 = labelsOf(['easel', 'easel.ch3'], 'paint');
    out.push(result('chapters: easel — plain painting to begin with; ch2 adds dabbing and broad bands; ch3 adds swirls and splashes', pb.size === 1 && p2.has('dabbing paint onto the canvas') && p2.has('laying down broad bands of colour') && !p2.has('painting a swirl') && p3.has('painting a swirl') && p3.has('flinging paint about') && !p3.has('dabbing paint onto the canvas'), { p2: [...p2], p3: [...p3] }));
    const mb = labelsOf(['easel.colour'], 'mixpaint'), m2 = labelsOf(['easel.colour', 'easel.colour.ch2'], 'mixpaint'), m3 = labelsOf(['easel.colour', 'easel.colour.ch3'], 'mixpaint');
    out.push(result('chapters: easel.colour — mixing to begin with; ch2 adds gradients; ch3 adds tints and shades', mb.size === 1 && m2.has('blending colours into a gradient') && !m2.has('painting tints and shades') && m3.has('painting tints and shades') && !m3.has('blending colours into a gradient'), { m2: [...m2], m3: [...m3] }));
    const ob = labelsOf(['easel.portrait'], 'portrait'), o2 = labelsOf(['easel.portrait', 'easel.portrait.ch2'], 'portrait'), o3 = labelsOf(['easel.portrait', 'easel.portrait.ch3'], 'portrait');
    out.push(result('chapters: easel.portrait — three subjects to begin with; ch2 adds a seascape and a skyline; ch3 a night sky and a robot', ob.size === 3 && o2.has('painting a seascape') && o2.has('painting a skyline') && !o2.has('painting a robot') && o3.has('painting a night sky') && o3.has('painting a robot') && !o3.has('painting a seascape'), { ob: [...ob], o2: [...o2], o3: [...o3] }));
    for (const id of ['easel.ch2', 'easel.ch3', 'easel.colour.ch2', 'easel.colour.ch3', 'easel.portrait.ch2', 'easel.portrait.ch3']) covered.add(id);
    // dusting
    T.removeAll(); T.settle();
    const dustN = (ids) => { only('decorate', ...ids); const st = [].concat(acts().dust()); return st.filter((x) => x && x.type === 'plan').length; };
    out.push(result('chapters: decorate — one piece dusted to begin with, two with ch2, three with ch3', dustN([]) === 1 && dustN(['decorate.ch2']) === 2 && dustN(['decorate.ch2', 'decorate.ch3']) === 3, { n: [dustN([]), dustN(['decorate.ch2']), dustN(['decorate.ch2', 'decorate.ch3'])] }));
    covered.add('decorate.ch2'); covered.add('decorate.ch3');
    // telescope
    T.addObject('telescope'); T.addObject('lamp'); T.settle();
    const cnt = (ids, act, pose) => { only(...ids); return [].concat(acts()[act]()).filter((x) => x && x.type === 'play' && x.pose === pose).length; };
    out.push(result('chapters: telescope — one target to begin with, two with ch2, three with ch3', cnt(['telescope'], 'stargaze', 'scopePeer') === 1 && cnt(['telescope', 'telescope.ch2'], 'stargaze', 'scopePeer') === 2 && cnt(['telescope', 'telescope.ch2', 'telescope.ch3'], 'stargaze', 'scopePeer') === 3));
    out.push(result('chapters: telescope.dark — ch2 waits for his eyes to adjust (a look round before the first look), ch3 watches two targets and looks up at the end', cnt(['telescope.dark'], 'darkstargaze', 'lookaround') === 0 && cnt(['telescope.dark', 'telescope.dark.ch2'], 'darkstargaze', 'lookaround') === 1 && cnt(['telescope.dark', 'telescope.dark.ch2', 'telescope.dark.ch3'], 'darkstargaze', 'lookaround') === 2 && cnt(['telescope.dark', 'telescope.dark.ch3'], 'darkstargaze', 'scopePeer') === 2 && cnt(['telescope.dark'], 'darkstargaze', 'scopePeer') === 1));
    out.push(result('chapters: telescope.care — ch3 cleans it twice; ch2 swings the tube level afterwards', cnt(['telescope.care'], 'scopecare', 'scopeCare') === 1 && cnt(['telescope.care', 'telescope.care.ch3'], 'scopecare', 'scopeCare') === 2 && (only('telescope.care'), [].concat(acts().scopecare()).length) + 1 === (only('telescope.care', 'telescope.care.ch2'), [].concat(acts().scopecare()).length)));
    for (const id of ['telescope.ch2', 'telescope.ch3', 'telescope.dark.ch2', 'telescope.dark.ch3', 'telescope.care.ch2', 'telescope.care.ch3']) covered.add(id);
    // drumming along: fills and sections
    T.addObject('drums'); T.settle();
    const jamFx = (ids) => { only('drums', 'drums.band', ...ids); const st = [].concat(acts().jamdrums()).find((x) => x && x.type === 'play' && x.fx && x.fx.drums); return st ? st.fx : {}; };
    out.push(result('chapters: drums.band — fills with ch2, verse and chorus with ch3, nothing before', !jamFx([]).fills && !jamFx([]).sections && jamFx(['drums.band.ch2']).fills && !jamFx(['drums.band.ch2']).sections && jamFx(['drums.band.ch2', 'drums.band.ch3']).sections));
    const bars = (style, opts, from, to) => Array.from({ length: (to - from) * 8 }, (_, k) => drumStep(style, from * 8 + k, opts));
    const fillBar = bars('rock', { fills: true }, 3, 4);
    out.push(result('chapters: the fill is on the last half of every fourth bar only (toms, a crash on the last beat), the rest is the groove', fillBar.slice(4).every((h) => h.some((x) => ['tom1', 'tom2', 'floor'].includes(x.k))) && fillBar[7].some((x) => x.k === 'crash') && bars('rock', { fills: true }, 0, 1).every((h, k) => JSON.stringify(h) === JSON.stringify(drumStep('rock', k))) && bars('rock', { fills: true }, 4, 5).every((h, k) => JSON.stringify(h) === JSON.stringify(drumStep('rock', 32 + k)))));
    const ride = (bar) => bars('rock', { sections: true }, bar, bar + 1).flat().some((x) => x.k === 'ride');
    out.push(result('chapters: the chorus (bars 9 to 16 of every sixteen) has the ride cymbal and a crash where it starts; the verse does not', !ride(0) && ride(8) && bars('rock', { sections: true }, 8, 9)[0].some((x) => x.k === 'crash') && !bars('rock', { sections: true }, 9, 10)[0].some((x) => x.k === 'crash') && !ride(16)));
    covered.add('drums.band.ch2'); covered.add('drums.band.ch3');
    // the ball and the yard sports
    {
      const poses = (act, ids) => { only(...ids); return [].concat(acts()[act]()).filter((x) => x && x.type === 'play').map((x) => x.pose); };
      const n = (list, p) => list.filter((x) => x === p).length;
      T.prep('goalshot'); T.prep('hoopshoot'); T.prep('dribble'); T.settle();
      const base = ['ball'];
      out.push(result('chapters: ball — dribble and toss once to begin with; ch2 doubles the dribble and tosses twice; ch3 ends the dribble in a toss and tosses three times',
        n(poses('dribble', base), 'dribble') === 1 && n(poses('dribble', base), 'toss') === 0 && n(poses('toss', base), 'toss') === 1
        && n(poses('dribble', [...base, 'ball.ch2']), 'dribble') === 2 && n(poses('toss', [...base, 'ball.ch2']), 'toss') === 2
        && n(poses('dribble', [...base, 'ball.ch3']), 'toss') === 1 && n(poses('toss', [...base, 'ball.ch3']), 'toss') === 2 && n(poses('toss', [...base, 'ball.ch2', 'ball.ch3']), 'toss') === 3));
      const kicks = (ids) => { only(...ids); return [].concat(acts().ball()).filter((x) => x && x.type === 'plan').length; };
      out.push(result('chapters: ball.ch3 — three kicks in a row (one to begin with)', kicks(['ball']) === 1 && kicks(['ball', 'ball.ch2']) === 1 && kicks(['ball', 'ball.ch3']) === 3));
      const len = (act, ids) => { only(...ids); return [].concat(acts()[act]()).length; };
      const gk = b.goalKick(0.5).length, hs = b.hoopShot(0.5).length;
      out.push(result('chapters: outdoor.soccer.ch2 adds two shots at the goal; ch3 three tosses', len('goalshot', ['outdoor.soccer']) + 2 * gk === len('goalshot', ['outdoor.soccer', 'outdoor.soccer.ch2'])
        && len('goalshot', ['outdoor.soccer']) === len('goalshot', ['outdoor.soccer', 'outdoor.soccer.ch3']) && n(poses('soccertoss', ['outdoor.soccer']), 'toss') === 1 && n(poses('soccertoss', ['outdoor.soccer', 'outdoor.soccer.ch3']), 'toss') === 3));
      out.push(result('chapters: outdoor.basketball.ch2 adds two shots at the hoop; ch3 a longer dribble ending in a toss', len('hoopshoot', ['outdoor.basketball']) + 2 * hs === len('hoopshoot', ['outdoor.basketball', 'outdoor.basketball.ch2'])
        && n(poses('hoopdribble', ['outdoor.basketball']), 'dribble') === 1 && n(poses('hoopdribble', ['outdoor.basketball', 'outdoor.basketball.ch3']), 'dribble') === 2 && n(poses('hoopdribble', ['outdoor.basketball', 'outdoor.basketball.ch3']), 'toss') === 1));
      const warm = (ids, act) => { const p = poses(act, ['outdoor.soccer', 'outdoor.basketball', 'outdoor', ...ids]); const sp = ['kick', 'toss', 'shoot', 'dribble'], ci = p.indexOf('cooldown'), wi = p.indexOf('warmup'), first = p.findIndex((x) => sp.includes(x)); return [n(p, 'warmup'), n(p, 'cooldown'), wi < 0 || first < 0 || wi < first, ci < 0 || !p.slice(ci).some((x) => sp.includes(x))]; };
      const okAll = ['goalshot', 'soccertoss', 'hoopshoot', 'hoopdribble'].every((act) => {
        const w0 = warm([], act), w2 = warm(['outdoor.ch2'], act), w3 = warm(['outdoor.ch3'], act);
        return w0[0] === 0 && w0[1] === 0 && w2[0] === 1 && w2[1] === 0 && w3[0] === 0 && w3[1] === 1 && w2[2] && w3[3];
      });
      out.push(result('chapters: outdoor — ch2 warms up before each yard sport, ch3 cools down after it, neither to begin with', okAll));
      out.push(result('chapters: the warmup and cooldown poses exist', 'warmup' in POSES && 'cooldown' in POSES));
      for (const id of ['ball.ch2', 'ball.ch3', 'outdoor.ch2', 'outdoor.ch3', 'outdoor.soccer.ch2', 'outdoor.soccer.ch3', 'outdoor.basketball.ch2', 'outdoor.basketball.ch3']) covered.add(id);
      T.resetRooms && T.resetRooms();
    }
    // the telescope with no room to swing it round: not started (the play sweep caught him trying again and again)
    {
      T.addObject('telescope'); T.settle(); only('telescope', 'telescope.dark');
      const real = b.scopeAimPlan, ok1 = b.availableIn('stargaze') && b.availableIn('darkstargaze');
      b.scopeAimPlan = () => null;
      const none = !b.availableIn('stargaze') && !b.availableIn('darkstargaze');
      b.scopeAimPlan = real;
      out.push(result('chapters: telescope — stargazing is not started when there is no room to swing the tube round', ok1 && none, { ok1, none }));
      T.removeAll(); T.settle();
    }
    // the workshop books
    {
      T.addObject('toolbox'); T.settle();
      const fs = (rid, fid, ids) => { only('workshop', 'workshop.materials', 'workshop.furniture', 'workshop.metal', ...ids); return b.factorySteps(rid, fid, true).filter((x) => x.type === 'play'); };
      const cnt = (list, pose) => list.filter((x) => x.pose === pose).length;
      const reach = (list) => cnt(list, 'reach');
      only('workshop', 'workshop.ch2'); const tb2 = b.toolboxSteps().filter((x) => x.type === 'play').length; only('workshop'); const tb1 = b.toolboxSteps().filter((x) => x.type === 'play').length;
      out.push(result('chapters: workshop.ch2 — two more tools sorted in the toolbox (three reaches to begin with)', tb1 === 3 && tb2 === 5, { tb1, tb2 }));
      const base = fs('builtchair', 'woodfactory', []);
      out.push(result('chapters: workshop.ch3 — a look round before the factory is started, not to begin with', cnt(base, 'lookaround') === 0 && cnt(fs('builtchair', 'woodfactory', ['workshop.ch3']), 'lookaround') === 1 && fs('builtchair', 'woodfactory', ['workshop.ch3'])[0].pose === 'lookaround'));
      out.push(result('chapters: workshop.materials ch2 inspects and ch3 sands the piece on the wood factory\'s tray (and not on the metal one)', reach(fs('footstool', 'woodfactory', ['workshop.materials.ch2'])) === reach(base) + 1
        && reach(fs('footstool', 'woodfactory', ['workshop.materials.ch3'])) === reach(base) + 1 && fs('footstool', 'woodfactory', ['workshop.materials.ch3']).some((x) => x.dur === 4.2)
        && reach(fs('metalchair', 'metalfactory', ['workshop.materials.ch2', 'workshop.materials.ch3'])) === reach(fs('metalchair', 'metalfactory', []))));
      out.push(result('chapters: workshop.furniture.ch2 presses on a new chair, table or bookshelf to test it, but not on a foot stool or a guitar', reach(fs('builtchair', 'woodfactory', ['workshop.furniture.ch2'])) === reach(base) + 1
        && reach(fs('diningtable3', 'woodfactory', ['workshop.furniture.ch2'])) === reach(fs('diningtable3', 'woodfactory', [])) + 1 && reach(fs('footstool', 'woodfactory', ['workshop.furniture.ch2'])) === reach(fs('footstool', 'woodfactory', []))
        && reach(fs('eguitar', 'woodfactory', ['workshop.furniture.ch2'])) === reach(fs('eguitar', 'woodfactory', []))));
      out.push(result('chapters: workshop.metal.ch2 knocks twice on a metal piece (two reaches more, each with a knock)', reach(fs('metalchair', 'metalfactory', ['workshop.metal.ch2'])) === reach(fs('metalchair', 'metalfactory', [])) + 2));
      const cap = (id, ids) => { only(...ids); return b.capOf(RECIPES_DEF[id]); };
      out.push(result('chapters: Matching Sets — one more wooden chair and table with workshop.furniture.ch3, one more metal ones with workshop.metal.ch3, nothing else changes',
        cap('builtchair', []) === 3 && cap('builtchair', ['workshop.furniture.ch3']) === 4 && cap('diningtable3', ['workshop.furniture.ch3']) === 3 && cap('bookshelf2', ['workshop.furniture.ch3']) === 1 && cap('footstool', ['workshop.furniture.ch3']) === 1
        && cap('metalchair', ['workshop.furniture.ch3']) === 3 && cap('metalchair', ['workshop.metal.ch3']) === 4 && cap('diningtable4', ['workshop.metal.ch3']) === 3 && cap('builtchair', ['workshop.metal.ch3']) === 3 && cap('eguitar', ['workshop.metal.ch3']) === 1));
      for (const id of ['workshop.ch2', 'workshop.ch3', 'workshop.materials.ch2', 'workshop.materials.ch3', 'workshop.furniture.ch2', 'workshop.furniture.ch3', 'workshop.metal.ch2', 'workshop.metal.ch3', 'workshop.materials.ch4', 'workshop.materials.ch5', 'bowling.ch2', 'bowling.ch3']) covered.add(id);      // (the last four: sweepBowl)
    }
    const missing = CHAPTER_IDS.filter((id) => MANIFEST.chapters[id].content === 'steps' && !covered.has(id));
    out.push(result('chapters: every chapter whose content is in an activity\'s steps has a check above', !missing.length, { missing }));
    T.removeAll(); sk0.known.clear(); sk0.fading.clear(); sk0.practiced.clear(); T.settle();
  }
  out.push(result('chapters: no errors', errors.length === base, { errors: errors.slice(base) }));
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

// GUY's paintings (paintings.js / paintbrain.js): hanging from the easel's menu, the three-per-wall limit, replacing the oldest, every
// room's walls, the Catalog, saving, and being cut short.
T.sweepPaintings = () => {
  const out = [], base = errors.length, w = W(), b = B(), P = w.paintings;
  const COLS = ['#d0312d', '#2a62d8', '#f2c500', '#2e9e4a', '#8e44ad', '#e67e22', '#16a085', '#c0392b', '#34495e', '#e84393'];
  let ci = 0;
  const easel = () => w.objects.easel;
  const paintIt = () => { const e = easel(); e.paint.dab(0.5, 0.5, COLS[ci % COLS.length], 60); e.paint.stroke(0.1, 0.2, 0.9, 0.8, COLS[(ci + 3) % COLS.length], 14); e.painted = true; ci++; };
  const fresh = () => { T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home(); T.addObject('easel'); easel().paint.clear(); easel().painted = false; P.reset(); };
  // paint something and ask for it to be hung (through the real menu button if asked); follow GUY until it is done
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

    // 2. one painting through the real button: off the easel, carried, hung on a main-room wall by GUY's choice, he stands in front of it
    fresh();
    const one = hangOne({ viaMenu: true });
    const rec = one.rec, d = rec && w.decor[P.name(rec)], F = rec && w.wallFrame(rec.wall);
    const wallPt = F && F.at(rec.u, 0), dist = wallPt && one.at ? Math.hypot(one.at.x - wallPt.x, one.at.z - wallPt.z) : 99;
    out.push(result('paintings: "Hang painting" sends GUY to the easel, he takes the painting off (the easel is blank), carries it and hangs it on a wall', one.ok && !!d && !P.easelHas() && !easel().painted && P.hung().length === 1 && rec.room === 'main' && !b.carry && !P.carried, { ok: one.ok, secs: one.secs, rec }));
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
    const head = [...machine().querySelectorAll('h4')].find((h) => /GUY's paintings/.test(h.textContent));
    const cards = head ? [...head.closest('.sec').querySelectorAll('.card')] : [];          // (each section's cards are in its own box under its heading)
    const thumbs = cards.filter((c) => c.querySelector('img.thumb') && /^data:image\//.test(c.querySelector('img.thumb').getAttribute('src'))).length;
    out.push(result('paintings: the Catalog lists every painting with a thumbnail of the picture', !!head && cards.length === P.items.length && thumbs === P.items.length, { cards: cards.length, items: P.items.length, thumbs }));
    const takeBtn = cards.map((c) => [...c.querySelectorAll('.act.rm')].find((x) => /Take down/.test(x.textContent))).find(Boolean);
    const total0 = P.items.length, hung0 = P.hung().length;
    if (takeBtn) takeBtn.click();
    out.push(result('paintings: "Take down" in the Catalog takes a painting off its wall into storage (still listed)', P.hung().length === hung0 - 1 && P.items.length === total0 && allFit(), { hung0, now: P.hung().length }));
    openObjects('all');
    const delBtn = [...machine().querySelectorAll('.card')].filter((c) => c.querySelector('img.thumb') && /Hang it/.test(c.textContent)).map((c) => [...c.querySelectorAll('.act.rm')].find((b) => /Destroy/.test(b.textContent)))[0];
    const total1 = P.items.length;
    if (delBtn) delBtn.click();                                 // (first tap: only asks)
    const keptOnNo = P.items.length === total1;
    const delBtn2 = [...machine().querySelectorAll('.card .act.rm')].find((x) => /Really destroy/.test(x.textContent));
    if (delBtn2) delBtn2.click();
    out.push(result('paintings: "Destroy" in the Catalog asks first (a second tap), then removes the painting from the inventory for good', !!delBtn && !!delBtn2 && keptOnNo && P.items.length === total1 - 1 && allFit(), { total1, now: P.items.length }));
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

// ---- 23. Mowing the whole lawn, judged as it is played: the mower covers the lawn in lanes, he stays behind it and steers it round in
// smooth turns, and it ends up back in the shed (src/yardbrain.js mowCoverage / mowCover, brain.js driveStep) ----
T.sweepMowing = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  unlockRoom('backyard'); R().add('backyard');
  for (const id of ['soccergoal', 'basketballhoop', 'lawnchair', 'shed', 'mower', 'birdbath', 'skyswitch']) T.addObject(id);
  T.learn(['outdoor']); T.settle();
  // told to mow with the mower standing hard against the fence (where no rectangular loop would fit behind it): the order is taken
  { const mw = w.objects.mower; if (mw) mw.set(10, -2.5);
    b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null;
    const r0 = b.interact('shed'), why = b.whyNot('mow');
    out.push(result('mowing: told to mow (from the shed) with the mower standing against the fence, he takes the order (no refusal)', r0.ok && b.available('mow'), { r0, why }));
    b.queue = []; b.step = null; b.pendingActivity = null; b.unlock(false); b.last = 'wander'; if (mw) mw.set(9.2, 0.8); T.settle(); }
  // told to use the workstation while out in the yard (it stands in his own room): the order is taken, he walks back and opens it
  { const wasDev = dev.all; dev.all = true; w.addNew('workstation', null); dev.all = wasDev;
    b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.choose('yardsit');
    let ty = 0; while (ty < 90 && !b.inYard()) { step(0.25); ty += 0.25; }
    const inYard = b.inYard(); let opened = false; const was = b.onWorkstation; b.onWorkstation = () => { opened = true; };
    const r1 = b.interact('workstation'); let tw = 0; while (tw < 90 && !opened) { step(0.25); tw += 0.25; }
    b.onWorkstation = was;
    out.push(result('mowing: told to use the workstation from out in the yard, he takes the order, walks back and opens it', inYard && r1.ok && opened, { inYard, r1, opened, tw }));
    if (w.objects.workstation) { w.removeObject('workstation'); b.objectRemoved('workstation'); }
    b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; T.home(); T.settle(); }
  b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander';
  b.choose('mow');
  const st = { drive: 0, push: 0, off: 0, maxBeside: 0, maxV: 0, maxTurn: 0, minD: 9, maxD: 0 };
  let t = 0, last = { x: g.pos.x, z: g.pos.z }, lastYaw = null;
  while (t < 600 && b.last === 'mow') {
    step(0.05); t += 0.05;
    const s = b.step, m = w.objects.mower, v = Math.hypot(g.pos.x - last.x, g.pos.z - last.z) / 0.05;
    last = { x: g.pos.x, z: g.pos.z };
    if (s && s.type === 'walk' && s.push && !s.drive) st.push++;
    if (s && s.drive && m) {
      st.drive++;
      st.maxV = Math.max(st.maxV, v);
      const d = Math.hypot(m.x - g.pos.x, m.z - g.pos.z);
      st.minD = Math.min(st.minD, d); st.maxD = Math.max(st.maxD, d);
      const hy = m.group.rotation.y + Math.PI, fx = Math.sin(hy), fz = Math.cos(hy);          // where the mower points
      const bx = (m.x - g.pos.x) / (d || 1), bz = (m.z - g.pos.z) / (d || 1);                 // from him to the mower
      st.maxBeside = Math.max(st.maxBeside, Math.acos(Math.max(-1, Math.min(1, fx * bx + fz * bz))));
      if (lastYaw !== null) { let dy = hy - lastYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; st.maxTurn = Math.max(st.maxTurn, Math.abs(dy) / 0.05); }
      lastYaw = hy;
    } else lastYaw = null;
  }
  const bd = w.doors.backyard.shell.bounds, pts = w.yard.cut().points(), obs = w.obstacles.filter((o) => o.active !== false);
  let free = 0, cut = 0;
  for (let z = bd.minZ + 0.5; z <= bd.maxZ - 0.5; z += 0.25) for (let x = bd.minX + 0.5; x <= bd.maxX - 0.5; x += 0.25) {
    if (obs.some((o) => x > o.x0 - 0.45 && x < o.x1 + 0.45 && z > o.z0 - 0.45 && z < o.z1 + 0.45)) continue;
    free++; if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.3)) cut++;
  }
  const pct = free ? cut / free : 0;
  out.push(result('mowing: the whole lawn is cut, not one square (at least 85% of the open grass has a cut patch)', pct >= 0.85, { pct: +pct.toFixed(3), free, cut, patches: pts.length }));
  out.push(result('mowing: it takes a good few passes: he steers the mower for a long time, in the shed again at the end', st.drive > 400 && w.yard.isStowed('mower') && b.last !== 'mow', { driveFrames: st.drive, inShed: w.yard.isStowed('mower'), t }));
  out.push(result('mowing: he always stands straight behind the mower (never beside it), a handle\'s length away', st.maxBeside < 0.3 && st.minD > 0.7 && st.maxD < 0.9, { maxBesideRad: +st.maxBeside.toFixed(2), minD: +st.minD.toFixed(2), maxD: +st.maxD.toFixed(2) }));
  out.push(result('mowing: the mower is never shoved sideways (every move is steered from behind)', st.push === 0, { pushFrames: st.push }));
  out.push(result('mowing: the turns are smooth: the mower swings round at less than 2.8 rad/s and he never has to run (under 3.4 m/s at game speed)', st.maxTurn < 2.8 && st.maxV < 3.4, { maxTurn: +st.maxTurn.toFixed(2), maxV: +st.maxV.toFixed(2) }));
  const sh = w.objects.shed;
  out.push(result('mowing: the shed door is shut again afterwards', !!sh && sh.openTo === 0, { openTo: sh && sh.openTo }));
  T.resetRooms();
  out.push(result('mowing: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 24. Reading: nothing is read twice, and a shelf with no room in front of it is not walked at (brain.js wantsBook / bookStandOk) ----
T.sweepReading = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); skillsOf().fading.clear(); T.settle(); T.home();
  const sh = w.objects.shelf, home = { x: sh.x, z: sh.z, rot: sh.rot };
  try {
    const recs = () => sh.books.filter((r) => r.mesh.visible);
    const ids = recs().map((r) => r.def.teaches);
    out.push(result('reading: with nothing learned yet every book on the shelf is worth reading', b.readableBooks().length === recs().length && recs().length >= 2, { n: b.readableBooks().length }));
    // 1. a book already read is not read again
    const first = recs()[0];
    skillsOf().learn(first.def.teaches);
    const left = b.readableBooks();
    out.push(result('reading: a book he has already read is not on his list any more', !left.some((r) => r === first) && left.length === recs().length - 1));
    const rq = b.requestRead(first.def.id);
    out.push(result('reading: told to read a book he knows, he says so and does not go', !rq.ok && /already knows/.test(rq.message) && b.pendingActivity !== 'read', { rq }));
    // 2. ...until it is marked forgotten
    skillsOf().forget(first.def.teaches);
    out.push(result('reading: a book put back in the Catalog (its skill is fading) is worth reading again', b.readableBooks().some((r) => r === first)));
    skillsOf().fading.clear();
    // 3. everything read: he does not choose to read, and an order to use the shelf says why
    for (const t of ids) skillsOf().learn(t);
    out.push(result('reading: with everything on the shelf read he does not set out to read', !b.available('read') && b.readableBooks().length === 0));
    b.queue = []; b.step = null; b.pendingActivity = null;
    const ord = b.interact('shelf');
    out.push(result('reading: told to use the shelf when he has read it all, he says so', !ord.ok && /already read everything/.test(ord.message), { ord }));
    const steps = b.readSteps();
    out.push(result('reading: even if asked for a read there is nothing to pick up (no book is taken)', steps.length === 2 && !steps.some((x) => x.type === 'play' && x.pose === 'grab'), { n: steps.length }));
    // 4. the order GAL was given for a book she has read is dropped
    const gal = w.gal;
    skillsOf().fading.clear(); T.forget();
    // 5. a shelf in a corner: nobody can stand in front of it, so nobody walks at it
    sh.rot = 0; sh.set(-4.3, -3.2);
    out.push(result('reading: a shelf pushed into a corner has no standing room: its books are not on the list and he does not set out to read', b.readableBooks().length === 0 && !b.available('read') && recs().every((r) => !b.bookStandOk(r))));
    sh.rot = home.rot; sh.set(home.x, home.z);
    out.push(result('reading: back by the wall he can read again', b.readableBooks().length > 0 && recs().every((r) => b.bookStandOk(r))));
    void gal;
  } finally { sh.rot = home.rot; sh.set(home.x, home.z); T.forget(); skillsOf().fading.clear(); }
  out.push(result('reading: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 25. Playing together: GAL joins GUY's basketball (defence) and soccer (goalkeeper), and the other way round (yardbrain.js) ----
T.sweepSports = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  galReset();
  try {
    unlockRoom('backyard'); R().add('backyard');
    for (const id of ['soccergoal', 'basketballhoop']) T.addObject(id);
    T.learn(['outdoor', 'outdoor.soccer', 'outdoor.basketball']); T.settle();
    out.push(result('sports: GAL is built', galBuild().ok));
    const gal = w.gal, gb = gal.brain;
    b.inviteChance = 1; gb.inviteChance = 1;                                // (in the real game it is half the time: here every game is an invitation, so the sweep sees all of it)
    for (const id of ['outdoor', 'outdoor.soccer', 'outdoor.basketball']) gb.skills.known.add(id);
    const stopAll = () => { for (const x of [b, gb]) { x.unlock(false); x.queue = []; x.step = null; x.pendingActivity = null; x.last = 'wander'; x.using = new Set(); } };
    // She (or he) really is free when the game starts: in GUY's room, nothing in hand, idle. Only marked free while standing out in the yard, the first
    // thing she did was walk out of it, could not be called off that, and came back out to the hoop in time to be leaving again at the next game.
    const bringIn = (x) => {
      let t = 0;
      while (t < 120 && !(x.inMain() && !x.held && !x.ballHeld && x.last === 'wander')) { if (!x.held && !x.ballHeld && !x.pendingActivity) x.pendingActivity = x.inMain() ? 'wander' : 'leave'; step(0.25); t += 0.25; }
      x.pendingActivity = null; x.queue = [x.walk(-3, 2.2), x.play('idle', 200)]; x.step = null; x.last = 'wander'; x.using = new Set();       // (away from the yard door: stood in it she keeps the other from going out, and he gives up)
    };
    const play = (shooter, other, act, partnerPose, maxGames, kind) => {
      const seen = { poses: new Set(), joined: 0, games: 0, near: 0, between: 0, frames: 0, minD: 9, errs: errors.length };
      const hoop = w.objects[kind === 'basketball' ? 'basketballhoop' : 'soccergoal'];
      for (let game = 0; game < maxGames && !seen.poses.has(partnerPose.second); game++) {
        stopAll();
        for (const [k, id, d] of [['soccer', 'soccergoal', 2.6], ['basketball', 'basketballhoop', 1.6]]) {            // (each ball back in its place in front of its goal)
          const o = w.objects[id], ball = w.yard.balls[k]; if (!o || !ball) continue;
          const p = o.at(0, 0, d); ball.position.set(p.x, ball.userData.r || 0.12, p.z); ball.userData.vel.set(0, 0, 0); ball.userData.kinematic = false;
        }
        bringIn(other); T.settle(); bringIn(other);      // (settling tidies GUY up; if he is the one to be invited it moves him, so he is made free again after it)
        if (shooter !== b) bringIn(shooter);
        shooter.choose(act); seen.games++;
        const why = () => ({ otherLast: other.last, avail: other.available(kind === 'basketball' ? 'hoopdefend' : 'goalkeep'), whyNot: other.whyNot(kind === 'basketball' ? 'hoopdefend' : 'goalkeep'), pend: other.pendingActivity, lock: !!other.lock, stuck: other.stuckIn(), skills: [...other.skills.known].join(','), shooterLast: shooter.last, inYard: shooter.inYard(), playing: shooter.sportPlaying(kind), galIn: other.inYard() });
        let t = 0, joinedThis = false; const tl = []; let tprev = '';
        while (t < 150 && shooter.last === act && (shooter.step || shooter.queue.length)) {
          step(0.1); t += 0.1;
          { const k = shooter.last + ':' + (shooter.step ? shooter.step.type + (shooter.step.pose || '') : '-') + ' q' + shooter.queue.length + (shooter.inYard() ? 'Y' : 'n') + ' b' + (shooter.stuckIn() || ''); if (k !== tprev) { tl.push(t.toFixed(1) + ' ' + k); tprev = k; } }
          if (other.last === (kind === 'basketball' ? 'hoopdefend' : 'goalkeep')) { joinedThis = true; if (other.step) seen.poses.add(other.pose); }
          if (other.pose === partnerPose.first && other.step && hoop) {
            seen.frames++;
            const sp = shooter.g.root.position, op = other.g.root.position, d = Math.hypot(sp.x - op.x, sp.z - op.z);
            seen.minD = Math.min(seen.minD, d);
            if (kind === 'basketball') {                      // between him and the hoop: close to the line from the shooter to the hoop, and nearer the hoop than he is
              const hx = hoop.x - sp.x, hz = hoop.z - sp.z, hl = Math.hypot(hx, hz) || 1, along = ((op.x - sp.x) * hx + (op.z - sp.z) * hz) / hl, off = Math.abs(((op.x - sp.x) * hz - (op.z - sp.z) * hx) / hl);
              if (along > 0.3 && off < 0.8 && d < 2.2) seen.between++;
            } else if (Math.hypot(op.x - hoop.x, op.z - hoop.z) < 2.0) seen.between++;
          }
        }
        if (joinedThis) seen.joined++;
        if (!joinedThis && game === 0) seen.why = why();
        if (t < 12) (seen.short ||= []).push(tl.slice(0, 12));
        (seen.log ||= []).push([joinedThis ? 1 : 0, +t.toFixed(0), other.last, shooter.last, !!shooter.step, shooter.queue.length, shooter.inYard()]);
      }
      seen.errs = errors.length - seen.errs;
      return seen;
    };
    // 1. GUY shoots hoops, GAL (invited now and then) plays defence
    const bb = play(b, gb, 'hoopshoot', { first: 'defend', second: 'block' }, 14, 'basketball');
    out.push(result('sports: GUY shooting hoops, GAL sometimes joins and plays defence (she gets into the defending stance and jumps to block)', bb.joined >= 1 && bb.poses.has('defend') && bb.poses.has('block') && bb.errs === 0, { joined: bb.joined, games: bb.games, poses: [...bb.poses], errs: bb.errs, why: bb.why }));
    out.push(result('sports: while defending she stands between the shooter and the hoop, near him but never inside him', bb.frames > 20 && bb.between >= bb.frames * 0.6 && bb.minD > 0.4, { frames: bb.frames, between: bb.between, minD: +bb.minD.toFixed(2) }));
    // 2. GUY kicks at the goal, GAL keeps goal
    const sc = play(b, gb, 'goalshot', { first: 'keeper', second: 'dive' }, 14, 'soccer');
    out.push(result('sports: GUY kicking at the goal, GAL sometimes keeps goal (ready stance, then dives for the shot)', sc.joined >= 1 && sc.poses.has('keeper') && sc.poses.has('dive') && sc.errs === 0, { joined: sc.joined, games: sc.games, poses: [...sc.poses], errs: sc.errs, why: sc.why }));
    out.push(result('sports: the keeper stands in front of the goal, not inside the shooter', sc.frames > 20 && sc.between >= sc.frames * 0.8 && sc.minD > 0.4, { frames: sc.frames, between: sc.between, minD: +sc.minD.toFixed(2) }));
    // 3. the other way round: GAL shoots and GUY joins
    const rv = play(gb, b, 'hoopshoot', { first: 'defend', second: 'block' }, 14, 'basketball');
    out.push(result('sports: GAL shooting hoops, GUY sometimes joins her and plays defence', rv.joined >= 1 && rv.poses.has('defend') && rv.errs === 0, { joined: rv.joined, games: rv.games, poses: [...rv.poses], errs: rv.errs }));
    // 3b. a long afternoon of games with an invitation every time: they keep playing (shots are taken), nobody freezes, nobody guards for ever
    stopAll(); T.settle();
    const sports = ['hoopshoot', 'hoopdribble', 'goalshot', 'soccertoss'], pickGame = (x) => { x.queue = []; x.step = null; x.pendingActivity = null; x.using = new Set(); x.choose(sports[Math.floor(Math.random() * 4)]); };
    const shots0 = w.yard.score.shots, frozen = [], secs = { guard: 0, game: 0, all: 0 }, hist = { GUY: {}, GAL: {} };
    pickGame(b); pickGame(gb);
    let tl = 0;
    while (tl < 420) {
      step(0.25); tl += 0.25;
      for (const [who, x] of [['GUY', b], ['GAL', gb]]) {
        const st = x.step; secs.all += 0.25; hist[who][x.last + (st ? ':' + st.type : '')] = (hist[who][x.last + (st ? ':' + st.type : '')] || 0) + 0.25;
        if (['hoopdefend', 'goalkeep'].includes(x.last)) secs.guard += 0.25; else if (sports.includes(x.last)) secs.game += 0.25;
        if (st && st.type === 'play' && st.t > st.dur + 3) frozen.push([who, +tl.toFixed(0), x.last, st.pose]);
        if (st && st.type === 'walk' && !st.drive && st.t > 40) frozen.push([who, +tl.toFixed(0), x.last, 'walk']);
      }
      if (!sports.includes(b.last) && !['hoopdefend', 'goalkeep'].includes(b.last) && !sports.includes(gb.last) && !['hoopdefend', 'goalkeep'].includes(gb.last)) pickGame(Math.random() < 0.5 ? b : gb);       // (both have gone off to do something else: back to a game)
    }
    const taken = w.yard.score.shots - shots0;
    out.push(result('sports: over 7 minutes of games with an invitation every time they keep playing (at least 2 shots), nobody freezes, and defending does not take over (under 60% of the time)', taken >= 2 && frozen.length === 0 && secs.guard < secs.all * 0.6, { shots: taken, frozen: frozen.slice(0, 4), guardPct: +(100 * secs.guard / secs.all).toFixed(0), gamePct: +(100 * secs.game / secs.all).toFixed(0), hist }));
    // 4. games alone are untouched: nobody else around means nobody is invited, and the guard activities are never chosen on their own
    stopAll(); w.gal.remove(); T.settle();
    out.push(result('sports: with nobody to play against the guard activities are not available', !b.available('hoopdefend') && !b.available('goalkeep')));
  } finally { delete b.inviteChance; galReset(); }
  out.push(result('sports: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 26. Free play, judged as a player would: a long, seeded stretch of both robots living in the full house ----
// Everything is in the house (every room, every object, every book and record), GAL is built, and the two robots do whatever they choose
// for `seconds` of game time with a seeded random generator (the same seed always plays the same session). Every frame the harness watches
// for what a player would call wrong: walking at a wall without getting anywhere, jumping across the room, standing inside each other,
// pushing or putting away what the other is using, reading a book already read, reaching for the knob of an open door, a lawn left
// half-mown. `learned: true` starts with every skill known, so every activity is in play; `learned: false` starts with none, so they
// read their way through the shelf first.
T.playSession = ({ seed = 1, seconds = 600, learned = true, restaurant = false, speed = 1, scramble = 0 } = {}) => {
  const w = W(), b = B(), g = G();
  const m = { seed, seconds, learned, frames: 0, stuck: [], pressed: [], circling: [], jumps: [], overlapFrames: 0, overlapRun: 0, overlapMax: 0, rereads: [], inUseMoved: [], stowedInUse: [], couldNot: {},
    acts: { guy: {}, gal: {} }, together: { hoopdefend: 0, goalkeep: 0 }, mows: [], errors: 0, learnedBooks: 0, readStarts: 0, idle: { guy: 0, gal: 0 }, built: 0 };
  // ---- the full house
  galReset();
  dev.all = true;
  for (const r of ROOM_CATALOG) { unlockRoom(r.id); if (!w.rooms.isAdded(r.id)) w.rooms.add(r.id); }
  for (const d of BOOK_CATALOG) if (!d.locked) T.addBook(d.id);
  for (const a of ALBUM_CATALOG) T.addAlbum(a.id);
  for (const d of OBJECT_CATALOG) { const prem = (MANIFEST.objects[d.id] || {}).premium; if (d.id !== 'botprinter' && d.id !== 'ball' && (!d.locked || prem) && !d.built) T.addObject(d.id); }
  dev.all = false;
  skillsOf().known.clear(); skillsOf().fading.clear();
  const gb0 = galBuild(); if (!gb0.ok) { m.errors = -1; return m; }
  const gal = w.gal, gb = gal.brain;
  gb.skills.known.clear();
  w.restaurant.paused = !restaurant;                                  // (the restaurant keeps both of them busy for ever when it is open: its own session)
  if (learned) for (const d of BOOK_CATALOG) { skillsOf().known.add(d.teaches); gb.skills.known.add(d.teaches); }
  T.settle();
  for (const x of [b, gb]) { x.unlock(false); x.queue = []; x.step = null; x.pendingActivity = null; x.last = 'wander'; x.using = new Set(); }
  const brains = { guy: b, gal: gb }, pos = { guy: g.root.position, gal: gal.g.root.position };
  // ---- watchers
  const undo = [];
  const hook = (obj, name, fn) => { const had = Object.prototype.hasOwnProperty.call(obj, name), orig = obj[name]; obj[name] = fn(orig.bind(obj)); undo.push(() => { if (had) obj[name] = orig; else delete obj[name]; }); };
  for (const [who, x] of Object.entries(brains)) {
    hook(x, 'takeBook', (orig) => (rec) => { if (rec && rec.def && rec.def.teaches && x.last === 'read' && !x.wantsBook(rec)) m.rereads.push([who, rec.def.id]); return orig(rec); });
    hook(x, 'ui', (orig) => (msg) => { if (/could not|no room|wondering|stumbled/.test(String(msg))) { m.couldNot[msg] = (m.couldNot[msg] || 0) + 1; (m.couldNotAt ||= []).push([who, +(m.frames / 10).toFixed(0), x.last, +pos[who].x.toFixed(1), +pos[who].z.toFixed(1)]); } return orig(msg); });
  }
  hook(w.yard, 'stow', (orig) => (key, ...rest) => { for (const [who, x] of Object.entries(brains)) if (['mow', 'yardtidy'].includes(x.last) && x.otherUses(key)) m.stowedInUse.push([who, key, x.last, x.other.last, [...(x.other.using || [])].join('+'), +m.frames / 10]); return orig(key, ...rest); });
  // seeded random
  let rs = (seed * 2654435761) % 4294967296 || 1;
  const realRandom = Math.random; Math.random = () => { rs = (rs * 1664525 + 1013904223) % 4294967296; return rs / 4294967296; };
  undo.push(() => { Math.random = realRandom; });
  const errs0 = errors.length;
  const dt = 0.1;
  b.speed = speed; gb.speed = speed; undo.push(() => { b.speed = 1; gb.speed = 1; });
  // furniture the player dragged about, some of it into other rooms (`scramble`: how many pieces)
  if (scramble) {
    undo.push(T.keepPlaces());
    const names = Object.values(w.objects).filter((o) => o.obstacle && !o.mainOnly && !o.packed && !o.stowed && !o.yard && o.removable !== false && w.roomIdAt(o.x, o.z) === 'main').map((o) => o.name).sort();
    const ids = ['main', ...Object.keys(w.doors)];
    for (let i = 0; i < scramble && names.length; i++) {
      const o = w.objects[names.splice(Math.floor(Math.random() * names.length), 1)[0]], id = ids[Math.floor(Math.random() * ids.length)];
      const bd = id === 'main' ? WALK : w.doors[id].shell.bounds;
      const at = { x: bd.minX + 0.7 + Math.random() * (bd.maxX - bd.minX - 1.4), z: bd.minZ + 0.7 + Math.random() * (bd.maxZ - bd.minZ - 1.4) };
      const sp = w.findSpot(o, at, null);
      if (sp) { o.set(sp.x, sp.z); (m.scrambled ||= []).push([o.name, id]); }
    }
  }
  const press = { guy: null, gal: null };
  const walk = { guy: { t0: 0, p0: null, label: '' }, gal: { t0: 0, p0: null, label: '' } };
  const prevPos = { guy: { x: pos.guy.x, z: pos.guy.z }, gal: { x: pos.gal.x, z: pos.gal.z } };
  const objPrev = {}; const watched = ['mower', 'lawnchair', 'armchair', 'easel', 'piano', 'drums', 'stool', 'telescope', 'chair', 'builtchair', 'bench', 'basketballhoop', 'soccergoal'];
  for (const n of watched) if (w.objects[n]) objPrev[n] = { x: w.objects[n].x, z: w.objects[n].z };
  const lastAct = { guy: b.last, gal: gb.last };
  let mowing = false;
  const coverage = () => {
    const bd = w.doors.backyard.shell.bounds, pts = w.yard.cut().points(), obs = w.obstacles.filter((o) => o.active !== false);
    let free = 0, cut = 0;
    for (let z = bd.minZ + 0.5; z <= bd.maxZ - 0.5; z += 0.25) for (let x = bd.minX + 0.5; x <= bd.maxX - 0.5; x += 0.25) {
      if (obs.some((o) => x > o.x0 - 0.45 && x < o.x1 + 0.45 && z > o.z0 - 0.45 && z < o.z1 + 0.45)) continue;
      free++; if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.3)) cut++;
    }
    return free ? cut / free : 0;
  };
  try {
    let t = 0;
    while (t < seconds) {
      step(dt); t += dt; m.frames++;
      for (const [who, x] of Object.entries(brains)) {
        const p = pos[who], pp = prevPos[who];
        const v = Math.hypot(p.x - pp.x, p.z - pp.z) / dt;
        if (v > 7 && t > 1) m.jumps.push([who, +t.toFixed(0), +v.toFixed(1), x.last]);
        prevPos[who] = { x: p.x, z: p.z };
        // walking at something without getting anywhere
        const s = x.step, wk = walk[who];
        // pressed against something: his legs go but he has not got 15 cm further in a second and a half (what a player sees as "walking into
        // the corner"; a robot gives up after a few seconds, so the 8 s check below never sees it)
        if (s && s.type === 'walk' && x.moving && !s.drive) {
          const pr = press[who], yaw = x.g.root.rotation.y, turned = pr ? Math.abs(Math.atan2(Math.sin(yaw - pr.yaw), Math.cos(yaw - pr.yaw))) : 0;
          if (!pr || Math.hypot(p.x - pr.x, p.z - pr.z) > 0.15 || turned > 0.5) press[who] = { x: p.x, z: p.z, yaw, t };
          else if (t - pr.t > 1.5 && !pr.told) { pr.told = true; m.pressed.push({ who, t: +t.toFixed(0), act: x.last, at: [+p.x.toFixed(2), +p.z.toFixed(2)], to: [+(s.x || 0).toFixed(2), +(s.z || 0).toFixed(2)], rooms: [w.roomIdAt(p.x, p.z), w.roomIdAt(s.x, s.z)], anchor: s.anchor && s.anchor.name, push: s.push && s.push.obj.name, direct: !!s.direct, path: (s.path || []).slice(0, 4).map((q) => [+q.x.toFixed(2), +q.z.toFixed(2)]), other: [+x.other.g.root.position.x.toFixed(1), +x.other.g.root.position.z.toFixed(1)], near: w.obstacles.filter((ob) => ob.active !== false && p.x > ob.x0 - 0.5 && p.x < ob.x1 + 0.5 && p.z > ob.z0 - 0.5 && p.z < ob.z1 + 0.5).map((ob) => ob.name || 'ob'), label: x.isGal ? document.getElementById('activity2').textContent : label() }); }
        } else press[who] = null;
        if (s && s.type === 'walk' && !s.drive) {
          if (!wk.p0 || wk.s !== s) { wk.p0 = { x: p.x, z: p.z }; wk.t0 = t; wk.s = s; wk.len = 0; wk.w0 = s.waitT || 0; wk.d0 = Math.hypot(p.x - (s.x || 0), p.z - (s.z || 0)); }
          else {
            wk.len += v * dt;
            if (t - wk.t0 > 8) {                                  // a walk that has gone on for 8 s: has it got anywhere?
              const net = Math.hypot(p.x - wk.p0.x, p.z - wk.p0.z);
              const waited = (s.waitT || 0) - (wk.w0 || 0) > 4;            // (standing off while the other robot is at the spot is waiting, not being stuck)
              if (net < 0.3 && !s.push && !waited) m.stuck.push([who, +t.toFixed(0), x.last, +(s.x || 0).toFixed(1), +(s.z || 0).toFixed(1)]);
              else if (wk.len > 3 && net < 1.0 && !s.push && Math.hypot(p.x - (s.x || 0), p.z - (s.z || 0)) > wk.d0 - 0.4) m.circling.push([who, +t.toFixed(0), x.last, +wk.len.toFixed(1), +net.toFixed(1), 'at', +p.x.toFixed(1), +p.z.toFixed(1), 'to', +(s.x || 0).toFixed(1), +(s.z || 0).toFixed(1), s.anchor ? s.anchor.name : '', 'other', +x.other.g.root.position.x.toFixed(1), +x.other.g.root.position.z.toFixed(1), x.other.last, s.waitT || 0]);
              wk.p0 = { x: p.x, z: p.z }; wk.t0 = t; wk.len = 0; wk.w0 = s.waitT || 0; wk.d0 = Math.hypot(p.x - (s.x || 0), p.z - (s.z || 0));
            }
          }
        } else wk.p0 = null;
        if (!s && !x.queue.length) m.idle[who]++;
        if (x.last !== lastAct[who]) { m.acts[who][x.last] = (m.acts[who][x.last] || 0) + 1; if (x.last in m.together) m.together[x.last]++; if (x.last === 'build') m.built++; lastAct[who] = x.last; }
        // a push of something the other robot is using
        if (s && s.push && x.other && x.other.inUse(s.push.obj.name) && !s.drive) m.inUseMoved.push([who, +t.toFixed(0), s.push.obj.name]);
      }
      // standing inside each other
      if (w.roomIdAt(pos.guy.x, pos.guy.z) === w.roomIdAt(pos.gal.x, pos.gal.z)) {
        const d = Math.hypot(pos.guy.x - pos.gal.x, pos.guy.z - pos.gal.z);
        if (d < 0.22) { m.overlapFrames++; m.overlapRun += dt; m.overlapMax = Math.max(m.overlapMax, m.overlapRun); if (m.overlapRun < dt * 1.5) (m.overlaps ||= []).push([+t.toFixed(0), b.last, gb.last, +pos.guy.x.toFixed(1), +pos.guy.z.toFixed(1)]); } else m.overlapRun = 0;
      } else m.overlapRun = 0;
      // each lawn mowing, judged when the mower is put away
      const nowMowing = b.last === 'mow' || gb.last === 'mow';
      if (nowMowing) mowing = true;
      if (mowing && w.yard.isStowed('mower') && !nowMowing) { m.mows.push(+coverage().toFixed(2)); mowing = false; }
    }
    for (const x of Object.values(brains)) m.learnedBooks += x.skills.known.size;
  } finally { for (const f of undo.reverse()) f(); }
  m.paid = w.restaurant.stats ? w.restaurant.stats.paid : 0;
  m.errors = errors.length - errs0;
  m.errorList = errors.slice(errs0, errs0 + 3);
  return m;
};

// The play sessions: judged by what a player would see (see playSession). Same seeds, same play, every time.
T.sweepPlay = () => {
  const out = [], base = errors.length;
  const runs = [
    { name: 'everything known, 15 minutes (seed 11)', opt: { seed: 11, seconds: 900, learned: true } },
    { name: 'everything known, 15 minutes (seed 12)', opt: { seed: 12, seconds: 900, learned: true } },
    { name: 'learning from nothing, 20 minutes', opt: { seed: 13, seconds: 1200, learned: false } },
    { name: 'furniture dragged all over the house, 12 minutes (seed 201)', opt: { seed: 201, seconds: 720, learned: true, scramble: 10 } },
    { name: 'furniture dragged about, four times the speed, 8 minutes', opt: { seed: 301, seconds: 480, learned: true, scramble: 6, speed: 4 } },
    { name: 'a busy restaurant, 8 minutes', opt: { seed: 14, seconds: 480, learned: true, restaurant: true } },
  ];
  const total = { together: 0 };
  try {
    for (const r of runs) {
      const m = T.playSession(r.opt), n = r.name;
      out.push(result(`play (${n}): nobody walks at a wall or stands still on a walk for 8 s`, m.stuck.length === 0, { stuck: m.stuck.slice(0, 4) }));
      out.push(result(`play (${n}): nobody walks into a wall or a corner (legs going for a second and a half without getting anywhere)`, m.pressed.length === 0, { pressed: m.pressed.slice(0, 3) }));
      out.push(result(`play (${n}): nobody paces round in circles (a walk of 3 m or more that gets nowhere)`, m.circling.length === 0, { circling: m.circling.slice(0, 4) }));
      out.push(result(`play (${n}): nobody jumps across the room`, m.jumps.length === 0, { jumps: m.jumps.slice(0, 4) }));
      out.push(result(`play (${n}): the two never stand inside each other (at most half a second of touching, never more than a second at a time)`, m.overlapFrames <= 5 && m.overlapMax <= 1, { frames: m.overlapFrames, max: +m.overlapMax.toFixed(1), at: (m.overlaps || []).slice(0, 4) }));
      out.push(result(`play (${n}): no book is read twice, nothing the other is using is pushed or put away`, m.rereads.length === 0 && m.inUseMoved.length === 0 && m.stowedInUse.length === 0, { rereads: m.rereads.slice(0, 3), inUseMoved: m.inUseMoved.slice(0, 3), stowed: m.stowedInUse.slice(0, 3) }));
      out.push(result(`play (${n}): at most two "could not get there" in the whole session, and no errors`, Object.values(m.couldNot).reduce((a, c) => a + c, 0) <= 2 && m.errors === 0, { couldNot: m.couldNotAt && m.couldNotAt.slice(0, 4), errors: m.errors, list: m.errorList }));
      if (r.opt.learned && !r.opt.restaurant && !r.opt.scramble) out.push(result(`play (${n}): each does a good variety of things (9 kinds or more each)`, Object.keys(m.acts.guy).length >= 9 && Object.keys(m.acts.gal).length >= 9, { guy: Object.keys(m.acts.guy).length, gal: Object.keys(m.acts.gal).length }));
      if (!r.opt.learned) out.push(result(`play (${n}): they read their way through the shelf (at least 8 skills between them) and never reread`, m.learnedBooks >= 8, { skills: m.learnedBooks }));
      if (r.opt.restaurant) out.push(result(`play (${n}): they serve customers who pay`, m.paid >= 3, { paid: m.paid }));
      out.push(result(`play (${n}): every lawn mowed is mostly cut (85% or more of the grass)`, m.mows.every((c) => c >= 0.85), { mows: m.mows }));
      total.together += m.together.hoopdefend + m.together.goalkeep;
    }
    // (playing a sport together is a matter of chance in a session: sweepSports checks it directly; here it is only counted)
  } finally { galReset(); }
  out.push(result('play: no errors', errors.length === base, { errors: errors.slice(base), sportsTogether: total.together }));
  return out;
};

// The pieces of the house as they stand, and a function that puts them back there (a room taken away by the harness takes what stands in it
// along for good, also the piano and the stereo, which no later sweep could add again).
T.keepPlaces = () => {
  const w = W(), all = () => [...Object.values(w.objects), ...Object.values(w.removed)].filter((o) => o.obstacle && !o.kind && !o.mainOnly);
  const at = new Map(all().map((o) => [o, { x: o.x, z: o.z, home: { ...o.home } }])), inMain = (p) => Math.abs(p.x) < 4.9 && Math.abs(p.z) < 4.9;
  return () => {
    for (const o of all()) {
      const p = at.get(o);
      if (p && inMain(p.home)) o.home = { ...p.home };
      if (w.objects[o.name] !== o || w.roomIdAt(o.x, o.z) === 'main') continue;
      if (p && inMain(p)) { o.set(p.x, p.z); continue; }
      const s = inMain(o.home) && w.findSpot(o, { x: 0, z: 0 }, null);                  // (not the shed, the stove ...: they belong in their own room)
      if (s) o.set(s.x, s.z);
    }
  };
};

// ---- 27. Walking between rooms (brain.js update: the doors are put in the way first) ----
// A walk whose goal is in another room goes through the doors, whatever it was made by: main room to each added room (a corner room is behind
// another), back, and from one to another. He never walks at a wall (see `pressed` in playSession), and gives up at once on a spot he cannot get to.
T.walkWatch = (b, sec, done) => {                  // run up to `sec` seconds; { t, pressed, rooms } (pressed: the longest time his legs went without getting 10 cm further)
  const p = b.g.root.position, rooms = [];
  let t = 0, mark = null, pressed = 0;
  while (t < sec && !done()) {
    step(0.1); t += 0.1;
    const r = b.hereId(), yaw = b.g.root.rotation.y;
    if (rooms[rooms.length - 1] !== r) rooms.push(r);
    if (!(b.moving && b.step && b.step.type === 'walk' && !b.step.drive) || !mark || Math.hypot(p.x - mark.x, p.z - mark.z) > 0.1 || Math.abs(Math.atan2(Math.sin(yaw - mark.yaw), Math.cos(yaw - mark.yaw))) > 0.5) mark = { x: p.x, z: p.z, yaw, t };
    else pressed = Math.max(pressed, t - mark.t);
  }
  return { t: +t.toFixed(1), pressed: +pressed.toFixed(1), rooms, at: [+p.x.toFixed(2), +p.z.toFixed(2)] };
};
T.sweepWalkRooms = () => {
  const out = [], base = errors.length, w = W(), b = B();
  galReset();
  const back = T.keepPlaces();
  try {
    unlockRoom('workshop'); R().add('workshop', { walls: ['right'] });
    for (const id of ['library', 'bedroom', 'backyard']) { unlockRoom(id); R().add(id); }
    const spot = (id) => {                                     // a free place well inside a room
      if (id === 'main') return { x: 1.2, z: 1.4 };
      const { n } = w.shellSize(id), bd = b.roomBounds(id);
      for (const f of [0.5, 0.6, 0.4, 0.7]) for (const l of [0.6, -0.9, 1.6, -1.8]) {
        const q = w.shellPoint(id, n * f, 0), ax = w.shellAxes(id).lat, p = { x: q.x + ax.x * l, z: q.z + ax.z * l };
        if (p.x > bd.minX + 0.4 && p.x < bd.maxX - 0.4 && p.z > bd.minZ + 0.4 && p.z < bd.maxZ - 0.4 && !w.obstacles.some((o) => p.x > o.x0 - 0.5 && p.x < o.x1 + 0.5 && p.z > o.z0 - 0.5 && p.z < o.z1 + 0.5)) return p;
      }
      return w.roomSpot(id);
    };
    const go = (to) => {
      const q = spot(to);
      b.skip(); b.queue = [b.walk(q.x, q.z), b.play('idle', 0.6)]; b.step = null; b.last = 'wander'; b.pendingActivity = null;
      const r = T.walkWatch(b, 90, () => b.hereId() === to && Math.hypot(b.g.root.position.x - q.x, b.g.root.position.z - q.z) < 0.4);
      return { ...r, ok: b.hereId() === to && Math.hypot(b.g.root.position.x - q.x, b.g.root.position.z - q.z) < 0.4, to: q };
    };
    T.home();
    for (const [a, c] of [['main', 'workshop'], ['workshop', 'main'], ['main', 'library'], ['library', 'bedroom'], ['bedroom', 'main'], ['main', 'backyard'], ['backyard', 'library'], ['library', 'main']]) {
      const r = go(c);
      out.push(result(`walk between rooms: a plain walk from ${a} to a spot in ${c} goes through the doors and gets there`, r.ok, r));
      out.push(result(`walk between rooms: ${a} to ${c}: he never walks at a wall (a second and a half at most)`, r.pressed <= 1.5, r));
    }
    // the jobs of a room with a trip of their own: in through its door once, not in, out and in again
    for (const [id, act] of [['studio', 'studiowatch'], ['bowling', 'bowlwatch'], ['range', 'rangehang']]) {
      if (id === 'studio') R().reset('backyard'); else R().reset(id === 'bowling' ? 'studio' : 'bowling');
      unlockRoom(id); R().add(id); T.settle(); T.home();
      b.skip(); b.queue = []; b.step = null; b.pendingActivity = null; b.stayRoom = null; b.choose(act);
      const r = T.walkWatch(b, 90, () => b.last !== act || (b.hereId() === 'main' && b.__wasIn) || (b.hereId() === id && (b.__wasIn = true) && b.step && b.step.type === 'play' && !['idle', 'reach', 'walk'].includes(b.pose)));
      const entered = r.rooms.filter((x) => x === id).length; delete b.__wasIn;
      out.push(result(`walk between rooms: ${act}: he goes into the ${id} once (not in, out and in again)`, !!w.doors[id] && entered === 1 && b.last === act && (r.rooms[r.rooms.length - 1] === id || r.t > 10), { ...r, last: b.last, pose: b.pose }));
    }
    R().reset('range'); R().add('backyard'); T.settle(); T.home();
    // the drum kit in the corner room, and something that is planned as if it were in his own room (what sent him into the corner)
    T.home(); T.learn(['drums']); T.addObject('drums'); T.settle();
    const kit = w.objects.drums, ks = w.findSpot(kit, w.roomSpot('bedroom'), null);
    if (ks) kit.set(ks.x, ks.z);
    T.home(); b.skip(); b.queue = []; b.step = null; b.pendingActivity = null; b.choose('slouch');
    const s = T.walkWatch(b, 120, () => b.pose === 'slouch' || b.last !== 'slouch');
    out.push(result('walk between rooms: slouching at the drum kit in the Bedroom, he goes through the doors to it (he used to walk into the corner of his room)', !!ks && b.pose === 'slouch' && s.pressed <= 1.5, { ...s, pose: b.pose, last: b.last, label: label() }));
    T.settle(); T.home();
    // a spot he cannot get to (the door is locked): given up at once
    T.lockRoom('bedroom', true);                          // (every door of it: with one open he would go round by that one)
    const q = spot('bedroom'); b.skip(); b.queue = [b.walk(q.x, q.z)]; b.step = null; b.last = 'wander'; b.pendingActivity = null;
    const l = T.walkWatch(b, 20, () => b.last !== 'wander');
    out.push(result('walk between rooms: the door there is locked: he does not walk at the wall', l.pressed <= 1.5 && b.hereId() !== 'bedroom', { ...l, label: label() }));
    T.lockRoom('bedroom', false);
    // beside the other robot, who stands by the wall: the spot is inside the wall
    T.home(); b.skip(); b.queue = [b.walk(4.9, 1.2, 0)]; b.step = null; b.last = 'wander'; b.pendingActivity = null;
    const e = T.walkWatch(b, 15, () => b.last !== 'wander');
    out.push(result('walk between rooms: a spot inside the wall is walked to as near as the floor goes, then he stops', e.pressed <= 1.5 && e.t < 12, e));
    // put in the strip beside a side door as it shuts: back onto the floor of that room, not across the house
    const lib = w.doors.library, inWall = w.doorPoint('library', 0.3), g = b.g.root.position;
    lib.open = 0; lib.openTo = 0; g.x = inWall.x; g.z = inWall.z;
    let jump = 0, px = g.x, pz = g.z;
    b.skip(); b.queue = [b.walk(1, 1)]; b.step = null;
    for (let i = 0; i < 30; i++) { step(0.034); jump = Math.max(jump, Math.hypot(g.x - px, g.z - pz)); px = g.x; pz = g.z; }
    out.push(result('walk between rooms: standing in the doorway strip as its door shuts, he steps back into that room (he used to jump into his own)', jump < 0.5, { jump: +jump.toFixed(2), at: [+g.x.toFixed(1), +g.z.toFixed(1)] }));
  } finally { T.home(); back(); galReset(); }
  out.push(result('walk between rooms: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 28. The Skills menu: choosing a skill makes GUY use it, in the room he is in; GAL helps (skillrun.js) ----
T.sweepSkillMenu = () => {
  const out = [], base = errors.length, w = W(), b = B();
  const N = (t) => `skills menu: ${t}`, ids = Object.keys(SKILL_INFO);
  out.push(result(N('every skill has something to do'), ids.every((k) => SKILL_USES.includes(k)), { missing: ids.filter((k) => !SKILL_USES.includes(k)) }));
  galReset();
  let back = T.keepPlaces();
  const stop = () => { for (const x of [b, w.gal.exists() ? w.gal.brain : null]) if (x) { x.skip(true); if (x.homeMove) x.homeCleanup(); x.queue = []; x.step = null; x.pendingActivity = null; x.using = new Set(); x.last = 'wander'; x.stayRoom = null; } if (b.music) b.stereoControl('stop'); w.skillMusic = false; };
  const put = (x, id) => { const c = id === 'main' ? { x: 0.4, z: 1.6 } : w.roomSpot(id), p = x.g.root.position; p.x = c.x; p.z = c.z; x.stayRoom = id === 'main' ? null : id; };
  const send = (name, id) => { const o = w.objects[name], s = o && w.findSpot(o, w.roomSpot(id), null); if (s) o.set(s.x, s.z); return !!s && w.roomIdAt(s.x, s.z) === id; };
  const panel = document.getElementById('skills');
  const choose = (id) => { const row = panel.querySelector(`.skill[data-skill="${id}"]`); document.getElementById('toast').textContent = ''; if (row) row.click(); return { row: !!row, toast: document.getElementById('toast').textContent }; };
  // GUY stands in `room`, `at` (the thing) in another; he chooses the skill: where does he do it, and who carried it?
  const run = (id, act, { room, thing = null, from = null, sec = 200, gal = false }) => {
    stop();
    if (thing && from && !send(thing, from)) return { ok: false, why: `no place for the ${thing} in ${from}` };
    put(b, room); if (w.gal.exists()) put(w.gal.brain, 'main');
    const c = choose(id), seen = new Set(), carried = new Set(), rooms = new Set();
    let t = 0, hauled = 0, flat = false, loose = 0, jump = 0, o0 = null;
    const doing = () => b.last === act && b.step && b.step.type === 'play' && !['idle', 'reach'].includes(b.pose);
    while (t < sec && !doing()) {
      step(0.1); t += 0.1;
      seen.add(b.last); rooms.add(b.hereId());
      for (const [who, x] of [['guy', b], ['gal', w.gal.exists() ? w.gal.brain : null]]) if (x && x.homeMove && x.homeMove.name === thing) { carried.add(who); if (x.hauling && x.hauling.k > 0.9) hauled++; if (x.carry === 'flat') flat = true; }
      const o = thing && w.objects[thing];
      if (o && !o.packed) { if (o0 && Math.hypot(o.x - o0.x, o.z - o0.z) > 0.75) jump++; o0 = { x: o.x, z: o.z }; if (o.hauled && ![b, w.gal.brain].some((x) => x && x.hauling && x.hauling.o === o)) loose++; } else o0 = null;
    }
    const done = doing();
    return { ok: done && b.hereId() === room && (!thing || b.roomOfObj(thing) === room) && !jump && !loose, done, here: b.hereId(), at: thing && b.roomOfObj(thing), who: [...carried].join('+'), hauled, flat, jump, loose, t: +t.toFixed(0), toast: c.toast, seen: [...seen], rooms: [...rooms], last: b.last, gal: w.gal.exists() ? w.gal.brain.last : null, label: label() };
  };
  try {
    unlockRoom('workshop'); R().add('workshop', { walls: ['right'] });
    for (const id of ['library', 'bedroom', 'backyard']) { unlockRoom(id); R().add(id); }
    for (const id of ['piano', 'table', 'lamp', 'guitar', 'drums', 'easel', 'telescope', 'ball']) T.addObject(id);
    { const was = dev.all; dev.all = true; w.addNew('workstation', null); dev.all = was; }          // (premium: the dev unlock)
    for (const [n, d] of Object.entries(w.removed)) if (d.decor) w.restoreObject(n, null);          // (windows and pictures to dust)
    T.learn(ids);
    T.settle(); T.home();
    back = T.keepPlaces();
    out.push(result(N('every learned skill is a button'), ids.every((k) => { const r = panel.querySelector(`.skill[data-skill="${k}"]`); return r && r.tagName === 'BUTTON' && r.classList.contains('do'); })));
    out.push(result(N('every skill is in exactly one group of the menu, with its own icon and wording'), ids.every((k) => SKILL_GROUPS.flatMap((g) => g[1]).filter((x) => x === k).length === 1) && new Set(ids.map((k) => b.skillPreview(k).ask)).size === ids.length && ids.every((k) => b.skillPreview(k).icon), { asks: ids.map((k) => b.skillPreview(k).ask).filter((a, i, l) => l.indexOf(a) !== i) }));
    // 0. the notes on the buttons say how it would go from here, and looking changes nothing
    {
      stop(); T.home(); send('guitar', 'main');
      const before = JSON.stringify([b.pendingActivity, b.last, b.queue.length, !!b.skillRun]);
      const main = b.skillPreview('guitar'); put(b, 'library'); const lib = b.skillPreview('guitar'), pno = b.skillPreview('piano'), bowl = b.skillPreview('bowling');
      T.lockRoom('backyard', true); const yard = b.skillPreview('outdoor'); T.lockRoom('backyard', false); T.home();
      out.push(result(N('the notes: "Right here", "He fetches it" (no GAL), "In his room" (the piano), "Add the Bowling Alley first", "The door is locked"'), main.tone === 'here' && lib.tone === 'help' && /fetches/.test(lib.text) && pno.tone === 'go' && bowl.tone === 'no' && /Bowling/.test(bowl.text) && yard.tone === 'no' && /locked/.test(yard.text), { main, lib, pno, bowl, yard }));
      out.push(result(N('looking at the menu changes nothing'), before === JSON.stringify([b.pendingActivity, b.last, b.queue.length, !!b.skillRun])));
      document.getElementById('skills-btn').click(); const open = !panel.hidden, says = panel.querySelector('.where').textContent;
      panel.querySelector('.close').click(); const shut = panel.hidden;
      out.push(result(N('the button opens it, it says where GUY is, and ✕ closes it'), open && shut && /GUY is in his room/.test(says), { open, shut, says }));
    }
    // 1. the thing is in his room: at once, and the skill's own activity
    for (const [id, act] of [['drums.solo', 'drumsolo'], ['easel.portrait', 'portrait'], ['telescope.care', 'scopecare'], ['dance.moves', 'dancemoves'], ['lighting', 'mood'], ['decorate', 'dust']]) {
      stop(); T.home(); const c = choose(id), pend = b.pendingActivity;
      out.push(result(N(`${id}: in his room he does just that (${act}), right away`), pend === act || (act === 'dust' && pend === 'dusttop'), { pend, toast: c.toast }));
    }
    stop(); T.home(); choose('piano.advanced');
    const adv = []; for (let i = 0; i < 8; i++) { b.wantSong = 'piano.advanced'; adv.push(b.pickSong().name); }
    out.push(result(N('advanced piano plays a piece from that book'), adv.length === 8 && adv.every((n) => !/scale|Ode|Twinkle|Mary|Row|Saints|Amazing|Greensleeves/i.test(n)), { adv }));
    // 2. no GAL: he fetches it into the room he is in (a light thing whole, the drum kit flat)
    const g1 = run('guitar', 'guitar', { room: 'library', thing: 'guitar', from: 'main' });
    out.push(result(N('GUY in the Library, the guitar in his room, no GAL: he fetches it and plays in the Library'), g1.ok && g1.who === 'guy' && g1.hauled > 20, g1));
    const g2 = run('drums', 'drums', { room: 'workshop', thing: 'drums', from: 'main', sec: 260 });
    out.push(result(N('GUY in the Workshop, the drum kit in his room, no GAL: it comes apart, is carried flat and set up in the Workshop'), g2.ok && g2.who === 'guy' && g2.flat, g2));
    const g3 = run('dance.moves', 'dancemoves', { room: 'bedroom', sec: 200 });
    out.push(result(N('GUY in the Bedroom, no GAL: he switches the stereo on and comes back to dance there'), g3.ok && g3.seen.includes('musicon') && !!b.music, g3));
    // a guitar hung on a Studio wall: off its hook, on its stand again, to the room he is in
    {
      R().reset('backyard'); unlockRoom('studio'); R().add('studio'); stop(); send('guitar', 'studio');
      const gu = w.objects.guitar, bd = w.doors.studio && w.doors.studio.shell.bounds, horiz = w.doors.studio && ['left', 'right'].includes(w.doors.studio.wall);
      if (bd) gu.set(horiz ? (bd.minX + bd.maxX) / 2 : bd.minX + 0.23, horiz ? bd.minZ + 0.23 : (bd.minZ + bd.maxZ) / 2);
      step(0.3);
      const hung = !!gu.hung; put(b, 'library'); choose('guitar');
      let t = 0; while (t < 200 && !(b.last === 'guitar' && b.pose === 'guitar')) { step(0.2); t += 0.2; }
      out.push(result(N('a guitar hung on a Studio wall is taken off its hook and brought, on its stand'), hung && b.pose === 'guitar' && b.hereId() === 'library' && b.roomOfObj('guitar') === 'library' && !gu.hung && gu.stand.every((m) => m.visible), { hung, t, here: b.hereId(), at: b.roomOfObj('guitar'), label: label() }));
      stop(); send('guitar', 'main'); R().reset('studio'); R().add('backyard');
    }
    // 3. cut short with it in his arms: it is on the floor, nothing is lost
    stop(); send('guitar', 'main'); put(b, 'library'); choose('guitar');
    { let t = 0; while (t < 90 && !(b.hauling && b.hauling.k > 0.9 && b.hereId() !== 'main')) { step(0.1); t += 0.1; } }
    const had = !!b.hauling; b.skip(); step(3);
    const gt = w.objects.guitar;
    out.push(result(N('cut short with the guitar in his arms: it is set down on a floor, not lost, and the order is off'), had && !!gt && !gt.hauled && !b.hauling && !b.homeMove && !b.skillRun && Math.abs(gt.group.position.y) < 0.01 && w.roomIdAt(gt.x, gt.z) !== 'door', { had, at: gt && [gt.x, gt.z], run: b.skillRun }));
    // 4. GAL helps
    const bu = galBuild(); out.push(result(N('GAL is built'), bu.ok));
    const gal = w.gal.brain; gal.skills.known.clear();
    const g4 = run('guitar', 'guitar', { room: 'library', thing: 'guitar', from: 'main' });
    out.push(result(N('GUY calls GAL: she brings the guitar to the Library, he waits there and plays it'), g4.ok && g4.who === 'gal' && /asks GAL/.test(g4.toast) && g4.rooms.join() === 'library', g4));
    const g5 = run('easel.portrait', 'portrait', { room: 'backyard', thing: 'easel', from: 'main' });
    out.push(result(N('GUY in the Backyard: GAL brings the easel out and he paints there'), g5.ok && g5.who === 'gal', g5));
    const g6 = run('drums.band', 'jamdrums', { room: 'workshop', thing: 'drums', from: 'bedroom', sec: 300 });
    out.push(result(N('drumming with the band in the Workshop: GAL brings the kit, then puts the music on, and he drums along'), g6.ok && g6.who === 'gal' && !!b.music, g6));
    const g7 = run('dance.ballroom', 'ballroom', { room: 'library' });
    out.push(result(N('dancing in the Library: GAL goes and puts the music on, he dances where he is'), g7.ok && !!b.music && g7.rooms.join() === 'library', g7));
    { let t = 0; while (t < 260 && b.music) { step(0.25); t += 0.25; }
      out.push(result(N('...and when he has finished the music is switched off again'), !b.music && !w.skillMusic, { t, last: b.last, gal: gal.last })); }
    // 4b. what went wrong in the Studio (reported by hand): he stood about or walked in and out, and neither had the guitar in the end
    {
      T.addAlbum('rock');
      const album = w.objects.shelf && w.objects.shelf.albums.find((a) => a.mesh.visible);
      const wait = (room, sec = 90) => {                       // until he plays; every room he was in, and how often the guitar was taken up by whom
        const rooms = [b.hereId()]; let t = 0;
        while (t < sec && !(['guitar', 'jamguitar'].includes(b.last) && b.pose === 'guitar')) { step(0.1); t += 0.1; if (rooms[rooms.length - 1] !== b.hereId()) rooms.push(b.hereId()); }
        return { ok: b.pose === 'guitar' && b.hereId() === room && b.roomOfObj('guitar') === room, t: +t.toFixed(0), rooms: rooms.join('>'), at: b.roomOfObj('guitar'), last: b.last, gal: gal.last, run: !!b.skillRun };
      };
      const begin = (room) => { stop(); if (b.gtr.held) b.setGuitarHeld(false); if (gal.gtr.held) gal.setGuitarHeld(false); b.held = null; gal.held = null; send('guitar', 'main'); put(b, room); const p = gal.g.root.position; p.x = 1; p.z = 1.2; gal.stayRoom = null; };
      out.push(result(N('(there is a record to test with)'), !!album));
      if (album) for (const [who, x] of [['GUY', b], ['GAL', gal]]) {
        begin('library');
        x.held = album; album.mesh.visible = false; b.musicOn('default'); x.albumOnTable = true;
        choose('guitar'); const r = wait('library');
        out.push(result(N(`a record ${who} put on is standing by the stereo and playing: GAL brings the guitar and he plays it, without leaving the room (the record counted as in ${who === 'GUY' ? 'his' : 'her'} hands, and nothing was begun)`), r.ok && r.rooms === 'library', r));
        stop(); x.held = null; b.albumOnTable = false; gal.albumOnTable = false; album.mesh.visible = true;
      }
      // both in the room, he in the doorway: she has to get out past him, and in again
      for (const n of [-0.45, -0.75]) {
        begin('library'); const c = w.roomSpot('library'), gp = gal.g.root.position, q = w.doorPoint('library', n), p = b.g.root.position;
        gp.x = c.x; gp.z = c.z; gal.stayRoom = 'library'; p.x = q.x; p.z = q.z;
        const near = () => Math.hypot(p.x - w.doorPoint('library', 0).x, p.z - w.doorPoint('library', 0).z);
        choose('guitar'); step(4); const d = near(), r = wait('library');
        out.push(result(N(`he waits clear of the doorway he stood in (${-n} m inside), so GAL gets out and back with the guitar`), r.ok && d >= 1.5, { ...r, d: +d.toFixed(2) }));
      }
      // GAL loses her way with it in her arms (her steps are gone while she still holds it): she sets it down and he plays it, wherever that was
      begin('library'); choose('guitar');
      { let t = 0; while (t < 90 && !(gal.hauling && gal.hauling.k > 0.9 && gal.hereId() === 'library')) { step(0.1); t += 0.1; } }
      const had2 = !!gal.hauling; gal.queue = []; gal.step = null;
      b.step = null; b.queue = b.skillWaitSteps();                  // (he looks just then)
      const still = !!b.skillRun; const r2 = wait('library');
      out.push(result(N('GAL gives up the way with the guitar in her arms: he does not give up the order, and plays it'), had2 && still && r2.ok, { had2, still, ...r2 }));
      // the first time it comes to nothing (somebody in the way): he tries again
      begin('library'); send('guitar', 'library'); choose('guitar'); step(0.3);
      const onIt = b.last === 'guitar' && b.skillRun && b.skillRun.started; b.queue = []; b.step = null;
      const r3 = wait('library');
      out.push(result(N('his way to the guitar comes to nothing at first: he tries again'), !!onIt && r3.ok, { onIt, ...r3 }));
      // GAL does not take it for herself while it is on its way to him
      begin('library'); choose('guitar'); const taken = gal.otherUses('guitar') && gal.guitarTaken('guitar') && !b.otherUses('guitar');
      const again = choose('guitar'), kept = gal.pendingActivity === 'bringpiece' || gal.last === 'bringpiece';
      out.push(result(N('the guitar he asked for is his: GAL leaves it alone; choosing it again does not start it all over'), taken && kept && /already on it/.test(again.toast), { taken, kept, ...again }));
      const r4 = wait('library');
      out.push(result(N('...and it still comes'), r4.ok && r4.rooms === 'library', r4));
      // it is in his hands (its stand in another room): GAL does not walk off with the stand; he puts it back and brings it himself, once
      begin('main'); b.gname = 'guitar'; b.setGuitarHeld(true); put(b, 'library'); const c5 = choose('guitar');
      const r5 = wait('library', 140);
      out.push(result(N('the guitar is in his hands, its stand in his room: one trip to put it back and bring it, and he plays it here'), /fetching/.test(c5.toast) && r5.ok && r5.rooms.split('>').filter((x) => x === 'library').length === 2, { toast: c5.toast, ...r5 }));
      stop();
    }
    // 5. fixed things: he goes to them; a locked door and a thing in use are refused with the reason
    stop(); put(b, 'library'); const p1 = choose('piano');
    out.push(result(N('the piano is too heavy to bring: he is told so and goes to it'), /stays in/.test(p1.toast) && ['sitpiano', 'piano'].includes(b.pendingActivity), { ...p1, pend: b.pendingActivity }));
    stop(); send('guitar', 'main'); put(b, 'library'); gal.using = new Set(['guitar']);
    const p2 = choose('guitar'); gal.using = new Set();
    out.push(result(N('GAL is playing the guitar: he is told so'), /GAL is using/.test(p2.toast), p2));
    stop(); back(); R().reset('backyard'); const p3 = choose('outdoor.soccer');
    out.push(result(N('a skill of a room that is not there says so'), /no Backyard/.test(p3.toast), p3));
    // 6. it is not in the house: ordered into his room at the workstation, by GAL
    stop(); if (w.objects.telescope) { w.removeObject('telescope'); b.objectRemoved('telescope'); }
    const g8 = run('telescope', 'stargaze', { room: 'library', sec: 200 });
    out.push(result(N('the telescope has been put away: GAL orders it into the Library at the workstation'), b.roomOfObj('telescope') === 'library' && /order/.test(g8.toast), { ...g8, at: b.roomOfObj('telescope') }));
    // 7. GAL called away half-way: GUY sees to it himself
    stop(); send('guitar', 'main'); put(b, 'library'); put(gal, 'main'); choose('guitar'); step(3);
    const asked = gal.pendingActivity === 'bringpiece' || gal.last === 'bringpiece';
    gal.skip(); gal.pendingActivity = null; gal.lock = { name: 'shelf' };
    { let t = 0; while (t < 200 && !(b.last === 'guitar' && b.pose === 'guitar')) { step(0.2); t += 0.2; } }
    gal.lock = null;
    out.push(result(N('GAL is called away: GUY fetches it himself'), asked && b.last === 'guitar' && b.hereId() === 'library' && b.roomOfObj('guitar') === 'library', { asked, last: b.last, here: b.hereId(), guitar: b.roomOfObj('guitar') }));
    // 8. told to do something else while he waits: the order is off
    stop(); send('guitar', 'main'); put(b, 'library'); choose('guitar'); step(2); const waiting = !!b.skillRun; b.interact('lamp'); step(1);
    out.push(result(N('told to do something else while he waits: that is what he does'), waiting && !b.skillRun && (b.last === 'mood' || b.last === 'lamp' || ['mood', 'lamp'].includes(b.pendingActivity)), { waiting, last: b.last, pend: b.pendingActivity }));
    stop();
  } finally { stop(); T.home(); back(); galReset(); }
  out.push(result(N('no errors'), errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 22. The two robots' manners: never inside each other, never moving or putting away what the other is using (brain.js: moveBy, inUse; yardbrain.js: stowAway) ----
T.sweepBotRules = () => {
  const out = [], base = errors.length, w = W(), b = B(), gal = w.gal;
  if (!gal.g || !gal.g.loaded) return [result('bot rules: her model is loaded (wait a moment after the page opens)', false)];
  galReset();
  try {
    const bu = galBuild(); out.push(result('bot rules: GAL is built', bu.ok));
    const gb = gal.brain, gp = gal.g.root.position, p = G().pos;
    const stop = () => { for (const x of [b, gb]) { x.queue = []; x.step = null; x.pendingActivity = null; x.using = new Set(); x.chairClaim = null; } };
    stop();
    // 1. walking into the other robot slides round it; already overlapping, only moving away is allowed
    gp.x = 0; gp.z = 0; p.x = -1; p.z = 0;
    b.moveBy(0.9, 0);
    const d1 = Math.hypot(p.x - gp.x, p.z - gp.z);
    out.push(result('bot rules: GUY walking straight into GAL stops at arm\'s length (not inside her)', d1 >= 0.29, { d1 }));
    p.x = 0.2; p.z = 0;
    b.moveBy(-0.1, 0);
    out.push(result('bot rules: when they already overlap he cannot walk further into her', Math.hypot(p.x - gp.x, p.z - gp.z) >= 0.2 - 1e-6, { x: p.x }));
    const before = Math.hypot(p.x - gp.x, p.z - gp.z); b.moveBy(0.1, 0);
    out.push(result('bot rules: ...but he can walk away from her', Math.hypot(p.x - gp.x, p.z - gp.z) > before, { before }));
    // 2. an object the other robot is using is not pushed about
    stop(); T.home(); T.settle();
    T.addObject('armchair'); T.settle();
    const ch = w.objects.armchair;
    const free = ch && b.planPush(ch, ch.x + 0.8, ch.z);
    gb.chairClaim = 'armchair';
    const claimed = ch && b.planPush(ch, ch.x + 0.8, ch.z);
    out.push(result('bot rules: GUY will not shove a chair GAL is sitting in (or on her way to), and may when she is not', !!ch && !!free && claimed === null, { free: !!free, claimed }));
    gb.chairClaim = null;
    // 3. the yard: GAL in the lawn chair is not put away in the shed, and the lawn is not mowed round her
    stop(); T.removeAll(); T.settle(); T.home();           // (not resetRooms: that sends GAL away)
    unlockRoom('backyard'); R().add('backyard');
    for (const id of ['lawnchair', 'shed', 'mower']) T.addObject(id);
    T.learn(['outdoor']); T.settle();
    out.push(result('bot rules: with nobody in the lawn chair GUY would mow', b.available('mow')));
    gb.using = new Set(['lawnchair']);
    out.push(result('bot rules: with GAL in the lawn chair GUY does not set out to mow (he would have to put the chair away)', !b.available('mow')));
    const ord = b.interact('mower');
    out.push(result('bot rules: told to mow while she sits there he says why not', !ord.ok && /using something on the lawn/.test(ord.message), { ord }));
    const putsChair = b.tidyYard(['lawnchair']).fn().length > 0;
    out.push(result('bot rules: tidying the yard leaves the chair she is using where it is', !putsChair));
    gb.using = new Set(['mower']);
    out.push(result('bot rules: while GAL mows, GUY does not start another yard job', !b.available('yardsit') && !b.available('hoopshoot')));
    gb.using = new Set();
    // 3b. a door that is already open is walked through: no reaching for the knob first
    const dr = w.doors.backyard; dr.open = 1; dr.openTo = 1;
    const reachOpen = b.doorIn('backyard').filter((x) => x.type === 'plan').map((x) => x.fn()).flat().filter((x) => x.pose === 'reach').length;
    dr.open = 0; dr.openTo = 0;
    const reachShut = b.doorIn('backyard').filter((x) => x.type === 'plan').map((x) => x.fn()).flat().filter((x) => x.pose === 'reach').length;
    out.push(result('bot rules: through a door that is already open he just walks (no reach for the knob); a shut door is opened first', reachOpen === 0 && reachShut === 1, { reachOpen, reachShut }));
    // 3c. the other robot is standing where he wants to be: he waits a little way off (no pacing round her), and gets there once she goes
    stop(); T.removeAll(); T.settle(); T.home(); T.addObject('easel'); T.learn(['easel']); T.settle();
    const ea = w.objects.easel, sl = ea.local(0, 0.85), spot = { x: ea.x + sl.x, z: ea.z + sl.z };
    gp.x = spot.x; gp.z = spot.z; gb.queue = [gb.play('idle', 14)]; gb.step = null; gb.last = 'wander'; gb.using = new Set(['easel']);      // (14 s: less than the 16 s he waits before giving up)
    b.choose('paint');
    let tw = 0, still = 0, near = 0, path = 0, lastp = { x: p.x, z: p.z }; const trail = [];
    while (tw < 12.5) { step(0.1); tw += 0.1; const d = Math.hypot(p.x - spot.x, p.z - spot.z); if (tw > 5) { trail.push(d); path += Math.hypot(p.x - lastp.x, p.z - lastp.z); if (d < 1.95) near++; if (Math.hypot(p.x - lastp.x, p.z - lastp.z) < 0.004) still++; } lastp = { x: p.x, z: p.z }; }
    out.push(result('bot rules: with the other robot standing where he is going, he stops a little way off and waits (he does not keep walking round her)', near > 45 && still > near * 0.6 && path < 1.2, { near, still, pathM: +path.toFixed(2), d: +trail[trail.length - 1].toFixed(2) }));
    gp.x = -3; gp.z = 2; gb.queue = [gb.play('idle', 120)]; gb.step = null; gb.using = new Set();           // (she moves on, and stays away)
    let tg = 0; while (tg < 80 && !(b.pose === 'paintStand')) { step(0.25); tg += 0.25; }
    out.push(result('bot rules: ...and once she has moved on he gets there and paints', b.pose === 'paintStand', { tg, pose: b.pose }));
    stop();
    stop();
    // 3d. furniture margins: from beside a piece of furniture he walks out or along it, never into it (the drum kit clip)
    stop(); T.removeAll(); T.settle(); T.home(); T.addObject('plant'); T.settle(); gp.x = -3.5; gp.z = 3; gb.queue = [gb.play('idle', 600)]; gb.step = null;
    b.queue = []; b.step = null;
    const pl = w.objects.plant, ob = pl.obstacle;
    p.x = ob.x1 + 0.15; p.z = (ob.z0 + ob.z1) / 2;
    for (let i = 0; i < 40; i++) b.moveBy(-0.03, 0);
    const gapIn = p.x - ob.x1;
    for (let i = 0; i < 10; i++) b.moveBy(0.03, 0);
    out.push(result('bot rules: standing 15 cm from a piece of furniture he cannot be walked into it (he stops a few centimetres from it) but he can walk away', gapIn >= 0.0 && gapIn <= 0.15 && p.x - ob.x1 > gapIn + 0.25, { gapIn: +gapIn.toFixed(3), after: +(p.x - ob.x1).toFixed(2) }));
    stop();
    // 4. objectRemoved still drops work on the removed thing (stepUses is shared with it)
    stop(); b.step = { type: 'play', fx: { needs: ['lawnchair'] }, t: 0, dur: 1 }; b.objectRemoved('lawnchair');
    out.push(result('bot rules: removing an object the current step needs still cancels it', b.step === null));
    // 5. a long stretch of free time: never inside each other
    galReset(); galBuild(); stop();
    let t = 0, min = 9, e0 = errors.length;
    while (t < 300) { step(0.25); t += 0.25; if (w.roomIdAt(G().pos.x, G().pos.z) === w.roomIdAt(gal.g.pos.x, gal.g.pos.z)) min = Math.min(min, Math.hypot(G().pos.x - gal.g.pos.x, G().pos.z - gal.g.pos.z)); }
    out.push(result('bot rules: for 5 minutes of free time the two never come closer than 25 cm', min >= 0.25 && errors.length === e0, { min, errors: errors.slice(e0) }));
  } finally { galReset(); }
  out.push(result('bot rules: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};


// `seed`: every sweep starts with its own seeded random numbers (seed x 1000 + its number), so a run is the same every time and a failure
// that shows up under one seed can be replayed: `T.runSweep('sweepRestaurant', 2, 36)` plays sweep 36 of seed 2 alone. Other seeds are other runs
// (`npm test -- --repeat=3` uses seeds 1, 2, 3).
// ---- 12d. The Shooting Range (src/rangeobjects.js, src/rangebrain.js): the lanes, the screens that block a line of fire, enemies that stay
// in their own lane, cross-lane shots, and what goes when the room does
T.sweepRange = () => {
  const out = [], base = errors.length, w = W();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); T.settle(); T.home();
  unlockRoom('range');
  T.learn(['range.pistol']);                                            // a blaster is needed to shoot at the range (its book is read)
  const before = w.obstacles.length;
  const added = R().add('range');
  const rg = w.range;
  out.push(result('range: the room is added with three lanes, its two screens and its equipment (all pathing obstacles)', added.ok && !!rg && rg.lanes.length === 3 && w.obstacles.length === before + rg.obstacles.length && rg.partitions.length === 2, { added: added.ok, lanes: rg && rg.lanes.length }));
  if (!rg) { R().reset('range'); return out; }
  // the room is as wide as GUY's room; the display case, the round controller and the scoreboard are in the bays beside the lanes
  {
    const sz = w.shellSize('range'), fx = rg.obstacles.filter((o) => o.fixture), names = fx.map((o) => o.name).sort().join();
    const bounds = w.doors.range.shell.bounds, inRoom = fx.every((o) => o.x0 >= bounds.minX - 0.01 && o.x1 <= bounds.maxX + 0.01 && o.z0 >= bounds.minZ - 0.01 && o.z1 <= bounds.maxZ + 0.01);
    const clear = fx.every((o) => rg.partitions.every((p) => { const ob = rg.obstacles[rg.partitions.indexOf(p)]; return !(o.x1 > ob.x0 && o.x0 < ob.x1 && o.z1 > ob.z0 && o.z0 < ob.z1); }));
    out.push(result('range: the room is as big as GUYs room (10 x 10), with a blaster case, a round controller and a scoreboard inside it, clear of the screens', sz.l === 10 && names === 'blaster case,round controller,scoreboard' && inRoom && clear, { size: sz, names, inRoom, clear }));
    const slot = rg.display.slot('range.pistol'), stand = rg.display.standSpot('range.pistol');
    out.push(result('range: the robot stands where he can walk (not in an obstacle) to use each piece of equipment', [stand, rg.panel.standSpot(), rg.board.standSpot(), rg.display.standSpot('range.carbine')].every((p) => w.walkable(p.x, p.z) && !w.obstacles.some((o) => o.active !== false && p.x > o.x0 && p.x < o.x1 && p.z > o.z0 && p.z < o.z1)) && Math.hypot(slot.x - stand.x, slot.z - stand.z) < 0.9, { slot, stand }));
  }
  // the line of fire: a low shot from the left lane into the right one clips the screen; a high one clears it; a shot down your own lane is clear
  const from0 = rg.muzzle(0), right = rg.targets.find((t) => t.kind === 'rail' && t.lane === 2), own = rg.targets.find((t) => t.kind === 'rail' && t.lane === 0);
  const low = rg.clearShot(from0, rg.worldAim(right, 0)), high = rg.clearShot(from0, rg.worldAim(right, 1));
  out.push(result('range: a low shot across two lanes is blocked by the screens, a high one clears them', !low && high, { low, high }));
  out.push(result('range: a shot down its own lane is always clear', rg.clearShot(from0, rg.worldAim(own, 0)) && rg.clearShot(from0, rg.worldAim(own, 1)), {}));
  // a robot in the left lane is offered the right lane's bullseye only through a clear high aim, and his own lane first
  const offered = rg.candidates(0);
  const acrossOk = offered.filter((c) => !c.own).every((c) => rg.clearShot(from0, c.point));
  out.push(result('range: what a robot is offered is clear to shoot at (own lane and across)', offered.some((c) => c.own) && offered.some((c) => !c.own) && acrossOk, { offered: offered.map((c) => [c.target.lane, c.own, +c.k.toFixed(2)]) }));
  // the equipment is used: a shooting trip presses the button (a new round), takes the blaster out of the case, shoots, looks at the
  // scoreboard and puts the blaster back
  {
    const b = B(); let sawOut = false, sawBoard = 0, startedRound = false, maxY = 0, fromTip = 0, shots = 0, carriedLow = 0, carriedWalking = 0, aimedLevel = 0;
    const tracer0 = rg.tracer;
    rg.tracer = (a, c) => { shots++; if (rg.guns.guy.visible && a.distanceTo(rg.guns.guy.tipWorld()) < 0.06) fromTip++; return tracer0.call(rg, a, c); };      // (the shot must leave the glowing tip of the blaster in his hand, not his chest)
    const down = () => new window.THREE.Vector3(0, 0, -1).applyQuaternion(rg.guns.guy.group.quaternion).y;
    rg.score.round.shots = 9; rg.score.round.hits = 9;
    T.settle(); T.home(); b.queue = []; b.step = null; b.choose('rangeshoot');
    for (let i = 0; i < 150 * 30; i++) {
      step(1 / 30);
      if (rg.display.out['range.pistol']) sawOut = true;
      if (rg.panel.lit > 0 && rg.score.round.shots < 9) startedRound = true;
      maxY = Math.max(maxY, G().root.position.y);
      if (rg.guns.guy.visible && b.step && b.step.type === 'walk') { carriedWalking++; if (down() < -0.4) carriedLow++; }
      if (rg.guns.guy.visible && b.step && b.step.type === 'play' && b.step.fx && b.step.fx.range && !b.step.fx.range.single && b.step.t > 0.3) { if (Math.abs(down()) < 0.45) aimedLevel++; }
      const p = rg.board.standSpot(), q = G().root.position; if (Math.hypot(p.x - q.x, p.z - q.z) < 0.4) sawBoard++;
      if (i > 60 && b.last !== 'rangeshoot') break;
    }
    out.push(result('range: a shooting trip presses the round button, takes the blaster out of the case, looks at the scoreboard and puts the blaster back', startedRound && sawOut && sawBoard > 20 && !Object.keys(rg.display.out).length && !rg.guns.guy.visible && !rg.guns.gal.visible, { startedRound, sawOut, sawBoard, out: rg.display.out, gun: rg.gun.visible }));
    rg.tracer = tracer0;
    out.push(result('range: every shot leaves the tip of the blaster in his hand (not his chest)', shots > 0 && fromTip === shots, { shots, fromTip }));
    out.push(result('range: carried between shots the blaster points forward and down; aiming it is level with the target', carriedWalking > 5 && carriedLow >= carriedWalking * 0.9 && aimedLevel > 5, { carriedWalking, carriedLow, aimedLevel }));
    out.push(result('range: he never leaves the floor on a trip (no hopping between the lanes)', maxY < 0.03, { maxY }));
    T.settle(); T.home();
  }
  // each robot has a blaster of her own: the other robot putting hers away does not take it out of her hand
  {
    const b = B(), gal = rg.gunFor(true), guy = rg.gunFor(false), p = rg.firingSpot(2);
    gal.hold(new window.THREE.Vector3(p.x, 1.2, p.z), new window.THREE.Vector3(0, -0.7, -0.7).normalize());
    step(0.5);                                                          // (GUY is not at the range: his own brain puts his blaster away)
    out.push(result('range: GAL and GUY each have their own blaster: his brain putting his away leaves hers in her hand', gal !== guy && gal.visible && !guy.visible, { gal: gal.visible, guy: guy.visible }));
    gal.hide();
    rg.display.take('range.pistol'); rg.display.take('range.pistol');
    rg.display.giveBack('range.pistol');
    const still = !!rg.display.out['range.pistol'];
    rg.display.giveBack('range.pistol');
    out.push(result('range: both robots can take the same blaster out of the case; it is back on the shelf when the last one returns it', still && !rg.display.out['range.pistol'], { still }));
    void b;
  }
  // the long-press menu of the blaster rack (and the round controller and the scoreboard): Shoot the Target and Lock in
  {
    const b = B(), THREE = window.THREE, menu = document.getElementById('menu'), cam = window.camera;
    const saved = { pos: cam.position.clone(), quat: cam.quaternion.clone() };
    const lookAt = (target, from) => { cam.position.copy(from); cam.lookAt(target); cam.updateMatrixWorld(true); window.scene.updateMatrixWorld(true); return window.__ui.pick({ clientX: innerWidth / 2, clientY: innerHeight / 2 }); };
    const rack = rg.display.slot('range.pistol'), sp = rg.display.standSpot('range.pistol');
    const h1 = lookAt(rack, new THREE.Vector3(sp.x, 1.3, sp.z));
    const btn = rg.panel.buttonPoint(), ps = rg.panel.standSpot();
    const h2 = lookAt(btn, new THREE.Vector3(ps.x, 1.3, ps.z));
    const bg = new THREE.Vector3(); rg.board.group.getWorldPosition(bg); bg.y = 1.75; const bs = rg.board.standSpot();
    const h3 = lookAt(bg, new THREE.Vector3(bs.x, 1.3, bs.z));
    cam.position.copy(saved.pos); cam.quaternion.copy(saved.quat); cam.updateMatrixWorld(true);
    out.push(result('range: a press on the blaster rack, the round controller and the scoreboard picks each one', !!h1 && h1.range === 'blasterrack' && !!h2 && h2.range === 'rangecontroller' && !!h3 && h3.range === 'scoreboard', { h1: h1 && Object.keys(h1), h2: h2 && Object.keys(h2), h3: h3 && Object.keys(h3) }));
    b.unlock(false); T.settle(); T.home(); b.queue = []; b.step = null;
    window.__guyOpenMenu('blasterrack');
    const vis = (a) => !menu.querySelector('[data-act=' + a + ']').hidden, ib = menu.querySelector('[data-act=interact]'), lb = menu.querySelector('[data-act=lock]');
    out.push(result('range: the blaster rack menu offers Shoot the Target and Lock in (and no Rotate or Remove)', !menu.hidden && /Shoot the Target/.test(ib.textContent) && vis('interact') && vis('lock') && /Lock in/.test(lb.textContent) && !vis('rotl') && !vis('rotr') && !vis('remove'), { title: document.getElementById('menu-title') && document.getElementById('menu-title').textContent }));
    ib.click();
    out.push(result('range: Shoot the Target sends him to the range to shoot', b.pendingActivity === 'rangeshoot' || b.last === 'rangeshoot'));
    b.pendingActivity = null; b.queue = []; b.step = null;
    window.__guyOpenMenu('blasterrack'); menu.querySelector('[data-act=lock]').click();
    out.push(result('range: Lock in on the rack locks him on shooting', !!b.lock && b.lock.name === 'blasterrack'));
    // locked in: he stays at the range and shoots trip after trip (he does not walk out after the first)
    const s0 = rg.score.shots; let leftRange = false, trips = 0, lastAct = null;
    for (let i = 0; i < 400 * 30; i++) { step(1 / 30); if (b.last === 'rangeshoot' && lastAct !== 'rangeshoot') trips++; lastAct = b.last; if (i > 600 && !b.inRange()) { leftRange = true; break; } }
    out.push(result('range: locked in he goes on shooting trip after trip and stays in the range', rg.score.shots - s0 >= 8 && !leftRange && b.inRange(), { shots: rg.score.shots - s0, leftRange, trips }));
    window.__guyOpenMenu('blasterrack');
    out.push(result('range: the rack menu then offers Unlock', /Unlock/.test(menu.querySelector('[data-act=lock]').textContent)));
    menu.querySelector('[data-act=lock]').click();
    out.push(result('range: Unlock lets him go', !b.lock));
    b.queue = []; b.step = null; b.skip(); T.settle(); T.home();
  }
  // the enemies walk and dissolve for a while, and never leave their lane or their stretch of the range
  let seen = 0, outside = 0;
  for (let i = 0; i < 40; i++) {
    step(0.75);
    for (const e of rg.targets) {
      if (e.kind !== 'enemy') continue;
      if (e.alive) seen++;
      if (Math.abs(e.pos.x - rg.lanes[e.lane].x) > 1e-9 || e.pos.z < -8.25 || e.pos.z > -4.15) outside++;
    }
  }
  out.push(result('range: the enemies come up in their own lane, and stay there', seen > 0 && outside === 0, { seen, outside }));
  // shots across the lanes: fired from the left lane, the ones that are offered are counted as cross shots and can hit
  const c0 = rg.score.shots, x0 = rg.score.cross;
  for (let i = 0; i < 30; i++) {
    const cands = rg.candidates(0).filter((c) => !c.own);
    if (!cands.length) break;
    const pick = cands[i % cands.length];
    rg.targets.forEach((t) => { if (t.kind === 'rail') { t.alive = true; t.state = 'up'; } });
    rg.fire(0, pick.target, pick.point);
  }
  out.push(result('range: shots across the lanes are fired and counted', rg.score.shots > c0 && rg.score.cross > x0 && rg.score.hits <= rg.score.shots, { shots: rg.score.shots - c0, cross: rg.score.cross - x0, hits: rg.score.hits }));
  // GUY walking past and across the screens (round their ends, corners cut by the walk) keeps clear of them: he never clips one
  {
    const g = G(), b = B(), walks = [[6.5, 0, 11, -2], [6.4, 1.6, 10, -1.6], [6.6, -1.8, 12, 1.6], [12, 1.6, 7.5, -2], [9, 0, 14, 0], [13, -2, 8.2, 0], [13.7, 1.15, 6, -0.5, true]];   // (the range is centred on its wall: its screens are 1 m either side of the middle)
    const segs = rg.partitions.map((p) => [p.a, p.b]);
    const gap = (px, pz) => Math.min(...segs.map(([a, c]) => { const vx = c.x - a.x, vz = c.z - a.z, L = vx * vx + vz * vz || 1; const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / L)); return Math.hypot(px - a.x - t * vx, pz - a.z - t * vz); }));
    let closest = 9, arrived = 0;
    for (const [sx, sz, tx, tz, direct] of walks) {
      g.root.position.set(sx, 0, sz); step(0.6);
      b.queue = [{ type: 'walk', x: tx, z: tz, yaw: null, direct: !!direct }]; b.step = null;     // (a direct walk, as the way out of the range is: it must still go round the screens)
      for (let i = 0; i < 270; i++) { step(1 / 30); const p = g.root.position; closest = Math.min(closest, gap(p.x, p.z)); if (!b.queue.length && !b.step) break; }
      if (Math.hypot(g.root.position.x - tx, g.root.position.z - tz) < 0.4) arrived++;
    }
    out.push(result('range: walking across the screens, GUY keeps clear of them (never clips one)', closest >= 0.2 && arrived === walks.length, { closest: +closest.toFixed(3), arrived }));
    b.queue = []; b.step = null;                                        // (a walk still under way must not carry on into the next sweep)
    T.home();
  }
  // taking the room away takes its screens out of the pathing again, and the range with it
  R().reset('range');
  T.settle();
  out.push(result('range: removing the room takes its screens and the range away', !w.range && w.obstacles.length === before, { obstacles: w.obstacles.length, before }));
  out.push(result('range: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- 12f. The Studio (src/studioobjects.js, src/studiobrain.js): the room, the record wall, a DJ trip, a show, a party, hanging guitars -----------------
// GAL dances where the music is: with the stereo in the Studio she switches it on there and dances on the Studio floor, not in
// GUY's room (she once danced in his room and walked back to switch it off).
// ---- Help (src/help.js): the ❓ button, every tab, What's new and the change log ----
T.sweepHelp = () => {
  const out = [], h = window.__help, root = document.getElementById('help'), btn = document.getElementById('help-btn');
  if (!h || !root || !btn) return [result('help: the panel and its ❓ button are on the page', false, { h: !!h, root: !!root, btn: !!btn })];
  h.close();
  btn.click();
  out.push(result('help: the ❓ button opens the panel on "Start here"', h.isOpen() && !root.hidden && h.tab === 'start' && btn.getAttribute('aria-expanded') === 'true'));
  const empty = [];
  for (const t of HELP_TABS) { root.querySelector(`.tab[data-tab="${t.id}"]`).click(); const body = root.querySelector('.body'); if (h.tab !== t.id || body.textContent.trim().length < 40) empty.push(t.id); }
  out.push(result('help: every tab opens and has something to read', empty.length === 0, { empty }));
  const missing = ROOM_CATALOG.filter((r) => !(ROOM_NOTES[r.id] || '').trim()).map((r) => r.id);
  out.push(result('help: every room in the Catalog has a line in the Rooms tab', missing.length === 0, { missing }));
  const rooms = helpHtml('rooms');
  out.push(result('help: the Rooms tab names every room', ROOM_CATALOG.every((r) => rooms.includes(r.name.replace(/&/g, '&amp;')))));
  const skillsTab = helpHtml('skills'), grouped = new Set(SKILL_GROUPS.flatMap(([, ids]) => ids));
  const unlisted = Object.keys(SKILL_INFO).filter((id) => grouped.has(id) && !skillsTab.includes(SKILL_INFO[id].name.replace(/&/g, '&amp;')));
  out.push(result('help: the Books and skills tab lists every skill in the Skills menu', unlisted.length === 0, { unlisted }));
  h.show('new');
  const news = [...root.querySelectorAll('.news')].map((x) => x.dataset.news);
  out.push(result('help: What\'s new lists every update, newest first', news.length === WHATS_NEW.length && news.every((id, i) => id === WHATS_NEW[i].id), { shown: news.length, all: WHATS_NEW.length }));
  const dates = CHANGELOG.map((d) => d.date);
  const valid = dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)));
  const sorted = dates.every((d, i) => i === 0 || dates[i - 1] > d);
  const filled = CHANGELOG.every((d) => ['added', 'changed', 'removed'].some((k) => (d[k] || []).length) && Object.keys(d).every((k) => ['date', 'added', 'changed', 'removed'].includes(k)));
  out.push(result('help: the change log has one entry per day, newest first, each with something added, changed or removed', valid && sorted && filled, { valid, sorted, filled }));
  h.show('log');
  out.push(result('help: the Change log tab shows every day', root.querySelectorAll('.day').length === CHANGELOG.length));
  const secret = JSON.stringify([CHANGELOG, HELP_TABS.filter((t) => t.id !== 'new').map((t) => helpHtml(t.id))]).match(/air ?guitar|windmill|knee ?slide|easter egg/i);     // (What's new is WHATS_NEW as it stands: it has its own check)
  out.push(result('help: no secret move or easter egg is given away in the help or the change log', !secret, { secret: secret && secret[0] }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  out.push(result('help: Escape closes it', !h.isOpen() && root.hidden && btn.getAttribute('aria-expanded') === 'false'));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
  const byKey = h.isOpen();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H' }));
  out.push(result('help: H opens and closes it', byKey && !h.isOpen()));
  const skills = document.getElementById('skills');
  document.getElementById('skills-btn').click();
  btn.click();
  out.push(result('help: opening help closes the Skills menu', h.isOpen() && skills.hidden));
  h.close();
  // The status line (what GUY and GAL are doing) never runs under the buttons in the top corner, whatever the window's width. The page's own styles and
  // these elements in an empty frame, which can be made any size (the ❓ button covered the end of it on a phone).
  {
    const frame = document.createElement('iframe'); frame.style.cssText = 'position:fixed;left:0;top:0;border:0;visibility:hidden;height:844px';
    document.body.appendChild(frame);
    const d = frame.contentDocument, under = [], lines = [['GUY is ', 'reading "Stereo User Manual"', null], ['GUY is ', 'moving the bookshelf to the Library', 'reading "Piano Playing for Robots"'], ['', 'waking up…', null]];
    d.head.innerHTML = [...document.querySelectorAll('style')].map((x) => `<style>${x.textContent}</style>`).join('');
    d.body.innerHTML = ['hud', 'help-btn', 'lockscreen-btn', 'sound-btn'].map((id) => document.getElementById(id).outerHTML).join('');
    const hud = d.getElementById('hud'); let seen = 0;
    for (const wide of [320, 360, 390, 430, 540, 700, 701, 768, 820, 1024, 1280, 1500]) for (const [who, act, gal] of lines) {
      frame.style.width = `${wide}px`;
      hud.firstChild.textContent = who; d.getElementById('activity').textContent = act; d.getElementById('galline').hidden = !gal; d.getElementById('activity2').textContent = gal || '';
      const a = hud.getBoundingClientRect();
      for (const id of ['help-btn', 'lockscreen-btn', 'sound-btn']) { const k = d.getElementById(id).getBoundingClientRect(); if (k.width >= 44 && a.width > 60) seen++; if (a.left < k.right && a.right > k.left && a.top < k.bottom && a.bottom > k.top) under.push(`${wide}: "${act}" under ${id}`); }
      if (a.right > wide || hud.scrollWidth > hud.clientWidth) under.push(`${wide}: "${act}" does not fit`);
    }
    frame.remove();
    out.push(result('help: what GUY and GAL are doing is never covered by the buttons in the top corner, on a phone or a wide window', seen === 12 * 3 * 3 && !under.length, { seen, under: under.slice(0, 6), n: under.length }));
  }
  return out;
};

T.sweepGalDanceRoom = () => {
  const out = [], base = errors.length, w = W(), gal = w.gal;
  if (!gal.g || !gal.g.loaded) return [result('galdance: her model is loaded (wait a moment after the page opens)', false)];
  galReset();
  const built = galBuild(), gb = gal.brain;
  try {
    unlockRoom('studio');
    const added = R().add('studio');
    if (!built.ok || !added.ok || !w.studio) { out.push(result('galdance: GAL is built and the Studio added', false, { built, added: added.ok })); return out; }
    if (!w.objects.table) T.addObject('table');
    const bd = w.doors.studio.shell.bounds, tb = w.objects.table;
    gb.actRoom = 'studio'; const spot = gb.openSpotNear((bd.minX + bd.maxX) / 2 - 2, bd.minZ + 1.6, 0.9); gb.actRoom = null;
    tb.set(spot.x, spot.z);
    for (let i = 0; i < 10; i++) step(1 / 30);
    out.push(result('galdance: the stereo stands in the Studio', w.roomIdAt(tb.x, tb.z) === 'studio', { x: tb.x, z: tb.z }));
    gb.skills.learn('stereo'); gb.skills.learn('dance.moves');
    // her spots follow the room the activity is in; in GUY's room they are where they always were
    gb.actRoom = 'studio'; const ds = gb.danceSpot(), ws = gb.waveSpot();
    gb.actRoom = 'main'; const dm = gb.danceSpot(), wm = gb.waveSpot(); gb.actRoom = null;
    out.push(result('galdance: her dance and wave spots for the Studio are on the Studio floor, and in his room they are unchanged', w.roomIdAt(ds.x, ds.z) === 'studio' && w.roomIdAt(ws.x, ws.z) === 'studio' && dm.x === 1.4 && dm.z === 0.9 && wm.x === -1.4 && wm.z === 2.2, { ds, ws, dm, wm }));
    // the real thing: she puts on "Watch these moves" in the Studio
    gb.queue = []; gb.step = null; gb.musicOff(); gb.choose('dancemoves');
    const rooms = new Set(); let danced = false, onRoom = null;
    for (let i = 0; i < 160 * 30; i++) {
      step(1 / 30);
      if (gb.music && !onRoom) onRoom = gb.hereId();
      if (gb.step && gb.step.fx && gb.step.fx.dance) { danced = true; rooms.add(gb.hereId()); }
      if (danced && gb.last !== 'dancemoves') break;
    }
    out.push(result('galdance: with the stereo in the Studio, she switches it on there and every dance move is in the Studio', danced && onRoom === 'studio' && rooms.size === 1 && rooms.has('studio'), { danced, onRoom, rooms: [...rooms] }));
  } finally {
    gal.brain.actRoom = null; gal.brain.queue = []; gal.brain.step = null; gal.brain.musicOff();
    if (w.objects.table) w.objects.table.set(2.5, -2.4);          // (taking the room away deletes what stands in it)
    B().queue = []; B().step = null; T.settle();
    R().reset('studio'); R().setUnlocked('studio', false);
    galReset();
  }
  out.push(result('galdance: no errors', errors.length === base, { errors: errors.slice(base, base + 3) }));
  return out;
};

// ---- Taking a guitar or the bass off its stand, wearing it and putting it back: the hand really closes round the neck, and the strap lies on the
// body (over the left shoulder and across the back), for both robots.
T.sweepGuitarHold = () => {
  const strapAnyWay = (() => {                             // (the strap's line whatever way round the instrument is: the ends in every direction about his chest)
    const g = G(), c = g.boneWorld('Spine2'), bad = []; window.scene.updateMatrixWorld(true);
    for (let i = 0; i < 24; i++) for (let k = 0; k < 24; k++) for (const r of [0.25, 0.6]) {
      const P = (n) => c.clone().add(new window.THREE.Vector3(Math.sin((n / 24) * 6.283) * r, Math.cos((n / 24) * 6.283) * r * 0.8, Math.cos((n / 24) * 6.283 + i) * r));
      let ok = false; try { const l = strapLine(g, P(i), P(k)); ok = !l || [...l.front, ...l.back].every((p) => Number.isFinite(p.x + p.y + p.z)); } catch { ok = false; }
      if (!ok) bad.push([i, k, r]);
    }
    return bad;
  })();
  const out = [], base = errors.length, w = W(), b = B(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); T.settle(); T.home();
  unlockRoom('studio'); R().add('studio'); T.addObject('guitar'); T.addObject('bass'); T.learn(['guitar']); T.settle();
  const built = T.galBuild();
  out.push(result('guitar hold: GAL is there to test with', built.ok));
  out.push(result('guitar hold: the strap has a line whichever way round the instrument is (it threw every frame when its two ends were neighbours on the outline)', strapAnyWay.length === 0, { bad: strapAnyWay.length, first: strapAnyWay.slice(0, 3) }));
  // taking it, wherever in his 8 cm he stands and however he is turned, the neck stays in his hand: no quarter of a second with the arm flung off it
  {
    const o = w.objects.guitar, g = b.g, far = {};
    for (const [dx, dz] of [[0.055, 0.055], [0.05, 0], [-0.055, 0.055], [0, 0]]) for (const turn of [-0.04, -0.02, 0, 0.015, 0.04]) {
      const x = w.gal.brain; x.queue = []; x.step = null; b.queue = []; b.step = null; if (b.gtr.held) b.setGuitarHeld(false); b.gtr.override = null; b.resetGuitarMesh(); b.unlock(false); b.pendingActivity = null;
      x.g.root.position.set(-4, 0, 4); g.root.position.set(o.x, 0, o.z + 2); b.wantGuitar = 'guitar'; b.choose('guitar');
      for (let n = 0; n < 1500 && !(b.pose === 'takeGuitar' && b.step); n++) { x.queue = []; x.step = null; step(1 / 30); }
      const l = o.local(dx, b.guitarDz() + dz); g.root.position.x = o.x + l.x; g.root.position.z = o.z + l.z; g.root.rotation.y = o.yaw + Math.PI + turn;
      let m = 0, n = 0;
      while (b.pose === 'takeGuitar' && b.step && b.step.t < 1.45) { step(1 / 30); if (b.step && b.step.t > 0.95) { n++; o.guitar.updateWorldMatrix(true, false); const loc = (q) => o.guitar.worldToLocal(g.boneWorld(q)), p = loc('RightHand').lerp(loc('RightHandMiddle1'), 0.75); m = Math.max(m, Math.hypot(p.y, p.z)); } }
      if (!n || m > 0.12) far[`${dx},${dz} turned ${turn}`] = +m.toFixed(2);
    }
    b.queue = []; b.step = null; if (b.gtr.held) b.setGuitarHeld(false); b.gtr.override = null; b.resetGuitarMesh(); T.settle(); T.home();
    out.push(result('guitar hold: taking a guitar the arm never flips off the neck, wherever he stands at it and however he is turned', !Object.keys(far).length, { far }));
  }
  // whichever way she comes from, GAL's shorter arm gets round the neck (she stopped up to 8 cm from her mark, and her fingertips short of it)
  {
    const x = w.gal.brain, o = w.objects.guitar, tips = [];
    x.skills.learn('guitar');
    for (let i = 0; i < 8; i++) {
      b.queue = []; b.step = null; x.queue = []; x.step = null; if (x.gtr.held) x.setGuitarHeld(false); x.gtr.override = null; x.resetGuitarMesh(); x.unlock(false); x.pendingActivity = null;
      const a = (i / 8) * Math.PI * 2, at = w.findSpot({ name: 'x', w: 0.5, d: 0.5, h: 1, obstacle: null, local: () => ({ x: 0, z: 0 }) }, { x: Math.sin(a) * 3, z: Math.cos(a) * 3 }, null);
      x.g.root.position.set(at.x, 0, at.z); b.g.root.position.set(4, 0, 4); x.wantGuitar = 'guitar'; x.choose('guitar');
      for (let n = 0; n < 1500 && !(x.pose === 'takeGuitar' && x.step && x.step.t >= 0.95); n++) { b.queue = []; b.step = null; step(1 / 30); }
      o.guitar.updateWorldMatrix(true, false); tips.push(+o.guitar.worldToLocal(x.g.boneWorld('RightHandMiddle3')).z.toFixed(4));
    }
    x.queue = []; x.step = null; if (x.gtr.held) x.setGuitarHeld(false); x.gtr.override = null; x.resetGuitarMesh(); T.settle(); T.home();
    out.push(result('guitar hold: GAL gets her fingers well behind the neck whichever way she came to the guitar', tips.every((z) => z < -0.01), { tips }));
  }
  // a guitar whose front is against a wall cannot be taken off its stand: nobody sets out to play it (they kept choosing it and giving up), he says why,
  // and he never pushes it to such a place himself when he rearranges his room
  {
    const gt = w.objects.guitar, at0 = { x: gt.x, z: gt.z, rot: gt.rot };
    T.home(); b.queue = []; b.step = null; b.skip(true); b.pendingActivity = null;
    const free = b.available('riff');
    gt.rot = 0; gt.set(-0.6, 4.2);
    const wall = b.available('riff'), why = b.whyNot('riff');
    gt.rot = 2; gt.set(-0.6, 4.2);
    const turned = b.available('riff');
    gt.rot = at0.rot; gt.set(at0.x, at0.z);
    const bad = [];
    for (let i = 0; i < 300; i++) { const s = b.freeObjectSpot(gt); if (!s) continue; const l = gt.local(0, 0.62); if (!w.walkable(s.x + l.x, s.z + l.z)) bad.push([+s.x.toFixed(2), +s.z.toFixed(2)]); }
    out.push(result('guitar hold: a guitar that faces a wall is left alone (and he says why); turned round it is played again', free && !wall && turned && /no room to stand/.test(why || ''), { free, wall, turned, why }));
    out.push(result('guitar hold: rearranging his room he never puts the guitar where nobody can stand in front of it', !bad.length, { bad: bad.slice(0, 4), n: bad.length }));
  }
  // the torso's triangles in the world, as they are now; and whether a point is inside it (it hits the body going outwards, and going up)
  const torso = (g) => {
    const tris = [];
    g.root.updateMatrixWorld(true);
    g.model.traverse((m) => {
      if (!m.isSkinnedMesh) return;
      const ok = m.skeleton.bones.map((x) => /(Hips|Spine|Spine1|Spine2|LeftShoulder|RightShoulder)$/.test(x.name)), SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight, ix = m.geometry.index;
      const main = (k) => { let bb = 0, ww = -1; for (let c = 0; c < 4; c++) if (SW.getComponent(k, c) > ww) { ww = SW.getComponent(k, c); bb = SI.getComponent(k, c); } return bb; };
      m.skeleton.update();
      for (let t = 0, n = ix ? ix.count : SI.count; t < n; t += 3) {
        const id = [0, 1, 2].map((j) => (ix ? ix.getX(t + j) : t + j));
        if (id.every((k) => ok[main(k)])) tris.push(id.map((k) => m.getVertexPosition(k, V(0, 0, 0)).applyMatrix4(m.matrixWorld)));
      }
    });
    return tris;
  };
  const inside = (tris, p, g) => {
    const ray = new THREE.Ray(), hit = V(0, 0, 0), dir = V(p.x - g.root.position.x, 0, p.z - g.root.position.z).normalize();
    return [dir, V(0, 1, 0)].every((d) => { ray.set(p, d); return tris.some((t) => ray.intersectTriangle(t[0], t[1], t[2], false, hit) && hit.distanceTo(p) < 0.4 && hit.distanceTo(p) > 0.002); });
  };
  for (const br of [b, w.gal.brain]) for (const [inst, act] of [['guitar', 'guitar'], ['bass', 'playbass']]) {
    const who = `${br === b ? 'GUY' : 'GAL'}, ${inst}`, other = br === b ? w.gal.brain : b, g = br.g, o = w.objects[inst];
    T.settle(); T.home();
    for (const x of [b, w.gal.brain]) { x.queue = []; x.step = null; if (x.gtr.held) x.setGuitarHeld(false); x.gtr.override = null; x.resetGuitarMesh(); x.unlock(false); x.stayRoom = null; }
    other.choose('wander'); br.wantGuitar = 'guitar'; br.choose(act);
    const at = (pose, t) => { for (let i = 0; i < 120 * 30; i++) { if (br.pose === pose && br.step && br.step.type === 'play' && br.step.t >= t) return true; other.queue = []; step(1 / 30); } return false; };
    const loc = (n) => { o.guitar.updateWorldMatrix(true, false); return o.guitar.worldToLocal(g.boneWorld(n)); };
    const grip = () => { const k = loc('RightHandMiddle1'), m = loc('RightHandMiddle3'), th = loc('RightHandThumb3'); return { k: k.toArray(), m: m.toArray(), th: th.toArray(), ok: k.x > 0.25 && k.x < 0.7 && k.y < -0.02 && k.y > -0.075 && Math.abs(k.z) < 0.04 && m.z < -0.004 && Math.abs(m.y) < 0.035 && th.z > 0.015 && Math.abs(th.y) < 0.045 }; };
    // (he stands as far off as a walk may stop, 8 cm, the way that is furthest from his right hand: wherever he stops he must reach it)
    if (at('takeGuitar', 0)) { const p = o.local(br.guitarDx() + 0.055, br.guitarDz() + 0.055); g.root.position.x = o.x + p.x; g.root.position.z = o.z + p.z; }
    const a = at('takeGuitar', 0.95), g1 = a ? grip() : {};
    out.push(result(`guitar hold: ${who}: before it comes off the stand the hand is closed round the neck (knuckles beside it, fingertips behind it, thumb in front)`, a && g1.ok, g1));
    let far = 0;
    while (br.pose === 'takeGuitar' && br.step.t < 1.45) { step(1 / 30); const p = loc('RightHand').lerp(loc('RightHandMiddle1'), 0.75); far = Math.max(far, Math.hypot(p.y, p.z)); }
    out.push(result(`guitar hold: ${who}: the neck stays in the hand while it is lifted (it used to rise by itself)`, a && far > 0 && far < 0.11, { far }));
    const pl = at('guitar', 4);
    if (pl) {
      br.late();
      const tris = torso(g), cur = br.gtr.override, L = br.strapLine(cur), pts = L ? [...L.front.slice(1, -1), ...L.back.slice(1, -1)] : [], bad = pts.filter((p) => inside(tris, p, g)).length;
      const left = V(Math.cos(g.root.rotation.y), 0, -Math.sin(g.root.rotation.y)), fw = V(Math.sin(g.root.rotation.y), 0, Math.cos(g.root.rotation.y)), top = L && L.back[0], sh = g.boneWorld('LeftShoulder'), arm = g.boneWorld('LeftArm');
      const over = !!top && top.y > sh.y && top.clone().sub(g.root.position).dot(left) > 0.03 && top.clone().sub(g.root.position).dot(left) < arm.clone().sub(g.root.position).dot(left);
      const behind = !!L && Math.min(...L.back.map((p) => p.clone().sub(g.boneWorld('Spine2')).dot(fw))) < -0.05;
      const shown = !!br.strap && br.strap.every((m) => m.visible);
      out.push(result(`guitar hold: ${who}: the strap goes up the chest, over the left shoulder and across the back, and is nowhere inside the body`, pts.length > 40 && bad === 0 && over && behind && shown, { bad, of: pts.length, over, behind, shown }));
      // (the check can tell: the straight strap it used to be is found inside the chest)
      const s0 = sh.clone().add(V(0, 0.07, 0)).addScaledVector(fw, -0.03), old = [[br.gp(cur, -0.27, 0, 0), s0], [s0, br.gp(cur, 0.22, 0, 0)]].flatMap(([p, q]) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => p.clone().lerp(q, k / 10)));
      out.push(result(`guitar hold: ${who}: (the old straight strap is caught by that check)`, old.some((p) => inside(tris, p, g))));
    } else out.push(result(`guitar hold: ${who}: he plays it`, false));
    const c = at('putGuitar', 1.2), g2 = c ? grip() : {};
    out.push(result(`guitar hold: ${who}: putting it back the hand is round the neck until it stands`, c && g2.ok, g2));
    for (let i = 0; i < 90; i++) step(1 / 30);
    out.push(result(`guitar hold: ${who}: then he lets go: it is on its stand, the strap is gone`, !br.gtr.held && o.guitar.position.distanceTo(o.rest.pos) < 1e-3 && br.strap.every((m) => !m.visible), { held: br.gtr.held }));
  }
  for (const x of [b, w.gal.brain]) { x.queue = []; x.step = null; }
  T.galReset(); T.settle(); T.home(); T.resetRooms();
  out.push(result('guitar hold: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

T.sweepStudio = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); T.settle(); T.home();
  unlockRoom('studio');
  const before = w.obstacles.length;
  const added = R().add('studio');
  const sw = w.studio;
  out.push(result('studio: the room is added with its stage gear, record wall, booth and machine (all pathing obstacles)', added.ok && !!sw && w.obstacles.length === before + sw.obstacles.length && sw.obstacles.length > 4, { added: added.ok, obstacles: sw && sw.obstacles.length }));
  if (!sw) { R().reset('studio'); return out; }
  const bounds = w.doors.studio.shell.bounds;
  out.push(result('studio: the wall holds an album and a single for every song, sixty in all', sw.onWall().length === 60 && sw.onWall().filter((r) => r.kind === 'album').length === 12, { n: sw.onWall().length }));
  // somewhere to stand for each place
  {
    const free = (p) => !!p && p.x > bounds.minX && p.x < bounds.maxX && p.z > bounds.minZ && p.z < bounds.maxZ && w.walkable(p.x, p.z) && !w.obstacles.some((o) => o.active !== false && p.x > o.x0 && p.x < o.x1 && p.z > o.z0 && p.z < o.z1);
    const rec = sw.onWall()[5];
    const spots = [sw.stageSpot(0), sw.stageSpot(1), sw.stageFront(0), sw.floorSpot(0), sw.floorSpot(30), sw.crowdSpot(0), sw.deckStand(), sw.wallStand(rec), sw.machineStand()];
    out.push(result('studio: he can stand at the stage, on the floor, at the decks, the wall and the machine', spots.every(free), { bad: spots.map((p, i) => [i, free(p)]).filter(([, ok]) => !ok).map(([i]) => i) }));
  }
  // a DJ trip: a record off the wall, onto the deck, the music on; the last one out switches it off and the record goes home
  {
    T.settle(); T.home(); b.queue = []; b.step = null; b.musicOff(); b.choose('studiodj');
    let sawHeld = false, sawDeck = false, playing = false, maxY = 0;
    for (let i = 0; i < 120 * 30; i++) {
      step(1 / 30);
      if (sw.held(false).visible) sawHeld = true;
      if (sw.deckRecord()) sawDeck = true;
      if (b.music) playing = true;
      maxY = Math.max(maxY, G().root.position.y);
      if (b.last !== 'studiodj' && i > 300 && b.hereId() === 'main') break;
    }
    b.queue = []; b.step = null; b.skip(); b.choose('wander'); for (let i = 0; i < 60; i++) step(1 / 30);
    out.push(result('studio: a DJ trip takes a record off the wall (it is in his hand), puts it on the deck and the music plays', sawHeld && sawDeck && playing, { sawHeld, sawDeck, playing }));
    out.push(result('studio: when he is out the music is off, the deck is empty, no record is out and none is in his hand, and he never leaves the ground', !b.music && !sw.deckRecord() && sw.records.every((r) => !r.out) && !sw.held(false).visible && maxY < 0.1, { music: !!b.music, deck: !!sw.deckRecord(), out: sw.records.filter((r) => r.out).length, maxY }));
    T.settle(); T.home();
  }
  // a show and a party: the lights get their mood while it lasts and let go afterwards
  for (const [act, mode] of [['studioshow', 'show'], ['studioparty', 'party']]) {
    T.settle(); T.home(); b.queue = []; b.step = null; b.musicOff(); b.choose(act);
    let saw = false;
    for (let i = 0; i < 200 * 30; i++) {
      step(1 / 30);
      if (sw.mode() === mode) saw = true;
      if (b.last !== act && i > 300 && b.hereId() === 'main') break;
    }
    b.queue = []; b.step = null; b.skip(); b.choose('wander'); for (let i = 0; i < 60; i++) step(1 / 30);
    out.push(result(`studio: ${act} puts the lights in ${mode} mode and lets go of it afterwards, and the music is off when he leaves`, saw && sw.mode() === 'idle' && !b.music, { saw, mode: sw.mode(), music: !!b.music }));
    T.settle(); T.home();
  }
  // the instruments: each is added in the Studio, he stands at it and plays it: notes sound and the hands are on the instrument when they do
  for (const [act, name] of Object.entries({ playkeys: 'keyboard', playxylo: 'xylophone', playbongos: 'bongos' })) {
    T.settle(); T.home(); b.queue = []; b.step = null; b.musicOff();
    T.addObject(name);
    const o = w.objects[name], inStudio = !!o && w.roomIdAt(o.x, o.z) === 'studio';
    let hits = 0, far = 0, notes = new Set();
    if (o) {
      const hit = o.hit; o.hit = (side, i, other) => { hits++; notes.add(side + i); far = Math.max(far, G().boneWorld(side + 'HandMiddle3').distanceTo(o.hand(side, i))); return hit(side, i, other); };
      b.choose(act);
      for (let i = 0; i < 90 * 30; i++) { step(1 / 30); if (b.last !== act && i > 300 && b.hereId() === 'main') break; }
      o.hit = hit;
    }
    b.queue = []; b.step = null; b.skip(); b.choose('wander'); for (let i = 0; i < 60; i++) step(1 / 30);
    out.push(result(`studio: the ${name} is added in the Studio and he plays it (notes sound, the hand is on it at each one)`, inStudio && hits >= 12 && notes.size >= (name === 'bongos' ? 2 : 3) && far < 0.3, { inStudio, hits, notes: notes.size, far }));
    T.settle(); T.home();
  }
  // the bass is taken off its stand and worn: played facing the audience, the strings facing out, the hands on it, and put back afterwards.
  // (It used to stay on the stand, its strings to the player and its back to the room, while he poked at it.)
  {
    T.settle(); T.home(); b.queue = []; b.step = null; b.musicOff();
    T.addObject('bass');
    const o = w.objects.bass, inStudio = !!o && w.roomIdAt(o.x, o.z) === 'studio', V = (x, y, z) => new THREE.Vector3(x, y, z);
    let n = 0, held = true, body = 0, front = 1, handR = 0, handL = 0, out2 = 1, neck = 1, offStand = 9, walkedWith = true;
    if (o) {
      const toDoor = w.shellAxes('studio').toDoor, pluck = o.pluck, wp = V(0, 0, 0);
      o.pluck = (note, v) => {
        n++;
        o.guitar.updateWorldMatrix(true, false); o.guitar.getWorldPosition(wp);
        const root = G().root, fwd = V(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y)), left = V(Math.cos(root.rotation.y), 0, -Math.sin(root.rotation.y)), q = o.guitar.getWorldQuaternion(new THREE.Quaternion());
        held = held && b.gtr.held && b.gname === 'bass';
        body = Math.max(body, Math.hypot(wp.x - root.position.x, wp.z - root.position.z));
        front = Math.min(front, V(0, 0, 1).applyQuaternion(q).dot(fwd)); neck = Math.min(neck, V(1, 0, 0).applyQuaternion(q).dot(left));
        out2 = Math.min(out2, fwd.dot(toDoor));
        handR = Math.max(handR, G().boneWorld('RightHandMiddle3').distanceTo(o.string(1))); handL = Math.max(handL, G().boneWorld('LeftHandMiddle1').distanceTo(o.guitar.localToWorld(V(0.46, 0, 0))));
        offStand = Math.min(offStand, wp.distanceTo(o.group.localToWorld(o.rest.pos.clone())));
        return pluck(note, v);
      };
      b.choose('playbass');
      for (let i = 0; i < 90 * 30; i++) {
        step(1 / 30);
        if (b.gtr.held && b.step && b.step.type === 'walk') { b.late(); o.guitar.updateWorldMatrix(true, false); o.guitar.getWorldPosition(wp); if (Math.hypot(wp.x - G().root.position.x, wp.z - G().root.position.z) > 0.6) walkedWith = false; }
        if (b.last !== 'playbass' && i > 300 && b.hereId() === 'main') break;
      }
      o.pluck = pluck;
    }
    out.push(result('studio: the bass is off its stand and on him while he plays it, strings facing out, neck to his left, and he faces the audience', inStudio && n >= 12 && held && body < 0.5 && front > 0.8 && neck > 0.5 && out2 > 0.9 && offStand > 0.5 && walkedWith, { inStudio, n, held, body, front, neck, out2, offStand, walkedWith }));
    out.push(result('studio: both hands are on the bass when a note sounds (right fingers over the strings, left hand round the neck)', n > 0 && handR < 0.2 && handL < 0.2, { handR, handL }));
    b.late();
    out.push(result('studio: the bass is back on its stand when he has finished', !!o && !b.gtr.held && o.guitar.position.distanceTo(o.rest.pos) < 1e-3 && o.guitar.quaternion.angleTo(o.rest.quat) < 1e-3, { held: b.gtr.held }));
    // told to do something else while he is wearing it: it goes back on its stand before he leaves the Studio
    if (o) {
      b.queue = []; b.step = null; b.choose('playbass');
      for (let i = 0; i < 60 * 30 && !(b.pose === 'guitar' && b.step && b.step.t > 2); i++) step(1 / 30);
      const was = b.gtr.held, wanted = b.wantGuitar; b.wantGuitar = 'guitar';                    // (somebody pointed at the guitar in his own room some time before)
      b.skip(); let leftWith = false, put = false;
      for (let i = 0; i < 40 * 30 && b.hereId() !== 'main' && !put; i++) { step(1 / 30); if (b.gtr.held && b.hereId() !== 'studio') leftWith = true; if (!b.gtr.held) put = true; }      // (until it is back: after that he is free to take it up again)
      b.wantGuitar = wanted;
      out.push(result('studio: interrupted while wearing the bass, he puts it back on its stand before he goes anywhere (also when a guitar in another room was asked for earlier)', was && put && !leftWith && !b.gtr.held, { was, put, leftWith }));
      // taken away out of his hands
      b.queue = []; b.step = null; b.choose('playbass');
      for (let i = 0; i < 60 * 30 && !(b.pose === 'guitar' && b.step && b.step.t > 2); i++) step(1 / 30);
      w.removeObject('bass'); b.objectRemoved('bass'); for (let i = 0; i < 30; i++) step(1 / 30);
      out.push(result('studio: the bass removed while he is wearing it: he lets go and carries on', !b.gtr.held && !b.gtr.override && b.last !== undefined, { held: b.gtr.held }));
    }
    b.queue = []; b.step = null; b.skip(); b.choose('wander'); for (let i = 0; i < 60; i++) step(1 / 30);
    T.settle(); T.home();
  }
  // how wide it is, and the doors on its stage to the corner rooms beside it
  {
    const overlaps = () => { const bs = [{ id: 'main', ...w.MAIN_BOUNDS }, ...Object.values(w.doors).map((d) => ({ id: d.id, ...d.shell.bounds }))], bad = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const p = bs[i], q = bs[j]; if (p.minX < q.maxX - 1e-6 && q.minX < p.maxX - 1e-6 && p.minZ < q.maxZ - 1e-6 && q.minZ < p.maxZ - 1e-6) bad.push([p.id, q.id]); } return bad; };
    for (const wall of ['right', 'left', 'front', 'back']) {
      T.resetRooms(); T.settle(); T.home();
      const ok = R().add('studio', { walls: [wall] }).ok, d = w.doors.studio;
      out.push(result(`studio: on the ${wall} wall it is a 10 m square like every other room`, ok && Math.abs(w.shellSize('studio').l - 10) < 1e-6 && Math.abs(w.shellSize('studio').n - 10) < 1e-6 && !overlaps().length, { ok, size: ok && w.shellSize('studio') }));
      if (!ok) continue;
      const near = { right: ['right-back', 'right-front'], left: ['left-back', 'left-front'], front: ['left-front', 'right-front'], back: ['left-back', 'right-back'] }[wall], made = [];
      for (const [k, id] of ['library', 'bedroom'].entries()) made.push(R().add(id, { corners: [near[k]] }));
      const where = ['library', 'bedroom'].map((id) => { const c = w.doors[id]; if (!c || c.parent !== 'studio') return null; const l = d.shell.group.worldToLocal(new THREE.Vector3(w.doorPoint(id, 0).x, 0, w.doorPoint(id, 0).z)); return { z: +l.z.toFixed(2), side: +(Math.abs(l.x) - d.shell.L / 2).toFixed(3), clear: !w.obstacles.some((o) => o.active !== false && !o.char && [c.rect, c.rectIn].some((r) => o.x1 > r.x0 && o.x0 < r.x1 && o.z1 > r.z0 && o.z0 < r.z1)) }; });
      out.push(result(`studio: on the ${wall} wall two corner rooms open onto its stage, one at each end, with nothing in the way and no room on another`, made.every((m) => m.ok && m.parent === 'studio') && where.every((p) => p && p.z < -7.5 && p.z > -9.5 && Math.abs(p.side) < 0.01 && p.clear) && w.doors.library.wall !== w.doors.bedroom.wall && !overlaps().length, { where, parents: made.map((m) => m.parent), overlaps: overlaps() }));
      // saved and loaded again: the same rooms on the same ground
      const snap = JSON.parse(JSON.stringify(R().snapshot())), before2 = JSON.stringify(Object.fromEntries(Object.values(w.doors).map((x) => [x.id, x.shell.bounds])));
      T.resetRooms(); R().restoreFrom(snap);
      out.push(result(`studio: on the ${wall} wall the Studio and its corner rooms come back as they were`, JSON.stringify(Object.fromEntries(Object.values(w.doors).map((x) => [x.id, x.shell.bounds]))) === before2, { before2 }));
      if (wall === 'right') {                                          // he walks to a corner room across the stage, and back
        for (const id of ['library', 'bedroom']) {
          T.settle(); T.home(); b.queue = []; b.step = null; b.skip(true); b.visitRoom(id);
          let inside = false, back = false, via = false;
          for (let i = 0; i < 120 * 30 && !back; i++) { step(1 / 30); const h = b.hereId(); if (h === 'studio') via = true; if (h === id) inside = true; if (inside && h === 'main') back = true; }
          out.push(result(`studio: he goes through the Studio and its stage door into the ${w.doors[id].name}, and comes back`, via && inside && back, { via, inside, back }));
        }
      }
    }
    // a room already standing in a corner beside it; and a home saved while the Studio was up to 12 m wide (its `span`) comes back square
    T.resetRooms(); T.settle(); T.home();
    R().add('workshop', { walls: ['front'] }); R().add('library', { corners: ['right-front'] }); R().add('studio', { walls: ['right'] });
    out.push(result('studio: with a room in one corner it is the same size, and stands on nobody', w.doors.library && w.doors.library.parent === 'workshop' && Math.abs(w.shellSize('studio').l - 10) < 1e-6 && !overlaps().length, { l: w.doors.studio && w.shellSize('studio').l, overlaps: overlaps() }));
    { const inR = (p) => { const bb = w.doors.studio.shell.bounds; return p.x > bb.minX + 0.4 && p.x < bb.maxX - 0.4 && p.z > bb.minZ + 0.4 && p.z < bb.maxZ - 0.4; }, sp = [-4, 4].map((l) => w.shellPoint('studio', 5, l)); out.push(result('studio: and its middle is the middle of the room, not of the wall', sp.every(inR) && w.studio.stageSpot(0) && inR(w.studio.stageSpot(0)) && inR(w.studio.deckStand()), { sp })); }
    const old = JSON.parse(JSON.stringify(R().snapshot())); old.rooms.studio.span = { lo: -6, hi: 6 };
    T.resetRooms(); R().restoreFrom(old);
    out.push(result('studio: a home saved while the Studio was wide comes back with no room on another, the corner room on the grid', !overlaps().length && Math.abs(w.shellSize('studio').l - 10) < 1e-6 && w.doors.library && Math.abs(w.doors.library.shell.bounds.minZ - 5) < 1e-6, { overlaps: overlaps(), b: w.doors.library && w.doors.library.shell.bounds }));
    T.resetRooms(); T.settle(); T.home(); R().add('studio');
  }
  // a guitar pushed against a Studio wall hangs there, and comes off its hook when it is moved away again
  {
    const g = Object.values(w.objects).find((o) => o.guitar) || (w.addNew('guitar', { x: 0, z: 0 }), Object.values(w.objects).find((o) => o.guitar));
    if (!g) out.push(result('studio: there is a guitar to hang', false, {}));
    else {
      const doorSide = { right: 'minX', left: 'maxX', front: 'minZ', back: 'maxZ' }[w.doors.studio.wall];
      const side = ['minX', 'maxX', 'minZ', 'maxZ'].find((k) => k !== doorSide && (k === 'minZ' || k === 'maxZ' ? true : false)) || 'minZ';
      const nz = side === 'minZ' ? 1 : -1, wz = bounds[side];
      const cx = (bounds.minX + bounds.maxX) / 2;
      g.set(cx + 1.5, wz + nz * 0.7); g.rot = 0;
      for (let i = 0; i < 10; i++) step(1 / 30);
      const far = !g.hung;
      g.set(cx + 1.5, wz + nz * (0.225 + 0.04));
      for (let i = 0; i < 10; i++) step(1 / 30);
      const hung = g.hung, stand = g.stand.every((m) => !m.visible), flush = Math.abs(Math.abs(g.z - wz) - 0.05) < 0.03;
      out.push(result('studio: a guitar away from the walls stays on its stand, and one pushed against a Studio wall hangs there (stand hidden, flat on the wall)', far && hung && stand && flush, { far, hung, stand, z: g.z, wz }));
      g.set(cx + 1.5, wz + nz * 0.7);
      for (let i = 0; i < 10; i++) step(1 / 30);
      out.push(result('studio: moved away from the wall the guitar is back on its stand', !g.hung && g.stand.every((m) => m.visible), { hung: g.hung }));
    }
  }
  b.queue = []; b.step = null; T.settle(); T.home();
  R().reset('studio');
  out.push(result('studio: taking the room away takes the gear with it', !w.studio && w.obstacles.length === before, { studio: !!w.studio }));
  out.push(result('studio: no errors in the console', errors.length === base, { errs: errors.slice(base, base + 3) }));
  return out;
};

// ---- 12e. The Bowling Alley (src/bowlobjects.js, src/bowlbrain.js, rules in src/bowlrules.js): the room, a game, the pins, the book, what GUY builds for it --
T.sweepBowl = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.settle(); T.resetRooms(); T.removeAll(); T.forget(); T.settle(); T.home();
  unlockRoom('bowling');
  const before = w.obstacles.length;
  const added = R().add('bowling');
  const bw = w.bowl, kindOf = (k) => Object.values(w.objects).find((o) => o.kind === k);
  out.push(result('bowling: the room is added with three lanes, ball returns, a rack and a scoreboard (all pathing obstacles)', added.ok && !!bw && bw.lanes.length === 3 && w.obstacles.length === before + bw.obstacles.length && bw.obstacles.length === 5, { added: added.ok, lanes: bw && bw.lanes.length, obstacles: bw && bw.obstacles.length }));
  if (!bw) { R().reset('bowling'); return out; }
  // the equipment is inside the room and the robot has somewhere to stand for each piece
  {
    const bounds = w.doors.bowling.shell.bounds, inRoom = bw.obstacles.every((o) => o.x0 >= bounds.minX - 0.01 && o.x1 <= bounds.maxX + 0.01 && o.z0 >= bounds.minZ - 0.01 && o.z1 <= bounds.maxZ + 0.01);
    const free = (p) => w.walkable(p.x, p.z) && !w.obstacles.some((o) => o.active !== false && p.x > o.x0 && p.x < o.x1 && p.z > o.z0 && p.z < o.z1);
    const spots = [bw.rack.standSpot(), bw.boardStand(), bw.watchSpot(), ...[0, 1, 2].flatMap((i) => [bw.startSpot(i), bw.standSpot(i), bw.returnStand(i), bw.deckStand(i)])];
    out.push(result('bowling: the equipment is inside the room, and he can stand at the rack, the board, each ball return, the line and the pin deck', inRoom && spots.every(free), { inRoom, bad: spots.map((p, i) => [i, free(p)]).filter(([, ok]) => !ok).map(([i]) => i) }));
  }
  // the rules: a perfect game, spares, and the pins that a ball can knock over
  {
    const r = (a) => bw.laneState(0) && a;
    const lane = bw.laneState(1);
    lane.game = { rolls: [] }; for (let i = 0; i < 12; i++) bw.record(1, 10);
    const sc = [lane.game.rolls.length, bw.needsReset(1)];
    bw.startGame(1, 'T');
    out.push(result('bowling: twelve strikes make a game, and starting a game clears the card and sets all ten pins', sc[0] === 12 && bw.standing(1).length === 10 && bw.laneState(1).game.rolls.length === 0 && r(true)));
  }
  // the physics: a straight ball at the pocket knocks pins down and they lie where they fell; a gutter ball does nothing; the sweep and rack work
  {
    const from = bw.group.localToWorld(new window.THREE.Vector3(0.03, 0.3, -2.2));
    const res = bw.roll(0, { from, aim: 0.035, hook: 0, noise: 0, power: 1.1, rnd: lcg(7) });      // (a fixed throw: how many pins a ball at the pocket knocks over is a chance, tested below over many throws)
    for (let i = 0; i < 60 * (res.tHit + 5); i++) bw.update(1 / 60);
    const down = res.count, left = bw.standing(0).length;
    out.push(result('bowling: a ball at the pocket knocks pins over, the others stay up, and everything comes to rest', down >= 5 && down + left === 10 && !bw.busy(0), { down, left }));
    {
      const rnd = lcg(11), n = 400, counts = [];
      for (let k = 0; k < n; k++) counts.push(throwBall([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], { x0: 0.03, aim: 0.035, hook: 0, noise: 0, power: 1.1 }, rnd).down.length);
      const mean = counts.reduce((a, c) => a + c, 0) / n, few = counts.filter((c) => c < 5).length;
      out.push(result('bowling: a ball at the pocket knocks over 8 or more pins on average, and fewer than 5 only rarely (it is a chance: many throws, not one)', mean >= 8 && few / n < 0.03, { mean: +mean.toFixed(2), few }));
    }
    const a = bw.record(0, down);
    bw.manualReset(0);
    out.push(result('bowling: after the first roll the pins that fell are swept away (the others stand), after the second all ten are set again', (down === 10 ? a.next === 'rack' : a.next === 'sweep') && bw.standing(0).length === 10 - (down === 10 ? 10 : down) + (down === 10 ? 10 : 0), { next: a.next, standing: bw.standing(0).length }));
    bw.startGame(0, 'T');
    const gut = bw.roll(0, { from, aim: 0.6, hook: 0, noise: 0, power: 1 });
    for (let i = 0; i < 60 * (gut.tHit + 5); i++) bw.update(1 / 60);
    out.push(result('bowling: a ball thrown wide goes in the gutter and leaves every pin standing', gut.gutter !== 0 && gut.count === 0 && bw.standing(0).length === 10, { gutter: gut.gutter, count: gut.count }));
    bw.startGame(0, 'T');
  }
  // the skills: each chapter makes him steadier (the more he has read, the more pins he knocks over in a game)
  {
    const sk = (ids) => { T.forget(); T.learn(ids); return bowlSkill(b.skills); };
    const n = sk([]).noise, bk = sk(['bowling']).noise, h = sk(['bowling', 'bowling.ch2']), s = sk(['bowling', 'bowling.ch2', 'bowling.ch3']);
    out.push(result('bowling: the book and each chapter make him steadier (a hook with chapter 2, spares with chapter 3)', n > bk && bk > h.noise && h.noise > s.noise && h.hook > 0 && s.spares && !h.spares, { n, bk, h, s }));
    T.forget();
  }
  // a trip: in, a ball from the rack, rolls down his own lane with the card filling in, the pins set again between frames, the ball back in the rack
  {
    let rolls0 = bw.laneState(0).game.rolls.length, sawHeld = false, sawBoard = 0, maxY = 0, resetsSeen = 0, tenAtFrame = true;
    bw.startGame(0, null); T.settle(); T.home(); b.queue = []; b.step = null; b.choose('bowl');
    let guard = 0;
    for (let i = 0; i < 260 * 30; i++) {
      step(1 / 30);
      if (bw.held(false).visible) sawHeld = true;
      maxY = Math.max(maxY, G().root.position.y);
      const L = bw.laneState(0), rs = L.game.rolls;
      if (b.last !== 'bowl' && i > 300 && b.hereId() === 'main') break;
      guard = i;
    }
    const L = bw.laneState(0), rolls = L.game.rolls.length || (L.game.done ? 11 : 0);
    out.push(result('bowling: a trip rolls at least three balls down his lane and the scoreboard has them', rolls >= 3 && L.owner === 'GUY', { rolls: L.game.rolls, owner: L.owner }));
    out.push(result('bowling: the ball is in his hand when he delivers it (not on the floor), and he never leaves the ground', sawHeld && maxY < 0.03, { sawHeld, maxY }));
    out.push(result('bowling: every house ball is back in the rack when he leaves, and none is in his hand', bw.rack.balls.every((x) => !x.out) && !bw.held(false).visible, { out: bw.rack.balls.filter((x) => x.out).length }));
    b.queue = []; b.step = null; b.skip(); T.settle(); T.home();
  }
  // by hand he goes down the lane to set the pins; with an Automatic Pinsetter in the house the machine does it
  {
    bw.startGame(0, 'T'); const from = bw.group.localToWorld(new window.THREE.Vector3(0.03, 0.3, -2.2));
    const res = bw.roll(0, { from, aim: 0.035, noise: 0, power: 1.1 });
    for (let i = 0; i < 60 * (res.tHit + 5); i++) bw.update(1 / 60);
    bw.record(0, res.count);
    const pend = bw.needsReset(0);
    out.push(result('bowling: with no pinsetter the pins stay down until somebody resets them', !!pend && bw.supplies().setter === false && (() => { for (let i = 0; i < 300; i++) bw.update(1 / 60); return bw.needsReset(0) === pend; })(), { pend }));
    T.addObject('pinsetter');
    out.push(result('bowling: the Automatic Pinsetter is built into the alley (a machine over each lane) and the alley knows it is there', bw.supplies().setter === true && !!kindOf('pinsetter'), { setter: bw.supplies().setter }));
    for (let i = 0; i < 60 * 8; i++) bw.update(1 / 60);
    out.push(result('bowling: with the pinsetter the pins are swept away by themselves, and a whole new frame sets all ten again', bw.needsReset(0) === null && !bw.busy(0), { pend: bw.needsReset(0) }));
    bw.startGame(0, 'T');
    bw.laneState(0).pending = 'rack'; for (let i = 0; i < 60 * 8; i++) bw.update(1 / 60);
    out.push(result('bowling: the pinsetter racks all ten pins when a frame is over', bw.standing(0).length === 10 && bw.needsReset(0) === null, { standing: bw.standing(0).length }));
  }
  // what GUY builds for the alley: maple pins and a wooden ball (chapters 4 and 5 of the Wood & Metal book), and the pinsetter egg
  {
    T.removeAll(); T.forget(); T.settle();
    for (const k of ['pinsetter', 'bowlingpins', 'bowlingball']) delete w.stock.items[k];                 // (what the tests above put away in storage counts as built)
    R().isAdded('workshop') || (unlockRoom('workshop'), R().add('workshop'));
    T.addObject('woodfactory');
    const can = (id) => b.canBuild(id);
    T.learn(['workshop', 'workshop.materials']);
    const locked = !can('bowlingpins') && !can('bowlingball');
    T.learn(['workshop.materials.ch4']); const pins = can('bowlingpins') && !can('bowlingball');
    T.learn(['workshop.materials.ch5']); const ball = can('bowlingball');
    out.push(result('bowling: the pins need chapter 4 of the Wood & Metal book and the ball chapter 5 (not before)', locked && pins && ball, { locked, pins, ball }));
    const wantsNow = wants(b).map((x) => x.serves);
    out.push(result('bowling: with the alley added he wants wooden pins and a wooden ball, and no pinsetter yet (no Metal Factory)', wantsNow.includes('bowl.pins') && wantsNow.includes('bowl.ball') && !wantsNow.includes('egg.pinsetter'), { wantsNow }));
    T.addObject('metalfactory');
    out.push(result('bowling: the Metal Factory anywhere in the house makes him want the Automatic Pinsetter (the easter egg)', wants(b).some((x) => x.serves === 'egg.pinsetter'), { wants: wants(b).map((x) => x.serves) }));
  }
  // the equipment built for the alley changes it: maple pins on the lanes, a wooden ball in the rack
  {
    T.addObject('bowlingpins'); T.addObject('bowlingball');
    for (let i = 0; i < 5; i++) bw.update(1 / 30);
    out.push(result('bowling: a built ball puts a wooden ball in the rack, and a crate of pins that nobody has carried to a lane changes no lane', bw.state.woodBall && bw.rack.balls[8].mesh.visible && !!kindOf('bowlingpins') && bw.lanes.every((l) => l.style === 'plastic'), { styles: bw.lanes.map((l) => l.style), wood: bw.state.woodBall }));
  }
  // a set of maple pins: made in the Workshop, carried to a lane in both hands, and set up there in place of the old ones (it used to be left on the floor by the door)
  {
    const sets = () => Object.values(w.objects).filter((o) => o.kind === 'bowlingpins'), styles = () => bw.lanes.map((l) => l.style).join();
    const onFloor = () => sets().filter((o) => o.lane === undefined && !o.hauled && !o.stowed);
    const watch = (max, stop = () => false) => {
      const m = { hauled: 0, hands: 0, reach: [], swap: false, pit: false, both: 0, minY: 9, done: false, rooms: [] };
      for (let i = 0; i < max * 30 && !m.done; i++) {
        step(1 / 30);
        const h = b.hereId(); if (m.rooms.at(-1) !== h) m.rooms.push(h);
        if (b.hauling && b.hauling.o.kind === 'bowlingpins' && b.hauling.k > 0.98 && b.hauling.dir > 0 && b.pose === 'walk' && b.step && b.step.t > 0.5) {
          m.hauled++; const q = b.haulHands(); window.scene.updateMatrixWorld(true);
          if (G().boneWorld('LeftHand').distanceTo(q.L) < 0.28 && G().boneWorld('RightHand').distanceTo(q.R) < 0.28) m.hands++;
        }
        const s = b.step, L = bw.lanes.find((l) => l.swapping);
        if (L) { m.swap = true; if (L.pins.some((p) => p.state === 'pit')) m.pit = true; m.minY = Math.min(m.minY, G().root.position.y); }
        if (b.pose === 'bowlreach' && s && s.fx.at && s.t >= s.fx.at[0] && s.t < s.fx.at[0] + 1 / 25) { window.scene.updateMatrixWorld(true); const c = s.fx.bowl.point(), hd = G().boneWorld('RightHand'); m.reach.push(+hd.distanceTo(c).toFixed(2)); }
        if (stop(m)) return m;
        if (!L && m.swap && b.hereId() === 'main') m.done = true;
      }
      return m;
    };
    T.removeAll(); T.settle(); T.home();
    for (const k of ['bowlingpins', 'bowlingball']) delete w.stock.items[k];
    T.addObject('woodfactory'); T.learn(['workshop', 'workshop.materials', 'workshop.materials.ch4']);
    b.queue = []; b.step = null; b.forceRecipe = 'bowlingpins'; b.choose('build');
    const m = watch(220);
    out.push(result('bowling: new pins are carried in their crate, both hands on it, from the Workshop to the alley', m.hauled > 30 && m.hands / Math.max(1, m.hauled) > 0.9 && m.rooms.includes('workshop') && m.rooms.includes('bowling'), { hauled: m.hauled, hands: m.hands, rooms: m.rooms }));
    out.push(result('bowling: ... and replace the ten pins of one lane: the old ones go into the pit, the new ones are set up, the crate is left on no floor, the other lanes keep theirs', m.done && m.pit && styles() === 'maple,plastic,plastic' && bw.standing(0).length === 10 && sets().length === 1 && sets()[0].lane === 0 && !sets()[0].group.visible && !onFloor().length && !w.obstacles.includes(sets()[0].obstacle) && b.carry === null && !b.hauling, { done: m.done, pit: m.pit, styles: styles(), sets: sets().map((o) => [o.name, o.lane]) }));
    out.push(result('bowling: ... his hand really goes down to the pins he takes and sets (never set from above them), and he stays on the floor', m.reach.length === 9 && Math.max(...m.reach) < 0.42 && m.minY > -0.01, { reach: m.reach, minY: m.minY }));
    out.push(result('bowling: he wants a set for each lane, and no more', wants(b).some((x) => x.serves === 'bowl.pins' && x.n === 2) && b.canBuild('bowlingpins'), { wants: wants(b).filter((x) => x.serves === 'bowl.pins') }));
    // saved and put back: on its lane, not on the floor
    const snap = JSON.parse(JSON.stringify(w.layout.snapshot()));
    w.removeObject(sets()[0].name); for (const k of Object.keys(w.removed)) if (k.startsWith('bowlingpins')) delete w.removed[k];
    for (let i = 0; i < 3; i++) bw.update(1 / 30);
    const off = styles();
    w.layout.apply(snap); for (let i = 0; i < 3; i++) bw.update(1 / 30);
    out.push(result('bowling: taken away, the lane has its old pins back; put back from a save the set is on its lane again', off === 'plastic,plastic,plastic' && styles() === 'maple,plastic,plastic' && sets().length === 1 && sets()[0].lane === 0 && !onFloor().length, { off, now: styles() }));
    // a crate standing about (from the Catalog, or an older save that left it on the floor) is carried to the next lane, as a chore
    T.settle(); T.home();
    const loose = w.addInstance('bowlingpins', null, null, true);
    b.homeTried = -999; b.queue = []; b.step = null;
    out.push(result('bowling: a crate of pins left on the floor is a chore waiting', !!loose && b.homeMoveNext() === 'carryhome', { loose }));
    b.choose('carryhome');
    const half = watch(120, () => bw.lanes.some((l) => l.swapping && l.pins.filter((p) => p.state === 'up').length >= 4));
    b.skip(true); b.queue = []; b.step = null; b.choose('wander');
    const o = w.objects[loose];
    out.push(result('bowling: cut short half-way nothing is lost: the crate stands there full again, his hands are empty, and the lane waits for its pins', half.swap && !!o && o.lane === undefined && !o.hauled && o.group.visible && o.obstacle.active && o.group.children.filter((c) => c.userData.style === 'maple').every((c) => c.visible) && b.carry === null && !b.homeMove && b.pinLane == null && !bw.lanes.some((l) => l.swapping) && bw.laneState(1).pending === 'rack' && styles() === 'maple,plastic,plastic', { styles: styles(), pending: bw.laneState(1).pending, carry: b.carry }));
    T.settle(); T.home(); b.homeTried = -999; b.queue = []; b.step = null; b.choose('carryhome');
    const again = watch(160);
    out.push(result('bowling: ... and the next time he finishes the job: two lanes have maple pins', again.done && styles() === 'maple,maple,plastic' && bw.standing(1).length === 10 && !onFloor().length, { done: again.done, styles: styles() }));
    // GAL or GUY bowls on a lane with the new pins like on any other
    bw.startGame(0, 'T'); const from = bw.group.localToWorld(new window.THREE.Vector3(-1.97, 0.3, -2.2)), r = bw.roll(0, { from, aim: 0.035, hook: 0, noise: 0, power: 1.1, rnd: lcg(7) });
    for (let i = 0; i < 60 * (r.tHit + 5); i++) bw.update(1 / 60);
    out.push(result('bowling: the new pins fall and are set again like the old ones', r.count >= 5 && bw.standing(0).length === 10 - r.count && (bw.record(0, r.count), bw.manualReset(0), bw.startGame(0, null), bw.standing(0).length === 10) && bw.lanes[0].style === 'maple', { count: r.count }));
    for (const s of sets()) { w.removeObject(s.name); delete w.removed[s.name]; }
    for (const k of ['bowlingpins', 'bowlingball']) delete w.stock.items[k];
    T.settle(); T.home();
  }
  // a press on the rack asks him to bowl; the menu says so
  {
    T.removeAll(); T.settle(); T.home();
    const r = b.interact('ballrack');
    out.push(result('bowling: Go Bowling on the ball rack sends him to bowl', r.ok && (b.pendingActivity === 'bowl' || b.last === 'bowl'), { r }));
    b.pendingActivity = null; b.queue = []; b.step = null; b.skip(); T.settle(); T.home();
  }
  R().reset('bowling');
  T.settle();
  out.push(result('bowling: removing the room takes the equipment out of the pathing again, and the alley with it', !w.bowl && w.obstacles.length === before, { obstacles: w.obstacles.length, before }));
  out.push(result('bowling: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- The Bedroom and the Library: the furniture GUY and GAL build to furnish them, and how it is used (src/homeobjects.js, homebrain.js) ----
const HOME_RECIPES = ['bed', 'wardrobe', 'bedside', 'libshelf', 'readingchair', 'libdesk', 'globe'];
const HOME_ROOM = { bed: 'bedroom', wardrobe: 'bedroom', bedside: 'bedroom', libshelf: 'library', readingchair: 'library', libdesk: 'library', globe: 'library' };
T.sweepHome = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  const FURN = ['workshop', 'workshop.materials', 'workshop.furniture'];
  const homeWants = () => wants(b).map((x) => x.serves).filter((s) => s.startsWith('home.'));
  const built = (k) => kindIn(w, k);
  // 1. nothing is wanted before the rooms are added; then the Bedroom wants a bed, a wardrobe and a bedside table, the Library two shelves and a chair
  needSetup('right', FURN);
  const none = homeWants().length === 0 && b.pickRecipe() === null;
  R().add('bedroom');
  const bw = homeWants();
  R().add('library');
  const lw = homeWants();
  out.push(result('home: nothing is wanted before the rooms are added; the Bedroom wants a bed, a wardrobe and a bedside table, the Library two bookshelves and a reading chair',
    none && ['home.bed', 'home.wardrobe', 'home.bedside'].every((s) => bw.includes(s)) && !bw.includes('home.shelf') && ['home.shelf', 'home.readchair', 'home.desk', 'home.globe'].every((s) => lw.includes(s)), { none, bw, lw }));
  out.push(result('home: the Bedroom and the Library are in the corners beside the Workshop', !!w.doors.bedroom && !!w.doors.library && w.doors.bedroom.parent === 'workshop' && w.doors.library.parent === 'workshop', { b: w.doors.bedroom && w.doors.bedroom.parent, l: w.doors.library && w.doors.library.parent }));
  // 2. without the furniture book none of it is built
  T.forget(); T.learn(['workshop']);
  const locked = HOME_RECIPES.every((id) => !b.canBuild(id));
  T.learn(['workshop.materials', 'workshop.furniture']);
  out.push(result('home: it needs the furniture books (and the Wood Factory): without them none of it can be built, with them all of it can', locked && HOME_RECIPES.every((id) => b.canBuild(id)), { locked }));
  // 3. he builds all of it, one piece after another, and carries each into its room
  const times = [], clears = [];
  for (let i = 0; i < 12 && homeWants().length; i++) { times.push(buildToEnd(b, 1300)); clears.push(buildToEnd.clear); }
  out.push(result('home: he stands clear of every new piece as he puts it together (his legs were in the bed)', clears.length >= 8 && clears.every((c) => c !== null && c > 0.1), { clears }));
  {
    const n = () => [Object.keys(w.objects).length, w.obstacles.length, Object.keys(w.removed).length].join(), n0 = n();
    out.push(result('home: measuring a piece that is not built yet leaves nothing behind, and gives its real size', w.instanceKinds().every((k) => { const s = w.instanceSize(k); return s && s.bw > 0 && s.bd > 0; }) && n() === n0 && built('bed').every((o) => o.bw === w.instanceSize('bed').bw && o.bd === w.instanceSize('bed').bd), { n0, n1: n() }));
  }
  const where = Object.fromEntries(HOME_RECIPES.map((k) => [k, built(k).map((o) => w.roomIdAt(o.x, o.z))]));
  out.push(result('home: he builds a bed, a wardrobe and a bedside table for the Bedroom, two bookshelves, a reading chair, a reading desk and a globe for the Library, and puts each together in its own room',
    times.every((t) => t > 0) && HOME_RECIPES.every((k) => where[k].length === (k === 'libshelf' ? 2 : 1) && where[k].every((r) => r === HOME_ROOM[k])), { times, where }));
  out.push(result('home: every piece fits where it stands, none is left in the Workshop or in storage, and then nothing more is wanted', HOME_RECIPES.every((k) => built(k).every((o) => w.fits(o, o.x, o.z))) && HOME_RECIPES.every((k) => !w.stock.items[k]) && homeWants().length === 0 && b.pickRecipe() === null, { wants: homeWants(), stock: { ...w.stock.items } }));
  // 3b. cut short on the way with it flat-packed in his arms, it is set down in the Workshop: afterwards he (or GAL) carries it to its own room.
  //     (It used to stay in the Workshop for good: the bed, the wardrobe and the Library shelves piled up there.)
  {
    const res = {};
    for (const k of ['bed', 'libshelf']) {
      const o0 = built(k).find((o) => w.roomIdAt(o.x, o.z) === HOME_ROOM[k]); w.storeInstance(o0.name); b.objectRemoved(o0.name); delete w.stock.items[k];
      const had = new Set(built(k).map((o) => o.name));
      T.home(); b.queue = []; b.step = null; b.forceRecipe = k; b.choose('build');
      let t = 0, cut = false;
      while (t < 600 && !cut) { step(0.25); t += 0.25; if (b.carry === 'flat' && b.hereId() === 'workshop') { cut = true; b.queue = []; b.step = null; b.pendingActivity = 'wander'; step(0.5); } }
      const o = built(k).find((x) => !had.has(x.name));
      res[k] = { cut, dropped: !!o && w.roomIdAt(o.x, o.z), offered: b.available('carryhome') };
    }
    out.push(result('home: cut short carrying a bed or a bookshelf to its room, it is set down in the Workshop, and carrying it home is offered', Object.values(res).every((r) => r.cut && r.dropped === 'workshop' && r.offered), res));
    // locked: not offered while its room is locked, offered again once it is open
    w.setDoorLocked('bedroom', true);
    const lockedOff = !!w.doors.bedroom.locked && !b.homeMoves().some((m) => m.o.kind === 'bed');
    w.setDoorLocked('bedroom', false);
    out.push(result('home: a bed left in the Workshop is not carried while the Bedroom is locked, and is again once it is unlocked', lockedOff && b.homeMoves().some((m) => m.o.kind === 'bed'), { lockedOff }));
    // left alone, they carry each in: taken apart (flat in their arms), through the doors, and put together where it belongs
    let t = 0, flat = false, inside = 0, checked = 0;
    const g2 = b.other, setDown = new Map();                        // (robot -> the piece it carries; once it stands again, is the robot inside it?)
    while (t < 900 && (b.homeMoves().length || b.homeMove || (g2 && g2.homeMove))) {
      step(0.25); t += 0.25;
      for (const x of [b, g2].filter(Boolean)) {
        if (x.homeMove && x.carry === 'flat') { flat = true; setDown.set(x, x.homeMove.name); }
        const o = w.objects[setDown.get(x)], p = x.g.root.position;
        if (o && !o.packed) { checked++; if (Math.abs(p.x - o.x) < o.w / 2 + 0.1 && Math.abs(p.z - o.z) < o.d / 2 + 0.1) inside++; setDown.delete(x); }      // (measured the moment it is put together)
      }
    }
    const ok = ['bed', 'libshelf'].every((k) => built(k).every((o) => !o.packed && o.group.visible && w.roomIdAt(o.x, o.z) === HOME_ROOM[k] && w.fits(o, o.x, o.z)));
    out.push(result('home: left alone, they carry the bed to the Bedroom and the bookshelf to the Library, flat-packed, and put each together there where it fits, standing clear of it (his legs were in the bed as it grew); nothing is left in the Workshop', ok && flat && checked === 2 && !inside && !b.homeMoves().length, { t, flat, inside, checked, where: Object.fromEntries(['bed', 'libshelf'].map((k) => [k, built(k).map((o) => [w.roomIdAt(o.x, o.z), o.packed])])) }));
    // cut short while carrying it home: it is put together again (where he stands, or back where it was), never lost
    const bd = built('bed')[0]; T.strand('bed');
    T.home(); b.homeTried = -999; b.queue = []; b.step = null; b.pendingActivity = 'carryhome';
    let t2 = 0; while (t2 < 200 && !bd.packed) { step(0.25); t2 += 0.25; }
    const wasPacked = bd.packed;
    b.queue = []; b.step = null; b.pendingActivity = 'wander'; step(0.5);
    out.push(result('home: cut short carrying the bed home, it is put together again: visible, where it fits, not lost, nothing left in his arms', wasPacked && !bd.packed && bd.group.visible && !!w.objects[bd.name] && w.fits(bd, bd.x, bd.z) && b.carry !== 'flat' && !b.homeMove, { wasPacked, room: w.roomIdAt(bd.x, bd.z) }));
    // and it still goes home in the end
    let t3 = 0; while (t3 < 600 && w.roomIdAt(bd.x, bd.z) !== 'bedroom') { step(0.5); t3 += 0.5; }
    { let t4 = 0; while (t4 < 120 && (b.homeMove || bd.packed)) { step(0.5); t4 += 0.5; } }
    out.push(result('home: ...and it is carried to the Bedroom after all', w.roomIdAt(bd.x, bd.z) === 'bedroom' && !bd.packed, { t3, room: w.roomIdAt(bd.x, bd.z) }));
  }
  out.push(result('home: the heavy pieces (the bed, the wardrobe, the bookshelves, the desk) stay where they are put', ['bed', 'wardrobe', 'libshelf', 'libdesk'].every((k) => built(k).every((o) => o.weight === 'heavy'))));
  // 4. the bed has its head to the far wall, away from the door
  {
    const bed = built('bed')[0], head = bed.local(0, 1.0), q = w.doorPoint('bedroom', 0);
    const far = (p) => Math.hypot(p.x - q.x, p.z - q.z);
    out.push(result('home: the bed has its head against the far wall, away from the door', far({ x: bed.x + head.x, z: bed.z + head.z }) > far(bed), { head: far({ x: bed.x + head.x, z: bed.z + head.z }), bed: far(bed) }));
  }
  // 5. he uses it: pointed at each piece he goes in through the Workshop and does the right thing there, and comes out again
  {
    const cases = [['bed', ['makebed', 'homesit']], ['wardrobe', ['wardrobe']], ['bedside', ['wardrobe']], ['libshelf', ['browse']], ['readingchair', ['homesit']], ['libdesk', ['study']], ['globe', ['spinglobe']]];
    const res = {};
    for (const [k, acts] of cases) {
      const o = built(k)[0];
      T.home(); T.settle(); b.unlock(false); b.queue = []; b.step = null; b.pendingActivity = null; b.last = 'wander'; b.stayRoom = null;
      const r = b.interact(o.name);
      let t = 0, did = false, inRoom = false;
      while (t < 240 && !did) { step(0.25); t += 0.25; const st = b.step; if (acts.includes(b.last) && st && st.type === 'play' && st.fx && (st.fx.needs || st.fx.chairSit)) { did = true; inRoom = b.hereId() === HOME_ROOM[k]; } }
      res[k] = { ok: r.ok, did, inRoom, last: b.last };
      b.skip(); b.queue = []; b.step = null; b.pendingActivity = 'leave';
      { let t2 = 0; while (t2 < 240 && !(b.inMain() && Object.values(w.doors).every((d) => d.open === 0))) { if (b.last === 'leave') b.pendingActivity = 'wander'; step(0.25); t2 += 0.25; } }       // (and stays: off to the Bedroom again at once, the doors were never all shut)
    }
    out.push(result('home: pointed at the bed, the wardrobe, the bedside table, a bookshelf, the reading chair, the desk or the globe he goes in through the Workshop and uses it there', Object.values(res).every((x) => x.ok && x.did && x.inRoom), res));
    out.push(result('home: afterwards he is back in his own room with the doors shut', b.inMain() && Object.values(w.doors).every((d) => d.open === 0), { here: b.hereId() }));
  }
  // 5b. the bed and the reading chair are not chairs of his own room: sitting there is its own activity, and the plain 'sit' never uses them
  {
    const names = b.chairs().map((c) => c.name);
    out.push(result('home: the bed and the reading chair are for the Bedroom and the Library only: the plain Sit Down never picks them', !names.some((n) => /^(bed|readingchair)_/.test(n)), { names }));
  }
  // 6. the layout is saved: turned about and moved, the pieces come back where they were after a reload
  {
    built('readingchair')[0].rotate(1);
    const snap = JSON.parse(JSON.stringify(w.layout.snapshot()));
    const pos = Object.fromEntries(HOME_RECIPES.flatMap((k) => built(k).map((o) => [o.name, [o.x, o.z, o.rot]])));
    T.removeAll();
    const gone = HOME_RECIPES.every((k) => !built(k).length) && HOME_RECIPES.every((k) => w.stock.items[k] > 0);
    w.layout.apply(snap);
    const same = Object.entries(pos).every(([n, p]) => w.objects[n] && Math.abs(w.objects[n].x - p[0]) < 0.02 && Math.abs(w.objects[n].z - p[1]) < 0.02 && w.objects[n].rot === p[2] && w.roomIdAt(w.objects[n].x, w.objects[n].z) === HOME_ROOM[w.objects[n].kind]);
    out.push(result('home: taken out of the rooms they go to storage, and a restored layout puts every piece back in its room where, and turned the way, it was', gone && same && HOME_RECIPES.every((k) => !w.stock.items[k]), { gone, same, stock: { ...w.stock.items } }));
  }
  // 7. taking a room away takes its furniture with it, and adding it again makes him want it all again
  R().reset('bedroom');
  const lost = !built('bed').length && !built('wardrobe').length && !built('bedside').length && built('libshelf').length === 2 && homeWants().length === 0;
  const kept = ['bed', 'wardrobe', 'bedside'].every((k) => w.stock.items[k] === 1);
  R().add('bedroom');
  const again = ['bed', 'wardrobe', 'bedside'].map((k) => w.addInstance(k, null, null)).map((n) => n && w.roomIdAt(w.objects[n].x, w.objects[n].z));
  out.push(result('home: taking the Bedroom away takes its furniture out of it into storage (nothing is lost, the Library is untouched), and adding it again puts it back in the room', lost && kept && again.every((r) => r === 'bedroom'), { lost, kept, again, stock: { ...w.stock.items } }));
  T.resetRooms(); T.removeAll(); T.settle(); machine().hidden = true;
  out.push(result('home: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- Shut in by a locked door: the rooms whose doors are still open are still his (workbrain.js roomsInReach, rooms.js lockNote) ----------
// The Workshop door was locked with both robots in there: the message said they would "stay out", they stayed in the one room, and never
// carried anything into the Library and the Bedroom on either side of it, whose doors were open.
T.sweepShutIn = () => {
  const out = [], base = errors.length, w = W(), b = B(), g = G();
  const FURN = ['workshop', 'workshop.materials', 'workshop.furniture'], USES = ['makebed', 'homesit', 'wardrobe', 'browse', 'study', 'spinglobe'];
  galReset(); needSetup('right', FURN);
  R().add('library'); R().add('bedroom');
  const mid = (id) => { const q = w.doors[id].shell.bounds; return { x: (q.minX + q.maxX) / 2, z: (q.minZ + q.maxZ) / 2 }; };
  const put = (br, id, dx = 0, dz = 0) => { const p = id === 'main' ? { x: 0, z: 2 } : mid(id); br.unlock(false); br.skip(true); br.queue = []; br.step = null; br.pendingActivity = null; br.last = 'wander'; br.stayRoom = null; br.using = new Set(); br.g.root.position.set(p.x + dx, 0, p.z + dz); };
  const at = (br) => w.roomIdAt(br.g.root.position.x, br.g.root.position.z);
  const gal = w.gal.g && w.gal.g.loaded && galBuild().ok ? w.gal.brain : null;
  const lockByMenu = (id) => { window.__guyOpenDoorMenu(id); [...document.getElementById('menu').querySelectorAll('[data-act]')].find((x) => x.dataset.act === 'lock').click(); return document.getElementById('toast').textContent; };
  // 1. what the message says: outside they stay out; inside they are shut in (and it says which rooms they have)
  put(b, 'main'); if (gal) put(gal, 'main', 1.4);
  const n1 = lockByMenu('workshop');
  out.push(result('shut in: locked with nobody in there, the message says they will stay out (and nobody is shut in)', /will stay out/.test(n1) && !/shut in/.test(n1), { n1 }));
  const rl = b.visitRoom('library');
  out.push(result('shut in: from outside, the rooms behind the locked Workshop are out of reach too, and it says that the Workshop door is the one that is locked', b.doorLockedFor('library') && b.doorLockedFor('bedroom') && !rl.ok && /Workshop door is locked/.test(rl.message), { rl }));
  R().setDoorLocked('workshop', false);
  put(b, 'workshop', -1, 1);
  if (gal) {
    const n2 = lockByMenu('workshop');
    out.push(result('shut in: locked with only GUY in there, the message says GUY is shut in and GAL will stay out', /GUY is shut in/.test(n2) && /GAL will stay out/.test(n2), { n2 }));
    R().setDoorLocked('workshop', false);
    put(gal, 'workshop', 1.2, 1.6);
  }
  const n3 = lockByMenu('workshop');
  out.push(result('shut in: locked with them in there, the message does not say they will stay out: they are shut in, and can still use the Library and the Bedroom', !/stay out/.test(n3) && (gal ? /GUY and GAL are shut in/ : /GUY is shut in/).test(n3) && /Library/.test(n3) && /Bedroom/.test(n3), { n3 }));
  const refuse = b.interact('armchair'), refuse2 = b.visitRoom('workshop');
  out.push(result('shut in: what is outside is refused, with a message that says so', b.stuckIn() === 'workshop' && !b.canReach('main') && !refuse.ok && /shut in/.test(refuse.message) && !refuse2.ok && /shut in/.test(refuse2.message), { refuse, refuse2 }));
  // 2. left alone they build the furniture and carry it into the two rooms beside them (what stood in the Workshop already goes there too)
  { const p = mid('workshop'); w.addInstance('bedside', null, null, true, { x: p.x + 1, z: p.z - 2.5 }); }
  const first = kindIn(w, 'bedside')[0], started = first && w.roomIdAt(first.x, first.z);
  const all = () => HOME_RECIPES.every((k) => kindIn(w, k, HOME_ROOM[k]).length === (k === 'libshelf' ? 2 : 1));
  let t = 0, outside = 0;
  const been = new Set(), did = new Set(), galDid = new Set(), galBeen = new Set();
  while (t < 2400 && !(all() && been.has('library') && been.has('bedroom') && [...did].some((a) => USES.includes(a)))) {
    step(0.5); t += 0.5;
    been.add(at(b)); did.add(b.last); if (at(b) === 'main') outside++;
    if (gal) { galBeen.add(at(gal)); galDid.add(gal.last); if (at(gal) === 'main') outside++; }
  }
  const where = Object.fromEntries(HOME_RECIPES.map((k) => [k, kindIn(w, k).map((o) => w.roomIdAt(o.x, o.z))]));
  out.push(result('shut in the Workshop with the doors of the Library and the Bedroom open, GUY builds their furniture and carries every piece into its room (one that stood in the Workshop too)', started === 'workshop' && all(), { t, started, where, did: [...did], been: [...been] }));
  out.push(result('shut in: nobody ever came out through the locked door', outside === 0 && w.doors.workshop.open < 0.01, { outside, open: w.doors.workshop.open }));
  out.push(result('shut in: GUY goes in and out of both rooms and uses what is in there', ['workshop', 'library', 'bedroom'].every((r) => been.has(r)) && [...did].some((a) => USES.includes(a)), { been: [...been], did: [...did] }));
  if (gal) out.push(result('shut in: GAL goes into the rooms beside the Workshop too, instead of standing about in it', galBeen.has('library') || galBeen.has('bedroom'), { been: [...galBeen], did: [...galDid] }));
  // 3. told to: use something in another of those rooms, or go in there
  if (gal) put(gal, 'bedroom', 2.5, 2.5);
  put(b, 'workshop', -1, 1);
  const desk = kindIn(w, 'libdesk')[0], r3 = desk ? b.interact(desk.name) : { ok: false };
  let used = false;
  t = 0; while (t < 120 && !used) { step(0.25); t += 0.25; used = b.last === 'study' && at(b) === 'library' && !!b.step && b.step.type === 'play' && !!b.step.fx && (b.step.fx.needs || []).includes(desk && desk.name); }
  out.push(result('shut in: told to use the desk in the Library from the Workshop, he goes in there and does', r3.ok && used, { r3, used, last: b.last, here: b.hereId() }));
  put(b, 'library');
  const r4 = b.visitRoom('bedroom'), seen = new Set();
  t = 0; while (t < 120 && b.hereId() !== 'bedroom') { step(0.25); t += 0.25; seen.add(at(b)); }
  out.push(result('shut in: in the Library, told to go into the Bedroom, he goes there without leaving by the locked door', r4.ok && b.hereId() === 'bedroom' && seen.has('workshop') && !seen.has('main'), { r4, here: b.hereId(), seen: [...seen] }));
  // 4. a job in the Workshop, chosen when he is in the Library: straight into the Workshop for it, never at its locked door
  if (gal) put(gal, 'bedroom', 2.5, 2.5);
  put(b, 'library'); b.choose('tidytools');
  let tidied = false;
  t = 0; while (t < 90 && !tidied) { step(0.25); t += 0.25; tidied = at(b) === 'workshop' && !!b.step && ((b.step.fx && b.step.fx.needs) || []).includes('toolbox'); }
  out.push(result('shut in: from the Library he goes back into the Workshop for a job there', tidied, { here: b.hereId(), last: b.last }));
  // 5. their doors locked as well, with a piece in his arms: it is put together where he is, never by magic in the Library; unlocked, it goes home
  if (gal) put(gal, 'workshop', 2.5, 3);
  put(b, 'workshop', -1, 1);
  const globe = kindIn(w, 'globe')[0];
  if (globe) { w.removeObject(globe.name); delete w.removed[globe.name]; }
  b.forceRecipe = 'globe'; b.choose('build');
  t = 0; while (t < 90 && !b.carry) { step(0.1); t += 0.1; }
  const carried = !!b.carry;
  for (const id of ['library', 'bedroom']) R().setDoorLocked(id, true);
  t = 0; while (t < 60 && !kindIn(w, 'globe').length) { step(0.25); t += 0.25; }
  const g5 = kindIn(w, 'globe')[0], at5 = g5 && w.roomIdAt(g5.x, g5.z);
  out.push(result('shut in: the Library locked while he carries the globe to it, it is put together in the room he is in, never in the Library', carried && at5 === 'workshop' && at(b) === 'workshop', { carried, at5, here: at(b) }));
  out.push(result('shut in: with all three doors locked he is shut in the one room', b.stuckIn() === 'workshop' && b.roomsInReach().size === 1 && b.homeMoves().length === 0, { reach: [...b.roomsInReach()] }));
  R().setDoorLocked('library', false);
  const home5 = () => !!g5 && w.roomIdAt(g5.x, g5.z) === 'library' && !g5.packed;
  t = 0; while (t < 400 && !home5()) { step(0.5); t += 0.5; }
  out.push(result('shut in: the Library unlocked again (the Workshop not), the globe is carried in there', home5(), { at: g5 && w.roomIdAt(g5.x, g5.z) }));
  // 6. unlocked, he comes home
  for (const id of ['workshop', 'bedroom']) R().setDoorLocked(id, false);
  put(b, 'library'); b.pendingActivity = 'leave';
  t = 0; while (t < 200 && !b.inMain()) { step(0.25); t += 0.25; }
  out.push(result('shut in: unlocked, he comes home', b.inMain() && b.stuckIn() === null, { here: b.hereId() }));
  galReset(); machine().hidden = true; document.getElementById('menu').hidden = true;
  out.push(result('shut in: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- Shut in the Workshop with nothing the house needs: GUY (and GAL) build anyway (workbrain.js freeBuild / freeRecipe) ----------
// (Brett, Nov 23: locked in the Workshop they stood about: "There is nothing the house needs right now, so GUY has nothing to build.")
T.sweepShutBuild = () => {
  const out = [], base = errors.length, w = W(), b = B();
  const at = (br) => w.roomIdAt(br.g.root.position.x, br.g.root.position.z);
  const mid = (id) => { const q = w.doors[id].shell.bounds; return { x: (q.minX + q.maxX) / 2, z: (q.minZ + q.maxZ) / 2 }; };
  const put = (br, id, dx = 0, dz = 0) => { const p = id === 'main' ? { x: 0, z: 2 } : mid(id); br.unlock(false); br.skip(true); br.queue = []; br.step = null; br.pendingActivity = null; br.last = 'wander'; br.stayRoom = null; br.using = new Set(); br.forceRecipe = null; br.forceLine = null; br.g.root.position.set(p.x + dx, 0, p.z + dz); };
  const builtKinds = () => Object.values(w.objects).filter((o) => o.kind && RECIPES_DEF[o.kind]).map((o) => o.kind).concat(Object.entries(w.stock.items).flatMap(([k, n]) => (RECIPES_DEF[k] ? Array(n).fill(k) : [])));
  galReset(); needSetup('right', ['workshop'], { metal: true });
  // 1. not shut in, nothing needed: the owner's rule stands (nothing is built), and the message says how to set him to work
  put(b, 'main');
  const m1 = b.workRefusal('woodfactory');
  out.push(result('shut build: with nothing needed and the Workshop open he builds nothing, and tapping a factory says to lock him in to have him build', !wants(b).length && b.pickRecipe() === null && !b.available('build') && /Lock him in the Workshop/.test(m1 || ''), { wants: wants(b), m1 }));
  // 2. shut in the Workshop with nothing needed: he builds, and tapping a factory is not refused
  put(b, 'workshop', -1, 1); R().setDoorLocked('workshop', true);
  const free = !!(b.freeBuild && b.freeBuild()), picked = b.pickRecipe(), tap = b.workRefusal('woodfactory');
  out.push(result('shut build: shut in the Workshop with nothing needed he still has something to build (and a tap on the factory is not refused)', b.stuckIn() === 'workshop' && free && !wants(b).length && !!picked && b.available('build') && tap === null, { stuck: b.stuckIn(), free, picked, tap }));
  out.push(result('shut build: first something of use he has never made (the foot stool, with only the basic book), before any toy', picked === 'footstool' && (b.freeRecipe ? b.freeRecipe(() => true) : null) === 'footstool', { picked }));
  // left alone for a while: he builds one thing after another, all of it stays in the Workshop (the way out is locked), nobody leaves
  const e2 = errors.length, msgs = [], onB = b.onBuilt; b.onBuilt = (m) => { msgs.push(m); if (onB) onB(m); };
  let t = 0, outside = 0;
  while (t < 900 && builtKinds().length < 3) { step(0.5); t += 0.5; if (at(b) === 'main') outside++; }
  b.onBuilt = onB;
  const kinds = builtKinds();
  out.push(result('shut build: left shut in, he builds one thing after another (three within 15 minutes), each a different one, starting with the foot stool', kinds.length >= 3 && kinds.includes('footstool') && new Set(kinds).size === kinds.length && msgs.length >= 3, { t, kinds, msgs }));
  out.push(result('shut build: what he makes stays in the Workshop, and he never comes out through the locked door', outside === 0 && Object.values(w.objects).filter((o) => o.kind && RECIPES_DEF[o.kind]).every((o) => w.roomIdAt(o.x, o.z) === 'workshop') && w.doors.workshop.open < 0.01 && errors.length === e2, { outside, open: w.doors.workshop.open, errs: errors.slice(e2, e2 + 1) }));
  out.push(result('shut build: after the foot stool come the toys he has never made (decorations: the easter eggs, no ingredients needed)', kinds.filter((k) => k !== 'footstool').every((k) => !!RECIPES_DEF[k].egg), { kinds }));
  // 3. what is chosen: never a piece for a room that is not there; a second of a toy only once every one has been made; then nothing, and a message that says so
  T.learn(['workshop.materials', 'workshop.furniture', 'workshop.metal']);
  const roomless = Object.keys(RECIPES_DEF).filter((id) => (RECIPES_DEF[id].to && !w.doors[RECIPES_DEF[id].to]) || (RECIPES_DEF[id].eggRoom && !w.doors[RECIPES_DEF[id].eggRoom]));
  const seen = new Set(); for (let i = 0; i < 200; i++) seen.add((b.freeRecipe ? b.freeRecipe(() => true) : null));
  out.push(result('shut build: never a piece for a room that has not been added (a bed with no Bedroom, a table with no Restaurant)', roomless.length > 0 && roomless.every((id) => !seen.has(id)), { roomless, seen: [...seen] }));
  const eggs = Object.keys(RECIPES_DEF).filter((id) => RECIPES_DEF[id].egg && !RECIPES_DEF[id].eggRoom);
  const usable = Object.keys(RECIPES_DEF).filter((id) => !RECIPES_DEF[id].egg && !roomless.includes(id));
  for (const id of usable) w.stock.items[RECIPES_DEF[id].object] = RECIPES_DEF[id].cap + 1;           // (every useful thing made, as many as he makes)
  for (const id of eggs) if (!builtKinds().includes(id)) w.stock.items[id] = 1;                        // (and every toy once)
  const again = new Set(); for (let i = 0; i < 100; i++) again.add((b.freeRecipe ? b.freeRecipe(() => true) : null));
  out.push(result('shut build: with everything made once, he makes a second of a toy (never a third, never more furniture)', [...again].every((id) => eggs.includes(id)) && again.size > 1, { again: [...again] }));
  for (const id of eggs) w.stock.items[id] = 2 - Object.values(w.objects).filter((o) => o.kind === id).length;
  const none = b.pickRecipe(), m3 = b.cannotBuild();
  out.push(result('shut build: with two of every toy and all the furniture made there is nothing left, and the message says he has made everything he knows how to make', none === null && !b.available('build') && /made everything/.test(m3), { none, m3 }));
  for (const k of Object.keys(w.stock.items)) delete w.stock.items[k];
  T.forget(); T.learn([]);
  out.push(result('shut build: without the basic Workshop book he builds nothing, and the message names the book', b.pickRecipe() === null && /Workshop Basics/.test(b.cannotBuild()), { m: b.cannotBuild() }));
  R().setDoorLocked('workshop', false);
  // 4. GUY and GAL shut in together: both build, never the same new thing at once
  needSetup('right', ['workshop'], { metal: true });
  const gal = w.gal.g && w.gal.g.loaded && galBuild().ok ? w.gal.brain : null;
  if (gal) {
    gal.skills.learn('workshop');
    put(b, 'workshop', -1.5, 1); put(gal, 'workshop', 1.5, 1.6);
    R().setDoorLocked('workshop', true);
    const by = { GUY: 0, GAL: 0 }, oB = b.onBuilt, oG = gal.onBuilt;
    b.onBuilt = (m) => { by.GUY++; if (oB) oB(m); }; gal.onBuilt = (m) => { by.GAL++; if (oG) oG(m); };
    let t4 = 0, same = 0;
    while (t4 < 1200 && !(by.GUY >= 2 && by.GAL >= 2)) { step(0.5); t4 += 0.5; const bl = w.building || []; if (bl.length === 2 && bl[0].recipe === bl[1].recipe) same++; }
    b.onBuilt = oB; gal.onBuilt = oG;
    const k4 = builtKinds();
    out.push(result('shut build: GUY and GAL shut in the Workshop together both build (two things each within 20 minutes), never the same new thing at the same time', by.GUY >= 2 && by.GAL >= 2 && same === 0 && new Set(k4).size === k4.length, { t4, by, same, kinds: k4 }));
    R().setDoorLocked('workshop', false);
  }
  galReset(); machine().hidden = true; document.getElementById('menu').hidden = true;
  out.push(result('shut build: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

// ---- The Library: the bookshelves carried into it, its dust and cobwebs (librarybrain.js, library.js, room.js libraryShelfSpot) ----------
T.sweepLibrary = () => {
  const out = [], base = errors.length, w = W(), b = B();
  T.resetRooms(); T.removeAll(); T.settle(); T.home();
  const sh = w.objects.shelf;
  const shelfBooks = () => sh.books.filter((r) => r.mesh.parent === sh.group).length;
  const books0 = shelfBooks(), nBooks = sh.books.length;
  // 1. no Library: nothing to move, no dust to clean
  out.push(result('library: without a Library no shelf is moved and there is nothing to clean', !b.available('moveshelf') && !b.available('libclean') && b.shelfMoveNext() === null));
  // 2. a Library: dusty, with cobwebs in its four corners; the skill shelf (and a shelf he built) is wanted in it
  R().add('workshop', { walls: ['right'] }); R().add('library');
  const dust = w.doors.library && w.doors.library.shell.dust;
  out.push(result('library: a new Library is dusty: six patches on the floor and a cobweb in each of its four corners, all of them showing', !!dust && dust.spots.filter((s) => s.kind === 'floor').length === 6 && dust.spots.filter((s) => s.kind === 'web').length === 4 && dust.spots.every((s) => s.level === 1 && s.mesh.visible), { n: dust && dust.spots.length }));
  w.stock.items.bookshelf2 = 1;
  const b2 = w.addInstance('bookshelf2', null, null, false, { x: -3.8, z: 2.5 });
  const moves = b.shelfMoves().map((m) => m.o.name);
  out.push(result('library: the skill shelf and the shelf he built (in his room) are both wanted in the Library, the skill shelf first', moves[0] === 'shelf' && moves.includes(b2), { moves, b2 }));
  // 3. he carries each in: taken apart (out of sight, flat in his arms), through the doors, put together against a side wall, books and all
  const carried = {};
  for (let i = 0; i < 2; i++) {
    T.home(); b.queue = []; b.step = null; b.pendingActivity = 'moveshelf';
    let t = 0, packedSeen = false, flat = false, name = null;
    const rooms = new Set();
    while (t < 240) {
      step(0.25); t += 0.25;
      if (b.shelfMove) name = b.shelfMove.name;
      const o = name && w.objects[name];
      if (o && o.packed) { packedSeen = true; flat = flat || b.carry === 'flat'; rooms.add(b.hereId()); }
      if (o && !o.packed && w.roomIdAt(o.x, o.z) === 'library' && b.last !== 'moveshelf') break;
    }
    if (name) carried[name] = { t, packedSeen, flat, rooms: [...rooms] };
  }
  const inLib = (o) => !!o && !o.packed && o.group.visible && w.roomIdAt(o.x, o.z) === 'library' && w.fits(o, o.x, o.z);
  out.push(result('library: both shelves were taken apart, carried flat through the Workshop and put together in the Library, where they fit', inLib(sh) && inLib(w.objects[b2]) && Object.values(carried).length === 2 && Object.values(carried).every((c) => c.packedSeen && c.flat && c.rooms.includes('workshop')), { carried, shelf: [sh.x, sh.z], b2: w.objects[b2] && [w.objects[b2].x, w.objects[b2].z] }));
  const B2 = w.objects[b2];
  const front = (o) => { const l = o.local(-1, 0), c = w.roomSpot('library'); return (l.x * (c.x - o.x) + l.z * (c.z - o.z)) > 0; };
  out.push(result("library: each stands against a side wall of the Library with its books facing into the room, and none is left in GUY's room or packed", !!B2 && front(sh) && front(B2) && !Object.values(w.objects).some((o) => o.mainOnly && (o.packed || w.roomIdAt(o.x, o.z) === 'main')) && b.carry !== 'flat', { rot: [sh.rot, B2 && B2.rot] }));
  out.push(result('library: the books went with it: every book is still on the skill shelf, and nothing more is wanted', shelfBooks() === books0 && sh.books.length === nBooks && b.shelfMoves().length === 0 && !b.available('moveshelf'), { books0, now: shelfBooks() }));
  // 4. reading still works: the book comes off the shelf in the Library
  {
    T.forget();                                                       // (something to read: an earlier sweep can leave him having read every book on the shelf)
    w.stock.items.readingchair = 1; const rc = w.addInstance('readingchair', null, null, false);
    T.home(); b.queue = []; b.step = null; b.readFrom = null; b.pendingActivity = 'read';
    let t = 0, took = false, where = null, sat = null, couldNot = 0;
    const ui0 = b.ui; b.ui = (m) => { if (/could not/.test(String(m))) couldNot++; return ui0.call(b, m); };
    while (t < 260 && !sat) { step(0.25); t += 0.25; if (b.held && !took) { took = true; where = b.hereId(); } if (b.pose === 'readSit' && b.step && b.step.fx && b.step.fx.chair) sat = b.step.fx.chair; }
    b.ui = ui0;
    out.push(result('library: he still reads: he goes into the Library for a book from the shelf there, and sits down with it in the reading chair there (not in a chair of his own room, through the wall)', took && where === 'library' && sat === rc && !couldNot, { took, where, sat, rc, couldNot, t }));
    // while one robot carries the shelf off, reading at it is not offered (it was: he walked to where it had stood and could not get there)
    sh.packed = true; const noRead = !b.available('read'); sh.packed = false;
    out.push(result('library: while the skill shelf is packed up on its way, reading is not offered', noRead));
    T.settle();
  }
  // 5. cut short with the shelf flat in his arms: it is put together again, never lost
  {
    sh.rot = 0; sh.group.rotation.y = 0; sh.set(4.7, 0.2);                           // (back in his room, to be carried again)
    T.home(); b.queue = []; b.step = null; b.pendingActivity = 'moveshelf';
    let t = 0; while (t < 120 && !sh.packed) { step(0.25); t += 0.25; }
    const wasPacked = sh.packed;
    b.queue = []; b.step = null; b.pendingActivity = 'wander'; step(0.5);
    out.push(result('library: cut short while carrying the skill shelf, it is put together where he is (or back where it was): visible, in a room it may stand in, not lost', wasPacked && !sh.packed && sh.group.visible && ['main', 'library'].includes(w.roomIdAt(sh.x, sh.z)) && w.fits(sh, sh.x, sh.z) && b.carry !== 'flat' && !b.shelfMove, { wasPacked, at: [sh.x, sh.z], room: w.roomIdAt(sh.x, sh.z) }));
    T.settle();
  }
  // 6. cleaning: a few spots at a time, wiped away while he wipes; the dust comes back slowly; how clean it is is saved
  {
    T.home(); b.queue = []; b.step = null; b.pendingActivity = 'libclean';
    let t = 0; while (t < 200 && !(t > 5 && b.last !== 'libclean')) { step(0.25); t += 0.25; }
    const cleaned = dust.spots.filter((s) => s.level < 0.05);
    out.push(result('library: told to clean, he goes into the Library and wipes three spots away (cobwebs or dust) and they disappear', cleaned.length === 3 && cleaned.every((s) => !s.mesh.visible), { cleaned: cleaned.length, levels: dust.snapshot() }));
    for (let k = 0; k < 6 && b.available('libclean'); k++) { b.queue = []; b.step = null; b.pendingActivity = 'libclean'; let t2 = 0; while (t2 < 200 && !(t2 > 5 && b.last !== 'libclean')) { step(0.25); t2 += 0.25; } }
    const unreached = dust.spots.filter((s) => s.level > 0.5 && !b.dustStand(s, dust));
    out.push(result('library: in the end every patch and cobweb is clean (with the shelves in, every one can still be got to)', dust.dirty(0.5).length === 0 && !b.available('libclean'), { left: dust.snapshot(), unreached: unreached.map((s) => s.id) }));
    const snap = JSON.parse(JSON.stringify(R().snapshot()));
    out.push(result('library: how clean it is is saved with the rooms', Array.isArray(snap.rooms.library.dust) && snap.rooms.library.dust.every((v) => v < 0.1), { dust: snap.rooms.library.dust }));
    T.home();
    const keepShelf = [sh.x, sh.z, sh.rot];
    R().reset('library'); R().restoreFrom({ rooms: { library: snap.rooms.library } });
    const d2 = w.doors.library && w.doors.library.shell.dust;
    out.push(result('library: restored, it is as clean as it was (not dusty again)', !!d2 && d2.dirty(0.1).length === 0, { levels: d2 && d2.snapshot() }));
    if (d2) d2.update(1200);
    out.push(result('library: the dust settles again slowly: after 20 minutes the floor is half dusty, the cobwebs less, and nothing is thick yet', !!d2 && d2.spots.filter((s) => s.kind === 'floor').every((s) => s.level > 0.4 && s.level < 0.6) && d2.spots.filter((s) => s.kind === 'web').every((s) => s.level > 0.15 && s.level < 0.3), { levels: d2 && d2.snapshot() }));
    void keepShelf;
  }
  // 7. the Library taken away with the shelf in it: it comes back into his room (the skill shelf can never go to the Catalog)
  {
    T.home(); b.queue = []; b.step = null;
    sh.rot = 0; sh.group.rotation.y = 0; sh.set(4.7, 0.2);
    b.pendingActivity = 'moveshelf';
    let t = 0; while (t < 240 && !(w.roomIdAt(sh.x, sh.z) === 'library' && !sh.packed && b.last !== 'moveshelf')) { step(0.25); t += 0.25; }
    const was = w.roomIdAt(sh.x, sh.z);
    T.home(); b.queue = []; b.step = null; b.pendingActivity = null;
    R().remove('library'); step(1);
    out.push(result("library: taking the Library away brings the bookshelf back into GUY's room, books and all, where it fits", was === 'library' && !w.doors.library && w.roomIdAt(sh.x, sh.z) === 'main' && w.fits(sh, sh.x, sh.z) && sh.group.visible && shelfBooks() === books0, { was, at: [sh.x, sh.z] }));
  }
  // 7b. a piece growing into place when the clock is set back (a picture's setup does that) keeps its size (it used to blow up thousands of times)
  {
    b.popping = [{ o: sh, t: 0.3 }]; b.lateWork2(); b.time -= 40; b.lateWork2(); b.time += 40; for (let i = 0; i < 12; i++) { b.time += 0.1; b.lateWork2(); }
    out.push(result('library: a piece growing into place stays its own size even if the clock goes back, and ends at full size', Math.abs(sh.group.scale.x - 1) < 1e-6 && !b.popping.length, { scale: sh.group.scale.x }));
    sh.group.scale.setScalar(1); b.popping = [];
  }
  // 8. a shelf may stand in his room or the Library, nowhere else
  { const wb = w.doors.workshop.shell.bounds; out.push(result('library: a bookshelf may not be left in the Workshop', !w.fits(sh, (wb.minX + wb.maxX) / 2, (wb.minZ + wb.maxZ) / 2))); }
  T.resetRooms(); T.removeAll(); T.settle(); machine().hidden = true;
  out.push(result('library: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};

T.runAll = ({ seed = 0, upTo = 0 } = {}) => {
  const wasPaused = window.__qaPaused;
  if (seed) window.__qaPaused = true;                     // (the page's own animation loop would move the game between sweeps, by however long the page has been open: a seeded run is the simulation alone)      // (`upTo`: stop after that sweep: to replay a failure with everything that ran before it)
  const report = { coverage: T.coverage() };
  let sweepNo = 0;
  // each sweep starts with no added room: the Workshop (and what it made) is taken away again after any sweep that added it
  const S = (fn) => { sweepNo++; if (upTo && sweepNo > upTo) return { total: 0, passed: 0, failed: [] }; if (seed && T.seed) T.seed(seed * 1000 + sweepNo); let r; try { r = summarise(fn()); } catch (e) { r = summarise([result('sweep crashed: ' + e.message, false, { stack: String(e.stack).slice(0, 400) })]); } T.resetRooms(); return r; };
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
  report.chapters = S(T.sweepChapters);
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
  report.commands = S(T.sweepCommands);
  report.mowerShed = S(T.sweepMowerShed);
  report.shed = S(T.sweepShed);
  report.range = S(T.sweepRange);
  report.bowl = S(T.sweepBowl);
  report.doorMoves = S(T.sweepDoorMoves);
  report.allRooms = S(T.sweepAllRooms);
  report.needs = S(T.sweepNeeds);
  report.gal = S(T.sweepGal);
  report.mowing = S(T.sweepMowing);
  report.reading = S(T.sweepReading);
  report.play = S(T.sweepPlay);
  report.walkRooms = S(T.sweepWalkRooms);
  report.skillMenu = S(T.sweepSkillMenu);
  report.sports = S(T.sweepSports);
  report.botRules = S(T.sweepBotRules);
  report.workstation = S(T.sweepWorkstation);
  report.arrange = S(T.sweepArrange);
  report.paintings = S(T.sweepPaintings);
  report.corners = S(T.sweepCorners);
  report.home = S(T.sweepHome);
  report.library = S(T.sweepLibrary);
  report.roomRemoval = S(T.sweepRoomRemoval);        // (last: each sweep's seed is its number, so a new one goes at the end and leaves the others' seeds alone)
  report.studio = S(T.sweepStudio);        // (after the others, so their seeds stay the same)
  report.guitarHold = S(T.sweepGuitarHold);
  report.galDanceRoom = S(T.sweepGalDanceRoom);
  report.floorplan = S(T.sweepFloorplan);
  report.help = S(T.sweepHelp);
  report.restaurantWall = S(T.sweepRestaurantWall);
  report.shutIn = S(T.sweepShutIn);        // (last, so the others keep their seeds)
  report.shutBuild = S(T.sweepShutBuild);        // (after shutIn, so the others keep their seeds)
  if (seed && T.unseed) T.unseed();
  window.__qaPaused = wasPaused;
  T.lastReport = report;
  report.errorsLogged = errors.length;
  return report;
};
// ---- The view dropdown: static / follow / 3rd person / 1st person ----
T.sweepViews = async () => {
  const frames = (n = 4) => new Promise((r) => { let k = 0; const t0 = performance.now(); const f = () => { if (++k >= n || performance.now() - t0 > 4000) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });          // (the camera moves in the render loop, not in sim: wait for real frames)
  const out = [], base = errors.length, sel = document.getElementById('view-sel'), cam = window.__camera, b = B();
  const set = (v) => { sel.value = v; sel.dispatchEvent(new Event('change')); };
    const heading = () => { const v = cam.position.clone(); cam.getWorldDirection(v); return Math.atan2(v.x, v.z); };
    const dragTurn = async (id) => {          // a real left-drag of 150 px, then the picture must stay turned (nothing puts it back)
      const cv = document.querySelector('canvas'); cv.setPointerCapture = cv.releasePointerCapture = () => {};
      const h0 = heading(), fire = (t, x) => cv.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: innerHeight * 0.4, button: 0, buttons: 1, bubbles: true, pointerId: id, pointerType: 'mouse' }));
      fire('pointerdown', 300); for (let i = 1; i <= 10; i++) fire('pointermove', 300 + i * 15); fire('pointerup', 450); await frames(6);
      const h1 = heading(); delete cv.setPointerCapture; delete cv.releasePointerCapture;
      let dh = Math.abs(h1 - h0); if (dh > Math.PI) dh = Math.PI * 2 - dh; return dh;
    };
  const d = (p) => Math.hypot(p.x - b.g.root.position.x, p.z - b.g.root.position.z);
  try {
    out.push(result('views: the dropdown offers static, follow, 3rd person and 1st person', ['static', 'follow', 'third', 'first'].every((v) => [...sel.options].some((o) => o.value === v))));
    set('static'); const p0 = cam.position.clone(); step(3); await frames();
    out.push(result('views: static: the camera stays where it was', cam.position.distanceTo(p0) < 1e-6 && window.__ui.view() === 'static'));
    set('third'); step(3); await frames();
    const dist3 = d(cam.position);
    out.push(result('views: 3rd person: the camera is a few metres behind and above him', dist3 > 2 && dist3 < 4.5 && cam.position.y > 1.5 && window.__ui.view() === 'third', { dist3, y: cam.position.y }));
    out.push(result('views: 3rd person: the user keeps the controls (orbit, zoom, pan stay enabled)', window.__ui.controlsEnabled() === true));
    {   // a left press anywhere (even on furniture) must reach OrbitControls so a drag turns the camera
      const cv = document.querySelector('canvas'); let reached = 0; const spy = () => reached++;
      cv.setPointerCapture = cv.releasePointerCapture = () => {};      // a synthetic pointer has no capture to give OrbitControls
      cv.addEventListener('pointerdown', spy);        // (bubble phase: only runs if the capture handler did not stopImmediatePropagation... it is on the same element, so it is skipped when stopped)
      const hits = [[0.5, 0.5], [0.5, 0.7], [0.3, 0.6], [0.7, 0.6], [0.5, 0.85]];
      for (const [fx, fy] of hits) cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: innerWidth * fx, clientY: innerHeight * fy, button: 0, bubbles: true, pointerId: 41 }));
      cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 41 }));
      cv.removeEventListener('pointerdown', spy);
      out.push(result('views: 3rd person: a press anywhere on the picture still reaches the camera controls (left-drag orbits)', reached === hits.length, { reached, of: hits.length }));
    }
    {   // against the left wall with the camera behind him: it must stay inside his room, not hang in the next one
      const r = b.g.root, was = r.position.clone(), yaw = r.rotation.y;
      r.position.set(-4.6, 0, 0); r.rotation.y = Math.PI / 2;
      set('static'); set('third'); await frames(30);
      out.push(result('views: 3rd person: the camera is pulled in so it stays inside his room (no wall between it and him)', cam.position.x > -5 && cam.position.x < 5 && cam.position.distanceTo({ x: -4.6, y: 1.2, z: 0, isVector3: true }) > 0.4, { x: cam.position.x }));
      r.position.copy(was); r.rotation.y = yaw; set('third'); await frames(4);
    }
    { const dh = await dragTurn(51); out.push(result('views: 3rd person: dragging with the left button turns the camera and it stays turned', dh > 0.4, { dh })); }
    set('first'); step(3); await frames();
    { const dh = await dragTurn(52); out.push(result('views: 1st person: dragging with the left button turns the view and it stays turned', dh > 0.4, { dh })); }
    {
      const cv = document.querySelector('canvas'); let reached = 0; const spy = () => reached++;
      cv.addEventListener('pointerdown', spy);
      const hits = [[0.5, 0.5], [0.5, 0.7], [0.3, 0.6], [0.7, 0.6], [0.5, 0.85]];
      for (const [fx, fy] of hits) cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: innerWidth * fx, clientY: innerHeight * fy, button: 0, bubbles: true, pointerId: 42 }));
      cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 42 }));
      cv.removeEventListener('pointerdown', spy);
      delete cv.setPointerCapture; delete cv.releasePointerCapture;
      out.push(result('views: 1st person: a press anywhere on the picture still reaches the camera controls (left-drag looks round)', reached === hits.length, { reached, of: hits.length }));
    }
    const fov0 = cam.fov; document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true })); await frames(2);
    out.push(result('views: 1st person: the user keeps the controls: the wheel zooms the lens, drag looks around', window.__ui.controlsEnabled() === true && cam.fov > fov0, { fov0, fov: cam.fov }));
    cam.fov = fov0; cam.updateProjectionMatrix();
    const head = b.g.root.position.clone(); b.g.bones.Head.getWorldPosition(head);
    out.push(result('views: 1st person: the camera is at his head', cam.position.distanceTo(head) < 0.6 && cam.near < 0.1, { dist: cam.position.distanceTo(head), near: cam.near }));
    set('static'); await frames();
    out.push(result('views: back to static: the camera is back where it was and can be orbited again', cam.position.distanceTo(p0) < 1e-3 && cam.near >= 0.1 && window.__ui.controlsEnabled(), { moved: cam.position.distanceTo(p0) }));
    const key = (k) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('f'); const kOn = window.__ui.view(); key('f');
    out.push(result('views: the F key switches between static and the last moving view', kOn !== 'static' && window.__ui.view() === 'static', { kOn }));
  } catch (e) { out.push(result('views: sweep ran without throwing', false, { error: String(e && e.stack || e).slice(0, 400) })); }
  set('static');
  out.push(result('views: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};
// ---- Furnishing the house at the workstation: GUY orders things into and out of the room he picks (src/arrange.js) ----
T.sweepArrange = () => {
  const out = [], base = errors.length, w = W(), b = B(), ops = w.catalogOps;
  const gone = () => { if (w.objects.workstation) { w.removeObject('workstation'); b.objectRemoved('workstation'); } delete w.removed.workstation; };
  const run = (until, max = 90) => { let t = 0; while (t < max && !until()) { step(0.25); t += 0.25; } return t; };
  try {
    galReset(); T.settle(); T.resetRooms(); T.removeAll(); T.forget(); T.home(); T.settle(); gone();
    const wasDev = dev.all; dev.all = true; w.addNew('workstation', null); dev.all = wasDev;
    out.push(result('arrange: the workstation is connected to the Catalog (ops)', !!ops && !!w.objects.workstation && ops.status('guitar') !== 'unknown'));
    if (!ops || !w.objects.workstation) throw new Error('no workstation');
    // 1. he knows the guitar, there is none in the room: he wants one
    skillsOf().known.clear(); skillsOf().learn('guitar');
    b.lastWish = -999; b.wishFails = {};
    const wish = b.arrangeWish();
    out.push(result('arrange: knowing the guitar with none in the room, he wants one from the Catalog', !!wish && wish.act === 'arrange' && wish.add[0].id === 'guitar', { wish }));
    // 2. an order: he walks to the screen, taps it and the guitar is there
    b.queue = []; b.step = null;
    const r = b.arrangeOrder({ add: [{ id: 'guitar', room: 'main' }] });
    const t = run(() => !!w.objects.guitar);
    const sp = w.objects.workstation.screenPoint(), gp = b.g.root.position;
    out.push(result('arrange: asked to, he walks up to the workstation, taps the screen and the guitar appears in the room', r.ok && !!w.objects.guitar && Math.hypot(sp.x - gp.x, sp.z - gp.z) < 1.6, { msg: r.message, t, d: Math.hypot(sp.x - gp.x, sp.z - gp.z) }));
    // 3. he wants to sit and play: no chair, so he orders one out of storage first
    w.stock.items.builtchair = 1; delete w.stock.items.metalchair;
    for (const id of ['armchair', 'armchair2', 'chair', 'chair2']) if (w.objects[id]) { w.removeObject(id); b.objectRemoved(id); }
    b.lastWish = -999; b.wishFails = {};
    const chairWish = b.arrangeWish();
    out.push(result('arrange: with no free chair he wants one, and takes the chair he built out of storage before anything else', !!chairWish && chairWish.add && chairWish.add[0].id === 'builtchair', { chairWish, open: b.openChairs().length }));
    b.queue = []; b.step = null;
    b.arrangeOrder({ add: [{ id: 'builtchair', room: 'main' }] });
    run(() => Object.values(w.objects).some((o) => o.kind === 'builtchair'));
    out.push(result('arrange: the chair is in the room, out of storage, and he can sit on it', Object.values(w.objects).some((o) => o.kind === 'builtchair') && !w.stock.items.builtchair && b.openChairs().length > 0, { stock: w.stock.items, open: b.openChairs().length }));
    // 4. any room he chooses
    if (!w.rooms.isAdded('workshop')) { unlockRoom('workshop'); w.rooms.add('workshop'); }
    const addedWork = w.rooms.isAdded('workshop');
    w.removeObject('guitar'); b.objectRemoved('guitar');
    b.queue = []; b.step = null;
    b.arrangeOrder({ add: [{ id: 'guitar', room: 'workshop' }] });
    run(() => !!w.objects.guitar);
    const g = w.objects.guitar;
    out.push(result('arrange: he can put it in another room: the guitar is in the Workshop', addedWork && !!g && w.roomIdAt(g.x, g.z) === 'workshop', { room: g && w.roomIdAt(g.x, g.z) }));
    // 5. and take things out again
    b.queue = []; b.step = null;
    b.arrangeOrder({ remove: ['guitar'] });
    run(() => !w.objects.guitar);
    out.push(result('arrange: he can also order a thing out of the room: the guitar is gone', !w.objects.guitar));
    // 5b. on his own: he wants to play, the guitar is missing, and left alone he goes to the workstation and orders it
    b.queue = []; b.step = null; b.pendingActivity = null; b.lastWish = -999; b.wishFails = {}; T.settle();
    let tOwn = 0; while (tOwn < 240 && !w.objects.guitar) { b.lastWish = -999; step(0.5); tOwn += 0.5; if (tOwn > 5 && !b.step && !b.queue.length) b.choose(); }
    out.push(result('arrange: left alone with the skill and no guitar, he goes to the workstation by himself and orders one', !!w.objects.guitar, { tOwn }));
    if (w.objects.guitar) { w.removeObject('guitar'); b.objectRemoved('guitar'); }
    // 5c. the Workshop is for making things, not keeping them: an instrument is never ordered into it, and what is left there (an instrument,
    // a bed built for the Bedroom) he sends to its own room (a drum kit and a guitar used to stay in the Workshop for good)
    {
      const picks = new Set(); for (let i = 0; i < 40; i++) { picks.add(b.roomPick('guitar')); picks.add(b.roomPick('drums')); }
      out.push(result('arrange: a guitar or drum kit he orders goes in his own room, never the Workshop', picks.size === 1 && picks.has('main'), { picks: [...picks] }));
      unlockRoom('bedroom'); if (!w.rooms.isAdded('bedroom')) w.rooms.add('bedroom');
      T.addObject('drums'); if (w.objects.drums) { w.removeObject('drums'); b.objectRemoved('drums'); }
      w.stock.items.bed = 1;
      const ws = w.roomSpot('workshop');
      const inWs = [ops.add('drums', ws), ops.add('bed', ws)];
      const bed = () => Object.values(w.objects).find((o) => o.kind === 'bed');
      const at = () => ({ drums: w.objects.drums && w.roomIdAt(w.objects.drums.x, w.objects.drums.z), bed: bed() && w.roomIdAt(bed().x, bed().z) });
      const before = at();
      // on his own: left alone, he goes to the workstation and sends each to its room
      b.queue = []; b.step = null; b.pendingActivity = null; b.wishFails = {}; T.settle();
      let tm = 0; while (tm < 300 && !(at().drums === 'main' && at().bed === 'bedroom')) { b.lastWish = -999; step(0.5); tm += 0.5; if (tm > 5 && !b.step && !b.queue.length) b.choose(); }
      const after = at(), bd = bed(), site = w.instanceSite('bed');
      out.push(result('arrange: a drum kit and a bed left in the Workshop: he goes to the workstation and sends the drums to his room and the bed to its place in the Bedroom', inWs.every(Boolean) && before.drums === 'workshop' && before.bed === 'workshop' && after.drums === 'main' && after.bed === 'bedroom' && !!bd && Math.hypot(bd.x - site.x, bd.z - site.z) < 0.3, { inWs, before, after, tm, bedAt: bd && [bd.x, bd.z], site }));
      b.wishFails = {}; b.lastWish = -999;
      out.push(result('arrange: once everything is where it belongs he has nothing left to move', !b.misplaced().length, { left: b.misplaced().map((m) => m.o.name) }));
      if (w.objects.drums) { w.removeObject('drums'); b.objectRemoved('drums'); }
      if (bd) w.storeInstance(bd.name);
      delete w.stock.items.bed;
    }
    // 6. nothing to order: no wish, and with no workstation an order is refused in words
    skillsOf().known.clear(); b.lastWish = -999; b.wishFails = {};
    out.push(result('arrange: without the skill he has no wish for the guitar', !b.arrangeWish() || b.arrangeWish().key !== 'guitar'));
    gone();
    const r6 = b.arrangeOrder({ add: [{ id: 'guitar', room: 'main' }] });
    out.push(result('arrange: with no workstation the order is refused in words', !r6.ok && /workstation/.test(r6.message), { r6 }));
  } catch (e) { if (!/no workstation/.test(e.message)) out.push(result('arrange: sweep ran without throwing', false, { error: String(e && e.stack || e).slice(0, 400) })); }
  gone(); delete w.stock.items.builtchair; T.resetRooms();
  out.push(result('arrange: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
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
    let m = w.objects.workstation;
    out.push(result('workstation: with the premium unlock it is added and fits in the room', !!m && w.fits(m, m.x, m.z)));
    if (!m) throw new Error('no workstation');
    // 2. what is on the shelf, and what GUY knows
    T.addObject('telescope'); T.addBook('stars');
    skillsOf().known.clear(); skillsOf().learn('ball');
    const shelfBooks = w.objects.shelf.books.length;
    window.__guyOpenMenu('workstation');
    const mb = [...document.getElementById('menu').querySelectorAll('[data-act="interact"]')].map((x) => x.textContent).join('|');
    document.getElementById('menu').hidden = true;
    out.push(result('workstation: its long-press menu offers "Use Workstation"', /Use Workstation/.test(mb), { mb }));
    // 3. GUY goes to it, taps the screen and the panel opens
    b.queue = []; b.step = null;
    const r = b.interact('workstation');
    const t = runUntil(() => ws.isOpen(), 60);
    const sp = m.screenPoint(), gp = G().root.position;
    out.push(result('workstation: asked to use it, GUY walks up, taps the screen and the panel opens for GUY', r.ok && ws.isOpen() && /GUY/.test(panel.querySelector('.who').textContent) && Math.hypot(sp.x - gp.x, sp.z - gp.z) < 1.6, { msg: r.message, t, d: Math.hypot(sp.x - gp.x, sp.z - gp.z) }));
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
    // 4b. dragged into another room he still uses it: he walks there through the door (he used to give up at once: 'learn' and
    // 'arrange' were planned as if the workstation were always in his own room)
    ws.close();
    if (!w.rooms.isAdded('workshop')) { unlockRoom('workshop'); w.rooms.add('workshop'); }
    T.settle();
    const home0 = { x: m.x, z: m.z }, along = (p) => { for (let i = 1; i <= 40; i++) w.dragTo(m, m.x + (p.x - m.x) * i / 40, m.z + (p.z - m.z) * i / 40); };
    along(w.doorPoint('workshop', 1.4)); along(w.doorPoint('workshop', -2.4)); w.dropObject(m);
    const inWs = b.roomOfObj('workstation') === 'workshop';
    b.queue = []; b.step = null; T.home();
    const r4 = b.interact('workstation');
    const t4 = runUntil(() => ws.isOpen(), 90);
    const sp4 = m.screenPoint(), gp4 = G().root.position;
    out.push(result('workstation: dragged into the Workshop, GUY walks through the door to it and the panel opens', inWs && r4.ok && ws.isOpen() && Math.hypot(sp4.x - gp4.x, sp4.z - gp4.z) < 1.6, { inWs, at: { x: m.x, z: m.z }, msg: r4.message, t: t4, label: label() }));
    ws.close(); b.queue = []; b.step = null; T.home();
    const ro = b.arrangeOrder({ add: [{ id: 'plant', room: 'main' }], remove: [] });
    const t4b = runUntil(() => !!w.objects.plant, 90);
    out.push(result('workstation: in the Workshop, an order (add a plant) is still carried out there', ro.ok && !!w.objects.plant, { msg: ro.message, t: t4b, label: label() }));
    if (w.objects.plant) { w.removeObject('plant'); b.objectRemoved('plant'); }
    // 4c. a reload keeps it where it was moved to: it used to vanish (premium objects were not saved with the Catalog's additions), so
    // the user added it again and it stood in GUY's room, and he only ever used it there
    { const cat = window.__catalog, saved = JSON.parse(JSON.stringify(cat.extras())), lay = JSON.parse(JSON.stringify(w.layout.snapshot()));
      const visit = (unlocked) => { ws.close(); b.queue = []; b.step = null; gone(); const was = dev.all; dev.all = unlocked; cat.restoreExtras(saved); dev.all = was; w.layout.apply(JSON.parse(JSON.stringify(lay))); m = w.objects.workstation; };
      visit(true);
      out.push(result('workstation: saved with what the user added, it comes back after a reload in the Workshop, where it was moved to', saved.objects.includes('workstation') && !!m && b.roomOfObj('workstation') === 'workshop', { saved: saved.objects, at: m && b.roomOfObj('workstation') }));
      T.home(); const r4c = m ? b.interact('workstation') : { ok: false }, t4c = runUntil(() => ws.isOpen(), 90), sp = m && m.screenPoint(), gp = G().root.position;
      out.push(result('workstation: after the reload GUY walks to it in the Workshop and the panel opens', r4c.ok && ws.isOpen() && !!sp && Math.hypot(sp.x - gp.x, sp.z - gp.z) < 1.6 && w.roomIdAt(gp.x, gp.z) === 'workshop', { msg: r4c.message, t: t4c, label: label() }));
      visit(false);
      out.push(result('workstation: with premium locked it does not come back on a reload', !m));
      visit(true);
      if (!m) throw new Error('no workstation after the reload'); }
    along(w.doorPoint('workshop', 1.4)); along(home0); w.dropObject(m); b.queue = []; b.step = null; T.home(); T.settle();
    // 5. the other robot: the book is still there for her, and she can use the workstation too
    ws.close(); out.push(result('workstation: the panel closes', !ws.isOpen()));
    const gb = galBuild();
    if (!gb.ok) { out.push(result('workstation: GAL could be built for the test', false, gb)); throw new Error('no GAL'); }
    const gal = w.gal, gbr = gal.brain;
    gbr.skills.known.clear();
    out.push(result('workstation: the book GUY learned from is still there for GAL to read (and she does not know it)', !!gbr.shelfBook('stars') && !gbr.skills.has('telescope')));
    gbr.queue = []; gbr.step = null; gbr.pendingActivity = null;
    const r2 = gbr.interact('workstation');
    const t2 = runUntil(() => ws.isOpen(), 80);
    out.push(result('workstation: GAL can use it too: the panel opens for GAL', r2.ok && ws.isOpen() && /GAL/.test(panel.querySelector('.who').textContent), { msg: r2.message, t: t2 }));
    if (btnOf('stars')) btnOf('stars').click();
    out.push(result('workstation: Learn there teaches GAL, and not GUY a second time', gbr.skills.has('telescope') && btnOf('stars') && btnOf('stars').disabled));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    out.push(result('workstation: Escape closes the panel', !ws.isOpen()));
    // 5b. Learn all (the panel): every book on the shelf at once
    skillsOf().known.clear(); gbr.queue = []; gbr.step = null;
    ws.open(b);
    const allBtn = panel.querySelector('.all'), left0 = [...panel.querySelectorAll('.learn:not(:disabled)')].length;
    const t5 = performance.now(); allBtn.click();
    out.push(result('workstation: "Learn all" teaches every book on the shelf at once and every row switches to Learned', left0 === shelfBooks && w.objects.shelf.books.every((x) => skillsOf().has(x.def.teaches)) && [...panel.querySelectorAll('.learn')].every((x) => x.disabled && x.textContent === 'Learned') && allBtn.disabled, { left0, shelfBooks, ms: Math.round(performance.now() - t5) }));
    ws.close();
    // 5c. GUY tells GAL: read one book, or use the workstation for one skill or for everything
    const V5 = window.__voice, L5 = (r) => r.lines.map((l) => `${l.who}: ${l.text}`).join(' | ');
    skillsOf().known.clear(); gbr.skills.known.clear(); b.unlock(false); b.queue = []; b.step = null; b.last = 'wander'; b.pendingActivity = null; gbr.queue = []; gbr.step = null; gbr.pendingActivity = null; gal.audience = null;
    const rr = V5.run('tell GAL to read the stargazing book');
    out.push(result('workstation: "tell GAL to read the stargazing book": GUY hands it over and she is sent to read that very book', rr.ok && rr.lines[0].who === 'guy' && gbr.pendingActivity === 'read' && !!gbr.forceBook && gbr.forceBook.def.id === 'stars', { lines: L5(rr), pending: gbr.pendingActivity, book: gbr.forceBook && gbr.forceBook.def.id }));
    gbr.pendingActivity = null; gbr.forceBook = null; gbr.skip(true); gal.audience = null; gbr.queue = []; gbr.step = null; b.pendingActivity = null;
    const r1 = V5.run('tell GAL to use the workstation to learn stargazing');
    const t6 = runUntil(() => gbr.skills.has('telescope'), 90);
    out.push(result('workstation: "tell GAL to use the workstation to learn stargazing": she walks up, taps the screen and learns just that, with no panel', r1.ok && r1.lines.some((l) => l.who === 'gal') && gbr.skills.has('telescope') && !gbr.skills.has('stereo') && !skillsOf().has('telescope') && !ws.isOpen(), { lines: L5(r1), t: t6, galKnows: [...gbr.skills.known], guyKnows: [...skillsOf().known] }));
    gbr.skip(true); gbr.queue = []; gbr.step = null; gal.audience = null;
    const r2b = V5.run('tell GAL to learn everything');
    const t7 = runUntil(() => w.objects.shelf.books.every((x) => gbr.skills.has(x.def.teaches)), 120);
    out.push(result('workstation: "tell GAL to learn everything": she uses the workstation and knows every book on the shelf, and GUY is unchanged', r2b.ok && w.objects.shelf.books.every((x) => gbr.skills.has(x.def.teaches)) && skillsOf().known.size === 0 && !ws.isOpen(), { lines: L5(r2b), t: t7 }));
    gbr.skip(true); gbr.queue = []; gbr.step = null; gal.audience = null; b.queue = []; b.step = null; b.last = 'wander'; b.pendingActivity = null;
    const r3b = V5.run('learn everything');
    const t8 = runUntil(() => w.objects.shelf.books.every((x) => skillsOf().has(x.def.teaches)), 120);
    out.push(result('workstation: GUY told "learn everything" uses it himself and knows every book on the shelf', r3b.ok && r3b.lines[0].who === 'guy' && w.objects.shelf.books.every((x) => skillsOf().has(x.def.teaches)), { lines: L5(r3b), t: t8 }));
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
  const follow = document.getElementById('view-sel'), skills = document.getElementById('skills');
  const was = SL.mode;
  try {
    SL.setMode('off', { quiet: true });
    out.push(result('screenlock: off: the HUD buttons take touches, the canvas takes the canvas, the lock button is there', at(follow) === follow && body.dataset.lock === 'off' && !!btn && btn.title.includes('Off')));
    const f0 = (window.__ui.view() !== 'static'); key('f'); const f1 = (window.__ui.view() !== 'static'); key('f');
    out.push(result('screenlock: off: the F key still toggles follow', f0 !== f1));
    // on
    document.getElementById('menu').hidden = false; skills.hidden = false;
    SL.setMode('on', { quiet: true });
    out.push(result('screenlock: on: menus and panels close when the screen locks', document.getElementById('menu').hidden && skills.hidden));
    out.push(result('screenlock: on: the HUD buttons, the canvas and the catalog do not take touches, the lock button still does', at(follow) !== follow && at(document.getElementById('skip-btn')) !== document.getElementById('skip-btn') && at(canvas) !== canvas && at(btn) === btn));
    const g0 = (window.__ui.view() !== 'static'); key('f'); key('k'); key(' ');
    out.push(result('screenlock: on: keys do nothing (follow, skills panel, next)', (window.__ui.view() !== 'static') === g0 && skills.hidden));
    out.push(result('screenlock: on: the camera is frozen', window.__ui.controlsEnabled() === false));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: innerWidth / 2, clientY: innerHeight / 2, button: 0, bubbles: true, pointerId: 31 }));
    out.push(result('screenlock: on: pressing the canvas starts no object press', window.__ui.pending === null));
    // camera only
    SL.setMode('camera', { quiet: true });
    out.push(result('screenlock: camera only: the canvas takes touches (camera), the HUD buttons do not', at(canvas) === canvas && at(follow) !== follow && body.dataset.lock === 'camera'));
    out.push(result('screenlock: camera only: the camera is live, keys still do nothing', window.__ui.controlsEnabled() === true && (key('f'), (window.__ui.view() !== 'static') === g0)));
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
// ---- Voice and typed commands (src/voice.js, src/tts.js): the parser, GUY handing a request to GAL, her audience, the offline voices ----
const VOICE_PHRASES = [
  ['play the piano', 'object', 'piano'], ['GUY, play the guitar please', 'object', 'guitar'], ['can you play the drums', 'object', 'drums'], ['turn on the lamp', 'object', 'lamp'],
  ['it is dark in here', 'object', 'lamp'], ['put some music on', 'object', 'table'], ['play ball', 'object', 'ball'], ['let us paint something', 'object', 'easel'],
  ['look at the stars', 'object', 'telescope'], ['water the plant', 'object', 'plant'], ['keep playing the guitar', 'object', 'guitar'],
  ['stop the music', 'object', 'table'], ['dance', 'act', 'dance'], ['wave', 'act', 'wave'], ['read the astronomy book', 'read', null], ['read', 'read', null],
  ['go into the workshop', 'visit', null], ['come back', 'comeback', null], ['lock the door', 'doorlock', null], ['unlock the workshop door', 'doorlock', null],
  ['lock the screen', 'screen', null], ['unlock the screen', 'screen', null], ['lock the screen camera only', 'screen', null],
  ['tell GAL to play the guitar', 'gal', null], ['ask gal to jam', 'gal', null], ['jam', 'jam', null], ['I am bored', 'next', null], ['something else', 'next', null],
  ['learn everything', 'learn', null], ['use the workstation to learn piano', 'learn', null], ['tell GAL to learn all skills', 'gal', null], ['use the workstation', 'object', 'workstation'],
  ['mow the lawn', 'object', 'mower'], ['GUY, go and mow the grass please', 'object', 'mower'], ['use the shed', 'object', 'mower'], ['sit in the lawn chair', 'object', 'lawnchair'],
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
    // 2. GUY is free: he answers and does it himself
    b.unlock(false); b.queue = []; b.step = null; b.last = 'wander';
    const r1 = V.run('play the guitar');
    out.push(result('voice: GUY free: he answers and starts the activity himself', r1.ok && r1.lines.length === 1 && r1.lines[0].who === 'guy' && !!b.pendingActivity, { lines: L(r1), pending: b.pendingActivity }));
    const r2 = V.run('xyzzy');
    out.push(result('voice: an unknown sentence gets a polite "say it again" from GUY', !r2.ok && r2.lines.length === 1 && r2.lines[0].who === 'guy', { lines: L(r2) }));
    // 3. no GAL yet: GUY cannot hand anything over
    const r3 = V.run('tell GAL to play the guitar');
    out.push(result('voice: with no GAL he says so (and nothing breaks)', !r3.ok && /GAL/.test(L(r3)), { lines: L(r3) }));
    // 4. GAL arrives
    const gb = galBuild();
    if (!gb.ok) { out.push(result('voice: GAL could be built for the test', false, gb)); throw new Error('no GAL'); }
    const gal = w.gal, gbr = gal.brain;
    b.pendingActivity = null; b.skip(true); T.settle(); T.home();      // (the first command left GUY with the guitar)
    gbr.skills.learn('guitar'); gbr.skills.learn('piano');
    b.unlock(false); b.queue = []; b.step = null; b.last = 'wander'; b.pendingActivity = null; gbr.pendingActivity = null; gal.audience = null;
    // 4a. explicitly: GUY tells GAL
    const r4 = V.run('tell GAL to play the guitar');
    out.push(result('voice: "tell GAL ..." GUY says GAL will do it, GAL answers, she is sent to do it and gets an audience', r4.ok && r4.lines.length === 2 && r4.lines[0].who === 'guy' && r4.lines[1].who === 'gal' && !!gbr.pendingActivity && V.audienceOn(), { lines: L(r4), pending: gbr.pendingActivity }));
    out.push(result('voice: GUY himself did not start anything (GAL has it)', !b.pendingActivity, { pending: b.pendingActivity }));
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
    // 4e. when she moves on to something else the audience ends and the user talks to GUY again
    gbr.last = 'wander'; gbr.pendingActivity = null; gal.audience.fresh = 0; gal.audience.act = 'guitar';
    out.push(result('voice: the audience ends when her activity is over', V.audienceOn() === false && !gal.audience));
    const r6 = V.run('play the piano');
    out.push(result('voice: after that the user is talking to GUY again', r6.lines[0] && r6.lines[0].who === 'guy', { lines: L(r6) }));
    // 5. GUY busy: he hands it over by himself (first he puts down whatever he picked up on his own while the clock ran)
    b.skip(true); b.queue = []; b.step = null; T.settle(); T.home();
    gbr.skip(true); gbr.pendingActivity = null; b.pendingActivity = null; b.queue = []; b.step = null; b.last = 'wander'; gal.audience = null;
    b.lock = { name: 'ball' };
    const r7 = V.run('play the guitar');
    out.push(result('voice: GUY busy (locked in on the ball): he says GAL will get right on that, and she answers', r7.ok && r7.lines[0].who === 'guy' && /GAL will get right on that/.test(r7.lines[0].text) && r7.lines[1] && r7.lines[1].who === 'gal' && !!gbr.pendingActivity, { lines: L(r7), pending: gbr.pendingActivity }));
    b.lock = null; gal.audience = null; gbr.pendingActivity = null; gbr.skip(true);
    // 6. refusal comes back in words, from the one who was asked
    b.last = 'wander'; b.queue = []; b.step = null;
    const r8 = V.run('read the quantum chromodynamics book');
    out.push(result('voice: asked for something that cannot be done, GUY says why instead of doing nothing', !r8.ok && r8.lines.length >= 1 && r8.lines[0].text.length > 5, { lines: L(r8) }));
    // 7. the screen and the door by voice
    const r9 = V.run('lock the screen');
    const lockedNow = window.__screenLock.mode === 'on';
    V.run('unlock the screen');
    out.push(result('voice: "lock the screen" / "unlock the screen" set the screen lock', r9.ok && lockedNow && window.__screenLock.mode === 'off'));
    V.run('lock the door'); const dl = R().isDoorLocked('workshop'); V.run('unlock the door');
    out.push(result('voice: "lock the door" / "unlock the door" lock the one door', dl && !R().isDoorLocked('workshop')));
    // 8. jamming through voice: GUY asks GAL and she answers out loud, then plays along
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
    b.queue = []; b.step = null; b.choose('wave');
    out.push(result('voice: quiet (the default): starting an activity says nothing', V.tts.log.length === nb));
    V.tts.set('chatter', 'chatty'); resetBarks(); b.queue = []; b.step = null; b.choose('wave');
    const first = V.tts.log.slice(nb).filter((l) => l.kind === 'bark');
    b.queue = []; b.step = null; b.choose('wave');
    const second = V.tts.log.slice(nb).filter((l) => l.kind === 'bark');
    out.push(result('voice: chatty: GUY remarks as he starts something, but not twice within 25 s', first.length === 1 && first[0].who === 'guy' && BARKS.wave.includes(first[0].text) && second.length === 1, { first, second: second.length }));
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
    out.push(result('voice: GAL sounds higher than GUY', !!gy && !!gl && gl.zcr > gy.zcr * 1.1, { guy: gy && gy.zcr, gal: gl && gl.zcr }));
    out.push(result('voice: every robot has a voice, a colour and a subtitle name', ['guy', 'gal'].every((k) => VOICES[k] && VOICES[k].pitch && VOICES[k].color && VOICES[k].name)));
    const subs = document.getElementById('subs'); V.tts.say('gal', 'Subtitle check.'); await wait(100);
    out.push(result('voice: every line shows as a subtitle with the speaker named', !subs.hidden && /GAL/.test(subs.textContent) && /Subtitle check/.test(subs.textContent), { text: subs.textContent }));
    V.tts.stop();
    out.push(result('voice: natural voices are opt-out and never download during a QA run (fresh = offline eSpeak)', V.tts.settings.engine === 'natural' && V.tts.naturalStatus.state === 'idle' && V.tts.set('engine', 'robot') && V.tts.settings.engine === 'robot' && !V.tts.set('engine', 'nope')));
    V.tts.set('engine', 'natural');
  } catch (e) { out.push(result('voice: offline voices ran without throwing', false, { error: String(e && e.stack || e).slice(0, 400) })); }
  // 11. one voice per exchange: GAL must never answer in the robot voice and GUY reply in the natural one (the model used to be picked per line)
  try {
    const { initVoice } = await import('/src/tts.js');
    const { useAudio } = await import('/src/audio.js');
    const wav = () => {                                   // 20 ms of silence as a WAV
      const n = 441, b = new ArrayBuffer(44 + n * 2), d = new DataView(b), w = (o, t) => [...t].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
      d.setUint32(24, 22050, true); d.setUint32(28, 44100, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
      return b;
    };
    // a stand-in for tts-natural.js: ready after `after` ms; fails each line `fail` times first (Infinity: always)
    const fakeNatural = ({ after = 0, fail = 0 } = {}) => {
      const fns = new Set(), status = { state: 'downloading', progress: 0, error: '' }; let ok = false, p = null; const tries = new Map();
      const m = {
        status, onStatus: (fn) => { fns.add(fn); }, ready: () => ok, calls: 0,
        load: () => p || (p = new Promise((r) => setTimeout(() => { ok = true; status.state = 'ready'; fns.forEach((fn) => fn({ ...status })); r(true); }, after))),
        render: async (who, text) => { m.calls++; const k = who + text, t = (tries.get(k) || 0) + 1; tries.set(k, t); if (t <= fail) throw new Error('fake failure'); return wav(); },
      };
      return m;
    };
    const run = async (opts, lines, { pause = 0, more = [] } = {}) => {
      const done = [], robot = { calls: 0 }, ac = new OfflineAudioContext(1, 22050, 22050), restore = useAudio(ac, ac.destination);
      const was = window.__voiceNoAudio; window.__voiceNoAudio = false;
      try {
        const v = initVoice({ persist: false, gap: 300, wait: 3000, robot: async () => { robot.calls++; return wav(); }, onSpeakEnd: (l) => done.push(l), ...opts });
        lines.forEach(([who, text]) => v.say(who, text));
        const until = async (n) => { for (let t = 0; t < 200 && done.length < n; t++) await wait(50); };
        await until(lines.length);
        if (more.length) { await wait(pause); more.forEach(([who, text]) => v.say(who, text)); await until(lines.length + more.length); }
        v.stop();
        return { lines: done.map((l) => ({ who: l.who, engine: l.engine, played: l.played, why: l.why })), robot: robot.calls };
      } finally { restore(); window.__voiceNoAudio = was; }
    };
    const talk = [['gal', 'GUY, can you hand me that?'], ['guy', 'Sure, here you go.'], ['gal', 'Thanks.']];
    const same = (r) => r.lines.length && r.lines.every((l) => l.engine === r.lines[0].engine);
    let fake = fakeNatural({ after: 150 });
    const first = await run({ natural: () => Promise.resolve(fake), cached: () => false }, talk, { pause: 700, more: [['guy', 'Next time.']] });
    out.push(result('voice: first download: a whole exchange keeps one voice while the natural voices load (no robot GAL then natural GUY)', same({ lines: first.lines.slice(0, 3) }) && first.lines[0].engine === 'robot' && /downloading/.test(first.lines[0].why || ''), first));
    out.push(result('voice: first download: once they have loaded, the next exchange is natural', first.lines[3] && first.lines[3].engine === 'natural', first));
    fake = fakeNatural({ after: 400 });
    const cachedRun = await run({ natural: () => Promise.resolve(fake), cached: () => true }, talk);
    out.push(result('voice: downloaded before: lines wait for the natural voices instead of speaking robot meanwhile', cachedRun.lines.length === 3 && cachedRun.lines.every((l) => l.engine === 'natural' && l.played) && cachedRun.robot === 0, cachedRun));
    fake = fakeNatural({ fail: 1 });
    const flaky = await run({ natural: () => Promise.resolve(fake), cached: () => true }, talk);
    out.push(result('voice: a natural line that fails once is tried again and still spoken naturally', flaky.lines.every((l) => l.engine === 'natural' && l.played) && flaky.robot === 0 && fake.calls === 6, { ...flaky, calls: fake.calls }));
    fake = fakeNatural({ fail: Infinity });
    const broken = await run({ natural: () => Promise.resolve(fake), cached: () => true }, talk.slice(0, 2));
    out.push(result('voice: a natural line that keeps failing is a subtitle only, never the robot voice, and says why', broken.lines.every((l) => l.engine === 'natural' && !l.played && /failed on this line/.test(l.why || '')) && broken.robot === 0, broken));
    fake = fakeNatural({ after: 0 }); fake.load = () => Promise.reject(new Error('offline')); fake.status.state = 'failed'; fake.status.error = 'offline';
    const failed = await run({ natural: () => Promise.resolve(fake), cached: () => true }, talk);
    out.push(result('voice: natural voices that failed to load: both robots use the robot voice, with the reason', same(failed) && failed.lines[0].engine === 'robot' && /failed to load: offline/.test(failed.lines[0].why || '') && failed.robot === 3, failed));
  } catch (e) { out.push(result('voice: one voice per exchange ran without throwing', false, { error: String(e && e.stack || e).slice(0, 400) })); }
  out.push(result('voice: no errors', errors.length === base, { errors: errors.slice(base) }));
  return out;
};
// the sweeps that need real time (models load, pictures are taken): `await T.runAsync()`
installCharacters(T, { result, summarise });
installAudio(T, { result, summarise });
installShots(T, { result, summarise });
T.runAsync = async (which = ['sweepRigs', 'sweepCustomers', 'sweepAudio', 'sweepGuitarSongs', 'sweepScreenLock', 'sweepViews', 'sweepVoice']) => {
  const report = {};
  for (const k of which) { report[k.replace(/^sweep/, '').toLowerCase()] = summarise(await T[k]()); T.resetRooms(); }
  return report;
};
window.guyTest = T;
