// THE CROP WE HAND THE GENDER MODEL IS NOT THE CROP IT WAS TRAINED ON.
//
// `squareBox` (crop-geometry.mjs) grows the detector's box to a square
// about the BOX CENTRE and stops there. Whatever angle the head was at,
// wherever the face sat inside the box, that is what faceres receives.
//
// Every face-attribute model in this lineage is trained on ALIGNED
// crops -- rotated so the eye line is level, translated so the eyes land
// at a fixed place, scaled so the eye separation is a fixed fraction of
// the frame. FairFace says so in its own README (dlib `get_face_chip()`),
// and it is the near-universal convention. So the model has, in effect,
// never seen a tilted or off-centre face, and we hand it both.
//
// MEASURED ON OUR OWN CORPUS, women only, 2,159 reads with landmarks,
// within-identity (the same woman compared against herself, which is the
// control that killed the face-SIZE story):
//
//   strongly turned head (asym >= 0.2) ....... -10.0 pts accuracy
//                                              5 clusters worse, 2 better
//   tilted head (tilt >= 5 degrees) .......... -4.5 pts
//                                              8 clusters worse, 1 better
//
// Both of those are what alignment exists to remove. Turn is not fully
// fixable by a 2D transform -- a profile face is missing pixels, not
// merely rotated -- but tilt and centring are exactly a similarity
// transform, and the landmarks that define one are ALREADY DECODED on
// every face (face-decode.mjs `marks`, free, no extra inference).
//
// WHAT THIS IS NOT: a fix for the tracker. 72-86% of scored error is the
// decision layer and the clock (track-accuracy.md), and a perfect gender
// model is worth 13.7%. This is a slice of that 13.7%, bought for a day.
//
// NOTHING CALLS THIS YET. It ships only if the A/B on the corpus beats
// squareBox against the HUMAN labels, held out by video -- the dynamic
// bar looked like free money in sample and died on exactly that split
// (engine-findings 29).

/** Where an aligned crop puts the face, as fractions of the output
 *  square. Defaults are the dlib/FairFace convention; the A/B sweeps
 *  them rather than trusting the convention, because faceres' own
 *  training alignment is not published. */
export var ALIGN_EYE_Y = 0.38;      // eye line height
export var ALIGN_EYE_DX = 0.32;     // eye separation as a fraction of width

export function setAlignTarget(eyeY, eyeDx) {
  if (isFinite(eyeY) && eyeY > 0 && eyeY < 1) ALIGN_EYE_Y = eyeY;
  if (isFinite(eyeDx) && eyeDx > 0 && eyeDx < 1) ALIGN_EYE_DX = eyeDx;
}

/**
 * The INVERSE similarity transform for `tf.image.transform`, which maps
 * an OUTPUT pixel back to an INPUT pixel -- that is the direction the op
 * wants, and getting it backwards produces a plausible-looking crop that
 * is wrong in a way no assertion catches.
 *
 * Returns the 8-element row [a0,a1,a2,b0,b1,b2,c0,c1] such that
 *   srcX = a0*x + a1*y + a2
 *   srcY = b0*x + b1*y + b2
 * (c0 = c1 = 0: a similarity transform has no perspective term.)
 *
 * `face.marks` are normalised 0..1 of the source; srcW/srcH turn them
 * into pixels, because a rotation is only a rotation in PIXEL space -- on
 * a 640x360 frame a normalised rotation shears the face, which is the
 * same class of defect as the squash crop-geometry.mjs exists for.
 *
 * Returns null when the face carries no usable landmarks, and the caller
 * must then fall back to squareBox. Never throws: a detection with a
 * collapsed landmark regression is a real thing that happens on
 * face-shaped graphics.
 */
export function alignTransform(face, srcW, srcH, outSize) {
  if (!face || !face.marks || face.marks.length < 12) return null;
  if (!(srcW > 0) || !(srcH > 0) || !(outSize > 0)) return null;
  var m = face.marks;
  for (var i = 0; i < 4; i++) if (!isFinite(m[i])) return null;

  // marks 0 = right eye, 1 = left eye (face-marks.mjs).
  var rx = m[0] * srcW, ry = m[1] * srcH;
  var lx = m[2] * srcW, ly = m[3] * srcH;
  var dx = lx - rx, dy = ly - ry;
  var eye = Math.sqrt(dx * dx + dy * dy);
  // A collapsed regression gives eye ~ 0 and would divide the whole
  // transform by nothing. Refuse rather than emit an infinite scale.
  if (!(eye > 1e-3)) return null;

  // Output geometry: eyes ALIGN_EYE_DX apart, centred, at ALIGN_EYE_Y.
  var outEye = ALIGN_EYE_DX * outSize;
  // scale maps output pixels -> source pixels
  var s = eye / outEye;
  // rotation of the source eye line, undone in the output
  var cos = (dx / eye) * s;
  var sin = (dy / eye) * s;

  var midX = (rx + lx) / 2, midY = (ry + ly) / 2;
  var ox = outSize / 2, oy = ALIGN_EYE_Y * outSize;

  // srcX = cos*(x-ox) - sin*(y-oy) + midX
  // srcY = sin*(x-ox) + cos*(y-oy) + midY
  return [
    cos, -sin, midX - cos * ox + sin * oy,
    sin, cos, midY - sin * ox - cos * oy,
    0, 0,
  ];
}

