// Screen lock: "off" (everything works), "on" (only voice commands: touch, mouse and keyboard are ignored) and "camera"
// (like on, but the camera still pans, zooms and moves). The lock button and its menu stay live so the user can always get out:
// while locked the button needs a half-second-plus hold to unlock, so a stray touch cannot undo it. Voice calls setMode().
// Saved in guy.screenlock.v1 (not read or written with ?fresh, like the other saves).
export const MODES = ['off', 'camera', 'on'];
export const LABEL = { off: 'Off', camera: 'Camera only', on: 'On' };
const KEY = 'guy.screenlock.v1';
export const HOLD_MS = 1200;

export function initScreenLock({ persist = true, onLock = () => {}, toast = () => {} } = {}) {
  let mode = 'off';
  if (persist) { try { const v = localStorage.getItem(KEY); if (MODES.includes(v)) mode = v; } catch { /* storage blocked */ } }
  const body = document.body, btn = document.getElementById('lockscreen-btn'), pop = document.getElementById('lockscreen-menu');
  const listeners = [];
  const ICON = { off: '🔓', camera: '🎥', on: '🔒' };
  const apply = () => {
    body.dataset.lock = mode;
    btn.textContent = ICON[mode]; btn.title = `Screen lock: ${LABEL[mode]}`; btn.setAttribute('aria-label', `Screen lock: ${LABEL[mode]}`);
    btn.classList.toggle('locked', mode !== 'off');
    pop.hidden = true;
    for (const b of pop.querySelectorAll('[data-lock]')) b.classList.toggle('on', b.dataset.lock === mode);
  };
  function setMode(m, { quiet = false } = {}) {
    if (!MODES.includes(m)) return false;
    const was = mode; mode = m;
    if (persist) { try { localStorage.setItem(KEY, mode); } catch { /* storage blocked */ } }
    apply();
    if (mode !== 'off' && was === 'off') onLock();          // close menus and panels, drop any press in progress
    if (!quiet && was !== mode) toast(mode === 'off' ? 'Screen unlocked' : mode === 'on' ? 'Screen locked: voice only' : 'Screen locked: camera controls only');
    listeners.forEach((f) => f(mode, was));
    return true;
  }
  // Keys do nothing while locked (captured before every other key handler).
  addEventListener('keydown', (e) => { if (mode !== 'off') { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  // Off: tap opens the three choices. Locked: tap only reminds; hold unlocks.
  let hold = null;
  btn.addEventListener('click', () => {
    if (mode === 'off') pop.hidden = !pop.hidden;
    else toast('Hold the button to unlock, or say "unlock the screen"');
  });
  btn.addEventListener('pointerdown', () => {
    if (mode === 'off') return;
    btn.classList.add('holding');
    hold = setTimeout(() => { hold = null; btn.classList.remove('holding'); setMode('off'); }, HOLD_MS);
  });
  const cancel = () => { clearTimeout(hold); hold = null; btn.classList.remove('holding'); };
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(t, cancel);
  pop.addEventListener('click', (e) => { const b = e.target.closest('[data-lock]'); if (b) setMode(b.dataset.lock); });
  apply();
  return { get mode() { return mode; }, setMode, locked: () => mode !== 'off', cameraOk: () => mode !== 'on', onChange: (f) => listeners.push(f) };
}
