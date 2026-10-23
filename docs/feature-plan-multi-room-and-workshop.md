# Feature Plan: Additional Rooms, Premium Gating & the Workshop

**Date:** 2026-10-22
**Status:** Plan only. No app code has been written. This replaces the earlier partial draft in this file.

---

## Build status

**Phase 1 to 4 (rooms, gating, doors, the room behind the door) are built, with their QA sweeps.** Differences from the plan below:
- Rooms are saved in their own key, `guy.rooms.v1`, so `guy.room.v1` is untouched and no migration was needed.
- The Workshop is an empty grey room for now (floor, three walls, ceiling). Pegboard, lights and objects come with the later phases.
- Guy can now go through the door (long-press it): straight-line walking through the doorway and round the empty room, an opening door and a real doorway in the wall. Full pathing across rooms (the grid) is still only his own room.
- The door is closed (no opening animation yet) and has a sign on both faces, because the right and front walls are not drawn from the default camera.
- The saved door is placed again at the start of a visit, before the Catalogue's extras. Core wall pieces the user removed come back on a new visit (existing behaviour), so anything in the door's way is taken out again.
- Sweeps added: `sweepRooms`, `sweepDoors`, `sweepGating`, `sweepSaves` (in `runAll`). `sweepMachine` now counts only listed objects.

**The Workshop wood line (built):** workbench, toolbox, Wood Factory, saw and sawhorse, rubber mallet and block, sander (section 9), the three books (Workshop Basics, Wood & Metal Basics, Furniture for Robots; the old `woodwork` entry is gone), materials and storage (`world.stock`, saved with the layout), and Guy building a wooden foot stool, wooden shelves and a wooden chair himself: planks from the factory, sawn, tapped together with the mallet, sanded, finished (`build`, `workbrain.js`, `sweepWorkshop`). Built things wait in storage and are added from the Catalogue's "Built by Guy" cards as real objects of their own (a built chair is a chair he can sit on). Objects now live in added rooms (placement, a pathing grid per room, a clear strip inside the door, saving). Differences from the plan: the saw, mallet and sander are stations (a sawhorse, an assembly block, a belt sander) because a hand tool cannot stand alone in a room; storage is the Catalogue's count, not a physical shelf yet; the toolbox is on a little frame so he can reach it standing up; every recipe's numbers are in `workshop.js`. **Not built yet:** the metal line (factory, cutter, welder, hammer, the metal book and builds), the picnic and kitchen tables, the nightstand build, a physical storage shelf, and Guy building a chair or a bookshelf on his own initiative and recycling spare chairs (section 17.3, 17.4).

**Round two (section 17):** rooms are now as big as Guy's room, and the speed dropdown, Lock in and guitar riffs are built. Going through doors, Guy building chairs and a second bookshelf, and the shelf overflow fix are planned in section 17.

**Also built:** saving every object's position, turn and removed state (`src/layout.js`, `guy.layout.v1`, `sweepLayout`) and an automatic refresh when a newer build is deployed (`src/update.js`, `sweepUpdate`). This changes the plan's section 9A: built copies, when they exist, must be part of the layout snapshot (one entry per copy), and the saved layout restores before the Catalogue's extras are counted. The easel painting, the lamp and Guy's own position are not saved yet.

---

## 1. Summary

Five connected changes:

1. **Rooms in the skill machine.** The Catalogue can add additional rooms. Each added room puts a door in a wall of the room Guy is already in.
2. **Door placement.** The door goes on a wall. If an object is in the way, it is moved off the wall first.
3. **Premium gating.** Items that belong to a locked (premium) room are not listed in the Catalogue at all until that room is unlocked. Then they appear.
4. **The Workshop.** The first additional room. Guy can walk through the door and use what is in it.
5. **Workshop objects and books.** A workbench, a toolbox, a metal line (factory, welder, cutter, hammer), a wood line (factory, saw, mallet, sander), and three books.

A future room, the **Restaurant**, is noted in section 12 but not planned in detail.

---

## 2. Current State (what the plan builds on)

All references are to the code as it stands today.

| Area | Where | What it does now |
|---|---|---|
| Room size | `src/room.js:5` | `ROOM = { w: 10, d: 8, h: 3.2 }`. The floor is x in [-5, 5], z in [-4, 4]. |
| Walls | `src/room.js:50-53` | Four walls. Back at z = -4, front at z = +4, left at x = -5, right at x = +5. |
| Wall pieces | `src/room.js:349-416` | Pictures, windows, the wall light and the rug are "decor". Each has a `wall` of `'left'` or `'back'`, and can be dragged, removed and put back. Nothing is on the right or front wall today. |
| Catalogue | `src/room.js:360`, `:587` | Fixed to the left wall (`MACHINE_RECT`). Tapping it opens the Catalogue. A door cannot go over it. |
| Bookshelf | `src/room.js:210` | Can be moved, never removed. |
| Catalogue data | `src/machine.js:24-56` | `OBJECT_CATALOG` with `core`, `free`, `locked`, `book`, `decor` flags. `workbench` already exists here as a locked furniture entry. |
| Premium albums | `src/machine.js:78`, `src/albums.js` | `premium` albums show in a "Premium · coming soon" group with a 🔒. |
| Books | `src/skills.js:9-50` | `BOOK_CATALOG` with `start`, `requires.object`, `locked`. `woodwork` ("Woodworking for Robots") is already a locked book that needs a `workbench`. |
| Persistence | `src/machine.js:58` | Key `guy.room.v1`. `restoreExtras()` restores additions on load. |
| Pathfinding | `src/brain.js:932`, `:2186` | Guy's reachable area is hard-coded to the one room (`|x| <= 4.5`, `z` in [-3.5, 3.6]). The grid is built from the single room's walls. |
| Camera | `src/main.js:67-87` | `fitRoom()` frames one fixed box (x ±5, z ±4). A second room must be added to this framing. |
| Test harness | `src/devtools.js:32-90` | `MANIFEST` lists objects, books, albums and activities. `T.coverage()` must report `complete: true`. |

**Design rules that apply** (from project memory): no magic movement (objects only move when Guy pushes them or the user drags them); heavy objects stay where they are, moved only by the user; the bookshelf and the Catalogue can never be removed; Guy's hands use IK.

These rules conflict with some parts of the request. Section 3 lists the conflicts as decisions.

---

## 3. Decisions Needed Before Building

These are the points where the request and the current design rules disagree, or where the request leaves a gap. Each has a proposed default.

