// The Restaurant's customers: who arrives (by the elevator), where they sit, what they order, how long they wait, and when they
// pay and leave. The logic here does not depend on how they look: a customer is a record that moves along paths, and a figure
// (a Mixamo model from customermodels.js, driven like Guy) is drawn on top of it. `headless` skips the figures, for the QA sweeps.
//
// A customer goes through these states:
//   ride     in the elevator, waiting for the doors to open
//   exit     walking out of the elevator
//   walk     walking to a free seat (path of points; then `next` is the state it goes to)
//   sitdown  easing into the seat            seated  looking at the menu   waiting  hand up: wants to order
//   ordered  has ordered (the dish is shown)  cooking  Guy is at the stove   cooked  the plate waits on the counter (Guy serves it)
//   eating   eating the dish at the table      standup  getting up            paying  at the register, waiting for Guy
//   leave    walking back to the elevator    enter    stepping in            ridden  inside, doors closing, then gone
// Guy does the work (src/restbrain.js): take the order, cook, serve, take the payment. Nobody is ever paid or served by magic: if
// Guy is busy somewhere else the customers wait, and give up (politely, without paying) if they wait too long to be asked or cooked for.
import * as THREE from 'three';
import { Guy, Q } from './guy.js';
import { sfx } from './sfx.js';
import { DISHES } from './restobjects.js';
import { availableCustomers } from './customermodels.js';
import { POSES, basePose, sitLegs, makeGrid, findPath } from './brain.js';

export const ID = 'restaurant';
export const MAX_CUSTOMERS = 3;
export const PATIENCE = 75;                       // seconds a customer waits to order or to have the cooking started
export const SPAWN_EVERY = [35, 70];              // seconds between arrivals while the restaurant is open
const SPEED = 0.9;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const SHIRTS = [0xe57373, 0x64b5f6, 0x81c784, 0xffd54f, 0xba68c8, 0xff8a65, 0x4db6ac];

export class Restaurant {
  // opts.skillOk(): whether Guy has learned the restaurant skill (customers only come when he can serve them)
  // opts.guyAt(): where Guy is (customers wait a moment instead of walking into him)
  // opts.headless: no figures are drawn
  constructor(world, opts = {}) {
    this.w = world;
    this.skillOk = opts.skillOk || (() => true);
    this.guyAt = opts.guyAt || (() => null);
    this.headless = !!opts.headless;
    this.list = [];
    this.t = 0;
    this.nextId = 1;
    this.spawnIn = 8;
    this.closeIn = 0;
    this.paused = false;                 // QA: no new arrivals
    this.nServed = 0; this.left = 0;      // counters, for the tests
    this.stats = { arrived: 0, paid: 0, gaveUp: 0 };
    this.turnedAway = 0; this.tableCount = 0;           // arrivals that found the restaurant full since the last table was added
    this.coinsShown = -1;
    this.liftOpen = false;
  }

  // ---------------------------------------------------------------- the room
  obj(n) { return this.w.objects[n]; }
  tables() { return Object.values(this.w.objects).filter((o) => o.seats); }          // the two it comes with and any that Guy builds
  seatCount() { return this.tables().reduce((n, t) => n + t.seats.length, 0); }
  maxCustomers() { return Math.max(MAX_CUSTOMERS, this.seatCount() - 1); }           // more tables, more customers
  // customers keep arriving while it is full (the owner's rule: then Guy or GAL builds another table); counted from the last table added
  needsSeats() { return this.turnedAway >= 3 && this.tables().length < 4 && this.isOpen(); }
  roomOn() { return !!this.w.doors[ID]; }
  // Can customers come? The room is there with its kitchen, a till and a table, and Guy knows how to run it.
  isOpen() {
    return this.roomOn() && !!this.obj('stove') && !!this.obj('kitchencounter') && !!this.obj('register') && this.tables().length > 0 && this.skillOk();
  }
  grid() { return makeGrid(this.w.obstacles, 0.2, 0, null, this.w.frameOf(ID)); }
  seatFree() {
    for (const t of this.tables()) for (let i = 0; i < t.seats.length; i++) if (!t.seats[i].who) return { table: t.name, i };
    return null;
  }
  slotFree() {                           // a free place for a plate on the counter that nobody has reserved
    const k = this.obj('kitchencounter');
    if (!k) return -1;
    return k.slots.findIndex((s, i) => !s.children.length && !this.list.some((c) => c.slot === i && ['cooking', 'cooked'].includes(c.state)));
  }

