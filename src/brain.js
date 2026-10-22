import * as THREE from 'three';
import { Q } from './guy.js';
import { playNote, playPluck, startBeat, startTrack, TRACKS, BEAT } from './audio.js';
import { ROOM } from './room.js';
import { randomSong, makeJam, plinkSong } from './songs.js';
import { installHobbies } from './hobbybrain.js';

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
    g.reach('Right', target, reachIn * fade, true, shelfGrip(g, ctx));   // handshake grip at mid height, palm to the shelf when reaching up
    g.curl('Right', 0.1 + 0.65 * smooth(clamp((t - 0.75) / 0.25, 0, 1)));
    g.set('Spine1', Q('x', 0.1 * reachIn * fade));
    g.set('Head', Q('x', 0.12 * reachIn * fade, 'y', -0.15 * reachIn * fade));
  },

  // The reverse: raise the book to its slot, let go, step back.
  putBook(g, t, dur, ctx) {
    const raise = smooth(clamp(t / 0.9, 0, 1));
    const retreat = smooth(clamp((t - 1.5) / 0.7, 0, 1));
    const target = new THREE.Vector3().lerpVectors(ctx.tgt.carry, ctx.tgt.shelf, raise);
    g.reach('Right', target, raise * (1 - retreat), true, shelfGrip(g, ctx));
    g.curl('Right', 0.75 - 0.65 * smooth(clamp((t - 1.25) / 0.3, 0, 1)));
    g.set('Spine1', Q('x', 0.1 * raise * (1 - retreat)));
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
          this.walk(0, 0.4, 0),
          this.play(pick(['disco', 'robot', 'pump']), 9, { dance: true }),
          this.play(pick(['disco', 'robot', 'pump']), 9, { dance: true }),
          this.play(pick(['disco', 'robot', 'pump']), 9, { dance: true }),
          this.play('wave', 2.2, { dance: true }),
          ...ss.off,
          ...(lights ? lampStep(() => w.lamp.setLook(0xffd9a0, 6)) : []),
          ...ss.post];
      },
      // the dance books: the same stereo session as `dance`, with new moves
      dancemoves: () => {
        const ss = this.stereoSession();
        return [ss.title ? `doing the twist to "${ss.title}"` : 'practising his new dance moves', ...ss.pre, ...ss.on,
          this.walk(0, 0.4, 0),
          this.play('twist', 9, { dance: true }), this.play('shuffle', 9, { dance: true }),
          this.play('twirl', 5, { dance: true, spin: 5.2 }), this.play(pick(['twist', 'shuffle']), 8, { dance: true }),
          this.play('wave', 2.2, { dance: true }), ...ss.off, ...ss.post];
      },
      ballroom: () => {
        const ss = this.stereoSession();
        return [ss.title ? `waltzing and swinging to "${ss.title}"` : 'waltzing round the room', ...ss.pre, ...ss.on,
          this.walk(0, 0.4, 0),
          this.play('waltz', 11, { dance: true, spin: 0.9 }), this.play('swing', 9, { dance: true }),
          this.play('waltz', 9, { dance: true, spin: -0.9 }), this.play('swing', 8, { dance: true, spin: 1.6 }),
          this.play('wave', 2.2, { dance: true }), ...ss.off, ...ss.post];
      },
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
      wave: () => ['waving at you', this.walk(0, 2.2, 0), this.play('wave', 3.5)],
      rearrange: () => this.rearrangeSteps(),
      plant: () => ['tending the plant', this.sideStep('plant', 0.62),
        this.play('reach', 2.6, { needs: ['plant'], target: () => this.plantLeaf() })],
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
      guitar: () => ['playing the guitar', this.walkAt('guitar', 0, 0.62, Math.PI),
        this.play('takeGuitar', 2.4, { guitar: true, at: [1.0, () => { this.gtr.held = true; }] }),
        this.play('guitar', 26, { guitar: true }),
        this.play('putGuitar', 2.4, { guitar: true, at: [1.3, () => { this.gtr.held = false; }] })],
      // the stereo is on: strum along in time and in the key of whatever is playing
      jamguitar: () => [`playing the guitar along with ${this.nowPlaying().title}`, this.walkAt('guitar', 0, 0.62, Math.PI),
        this.play('takeGuitar', 2.4, { guitar: true, at: [1.0, () => { this.gtr.held = true; }] }),
        this.play('guitar', rand(30, 45), { guitar: true, sync: true }),
        this.play('putGuitar', 2.4, { guitar: true, at: [1.3, () => { this.gtr.held = false; }] })],
      // he was interrupted while holding the guitar: take it back to its stand
      putguitar: () => ['putting the guitar back', this.walkAt('guitar', 0, 0.62, Math.PI),
        this.play('putGuitar', 2.4, { guitar: true, at: [1.3, () => { this.gtr.held = false; }] })],
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
  resetGuitarMesh() {
    const o = this.w.removed.guitar || this.obj('guitar');
    if (o && o.guitar) { o.guitar.position.copy(o.rest.pos); o.guitar.quaternion.copy(o.rest.quat); }
    this.gtr.moved = false;
  }

  // point in the guitar's own frame (neck along +x, soundboard facing +z) -> world
  gp(F, x, y, z) { return new THREE.Vector3(x, y, z).applyQuaternion(F.q).add(F.pos); }

  // Where the guitar is (on its stand, lifted, or held across his body) and where his hands go.
  computeGuitar(s) {
    this.gtr.override = null;
    const guitar = this.obj('guitar');
    if (s.type !== 'play' || !s.fx.guitar || !guitar) return null;
    const root = this.g.root, t = s.t, pose = s.pose;
    const sm = (x) => smooth(clamp(x, 0, 1));
    guitar.group.updateWorldMatrix(true, false);
    const rest = { pos: guitar.group.localToWorld(guitar.rest.pos.clone()), q: guitar.group.getWorldQuaternion(new THREE.Quaternion()).multiply(guitar.rest.quat) };
    // held high with the neck raised, so the fretting forearm runs up to the neck and the wrist bends no more than a wrist can (pose sweep: wrist <= 100 deg)
    const hold = { pos: root.localToWorld(new THREE.Vector3(-0.12, 1.05, 0.205)), q: root.quaternion.clone().multiply(Q('y', -0.3, 'z', 0.55)) };
    let blend = pose === 'guitar' ? 1 : pose === 'takeGuitar' ? sm((t - 1.0) / 0.9) : 1 - sm((t - 0.2) / 0.9);
    const cur = { pos: new THREE.Vector3().lerpVectors(rest.pos, hold.pos, blend), q: rest.q.clone().slerp(hold.q, blend) };
    this.gtr.override = cur;

    // strumming: eighth notes, a chord every bar (Am F C G)
    const st = this.gtr;
    if (pose === 'takeGuitar') { st.n = -1; st.yGoal = 0; st.fretGoal = 0; }
    if (pose === 'guitar') {
      let n, chord;
      if (s.fx.sync && this.music) { const b = this.currentBeat(); n = Math.floor(b * 2); chord = guitarChordAt(this.track, b); } // locked to the stereo
      else { n = Math.floor((t - 0.6) / 0.3); chord = GUITAR_CHORDS[Math.floor(n / 8) % GUITAR_CHORDS.length]; }
      if (n !== st.n && n >= 0) {
        st.n = n;
        const pat = 'D.DU.UDU'[n % 8];
        st.fretGoal = chord.fret;
        if (pat !== '.') {
          const notes = pat === 'D' ? chord.notes : [...chord.notes].reverse();
          notes.forEach((m, i) => playPluck(m, i * 0.018, 1.8, pat === 'D' ? 0.15 : 0.11));
          st.yGoal = pat === 'D' ? -0.1 : 0.07;
        }
      }
    }
    st.y += ((st.yGoal ?? 0) - st.y) * 0.35;
    st.fret += ((st.fretGoal ?? 0) - st.fret) * 0.15;

    const neckRest = this.gp(rest, 0.36, 0, 0.03);
    const neckNow = this.gp(cur, 0.36, 0, 0.03);
    const fretPt = this.gp(cur, 0.46 + st.fret, -0.12, -0.03);             // left WRIST under the neck (and a little behind it), beyond the body so the arm clears it
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
    out.leftHand = {
      fingers: new THREE.Vector3(0, 1, 0).applyQuaternion(cur.q).multiplyScalar(0.6).addScaledVector(out.axisX, 0.6).addScaledVector(out.axisZ, 0.35 * lp).normalize(),
      palm: out.axisZ.clone().multiplyScalar(lp),
    };
    out.fingersDir = new THREE.Vector3(0, -1, 0).applyQuaternion(cur.q).multiplyScalar(0.9).addScaledVector(out.axisZ, -0.4).normalize();
    out.cur = cur;
    out.beat = s.fx.sync && this.music ? this.currentBeat() : (t - 0.6) / 0.6;
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

  releaseBall() { this.ballHeld = false; }

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

  plantLeaf() { // a leaf near the top of the plant, on the side Guy stands
    const p = this.obj('plant'), g = this.g.pos;
    const dx = g.x - p.x, dz = g.z - p.z, len = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(p.x + (dx / len) * 0.1, 0.78, p.z + (dz / len) * 0.1);
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
  takeBook(book) {
    this.held = book;
    book.mesh.visible = false;
    if (book.kind === 'album') { this.albumMesh.userData.setArt(book.def); this.albumMesh.visible = true; }
    else { this.bookMesh.userData.setTitle(book.def.title, book.color); this.bookMesh.visible = true; }
  }

  returnBook() {
    if (this.held) this.held.mesh.visible = true;
    this.held = null;
    this.albumOnTable = false;
    this.bookMesh.visible = false;
    this.albumMesh.visible = false;
  }

  putBackStep() {
    return {
      type: 'plan',
      fn: () => {
        if (!this.held) return [];
        if (!this.obj('shelf')) { this.returnBook(); return []; }
        return [this.walkAt('shelf', this.held.kind === 'album' ? -0.5 : -0.62, this.held.z, Math.PI / 2), this.play('putBook', 2.4, { at: [1.3, () => this.returnBook()] })];
      },
    };
  }

  // Take a book off the shelf, read it in the armchair (or standing if the chair is out of reach), put it back.
  readSteps(only = null) {
    const shelf = this.obj('shelf');
    const books = only ? [only] : shelf.books.filter((b) => b.mesh.visible);
    const unread = books.filter((b) => !this.skills.has(b.def.teaches));
    const book = pick(unread.length ? unread : books); // he is curious about the books he has not read yet
    const chair = this.obj('armchair');
    const done = (st) => this.finishReading(book, st);
    const standing = [this.play('readStand', rand(12, 18), { reading: { delay: 0.5, lead: 1.2 }, onEnd: done })];
    const sitting = () => [
      this.walkAt('armchair', 0, -0.95, Math.PI),
      this.play('readSit', rand(25, 40), { chairSit: true, reading: { delay: 1.2, lead: 1.9 }, onEnd: done }),
    ];
    return [`reading "${book.def.title}"`,
      this.walkAt('shelf', -0.62, book.z, Math.PI / 2),
      this.play('grab', 2.6, { book, at: [0.95, () => this.takeBook(book)] }),
      {
        type: 'plan',
        fn: () => {
          const c = this.obj('armchair');
          if (!c) return standing;
          const l = c.local(0, -0.95), x = c.x + l.x, z = c.z + l.z;
          const grid = makeGrid(this.w.obstacles, INFLATE, 0, c.obstacle);
          const open = Math.abs(x) < 4.5 && z > -3.5 && z < 3.6 && !cellBlocked(grid, x, z);
          return open ? sitting() : standing;
        },
      },
      this.putBackStep()];
  }

  // Closing a book he has read for long enough teaches him what is in it.
  finishReading(book, step) {
    if ((step.readOpen || 0) < 8) return;
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
      if (Math.abs(x) < obj.w / 2 + 1.3 && Math.abs(z - 0.4) < obj.d / 2 + 1.3) continue;   // the middle of the room is where he dances
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
    let rec = albums.length && !this.held && Math.random() < 0.75 ? pick(albums) : null;
    if (this.forceAlbum) { rec = albums.find((a) => a.def.id === this.forceAlbum) || rec; this.forceAlbum = null; } // QA hook
    const track = rec ? rec.def.track : 'default';
    const atStereo = () => this.walkAt('table', 0, 0.55, Math.PI);
    return {
      rec, track, title: rec ? rec.def.title : null,
      pre: rec ? [this.walkAt('shelf', -0.5, rec.z, Math.PI / 2), this.play('grab', 2.6, { book: rec, at: [0.95, () => this.takeBook(rec)] })] : [],
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

  freeSpot() {
    for (let i = 0; i < 30; i++) {
      const p = { x: rand(-4.2, 4.2), z: rand(-3.2, 3.4) };
      if (!this.w.obstacles.some((o) => o.active !== false && p.x > o.x0 - 0.6 && p.x < o.x1 + 0.6 && p.z > o.z0 - 0.6 && p.z < o.z1 + 0.6)) return p;
    }
    return { x: 0, z: 1.5 };
  }

  kickBall(dir, skilled = true) {
    const v = this.w.ball.userData.vel;
    v.copy(dir).multiplyScalar(skilled ? rand(4, 6.5) : rand(0.9, 1.6));
    v.y = skilled ? 1.5 : 0;
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
    this.w.boombox.led.material.color.set(0x22ff66);
  }
  musicOff() {
    if (!this.music) return;
    this.music();
    this.music = null;
    this.userMusic = false;
    this.w.boombox.led.material.color.set(0x333333);
  }

  // ---- Playback controls (long-press the stereo): previous / play / stop / next ----
  // The playlist is the stereo's own beat plus every record that is on the shelf.
  trackList() {
    const shelf = this.obj('shelf');
    const albums = shelf && shelf.albums ? shelf.albums.filter((a) => TRACKS[a.def.track] && TRACKS[a.def.track].step) : [];
    return [{ id: 'default', title: 'Stereo beat' }, ...albums.map((a) => ({ id: a.def.track, title: a.def.title }))];
  }

  nowPlaying() {
    const list = this.trackList();
    const i = this.music ? Math.max(0, list.findIndex((t) => t.id === this.track)) : clamp(this.trackIndex ?? 0, 0, list.length - 1);
    return { playing: !!this.music, index: i, title: list[i].title, list };
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
      this.musicOff();
      this.musicOn(list[i].id, true);
      // anything he is playing along on follows the new key and tempo
      const st = this.step;
      if (st && st.fx && st.fx.sync && st.fx.gen) { st.fx = { ...st.fx, gen: makeJam(TRACKS[this.track]) }; st.q = []; st.bar = undefined; }
    }
    if (this.onStereoChange) this.onStereoChange();
  }

  // Activities need their objects (removing one takes the activity away) and the skills he has learned.
  available(act) {
    const need = {
      piano: ['piano'], sitpiano: ['piano', 'bench'], plink: ['piano'], jam: ['piano', 'table'], jampiano: ['piano', 'table'],
      jamsit: ['piano', 'bench', 'table'], dance: ['table'], dancemoves: ['table'], ballroom: ['table'], lamp: ['lamp'], mood: ['lamp'], read: ['shelf'], books: ['shelf'],
      guitar: ['guitar'], jamguitar: ['guitar'], plant: ['plant'],
      bang: ['drums'], drums: ['drums'], drumsolo: ['drums'], jamdrums: ['drums'],
      scribble: ['easel'], paint: ['easel'], mixpaint: ['easel'], portrait: ['easel'],
      peek: ['telescope'], stargaze: ['telescope'], darkstargaze: ['telescope'], scopecare: ['telescope'], lighton: ['lamp'],
    }[act] || [];
    const skill = {
      dance: ['stereo'], dancemoves: ['dance.moves'], ballroom: ['dance.ballroom'], jam: ['stereo', 'piano'], jampiano: ['stereo', 'piano'], jamsit: ['stereo', 'piano'],
      piano: ['piano'], sitpiano: ['piano'], dribble: ['ball'], toss: ['ball'], mood: ['lighting'], guitar: ['guitar'],
      drums: ['drums'], drumsolo: ['drums.solo'], jamdrums: ['drums.band'], paint: ['easel'], mixpaint: ['easel.colour'], portrait: ['easel.portrait'],
      stargaze: ['telescope'], darkstargaze: ['telescope.dark'], scopecare: ['telescope.care'],
    }[act] || [];
    // with the music already on he doesn't need to know how to work the stereo to join in
    if (!skill.filter((k) => !(k === 'stereo' && this.music)).every((k) => this.skills.has(k))) return false;
    if (act === 'jamguitar') { if (!this.music || !this.skills.has('guitar') || !this.obj('guitar')) return false; }
    if (act === 'plink' && this.skills.has('piano')) return false;   // once he has had lessons he stops poking
    // without lessons he can only bang, scribble and peer the wrong way; once taught he stops
    if (act === 'bang' && ['drums', 'drums.solo', 'drums.band'].some((k) => this.skills.has(k))) return false;
    if (act === 'scribble' && ['easel', 'easel.colour', 'easel.portrait'].some((k) => this.skills.has(k))) return false;
    if (act === 'peek' && ['telescope', 'telescope.dark', 'telescope.care'].some((k) => this.skills.has(k))) return false;
    if (act === 'jamdrums' && !this.music) return false;
    if (act === 'lighton') return false;
    if (['ball', 'dribble', 'toss'].includes(act) && this.w.ballGone) return false;
    // both hands go out to the sides of the ball: not while it is jammed against furniture (he kicks it free first)
    if (['dribble', 'toss'].includes(act) && this.w.ball) {
      const b = this.w.ball.position;
      if (this.w.obstacles.some((o) => o.active !== false && b.x > o.x0 - 0.5 && b.x < o.x1 + 0.5 && b.z > o.z0 - 0.5 && b.z < o.z1 + 0.5)) return false;
    }
    if (act === 'putback' || act === 'dropball' || act === 'putguitar') return false;
    if (act === 'read' && !this.obj('shelf').books.some((b) => b.mesh.visible)) return false;
    if (act === 'rearrange' && !Object.values(this.w.objects).some((o) => o.weight !== 'heavy' && o.name !== 'bench')) return false;
    return need.every((n) => this.obj(n));
  }

  ballRemoved() {
    if (this.last === 'ball') { this.queue = []; this.step = null; }
  }

  // The user removed `name`: drop whatever Guy was doing with it.
  objectRemoved(name) {
    if (name === 'table') { this.musicOff(); this.albumOnTable = false; }
    if (name === 'lamp') this.lampOffByMe = false;
    if (name === 'guitar') { this.gtr.held = false; this.gtr.override = null; this.resetGuitarMesh(); }
    const s = this.step;
    const uses = (st) => st && ((st.fx && st.fx.needs && st.fx.needs.includes(name)) || (st.anchor && st.anchor.name === name) || (st.push && st.push.obj.name === name) || (st.fx && st.fx.sit && (name === 'piano' || name === 'bench')) || (st.fx && st.fx.chairSit && name === 'armchair') || (st.fx && st.fx.guitar && name === 'guitar') || (st.fx && st.fx.piano && name === 'piano') || (st.fx && st.fx.drums && name === 'drums') || (st.fx && st.fx.paint && name === 'easel') || (st.fx && st.fx.scope && name === 'telescope'));
    if (uses(s) || this.queue.some(uses)) { this.queue = []; this.step = null; this.ui('wondering where the ' + name + ' went'); }
  }

  choose(force) {
    const acts = this.activities();
    // He is keen to read while there is still something to learn
    const shelf = this.obj('shelf');
    const unread = shelf ? shelf.books.filter((b) => b.mesh.visible && !this.skills.has(b.def.teaches)).length : 0;
    const weights = {
      wander: 3, dancemoves: 1.5, ballroom: 1.5, piano: 1, sitpiano: 1.2, plink: 1.4, dance: 1.8, jam: 0.9, jampiano: 0.5, jamsit: 0.9, lamp: 1.2, mood: 1.1,
      read: 1.8 + unread * 1.8, stretch: 1.3, wave: 0.7, ball: 2, dribble: 1.1, toss: 1.1, rearrange: 0.7, guitar: 1.6, plant: 0.6, jamguitar: 1.5,
      bang: 1.3, drums: 1.6, drumsolo: 1.2, jamdrums: 1.5, scribble: 1.3, paint: 1.6, mixpaint: 1.3, portrait: 1.4,
      peek: 1.3, stargaze: 1.6, darkstargaze: 1.3, scopecare: 0.6,
    };
    // the music is on: he is in the mood to join in
    if (this.music) for (const k of ['dance', 'dancemoves', 'ballroom', 'jam', 'jampiano', 'jamsit', 'jamguitar', 'jamdrums']) weights[k] *= 2.5;
    // Activities that share a theme: Guy gets bored of doing the same kind of thing back to back
    const tags = {
      piano: ['piano'], sitpiano: ['piano'], jam: ['piano', 'stereo'], jampiano: ['piano', 'stereo'], jamsit: ['piano', 'stereo'],
      dance: ['stereo'], dancemoves: ['stereo'], ballroom: ['stereo'], lamp: ['fidget'], mood: ['fidget'], plant: ['fidget'], rearrange: ['fidget'], plink: ['piano'],
      ball: ['ball'], dribble: ['ball'], toss: ['ball'], guitar: ['guitar'], jamguitar: ['guitar', 'stereo'],
      bang: ['drums'], drums: ['drums'], drumsolo: ['drums'], jamdrums: ['drums', 'stereo'],
      scribble: ['paint'], paint: ['paint'], mixpaint: ['paint'], portrait: ['paint'],
      peek: ['scope'], stargaze: ['scope'], darkstargaze: ['scope'], scopecare: ['scope', 'fidget'],
    };
    // the last two activities count, so he doesn't drift back to the same theme straight away
    const lastTags = [this.last, this.prev].flatMap((n) => tags[n] || []);
    let name = force;
    if (!name && this.gtr.held && this.obj('guitar')) name = 'putguitar'; // still holding the guitar: back on its stand
    if (!name && this.lampOffByMe && this.obj('lamp') && !this.obj('lamp').on) name = 'lighton'; // he switched it off for the stars and never put it back
    if (!name && this.ballHeld) name = 'dropball'; // still holding the ball: put it down first
    if (!name && this.held && !this.albumOnTable) name = 'putback'; // he's still carrying a book or record: take it back first
    if (!name) {
      const entries = Object.entries(weights)
        .filter(([k]) => this.available(k))
        .filter(([k]) => k !== this.last && !(k === 'rearrange' && this.time - this.lastRearrange < 180))
        .map(([k, v]) => [k, (tags[k] || []).some((t) => lastTags.includes(t)) ? v * 0.1 : v]);
      let r = Math.random() * entries.reduce((s, [, v]) => s + v, 0);
      for (const [k, v] of entries) { if ((r -= v) <= 0) { name = k; break; } }
      name ||= 'wander';
    }
    if (name === 'rearrange') this.lastRearrange = this.time;
    this.prev = this.last;
    this.last = name;
    const [label, ...steps] = acts[name]();
    this.ui(label);
    this.queue = steps;
    this.step = null;
  }

  // The user asked Guy to use something right now. Returns { ok, message }.
  interact(name) {
    const k = (id) => this.skills.has(id);
    const tries = {
      // with the stereo already playing, an instrument means playing along with it
      piano: k('piano') ? (this.music ? ['jamsit', 'jampiano', 'jam'] : ['sitpiano', 'piano']) : ['plink'],
      bench: k('piano') ? (this.music ? ['jamsit', 'jam'] : ['sitpiano', 'piano']) : ['plink'],
      table: k('stereo') || this.music || k('dance.moves') || k('dance.ballroom') ? ['dance', 'dancemoves', 'ballroom', 'jam', 'jampiano'] : [],
      shelf: ['read'],
      armchair: ['read'],
      lamp: k('lighting') ? ['mood', 'lamp'] : ['lamp'],
      plant: ['plant'],
      ball: k('ball') ? ['dribble', 'toss', 'ball'] : ['ball'],
      guitar: k('guitar') ? (this.music ? ['jamguitar'] : ['guitar']) : [],
      drums: this.music && k('drums.band') ? ['jamdrums'] : ['bang', 'drums', 'drumsolo'],
      easel: ['scribble', 'paint', 'mixpaint', 'portrait'],
      telescope: ['peek', 'stargaze', 'darkstargaze', 'scopecare'],
    }[name];
    if (name === 'table' && !k('stereo') && !this.music && !k('dance.moves') && !k('dance.ballroom')) return { ok: false, message: "Guy doesn't know how to use the stereo yet. Maybe there's a manual on the shelf." };
    if (name === 'guitar' && !k('guitar')) return { ok: false, message: "Guy hasn't learned the guitar yet. Add \"Guitar for Beginners\" to the shelf and he'll read it." };
    const act = (tries || []).filter((a) => this.available(a));
    if (!act.length) return { ok: false, message: "Guy can't do anything with that right now." };
    this.skip();                                   // stands up, switches the stereo off, etc. first
    this.pendingActivity = pick(act);
    return { ok: true, message: 'On it!' };
  }

  // The user picked a book from the shelf list: Guy reads that one next.
  requestRead(id) {
    const shelf = this.obj('shelf');
    const book = shelf && shelf.books.find((b) => b.def.id === id && b.mesh.visible);
    if (!book) return { ok: false, message: "That book isn't on the shelf any more." };
    this.skip();
    this.forceBook = book;
    this.pendingActivity = 'read';
    return { ok: true, message: `Guy will read "${book.def.title}".` };
  }

  // Cut the current activity short. Nothing gets reset: Guy stands up if he was seated, and if the stereo is
  // still playing he walks over and switches it off himself.
  skip() {
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
    if (this.music && !this.userMusic) this.queue.push(this.walkAt('table', 0, 0.55, Math.PI), this.play('reach', 1.8, { at: [0.9, () => { this.musicOff(); this.albumOnTable = false; }], target: () => this.stereoButton() }));
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
    const g = this.g;
    const root = g.root;
    if (!this.step) {
      let next = this.queue.shift();
      if (!next) {
        // an activity the user asked for takes priority, once whatever he is holding has been put away
        const wanted = this.pendingActivity;
        const holding = this.held || this.ballHeld || this.gtr.held;
        if (wanted && !holding) { this.pendingActivity = null; this.choose(wanted); } else this.choose();
        next = this.queue.shift();
      }
      while (next && next.type === 'plan') {
        try { this.queue.unshift(...next.fn()); } catch (err) { this.queue.length = 0; } // an object it needed is gone
        next = this.queue.shift();
      }
      this.step = next || this.play('idle', 0.05);
      this.step.t = 0;
      this.step.fired = false;
      this.stuckT = 0;
    }
    const s = this.step;
    // Whatever Guy is pushing or sitting on doesn't block him while he's doing it.
    for (const o of this.w.obstacles) o.active = true;
    if (s.push) s.push.obj.obstacle.active = false;
    if (s.fx && s.fx.sit) this.obj('bench').obstacle.active = false;
    if (s.fx && s.fx.chairSit && this.obj('armchair')) this.obj('armchair').obstacle.active = false;
    const hobby = this.hobbyAt(s);
    if (hobby && this.obj(hobby)) this.obj(hobby).obstacle.active = false;
    s.t += dt;
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
          this.grid = makeGrid(this.w.obstacles);
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
          this.turnTo(want, dt, 6);
          const facing = Math.abs(angDiff(want, root.rotation.y));
          const speed = clamp(finalDist * 2, 0.4, 1.25) * (facing < 0.8 ? 1 : 0.15) * (s.push ? s.push.spd / 1.1 : 1);
          this.moveBy(Math.sin(root.rotation.y) * speed * dt, Math.cos(root.rotation.y) * speed * dt);
          if (s.push) s.push.obj.set(root.position.x + s.push.relx, root.position.z + s.push.relz);
          this.walkPhase += speed * dt * 5.2;
          this.moving = true;
          this.stuckT += dt;
          if (this.stuckT > 25) finished = true;
        } else if (s.yaw !== null && Math.abs(angDiff(s.yaw, root.rotation.y)) > 0.05) {
          this.turnTo(s.yaw, dt, 5);
          this.walkPhase += dt * 3;
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
      tgt: this.bookTargets(s), readW: this.readBlend, read: this.read, ball: ballState, guitar: guitarState, hob: hobState,
      walkPhase: this.walkPhase, beat, hit: this.hit, sway: this.sway, music: !!this.music,
      carry: !!s.push, strain: s.push && s.push.obj.weight === 'medium' ? 1 : 0,
    };

    this.lastCtx = ctx;   // read by the QA pose-sanity sweep (src/devtools.js)
    g.clearTargets();
    basePose(g, this.time);
    POSES[poseName](g, t, dur, ctx);
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
    this.read = { open, turning: tn.start !== null, turnT, sheet };
  }

  // World points the arms aim at: the book's slot on the shelf, Guy's side (carrying), and each edge of the open book.
  bookTargets(s) {
    const g = this.g, root = g.root;
    const t = { shelf: new THREE.Vector3(), carry: root.localToWorld(new THREE.Vector3(-0.2, 0.85, 0.1)) };
    const book = (s.fx && s.fx.book) || this.held;
    const shelf = this.obj('shelf');
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
    const gt = this.obj('guitar');
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
    const c = this.obj('armchair'), root = this.g.root;
    if (!c) return;
    const sm = (x) => smooth(clamp(x, 0, 1));
    const T = s.t, D = s.dur, gap = -0.95, seat = -0.22; // pelvis well back from the front edge so the shins hang clear
    const z = T < 0.9 ? lerp(gap, seat, sm(T / 0.9)) : T < D - 0.9 ? seat : lerp(seat, gap, sm((T - (D - 0.9)) / 0.9));
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
      beat = ((s.t - (s.fx.startAt ?? 0.8)) * s.fx.song.bpm) / 60;
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
    nx = clamp(nx, -4.5, 4.5); nz = clamp(nz, -3.5, 3.6);
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
const CELL = 0.2, X0 = -4.6, Z0 = -3.6, NX = 47, NZ = 37, INFLATE = 0.28;

function makeGrid(obstacles, inflate = INFLATE, wall = 0, skip = null) {
  const blocked = new Uint8Array(NX * NZ);
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const x = X0 + i * CELL, z = Z0 + j * CELL;
      if (obstacles.some((o) => o !== skip && o.active !== false && x > o.x0 - inflate && x < o.x1 + inflate && z > o.z0 - inflate && z < o.z1 + inflate)) blocked[i + j * NX] = 1;
      else if (wall && (x < -ROOM.w / 2 + wall || x > ROOM.w / 2 - wall || z < -ROOM.d / 2 + wall || z > ROOM.d / 2 - wall)) blocked[i + j * NX] = 1;
    }
  }
  return blocked;
}

const cellOf = (x, z) => [clamp(Math.round((x - X0) / CELL), 0, NX - 1), clamp(Math.round((z - Z0) / CELL), 0, NZ - 1)];
const cellBlocked = (blocked, x, z) => { const [i, j] = cellOf(x, z); return !!blocked[i + j * NX]; };
function lineClear(blocked, a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1);
  for (let k = 0; k <= n; k++) if (cellBlocked(blocked, lerp(a.x, b.x, k / n), lerp(a.z, b.z, k / n))) return false;
  return true;
}

// strict: return null instead of a straight line when the goal is unreachable
function findPath(blocked, sx, sz, gx, gz, strict = false) {
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
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

installHobbies(Brain, POSES, { sitLegs, env, smooth, clamp, lerp, rand, pick, makeGrid, cellBlocked, INFLATE });

export { ROOM };
