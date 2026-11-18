// Extra rooms the user can add from the Catalog's Rooms tab. Adding one puts a door on a wall of GUY's room (clearing the
// wall of whatever is in the way) and builds the room behind it.
//
// A room is "added" once the user adds it, and "unlocked" when it is free or paid for. Things that belong to a room (catalog
// entries with `room: '<id>'`) are listed only while the room is added and unlocked: see `isLive`.
import { OBJECT_CATALOG } from './machine.js';
import { dev } from './devunlock.js';

export const ROOM_CATALOG = [
  // `size` ({ w: depth away from the door, d: width along the wall }) is optional: left out (either part), a room is as deep as GUY's room
  // and as wide as the wall its door is in, like every other room.
  { id: 'workshop', name: 'Workshop', icon: '🛠️', unlocked: true, doorWalls: ['right', 'front', 'back', 'left'],
    desc: 'A place to build things. Adds a door to your room.',
    look: { frame: 0x6b4a2b, door: 0xb5532f, panel: 0xc9683f, floor: 0x8c9096, wall: 0xb4b8bd } },
  // The Restaurant: a kitchen, a cash register and dining tables, with an elevator the customers arrive in. A premium room: listed
  // as locked in the Rooms tab (`premium: true`) until it is unlocked (`setUnlocked`; there is no way to pay yet).
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️', unlocked: false, premium: true, doorWalls: ['front', 'back', 'right'], elevator: true,
    desc: 'A kitchen and dining room. Customers arrive by elevator and GUY cooks and serves.',
    look: { frame: 0x6b4a2b, door: 0x2f6f8f, panel: 0x3d86a8, floor: 0xb98a55, wall: 0xeadbc0 } },
  // The Backyard: an open-air room (grass, a fence, no ceiling) with a goal, a hoop, a lawn chair, a bird bath and a switch for day and night.
  { id: 'backyard', name: 'Backyard', icon: '🌳', unlocked: true, outdoor: true, doorWalls: ['right', 'front', 'back', 'left'],
    desc: 'An outdoor room with a lawn and a fence. Soccer, basketball, a lawn chair, a bird bath, and an artificial sun and moon you can switch.',
    look: { frame: 0x6b4a2b, door: 0x6f9f4a, panel: 0x8cc063, floor: 0x5fa046, wall: 0xb48a58 } },
  // The Shooting Range: three lanes with holographic bullseyes and enemies. GUY and GAL shoot from their own lanes (src/rangeobjects.js,
  // src/rangebrain.js). Deeper than a room's default, so the lanes have room to shoot down; as wide as the other rooms.
  { id: 'range', name: 'Shooting Range', icon: '🎯', unlocked: true, shootingRange: true, size: { w: 10 }, doorWalls: ['right', 'front', 'back', 'left'],
    desc: 'A shooting range with three lanes. Holographic bullseyes and enemies pop up down the range, and the robots take shots at them: from their own lane, and across the screens when the line is clear.',
    look: { frame: 0x3b4150, door: 0x3d4a63, panel: 0x5ef2ff, floor: 0x9a9fa6, wall: 0xc9ccd2 } },
  // The Bowling Alley: three lanes with ten pins each, ball returns, a rack of house balls and a scoreboard (src/bowlobjects.js, src/bowlbrain.js,
  // rules and physics in src/bowlrules.js). Same size as the Range.
  { id: 'bowling', name: 'Bowling Alley', icon: '🎳', unlocked: true, bowlingAlley: true, size: { w: 10 }, doorWalls: ['right', 'front', 'back', 'left'],
    desc: 'A bowling alley with three lanes. The robots roll balls at ten pins, keep score on the board, and set the pins up again by hand (or with an Automatic Pinsetter, if the Metal Factory can build one).',
    look: { frame: 0x3a2a55, door: 0x6a2a7a, panel: 0xff3fa4, floor: 0x1c1745, wall: 0x2b2a4a } },
  // Corner rooms: empty rooms for whatever the user wants to put in them (the Catalog's Rooms list, and every piece of furniture can be moved
  // in). A corner has no wall of GUY's room to put a door in, so it opens through the side wall of the room beside it: the Workshop, or another
  // room with one. `corner: true` rooms are put in the first free corner (`corners`) that has such a neighbour: see world.planCorner.
  { id: 'library', name: 'Library', icon: '📚', unlocked: true, corner: true, doorWalls: [], corners: ['right-back', 'right-front', 'left-back', 'left-front'],
    desc: 'A quiet room in a corner of your home, reached through the room beside it.',
    look: { frame: 0x5a3b22, door: 0x7a3b2e, panel: 0x93503f, floor: 0x9b7653, wall: 0xcdbfa6 } },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️', unlocked: true, corner: true, doorWalls: [], corners: ['right-front', 'right-back', 'left-front', 'left-back'],
    desc: 'A cosy room in a corner of your home, reached through the room beside it.',
    look: { frame: 0x6b4a2b, door: 0x5b6fa8, panel: 0x7b8fc8, floor: 0xb9a58a, wall: 0xd9cfe3 } },
  { id: 'garage', name: 'Garage', icon: '🚗', unlocked: true, corner: true, doorWalls: [], corners: ['left-back', 'left-front', 'right-back', 'right-front'],
    desc: 'A roomy garage in a corner of your home, reached through the room beside it.',
    look: { frame: 0x4a4f57, door: 0x8a8f98, panel: 0xa6abb3, floor: 0x7d8186, wall: 0xb9bcc1 } },
  { id: 'gameroom', name: 'Game Room', icon: '🎮', unlocked: true, corner: true, doorWalls: [], corners: ['left-front', 'left-back', 'right-front', 'right-back'],
    desc: 'A room for fun in a corner of your home, reached through the room beside it.',
    look: { frame: 0x3b3f66, door: 0x6a3fa0, panel: 0x8a5fc8, floor: 0x55587a, wall: 0xaab0d6 } },
];

