// Development switch: while the game is being built there is no way to pay, so a button next to the build id (index.html, main.js)
// turns every premium thing on: the premium rooms, records, and anything marked `locked` in the Catalog. Off by default; under
// ?fresh it is never saved, otherwise it is remembered in localStorage. Remove the button when payments exist.
export const dev = { all: false };
