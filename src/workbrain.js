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
import { RECIPES, STORAGE_CAP, MATERIALS, factoriesOf, skillsOf, materialsOf } from './workshop.js';
import { wants, botMachine } from './needs.js';
import { ROOM, WALK } from './room.js';
import { makePin } from './bowlobjects.js';

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
      // the maple pins he has taken out of their crate for a row of a lane (1 to 4: `carryN`)
      this.workProps.pins = group(...[0, 1, 2, 3].map((i) => { const m = makePin('maple'); m.position.set(0, -0.14, 0.09 - i * 0.06); m.position.x = i % 2 ? 0.06 : -0.06; return m; }));
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
    // He cannot get into room `id`: every way there is through a locked door (its own, or one on the way to it), and he is not already in there
    // (or in a doorway).
    doorLockedFor(id) {
      const d = this.w.doors[id];
      if (!d) return false;
      const here = this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z);
      if (here === id || here === 'door') return false;
      return !!d.closing || !this.roomsInReach(true).has(id);          // (a room the user is taking away: nobody goes in)
    },
    // Every room he can walk to from where he is, through doors that are not locked (the room he is in is one of them). `opening`: not through a
    // room that the user is taking away either.
    roomsInReach(opening = false) {
      const w = this.w, p = this.g.root.position, seen = new Set([this.roomAt(p.x, p.z)]), doors = w.allDoors().filter((d) => !d.locked);
      for (const r of seen) for (const d of doors) {
        const a = d.link ? d.room : d.id, to = a === r ? d.parent : d.parent === r ? a : null;
        if (to && (to === 'main' || (w.doors[to] && !(opening && w.doors[to].closing)))) seen.add(to);
      }
      return seen;
    },
    canReach(room) { return this.roomsInReach().has(room); },
    // Why he cannot go into room `id` (for a message): it names the door that is locked, which may be one on the way there.
    lockedMessage(id) {
      if (this.stuckIn()) return this.shutInMessage(this.stuckIn());
      const shut = this.roomChain(id).reverse().find((r) => this.w.doors[r].locked) || id;
      return `The ${this.w.doors[shut].name} door is locked. Unlock it first (long-press the door).`;
    },
    // This very door is locked (or its room is going) and he is on this side of it.
    gateShut(id) {
      const d = this.w.gateOf(id);
      if (!d) return true;
      const room = d.link ? d.room : d.id, here = this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z);
      return !!(d.locked || (this.w.doors[room] && this.w.doors[room].closing)) && here !== room && here !== 'door';
    },
    // The room a door opens into: his own ('main'), or the room beside a corner room.
    parentOf(id) { const d = this.w.gateOf(id); return d && d.parent ? d.parent : 'main'; },
    // The way from room `here` to room `where`: the doors to go through, [{ id, dir: 'in' | 'out' }], the shortest walk through doors that are not
    // locked. 'out' goes from a room through its own door (or one of its other doors, a link), 'in' the other way. null if there is no way.
    route(here, where) {
      const w = this.w, mid = (r) => { const b = r === 'main' ? w.MAIN_BOUNDS : w.doors[r] && w.doors[r].shell.bounds; return b ? { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 } : { x: 0, z: 0 }; };
      const edges = w.allDoors().filter((d) => !d.locked).map((d) => ({ id: d.id, a: d.link ? d.room : d.id, b: d.parent, p: w.doorPoint(d.id, 0) }));
      const me = this.g.root.position, goal = mid(where);
      let best = null;
      const go = (room, p, len, seen, path) => {
        if (best && len >= best.len) return;
        if (room === where) { const L = len + Math.hypot(goal.x - p.x, goal.z - p.z); if (!best || L < best.len) best = { len: L, path }; return; }
        for (const e of edges) {
          const to = e.a === room ? e.b : e.b === room ? e.a : null;
          if (!to || seen.includes(to) || (to !== 'main' && (!w.doors[to] || w.doors[to].closing))) continue;       // (nobody goes through a room that is going)
          go(to, e.p, len + Math.hypot(e.p.x - p.x, e.p.z - p.z), [...seen, to], [...path, { id: e.id, dir: e.a === room ? 'out' : 'in' }]);
        }
      };
      go(here, here === this.hereId() ? { x: me.x, z: me.z } : mid(here), 0, [here], []);
      return best && best.path;
    },
    edgeSteps(e) { return e.dir === 'out' ? this.doorOut(e.id) : this.doorIn(e.id); },
    // is there a door between these two rooms?
    adjoining(a, b) { return this.w.allDoors().some((d) => { const r = d.link ? d.room : d.id; return (r === a && d.parent === b) || (r === b && d.parent === a); }); },
    // The rooms from `id` out to his own, `id` first (not including his own room).
    roomChain(id) { const c = []; for (let r = id; r && r !== 'main' && this.w.doors[r]; r = this.parentOf(r)) c.push(r); return c; },
    // The doors to go through from room `here` to room `where` (through every room between: a corner room is entered through the room beside it).
    // `outOnly`: just out of the room he is in, as far as his own (the Workshop, Yard and Restaurant jobs go in through their own door).
    tripSteps(here, where, outOnly = false) {
      const way = this.route(here, outOnly ? 'main' : where);
      if (way) return way.flatMap((e) => this.edgeSteps(e));
      // no way there with the doors as they are (one is locked): the usual way, as far as the locked door, where he gives up
      const a = this.roomChain(here), b = outOnly ? [] : this.roomChain(where);
      while (!outOnly && a.length && b.length && a[a.length - 1] === b[b.length - 1]) { a.pop(); b.pop(); }          // (the rooms they share are not left)
      return [...a.flatMap((r) => this.doorOut(r)), ...b.reverse().flatMap((r) => this.doorIn(r))];
    },
    // The added room he is in while he is shut in: a locked door works both ways, and no unlocked one leads back to his own room. He still goes
    // through the doors that are not locked (from a locked Workshop into the Library and the Bedroom beside it: roomsInReach), and does what can
    // be done in those rooms, until somebody unlocks a door. null when he is not shut in.
    stuckIn() {
      const here = this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z);
      return here === 'main' || here === 'door' || !this.w.doors[here] || this.canReach('main') ? null : here;
    },
    shutInMessage(room) {
      const w = this.w, reach = this.roomsInReach(), rest = [...reach].filter((r) => r !== room && w.doors[r]);
      const shut = w.allDoors().filter((d) => d.locked && reach.has(d.link ? d.room : d.id) !== reach.has(d.parent)), out = shut.find((d) => !d.link) || shut[0];
      return `${this.who()} is shut in the ${w.doors[room].name}${rest.length ? ` (and the ${rest.map((r) => w.doors[r].name).join(' and the ')})` : ''}: the ${out && out.id !== room ? `${out.name} ` : ''}door is locked. Unlock it (long-press the door) to let ${this.isGal ? 'her' : 'him'} out.`;
    },
    doorIn(id) {
      const w = this.w, out = this.doorStand(id), inn = w.doorPoint(id, -1.0), face = w.doorYaw(id, false);
      // (the locked doors are kept out of every choice, but one can be locked while he is on his way: he gives up there, never walks into it)
      return [{ type: 'plan', fn: () => { if (!this.gateShut(id)) return []; this.queue.length = 0; this.ui(`the ${w.gateOf(id) ? w.gateOf(id).name : 'other'} door is locked`); return []; } },
        this.walk(out.x, out.z, face),
        { type: 'plan', fn: () => (w.isDoorOpen(id) ? [] : [      // (a door that is already open is simply walked through)
          this.play('reach', 1.6, { at: [0.8, () => { w.setDoorOpen(id, true); sfx('click'); }], target: () => w.doorKnob(id) }),
          this.play('idle', 0.7)]) },
        { ...this.walk(inn.x, inn.z), direct: true, ...this.doorFrame(id) }];
    },
    // A walk through the door of a corner room is on the floor of the room beside it (the grid of his own room knows nothing of it).
    doorFrame(id) { const p = this.parentOf(id); return p === 'main' ? {} : { frameRoom: p }; },
    doorOut(id) {
      const w = this.w, out = this.doorStand(id), inn = w.doorPoint(id, -1.0), face = w.doorYaw(id, false);
      // (locked while he is on his way out: he stays in, and what he was doing there is dropped)
      return [{ type: 'plan', fn: () => { const d = w.gateOf(id); if (d && !(d.locked && this.hereId() === (d.link ? d.room : d.id))) return []; this.queue.length = 0; this.ui(d ? `shut in the ${d.name} (the door is locked)` : 'the door is gone'); return []; } },
        ...this.openFromInside(id, this.walk(inn.x, inn.z)), { ...this.walk(out.x, out.z), direct: true, ...this.doorFrame(id) }, this.walk(out.x, out.z, face),
        this.play('reach', 1.6, { at: [0.8, () => this.closeDoor(id)], target: () => w.doorKnob(id) })];
    },
    // up to the door from inside its room (`walk`: the walk there), and open it if it is shut (he came in by another door, or the other robot shut it)
    openFromInside(id, walk) {
      const w = this.w;
      return [walk, { type: 'plan', fn: () => (!w.gateOf(id) || w.isDoorOpen(id) ? [] : [
        this.walk(walk.x, walk.z, w.doorYaw(id, true)),
        this.play('reach', 1.6, { at: [0.8, () => { w.setDoorOpen(id, true); sfx('click'); }], target: () => w.doorKnob(id, true) }),
        this.play('idle', 0.7)]) }];
    },
    // the door is shut behind whoever leaves, unless the other robot is still in there (or in the doorway)
    closeDoor(id) {
      const o = this.other, r = o && o.g ? this.w.roomIdAt(o.g.root.position.x, o.g.root.position.z) : null;
      const l = this.w.links[id];
      if (r === 'door' || (l ? r === l.room : this.roomChain(r).includes(id))) return;                      // (still in there, or in a room beyond it)
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
        // workshop ch2 "Tool Care": he sorts the tools, picking two more out and putting them back in their place
        ...(this.has('workshop.ch2') ? [this.play('reach', 1.1, { needs: ['toolbox'], at: [0.5, () => sfx('click')], target: () => tb().toolPoint() }), this.play('reach', 1.1, { needs: ['toolbox'], at: [0.5, () => sfx('click')], target: () => tb().toolPoint() })] : []),
        this.play('reach', 1.4, { needs: ['toolbox'], at: [0.6, () => { tb().setOpen(false); sfx('lid'); }], target: () => tb().lidPoint() })];
    },
    // One factory, start to finish: press the button, wait while it runs, and take what it made off the tray. What comes out is the finished
    // thing, unless `last` is false (an electric guitar: the Metal Factory comes first, and its hardware goes to the Wood Factory in his hands).
    factorySteps(id, fid, last = true) {
      const r = RECIPES[id], f = () => this.obj(fid), rt = r.run, made = last ? id : 'hardware';
      const wood = fid === 'woodfactory', metal = fid === 'metalfactory', tray = () => f().trayPoint();
      const bot = fid === 'botprinter', mats = bot ? materialsOf(r).map((m) => MATERIALS[m]) : null;      // (the Build a Bot machine: what it prints from)
      let lastWipe = -9;
      // the wood chapters of Wood & Metal Basics look at the piece, then sand it; the metal one knocks on it twice to hear that it is sound
      const check = [
        ...(wood && this.has('workshop.materials.ch2') ? [this.play('reach', 1.7, { needs: [fid], target: tray })] : []),
        ...(wood && ['seat', 'diners', 'books'].includes(r.serves) && this.has('workshop.furniture.ch2') ? [this.play('reach', 1.8, { needs: [fid], at: [0.9, () => sfx('thud', 0.3)], target: () => tray().clone().add(V(0, 0.08, 0)) })] : []),
        ...(wood && this.has('workshop.materials.ch3') ? [this.play('reach', 4.2, { needs: [fid], target: () => { const p = tray(); if (this.time - lastWipe > 0.5) { sfx('wipe'); lastWipe = this.time; } return p.clone().add(V(Math.sin(this.time * 4) * 0.12, 0, Math.cos(this.time * 4) * 0.05)); } })] : []),
        ...(metal && this.has('workshop.metal.ch2') ? [0, 1].map(() => this.play('reach', 1.0, { needs: [fid], at: [0.45, () => sfx('knock')], target: tray })) : []),
      ];
      return [this.stand(fid, bot ? 0.95 : 0.78, () => f().buttonPoint()),
        // workshop ch3 "Safety First": a look round before the machine is started
        ...(this.has('workshop.ch3') ? [this.play('lookaround', 2.4)] : []),
        this.play('reach', 1.6, { needs: [fid], at: [0.7, () => { if (this.carry === 'bars') this.setCarry(null); f().press(); f().run(rt, mats); sfx('click'); sfx('machine'); }], target: () => f().buttonPoint() }),
        this.play('idle', rt + 0.2, { needs: [fid], at: [Math.max(0.2, rt - 0.4), () => { f().showMade(made); sfx('thud', 0.5); }] }),
        ...(bot ? [this.play('reach', 1.4, { needs: [fid], target: tray })] : []),             // (a look at what it printed, on the bed)
        ...check,
        this.play('reach', 1.8, { needs: [fid], at: [0.9, () => {
          f().clearMade(); sfx('bookgrab');
          if (last) this.finishBuilt(id); else this.setCarry('bars', 1);
        }], target: () => f().trayPoint() })];
    },
    // The finished thing is in his hands. Wanted somewhere in particular: he carries it there flat-packed (deliverSteps) and puts it together on
    // the spot. Otherwise it stands in the Workshop straight away (the user can move it or put it away); storage only if there is no room.
    finishBuilt(id) {
      const r = RECIPES[id];
      if (r.whole && this.siteFor(id) && this.liftBuilt(id)) return;
      if (this.siteFor(id)) { this.setCarry(r.line === 'metal' ? 'mflat' : 'flat', 1); this.flatKind = id; return; }
      this.setCarry(null);
      this.endBuild();
      const placed = this.w.placeBuilt(r.object);
      if (!placed) { const items = this.w.stock.items; items[r.object] = Math.min(STORAGE_CAP, (items[r.object] || 0) + 1); }
      sfx('chime');
      if (this.onBuilt) this.onBuilt(placed ? `${this.who()} built a ${r.name}! It is in the Workshop.` : `${this.who()} built a ${r.name}! There is no room in the Workshop, so it is in storage.`);
    },
    // A thing that is carried as it is (a crate of pins): off the tray and into both hands. False if it cannot be (no room for it to have come from).
    liftBuilt(id) {
      const r = RECIPES[id], w = this.w, f = this.obj(factoriesOf(r).at(-1)), p = this.g.root.position;
      const name = w.addInstance(r.object, null, null, true, { x: p.x, z: p.z });
      if (!name) return false;
      this.setCarry(null);
      this.endBuild();
      const o = this.obj(name), t = f ? f.trayPoint() : null;
      const from = { x: o.x, z: o.z, rot: o.rot };
      this.homeMove = { name, from, whole: true };
      this.builtWhole = name;
      (this.using ||= new Set()).add(name);
      this.startHaul(name);
      if (t) { this.hauling.from = { x: t.x, z: t.z, y: t.y }; o.group.position.set(t.x, t.y, t.z); }
      return true;
    },
    who() { return this.isGal ? 'GAL' : 'GUY'; },

    // ------------------------------------------------------------------ the foot stool: carried to a window and stood on to clean the top
    // The high windows (their top is out of reach from the floor) and the stool: what he could do now, or null.
    stoolJob() {
      const w = this.w, stool = Object.values(w.objects).find((o) => o.kind === 'footstool' && w.roomIdAt(o.x, o.z) === 'main');
      if (!stool) return null;
      const wins = Object.values(w.decor).filter((d) => d.wall && /^window/.test(d.name) && d.v + d.hh > 2.1);
      const spots = new Map(wins.map((d) => [d, this.stoolSpot(stool, d)]).filter(([, s]) => s));
      if (!spots.size) return null;
      return { stool, wins: [...spots.keys()], spots };
    },
    // Where the stool goes under window `d`: by the wall, under its middle or as near to that as there is free floor for the stool, his arms
    // either side of it and him in front of it. null if something stands along all of it (the stool used to be put down inside the stereo table).
    stoolSpot(stool, d) {
      const w = this.w, back = d.wall === 'back', gap = 0.3;
      for (const off of [0, -0.25, 0.25, -0.45, 0.45, -0.65, 0.65]) {
        if (Math.abs(off) > d.hw - 0.2) continue;
        const u = d.u + off, p = back ? { x: u, z: -ROOM.d / 2 + 0.55 } : { x: -ROOM.w / 2 + 0.55, z: u }, at = back ? { x: p.x, z: p.z + 0.55 } : { x: p.x + 0.55, z: p.z };
        if (!w.fits(stool, p.x, p.z, stool.w + (back ? gap : 0), stool.d + (back ? 0 : gap))) continue;
        if (w.obstacles.some((o) => o !== stool.obstacle && o.active !== false && !o.char && at.x > o.x0 - 0.25 && at.x < o.x1 + 0.25 && at.z > o.z0 - 0.25 && at.z < o.z1 + 0.25)) continue;
        return { ...p, u };
      }
      return null;
    },
    // How a thing is held while it is carried whole: how high it is lifted, how far in front of him, which way round (`turn`), and where each
    // hand takes hold (`half` either side of its middle, at `y` on it, `z` towards (-) or away from him). The default is the foot stool's.
    haulGrip(o) {
      const key = o.guitar && !o.bass ? 'guitar' : o.kind === 'bowlingpins' ? 'pins' : o.name;
      return { pins: { lift: 0.84, ahead: 0.48, turn: 0, half: 0.33, y: 0.03, z: 0, plain: true },        // the crate, by its two ends, at his waist
        guitar: { lift: 0.42, ahead: 0.46, turn: 0, half: 0.12, y: 0.42, z: 0 },               // by the cradle of its stand
        lamp: { lift: 0.14, ahead: 0.5, turn: 0, half: 0.02, y: 0.86, z: 0, apart: 0.2 },            // by the pole, one hand above the other
        easel: { lift: 0.16, ahead: 0.52, turn: Math.PI, half: 0.31, y: 0.88, z: 0 },                  // by its two uprights, the canvas towards him
        telescope: { lift: 0.14, ahead: 0.46, turn: Math.PI, half: 0.03, y: 0.94, z: 0, apart: 0.16, tube: 1.35 },    // by its closed legs, the tube swung upright
      }[key] || { lift: 0.62, ahead: 0.5, turn: 0, half: o.bw / 2 + 0.03, y: 0, z: 0, plain: true };
    },
    startHaul(name) {
      const o = this.obj(name); if (!o) return;
      if (o.hung) o.setHung(false);                                     // (a guitar off its hook on a Studio wall: back on its stand)
      this.hauling = { o, k: 0, dir: 1, from: { x: o.x, z: o.z }, to: null, grip: this.haulGrip(o), aim: o.aim ? { ...o.aim } : null };
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
      const q = h.grip, lift = q.lift, c = new THREE.Vector3(root.position.x + fx * (q.ahead + q.z), lift + q.y, root.position.z + fz * (q.ahead + q.z));
      const side = (s) => c.clone().add(new THREE.Vector3(s * lx * q.half, s * (q.apart || 0) / 2, s * lz * q.half));
      if (q.plain) return { L: side(1), R: side(-1) };
      // (the hands close round it from the sides: fingers forward, palms inward; the wrist is half a hand back from what they hold)
      const hl = this.g.limb.Right.handLen * 0.55, out = 0.03;
      const hand = (s) => { const f = new THREE.Vector3(fx - s * lx * 0.25, 0.1, fz - s * lz * 0.25).normalize(), palm = new THREE.Vector3(-s * lx, 0, -s * lz); palm.addScaledVector(f, -palm.dot(f)).normalize(); return { p: side(s).addScaledVector(f, -hl).addScaledVector(palm, -out), hand: { fingers: f, palm } }; };
      const L = hand(1), R = hand(-1);
      return { L: L.p, R: R.p, handL: L.hand, handR: R.hand };
    },
    updateHaul() {
      const h = this.hauling;
      if (!h) return;
      const dt = Math.min(0.1, this.time - (this.haulT0 ?? this.time)); this.haulT0 = this.time;
      h.k = Math.min(1, Math.max(0, h.k + h.dir * dt / 0.9));
      const root = this.g.root, yaw = root.rotation.y, k = h.k * h.k * (3 - 2 * h.k);
      const o = h.o, q = h.grip, cx = root.position.x + Math.sin(yaw) * q.ahead, cz = root.position.z + Math.cos(yaw) * q.ahead;
      const base = h.dir > 0 ? h.from : (h.to || h.from);
      const by = base.y || 0;
      o.group.position.set(base.x + (cx - base.x) * k, by + (q.lift - by) * k, base.z + (cz - base.z) * k);
      const way = h.dir > 0 || q.plain ? yaw + q.turn : o.yaw, dy = Math.atan2(Math.sin(way - o.group.rotation.y), Math.cos(way - o.group.rotation.y));      // (on the way down it turns to the way it will stand)
      o.hauledYaw = o.group.rotation.y + (h.dir > 0 && k > 0.98 ? dy : dy * Math.min(1, dt * 9));
      if (q.tube && h.aim && o.setAim) o.setAim(h.aim.yaw, h.aim.pitch + (q.tube - h.aim.pitch) * k);
      if (o.fold) o.fold(k);
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
    // where it is wanted: { room, pref } or null (nowhere in particular)
    siteFor(id) {
      const r = RECIPES[id], w = this.w, p = r && w.instanceSite(r.object);
      if (!p || !r.serves) return null;
      const room = p.room, b = room === 'main' || room === 'door' ? WALK : w.doors[room] && w.doors[room].shell.bounds;
      if (!b) return null;
      if (room !== 'main' && room !== 'door' && this.doorLockedFor(room)) return null;                      // a locked room: it is put together where it stands, not carried in
      if (this.stuckIn() && !this.canReach(room)) return null;                                              // shut in the Workshop, with no open door on the way there: it is put together here, not carried out
      return { room, pref: p };
    },
    // out of the Workshop with it, through the other room's door if it goes there, put it together where it is wanted, and back out
    deliverSteps(id) {
      if (this.builtWhole) { const n = this.builtWhole; this.builtWhole = null; return this.pinSetSteps(n); }
      if (this.carry !== 'flat' && this.carry !== 'mflat') return [];
      const site = this.siteFor(id);
      if (!site) return [{ type: 'plan', fn: () => [this.play('idle', 0.3, { at: [0.1, () => this.setUp(id, null)] })] }];
      // (through every door between here and there: a corner room (the Bedroom, the Library) is entered through the Workshop itself, so he does not leave it first)
      const away = site.room !== 'main' && site.room !== 'door';
      return [{ type: 'plan', fn: () => this.tripSteps(this.hereId(), away ? site.room : 'main') },
        { type: 'plan', fn: () => this.setupSteps(id) },
        ...(away ? [{ type: 'plan', fn: () => this.tripSteps(site.room, 'main') }] : [])];
    },
    setupSteps(id) {
      const site = this.siteFor(id);
      if (!site) return [this.play('idle', 0.3, { at: [0.1, () => this.setUp(id, null)] })];
      const { room, pref } = site, sz = this.w.instanceSize(RECIPES[id].object) || { bw: 0.6, bd: 0.6 }, turned = (pref.rot || 0) % 2;
      const { st, edge } = this.setUpStand(room, pref, turned ? sz.bd : sz.bw, turned ? sz.bw : sz.bd);                 // (clear of it: his legs were in a new bed as it grew)
      return [this.walk(st.x, st.z, Math.atan2(pref.x - st.x, pref.z - st.z)),
        this.play('reach', 3.4, { target: () => V(edge.x, 0.3, edge.z), at: [2.0, () => this.setUp(id, site)] }),
        this.play('idle', 0.6)];
    },
    // the flat-pack becomes the real thing: it grows into place (and is counted in storage if there is no room for it)
    // (`site` null: he cannot get to where it belongs after all: it is put together where he stands, never in a room he is not in)
    setUp(id, site) {
      const r = RECIPES[id], p = this.g.root.position;
      this.setCarry(null); this.flatKind = null;
      this.endBuild();
      const name = this.w.addInstance(r.object, null, null, true, site ? null : { x: p.x, z: p.z });
      if (name) { const o = this.w.objects[name]; (this.popping ||= []).push({ o, t: 0 }); sfx('chime'); }
      else { const items = this.w.stock.items; items[r.object] = Math.min(STORAGE_CAP, (items[r.object] || 0) + 1); sfx('chime'); }
      if (this.onBuilt) this.onBuilt(name ? `${this.who()} built a ${r.name}${site ? ' and put it where it is needed!' : '! It stays here until the way to its room is open.'}` : `${this.who()} built a ${r.name}! There is no room for it, so it is in storage.`);
    },
    // ------------------------------------------------------------------ carried home: built things left standing in the Workshop
    // A piece built for another room can end up in the Workshop: he was cut short with it flat-packed in his arms (workCleanup sets it down
    // where he stands), or its room was locked when it was finished. The Workshop is for making things, not keeping them: GUY or GAL packs
    // it flat again, carries it through the doors and puts it together where it belongs (the same place a fresh one is built for).
    // Where `o` goes in its own room: { x, z, rot?, room } (its planned spot, else the nearest free place in that room), or null.
    homeSpot(o) {
      const w = this.w, s = o && o.kind && RECIPES[o.kind] && w.instanceSite(o.kind);
      if (!s || s.room === 'workshop' || s.room === 'door') return null;
      if (s.room === 'main' ? this.stuckIn() : (!w.doors[s.room] || this.doorLockedFor(s.room) || w.doors[s.room].closing)) return null;
      const keep = o.rot;
      if (s.rot !== undefined) o.rot = s.rot;
      const at = w.fits(o, s.x, s.z) && w.ownStandClear(o, s.x, s.z) && !w.onSomeonesStand(o, s.x, s.z) ? { x: s.x, z: s.z } : w.findSpot(o, s, null);
      o.rot = keep;
      if (!at || w.roomIdAt(at.x, at.z) !== s.room) return null;
      return { x: at.x, z: at.z, rot: s.rot, room: s.room };
    },
    // The built things in the Workshop that belong in another room he can get to, with where each goes: [{ o, spot }].
    homeMoves() {
      const w = this.w;
      const pins = this.pinMove();
      if (pins) return [pins];
      if (!w.doors.workshop || this.doorLockedFor('workshop')) return [];
      const out = [];
      for (const o of Object.values(w.objects)) {
        if (!o.kind || !RECIPES[o.kind] || o.packed || o.hauled || o.stowed || o.removable === false) continue;
        if (RECIPES[o.kind].whole || w.roomIdAt(o.x, o.z) !== 'workshop' || this.otherUses(o.name)) continue;          // (the other robot is using it, or carrying it already)
        const spot = this.homeSpot(o);
        if (spot) out.push({ o, spot });
      }
      return out.sort((a, b) => (a.o.name < b.o.name ? -1 : 1));
    },
    // Called from choose(): 'carryhome' when something built for another room stands in the Workshop (a chore, not chosen by weight).
    homeMoveNext() {
      if (this.lock || this.held || this.carry || this.hauling) return null;          // (shut in, he still carries home what belongs in a room he can get to)
      if (this.time - (this.homeTried || -999) < 30) return null;          // (it did not work a moment ago: not straight away again)
      return this.homeMoves().length ? 'carryhome' : null;
    },
    // Cut short with it flat in his arms: put together where he stands if it fits there, otherwise back where it was. Never lost.
    homeCleanup() {
      const m = this.homeMove;
      if (!m) return;
      this.homeMove = null;
      const o = this.obj(m.name);
      if (m.whole) {                                                             // (in his arms as it is: set down on the nearest free floor)
        if (!this.hauling) { if (o && !o.stowed) o.obstacle.active = true; return; }      // (put down already: it stays where it stands)
        this.dropHaul();
        if (!o) return;
        const q = this.g.root.position, ry = this.g.root.rotation.y, ah = { x: q.x + Math.sin(ry) * 0.7, z: q.z + Math.cos(ry) * 0.7 };
        const at = this.w.fits(o, ah.x, ah.z) ? ah : this.w.findSpot(o, { x: q.x, z: q.z }, null), to = at && this.w.roomIdAt(at.x, at.z) !== 'door' ? at : m.from;
        o.set(to.x, to.z);
        return;
      }
      if (this.carry === 'flat' || this.carry === 'mflat') this.setCarry(null);
      if (!o || !o.packed) return;
      const p = this.g.root.position, yaw = this.g.root.rotation.y;
      const ahead = { x: p.x + Math.sin(yaw) * 0.7, z: p.z + Math.cos(yaw) * 0.7 };
      const here = this.w.fits(o, ahead.x, ahead.z) ? ahead : this.w.findSpot(o, ahead, null);
      const back = here && this.w.roomIdAt(here.x, here.z) !== 'door' ? here : m.from;
      this.w.unpackShelf(m.name, { x: back.x, z: back.z, rot: back === m.from ? m.from.rot : o.rot });
    },
    // let go of what is in his arms (it is a piece of furniture on the floor again, wherever it is put)
    dropHaul() {
      const h = this.hauling;
      if (!h) return;
      this.hauling = null; this.haulT0 = undefined;
      if (h.aim && h.o.setAim) h.o.setAim(h.aim.yaw, h.aim.pitch);
      if (h.o.fold) h.o.fold(0);
      h.o.hauled = false; h.o.hauledYaw = undefined; h.o.obstacle.active = true; h.o.group.position.y = 0;
    },
    // what he was carrying has been taken away by the user
    carryGone() {
      const m = this.homeMove;
      this.homeMove = null;
      this.dropHaul();
      if (this.carry === 'flat' || this.carry === 'mflat') this.setCarry(null);
      const o = m && (this.w.removed[m.name] || this.obj(m.name));
      if (o && o.packed) { o.packed = false; o.group.visible = true; }
      this.queue = []; this.step = null;
    },
    carryHomeSteps() {
      const m = this.homeMoves()[0];
      this.homeTried = this.time;
      if (!m) return ['nothing to carry', this.play('idle', 0.5)];
      (this.using ||= new Set()).add(m.o.name);                              // (his from the moment he sets off: with both robots on their way to it, both carried it)
      if (m.pins) return this.pinHomeSteps(m.o.name);
      const w = this.w, n = m.o.name, r = RECIPES[m.o.kind], room = m.spot.room, from = { x: m.o.x, z: m.o.z, rot: m.o.rot };
      const roomName = room === 'main' ? (this.isGal ? "GUY's room" : 'his own room') : `the ${w.doors[room].name}`;
      const at = () => { const o = this.obj(n); return o ? V(o.x, 0.35, o.z) : this.g.pos.clone(); };
      // put together where it belongs (looked up again: somebody may have put something there meanwhile)
      const setUp = () => {
        const o = this.obj(n);
        if (!o || !o.packed || !this.homeMove) return;
        const s = this.homeSpot(o);
        if (!s) { this.homeCleanup(); return; }
        this.setCarry(null);
        w.unpackShelf(n, { x: s.x, z: s.z, rot: s.rot ?? o.rot });
        o.home = { x: s.x, z: s.z };
        (this.popping ||= []).push({ o, t: 0 });
        this.homeMove = null;
        sfx('thud', 0.5); sfx('chime');
        if (this.onBuilt) this.onBuilt(`${this.who()} carried the ${r.name} out of the Workshop to ${roomName}.`);
      };
      return [`carrying the ${r.name.toLowerCase()} to ${roomName}`,
        { type: 'plan', fn: () => this.tripSteps(this.hereId(), 'workshop') },
        this.stand(n, 0.7, at),
        this.play('reach', 1.4, { needs: [n], at: [0.5, () => { this.homeMove = { name: n, from }; }], target: at }),
        // it comes apart: it goes flat, and the flat pack is in his arms
        this.play('reach', 1.8, { needs: [n], at: [1.2, () => { if (!this.homeMove) return; w.packShelf(n); this.setCarry(r.line === 'metal' ? 'mflat' : 'flat', 1); sfx('thud', 0.4); }], target: at }),
        { type: 'plan', fn: () => (this.homeMove ? this.tripSteps(this.hereId(), room) : []) },
        { type: 'plan', fn: () => {
          const o = this.obj(n);
          if (!o || !o.packed || !this.homeMove) return [];
          const s = this.homeSpot(o);
          if (!s) { this.homeCleanup(); return []; }
          const rot = s.rot ?? o.rot, wd = rot % 2 ? o.bd : o.bw, dp = rot % 2 ? o.bw : o.bd;
          const { st, edge } = this.setUpStand(room, s, wd, dp);
          return [this.walk(st.x, st.z, Math.atan2(s.x - st.x, s.z - st.z)),
            this.play('reach', 2.6, { target: () => V(edge.x, 0.35, edge.z), at: [1.8, setUp] }),
            this.play('idle', 0.5)];
        } }];
    },
    // Where he stands to put a piece (`wd` x `dp` on the floor) together at `p` in `room`: towards the middle of the room, clear of the piece
    // (a step back from its edge: a fixed 0.95 m from a bed's middle had his legs in the bed as it grew), and the near edge he reaches for.
    setUpStand(room, p, wd = 0.6, dp = 0.6) {
      const w = this.w, b = room === 'main' || room === 'door' ? WALK : w.doors[room].shell.bounds;
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, d = Math.hypot(cx - p.x, cz - p.z) || 1, ux = (cx - p.x) / d, uz = (cz - p.z) / d;
      const ext = Math.min(Math.abs(ux) > 1e-3 ? wd / 2 / Math.abs(ux) : 9, Math.abs(uz) > 1e-3 ? dp / 2 / Math.abs(uz) : 9);       // (from its middle to its edge, along that line)
      const edge = { x: p.x + ux * ext, z: p.z + uz * ext }, k = Math.max(0.95, ext + 0.45);
      return { st: { x: Math.min(b.maxX - 0.4, Math.max(b.minX + 0.4, p.x + ux * k)), z: Math.min(b.maxZ - 0.4, Math.max(b.minZ + 0.4, p.z + uz * k)) }, edge };
    },
    // new things grow into place over a moment
    lateWork2() {
      if (!this.popping || !this.popping.length) return;
      const dt = Math.max(0, Math.min(0.1, this.time - (this.popT0 ?? this.time))); this.popT0 = this.time;      // (never backwards: the clock can be set back, and a negative step blew a piece up thousands of times its size)
      for (const p of this.popping) { p.t += dt; const k = Math.max(0, Math.min(1, p.t / 0.9)), s = k * k * (3 - 2 * k); p.o.group.scale.setScalar(0.4 + 0.6 * s); if (k >= 1) p.done = true; }
      this.popping = this.popping.filter((p) => !p.done);
    },
    // Why he cannot do what the user asked with a Workshop object (a kind message), or null if he can.
    workRefusal(name) {
      const k = (id) => this.skills.has(id);
      const need = { workbench: 'workshop', toolbox: 'workshop', woodfactory: 'workshop', metalfactory: 'workshop.metal', botprinter: 'workshop' }[name];
      if (!need || (name === 'botprinter' && !(this.w.gal && this.w.gal.exists()))) return null;          // (before GAL is printed the machine builds her: no book needed)
      if (!k(need)) return `GUY doesn't know how to use that yet. Add the book "${need === 'workshop' ? 'Workshop Basics' : 'Metal Fabrication for Robots'}" to the shelf and he'll read it.`;
      if (['workbench', 'woodfactory', 'metalfactory', 'botprinter'].includes(name) && !this.pickRecipe()) return this.cannotBuild();
      return null;
    },
    // why he does not build anything now (a kind message): nothing is needed, or he lacks a book or a factory
    cannotBuild() {
      const w = this.w, line = this.buildLine();
      if (line === 'bot') return botMachine(w) ? 'The Build a Bot machine has nothing to print right now: its surprises are made from things that stand in the room together (a fish tank wants a coffee table, a jukebox a stereo and a mirror ball ...).' : 'The Build a Bot machine has to stand in the Workshop to print anything.';
      if (!w.objects.woodfactory && !w.objects.metalfactory && !botMachine(w)) return 'GUY needs a Wood Factory or a Metal Factory first.';
      if (!wants(this).length) return 'There is nothing the house needs right now, so GUY has nothing to build.';
      if (line === 'wood') return 'GUY needs a book, and the Wood Factory, to build what the house needs.';
      if (line === 'metal') return 'GUY needs a book, and the Metal Factory, to build what the house needs.';
      return 'GUY needs a book and the right factory in the Workshop to build what the house needs.';
    },
    // the factory he was pointed at, or is locked on ('wood' | 'metal'), or null for any
    buildLine() { return this.forceLine || (this.lock && { woodfactory: 'wood', metalfactory: 'metal', botprinter: 'bot' }[this.lock.name]) || null; },
    // can he build this recipe right now: the book(s), the factory it needs, and room for one more of it
    // how many of a thing he will have made at most: one more of the furniture of a kind once he has read its "Matching Sets" chapter
    capOf(r) {
      const set = (r.serves === 'seat' || r.serves === 'diners') && ((r.line === 'wood' && this.has('workshop.furniture.ch3')) || (r.line === 'metal' && this.has('workshop.metal.ch3')));
      return r.cap + (set ? 1 : 0);
    },
    canBuild(id) {
      const r = RECIPES[id], w = this.w, st = w.stock;
      if (!r || !w.instanceKinds().includes(r.object)) return false;
      if (!skillsOf(r).every((k) => this.skills.has(k))) return false;
      if ((st.items[r.object] || 0) >= STORAGE_CAP) return false;
      const made = (st.items[r.object] || 0) + Object.values(w.objects).filter((o) => o.kind === r.object).length;
      if (made >= this.capOf(r)) return false;                                       // enough of these
      if (r.line === 'bot' && !botMachine(w)) return false;                          // (printed only by the Build a Bot machine, standing in the Workshop)
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
        carryhome: () => this.carryHomeSteps(),
        // clean the top of a high window: carry the foot stool there (unless it is there already), step up on it and wipe along the top of the frame
        dusttop: () => {
          const job = this.stoolJob();
          if (!job) return ['no window to clean', this.play('idle', 0.5)];
          const w = this.w, win = pick(job.wins), sp = job.spots.get(win), yaw = win.wall === 'back' ? Math.PI : -Math.PI / 2;
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
            const u = Math.min(win.u + win.hw - 0.1, Math.max(win.u - win.hw + 0.1, sp.u + Math.sin((this.time - t0) * 2.0) * span));
            return win.wall === 'back' ? V(u, top, -ROOM.d / 2 + 0.04) : V(-ROOM.w / 2 + 0.04, top, u);
          };
          steps.push({ type: 'plan', fn: () => { const p = this.g.root.position, from = { x: p.x, z: p.z }; return [this.play('reach', 7.5, { needs: [name], target, stool: { name, from } })]; } });
          return [`cleaning the top of the ${win.label} from the foot stool`, ...steps];
        },
        build: () => {
          const id = this.pickRecipe();
          if (!id) return ['wondering what to build', this.play('idle', 1)];
          const label = `building ${/s$/.test(RECIPES[id].name) ? '' : /^[aeiou]/i.test(RECIPES[id].name) ? 'an ' : 'a '}${RECIPES[id].name.toLowerCase()}`;
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
      if (this.hauling) { const o = this.hauling.o; if (o.fold) o.fold(0); o.hauled = false; o.obstacle.active = true; o.hauledYaw = undefined; const p = this.g.root.position; o.set(p.x + Math.sin(this.g.root.rotation.y) * 0.6, p.z + Math.cos(this.g.root.rotation.y) * 0.6); o.group.position.y = 0; this.hauling = null; this.haulT0 = undefined; }
      if (this.onStool) { const f = this.onStool; this.g.root.position.set(f.from.x, 0, f.from.z); this.onStool = null; }
      for (const id of ['woodfactory', 'metalfactory', 'botprinter']) { const f = this.obj(id); if (f && f.tray && f.tray.children.length) f.clearMade(); }
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
      if (this.carry === 'pins') P.pins.children.forEach((m, i) => { m.visible = i < this.carryN; });
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
