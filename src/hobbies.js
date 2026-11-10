// Helpers for the drum kit, easel and telescope: drum patterns, painting plans and the props GUY holds.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------------------------------------------
// Drums. Pads (see room.js buildDrums): snare, hat, tom1, tom2, floor, crash, ride, kick (foot).
// A hit is { k: pad, h: 'L' | 'R' | 'F' (foot), v: loudness }. Pads on the drummer's left (x < 0) are played by the left hand.
// ---------------------------------------------------------------------------------------------------------------
export const DRUM_STYLE_BY_TRACK = {
  default: 'rock', happy: 'rock', classical: 'march', country: 'soft', blues: 'rock', lullaby: 'soft',
  rock: 'rock', hiphop: 'boombap', twostep: 'train', pop: 'disco', jazz: 'swing', slowblues: 'soft', party: 'disco',
};
// every style drumStep knows (the QA sweep plays each one)
export const DRUM_STYLES = ['rock', 'soft', 'march', 'boombap', 'train', 'disco', 'swing', 'solo', 'reggae', 'funk', 'paradiddle', 'solo2', 'solo3'];
export const PAD_SIDE = { snare: 'C', hat: 'L', crash: 'L', tom1: 'L', tom2: 'R', floor: 'R', ride: 'R' };

// what is played on eighth-note `n` (8 per bar) in a style
// `opts` (drums.band chapters, only for drumming along with the stereo): { fills } a tom fill at the end of every fourth bar,
// { sections } the second half of every sixteen bars is the chorus: ride cymbal and a crash where it starts
export function drumStep(style, n, opts = null) {
  const hits = baseStep(style, n);
  if (!opts) return hits;
  const bar = Math.floor(n / 8), i = n % 8;
  if (opts.sections) {
    const chorus = bar % 16 >= 8;
    if (chorus) {
      for (const h of hits) { if (h.k === 'hat') { h.k = 'ride'; h.h = 'R'; } h.v = Math.min(1, h.v * 1.15); }
      if (bar % 16 === 8 && i === 0) hits.push({ k: 'crash', h: 'L', v: 0.95 });
    }
  }
  if (opts.fills && bar % 4 === 3 && i >= 4) {
    hits.length = 0;
    const fill = [['tom1', 'L'], ['tom2', 'R'], ['floor', 'L'], ['floor', 'R']][i - 4];
    hits.push({ k: fill[0], h: fill[1], v: 0.75 + (i - 4) * 0.07 });
    if (i === 7) hits.push({ k: 'crash', h: 'R', v: 0.9 });
  }
  return hits;
}

