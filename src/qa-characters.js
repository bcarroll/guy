// QA for every character's body (installed onto the harness by devtools.js; NOT imported by the game).
//
// GUY, GAL and every customer model are Mixamo rigs driven by the same procedural skeleton code (guy.js). A model whose bones do not
// map the way the code expects (a different rest pose, a different turn at load time, short arms) shows up as arms stuck in the air,
// a flat body or a strange walk, and nothing in the activity sweeps notices because the numbers they check are GUY's. These sweeps
// load each rig for real, pose it, and measure it:
//
//   sweepRigs        every rig, loaded standing in different turns: the pose must not depend on how the figure was turned when its
//                    model loaded (the bug that made every customer's arms stick out); all bones mapped; the right height; not flat;
//                    the rest pose is a T-pose the code can drive; arms hang at the sides in idle and walk; feet on the floor; sitting
//                    puts the hips low and the knees forward
//   sweepCustomers   the real restaurant, each customer model in each state (arriving, walking, hand up, waiting, eating, paying):
//                    hands, hips and head where a person's would be
//
// Everything is measured in the figure's own frame (x = its left, y = up, z = forward) and in fractions of its height, so a toon
// character with short arms and a tall robot are judged by the same rules.
import * as THREE from 'three';
import { Guy } from './guy.js';
import { POSES, basePose } from './brain.js';
import { availableCustomers } from './customermodels.js';

const BASE = import.meta.env ? import.meta.env.BASE_URL : './';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// every rig that appears in the game: GUY, GAL, and the customer models (added automatically when a customer model is added)
export const RIGS = () => [
  { id: 'guy', url: `${BASE}models/ybot.fbx`, height: 1.75, opts: {} },
  { id: 'gal', url: `${BASE}models/xbot.fbx`, height: 1.75, opts: {} },
  ...availableCustomers().map((m) => ({ id: m.id, url: `${BASE}models/customers/${m.file}`, height: m.height || 1.7, opts: { keep: true, height: m.height || 1.7 } })),
];

