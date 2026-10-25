// The Backyard: the open-air room's shell (grass, fence, the artificial sun and moon lights, the night tint) and its objects: soccer goal,
// basketball hoop, lawn chair, bird bath, sky switch, shed and push lawn mower. Built with the same makeObject helper as the rest of the
// game (room.js passes it in) and placed in the added room's own frame (room.js, NEW_OBJECTS). Every object has its front on local +z,
// which is where GUY stands. `at(x, y, z)` turns an object-local point into a world one (like the Workshop's objects).
//
// Day and night: the room has no real extra lights (cheap on phones). The "sun lamp" and "moon lamp" are two glowing fixtures on a gantry
// at the far fence; the active one is lit, the grass and fence change colour, and a see-through blue sheet over the yard darkens
// everything in it at night, with a few stars. `shell.sky.set(night)` flips it and `shell.sky.update(dt)` eases it.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DAY = { grass: new THREE.Color(0x5fa046) };
const NIGHT = { grass: new THREE.Color(0x2a5236) };

// The ball radii (the real sizes are a little small to see from the camera: these are rounded up).
export const YARD_BALL = { soccer: { r: 0.17, color: 0xf2f2f2 }, basketball: { r: 0.19, color: 0xd9741d } };

// ---------------------------------------------------------------------------------------------------------------------- the shell
// Fills `g` (the added room's group: x along the door wall, z away from the door as -z) with grass, a fence, a gantry with the two
// lamps and the night tint. Returns { sky, cut } : sky controls day/night, cut marks mown grass.
export function buildYardShell(g, L, N, height) {
  const grassMat = new THREE.MeshStandardMaterial({ color: DAY.grass, roughness: 1 });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(L, N), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, 0.004, -N / 2);
  grass.receiveShadow = true;
  g.add(grass);
  // mown stripes: a lighter patch is left behind the mower; they live in one group so they can be cleared in one go
  const cutGroup = new THREE.Group();
  g.add(cutGroup);
  const cutMat = new THREE.MeshStandardMaterial({ color: 0x86c45f, roughness: 1 });
  const cutGeo = new THREE.PlaneGeometry(0.5, 0.34);
  const cuts = [];
  const cut = {
    // a patch at a world point (the group is in the room's frame: convert)
    add(worldPos, yaw) {
      const lp = g.worldToLocal(worldPos.clone());
      let m;
      if (cuts.length >= 260) { m = cuts.shift(); } else { m = new THREE.Mesh(cutGeo, cutMat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; cutGroup.add(m); }
      m.position.set(lp.x, 0.007, lp.z);
      m.rotation.set(-Math.PI / 2, 0, 0);
      m.rotateZ(yaw - g.rotation.y);
      cuts.push(m);
    },
    clear() { while (cuts.length) cutGroup.remove(cuts.pop()); },
    count: () => cuts.length,
  };

  // the fence: a plank texture on single-sided panels round the three sides (like the walls of the other rooms, the ones that face away
  // from the camera vanish instead of hiding the yard)
  const fc = document.createElement('canvas');
  fc.width = 256; fc.height = 128;
  const fg = fc.getContext('2d');
  fg.fillStyle = '#2b1d12'; fg.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 16; i++) { fg.fillStyle = `hsl(32, 38%, ${44 + (i * 7) % 11}%)`; fg.fillRect(i * 16 + 1, 0, 14, 128); }
  fg.fillStyle = 'rgba(40,25,12,0.55)'; fg.fillRect(0, 22, 256, 6); fg.fillRect(0, 100, 256, 6);
  const fenceTex = new THREE.CanvasTexture(fc);
  fenceTex.colorSpace = THREE.SRGBColorSpace;
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  const FH = 1.5;
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, color: 0xffffff, roughness: 0.9 });
  const fence = (len, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, FH), fenceMat.clone());
    m.material.map = fenceTex.clone(); m.material.map.needsUpdate = true;
    m.material.map.repeat.set(len / 2, 1);
    m.position.set(x, FH / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    fenceMats.push(m.material);
    g.add(m);
  };
  const fenceMats = [];
  fence(L, 0, -N, 0);
  fence(N, -L / 2, -N / 2, Math.PI / 2);
  fence(N, L / 2, -N / 2, -Math.PI / 2);

  // the gantry on the far fence: a sun lamp and a moon lamp, side by side, high up
  const metal = new THREE.MeshStandardMaterial({ color: 0x5d6670, roughness: 0.5, metalness: 0.5 });
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd45a });
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff });
  const gantry = new THREE.Group();
  gantry.position.set(0, 0, -N + 0.25);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); gantry.add(mesh); return mesh; };
  for (const sx of [-1.7, 1.7]) add(new THREE.BoxGeometry(0.1, 2.9, 0.1), metal, sx, 1.45, 0);
  add(new THREE.BoxGeometry(3.5, 0.1, 0.1), metal, 0, 2.9, 0);
  const sunDisc = add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 28), sunMat, -0.8, 2.45, 0.1); sunDisc.rotation.x = Math.PI / 2;
  const sunRays = new THREE.Group(); sunRays.position.copy(sunDisc.position); gantry.add(sunRays);
  for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.04), sunMat); r.position.set(Math.sin((i / 12) * Math.PI * 2) * 0.62, Math.cos((i / 12) * Math.PI * 2) * 0.62, 0.1); r.rotation.z = -(i / 12) * Math.PI * 2; sunRays.add(r); }
  const moonDisc = add(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 28), moonMat, 0.8, 2.45, 0.1); moonDisc.rotation.x = Math.PI / 2;
  const bite = add(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 28), new THREE.MeshBasicMaterial({ color: 0x1b2540 }), 0.95, 2.5, 0.12); bite.rotation.x = Math.PI / 2;
  const offMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6 });
  g.add(gantry);

  // the night tint over the whole yard, and a few stars
  const tintMat = new THREE.MeshBasicMaterial({ color: 0x0a1c52, transparent: true, opacity: 0, depthWrite: false });
  const tint = new THREE.Mesh(new THREE.PlaneGeometry(L, N), tintMat);
  tint.rotation.x = Math.PI / 2;
  tint.position.set(0, height - 0.25, -N / 2);
  tint.renderOrder = 5;
  g.add(tint);
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 46; i++) pts.push((Math.sin(i * 12.9898) * 0.5) * L * 0.95, height - 0.22, -N / 2 + Math.sin(i * 78.233 + 1.7) * 0.5 * N * 0.95);
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = 6;
  g.add(stars);

  const sky = {
    night: false, k: 0,                                      // k: 0 = full day ... 1 = full night (eased)
    set(n) { sky.night = !!n; },
    snap(n) { sky.night = !!n; sky.k = n ? 1 : 0; sky.apply(); },
    apply() {
      const k = sky.k;
      grassMat.color.copy(DAY.grass).lerp(NIGHT.grass, k);
      for (const fm of fenceMats) fm.color.setScalar(1 - 0.5 * k);
      tintMat.opacity = 0.36 * k;
      starMat.opacity = Math.max(0, (k - 0.4) / 0.6) * 0.9;
      sunDisc.material = k < 0.5 ? sunMat : offMat;
      sunRays.visible = k < 0.5;
      moonDisc.material = k >= 0.5 ? moonMat : offMat;
      bite.visible = k >= 0.5;
    },
    update(dt) {
      const target = sky.night ? 1 : 0;
      if (Math.abs(sky.k - target) < 1e-3) { if (sky.k !== target) { sky.k = target; sky.apply(); } return; }
      sky.k += Math.sign(target - sky.k) * Math.min(Math.abs(target - sky.k), dt / 1.6);
      sky.apply();
    },
  };
  sky.apply();
  return { group: g, sky, cut, parts: { grass, tint, stars, sunDisc, moonDisc, gantry } };
}

