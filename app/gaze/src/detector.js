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
import { squareBox } from './crop-geometry.mjs';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';
import * as tfconv from '@tensorflow/tfjs-converter';
// The blobs arrive through one indirection so the PAGE build can ship
// without them -- see model-blobs.mjs. Every loader below awaits ready()
// before asking for bytes; in the full artifact that resolves
// immediately, and in the page artifact it fetches them once, only if
// the worker is unavailable and the in-page pipeline is actually needed.
import { ready as modelsReady, blob as modelBlob } from './model-blobs.mjs';
import {
  parsePersons,
  frameHasNoHumanShape,
  rejectedSlotBoxes,
  lastSlotDiag,
} from './person-gate.mjs';
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
// (The 2026-08-24 small-subject rescue floor is gone: the person-primary
// video pipeline runs faces on native-res person crops, where small
// faces are big — redesign, blur-pipeline-audit.)
var FACE_IOU = 0.1;
var FACE_MAX = 20;
// MEASURED AND PINNED (gauntlet R26). Do not move this to buy gender
// certainty on a small face — it is the child gate's operating point.
//
// R26 scored FALSE COVER on all ten frames of a classroom in `woman`
// mode: the one adult woman, face 74 native px, reads female with
// certainty 0.14-0.63 (one read of twelve over GENDER_CLEAR_SCORE_FEMALE
// 0.45), so she has no path to a clear. The obvious free fix is the
// crop, since the enlargement is a constant and costs nothing.
// `spikes/gauntlet/facecrop.py` swept it over ALL EIGHT faces in that
// frame (found the way the pipeline finds them — person slot, native
// per-person crop, BlazeFace inside it — because the full-frame pass
// finds one of ten), at 0.55/0.7/0.85/1.0/1.2/1.5/1.9 of the shipped box:
//
//   the adult woman   gender FLIPS with the crop: male .38 / male .63 /
//                     male .15 / female .30 / female .38 / female .24 /
//                     male .13. There is no scale that clears her, and
//                     the tight end reads her confidently WRONG.
//   two known children childP peaks at the SHIPPED scale — .751 and .746
//                     at 1.0, falling to .199/.340 at 1.9 and .283/.285
//                     at 0.55, against GENDER_CHILD_MASS 0.25.
//
// So 1.0 is where the child gate works and every other scale leaks it,
// which is the trade S6 and R23 refused twice from the other direction.
// A child rendered sharp is the worst outcome this project has.
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
function artifacts(modelJson, weightData) {
  var weightSpecs = [];
  for (var g = 0; g < modelJson.weightsManifest.length; g++) {
    var group = modelJson.weightsManifest[g];
    for (var w = 0; w < group.weights.length; w++) weightSpecs.push(group.weights[w]);
  }
  return {
    modelTopology: modelJson.modelTopology,
    weightSpecs: weightSpecs,
    weightData: weightData,
    format: modelJson.format,
    generatedBy: modelJson.generatedBy,
    convertedBy: modelJson.convertedBy,
    signature: modelJson.signature,
    userDefinedMetadata: modelJson.userDefinedMetadata,
  };
}

function embeddedIoHandler(modelJson, weightsB64) {
  return {
    load: function () {
      return Promise.resolve(artifacts(modelJson, b64ToBuffer(weightsB64)));
    },
  };
}

// THE MODELS, FETCHED AS THEMSELVES.
//
// Inlined base64 was the only delivery that worked when this was
// written; measured again 2026-08-29 on the live app, fetching our own
// synthetic url succeeds on reddit (214ms), x (184ms) and m.youtube
// (176ms) with no CSP violation. What inlining costs is paid on every
// single worker start: 93.9% of a 22.7MB script is base64 that has to be
// parsed as JS and then decoded. Raw bytes skip both.
//
// The inlined copy remains the fallback: if a platform ever does refuse
// the fetch, the alternative is a pipeline with no models at all, which
// leaves every image covered forever.
var MODEL_ASSETS = {
  face: 'blazeface',
  gender: 'faceres',
  nsfw: 'nsfw',
  person: 'person',
};

function assetOrigin() {
  try {
    if (typeof location !== 'undefined' && location.origin) return location.origin;
  } catch (e) {
    /* a worker with no location falls through to a relative url */
  }
  return '';
}

