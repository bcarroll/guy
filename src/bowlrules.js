// The rules of bowling and the physics of a thrown ball, with no 3D in it (so it can be tested on its own): where the ten pins stand, how
// a game is scored, how a ball that is thrown comes down the lane and which pins it knocks over. bowlobjects.js draws it all and
// bowlbrain.js is the robot doing it.
//
// Everything is in the lane's own frame, in metres: x across the lane from its middle, z along the room (the foul line first, then the
// head pin, then the pit behind the pins: z gets smaller the further down the lane).
export const LANE = {
  half: 0.525,               // half the width of the boards (a ball further out than this is in the gutter)
  gutter: 0.235,             // the width of each gutter
  foulZ: -2.4,               // the foul line
  headZ: -8.4,               // the head pin
  rowGap: 0.264,             // from one row of pins to the next
  pinGap: 0.305,             // from one pin to the next in a row
  pitZ: -9.55,               // behind the back row: a pin that gets here is in the pit
  ballR: 0.108,              // a ball is 21.6 cm across
  pinR: 0.057,
  pinH: 0.381,
};

// The ten pins, numbered 1 to 10 as in a real alley (index 0 is the head pin): row r has r + 1 pins.
export const PIN_SPOTS = (() => {
  const out = [];
  for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) out.push({ x: (k - r / 2) * LANE.pinGap, z: LANE.headZ - r * LANE.rowGap, row: r });
  return out;
})();
// how readily a falling pin takes its neighbours with it (tuned so a careful bowler averages about 150 and a beginner about 90)
export const TUNE = { chain: 0.62 };
const CHAIN = () => TUNE.chain;
const NEIGHBOURS = PIN_SPOTS.map((a, i) => PIN_SPOTS.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.z - b.z) })).filter((n) => n.j !== i && n.d < 0.62));

// ---------------------------------------------------------------------------------------------------------------- scoring
// The frames of a game from the list of rolls (the pins knocked down by each ball): [{ rolls, mark, cum }] for the ten frames, and the
// total so far. `cum` is the running score at the end of that frame, or null while a strike or spare is still waiting for its bonus balls.
export function scoreGame(rolls) {
  const frames = [];
  let i = 0, total = 0, last = 0;
  for (let f = 0; f < 10; f++) {
    const fr = { rolls: [], mark: null, cum: null };
    frames.push(fr);
    const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2];
    if (a === undefined) continue;
    if (f < 9) {
      if (a === 10) {
        fr.rolls = [10]; fr.mark = 'X';
        if (b !== undefined && c !== undefined) { total += 10 + b + c; fr.cum = total; last = f; }
        i += 1;
      } else {
        fr.rolls = b === undefined ? [a] : [a, b];
        if (b !== undefined) {
          if (a + b === 10) { fr.mark = '/'; if (c !== undefined) { total += 10 + c; fr.cum = total; last = f; } }
          else { total += a + b; fr.cum = total; last = f; }
        }
        i += 2;
      }
    } else {                                                     // the tenth: up to three balls
      fr.rolls = rolls.slice(i, i + 3);
      const t = fr.rolls;
      if (t[0] === 10 || (t.length > 1 && t[0] + t[1] === 10)) { if (t.length === 3) { total += t[0] + t[1] + t[2]; fr.cum = total; } }
      else if (t.length > 1) { total += t[0] + t[1]; fr.cum = total; }
      fr.mark = t[0] === 10 ? 'X' : t.length > 1 && t[0] + t[1] === 10 ? '/' : null;
    }
  }
  return { frames, total, last };
}

// What happens after the rolls so far: 'sweep' (clear the pins that fell, the rest stay for the next ball), 'rack' (all ten set up again)
// or 'done' (the game is over). Also `frame` (1..10) and `ball` (1..3) for the next ball.
export function afterRoll(rolls) {
  let i = 0;
  for (let f = 1; f <= 9; f++) {
    if (i >= rolls.length) return { next: 'rack', frame: f, ball: 1 };               // the frame has not started: a fresh rack
    if (rolls[i] === 10) { i += 1; continue; }                                      // a strike ends the frame
    if (i + 1 >= rolls.length) return { next: 'sweep', frame: f, ball: 2 };         // one ball down: the pins left stand for the second
    i += 2;
  }
  const t = rolls.slice(i);                                                          // the tenth frame
  if (t.length === 0) return { next: 'rack', frame: 10, ball: 1 };
  if (t.length === 1) return { next: t[0] === 10 ? 'rack' : 'sweep', frame: 10, ball: 2 };
  if (t.length === 2) {
    if (t[0] === 10) return { next: t[1] === 10 ? 'rack' : 'sweep', frame: 10, ball: 3 };
    if (t[0] + t[1] === 10) return { next: 'rack', frame: 10, ball: 3 };
  }
  return { next: 'done', frame: 10, ball: 3 };
}

