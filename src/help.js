// Help: how the game works and what you can do in it, in one panel opened by the ❓ button in the top corner (or H / ?).
// Tabs: Start here, Controls, Rooms, Books and skills, GAL, Talk to GUY, What's new (src/whatsnew.js) and Change log
// (src/changelog.js). The panel builds its own button, markup and styles, so index.html and main.js only have to call initHelp().
// The Rooms and Books tabs list what the game really has (ROOM_CATALOG, SKILL_GROUPS), so a new room or skill shows up by itself;
// a new room also needs a line in ROOM_NOTES (the QA sweep T.sweepHelp fails without one).
import { ROOM_CATALOG } from './rooms.js';
import { SKILL_INFO } from './skills.js';
import { SKILL_GROUPS } from './skillrun.js';
import { WHATS_NEW } from './whatsnew.js';
import { CHANGELOG } from './changelog.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const p = (s) => `<p>${s}</p>`;
const ul = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
const kv = (rows) => `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

// One line for each room in the Catalog's Rooms tab.
export const ROOM_NOTES = {
  workshop: 'The Wood Factory and the Metal Factory, a workbench and a toolbox. GUY builds what the house needs here (stools, chairs, bookshelves, tables, guitars), and the Build a Bot machine (Machines in the Catalog, Workshop only) prints GAL and then stays to print other things.',
  restaurant: 'Premium. A kitchen, a cash register and dining tables. Customers arrive by elevator; GUY and GAL take orders, cook, serve and take payment.',
  backyard: 'Outdoors, with a lawn, a soccer goal, a basketball hoop, a lawn chair, a bird bath and a shed. Flip the sky switch for day or night. GUY mows the lawn.',
  range: 'Three lanes with holographic targets. Each robot takes her own blaster from the rack, starts a round at the controller and checks the scoreboard.',
  bowling: 'Three lanes with ten pins each, ball returns, a rack of house balls and a scoreboard.',
  studio: 'A stage with lights, a glowing dance floor, a DJ booth and a wall of records. Tap the Studio Machine by the door to add instruments. Push a guitar against a wall to hang it.',
  library: 'A corner room. It starts dusty: the robots clean it, carry the bookshelves in, books and all, and build a reading desk.',
  bedroom: 'A corner room the robots furnish with a bed, a wardrobe and a bedside table.',
  garage: 'An empty corner room for whatever you want to move in.',
  gameroom: 'An empty corner room for whatever you want to move in.',
};

export const TABS = [
  { id: 'start', name: 'Start here' },
  { id: 'controls', name: 'Controls' },
  { id: 'rooms', name: 'Rooms' },
  { id: 'skills', name: 'Books and skills' },
  { id: 'gal', name: 'GAL' },
  { id: 'talk', name: 'Talk to GUY' },
  { id: 'new', name: 'What\'s new' },
  { id: 'log', name: 'Change log' },
];

const fmtDate = (d) => { const [y, m, day] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); };

export function helpHtml(tab) {
  switch (tab) {
    case 'start': return [
      p('GUY is a robot who lives in his room. He picks what to do by himself: play music, dance, read, paint, kick the ball, tidy up. You set up his world and ask him for things.'),
      '<h4>Your first few minutes</h4>',
      `<ol>${[
        'Tap anywhere once to turn the sound on (the red speaker in the corner shows it is off).',
        'Drag empty space to look around. Scroll or pinch to zoom.',
        'Tap the Catalog machine on the wall (or press C) to add objects, books, records and rooms. Search it, or pick a category.',
        'Put books on the shelf. GUY reads them and learns new skills.',
        'Open 📚 Skills (or press K) and tap a skill to have GUY do it now.',
        'Talk to him with 💬 Talk or by holding 🎤.',
      ].map((x) => `<li>${x}</li>`).join('')}</ol>`,
      p('Everything stays where you leave it, even after you close the page. When a new version is out, the page refreshes by itself and tells you what is new.'),
    ].join('');
    case 'controls': return [
      '<h4>Mouse and touch</h4>',
      kv([
        ['Drag empty space', 'Orbit the camera (in 3rd and 1st person it turns the view).'],
        ['Scroll or pinch', 'Zoom in and out.'],
        ['Drag furniture or the ball', 'Move it. Push a piece through a doorway to move it to another room.'],
        ['Long-press an object', 'Its menu: Interact, Lock in, Rotate, Remove, and extras such as Hang painting or What\'s in the shed.'],
        ['Long-press a door', 'Go into the room, come back, or lock and unlock the door.'],
        ['Long-press the bookshelf', 'Pick a book for GUY to read, or a record (top shelf) to play.'],
      ]),
      '<h4>Buttons</h4>',
      kv([
        ['📚 Skills', 'Ask GUY to do something he has learned.'],
        ['⏭ Next', 'Move him on to something else.'],
        ['View', 'Static, Follow, 3rd person or 1st person (through his eyes).'],
        ['Speed', 'How fast GUY walks and moves on, from 1× to 4×.'],
        ['💬 Talk / 🎤', 'Type or say what you want.'],
        ['🎵 Stereo', 'Play, stop and skip songs while a record is on.'],
        ['🔒 Lock in', 'Shown while GUY is locked in to one thing; tap to let him stop.'],
        ['⛶ Full', 'Fullscreen.'],
        ['🔓 (top corner)', 'Screen lock: On (voice only), Camera only, or Off. Hold it to unlock.'],
        ['🔊 (top corner)', 'Turn the sound on, or mute it.'],
      ]),
      '<h4>Keys</h4>',
      kv([['K', 'Skills'], ['C', 'Catalog (/ searches it)'], ['H or ?', 'This help'], ['F', 'Switch between the static view and the chosen one'], ['Space', 'Next activity'], ['M', 'Mute'], ['Esc', 'Close a panel or menu']]),
    ].join('');
    case 'rooms': return [
      p('GUY\'s room is home. Add more rooms from the Catalog\'s Rooms tab: each one gets a door on a wall of his room, and every room is the same 10 m square, so they line up with no gaps; a corner room has a door into each room beside it. Remove a room there too; everything in it goes back to the Catalog.'),
      kv(ROOM_CATALOG.map((r) => [`${r.icon} ${esc(r.name)}`, ROOM_NOTES[r.id] || ''])),
    ].join('');
    case 'skills': return [
      p('GUY learns by reading. Put books on the shelf from the Catalog\'s Books tab and he reads them when he likes, or long-press the bookshelf and pick one. Each book teaches a skill; some have chapters he learns by practising.'),
      p('Take a book off the shelf (Forget) and the skill slowly fades. The Learning Workstation (premium) teaches any shelf book at once.'),
      p('Open 📚 Skills to see what he knows. Each button says how it will go from where he is: right here, GAL brings it, or in another room.'),
      SKILL_GROUPS.map(([name, ids]) => `<h4>${esc(name)}</h4>${ul(ids.filter((id) => SKILL_INFO[id]).map((id) => esc(SKILL_INFO[id].name)))}`).join(''),
    ].join('');
    case 'gal': return [
      p('GAL (Genetically Alternate Layout) is the second robot. Add the Build a Bot machine from the Catalog (it lives in the Workshop and can never leave it) and GUY prints her. The machine stays: it keeps printing things from rubber, glass, plastic and metal.'),
      ul([
        'She has her own mind and her own skills, and learns from the same books.',
        'She plays with GUY: jamming, defence at the hoop, goalkeeper at the goal, lanes at the Range.',
        'She fetches things GUY asks for from the Skills menu, and puts the music on.',
        'When GUY is busy, she takes your spoken or typed request. Start with "GUY, …" to have him do it himself.',
        'Ask "tell GAL to …" to send her a job directly.',
      ]),
    ].join('');
    case 'talk': return [
      p('Tap 💬 Talk and type, or hold 🎤 and speak (Chrome on a phone or computer, with a connection). Let go when you are done.'),
      '<h4>Try saying</h4>',
      ul(['"Play the piano"', '"It\'s dark in here"', '"Put some music on" / "Turn the music off"', '"Mow the lawn"', '"Tell GAL to water the plants"', '"GUY, paint something"', '"Lock the screen" / "Unlock the screen"']),
      p('GUY finishes what he is doing first and tells you how long it will take. If he cannot do something, he says why.'),
      p('In the Talk box you can choose how much they talk (Subtitles only, Quiet or Chatty) and the voice: Natural (a one-time download of about 90 MB, then it works offline) or Robot.'),
    ].join('');
    case 'new': return [
      p('The latest updates, newest first.'),
      WHATS_NEW.map((e) => `<section class="news" data-news="${esc(e.id)}">${ul(e.items.map(esc))}</section>`).join(''),
    ].join('');
    case 'log': return [
      p('When the big things were added, changed or removed.'),
      CHANGELOG.map((d) => `<section class="day" data-date="${esc(d.date)}"><h4>${esc(fmtDate(d.date))}</h4>${
        [['added', 'Added'], ['changed', 'Changed'], ['removed', 'Removed']].filter(([k]) => (d[k] || []).length)
          .map(([k, label]) => `<div class="kind ${k}"><span class="tag">${label}</span>${ul(d[k].map(esc))}</div>`).join('')
      }</section>`).join(''),
    ].join('');
    default: return '';
  }
}

const CSS = `
#help-btn { position: fixed; top: 12px; right: 124px; z-index: 9; width: 48px; height: 48px; padding: 0; background: rgba(0,0,0,.55); color: #fff; border: 0; border-radius: 50%; font: 22px/1 system-ui, sans-serif; cursor: pointer; touch-action: manipulation; }
#help-btn:hover, #help-btn.on { background: #2a7fb0; }
#help { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.5); }
#help[hidden] { display: none; }
#help .box { width: min(720px, calc(100vw - 32px)); height: min(80vh, 760px); display: flex; flex-direction: column; background: #151a24; color: #e8edf5; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.6); overflow: hidden; }
#help header { flex: none; display: flex; align-items: center; gap: 8px; padding: 12px 10px 4px 18px; }
#help h3 { margin: 0; flex: 1; font-size: 18px; color: #9fe9ff; }
#help header button { min-width: 44px; min-height: 44px; border: 0; border-radius: 10px; background: none; color: #b9c4d6; font: inherit; font-size: 18px; cursor: pointer; }
#help header button:hover { background: rgba(255,255,255,.1); color: #fff; }
#help .tabs { flex: none; display: flex; gap: 6px; padding: 4px 14px 10px; overflow-x: auto; scrollbar-width: none; }
#help .tab { flex: none; min-height: 36px; padding: 6px 12px; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: rgba(255,255,255,.04); color: #c9d4e4; font: inherit; font-size: 13px; cursor: pointer; }
#help .tab.on { background: #2a7fb0; border-color: #2a7fb0; color: #fff; }
#help button:focus-visible { outline: 2px solid #9fe9ff; outline-offset: 2px; }
#help .body { flex: 1; overflow: auto; padding: 4px 20px 20px; font-size: 14px; line-height: 1.5; overscroll-behavior: contain; }
#help .body p { margin: 0 0 10px; }
#help .body h4 { margin: 14px 0 6px; font-size: 13px; font-weight: 600; color: #8fa3bd; text-transform: uppercase; letter-spacing: .4px; }
#help .body ul, #help .body ol { margin: 0 0 10px; padding-left: 20px; }
#help .body li { margin: 2px 0; }
#help .body dl { margin: 0 0 10px; display: grid; grid-template-columns: minmax(120px, max-content) 1fr; gap: 6px 14px; }
#help .body dt { font-weight: 600; color: #e8edf5; }
#help .body dd { margin: 0; color: #c2cddd; }
#help .news { padding: 8px 12px 2px; margin: 0 0 8px; border-left: 3px solid #2a7fb0; background: rgba(255,255,255,.03); border-radius: 0 8px 8px 0; }
#help .day { margin-bottom: 6px; }
#help .kind { display: flex; gap: 10px; align-items: baseline; }
#help .kind ul { flex: 1; }
#help .tag { flex: none; width: 66px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
#help .added .tag { color: #7fe0a0; } #help .changed .tag { color: #ffd479; } #help .removed .tag { color: #ff9a9a; }
@media (min-width: 701px) { #help .tabs { flex-wrap: wrap; } }
@media (max-width: 700px) {
  #help { align-items: flex-end; }
  #help .box { width: 100vw; height: 86vh; border-radius: 18px 18px 0 0; padding-bottom: env(safe-area-inset-bottom, 0px); }
  #help .body dl { grid-template-columns: 1fr; gap: 0 0; } #help .body dd { margin-bottom: 8px; }
}
`;

export function initHelp({ doc = document, onOpen = () => {} } = {}) {
  const style = doc.createElement('style'); style.id = 'help-css'; style.textContent = CSS; doc.head.appendChild(style);
  const button = doc.createElement('button');
  Object.assign(button, { id: 'help-btn', type: 'button', title: 'Help: how GUY\'s room works (H)', textContent: '❓' });
  button.setAttribute('aria-label', 'Help'); button.setAttribute('aria-expanded', 'false');
  const root = doc.createElement('div');
  root.id = 'help'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Help');
  root.innerHTML = `<div class="box"><header><h3>❓ How GUY's room works</h3><button type="button" class="close" title="Close (Esc)" aria-label="Close">✕</button></header>
    <div class="tabs" role="tablist">${TABS.map((t) => `<button type="button" class="tab" role="tab" data-tab="${t.id}">${esc(t.name)}</button>`).join('')}</div>
    <div class="body" role="tabpanel"></div></div>`;
  doc.body.appendChild(button); doc.body.appendChild(root);
  const body = root.querySelector('.body');
  let current = 'start';
  const show = (tab) => {
    if (!TABS.some((t) => t.id === tab)) tab = 'start';
    current = tab;
    root.querySelectorAll('.tab').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    body.innerHTML = helpHtml(tab); body.scrollTop = 0;
  };
  const open = (tab = current) => { show(tab); root.hidden = false; button.classList.add('on'); button.setAttribute('aria-expanded', 'true'); onOpen(); root.querySelector(`.tab[data-tab="${current}"]`).focus({ preventScroll: true }); };
  const close = () => { root.hidden = true; button.classList.remove('on'); button.setAttribute('aria-expanded', 'false'); };
  const toggle = (tab) => (root.hidden ? open(tab) : close());
  button.addEventListener('click', () => toggle());
  root.querySelector('.close').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); const t = e.target.closest('.tab'); if (t) show(t.dataset.tab); });
  // the help panel takes clicks and drags for itself: they must not reach the room behind it
  for (const t of ['pointerdown', 'pointerup', 'wheel', 'touchstart']) root.addEventListener(t, (e) => e.stopPropagation());
  addEventListener('keydown', (e) => {
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape' && !root.hidden) { close(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'h' || e.key === 'H' || e.key === '?') toggle();
  });
  show('start');
  return { open, close, toggle, show, isOpen: () => !root.hidden, get tab() { return current; }, root, button };
}
