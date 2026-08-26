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
function resolveHost(video) {
  return (video.closest && video.closest('#movie_player')) || null;
}

function makeOverlay(key) {
  var d = document.createElement('div');
  // A patch SPLIT around a cleared person's head (person-track's
  // subtractBox) meets its siblings along four straight seams, and the
  // 8px corner radius below rounds every piece AWAY from those
  // junctions — leaving four ~16px squares of the covered person sharp
  // at the hole's corners on a 1080p player, which is the very class the
  // split exists to reduce. Pieces are square-cornered; only whole
  // patches keep the rounding.
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
    'pointer-events:none;border-radius:' + (pieceKey ? '0' : '8px') + ';z-index:20;' +
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
// A blurred patch has to stay off a CLEARED person's head, and until now
// that was done by SPLITTING it into up to four sibling rectangles. That
// split is what the owner sees as "multiple boxes here and there"
// (2026-08-26): drawn patches exceeded live tracks on 44% of samples,
// most often 3 patches from 2 tracks on a two-person scene. Every piece
// is also its own node with its own backdrop-filter, so the seams cost
// frame time too, and he raised performance in the same message.
//
// Two mask layers composited with `exclude` punch the hole in ONE
// element: layer 1 covers the whole patch, layer 2 covers each hole, and
// `exclude` subtracts the second from the first.
//
// MEASURED LIVE IN THE REAL WEBVIEW BEFORE THIS WAS BUILT, because
// CSS.supports is not evidence here — it returns true for
// `clip-path: path(evenodd, ...)` and an element carrying one paints
// NOTHING, side by side with an identical unclipped control that blurs
// correctly. The mask construction was verified by pixel instead
// (spikes/gauntlet/runs/clip-spike2.png: one element, blurred, with a
// genuinely sharp rectangle inside it).
//
// Both the unprefixed and -webkit- forms are written: WebView2 takes
// `mask-composite: exclude`, older Android WebViews take
// `-webkit-mask-composite: xor`, and a WebView that understands neither
// simply ignores the mask and draws the solid patch — which OVER-covers,
// the safe direction, and never exposes anyone.
function maskFor(rect, holes) {
  if (!holes || !holes.length) return '';
  var sizes = [rect.width + 'px ' + rect.height + 'px'];
  var pos = ['0px 0px'];
  for (var i = 0; i < holes.length; i++) {
    var h = holes[i];
    var w = Math.max(0, h.right - h.left);
    var ht = Math.max(0, h.bottom - h.top);
    if (w <= 0 || ht <= 0) continue;
    sizes.push(w + 'px ' + ht + 'px');
    pos.push(h.left - rect.left + 'px ' + (h.top - rect.top) + 'px');
  }
  if (sizes.length < 2) return '';
  var img = [];
  for (var k = 0; k < sizes.length; k++) img.push('linear-gradient(#000,#000)');
  return (
    img.join(',') + '|' + sizes.join(',') + '|' + pos.join(',')
  );
}

function applyMask(overlay, spec) {
  if (overlay.__tsMask === spec) return; // style writes cost recalc
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
  st.maskComposite = 'exclude';
  st.webkitMaskComposite = 'xor';
}

function place(overlay, rect) {
  // The transform write is unconditional no longer. lerpRect settles, and
  // the shrink deadband can hold an edge indefinitely, so a static shot
  // asks for the SAME transform 60 times a second. Assigning an identical
  // string still crosses CSSOM every time; comparing it does not.
  var tf = 'translate(' + rect.left + 'px,' + rect.top + 'px)';
  if (overlay.__tsTf !== tf) {
    overlay.style.transform = tf;
    overlay.__tsTf = tf;
  }
  // Size writes cost layout — skip when the change is sub-2px.
  if (Math.abs((overlay.__tsW || 0) - rect.width) >= 2) {
    overlay.style.width = rect.width + 'px';
    overlay.__tsW = rect.width;
  }
  if (Math.abs((overlay.__tsH || 0) - rect.height) >= 2) {
    overlay.style.height = rect.height + 'px';
    overlay.__tsH = rect.height;
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
var SHRINK_DEADBAND = 0.05;

/** One edge, moving inward: hold it if the step is noise, else glide. */
function inward(fromEdge, toEdge, span, sign) {
  var step = (toEdge - fromEdge) * sign;
  if (step > 0 && step < span * SHRINK_DEADBAND) return fromEdge;
  return fromEdge + (toEdge - fromEdge) * RENDER_LERP;
}

// Below this the glide is OVER. A 0.25 lerp is asymptotic, so without an
// epsilon the drawn rect differs from its target for ever: the transform
// string is rewritten 60 times a second through a completely static shot,
// for sub-pixel motion nobody can see. Battery and thermal on a phone,
// which is the machine that matters (owner 2026-08-26: "optimization is a
// real concern btw cuz yt app already feels slow"). Snapping to the
// target rather than holding `from` keeps this from ever shrinking the
// drawn patch below what the pipeline asked for.
var SETTLE_PX = 0.25;

export function lerpRect(from, to) {
  if (!from) return to;
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
  var l = Math.min(to.left, inward(from.left, to.left, from.width, 1));
  var t = Math.min(to.top, inward(from.top, to.top, from.height, 1));
  var r = Math.max(tr, inward(fr, tr, from.width, -1));
  var b = Math.max(tb, inward(fb, tb, from.height, -1));
  return { left: l, top: t, width: r - l, height: b - t };
}

function refreshRects(entry) {
  if (!entry.video.isConnected || !entry.host.isConnected) {
    clear(entry.video);
    return;
  }
  entry.hr = entry.host.getBoundingClientRect();
  entry.vr = entry.video.getBoundingClientRect();
}

function reposition(entry, now) {
  var vr = entry.vr;
  if (!vr || vr.width === 0 || vr.height === 0) {
    for (var i = 0; i < entry.overlays.length; i++) entry.overlays[i].style.display = 'none';
    return;
  }
  var elapsed = now - entry.at;
  for (var j = 0; j < entry.tracks.length; j++) {
    entry.overlays[j].style.display = '';
    var target = boxToHostRect(entry.hr, vr, interpolateBox(entry.tracks[j], elapsed));
    entry.rendered[j] = lerpRect(entry.rendered[j], target);
    var drawn = entry.rendered[j];
    place(entry.overlays[j], drawn);
    // Holes are pinned to the VIDEO, not to the patch, so they are
    // converted with the same rect maths and then expressed relative to
    // wherever the patch was actually drawn this frame. A hole that
    // travelled with the patch would slide off the head it exists to
    // keep sharp.
    var hs = entry.tracks[j].holes;
    var px = null;
    if (hs && hs.length) {
      px = [];
      for (var q = 0; q < hs.length; q++) {
        var hr2 = boxToHostRect(entry.hr, vr, hs[q]);
        px.push({
          left: hr2.left,
          top: hr2.top,
          right: hr2.left + hr2.width,
          bottom: hr2.top + hr2.height,
        });
      }
    }
    applyMask(entry.overlays[j], maskFor(drawn, px));
  }
}

function loop(video) {
  var entry = entries.get(video);
  if (!entry) return;
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
  // Overlays are keyed to TRACK IDENTITY (review A9): same-count churn
  // (one track dies, another is born in the same pass) must not lerp a
  // dead person's rect toward a new person's — each key keeps its own
  // overlay + render state; unknown keys get fresh nodes, missing keys
  // are removed. Tracks without keys fall back to positional pairing.
  var nextOverlays = [];
  var nextRendered = [];
  var byKey = {};
  for (var i = 0; i < entry.overlays.length; i++) {
    var k = entry.overlays[i].__tsKey;
    if (k) byKey[k] = i;
  }
  var used = new Array(entry.overlays.length).fill(false);
  for (var b = 0; b < tracks.length; b++) {
    var key = tracks[b].key;
    var idx = key && byKey[key] !== undefined && !used[byKey[key]] ? byKey[key] : -1;
    if (idx === -1) {
      // Positional fallback for keyless tracks (setBoxes shim).
      if (!key && b < entry.overlays.length && !used[b]) idx = b;
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
      entry.host.appendChild(o);
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
  reposition(entry, entry.at);
  if (!entry.raf) loop(video);
  return true;
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
