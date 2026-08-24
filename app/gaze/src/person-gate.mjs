// MoveNet person parsing + crop geometry (redesign 2026-08-24; geometry
// rewritten 2026-08-25 after the accuracy review).
//
// The person is the unit of blur. parsePersons reads the model output;
// personCropRegion gives each person the region their face/gender pass
// crops.
//
// Geometry rules learned the hard way (owner frames + review):
//  - Union only keypoints 0-12 (head, shoulders, elbows, wrists, hips).
//    Ankles/knees are routinely HALLUCINATED in head-and-shoulders shots
//    and dragged the patch to the frame floor.
//  - Head size is measured across X but must be applied in Y through the
//    frame aspect, or the head margin comes out ~1.8x too small on 16:9
//    (which is what PTRACK_PAD_TOP was compensating for).
//  - A slot only counts as a PERSON with real evidence: box score, a
//    minimum number of confident keypoints, and an actual head or both
//    shoulders. MoveNet always emits 6 slots; on hand/desk close-ups the
//    empty ones come back with scattered keypoints, and a low floor
//    turned those into frame-sized phantom patches that never expired.
//
// Pure module: no DOM, no tf. Boxes are {x1,y1,x2,y2} normalized 0..1.

// 0.25 -> 0.35 2026-08-25: the old floor sat BELOW the observed
// real-person band (0.28-0.62), so it admitted noise slots by design.
export var PERSON_MIN_SCORE = 0.35;
export var PATCH_MARGIN = 0.08; // outward margin on a finished person patch
export var PERSON_GATE_PAD = 0.15; // person box padded by this fraction of its size for the crop
export var PERSON_KEYPOINT_MIN = 0.3;
// Evidence gate: this many confident keypoints AND a head/shoulder
// anchor before a slot is a person at all.
export var PERSON_MIN_KEYPOINTS = 5;
// Margin around every keypoint. 0.03 -> 0.05 (owner 2026-08-25: cover
// them fully): a wrist keypoint sits at the wrist, and the HAND carries
// on past it.
var KEYPOINT_MARGIN = 0.05;
// All 17 keypoints extend the patch: a covered person must not have
// their legs or hands sticking out of it (owner 2026-08-25). Leg
// keypoints are the noisiest, which is why the EVIDENCE gate below is
// counted over the upper body only (0-12) — a slot still has to prove
// it is a person before its ankles get a vote on the geometry.
var UNION_KEYPOINT_MAX = 17;
var EVIDENCE_KEYPOINT_MAX = 13;

var NOSE = 0;
var L_EAR = 3;
var R_EAR = 4;
var L_EYE = 1;
var R_EYE = 2;
var L_SHOULDER = 5;
var R_SHOULDER = 6;

function kp(data, o, i) {
  return { y: data[o + i * 3], x: data[o + i * 3 + 1], s: data[o + i * 3 + 2] };
}

/**
 * Raw MoveNet MultiPose output -> person boxes. data: the flat [1,6,56]
 * tensor download (6 slots x [17 keypoints x (y,x,score) = 51, then
 * ymin,xmin,ymax,xmax, box score]). aspect = videoWidth/videoHeight,
 * used to convert head width into the right vertical margin.
 */