1. **Moving an object out of the door's way (rule conflict).** The request says to remove a blocking object. The design rules say no magic movement, heavy things stay put, and the shelf and Catalogue are never removed.
   - *Proposed default:* the door-placement search (section 5) works in this order:
     1. Pick the wall that has a clear stretch with no fixed pieces. Prefer the right wall (x = +5), which has no wall pieces today.
     2. If a decor piece (picture, window, light, rug) blocks it, move that piece to `world.removed`, the same way the user removes it. This is a removal, not a silent move, so it fits the rules.
     3. If furniture blocks it and is movable, remove it the same way. Heavy furniture and the shelf are never moved. If a clear stretch exists nowhere on any allowed wall, the room cannot be added and the Catalogue says why.
   - *Question for you:* is a removed item only put back from the Catalogue, or should it also come back to its old spot when the room is removed later?

2. **Is the Workshop premium, or free to add?** The request uses "premium room" for locked rooms and also says the Workshop is added and then entered.
   - *Proposed default:* two flags per room. `added` (the user adds it from the Catalogue, which places the door) and `unlocked` (premium, paid later). The Workshop is `added` by the user and `unlocked` by default. The premium mechanism is built now but only the future Restaurant would use it.
   - *Question:* is the Workshop free, or should it be locked until a later unlock?

3. **Existing "Premium · coming soon" group.** Today, premium albums and some books appear under a locked heading. The request says room-gated items should not be listed at all.
   - *Proposed default:* room-gated items are hidden entirely. The existing premium albums keep their current behaviour, since they are not room items.

4. **Existing `workbench` and `woodwork` entries.** `workbench` is a locked furniture entry today, and `woodwork` needs it.
   - *Proposed default:* move `workbench` into the Workshop (`room: 'workshop'`) and keep the `woodwork` book as the advanced book, or retire it in favour of the new books (decision 6).

5. **What the materials are.** "Can't build a metal object without metal" implies a stock of pieces that factories produce and builds consume.
   - *Proposed default:* a per-material stock on the workbench, shown as a count (for example "Wood pieces: 3"). The factory adds to it, the saw and cutter turn it into usable parts, and builds take them. The stock is saved with the room state.
   - *Question:* should pieces be physical objects Guy carries and sets down, or an invisible count?

6. **What gets built.** The request names the tools but not the finished objects.
   - *Needed from you:* a list of the things Guy can build (a shelf, a stool, a metal stand, etc.), each with the materials and tools it needs. Until then the plan builds the tools and the stock, with one example build per material to test the chain.

7. **Shelf and Catalogue on the wall.** If the right wall is ever blocked, the next choice is the back or front wall. The shelf and Catalogue cannot move, so the plan never places a door over them.

---

## 4. Rooms in the Skill Machine

### 4.1 Room data model

A single source of truth for rooms, in a new `src/rooms.js` (no code yet):

```javascript
export const ROOM_CATALOG = [
  { id: 'main', name: "Guy's Room", core: true },
  { id: 'workshop', name: 'Workshop', added: false, unlocked: true,
    style: 'concrete', w: 8, d: 6, h: 3.2,
    doorWall: 'right' },   // on the main room, the wall the door is placed on
];
```

- `main` is always present and is never added or removed.
- `added` and `unlocked` are separate (decision 2).
- The room state is saved in `guy.room.v2` (a new key). A migration reads `guy.room.v1` once, so existing saves keep their objects. Old saves get `added: false` for the Workshop.

### 4.2 Catalogue UI

- A new **Rooms** section at the top of the Catalogue (before the Objects tab).
- Each room shows one of: **Add to my home** (free to add), **In your home** (added), or nothing (not yet unlocked, and not listed, per decision 3).
- Adding a room calls the door placement (section 5), then the Workshop's contents become listed in the Objects and Books tabs.
- Adding an already-added room does nothing and says so.

### 4.3 Adding a room, step by step

1. The user taps **Add the Workshop** in the Catalogue.
2. The door placement search runs (section 5). If it finds no clear spot, the Catalogue says "No clear wall for a door right now" and nothing changes.
3. Any objects the door displaced are put in `world.removed`. The Catalogue notifies each one ("Took the Picture out of the room to make room for the door").
4. The door is built, the Workshop group is built beside it, and `added` is set to `true`.
5. The new room's objects become available in the Catalogue as their books and prerequisites allow.

---

## 5. Door Placement

### 5.1 Door size and position

- Door: about 1.0 m wide, 2.2 m tall, starting at floor level.
- Placed on a wall as a piece with `u` (along the wall) and `v` (height), using the same wall conventions as decor (`room.js:351`).

### 5.2 Search for a clear door spot

1. Candidate walls, in order: **right** (x = +5), **front** (z = +4), **back** (z = -4). The left wall is excluded because of the Catalogue.
2. For each candidate wall, slide a door-sized window along the wall in 0.1 m steps.
3. A position is **clear** when no fixed piece (shelf, Catalogue, heavy furniture) overlaps the window. The window also needs a walkable strip in front of it so Guy can reach the door.
4. Movable pieces that overlap are listed as **displaceable**.
5. Choose the position with the fewest displaceable pieces, then the one nearest the middle of the wall.

### 5.3 Clearing the way

- Displaceable decor and wall pieces are removed through the existing removal path (`world.removeObject`), so they can be put back from the Catalogue.
- Displaceable movable furniture is removed the same way.
- Nothing is moved silently (section 3, decision 1).

### 5.4 Door visual

- A door frame and a door leaf on the wall. Open by default, with a brief opening animation the first time the room is added.
- The door is a wall piece in the decor sense: it is not an obstacle for pathing once Guy can pass through it.

---

## 6. Premium Gating in the Catalogue

- Every object and book that belongs to a room gets `room: '<id>'` in its catalogue entry.
- The Catalogue filter is: an item is listed only if its `room` is `main`, or that room is `unlocked` **and** `added`.
  - An item in a room that is not unlocked is not listed at all (not even as locked).
  - An item in an unlocked room that has not been added yet is not listed either. Its room has to be added first (section 4.3).
- When a room is unlocked, the Catalogue re-renders. Its items appear with no reload.
- `machine.js:78` (`if (a.premium) return 'locked'`) stays as it is for albums. Room gating is a separate check, applied first.

---

## 7. The Multi-Room World

This is the largest technical part. Today the whole game assumes one room.

### 7.1 Room geometry

- Each room is its own `THREE.Group` with its own walls, floor, ceiling and objects, placed in world space beside the main room.
- The Workshop sits beyond the door wall. With the door on the right wall, the Workshop is at x from +5 to about +13.
- Each room has its own `obstacles`, `decor`, `objects`, `removed` and `ROOM`-like dimensions. Nothing is shared between rooms except Guy and the light switch rules.

### 7.2 Guy's movement

- The walkable area becomes the union of the rooms Guy can reach. The reachable test (`brain.js:932`) and the grid (`brain.js:2186`) are built from every added room, with the door cells open.
- A **room transition** step: when Guy's path crosses the door, a short step plays (a pause on the threshold, then on). The door is not an obstacle for the path, but it is not walked through without the transition.
- Objects in another room are looked up with `this.obj(name)` at step time (project rule). The activity only runs when the room holding the object is added.

