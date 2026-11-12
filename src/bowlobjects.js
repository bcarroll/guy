// The Bowling Alley: an indoor room with three lanes. Each lane has an approach, a foul line, boards with arrows, a gutter on each side,
// ten pins on the pin deck and a pit behind them. A ball return stands beside every approach, a rack of house balls and a scoreboard
// are against the side walls, and the walls glow with neon.
//
// The rules and the physics of a thrown ball are in bowlrules.js (no 3D there, so they can be tested alone). This file draws it: the
// ball rolling down the lane, the pins tipping over and flying into the pit, the sweep that clears them, the game on the scoreboard.
//
// Everything is in the room's own frame (like the Range's): x along the door wall from the middle of the room, z away from the door as
// -z. The door is at z = 0 and the far wall at z = -N. The robots stand on the approach facing the far wall (their front is -z).
//
// Pins are cleared and set up again by hand (a robot walks down the lane and does it) until an Automatic Pinsetter has been built
// (the easter egg: it needs the Metal Factory): then each lane sweeps and racks its pins by itself. A set of wooden pins and a wooden
// ball, built in the Workshop (the Wood & Metal book's chapters 4 and 5), change the pins and add a ball to the rack.
import * as THREE from 'three';
import { LANE, PIN_SPOTS, scoreGame, afterRoll, throwBall, pathX } from './bowlrules.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const rand = (a, b) => a + Math.random() * (b - a);

export const BOWL = {
  lanes: [-2, 0, 2],          // lane centres (m along the door wall from the middle of the room)
  startZ: LANE.foulZ + 1.25,  // where a robot stands to start his approach
  standZ: LANE.foulZ + 0.8,   // and where he delivers the ball from
  returnDX: 1.0,              // each lane's ball return stands this far to the side of it (+x), ...
  returnZ: -1.75,             // ... this far in
  rackX: 3.62,                // the rack of house balls (against the +x wall)
  rackZ: -4.6,
  boardZ: -6.3,               // the scoreboard (on the -x wall)
  speed: [3.6, 5.4],          // how fast a ball goes down the lane (m/s)
  returnSecs: 3.4,            // how long a ball takes to come back
};
export const BALL_COLORS = [0xd32f2f, 0x1976d2, 0x2e7d32, 0x7b1fa2, 0xf57c00, 0x00838f, 0xc2185b, 0x455a64];
export const WOOD_BALL = 0x5a3a22;

// ---------------------------------------------------------------------------------------------------------------- pins and balls
// A bowling pin, to scale (38 cm tall): a lathe turned from its real profile (inches), with two red stripes on the neck.
const PROFILE = [[0, 0], [1.125, 0], [1.35, 0.25], [1.8, 1.2], [2.2, 2.8], [2.38, 4.4], [2.25, 6.0], [1.85, 7.6], [1.4, 9.2], [1.05, 10.8], [0.9, 11.8], [1.05, 12.7], [1.25, 13.6], [1.2, 14.4], [0.8, 14.9], [0, 15]];
const pinGeos = {};
function pinGeometry(style) {
  if (pinGeos[style]) return pinGeos[style];
  const geo = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r * 0.0254, y * 0.0254)), 16);
  const base = new THREE.Color(style === 'maple' ? 0xe6c590 : 0xf6f6f0), red = new THREE.Color(0xc62828), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let k = 0; k < pos.count; k++) {
    const y = pos.getY(k) / 0.0254, c = (y > 10.3 && y < 11.2) || (y > 11.9 && y < 12.6) ? red : base;
    col.set([c.r, c.g, c.b], k * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return (pinGeos[style] = geo);
}
const pinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05 });
export function makePin(style = 'plastic', scale = 1) {
  const m = new THREE.Mesh(pinGeometry(style), pinMat);
  m.castShadow = true;
  m.scale.setScalar(scale);
  m.userData.style = style;
  return m;
}
// A bowling ball: a shiny sphere with three finger holes (dark discs on the surface, facing +z).
export function makeBall(color = 0xd32f2f, wood = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(LANE.ballR, 24, 16), new THREE.MeshStandardMaterial({ color, roughness: wood ? 0.55 : 0.18, metalness: wood ? 0 : 0.25 }));
  body.castShadow = true;
  g.add(body);
  const hole = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
  for (const [x, y] of [[-0.028, 0.032], [0.028, 0.032], [0, -0.03]]) {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.0125, 10), hole);
    const dir = V(x, y, 0.1).normalize();
    h.position.copy(dir).multiplyScalar(LANE.ballR + 0.0008);
    h.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
    g.add(h);
  }
  g.userData.body = body;
  g.userData.setLook = (c, w) => { body.material.color.setHex(c); body.material.roughness = w ? 0.55 : 0.18; body.material.metalness = w ? 0 : 0.25; };
  return g;
}

