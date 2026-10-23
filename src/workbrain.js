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
import { RECIPES, PLANKS_PER_RUN, PARTS_PER_PLANK, STOCK_CAP, STORAGE_CAP, planksNeeded } from './workshop.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UPV = V(0, 1, 0);

export function installWorkshop(Brain, POSES, H) {
  const { smooth, clamp, lerp, rand, pick } = H;
  const sm = (x) => smooth(clamp(x, 0, 1));
  const ID = 'workshop';

  Object.assign(Brain.prototype, {
    initWork() {
      this.carry = null;                  // what he is carrying between stations: 'plank' | 'planks' | 'parts' | 'piece' | null
      this.pieceParts = 0;                // how many parts are knocked together in the piece he carries
      this.assembling = 0;                // how many parts are on the mallet block
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
      Object.values(this.workProps).forEach((p) => { p.visible = false; this.w.room.add(p); });
    },

    // ------------------------------------------------------------------ where he is
    inWorkshop() { return this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z) === ID; },
    // locked on something that is in the Workshop (so he stays in there between activities)
    lockedInside() { return this.inWorkshop() && this.lockHere(); },
    // locked on something that is in the Workshop (so a trip does not end with him walking out)
    lockHere() { const o = this.lock && this.obj(this.lock.name); return !!o && this.w.roomIdAt(o.x, o.z) === ID; },

    // ------------------------------------------------------------------ going in and out through the door
    doorIn(id) {
      const w = this.w, out = w.doorPoint(id, 0.8), inn = w.doorPoint(id, -1.0), face = w.doorYaw(id, false);
      return [this.walk(out.x, out.z, face),
        this.play('reach', 1.6, { at: [0.8, () => { w.setDoorOpen(id, true); sfx('click'); }], target: () => w.doorKnob(id) }),
        this.play('idle', 0.7),
        { ...this.walk(inn.x, inn.z), direct: true }];
    },
    doorOut(id) {
      const w = this.w, out = w.doorPoint(id, 0.8), inn = w.doorPoint(id, -1.0), face = w.doorYaw(id, false);
      return [this.walk(inn.x, inn.z), { ...this.walk(out.x, out.z), direct: true }, this.walk(out.x, out.z, face),
        this.play('reach', 1.6, { at: [0.8, () => w.setDoorOpen(id, false)], target: () => w.doorKnob(id) })];
    },
    // A trip: in through the door (unless he is already inside), the steps, and out again (unless he is locked on something in here).
    shopTrip(label, inner) {
      return [label, ...(this.inWorkshop() ? [] : this.doorIn(ID)), ...inner, ...(this.lockHere() ? [] : this.doorOut(ID))];
    },
    stand(name, front = 0.7) { return this.walkAt(name, 0, front, Math.PI); },

    // ------------------------------------------------------------------ the stations
    // the toolbox: lift the lid, reach in, close it (getting the tools out, or putting them away)
    toolboxSteps() {
      if (!this.obj('toolbox')) return [];
      const tb = () => this.obj('toolbox');
      return [this.stand('toolbox', 0.6),
        this.play('reach', 1.4, { needs: ['toolbox'], at: [0.6, () => { tb().setOpen(true); sfx('lid'); }], target: () => tb().lidPoint() }),
        this.play('reach', 1.3, { needs: ['toolbox'], target: () => tb().toolPoint() }),
        this.play('reach', 1.4, { needs: ['toolbox'], at: [0.6, () => { tb().setOpen(false); sfx('lid'); }], target: () => tb().lidPoint() })];
    },
    // press the factory's button, wait while it runs, then take the planks off its tray
    factorySteps() {
      const f = () => this.obj('woodfactory');
      return [this.stand('woodfactory', 0.78),
        this.play('reach', 1.6, { needs: ['woodfactory'], at: [0.7, () => { f().press(); f().run(3.4); sfx('click'); sfx('machine'); }], target: () => f().buttonPoint() }),
        this.play('idle', 3.6, { needs: ['woodfactory'], at: [3.0, () => { f().setTray(PLANKS_PER_RUN); sfx('thud', 0.5); }] }),
        this.play('reach', 1.8, { needs: ['woodfactory'], at: [0.9, () => { f().setTray(0); this.carry = 'planks'; sfx('bookgrab'); }], target: () => f().trayPoint() })];
    },
    // put what he carries on the workbench: planks on the wood pile, parts on the parts pile
    benchPlace(kind, n) {
      const wb = () => this.obj('workbench');
      return [this.stand('workbench', 0.78),
        this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => { this.carry = null; this.w.addStock(kind, n); sfx('place', 0.2); }], target: () => (kind === 'wood' ? wb().pilePoint() : wb().partsPoint()) })];
    },
    // take a plank off the workbench pile, put it on the sawhorse, saw it in two, and carry the parts back
    sawSteps() {
      const wb = () => this.obj('workbench'), sw = () => this.obj('saw');
      return [this.stand('workbench', 0.78),
        this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => { this.w.addStock('wood', -1); this.carry = 'plank'; sfx('bookgrab'); }], target: () => wb().pilePoint() }),
        this.stand('saw', 0.72),
        this.play('reach', 1.5, { needs: ['saw'], at: [0.8, () => { sw().setPlank('whole'); this.carry = null; sfx('place', 0.2); }], target: () => sw().at(0, 0.84, 0.05) }),
        this.play('workSaw', 6.2, { needs: ['saw'], work: { kind: 'saw', obj: 'saw' }, onEnd: () => sw().setPlank('cut') }),
        this.play('reach', 1.6, { needs: ['saw'], at: [0.8, () => { sw().setPlank(null); this.carry = 'parts'; sfx('bookgrab'); }], target: () => sw().at(0, 0.84, 0.05) }),
        ...this.benchPlace('parts', PARTS_PER_PLANK)];
    },
    // take the parts to the mallet block and tap them together; pick up the finished piece
    assembleSteps(r) {
      const wb = () => this.obj('workbench'), ml = () => this.obj('mallet');
      return [this.stand('workbench', 0.78),
        this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => { this.w.addStock('parts', -r.parts); this.carry = 'parts'; sfx('bookgrab'); }], target: () => wb().partsPoint() }),
        this.stand('mallet', 0.55),
        this.play('reach', 1.5, { needs: ['mallet'], at: [0.8, () => { this.carry = null; this.assembling = r.parts; ml().setParts(Math.min(4, r.parts)); sfx('place', 0.2); }], target: () => ml().at(0, ml().TOP + 0.1, 0.05) }),
        this.play('workTap', 1.2 + r.taps * 0.85, { needs: ['mallet'], work: { kind: 'tap', obj: 'mallet', taps: r.taps } }),
        this.play('reach', 1.6, { needs: ['mallet'], at: [0.8, () => { ml().setParts(0); this.pieceParts = this.assembling; this.assembling = 0; this.carry = 'piece'; sfx('bookgrab'); }], target: () => ml().at(0, ml().TOP + 0.1, 0.05) })];
    },
    // carry the piece to the sander and smooth it
    sandSteps() {
      return [this.stand('sander', 0.52),
        this.play('workSand', 6.5, { needs: ['sander'], work: { kind: 'sand', obj: 'sander' } })];
    },
    // put the finished thing on the workbench, and count it in storage
    finishSteps(id) {
      const r = RECIPES[id], wb = () => this.obj('workbench');
      return [this.stand('workbench', 0.78),
        this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => {
          this.carry = null; this.pieceParts = 0;
          // what he made stands in the Workshop straight away (the user can move it or put it away); storage only if there is no room
          const placed = this.w.placeBuilt(r.object);
          if (!placed) { const items = this.w.stock.items; items[r.object] = Math.min(STORAGE_CAP, (items[r.object] || 0) + 1); }
          sfx('chime');
          if (this.onBuilt) this.onBuilt(placed ? `Guy built a ${r.name}! It is in the Workshop.` : `Guy built a ${r.name}! There is no room in the Workshop, so it is in storage.`);
        }], target: () => wb().productPoint() }),
        this.play('idle', 2.0, { needs: ['workbench'] })];
    },
    // Why he cannot do what the user asked with a Workshop object (a kind message), or null if he can.
    workRefusal(name) {
      const k = (id) => this.skills.has(id), st = this.w.stock;
      const need = { workbench: 'workshop', toolbox: 'workshop', mallet: 'workshop', woodfactory: 'workshop.materials', saw: 'workshop.materials', sander: 'workshop.materials' }[name];
      if (!need) return null;
      if (!k(need)) return `Guy doesn't know how to use that yet. Add the book "${need === 'workshop' ? 'Workshop Basics' : 'Wood & Metal Basics'}" to the shelf and he'll read it.`;
      if (name === 'saw' && st.wood < 1) return 'There are no planks yet. Guy can make some at the Wood Factory.';
      if (name === 'sander' && st.wood < 1) return 'There is nothing to sand yet. Guy can make planks at the Wood Factory.';
      if (name === 'workbench' && !this.pickRecipe()) return 'Guy needs a saw, a mallet and a book about what to build first.';
      return null;
    },
    // which recipe he can make right now (and has read the book for), or null
    pickRecipe() {
      const w = this.w, st = w.stock;
      const options = Object.entries(RECIPES).filter(([, r]) => {
        if (!this.skills.has(r.skill)) return false;
        if ((st.items[r.object] || 0) >= STORAGE_CAP) return false;
        const made = (st.items[r.object] || 0) + Object.values(this.w.objects).filter((o) => o.kind === r.object).length;
        if (made >= r.cap) return false;                    // he has made enough of these
        if (!this.obj('workbench') || !this.obj('saw') || !this.obj('mallet') || (r.sand && !this.obj('sander'))) return false;
        const need = planksNeeded(r, st.parts);
        if (st.wood < need && !this.obj('woodfactory')) return false;
        return st.wood + Math.ceil(Math.max(0, need - st.wood) / PLANKS_PER_RUN) * PLANKS_PER_RUN <= STOCK_CAP;
      }).map(([id]) => id);
      return options.length ? pick(options) : null;
    },
    buildSteps(id) {
      const r = RECIPES[id], st = this.w.stock;
      let wood = st.wood;
      const need = planksNeeded(r, st.parts);
      const steps = [...this.toolboxSteps()];
      while (wood < need) { steps.push(...this.factorySteps(), ...this.benchPlace('wood', PLANKS_PER_RUN)); wood += PLANKS_PER_RUN; }
      for (let i = 0; i < need; i++) steps.push(...this.sawSteps());
      steps.push(...this.assembleSteps(r));
      if (r.sand) steps.push(...this.sandSteps());
      steps.push(...this.finishSteps(id), ...this.toolboxSteps());
      return steps;
    },

    // ------------------------------------------------------------------ the activities
    workActivities() {
      const w = this.w;
      return {
        makewood: () => this.shopTrip('making planks in the Wood Factory', [...this.factorySteps(), ...this.benchPlace('wood', PLANKS_PER_RUN)]),
        sawwood: () => this.shopTrip('sawing a plank into parts', this.sawSteps()),
        tap: () => this.shopTrip('tapping on the assembly block with the rubber mallet', [this.stand('mallet', 0.55), this.play('workTap', 7.5, { needs: ['mallet'], work: { kind: 'tap', obj: 'mallet', taps: 8 } })]),
        sand: () => this.shopTrip('sanding a plank smooth', [
          this.stand('workbench', 0.78),
          this.play('reach', 1.6, { needs: ['workbench'], at: [0.8, () => { w.addStock('wood', -1); this.carry = 'plank'; sfx('bookgrab'); }], target: () => this.obj('workbench').pilePoint() }),
          ...this.sandSteps(),
          ...this.benchPlace('wood', 1)]),
        tidytools: () => this.shopTrip('tidying the toolbox', this.toolboxSteps()),
        build: () => {
          const id = this.pickRecipe();
          if (!id) return ['wondering what to build', this.play('idle', 1)];
          return this.shopTrip(`building a ${RECIPES[id].name.toLowerCase()}`, this.buildSteps(id));
        },
      };
    },

    // Put things back if he was cut short: what he carries and what is on the sawhorse go back to the stock.
    workCleanup() {
      const w = this.w;
      if (this.carry === 'plank') w.addStock('wood', 1);
      else if (this.carry === 'planks') w.addStock('wood', PLANKS_PER_RUN);
      else if (this.carry === 'parts') w.addStock('parts', PARTS_PER_PLANK);
      else if (this.carry === 'piece') w.addStock('parts', this.pieceParts || 0);          // the parts he had knocked together go back as parts
      this.carry = null; this.pieceParts = 0;
      if (this.assembling) { w.addStock('parts', this.assembling); this.assembling = 0; }   // parts left on the mallet block

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
      const dirOf = (x, y, z) => V(x, y, z).normalize().applyQuaternion(gq);
      const down = V(0, -1, 0), xAxis = V(1, 0, 0).applyQuaternion(gq), leftOf = V(-1, 0, 0).applyQuaternion(gq);
      const out = { kind: f.kind, w, lean: f.kind === 'sand' ? 0.9 : f.kind === 'tap' ? 0.75 : 0.55, R: null, L: null };      // how far he bends over the work
      if (f.kind === 'saw') {
        const phase = (T - 0.6) * Math.PI * 2 / 0.9, stroke = Math.sin(phase);
        const sink = 0.035 * clamp((T - 0.8) / (D - 1.6), 0, 1);
        const grip = o.at(0.12, 0.99 - sink, 0.27 + 0.1 * stroke), fd = dirOf(0, -0.3, -0.95);
        out.R = { wrist: grip.clone().addScaledVector(fd, -hl * 0.45), f: fd, palm: leftOf };
        out.L = { wrist: o.at(-0.25, 0.87, 0.08), f: xAxis, palm: down };
        out.tool = { o, kind: 'saw', f: fd, grip };
        const n = Math.floor(phase / Math.PI);
        if (T > 0.6 && n !== s.sawN) { s.sawN = n; sfx('saw'); }
      } else if (f.kind === 'tap') {
        const period = 0.85, k = (T - 0.8) / period, p = k - Math.floor(k), going = T > 0.8 && T < D - 0.8 && (T - 0.8) / period < f.taps;
        const lift = going ? (p < 0.35 ? (1 - sm(p / 0.35)) * 0.2 : sm((p - 0.35) / 0.3) * 0.2) : 0.1;
        const head = o.at(0, o.TOP + 0.1 + lift, 0.0), fd = dirOf(0, -0.55, -0.83);
        const center = head.clone().addScaledVector(fd, -0.22);
        out.R = { wrist: center.clone().addScaledVector(fd, -hl * 0.45), f: fd, palm: leftOf };
        out.L = { wrist: o.at(-0.2, o.TOP + 0.08, 0.17), f: xAxis, palm: down };
        out.tool = { o, kind: 'tap', f: fd, head };
        const n = Math.floor(k);
        const base = o.TOP + 0.02;
        if (going && p >= 0.35 && n !== s.tapN) { s.tapN = n; sfx('tap'); o.assembly.position.y = base + 0.012; o.assembly.rotation.z = (n % 2 ? 1 : -1) * 0.04; }
        o.assembly.position.y += (base - o.assembly.position.y) * 0.3;                      // the parts jump a little at every tap and settle
        o.assembly.rotation.z *= 0.85;
      } else {                                                       // sand: both hands slide the piece along the belt
        const C = o.at(0.12 * Math.sin((T - 0.6) * Math.PI * 2 / 1.1), o.BELT + 0.06, 0.06);
        out.R = { wrist: C.clone().addScaledVector(xAxis, 0.2), f: xAxis.clone().negate(), palm: down };
        out.L = { wrist: C.clone().addScaledVector(xAxis, -0.2), f: xAxis, palm: down };
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
    workSand(g, t, dur, ctx) { workPose(g, ctx.hob, 0.35); },
  });
}
