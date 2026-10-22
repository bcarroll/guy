// The Skill Machine's catalogue: what can go in the room, and which books can go on the shelf.
//
// Objects come in four states:
//   inroom    already here
//   removed   was taken out by the user; can be put back
//   available free to add
//   locked    a future premium unlock (shown, but the button does nothing yet)
// Books: shelf (on the shelf), available, needs-object / needs-shelf (can't be added yet), locked.
import { BOOK_CATALOG } from './skills.js';
import { ALBUM_CATALOG } from './albums.js';

export const OBJECT_CATALOG = [
  { id: 'piano', name: 'Upright Piano', icon: '🎹', desc: 'Scales, tunes and jam sessions. Heavy: only you can move it.', core: true },
  { id: 'bench', name: 'Piano Bench', icon: '🪑', desc: 'Guy pulls this up to the piano.', core: true },
  { id: 'table', name: 'Stereo & Table', icon: '📻', desc: 'The boombox and the table it sits on.', core: true },
  { id: 'shelf', name: 'Bookshelf', icon: '📚', desc: 'Where the books live. Heavy: only you can move it.', core: true },
  { id: 'lamp', name: 'Floor Lamp', icon: '💡', desc: 'On and off, plus moods and light shows with the right book.', core: true },
  { id: 'armchair', name: 'Armchair', icon: '🛋️', desc: 'A comfortable place to read.', core: true },
  { id: 'plant', name: 'Potted Plant', icon: '🪴', desc: 'Makes the room feel lived in.', core: true },
  { id: 'ball', name: 'Red Ball', icon: '⚽', desc: 'Kick it, dribble it, toss it.', core: true, ball: true },
  { id: 'guitar', name: 'Acoustic Guitar', icon: '🎸', desc: 'On its stand. Comes with the book "Guitar for Beginners".', free: true, book: 'guitar' },
  { id: 'workbench', name: 'Workbench', icon: '🛠️', desc: 'Build furniture when the tools and materials are available.', locked: true },
  { id: 'drums', name: 'Drum Kit', icon: '🥁', desc: 'Kick, snare, hi-hat and cymbals on a stool. Comes with the book "Drumming for Robots".', free: true, book: 'drumming' },
  { id: 'easel', name: 'Painting Easel', icon: '🎨', desc: 'A canvas that really gets painted. Comes with the book "Painting for Robots".', free: true, book: 'painting' },
  { id: 'telescope', name: 'Telescope', icon: '🔭', desc: 'On a tripod by the window. Comes with the book "Stargazing for Robots".', free: true, book: 'stars' },
];

const KEY = 'guy.room.v1';

export function initMachine({ world, guy, persist, notify }) {
  const root = document.getElementById('machine');
  const body = root.querySelector('.body');
  let tab = 'objects';

  const objectStatus = (d) => {
    if (d.locked) return 'locked';
    if (d.ball) return world.ballGone ? 'removed' : 'inroom';
    if (world.objects[d.id]) return 'inroom';
    if (world.removed[d.id]) return 'removed';
    return 'available';
  };
  const hasObject = (id) => (id === 'ball' ? !world.ballGone : !!world.objects[id]);
  const shelf = () => world.objects.shelf;
  const albumStatus = (a) => {
    if (a.premium) return 'locked';
    if (shelf() && shelf().albums.some((r) => r.def.id === a.id)) return 'shelf';
    if (!shelf()) return 'needs-shelf';
    if (!hasObject('table')) return 'needs-object';          // the records are for the stereo
    return 'available';
  };
  const bookStatus = (b) => {
    if (b.locked) return 'locked';
    if (shelf() && shelf().books.some((r) => r.def.id === b.id)) return 'shelf';
    if (!shelf()) return 'needs-shelf';
    if (b.requires && b.requires.object && !hasObject(b.requires.object)) return 'needs-object';
    return 'available';
  };

  const save = () => {
    if (!persist) return;
    const extras = { objects: OBJECT_CATALOG.filter((d) => d.free && world.objects[d.id]).map((d) => d.id),
      books: shelf() ? shelf().books.filter((r) => !r.def.start).map((r) => r.def.id) : [],
      albums: shelf() ? shelf().albums.map((r) => r.def.id) : [] };
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
    for (const id of extras.books || []) { const def = BOOK_CATALOG.find((b) => b.id === id); if (def) addBookDef(def); }
    for (const id of extras.albums || []) { const def = ALBUM_CATALOG.find((a) => a.id === id); if (def && !def.premium) addAlbumDef(def); }
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

  function card({ icon, name, desc, status, label, action, note }) {
    const btn = action !== undefined
      ? `<button class="act" data-action="${action}">${label}</button>`
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
    const handlers = [];
    if (tab === 'objects') {
      for (const d of OBJECT_CATALOG) {
        const st = objectStatus(d);
        const i = handlers.push(() => addObject(d)) - 1;
        if (st === 'inroom') groups['In the room'].push(card({ icon: d.icon, name: d.name, desc: d.desc, status: st, label: '✓ In the room' }));
        else if (st === 'locked') groups['Premium · coming soon'].push(card({ icon: d.icon, name: d.name, desc: d.desc, status: st, label: '🔒 Locked' }));
        else groups['Add to the room'].push(card({ icon: d.icon, name: d.name, desc: d.desc, status: st, label: st === 'removed' ? 'Put back' : 'Add', action: i,
          note: st === 'removed' ? 'You removed this earlier.' : d.book ? 'Comes with its own book.' : '' }));
      }
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
    } else {
      for (const b of BOOK_CATALOG) {
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
    const use = tab === 'objects' ? groups : tab === 'records' ? albumGroups : bookGroups;
    body.innerHTML = Object.entries(use).filter(([, c]) => c.length).map(([h, c]) => `<h4>${h}</h4>${c.join('')}`).join('');
    body.querySelectorAll('[data-action]').forEach((el) => el.addEventListener('click', () => handlers[+el.dataset.action]()));
  }

  root.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; render(); }));
  const close = () => { root.hidden = true; };
  root.querySelector('.close').addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });

  return { open() { render(); root.hidden = false; }, close, refresh: render, restoreExtras, isOpen: () => !root.hidden };
}
