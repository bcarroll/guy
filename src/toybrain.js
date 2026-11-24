// GUY and GAL with the things that used to be only for looking at: every easter egg GUY builds in the Workshop, everything the Build a Bot
// machine prints, the coffee table, the nightstand and the wooden shelves. Each has something a robot can do with it (the owner's rule:
// "GUY can't do anything with that" makes an object less attractive), from the long-press menu and on their own.
//
//   toy      play with one of the toys and curios: spin the mirror ball, squeeze the rubber duck, shake the snow globe, feed the fish ...
//            (one activity; what he does depends on the thing: TOYS below). The thing reacts (room.js: `group.userData.poke`).
//   arcade   play "Robo Blaster" on the Arcade Cabinet: a coin in, his hands on the stick and the fire button, the game on its screen
//            (src/arcade.js) until it is over. The user watches it on the cabinet or in the big arcade view (main.js).
//   jukebox  a song on the jukebox, a dance to it, and the music off again
//   tidyup   look after the furniture: straighten the coffee table, set the nightstand's clock and tidy its drawer, dust the shelves
//
// Merged into the Bedroom and Library furniture's tables (homebrain.js HOME_ACTS / HOME_KIND_ACTS): the objects are found by KIND (or by
// name for the coffee table and the nightstand, which have no kind) when the activity is planned, and every step says what it needs, so
// the user can take a thing away at any moment.
import * as THREE from 'three';
import { sfx } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;

// What a robot does with each thing, and what the long-press menu calls it. `front`: how far in front of it he stands (from its front face).
export const TOYS = {
  mirrorball: { thing: 'mirror ball', menu: '🪩 Spin the Mirror Ball', doing: 'giving the mirror ball a spin', front: 0.3 },
  trophy: { thing: 'trophy', menu: '🏆 Polish the Trophy', doing: 'polishing the trophy', front: 0.25 },
  lavalamp: { thing: 'lava lamp', menu: '🫧 Switch the Lava Lamp', doing: 'switching the lava lamp off and on', front: 0.25 },
  crystalball: { thing: 'crystal ball', menu: '🔮 Gaze into the Crystal Ball', doing: 'gazing into the crystal ball', front: 0.2 },
  rubberduck: { thing: 'rubber duck', menu: '🦆 Squeeze the Duck', doing: 'squeezing the rubber duck', front: 0.2 },
  gnome: { thing: 'gnome', menu: '🧙 Pat the Gnome', doing: 'patting the garden gnome on the hat', front: 0.2 },
  toyrocket: { thing: 'toy rocket', menu: '🚀 Launch the Rocket', doing: 'launching the toy rocket', front: 0.22 },
  piggybank: { thing: 'piggy bank', menu: '🐷 Drop a Coin In', doing: 'dropping a coin in the piggy bank', front: 0.2 },
  grandfatherclock: { thing: 'grandfather clock', menu: '🕰️ Wind the Clock', doing: 'winding the grandfather clock', front: 0.2 },
  bubblemachine: { thing: 'bubble machine', menu: '🫧 Make Bubbles', doing: 'making bubbles', front: 0.22 },
  snowglobe: { thing: 'snow globe', menu: '❄️ Shake the Snow Globe', doing: 'shaking the snow globe', front: 0.2 },
  petrock: { thing: 'pet rock', menu: '🪨 Pat the Pet Rock', doing: 'patting the pet rock', front: 0.2 },
  fishtank: { thing: 'fish tank', menu: '🐠 Feed the Fish', doing: 'feeding the fish', front: 0.25 },
  aquarium: { thing: 'aquarium', menu: '🐟 Feed the Fish', doing: 'feeding the fish in the aquarium', front: 0.28 },
  rubberchicken: { thing: 'rubber chicken', menu: '🐔 Squeeze the Chicken', doing: 'squeezing the rubber chicken', front: 0.2 },
  flamingo: { thing: 'flamingo', menu: '🦩 Straighten the Flamingo', doing: 'straightening the flamingo', front: 0.25 },
  neonsign: { thing: 'neon sign', menu: '💡 Flick the Neon Sign', doing: 'flicking the neon sign off and on', front: 0.25 },
  plasmaglobe: { thing: 'plasma globe', menu: '⚡ Touch the Plasma Globe', doing: 'touching the plasma globe', front: 0.22 },
  robopet: { thing: 'robo pet', menu: '🐕 Pat the Robo Pet', doing: 'patting the robo pet', front: 0.22 },
};
// the furniture that was only furniture: looked after (by name: the coffee table and the nightstand have no kind)
export const TIDY = {
  coffeetable: { thing: 'coffee table', menu: '☕ Tidy the Coffee Table', doing: 'tidying the coffee table' },
  nightstand: { thing: 'nightstand', menu: '🕰️ Set the Clock', doing: 'setting the clock and tidying the nightstand' },
  woodshelves: { thing: 'wooden shelves', menu: '🗄️ Dust the Shelves', doing: 'dusting the wooden shelves' },
};
export const TOY_ACTS = { toy: Object.keys(TOYS), arcade: ['arcade'], jukebox: ['jukebox'], tidyup: Object.keys(TIDY) };
export const TOY_KIND_ACTS = { ...Object.fromEntries(Object.keys(TOYS).map((k) => [k, ['toy']])), arcade: ['arcade'], jukebox: ['jukebox'], ...Object.fromEntries(Object.keys(TIDY).map((k) => [k, ['tidyup']])) };
// what the long-press menu's first button says for each (main.js interactLabel)
export const TOY_MENU = { ...Object.fromEntries(Object.entries(TOYS).map(([k, v]) => [k, v.menu])), ...Object.fromEntries(Object.entries(TIDY).map(([k, v]) => [k, v.menu])), arcade: '🕹️ Play the Arcade', jukebox: '🎶 Play the Jukebox' };
// the crystal ball's fortunes
const FORTUNES = ['a new book on the shelf', 'a strike at the bowling alley', 'a high score at the arcade', 'a full restaurant', 'a painting worth hanging', 'a song stuck in his head', 'a clear night for the telescope', 'a very good day'];

