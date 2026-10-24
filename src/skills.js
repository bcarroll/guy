// Guy's skills. He learns them by reading the books on the shelf; activities check what he knows before he tries them.
//
// To add a skill later (e.g. when the user adds an object with its own manual): add a BOOK_DEFS entry and a SKILL_INFO entry,
// put the book on the shelf with world.objects.shelf.addBook(def), and gate the activity in Brain.available().

// Every book that exists. `start` ones are on the shelf from the beginning; the rest are added from the Catalog.
// requires.object: the object that has to be in the room first; locked: a future premium item.
export const BOOK_CATALOG = [
  { id: 'stereo', title: 'Stereo User Manual', teaches: 'stereo', color: 0x2d6a9f, thick: 0.055, height: 0.31, blurb: 'how to use the stereo', start: true, desc: 'How to use the stereo.' },
  { id: 'piano', title: 'Piano Playing for Robots', teaches: 'piano', color: 0x8b2d4d, thick: 0.065, height: 0.33, blurb: 'piano scales and a few simple tunes', start: true, desc: 'Piano scales and a few simple tunes.' },
  { id: 'ball', title: "Let's Play Ball", teaches: 'ball', color: 0xd9741d, thick: 0.045, height: 0.29, blurb: 'fun ways to play with a ball', start: true, desc: 'Fun ways to play with a ball.' },
  { id: 'lighting', title: 'The Power of Lighting', teaches: 'lighting', color: 0xd8b830, thick: 0.05, height: 0.3, blurb: 'all about lights', start: true, desc: 'All about lights.' },
  { id: 'piano2', title: 'Piano: Classics, Blues & Waltzes', teaches: 'piano.advanced', color: 0x5a3a9b, thick: 0.07, height: 0.34,
    blurb: 'classical pieces, blues and waltzes', requires: { object: 'piano' }, desc: 'Für Elise, twelve-bar blues, a moonlit waltz and free improvisation. Best read after the piano basics.' },
  { id: 'guitar', title: 'Guitar for Beginners', teaches: 'guitar', color: 0x2d8b5a, thick: 0.05, height: 0.3,
    blurb: 'how to play the guitar', requires: { object: 'guitar' }, desc: 'Open chords and strumming patterns.' },
  // ---- the Workshop (listed only once the Workshop room has been added) ----
  { id: 'workshop', title: 'Workshop Basics', teaches: 'workshop', color: 0xb5651d, thick: 0.055, height: 0.31, room: 'workshop',
    blurb: 'how to use the workbench and the Wood Factory, and build a wooden foot stool', requires: { object: 'workbench' }, desc: 'Working at the workbench, tidying the toolbox, and a first project made at the Wood Factory: a wooden foot stool.' },
  { id: 'woodmetal', title: 'Wood & Metal Basics', teaches: 'workshop.materials', color: 0x2a9d8f, thick: 0.06, height: 0.32, room: 'workshop',
    blurb: 'how to build bigger wooden things at the Wood Factory', requires: { object: 'woodfactory' }, desc: 'Run the Wood Factory for bigger projects: a bookshelf, a wooden dining table and the wooden body of an electric guitar.' },
  { id: 'furniture', title: 'Furniture for Robots', teaches: 'workshop.furniture', color: 0x6d4c41, thick: 0.07, height: 0.34, room: 'workshop',
    blurb: 'how to build wooden chairs', requires: { object: 'workbench' }, desc: 'Bigger projects, starting with a wooden chair. Best read after the basics.' },
  { id: 'metalfab', title: 'Metal Fabrication for Robots', teaches: 'workshop.metal', color: 0x546e7a, thick: 0.07, height: 0.34, room: 'workshop',
    blurb: 'how to build metal chairs and tables at the Metal Factory', requires: { object: 'metalfactory' }, desc: 'Run the Metal Factory to build metal chairs and tables, and the metal hardware of an electric guitar when the Wood Factory is there too.' },
  // ---- the Restaurant (listed only once the Restaurant room has been added) ----
  { id: 'restaurant', title: 'Restaurant Basics', teaches: 'restaurant', color: 0xc0392b, thick: 0.055, height: 0.31, room: 'restaurant',
    blurb: 'how to cook, serve and take payment', requires: { object: 'stove' }, desc: 'Taking orders, cooking at the stove, serving the plates and ringing up the bill.' },
  // ---- reading itself ----
  { id: 'speedread', title: 'Speed Reading for Robots', teaches: 'speedreading', color: 0x00a3b4, thick: 0.045, height: 0.3,
    blurb: 'how to read much faster', desc: 'Skim, flip, absorb. He reads at the bookshelf without sitting down, and learns from every book in a fraction of the time. Forgotten slowly.' },
  // ---- dancing (needs the stereo) ----
  { id: 'dancemoves', title: 'Dance Moves for Robots', teaches: 'dance.moves', color: 0xe91e8c, thick: 0.05, height: 0.3,
    blurb: 'the twist, the shuffle and a twirl', requires: { object: 'table' }, desc: 'Twist, shuffle and twirl on the spot.' },
  { id: 'ballroom', title: 'Waltz & Swing', teaches: 'dance.ballroom', color: 0x6a1b9a, thick: 0.06, height: 0.33,
    blurb: 'ballroom waltz and swing dancing', requires: { object: 'table' }, desc: 'A turning waltz hold and a bouncy swing, both in time with the music.' },
  // ---- drum kit ----
  { id: 'drumming', title: 'Drumming for Robots', teaches: 'drums', color: 0xc0392b, thick: 0.055, height: 0.3,
    blurb: 'how to keep a steady drum beat', requires: { object: 'drums' }, desc: 'Sit at the kit and keep a steady beat.' },
  { id: 'drumsolo', title: 'Fills & Solos', teaches: 'drums.solo', color: 0x8e44ad, thick: 0.05, height: 0.31,
    blurb: 'drum fills and solos', requires: { object: 'drums' }, desc: 'Tom rolls, cymbal crashes and showing off.' },
  { id: 'drumband', title: 'Playing in the Band', teaches: 'drums.band', color: 0x16a085, thick: 0.06, height: 0.32,
    blurb: 'how to play drums along with the music', requires: { object: 'drums' }, desc: 'Keep time with whatever is on the stereo.' },
  // ---- easel ----
  { id: 'painting', title: 'Painting for Robots', teaches: 'easel', color: 0xe84393, thick: 0.05, height: 0.3,
    blurb: 'how to paint', requires: { object: 'easel' }, desc: 'Brushes, canvas and first strokes.' },
  { id: 'colour', title: 'Colour Mixing', teaches: 'easel.colour', color: 0x27ae60, thick: 0.045, height: 0.29,
    blurb: 'how to mix colours on a palette', requires: { object: 'easel' }, desc: 'Mix the paints on a palette before they touch the canvas.' },
  { id: 'portrait', title: 'Portraits & Landscapes', teaches: 'easel.portrait', color: 0x7f8c8d, thick: 0.06, height: 0.33,
    blurb: 'how to paint portraits and landscapes', requires: { object: 'easel' }, desc: 'Faces, hills, suns and still lifes, then step back and admire.' },
  // ---- decorating (no object needed: the room always has something to dust) ----
  { id: 'decorating', title: 'Home Decorating for Robots', teaches: 'decorate', color: 0xc8744a, thick: 0.06, height: 0.32,
    blurb: 'how to look after the room: dusting the picture frames and the windows', desc: 'Dust the frames, wipe the window sills and keep the room looking its best. Pictures, plants, rugs and more are in the Catalog under Decor.' },
  // ---- telescope ----
  { id: 'stars', title: 'Stargazing for Robots', teaches: 'telescope', color: 0x1b2a6b, thick: 0.055, height: 0.31,
    blurb: 'how to use a telescope', requires: { object: 'telescope' }, desc: 'Aim it, focus it, and look through the right end.' },
  { id: 'darksky', title: 'Dark Sky Rules', teaches: 'telescope.dark', color: 0x2c3e50, thick: 0.05, height: 0.3,
    blurb: 'dark-sky stargazing', requires: { object: 'telescope' }, desc: 'Switch the lights off first and the stars come out.' },
  { id: 'scopecare', title: 'Looking After Your Telescope', teaches: 'telescope.care', color: 0x95a5a6, thick: 0.05, height: 0.3,
    blurb: 'how to look after a telescope', requires: { object: 'telescope' }, desc: 'Wiping the lens, cleaning the tube, checking the tripod.' },
];
export const BOOK_DEFS = BOOK_CATALOG.filter((b) => b.start);

