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
import {
  flaggedFaceIndices,
  faceMeta,
  isNullRead,
  FACE_MIN_NATIVE_PX,
} from './gender-verdict.mjs';
import { personCropRegion, personFromFace, lastSlotDiag } from './person-gate.mjs';

// CROP-BUDGET PRIORITY. `confidence` is NOT one scale: a MoveNet person
// carries the model's slot score and a personFromFace body carries
// BlazeFace's face confidence. Measured on the R18 classroom, same run:
// skeletal persons score 0.057-0.321 while synthetic bodies score
// 0.35-0.93, so sorting the two together puts EVERY face-derived body
// above EVERY real person, every pass. That was latent while `all.length`
// stayed at or below ZOOM_MAX_PERSONS and everybody got a read anyway; the
// weak tier pushes it to 5-6 and the sort starts deciding who is starved.
//
// Who it starves is the problem. A face-derived body already HAS its face
// (R16 gave it faceBox, so it no longer re-detects), whereas a skeletal
// person's read is the only way they can ever accumulate the consecutive
// same-gender reads a clear requires. The adult woman teaching this class
// is a skeletal person at 0.18-0.32 and she is FALSE COVER on 10 of 10
// frames with cs:0 on every track — outranked by construction.
//
// So: compare within a population, not across. Skeletal persons first,
// then synthetic bodies, each ordered by their own confidence. This is
// not a claim that a skeleton beats a face as evidence — it is a refusal
// to pretend two different measurements are one number.
function cropPriority(a, b) {
  var aSyn = a && a.fromFace ? 1 : 0;
  var bSyn = b && b.fromFace ? 1 : 0;
  if (aSyn !== bSyn) return aSyn - bSyn;
  return (b.confidence || 0) - (a.confidence || 0);
}

