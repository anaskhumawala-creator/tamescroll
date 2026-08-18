// tamescroll gaze Stage B ("smart" mode) runtime. Injected as a Tauri v2
// initialization_script only when the launcher's blur picker is set to
// "smart" (see app/src-tauri/src/lib.rs gaze_script()). Never breaks the
// page: every fallible step is wrapped so a failure disables gaze and
// leaves the site working, exactly like "off" mode.
//
// Blur-first, always: every <img>/<video> gets .ts-gaze-pending the
// instant we know it's real content-sized media, before any inference —
// nothing may ever flash unblurred. Detection only ever *removes* blur
// once it has positively cleared something; it never races ahead of it.
//
// Architecture: docs/gaze-research.md §5/§6 (clean-room reproduction of
// HaramBlur's *behaviour* — MutationObserver dispatch, frame-skip video
// sampling — never its AGPL-3.0 source; see NOTICE / VISION.md).
import * as dom from './dom.js';
import * as detector from './detector.js';

(function () {
  // Distinctive, minification-proof marker (property assignment with a
  // string literal — esbuild won't rename it) so the Rust side can prove
  // this exact bundle is what got injected. See lib.rs gaze tests.
  window.__TS_GAZE_BUNDLE__ = 'v1';

  if (window.__TS_GAZE_MODE !== 'smart') return;

  var IMAGE_MIN_SIZE = 64;
  var IMAGE_BATCH_MAX = 4;
  var VIDEO_SAMPLE_INTERVAL_MS = 500; // caps inference at ~2/s per video
  var VIDEO_CLEAN_STREAK_TO_UNBLUR = 4;

  var failed = false;
  var model = null;
  var blurredEls = []; // everything currently wearing pending/flagged, for fail-open cleanup

  function markPending(el) {
    el.classList.add(dom.PENDING_CLASS);
    blurredEls.push(el);
  }

  function markFlagged(el) {
    el.classList.remove(dom.PENDING_CLASS);
    el.classList.add(dom.FLAGGED_CLASS);
    blurredEls.push(el);
  }

  function clearEl(el) {
    el.classList.remove(dom.PENDING_CLASS, dom.FLAGGED_CLASS);
  }

  function failOpen(reason, err) {
    if (failed) return;
    failed = true;
    try {
      observer.disconnect();
    } catch (e) {
      /* best-effort */
    }
    for (var i = 0; i < blurredEls.length; i++) clearEl(blurredEls[i]);
    blurredEls.length = 0;
    // eslint-disable-next-line no-console
    console.warn('tamescroll gaze: disabled after ' + reason, err);
  }

  dom.injectStyle();

  // ---- image pipeline -----------------------------------------------
  var imageSeen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  var imageQueue = [];
  var imageDraining = false;

  var idle =
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : function (cb) {
          setTimeout(function () {
            cb({ timeRemaining: function () { return 8; }, didTimeout: true });
          }, 200);
        };

  function detectImage(img) {
    return dom
      .loadDetectable(img)
      .then(function (el) {
        return detector.detectFaces(model, el);
      })
      .then(function (hasFace) {
        if (failed) return;
        if (hasFace) markFlagged(img);
        else clearEl(img);
      })
      .catch(function (e) {
        // Fail-closed for imagery: could not verify, stays blurred.
        // eslint-disable-next-line no-console
        console.warn('tamescroll gaze: image check failed, staying blurred', e);
      });
  }

  function drainImages() {
    if (imageDraining) return;
    imageDraining = true;
    idle(function (deadline) {
      imageDraining = false;
      if (failed) {
        imageQueue.length = 0;
        return;
      }
      if (!model) {
        if (imageQueue.length) drainImages();
        return;
      }
      var batch = [];
      while (
        imageQueue.length &&
        batch.length < IMAGE_BATCH_MAX &&
        (deadline.didTimeout || deadline.timeRemaining() > 0)
      ) {
        batch.push(imageQueue.shift());
      }
      Promise.all(batch.map(detectImage)).then(function () {
        if (imageQueue.length) drainImages();
      });
    });
  }

  function tagImage(img) {
    if (failed || dom.hasPlayerAncestor(img)) return;
    if (imageSeen && imageSeen.has(img)) return;

    function check() {
      if (failed) return;
      if (imageSeen && imageSeen.has(img)) return;
      if (img.naturalWidth >= IMAGE_MIN_SIZE && img.naturalHeight >= IMAGE_MIN_SIZE) {
        if (imageSeen) imageSeen.add(img);
        markPending(img);
        imageQueue.push(img);
        drainImages();
      }
    }

    if (img.complete && img.naturalWidth) {
      check();
    } else {
      img.addEventListener('load', check, { once: true });
    }
  }

  // src swaps (lazy-load placeholder -> real image) need re-evaluation:
  // blur immediately, forget prior verdict, re-check the new content.
  function retagImage(img) {
    if (failed || dom.hasPlayerAncestor(img)) return;
    if (imageSeen) imageSeen.delete(img);
    markPending(img);
    tagImage(img);
  }

  // ---- video pipeline -------------------------------------------------
  var videoCanvas = null;

  function ensureVideoCanvas() {
    if (!videoCanvas) {
      videoCanvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(detector.INPUT_SIZE, detector.INPUT_SIZE)
          : Object.assign(document.createElement('canvas'), {
              width: detector.INPUT_SIZE,
              height: detector.INPUT_SIZE,
            });
    }
    return videoCanvas;
  }

  function attachVideo(video) {
    if (dom.hasPlayerAncestor(video)) return; // player red line
    if (video.__tsGazeAttached) return;
    video.__tsGazeAttached = true;
    markPending(video);

    var lastSample = 0;
    var cleanStreak = 0;
    var sampling = false;
    var intervalId = null;
    var hasRvfc = typeof video.requestVideoFrameCallback === 'function';

    function sampleOnce() {
      if (failed || !model || video.paused || document.hidden) return;
      var now = performance.now();
      if (now - lastSample < VIDEO_SAMPLE_INTERVAL_MS) return;
      if (sampling) return;
      lastSample = now;
      sampling = true;
      try {
        var canvas = ensureVideoCanvas();
        var ctx2d = canvas.getContext('2d');
        ctx2d.drawImage(video, 0, 0, detector.INPUT_SIZE, detector.INPUT_SIZE);
        var pixels = ctx2d.getImageData(0, 0, detector.INPUT_SIZE, detector.INPUT_SIZE);
        detector
          .detectFaces(model, pixels)
          .then(function (hasFace) {
            if (failed) return;
            if (hasFace) {
              cleanStreak = 0;
              markFlagged(video); // re-flag instantly
            } else {
              cleanStreak++;
              if (cleanStreak >= VIDEO_CLEAN_STREAK_TO_UNBLUR) clearEl(video);
            }
          })
          .catch(function (e) {
            // Cannot verify this frame — do not advance the clean streak.
            cleanStreak = 0;
            // eslint-disable-next-line no-console
            console.warn('tamescroll gaze: video sample failed', e);
          })
          .finally(function () {
            sampling = false;
          });
      } catch (e) {
        // Tainted canvas (cross-origin video, no CORS) or similar: treat
        // like a failed sample rather than crash the sampling loop.
        cleanStreak = 0;
        sampling = false;
        // eslint-disable-next-line no-console
        console.warn('tamescroll gaze: video frame read failed', e);
      }
    }

    function rvfcLoop() {
      if (failed) return;
      video.requestVideoFrameCallback(function () {
        sampleOnce();
        if (!video.paused) rvfcLoop();
      });
    }

    function start() {
      if (failed) return;
      if (hasRvfc) {
        rvfcLoop();
      } else if (!intervalId) {
        intervalId = setInterval(sampleOnce, VIDEO_SAMPLE_INTERVAL_MS);
      }
    }

    function stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      // rVFC loop self-terminates on the `video.paused` check above.
    }

    video.addEventListener('play', start);
    video.addEventListener('playing', start);
    video.addEventListener('pause', stop);
    video.addEventListener('ended', stop);

    if (!video.paused) start();
  }

  // ---- discovery: MutationObserver + initial sweep --------------------
  function scanAdded(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === 'IMG') tagImage(node);
    else if (node.tagName === 'VIDEO') attachVideo(node);
    if (node.querySelectorAll) {
      var imgs = node.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) tagImage(imgs[i]);
      var vids = node.querySelectorAll('video');
      for (var j = 0; j < vids.length; j++) attachVideo(vids[j]);
    }
  }

  var observer = new MutationObserver(function (mutations) {
    if (failed) return;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === 'childList') {
        m.addedNodes.forEach(scanAdded);
      } else if (m.type === 'attributes' && m.target && m.target.tagName === 'IMG') {
        if (!dom.hasPlayerAncestor(m.target)) retagImage(m.target);
      }
    }
  });

  function startObserving() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) tagImage(imgs[i]);
    var vids = document.querySelectorAll('video');
    for (var j = 0; j < vids.length; j++) attachVideo(vids[j]);
  }

  function boot() {
    if (document.documentElement) startObserving();
    else document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  }

  boot();

  // Blur-first is already live via boot(); load the detector in parallel
  // and only start draining once it's ready. A failure here is exactly
  // the "AI never in the critical path" rule from VISION.md applied to
  // failure, not just latency: if it can't run, don't punish the page.
  detector
    .loadModel()
    .then(function (loaded) {
      if (failed) return;
      model = loaded;
      if (imageQueue.length) drainImages();
    })
    .catch(function (e) {
      failOpen('detector init error', e);
    });
})();
