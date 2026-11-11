// Natural voices: Kokoro-82M (Apache 2.0) running in the browser. The model (about 90 MB, quantized) is fetched once from the Hugging
// Face hub; transformers.js keeps it in the browser's Cache Storage, so every later visit loads it from disk with no network.
// Until it is ready the caller keeps using the offline eSpeak voices (tts.js), so a line is never held up by the download.
export const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const NATURAL_VOICES = { guy: 'am_michael', gal: 'af_heart' };

export const status = { state: 'idle', progress: 0, error: '' };          // idle | downloading | ready | failed
const listeners = new Set();
export const onStatus = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const set = (patch) => { Object.assign(status, patch); listeners.forEach((fn) => { try { fn({ ...status }); } catch { /* listener failed */ } }); };

// Hugging Face answers a page on *.workers.dev with a 404 and no CORS headers, so the model is fetched through this site's own
// /hf/ path (src/worker.js in production, the vite proxy in dev); tts-worker.js rewrites the hub's URLs to it.
// The model runs in a Web Worker: loading it and every generate() are seconds of CPU that froze the page when they ran on its thread.
let worker = null, loading = null, ok = false, seq = 0;
const pending = new Map(), files = new Map();                              // per-file progress, so the bar reflects the whole download
function ask(msg) {
  return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); worker.postMessage({ ...msg, id }); });
}
export function load() {
  if (ok) return Promise.resolve(true);
  if (loading) return loading;
  set({ state: 'downloading', progress: 0, error: '' });
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* the browser may evict the cache under pressure */ }
  worker = new Worker(new URL('./tts-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.progress) {
      files.set(d.progress.file, d.progress); let got = 0, all = 0;
      files.forEach((f) => { got += f.loaded; all += f.total; });
      set({ progress: all ? got / all : 0 });
      return;
    }
    const p = pending.get(d.id); if (!p) return;
    pending.delete(d.id);
    d.ok ? p.resolve(d.bytes || true) : p.reject(new Error(d.error));
  };
  worker.onerror = (e) => { const err = new Error(e.message || 'voice worker failed'); pending.forEach((p) => p.reject(err)); pending.clear(); };
  loading = ask({ op: 'load', model: MODEL, local: new URL('hf/', document.baseURI).href })
    .then(() => { ok = true; set({ state: 'ready', progress: 1 }); return true; })
    .catch((e) => { loading = null; try { worker.terminate(); } catch { /* gone */ } worker = null; set({ state: 'failed', error: String((e && e.message) || e) }); throw e; });
  return loading;
}
export const ready = () => ok;

// WAV bytes for a line (same shape as tts.js render()); null when the model is not loaded yet
const cache = new Map();
export async function render(who, text) {
  if (!ok) return null;
  const k = who + '|' + text;
  if (cache.has(k)) return cache.get(k);
  const bytes = await ask({ op: 'gen', text, voice: NATURAL_VOICES[who] || NATURAL_VOICES.guy });
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  cache.set(k, bytes);
  return bytes;
}
