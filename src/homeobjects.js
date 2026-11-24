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

  // ------------------------------------------------------------------------------------------------ reading desk
  // A writing desk with a drawer pedestal, a green banker's lamp (switched by its pull chain: it glows, and lights a pool on the desk) and an
  // open book. Its front (where he stands) is local +z.
  const libdesk = (name, x = 0, z = 0) => {
    const wood = mat(WOOD), dark = mat(WOOD_DARK), brass = mat(0xc9a44a, { metalness: 0.6, roughness: 0.35 });
    let shade = null, pool = null, left = null, right = null;
    const o = makeObject(name, x, z, 1.3, 0.65, 0.76, 'heavy', (g) => {
      box(1.3, 0.05, 0.65, dark, 0, 0.735, 0, g);                                // the top
      box(1.2, 0.012, 0.5, mat(0x2f5a3a), 0, 0.766, -0.02, g);                     // a green leather writing pad
      for (const sx of [-0.6, 0.6]) box(0.05, 0.71, 0.05, wood, sx, 0.355, 0.27, g);              // the front legs
      box(0.05, 0.71, 0.05, wood, -0.6, 0.355, -0.27, g);
      box(0.42, 0.71, 0.6, wood, 0.42, 0.355, 0, g);                               // the drawer pedestal (right)
      for (const y of [0.15, 0.38, 0.6]) { box(0.38, 0.18, 0.015, mat(0xc79a62), 0.42, y, 0.305, g); box(0.08, 0.02, 0.02, brass, 0.42, y, 0.32, g); }
      box(1.2, 0.3, 0.02, wood, -0.05, 0.56, -0.3, g);                             // the modesty panel at the back
      // the banker's lamp: a brass stand and a green glass shade, towards the back left
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.03, 16), brass); base.position.set(-0.4, 0.775, -0.18); g.add(base);
      box(0.02, 0.24, 0.02, brass, -0.4, 0.89, -0.18, g);
      // (the shade: a long green glass tube lying across the top of the stand, its ends capped in brass)
      shade = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 20), mat(0x1f7a4a, { emissive: 0x2fbf6a, emissiveIntensity: 0, roughness: 0.25 }));
      shade.rotation.z = Math.PI / 2; shade.position.set(-0.4, 1.03, -0.16); g.add(shade);
      for (const sx of [-0.152, 0.152]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.012, 20), brass); cap.rotation.z = Math.PI / 2; cap.position.set(-0.4 + sx, 1.03, -0.16); g.add(cap); }
      box(0.004, 0.12, 0.004, brass, -0.32, 0.93, -0.1, g);                       // the pull chain
      // the pool of light on the desk, shown while the lamp is on
      pool = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(-0.2, 0.774, 0.0); g.add(pool);
      // an open book: two pages that can turn
      box(0.42, 0.015, 0.3, mat(0x7a2f2f), 0.02, 0.777, 0.08, g);
      left = box(0.2, 0.012, 0.28, mat(0xf6efdc), -0.085, 0.79, 0.08, g);
      right = new THREE.Group(); right.position.set(0.02, 0.79, 0.08); g.add(right);
      box(0.2, 0.012, 0.28, mat(0xf6efdc), 0.105, 0, 0, right);
    });
    o.lamp = 0; o.lampTo = 0;
    o.setLamp = (v) => { o.lampTo = v ? 1 : 0; };
    o.lampOn = () => o.lampTo > 0;
    o.turn = 0;                                                                   // a page turning: 0 flat on the right ... 1 over on the left
    o.turnPage = () => { o.turn = 0.001; };
    onUpdate(o, (dt) => {
      if (o.lamp !== o.lampTo) { o.lamp = ease(o.lamp, o.lampTo, dt, 8); if (Math.abs(o.lamp - o.lampTo) < 0.01) o.lamp = o.lampTo; shade.material.emissiveIntensity = o.lamp * 1.1; pool.material.opacity = o.lamp * 0.45; }
      if (o.turn > 0) { o.turn = Math.min(1, o.turn + dt / 0.6); right.rotation.z = Math.sin(o.turn * Math.PI) * 1.4; if (o.turn >= 1) { o.turn = 0; right.rotation.z = 0; } }
    });
    void left;
    o.chainPoint = () => o.at(-0.32, 0.88, -0.1);
    o.pagePoint = (k = 0.5) => o.at(0.02 + (k - 0.5) * 0.3, 0.82, 0.12);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ globe
  // A globe on a wooden tripod stand, in a brass meridian ring, tilted like the Earth. A hand on its side sets it spinning; it slows down by
  // itself. Its front is local +z.
  const globe = (name, x = 0, z = 0) => {
    const wood = mat(WOOD_DARK), brass = mat(0xc9a44a, { metalness: 0.6, roughness: 0.35 });
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const cx = c.getContext('2d');
    cx.fillStyle = '#3f78b5'; cx.fillRect(0, 0, 256, 128);
    cx.fillStyle = '#d9c48a';                                                     // land: a few blobs, the same every time
    for (const [ux, uy, r] of [[40, 40, 22], [60, 58, 16], [70, 90, 14], [128, 36, 18], [140, 64, 24], [150, 96, 12], [200, 44, 20], [214, 80, 16], [230, 104, 10], [100, 110, 9]]) {
      cx.beginPath(); cx.ellipse(ux, uy, r * 1.3, r, 0, 0, Math.PI * 2); cx.fill();
    }
    cx.strokeStyle = 'rgba(255,255,255,0.35)'; cx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { cx.beginPath(); cx.moveTo(0, i * 128 / 6); cx.lineTo(256, i * 128 / 6); cx.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    let ball = null;
    const R = 0.2, CY = 0.82;
    const o = makeObject(name, x, z, 0.55, 0.55, CY + R + 0.05, 'medium', (g) => {
      for (let i = 0; i < 3; i++) {                                               // the tripod legs
        const a = (i / 3) * Math.PI * 2, leg = box(0.035, 0.66, 0.035, wood, Math.sin(a) * 0.11, 0.31, Math.cos(a) * 0.11, g);
        leg.rotation.set(-Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);              // (the feet splay out, the tops meet under the column)
      }
      box(0.05, 0.12, 0.05, wood, 0, 0.62, 0, g);                                 // the column the ring stands on
      const tilt = new THREE.Group(); tilt.position.set(0, CY, 0); tilt.rotation.z = 0.41; g.add(tilt);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.025, 0.008, 6, 40), brass); ring.rotation.y = Math.PI / 2; tilt.add(ring);
      box(0.012, 0.06, 0.012, brass, 0, R + 0.03, 0, tilt); box(0.012, 0.06, 0.012, brass, 0, -R - 0.03, 0, tilt);
      ball = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
      tilt.add(ball);
    });
    o.spinV = 0;
    o.spin = (v) => { o.spinV = v; };
    onUpdate(o, (dt) => { if (Math.abs(o.spinV) > 0.01) { ball.rotation.y += o.spinV * dt; o.spinV *= Math.exp(-dt * 0.35); } else o.spinV = 0; });
    o.sidePoint = (sx = 1) => o.at(sx * 0.12, CY + 0.02, R * 0.85);              // a hand on the front of the globe, a little to one side
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ record player
  // A wooden cabinet with a turntable on top: a platter with a record on it, and a tonearm that swings onto it. Its front is local +z. Playing
  // (`setPlaying`): the arm comes round onto the record and the platter turns up to speed; stopped, the arm lifts back and the platter slows.
  const recordplayer = (name, x = 0, z = 0) => {
    const wood = mat(WOOD), dark = mat(WOOD_DARK), black = mat(0x15161a, { roughness: 0.5 }), chrome = mat(STEEL, { roughness: 0.3, metalness: 0.7 });
    const C = { x: -0.05, z: 0.05 }, P = { x: 0.29, z: -0.06 }, ARM = 0.34, DECK = 0.73, REST = -0.3, ON = -0.9, END = -1.02;
    let platter = null, arm = null, led = null;
    const o = makeObject(name, x, z, 0.8, 0.5, 0.9, 'light', (g) => {
      box(0.8, 0.65, 0.5, wood, 0, 0.325, 0, g);                                     // the cabinet
      box(0.74, 0.02, 0.012, dark, 0, 0.42, 0.253, g);                              // (a shelf of records behind the front: two dark slots)
      box(0.74, 0.02, 0.012, dark, 0, 0.24, 0.253, g);
      box(0.8, 0.04, 0.5, dark, 0, 0.67, 0, g);                                    // the top
      box(0.72, 0.04, 0.42, mat(0x2a2d33, { roughness: 0.5 }), 0, 0.71, 0, g);     // the deck
      platter = new THREE.Group(); platter.position.set(C.x, DECK + 0.005, C.z); g.add(platter);
      const cyl = (r, h, m, y) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), m); c.position.y = y; c.castShadow = true; platter.add(c); return c; };
      cyl(0.17, 0.02, chrome, 0.0); cyl(0.155, 0.008, black, 0.014); cyl(0.05, 0.01, mat(0xd0312d, { roughness: 0.5 }), 0.018);
      const mark = box(0.02, 0.012, 0.1, mat(0xf0e6d2), 0, 0.02, -0.1, platter);        // (a pale stripe on the record: you can see it turn)
      void mark;
      const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8), chrome); spindle.position.set(C.x, DECK + 0.03, C.z); g.add(spindle);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.04, 20), chrome); base.position.set(P.x, DECK + 0.02, P.z); g.add(base);
      arm = new THREE.Group(); arm.position.set(P.x, DECK + 0.07, P.z); g.add(arm);
      box(0.012, 0.012, ARM, chrome, 0, 0, ARM / 2, arm);                           // the arm (along its local +z)
      box(0.03, 0.014, 0.05, black, 0, -0.004, ARM + 0.01, arm);                    // the head shell
      box(0.024, 0.024, 0.06, chrome, 0, 0, -0.04, arm);                            // the counterweight
      led = box(0.016, 0.016, 0.016, mat(0x333333), 0.33, 0.71 + 0.025, 0.2, g);
    });
    o.kind = 'recordplayer';
    o.playing = false; o.spin = 0; o.armA = REST; o.armTo = REST; o.groove = 0;
    o.setPlaying = (on) => { o.playing = on; o.armTo = on ? ON : REST; led.material.color.set(on ? 0x22ff66 : 0x333333); };
    o.armPoint = () => o.at(P.x + Math.sin(o.armA) * (ARM + 0.01), DECK + 0.1, P.z + Math.cos(o.armA) * (ARM + 0.01));
    o.armRestPoint = () => o.at(P.x + Math.sin(REST) * (ARM + 0.01), DECK + 0.1, P.z + Math.cos(REST) * (ARM + 0.01));
    o.armOnPoint = () => o.at(P.x + Math.sin(ON) * (ARM + 0.01), DECK + 0.1, P.z + Math.cos(ON) * (ARM + 0.01));
    onUpdate(o, (dt) => {
      o.spin = ease(o.spin, o.playing ? 3.5 : 0, dt, o.playing ? 2.5 : 0.8);                  // (rad/s: a record turns at 33 rpm; a little faster to be seen)
      platter.rotation.y += o.spin * dt;
      if (o.playing && Math.abs(o.armA - ON) < 0.03) o.landed = true;
      if (o.playing && o.landed) { o.groove = Math.min(1, o.groove + dt / 90); o.armTo = ON + (END - ON) * o.groove; }       // (it works its way in over the record)
      if (!o.playing) { o.groove = 0; o.landed = false; }
      o.armA = ease(o.armA, o.armTo, dt, 3);
      arm.rotation.y = o.armA;
    });
    return addAt(o);
  };

  return { bed, wardrobe, bedside, libshelf, libdesk, globe, recordplayer };
}