  // ---------------------------------------------------------------- what Guy can do now
  alive(c) { return this.list.includes(c) && c.state !== 'gone'; }
  // the customers Guy could do something for, by job
  find(job) {
    const free = (c) => !c.claim;
    switch (job) {
      case 'takeorder': return this.list.find((c) => c.state === 'waiting' && free(c) && this.obj(c.seat.table));
      case 'cook': return this.obj('stove') && this.obj('kitchencounter') && this.slotFree() >= 0 ? this.list.find((c) => c.state === 'ordered' && free(c)) : undefined;
      case 'serve': return this.list.find((c) => c.state === 'cooked' && free(c) && this.obj(c.seat.table) && this.obj('kitchencounter'));
      case 'takepay': return this.obj('register') ? this.list.find((c) => c.state === 'paying' && free(c)) : undefined;
      default: return undefined;
    }
  }
  // the next job in the order that keeps people happiest: money first, then food waiting, then orders, then cooking
  nextJob() { return ['takepay', 'serve', 'takeorder', 'cook'].find((j) => this.find(j)) || null; }
  hasWork() { return !!this.nextJob(); }
  // customers are in the restaurant (so there is a reason to be there, even if nothing is ready to do yet)
  busy() { return this.list.some((c) => c.state !== 'gone'); }
  count() { return this.list.length; }

  // ---------------------------------------------------------------- customers
  spawn(model = null) {
    if (!this.isOpen() || this.list.length >= this.maxCustomers()) return null;
    const seat = this.seatFree();
    if (!seat) return null;
    const pool = availableCustomers();
    const pick = model ? pool.find((m) => m.id === model) : pool.filter((m) => !this.list.some((c) => c.model.id === m.id));
    const m = model ? pick : (pick.length ? pick[Math.floor(Math.random() * pick.length)] : pool[Math.floor(Math.random() * pool.length)]);
    if (!m) return null;
    const p = this.w.elevatorPoint(ID, 0, true), yaw = this.w.elevatorYaw(ID), slot = this.list.length % 3 - 1;       // side by side in the cabin
    p.x += Math.cos(yaw) * slot * 0.38; p.z -= Math.sin(yaw) * slot * 0.38;
    const c = {
      id: this.nextId++, model: m, name: m.name, seat, state: 'ride', next: null, x: p.x, z: p.z, yaw, path: [], phase: 0, moving: false,
      dish: Object.keys(DISHES)[Math.floor(Math.random() * Object.keys(DISHES).length)], slot: null, claim: false, wait: 0, timer: 0, sitK: 0,
      bubble: '', blocked: 0, paid: false, happy: true, t: Math.random() * 10, shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    };
    this.obj(seat.table).seats[seat.i].who = c.id;
    this.list.push(c);
    this.stats.arrived++;
    sfx('lift');
    return c;
  }

  setBubble(c, text) { c.bubble = text; }

  // QA aid: a customer already in `state` (waiting / ordered / cooked / paying), as if they had been through the earlier states.
  stage(state, model = null) {
    const c = this.spawn(model);
    if (!c) return null;
    const info = this.seatInfo(c);
    c.path = []; c.next = null;
    const sit = () => { c.x = info.x; c.z = info.z; c.yaw = info.yaw; c.sitK = 1; };
    if (state === 'waiting') { sit(); c.state = 'waiting'; this.setBubble(c, '🙋'); }
    else if (state === 'ordered') { sit(); c.state = 'ordered'; this.setBubble(c, DISHES[c.dish].icon); }
    else if (state === 'cooked') {
      sit();
      const slot = this.slotFree();
      this.obj('kitchencounter').setPlate(slot, c.dish);
      c.state = 'cooked'; c.slot = slot; this.setBubble(c, '⏳');
    } else if (state === 'paying') {
      const p = this.paySpot();
      this.freeSeat(c);
      c.x = p.x; c.z = p.z; c.yaw = p.yaw; c.sitK = 0; c.state = 'paying'; c.wait = 0; this.setBubble(c, '💵');
    }
    return c;
  }

  // go along `pts` (world points), then be in state `next`
  go(c, pts, next, state = 'walk') { c.path = pts.slice(); c.state = state; c.next = next; }
  route(c, x, z) {                       // a path across the room's floor from where the customer is to (x, z)
    return findPath(this.grid(), c.x, c.z, x, z);
  }

