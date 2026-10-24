// Guy's behaviour with the drum kit, the easel and the telescope. Installed onto Brain / POSES at the bottom of brain.js.
import * as THREE from 'three';
import { Q } from './guy.js';
import { drumHit, TRACKS } from './audio.js';
import { sfx, drag as sfxDrag } from './sfx.js';
import { drumStep, handFor, polyPoint, paintPlan, makeStick, makeBrush, makePalette, DRUM_STYLE_BY_TRACK } from './hobbies.js';

const UPV = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BANG_PADS = ['snare', 'snare', 'tom1', 'tom2', 'floor', 'hat', 'crash', 'ride'];

// no lessons: whacking whatever is in reach, with no pattern
function bangStep() {
  const hits = [];
  if (Math.random() < 0.8) { const k = BANG_PADS[Math.floor(Math.random() * BANG_PADS.length)]; hits.push({ k, h: handFor(k), v: 0.5 + Math.random() * 0.5 }); }
  if (Math.random() < 0.25) hits.push({ k: 'kick', h: 'F', v: 0.9 });
  if (Math.random() < 0.2) { const k = BANG_PADS[Math.floor(Math.random() * BANG_PADS.length)]; const h = handFor(k); if (!hits.some((x) => x.h === h)) hits.push({ k, h, v: 0.4 + Math.random() * 0.6 }); }
  return hits;
}

