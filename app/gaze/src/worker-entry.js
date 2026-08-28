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

  var models = { face: null, gender: null, nsfw: null, person: null };
  var loading = null;
  // Loaded ONLY when a player asks (a feed page has no video and MoveNet
  // is the most expensive model we ship). Null until then; `false` once
  // it has failed, so the page is told to keep the video path in-page
  // instead of asking again every 250ms.
  var personLoading = null;
  var personFailed = false;
  // Crop frames the page is still working on. The player path detects
  // faces in a crop, decides whether any of them belongs to the tracked
  // person, and only THEN pays for gender -- so the uploaded crop has to
  // outlive its first answer. Held by id, released by the page, and
  // swept on a deadline so a page that navigates mid-pass cannot leak
  // GPU memory.
  var crops = new Map();
  var nextCrop = 1;
  var CROP_TTL_MS = 8000;

  function sweepCrops() {
    var now = performance.now();
    crops.forEach(function (c, id) {
      if (now - c.at > CROP_TTL_MS) {
        detector.disposeFrame(c.t);
        crops.delete(id);
      }
    });
  }

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
      // `backend` decides whether the PLAYER path may come here at all:
      // a CPU-backend worker is slower than the main thread it was meant
      // to unblock.
      post({ type: 'ready', backend: detector.backendName() });
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
        reads = await detector.classifyFaceGenders(models.gender, bmp, boxes, frame, { square: true });
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

  function ensurePerson() {
    if (models.person) return Promise.resolve(models.person);
    if (personFailed) return Promise.resolve(null);
    if (!personLoading) {
      personLoading = detector.loadPersonModel().then(
        function (m) {
          models.person = m;
          post({ type: 'loaded', model: 'person' });
          return m;
        },
        function (e) {
          // NOT a dead worker: images do not use MoveNet, so the image
          // path is unaffected. The page is told, and keeps the player
          // in-page.
          personFailed = true;
          post({ type: 'personFailed', message: String((e && e.message) || e) });
          return null;
        }
      );
    }
    return personLoading;
  }

  // ONE PLAYER PASS. The person detector and the full-frame face pass
  // read the SAME uploaded frame -- the pairing the in-page path already
  // makes for the same reason (one 1080p texture upload, not two).
  // `withFaces` is false on the cheap position-only passes, which is the
  // majority of them.
  async function handleFrame(msg) {
    var bmp = msg.bitmap;
    var frame = null;
    var t0 = performance.now();
    try {
      var person = await ensurePerson();
      if (!person) {
        post({ type: 'error', id: msg.id, message: 'no person model' });
        return;
      }
      frame = detector.uploadFrame(bmp);
      var persons = await detector.detectPersons(person, bmp, msg.aspect, msg.held, frame);
      var faces = null;
      if (msg.withFaces && models.face) {
        faces = await detector.detectFaceBoxes(models.face, bmp, frame);
      }
      post({
        type: 'vframe',
        id: msg.id,
        // Structured clone copies an array's ELEMENTS, not the extra
        // properties detectPersons hangs on it, so they travel by name.
        persons: Array.prototype.slice.call(persons),
        noHumanShape: !!persons.noHumanShape,
        rejectedBoxes: persons.rejectedBoxes || [],
        faces: faces,
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

  // A crop's faces, KEEPING the upload. See `crops`: the page decides
  // between this answer and paying for gender.
  async function handleCropFaces(msg) {
    var bmp = msg.bitmap;
    var t0 = performance.now();
    try {
      sweepCrops();
      var frame = detector.uploadFrame(bmp);
      var faces = models.face ? await detector.detectFaceBoxes(models.face, bmp, frame) : [];
      var cid = nextCrop++;
      crops.set(cid, { t: frame, at: performance.now() });
      post({ type: 'vfaces', id: msg.id, cid: cid, faces: faces, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      post({ type: 'error', id: msg.id, message: String((e && e.message) || e) });
    } finally {
      try {
        bmp.close();
      } catch (e) {
        /* already closed */
      }
    }
  }

  async function handleCropGender(msg) {
    var c = crops.get(msg.cid);
    if (!c || !models.gender) {
      post({ type: 'error', id: msg.id, message: c ? 'no gender model' : 'crop gone' });
      return;
    }
    try {
      var reads = await detector.classifyFaceGenders(models.gender, null, msg.boxes, c.t);
      post({ type: 'vgender', id: msg.id, reads: reads });
    } catch (e) {
      post({ type: 'error', id: msg.id, message: String((e && e.message) || e) });
    }
  }

  // A one-shot gender read on pixels the page will not ask about again
  // (the native-resolution face re-crop, and the whole-blur fallback).
  async function handleGenderOnce(msg) {
    var bmp = msg.bitmap;
    var frame = null;
    try {
      if (!models.gender) throw new Error('no gender model');
      frame = detector.uploadFrame(bmp);
      var reads = await detector.classifyFaceGenders(models.gender, bmp, msg.boxes, frame);
      post({ type: 'vgender', id: msg.id, reads: reads });
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

  function releaseCrop(cid) {
    var c = crops.get(cid);
    if (!c) return;
    detector.disposeFrame(c.t);
    crops.delete(cid);
  }

  self.onmessage = function (e) {
    var msg = e.data || {};
    if (msg.type === 'vframe') {
      ensureModels().then(function () {
        return handleFrame(msg);
      });
      return;
    }
    if (msg.type === 'vfaces') {
      ensureModels().then(function () {
        return handleCropFaces(msg);
      });
      return;
    }
    if (msg.type === 'vgender') {
      handleCropGender(msg);
      return;
    }
    if (msg.type === 'vgender1') {
      ensureModels().then(function () {
        return handleGenderOnce(msg);
      });
      return;
    }
    if (msg.type === 'vrelease') {
      releaseCrop(msg.cid);
      return;
    }
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
