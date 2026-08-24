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
  padBox,
} from './region-blur.mjs';
import * as videoRegion from './video-region.mjs';
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
  // Bench hook (spikes/perf-harness/bench.html): expose the raw
  // detector fns and touch NOTHING else. The flag is only ever set by
  // our local bench page — never by injected boot scripts.
  if (window.__TS_BENCH__) {
    window.__TS_BENCH_API = {
      setBackend: detector.forceBackend,
      loadFace: detector.loadModel,
      loadNsfw: detector.loadNsfwModel,
      loadGender: detector.loadGenderModel,
      detect: detector.detectFaceBoxes,
      nsfw: detector.isNsfw,
      genders: detector.classifyFaceGenders,
      tf: detector.tfHandle,
      loadUrl: detector.loadModelUrl,
    };
    return;
  }

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
  var VIDEO_SAMPLE_INTERVAL_MS = 500; // caps inference at ~2/s per feed video
  // The watch player samples faster so face-region overlays track the
  // moving face (owner ask 2026-08-24, HaramBlur parity). ~7/s inference
  // is the cost of the face following instead of the whole video going
  // dark; the in-player pill is one tap away when the phone can't keep up.
  var VIDEO_PLAYER_SAMPLE_INTERVAL_MS = 140;
  // Each player face box is padded by this fraction of its size so a face
  // drifting between samples stays under the overlay (over-blur cushion).
  var VIDEO_REGION_PAD = 0.35;
  var VIDEO_CLEAN_STREAK_TO_UNBLUR = 4;

  var failed = false;
  var model = null;
  var nsfwModel = null;
  var genderModel = null;
  // Guards the face-model load so it runs exactly once whether it is the
  // post-load-idle deferral OR a played player video that kicks it early
  // (see ensureFaceModels).
  var faceModelsKicked = false;
  // True once the NSFW model load has SETTLED (loaded or failed). The
  // smart-mode drain must wait for it: images drained into the
  // !nsfwModel branch were revealed WITHOUT the compulsory NSFW check
  // and nothing ever re-checked them (review 2026-08-23 #2).
  var nsfwSettled = false;
  // True once the gender model load has SETTLED (loaded or failed).
  // Owner phone bug 2026-08-22: gender loaded last and nothing
  // re-verdicts, so every image drained before it arrived was flagged
  // presence-only — both genders blurred on any slow device. The drain
  // now waits for settlement instead; on failure this still flips true
  // and the presence-only degradation applies to everything equally.
  var genderSettled = false;
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
    videoRegion.clearAll();
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
      return detector.classifyFaceGenders(genderModel, el, faces).then(function (genders) {
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
      // Face modes wait for BlazeFace AND the gender AND NSFW loads to
      // settle — draining earlier hands out irreversible presence-only
      // flags (gender) or irreversible unchecked reveals (NSFW).
      // Hidden page: every GPU readback fence-wait is clamped to ~1s+
      // by Chrome's nested-timer throttling (found 2026-08-23), so a
      // hidden tab would grind through the queue at seconds per image
      // for nobody. Park the queue; the visibilitychange listener
      // below re-arms the drain the moment the page shows again.
      if (document.hidden) return;
      if (plan.faceGender ? !model || !genderSettled || !nsfwSettled : !nsfwModel) {
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

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && imageQueue.length) drainImages();
  });

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
    // The WATCH PLAYER samples live too (owner decision 2026-08-23,
    // HaramBlur-parity: the old player exemption is reversed for smart
    // mode). Player videos get an in-player toggle so a wrong verdict
    // is one tap from gone; feed videos keep the plain pipeline.
    var isPlayer = dom.hasPlayerAncestor(video);
    if (video.__tsGazeAttached) return;
    video.__tsGazeAttached = true;
    // One tap off, one tap back on — per player video. While off, the
    // video is cleared and sampling halts entirely (no spent frames).
    var playerBlurOn = true;
    markPending(video);

    var lastSample = 0;
    var cleanStreak = 0;
    var sampling = false;
    var intervalId = null;
    var rvfcArmed = false;
    var dead = false;
    var hasRvfc = typeof video.requestVideoFrameCallback === 'function';
    var pill = null;
    // The player unblurs faster than feed videos: 2s of guaranteed
    // blackout on a video the user deliberately opened was the review's
    // #13 — one clean second is enough to trust a face-free frame.
    var unblurStreak = isPlayer ? 2 : VIDEO_CLEAN_STREAK_TO_UNBLUR;
    // Owner ask 2026-08-24: the watch player blurs just the face regions,
    // not the whole video (feed videos keep whole blur — too small/fast
    // to track). Falls back to whole blur where backdrop-filter is
    // unsupported. Region videos also sample faster so the overlay chases
    // the face.
    var useRegionVideo = isPlayer && regionBlur && videoRegion.canRegionVideo(video);
    var sampleInterval = isPlayer ? VIDEO_PLAYER_SAMPLE_INTERVAL_MS : VIDEO_SAMPLE_INTERVAL_MS;
    // True while region overlays are live on this video, so a clean-streak
    // clear knows to tear them down and blur-first can strip cleanly.
    var regionActive = false;

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
      videoRegion.clear(video);
      regionActive = false;
      // eslint-disable-next-line no-console
      console.warn('tamescroll gaze: video unreadable, failing open (' + reason + ')', err);
    }

    function sampleOnce() {
      if (failed || dead || !model || video.paused || document.hidden) return;
      if (isPlayer && !playerBlurOn) return;
      // Same rule as the image drain: verdicts handed out before the
      // gender load settles are presence-only — for video that is a
      // few wrongly-blurred seconds rather than a permanent flag, but
      // the pending blur already covers the wait, so just wait.
      if (!genderSettled) return;
      var now = performance.now();
      if (now - lastSample < sampleInterval) return;
      if (sampling) return;
      lastSample = now;
      sampling = true;
      try {
        var canvas = ensureVideoCanvas();
        var ctx2d = canvas.getContext('2d');
        ctx2d.drawImage(video, 0, 0, detector.INPUT_SIZE, detector.INPUT_SIZE);
        var pixels = ctx2d.getImageData(0, 0, detector.INPUT_SIZE, detector.INPUT_SIZE);
        var frameFaces = [];
        detector
          .detectFaceBoxes(model, pixels)
          .then(function (faces) {
            frameFaces = faces;
            if (!faces.length || !genderModel) {
              return faces.length ? 'flag' : 'clear';
            }
            return detector.classifyFaceGenders(genderModel, pixels, faces).then(function (genders) {
              return faceVerdict(userGender, genders);
            });
          })
          .then(function (verdict) {
            if (failed) return;
            if (verdict === 'flag') {
              cleanStreak = 0;
              var padded = [];
              if (useRegionVideo) {
                for (var f = 0; f < frameFaces.length; f++) {
                  padded.push(padBox(frameFaces[f], VIDEO_REGION_PAD));
                }
              }
              // setBoxes returns false if the player host vanished — then
              // fall back to whole-video blur so a face is never exposed.
              if (useRegionVideo && videoRegion.setBoxes(video, padded)) {
                // Blur just the faces, tracked frame-to-frame. Strip the
                // blur-first whole cover now that the overlays hold it.
                video.classList.remove(dom.PENDING_CLASS, dom.FLAGGED_CLASS);
                track(video);
                regionActive = true;
              } else {
                markFlagged(video); // whole-video blur (feed / no host)
              }
            } else {
              cleanStreak++;
              if (cleanStreak >= unblurStreak) {
                clearEl(video);
                videoRegion.clear(video);
                regionActive = false;
              }
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
      // Toggled-off players must not keep burning a callback per frame
      // (review 2026-08-23 #9) — the pill's re-enable path calls start().
      if (failed || dead || rvfcArmed || (isPlayer && !playerBlurOn)) return;
      rvfcArmed = true;
      video.requestVideoFrameCallback(function () {
        rvfcArmed = false;
        sampleOnce();
        if (!video.paused) rvfcLoop();
      });
    }

    function start() {
      if (failed || dead) return;
      // A played player video can't wait for post-load idle to bring the
      // models — the deferral would hold it blur-first forever on a busy
      // watch page. Kick the load now (idempotent).
      if (isPlayer) ensureFaceModels();
      if (hasRvfc) {
        // rvfcLoop's armed-flag makes the play/playing double-fire (and a
        // parked callback surviving a pause) collapse into one loop —
        // without it every play/pause cycle stacked another loop
        // (review 2026-08-19).
        rvfcLoop();
      } else if (!intervalId) {
        intervalId = setInterval(sampleOnce, sampleInterval);
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

    // A reused element is a NEW video (YouTube SPA watch->watch keeps
    // the same <video> and just swaps the stream — review 2026-08-23
    // #5): every per-video decision is stale the moment loadstart
    // fires. Reset them all — a tainted giveUp on the previous stream,
    // the user's toggle, the clean streak — and blur-first the new one.
    video.addEventListener('loadstart', function () {
      if (failed) return;
      dead = false;
      cleanStreak = 0;
      // Stale overlays belong to the previous stream — drop them before
      // blur-first covers the new one, or they'd sit at old-face coords.
      if (regionActive) {
        videoRegion.clear(video);
        regionActive = false;
      }
      if (!playerBlurOn) {
        playerBlurOn = true;
        if (pill) pill.textContent = 'Blur on';
      }
      markPending(video);
      if (!video.paused) start();
    });

    var pillHost = isPlayer ? (video.closest && video.closest('#movie_player')) || null : null;
    if (pillHost) {
      // In-player toggle (owner ask): a wrong live verdict must be one
      // tap from gone. Lives INSIDE the player container so element
      // fullscreen keeps it visible (fixed-position elements outside
      // the fullscreen element are not rendered). NO NAGS: visible only
      // while the player is actually covered — or toggled off, since
      // the user needs the way back (review 2026-08-23 #9).
      pill = document.createElement('button');
      pill.type = 'button';
      pill.textContent = 'Blur on';
      pill.style.cssText =
        'position:absolute;top:48px;right:8px;z-index:2147483645;' +
        'background:rgba(0,0,0,.55);color:#fff;font:500 12px system-ui;' +
        'padding:6px 10px;border:none;border-radius:999px;opacity:.75;' +
        'cursor:pointer;pointer-events:auto;';
      pill.addEventListener('click', function (e) {
        e.stopPropagation();
        playerBlurOn = !playerBlurOn;
        pill.textContent = playerBlurOn ? 'Blur on' : 'Blur off';
        if (playerBlurOn) {
          cleanStreak = 0;
          markPending(video);
          if (!video.paused) start();
        } else {
          clearEl(video);
          videoRegion.clear(video);
          regionActive = false;
        }
      });
      pillHost.appendChild(pill);
      var pillWatch = setInterval(function () {
        if (!video.isConnected || failed) {
          clearInterval(pillWatch);
          if (pill.parentNode) pill.parentNode.removeChild(pill);
          return;
        }
        // Region blur strips both classes (only the face is covered), so
        // regionActive is part of "is anything covered" — without it the
        // pill would vanish exactly when a live face IS being blurred and
        // the user has no way to toggle it off.
        var covered =
          regionActive ||
          video.classList.contains(dom.PENDING_CLASS) ||
          video.classList.contains(dom.FLAGGED_CLASS);
        pill.style.display = covered || !playerBlurOn ? '' : 'none';
      }, 1000);
    }

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

  // Model loading is deferred to POST-LOAD IDLE (owner report
  // 2026-08-22, "lot of loading": tf's webgl backend init compiles
  // shaders on the main thread and the model parses are heavy — doing
  // that while the page is still fetching and painting is exactly the
  // jank a low-end phone can't hide). Blur-first is already live via
  // boot(), so everything sits safely pending until the models arrive;
  // deferral only ever delays UNBLURRING, never exposure. The 5s timer
  // is the fallback for documents whose load event already fired or
  // never fires.
  function whenSettled(fn) {
    var fired = false;
    var go = function () {
      if (fired) return;
      fired = true;
      idle(fn);
    };
    if (document.readyState === 'complete') setTimeout(go, 250);
    else {
      window.addEventListener('load', function () { setTimeout(go, 250); }, { once: true });
      setTimeout(go, 5000);
    }
  }

  // NSFW-only modes (off / blur-all): the face and gender models never
  // load — only the classifier the compulsory tier needs. If it cannot
  // load, fail open: in "off", pre-blurred media would otherwise stay
  // covered forever on a page the user asked to see unblurred.
  //
  // Off mode may NOT defer the load (review 2026-08-23 #8): its
  // pre-blur holds the whole feed hostage until the classifier clears
  // it — a user who chose "Off" staring at seconds of blur is the
  // deferral backfiring. Blur-all defers: its blur IS the intended
  // visual, NSFW removal timing is not user-visible.
  if (!plan.faceGender) {
    var kickNsfw = function () {
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
    };
    if (plan.preBlur) kickNsfw();
    else whenSettled(kickNsfw);
    return;
  }

  // Blur-first is already live via boot(); load the detector once the
  // page settles and only start draining once it's ready. A failure
  // here is exactly the "AI never in the critical path" rule from
  // VISION.md applied to failure, not just latency: if it can't run,
  // don't punish the page.
  whenSettled(function () {
    if (failed) return;
    ensureFaceModels();
  });

  // Load the face models at most once. Called from the post-load-idle
  // deferral above AND, crucially, the moment a player video actually
  // starts playing (setupVideo): a watched video is held blur-first
  // pending until `model`+`genderSettled` arrive, so if the page never
  // reaches idle (a busy watch page: buffering stream + slow below-fold)
  // the deferral leaves the player permanently blurred — the same
  // "deferral holds it hostage" failure that off mode is exempted from.
  // A user watching a video justifies the load cost then and there.
  function ensureFaceModels() {
    if (faceModelsKicked || failed) return;
    faceModelsKicked = true;
    loadFaceModels();
  }

  function loadFaceModels() {
  detector
    .loadModel()
    .then(function (loaded) {
      if (failed) return;
      model = loaded;
      // Gender loads SECOND, before NSFW: the drain waits for it to
      // settle (flags handed out without it are permanent — the
      // both-genders-blurred phone bug), so it is on the unblur
      // critical path. Failure degrades to presence-only for every
      // image equally.
      return detector
        .loadGenderModel()
        .then(
          function (gender) {
            genderModel = gender;
          },
          function (e) {
            // eslint-disable-next-line no-console
            console.warn('tamescroll gaze: gender model unavailable, presence-only', e);
          }
        )
        .then(function () {
          genderSettled = true;
          if (imageQueue.length) drainImages();
          // NSFW last — it only ever ADDS removals on top of face
          // verdicts. Images verified face-clean before it arrives were
          // cleared under face-only rules — acceptable: blur-first
          // already held while they were pending, and the next src swap
          // re-checks.
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
              nsfwSettled = true;
              if (imageQueue.length) drainImages();
            });
        });
    })
    .catch(function (e) {
      failOpen('detector init error', e);
    });
  }
})();