export function installHobbies(Brain, POSES, H) {
  const { sitLegs, env, smooth, clamp, lerp, rand, pick, makeGrid, cellBlocked, INFLATE } = H;
  const sm = (x) => smooth(clamp(x, 0, 1));
  const ease = (a, b, x) => lerp(a, b, sm(x));

  Object.assign(Brain.prototype, {
    initHobbies() {
      this.props = { stickL: makeStick(), stickR: makeStick(), brush: makeBrush(), palette: makePalette() };
      Object.values(this.props).forEach((p) => this.w.room.add(p));
      this.hobProps = {};
      this.lampOffByMe = false;
    },
    fwdVec() { const y = this.g.root.rotation.y; return V(Math.sin(y), 0, Math.cos(y)); },
    leftVec() { const y = this.g.root.rotation.y; return V(Math.cos(y), 0, -Math.sin(y)); },
    // wrist, direction of the fingers and the thumb side of a hand, in world space
    handFrame(side) {
      const g = this.g;
      const wrist = g.boneWorld(`${side}Hand`);
      const f = g.boneWorld(`${side}HandMiddle1`).sub(wrist).normalize();   // the knuckle, so curling the fingers does not tilt what he holds
      const thumb = g.boneWorld(`${side}HandThumb1`).sub(wrist);
      thumb.addScaledVector(f, -thumb.dot(f)).normalize();
      // palm normal (the side the fingers curl towards): thumb-side x fingers for the right hand, the reverse for the left
      const palm = side === 'Right' ? thumb.clone().cross(f) : f.clone().cross(thumb);
      return { wrist, f, thumb, palm: palm.normalize() };
    },

    // ------------------------------------------------------------------ activities
    hobbyActivities() {
      const w = this.w;
      const k = (id) => this.skills.has(id);
      const drumSteps = (label, fx, dur) => [label,
        this.walkAt('drums', 0.55, 1.15),
        this.walkAt('drums', 0.55, 0.6, Math.PI, true),
        this.play('drumSit', dur, { drums: true, sitDrum: true, startAt: 2.4, ...fx }),
        this.walkAt('drums', 0.55, 1.15, null, true)];
      const paintSteps = (label, kind, finger = false) => {
        const e = this.obj('easel');
        const plan = paintPlan(kind, !!(e && e.painted));
        const ret = finger ? 0 : 1.0;                                       // put the palette back before stepping away
        plan.admireStart += ret; plan.total += ret; plan.ret = ret;
        return [label,
          this.walkAt('easel', 0, 0.78),
          this.walkAt('easel', 0, 0.59, Math.PI, true),
          this.play('paintStand', plan.total + 2.2, { paint: true, finger, plan, startAt: 2.2 }),
          this.walkAt('easel', 0, 0.85, null, true)];
      };
      const lampOff = () => ({
        type: 'plan',
        fn: () => {
          const l = this.obj('lamp');
          if (!l || !l.on) return [];
          return [this.sideStep('lamp', 0.55), this.play('reach', 1.8, { at: [0.9, () => { w.lamp.set(false); this.lampOffByMe = true; }], needs: ['lamp'], target: () => this.lampSwitch() })];
        },
      });
      const lampOn = () => ({
        type: 'plan',
        fn: () => {
          const l = this.obj('lamp');
          if (!l || !this.lampOffByMe) { this.lampOffByMe = false; return []; }
          return [this.sideStep('lamp', 0.55), this.play('reach', 1.8, { at: [0.9, () => { w.lamp.set(true); this.lampOffByMe = false; }], needs: ['lamp'], target: () => this.lampSwitch() })];
        },
      });
      return {
        bang: () => drumSteps('banging on the drums', { style: 'bang', bpm: 150 }, rand(12, 18)),
        drums: () => drumSteps('playing the drums', { style: pick(['rock', 'rock', 'soft', 'march']), bpm: pick([92, 100, 108]) }, rand(24, 34)),
        drumsolo: () => drumSteps('playing a drum solo', { style: 'solo', bpm: 112 }, rand(28, 38)),
        jamdrums: () => drumSteps(`drumming along with ${this.nowPlaying().title}`, { style: 'jam', sync: true }, rand(32, 46)),
        scribble: () => paintSteps('scribbling on the canvas with a finger', 'scribble', true),
        paint: () => paintSteps('painting', 'basic'),
        mixpaint: () => paintSteps('mixing colours and painting', 'mix'),
        portrait: () => paintSteps('painting a picture', 'portrait'),
        peek: () => ['peering into the telescope (the wrong end)', this.scopeAim('room'), this.scopeSpot('wrong'), this.play('scopeWrong', 10, { scope: 'wrong' })],
        stargaze: () => ['stargazing through the telescope', this.scopeAim('sky'), this.scopeSpot('peer'), this.play('scopePeer', rand(14, 20), { scope: 'peer' })],
        darkstargaze: () => ['switching the lights off to stargaze', lampOff(), this.scopeAim('sky'), this.scopeSpot('peer'), this.play('scopePeer', rand(20, 28), { scope: 'peer' }), lampOn()],
        scopecare: () => ['looking after the telescope', this.scopeSpot('care'), this.play('scopeCare', 17, { scope: 'care' })],
        lighton: () => ['putting the light back on', lampOn()],
      };
    },

    // ------------------------------------------------------------------ steps that need the telescope's current state
    // Swing the tube to a new direction with one hand: towards the nearest wall ('sky') or into the room ('room').
    scopeAim(mode) {
      return {
        type: 'plan',
        fn: () => {
          const t = this.obj('telescope'), grid = makeGrid(this.w.obstacles, 0.62, 0, t.obstacle), sideGrid = makeGrid(this.w.obstacles, 0.4, 0, t.obstacle);   // he leans over the ends: more room than walking needs
          t.tube.updateWorldMatrix(true, false);
          const c = t.tube.localToWorld(V(0, 0, 0));
          const out = Math.abs(c.x) / 4.6 > Math.abs(c.z) / 3.6 ? V(Math.sign(c.x), 0, 0) : V(0, 0, Math.sign(c.z));   // the nearest wall
          if (mode === 'room') out.negate();
          const cur = t.aim, wy0 = cur.yaw + t.group.rotation.y;
          for (let tries = 0; tries < 24; tries++) {
            const wy = Math.atan2(out.x, out.z) + (tries ? rand(-0.5, 0.5) : 0);
            const pitch = mode === 'room' ? 0.2 : rand(0.18, 0.36);
            const dir = V(Math.sin(wy), 0, Math.cos(wy));
            // the big end must not poke into other furniture (he leans in over it)
            const tip = c.clone().addScaledVector(dir, 0.62);
            if (this.w.obstacles.some((o) => o !== t.obstacle && o.active !== false && tip.x > o.x0 - 0.45 && tip.x < o.x1 + 0.45 && tip.z > o.z0 - 0.45 && tip.z < o.z1 + 0.45)) continue;
            // where he will stand to look through it (behind the eyepiece for 'sky', in front of the lens for 'room')
            const spot = c.clone().addScaledVector(dir, mode === 'room' ? 1.25 : -1.15);
            if (Math.abs(spot.x) > 4.3 || spot.z < -3.3 || spot.z > 3.5 || cellBlocked(grid, spot.x, spot.z)) continue;
            // stand beside the tube to swing it: the side that is free
            const perp = V(-dir.z, 0, dir.x);
            for (const sgn of [1, -1]) {
              const side = c.clone().addScaledVector(perp, sgn * 0.78);
              if (Math.abs(side.x) > 4.4 || side.z < -3.4 || side.z > 3.6 || cellBlocked(sideGrid, side.x, side.z)) continue;
              const cd = V(Math.sin(wy0), 0, Math.cos(wy0));
              const toHand = V(cd.x, 0, cd.z);
              // swing with whichever hand is on the tube's front end side
              const standDir = c.clone().sub(side).setY(0).normalize();
              const left = V(standDir.z, 0, -standDir.x);
              const hand = toHand.dot(left) > 0 ? 'Left' : 'Right';
              return [this.walk(side.x, side.z, Math.atan2(standDir.x, standDir.z)),
                this.play('scopeAim', 4.2, { scope: 'aim', hand, from: { yaw: cur.yaw, pitch: cur.pitch }, to: { yaw: wy - t.group.rotation.y, pitch } })];
            }
          }
          this.queue.length = 0; this.ui("no room to use the telescope"); return [];
        },
      };
    },
    // Walk to where he looks through the telescope (or to where he cleans it) for the current aim.
    scopeSpot(kind) {
      return {
        type: 'plan',
        fn: () => {
          const t = this.obj('telescope'), grid = makeGrid(this.w.obstacles, kind === 'care' ? 0.55 : 0.62, 0, t.obstacle);
          const E = t.eyepiece(), O = t.objective();
          const d = O.clone().sub(E).normalize(), dh = V(d.x, 0, d.z).normalize();
          const c = t.tube.localToWorld(V(0, 0, 0));
          const ok = (p) => Math.abs(p.x) < 4.4 && p.z > -3.4 && p.z < 3.6 && !cellBlocked(grid, p.x, p.z);
          const cands = [];
          if (kind === 'peer') for (const back of [0.3, 0.4, 0.5, 0.6]) cands.push([E.clone().addScaledVector(dh, -back), dh.clone()]);
          else if (kind === 'wrong') for (const out of [0.55, 0.65, 0.8]) cands.push([O.clone().addScaledVector(dh, out), dh.clone().negate()]);
          else {
            const perp = V(-dh.z, 0, dh.x);
            for (const sgn of [1, -1]) cands.push([c.clone().addScaledVector(perp, sgn * 0.74).addScaledVector(dh, 0.15), perp.clone().multiplyScalar(-sgn)]);
          }
          for (const [p, face] of cands) if (ok(p)) return [this.walk(p.x, p.z, Math.atan2(face.x, face.z))];
          this.queue.length = 0; this.ui("can't get at the telescope"); return [];
        },
      };
    },

    // ------------------------------------------------------------------ per-step state
    computeHobby(s, dt) {
      this.hobProps = {};
      const d = this.obj('drums');
      if (d && d.restSticks) d.restSticks.forEach((m) => (m.visible = true));
      const e = this.obj('easel');
      if (e && e.restPalette) e.restPalette.visible = true;
      if (s.type !== 'play' || !s.fx) return null;
      if (s.fx.work) return this.computeWork(s, dt);                    // hands at work (the stove: restbrain.js)
      if (s.fx.drums) return this.computeDrums(s);
      if (s.fx.paint) return this.computePaint(s, dt);
      if (s.fx.scope) return this.computeScope(s, dt);
      return null;
    },

    // whether the step is one of his hobbies (for the obstacle that must not block him while he uses it)
    hobbyAt(s) {
      if (!s) return null;
      if (s.fx && (s.fx.drums || s.fx.sitDrum)) return 'drums';
      if (s.fx && s.fx.paint) return 'easel';
      if (s.fx && s.fx.work) return s.fx.work.obj;                       // the station he is working at
      if (s.type === 'walk' && s.direct && s.anchor && (s.anchor.name === 'drums' || s.anchor.name === 'easel')) return s.anchor.name;
      return null;
    },

    // ---- drums ----
    updateDrumSit(s) {
      const d = this.obj('drums'), root = this.g.root;
      if (!d) return;
      const A = { x: 0.55, z: 0.6 }, S = { x: d.seat.x, z: d.seat.z };
      const T = s.t, D = s.dur;
      const k = T < 0.9 ? sm(T / 0.9) : T < D - 0.9 ? 1 : 1 - sm((T - (D - 0.9)) / 0.9);
      const l = d.local(lerp(A.x, S.x, k), lerp(A.z, S.z, k));
      root.position.x = d.x + l.x; root.position.z = d.z + l.z;
      root.rotation.y = d.yaw + Math.PI;
    },

    stickDir(hand) {
      const sgn = hand === 'L' ? 1 : -1;      // Guy's left is +x in his own frame
      return this.fwdVec().multiplyScalar(Math.cos(0.3)).addScaledVector(UPV, -Math.sin(0.3)).addScaledVector(this.leftVec(), -sgn * 0.12).normalize();
    },

    computeDrums(s) {
      const d = this.obj('drums');
      if (!d) return null;
      const g = this.g, T = s.t, D = s.dur, fx = s.fx;
      d.group.updateWorldMatrix(true, false);
      if (!d.restSticks) {
        d.restSticks = [0, 1].map((i) => {
          const m = makeStick();
          m.visible = true;
          m.position.set(d.pads.snare.x + (i ? 0.04 : -0.04), d.pads.snare.y + 0.014, d.pads.snare.z);
          m.rotation.set(0, i ? 0.5 : -0.5, Math.PI / 2);
          d.group.add(m);
          return m;
        });
      }
      const pads = {};
      for (const key in d.pads) pads[key] = d.group.localToWorld(V(d.pads[key].x, d.pads[key].y, d.pads[key].z));
      const lat = V(1, 0, 0).applyQuaternion(d.group.getWorldQuaternion(new THREE.Quaternion()));   // drum-local +x (the drummer's right)
      const start = fx.startAt ?? 2.4, endGap = 2.0;
      const holding = T >= start - 0.6 && T < D - endGap + 0.8;
      this.hobProps.sticks = holding;
      d.restSticks.forEach((m) => (m.visible = !holding));
      // Timing comes with the advanced books (Fills & Solos, Playing in the Band): such a drummer locks onto the stereo's beat, or
      // onto the tempo the other robot is playing, wherever the song is. With only the basic book the beat is steady but her own.
      const f = fx.sync && this.music ? { bl: this.beatLen, beat: this.currentBeat() } : this.tempoToFollow('drums');
      const bl = f ? f.bl : 60 / (fx.bpm || 100);
      const b = f ? f.beat : (T - start) / bl;
      this.keptTime = { inst: 'drums', mine: b, ref: f ? f.beat : null, bl };
      if (!f && !fx.sync) this.publishTempo(this.time - T + start, bl);
      const dr = (s.dr ||= { n: null, q: { L: [], R: [], F: [] }, last: { L: null, R: null }, kickAt: -9 });
      const playing = T >= start && T < D - endGap && (!fx.sync || !!this.music);
      if (!playing) dr.n = null;
      if (playing) {
        if (dr.n === null) dr.n = Math.floor(b * 2);
        const style = fx.style === 'jam' ? ((TRACKS[this.track] && TRACKS[this.track].drums) || DRUM_STYLE_BY_TRACK[this.track] || 'rock') : fx.style;
        while (dr.n < Math.floor(b * 2) + 3) {
          dr.n++;
          const hits = style === 'bang' ? bangStep() : drumStep(style, dr.n);
          for (const h of hits) dr.q[h.h].push({ pad: h.k, time: dr.n / 2, v: h.v });
        }
        for (const hd of ['L', 'R', 'F']) {
          const q = dr.q[hd];
          while (q.length && q[0].time <= b) {
            const it = q.shift();
            drumHit(it.pad, it.v);
            if (hd === 'F') dr.kickAt = T; else dr.last[hd] = { pad: it.pad, time: it.time };
          }
        }
      } else for (const hd of ['L', 'R', 'F']) dr.q[hd].length = 0;

      const up = sm((T - 0.8) / 0.8) * (1 - sm((T - (D - 1.2)) / 0.9));
      const out = { w: up, beat: b, playing, press: Math.exp(-(T - dr.kickAt) * 12) };
      const tipLen = 0.24 + g.limb.Right.handLen * 0.45;   // stick centre is 0.04 past the grip point, half its length (0.2) beyond that
      for (const hd of ['L', 'R']) {
        const sgn = hd === 'L' ? -1 : 1;
        const rest = pads.snare.clone().addScaledVector(lat, sgn * 0.04).add(V(0, 0.016, 0));
        let pos;
        if (!playing) pos = rest;
        else {
          const last = dr.last[hd], next = dr.q[hd][0];
          const from = last ? pads[last.pad] : rest;
          if (!next) pos = from.clone().add(V(0, 0.07 + 0.02 * Math.sin(T * 3), 0));
          else {
            const bh = b + 0.1 / bl, t0 = last ? last.time : next.time - 1, gap = Math.max(0.25, next.time - t0), u = clamp((bh - t0) / gap, 0, 1);   // the arm leads the beat a little: the skeleton follows with a lag
            pos = from.clone().lerp(pads[next.pad], sm(u / 0.7));
            pos.y += clamp(gap * bl * 0.45, 0.04, 0.2) * Math.sin(Math.PI * u);
          }
        }
        const f = this.stickDir(hd);
        out[hd] = { wrist: pos.clone().addScaledVector(f, -tipLen), f, palm: V(0, -1, 0).addScaledVector(lat, -sgn * 0.25), tip: pos };
      }
      return out;
    },

    // ---- easel ----
    updatePaintStand(s) {
      const e = this.obj('easel'), root = this.g.root;
      if (!e || !s.fx.plan) return;
      const plan = s.fx.plan, Tp = s.t - (s.fx.startAt ?? 2.2);
      const z = lerp(0.59, 1.05, sm((Tp - plan.admireStart) / 1.2));
      const l = e.local(0, z);
      root.position.x = e.x + l.x; root.position.z = e.z + l.z;
      root.rotation.y = e.yaw + Math.PI;
    },

    computePaint(s, dt) {
      const e = this.obj('easel');
      if (!e) return null;
      const g = this.g, fx = s.fx, plan = fx.plan, start = fx.startAt ?? 2.2;
      const T = s.t, Tp = T - start, D = s.dur, root = g.root;
      e.group.updateWorldMatrix(true, false);
      if (!e.restPalette) {
        e.restPalette = makePalette();
        e.restPalette.scale.setScalar(0.8);
        e.restPalette.position.set(0.12, 0.632, 0.09);
        e.restPalette.visible = true;
        e.group.add(e.restPalette);
      }
      const trayW = e.group.localToWorld(V(0.12, 0.64, 0.09));
      const pp = (s.pp ||= { tip: null, lastUV: null, color: '#d0312d', done: new Set() });
      const fwd = this.fwdVec(), left = this.leftVec();
      const handLen = g.limb.Right.handLen;
      const finger = !!fx.finger;
      const usePalette = !finger;
      const brushLen = 0.165 + handLen * 0.45;
      // palette: picked up from the tray, held in the left hand, put back afterwards
      const paletteHeld = usePalette && T >= 1.0 && Tp < plan.painting + 0.55;
      const lf = fwd.clone().multiplyScalar(0.9).addScaledVector(left, -0.2).normalize();
      const palWrist = root.localToWorld(V(0.27, 1.0, 0.25));
      const palCenter = palWrist.clone().addScaledVector(lf, handLen * 0.45 + 0.05).add(V(0, 0.03, 0));
      this.hobProps.brush = !finger;
      this.hobProps.palette = paletteHeld;
      this.hobProps.paletteFrame = { lf, up: UPV };
      e.restPalette.visible = !paletteHeld;
      if (this.hobProps.brush && pp.brushT === undefined) pp.brushT = T;

      const out = { finger, palette: paletteHeld };
      // the left hand: to the tray for the palette, up to hold it, back to the tray to put it down
      const tray = trayW.clone().add(V(0, 0.09, 0));
      let lw = palWrist, lf2 = lf, lw2 = 0;
      if (usePalette) {
        if (T < 1.0) { lw = tray; lw2 = sm(T / 0.8); }
        else if (Tp < plan.painting) { lw = tray.clone().lerp(palWrist, sm((T - 1.0) / 0.8)); lw2 = 1; }
        else { lw = palWrist.clone().lerp(tray, sm((Tp - plan.painting) / 0.5)); lw2 = 1 - sm((Tp - plan.painting - 0.55) / 0.4); }
      }
      out.L = { wrist: lw, f: lf2, palm: UPV.clone(), w: lw2 };

      // the right hand: brush (or finger) tip
      let desired = null, brushColor = pp.color, seg = null;
      const rest = root.localToWorld(V(-0.2, 1.05, 0.42));
      if (Tp >= 0 && Tp < plan.painting) seg = plan.segs.find((q) => Tp >= q.t0 && Tp < q.t0 + q.dur);
      if (seg) {
        const u = (Tp - seg.t0) / seg.dur;
        if (seg.type === 'stroke') {
          const [pu, pv] = polyPoint(seg.pts, u);
          const zoff = 0.12 * (1 - sm(u / 0.18)) + 0.1 * sm((u - 0.88) / 0.12);
          const loc = e.paint.point(pu, pv);
          desired = e.group.localToWorld(V(loc.x, loc.y, loc.z + zoff));
          if (zoff < 0.012) {
            const col = finger ? seg.color : seg.color;
            if (pp.lastUV) { e.paint.stroke(pp.lastUV[0], pp.lastUV[1], pu, pv, col, seg.width); sfx('brush', Math.hypot(pu - pp.lastUV[0], pv - pp.lastUV[1]) * 30); }
            else e.paint.dab(pu, pv, col, seg.width / 2);
            pp.lastUV = [pu, pv];
            e.painted = true;
          } else pp.lastUV = null;
          pp.color = seg.color; brushColor = seg.color;
        } else {
          pp.lastUV = null;
          desired = palCenter.clone().add(V(0, 0.035, 0));
          if (seg.type === 'dip') { desired.y += 0.035 * Math.sin(Math.PI * u * 2) ** 2 * 0 + 0.02 * (1 - Math.sin(Math.PI * clamp(u * 1.2, 0, 1))); if (u > 0.45) brushColor = seg.color; }
          if (seg.type === 'mix') {
            const ph = u * Math.PI * 6;
            desired.addScaledVector(fwd, Math.cos(ph) * 0.035).addScaledVector(left, Math.sin(ph) * 0.045);
            brushColor = u > 0.7 ? seg.color : pp.color;
          }
          if (seg.type === 'dip' && u > 0.45) { if (pp.color !== seg.color) sfx('dab'); pp.color = seg.color; }
          if (seg.type === 'mix' && u > 0.7) pp.color = seg.color;
        }
      } else pp.lastUV = null;
      if (!desired) desired = rest;
      if (!pp.tip) pp.tip = rest.clone();
      pp.tip.lerp(desired, 1 - Math.exp(-dt * 16));
      this.hobProps.brushColor = brushColor;
      // the brush points at its target from the hand's side; fingers point at the canvas
      const toward = desired.clone().sub(root.localToWorld(V(-0.2, 1.0, 0.1)));
      const f = (seg && seg.type !== 'stroke' ? toward.clone().setY(toward.y - 0.1) : fwd.clone().multiplyScalar(0.95).addScaledVector(UPV, 0.3)).normalize();
      const tipLen = finger ? 0 : brushLen;
      out.R = { f, tip: pp.tip.clone(), wrist: pp.tip.clone().addScaledVector(f, -tipLen), palm: left.clone().multiplyScalar(0.9).addScaledVector(UPV, -0.2),
        w: sm(T / 1.0) * (1 - sm((T - (D - 1.0)) / 0.8)), contact: finger };
      out.admire = sm((Tp - plan.admireStart) / 0.8);
      out.beat = Tp;
      return out;
    },

    // ---- telescope ----
    scopeEye() { // where his eyes are, approximately
      const g = this.g;
      return g.boneWorld('Head').add(V(0, 0.06, 0)).addScaledVector(this.fwdVec(), 0.09);
    },
    peerControl(s, target, gain = 1) { // bend knees and lean until his eye is at `target`
      const sc = (s.sc ||= { crouch: 0, lean: 0 });
      const eye = this.scopeEye(), fwd = this.fwdVec();
      const errY = eye.y - target.y, errF = target.clone().sub(eye).setY(0).dot(fwd);
      sc.crouch = clamp(sc.crouch + clamp(errY * 1.6, -0.06, 0.06) * gain, 0, 0.7);
      // once the knees are as bent as looks natural, he bends further at the waist instead
      const waist = sc.crouch > 0.65 ? errY * 1.5 : 0;
      sc.lean = clamp(sc.lean + clamp(errF * 1.8 + waist, -0.06, 0.06) * gain, -0.2, 1.3);
      return sc;
    },
    computeScope(s, dt) {
      const t = this.obj('telescope');
      if (!t) return null;
      const fx = s.fx, T = s.t, D = s.dur, g = this.g;
      const out = { kind: fx.scope };
      const fade = sm(T / 0.8) * (1 - sm((T - (D - 0.9)) / 0.7));
      out.fade = fade;
      const up = V(0, 0.07, 0);
      if (fx.scope === 'aim') {
        const k = sm((T - 1.0) / 1.9);
        t.setAim(lerp(fx.from.yaw, fx.to.yaw, k), lerp(fx.from.pitch, fx.to.pitch, k));
        t.tube.updateWorldMatrix(true, true);
        const hand = fx.hand;
        out.hand = hand;
        out.target = t.tubePoint(0.72).add(up);
        out.w = sm((T - 0.2) / 0.7) * (1 - sm((T - (D - 0.9)) / 0.7));
        out.pushing = k > 0 && k < 1;
        if (out.pushing) sfxDrag(0.35, 'light');          // the tube turning on its mount
        return out;
      }
      t.tube.updateWorldMatrix(true, true);
      const E = t.eyepiece(), O = t.objective();
      const d = O.clone().sub(E).normalize();
      if (fx.scope === 'peer') {
        const eyeT = E.clone().addScaledVector(d, -0.03);
        const lookUp = T > D * 0.55 && T < D * 0.55 + 1.6;     // pauses to look up at the real sky for a moment
        const away = lookUp ? 0.3 * Math.sin(Math.PI * (T - D * 0.55) / 1.6) : 0;
        const target = eyeT.clone().addScaledVector(d, -away).add(V(0, away * 0.6, 0));
        out.sc = this.peerControl(s, target, T > 0.3 ? 1 : 0);
        out.knob = t.tube.localToWorld(V(0.09, 0.013 * Math.cos(T * 4), -0.33 + 0.013 * Math.sin(T * 4)));
        if (fade > 0.9 && Math.sin(T * 4) > 0.95) sfx('tick');          // the focus knob clicks round
        out.barrel = t.tubePoint(0.55).add(up);
        out.w = fade;
        out.look = away;
        return out;
      }
      if (fx.scope === 'wrong') {
        // phases: lean in, stare, pull back puzzled and scratch his head, lean in again
        const ph = T < 1.2 ? 0 : T < 4.2 ? 1 : T < 7.0 ? 2 : 3;
        const back = ph === 2 ? 0.45 * sm((T - 4.2) / 0.6) * (1 - sm((T - 6.4) / 0.6)) : 0;
        const target = O.clone().addScaledVector(d, 0.07 + back).add(V(0, back * 0.2, 0));
        out.sc = this.peerControl(s, target, T > 0.3 ? 1 : 0);
        out.shake = ph === 2 ? Math.sin((T - 4.2) * 9) * 0.35 * sm((T - 4.2) / 0.3) * (1 - sm((T - 6.2) / 0.5)) : 0;
        out.scratch = sm((T - 5.0) / 0.5) * (1 - sm((T - 6.8) / 0.5));
        out.barrel = t.tubePoint(0.8).add(up);
        out.w = fade;
        return out;
      }
      // care: wipe the front ring, rub the barrel along its length, check a tripod leg
      const c = t.tube.localToWorld(V(0, 0, 0));
      const dh = V(d.x, 0, d.z).normalize();
      const ph = T < 6 ? 0 : T < 11 ? 1 : 2;
      out.ph = ph;
      if (ph < 2 && fade > 0.5) sfx('wipe');
      if (ph === 0) {
        const a = (T - 0.8) * 6;
        const ring = t.tube.localToWorld(V(Math.cos(a) * 0.07, Math.sin(a) * 0.07 + 0.0, 0.58));
        out.target = ring; out.w = sm((T - 0.4) / 0.8) * (1 - sm((T - 5.4) / 0.6));
      } else if (ph === 1) {
        const f = 0.5 + 0.45 * Math.sin((T - 6) * 2.6);
        out.target = t.tubePoint(f).add(up);
        out.w = sm((T - 6) / 0.6) * (1 - sm((T - 10.4) / 0.6));
      } else {
        // the tripod leg nearest to him
        const me = g.root.position;
        let best = 0, bd = 9;
        for (let i = 0; i < 3; i++) { const p = t.legPoint(i, 0.45); const dd = Math.hypot(p.x - me.x, p.z - me.z); if (dd < bd) { bd = dd; best = i; } }
        const p = t.legPoint(best, 0.55);
        p.x += Math.sin((T - 11) * 14) * 0.008; p.z += Math.cos((T - 11) * 14) * 0.008;
        out.target = p; out.w = sm((T - 11) / 0.8) * (1 - sm((T - (D - 0.8)) / 0.7)); out.low = true;
      }
      out.rest = dh;
      return out;
    },

    // ------------------------------------------------------------------ props follow the hands
    lateHobbies() {
      const hp = this.hobProps || {}, P = this.props;
      if (this.lateWork) this.lateWork();                               // what he carries, and the spoon in his hand
      if (!P) return;
      const g = this.g;
      for (const [side, key] of [['Left', 'stickL'], ['Right', 'stickR']]) {
        const m = P[key];
        m.visible = !!hp.sticks;
        if (!hp.sticks) continue;
        const fr = this.handFrame(side);
        // the stick lies in the curl of the fingers, on the palm side of the hand bones (not through them)
        m.position.copy(fr.wrist).addScaledVector(fr.f, g.limb[side].handLen * 0.45 + 0.04).addScaledVector(fr.palm, 0.028);
        m.quaternion.setFromUnitVectors(UPV, fr.f);
      }
      const br = P.brush;
      br.visible = !!hp.brush;
      if (hp.brush) {
        const fr = this.handFrame('Right');
        br.position.copy(fr.wrist).addScaledVector(fr.f, g.limb.Right.handLen * 0.45);
        br.quaternion.setFromUnitVectors(UPV, fr.f);
        br.userData.tipMat.color.set(hp.brushColor || '#d0312d');
      }
      const pal = P.palette;
      pal.visible = !!hp.palette;
      if (hp.palette) {
        const fr = this.handFrame('Left');
        const side = new THREE.Vector3().crossVectors(UPV, fr.f).normalize();
        pal.position.copy(fr.wrist).addScaledVector(fr.f, g.limb.Left.handLen * 0.4).add(V(0, 0.025, 0));
        pal.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, UPV, new THREE.Vector3().crossVectors(side, UPV).negate().normalize()));
      }
    },
  });

  // ---------------------------------------------------------------------------- poses
  const fwdOf = (g) => V(Math.sin(g.root.rotation.y), 0, Math.cos(g.root.rotation.y));
  // thumb laid along the stick (found by measuring thumb-to-stick distance: ~2 cm for the right hand; the left is mirrored)
  const IDENT = new THREE.Quaternion();
  const gripThumb = (g, side, w) => {
    const m = side === 'Left' ? -1 : 1;
    g.target[`${side}HandThumb1`].copy(IDENT).slerp(Q('x', 0.6, 'y', -1.0 * m), w);
    g.target[`${side}HandThumb2`].copy(IDENT).slerp(Q('y', -0.4 * m, 'z', 0.4 * m), w);
    g.target[`${side}HandThumb3`].copy(IDENT).slerp(Q('z', 0.4 * m), w);
  };
  const hold = (g, side, p, w, f, palm) => g.reach(side, p, w, false, { hand: { fingers: f, palm } });

  Object.assign(POSES, {
    // sitting in a chair with nothing to do: hands on the thighs, looking round
    sitRest(g, t, dur, ctx) {
      const e = env(t, dur, 0.8);
      sitLegs(g, e);
      const knee = (side) => g.boneWorld(`${side}Leg`).add(V(0, 0.1, 0));
      g.reach('Left', knee('Left'), e, false);
      g.reach('Right', knee('Right'), e, false);
      g.curl('Left', 0.4 * e); g.curl('Right', 0.4 * e);
      g.set('Spine1', Q('x', -0.04 * e));
      g.set('Head', Q('y', Math.sin(t * 0.5) * 0.5 * e, 'x', (0.04 + Math.sin(t * 0.8) * 0.03) * e));
      g.hipsOffset.y = -0.02 * e;
    },

    // the guitar, played sitting down
    sitGuitar(g, t, dur, ctx) {
      POSES.guitar(g, t, dur, ctx);
      const e = env(t, dur, 0.8), b = ctx.guitar ? ctx.guitar.beat : 0;
      sitLegs(g, e);
      g.set('RightFoot', Q('x', (0.05 - 0.22 * Math.max(0, Math.sin(b * Math.PI * 2))) * e));
      g.hipsOffset.y = -0.02 * e;
    },

    // on the drum stool with nothing to play: knees apart, round-shouldered, hands hanging between the knees
    slouch(g, t, dur, ctx) {
      const e = env(t, dur, 0.9), br = Math.sin(t * 1.1) * 0.015;
      sitLegs(g, e);
      g.set('LeftUpLeg', Q('x', -1.4 * e, 'z', 0.3 * e));
      g.set('RightUpLeg', Q('x', -1.4 * e, 'z', -0.3 * e));
      g.set('Spine', Q('x', 0.3 * e));
      g.set('Spine1', Q('x', (0.35 + br) * e));
      g.set('Spine2', Q('x', 0.2 * e));
      g.set('Head', Q('x', 0.3 * e, 'y', Math.sin(t * 0.3) * 0.25 * e));
      const hang = (side) => g.boneWorld(`${side}Leg`).add(V(side === 'Left' ? -0.06 : 0.06, -0.12, 0.02));
      g.reach('Left', hang('Left'), e, false);
      g.reach('Right', hang('Right'), e, false);
      g.curl('Left', 0.3 * e); g.curl('Right', 0.3 * e);
      g.hipsOffset.y = -0.03 * e;
    },

    drumSit(g, t, dur, ctx) {
      const e = env(t, dur, 0.8);
      sitLegs(g, e);
      // knees apart so the feet can reach both pedals
      g.set('LeftUpLeg', Q('x', -1.4 * e, 'z', 0.34 * e));
      g.set('RightUpLeg', Q('x', -1.4 * e, 'z', -0.34 * e));
      const h = ctx.hob;
      if (!h) return;
      const nod = Math.sin(h.beat * Math.PI * 2) * 0.04 * h.w;
      g.set('Spine1', Q('x', 0.08 * h.w, 'y', Math.sin(h.beat * Math.PI) * 0.06 * h.w));
      const far = h.L.wrist.distanceTo(g.boneWorld('LeftArm')) > h.R.wrist.distanceTo(g.boneWorld('RightArm')) ? h.L.wrist : h.R.wrist;
      g.reachAssist(far, h.w * 0.9);
      hold(g, 'Left', h.L.wrist, h.w, h.L.f, h.L.palm);
      hold(g, 'Right', h.R.wrist, h.w, h.R.f, h.R.palm);
      g.curl('Left', 0.9 * h.w + 0.35 * (1 - h.w));
      g.curl('Right', 0.9 * h.w + 0.35 * (1 - h.w));
      gripThumb(g, 'Left', h.w); gripThumb(g, 'Right', h.w);
      g.set('Head', Q('x', 0.22 * h.w + nod, 'y', Math.sin(h.beat * Math.PI * 0.5) * 0.08 * h.w));
      g.set('RightFoot', Q('x', (0.05 - 0.45 * h.press) * e));
      g.set('LeftFoot', Q('x', (0.05 - 0.25 * Math.max(0, Math.sin(h.beat * Math.PI))) * e));
      g.hipsOffset.y = -0.02 * e;
    },

    paintStand(g, t, dur, ctx) {
      const h = ctx.hob;
      if (!h) return;
      const R = h.R;
      const adm = h.admire;
      if (h.L.w > 0.01) {
        hold(g, 'Left', h.L.wrist, h.L.w, h.L.f, h.L.palm);
        g.curl('Left', 0.35 + 0.3 * h.L.w);
      }
      g.set('Spine1', Q('x', 0.06 * (1 - adm)));
      g.reachAssist(R.wrist, R.w * (1 - adm));
      if (R.contact) {
        g.pointFinger('Right');
        g.reach('Right', R.tip, R.w, true, { palm: ctx.hob.R.palm });
      } else {
        hold(g, 'Right', R.wrist, R.w, R.f, R.palm);
        g.curl('Right', 0.7 * R.w);
      }
      g.set('Head', Q('x', 0.12 * (1 - adm) + 0.05 * adm, 'z', 0.12 * adm, 'y', -0.15 * adm));
    },

    scopeAim(g, t, dur, ctx) {
      const h = ctx.hob;
      if (!h) return;
      const side = h.hand;
      g.reachAssist(h.target, h.w * 0.9);
      g.reach(side, h.target, h.w, false, { hand: { fingers: fwdOf(g), palm: V(0, -1, 0) } });
      g.curl(side, 0.55 * h.w);
      g.set('Head', Q('x', 0.12 * h.w));
    },

    scopePeer(g, t, dur, ctx) {
      const h = ctx.hob;
      if (!h) return;
      const sc = h.sc;
      g.set('Spine', Q('x', sc.lean * 0.4));
      g.set('Spine1', Q('x', sc.lean * 0.4));
      g.set('Spine2', Q('x', sc.lean * 0.2));
      for (const side of ['Left', 'Right']) {
        g.set(`${side}UpLeg`, Q('x', -sc.crouch));
        g.set(`${side}Leg`, Q('x', sc.crouch * 2));
        g.set(`${side}Foot`, Q('x', -sc.crouch));
      }
      g.reach('Left', h.knob, h.w, true);          // the focus knob is on his left
      g.curl('Left', 0.8 * h.w);
      g.reach('Right', h.barrel, h.w, false);   // natural wrist (a forced flat hand bent past 120 degrees in some layouts)
      g.curl('Right', 0.5 * h.w);
      g.set('Head', Q('x', -sc.lean * 0.7 + 0.1 + h.look * 0.5));
    },

    scopeWrong(g, t, dur, ctx) {
      const h = ctx.hob;
      if (!h) return;
      const sc = h.sc;
      g.set('Spine', Q('x', sc.lean * 0.4));
      g.set('Spine1', Q('x', sc.lean * 0.4));
      g.set('Spine2', Q('x', sc.lean * 0.2));
      for (const side of ['Left', 'Right']) {
        g.set(`${side}UpLeg`, Q('x', -sc.crouch));
        g.set(`${side}Leg`, Q('x', sc.crouch * 2));
        g.set(`${side}Foot`, Q('x', -sc.crouch));
      }
      g.reach('Left', h.barrel, h.w * (1 - h.scratch), false);   // natural wrist: forcing the hand flat over the barrel bent it past what a wrist can do
      g.curl('Left', 0.5);
      if (h.scratch > 0.01) {
        const top = g.boneWorld('Head').add(V(0, 0.16, 0));
        g.reach('Right', top, h.scratch, true);
        g.curl('Right', 0.6 * h.scratch);
      }
      g.reach('Right', g.boneWorld('RightLeg').add(V(0, 0.1, 0.0)), h.w * (1 - h.scratch), false);   // otherwise the hand rests on his knee
      g.set('Head', Q('x', -sc.lean * 0.7 + 0.1, 'y', h.shake, 'z', h.shake * 0.4));
    },

    scopeCare(g, t, dur, ctx) {
      const h = ctx.hob;
      if (!h) return;
      if (h.low) {                                   // squat down beside the tripod
        for (const side of ['Left', 'Right']) {
          g.set(`${side}UpLeg`, Q('x', -0.75 * h.w));
          g.set(`${side}Leg`, Q('x', 1.5 * h.w));
          g.set(`${side}Foot`, Q('x', -0.75 * h.w));
        }
        g.set('Spine1', Q('x', 0.3 * h.w));
      }
      g.reachAssist(h.target, h.w);
      g.reach('Right', h.target, h.w, h.low ? true : false, { hand: { fingers: h.low ? V(0, -1, 0) : fwdOf(g), palm: h.low ? fwdOf(g) : V(0, -1, 0) } });
      g.curl('Right', 0.4 * h.w);
      g.set('Head', Q('x', 0.2 * h.w));
    },
  });
}
