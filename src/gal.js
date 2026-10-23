// GAL: the second robot, built from the Mixamo X Bot model ("Genetically Alternate Layout"). Guy builds her at the Build a Bot machine
// (a super premium, one-use printer that folds itself into her). From then on she is an autonomous humanoid robot: she runs her own
// Brain (GalBrain, below), chooses what to do herself like Guy does, has her own skills and must read books to gain them, and can be
// asked by Guy to do things (go and read the drumming books, and find him when she is done so that they can jam).
//
// Two robots share one room, so a few rules keep them apart: each is an obstacle for the other's pathing (`world.charObs`), only one can
// use the piano, drums, guitar, easel or telescope at a time (`using` / `exclusiveFor` in brain.js), and the stereo is shared (GalBrain
// reads and writes Guy's music state, so what one switches on the other hears and can join in).
//
// This file has three parts: GalBrain (her brain), Gal (the manager: building her, her model, saving, how the two of them talk) and
// the Guy-side activities (`installGalGuy`): building her, and asking her for things.
import * as THREE from 'three';
import { Guy } from './guy.js';
import { Brain, POSES, basePose } from './brain.js';
import { Skills } from './skills.js';
import { sfx } from './sfx.js';

const KEY = 'guy.gal.v1';
const SKILL_KEYS = { known: 'guy.gal.skills.v1', fade: 'guy.gal.fade.v1' };
const COLORS = { body: 0xd8438a, joints: 0x2a2030 };       // GAL is pink; Guy is gold
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// What the two of them can play together: the instrument, the activity that plays it along with the stereo, the skills for that
// activity, the objects it needs, and the family of books that teach it (she reads them all, in order).
export const BAND = {
  drums: { act: 'jamdrums', skills: ['drums.band'], objects: ['drums'], family: ['drums', 'drums.solo', 'drums.band'], label: 'drums' },
  guitar: { act: 'jamguitar', skills: ['guitar'], objects: ['guitar'], family: ['guitar'], label: 'guitar' },
  piano: { act: 'jampiano', skills: ['piano'], objects: ['piano'], family: ['piano', 'piano.advanced'], label: 'piano' },
};

// ================================================================================================================ her brain
export class GalBrain extends Brain {
  constructor(guy, world, ui, skills, leader) {
    super(guy, world, ui, skills);
    this.isGal = true;
    this.leader = leader;               // Guy's brain
    this.other = leader;
    leader.other = this;
    this.using = new Set();
    this.orders = [];                   // things Guy has asked her to do, in order: { kind: 'read', book } | { kind: 'find' }
    this.curOrder = null;
    // the stereo is shared: she reads and writes Guy's music state
    for (const k of ['music', 'musicT0', 'beatLen', 'track', 'albumOnTable', 'userMusic', 'trackSince', 'trackFor', 'lastTrackOf', 'lastAlbumId']) {
      Object.defineProperty(this, k, { get: () => leader[k], set: (v) => { leader[k] = v; }, configurable: true });
    }
  }

  // she does not use the Workshop, push furniture about or build robots; and she needs the stereo for her invitation
  galBlocks(act) {
    if (['makewood', 'sawwood', 'tap', 'sand', 'tidytools', 'makemetal', 'cutmetal', 'hammer', 'weld', 'rearrange', 'buildbot', 'bandjam', 'bandplay'].includes(act)) return true;       // (she does build what the house needs: 'build')
    if (act === 'invitedance') return !(this.obj('table') && this.skills.has('stereo') && !this.music && this.w.gal.canInvite());
    return false;
  }

  extraWeights() { return { invitedance: 1.3 }; }

  // the next thing Guy asked her to do, as an activity name
  nextOrder() {
    while (this.orders.length) {
      const o = this.orders[0];
      if (o.kind === 'read') {
        if (this.busyElsewhere(['shelf'])) return null;                    // Guy is at the bookshelf: she waits her turn (and does something else meanwhile)
        const on = this.obj('shelf') && this.obj('shelf').books.find((b) => b.def.id === o.book);
        if (!on || this.skills.has(on.def.teaches)) { this.orders.shift(); continue; }          // already learned, or the book is not on the shelf any more
        if (!on.mesh.visible) return null;                                                      // Guy has it in his hands just now: she waits for it
        return 'galread';
      }
      return 'findguy';
    }
    return null;
  }
  shelfBook(id) { const sh = this.obj('shelf'); return sh ? sh.books.find((b) => b.def.id === id && b.mesh.visible) : null; }

