import { hostScale, toLocalRect } from './host-scale.mjs';
// Person-region blur for the WATCH PLAYER (owner ask 2026-08-24: blur the
// blocked person on a playing video, not the whole frame — HaramBlur
// parity, whole-body coverage).
//
// Why a separate module from region-blur.mjs (thumbnails): those overlays
// are anchored in document.body. Element fullscreen — and Android's native
// custom-view fullscreen — render ONLY the fullscreen subtree, so a body
// overlay vanishes the instant the user goes fullscreen and exposes the
// face. These overlays live INSIDE the player element.
//
// Anchoring is position:ABSOLUTE relative to the player, never fixed:
// fixed positioning re-anchors to the nearest transformed/filtered
// ancestor, and YouTube's player tree uses transforms freely — a fixed
// overlay can land at wildly wrong coordinates (v1 did exactly that).
// Absolute coords are computed player-relative from two
// getBoundingClientRects, which stay correct under ancestor transforms.
//
// v2 (redesign 2026-08-24, blur-pipeline-audit): the old rAF loop read
// two getBoundingClientRects and wrote left/top/width/height EVERY frame
// — a forced synchronous layout at 60Hz for the life of the overlay.
// Now: rects are CACHED (re-read on a slow timer + ResizeObserver, both
// outside the rAF), overlays are fixed-size divs moved with a compositor
// -only transform, and the loop INTERPOLATES each track between ~4Hz
// detection updates using its velocity (dead reckoning) — smoothness
// comes from 60Hz interpolation, not from inference rate.

var HOST_CLASS = 'ts-gaze-vregion-host';
var RECT_REFRESH_MS = 250;
// Interpolation stops extrapolating past this (a stale detection pass
// must not slide a patch off its person indefinitely). 600 -> 1200
// 2026-08-24: the adaptive cadence can legitimately run ~1s/pass on a
// slow phone, and a patch that freezes mid-gap reads as "doesn't move"
// (owner phone test).
var MAX_EXTRAPOLATE_MS = 1200;
// Overlays are BASE_PX squares scaled by transform — one layout when
// built, compositor-only moves forever after.
var BASE_PX = 100;

// video -> { host, video, tracks, at, overlays, raf, timer, ro, hr, vr }
var entries = new Map();

// THE TIMELINE IS NOT PART OF THE ENTRY. It is keyed by video here and
// lives from setTimeline until clearTimeline, whatever the entry does.
//
// It used to be adopted ONCE onto `entry.boxesFn` from a pending queue,
// and `clear(video)` -- which init-entry calls on every pass that covers
// nobody -- deleted the entry holding it while the queued copy was
// already consumed. From the first empty pass on, the re-created entry
// had no boxesFn and the renderer silently drew the LIVE tracks, a full
// DELAY_MS ahead of the presented picture: patches for people who had
// not yet appeared, patches gone before their subject left. Redmi, 1095,
// one watch session: timelineFrames 100 against overlayFrames 53,801
// (2026-09-02). Every "delay arm" number taken between 1092 and 1095 was
// measured on that renderer.
var timelines = new Map();

// WHAT THE RENDERER WAS ASKED FOR, NEXT TO WHAT IT DREW.
//
// Every probe this project has for the player reads the DOM, so a
// disagreement between two states cannot be attributed: a patch in the
// wrong place looks identical whether the TRACK moved or the MAPPING is
// wrong. That ambiguity is what made the scale-squared defect survive
// (it was visible in his screenshot before any probe found it), and it
// blocked a fullscreen-vs-windowed comparison the same night. Read-only,
// guarded, allocation-light -- the same contract as __TS_GAZE_RENDER.
try {
  if (typeof window !== 'undefined') {
    window.__TS_GAZE_VTRACKS = function () {
      var out = [];
      entries.forEach(function (entry) {
        out.push({
          hr: entry.hr ? [entry.hr.left, entry.hr.top, entry.hr.width, entry.hr.height] : null,
          vr: entry.vr ? [entry.vr.left, entry.vr.top, entry.vr.width, entry.vr.height] : null,
          scale: entry.scale == null ? null : entry.scale,
          // normalized on the VIDEO, which is what the pipeline hands us
          tracks: (entry.tracks || []).map(function (t) {
            var b = t.box || t;
            return [b.x1, b.y1, b.x2, b.y2];
          }),
        });
      });
      return out;
    };
  }
} catch (e) {
  /* probe is optional; the pipeline is not */
}

// RENDER COST COUNTERS (S13). Every number this project has about the
// renderer is a size or a rate read off the DOM; nothing has ever counted
// what the render loop actually DOES per second. These are plain integer
// increments on a hot path and are read through a guarded window hook, so
// they can be left in: instrumentation that throws inside the pipeline has
// already cost two releases (GOAL.md standing rule).
// hideNoVr / hideZeroVr / hideClipped / rectsNoBoxes / drawnZero EXIST
// BECAUSE A MEASURED GAP WAS ATTRIBUTED TO THE WRONG BRANCH -- a fix
// shipped and was reverted against a branch that provably never fires
// (docs/technical-findings.md, 2026-09-01).
//
// THEY ARE NOT ALL PER-FRAME, and reading them as a duration is wrong:
//   rectsNoBoxes  per refreshRects call -- the rAF loop only when
//                 rectsDirty, PLUS the 250ms timer, the ResizeObserver
//                 on host and video, and entry creation. It can rise by
//                 2 inside one rendered frame; measured doing exactly
//                 that.
//   hideNoVr      per reposition call, and reposition also runs on
//                 every verdict outside the loop.
//   hideZeroVr    same.
//   hideClipped   per OVERLAY per reposition, so it scales with the
//                 number of tracks.
//   drawnZero     same.
//   clipRebuilt   per OVERLAY re-parented, only when the page removed
//                 our layer -- 0 is the healthy value. IT COUNTS THE
//                 REPAIR, NOT THE STRAND: while the repair lived in
//                 setTracks it read 0 through a measured 8-second
//                 strand, because the exposure ended when the track
//                 coasted out rather than when a pass arrived. Running
//                 it in the rAF loop is what makes 0 mean "no strand" --
//                 a live entry renders every frame, so a strand cannot
//                 outlast one. And it can no longer rise on a DETACHED
//                 host, where re-parenting recovered nothing.
// Attribute with a rate only against `raf`, and never treat a delta as
// milliseconds.
// timelineFrames / timelineFallback (Task 9, Stage B): once a video has
// an attached timeline (setTimeline), every reposition asks it for the
// presented media time's boxes. timelineFrames counts a frame actually
// DRAWN from that answer; timelineFallback counts a frame where the
// timeline came back null (no verdict at/after the presented frame yet)
// and the renderer fell back to the existing velocity path instead --
// the same event Task 10's `delayVerdictLate` life counter prices from
// the player side. Both are per-REPOSITION-CALL like hideNoVr/hideZeroVr
// above, not per-second.
var renderStats = { raf: 0, overlayFrames: 0, maskCalls: 0, maskWrites: 0, tfWrites: 0, sizeWrites: 0, dispWrites: 0, hideNoVr: 0, hideZeroVr: 0, hideClipped: 0, rectsNoBoxes: 0, drawnZero: 0, clipRebuilt: 0, timelineFrames: 0, timelineFallback: 0 };
try {
  if (typeof window !== 'undefined') {
    window.__TS_GAZE_RENDER = function () {
      return {
        raf: renderStats.raf,
        overlayFrames: renderStats.overlayFrames,
        maskCalls: renderStats.maskCalls,
        maskWrites: renderStats.maskWrites,
        tfWrites: renderStats.tfWrites,
        sizeWrites: renderStats.sizeWrites,
        dispWrites: renderStats.dispWrites,
        hideNoVr: renderStats.hideNoVr,
        hideZeroVr: renderStats.hideZeroVr,
        hideClipped: renderStats.hideClipped,
        rectsNoBoxes: renderStats.rectsNoBoxes,
        drawnZero: renderStats.drawnZero,
        clipRebuilt: renderStats.clipRebuilt,
        timelineFrames: renderStats.timelineFrames,
        timelineFallback: renderStats.timelineFallback,
      };
    };
  }
} catch (e) {
  /* probe is optional; the pipeline is not */
}

/**
 * Pure mapping: a normalized (0..1) box on the video -> a rect in the
 * PLAYER's coordinate space. Both rects come from getBoundingClientRect,
 * so any ancestor transform cancels out of the subtraction. Exported for
 * tests.
 */
