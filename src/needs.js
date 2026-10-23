// What the house needs built. Guy and GAL only build something in the Workshop when there is a use for it (the owner's rule):
//   seat    there is a chair for everybody who lives here (Guy, and GAL if she is here)
//   reach   a foot stool, so a high window can be cleaned right up to the top
//   books   books are stacked on the floor: another bookshelf
//   diners  customers cannot find a seat at the restaurant: another table and chairs
//   band    a second guitar to play along with (an electric guitar, needs both workshop lines)
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
  if (sh && sh.stackTop && sh.stackTop() && supply(w, 'books') === 0) out.push({ serves: 'books', n: 1, why: 'books are stacked on the floor' });
  // customers who could not sit down
  const rest = w.restaurant;
  if (rest && rest.needsSeats && rest.needsSeats() && supply(w, 'diners') < 2) out.push({ serves: 'diners', n: 1, why: 'the restaurant is full' });
  // a second guitar to jam along with
  if (w.objects.guitar && anyone('guitar') && w.objects.metalfactory && w.objects.woodfactory && supply(w, 'band') === 0) out.push({ serves: 'band', n: 1, why: 'a second guitar to jam with' });
  return out;
}
