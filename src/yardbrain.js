// GUY (and GAL) in the Backyard: going out through the door, sitting in the lawn chair, the bird bath, switching between day and night,
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
export const YARD_ACTS = ['yardsit', 'birdbath', 'skyswitch', 'mow', 'yardpoke', 'goalshot', 'soccertoss', 'hoopshoot', 'hoopdribble', 'yardtidy', 'hoopdefend', 'goalkeep'];
export const YARD_OBJECTS = ['soccergoal', 'basketballhoop', 'lawnchair', 'birdbath', 'skyswitch', 'shed', 'mower'];

export function installYard(Brain, POSES, H) {
  const { clamp, rand, pick, makeGrid, cellBlocked, INFLATE, findPath } = H;

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
          let base = Math.atan2(g.x - p.x, g.z - p.z);                        // from the ball towards GUY
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
      return [this.yardBallStand('soccer', () => (this.obj('soccergoal') ? this.obj('soccergoal').at(0, 0, 0.35) : null)), this.waitPartner('soccer', 0),
        {
          type: 'plan',
          fn: () => {
            const goal = this.obj('soccergoal'), ball = this.yardBall('soccer');
            if (!goal || !ball) { this.queue.length = 0; return []; }
            const before = this.w.yard.score.goals;
            const keeper = !!this.guard('soccer');
            let side = Math.random() < good * (keeper ? 0.85 : 1) ? rand(-0.8, 0.8) : (Math.random() < 0.5 ? -1 : 1) * rand(1.4, 2.0);   // a miss goes wide of the post
            const aim = () => goal.at(side, rand(0.2, 0.75), 0.0);
            return [this.play('kick', 1.2, {
              needs: ['soccergoal'],
              at: [0.5, () => {
                const b = this.yardBall('soccer'), gl = this.obj('soccergoal');
                if (!b || !gl) return;
                if (this.keepShot(side)) side = Math.sign(side || 1) * 1.8;                // the keeper gets a hand to it: it goes wide
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
    // in the shed (world.yard.stow / unstow hide it and take it out of the way). Before mowing GUY puts everything but the mower away; an
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
          if (this.otherUses(key)) return [];                      // the other robot is sitting in it / playing at it: it stays where it is
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
          const list = (keys || y.items().map((i) => i.key).filter((k) => mower || k !== 'mower')).filter((k) => y.itemOf(k) && !y.isStowed(k) && !this.otherUses(k))
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
    // The steps that put the mower away when the lawn is done: push it to the shed door, then in (the door is open), and GUY shuts the door
    // after it. Whatever is in the way of the push (it never is, normally) is skipped: the mower is simply put in.
    putMowerAway() {
      const m = this.obj('mower'), s = this.obj('shed'), park = this.shedPark();
      if (!m || !s || !park) return [];
      const steps = [];
      if (Math.hypot(m.x - park.x, m.z - park.z) > 0.35) steps.push(this.mowTransport(park, Math.atan2(-park.out.x, -park.out.z)));      // (steered in, handle first out)
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
    // `pushable`: count the things GUY can shove aside (the lawn chair, the bird bath, a plant...) as not in the way; the route then lists
    // them in `blockers`. The shed, the goal and the hoop are heavy: only the user can move those.
    mowRoute({ pushable = false, tidied = false } = {}) {
      const m = this.obj('mower'), shed = this.obj('shed');
      if (!m || !shed || !this.w.doors[ID]) return null;
      const bd = this.w.doors[ID].shell.bounds, fr = this.yardFrame();
      // `tidied`: the yard's things will be put away in the shed before the mowing, so they are not in the way
      const movers = pushable ? this.yardMovers(tidied) : [];
      const away = tidied ? this.w.yard.STORE.map((it) => this.obj(it.key)).filter((o) => o && o.name !== 'mower').map((o) => o.obstacle) : [];
      const still = this.w.obstacles.filter((o) => !o.char);                // (the robots walk about: where one stands now is no reason not to mow)
      const grid = makeGrid(movers.length || away.length ? still.filter((o) => !away.includes(o) && !movers.some((mo) => mo.obstacle === o)) : still, 0.5, 0, m.obstacle, fr);
      const BEHIND = 0.95;
      const clearLine = (a, b, off) => {                                    // the mower's line a-b, and GUY's line behind it
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

    // What in the yard GUY can shove out of the way: everything that is not heavy, except the mower itself and the sky switch (a post
    // by the fence, not furniture).
    yardMovers(tidied = false) {
      return Object.values(this.w.objects).filter((o) => !o.stowed && o.weight !== 'heavy' && o.name !== 'mower' && o.name !== 'skyswitch' && o.obstacle && this.w.roomIdAt(o.x, o.z) === ID
        && !(tidied && this.w.yard.STORE.some((it) => it.key === o.name)));
    },
    // Points along a route where the mower and then GUY (behind it) pass.
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

    // ------------------------------------------------------------------ mowing the whole lawn
    // The mower goes up and down the lawn in lanes one cutting-width apart, turning round at the ends in smooth U-turns while he steers it
    // from behind (`driveStep` in brain.js): he never walks round it to the other side. The middle lane is cut first, then the ones
    // above it, then the ones below (so every turn happens with room for him behind the mower, none against the fence). Where a heavy
    // thing (the shed, the goal, the hoop) cuts a lane, the mower is steered round to the next stretch. The two short strips at the ends of
    // the lanes are cut last, each from its middle out to the fence.
    // The heading of the mower now (the angle its front points: 0 is +z, a quarter turn is +x).
    mowerHeading(m) { return m.group.rotation.y + Math.PI; },
    // Steps that steer the mower along `pts` (a polyline of where its middle goes), starting in the direction it is pointing now (`h0`).
    driveSteps(pts, h0) {
      const m = this.obj('mower');
      const dense = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const a = dense[dense.length - 1], b = pts[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.12);
        for (let k = 1; k <= n; k++) dense.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
      }
      const B = 0.8, g0 = { x: dense[0].x - Math.sin(h0) * B, z: dense[0].z - Math.cos(h0) * B };
      return [this.walk(g0.x, g0.z, h0),
        { type: 'walk', x: g0.x, z: g0.z, yaw: null, drive: { obj: m, pts: dense, speed: 1.1, h0 } }];
    },
    // Steer the mower from where it is to `to`, arriving pointing `hTo` (straight in over the last bit). A plan step: looked at when reached.
    mowTransport(to, hTo) {
      return {
        type: 'plan',
        fn: () => {
          const m = this.obj('mower');
          if (!m) { this.queue.length = 0; return []; }
          const h = this.mowerHeading(m), a = { x: m.x, z: m.z };
          if (Math.hypot(a.x - to.x, a.z - to.z) < 0.15) return [];
          const fr = this.yardFrame(), bd = this.w.doors[ID].shell.bounds;
          const mg = makeGrid(this.w.obstacles.filter((o) => !o.char), 0.42, 0, m.obstacle, fr);
          const ahead = (p, d, len) => ({ x: p.x + Math.sin(d) * len, z: p.z + Math.cos(d) * len });
          const okp = (p) => p.x > bd.minX + 0.5 && p.x < bd.maxX - 0.5 && p.z > bd.minZ + 0.35 && p.z < bd.maxZ - 0.35 && !cellBlocked(mg, p.x, p.z);
          const sharp = (pts) => {                                         // a turn of more than 110 degrees at a corner: he cannot steer that
            for (let i = 1; i + 1 < pts.length; i++) {
              const ux = pts[i].x - pts[i - 1].x, uz = pts[i].z - pts[i - 1].z, vx = pts[i + 1].x - pts[i].x, vz = pts[i + 1].z - pts[i].z, lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
              if (lu > 0.05 && lv > 0.05 && (ux * vx + uz * vz) / (lu * lv) < -0.35) return true;
            }
            return false;
          };
          for (const [lead, land] of [[0.6, 0.7], [0.35, 0.4], [0.6, 0.2], [0.2, 0.7], [0.2, 0.2], [0, 0.7], [0, 0.35], [0, 0]]) {      // (a short lead-in and landing when there is little room)
            const first = lead ? ahead(a, h, lead) : a, appr = land ? ahead(to, hTo, -land) : to;
            if (!okp(first) || !okp(appr)) continue;
            const route = findPath(mg, first.x, first.z, appr.x, appr.z, true);
            if (!route) continue;
            const pts = [a, ...(lead ? [first] : []), ...route, ...(land ? [appr] : []), to];
            if (!sharp(pts)) return [this.play('idle', 0.2), ...this.driveSteps(pts, h)];
          }
          return this.planPushVia(m, to.x, to.z, { fr, bd }) || [];                // (no clear way to steer it there: shove it, as before)
        },
      };
    },
    // The legs (each a polyline for the mower's middle, with the way it points at the start) that cover the lawn; null when there is none.
    // `tidied`: the yard's things will have been put away in the shed first, so they are not in the way.
    mowCoverage({ tidied = false } = {}) {
      const m = this.obj('mower');
      if (!m || !this.w.doors[ID]) return null;
      const bd = this.w.doors[ID].shell.bounds, fr = this.yardFrame();
      const away = tidied ? this.w.yard.STORE.map((it) => this.obj(it.key)).filter((o) => o && o.name !== 'mower').map((o) => o.obstacle) : [];
      // a mower left jammed in a corner or against the fence cannot be got hold of: he needs room behind it, pointing some way
      if (!this.mowerInShed()) {
        const gg0 = makeGrid(this.w.obstacles.filter((o) => !o.char && !away.includes(o)), INFLATE, 0, m.obstacle, fr);
        const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const q = { x: m.x - dx * 0.8, z: m.z - dz * 0.8 }; return q.x > bd.minX + 0.5 && q.x < bd.maxX - 0.5 && q.z > bd.minZ + 0.5 && q.z < bd.maxZ - 0.5 && !cellBlocked(gg0, q.x, q.z); });
        const inside = m.x > bd.minX + 0.5 && m.x < bd.maxX - 0.5 && m.z > bd.minZ + 0.35 && m.z < bd.maxZ - 0.35;
        if (!free || !inside) return null;
      }
      const still = this.w.obstacles.filter((o) => !o.char && !away.includes(o));        // (not the robots: they walk about, and the other one is sent out of the yard first)
      const mg = makeGrid(still, 0.42, 0, m.obstacle, fr), gg = makeGrid(still, INFLATE, 0, m.obstacle, fr);
      const SW = 0.46, R = SW / 2, BEH = 0.8, STEP = 0.12;
      const alongX = bd.maxX - bd.minX >= bd.maxZ - bd.minZ;
      const A0 = alongX ? bd.minX : bd.minZ, A1 = alongX ? bd.maxX : bd.maxZ, C0 = alongX ? bd.minZ : bd.minX, C1 = alongX ? bd.maxZ : bd.maxX;
      const P = (t, c) => (alongX ? { x: t, z: c } : { x: c, z: t });
      const hOf = (dir) => (alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
      const inB = (p, mx, mz) => p.x > bd.minX + mx && p.x < bd.maxX - mx && p.z > bd.minZ + mz && p.z < bd.maxZ - mz;
      const okM = (p, heading) => {                                          // the mower here, pointing `heading`: clear, and inside the fence
        const side = Math.abs(Math.sin(heading)) > 0.5, lx = side ? 0.62 : 0.4, lz = side ? 0.4 : 0.62;
        return inB(p, lx, lz) && !cellBlocked(mg, p.x, p.z);
      };
      const okG = (p, heading) => { const q = { x: p.x - Math.sin(heading) * BEH, z: p.z - Math.cos(heading) * BEH }; return inB(q, 0.5, 0.5) && !cellBlocked(gg, q.x, q.z); };      // (he can stand half a metre in from the fence, no nearer: world.walkable)
      const ok = (p, heading) => okM(p, heading) && okG(p, heading);
      const n = Math.floor((C1 - C0 - 0.8) / SW) + 1;
      if (n < 1) return null;
      const c0 = C0 + 0.4 + (C1 - C0 - 0.8 - (n - 1) * SW) / 2, lane = (i) => c0 + i * SW;
      // the stretches of lane i the mower can travel pointing `dir`, in the order they are travelled: [{ a, b }] (from a to b along the lane)
      const segments = (i, dir) => {
        const h = hOf(dir), runs = [];
        let from = null, last = null;
        for (let t = A0 + 0.5 + BEH; t <= A1 - 0.5 - BEH + 1e-6; t += STEP) {
          if (ok(P(t, lane(i)), h)) { if (from === null) from = t; last = t; }
          else if (from !== null) { runs.push([from, last]); from = null; }
        }
        if (from !== null) runs.push([from, last]);
        const segs = runs.filter(([a, b]) => b - a >= 0.5).map(([a, b]) => (dir > 0 ? { a, b } : { a: b, b: a }));
        return dir > 0 ? segs : segs.reverse();
      };
      const line = (c, a, b) => { const k = Math.max(1, Math.ceil(Math.abs(b - a) / STEP)), out = []; for (let j = 0; j <= k; j++) out.push(P(a + ((b - a) * j) / k, c)); return out; };
      // the lane the first phase starts on: far enough from the near fence that he has room beside the mower at the first turn
      let k0 = 0;
      while (k0 < n - 1 && lane(k0) + R - BEH < C0 + 0.5) k0++;
      const order = []; for (let i = k0; i < n; i++) order.push(i); for (let i = k0 - 1; i >= 0; i--) order.push(i);
      const legs = [];
      let leg = null, prev = null;
      order.forEach((i, oi) => {
        const dir = oi % 2 ? -1 : 1, segs = segments(i, dir);
        segs.forEach((sg, si) => {
          let pts = line(lane(i), sg.a, sg.b), aUsed = sg.a;
          let joined = false;
          if (si === 0 && prev && prev.oi === oi - 1 && Math.abs(prev.t - sg.a) < 1.2 && Math.abs(lane(i) - lane(prev.i)) < SW + 0.01) {
            // a half circle round the end of the lane, from the lane just cut into this one. The two lanes turn at the same place: the
            // one that goes less far out (a heavy thing in the way of the other) sets it.
            const tj = prev.dir > 0 ? Math.min(prev.t, sg.a) : Math.max(prev.t, sg.a);
            const pp = line(lane(prev.i), prev.a, tj), pn = line(lane(i), tj, sg.b);
            const cs = Math.sign(lane(i) - lane(prev.i)), cm = (lane(i) + lane(prev.i)) / 2, arc = [];
            let good = Math.abs(tj - prev.a) >= 0.5 && Math.abs(sg.b - tj) >= 0.5;
            for (let j = 1; j < 12 && good; j++) {
              const ph = (Math.PI * j) / 12, p = P(tj + prev.dir * R * Math.sin(ph), cm - cs * R * Math.cos(ph));
              const along = prev.dir * Math.cos(ph), across = cs * Math.sin(ph);          // the way it points here: along the lane, across it, back along it
              if (!ok(p, alongX ? Math.atan2(along, across) : Math.atan2(across, along))) good = false;
              arc.push(p);
            }
            if (good) { leg.pts.splice(leg.pts.length - prev.n, prev.n, ...pp); pts = pn; aUsed = tj; leg.pts.push(...arc, ...pts); joined = true; }
          }
          if (!joined) { leg = { h: hOf(dir), pts }; legs.push(leg); }
          prev = si === segs.length - 1 ? { oi, i, t: sg.b, a: aUsed, dir, n: pts.length } : null;
        });
        if (!segs.length) prev = null;
      });
      // the strips at the two ends of the lanes, each from the middle out to the fence (so he always has room behind the mower)
      const mid = (C0 + C1) / 2;
      for (const t of [A0 + 0.85, A1 - 0.85]) {
        for (const dir of [1, -1]) {
          const h = alongX ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          const to = dir > 0 ? C1 - (alongX ? 0.4 : 0.62) : C0 + (alongX ? 0.4 : 0.62), kk = Math.max(1, Math.ceil(Math.abs(to - mid) / STEP)), clear = [];
          for (let j = 0; j <= kk; j++) { const p = P(t, mid + ((to - mid) * j) / kk); if (!ok(p, h)) break; clear.push(p); }
          if (clear.length > 4) legs.push({ h, pts: clear });
        }
      }
      return legs.length ? { legs, alongX, SW } : null;
    },

    // The whole job: roll the mower out of the shed, cut every lane and strip, then (putMowerAway) steer it back in.
    mowCover(cov) {
      const m = this.obj('mower'), park = this.shedPark(), steps = [];
      const hp = Math.atan2(park.out.x, park.out.z), B = 0.8;
      steps.push(this.play('idle', 0.05, { at: [0, () => { const c = this.w.yard.cut(); if (c) c.clear(); }] }));
      steps.push({ type: 'plan', fn: () => {                              // the other robot is out on the lawn: it is asked to come in while the mowing goes on
        const o = this.other;
        if (o && o.inYard() && !o.lock && !o.stuckIn()) { o.pendingActivity = 'leave'; o.skip(true); }
        return [];
      } });
      steps.push({ type: 'plan', fn: () => {
        const mm = this.obj('mower');
        if (!mm || !this.w.yard.isStowed('mower')) return [];                    // already out on the lawn: it is steered from where it stands
        return [this.walk(park.x - Math.sin(hp) * B, park.z - Math.cos(hp) * B, hp),
          this.play('idle', 0.4, { at: [0, () => { const m2 = this.obj('mower'); if (m2) { this.w.yard.unstow('mower', park); m2.tether = null; m2.rot = this.w.rotFacing(park.out.x, park.out.z); m2.set(park.x, park.z); m2.group.rotation.y = m2.yaw; sfx('click'); } }] })];
      } });
      for (const leg of cov.legs) {
        steps.push(this.mowTransport(leg.pts[0], leg.h));
        steps.push({ type: 'plan', fn: () => { const mm = this.obj('mower'); return mm ? this.driveSteps(leg.pts, this.mowerHeading(mm)) : []; } });
      }
      void m;
      return steps;
    },

    mowPlan() {
      const m = this.obj('mower'), shed = this.obj('shed');
      if (!m || !shed) { this.queue.length = 0; return []; }
      const cov = this.mowCoverage();
      if (cov) return this.mowCover(cov);
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
      const mw = this.obj('mower');
      if (mw && mw.hauled) { mw.hauled = false; mw.hauledYaw = undefined; }           // (cut short while steering it)
      this.mowerSync();
    },

    // ------------------------------------------------------------------ playing together
    // Sometimes the other robot joins in a game: against a basketball shooter she (or he) plays defence, in front of a soccer goal she
    // keeps goal. Whoever starts a shot-taking activity may invite the other (`inviteSportPartner`): she then runs `hoopdefend` or
    // `goalkeep`, shuffling about between the shooter and the hoop or standing in the goal mouth, and reacts to each shot (jumping to
    // block it, diving for it). A good defence makes shots miss more often; the shooter does not need her.
    // Is he taking shots at that sport's goal right now?
    sportPlaying(kind) {
      const acts = kind === 'basketball' ? ['hoopshoot', 'hoopdribble'] : ['goalshot', 'soccertoss'];
      return acts.includes(this.last) && !!(this.step || this.queue.length) && this.inYard();
    },
    // A plan step at the start of a sport activity: now and then the other robot is called over to play against him.
    inviteSportPartner(kind) {
      return {
        type: 'plan',
        fn: () => {
          const o = this.other, act = kind === 'basketball' ? 'hoopdefend' : 'goalkeep';
          if (!o || o.lock || o.stuckIn() || o.pendingActivity || Math.random() > 0.5) return [];
          if (!['wander', 'stretch', 'wave', 'sit', 'slouch', 'yardsit', 'birdbath', 'skyswitch', 'yardpoke', 'plant', 'lamp', 'mood', 'dance', 'dancemoves', 'read'].includes(o.last)) return [];
          if (!o.available(act)) return [];
          o.skip(true); o.pendingActivity = act;
          return [];
        },
      };
    },
    // Wait (at most about half a minute) until the invited robot is out in the yard and in her ready stance.
    waitPartner(kind, n) {
      return {
        type: 'plan',
        fn: () => {
          const o = this.other, act = kind === 'basketball' ? 'hoopdefend' : 'goalkeep';
          if (!o || (n === 0 && o.last !== act)) return [];                       // (nobody was invited)
          const ready = o && o.last === act && o.inYard() && ['defend', 'keeper'].includes(o.pose);
          if (!o || o.last !== act && n > 3 || n >= 45 || (ready && n >= 1)) return [];
          return [this.play('idle', 0.6), this.waitPartner(kind, n + 1)];
        },
      };
    },
    // The other robot, when she is playing defence / keeping goal against him now (null otherwise).
    guard(kind) {
      const o = this.other;
      return o && o.last === (kind === 'basketball' ? 'hoopdefend' : 'goalkeep') && o.step && o.inYard() ? o : null;
    },
    // Where to stand, and the way to face: between the shooter and the hoop, or in front of the goal.
    guardSpot(kind, shooter) {
      const hoop = this.obj(kind === 'basketball' ? 'basketballhoop' : 'soccergoal');
      if (!hoop) return null;
      const bd = this.w.doors[ID].shell.bounds, fr = this.yardFrame(), grid = makeGrid(this.w.obstacles.filter((o) => !o.char), 0.4, 0, null, fr);
      const S = shooter || { x: bd.minX + (bd.maxX - bd.minX) * 0.4, z: (bd.minZ + bd.maxZ) / 2 };
      const fits = (p) => p.x > bd.minX + 0.55 && p.x < bd.maxX - 0.55 && p.z > bd.minZ + 0.55 && p.z < bd.maxZ - 0.55 && !cellBlocked(grid, p.x, p.z);
      const cands = [];
      if (kind === 'basketball') {
        const H = { x: hoop.x, z: hoop.z }, d = Math.hypot(H.x - S.x, H.z - S.z) || 1, u = { x: (H.x - S.x) / d, z: (H.z - S.z) / d };
        for (const k of [0.95, 1.25, 0.7, 1.6]) for (const lat of [0, 0.35, -0.35]) cands.push({ x: S.x + u.x * k - u.z * lat, z: S.z + u.z * k + u.x * lat });
      } else {
        const front = hoop.at(0, 0, 1.0), side = [0, 0.25, -0.25];
        const fx = front.x - hoop.x, fz = front.z - hoop.z, fl = Math.hypot(fx, fz) || 1;
        for (const k of [1.0, 1.3, 0.8]) for (const lat of side) cands.push({ x: hoop.x + (fx / fl) * k - (fz / fl) * lat, z: hoop.z + (fz / fl) * k + (fx / fl) * lat });
      }
      const p = cands.find(fits);
      return p ? { x: p.x, z: p.z, yaw: Math.atan2(S.x - p.x, S.z - p.z) } : null;
    },
    // The steps of playing defence / keeping goal: stand ready, stay between the shooter and the goal, until the game is over.
    sportGuard(kind, n = 0) {
      const lead = this.other, playing = !!(lead && lead.sportPlaying(kind));
      if (n >= 14 || (n >= 2 && !playing)) return [this.play('idle', 0.4)];
      const spot = this.guardSpot(kind, playing ? { x: lead.g.root.position.x, z: lead.g.root.position.z } : null);
      if (!spot) { this.queue.length = 0; return []; }
      const need = [kind === 'basketball' ? 'basketballhoop' : 'soccergoal'];
      // (with nobody to play against, the second go is a practice jump / dive: how the QA run sees those poses)
      const practice = !playing && n === 1 ? [this.play(kind === 'basketball' ? 'block' : 'dive', 1.3, { needs: need, dive: 1 })] : [];
      return [{ ...this.walk(spot.x, spot.z, spot.yaw), direct: false },
        this.play(kind === 'basketball' ? 'defend' : 'keeper', rand(1.8, 2.8), { needs: need }), ...practice,
        { type: 'plan', fn: () => this.sportGuard(kind, n + 1) }];
    },
    // The shooter lets go of a basketball shot: the defender may jump for it. Returns true when it is blocked (the shot goes astray).
    defendShot() {
      const d = this.guard('basketball');
      if (!d) return false;
      const jump = Math.random() < 0.75, blocked = jump && Math.random() < 0.35;
      if (jump) d.interject(d.play('block', 1.1, { needs: ['basketballhoop'] }));
      return blocked;
    },
    // A kick at the goal: the keeper dives one way. `side` is where the shot goes (left or right of the middle, in goal units); returns
    // true when she saves it.
    keepShot(side) {
      const k = this.guard('soccer'), goal = this.obj('soccergoal');
      if (!k || !goal) return false;
      const kp = k.g.root.position, aim = goal.at(side, 0.3, 0.1), kf = k.g.root.rotation.y;
      const lat = (aim.x - kp.x) * Math.cos(kf) - (aim.z - kp.z) * Math.sin(kf);          // + = to her left
      const right = Math.random() < 0.6;                                                    // she guesses the side right six times in ten
      const dir = right ? Math.sign(lat || 1) : -Math.sign(lat || 1);
      k.interject(k.play('dive', 1.2, { dive: dir, needs: ['soccergoal'] }));
      return right && Math.abs(side) < 1.0 && Math.random() < 0.75;
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
        goalshot: () => this.yardTrip('taking shots at the goal', [this.fetchOut(['soccergoal', 'ball:soccer']), this.inviteSportPartner('soccer'), ...this.goalKick(0.55), ...this.goalKick(0.7), ...this.goalKick(0.85)]),
        soccertoss: () => this.yardTrip('tossing the soccer ball up and catching it', [this.fetchOut(['soccergoal', 'ball:soccer']), this.inviteSportPartner('soccer'), this.yardBallStand('soccer'), this.waitPartner('soccer', 0),
          this.pickupBall('soccer', ['soccergoal']), this.play('toss', 6.85, { ball: true, ballKind: 'soccer', needs: ['soccergoal'] }), this.putdownBall('soccer', ['soccergoal'])]),
        hoopdribble: () => this.yardTrip('dribbling the basketball', [this.fetchOut(['basketballhoop', 'ball:basketball']), this.inviteSportPartner('basketball'), this.yardBallStand('basketball'), this.waitPartner('basketball', 0),
          this.pickupBall('basketball', ['basketballhoop']), this.play('dribble', 9, { ball: true, ballKind: 'basketball', needs: ['basketballhoop'] }), this.putdownBall('basketball', ['basketballhoop'])]),
        // playing with the other robot: she defends the hoop or keeps goal while he takes his shots (started by his invitation)
        hoopdefend: () => this.yardTrip('defending the hoop', [{ type: 'plan', fn: () => this.sportGuard('basketball') }]),
        goalkeep: () => this.yardTrip('keeping goal', [{ type: 'plan', fn: () => this.sportGuard('soccer') }]),
        hoopshoot: () => this.yardTrip('shooting hoops', [this.fetchOut(['basketballhoop', 'ball:basketball']), this.inviteSportPartner('basketball'), ...this.hoopShot(0.55), ...this.hoopShot(0.65), ...this.hoopShot(0.75)]),
      };
    },

    // pick the ball up on the far side of it from the hoop and shoot (the ball goes up to the rim; some miss)
    hoopShot(good) {
      const rim = () => (this.obj('basketballhoop') ? this.obj('basketballhoop').rimPoint() : null);
      return [this.yardBallStand('basketball', rim), this.waitPartner('basketball', 0),
        this.pickupBall('basketball', ['basketballhoop']),
        {
          type: 'plan',
          fn: () => {
            const hoop = this.obj('basketballhoop');
            if (!hoop || !this.yardBall('basketball')) { this.queue.length = 0; return []; }
            const before = this.w.yard.score.baskets;
            const miss = Math.random() > good * (this.guard('basketball') ? 0.8 : 1), off = miss ? (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 0.5) : rand(-0.05, 0.05);
            const lat = rand(-1, 1) > 0 ? 1 : -1;
            return [this.play('shoot', 2.7, {
              ball: true, ballKind: 'basketball', needs: ['basketballhoop'],
              at: [1.05, () => {
                const b = this.yardBall('basketball'), h = this.obj('basketballhoop');
                if (!b || !h) return;
                const t = h.rimPoint(), d = Math.hypot(t.x - b.position.x, t.z - b.position.z);
                const blocked = this.defendShot();                                          // she jumps for it: sometimes the shot is blocked
                const sideways = V(-(t.z - b.position.z), 0, t.x - b.position.x).normalize().multiplyScalar(blocked ? 0.9 * lat : off * lat);
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