export function boxToHostRect(hostRect, videoRect, box) {
  return {
    left: videoRect.left - hostRect.left + box.x1 * videoRect.width,
    top: videoRect.top - hostRect.top + box.y1 * videoRect.height,
    width: (box.x2 - box.x1) * videoRect.width,
    height: (box.y2 - box.y1) * videoRect.height,
  };
}

/**
 * Pure: advance a track's box along its velocity (normalized units/s),
 * capped at MAX_EXTRAPOLATE_MS. Exported for tests.
 */
export function interpolateBox(track, elapsedMs) {
  var t = Math.min(Math.max(0, elapsedMs), MAX_EXTRAPOLATE_MS) / 1000;
  var dx = (track.vx || 0) * t;
  var dy = (track.vy || 0) * t;
  // Size extrapolation (owner 2026-08-24 "dynamic scale"): a growing
  // patch keeps growing between passes — split across both edges. Only
  // ever applied OUTWARD (shrink prediction is the exposure direction;
  // the next real pass shrinks it instead).
  // TRIED AND REFUSED: capping this at 8% of the box's own dimension.
  // Size extrapolation LOOKS like the obvious cause of patch breathing --
  // one noisy size step becomes a velocity and the renderer draws more of
  // it every frame until the next pass. It is not. Measured on the same
  // 45s: breathe 0.3589 -> 0.3614/s, i.e. nothing, while the cap COST
  // count stability (dCount 0.40 -> 0.58/s, births 0.20 -> 0.36/s,
  // stable intervals 96.3% -> 94.0%) because a patch that stops
  // predicting growth expires and re-mints more often.
  // The breathe regression against the pre-gauntlet build (92e8fba,
  // bundle v7: 0.229/s against our 0.372/s on identical footage) is real
  // and is still unattributed. It is NOT here. Look at what feeds
  // sizeVel, not at what consumes it.
  var gw = Math.max(0, (track.vw || 0) * t) / 2;
  var gh = Math.max(0, (track.vh || 0) * t) / 2;
  return {
    x1: Math.max(0, Math.min(1, track.box.x1 + dx - gw)),
    y1: Math.max(0, Math.min(1, track.box.y1 + dy - gh)),
    x2: Math.max(0, Math.min(1, track.box.x2 + dx + gw)),
    y2: Math.max(0, Math.min(1, track.box.y2 + dy + gh)),
  };
}

// The overlay host lives inside the player so fullscreen keeps it painted.
// THE FEED PREVIEW IS NOT A PLAYER WE MAY DRAW IN. (owner 2026-08-27,
// phone screenshot: a blur rectangle across the playing video, and "the
// blur marks end up showing on the title bar" while scrolling fast.)
//
// m.youtube reuses ONE #movie_player for the watch player AND for the
// feed's autoplay thumbnail preview -- that is already recorded in
// rules/youtube.txt as the reason the preview surface cannot be hidden.
// So resolveHost happily returns the SHARED player for a preview, and
// our overlays go in at z-index 20 inside a subtree that scrolls: they
// ride up under the fixed top bar, and when the preview ends or the
// element is recycled for the real player they are left painting across
// a video they no longer describe. Measured in a live mobile-UA DOM
// read: two patches at y=24 with the top bar spanning 0-48, both
// parented under .ytmVideoPreviewHost.
//
// Refusing the host puts the preview back on WHOLE-video blur, which is
// where feed videos have always belonged (they are small and fast, and
// the region path was built for the watch player). Whole blur is a
// filter on the video element itself, so it cannot paint over page
// chrome by construction.
var PREVIEW_HOST_SELECTOR = '.ytmVideoPreviewHost, ytm-video-preview';

function resolveHost(video) {
  if (!video || !video.closest) return null;
  try {
    if (video.closest(PREVIEW_HOST_SELECTOR)) return null;
  } catch (e) {
    /* non-fatal */
  }
  return video.closest('#movie_player') || null;
}

function makeOverlay(key) {
  var d = document.createElement('div');
  // Dead since S2 deleted the patch split: no key can contain '#' any
  // more. Kept as a guard only because a stray composite key would round
  // a corner it should not.
  var pieceKey = typeof key === 'string' && key.indexOf('#') !== -1;
  // Near-rectangular patch. z-index MEASURED against the live player
  // (2026-08-25): .html5-video-container is z-index 10, the bottom
  // gradient 24 and .ytp-chrome-bottom 59 — so 20 is the only band that
  // is ABOVE the video (below it the blur is invisible: a z-index of 5
  // shipped in v1013 and exposed people entirely) and BELOW the
  // timeline/controls (owner: blur must not cover the bottom bar).
  // Position moves by TRANSLATE only (compositor-only);
  // size is a real width/height write, but only when it actually
  // changed — a non-uniform transform scale warped the rounded
  // corners (owner 2026-08-24: "rounded edges are distorting").
  d.style.cssText =
    'position:absolute;left:0;top:0;width:' + BASE_PX + 'px;height:' + BASE_PX + 'px;' +
    'pointer-events:none;border-radius:' + (pieceKey ? '0' : LOOK.radiusPx + 'px') + ';' +
    'will-change:transform;' +
    'backdrop-filter:blur(var(--ts-blur-strong,24px));' +
    '-webkit-backdrop-filter:blur(var(--ts-blur-strong,24px));';
  // Seed the size cache from the size the node is BORN with. Left
  // undefined, place() compares the first real rect against 0, so a patch
  // narrower or shorter than 2px is never written and the overlay stays
  // at BASE_PX: a 100px blurred slab over whatever is beneath it. Latent
  // rather than observed, but slivers are exactly the shape this renderer
  // produces, and a smaller player makes them reachable.
  d.__tsW = BASE_PX;
  d.__tsH = BASE_PX;
  return d;
}

