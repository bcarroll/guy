// The furniture GUY and GAL build for the Bedroom and the Library (recipes in workshop.js, wants in needs.js, what they do in homebrain.js).
// Built with the same makeObject helper as the rest of the room (room.js passes it in). The bed has its HEAD at local +z and its foot at -z
// (he sits down on the foot end, like on a chair, which faces -z); the wardrobe, the bedside table and the bookshelves have their front on
// local +z. Each has a few methods the activities use: `at(x, y, z)` (an object-local point in the world), and the state its model shows (the
// opening doors, the drawer, the rumpled blanket).
import * as THREE from 'three';

const WOOD = 0xb58a58, WOOD_DARK = 0x6e4a2a, CREAM = 0xf0e6d2, STEEL = 0xb4bcc6;

export function makeHomeBuilders({ makeObject, box, mat }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const addAt = (o) => { o.at = (x, y, z) => { o.group.updateWorldMatrix(true, false); return o.group.localToWorld(V(x, y, z)); }; return o; };
  const onUpdate = (o, fn) => { const base = o.update; o.update = function (dt) { base.call(this, dt); fn(dt); }; };
  const ease = (cur, to, dt, rate = 6) => cur + (to - cur) * Math.min(1, dt * rate);

  // ------------------------------------------------------------------------------------------------ bed
  const bed = (name, x = 0, z = 0) => {
    const o = makeObject(name, x, z, 1.5, 2.2, 0.9, 'heavy', (g) => {
      box(1.5, 0.3, 2.2, mat(WOOD_DARK), 0, 0.15, 0, g);                         // the frame
      box(1.4, 0.2, 2.05, mat(CREAM), 0, 0.4, 0, g);                             // the mattress, its top at 0.5 m like a chair seat
      box(1.5, 0.9, 0.08, mat(WOOD), 0, 0.55, 1.06, g);                          // the headboard
      for (const sx of [-0.35, 0.35]) box(0.55, 0.12, 0.34, mat(0xffffff), sx, 0.56, 0.82, g);        // two pillows
    });
    o.sit = { seat: -0.7, gap: -1.5 };                                           // sat on at the foot end, shins over the edge
    o.homeSeat = true;
    o.blanket = new THREE.Group();
    box(1.42, 0.07, 0.95, mat(0x4c6fa5), 0, 0, 0, o.blanket);
    box(1.42, 0.075, 0.18, mat(0xe7edf5), 0, 0.005, 0.38, o.blanket);            // the turned-down sheet
    o.blanket.position.set(0, 0.535, 0.15);
    o.group.add(o.blanket);
    o.made = 1; o.madeTo = 1;
    o.setMade = (v) => { o.madeTo = v ? 1 : 0; };
    const apply = () => { const r = 1 - o.made; o.blanket.rotation.y = r * 0.18; o.blanket.rotation.z = r * 0.05; o.blanket.position.x = r * 0.12; o.blanket.position.z = 0.15 - r * 0.2; o.blanket.scale.y = 1 + r * 2.2; };
    onUpdate(o, (dt) => { if (o.made !== o.madeTo) { o.made = ease(o.made, o.madeTo, dt, 3); if (Math.abs(o.made - o.madeTo) < 0.01) o.made = o.madeTo; apply(); } });
    o.pillowPoint = () => o.at(0.35, 0.64, 0.82);
    o.blanketPoint = (k = 0.5, sx = 1) => o.at(sx * 0.4, 0.58, 0.1 + (k - 0.5) * 0.9);        // (along the near side of the blanket: a hand sweeps from the pillows to the foot)
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ wardrobe
  const wardrobe = (name, x = 0, z = 0) => {
    const wood = mat(WOOD), dark = mat(WOOD_DARK);
    const o = makeObject(name, x, z, 1.2, 0.6, 2.0, 'heavy', (g) => {
      box(0.04, 1.96, 0.6, wood, -0.58, 0.98, 0, g); box(0.04, 1.96, 0.6, wood, 0.58, 0.98, 0, g);      // the sides
      box(1.2, 0.04, 0.6, wood, 0, 1.98, 0, g); box(1.2, 0.08, 0.6, dark, 0, 0.04, 0, g);              // top and plinth
      box(1.16, 1.9, 0.03, dark, 0, 1.0, -0.285, g);                                                  // the back
      box(1.12, 0.03, 0.03, mat(STEEL, { metalness: 0.6 }), 0, 1.7, 0, g);                            // the hanging rail
      let i = 0;
      for (const c of [0xc0392b, 0x2a9d8f, 0xe3c08a, 0x4c6fa5, 0x8e44ad, 0xd9772b, 0x7f8c8d, 0xc0392b]) box(0.07, 0.62, 0.34, mat(c), -0.5 + (i++) * 0.14, 1.36, 0, g);   // the clothes on it
      box(1.12, 0.03, 0.5, wood, 0, 0.7, 0, g);                                                       // a shelf with folded things
      box(0.4, 0.14, 0.34, mat(0xe7edf5), -0.3, 0.78, 0, g); box(0.4, 0.14, 0.34, mat(0x4c6fa5), 0.3, 0.78, 0, g);
    });
    // two doors hanging from the sides, swinging out
    o.doors = [-1, 1].map((s) => {
      const d = new THREE.Group();
      d.position.set(s * 0.6, 1.0, 0.3);
      box(0.59, 1.9, 0.03, wood, -s * 0.295, 0, 0.015, d);
      box(0.03, 0.2, 0.03, mat(STEEL, { metalness: 0.6 }), -s * 0.52, 0, 0.04, d);                    // the handle, by the middle
      o.group.add(d);
      return d;
    });
    o.open = 0; o.openTo = 0;
    o.setOpen = (v) => { o.openTo = v ? 1 : 0; };
    const apply = () => { o.doors[0].rotation.y = -o.open * 1.9; o.doors[1].rotation.y = o.open * 1.9; };
    apply();
    onUpdate(o, (dt) => { if (o.open !== o.openTo) { o.open = ease(o.open, o.openTo, dt, 5); if (Math.abs(o.open - o.openTo) < 0.01) o.open = o.openTo; apply(); } });
    o.handlePoint = () => o.at(0, 1.0, 0.36);
    o.insidePoint = () => o.at(0, 1.3, 0.1);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ bedside table
  const bedside = (name, x = 0, z = 0) => {
    const o = makeObject(name, x, z, 0.5, 0.45, 0.95, 'medium', (g) => {
      box(0.5, 0.5, 0.45, mat(WOOD), 0, 0.25, 0, g);                             // the cabinet, its top at 0.5 m
      box(0.54, 0.03, 0.49, mat(WOOD_DARK), 0, 0.515, 0, g);
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.04, 14), mat(WOOD_DARK)); lampBase.position.set(-0.1, 0.55, -0.04); g.add(lampBase);
      box(0.025, 0.2, 0.025, mat(STEEL, { metalness: 0.6 }), -0.1, 0.66, -0.04, g);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.15, 16, 1, true), mat(0xf6dca0, { emissive: 0xf0b050, emissiveIntensity: 0.55, side: THREE.DoubleSide })); shade.position.set(-0.1, 0.8, -0.04); g.add(shade);
      box(0.1, 0.07, 0.04, mat(0x222831), 0.14, 0.585, 0.08, g);                 // an alarm clock
    });
    o.drawer = new THREE.Group();
    box(0.44, 0.2, 0.02, mat(0xc79a62), 0, 0, 0, o.drawer);                      // the drawer front
    box(0.4, 0.03, 0.36, mat(WOOD_DARK), 0, -0.07, -0.19, o.drawer);            // the drawer's floor and what is in it
    box(0.12, 0.05, 0.1, mat(0xe0453b), -0.08, -0.03, -0.2, o.drawer);
    box(0.08, 0.02, 0.1, mat(STEEL, { metalness: 0.6 }), 0.0, -0.01, 0.015, o.drawer);   // the knob
    o.drawer.position.set(0, 0.34, 0.225);
    o.group.add(o.drawer);
    o.open = 0; o.openTo = 0;
    o.setOpen = (v) => { o.openTo = v ? 1 : 0; };
    const apply = () => { o.drawer.position.z = 0.225 + o.open * 0.26; };
    apply();
    onUpdate(o, (dt) => { if (o.open !== o.openTo) { o.open = ease(o.open, o.openTo, dt, 6); if (Math.abs(o.open - o.openTo) < 0.01) o.open = o.openTo; apply(); } });
    o.handlePoint = () => o.at(0, 0.38, 0.25);
    o.insidePoint = () => o.at(0, 0.33, 0.3);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ library bookshelf
  const libshelf = (name, x = 0, z = 0) => {
    const wood = mat(WOOD), dark = mat(WOOD_DARK);
    const o = makeObject(name, x, z, 1.5, 0.4, 1.9, 'heavy', (g) => {
      box(0.05, 1.9, 0.4, dark, -0.725, 0.95, 0, g); box(0.05, 1.9, 0.4, dark, 0.725, 0.95, 0, g);
      box(1.5, 0.05, 0.4, dark, 0, 1.875, 0, g); box(1.4, 1.8, 0.02, wood, 0, 0.95, -0.19, g);
      const rows = [0.1, 0.62, 1.12, 1.62];
      for (const y of rows) box(1.4, 0.04, 0.38, dark, 0, y, 0.01, g);
      // rows of books standing on the shelves, in a few colours (the same every time)
      const cols = [0x8e2f2f, 0x2f5a8e, 0x2f7a4f, 0xc9a227, 0x6b3f8e, 0xd9772b, 0x3a3a3a, 0xb5532f];
      let n = 0;
      for (let r = 0; r < 3; r++) {
        let u = -0.66;
        while (u < 0.62) {
          const w = 0.035 + ((n * 7) % 5) * 0.008, h = 0.28 + ((n * 3) % 4) * 0.05;
          box(w, h, 0.24, mat(cols[(n * 5 + r) % cols.length]), u + w / 2, rows[r] + 0.02 + h / 2, 0.02, g);
          u += w + 0.004; n++;
        }
      }
    });
    o.rowPoint = (row = 1, u = 0) => o.at(u, [0.5, 1.0, 1.45][Math.max(0, Math.min(2, row))], 0.18);
    return addAt(o);
  };

  return { bed, wardrobe, bedside, libshelf };
}