// ---------------------------------------------------------------------------------------------------------------------- the objects
export function makeYardBuilders({ makeObject, box, mat }) {
  const addAt = (o) => { o.at = (x, y, z) => { o.group.updateWorldMatrix(true, false); return o.group.localToWorld(V(x, y, z)); }; return o; };
  const onUpdate = (o, fn) => { const base = o.update; o.update = function (dt) { base.call(this, dt); fn(dt); }; };
  const WHITE = 0xf4f4f0, ALU = 0xaeb6bf;
  const netMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.55 });

  // ---- soccer goal: a white frame with a net, mouth towards +z
  const soccergoal = (x = 0, z = 0) => {
    const white = mat(WHITE, { roughness: 0.4 });
    const o = makeObject('soccergoal', x, z, 2.5, 0.9, 1.25, 'heavy', (g) => {
      const R = 0.045;
      for (const sx of [-1.15, 1.15]) {
        box(R * 2, 1.15, R * 2, white, sx, 0.575, 0.35, g);               // front posts
        box(R * 2, 0.08, 0.8, white, sx, 0.04, 0, g);                      // bottom side rails
        box(R, 0.8, R, white, sx, 0.4, -0.4, g);                           // back uprights
        const top = box(R, R, 0.8, white, sx, 0.8, 0, g); top.rotation.x = -0.35;   // top side rails slope down to the back
      }
      box(2.4, R * 2, R * 2, white, 0, 1.15, 0.35, g);                     // crossbar
      box(2.3, R, R, white, 0, 0.8, -0.4, g);                              // back top bar
      // the net: back, two sides and the roof (wireframe planes)
      const nm = netMat();
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.8, 16, 6), nm); back.position.set(0, 0.4, -0.4); g.add(back);
      for (const sx of [-1.15, 1.15]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9, 6, 6), nm); s.rotation.y = Math.PI / 2; s.position.set(sx, 0.45, 0); g.add(s); }
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.88, 16, 6), nm); roof.rotation.x = Math.PI / 2 - 0.35; roof.position.set(0, 0.97, 0); g.add(roof);
    });
    addAt(o);
    o.goalMouth = () => o.at(0, 0.45, 0.1);               // where a good shot ends up
    o.netBack = () => o.at(0, 0.3, -0.3);
    return o;
  };

  // ---- basketball hoop: a pole with a backboard and a rim (rim centre 0.4 m in front of the board), facing +z
  const RIM_Y = 2.4;
  const basketballhoop = (x = 0, z = 0) => {
    const steel = mat(0x4b5560, { roughness: 0.5, metalness: 0.4 });
    let o_net;
    const o = makeObject('basketballhoop', x, z, 0.6, 1.0, 2.95, 'heavy', (g) => {
      box(0.5, 0.06, 0.5, steel, 0, 0.03, -0.45, g);                       // the base plate
      box(0.1, 2.75, 0.1, steel, 0, 1.4, -0.45, g);                        // the pole
      box(0.12, 0.12, 0.5, steel, 0, 2.7, -0.2, g);                        // the arm out to the board
      box(1.1, 0.7, 0.05, mat(0xf4f6f8, { roughness: 0.3 }), 0, 2.65, -0.01, g);   // the backboard
      box(1.1, 0.03, 0.055, mat(0xc0392b), 0, 2.31, -0.01, g); box(1.1, 0.03, 0.055, mat(0xc0392b), 0, 2.99, -0.01, g);
      box(0.03, 0.7, 0.055, mat(0xc0392b), -0.55, 2.65, -0.01, g); box(0.03, 0.7, 0.055, mat(0xc0392b), 0.55, 2.65, -0.01, g);
      box(0.4, 0.3, 0.055, mat(0xc0392b), 0, 2.55, -0.012, g);
      box(0.34, 0.24, 0.058, mat(0xf4f6f8), 0, 2.55, -0.012, g);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.014, 8, 28), mat(0xe2561b, { roughness: 0.4 }));
      rim.rotation.x = Math.PI / 2; rim.position.set(0, RIM_Y, 0.38); rim.castShadow = true; g.add(rim);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.12, 0.38, 14, 4, true), netMat());
      net.position.set(0, RIM_Y - 0.19, 0.38); g.add(net);
      o_net = net;
    });
    addAt(o);
    o.rimPoint = () => o.at(0, RIM_Y, 0.38);
    o.RIM_Y = RIM_Y;
    o.netSwing = 0;                                        // a swish: the net sways for a moment
    o.swish = () => { o.netSwing = 1; };
    onUpdate(o, (dt) => {
      if (o.netSwing > 0) { o.netSwing = Math.max(0, o.netSwing - dt * 1.4); o_net.scale.set(1 + 0.12 * Math.sin(o.netSwing * 18) * o.netSwing, 1 + 0.18 * o.netSwing, 1); }
      else o_net.scale.set(1, 1, 1);
    });
    return o;
  };

  // ---- lawn chair: aluminium frame with striped webbing; faces local -z like the other chairs (the seat is 0.5 m high so the sitting pose fits)
  const lawnchair = (x = 0, z = 0) => {
    const alu = mat(ALU, { metalness: 0.6, roughness: 0.35 });
    const web1 = mat(0x2a9d8f, { roughness: 0.9 }), web2 = mat(0xf2f2ea, { roughness: 0.9 });
    const o = makeObject('lawnchair', x, z, 0.62, 0.7, 0.95, 'light', (g) => {
      for (let i = 0; i < 7; i++) box(0.46, 0.025, 0.07, i % 2 ? web2 : web1, 0, 0.48, -0.2 + i * 0.075 - 0.04, g);          // the seat webbing (z -0.24 .. 0.21)
      for (let i = 0; i < 6; i++) { const b = box(0.46, 0.07, 0.025, i % 2 ? web2 : web1, 0, 0.62 + i * 0.07, 0.27 + i * 0.045, g); b.rotation.x = 0.57; }   // reclined back (leaning away from the front, along the line of the slats)
      for (const sx of [-0.25, 0.25]) {
        box(0.03, 0.03, 0.55, alu, sx, 0.52, -0.02, g);                     // the arms
        box(0.03, 0.5, 0.03, alu, sx, 0.25, -0.24, g);                      // the front legs
        box(0.03, 0.5, 0.03, alu, sx, 0.25, 0.21, g);                       // the back legs
        const bk = box(0.03, 0.5, 0.03, alu, sx, 0.8, 0.38, g); bk.rotation.x = 0.57;     // the back frame
      }
    });
    o.sit = { seat: 0.0, gap: -0.8 };
    o.yard = true;
    return addAt(o);
  };

  // ---- bird bath: a stone pedestal and a basin of water that ripples
  const birdbath = (x = 0, z = 0) => {
    const stone = mat(0xb5b2a8, { roughness: 0.9 });
    let water;
    const o = makeObject('birdbath', x, z, 0.55, 0.55, 1.0, 'light', (g) => {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 18), stone); base.position.y = 0.05; base.castShadow = true; g.add(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 14), stone); stem.position.y = 0.4; stem.castShadow = true; g.add(stem);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.15, 0.12, 22), stone); bowl.position.y = 0.76; bowl.castShadow = true; g.add(bowl);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 8, 24), stone); lip.rotation.x = Math.PI / 2; lip.position.y = 0.82; g.add(lip);
      water = new THREE.Mesh(new THREE.CircleGeometry(0.245, 22), new THREE.MeshStandardMaterial({ color: 0x5ab4e6, roughness: 0.1, metalness: 0.2 }));
      water.rotation.x = -Math.PI / 2; water.position.y = 0.805; g.add(water);
    });
    o.ripple = 0;
    o.splash = () => { o.ripple = 1; };
    onUpdate(o, (dt) => { o.ripple = Math.max(0, o.ripple - dt * 0.7); const s = 1 + 0.04 * Math.sin(o.ripple * 30) * o.ripple; water.scale.set(s, s, 1); });
    addAt(o);
    o.basinPoint = () => o.at(0, 0.82, 0);
    return o;
  };

  // ---- sky switch: a post with a lever between a sun and a moon. `night` is the position it is in (the room's sky follows it).
  const skyswitch = (x = 0, z = 0) => {
    const post = mat(0x6b7480, { roughness: 0.5, metalness: 0.4 });
    let lever, sunI, moonI;
    const o = makeObject('skyswitch', x, z, 0.4, 0.4, 1.3, 'light', (g) => {
      box(0.3, 0.05, 0.3, post, 0, 0.025, 0, g);
      box(0.1, 1.0, 0.1, post, 0, 0.55, 0, g);
      box(0.34, 0.3, 0.1, mat(0x2b333c), 0, 1.15, 0.0, g);
      sunI = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), new THREE.MeshBasicMaterial({ color: 0xffd45a })); sunI.position.set(-0.09, 1.2, 0.052); g.add(sunI);
      moonI = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), new THREE.MeshBasicMaterial({ color: 0x8aa0cf })); moonI.position.set(0.09, 1.2, 0.052); g.add(moonI);
      lever = new THREE.Group(); lever.position.set(0, 1.09, 0.06); g.add(lever);
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.025), mat(0xd9d9d9)); stick.position.y = 0.05; lever.add(stick);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(0xc0392b)); knob.position.y = 0.12; lever.add(knob);
    });
    o.night = false;
    o.setNight = (n) => { o.night = !!n; };
    onUpdate(o, (dt) => {
      const want = o.night ? 0.7 : -0.7;
      lever.rotation.z += (want - lever.rotation.z) * Math.min(1, dt * 9);
      sunI.scale.setScalar(o.night ? 0.7 : 1.2); moonI.scale.setScalar(o.night ? 1.2 : 0.7);
    });
    addAt(o);
    o.leverPoint = () => o.at(0, 1.2, 0.07);
    return o;
  };

  // ---- shed: a small wooden shed with a door that swings open (the lawn mower lives out of it)
  const shed = (x = 0, z = 0) => {
    const wood = mat(0x8a5a2e, { roughness: 0.9 }), trim = mat(0xe8e0cf, { roughness: 0.8 }), roof = mat(0x4a525c, { roughness: 0.7 });
    let door;
    const o = makeObject('shed', x, z, 1.55, 1.25, 1.9, 'heavy', (g) => {
      g.scale.setScalar(0.82);                                                  // (modelled 1.9 x 1.5 x 2.3 m: a little smaller, so it does not hide the yard)
      box(1.8, 2.0, 0.04, wood, 0, 1.0, -0.7, g);                             // back wall
      for (const sx of [-0.88, 0.88]) box(0.04, 2.0, 1.4, wood, sx, 1.0, 0, g);                                  // side walls
      box(0.45, 2.0, 0.04, wood, -0.675, 1.0, 0.7, g); box(0.45, 2.0, 0.04, wood, 0.675, 1.0, 0.7, g);        // front either side of the door
      box(0.9, 0.4, 0.04, wood, 0, 1.8, 0.7, g);                              // front above the door
      box(2.0, 0.08, 1.7, roof, 0, 2.05, 0, g).rotation.x = 0.09;              // the roof (a slight slope back)
      box(1.7, 0.03, 1.4, mat(0x6b5a48), 0, 0.02, 0, g);                      // the floor
      box(0.06, 2.0, 0.05, trim, -0.45, 1.0, 0.72, g); box(0.06, 2.0, 0.05, trim, 0.45, 1.0, 0.72, g);          // door frame
      const win = box(0.35, 0.3, 0.02, mat(0x9fd3ea, { roughness: 0.1 }), -0.9 + 0.04, 1.4, 0, g); win.rotation.y = Math.PI / 2;
      door = new THREE.Group();                                                // hinged on the left edge
      door.position.set(-0.45, 0, 0.72);
      const leaf = box(0.9, 1.8, 0.04, mat(0x3f6f8f, { roughness: 0.7 }), 0.45, 0.9, 0, door);
      box(0.06, 0.06, 0.06, mat(0xd9c25a, { metalness: 0.6, roughness: 0.3 }), 0.8, 0.9, 0.04, door);
      for (const y of [0.45, 1.35]) box(0.75, 0.06, 0.02, trim, 0.45, y, 0.03, door);
      g.add(door);
      // the darkness inside shows when the door is open
      box(0.88, 1.8, 0.02, mat(0x14181c), 0, 0.9, 0.68, g);
    });
    o.open = 0; o.openTo = 0;
    o.setOpen = (v) => { o.openTo = v ? 1 : 0; };
    onUpdate(o, (dt) => { o.open += (o.openTo - o.open) * Math.min(1, dt * 5); door.rotation.y = -o.open * 1.9; });
    addAt(o);
    o.knobPoint = () => o.at(0.35, 0.9, 0.78);
    return o;
  };

  // ---- push lawn mower: faces local -z, the handle comes back towards +z where GUY stands and pushes
  const mower = (x = 0, z = 0) => {
    const red = mat(0xc0392b, { roughness: 0.5 }), dark = mat(0x2b2f35, { roughness: 0.6 }), steel = mat(0xaeb6bf, { metalness: 0.6, roughness: 0.35 });
    let blade, bagLid;
    const o = makeObject('mower', x, z, 0.6, 1.05, 1.0, 'medium', (g) => {
      box(0.5, 0.14, 0.62, red, 0, 0.26, -0.12, g);                            // the deck
      box(0.34, 0.12, 0.3, dark, 0, 0.38, -0.12, g);                           // the engine
      bagLid = box(0.4, 0.22, 0.2, mat(0x6b7a52, { roughness: 0.95 }), 0, 0.34, 0.28, g);          // the grass bag at the back
      for (const sx of [-0.27, 0.27]) for (const sz of [-0.3, 0.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), dark); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.09, sz); w.castShadow = true; g.add(w); }
      for (const sx of [-0.2, 0.2]) { const h = box(0.025, 0.9, 0.025, steel, sx, 0.62, 0.27, g); h.rotation.x = 0.5; }      // the handle leans back
      box(0.46, 0.03, 0.03, dark, 0, 1.0, 0.52, g);                            // the cross bar
      blade = box(0.4, 0.015, 0.03, steel, 0, 0.17, -0.12, g);
      blade.visible = false;
    });
    o.running = false;
    o.setRunning = (v) => { o.running = !!v; };
    onUpdate(o, (dt) => { if (o.running) { o.group.position.y = Math.sin(performance.now() / 22) * 0.004; } else o.group.position.y = 0; if (o.tether) o.tether(); });   // (tether: while it is put away it follows the shed, if the shed is moved)
    addAt(o);
    o.handlePoint = () => o.at(0, 1.0, 0.52);
    return o;
  };

  return { soccergoal, basketballhoop, lawnchair, birdbath, skyswitch, shed, mower };
}