export function parsePersons(data, minScore, aspect) {
  var floor = typeof minScore === 'number' ? minScore : PERSON_MIN_SCORE;
  var ar = typeof aspect === 'number' && aspect > 0 ? aspect : 16 / 9;
  var out = [];
  for (var p = 0; p < 6; p++) {
    var o = p * 56;
    var score = data[o + 55];
    if (!(score >= floor)) continue;

    // --- evidence gate ---------------------------------------------
    // Count only the keypoints we actually use (0-12). Legs contribute
    // nothing to the patch and are the noisiest slots (owner 2026-08-25:
    // "you don't even have to use all keypoints — do accordingly").
    var confident = 0;
    for (var c = 0; c < EVIDENCE_KEYPOINT_MAX; c++) {
      if (data[o + c * 3 + 2] >= PERSON_KEYPOINT_MIN) confident++;
    }
    if (confident < PERSON_MIN_KEYPOINTS) continue;
    var head = [];
    for (var h = 0; h <= R_EAR; h++) {
      var k = kp(data, o, h);
      if (k.s >= PERSON_KEYPOINT_MIN) head.push(k);
    }
    var ls = kp(data, o, L_SHOULDER);
    var rs = kp(data, o, R_SHOULDER);
    var bothShoulders = ls.s >= PERSON_KEYPOINT_MIN && rs.s >= PERSON_KEYPOINT_MIN;
    if (!head.length && !bothShoulders) continue;

    // --- box: the WHOLE person, head to feet ------------------------
    // A hip clamp lived here for one commit and was wrong. The owner's
    // "patches cover the whole video" complaint was never about covered
    // people being covered too generously — it was about the WRONG
    // people being covered at all. Owner 2026-08-25, explicitly: blur
    // them fully, "not leave anything, the legs or the hands or the
    // head". So the patch is the model's full box unioned with EVERY
    // confident keypoint, legs included, plus a margin.
    var y1 = data[o + 51];
    var x1 = data[o + 52];
    var y2 = data[o + 53];
    var x2 = data[o + 54];

    for (var u = 0; u < UNION_KEYPOINT_MAX; u++) {
      var ku = kp(data, o, u);
      if (!(ku.s >= PERSON_KEYPOINT_MIN)) continue;
      if (ku.y - KEYPOINT_MARGIN < y1) y1 = ku.y - KEYPOINT_MARGIN;
      if (ku.y + KEYPOINT_MARGIN > y2) y2 = ku.y + KEYPOINT_MARGIN;
      if (ku.x - KEYPOINT_MARGIN < x1) x1 = ku.x - KEYPOINT_MARGIN;
      if (ku.x + KEYPOINT_MARGIN > x2) x2 = ku.x + KEYPOINT_MARGIN;
    }

    // --- head anchor: the part that must never escape the patch -----
    var hx = null;
    var hy = null;
    if (head.length) {
      hx = 0;
      hy = 0;
      for (var i = 0; i < head.length; i++) {
        hx += head[i].x;
        hy += head[i].y;
      }
      hx /= head.length;
      hy /= head.length;
      // Head WIDTH in normalized-x: ear span, else eye gap x2.5, else
      // 60% of shoulder span, else a floor.
      var le = kp(data, o, L_EAR);
      var re = kp(data, o, R_EAR);
      var ly = kp(data, o, L_EYE);
      var ry = kp(data, o, R_EYE);
      var headW = 0;
      if (le.s >= PERSON_KEYPOINT_MIN && re.s >= PERSON_KEYPOINT_MIN) {
        headW = Math.abs(le.x - re.x);
      } else if (ly.s >= PERSON_KEYPOINT_MIN && ry.s >= PERSON_KEYPOINT_MIN) {
        headW = Math.abs(ly.x - ry.x) * 2.5;
      } else if (bothShoulders) {
        headW = Math.abs(ls.x - rs.x) * 0.6;
      }
      headW = Math.max(headW, 0.04);
      // Same physical distance is a LARGER number in normalized-y on a
      // wide frame: dy_norm = dx_norm * (W/H).
      var headH = headW * ar;
      if (hy - headH * 1.1 < y1) y1 = hy - headH * 1.1;
      if (hy + headH * 0.9 > y2) y2 = hy + headH * 0.9;
      if (hx - headW * 1.2 < x1) x1 = hx - headW * 1.2;
      if (hx + headW * 1.2 > x2) x2 = hx + headW * 1.2;
    }

    // Final outward margin. Over-covering a person who is meant to be
    // covered costs nothing; under-covering them is the failure the
    // owner counts.
    var mw = (x2 - x1) * PATCH_MARGIN;
    var mh = (y2 - y1) * PATCH_MARGIN;
    out.push({
      y1: Math.max(0, y1 - mh),
      x1: Math.max(0, x1 - mw),
      y2: Math.min(1, y2 + mh),
      x2: Math.min(1, x2 + mw),
      confidence: score,
      // Head anchor in FRAME coordinates (null when no head keypoint is
      // confident, e.g. a person facing away). The face/gender pass uses
      // it to tell THIS person's face from a neighbour's leaking into
      // the same crop — measured 2026-08-25: side-by-side subjects put
      // 2-3 faces in one crop, and "any flagged face flags the person"
      // meant a correctly-read man beside a covered child could never
      // clear (owner: "linus is not clearing at all").
      headX: hx,
      headY: hy,
    });
  }
  return out;
}

/**
 * A face box (normalized, already FACE_ENLARGE-inflated by the detector)
 * -> a person-shaped region: head plus upper torso, no more. Used for
 * people the pose model cannot report — MoveNet MultiPose caps at SIX
 * persons, so in a crowd every face beyond that is covered through this
 * path (owner 2026-08-25: "make sure it works with 10+ people").
 * Deliberately modest: the old +6.0 face-heights turned one false face
 * detection into a full-frame patch.
 */
export function personFromFace(face) {
  var cx = (face.x1 + face.x2) / 2;
  var cy = (face.y1 + face.y2) / 2;
  var w = (face.x2 - face.x1) / 1.4; // de-inflate FACE_ENLARGE
  var h = (face.y2 - face.y1) / 1.4;
  return {
    x1: Math.max(0, cx - w * 1.8),
    y1: Math.max(0, cy - h * 1.0),
    x2: Math.min(1, cx + w * 1.8),
    y2: Math.min(1, cy + h * 6.0),
    confidence: face.confidence,
    headX: cx,
    headY: cy,
    fromFace: true,
  };
}

/**
 * The crop region a person's face/gender pass runs on. Multi-SCALE is
 * the pass that actually adds information — a distant person's face
 * fills the model input here instead of being a handful of pixels in
 * the full frame.
 */
export function personCropRegion(p) {
  return padded(p, PERSON_GATE_PAD);
}

function padded(p, pad) {
  var w = p.x2 - p.x1;
  var h = p.y2 - p.y1;
  return {
    x1: Math.max(0, p.x1 - w * pad),
    y1: Math.max(0, p.y1 - h * pad),
    x2: Math.min(1, p.x2 + w * pad),
    y2: Math.min(1, p.y2 + h * pad),
  };
}
