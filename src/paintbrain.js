// Guy hanging his paintings (the long-press menu of the easel: "Hang painting"). Installed onto Brain at the bottom of brain.js.
// The pictures, the walls and the choosing are in paintings.js (`world.paintings`); this is his side of it: lifting the canvas off the
// easel, carrying it (shown in his hand, `this.carry === 'canvas'`), walking to the wall (through a door if it is in another room) and
// hanging it. If he is cut short he takes it back to the easel, so the painting is never lost.
import * as THREE from 'three';
import { sfx } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function installPaintings(Brain) {
  Object.assign(Brain.prototype, {
    initPaint() {
      // the canvas in his hand: a thin board whose face looks the way his fingers point (see lateWork in workbrain.js)
      const c = document.createElement('canvas');
      c.width = 256; c.height = 320;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.MeshBasicMaterial({ map: tex }), edge = new THREE.MeshStandardMaterial({ color: 0x7a4f2a, roughness: 0.8 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.625, 0.5), [face, face, edge, edge, edge, edge]);
      board.castShadow = true;
      const grp = new THREE.Group();
      grp.add(board);
      grp.userData.show = (src) => { c.getContext('2d').drawImage(src, 0, 0); tex.needsUpdate = true; };
      grp.visible = false;
      this.w.room.add(grp);
      this.workProps.canvas = grp;
    },

    // is he painting (or about to) right now?
    paintingNow() { const f = (s) => !!(s && s.fx && s.fx.paint); return f(this.step) || this.queue.some(f); },

    // The user asked him to hang the painting on the easel. Returns { ok, message }.
    hangPainting() {
      const P = this.w.paintings;
      if (!P) return { ok: false, message: 'Paintings are not available here.' };
      if (this.paintingNow()) return { ok: false, message: 'Guy is still painting. Wait until he has finished.' };
      const why = P.refusal();
      if (why) return { ok: false, message: why };
      this.unlock(false);
      this.skip();
      this.pendingActivity = 'hangpaint';
      return { ok: true, message: 'Guy will hang the painting.' };
    },

    // Where his hand goes on the easel's canvas, and on the wall where the painting will hang.
    easelCanvasPoint() {
      const e = this.obj('easel'), p = e.paint.point(0.5, 0.5);
      e.group.updateWorldMatrix(true, false);
      return e.group.localToWorld(V(p.x, p.y, p.z));
    },
    wallPoint(plan) {
      const F = this.w.wallFrame(plan.wall), p = F.at(plan.u, Math.min(plan.v, 1.5));
      return p.addScaledVector(V(F.n.x, 0, F.n.z), 0.04);
    },

    // The way to the right room: out of the one he is in, into the one the wall is in.
    toRoom(room) {
      const here = this.w.roomIdAt(this.g.root.position.x, this.g.root.position.z);
      if (here === room) return [];
      return [...(here !== 'main' && here !== 'door' ? this.doorOut(here) : []), ...(room !== 'main' ? this.doorIn(room) : [])];
    },

    // At the wall: hang it (or, if the wall changed under him, find another place; with none, it goes to the Catalogue).
    hangSteps() {
      const P = this.w.paintings;
      if (!P.carried) return [];
      const plan = P.plan();
      if (!plan) return [this.play('idle', 0.4, { at: [0.1, () => this.hangDone(P.stash(), null)] })];
      const rooms = this.toRoom(plan.room);
      return [...rooms,
        this.walk(plan.stand.x, plan.stand.z, plan.stand.yaw),
        this.play('reach', 2.6, {
          target: () => this.wallPoint(plan),
          at: [1.3, () => {
            const use = P.valid(plan) ? plan : P.plan();
            const gone = use && use.replace ? P.get(use.replace) : null;
            this.hangDone(use ? P.hang(use) : P.stash(), gone);
          }],
        }),
        this.play('idle', 2.4)];
    },
    hangDone(rec, replaced) {
      this.carry = null;
      const P = this.w.paintings;
      sfx(rec && rec.room ? 'chime' : 'place');
      if (!this.onBuilt) return;
      if (!rec || !rec.room) this.onBuilt('Guy found no bare wall, so the painting is in the Catalogue.');
      else this.onBuilt(`Guy hung a painting in ${P.roomName(rec.room)}.${replaced ? ' The oldest one is in the Catalogue.' : ''}`);
    },

    paintActivities() {
      const w = this.w;
      return {
        // take the painting off the easel and hang it where Guy decides
        hangpaint: () => {
          const P = w.paintings, plan = P && this.obj('easel') && P.easelHas() ? P.plan() : null;
          if (!plan) return ['looking for a bare wall', this.play('idle', 1)];
          return [`taking the painting off the easel to hang it in ${P.roomName(plan.room)}`,
            this.walkAt('easel', 0, 0.78),
            this.walkAt('easel', 0, 0.59, Math.PI, true),
            this.play('reach', 2.2, {
              needs: ['easel'], target: () => this.easelCanvasPoint(),
              at: [1.1, () => { if (P.takeFromEasel(this.workProps.canvas)) { this.carry = 'canvas'; sfx('bookgrab'); } }],
            }),
            this.walkAt('easel', 0, 0.85, null, true),
            { type: 'plan', fn: () => this.hangSteps() }];
        },
        // he was cut short with the canvas in his hands: back to the easel with it (with no easel it goes to the Catalogue)
        putcanvas: () => {
          const P = w.paintings, e = this.obj('easel');
          if (!e || P.easelHas()) return ['putting the painting away', this.play('idle', 0.6, { at: [0.2, () => { P.stash(); this.carry = null; sfx('place', 0.3); if (this.onBuilt) this.onBuilt('Guy put the painting in the Catalogue.'); }] })];
          return ['putting the painting back on the easel',
            this.walkAt('easel', 0, 0.78),
            this.walkAt('easel', 0, 0.59, Math.PI, true),
            this.play('reach', 2.0, {
              needs: ['easel'], target: () => this.easelCanvasPoint(),
              at: [1.0, () => { P.putBack(); this.carry = null; sfx('place', 0.3); }],
            }),
            this.walkAt('easel', 0, 0.85, null, true)];
        },
      };
    },
  });
}
