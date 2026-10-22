# Asset reference for testing (keep in sync with the game; see SKILL.md section 6)

Last verified against: 13 objects, 20 books, 5 records, 6 tracks, 38 activities, 35 poses. `T.coverage()` is the
machine check of this list; this file adds the expectations a human or Claude needs.

## Objects (`OBJECT_CATALOG` in `src/machine.js`, built in `src/room.js`)

| id | what | weight | Guy's skill | Interact does | Where he stands / touches | Notes |
|---|---|---|---|---|---|---|
| piano | upright piano | heavy (never pushed by Guy) | `piano` | skilled: `sitpiano` or `piano`; unskilled: `plink`; stereo playing: `jamsit`/`jampiano`/`jam` | 0.8 m in front of the keys, or on the bench; hands on keys (IK follows the notes) | needs the bench out of the way when standing |
| bench | piano bench | light | `piano` | as piano | fetched and pushed to 1.65 m in front of the piano; he steps into the gap, sits back, scoots it in | moved only by Guy |
| table | stereo + table (boombox rides on it) | medium | `stereo` (not needed if the music is already on) | `dance`, `jam`, `jampiano` | 0.55 m in front; index finger on the button | removing it stops the music |
| shelf | bookshelf, books on rows 3 and 2, records on the top row | heavy, **not removable** | none | `read` | 0.62 m in front (0.5 for the top row) | long-press top row opens the record list |
| lamp | floor lamp | light | `lighting` for moods/party | `lamp` (toggle) or `mood` | any free side, finger on the stem switch | party mode during a dance when he has `lighting`+`stereo` |
| armchair | armchair, faces local -z | medium | none | `read` | sits back onto it; legs hang clear of the front | seat top 0.5 m |
| plant | potted plant | light | none | `plant` | any free side, finger on a leaf | |
| ball | red ball (not an obstacle) | n/a | `ball` | `dribble` / `toss` / `ball` (kick); unskilled: only pokes it | kinematic while he holds it | removable via the menu |
| guitar | acoustic guitar on a stand (added from the Skill Machine; brings its own book) | light | `guitar` | `guitar`; stereo playing: `jamguitar` | takes it off the stand, strap over the left shoulder; right hand strums, left hand frets | |
| drums | drum kit + stool (kit faces local -z, stool at +z; added free, brings `Drumming for Robots`) | medium | `drums`, `drums.solo`, `drums.band` | unskilled `bang`; `drums` / `drumsolo`; stereo playing + band skill: `jamdrums` | side-steps onto the stool from 0.55 m to its right; sticks come off the snare, tips follow the pads (`obj.pads`); right foot works the kick | stick tips land within ~10 cm of the pad at each hit (`hitErr` idea: compare fingertip-stick tip to pad at the trigger frame) |
| easel | painting easel; canvas is a live `CanvasTexture` (`obj.paint`) | light | `easel`, `easel.colour`, `easel.portrait` | unskilled `scribble` (finger, grey); `paint`, `mixpaint`, `portrait` | stands 0.59 m in front of the canvas; palette picked up from the tray into the left hand and put back; brush tip draws the stroke as it moves; old paintings are washed over with white strokes, never cleared by magic | check the canvas in a screenshot: strokes must appear where the brush is |
| telescope | tripod + aimable tube (`obj.setAim`) | light | `telescope`, `telescope.dark`, `telescope.care` | unskilled `peek` (wrong end); `stargaze`, `darkstargaze`, `scopecare` | swings the tube with one hand, then stands behind the eyepiece with knees bent / waist leaning, eye at the eyepiece, left hand on the focus knob | `darkstargaze` switches the lamp off first and back on afterwards (`lampOffByMe`, forced `lighton` if interrupted) |
| workbench | **locked / premium**: listed, no builder yet | | | | | tests only check it stays locked |

Skill Machine rules: removed objects show "Put back"; the shelf can never be removed; the machine itself is fixed to the
left wall and cannot be removed, moved or rotated.

## Books (`BOOK_CATALOG` in `src/skills.js`)

