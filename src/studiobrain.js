// GUY (and GAL) in the Studio: shows on the stage, dance parties on the floor, and records from the big wall played on the DJ booth.
// Installed onto Brain at the bottom of brain.js (like the Range and the Bowling Alley). The room is in studioobjects.js.
//
// A DJ visit: in through the door, to the wall, a record (an album sleeve or a single) off its shelf, over to the booth, onto the deck, and
// the music starts (or changes: a second record replaces the first). Only one robot is at the deck at a time. A show or a party asks the
// lights for its mood (`W.hold`) and gives it back when it is over. The last robot out stops the music it started and returns the record.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { TRACKS } from './audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ID = 'studio';
// the instruments (src/instruments.js): one activity for each, named for what it plays
export const STUDIO_INSTR_ACTS = { playbass: 'bass', playkeys: 'keyboard', playxylo: 'xylophone', playbongos: 'bongos' };
export const STUDIO_ACTS = ['studiodj', 'studioshow', 'studioparty', 'studiowatch', ...Object.keys(STUDIO_INSTR_ACTS)];
// What a long-press can point at in the Studio: the wall of records, the DJ booth and the Studio Machine
export const STUDIO_PIECES = ['recordwall', 'djbooth', 'studiomachine'];
export const STUDIO_INSTRUMENTS = Object.values(STUDIO_INSTR_ACTS);
const clamp = THREE.MathUtils.clamp;
const smooth = (x) => x * x * (3 - 2 * x);
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];