/**
 * How far a detection is from aligned already, in the two quantities the
 * transform corrects: eye-line tilt in degrees, and how far the eye
 * midpoint sits from where an aligned crop would put it, as a fraction
 * of the box. A bench slices by these; nothing decides on them.
 */
export function alignError(face, srcW, srcH) {
  if (!face || !face.marks || face.marks.length < 12) return null;
  var m = face.marks;
  var rx = m[0] * srcW, ry = m[1] * srcH;
  var lx = m[2] * srcW, ly = m[3] * srcH;
  var dx = lx - rx, dy = ly - ry;
  var eye = Math.sqrt(dx * dx + dy * dy);
  if (!(eye > 1e-3)) return null;
  var boxW = Math.max(1e-6, (face.x2 - face.x1) * srcW);
  var boxH = Math.max(1e-6, (face.y2 - face.y1) * srcH);
  var midX = (rx + lx) / 2, midY = (ry + ly) / 2;
  var wantX = (face.x1 * srcW) + boxW / 2;
  var wantY = (face.y1 * srcH) + ALIGN_EYE_Y * boxH;
  return {
    tiltDeg: Math.abs((Math.atan2(dy, dx) * 180) / Math.PI),
    offX: (midX - wantX) / boxW,
    offY: (midY - wantY) / boxH,
    eyeFrac: eye / boxW,
  };
}

/**
 * THE CHEAP HALF, and the reason it exists separately.
 *
 * `tf.image.transform` is the only op that can ROTATE, and it transforms
 * a BATCH OF IMAGES -- one transform per image. Our shape is the
 * opposite: one frame, N faces. `cropAndResize` takes N rects against a
 * single image in ONE op, which is why the shipped path costs one GPU
 * call no matter how many faces are on screen. Doing the same work with
 * `transform` means either tiling the frame N times (N copies of a
 * 640x360 frame in GPU memory) or N separate ops and N fence waits --
 * and a fence wait is the expensive part on this backend, measured
 * repeatedly in this repo.
 *
 * So rotation is NOT free, and it must earn its cost against this:
 * centring and scaling on the eyes are just a DIFFERENT RECTANGLE, which
 * `cropAndResize` takes at exactly the price it already pays. Zero extra
 * ops, zero extra memory, zero extra fence waits.
 *
 * The A/B runs three arms for that reason -- shipped, eye-rect (free),
 * full align (costs) -- so the rotation is only bought if it beats the
 * free arm by enough to be worth a per-face GPU call on his phone.
 *
 * Returns a normalised {x1,y1,x2,y2} square in PIXEL terms, like
 * squareBox, or null when the landmarks are unusable.
 */
export function eyeRect(face, srcW, srcH) {
  if (!face || !face.marks || face.marks.length < 12) return null;
  if (!(srcW > 0) || !(srcH > 0)) return null;
  var m = face.marks;
  for (var i = 0; i < 4; i++) if (!isFinite(m[i])) return null;
  var rx = m[0] * srcW, ry = m[1] * srcH;
  var lx = m[2] * srcW, ly = m[3] * srcH;
  var dx = lx - rx, dy = ly - ry;
  var eye = Math.sqrt(dx * dx + dy * dy);
  if (!(eye > 1e-3)) return null;
  // The side of an aligned crop whose eye separation is ALIGN_EYE_DX.
  var side = eye / ALIGN_EYE_DX;
  var midX = (rx + lx) / 2, midY = (ry + ly) / 2;
  var x1 = midX - side / 2;
  var y1 = midY - ALIGN_EYE_Y * side;
  return {
    x1: x1 / srcW, x2: (x1 + side) / srcW,
    y1: y1 / srcH, y2: (y1 + side) / srcH,
  };
}
