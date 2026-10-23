// The Build a Bot machine: a 3D printer under a glass hood. Guy presses its button, a print head sweeps over the bed while a glowing
// outline of a robot grows, and then the machine folds itself away into GAL (src/gal.js). It can only be used once.
// Built with the same makeObject helper as the rest of the room; its front (the button panel) is local +z.
import * as THREE from 'three';

export function makeBotBuilders({ makeObject, box, mat }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const addAt = (o) => { o.at = (x, y, z) => { o.group.updateWorldMatrix(true, false); return o.group.localToWorld(V(x, y, z)); }; return o; };
  const onUpdate = (o, fn) => { const base = o.update; o.update = function (dt) { base.call(this, dt); fn(dt); }; };

  const botprinter = (x = 0, z = 0) => {
    const steel = mat(0x6d7783, { metalness: 0.6, roughness: 0.35 }), dark = mat(0x262c34, { metalness: 0.3, roughness: 0.5 }), light = mat(0xdfe5ec);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const o = makeObject('botprinter', x, z, 1.4, 1.2, 2.0, 'heavy', (g) => {
      box(1.4, 0.55, 1.2, dark, 0, 0.275, 0, g);                                     // the cabinet
      box(1.2, 0.04, 1.0, light, 0, 0.57, 0, g);                                     // the print bed
      box(1.42, 0.03, 1.22, steel, 0, 0.56, 0, g);
      for (const [px, pz] of [[-0.66, -0.56], [0.66, -0.56], [-0.66, 0.56], [0.66, 0.56]]) box(0.06, 1.4, 0.06, steel, px, 1.27, pz, g);     // posts
      box(1.4, 0.08, 1.2, steel, 0, 2.0 - 0.04, 0, g);                               // the top
      for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.26, 1.36, 0.02), glass); p.position.set(0, 1.27, sz * 0.58); g.add(p); }
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.36, 1.12), glass); p.position.set(sx * 0.68, 1.27, 0); g.add(p); }
      box(1.3, 0.06, 0.06, steel, 0, 1.85, -0.5, g);                                 // gantry rail along the back
      box(0.36, 0.28, 0.3, mat(0x1f2a36), -0.5, 0.4, 0.62, g);                       // the control panel on the front
      box(0.04, 0.04, 0.02, mat(0x66ccff), -0.5, 0.52, 0.775, g);
    });
    // the print head: rides the gantry, sweeps over the bed while printing
    o.head = new THREE.Group();
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), mat(0xff8a3d)); hb.position.y = 0.0; o.head.add(hb);
    const noz = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 10), mat(0xdddddd)); noz.position.y = -0.12; noz.rotation.x = Math.PI; o.head.add(noz);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.8 }));
    beam.visible = false; o.head.add(beam);
    o.head.position.set(0, 1.78, -0.5);
    o.group.add(o.head);
    // the glowing outline of the robot, growing from the bed up
    o.ghost = new THREE.Group();
    const gm = new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.35, depthWrite: false });
    const mk = (geo, px, py, pz) => { const m = new THREE.Mesh(geo, gm); m.position.set(px, py, pz); o.ghost.add(m); return m; };
    mk(new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), 0, 0.82, 0);                      // torso (relative to a 1.6 m robot standing on the bed)
    mk(new THREE.SphereGeometry(0.1, 12, 10), 0, 1.2, 0);                            // head
    for (const sx of [-1, 1]) { mk(new THREE.CapsuleGeometry(0.05, 0.36, 4, 8), sx * 0.2, 0.78, 0); mk(new THREE.CapsuleGeometry(0.06, 0.55, 4, 8), sx * 0.08, 0.32, 0); }
    o.ghost.position.set(0, 0.59, 0); o.ghost.visible = false;
    o.group.add(o.ghost);
    o.light = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
    o.light.position.set(-0.5, 0.52, 0.78); o.group.add(o.light);

    o.running = 0; o.total = 1; o.progress = 0; o.used = false; o.t = 0;
    // start printing: `secs` seconds until the outline is complete
    o.run = (secs) => { o.running = secs; o.total = secs; o.progress = 0; o.ghost.visible = true; beam.visible = true; };
    onUpdate(o, (dt) => {
      o.t += dt;
      if (o.running > 0) {
        o.running = Math.max(0, o.running - dt);
        o.progress = 1 - o.running / o.total;
        o.head.position.x = Math.sin(o.t * 2.3) * 0.5;
        o.head.position.z = -0.5 + 0.5 * (0.5 + 0.5 * Math.sin(o.t * 1.7)) + 0.35 * Math.sin(o.t * 3.1) * 0.3;
        o.head.position.y = 0.75 + (1.78 - 0.75) * (1 - o.progress);
        beam.scale.y = 0.2; beam.position.y = -0.2;
        o.ghost.scale.set(1, Math.max(0.02, o.progress), 1);
        o.light.material.color.set(Math.floor(o.t * 6) % 2 ? 0xffaa22 : 0x331100);
        if (o.running === 0) { beam.visible = false; o.head.position.set(0, 1.78, -0.5); o.light.material.color.set(0x33ff66); }
      }
    });
    o.buttonPoint = () => o.at(-0.5, 0.52, 0.8);                                      // Guy's finger on the panel
    return addAt(o);
  };
  // The Learning Workstation: a desk with a big screen. Guy taps the screen and a panel lists the books on the shelf; pressing Learn on one
  // teaches him (or GAL) what is in it at once. Its front (the screen) is local +z.
  const workstation = (x = 0, z = 0) => {
    const steel = mat(0x6d7783, { metalness: 0.6, roughness: 0.35 }), dark = mat(0x262c34, { metalness: 0.3, roughness: 0.5 }), top = mat(0x394553);
    const o = makeObject('workstation', x, z, 1.3, 0.7, 1.45, 'heavy', (g) => {
      box(1.3, 0.06, 0.7, top, 0, 0.75, 0, g);                                       // the desk top
      for (const [px, pz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) box(0.06, 0.72, 0.06, steel, px, 0.36, pz, g);
      box(1.2, 0.05, 0.5, dark, 0, 0.3, 0, g);                                       // the shelf under the desk
      box(0.5, 0.03, 0.18, mat(0x1b2128), 0, 0.795, 0.22, g);                        // the keyboard
      box(0.14, 0.2, 0.1, steel, 0, 0.88, -0.2, g);                                  // the monitor's stand
      box(0.98, 0.58, 0.05, dark, 0, 1.17, -0.2, g);                                 // the monitor
      box(0.34, 0.1, 0.3, steel, -0.45, 0.83, 0.05, g);                              // the book scanner
    });
    o.screenMat = new THREE.MeshBasicMaterial({ color: 0x1a6fb0 });
    o.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.48), o.screenMat); o.screen.position.set(0, 1.17, -0.17); o.group.add(o.screen);
    o.lines = [];                                                                       // rows of "text" on the screen
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + (i % 2) * 0.2, 0.035), new THREE.MeshBasicMaterial({ color: 0xbfe6ff })); l.position.set(-0.12 + (i % 2) * 0.06, 1.3 - i * 0.07, -0.168); o.group.add(l); o.lines.push(l); }
    o.active = 0; o.t = 0;
    o.setActive = (secs = 6) => { o.active = secs; };
    onUpdate(o, (dt) => {
      o.t += dt;
      o.active = Math.max(0, o.active - dt);
      const on = o.active > 0;
      o.screenMat.color.set(on ? (Math.floor(o.t * 5) % 2 ? 0x2f9bff : 0x2688e0) : 0x1a6fb0);
      o.lines.forEach((l, i) => { l.visible = on || i < 2; l.scale.x = on ? 0.6 + 0.4 * Math.abs(Math.sin(o.t * 3 + i)) : 1; });
    });
    o.screenPoint = () => o.at(0.1, 1.0, -0.05);                                       // Guy's finger on the screen
    return addAt(o);
  };
  return { botprinter, workstation };
}
