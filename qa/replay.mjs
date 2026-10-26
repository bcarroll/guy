// Replay one seeded sweep run in the same kind of browser the QA runner uses, and print the failures in full.
//   node qa/replay.mjs <seed> <upTo> [sweepKey ...]        (needs the dev server on :5173: npm run dev)
// e.g. node qa/replay.mjs 42 6 activities records   prints what failed in those sweeps (the keys of T.runAll's report)
import puppeteer from 'puppeteer';

const [seed = '1', upTo = '0', ...keys] = process.argv.slice(2);
const browser = await puppeteer.launch({
  headless: true, protocolTimeout: 0,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=800,600'],
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
await page.goto('http://localhost:5173/?fresh&skills=none', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction(() => window.brain && window.guy && window.guy.loaded, { timeout: 60000 });
await page.evaluate(async () => { window.T = (await import('/src/devtools.js')).default; });
const out = await page.evaluate((seed, upTo, keys) => {
  window.T.runAll({ seed: Number(seed), upTo: Number(upTo) });
  const rep = window.T.lastReport, res = {};
  for (const [k, v] of Object.entries(rep)) if (v && v.failed && v.failed.length && (!keys.length || keys.includes(k))) res[k] = v.failed;
  return res;
}, seed, upTo, keys);
console.log(JSON.stringify(out, null, 1));
if (process.env.EVAL) console.log(JSON.stringify(await page.evaluate(process.env.EVAL), null, 1));      // (anything to look at afterwards: EVAL="window.brain.w.objects.drums.x")
await browser.close();
