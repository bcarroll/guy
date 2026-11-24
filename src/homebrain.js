// GUY and GAL in the Bedroom and the Library: using the furniture they built for those rooms (homeobjects.js; what is built and when is in
// needs.js / workbrain.js). Installed onto Brain at the bottom of brain.js. The things live in rooms of their own, so each activity looks its
// object up by KIND when it is planned (the user can remove, move and turn them at any moment) and every step that depends on it says so
// (`needs`), so taking it away cancels the step.
//
//   makebed   plump a pillow and smooth the blanket flat (the bed)
//   homesit   sit on the foot of the bed, or in the reading chair, for a rest
//   wardrobe  open the doors (or the bedside drawer), reach in and sort the things, shut it again
//   browse    run a hand along the Library's shelves and look at the books
//   study     at the reading desk: pull the lamp's chain, turn a few pages of the open book, pull it off again
//   spinglobe give the globe a spin with the flat of his hand, watch it go round, and stop it with a finger
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { TOY_ACTS, TOY_KIND_ACTS } from './toybrain.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// activity -> the kinds of object it is done at
export const HOME_ACTS = { makebed: ['bed'], homesit: ['bed', 'readingchair'], wardrobe: ['wardrobe', 'bedside'], browse: ['libshelf'], study: ['libdesk'], spinglobe: ['globe'], playrecord: ['recordplayer'], ...TOY_ACTS };
export const HOME_KINDS = ['bed', 'readingchair', 'wardrobe', 'bedside', 'libshelf', 'libdesk', 'globe', 'recordplayer'];
// the activities the menu offers on an object (by kind)
export const HOME_KIND_ACTS = { bed: ['makebed', 'homesit'], readingchair: ['homesit'], wardrobe: ['wardrobe'], bedside: ['wardrobe'], libshelf: ['browse'], libdesk: ['study'], globe: ['spinglobe'], recordplayer: ['playrecord'], ...TOY_KIND_ACTS };
// what an object is for these tables: its kind, or its name for the furniture that has none (the coffee table and the nightstand: toybrain.js)
export const homeKey = (o) => (o ? o.kind || o.name : null);
// the activities the menu offers on an object (or none)
export const homeActsOf = (o) => (o && HOME_KIND_ACTS[homeKey(o)]) || null;

