# Feature plan: voice control and voice responses

Status: plan only for voice (decisions below are Brett's, 2026-10-23). The screen lock (see below) is built. Two halves: **hear** the user (hands-free commands) and **speak** back (Guy and GAL talk to the user, to each other, and while using objects).

## Decisions (Brett)
- **English only.**
- **The user talks only to Guy.** GAL never takes orders directly. There is no "GAL, ..." addressing and no wake word is needed beyond Guy's name in hands-free mode ("Guy, ...").
- **Guy delegates to GAL when he is busy** (or when the user asks him to have GAL do it). Guy says so out loud ("GAL will get right on that"), tells GAL through the existing order channel (`gal.orderBuild` / `nextOrder`), and GAL **stops what she is doing** and does it. From then on GAL **answers the user herself** and **may take orders from the user until the request is satisfied**, then returns to taking orders only through Guy.
- The user can also tell Guy to instruct GAL to use an object ("Guy, tell GAL to play the guitar").
- Example: user "play the guitar" while Guy is busy -> Guy: "GAL will get right on that." -> GAL drops her task, picks up the guitar, plays. If the user then says "louder" or "play something slower" during that, GAL replies and handles it.
- **Screen lock** (built): Off / Camera only / On, so a phone can sit in a stand and be driven by voice alone. "Lock the screen" / "unlock the screen" are voice commands (`window.__screenLock.setMode`).

## Goals
- Say things like "Guy, play the piano", "GAL, go cook", "read the astronomy book", "go into the workshop", "lock the door" and have the right robot do it.
- Natural sentences and inferred actions ("it's dark in here" -> lamp on, "I'm bored" -> something fun).
- Guy and GAL answer out loud: confirm, refuse kindly (reusing the existing refusal messages), ask when unclear, and chatter while they work ("Now playing the piano", "Dinner's up!").
- Each robot has its own voice so you can tell them apart; everything also shows as subtitles/bubbles so it works muted and on noisy phones.

## Hearing: speech to text
- Web Speech API `SpeechRecognition` (Chrome/Edge/Android Chrome; Safari partial). Feature-detect; fall back to a typed command box so the same path is testable and usable without a mic.
- Modes: push-to-talk button (default), and hands-free "always listening" toggle (continuous, restarts on `onend`, stops when the tab is hidden). Mic permission asked only when the user turns it on.
- Privacy note in the UI: Chrome's recognizer sends audio to Google. Nothing is stored by us.
- A small wake word is optional: commands must start with "Guy" or "GAL" in hands-free mode (avoids reacting to TV/room talk); push-to-talk needs no name.

## Understanding: intent parser (`src/voice.js`, new)
1. **Addressee**: always Guy. Routing: if Guy is free he does it; if he is busy (or the user said "tell GAL...") he hands it to GAL through the existing `orderBuild`/`nextOrder` channel and GAL gets a short-lived **audience** with the user (`gal.listening = { until: request satisfied }`) so follow-ups go to her.
2. **Rule-based first** (deterministic, testable, free): normalise text, match verbs/nouns against a table generated from `MANIFEST` and `activities()` labels (activity id, object name, book title, album, room, door). Synonyms table ("tunes"/"music" -> stereo/piano, "food" -> cook). Output is an intent: `{ who, kind: 'act'|'object'|'read'|'visit'|'lock'|'stop'|'ask', id }`.
3. **Inferred actions**: small mood/need table (dark -> lamp, bored -> weighted random fun activity, hungry -> restaurant when open).
4. **Optional LLM fallback** for sentences the rules cannot place: needs a backend/API key, so it is a later phase and off by default. The rules must work alone.
5. **Execute with existing entry points**, no new behaviour: `brain.choose(force)`, `interact(name)`, `requestRead(id)`, `visitRoom(id)`, door lock via `rooms.setDoorLocked`. They already return refusals (locked door, shut in, missing book/skill, busy); those strings become the spoken reply.
6. Unknown input: "I did not catch that" plus up to two close suggestions.

## Speaking: text to speech
- `speechSynthesis` (offline voices, no cost). `src/voice.js` exposes `say(who, text, {priority})`.
- Voices: Guy = a lower-pitched voice, GAL = higher; pick from `getVoices()` by language and gender hint, saved in settings; both can be changed in a Settings panel. Optional "robot" feel by pitch/rate only (no audio-graph tricks: `speechSynthesis` cannot be routed into the AudioContext).
- One speaker at a time, short queue (drop stale lines), interrupt on a new user command, cancel on mute/tab hidden. Music ducks while speaking (master gain via `audio.js`).
- Subtitle bubble over the speaking robot (same idea as the customers' `bubble`) and a log line.
- **When they speak**: replies to the user; refusals; starting an activity (one short bark per activity, from a table keyed by activity id, 2-3 variants); object use ("Time for some piano"); finishing/learning ("I learned astronomy!" from `onLearn`); GAL-Guy exchanges already logged by `say()` in `gal.js` (orders, jam, built things); restaurant lines (take order, "order up", "thank you"). Throttle: at most one unprompted line per robot every ~20 s, never during the other robot's line, and a "chatty / quiet / silent" setting.
- Mouth/animation: simple head bob or jaw/eye-light pulse while speaking (`Guy` has IK and pose code; keep it a cheap visual cue, tracked as a `MANIFEST.visual` checkpoint).

## UI
- Mic button (push-to-talk) and a hands-free toggle near the existing controls; listening indicator; typed command box; Settings: voices, chattiness, mute, wake word on/off. Preferences saved in `localStorage` (`guy.voice.v1`); `?fresh` neither reads nor writes it, like the other saves. Mobile layout checked at 390 px.

## Testing (keep the QA harness current, see CLAUDE.md)
- `T.sweepVoice`: stub `SpeechRecognition` and `speechSynthesis`, feed a phrase corpus (table in `assets.md`: phrase -> expected who/intent/result), assert the right activity starts, refusals are spoken, both addressees work, unknown input gets the fallback line, hands-free ignores un-named speech, nothing is spoken while muted.
- Coverage test: every activity id and object in `MANIFEST` has a bark/phrase entry (a new activity without one fails, like sounds in `qa-audio.js`).
- Throttle/queue tests (no overlap, interrupt works), settings persistence, no console errors with the APIs missing.
- Pictures: bubble over each robot; added to `qa-shots.js` baselines after looking at them.
- Real recognition and voices cannot be checked headless: manual checklist in `SKILL.md` (Chrome desktop, Android Chrome).

## Phases
1. Typed commands + parser + executor (no audio at all). Tests first.
2. Speech output: voices, bubbles, replies to commands, refusals.
3. Activity/object barks and GAL-Guy dialogue, chattiness setting.
4. Push-to-talk recognition, then hands-free with wake word.
5. Inferred actions, then (optional) LLM fallback.

## Open questions (still open)
- How chatty by default: occasional lines, or only replies? (Plan: replies + one short bark per activity, with a chatty/quiet/silent setting.)
- Is a cloud LLM for free-form sentences acceptable (needs a key and a small backend), or stay rules-only? (Plan: rules-only first.)
- How long should GAL keep her audience with the user after finishing a delegated request (until the activity ends, or a fixed time)?
