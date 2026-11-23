// The Catalog's catalog: what can go in the room, and which books can go on the shelf.
//
// Objects come in four states:
//   inroom    already here
//   removed   was taken out by the user; can be put back
//   available free to add
//   locked    a future premium unlock (shown, but the button does nothing yet)
// Books: shelf (on the shelf), available, needs-shelf (can't be added yet), locked. (A book never needs the object it is about.)
import { BOOK_CATALOG } from './skills.js';
import { ALBUM_CATALOG } from './albums.js';
import { dev } from './devunlock.js';

// cat: the category the Objects tab files it under (see OBJECT_CATEGORIES). decor: not furniture GUY uses; the rug, the windows
// and the picture live in world.decor and can be removed and put back like everything else.
export const OBJECT_CATEGORIES = [
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'hobbies', name: 'Hobbies', icon: '🎨' },
  { id: 'workshop', name: 'Workshop', icon: '🛠️' },
  { id: 'built', name: 'Built by GUY', icon: '🔨' },             // what GUY made in the Workshop: in the room, or waiting in storage
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️' },
  { id: 'backyard', name: 'Backyard', icon: '🌳' },
  { id: 'robots', name: 'Robots', icon: '🤖' },
  { id: 'furniture', name: 'Furniture', icon: '🛋️' },
  { id: 'decor', name: 'Decor & lighting', icon: '🖼️' },
  { id: 'games', name: 'Games', icon: '⚽' },
];

// The order of the sub-headings inside a category that uses them (Decor & lighting has a lot of things in it).
export const DECOR_SUBS = ['Sports', 'Garden', 'Premium', 'Plants', 'Wall art', 'Windows', 'Rugs', 'Lighting', 'Small furniture', 'Workbench & storage', 'Woodwork', 'Metalwork', 'Kitchen', 'Dining'];

