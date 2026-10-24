// What Guy (and GAL) can build in the Workshop, and the numbers behind it. Data only: the objects are in workobjects.js, what they do
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
export const FACTORY = { wood: 'woodfactory', metal: 'metalfactory' };

// `cap`: how many of a thing Guy will have made at most (standing in a room or in storage). He builds up to it and then stops
// making that one, so the Workshop does not fill with things nobody needs; take one away (the user can delete it) and he may make another.
export const RECIPES = {
  footstool: { name: 'Wooden Foot Stool', icon: '🪜', skill: 'workshop', line: 'wood', run: 3.4, object: 'footstool', cap: 1, serves: 'reach' },
  builtchair: { name: 'Wooden Chair', icon: '🪑', skill: 'workshop.furniture', line: 'wood', run: 4.2, object: 'builtchair', cap: 3, serves: 'seat' },
  bookshelf2: { name: 'Bookshelf', icon: '📚', skill: ['workshop.materials', 'workshop.furniture'], line: 'wood', run: 5.4, object: 'bookshelf2', cap: 1, serves: 'books' },
  diningtable3: { name: 'Wooden Dining Table', icon: '🍽️', skill: ['workshop.materials', 'workshop.furniture'], line: 'wood', run: 4.6, object: 'diningtable3', cap: 2, serves: 'diners', to: 'restaurant' },
  metalchair: { name: 'Metal Chair', icon: '🪑', skill: 'workshop.metal', line: 'metal', run: 4.4, object: 'metalchair', cap: 3, serves: 'seat' },
  diningtable4: { name: 'Metal Dining Table', icon: '🍽️', skill: 'workshop.metal', line: 'metal', run: 5.0, object: 'diningtable4', cap: 2, serves: 'diners', to: 'restaurant' },
  eguitar: { name: 'Electric Guitar', icon: '🎸', skill: ['workshop.metal', 'workshop.materials'], line: 'both', run: 3.6, object: 'eguitar', cap: 1, serves: 'band' },
};
// older saves may hold these: they are still shown and can be put back, but nothing builds them any more
export const LEGACY_KINDS = ['woodshelves'];

export const skillsOf = (r) => (Array.isArray(r.skill) ? r.skill : [r.skill]);
// the factories a recipe runs, in the order they run
export const factoriesOf = (r) => (r.line === 'both' ? [FACTORY.metal, FACTORY.wood] : [FACTORY[r.line]]);
