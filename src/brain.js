import * as THREE from 'three';
import { Q } from './guy.js';
import { playNote, playPluck, startBeat, startTrack, trackSeconds, TRACKS, BEAT } from './audio.js';
import { ALBUM_CATALOG } from './albums.js';
import { ROOM } from './room.js';
import { TIMING_SKILLS } from './skills.js';
import { randomSong, makeJam, plinkSong } from './songs.js';
import { installHobbies } from './hobbybrain.js';
import { installWorkshop } from './workbrain.js';
import { installRestaurant, REST_OBJECTS, REST_JOBS } from './restbrain.js';
import { installApproach } from './approach.js';
import { installPaintings } from './paintbrain.js';

const REST_ACTS = ['takepay', 'serve', 'takeorder', 'cook', 'rwait'];
const WORK_ACTS = ['makewood', 'sawwood', 'tap', 'sand', 'tidytools', 'build', 'makemetal', 'cutmetal', 'hammer', 'weld'];
import { RECIPES, PLANKS_PER_RUN, STOCK_CAP, METAL_PER_RUN, METAL_CAP } from './workshop.js';
import { sfx, drag as sfxDrag } from './sfx.js';
import { findBooks, learnBooks } from './learn.js';
import { nextRiff, keepRiff, riffAt, STEPS as RIFF_STEPS } from './riffs.js';
import { makeStrum, strumPattern } from './strum.js';

const PLANT_NAMES = ['plant', 'flowerplant', 'tree'];   // objects Guy can tend with the 'plant' activity
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const smooth = (x) => x * x * (3 - 2 * x);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Fade 0→1→0 over an animation so it blends in/out of the base pose.
const env = (t, dur, f = 0.35) => smooth(clamp(Math.min(t / f, (dur - t) / f), 0, 1));

// ---------------------------------------------------------------------------
// Poses. Each takes (g, t, dur, ctx) and overrides targets on top of the base pose.
// Sign cheat-sheet (model frame): Left arm points +X, Right arm -X; arms down = Left z<0 / Right z>0.
// Rotating about X by +θ swings a hanging limb backward; -θ swings it forward.
// ---------------------------------------------------------------------------
const ARM_DOWN = 1.25;

function basePose(g, t) {
  g.set('LeftArm', Q('z', -ARM_DOWN));
  g.set('RightArm', Q('z', ARM_DOWN));
  g.set('LeftForeArm', Q('y', -0.12));
  g.set('RightForeArm', Q('y', 0.12));
  g.curl('Left', 0.35);
  g.curl('Right', 0.35);
  const br = Math.sin(t * 1.7);
  g.set('Spine2', Q('x', 0.02 + br * 0.015));
  g.set('Head', Q('x', -br * 0.01));
}

const UP = new THREE.Vector3(0, 1, 0);
// Taking something off a shelf: at mid height a handshake grip (thumb up); above the shoulder the fingers point up, so
// the palm faces the shelf instead.
function shelfGrip(g, ctx) {
  const high = ctx.tgt.shelf.y > g.boneWorld('RightArm').y - 0.1;
  const fwd = new THREE.Vector3(Math.sin(g.root.rotation.y), 0, Math.cos(g.root.rotation.y));
  return high ? { palm: fwd } : { side: UP };
}
// How far to squat to reach the shelf target: 0 at shelf height, 1 for a book lying on the floor stack beside it.
const squatFor = (ctx) => clamp((0.85 - ctx.tgt.shelf.y) / 0.5, 0, 1);
const squat = (g, k) => {
  if (k <= 0.001) return;
  for (const side of ['Left', 'Right']) {
    g.set(`${side}UpLeg`, Q('x', -0.75 * k));
    g.set(`${side}Leg`, Q('x', 1.5 * k));
    g.set(`${side}Foot`, Q('x', -0.75 * k));
  }
};
// The chord to strum at a given beat of a track: its own progression, or Am / C for the stereo's built-in beat.
const GUITAR_AM = { notes: [45, 52, 57, 60, 64], fret: 0.0 };
const GUITAR_C = { notes: [48, 52, 55, 60, 64], fret: -0.01 };
function guitarChordAt(trackId, beat) {
  const tr = TRACKS[trackId];
  if (!tr || !tr.jam) return beat % 4 < 2 ? GUITAR_AM : GUITAR_C;
  const bars = tr.jam.bars, bar = ((Math.floor(beat / 4) % bars.length) + bars.length) % bars.length, b = bars[bar];   // beat is briefly negative just after a track starts
  const notes = [b.bass[0] < 40 ? b.bass[0] + 12 : b.bass[0], b.bass[1] < 45 ? b.bass[1] + 12 : b.bass[1], ...b.chord.map((m) => (m > 68 ? m - 12 : m))];
  return { notes: [...new Set(notes)].sort((a, c) => a - c), fret: [0, 0.07, -0.01, 0.1][bar % 4] };
}

const GUITAR_RIGHT_POLE = new THREE.Vector3(-0.4, 0.5, -0.9); // elbow stays up and back so the forearm clears the guitar
const GUITAR_CHORDS = [
  { notes: [45, 52, 57, 60, 64], fret: 0.0 },        // Am
  { notes: [41, 48, 53, 57, 60, 65], fret: 0.07 },   // F
  { notes: [48, 52, 55, 60, 64], fret: -0.01 },      // C
  { notes: [43, 50, 55, 59, 62, 67], fret: 0.1 },    // G
];

function guitarHands(g, ctx, fade) {
  const b = ctx.guitar;
  if (!b) return;
  const handLen = g.limb.Right.handLen;
  // palms face the instrument: the strumming hand looks into the soundboard, the fretting hand wraps the neck from behind
  if (b.wR > 0) {
    g.reachAssist(b.R, Math.min(1, b.wR * fade));
    // taking it off / putting it on the stand he just grips the neck with a straight wrist; the exact strumming hand only once it is on him
    const hand = (b.handBlend ?? 1) > 0.5 ? { hand: { fingers: b.fingersDir, palm: b.axisZ.clone().negate() } } : {};
    g.reach('Right', b.R, b.wR * fade, b.stopR ?? 0, { ...hand, pole: GUITAR_RIGHT_POLE });
    g.curl('Right', 0.2);
  }
  // fretting hand: wrist under the neck, fingers pointing up and curling over it, thumb behind
  if (b.wL > 0) { g.reach('Left', b.L, b.wL * fade, 0, b.wL > 0.9 ? { hand: b.leftHand } : null); g.curl('Left', 0.8); }   // exact hand orientation only once the hand is on the neck (a wrist blended through it bends past 120 degrees)
  g.set('Spine1', Q('x', 0.05));
}

function ballHands(g, ctx, fade) {
  const b = ctx.ball;
  if (!b) return;
  const stop = b.stop ?? g.limb.Right.handLen - 0.05;    // fingers wrap the sides of the ball
  if (b.wR > 0) { g.reachAssist(b.R, Math.min(1, b.wR * fade)); g.reach('Right', b.R, b.wR * fade, stop); g.curl('Right', 0.45); }
  if (b.wL > 0) { g.reach('Left', b.L, b.wL * fade, stop); g.curl('Left', 0.45); }
  g.set('Head', Q('x', b.look || 0));
}

function sitLegs(g, e) {
  g.set('LeftUpLeg', Q('x', -1.4 * e, 'z', -0.08 * e));
  g.set('RightUpLeg', Q('x', -1.4 * e, 'z', 0.08 * e));
  g.set('LeftLeg', Q('x', 1.4 * e));
  g.set('RightLeg', Q('x', 1.4 * e));
  g.set('LeftFoot', Q('x', 0.05 * e));
  g.set('RightFoot', Q('x', 0.05 * e));
}

// 0 -> 1 after `delay` seconds, back to 0 `lead` seconds before the end: when the hands are on the book.
const readWeight = (t, dur, delay, lead) => smooth(clamp((t - delay) / 0.8, 0, 1)) * (1 - smooth(clamp((t - (dur - lead)) / 0.8, 0, 1)));

export const POSES = {
  idle(g, t) {
    g.set('Head', Q('y', Math.sin(t * 0.45) * 0.45, 'x', Math.sin(t * 0.3) * 0.08));
    g.set('Spine1', Q('y', Math.sin(t * 0.45) * 0.1));
    g.hipsOffset.x = Math.sin(t * 0.7) * 0.015;
  },

  walk(g, t, dur, ctx) {
    const ph = ctx.walkPhase;
    const s = Math.sin(ph), c = Math.cos(ph);
    for (const [side, sg] of [['Left', 1], ['Right', -1]]) {
      const p = sg * s; // +1 when this leg is forward-swinging phase
      g.set(`${side}UpLeg`, Q('x', -p * 0.55));
      g.set(`${side}Leg`, Q('x', Math.max(0, sg * c) * 0.8 + Math.max(0, -p) * 0.15));
      g.set(`${side}Foot`, Q('x', p * 0.15));
      const room = ctx.armRoom ?? 1;                       // 1 = open floor, 0 = squeezing past furniture
      const hang = lerp(1.5, ARM_DOWN, room);               // arms hang closer to the body, and swing less, near furniture
      g.set(`${side}Arm`, Q('z', side === 'Left' ? -hang : hang, 'x', p * 0.5 * lerp(0.35, 1, room)));
      g.set(`${side}ForeArm`, Q('y', side === 'Left' ? -0.25 : 0.25, 'z', 0));
    }
    g.set('Hips', Q('y', s * 0.12, 'x', 0.04));
    g.set('Spine1', Q('y', -s * 0.1));
    g.set('Head', Q('y', s * 0.05));
    g.hipsOffset.y = -Math.abs(c) * 0.025;
    if (ctx.haul) {                    // carrying a light piece of furniture: both hands under its sides, held in front of him
      g.set('Spine1', Q('x', 0.06));
      g.reachAssist(ctx.haul.L, 1);
      g.reach('Left', ctx.haul.L, 1);
      g.reach('Right', ctx.haul.R, 1);
    }
    if (ctx.carry && ctx.tgt.pushL) { // pushing furniture: both hands flat on the near face
      g.set('Spine1', Q('x', 0.12 + 0.12 * (ctx.strain || 0)));
      g.reachAssist(ctx.tgt.pushL, 1);
      g.reach('Left', ctx.tgt.pushL, 1);
      g.reach('Right', ctx.tgt.pushR, 1);
      g.set('Head', Q('x', -0.15));
    }
  },

  stretch(g, t, dur) {
    const e = env(t, dur, 0.6);
    const wob = Math.sin(t * 2) * 0.05;
    // Reach overhead but stop just short of vertical (±π/2) so the arms don't cross.
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, 1.3, e) + wob));
    g.set('RightArm', Q('z', lerp(ARM_DOWN, -1.3, e) - wob));
    g.set('Spine1', Q('x', -0.15 * e, 'z', Math.sin(t * 1.3) * 0.2 * e));
    g.set('Head', Q('x', -0.35 * e));
    g.curl('Left', 0.1); g.curl('Right', 0.1);
  },

  wave(g, t, dur) {
    const e = env(t, dur);
    // Upper arm out to the side and a bit forward (never past vertical), forearm up and waggling.
    g.set('RightArm', Q('z', lerp(ARM_DOWN, -0.35, e), 'y', 0.55 * e));
    g.set('RightForeArm', Q('z', -1.0 * e + Math.sin(t * 9) * 0.4 * e));
    g.set('Head', Q('y', -0.3 * e, 'z', 0.1 * e));
    g.curl('Right', 0.1);
  },

  // Reach out to a point (ctx.tgt.reach): a stereo button, a lamp switch, the edge of the bench. Index finger out.
  reach(g, t, dur, ctx) {
    const e = env(t, dur, 0.5);
    const poke = Math.sin(clamp((t - 0.55) / 0.5, 0, 1) * Math.PI);
    const target = ctx.tgt.reach.clone();
    if (ctx.tgt.reachDir) target.addScaledVector(ctx.tgt.reachDir, 0.035 * poke);
    g.reachAssist(target, e);
    g.reach('Right', target, e);
    if (e > 0.2) g.pointFinger('Right');
    g.set('Head', Q('x', 0.12 * e));
  },

  kick(g, t, dur) {
    // wind-up then swing right leg
    const wind = smooth(clamp(t / 0.35, 0, 1));
    const swing = smooth(clamp((t - 0.35) / 0.18, 0, 1));
    const back = smooth(clamp((t - 0.6) / 0.3, 0, 1));
    const a = (wind - swing * 1.0 + back * 1.0);
    g.set('RightUpLeg', Q('x', lerp(0.8 * wind, -1.0, swing) * (1 - back)));
    g.set('RightLeg', Q('x', lerp(1.2 * wind, 0.1, swing) * (1 - back)));
    g.set('LeftArm', Q('z', -ARM_DOWN, 'x', -0.6 * a));
    g.set('RightArm', Q('z', ARM_DOWN, 'x', 0.6 * a));
    g.set('Spine1', Q('x', 0.12 * swing * (1 - back)));
    g.hipsOffset.y = -0.03;
  },

  // ---- Dances (beat-synced; ctx.beat is a continuous beat counter) ----
  disco(g, t, dur, ctx) {
    const e = env(t, dur, 0.5);
    const b = ctx.beat;
    const sw = Math.sin(b * Math.PI / 2); // flips arm every 2 beats
    const bounce = (1 + Math.cos(b * Math.PI * 2)) / 2;
    g.set('RightArm', Q('z', lerp(ARM_DOWN, 0.35 - sw * 1.0, e), 'y', 0.35 * e));
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, -0.35 - sw * 1.0, e), 'y', -0.35 * e));
    g.set('RightForeArm', Q('z', -0.3 * e));
    g.set('LeftForeArm', Q('z', 0.3 * e));
    g.curl('Right', 0.1); g.curl('Left', 0.1);
    g.set('Hips', Q('y', sw * 0.35 * e, 'z', Math.sin(b * Math.PI) * 0.1 * e));
    g.set('Spine1', Q('y', -sw * 0.25 * e, 'z', -Math.sin(b * Math.PI) * 0.08 * e));
    g.set('Head', Q('z', Math.sin(b * Math.PI) * 0.12 * e));
    for (const [side, ph] of [['Left', 0], ['Right', 0.5]]) {
      const k = (1 + Math.cos((b + ph) * Math.PI)) / 2; // alternate knee lifts
      g.set(`${side}UpLeg`, Q('x', -0.25 * e - 0.5 * k * e));
      g.set(`${side}Leg`, Q('x', 0.5 * e + 0.8 * k * e));
      g.set(`${side}Foot`, Q('x', -0.25 * e));
    }
    g.hipsOffset.y = -0.06 * bounce * e;
  },

  // ---- the dance books ----
  twist(g, t, dur, ctx) {
    const e = env(t, dur, 0.5), b = ctx.beat;
    const s = Math.sin(b * Math.PI * 2), c = Math.cos(b * Math.PI * 4);
    g.set('Hips', Q('y', s * 0.55 * e));
    g.set('Spine1', Q('y', -s * 0.45 * e));
    g.set('Head', Q('y', s * 0.2 * e));
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, -0.55, e), 'y', -0.5 * e));
    g.set('RightArm', Q('z', lerp(ARM_DOWN, 0.55, e), 'y', 0.5 * e));
    g.set('LeftForeArm', Q('z', 1.1 * e));
    g.set('RightForeArm', Q('z', -1.1 * e));
    g.curl('Left', 0.5 * e); g.curl('Right', 0.5 * e);
    g.set('LeftUpLeg', Q('x', -0.4 * e, 'z', 0.2 * e));
    g.set('RightUpLeg', Q('x', -0.4 * e, 'z', -0.2 * e));
    g.set('LeftLeg', Q('x', (0.8 + 0.2 * c) * e));
    g.set('RightLeg', Q('x', (0.8 + 0.2 * c) * e));
    g.set('LeftFoot', Q('x', -0.4 * e)); g.set('RightFoot', Q('x', -0.4 * e));
    g.hipsOffset.y = -0.1 * e - 0.03 * c * e;
  },

  shuffle(g, t, dur, ctx) {
    const e = env(t, dur, 0.5), b = ctx.beat;
    const k = Math.sin(b * Math.PI);
    const L = Math.max(0, k), R = Math.max(0, -k);
    g.set('LeftUpLeg', Q('x', (-0.15 - 0.45 * L) * e, 'z', 0.1 * e));
    g.set('RightUpLeg', Q('x', (-0.15 - 0.45 * R) * e, 'z', -0.1 * e));
    g.set('LeftLeg', Q('x', (0.3 + 0.7 * L) * e));
    g.set('RightLeg', Q('x', (0.3 + 0.7 * R) * e));
    g.set('LeftFoot', Q('x', -0.25 * e)); g.set('RightFoot', Q('x', -0.25 * e));
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, -0.45, e), 'x', k * 0.6 * e));
    g.set('RightArm', Q('z', lerp(ARM_DOWN, 0.45, e), 'x', -k * 0.6 * e));
    g.set('LeftForeArm', Q('z', 1.4 * e));
    g.set('RightForeArm', Q('z', -1.4 * e));
    g.curl('Left', 0.8 * e); g.curl('Right', 0.8 * e);
    g.set('Spine1', Q('y', k * 0.2 * e, 'x', 0.08 * e));
    g.set('Head', Q('x', (0.05 + 0.08 * Math.cos(b * Math.PI * 2)) * e));
    g.hipsOffset.x = k * 0.1 * e;
    g.hipsOffset.y = -0.06 * e - 0.03 * Math.cos(b * Math.PI * 2) * e;
  },

  // spinning on the spot: the turn itself comes from the step (fx.spin)
  twirl(g, t, dur, ctx) {
    const e = env(t, dur, 0.5), b = ctx.beat;
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, -0.12, e)));
    g.set('RightArm', Q('z', lerp(ARM_DOWN, 0.12, e)));
    g.curl('Left', 0.1 * e); g.curl('Right', 0.1 * e);
    g.set('Spine1', Q('z', 0.07 * e));
    g.set('Head', Q('x', -0.08 * e));
    for (const side of ['Left', 'Right']) {
      g.set(`${side}UpLeg`, Q('x', -0.15 * e));
      g.set(`${side}Leg`, Q('x', 0.3 * e));
    }
    g.hipsOffset.y = -0.04 * e - 0.025 * Math.cos(b * Math.PI * 2) * e;
  },

  waltz(g, t, dur, ctx) {
    const e = env(t, dur, 0.6), ph = ctx.beat * Math.PI * 4 / 3;       // a three-count: one cycle every 1.5 beats
    const rise = (1 + Math.cos(ph)) / 2;
    // dance hold: left hand out holding a partner's hand, right arm curved round a partner's back
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, -0.5, e), 'y', -0.7 * e));
    g.set('LeftForeArm', Q('z', 0.9 * e));
    g.set('RightArm', Q('z', lerp(ARM_DOWN, 0.8, e), 'y', -0.9 * e));
    g.set('RightForeArm', Q('z', -1.3 * e));
    g.curl('Left', 0.45 * e); g.curl('Right', 0.45 * e);
    g.set('Spine1', Q('y', 0.12 * e, 'x', -0.04 * e, 'z', Math.sin(ph) * 0.06 * e));
    g.set('Head', Q('y', 0.3 * e, 'x', -0.08 * e));
    for (const [side, off] of [['Left', 0], ['Right', Math.PI]]) {
      const k = (1 + Math.cos(ph + off)) / 2;
      g.set(`${side}UpLeg`, Q('x', (-0.12 - 0.3 * k) * e));
      g.set(`${side}Leg`, Q('x', (0.25 + 0.5 * k) * e));
      g.set(`${side}Foot`, Q('x', -0.15 * e));
    }
    g.hipsOffset.y = -0.03 * e - 0.03 * rise * e;
  },

  swing(g, t, dur, ctx) {
    const e = env(t, dur, 0.5), b = ctx.beat;
    const p = Math.sin(b * Math.PI), q = Math.cos(b * Math.PI * 2);
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, -0.7, e), 'x', p * 0.9 * e, 'y', -0.3 * e));
    g.set('RightArm', Q('z', lerp(ARM_DOWN, 0.7, e), 'x', -p * 0.9 * e, 'y', 0.3 * e));
    g.set('LeftForeArm', Q('z', 0.5 * e));
    g.set('RightForeArm', Q('z', -0.5 * e));
    g.curl('Left', 0.2 * e); g.curl('Right', 0.2 * e);
    g.set('Hips', Q('y', p * 0.3 * e, 'z', -p * 0.08 * e));
    g.set('Spine1', Q('y', -p * 0.2 * e));
    g.set('Head', Q('z', p * 0.12 * e));
    const L = Math.max(0, p), R = Math.max(0, -p);                      // rock-step with a little kick on the off beat
    g.set('LeftUpLeg', Q('x', (-0.2 - 0.6 * L) * e));
    g.set('RightUpLeg', Q('x', (-0.2 - 0.6 * R) * e));
    g.set('LeftLeg', Q('x', (0.4 + 0.9 * L) * e));
    g.set('RightLeg', Q('x', (0.4 + 0.9 * R) * e));
    g.set('LeftFoot', Q('x', -0.2 * e)); g.set('RightFoot', Q('x', -0.2 * e));
    g.hipsOffset.y = -0.07 * e - 0.05 * q * e;
  },

  robot(g, t, dur, ctx) {
    const e = env(t, dur, 0.4);
    // Snap to a new angular pose every beat (g.sharp is raised by the dance activity).
    const KEYS = [
      { la: 0, lf: 1.57, ra: 0, rf: -1.57, hy: 0.6 },
      { la: -0.6, lf: -1.57, ra: -0.6, rf: 1.57, hy: -0.6 },
      { la: 1.2, lf: 0, ra: -1.2, rf: 0, hy: 0.0 },
      { la: 0.3, lf: 1.57, ra: -1.6, rf: 0, hy: 0.6 },
      { la: 1.6, lf: 0, ra: 0, rf: -1.57, hy: -0.6 },
    ];
    const i = ((Math.floor(ctx.beat) % KEYS.length) + KEYS.length) % KEYS.length;
    const kf = KEYS[i];
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, kf.la, e)));
    g.set('RightArm', Q('z', lerp(ARM_DOWN, kf.ra, e)));
    g.set('LeftForeArm', Q('z', kf.lf * e));
    g.set('RightForeArm', Q('z', kf.rf * e));
    g.set('Head', Q('y', kf.hy * e));
    g.set('Spine1', Q('y', -kf.hy * 0.4 * e));
    g.curl('Left', 0); g.curl('Right', 0);
    const step = Math.abs(Math.floor(ctx.beat)) % 2 ? 1 : -1;
    g.set('LeftUpLeg', Q('x', -0.2 * e, 'z', -0.15 * e));
    g.set('RightUpLeg', Q('x', -0.2 * e, 'z', 0.15 * e));
    g.set('LeftLeg', Q('x', 0.4 * e));
    g.set('RightLeg', Q('x', 0.4 * e));
    g.hipsOffset.x = step * 0.05 * e;
  },

  pump(g, t, dur, ctx) {
    const e = env(t, dur, 0.5);
    const b = ctx.beat;
    const p = Math.sin(b * Math.PI * 2);
    const q = Math.sin(b * Math.PI);
    // Raise-the-roof pumps with twisting torso and bobbing head
    g.set('LeftArm', Q('z', lerp(-ARM_DOWN, -0.25, e), 'y', -0.3 * e));
    g.set('RightArm', Q('z', lerp(ARM_DOWN, 0.25, e), 'y', 0.3 * e));
    g.set('LeftForeArm', Q('z', (1.3 + p * 0.45) * e));
    g.set('RightForeArm', Q('z', (-1.3 - p * 0.45) * e));
    g.curl('Left', 1.0 * e); g.curl('Right', 1.0 * e);
    g.set('Spine1', Q('y', q * 0.4 * e, 'x', 0.1 * e));
    g.set('Hips', Q('y', -q * 0.3 * e));
    g.set('Head', Q('x', (0.1 + p * 0.15) * e, 'y', -q * 0.2 * e));
    g.set('LeftUpLeg', Q('x', -0.35 * e, 'z', -0.2 * e));
    g.set('RightUpLeg', Q('x', -0.35 * e, 'z', 0.2 * e));
    g.set('LeftLeg', Q('x', (0.7 + 0.3 * p) * e));
    g.set('RightLeg', Q('x', (0.7 + 0.3 * p) * e));
    g.set('LeftFoot', Q('x', -0.35 * e));
    g.set('RightFoot', Q('x', -0.35 * e));
    g.hipsOffset.x = Math.sin(b * Math.PI) * 0.12 * e;
  },

  // Playing the piano. ctx.hit = {L,R} 0..1 decaying key-press impulses.
  piano(g, t, dur, ctx) {
    const e = env(t, dur, 0.6);
    const hit = ctx.hit;
    // both hands on the keys (ctx.tgt.keyL / keyR follow the notes being played)
    if (ctx.tgt.keyR) { // (no key targets once he has been told to stand up and stop playing)
      g.reachAssist(ctx.tgt.keyR, e);
      g.reach('Left', ctx.tgt.keyL, e);
      g.reach('Right', ctx.tgt.keyR, e);
    }
    g.set('LeftHand', Q('x', (0.1 + hit.L * 0.25) * e));
    g.set('RightHand', Q('x', (0.1 + hit.R * 0.25) * e));
    g.curl('Left', (0.3 + hit.L * 0.35) * e);
    g.curl('Right', (0.3 + hit.R * 0.35) * e);
    g.set('Spine1', Q('x', 0.12 * e, 'y', ctx.sway * 0.15));
    g.set('Head', Q('x', (0.25 + Math.sin(t * 2.5) * 0.05) * e, 'z', Math.sin(t * 1.1) * 0.12 * e));
    g.hipsOffset.y = -0.02 * e;
    if (ctx.music) g.set('Head', Q('x', (0.25 + Math.cos(ctx.beat * Math.PI * 2) * 0.07) * e, 'z', Math.sin(ctx.beat * Math.PI) * 0.12 * e));
  },

  // Seated at the piano (legs bent over the bench), optionally grooving if the stereo is on.
  pianoSit(g, t, dur, ctx) {
    POSES.piano(g, t, dur, ctx);
    const e = env(t, dur, 0.7);
    const b = ctx.beat;
    g.set('LeftUpLeg', Q('x', -1.4 * e, 'z', -0.08 * e));
    g.set('RightUpLeg', Q('x', -1.4 * e, 'z', 0.08 * e));
    g.set('LeftLeg', Q('x', 1.4 * e));
    g.set('RightLeg', Q('x', 1.4 * e));
    g.set('LeftFoot', Q('x', 0.05 * e));
    g.set('RightFoot', Q('x', 0.05 * e));
    g.set('Spine1', Q('x', 0.08 * e, 'y', ctx.sway * 0.15));
    if (ctx.music) {
      const s = Math.sin(b * Math.PI);
      g.set('Spine1', Q('x', 0.08 * e, 'y', ctx.sway * 0.15 - s * 0.14 * e, 'z', -s * 0.07 * e));
      g.set('Hips', Q('z', s * 0.06 * e));
      g.set('RightFoot', Q('x', (0.05 - Math.max(0, Math.cos(b * Math.PI * 2)) * 0.35) * e));
    }
  },

  // Reaching onto the shelf for a book, then pulling it back to the side. ctx.tgt.shelf / ctx.tgt.carry are world points.
  grab(g, t, dur, ctx) {
    const reachIn = smooth(clamp(t / 0.7, 0, 1));
    const pull = smooth(clamp((t - 1.0) / 0.7, 0, 1));
    const fade = 1 - smooth(clamp((t - 1.8) / 0.6, 0, 1));
    const target = new THREE.Vector3().lerpVectors(ctx.tgt.shelf, ctx.tgt.carry, pull);
    const sq = squatFor(ctx) * reachIn * fade;                              // a book on the floor stack: he squats down to it
    squat(g, sq);
    g.reach('Right', target, reachIn * fade, true, shelfGrip(g, ctx));   // handshake grip at mid height, palm to the shelf when reaching up
    g.curl('Right', 0.1 + 0.65 * smooth(clamp((t - 0.75) / 0.25, 0, 1)));
    g.set('Spine1', Q('x', 0.1 * reachIn * fade + 0.3 * sq));
    g.set('Head', Q('x', 0.12 * reachIn * fade, 'y', -0.15 * reachIn * fade));
  },

  // The reverse: raise the book to its slot, let go, step back.
  putBook(g, t, dur, ctx) {
    const raise = smooth(clamp(t / 0.9, 0, 1));
    const retreat = smooth(clamp((t - 1.5) / 0.7, 0, 1));
    const target = new THREE.Vector3().lerpVectors(ctx.tgt.carry, ctx.tgt.shelf, raise);
    const sq = squatFor(ctx) * raise * (1 - retreat);
    squat(g, sq);
    g.reach('Right', target, raise * (1 - retreat), true, shelfGrip(g, ctx));
    g.curl('Right', 0.75 - 0.65 * smooth(clamp((t - 1.25) / 0.3, 0, 1)));
    g.set('Spine1', Q('x', 0.1 * raise * (1 - retreat) + 0.3 * sq));
    g.set('Head', Q('x', 0.1 * raise * (1 - retreat), 'y', -0.15 * raise * (1 - retreat)));
  },

  // Holding the open book in front of the chest with both hands (ctx.readW fades the grip in and out).
  readStand(g, t, dur, ctx) {
    const w = ctx.readW;
    const wrap = g.limb.Right.handLen - 0.09; // fingertips reach just past the book's edge
    const rd = ctx.read;
    g.reach('Right', ctx.tgt.readR, w, rd.turning ? g.limb.Right.handLen - 0.04 : wrap);
    g.reach('Left', ctx.tgt.readL, w, wrap);
    g.curl('Left', 0.2 + 0.5 * w);
    g.curl('Right', rd.turning ? 0.15 + 0.35 * w : 0.2 + 0.5 * w); // loosen to pinch the page corner
    g.set('Spine1', Q('x', 0.06 * w));
    // eyes sweep along the lines, and follow the page when it turns
    const scan = rd.open > 0.9 ? Math.sin(t * 2.4) * 0.05 + Math.sin(t * 0.37) * 0.02 : 0;
    g.set('Head', Q('x', 0.4 * w + (rd.open > 0.9 ? 0.03 : 0), 'y', scan * w + (rd.turning ? 0.05 : 0)));
  },

  readSit(g, t, dur, ctx) {
    const e = env(t, dur, 0.8);
    sitLegs(g, e);
    POSES.readStand(g, t, dur, ctx);
    g.set('Spine1', Q('x', -0.08 * e + 0.06 * ctx.readW));
    g.set('Spine2', Q('x', -0.04 * e));
    g.hipsOffset.y = -0.02 * e;
  },

  // Guitar: hands follow Brain.computeGuitar (right hand strums, left hand moves along the neck).
  takeGuitar(g, t, dur, ctx) { guitarHands(g, ctx, 1); },
  putGuitar(g, t, dur, ctx) { guitarHands(g, ctx, 1); },
  guitar(g, t, dur, ctx) {
    guitarHands(g, ctx, 1);
    const b = ctx.guitar ? ctx.guitar.beat : 0;
    g.set('RightFoot', Q('x', -0.22 * Math.max(0, Math.sin(b * Math.PI * 2))));        // foot taps the beat
    g.set('Head', Q('x', 0.22 + Math.sin(b * Math.PI * 2) * 0.04, 'y', 0.25));           // looks at the fretboard
    g.set('Hips', Q('y', Math.sin(b * Math.PI) * 0.05));
  },

  // Ball games: hands go where Brain.computeBall puts them (ctx.ball), the ball follows in between.
  pickup(g, t, dur, ctx) { ballHands(g, ctx, Math.min(1, t / 0.5)); },
  dribble(g, t, dur, ctx) { ballHands(g, ctx, 1); },
  toss(g, t, dur, ctx) { ballHands(g, ctx, 1); },
  putdown(g, t, dur, ctx) { ballHands(g, ctx, 1); },

  // Playing piano while dancing along to the stereo: hands keep playing, body grooves on the beat.
  pianoGroove(g, t, dur, ctx) {
    POSES.piano(g, t, dur, ctx);
    const e = env(t, dur, 0.6);
    const b = ctx.beat;
    const s = Math.sin(b * Math.PI);
    const bounce = (1 + Math.cos(b * Math.PI * 2)) / 2;
    g.set('Hips', Q('y', s * 0.22 * e, 'z', s * 0.07 * e));
    g.set('Spine1', Q('x', 0.12 * e, 'y', ctx.sway * 0.15 - s * 0.12 * e, 'z', -s * 0.05 * e));
    g.set('Head', Q('x', (0.2 + Math.cos(b * Math.PI * 2) * 0.1) * e, 'y', -s * 0.12 * e, 'z', s * 0.1 * e));
    for (const [side, ph] of [['Left', 0], ['Right', 1]]) {
      const k = (1 + Math.cos((b + ph) * Math.PI)) / 2;
      g.set(`${side}UpLeg`, Q('x', (-0.2 - 0.3 * k) * e));
      g.set(`${side}Leg`, Q('x', (0.4 + 0.5 * k) * e));
      g.set(`${side}Foot`, Q('x', -0.2 * e));
    }
    g.hipsOffset.y = -0.05 * bounce * e;
    g.hipsOffset.x = s * 0.05 * e;
  },
};

