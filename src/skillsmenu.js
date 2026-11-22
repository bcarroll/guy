// The Skills menu: what GUY can be asked to do, as big buttons in groups ("Play the guitar"), each saying how it would go from where he is
// now ("Right here", "GAL brings it", "In the Backyard", "Add a drum kit first"). Tapping one does it (skillrun.js useSkill).
// Only what he has learned is listed. While the menu is open it follows him: the thing he is doing is marked, and the notes change with his room.
import { SKILL_INFO } from './skills.js';
import { SKILL_GROUPS } from './skillrun.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initSkillsMenu({ root, button, brain, skills, label, toast }) {
  const list = root.querySelector('.list'), where = root.querySelector('.where'), foot = root.querySelector('.foot'), stopBtn = root.querySelector('.stop');
  const put = (el, html) => { if (el.__html !== html) { el.__html = html; el.innerHTML = html; } };          // (only when it changed: a button being pressed, or focused, is left alone)
  const narrow = () => matchMedia('(max-width: 700px)').matches;

  function render() {
    const all = Object.keys(SKILL_INFO), known = all.filter((id) => skills.has(id));
    const doing = brain.skillRun && brain.skillRun.id;
    const item = (id) => {
      const p = brain.skillPreview(id), on = id === doing, fading = skills.strength(id) < 1;
      const note = on ? (brain.skillRun.started ? 'Doing it now' : 'On it…') : p.text;
      return `<button type="button" class="skill known do ${on ? 'now' : p.tone}" data-skill="${id}"${on ? ' aria-pressed="true"' : ''} title="${esc(SKILL_INFO[id].name)}">
        <span class="ic" aria-hidden="true">${p.icon}</span><span class="tx"><span class="name">${fading ? '◔ ' : ''}${esc(p.ask)}</span><span class="note">${esc(fading && p.tone !== 'no' && !on ? `${note} · being forgotten` : note)}</span></span></button>`;
    };
    put(list, known.length ? SKILL_GROUPS.map(([name, ids]) => {
      const mine = ids.filter((id) => known.includes(id));
      return mine.length ? `<section aria-label="${esc(name)}"><h4>${esc(name)}</h4><div class="grid">${mine.map(item).join('')}</div></section>` : '';
    }).join('') : '<p class="empty">GUY has not learned anything yet. He learns by reading: put books on the shelf (Catalog, Books) and he will read them, or long-press the bookshelf and pick one.</p>');
    put(where, `GUY is ${brain.hereId() === 'main' ? 'in his room' : `in ${esc(brain.roomName(brain.hereId()))}`}${label.textContent ? ` · ${esc(label.textContent)}` : ''}`);
    put(foot, known.length < all.length ? `${known.length} of ${all.length} skills learned. GUY learns more by reading.` : 'GUY has learned every skill!');
    stopBtn.hidden = !(doing || brain.music);
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('.skill'); if (!b) return;
    const r = brain.useSkill(b.dataset.skill);
    toast(r.message);
    render();
    if (r.ok && narrow()) close();                           // (on a phone the menu covers the room: out of the way, so he can be watched)
  });
  stopBtn.addEventListener('click', () => { brain.unlock(false); if (brain.music && brain.userMusic) brain.stereoControl('stop'); brain.skip(); toast('Okay, GUY is stopping.'); render(); });
  root.querySelector('.close').addEventListener('click', () => close());
  let timer = 0;
  function open() { render(); root.hidden = false; if (button) { button.classList.add('on'); button.setAttribute('aria-expanded', 'true'); } clearInterval(timer); timer = setInterval(() => { if (root.hidden) { clearInterval(timer); shut(); } else render(); }, 600); }
  function shut() { if (button) { button.classList.remove('on'); button.setAttribute('aria-expanded', 'false'); } }
  function close() { root.hidden = true; clearInterval(timer); shut(); }
  const toggle = () => (root.hidden ? open() : close());
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  skills.onChange(() => render());
  render();
  return { render, open, close, toggle };
}
