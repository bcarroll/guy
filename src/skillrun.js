// Choosing a skill in the Skills menu: GUY uses that skill, at once, in the room he is in (Brain.useSkill, called by main.js).
// Installed onto Brain at the bottom of brain.js.
//
//   - nothing is needed (he dances) or the thing it is done with stands in his room: he does it there;
//   - the thing stands in another room and can be carried (guitar, drums, easel, telescope, lamp): it is brought to him. He calls GAL and
//     waits; with no GAL (or GAL busy) he fetches it himself. Light things are carried whole, the drum kit flat-packed, through the doors;
//   - he needs the music on and the stereo is in another room: GAL goes and switches it on (without her he does, and comes back). It is
//     switched off again when he has finished;
//   - it is not in the house: GAL orders it into his room at the workstation (without her he does);
//   - it is fixed (the piano, the bookshelf, the goal, the stove ...): he goes to it, and if he cannot do it and GAL can, he asks her to.
//
// `this.skillRun` is the order he is on: { id, room, piece, acts, act, started, by, t0 }. Anything else the user asks for, or skip(),
// cancels it. A run that is waiting is picked up again by choose() ('skillwait') after he has put a book down, say.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { SKILL_INFO } from './skills.js';
import { busyJob } from './commands.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DANCES = ['dance', 'dancemoves', 'ballroom'];
// activities that are done to the stereo's music: while one of these runs, the music put on for it stays on
export const MUSIC_ACTS = [...DANCES, 'jamdrums', 'jamguitar', 'jam', 'jampiano', 'jamsit', 'bandplay', 'studiodj', 'studioshow', 'studioparty'];
// what he may do while a run is still waiting without it being over
const ON_THE_WAY = ['skillwait', 'bringpiece', 'musicon', 'arrange', 'putback', 'putguitar', 'dropball', 'putcanvas', 'lighton', 'leave'];
const WAIT_MAX = 150;                                   // how long he waits for GAL before he does it himself
const START_WAIT = 20;                                  // how long she may take to put away what she has in her hands and set off
const DOOR_CLEAR = 1.7;                                 // he waits at least this far from a doorway: whoever brings it has to get through