// A HOLE, WITHOUT A SECOND ELEMENT.
//
// NO HOLES. THE PATCH IS SOLID. (owner 2026-08-26, twice)
//
// "I do not want weird face cutouts in the blur ... All I need is to blur
// the subject so well that its shape is not visible", and then: "slight
// shape visible is fine in some cases, just shouldn't be super tight."
//
// Two mechanisms have existed for keeping a blurred patch off a CLEARED
// person's head: splitting it into four sibling rectangles (which IS his
// "multiple boxes here and there"), and punching a hole with a mask
// layer. R24 found the hole had never actually rendered in any shipped
// build, fixed the layer order, and the first build in which it worked is
// the one he is objecting to. Both are gone. A patch is now one solid,
// soft-edged rectangle and nothing is subtracted from it.
//
// The consequence is stated rather than hidden: a cleared person standing
// inside someone else's patch is now covered. That is FALSE COVER, the
// class this machinery existed to prevent, and it is the trade he chose.
// The fix for it is a patch that does not reach him -- association and
// geometry -- not a window cut in the blur.
//
// Both the unprefixed and -webkit- forms are still written for the
// feather: WebView2 takes `mask-composite`, older Android WebViews take
// `-webkit-mask-composite`, and a WebView that understands neither
// ignores the mask and draws the solid patch -- which OVER-covers, the
// safe direction, and never exposes anyone.
// SOFT EDGES, BECAUSE A RECTANGLE ANNOUNCES ITSELF.
//
// Owner 2026-08-26, on the hard-edged version of this: "the technique
// you're using to show the face ... through cropping is not the correct
// one. rather we could use translucent edges blur ... with the edges
// being more towards transparency ... the cropping through the square is
// just not working correctly."
//
// He is right about the mechanism, not only the look: a hard edge draws
// the eye to the boundary and so advertises exactly where the subject is
// and what shape the detector thinks they are. A gradient does not.
//
// Two layers, composited in one element: a horizontal fade INTERSECTed
// with a vertical fade -- a rectangle whose four edges ramp to
// transparent.
//
// SAFETY, and it is the whole reason this is not only prettier: the patch
// is EXPANDED by the feather width before it is drawn, so the
// fully-opaque core still covers every pixel the hard rectangle covered.
// The ramp is added margin. It cannot under-cover, so it cannot open
// EXPOSURE.
//
// VERIFIED BY PIXEL IN THE REAL WEBVIEW FIRST (runs/feather-spike2.png),
// because S2 paid for the lesson that CSS.supports is not evidence here.
// Patches drawn side by side over one paused frame, hard construction
// against feathered. The composite list is one operator PER LAYER; an
// early attempt passed fewer operators than layers and the list repeated,
// silently giving a layer the wrong operator. Keep the arrays in
// lockstep.
// THE FEATHER WIDTH IS A REAL TRADE, MEASURED, NOT A TASTE SETTING.
// A soft outer edge is only possible by painting SOME blur outside the
// requested box -- ramping inward instead would under-cover the covered
// subject, and R17 measured that leaving 7.5% of a shoulder sharp is a
// real PARTIAL. So the ramp lives outside, and on runs/s4-feather-man
// f001 a 26px ramp laid partial blur across the cheek of a CLEARED man
// standing right at the patch edge -- the owner's "not a single frame
// where the wrong gender is blurred", in its mildest form. 16px halves
// that encroachment (~3% of a 500px patch) while still reading as soft.
// Do not raise this without re-reading a frame with two people close
// together.
// FEATHER WIDTH, AND WHY THE PIXEL CAP WAS THE BUG.
//
// Owner, 2026-08-26, from a PHONE screenshot -- the first real-hardware
// evidence this project has ever had: "the square edges should not have
// been shown and a nice blur". The soft edge shipped in S4 and it is
// almost invisible on his device, because the width was capped at 16
// ABSOLUTE PIXELS. His patch measures roughly 460px across, so the ramp
// was 3.5% of it: geometrically a gradient, perceptually a hard rectangle.
// A pixel cap makes the look depend on the player's size, which is
// exactly the thing that differs between this desktop and his phone.
//
// So it is a FRACTION of the patch's own short side, with a pixel FLOOR
// (a tiny patch should not be entirely ramp) and a generous ceiling.
//
// HALF IN, HALF OUT -- and the measurement is what makes that safe.
//
// A fully OUTWARD ramp cannot under-cover, but it grows the drawn element
// by 2f per axis, and with f now scaled the frames went to 72-99% of the
// picture blurred: the owner's other complaint, "a Linus still gets
// blurred sometimes", made worse. A fully INWARD ramp would eat the
// requested box and is the EXPOSURE direction.
//
// So the element grows by f/2 and the ramp spans f from its edge, which
// puts the fully-opaque core f/2 INSIDE the box the pipeline asked for.
// That is affordable because S5 measured how much slack the box carries:
// PATCH_MARGIN 0.08 proportional, plus PTRACK_PAD 0.10, plus a keypoint
// margin of 0.05 (0.089 in y on 16:9) -- the drawn box is roughly twice
// the subject, with the median patch at 0.51 x 0.98 of frame. f/2 is
// around 5% of the short side, comfortably inside that margin, and the
// ramp's own alpha is still 0.85 at 78% of its width, so the part that
// loses meaningful coverage is only the outer sliver of added margin.
//
// Net against the hard-edged version: same total softness, HALF the
// over-blur, and half the encroachment on a cleared neighbour.
// HALVED, 2026-08-27, and the margin arithmetic above is now STALE.
//
// Owner, looking at the shipped 1019 build: "the in video blur I think
// needs sharpur blur edges because right now it looks a bit low quality".
// That is the opposite end of the same dial as the phone screenshot
// above, and both readings are right for the build each was made
// against: 0.10 was chosen when the drawn box carried PATCH_MARGIN 0.08
// + PTRACK_PAD 0.10 + a flat 0.089 keypoint margin in y, i.e. roughly
// twice the subject. This session cut all three (0.045 / 0.04 / a
// height-proportional cushion), so the SAME fraction now spends a much
// larger share of a much tighter box on gradient -- which is exactly
// what a soft, washed-out, low-quality edge looks like.
//
// 0.05 keeps the ramp scale-relative (the phone-vs-desktop bug the
// pixel cap caused stays fixed) at half the width: ~23px on his ~460px
// patch instead of ~46px. Still a gradient, not the hard rectangle S4
// replaced.
// SHARPER AGAIN, 2026-08-27 (owner, after seeing 0.05 on the phone: "I
// wanted more sharper blur in video as well the outline extra so it
// looks for polished"). Same direction as the previous halving and the
// same reason it is affordable: the margin stack the original 0.10 was
// sized against is gone. At 0.03 a ~460px patch ramps over ~14px --
// still a visible soft edge rather than the hard rectangle S4 replaced,
// but the patch now reads as a deliberate object with an edge instead
// of a smear. Below this the ramp stops being perceptible at all and
// the FEATHER_MIN_PX floor starts doing all the work on small patches,
// which reintroduces the phone-vs-desktop inconsistency the fraction
// exists to prevent.
// THE RAMP IS OFF. THE OWNER SETTLED THE DIAL, 2026-08-28.
//
// He asked for a sharper edge on 2026-08-27 (0.10 -> 0.05 -> 0.03), again
// this morning, and then closed it outright: "I'm fine with fully hard
// rectangle with rounded corners/edges since it looks higher quality."
// That is his call to make and it is the end of the argument S4 started
// -- the soft edge existed because a hard rectangle "announces itself",
// and he has now looked at both on real hardware and preferred the hard
// one.
//
// Everything downstream already handles zero: featherFor returns 0,
// drawnRect stops growing the element, and maskFor returns '' so
// applyMask clears the mask layers entirely. So this is not just a
// smaller ramp, it is one less mask rewrite per frame per patch and one
// less backdrop-filter invalidation -- the cheapest the renderer has
// ever been.
//
// The corners are NOT part of this ("just handle the corners correctly
// and not scale it weirdly -- i think that's already dialled in"): the
// 8px border-radius stays, and it stays honest because place() writes a
// real width/height rather than scaling the element, which is what
// distorted them in v1011.
// THE LOOK CONTRACT (owner-settled 2026-08-28, on his own hardware).
//
// These four numbers are not tuning parameters any more. Every one of
// them moved because a gauntlet ACCURACY round changed the geometry
// underneath it, and he screenshotted the result and called it "low
// quality" -- nine times across four dates, one dial moved four times
// in three days. The comment at :283 says it outright: a feather width
// correct for the build it was tuned against was wrong in the next one,
// because accuracy work and look work share one rectangle.
//
// So they are gathered, named, dated, and pinned by a test that quotes
// him. A future round that needs to move one has to move the test too,
// which is the point: the change becomes a decision instead of a side
// effect he finds on his phone.
//
//   FEATHER  "I'm fine with fully hard rectangle with rounded
//             corners/edges since it looks higher quality"
//   RADIUS   "just handle the corners correctly and not scale it
//             weirdly i think that's already dialled in"
//   BLUR     "the invedio blur looks very unpolished unlike the
//             thumbnail blur" -- radius scales with the patch so a
//             body-sized one is not two blobs.
export var LOOK = {
  featherFrac: 0, // hard edge. NOT a dial.
  radiusPx: 8,
  blurFrac: 0.09, // of the patch's short side
  blurMaxPx: 72,
};

var FEATHER_FRAC = LOOK.featherFrac; // of the patch's short side; 0 = hard edge
var FEATHER_MIN_PX = 0;
var FEATHER_MAX_PX = 64;

// BLUR RADIUS SCALES WITH THE PATCH (owner 2026-08-27, from a phone
// frame: "the invedio blur looks very unpolished unlike the thumbnail
// blur").
//
// The mechanism is the same class of bug the feather pixel-cap was. A
// thumbnail is ~120-360px across and gets filter:blur(16px) over the
// WHOLE element -- radius is an eighth of the picture, so nothing
// survives it and it reads as clean frosted glass. The in-player patch
// got the same order of radius (--ts-blur-strong, 24px at the medium
// preset) spread over a patch measuring ~500-900px on his phone. At a
// twentieth of the picture a gaussian removes detail but leaves
// LARGE-SCALE STRUCTURE: two body-sized blobs, a smear where a face was.
// That is exactly what "low quality" looks like next to a thumbnail --
// not the edge, the interior.
//
// So the radius is a fraction of the patch's own short side, with the
// user's chosen preset as a FLOOR (a small patch must never blur less
// than the launcher promised) and a ceiling because backdrop-filter cost
// on a mobile GPU does eventually track radius.
//
// 0.09 puts a ~500px patch at ~45px instead of 24 -- the same
// radius-to-picture ratio a thumbnail gets, which is the thing he is
// comparing against. It does NOT touch the feather: he asked for a
// sharper edge twice and a thumbnail's edge is perfectly hard, so the
// edge and the interior are moving in the directions he named, not
// against each other.
var BLUR_FRAC = LOOK.blurFrac; // of the patch's short side
var BLUR_MAX_PX = LOOK.blurMaxPx;
var strongPx = 0;
var strongReadAt = -1e9;
var STRONG_TTL_MS = 1000;

/** The launcher's blur-strength preset in px, cached (set_blur_strength
 *  can change it live, so it cannot be read once and kept forever). */
function strongPreset() {
  var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - strongReadAt < STRONG_TTL_MS && strongPx > 0) return strongPx;
  strongReadAt = now;
  var v = 0;
  try {
    var raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--ts-blur-strong');
    v = parseFloat(raw);
  } catch (e) { /* non-fatal: fall through to the default */ }
  strongPx = v > 0 ? v : 24;
  return strongPx;
}

