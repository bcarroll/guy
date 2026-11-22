// The Library's dust: a room that has stood empty is dusty. Grey patches of dust lie on its floor and cobwebs hang in its four corners;
// GUY and GAL clean them away (librarybrain.js, `libclean`), and they come back, slowly, over time (a patch in about 40 minutes, a cobweb
// in about 90). How dusty each one is (0 clean ... 1 thick) is saved with the rooms (rooms.js), so a clean library stays clean after a reload.
//
// Built in the room's own frame (like the Backyard's fence): x along the door wall from the middle of the room, the room going back from
// the door wall (z = 0) to the far wall (z = -N).
import * as THREE from 'three';

const FLOOR_REGROW = 2400, WEB_REGROW = 5400;           // seconds from clean to thick again
export const WEB_Y = 1.85;                               // the height of a cobweb's middle (within his reach, like the top of a picture frame)

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// a grey smudge with darker specks (the same every time)
const dustTex = () => canvasTex(128, 128, (cx, w, h) => {
  const g = cx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(120,112,100,0.85)'); g.addColorStop(0.7, 'rgba(120,112,100,0.45)'); g.addColorStop(1, 'rgba(120,112,100,0)');
  cx.fillStyle = g; cx.fillRect(0, 0, w, h);
  cx.fillStyle = 'rgba(70,64,58,0.7)';
  for (let i = 0; i < 70; i++) { const a = i * 2.39996, r = Math.sqrt(i / 70) * w * 0.42; cx.fillRect(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2, 2); }
});
// a cobweb across a corner, seen square on: threads hang down from the top middle (where the corner is) and sagging rings join them
const webTex = () => canvasTex(128, 128, (cx, w) => {
  cx.clearRect(0, 0, w, w);
  cx.strokeStyle = 'rgba(235,235,235,0.9)'; cx.lineWidth = 1.2;
  const O = { x: w / 2, y: 0 }, spokes = 8;
  const at = (i, r) => { const a = (i / spokes) * Math.PI; return { x: O.x + Math.cos(a) * r, y: O.y + Math.sin(a) * r }; };
  for (let i = 0; i <= spokes; i++) { const p = at(i, w * 0.7); cx.beginPath(); cx.moveTo(O.x, O.y); cx.lineTo(p.x, p.y); cx.stroke(); }
  for (let r = 14; r < w * 0.7; r += 13) {
    cx.beginPath();
    for (let i = 0; i <= spokes; i++) { const p = at(i, r * (i % 2 ? 0.88 : 1)); if (i) cx.lineTo(p.x, p.y); else cx.moveTo(p.x, p.y); }
    cx.stroke();
  }
});

// Fills `g` (the room's group) with the dust and the cobwebs. Returns the dust: its spots and how to clean them.
export function buildDust(g, L, N) {
  const spots = [];
  const ftex = dustTex(), wtex = webTex();
  // the patches on the floor: out in the room, between where the furniture goes (librarybrain.js finds a free place to stand at each)
  [[-0.3, 0.3], [0.08, 0.32], [0.3, 0.72], [-0.15, 0.78], [0.33, 0.22], [-0.36, 0.55]].forEach(([fx, fz], i) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ map: ftex, transparent: true, depthWrite: false, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = i * 1.3;
    m.position.set(fx * L, 0.006 + i * 0.0004, -fz * N);
    m.renderOrder = 1;
    g.add(m);
    spots.push({ id: `floor${i}`, kind: 'floor', level: 1, mesh: m, local: new THREE.Vector3(fx * L, 0.06, -fz * N) });
  });
  // a cobweb in each corner where two walls meet, a little below the ceiling (the corners by the door wall too)
  [[-1, 1], [1, 1], [-1, 0], [1, 0]].forEach(([sx, far], i) => {
    const cxl = sx * L / 2, czl = far ? -N : 0;
    const ix = -sx, iz = far ? 1 : -1;                                  // the way into the room from that corner
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.76), new THREE.MeshBasicMaterial({ map: wtex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
    // the plane stands across the corner, square to the diagonal, its corner of threads in the room's corner
    m.position.set(cxl + ix * 0.27, WEB_Y + 0.12, czl + iz * 0.27);                 // (the threads hang from its top edge: their middle is at WEB_Y)
    m.rotation.y = Math.atan2(ix, iz);
    g.add(m);
    spots.push({ id: `web${i}`, kind: 'web', level: 1, mesh: m, local: new THREE.Vector3(cxl + ix * 0.22, WEB_Y, czl + iz * 0.22), into: { x: ix, z: iz } });
  });
  const show = (s) => { s.mesh.material.opacity = s.kind === 'floor' ? Math.min(1, s.level) * 0.8 : Math.min(1, s.level) * 0.85; s.mesh.visible = s.level > 0.02; };
  spots.forEach(show);
  const world = (v) => { g.updateWorldMatrix(true, false); return g.localToWorld(v.clone()); };
  const dirOf = (x, z) => { g.updateWorldMatrix(true, false); return new THREE.Vector3(x, 0, z).applyQuaternion(g.quaternion); };
  return {
    spots,
    point: (s) => world(s.local),
    // where he could stand to clean it (best first): for a patch, round it at half a metre; for a cobweb, out from the corner
    stands(s) {
      const c = world(s.local);
      if (s.kind === 'web') {
        const d = dirOf(s.into.x, s.into.z).normalize();
        return [0.62, 0.75].map((k) => ({ x: c.x + d.x * k, z: c.z + d.z * k, yaw: Math.atan2(-d.x, -d.z) }));
      }
      return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * Math.PI / 4; return { x: c.x + Math.sin(a) * 0.5, z: c.z + Math.cos(a) * 0.5, yaw: a + Math.PI }; });
    },
    // wiping it away: `by` off its level (0 is clean)
    clean(s, by) { s.level = Math.max(0, s.level - by); show(s); },
    dirty: (th = 0.5) => spots.filter((s) => s.level > th),
    update(dt) {
      for (const s of spots) {
        if (s.level >= 1) continue;
        s.level = Math.min(1, s.level + dt / (s.kind === 'floor' ? FLOOR_REGROW : WEB_REGROW));
        show(s);
      }
    },
    snapshot: () => spots.map((s) => Math.round(s.level * 100) / 100),
    apply(levels) { if (!Array.isArray(levels)) return; levels.forEach((v, i) => { if (spots[i] && typeof v === 'number') { spots[i].level = Math.max(0, Math.min(1, v)); show(spots[i]); } }); },
  };
}
