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
      if (target) { const p = target(); t = o.toLocal(p.x - o.x, p.z - o.z); }
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
      const lat = t ? clamp(t.x, -hw + 0.12, hw - 0.12) : 0, dep = t ? clamp(t.z, -hd + 0.12, hd - 0.12) : 0;
      // the four places to stand (object-local) and the way to face from each (relative to the object)
      const spot = (k) => [
        { x: lat, z: hd + margin, yaw: Math.PI },
        { x: hw + margin, z: dep, yaw: -Math.PI / 2 },
        { x: lat, z: -(hd + margin), yaw: 0 },
        { x: -(hw + margin), z: dep, yaw: Math.PI / 2 },
      ][k];
      const room = w.roomIdAt(o.x, o.z), fr = room !== 'main' && room !== 'door' ? w.frameOf(room) : MAIN_FRAME;
      const grid = makeGrid(w.obstacles, 0.2, 0, o.obstacle, fr);
      const me = this.g.root.position;
      const inside = (x, z) => {
        if (w.roomIdAt(x, z) !== room) return false;
        const b = room !== 'main' && room !== 'door' ? w.doors[room].shell.bounds : { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.7 };
        return x > b.minX + 0.35 && x < b.maxX - 0.35 && z > b.minZ + 0.35 && z < b.maxZ - 0.35;
      };
      const options = [];
      for (const k of sides) {
        const s = spot(k), l = o.local(s.x, s.z), x = o.x + l.x, z = o.z + l.z;
        if (!inside(x, z) || cellBlocked(grid, x, z)) continue;                       // a wall, or other furniture, is in the way
        if (!findPath(grid, me.x, me.z, x, z, true)) continue;                         // and he can get there
        let d = 0;
        if (t) { const dx = s.x - t.x, dz = s.z - t.z; d = Math.hypot(dx, dz); }
        options.push({ k, x, z, yaw: s.yaw + o.yaw, near: d <= REACH, d });
      }
      // front first; among the sides he can use, one within reach of the target wins
      const best = options.find((c) => c.near) || options.sort((a, b) => a.d - b.d)[0];
      if (!best) { const s = spot(0), l = o.local(s.x, s.z); (this.useSide ||= {})[name] = 0; return [this.walk(o.x + l.x, o.z + l.z, Math.PI + o.yaw)]; }
      (this.useSide ||= {})[name] = best.k;
      return [this.walk(best.x, best.z, best.yaw)];
    },
  });
}
