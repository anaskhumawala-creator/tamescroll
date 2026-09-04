// Pure decode: raw model outputs -> face boxes / gender-age-descriptor
// reads. No tf, no DOM, no worker/page assumptions -- just arrays in,
// arrays out, so it runs identically on the WebGL path (detector.js,
// which does its concat/anchor-add on the GPU and hands the downloaded
// numbers here) and the native TFLite path (native-client.mjs, which
// never touches a tensor and has to do the anchor decode in plain JS
// because the four raw output tensors arrive as flat Float32Arrays over
// a message port).
//
// "An instrument that re-derives a shipped rule is a check that cannot
// fail, and I built three of them in one session" (project CLAUDE.md,
// phase G). This file is the fix applied on purpose, before a second
// copy could happen: move the rule into a module, call it from both
// sides, delete the copy. detector.js no longer owns any of this math;
// it imports it.
//
// Clean-room note (docs/gaze-research.md §5): HaramBlur is AGPL-3.0 and
// cited as a behaviour reference ONLY -- nothing here comes from it. The
// anchor generation + box decode are adapted from vladmandic/human (MIT
// -- see NOTICE), which implements the standard MediaPipe BlazeFace SSD
// decode for the exact 4-output model we embed (tfjs graph) and convert
// (TFLite, spikes/native/REPORT.md).
import { squareBox } from './crop-geometry.mjs';
import { nonMaxSuppression } from './nms.mjs';

// Face-box knobs — registered in docs/detection-engine.md.
// 0.2 -> 0.35 2026-08-24 (owner: "sometimes false blurs"): sub-0.35
// detections on the observed set were mostly non-faces (patterns,
// hands), each one a phantom patch. Still below the 0.5 common default
// so obscured real faces keep flagging — fail-safe leans kept.
export var FACE_MIN_CONFIDENCE = 0.35;
var FACE_IOU = 0.1;
var FACE_MAX = 20;
// MEASURED AND PINNED (gauntlet R26). Do not move this to buy gender
// certainty on a small face — it is the child gate's operating point.
// See detector.js's git history / docs/detection-engine.md for the full
// R26 measurement (the scale sweep across a classroom frame that pinned
// this at 1.0 rather than anywhere tighter or looser).
var FACE_ENLARGE = 1.4; // gender wants context around the face crop
// Both BlazeFace paths (tfjs graph, TFLite) take a 256x256 input.
var FACE_INPUT_SIZE = 256;

// SSD anchor centers for the 256 "back" BlazeFace model: stride-16 grid
// (16x16 cells x 2 anchors = 512) + stride-32 grid (8x8 x 6 = 384), 896
// total — matching the model's two classificator outputs. Adapted from
// vladmandic/human generateAnchors (MIT). Returns [[x,y], ...] in the
// row order the model's own 512-then-384 concat produces, which is also
// the order `faceRowsFromOutputs` writes rows in below.
export function generateAnchors(inputSize) {
  var spec = { strides: [inputSize / 16, inputSize / 8], anchors: [2, 6] };
  var anchors = [];
  for (var i = 0; i < spec.strides.length; i++) {
    var stride = spec.strides[i];
    var grid = Math.floor((inputSize + stride - 1) / stride);
    for (var gy = 0; gy < grid; gy++) {
      for (var gx = 0; gx < grid; gx++) {
        for (var n = 0; n < spec.anchors[i]; n++) {
          anchors.push([stride * (gx + 0.5), stride * (gy + 0.5)]);
        }
      }
    }
  }
  return anchors;
}

// Flat [x0,y0,x1,y1,...] cache for the plain-JS decode path -- built
// once, generateAnchors is not free and every native videoFrame would
// otherwise pay it again.
var anchorsFlat = null;
function flatAnchors() {
  if (anchorsFlat) return anchorsFlat;
  var nested = generateAnchors(FACE_INPUT_SIZE);
  var flat = new Float32Array(nested.length * 2);
  for (var i = 0; i < nested.length; i++) {
    flat[i * 2] = nested[i][0];
    flat[i * 2 + 1] = nested[i][1];
  }
  anchorsFlat = flat;
  return flat;
}

