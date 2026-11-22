// The Studio's instruments: an electric bass (on a stand, with its amp), an electric keyboard, a xylophone and a pair of bongos. Catalog
// objects (added from the Studio Machine, or the Catalog while the Studio is added), built with the same makeObject helper as the rest of the
// room (room.js passes it in). Every one stands with its front on local +z, which is where the player stands, and has what studiobrain.js needs
// to play it:
//   obj.stand   { x, dz }   where he stands (object-local x, and how far in front of the centre)
//   obj.reach               how many places each hand can be sent to: { Left: n, Right: n }
//   obj.hand(side, i)       the world point of place i for that hand (a fingertip / a mallet head touching the instrument)
//   obj.hit(side, i, other) the instrument answers: a key or bar dips, a note sounds (`other` is the other hand's place)
// The bass is different: it is taken off its stand and worn like a guitar (obj.guitar, obj.rest, obj.playAt, obj.pluck), so it has no hand / hit.
import * as THREE from 'three';
import { playPluck, playNote, playMallet, playSynth, drumHit } from './audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SCALE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83];             // C major over two octaves (the keyboard's white keys)
const BARS = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98];                        // the xylophone, C pentatonic and up
export const INSTRUMENTS = ['bass', 'keyboard', 'xylophone', 'bongos'];

