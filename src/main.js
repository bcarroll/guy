import * as THREE from 'three';
import { initScreenLock } from './screenlock.js';
import { initVoice as initTTS } from './tts.js';
import { createVoice } from './voice.js';
import { initWorkstation } from './workstation.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildRoom, ROOM } from './room.js';
import { Guy } from './guy.js';
import { Brain } from './brain.js';
import { initAudio, audio } from './audio.js';
import { Skills, SKILL_INFO } from './skills.js';
import { sfx, drag as sfxDrag, setMuted, isMuted } from './sfx.js';
import { initMachine } from './machine.js';
import { initRooms } from './rooms.js';
import { initLayout } from './layout.js';
import { config as riffConfig } from './riffs.js';
import { ALBUM_CATALOG } from './albums.js';
import { initUpdateCheck } from './update.js';
import { Restaurant } from './customers.js';
import { Gal } from './gal.js';
import { Paintings } from './paintings.js';
import { dev } from './devunlock.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15171c);
scene.background = new THREE.Color(0x02030a);

// Outer-space void: a soft nebula dome plus a drifting starfield around the room.
const space = new THREE.Group();
scene.add(space);
{
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 d;
        float blob(vec3 c, float w){ return pow(max(dot(d, normalize(c)), 0.0), w); }
        void main(){
          vec3 col = vec3(0.008, 0.012, 0.03);
          col += vec3(0.30, 0.10, 0.45) * blob(vec3(-1.0, 0.3, -0.6), 5.0) * 0.55;
          col += vec3(0.05, 0.25, 0.45) * blob(vec3(1.0, -0.2, -0.8), 6.0) * 0.5;
          col += vec3(0.45, 0.12, 0.25) * blob(vec3(0.1, 0.9, 0.5), 8.0) * 0.4;
          col += vec3(0.04, 0.06, 0.12) * (1.0 - abs(d.y)) * 0.6;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  space.add(dome);
  const N = 1800, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const tint = [[1, 1, 1], [0.7, 0.85, 1], [1, 0.9, 0.7]];
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 25, s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    const t = tint[(Math.random() * 3) | 0], b = 0.35 + Math.random() * 0.65;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  space.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.1, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false })));
}
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
camera.position.set(6.5, 5, 9);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.maxDistance = 16;
controls.update();

// Frame the whole room so it fills the screen at any aspect ratio, until the user takes the camera.
const roomBox = [];
for (const x of [-5, 5]) for (const y of [0, 3.2]) for (const z of [-4, 4]) roomBox.push(new THREE.Vector3(x, y, z));
const camDir = new THREE.Vector3(6.5, 4, 9).normalize();
const camTmp = new THREE.Vector3();
let userMoved = false;
function fitRoom() {
  if (userMoved) return;
  const fits = (d) => {
    camera.position.copy(controls.target).addScaledVector(camDir, d);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    return roomBox.every((p) => { camTmp.copy(p).project(camera); return Math.abs(camTmp.x) <= 1 && Math.abs(camTmp.y) <= 1; });
  };
  let lo = 2, hi = 40;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  fits(hi);
  controls.maxDistance = Math.max(16, hi * 1.2);
}
controls.addEventListener('start', () => { userMoved = true; });
fitRoom();

const world = buildRoom(scene);
const guy = new Guy();
guy.root.position.set(0, 0, 2);
scene.add(guy.root);

const label = document.getElementById('activity');
const params = new URLSearchParams(location.search);
// what Guy has learned persists between visits; ?skills=all|none|stereo,piano overrides it (for testing)
const skills = new Skills(params.get('skills'));
const brain = new Brain(guy, world, (t) => (label.textContent = t), skills);
// the Restaurant's customers (they only come once the room is added, stocked, and Guy has read "Restaurant Basics")
world.restaurant = new Restaurant(world, { skillOk: () => skills.has('restaurant') || !!(world.gal && world.gal.skills && world.gal.skills.has('restaurant')), guyAt: () => guy.root.position });
// GAL, the second robot: built by Guy at the Build a Bot machine (gal.js). Her model loads at the start; she is saved unless ?fresh
// Speech (tts.js: offline robot voices + subtitles; voice.js: commands). Guy and GAL speak only in an interaction or to each other.
const tts = initTTS({ subs: document.getElementById('subs'), persist: !params.has('fresh') });
const galLine = document.getElementById('galline'), galLabel = document.getElementById('activity2');
world.gal = new Gal(world, {
  scene, guyBrain: brain, persist: !params.has('fresh'), skillsInit: params.get('skills') === 'all' || params.get('skills') === 'none' ? params.get('skills') : null,
  ui: (t) => { galLine.hidden = false; galLabel.textContent = t; },
  toast: (m) => { showToast(m); if (machineUI.isOpen()) machineUI.refresh(); }, onBuilt: (m) => showToast(m),
  speak: (who, text, kind) => tts.say(who, text, kind), onWorkstation: (b) => workstation.open(b),
});
world.gal.preload();
// Guy's paintings: hung on the walls of any room, the rest kept in the Catalog (they are saved unless ?fresh)
world.paintings = new Paintings(world, { persist: !params.has('fresh') });

