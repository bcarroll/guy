// The Catalog's catalog: what can go in the room, and which books can go on the shelf.
//
// Objects come in four states:
//   inroom    already here
//   removed   was taken out by the user; can be put back
//   available free to add
//   locked    a future premium unlock (shown, but the button does nothing yet)
// Books: shelf (on the shelf), available, needs-object / needs-shelf (can't be added yet), locked.
import { BOOK_CATALOG } from './skills.js';
import { ALBUM_CATALOG } from './albums.js';
import { dev } from './devunlock.js';

// cat: the category the Objects tab files it under (see OBJECT_CATEGORIES). decor: not furniture GUY uses; the rug, the windows
// and the picture live in world.decor and can be removed and put back like everything else.
export const OBJECT_CATEGORIES = [
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'hobbies', name: 'Hobbies', icon: '🎨' },
  { id: 'workshop', name: 'Workshop', icon: '🛠️' },
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️' },
  { id: 'backyard', name: 'Backyard', icon: '🌳' },
  { id: 'robots', name: 'Robots', icon: '🤖' },
  { id: 'furniture', name: 'Furniture', icon: '🛋️' },
  { id: 'decor', name: 'Decor & lighting', icon: '🖼️' },
  { id: 'games', name: 'Games', icon: '⚽' },
];

// The order of the sub-headings inside a category that uses them (Decor & lighting has a lot of things in it).
export const DECOR_SUBS = ['Sports', 'Garden', 'Premium', 'Plants', 'Wall art', 'Windows', 'Rugs', 'Lighting', 'Small furniture', 'Workbench & storage', 'Woodwork', 'Metalwork', 'Built by GUY', 'Kitchen', 'Dining'];

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
  // Things GUY builds there (once he has read the right book). They wait in storage; add them to the room from here, one at a time.
  { id: 'footstool', cat: 'workshop', sub: 'Built by GUY', name: 'Wooden Foot Stool', icon: '🪜', desc: 'A little wooden foot stool, built by GUY.', built: true, room: 'workshop' },
  { id: 'woodshelves', cat: 'workshop', sub: 'Built by GUY', name: 'Wooden Shelves', icon: '🗄️', desc: 'A set of wooden shelves, built by GUY.', built: true, room: 'workshop' },
  { id: 'builtchair', cat: 'workshop', sub: 'Built by GUY', name: 'Wooden Chair (built by GUY)', icon: '🪑', desc: 'A wooden chair that GUY made himself. He can sit on it.', built: true, room: 'workshop' },
  { id: 'diningtable3', cat: 'workshop', sub: 'Built by GUY', name: 'Wooden Dining Table (built by GUY)', icon: '🍽️', desc: 'A table for two with two chairs, built when the restaurant was full. It goes in the Restaurant and customers sit at it.', built: true, room: 'workshop' },
  { id: 'diningtable4', cat: 'workshop', sub: 'Built by GUY', name: 'Metal Dining Table (built by GUY)', icon: '🍽️', desc: 'A welded metal table for two with two chairs. It goes in the Restaurant and customers sit at it.', built: true, room: 'workshop' },
  { id: 'eguitar', cat: 'workshop', sub: 'Built by GUY', name: 'Electric Guitar (built by GUY)', icon: '🎸', desc: 'A red electric guitar on its own stand, built from wood and metal. GUY and GAL can both play along with a guitar each.', built: true, room: 'workshop' },
  { id: 'bookshelf2', cat: 'workshop', sub: 'Built by GUY', name: 'Bookshelf (built by GUY)', icon: '📚', desc: 'A copy of the skill bookshelf, built when books were piling up on the floor. The books and records that did not fit move onto it; long-press it for their lists and GUY reads from it like the first one. Heavy: only you can move it.', built: true, room: 'workshop' },
  { id: 'metalchair', cat: 'workshop', sub: 'Built by GUY', name: 'Metal Chair (built by GUY)', icon: '🪑', desc: 'A welded metal chair. GUY can sit on it.', built: true, room: 'workshop' },
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
  { id: 'drums', cat: 'music', name: 'Drum Kit', icon: '🥁', desc: 'Kick, snare, hi-hat and cymbals on a stool. Comes with the book "Drumming for Robots".', free: true, book: 'drumming' },
  { id: 'easel', cat: 'hobbies', name: 'Painting Easel', icon: '🎨', desc: 'A canvas that really gets painted. Comes with the book "Painting for Robots".', free: true, book: 'painting' },
  { id: 'telescope', cat: 'hobbies', name: 'Telescope', icon: '🔭', desc: 'On a tripod by the window. Comes with the book "Stargazing for Robots".', free: true, book: 'stars' },
];

