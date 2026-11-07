// GUY (and GAL) at the Shooting Range: going in through the door, walking to the firing line of a lane, and taking a few shots at the
// holographic targets. Installed onto Brain at the bottom of brain.js (like the Yard). The room and its targets are in rangeobjects.js.
//
// A robot shoots from his own lane (GUY from the left one, GAL from the right one, or whichever lane the other robot is not using). He
// shoots at what he can see: the bullseye and the enemy in his lane, and, when the line of fire clears the screens, the ones in other lanes
// too (rangeobjects.js `candidates`). Targets are looked up each time he is about to shoot: the enemies walk and dissolve meanwhile.
//
// The equipment in the side bays (rangeobjects.js): he presses the green button on the round controller to start a round, takes his
// blaster out of the display case, shoots, looks at the scoreboard, and puts the blaster back in the case before he goes.
//
// The aim: the arm reaches out along the line to the target, the left hand supports the grip, and the blaster is held in the right hand
// (it is drawn by rangeLate, from the hand's place, so it follows the arm). A shot is fired at the end of the aim, with a short recoil.
import * as THREE from 'three';
import { sfx } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ID = 'range';
export const RANGE_ACTS = ['rangeshoot', 'rangehang', 'rangefool'];
// What a long-press can point at in the range (the pieces in the side bays): the blaster rack (the display case), the round controller, the scoreboard
export const RANGE_PIECES = ['blasterrack', 'rangecontroller', 'scoreboard'];
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
    if (r.single) return;                                             // (one hand only: taking the blaster out of the case, pressing a button)
    const left = new THREE.Vector3(0, 1, 0).cross(f);                 // his left, as he faces the target
    const lhand = hand.clone().addScaledVector(f, 0.1).addScaledVector(left, 0.13).add(V(0, -0.03, 0));
    g.reach('Left', lhand, 1, false);
  };

  Object.assign(Brain.prototype, {
    // a walk along the firing line to lane `i`'s firing spot (the screens only start a little way down the range: the line is open)
    rangeWalkTo(i) {
      const R = this.w.range, p = R.firingSpot(i);
      this.rangeLane = i;
      return this.walk(p.x, p.z, R.awayYaw());
    },
    // the lanes he could move to from his own: the next one along, not the one the other robot is shooting from
    rangeLaneOptions() {
      const cur = this.rangeLane, taken = this.other ? this.other.rangeLane : null;
      return [cur - 1, cur + 1].filter((i) => i >= 0 && i < 3 && i !== taken);
    },

    // ------------------------------------------------------------------ where he is
    inRange() { return this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z) === ID; },
    // locked in (long-press > Lock in) on a piece of the range, and in it: he stays and goes on shooting until told to stop
    lockedInRange() { return !!this.lock && RANGE_PIECES.includes(this.lock.name) && this.inRange(); },
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
      return [label, ...(this.inRange() ? [] : this.doorIn(ID)), ...inner, ...(this.lock && RANGE_PIECES.includes(this.lock.name) ? [] : this.doorOut(ID))];      // (locked in on a piece of the range: he stays and shoots on)
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
      return [...this.rangeStartSteps(), ...borrow, ...this.rangeTakeSteps(this.rangeBlaster), this.walk(p.x, p.z, R.awayYaw())];
    },
    // one hand out to a point (the pose `aim` with `single`): `then` runs half way through
    rangeReach(tag, point, then, dur = 0.9) {
      return this.play('aim', dur, { range: { point, fired: false, single: true, tag }, at: [dur * 0.55, then] });
    },
    // the round controller: walk up, press the green button (the targets come up, the score starts again)
    rangeStartSteps() {
      const R = this.w.range, sp = R.panel.standSpot();
      return [this.walk(sp.x, sp.z, sp.yaw), this.rangeReach('press', () => R.panel.buttonPoint(), () => { R.startRound(); sfx('click'); }), this.play('idle', 0.3)];
    },
    // the display case: walk up and take his blaster out of it (it is in his hand from now until he puts it back)
    rangeTakeSteps(kind) {
      const R = this.w.range, sp = R.display.standSpot(kind);
      return [this.walk(sp.x, sp.z, sp.yaw), this.rangeReach('take', () => R.display.slot(kind), () => {
        R.display.take(kind); this.rangeTook = true; R.gunFor(this.isGal).setKind(kind); this.rangeHold = true; this.rangeAim = null; sfx('click');
      }), this.play('idle', 0.2)];
    },
    rangeReturnSteps() {
      const R = this.w.range, kind = this.rangeBlaster;
      if (!R || !this.rangeTook) return [];
      const sp = R.display.standSpot(kind);
      return [this.walk(sp.x, sp.z, sp.yaw), this.rangeReach('return', () => R.display.slot(kind), () => { this.rangeHold = false; this.rangeTook = false; R.display.giveBack(kind); R.gunFor(this.isGal).hide(); sfx('click'); }), this.play('idle', 0.2)];
    },
    // the scoreboard: walk up and look at the round's score, a moment
    rangeBoardSteps() {
      const R = this.w.range, sp = R.board.standSpot();
      return [this.walk(sp.x, sp.z, sp.yaw), this.play('idle', 1.6)];
    },
    // `n` shots, each one planned when it is its turn (the targets have moved meanwhile)
    rangeShotSteps(n) {
      const steps = [];
      for (let i = 0; i < n; i++) {
        if (this.rangeOwn().length) steps.push({ type: 'plan', fn: () => this.rangeMaybeMove() });    // (a blaster reader now and then changes lane)
        steps.push({ type: 'plan', fn: () => this.rangeOneShot() });
      }
      return steps;
    },
    rangeMaybeMove() {
      const opts = this.rangeLaneOptions();
      if (!opts.length || Math.random() > 0.3) return [];
      return [this.rangeWalkTo(pick(opts)), this.play('idle', 0.3)];
    },
    rangeHangSteps() {
      const R = this.w.range;
      if (!R) { this.queue.length = 0; return []; }
      const spot = R.hangSpot();
      return [this.walk(spot.x, spot.z, spot.yaw), this.play('idle', 4 + Math.random() * 4), this.play('idle', 2 + Math.random() * 3)];
    },
    rangeFoolSteps() {
      const R = this.w.range;
      if (!R) { this.queue.length = 0; return []; }
      const lane = Math.floor(Math.random() * 3);
      const p = R.firingSpot(lane);
      this.rangeLane = lane;
      const rail = R.targets.find((t) => t.kind === 'rail' && t.lane === lane);     // (the lane's bullseye rail: always there)
      const steps = [this.walk(p.x, p.z, R.awayYaw()), this.play('wave', 1.6)];
      const rf = { point: () => R.worldAim(rail, 0.5), fired: false };
      steps.push(this.play('aim', 1.2, { range: rf }));                // poking at a hologram: the arm out, nothing fired
      steps.push({ type: 'plan', fn: () => [this.rangeWalkTo(this.rangeLaneOptions()[0] ?? lane)] });
      steps.push(this.play('idle', 1.2));
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
            const r = R.fire(lane, c.target, rf.point(), R.gunFor(this.isGal).tipWorld());
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
      if (aim && !rf.single) this.rangeAimAt = this.time;                    // (the blaster is raised to the line only while he aims)
      return { aim, recoil, single: !!rf.single };
    },
    // after the arm is solved: the blaster sits in the right hand (only while he is at the range with it out). Aiming, it points along the
    // line to the target; any other time (walking, waiting, at the board) it is carried low, barrel forward and down, the fingers round the grip.
    rangeLate() {
      const R = this.w.range;
      if (!R) return;
      const gun = R.gunFor(this.isGal);
      // held only while the range activity is the one he is doing (a new activity puts it away, and so does leaving the room)
      const onRange = this.rangeHold && this.last === 'rangeshoot' && this.g.loaded && this.inRange();
      if (!onRange) { this.rangeHold = false; if (gun.visible) gun.hide(); if (this.rangeTook) { R.display.giveBack(this.rangeBlaster); this.rangeTook = false; } return; }
      const hand = this.g.boneWorld('RightHand');
      const aiming = this.rangeAim && this.rangeAimAt !== undefined && this.time - this.rangeAimAt < 0.15;
      let dir;
      if (aiming) dir = this.rangeAim.clone().sub(hand).normalize();
      else { const yaw = this.g.root.rotation.y; dir = V(Math.sin(yaw) * 0.85, -0.5, Math.cos(yaw) * 0.85).normalize(); }
      gun.hold(hand, dir);
      this.g.curl('Right', 0.75);                                           // (the fingers close round the grip)
    },

    // ------------------------------------------------------------------ the activities
    rangeActivities() {
      return {
        rangeshoot: () => this.rangeTrip('shooting at the range', [
          { type: 'plan', fn: () => this.rangeGoToLane() },
          { type: 'plan', fn: () => this.rangeShotSteps(3 + Math.floor(Math.random() * 3)) },
          { type: 'plan', fn: () => { this.rangeLane = null; this.rangeAim = null; return [...this.rangeBoardSteps(), ...this.rangeReturnSteps()]; } },
          { type: 'plan', fn: () => { this.rangeHold = false; return []; } },
        ]),
        // hanging about: he stands between the screens for a while and watches the targets, then goes out
        rangehang: () => this.rangeTrip('hanging about at the range', [
          { type: 'plan', fn: () => this.rangeHangSteps() },
        ]),
        // fooling about: he waves, walks along the lanes, pokes a hologram (aims at it, without firing) and changes lane
        rangefool: () => this.rangeTrip('fooling about at the range', [
          { type: 'plan', fn: () => this.rangeFoolSteps() },
        ]),
      };
    },
  });
}