// ---------------------------------------------------------------------------
// Behaviour: Guy chains activities, each a script of steps.
// ---------------------------------------------------------------------------
export class Brain {
  constructor(guy, world, ui, skills) {
    this.g = guy;
    this.w = world;
    this.ui = ui;
    this.skills = skills;      // what Guy has learned from books
    this.onLearn = null;       // called with the book def when he learns something
    this.gtr = { held: false, override: null, moved: false, y: 0, fret: 0, n: -1 }; // the guitar, while he handles it
    this.gname = 'guitar';     // which guitar object that is (the acoustic one, or an electric one that was built): see pickGuitar
    this.speed = 1;            // how fast he walks and how short his pauses between interactions are (the speed dropdown); never the interactions themselves
    this.lock = null;          // { name }: locked in on an object (long-press > Lock in): he keeps using it until told to stop
    this.onLock = null;        // called with the lock (or null) whenever it changes
    this.onRiff = null;        // called with a message when he makes up a riff he wants to keep
    this.visitId = null;       // the room he was asked to visit (long-press its door)
    this.beatLen = BEAT;        // length of a beat of whatever is playing on the stereo
    this.track = 'default';
    this.albumOnTable = false; // a record is standing by the stereo while it plays
    this.ballHeld = false;     // true while the ball is in his hands (so he always puts it down again)
    this.ballPos = null;       // world position the ball is forced to this frame (null = physics)
    this.time = 0;
    this.queue = [];
    this.step = null;
    this.walkPhase = 0;
    this.moving = false;
    this.last = '';
    this.music = null;       // stop function while boombox is on
    this.musicT0 = 0;
    this.hit = { L: 0, R: 0 };
    this.sway = 0;
    this.stuckT = 0;
    this.grid = makeGrid(world.obstacles);
    this.pianoNext = 0;
    this.lastRearrange = -999;
    this.handKey = { L: 50, R: 74 };
    // A book Guy has taken from the shelf (null if none): the shelf copy is hidden while this one is in his hands.
    this.held = null;
    this.readBlend = 0;
    this.read = { open: 0, turning: false, turnT: 0, sheet: null };
    this.bookMesh = makeHeldBook();
    world.room.add(this.bookMesh);
    this.albumMesh = makeHeldAlbum();
    world.room.add(this.albumMesh);
    this.pose = 'idle';
    this.poseT = 0;
    this.poseDur = 1;
    this.initHobbies();
    this.initWork();
    this.initRest();
    this.initPaint();
  }

  // ---- step builders ----
  walk(x, z, yaw = null) { return { type: 'walk', x, z, yaw }; }
  // Walk to a spot defined relative to an object, evaluated when the step starts (objects can be moved meanwhile).
  walkAt(name, dx, dz, yaw = null, direct = false) { return { type: 'walk', anchor: { name, dx, dz, yaw }, yaw, direct }; }
  play(pose, dur, fx = {}) { return { type: 'play', pose, dur, fx }; }
  obj(name) { return this.w.objects[name]; }

