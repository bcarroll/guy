// Notices when a newer build has been deployed and refreshes the page by itself, so a phone left on the game always ends up
// running the newest code. Every build writes version.json (see vite.config.js) and bakes the same id into the bundle; the open
// page compares the two. A refresh loses nothing: the layout is saved just before it (layout.js, `window.__guySave`), and skills,
// the catalogue's additions and rooms are saved as they change.
//   - the tab comes back into view (the usual case on a phone): it refreshes at once, before anything is shown
//   - found while the tab is open and being watched: a friendly bar says it is refreshing in a few seconds, with "Later" to put it
//     off for half an hour
//   - if a refresh does not bring the new build (a stale cache on the way), the bar falls back to a "Refresh" button instead of looping
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
const CHECK_EVERY_MS = 5 * 60 * 1000;
const REMIND_AFTER_MS = 30 * 60 * 1000;      // "Later" hides the bar this long, then it comes back if the tab is still old
const AUTO_DELAY_MS = 4000;                  // how long the bar shows before an open tab refreshes itself
const LOOP_GUARD_MS = 2 * 60 * 1000;         // a build we already refreshed for is not refreshed for again inside this time
const GUARD_KEY = 'guy.updated';

let bar = null;
let hiddenUntil = 0;
let pending = 0;                             // timer of a refresh that is about to happen
let pendingId = null;

// `reloadFn`, `delayMs`, `flush` and `apply` are hooks for the QA harness (window.__guyUpdate).
const api = { buildId: BUILD_ID, delayMs: AUTO_DELAY_MS, reloadFn: () => location.reload() };

function ensureBar() {
  if (bar) return bar;
  const style = document.createElement('style');
  style.textContent = `
    #update-bar { position: fixed; left: 12px; right: 12px; margin: 0 auto; width: max-content; max-width: min(460px, calc(100vw - 24px)); box-sizing: border-box; z-index: 30;
      bottom: calc(84px + env(safe-area-inset-bottom, 0px));      /* clear of the Stereo / Follow / Skills buttons along the bottom */
      display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 16px; border-radius: 16px;
      background: #1c3a52; color: #fff; font: 15px/1.3 system-ui, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.45); }
    #update-bar[hidden] { display: none; }
    #update-bar span { flex: 1; }
    #update-bar button { min-width: 44px; min-height: 44px; padding: 0 16px; border: 0; border-radius: 12px; font: inherit; font-weight: 600; cursor: pointer; }
    #update-bar .go { background: #2a9d63; color: #fff; }
    #update-bar .later { background: rgba(255,255,255,.12); color: #d5e2ee; }`;
  document.head.appendChild(style);
  bar = document.createElement('div');
  bar.id = 'update-bar';
  bar.hidden = true;
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span></span><button class="go">Refresh</button><button class="later">Later</button>`;
  bar.querySelector('.go').addEventListener('click', () => reloadNow(pendingId || 'manual'));
  bar.querySelector('.later').addEventListener('click', () => {
    clearTimeout(pending); pending = 0;
    bar.hidden = true;
    hiddenUntil = Date.now() + REMIND_AFTER_MS;
  });
  document.body.appendChild(bar);
  return bar;
}

function showBar(text) {
  const b = ensureBar();
  b.querySelector('span').textContent = text;
  b.hidden = false;
}

// Refresh now. The layout is written first so nothing the child moved is lost.
function reloadNow(id) {
  clearTimeout(pending); pending = 0;
  try { if (window.__guySave) window.__guySave(); } catch { /* the refresh goes ahead anyway */ }
  try { sessionStorage.setItem(GUARD_KEY, JSON.stringify({ id, at: Date.now() })); } catch { /* no storage */ }
  api.reloadFn();
}

const refreshedRecently = (id) => {
  try { const g = JSON.parse(sessionStorage.getItem(GUARD_KEY)); return !!g && g.id === id && Date.now() - g.at < LOOP_GUARD_MS; } catch { return false; }
};

// The server has build `id`, which is not the one running. source: 'visible' (the tab just came back), 'poll', or 'preload'.
function onStale(id, source) {
  if (Date.now() < hiddenUntil) return;
  if (refreshedRecently(id)) {                                  // we already refreshed for this build and still got the old one
    pendingId = id;
    showBar("A new version of Guy's room is ready.");
    return;
  }
  if (source === 'visible' || source === 'preload') { reloadNow(id); return; }
  if (pending) return;
  pendingId = id;
  showBar("✨ A new version of Guy's room is ready! Refreshing…");
  pending = setTimeout(() => reloadNow(id), api.delayMs);
}

// Is the live build `id` newer than the one running? Starts the refresh if so.
function apply(id, source = 'poll') {
  const stale = typeof id === 'string' && id !== BUILD_ID;
  if (stale) onStale(id, source);
  return stale;
}

// Ask the server which build is live. Any failure (offline, blocked, no version.json) is ignored: the next check tries again.
async function check(source = 'poll') {
  try {
    const res = await fetch(new URL('version.json', document.baseURI).href + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return false;
    const live = await res.json();
    return !!live && apply(live.id, source);
  } catch {
    return false;
  }
}

export function initUpdateCheck() {
  Object.assign(api, {
    check, apply,
    pending: () => !!pending,
    flush: () => { if (pending) reloadNow(pendingId); },        // refresh now instead of waiting for the bar's countdown
    show: () => showBar("A new version of Guy's room is ready."),
    reset: () => {                                              // forget everything: for the QA harness between cases
      clearTimeout(pending); pending = 0; pendingId = null; hiddenUntil = 0;
      if (bar) bar.hidden = true;
      try { sessionStorage.removeItem(GUARD_KEY); } catch { /* no storage */ }
    },
  });
  window.__guyUpdate = api;
  if (import.meta.env.DEV || BUILD_ID === 'dev') return;        // the dev server always serves the newest code
  setInterval(() => check('poll'), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check('visible'); });
  addEventListener('pageshow', (e) => { if (e.persisted) check('visible'); });      // a phone restoring the tab from its back-forward cache
  // a file from an older build that no longer exists on the server: the tab is out of date for sure
  addEventListener('vite:preloadError', () => onStale('preload', 'preload'));
}
