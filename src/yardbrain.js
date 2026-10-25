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
export const YARD_ACTS = ['yardsit', 'birdbath', 'skyswitch', 'mow', 'yardpoke', 'goalshot', 'soccertoss', 'hoopshoot', 'hoopdribble', 'yardtidy'];
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

    // ------------------------------------------------------------------ the shed holds the yard's things
    // Everything movable in the yard (the goal, the hoop, both balls, the chair, the bird bath, the sky switch, the mower) can be put away
    // in the shed (world.yard.stow / unstow hide it and take it out of the way). Before mowing Guy puts everything but the mower away; an
    // activity that needs something takes it out first, and leaves it out afterwards (like a book he has read: it stays where he used it).
    // Where something is, as a point on the grass.
    yardItemAt(key) {
      const it = this.w.yard.itemOf(key);
      return it ? (key.startsWith('ball:') ? { x: it.position.x, z: it.position.z } : { x: it.x, z: it.z }) : null;
    },
    // Walk to a free spot just outside a box (centre c, half sizes hw and hd), facing it: where he stands to pick something up or set it down.
    yardStandBox(c, hw, hd) {
      return {
        type: 'plan',
        fn: () => {
          const p = c(), g = this.g.pos, bd = this.w.doors[ID].shell.bounds, fr = this.yardFrame();
          if (!p) return [];
          const base = Math.atan2(g.x - p.x, g.z - p.z);
          for (const grid of [makeGrid(this.w.obstacles, 0.55, 0, null, fr), makeGrid(this.w.obstacles, 0.4, 0, null, fr)]) {
            for (const turn of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0, 2.5, -2.5, Math.PI]) {
              const sx = Math.sin(base + turn), sz = Math.cos(base + turn);
              const t = Math.min(hw / (Math.abs(sx) || 1e-6), hd / (Math.abs(sz) || 1e-6));      // where the line from the centre leaves the box
              const x = p.x + sx * (t + 0.75), z = p.z + sz * (t + 0.75);
              if (x < bd.minX + 0.7 || x > bd.maxX - 0.7 || z < bd.minZ + 0.7 || z > bd.maxZ - 0.7 || cellBlocked(grid, x, z)) continue;
              return [this.walk(x, z, Math.atan2(p.x - x, p.z - z))];
            }
          }
          return [];                                                         // nowhere to stand: he does it from where he is
        },
      };
    },
    // The half sizes of the ground something covers.
    yardHalf(key) {
      const it = this.w.yard.itemOf(key);
      if (!it) return [0.2, 0.2];
      if (key.startsWith('ball:')) return [it.userData.r, it.userData.r];
      const ob = it.obstacle;
      return [(ob.x1 - ob.x0) / 2, (ob.z1 - ob.z0) / 2];
    },
    // Open the shed door (or shut it): stand at the door, reach for the knob.
    shedDoor(open) {
      return [this.stand('shed', 1.2, () => this.obj('shed').knobPoint()),
        this.play('reach', 1.6, { needs: ['shed'], at: [0.8, () => { const s = this.obj('shed'); if (s) { s.setOpen(open); sfx('lid'); } }], target: () => this.obj('shed').knobPoint() })];
    },
    // Put one thing away: go to it, pick it up (it goes into his hands, then out of sight), carry it to the shed door and in.
    stowAway(key) {
      return {
        type: 'plan',
        fn: () => {
          const y = this.w.yard, it = y.itemOf(key);
          if (!it || !this.obj('shed') || y.isStowed(key)) return [];
          const steps = [];
          if (key.startsWith('ball:')) {
            const kind = key.slice(5);
            steps.push(this.yardBallStand(kind), this.pickupBall(kind, []),
              this.play('idle', 0.2, { at: [0, () => { this.ballHeld = false; y.stow(key); }] }));
          } else {
            const [hw, hd] = this.yardHalf(key);
            steps.push(this.yardStandBox(() => this.yardItemAt(key), hw, hd),
              this.play('reach', 1.2, { needs: [key], at: [0.6, () => { y.stow(key); sfx('thud', 0.8); }], target: () => { const p = this.yardItemAt(key); return p ? V(p.x, 0.5, p.z) : V(this.g.pos.x, 0.5, this.g.pos.z); } }));
          }
          steps.push(this.stand('shed', 1.2, () => this.obj('shed').knobPoint()),
            this.play('reach', 1.0, { needs: ['shed'], at: [0.5, () => sfx('thud', 0.6)], target: () => this.obj('shed').knobPoint() }));
          return steps;
        },
      };
    },
    // Put everything out in the yard away (`keys`: just those; no keys: all but the mower, which the mowing handles). The shed stays open if
    // `shut` is false (the mowing takes the mower out next).
    tidyYard(keys = null, { shut = true, mower = false } = {}) {
      return {
        type: 'plan',
        fn: () => {
          const y = this.w.yard;
          if (!this.obj('shed')) return [];
          const g = this.g.pos;
          const list = (keys || y.items().map((i) => i.key).filter((k) => mower || k !== 'mower')).filter((k) => y.itemOf(k) && !y.isStowed(k))
            .sort((a, b) => { const pa = this.yardItemAt(a), pb = this.yardItemAt(b); return Math.hypot(pa.x - g.x, pa.z - g.z) - Math.hypot(pb.x - g.x, pb.z - g.z); });
          if (!list.length) return [];
          return [...this.shedDoor(true), ...list.map((k) => this.stowAway(k)), ...(shut ? this.shedDoor(false) : [])];
        },
      };
    },
    // Take one thing out of the shed and set it down on the grass where it goes.
    takeOut(key) {
      return {
        type: 'plan',
        fn: () => {
          const y = this.w.yard;
          if (!y.itemOf(key) || !y.isStowed(key) || !this.obj('shed')) return [];
          const spot = y.spotFor(key);
          if (!spot) { y.unstow(key); return []; }
          const [hw, hd] = this.yardHalf(key);
          return [this.stand('shed', 1.2, () => this.obj('shed').knobPoint()),
            this.play('reach', 1.0, { needs: ['shed'], at: [0.5, () => sfx('thud', 0.6)], target: () => this.obj('shed').knobPoint() }),
            this.yardStandBox(() => spot, hw, hd),
            this.play('reach', 1.2, { at: [0.6, () => { y.unstow(key, spot); sfx('thud', 0.8); }], target: () => V(spot.x, 0.4, spot.z) })];
        },
      };
    },
    // The steps that get what an activity needs out of the shed (nothing if it is all out already).
    fetchOut(keys) {
      return {
        type: 'plan',
        fn: () => {
          const y = this.w.yard;
          const need = keys.filter((k) => y.itemOf(k) && y.isStowed(k)).sort((a, b) => a.startsWith('ball:') - b.startsWith('ball:'));       // (the goal before its ball)
          if (!need.length || !this.obj('shed')) return [];
          return [...this.shedDoor(true), ...need.map((k) => this.takeOut(k)), ...this.shedDoor(false)];
        },
      };
    },

    // ------------------------------------------------------------------ mowing
    // ------------------------------------------------------------------ the mower lives in the shed
    // The spot in front of the shed door where the mower is rolled out to, and the way out (the direction the shed's door faces).
    shedPark() {
      const s = this.obj('shed');
      if (!s) return null;
      const o = s.local(0, 1), len = Math.hypot(o.x, o.z) || 1, out = { x: o.x / len, z: o.z / len };
      return { x: s.x + out.x * 1.5, z: s.z + out.z * 1.5, out };
    },
    // Is the mower put away (in the shed)?
    mowerInShed() { return this.w.yard.isStowed('mower'); },
    // (the mower used to stand inside the shed and follow it about; put away, it is simply hidden)
    mowerSync() { const m = this.obj('mower'); if (m) m.tether = null; },
    // Where the mowing can start: where the mower stands; or, when it is put away, a few places in front of the shed door (straight out, or
    // a little to either side: the shed stands close to a fence, which can leave no room for the loop straight out from it).
    mowStarts() {
      const m = this.obj('mower');
      if (!this.mowerInShed()) return [{ x: m.x, z: m.z }];
      const p = this.shedPark(), s = this.obj('shed');
      if (!p) return [{ x: m.x, z: m.z }];
      const side = { x: -p.out.z, z: p.out.x }, out = [];
      for (const depth of [1.5, 2.0]) for (const lat of [0, 0.6, -0.6, 1.2, -1.2]) out.push({ x: s.x + p.out.x * depth + side.x * lat, z: s.z + p.out.z * depth + side.z * lat });
      return out;
    },
    // The steps that put the mower away when the lawn is done: push it to the shed door, then in (the door is open), and Guy shuts the door
    // after it. Whatever is in the way of the push (it never is, normally) is skipped: the mower is simply put in.
    putMowerAway() {
      const m = this.obj('mower'), s = this.obj('shed'), park = this.shedPark();
      if (!m || !s || !park) return [];
      const steps = [];
      if (Math.hypot(m.x - park.x, m.z - park.z) > 0.35) {
        const to = this.planPushVia(m, park.x, park.z, { fr: this.yardFrame(), bd: this.w.doors[ID].shell.bounds });
        if (to) steps.push(...to);
      }
      steps.push(this.play('idle', 0.8, { needs: ['shed', 'mower'], at: [0.2, () => {
        const mm = this.obj('mower'), ss = this.obj('shed');
        if (!mm || !ss) return;
        mm.setRunning(false);
        this.w.yard.stow('mower');                                   // (rolled in through the door)
        sfx('click');
      }] }));
      return steps;
    },

    // A rectangle round the lawn, pushing the mower: the first corner is where it stands. Picks one that is clear of everything.
    // mowRoute() gives the loop he would push the mower round from where it stands now: { pts, dd } (the four corners, the direction of each leg), or null
    // when there is no clear stretch of lawn (things too close to the mower, or it is jammed against a fence). Asked before he is sent
    // (so an order he cannot carry out says so, instead of him opening the shed and giving up) and again when the plan is made.
    // `pushable`: count the things Guy can shove aside (the lawn chair, the bird bath, a plant...) as not in the way; the route then lists
    // them in `blockers`. The shed, the goal and the hoop are heavy: only the user can move those.
    mowRoute({ pushable = false, tidied = false } = {}) {
      const m = this.obj('mower'), shed = this.obj('shed');
      if (!m || !shed || !this.w.doors[ID]) return null;
      const bd = this.w.doors[ID].shell.bounds, fr = this.yardFrame();
      // `tidied`: the yard's things will be put away in the shed before the mowing, so they are not in the way
      const movers = pushable ? this.yardMovers(tidied) : [];
      const away = tidied ? this.w.yard.STORE.map((it) => this.obj(it.key)).filter((o) => o && o.name !== 'mower').map((o) => o.obstacle) : [];
      const grid = makeGrid(movers.length || away.length ? this.w.obstacles.filter((o) => !away.includes(o) && !movers.some((mo) => mo.obstacle === o)) : this.w.obstacles, 0.5, 0, m.obstacle, fr);
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
      const starts = this.mowStarts();
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let route = null;
      for (const [w, h] of [[2.8, 1.8], [2.2, 1.4], [1.6, 1.0], [1.2, 0.8]]) {
        for (const start of starts) {
          for (const [ax, az] of dirs) {                                    // the first leg goes along (ax, az); the loop turns left or right
            for (const turn of [1, -1]) {
              const bx = -az * turn, bz = ax * turn;                        // the second leg's direction
              const pts = [start, { x: start.x + ax * w, z: start.z + az * w }, { x: start.x + ax * w + bx * h, z: start.z + az * w + bz * h },
                { x: start.x + bx * h, z: start.z + bz * h }, start];
              const dd = [{ x: ax, z: az }, { x: bx, z: bz }, { x: -ax, z: -az }, { x: -bx, z: -bz }];
              if (dd.every((d, i) => clearLine(pts[i], pts[i + 1], d))) { route = { pts, dd }; break; }
            }
            if (route) break;
          }
          if (route) break;
        }
        if (route) break;
      }
      if (route && pushable) { const cor = this.mowCorridor(route); route.blockers = movers.filter((mo) => this.mowBlocks(mo, cor)).map((mo) => mo.name); }
      return route;
    },

    // What in the yard Guy can shove out of the way: everything that is not heavy, except the mower itself and the sky switch (a post
    // by the fence, not furniture).
    yardMovers(tidied = false) {
      return Object.values(this.w.objects).filter((o) => !o.stowed && o.weight !== 'heavy' && o.name !== 'mower' && o.name !== 'skyswitch' && o.obstacle && this.w.roomIdAt(o.x, o.z) === ID
        && !(tidied && this.w.yard.STORE.some((it) => it.key === o.name)));
    },
    // Points along a route where the mower and then Guy (behind it) pass.
    mowCorridor(route) {
      const out = [];
      for (let i = 0; i < 4; i++) {
        const a = route.pts[i], b = route.pts[i + 1], d = route.dd[i], n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2));
        for (let k = 0; k <= n; k++) {
          const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
          out.push({ x, z }, { x: x - d.x * 0.95, z: z - d.z * 0.95 });
        }
      }
      return out;
    },
    mowBlocks(o, corridor) {
      const ob = o.obstacle;
      return corridor.some((c) => c.x > ob.x0 - 0.5 && c.x < ob.x1 + 0.5 && c.z > ob.z0 - 0.5 && c.z < ob.z1 + 0.5);
    },
    // Places to leave `o` where it is clear of the mowing and of everything else, the nearest first.
    yardSpots(o, corridor) {
      const bd = this.w.doors[ID].shell.bounds, half = Math.max(o.w, o.d) / 2, out = [];
      for (let x = bd.minX + 1.0 + half; x <= bd.maxX - 1.0 - half; x += 0.4) {
        for (let z = bd.minZ + 1.0 + half; z <= bd.maxZ - 1.0 - half; z += 0.4) {
          const x0 = x - o.w / 2 - 0.5, x1 = x + o.w / 2 + 0.5, z0 = z - o.d / 2 - 0.5, z1 = z + o.d / 2 + 0.5;
          if (this.w.obstacles.some((ob) => ob !== o.obstacle && ob.active !== false && x1 > ob.x0 && x0 < ob.x1 && z1 > ob.z0 && z0 < ob.z1)) continue;
          if (corridor.some((c) => Math.hypot(c.x - x, c.z - z) < half + 0.9)) continue;
          out.push({ x, z, d: Math.hypot(x - o.x, z - o.z) });
        }
      }
      return out.sort((a, b) => a.d - b.d).slice(0, 14);
    },
    // A plan step: when reached, pushes `name` somewhere clear of the mowing (nothing to do if it is already clear).
    shoveAside(name, corridor) {
      return {
        type: 'plan',
        fn: () => {
          const o = this.obj(name);
          if (!o || !this.mowBlocks(o, corridor)) return [];
          const room = { fr: this.yardFrame(), bd: this.w.doors[ID].shell.bounds };
          for (const s of this.yardSpots(o, corridor)) {
            const steps = this.planPushVia(o, s.x, s.z, room);
            if (steps) return [this.play('idle', 0.3), ...steps, this.play('idle', 0.5)];
          }
          this.ui(`could not move the ${name} out of the way`); this.queue.length = 0; return [];
        },
      };
    },

    mowPlan() {
      const m = this.obj('mower'), shed = this.obj('shed');
      if (!m || !shed) { this.queue.length = 0; return []; }
      let route = this.mowRoute();
      if (!route) {                                                         // things in the way: shove the light ones aside first, then mow
        const r2 = this.mowRoute({ pushable: true });
        if (!r2) { this.ui('no room to mow'); this.queue.length = 0; return []; }
        const cor = this.mowCorridor(r2);
        return [...r2.blockers.map((n) => this.shoveAside(n, cor)),
          { type: 'plan', fn: () => { const rr = this.mowRoute(); if (!rr) { this.ui('no room to mow'); this.queue.length = 0; return []; } return this.mowLoop(rr); } }];
      }
      return this.mowLoop(route);
    },

    // The steps for pushing the mower once round `route`.
    mowLoop(route) {
      const m = this.obj('mower'), BEHIND = 0.95;
      const { pts, dd } = route, steps = [];
      const faceFor = (d) => this.w.rotFacing(-d.x, -d.z);                  // (the mower's front is its local -z)
      const behind = (p, d) => ({ x: p.x - d.x * BEHIND, z: p.z - d.z * BEHIND });
      steps.push(this.play('idle', 0.05, { at: [0, () => { const c = this.w.yard.cut(); if (c) c.clear(); }] }));
      for (let i = 0; i < 4; i++) {
        const d = dd[i], from = pts[i], to = pts[i + 1], g0 = behind(from, d), g1 = behind(to, d);
        steps.push({ ...this.walk(g0.x, g0.z, Math.atan2(d.x, d.z)), direct: i > 0 });
        steps.push(this.play('idle', 0.4, { at: [0, () => { const mm = this.obj('mower'); if (mm) { if (this.w.yard.isStowed('mower')) this.w.yard.unstow('mower', from); mm.tether = null; mm.rot = faceFor(d); mm.set(from.x, from.z); sfx('click'); } }] }));
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

    // Cut short while mowing (told to do something else, no room to mow...): the shed door he opened must not be left hanging open.
    // Called by choose() whenever a new activity begins, so a mow that finished properly (door already shut) is not touched.
    yardCleanup() {
      const s = this.obj('shed');
      if (s && s.openTo) { s.setOpen(false); sfx('lid'); }
      this.mowerSync();
    },

    // ------------------------------------------------------------------ the activities
    yardActivities() {
      const w = this.w;
      const k = (id) => this.skills.has(id);
      const night = () => w.yard.isNight();
      return {
        // the lawn chair: a long rest in the open air
        yardsit: () => this.yardTrip('relaxing in the lawn chair', [this.fetchOut(['lawnchair']), {
          type: 'plan',
          fn: () => {
            const c = this.obj('lawnchair');
            if (!c) { this.queue.length = 0; return []; }
            return [this.walkAt('lawnchair', 0, c.sit.gap, Math.PI), this.play('sitRest', rand(14, 22), { chairSit: true, chair: 'lawnchair', needs: ['lawnchair'] })];
          },
        }]),
        birdbath: () => this.yardTrip('looking at the bird bath', [this.fetchOut(['birdbath']),
          this.stand('birdbath', 0.75, () => this.obj('birdbath').basinPoint()),
          this.play('reach', 1.9, { needs: ['birdbath'], at: [0.9, () => { const b = this.obj('birdbath'); if (b) b.splash(); sfx('splash'); }], target: () => this.obj('birdbath').basinPoint() }),
          this.play('idle', 1.4)]),
        // the sky switch: day becomes night and night becomes day
        skyswitch: () => this.yardTrip(night() ? 'switching the sun on' : 'switching the moon on', [this.fetchOut(['skyswitch']),
          this.stand('skyswitch', 0.6, () => this.obj('skyswitch').leverPoint()),
          this.play('reach', 1.8, { needs: ['skyswitch'], at: [0.9, () => { w.yard.setNight(!w.yard.isNight()); sfx('click'); sfx('chime'); }], target: () => this.obj('skyswitch').leverPoint() }),
          this.play('idle', 1.2)]),
        mow: () => this.yardTrip('mowing the lawn', [
          this.tidyYard(null, { shut: false }),                              // first everything in the yard goes into the shed
          this.stand('shed', 1.2, () => this.obj('shed').knobPoint()),
          this.play('reach', 1.6, { needs: ['shed'], at: [0.8, () => { const s = this.obj('shed'); if (s) { s.setOpen(true); sfx('lid'); } }], target: () => this.obj('shed').knobPoint() }),
          this.play('idle', 0.8),
          { type: 'plan', fn: () => this.mowPlan() },
          { type: 'plan', fn: () => this.putMowerAway() },               // the lawn is done: the mower goes back in the shed
          this.stand('shed', 1.2, () => this.obj('shed').knobPoint()),
          this.play('reach', 1.6, { needs: ['shed'], at: [0.8, () => { const s = this.obj('shed'); if (s) { s.setOpen(false); sfx('lid'); } }], target: () => this.obj('shed').knobPoint() })]),
        // no book yet: just poking a ball about with his foot
        yardpoke: () => { const first = pick(this.pokeKinds().length ? this.pokeKinds() : [null]); return this.yardTrip('poking a ball about the yard', [this.fetchOut(first ? [`ball:${first}`] : []), {
          type: 'plan',
          fn: () => {
            const kinds = this.pokeKinds();
            if (!kinds.length) { this.queue.length = 0; return []; }
            const kind = kinds.includes(first) ? first : pick(kinds), b = this.yardBall(kind), bd = w.doors[ID].shell.bounds, fr = this.yardFrame();
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
        }]); },
        // the shed: put things away in it, or take them out (the user picks them from the shed's list; the order is in this.yardTask)
        yardtidy: () => {
          const t = this.yardTask || { mode: 'away', keys: null };
          this.yardTask = null;
          return this.yardTrip(t.mode === 'out' ? 'taking things out of the shed' : 'putting things away in the shed',
            [t.mode === 'out' ? this.fetchOut(t.keys || []) : this.tidyYard(t.keys, { mower: true })]);
        },
        goalshot: () => this.yardTrip('taking shots at the goal', [this.fetchOut(['soccergoal', 'ball:soccer']), ...this.goalKick(0.55), ...this.goalKick(0.7), ...this.goalKick(0.85)]),
        soccertoss: () => this.yardTrip('tossing the soccer ball up and catching it', [this.fetchOut(['soccergoal', 'ball:soccer']), this.yardBallStand('soccer'),
          this.pickupBall('soccer', ['soccergoal']), this.play('toss', 6.85, { ball: true, ballKind: 'soccer', needs: ['soccergoal'] }), this.putdownBall('soccer', ['soccergoal'])]),
        hoopdribble: () => this.yardTrip('dribbling the basketball', [this.fetchOut(['basketballhoop', 'ball:basketball']), this.yardBallStand('basketball'),
          this.pickupBall('basketball', ['basketballhoop']), this.play('dribble', 9, { ball: true, ballKind: 'basketball', needs: ['basketballhoop'] }), this.putdownBall('basketball', ['basketballhoop'])]),
        hoopshoot: () => this.yardTrip('shooting hoops', [this.fetchOut(['basketballhoop', 'ball:basketball']), ...this.hoopShot(0.55), ...this.hoopShot(0.65), ...this.hoopShot(0.75)]),
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