export const SKILL_INFO = {
  workshop: {
    name: 'Workshop basics', book: 'Workshop Basics',
    unlocks: ['Work at the workbench and use the toolbox', 'Run the Wood Factory to build a wooden foot stool'],
  },
  restaurant: {
    name: 'Restaurant basics', book: 'Restaurant Basics',
    unlocks: ['Take customers\' orders', 'Cook at the stove', 'Serve plates to the tables', 'Take payment at the register'],
  },
  'workshop.materials': {
    name: 'Wood & Metal Basics', book: 'Wood & Metal Basics',
    unlocks: ['Build a bookshelf and wooden dining tables at the Wood Factory', 'Make the wooden body of an electric guitar'],
  },
  'workshop.furniture': {
    name: 'Furniture for Robots', book: 'Furniture for Robots',
    unlocks: ['Build wooden chairs, a bookshelf and a dining table when the house needs them', 'Wooden chairs then appear in the Catalog'],
  },
  'workshop.metal': {
    name: 'Metal Fabrication', book: 'Metal Fabrication for Robots',
    unlocks: ['Build metal chairs and tables at the Metal Factory', 'Build an electric guitar (with the Wood Factory)'],
  },
  stereo: {
    name: 'Using the stereo', book: 'Stereo User Manual',
    unlocks: ['Switch the stereo on and off', 'Dance to the music', 'Play along with the music (with piano skills)'],
  },
  piano: {
    name: 'Piano basics', book: 'Piano Playing for Robots',
    unlocks: ['Play scales', 'Play simple tunes (Ode to Joy, Twinkle Twinkle)', 'Before this he can only poke at the keys'],
  },
  ball: {
    name: 'Ball games', book: "Let's Play Ball",
    unlocks: ['Kick the ball properly', 'Dribble it', 'Toss it up and catch it', 'Before this he can only nudge it'],
  },
  lighting: {
    name: 'Lighting', book: 'The Power of Lighting',
    unlocks: ['Set the lamp to different moods', 'Throw a light show to the music (with stereo skills)'],
  },
  'piano.advanced': {
    name: 'Advanced piano', book: 'Piano: Classics, Blues & Waltzes',
    unlocks: ['Für Elise, a twelve-bar blues, a moonlit waltz and free improvisation'],
  },
  guitar: {
    name: 'Guitar', book: 'Guitar for Beginners',
    unlocks: ['Take the guitar off its stand and strum chords'],
  },
  speedreading: { name: 'Speed reading', book: 'Speed Reading for Robots', unlocks: ['Reads standing at the bookshelf: takes the book, opens and closes it, puts it back', 'Learns what is in every book much faster', 'If the book is forgotten, this fades slowly (about 5 minutes)'] },
  'dance.moves': { name: 'Dance moves', book: 'Dance Moves for Robots', unlocks: ['The twist, the shuffle and a twirl, in time with the music'] },
  'dance.ballroom': { name: 'Waltz & swing', book: 'Waltz & Swing', unlocks: ['A turning waltz and a bouncy swing, in time with the music'] },
  drums: { name: 'Drums', book: 'Drumming for Robots', unlocks: ['Sit at the kit and keep a steady beat', 'Before this he can only bang on it'] },
  'drums.solo': { name: 'Drum solos', book: 'Fills & Solos', unlocks: ['Fills round the toms, cymbal crashes and solos'] },
  'drums.band': { name: 'Drumming in the band', book: 'Playing in the Band', unlocks: ['Drum along with whatever the stereo is playing'] },
  easel: { name: 'Painting', book: 'Painting for Robots', unlocks: ['Paint on the easel with a brush', 'Before this he can only scribble with a finger'] },
  'easel.colour': { name: 'Colour mixing', book: 'Colour Mixing', unlocks: ['Mix colours on a palette before painting'] },
  'easel.portrait': { name: 'Portraits & landscapes', book: 'Portraits & Landscapes', unlocks: ['Paint recognisable pictures, then step back to admire them'] },
  decorate: { name: 'Decorating', book: 'Home Decorating for Robots', unlocks: ['Dust the picture frames, wall lights and window sills', 'Before this he only tends the plants'] },
  telescope: { name: 'Stargazing', book: 'Stargazing for Robots', unlocks: ['Aim the telescope and look through the right end', 'Before this he looks in the wrong end'] },
  'telescope.dark': { name: 'Dark-sky stargazing', book: 'Dark Sky Rules', unlocks: ['Switch the lamp off first for a better view'] },
  'telescope.care': { name: 'Telescope care', book: 'Looking After Your Telescope', unlocks: ['Wipe the lens and tube, check the tripod'] },
};