// ---------------------------------------------------------------------------------------------------------------- the throw
// The path of a ball down the lane. It leaves the hand at x0 (across the lane) and arrives at the head pin at x1; a hooked ball goes
// `hook` metres out towards the gutter in the middle and curves back in (hook > 0 out to +x, < 0 out to -x). s runs 0 (the foul line) to 1.
export const pathX = (x0, x1, hook, s) => x0 + (x1 - x0) * s + hook * 4 * s * (1 - s);

// Throw a ball down a lane with `standing` (a list of pin indices) still up. `aim` is where it is meant to arrive across the lane;
// `noise` how far off that it may end up (a standard deviation); `power` how hard it is thrown (0.6..1.4). `rnd` is Math.random in the
// game and a seeded one in the tests. Returns the pins knocked down (in the order they fall, each with a `delay` after the first hit, a
// direction `dx, dz` to fly in and a `speed`), whether it went in the gutter, and the path it took.
export function throwBall(standing, { x0 = 0, aim = 0, hook = 0, noise = 0.2, power = 1 }, rnd = Math.random) {
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(2 * Math.PI * rnd());
  const x1 = aim + gauss() * noise;
  let gutter = 0;                                                  // which gutter it went into: -1, 1, or 0 for none
  for (let k = 1; k <= 40; k++) { const x = pathX(x0, x1, hook, k / 40); if (Math.abs(x) > LANE.half) { gutter = x < 0 ? -1 : 1; break; } }
  const out = { x0, x1, hook, gutter, down: [], power };
  if (gutter) return out;
  const slope = (pathX(x0, x1, hook, 1) - pathX(x0, x1, hook, 0.95)) / ((LANE.foulZ - LANE.headZ) * 0.05);        // sideways per metre along, at the pins
  const lineX = (z) => x1 + slope * (LANE.headZ - z) * -1;
  const up = new Set(standing);
  const queue = [];
  // the ball itself reaches the pins it passes close to (it is deflected by each, so the back rows are only reached by the pins)
  for (const i of standing) {
    const p = PIN_SPOTS[i], gap = Math.abs(p.x - lineX(p.z)) / Math.hypot(1, slope);
    if (p.row > 2 && standing.some((j) => PIN_SPOTS[j].row < p.row && Math.abs(PIN_SPOTS[j].x - lineX(PIN_SPOTS[j].z)) < 0.24)) continue;      // (the pins in front of it get in the way)
    if (gap < LANE.ballR + LANE.pinR * 0.9 - 0.012 * p.row) {
      const ang = Math.atan2(p.x - lineX(p.z), 0.6);
      queue.push({ i, delay: p.row * 0.02, dx: Math.sin(ang) + (rnd() - 0.5) * 0.3, dz: -1, speed: 2.4 * power });
    }
  }
  for (const q of queue) up.delete(q.i);
  // a pin that falls takes its neighbours with it, the more likely the harder it was hit and the straighter it flies at them
  for (let n = 0; n < queue.length; n++) {
    const k = queue[n], a = PIN_SPOTS[k.i], len = Math.hypot(k.dx, k.dz) || 1;
    for (const { j, d } of NEIGHBOURS[k.i]) {
      if (!up.has(j)) continue;
      const b = PIN_SPOTS[j], vx = (b.x - a.x) / d, vz = (b.z - a.z) / d;
      const align = Math.max(0, (vx * k.dx + vz * k.dz) / len);
      const p = Math.min(0.95, (0.1 + 0.8 * align) * CHAIN() * (0.45 + 0.4 * k.speed) * (d < 0.4 ? 1 : 0.35));
      if (rnd() < p) {
        up.delete(j);
        queue.push({ i: j, delay: k.delay + d / Math.max(1, k.speed * 1.4), dx: vx + (rnd() - 0.5) * 0.4, dz: vz + (rnd() - 0.5) * 0.4, speed: k.speed * 0.85 });
      }
    }
  }
  out.down = queue;
  return out;
}

// How many pins are left standing after a throw
export const leftAfter = (standing, result) => standing.filter((i) => !result.down.some((d) => d.i === i));
