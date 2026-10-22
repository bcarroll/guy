// Guy's skills. He learns them by reading the books on the shelf; activities check what he knows before he tries them.
//
// To add a skill later (e.g. when the user adds an object with its own manual): add a BOOK_DEFS entry and a SKILL_INFO entry,
// put the book on the shelf with world.objects.shelf.addBook(def), and gate the activity in Brain.available().

// Every book that exists. `start` ones are on the shelf from the beginning; the rest are added from the Skill Machine.
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
  { id: 'woodwork', title: 'Woodworking for Robots', locked: true, requires: { object: 'workbench' }, desc: 'Build furniture from planks and nails (needs a workbench, tools and materials).' },
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
  'dance.moves': { name: 'Dance moves', book: 'Dance Moves for Robots', unlocks: ['The twist, the shuffle and a twirl, in time with the music'] },
  'dance.ballroom': { name: 'Waltz & swing', book: 'Waltz & Swing', unlocks: ['A turning waltz and a bouncy swing, in time with the music'] },
  drums: { name: 'Drums', book: 'Drumming for Robots', unlocks: ['Sit at the kit and keep a steady beat', 'Before this he can only bang on it'] },
  'drums.solo': { name: 'Drum solos', book: 'Fills & Solos', unlocks: ['Fills round the toms, cymbal crashes and solos'] },
  'drums.band': { name: 'Drumming in the band', book: 'Playing in the Band', unlocks: ['Drum along with whatever the stereo is playing'] },
  easel: { name: 'Painting', book: 'Painting for Robots', unlocks: ['Paint on the easel with a brush', 'Before this he can only scribble with a finger'] },
  'easel.colour': { name: 'Colour mixing', book: 'Colour Mixing', unlocks: ['Mix colours on a palette before painting'] },
  'easel.portrait': { name: 'Portraits & landscapes', book: 'Portraits & Landscapes', unlocks: ['Paint recognisable pictures, then step back to admire them'] },
  telescope: { name: 'Stargazing', book: 'Stargazing for Robots', unlocks: ['Aim the telescope and look through the right end', 'Before this he looks in the wrong end'] },
  'telescope.dark': { name: 'Dark-sky stargazing', book: 'Dark Sky Rules', unlocks: ['Switch the lamp off first for a better view'] },
  'telescope.care': { name: 'Telescope care', book: 'Looking After Your Telescope', unlocks: ['Wipe the lens and tube, check the tripod'] },
};

const KEY = 'guy.skills.v1';

export class Skills {
  /** `initial`: 'all' | 'none' | comma separated ids | null (restore what he learned last time) */
  constructor(initial = null) {
    this.known = new Set();
    this.listeners = [];
    if (initial === 'all') Object.keys(SKILL_INFO).forEach((k) => this.known.add(k));
    else if (initial === 'none') { /* start from scratch */ }
    else if (initial) initial.split(',').forEach((k) => this.known.add(k.trim()));
    else {
      try { (JSON.parse(localStorage.getItem(KEY)) || []).forEach((k) => this.known.add(k)); } catch { /* no storage */ }
    }
    this.persist = initial === null;
  }

  has(id) { return this.known.has(id); }

  /** returns true if this was new */
  learn(id) {
    if (this.known.has(id)) return false;
    this.known.add(id);
    if (this.persist) { try { localStorage.setItem(KEY, JSON.stringify([...this.known])); } catch { /* no storage */ } }
    this.listeners.forEach((f) => f(id));
    return true;
  }

  onChange(fn) { this.listeners.push(fn); }
}
