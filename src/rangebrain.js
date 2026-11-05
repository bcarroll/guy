// GUY (and GAL) at the Shooting Range: going in through the door, walking to the firing line of a lane, and taking a few shots at the
// holographic targets. Installed onto Brain at the bottom of brain.js (like the Yard). The room and its targets are in rangeobjects.js.
//
// A robot shoots from his own lane (GUY from the left one, GAL from the right one, or whichever lane the other robot is not using). He
// shoots at what he can see: the bullseye and the enemy in his lane, and, when the line of fire clears the screens, the ones in other lanes
// too (rangeobjects.js `candidates`). Targets are looked up each time he is about to shoot: the enemies walk and dissolve meanwhile.
//
// The aim: the arm reaches out along the line to the target, the left hand supports the grip, and the blaster is held in the right hand
// (it is drawn by rangeLate, from the hand's place, so it follows the arm). A shot is fired at the end of the aim, with a short recoil.
import * as THREE from 'three';
import { sfx } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ID = 'range';
export const RANGE_ACTS = ['rangeshoot'];
// The fictional blasters (each one learned from its book, skills.js). `breath`: the pause after a shot; `aim`: how long he holds the aim.
export const BLASTERS = {
  'range.pistol': { aim: 0.6, breath: 0.4 },
  'range.carbine': { aim: 1.3, breath: 1.0 },
};

