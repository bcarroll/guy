// Notices when a newer build has been deployed and offers a refresh. Every build writes version.json (see vite.config.js) and bakes
// the same id into the bundle; a tab that has been open for hours compares the two and shows a friendly "tap to refresh" bar.
// Never reloads by itself: a child may be mid-game, and a reload puts back anything the user had removed or moved.
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
const CHECK_EVERY_MS = 5 * 60 * 1000;
const REMIND_AFTER_MS = 30 * 60 * 1000;      // "Later" hides the bar this long, then it comes back if the tab is still old

let bar = null;
let hiddenUntil = 0;

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
  bar.innerHTML = `<span>✨ A new version of Guy's room is ready!</span><button class="go">Refresh</button><button class="later">Later</button>`;
  bar.querySelector('.go').addEventListener('click', () => location.reload());
  bar.querySelector('.later').addEventListener('click', () => { bar.hidden = true; hiddenUntil = Date.now() + REMIND_AFTER_MS; });
  document.body.appendChild(bar);
  return bar;
}

function showBar() {
  if (Date.now() < hiddenUntil) return;
  ensureBar().hidden = false;
}

// Ask the server which build is live. Any failure (offline, blocked, no version.json) is ignored: the next check tries again.
async function check() {
  try {
    const res = await fetch(new URL('version.json', document.baseURI).href + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return false;
    const live = await res.json();
    const stale = !!live && typeof live.id === 'string' && live.id !== BUILD_ID;
    if (stale) showBar();
    return stale;
  } catch {
    return false;
  }
}

export function initUpdateCheck() {
  window.__guyUpdate = { buildId: BUILD_ID, check, show: showBar };   // for the QA harness
  if (import.meta.env.DEV || BUILD_ID === 'dev') return;              // the dev server always serves the newest code
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  // a file from an older build that no longer exists on the server: the tab is out of date for sure
  addEventListener('vite:preloadError', () => showBar());
}