  choose(force) {
    this.curOrder = null;
    if (!force && !this.pendingActivity) {
      const n = this.nextOrder();
      if (n) { this.curOrder = this.orders[0]; force = n; }
    }
    super.choose(force);
  }

  danceSpot() { return { x: 1.4, z: 0.9 }; }
  waveSpot() { return { x: -1.4, z: 2.2 }; }

  activities() {
    const acts = super.activities();
    const w = this.w, lead = this.leader;
    return {
      ...acts,
      // an order: read one particular book (the shelf's read activity, aimed at that book)
      galread: () => {
        const o = this.curOrder, rec = o && this.shelfBook(o.book);
        if (!rec) return ['wondering which book', this.play('idle', 0.5)];
        this.forceBook = rec;
        this.orders.shift();
        const [, ...steps] = acts.read();
        return [`going to read "${rec.def.title}" for GUY`, ...(this.inMain() ? [] : acts.leave().slice(1)), ...steps];
      },
      // an order: go and find Guy, wave, and say she is ready
      findguy: () => {
        this.orders.shift();
        const steps = [];
        const gr = lead.g.root.position, room = w.roomIdAt(gr.x, gr.z);
        if (!this.inMain() && room !== w.roomIdAt(this.g.root.position.x, this.g.root.position.z)) steps.push(...acts.leave().slice(1));
        if (this.inMain() && room !== 'main' && room !== 'door' && w.doors[room]) steps.push(...this.doorIn(room));
        steps.push({
          type: 'plan',
          fn: () => {
            const p = lead.g.root.position, me = this.g.root.position;
            const d = Math.hypot(me.x - p.x, me.z - p.z) || 1, x = p.x + (me.x - p.x) / d * 1.15, z = p.z + (me.z - p.z) / d * 1.15;
            return [this.walk(x, z, Math.atan2(p.x - x, p.z - z))];
          },
        });
        steps.push(this.play('wave', 2.8, { at: [1.0, () => w.gal.arrived(this)] }));
        return ['going to find GUY', ...steps];
      },
      // her own idea: switch the stereo on, go and ask Guy to dance, and dance with him
      invitedance: () => {
        const steps = [this.walkAt('table', 0, 0.55, Math.PI),
          this.play('reach', 1.8, { at: [0.9, () => { this.musicOn(); w.gal.partyMusic = true; }], needs: ['table'], target: () => this.stereoButton() }),
          {
            type: 'plan',
            fn: () => {
              const p = lead.g.root.position, me = this.g.root.position;
              const d = Math.hypot(me.x - p.x, me.z - p.z) || 1, x = p.x + (me.x - p.x) / d * 1.15, z = p.z + (me.z - p.z) / d * 1.15;
              return [this.walk(x, z, Math.atan2(p.x - x, p.z - z))];
            },
          },
          this.play('wave', 2.6, { at: [1.0, () => w.gal.askGuy('dance')], onEnd: () => { this.pendingActivity = 'dance'; } })];
        return ['turning the music on and asking GUY to dance', ...steps];
      },
    };
  }

  // the HUD line: what she is doing
  note() { return this.last; }
}

// ================================================================================================================ the manager
export class Gal {
  // opts: { scene, guyBrain, persist, ui(text) }
  constructor(world, opts) {
    this.w = world;
    this.opts = opts;
    this.guyBrain = opts.guyBrain;
    this.present = false;
    this.brain = null; this.g = null;
    this.emerge = null;
    this.duo = null;                  // a jam Guy asked her to prepare for
    this.partyMusic = false;
    this.ready = null;                // a promise: her model is loaded
    this.obs = {};
    this.log = [];                    // what has been said between the two of them (for the tests and the HUD)
  }

  exists() { return this.present; }
  get skills() { return this.brain && this.brain.skills; }
  say(m) { this.log.push(m); if (this.log.length > 30) this.log.shift(); }

