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

// THE TIMELINE MUST OUTLIVE THE ENTRY. `clear(video)` runs on every pass
// that covers nobody (init-entry: render.length 0 -> uncoverVideo +
// videoRegion.clear), and it deleted the entry that held boxesFn while
// the queued copy had already been consumed on first adoption -- so from
// the first empty pass on, the renderer drew the LIVE tracks, ~DELAY_MS
// ahead of the presented picture. Redmi, 1095, one watch session:
// timelineFrames 100 against overlayFrames 53,801 (2026-09-02).
//
// try/finally, because an assertion that throws above vr.clear leaks the
// 250ms rect timer and HANGS the suite instead of reporting.
test('a timeline survives clear(video) and is read again by the next entry', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const live = [{ key: 'x', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 0, vy: 0 }];
  try {
    vr.setTimeline(video, () => [
      { id: 'x', box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, state: 'blurred' },
    ]);
    vr.setTracks(video, live);
    const now = performance.now();
    for (let i = 0; i < 60; i++) vr._reposition(video, now);
    assert.ok(leftOf(patchesIn(player)[0]) > 200, 'fixture: the first entry reads the timeline');

    vr.clear(video); // nobody blurred on one pass
    vr.setTracks(video, live); // somebody blurred again
    for (let i = 0; i < 60; i++) vr._reposition(video, now);
    const overlay = patchesIn(player)[0];
    assert.ok(overlay, 'a patch was drawn');
    const left = leftOf(overlay);
    assert.ok(left > 200 && left < 300, 'left=' + left + ': the re-created entry must still read the timeline, not the live track at 0');
  } finally {
    vr.clearTimeline(video);
    vr.clear(video);
  }
});

test('clearTimeline is the only thing that detaches a timeline', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const live = [{ key: 'x', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 0, vy: 0 }];
  try {
    vr.setTimeline(video, () => [
      { id: 'x', box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, state: 'blurred' },
    ]);
    vr.setTracks(video, live);
    vr.clear(video);
    vr.clearTimeline(video);
    vr.setTracks(video, live);
    const now = performance.now();
    for (let i = 0; i < 60; i++) vr._reposition(video, now);
    assert.ok(leftOf(patchesIn(player)[0]) < 50, 'detached: the live track is drawn');
  } finally {
    vr.clearTimeline(video);
    vr.clear(video);
  }
});

// THE RENDER LOOP MUST OUTLIVE THE LIVE TRACKS TOO. init-entry calls
// clear(video) on every pass where the LIVE tracker covers nobody, and
// with a timeline attached that is the wrong question: the presented
// picture is DELAY_MS behind, and its subject may still be on screen
// for that long after the live track died. Killing the entry kills the
// rAF loop the timeline draws through, so the delayed frames lost their
// patches the instant the live state emptied -- his "opposite gender
// visible for under a second".
test('clear(video) with a timeline attached keeps the loop alive and the timeline drawn', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const live = [{ key: 'x', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 0, vy: 0 }];
  try {
    vr.setTimeline(video, () => [
      { id: 'x', box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, state: 'blurred' },
    ]);
    vr.setTracks(video, live);
    const now = performance.now();
    for (let i = 0; i < 60; i++) vr._reposition(video, now);
    assert.ok(leftOf(patchesIn(player)[0]) > 200, 'fixture: drawn from the timeline');

    vr.clear(video); // live tracker: nobody blurred; presented picture: still her
    for (let i = 0; i < 60; i++) vr._reposition(video, now);
    const overlay = patchesIn(player)[0];
    assert.ok(overlay, 'the timeline box is still drawn after clear()');
    assert.ok(leftOf(overlay) > 200 && leftOf(overlay) < 300, 'left=' + leftOf(overlay));
  } finally {
    vr.clearTimeline(video);
    vr.clear(video);
    assert.equal(patchesIn(player).length, 0, 'detached and cleared: nothing left in the player');
  }
});