/** Backdrop blur radius for a patch of this size, in px. */
export function blurRadiusFor(rect, presetPx) {
  var base = presetPx > 0 ? presetPx : 24;
  var shortSide = Math.min(rect.width, rect.height);
  if (!(shortSide > 0)) return base;
  var r = shortSide * BLUR_FRAC;
  if (r < base) r = base;
  if (r > BLUR_MAX_PX) r = BLUR_MAX_PX;
  return Math.round(r);
}

/** Feather width for a patch of this size, in px. */
export function featherFor(rect) {
  var shortSide = Math.min(rect.width, rect.height);
  if (!(shortSide > 0)) return 0;
  var f = shortSide * FEATHER_FRAC;
  if (f < FEATHER_MIN_PX) f = FEATHER_MIN_PX;
  if (f > FEATHER_MAX_PX) f = FEATHER_MAX_PX;
  // Never let the ramp exceed a third of the patch, or a small patch is
  // all gradient and covers nothing firmly.
  var lid = shortSide / 3;
  return f > lid ? lid : f;
}

/** Gradient stops for one soft edge: opaque at `f`, front-loaded falloff. */
function edgeStops(f) {
  // A single linear ramp reads as a visible band edge. Three stops put
  // most of the alpha loss in the OUTER half of the ramp, so the join to
  // the untouched picture is gentle while the inner part stays nearly
  // opaque -- which is also what keeps a neighbour inside the ramp from
  // picking up much blur.
  return (
    'rgba(0,0,0,0) 0px, rgba(0,0,0,0.35) ' + (f * 0.45).toFixed(1) + 'px, ' +
    'rgba(0,0,0,0.85) ' + (f * 0.78).toFixed(1) + 'px, #000 ' + f.toFixed(1) + 'px'
  );
}

// LAYER ORDER IS NOT COSMETIC, AND IT COST EIGHT ROUNDS.
//
// CSS mask layers composite BOTTOM-UP: the last layer in the list is
// composited against transparent black and each layer above combines with
// the accumulated result below it. A shipped order of
// [h-fade, v-fade, hole] with [source-over, source-in, xor] evaluated as
// `h-fade` ALONE -- the hole annihilated and the vertical feather with
// it, so the patch had soft left/right edges and HARD top/bottom edges in
// every build for eight rounds while every DOM probe reported the
// operators present and correct. R24 proved it by pixel in WebView2
// (spikes/gauntlet/runs/maskorder-webview2.png), not in Chrome and not
// with CSS.supports.
//
// The holes are gone now (see the note above makeOverlay), but the two
// fades are still order-dependent for the same reason: `source-in` must
// sit ABOVE the `source-over` base or it clips nothing. Read a pixel
// before believing any change here.
export function maskFor(rect, f) {
  if (!(f > 0)) return '';
  var full = rect.width + 'px ' + rect.height + 'px';
  var head = edgeStops(f);
  var tailA = 'calc(100% - ' + f.toFixed(1) + 'px)';
  var tailB = 'calc(100% - ' + (f * 0.78).toFixed(1) + 'px)';
  var tailC = 'calc(100% - ' + (f * 0.45).toFixed(1) + 'px)';
  var tail =
    '#000 ' + tailA + ', rgba(0,0,0,0.85) ' + tailB + ', ' +
    'rgba(0,0,0,0.35) ' + tailC + ', rgba(0,0,0,0) 100%';
  // Vertical fade BEFORE the horizontal one: `source-in` intersects with
  // everything below it. Two layers, two operators, nothing else.
  var img = [
    'linear-gradient(to bottom, ' + head + ', ' + tail + ')',
    'linear-gradient(to right, ' + head + ', ' + tail + ')',
  ];
  var sizes = [full, full];
  var pos = ['0px 0px', '0px 0px'];
  var comp = ['intersect', 'add'];
  var wcomp = ['source-in', 'source-over'];
  return [img.join(','), sizes.join(','), pos.join(','), comp.join(','), wcomp.join(',')].join('|');
}

function applyMask(overlay, spec) {
  renderStats.maskCalls++;
  if (overlay.__tsMask === spec) return; // style writes cost recalc
  renderStats.maskWrites++;
  overlay.__tsMask = spec;
  var st = overlay.style;
  if (!spec) {
    st.maskImage = '';
    st.webkitMaskImage = '';
    st.maskComposite = '';
    st.webkitMaskComposite = '';
    return;
  }
  var parts = spec.split('|');
  st.maskImage = parts[0];
  st.webkitMaskImage = parts[0];
  st.maskSize = parts[1];
  st.webkitMaskSize = parts[1];
  st.maskPosition = parts[2];
  st.webkitMaskPosition = parts[2];
  st.maskRepeat = 'no-repeat';
  st.webkitMaskRepeat = 'no-repeat';
  st.maskComposite = parts[3];
  st.webkitMaskComposite = parts[4];
}

function place(overlay, rect) {
  // The transform write is unconditional no longer. lerpRect settles, and
  // the shrink deadband can hold an edge indefinitely, so a static shot
  // asks for the SAME transform 60 times a second. Assigning an identical
  // string still crosses CSSOM every time; comparing it does not.
  var tf = 'translate(' + rect.left + 'px,' + rect.top + 'px)';
  if (overlay.__tsTf !== tf) {
    renderStats.tfWrites++;
    overlay.style.transform = tf;
    overlay.__tsTf = tf;
  }
  // Size writes cost layout. The old 2px deadband was the wrong lever now
  // that the caller hands us an integer: it let the ELEMENT sit up to 2px
  // away from the geometry the MASK was built for, which truncates the
  // outer strip of the ramp under `mask-repeat: no-repeat`. Compare
  // exactly instead -- an integer size only changes when it really does,
  // and the writes it costs (measured 15-51/s) are an order of magnitude
  // cheaper than the mask rewrites keeping them in register saves.
  if (overlay.__tsW !== rect.width) {
    renderStats.sizeWrites++;
    overlay.style.width = rect.width + 'px';
    overlay.__tsW = rect.width;
  }
  if (overlay.__tsH !== rect.height) {
    renderStats.sizeWrites++;
    overlay.style.height = rect.height + 'px';
    overlay.__tsH = rect.height;
  }
  // Radius follows the patch. Written only when the rounded value really
  // changes -- a backdrop-filter string assignment invalidates the
  // backdrop snapshot, so writing it every frame would be the expensive
  // mistake the transform/size caches above exist to avoid.
  var br = blurRadiusFor(rect, strongPreset());
  if (overlay.__tsBr !== br) {
    overlay.style.backdropFilter = 'blur(' + br + 'px)';
    overlay.style.webkitBackdropFilter = 'blur(' + br + 'px)';
    overlay.__tsBr = br;
  }
}

// Render-side smoothing: each frame the drawn rect moves a fraction of
// the way toward the target, so a fresh detection pass GLIDES the patch
// instead of snapping it (owner 2026-08-24: "very jittery" — every pass
// reset the interpolation base, a visible 8Hz snap). 0.25 @60Hz ≈ 100ms
// settling — imperceptible lag, no visible steps.
var RENDER_LERP = 0.25;