const KEY = 'guy.skills.v1';
const FADE_KEY = 'guy.skills.fade.v1';
// How long a forgotten skill takes to fade away completely (seconds of game time). Speed reading is slow to go.
// The advanced books of each instrument: a player who has read any of them keeps time with the music or with the other player
// (Brain.tempoToFollow). With only the basic book the beat is her own. Every instrument that plays on a beat needs an entry.
export const TIMING_SKILLS = { drums: ['drums.solo', 'drums.band'], piano: ['piano.advanced'], guitar: [] };

export const FADE_SECONDS = { default: 150, speedreading: 300 };

export class Skills {
  /** `initial`: 'all' | 'none' | comma separated ids | null (restore what he learned last time) */
  // `keys`: where it is saved ({ known, fade }); GAL has her own
  constructor(initial = null, keys = null) {
    this.keys = keys || { known: KEY, fade: FADE_KEY };
    this.known = new Set();
    this.fading = new Map();     // skill id -> strength left (1 = fully remembered ... 0 = gone); only skills whose book was forgotten
    this.listeners = [];
    this.lostListeners = [];
    this._since = 0;
    if (initial === 'all') Object.keys(SKILL_INFO).forEach((k) => this.known.add(k));
    else if (initial === 'none') { /* start from scratch */ }
    else if (initial) initial.split(',').forEach((k) => this.known.add(k.trim()));
    else {
      try { (JSON.parse(localStorage.getItem(this.keys.known)) || []).forEach((k) => this.known.add(k)); } catch { /* no storage */ }
      try { Object.entries(JSON.parse(localStorage.getItem(this.keys.fade)) || {}).forEach(([k, v]) => { if (this.known.has(k)) this.fading.set(k, v); }); } catch { /* no storage */ }
    }
    this.persist = initial === null;
  }