async function fetchedArtifacts(kind) {
  var base = assetOrigin() + '/__tamescroll/models/' + MODEL_ASSETS[kind];
  var jsonRes = await fetch(base + '.json');
  if (!jsonRes.ok) throw new Error('model json ' + jsonRes.status);
  var modelJson = await jsonRes.json();
  var binRes = await fetch(base + '.bin');
  if (!binRes.ok) throw new Error('model bin ' + binRes.status);
  var weightData = await binRes.arrayBuffer();
  if (!weightData || !weightData.byteLength) throw new Error('model bin empty');
  return artifacts(modelJson, weightData);
}

/**
 * An IOHandler for one model: fetched bytes when we can get them, the
 * inlined base64 when we cannot. Never throws for a reason the caller
 * can do anything about -- a total failure surfaces as a load failure,
 * which every caller already degrades from.
 */
async function ioHandlerFor(kind) {
  try {
    var a = await fetchedArtifacts(kind);
    return {
      load: function () {
        return Promise.resolve(a);
      },
    };
  } catch (e) {
    await modelsReady();
    var b = modelBlob(kind);
    if (!b) throw e;
    return embeddedIoHandler(b[0], b[1]);
  }
}



// SEGMENTATION COST SPIKE (owner ask, target 4 of the stability round).
// Measurement only, and deliberately NOT wired into any pipeline: the
// instruction is to get the NUMBER before building on it. The model is
// handed in as base64 over the debug channel rather than embedded,
// because embedding it would grow the shipped bundle for a spike, and
// the platform CSPs forbid fetching it at runtime. Guarded and wrapped:
// instrumentation must never be able to throw inside the pipeline.
try {
  if (typeof window !== 'undefined') {
    window.__TS_GAZE_SEG_SPIKE = async function (modelJsonStr, weightsB64, opts) {
      try {
        var o = opts || {};
        var size = o.size || 256;
        var iters = o.iters || 30;
        await initBackend();
        var t0 = (typeof performance !== 'undefined' ? performance : Date).now();
        var m = await tfconv.loadGraphModel(embeddedIoHandler(JSON.parse(modelJsonStr), weightsB64));
        var loadMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
        var video = document.querySelector('video');
        if (!video) return { error: 'no video element' };
        var warm = [];
        var runs = [];
        for (var i = 0; i < iters; i++) {
          var a = (typeof performance !== 'undefined' ? performance : Date).now();
          var res = tf.tidy(function () {
            var img = tf.browser.fromPixels(video);
            var r = tf.image.resizeBilinear(tf.expandDims(img, 0), [size, size]);
            return m.execute(tf.div(tf.cast(r, 'float32'), 255));
          });
          // The download is the honest half of the cost -- a mask that
          // never leaves the GPU cannot be intersected with a track box
          // in JS, and every consumer we would build needs the pixels.
          var data = await res.data();
          tf.dispose(res);
          var b = (typeof performance !== 'undefined' ? performance : Date).now();
          (i < 5 ? warm : runs).push(+(b - a).toFixed(2));
          if (i === iters - 1) warm.push(data.length);
        }
        runs.sort(function (x, y) { return x - y; });
        m.dispose();
        return {
          loadMs: +loadMs.toFixed(1),
          size: size,
          iters: runs.length,
          warmup: warm.slice(0, 5),
          p50: runs[Math.floor(runs.length * 0.5)],
          p90: runs[Math.floor(runs.length * 0.9)],
          min: runs[0],
          max: runs[runs.length - 1],
          backend: tf.getBackend(),
          mem: tf.memory().numTensors,
        };
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    };
  }
} catch (e) {
  /* no window (tests) */
}

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
  return tfconv.loadGraphModel(await ioHandlerFor('face'));
}

/**
 * Loads the NSFW classifier (nsfwjs MobileNetV2Mid, MIT — see NOTICE).
 * Loaded separately from the face model so a failure here degrades to
 * face-only detection instead of taking the whole pipeline down.
 */
export async function loadNsfwModel() {
  await initBackend();
  return tfconv.loadGraphModel(await ioHandlerFor('nsfw'));
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
  return tfconv.loadGraphModel(await ioHandlerFor('gender'));
}

