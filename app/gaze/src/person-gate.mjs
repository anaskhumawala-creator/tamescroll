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
export function parsePersons(data, minScore) {
  var floor = typeof minScore === 'number' ? minScore : PERSON_MIN_SCORE;
  var out = [];
  for (var p = 0; p < 6; p++) {
    var o = p * 56;
    var score = data[o + 55];
    if (!(score >= floor)) continue;
    out.push({
      y1: data[o + 51],
      x1: data[o + 52],
      y2: data[o + 53],
      x2: data[o + 54],
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

