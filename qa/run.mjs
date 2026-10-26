// The QA runner: everything that checks Guy's room, in one command, in a real (headless) browser.
//
//   npm test                      the lot: coverage, every sweep, rigs, customers, audio, and the pictures
//   npm test -- --only=shots      just some of it: sweeps | rigs | customers | audio | guitar | shots  (comma separated)
//   npm test -- --filter=customer only the pictures whose id contains this
//   npm test -- --repeat=3        run the sweeps three times: a sweep that fails only sometimes is reported as FLAKY (never retried
//                                 until it passes: a failure that comes and goes is a bug that comes and goes)
//   npm test -- --approve         make the current pictures the baselines (look at qa/out/index.html first!)
//   npm test -- --approve=new     approve only the pictures that have no baseline yet
//   npm test -- --strict          pictures with no baseline count as failures
//
// Pictures go to qa/out (current, difference and a gallery: qa/out/index.html); approved ones live in qa/baselines.
// Exit code 0 only when everything passed (and nothing was flaky).
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'qa', 'out'), BASE = path.join(ROOT, 'qa', 'baselines');
const arg = (name, dflt = null) => { const a = process.argv.slice(2).find((x) => x === `--${name}` || x.startsWith(`--${name}=`)); return a === undefined ? dflt : a.includes('=') ? a.split('=').slice(1).join('=') : true; };
const ONLY = new Set(String(arg('only', 'sweeps,rigs,customers,audio,guitar,shots')).split(','));
const REPEAT = Math.max(1, Number(arg('repeat', 1)));
const UPTO = Math.max(0, Number(arg('upto', 0)));                // stop the sweeps after this one (to replay a failure quickly: --seed=42 --upto=6)
const SEED0 = Math.max(1, Number(arg('seed', 1)));            // the first seed: run i of the sweeps uses seed SEED0 + i (npm test -- --repeat=3 --seed=10 plays seeds 10, 11, 12)
const FILTER = arg('filter', null), APPROVE = arg('approve', false), STRICT = !!arg('strict', false);
const PORT = Number(arg('port', 5199));
const TOLERANCE = 0.004;                              // the fraction of a picture that may change before it counts as different

const c = (n, s) => `\x1b[${n}m${s}\x1b[0m`, green = (s) => c(32, s), red = (s) => c(31, s), yellow = (s) => c(33, s), bold = (s) => c(1, s);
const portOpen = (port) => new Promise((res) => { const s = net.connect(port, '127.0.0.1', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); });
const slug = (id) => id.replace(/[^a-z0-9_.-]/gi, '_');

fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(BASE, { recursive: true });
let server = null;
async function startServer() {
  if (await portOpen(PORT)) return;
  server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  server.on('exit', (code) => { if (code) { console.error(red('the dev server stopped')); process.exit(2); } });
  for (let i = 0; i < 80 && !(await portOpen(PORT)); i++) await new Promise((r) => setTimeout(r, 500));      // (vite's own message has colour codes in it: ask the port instead)
  if (!(await portOpen(PORT))) throw new Error('the dev server did not start');
}

const summary = [];                                    // { phase, name, status: pass|fail|flaky|new }
const add = (phase, name, status, detail) => summary.push({ phase, name, status, detail });

