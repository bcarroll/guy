// The Studio: a stage, a dance floor, a DJ booth, a wall of records and a machine for managing what stands in the room.
//
// Laid out in the room's own frame (like the Range and the Bowling Alley): x along the door wall from the middle of the room, z away from the
// door as -z. The door is at z = 0 and the far wall at z = -N. The stage is against the far wall, the dance floor in the middle, the DJ booth
// against the +x wall and the record wall against the -x wall. Everything here is a fixture (it is part of the room and cannot be moved); the
// Studio Machine is how the user adds or removes the movable things (instruments, chairs ...) in this room.
//
// The stage is a low riser the robots walk across at floor level. What they do here is in studiobrain.js.
//
// The record wall holds every album (a 12 inch sleeve each) and a single for every song on them (a 7 inch sleeve each): far more than the top
// shelf of the bookshelf. A record taken from the wall goes on the deck, and the song plays through the same music the stereo uses.
import * as THREE from 'three';
import { ALBUM_CATALOG } from './albums.js';
import { TRACKS } from './audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const hex = (c) => '#' + new THREE.Color(c).getHexString();

export const STUDIO = {
  stage: { x0: -3.0, x1: 3.0, zFront: -7.3, h: 0.06 },     // the riser: from the far wall to zFront
  floor: { x0: -2.0, x1: 2.0, z0: -6.6, z1: -2.6, n: 8 },  // the dance floor: n x n lit tiles
  booth: { x: 3.68, z: -4.6, len: 2.0 },                    // the DJ booth, against the +x wall
  wallX: -3.86,                                             // the record wall's face
  rows: [{ y: 1.72, kind: 'album', size: 0.34, pitch: 0.44 }, { y: 1.3, kind: 'single', size: 0.26, pitch: 0.33 }, { y: 0.9, kind: 'single', size: 0.26, pitch: 0.33 }, { y: 0.5, kind: 'single', size: 0.26, pitch: 0.33 }],
  mics: [-0.9, 0.9],                                        // where the two mic stands are (x), and the robots stand behind them
};

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
const neonTex = (text, color, w, h, font) => canvasTex(w, h, (cx) => {
  cx.clearRect(0, 0, w, h);
  cx.font = font; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.shadowColor = color; cx.shadowBlur = 20; cx.fillStyle = color;
  cx.fillText(text, w / 2, h / 2 + 3); cx.fillText(text, w / 2, h / 2 + 3);
  cx.shadowBlur = 0; cx.fillStyle = '#ffffff'; cx.globalAlpha = 0.85; cx.fillText(text, w / 2, h / 2 + 3);
});
// an album sleeve (the same look as the ones on the bookshelf) and a single's sleeve (the song's title on the album's colour)
const sleeveTex = (rec) => canvasTex(256, 256, (cx, w, h) => {
  const d = rec.def, col = hex(d.color), acc = hex(d.accent);
  const fit = (text, max, size0, bold = true) => { let s = size0; cx.font = `${bold ? 'bold ' : ''}${s}px sans-serif`; while (cx.measureText(text).width > max && s > 10) { s -= 1; cx.font = `${bold ? 'bold ' : ''}${s}px sans-serif`; } };
  const grad = cx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, col); grad.addColorStop(1, '#101018');
  cx.fillStyle = grad; cx.fillRect(0, 0, w, h);
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  if (rec.kind === 'album') {
    cx.fillStyle = '#0a0a0e'; cx.beginPath(); cx.arc(128, 104, 66, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = 'rgba(255,255,255,0.15)'; cx.lineWidth = 2;
    for (const r of [56, 46, 36]) { cx.beginPath(); cx.arc(128, 104, r, 0, Math.PI * 2); cx.stroke(); }
    cx.fillStyle = acc; cx.beginPath(); cx.arc(128, 104, 20, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#fff'; fit(d.title, 232, 26); cx.fillText(d.title, 128, 202);
    cx.fillStyle = acc; cx.font = '15px sans-serif'; cx.fillText(d.genre, 128, 232);
  } else {                                                          // a single: the song big, the album small, a stripe in the accent colour
    cx.fillStyle = acc; cx.fillRect(0, 0, w, 26); cx.fillRect(0, h - 26, w, 26);
    cx.fillStyle = '#fff'; fit(rec.title, 220, 44);
    const words = rec.title.split(' ');
    if (cx.measureText(rec.title).width > 220 || words.length < 2) { cx.font = 'bold 34px sans-serif'; }
    cx.fillText(rec.title, 128, 112);
    cx.fillStyle = acc; cx.font = '18px sans-serif'; cx.fillText(d.title, 128, 168);
    cx.fillStyle = 'rgba(255,255,255,0.7)'; cx.font = '16px sans-serif'; cx.fillText('7" single', 128, 200);
  }
});

// ---------------------------------------------------------------------------------------------------------------- the room
// Fills the room's group `g` (`L` wide along the door wall, `N` deep). Returns the studio. The caller adds `g` to the scene and then calls
// `studio.attach()`, which works out where the fixtures are in the world (the robots' pathing: `obstacles`).
export function buildStudioShell(g, L, N) {
  const side = L / 2;
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
  const bxm = (w, h, d, m, x, y, z, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
  const worldPt0 = (x, y, z) => g.localToWorld(V(x, y, z));
  const worldYaw = (dx, dz) => { const a = worldPt0(0, 0, 0), b = worldPt0(dx, 0, dz); return Math.atan2(b.x - a.x, b.z - a.z); };
  const worldPt = (x, z) => g.localToWorld(V(x, 0, z));
  const dark = mat(0x1d2027, { metalness: 0.3 }), chrome = mat(0xc9d0d8, { metalness: 0.8, roughness: 0.25 }), black = mat(0x0c0d10, { roughness: 0.5 });
  const fixtures = [];                                              // [{ name, x0, x1, z0, z1, h }] in the room's frame
  const wallG = new THREE.Group(), boothG = new THREE.Group();    // (what a press can pick: the record wall and the DJ booth)
  g.add(wallG, boothG);
  const st = { time: 0, level: 0, holds: { show: new Set(), party: new Set() }, deckBy: null, playing: false };

  // ---- the floor: dark carpet, the dance floor's frame
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(L, N), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (cx, w, h) => {
    cx.fillStyle = '#1a1626'; cx.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { cx.fillStyle = k % 2 ? 'rgba(122,92,255,0.18)' : 'rgba(25,211,218,0.14)'; cx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  }, [L / 1.5, N / 1.5]), roughness: 0.95 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.003, -N / 2); carpet.receiveShadow = true; g.add(carpet);

  // ---- the dance floor: n x n tiles (one InstancedMesh; each tile's colour is set every frame)
  const F = STUDIO.floor, tw = (F.x1 - F.x0) / F.n, td = (F.z1 - F.z0) / F.n, fcx = (F.x0 + F.x1) / 2, fcz = (F.z0 + F.z1) / 2;
  bxm(F.x1 - F.x0 + 0.12, 0.014, F.z1 - F.z0 + 0.12, black, fcx, 0.007, fcz).castShadow = false;
  const tileGeo = new THREE.PlaneGeometry(tw - 0.035, td - 0.035); tileGeo.rotateX(-Math.PI / 2);
  const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), F.n * F.n);
  const tileXZ = [];
  for (let i = 0; i < F.n; i++) for (let j = 0; j < F.n; j++) {
    const x = F.x0 + tw * (i + 0.5), z = F.z0 + td * (j + 0.5), k = i * F.n + j;
    tileXZ.push({ x, z, i, j });
    tiles.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, 0.0155, z));
    tiles.setColorAt(k, new THREE.Color(0x222244));
  }
  g.add(tiles);

  // ---- the stage: a riser along the far wall, a curtain, a screen with an equaliser, a truss with lights, two mics, monitors and the PA
  const S = STUDIO.stage, sd = N - (-S.zFront), sz = -N + sd / 2 + 0.0, sw = S.x1 - S.x0;
  const stageTop = bxm(sw, S.h, sd, mat(0x2a2230, { roughness: 0.55 }), 0, S.h / 2, sz);
  bxm(sw, 0.03, 0.05, glow(0xff3fa4), 0, S.h - 0.005, S.zFront + 0.03);             // a lit lip along the front
  for (let k = 0; k < 16; k++) bxm(sw / 16 - 0.02, 2.65, 0.1, mat(k % 2 ? 0x7d1220 : 0x9a1a2b, { roughness: 0.9 }), -sw / 2 + sw / 32 + k * (sw / 16), 1.33, -N + 0.08);    // the curtain
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x05060a });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.1), screenMat); screen.position.set(0, 1.55, -N + 0.145); g.add(screen);
  const bars = Array.from({ length: 16 }, (_, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: 0x19d3da }));
    m.position.set(-1.2 + k * 0.16, 1.05, -N + 0.15); g.add(m); return m;
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5), new THREE.MeshBasicMaterial({ map: neonTex('STUDIO', '#ff3fa4', 512, 96, 'bold 78px sans-serif'), transparent: true, depthWrite: false }));
  sign.position.set(0, 2.95, -N + 0.15); g.add(sign);
  // the truss over the front of the stage, with six lights that throw coloured beams
  bxm(sw + 0.4, 0.06, 0.06, chrome, 0, 2.85, -N + 1.6);
  for (const s of [-1, 1]) bxm(0.06, 2.85, 0.06, chrome, s * (sw / 2 + 0.2), 1.43, -N + 1.6);
  const beams = Array.from({ length: 6 }, (_, k) => {
    const x = -2.2 + k * 0.88, pivot = new THREE.Group();
    pivot.position.set(x, 2.8, -N + 1.6); g.add(pivot);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.22, 12), black); can.position.y = -0.05; pivot.add(can);
    const bm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.55, 2.7, 16, 1, true), bm); cone.position.y = -1.4; pivot.add(cone);
    return { pivot, mat: bm, phase: k * 1.1 };
  });
  // two mic stands (one each) with a stage monitor in front of each; the robots stand just behind their mic
  const micHead = [];
  for (const x of STUDIO.mics) {
    bxm(0.3, 0.02, 0.3, dark, x, S.h + 0.01, -7.8); bxm(0.025, 1.3, 0.025, chrome, x, S.h + 0.66, -7.8);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), mat(0x333840, { metalness: 0.6 })); head.position.set(x, S.h + 1.36, -7.8); g.add(head);
    micHead.push(x);
    const wedge = bxm(0.6, 0.25, 0.4, black, x, S.h + 0.12, -7.5); wedge.rotation.x = -0.35;
  }
  // PA stacks at the corners of the stage, a pair of subs beside the booth
  const stack = (x, z, name) => {
    bxm(0.6, 0.7, 0.6, black, x, 0.35, z); bxm(0.55, 0.55, 0.5, dark, x, 0.97, z); bxm(0.5, 0.45, 0.45, black, x, 1.5, z);
    for (const y of [0.35, 0.97, 1.5]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.17, 18), mat(0x23262d, { metalness: 0.4 })); c.position.set(x, y, z + (y > 0.5 ? 0.255 : 0.305)); g.add(c); }
    fixtures.push({ name, x0: x - 0.32, x1: x + 0.32, z0: z - 0.32, z1: z + 0.32, h: 1.8 });
  };
  stack(-3.5, -N + 0.6, 'PA stack left'); stack(3.5, -N + 0.6, 'PA stack right');

  // ---- the walls: neon along the top and bottom, acoustic panels on the booth side
  const neon = [0, 1, 2, 3].map(() => glow(0x19d3da));
  bxm(L, 0.05, 0.05, neon[0], 0, 3.1, -N + 0.03);
  for (const s of [-1, 1]) { bxm(0.05, 0.05, N, neon[s < 0 ? 1 : 2], s * (side - 0.03), 3.1, -N / 2); bxm(0.05, 0.05, N, neon[3], s * (side - 0.03), 0.12, -N / 2); }
  for (let k = 0; k < 6; k++) { const z = -1.2 - k * 1.45; if (Math.abs(z - STUDIO.booth.z) < 1.6) continue; bxm(0.06, 1.1, 1.1, mat(k % 2 ? 0x2a3a46 : 0x3b2a4a, { roughness: 0.95 }), side - 0.05, 1.7, z); }

  // ---- the mirror ball over the dance floor
  const ball = new THREE.Group(); ball.position.set(fcx, 2.55, fcz); g.add(ball);
  const ballMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshStandardMaterial({ color: 0xe8eef6, emissive: 0x7a86a0, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.12, flatShading: true }));
  ball.add(ballMesh);
  bxm(0.012, 0.7, 0.012, chrome, fcx, 2.9, fcz);

  // ---- the DJ booth: two turntables, a mixer and a laptop on a long desk against the +x wall
  const B = STUDIO.booth, deckX = B.x - 0.05, deckZs = [B.z + 0.45, B.z - 0.45];
  bxm(0.55, 0.95, B.len, dark, B.x, 0.475, B.z, boothG);
  bxm(0.6, 0.06, B.len + 0.08, mat(0x2b2e36, { metalness: 0.3 }), B.x, 0.98, B.z, boothG);
  const ledStrip = bxm(0.02, 0.05, B.len - 0.2, glow(0xff3fa4), B.x - 0.28, 0.6, B.z, boothG);
  const platters = deckZs.map((z) => {
    const base = bxm(0.4, 0.05, 0.4, black, deckX, 1.04, z, boothG);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 28), mat(0x30343c, { metalness: 0.6, roughness: 0.3 })); p.position.set(deckX, 1.08, z); boothG.add(p);
    bxm(0.015, 0.015, 0.2, chrome, deckX + 0.15, 1.12, z - 0.02, boothG).rotation.y = 0.5;     // the tonearm
    return { base, p };
  });
  const mixer = bxm(0.34, 0.06, 0.32, mat(0x14161b, { metalness: 0.3 }), deckX, 1.04, B.z, boothG);
  const leds = Array.from({ length: 8 }, (_, k) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.025), new THREE.MeshBasicMaterial({ color: 0x22ff66 })); m.position.set(deckX - 0.1, 1.08, B.z - 0.12 + k * 0.034); boothG.add(m); return m; });
  const laptop = bxm(0.3, 0.02, 0.24, mat(0x9aa0a8, { metalness: 0.7 }), deckX + 0.02, 1.02 + 0.0, B.z + 0.8, boothG);
  const lid = bxm(0.3, 0.2, 0.012, black, deckX + 0.15, 1.12, B.z + 0.8, boothG); lid.rotation.z = 0.0;
  stack(B.x - 0.1, B.z - 1.5, 'sub left'); stack(B.x - 0.1, B.z + 1.5, 'sub right');
  fixtures.push({ name: 'DJ booth', x0: B.x - 0.3, x1: B.x + 0.3, z0: B.z - B.len / 2, z1: B.z + B.len / 2, h: 1.05 });
  // the record on the left turntable (shown while one is on)
  const disc = new THREE.Group(); disc.position.set(deckX, 1.1, deckZs[0]); disc.visible = false;
  const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.006, 32), mat(0x08080a, { roughness: 0.25, metalness: 0.4 })); disc.add(vinyl);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 20), new THREE.MeshBasicMaterial({ color: 0xff3fa4 })); label.position.y = 0.002; disc.add(label);
  boothG.add(disc);

  // ---- the records: an album sleeve each, and a single for every song. They stand on shelves on the -x wall.
  const records = [];
  for (const def of ALBUM_CATALOG) records.push({ id: `album:${def.id}`, kind: 'album', def, track: null, title: def.title });
  for (const def of ALBUM_CATALOG) for (const t of def.tracks || [def.track]) if (TRACKS[t] && TRACKS[t].step) records.push({ id: `single:${t}`, kind: 'single', def, track: t, title: TRACKS[t].label });
  const WX = STUDIO.wallX, rowsOf = (kind) => STUDIO.rows.map((r, i) => ({ ...r, i })).filter((r) => r.kind === kind);
  const albumRows = rowsOf('album'), singleRows = rowsOf('single');
  const wallLen = 5.6, wallZ0 = -2.35, wallZ1 = wallZ0 - wallLen, wallMid = (wallZ0 + wallZ1) / 2;
  bxm(0.1, 2.0, wallLen + 0.2, mat(0x2b1f2e, { roughness: 0.8 }), -side + 0.05, 1.1, wallMid, wallG);
  for (const r of STUDIO.rows) { bxm(0.22, 0.03, wallLen, mat(0x5b3a24), -side + 0.12, r.y - r.size / 2 - 0.01, wallMid, wallG); bxm(0.02, 0.025, wallLen, glow(0xff3fa4), -side + 0.23, r.y - r.size / 2 - 0.02, wallMid, wallG); }
  const wsign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42), new THREE.MeshBasicMaterial({ map: neonTex('RECORD WALL', '#19d3da', 512, 72, 'bold 56px sans-serif'), transparent: true, depthWrite: false }));
  wsign.rotation.y = Math.PI / 2; wsign.position.set(-side + 0.14, 2.3, wallMid); wallG.add(wsign);
  const counts = { album: 0, single: 0 };
  for (const rec of records) {
    const rows = rec.kind === 'album' ? albumRows : singleRows, per = rec.kind === 'album' ? 12 : 16, n = counts[rec.kind]++;
    const row = rows[Math.floor(n / per)], col = n % per, size = row.size;
    const zc = wallMid + (per * row.pitch) / 2 - row.pitch * (col + 0.5);                           // the first one at the door end
    rec.row = row.i; rec.col = col; rec.size = size; rec.z = zc; rec.y = row.y;
    const mesh = new THREE.Group(); mesh.position.set(WX + 0.0, row.y, zc);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: sleeveTex(rec), roughness: 0.6 }));
    face.rotation.y = Math.PI / 2; face.position.x = 0.02; mesh.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.02, size, size), mat(0x16161c)); mesh.add(back);
    wallG.add(mesh); rec.mesh = mesh; rec.out = false;
  }
  fixtures.push({ name: 'record wall', x0: -side, x1: -side + 0.25, z0: wallZ1, z1: wallZ0, h: 2.3 });
  const recById = (id) => records.find((r) => r.id === id) || null;

  // ---- the Studio Machine: a kiosk by the door. Tapping it opens the Catalog for this room (main.js).
  const machine = new THREE.Group(); machine.position.set(-side + 0.3, 0, -1.2); g.add(machine);
  bxm(0.4, 1.7, 0.62, mat(0x232a36, { roughness: 0.45, metalness: 0.5 }), 0, 0.85, 0, machine);
  bxm(0.05, 0.1, 0.5, mat(0xff3fa4, { emissive: 0xff3fa4, emissiveIntensity: 0.8 }), 0.2, 1.62, 0, machine);
  const mscreenMat = new THREE.MeshStandardMaterial({ map: canvasTex(256, 192, (cx, w, h) => {
    const gr = cx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a0e4a'); gr.addColorStop(1, '#1a0b2e');
    cx.fillStyle = gr; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#ff3fa4'; cx.lineWidth = 4; cx.strokeRect(6, 6, w - 12, h - 12);
    cx.textAlign = 'center'; cx.fillStyle = '#ffd0ec'; cx.font = 'bold 28px sans-serif'; cx.fillText('STUDIO', w / 2, 66); cx.fillText('MACHINE', w / 2, 100);
    cx.font = '17px sans-serif'; cx.fillStyle = '#d58fc0'; cx.fillText('tap to manage the room', w / 2, 150);
  }), emissive: 0xffffff, roughness: 0.4 });
  mscreenMat.emissiveMap = mscreenMat.map; mscreenMat.emissiveIntensity = 0.9;
  const mscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.375), mscreenMat); mscreen.rotation.y = Math.PI / 2; mscreen.position.set(0.201, 1.2, 0); machine.add(mscreen);
  const mgear = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffb133, emissive: 0xff8800, emissiveIntensity: 0.6 }));
  mgear.rotation.y = Math.PI / 2; mgear.position.set(0.21, 0.7, 0); machine.add(mgear);
  bxm(0.03, 0.05, 0.3, mat(0x05080c), 0.2, 0.45, 0, machine);
  fixtures.push({ name: 'studio machine', x0: -side, x1: -side + 0.52, z0: -1.55, z1: -0.85, h: 1.7 });

  // ---- the record in a robot's hand (one each: GUY's and GAL's)
  const heldMeshes = { guy: new THREE.Group(), gal: new THREE.Group() };
  for (const m of Object.values(heldMeshes)) {
    m.visible = false; g.add(m);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide })); m.add(face); m.userData.face = face;
  }
  const heldApi = (isGal) => {
    const m = heldMeshes[isGal ? 'gal' : 'guy'];
    return {
      group: m,
      get visible() { return m.visible; },
      set(rec) { if (m.userData.id === rec.id) return; m.userData.id = rec.id; m.userData.face.material.map = rec.mesh.children[0].material.map; m.userData.face.material.needsUpdate = true; m.userData.face.scale.setScalar(rec.size); },
      place(worldPos, quat) { m.visible = true; m.position.copy(g.worldToLocal(worldPos.clone())); if (quat) m.quaternion.copy(quat); },
      hide() { m.visible = false; },
    };
  };

  const obstacles = fixtures.map((f) => ({ name: f.name, fixture: f, x0: 0, x1: 0, z0: 0, z1: 0, h: f.h }));
  const tmpC = new THREE.Color();
  const modeOf = () => (st.holds.party.size ? 'party' : st.holds.show.size ? 'show' : 'idle');

  const studio = {
    group: g, obstacles, fixtures, N, L, state: st, records, machine: { group: machine }, wall: { group: wallG, records }, deck: { group: boothG },
    attach() {
      g.updateWorldMatrix(true, false);
      for (const o of obstacles) {
        const f = o.fixture, c = [[f.x0, f.z0], [f.x0, f.z1], [f.x1, f.z0], [f.x1, f.z1]].map(([x, z]) => worldPt(x, z));
        Object.assign(o, { x0: Math.min(...c.map((q) => q.x)), x1: Math.max(...c.map((q) => q.x)), z0: Math.min(...c.map((q) => q.z)), z1: Math.max(...c.map((q) => q.z)) });
      }
    },
    held: heldApi,
    // what a robot can see of the wall: the records (with their song), whether each is on the wall, and the one on the deck
    recordById: recById,
    onWall: () => records.filter((r) => !r.out),
    // ---- the lights: a robot asks for a show or a party and gives the request up again when it is over (a mode lasts while anyone wants it)
    hold(kind, who, on) { const s = st.holds[kind]; if (on) s.add(who); else s.delete(who); },
    clearHolds(who) { st.holds.show.delete(who); st.holds.party.delete(who); },
    mode: modeOf,
    // ---- places (world)
    stageSpot(i) { const p = worldPt(STUDIO.mics[i % 2] + 0.5, -8.1); return { x: p.x, z: p.z, yaw: worldYaw(0, 1) }; },
    micPoint(i) { return worldPt0(STUDIO.mics[i % 2], S.h + 1.36, -7.84); },
    stageFront(i) { const p = worldPt(STUDIO.mics[i % 2] * 0.6, -7.6); return { x: p.x, z: p.z, yaw: worldYaw(0, 1) }; },
    floorSpot(k) { const t = tileXZ[((k % tileXZ.length) + tileXZ.length) % tileXZ.length], p = worldPt(t.x, t.z); return { x: p.x, z: p.z }; },
    floorCentre() { const p = worldPt(fcx, fcz); return { x: p.x, z: p.z }; },
    crowdSpot(i) { const p = worldPt(i % 2 ? 1.0 : -1.0, -2.2); return { x: p.x, z: p.z, yaw: worldYaw(0, -1) }; },
    deckStand() { const p = worldPt(deckX - 0.75, deckZs[0] + 0.1); return { x: p.x, z: p.z, yaw: worldYaw(1, 0) }; },
    deckPoint() { return worldPt0(deckX, 1.14, deckZs[0]); },
    mixerPoint() { return worldPt0(deckX, 1.1, B.z); },
    deckRecord: () => (disc.visible ? disc.userData.rec || null : null),
    setDeckRecord(rec) {
      if (!rec) { disc.visible = false; disc.userData.rec = null; return; }
      disc.userData.rec = rec; disc.visible = true; label.material.color.setHex(rec.def.accent);
    },
    wallStand(rec) { const p = worldPt(WX + 0.95, rec.z); return { x: p.x, z: p.z, yaw: worldYaw(-1, 0) }; },
    slot(rec) { return worldPt0(WX + 0.06, rec.y, rec.z); },
    take(rec) { rec.out = true; rec.mesh.visible = false; },
    giveBack(rec) { rec.out = false; rec.mesh.visible = true; },
    machinePoint() { return worldPt0(-side + 0.52, 1.2, -1.2); },
    machineStand() { const p = worldPt(-side + 1.1, -1.2); return { x: p.x, z: p.z, yaw: worldYaw(-1, 0) }; },
    // ---- per frame. `playing`: the music is on (the platters turn, the bars dance).
    update(dt, playing = false) {
      st.time += dt; st.playing = playing;
      const t = st.time, mode = modeOf(), want = mode === 'party' ? 1 : mode === 'show' ? 0.8 : playing ? 0.35 : 0.12;
      st.level += (want - st.level) * Math.min(1, dt * 2.5);
      const pulse = playing || mode !== 'idle' ? Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI * 4), 2) : 0.3 + 0.2 * Math.sin(t);       // a beat at 120 bpm
      // the tiles
      for (const c of tileXZ) {
        const k = c.i * F.n + c.j;
        if (mode === 'party') tmpC.setHSL((c.i * 0.07 + c.j * 0.05 + t * 0.35) % 1, 1, 0.22 + 0.33 * pulse * (0.5 + 0.5 * Math.sin(t * 3 + c.i + c.j)));
        else if (mode === 'show') tmpC.setHSL(0.86 + 0.06 * Math.sin(t + c.j * 0.4), 0.9, 0.12 + 0.18 * pulse * (c.j / F.n + 0.2));
        else tmpC.setHSL(((c.i + c.j) % 2 ? 0.62 : 0.74), 0.6, 0.1 + 0.04 * Math.sin(t * 0.8 + c.i) + (playing ? 0.1 * pulse : 0));
        tiles.setColorAt(k, tmpC);
      }
      tiles.instanceColor.needsUpdate = true;
      // the beams: they sweep and change colour while a show or a party is on, and glow faintly otherwise
      for (const b of beams) {
        b.pivot.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.5 * st.level;
        b.pivot.rotation.x = Math.cos(t * 0.7 + b.phase * 1.3) * 0.35 * st.level + 0.1;
        b.mat.color.setHSL((mode === 'party' ? t * 0.3 + b.phase * 0.2 : mode === 'show' ? 0.9 : 0.6) % 1, 1, 0.55);
        b.mat.opacity = 0.03 + 0.13 * st.level * (mode === 'idle' ? 0.5 : 0.6 + 0.4 * pulse);
      }
      ball.rotation.y += dt * (0.4 + 1.6 * st.level);
      ballMesh.material.emissiveIntensity = 0.4 + 0.8 * st.level * (0.5 + 0.5 * pulse);
      // the equaliser on the screen
      bars.forEach((b, k) => {
        const h = playing || mode !== 'idle' ? 0.08 + 0.9 * Math.abs(Math.sin(t * (2.1 + k * 0.37) + k)) * (0.4 + 0.6 * pulse) : 0.04;
        b.scale.y = h; b.position.y = 1.0 + h / 2 - 0.45;
        b.material.color.setHSL((0.5 + k * 0.025 + (mode === 'party' ? t * 0.1 : 0)) % 1, 1, 0.5);
      });
      // the neon trim follows the mood
      neon.forEach((m, k) => m.color.setHSL((mode === 'party' ? t * 0.2 + k * 0.2 : mode === 'show' ? 0.9 : 0.52 + k * 0.05) % 1, 1, 0.5));
      // the booth: the platter turns while music plays, the level lights bounce
      if (playing && disc.visible) disc.rotation.y -= dt * 3.5;
      platters.forEach((p, k) => { if (playing) p.p.rotation.y -= dt * (k ? 3.1 : 3.5); });
      leds.forEach((l, k) => l.material.color.setHSL(0.33 - 0.33 * (k / 8) * (playing ? 1 : 0), 1, playing ? 0.15 + 0.4 * (Math.sin(t * 7 + k * 1.7) > 1 - 2 * pulse ? 1 : 0.1) : 0.12));
      ledStrip.material.color.setHSL((mode === 'party' ? t * 0.2 : 0.9) % 1, 1, 0.5);
      mgear.rotation.x = t * 0.9;
      mscreenMat.emissiveIntensity = 0.8 + 0.15 * Math.sin(t * 2.2);
    },
  };
  void stageTop; void laptop; void lid; void mixer; void micHead; void screen;
  return studio;
}
