// The Shooting Range: an indoor room with three lanes. Each lane has a firing line, a holographic bullseye on a rail at the far end and a
// holographic enemy that walks up and down its lane. Low screens divide the lanes. A robot shoots at what is in front of him in his own
// lane by default, but he can also shoot into another lane when the line of fire clears the top of the screens in between: `clearShot`
// checks that line in 3D, and `candidates` lists what a robot in a lane can hit right now.
//
// The room is as wide as GUY's room (8 m): the three lanes take the middle 6 m and a 1 m bay on each side holds the equipment: a
// display case of blasters on one side wall (a robot takes his blaster from it and puts it back) and, on the other side wall, a round
// controller (he presses the button to start a round: the targets reset) and a scoreboard (he looks at the score when he is done).
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
  bayX: 3.0,                  // the lanes end here (the equipment bays are beyond, up to the side walls)
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
  const side = L / 2, bx = RANGE.bayX;
  const laneEdges = [-bx, -1, 1, bx];
  const score = { shots: 0, hits: 0, cross: 0, crossHits: 0, enemyHits: 0, railHits: 0, round: { shots: 0, hits: 0 } };

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
  floorLine(-bx, RANGE.firingZ, bx, RANGE.firingZ);
  const bayMat = new THREE.MeshStandardMaterial({ color: 0x80868e, roughness: 0.95 });            // the equipment bays: a darker floor beside the lanes
  for (const sx of [-1, 1]) {
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(side - bx, N - 0.05), bayMat);
    bay.rotation.x = -Math.PI / 2; bay.position.set(sx * (bx + side) / 2, 0.004, -N / 2); bay.receiveShadow = true;
    g.add(bay);
  }
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

  // ---- the equipment bays: fixtures against the side walls (each is a pathing obstacle, and keeps wall pieces off it)
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa4af, roughness: 0.4, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a525c, roughness: 0.7, metalness: 0.2 });
  const inside = new THREE.MeshBasicMaterial({ color: 0x24505c });                      // the lit back of the case
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe9f2, transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.1, depthWrite: false });
  const glow = (color) => new THREE.MeshBasicMaterial({ color });
  const bxm = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b; };
  const label = (text, w, h, cw, ch, font) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map: canvasTex(cw, ch, (cx) => { cx.fillStyle = '#10151c'; cx.fillRect(0, 0, cw, ch); cx.fillStyle = '#5ef2ff'; cx.font = font; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, cw / 2, ch / 2 + 2); }) }));
  const fixtures = [];                                                // [{ name, x0, x1, z0, z1, h }] in the room's frame
  const worldPt0 = (x, y, z) => g.localToWorld(V(x, y, z));
  const worldYaw = (dx, dz) => { const a = worldPt0(0, 0, 0), b = worldPt0(dx, 0, dz); return Math.atan2(b.x - a.x, b.z - a.z); };

  // the display case (on the +x side wall): a cabinet with a glass front and a lit shelf; a blaster of each kind lies on the shelf
  const display = (() => {
    const front = side - 0.45, cz = -2.0, len = 1.6, slotY = 1.17;
    const slots = { 'range.pistol': { z: -1.45 }, 'range.carbine': { z: -2.2 } };
    const grp = new THREE.Group(); grp.position.set(side - 0.225, 0, cz); g.add(grp);
    bxm(0.45, 0.8, len, dark, 0, 0.4, 0, grp);                                         // the cabinet below
    bxm(0.45, 0.06, len, metal, 0, 1.83, 0, grp);                                      // the top
    bxm(0.04, 1.0, 0.05, metal, -0.2, 1.3, -len / 2 + 0.025, grp); bxm(0.04, 1.0, 0.05, metal, -0.2, 1.3, len / 2 - 0.025, grp);
    bxm(0.02, 1.0, len - 0.1, glassMat, -0.215, 1.3, 0, grp);                          // the glass front
    bxm(0.04, 1.0, len, inside, 0.2, 1.3, 0, grp);                                     // the back
    bxm(0.4, 0.03, len - 0.1, metal, 0, 1.11, 0, grp);                                 // the shelf
    bxm(0.38, 0.02, len - 0.1, glow(HOLO), 0, 1.79, 0, grp);                           // the light along the top
    const plate = label('ARMORY', 0.5, 0.12, 256, 64, 'bold 34px sans-serif'); plate.position.set(-0.226, 0.55, 0); plate.rotation.y = -Math.PI / 2; grp.add(plate);
    const blaster = (kind) => {
      const b = new THREE.Group(), carbine = kind === 'range.carbine', n = carbine ? 0.9 : 0.4;
      bxm(0.045, 0.08, n * 0.45, metal, 0, 0, n * 0.15 - 0.02, b);                       // the body
      bxm(0.028, 0.03, n * 0.5, metal, 0, 0.015, -n * 0.32, b);                          // the barrel
      bxm(0.04, 0.09, 0.04, metal, 0, -0.07, n * 0.2, b);                                // the grip
      if (carbine) bxm(0.04, 0.1, 0.16, metal, 0, -0.01, n * 0.45, b);                   // the stock
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), glow(0xff8a3d)); tip.position.set(0, 0.015, -n * 0.58); b.add(tip);
      return b;
    };
    const models = {};
    for (const [kind, sl] of Object.entries(slots)) {
      const m = blaster(kind); m.position.set(-0.02, slotY + 0.05, sl.z - cz);
      grp.add(m); models[kind] = m;
    }
    fixtures.push({ name: 'blaster case', x0: front, x1: side, z0: cz - len / 2, z1: cz + len / 2, h: 1.9 });
    const d = {
      group: grp,                                                                // (what a long-press can hit)
      out: {},                                                                   // the kinds that are out of the case
      slot(kind) { return worldPt0(front + 0.2, slotY + 0.1, slots[kind].z); },                // where the hand goes to take it
      standSpot(kind) { const p = worldPt0(front - 0.5, 0, slots[kind].z); return { x: p.x, z: p.z, yaw: worldYaw(1, 0) }; },
      // (both robots may take the same kind: it is back on the shelf when the last one has given it back)
      take(kind) { if (!models[kind]) return false; d.out[kind] = (d.out[kind] || 0) + 1; models[kind].visible = false; return true; },
      giveBack(kind) { if (!models[kind]) return false; if (d.out[kind] > 1) d.out[kind]--; else { delete d.out[kind]; models[kind].visible = true; } return true; },
    };
    return d;
  })();

  // the round controller (on the -x side wall): a button that starts a round. The targets come up at once and the round's score
  // starts again; the lamp stays lit for a few seconds.
  const panel = (() => {
    const bz = -1.9, by = 1.45, grp = new THREE.Group(); grp.position.set(-side, 0, bz); g.add(grp);
    bxm(0.1, 0.6, 0.7, dark, 0.05, by, 0, grp);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0x35c15a, roughness: 0.4 }));
    cap.rotation.z = Math.PI / 2; cap.position.set(0.12, by - 0.12, 0); grp.add(cap);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x3a3f46 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), lampMat); lamp.position.set(0.11, by + 0.18, 0.22); grp.add(lamp);
    const tag = label('START ROUND', 0.55, 0.12, 256, 56, 'bold 28px sans-serif'); tag.position.set(0.101, by + 0.05, 0); tag.rotation.y = Math.PI / 2; grp.add(tag);
    fixtures.push({ name: 'round controller', x0: -side, x1: -side + 0.15, z0: bz - 0.35, z1: bz + 0.35, h: 2.0 });
    return {
      group: grp,
      lit: 0,
      buttonPoint() { return worldPt0(-side + 0.12, by - 0.12, bz); },
      standSpot() { const p = worldPt0(-side + 0.55, 0, bz); return { x: p.x, z: p.z, yaw: worldYaw(-1, 0) }; },
      update(dt) { if (this.lit > 0) { this.lit = Math.max(0, this.lit - dt); lampMat.color.setHex(this.lit > 0 ? 0xffc83d : 0x3a3f46); } },
    };
  })();

  // the scoreboard (on the -x side wall, further in): this round's hits and shots, and what has been brought down
  const board = (() => {
    const bz = -5.2, cw = 512, ch = 256, canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    let key = '';
    const draw = () => {
      const k = `${score.round.hits}/${score.round.shots}/${score.enemyHits}/${score.railHits}`;
      if (k === key) return;
      key = k;
      const cx = canvas.getContext('2d');
      cx.fillStyle = '#10151c'; cx.fillRect(0, 0, cw, ch);
      cx.strokeStyle = '#5ef2ff'; cx.lineWidth = 6; cx.strokeRect(6, 6, cw - 12, ch - 12);
      cx.fillStyle = '#5ef2ff'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.font = 'bold 34px sans-serif'; cx.fillText('THIS ROUND', cw / 2, 52);
      cx.font = 'bold 84px sans-serif'; cx.fillText(`${score.round.hits} / ${score.round.shots}`, cw / 2, 130);
      cx.font = 'bold 30px sans-serif'; cx.fillText(`ENEMIES ${score.enemyHits}   BULLSEYES ${score.railHits}`, cw / 2, 211);
      tex.needsUpdate = true;
    };
    draw();
    const grp = new THREE.Group(); grp.position.set(-side, 0, bz); g.add(grp);
    bxm(0.08, 0.95, 1.85, dark, 0.04, 1.75, 0, grp);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.875), new THREE.MeshBasicMaterial({ map: tex }));
    face.position.set(0.082, 1.75, 0); face.rotation.y = Math.PI / 2; grp.add(face);
    fixtures.push({ name: 'scoreboard', x0: -side, x1: -side + 0.1, z0: bz - 0.93, z1: bz + 0.93, h: 2.3 });
    return {
      group: grp,
      draw,
      standSpot() { const p = worldPt0(-side + 1.2, 0, bz); return { x: p.x, z: p.z, yaw: worldYaw(-1, 0) }; },
    };
  })();
  for (const f of fixtures) obstacles.push({ name: f.name, fixture: f, x0: 0, x1: 0, z0: 0, z1: 0, h: f.h });

  // ---- shots: a tracer, a muzzle flash and a ring where the shot lands, all short-lived
  const tracers = [];
  const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const additive = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), additive(0xffd28a)); flash.visible = false; g.add(flash);
  const impact = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.09, 16), additive(0x9ff7ff)); impact.visible = false; g.add(impact);
  let flashT = 0, impactT = 0;

  // the blasters in the robots' hands: a grey pistol with a glowing tip, one for each robot (GUY's and GAL's), held in the right hand
  const makeGun = () => {
    const gun = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.2), rig); gunBody.position.set(0, 0, -0.06); gun.add(gunBody);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.2), rig); barrel.position.set(0, 0.02, -0.25); gun.add(barrel);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), additive(0xff8a3d)); tip.position.set(0, 0.02, -0.36); gun.add(tip);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.06), rig); grip.position.set(0, -0.11, 0); grip.rotation.x = 0.2; gun.add(grip);
    gun.visible = false;
    g.add(gun);
    return {
      group: gun,
      get visible() { return gun.visible; },
      // `hand` is the hand's place (world), `dir` the way the barrel points (unit, world); the grip sits in the palm
      hold(hand, dir) {
        gun.visible = true;
        const h = g.worldToLocal(hand.clone()), d = g.worldToLocal(hand.clone().add(dir)).sub(h).normalize();
        gun.position.copy(h).addScaledVector(d, 0.06);
        gun.quaternion.setFromUnitVectors(V(0, 0, -1), d);
      },
      hide() { gun.visible = false; },
      setKind(kind) { gun.scale.z = kind === 'range.carbine' ? 1.5 : 1; },       // the long one for the carbine
      // the glowing tip, where a shot starts (world)
      tipWorld() { gun.updateWorldMatrix(true, false); return gun.localToWorld(V(0, 0.02, -0.36 * gun.scale.z)); },
    };
  };
  const guns = { guy: makeGun(), gal: makeGun() };

  const worldPt = (x, z) => g.localToWorld(V(x, 0, z));
  const range = {
    group: g, lanes: lanes.map((x, i) => ({ i, x })), obstacles, partitions, targets, score, guns, gun: guns.guy, makeGun, display, panel, board,
    // Call once the group is in the scene: the screens' places in the world (their ends, and the pathing boxes).
    attach() {
      g.updateWorldMatrix(true, false);
      partitions.forEach((p, k) => {
        p.a = worldPt(p.x, p.z0); p.b = worldPt(p.x, p.z1);
        // (padded well beyond the screen: the walk skips waypoints within 25 cm, so it cuts corners, and a robot's body is ~20 cm wide)
        const pad = RANGE.screenPad;
        Object.assign(obstacles[k], { x0: Math.min(p.a.x, p.b.x) - pad, x1: Math.max(p.a.x, p.b.x) + pad, z0: Math.min(p.a.z, p.b.z) - pad, z1: Math.max(p.a.z, p.b.z) + pad });
      });
      for (const o of obstacles.slice(partitions.length)) {                       // the fixtures against the side walls
        const f = o.fixture, c = [[f.x0, f.z0], [f.x0, f.z1], [f.x1, f.z0], [f.x1, f.z1]].map(([x, z]) => worldPt(x, z));
        Object.assign(o, { x0: Math.min(...c.map((q) => q.x)), x1: Math.max(...c.map((q) => q.x)), z0: Math.min(...c.map((q) => q.z)), z1: Math.max(...c.map((q) => q.z)) });
      }
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
    // `tip` (world, optional): where the shot leaves the blaster in his hand; the line of fire is judged from the lane's muzzle
    fire(i, target, to, tip) {
      const from = range.muzzle(i);
      const clear = range.clearShot(from, to);
      const own = target.lane === i;
      score.shots++; score.round.shots++;
      if (!own) score.cross++;
      const hit = clear && target.alive && Math.random() < (own ? HIT.own : HIT.cross);
      const land = hit ? to.clone() : to.clone().add(V(rand(-0.45, 0.45), rand(-0.3, 0.3), 0));
      if (hit) {
        score.hits++; score.round.hits++;
        if (!own) score.crossHits++;
        target.onHit();
      }
      range.tracer(tip || from, land);
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
    // each robot's own blaster: GUY's and GAL's (rangebrain.js holds the one that is its own)
    gunFor(isGal) { return isGal ? guns.gal : guns.guy; },
    hideGuns() { guns.guy.hide(); guns.gal.hide(); },
    // the way a robot on the firing line points when he is not aiming at anything (world, unit)
    awayDir() { const a = worldPt(0, 0), b = worldPt(0, -1); return V(b.x - a.x, 0, b.z - a.z).normalize(); },
    // the button on the round controller: every enemy comes up now, every bullseye is up again, and the round's score starts again
    startRound() {
      for (const t of targets) {
        if (t.kind === 'rail') { t.state = 'up'; t.alive = true; t.group.rotation.x = 0; t.group.scale.setScalar(1); }
        else if (t.state === 'waiting') t.timer = 0.05;
      }
      score.round.shots = 0; score.round.hits = 0;
      panel.lit = 4;
      board.draw();
    },
    // moves the figures and the bullseyes, and fades the shots
    update(dt) {
      panel.update(dt); board.draw();
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