// ---- skills panel + "learned something" toast ----
const panel = document.getElementById('skills');
const toast = document.getElementById('toast');
let toastTimer = 0;
function renderSkills() {
  const onShelf = (id) => !!world.objects.shelf && world.objects.shelf.books.some((b) => b.def.teaches === id);
  panel.querySelector('.list').innerHTML = Object.entries(SKILL_INFO).filter(([id]) => skills.has(id) || onShelf(id)).map(([id, info]) => `
    <div class="skill ${skills.has(id) ? 'known' : ''}">
      <div class="name">${skills.has(id) ? (skills.strength(id) < 1 ? '◔' : '✓') : '○'} ${info.name}</div>
      <div class="book">📕 ${info.book}${skills.has(id) ? (skills.strength(id) < 1 ? ` — forgetting (${Math.round(skills.strength(id) * 100)}% left)` : '') : ' — not read yet'}</div>
      <ul>${info.unlocks.map((u) => `<li>${u}</li>`).join('')}</ul>
    </div>`).join('');
}
renderSkills();
skills.onChange(renderSkills);
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 6000);
}
brain.onLearn = (def) => { showToast(`Guy learned ${def.blurb}!`); sfx('chime'); if (machineUI.isOpen()) machineUI.refresh(); };
brain.onRiff = (msg) => { showToast(msg); sfx('chime'); };
brain.onBuilt = (msg) => { showToast(msg); machineUI.refresh(); };           // something finished in the Workshop: it is in storage now
riffConfig.persist = !params.has('fresh');           // ?fresh keeps the riffs he makes up in memory only

// ---- speed: how fast Guy walks and how short his pauses are between interactions (the dropdown beside Follow) ----
const speedSel = document.getElementById('speed-sel');
{
  let saved = 1;
  try { saved = Number(localStorage.getItem('guy.speed.v1')) || 1; } catch { /* no storage */ }
  if (![...speedSel.options].some((o) => Number(o.value) === saved) || params.has('fresh')) saved = 1;
  speedSel.value = String(saved);
  brain.speed = saved;
  speedSel.addEventListener('change', () => {
    brain.speed = Number(speedSel.value) || 1;
    if (!params.has('fresh')) { try { localStorage.setItem('guy.speed.v1', String(brain.speed)); } catch { /* no storage */ } }
  });
}

// ---- Lock in: the chip shows while Guy is locked on an object; tap it to let him go ----
const lockBtn = document.getElementById('lock-btn');
brain.onLock = (L) => {
  lockBtn.hidden = !L;
  if (L) lockBtn.textContent = `🔒 Locked on ${L.name.replace(/\d+$/, '')} · tap to stop`;
};
lockBtn.addEventListener('click', () => { brain.unlock(true); showToast('Guy is free to do what he likes.'); });

// ---- the Catalog on the wall: tap it for the catalog of objects and books ----
// Rooms the user adds from the Catalog: a door on a wall, and a room behind it. Frame the camera round all of them.
const rooms = initRooms({
  world, persist: !params.has('fresh'), remove: (id) => removeById(id),
  refit: () => {
    const e = world.extent();
    roomBox.length = 0;
    for (const x of [e.minX, e.maxX]) for (const y of [0, 3.2]) for (const z of [e.minZ, e.maxZ]) roomBox.push(new THREE.Vector3(x, y, z));
    if (!userMoved) controls.target.set((e.minX + e.maxX) / 2, 1, (e.minZ + e.maxZ) / 2);
    fitRoom();
  },
});
world.rooms = rooms;
rooms.onChange(() => world.paintings.sync());        // a room taken away: the paintings on its walls go to the Catalog
const machineUI = initMachine({
  world, guy, persist: !params.has('fresh'), rooms, paintings: world.paintings,
  knows: (id) => skills.has(id) || !!(world.gal && world.gal.skills && world.gal.skills.has(id)),       // Guy or GAL
  notify: (msg) => { showToast(msg); renderSkills(); sfx('pop'); },
  remove: (id) => removeById(id),
});
// Where everything was last time: the catalog's additions first, then every piece back in its place (and what the user took
// out), then the door of any added room (anything standing in its way comes out), then start saving changes as they happen.
const layout = initLayout({ world, guy, remove: (id) => removeById(id), persist: !params.has('fresh') });
world.layout = layout;
// (this must come BEFORE the saved rooms are restored: a premium room such as the Restaurant is refused while premium is locked, so it was
// dropped on every reload and then forgotten at the next save)
// development: one button turns every premium thing on (there is no way to pay yet); remembered unless ?fresh
{
  const btn = document.getElementById('devunlock'), key = 'guy.dev.unlock', keep = !params.has('fresh');
  const show = () => { btn.classList.toggle('on', dev.all); btn.textContent = dev.all ? '🔒 lock premium' : '🔓 unlock premium'; };
  try { if (keep && localStorage.getItem(key) === '1') dev.all = true; } catch { /* no storage */ }
  show();
  (window.__boot ||= []).push('devunlock');
  btn.addEventListener('click', () => {
    dev.all = !dev.all;
    try { if (keep) localStorage.setItem(key, dev.all ? '1' : '0'); } catch { /* no storage */ }
    show(); machineUI.refresh();
    showToast(dev.all ? 'Premium rooms, records and items are unlocked' : 'Premium is locked again');
  });
}
machineUI.restoreExtras();
layout.restore();
(window.__boot ||= []).push('rooms.restore');
rooms.restore();
machineUI.restoreExtras();         // the rooms are back, so what belongs to them (the Workshop's furniture) can be added now ...
layout.restore();                  // ... and put where it was left
world.paintings.restore();         // then Guy's paintings, on the walls of the rooms that are back
world.gal.restore();               // and GAL, if Guy built her on an earlier visit
layout.start();
initUpdateCheck();
// The build this page is running, in the top-left corner: the short commit id (the first seven characters of the id). Checking
// this against a new commit shows whether a deployed update reached the phone.
document.getElementById('build').textContent = `build ${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__.slice(0, 7) : 'dev'}`;
if (params.get('records') === 'all' && world.objects.shelf) ALBUM_CATALOG.forEach((a) => { if (!world.objects.shelf.albums.some((r) => r.def.id === a.id)) world.objects.shelf.addAlbum(a); }); // testing aid
renderSkills();
let machinePress = null;
const togglePanel = () => { panel.hidden = !panel.hidden; };
document.getElementById('skills-btn').addEventListener('click', togglePanel);
addEventListener('keydown', (e) => { if (e.key === 'k' || e.key === 'K') togglePanel(); });

