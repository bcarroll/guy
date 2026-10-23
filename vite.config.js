// Each build gets an id (Cloudflare's commit hash when building there, else the time). It is baked into the bundle as __BUILD_ID__
// and written to version.json, so a tab that has been open for a while can tell that a newer build is live (src/update.js).
import { execSync } from 'node:child_process';
import { WHATS_NEW } from './src/whatsnew.js';          // the change list shown in the update notice; written into version.json too

// The commit the build came from (Cloudflare sets it; locally, the checked-out commit). The time is the last resort.
const gitSha = () => { try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const buildId = (process.env.CF_PAGES_COMMIT_SHA || process.env.WORKERS_CI_COMMIT_SHA || gitSha() || Date.now().toString(36)).slice(0, 12);

const versionFile = {
  name: 'guy-version-file',
  apply: 'build',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId, news: WHATS_NEW }) }); },
};

export default {
  base: './', // relative asset paths so the build works from any host or sub-path
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [versionFile],
  optimizeDeps: { include: ['three', 'three/examples/jsm/controls/OrbitControls.js', 'three/examples/jsm/loaders/FBXLoader.js'] },     // found up front, so the dev server never reloads the page later to bundle them (that broke QA runs)
  // the QA run (qa/run.mjs) writes pictures and reports into qa/: the dev server must not reload the page it is testing because of them
  server: { host: true, port: Number(process.env.PORT) || 5173, watch: { ignored: ['**/qa/**', '**/*.log', '**/models/**'] } },   // PORT lets a second checkout/chat run its own dev server
};
