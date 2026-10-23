// Learning straight from the shelf's books without reading them (the Learning Workstation, workstation.js, and an order to use it).
// A "query" is a few words from a book's title or skill ("piano", "stargazing", "drum"); null means every book.
export const shelfRecords = (world) => (world.objects.shelf ? world.objects.shelf.books.slice() : []);

// the books a query points at (all words must match the title, id or skill; falls back to any word); null / 'all' = every book
export function findBooks(world, query) {
  const recs = shelfRecords(world);
  if (query == null || query === 'all') return recs;
  const words = String(query).toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !['the', 'book', 'skill', 'skills', 'how', 'for', 'and'].includes(w));
  if (!words.length) return [];
  const text = (r) => `${r.def.title} ${r.def.id} ${r.def.teaches} ${r.def.blurb || ''}`.toLowerCase();
  const all = recs.filter((r) => words.every((w) => text(r).includes(w)));
  if (all.length) return all;
  return recs.filter((r) => words.some((w) => text(r).includes(w)));
}

// teach `brain` what these books teach, at once. Returns the books that taught something new.
export function learnBooks(brain, recs) {
  const got = [];
  for (const rec of recs) if (!brain.skills.has(rec.def.teaches) && brain.skills.learn(rec.def.teaches)) got.push(rec.def);
  if (!got.length) return got;
  if (got.length === 1) { brain.ui(`learned ${got[0].blurb}!`); if (brain.onLearn) brain.onLearn(got[0]); }
  else { brain.ui(`learned ${got.length} skills!`); if (brain.onLearnMany) brain.onLearnMany(got); else if (brain.onLearn) got.forEach((d) => brain.onLearn(d)); }
  return got;
}
