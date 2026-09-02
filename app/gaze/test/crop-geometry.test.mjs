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
import { squareBox, pixelAspect, fitBox } from '../src/crop-geometry.mjs';

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

// -- fitBox: the same defect one stage EARLIER --------------------------
//
// squareBox fixes the CROP. fitBox fixes the FRAME the crop is taken out
// of, which no amount of squaring can repair: the whole-frame video path
// drew a 640x360 stream into a 256x256 canvas with a four-argument
// drawImage, so every face reached both models 1.78x taller than wide.
// That path is transient on YouTube and is the ONLY path on Reddit, X,
// Instagram and Facebook (engine-findings 16).

test('a 16:9 frame fits without being squashed', () => {
  const f = fitBox(640, 360, 256);
  assert.equal(f.dw, 256, 'the long axis fills the square');
  assert.equal(Math.round(f.dh), 144, '360/640 * 256');
  // THE PROPERTY THAT MATTERS: the aspect survives. The old code gave
  // 256x256 for this input, which is 1.78x wrong.
  assert.ok(Math.abs((f.dw / f.dh) - (640 / 360)) < 1e-9,
    'destination aspect equals source aspect');
});

test('the fitted picture is centred, so the bars are equal', () => {
  const f = fitBox(640, 360, 256);
  assert.equal(f.dx, 0, 'no bars on the axis that fills');
  assert.ok(Math.abs(f.dy - (256 - f.dh) / 2) < 1e-9, 'centred vertically');
  // and it stays inside the square, which is what makes the fillRect
  // enough to guarantee no stale pixels survive
  assert.ok(f.dx >= 0 && f.dy >= 0);
  assert.ok(f.dx + f.dw <= 256 + 1e-9 && f.dy + f.dh <= 256 + 1e-9);
});

test('a portrait frame fits the mirror way', () => {
  const f = fitBox(360, 640, 256);
  assert.equal(f.dh, 256, 'the long axis fills the square');
  assert.equal(Math.round(f.dw), 144);
  assert.equal(f.dy, 0);
});

test('an already-square frame gets no bars at all', () => {
  const f = fitBox(512, 512, 256);
  assert.deepEqual(
    { dx: f.dx, dy: f.dy, dw: f.dw, dh: f.dh },
    { dx: 0, dy: 0, dw: 256, dh: 256 }
  );
});

test('a degenerate source falls back to filling, never divides by zero', () => {
  for (const [w, h] of [[0, 360], [640, 0], [0, 0], [NaN, 360]]) {
    const f = fitBox(w, h, 256);
    assert.ok(Number.isFinite(f.dx) && Number.isFinite(f.dw), `${w}x${h}`);
    assert.equal(f.dw, 256);
    assert.equal(f.dh, 256);
  }
});

test('the whole-frame video path fits through this function, and clears first', () => {
  // The class-level guarantee, same shape as the squareBox one above.
  // The old line was `drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE)`;
  // if it comes back this goes red.
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  assert.match(src, /fitBox\(/, 'the whole-frame path delegates to the shared function');
  assert.equal(
    (src.match(/drawImage\(video, 0, 0, detector\.INPUT_SIZE/g) || []).length,
    0,
    'no four-argument squash back in the face path'
  );
  // AND THE BARS ARE PAINTED. Without this the reused canvas shows the
  // PREVIOUS frame in the margins and the detector is handed two frames
  // at once -- which is worse than the squash it replaces.
  assert.match(src, /fillRect\(0, 0, detector\.INPUT_SIZE, detector\.INPUT_SIZE\)/,
    'the canvas is cleared before the fitted draw');
});
