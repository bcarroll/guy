# Asset reference for testing (keep in sync with the game; see SKILL.md section 6)

Last verified against: 27 objects (13 + 14 decor and decor furniture), 21 books, 12 records, 49 tracks (4 per record + the stereo beat), 39 activities, 35 poses. `T.coverage()` is the
machine check of this list; this file adds the expectations a human or Claude needs.

## Objects (`OBJECT_CATALOG` in `src/machine.js`, built in `src/room.js`)

| id | what | weight | Guy's skill | Interact does | Where he stands / touches | Notes |
|---|---|---|---|---|---|---|
| piano | upright piano | heavy (never pushed by Guy) | `piano` | skilled: `sitpiano` or `piano`; unskilled: `plink`; stereo playing: `jamsit`/`jampiano`/`jam` | 0.8 m in front of the keys, or on the bench; hands on keys (IK follows the notes) | needs the bench out of the way when standing |
| bench | piano bench | light | `piano` | as piano | fetched and pushed to 1.65 m in front of the piano; he steps into the gap, sits back, scoots it in | moved only by Guy |
| table | stereo + table (boombox rides on it) | medium | `stereo` (not needed if the music is already on) | `stereoon` / `stereooff` (menu button "Turn Stereo On/Off"; he leaves it playing for you), Guy dances etc. on his own when music is on | 0.55 m in front; index finger on the button | removing it stops the music |
| shelf | bookshelf, books on rows 3 and 2, records on the top row | heavy, **not removable** | none | `read` | 0.62 m in front (0.5 for the top row) | long-press top row opens the record list |
| lamp | floor lamp | light | `lighting` for moods/party | `lamp` (toggle) or `mood` | any free side, finger on the stem switch | party mode during a dance when he has `lighting`+`stereo` |
| armchair | armchair, faces local -z | medium | none | `read` | sits back onto it; legs hang clear of the front | seat top 0.5 m |
| armchair, armchair2, chair, chair2 | chairs (each has `obj.sit = {seat, gap}`; Guy may sit on any open one) | medium / light | none | `read` (any open chair), `sit` (rests), `sitguitar` (takes the guitar off its stand, carries it over, plays sitting); menu button "Sit Down" | steps back onto the seat from `gap` | the drum stool is a seat too: `slouch` |
| plant | potted plant | light | none | `plant` | any free side, finger on a leaf | |
| ball | red ball (not an obstacle) | n/a | `ball` | `dribble` / `toss` / `ball` (kick); unskilled: only pokes it | kinematic while he holds it | removable via the menu |
| guitar | acoustic guitar on a stand (added from the Catalogue; brings its own book) | light | `guitar` | `guitar`; stereo playing: `jamguitar` | takes it off the stand, strap over the left shoulder; right hand strums, left hand frets | |
| drums | drum kit + stool (kit faces local -z, stool at +z; added free, brings `Drumming for Robots`) | medium | `drums`, `drums.solo`, `drums.band` | unskilled `bang`; `drums` / `drumsolo`; stereo playing + band skill: `jamdrums` | side-steps onto the stool from 0.55 m to its right; sticks come off the snare, tips follow the pads (`obj.pads`); right foot works the kick | stick tips land within ~10 cm of the pad at each hit (`hitErr` idea: compare fingertip-stick tip to pad at the trigger frame) |
| easel | painting easel; canvas is a live `CanvasTexture` (`obj.paint`) | light | `easel`, `easel.colour`, `easel.portrait` | unskilled `scribble` (finger, grey); `paint`, `mixpaint`, `portrait` | stands 0.59 m in front of the canvas; palette picked up from the tray into the left hand and put back; brush tip draws the stroke as it moves; old paintings are washed over with white strokes, never cleared by magic | check the canvas in a screenshot: strokes must appear where the brush is |
| telescope | tripod + aimable tube (`obj.setAim`) | light | `telescope`, `telescope.dark`, `telescope.care` | unskilled `peek` (wrong end); `stargaze`, `darkstargaze`, `scopecare` | swings the tube with one hand, then stands behind the eyepiece with knees bent / waist leaning, eye at the eyepiece, left hand on the focus knob | `darkstargaze` switches the lamp off first and back on afterwards (`lampOffByMe`, forced `lighton` if interrupted) |
| rug | round rug (`world.decor`, category decor) | n/a (not an obstacle) | none | none | Guy walks over it | quick drag orbits the camera; **hold ~0.5 s then drag** moves it; hold and release for the menu (Remove; Turn only for rectangular rugs); Catalogue Remove / Put back |
| rug2 | **Blue Woven Rug** 2.4 x 1.6 (canvas texture, free, saved between visits) | n/a | none | none | | same rug controls; Turn (quarter turn) swaps its extents; lies 0.016 above the floor so overlapping rugs never z-fight |
| rug3 | **Striped Runner** 0.8 x 2.6 (free) | n/a | none | none | | same rug controls; lies 0.022 above the floor |
| art_mountains | **Mountain Picture** 0.9 x 0.6, left wall (free) | n/a | none | none | | wall piece: drag along its wall; Guy can dust it (`dust`) once he has read the decorating book |
| art_abstract | **Abstract Picture** 0.6 x 0.6, back wall (free) | n/a | none | none | | same |
| art_moon | **Moon Picture** 0.5 x 0.7, left wall (free) | n/a | none | none | | same |
| sconce | **Wall Light**, back wall (free); glows with the floor lamp (on/off and colour in a light show), no real light source | n/a | none | none | | `lampState.followers` in `src/room.js`; tested by `T.sweepDecor` |
| flowerplant | **Flowering Plant** (free) | light | none | `plant` (alias target: this plant) | any free side, hand near a bloom | one of `PLANT_NAMES` in `src/brain.js` |
| tree | **Indoor Tree** 2.4 m (free) | heavy (only you move it) | none | `plant` (this tree) | 0.75 m from the planter, hand on a low branch | cannot stand under a wall piece it would hit |
| coffeetable | **Coffee Table** (free; two books and a cup on it) | medium | none | none (Guy cannot use it) | | rearranged by Guy like other medium things |
| nightstand | **Nightstand** (free) | light | none | none | | |
| picture | framed sunset on the back wall (`world.decor`) | n/a | none | none | | drag along the back wall; kept off other wall pieces and off furniture taller than its lower edge |
| window | window on the left wall (`world.decor`) | n/a | none | none | | drag along the left wall; cannot cover the Catalogue |
| window2 | **Second Window** on the back wall (added free from the Catalogue, saved between visits) | n/a | none | none | | same wall rules |
| workbench | **Workbench** (Workshop; `room: 'workshop'`): 1.7 x 0.78, pegboard, drawers, vise; a pile of planks (left), cut parts (middle) and the last thing he finished (right) on top | heavy | `workshop` | `build` | stands 0.78 m in front; hands at the pile / parts / product points | comes with the book "Workshop Basics"; the piles follow `world.stock` |
| toolbox | **Toolbox** on a little frame, red, hinged lid (Workshop) | medium | `workshop` | `tidytools` | 0.6 m in front; finger lifts the lid, reaches in, closes it | also the first and last step of every `build` |
| woodfactory | **Wood Factory** (Workshop): hopper of logs, big red button, a tray; shakes and its light goes green while it runs | heavy | `workshop.materials` | `makewood` | 0.78 m in front; finger on the button, then takes the 4 planks off the tray | comes with "Wood & Metal Basics" |
| saw | **Saw & Sawhorse** (Workshop) | medium | `workshop.materials` | `sawwood` (needs a plank in stock) | 0.72 m in front; plank on the horse, hand saw in the right hand, left hand on the plank | the plank splits in two halves |
| mallet | **Rubber Mallet & Block** (Workshop): a waist-high block, the mallet lies on it | light | `workshop` | `tap` | 0.55 m in front; mallet in the right hand, left hand steadying | parts jump a little at every tap |
| sander | **Sander** (Workshop): waist-high belt sander, rollers turn while it runs | medium | `workshop.materials` | `sand` (needs a plank) | 0.52 m in front; both hands slide the piece along the belt | |
| stove | **Stove** (Restaurant; `room: 'restaurant'`): steel cooker with a pot, hood, oven door; the pot's lid comes off and steam rises while it cooks | heavy | `restaurant` | `cook` (needs a customer who has ordered) | 0.62 m in front; right hand stirs the pot with a wooden spoon, left hand on the hob | comes with the book "Restaurant Basics" |
| kitchencounter | **Kitchen Counter** (Restaurant): counter with a fridge and three plate places | heavy | `restaurant` | `serve` (needs a cooked plate) | 0.62 m in front, beside the plate's place; hand reaches the plate | cooked plates wait here |
| register | **Cash Register** (Restaurant): counter with a till, coin tray and bell; coins show earnings (`world.stock.coins`, one per 2 coins up to 10) | medium | `restaurant` | `takepay` (needs a customer at the till) | 0.62 m in front, left of centre; finger on the till button; the customer stands at the right end | the bell rings, ding + cash sounds |
| diningtable, diningtable2 | **Dining Table** (Restaurant): table for two with a chair at each end (0.95 x 1.95) | medium | `restaurant` | `takeorder` (needs a waiting customer) | stands 1.42 m out from the chair end, facing the customer; serves from the side (0.78 m) | customers sit on the chairs; plates appear in front of them |
| footstool, woodshelves, builtchair | **Built by Guy** (Workshop): not added from the Catalogue like the rest; when Guy finishes one it stands in the Workshop at once (`world.placeBuilt`, the middle of the room); only when there is no room does it go to storage (`world.stock.items`), and "Add" in the Catalogue takes one out as a real object named `<kind>_<n>` with `kind` set | light / medium / light | none | none | | a built chair is a chair he can sit on; Remove (long-press) puts it back in storage |

