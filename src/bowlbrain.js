// GUY (and GAL) at the Bowling Alley: in through the door, a ball from the rack, then roll after roll down his lane. Installed onto Brain at the
// bottom of brain.js (like the Range). The room, the pins and the physics are in bowlobjects.js and bowlrules.js.
//
// A game is ten frames and goes on from one visit to the next (the lane remembers the card): a visit is a handful of rolls. After a roll
// he walks to the ball return, takes the ball and walks back to the line. The pins are set by hand (he walks down the lane, reaches down
// to the deck and clears or racks them) until an Automatic Pinsetter has been built: then he only waits for the machine.
//
// What he can do depends on the Bowling book (skills.js): a beginner is wild, a reader of "Bowling for Robots" is steadier, chapter 2 puts a
// hook on the ball and chapter 3 teaches him to aim at the pins that are left (spares).
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { LANE, PIN_SPOTS } from './bowlrules.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ID = 'bowling';
export const BOWL_ACTS = ['bowl', 'bowlwatch'];
// What a long-press can point at in the alley: the rack of house balls and the scoreboard
export const BOWL_PIECES = ['ballrack', 'bowlscore'];
const clamp = THREE.MathUtils.clamp;
const smooth = (x) => x * x * (3 - 2 * x);

// how wild a robot's aim is, how much the ball hooks and whether he aims at what is left standing (from the chapters he has read)
export function bowlSkill(skills) {
  const has = (id) => skills.has(id);
  if (has('bowling.ch3')) return { noise: 0.12, hook: 0.2, spares: true, name: 'spares' };
  if (has('bowling.ch2')) return { noise: 0.17, hook: 0.2, spares: false, name: 'hook' };
  if (has('bowling')) return { noise: 0.21, hook: 0, spares: false, name: 'book' };
  return { noise: 0.26, hook: 0, spares: false, name: 'novice' };
}

