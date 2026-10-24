// The Workshop's furniture and machines: the workbench, the toolbox, the Wood Factory and the Metal Factory. The two factories do all the
// building: Guy presses the button, the factory runs, and the finished thing stands on its tray. Built with the same makeObject helper
// as the rest of the room (room.js passes it in), and placed in the added room's own frame (room.js, NEW_OBJECTS). Every one has its
// front on local +z, which is where Guy stands, and a few methods the activities in workbrain.js use: `at(x, y, z)` (an object-local
// point in the world) and the state the models show (the opening lid, the finished thing on the tray ...).
import * as THREE from 'three';

const WOOD = 0xc89b62, WOOD_DARK = 0x8a5a2e, WOOD_LIGHT = 0xe3c08a, STEEL = 0x8a929c, RED = 0xc0392b, TEAL = 0x2a9d8f, ORANGE = 0xd9772b, BAR = 0xb4bcc6;

export function makeWorkshopBuilders({ makeObject, box, mat }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const barMat = mat(BAR, { metalness: 0.75, roughness: 0.3 });
  const clearGroup = (grp) => { while (grp.children.length) { const c = grp.children[0]; grp.remove(c); if (c.geometry) c.geometry.dispose(); } };
  // every object: a world point from an object-local one (x right, y up, z towards Guy)
  const addAt = (o) => { o.at = (x, y, z) => { o.group.updateWorldMatrix(true, false); return o.group.localToWorld(V(x, y, z)); }; return o; };
  // wrap the per-frame update the room already calls on every object
  const onUpdate = (o, fn) => { const base = o.update; o.update = function (dt) { base.call(this, dt); fn(dt); }; };

  // A small model of something a factory has made, standing at the origin of `g` (the factory's tray). `kind` is what the recipe makes
  // ('hardware' is the metal part of an electric guitar, made at the Metal Factory before the Wood Factory makes the body).
  const productModel = (g, kind) => {
    const light = mat(WOOD_LIGHT), wd = mat(WOOD);
    if (kind === 'hardware') {
      box(0.2, 0.04, 0.1, barMat, 0, 0.02, 0, g);
      box(0.04, 0.1, 0.04, barMat, 0.08, 0.09, 0, g);
      box(0.16, 0.03, 0.03, barMat, -0.02, 0.055, 0.06, g);
    } else if (kind === 'metalchair') {
      box(0.22, 0.025, 0.22, barMat, 0, 0.2, 0, g);
      for (const sx of [-0.09, 0.09]) for (const sz of [-0.09, 0.09]) box(0.025, 0.19, 0.025, barMat, sx, 0.095, sz, g);
      box(0.22, 0.2, 0.02, barMat, 0, 0.32, -0.1, g);
    } else if (kind === 'diningtable3' || kind === 'diningtable4') {
      const top = kind === 'diningtable4' ? barMat : light;
      box(0.36, 0.025, 0.24, top, 0, 0.2, 0, g);
      for (const sx of [-0.15, 0.15]) for (const sz of [-0.09, 0.09]) box(0.03, 0.19, 0.03, kind === 'diningtable4' ? barMat : wd, sx, 0.095, sz, g);
    } else if (kind === 'bookshelf2') {
      for (const sx of [-0.14, 0.14]) box(0.025, 0.5, 0.12, wd, sx, 0.25, 0, g);
      for (const y of [0.02, 0.17, 0.32, 0.47]) box(0.3, 0.025, 0.12, light, 0, y, 0, g);
    } else if (kind === 'eguitar') {
      box(0.16, 0.24, 0.035, mat(0xc0392b), 0, 0.12, 0, g);
      box(0.035, 0.26, 0.03, mat(0x2b2b2b), 0, 0.37, 0, g);
    } else if (kind === 'footstool') {
      box(0.26, 0.03, 0.2, light, 0, 0.19, 0, g);
      for (const sx of [-0.1, 0.1]) for (const sz of [-0.07, 0.07]) box(0.035, 0.18, 0.035, wd, sx, 0.09, sz, g);
    } else {                                                                     // a chair
      box(0.22, 0.025, 0.22, light, 0, 0.2, 0, g);
      for (const sx of [-0.09, 0.09]) for (const sz of [-0.09, 0.09]) box(0.03, 0.19, 0.03, wd, sx, 0.095, sz, g);
      box(0.22, 0.2, 0.025, light, 0, 0.32, -0.1, g);
    }
  };

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

  // ------------------------------------------------------------------------------------------------ the factories
  // What the two have in common: the big red button, a light that goes green while it runs, a gear on the side that turns, and the tray
  // the finished thing stands on (`showMade(kind)`, `clearMade()`). They stand on a raised plinth so the button and the tray are at Guy's
  // hands. `body` and `extras` are what make one a Wood Factory and the other a Metal Factory.
  const L = 0.22;
  const factory = (name, x, z, body, dressing, gearSpeed, shake) => {
    const dark = mat(0x2b3a42), steel = mat(STEEL, { metalness: 0.5, roughness: 0.4 });
    const o = makeObject(name, x, z, 0.95, 0.85, 1.7, 'heavy', (g) => {
      box(0.95, 0.1 + L, 0.75, dark, 0, (0.1 + L) / 2, -0.02, g);                // plinth
      box(0.88, 0.85, 0.66, body, 0, 0.1 + L + 0.425, -0.04, g);                 // the machine
      box(0.5, 0.34, 0.02, dark, 0, L + 0.78, 0.3, g);                           // control panel
      box(0.36, 0.1, 0.02, mat(0x1b242a), 0, L + 0.5, 0.3, g);                   // slot the finished thing comes out of
      box(0.5, 0.03, 0.3, steel, 0, L + 0.38, 0.46, g);                          // the tray
      box(0.5, 0.05, 0.015, steel, 0, L + 0.405, 0.605, g);
      box(0.015, 0.05, 0.3, steel, -0.25, L + 0.405, 0.46, g);
      box(0.015, 0.05, 0.3, steel, 0.25, L + 0.405, 0.46, g);
      dressing(g);
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
    o.tray = new THREE.Group();                                                  // what the factory has made, waiting on the tray
    o.tray.position.set(0, L + 0.395, 0.46);
    o.group.add(o.tray);
    o.showMade = (kind) => { clearGroup(o.tray); if (kind) productModel(o.tray, kind); };
    o.clearMade = () => clearGroup(o.tray);
    o.running = 0; o.pressed = 0;
    onUpdate(o, (dt) => {
      o.pressed = Math.max(0, o.pressed - dt * 3);
      o.button.position.z = 0.335 - 0.03 * Math.min(1, o.pressed * 3);
      if (o.running > 0) {
        o.running = Math.max(0, o.running - dt);
        o.gear.rotation.x += dt * gearSpeed;
        o.light.material.color.set(0x44dd66);
        o.group.position.y = Math.sin(o.running * shake) * 0.004;                // it shakes while it runs
      } else { o.light.material.color.set(0x884444); o.group.position.y = 0; }
    });
    o.press = () => { o.pressed = 0.4; };
    o.run = (secs) => { o.running = secs; };
    o.buttonPoint = () => o.at(0, L + 0.82, 0.37);
    o.trayPoint = () => o.at(0, L + 0.5, 0.46);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ Wood Factory
  const woodfactory = (x = 0, z = 0) => {
    const steel = mat(STEEL, { metalness: 0.5, roughness: 0.4 });
    return factory('woodfactory', x, z, mat(TEAL), (g) => {
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
    }, 9, 60);
  };

  // ------------------------------------------------------------------------------------------------ Metal Factory
  const metalfactory = (x = 0, z = 0) => {
    const dark = mat(0x2b3a42);
    return factory('metalfactory', x, z, mat(ORANGE), (g) => {
      const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.34, 4, 1, true), mat(0xb35f1c, { side: THREE.DoubleSide }));
      hopper.position.set(0, L + 1.28, -0.04); hopper.rotation.y = Math.PI / 4; hopper.castShadow = true;
      g.add(hopper);
      for (let i = 0; i < 5; i++) box(0.5, 0.07, 0.12, barMat, -0.04 + (i % 2) * 0.06, L + 1.2 + Math.floor(i / 2) * 0.08, -0.04 + (i % 3 - 1) * 0.12, g);       // bars in the hopper
      const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), dark);
      chim.position.set(0.32, L + 1.3, -0.2); g.add(chim);
    }, 7, 55);
  };

  return { workbench, toolbox, woodfactory, metalfactory };
}
