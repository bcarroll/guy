// run-tests.js — Headless QA runner for GUY's room using Puppeteer
// Runs the full test-guy-game skill against the Vite dev server.
//
// Usage:
//   npm test                    # full run with retry loop
//   npm test -- --sweep objects  # single sweep only
//   npm test -- --sweep all      # all sweeps (default)

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---- CLI args -----------------------------------------------------------
const args = process.argv.slice(2);
const sweepFlag = args.find((a) => a === '--sweep' || a === '-s')?.split('=')[1] ?? 'all';
const iterations = parseInt(args.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? '4', 10);

// ---- helpers ------------------------------------------------------------
function bold(s) { return `\x1b[1m${s}\x1b[22m`; }
function green(s) { return `\x1b[32m${s}\x1b[39m`; }
function red(s) { return `\x1b[31m${s}\x1b[39m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[39m`; }

// ---- report helpers -----------------------------------------------------
const results = []; // flattened list of individual test items

function flatten(list, prefix = '') {
  for (const r of list) {
    const name = `${prefix}${r.name}`;
    if (r.pass !== undefined && typeof r.pass === 'boolean') {
      results.push({ name, pass: r.pass, ...r });
    } else if (Array.isArray(r)) {
      flatten(r, prefix);
    }
  }
}

// ---- main ---------------------------------------------------------------
async function run() {
  console.log(bold('\n═══════════════ GUY\'s Room – Headless QA Runner ═══════════════\n'));
  console.log(`  Iterations : ${iterations}`);
  console.log(`  Sweep flag : --sweep ${sweepFlag}`);
  console.log(`  Browser    : Chromium (headless)\n`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Collect console messages (especially errors)
  const allConsoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      allConsoleErrors.push(msg.text().slice(0, 240));
    }
  });

  // Collect unhandled rejections / exceptions
  const jsErrors = [];
  page.on('pageerror', (err) => {
    jsErrors.push(err.message.slice(0, 300));
  });

  try {
    console.log(bold('▶ Launching dev server …'));
    
    // Check if port is open first (might be running)
    const client = new net.Socket();
    const portOpen = await new Promise((res) => {
      client.connect(5173, 'localhost', () => { res(true); client.destroy(); });
      client.on('error', () => res(false));
      setTimeout(() => res(false), 2000);
    });

    let viteProc = null;
    if (!portOpen) {
      console.log('  Dev server not running — starting npm run dev …');
      viteProc = spawn('npm.cmd', ['run', 'dev'], { cwd: ROOT, stdio: 'pipe', shell: true });
      viteProc.stdout.on('data', (d) => {
        const s = d.toString();
        if (/Local:.*/.test(s)) console.log(`  ${s.trim()}`);
      });
      viteProc.stderr.on('data', () => {}); // silent

      await new Promise((resolve, reject) => {
        let started = false;
        const to = setTimeout(() => { if (!started) reject(new Error('Vite startup timeout')); }, 30000);
        viteProc.stdout.on('data', (d) => {
          if (/Local:/.test(d.toString()) && !started) {
            started = true;
            clearTimeout(to);
            resolve();
          }
        });
      });
    } else {
      console.log('  Dev server already running on port 5173.');
    }

    const url = 'http://localhost:5173/?nostart&fresh&skills=none';
    console.log(bold(`\n▶ Opening ${url}`));

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });

    // Wait for the game to bootstrap (the canvas or #activity element appears)
    await page.waitForSelector('#activity', { timeout: 10000 }).catch(() => {});
    console.log(green('  Page loaded.\n'));

    // ---- Coverage check -------------------------------------------------
    console.log(bold('══ Coverage Check ══'));
    const coverage = await page.evaluate(async () => {
      window.__guyTestErrors = [];
      const origError = console.error;
      console.error = (...a) => window.__guyTestErrors.push(a.map((x) => x?.message || String(x)).join(' ').slice(0, 240));
      const T = (await import('/src/devtools.js')).default;
      console.error = origError;
      return T.coverage();
    });

    if (!coverage.complete) {
      console.log(red('  ✗ MANIFEST is incomplete:'));
      for (const [key, items] of Object.entries(coverage.missing)) {
        if (items.length) console.log(`    ${yellow(key)}: ${items.join(', ')}`);
      }
      for (const [key, items] of Object.entries(coverage.stale)) {
        if (items.length) console.log(`    stale ${key}: ${items.join(', ')}`);
      }
      await browser.close();
      process.exit(1);
    }
    console.log(green('  ✓ MANIFEST is complete — all assets covered.\n'));

    // ---- Run sweeps -----------------------------------------------------
    const sweepNames = ['Objects', 'Activities', 'Tracks', 'Books', 'Records', 'Combos', 'Interrupts', 'Removals'];
    const sweepKeys = ['objects', 'activities', 'tracks', 'books', 'records', 'combos', 'interrupts', 'removals'];

    // Map --sweep flag to keys
    let targetKeys;
    if (sweepFlag === 'all') {
      targetKeys = sweepKeys;
    } else {
      const idx = sweepNames.findIndex((n) => n.toLowerCase().startsWith(sweepFlag));
      if (idx < 0) throw new Error(`Unknown sweep: ${sweepFlag}`);
      targetKeys = [sweepKeys[idx]];
    }

    console.log(bold(`\n══ Sweeps to run ══`));
    console.log(targetKeys.map((k) => `  • ${k}`).join('\n') + '\n');

    let allPassed = false;
    let lastConsoleErrors = []; // capture errors from browser for report

    for (let iter = 1; iter <= iterations && !allPassed; iter++) {
      console.log(bold(`── Iteration ${iter}/${iterations} ──`));

      // Reset errors and run sweeps via page.evaluate with proper arg passing
      const reportData = await page.evaluate(async (keys) => {
        window.__guyTestErrors = [];
        const T = (await import('/src/devtools.js')).default;
        const partial = {};
        for (const k of keys) {
          const sweepFn = T[k];
          if (!sweepFn) continue;
          partial[k] = typeof sweepFn === 'function' ? sweepFn() : sweepFn;
        }
        return { report: partial, errors: window.__guyTestErrors };
      }, targetKeys);

      const errs = reportData?.errors || [];
      lastConsoleErrors = [...allConsoleErrors]; // capture for final report

      // Summarise
      let iterPassed = true;
      if (reportData && reportData.report) {
        for (const key of targetKeys) {
          const r = reportData.report[key];
          if (!r) continue;
          
          const total = Array.isArray(r) ? r.length : (r.total ?? 0);
          const passed = Array.isArray(r) ? r.filter((x) => x.pass).length : r.passed;

          // Flatten individual items for results collection
          if (Array.isArray(r)) {
            flatten(r, `${key}:`);
          } else {
            results.push({ name: key, pass: r.total === r.passed, total: r.total, passed: r.passed, failed: r.failed });
          }

          const status = total === passed ? green('✓') : red('✗');
          console.log(`  ${status} ${key.padEnd(12)}  ${String(passed)}/${total} passed`);

          if (Array.isArray(r)) {
            for (const item of r) {
              if (!item.pass) {
                iterPassed = false;
                const reason = [
                  item.errors?.length ? `${item.errors.length} error(s)` : null,
                  Object.keys(item.overlaps || {}).some((k) => (item.warnings && item.warnings[k]) ? false : true) ? 'overlap' : null,
                  item.skipped ? `skipped: ${item.skipped}` : null,
                ].filter(Boolean).join(', ') || '';

                if (!item.skipped) {
                  console.log(`      ${red('✗')} ${item.name}${reason ? ` — ${reason}` : ''}`);
                  if (item.errors?.length) {
                    for (const e of item.errors.slice(0, 3)) {
                      console.log(`          err: ${e}`);
                    }
                  }
                }
              }
            }
          }

          // Also check console errors from this iteration
          if (errs.length > 0) {
            iterPassed = false;
            console.log(red(`      ⚠ Console errors (${errs.length}):`));
            for (const e of errs.slice(0, 5)) {
              console.log(`          ${e}`);
            }
          }
        }

        // Also check JS exceptions from page
        if (jsErrors.length > 0) {
          iterPassed = false;
          console.log(red(`      ⚠ JS errors (${jsErrors.length}):`));
          for (const e of jsErrors.slice(0, 5)) {
            console.log(`          ${e}`);
          }
        }

        if (iterPassed) {
          allPassed = true;
          console.log(green(`\n  ✓ All sweeps passed on iteration ${iter}!`));
        } else {
          console.log(yellow(`  ⚠ Not all passed — retrying (layout randomness can expose intermittent bugs)...`));
        }

        // Brief pause between iterations
        if (!allPassed && iter < iterations) await new Promise((r) => setTimeout(r, 500));
      } else {
        console.log(red('  ✗ No report returned from browser'));
        iterPassed = false;
      }
    }

    // ---- Final summary --------------------------------------------------
    console.log(bold('\n═══ Final Summary ═══\n'));

    const totalResults = results.length;
    const passed = results.filter((r) => r.pass).length;
    const failed = totalResults - passed;

    for (const r of results) {
      if (!r.pass && !r.skipped) {
        console.log(`  ${red('✗')} ${r.name}`);
        if (r.errors?.length) {
          for (const e of r.errors.slice(0, 2)) console.log(`      err: ${e}`);
        }
        const warns = Object.keys(r.warnings || {});
        if (warns.length > 0) {
          console.log(`      overlaps/grazes: ${warns.join(', ')}`);
        }
      } else if (!r.skipped && r.pass === undefined) {
        // sweep summary line already printed above
      }
    }

    console.log();
    if (failed > 0) {
      console.log(red(`  ✗ ${failed} of ${totalResults} checks failed`));
      process.exitCode = 1;
    } else {
      console.log(green(`  ✓ All ${totalResults} checks passed!`));
    }

    // Write results JSON for CI consumption
    const reportFile = path.join(ROOT, 'test-report.json');
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      iterations,
      sweepFlag,
      totalResults,
      passed,
      failed,
      errors: lastConsoleErrors.length > 0 ? lastConsoleErrors : undefined,
      results,
    }, null, 2));
    console.log(`\n  Report saved to ${reportFile}`);

  } catch (err) {
    console.error(red('Fatal error:'), err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
