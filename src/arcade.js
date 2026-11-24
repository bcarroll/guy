// The game inside the Arcade Cabinet GUY builds (room.js buildArcade): "Robo Blaster", a little shoot-the-meteors game drawn on a 128 x 96
// canvas that is the cabinet's screen. Nobody playing: the attract screen (the title, "insert coin", the colours cycling, as the cabinet
// always did). A robot at the controls (toybrain.js, activity 'arcade'): the game runs with that robot as the pilot, and the robot's hands
// follow what the pilot does (`input`: the stick left or right, the fire button). The user can watch it on the cabinet, or in the big
// view main.js opens (it copies this canvas): the 'guy-arcade' window event says when a game starts and stops.
//
// Everything moves with the game's own clock (update(dt)), never the wall clock, so the QA's fast-forward (window.sim) plays it too.

export const W = 128, H = 96;
const STEP = 1 / 30;                       // the game's own tick
const LIVES = 3;
const COLS = [0x35f2a0, 0x35a0f2, 0xf2d035];    // the attract screen's colours (the cabinet's screen used to cycle through these)
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// a small seeded generator, so a game is the same every time for the same seed (the QA pictures and checks)
const rng = (seed) => { let a = seed | 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) | 0; return (a >>> 0) / 4294967296; }; };

let hiLoaded = false, hiScore = 0;
const HI_KEY = 'guy.arcade.v1';
function loadHi() {
  if (hiLoaded) return; hiLoaded = true;
  try { const v = JSON.parse(localStorage.getItem(HI_KEY) || 'null'); if (v && typeof v.hi === 'number') hiScore = v.hi; } catch { /* no storage: the high score lives for this visit */ }
}
function saveHi() { try { localStorage.setItem(HI_KEY, JSON.stringify({ hi: hiScore })); } catch { /* no storage */ } }

