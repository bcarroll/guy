import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const clamp = THREE.MathUtils.clamp;
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const _q = new THREE.Quaternion();

/** Build a rotation from ordered steps, e.g. Q('z', -1, 'x', 0.3): rotate about model-Z first, then model-X. */
export function Q(...steps) {
  const q = new THREE.Quaternion();
  for (let i = 0; i < steps.length; i += 2) q.premultiply(_q.setFromAxisAngle(AX[steps[i]], steps[i + 1]));
  return q;
}

const BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  ...['Left', 'Right'].flatMap((s) => [
    `${s}Shoulder`, `${s}Arm`, `${s}ForeArm`, `${s}Hand`,
    `${s}UpLeg`, `${s}Leg`, `${s}Foot`, `${s}ToeBase`,
    ...['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'].flatMap((f) => [1, 2, 3].map((i) => `${s}Hand${f}${i}`)),
  ]),
];

/**
 * Guy: loads the Mixamo Y Bot and drives its skeleton procedurally.
 * Every bone gets a target rotation expressed in the *model's* frame (x = Guy's left, y = up, z = forward),
 * which is converted into each bone's local space using its rest-pose parent orientation.
 */
export class Guy {
  constructor() {
    this.root = new THREE.Group(); // position/yaw in the room
    this.bones = {};
    this.rest = {};     // rest local quaternions
    this.restParentInv = {}; // inverse of parent's rest world quaternion (relative to root)
    this.restParent = {};
    this.cur = {};      // smoothed rotations (model frame)
    this.target = {};
    this.hipsRest = new THREE.Vector3();
    this.hipsOffset = new THREE.Vector3(); // meters, model frame
    this.hipsOffsetCur = new THREE.Vector3();
    this.sharp = 9;     // pose smoothing rate
    this.loaded = false;
  }

  // opts.keep: keep the model's own materials and textures (the customers); opts.height: how tall he or she is, in metres;
  // opts.colors: { body, joints } for the robot (Guy is gold; GAL is another colour).
  async load(url, opts = {}) {
    const loader = new FBXLoader();
    // single-file builds embed the model as base64 in window.__YBOT_B64
    const fbx = window.__YBOT_B64
      ? loader.parse(Uint8Array.from(atob(window.__YBOT_B64), (c) => c.charCodeAt(0)).buffer, '')
      : await loader.loadAsync(url);
    const model = fbx;
    this.model = model;
    this.root.add(model);

    // Normalise to a 1.75 m tall character.
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const s = (opts.height || 1.75) / (box.max.y - box.min.y);
    model.scale.multiplyScalar(s);
    this.scale = model.scale.x;
    model.updateMatrixWorld(true);

    model.traverse((o) => {
      if (o.isSkinnedMesh || o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (opts.keep) {                      // a customer: its own textures (any NaN colour is made white so the texture shows)
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.color && Number.isNaN(m.color.r)) m.color.set(0xffffff);
        } else {
          // The FBX materials load with NaN colours, so give Guy his own.
          o.material = o.name.includes('Joints')
            ? new THREE.MeshStandardMaterial({ color: (opts.colors && opts.colors.joints) || 0x23262d, roughness: 0.5, metalness: 0.4 })
            : new THREE.MeshStandardMaterial({ color: (opts.colors && opts.colors.body) || 0xf1c232, roughness: 0.35, metalness: 0.15 });
        }
      }
      if (o.isBone) {
        const n = o.name.replace('mixamorig:', '').replace('mixamorig', '');
        // The FBX holds a same-named leaf Bone inside each real bone (the skin copy); drive the outer one.
        if (BONES.includes(n) && o.parent.name !== o.name) this.bones[n] = o;
      }
    });

    // The Joints mesh arrives with its own detached skeleton; make it follow the body's one.
    if (!opts.keep) {
      let body = null;
      model.traverse((o) => { if (o.isSkinnedMesh && o.name.includes('Surface')) body = o; });
      model.traverse((o) => { if (o.isSkinnedMesh && o !== body) o.skeleton = body.skeleton; });
    }