test('clearAll tears the timelines down with the entries (fail-open sweep)', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setTimeline(video, () => [
    { id: 'x', box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, state: 'blurred' },
  ]);
  vr.setTracks(video, [{ key: 'x', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 0, vy: 0 }]);
  vr.clearAll();
  const now = performance.now();
  for (let i = 0; i < 5; i++) vr._reposition(video, now);
  assert.equal(patchesIn(player).length, 0, 'nothing drawn after clearAll');
  vr.setTracks(video, [{ key: 'x', box: { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1 }, vx: 0, vy: 0 }]);
  try {
    for (let i = 0; i < 60; i++) vr._reposition(video, now);
    assert.ok(leftOf(patchesIn(player)[0]) < 50, 'the timeline is gone: live track drawn');
  } finally {
    vr.clear(video);
  }
});

// THE TIMELINE PATH DRAWS THE TARGET, NOT A GLIDE TOWARD IT (1096).
//
// boxesAt already interpolates between two measured verdicts by media
// time, so its answer is continuous frame to frame and every abrupt
// change in it is a DECISION (a clamp opening a cleared man's face, a
// hindsight clear, a cut). lerpRect's shrink glide and shrink deadband
// were built for the live path, where the target jumps once per pass;
// on the timeline path they only re-add lag to a target that is already
// smooth. Measured on the Redmi (events-v1096b): the drawn rect differed
// from the timeline's own target on 2,639 of 5,597 frames, and 6 of 23
// covered certain-male reads were the drawn edge parked 0.05-0.17 wider
// than the target on the shrink side -- a clamp that HAD freed his face
// in the timeline, undone for up to 16 frames by the render damper.
test('on the timeline path a shrinking target is drawn exactly on the next frame, not glided', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  let box = { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 };
  vr.setTracks(video, [{ key: 't1', box: box, vx: 0, vy: 0 }]);
  vr.setTimeline(video, () => [{ id: 't1', box: box, state: 'blurred' }]);
  try {
    const now = performance.now();
    for (let i = 0; i < 10; i++) vr._reposition(video, now + i * 16);
    assert.equal(leftOf(patchesIn(player)[0]), 64, 'settled on the wide target');
    // The clamp frees a face on the left: x1 0.1 -> 0.4 (left 64 -> 256).
    box = { x1: 0.4, y1: 0.1, x2: 0.9, y2: 0.9 };
    vr._reposition(video, now + 200);
    const left = leftOf(patchesIn(player)[0]);
    assert.equal(left, 256, 'left=' + left + ': the edge must be at the target on the very next frame');
  } finally {
    vr.clearTimeline(video);
    vr.clear(video);
  }
});

test('on the timeline path a sub-deadband wobble still does not move the patch (a still subject stays still)', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  let box = { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 };
  vr.setTracks(video, [{ key: 't1', box: box, vx: 0, vy: 0 }]);
  vr.setTimeline(video, () => [{ id: 't1', box: box, state: 'blurred' }]);
  try {
    const now = performance.now();
    for (let i = 0; i < 10; i++) vr._reposition(video, now + i * 16);
    // 1% of the patch span (0.8 * 640 = 512px -> 5px): under MOVE_DEADBAND.
    box = { x1: 0.108, y1: 0.1, x2: 0.908, y2: 0.9 };
    vr._reposition(video, now + 200);
    assert.equal(leftOf(patchesIn(player)[0]), 64, 'a wobble under the deadband is refused');
  } finally {
    vr.clearTimeline(video);
    vr.clear(video);
  }
});

