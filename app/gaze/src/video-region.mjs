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

function makeOverlay() {
  var d = document.createElement('div');
  // Near-rectangular patch; z-index above the video but below ytp
  // controls. Position moves by TRANSLATE only (compositor-only);
  // size is a real width/height write, but only when it actually
  // changed — a non-uniform transform scale warped the rounded
  // corners (owner 2026-08-24: "rounded edges are distorting").
  d.style.cssText =
    'position:absolute;left:0;top:0;width:' + BASE_PX + 'px;height:' + BASE_PX + 'px;' +
    'pointer-events:none;border-radius:8px;z-index:5;' +
    'will-change:transform;' +
    'backdrop-filter:blur(var(--ts-blur-strong,24px));' +
    '-webkit-backdrop-filter:blur(var(--ts-blur-strong,24px));';
  return d;
}

function place(overlay, rect) {
  overlay.style.transform = 'translate(' + rect.left + 'px,' + rect.top + 'px)';
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

function lerpRect(from, to) {
  if (!from) return to;
  return {
    left: from.left + (to.left - from.left) * RENDER_LERP,
    top: from.top + (to.top - from.top) * RENDER_LERP,
    width: from.width + (to.width - from.width) * RENDER_LERP,
    height: from.height + (to.height - from.height) * RENDER_LERP,
  };
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
    place(entry.overlays[j], entry.rendered[j]);
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
  // Rebuild overlays only when the count changes; steady state reuses.
  if (entry.overlays.length !== tracks.length) {
    for (var i = 0; i < entry.overlays.length; i++) {
      if (entry.overlays[i].parentNode) entry.overlays[i].parentNode.removeChild(entry.overlays[i]);
    }
    entry.overlays = [];
    entry.rendered = [];
    for (var b = 0; b < tracks.length; b++) {
      var o = makeOverlay();
      o.className = HOST_CLASS;
      entry.overlays.push(o);
      entry.host.appendChild(o);
    }
  }
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
