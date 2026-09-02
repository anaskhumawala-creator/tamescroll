// The one place a crop box is made square, and the reason it exists.
//
// `tf.image.cropAndResize` squashes whatever rectangle it is given into
// the model's square input. A box that is not square in PIXELS therefore
// reaches faceres as a STRETCHED face, and faceres reads a stretched
// face wrong: a clear front-facing man measured 0.06 on the male head
// (owner screenshot, 2026-08-28) where the same face aspect-corrected
// measured 0.76.
//
// That defect was found and fixed in the VIDEO path on 2026-08-24
// (v1009, "the first square-stretch version distorted faces and
// re-blurred Linus") and lived on in the IMAGE path until 2026-08-28 --
// four days and three model swaps, during which every gender threshold
// (0.85, 0.25, 0.12) was calibrated against distorted inputs. The audit
// (docs/research/pain-points-2026-08-28.md #3) calls it the project's
// best-documented violation of fix-the-class-not-the-instance.
//
// So the arithmetic lives here, exported and tested, instead of inline
// in one caller. A future preprocessing change fails a test rather than
// surviving three threshold recalibrations.

/**
 * Square a normalised box (0..1 of a srcW x srcH picture) so that it is
 * square in PIXELS -- which is what "square" has to mean for a model
 * whose input is square. Grows to the longer side about the box centre;
 * never shrinks, because shrinking would crop the face the detector
 * found.
 *
 * Returns {x1,y1,x2,y2} normalised, and MAY fall outside 0..1: cropAndResize
 * pads out-of-range reads, and clamping here would re-introduce the very
 * anisotropy the function exists to remove (a face at the edge of frame
 * would come back stretched).
 */
export function squareBox(box, srcW, srcH) {
  if (!(srcW > 0) || !(srcH > 0)) return { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 };
  var cx = ((box.x1 + box.x2) / 2) * srcW;
  var cy = ((box.y1 + box.y2) / 2) * srcH;
  var side = Math.max((box.x2 - box.x1) * srcW, (box.y2 - box.y1) * srcH) / 2;
  return {
    x1: (cx - side) / srcW,
    x2: (cx + side) / srcW,
    y1: (cy - side) / srcH,
    y2: (cy + side) / srcH,
  };
}

/**
 * How far from square, in pixels, a normalised box is -- 1 is square,
 * 2 means one side is twice the other. The number a test can assert on
 * without owning a model.
 */
export function pixelAspect(box, srcW, srcH) {
  var w = (box.x2 - box.x1) * srcW;
  var h = (box.y2 - box.y1) * srcH;
  if (!(w > 0) || !(h > 0)) return 0;
  return w / h;
}

/**
 * Fit a srcW x srcH picture into a `size` x `size` square WITHOUT
 * squashing it: uniform scale, centred, black bars on the short axis.
 * Returns {dx, dy, dw, dh} in destination pixels.
 *
 * THE SAME DEFECT AS squareBox, ONE STAGE EARLIER, and it lived in the
 * whole-frame video path from the beginning:
 *
 *     ctx.drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE)
 *
 * -- the four-argument form, no source rectangle, no aspect. A 640x360
 * stream became a 256x256 square, so every face arrived 1.78x taller
 * than wide, and `classifyFaceGenders({square:true})` then cut a square
 * out of that buffer -- square in the STRETCHED space, a 16:9 rectangle
 * in reality. squareBox cannot undo a distortion that is upstream of it.
 *
 * MEASURED before it was changed (engine-findings 16a, 15 native 640x360
 * frames through the shipping functions, stretched against letterboxed):
 * faceres' descriptor magnitude is HIGHER undistorted on **17 of 18**
 * faces, p50 +1.08, sign test p = 1.45e-4 -- and it wins despite giving
 * every face FEWER pixels. Four faces cross NULL_MINT_NM_FLOOR, and 2 of
 * 13 solid-signal faces flip gender label, one moving raw 0.601 ->
 * 0.377.
 *
 * WHY THAT MATTERS MORE THAN IT LOOKS: on YouTube the whole-frame path
 * is transient (the person-primary path takes over once MoveNet lands),
 * but `isPlayer` is `closest('#movie_player')`, so on Reddit, X,
 * Instagram and Facebook this is the ONLY path there is
 * (engine-findings 16).
 *
 * Bars are BLACK and the caller must clear the canvas, because a reused
 * canvas otherwise shows the previous frame in the margins -- which
 * would hand the detector two frames at once.
 *
 * TWO SQUASHES REMAIN IN THE TREE ON PURPOSE.
 *
 * `init-entry.js:2081` is the scene gate, a luma delta between two
 * frames squashed IDENTICALLY -- the distortion cancels out of a
 * difference, and correcting it would only move the constant.
 *
 * `detector.js:591` is MoveNet, and that one is a real defect measured
 * at findings 16b: 241 frames, persons admitted 219 -> 269 (+22.8%),
 * with 35 frames where the squash admits NOBODY and the letterbox admits
 * someone against 4 the reverse (p < 1e-5, same direction in all five
 * videos). It is NOT fixed here because MoveNet's outputs are normalized
 * to its own input, and that is safe today only BECAUSE the squash is a
 * uniform per-axis scale of the whole frame. Letterbox it and every
 * keypoint and box needs mapping back through the pad before
 * `parsePersons` reads it -- and that is the extent source the entire
 * placement layer and the whole corpus sit on. It is a round, not an
 * edit.
 */
export function fitBox(srcW, srcH, size) {
  if (!(srcW > 0) || !(srcH > 0) || !(size > 0)) {
    return { dx: 0, dy: 0, dw: size || 0, dh: size || 0 };
  }
  var k = Math.min(size / srcW, size / srcH);
  var dw = srcW * k;
  var dh = srcH * k;
  return { dx: (size - dw) / 2, dy: (size - dh) / 2, dw: dw, dh: dh };
}