export function installHome(Brain, POSES, H) {
  const { rand, pick } = H;

  Object.assign(Brain.prototype, {
    // the room's door is not locked on him, and he is not shut in some other room
    homeRoomOpen(o) {
      const r = this.w.roomIdAt(o.x, o.z);
      if (r === 'main') return !this.stuckIn();
      if (r === 'door' || !this.w.doors[r]) return false;
      return !this.doorLockedFor(r);
    },
    // the objects an activity can be done at right now (the other robot is not using them)
    homeObjs(act) {
      const kinds = HOME_ACTS[act] || [];
      return Object.values(this.w.objects).filter((o) => kinds.includes(homeKey(o)) && this.homeRoomOpen(o) && !this.otherUses(o.name) && !o.hauled && !o.packed)
        .sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    // the one it is done at: the one he was pointed at, else the first that is not the one he used last (so he uses each in turn)
    homeObj(act) {
      const all = this.homeObjs(act);
      if (!all.length) return null;
      const wanted = this.homeWanted && all.find((o) => o.name === this.homeWanted);
      if (wanted) return wanted;
      if (TOY_ACTS[act]) return this.toyNext(act, all);                // (the toys and the furniture: each in turn, round and round)
      return all.find((o) => o.name !== (this.lastHome || {})[act]) || all[0];
    },
    // The record he put on is lifted off and the music stops (called when the activity ends, and from choose() when it was cut short).
    recordCleanup() {
      const n = this.recordOn; this.recordOn = null;
      if (!n) return;
      const p = this.obj(n);
      const sp = p && (p.setPlaying || p.group.userData.setPlaying);         // (the record player's, or the jukebox's: toybrain.js)
      if (sp) sp(false);
      if (this.music && !this.userMusic) this.musicOff();
    },
    // is there something to do that is not just standing about (called from available())
    homeAvailable(act) { return ((act !== 'playrecord' && act !== 'jukebox') || !this.music) && !!this.homeObj(act); },          // (a record goes on only when nothing else is playing)

    homeActivities() {
      const stand = (o, front, target, sides) => this.stand(o.name, front, target, sides);
      return {
        ...this.toyActivities(),                                   // the toys, the arcade, the jukebox and the little furniture (toybrain.js)
        // the bed: plump a pillow, then pull the blanket straight from one side to the other
        makebed: () => {
          const o = this.homeObj('makebed');
          if (!o) return ['nothing to make', this.play('idle', 0.5)];
          const n = o.name, bed = () => this.obj(n), t0 = { v: 0, k: 0 };
          return ['making the bed',
            stand(o, 1.25, () => bed().blanketPoint(0.5, 1), [1, 3]),                 // (at the side of the bed)
            this.play('reach', 1.5, { needs: [n], at: [0.7, () => { sfx('thud', 0.25); bed().setMade(false); }], target: () => bed().blanketPoint(0.95, 1) }),
            this.play('reach', 4.2, { needs: [n], at: [3.6, () => { bed().setMade(true); }], target: () => { if (!t0.v) t0.v = this.time; if (Math.floor((this.time - t0.v) * 5) !== t0.k) { t0.k = Math.floor((this.time - t0.v) * 5); sfx('wipe', 0.4); } return bed().blanketPoint(0.5 + Math.sin((this.time - t0.v) * 2.2) * 0.45, 1); } }),
            this.play('idle', 0.5, { needs: [n] })];
        },
        // sit on the foot of the bed, or in the reading chair, for a rest
        homesit: () => {
          const o = this.homeObj('homesit');
          if (!o || !o.sit) return ['nowhere to sit', this.play('idle', 0.5)];
          (this.lastHome ||= {}).homesit = o.name;
          return [`sitting down on the ${o.kind === 'bed' ? 'bed' : 'reading chair'}`,
            this.walkAt(o.name, 0, o.sit.gap, Math.PI),
            this.play('sitRest', rand(10, 16), { chairSit: true, chair: o.name, needs: [o.name] })];
        },
        // the wardrobe (doors) or the bedside table (drawer): open it, reach in, sort the things, shut it
        wardrobe: () => {
          const o = this.homeObj('wardrobe');
          if (!o) return ['nothing to open', this.play('idle', 0.5)];
          const n = o.name, it = () => this.obj(n);
          (this.lastHome ||= {}).wardrobe = n;
          return [`sorting the ${o.kind === 'wardrobe' ? 'wardrobe' : 'bedside drawer'}`,
            stand(o, o.kind === 'wardrobe' ? 0.85 : 0.75, () => it().handlePoint(), [0]),                // (in front: that is where the doors and the drawer open)
            this.play('reach', 1.4, { needs: [n], at: [0.6, () => { it().setOpen(true); sfx('lid'); }], target: () => it().handlePoint() }),
            this.play('reach', 3.2, { needs: [n], at: [0.6, () => sfx('click')], target: () => it().insidePoint() }),
            this.play('reach', 1.2, { needs: [n], at: [0.5, () => sfx('click')], target: () => { const p = it().insidePoint(); return p.add(V(0, 0.12, 0)); } }),
            this.play('reach', 1.4, { needs: [n], at: [0.6, () => { it().setOpen(false); sfx('lid'); }], target: () => it().handlePoint() })];
        },
        // along the Library's shelves: a look at the books on three rows, one hand following the spines
        browse: () => {
          const o = this.homeObj('browse');
          if (!o) return ['nothing to look at', this.play('idle', 0.5)];
          const n = o.name, sh = () => this.obj(n);
          return ['browsing the shelves',
            stand(o, 0.6, () => sh().rowPoint(1, 0), [0]),
            ...[[1, -0.4], [2, 0.3], [0, 0.45], [1, 0.0]].map(([row, u]) => this.play('reach', 3.0, { needs: [n], at: [0.9, () => sfx('click', 0.3)], target: () => sh().rowPoint(row, u + Math.sin(this.time * 1.5) * 0.12) })),
            this.play('idle', 0.6, { needs: [n] })];
        },
        // the reading desk: the lamp on, a few pages read and turned, the lamp off again
        study: () => {
          const o = this.homeObj('study');
          if (!o) return ['nothing to read at', this.play('idle', 0.5)];
          const n = o.name, d = () => this.obj(n);
          const page = () => {                                                      // (the fingers lift the right-hand page and carry it over to the left)
            const t0 = { v: 0 };
            return this.play('reach', 2.2, { needs: [n], at: [1.2, () => { d().turnPage(); sfx('page'); }], target: () => { if (!t0.v) t0.v = this.time; const k = Math.min(1, Math.max(0, (this.time - t0.v - 0.9) / 0.8)); return d().pagePoint(0.9 - 0.7 * k); } });
          };
          return ['reading at the desk',
            stand(o, 0.55, () => d().pagePoint(0.5), [0]),
            this.play('reach', 1.3, { needs: [n], at: [0.7, () => { d().setLamp(true); sfx('click'); }], target: () => d().chainPoint() }),
            this.play('idle', rand(2.5, 4), { needs: [n] }),
            page(),
            this.play('idle', rand(2.5, 4), { needs: [n] }),
            page(),
            this.play('reach', 1.3, { needs: [n], at: [0.7, () => { d().setLamp(false); sfx('click'); }], target: () => d().chainPoint() })];
        },
        // the globe: a flat hand across its front sets it spinning, he watches it, and a finger on it stops it at a place
        spinglobe: () => {
          const o = this.homeObj('spinglobe');
          if (!o) return ['no globe to spin', this.play('idle', 0.5)];
          const n = o.name, gl = () => this.obj(n), t0 = { v: 0 };
          return ['spinning the globe',
            stand(o, 0.6, () => gl().sidePoint(0), [0, 1, 3]),
            this.play('reach', 1.2, { needs: [n], at: [0.75, () => { gl().spin(7); sfx('whoosh'); }], target: () => { if (!t0.v) t0.v = this.time; const k = Math.min(1, Math.max(0, (this.time - t0.v - 0.45) / 0.4)); return gl().sidePoint(-1 + 2 * k); } }),
            this.play('ponder', rand(3, 4.5), { needs: [n] }),
            this.play('reach', 1.4, { needs: [n], at: [0.6, () => { gl().spin(0); sfx('click', 0.4); }], target: () => gl().sidePoint(0.3) }),
            this.play('idle', 0.6, { needs: [n] })];
        },
        // the record player: a record on, the arm lowered by hand onto it, a listen, and the arm lifted off again
        playrecord: () => {
          const o = this.homeObj('playrecord');
          if (!o) return ['no record player to use', this.play('idle', 0.5)];
          const n = o.name, rp = () => this.obj(n), songs = this.trackList().filter((t) => t.id !== 'default'), song = songs.length ? pick(songs) : { id: 'default', title: 'a record' };
          (this.lastHome ||= {}).playrecord = n;
          const off = () => this.recordCleanup();
          return [`putting ${song.id === 'default' ? 'a record' : `"${song.title}"`} on the record player`,
            stand(o, 0.5, () => rp().armRestPoint(), [0, 1, 3]),
            this.play('reach', 1.5, { needs: [n], at: [0.5, () => sfx('bookgrab')], target: () => rp().armRestPoint() }),
            this.play('reach', 1.4, { needs: [n], at: [0.8, () => { if (!this.music) this.musicOn(song.id); this.recordOn = n; rp().setPlaying(true); sfx('click'); }], target: () => rp().armOnPoint() }),
            this.play('idle', rand(14, 22), { needs: [n], onEnd: off }),
            this.play('reach', 1.4, { needs: [n], at: [0.7, off], target: () => rp().armPoint() }),
            this.play('idle', 0.6, { needs: [n] })];
        },
      };
    },
  });
  void pick;
}
