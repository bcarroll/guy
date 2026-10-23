---
name: test-guy-game
description: Run the full QA pass on Guy's room (the Three.js robot game in this repo). Adds every object, book and record to the room one at a time through the real Catalogue UI, makes Guy interact with each, checks the animations are visually correct (numeric checks plus screenshots), and tests multi-object combinations such as the stereo with an instrument. Use whenever the user asks to test, verify or QA the game, and after adding any object, book, record, track, activity or pose.
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

URL flags: `nostart` is accepted but does nothing (there is no start screen any more: the sound starts on the first real touch), `fresh` ignores saved room additions, `skills=none|all|id,id`
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

`T.runAll()` runs everything below and returns pass counts and the failures (about 40 s, 350 checks at the time of writing).
The browser tool times out at 45 s: loop `runAll()` at most 2 times per call (to catch flakiness), or call the sweeps
individually. Current baseline: everything passing, `T.errors` empty (run it 3-4 times: layouts of added objects are random and have exposed intermittent bugs).

| Sweep | What it does | Pass means |
|---|---|---|
| `T.sweepObjects()` | Removes every removable object, then adds them **one at a time through the Catalogue UI** (click the card). Checks placement (fits, not on Guy), then makes Guy interact (the same code path as the long-press **Interact** button) first without and then with the object's skill. Locked/premium objects are listed and skipped. | added, fits, interaction runs to completion, no exceptions, no sustained arm-in-object, he is empty-handed afterwards |
| `T.sweepActivities()` | Every activity in the manifest, after preparing the objects/skills it needs (and music for `jamguitar`). | completed, no exceptions, no sustained overlap, idle afterwards, feet on the floor |
| `T.sweepPoses()` | **Pose sanity**, every frame of every activity (`T.poseStats(name)` gives the raw numbers per pose): hand behind his body (limit 0.45 m), wrist bend (limit 100°), hand vs the wrist position the game asked for (limit 0.32 m, 90th percentile; drums, brush, guitar). Limits are `POSE_LIMITS` in `devtools.js`. | no pose exceeds a limit. Catches what the overlap check cannot: a hand reaching a lost target behind him, impossible wrists |
| `T.sweepTracks()` | Selects each track (stereo beat + every record), checks tempo, makes Guy play piano and guitar along with it. | tempo matches, he joins in, no exceptions |
| `T.sweepBooks()` | Adds each book through the UI, makes him read that exact book, checks the skill is learned and that the unlocked activity works. Locked books are skipped. | learned + follow-up activity passes |
| `T.sweepRecords()` | Each record: Guy fetches it from the top shelf, carries it, puts it by the stereo, plays its track, picks it up, returns it. Premium records are added directly (flagged `premiumDevBypass`). | fetched, on table, right track, returned, music off |
| `T.combos()` | Multi-object cases: stereo + piano, stereo + guitar (in time), stereo + dance, stopping music mid-song, lamp party during a dance, user music surviving a skip. | each passes |
| `T.sweepInterrupts()` | Interrupts every activity part-way (`skip()`); he must tidy up and end idle. | idle, no exceptions |
| `T.sweepMoves()` | While Guy uses the piano (standing and seated), drums, easel, telescope, guitar or armchair, drags the object 0.6 m. He must let go (stand up / step away) instead of having his arms pulled along. | pose changes or the step is wound down within ~1 s, no exceptions, idle afterwards |
| `T.sweepBookRules()` | **Remove vs Forget** on a shelf book (Remove: back to the Catalogue, skill kept; Forget: back to the Catalogue, skill fades over 150 s, Speed Reading over 300 s, reading again restores it; refused while he holds the book) and **Speed Reading** (stays at the shelf, much faster, still learns; without it he sits; the effect fades gradually). | all pass |
| `T.sweepSounds()` | Sound effects: each kind of event must ask for its sound (`src/sfx.js` counts requests even without audio): ball floor / wall / furniture bounce and kick, reading (grab, open, page turn, close, sit), guitar lift and put-down, lamp and stereo clicks, furniture dragging, leaf, brush, telescope tick and wipe, chair, learning chime. Audio itself cannot be heard from the harness. | each event heard at least once |
| `T.sweepRemovals()` | Removes each object an activity depends on, part-way through, then restores it. | no exceptions, he recovers |
| `T.sweepPlaylist()` | The stereo's playlist: every record has 3+ playable songs with unique titles, the player lists them all, select / next / previous change the song, a song hands over to the next one on its record after its minute (and wraps), and Guy does not repeat a song or a record back to back. | all pass |
| `T.sweepWalls()` | The drum kit and the easel pushed against the back and left walls in every rotation: where the stool or easel spot is reachable he uses it within 15 s; where it is not he declines (the Interact button says why) and a forced attempt is dropped in under 20 s. | all pass |
| `T.sweepHolding()` | Asks for another book while he reads one (also with the "record by the stereo" flag stuck on), and stops the stereo from the player while a record is out. | he puts the first book back and reads the new one without wandering off carrying it; the record ends up back on the shelf with the flag cleared |
| `T.sweepDecor()` | The rug, windows and picture: Remove through the Catalogue button, check it is gone and offered as "Put back", put it back; wall limits (not over the Catalogue, not over each other, furniture cannot be pushed into them). | all pass, no exceptions |
| `T.sweepRooms()` | **Rooms tab**: the Workshop is offered ("Add to my home", the main room is not listed), tapping Add puts exactly one door on an allowed wall with nothing in the way and a kind toast, the card then says "In your home", the camera frames both rooms, adding it again does nothing and says so, taking the room away (test-only `T.resetRooms()`) removes the door and the room, no free wall explains and changes nothing, every message under 80 characters and free of banned words | all pass |
| `T.sweepDoors()` | **Door placement**: each wall on its own, a plant pinned in the doorway is moved to the Catalogue and can be put back clear of the door, a picture over the doorway comes down and goes back up beside it, wall pieces and furniture cannot be put into the doorway or its floor strip, a door never goes over the bookshelf or the heavy piano (nothing fixed moves), the default plan never uses the left wall (the Catalogue) | all pass |
| `T.sweepGating()` | **Premium room gating**: a catalogue entry with `room: 'workshop'` (a fake object and book are added for the test) is not listed while the room is not added, is listed once it is, is hidden entirely (not shown locked) when the room is locked, is listed again on unlock, and the Objects count follows; premium records keep their "Premium · coming soon" listing | all pass |
| `T.sweepSaves()` | **Saved rooms**: `R().snapshot()` records the room and its door, `R().restoreFrom()` brings the door back where it was and takes the pieces in its way out again (what a new visit does), a locked room stays locked, nothing or junk restores nothing, a saved spot now held by the bookshelf finds a new spot | all pass |
| `T.sweepLayout()` | **Saved layout** (`src/layout.js`): a snapshot of an unchanged room is stable; after moving, turning and removing pieces, aiming the telescope, hanging a picture elsewhere and dropping the ball, restoring a saved snapshot puts everything back exactly (a snapshot taken straight after equals the one restored, turned pieces face the saved way at once); what was taken out stays out; pieces saved on top of the piano or outside the room, or a picture saved off its wall, are moved to a free spot; nothing, junk or a newer format changes nothing and does not throw; a second copy of the module (test key) writes once, skips an unchanged room and reads it back; a piece saved where an added room's door goes comes out when the door is restored; Guy is never left standing inside furniture | all pass |
| `T.sweepUpdate()` | **Automatic refresh** (`src/update.js`, through `window.__guyUpdate` with the refresh itself stubbed): the same build id does nothing; a newer build found on a watched tab shows a "Refreshing…" bar with 44 px Refresh / Later buttons and waits; when the countdown ends it saves the layout and then refreshes once; Later cancels it and keeps the bar away; a tab coming back into view refreshes at once with no bar; the same build is not refreshed for twice in a row (the bar offers a manual Refresh instead); a build newer still is refreshed for | all pass |
| `T.sweepStart()` | **No start screen**: there is no `#start` overlay, the audio hook exists, the speaker button (`#sound-btn`, top right, 44 px) is always shown (red and pulsing until the audio runs, red when muted, faint when on) and is also the mute button (master volume and sound effects; M does the same), and pretend (untrusted) pointer / touch / click / key events leave the audio alone (only a real touch starts it) | all pass |
| `T.sweepRiffs()` | **Guitar riffs** (`src/riffs.js`): invented riffs are 16 steps in range; a tidy riff scores good and noise does not; tidy ideas are good more often than messy ones; only good new riffs are kept, never twice, the best 8 best-first; an unreadable save is ignored; with nothing kept he always invents and with favourites he sometimes replays one; a session plays each riff twice then the next; the `riff` activity runs clean and after a few sessions he has kept good riffs and said so (in memory: `?fresh` never writes `guy.riffs.v1`) | all pass |
| `T.sweepLock()` | **Lock in** for guitar, piano, drums, easel, telescope, lamp, plant, armchair, ball, stereo table and shelf: locked for 150 s he keeps cycling through only what he can do there, and Unlock lets him go and wraps up; a missing skill is refused with Interact's message and sets no lock; Interact on something else, Next, removing the object end the lock, cutting an activity short does not; the long-press menu offers Lock in / Unlock (hidden for things he cannot use), the Locked chip shows and its tap lets him go | all pass |
| `T.sweepSpeed()` | **Speed**: at 3x the same walk takes less than half the time and his legs go faster; an idle pause at 4x is under a third as long; an interaction (waving) takes just as long at 4x; two minutes of wandering at 4x never puts him inside furniture; the dropdown offers 1-4x, is 44 px high and sets `brain.speed` | all pass |
| `T.sweepShelf()` | **Shelf overflow**: with every book added the shelf holds 16 inside its frame and the rest are stacked; stacked books lie flat on their side, the first on the floor and each resting on the one below; the stack is beside the shelf, inside the room, an obstacle nothing can be put on, and moves with the shelf; Guy reads the top book of the stack (squatting) and puts it back where it was; the long-press book list lists every book and stays on screen (scrolls); taking a stacked book away settles the rest; no stack, no obstacle once the extra books are gone | all pass |
| `T.sweepVisit()` | **Doors** on the right, front and back walls: a real doorway and a shut door; the door menu offers just "Go into the Workshop"; he opens the door, goes in, comes back and shuts it, never standing anywhere he should not; cut short inside he leaves by the door before doing what was asked; asked to come back from inside he does | all pass |
| `T.sweepMachine()` | The Objects tab: every object has a category, All lists each once, each category chip lists exactly its items under one heading, the All chip counts what is in the room, the shelf has no Remove. | all pass |

