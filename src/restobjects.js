// The Restaurant's furniture: stove, kitchen counter (where the cooked plates wait), cash register counter and dining tables
// (each with its own two chairs), plus the elevator the customers arrive in. Built with the same makeObject helper as the rest of the
// room (room.js passes it in) and placed in the added room's own frame (room.js, REST_LAYOUT). Every object has its front on local +z.
// The customers sit at a table's `seats` (object-local x, z and the way they face), and dishes appear on its plates.
import * as THREE from 'three';

const STEEL = 0xd9dde2, DARK = 0x2b3a42, WOOD = 0xc89b62, WOOD_DARK = 0x8a5a2e;

// One plate of food. `dish` is { color } (a heap on a white plate).
export const DISHES = {
  soup: { name: 'soup', icon: '🍲', color: 0xd9822b, price: 3, cook: 6 },
  pizza: { name: 'pizza', icon: '🍕', color: 0xe9c46a, price: 4, cook: 7 },
  pasta: { name: 'pasta', icon: '🍝', color: 0xf4d58d, price: 4, cook: 7 },
  burger: { name: 'burger', icon: '🍔', color: 0x9c5a2f, price: 5, cook: 8 },
  cake: { name: 'cake', icon: '🍰', color: 0xf48fb1, price: 3, cook: 5 },
};

