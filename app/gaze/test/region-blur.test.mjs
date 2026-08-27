// Person-region blur pure math (v3, parent-anchored — owner report
// 2026-08-24: scroll briefly exposed document-anchored patches).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxToParentRect, sameRect, padBox, expandToBody, mergeOverlapping, isPlayerSubtree, shouldStandDown, PLAYER_SUBTREE_SELECTOR, coversRect, imagePriority, PRIORITY_BEHIND } from '../src/region-blur.mjs';

test('boxToParentRect: element inset inside its parent maps to parent space', () => {
  // parent at viewport (80, 40); img at (100, 50) sized 200x100
  const r = boxToParentRect(
    { left: 80, top: 40, width: 240, height: 140 },
    { left: 100, top: 50, width: 200, height: 100 },
    { x1: 0.25, y1: 0.25, x2: 0.75, y2: 0.75 }
  );
  assert.deepEqual(r, { left: 70, top: 35, width: 100, height: 50 });
});

test('boxToParentRect: clamps boxes to the element bounds', () => {
  const r = boxToParentRect(
    { left: 0, top: 0, width: 200, height: 100 },
    { left: 0, top: 0, width: 200, height: 100 },
    { x1: -0.2, y1: 0, x2: 1.4, y2: 1.2 }
  );
  assert.deepEqual(r, { left: 0, top: 0, width: 200, height: 100 });
});

test('boxToParentRect: degenerate boxes yield zero-size rects, never negative', () => {
  const r = boxToParentRect(
    { left: 0, top: 0, width: 200, height: 100 },
    { left: 0, top: 0, width: 200, height: 100 },
    { x1: 0.9, y1: 0.9, x2: 0.9, y2: 0.9 }
  );
  assert.equal(r.width, 0);
  assert.equal(r.height, 0);
});

test('sameRect: equal within sub-pixel epsilon, unequal beyond it', () => {
  const a = { left: 10, top: 20, width: 100, height: 50 };
  assert.equal(sameRect(a, { left: 10, top: 20, width: 100, height: 50 }), true);
  assert.equal(sameRect(a, { left: 10.3, top: 20.2, width: 100, height: 50 }), true);
  assert.equal(sameRect(a, { left: 12, top: 20, width: 100, height: 50 }), false);
  assert.equal(sameRect(a, { left: 10, top: 20, width: 108, height: 50 }), false);
  assert.equal(sameRect(a, null), false);
  assert.equal(sameRect(null, a), false);
});

test('padBox: expands a box by a fraction of its own size, clamped to 0..1', () => {
  const p = padBox({ x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6, confidence: 0.9 }, 0.5);
  assert.equal(Math.round(p.x1 * 1000) / 1000, 0.3);
  assert.equal(Math.round(p.y1 * 1000) / 1000, 0.3);
  assert.equal(Math.round(p.x2 * 1000) / 1000, 0.7);
  assert.equal(Math.round(p.y2 * 1000) / 1000, 0.7);
  assert.equal(p.confidence, 0.9);
});

test('padBox: never pushes past the element edge', () => {
  const p = padBox({ x1: 0.05, y1: 0.9, x2: 0.25, y2: 1.0 }, 0.5);
  assert.equal(p.x1, 0);
  assert.equal(p.y2, 1);
  assert.ok(p.x2 <= 1 && p.y1 >= 0);
});

test('expandToBody: de-inflates the box, widens to shoulders, covers hair above and torso below', () => {
  const b = expandToBody({ x1: 0.45, y1: 0.1, x2: 0.55, y2: 0.2, confidence: 0.9 });
  assert.ok(Math.abs(b.x1 - 0.4142857) < 1e-6);
  assert.ok(Math.abs(b.x2 - 0.5857143) < 1e-6);
  // Top edge clears the crown by a whole face-height of hair room.
  assert.ok(Math.abs(b.y1 - 0.0428571) < 1e-6);
  assert.ok(Math.abs(b.y2 - 0.6142857) < 1e-6);
  assert.equal(b.confidence, 0.9);
  // sanity: the body column must NOT balloon toward the full frame WIDTH
  // (visual probe 2026-08-24 caught exactly that).
  assert.ok(b.x2 - b.x1 < 0.25);
});

test('expandToBody: clamps to the element for edge faces', () => {
  const b = expandToBody({ x1: 0.0, y1: 0.6, x2: 0.3, y2: 0.95 });
  assert.equal(b.x1, 0);
  assert.equal(b.y2, 1);
  assert.ok(b.x2 <= 1 && b.y1 >= 0);
});

test('mergeOverlapping: overlapping boxes union, disjoint stay, chains collapse', () => {
  const merged = mergeOverlapping([
    { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3, confidence: 0.5 },
    { x1: 0.25, y1: 0.1, x2: 0.5, y2: 0.35, confidence: 0.7 },
    { x1: 0.45, y1: 0.1, x2: 0.6, y2: 0.3, confidence: 0.4 },
    { x1: 0.8, y1: 0.8, x2: 0.9, y2: 0.9, confidence: 0.9 },
  ]);
  assert.equal(merged.length, 2);
  const chain = merged.find((b) => b.x1 === 0.1);
  assert.equal(chain.x2, 0.6);
  assert.equal(chain.confidence, 0.7);
});