export const OBJECT_CATALOG = [
  { id: 'piano', cat: 'music', name: 'Upright Piano', icon: '🎹', desc: 'Scales, tunes and jam sessions. Heavy: only you can move it.', core: true },
  { id: 'bench', cat: 'music', name: 'Piano Bench', icon: '🪑', desc: 'GUY pulls this up to the piano.', core: true },
  { id: 'table', cat: 'music', name: 'Stereo & Table', icon: '📻', desc: 'The boombox and the table it sits on.', core: true },
  { id: 'shelf', cat: 'furniture', name: 'Bookshelf', icon: '📚', desc: 'Where the books live. Heavy: only you can move it.', core: true },
  { id: 'lamp', cat: 'decor', sub: 'Lighting', name: 'Floor Lamp', icon: '💡', desc: 'On and off, plus moods and light shows with the right book.', core: true },
  { id: 'armchair', cat: 'furniture', name: 'Armchair', icon: '🛋️', desc: 'A comfortable place to read.', core: true },
  { id: 'armchair2', cat: 'furniture', name: 'Second Armchair', icon: '🛋️', desc: 'A burgundy armchair. GUY picks whichever chair he likes to read in or play in.', free: true },
  { id: 'chair', cat: 'furniture', name: 'Wooden Chair', icon: '🪑', desc: 'A plain chair: for reading, resting, or playing the guitar sitting down. Listed once GUY or GAL has read "Furniture for Robots".', free: true, needsSkill: 'workshop.furniture' },
  { id: 'chair2', cat: 'furniture', name: 'Second Wooden Chair', icon: '🪑', desc: 'Another plain chair. Listed once GUY or GAL has read "Furniture for Robots".', free: true, needsSkill: 'workshop.furniture' },
  { id: 'plant', cat: 'decor', sub: 'Plants', name: 'Potted Plant', icon: '🪴', desc: 'Makes the room feel lived in.', core: true },
  { id: 'ball', cat: 'games', name: 'Red Ball', icon: '⚽', desc: 'Kick it, dribble it, toss it.', core: true, ball: true },
  { id: 'rug', cat: 'decor', sub: 'Rugs', name: 'Round Rug', icon: '🟥', desc: 'A soft rug for the middle of the floor. Hold on it, then drag to move it.', core: true, decor: true },
  { id: 'picture', cat: 'decor', sub: 'Wall art', name: 'Wall Picture', icon: '🖼️', desc: 'A sunset in a frame on the back wall. Drag it along the wall.', core: true, decor: true },
  { id: 'window', cat: 'decor', sub: 'Windows', name: 'Window', icon: '🪟', desc: 'Lets the daylight in. Drag it along the left wall.', core: true, decor: true },
  { id: 'window2', cat: 'decor', sub: 'Windows', name: 'Second Window', icon: '🪟', desc: 'Another window, for the back wall. Drag it along the wall.', free: true, decor: true },
  { id: 'flowerplant', cat: 'decor', sub: 'Plants', name: 'Flowering Plant', icon: '🌸', desc: 'A pot of pink, yellow and white blooms. GUY tends it like the other plants.', free: true },
  { id: 'tree', cat: 'decor', sub: 'Plants', name: 'Indoor Tree', icon: '🌳', desc: 'Tall and leafy in a big planter. Heavy: only you can move it.', free: true },
  { id: 'art_mountains', cat: 'decor', sub: 'Wall art', name: 'Mountain Picture', icon: '🏔️', desc: 'Hills at dusk over a still lake. Hangs on the left wall; drag it along.', free: true, decor: true },
  { id: 'art_abstract', cat: 'decor', sub: 'Wall art', name: 'Abstract Picture', icon: '🔶', desc: 'Bold blocks of colour in a pale frame. Hangs on the back wall.', free: true, decor: true },
  { id: 'art_moon', cat: 'decor', sub: 'Wall art', name: 'Moon Picture', icon: '🌙', desc: 'A big moon over a quiet hill. Hangs on the left wall.', free: true, decor: true },
  { id: 'rug2', cat: 'decor', sub: 'Rugs', name: 'Blue Woven Rug', icon: '🟦', desc: 'A rectangular rug with a cream border and a diamond. Hold on it, then drag to move; long-press to turn it.', free: true, decor: true },
  { id: 'rug3', cat: 'decor', sub: 'Rugs', name: 'Striped Runner', icon: '🟩', desc: 'A long green and cream runner. Hold on it, then drag to move; long-press to turn it.', free: true, decor: true },
  { id: 'sconce', cat: 'decor', sub: 'Lighting', name: 'Wall Light', icon: '🏮', desc: 'A brass wall light that glows when the room lights are on. Drag it along the wall.', free: true, decor: true },
  { id: 'coffeetable', cat: 'decor', sub: 'Small furniture', name: 'Coffee Table', icon: '☕', desc: 'A low walnut table with two books and a cup.', free: true },
  { id: 'nightstand', cat: 'decor', sub: 'Small furniture', name: 'Nightstand', icon: '🗄️', desc: 'A little cabinet with a drawer and a clock on top.', free: true },
  { id: 'guitar', cat: 'music', name: 'Acoustic Guitar', icon: '🎸', desc: 'On its stand. Comes with the book "Guitar for Beginners".', free: true, book: 'guitar' },
  // The Workshop (a room added from the Rooms tab): these are listed only while that room is added. See src/workobjects.js.
  { id: 'workbench', cat: 'workshop', sub: 'Workbench & storage', name: 'Workbench', icon: '🛠️', desc: 'A sturdy wooden work table with a pegboard. GUY goes to it when the house needs something built. Heavy: only you can move it. Comes with the book "Workshop Basics".', free: true, room: 'workshop', book: 'workshop' },
  { id: 'toolbox', cat: 'workshop', sub: 'Workbench & storage', name: 'Toolbox', icon: '🧰', desc: 'A red toolbox. GUY tidies the tools in it.', free: true, room: 'workshop' },
  { id: 'woodfactory', cat: 'workshop', sub: 'Woodwork', name: 'Wood Factory', icon: '🏭', desc: 'A machine that builds wooden things all by itself: GUY presses the button and takes what comes out. Heavy: only you can move it. Comes with the book "Wood & Metal Basics".', free: true, room: 'workshop', book: 'woodmetal' },
  { id: 'metalfactory', cat: 'workshop', sub: 'Metalwork', name: 'Metal Factory', icon: '🏭', desc: 'A machine that builds metal things all by itself: GUY presses the button and takes what comes out. Heavy: only you can move it. Comes with the book "Metal Fabrication for Robots".', free: true, room: 'workshop', book: 'metalfab' },
  // Things GUY builds there (once he has read the right book), in their own category, Built by GUY. They wait in storage; add them to
  // the room from here, one at a time. Ones he has never made are folded away under "more GUY can build".
  { id: 'footstool', cat: 'built', name: 'Wooden Foot Stool', icon: '🪜', desc: 'A little wooden foot stool, built by GUY.', built: true, room: 'workshop' },
  { id: 'woodshelves', cat: 'built', name: 'Wooden Shelves', icon: '🗄️', desc: 'A set of wooden shelves, built by GUY.', built: true, room: 'workshop' },
  { id: 'builtchair', cat: 'built', name: 'Wooden Chair (built by GUY)', icon: '🪑', desc: 'A wooden chair that GUY made himself. He can sit on it.', built: true, room: 'workshop' },
  { id: 'diningtable3', cat: 'built', name: 'Wooden Dining Table (built by GUY)', icon: '🍽️', desc: 'A table for two with two chairs, built when the restaurant was full. It goes in the Restaurant and customers sit at it.', built: true, room: 'workshop' },
  { id: 'diningtable4', cat: 'built', name: 'Metal Dining Table (built by GUY)', icon: '🍽️', desc: 'A welded metal table for two with two chairs. It goes in the Restaurant and customers sit at it.', built: true, room: 'workshop' },
  { id: 'eguitar', cat: 'built', name: 'Electric Guitar (built by GUY)', icon: '🎸', desc: 'A red electric guitar on its own stand, built from wood and metal. GUY and GAL can both play along with a guitar each.', built: true, room: 'workshop' },
  { id: 'mirrorball', cat: 'built', name: 'Mirror Ball (built by GUY)', icon: '🪩', desc: 'A mirror ball on a stand. It turns slowly all by itself.', built: true, room: 'workshop' },
  { id: 'trophy', cat: 'built', name: 'Golden Trophy (built by GUY)', icon: '🏆', desc: 'A golden trophy with a little spinning star.', built: true, room: 'workshop' },
  { id: 'lavalamp', cat: 'built', name: 'Lava Lamp (built by GUY)', icon: '🫧', desc: 'A pink lava lamp with blobs that drift up and down.', built: true, room: 'workshop' },
  { id: 'crystalball', cat: 'built', name: 'Crystal Ball (built by GUY)', icon: '🔮', desc: 'A glowing crystal ball. Something swirls inside.', built: true, room: 'workshop' },
  { id: 'rubberduck', cat: 'built', name: 'Rubber Duck (built by GUY)', icon: '🦆', desc: 'A yellow rubber duck that bobs about.', built: true, room: 'workshop' },
  { id: 'gnome', cat: 'built', name: 'Garden Gnome (built by GUY)', icon: '🧙', desc: 'A garden gnome in a red hat, swaying gently.', built: true, room: 'workshop' },
  { id: 'toyrocket', cat: 'built', name: 'Toy Rocket (built by GUY)', icon: '🚀', desc: 'A toy rocket on a launch pad. It hums and hops.', built: true, room: 'workshop' },
  { id: 'arcade', cat: 'built', name: 'Arcade Cabinet (built by GUY)', icon: '🕹️', desc: 'A little arcade cabinet with a screen that changes colour.', built: true, room: 'workshop' },
  { id: 'piggybank', cat: 'built', name: 'Piggy Bank (built by GUY)', icon: '🐷', desc: 'A pink piggy bank with a coin that keeps dropping in.', built: true, room: 'workshop' },
  { id: 'grandfatherclock', cat: 'built', name: 'Grandfather Clock (built by GUY)', icon: '🕰️', desc: 'A tall wooden clock with a swinging pendulum. Heavy: only you can move it.', built: true, room: 'workshop' },
  { id: 'bubblemachine', cat: 'built', name: 'Bubble Machine (built by GUY)', icon: '🫧', desc: 'A bubble machine that puffs bubbles up into the air.', built: true, room: 'workshop' },
  { id: 'snowglobe', cat: 'built', name: 'Snow Globe (built by GUY)', icon: '❄️', desc: 'A snow globe with a tiny tree. It is always snowing inside.', built: true, room: 'workshop' },
  { id: 'petrock', cat: 'built', name: 'Pet Rock (built by GUY)', icon: '🪨', desc: 'A pet rock with googly eyes. It is watching you.', built: true, room: 'workshop' },
  { id: 'bookshelf2', cat: 'built', name: 'Bookshelf (built by GUY)', icon: '📚', desc: 'A copy of the skill bookshelf, built when books were piling up on the floor. The books and records that did not fit move onto it; long-press it for their lists and GUY reads from it like the first one. Heavy: only you can move it.', built: true, room: 'workshop' },
  { id: 'metalchair', cat: 'built', name: 'Metal Chair (built by GUY)', icon: '🪑', desc: 'A welded metal chair. GUY can sit on it.', built: true, room: 'workshop' },
  { id: 'bowlingpins', cat: 'built', name: 'Maple Bowling Pins (built by GUY)', icon: '🎳', desc: 'A crate of ten turned maple pins. GUY or GAL carries it to a lane of the Bowling Alley and swaps the old pins for them.', built: true, room: 'workshop' },
  { id: 'bowlingball', cat: 'built', name: 'Wooden Bowling Ball (built by GUY)', icon: '🎳', desc: 'A wooden bowling ball on a stand. A wooden ball joins the alley rack.', built: true, room: 'workshop' },
  { id: 'bed', cat: 'built', name: 'Bed (built by GUY)', icon: '🛏️', desc: 'A wooden bed with two pillows and a blanket, built for the Bedroom. GUY and GAL sit on the foot of it and make it. Heavy: only you can move it.', built: true, room: 'workshop' },
  { id: 'wardrobe', cat: 'built', name: 'Wardrobe (built by GUY)', icon: '🚪', desc: 'A wardrobe with two doors, built for the Bedroom. GUY opens it and sorts the clothes. Heavy: only you can move it.', built: true, room: 'workshop' },
  { id: 'bedside', cat: 'built', name: 'Bedside Table (built by GUY)', icon: '🗄️', desc: 'A little table with a lamp, a clock and a drawer, built for the Bedroom. GUY pulls the drawer out and tidies it.', built: true, room: 'workshop' },
  { id: 'libshelf', cat: 'built', name: 'Library Bookshelf (built by GUY)', icon: '📚', desc: 'A tall shelf of books for the Library. GUY browses along it. (It is not the skill bookshelf.) Heavy: only you can move it.', built: true, room: 'workshop' },
  { id: 'readingchair', cat: 'built', name: 'Reading Chair (built by GUY)', icon: '🛋️', desc: 'A green armchair for the Library. GUY sits in it for a rest.', built: true, room: 'workshop' },
  { id: 'libdesk', cat: 'built', name: 'Reading Desk (built by GUY)', icon: '🪔', desc: 'A writing desk for the Library with a green banker lamp and an open book. GUY switches the lamp on and reads a few pages. Heavy: only you can move it.', built: true, room: 'workshop' },
  { id: 'globe', cat: 'built', name: 'Globe (built by GUY)', icon: '🌐', desc: 'A globe on a wooden stand for the Library. GUY gives it a spin and looks for places.', built: true, room: 'workshop' },
  { id: 'pinsetter', cat: 'built', name: 'Automatic Pinsetter (built by GUY)', icon: '🤖', desc: 'Three pinsetters over the ends of the lanes: sweeps the fallen pins away and sets all ten again. Heavy: only you can move it.', built: true, room: 'workshop' },
  // The Restaurant (a room added from the Rooms tab). Customers arrive by its elevator. See src/restobjects.js and src/customers.js.
  { id: 'stove', cat: 'restaurant', sub: 'Kitchen', name: 'Stove', icon: '🍲', desc: 'A big stove with a pot. GUY cooks the orders here. Heavy: only you can move it. Comes with the book "Restaurant Basics".', free: true, room: 'restaurant', book: 'restaurant' },
  { id: 'kitchencounter', cat: 'restaurant', sub: 'Kitchen', name: 'Kitchen Counter', icon: '🧊', desc: 'A counter with a fridge, where the cooked plates wait to be served. Heavy: only you can move it.', free: true, room: 'restaurant' },
  { id: 'register', cat: 'restaurant', sub: 'Dining', name: 'Cash Register', icon: '💵', desc: 'Where customers pay when they have finished. Ding!', free: true, room: 'restaurant' },
  { id: 'diningtable', cat: 'restaurant', sub: 'Dining', name: 'Dining Table', icon: '🍽️', desc: 'A table for two with two chairs. Customers sit here to eat.', free: true, room: 'restaurant' },
  { id: 'diningtable2', cat: 'restaurant', sub: 'Dining', name: 'Second Dining Table', icon: '🍽️', desc: 'Another table for two, so more customers can eat at once.', free: true, room: 'restaurant' },
  // The Backyard (a room added from the Rooms tab): an outdoor room. See src/yardobjects.js and src/yardbrain.js.
  // The goal and the hoop each bring a ball; their books ("Soccer for Robots", "Basketball for Robots") can go on the shelf once GUY or GAL has read "Outdoor Sports".
  { id: 'soccergoal', cat: 'backyard', sub: 'Sports', name: 'Soccer Goal', icon: '🥅', desc: 'A goal with a net, and a soccer ball to kick at it. Heavy: only you can move it. Its book, "Soccer for Robots", adds goal shots and more once "Outdoor Sports" has been read.', free: true, room: 'backyard' },
  { id: 'basketballhoop', cat: 'backyard', sub: 'Sports', name: 'Basketball Hoop', icon: '🏀', desc: 'A hoop on a pole, and a basketball. Heavy: only you can move it. Its book, "Basketball for Robots", adds shooting at the hoop and more once "Outdoor Sports" has been read.', free: true, room: 'backyard' },
  { id: 'lawnchair', cat: 'backyard', sub: 'Garden', name: 'Lawn Chair', icon: '🪑', desc: 'A striped folding chair for sitting in the sun, or under the moon. Comes with the book "Outdoor Sports".', free: true, room: 'backyard', book: 'outdoor' },
  { id: 'birdbath', cat: 'backyard', sub: 'Garden', name: 'Bird Bath', icon: '🐦', desc: 'A stone basin of water. GUY stops to look and dip a finger in.', free: true, room: 'backyard' },
  { id: 'skyswitch', cat: 'backyard', sub: 'Garden', name: 'Sun & Moon Switch', icon: '🌗', desc: 'A post with a lever that switches the yard between its artificial sun and its artificial moon. GUY and GAL use it too, and you can ask GUY to flip it (long-press it).', free: true, room: 'backyard' },
  { id: 'shed', cat: 'backyard', sub: 'Premium', name: 'Garden Shed', icon: '🛖', desc: 'A little wooden shed that works like the skill bookshelf: the yard\'s things (goal, hoop, balls, chair, bird bath, mower) are kept in it. GUY puts them all away before mowing and takes out what he needs. Long-press it for what is inside. Heavy: only you can move it. Unlocks the push lawn mower.', free: true, locked: true, room: 'backyard' },
  { id: 'mower', cat: 'backyard', sub: 'Premium', name: 'Push Lawn Mower', icon: '🚜', desc: 'GUY gets the shed open and pushes the mower round the lawn, leaving stripes. Listed once the shed is in the yard.', free: true, locked: true, room: 'backyard', needsObject: 'shed' },
  // Build a Bot: a super premium one-use printer. GUY uses it and it folds itself into GAL (src/gal.js).
  { id: 'botprinter', cat: 'robots', name: 'Build a Bot Machine', icon: '🤖', desc: 'A 3D printer that can be used once: it prints a second robot, GAL, and folds itself away into her. Heavy: only you can move it.', locked: true },
  // Learning Workstation: premium. GUY taps the screen and a panel lists the books on the shelf; Learn teaches him at once, no reading. The book stays on the shelf.
  { id: 'workstation', cat: 'robots', name: 'Learning Workstation', icon: '🖥️', desc: 'A desk and screen that lists every book on the shelf. Press Learn and GUY knows what is in it at once, with no reading. The book stays on the shelf so GAL can read it too. Heavy: only you can move it.', locked: true },
  // The Studio's instruments (src/instruments.js): listed only while the Studio is added. GUY and GAL play them on the stage.
  { id: 'bass', cat: 'music', name: 'Electric Bass', icon: '🎸', desc: 'A bass on its stand with a little amp. Plucked and fretted.', free: true, room: 'studio' },
  { id: 'keyboard', cat: 'music', name: 'Electric Keyboard', icon: '🎹', desc: 'Two octaves on an X stand, with a synth sound.', free: true, room: 'studio' },
  { id: 'xylophone', cat: 'music', name: 'Xylophone', icon: '🎶', desc: 'Twelve coloured bars played with mallets.', free: true, room: 'studio' },
  { id: 'bongos', cat: 'music', name: 'Bongos', icon: '🪘', desc: 'A pair of bongo drums, slapped by hand.', free: true, room: 'studio' },
  { id: 'drums', cat: 'music', name: 'Drum Kit', icon: '🥁', desc: 'Kick, snare, hi-hat and cymbals on a stool. Comes with the book "Drumming for Robots".', free: true, book: 'drumming' },
  { id: 'easel', cat: 'hobbies', name: 'Painting Easel', icon: '🎨', desc: 'A canvas that really gets painted. Comes with the book "Painting for Robots".', free: true, book: 'painting' },
  { id: 'telescope', cat: 'hobbies', name: 'Telescope', icon: '🔭', desc: 'On a tripod by the window. Comes with the book "Stargazing for Robots".', free: true, book: 'stars' },
];

