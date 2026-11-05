// The Shooting Range: an indoor room with three lanes. Each lane has a firing line, a holographic bullseye on a rail at the far end and a
// holographic enemy that walks up and down its lane. Low screens divide the lanes. A robot shoots at what is in front of him in his own
// lane by default, but he can also shoot into another lane when the line of fire clears the top of the screens in between: `clearShot`
// checks that line in 3D, and `candidates` lists what a robot in a lane can hit right now.
//
// Everything is in the room's own frame (like the Backyard's): x along the door wall from the middle of the room, z away from the door
// as -z. The door is at z = 0 and the far wall at z = -N. The robots stand on the firing line facing the far wall (their front is -z).
//
// The targets are holograms: additive, see-through materials with scanlines, flickering, popping in and dissolving. A shot leaves the
// robot's hand at MUZZLE_Y (GUY is 1.75 m tall) and is drawn as a tracer that fades out.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const RANGE = {
  lanes: [-2, 0, 2],          // lane centres (m along the door wall from the middle of the room)
  firingZ: -2.2,              // the firing line: this far in from the door wall
  partitionTop: 1.3,          // the screens between the lanes are this high
  partitionFrom: -3.0,        // and run from here to the far wall (the front of the lanes is open)
  screenPad: 0.14,            // the walking space kept clear round each screen's ends and sides (metres)
  railZ: -9.0,                // the bullseyes hang this far in
  railY: 1.55,                // at this height (their centres)
  railR: 0.3,                 // with this radius
  enemyZ: [-4.2, -8.2],       // the holographic enemies walk between these depths, in their own lane
  MUZZLE_Y: 1.42,             // the height a shot leaves the robot's hand
  shotMs: 240,                // how long a tracer stays on screen
};
// How often a shot that has a clear line goes where it was aimed (a shot across a lane is harder).
export const HIT = { own: 0.82, cross: 0.6 };
const HOLO = 0x5ef2ff;

const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------------------------------------------- textures
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// the bullseye: cyan rings on a transparent ground, with a white centre
const bullseyeTex = () => canvasTex(256, 256, (cx, w, h) => {
  cx.clearRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) {
    cx.beginPath(); cx.arc(w / 2, h / 2, (w / 2 - 6) * (1 - i / 5), 0, Math.PI * 2);
    cx.fillStyle = i % 2 === 0 ? 'rgba(94,242,255,0.55)' : 'rgba(94,242,255,0.12)'; cx.fill();
  }
  cx.beginPath(); cx.arc(w / 2, h / 2, 9, 0, Math.PI * 2); cx.fillStyle = 'rgba(255,255,255,0.9)'; cx.fill();
});
// scanlines: horizontal bars, so a figure reads as projected light
const scanTex = () => canvasTex(8, 64, (cx, w, h) => {
  cx.clearRect(0, 0, w, h);
  cx.fillStyle = '#ffffff';
  for (let y = 0; y < h; y += 8) cx.fillRect(0, y, w, 4);
}, [1, 6]);
const laneNumTex = (n) => canvasTex(128, 128, (cx, w, h) => {
  cx.clearRect(0, 0, w, h);
  cx.fillStyle = 'rgba(255,255,255,0.85)'; cx.font = 'bold 96px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(String(n), w / 2, h / 2 + 4);
});

