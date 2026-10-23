// The Catalogue's catalogue: what can go in the room, and which books can go on the shelf.
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

// cat: the category the Objects tab files it under (see OBJECT_CATEGORIES). decor: not furniture Guy uses; the rug, the windows
// and the picture live in world.decor and can be removed and put back like everything else.
export const OBJECT_CATEGORIES = [
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'hobbies', name: 'Hobbies', icon: '🎨' },
  { id: 'workshop', name: 'Workshop', icon: '🛠️' },
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️' },
  { id: 'furniture', name: 'Furniture', icon: '🛋️' },
  { id: 'decor', name: 'Decor & lighting', icon: '🖼️' },
  { id: 'games', name: 'Games', icon: '⚽' },
];

// The order of the sub-headings inside a category that uses them (Decor & lighting has a lot of things in it).
export const DECOR_SUBS = ['Plants', 'Wall art', 'Windows', 'Rugs', 'Lighting', 'Small furniture', 'Workbench & storage', 'Woodwork', 'Built by Guy', 'Kitchen', 'Dining'];

export const OBJECT_CATALOG = [
  { id: 'piano', cat: 'music', name: 'Upright Piano', icon: '🎹', desc: 'Scales, tunes and jam sessions. Heavy: only you can move it.', core: true },
  { id: 'bench', cat: 'music', name: 'Piano Bench', icon: '🪑', desc: 'Guy pulls this up to the piano.', core: true },
  { id: 'table', cat: 'music', name: 'Stereo & Table', icon: '📻', desc: 'The boombox and the table it sits on.', core: true },
  { id: 'shelf', cat: 'furniture', name: 'Bookshelf', icon: '📚', desc: 'Where the books live. Heavy: only you can move it.', core: true },
  { id: 'lamp', cat: 'decor', sub: 'Lighting', name: 'Floor Lamp', icon: '💡', desc: 'On and off, plus moods and light shows with the right book.', core: true },
  { id: 'armchair', cat: 'furniture', name: 'Armchair', icon: '🛋️', desc: 'A comfortable place to read.', core: true },
  { id: 'armchair2', cat: 'furniture', name: 'Second Armchair', icon: '🛋️', desc: 'A burgundy armchair. Guy picks whichever chair he likes to read in or play in.', free: true },
  { id: 'chair', cat: 'furniture', name: 'Wooden Chair', icon: '🪑', desc: 'A plain chair: for reading, resting, or playing the guitar sitting down.', free: true },
  { id: 'chair2', cat: 'furniture', name: 'Second Wooden Chair', icon: '🪑', desc: 'Another plain chair.', free: true },
  { id: 'plant', cat: 'decor', sub: 'Plants', name: 'Potted Plant', icon: '🪴', desc: 'Makes the room feel lived in.', core: true },
  { id: 'ball', cat: 'games', name: 'Red Ball', icon: '⚽', desc: 'Kick it, dribble it, toss it.', core: true, ball: true },
  { id: 'rug', cat: 'decor', sub: 'Rugs', name: 'Round Rug', icon: '🟥', desc: 'A soft rug for the middle of the floor. Hold on it, then drag to move it.', core: true, decor: true },
  { id: 'picture', cat: 'decor', sub: 'Wall art', name: 'Wall Picture', icon: '🖼️', desc: 'A sunset in a frame on the back wall. Drag it along the wall.', core: true, decor: true },
  { id: 'window', cat: 'decor', sub: 'Windows', name: 'Window', icon: '🪟', desc: 'Lets the daylight in. Drag it along the left wall.', core: true, decor: true },
  { id: 'window2', cat: 'decor', sub: 'Windows', name: 'Second Window', icon: '🪟', desc: 'Another window, for the back wall. Drag it along the wall.', free: true, decor: true },
  { id: 'flowerplant', cat: 'decor', sub: 'Plants', name: 'Flowering Plant', icon: '🌸', desc: 'A pot of pink, yellow and white blooms. Guy tends it like the other plants.', free: true },
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
  { id: 'workbench', cat: 'workshop', sub: 'Workbench & storage', name: 'Workbench', icon: '🛠️', desc: 'A sturdy wooden work table with a pegboard, where things get built. Heavy: only you can move it. Comes with the book "Workshop Basics".', free: true, room: 'workshop', book: 'workshop' },
  { id: 'toolbox', cat: 'workshop', sub: 'Workbench & storage', name: 'Toolbox', icon: '🧰', desc: 'A red toolbox for the tools. Guy takes a tool out before he uses it and puts it back after.', free: true, room: 'workshop' },
  { id: 'woodfactory', cat: 'workshop', sub: 'Woodwork', name: 'Wood Factory', icon: '🏭', desc: 'A small machine that makes planks for building. Heavy: only you can move it. Comes with the book "Wood & Metal Basics".', free: true, room: 'workshop', book: 'woodmetal' },
  { id: 'saw', cat: 'workshop', sub: 'Woodwork', name: 'Saw & Sawhorse', icon: '🪚', desc: 'Guy saws planks into parts here.', free: true, room: 'workshop' },
  { id: 'mallet', cat: 'workshop', sub: 'Woodwork', name: 'Rubber Mallet & Block', icon: '🔨', desc: 'Guy taps the parts together here, gently.', free: true, room: 'workshop' },
  { id: 'sander', cat: 'workshop', sub: 'Woodwork', name: 'Sander', icon: '🧽', desc: 'Smooths the wood so it is ready to use.', free: true, room: 'workshop' },
  // Things Guy builds there (once he has read the right book). They wait in storage; add them to the room from here, one at a time.
  { id: 'footstool', cat: 'workshop', sub: 'Built by Guy', name: 'Wooden Foot Stool', icon: '🪜', desc: 'A little wooden foot stool, built by Guy.', built: true, room: 'workshop' },
  { id: 'woodshelves', cat: 'workshop', sub: 'Built by Guy', name: 'Wooden Shelves', icon: '🗄️', desc: 'A set of wooden shelves, built by Guy.', built: true, room: 'workshop' },
  { id: 'builtchair', cat: 'workshop', sub: 'Built by Guy', name: 'Wooden Chair (built by Guy)', icon: '🪑', desc: 'A wooden chair that Guy made himself. He can sit on it.', built: true, room: 'workshop' },
  // The Restaurant (a room added from the Rooms tab). Customers arrive by its elevator. See src/restobjects.js and src/customers.js.
  { id: 'stove', cat: 'restaurant', sub: 'Kitchen', name: 'Stove', icon: '🍲', desc: 'A big stove with a pot. Guy cooks the orders here. Heavy: only you can move it. Comes with the book "Restaurant Basics".', free: true, room: 'restaurant', book: 'restaurant' },
  { id: 'kitchencounter', cat: 'restaurant', sub: 'Kitchen', name: 'Kitchen Counter', icon: '🧊', desc: 'A counter with a fridge, where the cooked plates wait to be served. Heavy: only you can move it.', free: true, room: 'restaurant' },
  { id: 'register', cat: 'restaurant', sub: 'Dining', name: 'Cash Register', icon: '💵', desc: 'Where customers pay when they have finished. Ding!', free: true, room: 'restaurant' },
  { id: 'diningtable', cat: 'restaurant', sub: 'Dining', name: 'Dining Table', icon: '🍽️', desc: 'A table for two with two chairs. Customers sit here to eat.', free: true, room: 'restaurant' },
  { id: 'diningtable2', cat: 'restaurant', sub: 'Dining', name: 'Second Dining Table', icon: '🍽️', desc: 'Another table for two, so more customers can eat at once.', free: true, room: 'restaurant' },
  { id: 'drums', cat: 'music', name: 'Drum Kit', icon: '🥁', desc: 'Kick, snare, hi-hat and cymbals on a stool. Comes with the book "Drumming for Robots".', free: true, book: 'drumming' },
  { id: 'easel', cat: 'hobbies', name: 'Painting Easel', icon: '🎨', desc: 'A canvas that really gets painted. Comes with the book "Painting for Robots".', free: true, book: 'painting' },
  { id: 'telescope', cat: 'hobbies', name: 'Telescope', icon: '🔭', desc: 'On a tripod by the window. Comes with the book "Stargazing for Robots".', free: true, book: 'stars' },
];

