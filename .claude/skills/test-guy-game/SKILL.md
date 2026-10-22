---
name: test-guy-game
description: Run the full QA pass on Guy's room (the Three.js robot game in this repo). Adds every object, book and record to the room one at a time through the real Skill Machine UI, makes Guy interact with each, checks the animations are visually correct (numeric checks plus screenshots), and tests multi-object combinations such as the stereo with an instrument. Use whenever the user asks to test, verify or QA the game, and after adding any object, book, record, track, activity or pose.
---

# Test Guy's room

The game is a Vite + Three.js app in this directory. Guy is a procedurally animated Mixamo robot; everything he does is a
queue of steps in `src/brain.js`. A data-driven QA harness lives in `src/devtools.js` (`window.guyTest`). It drives the **real**
game objects, so what it tests is what the player sees.

**Read `assets.md` (same folder) before testing**: it lists every asset, what Guy should do with it, and the visual
checklist. **After adding anything to the game, update this skill (see "Keeping this skill current").**

## 1. Start the game

Use the built-in browser (`mcp__Claude_Browser__*`). If a dev server is not already on port 5173, start it with
`preview_start` (name `guy`, from `.claude/launch.json`; it runs `npm run dev`; Windows/WSL users may need
`npm install` for their own platform first).

Open the page with a clean slate (no saved skills or room additions):

```
http://localhost:5173/?nostart&fresh&skills=none
```

URL flags: `nostart` skips the click-to-start overlay, `fresh` ignores saved room additions, `skills=none|all|id,id`
sets what Guy knows, `records=all` puts every record (including premium ones) on the shelf, `act=<activity>` forces the
first activity.

Load the harness (the REPL supports top-level `await`):

```js
window.T = (await import('/src/devtools.js')).default;
T.coverage()
```

`T.coverage()` compares the game's own catalogues (objects, books, records, tracks, activities, skills) with the
harness MANIFEST. If `complete` is false, something was added to the game and not to the test: **stop and update the
manifest first** (section 6).

## 2. Automated sweeps (about 6 seconds in total; the sim is fast)

`T.runAll()` runs everything below and returns pass counts and the failures (about 25 s, 310+ checks at the time of writing).
The browser tool times out at 45 s: loop `runAll()` at most 2 times per call (to catch flakiness), or call the sweeps
individually. Current baseline: everything passing, `T.errors` empty (run it 3-4 times: layouts of added objects are random and have exposed intermittent bugs).