// The fraction along a→b where it crosses c→d in the floor plane, or -1 when they do not cross.
function crossing(ax, az, bx, bz, cx, cz, dx, dz) {
  const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den;
  const u = ((cx - ax) * rz - (cz - az) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

// ---------------------------------------------------------------------------------------------------------------- the room
// Fills the room's group `g` (`L` wide along the door wall, `N` deep). Returns the range. The caller adds `g` to the scene and then calls
// `range.attach()`, which works out the screens' places in the world (for the line-of-fire checks and the robots' pathing: `obstacles`).
export function buildRangeShell(g, L, N) {
  const lanes = RANGE.lanes;
  const laneEdges = [-L / 2 + 0.05, -1, 1, L / 2 - 0.05];
  const score = { shots: 0, hits: 0, cross: 0, crossHits: 0, enemyHits: 0, railHits: 0 };

  // ---- floor: the lane edges, the firing line and the lane numbers
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, N), new THREE.MeshStandardMaterial({ color: 0x9a9fa6, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, -N / 2); floor.receiveShadow = true;
  g.add(floor);
  const paint = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  // a strip lying flat on the floor from (x0, z0) to (x1, z1) (room frame): a thin box, turned to the direction of the segment
  const floorLine = (x0, z0, x1, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, Math.hypot(x1 - x0, z1 - z0)), paint);
    m.position.set((x0 + x1) / 2, 0.007, (z0 + z1) / 2);
    m.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    g.add(m);
  };
  for (const x of laneEdges) floorLine(x, RANGE.firingZ + 0.25, x, -N + 0.05);
  floorLine(-L / 2 + 0.05, RANGE.firingZ, L / 2 - 0.05, RANGE.firingZ);
  lanes.forEach((x, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: laneNumTex(i + 1), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.009, RANGE.firingZ + 0.55);
    g.add(m);
  });

  // ---- the screens: solid, with a holographic strip along the top
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x7d8792, roughness: 0.6, metalness: 0.2 });
  const stripMat = new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity: 0.85 });
  const partitions = [];
  for (const x of [-1, 1]) {
    const z0 = RANGE.partitionFrom, z1 = -N + 0.02, len = z0 - z1, cz = (z0 + z1) / 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, RANGE.partitionTop, len), screenMat);
    p.position.set(x, RANGE.partitionTop / 2, cz); p.castShadow = true; p.receiveShadow = true;
    g.add(p);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, len), stripMat);
    top.position.set(x, RANGE.partitionTop + 0.01, cz);
    g.add(top);
    partitions.push({ x, z0, z1, top: RANGE.partitionTop, a: null, b: null });
  }
  const obstacles = partitions.map(() => ({ x0: 0, x1: 0, z0: 0, z1: 0 }));

  // ---- the holographic bullseyes and enemies, one of each per lane
  const scan = scanTex();                                       // (one texture for all the holograms)
  const holoMat = (opacity) => new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: scan });
  const railMat = new THREE.MeshBasicMaterial({ map: bullseyeTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const rig = new THREE.MeshStandardMaterial({ color: 0x40464e, roughness: 0.5, metalness: 0.5 });
  const targets = [];

  lanes.forEach((x, i) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.CircleGeometry(RANGE.railR, 40), railMat.clone()));
    group.add(new THREE.Mesh(new THREE.TorusGeometry(RANGE.railR + 0.02, 0.018, 8, 40),
      new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, RANGE.railY - RANGE.railR, 0.06), rig);
    post.position.set(0, -(RANGE.railY - RANGE.railR) / 2, -0.03);
    group.add(post);
    group.position.set(x, RANGE.railY, RANGE.railZ);
    g.add(group);
    targets.push({
      kind: 'rail', lane: i, group, alive: true, state: 'up', timer: 0, pos: { x, z: RANGE.railZ },
      aimAt: (k) => V(x, RANGE.railY + (k - 0.5) * RANGE.railR * 2, RANGE.railZ),
      onHit() { this.alive = false; this.state = 'falling'; this.timer = 0; score.railHits++; },
    });
  });

  // An enemy figure: a head, a chest, two arms and two legs, all holographic (faces the firing line, +z).
  const makeFigure = () => {
    const f = new THREE.Group();
    const parts = [];
    const add = (geo, y, px = 0) => { const m = new THREE.Mesh(geo, holoMat(0.55)); m.position.set(px, y, 0); f.add(m); parts.push(m); };
    add(new THREE.SphereGeometry(0.12, 16, 12), RANGE.enemyH - 0.13);
    add(new THREE.BoxGeometry(0.42, 0.62, 0.22), 1.12);
    for (const sx of [-0.31, 0.31]) add(new THREE.BoxGeometry(0.12, 0.6, 0.12), 1.1, sx);
    for (const sx of [-0.12, 0.12]) add(new THREE.BoxGeometry(0.16, 0.8, 0.16), 0.44, sx);
    return { group: f, parts };
  };
  lanes.forEach((x, i) => {
    const fig = makeFigure();
    const t = {
      kind: 'enemy', lane: i, group: fig.group, parts: fig.parts, alive: false, state: 'waiting', timer: rand(0.5, 2.5), life: 0,
      pos: { x, z: -6 }, dir: Math.random() < 0.5 ? 1 : -1, speed: 0.5,
      aimAt: (k) => V(x, 1.05 + k * 0.5, t.pos.z),
      onHit() { this.alive = false; this.state = 'dissolving'; this.timer = 0; score.enemyHits++; },
    };
    fig.group.position.set(x, 0, -6);
    fig.group.scale.set(1, 0.001, 1);
    g.add(fig.group);
    targets.push(t);
  });

  // ---- shots: a tracer, a muzzle flash and a ring where the shot lands, all short-lived
  const tracers = [];
  const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const additive = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), additive(0xffd28a)); flash.visible = false; g.add(flash);
  const impact = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.09, 16), additive(0x9ff7ff)); impact.visible = false; g.add(impact);
  let flashT = 0, impactT = 0;

  // the blaster: a grey pistol with a glowing tip, held in the right hand while he shoots
  const gun = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.2), rig); gunBody.position.set(0, 0, -0.06); gun.add(gunBody);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.2), rig); barrel.position.set(0, 0.02, -0.25); gun.add(barrel);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), additive(0xff8a3d)); tip.position.set(0, 0.02, -0.36); gun.add(tip);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.06), rig); grip.position.set(0, -0.11, 0); grip.rotation.x = 0.2; gun.add(grip);
  gun.visible = false;
  g.add(gun);

  const worldPt = (x, z) => g.localToWorld(V(x, 0, z));
  const range = {
    group: g, lanes: lanes.map((x, i) => ({ i, x })), obstacles, partitions, targets, score, gun,
    // Call once the group is in the scene: the screens' places in the world (their ends, and the pathing boxes).
    attach() {
      g.updateWorldMatrix(true, false);
      partitions.forEach((p, k) => {
        p.a = worldPt(p.x, p.z0); p.b = worldPt(p.x, p.z1);
        // (padded well beyond the screen: the walk skips waypoints within 25 cm, so it cuts corners, and a robot's body is ~20 cm wide)
        const pad = RANGE.screenPad;
        Object.assign(obstacles[k], { x0: Math.min(p.a.x, p.b.x) - pad, x1: Math.max(p.a.x, p.b.x) + pad, z0: Math.min(p.a.z, p.b.z) - pad, z1: Math.max(p.a.z, p.b.z) + pad });
      });
    },
    // where a robot stands to watch the range for a while: between the screens, a few metres in from the firing line, facing downrange
    hangSpot() {
      const p = worldPt(0, RANGE.firingZ - 2.2), a = worldPt(0, 0), b = worldPt(0, -1);
      return { x: p.x, z: p.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    },
    // where a robot in lane `i` stands to shoot (world)
    firingSpot(i) { const p = worldPt(lanes[i], RANGE.firingZ); return { x: p.x, z: p.z }; },
    // the way a robot on the firing line faces: away from the door (world yaw, as the walk steps take it)
    awayYaw() { const a = worldPt(0, 0), b = worldPt(0, -1); return Math.atan2(b.x - a.x, b.z - a.z); },
    // the muzzle of a robot in lane `i` (world)
    muzzle(i) { const p = worldPt(lanes[i], RANGE.firingZ); return V(p.x, RANGE.MUZZLE_Y, p.z); },
    // a target's aim point at height fraction k (0 = bottom of the bullseye or the enemy's waist, 1 = top), in the world
    worldAim(t, k) { return g.localToWorld(t.aimAt(k)); },
    // Is the straight line from `from` to `to` (both world) above every screen it crosses?
    clearShot(from, to) {
      for (const p of partitions) {
        const f = crossing(from.x, from.z, to.x, to.z, p.a.x, p.a.z, p.b.x, p.b.z);
        if (f < 0) continue;
        if (from.y + (to.y - from.y) * f < p.top) return false;
      }
      return true;
    },
    // Everything a robot in lane `i` can shoot at right now: [{ target, k, point, own }], one aim point per target (the first clear one).
    candidates(i) {
      const from = range.muzzle(i), out = [];
      for (const t of targets) {
        if (!t.alive) continue;
        for (const k of [0.5, 0.25, 0.75, 0.1, 0.9, 0.4, 0.6]) {
          const point = range.worldAim(t, k);
          if (!range.clearShot(from, point)) continue;
          out.push({ target: t, k, point, own: t.lane === i });
          break;
        }
      }
      return out;
    },
    // Fire from lane `i` at the world point `to` on `target`. The shot hits when the line is clear and the target is still up
    // (and the hand is steady: HIT). A miss lands a little off the target.
    fire(i, target, to) {
      const from = range.muzzle(i);
      const clear = range.clearShot(from, to);
      const own = target.lane === i;
      score.shots++;
      if (!own) score.cross++;
      const hit = clear && target.alive && Math.random() < (own ? HIT.own : HIT.cross);
      const land = hit ? to.clone() : to.clone().add(V(rand(-0.45, 0.45), rand(-0.3, 0.3), 0));
      if (hit) {
        score.hits++;
        if (!own) score.crossHits++;
        target.onHit();
      }
      range.tracer(from, land);
      return { hit, clear, own, land };
    },
    // a tracer from the muzzle to where the shot lands, a flash at the muzzle and a ring where it lands (all world points)
    tracer(a, b) {
      const la = g.worldToLocal(a.clone()), lb = g.worldToLocal(b.clone());
      const m = new THREE.Mesh(tracerGeo, additive(0xff8a3d));
      m.position.copy(la).add(lb).multiplyScalar(0.5);
      const dir = lb.clone().sub(la);
      m.scale.set(1, dir.length(), 1);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      g.add(m);
      tracers.push({ m, t: 0 });
      flash.position.copy(la); flash.visible = true; flashT = 0;
      impact.position.copy(lb); impact.visible = true; impactT = 0;
      impact.quaternion.setFromUnitVectors(V(0, 0, 1), la.clone().sub(lb).normalize());     // the ring faces the shooter
    },
    // holds the blaster in the hand (world): `hand` is the hand's place, `dir` the way the barrel points (unit, world)
    holdGun(hand, dir) {
      gun.visible = true;
      const h = g.worldToLocal(hand.clone()), d = g.worldToLocal(hand.clone().add(dir)).sub(h).normalize();
      gun.position.copy(h).addScaledVector(d, 0.06);
      gun.quaternion.setFromUnitVectors(V(0, 0, -1), d);
    },
    hideGun() { gun.visible = false; },
    // moves the figures and the bullseyes, and fades the shots
    update(dt) {
      for (const t of targets) {
        if (t.kind === 'rail') {
          if (t.state === 'falling') {
            t.timer += dt;
            t.group.rotation.x = Math.min(1.5, t.timer * 6);
            t.group.scale.setScalar(Math.max(0.2, 1 - t.timer));
            if (t.timer > 1.1) { t.state = 'up'; t.alive = true; t.group.rotation.x = 0; t.group.scale.setScalar(1); }
          }
          continue;
        }
        if (t.state === 'waiting') {
          t.timer -= dt;
          if (t.timer <= 0) {
            t.pos.z = rand(RANGE.enemyZ[0], RANGE.enemyZ[1]); t.group.position.set(t.pos.x, 0, t.pos.z);
            t.state = 'popping'; t.timer = 0; t.life = rand(4, 7);
          }
        } else if (t.state === 'popping') {
          t.timer += dt;
          const k = Math.min(1, t.timer / 0.35);
          t.group.scale.set(1, Math.max(0.001, k), 1);
          if (k >= 1) { t.state = 'up'; t.alive = true; }
        } else if (t.state === 'up') {
          t.life -= dt;
          t.pos.z += t.dir * t.speed * dt;
          if (t.pos.z < RANGE.enemyZ[0] || t.pos.z > RANGE.enemyZ[1]) t.dir *= -1;
          t.pos.z = Math.min(RANGE.enemyZ[1], Math.max(RANGE.enemyZ[0], t.pos.z));
          t.group.position.z = t.pos.z;
          const flicker = 0.5 + 0.1 * Math.sin(performance.now() / 90 + t.lane);
          for (const p of t.parts) p.material.opacity = flicker;
          if (t.life <= 0) { t.alive = false; t.state = 'dissolving'; t.timer = 0; }
        } else if (t.state === 'dissolving') {
          t.timer += dt;
          const k = Math.max(0, 1 - t.timer / 0.45);
          t.group.scale.set(1, Math.max(0.001, k), 1);
          for (const p of t.parts) p.material.opacity = 0.55 * k;
          if (k <= 0) { t.state = 'waiting'; t.timer = rand(1.5, 3.5); t.group.scale.set(1, 0.001, 1); }
        }
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i];
        tr.t += dt;
        const k = tr.t / (RANGE.shotMs / 1000);
        tr.m.material.opacity = Math.max(0, 1 - k);
        if (k >= 1) { g.remove(tr.m); tr.m.material.dispose(); tracers.splice(i, 1); }
      }
      if (flash.visible) { flashT += dt; flash.material.opacity = Math.max(0, 1 - flashT / 0.07); if (flashT > 0.07) flash.visible = false; }
      if (impact.visible) { impactT += dt; const k = impactT / 0.22; impact.material.opacity = Math.max(0, 1 - k); impact.scale.setScalar(1 + k * 1.2); if (k >= 1) impact.visible = false; }
    },
  };
  return range;
}