// ---------------------------------------------------------------------------------------------------------------- textures
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// the boards of a lane, seen from above (the pit end at the top of the picture, the foul line at the bottom): 39 boards, seven arrows and
// a row of dots, the pin deck a little lighter
const laneTex = (len) => canvasTex(128, 1024, (cx, w, h) => {
  const boards = 39, bw = w / boards;
  for (let b = 0; b < boards; b++) { cx.fillStyle = b % 2 ? '#d8b06c' : '#cfa660'; cx.fillRect(b * bw, 0, bw + 0.5, h); }
  const row = (z) => ((z - LANE.pitZ) / (LANE.foulZ - LANE.pitZ)) * h;
  cx.fillStyle = 'rgba(255,240,200,0.18)'; cx.fillRect(0, 0, w, row(LANE.headZ + 0.4));
  cx.fillStyle = 'rgba(60,35,15,0.75)';
  for (let k = 0; k < 7; k++) {                                       // the arrows: a shallow V pointing down the lane
    const x = w / 2 + (k - 3) * (w / 8.2), z = LANE.foulZ - 2.1 - Math.abs(k - 3) * 0.28, y = row(z);
    cx.beginPath(); cx.moveTo(x, y - 14); cx.lineTo(x - 5, y + 10); cx.lineTo(x + 5, y + 10); cx.closePath(); cx.fill();
  }
  for (let k = 0; k < 7; k++) { cx.beginPath(); cx.arc(w / 2 + (k - 3) * (w / 8.2), row(LANE.foulZ - 0.9), 2.6, 0, 7); cx.fill(); }
  for (const k of [-3, -2, -1, 1, 2, 3]) { cx.beginPath(); cx.arc(w / 2 + k * (w / 8.2), row(LANE.foulZ - 0.5), 2.6, 0, 7); cx.fill(); }
});
const approachTex = () => canvasTex(128, 128, (cx, w, h) => {
  const boards = 39, bw = w / boards;
  for (let b = 0; b < boards; b++) { cx.fillStyle = b % 2 ? '#dcb878' : '#d3ae6c'; cx.fillRect(b * bw, 0, bw + 0.5, h); }
});
// the loud carpet of every bowling alley
const carpetTex = (L, N) => canvasTex(256, 256, (cx, w, h) => {
  cx.fillStyle = '#1c1745'; cx.fillRect(0, 0, w, h);
  const cols = ['#19d3da', '#ff3fa4', '#ffd23f', '#7a5cff'];
  let seed = 11; const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let k = 0; k < 34; k++) {
    cx.fillStyle = cols[k % cols.length]; cx.globalAlpha = 0.55;
    const x = r() * w, y = r() * h, s = 8 + r() * 16;
    cx.beginPath();
    if (k % 3 === 0) cx.arc(x, y, s / 2, 0, 7); else { cx.moveTo(x, y); cx.lineTo(x + s, y + r() * s); cx.lineTo(x + r() * s, y + s); cx.closePath(); }
    cx.fill();
  }
  cx.globalAlpha = 1;
}, [L / 2.2, N / 2.2]);
const neonTex = (text, color, w, h, font) => canvasTex(w, h, (cx) => {
  cx.clearRect(0, 0, w, h);
  cx.font = font; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.shadowColor = color; cx.shadowBlur = 22; cx.fillStyle = color;
  cx.fillText(text, w / 2, h / 2 + 4); cx.fillText(text, w / 2, h / 2 + 4);
  cx.shadowBlur = 0; cx.fillStyle = '#ffffff'; cx.globalAlpha = 0.85; cx.fillText(text, w / 2, h / 2 + 4);
});

