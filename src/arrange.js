// GUY (and GAL) furnishing the house at the Learning Workstation. He walks up, taps the screen and orders things in or out of any room he
// chooses: the same adding and removing as the Catalog (`world.catalogOps`, machine.js), so books, saving and the Catalog stay right.
//   - he wants to play something he knows (guitar, drums, easel, telescope, piano, stereo) and it is not in the room: he orders it
//     (into a room he picks: see ROOMS);
//   - he wants to sit and play but there is no free chair: he orders one out of storage (a chair he built), then one from the catalog,
//     and when there is none of either he goes to the Workshop and builds one (the usual build, so the factories do the work);
//   - there is no room for what he ordered: he sends something light that nobody is using away first, and orders again;
//   - something stands in a room it does not belong in (an instrument in the Workshop, a bed built for the Bedroom left in the Workshop):
//     he sends it to its own room (its place in ROOMS, or where the Workshop builds it for), if there is space for it there.
// Nothing moves by itself: it all happens when he taps the screen (the `arrange` activity in brain.js, whose steps are in arrangeActivities).
import { sfx } from './sfx.js';
import { RECIPES } from './workshop.js';

// what he wants to play, and the skill that makes him want it
const WANTS = [['guitar', 'guitar'], ['drums', 'drums'], ['easel', 'easel'], ['telescope', 'telescope'], ['piano', 'piano'], ['table', 'stereo']];
// where each can go (the first is the home room; an added room is used only while it is there and its door is not locked). The Workshop is
// for making things, never for keeping them: an instrument ordered there used to stay there for good.
const ROOMS = { guitar: ['main'], drums: ['main'], eguitar: ['main'], easel: ['main', 'main', 'backyard'], telescope: ['main', 'main', 'backyard'], piano: ['main'], table: ['main', 'main', 'backyard'] };
// Where things belong once the room that is for them has been added (and is open to him): the Studio takes the instruments, the Backyard the
// garden and the sky-watching, the Restaurant its kitchen. They are carried there from his own room or the Workshop, wherever they stand.
const HOME = {
  studio: ['drums', 'guitar', 'eguitar', 'piano', 'bench', 'bass', 'keyboard', 'xylophone', 'bongos', 'mirrorball', 'jukebox'],
  backyard: ['soccergoal', 'basketballhoop', 'lawnchair', 'birdbath', 'shed', 'mower', 'gnome', 'flamingo', 'easel', 'telescope'],
};
const HOME_OF = Object.fromEntries(Object.entries(HOME).flatMap(([room, ids]) => ids.map((id) => [id, room])));
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
      if (HOME_OF[id] && ok.includes(HOME_OF[id])) return HOME_OF[id];       // (its own room, once there is one)
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
      // 0. something is in the wrong room: it goes to its own
      const moved = this.misplaced().find((m) => cool(`move:${m.o.name}`));
      if (moved) return { act: 'arrange', key: `move:${moved.o.name}`, why: `sends the ${moved.label} to ${moved.roomName}`, add: [{ id: moved.id, room: moved.room, own: moved.own }], remove: [moved.id], name: moved.o.name };
      // 1. something he knows how to play is not in the room
      for (const [id, skill] of WANTS) {
        if (!this.skills.has(skill) || this.obj(id) || !cool(id)) continue;
        if (id === 'guitar' && Object.values(w.objects).some((o) => o.guitar && !o.bass)) continue;          // (an electric one will do)
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
    // Things left in the Workshop that belong in another room, with the room each goes to (open to him, with space for it): [{ o, id, label, room, roomName }].
    misplaced() {
      const w = this.w, ok = this.openRooms(), out = [];
      for (const o of Object.values(w.objects)) {
        if (o.hauled || o.stowed || o.removable === false || this.inUse(o.name) || this.otherUses(o.name) || this.skillWants(o.name)) continue;
        const id = o.kind || o.name, here = w.roomIdAt(o.x, o.z);
        if (here !== 'workshop') continue;                       // (only out of the Workshop: in his own room the robots carry things to their rooms: gearMoves)
        let homes = ROOMS[id], own = false;
        if (HOME_OF[id] && ok.includes(HOME_OF[id])) homes = [HOME_OF[id]];
        if (!homes && o.kind && RECIPES[o.kind]) { const s = w.instanceSite(o.kind); if (s && s.room !== 'door' && s.room !== 'workshop') { homes = [s.room]; own = true; } }   // where the Workshop builds it for (its planned spot there)
        if (!homes || homes.includes(here)) continue;
        const room = homes.find((r) => ok.includes(r));
        const where = room && (own ? w.instanceSite(o.kind) : w.roomSpot(room));
        if (!where || !w.findSpot(o, where, null)) continue;
        const def = this.ops().byId ? this.ops().byId(id) : null;
        out.push({ o, id, label: (def && def.name.replace(/ \(built by GUY\)$/, '')) || id, room, own, roomName: room === 'main' ? 'his own room' : `the ${room}` });
      }
      return out;
    },
    // ---- carrying things to the room that is for them ----
    // What stands in his own room (or in the Workshop) and belongs in a room that has been added and is open (HOME): the Studio's instruments, the
    // Backyard's telescope and garden things. Light things go whole, in both hands; anything bigger (the drum kit, the piano) is folded up and goes
    // flat (skillrun.js bringSteps). The stereo stays in his own room (the Studio has its record decks). [{ o, room, label }].
    gearMoves() {
      const w = this.w, ok = this.openRooms(), out = [];
      for (const o of Object.values(w.objects)) {
        const room = HOME_OF[o.kind || o.name], here = w.roomIdAt(o.x, o.z);
        if (!room || !ok.includes(room) || (here !== 'main' && here !== 'workshop')) continue;
        if (o.packed || o.hauled || o.stowed || o.hung || o.mainOnly || o.removable === false || this.inUse(o.name) || this.otherUses(o.name) || this.skillWants(o.name) || this.handsFull(o)) continue;
        if (this.other && this.other.bringJob && this.other.bringJob.name === o.name) continue;
        if (!(room === 'main' || !this.doorLockedFor(room)) || !this.bringSpot(o, room, null)) continue;
        const def = this.ops() && this.ops().byId ? this.ops().byId(o.kind || o.name) : null;
        out.push({ o, room, label: ((def && def.name) || o.name).replace(/ \(built by GUY\)$/, '').toLowerCase() });
      }
      return out.sort((a, b) => (a.o.name < b.o.name ? -1 : 1));
    },
    // Called from choose(): 'carrygear' when something is waiting to go to its room (a chore, not chosen by weight).
    gearMoveNext() {
      if (this.lock || this.stuckIn() || this.held || this.carry || this.hauling) return null;
      if (typeof window !== 'undefined' && window.guyTest && window.guyTest.noGear) return null;      // (the QA harness keeps it off, so the sweeps' furniture stays where they put it: only the sweeps of this chore turn it on)
      if (this.time - (this.gearTried || -999) < 30) return null;               // (it did not work a moment ago: not straight away again)
      return this.gearMoves().length ? 'carrygear' : null;
    },
    gearSteps() {
      const m = this.gearMoves()[0];
      this.gearTried = this.time;
      if (!m) return ['nothing to carry', this.play('idle', 0.5)];
      this.bringJob = { name: m.o.name, room: m.room, thing: m.label, for: this };
      return this.bringSteps();
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
      const back = {};                                              // (a move: where it stood, in case it does not fit where it is going after all)
      for (const id of plan.remove) {
        const o = plan.name ? this.obj(plan.name) : null;
        if (o) back[id] = { x: o.x, z: o.z };
        if (ops.status(id) === 'inroom' && ops.remove(id, plan.name)) { done.push(`removed ${id}`); }
      }
      for (const a of plan.add) {
        const where = a.own ? null : w.roomSpot(a.room || 'main'), st = ops.status(a.id);      // (`own`: a built thing goes to the spot planned for it)
        if (st !== 'removed' && st !== 'available' && st !== 'stored') continue;
        let ok = ops.add(a.id, where);
        if (!ok) {                                                  // no room: a light thing nobody uses goes first
          const away = CLUTTER.find((c) => this.obj(c) && !this.using.has(c) && !(this.other && this.other.using && this.other.using.has(c)) && w.roomIdAt(this.obj(c).x, this.obj(c).z) === (a.room || 'main'));
          if (away && ops.remove(away)) { done.push(`removed ${away}`); ok = ops.add(a.id, where); }
        }
        if (!ok && back[a.id]) { ops.add(a.id, back[a.id]); continue; }       // it goes back where it was
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
