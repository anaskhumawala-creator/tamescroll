// Face-region blur for the WATCH PLAYER (owner ask 2026-08-24: blur just
// the face on a playing video, not the whole frame — HaramBlur parity).
//
// Why a separate module from region-blur.mjs (thumbnails): those overlays
// are anchored in document.body. Element fullscreen — and Android's native
// custom-view fullscreen — render ONLY the fullscreen subtree, so a body
// overlay vanishes the instant the user goes fullscreen and exposes the
// face. These overlays are anchored INSIDE the player element (same reason
// the in-player pill lives there), so the blur survives fullscreen.
//
// The video element is effectively fixed on screen, so the only motion an
// overlay must chase is the face moving WITHIN the frame — the caller
// re-detects fast and calls setBoxes; between detections a per-box pad
// (caller-side) cushions the drift. A rAF loop keeps each overlay pinned
// to the live video rect so scroll / player resize / fullscreen transition
// never slide the blur off the face.

var HOST_CLASS = 'ts-gaze-vregion-host';

// video -> { host, video, boxes, overlays, raf }
var entries = new Map();

/**
 * Pure mapping: a normalized (0..1) face box -> a viewport-space fixed
 * rect, from the video's current on-screen rect. Overlays are
 * position:fixed, so viewport coordinates are exactly what they want, and
 * getBoundingClientRect already reflects scroll and fullscreen scaling.
 * Exported for tests.
 */
export function boxToFixedRect(videoRect, box) {
  return {
    left: videoRect.left + box.x1 * videoRect.width,
    top: videoRect.top + box.y1 * videoRect.height,
    width: (box.x2 - box.x1) * videoRect.width,
    height: (box.y2 - box.y1) * videoRect.height,
  };
}

// The overlay host lives inside the player so fullscreen keeps it painted.
// Falls back to null when no player container is found — the caller then
// keeps whole-video blur.
function resolveHost(video) {
  return (video.closest && video.closest('#movie_player')) || null;
}

function makeOverlay() {
  var d = document.createElement('div');
  d.style.cssText =
    'position:fixed;pointer-events:none;border-radius:28%;' +
    'backdrop-filter:blur(var(--ts-blur-strong,24px));' +
    '-webkit-backdrop-filter:blur(var(--ts-blur-strong,24px));';
  return d;
}

function place(overlay, rect) {
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.top + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
}

function reposition(entry) {
  if (!entry.video.isConnected) {
    clear(entry.video);
    return;
  }
  var vr = entry.video.getBoundingClientRect();
  if (vr.width === 0 || vr.height === 0) {
    // Player detached/hidden: park the overlays rather than paint them at
    // 0,0. They resume next frame once the rect is real again.
    for (var i = 0; i < entry.overlays.length; i++) entry.overlays[i].style.display = 'none';
    return;
  }
  for (var j = 0; j < entry.boxes.length; j++) {
    entry.overlays[j].style.display = '';
    place(entry.overlays[j], boxToFixedRect(vr, entry.boxes[j]));
  }
}

function loop(video) {
  var entry = entries.get(video);
  if (!entry) return;
  reposition(entry);
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
 * Set (or update) the face boxes covered on a playing video. Reuses
 * overlays when the count is unchanged so the rAF loop just moves them.
 * boxes: [{ x1, y1, x2, y2 }] normalized 0..1.
 */
export function setBoxes(video, boxes) {
  var host = resolveHost(video);
  if (!host || !boxes || !boxes.length) {
    clear(video);
    return false;
  }
  var entry = entries.get(video);
  if (!entry) {
    entry = { host: host, video: video, boxes: boxes, overlays: [], raf: 0 };
    entries.set(video, entry);
  } else {
    entry.boxes = boxes;
  }
  // Rebuild overlays only when the count changes; steady state reuses them.
  if (entry.overlays.length !== boxes.length) {
    for (var i = 0; i < entry.overlays.length; i++) {
      if (entry.overlays[i].parentNode) entry.overlays[i].parentNode.removeChild(entry.overlays[i]);
    }
    entry.overlays = [];
    for (var b = 0; b < boxes.length; b++) {
      var o = makeOverlay();
      o.className = HOST_CLASS;
      entry.overlays.push(o);
      host.appendChild(o);
    }
  }
  reposition(entry);
  if (!entry.raf) loop(video);
  return true;
}

/** Remove all region overlays for one video. */
export function clear(video) {
  var entry = entries.get(video);
  if (!entry) return;
  if (entry.raf) cancelAnimationFrame(entry.raf);
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