const KEY = 'guy.room.v1';

export function initMachine({ world, guy, persist, notify, remove, rooms, paintings, knows = () => true, onOpen = () => {} }) {
  const root = document.getElementById('machine');
  const body = root.querySelector('.body');
  const chipBar = root.querySelector('.chips');
  let tab = 'objects';
  let cat = 'all';                   // the category filter on the Objects tab
  let scope = null;                  // 'studio': the Studio Machine, which lists only what goes in the Studio (see renderScoped)

  const inRoom = (id) => (id === 'ball' ? !world.ballGone : !!(world.objects[id] || world.decor[id]));
  const builtCount = (id) => Object.values(world.objects).filter((o) => o.kind === id).length;      // built things in the room
  const stored = (id) => (world.stock && world.stock.items && world.stock.items[id]) || 0;            // built things waiting in storage
  const objectStatus = (d) => {
    if (d.built) return 'built';
    if (d.id === 'botprinter' && world.gal && world.gal.exists()) return 'used';       // it was used up making GAL
    if (d.locked && !dev.all) return 'locked';
    if (d.ball) return world.ballGone ? 'removed' : 'inroom';
    if (inRoom(d.id)) return 'inroom';
    if (world.removed[d.id]) return 'removed';
    return 'available';
  };
  const hasObject = inRoom;
  // things that belong to a room the user has not added (or that is not unlocked) are not listed at all
  // (and a thing that needs a skill is not listed until GUY or GAL has it, unless it is already in the room or was taken out of it)
  const live = (d) => (!d.room || (!!rooms && rooms.isLive(d.room))) && (!d.needsObject || inRoom(d.needsObject) || inRoom(d.id) || !!world.removed[d.id]) && (!d.needsSkill || dev.all || knows(d.needsSkill) || inRoom(d.id) || !!world.removed[d.id]);
  const shelf = () => world.objects.shelf;
  const albumStatus = (a) => {
    if (a.premium && !dev.all) return 'locked';
    if (shelf() && shelf().albums.some((r) => r.def.id === a.id)) return 'shelf';
    if (!shelf()) return 'needs-shelf';
    if (!hasObject('table')) return 'needs-object';          // the records are for the stereo
    return 'available';
  };
  const bookStatus = (b) => {
    if (b.locked && !dev.all) return 'locked';
    if (shelf() && shelf().books.some((r) => r.def.id === b.id)) return 'shelf';
    if (b.unlockedBy && !dev.all && !knows(b.unlockedBy)) return 'needs-skill';
    if (!shelf()) return 'needs-shelf';
    // (a book can be read before the object it is about is in the room: GUY learns it and uses the object when it arrives)
    return 'available';
  };

  const save = () => {
    if (!persist) return;
    const extras = { objects: OBJECT_CATALOG.filter((d) => d.free && inRoom(d.id)).map((d) => d.id),
      books: shelf() ? shelf().books.filter((r) => !r.def.start).map((r) => r.def.id) : [],
      albums: shelf() ? shelf().albums.map((r) => r.def.id) : [],
      forgotten: shelf() ? BOOK_CATALOG.filter((b) => b.start && !shelf().books.some((r) => r.def.id === b.id)).map((b) => b.id) : [] };   // starting books he forgot
    try { localStorage.setItem(KEY, JSON.stringify(extras)); } catch { /* no storage */ }
  };
  const addBookDef = (def) => {
    if (!shelf() || shelf().books.some((r) => r.def.id === def.id)) return false;
    shelf().addBook(def);
    return true;
  };
  const avoid = () => ({ x: guy.pos.x, z: guy.pos.z });

  const addAlbumDef = (def) => {
    if (!shelf() || shelf().albums.some((r) => r.def.id === def.id)) return false;
    shelf().addAlbum(def);
    return true;
  };
  // things the user added in an earlier visit
  function restoreExtras() {
    if (!persist) return;
    let extras;
    try { extras = JSON.parse(localStorage.getItem(KEY)); } catch { extras = null; }
    if (!extras) return;
    for (const id of extras.objects || []) world.addNew(id, null);
    for (const id of extras.forgotten || []) { const rec = shelf() && shelf().books.find((r) => r.def.id === id); if (rec) shelf().removeBook(rec); }
    for (const id of extras.books || []) { const def = BOOK_CATALOG.find((b) => b.id === id); if (def) addBookDef(def); }
    for (const id of extras.albums || []) { const def = ALBUM_CATALOG.find((a) => a.id === id); if (def && (!def.premium || dev.all)) addAlbumDef(def); }
  }

  function addObject(d, where = null) {
    const st = objectStatus(d);
    let ok = false;
    if (st === 'removed') ok = d.ball ? world.restoreBall(avoid()) : world.restoreObject(d.id, avoid(), where);
    else if (st === 'available') {
      ok = world.addNew(d.id, avoid(), where);
      if (ok && d.book) { const def = BOOK_CATALOG.find((b) => b.id === d.book); if (def) addBookDef(def); }
      // any instrument also brings "Playing in the Band"
      if (ok && d.cat === 'music' && ['piano', 'guitar', 'drums'].includes(d.id)) { const def = BOOK_CATALOG.find((b) => b.id === 'drumband'); if (def) addBookDef(def); }
    }
    notify(ok ? `Added ${d.name}${st === 'available' && d.book ? ' and its book' : ''}` : `No room for ${d.name} right now`);
    save();
    render();
    return ok;
  }

  function addBuilt(d, where = null) {
    const name = world.addInstance(d.id, avoid(), null, false, where);
    notify(name ? `Added a ${d.name} from storage` : stored(d.id) ? `No room for a ${d.name} right now` : `There is no ${d.name} in storage yet`);
    save();
    render();
    return !!name;
  }

  function removeObject(d) {
    if (!inRoom(d.id)) return false;
    remove(d.id);
    notify(`Took the ${d.name} out of the room`);
    save();
    render();
    return true;
  }

  // What the robots do at the Learning Workstation (arrange.js): the same adding and removing as the Catalog, by object id. `where` is
  // { x, z }, a spot in the room they chose. A built thing (a chair GUY made) comes out of storage; anything else out of the catalog.
  const byId = (id) => OBJECT_CATALOG.find((d) => d.id === id);
  const ops = {
    byId,
    // 'inroom' | 'removed' | 'available' | 'stored' (built, waiting in storage) | 'locked' | 'unlisted' (a room or skill it needs is missing) | 'unknown'
    status(id) {
      const d = byId(id);
      if (!d) return 'unknown';
      if (d.built) return stored(id) ? 'stored' : builtCount(id) ? 'inroom' : 'unlisted';
      if (!live(d)) return inRoom(id) ? 'inroom' : 'unlisted';
      return objectStatus(d);
    },
    add(id, where = null) {
      const d = byId(id), st = d && ops.status(id);
      return !d ? false : d.built ? addBuilt(d, where) : st === 'removed' || st === 'available' ? addObject(d, where) : false;
    },
    // takes one away: the thing itself, or (for something GUY built) the first one standing in a room, which goes back into storage
    // (`name`: which one of the things GUY built, when there are several)
    remove(id, name = null) {
      const d = byId(id);
      if (!d) return false;
      if (!d.built) return removeObject(d);
      const o = Object.values(world.objects).find((x) => x.kind === id && (!name || x.name === name)) || Object.values(world.objects).find((x) => x.kind === id);
      if (!o) return false;
      remove(o.name);
      notify(`Put the ${d.name} back in storage`);
      return true;
    },
  };

  // Add a room. When something would have to come out of GUY's room for its door (the Restaurant asks first: rooms.js offerFor), its card
  // says what and asks: "Remove and add" puts the door there, "Not now" leaves everything as it is.
  let roomOffer = null;
  function addRoom(r) {
    const res = rooms.add(r.id, { ask: true });
    roomOffer = res.offer ? { ...res.offer, text: res.messages.join(' ') } : null;
    notify(res.messages.join(' '));
    render();
  }
  function acceptRoomOffer(r) {
    const offer = roomOffer && roomOffer.id === r.id ? roomOffer : null;
    roomOffer = null;
    if (!offer) { render(); return; }
    const res = rooms.add(r.id, { clear: offer });
    roomOffer = res.offer ? { ...res.offer, text: res.messages.join(' ') } : null;     // (something else stands there now: it asks again)
    notify(res.messages.join(' '));
    save();
    render();
  }
  function declineRoomOffer() { roomOffer = null; notify('Nothing was moved.'); render(); }

  // Take a room away (tapped twice: the first tap asks). Its furniture comes back to the Catalog; a robot in it walks out first.
  let confirmRoom = null;
  function removeRoom(r) {
    if (confirmRoom !== r.id) { confirmRoom = r.id; render(); return; }
    confirmRoom = null;
    const res = rooms.remove(r.id);
    notify(res.messages.join(' '));
    save();
    render();
  }

  function addAlbum(a) {
    const ok = addAlbumDef(a);
    notify(ok ? `"${a.title}" is on the top shelf` : 'Could not add the record');
    save();
    render();
  }

  function addBook(b) {
    const ok = addBookDef(b);
    notify(ok ? `"${b.title}" is on the shelf` : 'Could not add the book');
    save();
    render();
  }

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- the panel: tabs, a search box, a "show" filter, the category chips and the list -----------------------------------------
  // It looks and behaves like Help and the Skills menu: a dialog with a big ✕, tabs, a bottom sheet on a phone, Escape closes it, and
  // C opens and closes it. The list is a grid of compact cards (the description is cut to two lines; tap a card for all of it), in
  // sections you can fold away. Search looks through every tab at once (each tab says how many it found); "In the room" and
  // "To add" leave out the rest. Every card is still in the page when its section is folded (only hidden), so the counts stay right.
  const TAB_NAMES = { objects: 'Objects', books: 'Books', records: 'Records', rooms: 'Rooms' };
  const SHOW_NAMES = {                                                     // the "show" filter's two buttons, in each tab's own words
    objects: ['In the room', 'To add'], books: ['On the shelf', 'To add'], records: ['On the shelf', 'To add'], rooms: ['In your home', 'To add'],
  };
  const head = root.querySelector('header h3'), sub = root.querySelector('.sub'), tools = root.querySelector('.tools');
  const search = root.querySelector('.search'), showBar = root.querySelector('.show'), foot = root.querySelector('.foot');
  let query = '';                     // what is typed in the search box
  let show = 'all';                   // 'all' | 'here' (in the room, on the shelf, in your home) | 'add' (can be added or put back)
  let handlers = [];                  // this render's buttons: data-action="i" runs handlers[i]
  const opened = new Set();           // cards tapped open (by title) and folded lists shown, kept when the list is drawn again (a toast redraws it)
  const CLOSED_KEY = 'guy.catalog.closed.v1';                             // the sections folded away (a convenience: saved, unless ?fresh)
  let closed = new Set();
  if (persist) { try { closed = new Set(JSON.parse(localStorage.getItem(CLOSED_KEY)) || []); } catch { closed = new Set(); } }
  const saveClosed = () => { if (persist) { try { localStorage.setItem(CLOSED_KEY, JSON.stringify([...closed])); } catch { /* no storage */ } } };

  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const terms = () => norm(query).split(/\s+/).filter(Boolean);
  // every word typed must be somewhere in the card (its name, description, category); "chairs" finds "chair" too
  const hit = (hay, ts) => ts.every((t) => hay.includes(t) || (t.length > 3 && t.endsWith('s') && hay.includes(t.slice(0, -1))));

  let confirmDestroy = null;                                              // the painting whose Destroy button was tapped once
  function card({ icon, name, desc, status, label, action, note, danger, extra }) {
    const btn = action !== undefined
      ? `<button type="button" class="act${danger ? ' rm' : ''}" data-action="${action}">${label}</button>`
      : `<span class="badge ${status}">${label}</span>`;
    const btn2 = extra ? `<button type="button" class="act rm" data-action="${extra.action}">${extra.label}</button>` : '';
    return `<div class="card ${status}${opened.has(name) ? ' open' : ''}"><div class="icon">${icon}</div>
      <div class="info"><div class="title">${esc(name)}</div>${desc ? `<div class="desc" title="${esc(desc)}">${esc(desc)}</div>` : ''}${note ? `<div class="note">${esc(note)}</div>` : ''}</div>
      <div class="side">${btn}${btn2}</div></div>`;
  }
  const act = (fn) => handlers.push(fn) - 1;

  // Each tab is a list of entries: { sec (its section), sub (a sub-heading), kinds (['here'], ['add'], both, or none: what "show" keeps), hay (what search looks
  // through), later (folded under "not built yet"), html() (the card; makes its buttons) }, and its sections in order.
  const rank = { inroom: 0, removed: 1, available: 2, built: 2, locked: 3, used: 3 };
  const subOf = (d) => (d.sub ? DECOR_SUBS.indexOf(d.sub) : -1);
  function objectEntries() {
    const out = [];
    for (const c of OBJECT_CATEGORIES) {
      const items = OBJECT_CATALOG.filter((d) => d.cat === c.id && live(d)).sort((a, b) => subOf(a) - subOf(b) || rank[objectStatus(a)] - rank[objectStatus(b)]);
      for (const d of items) {
        const st = objectStatus(d);
        // (something GUY built can be both: some in the room, more in storage)
        const kinds = st === 'built' ? [builtCount(d.id) ? 'here' : null, stored(d.id) ? 'add' : null].filter(Boolean)
          : st === 'inroom' ? ['here'] : st === 'removed' || st === 'available' ? ['add'] : [];
        out.push({ sec: c.id, sub: d.sub || null, kinds, st, later: st === 'built' && !stored(d.id) && !builtCount(d.id),
          hay: norm(`${d.name} ${d.desc} ${c.name} ${d.sub || ''}`), html: () => objectCard(d, st) });
      }
    }
    const pics = paintings ? paintings.items : [];
    const sorted = pics.slice().sort((a, b) => a.t - b.t);
    for (const r of sorted) {
      const name = `Painting ${sorted.indexOf(r) + 1}`, where = r.room ? `Hanging in ${paintings.roomName(r.room)}.` : 'Waiting in the Catalog.';
      out.push({ sec: 'paintings', sub: null, kinds: [r.room ? 'here' : 'add'], hay: norm(`${name} painting picture GUY's paintings ${where}`), html: () => paintingCard(r, name, where) });
    }
    return out;
  }
  function objectSections(list) {
    const secs = OBJECT_CATEGORIES.map((c) => {
      const mine = list.filter((e) => e.sec === c.id);
      return { key: c.id, label: `${c.icon} ${c.name} · ${mine.filter((e) => e.st === 'inroom').length} of ${mine.length} in the room` };
    });
    if (paintings && paintings.items.length) secs.push({ key: 'paintings', label: `🖼️ GUY's paintings · ${paintings.hung().length} hung, ${paintings.stored().length} in the Catalog` });
    return secs;
  }
  function objectCard(d, st) {
    const base = { icon: d.icon, name: d.name, desc: d.desc, status: st };
    if (st === 'built') {                           // made by GUY: how many are in the room, how many are waiting in storage
      const note = `In the room: ${builtCount(d.id)} · In storage: ${stored(d.id)}`;
      if (!stored(d.id)) return card({ ...base, status: 'locked', label: 'None in storage', note });
      return card({ ...base, status: 'available', label: 'Add', action: act(() => addBuilt(d)), note });
    }
    if (st === 'inroom') {
      if (d.id === 'shelf') return card({ ...base, label: '✓ Fixed in place' });       // the bookshelf is where GUY learns: it can never leave
      return card({ ...base, label: 'Remove', action: act(() => removeObject(d)), danger: true });
    }
    if (st === 'used') return card({ ...base, status: 'locked', label: '✓ Used: GAL is here', note: 'It folded itself into GAL. There is only one.' });
    if (st === 'locked') return card({ ...base, label: '🔒 Locked' });
    return card({ ...base, label: st === 'removed' ? 'Put back' : 'Add', action: act(() => addObject(d)),
      note: st === 'removed' ? 'You took this out earlier.' : d.book ? 'Comes with its own book.' : '' });
  }
  function paintingCard(r, name, desc) {
    const base = { icon: r.img ? `<img class="thumb" alt="" src="${esc(r.img)}">` : '🖼️', name, desc, status: r.room ? 'inroom' : 'available' };
    // (two taps, in the Catalog itself: a browser dialog would stop everything, and cannot be answered in the QA run)
    const sure = confirmDestroy === r.id;
    const extra = { label: sure ? 'Really destroy?' : 'Destroy', action: act(() => { if (!sure) { confirmDestroy = r.id; render(); return; } confirmDestroy = null; paintings.destroy(r.id); notify('The painting was destroyed.'); render(); }) };
    if (r.room) return card({ ...base, label: 'Take down', action: act(() => { paintings.takeDown(r.id); notify('Took the painting down. It is in the Catalog.'); render(); }), danger: true, extra });
    return card({ ...base, label: 'Hang it', action: act(() => { notify(paintings.hangStored(r.id)); render(); }), note: 'Hangs on a free wall.', extra });
  }

  const SHELF_SECS = [{ key: 'shelf', label: 'On the shelf' }, { key: 'add', label: 'Add to the shelf' }, { key: 'later', label: 'Not available yet' }, { key: 'premium', label: 'Premium · coming soon' }];
  function bookEntries() {
    return BOOK_CATALOG.filter(live).map((b) => {
      const st = bookStatus(b);
      const reqName = b.requires && b.requires.object ? (OBJECT_CATALOG.find((d) => d.id === b.requires.object) || {}).name : b.requires && b.requires.anyObject ? 'an instrument' : '';
      const base = { icon: '📕', name: b.title, desc: b.desc, status: st };
      const sec = st === 'shelf' ? 'shelf' : st === 'available' ? 'add' : st === 'needs-skill' || st === 'needs-shelf' ? 'later' : 'premium';
      return { sec, kinds: sec === 'shelf' ? ['here'] : sec === 'add' ? ['add'] : [], hay: norm(`${b.title} ${b.desc} book`), html: () => {
        if (st === 'shelf') return card({ ...base, label: '✓ On the shelf' });
        if (st === 'available') return card({ ...base, label: 'Add to shelf', action: act(() => addBook(b)) });
        if (st === 'needs-skill') return card({ ...base, label: 'Read the first book', note: 'GUY or GAL has to read "' + ((BOOK_CATALOG.find((x) => x.teaches === b.unlockedBy) || {}).title || 'the first book') + '" first.' });
        if (st === 'needs-shelf') return card({ ...base, label: 'Needs a bookshelf', note: 'Put the bookshelf back first.' });
        return card({ ...base, label: '🔒 Locked', note: reqName ? `Needs the ${reqName}.` : '' });
      } };
    });
  }
  function recordEntries() {
    return ALBUM_CATALOG.map((a) => {
      const st = albumStatus(a);
      const base = { icon: a.icon, name: a.title, desc: `${a.genre}. ${a.desc}`, status: st };
      const sec = st === 'shelf' ? 'shelf' : st === 'available' ? 'add' : st === 'needs-object' || st === 'needs-shelf' ? 'later' : 'premium';
      return { sec, kinds: sec === 'shelf' ? ['here'] : sec === 'add' ? ['add'] : [], hay: norm(`${a.title} ${a.genre} ${a.desc} record album music`), html: () => {
        if (st === 'shelf') return card({ ...base, label: '✓ On the shelf' });
        if (st === 'available') return card({ ...base, label: 'Add to shelf', action: act(() => addAlbum(a)), note: 'GUY can put it on the stereo once he knows how to use it.' });
        if (st === 'needs-object') return card({ ...base, label: 'Needs the stereo', note: 'Put the Stereo & Table back first.' });
        if (st === 'needs-shelf') return card({ ...base, label: 'Needs a bookshelf', note: 'Put the bookshelf back first.' });
        return card({ ...base, label: '🔒 Premium' });
      } };
    });
  }
  const ROOM_SECS = [{ key: 'home', label: 'In your home' }, { key: 'add', label: 'Add a room' }, { key: 'premium', label: 'Premium · coming soon' }];
  function roomEntries() {
    const out = [];
    // a room that is not unlocked is not listed at all, unless it is a premium room: that is shown locked
    for (const r of rooms ? rooms.catalog : []) {
      const base = { icon: r.icon, name: r.name, desc: r.desc, status: 'room' };
      const hay = norm(`${r.name} ${r.desc} room`);
      if (!rooms.isUnlocked(r.id)) { if (r.premium) out.push({ sec: 'premium', kinds: [], hay, html: () => card({ ...base, status: 'locked', label: '🔒 Premium' }) }); continue; }
      if (rooms.isAdded(r.id) && rooms.isClosing(r.id)) out.push({ sec: 'home', kinds: ['here'], hay, html: () => card({ ...base, status: 'inroom', label: 'Removing…', note: 'It goes as soon as GUY and GAL are out of it.' }) });
      else if (rooms.isAdded(r.id)) {
        out.push({ sec: 'home', kinds: ['here'], hay, html: () => {
          const sure = confirmRoom === r.id, kids = rooms.corners(r.id);
          const note = sure ? `Tap again to remove the ${r.name}${kids.length ? ` and the ${kids.join(' and the ')}` : ''}. Its furniture goes back to the Catalog.` : '✓ In your home';
          return card({ ...base, status: 'inroom', label: sure ? 'Tap to confirm' : 'Remove room', action: act(() => removeRoom(r)), danger: true, note });
        } });
      } else if (roomOffer && roomOffer.id === r.id) {
        // the Restaurant asks first when something is in the way of its door: "Remove and add" or "Not now" (rooms.js offerFor)
        out.push({ sec: 'add', kinds: ['add'], hay, html: () => card({ ...base, label: 'Remove and add', action: act(() => acceptRoomOffer(r)), note: roomOffer.text, extra: { action: act(() => declineRoomOffer()), label: 'Not now' } }) });
      } else {
        const note = r.corner ? 'Goes in a free corner beside another room when there is one, otherwise gets a door on a wall. Anything in the way goes back to the Catalog.' : r.askToClear ? 'Puts a door on a wall. If something is in the way, you are asked first.' : 'Puts a door on a wall. Anything in the way goes back to the Catalog.';
        out.push({ sec: 'add', kinds: ['add'], hay, html: () => card({ ...base, label: 'Add to my home', action: act(() => addRoom(r)), note }) });
      }
    }
    return out;
  }
  const entriesOf = (t) => (t === 'objects' ? objectEntries() : t === 'books' ? bookEntries() : t === 'records' ? recordEntries() : roomEntries());
  const sectionsOf = (t, list) => (t === 'objects' ? objectSections(list) : t === 'rooms' ? ROOM_SECS : SHELF_SECS);
  const passes = (e, ts) => (show === 'all' || e.kinds.includes(show)) && (!ts.length || hit(e.hay, ts));

  // The Studio Machine: the same Catalog, scoped to the Studio. What is in the Studio (with Remove) and what can be added to it: music gear and
  // the Studio's own pieces, new ones put in the Studio itself (never decor: the walls and rugs are the Catalog's).
  function renderScoped() {
    head.textContent = '🎛️ Studio Machine';
    sub.textContent = 'What is in the Studio, and what you can add to it.';
    root.setAttribute('aria-label', 'Studio Machine');
    root.querySelector('.tabs').hidden = true; tools.hidden = true; chipBar.hidden = true; foot.hidden = true;
    const here = [], add = [];
    const mine = OBJECT_CATALOG.filter((d) => !d.decor && !d.built && !d.ball && (d.cat === 'music' || d.room === 'studio') && live(d));
    for (const d of mine) {
      const st = objectStatus(d), o = world.objects[d.id];
      const inStudio = st === 'inroom' && o && world.roomIdAt(o.x, o.z) === 'studio';
      const base = { icon: d.icon, name: d.name, desc: d.desc, status: inStudio ? 'inroom' : st };
      if (inStudio) here.push(card({ ...base, label: 'Remove', action: act(() => removeObject(d)), danger: true }));
      else if (st === 'inroom') add.push(card({ ...base, status: 'inroom', label: '✓ In another room', note: 'Move it into the Studio by hand.' }));
      else if (st === 'locked') add.push(card({ ...base, label: '🔒 Locked' }));
      else add.push(card({ ...base, label: st === 'removed' ? 'Put back' : 'Add', action: act(() => addObject(d, world.roomSpot('studio'))), note: 'Goes in the Studio.' }));
    }
    const hung = Object.values(world.objects).filter((o) => o.guitar && o.hung).length;
    body.innerHTML = `<div class="hint">${hung ? `🎸 ${hung} guitar${hung > 1 ? 's' : ''} hanging on the walls. Push a guitar against a Studio wall to hang it.` : '🎸 Push a guitar against a Studio wall to hang it there.'}</div>`
      + [['In the Studio', here], ['Add to the Studio', add]].filter(([, c]) => c.length).map(([h, c]) => `<section class="sec"><h4><span class="sec-label">${h}</span></h4><div class="cards">${c.join('')}</div></section>`).join('');
  }

  function render() {
    handlers = [];
    if (scope) { renderScoped(); return; }
    head.textContent = '⚙️ Catalog';
    sub.textContent = 'Add objects to the room, books and records to the shelf, and rooms to the house. GUY learns new things by reading.';
    root.setAttribute('aria-label', 'Catalog');
    root.querySelector('.tabs').hidden = false; tools.hidden = false; foot.hidden = false;
    const ts = terms();
    // the tabs: while searching, each says how many it found
    root.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on));
      const n = ts.length ? entriesOf(t.dataset.tab).filter((e) => passes(e, ts)).length : null;
      t.innerHTML = `${TAB_NAMES[t.dataset.tab]}${n === null ? '' : ` <span class="n${n ? '' : ' zero'}">${n}</span>`}`;
    });
    const [hereName, addName] = SHOW_NAMES[tab];
    showBar.innerHTML = [['all', 'Everything'], ['here', hereName], ['add', addName]]
      .map(([k, n]) => `<button type="button" data-show="${k}" class="${show === k ? 'on' : ''}" aria-pressed="${show === k}">${n}</button>`).join('');

    const list = entriesOf(tab);
    const secs = sectionsOf(tab, list);
    // the category chips (Objects only): what is in the room of each, or, while searching, how many it found
    chipBar.hidden = tab !== 'objects';
    if (tab === 'objects') {
      const chips = [{ key: 'all', label: 'All', icon: '' }].concat(OBJECT_CATEGORIES.filter((c) => list.some((e) => e.sec === c.id)).map((c) => ({ key: c.id, label: c.name, icon: c.icon })))
        .concat(paintings && paintings.items.length ? [{ key: 'paintings', label: "GUY's paintings", icon: '🖼️' }] : []);
      chipBar.innerHTML = chips.map((c) => {
        const mine = c.key === 'all' ? list.filter((e) => e.sec !== 'paintings') : list.filter((e) => e.sec === c.key);      // (All counts the objects, as it always has; the paintings have their own chip)
        const count = ts.length || show !== 'all' ? `${mine.filter((e) => passes(e, ts)).length}`
          : `${mine.filter((e) => (e.sec === 'paintings' ? e.kinds.includes('here') : e.st === 'inroom')).length}/${mine.length}`;
        return `<button type="button" class="chip${cat === c.key ? ' on' : ''}${(ts.length || show !== 'all') && count === '0' ? ' none' : ''}" data-cat="${c.key}" aria-pressed="${cat === c.key}">${c.icon ? c.icon + ' ' : ''}${esc(c.label)} <span>${count}</span></button>`;
      }).join('');
    }
    const shown = list.filter((e) => passes(e, ts) && (tab !== 'objects' || cat === 'all' || e.sec === cat));
    const foldable = !ts.length && !(tab === 'objects' && cat !== 'all');           // (a single category, or a search, is always open)
    const html = secs.map((s) => {
      const mine = shown.filter((e) => e.sec === s.key);
      if (!mine.length) return '';
      const key = `${tab}:${s.key}`, shut = foldable && closed.has(key);
      let lastSub = null;
      const cards = [], later = [], subs = mine.length >= 8;           // (sub-headings only where there is a lot: a heading over one card wastes a row)
      for (const e of mine) {
        if (e.later && !ts.length) { later.push(e.html()); continue; }
        if (subs && e.sub && e.sub !== lastSub) cards.push(`<div class="subhead">${esc(e.sub)}</div>`);
        lastSub = e.sub || lastSub;
        cards.push(e.html());
      }
      if (later.length && subs && mine.find((e) => e.later).sub && lastSub !== mine.find((e) => e.later).sub) cards.push(`<div class="subhead">${esc(mine.find((e) => e.later).sub)}</div>`);
      if (later.length) cards.push(`<details class="later" data-later="${key}"${opened.has(`later:${key}`) ? ' open' : ''}><summary>${later.length} more GUY can build (none made yet): tap to see them</summary><div class="cards">${later.join('')}</div></details>`);
      const label = esc(s.label) + (show !== 'all' || ts.length ? ` <small>· ${mine.length} shown</small>` : '');
      return `<section class="sec${shut ? ' closed' : ''}" data-sec="${s.key}"><h4>${foldable
        ? `<button type="button" class="sec-head" data-fold="${key}" aria-expanded="${!shut}">${label}</button>`
        : `<span class="sec-label">${label}</span>`}</h4><div class="cards">${cards.join('')}</div></section>`;
    }).join('');
    body.innerHTML = html || emptyHtml(ts);
    const total = list.length, here = list.filter((e) => e.kinds.includes('here')).length;
    foot.innerHTML = `<span>${tab === 'objects' ? `${here} of ${total} in your home` : tab === 'rooms' ? `${here} of ${total} rooms in your home` : `${here} of ${total} on the shelf`}</span><span class="keys"> · Press / to search, C or Esc to close</span>`;
  }
  // Nothing to show: say why, and offer the way out (another tab that has it, everything, all categories)
  function emptyHtml(ts) {
    const why = ts.length ? `Nothing here matches “${esc(query)}”` : 'Nothing to show here';
    const outs = [];
    if (tab === 'objects' && cat !== 'all') outs.push('<button type="button" class="jump" data-jump-cat="all">Look in every category</button>');
    if (show !== 'all') outs.push('<button type="button" class="jump" data-jump-show="all">Show everything</button>');
    if (ts.length) for (const t of Object.keys(TAB_NAMES)) if (t !== tab) { const n = entriesOf(t).filter((e) => passes(e, ts)).length; if (n) outs.push(`<button type="button" class="jump" data-jump-tab="${t}">${n} in ${TAB_NAMES[t]}</button>`); }
    return `<div class="empty"><p>${why}${show !== 'all' ? ` (showing only “${SHOW_NAMES[tab][show === 'here' ? 0 : 1]}”)` : ''}.</p>${outs.length ? `<div class="outs">${outs.join('')}</div>` : ''}</div>`;
  }

  // ---- events ---------------------------------------------------------------------------------------------------------------------
  if (rooms) rooms.onChange(() => { if (!root.hidden) render(); });
  if (paintings) paintings.onChange(() => { if (!root.hidden) render(); });
  const toTop = () => { body.scrollTop = 0; };
  root.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; render(); toTop(); }));
  chipBar.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; render(); toTop(); } });
  showBar.addEventListener('click', (e) => { const b = e.target.closest('[data-show]'); if (b) { show = b.dataset.show; render(); toTop(); } });
  search.addEventListener('input', () => {
    const was = query; query = search.value;
    if (!was.trim() && query.trim() && tab === 'objects') cat = 'all';                // a new search looks through every category
    render(); toTop();
  });
  // keys typed in the search box are for the search box: they must not reach the room (K, F, M, Space ...)
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) { search.value = ''; query = ''; render(); e.stopPropagation(); return; }
    if (e.key === 'Escape') { search.blur(); return; }                      // (an empty box: Escape closes the Catalog as usual)
    if (e.key === 'Enter') search.blur();                                  // (puts the phone keyboard away)
    e.stopPropagation();
  });
  body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (a) { const fn = handlers[+a.dataset.action]; if (fn) fn(); return; }
    const f = e.target.closest('[data-fold]');
    if (f) { const k = f.dataset.fold; if (closed.has(k)) closed.delete(k); else closed.add(k); saveClosed(); render(); return; }
    const j = e.target.closest('.jump');
    if (j) {
      if (j.dataset.jumpTab) tab = j.dataset.jumpTab;
      if (j.dataset.jumpCat) cat = j.dataset.jumpCat;
      if (j.dataset.jumpShow) show = j.dataset.jumpShow;
      render(); toTop(); return;
    }
    const info = e.target.closest('.card .info');                          // tap a card for its whole description
    if (info) { const c = info.parentElement, t = c.querySelector('.title').textContent; if (c.classList.toggle('open')) opened.add(t); else opened.delete(t); }
  });
  body.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.later) { const k = `later:${d.dataset.later}`; if (d.open) opened.add(k); else opened.delete(k); } }, true);
  const close = () => { root.hidden = true; scope = null; query = ''; search.value = ''; show = 'all'; };
  root.querySelector('.close').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  // the Catalog takes clicks, drags and scrolling for itself: they must not reach the room behind it (as in Help)
  for (const t of ['pointerdown', 'pointerup', 'wheel', 'touchstart']) root.addEventListener(t, (e) => e.stopPropagation());
  function open(s = null) {
    scope = s === 'studio' ? 'studio' : null;
    onOpen();
    render(); root.hidden = false; toTop();
    const first = scope ? root.querySelector('.close') : root.querySelector('.tab.on');
    if (first) first.focus({ preventScroll: true });
  }
  addEventListener('keydown', (e) => {
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape' && !root.hidden) { close(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'c' || e.key === 'C') { if (root.hidden) open(); else close(); return; }
    if (e.key === '/' && !root.hidden && !scope) { e.preventDefault(); search.focus(); }
  });

  return { open, close, refresh: render, save, restoreExtras, ops, isOpen: () => !root.hidden };
}
