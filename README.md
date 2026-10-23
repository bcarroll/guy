# Guy's Room

Three.js + Vite. Guy (Mixamo Y Bot) lives in a room and chooses activities at random:
wandering, playing the piano, dancing to the boombox, kicking a ball, toggling the lamp, browsing books, stretching, waving.

    npm install
    npm run dev      # http://localhost:5173
    npm test         # all the QA in a headless browser: sweeps, every character's skeleton, the restaurant's customers, every sound, and pictures
                     # compared with qa/baselines (look at qa/index.html; see .claude/skills/test-guy-game/SKILL.md section 0)

Controls: drag = orbit, scroll = zoom, F = follow cam, Space = skip to next activity.
Debug URLs: `?act=piano|dance|ball|lamp|books|stretch|wave`, `?follow`. There is no start screen: the sound starts on your first tap, drag or key press (`?nostart` is still accepted and does nothing). In the console `sim(seconds)` fast-forwards.

Code map: `src/room.js` (furniture, doors), `src/rooms.js` (extra rooms added from the Catalogue's Rooms tab), `src/workobjects.js`, `src/workbrain.js`, `src/workshop.js` (the Workshop: furniture, what Guy does there, the recipes), `src/needs.js` (what the house needs built), `src/gal.js`, `src/botobjects.js` (GAL, the second robot, and the machine that builds her), `src/approach.js` (using stations from any free side), `src/restobjects.js`, `src/restbrain.js`, `src/customers.js`, `src/customermodels.js` (the Restaurant: furniture and elevator, what Guy does there, the customers and who they are), `src/paintings.js`, `src/paintbrain.js` (Guy's paintings: long-press the easel > Hang painting; he hangs it on a wall of any room, three to a wall, and replaces the oldest when full), `src/layout.js` (remembers where everything is between visits), `src/update.js` (refreshes the page when a newer build is deployed), `src/guy.js` (FBX + skeleton driver), `src/brain.js` (poses, activities, A* pathing), `src/audio.js` (synth).
