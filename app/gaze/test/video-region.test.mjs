// Player face-region blur (owner ask 2026-08-24). Pure mapping under test
// plus the overlay lifecycle: overlays are created inside the player host,
// reused when the box count is unchanged, and torn down on clear — with a
// rAF loop keeping them pinned to the live video rect (fullscreen-safe,
// unlike the body-anchored thumbnail overlays).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- minimal DOM stub: enough for setBoxes/clear to run under node -------
function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    className: '',
    children: [],
    parentNode: null,
    isConnected: true,
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
    getBoundingClientRect() {
      return this._rect;
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

function playerWithVideo(rect) {
  const player = makeEl('div');
  const video = makeEl('video');
  video._player = player;
  video._rect = rect;
  player.appendChild(video);
  return { player, video };
}

test('boxToHostRect: normalized box -> player-relative absolute rect', () => {
  // player at viewport (80, 40); video inset (20, 10) inside it. The
  // subtraction must yield player-space coords, immune to ancestor
  // transforms (both rects share them).
  const r = vr.boxToHostRect(
    { left: 80, top: 40, width: 700, height: 400 },
    { left: 100, top: 50, width: 640, height: 360 },
    { x1: 0.5, y1: 0.5, x2: 0.75, y2: 1.0 }
  );
  assert.deepEqual(r, { left: 340, top: 190, width: 160, height: 180 });
});

test('canRegionVideo: true only when a player host resolves', () => {
  const { video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  assert.equal(vr.canRegionVideo(video), true);
  const orphan = makeEl('video'); // no _player -> closest returns null
  assert.equal(vr.canRegionVideo(orphan), false);
});

test('setBoxes: creates one overlay per box inside the player host', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const ok = vr.setBoxes(video, [
    { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 },
    { x1: 0.5, y1: 0.5, x2: 0.7, y2: 0.7 },
  ]);
  assert.equal(ok, true);
  assert.equal(player.children.filter((c) => c.tagName === 'DIV').length, 2);
  vr.clear(video);
});

test('setBoxes: reuses overlays when the count is unchanged', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const first = player.children.filter((c) => c.tagName === 'DIV')[0];
  vr.setBoxes(video, [{ x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }]); // moved, same count
  const after = player.children.filter((c) => c.tagName === 'DIV');
  assert.equal(after.length, 1);
  assert.equal(after[0], first); // same node, just repositioned
  // v3: translate-only transform (no scale — corner distortion) plus
  // render-side lerp, so the first frame lands PART WAY toward 256px.
  const m = /translate\(([\d.]+)px/.exec(after[0].style.transform);
  assert.ok(m && Number(m[1]) > 64 && Number(m[1]) <= 256);
  vr.clear(video);
});

test('setBoxes: rebuilds overlays when the count changes', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  vr.setBoxes(video, [
    { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 },
    { x1: 0.5, y1: 0.5, x2: 0.7, y2: 0.7 },
  ]);
  assert.equal(player.children.filter((c) => c.tagName === 'DIV').length, 2);
  vr.clear(video);
});

test('clear: removes every overlay and stops the rAF loop', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const before = scheduled.size;
  vr.clear(video);
  assert.equal(player.children.filter((c) => c.tagName === 'DIV').length, 0);
  assert.ok(scheduled.size <= before); // the pending frame was cancelled
});

test('setBoxes: empty boxes clears instead of drawing', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const ok = vr.setBoxes(video, []);
  assert.equal(ok, false);
  assert.equal(player.children.filter((c) => c.tagName === 'DIV').length, 0);
});

test('interpolateBox: advances along velocity, clamps, caps extrapolation', () => {
  const track = { box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, vx: 0.2, vy: 0 };
  const b = vr.interpolateBox(track, 250); // 0.25s * 0.2/s = 0.05
  assert.ok(Math.abs(b.x1 - 0.45) < 1e-9);
  assert.ok(Math.abs(b.x2 - 0.65) < 1e-9);
  // Past the cap the box stops sliding (stale pass must not drift off).
  const capped = vr.interpolateBox(track, 5000);
  assert.ok(Math.abs(capped.x1 - (0.4 + 0.2 * 1.2)) < 1e-9);
  // Clamped to the frame.
  const edge = vr.interpolateBox({ box: { x1: 0.9, y1: 0, x2: 1, y2: 0.1 }, vx: 1, vy: 0 }, 600);
  assert.equal(edge.x2, 1);
});

test('clearAll: tears down every tracked video', () => {
  const a = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const b = playerWithVideo({ left: 0, top: 0, width: 320, height: 180 });
  vr.setBoxes(a.video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  vr.setBoxes(b.video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  vr.clearAll();
  assert.equal(a.player.children.filter((c) => c.tagName === 'DIV').length, 0);
  assert.equal(b.player.children.filter((c) => c.tagName === 'DIV').length, 0);
});

// --- render lerp: grow instantly, shrink smoothly (R17) ------------
// The symmetric lerp left every LEADING edge ~100ms behind its target,
// which is where a hand or a shoulder leaves the patch. Measured on
// runs/r17b-woman f002: 7.5% of frame width of a covered man's shoulder
// sharp while the target already reached the frame edge.

test('lerpRect: an edge the target has moved OUTSIDE snaps immediately', () => {
  const from = { left: 100, top: 100, width: 100, height: 100 };
  const to = { left: 80, top: 90, width: 160, height: 140 }; // grows every way
  const out = vr.lerpRect(from, to);
  assert.equal(out.left, 80);
  assert.equal(out.top, 90);
  assert.equal(out.left + out.width, 240);
  assert.equal(out.top + out.height, 230);
});

test('lerpRect: an edge the target has moved INSIDE still glides', () => {
  const from = { left: 100, top: 100, width: 100, height: 100 };
  const to = { left: 120, top: 120, width: 60, height: 60 }; // shrinks every way
  const out = vr.lerpRect(from, to);
  assert.ok(out.left > 100 && out.left < 120, 'left eases in, does not snap');
  assert.ok(out.left + out.width > 180 && out.left + out.width < 200, 'right eases in');
});

test('lerpRect: a translating patch never uncovers its leading edge', () => {
  // Pure rightward motion: the right edge is leading, the left trailing.
  let cur = { left: 100, top: 0, width: 100, height: 100 };
  const to = { left: 140, top: 0, width: 100, height: 100 };
  cur = vr.lerpRect(cur, to);
  assert.equal(cur.left + cur.width, 240, 'leading edge is already at the target');
  assert.ok(cur.left < 140, 'trailing edge is still catching up — over-covered, never under');
});