// GROW INSTANTLY, SHRINK SMOOTHLY (gauntlet R17; raised as a deferred
// item by R13's critic and measured here). The lerp above was symmetric,
// so every edge of the patch — including the ones the subject is moving
// TOWARD — trailed its target by ~100ms after each pass. That is not a
// cosmetic lag: the leading edge is where a raised hand or a shoulder
// exits the patch, which is the owner's PARTIAL class, and
// `interpolateBox` goes to the trouble of extrapolating size OUTWARD
// only just before this function throws that away.
//
// Measured on runs/r17b-woman f002: the target box reached the frame
// edge while the drawn rect was still at x 0.925, leaving 7.5% of the
// frame width of a covered man's shoulder sharp.
//
// So each EDGE takes the target immediately when the target is outside
// it, and lerps when the target is inside it. Anti-jitter is preserved
// where it was earned — a settling or shrinking patch still glides, and
// a jittery detector still cannot make the patch flicker smaller. The
// cost is that a translating patch is briefly the union of where it was
// and where it is going, i.e. slightly OVER-covered for ~100ms. Over-
// covering a person who is meant to be covered is free; under-covering
// them is the failure being scored. It cannot create a GHOST either:
// every edge involved is an edge of a real target rect for a real track.
// SHRINK DEADBAND (owner 2026-08-26: "the blurs look much annoying right
// now with multiple boxes here and there... previous versions were
// significantly better at feeling stable").
//
// MEASURED, and it is not a matter of taste: stability.py polls the LIVE
// overlay rects at 10Hz during continuous playback, and on the baseline
// two-person scene the drawn patches changed SIZE by a mean of 0.466
// frame-widths per second, p90 1.084 — counted only across intervals
// where the patch count was unchanged, so it is real motion of a real
// box and not a mismatched pair. The boxes pulse.
//
// The cause is the pairing of the two rules above. Growth is instant, by
// design and for a measured reason (R17: a lerped leading edge left 7.5%
// of a covered man's shoulder sharp). Shrink glides at RENDER_LERP,
// ~100ms. So every noisy detection inflates the box instantly and it
// deflates a tenth of a second later — at the 4-8Hz the detector runs,
// that is a visible throb.
//
// Fixing it by slowing the shrink is the obvious move and it is WRONG:
// lerpRect also handles TRANSLATION, where the trailing edge shrinks. A
// long shrink tail smears a moving patch into the union of where it was
// and where it is going, for as long as the tail lasts.
//
// So the discriminator is SIZE of the inward step, not speed. Detector
// noise moves an edge by a little; a person leaving moves it by a lot.
// An inward step smaller than this fraction of the edge's own dimension
// is treated as noise and the edge does not move at all, which takes the
// throb to exactly zero rather than merely slowing it. Anything larger
// glides as before. Scale-relative so it behaves the same on a 320px
// preview and a fullscreen player without plumbing the video size in.
//
// This can only ever make a patch LARGER than it would have been, never
// smaller, so it cannot open EXPOSURE or PARTIAL. What it costs is up to
// this fraction of over-cover on a settling patch.
// S13 PROBE: SET TO 0, MEASURED TWICE, REFUTED. The round's critic derived
// that this parks every settled edge at D = T/(1-2*0.05) = 1.111x target
// per axis (1.234x in area) for ever, and proposed deleting it as the
// single biggest source of over-cover. Measured on this build, man t=890,
// two 60s runs each way:
//
//                     0.05 (shipped)      0.0 (probe)
//   drawn/asked p50   1.236 / 1.238       1.159 / 1.163
//   patch w p50       0.538 / 0.546       0.524 / 0.517
//   jitter/s          0.135 / 0.118       0.176 / 0.184
//   breathe/s         0.309 / 0.313       0.328 / 0.343
//   dCount/s          0.52  / 0.53        0.62  / 0.63
//   stable_frac       0.952 / 0.948       0.943 / 0.938
//   tf_write_frac     0.425 / 0.403       0.907 / 0.921
//
// The park is NOT saturated in live footage: removing it returns only
// 7.5 points of the 1.24 drawn/asked ratio, not the 23 the arithmetic
// predicts, because the box is almost never settled long enough to reach
// the fixed point. What it costs is every stability metric -- jitter +40
// to +55%, dCount +19%, and the transform is rewritten on 90% of rAF
// frames instead of 42%, which doubles the renderer's CSSOM traffic on
// the phone we cannot measure. Keep it.
var SHRINK_DEADBAND = 0.05;

// Below this the glide is OVER. A 0.25 lerp is asymptotic, so without an
// epsilon the drawn rect differs from its target for ever: the transform
// string is rewritten 60 times a second through a completely static shot,
// for sub-pixel motion nobody can see. Battery and thermal on a phone,
// which is the machine that matters (owner 2026-08-26: "optimization is a
// real concern btw cuz yt app already feels slow"). Snapping to the
// target rather than holding `from` keeps this from ever shrinking the
// drawn patch below what the pipeline asked for.
var SETTLE_PX = 0.25;

// THE LONG SHRINK TAIL, AND THE REASON IT IS NOT SIMPLY A SMALLER LERP.
//
// Owner 2026-08-26 wants the box to stop pulsing. Growth is instant by
// design (R17 measured that a lerped LEADING edge left 7.5% of a covered
// man's shoulder sharp), so every noisy detection snaps the box outward
// and it glides back at RENDER_LERP -- a visible throb at the 4-8Hz the
// detector runs. The obvious fix is a slower inward lerp, and taken alone
// it is WRONG: lerpRect also handles TRANSLATION, where the trailing edge
// MUST keep up or the patch smears into the union of where the subject
// was and where they are going. That is why S1 shipped only a deadband.
//
// The discriminator does not need velocity, and does not need the tracker
// -- it is already in the two edges of each axis:
//
//   TRANSLATION -- both edges move the SAME way. The box slides: the
//                  leading edge snaps out, the trailing edge must follow
//                  at the old speed or it smears.
//   BREATHING   -- the edges move in OPPOSITE directions (both inward =
//                  the box is deflating, both outward = inflating). No
//                  subject moves like this; it is detector noise on the
//                  box regression, and it is exactly what should be
//                  damped.
//
// So the tail is long ONLY on a breathing axis. A translating axis keeps
// the behaviour every previous round measured. Both cases can only ever
// hold the drawn patch LARGER than the target, so neither can open
// EXPOSURE or PARTIAL.
var SHRINK_LERP = 0.06; // ~600ms to close, vs RENDER_LERP's ~100ms

/** True when this axis is deflating/inflating rather than sliding. */
function breathingAxis(dNear, dFar) {
  // Sub-pixel noise has no meaningful sign; treat a still edge as
  // agreeing with whatever the other edge is doing, so a one-sided
  // adjustment is read as breathing rather than as a slide.
  if (Math.abs(dNear) < SETTLE_PX) return true;
  if (Math.abs(dFar) < SETTLE_PX) return true;
  return (dNear > 0) !== (dFar > 0);
}

/** One edge, moving inward: hold it if the step is noise, else glide. */
function inward(fromEdge, toEdge, span, sign, rate) {
  var step = (toEdge - fromEdge) * sign;
  if (step > 0 && step < span * SHRINK_DEADBAND) return fromEdge;
  return fromEdge + (toEdge - fromEdge) * rate;
}


// A STILL PATCH ON A STILL SUBJECT. (owner 2026-08-26)
//
// "very messy and not smooth and very jettery ... the previous much more
// solid blur was better." The word that matters is SOLID. Every previous
// round read that as a size problem and spent itself on geometry; the
// measurements say otherwise -- the drawn patch is the right size for a
// full-body box and it will not stop MOVING. jitter 0.12-0.17 and breathe
// 0.21-0.31 frame-widths per second, on a two-shot where nobody is
// walking anywhere.
//
// SETTLE_PX exists but is a QUARTER PIXEL, so it only ever catches a
// patch that has already converged to within a rounding error, which the
// asymmetric dampers upstream guarantee it never does. Nothing in the
// chain says "that is not motion, that is the detector breathing".
//
// This does. If every edge is within MOVE_DEADBAND of where it already
// is, the patch does not move AT ALL -- not slower, not smoothed, not at
// all. Relative to the patch's own span so it behaves the same on a
// preview and a fullscreen player.
//
// SAFETY: the bar is a fraction of the patch, and the patch already
// carries the keypoint cushion, PATCH_MARGIN and PTRACK_PAD on top of a
// full-body box. A real 2%-of-patch movement is a few pixels of a person
// who is already covered with margin to spare; anything larger than the
// bar moves normally, at full speed, on the very same frame. So this
// cannot let a subject walk out of their patch -- it can only refuse to
// chase noise.
var MOVE_DEADBAND = 0.02;

export function lerpRect(from, to) {
  if (!from) return to;
  var spanW = from.width || 1;
  var spanH = from.height || 1;
  if (
    Math.abs(to.left - from.left) < spanW * MOVE_DEADBAND &&
    Math.abs(to.top - from.top) < spanH * MOVE_DEADBAND &&
    Math.abs(to.left + to.width - from.left - from.width) < spanW * MOVE_DEADBAND &&
    Math.abs(to.top + to.height - from.top - from.height) < spanH * MOVE_DEADBAND
  ) {
    return from;
  }
  if (
    Math.abs(from.left - to.left) < SETTLE_PX &&
    Math.abs(from.top - to.top) < SETTLE_PX &&
    Math.abs(from.width - to.width) < SETTLE_PX &&
    Math.abs(from.height - to.height) < SETTLE_PX
  ) {
    return to;
  }
  var fr = from.left + from.width;
  var fb = from.top + from.height;
  var tr = to.left + to.width;
  var tb = to.top + to.height;
  var xRate = breathingAxis(to.left - from.left, tr - fr) ? SHRINK_LERP : RENDER_LERP;
  var yRate = breathingAxis(to.top - from.top, tb - fb) ? SHRINK_LERP : RENDER_LERP;
  var l = Math.min(to.left, inward(from.left, to.left, from.width, 1, xRate));
  var t = Math.min(to.top, inward(from.top, to.top, from.height, 1, yRate));
  var r = Math.max(tr, inward(fr, tr, from.width, -1, xRate));
  var b = Math.max(tb, inward(fb, tb, from.height, -1, yRate));
  return { left: l, top: t, width: r - l, height: b - t };
}

