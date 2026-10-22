# Guy's Room

Three.js + Vite. Guy (Mixamo Y Bot) lives in a room and chooses activities at random:
wandering, playing the piano, dancing to the boombox, kicking a ball, toggling the lamp, browsing books, stretching, waving.

    npm install
    npm run dev      # http://localhost:5173

Controls: drag = orbit, scroll = zoom, F = follow cam, Space = skip to next activity.
Debug URLs: `?act=piano|dance|ball|lamp|books|stretch|wave`, `?follow`, `?nostart`. In the console `sim(seconds)` fast-forwards.

Code map: `src/room.js` (furniture), `src/guy.js` (FBX + skeleton driver), `src/brain.js` (poses, activities, A* pathing), `src/audio.js` (synth).