// ---------------------------------------------------------------------------------------------------------------------- the balls
// A yard ball stands for its goal or hoop: it exists while that object is in the room and lies on the grass near it. The activities
// move it by hand (kicks, shots and the pose code in brain.js computeBall); there is no free physics: it is put down where it stops.
export function makeYardBall(kind) {
  const d = YARD_BALL[kind];
  const m = new THREE.Mesh(new THREE.SphereGeometry(d.r, 22, 16), new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.5 }));
  m.castShadow = true;
  if (kind === 'soccer') {                                                      // dark patches
    const p = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    for (const [a, b] of [[0, 0], [1.2, 0.5], [2.4, 0.5], [3.6, 0.5], [4.8, 0.5], [0, 1.57], [0, -1.57]]) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(d.r * 0.38, 5), p);
      const dir = V(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
      s.position.copy(dir).multiplyScalar(d.r * 1.004);
      s.lookAt(dir.clone().multiplyScalar(2));
      m.add(s);
    }
  } else {                                                                      // the black seams
    const b = new THREE.MeshBasicMaterial({ color: 0x1c1c1c });
    for (const rot of [[0, 0, 0], [0, Math.PI / 2, 0]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(d.r * 1.003, 0.006, 6, 28), b); t.rotation.set(...rot); m.add(t); }
    const t2 = new THREE.Mesh(new THREE.TorusGeometry(d.r * 1.003, 0.006, 6, 28), b); t2.rotation.x = Math.PI / 2; m.add(t2);
  }
  m.userData = { kind, r: d.r, yard: true, vel: V(0, 0, 0) };
  return m;
}