function baseStep(style, n) {
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
  } else if (style === 'boombap') {                             // hip-hop: kick-heavy, hard snare on 2 and 4
    hits.push({ k: 'hat', h: 'L', v: i % 2 ? 0.4 : 0.6 });
    if (i === 0 || i === 3 || (i === 5 && bar % 2)) hits.push({ k: 'kick', h: 'F', v: 0.95 });
    if (i === 2 || i === 6) hits.push({ k: 'snare', h: 'R', v: 0.9 });
  } else if (style === 'train') {                               // country train beat: the snare chugs on every eighth
    hits.push({ k: 'snare', h: i % 2 ? 'L' : 'R', v: i === 2 || i === 6 ? 0.7 : 0.35 });
    if (i === 0 || i === 4) hits.push({ k: 'kick', h: 'F', v: 0.6 });
  } else if (style === 'disco') {                               // pop / party: four on the floor, off-beat hats
    if (i % 2 === 1) hits.push({ k: 'hat', h: 'L', v: 0.7 });
    if (i % 2 === 0) hits.push({ k: 'kick', h: 'F', v: 0.9 });
    if (i === 2 || i === 6) hits.push({ k: 'snare', h: 'R', v: 0.85 });
  } else if (style === 'swing') {                               // jazz: ride cymbal pattern, feathered kick, ghost snare
    if ([0, 2, 3, 4, 6, 7].includes(i)) hits.push({ k: 'ride', h: 'R', v: i === 3 || i === 7 ? 0.35 : 0.5 });
    if (i === 2 || i === 6) hits.push({ k: 'hat', h: 'L', v: 0.4 });
    if (i === 0 && bar % 2 === 0) hits.push({ k: 'kick', h: 'F', v: 0.35 });
    if (i === 5 && bar % 2) hits.push({ k: 'snare', h: 'L', v: 0.3 });
  } else if (style === 'reggae') {                               // one-drop: nothing on beat 1, kick and snare together on beat 3, hat on the off-beats
    if (i % 2 === 1) hits.push({ k: 'hat', h: 'L', v: 0.55 });
    if (i === 4) { hits.push({ k: 'kick', h: 'F', v: 0.85 }); hits.push({ k: 'snare', h: 'R', v: 0.6 }); }
  } else if (style === 'funk') {                                 // a syncopated kick, ghosted snare, busy hat
    hits.push({ k: 'hat', h: 'L', v: i % 2 ? 0.35 : 0.65 });
    if (i === 0 || i === 3 || (i === 5 && bar % 2) || (i === 7 && bar % 4 === 3)) hits.push({ k: 'kick', h: 'F', v: 0.9 });
    if (i === 2 || i === 6) hits.push({ k: 'snare', h: 'R', v: 0.9 });
    else if (i === 5 || (i === 1 && bar % 2)) hits.push({ k: 'snare', h: 'R', v: 0.25 });
  } else if (style === 'paradiddle') {                           // RLRR LRLL on the snare, drifting over to the toms on every second bar
    const sticking = 'RLRRLRLL'[i], onToms = bar % 4 >= 2;
    const pad = onToms ? ['tom1', 'tom1', 'tom2', 'tom2', 'tom1', 'tom1', 'tom2', 'floor'][i] : 'snare';
    hits.push({ k: pad, h: onToms ? handFor(pad) : sticking, v: (i === 0 || i === 4) ? 0.85 : 0.55 });
    if (i === 0 || i === 4) hits.push({ k: 'kick', h: 'F', v: 0.8 });
  } else if (style === 'solo3') {                                // drums.solo ch3: crossovers, flams, and a rapid-fire roll to finish
    const phase = bar % 8;
    if (phase < 2) {                                             // crossover: the right hand reaches over to the floor tom while the left keeps the hat
      hits.push({ k: 'hat', h: 'L', v: i % 2 ? 0.45 : 0.7 });
      if (i % 2 === 0) hits.push({ k: 'floor', h: 'R', v: 0.7 });
      if (i === 0 || i === 4) hits.push({ k: 'kick', h: 'F', v: 0.9 });
    } else if (phase === 2 || phase === 5) {                     // flams: both sticks land almost together
      if (i % 2 === 0) { const pad = ['snare', 'tom1', 'tom2', 'floor'][(i / 2) % 4]; hits.push({ k: pad, h: 'L', v: 0.45 }); hits.push({ k: pad, h: 'R', v: 0.9 }); }
      if (i === 0) hits.push({ k: 'kick', h: 'F', v: 0.9 });
    } else if (phase === 3 || phase === 6) {                     // a run of alternating sticks round all four drums
      hits.push({ k: ['tom1', 'tom1', 'tom2', 'tom2', 'floor', 'floor', 'snare', 'snare'][i], h: i % 2 ? 'L' : 'R', v: 0.6 + (i % 4) * 0.08 });
      if (i === 7) hits.push({ k: 'crash', h: 'L', v: 0.9 });
    } else if (phase === 7) {                                    // the finish: fast snare roll that gets louder, crash on the last
      hits.push({ k: 'snare', h: i % 2 ? 'L' : 'R', v: 0.45 + i * 0.07 });
      if (i === 7) { hits.push({ k: 'crash', h: 'L', v: 1 }); hits.push({ k: 'kick', h: 'F', v: 1 }); }
    } else {
      hits.push({ k: 'ride', h: 'R', v: i % 2 ? 0.45 : 0.65 });
      if (i === 0 || i === 4) hits.push({ k: 'kick', h: 'F', v: 0.85 });
      if (i === 2 || i === 6) hits.push({ k: 'snare', h: 'L', v: 0.8 });
    }
  } else if (style === 'solo2') {                                // a longer solo: grooves, a tom cascade, a snare roll, then a crash
    const phase = bar % 8;
    if (phase < 2) groove();
    else if (phase === 2) {                                      // cascade down the toms
      const seq = [['tom1', 'L'], ['tom1', 'R'], ['tom2', 'L'], ['tom2', 'R'], ['floor', 'L'], ['floor', 'R'], ['floor', 'R'], ['crash', 'L']][i];
      hits.push({ k: seq[0], h: seq[1], v: 0.7 + i * 0.04 });
      if (i === 7) hits.push({ k: 'kick', h: 'F', v: 1 });
    } else if (phase === 3 || phase === 6) {                     // a roll that grows louder
      hits.push({ k: 'snare', h: i % 2 ? 'L' : 'R', v: 0.4 + i * 0.07 });
      if (i === 7) hits.push({ k: 'crash', h: 'L', v: 0.95 });
    } else if (phase === 7) {                                    // the big finish: the kick and the crash together on every beat
      if (i % 2 === 0) { hits.push({ k: 'kick', h: 'F', v: 1 }); hits.push({ k: 'crash', h: 'L', v: 0.9 }); }
      else hits.push({ k: 'snare', h: 'R', v: 0.8 });
    } else {                                                     // free playing round the kit
      const pad = pick(['tom1', 'tom2', 'floor', 'snare', 'ride', 'hat']);
      hits.push({ k: pad, h: handFor(pad), v: rand(0.6, 0.95) });
      if (i % 4 === 0) hits.push({ k: 'kick', h: 'F', v: 0.9 });
    }
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

export function paintPlan(kind, dirty, subjectIn = null) {
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
    const subject = subjectIn || pick(['landscape', 'face', 'still life']);
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
    } else if (subject === 'seascape') {                                // easel.portrait ch2: sky, sun low over the sea, waves, a little boat
      for (let k = 0; k < 3; k++) add(stroke(k ? '#8fc3f0' : '#5aa0e8', [[0.04, 0.06 + k * 0.1], [0.96, 0.08 + k * 0.1]], 34, 0.8));
      add(stroke('#f2c500', ellipse(0.7, 0.36, 0.08, 0.06, 12), 16, 1.0));
      for (let k = 0; k < 4; k++) add(stroke(k % 2 ? '#2a62d8' : '#1d4aa8', [[0.04, 0.5 + k * 0.1], [0.3, 0.46 + k * 0.1], [0.55, 0.52 + k * 0.1], [0.96, 0.47 + k * 0.1]], 30, 1.2));
      add(stroke('#4a2f1b', [[0.28, 0.58], [0.46, 0.58], [0.42, 0.64], [0.32, 0.64], [0.28, 0.58]], 10, 0.9));
      add(stroke('#f6f3ea', [[0.37, 0.57], [0.37, 0.4], [0.45, 0.55]], 10, 0.9));
    } else if (subject === 'skyline') {                                 // a row of tall buildings with lit windows under a pink sky
      for (let k = 0; k < 4; k++) add(stroke('#f2a6c0', [[0.04, 0.08 + k * 0.1], [0.96, 0.08 + k * 0.1]], 34, 0.7));
      const bl = [[0.06, 0.5, '#3b3f4a'], [0.24, 0.35, '#4a4f5c'], [0.42, 0.55, '#2e323c'], [0.6, 0.28, '#4a4f5c'], [0.78, 0.45, '#3b3f4a']];
      for (const [x, top, c] of bl) { for (let k = 0; k < 4; k++) add(stroke(c, [[x, top + k * ((0.9 - top) / 4)], [x + 0.14, top + k * ((0.9 - top) / 4)]], 34, 0.5)); }
      add(stroke('#f2c500', [[0.1, 0.62], [0.12, 0.62]], 8, 0.3)); add(stroke('#f2c500', [[0.28, 0.5], [0.3, 0.5]], 8, 0.3));
      add(stroke('#f2c500', [[0.64, 0.45], [0.66, 0.45]], 8, 0.3)); add(stroke('#f2c500', [[0.82, 0.62], [0.84, 0.62]], 8, 0.3));
    } else if (subject === 'night sky') {                               // easel.portrait ch3: a dark blue sky, a crescent moon, stars, a hill
      for (let k = 0; k < 6; k++) add(stroke(k < 3 ? '#14234d' : '#1e3270', [[0.04, 0.05 + k * 0.13], [0.96, 0.06 + k * 0.13]], 40, 0.6));
      add(stroke('#f6f3ea', ellipse(0.72, 0.24, 0.09, 0.09, 12, Math.PI * 0.55, Math.PI * 1.6), 14, 1.0));
      for (const [x, y] of [[0.2, 0.15], [0.35, 0.3], [0.5, 0.12], [0.6, 0.35], [0.88, 0.1], [0.12, 0.38]]) add(stroke('#f2c500', [[x, y], [x + 0.012, y + 0.012]], 9, 0.3));
      add(stroke('#1a1f2b', [[0.04, 0.9], [0.3, 0.7], [0.6, 0.8], [0.96, 0.66]], 44, 1.4));
    } else if (subject === 'robot') {                                   // a square-headed robot with an antenna
      for (let k = 0; k < 6; k++) add(stroke('#b9c4d0', [[0.3, 0.3 + k * 0.08], [0.7, 0.3 + k * 0.08]], 28, 0.6));
      add(stroke('#4a5568', [[0.3, 0.28], [0.7, 0.28], [0.7, 0.74], [0.3, 0.74], [0.3, 0.28]], 12, 1.4));
      add(stroke('#4a5568', [[0.5, 0.28], [0.5, 0.14]], 8, 0.5)); add(stroke('#d0312d', [[0.5, 0.12], [0.505, 0.12]], 16, 0.4));
      add(stroke('#2a62d8', ellipse(0.4, 0.42, 0.04, 0.04, 8), 14, 0.5)); add(stroke('#2a62d8', ellipse(0.6, 0.42, 0.04, 0.04, 8), 14, 0.5));
      add(stroke('#222222', [[0.4, 0.6], [0.45, 0.62], [0.5, 0.6], [0.55, 0.62], [0.6, 0.6]], 8, 0.7));
    } else {
      add(stroke('#4a2f1b', [[0.05, 0.82], [0.95, 0.82]], 14, 1.0));
      for (let k = 0; k < 3; k++) add(stroke('#a4552f', [[0.36 + k * 0.01, 0.6 + k * 0.07], [0.64 - k * 0.01, 0.6 + k * 0.07]], 18, 0.8));
      add(stroke('#2e9e4a', [[0.5, 0.58], [0.4, 0.38], [0.3, 0.3]], 12, 0.9));
      add(stroke('#2e9e4a', [[0.5, 0.58], [0.6, 0.36], [0.72, 0.28]], 12, 0.9));
      add(stroke('#237a38', [[0.5, 0.58], [0.5, 0.3]], 12, 0.8));
    }
  } else if (kind === 'dabs') {                                         // easel ch2: short dabs of colour, dotted over the canvas
    const cols = [pick(PAINT_COLORS), pick(PAINT_COLORS), pick(PAINT_COLORS), pick(PAINT_COLORS)];
    for (let k = 0; k < 14; k++) {
      const x = rand(0.1, 0.9), y = rand(0.1, 0.9);
      add(stroke(cols[k % 4], [[x, y], [x + 0.015, y + 0.012]], 26, 0.45));
    }
  } else if (kind === 'bands') {                                        // easel ch2: broad bands of colour laid on side by side
    const cols = [pick(PAINT_COLORS), pick(PAINT_COLORS), pick(PAINT_COLORS)];
    for (let k = 0; k < 4; k++) add(stroke(cols[k % 3], [[0.06, 0.12 + k * 0.22], [0.5, 0.1 + k * 0.22 + rand(-0.03, 0.03)], [0.94, 0.12 + k * 0.22]], 44, 1.3));
  } else if (kind === 'spiral') {                                       // easel ch3: a big swirl from the middle outwards
    const col = [pick(PAINT_COLORS), pick(PAINT_COLORS)];
    for (let r = 0; r < 2; r++) add(stroke(col[r], Array.from({ length: 28 }, (_, i) => { const a = i * 0.45 + r * Math.PI, rad = 0.02 + i * 0.014; return [0.5 + Math.cos(a) * rad * 1.4, 0.5 + Math.sin(a) * rad]; }), 12, 2.2));
  } else if (kind === 'splash') {                                       // easel ch3: rays flung out from one point
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + rand(-0.2, 0.2), r = rand(0.25, 0.42); add(stroke(pick(PAINT_COLORS), [[0.5 + Math.cos(a) * 0.04, 0.5 + Math.sin(a) * 0.04], [0.5 + Math.cos(a) * r * 1.3, 0.5 + Math.sin(a) * r]], 12, 0.6)); }
  } else if (kind === 'gradient') {                                     // easel.colour ch2: pairs of paints blended in steps from one to the other
    for (let row = 0; row < 3; row++) {
      const a = pick(PAINT_COLORS), b = pick(PAINT_COLORS), y = 0.2 + row * 0.28;
      for (let step = 0; step < 4; step++) {
        const k = step / 3, color = mixHex(a, b, k);
        segs.push({ type: 'dip', color: a, dur: 0.5 }, { type: 'mix', color, from: a, to: b, dur: 1.0 });
        last = color;
        segs.push(stroke(color, [[0.08 + step * 0.22, y], [0.26 + step * 0.22, y + 0.02]], 34, 0.7));
      }
    }
  } else if (kind === 'tints') {                                        // easel.colour ch3: one colour lightened with white and darkened with black
    for (let row = 0; row < 3; row++) {
      const a = pick(PAINT_COLORS), y = 0.2 + row * 0.28;
      for (let step = 0; step < 4; step++) {
        const color = step < 2 ? mixHex(a, '#ffffff', 0.55 - step * 0.35) : mixHex(a, '#101010', (step - 1) * 0.3);
        segs.push({ type: 'dip', color: a, dur: 0.5 }, { type: 'mix', color, from: a, to: step < 2 ? '#ffffff' : '#101010', dur: 1.0 });
        last = color;
        segs.push(stroke(color, [[0.08 + step * 0.22, y], [0.26 + step * 0.22, y + 0.02]], 34, 0.7));
      }
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
// Props held in GUY's hands (positioned from the hand bones every frame by Brain.late)
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
