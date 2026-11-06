// Natural voices: Kokoro-82M (Apache 2.0) running in the browser. The model (about 90 MB, quantized) is fetched once from the Hugging
// Face hub; transformers.js keeps it in the browser's Cache Storage, so every later visit loads it from disk with no network.
// Until it is ready the caller keeps using the offline eSpeak voices (tts.js), so a line is never held up by the download.
export const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const NATURAL_VOICES = { guy: 'am_michael', gal: 'af_heart' };

export const status = { state: 'idle', progress: 0, error: '' };          // idle | downloading | ready | failed
const listeners = new Set();
export const onStatus = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const set = (patch) => { Object.assign(status, patch); listeners.forEach((fn) => { try { fn({ ...status }); } catch { /* listener failed */ } }); };

let tts = null, loading = null;
export function load() {
  if (tts) return Promise.resolve(tts);
  if (loading) return loading;
  set({ state: 'downloading', progress: 0, error: '' });
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* the browser may evict the cache under pressure */ }
  const files = new Map();                                                 // per-file progress, so the bar reflects the whole download
  loading = (async () => {
    const { KokoroTTS } = await import('kokoro-js');
    tts = await KokoroTTS.from_pretrained(MODEL, {
      dtype: 'q8', device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress' && p.total) {
          files.set(p.file, p); let got = 0, all = 0;
          files.forEach((f) => { got += f.loaded; all += f.total; });
          set({ progress: all ? got / all : 0 });
        }
      },
    });
    set({ state: 'ready', progress: 1 });
    return tts;
  })().catch((e) => { loading = null; set({ state: 'failed', error: String(e && e.message || e) }); throw e; });
  return loading;
}
export const ready = () => !!tts;

// WAV bytes for a line (same shape as tts.js render()); null when the model is not loaded yet
const cache = new Map();
export async function render(who, text) {
  if (!tts) return null;
  const k = who + '|' + text;
  if (cache.has(k)) return cache.get(k);
  const audio = await tts.generate(text, { voice: NATURAL_VOICES[who] || NATURAL_VOICES.guy, speed: 1 });
  const bytes = audio.toWav();
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  cache.set(k, bytes);
  return bytes;
}