function refreshRects(entry) {
  if (!entry.video.isConnected || !entry.host.isConnected) {
    clear(entry.video);
    return;
  }
  // CONNECTED IS NOT THE SAME AS RENDERED. A player inside a
  // `display:none` ancestor -- a backgrounded SPA route, a collapsed
  // panel -- is still in the document and still answers
  // getBoundingClientRect with zeroes, which reposition() reads as "hide
  // everything" and then re-reads 60 times a second forever. Asking
  // whether it generates boxes at all is one read and answers it
  // properly.
  //
  // This can never expose anyone: a host that generates no boxes paints
  // no pixels, so there is nothing under the patch to reveal. That is
  // the only kind of validity check allowed here (the plan's B5 bound) --
  // never a confidence or heuristic signal.
  if (typeof entry.host.getClientRects === 'function' && entry.host.getClientRects().length === 0) {
    renderStats.rectsNoBoxes++;
    entry.hr = null;
    entry.vr = null;
    return;
  }
  entry.hr = entry.host.getBoundingClientRect();
  entry.vr = entry.video.getBoundingClientRect();
  // The parked miniplayer scales the player container, so the host's own
  // pixels are no longer the viewport's. See host-scale.mjs -- without
  // this the patch is drawn at scale-squared and slides off the face.
  entry.scale = hostScale(entry.host, entry.hr);
}

/**
 * The element rect for a lerped patch: grown by half the feather on each
 * side, with an INTEGER size so the mask string is stable under pure
 * translation and under the sub-pixel wobble lerpRect never stops making.
 * Exported so the stability claim is testable rather than asserted.
 */
export function drawnRect(lerped, f) {
  var g = f > 0 ? f / 2 : 0;
  return {
    left: lerped.left - g,
    top: lerped.top - g,
    width: Math.round(lerped.width + g * 2),
    height: Math.round(lerped.height + g * 2),
  };
}

/**
 * A PATCH MAY NEVER LEAVE THE PICTURE.
 *
 * Owner 2026-08-28, phone screenshot: a scrolled watch page with the
 * sticky player at the top and a blur patch running from inside the
 * player down across the recommendation below it -- "the player
 * coincides or like the background overlaze beneath".
 *
 * Two things produce that and this closes both. The overlays are
 * absolutely positioned children of the player and NOTHING clipped them,
 * so a patch taller than the visible player painted straight onto the
 * page; and the rects behind the mapping refresh on a 250ms timer, so
 * during a scroll -- exactly when the sticky player is changing size and
 * position -- every patch is drawn against a stale player rect for up to
 * a quarter of a second.
 *
 * Clipping to the VIDEO rect cannot expose anybody: the pixels removed
 * are outside the picture, so there is no subject in them. Returns null
 * when nothing is left, and the caller hides the overlay.
 */
export function clipToBounds(rect, bounds) {
  var l = Math.max(rect.left, bounds.left);
  var t = Math.max(rect.top, bounds.top);
  var r = Math.min(rect.left + rect.width, bounds.right);
  var b = Math.min(rect.top + rect.height, bounds.bottom);
  if (!(r - l > 0) || !(b - t > 0)) return null;
  return { left: l, top: t, width: Math.round(r - l), height: Math.round(b - t) };
}

// THE CLIP LAYER, AND WHY THE ARITHMETIC VERSION WAS NOT ENOUGH.
//
// clipToBounds above bounds a patch against `entry.vr` -- the video rect
// as of the last refresh. That is only a guarantee while that rect is
// current, and the failure the owner photographed is precisely a case
// where it might not be: the player changing shape or place under a
// scroll. Measured afterwards, the sticky player does NOT drift during a
// scroll (0px across 8 samples at 250ms), so the mechanism behind his
// frame is not established -- which is exactly why the fix should not
// depend on knowing it.
//
// So the overlays live inside a layer that is `inset:0` of the player
// with `overflow:hidden`. The browser lays that out from the player's
// CURRENT geometry every paint, with no cached rect and no read of ours
// involved, so a patch cannot paint outside the player no matter how
// stale anything we computed has become. The arithmetic clip stays as
// the tighter of the two (it bounds to the VIDEO, which is inside the
// player when the picture is letterboxed).
//
// z-index moves here with it: one stacking context at 20 -- above
// .html5-video-container (10) and below .ytp-chrome-bottom (59), the
// band measured against the live player in 2026-08-25.
function clipLayer(entry) {
  if (entry.clip && entry.clip.isConnected) return entry.clip;
  // A DETACHED HOST MUST NOT BE HANDED A NEW LAYER, and now that the
  // re-parent runs every FRAME rather than every pass, an unguarded
  // rebuild is 60 orphan nodes a second into a corpse instead of 4.
  // `refreshRects` tears the entry down when the host leaves the
  // document, but it runs on a 250ms timer and a ResizeObserver, so
  // ~15 frames can land in between. Returning null is safe in both
  // directions: an overlay that finds no layer is simply not re-parented
  // this frame, and the next frame with a live host puts it back.
  if (entry.host && entry.host.isConnected === false) return null;
  var c = document.createElement('div');
  c.className = 'ts-gaze-vregion-clip';
  c.style.cssText =
    'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:20;';
  entry.host.appendChild(c);
  entry.clip = c;
  return c;
}

// ONE OVERLAY, ONE FRAME -- the render body factored out of the
// `entry.tracks` loop (Task 9) so the timeline path below can draw
// through the EXACT SAME pipeline (no second render path): `track` only
// needs `.box` and optionally `.vx/.vy/.vw/.vh` (interpolateBox no-ops
// on missing velocities), and `elapsedMs` is 0 for a timeline item
// (already interpolated by boxesAt) or the real gap since the last
// setTracks call for the velocity path.
function renderTrackOverlay(entry, vr, index, track, elapsedMs) {
  renderStats.overlayFrames++;
  // `display` was assigned unconditionally 60x/s per overlay, one line
  // below the transform-string compare that exists precisely because an
  // identical assignment still crosses CSSOM. Measured at 140-160
  // writes/s on this build, all but a handful of them redundant.
  if (entry.overlays[index].__tsDisp !== 1) {
    renderStats.dispWrites++;
    entry.overlays[index].style.display = '';
    entry.overlays[index].__tsDisp = 1;
  }
  var target = boxToHostRect(entry.hr, vr, interpolateBox(track, elapsedMs));
  entry.rendered[index] = lerpRect(entry.rendered[index], target);
  var lerped = entry.rendered[index];
  // The feather is added OUTSIDE what the pipeline asked for, so the
  // opaque core of the mask still covers the full requested box. Growing
  // the element is what makes the soft edge free of under-cover.
  // INTEGER MASK GEOMETRY, AND IT IS A PERFORMANCE FIX WITH A NUMBER.
  //
  // maskFor rebuilds ~20 strings from `drawn` every rAF frame for every
  // overlay, and applyMask writes TEN CSSOM properties when the string
  // differs -- on a backdrop-filter element, the most expensive class in
  // the tree to invalidate. Measured on this build, man t=890, 60s
  // continuous: 140-160 maskFor calls/s with mask_write_frac 0.56-0.58,
  // i.e. ~85 full mask rewrites a second, ~850 style writes.
  //
  // Almost none of that is real. lerpRect is asymptotic and SHRINK_DEADBAND
  // parks an edge without ever equalling the target, so `drawn.width`
  // changes by a sub-pixel amount essentially every frame for ever, and
  // the string changes with it. Hole offsets were already rounded and are
  // invariant under pure translation, so with the SIZE rounded too a
  // patch that is merely sliding or settling produces a byte-identical
  // string and applyMask early-outs.
  //
  // Rounding `f` first keeps the ramp, the grow and the element in exact
  // register: the previous code grew the element by f/2 unrounded while
  // place() wrote a size only on a >=2px change, so mask and element were
  // out of register by up to 2px and `mask-repeat: no-repeat` left the
  // outermost strip of the ramp truncated.
  //
  // Cannot change coverage by more than half a pixel in either direction.
  var f = Math.round(featherFor(lerped));
  // Half the ramp sits outside the requested box, half inside. See the
  // note above featherFor: outward-only tripled the blurred area once f
  // scaled with the patch.
  var drawn = clipToBounds(drawnRect(lerped, f), {
    left: vr.left - entry.hr.left,
    top: vr.top - entry.hr.top,
    right: vr.left - entry.hr.left + vr.width,
    bottom: vr.top - entry.hr.top + vr.height,
  });
  if (!drawn) {
    // Entirely outside the picture: nothing to cover.
    renderStats.hideClipped++;
    if (entry.overlays[index].__tsDisp !== 0) {
      renderStats.dispWrites++;
      entry.overlays[index].style.display = 'none';
      entry.overlays[index].__tsDisp = 0;
    }
    return;
  }
  // Everything above is in VIEWPORT units (both rects came from
  // getBoundingClientRect). The element writes below are in the host's
  // LOCAL units, which an ancestor transform scales again -- so convert
  // once, here, and give the mask the same converted geometry so the
  // two stay in register.
  // THE FIFTH WAY A PATCH BECOMES INVISIBLE, and the four counters
  // above cannot name it. clipToBounds accepts any sliver with
  // `r - l > 0` and then ROUNDS the size, so a 0.4px overlap survives
  // the null test and is written as `width: 0px` -- an overlay that
  // exists, is display:'', and paints nothing. A probe counting
  // rendered patches sees the same thing a hidden one produces.
  if (drawn.width === 0 || drawn.height === 0) renderStats.drawnZero++;
  var hs = entry.scale || 1;
  var local = toLocalRect(drawn, hs);
  place(entry.overlays[index], local);
  applyMask(entry.overlays[index], maskFor(local, hs === 1 ? f : Math.round(f / hs)));
}

