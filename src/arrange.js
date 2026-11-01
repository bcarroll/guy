// GUY (and GAL) furnishing the house at the Learning Workstation. He walks up, taps the screen and orders things in or out of any room he
// chooses: the same adding and removing as the Catalog (`world.catalogOps`, machine.js), so books, saving and the Catalog stay right.
//   - he wants to play something he knows (guitar, drums, easel, telescope, piano, stereo) and it is not in the room: he orders it
//     (into a room he picks: see ROOMS);
//   - he wants to sit and play but there is no free chair: he orders one out of storage (a chair he built), then one from the catalog,
//     and when there is none of either he goes to the Workshop and builds one (the usual build, so the factories do the work);
//   - there is no room for what he ordered: he sends something light that nobody is using away first, and orders again.
// Nothing moves by itself: it all happens when he taps the screen (the `arrange` activity in brain.js, whose steps are in arrangeActivities).
import { sfx } from './sfx.js';
import { RECIPES } from './workshop.js';

// what he wants to play, and the skill that makes him want it
const WANTS = [['guitar', 'guitar'], ['drums', 'drums'], ['easel', 'easel'], ['telescope', 'telescope'], ['piano', 'piano'], ['table', 'stereo']];
// where each can go (the first is the home room; an added room is used only while it is there and its door is not locked)
const ROOMS = { guitar: ['main', 'main', 'workshop'], drums: ['main', 'main', 'workshop'], easel: ['main', 'main', 'backyard'], telescope: ['main', 'main', 'backyard'], piano: ['main'], table: ['main', 'main', 'backyard'] };
const CHAIRS = ['builtchair', 'metalchair', 'chair', 'chair2', 'armchair2', 'armchair'];     // in the order he tries them
const CHAIR_RECIPES = ['builtchair', 'metalchair'];
// light things he will send away to make space (never something somebody is using, never a heavy or core piece)
const CLUTTER = ['flowerplant', 'tree', 'coffeetable', 'chair2', 'chair', 'armchair2', 'plant'];