  seatInfo(c) {
    const t = this.obj(c.seat.table);
    if (!t) return null;
    const s = t.seats[c.seat.i], back = s.z > 0 ? 0.06 : -0.06;
    const l = t.local(s.x, s.z + back), a = t.approach(c.seat.i), la = t.local(a.x, a.z);
    return { t, s, x: t.x + l.x, z: t.z + l.z, yaw: t.yaw + s.yaw, ax: t.x + la.x, az: t.z + la.z };
  }
  paySpot() {
    const r = this.obj('register');
    if (!r) return null;
    const l = r.local(0.92, 0.55);
    return { x: r.x + l.x, z: r.z + l.z, yaw: r.yaw - Math.PI / 2 };
  }

  // Guy has asked what they would like
  takeOrder(c) { if (c.state === 'waiting') { c.state = 'ordered'; c.wait = 0; this.setBubble(c, DISHES[c.dish].icon); sfx('pop'); } }
  // Guy is cooking their dish
  startCooking(c) { if (this.alive(c) && c.state === 'ordered') { c.state = 'cooking'; c.slot = this.slotFree(); this.setBubble(c, '👨‍🍳'); } }
  cooked(c, slot) { if (this.alive(c)) { c.state = 'cooked'; c.slot = slot; this.setBubble(c, '⏳'); } }
  // the plate is on their table
  served(c) {
    if (!this.alive(c)) return;
    c.state = 'eating'; c.slot = null; c.timer = rand(10, 14); c.wait = 0; this.setBubble(c, ''); this.nServed++;
  }
  // Guy took the payment
  collect(c) {
    if (!this.alive(c) || c.state !== 'paying') return 0;
    const price = DISHES[c.dish].price;
    this.w.addCoins(price);
    c.paid = true; c.happy = true; this.setBubble(c, '😊'); this.stats.paid++;
    c.timer = 1.0;
    c.state = 'thanks';
    return price;
  }
  release(c) { if (c) c.claim = false; }

  // a customer who has had enough (or whose table has gone) leaves; they stand up first if they are sitting
  abandon(c, unhappy = true) {
    if (!c || ['leave', 'enter', 'ridden', 'gone', 'standup', 'thanks'].includes(c.state)) return;
    if (unhappy) { c.happy = false; this.setBubble(c, '😞'); this.stats.gaveUp++; }
    const sitting = ['sitdown', 'seated', 'waiting', 'ordered', 'cooking', 'cooked', 'eating', 'paying'].includes(c.state);
    if (c.state === 'paying') { c.state = 'leave'; this.routeOut(c); return; }
    if (['cooking', 'cooked'].includes(c.state)) c.slot = null;
    if (sitting) { c.state = 'standup'; c.next = 'leave'; c.timer = 0; }
    else this.leaveNow(c);
  }
  leaveNow(c) { c.state = 'leave'; this.routeOut(c); }
  routeOut(c) {
    const out = this.w.elevatorPoint(ID, 0.7);
    c.path = this.route(c, out.x, out.z);
    c.next = 'enter';
    if (c.seat) this.freeSeat(c);
  }
  freeSeat(c) {
    const t = c.seat && this.obj(c.seat.table);
    if (t && t.seats[c.seat.i].who === c.id) { t.seats[c.seat.i].who = null; t.setPlate(c.seat.i, null); }
  }

  remove(c) {
    this.freeSeat(c);
    c.state = 'gone';
    this.list.splice(this.list.indexOf(c), 1);
    if (c.fig) c.fig.dispose();
    this.left++;
  }
  clear() {
    for (const c of this.list.slice()) this.remove(c);
    this.left = 0; this.liftOpen = false; this.closeIn = 0;
    const k = this.obj('kitchencounter'), st = this.obj('stove');          // and what was on the counter and the stove
    if (k) k.slots.forEach((_, i) => k.setPlate(i, null));
    if (st) st.cook(0);
  }