// ---------------------------------------------------------------------------------------------------------------- the room
// Fills the room's group `g` (`L` wide along the door wall, `N` deep). Returns the alley. The caller adds `g` to the scene and then calls
// `bowl.attach()`, which works out where the equipment is in the world (the robots' pathing: `obstacles`).
export function buildBowlShell(g, L, N) {
  const side = L / 2, lanes = BOWL.lanes;
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
  const bxm = (w, h, d, m, x, y, z, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const flat = (w, d, m, x, y, z) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; g.add(p); return p; };
  const worldPt0 = (x, y, z) => g.localToWorld(V(x, y, z));
  const worldYaw = (dx, dz) => { const a = worldPt0(0, 0, 0), b = worldPt0(dx, 0, dz); return Math.atan2(b.x - a.x, b.z - a.z); };
  const dark = mat(0x2b3038, { metalness: 0.3 }), chrome = mat(0xc9d0d8, { metalness: 0.8, roughness: 0.25 });
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
  const state = { maple: false, woodBall: false, time: 0 };

  // ---- the floor: carpet everywhere, wood on the lanes and the approaches, a dark pit behind the pins
  flat(L, N, new THREE.MeshStandardMaterial({ map: carpetTex(L, N), roughness: 0.95 }), 0, 0.003, -N / 2);
  const laneLen = LANE.foulZ - LANE.pitZ, lm = new THREE.MeshStandardMaterial({ map: laneTex(laneLen), roughness: 0.3, metalness: 0.05 });
  const am = new THREE.MeshStandardMaterial({ map: approachTex(), roughness: 0.4 });
  const gutterMat = mat(0x16181d, { roughness: 0.6 }), edgeMat = mat(0x3a3f48, { roughness: 0.4, metalness: 0.4 });
  const foulMat = mat(0x8a1c1c, { roughness: 0.5 });
  const halfW = LANE.half + LANE.gutter;
  flat(L, N - (-LANE.pitZ - 0.001) + 0.05 - 0.05, mat(0x07080a), 0, 0.005, (LANE.pitZ - N) / 2 + 0.0).visible = false;
  for (const x of lanes) {
    flat(LANE.half * 2, laneLen, lm, x, 0.006, (LANE.foulZ + LANE.pitZ) / 2);
    flat(halfW * 2, 1.5, am, x, 0.006, (LANE.foulZ + (-0.9)) / 2 + 0.0);
    for (const s of [-1, 1]) {
      flat(LANE.gutter, laneLen, gutterMat, x + s * (LANE.half + LANE.gutter / 2), 0.006, (LANE.foulZ + LANE.pitZ) / 2);
      bxm(0.025, 0.02, laneLen, edgeMat, x + s * LANE.half, 0.012, (LANE.foulZ + LANE.pitZ) / 2);
      bxm(0.04, 0.04, laneLen - 1.0, chrome, x + s * (halfW + 0.02), 0.02, (LANE.foulZ + LANE.pitZ) / 2 + 0.5);
    }
    bxm(LANE.half * 2, 0.012, 0.045, foulMat, x, 0.012, LANE.foulZ);
    // the lane's number, painted at the start of the approach
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (cx, w, h) => { cx.clearRect(0, 0, w, h); cx.fillStyle = 'rgba(60,35,15,0.8)'; cx.font = 'bold 54px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(lanes.indexOf(x) + 1), w / 2, h / 2 + 3); }), transparent: true, depthWrite: false }));
    num.rotation.x = -Math.PI / 2; num.position.set(x, 0.009, -1.05); g.add(num);
    // the pit: dark, behind the pin deck, with kickback plates down the sides of the deck and a curtain across the end
    flat(halfW * 2, N + LANE.pitZ, mat(0x08090c), x, 0.0065, (LANE.pitZ - N) / 2);
    for (const s of [-1, 1]) bxm(0.05, 0.28, LANE.headZ - LANE.pitZ + 0.5, chrome, x + s * (halfW - 0.04), 0.14, (LANE.headZ + 0.5 + LANE.pitZ) / 2);
    bxm(halfW * 2 - 0.1, 0.4, 0.04, mat(0x15171c), x, 0.2, LANE.pitZ + 0.02);
  }
  // ---- the walls: neon along the top, a big sign on the far wall
  const pink = glow(0xff3fa4), cyan = glow(0x19d3da);
  bxm(L, 0.05, 0.05, pink, 0, 2.95, -N + 0.03); bxm(L, 0.05, 0.05, cyan, 0, 2.55, -N + 0.03);
  for (const s of [-1, 1]) { bxm(0.05, 0.05, N, s < 0 ? cyan : pink, s * (side - 0.03), 2.95, -N / 2); bxm(0.05, 0.05, N, s < 0 ? pink : cyan, s * (side - 0.03), 0.3, -N / 2); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: neonTex('BOWL', '#ff3fa4', 512, 128, 'bold 104px sans-serif'), transparent: true, depthWrite: false }));
  sign.position.set(0, 2.15, -N + 0.04); g.add(sign);
  lanes.forEach((x, i) => {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: neonTex(String(i + 1), '#19d3da', 128, 128, 'bold 96px sans-serif'), transparent: true, depthWrite: false }));
    n.position.set(x, 1.45, -N + 0.04); g.add(n);
  });

  // ---- the pins (ten to a lane) and the ball that rolls down it
  const fixtures = [];                                                // [{ name, x0, x1, z0, z1, h }] in the room's frame
  const laneObjs = lanes.map((x, i) => {
    const pins = PIN_SPOTS.map((sp, k) => {
      const mesh = makePin('plastic');
      mesh.position.set(x + sp.x, 0, sp.z);
      g.add(mesh);
      return { i: k, mesh, home: { x: x + sp.x, z: sp.z }, state: 'up', t: 0, wait: 0, vx: 0, vz: 0, dx: 0, dz: -1, tilt: 0, spin: 0, y: 0 };
    });
    const ball = makeBall(0xd32f2f); ball.visible = false; g.add(ball);
    const retBall = makeBall(0xd32f2f); retBall.visible = false; g.add(retBall);
    // the sweep bar of an automatic pinsetter: a bar across the pin deck, up out of the way until it works
    const bar = bxm(LANE.half * 2 + 0.05, 0.1, 0.08, chrome, x, 0.75, LANE.headZ + 0.55);
    bar.visible = false;
    const rx = x + BOWL.returnDX;
    // the ball return: a pedestal with a hood and a cradle for the ball
    const unit = new THREE.Group(); unit.position.set(rx, 0, BOWL.returnZ); g.add(unit);
    bxm(0.46, 0.44, 0.5, dark, 0, 0.22, 0, unit); bxm(0.5, 0.05, 0.54, chrome, 0, 0.46, 0, unit);
    for (const s of [-1, 1]) bxm(0.03, 0.04, 0.46, chrome, s * 0.06, 0.5, 0, unit);
    bxm(0.3, 0.2, 0.04, mat(0x7a1020), 0, 0.2, 0.26, unit);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3a1c6b, { metalness: 0.3, roughness: 0.3 })); hood.position.set(0, 0.46, -0.16); hood.scale.set(1, 0.9, 1); unit.add(hood);
    retBall.position.set(rx, 0.5 + LANE.ballR, BOWL.returnZ + 0.06);
    fixtures.push({ name: `ball return ${i + 1}`, x0: rx - 0.27, x1: rx + 0.27, z0: BOWL.returnZ - 0.27, z1: BOWL.returnZ + 0.27, h: 0.9 });
    return { i, x, pins, ball, retBall, bar, unit, game: { rolls: [] }, owner: null, pending: null, roll: null, returning: 0, returnReady: true, setter: null, impactAt: -9, ballLook: { color: 0xd32f2f, wood: false }, thrown: 0 };
  });

  // ---- the rack of house balls (against the +x wall): two tiers of four
  const rack = (() => {
    const grp = new THREE.Group(); grp.position.set(BOWL.rackX, 0, BOWL.rackZ); g.add(grp);
    const len = 1.5;
    bxm(0.5, 0.06, len, dark, 0, 0.1, 0, grp); bxm(0.5, 0.06, len, dark, 0, 0.72, 0, grp); bxm(0.04, 1.2, len, dark, 0.23, 0.6, 0, grp);
    for (const z of [-len / 2 + 0.03, len / 2 - 0.03]) { bxm(0.5, 1.2, 0.05, dark, 0, 0.6, z, grp); }
    const balls = [];
    for (let k = 0; k < 9; k++) {
      const tier = k < 4 ? 0 : k < 8 ? 1 : 2, slot = k < 8 ? k % 4 : 1.5, wood = k === 8;
      const b = makeBall(wood ? WOOD_BALL : BALL_COLORS[k], wood);
      b.position.set(-0.02, tier === 0 ? 0.13 + LANE.ballR : tier === 1 ? 0.75 + LANE.ballR : 1.25, (slot - 1.5) * 0.34);
      if (wood) b.position.set(-0.02, 0.75 + LANE.ballR, 1.5 * 0.34 + 0.0);
      b.rotation.y = -Math.PI / 2;
      grp.add(b);
      balls.push({ mesh: b, k, wood, out: false, color: wood ? WOOD_BALL : BALL_COLORS[k] });
    }
    balls[8].mesh.visible = false;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: neonTex('HOUSE BALLS', '#ffd23f', 384, 96, 'bold 52px sans-serif'), transparent: true, depthWrite: false }));
    label.position.set(-0.258, 1.42, 0); label.rotation.y = -Math.PI / 2; grp.add(label);
    fixtures.push({ name: 'ball rack', x0: BOWL.rackX - 0.25, x1: BOWL.rackX + 0.25, z0: BOWL.rackZ - len / 2, z1: BOWL.rackZ + len / 2, h: 1.3 });
    return {
      group: grp, balls,
      // take a ball: a wooden one when asked for and there is one (null if the rack has none out of use)
      take(wood = false) {
        const free = balls.filter((b) => !b.out && b.mesh.visible && !!b.wood === !!wood);
        const b = free.length ? free[Math.floor(Math.random() * free.length)] : balls.find((x) => !x.out && x.mesh.visible && !x.wood);
        if (!b) return null;
        b.out = true; b.mesh.visible = false;
        return { k: b.k, color: b.color, wood: b.wood };
      },
      giveBack(k) { const b = balls[k]; if (!b) return false; b.out = false; b.mesh.visible = b.wood ? state.woodBall : true; return true; },
      slot(k) { const b = balls[k] || balls[0]; return worldPt0(BOWL.rackX - 0.02, b.mesh.position.y, BOWL.rackZ + b.mesh.position.z); },
      standSpot() { const p = worldPt0(BOWL.rackX - 0.8, 0, BOWL.rackZ); return { x: p.x, z: p.z, yaw: worldYaw(1, 0) }; },
    };
  })();

  // ---- the scoreboard (against the -x wall): each lane's game, frame by frame
  const board = (() => {
    const cw = 1024, ch = 400, canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    let key = '';
    const mark = (r, k, fr) => (k === 0 && r === 10 ? '' : fr.mark === 'X' && k === 0 ? 'X' : fr.mark === '/' && k === 1 ? '/' : r === 0 ? '-' : String(r));
    const draw = () => {
      const k = laneObjs.map((l) => `${l.owner}:${l.game.rolls.join(',')}`).join('|');
      if (k === key) return;
      key = k;
      const cx = canvas.getContext('2d');
      cx.fillStyle = '#0d1020'; cx.fillRect(0, 0, cw, ch);
      cx.strokeStyle = '#19d3da'; cx.lineWidth = 6; cx.strokeRect(5, 5, cw - 10, ch - 10);
      const rowH = (ch - 20) / 3, x0 = 150, fw = 66;
      laneObjs.forEach((l, r) => {
        const y0 = 12 + r * rowH, sc = scoreGame(l.game.rolls);
        cx.fillStyle = '#ffd23f'; cx.font = 'bold 26px sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'middle';
        cx.fillText(`LANE ${r + 1}`, 18, y0 + 28); cx.fillStyle = '#19d3da'; cx.font = 'bold 22px sans-serif'; cx.fillText(l.owner || '-', 18, y0 + 68);
        for (let f = 0; f < 10; f++) {
          const fx = x0 + f * (fw + 4) + (f === 9 ? 0 : 0), w = f === 9 ? fw + 26 : fw, fr = sc.frames[f];
          cx.strokeStyle = '#3b4468'; cx.lineWidth = 2; cx.strokeRect(fx, y0 + 4, w, rowH - 14);
          cx.beginPath(); cx.moveTo(fx + w - 28, y0 + 4); cx.lineTo(fx + w - 28, y0 + 34); cx.lineTo(fx + w, y0 + 34); cx.stroke();
          cx.fillStyle = '#9aa4c8'; cx.font = '14px sans-serif'; cx.textAlign = 'left'; cx.fillText(String(f + 1), fx + 4, y0 + 15);
          cx.fillStyle = '#ffffff'; cx.font = 'bold 22px sans-serif'; cx.textAlign = 'center';
          if (f < 9) {
            if (fr.rolls[0] !== undefined) { if (fr.mark === 'X') cx.fillText('X', fx + w - 14, y0 + 22); else cx.fillText(fr.rolls[0] === 0 ? '-' : String(fr.rolls[0]), fx + w - 42, y0 + 22); }
            if (fr.rolls[1] !== undefined) cx.fillText(fr.mark === '/' ? '/' : fr.rolls[1] === 0 ? '-' : String(fr.rolls[1]), fx + w - 14, y0 + 22);
          } else {
            const t = fr.rolls;
            t.forEach((v, q) => { const prev = q > 0 ? t[q - 1] : 0; const s = v === 10 ? 'X' : q > 0 && prev !== 10 && prev + v === 10 ? '/' : v === 0 ? '-' : String(v); cx.fillText(s, fx + 18 + q * 26, y0 + 22); });
          }
          if (fr.cum !== null) { cx.font = 'bold 28px sans-serif'; cx.fillStyle = '#ff7ad1'; cx.fillText(String(fr.cum), fx + w / 2, y0 + rowH - 40); }
        }
        cx.fillStyle = '#ffffff'; cx.font = 'bold 34px sans-serif'; cx.textAlign = 'left';
        if (l.game.rolls.length) cx.fillText(String(sc.total), x0 + 10 * (fw + 4) + 40, y0 + 44);
      });
      tex.needsUpdate = true;
    };
    draw();
    const grp = new THREE.Group(); grp.position.set(-side, 0, BOWL.boardZ); g.add(grp);
    bxm(0.08, 1.2, 2.9, dark, 0.04, 1.95, 0, grp);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.09), new THREE.MeshBasicMaterial({ map: tex }));
    face.position.set(0.082, 1.95, 0); face.rotation.y = Math.PI / 2; grp.add(face);
    fixtures.push({ name: 'scoreboard', x0: -side, x1: -side + 0.1, z0: BOWL.boardZ - 1.45, z1: BOWL.boardZ + 1.45, h: 2.6 });
    return { group: grp, draw, standSpot() { const p = worldPt0(-side + 1.3, 0, BOWL.boardZ); return { x: p.x, z: p.z, yaw: worldYaw(-1, 0) }; } };
  })();

  const obstacles = fixtures.map((f) => ({ name: f.name, fixture: f, x0: 0, x1: 0, z0: 0, z1: 0, h: f.h }));
  const worldPt = (x, z) => g.localToWorld(V(x, 0, z));
  // the balls in the robots' hands (one each: GUY's and GAL's)
  const heldBalls = { guy: makeBall(), gal: makeBall() };
  for (const b of Object.values(heldBalls)) { b.visible = false; g.add(b); }
  const heldApi = (isGal) => {
    const m = heldBalls[isGal ? 'gal' : 'guy'];
    return {
      group: m,
      get visible() { return m.visible; },
      set(look) { m.userData.setLook(look.color, look.wood); },
      place(world, quat) { m.visible = true; m.position.copy(g.worldToLocal(world.clone())); if (quat) m.quaternion.copy(quat); },
      hide() { m.visible = false; },
    };
  };

  const bowl = {
    group: g, lanes: laneObjs, obstacles, rack, board, state, fixtures, N, L,
    // what the Workshop has built for the alley (set by room.js): { pins, ball, setter }
    supplies: () => ({}),
    // a sound for what happens in the lane (set by room.js)
    sound: () => {},
    attach() {
      g.updateWorldMatrix(true, false);
      for (const o of obstacles) {
        const f = o.fixture, c = [[f.x0, f.z0], [f.x0, f.z1], [f.x1, f.z0], [f.x1, f.z1]].map(([x, z]) => worldPt(x, z));
        Object.assign(o, { x0: Math.min(...c.map((q) => q.x)), x1: Math.max(...c.map((q) => q.x)), z0: Math.min(...c.map((q) => q.z)), z1: Math.max(...c.map((q) => q.z)) });
      }
    },
    held: heldApi,
    // ---- places (world) ----
    awayYaw() { return worldYaw(0, -1); },
    startSpot(i) { const p = worldPt(lanes[i], BOWL.startZ); return { x: p.x, z: p.z }; },
    // where he stands to deliver: his right hand is to the right of him (+x), so he stands a hand's width to the left of where the ball starts
    standSpot(i, off = 0) { const p = worldPt(lanes[i] - 0.22 + off, BOWL.standZ); return { x: p.x, z: p.z }; },
    returnStand(i) { const p = worldPt0(lanes[i] + BOWL.returnDX - 0.5, 0, BOWL.returnZ); return { x: p.x, z: p.z, yaw: worldYaw(1, 0) }; },
    returnPoint(i) { return worldPt0(lanes[i] + BOWL.returnDX, 0.5 + LANE.ballR, BOWL.returnZ + 0.04); },
    // where he stands in front of the pin deck to clear and set the pins by hand
    deckStand(i) { const p = worldPt(lanes[i], LANE.headZ + 0.95); return { x: p.x, z: p.z }; },
    deckPoint(i) { return worldPt0(lanes[i], 0.1, LANE.headZ - 0.1); },
    boardStand() { return board.standSpot(); },
    // a place to stand and watch the lanes from behind them
    watchSpot() { const p = worldPt(0, BOWL.startZ + 0.5); return { x: p.x, z: p.z, yaw: worldYaw(0, -1) }; },

    // ---- a game ----
    laneState(i) { return laneObjs[i]; },
    standing(i) { return laneObjs[i].pins.filter((p) => p.state === 'up').map((p) => p.i); },
    // every pin up and the card cleared (the lane's game starts again)
    startGame(i, owner) { const l = laneObjs[i]; l.game = { rolls: [] }; l.owner = owner || null; bowl.respot(i); l.pending = null; board.draw(); },
    // is anything still moving on lane `i`: the ball, a falling pin, the sweep
    busy(i) { const l = laneObjs[i]; return !!l.roll || !!l.setter || l.pins.some((p) => p.state === 'wait' || p.state === 'fall'); },
    // the pins stand again (all ten, instantly)
    respot(i) {
      const l = laneObjs[i];
      for (const p of l.pins) { p.state = 'up'; p.mesh.visible = true; p.mesh.position.set(p.home.x, 0, p.home.z); p.mesh.quaternion.identity(); }
    },
    // the pins that fell are taken away (instantly)
    clearFallen(i) { for (const p of laneObjs[i].pins) if (p.state !== 'up') { p.state = 'gone'; p.mesh.visible = false; } },
    // the ball is thrown: it leaves `from` (world) for the head pin; `aim` is where it is meant to arrive across the lane. Returns what will
    // happen: { tHit, down: [..], count, gutter, pins } (the pins fall when the ball arrives, `tHit` seconds from now)
    roll(i, { from, aim = 0, hook = 0, noise = 0.2, power = 1, look = null }) {
      const l = laneObjs[i], loc = g.worldToLocal(from.clone());
      const x0 = clamp(loc.x - lanes[i], -LANE.half, LANE.half), z0 = Math.min(loc.z, LANE.foulZ + 0.02), y0 = Math.max(LANE.ballR, loc.y);
      const standing = bowl.standing(i);
      const res = throwBall(standing, { x0, aim, hook, noise, power });
      const v = BOWL.speed[0] + (BOWL.speed[1] - BOWL.speed[0]) * clamp((power - 0.6) / 0.8, 0, 1);
      l.roll = { t: 0, v, x0, z0, y0, res, hit: false, dist: 0, tHit: (z0 - LANE.headZ) / v };
      l.thrown++;
      if (look) { l.ballLook = look; l.ball.userData.setLook(look.color, look.wood); l.retBall.userData.setLook(look.color, look.wood); }
      l.ball.visible = true; l.returnReady = false;
      l.ball.position.set(lanes[i] + x0, y0, z0);
      bowl.sound('rumble', clamp(v / 5.4, 0.3, 1));
      return { tHit: l.roll.tHit, down: res.down.map((d) => d.i), count: res.down.length, gutter: res.gutter, res };
    },
    // the ball is at the return (and will be waiting there)
    returnEta(i) { const l = laneObjs[i]; return l.returnReady ? 0 : l.roll ? l.roll.tHit + 2 + BOWL.returnSecs : Math.max(0, l.returning); },
    ballAtReturn(i) { return laneObjs[i].returnReady; },
    takeFromReturn(i) { const l = laneObjs[i]; if (!l.returnReady) return null; l.returnReady = false; l.retBall.visible = false; return l.ballLook; },
    putOnReturn(i, look) { const l = laneObjs[i]; l.ballLook = look; l.retBall.userData.setLook(look.color, look.wood); l.retBall.visible = true; l.returnReady = true; },
    // add the roll to the lane's card and say what the pins need next: 'sweep' | 'rack' | 'done'
    record(i, count) {
      const l = laneObjs[i];
      l.game.rolls.push(count);
      const a = afterRoll(l.game.rolls);
      l.pending = a.next === 'done' ? 'rack' : a.next;
      l.game.done = a.next === 'done';
      board.draw();
      return a;
    },
    needsReset(i) { return laneObjs[i].pending; },
    // the reset a robot has done by hand (the same as the pinsetter's): what was pending is done
    manualReset(i) { const l = laneObjs[i]; if (l.pending === 'rack') bowl.respot(i); else bowl.clearFallen(i); l.pending = null; },
    // the style of pin on the lanes ('plastic' or 'maple')
    setPinStyle(style) {
      state.maple = style === 'maple';
      for (const l of laneObjs) for (const p of l.pins) p.mesh.geometry = pinGeometry(style);
    },
    setWoodBall(on) { state.woodBall = !!on; if (!rack.balls[8].out) rack.balls[8].mesh.visible = !!on; },
    update(dt) {
      state.time += dt;
      const sup = bowl.supplies();
      if (!!sup.pins !== state.maple) bowl.setPinStyle(sup.pins ? 'maple' : 'plastic');
      if (!!sup.ball !== state.woodBall) bowl.setWoodBall(!!sup.ball);
      for (const l of laneObjs) stepLane(l, dt, !!sup.setter);
      board.draw();
    },
  };

  // one lane, a moment: the ball, the pins, the pinsetter and the ball coming back
  function stepLane(l, dt, setter) {
    const r = l.roll;
    if (r) {
      r.t += dt;
      const dz = r.v * r.t, z = r.z0 - dz, s = clamp(dz / (r.z0 - LANE.headZ), 0, 1), res = r.res;
      let x = pathX(r.x0, res.x1, res.hook, s);
      if (dz > r.z0 - LANE.headZ) x += (x - pathX(r.x0, res.x1, res.hook, 0.97)) * (dz - (r.z0 - LANE.headZ)) / Math.max(0.01, (r.z0 - LANE.headZ) * 0.03) * 0.05;     // (carries straight on past the head pin)
      let y = LANE.ballR + (r.y0 - LANE.ballR) * Math.pow(Math.max(0, 1 - r.t / 0.22), 2);
      if (res.gutter) {
        const gx = res.gutter * (LANE.half + 0.1);
        if (Math.abs(x) > LANE.half - 0.02) { x = res.gutter * Math.min(Math.abs(x), LANE.half + 0.1); const k = clamp((Math.abs(x) - LANE.half) / 0.1, 0, 1); y = LANE.ballR - 0.04 * k; }
        if (Math.abs(x) >= LANE.half + 0.09) x = gx;
      }
      l.ball.position.set(l.x + x, y, z);
      l.ball.rotation.x -= (r.v * dt) / LANE.ballR;
      if (!r.hit && r.t >= r.tHit) {
        r.hit = true; l.impactAt = state.time;
        if (!res.gutter) {
          res.down.forEach((d) => {
            const p = l.pins[d.i], n = Math.hypot(d.dx, d.dz) || 1;
            p.state = 'wait'; p.wait = d.delay; p.vx = (d.dx / n) * d.speed * rand(0.7, 1.1); p.vz = (d.dz / n) * d.speed * rand(0.7, 1.1);
            p.dx = d.dx / n; p.dz = d.dz / n; p.t = 0; p.spin = rand(-4, 4); p.tilt = 0; p.y = 0;
          });
          bowl.sound(res.down.length >= 10 ? 'strike' : res.down.length ? 'pinhit' : 'pinhit', clamp(res.down.length / 10, 0.2, 1));
        } else bowl.sound('gutter', 0.6);
      }
      if (z < LANE.pitZ - 0.15) {                                           // into the pit: it is on its way back
        l.roll = null; l.ball.visible = false; l.returning = BOWL.returnSecs; l.thrown = l.thrown;
      }
    } else if (l.returning > 0) {
      l.returning -= dt;
      if (l.returning <= 0) { l.returning = 0; l.retBall.userData.setLook(l.ballLook.color, l.ballLook.wood); l.retBall.visible = true; l.returnReady = true; bowl.sound('click'); }
    }
    // the pins
    for (const p of l.pins) {
      if (p.state === 'wait') { p.wait -= dt; if (p.wait <= 0) { p.state = 'fall'; p.t = 0; } continue; }
      if (p.state !== 'fall') continue;
      p.t += dt;
      const tip = clamp(p.t * 6.5, 0, 1) * 1.5;                                // topples over in about a quarter of a second
      const q = new THREE.Quaternion().setFromAxisAngle(V(p.dz, 0, -p.dx).normalize(), tip);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.spin * Math.max(0, p.t - 0.2) * 0.4));
      p.mesh.quaternion.copy(q);
      const k = Math.exp(-2.2 * dt);
      p.vx *= k; p.vz *= k;
      p.mesh.position.x += p.vx * dt; p.mesh.position.z += p.vz * dt;
      const x0 = l.x, lim = LANE.half + LANE.gutter + 0.06;
      if (Math.abs(p.mesh.position.x - x0) > lim) { p.mesh.position.x = x0 + Math.sign(p.mesh.position.x - x0) * lim; p.vx *= -0.4; }          // (the kickback plate)
      let y = LANE.pinR * (tip / 1.5);
      if (p.mesh.position.z < LANE.pitZ + 0.02) { p.vz *= 0.2; p.y = (p.y || 0) - dt * 2.2; y += p.y; if (p.y < -0.5) { p.state = 'pit'; p.mesh.visible = false; } }
      p.mesh.position.y = y;
      if (p.state === 'fall' && p.t > 2.2 && Math.hypot(p.vx, p.vz) < 0.02) p.state = 'down';
    }
    // an automatic pinsetter: when everything has stopped it sweeps the fallen pins away and, when it is a new frame, sets all ten again
    if (setter && l.pending && !l.setter && !l.roll && !l.pins.some((p) => p.state === 'wait' || p.state === 'fall') && state.time - l.impactAt > 1.0) {
      l.setter = { kind: l.pending, t: 0 };
    }
    if (l.setter) {
      const st = l.setter, rack = st.kind === 'rack', T = rack ? [0.4, 1.35, 1.9] : [0, 0.95, 1.5];
      st.t += dt;
      l.bar.visible = true;
      let bz = LANE.headZ + 0.55, by = 0.75;
      if (st.t < T[0]) { by = 0.75; for (const p of l.pins) if (p.state === 'up') p.mesh.position.y = 0.5 * (st.t / T[0]); }                  // the standing pins are lifted out of the way
      else if (st.t < T[1]) {
        const k = (st.t - T[0]) / (T[1] - T[0]);
        by = 0.07 + 0.68 * Math.abs(k < 0.15 ? 1 - k / 0.15 : 0) * 0; bz = LANE.headZ + 0.55 + (LANE.pitZ - 0.05 - LANE.headZ - 0.55) * k;
        by = 0.05;
        for (const p of l.pins) if (p.state !== 'up' && p.state !== 'gone' && p.state !== 'pit' && p.mesh.position.z > bz - 0.05 && p.mesh.visible) { p.mesh.position.z -= 0; }
        for (const p of l.pins) if (p.state !== 'up' && p.state !== 'gone' && p.state !== 'pit' && p.mesh.position.z > bz) { p.mesh.position.z = Math.min(p.mesh.position.z, bz - 0.04 + (p.mesh.position.z - bz)); }
        for (const p of l.pins) if (p.state !== 'up' && p.state !== 'gone' && p.state !== 'pit' && bz < p.mesh.position.z + 0.12) { p.mesh.position.z = Math.min(p.mesh.position.z, bz - 0.1); if (bz < LANE.pitZ + 0.15) { p.state = 'gone'; p.mesh.visible = false; } }
      } else if (st.t < T[2]) {
        const k = (st.t - T[1]) / (T[2] - T[1]);
        bz = LANE.pitZ - 0.05 + (LANE.headZ + 0.55 - LANE.pitZ + 0.05) * k; by = 0.05 + 0.7 * k;
        if (rack) {                                                          // all ten come down from the pin table
          for (const p of l.pins) { if (p.state !== 'up') { p.state = 'up'; p.mesh.visible = true; p.mesh.position.set(p.home.x, 0.5, p.home.z); p.mesh.quaternion.identity(); } p.mesh.position.y = 0.5 * (1 - k); }
        }
      } else {
        for (const p of l.pins) if (p.state === 'up') p.mesh.position.y = 0;
        if (rack) bowl.respot(laneObjs.indexOf(l));
        l.pending = null; l.setter = null; l.bar.visible = false;
      }
      if (l.setter) l.bar.position.set(l.x, by, bz);
    }
  }
  return bowl;
}