  activities() {
    const w = this.w;
    const atStereo = () => this.walkAt('table', 0, 0.55, Math.PI);
    return {
      ...this.hobbyActivities(),
      ...this.workActivities(),
      ...this.restActivities(),
      ...(this.galActivities ? this.galActivities() : {}),       // working with GAL (gal.js)
      ...this.paintActivities(),
      // the Learning Workstation: walk up, tap the screen, and its panel opens for whoever is here (the page shows it: onWorkstation)
      learn: () => {
        const m = () => this.obj('workstation');
        if (!m()) return ['nothing to use', this.play('idle', 0.5)];
        return ['using the workstation', this.stand('workstation', 0.9, () => m().screenPoint()),
          this.play('reach', 1.6, { needs: ['workstation'], target: () => m().screenPoint(), at: [0.8, () => { m().setActive(30); sfx('click'); if (this.learnPlan) { const q = this.learnPlan.query; this.learnPlan = null; learnBooks(this, findBooks(this.w, q)); sfx('chime'); } else if (this.onWorkstation) this.onWorkstation(this); }] }),
          this.play('idle', 1.4, { needs: ['workstation'] })];
      },
      wander: () => {
        const p = this.freeSpot();
        return ['wandering', this.walk(p.x, p.z), this.play('idle', rand(2, 4))];
      },
      piano: () => {
        const song = this.pickSong();
        return [`playing "${song.name}" on the piano`, this.benchAway(), this.walkAt('piano', 0, 0.8, Math.PI),
          this.play('piano', song.seconds + 1.5, { piano: true, song }), this.play('idle', 1)];
      },
      sitpiano: () => {
        const song = this.pickSong();
        return [`sitting at the piano playing "${song.name}"`, ...this.sitSteps('pianoSit', song.seconds + 1.5, { piano: true, song })];
      },
      jamsit: () => ['sitting at the piano, playing along with the stereo',
        atStereo(), this.play('reach', 1.8, { at: [0.9, () => this.musicOn()], target: () => this.stereoButton() }),
        ...this.sitSteps('pianoSit', rand(32, 48), { piano: true, sync: true, gen: makeJam() }),
        atStereo(), this.play('reach', 1.8, { at: [0.9, () => this.musicOff()], target: () => this.stereoButton() })],
      // Stereo on, then play piano in time with it: with a grooving body ('jam') or just hands ('jampiano')
      jam: () => this.stereoPiano('pianoGroove', 'dancing and playing piano along with the stereo'),
      jampiano: () => this.stereoPiano('piano', 'playing piano along with the stereo'),
      dance: () => {
        // With the lighting book he starts the lamp's party mode first and puts the light back afterwards.
        const lights = this.skills.has('lighting') && this.obj('lamp');
        const lampStep = (fn) => [this.walkAt('lamp', 0.55, 0, -Math.PI / 2),
          this.play('reach', 1.8, { at: [0.9, fn], needs: ['lamp'], target: () => this.lampSwitch() })];
        const ss = this.stereoSession();
        const what = lights ? 'throwing a dance party' : 'dancing';
        return [ss.title ? `${what} to "${ss.title}"` : what,
          ...ss.pre,
          ...(lights ? lampStep(() => w.lamp.party()) : []),
          ...ss.on,
          this.walk(this.danceSpot().x, this.danceSpot().z, 0),
          this.play(pick(['disco', 'robot', 'pump']), 9, { dance: true }),
          this.play(pick(['disco', 'robot', 'pump']), 9, { dance: true }),
          this.play(pick(['disco', 'robot', 'pump']), 9, { dance: true }),
          this.play('wave', 2.2, { dance: true }),
          ...ss.off,
          ...(lights ? lampStep(() => w.lamp.setLook(0xffd9a0, 6)) : []),
          ...ss.post,
          { type: 'plan', fn: () => this.partyTail() }];            // GAL's music: whoever stops last switches it off
      },
      // the dance books: the same stereo session as `dance`, with new moves
      dancemoves: () => {
        const ss = this.stereoSession();
        return [ss.title ? `doing the twist to "${ss.title}"` : 'practising his new dance moves', ...ss.pre, ...ss.on,
          this.walk(this.danceSpot().x, this.danceSpot().z, 0),
          this.play('twist', 9, { dance: true }), this.play('shuffle', 9, { dance: true }),
          this.play('twirl', 5, { dance: true, spin: 5.2 }), this.play(pick(['twist', 'shuffle']), 8, { dance: true }),
          this.play('wave', 2.2, { dance: true }), ...ss.off, ...ss.post];
      },
      ballroom: () => {
        const ss = this.stereoSession();
        return [ss.title ? `waltzing and swinging to "${ss.title}"` : 'waltzing round the room', ...ss.pre, ...ss.on,
          this.walk(this.danceSpot().x, this.danceSpot().z, 0),
          this.play('waltz', 11, { dance: true, spin: 0.9 }), this.play('swing', 9, { dance: true }),
          this.play('waltz', 9, { dance: true, spin: -0.9 }), this.play('swing', 8, { dance: true, spin: 1.6 }),
          this.play('wave', 2.2, { dance: true }), ...ss.off, ...ss.post];
      },
      // from the stereo's long-press menu: switch it on (the song the player has selected) or off
      sit: () => ['sitting down for a rest', this.chairStep((c) => [this.play('sitRest', rand(10, 16), { chairSit: true, chair: c.name })])],
      sitguitar: () => (this.pickGuitar(), ['sitting down to play the guitar', this.walkAt(this.gname, 0, 0.62, Math.PI),
        this.play('takeGuitar', 2.4, { guitar: true, at: [1.0, () => this.setGuitarHeld(true)] }),
        this.chairStep((c) => [this.play('sitGuitar', rand(22, 32), { guitar: true, chairSit: true, chair: c.name, strum: makeStrum() }),
          { ...this.walkAt(this.gname, 0, 0.62, Math.PI), fx: { guitar: true } },
          this.play('putGuitar', 2.4, { guitar: true, at: [1.3, () => this.setGuitarHeld(false)] })], true)]),
      slouch: () => ['slouching on the drum stool', this.walkAt('drums', 0.55, 1.15), this.walkAt('drums', 0.55, 0.6, Math.PI, true),
        this.play('slouch', rand(11, 16), { sitDrum: true }), this.walkAt('drums', 0.55, 1.15, null, true)],
      stereoon: () => ['switching the stereo on', this.walkAt('table', 0, 0.55, Math.PI),
        this.play('reach', 1.8, { at: [0.9, () => { const np = this.nowPlaying(); this.musicOn(np.list[np.index].id, true); }], needs: ['table'], target: () => this.stereoButton() })],
      stereooff: () => ['switching the stereo off', this.walkAt('table', 0, 0.55, Math.PI),
        this.play('reach', 1.8, { at: [0.9, () => { this.musicOff(); this.albumOnTable = false; }], needs: ['table'], target: () => this.stereoButton() })],
      lamp: () => ['fiddling with the lamp', this.sideStep('lamp', 0.55),
        this.play('reach', 1.8, { at: [0.9, () => w.lamp.toggle()], needs: ['lamp'], target: () => this.lampSwitch() })],
      // lighting book: choose a mood for the room
      mood: () => ['setting the mood with the lamp', this.sideStep('lamp', 0.55),
        this.play('reach', 1.8, {
          at: [0.9, () => { const l = pick(LAMP_LOOKS); w.lamp.setLook(l.color, l.base); this.ui(`lamp: ${l.name}`); }],
          needs: ['lamp'], target: () => this.lampSwitch(),
        })],
      // no lessons yet: poking at the keys with one finger
      plink: () => ['poking at the piano keys', this.benchAway(), this.walkAt('piano', 0, 0.8, Math.PI),
        this.play('piano', 16, { piano: true, song: plinkSong(), startAt: 1.2 }), this.play('idle', 1)],
      read: () => { const only = this.forceBook; this.forceBook = null; return this.readSteps(only && only.mesh.visible ? only : null); },
      books: () => this.readSteps(),
      putback: () => ['putting the book back', this.putBackStep()],
      stretch: () => ['stretching', this.play('stretch', 5)],
      wave: () => { const p = this.openSpotNear(this.waveSpot().x, this.waveSpot().z); return ['waving at you', this.walk(p.x, p.z, 0), this.play('wave', 3.5)]; },      // in front of the camera, but not inside the furniture there
      rearrange: () => this.rearrangeSteps(),
      // any of the plants in the room (the user can ask for a particular one: forcePlant)
      plant: () => ['tending the plants', {
        type: 'plan',
        fn: () => {
          const want = this.forcePlant; this.forcePlant = null;
          const name = want && this.obj(want) ? want : pick(PLANT_NAMES.filter((n) => this.obj(n)));
          if (!name) { this.queue.length = 0; return []; }
          return [...this.sideStep(name, name === 'tree' ? 0.75 : 0.62).fn(), this.play('reach', 2.6, { needs: [name], at: [1.3, () => sfx('leaf')], target: () => this.plantLeaf(name) })];
        },
      }],
      // decorating book: dust a picture frame, wall light or window sill, wiping along its lower edge
      dust: () => ['dusting the picture frames', { type: 'plan', fn: () => this.dustSteps() }],
      // Without the ball book he only pokes it; with it he kicks properly.
      ball: () => {
        const skilled = this.skills.has('ball');
        return [skilled ? 'kicking the ball' : 'poking the ball with his foot', {
          type: 'plan',
          fn: () => {
            const b = w.ball.position;
            // try directions until Guy has somewhere free to stand behind the ball (with room for his legs and arms to swing)
            for (let i = 0; i < 60; i++) {
              const grid = makeGrid(w.obstacles, i < 40 ? 0.55 : INFLATE);
              const dir = new THREE.Vector3(rand(-3.5, 3.5) - b.x, 0, rand(-2, 3) - b.z).normalize();
              const from = b.clone().addScaledVector(dir, -0.7);
              if (Math.abs(from.x) > 4.4 || from.z < -3.4 || from.z > 3.5 || cellBlocked(grid, from.x, from.z)) continue;
              return [this.walk(from.x, from.z, Math.atan2(dir.x, dir.z)), this.play('kick', 1.2, { at: [0.5, () => this.kickBall(dir, skilled)] })];
            }
            this.queue.length = 0;
            return [];
          },
        }];
      },
      dribble: () => ['dribbling the ball', this.ballStand(),
        this.play('pickup', 2.0, { ball: true, at: [0.9, () => { this.ballHeld = true; }] }),
        this.play('dribble', 11, { ball: true }),
        this.play('putdown', 2.0, { ball: true, at: [1.0, () => this.releaseBall()] })],
      toss: () => ['tossing the ball up and catching it', this.ballStand(),
        this.play('pickup', 2.0, { ball: true, at: [0.9, () => { this.ballHeld = true; }] }),
        this.play('toss', 6.85, { ball: true }),
        this.play('putdown', 2.0, { ball: true, at: [1.0, () => this.releaseBall()] })],
      // a new song every time (strum.js): a key, a chord progression, a pattern and a tempo
      guitar: () => {
        const song = makeStrum();
        return [`strumming ${song.name} in ${song.key} on the guitar (${song.chords.map((c) => c.name).join(' ')})`, ...this.guitarBegin(), this.play('guitar', song.secs, { guitar: true, strum: song }), ...this.guitarEnd()];
      },
      // the stereo is on: strum along in time and in the key of whatever is playing
      // through the door of an added room, a look round, and back (long-press the door, or he does it now and then)
      visit: () => {
        const w = this.w, id = this.visitId && w.doors[this.visitId] ? this.visitId : Object.keys(w.doors).find((d) => !this.doorLockedFor(d)), door = w.doors[id];
        this.visitId = null;
        if (!door || this.doorLockedFor(id)) return ['the door is locked', this.play('idle', 0.5)];
        const out = this.doorStand(id), inn = w.doorPoint(id, -1.0), face = w.doorYaw(id, false), b = door.shell.bounds;
        const direct = (p, yaw = null) => ({ ...this.walk(p.x, p.z, yaw), direct: true });
        const steps = [this.walk(out.x, out.z, face),
          this.play('reach', 1.6, { at: [0.8, () => w.setDoorOpen(id, true)], target: () => w.doorKnob(id) }),
          this.play('idle', 0.7),                                               // the door swings open
          direct(inn)];
        for (let i = 0; i < 3; i++) steps.push(direct({ x: rand(b.minX + 1.2, b.maxX - 1.2), z: rand(b.minZ + 1.2, b.maxZ - 1.2) }), this.play('idle', rand(1.5, 3)));
        steps.push({ type: 'plan', fn: () => { if (!this.stuckIn()) return []; this.queue.length = 0; this.ui(`shut in the ${door.name} (the door is locked)`); return []; } },      // (locked behind him)
          direct(inn), direct(out), this.walk(out.x, out.z, face),
          this.play('reach', 1.6, { at: [0.8, () => this.closeDoor(id)], target: () => w.doorKnob(id) }));
        return [`having a look in the ${door.name}`, ...steps];
      },
      // he is in an added room: straight back out through the door and shut it behind him
      // shut in an added room (its door is locked, and so is any other way out): wander about in there until somebody unlocks it
      stuck: () => {
        const w = this.w, id = this.stuckIn(), d = id && w.doors[id];
        if (!d) return ['collecting himself', this.play('idle', 0.5)];
        const b = d.shell.bounds, direct = (q) => ({ ...this.walk(q.x, q.z), direct: true });
        return [`shut in the ${d.name} (the door is locked)`, direct({ x: rand(b.minX + 1.2, b.maxX - 1.2), z: rand(b.minZ + 1.2, b.maxZ - 1.2) }), this.play('idle', rand(2, 4))];
      },
      leave: () => {
        if (this.stuckIn()) return ['shut in (the door is locked)', this.play('idle', 0.5)];
        const w = this.w, p = this.g.pos, id = Object.keys(w.doors).sort((a, c) => {
          const f = (d) => { const bb = w.doors[d].shell.bounds; return Math.hypot((bb.minX + bb.maxX) / 2 - p.x, (bb.minZ + bb.maxZ) / 2 - p.z); };
          return f(a) - f(c);
        })[0];
        if (!id) { this.g.root.position.set(0, 0, 2); return ['collecting himself', this.play('idle', 0.5)]; }      // the room is gone: back to the middle of his own
        const out = this.doorStand(id), inn = w.doorPoint(id, -1.0), face = w.doorYaw(id, false);
        const direct = (q) => ({ ...this.walk(q.x, q.z), direct: true });
        return [`coming back from the ${w.doors[id].name}`,
          this.play('idle', 0.1, { at: [0, () => w.setDoorOpen(id, true)] }),
          direct(inn), direct(out), this.walk(out.x, out.z, face),
          this.play('reach', 1.6, { at: [0.8, () => this.closeDoor(id)], target: () => w.doorKnob(id) })];
      },
      // making up riffs: a new idea (or two) and sometimes one of the favourites he kept. The good new ones are remembered (riffs.js).
      riff: () => {
        const picks = [nextRiff(), nextRiff()], list = picks.map((p) => p.riff);
        const fresh = picks.filter((p) => !p.favourite);
        const secs = 0.6 + list.length * RIFF_STEPS * 2 * 0.3 + 1;
        return [fresh.length ? 'making up a riff on the guitar' : 'playing one of his favourite riffs', ...this.guitarBegin(),
          this.play('guitar', secs, { guitar: true, riff: list, onEnd: () => {
            if (fresh.some((p) => keepRiff(p.riff))) { this.ui('that one is a keeper!'); if (this.onRiff) this.onRiff("Guy made up a riff he likes! He'll remember it."); }
          } }),
          ...this.guitarEnd()];
      },
      jamguitar: () => [`playing the guitar along with ${this.nowPlaying().title}`, ...this.guitarBegin(), this.play('guitar', rand(30, 45), { guitar: true, sync: true, strum: { pat: strumPattern() } }), ...this.guitarEnd()],
      // he was interrupted while holding the guitar: take it back to its stand
      putguitar: () => ['putting the guitar back', this.walkAt(this.gname, 0, 0.62, Math.PI),
        this.play('putGuitar', 2.4, { guitar: true, at: [1.3, () => this.setGuitarHeld(false)] })],
      // he was interrupted while holding the ball: put it down
      dropball: () => ['putting the ball down', this.play('putdown', 2.0, { ball: true, at: [1.0, () => this.releaseBall()] })],
    };
  }

  // Songs he can play with what he has learned (null if none).
  pickSong() {
    const song = randomSong(this.lastSong, (need) => this.skills.has(need));
    this.lastSong = song.name;
    return song;
  }

