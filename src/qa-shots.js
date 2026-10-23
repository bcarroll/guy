// QA by looking (installed onto the harness by devtools.js; NOT imported by the game).
//
// Numbers cannot tell that a character looks wrong, that a painting is on the wrong side of a wall, or that a prop floats beside a
// hand. This takes real pictures of the game, the same way every time, and compares each with the picture that was approved earlier:
//
//   T.shotIds()          every picture there is: each visual checkpoint in MANIFEST.visual (Guy at a pose from the front, side ...),
//                        every character (Guy, GAL, each customer) standing, walking and sitting from the front and the side,
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
    window.camera.position.set(cx + dx + (id === 'restaurant' || id === 'workshop' ? (cx > 2 ? -1 : 1) * wx * 0.45 : wx * 0.5), 5.2, cz + dist * 0.8);
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
    // the skeleton eases towards its pose a little every frame, so a picture taken a few frames earlier or later would catch Guy slightly
    // elsewhere: let it settle all the way (the pose itself is frozen), and let what he holds catch up with his hands
    const g = window.guy;
    if (g && g.loaded) { for (let i = 0; i < 90; i++) g.apply(1 / 30); window.scene.updateMatrixWorld(true); window.brain.safeLate(); }
    window.renderer.render(window.scene, window.camera);
    return window.renderer.domElement.toDataURL('image/jpeg', 0.9);
  }

  // ------------------------------------------------------------------------------------------------ the pictures
  const SHOTS = [];
  const add = (id, group, setup) => SHOTS.push({ id, group, setup });

  // 1. every visual checkpoint of the manifest (Guy at a pose, from a given side)
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
        window.guy.root.position.set(-4.2, 0, 3.2); window.guy.root.visible = false;      // Guy is out of the picture
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
  // The rigs are known only once the page is up, so the characters are added on the first call to shotIds.
  const baseIds = T.shotIds;
  let charsAdded = false;
  T.shotIds = () => { if (!charsAdded) { charsAdded = true; for (const r of rigs()) charShots(r); for (const m of T.customerModels()) restaurantShots(m); roomShots(); } return baseIds(); };

  // 3. the customers in the real restaurant
  const restaurantShots = (m) => {
    for (const state of ['waiting', 'ordered', 'eating', 'paying']) {
      add(`customer-${m.id}-${state}`, 'customers', async () => {
        await clean(31);
        window.guy.root.visible = false;                                  // Guy is out of the picture
        T.prep('takeorder');
        const r = window.brain.w.restaurant;
        r.headless = false; r.paused = true; r.clear();
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
      T.freeze(); T.home(); window.guy.root.position.set(1.5, 0, 2);
      T.frameRoom('main'); await settleFrames(3);
      return { data: capture() };
    });
    add('room-workshop', 'rooms', async () => {
      await clean(42);
      for (const id of ['workbench', 'toolbox', 'woodfactory', 'saw', 'mallet', 'sander']) T.addObject(id);
      T.freeze(); T.frameRoom('workshop'); await settleFrames(3);
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
      T.freeze(); T.home(); window.guy.root.position.set(1.5, 0, 2);
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
