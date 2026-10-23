// Extra rooms the user can add from the Catalogue's Rooms tab. Adding one puts a door on a wall of Guy's room (clearing the
// wall of whatever is in the way) and builds the room behind it.
//
// A room is "added" once the user adds it, and "unlocked" when it is free or paid for. Things that belong to a room (catalogue
// entries with `room: '<id>'`) are listed only while the room is added and unlocked: see `isLive`.
import { OBJECT_CATALOG } from './machine.js';
import { dev } from './devunlock.js';

export const ROOM_CATALOG = [
  // `size` ({ w: depth away from the door, d: width along the wall }) is optional: left out, a room is as big as Guy's room.
  { id: 'workshop', name: 'Workshop', icon: '🛠️', unlocked: true, doorWalls: ['right', 'front', 'back'],
    desc: 'A place to build things. Adds a door to your room.',
    look: { frame: 0x6b4a2b, door: 0xb5532f, panel: 0xc9683f, floor: 0x8c9096, wall: 0xb4b8bd } },
  // The Restaurant: a kitchen, a cash register and dining tables, with an elevator the customers arrive in. A premium room: listed
  // as locked in the Rooms tab (`premium: true`) until it is unlocked (`setUnlocked`; there is no way to pay yet).
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️', unlocked: false, premium: true, doorWalls: ['front', 'back', 'right'], elevator: true,
    desc: 'A kitchen and dining room. Customers arrive by elevator and Guy cooks and serves.',
    look: { frame: 0x6b4a2b, door: 0x2f6f8f, panel: 0x3d86a8, floor: 0xb98a55, wall: 0xeadbc0 } },
];

const KEY = 'guy.rooms.v1';

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
    .map(([id, s]) => [id, { added: true, wall: s.wall, u: s.u, ...(s.unlocked !== undefined ? { unlocked: s.unlocked } : {}) }])) });
  const save = () => {
    if (!persist) return;
    try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch { /* no storage */ }
  };
  const changed = () => { save(); refit(); listeners.forEach((f) => f()); };

  // Take the pieces in a door's way out of the room (they go to the Catalogue, like any removal) and build the door.
  function place(r, wall, u) {
    const b = world.doorBlockers(wall, u);
    if (b.fixed) return null;
    for (const name of b.hit) remove(name);
    world.addDoor(r, wall, u);
    state[r.id] = { ...(state[r.id] || {}), id: r.id, added: true, wall, u };
    return b.hit;
  }

  // Add a room. opts.at = { wall, u } pins the door (used when a saved room is restored); opts.walls limits the walls tried.
  function add(id, opts = {}) {
    const r = def(id);
    if (!r) return { ok: false, messages: ['That room is not available.'] };
    if (!unlocked(id)) return { ok: false, messages: ['That room is not ready yet.'] };
    if (added(id)) return { ok: false, already: true, messages: [`The ${r.name} is already part of your home.`] };
    const spot = opts.at || world.planDoor(opts.walls || r.doorWalls);
    const hit = spot ? place(r, spot.wall, spot.u) : null;
    if (!spot || !hit) return { ok: false, messages: ['No clear wall for a door right now. Try moving something.'] };
    changed();
    const messages = [`${r.name} added! There is a new door.`];
    if (hit.length === 1) messages.push(`Moved the ${label(hit[0])} to make space for the door.`);
    else if (hit.length > 1) messages.push(`Moved ${hit.length} things to make space. Find them in the Catalogue.`);
    return { ok: true, wall: spot.wall, u: spot.u, displaced: hit, messages };
  }

  // Bring back the rooms saved earlier (before the Catalogue's extras, so the door strip is already clear for them).
  function restoreFrom(data) {
    const out = [];
    for (const [id, s] of Object.entries((data && data.rooms) || {})) {
      const r = def(id);
      if (!r || !s.added) continue;
      if (s.unlocked !== undefined) state[id] = { ...(state[id] || {}), id, unlocked: s.unlocked };
      const res = add(id, { at: { wall: s.wall, u: s.u } });
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

  // Test aids: take a room away again, or lock / unlock it, without going through the Catalogue.
  function reset(id) {
    const d = world.doors[id], b = d && d.shell.bounds;
    const inRoom = (x, z) => !!b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
    for (const [name, o] of Object.entries(world.objects)) if (inRoom(o.x, o.z)) { remove(name); delete world.removed[name]; }     // its furniture goes with it
    for (const [name, o] of Object.entries(world.removed)) if (!o.decor && o.home && inRoom(o.home.x, o.home.z)) delete world.removed[name];   // and what was put away from it
    world.removeDoor(id);
    delete state[id];
    changed();
  }
  function setUnlocked(id, value) {
    state[id] = { ...(state[id] || {}), id, unlocked: value };
    changed();
  }

  return {
    catalog: ROOM_CATALOG, def, add, restore, restoreFrom, snapshot, reset, setUnlocked,
    isAdded: added, isUnlocked: unlocked,
    // a catalogue entry is listed when it has no room, or its room is added and unlocked
    isLive: (roomId) => !roomId || (added(roomId) && unlocked(roomId)),
    onChange: (f) => listeners.push(f),
  };
}
