// Face detector + gender classifier wrapping the embedded models.
//
// Clean-room note (docs/gaze-research.md §5): HaramBlur is AGPL-3.0 and
// cited as a behaviour reference ONLY — nothing here comes from it. The
// box decode + anchor generation below are adapted from vladmandic/human
// (MIT — see NOTICE), which implements the standard MediaPipe BlazeFace
// SSD decode for the exact 4-output converted model we embed.
//
// v1 was presence-only ("is there a face"). The protection engine's
// gender stage (docs/handoff-protection-engine.md decision #3) needs
// per-face boxes + per-face gender, so the decode now runs in full:
// classificator logits + box regressors -> anchors -> NMS -> boxes,
// then gender (Oarriaga mini-Xception, 64x64 grayscale) per surviving
// box. NMS + decode run in plain JS off a SINGLE tensor download: every
// extra GPU->CPU download is a fence wait, and hidden pages clamp those
// to ~1s each (Chrome nested-timer throttling, found 2026-08-23).
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';
import * as tfconv from '@tensorflow/tfjs-converter';
import { MODEL_JSON, MODEL_WEIGHTS_B64 } from './model-embed.js';
import { NSFW_MODEL_JSON, NSFW_WEIGHTS_B64 } from './nsfw-model-embed.js';
import { GENDER_MODEL_JSON, GENDER_WEIGHTS_B64 } from './gender-model-embed.js';
import { PERSON_MODEL_JSON, PERSON_WEIGHTS_B64 } from './person-model-embed.js';
import { parsePersons } from './person-gate.mjs';
import { nonMaxSuppression } from './nms.mjs';

export var INPUT_SIZE = 256; // matches the embedded face model's fixed input shape
export var NSFW_INPUT_SIZE = 224; // MobileNetV2Mid fixed input shape
export var GENDER_INPUT_SIZE = 224; // faceres (HSE-FaceRes) fixed input shape

// Face-box knobs — registered in docs/detection-engine.md.
// 0.2 -> 0.35 2026-08-24 (owner: "sometimes false blurs"): sub-0.35
// detections on the observed set were mostly non-faces (patterns,
// hands), each one a phantom patch. Still below the 0.5 common default
// so obscured real faces keep flagging — fail-safe leans kept.
export var FACE_MIN_CONFIDENCE = 0.35;
// Small-subject rescue (owner 2026-08-24: "failing when the subject is
// a bit smaller"): genuinely small faces score low on BlazeFace, so the
// 0.35 floor traded away exactly them. Boxes whose side is below
// FACE_SMALL_SIDE (fraction of the model frame) keep the old 0.2 floor.
// VIDEO-ONLY (smallRescue arg): owner screenshots the same day showed
// the low floor re-admits small phantoms too (shirt graphic, plank), so
// the rescue is only offered where the tracker can demand persistence
// (track.mjs TRACK_MIN_HITS) before a patch renders. Single-frame images
// have no temporal evidence and stay at the flat 0.35 floor.
export var FACE_SMALL_SIDE = 0.14;
export var FACE_SMALL_MIN_CONFIDENCE = 0.2;
var FACE_IOU = 0.1;
var FACE_MAX = 20;
var FACE_ENLARGE = 1.4; // gender wants context around the face crop

function b64ToBuffer(b64) {
  var binStr = atob(b64);
  var len = binStr.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes.buffer;
}

// tf.io.IOHandler.load() must return ModelArtifacts — NOT the raw
// model.json shape: weightSpecs (flattened, no `paths`) rather than
// weightsManifest, plus format/signature so GraphModel can resolve
// default outputs.
function embeddedIoHandler(modelJson, weightsB64) {
  return {
    load: function () {
      var weightSpecs = [];
      for (var g = 0; g < modelJson.weightsManifest.length; g++) {
        var group = modelJson.weightsManifest[g];
        for (var w = 0; w < group.weights.length; w++) weightSpecs.push(group.weights[w]);
      }
      return Promise.resolve({
        modelTopology: modelJson.modelTopology,
        weightSpecs: weightSpecs,
        weightData: b64ToBuffer(weightsB64),
        format: modelJson.format,
        generatedBy: modelJson.generatedBy,
        convertedBy: modelJson.convertedBy,
        signature: modelJson.signature,
        userDefinedMetadata: modelJson.userDefinedMetadata,
      });
    },
  };
}

var ioHandler = embeddedIoHandler(MODEL_JSON, MODEL_WEIGHTS_B64);