### 7.3 Camera and lighting

- `fitRoom()` (`main.js:67-87`) frames all added rooms, so the Workshop is in view when it is added. The user's own camera moves still win (current behaviour).
- Each room has its own light setup. The main room's lighting (window light, lamp) stays unchanged. The Workshop uses a cooler, functional light.
- The wall lights and the lamp only light their own room.

### 7.4 Saving

- Rooms, their doors, each room's objects and the material stock are saved together (section 4.1).
- Restoring a save rebuilds every added room before the Catalogue is drawn.

---

## 8. The Workshop Room

### 8.1 Look

- Concrete floor (no wood stripes), grey-cream walls, a roll-up door on the far wall (optional), pegboard on one wall for tools.
- Cooler, brighter light than the main room.

### 8.2 Layout (indicative)

- Workbench near the middle of the far wall.
- Toolbox beside the workbench.
- Metal line on one side: metal factory, welder, metal cutter, metal hammer.
- Wood line on the other side: wood factory, saw, rubber mallet, sander.
- Clear walking paths between them, so Guy's pathing has room.

### 8.3 Workshop catalogue category

Add a new category `workshop` to `OBJECT_CATEGORIES` with sub-headings:
- **Workbench & storage:** Workbench, Toolbox
- **Metalwork:** Metal Factory, Welder, Metal Cutter, Metal Hammer
- **Woodwork:** Wood Factory, Saw, Rubber Mallet, Sander

---

## 9. Workshop Objects

Each object lists its category, room, weight (project rule), what Guy does with it, and what it needs. Sizes are approximate.

### 9.1 Workbench

- **Catalogue:** `workbench`, cat `workshop`, sub "Workbench & storage", `room: 'workshop'`, weight `heavy`.
- **Size:** about 1.6 m x 0.7 m x 0.9 m.
- **Look:** wooden top with grain, four legs, a tool rack on the back, a vise on one end.
- **Use:** Guy works here on projects. He can't build without it. He can only put materials on it when it is in the room.
- **Books:** the "Workshop Basics" book (section 10) teaches the workbench.
- **Note:** replaces the existing locked `workbench` entry (decision 4).

### 9.2 Toolbox

- **Catalogue:** `toolbox`, cat `workshop`, sub "Workbench & storage", `room: 'workshop'`, weight `medium` (Guy can push it).
- **Size:** about 0.5 m x 0.3 m x 0.35 m.
- **Look:** a red box with a hinged lid, a handle on top and a metal latch.
- **Use:** Guy takes a tool from the toolbox before he uses it and puts it back after. A tool is only in use while he holds it. The toolbox sits on the floor or on the workbench.
- **Needs:** the workbench is in the room (for a sensible place to work), but the toolbox works without it.

### 9.3 Metal line

| Object | Weight | Role | Needs | Notes |
|---|---|---|---|---|
| **Metal Factory** | heavy | Spits out metal pieces onto a tray, for Guy to collect. Works like the Wood Factory (9.4). | Power (the room lights) | Without it there is no metal, and no metal build can start. |
| **Welder** | medium | Joins metal pieces into a new metal object. | Metal pieces, the Welder's stand area, the metal hammer optional | Sparks and a glow when welding. |
| **Metal Cutter** | medium | Cuts metal pieces to length. | Metal pieces | Only cuts metal, never wood. |
| **Metal Hammer** | light (a hand tool) | Shapes and pounds metal pieces. | A metal piece on the workbench | Keeps the workbench in use while shaping. |

Dependency chain: **Metal Factory → metal pieces → Metal Cutter → metal parts → Welder → metal object**. The Metal Hammer shapes parts before welding.

### 9.4 Wood line

| Object | Weight | Role | Needs | Notes |
|---|---|---|---|---|
| **Wood Factory** | heavy | A small machine that spits out wood pieces, like the Metal Factory. | Power | Without it there is no wood to build with. |
| **Saw** | medium | Cuts wood pieces to length. | Wood pieces | Only cuts wood, never metal. |
| **Rubber Mallet** | light (a hand tool) | Taps wood parts together for assembly. | Cut wood parts | Gentle: no sparks, no dents. |
| **Sander** | medium | Smooths a surface and changes the wood's colour. | A wood piece or finished wood object | Changes the piece's colour through the finish. |

Dependency chain: **Wood Factory → wood pieces → Saw → wood parts → Rubber Mallet → wood object**. The Sander is a finishing step after assembly.

### 9.5 Builds (unlocked by books)

Builds are unlocked by reading books. Basic books unlock simple builds; advanced books unlock the bigger ones. A build can only be started once its book has been read and its tools are in the room.

**Wood builds (listed by the user):**

| Build | Unlocked by | Tools (in order) | Stock |
|---|---|---|---|
| Wooden foot stool | Workshop Basics (basic) | Saw → Rubber Mallet | Wood pieces |
| Wooden shelves | Wood & Metal Basics (basic) | Saw → Rubber Mallet → Sander | Wood pieces |
| Wooden chairs | Furniture for Robots (advanced) | Saw → Rubber Mallet → Sander | Wood pieces |
| Wooden picnic table | Furniture for Robots (advanced) | Saw → Rubber Mallet → Sander | Wood pieces (more than the chairs) |
| Kitchen table | Furniture for Robots (advanced) | Saw → Rubber Mallet → Sander | Wood pieces (more than the picnic table) |
| Nightstand | Furniture for Robots (advanced) | Saw → Rubber Mallet → Sander | Wood pieces |

**Metal builds (listed by the user):**

| Build | Unlocked by | Tools (in order) | Stock |
|---|---|---|---|
| Wall-mounted plant hanger | Wood & Metal Basics (basic) | Metal Cutter → Metal Hammer | Metal pieces |
| Metal chair | Metal Fabrication for Robots (advanced) | Metal Cutter → Welder → Metal Hammer | Metal pieces (more than the hanger) |
| Metal table | Metal Fabrication for Robots (advanced) | Metal Cutter → Welder → Metal Hammer | Metal pieces (more than the chair) |
| Metal-framed window | Metal Fabrication for Robots (advanced) | Metal Cutter → Welder → Metal Hammer | Metal pieces, plus glass |

The list is open: you wrote "etc.", so more metal builds can be added the same way.

**Notes on the metal builds:**
- A **metal-framed window** is a wall piece. It must go through the same wall placement and door search as the existing windows (section 5), and it can be dragged along its wall like the others.
- A **wall-mounted plant hanger** is also a wall piece, and it should hang the same way the pictures do.
- The **chair** and **table** ids clash with existing objects (`chair` is the Wooden Chair, and `table` is the Stereo & Table). The builds need their own ids, such as `metal_chair` and `metal_table`.

