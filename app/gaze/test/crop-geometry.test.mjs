// INPUT INTEGRITY. This is the test the audit asked for
// (docs/research/pain-points-2026-08-28.md #3): the gender model's
// hardest-to-see failure was never the model, it was the crop.
//
// A box that is not square in PIXELS reaches faceres stretched, and a
// stretched face reads wrong -- the owner's 2026-08-28 screenshot was a
// clear front-facing man scoring 0.06 male, the same face scoring 0.76
// once the crop was aspect-correct. The identical defect was fixed in
// the video path on 2026-08-24 and survived in the image path until
// 2026-08-28, while three separate gender thresholds were calibrated
// against distorted input. Every one of those calibrations was correct
// for a broken pipeline.
//
// So the geometry is asserted directly rather than inferred from
// downstream scores: no model, no fixtures, nothing that can drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { squareBox, pixelAspect } from '../src/crop-geometry.mjs';

// A 16:9 frame, the shape everything here actually runs on.
const W = 1280;
const H = 720;

// A typical detector face: taller than it is wide in pixels.
const FACE = { x1: 0.4, y1: 0.2, x2: 0.5, y2: 0.5 };

test('a face box reaches the model square IN PIXELS, not in fractions', () => {
  // The bug in one line: 0.1 x 0.3 of a 16:9 frame is 128 x 216 pixels.
  assert.ok(Math.abs(pixelAspect(FACE, W, H) - 128 / 216) < 1e-9);
  const sq = squareBox(FACE, W, H);
  assert.ok(Math.abs(pixelAspect(sq, W, H) - 1) < 1e-9, 'square in pixels');
});

test('squaring never shrinks the box, so it cannot crop the face away', () => {
  const sq = squareBox(FACE, W, H);
  assert.ok((sq.x2 - sq.x1) * W >= (FACE.x2 - FACE.x1) * W - 1e-9);
  assert.ok((sq.y2 - sq.y1) * H >= (FACE.y2 - FACE.y1) * H - 1e-9);
  // The long side is the one that is preserved exactly.
  assert.ok(Math.abs((sq.y2 - sq.y1) * H - (FACE.y2 - FACE.y1) * H) < 1e-9);
});

test('the crop stays centred on what the detector found', () => {
  const sq = squareBox(FACE, W, H);
  assert.ok(Math.abs((sq.x1 + sq.x2) / 2 - (FACE.x1 + FACE.x2) / 2) < 1e-9);
  assert.ok(Math.abs((sq.y1 + sq.y2) / 2 - (FACE.y1 + FACE.y2) / 2) < 1e-9);
});

test('a wide box squares by growing vertically, the mirror case', () => {
  const wide = { x1: 0.1, y1: 0.4, x2: 0.5, y2: 0.45 };
  const sq = squareBox(wide, W, H);
  assert.ok(Math.abs(pixelAspect(sq, W, H) - 1) < 1e-9);
  assert.ok((sq.y2 - sq.y1) * H > (wide.y2 - wide.y1) * H);
  assert.ok(Math.abs((sq.x2 - sq.x1) * W - (wide.x2 - wide.x1) * W) < 1e-9);
});

test('a face at the frame edge is NOT clamped back into range', () => {
  // Clamping would re-introduce exactly the anisotropy this removes:
  // the model would get a stretched face again, and only for people
  // standing near the edge. cropAndResize pads out-of-range reads, which
  // is the correct answer -- the face arrives undistorted with some
  // background missing.
  const edge = { x1: 0.0, y1: 0.1, x2: 0.04, y2: 0.35 };
  const sq = squareBox(edge, W, H);
  assert.ok(sq.x1 < 0, 'left edge runs off frame rather than squashing');
  assert.ok(Math.abs(pixelAspect(sq, W, H) - 1) < 1e-9);
});

test('an already-square box is left alone', () => {
  const already = { x1: 0.4, y1: 0.2, x2: 0.4 + 0.1, y2: 0.2 + (0.1 * W) / H };
  const sq = squareBox(already, W, H);
  assert.ok(Math.abs(sq.x1 - already.x1) < 1e-9);
  assert.ok(Math.abs(sq.y1 - already.y1) < 1e-9);
});

test('a degenerate source is passed through, never divided by', () => {
  // Called mid-layout, a video reports 0x0. Returning NaN boxes here
  // would flag or clear every face in the frame on arithmetic alone.
  const sq = squareBox(FACE, 0, 0);
  assert.deepEqual(sq, { x1: FACE.x1, y1: FACE.y1, x2: FACE.x2, y2: FACE.y2 });
  assert.equal(pixelAspect(FACE, 0, 0), 0);
});

test('the naive version -- square in normalised units -- is the bug', () => {
  // Kept as an executable statement of what must never come back: on a
  // 16:9 frame, equal fractions are a 1.78:1 pixel rectangle, and that
  // is precisely the stretch that made a man read 0.06.
  const naiveSide = Math.max(FACE.x2 - FACE.x1, FACE.y2 - FACE.y1);
  const naive = {
    x1: (FACE.x1 + FACE.x2) / 2 - naiveSide / 2,
    x2: (FACE.x1 + FACE.x2) / 2 + naiveSide / 2,
    y1: (FACE.y1 + FACE.y2) / 2 - naiveSide / 2,
    y2: (FACE.y1 + FACE.y2) / 2 + naiveSide / 2,
  };
  assert.ok(Math.abs(pixelAspect(naive, W, H) - W / H) < 1e-9);
  assert.ok(Math.abs(pixelAspect(naive, W, H) - 1) > 0.7, 'not square, by a lot');
});

test('both model paths square through this one function', () => {
  // The class-level guarantee: the image path (init-entry) and the
  // worker video path (worker-entry) both call classifyFaceGenders with
  // {square:true}, and detector.js has exactly one implementation of
  // what that means. A second inline copy is how the last one survived
  // four days.
  const src = readFileSync(new URL('../src/detector.js', import.meta.url), 'utf8');
  assert.match(src, /squareBox\(/, 'detector delegates to the shared function');
  assert.equal(
    (src.match(/Math\.max\(\(x2 - x1\)/g) || []).length,
    0,
    'no inline re-implementation of the square crop'
  );
});