import {
  updatePersonTracks,
  wipeIfEmpty,
  setVerdictCadence,
  blurredTracks,
  demoteTracks,
  cosineSim,
  bumpLife,
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
  window.__TS_GAZE_BUNDLE__ = 'v7'; // v7: crowd path (faces past MoveNet's 6) + no cut blackout

  // EFFECTIVE VALUES OF THE GATING CONSTANTS, published once at boot.
  // R15 found FACE_MIN_NATIVE_PX emitted by the minifier as `var IY;` with
  // no initializer, so the size gate compared against `undefined` and had
  // never fired in any shipped bundle — invisible for six rounds because
  // nothing in the artifact said what the thresholds actually WERE, only
  // what the source claimed. A constant that goes dead now shows up as
  // `null` in the next round's meta.json. Wrapped because a probe must
  // never be able to throw inside the pipeline.
  try {
    var dbgC = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
    dbgC.cfg = {
      faceMinPx: FACE_MIN_NATIVE_PX,
      faceMinConf: detector.FACE_MIN_CONFIDENCE,
    };
  } catch (e) {}

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
    // PiP surfaces the RAW stream in a window our overlays can't follow
    // (review C8) — close the hole where supported.
    if (isPlayer && 'disablePictureInPicture' in video) {
      try {
        video.disablePictureInPicture = true;
      } catch (e) {
        /* not supported — nothing to close */
      }
    }

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
    // Persons admitted by the LAST person pass, fed back into
    // parsePersons as its hysteresis input (R17). Continuity of the
    // DETECTOR, not of a verdict: it is dropped wherever positions stop
    // meaning what they meant — cut, seek, loadstart, stream change —
    // and holding it one pass too long can only re-admit a box that is
    // still geometrically where it was.
    var heldPersons = [];
    window.__TS_SAMPLERS = (window.__TS_SAMPLERS || 0) + 1;
    var samplerId = window.__TS_SAMPLERS;
    // Ceiling on a single person's verdict work before it is abandoned
    // as unknown (⇒ covered). Registered in docs/detection-engine.md.
    var VERDICT_TIMEOUT_MS = 900;
    var lastPassAt = 0;
    // IDENTITY MEMORY WAS DELETED IN R13. Do not rebuild it without
    // reading this first — it was the owner's own idea (2026-08-24,
    // "keep the person in memory and always blur her/him"), it sounded
    // obviously right, and it shipped. It was measured for three rounds
    // and it does not work, for a reason that is structural rather than
    // a bad threshold:
    //
    //   * The match was a MAX over a bank that only ever grew. Max of k
    //     draws is non-decreasing in k, so the best-match score rises
    //     with bank size BY CONSTRUCTION, independently of who is on
    //     screen. Measured across one 15s window: the best-match FLOOR
    //     climbed from 0.00 (bank of 2) to 0.68 (bank of 6+), against a
    //     threshold of 0.85.
    //   * The bank saturated at MEM_MAX 8 within ~15 seconds of two
    //     people being on screen, and in R13's run it was already at the
    //     cap on the FIRST captured frame.
    //   * The descriptor cannot separate identity at this operating
    //     point at all: docs/detection-engine.md registers 17% of
    //     DIFFERENT-person pairs scoring >=0.9, against a same-person
    //     5th percentile of 0.28. Those distributions overlap across
    //     their whole useful range, so there is no threshold to move to
    //     — with 8 entries x 3 exemplars the false-match probability is
    //     ~1-(1-0.17)^24, i.e. essentially certain.
    //
    // Put together: given a few seconds of video, memory returns
    // "blurred" for almost any face, and the entry doing the covering
    // usually belongs to someone else. R11 measured the end state — a
    // woman reading a CERTAIN CLEAR stayed covered for all ten frames
    // while the bank sat pinned at the cap. That is the mechanism behind
    // the owner's oldest complaint, "why does it keep blurring me": in
    // man mode the bank fills with women and then re-covers HIM.
    //
    // What removing it costs, honestly, because it is not zero: a person
    // who was once read as certainly opposite-gender and who now reads
    // UNCERTAIN no longer gets re-covered on someone else's cleared
    // track. That case is a person swap, which is an identity question,
    // and the measurement above says this descriptor cannot answer it.
    // It is instead bounded by the two mechanisms that do not depend on
    // recognising anybody: a new track always starts blurred, and a
    // cleared track is revoked by CLEARED_TTL_MS or by two abstained
    // reads (see `abstained` in gender-verdict.mjs).
    // Face center inside any (padded) person box — used to keep the
    // full-frame face fallback from duplicating a MoveNet person.
    // Which admitted person's box contains this face's centre, or -1.
    // Returns the INDEX rather than a boolean because one person box can
    // contain several people's faces and only one of them is that person
    // — see faceOwnerIndex's caller for what the rest are worth.
    function faceInsideIndex(face, persons) {
      var cx = (face.x1 + face.x2) / 2;
      var cy = (face.y1 + face.y2) / 2;
      for (var i = 0; i < persons.length; i++) {
        var p = persons[i];
        var pw = (p.x2 - p.x1) * 0.1;
        var ph = (p.y2 - p.y1) * 0.1;
        if (cx >= p.x1 - pw && cx <= p.x2 + pw && cy >= p.y1 - ph && cy <= p.y2 + ph) return i;
      }
      return -1;
    }
    function faceInsideAny(face, persons) {
      return faceInsideIndex(face, persons) !== -1;
    }
    // ADAPTIVE cadence (owner phone 2026-08-24 "very laggy"): the target
    // interval stretches to 1.5x the measured pass cost, capped at 1s —
    // a Helio-class GPU taking 400ms/pass self-throttles to ~1.6Hz
    // instead of saturating its own render thread; desktop stays at the
    // 250ms floor. Interpolation keeps the patch moving either way.
    var lastPassMs = 0;
    // Verdict passes are ~5-10x a position pass; mixing their cost into
    // lastPassMs throttled the CHEAP passes to ~1Hz after every verdict
    // tick (review A11) — the two costs adapt separately: position cost
    // drives the pass floor, verdict cost stretches the zoom interval.
    var lastVerdictMs = 0;
    // Gender pacing: crops+gender run when this much time has passed;
    // position-only passes in between (see cadence note above).
    var lastZoomAt = 0;
    // In-flight guard for the VERDICT pass (crops + gender + descriptor).
    // MEASURED 2026-08-25 on the dev app: verdict passes were issued
    // every ~400ms but only ~0.5/s actually completed, so five of them
    // stacked on the single WebGL queue and each new one made the
    // backlog worse. 51 issued / 12 completed in 22s — the tracker saw
    // position updates ONLY, every person stayed at their initial
    // blurred state, and no amount of state-machine tuning could clear
    // anyone. The adaptive throttle could not help either: it keys off
    // lastVerdictMs, which is only written when a verdict COMPLETES.
    var verdictBusy = false;
    // Set by a verdict pass that found neither a person nor a face.
    var emptyFrame = false;
    // Consecutive verdict passes that saw nothing. Absence has to be
    // seen twice before it is believed — see wipeIfEmpty.
    var emptyStreak = 0;
    // Largest box height seen by this verdict pass, and by the last pass
    // that saw anything. Subject scale decides how much an empty frame is
    // worth: big subject vanishing = cut, small subject vanishing = miss.
    var passMaxBoxH = 0;
    var lastMaxBoxH = 0;
    // Backstop: a verdict pass that never reports back must not wedge
    // the guard shut for the life of the video.
    var VERDICT_STALL_MS = 4000;
    // Zero-readback (plan-blur-v2 Stage 1): the person pass feeds the
    // VIDEO ELEMENT straight into fromPixels (texture upload, in-graph
    // resize) — no 2D canvas, no getImageData sync readback. If that
    // path ever errors non-fatally (driver quirk), the canvas fallback
    // takes over permanently for this video.
    var directPersonOk = true;
    // Pass epoch (review A6): cut/seek/loadstart bump it; a pass that
    // started under an older epoch discards its result instead of
    // resurrecting pre-discontinuity people as fresh tracks.
    var passEpoch = 0;
    // Round-robin cursor for crowd scenes: which slice of a large group
    // gets a gender read this pass (everyone is tracked regardless).
    var crowdCursor = 0;
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
        if (prevLuma) {
          var lumaDelta = sceneGate.meanAbsDelta(prevLuma, cur);
          sceneState = sceneGate.classifyScene(lumaDelta);
          // THE DELTA BEHIND EVERY CUT DECISION (S10). S6's critic asked
          // for CUT_DELTA to move and was refused pending a count; S10
          // measured the cost of being wrong -- 6 of 7 revoked clears sit
          // within 0.21s of a cutDetected -- so the calibration question
          // is now load-bearing. A histogram separates "these are real
          // cuts" from "the threshold is picking up camera motion", and
          // nothing has ever recorded the value.
          try {
            var dbgL = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
            if (!dbgL.luma) dbgL.luma = [];
            dbgL.luma.push(Math.round(lumaDelta * 10) / 10);
            if (dbgL.luma.length > 600) dbgL.luma.shift();
          } catch (e) {}
        }
        prevLuma = cur;
      } catch (e) {
        // Tainted canvas: the gate goes inert ('motion' = no behaviour
        // change); the main path's own taint handling decides giveUp.
        sceneState = 'motion';
      }
      if (sceneState === 'cut' && now - lastCutAt >= sceneGate.CUT_MIN_GAP_MS) {
        lastCutAt = now;
        // COUNT THE CUTS (S6 critic finding 2). Everything downstream of
        // this branch — demoteTracks, the forced verdict, both throttle
        // bypasses below — is sized by how often it fires, and nothing
        // has ever recorded it. `cutCoastExpired` cannot be interpreted
        // without it: 10 expiries is a different story at 4 cuts than at
        // 40. Deliberately just the counter this round; the critic's
        // proposed changes to CUT_DELTA and the forced-pass gap are NOT
        // taken until this number exists on real footage.
        bumpLife('cutDetected');
        // A cut is where new people appear: bypass the interval AND
        // force the next pass to re-read gender, not just positions.
        lastSample = 0;
        lastZoomAt = 0;
        // Positions are MEANINGLESS across a cut — IoU association would
        // glue the old shot's blur states onto whoever stands nearest in
        // the new shot (owner 2026-08-24: subjects "switching one
        // another"). DEMOTE, don't wipe (review C2): boxes persist so
        // coverage holds through the pass gap, but every verdict state
        // resets to blurred — identity memory, not stale association,
        // decides who re-clears.
        videoTracks = demoteTracks(videoTracks);
        // Same reasoning one level down: positions are meaningless
        // across a cut, so the detector's own continuity goes with them.
        // Holding a pre-cut box open would re-admit a slot sitting where
        // somebody USED to stand — a GHOST, which the owner counts.
        heldPersons = [];
        passEpoch++;
        // NO whole-frame blackout here. Measured 2026-08-25: cuts fire
        // every ~2.8s on ordinary edited video, so blacking out the
        // frame until the forced pass landed meant the player spent
        // most of its life fully blurred — the loudest form of "not
        // accurate". Existing patches persist through the gap instead
        // (demoteTracks keeps the boxes), and the forced pass is
        // already at the front of the queue.
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

    // Tile-recall probe (R16). Runs the SAME detector over a 2x2 grid of
    // native-resolution quadrants and reports how many faces that finds
    // against the single full-frame pass, plus what it cost. Nothing here
    // feeds the pipeline: it exists so the tiling decision is made on
    // numbers from real footage rather than on the arithmetic of
    // 1920 -> 256. Guarded end to end — instrumentation has killed two
    // releases here and does not get to kill a third.
    var tileProbeBusy = false;
    function tileProbe(baseCount) {
      if (tileProbeBusy) return;
      tileProbeBusy = true;
      var t0 = performance.now();
      var quads = [
        { x1: 0, y1: 0, x2: 0.55, y2: 0.55 },
        { x1: 0.45, y1: 0, x2: 1, y2: 0.55 },
        { x1: 0, y1: 0.45, x2: 0.55, y2: 1 },
        { x1: 0.45, y1: 0.45, x2: 1, y2: 1 },
      ];
      var found = [];
      var chain = Promise.resolve();
      quads.forEach(function (q) {
        chain = chain.then(function () {
          return cropPersonPixels(q)
            .then(function (pix) {
              return detector.detectFaceBoxes(model, pix).then(function (fs) {
                if (pix && typeof pix.close === 'function') pix.close();
                var qw = q.x2 - q.x1;
                var qh = q.y2 - q.y1;
                for (var i = 0; i < fs.length; i++) {
                  found.push({
                    x1: q.x1 + fs[i].x1 * qw,
                    y1: q.y1 + fs[i].y1 * qh,
                    x2: q.x1 + fs[i].x2 * qw,
                    y2: q.y1 + fs[i].y2 * qh,
                  });
                }
              });
            })
            .catch(function () {});
        });
      });
      chain.then(function () {
        // Quadrants overlap by 10% so a face on a seam is not cut in two;
        // dedupe what that double-counts.
        var uniq = [];
        for (var i = 0; i < found.length; i++) {
          var dup = false;
          for (var j = 0; j < uniq.length; j++) {
            if (boxIou(found[i], uniq[j]) > 0.3) {
              dup = true;
              break;
            }
          }
          if (!dup) uniq.push(found[i]);
        }
        var ms = Math.round(performance.now() - t0);
        try {
          var dbgP = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
          dbgP.tile = (dbgP.tile || [])
            .concat([{ base: baseCount, tiled: uniq.length, ms: ms }])
            .slice(-12);
        } catch (e) {}
        tileProbeBusy = false;
      });
    }

    function boxIou(a, b) {
      var ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
      var iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
      var inter = ix * iy;
      var ua = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
      return ua > 0 ? inter / ua : 0;
    }

    // One person's observation: face+gender read from their crop.
    // No face at all = backside/turned-away = unknown ⇒ covered.
    function observePerson(person) {
      var region = personCropRegion(person);
      var obs = { box: person, flagged: true, certain: false, faceFound: false };
      var zpix = null;
      var zpixRef = null;
      function done(result) {
        if (zpix && typeof zpix.close === 'function') zpix.close();
        return result;
      }
      // WATCHDOG (measured 2026-08-25): createImageBitmap on the live
      // <video> can hang without ever settling — not reject, HANG. The
      // per-person verdict chain is serial, so ONE hung crop stalled the
      // whole pass forever, and a CDP run showed 38 of 49 verdict passes
      // never reaching the tracker: every person stayed at their initial
      // blurred state for the life of the video. That is exactly the
      // owner's "Linus is not clearing at all". A verdict that hasn't
      // landed within VERDICT_TIMEOUT_MS is abandoned as unknown (⇒
      // covered, the fail-safe direction) so the NEXT pass still runs.
      var settled = false;
      var work = cropPersonPixels(region)
        .then(function (pix) {
          zpix = pix;
          return observeCropped(zpix);
        })
        .then(done)
        .catch(function () {
          // Unreadable crop (taint rejects createImageBitmap, sync
          // canvas throw rejects here too): unknown ⇒ covered.
          return done(obs);
        })
        .then(function (r) {
          settled = true;
          return r;
        });
      return Promise.race([
        work,
        new Promise(function (resolve) {
          setTimeout(function () {
            if (settled) return;
            var dbgW = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
            dbgW.timeouts = (dbgW.timeouts || 0) + 1;
            resolve(obs);
          }, VERDICT_TIMEOUT_MS);
        }),
      ]);

      // NATIVE-RES face crop for the gender read (owner 2026-08-25 "still
      // not accurate" + the gender model swaying all night). Detection
      // runs on the 224px person crop, which is fine for FINDING a face
      // — but the face inside it is often only 40-60px, and feeding that
      // to faceres meant classifying an upscaled blur. HaramBlur reads
      // the FACE crop; so do we now: the winning face box is mapped back
      // to video coordinates and re-cut from the source at 224px.
      // MEASURED R10 (runs/r10-woman): a woman lecturer 33 native pixels
      // wide was handed to faceres as a 135x68 smear inside a 224 frame,
      // and the model answered with a CONSTANT — raw sigmoid 0.635 +- 0.02
      // across 24 reads of four different subjects, with the age head
      // simultaneously pinned at its training prior (36.9 +- 1.4 on a hall
      // of undergraduates). Two heads returning their priors at once is
      // what "no signal" looks like. That constant is labelled `male`,
      // which is inert in man mode but a CERTAIN flag in woman mode, so
      // every woman in the shot was covered, permanently, on all ten
      // frames.
      //
      // Half of that was our own chain. The face box comes back SQUARE IN
      // MODEL SPACE (detector.js squarifies against a 256x256 resize of a
      // non-square crop), so composing it through rw/rh here produced a
      // region whose native-pixel aspect was the person box's aspect —
      // 2.36:1 on a standing figure. `cropPersonPixels` preserves that,
      // and `classifyFaceGenders` then stretches it back to 224x224. The
      // face arrived at the model stretched more than twice as wide as it
      // really is.
      //
      // So build the region SQUARE IN NATIVE PIXELS. `min(w,h)` is the
      // honest side: the squarify used `max` on the STRETCHED axis, so the
      // short side is the one that survived the stretch unscaled and still
      // carries the true FACE_ENLARGE'd face size. Centre it on the box
      // centre and clamp to the frame.
      function faceRegionInVideo(faceBox) {
        // faceBox is normalized to the person crop; region is normalized
        // to the frame. Compose the two.
        var rw = region.x2 - region.x1;
        var rh = region.y2 - region.y1;
        var x1 = region.x1 + faceBox.x1 * rw;
        var y1 = region.y1 + faceBox.y1 * rh;
        var x2 = region.x1 + faceBox.x2 * rw;
        var y2 = region.y1 + faceBox.y2 * rh;
        var vw = video.videoWidth || 0;
        var vh = video.videoHeight || 0;
        if (!vw || !vh) return { x1: x1, y1: y1, x2: x2, y2: y2 };
        // Work in native pixels — the whole bug is that normalized units
        // hide the frame aspect (third time in this codebase: see
        // personFromFace and person-gate's own header).
        var side = Math.min((x2 - x1) * vw, (y2 - y1) * vh);
        var hx = ((x1 + x2) / 2) * vw;
        var hy = ((y1 + y2) / 2) * vh;
        var half = side / 2;
        return {
          x1: Math.max(0, (hx - half) / vw),
          y1: Math.max(0, (hy - half) / vh),
          x2: Math.min(1, (hx + half) / vw),
          y2: Math.min(1, (hy + half) / vh),
          // Native side length, so the caller can decide whether there are
          // enough real pixels to be worth asking about.
          nativePx: side,
        };
      }
      // Asking below FACE_MIN_NATIVE_PX is worse than not asking: the null
      // answer arrives labelled `male` with a score that clears
      // GENDER_MIN_SCORE and therefore counts as CERTAIN — certain enough
      // to condemn a woman or revoke an earned clear, all on zero
      // information. The constant itself lives in gender-verdict.mjs; see
      // the comment there for why a function-local `var` could not.

      function genderFromNativeFace(faceBox) {
        var fr = faceRegionInVideo(faceBox);
        // ABSTAIN rather than guess. 'unknown' is not a third verdict —
        // faceMeta already turns an undirected read into
        // {flagged:true, certain:false}, i.e. exactly the honest state a
        // person with no visible face gets. The subject stays COVERED
        // (blur-first is unchanged); what changes is that an unresolvable
        // face may no longer revoke a clear or poison memory.
        if (fr.nativePx && fr.nativePx < FACE_MIN_NATIVE_PX) {
          // Stamp px on the REFUSAL too. R15 turned this gate on and the
          // artifact promptly lost the very number that justifies it —
          // sixteen reads came back `px: null`, so the next round could
          // not have re-derived the threshold from its own evidence.
          return Promise.resolve([
            { gender: 'unknown', score: 0, age: 0, desc: null, px: Math.round(fr.nativePx) },
          ]);
        }
        // The face box already carries FACE_ENLARGE context; keep it.
        return cropPersonPixels(fr).then(function (fpix) {
          return detector
            .classifyFaceGenders(genderModel, fpix, [{ x1: 0, y1: 0, x2: 1, y2: 1 }])
            .then(function (g) {
              if (fpix && typeof fpix.close === 'function') fpix.close();
              // Stamp the size the model actually saw. R11's critic could
              // not tell whether FACE_MIN_NATIVE_PX was even reachable
              // (no read ever returned 'unknown'); with px on the read
              // that is one number to look at instead of an inference.
              try {
                if (g && g.length && fr && fr.nativePx) {
                  g[0].px = Math.round(fr.nativePx);
                }
              } catch (e) {}
              return g;
            })
            .catch(function (e) {
              if (fpix && typeof fpix.close === 'function') fpix.close();
              throw e;
            });
        });
      }

      // Gender for the person: the LARGEST face gets a native-res crop
      // (the person's own face dominates their region); any additional
      // faces in the crop keep the cheap in-crop read, since they only
      // ever act as a veto on clearing.
      // Which detected face belongs to THIS person: the one whose centre
      // is nearest the MoveNet head anchor (mapped into crop space), and
      // only if it is plausibly close. Without a head anchor (person
      // facing away) fall back to the largest face, which in a crop
      // centred on this person is normally theirs.
      function ownFaceIndex(faces) {
        if (!faces.length) return -1;
        var rw = region.x2 - region.x1;
        var rh = region.y2 - region.y1;
        if (typeof person.headX === 'number' && typeof person.headY === 'number' && rw > 0 && rh > 0) {
          var hx = (person.headX - region.x1) / rw;
          var hy = (person.headY - region.y1) / rh;
          var best = -1;
          var bestD = Infinity;
          for (var i = 0; i < faces.length; i++) {
            var cx = (faces[i].x1 + faces[i].x2) / 2;
            var cy = (faces[i].y1 + faces[i].y2) / 2;
            var fw = faces[i].x2 - faces[i].x1;
            var d = Math.sqrt((cx - hx) * (cx - hx) + (cy - hy) * (cy - hy));
            // Within roughly one face-width of the head keypoint.
            if (d < bestD && d <= Math.max(0.18, fw)) {
              bestD = d;
              best = i;
            }
          }
          if (best !== -1) return best;
          return -1;
        }
        return bestIndex(faces);
      }

      function bestIndex(faces) {
        var bi = 0;
        var ba = 0;
        for (var i = 0; i < faces.length; i++) {
          var a = (faces[i].x2 - faces[i].x1) * (faces[i].y2 - faces[i].y1);
          if (a > ba) {
            ba = a;
            bi = i;
          }
        }
        return bi;
      }

      function classifyBest(faces) {
        var bigIdx = 0;
        var bigArea = 0;
        for (var fi = 0; fi < faces.length; fi++) {
          var fa = (faces[fi].x2 - faces[fi].x1) * (faces[fi].y2 - faces[fi].y1);
          if (fa > bigArea) {
            bigArea = fa;
            bigIdx = fi;
          }
        }
        var ownIdx = ownFaceIndex(faces);
        if (ownIdx !== -1) bigIdx = ownIdx;
        return genderFromNativeFace(faces[bigIdx])
          .then(function (nat) {
            if (faces.length === 1) return nat;
            // The multi-face pass that used to run here was DEAD WORK,
            // verified by reading every consumer (R7 critic F3):
            //   - `all[bigIdx] = nat[0]` overwrote the only element read;
            //   - the caller's `own === -1` branch returns without ever
            //     touching `meta`, and its `faceDesc` pick resolves to
            //     `bigIdx` too (bigIdx defaults to bestIndex);
            //   - the `own !== -1` branch reads `meta[own]`, and bigIdx
            //     was already forced to `own` above.
            // So `nat[0]` was the answer in both branches while a whole
            // extra faceres inference per neighbour face was computed and
            // thrown away — and it fired exactly on crowd and two-shot
            // crops, where the pass is already most expensive.
            //
            // It cannot simply be deleted: the caller indexes this array
            // by `own`, and a SHORT array yields undefined there, which
            // falls back to flagged:true — a silent FALSE COVER of the
            // person we just read. So the array keeps its length and the
            // faces we did not read are filled with what they honestly
            // are: unread. faceMeta turns that into covered-and-uncertain,
            // which is the blur-first default and is never consumed
            // anyway (only the attr probe prints it).
            var out = new Array(faces.length);
            for (var i = 0; i < faces.length; i++) {
              out[i] = i === bigIdx ? nat[0] : { gender: 'unknown', score: 0, age: 0, desc: null };
            }
            return out;
          })
          .catch(function () {
            // Native re-crop failed (taint/unsupported): fall back to
            // the in-crop read rather than losing the verdict.
            return detector.classifyFaceGenders(genderModel, zpixRef, faces);
          });
      }

      // A face-derived person ALREADY CARRIES ITS FACE. Re-detecting it in
      // the crop is a whole BlazeFace inference spent re-finding a box we
      // were handed, and it runs at ~2% of the model input where the
      // model's evaluation floor is ~5% (see person-gate's faceBox note),
      // so it frequently fails and costs the track its verdict as well as
      // the time. Map the known box into crop coordinates and hand it
      // straight to the same code path — ownFaceIndex, classifyBest, the
      // descriptor and the reads probe all work unchanged, because the
      // only thing that changed is where the box came from.
      function knownFaceInCrop() {
        var fb = person && person.faceBox;
        if (!fb) return null;
        var rw = region.x2 - region.x1;
        var rh = region.y2 - region.y1;
        if (!(rw > 0) || !(rh > 0)) return null;
        var box = {
          x1: (fb.x1 - region.x1) / rw,
          y1: (fb.y1 - region.y1) / rh,
          x2: (fb.x2 - region.x1) / rw,
          y2: (fb.y2 - region.y1) / rh,
          confidence: typeof person.confidence === 'number' ? person.confidence : 0.5,
        };
        // If the crop does not actually contain it, fall back to detecting
        // rather than handing the models a box outside their own pixels.
        if (!(box.x2 > 0 && box.y2 > 0 && box.x1 < 1 && box.y1 < 1)) return null;
        return [box];
      }

      function observeCropped(zpix) {
        zpixRef = zpix;
        var known = knownFaceInCrop();
        var facesP = known ? Promise.resolve(known) : detector.detectFaceBoxes(model, zpix);
        return facesP.then(function (faces) {
          if (!faces.length) return obs;
          // NO ATTRIBUTABLE FACE ⇒ DECIDE BEFORE PAYING FOR THE READ.
          //
          // `ownFaceIndex` is pure and reads only `faces` plus this
          // person's head anchor, so its answer is already knowable here.
          // It was being computed at the TOP of classifyBest and again by
          // the caller, with a full faceres inference on a fresh 224px
          // native crop in between -- and when it comes back -1 the
          // caller returns hard-covered without ever reading the result.
          // The probe at the `attr` block measured `own === -1` on 25% of
          // reads, and S9 measured the crop+gender stage at 64 of a
          // verdict pass's 102ms, so that is a quarter of the most
          // expensive stage computed and thrown away -- proportionally
          // worse on a Helio G88, which is the target.
          //
          // It also stops a real defect, not just waste: the discarded
          // path still salvaged `desc` from `bestIndex`, i.e. the LARGEST
          // face in a padded crop that R19 measured as containing more
          // than one face 19 times in 40. On a two-shot that stores the
          // NEIGHBOUR's descriptor on this person's track, which is the
          // one input `identityBroken` trusts.
          if (ownFaceIndex(faces) === -1) {
            bumpLife('ownMissSkipped');
            return { box: person, flagged: true, certain: false, faceFound: true, desc: null };
          }
          var faceDesc = null;
          var metaP = genderModel
            ? classifyBest(faces).then(function (genders) {
                // Identity descriptor comes from the natively-cropped
                // primary face (index 0 when it was the only face).
                var ownI = ownFaceIndex(faces);
                var pickI = genders.length > 1 ? (ownI === -1 ? bestIndex(faces) : ownI) : 0;
                var pick = genders[pickI];
                var pickFace = faces[pickI] || null;
                if (pick) faceDesc = pick.desc || null;
                // Calibration probe: the raw model reads behind every
                // verdict, so a CDP run can say WHY someone stays
                // covered (wrong direction vs low certainty vs age).
                // WRAPPED (R22). This block sits directly inside the
                // verdict promise chain: anything that throws in here
                // rejects the verdict for the whole person, and a probe
                // throwing inside this exact chain silently discarded
                // every gender read for two releases. The `slots` probe
                // below has always been guarded; these two were not, and
                // R22 adds fields to both — so they get the guard first.
                try {
                if (pick) {
                  var dbgR = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                  dbgR.reads = dbgR.reads || [];
                  dbgR.reads.push({
                    g: pick.gender,
                    s: Math.round(pick.score * 100) / 100,
                    a: Math.round(pick.age),
                    // Probability MASS under GENDER_ADULT_AGE, not the
                    // mean. `a` and `pc` disagreeing is the R18 finding:
                    // the mean of a bimodal age posterior lands between
                    // its two modes, so a child can read `a: 22` while
                    // most of the mass sits under 18.
                    pc: typeof pick.childP === 'number' ? Math.round(pick.childP * 100) / 100 : null,
                    n: faces.length,
                    // Raw sigmoid and the native face size behind it:
                    // the two numbers R11's critic had to infer.
                    v: typeof pick.raw === 'number' ? Math.round(pick.raw * 1000) / 1000 : null,
                    px: typeof pick.px === 'number' ? pick.px : null,
                    // Was this read REFUSED as the model's prior? Without
                    // it the abstention is invisible in the artifact —
                    // which is exactly how it shipped dead for a round.
                    // isNullRead is pure and type-guarded, so it cannot
                    // throw in here (instrumentation has killed two
                    // releases; it does not get to kill a third).
                    ab: isNullRead(pick) ? 1 : 0,
                    // BlazeFace's own confidence in the box this read came
                    // from. detectFaceBoxes has always returned it and
                    // nothing has ever looked at it; R15's dominant failure
                    // is patches built on faces that are not faces, and the
                    // detector's opinion of them is the one number that
                    // could separate those from small REAL faces without a
                    // second model. Measure before tuning FACE_MIN_CONFIDENCE.
                    fc:
                      pickFace && typeof pickFace.confidence === 'number'
                        ? Math.round(pickFace.confidence * 100) / 100
                        : null,
                    // The region this read came from, so a read can be
                    // JOINED to a patch. Fifteen rounds of artifacts have
                    // carried reads and patches side by side with no way to
                    // say which produced which — R15's f007 has one read at
                    // score 0.97, above GENDER_INSTANT_CLEAR, and a man
                    // covered anyway, and the artifact cannot say whether
                    // those are the same person.
                    b: [
                      Math.round(region.x1 * 1000) / 1000,
                      Math.round(region.y1 * 1000) / 1000,
                      Math.round(region.x2 * 1000) / 1000,
                      Math.round(region.y2 * 1000) / 1000,
                    ],
                    // THE TWO FREE NULL TESTS NOBODY HAS EVER LOOKED AT
                    // (R22). `nm` is the faceres descriptor's magnitude
                    // before L2-normalisation; `ab`/`v` already carry the
                    // 1-D null test on the gender sigmoid, and R11
                    // measured that band at a 1-D gap of 0.035 — too thin
                    // to threshold alone, which is why an orthogonal one
                    // matters. `ap` is the age posterior's SHAPE
                    // (peak bin / peak mass / entropy) beside its mean;
                    // the mean demonstrably does NOT separate a graphic
                    // from a face (title-card reads age 33-56 against a
                    // real man's 33-45, fully overlapping). Both are
                    // computed inside loops that already run.
                    nm:
                      pick.shape && typeof pick.shape.norm === 'number'
                        ? Math.round(pick.shape.norm * 100) / 100
                        : null,
                    ap: pick.shape
                      ? [
                          pick.shape.ageBin,
                          Math.round(pick.shape.ageMass * 1000) / 1000,
                          Math.round(pick.shape.ageEnt * 100) / 100,
                        ]
                      : null,
                  });
                  if (dbgR.reads.length > 300) dbgR.reads.shift();
                }
                } catch (e) {}
                return faceMeta(userGender, genders);
              })
            : Promise.resolve(
                faces.map(function () {
                  return { flagged: true, certain: false };
                })
              );
          return metaP.then(function (meta) {
            // ONE face decides this person: the one at their head.
            // Neighbours' faces routinely land in the same padded crop
            // (measured 2026-08-25: 2-3 faces per crop in a two-shot),
            // and the old "any flagged face flags the person" rule made
            // a confidently-male adult permanently blurred whenever a
            // covered person stood beside him. Each neighbour has their
            // OWN person track and is covered by it — vetoing here
            // covered the wrong people, it never added protection.
            var own = ownFaceIndex(faces);
            // WRAPPED (R22), same reason as the `reads` probe above: this
            // is inside the verdict chain, and `hx`/`hy` below divide by
            // `region.x2 - region.x1` with no positive guard while the
            // `d` IIFE right beneath them has one. `own` is read AFTER
            // the block, so the guard must not swallow its assignment.
            try {
            var dbgA = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
            dbgA.attr = dbgA.attr || [];
            dbgA.attr.push({
              own: own,
              nf: faces.length,
              // CROP-SPACE, which is the space ownFaceIndex actually
              // compares in. R18's critic caught this logging person.headX
              // in FRAME coordinates against face centres in CROP
              // coordinates, so the artifact could not check a single one
              // of the function's decisions — an example from that run
              // read `hx 0.62` against a face centre `0.65`, an apparent
              // distance of 0.036 against a 0.18 floor, which "should"
              // have matched and did not, because the two numbers were
              // not in the same space. `own === -1` hard-returns a
              // covered verdict and ran at 25% of reads, so this is a
              // first-order FALSE COVER source that has been unauditable
              // for two rounds.
              hx: person.headX === null ? null : Math.round(((person.headX - region.x1) / (region.x2 - region.x1)) * 100) / 100,
              hy: person.headY === null ? null : Math.round(((person.headY - region.y1) / (region.y2 - region.y1)) * 100) / 100,
              fc: faces.map(function (f) {
                return [
                  Math.round(((f.x1 + f.x2) / 2) * 100) / 100,
                  Math.round(((f.y1 + f.y2) / 2) * 100) / 100,
                ];
              }),
              // The DECISION, not just its inputs: distance to each face
              // and the bar that face was judged against. R19's queue
              // asks the next round to recompute `d` and a proposed
              // `0.5 * fw` for every attr row and confirm that every
              // currently-correct attribution survives before narrowing
              // the tolerance. That cannot be done from centres alone —
              // the bar is per-CANDIDATE (`max(0.18, fw)` uses the
              // candidate face's own width), which is the suspected
              // defect, so it has to be recorded per candidate.
              d: (function () {
                if (person.headX === null || person.headY === null) return null;
                var rw = region.x2 - region.x1;
                var rh = region.y2 - region.y1;
                if (!(rw > 0) || !(rh > 0)) return null;
                var qx = (person.headX - region.x1) / rw;
                var qy = (person.headY - region.y1) / rh;
                return faces.map(function (f) {
                  var cx = (f.x1 + f.x2) / 2;
                  var cy = (f.y1 + f.y2) / 2;
                  return [
                    Math.round(Math.sqrt((cx - qx) * (cx - qx) + (cy - qy) * (cy - qy)) * 1000) / 1000,
                    Math.round(Math.max(0.18, f.x2 - f.x1) * 1000) / 1000,
                    Math.round((f.x2 - f.x1) * 1000) / 1000,
                  ];
                });
              })(),
              meta: meta.map(function (m) {
                return (m.flagged ? 'F' : 'c') + (m.certain ? '!' : '?');
              }),
            });
            if (dbgA.attr.length > 120) dbgA.attr.shift();
            } catch (e) {}
            if (own === -1) {
              // BACKSTOP. observeCropped now answers this before paying
              // for the read, so this branch is reachable only if
              // ownFaceIndex were non-deterministic over the same
              // `faces`. Kept because the failure mode if it ever is
              // would be an unattributed read clearing somebody.
              return { box: person, flagged: true, certain: false, faceFound: true, desc: faceDesc };
            }
            var mine = meta[own] || { flagged: true, certain: false };
            // THE PIXELS THIS VERDICT WAS READ FROM, in frame
            // coordinates (gauntlet R19). `faceRegionInVideo` is the
            // square the gender model actually saw, so it is not a guess
            // about where the head is — it is a detection, and a face
            // that was DETECTED is by definition not occluded. That makes
            // it the one region of a cleared person which provably shows
            // that person and nobody behind them, which is what
            // `blurredTracks` needs to stop drawing a neighbour's patch
            // across a cleared man's face. Deliberately the SQUARE and
            // not the enlarged detector box: the square is a subset of
            // what the detector claimed, so subtracting it can never
            // uncover someone the detector never asserted was there.
            // ONLY FROM AN ANCHORED ATTRIBUTION (R19 critic, F1).
            // `ownFaceIndex` has two branches: with a head keypoint it
            // picks the face nearest that anchor; WITHOUT one it falls
            // through to `bestIndex`, the largest face in the crop —
            // which in a two-shot is routinely the NEIGHBOUR's, and R18
            // measured headX null on 59% of weak-tier admits. A stolen
            // face already mis-supplies this person's verdict; letting it
            // also punch a subtraction hole would put a sharp window over
            // the very person it was stolen from. The verdict half of
            // that bug is real and is R20's, with the critic's numbers in
            // GOAL.md — this only refuses to build NEW geometry on it.
            var anchored = typeof person.headX === 'number' && typeof person.headY === 'number';
            var headSq = null;
            try {
              if (!anchored) throw new Error('unanchored');
              var hb = faceRegionInVideo(faces[own]);
              if (hb && hb.x2 > hb.x1 && hb.y2 > hb.y1) {
                headSq = { x1: hb.x1, y1: hb.y1, x2: hb.x2, y2: hb.y2 };
              }
            } catch (e) {
              /* geometry is optional; a missing head hole only means the
                 old, over-wide behaviour for this pass */
            }
            return {
              box: person,
              headBox: headSq,
              flagged: mine.flagged,
              certain: mine.certain,
              // One read confident enough to clear on its own — see
              // GENDER_INSTANT_CLEAR. Never set on the flag side.
              instant: !!mine.instant,
              // The model answered from its prior rather than from the
              // face (isNullRead). person-track needs to tell this apart
              // from a weak directional read, because a cleared track
              // absorbs `uncertain` for CLEARED_TTL_MS while an
              // abstention revokes it in two.
              //
              // THIS LINE IS THE WHOLE FIX. R12 shipped the abstention
              // and both consumers, and this builder copied three fields
              // and silently dropped the fourth — so the branch in
              // person-track was unreachable and `abstainDemote` never
              // appeared in any run. The unit tests passed throughout
              // because they hand `abstained` straight to
              // updatePersonTracks and never cross this boundary. When
              // you add a verdict field, add it HERE too, and prove it
              // with a life counter in a real run, not with a test.
              abstained: !!mine.abstained,
              // Weak same-direction evidence (S6). Added HERE at the same
              // time as its producer and consumer, per the warning above:
              // R12 shipped `abstained` in gender-verdict and person-track
              // and forgot this line, so the branch was unreachable for
              // two releases and no unit test could see it. `weakClear` is
              // its life counter — if it never appears in a run, this
              // line is the first place to look.
              weak: !!mine.weak,
              faceFound: true,
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
      heldPersons = [];
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
      // 2x/3x playback compresses on-screen motion into less wall time
      // (owner edge-case ask): tighten the cadence proportionally so
      // patch lag doesn't scale with playback speed. The adaptive
      // pass-cost throttle still wins on slow devices.
      var rate = isPlayer && video.playbackRate > 1 ? Math.min(3, video.playbackRate) : 1;
      var effInterval = isPlayer
        ? Math.min(1000, Math.max(floor / rate, lastPassMs * 1.5))
        : sampleInterval;
      if (now - lastSample < effInterval) return;
      if (sampling) return;
      lastSample = now;
      sampling = true;
      var myEpoch = passEpoch;

      // PERSON-PRIMARY player path (redesign 2026-08-24): MoveNet finds
      // the persons, each person's native-res crop decides their gender,
      // the tracker + state machine decide the patches. ONE pass, one
      // cadence — the person is the unit of blur, the face only reads
      // gender, and non-persons never enter the pipeline (the entire
      // phantom class the old gates chased is excluded by construction).
      if (useRegionVideo && personModel) {
        var effZoom = Math.max(ZOOM_INTERVAL_MS, lastVerdictMs * 1.5);
        // Never a second verdict pass while one is still running: one
        // GPU queue, and a backlog is indistinguishable from a hang.
        var wasVerdict = !verdictBusy && now - lastZoomAt >= effZoom;
        if (wasVerdict) {
          verdictBusy = true;
          setTimeout(function () {
            verdictBusy = false;
          }, VERDICT_STALL_MS);
        }
        try {
          // ONE upload for both detectors when they read the same source.
          // On the fast path (directPersonOk) the person pass and the
          // full-frame face pass are both handed this <video> element, and
          // each used to upload it separately -- ~8.3MB twice per verdict
          // pass at 1080p. Only shared when the sources are IDENTICAL: with
          // directPersonOk false the person pass reads a 256px ImageData
          // and the face pass reads the video, which are different pixels
          // and must stay two uploads.
          // STAGE TIMING (measurement only). The verdict pass is p50
          // 109ms on this desktop against a position pass at 27ms, and
          // every optimisation proposal so far has guessed at where that
          // goes. Marks are cheap (performance.now), guarded, and never
          // touch control flow.
          var stageT0 = performance.now();
          var stage = {};
          function mark(name) {
            try {
              stage[name] = Math.round(performance.now() - stageT0);
            } catch (e) {}
          }
          var sharedFrame = directPersonOk ? detector.uploadFrame(video) : null;
          mark('upload');
          var frameDone = false;
          var releaseFrame = function () {
            if (frameDone) return;
            frameDone = true;
            detector.disposeFrame(sharedFrame);
            sharedFrame = null;
          };
          detector
            .detectPersons(
              personModel,
              personPixelSource(),
              video.videoWidth / (video.videoHeight || 1),
              heldPersons,
              sharedFrame
            )
            .then(function (persons) {
              mark('persons');
              // How many people this pass had to crop. The crop+gender
              // stage is 64 of a verdict pass's 102ms (S9), and whether
              // that scales with the person count decides whether
              // ZOOM_MAX_PERSONS is the phone lever or a red herring.
              try {
                stage.n = persons.length;
              } catch (e) {}
              // Probe-visible pass marker (verification probes read this).
              window.__TS_GAZE_PERSONS = persons.length;
              // Hysteresis input for the NEXT pass. Stamped from the
              // admitted set only, so a person the gate refused this pass
              // cannot hold themselves open on the next one.
              // EPOCH-GUARDED. A discontinuity (cut / seek / loadstart)
              // clears heldPersons, but a pass already in flight resolves
              // AFTER that and would put the pre-discontinuity people
              // straight back — letting a person who is no longer there
              // hold a post-cut noise slot open for up to PERSON_HOLD_MAX
              // passes, which renders as a GHOST. Same rule the
              // observation path applies below at `myEpoch !== passEpoch`.
              heldPersons = myEpoch === passEpoch ? persons : [];
              // Raw slot scores BEFORE our gates, so a "zero persons"
              // wide shot can be attributed: model blind, or our own
              // floor discarding a real detection. Wrapped because a
              // probe must never be able to throw inside the pipeline.
              try {
                var dbgS = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                if (!dbgS.slots) dbgS.slots = [];
                dbgS.slots.push({
                  n: persons.length,
                  // How many of those were admitted by the R17 hysteresis
                  // rather than by the ordinary floor, and the oldest
                  // hold age. A hold that never fires is dead code; one
                  // that pins at PERSON_HOLD_MAX is a latch. Neither is
                  // visible from `n` alone.
                  hd: persons.filter(function (q) { return (q.hold || 0) > 0; }).length,
                  ha: persons.reduce(function (m, q) { return Math.max(m, q.hold || 0); }, 0),
                  // score / confident-at-0.3 / MAX keypoint / count-at-0.15
                  // / box height. The last two are R14's question: a slot
                  // reading `confident 0` is ambiguous between "MoveNet
                  // saw nothing" and "MoveNet saw a wrist at 0.28 and the
                  // threshold ate it", and those want opposite fixes.
                  raw: lastSlotDiag.map(function (s) {
                    return (
                      s.score +
                      '/' + s.confident +
                      '/' + s.maxKp +
                      '/' + s.nKp15 +
                      '/' + s.h +
                      // R18: the ANCHOR's own evidence. `confident` says
                      // how many keypoints cleared 0.3; hk/sk say whether
                      // the ones the anchor actually requires did. A
                      // back-turned child fails on these two and on
                      // nothing else.
                      '/' + s.hk +
                      '/' + s.sk +
                      // R22: WHICH keypoints were confident, as a
                      // bitmask, so a round can ask whether a slot's
                      // evidence is an anatomical set or scattered
                      // letterform hits. `confident` is only a count.
                      '/' + s.kb +
                      '/' + (s.b ? s.b.join(',') : '') +
                      // R20: the confident-keypoint hull beside the model
                      // box, so a round can finally attribute an over-wide
                      // patch to one or the other.
                      '/' + (s.k ? s.k.join(',') : '')
                    );
                  }),
                });
                if (dbgS.slots.length > 40) dbgS.slots.shift();
              } catch (e) {}
              // Position observations are free — track ALL persons
              // (review A8: slicing position passes to 3 let a 4th
              // flagged person's track starve and expire). Only the
              // crop/gender work is capped, highest-confidence first.
              var byConf = persons.slice().sort(cropPriority);
              var picked = byConf.slice(0, ZOOM_MAX_PERSONS);
              var rest = byConf.slice(ZOOM_MAX_PERSONS);
              // Position-only pass: skip the crops+gender, just move the
              // tracks (verdict state untouched in the tracker).
              if (!wasVerdict) {
                return persons.map(function (p) {
                  return { box: p, positionOnly: true };
                });
              }
              // Clear credit accrues by the GAP between gender reads,
              // not the (shorter) pass interval — otherwise the split
              // cadence would silently triple the clear hold. Clamped
              // so the first-ever read can't dump seconds of credit.
              var verdictDt = Math.min(1000, lastZoomAt ? now - lastZoomAt : sampleInterval);
              lastZoomAt = now;
              var dbgV = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
              dbgV.vEnter = (dbgV.vEnter || 0) + 1;
              dbgV.vE = dbgV.vE || {}; dbgV.vE[samplerId] = (dbgV.vE[samplerId]||0)+1;
              dbgV.vP = (dbgV.vP || []).concat([persons.length]).slice(-40);
              dbgV.log = (dbgV.log || []).concat(['  vEnter persons=' + persons.length]).slice(-60);
              // FULL-FRAME FACE PASS — two jobs (both measured):
              //  1. Close-ups: MoveNet needs body context a face-filling
              //     shot doesn't have (owner frame: daughter close-up,
              //     0 persons, fully exposed).
              //  2. CROWDS: MoveNet MultiPose reports at most SIX
              //     people. BlazeFace returns up to 20, so in a group
              //     shot everyone past the sixth is covered through
              //     here (owner 2026-08-25: "work with 10+ people").
              // A face with no pose behind it becomes a head+torso
              // person (personFromFace) — deliberately modest geometry.
              return detector
                .detectFaceBoxes(
                  model,
                  directPersonOk ? video : personPixelSource(),
                  directPersonOk ? sharedFrame : null
                )
                .then(function (faces) {
                  mark('fullFaces');
                  var extra = [];
                  // TILE-RECALL PROBE — measurement only, off unless the
                  // harness sets the flag, and it never touches `extra`,
                  // `persons` or any track. R16 measured 4-15 faces found
                  // in an auditorium containing ~100 people, and the
                  // suspected cause is resolution, not any threshold: the
                  // full-frame pass resizes 1920x1080 to INPUT_SIZE 256,
                  // so a 40px back-row face arrives ~9px tall. Before
                  // anyone pays for tiling on a Helio G88, measure what it
                  // would actually BUY on this exact footage and what it
                  // costs. Fire-and-forget so a slow probe cannot stall
                  // the pass it is measuring.
                  if (window.__TS_TILE_PROBE) {
                    try {
                      tileProbe(faces.length);
                    } catch (e) {}
                  }
                  // Tallest face this pass found — the free scale
                  // reference the fallback needs to tell a close-up's
                  // neighbouring TEXTURE from a genuinely distant person.
                  var maxFaceH = 0;
                  for (var mf = 0; mf < faces.length; mf++) {
                    var fh = faces[mf].y2 - faces[mf].y1;
                    if (fh > maxFaceH) maxFaceH = fh;
                  }
                  // ONE PERSON BOX IS ONE PERSON, NOT EVERY FACE IN IT.
                  // A face landing inside an admitted MoveNet box used to
                  // be dropped outright, on the assumption that the box IS
                  // that face's person. In a seated row that is false: R16
                  // measured a woman at cx 0.30 whose face WAS detected,
                  // fell inside the SPEAKER's box (whose patch spans
                  // x 0.317-0.706), and so produced no observation of her
                  // own — she sat fully sharp in the 0.087-wide gap
                  // between two patches, in man mode, on three frames of
                  // one run. Her face was also inside the speaker's CROP,
                  // where ownFaceIndex correctly picked the speaker's, so
                  // she was invisible to every stage at once.
                  // Largest face first, so the face that claims a box is
                  // the one most likely to belong to it; every other face
                  // in that box gets its own body. mergeTracks unions the
                  // genuine overlaps, so an over-claim costs one merged
                  // patch rather than a stack.
                  var order = [];
                  for (var oi = 0; oi < faces.length; oi++) order.push(oi);
                  order.sort(function (a, b) {
                    return (
                      (faces[b].x2 - faces[b].x1) * (faces[b].y2 - faces[b].y1) -
                      (faces[a].x2 - faces[a].x1) * (faces[a].y2 - faces[a].y1)
                    );
                  });
                  // NOTHING HUMAN-SHAPED IN FRAME => a face here is a
                  // graphic, not a person MoveNet missed (R21). Only
                  // consulted when the person pass admitted NOBODY: with
                  // even one admitted person the frame demonstrably
                  // contains humans and the fallback keeps covering the
                  // ones MoveNet did not reach. See frameHasNoHumanShape
                  // for the corpus measurement that sets the floor and
                  // for the two neighbouring cases it must not take.
                  var noShape = persons.length === 0 && persons.noHumanShape === true;
                  var claimed = {};
                  for (var oj = 0; oj < order.length; oj++) {
                    var fi = order[oj];
                    var owner = faceInsideIndex(faces[fi], persons);
                    if (owner !== -1 && !claimed[owner]) {
                      claimed[owner] = 1;
                      continue;
                    }
                    if (noShape) {
                      try {
                        var dbgN = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                        dbgN.life = dbgN.life || {};
                        dbgN.life.faceNoShape = (dbgN.life.faceNoShape || 0) + 1;
                      } catch (e) {}
                      continue;
                    }
                    extra.push(personFromFace(faces[fi], video.videoWidth / (video.videoHeight || 1)));
                  }
                  try {
                    var dbgT = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                    dbgT.life = dbgT.life || {};
                    // THE HEIGHTS THE RULE ACTUALLY USES. R15 first
                    // calibrated the threshold against `reads.px`, which is
                    // the face found INSIDE a crop and mapped back — a
                    // different number from the full-frame face that built
                    // the crop in the first place. The rule then fired zero
                    // times and the artifact could not say why. Record the
                    // full-frame heights, whether each was inside a person,
                    // and the max, so the constant is derived from its own
                    // input.
                    dbgT.ff = (dbgT.ff || [])
                      .concat([
                        {
                          mx: Math.round(maxFaceH * 1000) / 1000,
                          hs: faces.map(function (fb) {
                            return Math.round((fb.y2 - fb.y1) * 1000) / 1000;
                          }),
                          // Centres too: a crowd rule needs to know
                          // whether the faces SPAN the frame or cluster in
                          // one band, and a count alone cannot say.
                          cx: faces.map(function (fb) {
                            return Math.round(((fb.x1 + fb.x2) / 2) * 100) / 100;
                          }),
                          cy: faces.map(function (fb) {
                            return Math.round(((fb.y1 + fb.y2) / 2) * 100) / 100;
                          }),
                          in: faces.map(function (fb) {
                            return faceInsideAny(fb, persons) ? 1 : 0;
                          }),
                          np: persons.length,
                        },
                      ])
                      .slice(-12);
                  } catch (e) {}
                  // Everyone is TRACKED; only the verdict budget is
                  // capped. Unverdicted people keep their existing
                  // state, and a brand-new one starts covered.
                  var all = picked.concat(extra);
                  // Negative detection (owner idea): remember that THIS
                  // verdict pass saw an empty frame, so the tracker can
                  // erase ghosts instead of coasting them.
                  // REFUSED FACES ARE NOT EVIDENCE OF A HUMAN. Skipping
                  // the mint is not the same as removing a patch: leave
                  // the refused face counted here and `emptyFrame` stays
                  // false, so wipeIfEmpty stands down and any track that
                  // was already blurred coasts its full window over the
                  // graphic. R21's slide got away with it only because
                  // the ghost was a BIRTH; a cut from a person to a title
                  // card is the common case and the gate alone would not
                  // clear it.
                  var faceEvidence = noShape ? 0 : faces.length;
                  emptyFrame = persons.length === 0 && faceEvidence === 0;
                  // Largest thing this pass actually saw. It is the
                  // cheapest available read on subject scale — already
                  // computed, no extra pixels — and scale is what decides
                  // whether "I see nobody" next pass is a detector miss
                  // or a real cut. See wipeIfEmpty.
                  passMaxBoxH = 0;
                  for (var mb = 0; mb < persons.length; mb++) {
                    var ph = persons[mb].y2 - persons[mb].y1;
                    if (ph > passMaxBoxH) passMaxBoxH = ph;
                  }
                  // Same reason, and this one is sharper: a refused face
                  // feeds faceHeight * 3 into the NEXT pass's `prevMaxH`,
                  // so a hallucinated face 0.357 tall reports a subject
                  // scale of 1.07 and ARMS wipeIfEmpty's one-pass `big`
                  // shortcut. Both of that eraser's measured misfires
                  // were it erasing people who were still there.
                  for (var mf = 0; !noShape && mf < faces.length; mf++) {
                    var fh = (faces[mf].y2 - faces[mf].y1) * 3;
                    if (fh > passMaxBoxH) passMaxBoxH = fh;
                  }
                  var dbgF = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                  dbgF.faceStage = (dbgF.faceStage || []).concat([faces.length + '/' + all.length]).slice(-40);
                  dbgF.log = (dbgF.log || []).concat(['  faceStage all=' + all.length]).slice(-60);
                  if (all.length > ZOOM_MAX_PERSONS) {
                    // Round-robin the crops so a large group is fully
                    // classified across a few passes instead of the
                    // same three people every time.
                    all.sort(cropPriority);
                    var start = crowdCursor % all.length;
                    var budget = [];
                    for (var c = 0; c < ZOOM_MAX_PERSONS; c++) {
                      budget.push(all[(start + c) % all.length]);
                    }
                    crowdCursor = (start + ZOOM_MAX_PERSONS) % all.length;
                    for (var r2 = 0; r2 < all.length; r2++) {
                      if (budget.indexOf(all[r2]) === -1) rest.push(all[r2]);
                    }
                    return budget;
                  }
                  return all;
                })
                .catch(function () {
                  // Fallback pass failed — the person pass still stands.
                  return picked;
                })
                .then(function (all) {
                  var observations = [];
                  // Un-cropped extra persons still move their tracks.
                  rest.forEach(function (p) {
                    observations.push({ box: p, positionOnly: true });
                  });
                  var chain = Promise.resolve();
                  all.forEach(function (p) {
                    // Serial, not parallel: one GPU queue, smaller bursts.
                    chain = chain.then(function () {
                      return observePerson(p).catch(function (e) {
                        var dbgE = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                        dbgE.errs = (dbgE.errs || []).concat([String((e && e.message) || e)]).slice(-8);
                        throw e;
                      }).then(function (obs) {
                        obs.verdictDt = verdictDt;
                        observations.push(obs);
                      });
                    });
                  });
                  return chain.then(function () {
                    var dbgX = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                    verdictBusy = false;
                    dbgX.log = (dbgX.log || []).concat(['  chainDone obs=' + observations.length]).slice(-60);
                    dbgX.vDone = (dbgX.vDone || 0) + 1;
                    dbgX.vD = dbgX.vD || {}; dbgX.vD[samplerId] = (dbgX.vD[samplerId]||0)+1;
                    dbgX.vLen = (dbgX.vLen || []).concat([observations.length]);
                    // Calibration probe (review B): two persons in the
                    // SAME frame are definitionally different people —
                    // their pairwise sim is the cross-person band.
                    var dbg = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                    dbg.cross = dbg.cross || [];
                    for (var a = 0; a < observations.length; a++) {
                      for (var b2 = a + 1; b2 < observations.length; b2++) {
                        if (!observations[a].desc || !observations[b2].desc) continue;
                        dbg.cross.push(
                          Math.round(cosineSim(observations[a].desc, observations[b2].desc) * 100) / 100
                        );
                      }
                    }
                    if (dbg.cross.length > 400) dbg.cross = dbg.cross.slice(-400);
                    return observations;
                  });
                });
            })
            .then(function (observations) {
              mark('crops');
              if (failed || dead) return;
              // Discontinuity landed while this pass was in flight:
              // these observations describe a frame that no longer
              // exists (review A6) — drop them, the forced pass that
              // the discontinuity queued is right behind.
              if (myEpoch !== passEpoch) {
                var dbgD = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                dbgD.dropped = (dbgD.dropped || 0) + 1;
                return;
              }
              var dbgK = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
              dbgK.kept = (dbgK.kept || 0) + 1;
              dbgK.keptV = (dbgK.keptV || 0) + (observations.some(function (o) { return !o.positionOnly; }) ? 1 : 0);
              dbgK.shape = dbgK.shape || [];
              dbgK.log = (dbgK.log || []).concat([
                (wasVerdict ? 'V' : 'p') + ' obs=' + observations.length,
              ]).slice(-60);
              dbgK.shape.push(samplerId + ':' + observations.map(function (o) {
                return (o.positionOnly ? 'P' : (o.flagged ? 'F' : 'c') + (o.certain ? '!' : '?'));
              }).join('+'));
              if (dbgK.shape.length > 60) dbgK.shape.shift();
              var dt = lastPassAt ? now - lastPassAt : sampleInterval;
              lastPassAt = now;
              if (wasVerdict) {
                // Nobody in frame at all: every surviving patch is a
                // ghost riding out its coast window. Kill them now —
                // but only once TWO passes agree. One empty pass is not
                // evidence of an empty room: at wide subject scale
                // MoveNet and BlazeFace fail together, for the same
                // reason, so their agreement is a single blind spot
                // counted twice. Gauntlet R5 caught the eraser firing on
                // a stage holding ~40 people.
                emptyStreak = emptyFrame ? emptyStreak + 1 : 0;
                videoTracks = wipeIfEmpty(
                  videoTracks,
                  emptyFrame ? 0 : 1,
                  0,
                  emptyStreak,
                  lastMaxBoxH,
                  // Did the shot actually change? Only then may a big
                  // subject's disappearance be believed on one pass —
                  // otherwise it is a detection miss and the patch has to
                  // survive it (r8b f009). One verdict interval of slack,
                  // because the cut is detected on the gate tick and the
                  // wipe happens on the verdict pass that follows it.
                  lastCutAt !== 0 && now - lastCutAt <= effZoom
                );
                if (!emptyFrame) lastMaxBoxH = passMaxBoxH;
                emptyFrame = false;
              }
              // Keep the coast window in step with the verdict cadence —
              // on a slow device the cadence is what decides whether a
              // covered person's patch survives to the next pass.
              setVerdictCadence(effZoom);
              // OBSERVATION PROVENANCE (gauntlet R19). `slots` shows what
              // MoveNet raw-produced and `tracks` shows what survived, and
              // between them sits the one step no artifact has ever
              // recorded: personFromFace minting synthetic bodies, and
              // dedupeObservations choosing ONE box per human. R19 scored
              // FALSE COVER on a cleared man whose face sat inside another
              // track's patch, and could not say from the artifact whether
              // the offending box was MoveNet's measurement or an
              // extrapolation that beat it on area in `preferred()`.
              // `f` is the fromFace flag; `p` positionOnly; `v` the
              // verdict shape. Wrapped because instrumentation has killed
              // two releases and does not get to kill a third.
              try {
                var dbgO = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                dbgO.obs = dbgO.obs || [];
                dbgO.obs.push(
                  observations.map(function (o) {
                    var bx = (o && o.box) || {};
                    return {
                      f: bx.fromFace ? 1 : 0,
                      p: o && o.positionOnly ? 1 : 0,
                      v: o && o.positionOnly ? 'P' : (o && o.flagged ? 'F' : 'c') + (o && o.certain ? '!' : '?'),
                      b: [bx.x1, bx.y1, bx.x2, bx.y2].map(function (n) {
                        return typeof n === 'number' ? Math.round(n * 1000) / 1000 : null;
                      }),
                    };
                  })
                );
                if (dbgO.obs.length > 60) dbgO.obs = dbgO.obs.slice(-60);
              } catch (e) {
                /* probes never break the pipeline */
              }
              videoTracks = updatePersonTracks(videoTracks, observations, dt);
              mark('tracks');
              // Calibration probe: per-track state after every pass, so
              // a "why is he not clearing" question is answered by
              // measurement instead of a guess.
              var dbgT = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
              dbgT.tracks = dbgT.tracks || [];
              dbgT.tracks.push(
                videoTracks.map(function (tk) {
                  return {
                    id: tk.id,
                    st: tk.state,
                    cs: tk.clearStreak,
                    fs: tk.flagStreak,
                    cm: Math.round(tk.clearMs || 0),
                    lv: tk.lastVerdict,
                    // S6 weak-evidence streak. Measurement only (the clear
                    // it was built for exposed a child and was removed the
                    // same round) — this is how a future round sizes how
                    // often consistent sub-bar evidence actually occurs.
                    ws: tk.weakStreak || 0,
                    // How much of flagStreak came from ABSTENTIONS (S10).
                    // The design intent is "2 consecutive certain
                    // opposite reads"; abstentions advance the same
                    // counter, so a mix also revokes. Measurement only.
                    as: tk.abstainStreak || 0,
                    // The two fields every TTL/stale question needs and
                    // no trace has ever carried: paths 3, 4 and `stale`
                    // are invisible in the per-pass record, so they could
                    // only be reasoned about from aggregates that cannot
                    // be joined to a frame.
                    ca: Math.round(tk.clearAge || 0),
                    mm: Math.round(tk.missMs || 0),
                    // R19: the track's own box. Without it a patch cannot
                    // be attributed to the track that drew it, which is
                    // the join every geometry question needs.
                    b: tk.box
                      ? [tk.box.x1, tk.box.y1, tk.box.x2, tk.box.y2].map(function (n) {
                          return typeof n === 'number' ? Math.round(n * 1000) / 1000 : null;
                        })
                      : null,
                    // Read off the TRACK, not its box. The box is
                    // reconstructed as a bare four-field literal by
                    // newTrack, ema and coastStep, so `tk.box.fromFace`
                    // was undefined on every track ever recorded — 145
                    // of 145 across six runs reported 0, including a
                    // pass whose only observation was a synthetic body.
                    f: tk.fromFace ? 1 : 0,
                  };
                })
              );
              if (dbgT.tracks.length > 200) dbgT.tracks = dbgT.tracks.slice(-200);
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
            // The shared frame is the caller's to free, and a tensor leaked
            // once per verdict pass would be far worse than the duplicate
            // upload it exists to remove. Released on BOTH exits, and
            // releaseFrame is idempotent, so an early return upstream that
            // already freed it is harmless.
            .then(releaseFrame, function (e) {
              releaseFrame();
              throw e;
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
              var dbgP = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
              dbgP.passFails = (dbgP.passFails || 0) + 1;
              dbgP.lastFail = String((e && e.message) || e);
              // eslint-disable-next-line no-console
              console.warn('tamescroll gaze: person pass failed', e);
            })
            .finally(function () {
              mark('end');
              try {
                var dbgSt = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
                if (!dbgSt.stages) dbgSt.stages = [];
                stage.v = wasVerdict ? 1 : 0;
                dbgSt.stages.push(stage);
                if (dbgSt.stages.length > 120) dbgSt.stages.shift();
              } catch (e) {}
              var cost = performance.now() - now;
              if (wasVerdict) lastVerdictMs = cost;
              else lastPassMs = cost;
              // Cost telemetry for the gauntlet's mobile budget. Owner
              // 2026-08-25: "be sure to make it optimized and
              // performance oriented — that is the only way this app
              // would be helpful." Accuracy that costs a phone its
              // frame rate is not a win, so every round records both.
              var dbgC = (window.__TS_GAZE_IDS = window.__TS_GAZE_IDS || {});
              dbgC.cost = dbgC.cost || { verdict: [], pass: [] };
              var bucket = wasVerdict ? dbgC.cost.verdict : dbgC.cost.pass;
              bucket.push(Math.round(cost));
              if (bucket.length > 120) bucket.shift();
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
    // A seek is a discontinuity like a cut (owner edge-case ask:
    // fast-forward/arrow-key skips): old positions are meaningless.
    // Fresh tracks, immediate full pass, new luma baseline.
    video.addEventListener('seeked', function () {
      if (failed || dead) return;
      videoTracks = [];
      heldPersons = [];
      prevLuma = null;
      sceneState = 'motion';
      lastSample = 0;
      lastZoomAt = 0;
      passEpoch++;
      if (video.paused) {
        // Seeked while PAUSED (review A7): no pass will run until play
        // — the landed frame is unknown, so cover it whole. The first
        // pass after play replaces this with real patches.
        if (useRegionVideo) markFlagged(video);
      } else {
        sampleOnce();
      }
    });
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
      heldPersons = [];
      lastPassAt = 0;
      // New stream = new scene: forget the luma baseline and re-enable
      // the direct pixel path (a per-stream quirk shouldn't outlive it).
      prevLuma = null;
      sceneState = 'motion';
      lastCutAt = 0;
      directPersonOk = true;
      passEpoch++;
      if (!playerBlurOn) {
        playerBlurOn = true;
        if (pillRefresh) pillRefresh();
      }
      markPending(video);
      if (!video.paused) start();
    });

    // NO PLAYBACK-QUALITY FLOOR HERE, and that is a measured decision.
    //
    // R11 built one (raise ABR to hd720 so small faces carry more
    // pixels), shipped it behind a backoff, and then measured it against
    // itself. Verdict: REVERTED. The identical capture at 480p, 720p and
    // 1080p produced the SAME nine falsely-covered frames out of ten. The
    // seated subject who reads `uncertain` with a ~50px face still reads
    // `uncertain` with a ~112px one. Source resolution costs ~+4ms p50 on
    // the verdict pass and buys nothing, because every crop is resampled
    // to a fixed model input anyway — this pipeline is very nearly
    // resolution-independent.
    //
    // Her cover is the faceres NULL OUTPUT, not a shortage of pixels: a
    // constant `male` ~0.3 read that is a CERTAIN opposite-gender flag in
    // woman mode. Pixels cannot fix a model returning its prior.
    //
    // Two further reasons not to re-try this: raising the rung spends the
    // owner's mobile data on a Helio G88 for zero visible gain, and
    // YouTube's setPlaybackQuality has been a documented no-op since
    // 2019, so the only remaining lever writes the platform's own
    // storage — outside BLOCK-ONLY as written.
    //
    // What DID come out of it is a harness rule, not product code: two
    // runs of the same video minutes apart differed 854x480 vs 1280x720,
    // so `vw`/`vh` is now recorded per frame and a resolution mismatch
    // invalidates a cross-round comparison.
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
          heldPersons = [];
          lastPassAt = 0;
          markPending(video);
          if (!video.paused) start();
        } else {
          clearEl(video);
          videoRegion.clear(video);
          regionActive = false;
          videoTracks = [];
          heldPersons = [];
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