  // Walk to whichever side of an object is free (front, right, left, back), facing it. For things that are used from any side.
  sideStep(name, dist) {
    return {
      type: 'plan',
      fn: () => {
        const o = this.obj(name);
        const grid = makeGrid(this.w.obstacles, INFLATE, 0, o.obstacle);
        for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const l = o.local(dx * dist, dz * dist), x = o.x + l.x, z = o.z + l.z;
          if (Math.abs(x) < 4.5 && z > -3.5 && z < 3.6 && !cellBlocked(grid, x, z)) return [this.walk(x, z, Math.atan2(-l.x, -l.z))];
        }
        return [this.walkAt(name, dist, 0)];
      },
    };
  }

  // ---- Guitar ----
  electric() { const o = this.obj(this.gname); return !!(o && o.electric); }
  guitars() { return Object.values(this.w.objects).filter((o) => o.guitar); }
  freeGuitar() { return this.guitars().some((g) => !(this.other && this.other.using && this.other.using.has(g.name))); }
  // choose the guitar for what he is about to play: the one in his hands, the one he was asked for, or one the other robot is not using
  pickGuitar() {
    if (this.gtr.held && this.obj(this.gname)) { if (this.using) this.using.add(this.gname); return; }
    const o = this.other, all = this.guitars(), free = all.filter((g) => !(o && o.using && o.using.has(g.name)));
    const want = this.wantGuitar && free.find((g) => g.name === this.wantGuitar);
    this.wantGuitar = null;
    const pick = want || free.find((g) => g.name === this.gname) || free[0] || all[0];
    if (pick && pick.name !== this.gname) { this.resetGuitarMesh(); this.gname = pick.name; }
    if (this.using) this.using.add(this.gname);
  }
  resetGuitarMesh() {
    const o = this.w.removed[this.gname] || this.obj(this.gname);
    if (o && o.guitar) { o.guitar.position.copy(o.rest.pos); o.guitar.quaternion.copy(o.rest.quat); }
    this.gtr.moved = false;
  }

  // point in the guitar's own frame (neck along +x, soundboard facing +z) -> world
  gp(F, x, y, z) { return new THREE.Vector3(x, y, z).applyQuaternion(F.q).add(F.pos); }

  // Where the guitar is (on its stand, lifted, or held across his body) and where his hands go.
  computeGuitar(s) {
    this.gtr.override = null;
    const guitar = this.obj(this.gname);
    if (!s.fx || !s.fx.guitar || !guitar) return null;
    const root = this.g.root, t = s.t, pose = s.type === 'walk' ? 'walkGuitar' : s.pose;   // walking with it in his hands counts as holding it
    const sm = (x) => smooth(clamp(x, 0, 1));
    guitar.group.updateWorldMatrix(true, false);
    const rest = { pos: guitar.group.localToWorld(guitar.rest.pos.clone()), q: guitar.group.getWorldQuaternion(new THREE.Quaternion()).multiply(guitar.rest.quat) };
    // held high with the neck raised, so the fretting forearm runs up to the neck and the wrist bends no more than a wrist can (pose sweep: wrist <= 100 deg)
    const hold = { pos: root.localToWorld(new THREE.Vector3(-0.12, 1.05 + this.g.model.position.y, 0.205)), q: root.quaternion.clone().multiply(Q('y', -0.3, 'z', 0.55)) };
    let blend = pose === 'guitar' || pose === 'sitGuitar' || pose === 'walkGuitar' ? 1 : pose === 'takeGuitar' ? sm((t - 1.0) / 0.9) : 1 - sm((t - 0.2) / 0.9);
    const cur = { pos: new THREE.Vector3().lerpVectors(rest.pos, hold.pos, blend), q: rest.q.clone().slerp(hold.q, blend) };
    this.gtr.override = cur;

    // strumming: eighth notes, a chord every bar (Am F C G)
    const st = this.gtr;
    if (pose === 'takeGuitar') { st.n = -1; st.yGoal = 0; st.fretGoal = 0; }
    if (pose === 'guitar' || pose === 'sitGuitar') {
      let n, chord;
      if (s.fx.riff) {
        // a riff: single notes picked on top of a bass note, the fretting hand following the pitch
        n = Math.floor((t - 0.6) / 0.3);
        if (n !== st.n && n >= 0 && n < s.fx.riff.length * RIFF_STEPS * 2) {
          st.n = n;
          const r = riffAt(s.fx.riff, n);
          if (r.bass) playPluck(r.bass, 0, 1.4, 0.07, this.electric());
          if (r.note) {
            playPluck(r.note, 0, 0.9, 0.15, this.electric());
            st.fretGoal = clamp((r.note - r.root) / 12 * 0.1, -0.01, 0.1);
            st.yGoal = n % 2 ? 0.06 : -0.08;
          }
        }
      } else {
      const song = s.fx.strum;                                       // the song he made up (strum.js); none: the old Am F C G
      if (s.fx.sync && this.music) { const b = this.currentBeat(); n = Math.floor(b * 2); chord = guitarChordAt(this.track, b); } // locked to the stereo
      else if (song && song.chords) { n = Math.floor((t - 0.6) / song.step); chord = song.chords[Math.floor(n / (8 * song.bars)) % song.chords.length]; }
      else { n = Math.floor((t - 0.6) / 0.3); chord = GUITAR_CHORDS[Math.floor(n / 8) % GUITAR_CHORDS.length]; }
      if (n !== st.n && n >= 0) {
        st.n = n;
        const pat = ((song && song.pat) || 'D.DU.UDU')[n % 8];
        st.fretGoal = chord.fret;
        if (pat === 'D' || pat === 'U') {
          const notes = pat === 'D' ? chord.notes : [...chord.notes].reverse();
          notes.forEach((m, i) => playPluck(m, i * 0.018, 1.8, pat === 'D' ? 0.15 : 0.11, this.electric()));
          st.yGoal = pat === 'D' ? -0.1 : 0.07;
        } else if (pat === 'B') { playPluck(chord.notes[0], 0, 1.6, 0.13, this.electric()); st.yGoal = -0.05; }                 // the bass note alone
        else if (pat !== '.') { playPluck(chord.notes[Number(pat) % chord.notes.length], 0, 1.1, 0.13, this.electric()); st.yGoal = n % 2 ? 0.05 : -0.06; }    // picking one string
      }
      }
    }
    st.y += ((st.yGoal ?? 0) - st.y) * 0.35;
    st.fret += ((st.fretGoal ?? 0) - st.fret) * 0.15;

    const neckRest = this.gp(rest, 0.36, 0, 0.03);
    const neckNow = this.gp(cur, 0.36, 0, 0.03);
    // left hand: fingers angled up along the neck, palm to the neck. The WRIST is placed so the knuckles sit on the neck (a fixed
    // offset left the hand 8-14 cm away from it, floating; 0.124 m is wrist-to-knuckle on this model).
    const axZ = new THREE.Vector3(0, 0, 1).applyQuaternion(cur.q), axX = new THREE.Vector3(1, 0, 0).applyQuaternion(cur.q);
    const leftFingers = new THREE.Vector3(0, 1, 0).applyQuaternion(cur.q).multiplyScalar(0.4).addScaledVector(axX, 0.8).addScaledVector(axZ, -0.35).normalize();
    const leftPalm = axZ.clone().multiplyScalar(-1);                                                             // palm normal: towards the neck
    const knuckle = this.gp(cur, 0.46 + st.fret, 0, 0).addScaledVector(leftPalm, -0.01);          // where the knuckles rest
    const fretPt = knuckle.addScaledVector(leftFingers, -0.124);
    const fingersDir = new THREE.Vector3(0, -1, 0).applyQuaternion(cur.q).multiplyScalar(0.9).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(cur.q), -0.4).normalize();
    const tip = this.gp(cur, 0.05, st.y * 0.5, 0.07);                       // right FINGERTIPS just above the strings by the sound hole
    const strum = tip.clone().addScaledVector(fingersDir, -this.g.limb.Right.handLen * 0.9); // ...so the WRIST is a hand's length back along the fingers
    const handLen = this.g.limb.Right.handLen;
    let out;
    if (pose === 'takeGuitar') {
      const reach = sm(t / 0.6);
      const toStrum = sm((t - 1.6) / 0.45);
      out = { R: new THREE.Vector3().lerpVectors(blend < 0.02 ? neckRest : neckNow, strum, toStrum), wR: reach, L: fretPt, wL: sm((t - 1.4) / 0.5), stopR: lerp(handLen - 0.03, 0, toStrum) };
      out.handBlend = toStrum;
    } else if (pose === 'putGuitar') {
      const toNeck = sm(t / 0.45);
      out = { R: new THREE.Vector3().lerpVectors(strum, blend < 0.02 ? neckRest : neckNow, toNeck), wR: 1 - sm((t - 1.5) / 0.6), L: fretPt, wL: 1 - sm(t / 0.4), stopR: lerp(0, handLen - 0.03, toNeck) };
      out.handBlend = 1 - toNeck;
    } else {
      out = { R: strum, wR: 1, L: fretPt, wL: 1, stopR: 0 };
    }
    out.axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(cur.q); // soundboard normal (points away from Guy)
    out.axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(cur.q); // along the neck, towards the headstock
    // strumming fingers hang down over the strings (down the soundboard, tipped a little towards it)
    // fretting hand: wrist under the neck, fingers pointing up, palm towards the back of the neck, thumb behind it
    const lp = -1;   // thumb along the neck towards the headstock (the other roll left the thumb pointing back at his body)
    out.leftHand = { fingers: leftFingers, palm: leftPalm };
    out.fingersDir = new THREE.Vector3(0, -1, 0).applyQuaternion(cur.q).multiplyScalar(0.9).addScaledVector(out.axisZ, -0.4).normalize();
    out.cur = cur;
    out.beat = s.fx.sync && this.music ? this.currentBeat() : (t - 0.6) / 0.6;
    // free playing keeps a tempo (an eighth note every 0.3 s from 0.6 s in); a skilled drummer joining in locks onto it
    if ((pose === 'guitar' || pose === 'sitGuitar') && !(s.fx.sync && this.music)) this.publishTempo(this.time - t + 0.6, 0.6);
    return out;
  }

  // A strap from the end of the body, over his left shoulder, to the heel of the neck, so the guitar visibly hangs from him.
  updateStrap(cur) {
    if (!this.strap) {
      this.strap = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 1), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }));
        this.w.room.add(m);
        return m;
      });
    }
    this.strap.forEach((m) => (m.visible = !!cur));
    if (!cur) return;
    const F = { pos: cur.pos, q: cur.q };
    const root = this.g.root;
    const pin = this.gp(F, -0.27, 0.0, 0.0);
    const heel = this.gp(F, 0.22, 0.0, 0.0);
    const shoulder = this.g.boneWorld('LeftShoulder').add(new THREE.Vector3(0, 0.07, 0)).addScaledVector(new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y)), -0.03);
    [[pin, shoulder], [shoulder, heel]].forEach(([a, b], i) => {
      const m = this.strap[i];
      const d = b.clone().sub(a);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.scale.set(1, 1, d.length());
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    });
  }

  // ---- Ball games ----
  ballStand() { // walk to a free spot next to the ball (on Guy's side if possible), facing it
    return {
      type: 'plan',
      fn: () => {
        const b = this.w.ball.position, g = this.g.pos;
        const base = Math.atan2(g.x - b.x, g.z - b.z);          // direction from the ball towards Guy
        // his hands go out to the sides while he handles the ball: prefer a spot with a little more room than walking needs
        for (const grid of [makeGrid(this.w.obstacles, 0.62), makeGrid(this.w.obstacles, 0.55)]) {
          for (const turn of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
            const x = b.x + Math.sin(base + turn) * 0.65, z = b.z + Math.cos(base + turn) * 0.65;
            if (Math.abs(x) > 4.4 || z < -3.4 || z > 3.5 || cellBlocked(grid, x, z)) continue;
            return [this.walk(x, z, Math.atan2(b.x - x, b.z - z))];
          }
        }
        this.queue.length = 0;
        return [];
      },
    };
  }

  releaseBall() { this.ballHeld = false; sfx('bounce', 1.5); }   // set down on the floor

  // picking the guitar up off its stand or putting it back makes a noise
  setGuitarHeld(held) { this.gtr.held = held; sfx('guitar'); }

  // Where the ball is while Guy handles it, and where his hands go: hands on either side, a hand on top, ...
  computeBall(s) {
    this.ballPos = null;
    if (s.type !== 'play' || !s.fx.ball) return null;
    const root = this.g.root, ball = this.w.ball, t = s.t, pose = s.pose;
    const sm = (x) => smooth(clamp(x, 0, 1));
    const P = (x, y, z) => root.localToWorld(new THREE.Vector3(x, y, z));
    const chest = () => P(0, 1.0, 0.34);
    const left = new THREE.Vector3(Math.cos(root.rotation.y), 0, -Math.sin(root.rotation.y));
    const two = (c, w = 1) => ({ L: c.clone().addScaledVector(left, 0.12), R: c.clone().addScaledVector(left, -0.12), wL: w, wR: w, look: 0 });
    let st = null;
    if (pose === 'pickup') {
      s.floor ??= ball.position.clone();
      const k = sm((t - 0.9) / 0.9);
      const c = new THREE.Vector3().lerpVectors(s.floor, chest(), k);
      st = two(c);
      st.look = 0.3 * (1 - k);
      if (t >= 0.9) this.ballPos = c;                       // until the grab it stays where it was
    } else if (pose === 'dribble') {
      const D = (y) => P(-0.28, y, 0.36);
      const handLen = this.g.limb.Right.handLen;
      if (t < 0.7) {                                         // chest -> dribbling spot, left hand lets go
        const c = new THREE.Vector3().lerpVectors(chest(), D(0.7), sm(t / 0.7));
        st = two(c, 1);
        st.wL = 1 - sm((t - 0.2) / 0.5);
        st.R = new THREE.Vector3().lerpVectors(st.R, c.clone().add(new THREE.Vector3(0, 0.18, 0)), sm((t - 0.2) / 0.5));
        this.ballPos = c;
      } else if (t < s.dur - 0.9) {                          // bounce: hand follows the top of the ball, then pushes down
        const u = ((t - 0.7) / 0.7) % 1;
        const cyc = Math.floor((t - 0.7) / 0.7);
        if (cyc !== s.cyc) { s.cyc = cyc; sfx('bounce', 3.5); }          // the ball hits the floor
        const y = 0.18 + 0.52 * 4 * u * (1 - u);
        const c = D(y);
        st = { R: P(-0.28, Math.max(y + 0.18, 0.7), 0.36), wR: 1, L: c, wL: 0, stop: handLen * 0.75, look: 0.25 };
        this.ballPos = c;
      } else {                                               // catch it and bring it back to the chest
        const k = sm((t - (s.dur - 0.9)) / 0.9);
        const c = new THREE.Vector3().lerpVectors(D(0.7), chest(), k);
        st = two(c, 1);
        st.wL = k;
        st.R = new THREE.Vector3().lerpVectors(c.clone().add(new THREE.Vector3(0, 0.18, 0)), st.R, k);
        this.ballPos = c;
      }
    } else if (pose === 'toss') {
      const T0 = 0.6, CY = 1.75, n = Math.floor((s.dur - 1.0 - T0) / CY);
      const L = (y) => P(0, y, 0.34);
      let c;
      if (t < T0 || t >= T0 + n * CY) { c = chest(); st = two(c); }
      else {
        const tc = (t - T0) % CY;
        if (tc < 0.25) { c = L(lerp(1.0, 1.25, sm(tc / 0.25))); st = two(c); }
        else if (tc < 1.27) {                                 // in the air; hands drop, wait, then rise to the catch
          const tau = tc - 0.25;
          c = L(1.25 + 5.0 * tau - 4.9 * tau * tau);
          const hy = tau < 0.25 ? lerp(1.25, 1.0, sm(tau / 0.25)) : tau < 0.75 ? 1.0 : lerp(1.0, 1.25, sm((tau - 0.75) / 0.27));
          st = two(L(hy));
        } else { c = L(lerp(1.25, 1.0, sm((tc - 1.27) / 0.48))); st = two(c); }
      }
      st.look = -clamp((root.worldToLocal(c.clone()).y - 1.3) / 1.2, 0, 1) * 0.55; // eyes follow it up
      this.ballPos = c;
    } else if (pose === 'putdown') {
      const F = P(0, 0.18, 0.52);
      const c = new THREE.Vector3().lerpVectors(chest(), F, sm(t / 0.9));
      st = two(c, 1 - sm((t - 1.3) / 0.5));
      st.look = 0.3;
      if (t < 1.0) this.ballPos = c;                          // after the release it is on the floor again
      else if (t >= 1.0 && this.ballHeld) this.ballPos = c;   // (in case the release callback has not fired yet)
    }
    return st;
  }

  // ---- Moving furniture: Guy walks behind an object and pushes it along a collision-free route ----
  // Returns walk/push steps, or null if the object can't be taken there.
  planPush(obj, tx, tz, from = null) {
    const obstacles = this.w.obstacles;
    const sx = from ? from.x : obj.x, sz = from ? from.z : obj.z;   // where the object starts this leg
    const r = Math.max(obj.w, obj.d) / 2 + 0.05;
    const objGrid = makeGrid(obstacles, r, r, obj.obstacle);
    // the object may already sit closer to its neighbours than this clearance: let it leave
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      if (Math.hypot(X0 + i * CELL - sx, Z0 + j * CELL - sz) < 0.45) objGrid[i + j * NX] = 0;
    }
    if (cellBlocked(objGrid, tx, tz)) return null;
    const route = findPath(objGrid, sx, sz, tx, tz, true);
    if (!route) return null;
    const pts = [{ x: sx, z: sz }];
    for (const p of route) if (Math.hypot(p.x - pts.at(-1).x, p.z - pts.at(-1).z) > 0.12) pts.push(p);
    if (pts.length < 2 || pts.length > 7) return null;
    const guyGrid = makeGrid(obstacles, INFLATE, 0, obj.obstacle);
    const spd = obj.weight === 'medium' ? 0.45 : 0.75;
    const steps = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const A = pts[i], B = pts[i + 1];
      const len = Math.hypot(B.x - A.x, B.z - A.z);
      const d = { x: (B.x - A.x) / len, z: (B.z - A.z) / len };
      const off = Math.abs(d.x) * obj.w / 2 + Math.abs(d.z) * obj.d / 2 + 0.45;
      const S = { x: A.x - d.x * off, z: A.z - d.z * off };
      const S2 = { x: B.x - d.x * off, z: B.z - d.z * off };
      const inRoom = (q) => Math.abs(q.x) <= 4.5 && q.z >= -3.5 && q.z <= 3.6; // Guy can't stand in the wall
      if (!inRoom(S) || !inRoom(S2) || cellBlocked(guyGrid, S.x, S.z) || cellBlocked(guyGrid, S2.x, S2.z) || !lineClear(guyGrid, S, S2)) return null;
      const yaw = Math.atan2(d.x, d.z);
      steps.push(this.walk(S.x, S.z, yaw));
      steps.push({ ...this.walk(S2.x, S2.z, yaw), push: { obj, relx: d.x * off, relz: d.z * off, spd } });
    }
    return steps;
  }

  // planPush, and if Guy has no room to get behind the object (it is jammed against something), slide it out sideways first.
  planPushVia(obj, tx, tz) {
    const direct = this.planPush(obj, tx, tz);
    if (direct) return direct;
    for (const [dx, dz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4], [1.0, 1.0], [-1.0, 1.0]]) {
      const w = { x: obj.x + dx, z: obj.z + dz };
      const first = this.planPush(obj, w.x, w.z);
      if (!first) continue;
      const second = this.planPush(obj, tx, tz, w);
      if (second) return [...first, ...second];
    }
    return null;
  }

  // A plan step: when reached, expands into the pushes that bring `name` to getTarget(); gives up the whole activity if impossible.
  pushTo(name, getTarget) {
    return {
      type: 'plan',
      fn: () => {
        const obj = this.obj(name);
        const t = getTarget();
        if (Math.hypot(t.x - obj.x, t.z - obj.z) < 0.1) return [];
        const steps = this.planPushVia(obj, t.x, t.z);
        if (!steps) { this.queue.length = 0; this.ui(`couldn't get the ${name} where he wanted it`); return []; }
        return steps;
      },
    };
  }

  // The bench waits behind the gap Guy steps into, 1.65 m from the piano's centre.
  benchWait() { const p = this.obj('piano'), l = p.local(0, 1.65); return { x: p.x + l.x, z: p.z + l.z }; }

  // Standing at the piano: if the bench is in the way, push it back first.
  benchAway() {
    return {
      type: 'plan',
      fn: () => {
        const b = this.obj('bench'), p = this.obj('piano');
        if (!b) return [];                                  // no bench in the room (the user removed it): nothing to move
        const l = p.local(0, 0.8);
        const sx = p.x + l.x, sz = p.z + l.z;
        const blocking = sx > b.obstacle.x0 - 0.4 && sx < b.obstacle.x1 + 0.4 && sz > b.obstacle.z0 - 0.4 && sz < b.obstacle.z1 + 0.4;
        return blocking ? [this.pushTo('bench', () => this.benchWait())] : [];
      },
    };
  }

  // The bench's long side must run along the piano's keyboard; if the user turned the piano, Guy turns the bench.
  orientBench() {
    return {
      type: 'plan',
      fn: () => {
        const bench = this.obj('bench'), p = this.obj('piano');
        if (bench.rot % 2 === p.rot % 2) return [];
        const w = this.w;
        if (!w.fits(bench, bench.x, bench.z, bench.d, bench.w)) { this.queue.length = 0; this.ui("no room to turn the bench"); return []; }
        const guyGrid = makeGrid(w.obstacles, INFLATE, 0, bench.obstacle);
        const gap = Math.max(bench.w, bench.d) / 2 + 0.55;
        for (const [dx, dz] of [[gap, 0], [-gap, 0], [0, gap], [0, -gap]]) {
          const x = bench.x + dx, z = bench.z + dz;
          if (Math.abs(x) > 4.5 || z < -3.5 || z > 3.6 || cellBlocked(guyGrid, x, z)) continue;
          return [this.walk(x, z, Math.atan2(-dx, -dz)), this.play('reach', 2.0, { at: [1.0, () => bench.rotate(1)], needs: ['bench'], target: () => this.benchEdge(bench) })];
        }
        this.queue.length = 0; this.ui("no room to turn the bench"); return [];
      },
    };
  }

  // Fetch the bench if needed, step into the gap between piano and bench from the side, sit back, scoot in, play.
  sitSteps(pose, dur, fx) {
    return [
      this.orientBench(),
      this.pushTo('bench', () => this.benchWait()),
      {
        type: 'plan',
        fn: () => {
          const p = this.obj('piano');
          const gl = p.toLocal(this.g.pos.x - p.x, this.g.pos.z - p.z);
          let side = gl.x > 0 ? 1 : -1;
          const e = p.local(side * 1.2, 0.95);
          if (Math.abs(p.x + e.x) > 4.5 || p.z + e.z < -3.5 || p.z + e.z > 3.6) side = -side;
          const E = [side * 1.2, 0.95];
          return [
            this.walkAt('piano', E[0], E[1]),
            this.walkAt('piano', 0, 0.95, Math.PI, true),
            this.play(pose, dur, { ...fx, startAt: 2.0, sit: true }),
            this.walkAt('piano', E[0], E[1], null, true),
          ];
        },
      },
    ];
  }

  // ---- Where the hands go ----
  stereoButton() { // the play button on the front of the boombox
    const b = this.w.boombox.group;
    return b.localToWorld(new THREE.Vector3(0.0, 0.2, 0.11));
  }

  lampSwitch() { // the switch on the lamp stem, on the side Guy is standing
    const l = this.obj('lamp'), g = this.g.pos;
    const dx = g.x - l.x, dz = g.z - l.z, len = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(l.x + (dx / len) * 0.04, 1.05, l.z + (dz / len) * 0.04);
  }

  plantLeaf(name = 'plant') { // a leaf (or bloom, or branch) near the top of the plant, on the side Guy stands
    const p = this.obj(name), g = this.g.pos;
    const [out, y] = { plant: [0.1, 0.78], flowerplant: [0.12, 0.74], tree: [0.4, 1.25] }[name] || [0.1, 0.78];
    const dx = g.x - p.x, dz = g.z - p.z, len = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(p.x + (dx / len) * out, y, p.z + (dz / len) * out);
  }

  // Stand 0.55 m in front of a wall piece he can reach (clear floor there) and wipe along the lower edge of its frame.
  dustSteps() {
    const grid = makeGrid(this.w.obstacles, INFLATE), spots = [];
    for (const d of Object.values(this.w.decor)) {
      if (!d.wall) continue;
      const back = d.wall === 'back';
      const x = back ? d.u : -ROOM.w / 2 + 0.55, z = back ? -ROOM.d / 2 + 0.55 : d.u;
      if (Math.abs(x) > 4.4 || z < -3.5 || z > 3.6 || cellBlocked(grid, x, z)) continue;
      spots.push({ d, x, z, yaw: back ? Math.PI : -Math.PI / 2 });
    }
    if (!spots.length) { this.queue.length = 0; return []; }
    const s = pick(spots), d = s.d, name = d.name, t0 = this.time;
    const y = clamp(d.v - d.hh + 0.12, 0.95, 1.7), span = Math.min(d.hw * 0.6, 0.35);
    const target = () => {
      sfx('wipe');
      const u = d.u + Math.sin((this.time - t0) * 2.4) * span;
      return d.wall === 'back' ? new THREE.Vector3(u, y, -ROOM.d / 2 + 0.06) : new THREE.Vector3(-ROOM.w / 2 + 0.06, y, u);
    };
    this.ui(`dusting the ${d.label}`);
    return [this.walk(s.x, s.z, s.yaw), this.play('reach', 5, { needs: [name], target })];
  }

  benchEdge(bench) { // the near edge of the seat
    const g = this.g.pos;
    const dx = g.x - bench.x, dz = g.z - bench.z, len = Math.hypot(dx, dz) || 1;
    const ha = Math.abs(dx / len) * bench.w / 2 + Math.abs(dz / len) * bench.d / 2;
    return new THREE.Vector3(bench.x + (dx / len) * ha, 0.5, bench.z + (dz / len) * ha);
  }

  // The key under a note, in world space (the hand hovers just above it).
  keyWorld(midi) {
    const whites = this.whiteKeys ||= this.w.piano.keys.filter((k) => k.geometry.parameters.height === 0.04);
    const k = whites[clamp(Math.round(((midi - 36) / 60) * (whites.length - 1)), 0, whites.length - 1)];
    return k.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.03, 0));
  }

  // ---- Books ----
  // the shelf a book stands on: the main one, or a bookshelf that was built (rec.host)
  hostName(rec) { return rec && rec.host && this.obj(rec.host) ? rec.host : 'shelf'; }
  takeBook(book) {
    const shelf = this.obj('shelf');
    if (!shelf || (!shelf.books.includes(book) && !(shelf.albums || []).includes(book))) { this.queue = []; this.step = null; return; }   // it was forgotten on the way
    if (book.kind !== 'album') this.albumOnTable = false;   // a book in his hand is not a record standing by the stereo
    if (this.held && this.held !== book) this.held.mesh.visible = true;   // never lose a book he was still holding (it goes back on the shelf)
    this.held = book;
    sfx(book.kind === 'album' ? 'sleeve' : 'bookgrab');
    book.mesh.visible = false;
    if (book.stack && shelf.layoutStack) shelf.layoutStack();               // the rest of the stack settles
    if (book.kind === 'album') { this.albumMesh.userData.setArt(book.def); this.albumMesh.visible = true; }
    else { this.bookMesh.userData.setTitle(book.def.title, book.color); this.bookMesh.visible = true; }
  }

  returnBook() {
    if (this.held) { this.held.mesh.visible = true; sfx(this.held.kind === 'album' ? 'sleeve' : 'bookclose'); }
    const back = this.held, shelf = this.obj('shelf');
    this.held = null;
    if (back && back.stack && shelf && shelf.layoutStack) shelf.layoutStack();   // it goes back on top of the stack
    this.albumOnTable = false;
    this.bookMesh.visible = false;
    this.albumMesh.visible = false;
  }

  putBackStep() {
    return {
      type: 'plan',
      fn: () => {
        if (!this.held) return [];
        if (this.held.kind === 'album' && !this.music) this.albumOnTable = false;   // the music stopped: he picks the record up off the stereo
        if (!this.obj('shelf')) { this.returnBook(); return []; }
        return [this.walkAt(this.hostName(this.held), this.held.kind === 'album' || this.held.stack ? -0.5 : -0.62, this.held.z, Math.PI / 2), this.play('putBook', 2.4, { at: [1.3, () => this.returnBook()] })];
      },
    };
  }

  // Take a book off the shelf, read it in the armchair (or standing if the chair is out of reach), put it back.
  // Reading speed: 1x with no training, up to 2.5x with Speed Reading. While Speed Reading is being forgotten the factor (and how
  // often he reads at the shelf) falls gradually back to normal.
  readSpeed() { return 1 + 1.5 * this.skills.strength('speedreading'); }

  readSteps(only = null) {
    const shelf = this.obj('shelf');
    const top = shelf.stackTop ? shelf.stackTop() : null;           // from the stack beside the shelf he can only take the top book
    const books = only ? [only] : shelf.books.filter((b) => b.mesh.visible && (!b.stack || b === top));
    const unread = books.filter((b) => !this.skills.has(b.def.teaches));
    const book = pick(unread.length ? unread : books); // he is curious about the books he has not read yet
    const speed = this.readSpeed();
    const need = 8 / speed;                              // seconds with the pages open before it sinks in
    const atShelf = Math.random() < this.skills.strength('speedreading');   // a speed reader stays at the shelf
    const done = (st) => this.finishReading(book, st);
    const standing = [this.play('readStand', Math.max(rand(12, 18) / speed, need + 5.3), { need, reading: { delay: 0.5, lead: 1.2 }, onEnd: done })];
    const quick = [this.play('readStand', need + 5.6 + rand(0, 1), { need, reading: { delay: 0.4, lead: 1.0 }, onEnd: done })];   // take it, open it, close it
    const sitting = (c) => [
      this.walkAt(c.name, 0, c.sit.gap, Math.PI),
      this.play('readSit', Math.max(rand(25, 40) / speed, need + 7), { need, chairSit: true, chair: c.name, reading: { delay: 1.2, lead: 1.9 }, onEnd: done }),
    ];
    return [`${atShelf ? 'speed-reading' : 'reading'} "${book.def.title}"`,
      this.walkAt(this.hostName(book), book.stack ? -0.5 : -0.62, book.z, Math.PI / 2),            // closer to the stack: he squats to reach it
      this.play('grab', 2.6, { book, at: [0.95, () => this.takeBook(book)] }),
      {
        type: 'plan',
        fn: () => {
          if (atShelf) return quick;
          const c = this.pickChair();                     // any chair in the room he can get to
          return c ? sitting(c) : standing;
        },
      },
      this.putBackStep()];
  }

  // ---- Chairs: any armchair or chair in the room can be sat on ----
  chairs() { return Object.values(this.w.objects).filter((o) => o.sit); }

  // The chairs he can walk up to right now: the spot in front of the seat is inside the room and not blocked.
  openChairs() {
    const taken = this.other && (this.other.chairClaim || (this.other.step && this.other.step.fx && this.other.step.fx.chair));        // the other robot is sitting in it, or on the way to it
    return this.chairs().filter((c) => {
      if (taken && c.name === taken) return false;
      const l = c.local(0, c.sit.gap), x = c.x + l.x, z = c.z + l.z;
      const grid = makeGrid(this.w.obstacles, INFLATE, 0, c.obstacle);
      return Math.abs(x) < 4.5 && z > -3.5 && z < 3.6 && !cellBlocked(grid, x, z);
    });
  }

  // The chair the user pointed at (long-press > Sit Down), otherwise any open one.
  pickChair() {
    const open = this.openChairs();
    const wanted = this.activeChair && open.find((c) => c.name === this.activeChair);
    const c = wanted || (open.length ? pick(open) : null);
    this.chairClaim = c ? c.name : null;                          // (so the other robot picks a different one)
    return c;
  }

  // Walk to a chair (chosen when he gets there) and do `build(chair)` on it.
  chairStep(build, carry = false) {
    return {
      type: 'plan',
      fn: () => {
        const c = this.pickChair();
        if (!c) { this.queue.length = 0; return []; }
        const walk = this.walkAt(c.name, 0, c.sit.gap, Math.PI);
        if (carry) walk.fx = { guitar: true };               // he walks over with the guitar in his hands
        return [walk, ...build(c)];
      },
    };
  }

  // "Remove" on a book in the shelf list: it goes back to the catalog and nothing else changes (Guy keeps what he learned).
  removeBook(id) { return this.forgetBook(id, true); }

  // "Forget" on a book in the shelf list: it goes back to the catalog and what it taught starts to fade.
  forgetBook(id, keepSkill = false) {
    const shelf = this.obj('shelf');
    const rec = shelf && shelf.books.find((b) => b.def.id === id);
    if (!rec) return { ok: false, message: "That book isn't on the shelf." };
    if (this.held === rec) return { ok: false, message: 'Guy has that book in his hands right now.' };
    if (this.forceBook === rec) this.forceBook = null;
    const def = rec.def;
    shelf.removeBook(rec);
    if (keepSkill) return { ok: true, message: `"${def.title}" is back in the Catalog. Guy keeps everything he learned from it.` };
    const fading = this.skills.forget(def.teaches);
    return { ok: true, message: fading ? `"${def.title}" is back in the Catalog. Guy will gradually forget ${def.blurb}.` : `"${def.title}" is back in the Catalog.` };
  }

  // An order to use the Learning Workstation: learn the books a query points at (or all of them) at once, without the panel. Returns { ok, message }.
  learnOrder(query) {
    if (!this.obj('workstation')) return { ok: false, message: 'There is no workstation in the room.' };
    if (this.stuckIn()) return { ok: false, message: this.shutInMessage(this.stuckIn()) };
    const recs = findBooks(this.w, query), who = this.isGal ? 'GAL' : 'Guy';
    if (!recs.length) return { ok: false, message: query && query !== 'all' ? `There is no book about ${query} on the shelf.` : 'There are no books on the shelf.' };
    if (recs.every((r) => this.skills.has(r.def.teaches))) return { ok: false, message: query && query !== 'all' ? `${who} already knows that.` : `${who} already knows everything on the shelf.` };
    this.unlock(false); this.skip(true);
    this.learnPlan = { query: query == null ? 'all' : query };
    this.pendingActivity = 'learn';
    return { ok: true, message: `${who} will use the workstation.` };
  }

  // Closing a book he has read for long enough teaches him what is in it.
  finishReading(book, step) {
    if ((step.readOpen || 0) < ((step.fx && step.fx.need) ?? 8)) return;   // reading faster needs less time with the pages open
    const def = book.def;
    if (this.skills.learn(def.teaches)) {
      this.ui(`learned ${def.blurb}!`);
      if (this.onLearn) this.onLearn(def);
    }
  }

  rearrangeSteps() {
    // heavy things stay put; the bench only moves when Guy wants to sit at the piano
    const movers = Object.values(this.w.objects).filter((o) => o.weight !== 'heavy' && o.name !== 'bench');
    const weights = { plant: 1, lamp: 1, armchair: 1, table: 0.4, drums: 0.3 };
    for (let tries = 0; tries < 12; tries++) {
      let r = Math.random() * movers.reduce((t, o) => t + (weights[o.name] ?? 1), 0);
      const obj = movers.find((o) => (r -= weights[o.name] ?? 1) <= 0) || movers[0];
      const spot = this.freeObjectSpot(obj);
      if (!spot) continue;
      const steps = this.planPushVia(obj, spot.x, spot.z);
      if (steps) return [`moving the ${obj.name}`, ...steps, this.play('idle', 1.5)];
    }
    const p = this.freeSpot();
    return ['wandering', this.walk(p.x, p.z), this.play('idle', 2)];
  }

  // A random place where `obj` fits with room to walk around it and nothing Guy needs gets blocked.
  freeObjectSpot(obj) {
    const w = this.w;
    const anchors = [['piano', 0, 0.8], ['piano', 0, 0.95], ['table', 0, 0.55], ['lamp', 0.55, 0], ['shelf', -0.7, 0], ['drums', 0.55, 1.15], ['easel', 0, 0.8]]
      .filter(([n]) => this.obj(n))
      .map(([n, dx, dz]) => { const o = this.obj(n), l = o.local(dx, dz); return { x: o.x + l.x, z: o.z + l.z }; });
    for (let i = 0; i < 40; i++) {
      const x = rand(-5 + obj.w / 2 + 0.5, 5 - obj.w / 2 - 0.5), z = rand(-4 + obj.d / 2 + 0.5, 4 - obj.d / 2 - 0.5);
      const x0 = x - obj.w / 2 - 0.5, x1 = x + obj.w / 2 + 0.5, z0 = z - obj.d / 2 - 0.5, z1 = z + obj.d / 2 + 0.5;
      if (w.obstacles.some((o) => o !== obj.obstacle && x1 > o.x0 && x0 < o.x1 && z1 > o.z0 && z0 < o.z1)) continue;
      if (anchors.some((a) => a.x > x0 - 0.2 && a.x < x1 + 0.2 && a.z > z0 - 0.2 && a.z < z1 + 0.2)) continue;
      if (Math.abs(x) < obj.w / 2 + 1.5 && Math.abs(z - 0.4) < obj.d / 2 + 1.5) continue;   // the middle of the room is where he dances
      // the place he stands to use it must have room round it too
      const stand = { easel: [0, 0.8], drums: [0.55, 1.15] }[obj.name];
      if (stand) {
        const l = obj.local(stand[0], stand[1]), sx = x + l.x, sz = z + l.z;
        if (Math.abs(sx) > 4.2 || sz < -3.2 || sz > 3.4 || w.obstacles.some((o) => o !== obj.obstacle && sx > o.x0 - 0.6 && sx < o.x1 + 0.6 && sz > o.z0 - 0.6 && sz < o.z1 + 0.6)) continue;
      }
      if (Math.hypot(x - this.g.pos.x, z - this.g.pos.z) < 1.2) continue;
      return { x, z };
    }
    return null;
  }

  // One session at the stereo. Sometimes he fetches a record from the top shelf first, puts it on, and returns it at the end.
  stereoSession() {
    if (this.music) {                       // already playing (the user started it): no fetching records, no touching the stereo
      const t = this.nowPlaying();
      return { rec: null, track: this.track, title: t.title, pre: [], on: [], off: [], post: [], external: true };
    }
    const shelf = this.obj('shelf');
    const albums = shelf && shelf.albums ? shelf.albums.filter((a) => a.mesh.visible && TRACKS[a.def.track] && TRACKS[a.def.track].step) : [];
    // not the record he played last time if there is another to choose from
    const fresh = albums.filter((a) => a.def.id !== this.lastAlbumId);
    let rec = albums.length && !this.held && Math.random() < 0.75 ? pick(fresh.length ? fresh : albums) : null;
    if (this.forceAlbum) { rec = albums.find((a) => a.def.id === this.forceAlbum) || rec; this.forceAlbum = null; } // QA hook
    // and not the song he played last from that record: the record then carries on through its other songs by itself
    let track = 'default';
    if (rec) {
      const songs = (rec.def.tracks || [rec.def.track]).filter((id) => TRACKS[id] && TRACKS[id].step);
      const last = this.lastTrackOf && this.lastTrackOf[rec.def.id];
      track = pick(songs.filter((id) => id !== last).length ? songs.filter((id) => id !== last) : songs);
      this.lastAlbumId = rec.def.id;
    }
    const atStereo = () => this.walkAt('table', 0, 0.55, Math.PI);
    return {
      rec, track, title: rec ? rec.def.title : null,
      pre: rec ? [this.walkAt(this.hostName(rec), -0.5, rec.z, Math.PI / 2), this.play('grab', 2.6, { book: rec, at: [0.95, () => this.takeBook(rec)] })] : [],
      on: [atStereo(), this.play('reach', 1.8, { at: [0.9, () => { if (rec) this.albumOnTable = true; this.musicOn(track); }], target: () => this.stereoButton() })],
      off: [atStereo(), this.play('reach', 1.8, { at: [0.9, () => { this.musicOff(); this.albumOnTable = false; }], target: () => this.stereoButton() })],
      post: rec ? [this.putBackStep()] : [],
    };
  }

  stereoPiano(pose, label) {
    return [label, this.walkAt('table', 0, 0.55, Math.PI),
      this.play('reach', 1.8, { at: [0.9, () => this.musicOn()], target: () => this.stereoButton() }),
      this.benchAway(),
      this.walkAt('piano', 0, 0.8, Math.PI),
      this.play(pose, rand(32, 48), { piano: true, sync: true, gen: makeJam() }),
      this.walkAt('table', 0, 0.55, Math.PI),
      this.play('reach', 1.8, { at: [0.9, () => this.musicOff()], target: () => this.stereoButton() })];
  }

  // The music GAL turned on for a dance stays on until neither of them is dancing: the last one to finish switches it off.
  partyTail() {
    const g = this.w.gal;
    if (!g || !g.partyMusic || !this.music) return [];
    const o = this.other;
    if (o && o.step && o.step.fx && o.step.fx.dance) return [];
    g.partyMusic = false;
    return [this.walkAt('table', 0, 0.55, Math.PI), this.play('reach', 1.8, { at: [0.9, () => { this.musicOff(); this.albumOnTable = false; }], needs: ['table'], target: () => this.stereoButton() })];
  }

  waveSpot() { return { x: 0, z: 2.2 }; }

  // where he dances (GAL dances beside him, not on him)
  danceSpot() { return { x: 0, z: 0.4 }; }

  freeSpot() {
    for (let i = 0; i < 30; i++) {
      const p = { x: rand(-4.2, 4.2), z: rand(-3.2, 3.4) };
      if (!this.w.obstacles.some((o) => o.active !== false && p.x > o.x0 - 0.6 && p.x < o.x1 + 0.6 && p.z > o.z0 - 0.6 && p.z < o.z1 + 0.6)) return p;
    }
    return { x: 0, z: 1.5 };
  }

  // The nearest spot to (x, z) with room round it (no furniture within `margin` metres).
  openSpotNear(x, z, margin = 0.7) {
    const free = (px, pz) => Math.abs(px) < 4.2 && pz > -3.2 && pz < 3.4
      && !this.w.obstacles.some((o) => o.active !== false && px > o.x0 - margin && px < o.x1 + margin && pz > o.z0 - margin && pz < o.z1 + margin);
    if (free(x, z)) return { x, z };
    for (let r = 0.3; r < 4; r += 0.3) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (free(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  kickBall(dir, skilled = true) {
    const v = this.w.ball.userData.vel;
    v.copy(dir).multiplyScalar(skilled ? rand(4, 6.5) : rand(0.9, 1.6));
    v.y = skilled ? 1.5 : 0;
    sfx('kick', skilled ? 1 : 0.4);
  }

  // ---- keeping time with the others (every instrument that plays on a beat uses these two) ----
  // An instrument played on its own tempo publishes it (`publishTempo`); a player who has read the advanced book(s) of that instrument
  // (TIMING_SKILLS in skills.js) locks onto the stereo's beat, or onto the tempo the other robot is publishing (`tempoToFollow`).
  // With only the basic book the beat stays her own. A new instrument: add it to TIMING_SKILLS, call publishTempo when it plays a tempo
  // of its own, ask tempoToFollow when it starts a bar; sweepGal 6b checks every instrument in BAND (gal.js).
  publishTempo(t0, bl) { this.bandClock = { t0, bl, seen: this.time }; }
  isTight(inst) { return (TIMING_SKILLS[inst] || []).some((k) => this.skills.has(k)); }
  tempoToFollow(inst) {
    if (!this.isTight(inst)) return null;
    if (this.music) return { bl: this.beatLen, beat: this.currentBeat() };
    const clk = this.other && this.other.bandClock;
    return clk && this.other.time - clk.seen < 0.5 ? { bl: clk.bl, beat: (this.other.time - clk.t0) / clk.bl } : null;
  }

  currentBeat() { return this.music ? (performance.now() / 1000 - this.musicT0) / this.beatLen : this.time / BEAT; }

  musicOn(track = 'default', byUser = false) {
    if (this.music) return;
    this.userMusic = byUser;   // true when the user started it from the playback controls: Guy leaves it alone
    const playable = TRACKS[track] && TRACKS[track].step ? track : 'default';
    this.track = playable;
    this.beatLen = 60 / TRACKS[playable].bpm;
    this.music = playable === 'default' ? startBeat() : startTrack(playable);
    this.musicT0 = performance.now() / 1000 + 0.05;
    this.trackSince = this.time;                                                       // a record moves on to its next track after a minute or so
    this.trackFor = playable === 'default' ? Infinity : trackSeconds(TRACKS[playable]);
    const rec = this.albumOf(playable);
    if (rec) { this.lastTrackOf ||= {}; this.lastTrackOf[rec.id] = playable; }          // so the next time that record plays, it starts somewhere else
    this.w.boombox.led.material.color.set(0x22ff66);
    sfx('click');
  }

  // The record a track belongs to (and the track after it on that record, wrapping round to the first).
  albumOf(trackId) { return ALBUM_CATALOG.find((a) => a.tracks && a.tracks.includes(trackId)) || null; }
  nextOnAlbum(trackId) {
    const a = this.albumOf(trackId);
    if (!a) return null;
    const ids = a.tracks.filter((id) => TRACKS[id] && TRACKS[id].step);
    return ids.length > 1 ? ids[(ids.indexOf(trackId) + 1) % ids.length] : null;
  }

  // Switch to another track without stopping the session: whoever started the music still owns it, and anything he is playing
  // along on follows the new key and tempo.
  changeTrack(id) {
    const byUser = this.userMusic;
    this.musicOff();
    this.musicOn(id, byUser);
    const st = this.step;
    if (st && st.fx && st.fx.sync && st.fx.gen) { st.fx = { ...st.fx, gen: makeJam(TRACKS[this.track]) }; st.q = []; st.bar = undefined; }
    if (this.onStereoChange) this.onStereoChange();
  }

  // Called every frame: when a track has had its minute, play the next one on the same record.
  autoAdvance() {
    if (this.isGal) return;                           // the stereo is shared: Guy's brain moves it on
    if (!this.music || this.track === 'default' || this.time - this.trackSince < this.trackFor) return;
    const next = this.nextOnAlbum(this.track);
    if (next) this.changeTrack(next);
    else this.trackSince = this.time;                 // a one-track record just carries on
  }
  musicOff() {
    if (!this.music) return;
    this.music();
    this.music = null;
    this.userMusic = false;
    this.w.boombox.led.material.color.set(0x333333);
    sfx('click');
  }

  // ---- Playback controls (long-press the stereo): previous / play / stop / next ----
  // The playlist is the stereo's own beat plus every record that is on the shelf.
  trackList() {
    const shelf = this.obj('shelf');
    const albums = shelf && shelf.albums ? shelf.albums : [];
    const songs = albums.flatMap((a) => (a.def.tracks || [a.def.track]).filter((id) => TRACKS[id] && TRACKS[id].step).map((id) => ({ id, title: TRACKS[id].label, album: a.def.title })));
    return [{ id: 'default', title: 'Stereo beat', album: '' }, ...songs];
  }

  nowPlaying() {
    const list = this.trackList();
    const i = this.music ? Math.max(0, list.findIndex((t) => t.id === this.track)) : clamp(this.trackIndex ?? 0, 0, list.length - 1);
    return { playing: !!this.music, index: i, title: list[i].title, album: list[i].album, list };
  }

  stereoControl(action, id = null) {
    if (!this.obj('table')) return;
    const list = this.trackList();
    let i = this.music ? Math.max(0, list.findIndex((t) => t.id === this.track)) : clamp(this.trackIndex ?? 0, 0, list.length - 1);
    if (action === 'select') { const j = list.findIndex((t) => t.id === id); if (j >= 0) i = j; }
    if (action === 'next') i = (i + 1) % list.length;
    if (action === 'prev') i = (i - 1 + list.length) % list.length;
    this.trackIndex = i;
    if (action === 'stop') {
      const wasMine = this.userMusic;
      const dependent = this.step && this.step.fx && (this.step.fx.dance || this.step.fx.sync);
      this.musicOff();
      // whatever he was doing in time with the music is over
      if (dependent) this.skip();
      void wasMine;
    } else if (action === 'play') {
      if (!this.music) this.musicOn(list[i].id, true);
    } else if (action === 'select' && !this.music) {   // picked a record while the stereo is off: start it
      this.musicOn(list[i].id, true);
    } else if (this.music) {                      // next / previous / pick while playing: switch the track straight away
      this.userMusic = true;                      // he chose it, so the music is his now
      this.changeTrack(list[i].id);
    }
    if (this.onStereoChange) this.onStereoChange();
  }

  // Is the place he stands to use the drum kit or the easel inside the room and free? Pushed up against a wall (stool or easel side
  // to the wall) it is not, and he must not try to walk there.
  standOk(name) {
    const o = this.obj(name), own = { drums: [0.55, 1.15], easel: [0, 0.8] }[name];
    if (!o || !own) return true;
    const l = o.local(own[0], own[1]), x = o.x + l.x, z = o.z + l.z;
    if (Math.abs(x) > 4.4 || z < -3.5 || z > 3.6) return false;
    return !cellBlocked(makeGrid(this.w.obstacles, 0.05, 0, o.obstacle), x, z);       // not inside another object (furniture merely nearby is fine: he walks round it)
  }

  // Activities need their objects (removing one takes the activity away) and the skills he has learned.
  // The skills an activity depends on.
  skillNeeds(act) {
    return {
      dance: ['stereo'], dancemoves: ['dance.moves'], ballroom: ['dance.ballroom'], jam: ['stereo', 'piano'], jampiano: ['stereo', 'piano'], jamsit: ['stereo', 'piano'],
      piano: ['piano'], sitpiano: ['piano'], dribble: ['ball'], toss: ['ball'], mood: ['lighting'], guitar: ['guitar'], sitguitar: ['guitar'], riff: ['guitar'],
      drums: ['drums'], drumsolo: ['drums.solo'], jamdrums: ['drums.band'], paint: ['easel'], mixpaint: ['easel.colour'], portrait: ['easel.portrait'],
      stargaze: ['telescope'], darkstargaze: ['telescope.dark'], scopecare: ['telescope.care'], dust: ['decorate'], dusttop: ['decorate'],
      makewood: ['workshop.materials'], sawwood: ['workshop.materials'], sand: ['workshop.materials'], tap: ['workshop'], tidytools: ['workshop'],
      makemetal: ['workshop.metal'], cutmetal: ['workshop.metal'], hammer: ['workshop.metal'], weld: ['workshop.metal'],
      takeorder: ['restaurant'], cook: ['restaurant'], serve: ['restaurant'], takepay: ['restaurant'], rwait: ['restaurant'],
    }[act] || [];
  }

  available(act) {
    // shut in a room by a locked door: only what can be done in that room
    const shut = this.stuckIn();
    if (shut) return shut === 'workshop' ? WORK_ACTS.includes(act) && this.availableIn(act) : shut === 'restaurant' ? (REST_JOBS.includes(act) || act === 'rwait') && this.availableIn(act) : false;
    return this.availableIn(act);
  }
  availableIn(act) {
    if (act === 'learn') return !!this.obj('workstation') && this.inMain();         // the Learning Workstation (only when somebody asks: it has no weight)
    if (this.galBlocks && this.galBlocks(act)) return false;                // (GAL does not do some things; Guy needs GAL for others)
    if (this.busyElsewhere(this.exclusiveFor(act))) return false;           // the other robot is using it
    const need = {
      piano: ['piano'], sitpiano: ['piano', 'bench'], plink: ['piano'], jam: ['piano', 'table'], jampiano: ['piano', 'table'],
      slouch: ['drums'], jamsit: ['piano', 'bench', 'table'], stereoon: ['table'], stereooff: ['table'], dance: ['table'], dancemoves: ['table'], ballroom: ['table'], lamp: ['lamp'], mood: ['lamp'], read: ['shelf'], books: ['shelf'],
      bang: ['drums'], drums: ['drums'], drumsolo: ['drums'], jamdrums: ['drums'],
      scribble: ['easel'], paint: ['easel'], mixpaint: ['easel'], portrait: ['easel'],
      peek: ['telescope'], stargaze: ['telescope'], darkstargaze: ['telescope'], scopecare: ['telescope'], lighton: ['lamp'],
      makewood: ['woodfactory', 'workbench'], sawwood: ['saw', 'workbench'], tap: ['mallet'], sand: ['sander', 'workbench'], tidytools: ['toolbox'], build: ['workbench'],
      makemetal: ['metalfactory', 'workbench'], cutmetal: ['metalcutter', 'workbench'], hammer: ['anvil'], weld: ['welder'],
    }[act] || [];
    const skill = this.skillNeeds(act);
    // with the music already on he doesn't need to know how to work the stereo to join in
    if (!skill.filter((k) => !(k === 'stereo' && this.music)).every((k) => this.skills.has(k))) return false;
    if (act === 'jamguitar') { if (!this.music || !this.skills.has('guitar')) return false; }
    if (['guitar', 'riff', 'jamguitar', 'sitguitar'].includes(act) && !this.freeGuitar()) return false;           // (either guitar, if the other robot is not playing it)
    if (act === 'plink' && this.skills.has('piano')) return false;   // once he has had lessons he stops poking
    // without lessons he can only bang, scribble and peer the wrong way; once taught he stops
    if (act === 'bang' && ['drums', 'drums.solo', 'drums.band'].some((k) => this.skills.has(k))) return false;
    if (act === 'scribble' && ['easel', 'easel.colour', 'easel.portrait'].some((k) => this.skills.has(k))) return false;
    if (act === 'peek' && ['telescope', 'telescope.dark', 'telescope.care'].some((k) => this.skills.has(k))) return false;
    if (act === 'jamdrums' && !this.music) return false;
    if (act === 'lighton') return false;
    if (['sit', 'sitguitar'].includes(act) && !this.openChairs().length) return false;
    if (act === 'slouch' && !this.standOk('drums')) return false;
    if (act === 'stereoon' && this.music) return false;
    if (act === 'stereooff' && !this.music) return false;
    if (['bang', 'drums', 'drumsolo', 'jamdrums'].includes(act) && !this.standOk('drums')) return false;
    if (['scribble', 'paint', 'mixpaint', 'portrait'].includes(act) && !this.standOk('easel')) return false;
    if (act === 'plant' && !PLANT_NAMES.some((n) => this.obj(n))) return false;
    if (act === 'dust' && !Object.values(this.w.decor).some((d) => d.wall)) return false;
    if (act === 'dusttop' && !this.stoolJob()) return false;
    if (['ball', 'dribble', 'toss'].includes(act) && this.w.ballGone) return false;
    // both hands go out to the sides of the ball: not while it is jammed against furniture (he kicks it free first)
    if (['dribble', 'toss'].includes(act) && this.w.ball) {
      const b = this.w.ball.position;
      if (this.w.obstacles.some((o) => o.active !== false && b.x > o.x0 - 0.5 && b.x < o.x1 + 0.5 && b.z > o.z0 - 0.5 && b.z < o.z1 + 0.5)) return false;
    }
    if (act === 'putback' || act === 'dropball' || act === 'putguitar' || act === 'leave' || act === 'hangpaint' || act === 'putcanvas') return false;
    if (act === 'visit') return this.inMain() && Object.keys(this.w.doors).some((id) => !this.doorLockedFor(id));
    // the Workshop: it has to be added, and the stock has to allow it
    if (['makewood', 'sawwood', 'tap', 'sand', 'tidytools', 'build', 'makemetal', 'cutmetal', 'hammer', 'weld'].includes(act)) {
      const st = this.w.stock;
      if (!this.w.doors.workshop || this.doorLockedFor('workshop')) return false;
      if (act === 'makemetal' && (st.metal + METAL_PER_RUN > METAL_CAP || st.metal >= 8)) return false;
      if (act === 'cutmetal' && (st.metal < 1 || st.mparts + 2 > 8)) return false;
      if (act === 'makewood' && (st.wood + PLANKS_PER_RUN > STOCK_CAP || st.wood >= 12)) return false;
      if (act === 'sawwood' && (st.wood < 1 || st.parts + 2 > 8)) return false;
      if (act === 'sand' && st.wood < 1) return false;
      if (act === 'build') return !!this.pickRecipe() && need.every((n) => this.obj(n));
    }
    if (REST_JOBS.includes(act) || act === 'rwait') return this.restAvailable(act);
    if (act === 'read' && !this.obj('shelf').books.some((b) => b.mesh.visible)) return false;
    if (act === 'rearrange' && !Object.values(this.w.objects).some((o) => o.weight !== 'heavy' && o.name !== 'bench')) return false;
    return need.every((n) => this.obj(n));
  }

  // The objects only one robot can use at a time, for an activity.
  exclusiveFor(act) {
    const piano = ['sitpiano', 'piano', 'jam', 'jampiano', 'jamsit', 'plink'], drums = ['bang', 'drums', 'drumsolo', 'jamdrums', 'slouch'];
    const guitar = ['guitar', 'riff', 'jamguitar', 'sitguitar'], easel = ['scribble', 'paint', 'mixpaint', 'portrait'], scope = ['peek', 'stargaze', 'darkstargaze', 'scopecare'];
    if (act === 'dusttop') return ['stool'];
    if (piano.includes(act)) return act === 'sitpiano' || act === 'jamsit' ? ['piano', 'bench'] : ['piano'];
    if (drums.includes(act)) return ['drums'];
    if (guitar.includes(act)) return [];                                    // (the guitar he picks is marked when he picks it)
    if (easel.includes(act)) return ['easel'];
    if (scope.includes(act)) return ['telescope'];
    if (act === 'read' || act === 'books') return ['shelf'];                // one at a time at the bookshelf
    if (WORK_ACTS.includes(act)) return ['workshop'];                      // one at a time in the Workshop (the stations and the bench are shared)
    return [];
  }
  busyElsewhere(names) { const o = this.other; return !!o && names.some((n) => o.using && o.using.has(n)); }

  ballRemoved() {
    if (this.lock && this.lock.name === 'ball') this.unlock(false);
    if (this.last === 'ball') { this.queue = []; this.step = null; }
  }

  // Locked in on the guitar: he keeps it in his hands between songs and riffs, instead of putting it down and picking it up again.
  guitarLocked() { const o = this.lock && this.obj(this.lock.name); return !!(o && o.guitar); }
  // Steps to start playing: walk to the stand and pick the guitar up, unless he is already holding it.
  guitarBegin() {
    if (this.gtr.held && this.guitarLocked()) return [];
    this.pickGuitar();
    return [this.walkAt(this.gname, 0, 0.62, Math.PI), this.play('takeGuitar', 2.4, { guitar: true, at: [1.0, () => this.setGuitarHeld(true)] })];
  }
  // Steps to finish: put the guitar back on its stand, unless he is locked in on it (it stays in his hands for the next one).
  guitarEnd() {
    if (this.guitarLocked()) return [];
    return [this.play('putGuitar', 2.4, { guitar: true, at: [1.3, () => this.setGuitarHeld(false)] })];
  }

  // Is he in his own room (not in an added room or its doorway)?
  inMain() { return this.w.inMain(this.g.root.position.x, this.g.root.position.z); }

  // The user asked Guy to go through a door (or, from inside, to come back). Returns { ok, message }.
  visitRoom(id) {
    const d = this.w.doors[id];
    if (!d) return { ok: false, message: "There isn't a door like that." };
    const inside = !this.inMain();
    if (inside && this.stuckIn()) return { ok: false, message: this.shutInMessage(this.stuckIn()) };
    if (!inside && this.doorLockedFor(id)) return { ok: false, message: `The ${d.name} door is locked. Unlock it first (long-press the door).` };
    this.unlock(false);
    this.skip();
    this.visitId = id;
    this.pendingActivity = inside ? 'leave' : 'visit';
    return { ok: true, message: inside ? 'Guy is coming back.' : `Guy is going into the ${d.name}.` };
  }

  // ---- Lock in: keep using one object until the user says stop ----
  // The activities he cycles through while locked on `name` (only the ones he can do right now).
  lockActs(name) {
    const piano = ['sitpiano', 'piano', 'jamsit', 'jampiano', 'jam', 'plink'];
    const list = {
      piano, bench: piano,
      table: ['stereoon', 'dance', 'dancemoves', 'ballroom', 'jam', 'jamsit', 'jampiano', 'jamguitar', 'jamdrums'],
      shelf: ['read'], lamp: ['mood', 'lamp'], plant: ['plant'], flowerplant: ['plant'], tree: ['plant'],
      ball: ['dribble', 'toss', 'ball'], guitar: ['guitar', 'riff', 'jamguitar'], drums: ['bang', 'drums', 'drumsolo', 'jamdrums'],
      easel: ['scribble', 'paint', 'mixpaint', 'portrait'], telescope: ['peek', 'stargaze', 'darkstargaze', 'scopecare'],
      stove: REST_ACTS, kitchencounter: REST_ACTS, register: REST_ACTS, diningtable: REST_ACTS, diningtable2: REST_ACTS,
      workbench: ['build', 'makewood', 'sawwood'], toolbox: ['tidytools'], woodfactory: ['makewood'], saw: ['sawwood', 'makewood'], mallet: ['tap', 'build'], sander: ['sand', 'build'],
      metalfactory: ['makemetal'], metalcutter: ['cutmetal', 'makemetal'], welder: ['weld', 'build'], anvil: ['hammer', 'build'],
    }[name] || (this.obj(name) && this.obj(name).seats ? REST_ACTS : this.obj(name) && this.obj(name).guitar ? ['guitar', 'riff', 'jamguitar'] : this.obj(name) && this.obj(name).sit ? ['read', 'sit', 'sitguitar'] : []);
    return list.filter((a) => this.available(a));
  }

  // The user asked Guy to lock in on `name`. Returns { ok, message }.
  lockOn(name) {
    const had = this.lock;
    this.lock = null;
    const r = this.interact(name);                  // the same checks and messages as a plain Interact
    if (!r.ok) { this.lock = had; return r; }
    this.lock = { name };
    if (this.onLock) this.onLock(this.lock);
    return { ok: true, message: 'Guy will keep going until you tell him to stop.' };
  }

  // Let him go. `stop`: wrap up what he is doing now (the user told him to stop); otherwise he just finishes it.
  unlock(stop = true) {
    if (!this.lock) return false;
    this.lock = null;
    if (this.onLock) this.onLock(null);
    if (stop) this.skip();
    return true;
  }

  // The user removed `name`: drop whatever Guy was doing with it.
  objectRemoved(name) {
    if (this.lock && this.lock.name === name) this.unlock(false);
    if (name === 'table') { this.musicOff(); this.albumOnTable = false; }
    if (name === 'lamp') this.lampOffByMe = false;
    if (name === this.gname) { this.gtr.held = false; this.gtr.override = null; this.resetGuitarMesh(); }
    const s = this.step;
    const uses = (st) => st && ((st.fx && st.fx.needs && st.fx.needs.includes(name)) || (st.anchor && st.anchor.name === name) || (st.push && st.push.obj.name === name) || (st.fx && st.fx.sit && (name === 'piano' || name === 'bench')) || (st.fx && st.fx.chairSit && name === (st.fx.chair || 'armchair')) || (st.fx && st.fx.guitar && name === 'guitar') || (st.fx && st.fx.piano && name === 'piano') || (st.fx && (st.fx.drums || st.fx.sitDrum) && name === 'drums') || (st.fx && st.fx.paint && name === 'easel') || (st.fx && st.fx.scope && name === 'telescope'));
    if (uses(s) || this.queue.some(uses)) { this.queue = []; this.step = null; this.ui('wondering where the ' + name + ' went'); }
  }

  choose(force) {
    this.activeChair = force ? this.pendingChair || null : null; this.pendingChair = null;
    const acts = this.activities();
    // He is keen to read while there is still something to learn
    const shelf = this.obj('shelf');
    const unread = shelf ? shelf.books.filter((b) => b.mesh.visible && !this.skills.has(b.def.teaches)).length : 0;
    const weights = {
      wander: 3, sit: 0.7, sitguitar: 1.1, slouch: 0.5, dancemoves: 1.5, ballroom: 1.5, piano: 1, sitpiano: 1.2, plink: 1.4, dance: 1.8, jam: 0.9, jampiano: 0.5, jamsit: 0.9, lamp: 1.2, mood: 1.1,
      read: 1.8 + unread * 1.8, stretch: 1.3, wave: 0.7, ball: 2, dribble: 1.1, toss: 1.1, rearrange: 0.7, guitar: 1.6, riff: 1.0, plant: 0.6, jamguitar: 1.5, visit: 0.4,
      takeorder: 40, cook: 35, serve: 45, takepay: 50,
      build: 2.0, makewood: 0.5, sawwood: 0.6, tap: 0.5, sand: 0.4, tidytools: 0.4, makemetal: 0.5, cutmetal: 0.6, hammer: 0.5, weld: 0.4,
      bang: 1.3, drums: 1.6, drumsolo: 1.2, jamdrums: 1.5, scribble: 1.3, paint: 1.6, mixpaint: 1.3, portrait: 1.4,
      peek: 1.3, stargaze: 1.6, darkstargaze: 1.3, scopecare: 0.6, dust: 0.9, dusttop: 1.0,
    };
    if (this.extraWeights) Object.assign(weights, this.extraWeights());      // working with GAL, or (for GAL) inviting Guy
    // a skill that is being forgotten is used less and less
    for (const k of Object.keys(weights)) { const st = Math.min(1, ...this.skillNeeds(k).map((id) => this.skills.strength(id) || 1)); if (st < 1) weights[k] *= st; }
    // the music is on: he is in the mood to join in
    if (this.music) for (const k of ['dance', 'dancemoves', 'ballroom', 'jam', 'jampiano', 'jamsit', 'jamguitar', 'jamdrums']) weights[k] *= 2.5;
    // Activities that share a theme: Guy gets bored of doing the same kind of thing back to back
    const tags = {
      piano: ['piano'], sitpiano: ['piano'], jam: ['piano', 'stereo'], jampiano: ['piano', 'stereo'], jamsit: ['piano', 'stereo'],
      dance: ['stereo'], dancemoves: ['stereo'], ballroom: ['stereo'], lamp: ['fidget'], mood: ['fidget'], plant: ['fidget'], rearrange: ['fidget'], plink: ['piano'],
      ball: ['ball'], dribble: ['ball'], toss: ['ball'], guitar: ['guitar'], riff: ['guitar'], jamguitar: ['guitar', 'stereo'],
      bang: ['drums'], drums: ['drums'], drumsolo: ['drums'], jamdrums: ['drums', 'stereo'],
      sit: ['rest'], sitguitar: ['guitar'], slouch: ['drums', 'rest'],
      scribble: ['paint'], paint: ['paint'], mixpaint: ['paint'], portrait: ['paint'],
      peek: ['scope'], stargaze: ['scope'], darkstargaze: ['scope'], scopecare: ['scope', 'fidget'], dust: ['fidget'], dusttop: ['fidget'],
    };
    // the last two activities count, so he doesn't drift back to the same theme straight away
    const lastTags = [this.last, this.prev].flatMap((n) => tags[n] || []);
    this.restCleanup();                                      // cut short in the Restaurant: the dish goes back, the order waits again
    this.workCleanup();                                      // cut short in the Workshop: what he carries goes back in the stock
    let name = force;
    if (!name && !this.inMain() && !this.lockedInside() && !this.restStays() && !this.stuckIn()) name = 'leave';             // he is in an added room: back through the door before anything else
    if (!name && this.carry === 'canvas') name = 'putcanvas';                  // cut short with a painting in his hands: back to the easel with it
    if (!name && this.gtr.held && this.obj('guitar') && !this.guitarLocked()) name = 'putguitar'; // still holding the guitar: back on its stand (not while locked in on it)
    if (!name && this.lampOffByMe && this.obj('lamp') && !this.obj('lamp').on) name = 'lighton'; // he switched it off for the stars and never put it back
    if (!name && this.ballHeld) name = 'dropball'; // still holding the ball: put it down first
    // He's still carrying a book or record: take it back first. The one exception is a record that is really standing by the
    // stereo while its music plays (the session puts it away itself). A stuck flag must never excuse carrying a book around.
    const recordPlaying = this.held && this.held.kind === 'album' && this.albumOnTable && this.music;
    if (!name && this.held && !recordPlaying) name = 'putback';
    // Locked in on an object (long-press > Lock in): he keeps going back to it until the user tells him to stop. The chores above
    // (put the guitar back, drop the ball) still come first.
    if (!name && this.lock) {
      const L = this.lock, gone = L.name === 'ball' ? this.w.ballGone : !this.obj(L.name);
      const opts = gone ? [] : this.lockActs(L.name);
      if (!opts.length) { this.unlock(false); this.ui(gone ? `wondering where the ${L.name} went` : 'nothing more to do there'); }
      else {
        const fresh = opts.filter((a) => a !== this.last);
        name = pick(fresh.length ? fresh : opts);
        if (PLANT_NAMES.includes(L.name)) this.forcePlant = L.name;
        if (this.obj(L.name) && this.obj(L.name).sit) this.activeChair = L.name;
      }
    }
    if (!name && this.restStays()) name = this.restNext();             // customers about: he stays and looks after them
    if (!name) {
      const entries = Object.entries(weights)
        .filter(([k]) => this.available(k))
        .filter(([k]) => k !== this.last && !(k === 'rearrange' && this.time - this.lastRearrange < 180))
        .map(([k, v]) => [k, (tags[k] || []).some((t) => lastTags.includes(t)) ? v * 0.1 : v]);
      let r = Math.random() * entries.reduce((s, [, v]) => s + v, 0);
      for (const [k, v] of entries) { if ((r -= v) <= 0) { name = k; break; } }
      name ||= this.stuckIn() ? 'stuck' : 'wander';
    }
    if (name === 'rearrange') this.lastRearrange = this.time;
    this.prev = this.last;
    this.last = name;
    this.chairClaim = null;
    this.using = new Set(this.exclusiveFor(name));                  // so the other robot leaves those alone
    const [label, ...steps] = acts[name]();
    this.ui(this.lock ? `🔒 ${label}` : label);
    if (this.onStart) this.onStart(name);                          // (chatty mode: a short remark, voice.js)
    this.queue = steps;
    this.step = null;
  }

  // Objects a step has his hands on (or is sitting at): if the user drags or turns one, the arms would be pulled along with it.
  watchedNames(s) {
    const f = s.fx || {};
    const names = new Set(f.needs || []);
    if (s.type === 'play') {
      if (f.piano || f.sit) names.add('piano');
      if (f.drums || f.sitDrum) names.add('drums');
      if (f.paint) names.add('easel');
      if (f.scope) names.add('telescope');
      if (f.guitar) names.add(this.gname);
      if (f.chairSit) names.add(f.chair || 'armchair');
      if (f.work) names.add(f.work.obj);
      if (s.pose === 'grab' || s.pose === 'putBook') names.add(this.hostName(f.book || this.held));
    }
    return names;
  }

  // Returns true if the step was abandoned because something it uses was moved or turned by the user.
  checkMoved(s) {
    const names = this.watchedNames(s);
    if (!names.size) return false;
    const snap = (s.watch ||= {});
    for (const n of names) {
      const o = this.obj(n);
      if (!o) continue;
      const cur = [o.x, o.z, o.rot];
      if (!snap[n]) { snap[n] = cur; continue; }
      const moved = Math.hypot(cur[0] - snap[n][0], cur[1] - snap[n][1]) > 0.06 || cur[2] !== snap[n][2];
      if (!moved || (s.push && s.push.obj === o)) continue;
      this.ui(`the ${n} was moved: letting go`);
      this.skip();
      return !this.step;
    }
    return false;
  }

  // The user asked Guy to use something right now. Returns { ok, message }.
  interact(name) {
    const k = (id) => this.skills.has(id);
    const there = this.obj(name), rm = there && this.w.roomIdAt(there.x, there.z);
    if (rm && rm !== 'main' && rm !== 'door' && this.doorLockedFor(rm)) return { ok: false, message: `The ${this.w.doors[rm].name} door is locked. Unlock it first (long-press the door).` };
    if (this.stuckIn() && rm !== this.stuckIn()) return { ok: false, message: this.shutInMessage(this.stuckIn()) };        // shut in: only what is in the room with him
    let tries = {
      // with the stereo already playing, an instrument means playing along with it
      piano: k('piano') ? (this.music ? ['jamsit', 'jampiano', 'jam'] : ['sitpiano', 'piano']) : ['plink'],
      bench: k('piano') ? (this.music ? ['jamsit', 'jam'] : ['sitpiano', 'piano']) : ['plink'],
      table: this.music ? ['stereooff'] : ['stereoon'],
      shelf: ['read'],
      ...Object.fromEntries(this.chairs().map((c) => [c.name, ['sit']])),          // the menu says "Sit Down": he sits (reading in it is what he does when he fancies a book)
      lamp: k('lighting') ? ['mood', 'lamp'] : ['lamp'],
      plant: ['plant'], flowerplant: ['plant'], tree: ['plant'],
      ball: k('ball') ? ['dribble', 'toss', 'ball'] : ['ball'],
      guitar: k('guitar') ? (this.music ? ['jamguitar'] : ['guitar']) : [],
      drums: this.music && k('drums.band') ? ['jamdrums'] : ['bang', 'drums', 'drumsolo'],
      easel: ['scribble', 'paint', 'mixpaint', 'portrait'],
      telescope: ['peek', 'stargaze', 'darkstargaze', 'scopecare'],
      workbench: ['build'], toolbox: ['tidytools'], woodfactory: ['makewood'], saw: ['sawwood'], mallet: ['tap'], sander: ['sand'],
      metalfactory: ['makemetal'], metalcutter: ['cutmetal'], welder: ['weld'], anvil: ['hammer'],
      botprinter: ['buildbot'], workstation: ['learn'],
    }[name] || (this.obj(name) && this.obj(name).kind === 'footstool' ? ['dusttop'] : this.obj(name) && this.obj(name).guitar ? (k('guitar') ? (this.music ? ['jamguitar'] : ['guitar']) : []) : undefined);
    if (this.obj(name) && this.obj(name).guitar) this.wantGuitar = name;
    if (name === 'botprinter') {
      const g = this.w.gal;
      if (g && g.exists()) return { ok: false, message: 'GAL is already here: the machine can only be used once.' };
      if (!g || !g.g || !g.g.loaded) return { ok: false, message: 'GAL is still getting ready. Try again in a moment.' };
    }
    const wmsg = this.workRefusal(name) || this.restRefusal(name);
    if (wmsg) return { ok: false, message: wmsg };
    if (this.obj(name) && this.obj(name).kind === 'footstool') {
      if (!k('decorate')) return { ok: false, message: 'Guy does not know about looking after the room yet. Add the book "Home Decorating for Robots" to the shelf and he will read it.' };
      if (!this.stoolJob()) return { ok: false, message: 'There is no window top to clean right now.' };
    }
    if (name === 'table' && !k('stereo') && !this.music) return { ok: false, message: "Guy doesn't know how to use the stereo yet. Maybe there's a manual on the shelf." };
    if (this.obj(name) && this.obj(name).guitar && !k('guitar')) return { ok: false, message: "Guy hasn't learned the guitar yet. Add \"Guitar for Beginners\" to the shelf and he'll read it." };
    if ((name === 'drums' || name === 'easel') && !this.standOk(name)) {
      return { ok: false, message: name === 'drums' ? "Guy can't get to the drum stool where the kit is. Move it away from the wall." : "Guy can't get in front of the easel where it is. Move it away from the wall." };
    }
    if (REST_OBJECTS.includes(name) || (this.obj(name) && this.obj(name).seats)) tries = this.restTries(name);
    const act = (tries || []).filter((a) => this.available(a));
    if (!act.length) return { ok: false, message: "Guy can't do anything with that right now." };
    if (name === 'workstation') this.learnPlan = null;                  // (the panel, not an order)
    if (this.lock && this.lock.name !== name) this.unlock(false);     // told to do something else: the lock is over
    this.skip();                                   // stands up, switches the stereo off, etc. first
    if (PLANT_NAMES.includes(name)) this.forcePlant = name;   // the plant he was asked about, not just any plant
    this.pendingActivity = pick(act);
    this.pendingChair = this.obj(name) && this.obj(name).sit ? name : null;     // sit on the chair he was pointed at
    return { ok: true, message: 'On it!' };
  }

  // The user picked a book from the shelf list: Guy reads that one next.
  requestRead(id) {
    const shelf = this.obj('shelf');
    const book = shelf && shelf.books.find((b) => b.def.id === id && b.mesh.visible);
    if (!book) return { ok: false, message: "That book isn't on the shelf any more." };
    if (this.stuckIn()) return { ok: false, message: this.shutInMessage(this.stuckIn()) };
    this.unlock(false);                            // asked for something specific: the lock is over
    this.skip();
    this.forceBook = book;
    this.pendingActivity = 'read';
    return { ok: true, message: `Guy will read "${book.def.title}".` };
  }

  // Cut the current activity short. Nothing gets reset: Guy stands up if he was seated, and if the stereo is
  // still playing he walks over and switches it off himself.
  skip(keepMusic = false) {
    const s = this.step;
    this.queue = [];
    if (s && s.type === 'play' && s.fx.sit) {
      // stand up, then leave the gap the same way he came
      s.fx = { ...s.fx, piano: false };
      s.t = Math.max(s.t, s.dur - 1.6);
      const pp = this.obj('piano'), gl = pp.toLocal(this.g.pos.x - pp.x, this.g.pos.z - pp.z);
      this.queue.push(this.walkAt('piano', (gl.x > 0 ? 1 : -1) * 1.2, 0.95, null, true));
    } else if (s && s.type === 'play' && s.fx.sitDrum) {
      s.t = Math.max(s.t, s.dur - 2.6);                // puts the sticks down and stands up
      this.queue.push(this.walkAt('drums', 0.55, 1.15, null, true));
    } else if (s && s.type === 'play' && s.fx.paint) {
      const pl = s.fx.plan, Tp = s.t - (s.fx.startAt ?? 2.2);
      if (Tp < pl.painting) { pl.painting = Math.max(0, Tp); pl.admireStart = pl.painting + pl.ret; pl.total = pl.admireStart + 1.8; }
      s.dur = Math.min(s.dur, s.t + pl.ret + 2.4);
      this.queue.push(this.walkAt('easel', 0, 0.85, null, true));
    } else if (s && s.type === 'play' && s.fx.chairSit) {
      s.t = Math.max(s.t, s.dur - 1.0); // stand up where he is; the book goes back next
    } else this.step = null;
    if (!keepMusic && this.music && !this.userMusic && this.inMain()) this.queue.push(this.walkAt('table', 0, 0.55, Math.PI), this.play('reach', 1.8, { at: [0.9, () => { this.musicOff(); this.albumOnTable = false; }], target: () => this.stereoButton() }));
    this.ui('wrapping up');
  }

  // The animation loop must never die: if anything goes wrong mid-activity (an object removed from under him, say),
  // drop the activity, tidy up, and carry on.
  safeUpdate(dt) {
    try { this.update(dt); this.faults = 0; } catch (err) { console.error('Guy stumbled:', err); this.recover(); }
  }

  safeLate() {
    try { this.late(); } catch (err) { console.error('late() failed:', err); }
  }

  recover() {
    this.faults = (this.faults || 0) + 1;
    this.queue = [this.play('idle', this.faults > 3 ? 3 : 0.05)];
    this.step = null;
    this.pendingActivity = null;
    this.read = { open: 0, turning: false, turnT: 0, sheet: null };
    this.ballPos = null;
    this.gtr.override = null;
    if (!this.obj('table')) { this.musicOff(); this.albumOnTable = false; }
    this.ui('collecting himself');
  }

  update(dt) {
    this.time += dt;
    if (!this.isGal) {                    // (once a frame, by the first character: GAL's brain skips these)
      for (const d of Object.values(this.w.doors)) {            // a door that was locked while open shuts as soon as nobody is in the doorway
        if (!d.locked || !d.openTo) continue;
        const inDoorway = (br) => !!(br && br.g && this.w.roomIdAt(br.g.root.position.x, br.g.root.position.z) === 'door');
        if (!inDoorway(this) && !inDoorway(this.other)) d.openTo = 0;
      }
      this.w.updateDoors(dt);             // doors swing open and shut
      if (this.w.restaurant) this.w.restaurant.update(dt);      // customers arrive, order, eat and pay (customers.js)
      if (this.w.gal) this.w.gal.update(dt);                    // GAL, the second robot (gal.js)
    }
    if (this.w.paintings) this.w.paintings.update(dt);        // Guy's paintings: saved when they change, and put away ones filed in the Catalog
    this.skills.tick(dt);                 // skills whose book was forgotten fade away
    this.autoAdvance();
    const g = this.g;
    const root = g.root;
    if (!this.step) {
      let next = this.queue.shift();
      if (!next) {
        // an activity the user asked for takes priority, once whatever he is holding has been put away
        const wanted = this.pendingActivity;
        const holding = this.held || this.ballHeld || this.gtr.held;
        // (an activity back in his room waits until he is back in it: choose() sends him through the door first)
        if (wanted && !holding && (wanted === 'leave' || this.inMain())) { this.pendingActivity = null; this.choose(wanted); } else this.choose();
        next = this.queue.shift();
      }
      while (next && next.type === 'plan') {
        try { this.queue.unshift(...next.fn()); } catch (err) { this.queue.length = 0; this.lastPlanError = err; } // an object it needed is gone
        next = this.queue.shift();
      }
      this.step = next || this.play('idle', 0.05);
      this.step.t = 0;
      this.step.fired = false;
      this.stuckT = 0;
    }
    const s = this.step;
    if (this.checkMoved(s)) return;       // the user dragged or turned something he was using: he lets go
    // Whatever Guy is pushing or sitting on doesn't block him while he's doing it.
    for (const o of this.w.obstacles) o.active = true;
    if (this.selfOb) this.selfOb.active = false;             // the other robot is in his way; he is not
    if (s.push) s.push.obj.obstacle.active = false;
    if (s.fx && s.fx.sit) this.obj('bench').obstacle.active = false;
    if (s.fx && s.fx.chairSit && this.obj(s.fx.chair || 'armchair')) this.obj(s.fx.chair || 'armchair').obstacle.active = false;
    const hobby = this.hobbyAt(s);
    if (hobby && this.obj(hobby)) this.obj(hobby).obstacle.active = false;
    s.t += dt * (s.type === 'play' && s.pose === 'idle' ? this.speed : 1);     // pauses between interactions follow the speed control; interactions never do
    const k = this.speed;                                                      // so does walking (and pushing furniture)
    this.moving = false;
    let finished = false;

    if (s.type === 'walk') {
      if (!s.path) {
        if (s.anchor) {
          const o = this.obj(s.anchor.name);
          const l = o.local(s.anchor.dx, s.anchor.dz);
          s.x = o.x + l.x; s.z = o.z + l.z;
          if (s.anchor.yaw !== null) s.yaw = s.anchor.yaw + o.yaw;
        }
        if (s.push) {
          // only push if Guy is actually standing where he can reach the object
          const { obj, relx, relz } = s.push;
          if (Math.hypot(obj.x - root.position.x - relx, obj.z - root.position.z - relz) > 0.4) { this.queue.length = 0; s.path = []; finished = true; }
        }
        if (!finished) {
          // the grid of the room he is walking in: his own, or an added room when he and his goal are both in it
          const ra = this.w.roomIdAt(root.position.x, root.position.z), rb = this.w.roomIdAt(s.x, s.z);
          const fr = ra === rb && ra !== 'main' && ra !== 'door' ? this.w.frameOf(ra) : MAIN_FRAME;
          this.grid = makeGrid(this.w.obstacles, INFLATE, 0, null, fr);
          if (s.fx && s.fx.guitar) {                               // carrying the guitar sticks his hands out: give furniture more room when the way is clear
            const wide = makeGrid(this.w.obstacles, INFLATE + 0.14, 0, null, fr);
            if (!cellBlocked(wide, s.x, s.z) && !cellBlocked(wide, root.position.x, root.position.z)) this.grid = wide;
          }
          s.path = s.direct ? [{ x: s.x, z: s.z }] : findPath(this.grid, root.position.x, root.position.z, s.x, s.z);
        }
      }
      if (!finished) {
        let wp = s.path[0];
        while (s.path.length > 1 && Math.hypot(wp.x - root.position.x, wp.z - root.position.z) < 0.25) { s.path.shift(); wp = s.path[0]; }
        const dx = wp.x - root.position.x, dz = wp.z - root.position.z;
        const finalDist = Math.hypot(s.x - root.position.x, s.z - root.position.z);
        if (finalDist > 0.08) {
          const want = Math.atan2(dx, dz);
          this.turnTo(want, dt * k, 6);
          const facing = Math.abs(angDiff(want, root.rotation.y));
          const speed = clamp(finalDist * 2, 0.4, 1.25) * (facing < 0.8 ? 1 : 0.15) * (s.push ? s.push.spd / 1.1 : 1) * k;
          this.moveBy(Math.sin(root.rotation.y) * speed * dt, Math.cos(root.rotation.y) * speed * dt);
          if (s.push) { s.push.obj.set(root.position.x + s.push.relx, root.position.z + s.push.relz); sfxDrag(clamp(speed / 1.1, 0.25, 1), s.push.obj.weight); }   // furniture scraping along the floor
          else if (Math.floor(this.walkPhase / Math.PI) !== Math.floor((this.walkPhase + speed * dt * 5.2) / Math.PI)) sfx('step');
          this.walkPhase += speed * dt * 5.2;
          this.moving = true;
          this.stuckT += dt;
          if (this.stuckT > 25) finished = true;
          // Pressed against a wall, or circling something he cannot get past: if the distance still to walk along his path has not
          // got shorter by 20 cm in 5 s, give up on the walk and the activity it belongs to (instead of pushing on for 25 s).
          let rem = Math.hypot(wp.x - root.position.x, wp.z - root.position.z);
          for (let k = 1; k < s.path.length; k++) rem += Math.hypot(s.path[k].x - s.path[k - 1].x, s.path[k].z - s.path[k - 1].z);
          if (s.rem === undefined || rem < s.rem - 0.2) { s.rem = rem; s.remT = 0; }
          else if ((s.remT += dt) > 5) {
            finished = true;
            if (finalDist > (s.tol || 0)) { this.queue.length = 0; this.ui('could not get there'); }       // (a station's stand spot pressed against something a few centimetres short is close enough: s.tol)
          }
        } else if (s.yaw !== null && Math.abs(angDiff(s.yaw, root.rotation.y)) > 0.05) {
          this.turnTo(s.yaw, dt * k, 5);
          this.walkPhase += dt * 3 * k;
          this.moving = true; // shuffle feet while turning on the spot
        } else finished = true;
        if (finished && s.push) s.push.obj.set(s.x + s.push.relx, s.z + s.push.relz);
      }
    } else if (s.type === 'play') {
      if (s.fx.at && !s.fired && s.t >= s.fx.at[0]) { s.fired = true; s.fx.at[1](); }
      if (s.fx.sit) this.updateSit(s);
      if (s.fx.chairSit) this.updateChairSit(s);
      if (s.fx.sitDrum) this.updateDrumSit(s);
      if (s.fx.spin) root.rotation.y += s.fx.spin * dt * Math.min(1, s.t / 0.8, (s.dur - s.t) / 0.8 + 0.001);   // turning on the spot
      if (s.fx.paint) this.updatePaintStand(s);
      if (s.fx.stool) this.updateStool(s);
      if (s.fx.piano) this.updatePiano(dt, s);
      if (s.t >= s.dur) finished = true;
    }

    // Pose selection, then drive the skeleton
    g.sharp = 9;
    const poseName = s.type === 'walk' ? (this.moving ? 'walk' : 'idle') : s.pose;
    if (poseName !== this.pose) { this.pose = poseName; this.poseT = 0; }
    this.poseT += dt;
    const dur = s.type === 'play' ? s.dur : 1e9;
    const t = s.type === 'play' ? s.t : this.poseT;
    if (poseName === 'robot') g.sharp = 22;

    const beat = this.music ? (performance.now() / 1000 - this.musicT0) / this.beatLen : this.time / BEAT;
    const rd = s.type === 'play' && s.fx.reading;
    this.readBlend = rd ? readWeight(s.t, s.dur, rd.delay, rd.lead) : 0;
    this.updateReading(s);
    if (rd && this.read.open > 0.9) s.readOpen = (s.readOpen || 0) + dt;
    const ballState = this.computeBall(s);
    const guitarState = this.computeGuitar(s);
    const hobState = this.computeHobby(s, dt);
    // how much room his arms have: distance from him to the nearest piece of furniture
    let near = 9;
    for (const o of this.w.obstacles) {
      if (o.active === false) continue;
      const dx = Math.max(o.x0 - root.position.x, 0, root.position.x - o.x1), dz = Math.max(o.z0 - root.position.z, 0, root.position.z - o.z1);
      near = Math.min(near, Math.hypot(dx, dz));
    }
    const ctx = {
      armRoom: clamp((near - 0.3) / 0.35, 0, 1),
      haul: this.hauling && this.hauling.k > 0.6 ? this.haulHands() : null,
      tgt: this.bookTargets(s), readW: this.readBlend, read: this.read, ball: ballState, guitar: guitarState, hob: hobState,
      walkPhase: this.walkPhase, beat, hit: this.hit, sway: this.sway, music: !!this.music,
      carry: !!s.push, strain: s.push && s.push.obj.weight === 'medium' ? 1 : 0,
    };

    this.lastCtx = ctx;   // read by the QA pose-sanity sweep (src/devtools.js)
    g.clearTargets();
    basePose(g, this.time);
    POSES[poseName](g, t, dur, ctx);
    if (ctx.guitar && (poseName === 'walk' || poseName === 'idle')) guitarHands(g, ctx, 1);   // carrying the guitar between the stand and a chair
    this.hit.L = Math.max(0, this.hit.L - dt * 6);
    this.hit.R = Math.max(0, this.hit.R - dt * 6);

    if (finished) {
      if (s.fx && s.fx.onEnd) s.fx.onEnd(s);
      this.step = null;
    }
  }

  // Reading timeline for the current step: the book opens, a page is turned every few seconds, then it closes.
  updateReading(s) {
    const rd = s.type === 'play' && s.fx.reading;
    if (!rd) { this.read = { open: 0, turning: false, turnT: 0, sheet: null }; return; }
    const sm = (x) => smooth(clamp(x, 0, 1));
    const openStart = rd.delay + 0.9, closeStart = s.dur - rd.lead - 1.3;
    const open = sm((s.t - openStart) / 1.1) * (1 - sm((s.t - closeStart) / 1.0));
    const tn = (s.turn ||= { next: openStart + 3 + rand(0, 1.5), start: null });
    if (tn.start === null && open > 0.99 && s.t >= tn.next && s.t < closeStart - 3) tn.start = s.t;
    let turnT = 0, sheet = null;
    if (tn.start !== null) {
      turnT = s.t - tn.start;
      if (turnT >= 2.0) { tn.start = null; tn.next = s.t + rand(4.5, 7); turnT = 0; }
      else if (turnT > 0.35 && turnT < 1.15) sheet = Math.PI * sm((turnT - 0.4) / 0.7);
    }
    // sounds: the cover opens and closes, and the page rustles as it crosses
    const wasOpen = this._wasOpen || false;
    if (open > 0.5 && !wasOpen) { this._wasOpen = true; sfx('bookopen'); }
    else if (open < 0.4 && wasOpen) { this._wasOpen = false; sfx('bookclose'); }
    if (sheet !== null && !this._pageSound) { this._pageSound = true; sfx('page'); }
    else if (sheet === null) this._pageSound = false;
    this.read = { open, turning: tn.start !== null, turnT, sheet };
  }

  // World points the arms aim at: the book's slot on the shelf, Guy's side (carrying), and each edge of the open book.
  bookTargets(s) {
    const g = this.g, root = g.root;
    const t = { shelf: new THREE.Vector3(), carry: root.localToWorld(new THREE.Vector3(-0.2, 0.85, 0.1)) };
    const book = (s.fx && s.fx.book) || this.held;
    const shelf = this.obj(this.hostName(book));
    if (book && shelf) {
      const l = shelf.local(book.reachX ?? -0.2, book.z);
      t.shelf.set(shelf.x + l.x, book.y, shelf.z + l.z);
      s.shelfCache = t.shelf.clone();
    } else if (s.shelfCache) t.shelf.copy(s.shelfCache);   // the book has been let go (held is null): the slot stays where it was, so the arm eases back from it instead of reaching for the world origin
    // book-frame points -> world (the book floats at the reading anchor, tilted so the page faces his eyes)
    const fp = this.readAnchor();
    const fq = root.quaternion.clone().multiply(Q('x', 0.5));
    const F = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(fq).add(fp);
    const rd = this.read || { open: 0, turning: false, turnT: 0 };
    const edge = 0.085 + 0.085 * rd.open;                     // half-width of the open (or closed) book
    t.readL = F(edge - 0.012, -0.065, 0);                      // left hand steadies the spine side
    t.readR = F(-edge + 0.012, -0.065, 0);                     // right hand holds the outer edge...
    if (rd.turning) {                                          // ...or pinches the corner and sweeps it across
      const tt = rd.turnT, sm = (x) => smooth(clamp(x, 0, 1));
      const outer = -edge + 0.012;
      if (tt < 0.4) t.readR = F(lerp(outer, outer + 0.01, sm(tt / 0.4)), lerp(-0.065, -0.095, sm(tt / 0.4)), -0.004 * sm(tt / 0.4));
      else if (tt < 1.15) { const u = (tt - 0.4) / 0.75; t.readR = F(lerp(outer + 0.01, 0.12, sm(u)), -0.095, -(0.004 + 0.07 * Math.sin(Math.PI * u))); }
      else { const a2 = sm((tt - 1.15) / 0.5); t.readR = F(lerp(0.12, outer, a2), lerp(-0.095, -0.065, a2), -0.03 * (1 - a2)); }
    }
    if (s.fx && s.fx.target) { t.reach = s.fx.target(); t.reachDir = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y)); }
    if (s.fx && s.fx.piano && this.obj('piano')) {
      const hp = this.handPos ||= { L: null, R: null };
      const want = { L: this.keyWorld(this.handKey.L), R: this.keyWorld(this.handKey.R) };
      for (const h of ['L', 'R']) {
        if (!hp[h] || s.t < 0.05) hp[h] = want[h].clone();
        hp[h].lerp(want[h], 0.35);
        t['key' + h] = hp[h].clone().add(new THREE.Vector3(0, -0.022 * this.hit[h], 0));
      }
    }
    if (s.push) {
      const { obj, relx, relz } = s.push;
      const len = Math.hypot(relx, relz) || 1, dx = relx / len, dz = relz / len;
      const ha = Math.abs(dx) * obj.w / 2 + Math.abs(dz) * obj.d / 2;
      const face = new THREE.Vector3(obj.x - dx * ha, Math.min(obj.h * 0.92, 0.95), obj.z - dz * ha);
      const left = new THREE.Vector3(Math.cos(root.rotation.y), 0, -Math.sin(root.rotation.y));
      t.pushL = face.clone().addScaledVector(left, 0.22);
      t.pushR = face.clone().addScaledVector(left, -0.22);
    }
    return t;
  }

  // Where the open book floats while being read: in front of the chest, below the chin.
  readAnchor() {
    const root = this.g.root;
    const mid = this.g.boneWorld('LeftArm').add(this.g.boneWorld('RightArm')).multiplyScalar(0.5);
    const fwd = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    return mid.addScaledVector(fwd, 0.48).add(new THREE.Vector3(0, -0.15, 0));
  }

  // After the skeleton has been posed: keep the book gripped in his right hand, or floating in front of him when reading.
  // The book rides on the palm: its height runs along the fingers and its cover lies on the palm side of the hand.
  late() {
    const gt = this.obj(this.gname);
    this.updateStrap(gt && this.gtr.override && this.pose !== 'idle' ? this.gtr.override : null);
    if (gt && gt.guitar) {
      if (this.gtr.override) {
        const o = this.gtr.override;
        gt.group.updateWorldMatrix(true, false);
        gt.guitar.position.copy(gt.group.worldToLocal(o.pos.clone()));
        gt.guitar.quaternion.copy(gt.group.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.q));
        this.gtr.moved = true;
      } else if (this.gtr.moved) this.resetGuitarMesh();
    }
    const ball = this.w.ball;
    if (ball) {
      if (this.ballPos) { ball.position.copy(this.ballPos); ball.userData.vel.set(0, 0, 0); ball.userData.kinematic = true; }
      else ball.userData.kinematic = false;
    }
    if (!this.g.loaded) return;
    this.lateHobbies();
    if (this.albumMesh.visible) {
      const tb = this.obj('table');
      if (this.albumOnTable && tb) {               // standing against the side of the boombox
        tb.group.updateWorldMatrix(true, false);
        this.albumMesh.position.copy(tb.group.localToWorld(new THREE.Vector3(-0.5, 0.9, 0.1)));
        this.albumMesh.quaternion.copy(tb.group.getWorldQuaternion(new THREE.Quaternion()).multiply(Q('x', -0.12)));
      } else {                                     // carried by its top edge, hanging from his hand
        const g = this.g, root = g.root;
        const wrist = g.boneWorld('RightHand');
        const f = g.boneWorld('RightHandMiddle3').sub(wrist).normalize();
        const toThumb = g.boneWorld('RightHandThumb1').sub(wrist);
        const n = new THREE.Vector3().crossVectors(f, toThumb.addScaledVector(f, -toThumb.dot(f)).normalize()).normalize();
        const shelfSlot = (this.pose === 'grab' || this.pose === 'putBook') && this.step ? this.bookTargets(this.step).shelf : null;
        if (n.dot((shelfSlot || new THREE.Vector3(root.position.x, wrist.y, root.position.z)).sub(wrist)) < 0) n.negate();
        const x = new THREE.Vector3().crossVectors(f, n).normalize();
        this.albumMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, f, n));
        this.albumMesh.position.copy(wrist).addScaledVector(f, g.limb.Right.handLen * 0.55 + 0.155).addScaledVector(n, 0.045);
      }
    }
    if (!this.bookMesh.visible) return;
    const g = this.g, root = g.root;
    const wrist = g.boneWorld('RightHand');
    const f = g.boneWorld('RightHandMiddle3').sub(wrist).normalize();      // along the fingers
    const toThumb = g.boneWorld('RightHandThumb1').sub(wrist);
    const side = toThumb.addScaledVector(f, -toThumb.dot(f)).normalize();  // across the palm, towards the thumb
    const n = new THREE.Vector3().crossVectors(f, side).normalize();       // palm normal (sign fixed below)
    // the cover faces whatever he is reaching for (the shelf), otherwise his body
    const shelfSlot = (this.pose === 'grab' || this.pose === 'putBook') && this.step ? this.bookTargets(this.step).shelf : null;
    const focus = shelfSlot || new THREE.Vector3(root.position.x, wrist.y, root.position.z);
    if (n.dot(focus.sub(wrist)) < 0) n.negate();
    const x = new THREE.Vector3().crossVectors(f, n).normalize();
    const handQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, f, n));
    const inHand = wrist.clone().addScaledVector(f, g.limb.Right.handLen * 0.6).addScaledVector(n, 0.045);

    const fwd = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    const read = this.readAnchor();
    const w = this.readBlend;
    this.bookMesh.position.lerpVectors(inHand, read, w);
    const readQ = root.quaternion.clone().multiply(Q('x', 0.5)); // top edge tilted away so the page faces his eyes
    this.bookMesh.quaternion.copy(handQ).slerp(readQ, w);
    const rd = this.read || { open: 0, sheet: null };
    this.bookMesh.userData.setOpen(rd.open);
    this.bookMesh.userData.setSheet(rd.sheet);
    void fwd;
  }

  // Sitting in the armchair: step back onto it from the front, stand up again at the end.
  updateChairSit(s) {
    const c = this.obj(s.fx.chair || 'armchair'), root = this.g.root;
    if (!c || !c.sit) return;
    const sm = (x) => smooth(clamp(x, 0, 1));
    const T = s.t, D = s.dur, gap = c.sit.gap, seat = c.sit.seat;
    const z = T < 0.9 ? lerp(gap, seat, sm(T / 0.9)) : T < D - 0.9 ? seat : lerp(seat, gap, sm((T - (D - 0.9)) / 0.9));
    if (T >= 0.8 && !s.satSound) { s.satSound = true; sfx('sit', c.weight === 'light' ? 0.35 : 0.6); }
    const l = c.local(0, z);
    root.position.x = c.x + l.x;
    root.position.z = c.z + l.z;
    root.rotation.y = c.yaw + Math.PI;
  }

  // Sitting down: from the gap in front of the bench, lower back onto the seat, scoot the bench in towards the
  // keys (it moves because Guy shuffles it), and reverse all of that when standing up.
  updateSit(s) {
    const root = this.g.root, p = this.obj('piano'), bench = this.obj('bench');
    const sm = (x) => smooth(clamp(x, 0, 1));
    const T = s.t, D = s.dur;
    const gap = 0.95, seat1 = 1.6, seat2 = 1.0; // distances in front of the piano
    let z;
    if (T < 0.8) z = lerp(gap, seat1, sm(T / 0.8));
    else if (T < 1.6) z = lerp(seat1, seat2, sm((T - 0.8) / 0.8));
    else if (T < D - 1.6) z = seat2;
    else if (T < D - 0.8) z = lerp(seat2, seat1, sm((T - (D - 1.6)) / 0.8));
    else z = lerp(seat1, gap, sm((T - (D - 0.8)) / 0.8));
    if (T >= 0.8 && !s.satSound) { s.satSound = true; sfx('sit', 0.4); }
    const l = p.local(0, z), lb = p.local(0, z + 0.05);
    root.position.x = p.x + l.x;
    root.position.z = p.z + l.z;
    root.rotation.y = p.yaw + Math.PI;
    if (T >= 0.8 && T <= D - 0.8) bench.set(p.x + lb.x, p.z + lb.z);
  }

  updatePiano(dt, s) {
    const piano = this.w.piano;
    let beat;
    if (s.fx.sync) {
      // locked to the stereo: generate bars a little ahead of the beat
      beat = this.music && s.t >= (s.fx.startAt ?? 0) ? (performance.now() / 1000 - this.musicT0) / this.beatLen : -1;
      if (beat >= 0) {
        s.q ??= [];
        s.bar ??= Math.floor(beat / 4) + 1;
        while (s.bar * 4 < beat + 4) { for (const e of s.fx.gen(s.bar)) s.q.push({ ...e, beat: e.beat + s.bar * 4 }); s.bar++; }
      }
    } else {
      s.q ??= [...s.fx.song.events];
      const start = s.fx.startAt ?? 0.8, f = s.t >= start ? this.tempoToFollow('piano') : null;
      if (f) {                                   // a skilled player starts the piece on a downbeat of the tempo she is following and plays it at that tempo
        s.follow0 ??= Math.ceil(f.beat);
        beat = (f.beat - s.follow0) * (f.bl > 0 ? (s.fx.song.bpm * f.bl) / 60 : 1);
        this.keptTime = { inst: 'piano', mine: f.beat - s.follow0, ref: f.beat - s.follow0, bl: f.bl };     // (her bars are counted in the tempo she follows)
      } else {
        beat = ((s.t - start) * s.fx.song.bpm) / 60;
        if (!(s.fx.sync)) this.publishTempo(this.time - s.t + start, 60 / s.fx.song.bpm);
        if (s.t >= start) this.keptTime = { inst: 'piano', mine: beat, ref: null };
      }
    }
    while (beat >= 0 && s.q.length && s.q[0].beat <= beat) this.fireNotes(s.q.shift(), piano);
    piano.keys.forEach((k) => {
      k.position.y += ((k.userData.pressed ? k.userData.baseY - 0.012 : k.userData.baseY) - k.position.y) * Math.min(1, dt * 20);
    });
  }

  fireNotes(ev, piano) {
    const secs = (ev.dur || 1) * 0.5 + 0.3;
    if (ev.r) {
      for (const n of ev.r) { playNote(n, secs + 0.4, 0.2); this.pressKey(piano.keys, n); }
      this.handKey.R = ev.r[0];
      this.hit.R = 1;
      this.sway = (ev.r[0] - 72) / 7;
    }
    if (ev.l) {
      for (const n of ev.l) { playNote(n, secs + 0.8, 0.13); this.pressKey(piano.keys, n); }
      this.handKey.L = Math.max(ev.l[0], 48);
      this.hit.L = 1;
    }
  }

  pressKey(keys, midi) {
    const whites = keys.filter((k) => k.geometry.parameters.height === 0.04);
    const k = whites[clamp(Math.round(((midi - 36) / 60) * (whites.length - 1)), 0, whites.length - 1)];
    k.userData.pressed = true;
    clearTimeout(k.userData.timer);
    k.userData.timer = setTimeout(() => (k.userData.pressed = false), 200);
  }

  turnTo(yaw, dt, rate) {
    const r = this.g.root;
    const d = angDiff(yaw, r.rotation.y);
    r.rotation.y += clamp(d, -rate * dt, rate * dt);
  }

  moveBy(dx, dz) {
    const p = this.g.root.position;
    let nx = p.x + dx, nz = p.z + dz;
    // he stays inside his own room, an added room, or the doorway between them (while its door is open); at a wall he slides along it
    const ok = (x, z) => this.w.walkable(x, z);
    if (!ok(p.x, p.z)) { nx = clamp(nx, -4.5, 4.5); nz = clamp(nz, -3.5, 3.6); }          // he is somewhere he should not be: back into his room
    else if (!ok(nx, nz)) { if (ok(nx, p.z)) nz = p.z; else if (ok(p.x, nz)) nx = p.x; else { nx = p.x; nz = p.z; } }
    for (const o of this.w.obstacles) {
      if (o.active === false) continue;
      const m = 0.2;
      if (p.x > o.x0 - m && p.x < o.x1 + m && p.z > o.z0 - m && p.z < o.z1 + m) continue; // already overlapping (e.g. an object was dropped on him): let him walk out
      if (nx > o.x0 - m && nx < o.x1 + m && nz > o.z0 - m && nz < o.z1 + m) {
        // slide along whichever axis is still free
        if (!(p.x > o.x0 - m && p.x < o.x1 + m && nz > o.z0 - m && nz < o.z1 + m)) nx = p.x + dx, nz = p.z;
        else if (!(nx > o.x0 - m && nx < o.x1 + m && p.z > o.z0 - m && p.z < o.z1 + m)) nx = p.x, nz = p.z + dz;
        else nx = p.x, nz = p.z;
      }
    }
    p.x = nx; p.z = nz;
  }
}