  // load the model (once)
  preload() {
    if (this.ready) return this.ready;
    this.g = new Guy();
    this.ready = this.g.load(`${import.meta.env.BASE_URL}models/xbot.fbx`, { colors: COLORS }).then(() => true).catch((e) => { console.error('GAL failed to load', e); return false; });
    return this.ready;
  }

  // Make her brain, put her in the room at (x, z). `emerging`: she is being printed (see `build`).
  spawn(x, z, { emerging = false } = {}) {
    if (this.present) return false;
    if (!this.g || !this.g.loaded) return false;
    const guy = this.guyBrain, root = this.g.root;
    const skills = new Skills(this.opts.skillsInit || (this.opts.persist ? null : 'none'), SKILL_KEYS);
    this.opts.scene.add(root);
    root.position.set(x, 0, z);
    this.brain = new GalBrain(this.g, this.w, (t) => this.opts.ui && this.opts.ui(t), skills, guy);
    this.brain.onLearn = (def) => { if (this.opts.toast) this.opts.toast(`GAL learned ${def.blurb}!`); sfx('chime'); };
    // each is an obstacle for the other
    const mk = (name) => { const ob = { x0: 0, x1: 0, z0: 0, z1: 0, h: 1.8, active: true, name, char: true }; this.w.obstacles.push(ob); return ob; };
    this.obs.guy = mk('guy'); this.obs.gal = mk('gal');
    guy.selfOb = this.obs.guy; this.brain.selfOb = this.obs.gal;
    this.present = true;
    console.info(`GAL appeared: ${emerging ? 'built by Guy at the machine' : 'restored from saved state'} (guy.gal.v1=${(() => { try { return localStorage.getItem(KEY); } catch { return 'n/a'; } })()})`);
    this.emerge = emerging ? { t: 0, dur: 4.5 } : null;
    this.save();
    return true;
  }

  // Guy has used the Build a Bot machine: it folds itself into GAL (the machine goes for good)
  build(machine) {
    if (this.present || !machine) return false;
    const x = machine.x, z = machine.z;
    if (!this.spawn(x, z, { emerging: true })) return false;
    this.emerge.machine = machine;
    sfx('chime');
    return true;
  }

  // put her back after a reload (not the machine)
  restore() {
    if (!this.opts.persist) return Promise.resolve(false);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
    if (!saved || !saved.present) return Promise.resolve(false);
    return this.preload().then((ok) => ok && this.spawn(0.5, -0.5) );
  }
  save() {
    if (!this.opts.persist) return;
    try { localStorage.setItem(KEY, JSON.stringify({ present: this.present })); } catch { /* no storage */ }
  }

  // test aid: take her away again (the machine does not come back)
  remove() {
    if (!this.present) return;
    this.opts.scene.remove(this.g.root);
    for (const k of ['guy', 'gal']) { const i = this.w.obstacles.indexOf(this.obs[k]); if (i >= 0) this.w.obstacles.splice(i, 1); }
    this.guyBrain.selfOb = null; this.guyBrain.other = null;
    this.brain = null; this.present = false; this.emerge = null; this.duo = null; this.obs = {};
    this.g.root.visible = true;
    this.guyBrain.using = new Set();
    this.save();
  }

  // ---------------------------------------------------------------- every frame (called from Guy's brain)
  update(dt) {
    if (!this.present || !this.g.loaded) return;
    const b = this.brain, g = this.g;
    for (const [k, r] of [['guy', this.guyBrain.g.root], ['gal', g.root]]) {
      const ob = this.obs[k], p = r.position;
      Object.assign(ob, { x0: p.x - 0.25, x1: p.x + 0.25, z0: p.z - 0.25, z1: p.z + 0.25 });
    }
    if (this.emerge) { this.updateEmerge(dt); return; }
    b.safeUpdate(dt); g.apply(dt); b.safeLate();
    this.updateDuo(dt);
  }