| Sweep | What it does | Pass means |
|---|---|---|
| `T.sweepObjects()` | Removes every removable object, then adds them **one at a time through the Skill Machine UI** (click the card). Checks placement (fits, not on Guy), then makes Guy interact (the same code path as the long-press **Interact** button) first without and then with the object's skill. Locked/premium objects are listed and skipped. | added, fits, interaction runs to completion, no exceptions, no sustained arm-in-object, he is empty-handed afterwards |
| `T.sweepActivities()` | Every activity in the manifest, after preparing the objects/skills it needs (and music for `jamguitar`). | completed, no exceptions, no sustained overlap, idle afterwards, feet on the floor |
| `T.sweepPoses()` | **Pose sanity**, every frame of every activity (`T.poseStats(name)` gives the raw numbers per pose): hand behind his body (limit 0.45 m), wrist bend (limit 100°), hand vs the wrist position the game asked for (limit 0.32 m, 90th percentile; drums, brush, guitar). Limits are `POSE_LIMITS` in `devtools.js`. | no pose exceeds a limit. Catches what the overlap check cannot: a hand reaching a lost target behind him, impossible wrists |
| `T.sweepTracks()` | Selects each track (stereo beat + every record), checks tempo, makes Guy play piano and guitar along with it. | tempo matches, he joins in, no exceptions |
| `T.sweepBooks()` | Adds each book through the UI, makes him read that exact book, checks the skill is learned and that the unlocked activity works. Locked books are skipped. | learned + follow-up activity passes |
| `T.sweepRecords()` | Each record: Guy fetches it from the top shelf, carries it, puts it by the stereo, plays its track, picks it up, returns it. Premium records are added directly (flagged `premiumDevBypass`). | fetched, on table, right track, returned, music off |
| `T.combos()` | Multi-object cases: stereo + piano, stereo + guitar (in time), stereo + dance, stopping music mid-song, lamp party during a dance, user music surviving a skip. | each passes |
| `T.sweepInterrupts()` | Interrupts every activity part-way (`skip()`); he must tidy up and end idle. | idle, no exceptions |
| `T.sweepMoves()` | While Guy uses the piano (standing and seated), drums, easel, telescope, guitar or armchair, drags the object 0.6 m. He must let go (stand up / step away) instead of having his arms pulled along. | pose changes or the step is wound down within ~1 s, no exceptions, idle afterwards |
| `T.sweepRemovals()` | Removes each object an activity depends on, part-way through, then restores it. | no exceptions, he recovers |
| `T.sweepPlaylist()` | The stereo's playlist: every record has 3+ playable songs with unique titles, the player lists them all, select / next / previous change the song, a song hands over to the next one on its record after its minute (and wraps), and Guy does not repeat a song or a record back to back. | all pass |
| `T.sweepWalls()` | The drum kit and the easel pushed against the back and left walls in every rotation: where the stool or easel spot is reachable he uses it within 15 s; where it is not he declines (the Interact button says why) and a forced attempt is dropped in under 20 s. | all pass |
| `T.sweepHolding()` | Asks for another book while he reads one (also with the "record by the stereo" flag stuck on), and stops the stereo from the player while a record is out. | he puts the first book back and reads the new one without wandering off carrying it; the record ends up back on the shelf with the flag cleared |
| `T.sweepDecor()` | The rug, windows and picture: Remove through the Skill Machine button, check it is gone and offered as "Put back", put it back; wall limits (not over the Skill Machine, not over each other, furniture cannot be pushed into them). | all pass, no exceptions |
| `T.sweepMachine()` | The Objects tab: every object has a category, All lists each once, each category chip lists exactly its items under one heading, the All chip counts what is in the room, the shelf has no Remove. | all pass |

Each result row has `pass`, plus details (`labels`, `poses`, `overlaps`, `warnings`, `errors`). `T.errors` is the list of
every `console.error` since load; **it must stay empty**. A few overlap samples are a *graze* (reported as `warnings`,
for example an arm swinging past furniture); 4 or more samples (about 0.7 s) is a real clip and fails.

When a row fails, reproduce it on its own (`T.run('dance')`, `T.interact('piano')`), read `T.lastOverlap` (which object,
which pose, where) and `T.state()`, then fix the game, not the test, unless the test is wrong. Flaky = investigate; the
failures in this project have so far all been real (negative beat index, arms clipping furniture, anchors blocked).

## 3. Visual verification (do not skip: numbers do not catch everything)

Numeric checks cannot tell if a hand is upside down or a book is backwards. For each item in `T.visualChecklist()`
(listed with expectations in `assets.md`):

```js
T.moment('guitar', 'guitar', 7, 'front');   // run until (activity, pose, t), freeze Guy, frame him
```

then wait ~2 s and take a screenshot (`computer` action `screenshot`). Look at it and judge against `expect`. Extra
views: `T.look('side' | 'back' | 'top' | 'hand:Left' | 'hand:Right', dist)`. `T.unfreeze()` when done.

Screenshot gotchas for the built-in browser:
- The pane renders lazily: wait 2 s after moving the camera, and call `scene.updateMatrixWorld(true)` before
  raycasting or world-space maths (stale matrices make picks miss).
