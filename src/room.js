import * as THREE from 'three';
import { BOOK_DEFS } from './skills.js';
import { sfx } from './sfx.js';
import { makeWorkshopBuilders } from './workobjects.js';
import { makeRestaurantBuilders } from './restobjects.js';
import { makeBotBuilders } from './botobjects.js';

export const ROOM = { w: 10, d: 8, h: 3.2 }; // x in [-5,5], z in [-4,4]

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function box(w, h, d, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Axis-aligned footprints Guy must walk around: {x0,x1,z0,z1}
export function buildRoom(scene) {
  const room = new THREE.Group();
  scene.add(room);
  const obstacles = [];

  // Floor (wood stripes via canvas texture)
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `hsl(28, ${35 + (i % 3) * 4}%, ${38 + (i * 7) % 9}%)`;
    g.fillRect(0, i * 64, 512, 62);
  }
  const floorTex = new THREE.CanvasTexture(c);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(ROOM.w / 4, ROOM.d / 4);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  // Walls & ceiling: single-sided so the ones facing away from the camera vanish when orbiting
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcdbfa8, roughness: 0.95 });
  const wall = (w, h, x, y, z, ry, m = wallMat) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    p.receiveShadow = true;
    room.add(p);
    return p;
  };
  const wallMeshes = {                    // kept so a doorway can be cut in one (see cutDoorway)
    back: wall(ROOM.w, ROOM.h, 0, ROOM.h / 2, -ROOM.d / 2, 0),
    front: wall(ROOM.w, ROOM.h, 0, ROOM.h / 2, ROOM.d / 2, Math.PI),
    left: wall(ROOM.d, ROOM.h, -ROOM.w / 2, ROOM.h / 2, 0, Math.PI / 2),
    right: wall(ROOM.d, ROOM.h, ROOM.w / 2, ROOM.h / 2, 0, -Math.PI / 2),
  };
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0xeeeeee));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ROOM.h;
  room.add(ceil);

  // Baseboards
  const bb = mat(0x5a4632);
  box(ROOM.w, 0.12, 0.03, bb, 0, 0.06, -ROOM.d / 2 + 0.015, room);
  box(0.03, 0.12, ROOM.d, bb, -ROOM.w / 2 + 0.015, 0.06, 0, room);
  box(0.03, 0.12, ROOM.d, bb, ROOM.w / 2 - 0.015, 0.06, 0, room);

  // ---- Movable objects ----
  // Every piece of furniture is a group positioned at its footprint centre, registered in `objects`.
  // weight: 'light' | 'medium' can be pushed around by Guy; 'heavy' stays put unless the user drags it.
  const objects = {};
  const makeObject = (name, x, z, bw, bd, h, weight, build) => {
    const group = new THREE.Group();
    room.add(group);
    build(group);
    const ob = { x0: 0, x1: 0, z0: 0, z1: 0, h, active: true, name };
    obstacles.push(ob);
    const obj = {
      name, group, h, weight, obstacle: ob, bw, bd, home: { x, z },
      rot: 0, // quarter turns; the footprint swaps width/depth on odd turns
      get w() { return this.rot % 2 ? this.bd : this.bw; },
      get d() { return this.rot % 2 ? this.bw : this.bd; },
      get x() { return group.position.x; },
      get z() { return group.position.z; },
      get yaw() { return (this.rot * Math.PI) / 2; },
      set(nx, nz) {
        group.position.set(nx, 0, nz);
        Object.assign(ob, { x0: nx - this.w / 2, x1: nx + this.w / 2, z0: nz - this.d / 2, z1: nz + this.d / 2 });
      },
      rotate(dir) { this.rot = (this.rot + dir + 4) % 4; this.set(this.x, this.z); },
      // object-local offset (dx right, dz forward) -> world offset, and back
      local(dx, dz) { const c = Math.cos(this.yaw), sn = Math.sin(this.yaw); return { x: dx * c + dz * sn, z: -dx * sn + dz * c }; },
      toLocal(wx, wz) { const c = Math.cos(this.yaw), sn = Math.sin(this.yaw); return { x: wx * c - wz * sn, z: wx * sn + wz * c }; },
      // ease the visible rotation towards the target angle
      update(dt) {
        if (this.hauled) { group.rotation.y = this.hauledYaw ?? group.rotation.y; return; }               // being carried: it turns with him
        let d = this.yaw - group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        group.rotation.y += d * Math.min(1, dt * 10);
      },
    };
    obj.set(x, z);
    objects[name] = obj;
    return obj;
  };

  // Upright piano (heavy)
  const black = mat(0x141414, { roughness: 0.35 });
  const keys = [];
  const pianoObj = makeObject('piano', -2.5, -3.5, 1.9, 1.0, 1.25, 'heavy', (g) => {
    box(1.7, 1.25, 0.8, black, 0, 0.625, -0.05, g);          // cabinet
    box(1.8, 0.05, 0.5, black, 0, 0.74, 0.35, g);             // key shelf
    box(1.7, 0.2, 0.06, black, 0, 0.88, 0.14, g);             // fall board
    const NKEYS = 14;
    const kw = 1.5 / NKEYS;
    for (let i = 0; i < NKEYS; i++) {
      const k = box(kw * 0.92, 0.04, 0.34, mat(0xf5f2ea, { roughness: 0.4 }), -0.75 + kw * (i + 0.5), 0.78, 0.33, g);
      k.userData.baseY = k.position.y;
      keys.push(k);
      if ([0, 1, 3, 4, 5, 7, 8, 10, 11, 12].includes(i)) {
        const bk = box(kw * 0.55, 0.035, 0.2, black, -0.75 + kw * (i + 1), 0.815, 0.26, g);
        bk.userData.baseY = bk.position.y;
        keys.push(bk);
      }
    }
  });

  // Piano bench (light)
  const benchMat = mat(0x3a2a1c);
  makeObject('bench', -1.0, -2.3, 1.0, 0.5, 0.49, 'light', (g) => {
    box(0.9, 0.08, 0.42, benchMat, 0, 0.45, 0, g);
    for (const dx of [-0.38, 0.38]) for (const dz of [-0.15, 0.15]) box(0.05, 0.43, 0.05, benchMat, dx, 0.215, dz, g);
  });

  // Table with the boombox on it (medium; the boombox rides along)
  const tableMat = mat(0x6b4a2f);
  const boombox = new THREE.Group();
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02), new THREE.MeshBasicMaterial({ color: 0x333333 }));
  makeObject('table', 3.2, -3.5, 1.3, 0.6, 0.73, 'medium', (g) => {
    box(1.3, 0.06, 0.6, tableMat, 0, 0.7, 0, g);
    for (const dx of [-0.58, 0.58]) for (const dz of [-0.24, 0.24]) box(0.06, 0.7, 0.06, tableMat, dx, 0.35, dz, g);
    boombox.position.set(0, 0.73, 0);
    g.add(boombox);
    box(0.6, 0.28, 0.2, mat(0x222831), 0, 0.14, 0, boombox);
    const spkMat = mat(0x0a0a0a);
    const spkL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), spkMat);
    spkL.rotation.x = Math.PI / 2; spkL.position.set(-0.19, 0.14, 0.105); boombox.add(spkL);
    const spkR = spkL.clone(); spkR.position.x = 0.19; boombox.add(spkR);
    led.position.set(0, 0.22, 0.105);
    boombox.add(led);
  });

  // Bookshelf (heavy)
  const shelfMat = mat(0x5b3d26);
  const shelfBooks = []; // { mesh, row, y, z, color, h, w, def } so Guy can take one down and put it back
  let shelfGroup = null;
  makeObject('shelf', 4.7, 0.2, 0.5, 1.9, 2.2, 'heavy', (g) => {
    shelfGroup = g;
    box(0.4, 2.2, 0.05, shelfMat, 0, 1.1, -0.9, g);
    box(0.4, 2.2, 0.05, shelfMat, 0, 1.1, 0.9, g);
    box(0.05, 2.2, 1.8, shelfMat, 0.18, 1.1, 0, g);
    for (let i = 0; i <= 5; i++) box(0.4, 0.04, 1.8, shelfMat, 0, 0.02 + i * 0.43, 0, g);
  });

  // Spine label: title running up the spine on the book's colour. Faces the room (local -x).
  const spineMaterial = (def) => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const g2 = c.getContext('2d');
    const col = '#' + new THREE.Color(def.color).getHexString();
    g2.fillStyle = col; g2.fillRect(0, 0, 64, 256);
    g2.fillStyle = 'rgba(255,255,255,0.8)'; g2.fillRect(0, 14, 64, 3); g2.fillRect(0, 239, 64, 3);
    g2.save();
    g2.translate(32, 128); g2.rotate(Math.PI / 2);
    g2.fillStyle = '#fff'; g2.font = 'bold 22px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    let size = 22;
    while (g2.measureText(def.title).width > 205 && size > 9) { size -= 1; g2.font = `bold ${size}px sans-serif`; }
    g2.fillText(def.title, 0, 0);
    g2.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  };

  // The shelf holds 16 books on the two rows within Guy's reach (slots 0-15). A book past that is laid flat on the floor in a stack
  // beside the shelf, spine towards the room, one on top of the other (it still counts as "on the shelf" for the Catalogue).
  const SHELF_CAPACITY = 16;
  const STACK_X = -0.06;                            // the stack's place beside the shelf, in the shelf's own frame (z along the shelf)
  let stackZ = null;                                // chosen when the first book overflows: the end of the shelf with room
  const stackObs = { x0: 0, x1: 0, z0: 0, z1: 0, h: 0.5, active: true, name: 'bookstack' };
  const pickStackEnd = () => {
    const sh = objects.shelf;
    for (const zEnd of [-1.3, 1.3]) {
      const l = sh.local(STACK_X, zEnd), x = sh.x + l.x, z = sh.z + l.z;
      if (Math.abs(x) < 4.5 && z > -3.5 && z < 3.5 && !obstacles.some((o) => o !== sh.obstacle && o !== stackObs && x > o.x0 - 0.3 && x < o.x1 + 0.3 && z > o.z0 - 0.3 && z < o.z1 + 0.3)) return zEnd;
    }
    return -1.3;
  };
  // Lay the stacked books out: flat, one on top of the other from the floor up, a little untidy. Held books are left out (the others
  // settle), and the stack's footprint is an obstacle so nothing is put on top of it.
  const layoutStack = () => {
    const stack = shelfBooks.filter((r) => r.stack).sort((a, b) => a.slot - b.slot);
    let y = 0, any = false;
    for (const r of stack) {
      if (!r.mesh.visible) continue;
      const j = Math.sin(r.slot * 12.9898), k = Math.cos(r.slot * 78.233);
      r.mesh.rotation.order = 'YXZ';
      r.mesh.rotation.set(Math.PI / 2, j * 0.14, 0);
      r.mesh.position.set(STACK_X + j * 0.015, y + r.w / 2, stackZ + k * 0.015);
      y += r.w + 0.002;
      r.y = y; r.z = stackZ; r.reachX = STACK_X;       // where Guy's hand goes: the top of this book
      any = true;
    }
    const at = objects.shelf.indexOfStack = stack.length;
    const l = objects.shelf.local(STACK_X, stackZ ?? 0), cx = objects.shelf.x + l.x, cz = objects.shelf.z + l.z;
    Object.assign(stackObs, { x0: cx - 0.22, x1: cx + 0.22, z0: cz - 0.22, z1: cz + 0.22, h: Math.max(0.1, y) });
    const listed = obstacles.indexOf(stackObs) >= 0;
    if (at && !listed) obstacles.push(stackObs);
    else if (!at && listed) obstacles.splice(obstacles.indexOf(stackObs), 1);
    void any;
  };
  const baseShelfSet = objects.shelf.set;
  objects.shelf.set = function (nx, nz) { baseShelfSet.call(this, nx, nz); if (stackZ !== null) layoutStack(); };      // the stack goes where the shelf goes
  objects.shelf.layoutStack = layoutStack;
  // the book on top of the stack (the one he can pick up), or null
  objects.shelf.stackTop = () => shelfBooks.filter((r) => r.stack && r.mesh.visible).sort((a, b) => b.slot - a.slot)[0] || null;

  // A bookshelf Guy or GAL built (kind 'bookshelf2') is the same as this one: 16 places on the two rows within reach, the spines facing the
  // room, and the books on it are read from like any other (rec.host names the shelf a book stands on; the main shelf if it is null).
  // The books past this shelf's 16 go on the built shelves in turn (16 each) and only then on the floor stack.
  const bookHosts = () => Object.values(objects).filter((o) => o.kind === 'bookshelf2' && !o.removing).sort((a, b) => (a.name < b.name ? -1 : 1));
  const hostBook = (rec, host, j) => {
    host.group.add(rec.mesh);
    const row = j % 2 === 0 ? 3 : 2, z = -0.72 + Math.floor(j / 2) * 0.2;
    rec.mesh.rotation.set(0, 0, 0);
    rec.mesh.position.set(-0.03, 0.045 + row * 0.43 + rec.h / 2 + 0.02, z + rec.w / 2);
    Object.assign(rec, { host: host.name, stack: false, row, y: rec.mesh.position.y, z: z + rec.w / 2, reachX: undefined });
  };
  const toStack = (rec) => {
    if (stackZ === null) stackZ = pickStackEnd();
    shelfGroup.add(rec.mesh);
    Object.assign(rec, { host: null, stack: true, row: -1, z: stackZ, reachX: STACK_X });
  };
  const rehome = () => {
    const over = shelfBooks.filter((r) => r.slot >= SHELF_CAPACITY).sort((a, b) => a.slot - b.slot), hosts = bookHosts();
    over.forEach((rec, n) => { const hi = Math.floor(n / 16); if (hi < hosts.length) hostBook(rec, hosts[hi], n % 16); else toStack(rec); });
    if (stackZ !== null || over.some((r) => r.stack)) layoutStack();
  };

  // Put a book on the shelf in the next free slot (rows 3 and 2 are within Guy's reach), or on the stack if the shelf is full.
  const addBook = (def) => {
    let i = 0;                                      // the lowest free slot: a forgotten book leaves a gap, nothing slides along
    while (shelfBooks.some((r) => r.slot === i)) i++;
    const row = i % 2 === 0 ? 3 : 2;
    const z = -0.72 + Math.floor(i / 2) * 0.2;
    const h = def.height || 0.3, w = def.thick || 0.05;
    const color = new THREE.Color(def.color);
    const side = mat(color);
    const mats = [side, spineMaterial(def), side, side, side, side]; // +x, -x (spine, towards the room), +y, -y, +z, -z
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, h, w), mats);
    mesh.castShadow = mesh.receiveShadow = true;
    shelfGroup.add(mesh);
    if (i >= SHELF_CAPACITY) {
      const rec = { mesh, row: -1, y: 0, z: 0, color, h, w, def, slot: i, stack: false, host: null };
      shelfBooks.push(rec);
      rehome();                                      // on a built bookshelf if one has room, otherwise on the floor
      return rec;
    }
    const y = 0.045 + row * 0.43 + h / 2 + 0.02;
    mesh.position.set(-0.03, y, z + w / 2);
    const rec = { mesh, row, y, z: z + w / 2, color, h, w, def, slot: i };
    shelfBooks.push(rec);
    return rec;
  };
  // Take a book off the shelf for good (it goes back to the catalogue); the other books stay where they are.
  objects.shelf.removeBook = (rec) => {
    const k = shelfBooks.indexOf(rec);
    if (k < 0) return false;
    shelfBooks.splice(k, 1);
    (rec.mesh.parent || shelfGroup).remove(rec.mesh);
    rec.mesh.geometry.dispose();
    if (rec.stack) layoutStack();
    return true;
  };
  objects.shelf.removable = false; // the bookshelf is where Guy learns: it can be moved but never removed
  objects.shelf.books = shelfBooks;
  objects.shelf.addBook = addBook;

  // Record sleeves go on the top shelf (row 4), cover facing the room. Books never use this shelf.
  const shelfAlbums = [];
  const albumArt = (def) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g2 = c.getContext('2d');
    const col = '#' + new THREE.Color(def.color).getHexString(), acc = '#' + new THREE.Color(def.accent).getHexString();
    const grad = g2.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, col); grad.addColorStop(1, '#101018');
    g2.fillStyle = grad; g2.fillRect(0, 0, 256, 256);
    g2.fillStyle = '#0a0a0e'; g2.beginPath(); g2.arc(128, 104, 66, 0, Math.PI * 2); g2.fill();   // the record
    g2.strokeStyle = 'rgba(255,255,255,0.15)'; g2.lineWidth = 2;
    for (const r of [56, 46, 36]) { g2.beginPath(); g2.arc(128, 104, r, 0, Math.PI * 2); g2.stroke(); }
    g2.fillStyle = acc; g2.beginPath(); g2.arc(128, 104, 20, 0, Math.PI * 2); g2.fill();
    g2.fillStyle = '#fff'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    let size = 26; g2.font = `bold ${size}px sans-serif`;
    while (g2.measureText(def.title).width > 232 && size > 12) { size -= 1; g2.font = `bold ${size}px sans-serif`; }
    g2.fillText(def.title, 128, 202);
    g2.fillStyle = acc; g2.font = '15px sans-serif'; g2.fillText(def.genre, 128, 232);
    // the title again, down the left edge, so a sleeve still reads when the next one overlaps it on a crowded shelf
    g2.save(); g2.translate(26, 118); g2.rotate(-Math.PI / 2);
    g2.fillStyle = '#fff'; size = 20; g2.font = `bold ${size}px sans-serif`;
    while (g2.measureText(def.title).width > 216 && size > 11) { size -= 1; g2.font = `bold ${size}px sans-serif`; }
    g2.fillText(def.title, 0, 0);
    g2.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // Up to five sleeves stand side by side. More than that overlap like records in a rack: each one sits a little closer
  // to the room than the one before it, so the left strip of every sleeve shows. rec.z is the middle of the exposed
  // strip, which is where Guy's hand goes (the last sleeve is fully exposed).
  const layoutAlbums = () => {
    const n = shelfAlbums.length, crowded = n > 5;
    const step = crowded ? 1.44 / (n - 1) : 0.34, z0 = crowded ? -0.72 : -0.68;
    shelfAlbums.forEach((r, i) => {
      const x = -0.07 - (crowded ? i * 0.009 : 0), zc = z0 + i * step;
      r.mesh.position.set(x, r.y, zc);
      r.z = crowded && i < n - 1 ? zc - 0.155 + step / 2 : zc;
      r.reachX = x - 0.03;
    });
  };
  const addAlbum = (def) => {
    const side = mat(0x15151a);
    const mats = [side, new THREE.MeshStandardMaterial({ map: albumArt(def), roughness: 0.6 }), side, side, side, side];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.31, 0.31), mats);
    const y = 0.04 + 4 * 0.43 + 0.155 + 0.01;
    mesh.castShadow = true;
    shelfGroup.add(mesh);
    const rec = { mesh, row: 4, y, z: 0, color: new THREE.Color(def.color), h: 0.31, w: 0.31, def, kind: 'album', reachX: -0.1 };
    shelfAlbums.push(rec);
    layoutAlbums();
    return rec;
  };
  objects.shelf.albums = shelfAlbums;
  objects.shelf.addAlbum = addAlbum;
  BOOK_DEFS.forEach(addBook);

  // Floor lamp (light), its bulb moves with it
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd88a, emissiveIntensity: 0.9, side: THREE.DoubleSide });
  const lampLight = new THREE.PointLight(0xffd9a0, 6, 7, 1.6);
  makeObject('lamp', -4.3, 3.0, 0.5, 0.5, 1.7, 'light', (g) => {
    box(0.3, 0.03, 0.3, mat(0x222222), 0, 0.015, 0, g);
    box(0.03, 1.5, 0.03, mat(0x222222), 0, 0.75, 0, g);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.32, 24, 1, true), shadeMat);
    shade.position.y = 1.62;
    g.add(shade);
    lampLight.position.set(0, 1.6, 0);
    g.add(lampLight);
  });
  const lampState = {
    on: true,
    mode: 'normal',               // 'party' cycles colours with the beat
    color: new THREE.Color(0xffd9a0),
    base: 6,
    apply() {
      lampLight.color.copy(this.color);
      lampLight.intensity = this.on ? this.base : 0;
      shadeMat.emissive.copy(this.color);
      shadeMat.emissiveIntensity = this.on ? 0.9 : 0;
      for (const f of this.followers || []) f(this.on, this.color);     // wall lights glow with the lamp
    },
    set(on) { this.on = on; if (!on) this.mode = 'normal'; sfx('click'); this.apply(); },
    toggle() { this.set(!this.on); },
    setLook(hex, base) { this.mode = 'normal'; this.color.set(hex); this.base = base; this.on = true; this.apply(); },
    party() { this.mode = 'party'; this.on = true; this.apply(); },
    tick(beat) {
      if (this.mode !== 'party' || !this.on) return;
      this.color.setHSL((beat * 0.125) % 1, 0.9, 0.55);
      this.base = 5 + 4 * Math.abs(Math.sin(beat * Math.PI));
      this.apply();
    },
  };

  // Chairs. Every chair has obj.sit = { seat, gap }: local z of the pelvis when sitting, and of the spot where he stands in front of it
  // (he steps back onto the seat from there). Guy may sit on any chair in the room.
  const buildArmchair = (name, x, z, color) => {
    const chairMat = mat(color);
    const o = makeObject(name, x, z, 1.0, 1.0, 1.2, 'medium', (g) => {
      // faces local -z; the seat block stops 0.5 m short of the front of the footprint's far side so shins hang clear of it
      box(0.9, 0.5, 0.75, chairMat, 0, 0.25, -0.125, g);   // seat block (z -0.5..0.25), top at 0.5 m
      box(0.9, 0.7, 0.18, chairMat, 0, 0.85, 0.16, g);     // backrest on top of the rear of the seat
      box(0.18, 0.3, 0.75, chairMat, -0.45, 0.65, -0.125, g);
      box(0.18, 0.3, 0.75, chairMat, 0.45, 0.65, -0.125, g);
    });
    o.sit = { seat: -0.22, gap: -0.95 };                   // pelvis well back from the front edge so the shins hang clear
    return o;
  };
  const buildWoodenChair = (name, x, z, metal = false) => {
    const wood = metal ? mat(0xb4bcc6, { metalness: 0.75, roughness: 0.3 }) : mat(0x9a6b3d, { roughness: 0.7 });
    const o = makeObject(name, x, z, 0.55, 0.55, 1.0, 'light', (g) => {
      box(0.46, 0.05, 0.46, wood, 0, 0.475, 0, g);          // seat, top at 0.5 m
      box(0.46, 0.5, 0.04, wood, 0, 0.75, 0.21, g);         // backrest at the +z side (the chair faces local -z)
      for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.04, 0.45, 0.04, wood, lx, 0.225, lz, g);
    });
    o.sit = { seat: 0.0, gap: -0.75 };
    return o;
  };
  buildArmchair('armchair', 3.4, 3.2, 0x3d5a73);

  // Potted plant (light)
  makeObject('plant', -4.4, -1.2, 0.5, 0.5, 0.9, 'light', (g) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 16), mat(0xa4552f));
    pot.position.y = 0.175; pot.castShadow = true; g.add(pot);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat(0x2f7d3a));
      leaf.scale.set(0.5, 1.6, 0.25);
      leaf.position.set(Math.cos(i) * 0.1, 0.62, Math.sin(i) * 0.1);
      leaf.rotation.set(Math.sin(i * 2) * 0.5, i, Math.cos(i * 2) * 0.5);
      leaf.castShadow = true;
      g.add(leaf);
    }
  });

  // ---- Decor: the rug, the windows and the picture ----
  // Not obstacles (Guy walks over the rug and never touches the wall pieces), but first-class objects all the same: the user can
  // remove them, put them back from the Catalogue, and slide the wall pieces along their wall.
  // A wall piece sits at (u, v): u along the wall (z on the left wall, x on the back wall), v = height of its centre.
  // The rug sits at (u, v) = (x, z). Its group's local +z points into the room for wall pieces.
  const decor = {};
  const WALL = {
    left: { rotY: Math.PI / 2, lo: -ROOM.d / 2, hi: ROOM.d / 2, plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), ROOM.w / 2),
      at: (u, v) => new THREE.Vector3(-ROOM.w / 2, v, u), near: (x0, x1, z0) => x0 < -ROOM.w / 2 + 0.1, span: (x0, x1, z0, z1) => [z0, z1] },
    back: { rotY: 0, lo: -ROOM.w / 2, hi: ROOM.w / 2, plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), ROOM.d / 2),
      at: (u, v) => new THREE.Vector3(u, v, -ROOM.d / 2), near: (x0, x1, z0) => z0 < -ROOM.d / 2 + 0.1, span: (x0, x1) => [x0, x1] },
    // the right and front walls face away from the default camera, so no wall pieces hang on them; only doors (see below) use them
    right: { rotY: -Math.PI / 2, lo: -ROOM.d / 2, hi: ROOM.d / 2, plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), ROOM.w / 2),
      at: (u, v) => new THREE.Vector3(ROOM.w / 2, v, u), near: (x0, x1) => x1 > ROOM.w / 2 - 0.1, span: (x0, x1, z0, z1) => [z0, z1] },
    front: { rotY: Math.PI, lo: -ROOM.w / 2, hi: ROOM.w / 2, plane: new THREE.Plane(new THREE.Vector3(0, 0, -1), ROOM.d / 2),
      at: (u, v) => new THREE.Vector3(u, v, ROOM.d / 2), near: (x0, x1, z0, z1) => z1 > ROOM.d / 2 - 0.1, span: (x0, x1) => [x0, x1] },
  };
  for (const k of Object.keys(WALL)) WALL[k].n = new THREE.Vector3(Math.sin(WALL[k].rotY), 0, Math.cos(WALL[k].rotY));      // the way into the room
  // A wall of an added room, in world terms: `p0` the point on the floor at u = 0, `n` the way into the room, `t` the way u grows.
  // The same fields as the main room's walls above, so wall pieces (pictures, Guy's paintings) hang on it just the same.
  const makeWall = (p0, n, t, lo, hi) => ({
    rotY: Math.atan2(n.x, n.z), lo, hi, p0, n, t,
    plane: new THREE.Plane(n.clone(), -n.dot(p0)),
    at: (u, v) => new THREE.Vector3(p0.x + t.x * u, v, p0.z + t.z * u),
    uv: (p) => ({ u: (p.x - p0.x) * t.x + (p.z - p0.z) * t.z, v: p.y }),
    near: (x0, x1, z0, z1) => Math.min(...[[x0, z0], [x0, z1], [x1, z0], [x1, z1]].map(([x, z]) => (x - p0.x) * n.x + (z - p0.z) * n.z)) < 0.1,
    span: (x0, x1, z0, z1) => { const s = [[x0, z0], [x0, z1], [x1, z0], [x1, z1]].map(([x, z]) => (x - p0.x) * t.x + (z - p0.z) * t.z); return [Math.min(...s), Math.max(...s)]; },
  });
  const MACHINE_RECT = { u0: -2.7, u1: -1.9, v0: 1.0, v1: 2.3 };   // the Catalogue on the left wall
  const overlap1 = (a0, a1, b0, b1) => a1 > b0 && a0 < b1;

  // ---- Doors: a doorway on a wall of the main room leads to a room the user added (src/rooms.js) ----
  // A door keeps a strip of floor in front of it clear (`zone`): furniture cannot be put or pushed into it and wall pieces cannot
  // cover the doorway. u runs along the wall like a wall piece's u (z on the right wall, x on the front and back walls).
  const DOOR = { w: 1.0, h: 2.2, zone: 1.0, margin: 0.15 };
  const doors = {};                                                    // room id -> { id, wall, u, group, shell, rect }
  const doorRect = (wall, u) => {                                       // the floor strip in front of a door at (wall, u)
    const hw = DOOR.w / 2 + DOOR.margin;
    if (wall === 'right') return { x0: ROOM.w / 2 - DOOR.zone, x1: ROOM.w / 2, z0: u - hw, z1: u + hw };
    if (wall === 'front') return { x0: u - hw, x1: u + hw, z0: ROOM.d / 2 - DOOR.zone, z1: ROOM.d / 2 };
    return { x0: u - hw, x1: u + hw, z0: -ROOM.d / 2, z1: -ROOM.d / 2 + DOOR.zone };   // back
  };
  const doorRectIn = (wall, u) => {                                     // the same strip on the other side of the wall, inside the added room
    const hw = DOOR.w / 2 + DOOR.margin;
    if (wall === 'right') return { x0: ROOM.w / 2, x1: ROOM.w / 2 + DOOR.zone, z0: u - hw, z1: u + hw };
    if (wall === 'front') return { x0: u - hw, x1: u + hw, z0: ROOM.d / 2, z1: ROOM.d / 2 + DOOR.zone };
    return { x0: u - hw, x1: u + hw, z0: -ROOM.d / 2 - DOOR.zone, z1: -ROOM.d / 2 };
  };
  const rectsOverlap = (a, b) => a.x1 > b.x0 && a.x0 < b.x1 && a.z1 > b.z0 && a.z0 < b.z1;
  const doorBlocks = (x0, x1, z0, z1) => Object.values(doors).some((d) => rectsOverlap(d.rect, { x0, x1, z0, z1 }) || rectsOverlap(d.rectIn, { x0, x1, z0, z1 }));
  // The floors things can stand on: Guy's room and every added room.
  const MAIN_BOUNDS = { id: 'main', minX: -ROOM.w / 2, maxX: ROOM.w / 2, minZ: -ROOM.d / 2, maxZ: ROOM.d / 2 };
  const roomBoundsList = () => [MAIN_BOUNDS, ...Object.values(doors).map((d) => ({ id: d.id, ...d.shell.bounds }))];
  const boundsAt = (x, z) => roomBoundsList().find((b) => x >= b.minX - 0.01 && x <= b.maxX + 0.01 && z >= b.minZ - 0.01 && z <= b.maxZ + 0.01) || MAIN_BOUNDS;

  const makeDecor = (name, label, o, build) => {
    const group = new THREE.Group();
    room.add(group);
    build(group);
    const d = {
      name, label, decor: true, removable: true, group, wall: o.wall || null, hw: o.hw || 0, hh: o.hh || 0,
      hx: o.hx || 0, hz: o.hz || 0, rot: 0,          // floor pieces: half sizes along x and z (swapped on odd quarter turns)
      get ex() { return this.rot % 2 ? this.hz : this.hx; },
      get ez() { return this.rot % 2 ? this.hx : this.hz; },
      home: { u: o.u, v: o.v }, u: o.u, v: o.v,
      plane: o.wall ? WALL[o.wall].plane : new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      set(u, v) {
        this.u = u; this.v = v;
        if (this.wall) { group.position.copy(WALL[this.wall].at(u, v)); group.rotation.y = WALL[this.wall].rotY; }
        else { group.position.set(u, 0, v); group.rotation.y = (this.rot * Math.PI) / 2; }
      },
      // a quarter turn for a floor piece, if the turned piece still fits where it is
      turn(dir) {
        if (this.wall || this.hx === this.hz) return false;
        const was = this.rot;
        this.rot = (this.rot + dir + 4) % 4;
        if (!decorFits(this, this.u, this.v)) { this.rot = was; return false; }
        this.set(this.u, this.v);
        return true;
      },
      // a point on the plane the piece lives on -> its (u, v)
      uv(p) { return this.wall && WALL[this.wall].uv ? WALL[this.wall].uv(p) : this.wall === 'left' ? { u: p.z, v: p.y } : this.wall === 'back' ? { u: p.x, v: p.y } : { u: p.x, v: p.z }; },
    };
    d.set(o.u, o.v);
    decor[name] = d;
    return d;
  };

  // Room on its wall (or, for the rug, on the floor) for `d` at (u, v)? Clear of the other pieces, the Catalogue and furniture
  // standing against the wall that is taller than the piece's lower edge.
  const decorFits = (d, u, v) => {
    if (!d.wall) return Math.abs(u) <= ROOM.w / 2 - d.ex && Math.abs(v) <= ROOM.d / 2 - d.ez;     // a rug stays inside the room (rugs may overlap: each lies a little above the last)
    const W = WALL[d.wall];
    if (u - d.hw < W.lo + 0.05 || u + d.hw > W.hi - 0.05 || v - d.hh < 0.45 || v + d.hh > ROOM.h - 0.1) return false;
    for (const o of Object.values(decor)) {
      if (o !== d && o.wall === d.wall && overlap1(u - d.hw, u + d.hw, o.u - o.hw, o.u + o.hw) && overlap1(v - d.hh, v + d.hh, o.v - o.hh, o.v + o.hh)) return false;
    }
    if (d.wall === 'left' && overlap1(u - d.hw, u + d.hw, MACHINE_RECT.u0, MACHINE_RECT.u1) && overlap1(v - d.hh, v + d.hh, MACHINE_RECT.v0, MACHINE_RECT.v1)) return false;
    for (const dr of Object.values(doors)) {                                     // never over a doorway
      if (dr.wall === d.wall && overlap1(u - d.hw, u + d.hw, dr.u - DOOR.w / 2, dr.u + DOOR.w / 2) && v - d.hh < DOOR.h) return false;
    }
    for (const o of obstacles) {
      if (!W.near(o.x0, o.x1, o.z0, o.z1)) continue;
      const [a, b] = W.span(o.x0, o.x1, o.z0, o.z1);
      if (overlap1(u - d.hw, u + d.hw, a, b) && v - d.hh < o.h) return false;
    }
    return true;
  };

  // Nearest free place on its wall to where the piece used to hang.
  const findWallSpot = (d) => {
    const W = WALL[d.wall], cands = [];
    for (let u = W.lo; u <= W.hi; u += 0.1) for (let v = 0.6; v <= 2.7; v += 0.1) cands.push({ u, v });
    cands.sort((a, b) => Math.hypot(a.u - d.home.u, a.v - d.home.v) - Math.hypot(b.u - d.home.u, b.v - d.home.v));
    return cands.find((c) => decorFits(d, c.u, c.v)) || null;
  };

  const buildWindow = (g) => {
    const frame = mat(0xf0f0f0);
    box(1.8, 1.3, 0.05, frame, 0, 0, 0.025, g);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), new THREE.MeshBasicMaterial({ color: 0x8fc3ff }));
    sky.position.set(0, 0, 0.052);
    g.add(sky);
    box(0.04, 1.1, 0.02, frame, 0, 0, 0.06, g);          // the cross bars
    box(1.6, 0.04, 0.02, frame, 0, 0, 0.06, g);
    box(1.9, 0.05, 0.12, frame, 0, -0.67, 0.06, g);       // sill
  };
  const buildPicture = (g) => {
    box(1.0, 0.7, 0.04, mat(0x2b2b2b), 0, 0, 0.02, g);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.58), new THREE.MeshBasicMaterial({ color: 0xe86a4a }));
    art.position.set(0, 0, 0.041);
    g.add(art);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: 0xffe28a }));
    sun.position.set(0.15, 0.08, 0.042);
    g.add(sun);
  };
  const buildRug = (g) => {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), mat(0x7a2e3a, { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.01;
    rug.receiveShadow = true;
    g.add(rug);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.5, 48), mat(0xe8c872, { roughness: 1 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    g.add(ring);
  };
  // Rugs drawn on a canvas: `paint(ctx, w, h)` fills it; the plane lies `y` above the floor so overlapping rugs never fight.
  const buildCanvasRug = (w, h, y, paint) => (g) => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * 200); c.height = Math.round(h * 200);
    paint(c.getContext('2d'), c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.receiveShadow = true;
    g.add(m);
  };
  // Blue Woven Rug 2.4 x 1.6: a navy field, a cream border with a thin gold line, and a diamond in the middle
  const buildWovenRug = buildCanvasRug(2.4, 1.6, 0.016, (x, W, H) => {
    x.fillStyle = '#e9e0c9'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#2b4a7c'; x.fillRect(18, 18, W - 36, H - 36);
    x.strokeStyle = '#c9a24a'; x.lineWidth = 5; x.strokeRect(34, 34, W - 68, H - 68);
    x.fillStyle = '#8fb0d8';
    x.beginPath(); x.moveTo(W / 2, 62); x.lineTo(W / 2 + 150, H / 2); x.lineTo(W / 2, H - 62); x.lineTo(W / 2 - 150, H / 2); x.closePath(); x.fill();
    x.fillStyle = '#2b4a7c';
    x.beginPath(); x.moveTo(W / 2, 100); x.lineTo(W / 2 + 90, H / 2); x.lineTo(W / 2, H - 100); x.lineTo(W / 2 - 90, H / 2); x.closePath(); x.fill();
    x.fillStyle = '#e9e0c9';
    x.beginPath(); x.arc(W / 2, H / 2, 20, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#c9a24a' : '#8fb0d8'; x.fillRect(48 + i * ((W - 120) / 11), 46, 14, 12); x.fillRect(48 + i * ((W - 120) / 11), H - 58, 14, 12); }
  });
  // Striped Runner 0.8 x 2.6: long green and cream stripes with fringe at both ends
  const buildRunnerRug = buildCanvasRug(0.8, 2.6, 0.022, (x, W, H) => {
    x.fillStyle = '#f0e8d2'; x.fillRect(0, 0, W, H);
    const bands = ['#2f6b4f', '#f0e8d2', '#b5523b', '#f0e8d2', '#2f6b4f'];
    const bw = (W - 24) / bands.length;
    bands.forEach((col, i) => { x.fillStyle = col; x.fillRect(12 + i * bw, 20, bw, H - 40); });
    x.fillStyle = '#d9b44a';
    for (let y = 60; y < H - 60; y += 70) x.fillRect(12, y, W - 24, 6);
    x.strokeStyle = '#f0e8d2'; x.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const fx = 14 + i * ((W - 28) / 13); x.beginPath(); x.moveTo(fx, 20); x.lineTo(fx, 4); x.moveTo(fx, H - 20); x.lineTo(fx, H - 4); x.stroke(); }
  });

  // Wall pictures drawn on a canvas inside a frame. w, h = the artwork; the frame adds a little all round.
  const buildArt = (w, h, frameCol, paint) => (g) => {
    const f = 0.045;
    box(w + f * 2, h + f * 2, 0.04, mat(frameCol), 0, 0, 0.02, g);
    const c = document.createElement('canvas');
    c.width = Math.round(w * 400); c.height = Math.round(h * 400);
    paint(c.getContext('2d'), c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    art.position.z = 0.0415;
    g.add(art);
  };
  // "Mountain Dusk": a dusk sky, three ranges of hills and a lake that holds the sun's reflection (0.9 x 0.6)
  const buildMountainArt = buildArt(0.9, 0.6, 0x6b4a2f, (x, W, H) => {
    const sky = x.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#3b4a8c'); sky.addColorStop(0.6, '#e08a6a'); sky.addColorStop(1, '#f7c97a');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fbe9b0'; x.beginPath(); x.arc(W * 0.7, H * 0.46, H * 0.09, 0, Math.PI * 2); x.fill();
    const range = (col, base, peaks) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, H * 0.66); peaks.forEach(([px, py]) => x.lineTo(W * px, H * (base - py))); x.lineTo(W, H * 0.66); x.closePath(); x.fill(); };
    range('#6a5a8a', 0.66, [[0.1, 0.2], [0.28, 0.34], [0.46, 0.18], [0.7, 0.3], [0.9, 0.16]]);
    range('#4a3f6e', 0.66, [[0.0, 0.1], [0.2, 0.18], [0.4, 0.08], [0.6, 0.2], [0.8, 0.1], [1.0, 0.18]]);
    range('#2c2748', 0.66, [[0.05, 0.05], [0.3, 0.1], [0.55, 0.04], [0.85, 0.09]]);
    x.fillStyle = '#35507a'; x.fillRect(0, H * 0.66, W, H * 0.34);
    x.fillStyle = 'rgba(251,233,176,0.55)'; for (let i = 0; i < 7; i++) x.fillRect(W * 0.7 - 40 + i * 4, H * 0.7 + i * 14, 80 - i * 8, 5);
  });
  // "Bright Shapes": flat blocks of colour (0.6 x 0.6)
  const buildAbstractArt = buildArt(0.6, 0.6, 0xf2f0ea, (x, W, H) => {
    x.fillStyle = '#f4ecd8'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e4572e'; x.beginPath(); x.arc(W * 0.34, H * 0.36, W * 0.22, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#17a2a2'; x.fillRect(W * 0.52, H * 0.12, W * 0.34, H * 0.4);
    x.fillStyle = '#f2b134'; x.beginPath(); x.arc(W * 0.62, H * 0.86, W * 0.26, Math.PI, 0); x.fill();
    x.fillStyle = '#26323a'; x.fillRect(W * 0.08, H * 0.7, W * 0.3, H * 0.07);
    x.strokeStyle = '#26323a'; x.lineWidth = 4; x.beginPath(); x.moveTo(W * 0.5, H * 0.02); x.lineTo(W * 0.5, H * 0.98); x.stroke();
  });
  // "Moon Over the Hill": a big pale moon, stars, a hill and a lit window (0.5 x 0.7)
  const buildMoonArt = buildArt(0.5, 0.7, 0x1c1c22, (x, W, H) => {
    const sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0d1b3d'); sky.addColorStop(1, '#2b3f7a');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff6d6'; for (let i = 0; i < 40; i++) { const sx = (i * 73 % 100) / 100 * W, sy = (i * 37 % 60) / 100 * H; x.fillRect(sx, sy, 2, 2); }
    x.fillStyle = '#f4efd0'; x.beginPath(); x.arc(W * 0.55, H * 0.3, W * 0.24, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#0d1b3d'; x.beginPath(); x.arc(W * 0.64, H * 0.27, W * 0.2, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#10182c'; x.beginPath(); x.moveTo(0, H); x.lineTo(0, H * 0.76); x.quadraticCurveTo(W * 0.5, H * 0.6, W, H * 0.8); x.lineTo(W, H); x.fill();
    x.fillStyle = '#080c18'; x.fillRect(W * 0.3, H * 0.74, W * 0.2, H * 0.1);
    x.fillStyle = '#ffd66b'; x.fillRect(W * 0.36, H * 0.77, W * 0.05, H * 0.04);
  });

  // A wall light: the glow follows the floor lamp (on / off, and its colour in a light show). No real light source (kept cheap for phones).
  const sconceFollowers = [];
  const buildSconce = (g) => {
    const brass = mat(0xb08d4a, { roughness: 0.35, metalness: 0.7 });
    box(0.1, 0.22, 0.03, brass, 0, 0, 0.015, g);
    box(0.03, 0.03, 0.1, brass, 0, -0.04, 0.08, g);
    const shadeMat2 = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd88a, emissiveIntensity: 0.9, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 20, 1, true), shadeMat2);
    shade.position.set(0, 0.04, 0.12);
    g.add(shade);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0xffd9a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), glowMat);
    glow.position.set(0, 0.04, 0.035);
    g.add(glow);
    sconceFollowers.push((on, color) => {
      shadeMat2.emissiveIntensity = on ? 0.9 : 0;
      shadeMat2.emissive.copy(color);
      glowMat.opacity = on ? 0.5 : 0;
      glowMat.color.copy(color);
    });
    lampState.apply();
  };
  lampState.followers = sconceFollowers;

  makeDecor('rug', 'rug', { hx: 1.8, hz: 1.8, u: 0, v: 0.4 }, buildRug);
  makeDecor('window', 'window', { wall: 'left', hw: 0.95, hh: 0.7, u: 0.2, v: 1.8 }, buildWindow);
  makeDecor('picture', 'picture', { wall: 'back', hw: 0.5, hh: 0.35, u: 0.2, v: 1.9 }, buildPicture);
  const DECOR_NEW = {              // decor that starts out of the room and can be added from the Catalogue
    window2: () => makeDecor('window2', 'second window', { wall: 'back', hw: 0.95, hh: 0.7, u: 2.6, v: 1.9 }, buildWindow),
    art_mountains: () => makeDecor('art_mountains', 'mountain picture', { wall: 'left', hw: 0.5, hh: 0.345, u: 2.7, v: 1.9 }, buildMountainArt),
    art_abstract: () => makeDecor('art_abstract', 'abstract picture', { wall: 'back', hw: 0.345, hh: 0.345, u: -3.6, v: 2.1 }, buildAbstractArt),
    art_moon: () => makeDecor('art_moon', 'moon picture', { wall: 'left', hw: 0.295, hh: 0.395, u: -3.35, v: 1.9 }, buildMoonArt),
    sconce: () => makeDecor('sconce', 'wall light', { wall: 'back', hw: 0.12, hh: 0.14, u: -1.0, v: 1.9 }, buildSconce),
    rug2: () => makeDecor('rug2', 'woven rug', { hx: 1.2, hz: 0.8, u: -3.0, v: 2.4 }, buildWovenRug),
    rug3: () => makeDecor('rug3', 'striped runner', { hx: 0.4, hz: 1.3, u: 2.7, v: 0.1 }, buildRunnerRug),
  };

  // ---- Ball ----
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), mat(0xe8453c, { roughness: 0.4 }));
  ball.castShadow = true;
  ball.position.set(1.4, 0.18, 1.6);
  ball.userData = { vel: new THREE.Vector3(), r: 0.18 };
  scene.add(ball);

  // ---- Catalogue: fixed to the left wall. Tapping it opens the catalogue of objects and books. ----
  const machine = new THREE.Group();
  {
    const bodyMat = mat(0x232a36, { roughness: 0.45, metalness: 0.5 });
    const trim = mat(0x8fa3b8, { roughness: 0.3, metalness: 0.7 });
    box(0.13, 0.98, 0.72, bodyMat, 0, 0, 0, machine);
    box(0.02, 0.1, 0.5, trim, 0.0, 0.5, 0, machine);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 192;
    const g2 = c.getContext('2d');
    const grad = g2.createLinearGradient(0, 0, 0, 192);
    grad.addColorStop(0, '#0e3d5a'); grad.addColorStop(1, '#0b2236');
    g2.fillStyle = grad; g2.fillRect(0, 0, 256, 192);
    g2.strokeStyle = '#46d6ff'; g2.lineWidth = 4; g2.strokeRect(6, 6, 244, 180);
    g2.fillStyle = '#9fe9ff'; g2.font = 'bold 34px sans-serif'; g2.textAlign = 'center';
    g2.fillText('CATALOGUE', 128, 82);
    g2.font = '18px sans-serif'; g2.fillStyle = '#6fbfd6'; g2.fillText('tap to browse', 128, 150);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const screenMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.4 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.375), screenMat);
    screen.position.set(0.0, 0.1, 0);
    screen.rotation.y = Math.PI / 2;
    screen.position.x = 0.0665;
    machine.add(screen);
    box(0.03, 0.05, 0.3, mat(0x05080c), 0.07, -0.2, 0, machine);                 // coin slot
    const lights = [0xff4455, 0x44ff88, 0x44aaff].map((col, i) => {
      const m = new THREE.MeshBasicMaterial({ color: col });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), m);
      l.position.set(0.07, -0.34, -0.15 + i * 0.15);
      machine.add(l);
      return m;
    });
    const gear = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffb133, emissive: 0xff8800, emissiveIntensity: 0.6 }));
    gear.rotation.y = Math.PI / 2;
    gear.position.set(0.09, 0.66, 0);
    machine.add(gear);
    machine.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    machine.position.set(-ROOM.w / 2 + 0.065, 1.5, -2.3);
    room.add(machine);
    machine.userData.update = (t) => {
      gear.rotation.x = t * 0.9;
      screenMat.emissiveIntensity = 0.8 + 0.15 * Math.sin(t * 2.2);
      lights.forEach((m, i) => m.color.setHSL([0.0, 0.38, 0.58][i], 1, 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * (2 + i) + i))));
    };
  }

  // Lighting
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x6b5a48, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(-3, 5, 4);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 15 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  // Acoustic guitar standing on a stand. `obj.guitar` is the instrument itself (neck along its local +x, soundboard facing +z)
  // so Guy can lift it off; `obj.rest` is where it sits on the stand.
  const buildGuitar = (x = 0, z = 0, name = 'guitar', electric = false) => {
    const wood = mat(electric ? 0xb02a2a : 0xb5772f, { roughness: 0.45 }), dark = mat(0x1b120a, { roughness: 0.6 }), metal = mat(0x2a2a2a, { roughness: 0.4 });
    let gtr = null;
    const obj = makeObject(name, x, z, 0.5, 0.45, 1.05, 'light', (g) => {
      box(0.5, 0.03, 0.05, metal, 0, 0.015, 0.0, g);                     // base bar
      box(0.03, 0.03, 0.4, metal, -0.2, 0.015, 0.0, g);                   // feet
      box(0.03, 0.03, 0.4, metal, 0.2, 0.015, 0.0, g);
      box(0.025, 0.4, 0.025, metal, -0.1, 0.22, -0.02, g);               // uprights
      box(0.025, 0.4, 0.025, metal, 0.1, 0.22, -0.02, g);
      box(0.3, 0.03, 0.04, metal, 0, 0.42, 0.03, g);                      // cradle
      gtr = new THREE.Group();
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.09, 28), wood);
      lower.rotation.x = Math.PI / 2; lower.position.x = -0.09;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 28), wood);
      upper.rotation.x = Math.PI / 2; upper.position.x = 0.1;
      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.09), wood);
      waist.position.x = 0.0;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.048, 24), dark);
      hole.position.set(0.0, 0, 0.0455);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.012), dark);
      bridge.position.set(-0.1, 0, 0.05);
      if (electric) {                                                  // a solid body (red, with a horn and two pickups) instead of the hollow acoustic one
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.045), wood); body.position.set(-0.02, 0, 0);
        const horn = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.045), wood); horn.position.set(0.15, 0.17, 0);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.01), dark); guard.position.set(-0.04, -0.02, 0.026);
        const pick1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.014), metal); pick1.position.set(0.06, 0, 0.034);
        const pick2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.014), metal); pick2.position.set(-0.04, 0, 0.034);
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12), metal); knob.rotation.x = Math.PI / 2; knob.position.set(-0.15, -0.08, 0.04);
        gtr.add(body, horn, guard, pick1, pick2, knob, bridge);
      } else gtr.add(lower, upper, waist, hole, bridge);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.045, 0.026), wood);
      neck.position.set(0.45, 0, 0.0);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.01), dark);
      board.position.set(0.4, 0, 0.017);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.062, 0.022), dark);
      head.position.set(0.83, 0, 0.0);
      gtr.add(neck, board, head);
      for (let i = 0; i < 6; i++) {
        const str = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.0016, 0.0016), mat(0xd8d8d8, { roughness: 0.3 }));
        str.position.set(0.33, -0.0125 + i * 0.005, 0.031);
        gtr.add(str);
      }
      gtr.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      gtr.rotation.z = Math.PI / 2 + 0.06;            // neck up, leaning slightly back on the stand
      gtr.position.set(0.0, 0.62, 0.07);
      g.add(gtr);
    });
    obj.guitar = gtr;
    obj.rest = { pos: gtr.position.clone(), quat: gtr.quaternion.clone() };
    if (electric) obj.electric = true;
    return obj;
  };

  // ---- Drum kit: the kit faces local -z and the stool is at +z, so the drummer sits at the +z end looking at the kit. ----
  // obj.pads: local positions of every playing surface (x < 0 is the drummer's left). obj.seat: stool position.
  const buildDrums = (x = 0, z = 0) => {
    const shell = mat(0xb02a2a, { roughness: 0.35 }), chrome = mat(0xbfc3c8, { roughness: 0.25, metalness: 0.8 });
    const skin = mat(0xf2efe6, { roughness: 0.6 }), brass = mat(0xd4a935, { roughness: 0.3, metalness: 0.8 }), seatMat = mat(0x1d1d1d);
    const pads = {};
    const obj = makeObject('drums', x, z, 1.4, 1.5, 1.35, 'medium', (g) => {
      const cyl = (r, h, m, px, py, pz, rx = 0, rz = 0) => {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), m);
        c.position.set(px, py, pz); c.rotation.set(rx, 0, rz); c.castShadow = c.receiveShadow = true; g.add(c); return c;
      };
      const pole = (px, py0, py1, pz) => cyl(0.012, py1 - py0, chrome, px, (py0 + py1) / 2, pz);
      const drum = (name, px, py, pz, r, h) => {
        cyl(r, h, shell, px, py, pz);
        cyl(r * 0.97, 0.014, skin, px, py + h / 2 + 0.005, pz);
        pads[name] = { x: px, y: py + h / 2 + 0.012, z: pz };
      };
      cyl(0.27, 0.34, shell, 0, 0.29, -0.42, Math.PI / 2);                    // kick drum, axis along z
      cyl(0.265, 0.01, skin, 0, 0.29, -0.245, Math.PI / 2);
      box(0.1, 0.012, 0.2, chrome, 0.26, 0.006, -0.03, g);                      // kick pedal plate, under his right foot
      pads.kick = { x: 0.26, y: 0.05, z: -0.03 };
      const rod = (a, b) => {                                                    // a thin linkage between two points
        const dv = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, dv.length(), 8), chrome);
        m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize());
        g.add(m);
      };
      rod([0.26, 0.02, -0.12], [0.02, 0.1, -0.26]);
      drum('snare', 0, 0.7, -0.1, 0.17, 0.12);  pole(0, 0.0, 0.64, -0.1);
      drum('tom1', -0.17, 0.74, -0.32, 0.14, 0.14); drum('tom2', 0.17, 0.74, -0.32, 0.15, 0.14);
      drum('floor', 0.5, 0.5, -0.12, 0.22, 0.34);
      for (const a of [0.3, 2.4, 4.5]) pole(0.5 + Math.cos(a) * 0.2, 0, 0.5, -0.12 + Math.sin(a) * 0.2);
      // hi-hat (two cymbals on a stand) on the drummer's left
      cyl(0.17, 0.014, brass, -0.42, 0.775, -0.1); cyl(0.17, 0.014, brass, -0.42, 0.79, -0.1);
      pole(-0.42, 0, 0.77, -0.1); box(0.1, 0.012, 0.2, chrome, -0.26, 0.006, -0.03, g);   // hi-hat pedal, under his left foot
      rod([-0.26, 0.02, -0.12], [-0.42, 0.1, -0.1]);
      pads.hat = { x: -0.42, y: 0.802, z: -0.1 };
      // crash (left, high) and ride (right, high)
      cyl(0.22, 0.012, brass, -0.46, 1.04, -0.26, 0.12, 0.08); pole(-0.46, 0, 1.03, -0.26);
      pads.crash = { x: -0.46, y: 1.055, z: -0.26 };
      cyl(0.26, 0.012, brass, 0.58, 0.98, -0.36, 0.08, -0.06); pole(0.58, 0, 0.97, -0.36);
      pads.ride = { x: 0.58, y: 0.99, z: -0.36 };
      // stool
      cyl(0.17, 0.06, seatMat, 0, 0.47, 0.42);
      for (const a of [0.5, 2.6, 4.7]) cyl(0.012, 0.46, chrome, Math.cos(a) * 0.14, 0.23, 0.42 + Math.sin(a) * 0.14, 0, Math.cos(a) * 0.1);
    });
    obj.pads = pads;
    obj.seat = { x: 0, z: 0.42 };
    return obj;
  };

  // ---- Easel: the canvas faces +z (the painter stands at +z). obj.paint draws on the real canvas texture. ----
  const buildEasel = (x = 0, z = 0) => {
    const wood = mat(0x9a6b3d, { roughness: 0.7 });
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 320;
    const cx = cv.getContext('2d');
    const clear = () => { cx.fillStyle = '#f6f3ea'; cx.fillRect(0, 0, 256, 320); tex.needsUpdate = true; };
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    let obj;
    obj = makeObject('easel', x, z, 0.75, 0.8, 1.75, 'light', (g) => {
      box(0.05, 1.7, 0.05, wood, -0.3, 0.85, -0.02, g);
      box(0.05, 1.7, 0.05, wood, 0.3, 0.85, -0.02, g);
      const back = box(0.05, 1.6, 0.05, wood, 0, 0.78, -0.45, g);
      back.rotation.x = 0.3;
      box(0.7, 0.05, 0.05, wood, 0, 0.62, 0.02, g);                          // tray
      box(0.7, 0.04, 0.1, wood, 0, 0.6, 0.08, g);
      for (const [px, col] of [[-0.22, 0xd0312d], [-0.08, 0x2a62d8], [0.06, 0xf2c500], [0.2, 0x2e9e4a]]) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 12), mat(col));
        tube.rotation.z = Math.PI / 2; tube.position.set(px, 0.64, 0.1); g.add(tube);
      }
      const side = mat(0xf6f3ea);
      const mats = [side, side, side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), side];
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.02), mats);
      board.position.set(0, 1.15, 0.03);
      board.castShadow = true;
      g.add(board);
    });
    clear();
    const W = 0.5, H = 0.65;
    obj.paint = {
      clear,
      point: (u, v) => ({ x: (u - 0.5) * W, y: 1.15 + (0.5 - v) * H, z: 0.045 }),   // canvas (u,v in 0..1) -> easel-local point
      stroke(u0, v0, u1, v1, color, width = 5) {
        cx.strokeStyle = color; cx.lineWidth = width; cx.lineCap = 'round';
        cx.beginPath(); cx.moveTo(u0 * 256, v0 * 320); cx.lineTo(u1 * 256, v1 * 320); cx.stroke(); tex.needsUpdate = true;
      },
      dab(u, v, color, r = 7) { cx.fillStyle = color; cx.beginPath(); cx.arc(u * 256, v * 320, r, 0, Math.PI * 2); cx.fill(); tex.needsUpdate = true; },
      canvas: cv,
      // put a saved picture back on the canvas (src/paintings.js)
      draw(img) { cx.drawImage(img, 0, 0, 256, 320); tex.needsUpdate = true; },
      ver: 0,                                                                       // counts changes to the canvas, so the picture is saved only when it changed
    };
    for (const k of ['clear', 'stroke', 'dab', 'draw']) { const f = obj.paint[k]; obj.paint[k] = (...a) => { obj.paint.ver++; return f(...a); }; }
    return obj;
  };

  // ---- Telescope: tripod + a tube that can be aimed (obj.setAim). Eyepiece at the rear, focus knob beside it. ----
  const buildTelescope = (x = 0, z = 0) => {
    const white = mat(0xe9edf2, { roughness: 0.35 }), black = mat(0x16181c, { roughness: 0.5 }), chrome = mat(0xbfc3c8, { roughness: 0.25, metalness: 0.8 });
    let tube = null;
    const obj = makeObject('telescope', x, z, 0.8, 0.8, 1.6, 'light', (g) => {
      for (const a of [0.4, 2.5, 4.6]) {                                      // tripod legs
        const top = new THREE.Vector3(0, 1.44, 0), foot = new THREE.Vector3(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, top.distanceTo(foot), 10), black);
        const mid = top.clone().add(foot).multiplyScalar(0.5);
        leg.position.copy(mid);
        leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
        leg.castShadow = true; g.add(leg);
      }
      box(0.12, 0.08, 0.12, chrome, 0, 1.44, 0, g);                            // mount
      tube = new THREE.Group();
      tube.position.set(0, 1.52, 0);
      tube.rotation.order = 'YXZ';
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 20), white);
      body.rotation.x = Math.PI / 2; body.castShadow = true; tube.add(body);
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 20), white);
      shield.rotation.x = Math.PI / 2; shield.position.z = 0.5; tube.add(shield);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.058, 20), new THREE.MeshStandardMaterial({ color: 0x3a6fb0, metalness: 0.6, roughness: 0.1 }));
      lens.position.z = 0.601; tube.add(lens);
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 12), black);
      eye.rotation.x = Math.PI / 2; eye.position.set(0, 0, -0.52); tube.add(eye);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), chrome);
      knob.rotation.z = Math.PI / 2; knob.position.set(0.08, 0, -0.33); tube.add(knob);
      g.add(tube);
    });
    obj.tube = tube;
    obj.legAngles = [0.4, 2.5, 4.6];
    obj.legPoint = (i, f) => obj.group.localToWorld(new THREE.Vector3(Math.cos(obj.legAngles[i]) * 0.36 * f, 1.44 * (1 - f), Math.sin(obj.legAngles[i]) * 0.36 * f));   // f = 0 at the mount .. 1 at the foot
    // aim: yaw (0 = along local +z) and pitch up; the default points at the window on the left wall
    obj.setAim = (yaw, pitch) => { tube.rotation.y = yaw; tube.rotation.x = -pitch; obj.aim = { yaw, pitch }; };
    obj.setAim(-Math.PI / 2, 0.25);
    // world points on the tube (valid after updateMatrixWorld)
    const P = (lx, ly, lz) => tube.localToWorld(new THREE.Vector3(lx, ly, lz));
    obj.eyepiece = () => { tube.updateWorldMatrix(true, false); return P(0, 0, -0.58); };
    obj.focusKnob = () => { tube.updateWorldMatrix(true, false); return P(0.09, 0, -0.33); };
    obj.objective = () => { tube.updateWorldMatrix(true, false); return P(0, 0, 0.62); };
    obj.tubePoint = (f) => { tube.updateWorldMatrix(true, false); return P(0.07, 0.0, -0.45 + f * 1.05); };   // f = 0 rear .. 1 front
    return obj;
  };

  // ---- Decor furniture and plants (added from the Catalogue under Decor) ----
  // Flowering plant: a cream pot, green leaves and a crown of pink, yellow and white blooms
  const buildFlowerPlant = (x = 0, z = 0) => makeObject('flowerplant', x, z, 0.5, 0.5, 0.95, 'light', (g) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 16), mat(0xe2d3b3));
    pot.position.y = 0.16; pot.castShadow = true; g.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 20), mat(0xe2d3b3));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.32; g.add(rim);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(0x3f8f4a));
      leaf.scale.set(0.5, 1.3, 0.25);
      leaf.position.set(Math.cos(i * 1.1) * 0.12, 0.5, Math.sin(i * 1.1) * 0.12);
      leaf.rotation.set(Math.sin(i * 2) * 0.6, i, Math.cos(i * 2) * 0.6);
      leaf.castShadow = true; g.add(leaf);
    }
    const blooms = [0xff6f91, 0xffd166, 0xfdfdfd, 0xff6f91, 0xffd166, 0xff9ec4, 0xfdfdfd, 0xffd166, 0xff6f91];
    blooms.forEach((col, i) => {
      const a = i * 2.4, r = 0.05 + (i % 3) * 0.06, y = 0.7 + (i % 4) * 0.06;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, y - 0.32, 5), mat(0x2f7d3a));
      stem.position.set(Math.cos(a) * r * 0.6, (y + 0.32) / 2, Math.sin(a) * r * 0.6); g.add(stem);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(col, { roughness: 0.6 }));
      bloom.position.set(Math.cos(a) * r, y, Math.sin(a) * r); bloom.castShadow = true; g.add(bloom);
    });
  });

  // Indoor tree: a big grey planter, a slim trunk and a canopy of overlapping leaf balls (heavy: only you can move it)
  const buildTree = (x = 0, z = 0) => makeObject('tree', x, z, 0.9, 0.9, 2.4, 'heavy', (g) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.42, 20), mat(0x4a4a52, { roughness: 0.6 }));
    pot.position.y = 0.21; pot.castShadow = true; g.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 20), mat(0x3b2a1c));
    soil.position.y = 0.42; g.add(soil);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.5, 10), mat(0x6b4a2f));
    trunk.position.y = 1.15; trunk.castShadow = true; g.add(trunk);
    for (const [px, py, pz, r, col] of [[0, 2.0, 0, 0.46, 0x2f7d3a], [0.25, 1.7, 0.1, 0.34, 0x3b9147], [-0.25, 1.75, -0.1, 0.34, 0x2a6e34], [0.05, 1.5, -0.25, 0.28, 0x3b9147], [-0.1, 1.55, 0.25, 0.28, 0x2f7d3a], [0.1, 2.3, 0.05, 0.28, 0x3b9147]]) {
      const leafBall = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(col, { roughness: 0.9 }));
      leafBall.position.set(px, py, pz); leafBall.castShadow = true; g.add(leafBall);
    }
  });

  // Coffee table: a low walnut top on four legs with a shelf and two books on it
  const buildCoffeeTable = (x = 0, z = 0) => makeObject('coffeetable', x, z, 1.1, 0.6, 0.5, 'medium', (g) => {
    const wood = mat(0x7a4f2e), dark = mat(0x2e2218);
    box(1.1, 0.05, 0.6, wood, 0, 0.42, 0, g);
    for (const dx of [-0.5, 0.5]) for (const dz of [-0.25, 0.25]) box(0.05, 0.4, 0.05, dark, dx, 0.2, dz, g);
    box(0.95, 0.025, 0.45, wood, 0, 0.14, 0, g);
    box(0.3, 0.04, 0.22, mat(0x2d6a9f), -0.2, 0.465, 0.05, g);
    box(0.26, 0.035, 0.2, mat(0xc0392b), -0.2, 0.5, 0.05, g);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.07, 14), mat(0xf5f2ea));
    cup.position.set(0.25, 0.485, -0.05); cup.castShadow = true; g.add(cup);
  });

  // Nightstand: a little cabinet with a drawer, a knob and a clock on top
  const buildNightstand = (x = 0, z = 0) => makeObject('nightstand', x, z, 0.5, 0.4, 0.6, 'light', (g) => {
    const wood = mat(0x9a6b3d), dark = mat(0x3a2a1c);
    box(0.5, 0.5, 0.4, wood, 0, 0.3, 0, g);
    box(0.44, 0.17, 0.02, mat(0xb07c4a), 0, 0.42, 0.205, g);
    box(0.44, 0.17, 0.02, mat(0xb07c4a), 0, 0.2, 0.205, g);
    for (const y of [0.42, 0.2]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), dark); k.position.set(0, y, 0.225); g.add(k); }
    box(0.5, 0.03, 0.4, dark, 0, 0.565, 0, g);
    box(0.1, 0.07, 0.04, mat(0x222831), 0.12, 0.615, 0, g);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), new THREE.MeshBasicMaterial({ color: 0xff5555 }));
    face.position.set(0.12, 0.615, 0.021); g.add(face);
  });

  // ---- Workshop furniture (src/workobjects.js). It is placed in the added room's own frame: `n` metres in from the door wall and
  // `lat` along the wall from the middle of the room, facing the door or across the room. See shopSpot below.
  const work = makeWorkshopBuilders({ makeObject, box, mat });
  const SHOP_LAYOUT = {
    workbench: (N, L) => ({ n: N - 0.6, lat: 0, face: 'door' }),
    toolbox: (N, L) => ({ n: N - 0.45, lat: 1.7, face: 'door' }),
    woodfactory: (N, L) => ({ n: N * 0.25, lat: L / 2 - 0.7, face: 'minusLat' }),
    sander: (N, L) => ({ n: N * 0.575, lat: L / 2 - 0.6, face: 'minusLat' }),
    saw: (N, L) => ({ n: N * 0.25, lat: -(L / 2 - 0.65), face: 'plusLat' }),
    mallet: (N, L) => ({ n: N * 0.575, lat: -(L / 2 - 0.7), face: 'plusLat' }),
    // the metal line: the factory and the cutter on the far wall left of the workbench, the welder and the anvil between the wood stations
    // (these two are placed exactly: the far wall is full, and findSpot keeps a new thing a metre from the walls and from its neighbours)
    metalfactory: (N, L) => ({ n: N - 0.98, lat: -(L / 2 - 1.05), face: 'door', exact: true }),
    metalcutter: (N, L) => ({ n: N - 0.83, lat: -(L / 2 - 1.05) + 1.075, face: 'door', exact: true }),
    welder: (N, L) => ({ n: N * 0.4, lat: L / 2 - 0.8, face: 'minusLat' }),
    anvil: (N, L) => ({ n: N * 0.4, lat: -(L / 2 - 0.8), face: 'plusLat' }),
  };
  const shopSpot = (id) => (w) => {
    if (!w.doors.workshop) return null;
    const { n: N, l: L } = w.shellSize('workshop'), ax = w.shellAxes('workshop');
    const s = SHOP_LAYOUT[id](N, L), p = w.shellPoint('workshop', s.n, s.lat);
    const face = s.face === 'door' ? ax.toDoor : s.face === 'minusLat' ? ax.lat.clone().negate() : ax.lat;
    return { x: p.x, z: p.z, rot: w.rotFacing(face.x, face.z), exact: !!s.exact };
  };

  // ---- Things Guy builds (see src/workshop.js). They are counted in storage (`world.stock.items`) and added to the room from the
  // Catalogue one at a time, so there can be many of one kind: each is its own object named `<kind>_<n>` with `kind` set.
  const buildFootStool = (name, x = 0, z = 0) => makeObject(name, x, z, 0.44, 0.36, 0.34, 'light', (g) => {
    const light = mat(0xe3c08a), wood = mat(0xc89b62);
    box(0.42, 0.04, 0.34, light, 0, 0.3, 0, g);
    for (const sx of [-0.17, 0.17]) for (const sz of [-0.12, 0.12]) box(0.045, 0.28, 0.045, wood, sx, 0.14, sz, g);
    box(0.34, 0.025, 0.03, wood, 0, 0.12, 0.12, g); box(0.34, 0.025, 0.03, wood, 0, 0.12, -0.12, g);
  });
  const buildWoodShelves = (name, x = 0, z = 0) => makeObject(name, x, z, 0.9, 0.36, 1.35, 'medium', (g) => {
    const light = mat(0xe3c08a), wood = mat(0xc89b62);
    for (const sx of [-0.43, 0.43]) box(0.04, 1.35, 0.34, wood, sx, 0.675, 0, g);
    box(0.9, 1.35, 0.02, mat(0xb98a55), 0, 0.675, -0.17, g);
    for (const y of [0.04, 0.4, 0.76, 1.12, 1.34]) box(0.86, 0.03, 0.34, light, 0, y, 0, g);
    for (const [x2, y, c] of [[-0.25, 0.44, 0xd9534f], [-0.2, 0.44, 0x4a90d9], [0.2, 0.8, 0x6bbf59], [0.3, 0.8, 0xe9c46a]]) box(0.06, 0.2, 0.16, mat(c), x2, y + 0.1, 0.0, g);
  });
  const buildBookshelf2 = (name, x = 0, z = 0) => makeObject(name, x, z, 0.5, 1.9, 2.2, 'medium', (g) => {
    const m = mat(0xa87a4a);
    box(0.4, 2.2, 0.05, m, 0, 1.1, -0.9, g);
    box(0.4, 2.2, 0.05, m, 0, 1.1, 0.9, g);
    box(0.05, 2.2, 1.8, m, 0.18, 1.1, 0, g);
    for (let i = 0; i <= 5; i++) box(0.4, 0.04, 1.8, m, 0, 0.02 + i * 0.43, 0, g);
  });
  const INSTANCE_KINDS = {
    eguitar: { build: (name, x, z) => buildGuitar(x, z, name, true), pref: { x: 2.2, z: -1.6 } },
    bookshelf2: { build: buildBookshelf2, pref: { x: 4.1, z: -2.2 } },
    // the foot stool stands in front of a window whose top is out of reach (the owner's rule: built where it is needed), right by the wall
    footstool: { build: buildFootStool, pref: () => {
      const d = Object.values(decor).find((x) => x.wall && /^window/.test(x.name) && x.v + x.hh > 2.1);
      if (!d) return { x: -3.4, z: -1.2 };
      return d.wall === 'back' ? { x: d.u, z: -ROOM.d / 2 + 0.55, exact: true } : { x: -ROOM.w / 2 + 0.55, z: d.u, exact: true };
    } },
    woodshelves: { build: buildWoodShelves, pref: { x: -4.2, z: 1.2 } },
    builtchair: { build: (name, x, z) => buildWoodenChair(name, x, z), pref: { x: -2.4, z: 2.6 } },
    metalchair: { build: (name, x, z) => buildWoodenChair(name, x, z, true), pref: { x: -2.9, z: 2.6 } },
  };
  // (the restaurant's extra tables are further instance kinds, added below once the restaurant's layout is known)

  // ---- Restaurant furniture (src/restobjects.js), placed the same way in the Restaurant's own frame
  const rest = makeRestaurantBuilders({ makeObject, box, mat });
  const bots = makeBotBuilders({ makeObject, box, mat });
  const REST_LAYOUT = {
    stove: (N, L) => ({ n: N - 0.5, lat: L / 2 - 0.8, face: 'door' }),
    kitchencounter: (N, L) => ({ n: N - 0.5, lat: L / 2 - 2.5, face: 'door' }),
    register: (N, L) => ({ n: 2.6, lat: -L / 2 + 1.7, face: 'plusLat' }),
    diningtable: (N, L) => ({ n: N * 0.5, lat: L * 0.14, face: 'door' }),
    diningtable2: (N, L) => ({ n: N * 0.5, lat: -L * 0.12, face: 'door' }),
    diningtable3: (N, L) => ({ n: N * 0.5, lat: L * 0.36, face: 'door' }),               // the tables Guy builds when the restaurant is full
    diningtable4: (N, L) => ({ n: N * 0.5, lat: -L * 0.34, face: 'door' }),
  };
  const restSpot = (id) => (w) => {
    if (!w.doors.restaurant) return null;
    const { n: N, l: L } = w.shellSize('restaurant'), ax = w.shellAxes('restaurant');
    const s = REST_LAYOUT[id](N, L), p = w.shellPoint('restaurant', s.n, s.lat);
    const face = s.face === 'door' ? ax.toDoor : s.face === 'minusLat' ? ax.lat.clone().negate() : ax.lat;
    return { x: p.x, z: p.z, rot: w.rotFacing(face.x, face.z) };
  };

  INSTANCE_KINDS.diningtable3 = { build: (name, x, z) => rest.diningtable(name, x, z), pref: (w) => restSpot('diningtable3')(w) };
  INSTANCE_KINDS.diningtable4 = { build: (name, x, z) => rest.diningtable(name, x, z, true), pref: (w) => restSpot('diningtable4')(w) };

  const NEW_OBJECTS = {            // object id -> [builder, preferred spot (or a function of the world that works it out)]
    botprinter: [bots.botprinter, { x: -3.5, z: 2.5 }],
    stove: [rest.stove, restSpot('stove')],
    kitchencounter: [rest.kitchencounter, restSpot('kitchencounter')],
    register: [rest.register, restSpot('register')],
    diningtable: [(x = 0, z = 0) => rest.diningtable('diningtable', x, z), restSpot('diningtable')],
    diningtable2: [(x = 0, z = 0) => rest.diningtable('diningtable2', x, z), restSpot('diningtable2')],
    workbench: [work.workbench, shopSpot('workbench')],
    toolbox: [work.toolbox, shopSpot('toolbox')],
    woodfactory: [work.woodfactory, shopSpot('woodfactory')],
    saw: [work.saw, shopSpot('saw')],
    mallet: [work.mallet, shopSpot('mallet')],
    sander: [work.sander, shopSpot('sander')],
    metalfactory: [work.metalfactory, shopSpot('metalfactory')],
    metalcutter: [work.metalcutter, shopSpot('metalcutter')],
    welder: [work.welder, shopSpot('welder')],
    anvil: [work.anvil, shopSpot('anvil')],
    armchair2: [(x = 0, z = 0) => buildArmchair('armchair2', x, z, 0x8a3b4a), { x: 1.7, z: 3.0 }],
    chair: [(x = 0, z = 0) => buildWoodenChair('chair', x, z), { x: -2.4, z: 3.0 }],
    chair2: [(x = 0, z = 0) => buildWoodenChair('chair2', x, z), { x: -3.2, z: 3.2 }],
    flowerplant: [buildFlowerPlant, { x: -4.3, z: -3.3 }],
    tree: [buildTree, { x: 4.3, z: -2.0 }],
    coffeetable: [buildCoffeeTable, { x: 3.2, z: 1.9 }],
    nightstand: [buildNightstand, { x: 4.4, z: 3.3 }],
    guitar: [buildGuitar, { x: 1.5, z: -1.5 }],
    drums: [buildDrums, { x: 1.4, z: -2.2 }],
    easel: [buildEasel, { x: -0.4, z: -2.8 }],
    telescope: [buildTelescope, { x: -3.5, z: 1.5 }],
  };

  const chairStands = () => Object.values(objects).filter((o) => o.sit).map((o) => [o.name, 0, o.sit.gap]);   // where he stands to sit down

  // Footprint (w x d, centred at x,z) inside the room and clear of every other object?
  const fits = (obj, x, z, w = obj.w, d = obj.d) => {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    if (!roomBoundsList().some((b) => x0 >= b.minX && x1 <= b.maxX && z0 >= b.minZ && z1 <= b.maxZ)) return false;      // wholly inside one room
    if (doorBlocks(x0, x1, z0, z1)) return false;                       // the strips either side of a door stay clear
    // furniture taller than the lower edge of a window or picture must not be pushed into it
    for (const dc of Object.values(decor)) {
      if (!dc.wall || !WALL[dc.wall].near(x0, x1, z0, z1)) continue;
      const [a, b] = WALL[dc.wall].span(x0, x1, z0, z1);
      if (overlap1(a, b, dc.u - dc.hw, dc.u + dc.hw) && obj.h > dc.v - dc.hh) return false;
    }
    return !obstacles.some((o) => o !== obj.obstacle && x1 > o.x0 && x0 < o.x1 && z1 > o.z0 && z0 < o.z1);
  };

  // What is in the way of a door at (wall, u)? `fixed` names something that never moves (the bookshelf, heavy furniture), so the
  // door cannot go there; otherwise `hit` lists the pieces that would have to come out of the room.
  const doorBlockers = (wall, u) => {
    const r = doorRect(wall, u), hit = [];
    for (const [name, o] of Object.entries(objects)) {
      const ob = o.obstacle;
      if (!rectsOverlap(r, { x0: ob.x0, x1: ob.x1, z0: ob.z0, z1: ob.z1 })) continue;
      if (o.removable === false || o.weight === 'heavy') return { fixed: name, hit: [] };
      hit.push(name);
    }
    if (obstacles.some((o) => o.name === 'bookstack' && rectsOverlap(r, o))) return { fixed: 'bookstack', hit: [] };   // the books stacked beside the shelf
    for (const d of Object.values(decor)) {
      if (d.wall === wall && overlap1(d.u - d.hw, d.u + d.hw, u - DOOR.w / 2, u + DOOR.w / 2) && d.v - d.hh < DOOR.h) hit.push(d.name);
    }
    return { fixed: null, hit };
  };
  const doorSpotFree = (wall, u) => !Object.values(doors).some((d) => rectsOverlap(d.rect, doorRect(wall, u)));

  // Where should the next door go? Fewest pieces to move first, then the wall order given, then nearest the middle of the wall.
  // The left wall holds the Catalogue and is never used.
  const planDoor = (walls = ['right', 'front', 'back']) => {
    let best = null;
    walls.forEach((wall, wi) => {
      const W = WALL[wall];
      if (!W || wall === 'left') return;
      if (Object.values(doors).some((d) => d.wall === wall)) return;                 // one added room to a wall: two would stand on the same ground
      const steps = Math.floor((W.hi - W.lo - 1.8) / 0.1 + 1e-6);
      for (let i = 0; i <= steps; i++) {
        const u = +(W.lo + 0.9 + i * 0.1).toFixed(2);
        if (!doorSpotFree(wall, u)) continue;
        const b = doorBlockers(wall, u);
        if (b.fixed) continue;
        const better = !best || b.hit.length < best.hit.length
          || (b.hit.length === best.hit.length && (wi < best.wi || (wi === best.wi && Math.abs(u) < Math.abs(best.u) - 1e-6)));
        if (better) best = { wall, u, hit: b.hit, wi };
      }
    });
    return best && { wall: best.wall, u: best.u, displace: best.hit };
  };

  // A closed door in a wooden frame with the room's name above it. Both faces are drawn: the right and front walls are not
  // drawn from the default camera, so the door is often seen from the other side.
  const buildDoor = (def, wall, u) => {
    const g = new THREE.Group();
    g.position.copy(WALL[wall].at(u, 0));
    g.rotation.y = WALL[wall].rotY;
    const frame = mat(def.look.frame), leaf = mat(def.look.door);
    const H = DOOR.h + 0.12;
    box(0.1, H, 0.14, frame, -0.55, H / 2, 0.07, g);
    box(0.1, H, 0.14, frame, 0.55, H / 2, 0.07, g);
    box(1.2, 0.12, 0.14, frame, 0, DOOR.h + 0.06, 0.07, g);
    // the leaf hangs from a hinge on the left post (local x = -0.5) and swings away from the room when the door opens
    const hinge = new THREE.Group();
    hinge.position.set(-0.5, 0, 0);
    g.add(hinge);
    g.userData.leaf = hinge;
    box(1.0, DOOR.h, 0.05, leaf, 0.5, DOOR.h / 2, 0.05, hinge);
    for (const z of [0.08, 0.02]) {
      box(0.7, 0.75, 0.01, mat(def.look.panel), 0.5, 1.55, z, hinge);
      box(0.7, 0.75, 0.01, mat(def.look.panel), 0.5, 0.6, z, hinge);
    }
    for (const z of [0.1, 0]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat(0xe8c050, { metalness: 0.6, roughness: 0.3 }));
      knob.position.set(0.86, 1.05, z);
      hinge.add(knob);
    }
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff6e0'; cx.fillRect(0, 0, 256, 64);
    cx.strokeStyle = '#6b4a2b'; cx.lineWidth = 6; cx.strokeRect(3, 3, 250, 58);
    cx.fillStyle = '#3a2a1c'; cx.font = 'bold 30px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(`${def.icon} ${def.name}`, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    for (const [z, ry] of [[0.145, 0], [-0.005, Math.PI]]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshBasicMaterial({ map: tex }));
      sign.position.set(0, DOOR.h + 0.3, z);
      sign.rotation.y = ry;
      g.add(sign);
    }
    return g;
  };

  // The room behind a door: a floor and three walls (the main room's own wall closes the fourth side) that open to the sky like
  // the main room. It sits just outside the door wall, kept within that wall's length. `bounds` is its footprint on the floor.
  // Every added room is as big as Guy's room (same floor area, same depth) unless its catalogue entry gives a `size` (depth away
  // from the door x width along the wall): a room that is cramped cannot hold what is built in it.
  const buildShell = (def, wall, u) => {
    const W = WALL[wall];
    const N = def.size ? def.size.w : (wall === 'right' ? ROOM.w : ROOM.d);          // away from the door wall
    const L = def.size ? def.size.d : W.hi - W.lo;                                    // along the door wall
    const c = Math.max(W.lo + L / 2, Math.min(W.hi - L / 2, u));
    const g = new THREE.Group();
    g.position.copy(W.at(c, 0));
    g.rotation.y = W.rotY;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, N), new THREE.MeshStandardMaterial({ color: def.look.floor, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.002, -N / 2);
    floor.receiveShadow = true;
    g.add(floor);
    const wm = new THREE.MeshStandardMaterial({ color: def.look.wall, roughness: 0.95 });
    const side = (len, x, z, ry) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(len, ROOM.h), wm);
      p.position.set(x, ROOM.h / 2, z);
      p.rotation.y = ry;
      p.receiveShadow = true;
      g.add(p);
    };
    side(L, 0, -N, 0);                       // the far wall, facing the door
    side(N, -L / 2, -N / 2, Math.PI / 2);
    side(N, L / 2, -N / 2, -Math.PI / 2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(L, N), mat(0xeeeeee));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, ROOM.h, -N / 2);
    g.add(ceil);
    const bounds = wall === 'right' ? { minX: ROOM.w / 2, maxX: ROOM.w / 2 + N, minZ: c - L / 2, maxZ: c + L / 2 }
      : wall === 'front' ? { minX: c - L / 2, maxX: c + L / 2, minZ: ROOM.d / 2, maxZ: ROOM.d / 2 + N }
        : { minX: c - L / 2, maxX: c + L / 2, minZ: -ROOM.d / 2 - N, maxZ: -ROOM.d / 2 };
    return { group: g, bounds, N, L };
  };

  // The three walls of an added room as places to hang things: `<id>:far` (facing the door) and `<id>:a`, `<id>:b` (the sides).
  const roomWalls = (id, shell) => {
    const g = shell.group, N = shell.N, L = shell.L;
    g.updateWorldMatrix(true, false);
    const P = (x, z) => g.localToWorld(V3(x, 0, z));
    const D = (x, z) => V3(x, 0, z).applyQuaternion(g.quaternion).normalize();
    return {
      [`${id}:far`]: makeWall(P(0, -N), D(0, 1), D(1, 0), -L / 2, L / 2),
      [`${id}:a`]: makeWall(P(-L / 2, -N / 2), D(1, 0), D(0, 1), -N / 2, N / 2),
      [`${id}:b`]: makeWall(P(L / 2, -N / 2), D(-1, 0), D(0, 1), -N / 2, N / 2),
    };
  };

  // The way from a wall into the room (the local +z of anything hung on it).
  const inwardOf = (wall) => new THREE.Vector3(Math.sin(WALL[wall].rotY), 0, Math.cos(WALL[wall].rotY));

  // A real doorway: the wall is left out and put back in three pieces (left of the door, right of it, and above it), so an open
  // door shows the way through and Guy can walk through it. Built in the door's own frame (local x along the wall).
  const buildDoorway = (wall, u) => {
    const W = WALL[wall], sgn = W.rotY === Math.PI ? -1 : 1;
    const g = new THREE.Group();
    g.position.copy(W.at(u, 0));
    g.rotation.y = W.rotY;
    const a = sgn > 0 ? W.lo - u : u - W.hi, b = sgn > 0 ? W.hi - u : u - W.lo;     // the ends of the wall, in the door's x
    const piece = (x0, x1, y0, y1) => {
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), wallMat);
      p.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      p.receiveShadow = true;
      g.add(p);
    };
    piece(a, -DOOR.w / 2, 0, ROOM.h);
    piece(DOOR.w / 2, b, 0, ROOM.h);
    piece(-DOOR.w / 2, DOOR.w / 2, DOOR.h, ROOM.h);
    return g;
  };

  const disposeTree = (g) => g.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material && n.material !== wallMat) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); }     // the wall material is shared with the room's own walls
  });

  const world = {
    room, obstacles, objects, fits, ballGone: false,
    piano: { group: pianoObj.group, keys }, boombox: { group: boombox, led }, lamp: lampState, ball,
    skillMachine: machine,
    removed: {},                  // objects (and decor) the user took out, kept so they can be put back
    decor, decorFits,
    // ---- Guy's paintings (src/paintings.js) ----
    // Every wall a painting can hang on: Guy's room (the two walls the camera sees) and the three walls of each added room.
    hangWalls: () => [{ key: 'left', room: 'main' }, { key: 'back', room: 'main' }, ...Object.keys(WALL).filter((k) => k.includes(':')).map((key) => ({ key, room: key.split(':')[0] }))],
    wallFrame: (key) => WALL[key] || null,
    PAINTING: { hw: 0.295, hh: 0.3575 },
    MACHINE_RECT,
    // A painting on a wall: the artwork is `source` (a canvas, 0.5 x 0.625 m) in a wooden frame. Its texture is `.tex` on the returned piece.
    addPainting(name, label, source, wall, u, v) {
      const art = (g) => {
        const f = 0.045, w = 0.5, h = 0.625;
        box(w + f * 2, h + f * 2, 0.04, mat(0x7a4f2a), 0, 0, 0.02, g);
        const tex = new THREE.CanvasTexture(source);
        tex.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
        m.position.z = 0.0415;
        g.add(m);
        g.userData.tex = tex;
      };
      const d = makeDecor(name, label, { wall, hw: 0.295, hh: 0.3575, u, v }, art);
      d.tex = d.group.userData.tex;
      return d;
    },
    // ---- doors and the rooms behind them (see src/rooms.js) ----
    doors, DOOR, planDoor, doorBlockers, findWallSpot,
    // Put a door for room `def` at (wall, u). The caller has already cleared whatever was in its way.
    addDoor(def, wall, u) {
      if (doors[def.id]) return doors[def.id];
      const group = buildDoor(def, wall, u), shell = buildShell(def, wall, u), cut = buildDoorway(wall, u);
      wallMeshes[wall].visible = false;                       // the wall is rebuilt round the doorway
      room.add(group);
      room.add(shell.group);
      room.add(cut);
      doors[def.id] = { id: def.id, name: def.name, wall, u, group, leaf: group.userData.leaf, shell, cut, rect: doorRect(wall, u), rectIn: doorRectIn(wall, u), open: 0, openTo: 0 };
      Object.assign(WALL, roomWalls(def.id, shell));           // its walls can hold wall pieces (Guy's paintings)
      if (def.elevator) {                                       // a room with an elevator (the Restaurant): a cabin against the far wall
        const b = shell.bounds, sgn = WALL[wall].rotY === Math.PI ? -1 : 1;
        const N = wall === 'right' ? b.maxX - b.minX : b.maxZ - b.minZ, Lw = wall === 'right' ? b.maxZ - b.minZ : b.maxX - b.minX;
        const lat = -Lw / 2 + 1.3;
        const cabin = rest.buildElevator();
        cabin.position.set(sgn * lat, 0, -N + 0.02);
        shell.group.add(cabin);
        shell.group.updateWorldMatrix(true, true);
        const { W, D, H } = cabin.userData;
        const pts = [[-W / 2, 0], [W / 2, 0], [-W / 2, D], [W / 2, D]].map(([lx, lz]) => cabin.localToWorld(V3(lx, 0, lz)));
        const ob = { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), z0: Math.min(...pts.map((p) => p.z)), z1: Math.max(...pts.map((p) => p.z)), h: H, active: true, name: 'elevator' };
        obstacles.push(ob);
        doors[def.id].elevator = { group: cabin, obstacle: ob, lat, sgn, N, D };
      }
      return doors[def.id];
    },
    removeDoor(id) {
      const d = doors[id];
      if (!d) return false;
      for (const g of [d.group, d.shell.group, d.cut]) { room.remove(g); disposeTree(g); }
      if (d.elevator) obstacles.splice(obstacles.indexOf(d.elevator.obstacle), 1);
      for (const key of Object.keys(WALL).filter((k) => k.startsWith(`${id}:`))) {         // what hung on its walls is put away (Guy's paintings go to the Catalogue)
        for (const [name, dc] of Object.entries(decor)) if (dc.wall === key) { room.remove(dc.group); delete decor[name]; world.removed[name] = dc; }
        delete WALL[key];
      }
      if (!Object.values(doors).some((o) => o !== d && o.wall === d.wall)) wallMeshes[d.wall].visible = true;
      delete doors[id];
      return true;
    },
    // ---- the elevator of a room that has one (the Restaurant) ----
    // A point `d` metres in front of its doors (into the room), or inside the cabin (`inside`); the way to face leaving it; open / shut.
    elevatorPoint(id, d, inside = false) {
      const e = doors[id].elevator, p = doors[id].shell.group.localToWorld(V3(e.sgn * e.lat, 0, inside ? -e.N + 0.6 : -e.N + e.D + d));
      return { x: p.x, z: p.z };
    },
    elevatorYaw(id) { const nv = inwardOf(doors[id].wall); return Math.atan2(nv.x, nv.z); },
    setElevatorOpen(id, open) { const d = doors[id]; if (d && d.elevator) d.elevator.group.userData.setOpen(open); },
    isElevatorOpen: (id) => !!doors[id] && !!doors[id].elevator && doors[id].elevator.group.userData.open > 0.85,
    // ---- walking through a door ----
    // A point `d` metres from the door along the way into Guy's room (negative: inside the added room), and the way to face
    // to walk that way (`intoRoom`) or the other (into the added room).
    doorPoint(id, d) { const dr = doors[id], n = inwardOf(dr.wall), p = WALL[dr.wall].at(dr.u, 0); return { x: p.x + n.x * d, z: p.z + n.z * d }; },
    doorYaw(id, intoRoom) { const n = inwardOf(doors[id].wall), s = intoRoom ? 1 : -1; return Math.atan2(s * n.x, s * n.z); },
    doorKnob(id) { return doors[id].group.localToWorld(new THREE.Vector3(0.36, 1.05, 0.1)); },       // for the hand to reach while the door is shut
    setDoorOpen(id, open) { if (doors[id]) doors[id].openTo = open ? 1 : 0; },
    isDoorOpen: (id) => !!doors[id] && doors[id].open > 0.85,
    // Swing the doors towards open or shut (called every frame by the brain).
    updateDoors(dt) {
      for (const d of Object.values(doors)) {
        if (d.elevator) d.elevator.group.userData.update(dt);        // the elevator doors slide
        if (d.open === d.openTo) continue;
        d.open = Math.max(0, Math.min(1, d.open + Math.max(-1, Math.min(1, d.openTo - d.open)) * dt / 0.8));
        if (Math.abs(d.open - d.openTo) < 0.001) d.open = d.openTo;
        d.leaf.rotation.y = d.open * 1.75;                      // swings away from the room, about 100 degrees
      }
    },
    // Where can Guy stand? Inside his own room, inside an added room, or in the doorway while its door is open.
    walkable(x, z) {
      if (Math.abs(x) <= 4.5 && z >= -3.5 && z <= 3.6) return true;
      for (const d of Object.values(doors)) {
        const b = d.shell.bounds;
        if (x >= b.minX + 0.5 && x <= b.maxX - 0.5 && z >= b.minZ + 0.5 && z <= b.maxZ - 0.5) return true;
        if (d.open < 0.3) continue;
        const n = inwardOf(d.wall), p = WALL[d.wall].at(d.u, 0), dx = x - p.x, dz = z - p.z;
        const dist = dx * n.x + dz * n.z, lateral = Math.abs(dx * n.z - dz * n.x);
        if (dist >= -0.7 && dist <= 0.8 && lateral <= 0.4) return true;
      }
      return false;
    },
    // Is (x, z) inside Guy's own room (not an added room, not in a doorway)?
    inMain: (x, z) => Math.abs(x) <= 4.9 && Math.abs(z) <= 3.9,
    // ---- objects in added rooms ----
    boundsAt, MAIN_BOUNDS,
    // Which room is (x, z) in: 'main', the id of an added room, or 'door' for the doorway between.
    roomIdAt(x, z) {
      if (Math.abs(x) <= 4.9 && Math.abs(z) <= 3.9) return 'main';
      for (const d of Object.values(doors)) { const b = d.shell.bounds; if (x >= b.minX + 0.05 && x <= b.maxX - 0.05 && z >= b.minZ + 0.05 && z <= b.maxZ - 0.05) return d.id; }
      return 'door';
    },
    // A point in an added room in its own frame: `n` metres in from the door wall, `lat` along the wall from the middle of the room
    // (positive the way the wall's u grows). And the quarter turns that make an object's local +z point back towards the door.
    shellPoint(id, n, lat) {
      const d = doors[id], p = WALL[d.wall].at(lat, 0), nv = inwardOf(d.wall);
      return { x: p.x - nv.x * n, z: p.z - nv.z * n };
    },
    shellRot(id) {
      const nv = inwardOf(doors[id].wall);
      return ((Math.round(Math.atan2(nv.x, nv.z) / (Math.PI / 2)) % 4) + 4) % 4;
    },
    // The walkable grid of an added room for Guy's pathfinding (cells of 0.2 m, half a metre in from the walls).
    // How big an added room is: `n` away from the door wall, `l` along it. And its two directions in the world (unit vectors): towards
    // the door (out of the room) and the way `lat` grows along the wall.
    shellSize(id) {
      const d = doors[id], b = d.shell.bounds, deep = d.wall === 'right' ? b.maxX - b.minX : b.maxZ - b.minZ;
      return { n: deep, l: d.wall === 'right' ? b.maxZ - b.minZ : b.maxX - b.minX };
    },
    shellAxes(id) {
      const d = doors[id], a = WALL[d.wall].at(1, 0), o = WALL[d.wall].at(0, 0);
      return { toDoor: inwardOf(d.wall), lat: new THREE.Vector3(a.x - o.x, 0, a.z - o.z).normalize() };
    },
    // Quarter turns that make an object's local +z point along (dx, dz).
    rotFacing(dx, dz) { return ((Math.round(Math.atan2(dx, dz) / (Math.PI / 2)) % 4) + 4) % 4; },
    frameOf(id) {
      const b = doors[id].shell.bounds;
      return { X0: b.minX + 0.5, Z0: b.minZ + 0.5, NX: Math.floor((b.maxX - b.minX - 1.0) / 0.2) + 1, NZ: Math.floor((b.maxZ - b.minZ - 1.0) / 0.2) + 1 };
    },
    // The floor area of the main room plus every added room, for framing the camera.
    extent() {
      const e = { minX: -ROOM.w / 2, maxX: ROOM.w / 2, minZ: -ROOM.d / 2, maxZ: ROOM.d / 2 };
      for (const d of Object.values(doors)) {
        const b = d.shell.bounds;
        e.minX = Math.min(e.minX, b.minX); e.maxX = Math.max(e.maxX, b.maxX); e.minZ = Math.min(e.minZ, b.minZ); e.maxZ = Math.max(e.maxZ, b.maxZ);
      }
      return e;
    },
    removeObject(name) {
      const dc = decor[name];
      if (dc) { room.remove(dc.group); delete decor[name]; world.removed[name] = dc; return; }
      const o = objects[name];
      if (!o || o.removable === false) return;
      if (o.kind === 'bookshelf2') { o.removing = true; rehome(); }      // its books go back to the stack on the floor first
      obstacles.splice(obstacles.indexOf(o.obstacle), 1);
      delete objects[name];
      room.remove(o.group);
      world.removed[name] = o;
    },
    removeBall() { scene.remove(ball); world.ballGone = true; },

    // Nearest place to `pref` where `obj` fits with room to walk around it and, if given, not right next to `avoid`.
    // Is the spot where Guy stands to use `obj` (if it has one) free if `obj` stood at (x, z)?
    ownStandClear(obj, x, z) {
      const own = { easel: [0, 0.8], drums: [0.55, 1.15] }[obj.name];
      if (!own) return true;
      const l = obj.local(own[0], own[1]), sx = x + l.x, sz = z + l.z;
      const b = boundsAt(x, z);                       // the room the object is in
      return !(sx < b.minX + 0.8 || sx > b.maxX - 0.8 || sz < b.minZ + 0.8 || sz > b.maxZ - 0.6 || obstacles.some((o) => o !== obj.obstacle && sx > o.x0 - 0.6 && sx < o.x1 + 0.6 && sz > o.z0 - 0.6 && sz < o.z1 + 0.6));
    },
    // Would `obj` at (x, z) sit on top of a place where Guy has to stand to use something else?
    onSomeonesStand(obj, x, z) {
      return [['piano', 0, 0.95], ['piano', 0, 1.65], ['table', 0, 0.55], ['lamp', 0.55, 0], ['shelf', -0.7, 0], ...chairStands(), ['guitar', 0, 0.62], ['drums', 0.55, 1.15], ['easel', 0, 0.8]]
        .filter(([n]) => objects[n] && objects[n] !== obj)
        .map(([n, dx, dz]) => { const o = objects[n], l = o.local(dx, dz); return { x: o.x + l.x, z: o.z + l.z }; })
        .some((q) => Math.abs(q.x - x) < obj.w / 2 + 0.55 && Math.abs(q.z - z) < obj.d / 2 + 0.55);
    },
    findSpot(obj, pref, avoid) {
      // places where Guy has to stand to use something: a new object must not sit on top of them
      const standsBlocked = (o, x, z) => world.onSomeonesStand(o, x, z);
      const cands = [];
      const p = pref || { x: 0, z: 0 };
      const rb = boundsAt(p.x, p.z);                       // search the room the preferred spot is in (Guy's room, or an added room)
      for (let x = rb.minX + 0.4; x <= rb.maxX - 0.4 + 1e-6; x += 0.25) for (let z = rb.minZ + 0.4; z <= rb.maxZ - 0.4 + 1e-6; z += 0.25) cands.push([x, z]);
      cands.sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z));
      for (const margin of [0.9, 0.5, 0.1]) {
        for (const [x, z] of cands) {
          if (!fits(obj, x, z, obj.w + margin, obj.d + margin)) continue;
          if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 1.0) continue;
          if (standsBlocked(obj, x, z)) continue;
          if (!world.ownStandClear(obj, x, z)) continue;                       // the spot he stands on to use it must be clear too
          // the middle of the room is where he dances: keep new things out of it (the last-resort pass may not)
          if (margin > 0.1 && rb.id === 'main' && obj.name !== 'guitar' && Math.abs(x) < obj.w / 2 + 1.5 && Math.abs(z - 0.4) < obj.d / 2 + 1.5) continue;
          // leave room to walk round the back of it (the fallback pass may squeeze it in)
          if (margin > 0.1 && obj.name !== 'guitar' && Math.min(x - obj.w / 2 - (rb.minX + 0.4), rb.maxX - 0.4 - x - obj.w / 2, z - obj.d / 2 - (rb.minZ + 0.4), rb.maxZ - 0.4 - z - obj.d / 2) < 0.55) continue;
          return { x, z };
        }
      }
      return null;
    },
    // Put a removed object back (its old spot if that is free).
    restoreObject(name, avoid) {
      const o = world.removed[name];
      if (!o) return false;
      if (o.decor) {
        const spot = !o.wall || decorFits(o, o.home.u, o.home.v) ? o.home : findWallSpot(o);
        if (!spot) return false;
        delete world.removed[name];
        room.add(o.group);
        decor[name] = o;
        o.set(spot.u, spot.v);
        return true;
      }
      // its old place, if it still fits there and neither blocks someone's standing spot nor loses its own
      const homeOk = fits(o, o.home.x, o.home.z) && world.ownStandClear(o, o.home.x, o.home.z) && !world.onSomeonesStand(o, o.home.x, o.home.z);
      const spot = homeOk ? o.home : world.findSpot(o, o.home, avoid);
      if (!spot) return false;
      delete world.removed[name];
      room.add(o.group);
      obstacles.push(o.obstacle);
      objects[name] = o;
      o.set(spot.x, spot.z);
      return true;
    },
    restoreBall(avoid) {
      if (!world.ballGone) return false;
      for (let i = 0; i < 80; i++) {
        const x = (Math.random() - 0.5) * 8, z = (Math.random() - 0.5) * 6;
        if (obstacles.some((o) => x > o.x0 - 0.5 && x < o.x1 + 0.5 && z > o.z0 - 0.5 && z < o.z1 + 0.5)) continue;
        if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 1.0) continue;
        ball.position.set(x, 0.18, z);
        ball.userData.vel.set(0, 0, 0);
        scene.add(ball);
        world.ballGone = false;
        return true;
      }
      return false;
    },
    // What the Workshop has in stock: planks, cut parts, and finished things waiting in storage (counts per kind). Saved with the layout.
    // `coins` is what the Restaurant has earned (no cap).
    stock: { wood: 0, parts: 0, metal: 0, mparts: 0, hw: 0, items: {}, coins: 0 },
    syncStock() {                                    // keep the piles on the workbench and the coins in the till in step with the counts
      const b = objects.workbench;
      if (b) { b.setWood(world.stock.wood); b.setParts(world.stock.parts); b.setMetal(world.stock.metal); b.setMParts(world.stock.mparts); b.setHW(world.stock.hw); }
      const r = objects.register;
      if (r) r.setCoins(world.stock.coins);
    },
    addCoins(n) {
      world.stock.coins = Math.max(0, Math.min(999999, (world.stock.coins || 0) + n));
      world.syncStock();
      return world.stock.coins;
    },
    addStock(kind, n) {
      world.stock[kind] = Math.max(0, Math.min(40, (world.stock[kind] || 0) + n));
      world.syncStock();
      return world.stock[kind];
    },
    // Take a built thing out of storage and put it in Guy's room (`free`: it is being restored from a save, so storage is not touched).
    // Returns its name, or null if there is none in storage or no room for it.
    addInstance(kind, avoid, forcedName = null, free = false, pref = null) {
      const k = INSTANCE_KINDS[kind];
      if (!k) return null;
      if (!free && !((world.stock.items[kind] || 0) > 0)) return null;
      let name = forcedName;
      if (!name) { let i = 1; while (objects[`${kind}_${i}`]) i++; name = `${kind}_${i}`; }
      if (objects[name]) return name;
      const o = k.build(name, 0, 0);
      o.kind = kind;
      const kp = typeof k.pref === 'function' ? k.pref(world) : k.pref;          // (a table for the restaurant goes where that room is)
      if (!pref && kp && kp.rot !== undefined) { o.rot = kp.rot; o.group.rotation.y = o.yaw; }
      const want = pref || kp;
      let spot = null;
      if (want && want.exact && fits(o, want.x, want.z) && world.ownStandClear(o, want.x, want.z) && !world.onSomeonesStand(o, want.x, want.z)) spot = { x: want.x, z: want.z };
      if (!spot && want) spot = world.findSpot(o, want, avoid);
      if (!spot) { world.removeObject(name); delete world.removed[name]; return null; }
      o.home = { x: spot.x, z: spot.z };
      o.set(spot.x, spot.z);
      if (kind === 'bookshelf2') rehome();                           // the books that were stacked on the floor go on it
      if (!free) world.stock.items[kind] = (world.stock.items[kind] || 0) - 1;
      if (!world.stock.items[kind]) delete world.stock.items[kind];
      return name;
    },
    // Put a built thing away: it leaves the room and goes back into storage.
    storeInstance(name) {
      const o = objects[name];
      if (!o || !o.kind) return false;
      const kind = o.kind;
      world.removeObject(name);
      delete world.removed[name];
      world.stock.items[kind] = Math.min(99, (world.stock.items[kind] || 0) + 1);
      return true;
    },
    instanceKinds: () => Object.keys(INSTANCE_KINDS),
    // where a built kind goes when it is wanted: { x, z, room, rot? } (null if it has nowhere to go, e.g. the restaurant is not there)
    instanceSite(kind) {
      const k = INSTANCE_KINDS[kind];
      if (!k) return null;
      const p = typeof k.pref === 'function' ? k.pref(world) : k.pref;
      return p ? { ...p, room: world.roomIdAt(p.x, p.z) } : null;
    },
    // Guy has just built `kind`: it goes straight into the Workshop (the middle of the room, or the nearest free spot there).
    // Returns its name, or null if there is no room for it (the caller then puts it in storage).
    placeBuilt(kind) {
      if (!doors.workshop) return null;
      const { n } = world.shellSize('workshop');
      const p = world.shellPoint('workshop', n * 0.5, 0);
      return world.addInstance(kind, null, null, true, { x: p.x, z: p.z });
    },
    // Objects that do not exist yet but can be added from the Catalogue.
    addNew(id, avoid) {
      if (DECOR_NEW[id]) {
        if (decor[id]) return false;
        const d = DECOR_NEW[id]();
        const spot = decorFits(d, d.home.u, d.home.v) ? d.home : findWallSpot(d);
        if (!spot) { room.remove(d.group); delete decor[id]; return false; }
        d.home = { u: spot.u, v: spot.v };
        d.set(spot.u, spot.v);
        return true;
      }
      const entry = NEW_OBJECTS[id];
      if (!entry || objects[id]) return false;
      // a preferred spot may be worked out when the object is added (an added room's furniture goes where its room is)
      const pref = typeof entry[1] === 'function' ? entry[1](world) : entry[1];
      if (!pref) return false;
      const o = entry[0]();
      if (pref.rot !== undefined) { o.rot = pref.rot; o.group.rotation.y = o.yaw; }
      let spot = null;
      if (pref.exact && fits(o, pref.x, pref.z) && world.ownStandClear(o, pref.x, pref.z) && !world.onSomeonesStand(o, pref.x, pref.z)) spot = { x: pref.x, z: pref.z };       // exactly where the room's plan says
      if (!spot) spot = world.findSpot(o, pref, avoid);
      if (!spot) { world.removeObject(id); delete world.removed[id]; return false; }
      o.home = { x: spot.x, z: spot.z };
      o.set(spot.x, spot.z);
      if (id === 'workbench') world.syncStock();
      return true;
    },
  };
  return world;
}
