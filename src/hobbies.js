// Helpers for the drum kit, easel and telescope: drum patterns, painting plans and the props Guy holds.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------------------------------------------
// Drums. Pads (see room.js buildDrums): snare, hat, tom1, tom2, floor, crash, ride, kick (foot).
// A hit is { k: pad, h: 'L' | 'R' | 'F' (foot), v: loudness }. Pads on the drummer's left (x < 0) are played by the left hand.
// ---------------------------------------------------------------------------------------------------------------
export const DRUM_STYLE_BY_TRACK = { default: 'rock', happy: 'rock', classical: 'march', country: 'soft', blues: 'rock', lullaby: 'soft' };
export const PAD_SIDE = { snare: 'C', hat: 'L', crash: 'L', tom1: 'L', tom2: 'R', floor: 'R', ride: 'R' };

// what is played on eighth-note `n` (8 per bar) in a style
export function drumStep(style, n) {
  const bar = Math.floor(n / 8), i = n % 8, hits = [];
  const groove = () => {
    hits.push({ k: 'hat', h: 'L', v: i % 2 ? 0.45 : 0.7 });
    if (i === 0 || i === 4 || (i === 3 && bar % 2)) hits.push({ k: 'kick', h: 'F', v: 0.9 });
    if (i === 2 || i === 6) hits.push({ k: 'snare', h: 'R', v: 0.85 });
  };
  if (style === 'rock') groove();
  else if (style === 'soft') {
    if (i === 0 || i === 4) hits.push({ k: 'ride', h: 'R', v: 0.5 });
    if (i === 2 || i === 6) hits.push({ k: 'snare', h: 'L', v: 0.35 });
    if (i === 0) hits.push({ k: 'kick', h: 'F', v: 0.5 });
  } else if (style === 'march') {
    hits.push({ k: 'snare', h: i % 2 ? 'R' : 'L', v: i % 2 ? 0.4 : 0.6 });
    if (i === 0 || i === 4) hits.push({ k: 'kick', h: 'F', v: 0.8 });
  } else if (style === 'solo') {
    const phase = bar % 6;
    if (phase < 2) groove();
    else if (phase === 2 || phase === 5) {                      // a fill round the kit, ending on the crash
      const seq = [['snare', 'R'], ['snare', 'L'], ['tom1', 'L'], ['tom1', 'R'], ['tom2', 'R'], ['floor', 'R'], ['floor', 'R'], ['crash', 'L']][i];
      hits.push({ k: seq[0], h: seq[1], v: 0.85 });
      if (i === 7) hits.push({ k: 'kick', h: 'F', v: 1 });
    } else {                                                    // free playing on the toms and snare
      const pad = pick(['tom1', 'tom2', 'floor', 'snare', 'snare', 'hat']);
      hits.push({ k: pad, h: handFor(pad), v: rand(0.6, 0.95) });
      if (i % 4 === 0) hits.push({ k: 'kick', h: 'F', v: 0.9 });
    }
  }
  return hits;
}

// which hand plays a pad
export function handFor(pad) {
  const side = PAD_SIDE[pad];
  return side === 'L' ? 'L' : side === 'R' ? 'R' : pick(['L', 'R']);
}

// ---------------------------------------------------------------------------------------------------------------
// Painting. A plan is a list of segments played one after another:
//   prime (a white wash over an old painting), dip (brush to the palette), mix (swirl on the palette, colour changes),
//   stroke (paint along a polyline), admire (step back).  Canvas coordinates u, v are 0..1.
// ---------------------------------------------------------------------------------------------------------------
export const PAINT_COLORS = ['#d0312d', '#2a62d8', '#f2c500', '#2e9e4a', '#8e44ad', '#e67e22', '#4a2f1b', '#222222'];

