// Each build gets an id (Cloudflare's commit hash when building there, else the time). It is baked into the bundle as __BUILD_ID__
// and written to version.json, so a tab that has been open for a while can tell that a newer build is live (src/update.js).
const buildId = (process.env.CF_PAGES_COMMIT_SHA || process.env.WORKERS_CI_COMMIT_SHA || Date.now().toString(36)).slice(0, 12);

const versionFile = {
  name: 'guy-version-file',
  apply: 'build',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId }) }); },
};

export default {
  base: './', // relative asset paths so the build works from any host or sub-path
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [versionFile],
  server: { host: true, port: Number(process.env.PORT) || 5173 },   // PORT lets a second checkout/chat run its own dev server
};