/** Picks WebGL, falls back to CPU. Throws if both fail. Idempotent:
 * every model loader awaits this, because NSFW-only modes (compulsory
 * tier in off/blur-all) load the classifier WITHOUT loadModel() —
 * leaving backend choice to tfjs auto-init there meant an unchosen,
 * possibly-CPU backend. One shared promise, first caller wins. */
var backendReady = null;
function initBackend() {
  if (!backendReady) {
    backendReady = (async function () {
      try {
        // Reuse one shader across differing tensor SHAPES (shape passed as
        // a uniform) instead of recompiling per shape. The batched gender
        // pass runs with a varying face-count first dim, so without this
        // every new face-count on the feed recompiled ~67 shaders on the
        // main thread. Measured on a real Android WebView (2026-08-23):
        // total gender-path compiles 223 -> 98, per-new-batch-size
        // recompiles at batch 5 68 -> 12, gender output bit-identical
        // (male:0.92274 both). Must be set before the backend compiles
        // anything, i.e. before tf.ready().
        tf.env().set('WEBGL_USE_SHAPES_UNIFORMS', true);
        // setBackend reports failure BOTH ways: rejecting, or resolving
        // false — a webgl init that fails politely must still fall back.
        var ok = await tf.setBackend('webgl');
        if (!ok) throw new Error('webgl backend unavailable');
        await tf.ready();
      } catch (e) {
        await tf.setBackend('cpu');
        await tf.ready();
      }
    })();
  }
  return backendReady;
}

/** Bench-only: raw tfjs handle so the harness can time individual
 * stages (fromPixels vs execute vs readback) without rebuilding. */
export var tfHandle = tf;

/** Bench-only: load a candidate model by URL so the harness can compare
 * models without re-embedding. Never called from the shipped boot path. */
export function loadModelUrl(url) {
  return tfconv.loadGraphModel(url);
}

/** Bench-only (spikes/perf-harness): pin a specific backend so each can
 * be timed in isolation. Never called from the shipped boot path. */
export async function forceBackend(name) {
  var ok = await tf.setBackend(name);
  if (!ok) throw new Error(name + ' backend unavailable');
  await tf.ready();
  backendReady = Promise.resolve();
}

/** Loads backend + model. Throws on total failure — caller fails open. */
export async function loadModel() {
  await initBackend();
  return tfconv.loadGraphModel(ioHandler);
}

/**
 * Loads the NSFW classifier (nsfwjs MobileNetV2Mid, MIT — see NOTICE).
 * Loaded separately from the face model so a failure here degrades to
 * face-only detection instead of taking the whole pipeline down.
 */
export async function loadNsfwModel() {
  await initBackend();
  return tfconv.loadGraphModel(embeddedIoHandler(NSFW_MODEL_JSON, NSFW_WEIGHTS_B64));
}

/**
 * Loads the gender classifier (HSE-FaceRes via vladmandic/human-models
 * faceres.json, MIT — see NOTICE; replaced mini-Xception 2026-08-24
 * after live calibration showed its scores unusable on real thumbnails,
 * see embed-gender.js). Separate load like the NSFW model: a failure
 * degrades to presence-only flagging (any face stays covered), never a
 * break.
 */
export async function loadGenderModel() {
  await initBackend();
  return tfconv.loadGraphModel(embeddedIoHandler(GENDER_MODEL_JSON, GENDER_WEIGHTS_B64));
}

// Person model input dim (MoveNet MultiPose: dynamic, multiple of 32,
// 128-512; 256 = the documented default accuracy/speed point; 30ms warm
// on desktop WebGL at 256, spike 2026-08-24). Registered in
// docs/detection-engine.md.
export var PERSON_INPUT_SIZE = 256;

/**
 * Loads the person/pose model (MoveNet MultiPose Lightning, Apache-2.0
 * — see NOTICE; our hybrid uint8/f16 requant of Google's f16 tfjs
 * release, build/requant-uint8.py). Separate load like NSFW/gender: a
 * failure degrades to no person gating (fail-safe: nothing extra is
 * dropped, backside coverage just doesn't happen).
 */
export async function loadPersonModel() {
  await initBackend();
  return tfconv.loadGraphModel(embeddedIoHandler(PERSON_MODEL_JSON, PERSON_WEIGHTS_B64));
}

/**
 * Person boxes for a frame. pixelSource should already be square (the
 * caller's sample canvas stretches the video the same way the face path
 * does, so face and person coordinates live in the same stretched
 * space). MoveNet wants RAW int32 pixels — no normalization (unlike
 * BlazeFace's [-1,1]); output [1,6,56] parsed by person-gate.mjs.
 */