// ---- Books ----
// Lamp moods the lighting book teaches.
const LAMP_LOOKS = [
  { name: 'warm and cosy', color: 0xffb870, base: 3.5 },
  { name: 'bright daylight', color: 0xe6f0ff, base: 9 },
  { name: 'romantic pink', color: 0xff7aa8, base: 4.5 },
  { name: 'moody blue', color: 0x6aa0ff, base: 5 },
  { name: 'forest green', color: 0x6fe08a, base: 5 },
];

// A record sleeve as carried: ~31 cm square, art on the front, a record peeking out would be overkill.
function makeHeldAlbum() {
  const side = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.7 });
  const front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.31, 0.008), [side, side, side, side, front, side]);
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.setArt = (def) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g2 = c.getContext('2d');
    const col = '#' + new THREE.Color(def.color).getHexString(), acc = '#' + new THREE.Color(def.accent).getHexString();
    const grad = g2.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, col); grad.addColorStop(1, '#101018');
    g2.fillStyle = grad; g2.fillRect(0, 0, 256, 256);
    g2.fillStyle = '#0a0a0e'; g2.beginPath(); g2.arc(128, 104, 66, 0, Math.PI * 2); g2.fill();
    g2.fillStyle = acc; g2.beginPath(); g2.arc(128, 104, 20, 0, Math.PI * 2); g2.fill();
    g2.fillStyle = '#fff'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    let size = 26; g2.font = `bold ${size}px sans-serif`;
    while (g2.measureText(def.title).width > 232 && size > 12) { size -= 1; g2.font = `bold ${size}px sans-serif`; }
    g2.fillText(def.title, 128, 202);
    g2.fillStyle = acc; g2.font = '15px sans-serif'; g2.fillText(def.genre, 128, 232);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    front.map = t;
    front.needsUpdate = true;
  };
  g.visible = false;
  return g;
}

