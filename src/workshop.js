// What GUY (and GAL) can build in the Workshop, and the numbers behind it. Data only: the objects are in workobjects.js, what they do
// in workbrain.js, when something is worth building in needs.js, and where finished things are counted (storage) in room.js
// (`world.stock.items`).
//
// The factories do all the building on their own: a thing is made by pressing the button on the Wood Factory (wooden things) or the
// Metal Factory (metal things), waiting while it runs, and taking the finished thing off the tray. Nothing else is needed in the
// Workshop. A recipe that needs both lines (an electric guitar) runs the Metal Factory first, for the hardware, and takes it to the
// Wood Factory, which makes the body and fits the two together.
// A recipe is unlocked by reading its book (`skill` is what the book teaches; a list means all of them). `line` is which factory makes
// it ('wood', 'metal', or 'both'), `run` how many seconds a factory runs for it. `object` is what the finished thing is called (it
// stands in the Workshop at once; storage holds it if there is no room).
// `serves` says what it is for (needs.js builds one only when that is wanted); `to` is the room it ends up in.
export const STORAGE_CAP = 99;

// the object that makes each line
// (the Build a Bot machine is the third: once GAL has been printed it stays in the Workshop and prints things from other materials: line 'bot')
export const FACTORY = { wood: 'woodfactory', metal: 'metalfactory', bot: 'botprinter' };

// What the Build a Bot machine prints from, for each recipe of line 'bot' (`material`: one or several; several are a combination)
export const MATERIALS = { rubber: { name: 'rubber', color: 0xff9a3c }, glass: { name: 'glass', color: 0x9fe8ff }, plastic: { name: 'plastic', color: 0xff5fd0 }, metal: { name: 'metal', color: 0xffe08a } };