  // ---------------------------------------------------------------- time
  update(dt) {
    this.t += dt;
    if (!this.roomOn()) { if (this.list.length) this.clear(); this.coinsShown = -1; return; }
    const reg = this.obj('register');
    if (reg && this.coinsShown !== this.w.stock.coins) { reg.setCoins(this.w.stock.coins); this.coinsShown = this.w.stock.coins; }
    // arrivals
    if (this.isOpen() && !this.paused) {
      if ((this.spawnIn -= dt) <= 0) {
        this.spawnIn = rand(...SPAWN_EVERY);
        if (this.list.length >= this.maxCustomers()) this.turnedAway++; else this.spawn();
      }
    } else this.spawnIn = Math.max(this.spawnIn, 6);
    if (this.tables().length !== this.tableCount) { this.tableCount = this.tables().length; this.turnedAway = 0; }
    for (const c of this.list.slice()) this.tick(c, dt);
    this.doors(dt);
    for (const c of this.list) this.draw(c, dt);
  }

  // the elevator doors are open while anybody is getting in or out
  doors(dt) {
    const near = (c) => { const p = this.w.elevatorPoint(ID, 0.7); return Math.hypot(c.x - p.x, c.z - p.z) < 3.2; };
    const wants = (c) => ['ride', 'exit', 'enter'].includes(c.state) || (c.state === 'ridden' && c.timer < 1.2) || (c.state === 'leave' && near(c));
    if (this.list.some(wants)) {
      this.closeIn = 1.6;
      if (!this.liftOpen) { this.liftOpen = true; this.w.setElevatorOpen(ID, true); sfx('ding', 0.6); }
    } else if (this.liftOpen && (this.closeIn -= dt) <= 0) { this.liftOpen = false; this.w.setElevatorOpen(ID, false); }
  }

  tick(c, dt) {
    c.t += dt;
    const info = c.seat ? this.seatInfo(c) : null;
    // the table was taken away from under them
    if (!info && c.seat && !['ride', 'exit', 'leave', 'enter', 'ridden', 'thanks', 'paying', 'gone'].includes(c.state)) { c.seat = null; this.abandon(c, false); }
    switch (c.state) {
      case 'ride': if (this.w.isElevatorOpen(ID) && this.clearToExit(c)) this.beginWalk(c); break;
      case 'exit': case 'walk': case 'leave': case 'enter': this.move(c, dt); break;
      case 'sitdown': {
        c.sitK = Math.min(1, c.sitK + dt / 1.2);
        if (info) { c.x = lerp(info.ax, info.x, sm(c.sitK)); c.z = lerp(info.az, info.z, sm(c.sitK)); c.yaw = info.yaw; }
        if (c.sitK >= 1) { c.state = 'seated'; c.timer = rand(2.5, 4.5); sfx('sit', 0.3); }
        break;
      }
      case 'seated': this.follow(c, info); if ((c.timer -= dt) <= 0) { c.state = 'waiting'; c.wait = 0; this.setBubble(c, '🙋'); } break;
      case 'waiting': case 'ordered': this.follow(c, info); if ((c.wait += dt) > PATIENCE && !c.claim) this.abandon(c); break;
      case 'cooking': case 'cooked': this.follow(c, info); break;
      case 'eating':
        this.follow(c, info);
        if ((c.timer -= dt) <= 0) { c.state = 'standup'; c.next = 'paying'; c.timer = 0; this.setBubble(c, ''); }
        break;
      case 'standup': {
        c.sitK = Math.max(0, c.sitK - dt / 1.2);
        if (info) { c.x = lerp(info.ax, info.x, sm(c.sitK)); c.z = lerp(info.az, info.z, sm(c.sitK)); c.yaw = info.yaw; }
        if (c.sitK <= 0) {
          if (c.seat) { const t = this.obj(c.seat.table); if (t) t.setPlate(c.seat.i, null); }
          if (c.next === 'paying') {
            const p = this.paySpot();
            if (!p) { c.paid = true; this.leaveNow(c); break; }          // no till any more: they leave a happy tip in spirit
            c.path = this.route(c, p.x, p.z); c.state = 'walk'; c.next = 'paying'; this.freeSeat(c);
          } else { this.leaveNow(c); }
        }
        break;
      }
      case 'paying': {                 // at the till: waiting for Guy
        const p = this.paySpot();
        if (p) { c.yaw += clamp(angDiff(p.yaw, c.yaw), -5 * dt, 5 * dt); }
        else { this.leaveNow(c); break; }
        if (!c.claim && (c.wait += dt) > PATIENCE * 2) { c.paid = false; this.abandon(c); }
        break;
      }
      case 'thanks': if ((c.timer -= dt) <= 0) { this.setBubble(c, ''); this.leaveNow(c); } break;
      case 'ridden': {
        c.timer += dt;
        if (c.timer > 1.2 && this.w.doors[ID].elevator.group.userData.open < 0.05) this.remove(c);
        break;
      }
      default: break;
    }
  }