// One scale's worth of raw BlazeFace outputs (scores + 16-wide box+mark
// regressors) decoded into `rows` at [17 * (rowStart + i)]: [score,
// x1,y1,x2,y2, mark0..mark11] in MODEL-SPACE PIXELS (0..inputSize) --
// the exact layout detector.js's tensor path downloads today, so
// `facesFromRows` below reads either source identically.
function decodeScale(rows, rowStart, n, scoresArr, boxesArr, anchors, anchorStart) {
  for (var i = 0; i < n; i++) {
    var ai = (anchorStart + i) * 2;
    var ax = anchors[ai];
    var ay = anchors[ai + 1];
    var bi = i * 16;
    var dx = boxesArr[bi];
    var dy = boxesArr[bi + 1];
    var w = boxesArr[bi + 2];
    var h = boxesArr[bi + 3];
    var cx = ax + dx;
    var cy = ay + dy;
    var hw = w / 2;
    var hh = h / 2;
    // sigmoid -- the tensor path applies tf.sigmoid on the GPU; this is
    // the same function on the CPU.
    var score = 1 / (1 + Math.exp(-scoresArr[i]));
    var base = (rowStart + i) * 17;
    rows[base] = score;
    rows[base + 1] = cx - hw;
    rows[base + 2] = cy - hh;
    rows[base + 3] = cx + hw;
    rows[base + 4] = cy + hh;
    // The 6 landmark pairs, regressed relative to the anchor centre
    // exactly like dx/dy -- tf.tile(anchors, [1,6]) added back on the
    // GPU; here it's anchors[ai + (k%2)] (even k -> x, odd k -> y).
    for (var k = 0; k < 12; k++) {
      rows[base + 5 + k] = boxesArr[bi + 4 + k] + (k % 2 === 0 ? ax : ay);
    }
  }
}

// TFLite's four raw BlazeFace output tensors -> the same [896,17] rows
// the tensor path produces on the GPU. `outputs` is an array of 4
// Float32Arrays in WHATEVER order the port handed them back (TFLite
// output order is signature-key order, not tfjs order) -- sorted by
// LENGTH here, the same technique detector.js's tensor path already
// used (sort by tensor `.size`) because it needs no name at all: the
// four tensors have four distinct sizes (384, 512, 384*16, 512*16).
export function faceRowsFromOutputs(outputs) {
  var sorted = outputs.slice().sort(function (a, b) {
    return a.length - b.length;
  });
  var scores384 = sorted[0];
  var scores512 = sorted[1];
  var boxes384 = sorted[2];
  var boxes512 = sorted[3];
  var anchors = flatAnchors();
  var rows = new Float32Array(896 * 17);
  // Row order matches generateAnchors: 512 (stride-16) rows first, then
  // 384 (stride-32) -- the same order the tensor path's
  // concat([c512, c384], 1) produces.
  decodeScale(rows, 0, 512, scores512, boxes512, anchors, 0);
  decodeScale(rows, 512, 384, scores384, boxes384, anchors, 512);
  return rows;
}

/** The 6 landmark pairs of one row, normalized to 0..1 of the source. */
function readMarks(data, off) {
  var out = new Array(12);
  for (var k = 0; k < 12; k++) out[k] = data[off + k] / FACE_INPUT_SIZE;
  return out;
}

// NMS, enlarge, squarify, marks -- the CPU half of BlazeFace decode,
// unchanged by which side produced `rows` (GPU-concat-then-download, or
// faceRowsFromOutputs above). `rows` is a flat Float32Array, stride 17,
// 896 rows: [score, x1,y1,x2,y2, mark0..mark11] in model-space pixels.
export function facesFromRows(rows) {
  var STRIDE = 17;
  var numRows = rows.length / STRIDE;
  var scoresArr = new Float32Array(numRows);
  var boxesArr = new Float32Array(numRows * 4);
  for (var r = 0; r < numRows; r++) {
    scoresArr[r] = rows[r * STRIDE];
    boxesArr[r * 4] = rows[r * STRIDE + 1];
    boxesArr[r * 4 + 1] = rows[r * STRIDE + 2];
    boxesArr[r * 4 + 2] = rows[r * STRIDE + 3];
    boxesArr[r * 4 + 3] = rows[r * STRIDE + 4];
  }
  var idx = nonMaxSuppression(boxesArr, scoresArr, FACE_MAX, FACE_IOU, FACE_MIN_CONFIDENCE);
  var kept = [];
  for (var i = 0; i < idx.length; i++) {
    var j = idx[i] * 4;
    // Enlarge + squarify in model space, then normalize to 0..1 of
    // the (resize-stretched) source — fractions map back correctly.
    var cx = (boxesArr[j] + boxesArr[j + 2]) / 2;
    var cy = (boxesArr[j + 1] + boxesArr[j + 3]) / 2;
    var half = (Math.max(boxesArr[j + 2] - boxesArr[j], boxesArr[j + 3] - boxesArr[j + 1]) / 2) * FACE_ENLARGE;
    kept.push({
      x1: Math.max(0, (cx - half) / FACE_INPUT_SIZE),
      y1: Math.max(0, (cy - half) / FACE_INPUT_SIZE),
      x2: Math.min(1, (cx + half) / FACE_INPUT_SIZE),
      y2: Math.min(1, (cy + half) / FACE_INPUT_SIZE),
      confidence: scoresArr[idx[i]],
      // Normalized to 0..1 of the source the SAME WAY the box is, so a
      // landmark and a box edge are comparable numbers. The row is the
      // pre-NMS row, not the enlarged/squarified box -- FACE_ENLARGE is
      // a crop convenience and must not move a measured point.
      marks: readMarks(rows, idx[i] * STRIDE + 5),
    });
  }
  return kept;
}