// `cap`: how many of a thing GUY will have made at most (standing in a room or in storage). He builds up to it and then stops
// making that one, so the Workshop does not fill with things nobody needs; take one away (the user can delete it) and he may make another.
export const RECIPES = {
  footstool: { name: 'Wooden Foot Stool', icon: '🪜', skill: 'workshop', line: 'wood', run: 3.4, object: 'footstool', cap: 1, serves: 'reach' },
  builtchair: { name: 'Wooden Chair', icon: '🪑', skill: 'workshop.furniture', line: 'wood', run: 4.2, object: 'builtchair', cap: 3, serves: 'seat' },
  bookshelf2: { name: 'Bookshelf', icon: '📚', skill: ['workshop.materials', 'workshop.furniture'], line: 'wood', run: 5.4, object: 'bookshelf2', cap: 1, serves: 'books' },
  diningtable3: { name: 'Wooden Dining Table', icon: '🍽️', skill: ['workshop.materials', 'workshop.furniture'], line: 'wood', run: 4.6, object: 'diningtable3', cap: 2, serves: 'diners', to: 'restaurant' },
  metalchair: { name: 'Metal Chair', icon: '🪑', skill: 'workshop.metal', line: 'metal', run: 4.4, object: 'metalchair', cap: 3, serves: 'seat' },
  diningtable4: { name: 'Metal Dining Table', icon: '🍽️', skill: 'workshop.metal', line: 'metal', run: 5.0, object: 'diningtable4', cap: 2, serves: 'diners', to: 'restaurant' },
  eguitar: { name: 'Electric Guitar', icon: '🎸', skill: ['workshop.metal', 'workshop.materials'], line: 'both', run: 3.6, object: 'eguitar', cap: 1, serves: 'band' },
  // Bowling Alley equipment (the Wood & Metal Basics book, chapters 4 and 5: pins and a ball turned from maple). They end up in the
  // alley: a set of pins replaces the ten on one of the three lanes (`whole`: carried in its crate, in both hands, not flat-packed).
  bowlingpins: { name: 'Maple Bowling Pins', icon: '🎳', skill: 'workshop.materials.ch4', line: 'wood', run: 5.0, object: 'bowlingpins', cap: 3, serves: 'bowl.pins', to: 'bowling', whole: true },
  bowlingball: { name: 'Wooden Bowling Ball', icon: '🎳', skill: 'workshop.materials.ch5', line: 'wood', run: 4.4, object: 'bowlingball', cap: 1, serves: 'bowl.ball', to: 'bowling' },
  // Furniture for the Bedroom and the Library (wooden, from the furniture books). Wanted once the room has been added and is still empty of it (needs.js); each
  // is carried flat-packed into its room and put together there. The bookshelves are not the skill bookshelf: they are only for the Library.
  bed: { name: 'Bed', icon: '🛏️', skill: ['workshop.materials', 'workshop.furniture'], line: 'wood', run: 5.2, object: 'bed', cap: 1, serves: 'home.bed', to: 'bedroom' },
  wardrobe: { name: 'Wardrobe', icon: '🚪', skill: ['workshop.materials', 'workshop.furniture'], line: 'wood', run: 5.4, object: 'wardrobe', cap: 1, serves: 'home.wardrobe', to: 'bedroom' },
  bedside: { name: 'Bedside Table', icon: '🗄️', skill: 'workshop.furniture', line: 'wood', run: 3.8, object: 'bedside', cap: 1, serves: 'home.bedside', to: 'bedroom' },
  libshelf: { name: 'Library Bookshelf', icon: '📚', skill: ['workshop.materials', 'workshop.furniture'], line: 'wood', run: 5.0, object: 'libshelf', cap: 2, serves: 'home.shelf', to: 'library' },
  readingchair: { name: 'Reading Chair', icon: '🛋️', skill: 'workshop.furniture', line: 'wood', run: 4.4, object: 'readingchair', cap: 1, serves: 'home.readchair', to: 'library' },
  libdesk: { name: 'Reading Desk', icon: '🪔', skill: ['workshop.materials', 'workshop.furniture'], line: 'wood', run: 4.8, object: 'libdesk', cap: 1, serves: 'home.desk', to: 'library' },
  globe: { name: 'Globe', icon: '🌐', skill: 'workshop.furniture', line: 'wood', run: 3.6, object: 'globe', cap: 1, serves: 'home.globe', to: 'library' },
  // Easter eggs: in no book. GUY builds one on his own once everything in `egg` stands in his room (see needs.js), with the basic Workshop book.
  mirrorball: { name: 'Mirror Ball', icon: '🪩', skill: 'workshop', line: 'metal', run: 4.0, object: 'mirrorball', cap: 1, serves: 'egg.mirrorball', egg: ['table', 'drums'] },
  trophy: { name: 'Golden Trophy', icon: '🏆', skill: 'workshop', line: 'metal', run: 4.6, object: 'trophy', cap: 1, serves: 'egg.trophy', egg: ['piano', 'guitar', 'drums'] },
  lavalamp: { name: 'Lava Lamp', icon: '🫧', skill: 'workshop', line: 'both', run: 3.8, object: 'lavalamp', cap: 1, serves: 'egg.lavalamp', egg: ['lamp', 'nightstand', 'coffeetable'] },
  crystalball: { name: 'Crystal Ball', icon: '🔮', skill: 'workshop', line: 'metal', run: 4.2, object: 'crystalball', cap: 1, serves: 'egg.crystalball', egg: ['telescope', 'nightstand'] },
  rubberduck: { name: 'Rubber Duck', icon: '🦆', skill: 'workshop', line: 'wood', run: 3.0, object: 'rubberduck', cap: 1, serves: 'egg.rubberduck', egg: ['plant', 'coffeetable'] },
  gnome: { name: 'Garden Gnome', icon: '🧙', skill: 'workshop', line: 'wood', run: 3.8, object: 'gnome', cap: 1, serves: 'egg.gnome', egg: ['plant', 'armchair', 'easel'] },
  toyrocket: { name: 'Toy Rocket', icon: '🚀', skill: 'workshop', line: 'metal', run: 4.4, object: 'toyrocket', cap: 1, serves: 'egg.toyrocket', egg: ['telescope', 'drums'] },
  arcade: { name: 'Arcade Cabinet', icon: '🕹️', skill: 'workshop', line: 'metal', run: 5.0, object: 'arcade', cap: 1, serves: 'egg.arcade', egg: ['table', 'guitar', 'easel'] },
  piggybank: { name: 'Piggy Bank', icon: '🐷', skill: 'workshop', line: 'wood', run: 3.4, object: 'piggybank', cap: 1, serves: 'egg.piggybank', egg: ['coffeetable', 'nightstand', 'armchair'] },
  grandfatherclock: { name: 'Grandfather Clock', icon: '🕰️', skill: 'workshop', line: 'wood', run: 5.6, object: 'grandfatherclock', cap: 1, serves: 'egg.grandfatherclock', egg: ['piano', 'shelf', 'nightstand'] },
  bubblemachine: { name: 'Bubble Machine', icon: '🫧', skill: 'workshop', line: 'metal', run: 4.0, object: 'bubblemachine', cap: 1, serves: 'egg.bubblemachine', egg: ['lamp', 'drums', 'easel'] },
  snowglobe: { name: 'Snow Globe', icon: '❄️', skill: 'workshop', line: 'both', run: 4.0, object: 'snowglobe', cap: 1, serves: 'egg.snowglobe', egg: ['lamp', 'armchair', 'nightstand'] },
  petrock: { name: 'Pet Rock', icon: '🪨', skill: 'workshop', line: 'wood', run: 2.6, object: 'petrock', cap: 1, serves: 'egg.petrock', egg: ['plant', 'guitar', 'easel'] },
  // The Automatic Pinsetter: an easter egg for the Bowling Alley. In no book: GUY builds it once the Metal Factory stands anywhere in the house
  // and the alley has been added (`eggWhere: 'house'`; it ends up in the alley, `eggRoom`).
  pinsetter: { name: 'Automatic Pinsetter', icon: '🤖', skill: 'workshop', line: 'metal', run: 6.0, object: 'pinsetter', cap: 1, serves: 'egg.pinsetter', egg: ['metalfactory'], eggWhere: 'house', eggRoom: 'bowling', to: 'bowling' },
  // Printed by the Build a Bot machine (line 'bot'): only while it stands in the Workshop (canBuild, needs.js). In no book (the basic Workshop
  // skill is enough). The first four are single-material surprises; the last four are COMBINATIONS: they need other things GUY built
  // (some of them printed here, some from the factories) to be standing in his room, and are printed from several materials.
  fishtank: { name: 'Fish Tank', icon: '🐠', skill: 'workshop', line: 'bot', material: 'glass', run: 4.4, object: 'fishtank', cap: 1, serves: 'egg.fishtank', egg: ['coffeetable'] },
  rubberchicken: { name: 'Rubber Chicken', icon: '🐔', skill: 'workshop', line: 'bot', material: 'rubber', run: 3.2, object: 'rubberchicken', cap: 1, serves: 'egg.rubberchicken', egg: ['nightstand'] },
  flamingo: { name: 'Plastic Flamingo', icon: '🦩', skill: 'workshop', line: 'bot', material: 'plastic', run: 3.4, object: 'flamingo', cap: 1, serves: 'egg.flamingo', egg: ['plant'] },
  neonsign: { name: 'Neon Sign', icon: '💡', skill: 'workshop', line: 'bot', material: ['glass', 'plastic'], run: 4.6, object: 'neonsign', cap: 1, serves: 'egg.neonsign', egg: ['lamp', 'drums'] },
  aquarium: { name: 'Giant Aquarium', icon: '🐟', skill: 'workshop', line: 'bot', material: ['glass', 'rubber'], run: 6.0, object: 'aquarium', cap: 1, serves: 'egg.aquarium', egg: ['fishtank', 'rubberduck'] },
  jukebox: { name: 'Jukebox', icon: '🎶', skill: 'workshop', line: 'bot', material: ['glass', 'plastic', 'metal'], run: 6.4, object: 'jukebox', cap: 1, serves: 'egg.jukebox', egg: ['table', 'mirrorball'] },
  plasmaglobe: { name: 'Plasma Globe', icon: '⚡', skill: 'workshop', line: 'bot', material: ['glass', 'metal'], run: 5.2, object: 'plasmaglobe', cap: 1, serves: 'egg.plasmaglobe', egg: ['crystalball', 'lavalamp'] },
  robopet: { name: 'Robo Pet', icon: '🐕', skill: 'workshop', line: 'bot', material: ['plastic', 'rubber', 'metal'], run: 6.6, object: 'robopet', cap: 1, serves: 'egg.robopet', egg: ['petrock', 'rubberchicken'] },
};
// older saves may hold these: they are still shown and can be put back, but nothing builds them any more
export const LEGACY_KINDS = ['woodshelves'];

export const skillsOf = (r) => (Array.isArray(r.skill) ? r.skill : [r.skill]);
// the factories a recipe runs, in the order they run
export const factoriesOf = (r) => (r.line === 'both' ? [FACTORY.metal, FACTORY.wood] : [FACTORY[r.line]]);
export const materialsOf = (r) => (r.material ? (Array.isArray(r.material) ? r.material : [r.material]) : []);
