// Remembers where everything is between visits: every piece of furniture and wall piece (position and quarter turns), the
// telescope's aim, the ball, and which objects the user took out. A visit that starts after a reload (or after an update is
// deployed and the page refreshes itself, see update.js) puts it all back the way it was.
//
// What is saved is a snapshot of the world: it is written a few seconds after anything changes and whenever the tab is hidden or
// closed. Restoring sets every piece straight to its saved spot (the saved layout was valid as a whole), then checks each piece
// and moves any that no longer fits (a corrupt save, or a door that now stands where it was) to the nearest free place.
// Everything else GUY remembers is saved elsewhere: skills (skills.js), the catalog's additions (machine.js), rooms (rooms.js).
import { RECIPES, STORAGE_CAP } from './workshop.js';

const KEY = 'guy.layout.v1';
const VERSION = 2;                                   // 2: every room is the same 10 m square (GUY's room was 10 x 8: see fromV1)

const num = (n) => typeof n === 'number' && Number.isFinite(n);
const r2 = (n) => Math.round(n * 100) / 100;

export function initLayout({ world, guy, remove, persist, key = KEY }) {
  let last = null;                                   // the JSON last written, so an unchanged world is not written again

  function snapshot() {
    const objects = {}, decor = {};
    for (const [name, o] of Object.entries(world.objects)) {
      objects[name] = { x: r2(o.x), z: r2(o.z), rot: o.rot };
      if (o.lane !== undefined) objects[name].lane = o.lane;        // a set of maple pins that stands on a lane of the Bowling Alley
      if (o.aim) objects[name].aim = { yaw: r2(o.aim.yaw), pitch: r2(o.aim.pitch) };      // the telescope tube
    }
    for (const [name, d] of Object.entries(world.decor)) decor[name] = { u: r2(d.u), v: r2(d.v), rot: d.rot };
    return {
      v: VERSION, objects, decor,
      instances: Object.values(world.objects).filter((o) => o.kind).map((o) => ({ name: o.name, kind: o.kind })),
      out: Object.keys(world.removed),               // taken out of the room (by the user, or to make way for a door)
      sky: world.yard ? world.yard.isNight() : false,         // the Backyard's day / night switch
      stowed: world.yard ? world.yard.stowedKeys() : [],       // what is put away in the shed
      ball: world.ballGone ? null : { x: r2(world.ball.position.x), z: r2(world.ball.position.z) },
      stock: { items: { ...world.stock.items }, coins: world.stock.coins || 0 },      // what the Workshop has made
    };
  }

  // A layout saved when GUY's room was 8 m deep (walls at z = -4 and 4; now -5 and 5). What stood by the back or front wall, or in a room beyond
  // it, moves the metre that the wall moved, so it is still by that wall (and still in that room); everything else stays where it is.
  function fromV1(data) {
    const grow = (z, half) => (num(z) && Math.abs(z) + half > 3.4 ? r2(z + Math.sign(z)) : z);
    const objects = {}, decor = {};
    for (const [name, p] of Object.entries(data.objects || {})) {
      const o = world.objects[name], turned = p && (Math.round(p.rot) || 0) % 2;
      objects[name] = p && { ...p, z: grow(p.z, o ? (turned ? o.bw : o.bd) / 2 : 0.3) };
    }
    for (const [name, p] of Object.entries(data.decor || {})) {
      const d = world.decor[name];
      decor[name] = p && d && !d.wall ? { ...p, v: grow(p.v, (Math.round(p.rot) || 0) % 2 ? d.hx : d.hz) } : p;
    }
    return { ...data, v: VERSION, objects, decor, ball: data.ball ? { ...data.ball, z: grow(data.ball.z, 0.18) } : data.ball };
  }

  // Put the saved layout back. Returns what it did (for the QA harness); junk or an old format does nothing.
  function apply(data) {
    const did = { applied: false, removed: [], replaced: [], guyMoved: false };
    if (!data || typeof data !== 'object' || (data.v !== VERSION && data.v !== 1)) return did;
    did.applied = true;
    for (const it of Array.isArray(data.instances) ? data.instances : []) {                  // things GUY built that were in the room
      if (it && typeof it.name === 'string' && typeof it.kind === 'string' && !world.objects[it.name]) world.addInstance(it.kind, null, it.name, true);
    }
    for (const name of Array.isArray(data.out) ? data.out : []) {
      if (typeof name === 'string' && (world.objects[name] || world.decor[name])) { remove(name); did.removed.push(name); }
    }
    if (data.v === 1) data = fromV1(data);           // (the things GUY built are there now: how big a piece is says whether it stood by a wall)
    for (const [name, p] of Object.entries(data.objects || {})) {
      const o = world.objects[name];
      if (!o || !p || !num(p.x) || !num(p.z)) continue;
      o.rot = ((Math.round(p.rot) || 0) % 4 + 4) % 4;
      o.set(p.x, p.z);
      o.group.rotation.y = o.yaw;                    // no spinning round on the first frame
      if (o.setAim && p.aim && num(p.aim.yaw) && num(p.aim.pitch)) o.setAim(p.aim.yaw, p.aim.pitch);
    }
    for (const [name, p] of Object.entries(data.decor || {})) {
      const d = world.decor[name];
      if (!d || !p || !num(p.u) || !num(p.v)) continue;
      d.rot = ((Math.round(p.rot) || 0) % 4 + 4) % 4;
      d.set(p.u, p.v);
    }
    // every piece must still fit: furniture inside the room and clear of the others, wall pieces clear of each other and the door
    for (const [name, o] of Object.entries(world.objects)) {
      const at = (data.objects || {})[name];
      if (at && num(at.lane) && world.rackPins(name, at.lane)) continue;      // (on its lane)
      if (o.lane !== undefined) continue;
      if (world.fits(o, o.x, o.z)) continue;
      const spot = world.findSpot(o, { x: o.x, z: o.z }, null);
      if (spot) { o.set(spot.x, spot.z); did.replaced.push(name); }
    }
    for (const [name, d] of Object.entries(world.decor)) {
      if (world.decorFits(d, d.u, d.v)) continue;
      const spot = d.wall ? world.findWallSpot(d) : null;
      if (spot) { d.set(spot.u, spot.v); did.replaced.push(name); }
    }
    const b = data.ball;
    if (b === null && !world.ballGone) { remove('ball'); did.removed.push('ball'); }
    else if (b && num(b.x) && num(b.z) && !world.ballGone && !world.obstacles.some((o) => b.x > o.x0 - 0.5 && b.x < o.x1 + 0.5 && b.z > o.z0 - 0.5 && b.z < o.z1 + 0.5)
      && Math.abs(b.x) < 4.5 && Math.abs(b.z) < 4.5) {
      world.ball.position.set(b.x, 0.18, b.z);
      world.ball.userData.vel.set(0, 0, 0);
    }
    if (typeof data.sky === 'boolean' && world.yard) world.yard.snapNight(data.sky);
    if (Array.isArray(data.stowed) && world.yard) world.yard.setStowed(data.stowed.filter((k) => typeof k === 'string'));
    const st = data.stock;
    if (st && typeof st === 'object') {
      world.stock.coins = num(st.coins) ? Math.max(0, Math.min(999999, Math.round(st.coins))) : 0;
      world.stock.items = {};
      // the Workshop's rules apply to what was saved too: only things it still builds are kept (the old non-interactive shelves go), and
      // storage never holds more of a kind than it would ever make (an old save with 13 foot stools keeps one)
      for (const [k, v] of Object.entries(st.items && typeof st.items === 'object' ? st.items : {})) {
        const rec = Object.values(RECIPES).find((r) => r.object === k);
        if (!rec || !num(v) || v <= 0) continue;
        world.stock.items[k] = Math.min(STORAGE_CAP, Math.round(v), rec.cap);
      }
      world.syncStock();
    }
    did.guyMoved = unstickGuy();
    return did;
  }

  // GUY starts in the middle of the floor. If the saved layout has something there, stand him on the nearest free spot.
  function unstickGuy() {
    if (!guy) return false;
    const clear = (x, z) => !world.obstacles.some((o) => x > o.x0 - 0.45 && x < o.x1 + 0.45 && z > o.z0 - 0.45 && z < o.z1 + 0.45);
    const p = guy.root.position;
    if (clear(p.x, p.z)) return false;
    for (let r = 0.25; r < 6; r += 0.25) {
      for (let i = 0; i < 16; i++) {
        const x = p.x + Math.cos((i / 16) * Math.PI * 2) * r, z = p.z + Math.sin((i / 16) * Math.PI * 2) * r;
        if (Math.abs(x) < 4.4 && z > -4.4 && z < 4.4 && clear(x, z)) { p.set(x, 0, z); return true; }
      }
    }
    return false;
  }

  // Write the snapshot if it changed (or `force`). False when nothing was written.
  function save(force) {
    if (!persist) return false;
    let s;
    try { s = JSON.stringify(snapshot()); } catch { return false; }
    if (s === last && !force) return false;
    try { localStorage.setItem(key, s); last = s; return true; } catch { return false; }     // no storage: carry on without
  }

  function restore() {
    if (!persist) return { applied: false };
    let data = null;
    try { data = JSON.parse(localStorage.getItem(key)); } catch { data = null; }
    const did = apply(data);
    last = did.applied ? JSON.stringify(snapshot()) : null;
    return did;
  }

  // Start saving: every few seconds if anything changed (GUY pushes things around too), and the moment the tab is hidden or closed.
  function start() {
    if (!persist) return;
    setInterval(save, 3000);
    addEventListener('pagehide', () => save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    window.__guySave = () => save(true);             // update.js flushes it just before it reloads the page
  }

  return { snapshot, apply, save, restore, start, unstickGuy, key };
}