  has(id) { return this.known.has(id); }

  /** 1 = fully known, between 0 and 1 while it is being forgotten, 0 = not known */
  strength(id) { return this.known.has(id) ? (this.fading.has(id) ? this.fading.get(id) : 1) : 0; }

  save() {
    if (!this.persist) return;
    try {
      localStorage.setItem(this.keys.known, JSON.stringify([...this.known]));
      localStorage.setItem(this.keys.fade, JSON.stringify(Object.fromEntries(this.fading)));
    } catch { /* no storage */ }
  }

  /** The book was forgotten: the lessons start to fade. Returns false if he did not know it. */
  forget(id) {
    if (!this.known.has(id)) return false;
    if (!this.fading.has(id)) this.fading.set(id, 1);
    this.save();
    this.listeners.forEach((f) => f(id));
    return true;
  }

  /** Called every frame with the time passed: forgotten skills lose strength, and disappear at zero. */
  tick(dt) {
    if (!this.fading.size) return;
    const lost = [];
    for (const [id, s] of this.fading) {
      const left = s - dt / (FADE_SECONDS[id] || FADE_SECONDS.default);
      if (left <= 0) lost.push(id); else this.fading.set(id, left);
    }
    for (const id of lost) { this.fading.delete(id); this.known.delete(id); }
    this._since += dt;
    if (lost.length || this._since > 5) { this._since = 0; this.save(); }
    if (lost.length) { this.listeners.forEach((f) => f(lost[0])); this.lostListeners.forEach((f) => f(lost)); }
    this._ui = (this._ui || 0) + dt;
    if (this._ui > 2) { this._ui = 0; this.listeners.forEach((f) => f(null)); }     // keeps the skills panel's fading bars moving
  }

  onLose(fn) { this.lostListeners.push(fn); }

  /** returns true if this was new */
  learn(id) {
    if (this.known.has(id)) {
      if (!this.fading.has(id)) return false;
      this.fading.delete(id);                // read again while it was fading: remembered in full
      this.save();
      this.listeners.forEach((f) => f(id));
      return true;
    }
    this.known.add(id);
    this.save();
    this.listeners.forEach((f) => f(id));
    return true;
  }

  onChange(fn) { this.listeners.push(fn); }
}
