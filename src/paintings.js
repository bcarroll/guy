// GUY's paintings. A painting he has made stays on the easel until the user says "Hang painting" (long-press the easel); then GUY takes
// it down, carries it to a wall of his choosing in any room he can reach, and hangs it (src/paintbrain.js has his side of it).
//
// - At most 3 of his paintings on any one wall. He spreads them out: the wall with the fewest paintings first, his own room before
//   the others, and the gap between neighbours as wide as it can be.
// - If every wall is full he takes down his oldest painting and hangs the new one in its place. The old one is not thrown away:
//   it goes into the Catalog (Objects > GUY's paintings) as a thumbnail, and the user can hang it again from there.
// - Everything is saved (`guy.paintings.v1`): the pictures (small JPEGs), where each one hangs, and what is on the easel.
//
// A hung painting is an ordinary wall piece (world.decor), so the user can drag it along its wall or put it away like any picture;
// `sync()` notices a painting that has been put away (or whose room has gone) and files it in the Catalog.
const KEY = 'guy.paintings.v1';
export const PER_WALL = 3;       // paintings of his on one wall
export const MAX_ALL = 60;       // hung and stored together: a limit on what is kept in the browser
const STAND = 0.7;               // how far from the wall he stands to hang one
const W = 256, H = 320;          // the picture's size in pixels (the same as the easel's canvas)

export class Paintings {
  constructor(world, { persist = true } = {}) {
    this.w = world;
    this.persist = persist;
    this.items = [];             // { id, img (a data URL), room ('main' | a room id | null = in the Catalog), wall, u, v, t }
    this.seq = 0;
    this.decor = {};             // id -> the wall piece of a hung painting
    this.carried = null;         // the canvas GUY carries between the easel and the wall
    this.easelImg = null;        // the saved picture on the easel
    this.easelVer = -1;
    this.easelDirty = false;
    this.dirty = false;
    this.listeners = [];
    this.t = 0; this.tSave = 0;
  }

  onChange(f) { this.listeners.push(f); }
  changed() { this.dirty = true; this.listeners.forEach((f) => f()); }
  name(rec) { return `guypaint_${rec.id}`; }
  get(id) { return this.items.find((r) => r.id === id) || null; }
  hung() { return this.items.filter((r) => r.room); }
  stored() { return this.items.filter((r) => !r.room); }
  hungOn(key) { return this.items.filter((r) => r.room && r.wall === key).length; }
  easel() { return this.w.objects.easel || null; }
  easelHas() { const e = this.easel(); return !!(e && e.painted); }
  roomName(id) { return id === 'main' ? 'your room' : (this.w.doors[id] ? `the ${this.w.doors[id].name}` : 'a room'); }