export function installBowl(Brain, POSES, H) {
  const { pick } = H;

  // ---- the poses
  // the delivery: a pendulum arm (back, then down and through) with a lunge; the left arm out for balance
  POSES.bowl = (g, t, dur, ctx) => {
    const b = ctx.bowl;
    if (!b) return;
    const k = clamp(t / dur, 0, 1);
    const back = smooth(clamp(k / 0.38, 0, 1)), thru = smooth(clamp((k - 0.38) / 0.34, 0, 1)), follow = smooth(clamp((k - 0.72) / 0.28, 0, 1));
    const theta = k < 0.38 ? -0.88 * back : -0.88 + (0.88 + 0.7) * thru + 0.55 * follow;
    const lunge = smooth(clamp((k - 0.3) / 0.4, 0, 1)) * (1 - 0.5 * follow);
    g.hipsOffset.y = -0.34 * lunge;
    const qx = (a) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a);
    if (lunge > 0.001) {                                                   // a lunge: the left leg forward and bent, the right one trailing; the back leans into it
      g.set('LeftUpLeg', qx(-1.0 * lunge)); g.set('LeftLeg', qx(1.25 * lunge)); g.set('LeftFoot', qx(-0.25 * lunge));
      g.set('RightUpLeg', qx(0.35 * lunge)); g.set('RightLeg', qx(0.6 * lunge)); g.set('RightFoot', qx(-0.2 * lunge));
      g.set('Spine', qx(0.3 * lunge)); g.set('Spine1', qx(0.25 * lunge));
    }
    const sh = g.boneWorld('RightArm'), f = b.fwd, len = 0.56;
    const hand = sh.clone().addScaledVector(f, Math.sin(theta) * len).add(V(0, -Math.cos(theta) * len, 0));
    g.reach('Right', hand, 1, false);
    const right = V(-f.z, 0, f.x).multiplyScalar(-1);                         // (his left, as he faces down the lane, is the sign of this)
    const shl = g.boneWorld('LeftArm');
    g.reach('Left', shl.clone().addScaledVector(right, 0.55).add(V(0, 0.05 + 0.1 * lunge, 0)).addScaledVector(f, 0.1), 0.9, false);
    b.hand = hand;
  };
  // one hand out to a point (the rack, the ball return, the pin deck), bending down for it when it is low
  POSES.bowlreach = (g, t, dur, ctx) => {
    const b = ctx.bowl;
    if (!b || !b.point) return;
    const p = b.point();
    const k = smooth(clamp(t / Math.max(0.2, dur * 0.5), 0, 1)) * (1 - smooth(clamp((t - dur * 0.75) / (dur * 0.25), 0, 1)));
    const sh = g.boneWorld('RightArm');
    const low = clamp((sh.y - p.y - 0.45) / 0.8, 0, 1);
    g.hipsOffset.y = -0.38 * low * k;
    g.reach('Right', sh.clone().lerp(p, 0.4 + 0.6 * k), 1, false);
  };

  Object.assign(Brain.prototype, {
    inBowl() { return this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z) === ID; },
    lockedInBowl() { return !!this.lock && BOWL_PIECES.includes(this.lock.name) && this.inBowl(); },
    bowlOpen() { return !!this.w.doors[ID] && !!this.w.bowl && !this.doorLockedFor(ID); },
    bowlLaneFor() {
      const prefer = this.isGal ? [2, 1, 0] : [0, 1, 2];
      const taken = this.other ? this.other.bowlLane : null;
      return prefer.find((i) => i !== taken) ?? prefer[0];
    },
    bowlTrip(label, inner) {
      return [label, ...(this.inBowl() ? [] : this.doorIn(ID)), ...inner, ...(this.lockedInBowl() ? [] : this.doorOut(ID))];
    },
    bowlReach(point, then, dur = 0.9) {
      return this.play('bowlreach', dur, { bowl: { point, single: true }, at: [dur * 0.5, then] });
    },

    // ------------------------------------------------------------------ the ball
    // a ball from the rack (a wooden one now and then, when the Workshop has made one)
    bowlTakeFromRack() {
      const W = this.w.bowl, sp = W.rack.standSpot();
      return [this.walk(sp.x, sp.z, sp.yaw), this.bowlReach(() => W.rack.slot(this.bowlWant ?? 0), () => {
        const wood = W.state.woodBall && Math.random() < 0.5, got = W.rack.take(wood);
        if (got) { this.bowlBall = { color: got.color, wood: got.wood, k: got.k }; this.bowlHold = true; sfx('click'); }
      }), this.play('idle', 0.2)];
    },
    bowlPutBack() {
      const W = this.w.bowl;
      if (!W || !this.bowlBall) return [];
      const steps = [];
      const sp = W.rack.standSpot();
      return [
        ...(this.bowlHold ? [] : this.bowlFetchSteps()),
        this.walk(sp.x, sp.z, sp.yaw),
        this.bowlReach(() => W.rack.slot(this.bowlBall ? this.bowlBall.k : 0), () => { if (this.bowlBall) W.rack.giveBack(this.bowlBall.k); this.bowlBall = null; this.bowlHold = false; sfx('click'); }),
        this.play('idle', 0.2), ...steps,
      ];
    },
    // the ball is on the return: he walks to it and takes it
    bowlFetchSteps() {
      const W = this.w.bowl, i = this.bowlLane;
      if (!W || i == null) return [];
      const sp = W.returnStand(i);
      return [
        this.walk(sp.x, sp.z, sp.yaw),
        { type: 'plan', fn: () => (W.ballAtReturn(i) ? [] : this.bowlWaitFor(() => W.ballAtReturn(i), 8)) },
        this.bowlReach(() => W.returnPoint(i), () => { const look = W.takeFromReturn(i); if (look) { this.bowlBall = { ...(this.bowlBall || {}), ...look }; this.bowlHold = true; sfx('click'); } }),
        this.play('idle', 0.15),
      ];
    },
    // wait (a breath at a time) until `cond` is true, but not longer than `max` seconds
    bowlWaitFor(cond, max) {
      const t0 = this.time;
      return [this.play('idle', 0.4), { type: 'plan', fn: () => (cond() || this.time - t0 > max ? [] : this.bowlWaitFor(cond, max - (this.time - t0))) }];
    },

    // ------------------------------------------------------------------ the pins
    // wait for the pins to stop, then (without a pinsetter) go down the lane and clear or rack them by hand
    bowlPinSteps() {
      const W = this.w.bowl, i = this.bowlLane;
      if (!W) return [];
      const steps = [{ type: 'plan', fn: () => (W.busy(i) ? this.bowlWaitFor(() => !W.busy(i), 7) : []) }];
      steps.push({
        type: 'plan',
        fn: () => {
          const need = W.needsReset(i);
          if (!need) return [];
          if (W.supplies().setter) return this.bowlWaitFor(() => !W.needsReset(i) && !W.busy(i), 9);        // the machine does it
          const sp = W.deckStand(i);
          const back = W.standSpot(i);
          return [
            this.walk(sp.x, sp.z, W.awayYaw()),
            this.bowlReach(() => W.deckPoint(i), () => { W.manualReset(i); sfx('pins'); }, 1.5),
            this.play('idle', 0.3),
            this.walk(back.x, back.z + 0.3, Math.PI),
          ];
        },
      });
      return steps;
    },

    // ------------------------------------------------------------------ one roll
    bowlOneRoll() {
      const W = this.w.bowl, i = this.bowlLane;
      if (!W || i == null) { this.queue.length = 0; return []; }
      const sk = bowlSkill(this.skills);
      const need = W.laneState(i);
      if (need.game.done) W.startGame(i, this.isGal ? 'GAL' : 'GUY');
      const steps = [];
      if (!this.bowlHold) steps.push(...(this.bowlBall || W.ballAtReturn(i) ? this.bowlFetchSteps() : this.bowlTakeFromRack()));
      steps.push(...this.bowlPinSteps());
      const sp = W.startSpot(i), st = W.standSpot(i);
      steps.push(this.walk(sp.x, sp.z, W.awayYaw()), this.play('idle', 0.5));
      steps.push(this.walk(st.x, st.z, W.awayYaw()));
      steps.push({ type: 'plan', fn: () => this.bowlDeliver(sk) });
      return steps;
    },
    // the delivery and what follows: the ball goes, the pins fall (at `tHit`), the card is filled in
    bowlDeliver(sk) {
      const W = this.w.bowl, i = this.bowlLane;
      if (!W) return [];
      const dur = 1.7, rel = dur * 0.72;
      const standing = W.standing(i);
      let aim = 0.035, hook = sk.hook;
      if (sk.spares && standing.length < 10) {                              // at the pins that are left
        const xs = standing.map((k) => PIN_SPOTS[k].x), mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
        aim = clamp(mean, -0.3, 0.3);
        hook = 0;
      }
      const result = { done: false };
      return [
        this.play('bowl', dur, {
          bowl: { lane: i, fwd: V(0, 0, -1) },
          at: [rel, () => {
            const hand = this.g.boneWorld('RightHand');
            this.bowlHold = false;
            const look = { color: this.bowlBall ? this.bowlBall.color : 0xd32f2f, wood: !!(this.bowlBall && this.bowlBall.wood), k: this.bowlBall ? this.bowlBall.k : 0 };
            const from = hand.clone(); from.y = clamp(from.y, LANE.ballR, 0.45);
            const r = W.roll(i, { from, aim, hook: hook * (this.isGal ? -1 : 1), noise: sk.noise, power: 0.9 + Math.random() * 0.4, look });
            result.r = r;
          }],
        }),
        this.play('idle', 0.4),
        { type: 'plan', fn: () => this.bowlAfterRoll(result) },
      ];
    },
    bowlAfterRoll(result) {
      const W = this.w.bowl, i = this.bowlLane;
      const r = result.r;
      if (!W || !r) return [];
      const wait = Math.max(0.3, r.tHit - 0.4 + 0.4);
      return [
        this.play('idle', wait, { at: [wait - 0.01, () => {} ] }),
        { type: 'plan', fn: () => {
          const a = W.record(i, r.count);
          const strike = r.count === 10 && a.ball === 1 || r.count === 10;
          return [strike ? this.play('wave', 1.4) : r.count === 0 ? this.play('akimbo', 1.2) : this.play('idle', 0.8)];
        } },
      ];
    },

    // ------------------------------------------------------------------ the activities
    bowlActivities() {
      return {
        bowl: () => this.bowlTrip('bowling', [
          { type: 'plan', fn: () => { if (!this.w.bowl) { this.queue.length = 0; return []; } this.bowlLane = this.bowlLaneFor(); const W = this.w.bowl; if (W.laneState(this.bowlLane).owner == null || W.laneState(this.bowlLane).game.done) W.startGame(this.bowlLane, this.isGal ? 'GAL' : 'GUY'); return []; } },
          { type: 'plan', fn: () => Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () => ({ type: 'plan', fn: () => this.bowlOneRoll() })) },
          { type: 'plan', fn: () => [...this.bowlBoardSteps(), ...this.bowlPutBack()] },
          { type: 'plan', fn: () => { this.bowlHold = false; this.bowlLane = null; return []; } },
        ]),
        bowlwatch: () => this.bowlTrip('watching the bowling', [
          { type: 'plan', fn: () => { const W = this.w.bowl; if (!W) { this.queue.length = 0; return []; } const s = W.watchSpot(); return [this.walk(s.x, s.z, s.yaw), this.play('idle', 4 + Math.random() * 4), this.play('idle', 2 + Math.random() * 3)]; } },
        ]),
      };
    },
    bowlBoardSteps() {
      const W = this.w.bowl;
      if (!W) return [];
      const sp = W.boardStand();
      return [this.walk(sp.x, sp.z, sp.yaw), this.play('idle', 1.6)];
    },

    // the context the poses read (the direction he faces)
    bowlCtx(s) {
      const b = s.fx && s.fx.bowl;
      if (!b) return null;
      const y = this.g.root.rotation.y;
      return { ...b, fwd: V(Math.sin(y), 0, Math.cos(y)) };
    },
    // after the arm is solved: the ball sits in his right hand while he holds it (and only while he is bowling, in the alley)
    bowlLate() {
      const W = this.w.bowl;
      if (!W) return;
      const held = W.held(this.isGal);
      const on = this.bowlHold && this.last === 'bowl' && this.g.loaded && this.inBowl();
      if (!on) {
        if (held.visible) held.hide();
        if (this.bowlHold || (this.bowlBall && this.last !== 'bowl')) {       // interrupted: the ball goes back to the rack
          if (this.bowlBall) W.rack.giveBack(this.bowlBall.k);
          this.bowlBall = null; this.bowlHold = false;
        }
        return;
      }
      if (this.bowlBall) held.set({ color: this.bowlBall.color, wood: !!this.bowlBall.wood });
      const fr = this.handFrame('Right');
      const c = fr.wrist.clone().addScaledVector(fr.f, 0.1).addScaledVector(fr.palm, 0.075);
      held.place(c);
      this.g.curl('Right', 0.5);
    },
  });
}
