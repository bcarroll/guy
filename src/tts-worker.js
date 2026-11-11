// Runs the Kokoro model off the main thread: building the 90 MB session and every generate() are seconds of solid CPU work that froze the
// whole page when they ran in the page itself. Messages: {id, op:'load', model, hub, local} and {id, op:'gen', text, voice}.
let tts = null;
const HUB = 'https://huggingface.co/';
let routed = false;
function routeHub(local) {
  if (routed) return; routed = true;
  const real = self.fetch.bind(self);
  self.fetch = (input, init) => {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
    return real(u && u.startsWith(HUB) ? local + u.slice(HUB.length) : input, init);
  };
}

self.onmessage = async (e) => {
  const { id, op } = e.data;
  try {
    if (op === 'load') {
      routeHub(e.data.local);
      const { KokoroTTS, env } = await import('kokoro-js');
      env.allowLocalModels = false;                    // (in a worker transformers.js no longer knows it is in a browser and would look for the model on this site first)
      tts = await KokoroTTS.from_pretrained(e.data.model, {
        dtype: 'q8', device: 'wasm',
        progress_callback: (p) => { if (p.status === 'progress' && p.total) self.postMessage({ progress: { file: p.file, loaded: p.loaded, total: p.total } }); },
      });
      self.postMessage({ id, ok: true });
    } else if (op === 'gen') {
      const audio = await tts.generate(e.data.text, { voice: e.data.voice, speed: 1 });
      const bytes = audio.toWav();
      self.postMessage({ id, ok: true, bytes }, [bytes.buffer || bytes]);
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