export async function detectPersons(model, pixelSource) {
  var out = tf.tidy(function () {
    var img = tf.browser.fromPixels(pixelSource);
    var resized = tf.image.resizeBilinear(tf.expandDims(img, 0), [PERSON_INPUT_SIZE, PERSON_INPUT_SIZE]);
    return model.execute(tf.cast(resized, 'int32'));
  });
  var data;
  try {
    data = await out.data();
  } finally {
    tf.dispose(out);
  }
  return parsePersons(data);
}

/**
 * NSFW classification against a pixel source. Returns true when the
 * image should stay covered. The graph ends in a Softmax, so the five
 * outputs (Drawing, Hentai, Neutral, Porn, Sexy — nsfwjs class order)
 * are already probabilities. Thresholds: explicit (Porn+Hentai) > 0.5,
 * or Sexy > 0.8 — conservative start, calibration pass pending.
 * MobileNetV2 wants [0,1] input, unlike BlazeFace's [-1,1].
 */
export async function isNsfw(model, pixelSource) {
  var scores = tf.tidy(function () {
    var img = tf.browser.fromPixels(pixelSource);
    img = tf.image.resizeBilinear(img, [NSFW_INPUT_SIZE, NSFW_INPUT_SIZE]);
    img = tf.cast(img, 'float32');
    img = tf.div(img, 255);
    img = tf.expandDims(img, 0);
    return model.execute(img, 'Identity:0');
  });
  var data;
  try {
    data = await scores.data();
  } finally {
    tf.dispose(scores);
  }
  var hentai = data[1];
  var porn = data[3];
  var sexy = data[4];
  return porn + hentai > 0.5 || sexy > 0.8;
}

