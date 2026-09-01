// WHAT THE INSIDE OF A DETECTION LOOKS LIKE.
//
// Every signal this project has used to tell a face from a face-shaped
// graphic describes the OUTSIDE of the detection -- its confidence, its
// pixel size, or MoveNet's opinion of the whole frame. All three were
// measured and all three failed:
//
//   confidence   refused p50 0.78 vs kept p50 0.79 (his phone, 60 vs 19)
//   size         refused px p50 72 vs kept 79
//   frame kp     refused max 0.098 vs kept min 0.106 -- the gate is
//                deciding whether MoveNet's noise cleared 0.1 that pass
//
// BlazeFace regresses six facial landmarks -- right eye, left eye, nose,
// mouth, right ear, left ear -- and this project threw them away for
// eighteen months. They cost no inference, they are our own model, and
// they describe the one thing the other three do not: whether the thing
// inside the box is ARRANGED like a face.
//
// NOTHING HERE DECIDES ANYTHING YET. These are measurements, recorded on
// both sides of the gate so the two populations can be compared before a
// rule is written. Every previous attempt at this gate was calibrated on
// one side only and refused people.
//
// Landmark order, from the back-model decode (detector.js):
//   0 right eye, 1 left eye, 2 nose, 3 mouth, 4 right ear, 5 left ear
// as x,y pairs normalized 0..1 of the source, the same units as the box.
export var MARK_RIGHT_EYE = 0;
export var MARK_LEFT_EYE = 1;
export var MARK_NOSE = 2;
export var MARK_MOUTH = 3;
export var MARK_RIGHT_EAR = 4;
export var MARK_LEFT_EAR = 5;

function pt(marks, i) {
  return { x: marks[i * 2], y: marks[i * 2 + 1] };
}

function dist(a, b) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Scale-free description of a detection's landmark geometry, or null if
 * the detection carries no landmarks (the in-page fallback path, or a
 * synthetic face-from-body).
 *
 * Everything is expressed as a fraction of INTEROCULAR DISTANCE, not of
 * the box: the box is enlarged by FACE_ENLARGE and squarified, so box
 * fractions carry that convenience into the measurement. Eye separation
 * is the one length a face actually has.
 *
 *   eyeSpan   eye separation as a fraction of box width. A real upright
 *             face sits in a narrow band; a degenerate regression
 *             collapses toward 0.
 *   mouthDrop mouth centre below the eye line, in interocular units.
 *             Negative means the mouth is ABOVE the eyes.
 *   noseDrop  same for the nose.
 *   earSpan   ear separation over eye separation. Ears are outside the
 *             eyes on any real head.
 *   tilt      |angle| of the eye line, in degrees, 0 = level.
 *   asym      how far the nose sits from the eye midpoint, sideways, in
 *             interocular units. A face is roughly symmetric about it.
 *   inBox     fraction of the six points that land inside the box.
 *   spread    largest pairwise distance over interocular distance -- a
 *             collapsed regression makes every point coincide.
 *
 * NO THRESHOLDS HERE ON PURPOSE. The numbers go in the diagnostic rings
 * first; a rule comes after the two populations are measured.
 */
export function markShape(face) {
  if (!face || !face.marks || face.marks.length < 12) return null;
  var m = face.marks;
  for (var i = 0; i < 12; i++) {
    if (typeof m[i] !== 'number' || !isFinite(m[i])) return null;
  }
  var re = pt(m, MARK_RIGHT_EYE);
  var le = pt(m, MARK_LEFT_EYE);
  var nose = pt(m, MARK_NOSE);
  var mouth = pt(m, MARK_MOUTH);
  var rEar = pt(m, MARK_RIGHT_EAR);
  var lEar = pt(m, MARK_LEFT_EAR);

  var eye = dist(re, le);
  var boxW = Math.max(1e-6, (face.x2 || 0) - (face.x1 || 0));
  // A zero interocular distance is itself the strongest possible signal
  // (the regression collapsed), so report it rather than dividing by it.
  if (eye <= 1e-6) {
    return { eyeSpan: 0, mouthDrop: 0, noseDrop: 0, earSpan: 0, tilt: 0,
             asym: 0, inBox: inBoxFrac(face, m), spread: 0, degenerate: 1 };
  }

  var mid = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 };
  // Along the eye line and perpendicular to it, so a tilted head is
  // measured the same as a level one.
  var ux = (le.x - re.x) / eye;
  var uy = (le.y - re.y) / eye;
  function along(p) { return ((p.x - mid.x) * ux + (p.y - mid.y) * uy) / eye; }
  function below(p) { return ((p.x - mid.x) * -uy + (p.y - mid.y) * ux) / eye; }

  var pts = [re, le, nose, mouth, rEar, lEar];
  var maxD = 0;
  for (var a = 0; a < pts.length; a++) {
    for (var b = a + 1; b < pts.length; b++) {
      var d = dist(pts[a], pts[b]);
      if (d > maxD) maxD = d;
    }
  }

  return {
    eyeSpan: eye / boxW,
    mouthDrop: below(mouth),
    noseDrop: below(nose),
    earSpan: dist(rEar, lEar) / eye,
    tilt: Math.abs((Math.atan2(le.y - re.y, le.x - re.x) * 180) / Math.PI),
    asym: Math.abs(along(nose)),
    inBox: inBoxFrac(face, m),
    spread: maxD / eye,
    degenerate: 0,
  };
}

function inBoxFrac(face, m) {
  var n = 0;
  for (var i = 0; i < 6; i++) {
    var x = m[i * 2];
    var y = m[i * 2 + 1];
    if (x >= face.x1 && x <= face.x2 && y >= face.y1 && y <= face.y2) n++;
  }
  return n / 6;
}

/** Compact, all-numeric form for a diagnostic ring. 3dp, because a gate
 * that is ever calibrated on these must not be calibrated on rounding --
 * PFF_FRAME_KP_FLOOR was, and the separator turned out to be 0.098
 * against 0.101. */
export function markRing(shape) {
  if (!shape) return null;
  function r(v) { return Math.round(v * 1000) / 1000; }
  return {
    es: r(shape.eyeSpan),
    md: r(shape.mouthDrop),
    nd: r(shape.noseDrop),
    ea: r(shape.earSpan),
    ti: r(shape.tilt),
    as: r(shape.asym),
    ib: r(shape.inBox),
    sp: r(shape.spread),
    dg: shape.degenerate,
  };
}