Decor is tested by `T.sweepDecor` (Remove through the Catalogue button, "Put back", wall limits), not by interaction.

Catalogue Objects tab: filter chips (All + one per category) with in-room counts, one section per category (Music, Hobbies,
Furniture, Decor & lighting, Games), a Remove button on every in-room item except the shelf, "Put back" for removed ones.
`cat` for each object is in `OBJECT_CATALOG` (`src/machine.js`); tested by `T.sweepMachine`.

Catalogue rules: removed objects show "Put back"; the shelf can never be removed; the machine itself is fixed to the
left wall and cannot be removed, moved or rotated.

## Books (`BOOK_CATALOG` in `src/skills.js`)

| id | title | teaches | requires | proof activity (`MANIFEST.books.then`) | start on shelf |
|---|---|---|---|---|---|
| stereo | Stereo User Manual | `stereo` | | `dance` | yes |
| piano | Piano Playing for Robots | `piano` | | `piano` | yes |
| ball | Let's Play Ball | `ball` | | `dribble` | yes |
| lighting | The Power of Lighting | `lighting` | | `mood` | yes |
| piano2 | Piano: Classics, Blues & Waltzes | `piano.advanced` | piano object | `piano` | no (Catalogue) |
| guitar | Guitar for Beginners | `guitar` | guitar object | `guitar` | comes with the guitar |
| dancemoves | Dance Moves for Robots | `dance.moves` | stereo (`table`) object | `dancemoves` (twist, shuffle, twirl) | no (Catalogue) |
| ballroom | Waltz & Swing | `dance.ballroom` | stereo (`table`) object | `ballroom` (waltz with a turn, swing) | no (Catalogue) |
| drumming | Drumming for Robots | `drums` | drums object | `drums` | comes with the drum kit |
| drumsolo | Fills & Solos | `drums.solo` | drums object | `drumsolo` | no (Catalogue) |
| drumband | Playing in the Band | `drums.band` | drums object | `jamdrums` (needs music) | no (Catalogue) |
| painting | Painting for Robots | `easel` | easel object | `paint` | comes with the easel |
| colour | Colour Mixing | `easel.colour` | easel object | `mixpaint` | no (Catalogue) |
| portrait | Portraits & Landscapes | `easel.portrait` | easel object | `portrait` | no (Catalogue) |
| stars | Stargazing for Robots | `telescope` | telescope object | `stargaze` | comes with the telescope |
| darksky | Dark Sky Rules | `telescope.dark` | telescope object | `darkstargaze` | no (Catalogue) |
| scopecare | Looking After Your Telescope | `telescope.care` | telescope object | `scopecare` | no (Catalogue) |
| decorating | Home Decorating for Robots | `decorate` | none | `dust` (wipes along the bottom edge of a frame, wall light or sill) | no (Catalogue) |
| speedread | Speed Reading for Robots | `speedreading` | none | `read` (stands at the shelf, takes the book, opens and closes it, puts it back; 2.5x faster; learns from every book in 3 s instead of 8) | no (Catalogue) |
| workshop | Workshop Basics (Workshop) | `workshop` | workbench | `build` | the foot stool; comes with the workbench |
| woodmetal | Wood & Metal Basics (Workshop) | `workshop.materials` | woodfactory | `makewood` | the wooden shelves; comes with the Wood Factory |
| furniture | Furniture for Robots (Workshop) | `workshop.furniture` | workbench | `build` | the wooden chair (advanced) |
| restaurant | Restaurant Basics (Restaurant) | `restaurant` | stove | `takeorder` | customers only come once he has read it; comes with the stove |

