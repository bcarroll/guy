# GUY's room

A Vite + Three.js game: a procedurally animated Mixamo robot ("GUY") lives in a 3D room and uses the objects in it.
`npm install && npm run dev` (port 5173). See `README.md` for controls and the code map.

## Testing and keeping the test current (important)

There is a QA skill: `.claude/skills/test-guy-game/` (`SKILL.md`, `assets.md`) backed by the harness in `src/devtools.js`
(`window.guyTest`, manifest-driven).

**Whenever you add or change an object, book, record, track, skill, activity, pose, menu or panel, update the skill in the
same change:**
- `MANIFEST` in `src/devtools.js` (objects, activities, books, albums, tracks, visual checkpoints)
- the matching table in `.claude/skills/test-guy-game/assets.md`
- `SKILL.md` if a sweep or a UI route changed

Then, in the browser (`?nostart&fresh&skills=none`): `const T=(await import('/src/devtools.js')).default; T.coverage()` must
report `complete: true`, and `T.runAll()` should come back clean. After fixing a bug, add a line to "Regression watch" in
`assets.md`.

## Release-quality QA: look and listen, not just count (important)

`npm test` runs everything in a real headless browser: coverage, every sweep, **rigs** (every character's skeleton loaded and posed and
measured: `src/qa-characters.js`), **customers** (each customer model in each restaurant state), **audio** (every sound rendered offline
and measured: `src/qa-audio.js`) and **pictures** (`src/qa-shots.js`: each visual checkpoint, every character standing / walking /
sitting from the front and the side, customers, each room, compared with the approved pictures in `qa/baselines`). Details in
`.claude/skills/test-guy-game/SKILL.md` section 0. Rules:

- A feature is not done until its **look and sound** are covered: a new character or model needs a rig entry (it is picked up from
  `customermodels.js` automatically) and pictures; a new pose or visual behaviour needs a `MANIFEST.visual` checkpoint; a new sound needs
  an entry in `SPEC` in `src/qa-audio.js` (a sound without one fails). Numbers alone passed while every customer had arms stuck in the air.
- **Look at the pictures before approving them** (`qa/index.html`, then `npm test -- --approve=new`). An approved wrong picture is worse than none.
- Never rerun a failing test until it passes. A failure that comes and goes is a bug that comes and goes: use `npm test -- --repeat=3` (every run is seeded and a FLAKY line names its seeds: replay it, do not guess)
  to see it as FLAKY and find the cause.
- When a bug is found by hand, add the test that would have caught it, and make sure it fails without the fix.

## Conventions worth knowing

- Everything GUY does is a queue of steps (`walk`, `walkAt`, `play`, `plan`) built by `activities()` in `src/brain.js`.
  Objects GUY touches must be looked up at step time (`this.obj(name)`), never cached, because the user can remove, move
  and rotate objects at any moment. Steps that depend on an object declare it (`fx.needs`, anchors) so removing it cancels them.
- Objects move only when GUY pushes them or the user drags them. Nothing resets, not even across reloads: `src/layout.js` saves every
  piece's position, turn and removed state (`guy.layout.v1`) and puts it back on load; `src/update.js` refreshes the page by itself
  when a newer build is deployed. If you add state the user can change, save it (layout, rooms or the catalog's extras) and add
  it to `T.sweepLayout`.
- Arm and hand poses use IK (`Guy.reach` in `src/guy.js`), including exact hand orientation (`opts.hand`).
- `?nostart&fresh&skills=all&records=all` is a handy test URL; `window.sim(seconds)` fast-forwards without rendering.
