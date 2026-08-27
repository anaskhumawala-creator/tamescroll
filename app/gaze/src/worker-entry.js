// THE INFERENCE WORKER.
//
// Everything in here runs off the page's main thread. That is the whole
// point: on a low-end phone the models are not slow so much as they are
// IN THE WAY -- every BlazeFace pass was a task YouTube's own scroll,
// lazy-loading and comment rendering had to wait behind.
//
// This is loadable at all because of the measurement in
// synthetic_resource (lib.rs): YouTube ships
// `require-trusted-types-for 'script'` with no `trusted-types`
// directive, so our own policy is allowed, and a SAME-ORIGIN script url
// loads where a blob: one is refused. Our request interceptor answers
// that url.
//
// The protocol is deliberately thin. The worker does inference and
// NOTHING else: no policy, no thresholds, no verdicts. Whether a read
// means "cover him" is owner-tuned logic that lives on the main thread
// next to its tests (gender-verdict.mjs), and duplicating it here is how
// the two would drift.
import * as detector from './detector.js';

// Exported, not self-starting: this file is bundled INTO the page
// bundle, which is also what gets served as the worker script. One
// artifact, two roles -- embedding a second copy of tfjs and four
// models cost 17MB of the APK for code that is byte-identical.
export function startWorker() {

  var models = { face: null, gender: null, nsfw: null };
  var loading = null;

  function post(msg, transfer) {
    try {
      self.postMessage(msg, transfer || []);
    } catch (e) {
      // A message that cannot be cloned must still not kill the worker;
      // the main thread times the request out and falls back.
      self.postMessage({ type: 'error', id: msg && msg.id, message: String((e && e.message) || e) });
    }
  }

  // Models load in the order the image path consumes them, and each one
  // reports as it lands so the main thread can start draining the moment
  // the pieces it needs exist -- the same staged readiness the in-page
  // path has, just without occupying the thread that draws the page.
  function ensureModels() {
    if (loading) return loading;
    loading = (async function () {
      try {
        models.face = await detector.loadModel();
        post({ type: 'loaded', model: 'face' });
      } catch (e) {
        post({ type: 'loadFailed', model: 'face', message: String((e && e.message) || e) });
      }
      try {
        models.gender = await detector.loadGenderModel();
        post({ type: 'loaded', model: 'gender' });
      } catch (e) {
        post({ type: 'loadFailed', model: 'gender', message: String((e && e.message) || e) });
      }
      try {
        models.nsfw = await detector.loadNsfwModel();
        post({ type: 'loaded', model: 'nsfw' });
      } catch (e) {
        post({ type: 'loadFailed', model: 'nsfw', message: String((e && e.message) || e) });
      }
      // A worker that is missing a model answers every image with "no
      // faces, not suggestive", which the main thread would act on by
      // REVEALING it. It reports the failure instead and the client hands
      // the path back to the in-page pipeline (worker-client.mjs).
      post({ type: 'ready' });
    })();
    return loading;
  }

  // One image: faces, per-face reads, and the NSFW answer. Same shape and
  // same order as the in-page path, including starting the classifier
  // alongside the face pass rather than after it -- neither needs the
  // other's answer and both read the one uploaded frame.
  async function handleImage(msg) {
    var bmp = msg.bitmap;
    var frame = null;
    var t0 = performance.now();
    try {
      frame = detector.uploadFrame(bmp);
      var nsfwP = models.nsfw
        ? detector.isNsfw(models.nsfw, bmp, frame).catch(function () {
            return false;
          })
        : Promise.resolve(false);
      var boxes = models.face ? await detector.detectFaceBoxes(models.face, bmp, frame) : [];
      var reads = [];
      if (boxes.length && models.gender) {
        reads = await detector.classifyFaceGenders(models.gender, bmp, boxes, frame);
      }
      var nsfw = await nsfwP;
      post({
        type: 'verdict',
        id: msg.id,
        boxes: boxes,
        // The identity descriptor is 1024 floats per face and only the
        // video path's memory uses it. Sending it would cost more than
        // the inference saved.
        reads: reads.map(function (r) {
          return { gender: r.gender, score: r.score, age: r.age, childP: r.childP, px: r.px };
        }),
        nsfw: !!nsfw,
        ms: Math.round(performance.now() - t0),
      });
    } catch (e) {
      post({ type: 'error', id: msg.id, message: String((e && e.message) || e) });
    } finally {
      detector.disposeFrame(frame);
      try {
        bmp.close();
      } catch (e) {
        /* already closed */
      }
    }
  }

  self.onmessage = function (e) {
    var msg = e.data || {};
    if (msg.type === 'init') {
      ensureModels();
      return;
    }
    if (msg.type === 'image') {
      ensureModels().then(function () {
        return handleImage(msg);
      });
      return;
    }
  };

  post({ type: 'up' });
}