**Name clashes to resolve:**
- The Catalogue already has a free **Wooden Chair** (`chair`) and a free **Nightstand** (`nightstand`). The builds need different entries, or the existing ones become the built versions. This is a question for you.
- The **Wooden shelves** build is separate from the Bookshelf, which can never be removed.

**Each build** has a time, a tool order, and a stock check. A build with too little stock says so ("Needs 4 wood pieces") and does not start.

Each build has a time, a list of tools in order, and a stock check. A build with missing stock says so ("Needs 2 metal pieces") and does not start.

### 9.6 Tool-use rule

Each tool is a short activity Guy performs at its place in the room (the workbench, the factory, the saw). Each activity:
- looks up the object at step time (`this.obj(name)`), so removing it cancels the activity cleanly (project rule), and
- declares its needs (`fx.needs`), so a missing tool or stock cancels the step.

---

## 9A. Inventory and Built Stock

Built objects and materials go into one inventory system. This is the direction you gave: built objects are stock, and removing them from the room keeps them.

**How it works**
- The inventory holds **counts per type**, not one entry per object. Example: "Nightstand: 3 in storage, 1 in the room".
- A build reproduces the existing object by reusing its original builder (for the nightstand, the same function that makes the room's nightstand). The copy matches the original exactly: size, colour, weight and behaviour.
- A built object starts in **storage**. It is not placed in the room automatically.
- **Removing** an object from the room (by the user, or by Guy) returns one copy to storage. It is not deleted.
- **Adding** from the Catalogue takes one copy from storage and places it, like any other room object. With no copies in storage, nothing happens and the Catalogue says so.
- **Materials** (wood pieces, metal pieces) are stock in the same inventory. This settles decision 5: stock is counted, not carried piece by piece.
- Stock is saved with the room state (`guy.room.v2`).

**Changes this needs in the code**
- Today each object is a single item: one entry in `world.objects[name]` with one Catalogue state (in the room, removed, or available). Built copies need many instances per type, each with its own id (for example `nightstand#2`).
- `brain.obj(name)` and the QA harness assume one object per name. Lookups must go through the instance or the type.
- The Catalogue shows counts: "In the room: 2 · In storage: 98".
- Free objects that already exist (the nightstand, the chairs) keep their current single behaviour unless you decide otherwise (question 7).

**Example: 100 bicycles**
- Bicycles are a new object type. They need their own design, builder and book, so they are not in the plan yet.
- The rule works like this: 100 built bicycles sit in storage. 40 are placed in the room. Removing those 40 sends them back to storage. The Catalogue shows "In storage: 100", and each one is added individually.
- The room's space limits how many fit. The same fit check as other objects applies, so a full room says "No room for another bicycle" and the copy stays in storage.
- To keep 100 copies fast on a phone, all copies of one type share one mesh and material. Only the position differs.

## 10. Workshop Books

Three books, in line with the request: two for basic skills and one for advanced skills. Each book is a `BOOK_CATALOG` entry and a `SKILL_INFO` entry (`src/skills.js`).

| Book | Level | Teaches | Requires | Unlocks |
|---|---|---|---|---|
| **Workshop Basics** | basic | `workshop` | `workbench` | Working at the workbench; using and putting away the toolbox; the rubber mallet. Unlocks the **wooden foot stool**. |
| **Wood & Metal Basics** | basic | `workshop.materials` | `workbench` | Running the factories; cutting with the saw and the cutter; the sander and the hammer. Unlocks the **wooden shelves** and the **wall-mounted plant hanger**. |
| **Furniture for Robots** | advanced | `workshop.furniture` | `workbench`, saw, mallet, sander | Wooden chairs, the picnic table, the kitchen table and the nightstand. |
| **Metal Fabrication for Robots** | advanced | `workshop.metal` | `workbench`, welder, cutter, hammer | Welding and shaping. Unlocks the **metal chair**, the **metal table** and the **metal-framed window**. |

Each book unlocks its builds only. The metal basics are in Wood & Metal Basics, so there is one basic book per material line, not a separate metal basic book.

One advanced metal book is enough for now. Later chapters or complete books can add builds and deepen the skills these books unlock.

- The existing `woodwork` book ("Woodworking for Robots") is retired. Its place is taken by **Furniture for Robots** (section 15, answer 4).
- Each book follows the existing pattern: `requires.object` is the object that must be in the room first. A book whose object is in a locked room is hidden (decision 3).

---

## 11. Implementation Order (suggested)

Each phase can be tested on its own. No phase needs the Restaurant.

1. **Room model and save migration** (`rooms.js`, `guy.room.v2`). No visible change.
2. **Premium gating for room items** in the Catalogue. Works with no rooms yet.
3. **Door placement search** and displacement, with a test that reports the chosen wall, the displaced pieces and whether a spot exists. No world change yet.
4. **Multi-room world**: the second room group, the door piece, camera framing, lighting.
5. **Pathing** across the door, with the transition step.
6. **Workshop room shell**: floor, walls, lights, pegboard.
7. **Workbench and Toolbox** (placed, put away, used with a simple activity).
8. **Wood line**: factory, saw, mallet, sander, with the wood stock.
9. **Metal line**: factory, cutter, welder, hammer, with the metal stock.
10. **Workshop books** (three), wired to the objects.
11. **Wood builds** (section 9.5), each unlocked by its book. **Metal builds** once they are listed.
12. **Inventory** (section 9A), before the builds, so built copies have somewhere to go.
13. **QA pass** (section 13).

---

## 12. Restaurant (first version built)

**Built:** the Restaurant room with an elevator on its far wall, a stove, kitchen counter, cash register and two dining tables; customers (3D models from `public/models/customers/`, listed in `src/customermodels.js`) arrive by the elevator, sit, order, eat, pay and leave; Guy takes orders, cooks, serves and takes payment (`src/restbrain.js`); coins are saved with the layout. Guy runs it for now (GAL does not exist yet) and, as below, that is a default, not a rule. Details and tests: `assets.md` ("The Restaurant"). It is a premium room: shown locked in the Rooms tab until unlocked (no payment flow yet). Not built yet: the payment flow, GAL, clearing and washing plates, more customer packs, optimised models for the large packs.

The original notes:

- Guy cooks, serves food to customers and handles payment.
- New 3D model characters enter the restaurant through an **elevator on the Restaurant's wall**.
- **Staffing (not a rule):** GAL (X Bot) normally tends the customers. GUY helps when he is free and chooses to. He may be busy, for example in the middle of a jam session, and not want to cook, so GAL may have to run the restaurant alone.
- Not planned in detail. It will reuse the room model (section 4), premium gating (section 6) and door placement (section 5), plus new character models and a payment flow that needs its own design.
- The elevator is a wall feature, so it should be placed by the same search as doors.

---

## 13. Testing and the QA Skill

Per `CLAUDE.md`, the same change must update the QA skill. The full per-feature test matrix, covering every feature in this plan on desktop and mobile, is in section 13A:

- **`MANIFEST` in `src/devtools.js`:** add the Workshop objects, the three books, the new rooms, the workshop category, the door placement check, the room transition, and the builds.
- **`.claude/skills/test-guy-game/assets.md`:** a row for each new object, book and build, plus a "Regression watch" line after any bug is fixed.
- **`.claude/skills/test-guy-game/SKILL.md`:** the room-adding route and the new Catalogue section.
- **Checks to add:**
  - Adding the Workshop puts exactly one door on an allowed wall, and nothing fixed is moved.
  - Displaced pieces appear in `world.removed` and can be put back.
  - A room-gated item is not listed while its room is locked, and is listed after unlocking.
  - Guy walks through the door and the transition plays.
  - The material stock drops by the right amount for each build, and a build with too little stock does not start.
  - Removing a tool or a factory mid-activity cancels the activity cleanly.
- Run `T.coverage()` (must report `complete: true`) and `T.runAll()` (must come back clean) in the browser with `?nostart&fresh&skills=none`.

---

## 13A. Full QA Matrix for the New Features

Every new feature in this plan has at least one check below. Each check is tagged with where it runs: **sweep** (a new `T.sweep…` in `src/devtools.js`), **visual** (a `T.moment` checkpoint, then a screenshot), **manual** (a UI check in the browser), or **text** (an automated scan of the strings the game shows).

Every check runs twice: once on the desktop preset and once on the mobile preset (375 x 812, touch). Results for both are reported.

### 13A.1 Rooms and the skill machine

| Check | Where | Pass means |
|---|---|---|
| Rooms section shows the Workshop with "Add to my home" | sweep `sweepRooms` | the button is there, and the main room is never listed as addable |
| Adding the Workshop places exactly one door, on the right, front or back wall | sweep `sweepDoors` | one door, on an allowed wall, not overlapping the shelf or the Catalogue |
| Door search prefers the wall with the fewest displaced pieces | sweep `sweepDoors` | the chosen wall matches the search's own report |
| A displaced decor piece goes to `world.removed` and can be put back | sweep `sweepDoors` | in the Catalogue, and back on its wall after "Put back" |
| A displaced movable furniture piece is removed the same way | sweep `sweepDoors` | removed, not moved silently; no heavy piece moves |
| No clear wall: the Catalogue explains, and nothing changes | sweep `sweepDoors` (fill the walls first) | a friendly message, no door, no removals |
| Adding the Workshop twice does nothing and says so | sweep `sweepRooms` | still one door, one message |
| Save migration: a `guy.room.v1` save keeps every object | sweep `sweepSaves` | objects and positions match after the migration |
| A `guy.room.v2` save restores both rooms before the Catalogue is drawn | sweep `sweepSaves` | the Workshop and its door come back on reload |
| `fresh` ignores saved rooms | manual (`?fresh`) | the Workshop is not there until added |

### 13A.2 Premium gating

| Check | Where | Pass means |
|---|---|---|
| Workshop items are not listed while the room is not added | sweep `sweepGating` | none of its objects, books or builds appear in the Catalogue (not even as locked) |
| Items appear after the room is added and unlocked, with no reload | sweep `sweepGating` | they appear in the right sections |
| Premium albums keep their existing "Premium · coming soon" behaviour | existing `sweepRecords` | unchanged |
| A book whose object is in a locked room is hidden | sweep `sweepGating` | hidden, and shown after the room is added |

### 13A.3 The Workshop room and the multi-room world

| Check | Where | Pass means |
|---|---|---|
| Guy walks through the door, and the transition step plays | sweep `sweepDoors` | he crosses the threshold, the step completes, no exceptions |
| An activity in the Workshop cannot start while the Workshop is not added | sweep `sweepWorkshop` | the activity is not offered |
| Guy's path avoids furniture on both sides of the door | sweep `sweepDoors` (random layouts, several runs) | a path is found, or Guy says he cannot get through |
| Camera frames both rooms once the Workshop is added | visual + manual (desktop and 375 x 812) | the whole room and the Workshop are in view |
| Workshop lighting is cooler and the main room's lighting is unchanged | visual (`T.moment` in each room) | the two rooms look distinct; main room unchanged |
| Walls, floor and pegboard match the layout in section 8 | visual | screenshot check against section 8 |

### 13A.4 Workshop objects (each one)

| Object | Sweep | Checks |
|---|---|---|
| Workbench | `sweepObjects` (Workshop group) | heavy: never pushed by Guy; Guy works at it; removing it cancels its activities |
| Toolbox | `sweepObjects` | medium: Guy pushes it; he takes a tool out and puts it back; tool is not in his hand afterwards |
| Metal Factory | `sweepObjects` | heavy; spits a metal piece into storage on its activity; stops when removed |
| Welder | `sweepBuilds` | glow on the welding point, not sparks; he holds the parts still while welding |
| Metal Cutter | `sweepBuilds` | only cuts metal (a wood piece in the stock is refused) |
| Metal Hammer | `sweepBuilds` | hits the metal piece on the workbench; the workbench stays in use |
| Wood Factory | `sweepObjects` | heavy; spits a wood piece into storage; stops when removed |
| Saw | `sweepBuilds` | only cuts wood (a metal piece is refused) |
| Rubber Mallet | `sweepBuilds` | taps wood parts together; no sparks or dents; gentle |
| Sander | `sweepBuilds` | sanding changes the wood's colour through the finish; the piece is smooth afterwards |

Each tool is also checked by `sweepInterrupts` (interrupt mid-activity; he tidies up) and `sweepMoves` (drag the tool mid-activity; he lets go). The existing sweeps are extended to include the Workshop objects.

### 13A.5 Books and skills

| Check | Where | Pass means |
|---|---|---|
| Workshop Basics teaches the workbench and toolbox, and unlocks the foot stool | sweep `sweepBooks` | learned; the foot stool build is offered |
| Wood & Metal Basics unlocks the wooden shelves and the wall-mounted plant hanger | sweep `sweepBooks` | both builds offered |
| Furniture for Robots unlocks the chairs, picnic table, kitchen table and nightstand | sweep `sweepBooks` | all four offered |
| Metal Fabrication for Robots unlocks the metal chair, metal table and metal-framed window | sweep `sweepBooks` | all three offered |
| Each build is refused until its book is read | sweep `sweepBooks` | "Read the book first" (kind wording), no build starts |
| `woodwork` is retired | `T.coverage()` | no longer in the catalogue or the manifest |
| Books are removed and forgotten the same way as the existing books | existing `sweepBookRules` (extended) | all rules hold for the new books |

### 13A.6 Builds (wood and metal)

| Check | Where | Pass means |
|---|---|---|
| Each build starts only with its book, its tools (in order) and its stock | sweep `sweepBuilds` | a missing item gives a friendly message and nothing starts |
| Each build finishes and goes into storage | sweep `sweepBuilds` | storage count goes up by one |
| Stock is used up exactly (for example 2 cut parts per chair) | sweep `sweepBuilds` | stock before minus stock used equals stock after |
| Removing a tool mid-build cancels the build cleanly | sweep `sweepInterrupts` (builds) | no stock is lost, the build can restart |
| A built copy is identical to the original | sweep `sweepCopies` | same size (bounding box), same colour and material, same weight, same interaction, compared with the original's builder |
| The metal-framed window and plant hanger follow the wall rules | sweep `sweepDecor` (extended) | on a wall, dragged along it, cannot cover the Catalogue |

### 13A.7 Inventory and storage

| Check | Where | Pass means |
|---|---|---|
| A built copy starts in storage, not in the room | sweep `sweepInventory` | the room count is unchanged, storage is +1 |
| Removing a copy from the room returns it to storage (not deleted) | sweep `sweepInventory` | storage +1, room −1, the object exists in storage |
| Adding from the Catalogue takes one copy from storage | sweep `sweepInventory` | storage −1, room +1 |
| Adding with no copies in storage does nothing and says so | sweep `sweepInventory` | friendly message, no change |
| The Catalogue shows "In the room: n · In storage: m" | sweep `sweepInventory` | counts match the world |
| The storage shelf draws at most 12 stacked copies, then the number | visual + `sweepInventory` (mesh count) | at most 12 stacked meshes at 100 copies |
| Cap: 20 copies of one type in the room | sweep `sweepInventory` | the 21st is refused with the friendly message |
| Cap: 60 built objects in the room in total | sweep `sweepInventory` | the 61st is refused |
| Stress: 100 copies of one type in storage, 40 placed, 40 removed and placed again | sweep `sweepInventory` (bicycles, once the type exists; until then a stand-in type) | no exceptions; frame time stays within the mobile budget |
| Materials are stock: wood and metal counts saved and restored | sweep `sweepSaves` | counts match after reload |
| Save and reload keeps built stock and room counts | sweep `sweepSaves` | matches before and after reload |

### 13A.8 Child-friendly rules (section 16)

| Check | Where | Pass means |
|---|---|---|
| Nothing is ever deleted: every removal path goes to storage or the Catalogue | sweep `sweepInventory` plus a code search for deletions of built objects | no build or removal drops an object |
| Every message is kind and short | text: `sweepText` scans every notification string the new code can show | none of the banned words (fail, error, wrong, can't, lost, broken, dangerous) appear; each message is under 80 characters |
| Every control is at least 44 px square | sweep `sweepMobile` (computed sizes) | all new buttons and chips pass |
| Long-press is used only where it already exists | manual | no new long-press controls |
| Tools look safe: the welder glows softly, no sharp or hot looks | visual (`T.moment` on the welder and cutter) | screenshot check against section 16 |
| Titles and descriptions use plain words | text (`sweepText`) | each description's first word is in the friendly list |
| Put back from the Catalogue works with one tap | manual | one tap returns the object |

### 13A.9 Mobile

| Check | Where | Pass means |
|---|---|---|
| The whole Workshop and its Catalogue work at 375 x 812 with touch | sweep `sweepMobile` | every sweep passes at the mobile preset |
| No horizontal page scroll with the Catalogue open | manual (`resize_window` to mobile) | no sideways scroll |
| Frame time stays within budget with the Workshop and 100 copies | sweep `sweepInventory` (timing) | the budget in section 16 holds |
| Shared meshes: copies of one type share geometry and material | sweep `sweepInventory` | one geometry and one material per type |
| Camera framing is correct at phone width | visual at 375 x 812 | the whole room is in view |

### 13A.10 Sounds

| Event | Where | Pass means |
|---|---|---|
| Door opens (once, when the Workshop is added) | sweep `sweepSounds` | the sound is requested |
| Factory spits a piece | sweep `sweepSounds` | requested |
| Saw, cutter, mallet, sander, hammer, welder | sweep `sweepSounds` | each is requested during its build |
| Stored in storage (placed in the storage shelf) | sweep `sweepSounds` | requested |
| Cap reached | sweep `sweepSounds` | requested (a soft tone) |

### 13A.11 What the harness must add (at build time)

- **Manifest** (`MANIFEST` in `src/devtools.js`): the Workshop room, its door, the 10 Workshop objects, the 3 books, the 7 builds, the storage shelf, and the new visual checkpoints (welder, cutter, factory, storage shelf, door, both rooms from the camera).
- **New sweeps:** `sweepRooms`, `sweepDoors`, `sweepGating`, `sweepWorkshop`, `sweepBuilds`, `sweepCopies`, `sweepInventory`, `sweepSaves`, `sweepText`, `sweepMobile`.
- **Extended sweeps:** `sweepObjects`, `sweepBooks`, `sweepBookRules`, `sweepInterrupts`, `sweepMoves`, `sweepDecor`, `sweepSounds`, `sweepPoses` (the new tool poses are added to `POSE_LIMITS`).
- **Skill docs:** `SKILL.md` gets a route for the Workshop, the Rooms section and the mobile preset; `assets.md` gets a row for every new object, book, build and checkpoint, plus a "Regression watch" line after each bug.
- **Coverage:** `T.coverage()` must report `complete: true` with the Workshop included, and `T.runAll()` must come back clean on both presets.

---

## 14. Risks

- **Pathing:** the grid is built for one room (`brain.js:932`, `:2186`). Making it multi-room is the riskiest change. Build it behind the room model and test with the main room only first.
- **Save compatibility:** the migration from `guy.room.v1` must not lose anyone's room. Test a v1 save before shipping.
- **Door blocking everything:** a crowded room may leave no clear wall. The Catalogue must explain this, not fail silently.
- **Camera framing:** a wider room may be too small on phones. Check `fitRoom()` at phone width.
- **Sound and performance:** more objects and a second room add draw calls. Keep the Workshop cheap (no real lights, per the existing wall-light approach at `room.js:538`).

---

## 15. Decisions (all answered)

The owner asked for judgement on every open question, with the plan kept friendly for children and fast on phones. Each answer below is final for the plan and can be changed later.

1. **Displaced items on room changes.** They go to the Catalogue or to storage. Nothing returns to an old spot on its own, because that would be magic movement. Kids can always find their things again in the Catalogue.
2. **The Workshop.** Free to add, and unlocked by default. The premium mechanism is built for later rooms (such as the Restaurant).
3. **Room-gated items.** Hidden until their room is added and unlocked. A child never sees a locked item they cannot use yet.
4. **The `woodwork` book.** Retired. Its place is taken by **Furniture for Robots** (the advanced wood book), so there is one name for it.
5. **Materials.** Counted stock in the inventory (section 9A). Guy never carries pieces one by one.
6. **Metal books.** One advanced metal book for now, **Metal Fabrication for Robots**. Chapters or whole books can be added later.
7. **Free Nightstand and Wooden Chair.** They stay single and free, exactly as they are today. Built copies are counted stock in storage. That keeps the room's starting furniture simple.
8. **Storage.** A physical shelf in the Workshop, labelled "Storage", with a count on it. Kids can see their stock, and the Catalogue shows the same count. On a phone, the shelf draws at most a dozen stacked copies. Beyond that it shows only the number, which keeps the scene fast.
9. **Cap on copies in the room.** At most **20 copies of any one built type** and **60 built objects in total** at once. The room's space still applies too. When a cap is reached, Guy says something friendly such as "The room is full of bicycles! Put some back in storage to make space." Nothing is ever deleted.

---

## 16. Child-Friendly and Mobile Rules

These apply to every part of the Workshop and the inventory.

**For children**
- **Nothing is ever lost.** Removing an object always sends it to storage or the Catalogue. No build or removal deletes anything.
- **Kind words only.** Messages are short and positive ("Let's build a chair!", "Almost done!", "We need more wood first"). No messages about failure or punishment.
- **No hard-to-undo steps.** A removal can always be put back from the Catalogue with one tap.
- **Safe tools.** Tools are shown as friendly and bright. There is no sharp, hot or dangerous look, and the welder shows a soft glow, not harsh sparks.
- **Readable text.** Titles and descriptions use plain words. Long terms (such as "fabrication") are explained in the book's own text, with the friendly word shown first.
- **Gentle timing.** Builds take a few seconds, long enough to watch, short enough not to bore.

**For phones**
- **Big tap targets.** Every control is at least 44 px square, with space between them.
- **Tap, not hover.** Everything works with one tap or a simple drag. Long-press is used only where the existing game already uses it.
- **Shared meshes.** All copies of one built type share one mesh and material, so 20 copies cost about the same as one.
- **Capped counts.** The caps in question 9 keep the number of objects low. The shelf shows at most a dozen stacked copies.
- **No extra real lights.** The Workshop uses the same cheap lighting approach as the main room (section 14).
- **Fits the screen.** The camera framing (`fitRoom()`) is checked at phone width, so the Workshop is in view when it is added.
- **Quick door animation.** One short opening, about a second, so it does not slow the start.

---

---

## 17. Round Two: Going Through Doors, Being Creative, Overflowing Books, Speed and Lock In

New requests, with what is built, what is planned, and what each planned part waits for.

### 17.1 Built

| Request | Status |
|---|---|
| Every room the same depth. The Workshop was shallower than Guy's room | **Built.** A room is as big as Guy's room (10 wide x 8 deep) whichever wall its door is on, unless its catalogue entry gives a `size`. Checked by `sweepDoors` for all three walls. |
| Speed control dropdown (speeds up Guy's movements between interactions) | **Built.** 1x to 4x beside Follow. It scales walking, turning, pushing and the idle pauses. The interactions themselves keep their pace. Remembered between visits. `sweepSpeed`. |
| A long-press option to lock Guy into an interaction until told to stop | **Built.** "Lock in" on the long-press menu (and "Unlock"), a "Locked on ..." chip, and Next also lets go. He cycles through everything he can do with that object. `sweepLock`. |
| Locked on the guitar: play everything he knows, then make up riffs and remember the good ones | **Built.** The `riff` activity: single-note riffs over a bass note, judged on range, steps, a repeating phrase, density and coming home; the best 8 are kept between visits (`guy.riffs.v1`) and replayed. `sweepRiffs`. |

### 17.2 Long-press a door to open it and go in (built, first version)

**Built:** doors are pickable; long-press > "Go into the Workshop" (or "Come back"); a real doorway in the wall; the leaf swings open and shut; Guy walks to the door, reaches for the knob, goes in, looks round three spots and comes back out and shuts it (`visit`, `leave`, `sweepVisit`). Walking through the doorway and round the room is in straight lines, which is fine while the Workshop is empty. **Still planned** (below): grid pathing across rooms once the Workshop holds objects.

- **Pick target:** doors join `pick()` in `main.js`, so a long press on one opens a menu: "🚪 Go in" (from Guy's room) or "🚪 Come back" (from the Workshop).
- **Opening:** the door leaf swings open in about a second and closes about three seconds after Guy has passed, if nobody is near. The doorway needs a real opening in the wall (today the wall is one plane, so the door is painted on it).
- **Walking:** `Go in` is a queued walk to the threshold, the door opening, then a walk to the middle of the room. It needs the pathing grid and the "can he stand here" limits (`brain.js`, `main.js`) to cover every added room, with the door cells open only while the door is open.
- **Waits for:** phase 5 (pathing across the door). Do it with the Workshop shell, before any object is moved into the Workshop.

### 17.3 Guy being creative (planned: needs phases 5 to 12)

- **No chair, but wood to work with:** when no chair can be sat on and the wood line is there (Workshop added, workbench, saw, mallet, sander, wood in stock) a new activity `buildchair` has him go to the Workshop, build a chair (saw, mallet, sander, as in section 9.5), carry it to the door and into his room, put it on a free spot clear of the usual standing places, and sit on it. The carry needs a "carrying furniture" pose (both hands under the seat) and the chair must change rooms.
- **Too many chairs:** more than 3 wooden chairs in the room, and he carries one at a time to the Wood Factory and turns it into scrap wood (added to the wood stock). **Decision proposed:** he only recycles chairs he built himself, never the ones you added, so nothing of yours is taken without you removing it (section 16: nothing is ever lost).
- **Both are optional choices** in his normal activity mix, with low weights and the usual "not the same thing twice" rule, and each can be a Lock in target for the Workshop.
- **Waits for:** rooms with their own objects (object lookups must find the object in the room he is in), the Workshop objects (section 9), the inventory (9A), the build recipes, and pushing or carrying furniture across a door.

### 17.4 Books overflow, and Guy builds another bookshelf (stack built; the second shelf is planned)

**Built:** the shelf holds 16 books; the rest lie flat on the floor in a stack beside it (spine to the room, each resting on the one below, an obstacle, moves with the shelf). Guy takes the top book, squatting to it, and puts it back on top. The long-press book list scrolls instead of running off the screen. `sweepShelf`. **Still planned:** Guy building another bookshelf in the Workshop, pushing it in and moving the stacked books onto it.

- **Found while planning:** the shelf has no capacity. `addBook` in `room.js` keeps taking the next slot (rows 3 and 2, 0.2 m apart along the shelf). With all 19 unlocked books on the shelf, the last three (`stars`, `darksky`, `scopecare`) already stick out past the end of the shelf (z up to 1.1 m; the shelf ends at 0.9 m). This is a bug today, independent of the new request.
- **Capacity:** the shelf holds 17 books on its two reachable rows. Past that a book goes into a **stack on the floor beside the shelf** (up to a few books high), still counted as "on the shelf" for the Catalogue.
- **Guy's response:** with wood in stock he builds a second bookshelf in the Workshop, pushes it through the door to stand next to the first (the new shelf is a normal shelf object, heavy once placed, so Guy only moves it while it is new: a build state), then picks up the stacked books one at a time and puts them on its empty shelves. The new shelf is removable (the first one never is).
- **Without wood or a Workshop:** the stack stays, and Guy still reads books from it (he picks from the top of the stack).
- **Waits for:** the stack mechanic (a new object, with a fix for the capacity bug), 17.3's carrying and door work, and the wooden shelves build (section 9.5).

### 17.5 Order of work

1. Pathing across the door and the opening door (17.2), with a Workshop that Guy can walk into.
2. The shelf capacity fix and the floor stack (17.4, first half). This one stands alone and fixes a bug.
3. The Workshop objects, materials and inventory (sections 9 and 9A), then the builds.
4. Carrying furniture, then `buildchair`, recycling, and Guy building the second bookshelf.

### 17.6 Testing

Each built item has its sweep in section 13A. The planned items add: a door long-press menu check, a walk through the door in both directions, `buildchair` starting only when no chair exists, recycling only his own chairs and only above 3, and the book stack and the second shelf (a shelf with 20+ books has nothing outside its frame; the stack empties onto the new shelf; no book is ever lost).

---

## 18. The Build a Bot Machine and GAL (first version built)

**Built (see assets.md, "GAL and the Build a Bot machine"):** the premium one-use machine (Robots category), Guy building her, GAL as an autonomous second robot with her own brain and skills (she must read books), the two sharing the room and the stereo, Guy asking her to read the drumming books and find him before they jam, and her own invitation to dance. Not built: the piano invitation, a menu and skills panel for her, more orders. **Autonomy (from the owner):** GAL is an autonomous humanoid robot. If she is in the environment she is free to do whatever she wants; Guy can also instruct her to use her abilities (this answers open question 7). The rest of this section is the original description.

Recorded from the owner's description.

**The machine.** A 3D printer, a super premium object (it is unlocked through the same premium mechanism as later rooms, not for free). It can be used once: it prints a female robot, X Bot, by morphing itself into her, using itself as the material. After that it is gone (or is the same object as X Bot; to be decided).

**X Bot.** A second robot character, a female version of Guy, built from the Mixamo `X Bot` model (`models/mixamo/X Bot.fbx`). Rules from the description:
- X Bot is controlled only by Guy. The user does not command her directly.
- Guy tells her what to do. Example: Guy wants to play guitar, so he tells X Bot to play drums.
- So X Bot needs her own activity queue (a second brain on the same world), taking orders from Guy's choices. Her orders can be any activity she can do, and she does what she is told.

**X Bot's unprompted prompts.** X Bot also engages with GUY on her own, for example:
- she turns on the stereo and asks GUY to dance;
- she sits down at the piano and motions for GUY to come and play along (sitting on the bench, or standing beside the piano).

**Names.** X Bot is called **GAL**, a female version of GUY. GAL stands for **Genetically Alternate Layout**.

**Two characters.** GUY is the main character, built from the Mixamo Y Bot model (GUY = Genetically Universal Ybot). X Bot is the second character. "Y Bot" is the model's name, not a second character.

**GAL and books (from the owner).** Learning from books applies to GAL as well. She has her own skill set (her own `Skills` instance, forgetting included) and must read a book to gain an ability, especially an advanced one. She reads from the same bookshelf. What follows for the design: her activities are gated by `skillNeeds` against her skills; Guy cannot order her to do something she has not learned (he picks only from what she can do, or the order is refused kindly); she shows up in the skills panel as a second set; her skills are saved with her. Reading would reuse the `read` activity and the book steps, run by her own brain.

**Open questions for the owner**
1. Is the machine consumed when it prints X Bot, or does it stay as something else?
2. What does the premium unlock cost, and is it a one-off unlock or paid per machine?
3. How does the user give Guy an order for X Bot, or does Guy decide everything himself?
4. ~~Can X Bot learn skills of her own?~~ **Answered:** yes. GAL learns from books like Guy does: she must read a book to gain the abilities of an advanced skill. Her skills are her own, not Guy's (see "GAL and books" below).
5. Does X Bot persist between visits (the saved layout)?
6. Y Bot's prompts: are they in speech bubbles, gestures only, or both?
7. X Bot is told what to do by GUY, but she also starts things on her own (the prompts above). Does she act on her own at any time, or only when GUY is near and free to respond?

**Testing.** To be written when planned: a second character needs its own sweep (its own activities, no interference with Guy's paths), the order-taking path, and the unprompted prompts.

## 19. Guy Hangs His Paintings on Walls (built)

**Built** as described below (`src/paintings.js`, `src/paintbrain.js`, `sweepPaintings`): the Hang painting menu item on the easel, Guy choosing the wall (his own room's two visible walls and the three walls of every added room), three per wall, the oldest replaced when every wall is full, stored paintings with thumbnails in the Catalogue, and saving (`guy.paintings.v1`, which also saves the picture on the easel). The easel painting is no longer in the "not saved" list.

Guy leaves each painting on the easel when he finishes it, as now. If the user likes a painting, they can have Guy hang it on a wall.

- **The menu.** When the easel has a painting on it, its long-press menu shows **Hang painting**. Guy never hangs one by himself, and there is no "proud" roll.
- **Taking it down.** Guy lifts the canvas off the easel with both hands (IK, like the shelf books), carrying it in front of him. The easel is blank afterwards.
- **Guy chooses where.** The user does not pick the spot. Guy looks at every wall of every room he can reach (his own room, and added rooms through their doors) and picks a free spot, then walks there and hangs it. It becomes a wall picture in `world.decor`, so the user can still drag it along the wall or put it away.
- **Free spot.** A spot that does not overlap a window, door, sconce or another picture, and is not behind a tall object.
- **Limit.** At most **3 of Guy's paintings per wall**.
- **No room anywhere.** If every wall already has 3, Guy picks one of his existing paintings (the oldest) and replaces it with the new one. The painting he takes down is not thrown away: it goes into the skill machine (the Catalogue) as an item the user can put back, like any removed object. Nothing is ever deleted.
- **Saved.** Each hung painting, and each stored one, is saved (wall, position along it, and the picture) so they survive a reload. This needs the easel painting itself to be saved first (it is not yet, see "Build status").
- **Testing.** A sweep that paints and hangs until a wall has 3, checks Guy spreads them over other walls and rooms before replacing, checks that with every wall full the oldest is replaced and the old one appears in the Catalogue, checks windows and doors are not covered, and checks removal and reload.

**Thumbnails (decided).** The Catalogue shows each stored painting as a thumbnail of the actual picture, not a generic icon.

**Order of work (decided).** Built after the Restaurant has landed, so it does not collide with that work in `brain.js`, `room.js` and `machine.js`.
