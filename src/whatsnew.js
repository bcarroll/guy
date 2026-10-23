// What changed in each update, newest first. Add an entry (a new `id`, a few short plain-language lines) whenever a change worth
// telling the player about is deployed: new rooms, objects, books, things Guy can do. The update notice (src/update.js) lists the
// entries the running page has not seen yet, and vite.config.js writes the whole list into version.json.
export const WHATS_NEW = [
  { id: 'workshop-caps', items: ['Guy now stops building once he has enough: one foot stool, two sets of shelves and two chairs.'] },
  { id: 'workshop', items: ['New Workshop room: Guy builds a foot stool, wooden shelves and a chair from planks he saws, taps together and sands.', 'Built things stand in the Workshop, and the Catalogue keeps spares in storage.'] },
  { id: 'rooms', items: ['Add extra rooms from the Catalogue. Long-press a door to send Guy through it.', 'Everything stays where you leave it, even after a reload.'] },
];
