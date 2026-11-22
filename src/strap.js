// The guitar strap: from the heel of the neck up the chest, over the left shoulder, down across the back, round the right hip to the pin at the
// end of the body. It lies ON the body: the torso is cut along a slanted plane (left shoulder to right hip) once per rig, and every frame the
// strap is the taut string round that outline (its convex hull) with the two ends of the instrument. (It used to be two straight boxes from the
// instrument to a point in the shoulder: they ran through his chest.)
import * as THREE from 'three';

const TORSO = /(Hips|Spine|Spine1|Spine2|LeftShoulder|RightShoulder)$/;
const N = 26, HALF = 0.021, OFF = 0.009;                   // points along each half, half its width (m), how far off the surface (m)
const cache = new WeakMap();                               // the cut, per Guy
const bare = (n) => n.replace('mixamorig:', '').replace('mixamorig', '');

// The cut: points on the torso's surface near the plane, each in the frame of the bone it moves with; and the plane, in the chest bone's bind space.
// Everything is worked out in bind space (vertex * bindMatrix), so it does not matter how he is standing when it is first needed.
function cutOf(g) {
  if (cache.has(g)) return cache.get(g);
  const pts = [], meshes = [];
  let plane = null, chest = null;
  g.model.traverse((m) => { if (m.isSkinnedMesh) meshes.push(m); });
  meshes.sort((a, b) => (b.name.includes('Surface') ? 1 : 0) - (a.name.includes('Surface') ? 1 : 0));
  for (const m of meshes) {
    const bones = m.skeleton.bones, inv = m.skeleton.boneInverses;
    const find = (n) => bones.findIndex((b) => bare(b.name) === n);
    const bind = (n) => { const i = find(n); return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(inv[i].clone().invert()); };
    if (!plane) {
      const L = bind('LeftShoulder'), A = bind('LeftArm'), R = bind('RightUpLeg'), H = bind('Hips'), i = find('Spine2');
      if (!L || !A || !R || !H || i < 0) return null;
      const unit = L.distanceTo(A) / g.boneWorld('LeftShoulder').distanceTo(g.boneWorld('LeftArm'));      // bind units to a metre
      const top = L.clone().lerp(A, 0.3), low = new THREE.Vector3(R.x * 1.9, H.y + 0.06 * unit, H.z);       // over the shoulder by the neck; the right side of the waist
      const s = top.clone().sub(low).setZ(0).normalize(), n = new THREE.Vector3(s.y, -s.x, 0);              // along the strap (up), and across it (z is forward)
      plane = { o: low, s, n, unit }; chest = { bone: bones[i], inv: inv[i] };
    }
    const geo = m.geometry, P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, count = geo.index ? geo.index.count : P.count;
    const at = (k) => (geo.index ? geo.index.getX(k) : k), v = [0, 1, 2].map(() => new THREE.Vector3()), r = new THREE.Vector3();
    const main = (k) => { let b = 0, w = -1; for (let c = 0; c < 4; c++) if (SW.getComponent(k, c) > w) { w = SW.getComponent(k, c); b = SI.getComponent(k, c); } return b; };
    const ok = bones.map((b) => TORSO.test(bare(b.name)));
    for (let t = 0; t < count; t += 3) {
      const id = [at(t), at(t + 1), at(t + 2)], bn = id.map(main);
      if (!bn.every((b) => ok[b])) continue;
      id.forEach((k, j) => v[j].fromBufferAttribute(P, k).applyMatrix4(m.bindMatrix));
      const d = v.map((p) => r.copy(p).sub(plane.o).dot(plane.n) / plane.unit);
      for (const w of [-HALF, 0, HALF]) for (let j = 0; j < 3; j++) {                      // its middle and both its edges
        const k = (j + 1) % 3, a = d[j] - w, b = d[k] - w;
        if (a * b >= 0) continue;
        const p = v[j].clone().lerp(v[k], a / (a - b));
        pts.push({ p, bone: bones[bn[j]], local: p.clone().applyMatrix4(inv[bn[j]]) });
      }
    }
  }
  // only the outline matters: keep the outermost in each slice of height, front and back (with some to spare over the hull: the spine bends)
  const q = pts.map((x) => ({ x: x.p.z, y: x.p.clone().sub(plane.o).dot(plane.s), it: x }));
  const keep = new Set(hull(q).map((a) => a.it)), ys = q.map((a) => a.y), lo = ys.reduce((a, b) => Math.min(a, b), Infinity), hi = ys.reduce((a, b) => Math.max(a, b), -Infinity);
  const best = [];
  for (const a of q) {
    const i = Math.min(23, Math.floor((a.y - lo) / (hi - lo + 1e-9) * 24)), b = (best[i] ??= [a, a]);
    if (a.x > b[0].x) b[0] = a;
    if (a.x < b[1].x) b[1] = a;
  }
  for (const b of best) if (b) for (const a of b) keep.add(a.it);
  const cut = { pts: [...keep], plane, chest };
  cache.set(g, cut);
  return cut;
}