const KEY = 'guy.rooms.v1';
const WALL_ORDER = ['right', 'front', 'back', 'left'];

export function initRooms({ world, remove, persist, refit, robots = () => [] }) {
  const state = {};                  // room id -> { added, wall, u, unlocked? }
  const closing = {};                // room id -> { ids, asked } while a room the user removed waits for the robots to walk out of it
  const listeners = [];
  const def = (id) => ROOM_CATALOG.find((r) => r.id === id);
  const unlocked = (id) => { if (dev.all && (def(id) || {}).premium) return true; const s = state[id]; return s && s.unlocked !== undefined ? s.unlocked : !!(def(id) || {}).unlocked; };
  const added = (id) => !!(state[id] && state[id].added && world.doors[id]);
  const label = (name) => {
    const o = world.objects[name] || world.decor[name] || world.removed[name];
    const cat = OBJECT_CATALOG.find((d) => d.id === name);
    return (cat && cat.name) || (o && o.label) || name;
  };

  const snapshot = () => ({ rooms: Object.fromEntries(Object.entries(state).filter(([id, s]) => s.added && world.doors[id] && !closing[id])
    .map(([id, s]) => [id, { added: true, wall: s.wall, u: s.u, ...(s.parent && s.parent !== 'main' ? { parent: s.parent, corner: s.corner } : {}), ...(s.unlocked !== undefined ? { unlocked: s.unlocked } : {}), ...(s.doorLocked ? { doorLocked: true } : {}) }])) });
  const save = () => {
    if (!persist) return;
    try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch { /* no storage */ }
  };
  const changed = () => { save(); refit(); listeners.forEach((f) => f()); };

  // Take the pieces in a door's way out of the room (they go to the Catalog, like any removal) and build the door.
  function place(r, wall, u, corner = null) {
    const b = world.doorBlockers(wall, u);
    if (b.fixed) return null;
    for (const name of b.hit) remove(name);
    world.addDoor(r, wall, u, corner ? { parent: corner.parent, cell: corner.cell } : {});
    state[r.id] = { ...(state[r.id] || {}), id: r.id, added: true, wall, u, ...(corner ? { parent: corner.parent, corner: corner.corner } : {}) };
    world.setDoorLocked(r.id, !!state[r.id].doorLocked);             // (a saved room comes back locked if it was)
    return b.hit;
  }

  // Add a room. opts.at = { wall, u } pins the door (used when a saved room is restored); opts.walls limits the walls tried.
  function add(id, opts = {}) {
    const r = def(id);
    if (!r) return { ok: false, messages: ['That room is not available.'] };
    if (!unlocked(id)) return { ok: false, messages: ['That room is not ready yet.'] };
    if (added(id)) return { ok: false, already: true, messages: [`The ${r.name} is already part of your home.`] };
    if (r.corner && !(opts.at && !opts.at.corner)) return addCorner(r, opts);       // (a corner room saved on a wall of GUY's room comes back there)
    return addOnWall(r, opts);
  }

  // A room with a door on a wall of GUY's room. A corner room with nowhere in a corner ends up here too: no room needs another one.
  function addOnWall(r, opts) {
    const spot = opts.at || world.planDoor(opts.walls || (r.doorWalls && r.doorWalls.length ? r.doorWalls : WALL_ORDER));
    const hit = spot ? place(r, spot.wall, spot.u) : null;
    if (!spot || !hit) return { ok: false, messages: ['No clear wall for a door right now. Try moving something.'] };
    changed();
    const messages = [`${r.name} added! There is a new door.`];
    if (hit.length === 1) messages.push(`Moved the ${label(hit[0])} to make space for the door.`);
    else if (hit.length > 1) messages.push(`Moved ${hit.length} things to make space. Find them in the Catalog.`);
    return { ok: true, wall: spot.wall, u: spot.u, displaced: hit, messages };
  }

  // A corner room: a free corner with a room beside it that can have a door (opts.at: the corner and door it had when it was saved).
  function addCorner(r, opts) {
    let spot = null;
    if (opts.at && opts.at.corner) {
      const cell = world.cornerCell(opts.at.corner);
      if (world.doors[opts.at.parent]) spot = { wall: opts.at.wall, u: opts.at.u, parent: opts.at.parent, corner: opts.at.corner, cell };
    } else {
      const plan = world.planCorner(opts.corners || r.corners);
      if (plan.none) return addOnWall(r, {});             // no corner with a room beside it: an ordinary door on GUY's room, nothing else needed
      spot = plan;
    }
    const hit = spot ? place(r, spot.wall, spot.u, spot) : null;
    if (!spot || !hit) return { ok: false, messages: ['No clear wall for a door right now. Try moving something.'] };
    changed();
    const messages = [`${r.name} added! There is a new door in the ${world.doors[spot.parent].name}.`];
    if (hit.length === 1) messages.push(`Moved the ${label(hit[0])} to make space for the door.`);
    else if (hit.length > 1) messages.push(`Moved ${hit.length} things to make space. Find them in the Catalog.`);
    return { ok: true, wall: spot.wall, u: spot.u, parent: spot.parent, corner: spot.corner, displaced: hit, messages };
  }

  // Bring back the rooms saved earlier (before the Catalog's extras, so the door strip is already clear for them).
  function restoreFrom(data) {
    const out = [];
    // (a corner room opens into the room beside it: that one comes back first)
    const entries = Object.entries((data && data.rooms) || {}).sort(([, a], [, b]) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0));
    for (const [id, s] of entries) {
      const r = def(id);
      if (!r || !s.added) continue;
      if (s.unlocked !== undefined) state[id] = { ...(state[id] || {}), id, unlocked: s.unlocked };
      if (s.doorLocked) state[id] = { ...(state[id] || {}), id, doorLocked: true };
      const res = add(id, { at: { wall: s.wall, u: s.u, ...(s.parent ? { parent: s.parent, corner: s.corner } : {}) } });
      out.push({ id, ok: res.ok || !!res.already, displaced: res.displaced || [] });
      if (!res.ok && !res.already) {                       // the saved spot is taken by something fixed: find a new one
        const again = add(id);
        out.push({ id, ok: again.ok, moved: true });
      }
    }
    return out;
  }
  function restore() {
    if (!persist) return [];
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    return restoreFrom(data);
  }

  // ---- Taking a room away (the Catalog's Rooms tab) ----
  // A room goes with the corner rooms that open into it. Its furniture goes back to the Catalog (something GUY built goes into storage),
  // what hung on its walls is put away, and nothing is lost: add the room again and put the pieces back. A robot in there walks out
  // first (nobody is moved by magic): until then its doors count as locked from outside, and the room goes the moment they are out.
  const family = (id) => [id, ...Object.values(world.doors).filter((k) => k.parent === id).flatMap((k) => family(k.id))];
  // (in the doorway counts as in: the wall closes up where the door was, and he must be clear of it, on either side)
  const near = (p, i) => { const q = world.doorPoint(i, 0); return Math.hypot(q.x - p.x, q.z - p.z) < 0.6; };
  const robotsIn = (ids) => robots().filter((b) => {
    const p = b.g.root.position;
    return ids.includes(world.roomIdAt(p.x, p.z)) || ids.some((i) => near(p, i));
  });
  const robotName = (b) => (b.isGal ? 'GAL' : 'GUY');
  function drop(ids) {
    for (const i of [...ids].reverse()) {                  // (the corner rooms first: their doors are in its walls)
      const d = world.doors[i], b = d && d.shell.bounds;
      if (!d) continue;
      const inRoom = (x, z) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
      for (const [name, o] of Object.entries(world.objects)) if (inRoom(o.x, o.z)) remove(name);       // to the Catalog (or storage), not lost
      world.removeDoor(i);
      delete state[i];
      delete closing[i];
    }
    changed();
  }
  function removeRoom(id) {
    const r = def(id);
    if (!r || !added(id)) return { ok: false, messages: ['That room is not part of your home.'] };
    if (closing[id]) return { ok: true, waiting: true, messages: [`The ${r.name} goes as soon as everybody is out of it.`] };
    const ids = family(id), names = ids.slice(1).map((i) => world.doors[i].name);
    const also = names.length ? ` The ${names.join(' and the ')} went with it.` : '';
    const inside = robotsIn(ids);
    if (!inside.length) {
      drop(ids);
      return { ok: true, removed: ids, messages: [`${r.name} removed.${also} Its furniture is back in the Catalog.`] };
    }
    for (const i of ids) {                                 // nobody goes in now, and a locked door would keep them in: unlock it
      world.doors[i].closing = true;
      if (state[i] && state[i].doorLocked) { state[i].doorLocked = false; world.setDoorLocked(i, false); }
    }
    closing[id] = { ids, asked: new Map() };
    changed();
    tick();
    const who = inside.map(robotName).join(' and ');
    return { ok: true, waiting: true, messages: [`${who} ${inside.length > 1 ? 'are' : 'is'} coming out of the ${r.name} first. It goes as soon as nobody is in it.`] };
  }
  // Called every frame (and by window.sim): ask whoever is still in a closing room to come out, and take the room away once it is empty.
  let since = 0;
  function tick(dt = 0) {
    since += dt;
    for (const [id, c] of Object.entries(closing)) {
      const ids = c.ids.filter((i) => world.doors[i]);
      if (!world.doors[id]) { delete closing[id]; continue; }
      const inside = robotsIn(ids);
      if (!inside.length) { drop(ids); continue; }
      for (const b of inside) {                            // (asked again when he has come out of one room into another of them, or got sidetracked)
        const p = b.g.root.position, here = world.roomIdAt(p.x, p.z), last = c.asked.get(b);
        if (!ids.includes(here)) continue;                 // (in the doorway: on his way out)
        if (last && last.here === here && since - last.t < 12) continue;
        c.asked.set(b, { here, t: since });
        b.visitRoom(ids.includes(here) ? here : id);
      }
    }
  }

  // Test aids: take a room away again, or lock / unlock it, without going through the Catalog.
  function reset(id) {
    for (const k of Object.values(world.doors)) if (k.parent === id) reset(k.id);          // the rooms that open into it go first
    const d = world.doors[id], b = d && d.shell.bounds;
    const inRoom = (x, z) => !!b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
    for (const [name, o] of Object.entries(world.objects)) if (inRoom(o.x, o.z)) { remove(name); delete world.removed[name]; }     // its furniture goes with it
    for (const [name, o] of Object.entries(world.removed)) if (!o.decor && o.home && inRoom(o.home.x, o.home.z)) delete world.removed[name];   // and what was put away from it
    world.removeDoor(id);
    delete state[id];
    delete closing[id];
    changed();
  }
  // Lock or unlock a room's door (long-press the door): while it is locked the robots stay out of the room. Saved with the rooms.
  function setDoorLocked(id, value) {
    if (!added(id)) return false;
    state[id] = { ...(state[id] || {}), id, doorLocked: !!value };
    world.setDoorLocked(id, !!value);
    changed();
    return true;
  }
  function setUnlocked(id, value) {
    state[id] = { ...(state[id] || {}), id, unlocked: value };
    changed();
  }

  return {
    catalog: ROOM_CATALOG, def, add, remove: removeRoom, tick,
    corners: (id) => (added(id) ? family(id).slice(1).map((i) => world.doors[i].name) : []),     // the rooms that would go with it
    isClosing: (id) => !!closing[id], restore, restoreFrom, snapshot, reset, setUnlocked, setDoorLocked,
    isAdded: added, isUnlocked: unlocked, isDoorLocked: (id) => added(id) && !!(state[id] && state[id].doorLocked),
    // a catalog entry is listed when it has no room, or its room is added and unlocked
    isLive: (roomId) => !roomId || (added(roomId) && unlocked(roomId)),
    onChange: (f) => listeners.push(f),
  };
}
