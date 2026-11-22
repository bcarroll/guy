// GUY and GAL looking after the Library (src/library.js, room.js `libraryShelfSpot` / `packShelf`). Installed onto Brain at the bottom of
// brain.js.
//
//   moveshelf  once there is a Library, the bookshelves (the skill shelf, and any he built) belong in it: he takes the books off and the shelf
//              apart (it goes flat), carries it through every door on the way, puts it together against a side wall of the Library and
//              puts the books back. A chore: chosen by itself whenever a shelf is still in his room (shelfMoveNext), not by weight.
//   libclean   the Library is dusty: he wipes the cobwebs out of its corners and the dust off its floor, a few at a time.
//
// The shelf is looked up by name at every step (the user can drag it about meanwhile), and if he is cut short while it is flat-packed in
// his arms it is put together again where he stands, or back where it was (shelfCleanup): it is never lost.
import * as THREE from 'three';
import { sfx } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SHELF_KINDS = (o) => o.name === 'shelf' || o.kind === 'bookshelf2';

export function installLibrary(Brain) {
  Object.assign(Brain.prototype, {
    libraryOpen() { return !!this.w.doors.library && !this.doorLockedFor('library') && !this.w.doors.library.closing; },

    // The shelves still in his own room, each with the place in the Library it goes to: [{ o, spot }].
    shelfMoves() {
      const w = this.w;
      if (!this.libraryOpen()) return [];
      const taken = new Set(), out = [];
      // (the places already filled by shelves standing in the Library are not offered again)
      for (const o of Object.values(w.objects)) if (SHELF_KINDS(o) && w.roomIdAt(o.x, o.z) === 'library') { const s = w.libraryShelfSpot(o, taken); if (s && Math.hypot(s.x - o.x, s.z - o.z) < 0.05) taken.add(s.key); }
      const list = Object.values(w.objects).filter((o) => SHELF_KINDS(o) && !o.packed && w.roomIdAt(o.x, o.z) === 'main' && !this.otherUses(o.name) && !(this.other && this.other.shelfMove && this.other.shelfMove.name === o.name))
        .sort((a, b) => (a.name === 'shelf' ? -1 : b.name === 'shelf' ? 1 : a.name < b.name ? -1 : 1));
      for (const o of list) {
        const s = w.libraryShelfSpot(o, taken);
        if (!s) continue;
        taken.add(s.key);
        out.push({ o, spot: s });
      }
      return out;
    },
    // Called from choose(): 'moveshelf' when a shelf is waiting to be carried into the Library (and nobody is in the middle of it already).
    shelfMoveNext() {
      if (this.lock || this.stuckIn() || this.held || this.carry) return null;
      if (this.other && this.other.shelfMove) return null;                   // (one shelf on the move at a time)
      if (this.time - (this.shelfTried || -999) < 30) return null;          // (it did not work a moment ago: not straight away again)
      return this.shelfMoves().length ? 'moveshelf' : null;
    },

    // Cut short while the shelf is in his arms: it is put together where he stands if it fits there, otherwise back where it was.
    shelfCleanup() {
      const m = this.shelfMove;
      if (!m) return;
      this.shelfMove = null;
      const o = this.obj(m.name);
      if (!o || !o.packed) return;
      if (this.carry === 'flat') this.setCarry(null);
      const p = this.g.root.position, yaw = this.g.root.rotation.y;
      const ahead = { x: p.x + Math.sin(yaw) * 0.7, z: p.z + Math.cos(yaw) * 0.7 };
      const here = this.w.fits(o, ahead.x, ahead.z) ? ahead : this.w.findSpot(o, ahead, null);
      const back = here && ['main', 'library'].includes(this.w.roomIdAt(here.x, here.z)) ? here : m.from;
      this.w.unpackShelf(m.name, { x: back.x, z: back.z, rot: back === m.from ? m.from.rot : o.rot });
    },

    // The places along a shelf's front his hand goes to (its front is local -x): `row` 0 low ... 2 high, `u` along it.
    shelfRow(name, row = 1, u = 0) {
      const o = this.obj(name);
      if (!o) return null;
      const l = o.local(-0.22, u * 0.8);
      return V(o.x + l.x, [0.75, 1.15, 1.5][Math.max(0, Math.min(2, row))], o.z + l.z);
    },

    // Where he can stand to clean a spot of dust: the first free place (no furniture, on the floor). null if none.
    dustStand(s, dust) {
      const w = this.w;
      for (const st of dust.stands(s)) {
        if (w.roomIdAt(st.x, st.z) !== 'library' || !w.walkable(st.x, st.z)) continue;
        if (w.obstacles.some((o) => o.active !== false && !o.char && st.x > o.x0 - 0.3 && st.x < o.x1 + 0.3 && st.z > o.z0 - 0.3 && st.z < o.z1 + 0.3)) continue;
        return st;
      }
      return null;
    },
    // the dust he could clean now: [{ s, stand }], dirtiest first
    dustJobs() {
      const d = this.w.doors.library, dust = d && d.shell.dust;
      if (!dust || !this.libraryOpen()) return [];
      return dust.dirty(0.5).map((s) => ({ s, stand: this.dustStand(s, dust) })).filter((j) => j.stand).sort((a, b) => b.s.level - a.s.level);
    },
    libAvailable(act) {
      if (act === 'moveshelf') return this.shelfMoves().length > 0;
      if (act === 'libclean') return this.dustJobs().length > 0 && !(this.other && this.other.last === 'libclean' && this.other.step);
      return false;
    },

    libraryActivities() {
      return {
        moveshelf: () => {
          const m = this.shelfMoves()[0];
          this.shelfTried = this.time;
          if (!m) return ['no shelf to move', this.play('idle', 0.5)];
          const n = m.o.name, from = { x: m.o.x, z: m.o.z, rot: m.o.rot }, spot = m.spot;
          const row = (r, u) => () => this.shelfRow(n, r, u) || this.g.pos.clone();
          const packing = (r, u) => this.play('reach', 1.6, { needs: [n], at: [0.8, () => sfx('bookgrab')], target: row(r, u) });
          // put together where it goes, in the Library (if somebody put something there meanwhile: the nearest free place in the Library)
          const setUp = () => {
            const o = this.obj(n);
            if (!o) return;
            const keep = o.rot; o.rot = spot.rot;
            const ok = this.w.fits(o, spot.x, spot.z);
            const at = ok ? spot : this.w.findSpot(o, spot, null);
            o.rot = keep;
            const place = at && this.w.roomIdAt(at.x, at.z) === 'library' ? { x: at.x, z: at.z, rot: spot.rot } : { ...from };
            this.setCarry(null);
            this.w.unpackShelf(n, place);
            (this.popping ||= []).push({ o, t: 0 });
            this.shelfMove = null;
            sfx('thud', 0.5); sfx('chime');
            if (this.onBuilt) this.onBuilt(`${this.who()} moved the ${n === 'shelf' ? 'bookshelf' : 'second bookshelf'} into the Library, books and all.`);
          };
          return ['moving the bookshelf to the Library',
            { type: 'plan', fn: () => this.tripSteps(this.hereId(), 'main') },           // (to his own room, where the shelf stands, if he is not there)
            this.stand(n, 0.7, row(1, 0), [3]),
            this.play('reach', 1.0, { needs: [n], at: [0.5, () => { this.shelfMove = { name: n, from }; }], target: row(1, -0.5) }),
            packing(1, -0.3), packing(0, 0.2), packing(2, 0.3),
            // the shelf comes apart: it goes flat, and the flat pack is in his arms
            this.play('reach', 1.8, { needs: [n], at: [1.2, () => { this.w.packShelf(n); this.setCarry('flat', 1); sfx('thud', 0.4); }], target: row(0, 0) }),
            { type: 'plan', fn: () => this.tripSteps(this.hereId(), 'library') },
            { type: 'plan', fn: () => {
              const y = (spot.rot * Math.PI) / 2, st = { x: spot.x - Math.cos(y) * 1.0, z: spot.z + Math.sin(y) * 1.0 };          // (a metre out from its front: its local -x)
              return [this.walk(st.x, st.z, Math.atan2(spot.x - st.x, spot.z - st.z)),
                this.play('reach', 2.6, { target: () => V(spot.x, 0.35, spot.z), at: [1.8, setUp] })];
            } },
            // the books go back on it, row by row
            { type: 'plan', fn: () => (this.obj(n) && !this.obj(n).packed ? [this.stand(n, 0.7, row(1, 0), [3]),
              ...[[1, -0.3], [0, 0.1], [2, 0.3], [1, 0.4]].map(([r, u]) => this.play('reach', 1.5, { needs: [n], at: [0.7, () => sfx('bookgrab')], target: row(r, u) }))] : []) },
          ];
        },

        libclean: () => {
          const jobs = this.dustJobs().slice(0, 3);
          if (!jobs.length) return ['nothing to clean', this.play('idle', 0.5)];
          const dust = () => (this.w.doors.library && this.w.doors.library.shell.dust) || null;
          const steps = [];
          for (const { s } of jobs) {
            steps.push({ type: 'plan', fn: () => {
              const d = dust();
              if (!d) { this.queue.length = 0; return []; }
              const st = this.dustStand(s, d);
              if (!st) return [];
              const c = d.point(s), t0 = { v: 0, last: 0 };
              const dur = s.kind === 'web' ? 3.2 : 4.0;
              // a cloth across the cobweb, or a hand sweeping the patch on the floor: it fades as he wipes
              const target = () => {
                if (!t0.v) t0.v = this.time;
                const t = this.time - t0.v, sw = Math.sin(t * 3.2) * (s.kind === 'web' ? 0.18 : 0.28);
                if (t > 0.5) { const dd = dust(); if (dd) dd.clean(s, (t - (t0.last || 0.5)) / (dur - 0.9)); t0.last = t; }
                if (Math.floor(t * 1.0) !== Math.floor((t - 0.05) * 1.0)) sfx('wipe');
                const side = V(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
                return V(c.x + side.x * sw, s.kind === 'web' ? c.y - 0.05 : 0.2, c.z + side.z * sw);
              };
              this.ui(s.kind === 'web' ? 'wiping a cobweb out of the corner' : 'sweeping the dust off the floor');
              return [this.walk(st.x, st.z, st.yaw), this.play('reach', dur, { target, at: [dur - 0.1, () => { const dd = dust(); if (dd) dd.clean(s, 1); }] })];
            } });
          }
          return ['cleaning the library', ...steps, this.play('idle', 0.6)];
        },
      };
    },
  });
}
