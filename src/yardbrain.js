// Guy (and GAL) in the Backyard: going out through the door, sitting in the lawn chair, the bird bath, switching between day and night,
// playing with the soccer ball and the basketball, and mowing the lawn. Installed onto Brain at the bottom of brain.js (like the
// Workshop). The objects and the ball physics are in yardobjects.js and yardballs.js.
//
// Every activity is a trip: in through the door (unless he is already out there), the steps, and back out (unless he is locked on
// something in the yard). He looks everything up at the moment the step starts: the user can move or remove any of it at any time.
//
// Balls: a ball is a thing in the yard (world.yard.balls) that flies and rolls by itself; a step with `fx.ballKind` ('soccer' |
// 'basketball') makes the ball-handling poses of brain.js (pickup, dribble, toss, putdown and the new shoot) hold that ball in his
// hands. Shots are launched with world.yard.launch at the moment of the kick or the release.
import * as THREE from 'three';
import { sfx } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ID = 'backyard';
export const YARD_ACTS = ['yardsit', 'birdbath', 'skyswitch', 'mow', 'yardpoke', 'goalshot', 'soccertoss', 'hoopshoot', 'hoopdribble'];
export const YARD_OBJECTS = ['soccergoal', 'basketballhoop', 'lawnchair', 'birdbath', 'skyswitch', 'shed', 'mower'];