export function makeInstrumentBuilders({ makeObject, box, mat }) {
  const metal = mat(0x2a2d33, { roughness: 0.4, metalness: 0.6 }), chrome = mat(0xbfc3c8, { roughness: 0.25, metalness: 0.8 }), black = mat(0x15161a, { roughness: 0.5 });
  const cyl = (g, r0, r1, h, m, x, y, z, rx = 0, rz = 0) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 24), m);
    c.position.set(x, y, z); c.rotation.set(rx, 0, rz); c.castShadow = c.receiveShadow = true; g.add(c); return c;
  };
  const pole = (g, x, y0, y1, z, r = 0.012, m = chrome) => cyl(g, r, r, y1 - y0, m, x, (y0 + y1) / 2, z);
  // every object: a world point from an object-local one, and the key / bar / skin dip that eases back
  const rig = (o, fx) => {
    o.at = (x, y, z) => { o.group.updateWorldMatrix(true, false); return o.group.localToWorld(V(x, y, z)); };
    const dips = new Map();
    o.dip = (mesh, depth, secs = 0.16) => { if (!dips.has(mesh)) dips.set(mesh, { y0: mesh.position.y }); const d = dips.get(mesh); d.t = secs; d.secs = secs; d.depth = depth; };
    const base = o.update;
    o.update = function (dt) {
      base.call(this, dt);
      for (const [m, d] of dips) { if (d.t > 0) { d.t -= dt; m.position.y = d.y0 - d.depth * Math.max(0, d.t / d.secs); } else m.position.y = d.y0; }
    };
    return o;
  };

  // ---- Electric bass: on a stand (body low, neck up), its little amp beside it. It is an instrument that is picked up and worn, like the
  // guitars: `obj.guitar` is the bass itself (neck along its local +x, strings facing +z), `obj.rest` where it sits on the stand, and brain.js
  // (computeGuitar) holds it across the player. The stand faces the audience: he takes it from the front, turns round and plays facing them too.
  const bass = (x = 0, z = 0) => {
    const body = mat(0x1f4d8f, { roughness: 0.35 }), neck = mat(0xc99a5b, { roughness: 0.5 }), board = mat(0x3a2416, { roughness: 0.6 }), fret = mat(0xb9bec4, { metalness: 0.8, roughness: 0.3 });
    const grill = mat(0x303338, { roughness: 0.9 }), cab = mat(0x1a1a1c, { roughness: 0.8 });
    const SX = -0.25;                                                                   // where on the footprint the stand is (the amp is on the other side)
    let b = null;
    const o = makeObject('bass', x, z, 1.0, 0.5, 1.8, 'light', (g) => {
      // the stand: a base, a post, a cradle the body sits in
      box(0.44, 0.03, 0.05, metal, SX, 0.015, 0, g); box(0.05, 0.03, 0.4, metal, SX, 0.015, 0, g);
      pole(g, SX, 0.02, 0.44, -0.01, 0.014, metal);
      box(0.28, 0.03, 0.12, metal, SX, 0.36, 0.05, g);
      for (const sx of [-0.13, 0.13]) box(0.025, 0.07, 0.12, metal, SX + sx, 0.4, 0.05, g);
      // the bass: two lobes and a waist, two horns, pickups, bridge, knobs, a long neck with its fretboard, four strings and four pegs
      b = new THREE.Group();
      const cylZ = (r, h, m, bx, by, bz) => cyl(b, r, r, h, m, bx, by, bz, Math.PI / 2);
      cylZ(0.165, 0.045, body, -0.15, 0, 0); cylZ(0.13, 0.045, body, 0.08, 0, 0);
      box(0.22, 0.25, 0.045, body, -0.04, 0, 0, b);
      box(0.2, 0.07, 0.045, body, 0.16, 0.1, 0, b); box(0.13, 0.06, 0.045, body, 0.14, -0.1, 0, b);
      cylZ(0.035, 0.045, body, 0.26, 0.1, 0); cylZ(0.03, 0.045, body, 0.205, -0.1, 0);
      box(0.03, 0.1, 0.014, black, 0.07, 0, 0.029, b); box(0.03, 0.1, 0.014, black, -0.04, 0, 0.029, b);
      box(0.05, 0.1, 0.016, chrome, -0.2, 0, 0.03, b);
      for (const k of [0, 1]) cylZ(0.015, 0.02, chrome, -0.16 - k * 0.06, -0.11 + k * 0.02, 0.03);
      box(0.8, 0.048, 0.026, neck, 0.56, 0, 0, b);
      box(0.72, 0.044, 0.01, board, 0.58, 0, 0.017, b);
      for (let i = 0; i < 12; i++) box(0.005, 0.045, 0.003, fret, 0.3 + i * 0.055, 0, 0.0225, b);
      box(0.17, 0.085, 0.024, neck, 1.04, 0.006, 0, b);
      for (let i = 0; i < 4; i++) {
        cylZ(0.008, 0.03, chrome, 0.985 + i * 0.037, -0.018 + i * 0.012, 0.02);
        box(0.022, 0.04, 0.012, chrome, 0.985 + i * 0.037, 0.064, 0, b);                 // the tuning pegs, along the top edge
        box(1.16, 0.0026, 0.0026, chrome, 0.38, -0.0165 + i * 0.011, 0.034, b);           // the strings (the lowest on top when he wears it)
      }
      b.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      b.rotation.z = Math.PI / 2 + 0.04;
      b.position.set(SX, 0.68, 0.06);
      g.add(b);
      // the amp
      box(0.42, 0.5, 0.32, cab, 0.3, 0.25, 0, g);
      cyl(g, 0.15, 0.15, 0.02, grill, 0.3, 0.22, 0.165, Math.PI / 2);
      box(0.42, 0.06, 0.02, metal, 0.3, 0.46, 0.165, g);
      for (let i = 0; i < 4; i++) cyl(g, 0.02, 0.02, 0.025, chrome, 0.18 + i * 0.08, 0.46, 0.18, Math.PI / 2);
    });
    rig(o);
    o.guitar = b; o.bass = true;                                                         // (`bass`: worn like a guitar, but it is not one of the guitars)
    o.rest = { pos: b.position.clone(), quat: b.quaternion.clone() };
    o.stand = { x: SX, dz: 0.57 }; o.standDz = () => o.stand.dz;                                                     // where he stands to take it, facing it
    o.playAt = { x: SX, dz: 1.0 };                                                       // and where he plays, his back to the stand
    o.string = (i) => { b.updateWorldMatrix(true, false); return b.localToWorld(V(0.05, 0.0165 - i * 0.011, 0.034)); };       // string i, where it is plucked (world)
    o.pluck = (note, vol = 0.2) => playPluck(note, 0, 1.3, vol, true);
    return o;
  };

  // ---- Electric keyboard on an X stand: two octaves of white keys (the playing places) with black keys between, a control panel on top
  const keyboard = (x = 0, z = 0) => {
    const bodyM = mat(0x23252b, { roughness: 0.5 }), white = mat(0xf4f1ea, { roughness: 0.4 }), blk = mat(0x0d0d10, { roughness: 0.4 });
    const o = makeObject('keyboard', x, z, 1.25, 0.55, 1.05, 'light', (g) => {
      for (const sx of [-0.4, 0.4]) for (const s of [-1, 1]) cyl(g, 0.012, 0.012, 0.9, chrome, sx, 0.4, s * 0.1, s * 0.28, 0);      // the X stand
      box(0.95, 0.03, 0.04, chrome, 0, 0.78, -0.08, g); box(0.95, 0.03, 0.04, chrome, 0, 0.78, 0.1, g);
      box(1.2, 0.07, 0.34, bodyM, 0, 0.83, 0, g);
      box(1.2, 0.06, 0.12, mat(0x3b3e46, { roughness: 0.5 }), 0, 0.89, -0.1, g);                          // the control panel
      box(0.18, 0.012, 0.07, mat(0x58d6ff, { roughness: 0.2 }), -0.35, 0.922, -0.1, g);                  // the little screen
      for (let i = 0; i < 6; i++) cyl(g, 0.014, 0.014, 0.02, chrome, 0.0 + i * 0.1, 0.925, -0.1);
    });
    o.keys = [];
    for (let i = 0; i < 14; i++) {
      const k = box(0.07, 0.025, 0.19, white, -0.52 + i * 0.08, 0.875, 0.06, o.group); o.keys.push(k);
    }
    for (const i of [0, 1, 3, 4, 5, 7, 8, 10, 11, 12]) box(0.045, 0.03, 0.11, blk, -0.52 + i * 0.08 + 0.04, 0.89, 0.02, o.group);
    rig(o);
    o.stand = { x: 0, dz: 0.55 };
    o.reach = { Left: 7, Right: 7 };
    // the left hand plays the lower seven keys, the right hand the upper seven
    o.hand = (side, i) => { const k = side === 'Left' ? i : 7 + i; return o.at(-0.52 + k * 0.08, 0.9, 0.08); };
    o.hit = (side, i) => { const k = side === 'Left' ? i : 7 + i; o.dip(o.keys[k], 0.012); playSynth(SCALE[k], 0.7, 0.16); };
    return o;
  };

  // ---- Xylophone: twelve coloured bars on two rails, long bars to the left. The mallets are the hands.
  const xylophone = (x = 0, z = 0) => {
    const rail = mat(0x6b4a2b, { roughness: 0.6 });
    const o = makeObject('xylophone', x, z, 1.1, 0.55, 0.9, 'light', (g) => {
      for (const sx of [-0.52, 0.52]) for (const sz of [-0.18, 0.18]) pole(g, sx, 0, 0.74, sz, 0.018, rail);
      for (const sz of [-0.16, 0.16]) box(1.1, 0.04, 0.04, rail, 0, 0.74, sz, g).rotation.z = 0;
      box(0.03, 0.05, 0.4, rail, -0.52, 0.74, 0, g); box(0.03, 0.05, 0.4, rail, 0.52, 0.74, 0, g);
    });
    o.bars = [];
    const cols = [0xd0312d, 0xe8742a, 0xf2c500, 0x7ac143, 0x2e9e4a, 0x1fb5a8, 0x2a62d8, 0x5a3a9b, 0xb03a9e, 0xd0312d, 0xe8742a, 0xf2c500];
    for (let i = 0; i < 12; i++) {
      const len = 0.3 - i * 0.012, m = box(0.075, 0.02, len, mat(cols[i], { roughness: 0.35 }), -0.47 + i * 0.085, 0.775, 0, o.group);
      o.bars.push(m);
    }
    rig(o);
    o.stand = { x: 0, dz: 0.38 };
    o.reach = { Left: 12, Right: 12 };
    o.hand = (side, i) => o.at(-0.47 + i * 0.085, 0.8, 0.06);
    o.hit = (side, i) => { o.dip(o.bars[i], 0.01); playMallet(BARS[i], 0, 0.2); };
    return o;
  };

  // ---- Bongos: two skin drums on a stand. Left hand the big one, right hand the small one.
  const bongos = (x = 0, z = 0) => {
    const wood = mat(0xb4682f, { roughness: 0.45 }), skin = mat(0xe8d9b5, { roughness: 0.7 });
    const skins = [];
    const o = makeObject('bongos', x, z, 0.7, 0.5, 0.95, 'light', (g) => {
      for (const a of [0.4, 2.5, 4.6]) { const l = cyl(g, 0.012, 0.012, 0.6, chrome, Math.cos(a) * 0.16, 0.3, Math.sin(a) * 0.16); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); }
      cyl(g, 0.22, 0.22, 0.02, chrome, 0, 0.6, 0);
      for (const [sx, r, h] of [[-0.14, 0.12, 0.26], [0.14, 0.1, 0.24]]) {
        cyl(g, r * 0.85, r, h, wood, sx, 0.74, 0);
        skins.push(cyl(g, r, r, 0.012, skin, sx, 0.74 + h / 2, 0));
        cyl(g, r + 0.006, r + 0.006, 0.014, chrome, sx, 0.74 + h / 2 - 0.004, 0);
      }
    });
    o.skins = skins;
    rig(o);
    o.stand = { x: 0, dz: 0.42 };
    o.reach = { Left: 1, Right: 1 };
    o.hand = (side) => o.at(side === 'Left' ? -0.14 : 0.14, 0.74 + (side === 'Left' ? 0.134 : 0.124) + 0.02, 0);
    o.hit = (side) => { o.dip(o.skins[side === 'Left' ? 0 : 1], 0.01, 0.1); drumHit(side === 'Left' ? 'bongoLo' : 'bongoHi', 0.9); };
    return o;
  };

  return { bass, keyboard, xylophone, bongos };
}