export function install(T, h) {
  const { result, summarise } = h;
  const frame = 1 / 30;

  // A figure in the scene, turned to `yaw` inside a group turned to `parentYaw`, with its model loaded. Returns the GUY driver.
  async function figure(rig, yaw = 0, parentYaw = 0, where = [40, 40]) {
    const parent = new THREE.Group();
    parent.rotation.y = parentYaw;
    parent.position.set(where[0], 0, where[1]);                           // out of sight of the room unless asked
    window.scene.add(parent);
    const g = new Guy();
    g.root.rotation.y = yaw;
    parent.add(g.root);
    await g.load(rig.url, rig.opts);
    g.parent = parent;
    return g;
  }
  function drop(g) {
    g.parent.remove(g.root);
    window.scene.remove(g.parent);
    g.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) { if (m.map) m.map.dispose(); m.dispose(); }
    });
  }
  // Hold a pose for `frames` frames (the skeleton smooths towards it) the way the game drives a figure.
  function hold(g, fn, frames = 60, t0 = 3) {
    for (let i = 0; i < frames; i++) {
      g.sharp = 9; g.clearTargets();
      const t = t0 + i * frame;
      basePose(g, t);
      fn(g, t);
      g.apply(frame);
    }
    g.root.updateWorldMatrix(true, true);
  }
  // bone positions in the figure's own frame
  const at = (g, n) => g.root.worldToLocal(g.boneWorld(n));
  const KEYS = ['Hips', 'Head', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftForeArm', 'RightForeArm', 'LeftArm', 'RightArm'];
  const shape = (g) => Object.fromEntries(KEYS.map((k) => [k, at(g, k)]));
  const spread = (a, b) => Math.max(...KEYS.map((k) => a[k].distanceTo(b[k])));
  const finite = (g) => KEYS.every((k) => { const p = at(g, k); return Number.isFinite(p.x + p.y + p.z); });

  // the poses the game uses for a figure standing, walking and sitting (what customers and GUY do all day)
  const POSE = {
    idle: (g, t) => POSES.idle(g, t, 1e9, {}),
    walk: (phase) => (g, t) => POSES.walk(g, t, 1e9, { walkPhase: phase, armRoom: 1 }),
    sit: (g, t) => POSES.sitRest(g, t, 20, {}),
  };

  T.sweepRigs = async () => {
    const out = [];
    for (const rig of RIGS()) {
      const tag = `rig ${rig.id}`;
      const base = T.errors.length;
      let g0 = null;
      try {
        g0 = await figure(rig, 0, 0);
        const bones = Object.keys(g0.bones).length;
        out.push(result(`${tag}: all 52 bones are mapped to the skeleton the code drives`, bones === 52, { bones }));

        // height, thickness, rest pose
        hold(g0, POSE.idle);
        const box = new THREE.Box3().setFromObject(g0.model), size = box.getSize(new THREE.Vector3());
        const head = at(g0, 'Head'), hips = at(g0, 'Hips'), H = head.y;
        out.push(result(`${tag}: stands about ${rig.height} m tall`, Math.abs(size.y - rig.height) < rig.height * 0.1, { height: +size.y.toFixed(2) }));
        out.push(result(`${tag}: has a body, not a flat cut-out (thickness and width are real fractions of its height)`, size.z > size.y * 0.1 && size.x > size.y * 0.2, { size: size.toArray().map((n) => +n.toFixed(2)) }));
        const l = g0.limb;
        const armLen = l.Left.L1 + l.Left.L2, legLen = hips.y;
        out.push(result(`${tag}: the arms are a believable length (${(armLen / H).toFixed(2)} of the height to the head) and mirrored`, armLen > H * 0.22 && armLen < H * 0.55 && Math.abs(l.Left.L1 - l.Right.L1) < 0.02 && Math.abs(l.Left.L2 - l.Right.L2) < 0.02, { armLen: +armLen.toFixed(2), H: +H.toFixed(2) }));
        out.push(result(`${tag}: the rest pose is the T-pose the code expects (left arm out along +x, right arm along -x, hips above the feet)`, l.Left.a0.x > 0.9 && l.Right.a0.x < -0.9 && legLen > H * 0.35, { left: l.Left.a0.toArray().map((n) => +n.toFixed(2)), right: l.Right.a0.toArray().map((n) => +n.toFixed(2)) }));
        out.push(result(`${tag}: it has a skinned mesh bound to the skeleton, with textures kept for customers`, (() => {
          let skinned = 0, mapped = 0;
          g0.model.traverse((o) => { if (o.isSkinnedMesh) { skinned++; if (o.material && (Array.isArray(o.material) ? o.material.some((m) => m.map) : o.material.map)) mapped++; } });
          return skinned > 0 && (!rig.opts.keep || mapped > 0);
        })()));

        // standing: arms at the sides, hands clear of the body, feet on the floor, head above hips
        const hL = at(g0, 'LeftHand'), hR = at(g0, 'RightHand'), sh = (at(g0, 'LeftArm').y + at(g0, 'RightArm').y) / 2;
        out.push(result(`${tag}: standing, the arms hang at the sides (hands below the hips, beside the body, left on the left)`,
          hL.y < hips.y + H * 0.12 && hR.y < hips.y + H * 0.12 && hL.y > hips.y - H * 0.55 && hL.x > H * 0.05 && hR.x < -H * 0.05, { hL: hL.toArray().map((n) => +n.toFixed(2)), hR: hR.toArray().map((n) => +n.toFixed(2)), hips: +hips.y.toFixed(2) }));
        out.push(result(`${tag}: standing, the head is above the shoulders above the hips, and the feet are on the floor`, head.y > sh && sh > hips.y && Math.abs(box.min.y) < 0.05, { head: +head.y.toFixed(2), sh: +sh.toFixed(2), hips: +hips.y.toFixed(2), soles: +box.min.y.toFixed(3) }));

        // walking: at every point of the stride the arms stay below the shoulders and the legs swing
        const walks = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((ph) => { hold(g0, POSE.walk(ph), 45); return { L: at(g0, 'LeftHand'), R: at(g0, 'RightHand'), lf: at(g0, 'LeftFoot'), rf: at(g0, 'RightFoot') }; });
        out.push(result(`${tag}: walking, the hands never rise above the shoulders (no arms stuck in the air)`, walks.every((w) => w.L.y < sh && w.R.y < sh), { handsMax: +Math.max(...walks.flatMap((w) => [w.L.y, w.R.y])).toFixed(2), sh: +sh.toFixed(2) }));
        out.push(result(`${tag}: walking, the legs swing front and back (a real stride)`, Math.max(...walks.map((w) => Math.abs(w.lf.z - w.rf.z))) > H * 0.12, { stride: +Math.max(...walks.map((w) => Math.abs(w.lf.z - w.rf.z))).toFixed(2) }));

        // sitting: hips come down, knees go forward, the hands rest near the knees
        hold(g0, POSE.sit, 80);
        const sHips = at(g0, 'Hips'), kn = at(g0, 'LeftLeg'), sL = at(g0, 'LeftHand');
        out.push(result(`${tag}: sitting, the hips come down and the knees go forward`, sHips.y < hips.y - H * 0.15 && kn.z > sHips.z + H * 0.08, { hips: +sHips.y.toFixed(2), standing: +hips.y.toFixed(2), kneeAhead: +(kn.z - sHips.z).toFixed(2) }));
        out.push(result(`${tag}: sitting, the hands rest near the knees, not in the air`, sL.distanceTo(kn) < H * 0.4 && sL.y < sHips.y + H * 0.3, { dist: +sL.distanceTo(kn).toFixed(2) }));
        out.push(result(`${tag}: every bone stays finite and inside a metre of the body through standing, walking and sitting`, finite(g0) && KEYS.every((k) => at(g0, k).length() < H * 1.2)));

        // THE TURN-AT-LOAD BUG: the same pose must give the same shape however the figure (and the room it stands in) were turned
        // when the model finished loading
        const poses = { idle: POSE.idle, walk: POSE.walk(1.1), sit: POSE.sit };
        const ref = {};
        for (const [n, fn] of Object.entries(poses)) { hold(g0, fn, 60); ref[n] = shape(g0); }
        let worst = 0, where = '';
        for (const [yaw, pyaw] of [[2.1, 0], [0, 1.3], [-1.2, 0.9], [Math.PI, 0]]) {
          const g = await figure(rig, yaw, pyaw);
          for (const [n, fn] of Object.entries(poses)) { hold(g, fn, 60); const d = spread(ref[n], shape(g)); if (d > worst) { worst = d; where = `${n} turned ${yaw}/${pyaw}`; } }
          drop(g);
        }
        out.push(result(`${tag}: the pose does not depend on how the figure or its room was turned when the model loaded (the customers' arms-in-the-air bug)`, worst < 0.04, { worst: +worst.toFixed(3), where }));
      } catch (e) {
        out.push(result(`${tag}: loads and poses without an exception`, false, { error: String(e && e.message || e) }));
      } finally {
        if (g0) drop(g0);
      }
      out.push(result(`${tag}: no errors were logged`, T.errors.length === base, { errors: T.errors.slice(base) }));
    }
    return out;
  };

  // ------------------------------------------------------------------------------------------------ the real restaurant
  T.sweepCustomers = async () => {
    const out = [], base = T.errors.length, w = window.brain.w, r = w.restaurant;
    const headless = r.headless;
    const frames = async (n) => { for (let i = 0; i < n; i++) { window.sim(frame); window.scene.updateMatrixWorld(true); } };
    const waitLoaded = async (c) => { for (let i = 0; i < 400 && !(c.fig && c.fig.ok); i++) { await frames(3); await sleep(25); } return !!(c.fig && c.fig.ok); };
    try {
      T.resetRooms(); T.removeAll(); T.settle(); T.home(); T.prep('takeorder');
      r.headless = false; r.paused = true;
      for (const m of availableCustomers()) {
        const tag = `customer ${m.id}`;
        const measure = (c) => { const g = c.fig.g; g.root.updateWorldMatrix(true, true); const P = (n) => g.root.worldToLocal(g.boneWorld(n)); return { hips: P('Hips'), head: P('Head'), L: P('LeftHand'), R: P('RightHand'), kL: P('LeftLeg'), sh: (P('LeftArm').y + P('RightArm').y) / 2, foot: Math.min(P('LeftFoot').y, P('RightFoot').y) }; };
        const states = {
          waiting: (s, H) => s.R.y > s.head.y - H * 0.25 && s.L.y < s.hips.y + H * 0.3,                          // a hand up for the waiter, the other down
          ordered: (s, H) => s.L.y < s.hips.y + H * 0.3 && s.R.y < s.hips.y + H * 0.3,                            // hands in the lap
          cooked: (s, H) => s.L.y < s.hips.y + H * 0.3 && s.R.y < s.hips.y + H * 0.3,
          paying: (s, H) => s.L.y < s.hips.y + H * 0.15 && s.R.y < s.hips.y + H * 0.15 && s.L.x > 0 && s.R.x < 0,   // standing with the arms down
        };
        for (const [state, ok] of Object.entries(states)) {
          r.clear(); r.paused = true;
          const c = r.stage(state, m.id);
          if (!c) { out.push(result(`${tag}: a customer can be set up in the "${state}" state`, false)); continue; }
          const loaded = await waitLoaded(c);
          await frames(90);
          if (!loaded) { out.push(result(`${tag} ${state}: the model loads`, false)); continue; }
          const s = measure(c), standing = state === 'paying', H = s.head.y + (standing ? 0 : (m.height || 1.7) * 0.2);
          const good = ok(s, H) && s.head.y > s.hips.y && (standing ? s.hips.y > m.height * 0.35 : s.hips.y < m.height * 0.45);
          out.push(result(`${tag} ${state}: ${standing ? 'standing with the arms down' : state === 'waiting' ? 'sitting with one hand up' : 'sitting with the hands in the lap'} (hips ${s.hips.y.toFixed(2)}, hands ${s.L.y.toFixed(2)} / ${s.R.y.toFixed(2)}, head ${s.head.y.toFixed(2)})`, good, { hips: +s.hips.y.toFixed(2), L: +s.L.y.toFixed(2), R: +s.R.y.toFixed(2), head: +s.head.y.toFixed(2) }));
        }
        // eating: the fork goes between the plate and the mouth
        r.clear(); r.paused = true;
        const e = r.stage('cooked', m.id);
        if (e) {
          await waitLoaded(e); e.state = 'eating'; e.timer = 99; e.eatT = 0;
          const pts = [];
          for (let i = 0; i < 160; i++) { await frames(1); if (i % 4 === 0) pts.push(measure(e).R.clone()); }
          const s = measure(e), travel = Math.max(...pts.map((p) => p.distanceTo(pts[0]))), hi = Math.max(...pts.map((p) => p.y));
          out.push(result(`${tag} eating: the right hand travels ${travel.toFixed(2)} m between the plate and the mouth while the other rests`, travel > 0.12 && hi < s.head.y + 0.15 && s.L.y < s.hips.y + 0.3, { travel: +travel.toFixed(2), hi: +hi.toFixed(2) }));
        }
        // walking: the real walk out of the elevator
        r.clear(); r.paused = true;
        const k = r.spawn(m.id);
        if (k) {
          await waitLoaded(k);
          let walked = 0, worst = -9, minFoot = 9;
          for (let i = 0; i < 900 && walked < 30; i++) {
            await frames(1);
            if (k.moving) { walked++; const s = measure(k); worst = Math.max(worst, Math.max(s.L.y, s.R.y) - s.sh); minFoot = Math.min(minFoot, s.foot); }
          }
          out.push(result(`${tag} walking out of the elevator: the arms stay below the shoulders and the feet stay on the floor`, walked >= 30 && worst < 0 && minFoot > -0.12, { walked, handAboveShoulder: +worst.toFixed(2), minFoot: +minFoot.toFixed(2) }));
        }
      }
    } finally {
      r.clear(); r.headless = headless; r.paused = false;
      T.resetRooms();
    }
    out.push(result('customers: no errors were logged', T.errors.length === base, { errors: T.errors.slice(base) }));
    return out;
  };

  // used by the screenshots: a customer model standing or sitting in front of the camera
  T.rigs = RIGS;
  T.customerModels = availableCustomers;
  T._qa = { figure, hold, drop, POSE };                                  // for the pictures (qa-shots.js)
  T.summariseAsync = async (promise) => summarise(await promise);
}