export function installStudio(Brain, POSES, H) {
  const { pick } = H;

  // ---- the poses
  // one hand out to a point (the wall, the deck, the machine), bending for it when it is low
  POSES.studioreach = (g, t, dur, ctx) => {
    const s = ctx.studio;
    if (!s || !s.point) return;
    const p = s.point();
    const k = smooth(clamp(t / Math.max(0.2, dur * 0.5), 0, 1)) * (1 - smooth(clamp((t - dur * 0.75) / (dur * 0.25), 0, 1)));
    const sh = g.boneWorld('RightArm');
    const low = clamp((sh.y - p.y - 0.45) / 0.8, 0, 1);
    g.hipsOffset.y = -0.3 * low * k;
    g.reach('Right', sh.clone().lerp(p, 0.4 + 0.6 * k), 1, false);
  };
  // at the decks: the right hand scratching the platter, the left on the mixer, the head nodding to the beat
  POSES.studiodj = (g, t, dur, ctx) => {
    const s = ctx.studio;
    if (!s || !s.point) return;
    const p = s.point(), q = s.left ? s.left() : p;
    const wob = Math.sin(t * 7) * 0.05;
    g.reach('Right', p.clone().add(V(wob, 0, wob * 0.6)), 1, false);
    g.reach('Left', q.clone().add(V(0, Math.sin(t * 3.5) * 0.02, 0)), 1, false);
    g.hipsOffset.y = -0.03 + Math.sin(t * 6.28) * 0.015;
  };
  // at the microphone: a hand at it, the other arm out, swaying
  POSES.sing = (g, t, dur, ctx) => {
    const s = ctx.studio;
    if (!s || !s.point) return;
    const p = s.point();
    const sh = g.boneWorld('LeftArm'), sway = Math.sin(t * 2.4);
    g.reach('Right', p, 1, false);
    g.reach('Left', sh.clone().add(V(-0.45, 0.1 + 0.25 * Math.max(0, Math.sin(t * 1.2)), 0.25)), 0.9, false);
    g.hipsOffset.y = Math.abs(Math.sin(t * 2.4)) * 0.02;
    g.set('Spine', new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), 0.06 * sway));
  };
  // at an instrument: both hands go where the player (below) sends them, the body bobbing to the beat
  POSES.studioplay = (g, t, dur, ctx) => {
    const s = ctx.studio;
    if (!s || !s.hand) return;
    const R = s.hand('Right'), L = s.hand('Left');
    const sh = g.boneWorld('RightArm'), low = clamp((sh.y - Math.min(R.y, L.y) - 0.3) / 0.5, 0, 1);
    g.hipsOffset.y = -0.15 * low + Math.sin(t * 5.2) * 0.012;
    g.set('Spine', new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.5 * low));                  // (leaning over the keys)
    g.reach('Right', R, 1, true);
    g.reach('Left', L, 1, true);
    g.set('Head', new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.05 * Math.sin(t * 5.2)));
  };
  // a bow: from the hips, both arms down, and up again
  POSES.bow = (g, t, dur) => {
    const k = clamp(t / dur, 0, 1), d = smooth(clamp(k / 0.35, 0, 1)) * (1 - smooth(clamp((k - 0.65) / 0.35, 0, 1)));
    const qx = (a) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a);
    g.set('Spine', qx(0.55 * d)); g.set('Spine1', qx(0.35 * d)); g.set('Head', qx(0.15 * d));
  };

  Object.assign(Brain.prototype, {
    inStudio() { return this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z) === ID; },
    lockedInStudio() { return !!this.lock && (STUDIO_PIECES.includes(this.lock.name) || STUDIO_INSTRUMENTS.includes(this.lock.name)) && this.inStudio(); },
    studioOpen() { return !!this.w.doors[ID] && !!this.w.studio && !this.doorLockedFor(ID); },
    studioSlot() { return this.isGal ? 1 : 0; },
    studioTrip(label, inner) {
      return [label, ...(this.inStudio() ? [] : this.doorIn(ID)), ...inner, ...(this.lockedInStudio() ? [] : this.doorOut(ID))];
    },
    studioReach(point, then, dur = 0.9, extra = {}) {
      return this.play('studioreach', dur, { studio: { point, ...extra }, at: [dur * 0.5, then] });
    },
    studioWait(cond, max) {
      const t0 = this.time;
      return [this.play('idle', 0.4), { type: 'plan', fn: () => (cond() || this.time - t0 > max ? [] : this.studioWait(cond, max - (this.time - t0))) }];
    },

    // ------------------------------------------------------------------ the records and the decks
    // the track a record plays: a single is one song, an album's songs take turns (not the one it played last)
    studioTrackFor(rec) {
      if (rec.kind === 'single') return rec.track;
      const ids = (rec.def.tracks || [rec.def.track]).filter((id) => TRACKS[id] && TRACKS[id].step);
      if (!ids.length) return 'default';
      this.lastTrackOf ||= {};
      const last = this.lastTrackOf[rec.def.id], fresh = ids.filter((id) => id !== last);
      return pickOf(fresh.length ? fresh : ids);
    },
    // which record: whatever the user asked for (requestStudioRecord), else a random one on the wall (more often a single than an album)
    studioWantRecord() {
      const W = this.w.studio, free = W.onWall();
      if (this.studioAsk) { const r = W.recordById(this.studioAsk); this.studioAsk = null; if (r && !r.out) return r; }
      return free.length ? pickOf(free) : null;
    },
    // the user picks a record from the wall's menu: GUY (whoever is free) goes and plays it
    requestStudioRecord(id) {
      const W = this.w.studio, rec = W && W.recordById(id);
      if (!rec || rec.out || !this.studioOpen()) return false;
      this.studioAsk = id;
      this.skip();
      this.choose('studiodj');
      return true;
    },
    studioDeckFree() { const W = this.w.studio; return !W || W.state.deckBy == null || W.state.deckBy === this; },
    // the whole DJ job: record off the wall, to the booth, onto the deck, the music on, a few minutes of scratching, and (if told) the record back
    studioDjSteps() {
      return [
        { type: 'plan', fn: () => {
          const W = this.w.studio;
          if (!W || !this.studioDeckFree()) { this.queue.length = 0; return []; }
          const rec = this.studioWantRecord();
          if (!rec) { this.queue.length = 0; return []; }
          W.state.deckBy = this; this.studioRec = rec; this.studioHold = false;
          const sp = W.wallStand(rec);
          return [
            this.walk(sp.x, sp.z, sp.yaw),
            this.studioReach(() => W.slot(rec), () => { if (rec.out) return; W.take(rec); this.studioHold = true; sfx('click'); }, 1.0),
            this.play('idle', 0.2),
            ...this.studioToDeck(rec),
          ];
        } },
      ];
    },
    studioToDeck(rec) {
      const W = this.w.studio, sp = W.deckStand();
      return [
        this.walk(sp.x, sp.z, sp.yaw),
        this.studioReach(() => W.deckPoint(), () => {
          const was = W.deckRecord();
          if (was) W.giveBack(was);                                             // the one that was on the deck goes back on its shelf
          this.studioHold = false;
          W.setDeckRecord(rec);
          const track = this.studioTrackFor(rec);
          this.studioStarted = !this.music;
          if (this.music) this.changeTrack(track); else this.musicOn(track);
          sfx('click');
        }, 1.1),
        this.play('studiodj', 7 + Math.random() * 4, { dance: true, studio: { point: () => W.deckPoint(), left: () => W.mixerPoint() } }),
        this.play('studiodj', 5 + Math.random() * 4, { dance: true, studio: { point: () => W.deckPoint(), left: () => W.mixerPoint() } }),
        { type: 'plan', fn: () => { if (W.state.deckBy === this) W.state.deckBy = null; return []; } },
      ];
    },
    // the music runs while somebody is still in the Studio; when the last robot leaves, whoever started it stops it and the record goes home
    studioCleanup() {
      const W = this.w.studio;
      if (!W) { this.studioHold = false; this.studioRec = null; return; }
      this.sp = null;
      if (W.state.deckBy === this) W.state.deckBy = null;                    // (cleanup runs when he picks something new: the deck is free)
      if (this.studioHold && this.studioRec && !this.inStudio()) { W.giveBack(this.studioRec); this.studioHold = false; }
      if (!this.inStudio() && this.studioHolds) { W.clearHolds(this); this.studioHolds = false; }
      const other = this.other, otherIn = !!other && other.inStudio && other.inStudio();
      if (!this.inStudio() && !otherIn && W.deckRecord() && !(this.music && this.userMusic)) {
        if (this.music && !this.userMusic) { this.musicOff(); this.studioStarted = false; }
        const rec = W.deckRecord();
        W.setDeckRecord(null);
        if (rec) W.giveBack(rec);
      }
    },
    // the lights for a show or a party
    studioHoldOn(kind, on) {
      const W = this.w.studio;
      if (!W) return;
      W.hold(kind, this, on);
      this.studioHolds = on || this.studioHolds;
    },

    // ------------------------------------------------------------------ the shows and the parties
    studioShowSteps() {
      const W = this.w.studio, i = this.studioSlot();
      const sp = W.stageSpot(i), front = W.stageFront(i);
      const moves = () => [pickOf(['disco', 'shuffle', 'pump']), pickOf(['robot', 'twirl', 'disco'])];
      return [
        ...(!this.music ? this.studioDjSteps() : []),
        { type: 'plan', fn: () => { if (!this.w.studio) { this.queue.length = 0; return []; } this.studioHoldOn('show', true); return []; } },
        this.walk(sp.x, sp.z, sp.yaw),
        this.play('studiodj', 0.01),                                         // (a beat before the song)
        { type: 'plan', fn: () => {
          const P = this.w.studio;
          if (!P) return [];
          const mic = () => P.micPoint(i);
          return [
            this.walk(front.x, front.z, front.yaw),
            this.play('sing', 8 + Math.random() * 3, { dance: true, studio: { point: mic } }),
            this.play(moves()[0], 7, { dance: true }),
            this.play('sing', 7 + Math.random() * 3, { dance: true, studio: { point: mic } }),
            this.play(moves()[1], 6, { dance: true }),
            this.play('wave', 2.4),
            this.play('bow', 2.2),
          ];
        } },
        { type: 'plan', fn: () => { this.studioHoldOn('show', false); return []; } },
      ];
    },
    studioPartySteps() {
      const k = this.studioSlot() * 7 + Math.floor(Math.random() * 7);
      const stepsAt = (n) => ({
        type: 'plan',
        fn: () => {
          const P = this.w.studio;
          if (!P) return [];
          const s = P.floorSpot(k + n * 3), pose = pickOf(['disco', 'robot', 'pump', 'shuffle', 'twist', 'twirl']);
          return [this.walk(s.x, s.z), this.play(pose, 8, { dance: true, ...(pose === 'twirl' ? { spin: 5.2 } : {}) })];
        },
      });
      return [
        ...(!this.music ? this.studioDjSteps() : []),
        { type: 'plan', fn: () => { if (!this.w.studio) { this.queue.length = 0; return []; } this.studioHoldOn('party', true); return []; } },
        stepsAt(0), stepsAt(1), stepsAt(2), stepsAt(3),
        this.play('wave', 2.2, { dance: true }),
        { type: 'plan', fn: () => { this.studioHoldOn('party', false); return []; } },
      ];
    },

    // ------------------------------------------------------------------ the activities
    studioActivities() {
      const play = (act) => () => this.studioTrip('playing the ' + STUDIO_INSTR_ACTS[act], [{ type: 'plan', fn: () => {
        const name = STUDIO_INSTR_ACTS[act], o = this.studioInst(act);
        if (!o) { this.queue.length = 0; return []; }
        const st = o.stand;
        return [this.walkAt(name, st.x, st.dz, Math.PI), this.play('studioplay', 16 + Math.random() * 10, { needs: [name], studio: { inst: name } }), this.play('bow', 2, { needs: [name] })];
      } }]);
      return {
        ...Object.fromEntries(Object.keys(STUDIO_INSTR_ACTS).map((a) => [a, play(a)])),
        // the bass is taken off its stand, put on (the strap over his shoulder) and played facing out, with his back to the stand and its amp
        playbass: () => this.studioTrip('playing the bass', [{ type: 'plan', fn: () => {
          const o = this.studioInst('playbass');
          if (!o) { this.queue.length = 0; return []; }
          const having = this.gtr.held && this.gname === 'bass', locked = !!this.lock && this.lock.name === 'bass', fx = { guitar: true, needs: ['bass'] };
          if (!having) this.takeUpBass();
          const at = this.bassSpot(o), stand = this.walkAt('bass', o.stand.x, o.stand.dz, Math.PI);
          return [
            ...(having ? [] : [stand, this.play('takeGuitar', 2.4, { ...fx, at: [1.0, () => this.setGuitarHeld(true)] })]),
            { ...this.walkAt('bass', at.x, at.dz, at.yaw), fx },
            this.play('guitar', 16 + Math.random() * 10, { ...fx, bassline: { steps: 0 }, sync: true }),
            ...(locked ? [] : [{ ...stand, fx }, this.play('putGuitar', 2.4, { ...fx, at: [1.3, () => this.setGuitarHeld(false)] })]),
          ];
        } }]),
        studiodj: () => this.studioTrip('spinning records', this.studioDjSteps()),
        studioshow: () => this.studioTrip('putting on a show', this.studioShowSteps()),
        studioparty: () => this.studioTrip('dancing in the Studio', this.studioPartySteps()),
        studiowatch: () => this.studioTrip('watching the Studio', [
          { type: 'plan', fn: () => { const W = this.w.studio; if (!W) { this.queue.length = 0; return []; } const s = W.crowdSpot(this.studioSlot()); return [this.walk(s.x, s.z, s.yaw), this.play('idle', 4 + Math.random() * 4), this.play('wave', 2), this.play('idle', 2 + Math.random() * 3)]; } },
        ]),
      };
    },

    // ------------------------------------------------------------------ playing an instrument
    // The instrument he is at (in the Studio, where he can stand at it), or null
    studioInst(act) {
      const o = this.obj(STUDIO_INSTR_ACTS[act]);
      return o && this.w.roomIdAt(o.x, o.z) === ID ? o : null;
    },
    // ------------------------------------------------------------------ the bass
    takeUpBass() {
      if (this.gname !== 'bass') { this.resetGuitarMesh(); this.gname = 'bass'; }
      if (this.using) this.using.add('bass');
    },
    // Where he plays it: a step further out than where he took it, if there is floor there (else beside it, else where he took it), his back to the stand.
    bassSpot(o) {
      for (const [x, dz] of [[o.playAt.x, o.playAt.dz], [o.playAt.x - 0.5, o.playAt.dz], [o.playAt.x + 0.5, o.playAt.dz]]) {
        const l = o.local(x, dz), px = o.x + l.x, pz = o.z + l.z;
        if (this.w.roomIdAt(px, pz) === ID && this.w.walkable(px, pz) && this.w.obstacles.every((b) => b.active === false || b === o.obstacle || px < b.x0 - 0.35 || px > b.x1 + 0.35 || pz < b.z0 - 0.35 || pz > b.z1 + 0.35)) return { x, dz, yaw: 0 };
      }
      return { x: o.stand.x, dz: o.stand.dz, yaw: 0 };
    },
    // The bass line: eighth notes, plucked one at a time with the right hand over the pickups, the left hand following the pitch up and down the
    // neck. With music on it is in time with it and follows its chords; otherwise a walking line of his own.
    playBassline(s, t, o, st) {
      const sync = !!this.music, step = 0.3, n = sync ? Math.floor(this.currentBeat() * 2) : Math.floor((t - 0.6) / step);
      if (n === st.n || t < 0.6) return;
      st.n = n;
      const k = ((n % 8) + 8) % 8, OWN = [33, 33, 29, 31];                                     // A A F G
      let root = sync ? H.chordAt(this.track, this.currentBeat()).notes[0] : OWN[Math.floor(n / 8) % 4];
      while (root > 43) root -= 12;
      while (root < 28) root += 12;
      const off = [0, null, 0, 7, null, 7, 10, 12][k];
      if (off === null) return;
      o.pluck(root + off, k === 0 ? 0.22 : 0.17);
      s.fx.bassline.steps++;
      st.fretGoal = clamp((root + off - 28) / 27 * 0.11 - 0.01, -0.01, 0.1);
      st.yGoal = s.fx.bassline.steps % 2 ? 0.035 : -0.035;                                     // index and middle fingers, one after the other
    },
    // what each instrument's player does on each beat: [{ side, idx, hit }] (idx: the place that hand goes to, see obj.reach / obj.hand)
    studioBeat(kind, n, P) {
      const walk = (a, lo, hi) => clamp(a + pickOf([-2, -1, -1, 0, 1, 1, 2]), lo, hi);
      if (kind === 'keyboard') {
        const out = [];
        if (n % 4 !== 3) { P.r = walk(P.r ?? 3, 0, 6); out.push({ side: 'Right', idx: P.r, hit: true }); }
        if (n % 2 === 0) out.push({ side: 'Left', idx: [0, 2, 3, 4][(n >> 1) % 4], hit: true });
        return out;
      }
      if (kind === 'xylophone') {
        const m = n % 22, idx = m < 12 ? m : 22 - m;
        return [{ side: idx < 6 ? 'Left' : 'Right', idx, hit: true }];
      }
      if (kind === 'bongos') {
        const c = 'LRRLRLRR'[n % 8];
        return n % 8 === 7 && Math.random() < 0.5 ? [] : [{ side: c === 'L' ? 'Left' : 'Right', idx: 0, hit: true }];
      }
      return [];
    },
    // the player: a beat clock, and where each hand is (it travels to its next place and touches it on the way down: that is when it sounds)
    studioPlayer(s) {
      const name = s.fx.studio.inst, o = this.obj(name);
      if (!o || !o.hand) return null;
      let P = this.sp;
      if (!P || P.step !== s) {
        const period = { keyboard: 0.36, xylophone: 0.3, bongos: 0.22 }[name] || 0.4;
        P = this.sp = { step: s, name, t0: this.time, beat: -1, period, hands: {} };
        for (const side of ['Left', 'Right']) P.hands[side] = { from: 0, idx: 0, t0: this.time, hit: true, pos: o.hand(side, 0) };
      }
      const now = this.time, beat = Math.floor((now - P.t0) / P.period);
      while (P.beat < beat) {
        P.beat++;
        for (const m of this.studioBeat(name, P.beat, P)) {
          const h = P.hands[m.side];
          h.from = h.idx; h.idx = m.idx; h.t0 = P.t0 + P.beat * P.period; h.hit = !m.hit;
        }
      }
      for (const side of ['Left', 'Right']) {
        const h = P.hands[side], k = clamp((now - h.t0) / (P.period * 0.95), 0, 1), a = o.hand(side, h.from), b = o.hand(side, h.idx);
        if (!h.hit && k >= 0.7) { h.hit = true; o.hit(side, h.idx, P.hands.Left.idx); }
        const move = smooth(Math.min(1, k / 0.7));
        h.pos = a.lerp(b, move);
        if (k < 0.7 && h.from !== h.idx || k < 0.7 && !h.hit) h.pos.y += Math.sin(Math.PI * Math.min(1, k / 0.7)) * 0.1;
      }
      return { hand: (side) => P.hands[side].pos };
    },
    // the context the poses read
    studioCtx(s) {
      const st = s.fx && s.fx.studio;
      if (st && st.inst) return this.studioPlayer(s);
      return st || null;
    },
    // after the arm is solved: the sleeve in his right hand while he carries it (and only in the Studio)
    studioLate() {
      const W = this.w.studio;
      if (!W) return;
      const held = W.held(this.isGal);
      const on = this.studioHold && !!this.studioRec && this.g.loaded && this.inStudio();
      if (!on) {
        if (held.visible) held.hide();
        if (this.studioHold && !this.inStudio() && this.studioRec) { W.giveBack(this.studioRec); this.studioHold = false; }
        return;
      }
      held.set(this.studioRec);
      const fr = this.handFrame('Right');
      const c = fr.wrist.clone().addScaledVector(fr.f, 0.12).addScaledVector(fr.palm, 0.05);
      held.place(c);
      this.g.curl('Right', 0.4);
    },
  });
}