// THE RENDER LOOP DIED ON THE DEVICE AND NOBODY RESTARTED IT (1096d).
//
// Build 4 on the Redmi: __TS_GAZE_RENDER read raf 43 for the life of a
// three-minute watch page while overlayFrames climbed 341 -> 349 in 4s,
// and every timeline target (`tm`) was stale for 175,032 of 180,073ms.
// logcat: "Uncaught TypeError: Cannot read properties of undefined
// (reading '__tsDisp')". The timeline branch reconciles the overlay set
// to the TIMELINE's tracks; a frame where boxesAt answers null then
// renders `entry.tracks` (the setTracks set) against that shorter overlay
// array, indexes past its end, and throws out of `loop()` before the
// next frame is scheduled. Every patch froze where it stood and covered
// whoever walked in: his "random patches" and "Linus covered".
test('a null timeline frame after the timeline shrank the overlay set renders every live track without throwing', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setTracks(video, [
    { key: 'a', box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.9 }, vx: 0, vy: 0 },
    { key: 'b', box: { x1: 0.6, y1: 0.1, x2: 0.8, y2: 0.9 }, vx: 0, vy: 0 },
  ]);
  let answer = [{ id: 'a', box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.9 }, state: 'blurred' }];
  vr.setTimeline(video, () => answer);
  try {
    vr._reposition(video, performance.now());
    assert.equal(patchesIn(player).length, 1, 'fixture: the timeline branch drew one patch');
    answer = null;
    assert.doesNotThrow(() => vr._reposition(video, performance.now() + 16));
    assert.equal(patchesIn(player).length, 2, 'the live fallback draws both tracks');
  } finally {
    vr.clearTimeline(video);
    vr.clear(video);
  }
});

test('a frame that throws inside the render loop is counted and the next frame is still scheduled', () => {
  const { video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setTracks(video, [{ key: 'a', box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.9 }, vx: 0, vy: 0 }]);
  let boom = true;
  vr.setTimeline(video, () => {
    if (boom) throw new Error('boom');
    return null;
  });
  try {
    const before = globalThis.window.__TS_GAZE_RENDER().repositionErrors;
    let pending = [...scheduled.entries()];
    assert.ok(pending.length, 'fixture: the loop is scheduled');
    for (const [id, cb] of pending) {
      scheduled.delete(id);
      assert.doesNotThrow(() => cb(performance.now()), 'a throwing frame must not escape the loop');
    }
    assert.equal(globalThis.window.__TS_GAZE_RENDER().repositionErrors, before + 1, 'the throw is counted');
    assert.ok(scheduled.size, 'and the loop is still alive');
    boom = false;
    pending = [...scheduled.entries()];
    for (const [id, cb] of pending) {
      scheduled.delete(id);
      cb(performance.now());
    }
    assert.ok(scheduled.size, 'a clean frame keeps it alive too');
  } finally {
    vr.clearTimeline(video);
    vr.clear(video);
  }
});

// Critic M3: the round guarded reposition inside loop() and left the
// first call -- the one setTracks makes on a fresh entry, before the
// loop exists -- bare. A throw there skipped `if (!entry.raf) loop()`:
// rAF queued 0, raf 0, repositionErrors 0, forever.
test('a throw on the FIRST reposition of a fresh entry still starts the render loop and is counted', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  let calls = 0;
  vr.setTimeline(video, () => {
    calls++;
    if (calls === 1) throw new Error('first frame');
    return [{ id: 't1', box: { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5 }, state: 'blurred' }];
  });
  const before = globalThis.window.__TS_GAZE_RENDER().repositionErrors;
  try {
    vr.setTracks(video, [{ key: 't1', box: { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5 }, vx: 0, vy: 0 }]);
    // setTracks' own reposition threw (call 1); loop() ran its first
    // frame synchronously right after (call 2) and drew the patch.
    assert.equal(calls, 2, 'the loop started and ran a frame after the throw');
    assert.equal(globalThis.window.__TS_GAZE_RENDER().repositionErrors, before + 1, 'counted');
    assert.ok(scheduled.size >= 1, 'the render loop is scheduled despite the throw');
    assert.equal(patchesIn(player).length, 1, "the loop's frame drew the patch");
  } finally {
    // clearTimeline FIRST: clear() keeps a timeline-attached entry (and
    // its rect interval) alive by design.
    vr.clearTimeline(video);
    vr.clear(video);
  }
});
