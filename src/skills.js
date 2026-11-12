// GUY's skills. He learns them by reading the books on the shelf; activities check what he knows before he tries them.
//
// To add a skill later (e.g. when the user adds an object with its own manual): add a BOOK_DEFS entry and a SKILL_INFO entry,
// put the book on the shelf with world.objects.shelf.addBook(def), and gate the activity in Brain.available().

// Every book that exists. `start` ones are on the shelf from the beginning; the rest are added from the Catalog.
// requires: the object the book is about (the Catalog still lists it; the book can be added and read before that object is in the room); locked: a future premium item.
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
    blurb: 'how to play along with the music', requires: { anyObject: ['piano', 'guitar', 'drums'] }, desc: 'Keep time with whatever is on the stereo. Comes with any instrument.' },
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
  // The Backyard (a room added from the Rooms tab). "Outdoor Sports" comes with the lawn chair; reading it unlocks the other two
  // (`unlockedBy`: they cannot go on the shelf until GUY or GAL knows that skill).
  { id: 'outdoor', title: 'Outdoor Sports', teaches: 'outdoor', color: 0x3a8a3a, thick: 0.05, height: 0.3, room: 'backyard',
    blurb: 'how to warm up and play outside', desc: 'Warming up, fair play and how to throw and kick. Unlocks the soccer and basketball books.' },
  { id: 'soccer', title: 'Soccer for Robots', teaches: 'outdoor.soccer', color: 0xf2f2f2, thick: 0.055, height: 0.31, room: 'backyard', unlockedBy: 'outdoor',
    blurb: 'shots at the goal and ball handling', requires: { object: 'soccergoal' }, desc: 'Lining up a shot, striking the ball into the goal, and tossing it up and catching it.' },
  { id: 'basketball', title: 'Basketball for Robots', teaches: 'outdoor.basketball', color: 0xd9741d, thick: 0.055, height: 0.31, room: 'backyard', unlockedBy: 'outdoor',
    blurb: 'dribbling and shooting hoops', requires: { object: 'basketballhoop' }, desc: 'Dribbling, and the set shot: bend the knees, lift the ball and let it go towards the hoop.' },
  // Fictional blasters for the Shooting Range. Reading one lets GUY (or GAL) use that blaster in the range only; it cannot be taken out.
  { id: 'pulsepistol', title: 'Pulse Pistol Handbook', teaches: 'range.pistol', color: 0x3c6e8f, thick: 0.05, height: 0.3,
    blurb: 'a fictional pulse pistol for the range', desc: 'A fictional sidearm for the Shooting Range: quick, light pulses, one at a time.' },
  { id: 'arcrifle', title: 'Arc Carbine Field Guide', teaches: 'range.carbine', color: 0x5a3c8f, thick: 0.06, height: 0.32,
    blurb: 'a fictional arc carbine for the range', desc: 'A fictional long gun for the Shooting Range: a steadier aim and a longer hold before each shot.' },
  // The Bowling Alley (listed only once the alley has been added). Without it the robots bowl wildly; with it they are steadier.
  { id: 'bowling', title: 'Bowling for Robots', teaches: 'bowling', color: 0x8e24aa, thick: 0.06, height: 0.31, room: 'bowling',
    blurb: 'how to roll a ball down a lane', desc: 'The approach, the release, and keeping score. A reader bowls steadier; later chapters teach a hook ball and spare shooting.' },
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
    unlocks: ['Build a bookshelf and wooden dining tables at the Wood Factory', 'Make the wooden body of an electric guitar', 'Chapters 4 and 5: maple bowling pins and a wooden bowling ball for the Bowling Alley'],
  },
  'workshop.furniture': {
    name: 'Furniture for Robots', book: 'Furniture for Robots',
    unlocks: ['Build wooden chairs, a bookshelf and a dining table when the house needs them', 'Wooden chairs then appear in the Catalog'],
  },
  'workshop.metal': {
    name: 'Metal Fabrication', book: 'Metal Fabrication for Robots',
    unlocks: ['Build metal chairs and tables at the Metal Factory', 'Build an electric guitar (with the Wood Factory)'],
  },
  outdoor: {
    name: 'Outdoor sports', book: 'Outdoor Sports',
    unlocks: ['Unlocks the soccer and basketball books in the Catalog', 'Before the sports books he can only poke a ball about the yard'],
  },
  'outdoor.soccer': {
    name: 'Soccer', book: 'Soccer for Robots',
    unlocks: ['Take shots at the goal (some go in)', 'Toss the soccer ball up and catch it'],
  },
  'outdoor.basketball': {
    name: 'Basketball', book: 'Basketball for Robots',
    unlocks: ['Dribble the basketball', 'Shoot at the hoop with a proper set shot (some go in)'],
  },
  bowling: {
    name: 'Bowling', book: 'Bowling for Robots',
    unlocks: ['Steadier aim at the Bowling Alley', 'Chapter 2: a hook ball. Chapter 3: aims at the pins that are left (spares)'],
  },
  'range.pistol': {
    name: 'Pulse pistol', book: 'Pulse Pistol Handbook',
    unlocks: ['Shoot the pulse pistol at the Shooting Range (range only)'],
  },
  'range.carbine': {
    name: 'Arc carbine', book: 'Arc Carbine Field Guide',
    unlocks: ['Shoot the arc carbine at the Shooting Range (range only)'],
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

// ---- Chapters --------------------------------------------------------------------------------------------------------
// A book's first reading teaches its skill (chapter 1). Later chapters are not read: they are learned by PRACTICE. Every time a
// robot sets out to do one of the activities in PRACTICE_ACTS[skill] with that skill known, the practice count of the skill goes
// up by one, and when it reaches a chapter's `after` the chapter is learned (in order: chapter 3 never comes before chapter 2).
// A chapter is a skill of its own, `<skill>.ch<N>`; the code that plays a tune or a beat asks for it with skills.has(id), and
// the Skills panel lists them under their book. Forgetting a book fades its chapters with it. To add one: an entry here, content
// gated on its id (songs.js MAKERS, strum.js, hobbies.js DRUM_STYLES), and a MANIFEST.chapters line in devtools.js.
export const CHAPTERS = {
  piano: [
    { id: 'piano.ch2', title: 'Chapter 2: Hands Together', after: 3, unlocks: ['Mary Had a Little Lamb, Row Row Row Your Boat and When the Saints', 'D major and E minor scales'] },
    { id: 'piano.ch3', title: 'Chapter 3: Folk Songs & Hymns', after: 8, unlocks: ['Amazing Grace and Greensleeves', 'F major and C blues scales'] },
  ],
  'piano.advanced': [
    { id: 'piano.advanced.ch2', title: 'Chapter 2: Baroque & Classical', after: 3, unlocks: ['A minuet and a canon', 'A flowing prelude of broken chords'] },
    { id: 'piano.advanced.ch3', title: 'Chapter 3: Ragtime & Lullabies', after: 7, unlocks: ['A bouncy ragtime with a stride left hand', 'A cradle song'] },
  ],
  guitar: [
    { id: 'guitar.ch2', title: 'Chapter 2: Strumming Patterns', after: 3, unlocks: ['Three new strumming and picking patterns'] },
    { id: 'guitar.ch3', title: 'Chapter 3: Colourful Chords', after: 8, unlocks: ['Songs with minor-seventh, major-seventh and suspended chords', 'A gospel tune and a ballad'] },
  ],
  drums: [
    { id: 'drums.ch2', title: 'Chapter 2: Grooves', after: 3, unlocks: ['Reggae one-drop and funk grooves'] },
    { id: 'drums.ch3', title: 'Chapter 3: Rudiments', after: 8, unlocks: ['Paradiddles round the snare and toms'] },
  ],
  'drums.solo': [
    { id: 'drums.solo.ch2', title: 'Chapter 2: Showing Off', after: 3, unlocks: ['Longer solos: tom cascades, rolls and a big finish'] },
    { id: 'drums.solo.ch3', title: 'Chapter 3: Trick Sticks', after: 7, unlocks: ['Crossovers, flams and a rapid-fire roll to finish'] },
  ],
  'drums.band': [
    { id: 'drums.band.ch2', title: 'Chapter 2: Fills', after: 3, unlocks: ['A tom fill at the end of every fourth bar when drumming along'] },
    { id: 'drums.band.ch3', title: 'Chapter 3: Verse & Chorus', after: 8, unlocks: ['Ride cymbal and a crash when the chorus comes in'] },
  ],
  'dance.moves': [
    { id: 'dance.moves.ch2', title: 'Chapter 2: Disco Fever', after: 3, unlocks: ['The sprinkler and the moonwalk'] },
    { id: 'dance.moves.ch3', title: 'Chapter 3: Freestyle', after: 8, unlocks: ['Headbanging and an arm wave'] },
  ],
  'dance.ballroom': [
    { id: 'dance.ballroom.ch2', title: 'Chapter 2: Tango & Foxtrot', after: 3, unlocks: ['A sharp, staccato tango and a smooth foxtrot'] },
    { id: 'dance.ballroom.ch3', title: 'Chapter 3: Jive & Dips', after: 8, unlocks: ['A bouncy jive and a deep dip'] },
  ],
  lighting: [
    { id: 'lighting.ch2', title: 'Chapter 2: Colour Schemes', after: 3, unlocks: ['Sunset orange, ocean teal and lavender dusk'] },
    { id: 'lighting.ch3', title: 'Chapter 3: Living Light', after: 8, unlocks: ['Flickering candlelight, a slow rainbow and northern lights'] },
  ],
  easel: [
    { id: 'easel.ch2', title: 'Chapter 2: Brush Techniques', after: 3, unlocks: ['Dabbing paint on, and broad bands of colour'] },
    { id: 'easel.ch3', title: 'Chapter 3: Bold Abstracts', after: 8, unlocks: ['Big swirls and flung splashes of paint'] },
  ],
  'easel.colour': [
    { id: 'easel.colour.ch2', title: 'Chapter 2: Blends', after: 3, unlocks: ['Gradients: one paint blended into another in steps'] },
    { id: 'easel.colour.ch3', title: 'Chapter 3: Tints & Shades', after: 8, unlocks: ['Lightening with white and darkening with black'] },
  ],
  'easel.portrait': [
    { id: 'easel.portrait.ch2', title: 'Chapter 2: Sea & City', after: 3, unlocks: ['Seascapes and city skylines'] },
    { id: 'easel.portrait.ch3', title: 'Chapter 3: Night & Character', after: 8, unlocks: ['Starry night skies and robot portraits'] },
  ],
  decorate: [
    { id: 'decorate.ch2', title: 'Chapter 2: Thorough Dusting', after: 3, unlocks: ['Dusts two pieces in one go'] },
    { id: 'decorate.ch3', title: 'Chapter 3: Spring Clean', after: 7, unlocks: ['Dusts three pieces in one go'] },
  ],
  telescope: [
    { id: 'telescope.ch2', title: 'Chapter 2: Planets & the Moon', after: 3, unlocks: ['Hunts across the sky: swings the tube to a second target'] },
    { id: 'telescope.ch3', title: 'Chapter 3: Deep Sky', after: 7, unlocks: ['A survey of three targets in a night'] },
  ],
  'telescope.dark': [
    { id: 'telescope.dark.ch2', title: 'Chapter 2: Dark Adaptation', after: 3, unlocks: ['Waits for his eyes to adjust before looking'] },
    { id: 'telescope.dark.ch3', title: 'Chapter 3: Night Watch', after: 6, unlocks: ['A long watch at two targets, then a look up at the sky'] },
  ],
  workshop: [
    { id: 'workshop.ch2', title: 'Chapter 2: Tool Care', after: 3, unlocks: ['Sorts the tools in the toolbox, two more picked out and put back'] },
    { id: 'workshop.ch3', title: 'Chapter 3: Safety First', after: 8, unlocks: ['Looks round before starting a factory'] },
  ],
  'workshop.materials': [
    { id: 'workshop.materials.ch2', title: 'Chapter 2: Joints and Glue', after: 3, unlocks: ['Looks the wooden piece over on the tray before taking it'] },
    { id: 'workshop.materials.ch3', title: 'Chapter 3: Sanding and Finishing', after: 8, unlocks: ['Sands the wooden piece smooth before taking it'] },
    { id: 'workshop.materials.ch4', title: 'Chapter 4: Turning Bowling Pins', after: 9, unlocks: ['Turns ten maple bowling pins at the Wood Factory for the Bowling Alley (once it has been added)'] },
    { id: 'workshop.materials.ch5', title: 'Chapter 5: The Wooden Ball', after: 10, unlocks: ['Makes a wooden bowling ball for the alley rack'] },
  ],
  bowling: [
    { id: 'bowling.ch2', title: 'Chapter 2: The Hook', after: 4, unlocks: ['Puts a hook on the ball so it curves into the pocket'] },
    { id: 'bowling.ch3', title: 'Chapter 3: Spare Shooting', after: 9, unlocks: ['Aims at the pins left standing for a spare'] },
  ],
  'workshop.furniture': [
    { id: 'workshop.furniture.ch2', title: 'Chapter 2: Comfortable Chairs', after: 3, unlocks: ['Presses down on the new chair or table to test it'] },
    { id: 'workshop.furniture.ch3', title: 'Chapter 3: Matching Sets', after: 7, unlocks: ['Builds one more wooden chair and table for the house'] },
  ],
  'workshop.metal': [
    { id: 'workshop.metal.ch2', title: 'Chapter 2: Ringing True', after: 3, unlocks: ['Knocks twice on the metal piece to hear that it is sound'] },
    { id: 'workshop.metal.ch3', title: 'Chapter 3: Matching Sets', after: 7, unlocks: ['Builds one more metal chair and table for the house'] },
  ],
  ball: [
    { id: 'ball.ch2', title: 'Chapter 2: Keep It Going', after: 3, unlocks: ['A twice-as-long dribble and two tosses in a row'] },
    { id: 'ball.ch3', title: 'Chapter 3: Trick Shots', after: 8, unlocks: ['Three kicks in a row, a dribble that ends in a toss, and three tosses'] },
  ],
  outdoor: [
    { id: 'outdoor.ch2', title: 'Chapter 2: Warm-Ups', after: 3, unlocks: ['Arm circles and a twist before a game in the yard'] },
    { id: 'outdoor.ch3', title: 'Chapter 3: Cool Down', after: 8, unlocks: ['Folds forward and breathes slowly after a game'] },
  ],
  'outdoor.soccer': [
    { id: 'outdoor.soccer.ch2', title: 'Chapter 2: Penalty Practice', after: 3, unlocks: ['Two more, straighter shots at the goal'] },
    { id: 'outdoor.soccer.ch3', title: 'Chapter 3: Keepy-Uppy', after: 8, unlocks: ['Tosses the soccer ball up three times in a row'] },
  ],
  'outdoor.basketball': [
    { id: 'outdoor.basketball.ch2', title: 'Chapter 2: Free Throws', after: 3, unlocks: ['Two more, better shots at the hoop'] },
    { id: 'outdoor.basketball.ch3', title: 'Chapter 3: Ball Handling', after: 7, unlocks: ['A longer dribble that finishes with a toss'] },
  ],
  'telescope.care': [
    { id: 'telescope.care.ch2', title: 'Chapter 2: Levelling the Tube', after: 3, unlocks: ['Swings the tube level when he has finished'] },
    { id: 'telescope.care.ch3', title: 'Chapter 3: Deep Clean', after: 6, unlocks: ['A second round of wiping and checking'] },
  ],
};
// the activities that count as a practice session for a skill's chapters
const PIANO_ACTS = ['piano', 'sitpiano', 'jam', 'jampiano', 'jamsit'];
export const PRACTICE_ACTS = {
  piano: PIANO_ACTS, 'piano.advanced': PIANO_ACTS,
  guitar: ['guitar', 'sitguitar', 'riff', 'jamguitar'],
  drums: ['drums', 'jamdrums'], 'drums.solo': ['drumsolo'], 'drums.band': ['jamdrums'],
  'dance.moves': ['dancemoves'], 'dance.ballroom': ['ballroom'], lighting: ['mood'],
  easel: ['paint'], 'easel.colour': ['mixpaint'], 'easel.portrait': ['portrait'], decorate: ['dust'],
  workshop: ['tidytools', 'build'], 'workshop.materials': ['build'], 'workshop.furniture': ['build'], 'workshop.metal': ['build'],
  ball: ['ball', 'dribble', 'toss'], outdoor: ['goalshot', 'soccertoss', 'hoopshoot', 'hoopdribble'], 'outdoor.soccer': ['goalshot', 'soccertoss'], 'outdoor.basketball': ['hoopshoot', 'hoopdribble'],
  bowling: ['bowl'],
  telescope: ['stargaze'], 'telescope.dark': ['darkstargaze'], 'telescope.care': ['scopecare'],
};
export const CHAPTER_IDS = Object.values(CHAPTERS).flat().map((c) => c.id);
const chaptersOf = (id) => (CHAPTERS[id] || []).map((c) => c.id);

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
    this.keys = { ...(keys || { known: KEY, fade: FADE_KEY }) };
    this.keys.practice ||= this.keys.known + '.practice';
    this.practiced = new Map();     // skill id -> practice sessions so far (see CHAPTERS)
    this.chapterListeners = [];
    this.known = new Set();
    this.fading = new Map();     // skill id -> strength left (1 = fully remembered ... 0 = gone); only skills whose book was forgotten
    this.listeners = [];
    this.lostListeners = [];
    this._since = 0;
    if (initial === 'all') [...Object.keys(SKILL_INFO), ...CHAPTER_IDS].forEach((k) => this.known.add(k));
    else if (initial === 'none') { /* start from scratch */ }
    else if (initial) initial.split(',').forEach((k) => this.known.add(k.trim()));
    else {
      try { (JSON.parse(localStorage.getItem(this.keys.known)) || []).forEach((k) => this.known.add(k)); } catch { /* no storage */ }
      try { Object.entries(JSON.parse(localStorage.getItem(this.keys.fade)) || {}).forEach(([k, v]) => { if (this.known.has(k)) this.fading.set(k, v); }); } catch { /* no storage */ }
      try { Object.entries(JSON.parse(localStorage.getItem(this.keys.practice)) || {}).forEach(([k, v]) => { if (Number.isFinite(v)) this.practiced.set(k, v); }); } catch { /* no storage */ }
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
      localStorage.setItem(this.keys.practice, JSON.stringify(Object.fromEntries(this.practiced)));
    } catch { /* no storage */ }
  }

  /** The book was forgotten: the lessons start to fade. Returns false if he did not know it. */
  forget(id) {
    if (!this.known.has(id)) return false;
    for (const k of [id, ...chaptersOf(id)]) if (this.known.has(k) && !this.fading.has(k)) this.fading.set(k, 1);     // (its chapters go with it)
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
    for (const id of lost) { this.fading.delete(id); this.known.delete(id); this.practiced.delete(id); }
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
      chaptersOf(id).forEach((k) => this.fading.delete(k));
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
  onChapter(fn) { this.chapterListeners.push(fn); }

  /** One practice session of activity `act` has begun. Counts for every skill known (and not being forgotten) that lists it, and
   *  learns the next chapter when the count gets there. Returns the chapters learned just now. */
  practice(act) {
    const got = [];
    for (const [skill, acts] of Object.entries(PRACTICE_ACTS)) {
      if (!acts.includes(act) || !this.known.has(skill) || this.fading.has(skill)) continue;
      const n = (this.practiced.get(skill) || 0) + 1;
      this.practiced.set(skill, n);
      const next = (CHAPTERS[skill] || []).find((c) => !this.known.has(c.id));
      if (next && n >= next.after) { this.known.add(next.id); got.push(next); }
    }
    this.save();
    if (got.length) this.listeners.forEach((f) => f(got[0].id));
    got.forEach((c) => this.chapterListeners.forEach((f) => f(c)));
    return got;
  }

  /** How far the next chapter of `skill` is: { next, done, of } (null when every chapter is learned or the skill is not known). */
  progress(skill) {
    if (!this.known.has(skill)) return null;
    const next = (CHAPTERS[skill] || []).find((c) => !this.known.has(c.id));
    return next ? { next, done: Math.min(this.practiced.get(skill) || 0, next.after), of: next.after } : null;
  }
}
