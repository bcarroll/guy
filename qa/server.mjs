// The dev server the QA run tests, and the check that it cannot freeze.
//
// Its output is always read. A child's stdout is a pipe, and on Windows a Node process writing to a full pipe stops dead until somebody
// reads it: Vite prints about 530 bytes for every page it serves (it forwards the browser's console when an AI agent runs it), so after
// some 150 pages an unread pipe (about 80 KB) was full, the server stood still and the whole run hung, for hours, without a word.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const portOpen = (port) => new Promise((res) => { const s = net.connect(port, '127.0.0.1', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); });
export const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });

// Starts Vite on `port` for the checkout at `root`. Returns { child, tail(), bytes() }: the last of what it printed, and how much that was in all.
export async function startServer(root, port, { env = process.env, onExit = null } = {}) {
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let text = '', bytes = 0;
  for (const s of [child.stdout, child.stderr]) s.on('data', (d) => { bytes += d.length; text = (text + d).slice(-4000); });
  if (onExit) child.on('exit', onExit);
  for (let i = 0; i < 80 && !(await portOpen(port)); i++) await wait(500);      // (vite's own message has colour codes in it: ask the port instead)
  if (!(await portOpen(port))) { child.kill(); throw new Error(`the dev server did not start\n${text}`); }
  return { child, tail: () => text, bytes: () => bytes };
}

// A server made to print far more than any pipe holds (Vite's debug output) must go on answering.
export async function checkServer(root, port, start = startServer) {
  const s = await start(root, port, { env: { ...process.env, DEBUG: 'vite:*' } });
  let asked = 0;
  try {
    while (asked < 4000 && s.bytes() < 400000) {
      const r = await fetch(`http://127.0.0.1:${port}/src/whatsnew.js?t=${asked}`, { signal: AbortSignal.timeout(20000) });
      await r.arrayBuffer(); asked++;
    }
    const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(20000) });
    return { pass: r.ok && s.bytes() >= 400000, notes: `${asked} requests, ${s.bytes()} bytes printed` };
  } catch (e) {
    return { pass: false, notes: `it stopped answering after ${asked} requests and ${s.bytes()} bytes printed: ${e.message}` };
  } finally { s.child.kill(); }
}
