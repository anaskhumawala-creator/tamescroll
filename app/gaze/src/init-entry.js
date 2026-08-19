// tamescroll gaze Stage B runtime. Injected on every platform page in
// every launcher mode (see app/src-tauri/src/lib.rs gaze_script()); what
// actually runs per mode is pipeline-plan.mjs — smart is the full
// face/gender pipeline, off and blur-all run only the compulsory NSFW
// removal tier. Never breaks the page: every fallible step is wrapped so
// a failure disables gaze and leaves the site working.
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
import { faceVerdict } from './gender-verdict.mjs';
import {
  supportsRegionBlur,
  initRegionBlur,
  applyRegionBlur,
  clearRegionBlur,
  clearAllRegionBlur,
} from './region-blur.mjs';
import { createTextMatcher } from './text-signals.mjs';
import { planForMode } from './pipeline-plan.mjs';

(function () {
  // Distinctive, minification-proof marker (property assignment with a
  // string literal — esbuild won't rename it) so the Rust side can prove
  // this exact bundle is what got injected. See lib.rs gaze tests.
  window.__TS_GAZE_BUNDLE__ = 'v1';

  // Compulsory tier (handoff decision #1): the pipeline boots in every
  // launcher mode so NSFW media can be removed outright; what else runs
  // is the plan's call (pipeline-plan.mjs, unit-tested policy).
  var plan = planForMode(window.__TS_GAZE_MODE);
  if (!plan.boot) return;

  // Declared user gender (protection engine): set by the Rust boot
  // script from launcher state. "man"/"woman" filters the opposite
  // gender; anything else means undeclared — any face stays covered.
  var userGender =
    window.__TS_GAZE_GENDER === 'man' || window.__TS_GAZE_GENDER === 'woman'
      ? window.__TS_GAZE_GENDER
      : 'unset';

  var IMAGE_MIN_SIZE = 64;
  var IMAGE_BATCH_MAX = 4;
  var VIDEO_SAMPLE_INTERVAL_MS = 500; // caps inference at ~2/s per video
  var VIDEO_CLEAN_STREAK_TO_UNBLUR = 4;

  var failed = false;
  var model = null;
  var nsfwModel = null;
  var genderModel = null;
  // Everything that ever wore pending/flagged, for the fail-open sweep.
  // WeakRefs + a per-element tracked flag: virtualised feeds detach
  // thousands of media nodes per long scroll, and strong refs here would
  // pin every one of them for the life of the page (review 2026-08-19).
  var hasWeakRef = typeof WeakRef === 'function';
  var blurredEls = [];

  function track(el) {
    if (el.__tsGazeTracked) return;
    el.__tsGazeTracked = true;
    blurredEls.push(hasWeakRef ? new WeakRef(el) : el);
  }

  function trackedEl(entry) {
    return hasWeakRef && entry instanceof WeakRef ? entry.deref() : entry;
  }

  function markPending(el) {
    el.classList.add(dom.PENDING_CLASS);
    track(el);
  }

  function markFlagged(el) {
    el.classList.remove(dom.PENDING_CLASS);
    el.classList.add(dom.FLAGGED_CLASS);
    track(el);
  }

  function clearEl(el) {
    el.classList.remove(dom.PENDING_CLASS, dom.FLAGGED_CLASS);
    if (regionBlur) clearRegionBlur(el);
  }

  // Compulsory tier: the element leaves the page. The whole feed item
  // goes when we know its container (no blurred hole in the layout);
  // deliberately NOT tracked in blurredEls — a removal survives the
  // fail-open sweep, because "pipeline died" must never mean "the one
  // thing we positively identified comes back".
  function markRemoved(el) {
    el.classList.remove(dom.PENDING_CLASS, dom.FLAGGED_CLASS);
    if (regionBlur) clearRegionBlur(el);
    var item = textItemSelector && el.closest ? el.closest(textItemSelector) : null;
    (item || el).classList.add(dom.REMOVED_CLASS);
  }

  function failOpen(reason, err) {
    if (failed) return;
    failed = true;
    try {
      observer.disconnect();
    } catch (e) {
      /* best-effort */
    }
    for (var i = 0; i < blurredEls.length; i++) {
      var el = trackedEl(blurredEls[i]);
      if (el) clearEl(el);
    }
    blurredEls.length = 0;
    if (regionBlur) clearAllRegionBlur();
    // eslint-disable-next-line no-console
    console.warn('tamescroll gaze: disabled after ' + reason, err);
  }

  dom.injectStyle();

  // Face-region blur (owner ask 2026-08-19): flagged-by-gender images
  // blur just the face rects, rest stays visible. Whole-element blur
  // remains the fallback (no backdrop-filter, videos, NSFW flags) and
  // the snap-back state whenever the viewport moves.
  var regionBlur = supportsRegionBlur();
  if (regionBlur) initRegionBlur(dom.FLAGGED_CLASS);

  // Text signals (handoff decision #5): the cheap pre-filter that runs
  // BEFORE any model. Seed list is embedded; user terms arrive from the
  // Rust boot script. A matcher construction failure must never take
  // the visual pipeline down — text signal simply switches off.
  var textMatcher = null;
  try {
    textMatcher = createTextMatcher(window.__TS_USER_TERMS);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('tamescroll gaze: text matcher unavailable', e);
  }

  // Per-host feed-item containers, live-DOM-verified only (project rule:
  // selectors are read from the live DOM, never guessed). The whole
  // item's textContent is the haystack — title + channel + captions in
  // one read, no per-field selectors to drift.
  //   ytd-video-renderer          www.youtube search results (verified
  //                               live 2026-08-19; thumbnails carry NO
  //                               alt/aria-label — alt="true").
  //   ytm-video-with-context-renderer  m.youtube feed/related items
  //                               (live-verified 2026-08-19 session).
  // Other platforms join as their containers get live-verified.
  //   shreddit-post               www.reddit.com feed posts (verified
  //                               live 2026-08-19: thumbnails sit in
  //                               its LIGHT DOM so closest() reaches
  //                               it; title lands in the first ~60
  //                               chars of textContent).
  var TEXT_ITEMS = [
    { suffix: 'youtube.com', item: 'ytd-video-renderer, ytm-video-with-context-renderer' },
    { suffix: 'reddit.com', item: 'shreddit-post' },
  ];

  var textItemSelector = (function () {
    var host = (location.hostname || '').replace(/^www\./, '');
    for (var i = 0; i < TEXT_ITEMS.length; i++) {
      var c = TEXT_ITEMS[i];
      if (host === c.suffix || host.slice(-c.suffix.length - 1) === '.' + c.suffix) {
        return c.item;
      }
    }
    return null;
  })();

  // Text for a media element: generic attributes (alt/aria-label, nearest
  // labelled link) plus, where a verified container exists, the whole
  // feed item's text. Capped — matching cost is linear in haystack size.
  function mediaText(el) {
    var parts = [];
    if (el.alt && el.alt.length > 4) parts.push(el.alt);
    var own = el.getAttribute && el.getAttribute('aria-label');
    if (own) parts.push(own);
    if (el.closest) {
      var link = el.closest('a[aria-label], a[title]');
      if (link) parts.push(link.getAttribute('aria-label') || link.getAttribute('title'));
      if (textItemSelector) {
        var item = el.closest(textItemSelector);
        if (item) parts.push((item.textContent || '').slice(0, 500));
      }
    }
    return parts.join(' ');
  }

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

  // Shared face verdict for a pixel source: boxes -> per-face gender ->
  // faceVerdict. Without the gender model (still loading, or failed) any
  // face covers — the old presence behavior, which is also the fail-safe.
  function faceCheck(el) {
    return detector.detectFaceBoxes(model, el).then(function (faces) {
      if (!faces.length) return { verdict: 'clear', faces: faces };
      if (!genderModel) return { verdict: 'flag', faces: faces };
      return Promise.all(
        faces.map(function (box) {
          return detector.classifyFaceGender(genderModel, el, box);
        })
      ).then(function (genders) {
        return { verdict: faceVerdict(userGender, genders), faces: faces };
      });
    });
  }

  function detectImage(img) {
    // Text pre-filter: a hit keeps the element covered without spending
    // any inference on it. Whole-element blur (no face boxes to narrow
    // to — the signal is about the item, not a region).
    if (plan.textFilter && textMatcher) {
      try {
        if (textMatcher.test(mediaText(img))) {
          markFlagged(img);
          return Promise.resolve();
        }
      } catch (e) {
        /* matcher error: fall through to the visual pipeline */
      }
    }
    return dom
      .loadDetectable(img)
      .then(function (el) {
        // Faces first (cheaper, most common hit) — smart mode only.
        // NSFW runs when the faces cleared: a gender-cleared image can
        // still be suggestive, and the compulsory tier owns that call.
        // A face-FLAGGED image skips NSFW — it stays covered by blur
        // either way, and the spared inference keeps the batch moving
        // (revisit when strictness modes map face flags to reveal).
        // NSFW model missing degrades to face-only, never breaks page.
        if (!plan.faceGender) {
          if (!nsfwModel) return { face: false, faces: [], nsfw: false };
          return detector.isNsfw(nsfwModel, el).then(function (nsfw) {
            return { face: false, faces: [], nsfw: nsfw };
          });
        }
        return faceCheck(el).then(function (face) {
          if (face.verdict === 'flag' || !nsfwModel) {
            return { face: face.verdict === 'flag', faces: face.faces, nsfw: false };
          }
          return detector.isNsfw(nsfwModel, el).then(function (nsfw) {
            // NSFW flags are whole-image by nature — no face boxes.
            return { face: false, faces: [], nsfw: nsfw };
          });
        });
      })
      .then(function (result) {
        if (failed) return;
        if (result.nsfw) {
          // Compulsory tier: removed outright, every mode, no setting.
          markRemoved(img);
        } else if (result.face) {
          markFlagged(img);
          // Face-caused flags narrow to face-region overlays (the
          // whole-blur class stays on until the first successful
          // overlay positioning — blur-first holds throughout).
          if (regionBlur && result.faces.length) applyRegionBlur(img, result.faces);
        } else if (plan.revealClears) {
          clearEl(img);
        }
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
      // Readiness depends on the plan: face modes wait on BlazeFace,
      // NSFW-only modes (off / blur-all) wait on the NSFW classifier.
      if (plan.faceGender ? !model : !nsfwModel) {
        // Model still loading: back off instead of re-arming the idle
        // callback immediately — the immediate re-arm was a tight loop
        // eating every idle slice for the whole model-load window,
        // exactly the INSTANT-rule violation Stage B must never commit
        // (review 2026-08-19).
        if (imageQueue.length) setTimeout(drainImages, 250);
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
        // blur-all: the Stage A sheet already blankets the image — no
        // pending class, the queue exists only for NSFW removal.
        if (plan.preBlur) markPending(img);
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
    if (regionBlur) clearRegionBlur(img); // stale overlays die with the old src
    if (plan.preBlur) markPending(img);
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
    // Video sampling is face/gender-driven — smart mode only. In
    // blur-all the Stage A sheet covers feed videos; in off, videos are
    // a known compulsory-tier gap (no NSFW sampling yet — noted for the
    // strictness spec pass).
    if (!plan.faceGender) return;
    if (dom.hasPlayerAncestor(video)) return; // player red line
    if (video.__tsGazeAttached) return;
    video.__tsGazeAttached = true;
    markPending(video);

    var lastSample = 0;
    var cleanStreak = 0;
    var sampling = false;
    var intervalId = null;
    var rvfcArmed = false;
    var dead = false;
    var hasRvfc = typeof video.requestVideoFrameCallback === 'function';

    // Cross-origin video with no CORS taints the canvas: getImageData
    // throws SecurityError on EVERY frame, forever — no header we can
    // set from this side changes that (Reddit v.redd.it, X twimg). A
    // video we can never analyse must fail OPEN, not stay blurred: the
    // user chose to play it, and "the post you chose to open plays
    // normally" is the Stage A contract Stage B may not break
    // (review 2026-08-19).
    function giveUp(reason, err) {
      if (dead) return;
      dead = true;
      stop();
      clearEl(video);
      // eslint-disable-next-line no-console
      console.warn('tamescroll gaze: video unreadable, failing open (' + reason + ')', err);
    }

    function sampleOnce() {
      if (failed || dead || !model || video.paused || document.hidden) return;
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
          .detectFaceBoxes(model, pixels)
          .then(function (faces) {
            if (!faces.length || !genderModel) {
              return faces.length ? 'flag' : 'clear';
            }
            return Promise.all(
              faces.map(function (box) {
                return detector.classifyFaceGender(genderModel, pixels, box);
              })
            ).then(function (genders) {
              return faceVerdict(userGender, genders);
            });
          })
          .then(function (verdict) {
            if (failed) return;
            if (verdict === 'flag') {
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
        // A sync throw from drawImage/getImageData is the tainted-canvas
        // case: permanent for this element, so stop burning frames and
        // fail open (see giveUp above).
        sampling = false;
        giveUp('tainted canvas', e);
      }
    }

    function rvfcLoop() {
      if (failed || dead || rvfcArmed) return;
      rvfcArmed = true;
      video.requestVideoFrameCallback(function () {
        rvfcArmed = false;
        sampleOnce();
        if (!video.paused) rvfcLoop();
      });
    }

    function start() {
      if (failed || dead) return;
      if (hasRvfc) {
        // rvfcLoop's armed-flag makes the play/playing double-fire (and a
        // parked callback surviving a pause) collapse into one loop —
        // without it every play/pause cycle stacked another loop
        // (review 2026-08-19).
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
  // Discovery has to pierce shadow DOM: Reddit's player custom element
  // keeps its <video> inside an open shadow root, invisible to both
  // querySelectorAll and a document-level MutationObserver (probe25
  // 2026-08-19: feed videos played with zero gaze classes — the whole
  // video pipeline was unreachable on Reddit). Three legs: the light-DOM
  // scan below descends into any open roots it passes, boot() deep-scans
  // roots that existed before us, and attachShadow is wrapped so roots
  // created after us register the moment they exist.
  var OBSERVER_CONFIG = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  };

  var observedRoots = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  function observeRoot(root) {
    if (failed || !root) return;
    if (observedRoots) {
      if (observedRoots.has(root)) return;
      observedRoots.add(root);
    }
    try {
      observer.observe(root, OBSERVER_CONFIG);
    } catch (e) {
      /* not a valid observe target — nothing to watch */
    }
    // Document styles stop at the shadow boundary; without this the
    // pending/flagged classes inside the root are inert (probe26).
    dom.injectStyleInto(root);
    scanAdded(root);
  }

  function scanAdded(node) {
    // 1 = element, 11 = shadow root (DocumentFragment) — both scannable.
    if (!node || (node.nodeType !== 1 && node.nodeType !== 11)) return;
    if (node.tagName === 'IMG') tagImage(node);
    else if (node.tagName === 'VIDEO') attachVideo(node);
    if (node.nodeType === 1 && node.shadowRoot) observeRoot(node.shadowRoot);
    if (!node.querySelectorAll) return;
    var imgs = node.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) tagImage(imgs[i]);
    var vids = node.querySelectorAll('video');
    for (var j = 0; j < vids.length; j++) attachVideo(vids[j]);
    var all = node.querySelectorAll('*');
    for (var k = 0; k < all.length; k++) {
      if (all[k].shadowRoot) observeRoot(all[k].shadowRoot);
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
    observer.observe(document.documentElement, OBSERVER_CONFIG);
    // scanAdded also deep-scans: it descends into every open shadow
    // root already in the tree and registers it with the observer.
    scanAdded(document.documentElement);
  }

  // Roots created after boot: wrap attachShadow so they register at
  // creation. Pure pass-through otherwise — same return value, and a
  // failure in our side never reaches the page (observeRoot guards).
  var origAttachShadow = Element.prototype.attachShadow;
  if (typeof origAttachShadow === 'function') {
    Element.prototype.attachShadow = function (init) {
      var root = origAttachShadow.call(this, init);
      observeRoot(root);
      return root;
    };
  }

  function boot() {
    if (document.documentElement) startObserving();
    else document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  }

  boot();

  // NSFW-only modes (off / blur-all): the face and gender models never
  // load — only the classifier the compulsory tier needs. If it cannot
  // load, fail open: in "off", pre-blurred media would otherwise stay
  // covered forever on a page the user asked to see unblurred.
  if (!plan.faceGender) {
    detector
      .loadNsfwModel()
      .then(function (nsfw) {
        if (failed) return;
        nsfwModel = nsfw;
        if (imageQueue.length) drainImages();
      })
      .catch(function (e) {
        failOpen('nsfw model unavailable', e);
      });
    return;
  }

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
      // NSFW classifier loads after the face model so the first unblur
      // is never delayed by the bigger download-free-but-parse-heavy
      // model. Images verified face-clean before it arrives were
      // cleared under face-only rules — acceptable: blur-first already
      // held while they were pending, and the next src swap re-checks.
      return detector
        .loadNsfwModel()
        .then(
          function (nsfw) {
            nsfwModel = nsfw;
          },
          function (e) {
            // Degrade to face-only, loudly but harmlessly.
            // eslint-disable-next-line no-console
            console.warn('tamescroll gaze: nsfw model unavailable, face-only', e);
          }
        )
        .then(function () {
          // Gender last — it only ever REMOVES blur (same-gender clears),
          // so nothing waits on it. Failure degrades to presence-only.
          return detector.loadGenderModel().then(
            function (gender) {
              genderModel = gender;
            },
            function (e) {
              // eslint-disable-next-line no-console
              console.warn('tamescroll gaze: gender model unavailable, presence-only', e);
            }
          );
        });
    })
    .catch(function (e) {
      failOpen('detector init error', e);
    });
})();