// Paper with faint lines of text.
function paperTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#f1ead6';
  g.fillRect(0, 0, 128, 192);
  g.fillStyle = 'rgba(60,55,50,0.55)';
  for (let y = 16; y < 176; y += 9) {
    let x = 14;
    const end = 114 - (Math.random() < 0.2 ? Math.random() * 50 : 0);
    while (x < end) { const w = 6 + Math.random() * 16; g.fillRect(x, y, Math.min(w, end - x), 2.5); x += w + 3; }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The book as Guy holds it: a ~17 x 24 cm hardback that can open on a spine hinge and flip a page.
// Spine at x = 0 (the +x side is Guy's left while reading); pages extend towards -x. userData.setOpen(0..1), setSheet(angle|null).
function makeHeldBook() {
  const W = 0.17, H = 0.24;
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x884444, roughness: 0.7 });
  const pageMat = new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 0.9 });
  const box = (w, h, d, m, x, y, z, parent) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const root = new THREE.Group();
  const inner = new THREE.Group();   // slides so the book stays centred as it opens
  root.add(inner);
  box(W, H, 0.006, coverMat, -W / 2, 0, 0.0145, inner);                  // back cover (pages face -z, towards the reader)
  box(W - 0.012, H - 0.012, 0.011, pageMat, -W / 2, 0, 0.006, inner);    // right-hand pages
  box(0.007, H, 0.035, coverMat, 0.0035, 0, 0, inner);                   // spine
  const pivot = new THREE.Group();                                       // front cover + its pages, hinged at the spine
  inner.add(pivot);
  box(W, H, 0.006, coverMat, -W / 2, 0, -0.0135, pivot);
  box(W - 0.012, H - 0.012, 0.011, pageMat, -W / 2, 0, -0.005, pivot);
  const sheetPivot = new THREE.Group();                                  // the page being turned
  inner.add(sheetPivot);
  box(W - 0.014, H - 0.016, 0.0015, pageMat, -W / 2, 0, 0, sheetPivot);
  sheetPivot.visible = false;
  const setTitle = (title, color) => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 192;
    const g2 = c.getContext('2d');
    const col = '#' + new THREE.Color(color).getHexString();
    g2.fillStyle = col; g2.fillRect(0, 0, 128, 192);
    g2.strokeStyle = 'rgba(255,255,255,0.7)'; g2.lineWidth = 3; g2.strokeRect(8, 8, 112, 176);
    g2.fillStyle = '#fff'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.font = 'bold 17px sans-serif';
    const words = title.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) { if (g2.measureText((line + ' ' + w).trim()).width > 96) { lines.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    lines.push(line);
    lines.forEach((l, i) => g2.fillText(l, 64, 96 + (i - (lines.length - 1) / 2) * 22));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    coverMat.map = tex;
    coverMat.color.set(0xffffff);
    coverMat.needsUpdate = true;
  };
  root.userData = {
    cover: { material: coverMat }, setTitle,
    setOpen(f) { pivot.rotation.y = -Math.PI * f; inner.position.x = (W / 2) * (1 - f); },
    setSheet(angle) {
      sheetPivot.visible = angle !== null;
      if (angle !== null) { sheetPivot.rotation.y = -angle; sheetPivot.position.z = -0.0015; }
    },
  };
  root.visible = false;
  return root;
}