  // ------------------------------------------------------------------ canvases
  blank() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#f6f3ea'; x.fillRect(0, 0, W, H);
    return c;
  }
  // a canvas holding a saved picture (it fills in as soon as the image has loaded)
  canvasOf(rec) {
    const c = this.blank();
    if (rec.img) {
      const im = new Image();
      im.onload = () => { c.getContext('2d').drawImage(im, 0, 0, W, H); const d = this.decor[rec.id]; if (d && d.tex) d.tex.needsUpdate = true; };
      im.src = rec.img;
    }
    return c;
  }
  jpeg(canvas) { try { return canvas.toDataURL('image/jpeg', 0.82); } catch { return null; } }

  // ------------------------------------------------------------------ the easel
  // GUY lifts the painting off the easel: the easel is blank again and he carries a copy. `prop` (his hand's canvas) shows it.
  takeFromEasel(prop) {
    const e = this.easel();
    if (!e || !e.painted) return false;
    const c = this.blank();
    c.getContext('2d').drawImage(e.paint.canvas, 0, 0, W, H);
    this.carried = c;
    e.paint.clear(); e.painted = false;
    this.easelImg = null; this.easelDirty = false; this.easelVer = e.paint.ver;
    this.dirty = true;
    if (prop) prop.userData.show(c);
    return true;
  }
  // He was cut short (or the wall is gone): the painting goes back on the easel; with no easel it goes into the Catalog. Never lost.
  putBack() {
    const c = this.carried;
    if (!c) return;
    this.carried = null;
    const e = this.easel();
    if (e && !e.painted) { e.paint.draw(c); e.painted = true; this.easelDirty = true; }
    else this.add({ img: this.jpeg(c), room: null });
    this.changed();
  }

  // ------------------------------------------------------------------ where to hang one
  // Where he would stand to hang one at u on a wall (a point 70 cm out from it, free floor in the right room), or null.
  standFor(F, u, room) {
    const w = this.w, p = F.at(u, 0), x = p.x + F.n.x * STAND, z = p.z + F.n.z * STAND;
    if (!w.walkable(x, z) || w.roomIdAt(x, z) !== room) return null;
    if (w.obstacles.some((o) => o.active !== false && x > o.x0 - 0.3 && x < o.x1 + 0.3 && z > o.z0 - 0.3 && z < o.z1 + 0.3)) return null;
    return { x, z, yaw: Math.atan2(-F.n.x, -F.n.z) };
  }
  // The best bare place on one wall: the widest gap to its neighbours, near the middle of the wall.
  bestSpot(wl) {
    const w = this.w, P = w.PAINTING, F = wl.frame, mid = (F.lo + F.hi) / 2;
    const others = Object.values(w.decor).filter((o) => o.wall === wl.key);
    if (wl.key === 'left') others.push({ u: (w.MACHINE_RECT.u0 + w.MACHINE_RECT.u1) / 2, hw: (w.MACHINE_RECT.u1 - w.MACHINE_RECT.u0) / 2 });     // keep clear of the Catalog too
    const probe = { wall: wl.key, hw: P.hw, hh: P.hh };
    for (const v of [1.6, 1.45, 1.75, 1.3, 1.9]) {
      let best = null;
      for (let u = F.lo + P.hw + 0.1; u <= F.hi - P.hw - 0.1 + 1e-6; u += 0.1) {
        if (!w.decorFits(probe, u, v)) continue;
        const stand = this.standFor(F, u, wl.room);
        if (!stand) continue;
        let gap = 1.2;
        for (const o of others) gap = Math.min(gap, Math.abs(u - o.u) - o.hw - P.hw);
        const score = gap - Math.abs(u - mid) * 0.01;
        if (!best || score > best.score) best = { u: +u.toFixed(2), v, stand, score };
      }
      if (best) return best;
    }
    return null;
  }
  // GUY decides: { room, wall, u, v, stand, replace } or null. `replace` is the id of the painting to take down when every wall is full.
  plan({ noReplace = false } = {}) {
    const w = this.w;
    const cands = [];
    const shut = (room) => !!(w.doors[room] && w.doors[room].locked);                 // a locked room: the robots cannot go in to hang anything
    for (const { key, room } of w.hangWalls()) {
      if (shut(room)) continue;
      const frame = w.wallFrame(key);
      if (!frame || this.hungOn(key) >= PER_WALL) continue;
      const spot = this.bestSpot({ key, room, frame });
      if (spot) cands.push({ key, room, n: this.hungOn(key), ...spot });
    }
    if (cands.length) {
      cands.sort((a, b) => a.n - b.n || (a.room === 'main' ? 0 : 1) - (b.room === 'main' ? 0 : 1) || b.score - a.score);
      const c = cands[0];
      return { room: c.room, wall: c.key, u: c.u, v: c.v, stand: c.stand, replace: null };
    }
    if (noReplace) return null;
    for (const r of this.hung().sort((a, b) => a.t - b.t)) {            // every wall is full (or bare only where he cannot reach): the oldest goes
      const F = w.wallFrame(r.wall), stand = !shut(r.room) && F && this.standFor(F, r.u, r.room);
      if (stand) return { room: r.room, wall: r.wall, u: r.u, v: r.v, stand, replace: r.id };
    }
    return null;
  }
  // Why he cannot hang the painting on the easel right now (a kind message), or null.
  refusal() {
    if (!this.easel()) return 'There is no easel to take a painting from.';
    if (!this.easelHas()) return 'There is no painting on the easel yet. GUY paints when he has the book for it.';
    if (this.items.length >= MAX_ALL) return 'GUY already has plenty of paintings. Take a few out of the Catalog first.';
    if (!this.plan()) return 'There is no bare bit of wall for GUY to hang it on right now.';
    return null;
  }

  // ------------------------------------------------------------------ hanging, taking down
  add(fields) {
    const rec = { id: ++this.seq, img: null, room: null, wall: null, u: 0, v: 0, t: this.seq, ...fields };
    this.items.push(rec);
    return rec;
  }
  build(rec, canvas) {
    const d = this.w.addPainting(this.name(rec), 'painting', canvas || this.canvasOf(rec), rec.wall, rec.u, rec.v);
    this.decor[rec.id] = d;
    return d;
  }
  // Hang what GUY is carrying at the planned spot (replacing the oldest painting when told to). Returns the new record.
  hang(plan) {
    const c = this.carried;
    if (!c || !plan) return null;
    if (plan.replace) this.takeDown(plan.replace);
    const rec = this.add({ img: this.jpeg(c), room: plan.room, wall: plan.wall, u: plan.u, v: plan.v });
    this.build(rec, c);
    this.carried = null;
    this.changed();
    return rec;
  }
  // Is the plan still good (the wall has room, or the painting it would replace is still up)?
  valid(plan) {
    const F = plan && this.w.wallFrame(plan.wall);
    if (!F) return false;
    if (plan.replace) { const r = this.get(plan.replace); return !!(r && r.room); }
    return this.hungOn(plan.wall) < PER_WALL && this.w.decorFits({ wall: plan.wall, hw: this.w.PAINTING.hw, hh: this.w.PAINTING.hh }, plan.u, plan.v);
  }
  // What he carries goes into the Catalog, to be hung from there. Returns the record.
  stash() {
    const c = this.carried;
    if (!c) return null;
    this.carried = null;
    const rec = this.add({ img: this.jpeg(c), room: null });
    this.changed();
    return rec;
  }
  // Take one down into the Catalog.
  takeDown(id) {
    const rec = this.get(id);
    if (!rec || !rec.room) return false;
    const name = this.name(rec);
    if (this.w.decor[name]) this.w.removeObject(name);
    delete this.w.removed[name];
    delete this.decor[rec.id];
    rec.room = null; rec.wall = null;
    this.changed();
    return true;
  }
  // From the Catalog: hang a stored painting straight away on a free wall (it never replaces another one). Returns a message.
  hangStored(id) {
    const rec = this.get(id);
    if (!rec || rec.room) return 'That painting is already on a wall.';
    const plan = this.plan({ noReplace: true });
    if (!plan) return 'Every wall is full or blocked. Take a painting down first.';
    Object.assign(rec, { room: plan.room, wall: plan.wall, u: plan.u, v: plan.v });
    this.build(rec);
    this.changed();
    return `Hung in ${this.roomName(plan.room)}.`;
  }

  // The user moved or put away a painting, or its room went: keep the records right. Returns true if anything changed.
  sync() {
    let any = false;
    for (const rec of this.hung()) {
      const name = this.name(rec), d = this.w.decor[name];
      if (d && d.wall === rec.wall) {
        if (Math.abs(d.u - rec.u) > 0.005 || Math.abs(d.v - rec.v) > 0.005) { rec.u = +d.u.toFixed(3); rec.v = +d.v.toFixed(3); this.dirty = true; }
        continue;
      }
      if (d) this.w.removeObject(name);
      delete this.w.removed[name];                               // put away by the user, or its room was taken away: it is in the Catalog now
      delete this.decor[rec.id];
      rec.room = null; rec.wall = null;
      any = true;
    }
    if (any) this.changed();
    return any;
  }

  // ------------------------------------------------------------------ keeping them
  snapshot() { return { v: 1, seq: this.seq, easel: this.easelImg, items: this.items.map((r) => ({ id: r.id, img: r.img, room: r.room, wall: r.wall, u: r.u, v: r.v, t: r.t })) }; }
  save() {
    this.dirty = false;
    if (!this.persist) return false;
    try { localStorage.setItem(KEY, JSON.stringify(this.snapshot())); return true; } catch { return false; }
  }
  // Put the saved paintings back (after the rooms are, so the walls exist). A painting whose wall is gone or no longer fits goes to the Catalog.
  restore() {
    if (!this.persist) return;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    this.load(data);
  }
  load(data) {
    if (!data || data.v !== 1 || !Array.isArray(data.items)) return;
    for (const r of this.items) if (r.room) this.takeDown(r.id);
    this.items = []; this.decor = {};
    this.seq = Number.isFinite(data.seq) ? data.seq : 0;
    this.easelImg = typeof data.easel === 'string' ? data.easel : null;
    for (const r of data.items.slice(0, MAX_ALL)) {
      if (!r || !Number.isFinite(r.id) || typeof r.img !== 'string') continue;
      this.seq = Math.max(this.seq, r.id);
      const rec = { id: r.id, img: r.img, room: null, wall: null, u: 0, v: 0, t: Number.isFinite(r.t) ? r.t : r.id };
      this.items.push(rec);
      if (!r.room || !this.w.wallFrame(r.wall) || this.w.wallFrame(r.wall) === null) continue;
      if (typeof r.wall !== 'string' || !Number.isFinite(r.u) || !Number.isFinite(r.v)) continue;
      Object.assign(rec, { room: r.room, wall: r.wall, u: r.u, v: r.v });
      const d = this.build(rec);
      if (!this.w.decorFits(d, d.u, d.v)) {
        const spot = this.w.findWallSpot(d);
        if (spot) { d.set(spot.u, spot.v); rec.u = spot.u; rec.v = spot.v; } else this.takeDown(rec.id);
      }
    }
    this.easelVer = -1;
    this.changed();
  }

  // Test aid: every painting comes down and the list is emptied (nothing is saved or kept).
  reset() {
    for (const r of this.hung()) this.takeDown(r.id);
    this.items = []; this.decor = {}; this.carried = null; this.easelImg = null; this.easelDirty = false;
    this.dirty = true;
    this.listeners.forEach((f) => f());
  }

  // Every frame: notice changes, save now and then, and put the saved picture on a new easel.
  update(dt) {
    this.t += dt; this.tSave += dt;
    const e = this.easel();
    if (e && !e.paintRestored) {                                  // a fresh easel (a new visit, or put back): the picture saved on it returns
      e.paintRestored = true;
      if (this.easelImg && !e.painted) {
        const im = new Image();
        im.onload = () => { if (!e.painted) { e.paint.draw(im); e.painted = true; } };
        im.src = this.easelImg;
      }
    }
    if (e && e.paint.ver !== this.easelVer) { this.easelVer = e.paint.ver; this.easelDirty = true; }
    if (this.t > 0.5) { this.t = 0; this.sync(); }
    if (this.tSave > 3) {
      this.tSave = 0;
      if (e && this.easelDirty && e.paintRestored) { this.easelDirty = false; this.easelImg = e.painted ? this.jpeg(e.paint.canvas) : null; this.dirty = true; }
      if (this.dirty) this.save();
    }
  }
}
