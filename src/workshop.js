// What Guy can build in the Workshop, and the numbers behind it. Data only: the objects are in workobjects.js, what he does in
// workbrain.js, and where finished things are counted (storage) in room.js (`world.stock`).
//
// Materials: the Wood Factory makes PLANKS_PER_RUN planks at a time. A plank is sawn into PARTS_PER_PLANK parts. A recipe takes
// `parts` parts, a number of taps with the rubber mallet to knock them together, and (if `sand`) a turn on the sander.
// A recipe is unlocked by reading its book (`skill` is what the book teaches). `object` is what the finished thing is called in the
// Catalogue (it goes into storage and is added to the room from there).
export const PLANKS_PER_RUN = 4;
export const PARTS_PER_PLANK = 2;
export const STOCK_CAP = 40;
export const STORAGE_CAP = 99;

export const RECIPES = {
  footstool: { name: 'Wooden Foot Stool', icon: '🪜', skill: 'workshop', parts: 4, taps: 8, sand: false, object: 'footstool' },
  woodshelves: { name: 'Wooden Shelves', icon: '🗄️', skill: 'workshop.materials', parts: 6, taps: 10, sand: true, object: 'woodshelves' },
  chair: { name: 'Wooden Chair', icon: '🪑', skill: 'workshop.furniture', parts: 8, taps: 12, sand: true, object: 'builtchair' },
};

// planks still to fetch from the factory and saw to have `parts` parts for a recipe, given the stock
export const planksNeeded = (recipe, parts) => Math.max(0, Math.ceil((recipe.parts - parts) / PARTS_PER_PLANK));
