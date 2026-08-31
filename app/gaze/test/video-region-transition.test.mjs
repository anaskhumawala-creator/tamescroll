// A TRANSITION MOVES THE HOST AND FIRES NEITHER scroll NOR resize.
//
// Restoring the parked miniplayer takes the container from
// fixed-and-scaled back to static-and-unscaled over 220ms. Everything
// reposition() computes is a difference of two CACHED viewport rects,
// which survives a pure transform -- but a restore is a LAYOUT change,
// so `vr`/`hr` sit at their mini values while the player grows, and
// clipToBounds decides the patch is entirely outside the picture and
// display:none's it.
//
// Measured on a built APK with a live track on screen: 3 frames / 84ms
// of the restore with the subject covered by nothing at all, against 0
// frames over 108 frames of the shrink (40 of them mid-drag), where the
// cached rect is the FULL one and the patch never clips fully outside.
//
// These run in their own process so the listeners can be captured
// before the module registers them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const listeners = new Map();
globalThis.addEventListener = (type, fn) => {
  if (!listeners.has(type)) listeners.set(type, []);
  listeners.get(type).push(fn);
};

function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    // The handler refuses a target that is not an ELEMENT (a transition
    // can be reported on the document), so the stub has to carry the
    // property a real element carries.
    nodeType: 1,
    style: {},
    className: '',
    children: [],
    parentNode: null,
    isConnected: true,
    rectReads: 0,
    _rect: { left: 0, top: 0, width: 640, height: 360 },
    appendChild(c) {
      c.parentNode = this;
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
      c.parentNode = null;
      return c;
    },
    getClientRects() {
      return [this._rect];
    },
    getBoundingClientRect() {
      this.rectReads++;
      return this._rect;
    },
    contains(other) {
      if (other === this) return true;
      return this.children.some((c) => c.contains && c.contains(other));
    },
    closest(sel) {
      return sel === '#movie_player' ? this._player || null : null;
    },
  };
}

let rafId = 0;
const scheduled = new Map();
globalThis.requestAnimationFrame = (cb) => {
  const id = ++rafId;
  scheduled.set(id, cb);
  return id;
};
globalThis.cancelAnimationFrame = (id) => scheduled.delete(id);
globalThis.document = { createElement: (t) => makeEl(t) };
globalThis.window = { getComputedStyle: () => ({ position: 'relative' }) };

const vr = await import('../src/video-region.mjs');

function fire(type, target) {
  for (const fn of listeners.get(type) || []) fn({ target });
}

// One rAF turn: run whatever the loop scheduled, and nothing it schedules
// in turn (the loop re-arms itself, so draining would never terminate).
function frame() {
  const due = [...scheduled.entries()];
  scheduled.clear();
  for (const [, cb] of due) cb();
}

function mount() {
  const player = makeEl('div');
  const video = makeEl('video');
  player.appendChild(video);
  video._player = player;
  video._rect = { left: 0, top: 0, width: 640, height: 360 };
  vr.setTracks(video, [{ key: '1', box: { x1: 0.2, y1: 0.2, x2: 0.5, y2: 0.6 } }]);
  frame();
  return { player, video };
}

test('the listeners for a transition on the host are registered at all', () => {
  assert.ok(listeners.has('transitionrun'), 'transitionrun must be listened for');
  assert.ok(listeners.has('transitionend'), 'transitionend must be listened for');
  assert.ok(listeners.has('transitioncancel'), 'transitioncancel must be listened for');
});

test('a running transition on the host refreshes the cached rects EVERY frame', () => {
  const { player, video } = mount();
  player.rectReads = 0;
  frame();
  assert.equal(player.rectReads, 0, 'an idle frame must not read the host rect');

  fire('transitionrun', player);
  frame();
  frame();
  frame();
  assert.ok(
    player.rectReads >= 3,
    `a running transition must re-read every frame, got ${player.rectReads}`
  );
  // The running count is module state, so a test that opens a transition
  // must close it or every later test inherits a permanently dirty
  // renderer -- which is exactly the stranding the floor guards against.
  fire('transitionend', player);
  vr.clear(video);
});

test('the transition ending stops the per-frame reads', () => {
  const { player, video } = mount();
  fire('transitionrun', player);
  frame();
  fire('transitionend', player);
  frame(); // the end marks dirty once, so this frame legitimately reads
  player.rectReads = 0;
  frame();
  frame();
  assert.equal(player.rectReads, 0, 'a settled player must go back to zero reads');
  vr.clear(video);
});

test('a transition somewhere else on the page costs nothing', () => {
  const { player, video } = mount();
  const stranger = makeEl('div');
  player.rectReads = 0;
  fire('transitionrun', stranger);
  frame();
  frame();
  assert.equal(player.rectReads, 0, 'YouTube animating its own chrome must not force layout');
  vr.clear(video);
});

test('a cancel AND an end for one run cannot strand the rects dirty forever', () => {
  // Both can arrive for a single transition. A counter that goes negative
  // would force a layout every frame for the life of the page -- the
  // 140-160 forced-layouts-a-second regression this renderer was rebuilt
  // to remove.
  const { player, video } = mount();
  fire('transitionrun', player);
  fire('transitioncancel', player);
  fire('transitionend', player);
  frame();
  player.rectReads = 0;
  frame();
  frame();
  frame();
  assert.equal(player.rectReads, 0, 'the running count must floor at zero');
  vr.clear(video);
});