async function main() {
  console.log(bold('\nGuy\'s room QA\n'));
  if (APPROVE === 'out') {                          // approve what is already in qa/out without taking the pictures again
    const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.jpg'));
    for (const f of files) fs.copyFileSync(path.join(OUT, f), path.join(BASE, f));
    console.log(green(`approved ${files.length} pictures from qa/out`));
    return;
  }
  await startServer();
  const browser = await puppeteer.launch({
    headless: true, protocolTimeout: 0,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=800,600'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 240)));
  const open = async () => {
    for (let attempt = 1; ; attempt++) {                           // (a file saved while the run is going makes the dev server reload the page: try again)
      try {
        await page.goto(`http://localhost:${PORT}/?fresh&skills=none`, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForFunction(() => window.brain && window.guy && window.guy.loaded, { timeout: 60000 });
        await page.evaluate(async () => { window.T = (await import('/src/devtools.js')).default; });
        return;
      } catch (e) { if (attempt >= 3) throw e; await new Promise((r) => setTimeout(r, 1500)); }
    }
  };
  await open();
  // Run page work; if the page reloads under it (the dev server can do that once, when it has just bundled something new), open it again and retry.
  const safe = async (fn) => {
    for (let attempt = 1; ; attempt++) {
      try { return await fn(); } catch (e) {
        if (attempt >= 3 || !/context was destroyed|navigat|Target closed|detached/i.test(String(e && e.message))) throw e;
        console.log(yellow(`  (the page reloaded while it was being used: trying again, ${attempt}/2)`));
        await open();
      }
    }
  };

  try {
    const cov = await page.evaluate(() => window.T.coverage());
    if (!cov.complete) { add('coverage', 'the manifest knows everything in the game', 'fail', JSON.stringify(cov.missing)); console.log(red('✗ MANIFEST is incomplete'), cov.missing); }
    else { add('coverage', 'the manifest knows everything in the game', 'pass'); console.log(green('✓ coverage complete')); }

    // ---- the sweeps (several runs: a failure that comes and goes is reported as flaky)
    if (ONLY.has('sweeps')) {
      const runs = [];
      for (let i = 0; i < REPEAT; i++) {
        if (i) await open();
        const r = await safe(() => page.evaluate((seed, upTo) => {
          const rep = window.T.runAll({ seed, upTo }), out = {};
          let no = 0;
          for (const [k, v] of Object.entries(rep)) {
            if (k === 'coverage') continue;
            if (k === 'errorsLogged') { out.errorsLogged = v; continue; }
            no++;
            out[k] = { no, total: v.total, failed: v.failed.map((f) => ({ name: f.name, notes: JSON.stringify(f).slice(0, 1200) })) };
          }
          return out;
        }, SEED0 + i, UPTO));
        runs.push(r);
        const bad = Object.entries(r).filter(([k, v]) => v && v.failed && v.failed.length).length;
        console.log(`  run ${i + 1}/${REPEAT}: ${Object.keys(r).length - 1} sweeps, ${bad ? red(bad + ' with failures') : green('all pass')}, errors logged ${r.errorsLogged}`);
      }
      const seen = new Map();
      runs.forEach((r, ri) => { for (const [k, v] of Object.entries(r)) if (v && v.failed) for (const f of v.failed) { const key = `${k}: ${f.name}`; const e = seen.get(key) || { n: 0, notes: f.notes, seeds: [], no: v.no }; e.n++; e.seeds.push(SEED0 + ri); seen.set(key, e); } });
      // (a failure comes with its seed and its place in the list: T.runSweep('sweepName', seed, place) plays it again exactly)
      for (const [key, e] of seen) add('sweeps', key, e.n === REPEAT ? 'fail' : 'flaky', `${e.n} of ${REPEAT} runs (seeds ${e.seeds.join(',')}, sweep no. ${e.no}): ${e.notes}`);
      const total = Object.values(runs[0]).reduce((n, v) => n + (v && v.total ? v.total : 0), 0);
      if (!seen.size) add('sweeps', `all ${total} checks in every sweep (${REPEAT} run${REPEAT > 1 ? 's' : ''})`, 'pass');
      if (runs.some((r) => r.errorsLogged)) add('sweeps', 'no errors logged during the sweeps', 'fail', `errors logged: ${runs.map((r) => r.errorsLogged).join(', ')}`);
    }

    // ---- the sweeps that need real time
    for (const [phase, sweep] of [['rigs', 'sweepRigs'], ['customers', 'sweepCustomers'], ['audio', 'sweepAudio'], ['guitar', 'sweepGuitarSongs']]) {
      if (!ONLY.has(phase)) continue;
      await open();
      const r = await safe(() => page.evaluate(async (s) => { const list = await window.T[s](); return list.map((x) => ({ name: x.name, pass: x.pass, notes: JSON.stringify(x).slice(0, 400) })); }, sweep));
      const bad = r.filter((x) => !x.pass);
      console.log(`  ${phase}: ${r.length - bad.length}/${r.length} ${bad.length ? red('FAIL') : green('pass')}`);
      for (const x of bad) add(phase, x.name, 'fail', x.notes);
      if (!bad.length) add(phase, `all ${r.length} ${phase} checks`, 'pass');
    }

    // ---- the pictures
    if (ONLY.has('shots')) {
      await open();
      const ids = (await page.evaluate(() => window.T.shotIds())).filter((id) => !FILTER || id.includes(FILTER));
      console.log(`  pictures: ${ids.length}`);
      const gallery = [];
      for (const id of ids) {
        await open();                                                // each picture starts from a fresh page: nothing leaks from one to the next
        const shot = await safe(() => page.evaluate((i) => window.T.shot(i), id));
        if (!shot.ok) { add('shots', id, 'fail', shot.why); gallery.push({ id, status: 'fail', why: shot.why }); console.log(`    ${red('✗')} ${id}: ${shot.why}`); continue; }
        const cur = Buffer.from(shot.data.split(',')[1], 'base64');
        fs.writeFileSync(path.join(OUT, `${slug(id)}.jpg`), cur);
        const bf = path.join(BASE, `${slug(id)}.jpg`);
        let status = 'new', changed = null;
        if (fs.existsSync(bf)) {
          const base64 = 'data:image/jpeg;base64,' + fs.readFileSync(bf).toString('base64');
          const cmp = await safe(() => page.evaluate((a, b) => window.T.compare(a, b), shot.data, base64));
          changed = cmp.changed;
          if (cmp.diff) fs.writeFileSync(path.join(OUT, `${slug(id)}.diff.png`), Buffer.from(cmp.diff.split(',')[1], 'base64'));
          status = changed <= TOLERANCE ? 'pass' : 'fail';
        }
        if (shot.errors && shot.errors.length) { status = 'fail'; }
        if (APPROVE && (APPROVE === true || (APPROVE === 'new' && !fs.existsSync(bf)))) { fs.writeFileSync(bf, cur); status = 'approved'; }
        gallery.push({ id, status, changed, errors: shot.errors });
        add('shots', id, status === 'approved' ? 'pass' : status, status === 'fail' ? (shot.errors && shot.errors.length ? `errors: ${shot.errors.join('; ')}` : `${(changed * 100).toFixed(2)}% of the picture changed (at most ${TOLERANCE * 100}%)`) : status === 'new' ? 'no baseline yet: look at it, then approve' : '');
        console.log(`    ${status === 'pass' || status === 'approved' ? green('✓') : status === 'new' ? yellow('?') : red('✗')} ${id}${changed !== null ? ` (${(changed * 100).toFixed(2)}% changed)` : status === 'new' ? ' (new)' : ''}`);
      }
      writeGallery(gallery);
    }

    if (pageErrors.length) add('page', 'no uncaught errors in the page', 'fail', pageErrors.slice(0, 5).join(' | '));
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  // ---- the verdict
  const count = (s) => summary.filter((x) => x.status === s).length;
  console.log(bold('\nResult'));
  for (const x of summary.filter((y) => y.status !== 'pass')) {
    const col = x.status === 'fail' ? red : x.status === 'flaky' ? yellow : yellow;
    console.log(`  ${col(x.status.toUpperCase().padEnd(5))} [${x.phase}] ${x.name}${x.detail ? `\n          ${String(x.detail).slice(0, 300)}` : ''}`);
  }
  console.log(`  ${green(count('pass') + ' passed')}, ${count('fail') ? red(count('fail') + ' failed') : '0 failed'}, ${count('flaky') ? yellow(count('flaky') + ' flaky') : '0 flaky'}, ${count('new') ? yellow(count('new') + ' new pictures to approve') : '0 new pictures'}`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(summary, null, 1));
  const bad = count('fail') + count('flaky') + (STRICT ? count('new') : 0);
  process.exit(bad ? 1 : 0);
}

function writeGallery(items) {
  const exists = (p) => fs.existsSync(path.join(ROOT, p));
  const cell = (id, status, why, changed) => {
    const s = slug(id), cur = `out/${s}.jpg`, base = `baselines/${s}.jpg`, diff = `out/${s}.diff.png`;
    const img = (p, label) => exists(`qa/${p}`) ? `<figure><img src="${p}" loading="lazy"><figcaption>${label}</figcaption></figure>` : '';
    return `<section class="${status}"><h3>${id} <span>${status}${changed != null ? ` · ${(changed * 100).toFixed(2)}% changed` : ''}${why ? ` · ${why}` : ''}</span></h3><div>${img(cur, 'now')}${img(base, 'approved')}${status === 'fail' ? img(diff, 'difference') : ''}</div></section>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><title>Guy's room: pictures</title><style>body{font:14px system-ui;background:#161a22;color:#e8ecf2;margin:16px}h1{font-size:18px}section{margin:0 0 18px;border-left:4px solid #444;padding-left:10px}section.fail{border-color:#e55}section.new{border-color:#ea4}section.pass,section.approved{border-color:#4b8}h3{margin:0 0 6px;font-size:14px}h3 span{opacity:.7;font-weight:400}div{display:flex;gap:8px;flex-wrap:wrap}figure{margin:0}img{width:320px;border-radius:6px;display:block}figcaption{font-size:12px;opacity:.7}</style><h1>Guy's room: pictures (${items.length}). Red = changed, amber = new (look, then <code>npm test -- --approve=new</code>)</h1>${[...items].sort((a, b) => ['fail', 'new', 'pass', 'approved'].indexOf(a.status) - ['fail', 'new', 'pass', 'approved'].indexOf(b.status)).map((i) => cell(i.id, i.status, i.why, i.changed)).join('')}`;
  fs.writeFileSync(path.join(ROOT, 'qa', 'index.html'), html.replace(/src="out\//g, 'src="out/'));
  console.log(`  gallery: qa/index.html`);
}

main().catch((e) => { console.error(red('QA run failed: ' + (e && e.stack || e))); if (server) server.kill(); process.exit(2); });