export function makeRestaurantBuilders({ makeObject, box, mat }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const addAt = (o) => { o.at = (x, y, z) => { o.group.updateWorldMatrix(true, false); return o.group.localToWorld(V(x, y, z)); }; return o; };
  const onUpdate = (o, fn) => { const base = o.update; o.update = function (dt) { base.call(this, dt); fn(dt); }; };
  const clearGroup = (grp) => { while (grp.children.length) { const c = grp.children[0]; grp.remove(c); if (c.geometry) c.geometry.dispose(); } };
  const cyl = (rt, rb, h, color, x, y, z, parent, seg = 18) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  // a plate with a heap of food on it: into `grp` (emptied first); `dish` is a key of DISHES or null
  const fillPlate = (grp, dish) => {
    clearGroup(grp);
    if (!dish || !DISHES[dish]) return;
    cyl(0.12, 0.1, 0.02, 0xf5f5f0, 0, 0.01, 0, grp, 20);
    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), mat(DISHES[dish].color));
    heap.scale.y = 0.55; heap.position.y = 0.045; heap.castShadow = true; grp.add(heap);
    if (dish === 'cake') { const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mat(0xd32f2f)); cherry.position.set(0, 0.1, 0); grp.add(cherry); }
  };

  // ------------------------------------------------------------------------------------------------ stove
  const stove = (x = 0, z = 0) => {
    const steel = mat(STEEL, { metalness: 0.3, roughness: 0.4 }), dark = mat(DARK), black = mat(0x15191d);
    const o = makeObject('stove', x, z, 0.92, 0.72, 1.7, 'heavy', (g) => {
      box(0.9, 0.9, 0.7, steel, 0, 0.45, 0, g);                                   // the cooker
      box(0.92, 0.04, 0.72, black, 0, 0.92, 0, g);                                // the hob
      for (const [bx, bz] of [[-0.22, -0.14], [0.22, -0.14], [-0.22, 0.16], [0.22, 0.16]]) cyl(0.1, 0.1, 0.02, 0x3c444c, bx, 0.955, bz, g);   // burners
      box(0.7, 0.45, 0.02, dark, 0, 0.42, 0.355, g);                              // oven door
      box(0.5, 0.2, 0.01, mat(0x6b8fa0, { roughness: 0.2 }), 0, 0.45, 0.37, g);   // its window
      box(0.5, 0.03, 0.03, mat(0xb0b6bd), 0, 0.68, 0.38, g);                      // handle
      for (let i = 0; i < 4; i++) cyl(0.025, 0.025, 0.03, 0xe53935, -0.3 + i * 0.2, 0.8, 0.36, g, 10).rotation.x = Math.PI / 2;      // knobs
      box(0.9, 0.12, 0.6, steel, 0, 1.55, -0.04, g);                              // the hood
      box(0.18, 0.28, 0.18, steel, 0, 1.7, -0.14, g);
    });
    // the pot on the front left burner, with a lid that rattles while it cooks
    cyl(0.13, 0.13, 0.16, 0x8e99a4, -0.22, 1.05, 0.16, o.group, 20);
    o.lid = cyl(0.135, 0.135, 0.02, 0x6f7a84, -0.22, 1.14, 0.16, o.group, 20);
    // steam: three puffs that rise and fade while it cooks
    o.steam = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
      s.position.set(-0.22, 1.2, 0.16); o.group.add(s); o.steam.push(s);
    }
    o.cooking = 0;
    onUpdate(o, (dt) => {
      const on = o.cooking > 0;
      if (on) o.cooking = Math.max(0, o.cooking - dt);
      o.steam.forEach((s, i) => {
        const k = on ? ((performance.now() / 1000 * 0.6 + i / 3) % 1) : 0;
        s.position.y = 1.2 + k * 0.5; s.material.opacity = on ? (1 - k) * 0.5 : 0; s.scale.setScalar(0.6 + k);
      });
      o.lid.visible = !o.stirring; o.stirring = false;                         // the lid comes off while Guy stirs (set every frame by the stir step)
      o.lid.position.y = 1.14 + (on ? Math.abs(Math.sin(performance.now() / 70)) * 0.012 : 0);
    });
    o.cook = (secs) => { o.cooking = secs; };
    // the wooden spoon: the bowl is at the group's origin, the handle runs along +y (like the mallet)
    o.tool = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(WOOD)); bowl.scale.set(1, 0.4, 1.3); o.tool.add(bowl);
    box(0.02, 0.3, 0.02, mat(WOOD), 0, 0.17, 0, o.tool);
    o.group.add(o.tool);
    o.toolRest = { pos: V(0.1, 0.98, -0.2), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2 - 0.2)) };
    o.resetTool = () => { o.tool.position.copy(o.toolRest.pos); o.tool.quaternion.copy(o.toolRest.quat); };
    o.resetTool();
    o.potPoint = () => o.at(-0.22, 1.12, 0.16);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ kitchen counter
  const kitchencounter = (x = 0, z = 0) => {
    const cab = mat(0x3d86a8), top = mat(0xe8e4dc), steel = mat(STEEL, { metalness: 0.3, roughness: 0.4 });
    const o = makeObject('kitchencounter', x, z, 1.7, 0.72, 1.7, 'heavy', (g) => {
      box(1.2, 0.86, 0.66, cab, -0.25, 0.43, 0, g);                               // the cupboards
      box(1.24, 0.06, 0.7, top, -0.25, 0.89, 0, g);                               // worktop
      for (const dx of [-0.55, -0.25, 0.05]) box(0.28, 0.5, 0.01, mat(0x2d6f8c), dx, 0.45, 0.335, g);
      box(0.5, 1.7, 0.66, steel, 0.6, 0.85, 0, g);                                // the fridge
      box(0.48, 0.01, 0.01, mat(0x9aa3ad), 0.6, 1.05, 0.335, g);
      box(0.03, 0.4, 0.03, mat(0x9aa3ad), 0.82, 1.2, 0.35, g);
      box(0.28, 0.02, 0.2, mat(WOOD), -0.65, 0.93, 0.1, g);                       // chopping board with a tomato and a loaf
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0xd32f2f)); t.position.set(-0.7, 0.99, 0.1); g.add(t);
      const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xd9a55b)); loaf.scale.set(1.5, 0.7, 0.8); loaf.position.set(-0.58, 0.98, 0.1); g.add(loaf);
    });
    // the pass: ready plates wait in three slots on the worktop until he carries them out
    o.slots = [0, 1, 2].map((i) => { const grp = new THREE.Group(); grp.position.set(-0.1 + i * 0.28, 0.92, 0.12); o.group.add(grp); return grp; });
    o.setPlate = (i, dish) => fillPlate(o.slots[i], dish);
    o.platePoint = (i) => o.at(-0.1 + i * 0.28, 1.0, 0.12);
    o.freeSlot = () => o.slots.findIndex((s) => !s.children.length);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ register
  const register = (x = 0, z = 0) => {
    const wood = mat(WOOD_DARK), top = mat(0xe8e4dc), steel = mat(STEEL, { metalness: 0.3, roughness: 0.4 });
    const o = makeObject('register', x, z, 1.3, 0.62, 1.2, 'medium', (g) => {
      box(1.2, 0.86, 0.56, wood, 0, 0.43, 0, g);                                  // the counter
      box(1.26, 0.05, 0.6, top, 0, 0.885, 0, g);
      box(0.4, 0.2, 0.34, steel, -0.25, 1.0, 0, g);                               // the till
      box(0.3, 0.14, 0.02, mat(0x25323a), -0.25, 1.14, -0.1, g).rotation.x = -0.4;   // its screen
      box(0.36, 0.03, 0.2, mat(0x9aa3ad), -0.25, 0.92, 0.18, g);                  // coin tray
      cyl(0.05, 0.06, 0.04, 0xe8c050, 0.3, 0.935, 0.05, g, 14);                  // the bell
    });
    o.bell = o.group.children[o.group.children.length - 1];
    // coins in the tray (up to ten, one more for every few paid)
    o.coins = new THREE.Group(); o.coins.position.set(-0.25, 0.94, 0.18); o.group.add(o.coins);
    o.setCoins = (n) => {
      clearGroup(o.coins);
      for (let i = 0; i < Math.min(10, Math.floor(n / 2)); i++) { const c = cyl(0.025, 0.025, 0.006, 0xf6c445, -0.12 + (i % 5) * 0.06, (Math.floor(i / 5)) * 0.007, 0, o.coins, 12); void c; }
    };
    o.setCoins(0);
    o.ring = 0;
    onUpdate(o, (dt) => { if (o.ring > 0) { o.ring = Math.max(0, o.ring - dt); o.bell.position.y = 0.935 + Math.abs(Math.sin(o.ring * 40)) * 0.01; } });
    o.pay = () => { o.ring = 0.5; };
    o.buttonPoint = () => o.at(-0.25, 1.03, 0.0);                                // Guy's finger on the till (he stands behind it)
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ dining table and its chairs
  const diningtable = (name, x = 0, z = 0, metal = false) => {
    const wood = metal ? mat(0xb4bcc6, { metalness: 0.7, roughness: 0.3 }) : mat(WOOD), dark = metal ? mat(0x8a929c, { metalness: 0.7, roughness: 0.3 }) : mat(WOOD_DARK), cloth = mat(0xf2e8d5);
    const o = makeObject(name, x, z, 0.95, 1.95, 1.0, 'medium', (g) => {
      box(0.9, 0.05, 0.9, wood, 0, 0.75, 0, g);                                   // the table top
      box(0.5, 0.01, 0.5, cloth, 0, 0.78, 0, g);
      for (const [lx, lz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(0.06, 0.73, 0.06, dark, lx, 0.365, lz, g);
      for (const side of [1, -1]) {                                               // a chair at each end, facing the table
        box(0.46, 0.05, 0.46, wood, 0, 0.475, side * 0.72, g);
        box(0.46, 0.5, 0.04, wood, 0, 0.75, side * 0.93, g);
        for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.04, 0.45, 0.04, wood, lx, 0.225, side * 0.72 + lz, g);
      }
      const vase = cyl(0.03, 0.04, 0.12, 0x6fa8c7, 0, 0.84, 0, g, 10); void vase;
    });
    // two seats: where a customer sits (object-local), which way they face (yaw relative to the table), and a plate each
    o.seats = [{ x: 0, z: 0.72, yaw: Math.PI, plate: null, who: null }, { x: 0, z: -0.72, yaw: 0, plate: null, who: null }];
    o.seats.forEach((s) => { s.plate = new THREE.Group(); s.plate.position.set(0, 0.78, s.z > 0 ? 0.24 : -0.24); o.group.add(s.plate); });
    o.setPlate = (i, dish) => fillPlate(o.seats[i].plate, dish);
    o.platePoint = (i) => o.at(0, 0.9, o.seats[i].z > 0 ? 0.24 : -0.24);
    // where Guy stands to serve a seat (beside the table), and where a customer stands to walk in and out of the seat
    o.serveStand = (i) => ({ x: 0.78, z: o.seats[i].z > 0 ? 0.45 : -0.45 });
    o.approach = (i) => ({ x: 0, z: o.seats[i].z > 0 ? 1.42 : -1.42 });
    o.menuPoint = (i) => o.at(0, 0.82, o.seats[i].z > 0 ? 0.18 : -0.18);
    return addAt(o);
  };

  // ------------------------------------------------------------------------------------------------ elevator cabin
  // A cabin that stands out from the wall, 1.5 wide and 1.1 deep, with sliding doors on the room side. It is built in the room's own
  // frame (x along the wall, z towards the room); `open` is 0..1. The customers ride in it, hidden behind the closed doors.
  const buildElevator = () => {
    const g = new THREE.Group();
    const metal = mat(0x8a929c, { metalness: 0.5, roughness: 0.35 }), door = mat(0xb9c1ca, { metalness: 0.6, roughness: 0.3 }), warm = mat(0xf4e3b5);
    const W = 1.5, D = 1.1, H = 2.4;
    box(0.06, H, D, metal, -W / 2 + 0.03, H / 2, D / 2, g);                       // side walls
    box(0.06, H, D, metal, W / 2 - 0.03, H / 2, D / 2, g);
    box(W, H, 0.06, metal, 0, H / 2, 0.03, g);                                    // back (against the wall)
    box(W, 0.08, D, metal, 0, H + 0.04, D / 2, g);                                // roof
    box(W - 0.12, 0.02, D - 0.06, mat(0x6c757d), 0, 0.01, D / 2, g);              // floor
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
    light.position.set(0, H - 0.04, D / 2); g.add(light);
    const fL = box(W / 2 - 0.03, H - 0.1, 0.05, door, -W / 4 + 0.0, (H - 0.1) / 2, D - 0.025, g);            // the two doors
    const fR = box(W / 2 - 0.03, H - 0.1, 0.05, door, W / 4 - 0.0, (H - 0.1) / 2, D - 0.025, g);
    box(W, 0.14, 0.06, metal, 0, H - 0.07, D, g);                                 // header with the lit sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.08), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
    sign.position.set(0, H - 0.07, D + 0.035); g.add(sign);
    box(0.08, 0.2, 0.04, warm, W / 2 + 0.1, 1.2, D, g);                           // the call button panel beside it
    cyl(0.025, 0.025, 0.02, 0xe53935, W / 2 + 0.1, 1.22, D + 0.03, g, 10).rotation.x = Math.PI / 2;
    g.userData = { W, D, H, fL, fR };
    g.userData.open = 0; g.userData.openTo = 0;
    g.userData.setOpen = (v) => { g.userData.openTo = v ? 1 : 0; };
    g.userData.update = (dt) => {
      const u = g.userData;
      if (u.open === u.openTo) return;
      u.open = Math.max(0, Math.min(1, u.open + Math.sign(u.openTo - u.open) * dt / 0.9));
      if (Math.abs(u.open - u.openTo) < 0.01) u.open = u.openTo;
      const slide = u.open * (W / 4 - 0.02);
      fL.position.x = -W / 4 - slide; fR.position.x = W / 4 + slide;               // they slide apart into the side walls
      sign.material.color.set(u.open > 0.5 ? 0xffdd55 : 0x66ff99);
    };
    return g;
  };
  // Elevator doors slide into the side walls, so open doors are hidden behind them; thicken the side walls a little so they do.
  return { stove, kitchencounter, register, diningtable, buildElevator, fillPlate, cyl };
}