// Person model input dim (MoveNet MultiPose: dynamic, multiple of 32,
// 128-512; 256 = documented accuracy/speed default). A 192 experiment
// (owner phone "very laggy") was reverted same night: a small corner
// facecam person went undetected — small subjects are the owner's
// oldest complaint, and the ADAPTIVE pass cadence (init-entry) is the
// phone lever instead. Registered in docs/detection-engine.md.
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
  return tfconv.loadGraphModel(await ioHandlerFor('person'));
}

/**
 * Person boxes for a frame. pixelSource should already be square (the
 * caller's sample canvas stretches the video the same way the face path
 * does, so face and person coordinates live in the same stretched
 * space). MoveNet wants RAW int32 pixels — no normalization (unlike
 * BlazeFace's [-1,1]); output [1,6,56] parsed by person-gate.mjs.
 */
// Probe only: tfjs is bundled, not global, so a leak check has no way to
// reach tf.memory() from page scope. Wrapped and guarded -- instrumentation
// must never be able to throw inside the pipeline (that cost two releases).
try {
  if (typeof window !== 'undefined') {
    window.__TS_GAZE_MEM = function () {
      try {
        return tf.memory();
      } catch (e) {
        return null;
      }
    };
  }
} catch (e) {
  /* no window (tests) */
}

// ONE UPLOAD PER VERDICT PASS, SHARED BY BOTH DETECTORS.
//
// On the fast path both the person pass and the full-frame face pass read
// the SAME <video> element, and each uploaded it independently. At 1080p
// that is ~8.3MB per fromPixels, so ~16.6MB per verdict pass across a
// shared memory bus -- half of it pure duplication. Invisible on a
// discrete GPU, which is why every previous measurement missed it; the
// target is a Helio G88 with a Mali-G52 and LPDDR4X, where bandwidth is
// the scarce resource, not shader throughput.
//
// Caller owns the tensor and must dispose it. Returns null if the source
// cannot be uploaded, in which case each detector falls back to its own
// upload and behaviour is exactly as before.
/** Which tfjs backend actually got picked. The worker reports this to
 * the page: routing the PLAYER's 4Hz pipeline into a worker that fell
 * back to CPU would be slower than the main thread, not faster, so the
 * page only hands the video path over when this says 'webgl'. */
// COMPILE THE SHADERS BEFORE A USER IS WAITING ON THEM.
//
// Measured 2026-08-29 on a fresh m.youtube navigation: the models were
// loaded and reporting ready at 738ms, the drain dispatched its first
// batch at 738ms -- and the first thumbnail resolved at 1990ms. Every
// image after it took 60-100ms. The 1.25s is WebGL kernel compilation,
// which tfjs does lazily on the first execution of each graph, and a
// hard navigation means a fresh worker paying it again every time.
//
// Running each model once on a blank frame moves that cost into the
// window where the page is still loading anyway. Failures are ignored
// on purpose: a warm-up is an optimisation, and a model that cannot run
// on a blank frame will report its real error on a real one.
export async function warmUp(models) {
  if (typeof ImageData === 'undefined') return;
  var pix;
  try {
    pix = new ImageData(WARM_SIZE, WARM_SIZE);
  } catch (e) {
    return;
  }
  var frame = uploadFrame(pix);
  if (!frame) return null;
  var t = {};
  async function timed(name, run) {
    var at = performance.now();
    await run().catch(noop);
    t[name] = Math.round(performance.now() - at);
  }
  try {
    // A blank frame finds no faces, so the gender model has to be handed
    // a box directly or its graph never runs.
    var box = { x1: 0.25, y1: 0.25, x2: 0.75, y2: 0.75 };
    await timed('compile', function () {
      return compileOnly(models, pix, frame, box);
    });
    if (models.face) await timed('face', function () { return detectFaceBoxes(models.face, pix, frame); });
    if (models.gender) {
      await timed('gender', function () {
        return classifyFaceGenders(models.gender, pix, [box], frame, { square: true });
      });
    }
    if (models.nsfw) await timed('nsfw', function () { return isNsfw(models.nsfw, pix, frame); });
    // The SECOND run over the same graphs: if this is small, everything
    // above was one-time compilation and the number is worth attacking.
    if (models.face) await timed('face2', function () { return detectFaceBoxes(models.face, pix, frame); });
    if (models.nsfw) await timed('nsfw2', function () { return isNsfw(models.nsfw, pix, frame); });
  } catch (e) {
    /* see above: a warm-up never reports */
  } finally {
    disposeFrame(frame);
  }
  return t;
}