export function installRange(Brain, POSES, H) {
  const { pick } = H;

  // ---- the pose: the right arm out along the aim, the left hand under the grip, a little kick back after a shot
  POSES.aim = (g, t, dur, ctx) => {
    const r = ctx.range;
    if (!r || !r.aim) return;
    const sh = g.boneWorld('RightArm');
    const dir = r.aim.clone().sub(sh).normalize();
    const hand = sh.clone().addScaledVector(dir, 0.5 - 0.05 * (r.recoil || 0));
    g.reach('Right', hand, 1, false);
    const f = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    const left = new THREE.Vector3(0, 1, 0).cross(f);                 // his left, as he faces the target
    const lhand = hand.clone().addScaledVector(f, 0.1).addScaledVector(left, 0.13).add(V(0, -0.03, 0));
    g.reach('Left', lhand, 1, false);
  };

  Object.assign(Brain.prototype, {
    // ------------------------------------------------------------------ where he is
    inRange() { return this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z) === ID; },
    // the range is added and its door is not locked (and there is a range to shoot in)
    rangeOpen() { return !!this.w.doors[ID] && !!this.w.range && !this.doorLockedFor(ID); },

    // ------------------------------------------------------------------ lanes
    // The lane he shoots from: GUY the left one, GAL the right one; not the lane the other robot is shooting from.
    rangeLaneFor() {
      const prefer = this.isGal ? [2, 1, 0] : [0, 1, 2];
      const taken = this.other ? this.other.rangeLane : null;
      return prefer.find((i) => i !== taken) ?? prefer[0];
    },
    // the blasters he can use at the range: his own (from his books), and GAL's, which he can borrow by walking over to her
    // before she has read the book (the range only: they cannot be taken out of it)
    rangeOwn() { return Object.keys(BLASTERS).filter((k) => this.skills.has(k)); },
    rangeKnown() {
      const o = this.other;
      return Object.keys(BLASTERS).filter((k) => this.skills.has(k) || (o && o.skills && o.skills.has(k)));
    },
    // no blaster learned yet: no shooting at the range
    rangeAvailable() {
      return this.rangeOpen() && this.rangeKnown().length > 0 && this.w.range.candidates(this.rangeLaneFor()).length > 0;
    },

    // ------------------------------------------------------------------ the trip and the steps
    // A trip: in through the door (unless he is already in), the steps, and out again.
    rangeTrip(label, inner) {
      return [label, ...(this.inRange() ? [] : this.doorIn(ID)), ...inner, ...this.doorOut(ID)];
    },
    // walk to the firing line of his lane, facing down the range
    rangeGoToLane() {
      const R = this.w.range;
      if (!R) { this.queue.length = 0; return []; }
      const known = this.rangeKnown(), own = this.rangeOwn();
      if (!known.length) { this.queue.length = 0; return []; }
      this.rangeLane = this.rangeLaneFor();
      this.rangeBlaster = pick(own.length ? own : known);                  // which blaster he takes out for this trip
      const p = R.firingSpot(this.rangeLane);
      // a blaster only GAL has read: he goes over to her to borrow it, then walks on to the firing line
      const borrow = own.length ? [] : [this.walk(this.other.g.root.position.x, this.other.g.root.position.z)];
      return [...borrow, this.walk(p.x, p.z, R.awayYaw())];
    },
    // `n` shots, each one planned when it is its turn (the targets have moved meanwhile)
    rangeShotSteps(n) {
      const steps = [];
      for (let i = 0; i < n; i++) steps.push({ type: 'plan', fn: () => this.rangeOneShot() });
      return steps;
    },
    // one shot: pick a target he can hit from his lane (his own lane three times as likely as one across), aim, fire, and a breath
    rangeOneShot() {
      const R = this.w.range, lane = this.rangeLane;
      if (!R || lane == null) { this.queue.length = 0; return []; }
      this.rangeHold = true;
      const cands = R.candidates(lane);
      if (!cands.length) return [this.play('idle', 0.8)];                  // nothing he can see right now: he waits
      const c = pick(cands.flatMap((x) => Array(x.own ? 3 : 1).fill(x)));
      const rf = { point: () => R.worldAim(c.target, c.k), fired: false };
      const b = BLASTERS[this.rangeBlaster] || BLASTERS['range.pistol'];
      return [
        this.play('aim', b.aim, { range: rf }),
        this.play('aim', 0.5, {
          range: rf,
          at: [0.2, () => {
            const r = R.fire(lane, c.target, rf.point());
            rf.fired = true;
            sfx('shot');
            if (r.hit) sfx('holo');
          }],
        }),
        this.play('idle', b.breath + Math.random() * 0.4),
      ];
    },

    // the aim as the pose reads it: where he is aiming, and how far the recoil has got (0..1) after the shot
    rangeCtx(s) {
      const rf = s.fx && s.fx.range;
      if (!rf) return null;
      if (rf.fired && rf.fireT === undefined) rf.fireT = s.t;
      const recoil = rf.fireT === undefined ? 0 : Math.max(0, 1 - (s.t - rf.fireT) / 0.3);
      const aim = rf.point ? rf.point() : null;
      if (aim) this.rangeAim = aim;                                         // (kept between shots: the blaster stays on the last target)
      return { aim, recoil };
    },
    // after the arm is solved: the blaster sits in the right hand, pointing where he aims (only while he is at the range with it out)
    rangeLate() {
      const R = this.w.range;
      if (!R) return;
      // held only while the range activity is the one he is doing (a new activity puts it away, and so does leaving the room)
      const onRange = this.rangeHold && this.last === 'rangeshoot' && this.g.loaded && this.inRange();
      if (!onRange) { this.rangeHold = false; if (R.gun.visible) R.hideGun(); return; }
      const hand = this.g.boneWorld('RightHand');
      const dir = this.rangeAim ? this.rangeAim.clone().sub(hand).normalize() : V(0, 0, -1);
      R.holdGun(hand, dir);
    },

    // ------------------------------------------------------------------ the activities
    rangeActivities() {
      return {
        rangeshoot: () => this.rangeTrip('shooting at the range', [
          { type: 'plan', fn: () => this.rangeGoToLane() },
          { type: 'plan', fn: () => this.rangeShotSteps(3 + Math.floor(Math.random() * 3)) },
          { type: 'plan', fn: () => { this.rangeLane = null; this.rangeHold = false; return []; } },
        ]),
      };
    },
  });
}
