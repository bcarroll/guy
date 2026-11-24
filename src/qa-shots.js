// QA by looking (installed onto the harness by devtools.js; NOT imported by the game).
//
// Numbers cannot tell that a character looks wrong, that a painting is on the wrong side of a wall, or that a prop floats beside a
// hand. This takes real pictures of the game, the same way every time, and compares each with the picture that was approved earlier:
//
//   T.shotIds()          every picture there is: each visual checkpoint in MANIFEST.visual (GUY at a pose from the front, side ...),
//                        every character (GUY, GAL, each customer) standing, walking and sitting from the front and the side,
//                        customers in the restaurant, and an overview of each room
//   await T.shot(id)     set the scene up (seeded randomness, a frozen game, a fixed camera), render, return { id, data }
//   await T.compare(a,b) how different two pictures are (the fraction of pixels that changed noticeably)
//
// qa/run.mjs does the rest: it saves the pictures, compares them with qa/baselines, writes qa/out/index.html (side by side, with the
// differences marked) and, with --approve, makes the current pictures the new baselines. A picture that has no baseline yet is reported
// and has to be looked at by a person once before it is approved. Baselines are made on one machine's GPU: a different GPU may differ
// slightly, which the tolerance allows for, so approve again after changing machines.
import * as THREE from 'three';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => Promise.race([new Promise((r) => requestAnimationFrame(() => r())), sleep(80)]);      // a hidden tab does not run animation frames: never wait for one