function reposition(entry, now) {
  // RE-PARENTING ONCE PER PASS IS TOO SLOW, MEASURED ON A BUILT APK.
  // The first version of this guard lived only at the end of setTracks,
  // so recovery took one VERDICT pass -- and the emulator's measured gap
  // is p50 5,305ms against a blurred track's ~4s coast, so the track
  // died before the pass arrived and the patch never came back at all.
  // Live run: layer removed with 3 patches inside it, tracks still 3 at
  // +2s and +4s, clipRebuilt 0, visible 0, then the entry was torn down.
  //
  // Here it costs one `isConnected` read plus one pointer compare per
  // overlay per frame -- NO layout, unlike the forced-rect refresh that
  // got a previous attempt at this reverted -- and recovery is one frame.
  var layer = clipLayer(entry);
  if (layer) {
    for (var p = 0; p < entry.overlays.length; p++) {
      if (entry.overlays[p].parentNode !== layer) {
        renderStats.clipRebuilt++;
        layer.appendChild(entry.overlays[p]);
      }
    }
  }
  var vr = entry.vr;
  if (!vr || vr.width === 0 || vr.height === 0) {
    if (!vr) renderStats.hideNoVr++;
    else renderStats.hideZeroVr++;
    for (var i = 0; i < entry.overlays.length; i++) {
      if (entry.overlays[i].__tsDisp !== 0) {
        renderStats.dispWrites++;
        entry.overlays[i].style.display = 'none';
        entry.overlays[i].__tsDisp = 0;
      }
    }
    return;
  }

  // TIMELINE FIRST (Task 9, Stage B): a video with an attached timeline
  // asks it for the boxes at the presented media time on every frame,
  // rather than extrapolating the last verdict's velocity. `entry.tracks`
  // is left completely untouched here -- it still holds whatever
  // setTracks last set -- so a frame where `boxesFn` returns null (no
  // verdict at/after the presented time yet) falls back to the ordinary
  // `entry.tracks` + elapsed path exactly as if no timeline were attached
  // at all, with no state to unwind.
  var boxesFn = timelines.get(entry.video);
  if (boxesFn) {
    var live = boxesFn();
    if (live) {
      renderStats.timelineFrames++;
      // 'cleared' is a real answer from the timeline (a person who is on
      // screen and resolved un-blurred), not a track this renderer draws
      // a patch for -- filtered BEFORE reconciling, so a cleared id never
      // even claims an overlay node.
      var timelineTracks = [];
      for (var q = 0; q < live.length; q++) {
        if (live[q].state === 'cleared') continue;
        timelineTracks.push({ key: String(live[q].id), box: live[q].box, vx: 0, vy: 0, vw: 0, vh: 0 });
      }
      reconcileOverlays(entry, timelineTracks);
      for (var t = 0; t < timelineTracks.length; t++) {
        // No velocity: boxesAt already interpolated this box to the
        // presented media time, so extrapolating it further here would
        // double-apply motion the timeline has already accounted for.
        renderTrackOverlay(entry, vr, t, timelineTracks[t], 0);
      }
      return;
    }
    renderStats.timelineFallback++;
    // fall through to the ordinary entry.tracks + elapsed path below.
  }

  var elapsed = now - entry.at;
  for (var j = 0; j < entry.tracks.length; j++) {
    renderTrackOverlay(entry, vr, j, entry.tracks[j], elapsed);
  }
}

/**
 * Test-only hook (Task 9): looks up the live entry for `video` and runs
 * one `reposition` pass against it, so a test can drive the render loop
 * deterministically instead of waiting on `requestAnimationFrame`. `now`
 * only matters for the non-timeline path (`elapsed = now - entry.at`);
 * the timeline path always renders with elapsedMs 0.
 */
export function _reposition(video, now) {
  var entry = entries.get(video);
  if (!entry) return;
  reposition(entry, now);
}

// A SCROLL MOVES THE PLAYER, AND THE 250ms TIMER IS TOO SLOW FOR IT.
//
// Reading the rects every frame is the thing this renderer was rebuilt
// to stop doing (140-160 forced layouts a second). So the scroll only
// marks them dirty, and the next rAF frame -- which is already running
// -- pays for one read. Passive and capturing, because YouTube's own
// scroller is not the window on mobile.
var rectsDirty = false;
function markRectsDirty() {
  rectsDirty = true;
}
try {
  addEventListener('scroll', markRectsDirty, { passive: true, capture: true });
  addEventListener('resize', markRectsDirty, { passive: true });
} catch (e) {
  /* no listener is the old 250ms behaviour, not a broken patch */
}

function loop(video) {
  var entry = entries.get(video);
  if (!entry) return;
  renderStats.raf++;
  if (rectsDirty) {
    rectsDirty = false;
    refreshRects(entry);
  }
  reposition(entry, performance.now());
  entry.raf = requestAnimationFrame(function () {
    loop(video);
  });
}

/**
 * Whether the player can host anchored overlays. Without a resolvable
 * player container (or backdrop-filter), the caller keeps whole blur.
 */
export function canRegionVideo(video) {
  return !!resolveHost(video);
}