// What each skill in the menu does. `acts(b)`: the activities, best first (the first that he can do is done). `piece`: what it is done with.
// `music`: the stereo has to be playing. `here`: it needs nothing but the floor. `use`: a fixed thing he is sent to (the same as choosing it
// from its own menu), first one that exists; `room`: the room all that is in. `does`: what the toast says he is doing;
// `icon` and `ask`: its button in the menu.
const SKILL_USE = {
  stereo: { icon: '📻', ask: 'Put music on and dance', stereo: true, does: 'dancing', acts: () => ['dance'] },
  piano: { icon: '🎹', ask: 'Play the piano', use: ['piano'], does: 'playing the piano' },
  'piano.advanced': { icon: '🎼', ask: 'Play a classic on the piano', use: ['piano'], song: 'piano.advanced', does: 'playing the piano' },
  ball: { icon: '🏐', ask: 'Play with the ball', does: 'playing with the ball', acts: () => ['dribble', 'toss', 'ball'] },
  lighting: { icon: '💡', ask: 'Set the mood with the lamp', piece: 'lamp', does: 'setting the mood with the lamp', acts: () => ['mood'] },
  guitar: { icon: '🎸', ask: 'Play the guitar', piece: 'guitar', does: 'playing the guitar', acts: (b) => (b.music ? ['jamguitar', 'guitar'] : ['guitar']) },
  speedreading: { icon: '📖', ask: 'Speed-read a book', use: ['shelf'], does: 'reading' },
  'dance.moves': { icon: '🕺', ask: 'Show his dance moves', here: true, music: true, does: 'doing his dance moves', acts: () => ['dancemoves'] },
  'dance.ballroom': { icon: '💃', ask: 'Waltz and swing', here: true, music: true, does: 'dancing a waltz', acts: () => ['ballroom'] },
  drums: { icon: '🥁', ask: 'Play the drums', piece: 'drums', does: 'playing the drums', acts: () => ['drums'] },
  'drums.solo': { icon: '🔥', ask: 'Play a drum solo', piece: 'drums', does: 'playing a drum solo', acts: () => ['drumsolo'] },
  'drums.band': { icon: '🎶', ask: 'Drum along to music', piece: 'drums', music: true, does: 'drumming along with the music', acts: () => ['jamdrums'] },
  easel: { icon: '🖌️', ask: 'Paint', piece: 'easel', does: 'painting', acts: () => ['paint'] },
  'easel.colour': { icon: '🎨', ask: 'Mix colours', piece: 'easel', does: 'mixing colours', acts: () => ['mixpaint'] },
  'easel.portrait': { icon: '🖼️', ask: 'Paint a picture', piece: 'easel', does: 'painting a picture', acts: () => ['portrait'] },
  telescope: { icon: '🔭', ask: 'Look at the stars', piece: 'telescope', does: 'looking at the stars', acts: () => ['stargaze'] },
  'telescope.dark': { icon: '🌌', ask: 'Stargaze in the dark', piece: 'telescope', does: 'stargazing in the dark', acts: () => ['darkstargaze'] },
  'telescope.care': { icon: '🧽', ask: 'Clean the telescope', piece: 'telescope', does: 'looking after the telescope', acts: () => ['scopecare'] },
  decorate: { icon: '🧹', ask: 'Dust and tidy', does: 'dusting', acts: (b) => (b.hereId() === 'library' ? ['libclean', 'dust', 'dusttop'] : ['dusttop', 'dust']) },
  workshop: { icon: '🧰', ask: 'Tidy the tools', use: ['toolbox', 'workbench'], room: 'workshop', does: 'tidying the tools' },
  'workshop.materials': { icon: '🪵', ask: 'Build something from wood', use: ['woodfactory'], room: 'workshop', does: 'building' },
  'workshop.furniture': { icon: '🪑', ask: 'Build furniture', use: ['woodfactory', 'workbench'], room: 'workshop', does: 'building' },
  'workshop.metal': { icon: '⚙️', ask: 'Build something from metal', use: ['metalfactory'], room: 'workshop', does: 'building' },
  restaurant: { icon: '🍲', ask: 'Run the restaurant', use: ['stove', 'kitchencounter', 'register', 'diningtable'], room: 'restaurant', does: 'running the restaurant' },
  outdoor: { icon: '🌳', ask: 'Play in the yard', room: 'backyard', does: 'playing outside', acts: () => ['yardpoke', 'yardsit', 'birdbath'] },
  'outdoor.soccer': { icon: '⚽', ask: 'Play soccer', use: ['soccergoal'], room: 'backyard', does: 'playing soccer' },
  'outdoor.basketball': { icon: '🏀', ask: 'Shoot hoops', use: ['basketballhoop'], room: 'backyard', does: 'shooting hoops' },
  'range.pistol': { icon: '🎯', ask: 'Shoot the pulse pistol', room: 'range', does: 'shooting the pulse pistol', acts: () => ['rangeshoot'], blaster: 'range.pistol' },
  'range.carbine': { icon: '⚡', ask: 'Shoot the arc carbine', room: 'range', does: 'shooting the arc carbine', acts: () => ['rangeshoot'], blaster: 'range.carbine' },
  bowling: { icon: '🎳', ask: 'Go bowling', room: 'bowling', does: 'bowling', acts: () => ['bowl'] },
};
export const SKILL_USES = Object.keys(SKILL_USE);
// the groups of the menu (every skill is in one: sweepSkillMenu)
export const SKILL_GROUPS = [
  ['Music', ['guitar', 'piano', 'piano.advanced', 'drums', 'drums.solo', 'drums.band']],
  ['Dancing', ['stereo', 'dance.moves', 'dance.ballroom']],
  ['Art and stars', ['easel', 'easel.colour', 'easel.portrait', 'telescope', 'telescope.dark', 'telescope.care']],
  ['At home', ['ball', 'lighting', 'decorate', 'speedreading']],
  ['Outdoors and games', ['outdoor', 'outdoor.soccer', 'outdoor.basketball', 'bowling', 'range.pistol', 'range.carbine']],
  ['Work', ['workshop', 'workshop.materials', 'workshop.furniture', 'workshop.metal', 'restaurant']],
];
const THING = { guitar: 'guitar', drums: 'drum kit', easel: 'easel', telescope: 'telescope', lamp: 'lamp', table: 'stereo', piano: 'piano', shelf: 'bookshelf', toolbox: 'toolbox', workbench: 'workbench',
  woodfactory: 'Wood Factory', metalfactory: 'Metal Factory', stove: 'stove', kitchencounter: 'kitchen counter', register: 'cash register', diningtable: 'dining table', soccergoal: 'soccer goal', basketballhoop: 'basketball hoop' };
const ROOM_NAMES = { workshop: 'Workshop', restaurant: 'Restaurant', backyard: 'Backyard', range: 'Shooting Range', bowling: 'Bowling Alley' };

