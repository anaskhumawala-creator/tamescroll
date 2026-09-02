// Renderer reads a verdict timeline when one is attached (Stage B,
// docs/superpowers/plans/2026-09-02-latency-restructure-and-delay-line.md,
// Task 9). track-timeline.mjs (Task 8) hands back either a resolved
// [{id, box, state}] array for the presented media time, or null when
// no verdict at/after that time exists yet. The renderer must draw
// straight from that array with NO velocity extrapolation of its own
// (the timeline already interpolated -- interpolateBox is called with
// elapsedMs 0), and fall back to the existing entry.tracks + elapsed
// velocity path unchanged when boxesFn returns null. A 'cleared' item
// in the timeline must not become a patch.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- minimal DOM stub: same pattern as video-region.test.mjs ------------
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

function patchesIn(player) {
  const clip = player.children.filter((c) => c.className === 'ts-gaze-vregion-clip');
  return clip.length ? clip[0].children.filter((c) => c.tagName === 'DIV') : [];
}

function playerWithVideo(rect) {
  const player = makeEl('div');
  const video = makeEl('video');
  video._player = player;
  video._rect = rect;
  player.appendChild(video);
  return { player, video };
}

function leftOf(overlay) {
  const m = /translate\(([\d.-]+)px,([\d.-]+)px\)/.exec(overlay.style.transform || '');
  assert.ok(m, 'overlay has a transform: ' + overlay.style.transform);
  return Number(m[1]);
}

test('reposition is exported for tests', () => {
  assert.equal(typeof vr._reposition, 'function');
});

test('a strong-velocity track follows the timeline box, not the extrapolated one', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  // Strong velocity: if the renderer were still extrapolating this track
  // it would run to the right edge of the 640px frame within a couple of
  // frames. If the timeline wins, it must sit at the timeline's box
  // (x1=0.4 of 640 -> host-relative left 256) instead.
  vr.setTracks(video, [
    { key: 't1', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 5, vy: 5 },
  ]);
  vr.setTimeline(video, () => [
    { id: 't1', box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, state: 'blurred' },
  ]);

  const now = performance.now();
  for (let i = 0; i < 60; i++) vr._reposition(video, now);

  const overlay = patchesIn(player)[0];
  assert.ok(overlay, 'a patch was drawn from the timeline');
  const left = leftOf(overlay);
  assert.ok(left > 200 && left < 300, 'left=' + left + ' should track the timeline box (~256), not the velocity');
  vr.clear(video);
});

test('boxesFn returning null falls back to the velocity path unchanged', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setTracks(video, [
    { key: 't1', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 0.15, vy: 0 },
  ]);
  vr.setTimeline(video, () => null);

  // A fixed elapsed well past MAX_EXTRAPOLATE_MS (1200ms) so the
  // extrapolation target is deterministic regardless of wall-clock
  // jitter between setTracks and the calls below: dx = 0.15 * 1.2 =
  // 0.18, so x1 targets 0.18 -> host-relative left target 0.18*640 =
  // 115.2. The render-side damper (SHRINK_DEADBAND) never fully closes
  // a settled edge -- it parks within a few percent of the target
  // forever by design (see the note above SHRINK_DEADBAND in
  // video-region.mjs) -- so this checks the settled range around that
  // target rather than the exact value.
  const now = performance.now() + 5000;
  for (let i = 0; i < 120; i++) vr._reposition(video, now);

  const overlay = patchesIn(player)[0];
  assert.ok(overlay, 'a patch was drawn from the fallback velocity path');
  const left = leftOf(overlay);
  assert.ok(left > 95 && left < 125, 'left=' + left + ' should settle near the extrapolated velocity target (~115.2), not the timeline (256) or the origin (0)');
  vr.clear(video);
});

test('a cleared timeline item is filtered before reconciling -- only the blurred one is drawn', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setTracks(video, [
    { key: 'seed', box: { x1: 0.0, y1: 0.0, x2: 0.05, y2: 0.05 }, vx: 0, vy: 0 },
  ]);
  vr.setTimeline(video, () => [
    { id: 'a', box: { x1: 0.05, y1: 0.05, x2: 0.15, y2: 0.15 }, state: 'cleared' },
    { id: 'b', box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, state: 'blurred' },
  ]);

  const now = performance.now();
  for (let i = 0; i < 60; i++) vr._reposition(video, now);

  const overlays = patchesIn(player);
  assert.equal(overlays.length, 1, 'exactly one overlay for one blurred + one cleared item');
  const left = leftOf(overlays[0]);
  assert.ok(left > 200 && left < 300, 'the surviving overlay is the blurred one (~256), not the cleared one (~32)');
  vr.clear(video);
});

test('clearTimeline resumes the fallback velocity path', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setTracks(video, [
    { key: 't1', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 0.15, vy: 0 },
  ]);
  vr.setTimeline(video, () => [
    { id: 't1', box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, state: 'blurred' },
  ]);
  const now1 = performance.now();
  for (let i = 0; i < 60; i++) vr._reposition(video, now1);
  const onTimeline = leftOf(patchesIn(player)[0]);
  assert.ok(onTimeline > 200 && onTimeline < 300, 'sanity: timeline was active first');

  vr.clearTimeline(video);
  const now2 = performance.now() + 5000;
  for (let i = 0; i < 120; i++) vr._reposition(video, now2);
  const overlay = patchesIn(player)[0];
  const left = leftOf(overlay);
  assert.ok(left > 95 && left < 125, 'left=' + left + ' should return to the extrapolated velocity target (~115.2) after clearTimeline');
  vr.clear(video);
});

test('setTimeline before any setTracks call is adopted when the entry is created', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setTimeline(video, () => [
    { id: 'x', box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, state: 'blurred' },
  ]);
  vr.setTracks(video, [
    { key: 'x', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 5, vy: 5 },
  ]);

  const now = performance.now();
  for (let i = 0; i < 60; i++) vr._reposition(video, now);

  const overlay = patchesIn(player)[0];
  assert.ok(overlay, 'a patch was drawn');
  const left = leftOf(overlay);
  assert.ok(left > 200 && left < 300, 'left=' + left + ' should already be reading the pending timeline');
  vr.clear(video);
});
