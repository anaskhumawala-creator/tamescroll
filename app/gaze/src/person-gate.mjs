// MoveNet person parsing + crop geometry (redesign 2026-08-24,
// docs/research/blur-pipeline-audit-2026-08-24.md): the person is the
// unit of blur — parsePersons reads the model output, personCropRegion
// gives each person the padded region their face/gender pass crops.
// The old gate/backside special-cases died with the person-primary
// pipeline: non-persons never enter it, and a person with no readable
// face is simply unknown ⇒ covered.
//
// Pure module: no DOM, no tf. Boxes are {x1,y1,x2,y2} normalized 0..1.

export var PERSON_MIN_SCORE = 0.25; // MoveNet box score floor (spike: real people 0.28-0.62)
export var PERSON_GATE_PAD = 0.15; // person box padded by this fraction of its size for the crop

/**
 * Raw MoveNet MultiPose output -> person boxes. data: the flat [1,6,56]
 * tensor download (6 slots x [17 keypoints x (y,x,score) = 51, then
 * ymin,xmin,ymax,xmax, box score]).
 */
// Keypoints at/above this score extend the person box (owner phone test
// 2026-08-24: the raw MoveNet box hugs the torso and left HANDS showing
// — wrists/elbows are keypoints 7-10, already in the output).
export var PERSON_KEYPOINT_MIN = 0.3;
// Margin added around each contributing keypoint (hands are ~this much
// bigger than the wrist point).
var KEYPOINT_MARGIN = 0.03;

export function parsePersons(data, minScore) {
  var floor = typeof minScore === 'number' ? minScore : PERSON_MIN_SCORE;
  var out = [];
  for (var p = 0; p < 6; p++) {
    var o = p * 56;
    var score = data[o + 55];
    if (!(score >= floor)) continue;
    var y1 = data[o + 51];
    var x1 = data[o + 52];
    var y2 = data[o + 53];
    var x2 = data[o + 54];
    // Union the box with every confident keypoint (17 x [y,x,score]
    // ahead of the box slots): wrists and ankles routinely fall outside
    // MoveNet's tight box, and the box IS the blur patch now.
    for (var k = 0; k < 17; k++) {
      var ks = data[o + k * 3 + 2];
      if (!(ks >= PERSON_KEYPOINT_MIN)) continue;
      var ky = data[o + k * 3];
      var kx = data[o + k * 3 + 1];
      if (ky - KEYPOINT_MARGIN < y1) y1 = ky - KEYPOINT_MARGIN;
      if (ky + KEYPOINT_MARGIN > y2) y2 = ky + KEYPOINT_MARGIN;
      if (kx - KEYPOINT_MARGIN < x1) x1 = kx - KEYPOINT_MARGIN;
      if (kx + KEYPOINT_MARGIN > x2) x2 = kx + KEYPOINT_MARGIN;
    }
    // HEAD ANCHOR (owner 2026-08-24: "take the head as an anchor — the
    // blur sometimes moves away from the head"): the head is the one
    // part that must never escape the patch. Give the head keypoints
    // (0-4: nose, eyes, ears) a guaranteed margin derived from the
    // visible head size, baked into the box itself.
    var hx = 0;
    var hy = 0;
    var hn = 0;
    for (var hk = 0; hk < 5; hk++) {
      if (!(data[o + hk * 3 + 2] >= PERSON_KEYPOINT_MIN)) continue;
      hy += data[o + hk * 3];
      hx += data[o + hk * 3 + 1];
      hn++;
    }
    if (hn > 0) {
      hx /= hn;
      hy /= hn;
      // Head size: ear-to-ear if both ears are visible, else eye gap
      // x2.5, else 60% of the shoulder span, else a floor.
      var headSize = 0;
      if (data[o + 9 + 2] >= PERSON_KEYPOINT_MIN && data[o + 12 + 2] >= PERSON_KEYPOINT_MIN) {
        headSize = Math.abs(data[o + 10] - data[o + 13]);
      } else if (data[o + 3 + 2] >= PERSON_KEYPOINT_MIN && data[o + 6 + 2] >= PERSON_KEYPOINT_MIN) {
        headSize = Math.abs(data[o + 4] - data[o + 7]) * 2.5;
      } else if (data[o + 15 + 2] >= PERSON_KEYPOINT_MIN && data[o + 18 + 2] >= PERSON_KEYPOINT_MIN) {
        headSize = Math.abs(data[o + 16] - data[o + 19]) * 0.6;
      }
      headSize = Math.max(headSize, 0.04);
      if (hy - headSize * 1.5 < y1) y1 = hy - headSize * 1.5;
      if (hx - headSize * 1.3 < x1) x1 = hx - headSize * 1.3;
      if (hx + headSize * 1.3 > x2) x2 = hx + headSize * 1.3;
      if (hy + headSize > y2) y2 = hy + headSize;
    }
    out.push({
      y1: Math.max(0, y1),
      x1: Math.max(0, x1),
      y2: Math.min(1, y2),
      x2: Math.min(1, x2),
      confidence: score,
    });
  }
  return out;
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