// ---------------------------------------------------------------------------------------------------------------- built for the alley
// The objects GUY builds in the Workshop that stand in the alley: a display of wooden pins, a wooden ball on a stand, and the Automatic
// Pinsetter (the easter egg). Made with the same makeObject helper as the rest of the rooms (room.js passes it in).
export function makeBowlBuilders({ makeObject, box, mat }) {
  const metal = (c = 0x4a525c) => mat(c, { metalness: 0.6, roughness: 0.35 });
  const buildPins = (name, x = 0, z = 0) => makeObject(name, x, z, 0.8, 0.8, 0.5, 'light', (g) => {
    box(0.7, 0.06, 0.7, mat(0x6b4a2b), 0, 0.03, 0, g);
    box(0.62, 0.08, 0.62, mat(0xb5651d), 0, 0.1, 0, g);
    PIN_SPOTS.forEach((sp) => { const p = makePin('maple', 0.7); p.position.set(sp.x * 0.7 * 0.9, 0.14, (sp.z - LANE.headZ - 0.4) * 0.7 * 0.9 * -1 - 0.2); p.rotation.y = Math.PI; g.add(p); });
  });
  const buildBall = (name, x = 0, z = 0) => makeObject(name, x, z, 0.5, 0.5, 0.75, 'light', (g) => {
    box(0.4, 0.08, 0.4, mat(0x6b4a2b), 0, 0.04, 0, g);
    box(0.08, 0.34, 0.08, mat(0x8a5a2e), 0, 0.25, 0, g);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.06, 0.07, 16), mat(0x8a5a2e)); cup.position.set(0, 0.45, 0); g.add(cup);
    const ball = makeBall(WOOD_BALL, true); ball.position.set(0, 0.45 + 0.07 + LANE.ballR * 0.7, 0); ball.scale.setScalar(1.0); g.add(ball);
    g.userData.tick = () => { ball.rotation.y += 0.004; };
  });
  // (its `h` is 0.9, much lower than the model: a taller object is refused when it is behind a window or a picture of GUY's room, and the machines stand over the pit where nobody walks)
  // three machines, one over the end of each lane (the lanes are 2 m apart), with a yellow stripe, chrome rods and a gear that turns
  const buildSetter = (name, x = 0, z = 0) => makeObject(name, x, z, 6.4, 0.6, 0.9, 'heavy', (g) => {
    const body = metal(0x363c46), trim = mat(0xf2c200), rod = metal(0xc9d0d8);
    const gears = [];
    for (const lx of BOWL.lanes) {
      box(1.25, 0.95, 0.62, body, lx, 2.0, 0, g);
      box(1.27, 0.08, 0.64, trim, lx, 1.55, 0, g);
      box(1.1, 0.3, 0.5, metal(0x2b3038), lx, 2.62, 0, g);
      for (const sx of [-0.5, 0.5]) box(0.05, 1.3, 0.05, rod, lx + sx, 0.9, 0.25, g);
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12), rod); gear.rotation.x = Math.PI / 2; gear.position.set(lx, 2.0, 0.34); g.add(gear);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), trim); hub.rotation.x = Math.PI / 2; hub.position.set(lx, 2.0, 0.35); g.add(hub);
      gears.push(gear);
    }
    box(6.2, 0.1, 0.1, trim, 0, 0.4, 0.25, g);
    g.userData.tick = (dt) => { gears.forEach((q, i) => { q.rotation.y += dt * (i % 2 ? 1.6 : -1.6); }); };
  });
  return { bowlingpins: buildPins, bowlingball: buildBall, pinsetter: buildSetter };
}