export function makeArcadeGame(canvas) {
  const ctx = canvas.getContext('2d');
  loadHi();
  const g = {
    canvas, mode: 'attract', who: null, score: 0, lives: LIVES, level: 1, hi: hiScore, newHi: false, played: 0,
    ship: { x: W / 2 }, shots: [], rocks: [], sparks: [], stars: [],
    input: { x: 0, fire: false },          // what the pilot is doing: -1 left, 1 right; the fire button down
    t: 0, acc: 0, drawAcc: 9, dirty: true, overT: 0, rand: rng(7), aim: null, react: 0,
    shotsFired: 0, hits: 0,
  };
  for (let i = 0; i < 24; i++) g.stars.push({ x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H), s: 0.2 + Math.random() * 0.6 });

  // A robot puts a coin in and starts a game. `skill` (0..1) is how good its pilot is (better the more it plays).
  g.start = (who = 'GUY', { seed = 0, skill = 0.6 } = {}) => {
    Object.assign(g, { mode: 'play', who, score: 0, lives: LIVES, level: 1, newHi: false, shots: [], rocks: [], sparks: [], t: 0, overT: 0, aim: null, react: 0, shotsFired: 0, hits: 0 });
    g.ship.x = W / 2; g.input = { x: 0, fire: false };
    g.rand = rng(seed || ((Math.random() * 1e9) | 0));
    g.skill = Math.max(0.15, Math.min(0.95, skill));
    g.played++;
    g.dirty = true;
    emit(true);
  };
  // The robot lets go of the controls (the game over, or he was called away): back to the attract screen.
  g.stop = () => {
    if (g.mode === 'attract') return;
    g.mode = 'attract'; g.input = { x: 0, fire: false }; g.dirty = true;
    emit(false);
  };
  g.over = () => g.mode === 'over';
  g.playing = () => g.mode === 'play' || g.mode === 'over';

  const emit = (playing) => {
    if (typeof window === 'undefined' || !window.dispatchEvent) return;
    try { window.dispatchEvent(new CustomEvent('guy-arcade', { detail: { playing, who: g.who, game: g } })); } catch { /* old browsers */ }
  };

  // ---- the game itself
  const spawn = () => {
    const r = g.rand;
    const size = r() < 0.25 ? 3 : 2;
    g.rocks.push({ x: 8 + r() * (W - 16), y: -6, vy: 9 + g.level * 2.2 + r() * 5, vx: (r() - 0.5) * 6, size, spin: r() * 6 });
  };
  // the robot's pilot: goes for the lowest meteor it can catch, shoots when it is underneath. Its hands (toybrain.js) follow `input`.
  const pilot = () => {
    const r = g.rand, ship = g.ship;
    g.react -= STEP;
    if (g.react <= 0) {                                       // (it looks again every so often: a better pilot looks more often)
      g.react = 0.12 + (1 - g.skill) * 0.35;
      const targets = g.rocks.filter((k) => k.y > 4 && k.y < 80).sort((a, b) => b.y - a.y);
      g.aim = targets.length ? targets[0] : null;
      g.wobble = (r() - 0.5) * (1 - g.skill) * 26;               // (and aims a little off, more so when it is not very good yet)
    }
    const want = g.aim && g.rocks.includes(g.aim) ? g.aim.x + g.aim.vx * 0.4 + (g.wobble || 0) : W / 2 + Math.sin(g.t * 0.7) * 20;
    const dx = want - ship.x;
    g.input.x = Math.abs(dx) < 2 ? 0 : Math.sign(dx);
    g.input.fire = !!(g.aim && Math.abs(g.aim.x - ship.x) < 6 + g.aim.size * 2 && r() < 0.55 + g.skill * 0.4);
  };
  const tick = () => {
    g.t += STEP;
    for (const s of g.stars) { s.y += s.s * 12 * STEP; if (s.y > H) { s.y = 0; s.x = Math.floor(Math.random() * W); } }
    if (g.mode === 'over') { g.overT += STEP; for (const p of g.sparks) { p.x += p.vx * STEP; p.y += p.vy * STEP; p.life -= STEP; } g.sparks = g.sparks.filter((p) => p.life > 0); return; }
    if (g.mode !== 'play') return;
    pilot();
    const ship = g.ship;
    ship.x = Math.max(6, Math.min(W - 6, ship.x + g.input.x * 70 * STEP));
    g.cool = (g.cool || 0) - STEP;
    if (g.input.fire && g.cool <= 0) { g.shots.push({ x: ship.x, y: H - 14 }); g.cool = 0.28; g.shotsFired++; if (g.onSound) g.onSound('shot'); }
    for (const s of g.shots) s.y -= 120 * STEP;
    g.shots = g.shots.filter((s) => s.y > -4);
    if (g.rand() < STEP * (0.7 + g.level * 0.25)) spawn();
    for (const k of g.rocks) { k.y += k.vy * STEP; k.x += k.vx * STEP; k.spin += STEP * 3; if (k.x < 4 || k.x > W - 4) k.vx = -k.vx; }
    // hits
    for (const k of g.rocks) for (const s of g.shots) {
      if (k.dead || s.dead) continue;
      if (Math.abs(k.x - s.x) < k.size * 2 + 1.5 && Math.abs(k.y - s.y) < k.size * 2 + 2) {
        k.dead = s.dead = true; g.score += k.size === 3 ? 20 : 10; g.hits++;
        for (let i = 0; i < 6; i++) g.sparks.push({ x: k.x, y: k.y, vx: (g.rand() - 0.5) * 60, vy: (g.rand() - 0.5) * 60, life: 0.4 });
        if (g.onSound) g.onSound('hit');
      }
    }
    // a meteor gets past him: a life lost
    for (const k of g.rocks) if (!k.dead && k.y > H - 10) { k.dead = true; g.lives--; for (let i = 0; i < 10; i++) g.sparks.push({ x: k.x, y: H - 10, vx: (g.rand() - 0.5) * 80, vy: -g.rand() * 50, life: 0.5 }); if (g.onSound) g.onSound('lost'); }
    g.rocks = g.rocks.filter((k) => !k.dead); g.shots = g.shots.filter((s) => !s.dead);
    for (const p of g.sparks) { p.x += p.vx * STEP; p.y += p.vy * STEP; p.life -= STEP; }
    g.sparks = g.sparks.filter((p) => p.life > 0);
    g.level = 1 + Math.floor(g.score / 150);
    if (g.lives <= 0) {
      g.mode = 'over'; g.overT = 0; g.input = { x: 0, fire: false };
      if (g.score > g.hi) { g.hi = hiScore = g.score; g.newHi = true; saveHi(); }
      if (g.onSound) g.onSound('over');
    }
  };

  // ---- drawing (a few times a second when nobody plays, every game tick when somebody does)
  const text = (s, x, y, col, size = 8, align = 'center') => { ctx.fillStyle = col; ctx.font = `bold ${size}px monospace`; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(s, x, y); };
  const draw = () => {
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#5a6a8a';
    for (const s of g.stars) ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    if (g.mode === 'attract') {
      const c = hex(COLS[Math.floor(g.t / 0.35) % 3]);
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(3, 3, W - 6, H - 6);
      text('ROBO', W / 2, 18, c, 16); text('BLASTER', W / 2, 36, c, 16);
      if (Math.floor(g.t * 2) % 2 === 0) text('INSERT COIN', W / 2, 64, '#ffffff', 8);
      text(`HI ${String(g.hi).padStart(5, '0')}`, W / 2, 80, '#f2d035', 7);
      return;
    }
    // the meteors
    for (const k of g.rocks) {
      ctx.fillStyle = k.size === 3 ? '#c9874a' : '#a0a6b4';
      const r = k.size * 2;
      ctx.fillRect(Math.round(k.x - r), Math.round(k.y - r + 1), r * 2, r * 2 - 2);
      ctx.fillRect(Math.round(k.x - r + 1), Math.round(k.y - r), r * 2 - 2, r * 2);
      ctx.fillStyle = '#6b5240'; ctx.fillRect(Math.round(k.x - 1 + Math.sin(k.spin)), Math.round(k.y - 1), 2, 2);
    }
    ctx.fillStyle = '#ffe95a';
    for (const s of g.shots) ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 4);
    for (const p of g.sparks) { ctx.fillStyle = p.life > 0.2 ? '#ffd23f' : '#ff6a3a'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    // his ship (a little robot head with a cannon)
    if (g.mode === 'play' || Math.floor(g.overT * 4) % 2 === 0) {
      const x = Math.round(g.ship.x), y = H - 12;
      ctx.fillStyle = g.who === 'GAL' ? '#ff7ac8' : '#5ad1ff';
      ctx.fillRect(x - 5, y + 2, 11, 6); ctx.fillRect(x - 1, y - 2, 3, 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y + 4, 2, 2); ctx.fillRect(x + 2, y + 4, 2, 2);
    }
    ctx.fillStyle = '#2b2f6b'; ctx.fillRect(0, H - 3, W, 3);
    text(`${g.who || 'GUY'} ${String(g.score).padStart(5, '0')}`, 3, 2, '#ffffff', 7, 'left');
    text(`HI ${String(g.hi).padStart(5, '0')}`, W - 3, 2, '#f2d035', 7, 'right');
    for (let i = 0; i < g.lives; i++) { ctx.fillStyle = '#ff5a6a'; ctx.fillRect(4 + i * 6, 12, 4, 3); }
    if (g.mode === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(10, 30, W - 20, 38);
      text('GAME OVER', W / 2, 34, '#ff5a6a', 12);
      text(g.newHi ? 'NEW HIGH SCORE!' : `SCORE ${g.score}`, W / 2, 52, g.newHi ? '#f2d035' : '#ffffff', 8);
    }
  };

  // called every frame with the frame's time
  g.update = (dt) => {
    dt = Math.min(0.25, Math.max(0, dt || 0));
    g.acc += dt;
    let ticked = false;
    while (g.acc >= STEP) { g.acc -= STEP; tick(); ticked = true; }
    if (g.mode === 'attract') { g.drawAcc += dt; if (g.drawAcc >= 0.12 || g.dirty) { g.drawAcc = 0; g.dirty = false; draw(); return true; } return false; }
    if (ticked || g.dirty) { g.dirty = false; draw(); return true; }
    return false;
  };
  g.draw = draw;
  draw();
  return g;
}