export function installSkillRun(Brain) {
  const skip0 = Brain.prototype.skip;
  Object.assign(Brain.prototype, {
    // told to do something else, or to stop: the skill he was on is off
    skip(keepMusic = false) { this.skillRun = null; return skip0.call(this, keepMusic); },
    roomHere() { return this.roomAt(this.g.root.position.x, this.g.root.position.z); },
    roomName(id) { return id === 'main' ? "GUY's room" : `the ${(this.w.doors[id] && this.w.doors[id].name) || ROOM_NAMES[id] || id}`; },
    // the thing a skill is done with: the one in `room` if there is one, else another that nobody is using
    skillPiece(piece, room) {
      const list = piece === 'guitar' ? this.guitars() : [this.obj(piece)].filter(Boolean);
      const free = list.filter((o) => !this.otherUses(o.name) && !o.packed && !o.hauled);
      return free.find((o) => this.roomOfObj(o.name) === room) || free[0] || list[0] || null;
    },
    // GAL, if she can help right now (she is here, not locked in, not in the middle of a job or a jam, and can get to `rooms`)
    freeHelper(...rooms) {
      const gal = this.w.gal;
      if (this.isGal || !gal || !gal.exists() || gal.emerge || !gal.brain) return null;
      const g = gal.brain;
      if (g.lock || g.stuckIn() || gal.duo || g.forceRecipe || g.homeMove || g.shelfMove || g.hauling || g.carry || busyJob(g)) return null;
      if (rooms.some((r) => r !== 'main' && (!this.w.doors[r] || g.doorLockedFor(r)))) return null;
      return g;
    },
    // where a thing brought to `room` is put: the nearest free place to whoever asked for it, a step away from them. null: no space
    bringSpot(o, room, near = null) {
      const w = this.w, b = this.roomBounds(room), p = near || w.roomSpot(room);
      if (!p) return null;
      const pref = { x: Math.min(b.maxX, Math.max(b.minX, p.x)), z: Math.min(b.maxZ, Math.max(b.minZ, p.z)) };
      const at = w.findSpot(o, pref, near);
      return at && this.roomAt(at.x, at.z) === room ? at : null;
    },
    // How choosing a skill would go from where he is now, for its button in the menu: { icon, ask, text, tone }. tone: 'here' (at once, in this
    // room), 'help' (something comes to him), 'go' (he goes to it), 'no' (not now: the text says why). It changes nothing.
    skillPreview(id) {
      const U = SKILL_USE[id], w = this.w, here = this.roomHere(), shut = this.stuckIn();
      const is = (tone, text) => ({ icon: U.icon, ask: U.ask, tone, text });
      const inRoom = (r) => `In ${r === 'main' ? 'his room' : this.roomName(r)}`, a = (t) => `${/^[aeiou]/i.test(t) ? 'an' : 'a'} ${t}`;
      const helper = (...rooms) => this.freeHelper(...rooms);
      const orderable = (n) => { const ops = this.ops(), st = ops && this.obj('workstation') && ops.status(n); return st === 'removed' || st === 'available'; };
      if (U.room && !w.doors[U.room]) return is('no', `Add the ${ROOM_NAMES[U.room]} first`);
      if (U.room && this.doorLockedFor(U.room)) return is('no', 'The door is locked');
      if (shut && U.room !== shut && !(U.use && U.use.some((n) => this.roomOfObj(n) === shut))) return is('no', 'He is shut in');
      const piece = U.stereo ? 'table' : U.piece, o = U.use ? this.obj(U.use.find((n) => this.obj(n))) : piece ? this.skillPiece(piece, here) : null;
      const thing = THING[U.use ? U.use[0] : piece];
      if ((U.use || piece) && !o) return piece && orderable(piece) ? is('help', helper(this.roomOfObj('workstation')) ? 'GAL orders one' : 'He orders one') : is('no', `Add ${a(thing)} first`);
      const at = o ? this.roomOfObj(o.name) : U.room || (id === 'ball' || id === 'decorate' ? 'main' : here);
      if (o && at !== 'main' && this.doorLockedFor(at)) return is('no', 'The door is locked');
      if (o && this.otherUses(o.name) && !o.seats) return is('no', `${this.isGal ? 'GUY' : 'GAL'} is using it`);
      if (id === 'ball' && w.ballGone) return is('no', 'Add a ball first');
      if (U.stereo && at === here) return this.music ? { ...is('here', 'Right here'), ask: 'Turn the music off', icon: '🔇' } : is('here', 'Right here');
      if (U.stereo && this.music) return { ...is('help', helper(at) ? 'GAL turns it off' : 'He goes and turns it off'), ask: 'Turn the music off', icon: '🔇' };
      if (U.music && !this.music && !this.obj('table')) return is('no', 'Add a stereo first');
      const needs = (U.music && !this.music) || U.stereo ? this.roomOfObj('table') : null;
      if (o && !U.use && !U.stereo && at !== here) return this.movable(o) ? is('help', !this.handsFull(o) && helper(at, here) ? 'GAL brings it' : 'He fetches it') : is('go', inRoom(at));
      if (needs && needs !== here) return is('help', helper(needs) ? 'GAL puts the music on' : 'He puts the music on first');
      return at === here ? is('here', 'Right here') : is('go', inRoom(at));
    },
    // it is in his own hands (the guitar: its stand is elsewhere): nobody can take it along until he has put it back, so he brings it himself
    handsFull(o) { return !!o && !!o.guitar && this.gtr.held && this.gname === o.name; },
    // a thing the robots can carry: light and medium things; never the heavy ones, the stereo with its music, or what has to stay put
    movable(o) { return o.weight !== 'heavy' && o.name !== 'table' && !o.mainOnly && !o.stowed && o.removable !== false; },
    // can it be carried to `room`, and is there space for it?
    canBring(o, room) {
      const p = this.g.root.position;
      return !!o && this.movable(o) && !this.otherUses(o.name)
        && !(room !== 'main' && this.doorLockedFor(room)) && !!this.bringSpot(o, room, this.roomHere() === room ? { x: p.x, z: p.z } : null);
    },

    // ------------------------------------------------------------------ the order itself. Returns { ok, message } (a toast).
    useSkill(id) {
      const U = SKILL_USE[id], w = this.w, no = (message) => ({ ok: false, message }), yes = (message) => ({ ok: true, message });
      if (!U || !SKILL_INFO[id]) return no('There is nothing to do with that skill.');
      if (!this.skills.has(id)) return no('GUY has not learned that.');
      const on = this.skillRun;                             // (chosen again while it is on its way: that does not start it all over)
      if (on && on.id === id && !on.fixed && !on.started) return yes(on.by === 'gal' ? 'GAL is already on it.' : 'GUY is already on it.');
      const here = this.roomHere(), shut = this.stuckIn();
      if (U.room && !w.doors[U.room]) return no(`There is no ${ROOM_NAMES[U.room]}. Add it from the Catalog.`);
      if (shut && !U.use && U.room !== shut) return no(this.shutInMessage(shut));
      if (U.room && this.doorLockedFor(U.room)) return no(`The ${w.doors[U.room].name} door is locked. Unlock it first (long-press the door).`);
      if (U.use) return this.useFixed(U, here);
      const run = { id, room: here, does: U.does, piece: null, acts: U.acts, act: null, here: !!U.here, needMusic: false, started: false, by: null, t0: this.time, blaster: U.blaster };

      // the stereo: he puts music on and dances (or, when it is on, switches it off); if it is in another room GAL sees to it, and he dances where he is
      if (U.stereo) {
        if (!this.obj('table')) return this.orderPiece('table', { ...run, here: true, needMusic: true }) || no('There is no stereo in the house. Add one from the Catalog.');
        if (this.music && this.roomOfObj('table') === here) return this.interact('table');
        if (this.music) {
          const g = this.freeHelper(this.roomOfObj('table'));
          if (!g) return this.interact('table');
          this.unlock(false); this.skip(true);
          this.say2(g, 'GAL, can you turn the music off?', 'Sure.');
          this.sendHelper(g, 'stereooff');
          return yes('GUY asks GAL to switch the music off.');
        }
        run.here = true;
        return this.beginMusic(run);
      }
      if (U.piece) {
        const o = this.skillPiece(U.piece, here);
        run.thing = THING[U.piece];
        if (!o) return this.orderPiece(U.piece, { ...run, needMusic: !!U.music }) || no(`There is no ${run.thing} in the house. Add one from the Catalog.`);
        if (this.otherUses(o.name)) return no(`${this.isGal ? 'GUY' : 'GAL'} is using the ${run.thing} right now. Try again in a moment.`);
        run.piece = o.name;
        const at = this.roomOfObj(o.name);
        if (at !== here) {
          if (at !== 'main' && this.doorLockedFor(at)) return no(`The ${w.doors[at].name} door is locked. Unlock it first (long-press the door).`);
          if (!this.canBring(o, here)) { run.room = at; run.went = true; }                     // (no space for it here: he goes to it)
          else {
            const g = this.handsFull(o) ? null : this.freeHelper(at, here);
            this.beginRun(run);
            run.needMusic = !!U.music;
            if (g) {
              run.by = 'gal';
              this.say2(g, `GAL, can you bring me the ${run.thing}?`, 'On my way.');
              this.sendHelper(g, 'bringpiece', { name: o.name, room: here, thing: run.thing, for: this });
              this.pendingActivity = 'skillwait';
              return yes(`GUY asks GAL to bring the ${run.thing} to ${this.roomName(here)}.`);
            }
            run.by = 'guy';
            this.bringJob = { name: o.name, room: here, thing: run.thing, for: this };
            this.pendingActivity = 'bringpiece';
            return yes(`GUY is fetching the ${run.thing} to ${this.roomName(here)}.`);
          }
        }
      }
      if (U.music && !this.music) return this.beginMusic(run);
      this.beginRun(run);
      if (!this.startSkill()) return this.refuseRun(run);
      const at = this.roomForAct(run.act);
      return yes(run.went ? `There is no space for the ${run.thing} here, so GUY is going to it.` : at === here ? `GUY is ${run.does}.` : `GUY is going to ${this.roomName(at)}: ${run.does}.`);
    },
    // a fixed thing: he goes to it (the same as choosing it from its own menu); what he cannot do, GAL may
    useFixed(U, here) {
      const name = U.use.find((n) => this.obj(n)), thing = THING[name || U.use[0]] || name || U.use[0];
      if (!name) return { ok: false, message: `There is no ${thing} in the house. Add one from the Catalog.` };
      const r = this.interact(name);
      if (r.ok) {
        this.wantSong = U.song || null;
        const act = this.pendingActivity;
        this.skillRun = { id: Object.keys(SKILL_USE).find((k) => SKILL_USE[k] === U), act, acts: () => [act], room: here, fixed: true, started: false, t0: this.time };       // (so the menu shows it; he is on his way already)
        const at = this.roomOfObj(name);
        return { ok: true, message: at === here ? `GUY is ${U.does}.` : `The ${thing} stays in ${this.roomName(at)}, so GUY is going there.` };
      }
      const g = this.freeHelper(this.roomOfObj(name)), r2 = g && g.interact(name);
      if (!r2 || !r2.ok) return r;
      this.say2(g, `GAL, can you see to the ${thing}?`, 'Sure thing.');
      return { ok: true, message: `GUY asks GAL to see to the ${thing}.` };
    },
    say2(g, ask, reply) { const gal = this.w.gal; gal.say(`GUY asks GAL: ${ask}`); gal.talk('guy', ask); gal.talk('gal', reply); },
    sendHelper(g, act, job = null) { g.unlock(false); g.skip(true); g.bringJob = job; g.pendingActivity = act; },
    beginRun(run) { this.unlock(false); this.skip(true); this.skillRun = run; run.t0 = this.time; },
    refuseRun(run) {
      this.skillRun = null;
      const why = run.acts(this).map((a) => this.whyNot(a)).filter(Boolean)[0];
      return { ok: false, message: `GUY can't do that right now${why ? `: ${why}` : ''}.` };
    },
    // not in the house (taken out, or still in the Catalog): it is ordered into his room at the workstation. null: it cannot be ordered
    orderPiece(id, run) {
      const ops = this.ops(), st = ops && this.obj('workstation') && ops.status(id);
      if (st !== 'removed' && st !== 'available') return null;
      const order = { add: [{ id, room: run.room }], remove: [] }, g = this.freeHelper(this.roomOfObj('workstation'));
      run.piece = id; run.thing = THING[id]; run.ordered = true;
      if (g) {
        this.beginRun(run);
        run.by = 'gal';
        this.say2(g, `GAL, can you order a ${run.thing} for ${this.roomName(run.room)}?`, 'I will order one.');
        g.arrangeOrder(order);
        this.pendingActivity = 'skillwait';
        return { ok: true, message: `GUY asks GAL to order a ${run.thing} at the workstation.` };
      }
      const r = this.arrangeOrder(order);                        // (that skips what he is doing: the run starts after it)
      if (!r.ok) return r;
      run.by = 'guy'; run.t0 = this.time; this.skillRun = run;
      return { ok: true, message: `GUY is ordering a ${run.thing} at the workstation.` };
    },
    // the stereo has to be on first
    beginMusic(run) {
      if (!this.obj('table')) return { ok: false, message: 'There is no stereo in the house. Add one from the Catalog.' };
      const at = this.roomOfObj('table');
      if (at !== 'main' && this.doorLockedFor(at)) return { ok: false, message: `The ${this.w.doors[at].name} door is locked. Unlock it first (long-press the door).` };
      this.beginRun(run);
      if (at === run.room && DANCES.includes(run.acts(this)[0])) return this.startSkill() ? { ok: true, message: `GUY is ${run.does}.` } : this.refuseRun(run);       // (the dance switches it on itself)
      run.needMusic = true;
      const message = this.askMusic(run, at);
      this.pendingActivity = run.by === 'gal' ? 'skillwait' : 'musicon';
      return { ok: true, message };
    },
    askMusic(run, at = this.roomOfObj('table')) {
      const g = at === run.room ? null : this.freeHelper(at);
      run.askedMusic = true; run.t0 = this.time; run.waved = false;
      if (!g) { run.by = 'guy'; return 'GUY is switching the music on first.'; }
      run.by = 'gal';
      this.say2(g, 'GAL, can you put some music on?', 'Coming right up.');
      this.sendHelper(g, 'musicon');
      return 'GUY asks GAL to put some music on.';
    },
    // everything is there: do it. false: he cannot after all
    startSkill() {
      const run = this.skillRun;
      if (!run) return false;
      run.act = null;
      const act = run.acts(this).find((a) => { run.act = a; return this.available(a); });       // (run.act is set while it is asked: see `available` and `skillRoom`)
      run.act = act || null;
      if (!act) return false;
      const o = run.piece && this.obj(run.piece);
      if (o && o.guitar) this.wantGuitar = run.piece;
      if (run.blaster) this.wantBlaster = run.blaster;
      this.pendingActivity = act;
      return true;
    },
    // the room an activity of the run happens in, when it is done where he was asked (dancing) and not where its object is
    skillRoom(act) { const r = this.skillRun; return r && r.here && r.act === act ? r.room : null; },
    // is `act` the run's own, to music that is already on? (the stereo may then be in another room)
    skillToMusic(act) { const r = this.skillRun; return !!(r && r.act === act && this.music); },
    skillWants(name) { const r = this.skillRun; return !!(r && r.piece === name); },

    // ------------------------------------------------------------------ choose()'s part
    // The run while he does `name`: it goes on while he waits, fetches or does it; anything else ends it.
    skillTrack(name) {
      const run = this.skillRun;
      if (!run) return;
      if (name === run.act && !run.started) run.started = true;
      else if (run.started || (run.fixed && !this.pendingActivity) || !ON_THE_WAY.includes(name)) this.skillRun = null;
    },
    skillNext() {
      const r = this.skillRun;
      if (!r || r.fixed) return null;
      // it came to nothing before he had begun (GAL still stood in his way, say): he looks again in a moment
      if (r.started && !r.did && this.last === r.act && (r.tries || 0) < 3) { r.started = false; r.tries = (r.tries || 0) + 1; r.retryAt = this.time + 1.5; }
      return r.started ? null : 'skillwait';
    },
    // every frame: has he really begun? (a pose of its own, not just walking up to it)
    skillWatch() {
      const r = this.skillRun, s = this.step;
      if (r && r.started && !r.did && this.last === r.act && s && s.type === 'play' && s.t > 0.8 && !['idle', 'reach'].includes(s.pose)) r.did = true;
    },
    // the music put on for a skill is switched off once it is over: by GAL, or by him when she is not here
    skillMusicNext() {
      const w = this.w;
      if (!w.skillMusic) return null;
      if (!this.music || this.userMusic) { w.skillMusic = false; return null; }
      const guy = this.isGal ? this.leader : this, gal = w.gal && w.gal.exists() ? w.gal.brain : null;
      if (guy.skillNext()) return null;
      for (const b of [guy, gal]) if (b && (MUSIC_ACTS.includes(b.pendingActivity) || (b !== this && MUSIC_ACTS.includes(b.last) && (b.step || b.queue.length)))) return null;
      if (gal && !this.isGal && !gal.lock && !gal.stuckIn()) return null;                // (GAL sees to it)
      if (this.time - (this.musicOffTried ?? -99) < 20 || !this.available('stereooff')) return null;
      this.musicOffTried = this.time;
      return 'stereooff';
    },

    // ------------------------------------------------------------------ the activities
    skillRunActivities() {
      const w = this.w;
      return {
        // waiting for GAL to bring something (or to put the music on): he waves to her, waits, and then gets on with it
        skillwait: () => {
          const run = this.skillRun;
          if (!run) return ['thinking', this.play('idle', 0.5)];
          const waiting = run.by === 'gal' && !this.skillIsReady(run);
          const label = !waiting ? 'getting ready' : run.askedMusic ? 'waiting for GAL to put the music on' : `waiting for GAL to ${run.ordered ? 'order' : 'bring'} the ${run.thing}`;
          const wave = waiting && !run.waved ? [this.play('wave', 2.6, { at: [0.2, () => { run.waved = true; }] })] : [];
          return [label, { type: 'plan', fn: () => (this.stuckIn() ? [] : this.tripSteps(this.roomHere(), run.room)) }, { type: 'plan', fn: () => (waiting ? this.clearOfDoors(run.room) : []) }, ...wave, { type: 'plan', fn: () => this.skillWaitSteps() }];
        },
        // carry a thing from the room it is in to another (GAL for GUY, or GUY for himself)
        bringpiece: () => this.bringSteps(),
        // put the stereo on for somebody (the music is switched off again when the skill is over)
        musicon: () => {
          if (!this.obj('table')) return ['no stereo', this.play('idle', 0.5)];
          return ['putting some music on', this.walkAt('table', 0, 0.55, Math.PI),
            this.play('reach', 1.8, { needs: ['table'], at: [0.9, () => { if (!this.music) { this.musicOn(); w.skillMusic = true; } }], target: () => this.stereoButton() })];
        },
      };
    },
    // the thing he needs stands in the room he asked for it in (or anywhere, when he goes to it or only needs its music)
    skillThere(run) {
      if (!run.piece) return true;
      const o = this.obj(run.piece), m = this.other && this.other.homeMove;
      return !!o && !o.packed && !o.hauled && !(m && m.name === run.piece) && (run.here || this.roomOfObj(run.piece) === run.room);
    },
    skillIsReady(run) { return this.skillThere(run) && (!run.needMusic || !!this.music); },
    // one look: ready (start), still coming (wait a little longer), or she has given up (he sees to it himself)
    skillWaitSteps() {
      const run = this.skillRun, note = (m) => { this.ui(m); if (this.onSkillNote) this.onSkillNote(m); };
      if (!run) return [];
      if (run.retryAt > this.time) return [this.play('idle', 0.5), { type: 'plan', fn: () => this.skillWaitSteps() }];
      if (this.skillIsReady(run)) {
        if (!this.startSkill()) note(this.refuseRun(run).message);
        return [];
      }
      const again = (sec = 0.8) => [this.play('idle', sec), { type: 'plan', fn: () => this.skillWaitSteps() }];
      if (this.skillThere(run) && !run.askedMusic) {                          // (the thing is here; now the music)
        this.askMusic(run);
        if (run.by === 'gal') return again(0.4);
        this.pendingActivity = 'musicon';
        return [];
      }
      const g = run.by === 'gal' && this.w.gal && this.w.gal.exists() ? this.w.gal.brain : null;
      const job = run.askedMusic ? 'musicon' : run.ordered ? 'arrange' : 'bringpiece';
      const carrying = !!(g && g.homeMove && g.homeMove.name === run.piece);             // (also when she has just given up the way: she sets it down first)
      const setOff = g && (carrying || (g.last === job && (g.step || g.queue.length))), about = g && g.pendingActivity === job;
      if (setOff) run.setOff = true;
      if ((carrying || setOff || (about && this.time - run.t0 < START_WAIT)) && this.time - run.t0 < WAIT_MAX) return again();
      // she was on it and it came to nothing (somebody in the way): she tries once more
      if (g && run.setOff && !run.again && !run.askedMusic && !run.ordered && this.obj(run.piece) && this.roomOfObj(run.piece) !== run.room && this.freeHelper(this.roomOfObj(run.piece), run.room) === g && this.canBring(this.obj(run.piece), run.room)) {
        run.again = true; run.setOff = false; run.t0 = this.time;
        this.sendHelper(g, 'bringpiece', { name: run.piece, room: run.room, thing: run.thing, for: this });
        return again();
      }
      if (about) { g.pendingActivity = null; g.bringJob = null; }                          // (too busy: he does it, not both of them)
      // nobody is at it (GAL was called away, or could not): he does it himself, once
      const o = run.piece && this.obj(run.piece);
      if (!run.self) {
        run.self = true; run.by = 'guy'; run.t0 = this.time;
        if (run.askedMusic && this.obj('table')) { this.pendingActivity = 'musicon'; return []; }
        if (!run.askedMusic && o && this.canBring(o, run.room)) { this.bringJob = { name: o.name, room: run.room, thing: run.thing, for: this }; this.pendingActivity = 'bringpiece'; return []; }
        if (!run.askedMusic && o && !o.packed && !o.hauled) { run.room = this.roomOfObj(o.name); return [...this.tripSteps(this.roomHere(), run.room), ...again(0.2)]; }        // (it cannot come to him: he goes to it)
      }
      this.skillRun = null;
      note(run.askedMusic ? 'GUY could not get the music on.' : `GUY could not get the ${run.thing}.`);
      return [];
    },

    // Where he waits: a step into the room when he stands in or at a doorway (whoever brings the thing could not get in past him).
    clearOfDoors(room) {
      const w = this.w, p = this.g.root.position, doors = Object.keys(w.doors).map((id) => w.doorPoint(id, 0)).filter(Boolean);
      const near = (x, z) => Math.min(99, ...doors.map((d) => Math.hypot(d.x - x, d.z - z)));
      if (near(p.x, p.z) >= DOOR_CLEAR) return [];
      const b = this.roomBounds(room), cands = [];
      for (let x = b.minX + 0.5; x <= b.maxX - 0.5; x += 0.35) for (let z = b.minZ + 0.5; z <= b.maxZ - 0.5; z += 0.35) if (near(x, z) >= DOOR_CLEAR + 0.2 && this.clearFloor(x, z, 0.5)) cands.push({ x, z, d: Math.hypot(x - p.x, z - p.z) });
      const c = cands.sort((m, n) => m.d - n.d)[0], d0 = doors.sort((m, n) => Math.hypot(m.x - p.x, m.z - p.z) - Math.hypot(n.x - p.x, n.z - p.z))[0];
      return c ? [{ ...this.walk(c.x, c.z, Math.atan2(d0.x - c.x, d0.z - c.z)), tol: 0.3 }] : [];
    },
    // open floor, with `r` all round it (the other robot counts)
    clearFloor(x, z, r) {
      const w = this.w, q = this.other && this.other.g && this.other.g.root.position;
      return w.walkable(x, z) && !(q && Math.hypot(q.x - x, q.z - z) < r + 0.2) && !w.obstacles.some((o) => o !== this.selfOb && o.active !== false && !o.char && x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r);
    },
    // where to stand to put `o` down at `spot`: the side nearest to whoever carries it that is open floor (the side towards the middle of the
    // room may be where the one who asked for it is standing, or a piece of furniture)
    dropStand(room, spot, o) {
      const base = this.setUpStand(room, spot, o.w, o.d), p = this.g.root.position, at = Math.atan2(p.x - spot.x, p.z - spot.z);
      for (let i = 0; i < 12; i++) {
        const a = at + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 6), ux = Math.sin(a), uz = Math.cos(a);
        const ext = Math.min(Math.abs(ux) > 1e-3 ? o.w / 2 / Math.abs(ux) : 9, Math.abs(uz) > 1e-3 ? o.d / 2 / Math.abs(uz) : 9), k = Math.max(0.95, ext + 0.45), x = spot.x + ux * k, z = spot.z + uz * k;
        if (this.roomAt(x, z) === room && this.clearFloor(x, z, 0.3)) return { st: { x, z }, edge: { x: spot.x + ux * ext, z: spot.z + uz * ext } };
      }
      return base;
    },

    // walk to it, pick it up (a light thing whole, in both hands; the drum kit comes apart and goes flat), carry it through the doors and
    // put it down in the room it was asked for
    bringSteps() {
      const j = this.bringJob, w = this.w, o = j && this.obj(j.name);
      this.bringJob = null;
      const asker = j && j.for && j.for !== this ? j.for.g.root.position : null;
      const spotOf = (x) => this.bringSpot(x, j.room, asker && this.roomAt(asker.x, asker.z) === j.room ? { x: asker.x, z: asker.z } : null);
      if (!o || !spotOf(o)) return ['nothing to bring', this.play('idle', 0.5)];
      (this.using ||= new Set()).add(o.name);
      const n = o.name, whole = o.weight === 'light', from = { x: o.x, z: o.z, rot: o.rot };
      const at = () => { const p = this.obj(n); return p ? V(p.x, whole ? 0.5 : 0.35, p.z) : this.g.pos.clone(); };
      const done = () => { this.homeMove = null; if (this.using) this.using.delete(n); };
      const pickUp = () => {
        const p = this.obj(n);
        if (!p || p.packed || p.hauled || (this.otherUses(n) && !(j.for && j.for !== this && j.for.skillWants(n)))) { this.queue.length = 0; return; }
        this.homeMove = { name: n, from, whole };
        if (whole) { this.startHaul(n); sfx('thud', 0.2); } else { w.packShelf(n); this.setCarry('flat', 1); sfx('thud', 0.4); }
      };
      let spot = null;
      const put = () => {
        const p = this.obj(n);
        if (!p || !this.homeMove) return;
        if (!spot || !w.fits(p, spot.x, spot.z)) { this.homeCleanup(); return; }          // (somebody has put something there in the meantime)
        const home = p.home;                                     // (where it belongs is still where it came from)
        if (whole) { this.endHaul(spot.x, spot.z); sfx('thud', 0.3); } else { this.setCarry(null); w.unpackShelf(n, { x: spot.x, z: spot.z, rot: p.rot }); p.home = home; (this.popping ||= []).push({ o: p, t: 0 }); done(); sfx('thud', 0.5); sfx('chime'); }
      };
      return [`bringing the ${j.thing} to ${asker ? 'GUY' : this.roomName(j.room)}`,
        { type: 'plan', fn: () => { const p = this.obj(n); return p && !p.packed ? this.tripSteps(this.roomHere(), this.roomOfObj(n)) : []; } },
        this.stand(n, o.hung ? 0.75 : whole ? 0.55 : 0.7, at),                        // (hung on a wall of the Studio: clear of the wall)
        this.play('reach', 1.8, { at: [0.8, pickUp], target: at }),
        { type: 'plan', fn: () => (this.homeMove ? this.tripSteps(this.roomHere(), j.room) : []) },
        { type: 'plan', fn: () => {
          const p = this.obj(n);
          if (!p || !this.homeMove) return [];
          spot = spotOf(p);
          if (!spot) { this.homeCleanup(); return []; }
          const { st, edge } = this.dropStand(j.room, spot, p);
          return [{ ...this.walk(st.x, st.z, Math.atan2(spot.x - st.x, spot.z - st.z)), tol: 0.4 },
            this.play('reach', 1.8, { target: () => V(edge.x, whole ? 0.5 : 0.35, edge.z), at: [0.8, put] }),
            this.play('idle', 0.8, { at: [0.7, () => { if (whole && this.homeMove) done(); }] })];
        } }];
    },
  });
}