var WARM_SIZE = 256;
function noop() {}

// COMPILE EVERY SHADER AT ONCE INSTEAD OF ONE AT A TIME.
//
// Measured 2026-08-29: warming the three models in sequence cost
// 1481-2047ms, and a SECOND run of the same graphs cost 9-18ms -- so
// essentially all of it is one-time WebGL program compilation, paid
// again by every fresh worker, which means every hard navigation.
// tfjs can create all the programs first and then wait on them together
// (KHR_parallel_shader_compile), so the driver compiles them in
// parallel rather than blocking on each link in turn.
//
// ENGINE_COMPILE_ONLY makes every kernel build its program and return
// WITHOUT running it, so the reads inside our own passes get nothing --
// they are expected to fail and are swallowed. The flag is restored in a
// finally: leaving it set would make the whole pipeline silently answer
// with empty tensors.
async function compileOnly(models, pix, frame, box) {
  var env;
  try {
    env = tf.env();
    if (!env || typeof env.set !== 'function') return;
  } catch (e) {
    return;
  }
  try {
    env.set('ENGINE_COMPILE_ONLY', true);
    if (models.face) await detectFaceBoxes(models.face, pix, frame).catch(noop);
    if (models.gender) {
      await classifyFaceGenders(models.gender, pix, [box], frame, { square: true }).catch(noop);
    }
    if (models.nsfw) await isNsfw(models.nsfw, pix, frame).catch(noop);
    var b = tf.backend();
    if (b && typeof b.checkCompileCompletionAsync === 'function') {
      await b.checkCompileCompletionAsync();
      b.getUniformLocations();
    }
  } catch (e) {
    /* a failed pre-compile just means the warm-up below pays for it */
  } finally {
    try {
      env.set('ENGINE_COMPILE_ONLY', false);
    } catch (e) {
      /* nothing left to do; the next pass would answer empty */
    }
  }
}

export function backendName() {
  try {
    return tf.getBackend();
  } catch (e) {
    return null;
  }
}

export function uploadFrame(pixelSource) {
  try {
    return tf.browser.fromPixels(pixelSource);
  } catch (e) {
    return null;
  }
}

export function disposeFrame(t) {
  if (t) {
    try {
      tf.dispose(t);
    } catch (e) {
      /* a disposed or foreign tensor must never break the pass */
    }
  }
}

export async function detectPersons(model, pixelSource, aspect, held, sharedImg) {
  var out = tf.tidy(function () {
    // `sharedImg` = a frame already uploaded by the caller. See uploadFrame:
    // the person pass and the full-frame face pass run back to back on the
    // SAME video element, and each was doing its own fromPixels of a full
    // 1080p frame -- ~8.3MB across the bus, twice, per verdict pass. A
    // tensor created OUTSIDE this tidy is not disposed by it, so ownership
    // stays with the caller.
    var img = sharedImg || tf.browser.fromPixels(pixelSource);
    var resized = tf.image.resizeBilinear(tf.expandDims(img, 0), [PERSON_INPUT_SIZE, PERSON_INPUT_SIZE]);
    return model.execute(tf.cast(resized, 'int32'));
  });
  var data;
  try {
    data = await out.data();
  } finally {
    tf.dispose(out);
  }
  // `held` = the persons this same video returned on the PREVIOUS pass,
  // for parsePersons' admission hysteresis (R17). Passed through rather
  // than stored here: one module instance serves every video element, so
  // module-level continuity state would leak across streams.
  var persons = parsePersons(data, undefined, aspect, held);
  // R21. Snapshot "MoveNet saw nothing human-shaped" HERE, next to the
  // pass that produced it, and hang it on the result. lastSlotDiag is
  // module state cleared by every parsePersons call, and ONE detector
  // module instance serves every video element on the page — so a caller
  // reading it later, from inside a promise, can be handed a different
  // element's pass. The gauntlet asserts a single sampler, so no run
  // could ever show this; a YouTube page with the player and a feed
  // preview has two. Captured synchronously, it cannot desynchronize.
  persons.noHumanShape = frameHasNoHumanShape(lastSlotDiag);
  // R29, and captured here for exactly the reason above: the boxes of
  // the slots this pass REFUSED, so the face fallback can bound a
  // synthetic body onto a person MoveNet measured but would not admit.
  persons.rejectedBoxes = rejectedSlotBoxes(lastSlotDiag);
  return persons;
}