const mixHex = (a, b, k) => {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return '#' + ca.lerp(cb, k).getHexString();
};
const ellipse = (cx, cy, rx, ry, n = 14, start = 0, end = Math.PI * 2) => Array.from({ length: n + 1 }, (_, k) => {
  const a = start + ((end - start) * k) / n;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const stroke = (color, pts, width = 6, dur = null) => ({ type: 'stroke', color, pts, width, dur: dur ?? Math.max(0.7, len(pts) * 3.2) });

export function paintPlan(kind, dirty) {
  const segs = [];
  let last = null;
  const dip = (color) => { if (color !== last) { segs.push({ type: 'dip', color, dur: 0.9 }); last = color; } };
  const add = (s) => { if (s.type === 'stroke' && kind !== 'scribble') dip(s.color); segs.push(s); };
  if (dirty) for (let k = 0; k < 4; k++) segs.push({ ...stroke('#f6f3ea', k % 2 ? [[0.95, 0.1 + k * 0.25], [0.05, 0.1 + k * 0.25]] : [[0.05, 0.1 + k * 0.25], [0.95, 0.1 + k * 0.25]], 90, 0.8), wash: true });

  if (kind === 'scribble') {                                           // no lessons: a finger and a grey smudge
    for (let k = 0; k < 4; k++) {
      const y = rand(0.2, 0.8), x = rand(0.2, 0.6);
      add(stroke('#777777', [[x, y], [x + 0.15, y + 0.08], [x + 0.05, y + 0.14], [x + 0.25, y + 0.2]], 3, 0.9));
    }
  } else if (kind === 'basic') {                                       // first strokes: bold lines in a few colours
    const cols = [pick(PAINT_COLORS), pick(PAINT_COLORS), pick(PAINT_COLORS)];
    for (let k = 0; k < 5; k++) {
      const y = 0.15 + k * 0.17;
      add(stroke(cols[k % 3], [[rand(0.1, 0.25), y], [rand(0.4, 0.6), y + rand(-0.08, 0.08)], [rand(0.75, 0.9), y + rand(-0.06, 0.1)]], 9));
    }
  } else if (kind === 'mix') {                                         // mix two paints on the palette, then use the mixture
    for (let k = 0; k < 5; k++) {
      const a = pick(PAINT_COLORS), b = pick(PAINT_COLORS), color = mixHex(a, b, rand(0.3, 0.7));
      segs.push({ type: 'dip', color: a, dur: 0.7 }, { type: 'mix', color, from: a, to: b, dur: 1.3 });
      last = color;
      const cx = rand(0.2, 0.8), cy = 0.15 + k * 0.17;
      segs.push(stroke(color, ellipse(cx, cy, 0.14, 0.05, 8, 0, Math.PI * 1.6), 14));
    }
  } else if (kind === 'portrait') {
    const subject = pick(['landscape', 'face', 'still life']);
    segs.subject = subject;
    if (subject === 'landscape') {
      for (let k = 0; k < 3; k++) add(stroke('#5aa0e8', [[0.04, 0.08 + k * 0.12], [0.96, 0.1 + k * 0.12]], 40, 0.9));
      add(stroke('#f2c500', ellipse(0.75, 0.2, 0.07, 0.055, 12), 16, 1.1));
      add(stroke('#2e9e4a', [[0.04, 0.62], [0.3, 0.52], [0.55, 0.62], [0.96, 0.5]], 36, 1.4));
      add(stroke('#237a38', [[0.04, 0.82], [0.4, 0.7], [0.96, 0.8]], 40, 1.4));
      add(stroke('#4a2f1b', [[0.25, 0.46], [0.25, 0.74]], 12, 0.8));
      add(stroke('#2e9e4a', ellipse(0.25, 0.4, 0.1, 0.09, 10), 20, 1.0));
    } else if (subject === 'face') {
      for (let k = 0; k < 6; k++) add(stroke('#f0c9a0', [[0.32, 0.25 + k * 0.08], [0.68, 0.25 + k * 0.08]], 26, 0.7));
      add(stroke('#4a2f1b', ellipse(0.5, 0.42, 0.23, 0.26, 14, Math.PI * 1.05, Math.PI * 1.95), 14, 1.2));
      add(stroke('#222222', [[0.4, 0.4], [0.41, 0.4]], 14, 0.5));
      add(stroke('#222222', [[0.6, 0.4], [0.61, 0.4]], 14, 0.5));
      add(stroke('#c97c5d', [[0.5, 0.43], [0.49, 0.5]], 5, 0.5));
      add(stroke('#d0312d', ellipse(0.5, 0.52, 0.09, 0.05, 8, 0.2, Math.PI - 0.2), 8, 0.9));
    } else {
      add(stroke('#4a2f1b', [[0.05, 0.82], [0.95, 0.82]], 14, 1.0));
      for (let k = 0; k < 3; k++) add(stroke('#a4552f', [[0.36 + k * 0.01, 0.6 + k * 0.07], [0.64 - k * 0.01, 0.6 + k * 0.07]], 18, 0.8));
      add(stroke('#2e9e4a', [[0.5, 0.58], [0.4, 0.38], [0.3, 0.3]], 12, 0.9));
      add(stroke('#2e9e4a', [[0.5, 0.58], [0.6, 0.36], [0.72, 0.28]], 12, 0.9));
      add(stroke('#237a38', [[0.5, 0.58], [0.5, 0.3]], 12, 0.8));
    }
  }
  // timeline
  let t = 0;
  for (const s of segs) { s.t0 = t; t += s.dur; }
  const admire = kind === 'scribble' ? 0 : kind === 'portrait' ? 3.2 : 1.8;
  const plan = { segs, painting: t, admireStart: t, admire, total: t + admire + 0.6, kind, subject: segs.subject };
  return plan;
}

// point along a polyline at fraction f (0..1) by arc length
export function polyPoint(pts, f) {
  if (pts.length === 1) return pts[0];
  const total = len(pts);
  let d = f * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) { const k = seg ? Math.min(1, d / seg) : 1; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; }
    d -= seg;
  }
  return pts[pts.length - 1];
}
export const mixColors = mixHex;

// ---------------------------------------------------------------------------------------------------------------
// Props held in Guy's hands (positioned from the hand bones every frame by Brain.late)
// ---------------------------------------------------------------------------------------------------------------
export function makeStick() {
  const g = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xd9b27c, roughness: 0.6 }));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8c997, roughness: 0.6 }));
  tip.position.y = 0.2;
  wood.castShadow = true;
  g.add(wood, tip);
  g.visible = false;
  return g;
}

export function makeBrush() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.005, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.5 }));
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0xbfc3c8, metalness: 0.8, roughness: 0.3 }));
  ferrule.position.y = 0.115;
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xd0312d, roughness: 0.8 });
  const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.035, 8), tipMat);
  bristles.position.y = 0.147;
  g.add(handle, ferrule, bristles);
  g.userData.tipMat = tipMat;
  g.visible = false;
  return g;
}

export function makePalette() {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.012, 24), new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.6 }));
  board.scale.set(0.15, 1, 0.1);
  g.add(board);
  [['#d0312d', -0.08, 0.0], ['#2a62d8', -0.03, 0.05], ['#f2c500', 0.03, 0.05], ['#2e9e4a', 0.08, 0.0], ['#ffffff', 0.0, -0.05]].forEach(([c, x, z]) => {
    const dab = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    dab.position.set(x, 0.009, z);
    g.add(dab);
  });
  g.visible = false;
  return g;
}
