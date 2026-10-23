// What Guy (and GAL) can build in the Workshop, and the numbers behind it. Data only: the objects are in workobjects.js, what they do
// in workbrain.js, when something is worth building in needs.js, and where finished things are counted (storage) in room.js
// (`world.stock`).
//
// Wood line: the Wood Factory makes PLANKS_PER_RUN planks at a time. A plank is sawn into PARTS_PER_PLANK parts. A recipe takes `parts`
// parts, a number of taps with the rubber mallet to knock them together, and (if `sand`) a turn on the sander.
// Metal line: the Metal Factory makes METAL_PER_RUN bars at a time. A bar is cut into MPARTS_PER_BAR parts at the metal cutter. A recipe's
// `metal` takes `parts` metal parts, a number of `welds` at the welder and `bangs` with the hammer on the anvil.
// A recipe that has both (an electric guitar) makes the metal hardware first, then the wooden body, and fits the two at the bench.
// A recipe is unlocked by reading its book (`skill` is what the book teaches; a list means all of them). `object` is what the finished
// thing is called (it stands in the Workshop at once; storage holds it if there is no room).
// `serves` says what it is for (needs.js builds one only when that is wanted); `to` is the room it ends up in.
export const PLANKS_PER_RUN = 4;
export const PARTS_PER_PLANK = 2;
export const STOCK_CAP = 40;
export const STORAGE_CAP = 99;
export const METAL_PER_RUN = 4;
export const MPARTS_PER_BAR = 2;
export const METAL_CAP = 16;           // bars in stock at most (the bench only has so much room)

// `cap`: how many of a thing Guy will have made at most (standing in a room or in storage). He builds up to it and then stops
// making that one, so the Workshop does not fill with things nobody needs; take one away (the user can delete it) and he may make another.
export const RECIPES = {
  footstool: { name: 'Wooden Foot Stool', icon: '🪜', skill: 'workshop', parts: 4, taps: 8, sand: false, object: 'footstool', cap: 1, serves: 'reach' },
  builtchair: { name: 'Wooden Chair', icon: '🪑', skill: 'workshop.furniture', parts: 8, taps: 12, sand: true, object: 'builtchair', cap: 3, serves: 'seat' },
  bookshelf2: { name: 'Bookshelf', icon: '📚', skill: ['workshop.materials', 'workshop.furniture'], parts: 12, taps: 14, sand: true, object: 'bookshelf2', cap: 1, serves: 'books' },
  diningtable3: { name: 'Wooden Dining Table', icon: '🍽️', skill: ['workshop.materials', 'workshop.furniture'], parts: 10, taps: 12, sand: true, object: 'diningtable3', cap: 2, serves: 'diners', to: 'restaurant' },
  metalchair: { name: 'Metal Chair', icon: '🪑', skill: 'workshop.metal', parts: 0, taps: 0, sand: false, metal: { parts: 6, welds: 3, bangs: 6 }, object: 'metalchair', cap: 3, serves: 'seat' },
  diningtable4: { name: 'Metal Dining Table', icon: '🍽️', skill: 'workshop.metal', parts: 0, taps: 0, sand: false, metal: { parts: 8, welds: 4, bangs: 8 }, object: 'diningtable4', cap: 2, serves: 'diners', to: 'restaurant' },
  eguitar: { name: 'Electric Guitar', icon: '🎸', skill: ['workshop.metal', 'workshop.materials'], parts: 4, taps: 6, sand: true, metal: { parts: 3, welds: 2, bangs: 4 }, object: 'eguitar', cap: 1, serves: 'band' },
};
// older saves may hold these: they are still shown and can be put back, but nothing builds them any more
export const LEGACY_KINDS = ['woodshelves'];

export const skillsOf = (r) => (Array.isArray(r.skill) ? r.skill : [r.skill]);
export const hasMetal = (r) => !!r.metal;

// planks still to fetch from the factory and saw to have `parts` parts for a recipe, given the stock
export const planksNeeded = (recipe, parts) => Math.max(0, Math.ceil(((recipe.parts || 0) - parts) / PARTS_PER_PLANK));
// bars still to fetch from the Metal Factory and cut to have `mparts` metal parts for a recipe
export const barsNeeded = (recipe, mparts) => (recipe.metal ? Math.max(0, Math.ceil((recipe.metal.parts - mparts) / MPARTS_PER_BAR)) : 0);
