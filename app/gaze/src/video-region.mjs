// Person-region blur for the WATCH PLAYER (owner ask 2026-08-24: blur the
// blocked person on a playing video, not the whole frame — HaramBlur
// parity, extended to whole-body coverage via expandToBody caller-side).
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
// overlay can land at wildly wrong coordinates (v1 of this module did
// exactly that; owner report "in-video blur never worked"). Absolute
// coords are computed player-relative from two getBoundingClientRects,
// which stay correct under any ancestor transform. A rAF loop re-pins
// every frame so player resize / theater / fullscreen transitions never
// drift the patch.

var HOST_CLASS = 'ts-gaze-vregion-host';

// video -> { host, video, boxes, overlays, raf }
var entries = new Map();

/**
 * Pure mapping: a normalized (0..1) box on the video -> a rect in the
 * PLAYER's coordinate space (for position:absolute children of the
 * player). Both rects come from getBoundingClientRect, so any ancestor
 * transform cancels out of the subtraction. Exported for tests.
 */
export function boxToHostRect(hostRect, videoRect, box) {
  return {
    left: videoRect.left - hostRect.left + box.x1 * videoRect.width,
    top: videoRect.top - hostRect.top + box.y1 * videoRect.height,
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
  // Near-rectangular patch (owner 2026-08-24: heavy rounding looked
  // wrong); z-index above the video but below ytp controls (they sit at
  // 2147483647-ish only in fullscreen; 59 clears the video + gradients
  // while staying under the control bar so scrubbing stays visible).
  d.style.cssText =
    'position:absolute;pointer-events:none;border-radius:8px;z-index:59;' +
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
  if (!entry.video.isConnected || !entry.host.isConnected) {
    clear(entry.video);
    return;
  }
  var hr = entry.host.getBoundingClientRect();
  var vr = entry.video.getBoundingClientRect();
  if (vr.width === 0 || vr.height === 0) {
    // Player detached/hidden: park the overlays rather than paint them at
    // 0,0. They resume next frame once the rect is real again.
    for (var i = 0; i < entry.overlays.length; i++) entry.overlays[i].style.display = 'none';
    return;
  }
  for (var j = 0; j < entry.boxes.length; j++) {
    entry.overlays[j].style.display = '';
    place(entry.overlays[j], boxToHostRect(hr, vr, entry.boxes[j]));
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
 * Set (or update) the region boxes covered on a playing video. Reuses
 * overlays when the count is unchanged so the rAF loop just moves them.
 * boxes: [{ x1, y1, x2, y2 }] normalized 0..1 of the video frame.
 */
export function setBoxes(video, boxes) {
  var host = resolveHost(video);
  if (!host || !boxes || !boxes.length) {
    clear(video);
    return false;
  }
  var entry = entries.get(video);
  if (!entry) {
    // Absolute children need a positioned ancestor; YouTube's player is
    // position:relative already, but belt-and-braces for other hosts —
    // only touch it when it would otherwise be static.
    try {
      if (window.getComputedStyle(host).position === 'static') {
        host.style.position = 'relative';
      }
    } catch (e) {
      /* non-fatal: worst case overlays anchor to a further ancestor */
    }
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
