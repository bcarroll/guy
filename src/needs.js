// What the house needs built. GUY and GAL only build something in the Workshop when there is a use for it (the owner's rule):
//   seat    there is a chair for everybody who lives here (GUY, and GAL if she is here)
//   reach   a foot stool, so a high window can be cleaned right up to the top
//   books   books are stacked on the floor: another bookshelf
//   diners  customers cannot find a seat at the restaurant: another table and chairs
//   band    a second guitar to play along with (an electric guitar, needs both workshop lines)
//   bowl.pins / bowl.ball  the Bowling Alley has been added: maple pins, a wooden ball (the Wood & Metal book, chapters 4 and 5)
//   egg.<id> an easter egg (RECIPES with `egg`): wanted, last of all, once every object it lists stands in the main room
// `wants(brain)` lists what is missing now, most pressing first: [{ serves, n, why }]. A recipe in workshop.js says which want it
// serves; `supply` counts what already exists or is on its way (built and waiting in the Workshop, or in storage), so nothing is built twice.
import { RECIPES } from './workshop.js';

const kindsServing = (serves) => Object.values(RECIPES).filter((r) => r.serves === serves).map((r) => r.object);

// built things of these kinds: in the room (anywhere), in storage, and being built right now
export function supply(w, serves, room = null) {
  const kinds = kindsServing(serves), st = w.stock;
  let n = kinds.reduce((a, k) => a + (st.items[k] || 0), 0);
  n += Object.values(w.objects).filter((o) => kinds.includes(o.kind) && (!room || w.roomIdAt(o.x, o.z) === room)).length;
  n += (w.building || []).filter((b) => RECIPES[b.recipe] && RECIPES[b.recipe].serves === serves).length;
  return n;
}

export function wants(b) {
  const w = b.w, out = [];
  const gal = w.gal && w.gal.exists() ? w.gal : null;
  const anyone = (skill) => b.skills.has(skill) || !!(gal && gal.brain && gal.brain.skills.has(skill));
  // a seat for everybody
  const chars = 1 + (gal ? 1 : 0);
  const seats = Object.values(w.objects).filter((o) => o.sit && w.roomIdAt(o.x, o.z) === 'main').length;
  const coming = supply(w, 'seat') - Object.values(w.objects).filter((o) => RECIPES[o.kind] && RECIPES[o.kind].serves === 'seat' && w.roomIdAt(o.x, o.z) === 'main').length;   // built, but not in the room yet
  if (seats + coming < chars) out.push({ serves: 'seat', n: chars - seats - coming, why: 'there is no chair for everyone' });
  // the top of a window is out of reach standing on the floor
  const high = Object.values(w.decor).some((d) => d.wall && /^window/.test(d.name) && d.v + d.hh > 2.1);
  if (high && anyone('decorate') && supply(w, 'reach') === 0) out.push({ serves: 'reach', n: 1, why: 'the tops of the windows are out of reach' });
  // books on the floor
  const sh = w.objects.shelf;
  const crowdedRecords = sh && sh.albums && sh.albums.length > 8;           // more sleeves than the top shelf holds
  if (sh && ((sh.stackTop && sh.stackTop()) || crowdedRecords) && supply(w, 'books') === 0) out.push({ serves: 'books', n: 1, why: 'books are stacked on the floor, or the records no longer fit' });
  // customers who could not sit down
  const rest = w.restaurant;
  if (rest && rest.needsSeats && rest.needsSeats() && supply(w, 'diners') < 2) out.push({ serves: 'diners', n: 1, why: 'the restaurant is full' });
  // a second guitar to jam along with
  if (w.objects.guitar && anyone('guitar') && w.objects.metalfactory && w.objects.woodfactory && supply(w, 'band') === 0) out.push({ serves: 'band', n: 1, why: 'a second guitar to jam with' });
  // the Bowling Alley: maple pins and a wooden ball for it, once it has been added (they need their chapters: workshop.materials.ch4 and ch5)
  if (w.doors.bowling) {
    if (supply(w, 'bowl.pins') === 0) out.push({ serves: 'bowl.pins', n: 1, why: 'the bowling alley could do with wooden pins' });
    if (supply(w, 'bowl.ball') === 0) out.push({ serves: 'bowl.ball', n: 1, why: 'the bowling alley could do with a wooden ball' });
  }
  // easter eggs: only when everything the recipe lists is in the room
  const inMain = (k) => Object.values(w.objects).some((o) => (o.name === k || o.kind === k) && w.roomIdAt(o.x, o.z) === 'main');
  // (a recipe with `eggWhere: 'house'` looks for its objects in any room, and `eggRoom` says which room has to have been added)
  const inHouse = (k) => Object.values(w.objects).some((o) => o.name === k || o.kind === k);
  for (const r of Object.values(RECIPES)) {
    if (!r.egg || (r.eggRoom && !w.doors[r.eggRoom])) continue;
    if (r.egg.every(r.eggWhere === 'house' ? inHouse : inMain) && supply(w, r.serves) === 0) out.push({ serves: r.serves, n: 1, why: 'a surprise' });
  }
  return out;
}
