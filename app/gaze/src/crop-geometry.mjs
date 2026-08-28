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