export function installToys(Brain, POSES, H) {
  const { rand, pick, squat } = H;
  const Qx = (a) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a);

  // Both hands on a thing he holds where it stands (the crystal ball, the snow globe): each hand goes where `ctx.studio.hand(side)` says, and
  // for a thing low down he bends his knees and leans over it (as `reach` does for one hand), so his hands really get there.
  POSES.toyhold = (g, t, dur, ctx) => {
    const s = ctx.studio;
    if (!s || !s.hand) return;
    const R = s.hand('Right'), L = s.hand('Left');
    if (!R || !L) return;
    const e = clamp(t / 0.5, 0, 1) * clamp((dur - t) / 0.4, 0, 1), low = clamp((1.0 - Math.min(R.y, L.y)) / 0.55, 0, 1) * e;
    if (low > 0) {
      const k = 1.2 * low;
      squat(g, k);
      g.hipsOffset.y -= 0.84 * (1 - Math.cos(0.75 * k));                    // (the hips go down as the knees bend, so his feet stay on the floor)
      g.set('Spine', Qx(0.3 * low)); g.set('Spine1', Qx(0.35 * low));
    }
    g.reach('Right', R, e, true);
    g.reach('Left', L, e, true);
    g.set('Head', Qx(0.2 * e));
  };
  // At the arcade's controls: the left hand round the joystick's ball, the right over the fire button (each where `ctx.studio.hand(side)` says,
  // the wrist just behind it: `reach`'s "fingertips on it" would leave his hands hovering a hand's length above the panel), his head up at the
  // screen, bobbing a little with the game. One pose for every second of play, so the hands never leave the controls between them.
  POSES.arcadeplay = (g, t, dur, ctx) => {
    const s = ctx.studio;
    if (!s || !s.hand) return;
    const R = s.hand('Right'), L = s.hand('Left');
    if (!R || !L) return;
    g.hipsOffset.y = -0.04 + Math.sin(t * 5.2) * 0.008;
    g.set('Spine', Qx(0.12));
    g.reach('Right', R, 1, 0.06);
    g.reach('Left', L, 1, 0.06);
    g.set('Head', Qx(-0.08 + 0.03 * Math.sin(t * 2.6)));
  };
  // One hand out to a point (the `reach` pose's way, index finger out), bending at the knees and leaning over for anything below his waist: the
  // toys stand on the floor, the duck and the pet rock are knee high, and a plain reach stops well short of them.
  POSES.toyreach = (g, t, dur, ctx) => {
    const target = ctx.tgt.reach;
    if (!target) return;
    const e = clamp(t / 0.5, 0, 1) * clamp((dur - t) / 0.45, 0, 1), s = e * e * (3 - 2 * e);
    const low = clamp((1.0 - target.y) / 0.6, 0, 1) * s;
    if (low > 0) {
      const k = 1.35 * low;
      squat(g, k);
      g.hipsOffset.y -= 0.84 * (1 - Math.cos(0.75 * k));
      g.set('Spine', Qx(0.35 * low)); g.set('Spine1', Qx(0.4 * low));
    }
    g.reachAssist(target, s * (1 - 0.5 * low));
    g.reach('Right', target, s);
    if (s > 0.2) g.pointFinger('Right');
    g.set('Head', Qx(0.15 * s));
  };

  Object.assign(Brain.prototype, {
    // the one a toy activity is done at when nobody pointed at one: the next after the one he used last (so he gets round to all of them)
    toyNext(act, all) {
      const last = (this.lastHome || {})[act];
      const i = all.findIndex((o) => o.name === last);
      return i < 0 ? all[0] : all[(i + 1) % all.length];
    },
    // how good his pilot is at Robo Blaster: better the more games he has played (and it is remembered for the visit)
    arcadeSkill() { return clamp(0.35 + 0.06 * (this.arcadeGames || 0), 0.35, 0.9); },
    // Cut short (or finished) at the arcade: let go of the game. Called from choose() and at the end of the activity.
    toyCleanup() {
      const game = this.arcadeOn; this.arcadeOn = null;
      if (game) game.stop();                 // (the game itself, not the cabinet: taken away mid-game, its view still closes)
    },
    toyActivities() {
      const stand = (o, front, target, sides) => this.stand(o.name, front, target, sides);
      // an object-local point (x right, y up, z towards him) in the world, looked up when it is needed
      const P = (n, x, y, z) => () => { const o = this.obj(n); if (!o) return null; o.group.updateWorldMatrix(true, false); return o.group.localToWorld(V(x, y, z)); };
      const reach = (n, p, dur, at, fn) => this.play('toyreach', dur, { needs: [n], at: [at ?? dur * 0.55, fn || (() => {})], target: typeof p === 'function' ? p : P(n, ...p) });
      // one hand across from a to b (a spin, a straightening push)
      const sweep = (n, a, b, dur, at, fn) => {
        const t0 = { v: 0 };
        return this.play('toyreach', dur, { needs: [n], at: [at, fn], target: () => { if (!t0.v) t0.v = this.time; const k = clamp((this.time - t0.v - 0.45) / Math.max(0.2, dur - 0.9), 0, 1); const A = P(n, ...a)(), B = P(n, ...b)(); return A && B ? A.lerp(B, k) : null; } });
      };
      // a cloth (his hand) to and fro across a spot, with the wipe sound now and then
      const wipe = (n, c, dx, dur, end) => {
        const t0 = { v: 0, k: -1 };
        return this.play('toyreach', dur, { needs: [n], at: [dur - 0.4, end || (() => {})], target: () => {
          if (!t0.v) t0.v = this.time;
          const u = this.time - t0.v, k = Math.floor(u * 2);
          if (k !== t0.k && u > 0.5 && u < dur - 0.5) { t0.k = k; sfx('wipe', 0.35); }
          return P(n, c[0] + Math.sin(u * 4.2) * dx * clamp((u - 0.4) / 0.4, 0, 1), c[1], c[2])();
        } });
      };
      // both hands on it (the pose `toyhold` below): `hands(side, u)` gives each hand's point, u the seconds so far
      const both = (n, dur, hands, at, fn) => {
        const t0 = { v: 0 };
        const hand = (side) => { if (!t0.v) t0.v = this.time; return hands(side, this.time - t0.v); };
        return this.play('toyhold', dur, { needs: [n], at: [at ?? 0.3, fn || (() => {})], studio: { hand } });
      };
      const poke = (n, k) => { const o = this.obj(n); if (o && o.group.userData.poke) o.group.userData.poke(k); };
      const light = (n, on) => { const o = this.obj(n); if (o && o.group.userData.light) o.group.userData.light(on); };
      const look = (n, dur, pose = 'ponder') => this.play(pose, dur, { needs: [n] });
      const idle = (n, dur = 0.5) => this.play('idle', dur, { needs: [n] });
      const who = this.isGal ? 'GAL' : 'GUY';

      // what he does with each toy: the steps after he has walked up to it (n: its name)
      const SCRIPTS = {
        mirrorball: (n) => [sweep(n, [0.24, 1.42, 0.1], [-0.2, 1.42, 0.14], 1.4, 0.85, () => { poke(n, 'spin'); sfx('whoosh'); }), look(n, rand(1.5, 2.5)), this.play('disco', rand(5, 7), { needs: [n] }), idle(n)],
        trophy: (n) => [wipe(n, [0, 0.8, 0.16], 0.07, 3.6, () => { poke(n, 'shine'); sfx('chime'); }), this.play('pump', 2, { needs: [n] }), idle(n)],
        lavalamp: (n) => [reach(n, [0.1, 0.5, 0.17], 1.3, 0.7, () => { light(n, false); sfx('click'); }), look(n, 1.6, 'idle'), reach(n, [0.1, 0.5, 0.17], 1.3, 0.7, () => { light(n, true); poke(n, 'on'); sfx('click'); }), look(n, rand(3, 4.5)), idle(n)],
        crystalball: (n) => [
          both(n, 4.5, (side, u) => { const s = side === 'Right' ? 1 : -1, a = u * 1.6 * s; return P(n, s * (0.17 + 0.03 * Math.sin(a)), 0.58 + 0.05 * Math.sin(u * 2.1), 0.1 + 0.05 * Math.cos(a))(); }, 0.6, () => { poke(n, 'gaze'); sfx('chime'); }),
          { type: 'plan', fn: () => { this.ui(`the crystal ball shows ${who} ${pick(FORTUNES)}`); return []; } },
          look(n, rand(2.5, 3.5)), idle(n)],
        rubberduck: (n) => [reach(n, [0.04, 0.42, 0.04], 1.2, 0.7, () => { poke(n, 'squeeze'); sfx('squeak', 0); }), reach(n, [0.04, 0.42, 0.04], 1.1, 0.6, () => { poke(n, 'squeeze'); sfx('squeak', 0); }), look(n, 1.6, 'wave'), idle(n)],
        gnome: (n) => [reach(n, [0, 0.66, 0.04], 1.1, 0.65, () => { poke(n, 'pat'); sfx('knock', 0.8); }), reach(n, [0, 0.66, 0.04], 1.0, 0.55, () => { poke(n, 'pat'); sfx('knock', 0.8); }), look(n, rand(1.5, 2.5)), idle(n)],
        toyrocket: (n) => [reach(n, [0.13, 0.14, 0.13], 1.4, 0.8, () => { poke(n, 'launch'); sfx('whoosh'); }), look(n, 1.8, 'lookaround'), this.play('pump', 1.8, { needs: [n] }), idle(n)],
        piggybank: (n) => [reach(n, [0, 0.5, 0.02], 1.4, 0.85, () => { poke(n, 'coin'); sfx('cash'); }), look(n, rand(1.5, 2.2)), idle(n)],
        grandfatherclock: (n) => {
          const t0 = { v: 0, k: -1 };
          return [this.play('toyreach', 3.2, { needs: [n], at: [2.9, () => { poke(n, 'wind'); sfx('chime'); }], target: () => {
            if (!t0.v) t0.v = this.time;
            const u = this.time - t0.v, k = Math.floor(u * 3);
            if (k !== t0.k && u > 0.6 && u < 2.8) { t0.k = k; sfx('tick'); }
            return P(n, 0.03 * Math.cos(u * 6), 1.62 + 0.03 * Math.sin(u * 6), 0.2)();       // (round and round: the key in the face)
          } }), look(n, rand(2.5, 3.5)), idle(n)];
        },
        bubblemachine: (n) => [reach(n, [0, 0.32, 0.2], 1.3, 0.75, () => { poke(n, 'bubbles'); sfx('click'); }),
          ...[[0.1, 0.95, 0.4], [-0.12, 1.15, 0.35], [0.05, 1.3, 0.3]].map((p) => reach(n, p, 1.0, 0.6, () => sfx('pop'))), look(n, 1.5), idle(n)],
        snowglobe: (n) => [
          both(n, 2.8, (side, u) => { const s = side === 'Right' ? 1 : -1, k = clamp((u - 0.5) / 0.4, 0, 1) * (u < 2.3 ? 1 : 0); return P(n, s * 0.2, 0.36 + 0.04 * Math.sin(u * 22) * k, 0.02)(); }, 0.8, () => { poke(n, 'shake'); sfx('swish'); }),
          look(n, rand(3.5, 4.5)), idle(n)],
        petrock: (n) => [reach(n, [0, 0.27, 0.04], 1.1, 0.65, () => { poke(n, 'pat'); sfx('knock', 0.6); }), reach(n, [0, 0.27, 0.04], 1.0, 0.55, () => { poke(n, 'pat'); sfx('knock', 0.6); }), look(n, 1.5, 'wave'), idle(n)],
        fishtank: (n) => [wipe(n, [0, 0.88, 0], 0.05, 1.8, () => { poke(n, 'feed'); sfx('leaf'); }), look(n, rand(4, 5.5)), idle(n)],
        aquarium: (n) => [wipe(n, [0, 1.18, 0.05], 0.08, 1.8, () => { poke(n, 'feed'); sfx('leaf'); }), look(n, rand(4, 5.5)), idle(n)],
        rubberchicken: (n) => [reach(n, [0.05, 0.42, 0.04], 1.2, 0.7, () => { poke(n, 'squeeze'); sfx('squeak', 1); }), reach(n, [0.05, 0.42, 0.04], 1.1, 0.6, () => { poke(n, 'squeeze'); sfx('squeak', 1); }), look(n, 1.8, 'akimbo'), idle(n)],
        flamingo: (n) => [sweep(n, [0.12, 0.84, 0.08], [0.04, 0.86, 0.08], 1.4, 0.9, () => { poke(n, 'straighten'); sfx('thud', 0.15); }), look(n, 1.8, 'akimbo'), idle(n)],
        neonsign: (n) => [reach(n, [0.4, 0.62, 0.06], 1.2, 0.7, () => { light(n, false); sfx('click'); }), look(n, 1.4, 'idle'), reach(n, [0.4, 0.62, 0.06], 1.2, 0.7, () => { light(n, true); poke(n, 'light'); sfx('click'); }), look(n, rand(2.5, 3.5)), idle(n)],
        plasmaglobe: (n) => [reach(n, [0, 0.66, 0.1], 4.2, 0.7, () => { poke(n, 'touch'); sfx('holo'); }), look(n, rand(1.5, 2.5)), idle(n)],
        robopet: (n) => [reach(n, [0.24, 0.5, 0.02], 1.1, 0.65, () => { poke(n, 'pat'); sfx('pop'); }), reach(n, [0.24, 0.5, 0.02], 1.0, 0.55, () => { poke(n, 'pat'); sfx('pop'); }), look(n, rand(2, 3), 'lookaround'), idle(n)],
      };
      const TIDY_SCRIPTS = {
        coffeetable: (n) => [reach(n, [-0.2, 0.54, 0.08], 1.3, 0.7, () => sfx('bookgrab')), wipe(n, [0.18, 0.47, 0.05], 0.18, 2.8), reach(n, [0.25, 0.53, 0], 1.2, 0.65, () => sfx('plate')), idle(n)],
        nightstand: (n) => [reach(n, [0.12, 0.66, 0.04], 1.6, 0.6, () => sfx('tick')), reach(n, [0, 0.42, 0.24], 1.3, 0.7, () => sfx('lid')), reach(n, [0, 0.45, 0.14], 1.6, 0.8, () => sfx('click')), reach(n, [0, 0.42, 0.24], 1.2, 0.6, () => sfx('lid')), idle(n)],
        woodshelves: (n) => [wipe(n, [0, 1.16, 0.14], 0.28, 2.4), wipe(n, [0, 0.8, 0.14], 0.28, 2.4), wipe(n, [0, 0.44, 0.14], 0.28, 2.4), idle(n)],
      };

      return {
        toy: () => {
          const o = this.homeObj('toy');
          if (!o) return ['nothing to play with', this.play('idle', 0.5)];
          const k = o.kind, def = TOYS[k];
          (this.lastHome ||= {}).toy = o.name;
          return [def.doing, stand(o, o.bd / 2 + def.front, P(o.name, 0, o.h * 0.7, 0), [0, 1, 3]), ...SCRIPTS[k](o.name)];
        },
        tidyup: () => {
          const o = this.homeObj('tidyup');
          if (!o) return ['nothing to tidy', this.play('idle', 0.5)];
          const k = o.kind || o.name;
          (this.lastHome ||= {}).tidyup = o.name;
          return [TIDY[k].doing, stand(o, o.bd / 2 + 0.22, P(o.name, 0, o.h * 0.8, 0), [0]), ...TIDY_SCRIPTS[k](o.name)];
        },
        // a song on the jukebox (the record player's way: recordOn, so the music stops when he is done or called away), and a dance to it
        jukebox: () => {
          const o = this.homeObj('jukebox');
          if (!o) return ['no jukebox to play', this.play('idle', 0.5)];
          const n = o.name, songs = this.trackList().filter((t) => t.id !== 'default'), song = songs.length ? pick(songs) : { id: 'default', title: 'a song' };
          (this.lastHome ||= {}).jukebox = n;
          const off = () => this.recordCleanup();
          const on = () => { if (!this.music) this.musicOn(song.id); this.recordOn = n; const j = this.obj(n); if (j && j.group.userData.setPlaying) j.group.userData.setPlaying(true); sfx('click'); };
          return [`putting ${song.id === 'default' ? 'a song' : `"${song.title}"`} on the jukebox`,
            stand(o, 0.5, P(n, 0, 0.68, 0.27), [0]),
            reach(n, [0, 0.68, 0.3], 1.4, 0.8, on),
            this.play(pick(['disco', 'twist', 'robot', 'shuffle']), rand(10, 15), { needs: [n] }),
            reach(n, [0, 0.68, 0.3], 1.3, 0.7, off),
            this.play('idle', 0.5, { needs: [n], onEnd: off })];
        },
        // Robo Blaster: a coin in, both hands on the controls, the game played to the end (or for a good while), then a cheer or a shrug
        arcade: () => {
          const o = this.homeObj('arcade');
          if (!o) return ['no arcade to play', this.play('idle', 0.5)];
          const n = o.name, cab = () => this.obj(n), game = () => cab() && cab().group.userData.arcade;
          (this.lastHome ||= {}).arcade = n;
          const t0 = { v: 0 }, maxPlay = 75;
          const start = () => { const g = game(); if (!g) return; this.arcadeGames = (this.arcadeGames || 0) + 1; g.start(who, { skill: this.arcadeSkill(), seed: this.arcadeSeed || 0 }); this.arcadeOn = g; t0.v = this.time; };
          // the hands follow the game: the left on the stick, leaning it the way the ship goes; the right on the fire button, down when it fires
          const hands = (side) => {
            const c = cab(), g = game();
            if (!c || !g) return null;
            if (side === 'Left') { const p = c.group.userData.stickTop(); const lean = g.mode === 'play' ? g.input.x : 0; return p.add(V(0.035 * lean, 0, 0).applyQuaternion(c.group.quaternion)); }
            const p = c.group.userData.buttonTop(); return p.add(V(0, g.mode === 'play' && g.input.fire ? -0.004 : 0.02, 0));
          };
          const playing = () => [this.play('arcadeplay', 1.0, { needs: [n], studio: { hand: hands } }), { type: 'plan', fn: () => {
            const g = game();
            if (!g || g.mode === 'attract') return [];
            if (g.mode === 'over' || this.time - t0.v > maxPlay) return [];
            return playing();
          } }];
          const end = () => {
            const g = game(), best = g && g.newHi;
            if (g) this.ui(best ? `a new high score at Robo Blaster: ${g.score}!` : `Robo Blaster: ${g ? g.score : 0} points`);
            return [this.play(best ? 'pump' : 'ponder', best ? 2.2 : 1.6, { needs: [n] }), this.play('idle', 0.4, { needs: [n], at: [0.2, () => this.toyCleanup()] })];
          };
          return ['playing Robo Blaster on the arcade',
            stand(o, 0.45, P(n, 0, 0.86, 0.27), [0]),
            reach(n, [0.18, 0.75, 0.24], 1.2, 0.7, () => { sfx('cash'); start(); }),
            ...playing(),
            { type: 'plan', fn: end }];
        },
      };
    },
  });
}
