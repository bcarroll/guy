// GUY in the Workshop: going in and out through the door, tidying the toolbox, and building things. Installed onto Brain / POSES at the
// bottom of brain.js (like the hobbies). The objects are in workobjects.js; the recipes and numbers in workshop.js.
//
// What he builds is real, and the factories do all of it: he walks up to the Wood Factory (or the Metal Factory), presses the big
// button, waits while it runs, and lifts what it made off the tray. The finished thing is carried flat-packed to where it is wanted and
// set up there (or it stands in the Workshop, and is counted in `world.stock.items`, the storage, if there is no room). A thing that
// needs both lines (an electric guitar) is made in two goes: the Metal Factory makes the hardware, which he carries to the Wood
// Factory, and that makes the body and fits the two together. Nothing appears or disappears by itself: what he carries is shown in his
// hand (`this.carry`), and if he is cut short it is put down where he stands (`workCleanup`).
import * as THREE from 'three';
import { Q } from './guy.js';
import { sfx } from './sfx.js';
import { RECIPES, STORAGE_CAP, factoriesOf, skillsOf } from './workshop.js';
import { wants } from './needs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UPV = V(0, 1, 0);

export function installWorkshop(Brain, POSES, H) {
  const { pick } = H;
  const ID = 'workshop';

  Object.assign(Brain.prototype, {
    initWork() {
      this.carry = null;                  // what he is carrying: 'flat' | 'mflat' (a finished thing, flat-packed) | 'bars' (the metal hardware of a guitar) | null
      this.carryN = 0;
      this.forceRecipe = null;            // a recipe he was told to build (the user, or GUY telling GAL)
      this.forceLine = null;              // the factory he was pointed at ('wood' | 'metal'): he builds something that factory makes
      this.toolInUse = null;              // the object whose tool is in his hand
      this.onBuilt = null;                // called with a message when he finishes something
      const wood = new THREE.MeshStandardMaterial({ color: 0xe3c08a, roughness: 0.8 });
      const bar = (l, t, w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, t, w), wood); m.castShadow = true; return m; };
      const group = (...ms) => { const g = new THREE.Group(); ms.forEach((m) => g.add(m)); return g; };
      const steel = new THREE.MeshStandardMaterial({ color: 0xb4bcc6, metalness: 0.75, roughness: 0.3 });
      const sbar = (l, t, w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, t, w), steel); m.castShadow = true; return m; };
      this.workProps = {
        flat: group(...[0, 1, 2].map((i) => { const m = bar(0.5 - i * 0.04, 0.035, 0.34); m.position.set(0, i * 0.038, 0); m.rotation.y = i * 0.15; return m; })),
        mflat: group(...[0, 1, 2].map((i) => { const m = sbar(0.5 - i * 0.04, 0.035, 0.34); m.position.set(0, i * 0.038, 0); m.rotation.y = i * 0.15; return m; })),
        bars: group(...[0, 1].map((i) => { const m = sbar(0.34, 0.035, 0.07); m.position.set(0, i * 0.037, (i - 0.5) * 0.09); return m; })),
      };
      Object.values(this.workProps).forEach((p) => { p.visible = false; this.w.room.add(p); });
    },

    setCarry(kind, n = 0) { this.carry = kind; this.carryN = kind ? n : 0; },

    // ------------------------------------------------------------------ where he is
    inWorkshop() { return this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z) === ID; },
    // locked on something that is in the Workshop (so he stays in there between activities)
    lockedInside() { return (this.inWorkshop() && this.lockHere()) || this.lockedInYard(); },
    // locked on something that is in the Workshop (so a trip does not end with him walking out)
    lockHere() { const o = this.lock && this.obj(this.lock.name); return !!o && this.w.roomIdAt(o.x, o.z) === ID; },

    // ------------------------------------------------------------------ going in and out through the door
    // The door of room `id` is locked and he is not already in there (or in the doorway): he cannot go in. (He can always come out.)
    doorLockedFor(id) {
      const d = this.w.doors[id];
      if (!d || !d.locked) return false;
      const here = this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z);
      return here !== id && here !== 'door';
    },
    // The doors out of room `id` (an added room has the one door; with more, any that is unlocked lets him out).
    exitsOf(id) { const d = this.w.doors[id]; return d ? [d] : []; },
    // The added room he is shut in: he is in it and every door out of it is locked (a locked door works both ways). He can only do what can
    // be done in there, until somebody unlocks a door. null when he is not shut in.
    stuckIn() {
      const here = this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z);
      if (here === 'main' || here === 'door') return null;
      const exits = this.exitsOf(here);
      return exits.length && exits.every((d) => d.locked) ? here : null;
    },
    shutInMessage(room) { return `${this.isGal ? 'GAL' : 'GUY'} is shut in the ${this.w.doors[room].name}: the door is locked. Unlock it (long-press the door) to let ${this.isGal ? 'her' : 'him'} out.`; },
    doorIn(id) {
      const w = this.w, out = this.doorStand(id), inn = w.doorPoint(id, -1.0), face = w.doorYaw(id, false);
      // (the locked doors are kept out of every choice, but one can be locked while he is on his way: he gives up there, never walks into it)
      return [{ type: 'plan', fn: () => { if (!this.doorLockedFor(id)) return []; this.queue.length = 0; this.ui(`the ${w.doors[id].name} door is locked`); return []; } },
        this.walk(out.x, out.z, face),
        this.play('reach', 1.6, { at: [0.8, () => { w.setDoorOpen(id, true); sfx('click'); }], target: () => w.doorKnob(id) }),
        this.play('idle', 0.7),
        { ...this.walk(inn.x, inn.z), direct: true }];
    },
    doorOut(id) {
      const w = this.w, out = this.doorStand(id), inn = w.doorPoint(id, -1.0), face = w.doorYaw(id, false);
      // (locked while he is on his way out: he stays in, and what he was doing there is dropped)
      return [{ type: 'plan', fn: () => { if (!this.stuckIn()) return []; this.queue.length = 0; this.ui(`shut in the ${w.doors[id].name} (the door is locked)`); return []; } },
        this.play('idle', 0.05, { at: [0, () => w.setDoorOpen(id, true)] }),            // (the other robot may have shut it behind her while he was inside)
        this.walk(inn.x, inn.z), { ...this.walk(out.x, out.z), direct: true }, this.walk(out.x, out.z, face),
        this.play('reach', 1.6, { at: [0.8, () => this.closeDoor(id)], target: () => w.doorKnob(id) })];
    },
    // the door is shut behind whoever leaves, unless the other robot is still in there (or in the doorway)
    closeDoor(id) {
      const o = this.other, r = o && o.g ? this.w.roomIdAt(o.g.root.position.x, o.g.root.position.z) : null;
      if (r === id || r === 'door') return;
      this.w.setDoorOpen(id, false);
    },
    // A trip: in through the door (unless he is already inside), the steps, and out again (unless he is locked on something in here).
    shopTrip(label, inner) {
      return [label, ...(this.inWorkshop() ? [] : this.doorIn(ID)), ...inner, ...(this.lockHere() ? [] : this.doorOut(ID))];
    },

    // ------------------------------------------------------------------ the stations
    // the toolbox: lift the lid, reach in, close it (tidying the tools)
    toolboxSteps() {
      if (!this.obj('toolbox')) return [];
      const tb = () => this.obj('toolbox');
      return [this.stand('toolbox', 0.6, () => tb().lidPoint()),
        this.play('reach', 1.4, { needs: ['toolbox'], at: [0.6, () => { tb().setOpen(true); sfx('lid'); }], target: () => tb().lidPoint() }),
        this.play('reach', 1.3, { needs: ['toolbox'], target: () => tb().toolPoint() }),
        this.play('reach', 1.4, { needs: ['toolbox'], at: [0.6, () => { tb().setOpen(false); sfx('lid'); }], target: () => tb().lidPoint() })];
    },
    // One factory, start to finish: press the button, wait while it runs, and take what it made off the tray. What comes out is the finished
    // thing, unless `last` is false (an electric guitar: the Metal Factory comes first, and its hardware goes to the Wood Factory in his hands).
    factorySteps(id, fid, last = true) {
      const r = RECIPES[id], f = () => this.obj(fid), rt = r.run, made = last ? id : 'hardware';
      return [this.stand(fid, 0.78, () => f().buttonPoint()),
        this.play('reach', 1.6, { needs: [fid], at: [0.7, () => { if (this.carry === 'bars') this.setCarry(null); f().press(); f().run(rt); sfx('click'); sfx('machine'); }], target: () => f().buttonPoint() }),
        this.play('idle', rt + 0.2, { needs: [fid], at: [Math.max(0.2, rt - 0.4), () => { f().showMade(made); sfx('thud', 0.5); }] }),
        this.play('reach', 1.8, { needs: [fid], at: [0.9, () => {
          f().clearMade(); sfx('bookgrab');
          if (last) this.finishBuilt(id); else this.setCarry('bars', 1);
        }], target: () => f().trayPoint() })];
    },
    // The finished thing is in his hands. Wanted somewhere in particular: he carries it there flat-packed (deliverSteps) and puts it together on
    // the spot. Otherwise it stands in the Workshop straight away (the user can move it or put it away); storage only if there is no room.
    finishBuilt(id) {
      const r = RECIPES[id];
      if (this.siteFor(id)) { this.setCarry(r.line === 'metal' ? 'mflat' : 'flat', 1); this.flatKind = id; return; }
      this.setCarry(null);
      this.endBuild();
      const placed = this.w.placeBuilt(r.object);
      if (!placed) { const items = this.w.stock.items; items[r.object] = Math.min(STORAGE_CAP, (items[r.object] || 0) + 1); }
      sfx('chime');
      if (this.onBuilt) this.onBuilt(placed ? `${this.who()} built a ${r.name}! It is in the Workshop.` : `${this.who()} built a ${r.name}! There is no room in the Workshop, so it is in storage.`);
    },
    who() { return this.isGal ? 'GAL' : 'GUY'; },

    // ------------------------------------------------------------------ the foot stool: carried to a window and stood on to clean the top
    // The high windows (their top is out of reach from the floor) and the stool: what he could do now, or null.
    stoolJob() {
      const w = this.w, stool = Object.values(w.objects).find((o) => o.kind === 'footstool' && w.roomIdAt(o.x, o.z) === 'main');
      if (!stool) return null;
      const wins = Object.values(w.decor).filter((d) => d.wall && /^window/.test(d.name) && d.v + d.hh > 2.1);
      if (!wins.length) return null;
      return { stool, wins };
    },
    startHaul(name) {
      const o = this.obj(name); if (!o) return;
      this.hauling = { o, k: 0, dir: 1, from: { x: o.x, z: o.z }, to: null };
      o.hauled = true; o.hauledYaw = o.group.rotation.y; o.obstacle.active = false;
    },
    // set it down at (x, z): it lowers into place from where he holds it
    endHaul(x, z) {
      if (!this.hauling) return;
      this.hauling.dir = -1; this.hauling.to = { x, z };
    },
    // where his hands go while he holds it (left and right of the piece, in front of him)
    haulHands() {
      const h = this.hauling, root = this.g.root, yaw = root.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
      const c = new THREE.Vector3(root.position.x + fx * 0.5, 0.62, root.position.z + fz * 0.5), half = h.o.bw / 2 + 0.03;
      return { L: c.clone().add(new THREE.Vector3(lx * half, 0, lz * half)), R: c.clone().add(new THREE.Vector3(-lx * half, 0, -lz * half)) };
    },
    updateHaul() {
      const h = this.hauling;
      if (!h) return;
      const dt = Math.min(0.1, this.time - (this.haulT0 ?? this.time)); this.haulT0 = this.time;
      h.k = Math.min(1, Math.max(0, h.k + h.dir * dt / 0.9));
      const root = this.g.root, yaw = root.rotation.y, k = h.k * h.k * (3 - 2 * h.k);
      const cx = root.position.x + Math.sin(yaw) * 0.5, cz = root.position.z + Math.cos(yaw) * 0.5, o = h.o;
      const base = h.dir > 0 ? h.from : (h.to || h.from);
      o.group.position.set(base.x + (cx - base.x) * k, 0.62 * k, base.z + (cz - base.z) * k);
      o.hauledYaw = o.group.rotation.y + (yaw - o.group.rotation.y) * 0.3;
      if (h.dir < 0 && h.k <= 0) {                                             // down on the floor: it is a piece of furniture again
        o.hauled = false; o.obstacle.active = true; o.hauledYaw = undefined;
        o.set(h.to ? h.to.x : o.x, h.to ? h.to.z : o.z);
        this.hauling = null; this.haulT0 = undefined;
      }
    },
    // stepping up on the stool and down again: his feet are on top of it (0.34 m) while the step lasts
    updateStool(s) {
      const f = s.fx.stool, o = this.obj(f.name), root = this.g.root;
      if (!o) return;
      const k = Math.min(1, s.t / 0.9) * (1 - Math.min(1, Math.max(0, (s.t - (s.dur - 0.9)) / 0.9)));
      const e = k * k * (3 - 2 * k);
      root.position.set(f.from.x + (o.x - f.from.x) * e, 0.34 * e, f.from.z + (o.z - f.from.z) * e);
      this.onStool = e > 0.02 ? f : null;
    },
    // where it is wanted: { room, pref, stand } or null (nowhere in particular)
    siteFor(id) {
      const r = RECIPES[id], w = this.w, p = r && w.instanceSite(r.object);
      if (!p || !r.serves) return null;
      const room = p.room, b = room === 'main' || room === 'door' ? { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.6 } : w.doors[room] && w.doors[room].shell.bounds;
      if (!b) return null;
      if (room !== 'main' && room !== 'door' && this.doorLockedFor(room)) return null;                      // a locked room: it is put together where it stands, not carried in
      if (this.stuckIn() && room !== this.stuckIn()) return null;                                           // shut in the Workshop: it is put together here, not carried out
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, d = Math.hypot(cx - p.x, cz - p.z) || 1;
      const stand = { x: Math.min(b.maxX - 0.7, Math.max(b.minX + 0.7, p.x + (cx - p.x) / d * 0.95)), z: Math.min(b.maxZ - 0.7, Math.max(b.minZ + 0.7, p.z + (cz - p.z) / d * 0.95)) };
      return { room, pref: p, stand };
    },
    // out of the Workshop with it, through the other room's door if it goes there, put it together where it is wanted, and back out
    deliverSteps(id) {
      if (this.carry !== 'flat' && this.carry !== 'mflat') return [];
      const site = this.siteFor(id);
      if (!site) return [{ type: 'plan', fn: () => [this.play('idle', 0.3, { at: [0.1, () => this.setUp(id, null)] })] }];
      const steps = [...(this.inWorkshop() ? this.doorOut(ID) : [])];
      if (site.room !== 'main' && site.room !== 'door') steps.push(...this.doorIn(site.room));
      steps.push({ type: 'plan', fn: () => this.setupSteps(id) });
      if (site.room !== 'main' && site.room !== 'door') steps.push(...this.doorOut(site.room));
      return steps;
    },
    setupSteps(id) {
      const site = this.siteFor(id);
      if (!site) return [this.play('idle', 0.3, { at: [0.1, () => this.setUp(id, null)] })];
      const { stand, pref } = site, yaw = Math.atan2(pref.x - stand.x, pref.z - stand.z);
      return [this.walk(stand.x, stand.z, yaw),
        this.play('reach', 3.4, { target: () => V(pref.x, 0.3, pref.z), at: [2.0, () => this.setUp(id, site)] }),
        this.play('idle', 0.6)];
    },
    // the flat-pack becomes the real thing: it grows into place (and is counted in storage if there is no room for it)
    setUp(id) {
      const r = RECIPES[id];
      this.setCarry(null); this.flatKind = null;
      this.endBuild();
      const name = this.w.addInstance(r.object, null, null, true);
      if (name) { const o = this.w.objects[name]; (this.popping ||= []).push({ o, t: 0 }); sfx('chime'); }
      else { const items = this.w.stock.items; items[r.object] = Math.min(STORAGE_CAP, (items[r.object] || 0) + 1); sfx('chime'); }
      if (this.onBuilt) this.onBuilt(name ? `${this.who()} built a ${r.name} and put it where it is needed!` : `${this.who()} built a ${r.name}! There is no room for it, so it is in storage.`);
    },
    // new things grow into place over a moment
    lateWork2() {
      if (!this.popping || !this.popping.length) return;
      const dt = Math.min(0.1, this.time - (this.popT0 ?? this.time)); this.popT0 = this.time;
      for (const p of this.popping) { p.t += dt; const k = Math.min(1, p.t / 0.9), s = k * k * (3 - 2 * k); p.o.group.scale.setScalar(0.4 + 0.6 * s); if (k >= 1) p.done = true; }
      this.popping = this.popping.filter((p) => !p.done);
    },
    // Why he cannot do what the user asked with a Workshop object (a kind message), or null if he can.
    workRefusal(name) {
      const k = (id) => this.skills.has(id);
      const need = { workbench: 'workshop', toolbox: 'workshop', woodfactory: 'workshop', metalfactory: 'workshop.metal' }[name];
      if (!need) return null;
      if (!k(need)) return `GUY doesn't know how to use that yet. Add the book "${need === 'workshop' ? 'Workshop Basics' : 'Metal Fabrication for Robots'}" to the shelf and he'll read it.`;
      if (['workbench', 'woodfactory', 'metalfactory'].includes(name) && !this.pickRecipe()) return this.cannotBuild();
      return null;
    },
    // why he does not build anything now (a kind message): nothing is needed, or he lacks a book or a factory
    cannotBuild() {
      const w = this.w, line = this.buildLine();
      if (!w.objects.woodfactory && !w.objects.metalfactory) return 'GUY needs a Wood Factory or a Metal Factory first.';
      if (!wants(this).length) return 'There is nothing the house needs right now, so GUY has nothing to build.';
      if (line === 'wood') return 'GUY needs a book, and the Wood Factory, to build what the house needs.';
      if (line === 'metal') return 'GUY needs a book, and the Metal Factory, to build what the house needs.';
      return 'GUY needs a book and the right factory in the Workshop to build what the house needs.';
    },
    // the factory he was pointed at, or is locked on ('wood' | 'metal'), or null for any
    buildLine() { return this.forceLine || (this.lock && { woodfactory: 'wood', metalfactory: 'metal' }[this.lock.name]) || null; },
    // can he build this recipe right now: the book(s), the factory it needs, and room for one more of it
    canBuild(id) {
      const r = RECIPES[id], w = this.w, st = w.stock;
      if (!r || !w.instanceKinds().includes(r.object)) return false;
      if (!skillsOf(r).every((k) => this.skills.has(k))) return false;
      if ((st.items[r.object] || 0) >= STORAGE_CAP) return false;
      const made = (st.items[r.object] || 0) + Object.values(w.objects).filter((o) => o.kind === r.object).length;
      if (made >= r.cap) return false;                                       // enough of these
      return factoriesOf(r).every((f) => !!this.obj(f));
    },
    // which recipe he builds now: one he was told to, or the first thing the house needs that he can make (null if nothing)
    pickRecipe() {
      if (this.forceRecipe) { if (this.canBuild(this.forceRecipe)) return this.forceRecipe; this.forceRecipe = null; }
      const line = this.buildLine(), fits = (id) => !line || RECIPES[id].line === line || RECIPES[id].line === 'both';
      for (const want of wants(this)) {
        const options = Object.keys(RECIPES).filter((id) => RECIPES[id].serves === want.serves && fits(id) && this.canBuild(id));
        if (options.length) return pick(options);
      }
      return null;
    },
    // what the house needs that GAL could build but he cannot (so he can ask her), as a recipe id
    recipeForHelper(other) {
      if (!other) return null;
      for (const want of wants(this)) {
        const options = Object.keys(RECIPES).filter((id) => RECIPES[id].serves === want.serves && other.canBuild(id) && !this.canBuild(id));
        if (options.length) return pick(options);
      }
      return null;
    },
    beginBuild(id) { (this.w.building ||= []).push({ by: this, recipe: id }); },
    dropBuilding() { if (this.w.building) this.w.building = this.w.building.filter((b) => b.by !== this); },
    endBuild() { this.dropBuilding(); this.forceRecipe = null; this.forceLine = null; },
    // the factory (or both, one after the other) makes it, then it goes where it is wanted
    buildSteps(id) {
      const fs = factoriesOf(RECIPES[id]);
      this.beginBuild(id);
      return [...fs.flatMap((fid, i) => this.factorySteps(id, fid, i === fs.length - 1)), { type: 'plan', fn: () => this.deliverSteps(id) }];
    },
    // ------------------------------------------------------------------ the activities
    workActivities() {
      return {
        tidytools: () => this.shopTrip('tidying the toolbox', this.toolboxSteps()),
        // clean the top of a high window: carry the foot stool there (unless it is there already), step up on it and wipe along the top of the frame
        dusttop: () => {
          const job = this.stoolJob();
          if (!job) return ['no window to clean', this.play('idle', 0.5)];
          const w = this.w, win = pick(job.wins), sp = win.wall === 'back' ? { x: win.u, z: -4 + 0.55 } : { x: -5 + 0.55, z: win.u }, yaw = win.wall === 'back' ? Math.PI : -Math.PI / 2;
          const inward = win.wall === 'back' ? { x: 0, z: 1 } : { x: 1, z: 0 };
          const name = job.stool.name, steps = [];
          const there = Math.hypot(job.stool.x - sp.x, job.stool.z - sp.z) < 0.3;
          if (!there) {                                                         // fetch it: lift it, carry it to the window, set it down by the wall
            steps.push(this.stand(name, 0.6),
              this.play('reach', 1.6, { at: [0.6, () => this.startHaul(name)], target: () => { const o = this.obj(name); if (!o) return null; return V(o.x, 0.3, o.z); } }),         // (no 'needs': the stool is moved by this very step)
              { type: 'plan', fn: () => [this.walk(sp.x + inward.x * 0.5, sp.z + inward.z * 0.5, yaw)] },
              this.play('reach', 1.6, { at: [0.5, () => this.endHaul(sp.x, sp.z)], target: () => V(sp.x, 0.3, sp.z) }),
              this.play('idle', 0.4));
          } else steps.push({ type: 'plan', fn: () => [this.walk(sp.x + inward.x * 0.55, sp.z + inward.z * 0.55, yaw)] });
          const t0 = this.time, top = win.v + win.hh - 0.12, span = Math.min(win.hw * 0.7, 0.55);
          const target = () => {
            sfx('wipe');
            const u = win.u + Math.sin((this.time - t0) * 2.0) * span;
            return win.wall === 'back' ? V(u, top, -4 + 0.04) : V(-5 + 0.04, top, u);
          };
          steps.push({ type: 'plan', fn: () => { const p = this.g.root.position, from = { x: p.x, z: p.z }; return [this.play('reach', 7.5, { needs: [name], target, stool: { name, from } })]; } });
          return [`cleaning the top of the ${win.label} from the foot stool`, ...steps];
        },
        build: () => {
          const id = this.pickRecipe();
          if (!id) return ['wondering what to build', this.play('idle', 1)];
          const label = `building a ${RECIPES[id].name.toLowerCase()}`;
          if (this.siteFor(id)) return [label, ...(this.inWorkshop() ? [] : this.doorIn(ID)), ...this.buildSteps(id)];          // (the delivery takes him out again)
          return this.shopTrip(label, this.buildSteps(id));
        },
      };
    },

    // Put things back if he was cut short: what he carries is set down where he stands, and what is on a factory's tray is cleared.
    workCleanup() {
      const w = this.w;
      if (this.carry === 'flat' || this.carry === 'mflat') {                                  // flat-packed, on the way: set down where he stands (storage if there is no room)
        const r = RECIPES[this.flatKind], p = this.g.root.position;
        if (r) { const name = w.addInstance(r.object, null, null, true, { x: p.x, z: p.z }); if (!name) { const items = w.stock.items; items[r.object] = Math.min(STORAGE_CAP, (items[r.object] || 0) + 1); } }
        this.flatKind = null;
      }
      if (this.carry !== 'canvas') this.setCarry(null);                                       // (the hardware of a guitar he did not finish is just dropped)
      this.dropBuilding();
      if (this.hauling) { const o = this.hauling.o; o.hauled = false; o.obstacle.active = true; o.hauledYaw = undefined; const p = this.g.root.position; o.set(p.x + Math.sin(this.g.root.rotation.y) * 0.6, p.z + Math.cos(this.g.root.rotation.y) * 0.6); o.group.position.y = 0; this.hauling = null; this.haulT0 = undefined; }
      if (this.onStool) { const f = this.onStool; this.g.root.position.set(f.from.x, 0, f.from.z); this.onStool = null; }
      for (const id of ['woodfactory', 'metalfactory']) { const f = this.obj(id); if (f && f.tray.children.length) f.clearMade(); }
    },

    // carried things sit in his hand; the spoon follows the right hand while he stirs
    lateWork() {
      const P = this.workProps;
      if (!P) return;
      this.lateWork2();
      this.updateHaul();
      const g = this.g, hp = this.hobProps || {};
      for (const [key, m] of Object.entries(P)) m.visible = key === this.carry;
      const handCenter = (side) => { const fr = this.handFrame(side); return { fr, pos: fr.wrist.clone().addScaledVector(fr.f, g.limb[side].handLen * 0.5) }; };
      if (this.carry && P[this.carry]) {
        const { fr, pos } = handCenter('Right');
        const m = P[this.carry];
        m.position.copy(pos).addScaledVector(fr.palm, 0.04);
        const x = fr.f.clone(), z = new THREE.Vector3().crossVectors(x, UPV);
        if (z.lengthSq() < 1e-4) z.set(0, 0, 1);
        z.normalize();
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z));
      }
      // the tool in his right hand (the wooden spoon at the stove, restbrain.js): handle back along the fingers, head out in front
      const tool = hp.tool;
      if (this.toolInUse && (!tool || tool.o !== this.toolInUse)) { this.toolInUse.resetTool(); this.toolInUse = null; }
      if (tool) {
        const p = tool.head, q = new THREE.Quaternion().setFromUnitVectors(UPV, tool.f.clone().negate());
        const o = tool.o;
        o.group.updateWorldMatrix(true, false);
        o.tool.position.copy(o.group.worldToLocal(p.clone()));
        o.tool.quaternion.copy(o.group.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
        this.toolInUse = o;
      }
    },
  });

  // ---------------------------------------------------------------------------- poses
  const hold = (g, side, p, w, f, palm) => g.reach(side, p, w, false, { hand: { fingers: f, palm } });
  // two hands at work: the spoon in the pot (the numbers are in computeStir, restbrain.js)
  const workPose = (g, h, curlR) => {
    if (!h) return;
    const far = h.L.wrist.distanceTo(g.boneWorld('LeftArm')) > h.R.wrist.distanceTo(g.boneWorld('RightArm')) ? h.L.wrist : h.R.wrist;
    g.set('Spine', Q('x', h.lean * 0.4 * h.w));                                  // bends over the work like at the telescope
    g.set('Spine1', Q('x', h.lean * 0.4 * h.w));
    g.set('Spine2', Q('x', h.lean * 0.2 * h.w));
    g.set('Head', Q('x', (0.1 + h.lean * 0.3) * h.w));
    g.reachAssist(far, h.w * 0.9);
    hold(g, 'Left', h.L.wrist, h.w, h.L.f, h.L.palm);
    hold(g, 'Right', h.R.wrist, h.w, h.R.f, h.R.palm);
    g.curl('Left', 0.3 * h.w + 0.1);
    g.curl('Right', curlR * h.w + 0.1);
  };
  Object.assign(POSES, {
    workTap(g, t, dur, ctx) { workPose(g, ctx.hob, 0.85); },
  });
}
