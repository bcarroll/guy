// The Backyard's balls and sky, kept in one place: `world.yard` (room.js creates it).
//
//   balls        { soccer, basketball }: a ball exists while its goal / hoop is in the room, and lies on the grass near it
//   launch(kind, target, T)   throw / kick a ball so it reaches a world point `target` in T seconds
//   roll(kind, dir, speed)    a gentle push along the grass (the poke of a robot who has not read the book)
//   setNight(bool) / isNight()  the artificial sun and moon (the Sky Switch and the robots both use these)
//   update(dt)   called every frame: eases the sky, adds / removes the balls, steps their physics
//   score        what the shots did: { goals, baskets, shots } (QA reads it)
//
// A ball GUY holds or is handling is `userData.kinematic` (brain.js sets its position every frame); otherwise it flies and rolls here.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { makeYardBall, YARD_BALL } from './yardobjects.js';

const G = 9.8;
const PAIRS = { soccer: 'soccergoal', basketball: 'basketballhoop' };
const BOUNCE = { soccer: 0.5, basketball: 0.72 };
// What the shed can hold: every movable thing in the yard (not the shed itself). A key is an object's name, or 'ball:<kind>' for a ball.
const STORE = [
  { key: 'soccergoal', label: 'Soccer goal', icon: '🥅' }, { key: 'basketballhoop', label: 'Basketball hoop', icon: '🏀' },
  { key: 'ball:soccer', label: 'Soccer ball', icon: '⚽' }, { key: 'ball:basketball', label: 'Basketball', icon: '🏀' },
  { key: 'lawnchair', label: 'Lawn chair', icon: '🪑' }, { key: 'birdbath', label: 'Bird bath', icon: '🐦' },
  { key: 'skyswitch', label: 'Sky switch', icon: '🌙' }, { key: 'mower', label: 'Lawn mower', icon: '🚜' },
];