    const wq = new THREE.Quaternion();
    for (const n of BONES) {
      const b = this.bones[n];
      if (!b) continue;
      this.rest[n] = b.quaternion.clone();
      b.parent.getWorldQuaternion(wq);
      this.restParent[n] = wq.clone();
      this.restParentInv[n] = wq.clone().invert();
      this.cur[n] = new THREE.Quaternion();
      this.target[n] = new THREE.Quaternion();
    }
    this.hipsRest.copy(this.bones.Hips.position);

    // Foot clearance at rest so we can plant Guy's lowest foot on the floor every frame.
    this.root.updateMatrixWorld(true);
    this.restFootY = this._lowestFootY();

    // Arm geometry at rest (root frame), used by reach() to aim the arm at a point.
    this.limb = {};
    const pos = (n) => this.root.worldToLocal(this.bones[n].getWorldPosition(new THREE.Vector3()));
    for (const side of ['Left', 'Right']) {
      const S = pos(`${side}Arm`), E = pos(`${side}ForeArm`), H = pos(`${side}Hand`);
      const M = pos(`${side}HandMiddle3`);
      this.limb[side] = {
        L1: S.distanceTo(E), L2: E.distanceTo(H), handLen: H.distanceTo(M) + 0.035,
        a0: E.clone().sub(S).normalize(), f0: H.clone().sub(E).normalize(),
      };
      // the hand's own rest axes: fingers direction, and palm normal (the side the fingers curl towards)
      const fH = pos(`${side}HandMiddle1`).sub(H).normalize();
      const sv = pos(`${side}HandThumb1`).sub(H);
      sv.addScaledVector(fH, -sv.dot(fH)).normalize();
      this.limb[side].handRest = { f: fH, p: side === 'Right' ? sv.clone().cross(fH) : fH.clone().cross(sv) };
    }
    this.loaded = true;
  }

  _lowestFootY() {
    const v = new THREE.Vector3();
    let y = Infinity;
    for (const n of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) {
      this.bones[n].getWorldPosition(v);
      y = Math.min(y, v.y);
    }
    return y - this.root.position.y - this.model.position.y;
  }

  /** Reset targets to identity (rest pose); animators then override. */
  clearTargets() {
    for (const n in this.target) this.target[n].identity();
    this.hipsOffset.set(0, 0, 0);
  }

  set(name, q) { this.target[name].copy(q); }

  curl(side, amount) {
    const sign = side === 'Left' ? -1 : 1;
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
      for (let i = 1; i <= 3; i++) this.target[`${side}Hand${f}${i}`].copy(Q('z', sign * amount * (i === 1 ? 0.9 : 1.1)));
    }
    for (let i = 1; i <= 3; i++) this.target[`${side}HandThumb${i}`].copy(Q('z', sign * amount * 0.35));
  }

  /** Smooth toward targets and write into the skeleton. */
  apply(dt) {
    const k = 1 - Math.exp(-dt * this.sharp);
    const tmp = new THREE.Quaternion();
    for (const n in this.target) {
      const c = this.cur[n].slerp(this.target[n], k);
      // local = Pinv * R * P * rest
      tmp.copy(this.restParentInv[n]).multiply(c).multiply(this.restParent[n]).multiply(this.rest[n]);
      this.bones[n].quaternion.copy(tmp);
    }
    this.hipsOffsetCur.lerp(this.hipsOffset, k);
    this.bones.Hips.position.copy(this.hipsRest).addScaledVector(this.hipsOffsetCur, 1 / this.scale);

    // plant the lowest foot on the floor
    this.root.updateMatrixWorld(true);
    const y = this._lowestFootY();
    const want = this.restFootY - y;
    this.model.position.y += (want - this.model.position.y) * Math.min(1, dt * 25);
  }

  /** World position of a bone (e.g. 'RightHand', 'LeftArm' = the shoulder joint). */
  boneWorld(name, out = new THREE.Vector3()) { return this.bones[name].getWorldPosition(out); }

  /**
   * Two-bone IK: aim `side`'s arm so the hand reaches `targetWorld`, blended in by `weight`.
   * `contact` (default) means the target is something the fingers touch, so the wrist stops a hand-length short.
   * Rotations are corrected for however far the shoulder girdle has been turned by the spine.
   */
  reach(side, targetWorld, weight = 1, contact = true, opts = null) {
    if (weight <= 0.001) return;
    const { L1, L2, a0, f0, handLen } = this.limb[side];
    const S = this.root.worldToLocal(this.boneWorld(`${side}Arm`));
    const T = this.root.worldToLocal(targetWorld.clone());
    // Blend in *space*, not in rotation: the hand travels in a straight line from where it hangs to the target and the
    // IK follows it. (Slerping between the hanging arm and the final arm swings the elbow round the back of the body.)
    const k = weight * weight * (3 - 2 * weight);
    const home = new THREE.Vector3(side === 'Right' ? -0.33 : 0.33, 0.9, -0.05);
    T.lerpVectors(home, T, k);
    weight = Math.min(1, weight * 6); // switch to IK quickly; the hand is near its hanging spot until then
    const d = T.clone().sub(S);
    // contact: true = fingertips on the target, false = the wrist itself, or a distance (m) to stop short by
    const stop = contact === true ? handLen : contact === false ? 0 : contact;
    if (stop) d.addScaledVector(d.clone().normalize(), -stop);
    const want = d.length();
    const dist = clamp(want, Math.abs(L1 - L2) + 0.02, (L1 + L2) * 0.985);
    const u = d.normalize();
    const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    // the elbow points down and out, away from the body
    const pole = opts && opts.pole ? opts.pole.clone() : new THREE.Vector3(side === 'Right' ? -0.5 : 0.5, -1, -0.15);
    const v = pole.sub(u.clone().multiplyScalar(pole.dot(u)));
    if (v.lengthSq() < 1e-6) v.set(0, -1, 0);
    v.normalize();
    const a = u.clone().multiplyScalar(cosA).addScaledVector(v, sinA).normalize(); // upper arm direction
    const E = S.clone().addScaledVector(a, L1);
    const f = S.clone().addScaledVector(u, dist).sub(E).normalize();                // forearm direction
    const Rarm = new THREE.Quaternion().setFromUnitVectors(a0, a);
    const Rtf = new THREE.Quaternion().setFromUnitVectors(f0, f);
    const Rfore = Rarm.clone().invert().multiply(Rtf);
    // undo the current turn of the shoulder girdle: applied = D^-1 * desired, with D = parentWorld * parentRest^-1
    const armName = `${side}Arm`;
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const parentQ = rootQ.multiply(this.bones[`${side}Shoulder`].getWorldQuaternion(new THREE.Quaternion()));
    const D = parentQ.multiply(this.restParentInv[armName]);
    const RarmApplied = D.invert().multiply(Rarm);
    this.target[armName].slerp(RarmApplied, weight);
    this.target[`${side}ForeArm`].slerp(Rfore, weight);

    // Exact hand orientation (opts.hand): solve for the rotation that puts the fingers along `fingers` and the palm along
    // `palm` (world directions). No iteration: hand_world = forearm_world * R_h, so R_h = forearm_world^-1 * wanted.
    if (opts && opts.hand) {
      const rq2 = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
      const d = opts.hand.fingers.clone().applyQuaternion(rq2).normalize();
      const pp = opts.hand.palm.clone().applyQuaternion(rq2);
      pp.addScaledVector(d, -pp.dot(d)).normalize();
      const basis = (f, p) => new THREE.Matrix4().makeBasis(f, p, f.clone().cross(p));
      const { f: rf, p: rp } = this.limb[side].handRest;
      const handQ = new THREE.Quaternion().setFromRotationMatrix(basis(d, pp)).multiply(new THREE.Quaternion().setFromRotationMatrix(basis(rf, rp)).invert());
      this.target[`${side}Hand`].slerp(Rtf.clone().invert().multiply(handQ), weight);
      return want - dist;
    }

    // Wrist roll: turn the hand about the forearm until its palm faces `opts.palm` (a world direction).
    // (Rolling about the forearm's rest axis f0 is the same as rolling about the forearm's current axis.)
    this.roll ??= { Left: 0, Right: 0 };
    this.flex ??= { Left: 0, Right: 0 };   // wrist flexion: bends the fingers towards the palm
    if (opts && (opts.palm || opts.side)) {
      const rq = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
      const loc = (n) => this.root.worldToLocal(this.boneWorld(n));
      const wr = loc(`${side}Hand`), m3 = loc(`${side}HandMiddle3`), th = loc(`${side}HandThumb1`);
      const fc = m3.clone().sub(wr).normalize();
      const sv = th.clone().sub(wr);
      sv.addScaledVector(fc, -sv.dot(fc)).normalize();
      // in the T-pose (palms down, thumbs forward) the palm normal is thumb-side x fingers for the right hand, fingers x thumb-side for the left
      const palm = side === 'Right' ? sv.clone().cross(fc) : fc.clone().cross(sv);
      const goal = (opts.side || opts.palm).clone().applyQuaternion(rq);
      const aim = opts.side ? sv.clone() : palm;       // which hand axis to line up: the palm normal, or the thumb axis
      aim.addScaledVector(fc, -aim.dot(fc));
      goal.addScaledVector(fc, -goal.dot(fc));
      palm.copy(aim);
      if (palm.lengthSq() > 1e-6 && goal.lengthSq() > 1e-6) {
        palm.normalize(); goal.normalize();
        const ang = Math.atan2(fc.dot(palm.clone().cross(goal)), palm.dot(goal));
        this.roll[side] = clamp(this.roll[side] + ang * 0.3, -Math.PI, Math.PI);
      }
    } else this.roll[side] *= 0.9;

    // Wrist flexion: bend the hand about its thumb axis until the fingers point along `opts.fingers` (a world direction).
    if (opts && opts.fingers) {
      const loc = (n) => this.root.worldToLocal(this.boneWorld(n));
      const wr = loc(`${side}Hand`), m1 = loc(`${side}HandMiddle1`), th = loc(`${side}HandThumb1`);
      const fc = m1.clone().sub(wr).normalize();
      const axis = th.clone().sub(wr);
      axis.addScaledVector(fc, -axis.dot(fc)).normalize();                       // thumb axis = the flexion axis
      const rq = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
      const want = opts.fingers.clone().applyQuaternion(rq);
      want.addScaledVector(axis, -want.dot(axis));                                  // flexion only moves the fingers in the plane ⟂ axis
      if (want.lengthSq() > 1e-6) {
        want.normalize();
        const err = Math.atan2(axis.dot(fc.clone().cross(want)), fc.dot(want));
        this.flex[side] = clamp(this.flex[side] - err * 0.3, -1.3, 1.3);
      }
    } else this.flex[side] *= 0.9;
    if ((opts && (opts.palm || opts.side)) || (opts && opts.fingers)) {
      const q = new THREE.Quaternion().setFromAxisAngle(f0, this.roll[side]).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.flex[side]));
      this.target[`${side}Hand`].slerp(q, weight);
    }
    return want - dist; // how far short of the target the hand stays (m)
  }

  /** Lean and crouch so a target beyond arm's length comes within reach. */
  reachAssist(targetWorld, weight = 1) {
    if (weight <= 0.001) return;
    const mid = this.boneWorld('LeftArm').add(this.boneWorld('RightArm')).multiplyScalar(0.5);
    const deficit = Math.max(0, mid.distanceTo(targetWorld) - 0.66);
    const up = targetWorld.y > mid.y + 0.05;       // above the shoulders: stretch up and lean back, no crouch
    const lean = clamp(deficit * 1.3, 0, 0.8) * weight * (up ? -0.35 : 1);
    const crouch = up ? 0 : clamp((deficit - 0.2) * 1.1, 0, 0.55) * weight;
    for (const [n, k] of [['Spine', 0.4], ['Spine1', 0.4], ['Spine2', 0.2]]) this.target[n].premultiply(Q('x', lean * k));
    if (crouch > 0) {
      for (const side of ['Left', 'Right']) {
        this.target[`${side}UpLeg`].premultiply(Q('x', -crouch));
        this.target[`${side}Leg`].premultiply(Q('x', crouch * 2));
        this.target[`${side}Foot`].premultiply(Q('x', -crouch));
      }
    }
  }

  /** Index finger out, the rest curled, for pressing a button. */
  pointFinger(side) {
    this.curl(side, 0.9);
    const sign = side === 'Left' ? -1 : 1;
    for (let i = 1; i <= 3; i++) this.target[`${side}HandIndex${i}`].identity();
    void sign;
  }

  get pos() { return this.root.position; }
}
