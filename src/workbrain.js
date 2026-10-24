// Guy in the Workshop: going in and out through the door, making planks, sawing, tapping parts together with the rubber mallet,
// sanding, getting tools out of the toolbox, and building things from them. Installed onto Brain / POSES at the bottom of brain.js
// (like the hobbies). The objects are in workobjects.js; the recipes and numbers in workshop.js.
//
// What he builds is real: planks come out of the Wood Factory, he carries them to the workbench, carries one to the sawhorse and
// saws it into parts, carries the parts to the workbench, then to the mallet block to knock them together, on to the sander, and the
// finished thing stands on the workbench (and is counted in `world.stock.items`, the storage). Nothing appears or disappears by
// itself: what he carries is shown in his hand (`this.carry`), and if he is cut short the stock is put back (`workCleanup`).
import * as THREE from 'three';
import { Q } from './guy.js';
import { sfx } from './sfx.js';
import { RECIPES, PLANKS_PER_RUN, PARTS_PER_PLANK, STOCK_CAP, STORAGE_CAP, METAL_PER_RUN, MPARTS_PER_BAR, METAL_CAP, planksNeeded, barsNeeded, skillsOf } from './workshop.js';
import { wants, supply } from './needs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UPV = V(0, 1, 0);

export function installWorkshop(Brain, POSES, H) {
  const { smooth, clamp, lerp, rand, pick } = H;
  const sm = (x) => smooth(clamp(x, 0, 1));
  const ID = 'workshop';

  Object.assign(Brain.prototype, {
    initWork() {
      this.carry = null;                  // what he is carrying between stations: 'plank' | 'planks' | 'parts' | 'piece' | 'bar' | 'bars' | 'mparts' | 'mpiece' | null
      this.carryN = 0;                    // how many parts / bars that is (given back to the stock if he is cut short)
      this.pieceParts = 0;                // how many parts are knocked together in the piece he carries
      this.assembling = 0;                // how many parts are on the station he is putting them together at
      this.assembleAt = null;             // ... which one ('mallet' | 'welder' | 'anvil') and which stock they came from ('parts' | 'mparts')
      this.forceRecipe = null;            // a recipe he was told to build (the user, or Guy telling GAL)
      this.toolInUse = null;              // the object whose tool is in his hand
      this.onBuilt = null;                // called with a message when he finishes something
      const wood = new THREE.MeshStandardMaterial({ color: 0xe3c08a, roughness: 0.8 });
      const bar = (l, t, w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, t, w), wood); m.castShadow = true; return m; };
      const group = (...ms) => { const g = new THREE.Group(); ms.forEach((m) => g.add(m)); return g; };
      this.workProps = {
        plank: bar(0.5, 0.03, 0.12),
        planks: group(...[0, 1, 2, 3].map((i) => { const m = bar(0.4, 0.03, 0.1); m.position.set(0, (i % 2) * 0.032, (i < 2 ? -0.06 : 0.06)); return m; })),
        parts: group(...[0, 1].map((i) => { const m = bar(0.3, 0.03, 0.05); m.position.set(0, i * 0.032, 0); m.rotation.y = i * 0.2; return m; })),
        piece: bar(0.3, 0.16, 0.2),
        sandPiece: bar(0.46, 0.04, 0.14),
      };
      const steel = new THREE.MeshStandardMaterial({ color: 0xb4bcc6, metalness: 0.75, roughness: 0.3 });
      const sbar = (l, t, w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, t, w), steel); m.castShadow = true; return m; };
      Object.assign(this.workProps, {
        flat: group(...[0, 1, 2].map((i) => { const m = bar(0.5 - i * 0.04, 0.035, 0.34); m.position.set(0, i * 0.038, 0); m.rotation.y = i * 0.15; return m; })),
        mflat: group(...[0, 1, 2].map((i) => { const m = sbar(0.5 - i * 0.04, 0.035, 0.34); m.position.set(0, i * 0.038, 0); m.rotation.y = i * 0.15; return m; })),
        bar: sbar(0.5, 0.035, 0.07),
        bars: group(...[0, 1, 2, 3].map((i) => { const m = sbar(0.4, 0.035, 0.07); m.position.set(0, (i % 2) * 0.037, (i < 2 ? -0.05 : 0.05)); return m; })),
        mparts: group(...[0, 1].map((i) => { const m = sbar(0.3, 0.035, 0.05); m.position.set(0, i * 0.037, 0); m.rotation.y = i * 0.2; return m; })),
        mpiece: sbar(0.3, 0.16, 0.2),
      });
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
    shutInMessage(room) { return `${this.isGal ? 'GAL' : 'Guy'} is shut in the ${this.w.doors[room].name}: the door is locked. Unlock it (long-press the door) to let ${this.isGal ? 'her' : 'him'} out.`; },
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
    // the toolbox: lift the lid, reach in, close it (getting the tools out, or putting them away)
    toolboxSteps() {
      if (!this.obj('toolbox')) return [];
      const tb = () => this.obj('toolbox');
      return [this.stand('toolbox', 0.6, () => tb().lidPoint()),
        this.play('reach', 1.4, { needs: ['toolbox'], at: [0.6, () => { tb().setOpen(true); sfx('lid'); }], target: () => tb().lidPoint() }),
        this.play('reach', 1.3, { needs: ['toolbox'], target: () => tb().toolPoint() }),
        this.play('reach', 1.4, { needs: ['toolbox'], at: [0.6, () => { tb().setOpen(false); sfx('lid'); }], target: () => tb().lidPoint() })];
    },
    // press the factory's button, wait while it runs, then take what it made off its tray (planks, or metal bars from the Metal Factory)
    factorySteps(id = 'woodfactory') {
      const f = () => this.obj(id), metal = id === 'metalfactory', n = metal ? METAL_PER_RUN : PLANKS_PER_RUN;
      return [this.stand(id, 0.78, () => f().buttonPoint()),
        this.play('reach', 1.6, { needs: [id], at: [0.7, () => { f().press(); f().run(3.4); sfx('click'); sfx('machine'); }], target: () => f().buttonPoint() }),
        this.play('idle', 3.6, { needs: [id], at: [3.0, () => { f().setTray(n); sfx('thud', 0.5); }] }),
        this.play('reach', 1.8, { needs: [id], at: [0.9, () => { f().setTray(0); this.setCarry(metal ? 'bars' : 'planks', n); sfx('bookgrab'); }], target: () => f().trayPoint() })];
    },
    // where each kind of stock lies on the workbench
    benchPoint(kind) {
      const wb = this.obj('workbench');
      return { wood: () => wb.pilePoint(), metal: () => wb.metalPoint(), parts: () => wb.partsPoint(), mparts: () => wb.mpartsPoint(), hw: () => wb.hwPoint() }[kind]();
    },
    // put what he carries on the workbench: planks on the wood pile, bars on the metal pile, parts and metal parts on theirs
    benchPlace(kind, n) {
      const tgt = () => this.benchPoint(kind);
      return [this.stand('workbench', 0.78, tgt),
        this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => { this.setCarry(null); this.w.addStock(kind, n); sfx('place', 0.2); }], target: tgt })];
    },
    // take n of a kind of stock off the workbench into his hands
    benchTake(kind, n, carryKind) {
      const tgt = () => this.benchPoint(kind);
      return [this.stand('workbench', 0.78, tgt),
        this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => { this.w.addStock(kind, -n); this.setCarry(carryKind, n); sfx('bookgrab'); }], target: tgt })];
    },
    // take a plank off the workbench pile, put it on the sawhorse, saw it in two, and carry the parts back
    sawSteps() {
      const wb = () => this.obj('workbench'), sw = () => this.obj('saw');
      return [...this.benchTake('wood', 1, 'plank'),
        this.stand('saw', 0.72, () => sw().at(0, 0.84, 0.05)),
        this.play('reach', 1.5, { needs: ['saw'], at: [0.8, () => { sw().setPlank('whole'); this.setCarry(null); sfx('place', 0.2); }], target: () => sw().at(0, 0.84, 0.05) }),
        this.play('workSaw', 6.2, { needs: ['saw'], work: { kind: 'saw', obj: 'saw' }, onEnd: () => sw().setPlank('cut') }),
        this.play('reach', 1.6, { needs: ['saw'], at: [0.8, () => { sw().setPlank(null); this.setCarry('parts', PARTS_PER_PLANK); sfx('bookgrab'); }], target: () => sw().at(0, 0.84, 0.05) }),
        ...this.benchPlace('parts', PARTS_PER_PLANK)];
    },
    // metal: take a bar to the cutter, pull the lever, and carry the two parts back to the bench
    cutSteps() {
      const cu = () => this.obj('metalcutter');
      return [...this.benchTake('metal', 1, 'bar'),
        this.stand('metalcutter', 0.72, () => cu().leverGrip()),
        this.play('reach', 1.5, { needs: ['metalcutter'], at: [0.8, () => { cu().setBar('whole'); this.setCarry(null); sfx('place', 0.2); }], target: () => cu().barPoint() }),
        this.play('workCut', 6.4, { needs: ['metalcutter'], work: { kind: 'cut', obj: 'metalcutter', pulls: 3 }, onEnd: () => cu().setBar('cut') }),
        this.play('reach', 1.6, { needs: ['metalcutter'], at: [0.8, () => { cu().setBar(null); this.setCarry('mparts', MPARTS_PER_BAR); sfx('bookgrab'); }], target: () => cu().barPoint() }),
        ...this.benchPlace('mparts', MPARTS_PER_BAR)];
    },
    // metal: take the parts to the welder and join them, then to the anvil to hammer the joins into shape; he ends with the piece in his hands
    weldSteps(r) {
      const m = r.metal, wd = () => this.obj('welder'), top = () => wd().at(0, wd().TOP + 0.1, 0.05);
      return [...this.benchTake('mparts', m.parts, 'mparts'),
        this.stand('welder', 0.7, top),
        this.play('reach', 1.5, { needs: ['welder'], at: [0.8, () => { this.setCarry(null); this.assembling = m.parts; this.assembleAt = { obj: 'welder', kind: 'mparts' }; wd().setParts(Math.min(4, m.parts)); sfx('place', 0.2); }], target: top }),
        this.play('workWeld', 1.8 + m.welds * 2.4, { needs: ['welder'], work: { kind: 'weld', obj: 'welder', welds: m.welds } }),
        this.play('reach', 1.6, { needs: ['welder'], at: [0.8, () => { wd().setParts(0); this.pieceParts = this.assembling; this.assembling = 0; this.assembleAt = null; this.setCarry('mpiece', this.pieceParts); sfx('bookgrab'); }], target: top })];
    },
    hammerSteps(r) {
      const m = r.metal, an = () => this.obj('anvil'), top = () => an().at(0, an().TOP + 0.1, 0.05);
      return [this.stand('anvil', 0.55, top),
        this.play('reach', 1.5, { needs: ['anvil'], at: [0.8, () => { this.assembling = this.pieceParts; this.assembleAt = { obj: 'anvil', kind: 'mparts' }; this.setCarry(null); an().setParts(Math.min(4, this.assembling)); sfx('place', 0.2); }], target: top }),
        this.play('workTap', 1.2 + m.bangs * 0.85, { needs: ['anvil'], work: { kind: 'tap', obj: 'anvil', taps: m.bangs, sfx: 'knock' } }),
        this.play('reach', 1.6, { needs: ['anvil'], at: [0.8, () => { an().setParts(0); this.pieceParts = this.assembling; this.assembling = 0; this.assembleAt = null; this.setCarry('mpiece', this.pieceParts); sfx('bookgrab'); }], target: top })];
    },
    // take the parts to the mallet block and tap them together; pick up the finished piece
    assembleSteps(r) {
      const wb = () => this.obj('workbench'), ml = () => this.obj('mallet');
      return [this.stand('workbench', 0.78, () => wb().partsPoint()),
        this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => { this.w.addStock('parts', -r.parts); this.setCarry('parts', r.parts); sfx('bookgrab'); }], target: () => wb().partsPoint() }),
        this.stand('mallet', 0.55, () => ml().at(0, ml().TOP + 0.1, 0.05)),
        this.play('reach', 1.5, { needs: ['mallet'], at: [0.8, () => { this.setCarry(null); this.assembling = r.parts; this.assembleAt = { obj: 'mallet', kind: 'parts' }; ml().setParts(Math.min(4, r.parts)); sfx('place', 0.2); }], target: () => ml().at(0, ml().TOP + 0.1, 0.05) }),
        this.play('workTap', 1.2 + r.taps * 0.85, { needs: ['mallet'], work: { kind: 'tap', obj: 'mallet', taps: r.taps } }),
        this.play('reach', 1.6, { needs: ['mallet'], at: [0.8, () => { ml().setParts(0); this.pieceParts = this.assembling; this.assembling = 0; this.assembleAt = null; this.setCarry('piece', this.pieceParts); sfx('bookgrab'); }], target: () => ml().at(0, ml().TOP + 0.1, 0.05) })];
    },
    // carry the piece to the sander and smooth it
    sandSteps() {
      return [this.stand('sander', 0.52, () => this.obj('sander').at(0, 0.8, 0.06)),
        this.play('workSand', 6.5, { needs: ['sander'], work: { kind: 'sand', obj: 'sander' } })];
    },
    // put the finished thing on the workbench, and count it in storage
    finishSteps(id) {
      const r = RECIPES[id], wb = () => this.obj('workbench');
      return [this.stand('workbench', 0.78, () => wb().productPoint()),
        this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => {
          this.setCarry(null); this.pieceParts = 0;
          if (r.metal && r.parts) this.w.addStock('hw', -1);                  // the metal hardware that was waiting on the bench is fitted to the body
          if (this.siteFor(id)) {                                           // it is wanted somewhere: he carries it there flat-packed and puts it together on the spot
            this.setCarry(r.metal && !r.parts ? 'mflat' : 'flat', 1); this.flatKind = id; sfx('bookgrab');
            return;
          }
          this.endBuild();
          // nowhere in particular: it stands in the Workshop straight away (the user can move it or put it away); storage only if there is no room
          const placed = this.w.placeBuilt(r.object);
          if (!placed) { const items = this.w.stock.items; items[r.object] = Math.min(STORAGE_CAP, (items[r.object] || 0) + 1); }
          sfx('chime');
          if (this.onBuilt) this.onBuilt(placed ? `${this.who()} built a ${r.name}! It is in the Workshop.` : `${this.who()} built a ${r.name}! There is no room in the Workshop, so it is in storage.`);
        }], target: () => wb().productPoint() }),
        this.play('idle', 1.2, { needs: ['workbench'] }),
        { type: 'plan', fn: () => this.deliverSteps(id) }];
    },
    who() { return this.isGal ? 'GAL' : 'Guy'; },

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
      const k = (id) => this.skills.has(id), st = this.w.stock;
      const need = { workbench: 'workshop', toolbox: 'workshop', mallet: 'workshop', woodfactory: 'workshop.materials', saw: 'workshop.materials', sander: 'workshop.materials',
        metalfactory: 'workshop.metal', metalcutter: 'workshop.metal', welder: 'workshop.metal', anvil: 'workshop.metal' }[name];
      if (!need) return null;
      if (!k(need)) return `Guy doesn't know how to use that yet. Add the book "${need === 'workshop' ? 'Workshop Basics' : need === 'workshop.metal' ? 'Metal Fabrication for Robots' : 'Wood & Metal Basics'}" to the shelf and he'll read it.`;
      if (name === 'saw' && st.wood < 1) return 'There are no planks yet. Guy can make some at the Wood Factory.';
      if (name === 'sander' && st.wood < 1) return 'There is nothing to sand yet. Guy can make planks at the Wood Factory.';
      if (name === 'metalcutter' && st.metal < 1) return 'There are no metal bars yet. Guy can make some at the Metal Factory.';
      if (name === 'welder' && st.mparts < 2) return 'There are no metal parts to weld yet. Guy can cut some from bars at the Metal Cutter.';
      if (name === 'workbench' && !this.pickRecipe()) return this.cannotBuild();
      return null;
    },
    // why he does not build anything now (a kind message): nothing is needed, or he lacks a book or a tool
    cannotBuild() {
      const w = this.w;
      if (!w.objects.workbench) return 'Guy needs a workbench first.';
      if (!wants(this).length) return 'There is nothing the house needs right now, so Guy has nothing to build.';
      return 'Guy needs a book and the right tools in the Workshop to build what the house needs.';
    },
    // what has been asked for and is not made yet (the house's wants plus whatever he was told to build)
    // can he build this recipe right now: the book(s), the tools, and room in the stock for what it takes
    canBuild(id) {
      const r = RECIPES[id], w = this.w, st = w.stock, has = (n) => !!this.obj(n);
      if (!r || !w.instanceKinds().includes(r.object)) return false;
      if (!skillsOf(r).every((k) => this.skills.has(k))) return false;
      if ((st.items[r.object] || 0) >= STORAGE_CAP) return false;
      const made = (st.items[r.object] || 0) + Object.values(w.objects).filter((o) => o.kind === r.object).length;
      if (made >= r.cap) return false;                                       // enough of these
      if (!has('workbench')) return false;
      if (r.parts) {
        if (!has('saw') || !has('mallet') || (r.sand && !has('sander'))) return false;
        const need = planksNeeded(r, st.parts);
        if (st.wood < need && !has('woodfactory')) return false;
        if (st.wood + Math.ceil(Math.max(0, need - st.wood) / PLANKS_PER_RUN) * PLANKS_PER_RUN > STOCK_CAP) return false;
      }
      if (r.metal) {
        if (!has('metalcutter') || !has('welder') || !has('anvil')) return false;
        const bars = barsNeeded(r, st.mparts);
        if (st.metal < bars && !has('metalfactory')) return false;
        if (st.metal + Math.ceil(Math.max(0, bars - st.metal) / METAL_PER_RUN) * METAL_PER_RUN > METAL_CAP) return false;
      }
      return true;
    },
    // which recipe he builds now: one he was told to, or the first thing the house needs that he can make (null if nothing)
    pickRecipe() {
      if (this.forceRecipe && this.canBuild(this.forceRecipe)) return this.forceRecipe;
      for (const want of wants(this)) {
        const options = Object.keys(RECIPES).filter((id) => RECIPES[id].serves === want.serves && this.canBuild(id));
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
    endBuild() { if (this.w.building) this.w.building = this.w.building.filter((b) => b.by !== this); this.forceRecipe = null; },
    buildSteps(id) {
      const r = RECIPES[id], st = this.w.stock;
      this.beginBuild(id);
      const steps = [...this.toolboxSteps()];
      if (r.metal) {                                                          // the metal first: bars, cut parts, welded and hammered; wood to follow if the recipe has a body
        let bars = st.metal;
        const need = barsNeeded(r, st.mparts);
        while (bars < need) { steps.push(...this.factorySteps('metalfactory'), ...this.benchPlace('metal', METAL_PER_RUN)); bars += METAL_PER_RUN; }
        for (let i = 0; i < need; i++) steps.push(...this.cutSteps());
        steps.push(...this.weldSteps(r), ...this.hammerSteps(r));
        if (r.parts) steps.push(...this.benchPlace('hw', 1));
      }
      if (r.parts) {
        let wood = st.wood;
        const need = planksNeeded(r, st.parts);
        while (wood < need) { steps.push(...this.factorySteps(), ...this.benchPlace('wood', PLANKS_PER_RUN)); wood += PLANKS_PER_RUN; }
        for (let i = 0; i < need; i++) steps.push(...this.sawSteps());
        steps.push(...this.assembleSteps(r));
        if (r.sand) steps.push(...this.sandSteps());
      }
      steps.push(...this.toolboxSteps(), ...this.finishSteps(id));
      return steps;
    },
    // ------------------------------------------------------------------ the activities
    workActivities() {
      const w = this.w;
      return {
        makewood: () => this.shopTrip('making planks in the Wood Factory', [...this.factorySteps(), ...this.benchPlace('wood', PLANKS_PER_RUN)]),
        makemetal: () => this.shopTrip('making metal bars in the Metal Factory', [...this.factorySteps('metalfactory'), ...this.benchPlace('metal', METAL_PER_RUN)]),
        cutmetal: () => this.shopTrip('cutting a metal bar into parts', this.cutSteps()),
        hammer: () => this.shopTrip('hammering on the anvil', [this.stand('anvil', 0.55, () => this.obj('anvil').at(0, this.obj('anvil').TOP + 0.1, 0.05)), this.play('workTap', 7.5, { needs: ['anvil'], work: { kind: 'tap', obj: 'anvil', taps: 8, sfx: 'knock' } })]),
        weld: () => this.shopTrip('practising a weld', [this.stand('welder', 0.7, () => this.obj('welder').at(0, this.obj('welder').TOP + 0.1, 0.05)), this.play('workWeld', 8, { needs: ['welder'], work: { kind: 'weld', obj: 'welder', welds: 2 } })]),
        sawwood: () => this.shopTrip('sawing a plank into parts', this.sawSteps()),
        tap: () => this.shopTrip('tapping on the assembly block with the rubber mallet', [this.stand('mallet', 0.55, () => this.obj('mallet').at(0, this.obj('mallet').TOP + 0.1, 0.05)), this.play('workTap', 7.5, { needs: ['mallet'], work: { kind: 'tap', obj: 'mallet', taps: 8 } })]),
        sand: () => this.shopTrip('sanding a plank smooth', [
          this.stand('workbench', 0.78, () => this.obj('workbench').pilePoint()),
          this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => { w.addStock('wood', -1); this.carry = 'plank'; sfx('bookgrab'); }], target: () => this.obj('workbench').pilePoint() }),
          ...this.sandSteps(),
          ...this.benchPlace('wood', 1)]),
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

    // Put things back if he was cut short: what he carries and what is on the sawhorse go back to the stock.
    workCleanup() {
      const w = this.w;
      if (this.carry === 'flat' || this.carry === 'mflat') {                                  // flat-packed, on the way: set down where he stands (storage if there is no room)
        const r = RECIPES[this.flatKind], p = this.g.root.position;
        if (r) { const name = w.addInstance(r.object, null, null, true, { x: p.x, z: p.z }); if (!name) { const items = w.stock.items; items[r.object] = Math.min(STORAGE_CAP, (items[r.object] || 0) + 1); } }
        this.flatKind = null;
      }
      if (this.carry === 'plank') w.addStock('wood', 1);
      else if (this.carry === 'planks') w.addStock('wood', PLANKS_PER_RUN);
      else if (this.carry === 'parts') w.addStock('parts', this.carryN || PARTS_PER_PLANK);
      else if (this.carry === 'piece') w.addStock('parts', this.pieceParts || 0);          // the parts he had knocked together go back as parts
      else if (this.carry === 'bar') w.addStock('metal', 1);
      else if (this.carry === 'bars') w.addStock('metal', METAL_PER_RUN);
      else if (this.carry === 'mparts') w.addStock('mparts', this.carryN || MPARTS_PER_BAR);
      else if (this.carry === 'mpiece') w.addStock('mparts', this.pieceParts || 0);
      if (this.carry !== 'canvas') this.setCarry(null); this.pieceParts = 0;                 // (the flat-pack case below has already been looked at)
      if (this.assembling) {                                                               // parts left on a station
        const at = this.assembleAt || { obj: 'mallet', kind: 'parts' };
        w.addStock(at.kind, this.assembling); this.assembling = 0;
        const st = this.obj(at.obj); if (st && st.setParts) st.setParts(0);
        this.assembleAt = null;
      }
      this.endBuild();
      if (this.hauling) { const o = this.hauling.o; o.hauled = false; o.obstacle.active = true; o.hauledYaw = undefined; const p = this.g.root.position; o.set(p.x + Math.sin(this.g.root.rotation.y) * 0.6, p.z + Math.cos(this.g.root.rotation.y) * 0.6); o.group.position.y = 0; this.hauling = null; this.haulT0 = undefined; }
      if (this.onStool) { const f = this.onStool; this.g.root.position.set(f.from.x, 0, f.from.z); this.onStool = null; }
      const cu = this.obj('metalcutter');
      if (cu && cu.barA.visible) { if (cu.barB.visible) w.addStock('mparts', MPARTS_PER_BAR); else w.addStock('metal', 1); cu.setBar(null); }
      const mf = this.obj('metalfactory');
      if (mf && mf.tray.children.length) { mf.setTray(0); w.addStock('metal', METAL_PER_RUN); }

      const sw = this.obj('saw');
      if (sw && sw.plankA.visible) {
        if (sw.plankB.visible) w.addStock('parts', PARTS_PER_PLANK); else w.addStock('wood', 1);
        sw.setPlank(null);
      }
      const ml = this.obj('mallet');
      if (ml && ml.assembly.children.length) ml.setParts(0);
      const f = this.obj('woodfactory');
      if (f && f.tray.children.length) { f.setTray(0); w.addStock('wood', PLANKS_PER_RUN); }
    },

    // ------------------------------------------------------------------ hands and tools for the stations
    // The wrists (and which way the fingers point and the palm faces) for sawing, tapping and sanding, from how far through the step he is.
    computeWork(s, dt) {
      const f = s.fx.work, o = this.obj(f.obj);
      if (!o) return null;
      const g = this.g, T = s.t, D = s.dur;
      const w = sm(Math.min(T / 0.8, (D - T) / 0.8));
      const hl = g.limb.Right.handLen;
      o.group.updateWorldMatrix(true, false);
      const gq = o.group.getWorldQuaternion(new THREE.Quaternion());
      // he may be working from any side of the object (approach.js): the work is turned to face him, quarter turns about its centre
      const side = this.sideOf(f.obj), sc = Math.cos(side * Math.PI / 2), ss = Math.sin(side * Math.PI / 2);
      const rx = (x, z) => x * sc + z * ss, rz = (x, z) => -x * ss + z * sc;
      const at = (x, y, z) => o.at(rx(x, z), y, rz(x, z));
      const dirOf = (x, y, z) => V(rx(x, z), y, rz(x, z)).normalize().applyQuaternion(gq);
      const down = V(0, -1, 0), xAxis = dirOf(1, 0, 0), leftOf = dirOf(-1, 0, 0);
      const out = { kind: f.kind, w, lean: f.kind === 'sand' ? 0.9 : f.kind === 'tap' ? 0.75 : 0.55, R: null, L: null };      // how far he bends over the work
      if (f.kind === 'saw') {
        const phase = (T - 0.6) * Math.PI * 2 / 0.9, stroke = Math.sin(phase);
        const sink = 0.035 * clamp((T - 0.8) / (D - 1.6), 0, 1);
        const grip = at(0.12, 0.99 - sink, 0.27 + 0.1 * stroke), fd = dirOf(0, -0.3, -0.95);
        out.R = { wrist: grip.clone().addScaledVector(fd, -hl * 0.45), f: fd, palm: leftOf };
        out.L = { wrist: at(-0.25, 0.87, 0.08), f: xAxis, palm: down };
        out.tool = { o, kind: 'saw', f: fd, grip };
        const n = Math.floor(phase / Math.PI);
        if (T > 0.6 && n !== s.sawN) { s.sawN = n; sfx('saw'); }
      } else if (f.kind === 'cut') {                               // the metal cutter: one hand pulls the lever down and lets it up, the other holds the bar
        const period = 1.3, k = (T - 0.8) / period, p = k - Math.floor(k), going = T > 0.8 && T < D - 0.8 && k < f.pulls;
        const a = going ? (p < 0.45 ? sm(p / 0.45) : 1 - sm((p - 0.45) / 0.55)) : 0;            // 0 raised .. 1 pulled all the way down
        o.setLever(o.LEVER - a * 0.9);
        const grip = o.leverGrip(), n = Math.floor(k);
        const across = V(-1, -0.15, 0).applyQuaternion(gq).normalize(), fwd = V(0, 0, -1).applyQuaternion(gq);
        out.R = { wrist: grip.clone().addScaledVector(across, -hl * 0.45), f: across, palm: fwd };
        out.L = { wrist: o.at(-0.2, o.TOP + 0.1, 0.25), f: V(0, -0.3, -1).applyQuaternion(gq).normalize(), palm: down };
        if (going && p >= 0.45 && n !== s.cutN) { s.cutN = n; sfx('lid'); sfx('thud', 0.6); }
        out.lean = 0.5;
      } else if (f.kind === 'weld') {                             // the welder: the torch runs slowly along the seam, a glow and sparks, the other hand steadies the piece
        const going = T > 0.9 && T < D - 0.9, run = clamp((T - 0.9) / Math.max(0.5, D - 1.8), 0, 1);
        const head = at(-0.14 + 0.28 * run, o.TOP + 0.08 + (going ? 0 : 0.1), 0.02), fd = dirOf(0, -0.65, -0.76);
        const center = head.clone().addScaledVector(fd, -0.22);
        out.R = { wrist: center.clone().addScaledVector(fd, -hl * 0.45), f: fd, palm: leftOf };
        out.L = { wrist: at(-0.2, o.TOP + 0.08, 0.17), f: xAxis, palm: down };
        out.tool = { o, kind: 'weld', f: fd, head };
        if (going) { o.weldAt(head); if (Math.floor(T / 0.5) !== s.weldN) { s.weldN = Math.floor(T / 0.5); sfx('sizzle'); } }
      } else if (f.kind === 'tap') {
        const period = 0.85, k = (T - 0.8) / period, p = k - Math.floor(k), going = T > 0.8 && T < D - 0.8 && (T - 0.8) / period < f.taps;
        const lift = going ? (p < 0.35 ? (1 - sm(p / 0.35)) * 0.2 : sm((p - 0.35) / 0.3) * 0.2) : 0.1;
        const head = at(0, o.TOP + 0.1 + lift, 0.0), fd = dirOf(0, -0.55, -0.83);
        const center = head.clone().addScaledVector(fd, -0.22);
        out.R = { wrist: center.clone().addScaledVector(fd, -hl * 0.45), f: fd, palm: leftOf };
        out.L = { wrist: at(-0.2, o.TOP + 0.08, 0.17), f: xAxis, palm: down };
        out.tool = { o, kind: 'tap', f: fd, head };
        const n = Math.floor(k);
        const base = o.TOP + 0.02;
        if (going && p >= 0.35 && n !== s.tapN) { s.tapN = n; sfx(f.sfx || 'tap', 4); o.assembly.position.y = base + 0.012; o.assembly.rotation.z = (n % 2 ? 1 : -1) * 0.04; }
        o.assembly.position.y += (base - o.assembly.position.y) * 0.3;                      // the parts jump a little at every tap and settle
        o.assembly.rotation.z *= 0.85;
      } else {                                                       // sand: both hands slide the piece along the belt
        // the belt runs along the sander's own x whichever side he stands at: the hand nearer his right goes on that end of the piece
        const belt = V(1, 0, 0).applyQuaternion(gq), sgn = belt.dot(this.leftVec()) <= 0 ? 1 : -1;
        const C = o.at(0.12 * Math.sin((T - 0.6) * Math.PI * 2 / 1.1), o.BELT + 0.06, 0.06);
        out.R = { wrist: C.clone().addScaledVector(belt, 0.2 * sgn), f: belt.clone().multiplyScalar(-sgn), palm: down };
        out.L = { wrist: C.clone().addScaledVector(belt, -0.2 * sgn), f: belt.clone().multiplyScalar(sgn), palm: down };
        out.sandAt = { pos: C, quat: gq.clone() };
        if (T > 0.8 && T < D - 0.8) { o.run(0.3); if (Math.floor(T / 0.33) !== s.sandN) { s.sandN = Math.floor(T / 0.33); sfx('sand'); } }
      }
      this.hobProps.tool = out.tool || null;
      this.hobProps.sandPiece = out.sandAt || null;
      return out;
    },

    // carried things sit in his hand; the saw and the mallet follow the right hand while he uses them; the piece being sanded follows both
    lateWork() {
      const P = this.workProps;
      if (!P) return;
      this.lateWork2();
      this.updateHaul();
      const g = this.g, hp = this.hobProps || {};
      const sandPiece = !!hp.sandPiece;
      for (const [key, m] of Object.entries(P)) m.visible = (key === this.carry && !sandPiece) || (key === 'sandPiece' && sandPiece);
      const handCenter = (side) => { const fr = this.handFrame(side); return { fr, pos: fr.wrist.clone().addScaledVector(fr.f, g.limb[side].handLen * 0.5) }; };
      if (this.carry && !sandPiece && P[this.carry]) {
        const { fr, pos } = handCenter('Right');
        const m = P[this.carry];
        m.position.copy(pos).addScaledVector(fr.palm, 0.04);
        const x = fr.f.clone(), z = new THREE.Vector3().crossVectors(x, UPV);
        if (z.lengthSq() < 1e-4) z.set(0, 0, 1);
        z.normalize();
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z));
      }
      if (hp.sandPiece) {
        const m = P.sandPiece;
        m.position.copy(hp.sandPiece.pos);
        m.quaternion.copy(hp.sandPiece.quat);
      }
      // the tool in his right hand
      const tool = hp.tool;
      if (this.toolInUse && (!tool || tool.o !== this.toolInUse)) { this.toolInUse.resetTool(); this.toolInUse = null; }
      if (tool) {
        const { pos } = handCenter('Right');
        let p, q;
        if (tool.kind === 'saw') {                                    // the blade runs along his fingers, the handle in his fist
          const x = tool.f.clone(), z = new THREE.Vector3().crossVectors(x, UPV).normalize();
          p = pos; q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z));
        } else {                                                       // the mallet: handle back along the fingers, head out in front
          p = tool.head; q = new THREE.Quaternion().setFromUnitVectors(UPV, tool.f.clone().negate());
        }
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
  // two hands at work: saw, mallet or the piece on the sander (the numbers are in computeWork)
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
    workSaw(g, t, dur, ctx) { workPose(g, ctx.hob, 0.85); },
    workTap(g, t, dur, ctx) { workPose(g, ctx.hob, 0.85); },
    workCut(g, t, dur, ctx) { workPose(g, ctx.hob, 0.85); },
    workWeld(g, t, dur, ctx) { workPose(g, ctx.hob, 0.85); },
    workSand(g, t, dur, ctx) { workPose(g, ctx.hob, 0.35); },
  });
}
