// The microphone: talk to GUY instead of typing (docs: "Guy's Room: Voice Command Design", milestone 1).
// Speech to text is the browser's own Web Speech API (SpeechRecognition, or webkitSpeechRecognition in Chrome): on Android Chrome it
// sends the audio to Google's recogniser, so it needs a connection; nothing is stored by the game. What was heard goes straight into
// the same path as the typed box (voice.runAlternatives). Push-to-talk only: hold the button and talk, let go to send; a quick tap
// starts listening and it stops by itself after a pause (or on a second tap). It never listens on its own, and it stops as soon as
// the page is hidden or the screen turns off.
//
//   const mic = createMic({ onFinal(alts), onPartial(text), onState(state, detail), Recognition })
//   mic.supported, mic.listening, mic.start(), mic.stop(), mic.cancel()
// `Recognition` can be a stand-in (the QA harness passes a fake that "hears" a sentence), so everything after the microphone is testable.

export const MIC_ERRORS = {
  'not-allowed': "I can't hear you. Check the microphone permission, or type to me.",
  'service-not-allowed': "I can't hear you. Check the microphone permission, or type to me.",
  'audio-capture': "I can't find a microphone. Type to me instead.",
  network: "I can't hear you without a connection. Type to me instead.",
  'no-speech': "I didn't hear anything. Hold the mic and try again.",
  'language-not-supported': "I can't understand that language here. Type to me instead.",
};

export function createMic({ onFinal = () => {}, onPartial = () => {}, onState = () => {}, lang = 'en-US', Recognition = null } = {}) {
  const R = Recognition || (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;
  let rec = null, listening = false, got = false, wantSend = true, lastError = '';
  const state = (s, d = '') => onState(s, d);

  function build() {
    const r = new R();
    r.lang = lang; r.continuous = false; r.interimResults = true; r.maxAlternatives = 3;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          if (!wantSend || got) continue;
          got = true;
          const alts = [];
          for (let j = 0; j < res.length; j++) alts.push({ text: String(res[j].transcript || '').trim(), confidence: res[j].confidence ?? 1 });
          state('thinking');
          onFinal(alts.filter((a) => a.text));
        } else interim += res[0] ? res[0].transcript : '';
      }
      if (interim && !got) onPartial(interim.trim());
    };
    r.onerror = (e) => { lastError = e && e.error || 'error'; if (lastError !== 'aborted') state('error', MIC_ERRORS[lastError] || "I couldn't hear that. Try again, or type to me."); };
    r.onend = () => { listening = false; rec = null; if (!lastError || lastError === 'aborted') state('idle', got ? 'heard' : 'nothing'); };
    return r;
  }

  function start() {
    if (!R || listening) return false;
    got = false; wantSend = true; lastError = '';
    try { rec = build(); rec.start(); } catch (e) { rec = null; state('error', MIC_ERRORS['not-allowed']); return false; }
    listening = true; state('listening');
    return true;
  }
  // stop listening; what was said so far is still sent (push-to-talk: let go to send)
  function stop() { if (rec) { try { rec.stop(); } catch { /* already stopped */ } } }
  // stop and send nothing (the page was hidden, the screen went off)
  function cancel() { wantSend = false; if (rec) { try { rec.abort(); } catch { /* already stopped */ } } listening = false; }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden && listening) cancel(); });
  return { get supported() { return !!R; }, get listening() { return listening; }, start, stop, cancel };
}