// ---- Grid A* around furniture ----
// A grid covers one room: Guy's own (the default) or an added room (world.frameOf). The grid remembers its frame (blocked.fr), so
// cellBlocked, lineClear and findPath work on either.
const CELL = 0.2, X0 = -4.6, Z0 = -3.6, NX = 47, NZ = 37, INFLATE = 0.28;
const MAIN_FRAME = { X0, Z0, NX, NZ };

function makeGrid(obstacles, inflate = INFLATE, wall = 0, skip = null, fr = MAIN_FRAME) {
  const { X0, Z0, NX, NZ } = fr;
  const blocked = new Uint8Array(NX * NZ);
  blocked.fr = fr;
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const x = X0 + i * CELL, z = Z0 + j * CELL;
      if (obstacles.some((o) => o !== skip && o.active !== false && x > o.x0 - inflate && x < o.x1 + inflate && z > o.z0 - inflate && z < o.z1 + inflate)) blocked[i + j * NX] = 1;
      else if (wall && (x < -ROOM.w / 2 + wall || x > ROOM.w / 2 - wall || z < -ROOM.d / 2 + wall || z > ROOM.d / 2 - wall)) blocked[i + j * NX] = 1;
    }
  }
  return blocked;
}

const cellBlocked = (blocked, x, z) => {
  const fr = blocked.fr || MAIN_FRAME;
  const i = clamp(Math.round((x - fr.X0) / CELL), 0, fr.NX - 1), j = clamp(Math.round((z - fr.Z0) / CELL), 0, fr.NZ - 1);
  return !!blocked[i + j * fr.NX];
};
function lineClear(blocked, a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1);
  for (let k = 0; k <= n; k++) if (cellBlocked(blocked, lerp(a.x, b.x, k / n), lerp(a.z, b.z, k / n))) return false;
  return true;
}