  follow(c, info) { if (info) { c.x = info.x; c.z = info.z; c.yaw = info.yaw; } }

  // the one that came first steps out first; the others wait their turn in the cabin
  clearToExit(c) {
    const out = this.w.elevatorPoint(ID, 0.7);
    return !this.list.some((o) => o !== c && (o.state === 'exit' || (o.state === 'ride' && o.id < c.id) || (['walk', 'leave', 'enter'].includes(o.state) && Math.hypot(o.x - out.x, o.z - out.z) < 1.1)));
  }

  beginWalk(c) {
    const out = this.w.elevatorPoint(ID, 0.7);
    c.state = 'exit';
    c.path = [out]; c.next = 'walk-seat';
  }

  // walk along the path; at its end, go to the next state
  move(c, dt) {
    c.moving = false;
    const wp = c.path[0];
    if (!wp) { this.arrive(c); return; }
    const dx = wp.x - c.x, dz = wp.z - c.z, d = Math.hypot(dx, dz);
    if (d < 0.14 && c.path.length > 1) { c.path.shift(); return; }
    if (d < 0.1) { c.path.shift(); if (!c.path.length) this.arrive(c); return; }
    const want = Math.atan2(dx, dz), diff = angDiff(want, c.yaw);
    c.yaw += clamp(diff, -6 * dt, 6 * dt);
    // wait a moment for Guy to get out of the way
    if (c.blocked < 4) {
      const fx = c.x + Math.sin(c.yaw) * 0.5, fz = c.z + Math.cos(c.yaw) * 0.5, gp = this.guyAt();
      const others = this.list.filter((o) => o !== c && !['ride', 'ridden', 'gone'].includes(o.state) && (!o.moving || o.id < c.id));       // an older customer, or one standing still, has the right of way
      if ((gp && Math.hypot(gp.x - fx, gp.z - fz) < 0.5) || others.some((o) => Math.hypot(o.x - fx, o.z - fz) < 0.5)) { c.blocked += dt; return; }
    }
    if (c.blocked > 0) c.blocked = Math.max(0, c.blocked - dt * 0.5);
    const sp = SPEED * (Math.abs(diff) < 0.8 ? 1 : 0.15) * Math.min(1, d * 2.5 + 0.3);
    c.x += Math.sin(c.yaw) * sp * dt; c.z += Math.cos(c.yaw) * sp * dt;
    c.phase += sp * dt * 5.2;
    c.moving = true;
  }

  arrive(c) {
    const n = c.next;
    if (n === 'walk-seat') {
      const info = this.seatInfo(c);
      if (!info) { this.leaveNow(c); return; }
      c.path = this.route(c, info.ax, info.az); c.state = 'walk'; c.next = 'sit';
    } else if (n === 'sit') {
      const info = this.seatInfo(c);
      if (!info) { this.leaveNow(c); return; }
      c.state = 'sitdown'; c.sitK = 0; c.path = [];
    } else if (n === 'paying') {
      c.state = 'paying'; c.wait = 0; c.path = []; this.setBubble(c, '💵');
    } else if (n === 'enter') {                  // at the doors: step in
      c.state = 'enter'; c.path = [this.w.elevatorPoint(ID, 0, true)]; c.next = 'ridden';
    } else if (n === 'ridden') {
      c.state = 'ridden'; c.timer = 0; c.path = [];
      c.yaw = this.w.elevatorYaw(ID) + Math.PI;
    } else { c.state = 'seated'; c.path = []; }
  }

  // ---------------------------------------------------------------- drawing
  draw(c, dt) {
    if (this.headless) return;
    if (!c.fig) c.fig = new Figure(this, c);
    c.fig.update(c, dt);
  }
}

