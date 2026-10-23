// The Learning Workstation's panel: opens when Guy (or GAL) taps the screen (the `learn` activity, brain.js). Lists every book on the
// shelf with the skill it teaches and a Learn button. Learn teaches that robot at once, with no reading; the row then reads "Learned"
// and its button is disabled. The book is not used up: it stays on the shelf, so the other robot can read it (or learn it here) too.
import { SKILL_INFO } from './skills.js';
import { sfx } from './sfx.js';
import { shelfRecords, learnBooks } from './learn.js';

export function initWorkstation({ world, toast = () => {} }) {
  const root = document.getElementById('wstation'), list = root.querySelector('.rows'), who = root.querySelector('.who');
  let brain = null;
  const books = () => shelfRecords(world);
  const allBtn = root.querySelector('.all');
  const nameOf = (b) => (b && b.isGal ? 'GAL' : 'GUY');
  function render() {
    list.innerHTML = '';
    who.textContent = brain ? nameOf(brain) : '';
    const bs = books(), left = brain ? bs.filter((r) => !brain.skills.has(r.def.teaches)).length : 0;
    allBtn.textContent = left ? `⚡ Learn all (${left})` : '⚡ Learned everything'; allBtn.disabled = !left;
    if (!bs.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'There are no books on the shelf.'; list.append(e); return; }
    for (const rec of bs) {
      const def = rec.def, known = !!brain && brain.skills.has(def.teaches);
      const row = document.createElement('div'); row.className = 'row' + (known ? ' done' : ''); row.dataset.book = def.id;
      const t = document.createElement('div'); t.className = 'txt';
      const h = document.createElement('b'); h.textContent = def.title;
      const sub = document.createElement('span'); sub.textContent = 'Teaches: ' + ((SKILL_INFO[def.teaches] && SKILL_INFO[def.teaches].name) || def.blurb);
      t.append(h, sub);
      const btn = document.createElement('button'); btn.className = 'learn'; btn.dataset.learn = def.id;
      btn.textContent = known ? 'Learned' : 'Learn'; btn.disabled = known;
      row.append(t, btn); list.append(row);
    }
  }
  function learn(id) {
    const rec = books().find((b) => b.def.id === id);
    if (!rec || !brain || brain.skills.has(rec.def.teaches)) return false;
    if (!learnBooks(brain, [rec]).length) return false;
    sfx('chime');
    render();
    return true;
  }
  // Learn all: every book on the shelf, at once
  function learnAll() {
    if (!brain) return 0;
    const n = learnBooks(brain, books()).length;
    if (n) sfx('chime');
    render();
    return n;
  }
  const close = () => { root.hidden = true; brain = null; };
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-learn]'); if (b && !b.disabled) learn(b.dataset.learn); });
  allBtn.addEventListener('click', () => { if (!allBtn.disabled) learnAll(); });
  root.querySelector('.close').addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  return { open(b) { brain = b; render(); root.hidden = false; }, close, learn, learnAll, render, isOpen: () => !root.hidden, get brain() { return brain; } };
}