const KEY = 'guy.room.v1';

export function initMachine({ world, guy, persist, notify, remove, rooms, paintings, knows = () => true }) {
  const root = document.getElementById('machine');
  const body = root.querySelector('.body');
  const chipBar = root.querySelector('.chips');
  let tab = 'objects';
  let cat = 'all';                   // the category filter on the Objects tab

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
    if (b.requires && b.requires.object && !hasObject(b.requires.object)) return 'needs-object';
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

  function addObject(d) {
    const st = objectStatus(d);
    let ok = false;
    if (st === 'removed') ok = d.ball ? world.restoreBall(avoid()) : world.restoreObject(d.id, avoid());
    else if (st === 'available') {
      ok = world.addNew(d.id, avoid());
      if (ok && d.book) { const def = BOOK_CATALOG.find((b) => b.id === d.book); if (def) addBookDef(def); }
    }
    notify(ok ? `Added ${d.name}${st === 'available' && d.book ? ' and its book' : ''}` : `No room for ${d.name} right now`);
    save();
    render();
  }

  function addBuilt(d) {
    const name = world.addInstance(d.id, avoid());
    notify(name ? `Added a ${d.name} from storage` : stored(d.id) ? `No room for a ${d.name} right now` : `There is no ${d.name} in storage yet`);
    save();
    render();
  }

  function removeObject(d) {
    if (!inRoom(d.id)) return;
    remove(d.id);
    notify(`Took the ${d.name} out of the room`);
    save();
    render();
  }

  function addRoom(r) {
    const res = rooms.add(r.id);
    notify(res.messages.join(' '));
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

  function card({ icon, name, desc, status, label, action, note, danger }) {
    const btn = action !== undefined
      ? `<button class="act${danger ? ' rm' : ''}" data-action="${action}">${label}</button>`
      : `<span class="badge ${status}">${label}</span>`;
    return `<div class="card ${status}"><div class="icon">${icon}</div>
      <div class="info"><div class="title">${esc(name)}</div><div class="desc">${esc(desc)}</div>${note ? `<div class="note">${esc(note)}</div>` : ''}</div>
      <div class="side">${btn}</div></div>`;
  }

  function render() {
    root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    const groups = { 'In the room': [], 'Add to the room': [], 'Premium · coming soon': [] };
    const albumGroups = { 'On the shelf': [], 'Add to the shelf': [], 'Not available yet': [], 'Premium · coming soon': [] };
    const bookGroups = { 'On the shelf': [], 'Add to the shelf': [], 'Not available yet': [], 'Premium · coming soon': [] };
    const roomGroups = { 'In your home': [], 'Add a room': [], 'Premium · coming soon': [] };
    const handlers = [];
    chipBar.hidden = tab !== 'objects';
    if (tab === 'objects') {
      // One section per category, each with how many of its items are in the room. Within a section: what is in the room first
      // (with a Remove button), then things you took out (Put back), then things you can add, then locked ones.
      const rank = { inroom: 0, removed: 1, available: 2, built: 2, locked: 3, used: 3 };
      const sections = [];
      for (const c of OBJECT_CATEGORIES) {
        const subOf = (d) => (d.sub ? DECOR_SUBS.indexOf(d.sub) : -1);
        const items = OBJECT_CATALOG.filter((d) => d.cat === c.id && live(d)).sort((a, b) => subOf(a) - subOf(b) || rank[objectStatus(a)] - rank[objectStatus(b)]);
        const here = items.filter((d) => objectStatus(d) === 'inroom').length;
        sections.push({ c, items, here });
      }
      const pics = paintings ? paintings.items : [];
      chipBar.innerHTML = [{ id: 'all', name: 'All', icon: '', here: sections.reduce((n, s) => n + s.here, 0), total: sections.reduce((n, s) => n + s.items.length, 0) }]
        .concat(sections.map((s) => ({ id: s.c.id, name: s.c.name, icon: s.c.icon, here: s.here, total: s.items.length })))
        .concat(pics.length ? [{ id: 'paintings', name: "GUY's paintings", icon: '🖼️', here: paintings.hung().length, total: pics.length }] : [])
        .map((c) => `<button class="chip${cat === c.id ? ' on' : ''}" data-cat="${c.id}">${c.icon ? c.icon + ' ' : ''}${c.name} <span>${c.here}/${c.total}</span></button>`).join('');
      for (const { c, items, here } of sections) {
        if (cat !== 'all' && cat !== c.id) continue;
        const objectCard = (d) => {
          const st = objectStatus(d);
          const base = { icon: d.icon, name: d.name, desc: d.desc, status: st };
          if (st === 'built') {                           // made by GUY: how many are in the room, how many are waiting in storage
            const note = `In the room: ${builtCount(d.id)} · In storage: ${stored(d.id)}`;
            if (!stored(d.id)) return card({ ...base, status: 'locked', label: 'None in storage', note });
            const i = handlers.push(() => addBuilt(d)) - 1;
            return card({ ...base, status: 'available', label: 'Add', action: i, note });
          }
          if (st === 'inroom') {
            const fixed = d.id === 'shelf';       // the bookshelf is where GUY learns: it can never leave
            if (fixed) return card({ ...base, label: '✓ Fixed in place' });
            const i = handlers.push(() => removeObject(d)) - 1;
            return card({ ...base, label: 'Remove', action: i, danger: true });
          }
          if (st === 'used') return card({ ...base, status: 'locked', label: '✓ Used: GAL is here', note: 'It folded itself into GAL. There is only one.' });
          if (st === 'locked') return card({ ...base, label: '🔒 Locked' });
          const i = handlers.push(() => addObject(d)) - 1;
          return card({ ...base, label: st === 'removed' ? 'Put back' : 'Add', action: i,
            note: st === 'removed' ? 'You took this out earlier.' : d.book ? 'Comes with its own book.' : '' });
        };
        let lastSub = null;
        const cards = items.flatMap((d) => {
          const head = d.sub && d.sub !== lastSub ? [`<div class="subhead">${d.sub}</div>`] : [];
          lastSub = d.sub || lastSub;
          return [...head, objectCard(d)];
        });
        groups[`${c.icon} ${c.name} · ${here} of ${items.length} in the room`] = cards;
      }
      if (pics.length && (cat === 'all' || cat === 'paintings')) {            // what GUY has painted: hung on a wall, or waiting in the Catalog (a thumbnail of each picture)
        const sorted = pics.slice().sort((a, b) => a.t - b.t);
        groups[`🖼️ GUY's paintings · ${paintings.hung().length} hung, ${paintings.stored().length} in the Catalog`] = sorted.map((r) => {
          const base = { icon: r.img ? `<img class="thumb" alt="" src="${esc(r.img)}">` : '🖼️', name: `Painting ${sorted.indexOf(r) + 1}`, status: r.room ? 'inroom' : 'available' };
          if (r.room) {
            const i = handlers.push(() => { paintings.takeDown(r.id); notify('Took the painting down. It is in the Catalog.'); render(); }) - 1;
            return card({ ...base, desc: `Hanging in ${paintings.roomName(r.room)}.`, label: 'Take down', action: i, danger: true });
          }
          const i = handlers.push(() => { notify(paintings.hangStored(r.id)); render(); }) - 1;
          return card({ ...base, desc: 'Waiting in the Catalog.', label: 'Hang it', action: i, note: 'Hangs on a free wall.' });
        });
      }
      delete groups['In the room']; delete groups['Add to the room']; delete groups['Premium · coming soon'];
    } else if (tab === 'records') {
      for (const a of ALBUM_CATALOG) {
        const st = albumStatus(a);
        const i = handlers.push(() => addAlbum(a)) - 1;
        const base = { icon: a.icon, name: a.title, desc: `${a.genre}. ${a.desc}`, status: st };
        if (st === 'shelf') albumGroups['On the shelf'].push(card({ ...base, label: '✓ On the shelf' }));
        else if (st === 'available') albumGroups['Add to the shelf'].push(card({ ...base, label: 'Add to shelf', action: i, note: 'GUY can put it on the stereo once he knows how to use it.' }));
        else if (st === 'needs-object') albumGroups['Not available yet'].push(card({ ...base, label: 'Needs the stereo', note: 'Put the Stereo & Table back first.' }));
        else if (st === 'needs-shelf') albumGroups['Not available yet'].push(card({ ...base, label: 'Needs a bookshelf', note: 'Put the bookshelf back first.' }));
        else albumGroups['Premium · coming soon'].push(card({ ...base, label: '🔒 Premium' }));
      }
    } else if (tab === 'rooms') {
      // a room that is not unlocked is not listed at all, unless it is a premium room: that is shown locked
      for (const r of rooms ? rooms.catalog : []) {
        const base = { icon: r.icon, name: r.name, desc: r.desc, status: 'room' };
        if (!rooms.isUnlocked(r.id)) { if (r.premium) roomGroups['Premium · coming soon'].push(card({ ...base, status: 'locked', label: '🔒 Premium' })); continue; }
        if (rooms.isAdded(r.id)) roomGroups['In your home'].push(card({ ...base, status: 'inroom', label: '✓ In your home' }));
        else { const i = handlers.push(() => addRoom(r)) - 1; roomGroups['Add a room'].push(card({ ...base, label: 'Add to my home', action: i, note: 'Puts a door on a wall. Anything in the way goes back to the Catalog.' })); }
      }
    } else {
      for (const b of BOOK_CATALOG.filter(live)) {
        const st = bookStatus(b);
        const i = handlers.push(() => addBook(b)) - 1;
        const base = { icon: '📕', name: b.title, desc: b.desc, status: st };
        const reqName = b.requires && b.requires.object ? (OBJECT_CATALOG.find((d) => d.id === b.requires.object) || {}).name : '';
        if (st === 'shelf') bookGroups['On the shelf'].push(card({ ...base, label: '✓ On the shelf' }));
        else if (st === 'available') bookGroups['Add to the shelf'].push(card({ ...base, label: 'Add to shelf', action: i }));
        else if (st === 'needs-skill') bookGroups['Not available yet'].push(card({ ...base, label: 'Read the first book', note: 'GUY or GAL has to read "' + ((BOOK_CATALOG.find((x) => x.teaches === b.unlockedBy) || {}).title || 'the first book') + '" first.' }));
        else if (st === 'needs-object') bookGroups['Not available yet'].push(card({ ...base, label: 'Needs ' + reqName, note: `Add the ${reqName} to the room first.` }));
        else if (st === 'needs-shelf') bookGroups['Not available yet'].push(card({ ...base, label: 'Needs a bookshelf', note: 'Put the bookshelf back first.' }));
        else bookGroups['Premium · coming soon'].push(card({ ...base, label: '🔒 Locked', note: reqName ? `Needs the ${reqName}.` : '' }));
      }
    }
    const use = tab === 'objects' ? groups : tab === 'records' ? albumGroups : tab === 'rooms' ? roomGroups : bookGroups;
    body.innerHTML = Object.entries(use).filter(([, c]) => c.length).map(([h, c]) => `<h4>${h}</h4>${c.join('')}`).join('');
    body.querySelectorAll('[data-action]').forEach((el) => el.addEventListener('click', () => handlers[+el.dataset.action]()));
  }

  if (rooms) rooms.onChange(() => { if (!root.hidden) render(); });
  if (paintings) paintings.onChange(() => { if (!root.hidden) render(); });
  root.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; render(); }));
  chipBar.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; render(); } });
  const close = () => { root.hidden = true; };
  root.querySelector('.close').addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });

  return { open() { render(); root.hidden = false; }, close, refresh: render, save, restoreExtras, isOpen: () => !root.hidden };
}