/**
 * NSFW classification against a pixel source. Returns true when the
 * image should stay covered. The graph ends in a Softmax, so the five
 * outputs (Drawing, Hentai, Neutral, Porn, Sexy — nsfwjs class order)
 * are already probabilities. Thresholds: explicit (Porn+Hentai) > 0.5,
 * or Sexy > 0.8 — conservative start, calibration pass pending.
 * MobileNetV2 wants [0,1] input, unlike BlazeFace's [-1,1].
 */
export async function isNsfw(model, pixelSource, sharedImg) {
  var scores = tf.tidy(function () {
    // `sharedImg` — see uploadFrame. On the image path BlazeFace, the
    // gender head and this classifier all read the SAME <img>, so the
    // element was uploaded three times per thumbnail. A tensor created
    // outside this tidy survives it; the caller disposes.
    var img = sharedImg || tf.browser.fromPixels(pixelSource);
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
export async function detectFaceBoxes(model, pixelSource, sharedImg) {
  var anchors = ensureAnchors();
  var out = tf.tidy(function () {
    var img = sharedImg || tf.browser.fromPixels(pixelSource);
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
export async function classifyFaceGenders(model, pixelSource, boxes, sharedImg, opts) {
  if (!boxes.length) return [];
  var square = !!(opts && opts.square);
  var genderHeadFound = false;
  var outs = tf.tidy(function () {
    // `sharedImg` — see uploadFrame and isNsfw. Ownership stays with the
    // caller; a tensor made outside this tidy is not disposed by it.
    var img = sharedImg || tf.browser.fromPixels(pixelSource);
    var input = tf.expandDims(tf.cast(img, 'float32'), 0);
    var srcH = img.shape[0];
    var srcW = img.shape[1];
    var rects = [];
    var inds = [];
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      var y1 = b.y1;
      var x1 = b.x1;
      var y2 = b.y2;
      var x2 = b.x2;
      if (square) {
        // ASPECT-PRESERVING CROP -- the arithmetic and the four days it
        // cost are in crop-geometry.mjs. Both the image path and the
        // worker's video path reach faceres through here, so there is
        // one implementation and one test rather than two chances to
        // get it wrong.
        var sq = squareBox({ x1: x1, y1: y1, x2: x2, y2: y2 }, srcW, srcH);
        x1 = sq.x1;
        x2 = sq.x2;
        y1 = sq.y1;
        y2 = sq.y2;
      }
      rects.push([y1, x1, y2, x2]);
      inds.push(0);
    }
    // cropAndResize interpolates from the 0..255 float source — faceres
    // wants exactly that range, so no further normalisation.
    var crops = tf.image.cropAndResize(input, rects, inds, [GENDER_INPUT_SIZE, GENDER_INPUT_SIZE]);
    var res = model.execute(crops);
    var list = Array.isArray(res) ? res : [res];
    var genderT = null;
    var ageT = null;
    for (var t = 0; t < list.length; t++) {
      if (list[t].shape.length === 2 && list[t].shape[1] === 1) genderT = list[t];
      // age_pred/Softmax: [N,100], p(age==i) — expected value = age.
      if (list[t].shape.length === 2 && list[t].shape[1] === 100) ageT = list[t];
    }
    var descT = null;
    for (var d = 0; d < list.length; d++) {
      // global_pooling/Mean: [N,1024] identity descriptor — the face
      // RECOGNITION embedding (identity memory, plan-blur-v2 /
      // owner ask 2026-08-24 "keep the person in memory").
      if (list[d].shape.length === 2 && list[d].shape[1] === 1024) descT = list[d];
    }
    if (genderT) genderHeadFound = true;
    return [
      genderT ? tf.clone(genderT) : tf.zeros([boxes.length, 1]),
      ageT ? tf.clone(ageT) : tf.zeros([boxes.length, 100]),
      descT ? tf.clone(descT) : tf.zeros([boxes.length, 1024]),
    ];
  });
  var data;
  var ageData;
  var descData;
  var hadGenderHead = true;
  try {
    // One parallel wait, not three serial GPU fences (review A11).
    var downloaded = await Promise.all([outs[0].data(), outs[1].data(), outs[2].data()]);
    data = downloaded[0];
    ageData = downloaded[1];
    descData = downloaded[2];
    // A zeros fallback (missing gender head) would read v=0 -> "female
    // 0.99" (review A12) — report zero confidence instead.
    hadGenderHead = genderHeadFound;
  } finally {
    tf.dispose(outs);
  }
  var verdicts = [];
  for (var k = 0; k < boxes.length; k++) {
    var v = data[k];
    var confidence = hadGenderHead ? Math.min(0.99, 2 * Math.abs(v - 0.5)) : 0;
    // AGE IS AN EXPECTED VALUE over a 100-bin softmax, and that is the
    // wrong statistic for the one question we ask of it (gauntlet R18).
    // A mean over a bimodal posterior lands where no mass is: on a child
    // face faceres splits between a young mode and its adult training
    // prior, and the mean comes out in the twenties. Measured on the
    // classroom footage, twelve directed reads of ONE eight-year-old
    // returned ages 14,14,17,19,19,21,22,26,26,27,29,37 — the child gate
    // would fire on three of twelve, and the two reads that age him 19
    // and 22 are `male` at 0.79 and 0.81, i.e. consecutive certain-clear
    // evidence, which in MAN mode is two of the two CLEAR_STREAK_N reads
    // needed to render an eight-year-old sharp.
    //
    // So carry the MASS under GENDER_ADULT_AGE alongside the mean. It
    // answers the actual question — is there meaningful probability that
    // this face is a child — and it costs nothing: the loop over all 100
    // bins already runs. `age` stays, because it is what the artifact has
    // recorded for eleven rounds and the probes join on it.
    //
    // R22 carries the posterior's SHAPE out alongside its mean, for the
    // same reason and at the same price: the loop over all 100 bins
    // already runs, and `ageData` is already in CPU memory from the
    // download above, so `maxBin`/`maxMass`/entropy are three more
    // accumulators in a loop of 100 rather than any new work. The
    // question they exist to answer is R22's open item — separating a
    // NEWS TITLE CARD from a real close-up, which no threshold on the
    // person pass can do (measured: the two regimes overlap on MoveNet
    // score, maxKp and nKp15 alike). The premise is that faceres answers
    // with its training PRIOR when handed a crop containing no face, and
    // a prior is broad where a real read is a narrow peak. That premise
    // is established for the gender head (it is what `isNullRead` and
    // the [0.545,0.705] null band ship against) and is INFERENCE for the
    // age head — which is why this is a measurement and not yet a gate.
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
    // KEEP THE RAW SIGMOID. `confidence` folds it around 0.5, which
    // destroys the sign the null test needs: faceres answers with a
    // CONSTANT when it has no signal, and that constant lives on one
    // side of 0.5 only. Folded, a null (v~0.63) and a genuine weak
    // female read (v~0.37) are the same number; unfolded they are
    // 0.26 apart. R11's critic measured the null band at v in
    // [0.545, 0.705] over 44 reads against real male reads starting at
    // v = 0.74 — a 1-D gap of 0.035, too thin to threshold alone, which
    // is exactly why the raw value has to survive to where age and the
    // descriptor are also in scope.
    // `norm` IS THE DESCRIPTOR'S MAGNITUDE AND IT WAS BEING DISCARDED BY
    // THE VERY LINE THAT COMPUTES IT (R22 critic). The descriptor is
    // global-average-pooled trunk output; a crop with no face excites the
    // trunk weakly, and L2-normalising is precisely the step that erases
    // that difference before anything downstream can see it. Carrying the
    // scalar out costs nothing — it is already a live local — and it is a
    // 1024-dimensional null test that is ORTHOGONAL to the 1-dimensional
    // one `isNullRead` already performs on the gender sigmoid.
    // Recorded, not acted on: whether it separates a graphic from a face
    // is R23's measurement, and the magnitude-as-quality result it is
    // borrowed from comes from margin-trained recognition embeddings,
    // which faceres's pooled feature is not.
    var shape = { norm: norm, ageBin: ageMaxBin, ageMass: ageMaxMass, ageEnt: ageEnt };
    verdicts.push(
      v <= 0.5
        ? { gender: 'female', score: confidence, age: age, childP: childP, desc: desc, raw: v, shape: shape }
        : { gender: 'male', score: confidence, age: age, childP: childP, desc: desc, raw: v, shape: shape }
    );
  }
  return verdicts;
}
