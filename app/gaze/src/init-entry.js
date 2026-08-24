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
import { flaggedFaceIndices, faceMeta } from './gender-verdict.mjs';
import { personCropRegion } from './person-gate.mjs';
import {
  updatePersonTracks,
  blurredTracks,
  cosineSim,
  MEM_SIM_CLEAR,
  MEM_SIM_UPDATE,
} from './person-track.mjs';
import * as sceneGate from './scene-gate.mjs';
import {
  supportsRegionBlur,
  initRegionBlur,
  applyRegionBlur,
  clearRegionBlur,
  clearAllRegionBlur,
  expandToBody,
} from './region-blur.mjs';
import * as videoRegion from './video-region.mjs';
import { createTextMatcher } from './text-signals.mjs';
import { planForMode } from './pipeline-plan.mjs';

(function () {
  // Distinctive, minification-proof marker (property assignment with a
  // string literal — esbuild won't rename it) so the Rust side can prove
  // this exact bundle is what got injected. See lib.rs gaze tests.
  window.__TS_GAZE_BUNDLE__ = 'v6'; // v6: zero-readback sampling + scene gate (plan-blur-v2 Stage 1)

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

  // 64 -> 120 2026-08-24 (owner: "why are all the logos blurred — the
  // LTT tab, my own channel avatar"): sub-120px images are UI chrome
  // (avatars, channel logos, badges), not content — HaramBlur exempts
  // the same class. Trade-off accepted: tiny thumbnails skip the NSFW
  // check too; content thumbnails on every supported platform measure
  // well above this.
  var IMAGE_MIN_SIZE = 120;
  var IMAGE_BATCH_MAX = 4;
  var VIDEO_SAMPLE_INTERVAL_MS = 500; // caps inference at ~2/s per feed video
  // Player detection cadence (redesign 2026-08-24, blur-pipeline-audit,
  // + owner "not instantaneous — HaramBlur is snappier"): the person
  // POSITION pass is cheap (~30ms warm desktop) and floors at 120ms
  // (~8Hz) — the adaptive throttle (1.5x measured pass cost, capped 1s)
  // is what protects slow devices, not a high floor. The EXPENSIVE
  // part — per-person crop + gender — runs at most every
  // ZOOM_INTERVAL_MS; in between, passes update positions only, so
  // verdict cadence and position cadence are decoupled (no beat
  // frequency, no per-frame verdict flips).
  var VIDEO_PLAYER_SAMPLE_INTERVAL_MS = 120;
  var ZOOM_INTERVAL_MS = 400;
  var VIDEO_CLEAN_STREAK_TO_UNBLUR = 4;

  var failed = false;
  var model = null;
  var nsfwModel = null;
  var genderModel = null;
  // Person/pose model (MoveNet MultiPose, person-gate.mjs). Loads LAST
  // — it only ever refines: gates ambiguous face candidates and covers
  // backside persons. null = no gating, no backside coverage (fail-safe
  // in the "never drop extra blur" direction).
  var personModel = null;
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
  // per-face flags (owner report 2026-08-24: all-or-nothing flagging
  // blurred a confident same-gender face because ANOTHER face in the
  // thumbnail failed the bar — now only the failing faces' boxes come
  // back). Without the gender model (still loading, or failed) every
  // face covers — the old presence behavior, which is also the fail-safe.
  function faceCheck(el) {
    return detector.detectFaceBoxes(model, el).then(function (faces) {
      if (!faces.length) return { verdict: 'clear', flagBoxes: [] };
      if (!genderModel) return { verdict: 'flag', flagBoxes: faces };
      return detector.classifyFaceGenders(genderModel, el, faces).then(function (genders) {
        var idx = flaggedFaceIndices(userGender, genders);
        var flagBoxes = [];
        for (var i = 0; i < idx.length; i++) flagBoxes.push(faces[idx[i]]);
        return { verdict: idx.length ? 'flag' : 'clear', flagBoxes: flagBoxes };
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
          if (!nsfwModel) return { face: false, flagBoxes: [], nsfw: false };
          return detector.isNsfw(nsfwModel, el).then(function (nsfw) {
            return { face: false, flagBoxes: [], nsfw: nsfw };
          });
        }
        return faceCheck(el).then(function (face) {
          if (face.verdict === 'flag' || !nsfwModel) {
            return { face: face.verdict === 'flag', flagBoxes: face.flagBoxes, nsfw: false };
          }
          return detector.isNsfw(nsfwModel, el).then(function (nsfw) {
            // NSFW flags are whole-image by nature — no face boxes.
            return { face: false, flagBoxes: [], nsfw: nsfw };
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
          // Only the FAILING faces' person-regions get patches (cleared
          // faces in the same image stay sharp — owner 2026-08-24); the
          // whole-blur class stays on until the first successful patch
          // placement — blur-first holds throughout.
          if (regionBlur && result.flagBoxes.length) {
            var bodies = [];
            for (var rb = 0; rb < result.flagBoxes.length; rb++) {
              bodies.push(expandToBody(result.flagBoxes[rb]));
            }
            applyRegionBlur(img, bodies);
          }
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
    var pillRefresh = null;
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
    // True while region overlays are live on this video, so a clear knows
    // to tear them down and blur-first can strip cleanly.
    var regionActive = false;
    // Person tracks (person-track.mjs) — the ONLY temporal state the
    // player path keeps (redesign 2026-08-24). Reset whenever the stream
    // identity changes (loadstart, pill re-enable, giveUp): old tracks
    // describe a video that no longer exists.
    var videoTracks = [];
    var lastPassAt = 0;
    // Identity memory (owner ask 2026-08-24 "keep the person in memory
    // and always blur her/him"): per-VIDEO list of face descriptors with
    // the blur state their person EARNED (cleared = served the full
    // hold; blurred = certain opposite-gender read). New/re-appearing
    // faces that match a remembered identity inherit it — no re-serving
    // the clear hold after every cut, no identity swap across shots.
    // Reset on loadstart: a new video is new people.
    var identityMemory = [];
    var MEM_MAX = 8;
    function memoryLookup(desc) {
      if (!desc) return null;
      var bestSim = 0;
      var best = null;
      for (var i = 0; i < identityMemory.length; i++) {
        var s = cosineSim(desc, identityMemory[i].desc);
        if (s > bestSim) {
          bestSim = s;
          best = identityMemory[i];
        }
      }
      // Only the CLEAR direction is worth inheriting (blur is already
      // the default for every unknown) — and it takes the high bar.
      if (best && best.state === 'cleared' && bestSim >= MEM_SIM_CLEAR) return 'cleared';
      return null;
    }
    function memoryStore(tracks) {
      for (var i = 0; i < tracks.length; i++) {
        var t = tracks[i];
        if (!t.desc) continue;
        // Memorize only EARNED states: a served clear hold, or a
        // certain opposite-gender flag. Never a provisional blur —
        // that would freeze "unknown ⇒ covered" into "this face is
        // always covered".
        var state = null;
        if (t.state === 'cleared') state = 'cleared';
        else if (t.state === 'blurred' && t.lastVerdict === 'flag-certain') state = 'blurred';
        if (!state) continue;
        var bestSim = 0;
        var best = null;
        for (var j = 0; j < identityMemory.length; j++) {
          var s = cosineSim(t.desc, identityMemory[j].desc);
          if (s > bestSim) {
            bestSim = s;
            best = identityMemory[j];
          }
        }
        if (best && bestSim >= MEM_SIM_UPDATE) {
          // Blend toward the newest look (lighting/angle drift) and
          // re-normalize so similarity stays a dot product.
          var d = best.desc;
          var norm = 0;
          for (var k = 0; k < d.length; k++) {
            d[k] = d[k] * 0.7 + t.desc[k] * 0.3;
            norm += d[k] * d[k];
          }
          norm = Math.sqrt(norm) || 1;
          for (var m = 0; m < d.length; m++) d[m] /= norm;
          // A certain flag OVERWRITES a remembered clear (fail-safe);
          // a clear only upgrades an entry that isn't certain-flagged.
          if (state === 'blurred' || best.state !== 'blurred') best.state = state;
        } else {
          identityMemory.push({ desc: t.desc, state: state });
          if (identityMemory.length > MEM_MAX) identityMemory.shift();
        }
      }
    }
    // Face center inside any (padded) person box — used to keep the
    // full-frame face fallback from duplicating a MoveNet person.
    function faceInsideAny(face, persons) {
      var cx = (face.x1 + face.x2) / 2;
      var cy = (face.y1 + face.y2) / 2;
      for (var i = 0; i < persons.length; i++) {
        var p = persons[i];
        var pw = (p.x2 - p.x1) * 0.1;
        var ph = (p.y2 - p.y1) * 0.1;
        if (cx >= p.x1 - pw && cx <= p.x2 + pw && cy >= p.y1 - ph && cy <= p.y2 + ph) return true;
      }
      return false;
    }
    // ADAPTIVE cadence (owner phone 2026-08-24 "very laggy"): the target
    // interval stretches to 1.5x the measured pass cost, capped at 1s —
    // a Helio-class GPU taking 400ms/pass self-throttles to ~1.6Hz
    // instead of saturating its own render thread; desktop stays at the
    // 250ms floor. Interpolation keeps the patch moving either way.
    var lastPassMs = 0;
    // Gender pacing: crops+gender run when this much time has passed;
    // position-only passes in between (see cadence note above).
    var lastZoomAt = 0;
    // Zero-readback (plan-blur-v2 Stage 1): the person pass feeds the
    // VIDEO ELEMENT straight into fromPixels (texture upload, in-graph
    // resize) — no 2D canvas, no getImageData sync readback. If that
    // path ever errors non-fatally (driver quirk), the canvas fallback
    // takes over permanently for this video.
    var directPersonOk = true;
    var personCanvas = null;
    function ensurePersonCanvas() {
      if (!personCanvas) {
        personCanvas = document.createElement('canvas');
        personCanvas.width = detector.PERSON_INPUT_SIZE;
        personCanvas.height = detector.PERSON_INPUT_SIZE;
      }
      return personCanvas;
    }
    function personPixelSource() {
      if (directPersonOk) return video;
      var pc = ensurePersonCanvas();
      var pctx = pc.getContext('2d');
      pctx.drawImage(video, 0, 0, detector.PERSON_INPUT_SIZE, detector.PERSON_INPUT_SIZE);
      return pctx.getImageData(0, 0, detector.PERSON_INPUT_SIZE, detector.PERSON_INPUT_SIZE);
    }
    // Scene gate (scene-gate.mjs): 16x16 luma thumbnail classifies the
    // player's motion. 'cut' forces an immediate pass + gender read;
    // 'static' relaxes cadence toward 1Hz — but ONLY while no track is
    // blurred (a blurred track is mid-verdict: its clear credit and any
    // drifting subject need full cadence — plan-blur-v2 risk register).
    var GATE_INTERVAL_MS = 100;
    var gateCanvas = null;
    var prevLuma = null;
    var lastGateAt = 0;
    var lastCutAt = 0;
    var sceneState = 'motion';
    function gateTick(now) {
      if (now - lastGateAt < GATE_INTERVAL_MS) return;
      lastGateAt = now;
      try {
        if (!gateCanvas) {
          gateCanvas = document.createElement('canvas');
          gateCanvas.width = sceneGate.GATE_SIZE;
          gateCanvas.height = sceneGate.GATE_SIZE;
        }
        var g = gateCanvas.getContext('2d', { willReadFrequently: true });
        g.drawImage(video, 0, 0, sceneGate.GATE_SIZE, sceneGate.GATE_SIZE);
        var d = g.getImageData(0, 0, sceneGate.GATE_SIZE, sceneGate.GATE_SIZE).data;
        var n = sceneGate.GATE_SIZE * sceneGate.GATE_SIZE;
        var cur = sceneGate.lumaGrid(d, n);
        if (prevLuma) sceneState = sceneGate.classifyScene(sceneGate.meanAbsDelta(prevLuma, cur));
        prevLuma = cur;
      } catch (e) {
        // Tainted canvas: the gate goes inert ('motion' = no behaviour
        // change); the main path's own taint handling decides giveUp.
        sceneState = 'motion';
      }
      if (sceneState === 'cut' && now - lastCutAt >= sceneGate.CUT_MIN_GAP_MS) {
        lastCutAt = now;
        // A cut is where new people appear: bypass the interval AND
        // force the next pass to re-read gender, not just positions.
        lastSample = 0;
        lastZoomAt = 0;
        // Positions are MEANINGLESS across a cut — IoU association would
        // glue the old shot's blur states onto whoever stands nearest in
        // the new shot (owner 2026-08-24: subjects "switching one
        // another" between shots). Fresh tracks: everyone in the new
        // shot starts covered, verdicts re-read this same pass. The old
        // overlays stay up until the pass lands (blur-first holds); the
        // cost is a cleared person re-earning their clear after each
        // cut — the fail-safe direction.
        videoTracks = [];
      }
    }
    function anyBlurredTrack() {
      for (var i = 0; i < videoTracks.length; i++) {
        if (videoTracks[i].state === 'blurred') return true;
      }
      return false;
    }
    // Per-person face/gender crop (the audit's person-primary pass): the
    // person's region cropped at NATIVE resolution, aspect-preserving
    // (square-stretch distorted faces and flipped gender reads — live
    // regression 2026-08-24). This is the ONLY face/gender path for the
    // player: small faces fill the model input by construction, so the
    // old full-frame pass, rescue floor and native recheck are gone.
    // 224 matches the gender model's input exactly — a bigger crop was
    // pure readback cost; 3 persons/pass caps the worst-case burst
    // (owner phone 2026-08-24 "very laggy").
    var ZOOM_CROP_SIZE = 224;
    var ZOOM_MAX_PERSONS = 3;
    var zoomCanvas = null;
    // createImageBitmap(video, crop, {resize}) crops + scales GPU-side
    // and feeds fromPixels directly — the zoom pass's getImageData
    // readback is gone (plan-blur-v2 Stage 1). Canvas path stays as the
    // runtime fallback for WebViews without it.
    var hasImageBitmap = typeof createImageBitmap === 'function';

    // Crop pixels for one person's region: ImageBitmap where supported,
    // else the old canvas + getImageData. Both aspect-preserving
    // (square-stretch distorted faces — live regression 2026-08-24).
    function cropPersonPixels(region) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var sw = Math.max(1, (region.x2 - region.x1) * vw);
      var sh = Math.max(1, (region.y2 - region.y1) * vh);
      var scale = ZOOM_CROP_SIZE / Math.max(sw, sh);
      var dw = Math.max(32, Math.round(sw * scale));
      var dh = Math.max(32, Math.round(sh * scale));
      if (hasImageBitmap) {
        return createImageBitmap(video, region.x1 * vw, region.y1 * vh, sw, sh, {
          resizeWidth: dw,
          resizeHeight: dh,
        });
      }
      if (!zoomCanvas) zoomCanvas = document.createElement('canvas');
      zoomCanvas.width = dw;
      zoomCanvas.height = dh;
      var zctx = zoomCanvas.getContext('2d');
      zctx.drawImage(video, region.x1 * vw, region.y1 * vh, sw, sh, 0, 0, dw, dh);
      return Promise.resolve(zctx.getImageData(0, 0, dw, dh));
    }

    // One person's observation: face+gender read from their crop.
    // No face at all = backside/turned-away = unknown ⇒ covered.
    function observePerson(person) {
      var region = personCropRegion(person);
      var obs = { box: person, flagged: true, certain: false };
      var zpix = null;
      function done(result) {
        if (zpix && typeof zpix.close === 'function') zpix.close();
        return result;
      }
      return cropPersonPixels(region)
        .then(function (pix) {
          zpix = pix;
          return observeCropped(zpix);
        })
        .then(done)
        .catch(function () {
          // Unreadable crop (taint rejects createImageBitmap, sync
          // canvas throw rejects here too): unknown ⇒ covered.
          return done(obs);
        });

      function observeCropped(zpix) {
        return detector.detectFaceBoxes(model, zpix).then(function (faces) {
          if (!faces.length) return obs;
          var faceDesc = null;
          var metaP = genderModel
            ? detector.classifyFaceGenders(genderModel, zpix, faces).then(function (genders) {
                // Identity descriptor of the crop's PRIMARY face (the
                // highest-confidence detection = this person; extra
                // faces are usually the neighbour leaking in).
                if (genders.length) faceDesc = genders[0].desc || null;
                return faceMeta(userGender, genders);
              })
            : Promise.resolve(
                faces.map(function () {
                  return { flagged: true, certain: false };
                })
              );
          return metaP.then(function (meta) {
            // Any flagged face in the crop flags the person; the person
            // clears only when EVERY face read confidently clear (a
            // second face in the crop is usually the neighbour leaking
            // in — never a licence to unblur this one).
            var flagged = false;
            var anyCertainFlag = false;
            var allCertainClear = true;
            for (var m = 0; m < meta.length; m++) {
              if (meta[m].flagged) {
                flagged = true;
                if (meta[m].certain) anyCertainFlag = true;
              }
              if (meta[m].flagged || !meta[m].certain) allCertainClear = false;
            }
            return {
              box: person,
              flagged: flagged,
              certain: flagged ? anyCertainFlag : allCertainClear,
              desc: faceDesc,
            };
          });
        });
      }
    }

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
      videoTracks = [];
      lastPassAt = 0;
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
      // Scene gate first: a hard cut zeroes lastSample/lastZoomAt so
      // the checks below let this very call through at full depth.
      if (isPlayer) gateTick(now);
      var floor = sampleInterval;
      if (isPlayer && sceneState === 'static' && !anyBlurredTrack()) {
        // Nothing changing on screen and nothing mid-verdict: ~1Hz
        // safety-net cadence (plan-blur-v2 Stage 1).
        floor = sceneGate.STATIC_INTERVAL_MS;
      }
      var effInterval = isPlayer
        ? Math.min(1000, Math.max(floor, lastPassMs * 1.5))
        : sampleInterval;
      if (now - lastSample < effInterval) return;
      if (sampling) return;
      lastSample = now;
      sampling = true;

      // PERSON-PRIMARY player path (redesign 2026-08-24): MoveNet finds
      // the persons, each person's native-res crop decides their gender,
      // the tracker + state machine decide the patches. ONE pass, one
      // cadence — the person is the unit of blur, the face only reads
      // gender, and non-persons never enter the pipeline (the entire
      // phantom class the old gates chased is excluded by construction).
      if (useRegionVideo && personModel) {
        try {
          detector
            .detectPersons(personModel, personPixelSource())
            .then(function (persons) {
              // Probe-visible pass marker (verification probes read this).
              window.__TS_GAZE_PERSONS = persons.length;
              var picked = persons.slice(0, ZOOM_MAX_PERSONS);
              // Position-only pass: skip the crops+gender, just move the
              // tracks (verdict state untouched in the tracker).
              if (now - lastZoomAt < ZOOM_INTERVAL_MS) {
                return picked.map(function (p) {
                  return { box: p, positionOnly: true };
                });
              }
              // Clear credit accrues by the GAP between gender reads,
              // not the (shorter) pass interval — otherwise the split
              // cadence would silently triple the clear hold. Clamped
              // so the first-ever read can't dump seconds of credit.
              var verdictDt = Math.min(1000, lastZoomAt ? now - lastZoomAt : sampleInterval);
              lastZoomAt = now;
              // Close-up fallback (owner frame 2026-08-24: extreme
              // close-up of the daughter, MoveNet 0 persons, fully
              // exposed — MoveNet needs body context a close-up doesn't
              // have): a full-frame face pass backstops the person pass
              // on every verdict tick; faces outside every person box
              // become synthetic person observations (face expanded to
              // body). Zero-readback too (fromPixels(video) direct).
              return detector
                .detectFaceBoxes(model, directPersonOk ? video : personPixelSource())
                .then(function (faces) {
                  var extra = [];
                  for (var f = 0; f < faces.length && extra.length < 2; f++) {
                    if (!faceInsideAny(faces[f], persons)) extra.push(expandToBody(faces[f]));
                  }
                  return picked.concat(extra);
                })
                .catch(function () {
                  // Fallback pass failed — the person pass still stands.
                  return picked;
                })
                .then(function (all) {
                  var observations = [];
                  var chain = Promise.resolve();
                  all.forEach(function (p) {
                    // Serial, not parallel: one GPU queue, smaller bursts.
                    chain = chain.then(function () {
                      return observePerson(p).then(function (obs) {
                        obs.verdictDt = verdictDt;
                        // Identity memory: a face matching someone who
                        // already earned a full clear this video
                        // inherits it (person-track.mjs honors this
                        // only when the current read agrees).
                        obs.remembered = memoryLookup(obs.desc);
                        observations.push(obs);
                      });
                    });
                  });
                  return chain.then(function () {
                    return observations;
                  });
                });
            })
            .then(function (observations) {
              if (failed || dead) return;
              var dt = lastPassAt ? now - lastPassAt : sampleInterval;
              lastPassAt = now;
              videoTracks = updatePersonTracks(videoTracks, observations, dt);
              memoryStore(videoTracks);
              // Hysteresis boundary: patches follow track STATE, which
              // only ever flips instantly toward blur; the clear
              // direction needs CLEAR_HOLD_MS of continuous confident
              // reads (person-track.mjs). No per-sample recomputation
              // flicker — the audit's core hit-and-miss fix.
              var render = blurredTracks(videoTracks);
              if (render.length) {
                // setTracks false = player host vanished — whole blur,
                // no person may be exposed.
                if (videoRegion.setTracks(video, render)) {
                  video.classList.remove(dom.PENDING_CLASS, dom.FLAGGED_CLASS);
                  track(video);
                  regionActive = true;
                } else {
                  markFlagged(video);
                }
              } else {
                clearEl(video);
                videoRegion.clear(video);
                regionActive = false;
              }
            })
            .catch(function (e) {
              if (e && e.name === 'SecurityError') {
                // Tainted source (cross-origin, no CORS): permanent for
                // this stream — fail open, same as the canvas path.
                giveUp('tainted source', e);
                return;
              }
              if (directPersonOk) {
                // Direct fromPixels(video) hit a driver quirk — retry
                // next pass through the canvas fallback (plan-blur-v2
                // Stage 1 risk register).
                directPersonOk = false;
              }
              // Cannot verify this pass — tracks coast, patches hold.
              // eslint-disable-next-line no-console
              console.warn('tamescroll gaze: person pass failed', e);
            })
            .finally(function () {
              lastPassMs = performance.now() - now;
              sampling = false;
            });
        } catch (e) {
          // A sync throw from drawImage/getImageData is the tainted-
          // canvas case: permanent for this element — fail open.
          sampling = false;
          giveUp('tainted canvas', e);
        }
        return;
      }

      // Whole-blur path (feed videos, no player host / no backdrop-
      // filter, person model still loading or failed): full-frame faces
      // + clean streak. A player waiting on the person model sits here
      // briefly — blur-first already covers it, and the region path
      // takes over the moment the model lands.
      try {
        var canvas = ensureVideoCanvas();
        var ctx2d = canvas.getContext('2d');
        ctx2d.drawImage(video, 0, 0, detector.INPUT_SIZE, detector.INPUT_SIZE);
        var pixels = ctx2d.getImageData(0, 0, detector.INPUT_SIZE, detector.INPUT_SIZE);
        detector
          .detectFaceBoxes(model, pixels)
          .then(function (faces) {
            if (!faces.length || !genderModel) {
              return faces.length > 0;
            }
            return detector.classifyFaceGenders(genderModel, pixels, faces).then(function (genders) {
              var meta = faceMeta(userGender, genders);
              for (var mi = 0; mi < meta.length; mi++) {
                if (meta[mi].flagged) return true;
              }
              return false;
            });
          })
          .then(function (anyFlagged) {
            if (failed) return;
            if (anyFlagged) {
              cleanStreak = 0;
              markFlagged(video);
            } else {
              cleanStreak++;
              if (cleanStreak >= unblurStreak) clearEl(video);
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
    // Paused = nothing moves: zero the velocities and re-pin, or the
    // overlay extrapolator would keep sliding/scaling patches over a
    // frozen frame (owner edge-case ask 2026-08-24).
    video.addEventListener('pause', function () {
      for (var i = 0; i < videoTracks.length; i++) {
        videoTracks[i].vx = 0;
        videoTracks[i].vy = 0;
        videoTracks[i].vw = 0;
        videoTracks[i].vh = 0;
      }
      if (regionActive) videoRegion.setTracks(video, blurredTracks(videoTracks));
    });

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
      videoTracks = [];
      lastPassAt = 0;
      // New stream = new scene: forget the luma baseline and re-enable
      // the direct pixel path (a per-stream quirk shouldn't outlive it).
      prevLuma = null;
      sceneState = 'motion';
      lastCutAt = 0;
      directPersonOk = true;
      identityMemory = [];
      if (!playerBlurOn) {
        playerBlurOn = true;
        if (pillRefresh) pillRefresh();
      }
      markPending(video);
      if (!video.paused) start();
    });

    var pillHost = isPlayer ? (video.closest && video.closest('#movie_player')) || null : null;
    if (pillHost) {
      // In-player toggle (owner ask): a wrong live verdict must be one
      // tap from gone. Lives INSIDE the player container so element
      // fullscreen keeps it visible (fixed-position elements outside
      // the fullscreen element are not rendered). ALWAYS visible on the
      // player (owner 2026-08-24: it is the whole-video blur switch, so
      // it must not vanish when nothing is currently covered); it is our
      // own control, not a platform nag, so NO NAGS is not in play.
      // Styled as a visible SWITCH (owner 2026-08-24: "needs a thing
      // that shows so people know it's a toggle") — label + track +
      // sliding knob, sized for touch (36px tall hit area on mobile).
      pill = document.createElement('button');
      pill.type = 'button';
      pill.style.cssText =
        'position:absolute;top:48px;right:8px;z-index:2147483645;' +
        'display:flex;align-items:center;gap:7px;' +
        'background:rgba(0,0,0,.55);color:#fff;font:500 12px system-ui;' +
        'padding:8px 12px;border:none;border-radius:999px;opacity:.85;' +
        'cursor:pointer;pointer-events:auto;min-height:36px;';
      var pillLabel = document.createElement('span');
      var pillTrack = document.createElement('span');
      pillTrack.style.cssText =
        'position:relative;width:30px;height:16px;border-radius:999px;' +
        'background:#4a4;transition:background .15s;flex:none;';
      var pillKnob = document.createElement('span');
      pillKnob.style.cssText =
        'position:absolute;top:2px;left:16px;width:12px;height:12px;' +
        'border-radius:50%;background:#fff;transition:left .15s;';
      pillTrack.appendChild(pillKnob);
      pill.appendChild(pillLabel);
      pill.appendChild(pillTrack);
      var pillPaint = function () {
        pillLabel.textContent = playerBlurOn ? 'Blur on' : 'Blur off';
        pillTrack.style.background = playerBlurOn ? '#4a4' : '#777';
        pillKnob.style.left = playerBlurOn ? '16px' : '2px';
      };
      pillPaint();
      pillRefresh = pillPaint;
      pill.addEventListener('click', function (e) {
        e.stopPropagation();
        playerBlurOn = !playerBlurOn;
        pillPaint();
        if (playerBlurOn) {
          cleanStreak = 0;
          videoTracks = [];
          lastPassAt = 0;
          markPending(video);
          if (!video.paused) start();
        } else {
          clearEl(video);
          videoRegion.clear(video);
          regionActive = false;
          videoTracks = [];
          lastPassAt = 0;
        }
      });
      pillHost.appendChild(pill);
      var pillWatch = setInterval(function () {
        if (!video.isConnected || failed) {
          clearInterval(pillWatch);
          if (pill.parentNode) pill.parentNode.removeChild(pill);
        }
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
          // Person model THIRD (redesign 2026-08-24): the player's
          // region path is person-primary now, so the model a playing
          // video is waiting on outranks NSFW (which only ever ADDS
          // removals). Failure degrades the player to whole blur.
          return detector
            .loadPersonModel()
            .then(
              function (person) {
                personModel = person;
              },
              function (e) {
                // eslint-disable-next-line no-console
                console.warn('tamescroll gaze: person model unavailable, whole-blur player', e);
              }
            )
            .then(function () {
              // NSFW last. Images verified face-clean before it arrives
              // were cleared under face-only rules — acceptable:
              // blur-first already held while they were pending, and the
              // next src swap re-checks.
              return detector.loadNsfwModel().then(
                function (nsfw) {
                  nsfwModel = nsfw;
                },
                function (e) {
                  // Degrade to face-only, loudly but harmlessly.
                  // eslint-disable-next-line no-console
                  console.warn('tamescroll gaze: nsfw model unavailable, face-only', e);
                }
              );
            })
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