// faceres' three heads (gender sigmoid [N,1], age softmax [N,100],
// identity descriptor [N,1024]) -> one read per box. `hadGenderHead`
// false means the model came back without a usable gender tensor (a
// zeros fallback would read v=0 -> "female 0.99" -- report zero
// confidence instead, never a fabricated verdict). Moved verbatim from
// detector.js's classifyFaceGenders verdict loop.
export function genderReadsFromOutputs(genderData, ageData, descData, boxes, hadGenderHead) {
  var verdicts = [];
  for (var k = 0; k < boxes.length; k++) {
    var v = genderData[k];
    var confidence = hadGenderHead ? Math.min(0.99, 2 * Math.abs(v - 0.5)) : 0;
    // AGE IS AN EXPECTED VALUE over a 100-bin softmax -- see
    // detector.js's git history for why the mass under 18 (childP) is
    // carried alongside the mean rather than in place of it (gauntlet
    // R18/R22: a mean over a bimodal posterior lands where no mass is).
    var age = 0;
    var childP = 0;
    var ageMaxBin = 0;
    var ageMaxMass = 0;
    var ageEnt = 0;
    for (var a = 0; a < 100; a++) {
      var pa = ageData[k * 100 + a];
      age += a * pa;
      if (a < 18) childP += pa;
      if (pa > ageMaxMass) {
        ageMaxMass = pa;
        ageMaxBin = a;
      }
      if (pa > 1e-9) ageEnt -= pa * Math.log(pa);
    }
    // L2-normalized descriptor slice so identity matching is a plain
    // dot product downstream.
    var desc = descData.slice(k * 1024, (k + 1) * 1024);
    var norm = 0;
    for (var n = 0; n < desc.length; n++) norm += desc[n] * desc[n];
    norm = Math.sqrt(norm) || 1;
    for (var m = 0; m < desc.length; m++) desc[m] /= norm;
    // KEEP THE RAW SIGMOID -- `confidence` folds it around 0.5, which
    // destroys the sign the null test needs (see gauntlet R11/R22 in
    // detector.js's history). `norm` is the descriptor's magnitude
    // before normalising, a null test orthogonal to the 1-D one on the
    // gender sigmoid.
    var shape = { norm: norm, ageBin: ageMaxBin, ageMass: ageMaxMass, ageEnt: ageEnt };
    verdicts.push(
      v <= 0.5
        ? { gender: 'female', score: confidence, age: age, childP: childP, desc: desc, raw: v, shape: shape }
        : { gender: 'male', score: confidence, age: age, childP: childP, desc: desc, raw: v, shape: shape }
    );
  }
  return verdicts;
}

// Re-exported so a caller cropping a face for faceres (image path or
// native path alike) uses the one aspect-preserving implementation --
// see crop-geometry.mjs for why this exists and what it cost to find.
export { squareBox };

/**
 * ONE image verdict, trimmed for a boundary crossing.
 *
 * The worker's image reply used to build this object inline, and what it
 * left out made `flaggedFaceIndices`' null guard DEAD on that path while
 * it stayed live on the in-page one (init-entry.js:1029 vs :1234). Both
 * of the guard's predicates fail OPEN on a missing field by design --
 * `isNullRead` trusts a read carrying no `raw`, `mayNotMint` refuses
 * nothing without `shape.norm` -- so the rule did not throw and did not
 * log. It simply never fired, and finding 52 priced the result: 48 image
 * marks on person-free thumbnails, nm p50 3.44 against a floor of 5.
 *
 * `raw` and `shape.norm` are two numbers. THE DESCRIPTOR STAYS DROPPED:
 * it is 1024 floats per face and only the video path's identity memory
 * reads it, so sending it would cost more than the inference saved. The
 * rest of `shape` (the age-head diagnostics) has no image-side reader.
 *
 * Called from BOTH sides so the two image paths cannot answer differently
 * again -- the crop-geometry defect is what this shape exists to prevent.
 */
export function imageRead(r) {
  return {
    gender: r.gender,
    score: r.score,
    age: r.age,
    childP: r.childP,
    px: r.px,
    raw: r.raw,
    shape: r.shape ? { norm: r.shape.norm } : null,
  };
}