let follow = params.has('follow');
const followBtn = document.getElementById('follow-btn');
const toggleFollow = () => { follow = !follow; followBtn.classList.toggle('on', follow); };
followBtn.classList.toggle('on', follow);
followBtn.addEventListener('click', toggleFollow);
const nextActivity = () => { brain.unlock(false); brain.skip(); };      // Next also lets go of a lock: it is the user telling him to move on
document.getElementById('skip-btn').addEventListener('click', nextActivity);
addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') toggleFollow();
  if (e.code === 'Space') { e.preventDefault(); nextActivity(); }
});
// There is no "click to start" screen. Browsers keep the sound off until the page has been touched once, so the first real tap, drag
// or key press anywhere starts the audio quietly; until then Guy carries on in silence. Fullscreen on phones is the Full button.
// (?nostart is still accepted so old test URLs work; it no longer does anything.)
// The speaker in the top corner is always there: red (and pulsing) while the sound has not started, red while it is muted, and
// faint while it is on. Tapping it starts the sound, and once it is running it is the mute button (M does the same).
const soundBtn = document.getElementById('sound-btn');
let soundMuted = false;
const audioRunning = () => { const c = audio().ctx; return !!(c && c.state === 'running'); };
const syncSoundIcon = () => {
  const running = audioRunning();
  const state = !running ? 'off' : soundMuted ? 'muted' : 'on';
  soundBtn.className = state;
  soundBtn.textContent = state === 'on' ? '🔊' : '🔇';
  const label = { off: 'Sound is off. Tap to turn it on.', muted: 'Sound is muted. Tap to turn it back on.', on: 'Sound is on. Tap to mute.' }[state];
  soundBtn.title = label; soundBtn.setAttribute('aria-label', label);
};
const setSoundMuted = (m) => {                    // mutes everything: the music and Guy's instruments (the master volume) and the sound effects
  soundMuted = !!m;
  const { master } = audio();
  if (master) master.gain.value = soundMuted ? 0 : 0.5;
  setMuted(soundMuted);
  syncSoundIcon();
};
// Not yet running: the tap itself starts the sound (unlockAudio), and that same tap must not also mute it, so whether the sound was
// running is noted when the press begins.
let wasRunning = false;
for (const t of ['pointerdown', 'keydown']) soundBtn.addEventListener(t, () => { wasRunning = audioRunning(); });
soundBtn.addEventListener('click', () => { if (wasRunning && audioRunning()) setSoundMuted(!soundMuted); });
window.__guySound = { mute: setSoundMuted, muted: () => soundMuted, sync: syncSoundIcon };       // for the QA harness
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'];
function unlockAudio(e) {
  if (!e.isTrusted) return;                       // only a real touch counts (the QA harness's pretend events must not start the audio)
  initAudio();
  const ctx = audio().ctx;
  ctx.onstatechange = syncSoundIcon;
  const done =() => UNLOCK_EVENTS.forEach((t) => removeEventListener(t, unlockAudio, true));
  if (ctx.state === 'running') done();
  else ctx.resume().then(() => { if (ctx.state === 'running') done(); syncSoundIcon(); }).catch(() => {});
  syncSoundIcon();
}
UNLOCK_EVENTS.forEach((t) => addEventListener(t, unlockAudio, true));
window.__guyAudio = audio;                         // for the QA harness

guy.load(import.meta.env.BASE_URL + 'models/ybot.fbx').then(() => {
  window.guy = guy; window.camera = camera; window.controls = controls; window.scene = scene; window.brain = brain; window.THREE = THREE; window.renderer = renderer;
  const force = params.get('act');
  if (force) brain.choose(force);
}).catch((e) => { label.textContent = 'failed to load model: ' + e.message; console.error(e); });