  // being printed: the machine shrinks into her while she grows to full height
  updateEmerge(dt) {
    const e = this.emerge, g = this.g, root = g.root, m = e.machine;
    e.t += dt;
    const k = Math.min(1, e.t / e.dur), s = k * k * (3 - 2 * k);
    root.scale.setScalar(0.25 + 0.75 * s);
    if (m && m.group) { m.group.scale.set(1 - 0.9 * s, 1 - 0.95 * s, 1 - 0.9 * s); m.obstacle.active = k < 0.6; }
    g.clearTargets(); basePose(g, e.t); POSES.idle(g, e.t); g.apply(dt);
    if (k >= 1) {
      root.scale.setScalar(1);
      if (m && this.w.objects.botprinter === m) { this.w.removeObject('botprinter'); delete this.w.removed.botprinter; m.group.scale.setScalar(1); }
      this.emerge = null;
      this.brain.pendingActivity = 'wave';
      this.say('GAL is here');
      if (this.opts.onBuilt) this.opts.onBuilt('GAL is here! The machine folded itself into her.');
    }
  }

  // ---------------------------------------------------------------- how they talk
  canInvite() { return this.present && !this.emerge && !this.duo && !this.guyBrain.lock && this.guyBrain.inMain() && this.brain.inMain(); }

  // GAL asks Guy to do something (he finishes the step he is on, then does it)
  askGuy(act) {
    const g = this.guyBrain;
    this.say(`GAL asks GUY: ${act}`);
    if (g.lock || !g.available(act)) return false;
    g.skip(true);
    g.pendingActivity = act;
    return true;
  }
  // GAL says she has finished what Guy asked: he comes to jam
  arrived(brain) {
    if (!this.duo || this.duo.phase !== 'waiting') return;
    this.duo.phase = 'ready';
    this.say('GAL: I am ready');
  }

  // ---------------------------------------------------------------- jamming together
  // What the two of them could play now: GAL's instrument (the one she will need books for, if she lacks them) and Guy's.
  planDuo() {
    const g = this.guyBrain, l = this.brain, w = this.w;
    if (!this.present || this.emerge || !this.canInvite() || !g.obj('table')) return null;
    const sh = g.obj('shelf');
    const have = (brain, skills) => skills.every((s) => brain.skills.has(s));
    const options = [];
    for (const [galInst, G] of Object.entries(BAND)) {
      if (!G.objects.every((n) => g.obj(n))) continue;
      if (galInst === 'drums' && !g.standOk('drums')) continue;
      for (const [guyInst, U] of Object.entries(BAND)) {
        if (guyInst === galInst || !U.objects.every((n) => g.obj(n))) continue;
        if (guyInst === 'drums' && !g.standOk('drums')) continue;
        if (!have(g, U.skills)) continue;                                                         // Guy can play his part now
        // the books she still has to read (all unread books of the family, in the order of the list), if the one she needs is on the shelf
        const books = sh ? sh.books.filter((b) => b.mesh.visible && G.family.includes(b.def.teaches) && !l.skills.has(b.def.teaches)) : [];
        const needed = G.skills.filter((s) => !l.skills.has(s));
        if (needed.some((s) => !books.some((b) => b.def.teaches === s))) continue;                 // the book she needs is not on the shelf
        const order = G.family.map((f) => books.find((b) => b.def.teaches === f)).filter(Boolean);
        options.push({ galInst, guyInst, galAct: G.act, guyAct: U.act, books: order.map((b) => b.def.id), needsBooks: order.length > 0 });
      }
    }
    return options.length ? pick(options) : null;
  }

  // Guy tells her the plan. If she has to learn first she is sent to read; either way she comes to find him when she is ready.
  startDuo(plan) {
    if (this.duo) return false;
    this.duo = { ...plan, phase: 'waiting', t: 0 };
    for (const id of plan.books) this.brain.orders.push({ kind: 'read', book: id });
    this.brain.orders.push({ kind: 'find' });
    this.say(`GUY asks GAL: ${plan.books.length ? 'read ' + plan.books.join(', ') + ' and ' : ''}find me when you are ready to jam (${plan.guyInst} + ${plan.galInst})`);
    this.brain.skip(true);
    return true;
  }