// SSD anchor centers for the 256 "back" BlazeFace model: stride-16 grid
// (16x16 cells x 2 anchors = 512) + stride-32 grid (8x8 x 6 = 384), 896
// total — matching the model's two classificator outputs. Adapted from
// vladmandic/human generateAnchors (MIT).
function generateAnchors(inputSize) {
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

var anchorsT = null;

function ensureAnchors() {
  if (!anchorsT) anchorsT = tf.tensor2d(generateAnchors(INPUT_SIZE));
  return anchorsT;
}

/**
 * Full face detection: returns an array of { x1, y1, x2, y2, confidence }
 * with coordinates normalized to 0..1 of the source (enlarged and
 * squarified in model space for downstream gender crops). Empty array =
 * no faces. Decode adapted from vladmandic/human getBoxes (MIT).
 */
export async function detectFaceBoxes(model, pixelSource, smallRescue) {
  var anchors = ensureAnchors();
  var out = tf.tidy(function () {
    var img = tf.browser.fromPixels(pixelSource);
    var input = tf.expandDims(img, 0);
    var resized = tf.image.resizeBilinear(input, [INPUT_SIZE, INPUT_SIZE]);
    var norm = tf.sub(tf.div(tf.cast(resized, 'float32'), 127.5), 1);
    var res = model.execute(norm, ['Identity:0', 'Identity_1:0', 'Identity_2:0', 'Identity_3:0']);
    // Sort by tensor size: [384x1, 512x1, 384x16, 512x16] -> concat each
    // scale's logit + regressor, then both scales -> [896, 17]:
    // [logit, dx, dy, w, h, 12 landmark values we ignore].
    var sorted = res.slice().sort(function (a, b) {
      return a.size - b.size;
    });
    var c384 = tf.concat([sorted[0], sorted[2]], 2);
    var c512 = tf.concat([sorted[1], sorted[3]], 2);
    var batch = tf.squeeze(tf.concat([c512, c384], 1), [0]);
    var centers = tf.add(tf.slice(batch, [0, 1], [-1, 2]), anchors);
    var halfSizes = tf.div(tf.slice(batch, [0, 3], [-1, 2]), 2);
    var starts = tf.sub(centers, halfSizes);
    var ends = tf.add(centers, halfSizes);
    // One [896, 5] tensor: [score, x1, y1, x2, y2] per row, so the whole
    // decode needs exactly ONE GPU->CPU download. NMS runs in JS.
    var scores = tf.sigmoid(tf.slice(batch, [0, 0], [-1, 1]));
    return tf.concat([scores, starts, ends], 1);
  });
  var data;
  try {
    data = await out.data();
  } finally {
    tf.dispose(out);
  }
  var rows = data.length / 5;
  var scoresArr = new Float32Array(rows);
  var boxesArr = new Float32Array(rows * 4);
  for (var r = 0; r < rows; r++) {
    scoresArr[r] = data[r * 5];
    boxesArr[r * 4] = data[r * 5 + 1];
    boxesArr[r * 4 + 1] = data[r * 5 + 2];
    boxesArr[r * 4 + 2] = data[r * 5 + 3];
    boxesArr[r * 4 + 3] = data[r * 5 + 4];
  }
  // With smallRescue, NMS runs at the LOW floor and the size-adaptive cut
  // happens after, when box dimensions are known (see FACE_SMALL_SIDE
  // above); without it (image path) the flat floor applies at NMS.
  var floor = smallRescue ? FACE_SMALL_MIN_CONFIDENCE : FACE_MIN_CONFIDENCE;
  var idx = nonMaxSuppression(boxesArr, scoresArr, FACE_MAX, FACE_IOU, floor);
  var smallSide = FACE_SMALL_SIDE * INPUT_SIZE;
  var kept = [];
  for (var i = 0; i < idx.length; i++) {
    var j = idx[i] * 4;
    var side = Math.max(boxesArr[j + 2] - boxesArr[j], boxesArr[j + 3] - boxesArr[j + 1]);
    if (scoresArr[idx[i]] < FACE_MIN_CONFIDENCE && side >= smallSide) continue;
    // Enlarge + squarify in model space, then normalize to 0..1 of
    // the (resize-stretched) source — fractions map back correctly.
    var cx = (boxesArr[j] + boxesArr[j + 2]) / 2;
    var cy = (boxesArr[j + 1] + boxesArr[j + 3]) / 2;
    var half = (Math.max(boxesArr[j + 2] - boxesArr[j], boxesArr[j + 3] - boxesArr[j + 1]) / 2) * FACE_ENLARGE;
    kept.push({
      x1: Math.max(0, (cx - half) / INPUT_SIZE),
      y1: Math.max(0, (cy - half) / INPUT_SIZE),
      x2: Math.min(1, (cx + half) / INPUT_SIZE),
      y2: Math.min(1, (cy + half) / INPUT_SIZE),
      confidence: scoresArr[idx[i]],
    });
  }
  return kept;
}

/**
 * Per-face gender for ALL boxes from detectFaceBoxes in one batched
 * inference (one fromPixels, one execute, one download — N separate
 * calls were N GPU round trips). Model semantics (human-models
 * faceres.json, HSE-FaceRes, MIT — reader adapted from vladmandic/human
 * faceres.ts, MIT, see NOTICE): input is a 224x224 RGB crop with values
 * 0..255 float; the model is multi-head (age/gender/descriptor) and the
 * gender head is the [N,1] output — a sigmoid where <=0.5 reads female,
 * >0.5 male, and confidence is 2*|v-0.5|.
 * Returns [{ gender: 'female'|'male', score }] parallel to boxes.
 */
export async function classifyFaceGenders(model, pixelSource, boxes) {
  if (!boxes.length) return [];
  var outs = tf.tidy(function () {
    var img = tf.browser.fromPixels(pixelSource);
    var input = tf.expandDims(tf.cast(img, 'float32'), 0);
    var rects = [];
    var inds = [];
    for (var i = 0; i < boxes.length; i++) {
      rects.push([boxes[i].y1, boxes[i].x1, boxes[i].y2, boxes[i].x2]);
      inds.push(0);
    }
    // cropAndResize interpolates from the 0..255 float source — faceres
    // wants exactly that range, so no further normalisation.
    var crops = tf.image.cropAndResize(input, rects, inds, [GENDER_INPUT_SIZE, GENDER_INPUT_SIZE]);
    var res = model.execute(crops);
    var list = Array.isArray(res) ? res : [res];
    var genderT = null;
    for (var t = 0; t < list.length; t++) {
      if (list[t].shape.length === 2 && list[t].shape[1] === 1) {
        genderT = list[t];
      }
    }
    // Keep only the gender head; tidy disposes the rest.
    return genderT ? tf.clone(genderT) : tf.zeros([boxes.length, 1]);
  });
  var data;
  try {
    data = await outs.data();
  } finally {
    tf.dispose(outs);
  }
  var verdicts = [];
  for (var k = 0; k < boxes.length; k++) {
    var v = data[k];
    var confidence = Math.min(0.99, 2 * Math.abs(v - 0.5));
    verdicts.push(
      v <= 0.5 ? { gender: 'female', score: confidence } : { gender: 'male', score: confidence }
    );
  }
  return verdicts;
}