// strict: return null instead of a straight line when the goal is unreachable
function findPath(blocked, sx, sz, gx, gz, strict = false) {
  const { X0, Z0, NX, NZ } = blocked.fr || MAIN_FRAME;
  const cell = (x, z) => [clamp(Math.round((x - X0) / CELL), 0, NX - 1), clamp(Math.round((z - Z0) / CELL), 0, NZ - 1)];
  const nearestFree = ([ci, cj]) => {
    if (!blocked[ci + cj * NX]) return [ci, cj];
    for (let r = 1; r < 10; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < NX && j < NZ && !blocked[i + j * NX]) return [i, j];
    }
    return [ci, cj];
  };
  const [si, sj] = nearestFree(cell(sx, sz));
  const [gi, gj] = nearestFree(cell(gx, gz));
  const g = new Float32Array(NX * NZ).fill(Infinity);
  const from = new Int32Array(NX * NZ).fill(-1);
  const open = [[0, si + sj * NX]];
  g[si + sj * NX] = 0;
  const h = (i, j) => Math.hypot(i - gi, j - gj);
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, cur] = open.shift();
    const ci = cur % NX, cj = (cur / NX) | 0;
    if (ci === gi && cj === gj) break;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= NX || j >= NZ || blocked[i + j * NX]) continue;
      if (di && dj && (blocked[ci + di + cj * NX] || blocked[ci + (cj + dj) * NX])) continue;
      const ng = g[cur] + Math.hypot(di, dj);
      if (ng < g[i + j * NX]) { g[i + j * NX] = ng; from[i + j * NX] = cur; open.push([ng + h(i, j), i + j * NX]); }
    }
  }
  const pts = [];
  let c = gi + gj * NX;
  if (from[c] === -1 && !(gi === si && gj === sj)) return strict ? null : [{ x: gx, z: gz }];
  while (c !== -1) { pts.push({ x: X0 + (c % NX) * CELL, z: Z0 + ((c / NX) | 0) * CELL }); c = from[c]; }
  pts.reverse();
  // string-pull: drop waypoints that have a clear line of sight
  const clear = (a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1);
    for (let k = 0; k <= n; k++) {
      const [i, j] = cell(lerp(a.x, b.x, k / n), lerp(a.z, b.z, k / n));
      if (blocked[i + j * NX]) return false;
    }
    return true;
  };
  const out = [];
  let anchor = { x: sx, z: sz }, k = 0;
  while (k < pts.length) {
    let far = k;
    for (let m = pts.length - 1; m > k; m--) if (clear(anchor, pts[m])) { far = m; break; }
    out.push(pts[far]);
    anchor = pts[far];
    k = far + 1;
  }
  out.push({ x: gx, z: gz });
  return out;
}

function angDiff(a, b) {
  let d = a - b;
  if (!Number.isFinite(d)) return 0;                  // (a bad angle must never hang the loops below)
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

installHobbies(Brain, POSES, { sitLegs, env, smooth, clamp, lerp, rand, pick, makeGrid, cellBlocked, INFLATE });
installWorkshop(Brain, POSES, { smooth, clamp, lerp, rand, pick });
installRestaurant(Brain, POSES, { smooth, clamp, lerp, rand, pick });
installApproach(Brain);                                      // stations are used from whichever side is free (approach.js)
installPaintings(Brain);

export { ROOM, basePose, sitLegs, makeGrid, findPath, cellBlocked, MAIN_FRAME, INFLATE };