  // every frame: when she says she is ready Guy stops what he is doing and they play together
  updateDuo(dt) {
    const d = this.duo;
    if (!d) return;
    d.t += dt;
    const g = this.guyBrain, l = this.brain;
    if (g.lock) { this.duo = null; return; }                                                       // he has been locked on something: the plan is off
    if (d.phase === 'waiting' && d.t > 600) { this.duo = null; return; }                          // she never came: forget it
    if (d.phase === 'ready') {
      d.phase = 'playing';
      d.musicWasOn = !!g.music;
      g.skip(true); g.pendingActivity = 'bandplay';
    } else if (d.phase === 'playing') {
      // Guy's part has started the music: now she plays hers
      if (g.music && !d.galStarted && l.available(d.galAct) && !l.step?.fx?.dance) {
        d.galStarted = true; l.skip(true); l.pendingActivity = d.galAct;
        this.say(`GAL and GUY jam: ${d.guyInst} + ${d.galInst}`);
      }
      if (l.last === d.galAct) d.galSeen = true;
      if (d.galSeen && l.last !== d.galAct && d.t > 20) this.duo = null;          // she has played her part and moved on
      else if (d.t > 400) this.duo = null;
    }
  }
}

// ================================================================================================================ Guy's side
export function installGalGuy(Brain) {
  Object.assign(Brain.prototype, {
    // the activities only he has: building her, and asking her to jam
    galActivities() {
      const w = this.w;
      return {
        // use the Build a Bot machine: press the button, watch it print, and it folds itself into GAL
        buildbot: () => {
          const m = () => this.obj('botprinter');
          if (!m() || (w.gal && w.gal.exists())) return ['nothing to build with', this.play('idle', 0.5)];            // (asked for, but the machine has gone or GAL is already here)
          return ['building GAL', this.stand('botprinter', 0.95, () => m().buttonPoint()),
            this.play('reach', 1.8, { needs: ['botprinter'], at: [0.8, () => { m().run(7); sfx('machine'); }], target: () => m().buttonPoint() }),
            this.play('idle', 8, { needs: ['botprinter'], at: [7.4, () => sfx('chime')] }),
            this.play('idle', 0.3, { needs: ['botprinter'], at: [0.1, () => w.gal && w.gal.build(m())] }),
            this.play('wave', 3)];
        },
        // he fancies a jam: he tells GAL what to learn (if she has to) and to find him when she is ready
        bandjam: () => {
          const gal = w.gal, plan = gal && gal.planDuo();
          if (!plan) return ['thinking about a jam', this.play('idle', 0.5)];
          const p = gal.g.root.position;
          return [`asking GAL to jam (${plan.guyInst} + ${plan.galInst})`,
            { type: 'plan', fn: () => { const q = gal.g.root.position; return [this.walk(q.x + 1.1, q.z + 0.3, Math.atan2(-1.1, -0.3))]; } },
            this.play('wave', 2.6, { at: [1.0, () => gal.startDuo(plan)] }),
            this.play('idle', 0.8)];
        },
        // she is ready: the music on, and then he plays his part (she starts hers when the music is on)
        bandplay: () => {
          const d = w.gal && w.gal.duo;
          if (!d) return ['nothing to play', this.play('idle', 0.5)];
          const acts = this.activities();
          if (!acts[d.guyAct] || !this.available(d.guyAct)) { w.gal.duo = null; return ['not now', this.play('idle', 0.5)]; }
          const [label, ...steps] = acts[d.guyAct]();
          // his own jam turns the stereo on first when it plays piano; the drums and guitar need it already on
          const pre = ['jamdrums', 'jamguitar'].includes(d.guyAct) && !this.music
            ? [this.walkAt('table', 0, 0.55, Math.PI), this.play('reach', 1.8, { at: [0.9, () => this.musicOn()], needs: ['table'], target: () => this.stereoButton() })] : [];
          return [`jamming with GAL: ${label}`, ...pre, ...steps];
        },
      };
    },
    galBlocks(act) {
      if (act === 'buildbot') return !(this.obj('botprinter') && this.w.gal && !this.w.gal.exists() && this.w.gal.g && this.w.gal.g.loaded && this.w.gal.ready);
      if (act === 'bandjam') return !(this.w.gal && this.w.gal.planDuo());
      if (act === 'bandplay') return !(this.w.gal && this.w.gal.duo);
      return false;
    },
    extraWeights() {
      const gal = this.w.gal;
      const out = { buildbot: 30, bandjam: 1.2 };
      if (gal && gal.exists()) {                          // with GAL about he leaves most of the restaurant to her
        for (const k of ['takeorder', 'cook', 'serve', 'takepay']) out[k] = 12;
      }
      return out;
    },
  });
}
installGalGuy(Brain);