- `T.look` sends the `start` event that stops the room auto-framing from stealing the camera back.
- The real animation loop keeps running between tool calls: always `T.freeze()` (done by `T.moment`) before looking.
- To inspect a limb, compare against geometry numerically as well: `T.hands()` gives wrist/fingertip positions in
  Guy's frame; `T.feet()` the lowest foot height.

**Every pose and every hand-over phase (taking / putting something) needs a checkpoint**, not just the middle of an activity: bugs
have hidden in the first and last second (pickup, put-down, release). The pose sweep is the safety net, not a replacement.

Judge every shot against this standing checklist, not just the item's `expect`:
1. Hands are on what they should be on (finger on the button, hand on the key, fingers around the book), not floating.
2. No limb passes through an object or through Guy's own body.
3. A held object sits **in the hand** (palm/fingers), is oriented sensibly, and does not float (guitar has a strap).
4. Hand orientation is natural (thumb up for a handshake grip, palm toward the thing, fingers curl the right way).
5. Seated poses sit **on** the seat with legs clear of it; standing poses have both feet on the floor.
6. Books: pages face the reader, cover faces out; page turn keeps the hand on the reader's side.
7. Objects move only because Guy pushed them (or the user dragged them); nothing teleports.

## 4. Manual UI checks (the harness drives the model, these check the surface)

Use synthetic pointer events on the canvas, as the tests in this repo did (wrap `setPointerCapture` in try/catch, call
`scene.updateMatrixWorld(true)` first, and project a world point to screen):
- tap the wall **Skill Machine**: modal opens with Objects / Books / Records tabs, correct groups
  (In the room / Add / Premium), Add buttons work, premium shows 🔒; long-press does nothing (cannot be removed)
- long-press every object: menu shows **Interact**, Rotate, Remove (Remove hidden for the bookshelf; rotate hidden for
  the ball; **Playback controls** only for the stereo)
- long-press a **book** on the lower shelves: popup lists the books with read / not read (✅ / 📕), updating as Guy reads; clicking an unread book makes Guy read exactly that one next (`brain.requestRead(id)`), read books are not clickable
- long-press the **top shelf** when it holds records: record list; long-press lower shelves: normal menu
- playback panel: play / stop / previous / next, track list updates, Guy joins in
- drag furniture (heavy things too), drop onto Guy or walls is refused

## 5. Reporting

Report a table per sweep (passed/total, failures with the cause), the visual checklist with a verdict for each shot,
and anything you fixed. Say plainly what you did **not** verify (audio cannot be heard from here; motion is judged from
frozen frames). If everything passes, say which parts were checked only numerically.

## 6. Keeping this skill current

Whenever you add or change any of these, update **in the same change**:

| You added | Update |
|---|---|
| an object (catalog entry in `src/machine.js`, builder in `src/room.js`) | `MANIFEST.objects` in `src/devtools.js`; the objects table in `assets.md`; a visual checkpoint if it has a new pose |
| an activity (`activities()` in `src/brain.js`) | `MANIFEST.activities` (needs, touches); `assets.md` activities table; a visual checkpoint if it has a new pose |
| a book (`BOOK_CATALOG` in `src/skills.js`) | `MANIFEST.books` (`then`: an activity that proves the skill works); `assets.md` |
| a record or track (`src/albums.js`, `TRACKS` in `src/audio.js`) | `MANIFEST.albums`, `MANIFEST.tracks`; `assets.md` |
| a skill (`SKILL_INFO`) | its book in `MANIFEST.books`; `assets.md` |
| a pose (`POSES`) or new hand/arm logic | a visual checkpoint in `MANIFEST.visual` and in `assets.md` |
| a new menu item / panel / UI route | section 4 of this file |
| a bug you fixed | a regression line in `assets.md` ("Regression watch") |

Then run `T.coverage()` (must say `complete: true`, nothing `stale`) and `T.runAll()`. If you change how a sweep works,
update the table in section 2. Do not edit this file only: the manifest in `devtools.js` is what makes `coverage()` catch
omissions.
