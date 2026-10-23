# Guy's room

A Vite + Three.js game: a procedurally animated Mixamo robot ("Guy") lives in a 3D room and uses the objects in it.
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

## Conventions worth knowing

- Everything Guy does is a queue of steps (`walk`, `walkAt`, `play`, `plan`) built by `activities()` in `src/brain.js`.
  Objects Guy touches must be looked up at step time (`this.obj(name)`), never cached, because the user can remove, move
  and rotate objects at any moment. Steps that depend on an object declare it (`fx.needs`, anchors) so removing it cancels them.
- Objects move only when Guy pushes them or the user drags them. Nothing resets, not even across reloads: `src/layout.js` saves every
  piece's position, turn and removed state (`guy.layout.v1`) and puts it back on load; `src/update.js` refreshes the page by itself
  when a newer build is deployed. If you add state the user can change, save it (layout, rooms or the catalogue's extras) and add
  it to `T.sweepLayout`.
- Arm and hand poses use IK (`Guy.reach` in `src/guy.js`), including exact hand orientation (`opts.hand`).
- `?nostart&fresh&skills=all&records=all` is a handy test URL; `window.sim(seconds)` fast-forwards without rendering.