// Bounce the ball off furniture (treated as solid boxes up to their height, including the movable bench).
function collideBall(b, v, r) {
  const p = b.position;
  for (let pass = 0; pass < 2; pass++) {
    for (const o of world.obstacles) {
      if (p.y - r > o.h) continue;
      const cx = THREE.MathUtils.clamp(p.x, o.x0, o.x1), cz = THREE.MathUtils.clamp(p.z, o.z0, o.z1);
      let dx = p.x - cx, dz = p.z - cz, nx, nz, pen;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
      else { // centre inside the box: leave through the nearest face
        const faces = [[p.x - o.x0, -1, 0], [o.x1 - p.x, 1, 0], [p.z - o.z0, 0, -1], [o.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
        pen = faces[0] + r; nx = faces[1]; nz = faces[2];
      }
      p.x += nx * pen; p.z += nz * pen;
      const vn = v.x * nx + v.z * nz;
      if (vn < 0) { if (-vn > 0.6) sfx('knock', -vn); v.x -= 1.6 * vn * nx; v.z -= 1.6 * vn * nz; } // restitution 0.6
    }
  }
}

// Ball physics: friction, wall bounces, and Guy nudging it when he walks into it
const tmp = new THREE.Vector3();
function updateBall(dt) {
  const b = world.ball, v = b.userData.vel, r = b.userData.r;
  if (world.ballGone) return;
  if (b.userData.kinematic) return; // Guy is handling it
  if (drag && drag.ball) { v.set(0, 0, 0); return; } // held by the user
  b.position.addScaledVector(v, dt);
  v.y -= 9.8 * dt;
  if (b.position.y < r) {
    b.position.y = r;
    if (Math.abs(v.y) > 0.6) { sfx('bounce', Math.abs(v.y)); v.y *= -0.55; } else v.y = 0;
    v.x *= 0.995; v.z *= 0.995;
  }
  if (b.position.y <= r + 0.001) { const f = Math.exp(-dt * 0.9); v.x *= f; v.z *= f; }
  const lim = [4.95 - r, 3.95 - r];
  if (Math.abs(b.position.x) > lim[0]) { b.position.x = Math.sign(b.position.x) * lim[0]; if (Math.abs(v.x) > 0.7) sfx('wallbump', Math.abs(v.x)); v.x *= -0.7; }
  if (Math.abs(b.position.z) > lim[1]) { b.position.z = Math.sign(b.position.z) * lim[1]; if (Math.abs(v.z) > 0.7) sfx('wallbump', Math.abs(v.z)); v.z *= -0.7; }
  collideBall(b, v, r);
  if (b.position.y > 3.2 - r) { b.position.y = 3.2 - r; if (Math.abs(v.y) > 1) sfx('knock', Math.abs(v.y)); v.y *= -0.5; }
  b.rotation.x += v.z * dt / r; b.rotation.z -= v.x * dt / r;
  if (guy.loaded) {
    tmp.copy(b.position).sub(guy.pos).setY(0);
    const d = tmp.length();
    if (d < 0.45 && d > 0.001) { tmp.normalize(); b.position.addScaledVector(tmp, 0.45 - d); v.addScaledVector(tmp, 0.8); }
  }
}

// ---- Mouse/touch: drag an object to move it, long-press it for a menu (rotate / remove) ----
// The user can move heavy things Guy can't.
const raycaster = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();
const hitPoint = new THREE.Vector3();
const LONG_PRESS_MS = 550;
const canvas = renderer.domElement;
let drag = null;     // object currently being dragged
let pending = null;  // pressed on an object, not yet decided between drag and long-press

function ray(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}

function pick(e) {
  ray(e);
  const targets = Object.values(world.objects).map((o) => o.group);
  targets.push(world.skillMachine);
  for (const d of Object.values(world.decor)) targets.push(d.group);
  for (const d of Object.values(world.doors)) targets.push(d.group);
  if (!world.ballGone) targets.push(world.ball);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return null;
  const point = hit.point.clone();
  for (let n = hit.object; n; n = n.parent) {
    if (n === world.skillMachine) return { machine: true };
    if (n === world.ball) return { ball: true };
    const obj = Object.values(world.objects).find((o) => o.group === n);
    if (obj) return { obj, point };
    const door = Object.values(world.doors).find((d) => d.group === n);
    if (door) return { door, point };
    const decor = Object.values(world.decor).find((d) => d.group === n);
    if (decor) return { decor, point };
  }
  return null;
}

// A point on the plane a wall piece lives on.
function planeAt(e, plane) {
  ray(e);
  return raycaster.ray.intersectPlane(plane, hitPoint) ? hitPoint : null;
}

// Take something out of the room (the context menu and the Catalog both come through here).
function removeById(id) {
  if (id === 'ball') { world.removeBall(); brain.ballRemoved && brain.ballRemoved(); }
  else if (world.objects[id] && world.objects[id].kind) { world.storeInstance(id); brain.objectRemoved(id); machineUI.save(); machineUI.refresh(); }     // something Guy built goes back into storage
  else { world.removeObject(id); brain.objectRemoved(id); }
}

function floorAt(e, y = 0) {
  ray(e);
  floorPlane.constant = -y;
  return raycaster.ray.intersectPlane(floorPlane, hitPoint) ? hitPoint : null;
}

// Can `obj` stand at (x, z)? Inside the room, clear of other furniture and of Guy.
function canPlace(obj, x, z, w = obj.w, d = obj.d) {
  if (!world.fits(obj, x, z, w, d)) return false;
  const gx = THREE.MathUtils.clamp(guy.pos.x, x - w / 2, x + w / 2), gz = THREE.MathUtils.clamp(guy.pos.z, z - d / 2, z + d / 2);
  return Math.hypot(guy.pos.x - gx, guy.pos.z - gz) > 0.35;
}

// ---- context menu ----
// ---- playback controls for the stereo ----
const player = document.getElementById('player');
let playerTimer = 0;
function renderPlayer() {
  const np = brain.nowPlaying();
  player.querySelector('.now').innerHTML = `${np.playing ? '▶ ' : '■ '}${np.title}${np.album ? `<small>${np.album}</small>` : ''}`;
  player.querySelector('[data-p=play]').classList.toggle('on', np.playing);
  // every song on every record on the shelf, in order; tap one to play it
  const box = player.querySelector('.tracks');
  box.innerHTML = np.list.map((t, i) => `<div class="row ${i === np.index ? 'cur' : ''}" data-id="${t.id}">${i === np.index && np.playing ? '▶' : '·'} ${t.title}${t.album ? ` <small>${t.album}</small>` : ''}</div>`).join('');
  const cur = box.querySelector('.cur');
  if (cur) box.scrollTop = Math.max(0, cur.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2);
}
function showPlayer() {
  player.hidden = false;
  renderPlayer();
  clearInterval(playerTimer);
  playerTimer = setInterval(renderPlayer, 500);   // Guy can start or stop the music too
}
function hidePlayer() { player.hidden = true; clearInterval(playerTimer); }
// the playback controls live on a button beside Follow, shown while there is a stereo in the room
const playerBtn = document.getElementById('player-btn');
playerBtn.addEventListener('click', () => (player.hidden ? showPlayer() : hidePlayer()));
setInterval(() => {
  const has = !!brain.obj('table');
  playerBtn.hidden = !has;
  if (!has && !player.hidden) hidePlayer();
}, 300);
player.querySelector('.pclose').addEventListener('click', hidePlayer);
player.addEventListener('click', (e) => {
  const a = e.target.dataset && e.target.dataset.p;
  if (a) brain.stereoControl(a);
  const row = e.target.closest && e.target.closest('.row[data-id]');
  if (row) brain.stereoControl('select', row.dataset.id);
  renderPlayer();
});
brain.onStereoChange = renderPlayer;

const menu = document.getElementById('menu');
const menuTitle = menu.querySelector('.title');
const menuNote = menu.querySelector('.note');
let menuTarget = null;

// was the press on a shelf that holds books (rather than the frame or an empty shelf)?
function bookHit(h) {
  const sh = h.obj;
  return sh.books.some((b) => b.mesh.visible && Math.abs(h.point.y - b.y) < 0.3);
}
function closeMenu() { menu.hidden = true; menuTarget = null; albumMenu.hidden = true; }

// ---- the top shelf holds the records: long-press it to choose one to play on the stereo ----
const albumMenu = document.getElementById('albummenu');
const TOP_SHELF_Y = 1.74;   // height of the board under the top shelf
function placeAlbumMenu(x, y) {
  albumMenu.hidden = false;
  albumMenu.style.left = Math.max(8, Math.min(x, innerWidth - albumMenu.offsetWidth - 8)) + 'px';
  albumMenu.style.top = Math.max(8, Math.min(y, innerHeight - albumMenu.offsetHeight - 8)) + 'px';      // always fully on screen: a long list scrolls inside
  albumMenu.scrollTop = 0;
}
// the lower shelves hold the books: long-press them to see which ones Guy has read
function openBookMenu(shelfObj, x, y) {
  albumMenu.querySelector('.title').textContent = '📚 Books on the shelf';
  albumMenu.querySelector('.list').innerHTML = shelfObj.books.filter((b) => b.mesh.visible).map((b) => {
    const read = skills.has(b.def.teaches);
    const st = skills.strength(b.def.teaches);
    const fading = read && st < 1;
    const note = fading ? `Forgetting… ${Math.round(st * 100)}% of ${b.def.blurb} left` : read ? 'Read — Guy knows ' + b.def.blurb : 'Not read yet — tap to have Guy read it';
    return `<div class="brow ${read ? 'done' : ''}" ${read ? '' : `data-book="${b.def.id}"`}><span class="ico">${fading ? '🌫️' : read ? '✅' : '📕'}</span><span class="grow"><b>${b.def.title}</b><small>${note}</small></span><button class="remove" data-remove="${b.def.id}" title="Take the book off the shelf. It goes back to the Catalog and Guy keeps what he learned">Remove</button><button class="forget" data-forget="${b.def.id}" title="Take the book off the shelf; Guy gradually forgets what it taught">Forget</button></div>`;
  }).join('');
  placeAlbumMenu(x, y);
}
function openAlbumMenu(shelfObj, x, y) {
  albumMenu.querySelector('.title').textContent = '💿 Play a record';
  const list = albumMenu.querySelector('.list');
  list.innerHTML = shelfObj.albums.map((a) => `<button data-track="${a.def.track}"><span class="ico">${a.def.icon || '💿'}</span><span><b>${a.def.title}</b><small>${a.def.genre}</small></span></button>`).join('');
  placeAlbumMenu(x, y);
}
albumMenu.addEventListener('click', (e) => {
  const rm = e.target.closest('button[data-remove]');
  if (rm) {
    const r = brain.removeBook(rm.dataset.remove);
    albumMenu.hidden = true;
    showToast(r.message);
    if (r.ok) { machineUI.save(); machineUI.refresh(); renderSkills(); }
    return;
  }
  const fg = e.target.closest('button[data-forget]');
  if (fg) {
    const r = brain.forgetBook(fg.dataset.forget);
    albumMenu.hidden = true;
    showToast(r.message);
    if (r.ok) { machineUI.save(); machineUI.refresh(); renderSkills(); }
    return;
  }
  const bk = e.target.closest('[data-book]');
  if (bk) {
    albumMenu.hidden = true;
    const r = brain.requestRead(bk.dataset.book);
    showToast(r.message);
    return;
  }
  const b = e.target.closest('button[data-track]');
  if (!b) return;
  albumMenu.hidden = true;
  if (!brain.obj('table')) { showToast("There's no stereo to play it on."); return; }
  brain.stereoControl('select', b.dataset.track);
  showToast(`Playing ${brain.nowPlaying().title}`);
});

// What the long-press "do something with it" button is called for each object.
function interactLabel(name) {
  const w = brain.w;
  switch (name) {
    case 'piano': case 'bench': return '🎹 Play Piano';
    case 'table': return brain.music ? '🔊 Turn Stereo Off' : '🔊 Turn Stereo On';
    case 'guitar': return '🎸 Play Guitar';
    case 'drums': return '🥁 Play Drums';
    case 'ball': return '⚽ Play with Ball';
    case 'lamp': return brain.skills.has('lighting') ? '💡 Set the Mood' : w.lamp && w.lamp.on === false ? '💡 Turn Lamp On' : '💡 Turn Lamp Off';
    case 'shelf': return '📖 Read a Book';
    case 'armchair': return '🪑 Sit Down';
    case 'easel': return '🎨 Paint';
    case 'telescope': return '🔭 Look through Telescope';
    case 'workbench': return '🛠️ Build Something';
    case 'toolbox': return '🧰 Tidy the Tools';
    case 'woodfactory': return '🏭 Make Planks';
    case 'saw': return '🪚 Saw a Plank';
    case 'mallet': return '🔨 Tap Things Together';
    case 'sander': return '🧽 Sand Some Wood';
    case 'metalfactory': return '🏭 Make Metal Bars';
    case 'metalcutter': return '✂️ Cut a Metal Bar';
    case 'welder': return '🔥 Weld Something';
    case 'anvil': return '🔨 Hammer Metal';
    case 'botprinter': return '🤖 Build GAL';
    case 'workstation': return '🖥️ Use Workstation';
    case 'plant': case 'flowerplant': case 'tree': return '🌱 Tend Plant';
    default: return brain.obj(name) && brain.obj(name).guitar ? '🎸 Play Guitar' : brain.obj(name) && brain.obj(name).kind === 'footstool' ? '🪜 Stand on It to Clean' : brain.obj(name) && brain.obj(name).sit ? '🪑 Sit Down' : '▶ Use';
  }
}

// What the door menu's first button does. It goes to the room on the far side of the face that was pressed (`side`: 'main' is the face in Guy's
// own room, 'room' the face inside the room behind it). If Guy is already there it offers the way the other direction instead, so the button
// always does something. Either way it is brain.visitRoom: he goes in when he is outside and comes back when he is inside.
function doorChoice(door, side) {
  const p = brain.g.root.position, inRoom = world.roomIdAt(p.x, p.z) === door.id;
  const guyAt = inRoom ? door.id : 'main';
  let target = side === 'room' ? 'main' : door.id;
  const already = target === guyAt;
  if (already) target = target === door.id ? 'main' : door.id;
  const name = (t) => (t === 'main' ? "Guy's room" : `the ${door.name}`);
  const label = target === door.id ? `🚪 Go into the ${door.name}` : side === 'main' ? '🚪 Come back' : "🚪 Go into Guy's room";
  return { side, target, already, label, note: already ? `Guy is already in ${name(guyAt)}` : '' };
}

function openMenu(hit, x, y) {
  menuTarget = hit;
  if (hit.door) {                                       // a door: go through it (or come back), and lock it to keep the robots out
    const ch = doorChoice(hit.door, hit.side || (hit.point ? world.doorSide(hit.door.id, hit.point) : 'main')), locked = world.isDoorLocked(hit.door.id);
    menuTarget = { ...hit, side: ch.side };
    menuTitle.textContent = `${hit.door.name} door${locked ? ' (locked)' : ''}`;
    menuNote.textContent = ch.note;
    menu.querySelectorAll('[data-act]').forEach((b) => { b.hidden = b.dataset.act !== 'interact' && b.dataset.act !== 'lock'; });
    menu.querySelector('[data-act="interact"]').textContent = ch.label;
    menu.querySelector('[data-act="lock"]').textContent = locked ? '🔓 Unlock the door' : '🔒 Lock the door';
    menu.hidden = false;
    menu.style.left = Math.min(x, innerWidth - menu.offsetWidth - 8) + 'px';
    menu.style.top = Math.min(y, innerHeight - menu.offsetHeight - 8) + 'px';
    return;
  }
  menuTitle.textContent = hit.ball ? 'ball' : hit.decor ? hit.decor.label : hit.obj.name;
  menuNote.textContent = '';
  const turnable = hit.decor && !hit.decor.wall && hit.decor.hx !== hit.decor.hz;   // a rectangular rug can be turned; wall pieces and round things cannot
  menu.querySelectorAll('[data-act^="rot"]').forEach((b) => (b.hidden = !!(hit.ball || (hit.decor && !turnable))));
  menu.querySelectorAll('[data-act="interact"]').forEach((b) => (b.hidden = !!hit.decor));
  menu.querySelectorAll('[data-act="hang"]').forEach((b) => (b.hidden = !(hit.obj && hit.obj.name === 'easel' && world.paintings.easelHas())));      // a painting is on the easel
  menu.querySelectorAll('[data-act="remove"]').forEach((b) => (b.hidden = !!(hit.obj && hit.obj.removable === false)));
  // the first button says what the object is for
  const oname = hit.ball ? 'ball' : hit.obj && hit.obj.name;
  const iact = menu.querySelector('[data-act="interact"]');
  if (iact) iact.textContent = interactLabel(oname);
  // Lock in: keep using this object until told to stop (or Unlock, when he already is). Only for things he can use right now.
  const lact = menu.querySelector('[data-act="lock"]');
  const locked = !!(brain.lock && brain.lock.name === oname);
  lact.hidden = !!hit.decor || !(locked || brain.lockActs(oname).length);
  lact.textContent = locked ? '🔓 Unlock' : '🔒 Lock in';
  menu.hidden = false;
  menu.style.left = Math.min(x, innerWidth - menu.offsetWidth - 8) + 'px';
  menu.style.top = Math.min(y, innerHeight - menu.offsetHeight - 8) + 'px';
}

// Quarter-turn if it fits, shifting it the smallest distance away from walls/neighbours if the new footprint needs more room.
function rotateObject(obj, dir) {
  const nw = obj.d, nd = obj.w; // a quarter turn swaps width and depth
  const shifts = [];
  for (let dx = -1.2; dx <= 1.2001; dx += 0.1) for (let dz = -1.2; dz <= 1.2001; dz += 0.1) shifts.push([dx, dz]);
  shifts.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  for (const [dx, dz] of shifts) {
    if (canPlace(obj, obj.x + dx, obj.z + dz, nw, nd)) {
      obj.rotate(dir);
      obj.set(obj.x + dx, obj.z + dz);
      return true;
    }
  }
  return false;
}

menu.addEventListener('click', (e) => {
  const act = e.target.dataset && e.target.dataset.act;
  if (!act || !menuTarget) return;
  const t = menuTarget;
  if (t.door) {                                         // long-press a door > Go into the room (or Come back), or Lock / Unlock it
    if (act === 'interact') showToast(brain.visitRoom(t.door.id).message);
    if (act === 'lock') {
      const now = !world.isDoorLocked(t.door.id);
      rooms.setDoorLocked(t.door.id, now);
      showToast(now ? `The ${t.door.name} door is locked: Guy and GAL will stay out.` : `The ${t.door.name} door is unlocked.`);
    }
    closeMenu();
    return;
  }
  if (act === 'interact') {
    const r = brain.interact(t.ball ? 'ball' : t.obj.name);
    showToast(r.message);
    closeMenu();
    return;
  }
  if (act === 'hang') {                                 // long-press the easel > Hang painting: Guy takes it down and decides where it goes
    showToast(brain.hangPainting().message);
    closeMenu();
    return;
  }
  if (act === 'lock') {
    const oname = t.ball ? 'ball' : t.obj.name;
    if (brain.lock && brain.lock.name === oname) { brain.unlock(true); showToast('Guy is free to do what he likes.'); }
    else showToast(brain.lockOn(oname).message);
    closeMenu();
    return;
  }
  if (act === 'remove') {
    if (t.obj && t.obj.removable === false) return;
    removeById(t.ball ? 'ball' : (t.obj || t.decor).name);
    closeMenu();
  } else if (t.decor) {
    const ok = t.decor.turn(act === 'rotr' ? 1 : -1);
    menuNote.textContent = ok ? '' : 'No room to turn it here';
    if (ok) closeMenu();
  } else if (t.obj) {
    const ok = rotateObject(t.obj, act === 'rotr' ? 1 : -1);
    menuNote.textContent = ok ? '' : 'No room to turn it here';
    if (ok) closeMenu();
  }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
window.__guyOpenBooks = () => openBookMenu(world.objects.shelf, 200, 100);          // the long-press book list, for the QA harness
window.__guyOpenDoorMenu = (id, side = 'main') => openMenu({ door: world.doors[id], side }, 120, 120);     // for the QA harness (side: the face pressed)
window.__guyOpenMenu = (name) => openMenu(name === 'ball' ? { ball: true } : { obj: brain.obj(name) }, 120, 120);     // for the QA harness
addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') { setSoundMuted(!soundMuted); showToast(soundMuted ? 'Sound muted (M or the speaker to turn it back on)' : 'Sound on'); } });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Screen lock (screenlock.js): off / camera only / on. Locking closes every menu and panel and drops any press in progress.
const screenLock = initScreenLock({
  persist: !params.has('fresh'), toast: (m) => showToast(m),
  onLock: () => { closeMenu(); machineUI.close(); hidePlayer(); panel.hidden = true; if (pending) { clearTimeout(pending.timer); pending = null; } drag = null; },
});
screenLock.onChange(() => { controls.enabled = screenLock.cameraOk(); });
window.__screenLock = screenLock;

// The Learning Workstation's panel opens for whichever robot tapped the screen
const workstation = initWorkstation({ world, toast: showToast });
brain.onWorkstation = (b) => workstation.open(b);
brain.onLearnMany = (defs) => { showToast(`Guy learned ${defs.length} skills!`); sfx('chime'); if (machineUI.isOpen()) machineUI.refresh(); };
window.__workstation = workstation;

// Typed commands (the same path the microphone will use): the 💬 button opens a box; Enter sends it to Guy.
const voice = createVoice({ world, brain, screen: screenLock, say: (who, text, kind) => tts.say(who, text, kind), toast: showToast });
const cmdBox = document.getElementById('cmdbox'), cmdIn = document.getElementById('cmd-in');
document.getElementById('talk-btn').addEventListener('click', () => { cmdBox.hidden = !cmdBox.hidden; if (!cmdBox.hidden) { cmdIn.focus(); tts.warm().catch(() => {}); } });
cmdBox.addEventListener('submit', (e) => { e.preventDefault(); const t = cmdIn.value.trim(); if (!t) return; cmdIn.value = ''; voice.run(t); });
cmdBox.querySelector('#cmd-chatter').addEventListener('change', (e) => tts.set('chatter', e.target.value));
cmdBox.querySelector('#cmd-chatter').value = tts.settings.chatter;
window.__voice = { run: (t) => voice.run(t), parse: voice.parse, tts, audienceOn: voice.audienceOn };


// Capture phase so we run before OrbitControls and can keep it from orbiting while we handle an object.
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || screenLock.locked()) return;            // locked: no object presses, the camera may still orbit
  if (!menu.hidden || !albumMenu.hidden) closeMenu();
  const hit = pick(e);
  if (!hit) return;
  if (hit.machine) { machinePress = { x: e.clientX, y: e.clientY, t: performance.now() }; return; } // a tap, not draggable or removable
  // Rugs cover the middle of the floor, where people drag to orbit, so a quick drag on one still orbits (we do not stop the event).
  // Hold on a rug for half a second and it is picked up: drag to move it, or let go without moving for its menu (Turn / Remove).
  if (hit.decor && !hit.decor.wall) {
    pending = { hit, x: e.clientX, y: e.clientY, off: null, orbit: true, armed: false };
    pending.timer = setTimeout(() => {
      if (!pending) return;
      const p = planeAt({ clientX: pending.x, clientY: pending.y }, hit.decor.plane);
      pending.armed = true;
      pending.off = p ? { u: hit.decor.u - p.x, v: hit.decor.v - p.z } : { u: 0, v: 0 };
      controls.enabled = false;                    // the orbit that began on the press stops here
      canvas.style.cursor = 'grab';
    }, LONG_PRESS_MS);
    return;
  }
  e.stopImmediatePropagation();
  const p = hit.decor ? planeAt(e, hit.decor.plane) : floorAt(e);
  if (!p) return;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
  const q = hit.decor ? hit.decor.uv(p) : null;
  pending = { hit, x: e.clientX, y: e.clientY, off: hit.obj ? { x: hit.obj.x - p.x, z: hit.obj.z - p.z } : q ? { u: hit.decor.u - q.u, v: hit.decor.v - q.v } : null };
  pending.timer = setTimeout(() => {
    if (!pending) return;
    const h = pending.hit;
    if (h.obj && h.obj.name === 'shelf' && h.point && h.point.y > TOP_SHELF_Y && h.obj.albums && h.obj.albums.length) openAlbumMenu(h.obj, pending.x, pending.y);
    else if (h.obj && h.obj.name === 'shelf' && h.point && h.obj.books && h.obj.books.some((b) => b.mesh.visible) && bookHit(h)) openBookMenu(h.obj, pending.x, pending.y);
    else openMenu(h, pending.x, pending.y);
    pending = null;
  }, LONG_PRESS_MS);
}, true);

canvas.addEventListener('pointermove', (e) => {
  if (pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 8) {
    clearTimeout(pending.timer);
    if (pending.hit.door) { /* a door cannot be dragged: moving the pointer cancels the press */ }
    else if (!pending.orbit || pending.armed) drag = { ...pending.hit, off: pending.off };   // a held rug follows the pointer; a quick drag on one orbits
    pending = null;
  }
  if (!drag) {
    if (!pending) { const h = pick(e); canvas.style.cursor = h && !(h.decor && !h.decor.wall) ? (h.machine || h.door ? 'pointer' : 'grab') : ''; }
    return;
  }
  canvas.style.cursor = 'grabbing';
  if (drag.decor && !drag.decor.wall) {                // a rug: follow the pointer across the floor, staying inside the room
    const d = drag.decor, p = planeAt(e, d.plane);
    if (!p) return;
    const nu = p.x + drag.off.u, nv = p.z + drag.off.v;
    if (world.decorFits(d, nu, nv)) d.set(nu, nv);
    else if (world.decorFits(d, nu, d.v)) d.set(nu, d.v);
    else if (world.decorFits(d, d.u, nv)) d.set(d.u, nv);
    return;
  }
  if (drag.decor) {                                    // slide a window or the picture along its wall, round anything in the way
    const d = drag.decor, p = planeAt(e, d.plane);
    if (!p) return;
    const q = d.uv(p), nu = q.u + drag.off.u, nv = q.v + drag.off.v;
    if (world.decorFits(d, nu, nv)) d.set(nu, nv);
    else if (world.decorFits(d, nu, d.v)) d.set(nu, d.v);
    else if (world.decorFits(d, d.u, nv)) d.set(d.u, nv);
    return;
  }
  if (drag.ball) {
    const p = floorAt(e, 0.5);
    if (p) world.ball.position.set(THREE.MathUtils.clamp(p.x, -4.8, 4.8), 0.5, THREE.MathUtils.clamp(p.z, -3.8, 3.8));
    return;
  }
  const p = floorAt(e);
  if (!p) return;
  const o = drag.obj;
  const nx = p.x + drag.off.x, nz = p.z + drag.off.z;
  const ox = o.x, oz = o.z;
  if (canPlace(o, nx, nz)) o.set(nx, nz);
  else if (canPlace(o, nx, o.z)) o.set(nx, o.z); // slide along obstacles
  else if (canPlace(o, o.x, nz)) o.set(o.x, nz);
  const moved = Math.hypot(o.x - ox, o.z - oz);
  if (moved > 0.004) sfxDrag(Math.min(1, moved * 25), o.weight);          // scraping along the floor
});

const endPress = (e) => {
  if (drag && drag.obj && !drag.ball) sfx('place', drag.obj.weight === 'heavy' ? 0.8 : drag.obj.weight === 'medium' ? 0.5 : 0.3);   // set down
  if (pending) {
    clearTimeout(pending.timer);
    // let go of a held rug without moving it: open its menu
    if (pending.armed && e && e.type === 'pointerup') openMenu(pending.hit, pending.x, pending.y);
  }
  controls.enabled = true;
  pending = null;
  drag = null;
  canvas.style.cursor = '';
};
canvas.addEventListener('pointerup', (e) => {
  if (machinePress && Math.hypot(e.clientX - machinePress.x, e.clientY - machinePress.y) < 8 && performance.now() - machinePress.t < 600) machineUI.open();
  machinePress = null;
});
canvas.addEventListener('pointerup', endPress);
canvas.addEventListener('pointercancel', endPress);

window.__ui = { controlsEnabled: () => controls.enabled, pick, floorAt, get pending() { return pending; }, get drag() { return drag; } };

// Debug helper: fast-forward the simulation without rendering (window.sim(seconds)).
window.sim = (sec, dt = 1 / 30) => {
  for (let t = 0; t < sec; t += dt) {
    brain.safeUpdate(dt); guy.apply(dt); brain.safeLate(); world.lamp.tick(brain.currentBeat()); updateBall(dt); for (const o of Object.values(world.objects)) o.update(dt);
  }
  if (follow) { controls.target.copy(guy.pos).setY(1.1); controls.update(); }
};

const clock = new THREE.Clock();
const camGoal = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  if (window.__qaPaused) return;                    // QA pictures: nothing moves or draws by itself while one is being set up (qa-shots.js)
  const dt = Math.min(clock.getDelta(), 0.05);
  if (guy.loaded) {
    brain.safeUpdate(dt);
    guy.apply(dt);
    brain.safeLate();
  }
  space.rotation.y += dt * 0.004;
  space.position.copy(camera.position);
  world.lamp.tick(brain.currentBeat());
  world.skillMachine.userData.update(performance.now() / 1000);
  for (const o of Object.values(world.objects)) o.update(dt);
  updateBall(dt);
  if (follow && guy.loaded) {
    camGoal.copy(guy.pos).setY(1.1);
    controls.target.lerp(camGoal, 0.05);
  }
  if (!screenLock.cameraOk()) controls.enabled = false;      // 'on' freezes the camera too
  controls.update();
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fitRoom();
});

// ---- fullscreen ----
const fsBtn = document.getElementById('fs-btn');
const fsEl = document.documentElement;
const inFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function enterFs() {
  const req = fsEl.requestFullscreen || fsEl.webkitRequestFullscreen;
  if (req && !inFs()) { try { Promise.resolve(req.call(fsEl)).catch(() => {}); } catch { /* not allowed here */ } }
}
function toggleFs() {
  if (inFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else enterFs();
}
if (!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen)) fsBtn.hidden = true;
fsBtn.addEventListener('click', toggleFs);
document.addEventListener('fullscreenchange', () => fsBtn.classList.toggle('on', inFs()));
window.__enterFs = enterFs;
