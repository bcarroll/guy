// Using an object from whichever side is free. A station (the toolbox, the Wood Factory, the stove ...) used to be approached only
// from its front; turned to face a wall, or pushed against one, Guy walked into the wall. Now `stand` looks at the four sides in
// turn (front first), keeps those that are free floor and near enough to the thing he has to reach, and walks to the first one. He
// remembers the side (`sideOf`) so the hands that work (saw, mallet, spoon ...) are turned to match. Objects that only work one
// way round (the drum kit, the easel) do not use `stand` and are unchanged.
import { makeGrid, findPath, cellBlocked, MAIN_FRAME } from './brain.js';

// how far the hands can reach from where he stands, measured along the floor to the thing he works at
const REACH = 1.0;

export function installApproach(Brain) {
  Object.assign(Brain.prototype, {
    // Where he stands in front of a door of an added room to open it: 0.8 m out, in line with it, unless something is there (the other
    // robot, furniture): then the nearest free place in front of it, so he never heads for a spot he cannot reach.
    doorStand(id) {
      const w = this.w, face = w.doorYaw(id, false), tx = Math.cos(face), tz = -Math.sin(face);
      const grid = makeGrid(w.obstacles, 0.22, 0, this.selfOb || null, MAIN_FRAME);
      for (const d of [0.8, 1.0, 0.65, 1.25]) {
        for (const lat of [0, 0.3, -0.3, 0.5, -0.5]) {
          const p = w.doorPoint(id, d), x = p.x + tx * lat, z = p.z + tz * lat;
          if (w.roomIdAt(x, z) === 'main' && !cellBlocked(grid, x, z)) return { x, z };
        }
      }
      return w.doorPoint(id, 0.8);
    },

    // the side he last stood at for `name`: 0 front, 1 right (+x), 2 back, 3 left (-x)
    sideOf(name) { return (this.useSide && this.useSide[name]) || 0; },

    // `front`: how far from the object's centre he stands at the front. `target`: a function giving the world point his hands go to
    // (optional). `sides`: which sides may be used (objects with a working direction, like a belt sander, allow only some).
    stand(name, front = 0.7, target = null, sides = [0, 1, 3, 2]) {
      return { type: 'plan', fn: () => this.standPlan(name, front, target, sides) };
    },

    standPlan(name, front, target, sides) {
      const o = this.obj(name);
      if (!o) { this.queue.length = 0; return []; }
      const w = this.w, hw = o.bw / 2, hd = o.bd / 2, margin = Math.max(0.2, front - hd);
      // where the hands go, in the object's own frame
      let t = null;
      if (target) {
        let p = null;
        try { p = target(); } catch { p = null; }                         // the thing he was going to work at has been taken away
        if (!p) { this.queue.length = 0; return []; }
        t = o.toLocal(p.x - o.x, p.z - o.z);
      }
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
      // where he can stand along each side (object-local): the middle of the face, or nearer the target if that is free
      const spot = (k, along) => [
        { x: along, z: hd + margin, yaw: Math.PI },
        { x: hw + margin, z: along, yaw: -Math.PI / 2 },
        { x: along, z: -(hd + margin), yaw: 0 },
        { x: -(hw + margin), z: along, yaw: Math.PI / 2 },
      ][k];
      const room = w.roomIdAt(o.x, o.z), fr = room !== 'main' && room !== 'door' ? w.frameOf(room) : MAIN_FRAME;
      const grid = makeGrid(w.obstacles, 0.2, 0, o.obstacle, fr);
      const me = this.g.root.position;
      const inside = (x, z) => {
        if (w.roomIdAt(x, z) !== room) return false;
        // where he can really stand: an added room is walkable half a metre in from its walls (room.js `walkable`), his own a little less
        const added = room !== 'main' && room !== 'door', b = added ? w.doors[room].shell.bounds : { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.6 }, m = added ? 0.6 : 0.15;
        return x > b.minX + m && x < b.maxX - m && z > b.minZ + m && z < b.maxZ - m;
      };
      const options = [], why = {};                                                    // (why: for each side, what ruled it out; read by the QA harness)
      this.lastStand = { name, why };
      for (const k of sides) {
        const ext = (k % 2 ? hd : hw) - 0.12, want = t ? clamp(k % 2 ? t.z : t.x, -ext, ext) : 0;
        let best = null;
        for (let i = 0; i <= 12; i++) {
          const along = clamp(want + (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.15), -ext, ext);        // the wanted spot, then either side of it
          const s = spot(k, along), l = o.local(s.x, s.z), x = o.x + l.x, z = o.z + l.z;
          if (!inside(x, z)) { why[k] ||= 'outside'; continue; }
          if (cellBlocked(grid, x, z)) { why[k] ||= 'blocked'; continue; }
          if (w.roomIdAt(me.x, me.z) === room && !findPath(grid, me.x, me.z, x, z, true)) { why[k] ||= 'no path'; continue; }
          const d = t ? Math.hypot(s.x - t.x, s.z - t.z) : 0;
          if (!best || d < best.d) best = { k, x, z, yaw: s.yaw + o.yaw, near: d <= REACH, d };
          if (best.near) break;
        }
        if (best) { options.push(best); delete why[k]; }
      }
      // front first; among the sides he can use, one within reach of the target wins
      const best = options.find((c) => c.near) || options.sort((a, b) => a.d - b.d)[0];
      if (!best) {                                                  // no side is free: he says so and does something else (he never walks into a wall)
        this.queue.length = 0;
        this.ui(`can't get to the ${name} from anywhere`);
        return [];
      }
      (this.useSide ||= {})[name] = best.k;
      return [{ ...this.walk(best.x, best.z, best.yaw), tol: 0.3 }];
    },
  });
}