Guy learns a skill only after keeping the book open for 8 s (3.2 s at full Speed Reading); interrupted reads teach nothing.

## Records and tracks (`src/albums.js`, `TRACKS` in `src/audio.js`)

Every record has four songs (`tracks` in `src/albums.js`, ids `x`, `x2`, `x3`, `x4`), each with a title of its own (`label` in `TRACKS`):

| record | songs (id, bpm) | status |
|---|---|---|
| Happy Time Parade | Parade Day (`happy` 132), Bubble Bounce (`happy2` 126), Sunny Side Skip (`happy3` 138), Pancake Polka (`happy4` 144) | free (Catalogue > Records) |
| Garage Thunder (rock) | Garage Thunder (`rock` 124), Loose Gravel (112), Basement Lightning (138), Last Amp Standing (100) | free |
| Rooftop Beats (hip-hop) | Rooftop Beats (`hiphop` 88), Late Bus Loop (84), Corner Store Cipher (92), Neon Puddles (78) | free |
| Dusty Road Two-Step (upbeat country) | Dusty Road Two-Step (`twostep` 118), Barn Dance Hustle (126), Creekbed Shuffle (108), Sundown Hoedown (134) | free |
| Neon Sugar (pop) | Neon Sugar (`pop` 118), Glitter Static (124), Skyline Heart (112), Confetti Signal (128) | free |
| Midnight Swing Club (jazz) | Midnight Swing Club (`jazz` 132), Blue Corner Booth (118), Velvet Elevator (104), Last Call Cool (140) | free |
| Rainy Day Blues (slow blues, 12 bars) | Rainy Day Blues (`slowblues` 62), Porch Rain Slow Drag (56), Kettle on the Stove (64), Streetlight Lament (60) | free |
| Party Time Mixtape (party) | Party Time Mixtape (`party` 126), Glow Stick Rush (128), Confetti Cannon (122), Balloon Drop (132) | free |
| Hits from the Old Days | Ode to Joy (`classical` 100, Beethoven, public domain), Sonata in the Garden (112), Minuet for a Quiet Room (92), Allegro Over the Rooftops (132) | premium (dev bypass in tests) |
| Sad Country | Empty Porch Swing (`country` 72), Fence Line Blues (68), Highway Moon (76), Letter I Never Sent (62) | premium |
| Blues Collection | Twelve Bar Sunrise (`blues` 94), Gravel Road Shuffle (104), Hammer and Nails (88), Midnight Train Home (112) | premium |
| Out like a Lamb | Little Lamb Dream (`lullaby` 66), Moon Mobile (60), Counting Clouds (68), Blanket Fort (56) | premium |
| (stereo's own beat) | `default` 110 | always |

All melodies and chord loops are original (the one exception is Beethoven's Ode to Joy, which is public domain). The first song of
each record is hand-written; the others come from the generators in `src/audio.js` (`rockTrack`, `hiphopTrack`, ... a key, chord
names and a seed: the same seed always gives the same tune). Each song also sets a drum style for Guy at the kit (`drums` on the
track, falling back to `DRUM_STYLE_BY_TRACK` in `src/hobbies.js`: rock, boombap, train, disco, swing, soft, march).

Playback: a song plays for about a minute (`trackSeconds`: a few runs through its form), then the stereo moves to the next song on
the **same record**, wrapping round (`Brain.autoAdvance`). Music Guy started stays his; music the user started (or switched with
next / previous / a tap in the list) stays the user's. Next / previous walk through the whole list; tap a row in the player to
play that song. When Guy starts a record he picks one he did not play last time and a song from it that was not its last song
(`lastAlbumId`, `lastTrackOf`). `T.sweepPlaylist` checks all of this.

Records live on the top shelf row. Up to 5 sleeves stand side by side; with more they overlap like records in a rack
(each is a little closer to the room, and `rec.z` is the middle of the exposed left strip, where Guy's hand goes). Every
sleeve repeats its title down the left edge so it still reads when overlapped. A stereo session may fetch one (75%): grab (top-shelf IK), carry by the top edge,
stand it against the boombox, play, pick it up, put it back. The user can instead start/stop/select tracks from the stereo's
playback panel or the top-shelf record list; Guy then joins in without touching the stereo.

## Activities (`activities()` in `src/brain.js`)

wander, stretch, wave, stereoon, stereooff (menu only), piano, sitpiano, plink, jam, jampiano, jamsit, dance, lamp, mood, plant, read (alias `books`),
rearrange, ball, dribble, toss, guitar, riff (makes up riffs on the guitar, see below), jamguitar, bang, drums, drumsolo, jamdrums, scribble, paint, mixpaint, portrait, peek,
stargaze, darkstargaze, scopecare, dancemoves, ballroom, dust (needs `decorate` and a wall piece with clear floor in front); makewood, sawwood, tap, sand, tidytools, build (the Workshop, see below); takeorder, cook, serve, takepay (the Restaurant, see below; internal: rwait); internal: putback, putguitar, dropball, lighton, visit and leave (through the door of an added room and back: tested by `T.sweepVisit`).
Needs and allowed arm contacts are in `MANIFEST.activities`.

## Visual checkpoints (`T.moment(...)`, then screenshot)

| id | run | look for |
|---|---|---|
| read-grab-mid | `T.moment('read','grab',1.2,'hand:Right')` | thumb-up handshake grip around the book; arm in front of him (never swinging behind him) |
| read-sit | `T.moment('read','readSit',8,'front')` | book open, **pages face Guy**, both hands on the lower edges, legs hang clear of the chair |
| read-turn | `T.moment('read','readSit',0,'front',{turning:true})` | right hand on Guy's side of the pages while the page flips |
| guitar-play | `T.moment('guitar','guitar',7,'front')` | guitar held high on his chest, neck raised ~30°, with strap; **left knuckles on the neck (`neck` stat <= 0.05 m), fingers wrapping it**; right fingers hang over the strings, palm to them; left wrist under the neck, fingers up, thumb toward the headstock; nothing through the body |
| piano-sit | `T.moment('sitpiano','pianoSit',6,'side')` | on the bench, hands on keys, knees under the shelf |
| piano-stand | `T.moment('piano','piano',5,'side')` | standing, leaning in, both hands on keys |
| stereo-button | `T.moment('dance','reach',1.1,'front')` | index finger on the button |
| lamp-switch | `T.moment('lamp','reach',1.1,'front')` | finger on the stem switch |
| push-furniture | `T.moment('rearrange','walk',1,'side',{push:true})` | both hands flat on the near face, object moves with him |
| ball-dribble | `T.moment('dribble','dribble',4,'side')` | hand over the ball, ball not through floor/hand |
| ball-toss | `T.moment('toss','toss',3,'front')` | ball above him, head follows, catch at chest |
| drums-sit | `T.moment('drums','drumSit',9,'front')` | on the stool, a stick in each fist held like a knife (pointing forward, only slightly down, not steeply down), tips over the pads, legs clear of the kit |
| drums-solo | `T.moment('drumsolo','drumSit',12,'side')` | arms reach toms and crash without folding into his chest |
| easel-paint | `T.moment('paint','paintStand',9,'side')` | brush on the canvas with a stroke being drawn, palette on the left palm |
| easel-mix | `T.moment('mixpaint','paintStand',6,'front')` | brush circling on the palette |
| scope-peer | `T.moment('stargaze','scopePeer',6,'side')` | eye at the eyepiece, knees bent, left hand on the knob, right hand on the barrel |
| scope-aim | `T.moment('stargaze','scopeAim',2.2,'top')` | hand on top of the barrel while the tube swings |
| scope-wrong | `T.moment('peek','scopeWrong',2.8,'side')` | eye at the big lens end, other hand on his knee |
| scope-care | `T.moment('scopecare','scopeCare',13,'front')` | squatting by the tripod, a hand on one leg |
| dust-frame | `T.moment('dust','reach',2.5,'front')` | facing the wall, right hand wiping along the lower edge of a frame (not inside the wall or his head) |
| dance-twist | `T.moment('dancemoves','twist',4,'front')` | hips and shoulders twist opposite ways, knees bent and apart |
| dance-shuffle | `T.moment('dancemoves','shuffle',4,'front')` | one foot slides forward at a time, elbows pumping alternately |
| dance-twirl | `T.moment('dancemoves','twirl',2.5,'front')` | arms out, spinning on the spot (`fx.spin`) clear of furniture |
| dance-waltz | `T.moment('ballroom','waltz',5,'front')` | arms in a dance hold, slow turn |
| dance-swing | `T.moment('ballroom','swing',4,'front')` | arms swinging wide, alternate knee kicks |
| sit-rest | `T.moment('sit','sitRest',5,'side')` | sitting on the seat (not hovering), hands on the knees |
| sit-guitar | `T.moment('sitguitar','sitGuitar',6,'front')` | seated, guitar on the lap and chest, left hand on the neck, right strumming |
| slouch | `T.moment('slouch','slouch',6,'side')` | on the drum stool, round-shouldered, knees apart, hands hanging |
| record-carry | `T.moment('dance','walk',0,'front',{album:true})` | sleeve hangs from the hand by its top edge |

Other things to eyeball once per release: the top shelf with all 12 records (`?records=all`: every title readable, no
sleeves poking out of the shelf), the Catalogue screen on the wall, the record list popup, the playback
panel, the skills panel (K), the strap on the guitar, record sleeves on the top shelf, spine titles on the books, and the
book list popup (long-press a lower shelf at a book: title, read / not read).

## Rooms and doors (`ROOM_CATALOG` in `src/rooms.js`; door and room geometry in `src/room.js`)

| id | what | doorWalls | size (depth x width) | Notes |
|---|---|---|---|---|
| workshop | **Workshop**: free, unlocked by default. Adds a closed door with a sign and a grey room (floor, three walls, ceiling) behind it | right, front, back (never left: the Catalogue) | same as Guy's room: 10 wide x 8 deep, whichever wall (no `size` in the catalogue entry) | Guy can go in: long-press the door > "Go into the Workshop" (see below). The room is empty until the Workshop objects exist |
| restaurant | **Restaurant**: a **premium** room (`premium: true`, `unlocked: false`): the Rooms tab lists it under "Premium · coming soon" as 🔒 Premium with no Add button, and none of its objects or its book are listed until it is unlocked (`R().setUnlocked('restaurant', true)`, a dev bypass the harness uses via `unlockRoom`; there is no way to pay yet). The same room in warm colours, with an **elevator** against the far wall (`elevator: true`: a cabin with sliding doors, an obstacle) | front, back, right (`planDoor` skips a wall that already has a room's door, so with the Workshop on the right the Restaurant takes the front or back) | 10 x 8 like the others | customers arrive and leave through the elevator; see "The Restaurant" below |

Rules (all covered by `sweepRooms`, `sweepDoors`, `sweepGating`, `sweepSaves`):
- A door is 1.0 m wide and 2.2 m tall, with a 1.0 m floor strip in front of it that furniture cannot be put or pushed into and wall pieces cannot cover.
- The placement search prefers the fewest pieces to move, then the wall order (right, front, back), then the middle of the wall. Light and medium furniture and wall pieces in the way go to the Catalogue (like a user removal; nothing is deleted or moved silently). The bookshelf and heavy furniture never move: the door goes elsewhere, or the Catalogue says "No clear wall for a door right now".
- The right and front walls face away from the default camera, so the door is built from solid parts and the sign is drawn on both sides.
- Saved in `guy.rooms.v1` (separate from `guy.room.v1`). A new visit starts with the core pieces back on the walls, so the saved door is placed again first and anything in its way is taken out again; if its saved spot is now taken by something fixed it finds a new one.
- Entries with `room: '<id>'` are not listed (not even as locked) until that room is added and unlocked.
- Test aids: `T.resetRooms()`, `R().add(id, { at, walls })`, `R().setUnlocked(id, bool)`, `R().snapshot()` / `R().restoreFrom()` (`R()` is `window.brain.w.rooms`).

## Saved layout and automatic updates (`src/layout.js`, `src/update.js`)

- **Layout** (`guy.layout.v1`): every piece of furniture (x, z, quarter turns), every wall piece and the rug (u, v, turns), the telescope's aim, the ball (x, z, or gone), and the list of pieces taken out (by the user, or to make way for a door). Written about 3 s after anything changes (Guy pushes things too), when the tab is hidden and just before an update refresh. Restoring sets every piece straight to its saved spot, then moves any piece that does not fit (corrupt save, a door now in the way) to the nearest free place, and stands Guy on a free spot if furniture is where he starts. `?fresh` neither reads nor writes it. Order on a visit: catalogue extras, layout, the door of any added room (anything in its way comes out), start saving.
- **Not saved:** the easel painting, the lamp (on/off, colour), which record is on the stereo's table, Guy's own position and what he is doing.
- **Update refresh:** when the live `version.json` id differs from the running build: a tab coming back into view refreshes at once (no bar); a watched tab shows "Refreshing…" for 4 s with **Refresh** / **Later**; the layout is written first (`window.__guySave`); the same build is never refreshed for twice within 2 minutes (the bar then offers a manual Refresh, so a stale cache cannot cause a loop). Test hooks: `__guyUpdate.apply(id, source)`, `.flush()`, `.reset()`, `.reloadFn`. The live build is checked every 30 s while `UPDATE_DEBUG` is true in `src/update.js` (every 24 h when it is false; `?updates=<seconds>` overrides), and nothing reloads unless the build id differs. After a refresh a "Guy's room was updated" notice lists the entries of `src/whatsnew.js` (also written into `version.json` by `vite.config.js`) that the old page did not have: **add an entry there whenever a change worth telling the player about ships.** Hooks: `.showInstalled()`, `.setNews(list)`, `.everyMs`.

## Guitar riffs (`src/riffs.js`, activity `riff`)

- A riff is two bars of eighth notes (16 steps of a MIDI note or a rest) in a key (`root`, `minor`/`major` pentatonic). `invent()` wanders up and down the scale and answers its own phrase; `judge()` scores 0..1 on range (<= an octave), mostly steps (few leaps), a repeating phrase, density (6-13 notes), landing on the key note; **0.72 or more is good**. Tidy ideas are good ~76% of the time, messy ones ~30%, and he picks the best of 3 ideas.
- The `riff` activity: he takes the guitar, plays one or two riffs (each twice through: single notes over a bass note on each bar, the fretting hand following the pitch, the right hand picking), and puts it back. New riffs that score well are kept (the best 8, no duplicates) in `guy.riffs.v1` and replayed later ("playing one of his favourite riffs", about 4 in 10 sessions once he has any); a toast says "Guy made up a riff he likes! He'll remember it." `?fresh` keeps them in memory only. Needs the guitar object and the `guitar` skill. Weight 1.0 in his normal choices; it is one of the things a **Lock in** on the guitar cycles through (with `guitar` and `jamguitar`).
- Tested by `T.sweepRiffs` (pure logic with a test storage key) and, as an activity, by `sweepActivities`, `sweepInterrupts` and the pose sweep.

## The Workshop (`src/workobjects.js`, `workbrain.js`, `workshop.js`; stock and instances in `room.js`)

- **Where things go:** an added room's furniture is placed in the room's own frame (`SHOP_LAYOUT` in `room.js`: `n` metres in from the door wall, `lat` along it): the workbench and toolbox against the far wall facing the door, the Wood Factory and sander along one side wall, the saw and mallet block along the other. `world.shellPoint/shellAxes/rotFacing/shellSize/frameOf` do the sums, so it works on the right, front and back walls. `fits`, `findSpot` and `ownStandClear` use the room the spot is in (`boundsAt`); a strip inside the room in front of the door is kept clear like the one outside (`rectIn`). Pathing in an added room uses a grid of its own (`makeGrid(..., frame)`, `blocked.fr`); between rooms the walk is straight through the doorway.
- **A job is a trip:** `shopTrip` = in through the door (unless he is already inside), the steps, out again (unless he is locked on something in the Workshop). If he is ever cut short inside, his next choice is `leave`.
- **What he does:** `makewood` (press the factory button, wait, take the 4 planks, put them on the bench pile); `sawwood` (a plank from the pile to the sawhorse, saw it in two, the 2 parts to the bench); `tap` (practice taps with the mallet); `sand` (a plank from the pile, sanded, back); `tidytools` (open the toolbox, reach in, close it); `build` (picks a recipe he has read the book for: toolbox, planks from the factory if the stock is short, saw, take the parts to the mallet block and tap them together, to the sander if the recipe sands, the finished thing on the bench and +1 in storage, toolbox again). Recipes (`RECIPES` in `workshop.js`): foot stool (`workshop`, 4 parts, 8 taps), wooden shelves (`workshop.materials`, 6 parts, 10 taps, sanded), chair (`workshop.furniture`, 8 parts, 12 taps, sanded). A plank saws into 2 parts; the factory makes 4 planks a run.
- **Nothing appears by itself:** what he carries is shown in his hand (`brain.carry`: plank, planks, parts, piece); the stock changes as he puts things down; if he is cut short `workCleanup` puts it all back (carry, plank on the sawhorse, parts on the block, planks on the tray).
- **Storage:** `world.stock = { wood, parts, items }` (wood and parts shown as piles on the workbench; items = finished things waiting). Saved with the layout (`stock`, `instances`). Added from the Catalogue's "Built by Guy" cards ("In the room: n · In storage: m", Add); removing one (long-press) puts it back in storage; nothing built is ever deleted.
- **Hands:** the poses `workSaw`, `workTap`, `workSand` use two-handed IK (`computeWork` in `workbrain.js`): wrists, finger directions and palms, the saw and mallet follow the right hand, the piece being sanded sits between both. The work surfaces are waist high and he bends over them (the pose sweep's hand-error limit applies). Sounds: `saw`, `tap`, `sand`, `machine`, `lid`.
- **Tested by** `T.sweepWorkshop` (placement on all three walls, kind refusals, five whole builds from nothing on different walls, cut-short at every stage, Lock in on the workbench, storage and the Catalogue, saved layout round trip), plus `sweepActivities`, `sweepPoses`, `sweepInterrupts`, `sweepRemovals`, `sweepBooks`, `sweepObjects`, `sweepSounds`. `T.addObject` adds the Workshop first, `T.prep` sets `stock`, and `runAll` takes the room away after each sweep.

## The Restaurant (`src/restobjects.js`, `customers.js`, `customermodels.js`, `restbrain.js`; room and elevator in `room.js`)

- **Setup:** Rooms tab > Restaurant; Objects tab > Restaurant: Stove (brings "Restaurant Basics"), Kitchen Counter, Cash Register, Dining Table, Second Dining Table. Furniture goes in the room's own frame (`REST_LAYOUT` in `room.js`); the elevator is built by `addDoor` when the room entry has `elevator: true` (cabin 1.5 x 1.1 x 2.4 against the far wall, an obstacle; `world.elevatorPoint/elevatorYaw/setElevatorOpen/isElevatorOpen`).
- **Opening:** `world.restaurant.isOpen()`: room added, stove + counter + register + at least one table, **and Guy has read Restaurant Basics** (`skillOk`). Only then do customers arrive: one every 35 to 70 s, up to 3 at a time (one per free seat; 4 seats).
- **Customers** (`customers.js`: plain records with a figure drawn on top; `headless` skips the figures for the tests). States: `ride > exit > walk > sitdown > seated > waiting > ordered > cooking > cooked > eating > standup > walk > paying > thanks > leave > enter > ridden > gone`. They arrive by the elevator (the doors open for them and shut after), walk by A* to a free seat, read the menu, put a hand up (🙋), order (the dish emoji in a speech bubble), wait, eat (fork to mouth), stand up, walk to the till (💵), pay, and leave by the elevator. They never walk through each other or Guy (the newer waits; after 4 s it goes on). **Patience** 75 s: a customer nobody has taken the order of, or started cooking for, gives up (😞), leaves politely and pays nothing. Once the food is cooking they wait for it. Take their table away and they stand up and leave.
- **Who they are:** `customermodels.js` lists the characters (id, name, pack, file under `public/models/customers/`, height) and which packs are owned (`CUSTOMER_PACKS`); more packs are a line each. A model loads the first time that character arrives (a capsule stands in until then). `models/` (the Mixamo packs) is the user's asset folder and is never committed; optimise before adding big files (3 to 8 MB is fine).
- **Guy's jobs** (`restbrain.js`: ordinary activities with high weights while someone is waiting; **running the restaurant is a default, not a rule**: if he is busy elsewhere they wait): `takeorder` (walk to the table end, ask), `cook` (stir the pot 5 to 8 s with the lid off and the spoon in the right hand, plate to the counter), `serve` (plate off the counter, to the table, put it down), `takepay` (finger on the till, bell, +price coins), `rwait` (stand by the till; only while customers are about or he is locked on a restaurant object). Priority: pay, serve, take order, cook. He stays in the restaurant while customers are about (`restStays`) and leaves by the door when they are gone. Dishes (`DISHES`): soup 3, pizza 4, pasta 4, burger 5, cake 3 coins. Coins live in `world.stock.coins` (saved with the layout).
- **Nothing appears by itself:** he carries the plate in his hand (`brain.carry === 'plate'`); cut short, `restCleanup` puts it all back (an order not yet cooked goes back to waiting, a dish not yet served goes back on the counter). The one tidy-up not shown yet: a customer's empty plate disappears when they stand up (dishwashing is a later feature).
- **Staffing hook for later (GAL, see the plan):** the jobs are plain activities on `Brain`; a second robot can use the same `restaurant.find(job)` and claim logic.
- **Tested by** `T.sweepRestaurant` (placement on three walls, kind refusals, nobody arrives without the book, whole visits on three walls with every state in order, coins, sounds, three at once, patience, cut short at three stages, table and stove taken away, Lock in on the register, coins in the saved layout, room taken away), plus `sweepActivities` (`customer` in the manifest stages a customer in the right state with `restaurant.stage(state)`), `sweepPoses`, `sweepBooks`, `sweepObjects`, `sweepSounds`.

## Doors (long-press a door)

- A door is now a real doorway: the wall is rebuilt in three pieces round it, the leaf hangs from a hinge and swings away from the room (about 100 degrees in 0.8 s). Long-press the door > "🚪 Go into the <room>" (or "🚪 Come back" while he is inside): the menu has just that one button. Dragging a door does nothing.
- The `visit` activity: he walks to 0.8 m in front of the door, reaches for the knob (the door opens), walks straight through, has a look round three spots of the empty room (1.5-3 s each), walks back out, turns and shuts the door. Now and then he does it on his own (weight 0.4 while a door exists). `leave`: if he is ever in an added room and something cuts him short, his next choice is always to walk back out and shut the door; a request for something in his own room waits until he is out.
- `world.walkable(x, z)`: inside his own room, inside an added room, or in the doorway while the door is open (`moveBy` slides along the edge). `world.inMain`, `doorPoint(id, d)` (distance into his room, negative inside the added room), `doorYaw`, `doorKnob`, `setDoorOpen`, `updateDoors(dt)`. Pathing (the grid) is still only his own room: the walk through the doorway and round the added room is straight lines, fine for an empty room.
- Tested by `T.sweepVisit` (all three walls).

## Lock in and the speed control

- **Lock in** (long-press an object > "🔒 Lock in", or "🔓 Unlock" when he is already locked on it): `brain.lockOn(name)` runs the same checks and messages as Interact, then he keeps choosing from `brain.lockActs(name)` (only what he can do right now, never the same twice in a row when there is a choice) until told to stop. The HUD label starts with 🔒 and a "🔒 Locked on <object> · tap to stop" chip shows above the bottom buttons. Ends when: the chip or Unlock is used (`brain.unlock(true)` also wraps up the current activity), **Next** / Space is pressed, the object is removed, or he is told to use something else (Interact on another object, a book from the shelf list). Cutting an activity short does not end it. Chores still come first (put the guitar back, drop the ball). Locked on the guitar he keeps it in his hands between songs and riffs (picked up once, put back only when told to stop): `guitarBegin`/`guitarEnd` in brain.js, checked by `sweepLock`. Not saved between visits. Lock-able objects and what they cycle: guitar (guitar, riff, jamguitar), piano and bench (sitpiano, piano, jam*, plink), drums (bang, drums, drumsolo, jamdrums), easel (scribble, paint, mixpaint, portrait), telescope (peek, stargaze, darkstargaze, scopecare), lamp (mood, lamp), ball (dribble, toss, ball), stereo table (stereoon, then dance, dancemoves, ballroom, jam*), plants, shelf (read), any chair (read, sit, sitguitar). Things he cannot use (coffee table, nightstand, ...) have no Lock in.
- **Speed** (the dropdown beside Follow, `#speed-sel`, 1x / 2x / 3x / 4x, remembered in `guy.speed.v1`, always 1x under `?fresh`): scales his walking (and turning and pushing furniture) and the idle pauses between interactions (`brain.speed`). The interactions themselves (playing, reading, painting, waving ...) run at normal speed. Tested by `T.sweepLock` and `T.sweepSpeed`.

## Regression watch (bugs found and fixed; make sure they stay fixed)

- Restaurant: two customers leaving the elevator together stood on top of each other (`clearToExit`; customers also yield to older ones). `T.settle()` inside the restaurant with customers about runs for 90 s because he keeps working: tests `r.clear()` first (or stub `r.find`) before settling.

- Furniture put away from an added room kept its `home` in that room; when the room was gone "Put back" dropped it into Guy's room. `rooms.reset` now clears what was put away from the room too (`sweepWorkshop`).
- `wave` walked to the fixed spot (0, 2.2) even when a piece of furniture stood there (the telescope in some layouts: 31 arm-inside samples). It now waves from the nearest open spot (`openSpotNear`).
- `sweepLayout` turned the armchair and left it turned: `openChairs` then found its sitting spot outside the room and later sweeps (`lock`) were refused. It now puts every rotation back.
- Reading / walking-past-furniture flakes (see below) showed up in 1 of 5 full runs after the Workshop work (read with the easel, mood with the telescope, a book held while removed), the same family as before; none in the other 4.
- `workCleanup` runs when a job is cut short, so a stock reset right after must happen after `T.settle()` (`shopSetup` does it that way).

- "Sit Down" on a chair sent Guy to the bookshelf: Interact on a chair picked at random from read / sit / sitguitar, and read won half the time. A chair now means sit (6 of 6 in a check; `sweepLock` still cycles read, sit, sitguitar on purpose).

- **Fixed:** the bookshelf had no capacity: with all 19 unlocked books added, `stars`, `darksky` and `scopecare` floated past the end of the shelf. It now holds 16 (slots 0-15) and the rest lie flat in a stack on the floor beside it (spine to the room, each resting on the one below, an obstacle, moves with the shelf). Guy takes only the top book, squatting to it, and puts it back on top. `T.sweepShelf`. The long-press book list (19+ rows) used to run off the screen: it now scrolls inside the screen (`#albummenu` has a max height).
- Intermittent, older than the Rooms work (cause not found yet): reading-related sweeps fail now and then on a random layout: `sweepBookRules` ("speed reading: ... sits in a chair"), `sweepSounds` ("reading makes a sit sound"), `sweepMoves` ("moved while in use: read"), and `sweepActivities` `read` (arm inside the easel while walking past, 8 samples). Measured on 12 loops of objects, activities, moves, bookRules and sounds: the checkout before the Rooms work failed bookRules 1 and sounds 1; the checkout with rooms, doors, layout and update failed activities 3 and bookRules 1. Too few runs to say the second is worse. If it comes back, note the layout (`T.state()`, `Object.keys(brain.w.objects)`) and which chairs were reachable.

- Removing an object mid-interaction used to throw every frame and freeze rendering: `sweepRemovals` and `brain.safeUpdate`.
- Negative beat index right after a track starts crashed the guitar/piano jam ("reading 'bass'"): `sweepTracks`.
- Arm reaching blended by rotation swung the elbow behind his back; reach now blends in space: grab pose trace.
- Book model was mirrored (pages faced away); hands swept behind the page on a page turn: read-sit / read-turn.
- Guitar floated away from his body; right hand went through it; left hand roll: guitar-play.
- Walking past furniture swung his arms through it: arms now tuck in (`armRoom`); a graze still shows in `warnings`.
- Arm IK chose the wrong palm side for the left hand until verified from the finger curl direction.
- `sweepObjects` once showed that the plant could only be tended from its front: now `sideStep` (any free side).
- Kicking/dribbling a ball that rests against furniture put Guy inside the furniture: kick and ball-stand spots must be free (`ball`, `ballStand` plan steps). Found by `sweepObjects` as an intermittent failure; always chase intermittent failures.
- New objects were once placed on top of the spots Guy stands to use the stereo/piano, or squeezed against the back wall so he could not walk round them (`findSpot` now avoids stand spots and keeps 0.55 m to the walls). Symptom: `jam`/`dance` overlap sweeps failing only in some layouts; run `runAll` several times.
- Dribbling next to a thin object (telescope tripod): `ballStand` prefers spots with 0.5 m of room.
- Kicking and dribbling beside furniture (piano, lamp, telescope, drums) grazed the furniture's box in some layouts: kick/ball stand spots now need 0.55-0.62 m of clearance (`ball`, `ballStand`). Baseline after this: ~19 consecutive `runAll` runs, one 5-sample graze (ball near the drum kit) and otherwise 143/143.
- Book list popup: an unread entry calls `brain.requestRead(id)`; check he fetches that exact book (verified by hand: Piano Playing for Robots picked from the list was the book he took).
- Guitar pickup/put-down: the right wrist was forced into the strumming hand orientation while gripping the neck on the stand (hand flat, wrist cocked). The exact hand orientation now only applies once the guitar is on him (`handBlend` in `computeGuitar`). Add visual checks `T.moment('guitar','takeGuitar',1.3,'front')` and `('guitar','putGuitar',0.8,'front')`: wrist straight, fingers along the neck.
- Putting a book back: once the book was let go (`held` = null) the shelf target was lost and the hand reached for the world origin, swinging the arm behind him. `bookTargets` now caches the slot (`s.shelfCache`). Check: `putBook` hand z in his frame never goes below about -0.15.
- The pose sweep (`T.sweepPoses`) found the fretting wrist bent ~153° (a wrist manages ~90): the guitar was slung too low, so the forearm ran steeply down to the neck while the fingers pointed up. The guitar is now held higher with the neck raised (hold y 1.05, tilt 0.55) and the fingers angled along the neck; the exact hand orientation applies only once the hand is on the neck. Also the `scopeWrong` hand on the barrel (115°).
- Why the old sweeps missed these: they check completion, exceptions, feet and box overlap only. Anything about *how a pose looks* needs `sweepPoses` or a visual checkpoint. When a visual bug is reported, first ask which measurable invariant it violates and add that to `sweepPoses`.
- The top shelf only had room for 5 record sleeves (a 6th stood outside the shelf): sleeves now overlap when crowded (`layoutAlbums` in `src/room.js`). `sweepRecords` must pass with `?records=all` (12 records).
- The rug, picture and windows used to be fixed meshes that could not be removed; they are `world.decor` now. `fits()` also keeps furniture out of wall pieces, and `decorFits()` keeps wall pieces off the Catalogue and each other. Run `T.sweepDecor()`.
- Putting a removed object back (`restoreObject`) only checked that it fitted at its old spot, so the easel could return right in front of the drum kit with its standing spot blocked (found as an intermittent `paint` / `scribble` failure with `drums` overlaps in the second `runAll`). It now also needs its own standing spot clear and must not sit on someone else's (`ownStandClear`, `onSomeonesStand` in `src/room.js`). Run `runAll` at least twice in a row: the second run starts with the room full.
- Asking for another book while he was reading one made him wander off (tend plants, wave, play piano) still holding the first book, and only put it back much later. `choose()` skipped "put it back" whenever `albumOnTable` was true, and the flag could be left stuck on (for example by stopping the stereo from the player while a record was out). Now only a record that is really standing by the stereo with its music playing is exempt; taking a book clears the flag; putting a record back with the music off clears it. Covered by `T.sweepHolding`.
- Guy kept playing the same tune: each record had one looping track and nothing ever moved on. Records now have four songs and the stereo hands over to the next one on the same record after about a minute; Guy avoids the last record and song he played. `T.sweepPlaylist`.
- The drum kit counted as "arm inside the drums" over its whole bounding box, which is mostly air, so walking past its corner failed runs intermittently once the room was crowded. The overlap check now only counts a hand near a drum, a cymbal, the kick or the stool (`inKit` in `src/devtools.js`).
- Drum kit (or easel) pushed against a wall with the stool (or easel) side to the wall: Guy walked into the wall for about 50 s (two 25 s walk timeouts) and then sat down by snapping into place. `Brain.standOk` now makes the activities unavailable when the standing spot is outside the room or inside another object (Interact explains), and a walk gives up, with its activity, when the distance left on its path has not shrunk by 20 cm in 5 s. Covered by `T.sweepWalls`.
- Dragging or turning an object while Guy was using it pulled his arms along with it (the hands track the object's keys / pads / canvas). `checkMoved` now makes him let go (`sweepMoves`).
- Fretting hand floated 8-14 cm off the neck with the wrist bent: the wrist is now placed from where the knuckles should rest on the neck (`neck` and `wrist` limits in `sweepPoses`).
- Songs: a record plays each song for at most 20 s (`trackSeconds`, checked in `sweepPlaylist`); longer forms are cut at 20 s.
- `piano` activity with no bench in the room threw inside `benchAway` and fell through to a random activity; it now just skips moving the bench.
- `sweepWalls` could fail depending on where earlier sweeps left the drums (the easel's stand spot was inside them): each case now parks the other object clear first.
- Forgetting a book leaves a gap on the shelf (books keep their slots; nothing slides along), and `takeBook` ignores a book that was forgotten on the way to the shelf.
- `sweepBookRules` must set `forceBook` after `T.settle()` (settling can start a random read that uses the request up).
- `OVERLAP_FAIL` is now 6 samples: 4-5 sample overlaps were walking past a box at the edge of the 0.28 m safety margin (easel, chairs); every real clip so far was 8+.

## Sound effects (`src/sfx.js`; hooks in brain.js, hobbybrain.js, main.js, room.js)

| Event | Sound |
|---|---|
| ball hits floor / wall / furniture / ceiling | `bounce`, `wallbump`, `knock` (by speed); kicked: `kick`; dribble bounce; set down |
| book taken from the shelf / returned, opened, page turned, closed | `bookgrab`, `bookclose`, `bookopen`, `page`, `bookclose`; record sleeves: `sleeve` |
| furniture pushed by Guy or dragged by the user | continuous `drag` scrape (pitch by weight); drop: `place` |
| guitar picked up / put back | `guitar` (knock + soft strum) |
| lamp switch, stereo button | `click` |
| sitting on a chair, bench, stool | `sit` (thud + creak) |
| plant leaf, brush stroke, paint dab, telescope focus, wiping | `leaf`, `brush`, `dab`, `tick`, `wipe` |
| footsteps | `step` |
| Guy learns something, Catalogue adds | `chime`, `pop` |

Checked by `T.sweepSounds` (event -> counted request). Whether it *sounds* right can only be judged by listening. Press **M** to mute the effects.
- Guy used to keep building foot stools and shelves forever, and none were used. Each recipe now has a `cap` in `src/workshop.js` (stool 1, shelves 2, chair 2, counting what stands in a room plus what is in storage); `pickRecipe` skips a recipe at its cap, so `build` becomes unavailable once he has made them all. Tests that force `b.pickRecipe` bypass the cap.