export function makeYard({ world, room, objects, obstacles }) {
  const balls = {};
  let night = false;
  const score = { goals: 0, baskets: 0, shots: 0 };
  const door = () => world.doors.backyard || null;
  const bounds = () => { const d = door(); return d ? d.shell.bounds : null; };
  const inYard = (x, z) => { const b = bounds(); return !!b && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ; };

  function clearSpot(kind, obj) {
    const b = bounds();
    const r = YARD_BALL[kind].r;
    const free = (x, z) => !!b && x > b.minX + 0.6 && x < b.maxX - 0.6 && z > b.minZ + 0.6 && z < b.maxZ - 0.6
      && !obstacles.some((o) => o.active !== false && x > o.x0 - 0.4 && x < o.x1 + 0.4 && z > o.z0 - 0.4 && z < o.z1 + 0.4);
    for (const [dx, dz] of [[0, 1.5], [0.9, 1.5], [-0.9, 1.5], [0, 2.1], [1.4, 1.2], [-1.4, 1.2], [0, 2.8]]) {
      const l = obj.local(dx, dz), x = obj.x + l.x, z = obj.z + l.z;
      if (free(x, z)) return { x, z, r };
    }
    for (let i = 0; i < 80; i++) {
      const x = b.minX + 0.8 + Math.random() * (b.maxX - b.minX - 1.6), z = b.minZ + 0.8 + Math.random() * (b.maxZ - b.minZ - 1.6);
      if (free(x, z)) return { x, z, r };
    }
    return { x: obj.x, z: obj.z + 1.5, r };
  }

  // ---- the shed: things put away in it are hidden and stop being obstacles; taking one out puts it back on the grass
  const itemOf = (key) => (key.startsWith('ball:') ? balls[key.slice(5)] : objects[key]) || null;
  const isStowed = (key) => { const it = itemOf(key); return !!it && (key.startsWith('ball:') ? !!it.userData.stowed : !!it.stowed); };
  // where `key` would stand if it were taken out now: its old place if that is free, else the nearest free place to the shed door
  function spotFor(key) {
    const it = itemOf(key), shed = objects.shed;
    if (!it || !shed) return null;
    if (key.startsWith('ball:')) {
      const kind = key.slice(5), owner = objects[PAIRS[kind]];
      return clearSpot(kind, owner && !owner.stowed ? owner : shed);
    }
    const f = shed.local(0, 1.6), front = { x: shed.x + f.x, z: shed.z + f.z };
    const home = it.stowHome;
    if (home && world.fits(it, home.x, home.z)) return { x: home.x, z: home.z };
    return world.findSpot(it, front, null) || world.findSpot(it, { x: shed.x, z: shed.z }, null);
  }
  function stow(key) {
    const it = itemOf(key);
    if (!it || !objects.shed || isStowed(key) || key === 'shed') return false;
    if (key.startsWith('ball:')) {
      const u = it.userData;
      u.stowed = true; u.kinematic = true; u.vel.set(0, 0, 0); u.shot = null; u.holder = null; it.visible = false;
      return true;
    }
    if (it.setRunning) it.setRunning(false);
    it.stowed = true; it.stowHome = { x: it.x, z: it.z, rot: it.rot };
    it.group.visible = false;
    const i = obstacles.indexOf(it.obstacle);
    if (i >= 0) obstacles.splice(i, 1);
    return true;
  }
  function unstow(key, at = null) {
    const it = itemOf(key);
    if (!it || !isStowed(key)) return false;
    if (key.startsWith('ball:')) {
      const s = at || spotFor(key), u = it.userData;
      if (!s) return false;
      it.position.set(s.x, u.r, s.z);
      u.stowed = false; u.kinematic = false; u.vel.set(0, 0, 0); it.visible = true;
      return true;
    }
    let s = at;
    if (!s || !world.fits(it, s.x, s.z)) s = spotFor(key);       // (the place it was going to stand has been taken since)
    if (!s) return false;
    it.stowed = false;
    if (!obstacles.includes(it.obstacle)) obstacles.push(it.obstacle);
    it.set(s.x, s.z);
    it.group.visible = true;
    return true;
  }
  const items = () => STORE.filter((s) => itemOf(s.key)).map((s) => ({ ...s, stowed: isStowed(s.key) }));
  const stowedKeys = () => STORE.filter((s) => itemOf(s.key) && isStowed(s.key)).map((s) => s.key);
  let want = null;                                        // keys a reload says were in the shed (the objects may not be built yet)
  function setStowed(list) { want = new Set(list); }
  function releaseAll() { for (const k of stowedKeys()) unstow(k); }

  function sync() {
    for (const [kind, name] of Object.entries(PAIRS)) {
      const obj = objects[name];
      if (obj && !balls[kind] && door()) {
        const b = makeYardBall(kind), s = clearSpot(kind, obj);
        b.position.set(s.x, s.r, s.z);
        room.add(b);
        balls[kind] = b;
      } else if (balls[kind] && (!obj || !door())) {
        if (balls[kind].userData.holder) balls[kind].userData.holder = null;
        room.remove(balls[kind]);
        balls[kind].geometry.dispose();
        delete balls[kind];
      }
    }
    if (objects.shed) {
      if (want) {                                           // the saved shed contents (once the things are built)
        for (const k of want) if (itemOf(k)) { stow(k); want.delete(k); }
        if (!want.size) want = null;
      }
      // a mower that stands inside the shed (the way a new yard and older saves have it) is put away in it
      const m = objects.mower;
      if (m && !m.stowed && Math.hypot(m.x - objects.shed.x, m.z - objects.shed.z) < 0.4) stow('mower');
    }
  }

  // Aim a ball at a world point: the velocity that gets it there in T seconds under gravity (air drag ignored).
  function launch(kind, target, T = 0.8) {
    const b = balls[kind];
    if (!b) return false;
    const p = b.position, v = b.userData.vel;
    v.set((target.x - p.x) / T, (target.y - p.y + 0.5 * G * T * T) / T, (target.z - p.z) / T);
    b.userData.kinematic = false;
    b.userData.shot = { kind, t: 0 };
    return true;
  }
  function roll(kind, dir, speed) {
    const b = balls[kind];
    if (!b) return false;
    b.userData.vel.set(dir.x * speed, 0.0, dir.z * speed);
    b.userData.kinematic = false;
    return true;
  }

  function step(kind, b, dt) {
    const u = b.userData, v = u.vel, r = u.r, p = b.position;
    if (u.stowed || u.kinematic) { u.prevY = p.y; return; }
    const before = p.clone();
    v.y -= G * dt;
    p.addScaledVector(v, dt);
    // the grass
    if (p.y < r) {
      p.y = r;
      if (v.y < -0.9) { sfx('bounce', Math.min(6, -v.y)); v.y = -v.y * BOUNCE[kind]; } else v.y = 0;
    }
    if (p.y <= r + 0.002 && v.y === 0) {                       // rolling
      const k = Math.exp(-1.15 * dt);
      v.x *= k; v.z *= k;
      if (Math.hypot(v.x, v.z) < 0.05) { v.x = 0; v.z = 0; }
    }
    // the fence
    const bd = bounds();
    if (bd) {
      const m = r + 0.1;
      if (p.x < bd.minX + m) { p.x = bd.minX + m; if (Math.abs(v.x) > 1) sfx('wallbump', Math.abs(v.x)); v.x = Math.abs(v.x) * 0.5; }
      if (p.x > bd.maxX - m) { p.x = bd.maxX - m; if (Math.abs(v.x) > 1) sfx('wallbump', Math.abs(v.x)); v.x = -Math.abs(v.x) * 0.5; }
      if (p.z < bd.minZ + m) { p.z = bd.minZ + m; if (Math.abs(v.z) > 1) sfx('wallbump', Math.abs(v.z)); v.z = Math.abs(v.z) * 0.5; }
      if (p.z > bd.maxZ - m) { p.z = bd.maxZ - m; if (Math.abs(v.z) > 1) sfx('wallbump', Math.abs(v.z)); v.z = -Math.abs(v.z) * 0.5; }
    }
    // the things in the yard (not its own goal / hoop: those are handled below, and the mower is a wheeled thing it rolls under)
    const own = PAIRS[kind];
    for (const o of Object.values(objects)) {
      if (o.stowed || o.name === own || o.name === 'soccergoal' || o.name === 'basketballhoop' || o.name === 'mower' || !inYard(o.x, o.z)) continue;
      const x0 = o.obstacle.x0 - r, x1 = o.obstacle.x1 + r, z0 = o.obstacle.z0 - r, z1 = o.obstacle.z1 + r;
      if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1 && p.y < o.h + r) {
        const dl = p.x - x0, dr = x1 - p.x, dz0 = p.z - z0, dz1 = z1 - p.z, m = Math.min(dl, dr, dz0, dz1);
        if (m === dl) { p.x = x0; v.x = -Math.abs(v.x) * 0.4; } else if (m === dr) { p.x = x1; v.x = Math.abs(v.x) * 0.4; }
        else if (m === dz0) { p.z = z0; v.z = -Math.abs(v.z) * 0.4; } else { p.z = z1; v.z = Math.abs(v.z) * 0.4; }
        sfx('knock', 1.5);
      }
    }
    // the soccer goal: the net at the back and the sides stop the ball; anything that goes in counts
    const goal = objects.soccergoal && !objects.soccergoal.stowed ? objects.soccergoal : null;
    if (goal) {
      const c = Math.cos(goal.yaw), s = Math.sin(goal.yaw);
      const rel = (x, z) => ({ x: (x - goal.x) * c - (z - goal.z) * s, z: (x - goal.x) * s + (z - goal.z) * c });   // goal-local (inverse of local())
      const lp = rel(p.x, p.z);
      const toWorldV = (lx, lz) => ({ x: lx * c + lz * s, z: -lx * s + lz * c });
      const inside = Math.abs(lp.x) < 1.15 - r * 0.2 && lp.z < 0.35 && lp.z > -0.45 && p.y < 1.15;
      if (kind === 'soccer' && inside) {
        const lv = rel(v.x + goal.x, v.z + goal.z);
        if (lp.z < -0.3) {
          if (u.shot && !u.shot.scored) { u.shot.scored = true; score.goals++; sfx('thud', 0.35); }
          lp.z = -0.3; lv.z *= -0.12; lv.x *= 0.3;
          const w = toWorldV(lv.x, lv.z); v.x = w.x; v.z = w.z; v.y *= 0.3;
          const wp = toWorldV(lp.x, lp.z); p.x = goal.x + wp.x; p.z = goal.z + wp.z;
        }
      }
    }
    // the hoop: the backboard bounces it, and a ball coming down through the rim is a basket
    const hoop = objects.basketballhoop && !objects.basketballhoop.stowed ? objects.basketballhoop : null;
    if (hoop && kind === 'basketball') {
      const c = Math.cos(hoop.yaw), s = Math.sin(hoop.yaw);
      const rel = (x, z) => ({ x: (x - hoop.x) * c - (z - hoop.z) * s, z: (x - hoop.x) * s + (z - hoop.z) * c });
      const lp = rel(p.x, p.z), lb = rel(before.x, before.z);
      const toWorldV = (lx, lz) => ({ x: lx * c + lz * s, z: -lx * s + lz * c });
      if (lb.z > -0.01 + r && lp.z <= -0.01 + r && Math.abs(lp.x) < 0.55 && p.y > 2.3 && p.y < 3.0) {        // the board
        const lv = rel(v.x + hoop.x, v.z + hoop.z), nv = toWorldV(lv.x * 0.7, Math.abs(lv.z) * 0.4);
        v.x = nv.x; v.z = nv.z;
        const wp = toWorldV(lp.x, -0.01 + r + 0.01); p.x = hoop.x + wp.x; p.z = hoop.z + wp.z;
        sfx('knock', 3);
      }
      const RIM = hoop.RIM_Y;
      if (before.y > RIM && p.y <= RIM && v.y < 0) {
        const d = Math.hypot(lp.x, lp.z - 0.38);
        if (d < 0.17) {                                                         // swish
          const lv = rel(v.x + hoop.x, v.z + hoop.z), nv = toWorldV(lv.x * 0.15, lv.z * 0.15);
          v.x = nv.x; v.z = nv.z;
          if (u.shot && !u.shot.scored) { u.shot.scored = true; score.baskets++; }
          hoop.swish(); sfx('swish');
        } else if (d < 0.3) {                                                   // the rim
          const away = Math.atan2(lp.x, lp.z - 0.38), nv = toWorldV(Math.sin(away) * 1.2, Math.cos(away) * 1.2);
          v.x = nv.x; v.z = nv.z; v.y = Math.abs(v.y) * 0.45; p.y = RIM + 0.02;
          sfx('knock', 3);
        }
      }
    }
    // a ball that has come to rest inside the goal's or the hoop's footprint rolls out the front of it (GUY cannot reach in there)
    if (p.y <= r + 0.01 && Math.hypot(v.x, v.z) < 0.2) {
      let shut = null;
      for (const o of [objects.soccergoal, objects.basketballhoop]) {
        const ob = o && !o.stowed && o.obstacle;
        if (ob && p.x > ob.x0 - r - 0.1 && p.x < ob.x1 + r + 0.1 && p.z > ob.z0 - r - 0.1 && p.z < ob.z1 + r + 0.1) shut = o;
      }
      if (shut) {
        u.restT = (u.restT || 0) + dt;
        if (u.restT > 0.9) { const f = shut.local(0, 1); v.x = f.x * 1.8; v.z = f.z * 1.8; u.restT = 0; sfx('thud', 0.15); }
      } else u.restT = 0;
    }
    // roll the ball as it travels (cosmetic)
    const dx = p.x - before.x, dz = p.z - before.z;
    if (dx || dz) { b.rotation.z -= dx / r; b.rotation.x += dz / r; }
    u.prevY = p.y;
    if (u.shot) { u.shot.t += dt; if (u.shot.t > 6 && Math.hypot(v.x, v.z) < 0.05 && p.y <= r + 0.01) u.shot = null; }
  }

  function update(dt) {
    const d = door();
    if (d && d.shell.yard) {
      d.shell.yard.sky.update(dt);
      if (objects.skyswitch) objects.skyswitch.setNight(night);
    }
    sync();
    for (const [kind, b] of Object.entries(balls)) step(kind, b, Math.min(dt, 0.05));
  }

  return {
    balls, score, launch, roll, update, sync, inYard,
    STORE, itemOf, isStowed, spotFor, stow, unstow, items, stowedKeys, setStowed, releaseAll,
    setNight(n) { night = !!n; const d = door(); if (d && d.shell.yard) d.shell.yard.sky.set(night); },
    snapNight(n) { night = !!n; const d = door(); if (d && d.shell.yard) d.shell.yard.sky.snap(night); },
    isNight: () => night,
    // the sky of a yard that has just been built follows what was set before
    attach(d) { if (d.shell.yard) d.shell.yard.sky.snap(night); },
    cut: () => { const d = door(); return d && d.shell.yard ? d.shell.yard.cut : null; },
  };
}