Each result row has `pass`, plus details (`labels`, `poses`, `overlaps`, `warnings`, `errors`). `T.errors` is the list of
every `console.error` since load; **it must stay empty**. A few overlap samples are a *graze* (reported as `warnings`,
for example an arm swinging past furniture); 6 or more samples (about 1 s) is a real clip and fails.

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
- tap the wall **Catalogue**: modal opens with Objects / Books / Records / Rooms tabs, correct groups
  (In the room / Add / Premium), Add buttons work, premium shows 🔒; long-press does nothing (cannot be removed)
- **sound with no start screen** (`UNLOCK_EVENTS` in `main.js`): load the page with no `?nostart`: Guy is already moving, nothing covers the screen, `window.__guyAudio().ctx` is `null` (silent) and a red 🔇 button pulses in the top right corner. Make one real click or tap on the canvas (the browser tool's click is a real one): `ctx.state` becomes `'running'`, sounds play and the red speaker disappears (tapping the speaker itself also counts). A drag, a key press and a tap on a button also count. The Full button still goes fullscreen (it is no longer automatic on phones)
- the **Rooms** tab: the room behind the door is as big as Guy's room (10 wide x 8 deep, same depth whichever wall the door is on). "Add to my home" on the Workshop puts a door (brown frame, red door, sign above it) on the right wall by default and a grey room behind it; on a phone (`resize_window` mobile) the tabs and buttons are at least 44 px tall. Orbit round to the right wall to see the door from inside the room. Long-press the door: "🚪 Go into the Workshop" makes Guy walk to it, open it, go in, look round and come back (the door swings open and shut); long-press the book shelf: the list scrolls when it is long; add every book and the extra ones lie in a flat stack on the floor beside the shelf
- long-press every object: the first button is named for what the object does (Play Piano, Play Guitar, Play Drums, Play with Ball, Turn Stereo On/Off, Paint, Tend Plant, Set the Mood / Turn Lamp On/Off ...; `interactLabel` in `main.js`), then Rotate, Remove (Remove hidden for the bookshelf; rotate hidden for
  the ball). The stereo's playback controls are the **🎵 Stereo** button left of Follow, visible only while a stereo is in the room; the stereo's menu button turns it on or off (Guy walks over and presses the button)
- long-press a **book** on the lower shelves: popup lists the books with read / not read (✅ / 📕), updating as Guy reads; clicking an unread book makes Guy read exactly that one next (`brain.requestRead(id)`), read books are not clickable; each book has **Remove** (back to the Catalogue, Guy keeps what he learned) and **Forget** (back to the Catalogue, the skill fades gradually) buttons
- long-press the **top shelf** when it holds records: record list; long-press lower shelves: normal menu
- **Lock in**: long-press the guitar > "🔒 Lock in": toast "Guy will keep going until you tell him to stop.", a "🔒 Locked on guitar · tap to stop" chip appears and the HUD label starts with 🔒. He alternates strumming and making up riffs for as long as you watch (set the speed to 4x to see more of it); tap the chip (or Next / Space, or long-press > "🔓 Unlock") and he wraps up. Locked, then remove the guitar: the chip disappears. At 375 px wide the chip and the buttons wrap onto rows with no sideways scroll
- **Speed dropdown** beside Follow (1x to 4x, 44 px high): at 4x he crosses the room in about a quarter of the time and his pauses between things are short, but playing, reading and painting keep their normal pace. It is remembered between visits (not under `?fresh`)
- playback panel: play / stop / previous / next, track list updates, Guy joins in
- drag furniture (heavy things too), drop onto Guy or walls is refused; dragging scrapes, dropping thuds, **M** mutes the sound effects
- **automatic update** (`src/update.js`; only in a production build, not the dev server; the logic is covered by `T.sweepUpdate`, this checks it for real): `npm run build`, serve `dist` (`npx vite preview`), open the page, move a few things and wait 4 s (the layout is saved every 3 s), then overwrite `dist/version.json` with a different id. Switch to another tab and back (or run `await __guyUpdate.check('poll')`): coming back to the tab refreshes at once with no bar; `check('poll')` on a tab being watched shows "✨ A new version of Guy's room is ready! Refreshing…" (Refresh / Later, 44 px high, no sideways scroll at 375 px wide) and refreshes after 4 s; **Later** puts it off for 30 minutes. After the refresh everything you moved or removed must be where you left it. The same id must do nothing, and if the server keeps serving the old build the bar offers a manual **Refresh** instead of looping (it never refreshes for the same build twice within 2 minutes)
- **saved layout** (`src/layout.js`, key `guy.layout.v1`; the logic is covered by `T.sweepLayout`): in a normal page (no `?fresh`) drag two things, turn one, remove one, move a picture, wait 4 s and reload: every piece is where you left it, the removed one is still in the Catalogue as "Put back", Guy does not start inside furniture. `?fresh` neither reads nor writes it. Clear it with `localStorage.removeItem('guy.layout.v1')`

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
| a room (`ROOM_CATALOG` in `src/rooms.js`) | `MANIFEST.rooms`; the Rooms section of `assets.md`; the door sweeps already cover any room (wall list, size, look come from the catalog) |
| a catalogue entry that belongs to a room (`room: '<id>'` on an object or book) | its `MANIFEST` entry as usual; it is listed only while the room is added and unlocked, so `sweepObjects`, `sweepBooks` and `sweepMachine` must add the room first (`R().add(id)`) |
| a pose (`POSES`) or new hand/arm logic | a visual checkpoint in `MANIFEST.visual` and in `assets.md` |
| a new menu item / panel / UI route | section 4 of this file |
| a bug you fixed | a regression line in `assets.md` ("Regression watch") |

Then run `T.coverage()` (must say `complete: true`, nothing `stale`) and `T.runAll()`. If you change how a sweep works,
update the table in section 2. Do not edit this file only: the manifest in `devtools.js` is what makes `coverage()` catch
omissions.