| id | title | teaches | requires | proof activity (`MANIFEST.books.then`) | start on shelf |
|---|---|---|---|---|---|
| stereo | Stereo User Manual | `stereo` | | `dance` | yes |
| piano | Piano Playing for Robots | `piano` | | `piano` | yes |
| ball | Let's Play Ball | `ball` | | `dribble` | yes |
| lighting | The Power of Lighting | `lighting` | | `mood` | yes |
| piano2 | Piano: Classics, Blues & Waltzes | `piano.advanced` | piano object | `piano` | no (Skill Machine) |
| guitar | Guitar for Beginners | `guitar` | guitar object | `guitar` | comes with the guitar |
| dancemoves | Dance Moves for Robots | `dance.moves` | stereo (`table`) object | `dancemoves` (twist, shuffle, twirl) | no (Skill Machine) |
| ballroom | Waltz & Swing | `dance.ballroom` | stereo (`table`) object | `ballroom` (waltz with a turn, swing) | no (Skill Machine) |
| drumming | Drumming for Robots | `drums` | drums object | `drums` | comes with the drum kit |
| drumsolo | Fills & Solos | `drums.solo` | drums object | `drumsolo` | no (Skill Machine) |
| drumband | Playing in the Band | `drums.band` | drums object | `jamdrums` (needs music) | no (Skill Machine) |
| painting | Painting for Robots | `easel` | easel object | `paint` | comes with the easel |
| colour | Colour Mixing | `easel.colour` | easel object | `mixpaint` | no (Skill Machine) |
| portrait | Portraits & Landscapes | `easel.portrait` | easel object | `portrait` | no (Skill Machine) |
| stars | Stargazing for Robots | `telescope` | telescope object | `stargaze` | comes with the telescope |
| darksky | Dark Sky Rules | `telescope.dark` | telescope object | `darkstargaze` | no (Skill Machine) |
| scopecare | Looking After Your Telescope | `telescope.care` | telescope object | `scopecare` | no (Skill Machine) |
| woodwork | premium | | workbench | | locked |

Guy learns a skill only after keeping the book open for 8 s; interrupted reads teach nothing.

## Records and tracks (`src/albums.js`, `TRACKS` in `src/audio.js`)

| record | track | bpm | status |
|---|---|---|---|
| Happy Time Parade | `happy` | 132 | free (Skill Machine > Records) |
| Hits from the Old Days | `classical` | 100 | premium (dev bypass in tests) |
| Sad Country | `country` | 72 | premium |
| Blues Collection | `blues` | 94 | premium |
| Out like a Lamb | `lullaby` | 66 | premium |
| (stereo's own beat) | `default` | 110 | always |

Records live on the top shelf row. A stereo session may fetch one (75%): grab (top-shelf IK), carry by the top edge,
stand it against the boombox, play, pick it up, put it back. The user can instead start/stop/select tracks from the stereo's
playback panel or the top-shelf record list; Guy then joins in without touching the stereo.

## Activities (`activities()` in `src/brain.js`)

wander, stretch, wave, piano, sitpiano, plink, jam, jampiano, jamsit, dance, lamp, mood, plant, read (alias `books`),
rearrange, ball, dribble, toss, guitar, jamguitar, bang, drums, drumsolo, jamdrums, scribble, paint, mixpaint, portrait, peek,
stargaze, darkstargaze, scopecare, dancemoves, ballroom; internal recovery: putback, putguitar, dropball, lighton.
Needs and allowed arm contacts are in `MANIFEST.activities`.

## Visual checkpoints (`T.moment(...)`, then screenshot)

| id | run | look for |
|---|---|---|
| read-grab-mid | `T.moment('read','grab',1.2,'hand:Right')` | thumb-up handshake grip around the book; arm in front of him (never swinging behind him) |
| read-sit | `T.moment('read','readSit',8,'front')` | book open, **pages face Guy**, both hands on the lower edges, legs hang clear of the chair |
| read-turn | `T.moment('read','readSit',0,'front',{turning:true})` | right hand on Guy's side of the pages while the page flips |
| guitar-play | `T.moment('guitar','guitar',7,'front')` | guitar held high on his chest, neck raised ~30°, with strap; right fingers hang over the strings, palm to them; left wrist under the neck, fingers up, thumb toward the headstock; nothing through the body |
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
| dance-twist | `T.moment('dancemoves','twist',4,'front')` | hips and shoulders twist opposite ways, knees bent and apart |
| dance-shuffle | `T.moment('dancemoves','shuffle',4,'front')` | one foot slides forward at a time, elbows pumping alternately |
| dance-twirl | `T.moment('dancemoves','twirl',2.5,'front')` | arms out, spinning on the spot (`fx.spin`) clear of furniture |
| dance-waltz | `T.moment('ballroom','waltz',5,'front')` | arms in a dance hold, slow turn |
| dance-swing | `T.moment('ballroom','swing',4,'front')` | arms swinging wide, alternate knee kicks |
| record-carry | `T.moment('dance','walk',0,'front',{album:true})` | sleeve hangs from the hand by its top edge |

Other things to eyeball once per release: the Skill Machine screen on the wall, the record list popup, the playback
panel, the skills panel (K), the strap on the guitar, record sleeves on the top shelf, spine titles on the books, and the
book list popup (long-press a lower shelf at a book: title, read / not read).

## Regression watch (bugs found and fixed; make sure they stay fixed)

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