const KEY = 'guy.room.v1';

export function initMachine({ world, guy, persist, notify, remove, rooms, paintings }) {
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
    if (d.locked && !dev.all) return 'locked';
    if (d.ball) return world.ballGone ? 'removed' : 'inroom';
    if (inRoom(d.id)) return 'inroom';
    if (world.removed[d.id]) return 'removed';
    return 'available';
  };
  const hasObject = inRoom;
  // things that belong to a room the user has not added (or that is not unlocked) are not listed at all
  const live = (d) => !d.room || (!!rooms && rooms.isLive(d.room));
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
      const rank = { inroom: 0, removed: 1, available: 2, built: 2, locked: 3 };
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
        .concat(pics.length ? [{ id: 'paintings', name: "Guy's paintings", icon: '🖼️', here: paintings.hung().length, total: pics.length }] : [])
        .map((c) => `<button class="chip${cat === c.id ? ' on' : ''}" data-cat="${c.id}">${c.icon ? c.icon + ' ' : ''}${c.name} <span>${c.here}/${c.total}</span></button>`).join('');
      for (const { c, items, here } of sections) {
        if (cat !== 'all' && cat !== c.id) continue;
        const objectCard = (d) => {
          const st = objectStatus(d);
          const base = { icon: d.icon, name: d.name, desc: d.desc, status: st };
          if (st === 'built') {                           // made by Guy: how many are in the room, how many are waiting in storage
            const note = `In the room: ${builtCount(d.id)} · In storage: ${stored(d.id)}`;
            if (!stored(d.id)) return card({ ...base, status: 'locked', label: 'None in storage', note });
            const i = handlers.push(() => addBuilt(d)) - 1;
            return card({ ...base, status: 'available', label: 'Add', action: i, note });
          }
          if (st === 'inroom') {
            const fixed = d.id === 'shelf';       // the bookshelf is where Guy learns: it can never leave
            if (fixed) return card({ ...base, label: '✓ Fixed in place' });
            const i = handlers.push(() => removeObject(d)) - 1;
            return card({ ...base, label: 'Remove', action: i, danger: true });
          }
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
      if (pics.length && (cat === 'all' || cat === 'paintings')) {            // what Guy has painted: hung on a wall, or waiting in the Catalogue (a thumbnail of each picture)
        const sorted = pics.slice().sort((a, b) => a.t - b.t);
        groups[`🖼️ Guy's paintings · ${paintings.hung().length} hung, ${paintings.stored().length} in the Catalogue`] = sorted.map((r) => {
          const base = { icon: r.img ? `<img class="thumb" alt="" src="${esc(r.img)}">` : '🖼️', name: `Painting ${sorted.indexOf(r) + 1}`, status: r.room ? 'inroom' : 'available' };
          if (r.room) {
            const i = handlers.push(() => { paintings.takeDown(r.id); notify('Took the painting down. It is in the Catalogue.'); render(); }) - 1;
            return card({ ...base, desc: `Hanging in ${paintings.roomName(r.room)}.`, label: 'Take down', action: i, danger: true });
          }
          const i = handlers.push(() => { notify(paintings.hangStored(r.id)); render(); }) - 1;
          return card({ ...base, desc: 'Waiting in the Catalogue.', label: 'Hang it', action: i, note: 'Hangs on a free wall.' });
        });
      }
      delete groups['In the room']; delete groups['Add to the room']; delete groups['Premium · coming soon'];
    } else if (tab === 'records') {
      for (const a of ALBUM_CATALOG) {
        const st = albumStatus(a);
        const i = handlers.push(() => addAlbum(a)) - 1;
        const base = { icon: a.icon, name: a.title, desc: `${a.genre}. ${a.desc}`, status: st };
        if (st === 'shelf') albumGroups['On the shelf'].push(card({ ...base, label: '✓ On the shelf' }));
        else if (st === 'available') albumGroups['Add to the shelf'].push(card({ ...base, label: 'Add to shelf', action: i, note: 'Guy can put it on the stereo once he knows how to use it.' }));
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
        else { const i = handlers.push(() => addRoom(r)) - 1; roomGroups['Add a room'].push(card({ ...base, label: 'Add to my home', action: i, note: 'Puts a door on a wall. Anything in the way goes back to the Catalogue.' })); }
      }
    } else {
      for (const b of BOOK_CATALOG.filter(live)) {
        const st = bookStatus(b);
        const i = handlers.push(() => addBook(b)) - 1;
        const base = { icon: '📕', name: b.title, desc: b.desc, status: st };
        const reqName = b.requires && b.requires.object ? (OBJECT_CATALOG.find((d) => d.id === b.requires.object) || {}).name : '';
        if (st === 'shelf') bookGroups['On the shelf'].push(card({ ...base, label: '✓ On the shelf' }));
        else if (st === 'available') bookGroups['Add to the shelf'].push(card({ ...base, label: 'Add to shelf', action: i }));
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
