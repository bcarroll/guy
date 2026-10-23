// Guy in the Restaurant: taking orders, cooking at the stove, carrying the plates to the tables and taking the payment at the
// register. Installed onto Brain at the bottom of brain.js (like the Workshop). The customers and their moods are in customers.js
// (`world.restaurant`); the furniture is in restobjects.js.
//
// Running the restaurant is Guy's default, not a rule: it is a set of ordinary activities with a high weight while somebody is
// waiting. If he is busy somewhere else the customers wait, and give up politely if it takes too long. Later a second robot can do
// the same jobs through the same activities (see the plan, "Build a Bot").
//
// What he carries is shown in his hand (`this.carry === 'plate'`). If he is cut short, `restCleanup` puts everything back as it was:
// a dish not yet served goes back on the counter, and an order not yet cooked goes back to waiting.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { DISHES } from './restobjects.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ID = 'restaurant';
export const REST_OBJECTS = ['stove', 'kitchencounter', 'register', 'diningtable', 'diningtable2'];
export const REST_JOBS = ['takeorder', 'cook', 'serve', 'takepay'];

export function installRestaurant(Brain, POSES, H) {
  const { smooth, clamp, rand } = H;
  const sm = (x) => smooth(clamp(x, 0, 1));

  // stirring the pot is a "work" step like sawing and tapping; the workbrain handles those, this handles the stirring
  const baseCompute = Brain.prototype.computeWork;
  Brain.prototype.computeWork = function (s, dt) {
    if (s.fx.work.kind === 'stir') return this.computeStir(s, dt);
    return baseCompute.call(this, s, dt);
  };

  Object.assign(Brain.prototype, {
    initRest() {
      this.restJob = null;                 // { c, act }: the customer he is working for, so he can put things back if he is cut short
      const plate = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.02, 18), new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.5 }));
      disc.position.y = 0.01; disc.castShadow = true; plate.add(disc);
      const heap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.8 }));
      heap.scale.y = 0.55; heap.position.y = 0.045; heap.castShadow = true; plate.add(heap);
      plate.userData.setDish = (d) => heap.material.color.set(DISHES[d] ? DISHES[d].color : 0xd9822b);
      plate.visible = false;
      this.w.room.add(plate);
      this.workProps.plate = plate;
    },

    // ------------------------------------------------------------------ where he is and whether he stays
    inRestaurant() { return this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z) === ID; },
    // locked on one of the restaurant's objects (the user asked him to keep working there)
    restLocked() { const o = this.lock && this.obj(this.lock.name); return !!o && this.w.roomIdAt(o.x, o.z) === ID; },
    // he is in the restaurant and has a reason to stay (customers about, or the user locked him on it)
    restStays() {
      const r = this.w.restaurant;
      return this.inRestaurant() && !!r && (this.restLocked() || r.busy());
    },
    restNext() { const r = this.w.restaurant; return (r && r.nextJob()) || (this.available('rwait') ? 'rwait' : null); },
    restTrip(label, inner) { return [label, ...(this.inRestaurant() ? [] : this.doorIn(ID)), ...inner]; },
    restDone(c) { const r = this.w.restaurant; if (r) r.release(c); this.restJob = null; },

    // Can he do this restaurant job right now?
    restAvailable(act) {
      const r = this.w.restaurant;
      if (!r || !this.w.doors[ID]) return false;
      if (act === 'rwait') return (r.isOpen() || r.busy()) && REST_OBJECTS.some((n) => this.obj(n));
      return !!r.find(act);
    },

    // Why he cannot do what the user asked with a restaurant object (a kind message), or null if he can.
    restRefusal(name) {
      if (!REST_OBJECTS.includes(name)) return null;
      if (!this.skills.has('restaurant')) return `Guy doesn't know how to run a restaurant yet. Add the book "Restaurant Basics" to the shelf and he'll read it.`;
      const r = this.w.restaurant;
      if (!r || !r.isOpen()) return 'The restaurant needs a stove, a kitchen counter, a cash register and a table before it can open.';
      return null;
    },
    // what he does when the user points at a restaurant object: the job that fits it if there is one, otherwise wait for customers
    restTries(name) {
      const job = { stove: 'cook', kitchencounter: 'serve', register: 'takepay', diningtable: 'takeorder', diningtable2: 'takeorder' }[name];
      return this.available(job) ? [job] : ['rwait'];
    },

    // Put things back if he was cut short.
    restCleanup() {
      const r = this.w.restaurant, job = this.restJob;
      this.restJob = null;
      if (job && r) {
        const c = job.c;
        r.release(c);
        if (r.alive(c)) {
          if (job.act === 'cook' && c.state === 'cooking') {
            c.state = 'ordered'; c.slot = null; r.setBubble(c, DISHES[c.dish].icon);       // the order goes back to waiting to be cooked
            const st = this.obj('stove');
            if (st) st.cook(0);
          } else if (job.act === 'serve' && this.carry === 'plate') {
            const k = this.obj('kitchencounter');                                              // the plate goes back where it was
            if (k && c.slot !== null && !k.slots[c.slot].children.length) k.setPlate(c.slot, c.dish);
          }
        }
      }
      if (this.carry === 'plate') this.carry = null;
    },

    // ------------------------------------------------------------------ the activities
    restActivities() {
      const w = this.w;
      const none = (what) => [what, this.play('idle', 0.5)];
      return {
        // go to the table and ask what they would like
        takeorder: () => {
          const r = w.restaurant, c = r && r.find('takeorder');
          if (!c) return none('looking for somebody to serve');
          c.claim = true; this.restJob = { c, act: 'takeorder' };
          const tn = c.seat.table, i = c.seat.i;
          return this.restTrip(`taking ${c.name}'s order`, [
            this.walkAt(tn, 0, i === 0 ? 1.42 : -1.42, i === 0 ? Math.PI : 0),
            this.play('idle', 2.6, { needs: [tn], at: [1.0, () => r.takeOrder(c)], onEnd: () => this.restDone(c) })]);
        },

        // stir the pot until it is done, carry the plate to the counter and put it down
        cook: () => {
          const r = w.restaurant, c = r && r.find('cook');
          if (!c) return none('looking for something to cook');
          c.claim = true; this.restJob = { c, act: 'cook' };
          r.startCooking(c);
          const dish = DISHES[c.dish], slot = c.slot;
          return this.restTrip(`cooking ${dish.name} for ${c.name}`, [
            this.stand('stove', 0.62, () => this.obj('stove').potPoint()),
            this.play('workTap', dish.cook + 2.4, {
              needs: ['stove'], work: { kind: 'stir', obj: 'stove' },
              at: [0.8, () => { this.obj('stove').cook(dish.cook); sfx('sizzle'); }],
              onEnd: () => { this.carry = 'plate'; this.workProps.plate.userData.setDish(c.dish); sfx('bookgrab'); },
            }),
            this.stand('kitchencounter', 0.62, () => this.obj('kitchencounter').platePoint(slot)),
            this.play('reach', 1.6, {
              needs: ['kitchencounter'], target: () => this.obj('kitchencounter').platePoint(slot),
              at: [0.8, () => { this.carry = null; if (r.alive(c)) { this.obj('kitchencounter').setPlate(slot, c.dish); r.cooked(c, slot); } sfx('plate'); }],
              onEnd: () => this.restDone(c),
            })]);
        },

        // take the cooked plate off the counter and put it in front of the customer
        serve: () => {
          const r = w.restaurant, c = r && r.find('serve');
          if (!c) return none('looking for a plate to serve');
          c.claim = true; this.restJob = { c, act: 'serve' };
          const slot = c.slot, tn = c.seat.table, i = c.seat.i;
          return this.restTrip(`serving ${c.name}`, [
            this.stand('kitchencounter', 0.62, () => this.obj('kitchencounter').platePoint(slot)),
            this.play('reach', 1.5, {
              needs: ['kitchencounter'], target: () => this.obj('kitchencounter').platePoint(slot),
              at: [0.8, () => { this.obj('kitchencounter').setPlate(slot, null); this.carry = 'plate'; this.workProps.plate.userData.setDish(c.dish); sfx('bookgrab'); }],
            }),
            this.walkAt(tn, 0.78, i === 0 ? 0.45 : -0.45, -Math.PI / 2),
            this.play('reach', 1.6, {
              needs: [tn], target: () => this.obj(tn).platePoint(i),
              at: [0.8, () => { this.carry = null; if (r.alive(c) && c.state === 'cooked') { this.obj(tn).setPlate(i, c.dish); r.served(c); } sfx('plate'); }],
              onEnd: () => this.restDone(c),
            })]);
        },

        // press the till while the customer stands at the end of the counter
        takepay: () => {
          const r = w.restaurant, c = r && r.find('takepay');
          if (!c) return none('looking for somebody to take payment from');
          c.claim = true; this.restJob = { c, act: 'takepay' };
          return this.restTrip(`taking ${c.name}'s payment`, [
            this.stand('register', 0.62, () => this.obj('register').buttonPoint()),
            this.play('reach', 1.8, {
              needs: ['register'], target: () => this.obj('register').buttonPoint(),
              at: [0.9, () => { this.obj('register').pay(); sfx('ding'); sfx('cash'); r.collect(c); }],
              onEnd: () => this.restDone(c),
            }),
            this.play('idle', 0.6)]);
        },

        // nothing to do just now: stand by the till until somebody needs him
        rwait: () => {
          const n = REST_OBJECTS.find((x) => this.obj(x));                       // by the till if there is one, otherwise by whatever is left
          return this.restTrip('waiting for customers', [...(n ? [this.walkAt(n, n === 'register' ? -0.25 : 0, n === 'register' ? 0.95 : 1.0, Math.PI)] : []), this.play('idle', rand(3, 5))]);
        },
      };
    },

    // ------------------------------------------------------------------ the pot and the spoon
    // Hands for stirring: the right hand circles the spoon in the pot, the left rests on the stove.
    computeStir(s) {
      const f = s.fx.work, o = this.obj(f.obj);
      if (!o) return null;
      const g = this.g, T = s.t, D = s.dur;
      const w = sm(Math.min(T / 0.8, (D - T) / 0.8));
      const hl = g.limb.Right.handLen;
      o.group.updateWorldMatrix(true, false);
      const gq = o.group.getWorldQuaternion(new THREE.Quaternion());
      // the spoon is in the pot wherever he stands; the way his hand points and where the other hand rests follow the side he is on
      const side = this.sideOf(f.obj), sc = Math.cos(side * Math.PI / 2), ss = Math.sin(side * Math.PI / 2);
      const dirOf = (x, y, z) => V(x * sc + z * ss, y, -x * ss + z * sc).normalize().applyQuaternion(gq);
      const down = V(0, -1, 0), xAxis = dirOf(1, 0, 0), leftOf = dirOf(-1, 0, 0);
      const a = (T - 0.8) * 3.4;
      const head = o.at(-0.22 + Math.cos(a) * 0.045, 1.08, 0.16 + Math.sin(a) * 0.045), fd = dirOf(0, -0.55, -0.83);
      const center = head.clone().addScaledVector(fd, -0.22);
      const out = {
        kind: 'stir', w, lean: 0.8,
        R: { wrist: center.clone().addScaledVector(fd, -hl * 0.45), f: fd, palm: leftOf },
        L: { wrist: g.root.localToWorld(V(0.18, 1.0, 0.42)), f: xAxis, palm: down },
        tool: { o, kind: 'tap', f: fd, head },
      };
      o.stirring = true;
      this.hobProps.tool = out.tool;
      this.hobProps.sandPiece = null;
      return out;
    },
  });
}
