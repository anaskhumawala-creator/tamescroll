// Person-gate pure logic (owner ask 2026-08-24: "you should be able to
// detect a humanoid — why are random objects being blurred?" + "the view
// from the backside is not blurring"). MoveNet MultiPose gives up to 6
// person boxes per frame; this module turns them into two decisions:
//
//  1. GATE: a low-confidence, gender-uncertain face candidate that sits
//     inside no person region is a graphic (logo letters, crate labels,
//     shirt prints) — drop it. Confident faces and confident gender
//     verdicts always bypass: the gate may only prune the ambiguous
//     band, so a person the pose model misses can never lose their blur
//     (fail-safe).
//  2. BACKSIDE: a person region containing no face candidate at all is
//     someone facing away — cover their box (unknown gender ⇒ covered,
//     same doctrine as everywhere), unless an existing face track
//     already owns that region (a cleared person whose face flickered
//     out must not get re-covered by their own body).
//
// Pure module: no DOM, no tf. Boxes are {x1,y1,x2,y2} normalized 0..1.

export var PERSON_MIN_SCORE = 0.25; // MoveNet box score floor (spike: real people 0.28-0.62)
export var PERSON_GATE_PAD = 0.15; // person box padded by this fraction of its size for containment
// Faces at/above this detector confidence bypass the gate even when
// gender-uncertain — the gate exists for the ambiguous band only.
export var PERSON_GATE_BYPASS_CONFIDENCE = 0.6;

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
 * Zoom-classify support (owner "double pass" ask 2026-08-24): the crop
 * region a person's face/gender pass runs on, and the mapping back.
 * Multi-SCALE is the pass that actually adds information — re-running
 * the same model on the same full frame is deterministic and adds none.
 */
export function personCropRegion(p) {
  return padded(p, PERSON_GATE_PAD);
}

/** Box in crop-space (0..1 of the region) -> full-frame normalized. */
export function mapCropBoxToFrame(region, box) {
  var w = region.x2 - region.x1;
  var h = region.y2 - region.y1;
  return {
    x1: region.x1 + box.x1 * w,
    y1: region.y1 + box.y1 * h,
    x2: region.x1 + box.x2 * w,
    y2: region.y1 + box.y2 * h,
    confidence: box.confidence,
  };
}

/** True when box centre falls inside any of the regions. */
export function centerInAny(box, regions) {
  var cx = (box.x1 + box.x2) / 2;
  var cy = (box.y1 + box.y2) / 2;
  for (var i = 0; i < regions.length; i++) {
    var r = regions[i];
    if (cx >= r.x1 && cx <= r.x2 && cy >= r.y1 && cy <= r.y2) return true;
  }
  return false;
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

function centerIn(box, region) {
  var cx = (box.x1 + box.x2) / 2;
  var cy = (box.y1 + box.y2) / 2;
  return cx >= region.x1 && cx <= region.x2 && cy >= region.y1 && cy <= region.y2;
}

/**
 * GATE (decision 1). detections: tracker-shaped [{box, flagged,
 * certain}]. persons: parsePersons output — null/undefined means "no
 * person data yet" (model loading or failed) and NOTHING is dropped.
 * An empty persons array is real evidence (the model ran and saw no
 * one) and prunes the ambiguous band.
 */
export function gateDetections(detections, persons) {
  if (!persons) return detections;
  var regions = [];
  for (var p = 0; p < persons.length; p++) regions.push(padded(persons[p], PERSON_GATE_PAD));
  var out = [];
  for (var i = 0; i < detections.length; i++) {
    var d = detections[i];
    var ambiguous =
      d.flagged &&
      d.certain !== true &&
      (typeof d.box.confidence !== 'number' || d.box.confidence < PERSON_GATE_BYPASS_CONFIDENCE);
    if (!ambiguous) {
      out.push(d);
      continue;
    }
    var inside = false;
    for (var r = 0; r < regions.length; r++) {
      if (centerIn(d.box, regions[r])) {
        inside = true;
        break;
      }
    }
    if (inside) out.push(d);
  }
  return out;
}

/**
 * BACKSIDE (decision 2): person boxes owned by no face candidate and no
 * existing face track. Returned boxes become uncertain flagged
 * detections for the caller's person tracker (whole-box patches — the
 * pose model's box IS the body, no anthropometric expansion needed).
 */
export function facelessPersons(persons, faceBoxes, trackBoxes) {
  if (!persons) return [];
  var out = [];
  for (var p = 0; p < persons.length; p++) {
    var region = padded(persons[p], PERSON_GATE_PAD);
    var owned = false;
    var i;
    for (i = 0; i < (faceBoxes ? faceBoxes.length : 0); i++) {
      if (centerIn(faceBoxes[i], region)) {
        owned = true;
        break;
      }
    }
    for (i = 0; !owned && i < (trackBoxes ? trackBoxes.length : 0); i++) {
      if (centerIn(trackBoxes[i], region)) owned = true;
    }
    if (!owned) out.push(persons[p]);
  }
  return out;
}