test('isPlayerSubtree: an image patch is refused a host inside the shared player', () => {
  // Owner 2026-08-27, phone screenshot: a blur rectangle floating across
  // the playing video, anchored to nothing. m.youtube recycles ONE
  // #movie_player between feed previews and the watch player, so a patch
  // hosted in a previewing thumbnail is orphaned inside the player when
  // the element is reused -- it stops tracking, paints over the video and
  // rides the sticky player up under the top bar.
  const inPlayer = { closest: (sel) => (sel === PLAYER_SUBTREE_SELECTOR ? {} : null) };
  const normal = { closest: () => null };
  assert.equal(isPlayerSubtree(inPlayer), true);
  assert.equal(isPlayerSubtree(normal), false);
  // Must never throw into the pipeline, whatever it is handed.
  assert.equal(isPlayerSubtree(null), false);
  assert.equal(isPlayerSubtree({}), false);
  assert.equal(isPlayerSubtree({ closest: () => { throw new Error('detached'); } }), false);
});

test('the player selector covers both names m.youtube uses', () => {
  // The preview host and the player are separate elements and BOTH have
  // been seen carrying an orphaned patch in a live DOM read.
  assert.ok(PLAYER_SUBTREE_SELECTOR.includes('#movie_player'));
  assert.ok(PLAYER_SUBTREE_SELECTOR.includes('ytm-video-preview'));
});

test('coversRect: a preview only stands the still patch down when it really covers it', () => {
  // Owner 2026-08-27: while a preview plays over a thumbnail, the still's
  // patches and the video path's whole-video blur disagree about where
  // the person is, and the seam reads as wrong. Standing the still down
  // is only safe when the preview covers essentially all of it -- a
  // partial overlap would leave a face sharp in the uncovered strip.
  const thumb = { left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 };
  const exact = { left: 0, top: 0, right: 200, bottom: 100 };
  const offByRounding = { left: -1, top: -1, right: 201, bottom: 101 };
  const half = { left: 100, top: 0, right: 200, bottom: 100 };
  const elsewhere = { left: 400, top: 400, right: 600, bottom: 500 };
  assert.equal(coversRect(exact, thumb), true);
  assert.equal(coversRect(offByRounding, thumb), true, 'a pixel of layout rounding must not count as uncovered');
  assert.equal(coversRect(half, thumb), false, 'half a thumbnail uncovered is an exposure, not a seam');
  assert.equal(coversRect(elsewhere, thumb), false);
  assert.equal(coversRect(null, thumb), false);
  assert.equal(coversRect(exact, { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }), false);
});

// Queue order is load order, which is not view order (owner 2026-08-27:
// "can't you preload the thumbnail blurs before my scrolling"). These
// pin the ordering the drain sorts by.
test('imagePriority: on-screen outranks everything', () => {
  const vh = 800;
  assert.equal(imagePriority({ top: 100, bottom: 300 }, vh), 0);
  // Straddling the fold still counts as on screen.
  assert.equal(imagePriority({ top: -50, bottom: 60 }, vh), 0);
  assert.ok(imagePriority({ top: 900, bottom: 1100 }, vh) > 0);
});

test('imagePriority: below the fold runs nearest-first', () => {
  const vh = 800;
  const near = imagePriority({ top: 850, bottom: 1050 }, vh);
  const far = imagePriority({ top: 3000, bottom: 3200 }, vh);
  assert.ok(near < far, `${near} should sort before ${far}`);
});

test('imagePriority: already-passed images park behind everything ahead', () => {
  const vh = 800;
  const above = imagePriority({ top: -400, bottom: -200 }, vh);
  const veryFarBelow = imagePriority({ top: 100000, bottom: 100200 }, vh);
  assert.ok(above > veryFarBelow);
  // ...but they are never dropped, and the nearest one above comes first.
  const higher = imagePriority({ top: -4000, bottom: -3800 }, vh);
  assert.ok(above < higher);
  assert.ok(above < PRIORITY_BEHIND * 2);
});

test('imagePriority: a missing rect sorts last instead of throwing', () => {
  assert.equal(imagePriority(null, 800), PRIORITY_BEHIND * 2);
});

test('shouldStandDown: a PLAYING host covering the still hides its patches', () => {
  const el = { left: 0, top: 100, right: 400, bottom: 325, width: 400, height: 225 };
  const host = { left: 0, top: 100, right: 400, bottom: 325, width: 400, height: 225 };
  assert.equal(shouldStandDown(host, true, el), true);
  // Parked host: the still shows THROUGH it, so hiding the patch exposes.
  assert.equal(shouldStandDown(host, false, el), false);
  // A host somewhere else on the page is not this element's preview.
  const other = { left: 0, top: 700, right: 400, bottom: 925, width: 400, height: 225 };
  assert.equal(shouldStandDown(other, true, el), false);
  // Barely-overlapping host leaves most of the still visible.
  const edge = { left: 0, top: 280, right: 400, bottom: 505, width: 400, height: 225 };
  assert.equal(shouldStandDown(edge, true, el), false);
});
