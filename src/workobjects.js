// The Workshop's furniture and tools: workbench, toolbox, Wood Factory, saw (and sawhorse), assembly block (and rubber mallet) and
// sander. Built with the same makeObject helper as the rest of the room (room.js passes it in), and placed in the added room's own
// frame (room.js, NEW_OBJECTS). Every one has its front on local +z, which is where Guy stands, and a few methods the activities in
// workbrain.js use: `at(x, y, z)` (an object-local point in the world), the tool prop the hands carry, and the state the models
// show (the wood pile, the opening lid, the planks on the tray ...).
import * as THREE from 'three';

const WOOD = 0xc89b62, WOOD_DARK = 0x8a5a2e, WOOD_LIGHT = 0xe3c08a, STEEL = 0x8a929c, RED = 0xc0392b, TEAL = 0x2a9d8f, ORANGE = 0xd9772b, BAR = 0xb4bcc6;

export function makeWorkshopBuilders({ makeObject, box, mat }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const plankMat = mat(WOOD_LIGHT);
  const barMat = mat(BAR, { metalness: 0.75, roughness: 0.3 });
  const plankMesh = (len = 0.5, th = 0.03, wd = 0.12, material = plankMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, th, wd), material);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const clearGroup = (grp) => { while (grp.children.length) { const c = grp.children[0]; grp.remove(c); if (c.geometry) c.geometry.dispose(); } };
  // n planks laid in layers of `perLayer`, a little untidy
  const fillPile = (grp, n, { len = 0.5, th = 0.03, wd = 0.12, perLayer = 4, material = plankMat } = {}) => {
    clearGroup(grp);
    for (let i = 0; i < n; i++) {
      const m = plankMesh(len, th, wd, material), layer = Math.floor(i / perLayer), k = i % perLayer;
      m.position.set(Math.sin(i * 3.1) * 0.012, layer * th + th / 2, (k - (perLayer - 1) / 2) * (wd + 0.012));
      m.rotation.y = Math.sin(i * 7.7) * 0.05;
      grp.add(m);
    }
  };
  // every object: a world point from an object-local one (x right, y up, z towards Guy)
  const addAt = (o) => { o.at = (x, y, z) => { o.group.updateWorldMatrix(true, false); return o.group.localToWorld(V(x, y, z)); }; return o; };
  // wrap the per-frame update the room already calls on every object
  const onUpdate = (o, fn) => { const base = o.update; o.update = function (dt) { base.call(this, dt); fn(dt); }; };

  // ------------------------------------------------------------------------------------------------ workbench
  const workbench = (x = 0, z = 0) => {
    const wood = mat(WOOD), dark = mat(WOOD_DARK), steel = mat(STEEL, { metalness: 0.5, roughness: 0.4 }), peg = mat(0xd9c29a);
    const o = makeObject('workbench', x, z, 1.7, 0.78, 1.8, 'heavy', (g) => {
      box(1.7, 0.06, 0.78, wood, 0, 0.9, 0, g);                                  // the top
      for (const sx of [-0.74, 0.74]) for (const sz of [-0.31, 0.31]) box(0.08, 0.87, 0.08, dark, sx, 0.435, sz, g);
      box(1.5, 0.04, 0.6, dark, 0, 0.25, 0, g);                                  // the lower shelf
      box(1.5, 0.12, 0.03, dark, 0, 0.8, -0.34, g);                              // back apron
      box(1.6, 0.8, 0.03, peg, 0, 1.4, -0.37, g);                                // pegboard on the back
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) box(0.012, 0.012, 0.01, dark, -0.7 + i * 0.175, 1.15 + j * 0.2, -0.35, g);   // peg holes
      box(0.04, 0.3, 0.02, steel, -0.5, 1.45, -0.34, g);                         // a few hung tools: a hammer, a saw, a spanner
      box(0.14, 0.06, 0.02, dark, -0.5, 1.62, -0.34, g);
      box(0.4, 0.1, 0.01, steel, 0.1, 1.55, -0.345, g);
      box(0.05, 0.14, 0.02, mat(RED), 0.1, 1.5, -0.34, g);
      box(0.03, 0.22, 0.02, steel, 0.6, 1.45, -0.34, g);
      box(0.15, 0.12, 0.2, steel, 0.68, 0.98, 0.22, g);                          // the vise on the right end
      box(0.02, 0.02, 0.18, dark, 0.68, 0.98, 0.38, g);
      for (const sx of [-0.35, 0.35]) { box(0.6, 0.12, 0.02, dark, sx, 0.74, 0.34, g); box(0.04, 0.03, 0.02, steel, sx, 0.74, 0.355, g); }   // two drawers
    });
    o.pile = new THREE.Group();                                                  // the wood in stock, on the left of the top
    o.pile.position.set(-0.62, 0.93, 0.08);
    o.group.add(o.pile);
    o.mpile = new THREE.Group();                                                 // metal bars, next to the wood
    o.mpile.position.set(-0.3, 0.93, 0.08);
    o.group.add(o.mpile);
    o.parts = new THREE.Group();                                                 // cut parts, in the middle
    o.parts.position.set(-0.02, 0.93, 0.14);
    o.group.add(o.parts);
    o.mparts = new THREE.Group();                                                // cut metal parts, behind them
    o.mparts.position.set(0.14, 0.93, -0.12);
    o.group.add(o.mparts);
    o.hw = new THREE.Group();                                                    // finished metal hardware waiting for a wooden body (an electric guitar)
    o.hw.position.set(0.5, 0.93, -0.15);
    o.group.add(o.hw);
    o.product = new THREE.Group();                                               // the thing he has just finished, on the right
    o.product.position.set(0.38, 0.93, 0.06);
    o.group.add(o.product);
    o.setWood = (n) => fillPile(o.pile, Math.min(12, n));
    o.setMetal = (n) => fillPile(o.mpile, Math.min(8, n), { len: 0.4, th: 0.035, wd: 0.07, perLayer: 3, material: barMat });
    o.setMParts = (n) => {
      clearGroup(o.mparts);
      for (let i = 0; i < Math.min(8, n); i++) {
        const m = plankMesh(0.3, 0.035, 0.05, barMat);
        m.position.set(0, (i % 4) * 0.035 + 0.0175, (Math.floor(i / 4) - 0.5) * 0.08);
        m.rotation.y = Math.sin(i * 4.1) * 0.08;
        o.mparts.add(m);
      }
    };
    o.setHW = (n) => {
      clearGroup(o.hw);
      if (n > 0) { const m = plankMesh(0.22, 0.05, 0.1, barMat); m.position.y = 0.025; o.hw.add(m); const k = plankMesh(0.05, 0.12, 0.05, barMat); k.position.set(0.08, 0.08, 0); o.hw.add(k); }
    };
    o.setParts = (n) => {
      clearGroup(o.parts);
      for (let i = 0; i < Math.min(8, n); i++) {
        const m = plankMesh(0.3, 0.03, 0.06);
        m.position.set(0, (i % 4) * 0.03 + 0.015, (Math.floor(i / 4) - 0.5) * 0.09);
        m.rotation.y = Math.sin(i * 5.3) * 0.08;
        o.parts.add(m);
      }
    };
    // a small model of the last thing he finished stands on the right of the top (what is in storage is counted in the stock)
    o.showProduct = (kind) => {
      clearGroup(o.product);
      if (!kind) return;
      const light = mat(WOOD_LIGHT), wd = mat(WOOD);
      const g = o.product;
      if (kind === 'metalchair') {
        const st = mat(BAR, { metalness: 0.75, roughness: 0.3 });
        box(0.22, 0.025, 0.22, st, 0, 0.2, 0, g);
        for (const sx of [-0.09, 0.09]) for (const sz of [-0.09, 0.09]) box(0.025, 0.19, 0.025, st, sx, 0.095, sz, g);
        box(0.22, 0.2, 0.02, st, 0, 0.32, -0.1, g);
      } else if (kind === 'diningtable3' || kind === 'diningtable4') {
        const top = mat(kind === 'diningtable4' ? BAR : WOOD_LIGHT);
        box(0.36, 0.025, 0.24, top, 0, 0.2, 0, g);
        for (const sx of [-0.15, 0.15]) for (const sz of [-0.09, 0.09]) box(0.03, 0.19, 0.03, wd, sx, 0.095, sz, g);
      } else if (kind === 'bookshelf2') {
        for (const sx of [-0.14, 0.14]) box(0.025, 0.5, 0.12, wd, sx, 0.25, 0, g);
        for (const y of [0.02, 0.17, 0.32, 0.47]) box(0.3, 0.025, 0.12, light, 0, y, 0, g);
      } else if (kind === 'eguitar') {
        box(0.16, 0.24, 0.035, mat(0xc0392b), 0, 0.12, 0, g);
        box(0.035, 0.26, 0.03, mat(0x2b2b2b), 0, 0.37, 0, g);
      } else if (kind === 'footstool') {
        box(0.26, 0.03, 0.2, light, 0, 0.19, 0, g);
        for (const sx of [-0.1, 0.1]) for (const sz of [-0.07, 0.07]) box(0.035, 0.18, 0.035, wd, sx, 0.09, sz, g);
      } else if (kind === 'woodshelves') {
        for (const sx of [-0.14, 0.14]) box(0.025, 0.46, 0.13, wd, sx, 0.23, 0, g);
        for (const y of [0.02, 0.17, 0.31, 0.45]) box(0.3, 0.025, 0.13, light, 0, y, 0, g);
      } else {                                                                   // a chair
        box(0.22, 0.025, 0.22, light, 0, 0.2, 0, g);
        for (const sx of [-0.09, 0.09]) for (const sz of [-0.09, 0.09]) box(0.03, 0.19, 0.03, wd, sx, 0.095, sz, g);
        box(0.22, 0.2, 0.025, light, 0, 0.32, -0.1, g);
      }
    };
    o.setWood(0);
    o.setParts(0);
    o.pilePoint = () => o.at(-0.62, 1.0, 0.08);
    o.metalPoint = () => o.at(-0.3, 1.0, 0.08);
    o.partsPoint = () => o.at(-0.02, 1.0, 0.14);
    o.mpartsPoint = () => o.at(0.14, 1.0, -0.1);
    o.hwPoint = () => o.at(0.5, 1.0, -0.12);
    o.productPoint = () => o.at(0.38, 1.0, 0.06);
    o.setMetal(0); o.setMParts(0); o.setHW(0);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ toolbox
  const toolbox = (x = 0, z = 0) => {
    const red = mat(RED), steel = mat(STEEL, { metalness: 0.5, roughness: 0.4 }), gold = mat(0xe8c050, { metalness: 0.4 });
    const B = 0.5;                                                               // the box stands on a little frame, so Guy reaches it without squatting
    const o = makeObject('toolbox', x, z, 0.54, 0.34, 0.85, 'medium', (g) => {
      for (const sx of [-0.23, 0.23]) for (const sz of [-0.12, 0.12]) box(0.04, B, 0.04, mat(0x4a4f57), sx, B / 2, sz, g);
      box(0.54, 0.03, 0.32, mat(0x4a4f57), 0, B, 0, g);                          // the shelf the box sits on
      box(0.5, 0.2, 0.28, red, 0, B + 0.12, 0, g);
      box(0.5, 0.02, 0.28, mat(0x7a2418), 0, B + 0.03, 0, g);
      box(0.04, 0.06, 0.02, steel, -0.12, B + 0.2, 0.145, g);                    // latches
      box(0.04, 0.06, 0.02, steel, 0.12, B + 0.2, 0.145, g);
    });
    // the lid hangs from the back edge and swings up
    o.lid = new THREE.Group();
    o.lid.position.set(0, B + 0.22, -0.14);
    box(0.5, 0.04, 0.28, red, 0, 0.02, 0.14, o.lid);
    box(0.2, 0.015, 0.03, steel, 0, 0.055, 0.14, o.lid);                         // handle
    for (const sx of [-0.1, 0.1]) box(0.015, 0.05, 0.03, steel, sx, 0.045, 0.14, o.lid);
    o.group.add(o.lid);
    // what is inside: a hammer, a spanner and a few screws, seen once the lid is up
    o.inner = new THREE.Group();
    box(0.34, 0.03, 0.05, steel, -0.04, B + 0.215, 0.02, o.inner);
    box(0.06, 0.05, 0.06, mat(WOOD_DARK), 0.16, B + 0.225, 0.03, o.inner);
    box(0.12, 0.012, 0.03, gold, 0.08, B + 0.215, -0.07, o.inner);
    o.group.add(o.inner);
    o.open = 0; o.openTo = 0;
    o.setOpen = (v) => { o.openTo = v ? 1 : 0; };
    const apply = () => { o.lid.rotation.x = -o.open * 1.9; o.inner.visible = o.open > 0.25; };
    apply();
    onUpdate(o, (dt) => {
      if (o.open === o.openTo) return;
      o.open = Math.max(0, Math.min(1, o.open + Math.sign(o.openTo - o.open) * dt / 0.5));
      if (Math.abs(o.open - o.openTo) < 0.01) o.open = o.openTo;
      apply();
    });
    o.lidPoint = () => o.at(0, B + 0.3, 0.17);                                    // where a hand goes to lift the lid
    o.toolPoint = () => o.at(0, B + 0.28, 0.0);                                   // where it reaches in
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ Wood Factory
  const woodfactory = (x = 0, z = 0) => {
    const teal = mat(TEAL), dark = mat(0x2b3a42), steel = mat(STEEL, { metalness: 0.5, roughness: 0.4 });
    const L = 0.22;                                                              // it stands on a raised plinth so the button and the tray are at Guy's hands
    const o = makeObject('woodfactory', x, z, 0.95, 0.85, 1.7, 'heavy', (g) => {
      box(0.95, 0.1 + L, 0.75, dark, 0, (0.1 + L) / 2, -0.02, g);                // plinth
      box(0.88, 0.85, 0.66, teal, 0, 0.1 + L + 0.425, -0.04, g);                 // the machine
      box(0.5, 0.34, 0.02, dark, 0, L + 0.78, 0.3, g);                           // control panel
      box(0.36, 0.1, 0.02, mat(0x1b242a), 0, L + 0.5, 0.3, g);                   // slot the planks come out of
      box(0.5, 0.03, 0.3, steel, 0, L + 0.38, 0.46, g);                          // the tray
      box(0.5, 0.05, 0.015, steel, 0, L + 0.405, 0.605, g);
      box(0.015, 0.05, 0.3, steel, -0.25, L + 0.405, 0.46, g);
      box(0.015, 0.05, 0.3, steel, 0.25, L + 0.405, 0.46, g);
      const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.34, 4, 1, true), mat(0x23867b, { side: THREE.DoubleSide }));
      hopper.position.set(0, L + 1.28, -0.04); hopper.rotation.y = Math.PI / 4; hopper.castShadow = true;
      g.add(hopper);
      for (let i = 0; i < 4; i++) {                                              // logs in the hopper
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 10), mat(0x7a4f2b));
        log.rotation.z = Math.PI / 2; log.position.set(-0.04 + (i % 2) * 0.08, L + 1.22 + Math.floor(i / 2) * 0.12, -0.04 + (i % 3 - 1) * 0.1);
        g.add(log);
      }
      const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), steel);
      chim.position.set(0.3, L + 1.2, -0.2); g.add(chim);
    });
    // the big red button, a light that goes green while it runs, and a gear on the side that turns
    o.button = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 20), mat(0xe53935, { emissive: 0x330000 }));
    o.button.rotation.x = Math.PI / 2; o.button.position.set(0, L + 0.82, 0.335); o.button.castShadow = true;
    o.group.add(o.button);
    o.light = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshBasicMaterial({ color: 0x884444 }));
    o.light.position.set(0.17, L + 0.9, 0.31);
    o.group.add(o.light);
    o.gear = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10), steel);
    o.gear.rotation.z = Math.PI / 2; o.gear.position.set(0.45, L + 0.65, -0.04);
    o.group.add(o.gear);
    o.tray = new THREE.Group();                                                  // planks waiting on the tray
    o.tray.position.set(0, L + 0.395, 0.46);
    o.group.add(o.tray);
    o.setTray = (n) => fillPile(o.tray, Math.min(4, n), { len: 0.4, th: 0.03, wd: 0.1, perLayer: 2 });
    o.running = 0; o.pressed = 0;
    onUpdate(o, (dt) => {
      o.pressed = Math.max(0, o.pressed - dt * 3);
      o.button.position.z = 0.335 - 0.03 * Math.min(1, o.pressed * 3);
      if (o.running > 0) {
        o.running = Math.max(0, o.running - dt);
        o.gear.rotation.x += dt * 9;
        o.light.material.color.set(0x44dd66);
        o.group.position.y = Math.sin(o.running * 60) * 0.004;                   // it shakes while it runs
      } else { o.light.material.color.set(0x884444); o.group.position.y = 0; }
    });
    o.press = () => { o.pressed = 0.4; };
    o.run = (secs) => { o.running = secs; };
    o.buttonPoint = () => o.at(0, L + 0.82, 0.37);
    o.trayPoint = () => o.at(0, L + 0.5, 0.46);
    o.setTray(0);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ saw and sawhorse
  const saw = (x = 0, z = 0) => {
    const wood = mat(WOOD), steel = mat(STEEL, { metalness: 0.6, roughness: 0.3 });
    const o = makeObject('saw', x, z, 1.0, 0.5, 0.95, 'medium', (g) => {
      for (const sx of [-0.36, 0.36]) {                                          // two A-frames and a beam
        for (const sz of [-1, 1]) { const leg = box(0.05, 0.78, 0.05, wood, sx, 0.37, sz * 0.12, g); leg.rotation.x = -sz * 0.22; }
        box(0.07, 0.04, 0.34, wood, sx, 0.4, 0, g);
      }
      box(0.95, 0.07, 0.09, wood, 0, 0.75, 0, g);                                // the beam
    });
    // a plank lies across the sawhorse: whole, or (once sawn) in two halves
    o.plankA = plankMesh(0.8, 0.03, 0.14); o.plankA.position.set(0, 0.805, 0); o.group.add(o.plankA);
    o.plankB = plankMesh(0.36, 0.03, 0.14); o.plankB.position.set(0.22, 0.805, 0); o.group.add(o.plankB);
    o.setPlank = (state) => {                                                    // null | 'whole' | 'cut'
      o.plankA.visible = state !== null && state !== undefined;
      o.plankB.visible = state === 'cut';
      if (state === 'whole') { o.plankA.scale.x = 1; o.plankA.position.x = 0; }
      if (state === 'cut') { o.plankA.scale.x = 0.55; o.plankA.position.x = -0.18; o.plankB.position.x = 0.26; }
    };
    o.setPlank(null);
    // the hand saw: blade along its local +x, handle at the other end, teeth down. It lies on the beam until he picks it up.
    o.tool = new THREE.Group();
    const blade = box(0.42, 0.1, 0.006, steel, 0.24, -0.02, 0, o.tool);
    blade.castShadow = true;
    box(0.4, 0.015, 0.01, mat(0x9aa3ad), 0.24, -0.075, 0, o.tool);               // teeth
    box(0.1, 0.12, 0.03, mat(0x3a2a1c), -0.01, 0.0, 0, o.tool);                  // handle
    box(0.1, 0.03, 0.03, mat(0x3a2a1c), -0.01, 0.075, 0, o.tool);
    o.group.add(o.tool);
    o.toolRest = { pos: V(0.05, 0.9, 0.0), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) };
    o.resetTool = () => { o.tool.position.copy(o.toolRest.pos); o.tool.quaternion.copy(o.toolRest.quat); };
    o.resetTool();
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ assembly block and rubber mallet
  const mallet = (x = 0, z = 0) => {
    const wood = mat(WOOD), dark = mat(WOOD_DARK), rubber = mat(0x2d3640, { roughness: 0.9 });
    const TOP = 0.72;                                                            // waist high, so he can tap on it standing up
    const o = makeObject('mallet', x, z, 0.62, 0.55, TOP + 0.05, 'light', (g) => {
      box(0.5, TOP - 0.02, 0.45, wood, 0, (TOP - 0.02) / 2, 0, g);               // a stout block to work on
      box(0.54, 0.04, 0.49, dark, 0, TOP, 0, g);
      box(0.08, 0.3, 0.01, dark, -0.18, 0.4, 0.226, g);
    });
    o.assembly = new THREE.Group();                                              // the parts he is knocking together
    o.assembly.position.set(0, TOP + 0.02, 0);
    o.group.add(o.assembly);
    o.setParts = (n) => {                                                        // 0..4: loose bars and a top, tapped into a frame
      clearGroup(o.assembly);
      for (let i = 0; i < n; i++) {
        const m = plankMesh(0.26, 0.04, 0.06);
        m.position.set((i % 2 ? 1 : -1) * 0.07, 0.02 + Math.floor(i / 2) * 0.05, (i % 3 - 1) * 0.07);
        m.rotation.y = (i % 2 ? 1 : -1) * (0.9 - i * 0.18);
        o.assembly.add(m);
      }
    };
    o.setParts(0);
    // the mallet: a rubber head on a wooden handle; the head is at the group's origin, the handle runs along +y
    o.tool = new THREE.Group();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 14), rubber);
    head.rotation.z = Math.PI / 2; head.castShadow = true;
    o.tool.add(head);
    const handle = box(0.028, 0.3, 0.028, mat(0x9a6b3d), 0, 0.17, 0, o.tool);
    handle.castShadow = true;
    o.group.add(o.tool);
    o.toolRest = { pos: V(0.17, TOP + 0.08, 0.12), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.6, Math.PI / 2 - 0.1)) };
    o.resetTool = () => { o.tool.position.copy(o.toolRest.pos); o.tool.quaternion.copy(o.toolRest.quat); };
    o.resetTool();
    o.TOP = TOP;
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ Metal Factory
  const metalfactory = (x = 0, z = 0) => {
    const orange = mat(ORANGE), dark = mat(0x2b3a42), steel = mat(STEEL, { metalness: 0.5, roughness: 0.4 });
    const L = 0.22;                                                              // the same plinth as the Wood Factory: the button and the tray are at his hands
    const o = makeObject('metalfactory', x, z, 0.95, 0.85, 1.7, 'heavy', (g) => {
      box(0.95, 0.1 + L, 0.75, dark, 0, (0.1 + L) / 2, -0.02, g);
      box(0.88, 0.85, 0.66, orange, 0, 0.1 + L + 0.425, -0.04, g);
      box(0.5, 0.34, 0.02, dark, 0, L + 0.78, 0.3, g);
      box(0.36, 0.1, 0.02, mat(0x1b242a), 0, L + 0.5, 0.3, g);
      box(0.5, 0.03, 0.3, steel, 0, L + 0.38, 0.46, g);
      box(0.5, 0.05, 0.015, steel, 0, L + 0.405, 0.605, g);
      box(0.015, 0.05, 0.3, steel, -0.25, L + 0.405, 0.46, g);
      box(0.015, 0.05, 0.3, steel, 0.25, L + 0.405, 0.46, g);
      const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.34, 4, 1, true), mat(0xb35f1c, { side: THREE.DoubleSide }));
      hopper.position.set(0, L + 1.28, -0.04); hopper.rotation.y = Math.PI / 4; hopper.castShadow = true;
      g.add(hopper);
      for (let i = 0; i < 5; i++) box(0.5, 0.07, 0.12, barMat, -0.04 + (i % 2) * 0.06, L + 1.2 + Math.floor(i / 2) * 0.08, -0.04 + (i % 3 - 1) * 0.12, g);       // bars in the hopper
      const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), dark);
      chim.position.set(0.32, L + 1.3, -0.2); g.add(chim);
    });
    o.button = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 20), mat(0xe53935, { emissive: 0x330000 }));
    o.button.rotation.x = Math.PI / 2; o.button.position.set(0, L + 0.82, 0.335); o.button.castShadow = true;
    o.group.add(o.button);
    o.light = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshBasicMaterial({ color: 0x884444 }));
    o.light.position.set(0.17, L + 0.9, 0.31);
    o.group.add(o.light);
    o.gear = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10), steel);
    o.gear.rotation.z = Math.PI / 2; o.gear.position.set(0.45, L + 0.65, -0.04);
    o.group.add(o.gear);
    o.tray = new THREE.Group();
    o.tray.position.set(0, L + 0.395, 0.46);
    o.group.add(o.tray);
    o.setTray = (n) => fillPile(o.tray, Math.min(4, n), { len: 0.4, th: 0.04, wd: 0.08, perLayer: 2, material: barMat });
    o.running = 0; o.pressed = 0;
    onUpdate(o, (dt) => {
      o.pressed = Math.max(0, o.pressed - dt * 3);
      o.button.position.z = 0.335 - 0.03 * Math.min(1, o.pressed * 3);
      if (o.running > 0) {
        o.running = Math.max(0, o.running - dt);
        o.gear.rotation.x += dt * 7;
        o.light.material.color.set(0x44dd66);
        o.group.position.y = Math.sin(o.running * 55) * 0.004;
      } else { o.light.material.color.set(0x884444); o.group.position.y = 0; }
    });
    o.press = () => { o.pressed = 0.4; };
    o.run = (secs) => { o.running = secs; };
    o.buttonPoint = () => o.at(0, L + 0.82, 0.37);
    o.trayPoint = () => o.at(0, L + 0.5, 0.46);
    o.setTray(0);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ Metal Cutter (a bench shear with a lever)
  const metalcutter = (x = 0, z = 0) => {
    const dark = mat(0x3a4650), blue = mat(0x2f6f8f), steel = mat(STEEL, { metalness: 0.6, roughness: 0.3 });
    const TOP = 0.9;                                                             // waist high; the lever is on the front right, he reaches it from there
    const o = makeObject('metalcutter', x, z, 0.9, 0.55, TOP + 0.5, 'medium', (g) => {
      for (const sx of [-0.4, 0.4]) for (const sz of [-0.2, 0.2]) box(0.06, TOP - 0.05, 0.06, dark, sx, (TOP - 0.05) / 2, sz, g);
      box(0.9, 0.05, 0.55, blue, 0, TOP - 0.025, 0, g);                          // the table
      box(0.8, 0.03, 0.5, dark, 0, 0.35, 0, g);                                  // a low shelf
      box(0.14, 0.45, 0.2, dark, 0.34, TOP + 0.22, -0.12, g);                    // the frame the blade slides in
      box(0.9, 0.025, 0.1, steel, 0, TOP + 0.012, -0.02, g);                     // the fixed blade along the table edge
      box(0.2, 0.18, 0.2, mat(0x777f88), -0.3, TOP + 0.09, -0.12, g);             // a stop for the bar
    });
    o.TOP = TOP;
    o.blade = box(0.78, 0.18, 0.02, steel, 0.0, TOP + 0.2, 0.0, o.group);       // the moving blade
    o.lever = new THREE.Group();                                                 // the lever: pivot at the back, handle towards Guy
    o.lever.position.set(0.34, TOP + 0.2, -0.04);
    box(0.04, 0.04, 0.62, steel, 0, 0, 0.31, o.lever);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), mat(0xe53935)); knob.position.set(0, 0, 0.64); o.lever.add(knob);
    o.group.add(o.lever);
    o.LEVER = 0.62;
    o.setLever = (th) => { o.leverTh = th; o.lever.rotation.x = -th; o.blade.position.y = TOP + 0.1 + th * 0.12; };
    o.leverGrip = (th = o.leverTh) => o.at(0.34, TOP + 0.2 + 0.64 * Math.sin(th), -0.04 + 0.64 * Math.cos(th));
    // the bar lies across the table: whole, or once cut in two pieces
    o.barA = plankMesh(0.8, 0.035, 0.07, barMat); o.barA.position.set(0, TOP + 0.045, 0.06); o.group.add(o.barA);
    o.barB = plankMesh(0.36, 0.035, 0.07, barMat); o.barB.position.set(0.2, TOP + 0.045, 0.06); o.group.add(o.barB);
    o.setBar = (state) => {                                                      // null | 'whole' | 'cut'
      o.barA.visible = state !== null && state !== undefined;
      o.barB.visible = state === 'cut';
      if (state === 'whole') { o.barA.scale.x = 1; o.barA.position.x = 0; }
      if (state === 'cut') { o.barA.scale.x = 0.55; o.barA.position.x = -0.18; o.barB.position.x = 0.28; o.barB.position.z = 0.1; }
    };
    o.setBar(null);
    o.setLever(o.LEVER);
    o.barPoint = () => o.at(0, TOP + 0.06, 0.08);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ Welder (a table, a clamp, a gas bottle and a torch)
  const welder = (x = 0, z = 0) => {
    const dark = mat(0x2b3a42), steel = mat(STEEL, { metalness: 0.6, roughness: 0.3 }), red = mat(RED), yel = mat(0xe8c050);
    const TOP = 0.85;
    const o = makeObject('welder', x, z, 0.95, 0.65, TOP + 0.7, 'medium', (g) => {
      for (const sx of [-0.4, 0.4]) for (const sz of [-0.25, 0.25]) box(0.06, TOP - 0.04, 0.06, dark, sx, (TOP - 0.04) / 2, sz, g);
      box(0.95, 0.06, 0.65, mat(0x555f69), 0, TOP - 0.03, 0, g);                 // the steel welding table
      box(0.06, 0.4, 0.06, steel, -0.4, TOP + 0.2, -0.22, g);                    // clamp frame
      box(0.3, 0.05, 0.06, steel, -0.28, TOP + 0.4, -0.22, g);
      box(0.3, 0.3, 0.2, dark, 0.58, 0.15, -0.1, g);                             // the power box on the floor beside it
      box(0.12, 0.05, 0.02, yel, 0.58, 0.28, 0.01, g);
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 14), red);
      bottle.position.set(-0.55, 0.35, -0.15); bottle.castShadow = true; g.add(bottle);
      box(0.06, 0.1, 0.06, steel, -0.55, 0.75, -0.15, g);
    });
    o.TOP = TOP;
    o.assembly = new THREE.Group();                                              // the metal parts being joined
    o.assembly.position.set(0, TOP + 0.02, 0);
    o.group.add(o.assembly);
    o.setParts = (n) => {
      clearGroup(o.assembly);
      for (let i = 0; i < Math.min(4, n); i++) {
        const m = plankMesh(0.26, 0.04, 0.05, barMat);
        m.position.set((i % 2 ? 1 : -1) * 0.06, 0.02 + Math.floor(i / 2) * 0.045, (i % 3 - 1) * 0.07);
        m.rotation.y = (i % 2 ? 1 : -1) * (0.8 - i * 0.15);
        o.assembly.add(m);
      }
    };
    o.setParts(0);
    // the torch: nozzle at the group's origin, handle along +y
    o.tool = new THREE.Group();
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.1, 10), mat(0xb87333, { metalness: 0.6 }));
    noz.position.y = 0.05; o.tool.add(noz);
    box(0.035, 0.26, 0.035, dark, 0, 0.23, 0, o.tool);
    o.group.add(o.tool);
    o.toolRest = { pos: V(0.3, TOP + 0.1, 0.18), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.4, Math.PI / 2)) };
    o.resetTool = () => { o.tool.position.copy(o.toolRest.pos); o.tool.quaternion.copy(o.toolRest.quat); o.welding = 0; };
    // the arc: a glow at the seam and a few sparks that fly off while he welds (no real light, it would change the shaders of the whole room)
    o.glow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), new THREE.MeshBasicMaterial({ color: 0xcfe8ff }));
    o.glow.visible = false; o.group.add(o.glow);
    o.sparks = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0xffc04a }));
      s.visible = false; o.group.add(s); o.sparks.push({ m: s, v: V(0, 0, 0), t: 0 });
    }
    o.welding = 0;
    o.resetTool();
    o.weldAt = (p) => { o.glow.visible = true; o.glow.position.copy(o.group.worldToLocal(p.clone())); o.welding = 0.15; };       // (called each frame while he welds)
    onUpdate(o, (dt) => {
      if (o.welding > 0) {
        o.welding -= dt;
        o.glow.scale.setScalar(0.8 + Math.random() * 0.8);
        o.sparks.forEach((s) => {
          s.t -= dt;
          if (s.t <= 0) { s.t = 0.25 + Math.random() * 0.3; s.m.position.copy(o.glow.position); s.v.set((Math.random() - 0.5) * 1.2, 0.6 + Math.random(), (Math.random() - 0.5) * 1.2); s.m.visible = true; }
          s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt);
          if (s.m.position.y < TOP) s.m.visible = false;
        });
      } else { o.glow.visible = false; o.sparks.forEach((s) => { s.m.visible = false; s.t = 0; }); }
    });
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ Metal Hammer and anvil
  const anvil = (x = 0, z = 0) => {
    const dark = mat(0x3a4650), iron = mat(0x4b535c, { metalness: 0.7, roughness: 0.35 }), wood = mat(WOOD_DARK);
    const TOP = 0.72;
    const o = makeObject('anvil', x, z, 0.7, 0.5, TOP + 0.05, 'light', (g) => {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.44, 14), wood);
      stump.position.y = 0.22; stump.castShadow = true; g.add(stump);
      box(0.3, 0.06, 0.2, iron, 0, 0.47, 0, g);                                  // the anvil: foot, waist and face
      box(0.18, 0.12, 0.14, iron, 0, 0.56, 0, g);
      box(0.46, 0.07, 0.2, iron, 0, TOP - 0.035, 0, g);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 12), iron);
      horn.rotation.z = -Math.PI / 2; horn.position.set(0.37, TOP - 0.045, 0); g.add(horn);
      box(0.1, 0.05, 0.2, dark, -0.27, TOP - 0.04, 0, g);
    });
    o.assembly = new THREE.Group();                                              // the piece he is shaping
    o.assembly.position.set(0, TOP + 0.02, 0);
    o.group.add(o.assembly);
    o.setParts = (n) => {
      clearGroup(o.assembly);
      for (let i = 0; i < Math.min(4, n); i++) {
        const m = plankMesh(0.26, 0.04, 0.05, barMat);
        m.position.set((i % 2 ? 1 : -1) * 0.04, 0.02 + Math.floor(i / 2) * 0.045, (i % 3 - 1) * 0.04);
        m.rotation.y = (i % 2 ? 1 : -1) * (0.5 - i * 0.1);
        o.assembly.add(m);
      }
    };
    o.setParts(0);
    // the hammer: a steel head on a wooden handle; the head is at the group's origin, the handle runs along +y
    o.tool = new THREE.Group();
    const head = box(0.14, 0.06, 0.06, iron, 0, 0, 0, o.tool); head.castShadow = true;
    box(0.028, 0.3, 0.028, mat(0x9a6b3d), 0, 0.17, 0, o.tool);
    o.group.add(o.tool);
    o.toolRest = { pos: V(0.1, TOP + 0.04, 0.12), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, Math.PI / 2)) };
    o.resetTool = () => { o.tool.position.copy(o.toolRest.pos); o.tool.quaternion.copy(o.toolRest.quat); };
    o.resetTool();
    o.TOP = TOP;
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ sander
  const sander = (x = 0, z = 0) => {
    const grey = mat(0x6b7480), dark = mat(0x2b3a42), grit = mat(0x6a5a46, { roughness: 1 });
    const S = 0.72;                                                              // the height of the belt, waist high
    const o = makeObject('sander', x, z, 0.72, 0.56, S + 0.4, 'medium', (g) => {
      box(0.6, S - 0.04, 0.4, grey, 0, (S - 0.04) / 2, 0, g);                    // the stand
      box(0.62, 0.04, 0.42, dark, 0, S - 0.02, 0, g);
      box(0.5, 0.02, 0.16, grit, 0, S + 0.02, 0.02, g);                          // the belt where the wood goes
      box(0.52, 0.06, 0.02, dark, 0, S + 0.04, -0.08, g);                        // guards
      box(0.2, 0.2, 0.18, dark, 0.24, S + 0.12, -0.12, g);                       // the motor
      box(0.12, 0.14, 0.14, mat(0xb9a98a), -0.24, S + 0.09, -0.1, g);            // dust bag
      box(0.06, 0.04, 0.02, mat(0xe53935), -0.2, S - 0.14, 0.205, g);            // switch
    });
    for (const sx of [-0.25, 0.25]) {                                            // the two rollers: they turn while it runs
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), mat(0x222222));
      r.rotation.x = Math.PI / 2; r.position.set(sx, S + 0.02, 0.02);
      o.group.add(r);
      (o.rollers ||= []).push(r);
    }
    o.running = 0;
    o.run = (secs) => { o.running = secs; };
    onUpdate(o, (dt) => {
      if (o.running > 0) { o.running = Math.max(0, o.running - dt); o.rollers.forEach((r) => { r.rotation.y += dt * 14; }); o.group.position.y = Math.sin(o.running * 70) * 0.002; }
      else o.group.position.y = 0;
    });
    o.BELT = S + 0.03;
    o.surfacePoint = () => o.at(0, S + 0.05, 0.02);
    return addAt(o);
  };

  return { workbench, toolbox, woodfactory, saw, mallet, sander, metalfactory, metalcutter, welder, anvil, plankMesh, fillPile };
}
