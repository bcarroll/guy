// Extra rooms the user can add from the Catalog's Rooms tab. Adding one puts a door on a wall of GUY's room (clearing the
// wall of whatever is in the way) and builds the room behind it.
//
// A room is "added" once the user adds it, and "unlocked" when it is free or paid for. Things that belong to a room (catalog
// entries with `room: '<id>'`) are listed only while the room is added and unlocked: see `isLive`.
import { OBJECT_CATALOG } from './machine.js';
import { dev } from './devunlock.js';

export const ROOM_CATALOG = [
  // `size` ({ w: depth away from the door, d: width along the wall }) is optional: left out, a room is as big as GUY's room.
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
  // src/rangebrain.js). Deeper than a room's default, so the lanes have room to shoot down.
  { id: 'range', name: 'Shooting Range', icon: '🎯', unlocked: true, shootingRange: true, size: { w: 10, d: 8 }, doorWalls: ['right', 'front', 'back', 'left'],
    desc: 'A shooting range with three lanes. Holographic bullseyes and enemies pop up down the range, and the robots take shots at them: from their own lane, and across the screens when the line is clear.',
    look: { frame: 0x3b4150, door: 0x3d4a63, panel: 0x5ef2ff, floor: 0x9a9fa6, wall: 0xc9ccd2 } },
  // The Bowling Alley: three lanes with ten pins each, ball returns, a rack of house balls and a scoreboard (src/bowlobjects.js, src/bowlbrain.js,
  // rules and physics in src/bowlrules.js). Same size as the Range.
  { id: 'bowling', name: 'Bowling Alley', icon: '🎳', unlocked: true, bowlingAlley: true, size: { w: 10, d: 8 }, doorWalls: ['right', 'front', 'back', 'left'],
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

export function initRooms({ world, remove, persist, refit }) {
  const state = {};                  // room id -> { added, wall, u, unlocked? }
  const listeners = [];
  const def = (id) => ROOM_CATALOG.find((r) => r.id === id);
  const unlocked = (id) => { if (dev.all && (def(id) || {}).premium) return true; const s = state[id]; return s && s.unlocked !== undefined ? s.unlocked : !!(def(id) || {}).unlocked; };
  const added = (id) => !!(state[id] && state[id].added && world.doors[id]);
  const label = (name) => {
    const o = world.objects[name] || world.decor[name] || world.removed[name];
    const cat = OBJECT_CATALOG.find((d) => d.id === name);
    return (cat && cat.name) || (o && o.label) || name;
  };

  const snapshot = () => ({ rooms: Object.fromEntries(Object.entries(state).filter(([id, s]) => s.added && world.doors[id])
    
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

  // Test aids: take a room away again, or lock / unlock it, without going through the Catalog.
  function reset(id) {
    for (const k of Object.values(world.doors)) if (k.parent === id) reset(k.id);          // the rooms that open into it go first
    const d = world.doors[id], b = d && d.shell.bounds;
    const inRoom = (x, z) => !!b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
    for (const [name, o] of Object.entries(world.objects)) if (inRoom(o.x, o.z)) { remove(name); delete world.removed[name]; }     // its furniture goes with it
    for (const [name, o] of Object.entries(world.removed)) if (!o.decor && o.home && inRoom(o.home.x, o.home.z)) delete world.removed[name];   // and what was put away from it
    world.removeDoor(id);
    delete state[id];
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
    catalog: ROOM_CATALOG, def, add, restore, restoreFrom, snapshot, reset, setUnlocked, setDoorLocked,
    isAdded: added, isUnlocked: unlocked, isDoorLocked: (id) => added(id) && !!(state[id] && state[id].doorLocked),
    // a catalog entry is listed when it has no room, or its room is added and unlocked
    isLive: (roomId) => !roomId || (added(roomId) && unlocked(roomId)),
    onChange: (f) => listeners.push(f),
  };
}