// a small seeded random number generator: the same pictures every time
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function install(T, h) {
  const { result } = h;
  const origRandom = Math.random;
  T.seed = (n = 1) => { Math.random = mulberry32(n); };
  T.unseed = () => { Math.random = origRandom; };

  // put the camera `dist` metres in front of (or beside, behind, above) a figure at (x, z) facing `yaw`, looking at its middle
  T.frameAt = (x, z, yaw, view = 'front', dist = 2.2, lookY = 0.95) => {
    window.controls.dispatchEvent({ type: 'start' });                    // stops the auto-framing taking the camera back
    window.scene.updateMatrixWorld(true);
    const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), lf = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    let pos = new THREE.Vector3(x, 1.35, z);
    if (view === 'front') pos.addScaledVector(fw, dist).addScaledVector(lf, 0.45);
    else if (view === 'side') { pos.y = 1.2; pos.addScaledVector(lf, -dist); }
    else if (view === 'back') { pos.y = 1.6; pos.addScaledVector(fw, -dist); }
    else pos = new THREE.Vector3(x, 3.4, z + 0.6);
    window.camera.position.copy(pos);
    window.controls.target.set(x, lookY, z);
    window.controls.update();
  };
  // an overview of a whole room: from above and outside, looking at its middle
  T.frameRoom = (id) => {
    const w = window.brain.w;
    const b = id === 'main' ? w.MAIN_BOUNDS : w.doors[id].shell.bounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, wx = b.maxX - b.minX, wz = b.maxZ - b.minZ;
    window.controls.dispatchEvent({ type: 'start' });
    const dx = id === 'main' ? 0 : Math.sign(cx) * 0.0, dist = Math.max(wx, wz) * 1.05;
    const far = id === 'main' ? 1.2 : 1;                          // (far enough back for the whole of the floor)
    window.camera.position.set(cx + dx + (id === 'restaurant' || id === 'workshop' ? (cx > 2 ? -1 : 1) * wx * 0.45 : wx * 0.5) * far, 5.2 * far, cz + dist * 0.8 * far);
    window.controls.target.set(cx, 0.9, cz);
    window.controls.update();
  };

  // the same start for every picture: nothing in the room but what the picture needs, the game frozen, the random numbers seeded
  async function clean(seed = 1) {
    T.unfreeze(); T.seed(seed);
    const b0 = window.brain;                                           // what the live game accumulated before the picture began (its clock, how far he has walked) must not leak into it
    b0.time = 0; b0.walkPhase = 0; b0.poseT = 0; b0.moving = false; b0.stuckT = 0;
    T.settle(); T.resetRooms(); T.removeAll(); T.forget(); window.brain.skills.fading.clear(); T.settle(); T.home();
    window.brain.w.restaurant.headless = false;
    b0.time = 0; b0.walkPhase = 0; b0.poseT = 0; b0.moving = false; b0.stuckT = 0;     // and again: the settling above started from wherever he happened to be
  }
  async function settleFrames(n = 3) { for (let i = 0; i < n; i++) await raf(); }
  function capture() {
    // the skeleton eases towards its pose a little every frame, so a picture taken a few frames earlier or later would catch GUY slightly
    // elsewhere: let it settle all the way (the pose itself is frozen), and let what he holds catch up with his hands
    const g = window.guy;
    if (g && g.loaded) { for (let i = 0; i < 90; i++) g.apply(1 / 30); window.scene.updateMatrixWorld(true); window.brain.safeLate(); }
    window.renderer.render(window.scene, window.camera);
    return window.renderer.domElement.toDataURL('image/jpeg', 0.9);
  }

  // ------------------------------------------------------------------------------------------------ the pictures
  const SHOTS = [];
  const add = (id, group, setup) => SHOTS.push({ id, group, setup });

  // 1. every visual checkpoint of the manifest (GUY at a pose, from a given side)
  for (const v of T.MANIFEST.visual) {
    add(`checkpoint-${v.id}`, 'checkpoints', async () => {
      await clean(11);
      const r = T.moment(v.activity, v.pose, v.t, v.view, v);
      return { ok: r.reached, why: 'never reached the pose' };
    });
  }

  // 2. every character standing, walking and sitting, from the front and the side
  const POSE_NAMES = ['stand', 'walk', 'sit'];
  const rigs = () => T.rigs();
  T.shotIds = () => SHOTS.map((s) => s.id);
  const charShots = (rig) => {
    for (const pose of POSE_NAMES) for (const view of ['front', 'side']) {
      add(`char-${rig.id}-${pose}-${view}`, 'characters', async () => {
        await clean(21);
        T.freeze();
        window.guy.root.position.set(-4.2, 0, 3.2); window.guy.root.visible = false;      // GUY is out of the picture
        const q = T._qa, g = await q.figure(rig, Math.PI * 0.85, 0, [0.4, 0.2]);
        q.hold(g, pose === 'stand' ? q.POSE.idle : pose === 'walk' ? q.POSE.walk(Math.PI / 2) : q.POSE.sit, 70);
        T.frameAt(0.4, 0.2, Math.PI * 0.85, view, 2.6, 0.9);
        await settleFrames(3);
        const data = capture();
        q.drop(g);
        return { data };
      });
    }
  };
  // Carrying a light thing to the room he is in, for a skill chosen in the Skills menu (skillrun.js): walking with it, both hands under its
  // sides, from the side and the front; and at a shut door, one hand on the knob and the other still holding it
  const CARRY = { guitar: 'guitar', lamp: 'lighting', easel: 'easel', telescope: 'telescope' };
  const carryShot = (thing, view, door = false) => add(`skill-carry-${thing}-${door ? 'door' : view}`, 'checkpoints', async () => {
    await clean(61);
    const w = window.brain.w, b = window.brain, p = window.guy.root.position;
    w.rooms.add('workshop', { walls: ['right'] });
    T.addObject(thing); T.learn([CARRY[thing]]); T.settle(); T.home();
    const c = w.roomSpot('workshop'); b.skip(true); b.queue = []; b.step = null; b.pendingActivity = null; p.x = c.x; p.z = c.z; b.stayRoom = 'workshop';
    const r = b.useSkill(CARRY[thing]);
    const there = () => b.hauling && b.hauling.k > 0.98 && b.hauling.dir > 0 && b.step && (door ? b.pose === 'reach' && b.step.t > 0.75 && Math.hypot(p.x - w.doorPoint('workshop', 0).x, p.z - w.doorPoint('workshop', 0).z) < 1.4 && b.roomHere() === 'main' : b.pose === 'walk' && b.moving && b.hereId() === 'workshop' && b.step.t > 1.0);
    let t = 0; while (t < 90 && !there()) { window.sim(0.05); t += 0.05; }
    const ok = !!there();
    T.freeze();
    T.frameAt(p.x, p.z, window.guy.root.rotation.y + (door ? Math.PI : 0), view, 2.6, 0.95);      // (at the door: from the side away from the bookshelf)
    await settleFrames(3);
    const data = capture();
    b.skip(true); b.homeCleanup();
    return { ok, why: `never carried it there (${r.message})`, data };
  });
  for (const thing of Object.keys(CARRY)) for (const view of ['side', 'front']) carryShot(thing, view);
  carryShot('easel', 'side', true);
  carryShot('telescope', 'side', true);
  // GAL playing the guitar, her fretting hand up close from behind her left shoulder (her shorter hand once made a fist under the neck)
  add('gal-guitar-fretting', 'characters', async () => {
    await clean(23);
    const w = window.brain.w, b = window.brain;
    const built = T.galBuild();
    if (!built.ok) { T.galReset(); return { ok: false, why: 'GAL was not built' }; }
    const gb = w.gal.brain, g = w.gal.g;
    T.learn(['guitar']); gb.skills.learn('guitar'); T.addObject('guitar'); T.settle();
    b.queue = []; b.step = null; b.choose('wander');
    gb.queue = []; gb.step = null; gb.unlock(false); gb.choose('riff');
    let t = 0; while (t < 30 && !(gb.pose === 'guitar' && gb.step && gb.step.t > 3)) { window.sim(0.25); t += 0.25; }
    const ok = gb.pose === 'guitar';
    T.freeze(); const upd = gb.update; gb.update = () => {};
    for (let i = 0; i < 90; i++) g.apply(1 / 30);
    window.scene.updateMatrixWorld(true); gb.safeLate && gb.safeLate();
    const yaw = g.root.rotation.y, h = g.boneWorld('LeftHand');
    const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), lf = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    window.controls.dispatchEvent({ type: 'start' });
    window.camera.position.copy(h.clone().addScaledVector(fw, -0.35).addScaledVector(lf, 0.45).add(new THREE.Vector3(0, 0.35, 0)));
    window.controls.target.copy(h); window.controls.update();
    await settleFrames(3);
    window.renderer.render(window.scene, window.camera);
    const data = window.renderer.domElement.toDataURL('image/jpeg', 0.9);
    gb.update = upd; T.unfreeze(); T.galReset();
    return ok ? { data } : { ok: false, why: 'GAL never started playing' };
  });

  // The rigs are known only once the page is up, so the characters are added on the first call to shotIds.
  const baseIds = T.shotIds;
  let charsAdded = false;
  T.shotIds = () => { if (!charsAdded) { charsAdded = true; for (const r of rigs()) charShots(r); for (const m of T.customerModels()) restaurantShots(m); roomShots(); } return baseIds(); };

  // 3. the customers in the real restaurant
  const restaurantShots = (m) => {
    for (const state of ['waiting', 'ordered', 'eating', 'paying']) {
      add(`customer-${m.id}-${state}`, 'customers', async () => {
        await clean(31);
        window.guy.root.visible = false;                                  // GUY is out of the picture
        T.prep('takeorder');
        const r = window.brain.w.restaurant;
        r.headless = false; r.paused = true; r.clear();
        T.seed(31);                                                       // (the dish and the way he sits come from the random numbers: the same ones whatever the set-up above used)
        const c = r.stage(state === 'eating' ? 'cooked' : state, m.id);
        if (!c) return { ok: false, why: 'could not stage the customer' };
        T.freeze();                                                       // nothing moves while the model loads
        for (let i = 0; i < 600 && !(c.fig && c.fig.ok); i++) { r.draw(c, 1 / 30); await sleep(20); }
        if (state === 'eating') { c.state = 'eating'; c.timer = 99; r.obj(c.seat.table).setPlate(c.seat.i, c.dish); r.obj('kitchencounter').slots.forEach((_, k) => r.obj('kitchencounter').setPlate(k, null)); }
        if (state === 'waiting') c.wait = 3;                              // the hand is all the way up
        for (let i = 0; i < 70; i++) { c.fig.update(c, 1 / 30); window.scene.updateMatrixWorld(true); }
        T.frameAt(c.x, c.z, c.yaw, 'front', 2.4, 0.9);
        await settleFrames(3);
        return { data: capture() };
      });
    }
  };

  // 4. each room from above (the restaurant with customers, the walls with paintings)
  const roomShots = () => {
    add('room-main', 'rooms', async () => {
      await clean(41);
      for (const id of ['piano', 'bench', 'table', 'lamp', 'armchair', 'plant', 'guitar', 'easel', 'telescope', 'drums', 'coffeetable']) T.addObject(id);
      T.freeze(); T.home(); window.guy.root.position.set(1.5, 0, 2); window.guy.root.visible = false;       // (the room is the picture: where he happens to be in his stride is not)
      T.frameRoom('main'); await settleFrames(3);
      return { data: capture() };
    });
    // the easter eggs, each up close (they are built only when their ingredients stand in the room: the QA adds them directly)
    for (const [kind, ingredients] of [['mirrorball', []], ['trophy', []], ['lavalamp', []], ['crystalball', []], ['rubberduck', []], ['gnome', []], ['toyrocket', []], ['arcade', []], ['piggybank', []], ['grandfatherclock', []], ['bubblemachine', []], ['snowglobe', []], ['petrock', []],
      ['fishtank', []], ['rubberchicken', []], ['flamingo', []], ['neonsign', []], ['aquarium', []], ['jukebox', []], ['plasmaglobe', []], ['robopet', []]]) {      // (the last eight are printed by the Build a Bot machine)
      add(`egg-${kind}`, 'rooms', async () => {
        await clean(43);
        for (const id of ingredients) T.addObject(id);
        const o = window.brain.w.addInstance(kind, null, null, true); const ob = window.brain.w.objects[o];
        if (!ob) return { ok: false, why: `${kind} did not fit in the room` };
        T.freeze(); window.guy.root.position.set(0, 0, 3); window.guy.root.visible = false;
        window.__qaClock = 2.0;                                              // (the things the Build a Bot machine prints hold their animation still for the picture)
        ob.group.userData.tick && ob.group.userData.tick(0.4);
        T.frameAt(ob.x, ob.z, ob.yaw, 'front', 2.4, 0.9);
        await settleFrames(3);
        const data = capture(); delete window.__qaClock;
        return { data };
      });
    }
    add('room-workshop', 'rooms', async () => {
      await clean(42);
      for (const id of ['workbench', 'toolbox', 'woodfactory', 'metalfactory']) T.addObject(id);
      T.freeze(); T.frameRoom('workshop'); await settleFrames(3);
      return { data: capture() };
    });
    add('room-workshop-machine', 'rooms', async () => {                    // the Build a Bot machine in the Workshop (it never leaves that room), with a thing it printed on its bed
      await clean(42);
      for (const id of ['workbench', 'toolbox', 'woodfactory', 'metalfactory', 'botprinter']) T.addObject(id);
      const m = window.brain.w.objects.botprinter;
      if (!m) return { ok: false, why: 'the machine did not fit in the Workshop' };
      m.showMade('fishtank');
      T.freeze(); T.frameRoom('workshop'); await settleFrames(3);
      return { data: capture() };
    });
    for (const night of [false, true]) {
      add(night ? 'room-backyard-night' : 'room-backyard', 'rooms', async () => {
        await clean(night ? 46 : 45);
        for (const id of ['soccergoal', 'basketballhoop', 'lawnchair', 'birdbath', 'skyswitch', 'shed', 'mower']) T.addObject(id);
        window.brain.w.yard.snapNight(night);
        T.freeze(); T.frameRoom('backyard'); await settleFrames(4);
        return { data: capture() };
      });
    }
    add('room-range', 'rooms', async () => {                       // the lanes and screens, the blaster case, the round controller and the scoreboard
      await clean(47);
      window.brain.w.rooms.add('range');
      T.freeze(); window.guy.root.visible = false; T.frameRoom('range'); await settleFrames(3);
      return { data: capture() };
    });
    // The whole house from above: every room the same square, lined up; and the two doors of a corner room between two others
    add('floorplan', 'rooms', async () => {
      await clean(55);
      const w = window.brain.w;
      for (const [id, o] of [['workshop', { walls: ['right'] }], ['studio', { walls: ['front'] }], ['bowling', { walls: ['back'] }], ['library', { corners: ['right-back'] }], ['bedroom', { corners: ['right-front'] }]]) w.rooms.add(id, o);
      T.freeze(); window.guy.root.visible = false;
      window.controls.dispatchEvent({ type: 'start' });
      const far = window.controls.maxDistance; window.controls.maxDistance = 100;
      window.camera.position.set(-12, 30, 22); window.controls.target.set(5, 0, 1); window.controls.update();
      await settleFrames(3);
      const data = capture();
      window.controls.maxDistance = far;
      return { data };
    });
    // New maple pins for a lane: the crate carried in both hands, and a row of pins set on the deck
    const pinShot = (id, when, why) => add(id, 'rooms', async () => {
      await clean(56);
      const w = window.brain.w, b = window.brain, p = window.guy.root.position;
      w.rooms.add('bowling', { walls: ['back'] });
      w.addInstance('bowlingpins', null, null, true); T.settle(); T.home();
      b.queue = []; b.step = null; b.homeTried = -999; b.choose('carryhome');
      let t = 0; while (t < 160 && !when(b, w)) { window.sim(1 / 30); t += 1 / 30; }
      const ok = !!when(b, w);
      T.freeze();
      window.controls.dispatchEvent({ type: 'start' });
      window.camera.position.set(p.x + 1.9, 1.5, p.z + 1.6); window.controls.target.set(p.x, 0.6, p.z - 0.25); window.controls.update();
      await settleFrames(3);
      const data = capture();
      b.skip(true); b.homeCleanup(); b.pinCleanup();
      for (const o of Object.values(w.objects)) if (o.kind === 'bowlingpins') { w.removeObject(o.name); delete w.removed[o.name]; }
      return { ok, why, data };
    });
    pinShot('bowl-pins-carry', (b) => b.hauling && b.hauling.k > 0.98 && b.hauling.dir > 0 && b.pose === 'walk' && b.hereId() === 'bowling' && b.g.root.position.z < -8.6, 'never carried the crate');
    pinShot('bowl-pins-set', (b, w) => b.pose === 'bowlreach' && !!b.step && b.step.t > 1.05 && w.bowl.lanes.some((l) => l.swapping && l.pins.filter((p) => p.state === 'up').length === 9), 'never set the pins');
    add('room-bowling', 'rooms', async () => {                    // three lanes with pins, the ball returns, the rack, the scoreboard and the neon
      await clean(48);
      window.brain.w.rooms.add('bowling');
      T.freeze(); window.guy.root.visible = false; T.frameRoom('bowling'); await settleFrames(3);
      return { data: capture() };
    });
    add('room-studio', 'rooms', async () => {                     // the stage wall to wall, the dance floor, the booth and the record wall
      await clean(53);
      const w = window.brain.w;
      w.rooms.add('studio', { walls: ['right'] });
      T.addObject('bass'); T.addObject('keyboard');
      T.freeze(); window.guy.root.visible = false;
      for (let i = 0; i < 20; i++) window.sim(0.05);
      T.freeze();
      const c = w.shellPoint('studio', 5, 0);
      window.controls.dispatchEvent({ type: 'start' });
      window.camera.position.set(c.x - 9.5, 8.5, c.z); window.controls.target.set(c.x + 0.5, 0.4, c.z); window.controls.update();
      await settleFrames(3);
      return { data: capture() };
    });
    // A corner room at each end of the Studio's stage: both doors, one open
    add('room-studio-stagedoors', 'rooms', async () => {
      await clean(54);
      const w = window.brain.w;
      w.rooms.add('studio', { walls: ['right'] }); w.rooms.add('library', { corners: ['right-back'] }); w.rooms.add('bedroom', { corners: ['right-front'] });
      T.addObject('bass');
      w.setDoorOpen('library', true); for (let i = 0; i < 40; i++) window.sim(0.05);
      T.freeze(); window.guy.root.visible = false;
      const c = w.shellPoint('studio', 4.5, 0), far = w.shellPoint('studio', 9, 0);
      window.controls.dispatchEvent({ type: 'start' });
      window.camera.position.set(c.x - 5.5, 4.6, c.z); window.controls.target.set(far.x, 0.8, far.z); window.controls.update();
      await settleFrames(3);
      return { data: capture() };
    });
    // The corner rooms: seen from beyond their far wall (the camera is outside, so the walls between it and the room do not hide it)
    const frameCorner = (id) => {
      const b = window.brain.w.doors[id].shell.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, away = Math.sign(cz) || 1;
      window.controls.dispatchEvent({ type: 'start' });
      window.camera.position.set(cx, 6.2, cz + away * 13);
      window.controls.target.set(cx, 0.6, cz);
      window.controls.update();
    };
    for (const [id, stuff] of [['library', [['piano', 0, -1.2], ['armchair', -2.6, 1.6], ['lamp', 3.4, 2.4]]], ['bedroom', [['easel', 0.5, 0.5], ['plant', -3.5, 2.8], ['nightstand', 3.2, -2.2]]]]) {
      add(`room-corner-${id}`, 'rooms', async () => {
        await clean(id === 'library' ? 48 : 49);
        const w = window.brain.w;
        w.rooms.add('workshop', { walls: ['right'] });
        w.rooms.add('library'); w.rooms.add('bedroom');
        const b = w.doors[id].shell.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
        for (const [kind, dx, dz] of stuff) { T.addObject(kind); if (w.objects[kind]) w.objects[kind].set(cx + dx, cz + dz); }
        T.freeze(); window.guy.root.visible = false; frameCorner(id); await settleFrames(3);
        return { data: capture() };
      });
    }
    // The furnished corner rooms: what the bots build for them (a bed, a wardrobe and a bedside table; two bookshelves, a reading chair, a
    // reading desk with its lamp lit and a globe), and in the Library the skill shelf they carried in, its dust and cobwebs cleaned away
    for (const [id, kinds] of [['bedroom', ['bed', 'wardrobe', 'bedside']], ['library', ['libshelf', 'libshelf', 'readingchair', 'libdesk', 'globe']], ['garage', ['garagebench', 'toolchest', 'tyrerack']]]) {
      add(`room-corner-${id}-furnished`, 'rooms', async () => {
        await clean({ library: 48, garage: 50 }[id] || 49);
        const w = window.brain.w;
        w.rooms.add('workshop', { walls: ['right'] });
        if (id === 'garage') w.rooms.add('garage'); else { w.rooms.add('library'); w.rooms.add('bedroom'); }   // (the Garage on its own: its built things are what is in the picture)
        for (const k of kinds) w.addInstance(k, null, null, true);
        if (id === 'library') {
          const spot = w.libraryShelfSpot(w.objects.shelf);
          if (spot && w.packShelf('shelf')) w.unpackShelf('shelf', spot);
          for (const s of w.doors.library.shell.dust.spots) w.doors.library.shell.dust.clean(s, 1);
          const desk = Object.values(w.objects).find((o) => o.kind === 'libdesk');
          if (desk) { desk.setLamp(true); for (let i = 0; i < 30; i++) desk.update(0.1); }
        }
        T.freeze(); window.guy.root.visible = false; frameCorner(id); await settleFrames(3);
        return { data: capture() };
      });
    }
    // A corner room beside the Shooting Range (its door in the Range's side wall, between the controller and the scoreboard) and one
    // beside the Backyard (a garden gate in the side fence)
    add('room-range-sidedoor', 'rooms', async () => {
      await clean(51);
      const w = window.brain.w;
      w.rooms.add('range', { walls: ['front'] }); w.rooms.add('bedroom');
      w.setDoorOpen('bedroom', true); for (let i = 0; i < 40; i++) window.sim(0.05);
      T.freeze(); window.guy.root.visible = false;
      const p = w.doorPoint('bedroom', 0);
      window.controls.dispatchEvent({ type: 'start' });
      window.camera.position.set(p.x - 6.5, 6.5, p.z + 4.5); window.controls.target.set(p.x, 0.8, p.z); window.controls.update();
      await settleFrames(3);
      return { data: capture() };
    });
    add('room-backyard-gate', 'rooms', async () => {
      await clean(52);
      const w = window.brain.w;
      w.rooms.add('backyard', { walls: ['left'] }); w.rooms.add('library');
      w.setDoorOpen('library', true); for (let i = 0; i < 40; i++) window.sim(0.05);
      T.freeze(); window.guy.root.visible = false;
      const p = w.doorPoint('library', 0);
      window.controls.dispatchEvent({ type: 'start' });
      window.camera.position.set(p.x + 3.5, 5.5, p.z + 7); window.controls.target.set(p.x, 0.8, p.z); window.controls.update();
      await settleFrames(3);
      return { data: capture() };
    });
    add('room-corners', 'rooms', async () => {                      // the Workshop with a corner room at each side wall: both doors, both rooms
      await clean(50);
      const w = window.brain.w;
      w.rooms.add('workshop', { walls: ['right'] });
      w.rooms.add('library'); w.rooms.add('bedroom');
      T.freeze(); window.guy.root.visible = false;
      window.controls.dispatchEvent({ type: 'start' });
      window.camera.position.set(8, 20, 0.5); window.controls.target.set(10, 0, 0); window.controls.update();
      await settleFrames(3);
      return { data: capture() };
    });
    add('room-restaurant', 'rooms', async () => {
      await clean(43);
      T.prep('takeorder');
      const r = window.brain.w.restaurant;
      r.headless = false; r.paused = true; r.clear();
      const cs = [r.stage('waiting', 'aj'), r.stage('ordered', 'peasantgirl'), r.stage('paying', 'aj')].filter(Boolean);
      T.freeze();
      for (let i = 0; i < 600 && !cs.every((c) => c.fig && c.fig.ok); i++) { for (const c of cs) r.draw(c, 1 / 30); await sleep(20); }
      for (let i = 0; i < 70; i++) { for (const c of cs) c.fig.update(c, 1 / 30); window.scene.updateMatrixWorld(true); }
      T.frameRoom('restaurant'); await settleFrames(3);
      return { data: capture() };
    });
    add('room-restaurant-corner', 'rooms', async () => {            // every wall of GUY's room taken: the Restaurant in a corner, behind a door in the Backyard's fence
      await clean(62);
      const w = window.brain.w;
      for (const [id, wall] of [['studio', 'back'], ['backyard', 'left'], ['workshop', 'right'], ['bowling', 'front']]) w.rooms.add(id, { walls: [wall] });
      T.prep('takeorder');
      const r = w.restaurant;
      r.headless = false; r.paused = true; r.clear();
      const cs = [r.stage('waiting', 'aj'), r.stage('ordered', 'peasantgirl')].filter(Boolean);
      T.freeze();
      for (let i = 0; i < 600 && !cs.every((c) => c.fig && c.fig.ok); i++) { for (const c of cs) r.draw(c, 1 / 30); await sleep(20); }
      for (let i = 0; i < 70; i++) { for (const c of cs) c.fig.update(c, 1 / 30); window.scene.updateMatrixWorld(true); }
      const d = w.doors.restaurant;
      if (!d || !d.parent || d.parent === 'main') throw new Error(`the Restaurant is not in a corner: ${d && d.wall}`);
      T.frameRoom('restaurant'); await settleFrames(3);
      return { data: capture() };
    });
    for (const [pid, seed, hint] of [['range', 63, 'the Shooting Range'], ['bowling', 64, 'the Bowling Alley'], ['studio', 65, 'the Studio'], ['backyard', 66, 'the Backyard']]) {
      add(`room-${pid}-corner`, 'rooms', async () => {                // every wall of GUY's room taken: ${hint} in a corner, behind a door in the room beside it
        await clean(seed);
        const w = window.brain.w, others = ['workshop', 'backyard', 'range', 'bowling', 'studio'].filter((o) => o !== pid);
        others.forEach((o, i) => w.rooms.add(o, { walls: [['back', 'left', 'right', 'front'][i]] }));
        w.rooms.add(pid);
        const d = w.doors[pid];
        if (!d || !d.parent || d.parent === 'main') throw new Error(`${pid} is not in a corner: ${d && d.wall}`);
        T.freeze(); window.guy.root.visible = false;
        T.frameRoom(pid);
        await settleFrames(3);
        return { data: capture() };
      });
    }
    add('room-paintings', 'rooms', async () => {
      await clean(44);
      T.addObject('easel');
      const P = window.brain.w.paintings, b = window.brain, w = b.w, e = w.objects.easel;
      const cols = ['#d0312d', '#2a62d8', '#f2c500', '#2e9e4a', '#8e44ad'];
      for (let i = 0; i < 5; i++) {
        e.paint.dab(0.5, 0.5, cols[i], 70); e.paint.stroke(0.1, 0.2, 0.9, 0.8, cols[(i + 2) % 5], 16); e.painted = true;
        b.hangPainting();
        for (let k = 0; k < 400 && !(P.items.length > i && b.last !== 'hangpaint' && !b.carry); k++) window.sim(0.25);
      }
      T.freeze(); T.home(); window.guy.root.position.set(1.5, 0, 2); window.guy.root.visible = false;       // (the paintings are the picture: where he happens to be in his stride is not)
      T.frameRoom('main'); await settleFrames(4);
      const data = capture();
      P.reset();
      return { data };
    });
  };

  // A clock that only moves when the simulation does: the music's beat, the game's frame timer and anything else that reads the real
  // time would otherwise make two pictures of the same moment differ (and the game would move on while the picture is being set up).
  let fake = null;
  function fakeClock(on) {
    if (on && !fake) {
      const real = performance.now.bind(performance), sim = window.sim;
      let t = 1000;
      performance.now = () => t;
      window.sim = (sec, dt) => { t += sec * 1000; return sim(sec, dt); };
      fake = { real, sim };
    } else if (!on && fake) { performance.now = fake.real; window.sim = fake.sim; fake = null; }
  }

  // A picture by id. Returns { id, ok, data } (ok false with `why` if the scene could not be set up).
  T.shot = async (id) => {
    T.shotIds();
    const s = SHOTS.find((x) => x.id === id);
    if (!s) return { id, ok: false, why: 'no such picture' };
    const base = T.errors.length;
    fakeClock(true); window.__qaPaused = true;
    try {
      const r = await s.setup();
      if (r && r.ok === false) return { id, ok: false, why: r.why };
      const data = (r && r.data) || (await settleFrames(3), capture());
      const st = await T.pictureStats(data);
      if (st.mean < 12 || st.std < 8) return { id, ok: false, why: `the picture is blank (average brightness ${st.mean.toFixed(0)}, variation ${st.std.toFixed(0)}): the camera is probably inside something`, data };
      return { id, ok: true, data, errors: T.errors.slice(base) };
    } catch (e) {
      return { id, ok: false, why: String(e && e.message || e) };
    } finally {
      window.guy.root.visible = true; window.__qaPaused = false; T.unfreeze(); T.unseed(); fakeClock(false); T.resetRooms();
    }
  };
  T.shotGroups = () => { T.shotIds(); return Object.fromEntries(SHOTS.map((s) => [s.id, s.group])); };

  // how bright a picture is on average and how much it varies (a black or flat picture means the camera is in the wrong place)
  T.pictureStats = async (url) => {
    const i = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const c = document.createElement('canvas'); c.width = 80; c.height = 60;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0, 80, 60);
    const d = x.getImageData(0, 0, 80, 60).data; let sum = 0, sq = 0; const n = d.length / 4;
    for (let k = 0; k < n; k++) { const l = 0.3 * d[k * 4] + 0.59 * d[k * 4 + 1] + 0.11 * d[k * 4 + 2]; sum += l; sq += l * l; }
    const mean = sum / n;
    return { mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
  };

  // how different two pictures (data URLs) are: the fraction of pixels where a colour channel moved by more than `tol` (of 255)
  T.compare = async (a, b, tol = 28) => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { changed: 1, mean: 255, size: [ia.width, ia.height, ib.width, ib.height] };
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const A = px(ia), B = px(ib), n = A.length / 4;
    const diff = document.createElement('canvas'); diff.width = ia.width; diff.height = ia.height;
    const dx = diff.getContext('2d'), out = dx.createImageData(ia.width, ia.height);
    let changed = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.max(Math.abs(A[i * 4] - B[i * 4]), Math.abs(A[i * 4 + 1] - B[i * 4 + 1]), Math.abs(A[i * 4 + 2] - B[i * 4 + 2]));
      sum += d;
      const hit = d > tol; if (hit) changed++;
      out.data[i * 4] = hit ? 255 : A[i * 4] * 0.35; out.data[i * 4 + 1] = hit ? 40 : A[i * 4 + 1] * 0.35; out.data[i * 4 + 2] = hit ? 40 : A[i * 4 + 2] * 0.35; out.data[i * 4 + 3] = 255;
    }
    dx.putImageData(out, 0, 0);
    return { changed: changed / n, mean: sum / n, diff: diff.toDataURL('image/png') };
  };

  // a quick self-check that the picture machinery works (the same scene twice is the same picture)
  T.sweepShotsSelf = async () => {
    const out = [];
    const a = await T.shot('char-guy-stand-front'), b = await T.shot('char-guy-stand-front');
    const cmp = a.ok && b.ok ? await T.compare(a.data, b.data) : null;
    out.push(result('pictures: the same scene taken twice gives the same picture (the pictures can be trusted)', !!cmp && cmp.changed < 0.002, { changed: cmp && cmp.changed }));
    return out;
  };
}