export function installYard(Brain, POSES, H) {
  const { clamp, rand, pick, makeGrid, cellBlocked, INFLATE } = H;

  Object.assign(Brain.prototype, {
    // ------------------------------------------------------------------ where he is
    inYard() { return this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z) === ID; },
    // locked on something that is in the yard (so a trip does not end with him walking out)
    lockHereYard() { const o = this.lock && this.obj(this.lock.name); return !!o && this.w.roomIdAt(o.x, o.z) === ID; },
    lockedInYard() { return this.inYard() && this.lockHereYard(); },
    yardOpen() { return !!this.w.doors[ID] && !this.doorLockedFor(ID); },
    yardTrip(label, inner) {
      return [label, ...(this.inYard() ? [] : this.doorIn(ID)), ...inner, ...(this.lockHereYard() ? [] : this.doorOut(ID))];
    },
    yardFrame() { return this.w.frameOf(ID); },
    yardBall(kind) { return this.w.yard.balls[kind] || null; },
    // is the ball still on the move (flying or rolling)?
    ballMoving(kind) {
      const b = this.yardBall(kind);
      return !!b && !b.userData.kinematic && (Math.hypot(b.userData.vel.x, b.userData.vel.z) > 0.12 || b.position.y > b.userData.r + 0.03);
    },
    // wait for a ball to come to rest (at most a few seconds)
    waitBall(kind, n = 0) {
      return { type: 'plan', fn: () => (this.ballMoving(kind) && n < 9 ? [this.play('idle', 0.5), this.waitBall(kind, n + 1)] : []) };
    },
    // which yard ball a robot who has not read the matching book pokes: any ball in the yard without its book
    pokeKinds() {
      return ['soccer', 'basketball'].filter((k) => this.yardBall(k) && !this.skills.has(`outdoor.${k}`));
    },

    // ------------------------------------------------------------------ standing by a ball
    // Walk to a free spot next to the ball and face it. `at`: a function giving a world point to face *through* the ball (the goal or
    // the hoop): he then stands on the far side of the ball, so that picking it up leaves him facing that way.
    yardBallStand(kind, at = null) {
      return {
        type: 'plan',
        fn: () => {
          const b = this.yardBall(kind);
          if (!b) { this.queue.length = 0; return []; }
          const p = b.position, g = this.g.pos, bd = this.w.doors[ID].shell.bounds;
          let base = Math.atan2(g.x - p.x, g.z - p.z);                        // from the ball towards Guy
          let turns = [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI];
          if (at) { const t = at(); if (t) { base = Math.atan2(p.x - t.x, p.z - t.z); turns = [0, 0.3, -0.3, 0.6, -0.6]; } }
          const fr = this.yardFrame();
          for (const grid of [makeGrid(this.w.obstacles, 0.62, 0, null, fr), makeGrid(this.w.obstacles, 0.55, 0, null, fr)]) {
            for (const turn of turns) {
              const x = p.x + Math.sin(base + turn) * 0.65, z = p.z + Math.cos(base + turn) * 0.65;
              if (x < bd.minX + 0.7 || x > bd.maxX - 0.7 || z < bd.minZ + 0.7 || z > bd.maxZ - 0.7 || cellBlocked(grid, x, z)) continue;
              return [this.walk(x, z, Math.atan2(p.x - x, p.z - z))];
            }
          }
          this.queue.length = 0;
          return [];
        },
      };
    },
    pickupBall(kind, needs) {
      return this.play('pickup', 2.0, { ball: true, ballKind: kind, needs, at: [0.9, () => { this.ballHeld = true; this.heldKind = kind; }] });
    },
    putdownBall(kind, needs) {
      return this.play('putdown', 2.0, { ball: true, ballKind: kind, needs, at: [1.0, () => this.releaseBall()] });
    },

    // ------------------------------------------------------------------ soccer
    // one kick at the goal: stand behind the ball in line with the goal, swing, launch it at the goal mouth (some go wide)
    goalKick(good = 0.7) {
      return [this.yardBallStand('soccer', () => (this.obj('soccergoal') ? this.obj('soccergoal').at(0, 0, 0.35) : null)),
        {
          type: 'plan',
          fn: () => {
            const goal = this.obj('soccergoal'), ball = this.yardBall('soccer');
            if (!goal || !ball) { this.queue.length = 0; return []; }
            const before = this.w.yard.score.goals;
            const side = Math.random() < good ? rand(-0.8, 0.8) : (Math.random() < 0.5 ? -1 : 1) * rand(1.4, 2.0);   // a miss goes wide of the post
            const aim = () => goal.at(side, rand(0.2, 0.75), 0.0);
            return [this.play('kick', 1.2, {
              needs: ['soccergoal'],
              at: [0.5, () => {
                const b = this.yardBall('soccer'), gl = this.obj('soccergoal');
                if (!b || !gl) return;
                const t = aim(), d = Math.hypot(t.x - b.position.x, t.z - b.position.z);
                this.w.yard.score.shots++;
                this.w.yard.launch('soccer', t, clamp(d / 6.5, 0.4, 0.95));
                sfx('kick', 1);
              }],
            }), this.waitBall('soccer'),
            { type: 'plan', fn: () => (this.w.yard.score.goals > before ? [this.play('wave', 1.8)] : [this.play('idle', 0.5)]) }];
          },
        }];
    },

    // ------------------------------------------------------------------ mowing
    // a rectangle round the lawn, pushing the mower: the first corner is where it stands. Picks one that is clear of everything.
    mowPlan() {
      const m = this.obj('mower'), shed = this.obj('shed');
      if (!m || !shed) { this.queue.length = 0; return []; }
      const bd = this.w.doors[ID].shell.bounds, fr = this.yardFrame();
      const grid = makeGrid(this.w.obstacles, 0.5, 0, m.obstacle, fr);
      const BEHIND = 0.95;
      const clearLine = (a, b, off) => {                                    // the mower's line a-b, and Guy's line behind it
        const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2));
        for (let i = 0; i <= n; i++) {
          const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
          if (x < bd.minX + 0.8 || x > bd.maxX - 0.8 || z < bd.minZ + 0.8 || z > bd.maxZ - 0.8 || cellBlocked(grid, x, z)) return false;
          if (off) { const gx = x - off.x * BEHIND, gz = z - off.z * BEHIND; if (gx < bd.minX + 0.6 || gx > bd.maxX - 0.6 || gz < bd.minZ + 0.6 || gz > bd.maxZ - 0.6 || cellBlocked(grid, gx, gz)) return false; }
        }
        return true;
      };
      const start = { x: m.x, z: m.z };
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let route = null;
      for (const [w, h] of [[2.8, 1.8], [2.2, 1.4], [1.6, 1.0]]) {
        for (const [ax, az] of dirs) {                                      // the first leg goes along (ax, az); the loop turns left or right
          for (const turn of [1, -1]) {
            const bx = -az * turn, bz = ax * turn;                          // the second leg's direction
            const pts = [start, { x: start.x + ax * w, z: start.z + az * w }, { x: start.x + ax * w + bx * h, z: start.z + az * w + bz * h },
              { x: start.x + bx * h, z: start.z + bz * h }, start];
            const dd = [{ x: ax, z: az }, { x: bx, z: bz }, { x: -ax, z: -az }, { x: -bx, z: -bz }];
            if (dd.every((d, i) => clearLine(pts[i], pts[i + 1], d))) { route = { pts, dd }; break; }
          }
          if (route) break;
        }
        if (route) break;
      }
      if (!route) { this.ui('no room to mow'); this.queue.length = 0; return []; }
      const { pts, dd } = route, steps = [];
      const faceFor = (d) => this.w.rotFacing(-d.x, -d.z);                  // (the mower's front is its local -z)
      const behind = (p, d) => ({ x: p.x - d.x * BEHIND, z: p.z - d.z * BEHIND });
      steps.push(this.play('idle', 0.05, { at: [0, () => { const c = this.w.yard.cut(); if (c) c.clear(); }] }));
      for (let i = 0; i < 4; i++) {
        const d = dd[i], from = pts[i], to = pts[i + 1], g0 = behind(from, d), g1 = behind(to, d);
        steps.push({ ...this.walk(g0.x, g0.z, Math.atan2(d.x, d.z)), direct: i > 0 });
        steps.push(this.play('idle', 0.4, { at: [0, () => { const mm = this.obj('mower'); if (mm) { mm.rot = faceFor(d); mm.set(from.x, from.z); sfx('click'); } }] }));
        steps.push({ ...this.walk(g1.x, g1.z, Math.atan2(d.x, d.z)), direct: true, push: { obj: m, relx: d.x * BEHIND, relz: d.z * BEHIND, spd: 1.1 } });
      }
      return steps;
    },

    mowTrail(o) {                                                           // called every frame while the mower is pushed
      o.runT = 0.3;
      const last = o.lastCut;
      if (!last || Math.hypot(o.x - last.x, o.z - last.z) > 0.3) {
        const c = this.w.yard.cut();
        if (c) c.add(V(o.x, 0, o.z), o.group.rotation.y);
        o.lastCut = { x: o.x, z: o.z };
      }
      sfx('motor');
    },

    // ------------------------------------------------------------------ the activities
    yardActivities() {
      const w = this.w;
      const k = (id) => this.skills.has(id);
      const night = () => w.yard.isNight();
      return {
        // the lawn chair: a long rest in the open air
        yardsit: () => this.yardTrip('relaxing in the lawn chair', [{
          type: 'plan',
          fn: () => {
            const c = this.obj('lawnchair');
            if (!c) { this.queue.length = 0; return []; }
            return [this.walkAt('lawnchair', 0, c.sit.gap, Math.PI), this.play('sitRest', rand(14, 22), { chairSit: true, chair: 'lawnchair', needs: ['lawnchair'] })];
          },
        }]),
        birdbath: () => this.yardTrip('looking at the bird bath', [
          this.stand('birdbath', 0.75, () => this.obj('birdbath').basinPoint()),
          this.play('reach', 1.9, { needs: ['birdbath'], at: [0.9, () => { const b = this.obj('birdbath'); if (b) b.splash(); sfx('splash'); }], target: () => this.obj('birdbath').basinPoint() }),
          this.play('idle', 1.4)]),
        // the sky switch: day becomes night and night becomes day
        skyswitch: () => this.yardTrip(night() ? 'switching the sun on' : 'switching the moon on', [
          this.stand('skyswitch', 0.6, () => this.obj('skyswitch').leverPoint()),
          this.play('reach', 1.8, { needs: ['skyswitch'], at: [0.9, () => { w.yard.setNight(!w.yard.isNight()); sfx('click'); sfx('chime'); }], target: () => this.obj('skyswitch').leverPoint() }),
          this.play('idle', 1.2)]),
        mow: () => this.yardTrip('mowing the lawn', [
          this.stand('shed', 1.2, () => this.obj('shed').knobPoint()),
          this.play('reach', 1.6, { needs: ['shed'], at: [0.8, () => { const s = this.obj('shed'); if (s) { s.setOpen(true); sfx('lid'); } }], target: () => this.obj('shed').knobPoint() }),
          this.play('idle', 0.8),
          { type: 'plan', fn: () => this.mowPlan() },
          this.stand('shed', 1.2, () => this.obj('shed').knobPoint()),
          this.play('reach', 1.6, { needs: ['shed'], at: [0.8, () => { const s = this.obj('shed'); if (s) { s.setOpen(false); sfx('lid'); } }], target: () => this.obj('shed').knobPoint() })]),
        // no book yet: just poking a ball about with his foot
        yardpoke: () => this.yardTrip('poking a ball about the yard', [{
          type: 'plan',
          fn: () => {
            const kinds = this.pokeKinds();
            if (!kinds.length) { this.queue.length = 0; return []; }
            const kind = pick(kinds), b = this.yardBall(kind), bd = w.doors[ID].shell.bounds, fr = this.yardFrame();
            for (let i = 0; i < 60; i++) {
              const grid = makeGrid(w.obstacles, i < 40 ? 0.55 : INFLATE, 0, null, fr);
              const dir = V(rand(bd.minX + 1, bd.maxX - 1) - b.position.x, 0, rand(bd.minZ + 1, bd.maxZ - 1) - b.position.z).normalize();
              const from = b.position.clone().addScaledVector(dir, -0.7);
              if (from.x < bd.minX + 0.7 || from.x > bd.maxX - 0.7 || from.z < bd.minZ + 0.7 || from.z > bd.maxZ - 0.7 || cellBlocked(grid, from.x, from.z)) continue;
              return [this.walk(from.x, from.z, Math.atan2(dir.x, dir.z)),
                this.play('kick', 1.2, { at: [0.5, () => { if (this.w.yard.roll(kind, dir, rand(0.9, 1.6))) sfx('kick', 0.4); }] }), this.waitBall(kind)];
            }
            this.queue.length = 0;
            return [];
          },
        }]),
        goalshot: () => this.yardTrip('taking shots at the goal', [...this.goalKick(0.55), ...this.goalKick(0.7), ...this.goalKick(0.85)]),
        soccertoss: () => this.yardTrip('tossing the soccer ball up and catching it', [this.yardBallStand('soccer'),
          this.pickupBall('soccer', ['soccergoal']), this.play('toss', 6.85, { ball: true, ballKind: 'soccer', needs: ['soccergoal'] }), this.putdownBall('soccer', ['soccergoal'])]),
        hoopdribble: () => this.yardTrip('dribbling the basketball', [this.yardBallStand('basketball'),
          this.pickupBall('basketball', ['basketballhoop']), this.play('dribble', 9, { ball: true, ballKind: 'basketball', needs: ['basketballhoop'] }), this.putdownBall('basketball', ['basketballhoop'])]),
        hoopshoot: () => this.yardTrip('shooting hoops', [...this.hoopShot(0.55), ...this.hoopShot(0.65), ...this.hoopShot(0.75)]),
      };
    },

    // pick the ball up on the far side of it from the hoop and shoot (the ball goes up to the rim; some miss)
    hoopShot(good) {
      const rim = () => (this.obj('basketballhoop') ? this.obj('basketballhoop').rimPoint() : null);
      return [this.yardBallStand('basketball', rim),
        this.pickupBall('basketball', ['basketballhoop']),
        {
          type: 'plan',
          fn: () => {
            const hoop = this.obj('basketballhoop');
            if (!hoop || !this.yardBall('basketball')) { this.queue.length = 0; return []; }
            const before = this.w.yard.score.baskets;
            const miss = Math.random() > good, off = miss ? (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 0.5) : rand(-0.05, 0.05);
            const lat = rand(-1, 1) > 0 ? 1 : -1;
            return [this.play('shoot', 2.7, {
              ball: true, ballKind: 'basketball', needs: ['basketballhoop'],
              at: [1.05, () => {
                const b = this.yardBall('basketball'), h = this.obj('basketballhoop');
                if (!b || !h) return;
                const t = h.rimPoint(), d = Math.hypot(t.x - b.position.x, t.z - b.position.z);
                const sideways = V(-(t.z - b.position.z), 0, t.x - b.position.x).normalize().multiplyScalar(off * lat);
                this.w.yard.score.shots++;
                this.w.yard.launch('basketball', t.clone().add(sideways), clamp(0.95 + d * 0.1, 1.0, 1.6));
                this.ballHeld = false;
                sfx('whoosh');
              }],
            }), this.waitBall('basketball'),
            { type: 'plan', fn: () => (this.w.yard.score.baskets > before ? [this.play('wave', 1.8)] : [this.play('idle', 0.4)]) }];
          },
        }];
    },
  });
}
