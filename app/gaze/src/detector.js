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
// then SSR-Net gender (64x64 crop) per surviving box.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';
import * as tfconv from '@tensorflow/tfjs-converter';
import { MODEL_JSON, MODEL_WEIGHTS_B64 } from './model-embed.js';
import { NSFW_MODEL_JSON, NSFW_WEIGHTS_B64 } from './nsfw-model-embed.js';
import { GENDER_MODEL_JSON, GENDER_WEIGHTS_B64 } from './gender-model-embed.js';

export var INPUT_SIZE = 256; // matches the embedded face model's fixed input shape
export var NSFW_INPUT_SIZE = 224; // MobileNetV2Mid fixed input shape
export var GENDER_INPUT_SIZE = 64; // SSR-Net fixed input shape

// Face-box knobs — registered in docs/detection-engine.md.
export var FACE_MIN_CONFIDENCE = 0.2;
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
        userDefinedMetadata: modelJson.userDefinedMetadata,
      });
    },
  };
}

var ioHandler = embeddedIoHandler(MODEL_JSON, MODEL_WEIGHTS_B64);

/** Picks WebGL, falls back to CPU. Throws if both fail. */
async function initBackend() {
  try {
    // setBackend reports failure BOTH ways: rejecting, or resolving
    // false — a webgl init that fails politely must still fall back.
    var ok = await tf.setBackend('webgl');
    if (!ok) throw new Error('webgl backend unavailable');
    await tf.ready();
  } catch (e) {
    await tf.setBackend('cpu');
    await tf.ready();
  }
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
 * Assumes initBackend() already ran (loadModel() first).
 */
export async function loadNsfwModel() {
  return tfconv.loadGraphModel(embeddedIoHandler(NSFW_MODEL_JSON, NSFW_WEIGHTS_B64));
}

/**
 * Loads the gender classifier (SSR-Net via vladmandic/human-models, MIT
 * — see NOTICE). Separate load like the NSFW model: a failure degrades
 * to presence-only flagging (any face stays covered), never a break.
 */
export async function loadGenderModel() {
  return tfconv.loadGraphModel(embeddedIoHandler(GENDER_MODEL_JSON, GENDER_WEIGHTS_B64));
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
export async function detectFaceBoxes(model, pixelSource) {
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
    var boxes = tf.concat([starts, ends], 1);
    var scores = tf.squeeze(tf.sigmoid(tf.slice(batch, [0, 0], [-1, 1])));
    return [boxes, scores];
  });
  var boxesT = out[0];
  var scoresT = out[1];
  var kept = [];
  try {
    var nmsT = await tf.image.nonMaxSuppressionAsync(
      boxesT,
      scoresT,
      FACE_MAX,
      FACE_IOU,
      FACE_MIN_CONFIDENCE
    );
    var idx;
    try {
      idx = await nmsT.array();
    } finally {
      tf.dispose(nmsT);
    }
    if (idx.length) {
      var boxes = await boxesT.array();
      var scores = await scoresT.data();
      for (var i = 0; i < idx.length; i++) {
        var b = boxes[idx[i]];
        // Enlarge + squarify in model space, then normalize to 0..1 of
        // the (resize-stretched) source — fractions map back correctly.
        var cx = (b[0] + b[2]) / 2;
        var cy = (b[1] + b[3]) / 2;
        var half = (Math.max(b[2] - b[0], b[3] - b[1]) / 2) * FACE_ENLARGE;
        kept.push({
          x1: Math.max(0, (cx - half) / INPUT_SIZE),
          y1: Math.max(0, (cy - half) / INPUT_SIZE),
          x2: Math.min(1, (cx + half) / INPUT_SIZE),
          y2: Math.min(1, (cy + half) / INPUT_SIZE),
          confidence: scores[idx[i]],
        });
      }
    }
  } finally {
    tf.dispose([boxesT, scoresT]);
  }
  return kept;
}

/**
 * Per-face gender against a pixel source + one normalized box from
 * detectFaceBoxes. SSR-Net semantics (via vladmandic/human, MIT): input
 * is a 64x64 crop scaled to [-1,1]; output is [femaleProb, maleProb].
 * Returns { gender: 'female'|'male', score }.
 */
export async function classifyFaceGender(model, pixelSource, box) {
  var scores = tf.tidy(function () {
    var img = tf.browser.fromPixels(pixelSource);
    var input = tf.expandDims(tf.div(tf.cast(img, 'float32'), 255), 0);
    var crop = tf.image.cropAndResize(
      input,
      [[box.y1, box.x1, box.y2, box.x2]],
      [0],
      [GENDER_INPUT_SIZE, GENDER_INPUT_SIZE]
    );
    return model.execute(tf.mul(tf.sub(crop, 0.5), 2));
  });
  var data;
  try {
    data = await scores.data();
  } finally {
    tf.dispose(scores);
  }
  return data[0] > data[1]
    ? { gender: 'female', score: data[0] }
    : { gender: 'male', score: data[1] };
}