export function installArrange(Brain, H) {
  const { pick } = H;

  Object.assign(Brain.prototype, {
    ops() { return this.w.catalogOps || null; },
    // the rooms he may use: the main room, and added rooms that are open to him
    openRooms() { return ['main', ...Object.keys(this.w.doors).filter((id) => !this.doorLockedFor(id))]; },
    roomPick(id) {
      const ok = this.openRooms();
      const rooms = (ROOMS[id] || ['main']).filter((r) => ok.includes(r));
      return rooms.length ? pick(rooms) : 'main';
    },
    // What he feels like (a plan: { act, key, why, add: [{ id, room }], remove: [id] }, or a recipe to build) right now (null when nothing is missing). Looked at again at the screen: the room may have changed by then.
    arrangeWish() {
      const ops = this.ops(), w = this.w;
      if (!ops || !this.obj('workstation')) return null;
      if (this.time - (this.lastWish || -999) < 45) return null;
      const fails = (this.wishFails ||= {});
      const cool = (k) => this.time - (fails[k] || -999) > 240;
      // 1. something he knows how to play is not in the room
      for (const [id, skill] of WANTS) {
        if (!this.skills.has(skill) || this.obj(id) || !cool(id)) continue;
        if (id === 'guitar' && Object.values(w.objects).some((o) => o.guitar)) continue;          // (an electric one will do)
        const st = ops.status(id);
        if (st === 'removed' || st === 'available') return { act: 'arrange', key: id, why: `wants the ${id === 'table' ? 'stereo' : id}`, add: [{ id, room: this.roomPick(id) }], remove: [] };
      }
      // 2. he would sit and play the guitar but no chair is free
      if (this.skills.has('guitar') && this.guitars().length && !this.openChairs().length && this.inMain() && cool('chair')) {
        const have = CHAIRS.find((id) => { const st = ops.status(id); return st === 'stored' || st === 'removed' || st === 'available'; });
        if (have) return { act: 'arrange', key: 'chair', why: 'wants a chair to sit and play', add: [{ id: have, room: 'main' }], remove: [] };
        const r = CHAIR_RECIPES.find((id) => this.canBuild(id));                                 // none anywhere: build one in the Workshop
        if (r && w.doors.workshop && !this.doorLockedFor('workshop')) return { act: 'build', key: 'chair', recipe: r };
      }
      // 3. too many chairs standing about: the built ones beyond what is needed go back into storage
      const spare = Object.values(w.objects).filter((o) => CHAIR_RECIPES.includes(o.kind) && w.roomIdAt(o.x, o.z) === 'main');
      if (spare.length > 3 && cool('tidy')) return { act: 'arrange', key: 'tidy', why: 'puts a spare chair away', add: [], remove: [spare[spare.length - 1].kind] };
      return null;
    },
    // Used by choose(): returns the activity to do now ('arrange' | 'build') or null. Sets up what that activity does.
    arrangeNext() {
      if (this.isGal || this.lock || this.stuckIn()) return null;
      const wish = this.arrangeWish();
      if (!wish || Math.random() > 0.5) return null;         // (the dice are only rolled when there is something to want: seeded runs stay the same)
      this.lastWish = this.time;
      (this.wishFails ||= {})[wish.key] = this.time;               // (cooling off: if it works the need is gone, if it does not he waits before trying again)
      if (wish.act === 'build') { this.forceRecipe = wish.recipe; return 'build'; }
      this.arrangePlan = wish;
      return 'arrange';
    },
    // An order for the workstation: { add: [{ id, room }], remove: [id] }. Returns { ok, message } (the page and the tests use it).
    arrangeOrder(order) {
      const who = this.isGal ? 'GAL' : 'GUY';
      if (!this.obj('workstation')) return { ok: false, message: 'There is no workstation in the room.' };
      if (!this.ops()) return { ok: false, message: 'The workstation is not connected to the Catalog.' };
      if (this.stuckIn()) return { ok: false, message: this.shutInMessage(this.stuckIn()) };
      this.unlock(false); this.skip(true);
      this.arrangePlan = { act: 'arrange', key: 'order', why: 'follows an order', add: order.add || [], remove: order.remove || [] };
      this.pendingActivity = 'arrange';
      return { ok: true, message: `${who} will use the workstation.` };
    },
    // At the screen: do what the order says. Returns the lines of what happened.
    arrangeDo() {
      const plan = this.arrangePlan, ops = this.ops(), w = this.w, done = [];
      this.arrangePlan = null;
      if (!plan || !ops) return done;
      for (const id of plan.remove) {
        if (ops.status(id) === 'inroom' && ops.remove(id)) { done.push(`removed ${id}`); }
      }
      for (const a of plan.add) {
        const where = w.roomSpot(a.room || 'main'), st = ops.status(a.id);
        if (st !== 'removed' && st !== 'available' && st !== 'stored') continue;
        let ok = ops.add(a.id, where);
        if (!ok) {                                                  // no room: a light thing nobody uses goes first
          const away = CLUTTER.find((c) => this.obj(c) && !this.using.has(c) && !(this.other && this.other.using && this.other.using.has(c)) && w.roomIdAt(this.obj(c).x, this.obj(c).z) === (a.room || 'main'));
          if (away && ops.remove(away)) { done.push(`removed ${away}`); ok = ops.add(a.id, where); }
        }
        if (ok) done.push(`added ${a.id} (${a.room || 'main'})`);
      }
      if (done.length) { sfx('chime'); this.ui(done.join(', ')); }
      return done;
    },
    arrangeActivities() {
      return {
        // the workstation: walk up, tap the screen, and the order goes through
        arrange: () => {
          const m = () => this.obj('workstation');
          if (!m() || !this.arrangePlan) return ['nothing to arrange', this.play('idle', 0.5)];
          const plan = this.arrangePlan;
          return [`at the workstation: ${plan.why}`, this.stand('workstation', 0.9, () => m().screenPoint()),
            this.play('reach', 1.6, { needs: ['workstation'], target: () => m().screenPoint(), at: [0.8, () => { m().setActive(20); sfx('click'); this.arrangeDo(); }] }),
            this.play('idle', 1.4, { needs: ['workstation'] })];
        },
      };
    },
  });
}