function hull(pts) {                                       // convex hull, counter-clockwise (Andrew)
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (l) => {
    const h = [];
    for (const c of l) {
      while (h.length > 1 && (h[h.length - 1].x - h[h.length - 2].x) * (c.y - h[h.length - 2].y) - (h[h.length - 1].y - h[h.length - 2].y) * (c.x - h[h.length - 2].x) <= 0) h.pop();
      h.push(c);
    }
    h.pop();
    return h;
  };
  return [...half(p), ...half([...p].reverse())];
}

// The strap's line in the world, from the heel of the neck to the pin: { front: [...], back: [...], n } (front ends and back starts on top of the shoulder).
export function strapLine(g, heel, pin) {
  const cut = cutOf(g);
  if (!cut) return null;
  const { plane, chest } = cut, u = plane.unit, M = chest.bone.matrixWorld.clone().multiply(chest.inv), Mi = M.clone().invert(), r = new THREE.Vector3();
  const flat = (world, tag) => { r.copy(world).applyMatrix4(Mi).sub(plane.o); return { x: r.z, y: r.dot(plane.s), w: r.dot(plane.n), tag }; };
  const body = cut.pts.map((c) => ({ ...flat(c.local.clone().applyMatrix4(c.bone.matrixWorld)), w: 0 }));
  const cx = body.reduce((a, b) => a + b.x, 0) / body.length, cy = body.reduce((a, b) => a + b.y, 0) / body.length;
  for (const b of body) { const l = Math.hypot(b.x - cx, b.y - cy) || 1; b.x += (b.x - cx) / l * OFF * u; b.y += (b.y - cy) / l * OFF * u; }
  const H = flat(heel, 'heel'), E = flat(pin, 'pin'), far = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  let ring = hull([...body, H, E]), i = ring.findIndex((p) => p.tag === 'heel');
  if (i < 0) {                                             // the instrument is pressed into him: from where it touches
    const on = hull(body), k = on.reduce((m, p, j) => (far(p, H) < far(on[m], H) ? j : m), 0);
    ring = [H, ...on.slice(k), ...on.slice(0, k)]; i = 0;
  }
  ring = [...ring.slice(i), ...ring.slice(0, i)];
  let e = ring.findIndex((p) => p.tag === 'pin');
  if (e < 0) { e = ring.reduce((m, p, j) => (j && far(p, E) < far(ring[m], E) ? j : m), 1) + 1; ring = [...ring.slice(0, e), E]; }
  let chain = ring.slice(0, e + 1);
  if (chain.length < 3) chain = [H, body.reduce((m, p) => (p.y > m.y ? p : m)), E];       // (the instrument is at such an angle, coming off its stand, that its two ends are neighbours on the outline: straight over the shoulder; there used to be nothing between them, and it threw every frame)
  const topAt = Math.min(chain.length - 2, Math.max(1, chain.reduce((m, p, j) => (p.y > chain[m].y ? j : m), 0)));
  const up = (p) => plane.o.clone().addScaledVector(plane.s, p.y).addScaledVector(plane.n, p.w).add(r.set(0, 0, p.x)).applyMatrix4(M);
  const sample = (line) => {
    const P = line.map(up), len = [0], out = [];
    for (let k = 1; k < P.length; k++) len.push(len[k - 1] + P[k].distanceTo(P[k - 1]));
    for (let k = 0, j = 1; k < N; k++) {
      const at = len[len.length - 1] * k / (N - 1);
      while (j < P.length - 1 && len[j] < at) j++;
      out.push(P[j - 1].clone().lerp(P[j], Math.min(1, Math.max(0, (at - len[j - 1]) / (len[j] - len[j - 1] || 1)))));
    }
    return out;
  };
  return { front: sample(chain.slice(0, topAt + 1)), back: sample(chain.slice(topAt)), n: plane.n.clone().transformDirection(M) };
}

export function makeStrapMesh() {
  const geo = new THREE.BufferGeometry(), idx = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  for (let k = 0; k < N - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  return m;
}

// lay the ribbon `mesh` along the world points `line`, its flat side across `n`
export function layStrap(mesh, line, n) {
  const A = mesh.geometry.attributes.position, t = new THREE.Vector3(), w = new THREE.Vector3(), p = new THREE.Vector3();
  mesh.parent.updateWorldMatrix(true, false);
  for (let k = 0; k < N; k++) {
    t.copy(line[Math.min(N - 1, k + 1)]).sub(line[Math.max(0, k - 1)]).normalize();
    w.copy(n).addScaledVector(t, -n.dot(t)).normalize().multiplyScalar(HALF);
    for (const s of [-1, 1]) { mesh.parent.worldToLocal(p.copy(line[k]).addScaledVector(w, s)); A.setXYZ(k * 2 + (s > 0 ? 1 : 0), p.x, p.y, p.z); }
  }
  A.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}