// ======================================================================================================================= figures
// One customer's body: a fallback figure at first, then the model once it has loaded.
const modelCache = {};
class Figure {
  constructor(r, c) {
    this.r = r;
    this.g = new Guy();
    this.root = this.g.root;
    this.fallback = this.makeFallback(c.shirt);
    this.root.add(this.fallback);
    r.w.room.add(this.root);
    this.bubble = this.makeBubble();
    this.root.add(this.bubble.sprite);
    this.dead = false;
    const url = `${import.meta.env.BASE_URL}models/customers/${c.model.file}`;
    this.g.load(url, { keep: true, height: c.model.height || 1.7 }).then(() => {
      if (this.dead) return;
      this.root.remove(this.fallback);
      this.ok = true;
    }).catch(() => { this.broken = true; });
    void modelCache;
  }

  makeFallback(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.9, 4, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    body.position.y = 0.85; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf1d2b0, roughness: 0.7 }));
    head.position.y = 1.62; head.castShadow = true; g.add(head);
    return g;
  }

  makeBubble() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(0.5, 0.5, 1); sprite.position.y = 2.1; sprite.renderOrder = 10; sprite.visible = false;
    return { canvas, tex, sprite, text: '' };
  }
  setBubble(text) {
    const b = this.bubble;
    if (text === b.text) return;
    b.text = text;
    b.sprite.visible = !!text;
    if (!text) return;
    const x = b.canvas.getContext('2d');
    x.clearRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(255,255,255,0.92)';
    x.beginPath(); x.arc(64, 60, 50, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(50, 100); x.lineTo(64, 124); x.lineTo(78, 100); x.fill();
    x.font = '56px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 64, 64);
    b.tex.needsUpdate = true;
  }

  update(c, dt) {
    this.root.position.set(c.x, 0, c.z);
    this.root.rotation.y = c.yaw;
    this.setBubble(c.bubble);
    const g = this.g;
    if (!this.ok) return;
    const R = this.r, t = c.t;
    g.sharp = 9;
    g.clearTargets();
    basePose(g, t);
    const sitting = c.sitK > 0;
    if (c.moving && !sitting) POSES.walk(g, t, 1e9, { walkPhase: c.phase, armRoom: 1 });
    else if (sitting) this.sit(c, t, R);
    else if (c.state === 'thanks') { POSES.idle(g, t); g.set('RightArm', Q('z', lerp(1.25, -1.0, sm(c.timer * 3)), 'x', 0)); g.set('RightForeArm', Q('y', 0.3 + Math.sin(t * 9) * 0.35)); }
    else POSES.idle(g, t);
    g.apply(dt);
  }

  // sitting at the table: looking at the menu, hand up to order, or eating
  sit(c, t, R) {
    const g = this.g, e = sm(c.sitK);
    sitLegs(g, e);
    g.hipsOffset.y = -0.02 * e;
    const info = R.seatInfo(c);
    const knee = (side) => g.boneWorld(`${side}Leg`).add(V(0, 0.1, 0));
    g.curl('Left', 0.4 * e); g.curl('Right', 0.4 * e);
    g.set('Spine1', Q('x', -0.04 * e));
    if (c.state === 'waiting') {                                  // a hand up: "excuse me"
      g.set('RightArm', Q('z', lerp(1.25, -1.15, sm((c.wait + 0.2) * 1.6)), 'x', 0));
      g.set('RightForeArm', Q('y', 0.2 + Math.sin(t * 5) * 0.25));
      g.reach('Left', knee('Left'), e, false);
      g.set('Head', Q('y', Math.sin(t * 0.6) * 0.4, 'x', 0));
    } else if (c.state === 'eating' && info) {                     // fork from the plate to the mouth
      const plate = info.t.platePoint(c.seat.i).add(V(0, 0.04, 0));
      const mouth = g.boneWorld('Head').add(V(Math.sin(c.yaw) * 0.16, -0.08, Math.cos(c.yaw) * 0.16));
      const k = 0.5 - 0.5 * Math.cos(t * 2.6), hand = plate.clone().lerp(mouth, k);
      g.reachAssist(hand, e);
      g.reach('Right', hand, e, false);
      g.reach('Left', knee('Left'), e, false);
      g.curl('Right', 0.6 * e);
      g.set('Head', Q('x', (0.12 - 0.12 * k) * e));
    } else {
      g.reach('Left', knee('Left'), e, false);
      g.reach('Right', knee('Right'), e, false);
      g.set('Head', Q('y', Math.sin(t * 0.5) * 0.5 * e, 'x', (0.14 + Math.sin(t * 0.8) * 0.03) * e));
    }
  }

  dispose() {
    this.dead = true;
    this.r.w.room.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
    });
  }
}
