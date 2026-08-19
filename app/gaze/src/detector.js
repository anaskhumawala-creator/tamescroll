// Face-presence detector wrapping the embedded BlazeFace graph model.
//
// Clean-room: this reproduces *behaviour* described in
// docs/gaze-research.md §5 (HaramBlur cited read-only as an architecture
// reference; AGPL-3.0, never copied — see NOTICE). Nothing here is
// transcribed from HaramBlur source.
//
// Presence-only (no bounding-box decode, no NMS) — v1 needs to know "is
// there a face", not where. The embedded model's signature (checked
// against models/blazeface.json) exposes four outputs: Identity:0
// (1x512x1) and Identity_1:0 (1x384x1) are the classificator logits
// (896 anchors total across two feature-map scales); Identity_2:0 /
// Identity_3:0 are box regressors we don't need for presence. A raw
// logit > 0 is equivalent to sigmoid(logit) > 0.5, so no sigmoid pass is
// needed just to threshold; any anchor above that on either classificator
// output counts as a face. NSFW/body classification (nsfwjs) is a later
// payload-budget decision — TODO: slot a second model + queue stage in
// here if that ships.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';
import * as tfconv from '@tensorflow/tfjs-converter';
import { MODEL_JSON, MODEL_WEIGHTS_B64 } from './model-embed.js';
import { NSFW_MODEL_JSON, NSFW_WEIGHTS_B64 } from './nsfw-model-embed.js';

export var INPUT_SIZE = 256; // matches the embedded model's fixed input shape
export var NSFW_INPUT_SIZE = 224; // MobileNetV2Mid fixed input shape

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

/**
 * Runs presence-only face detection against a pixel source (Image,
 * Canvas, OffscreenCanvas, ImageData, ImageBitmap, HTMLVideoElement).
 * Model-internal errors don't happen here (tensors are ours); callers
 * still need their own try/catch for tainted-canvas / decode failures
 * coming from the pixel source itself.
 */
export async function detectFaces(model, pixelSource) {
  var outputs = tf.tidy(function () {
    var img = tf.browser.fromPixels(pixelSource);
    img = tf.image.resizeBilinear(img, [INPUT_SIZE, INPUT_SIZE]);
    img = tf.cast(img, 'float32');
    img = tf.div(img, 127.5);
    img = tf.sub(img, 1);
    img = tf.expandDims(img, 0);
    return model.execute(img, ['Identity:0', 'Identity_1:0']);
  });
  var scoresA = outputs[0];
  var scoresB = outputs[1];
  var pair;
  try {
    pair = await Promise.all([scoresA.data(), scoresB.data()]);
  } finally {
    // dispose even when .data() rejects, or every failed inference
    // leaks a WebGL tensor pair (review 2026-08-19)
    tf.dispose(outputs);
  }
  var dataA = pair[0];
  var dataB = pair[1];
  for (var i = 0; i < dataA.length; i++) if (dataA[i] > 0) return true;
  for (var j = 0; j < dataB.length; j++) if (dataB[j] > 0) return true;
  return false;
}