// ENSURE N OVERLAYS FOR N ITEMS, KEYED BY IDENTITY -- factored out of
// setTracks (Task 9) so the timeline render path in `reposition` can
// reconcile its own item count through the exact same logic instead of
// a second, drifting copy of it.
//
// Overlays are keyed to TRACK IDENTITY (review A9): same-count churn
// (one track dies, another is born in the same pass) must not lerp a
// dead person's rect toward a new person's — each key keeps its own
// overlay + render state; unknown keys get fresh nodes, missing keys
// are removed. Tracks without keys fall back to positional pairing.
//
// `tracks` here only needs a `.key` per item -- setTracks passes real
// person-tracker tracks (whose `key` may be a `+`-joined merge id), and
// the timeline path in `reposition` passes `{ key: String(item.id) }`
// wrappers built from the timeline's `{id, box, state}` shape. Neither
// caller's `box`/`vx`/`vy` fields are read here; those are read at
// render time, per item, by the caller.
function reconcileOverlays(entry, tracks) {
  var nextOverlays = [];
  var nextRendered = [];
  var byKey = {};
  for (var i = 0; i < entry.overlays.length; i++) {
    var k = entry.overlays[i].__tsKey;
    if (k) byKey[k] = i;
  }
  var used = new Array(entry.overlays.length).fill(false);
  // Keys some LATER track will claim exactly. Adoption must never steal
  // a node out from under an exact match, or two patches trade places
  // every time the merge set changes.
  var claimedKeys = {};
  for (var ck = 0; ck < tracks.length; ck++) {
    if (tracks[ck].key && byKey[tracks[ck].key] !== undefined) claimedKeys[tracks[ck].key] = 1;
  }
  for (var b = 0; b < tracks.length; b++) {
    var key = tracks[b].key;
    var idx = key && byKey[key] !== undefined && !used[byKey[key]] ? byKey[key] : -1;
    if (idx === -1) {
      // Positional fallback for keyless tracks (setBoxes shim).
      if (!key && b < entry.overlays.length && !used[b]) idx = b;
    }
    // ADOPT THE NODE WHEN THE KEY CHANGES BUT THE PEOPLE DID NOT.
    //
    // Keys are '+'-joined track ids, so a merge, an unmerge, or a
    // re-ordered group all produce a DIFFERENT string for the same
    // humans. Treated as a new key that costs a destroy-and-rebuild, and
    // a rebuild pushes `null` below -- and lerpRect(null, to) returns the
    // target outright, the ONE path in this renderer that skips both
    // SHRINK_DEADBAND and SHRINK_LERP. Unmerging '7+9' into '7' then
    // drops the drawn rect from the UNION of two boxes to one box in a
    // single frame: the largest step this renderer can produce, at an
    // UNCHANGED patch count, so dCount and stable_frac record nothing.
    //
    // So: if no exact key matched, adopt the unused overlay sharing the
    // most member ids. That keeps the node (and with it __tsW/__tsH/
    // __tsTf, the compositing layer and the backdrop snapshot) and keeps
    // its rendered rect, so the change GLIDES through the damper like any
    // other size change. Inheriting a union rect can only ever start the
    // patch too LARGE and shrink it, which cannot expose anyone.
    if (idx === -1 && key) {
      var want = memberSet(key);
      var bestIdx = -1;
      var bestShare = 0;
      for (var c = 0; c < entry.overlays.length; c++) {
        if (used[c]) continue;
        var have = entry.overlays[c].__tsKey;
        if (!have || claimedKeys[have]) continue;
        var share = shareCount(want, have);
        if (share > bestShare) {
          bestShare = share;
          bestIdx = c;
        }
      }
      if (bestIdx !== -1) idx = bestIdx;
    }
    if (idx !== -1) {
      used[idx] = true;
      entry.overlays[idx].__tsKey = key || '';
      nextOverlays.push(entry.overlays[idx]);
      nextRendered.push(entry.rendered[idx] || null);
    } else {
      var o = makeOverlay(key);
      o.className = HOST_CLASS;
      o.__tsKey = key || '';
      var lay = clipLayer(entry);
      if (lay) lay.appendChild(o);
      nextOverlays.push(o);
      nextRendered.push(null); // fresh patch snaps to place, no glide-in
    }
  }
  for (var r = 0; r < entry.overlays.length; r++) {
    if (!used[r] && nextOverlays.indexOf(entry.overlays[r]) === -1) {
      if (entry.overlays[r].parentNode) entry.overlays[r].parentNode.removeChild(entry.overlays[r]);
    }
  }
  entry.overlays = nextOverlays;
  entry.rendered = nextRendered;
}

/**
 * Attach a live boxes source to a playing video (Task 9, Stage B): once
 * set, `reposition` prefers `boxesFn()` over `entry.tracks` + velocity
 * extrapolation. `boxesFn` takes no arguments and returns either
 * `[{id, box:{x1,y1,x2,y2}, state:'blurred'|'cleared'}]` for the
 * currently PRESENTED media time (see track-timeline.mjs `boxesAt`), or
 * `null` when no verdict at/after that time exists yet -- the caller
 * (init-entry, Task 10) hands over
 * `function () { return boxesAt(timeline, presenter.presentedMediaTime()); }`
 * or equivalent. A 'cleared' item is never drawn as a patch.
 *
 * Callable before the video has any tracks at all (the presenter can be
 * wired ahead of the first cover), and it outlives every entry:
 * `clear(video)` does not touch it, only clearTimeline does.
 */
export function setTimeline(video, boxesFn) {
  timelines.set(video, boxesFn);
}

/**
 * Detach a video's timeline (pill off, `loadstart`, presenter torn
 * down): `reposition` returns to the plain `entry.tracks` + elapsed
 * velocity path.
 */
export function clearTimeline(video) {
  timelines.delete(video);
}

/**
 * Set (or update) the blurred tracks on a playing video. tracks:
 * [{ box: {x1,y1,x2,y2}, vx, vy }] — box normalized 0..1 of the video
 * frame, velocities in normalized units per SECOND (person-track.mjs
 * blurredTracks output). The rAF loop interpolates between calls.
 */
export function setTracks(video, tracks) {
  var host = resolveHost(video);
  if (!host || !tracks || !tracks.length) {
    clear(video);
    return false;
  }
  var entry = entries.get(video);
  if (!entry) {
    // Absolute children need a positioned ancestor; YouTube's player is
    // position:relative already — belt-and-braces for other hosts.
    try {
      if (window.getComputedStyle(host).position === 'static') {
        host.style.position = 'relative';
      }
    } catch (e) {
      /* non-fatal: worst case overlays anchor to a further ancestor */
    }
    entry = {
      host: host,
      video: video,
      tracks: tracks,
      at: performance.now(),
      overlays: [],
      rendered: [],
      raf: 0,
      timer: 0,
      ro: null,
      hr: null,
      vr: null,
      clip: null,
    };
    entries.set(video, entry);
    refreshRects(entry);
    // Rect refresh lives OUTSIDE the rAF loop: a slow timer catches
    // scroll/theater drift, a ResizeObserver catches player resizes the
    // frame they happen.
    entry.timer = setInterval(function () {
      refreshRects(entry);
    }, RECT_REFRESH_MS);
    if (typeof ResizeObserver === 'function') {
      entry.ro = new ResizeObserver(function () {
        refreshRects(entry);
      });
      try {
        entry.ro.observe(host);
        entry.ro.observe(video);
      } catch (e) {
        /* observer refusal: the timer still refreshes */
      }
    }
  } else {
    entry.tracks = tracks;
    entry.at = performance.now();
  }
  reconcileOverlays(entry, tracks);
  // A CLIP LAYER THE PAGE REMOVED STRANDS EVERY REUSED OVERLAY.
  // `clipLayer` rebuilds the layer only when it is ASKED for one, and it
  // is asked only when a NEW overlay is created -- so a pass carrying the
  // same boxes reuses every node and never reaches it, and a pass whose
  // box COUNT changed rebuilds the layer with only the NEW overlay in it
  // and leaves the reused ones stranded (measured against the pre-fix
  // source: 1 of 2 patches in the player).
  //
  // THE MECHANISM IS NOT A RE-CREATED PLAYER, and the first write-up of
  // this said it was. `#movie_player` SURVIVES -- measured across a seek
  // and two SPA navigations, hostSwaps 0 -- and the page removes OUR
  // CHILD out of it. A genuinely re-created player would swap the host,
  // and refreshRects's connectedness guard would tear the entry down and
  // rebuild everything. Measured in the wild on the shipped build: a
  // layer removed with three overlays still inside it, host connected,
  // video connected.
  //
  // Re-parenting is monotone -- it can only ever put a patch BACK -- and
  // it lives in `reposition`, which this call reaches and which the rAF
  // loop reaches every frame. Once per PASS was measured too slow: the
  // track coasts out before the next verdict arrives.
  reposition(entry, entry.at);
  if (!entry.raf) loop(video);
  return true;
}

/** Track ids inside a merged key, as a lookup. */
export function memberSet(key) {
  var out = {};
  var parts = String(key || '').split('+');
  for (var i = 0; i < parts.length; i++) if (parts[i]) out[parts[i]] = 1;
  return out;
}

/** How many track ids two keys have in common. */
export function shareCount(want, key) {
  var parts = String(key || '').split('+');
  var n = 0;
  for (var i = 0; i < parts.length; i++) if (parts[i] && want[parts[i]]) n++;
  return n;
}

/** Back-compat shim: static boxes = tracks with zero velocity. */
export function setBoxes(video, boxes) {
  var tracks = [];
  for (var i = 0; i < (boxes ? boxes.length : 0); i++) {
    tracks.push({ box: boxes[i], vx: 0, vy: 0 });
  }
  return setTracks(video, tracks);
}

/** Remove all region overlays for one video. */
export function clear(video) {
  var entry = entries.get(video);
  if (!entry) return;
  if (entry.raf) cancelAnimationFrame(entry.raf);
  if (entry.timer) clearInterval(entry.timer);
  if (entry.ro) {
    try {
      entry.ro.disconnect();
    } catch (e) {
      /* already dead */
    }
  }
  for (var i = 0; i < entry.overlays.length; i++) {
    if (entry.overlays[i].parentNode) entry.overlays[i].parentNode.removeChild(entry.overlays[i]);
  }
  if (entry.clip && entry.clip.parentNode) entry.clip.parentNode.removeChild(entry.clip);
  entry.clip = null;
  entries.delete(video);
}

/** Fail-open sweep support: tear every player overlay down. */
export function clearAll() {
  var vids = [];
  entries.forEach(function (_entry, video) {
    vids.push(video);
  });
  for (var i = 0; i < vids.length; i++) clear(vids[i]);
}
