// Cloudflare Worker in front of the static site (wrangler.jsonc: only /hf/* runs this, everything else is served as a plain asset).
// It forwards the natural-voice model files from Hugging Face, because the hub refuses browser requests that come from *.workers.dev.
// Only the one model repo is allowed, so this is not an open proxy, and the files are cached at the edge.
const ALLOWED = '/onnx-community/Kokoro-82M-v1.0-ONNX/';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/hf/, '');
    if (!['GET', 'HEAD'].includes(request.method) || !path.startsWith(ALLOWED) || path.includes('..')) return new Response('Not found', { status: 404 });
    const upstream = await fetch('https://huggingface.co' + path + url.search, { method: request.method, cf: { cacheEverything: true, cacheTtl: 86400 } });
    const headers = new Headers(upstream.headers);
    headers.delete('set-cookie');
    headers.set('Cache-Control', 'public, max-age=86400');
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
