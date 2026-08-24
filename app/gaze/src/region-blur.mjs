// Person-region blur for feed images (owner ask 2026-08-19, whole-body
// 2026-08-24): when the gender stage flags an image because of WHO is in
// it, blur just the person regions and leave the rest visible — instead
// of the whole-element blur. Pure CSS overlays (backdrop-filter) so no
// pixels are copied and no CSP is hit.
//
// ANCHORING (v3, owner report 2026-08-24 "when I scroll the blur gets
// removed for a moment"): patches live INSIDE the image's parent element,
// position:absolute — the same fix that cured the player overlays. A
// patch that is a sibling of the <img> scrolls, transforms and animates
// WITH it by construction; there is no document-space bookkeeping for a
// composited scroll to outrun, so the flash class of bugs is gone.
// The old document-anchored container, scroll settle passes, header-inset
// clamps and reposition heartbeats all die with it. A slow heartbeat
// remains only to catch in-place layout resizes (responsive reflow).
//
// Trade-offs accepted: an overflow:hidden parent clips a patch to the
// thumbnail bounds (patches are clamped inside the image anyway, and
// clipping to the thumbnail is the CORRECT render); a fixed top bar now
// naturally paints over patches because they participate in the page's
// stacking order instead of sitting at max z-index (kills the old
// punch-through bug for free).

var SETTLE_MS = 150;
var PATCH_CLASS = 'ts-gaze-region-patch';

/**
 * Expand a normalized (0..1) face box outward by `pad` fraction of its
 * own width/height on every side, clamped to the element. A moving face
 * only samples every VIDEO_PLAYER_SAMPLE_INTERVAL_MS; the pad is the
 * cushion that keeps the face covered as it drifts between samples.
 * Pure — exported for tests.
 */
export function padBox(box, pad) {
  var w = box.x2 - box.x1;
  var h = box.y2 - box.y1;
  return {
    x1: Math.max(0, box.x1 - w * pad),
    y1: Math.max(0, box.y1 - h * pad),
    x2: Math.min(1, box.x2 + w * pad),
    y2: Math.min(1, box.y2 + h * pad),
    confidence: box.confidence,
  };
}

/**
 * Expand a face box to cover the whole PERSON (owner ask 2026-08-24,
 * HaramBlur parity: the blocked gender's body is covered, not just the
 * face). Anthropometric approximation from the face box alone; input
 * boxes arrive PRE-ENLARGED (detector.js FACE_ENLARGE 1.4, context for
 * the gender crop) — recover the true face first or the anthropometrics
 * compound on the inflation and the "body" swallows the whole frame
 * (probe 2026-08-24: 788x458 overlay on an 815-wide player). Everything
 * clamps to the element. Pure — shared by the image and video paths.
 */
export function expandToBody(box) {
  var ENLARGE = 1.4;
  var cx = (box.x1 + box.x2) / 2;
  var cy = (box.y1 + box.y2) / 2;
  var w = (box.x2 - box.x1) / ENLARGE;
  var h = (box.y2 - box.y1) / ENLARGE;
  var top = cy - h / 2;
  var bottom = cy + h / 2;
  return {
    // Shoulders: 1.6 -> 1.2 half-widths 2026-08-24 (owner screenshot:
    // the wide box swallowed the face NEXT to the covered person;
    // biacromial width ~2.3 head-widths, 2.4 total still covers it).
    x1: Math.max(0, cx - w * 1.2),
    y1: Math.max(0, top - h * 0.3),
    x2: Math.min(1, cx + w * 1.2),
    y2: Math.min(1, bottom + h * 6.0),
    confidence: box.confidence,
  };
}

/**
 * Pure mapping: normalized box on the element -> a rect in the PARENT's
 * coordinate space (for position:absolute siblings of the element).
 * Both rects come from getBoundingClientRect, so ancestor transforms
 * cancel out of the subtraction. Exported for tests.
 */
export function boxToParentRect(parentRect, elRect, box) {
  var x1 = Math.min(Math.max(box.x1, 0), 1);
  var y1 = Math.min(Math.max(box.y1, 0), 1);
  var x2 = Math.min(Math.max(box.x2, 0), 1);
  var y2 = Math.min(Math.max(box.y2, 0), 1);
  return {
    left: elRect.left - parentRect.left + x1 * elRect.width,
    top: elRect.top - parentRect.top + y1 * elRect.height,
    width: Math.max(0, (x2 - x1) * elRect.width),
    height: Math.max(0, (y2 - y1) * elRect.height),
  };
}

/**
 * Sub-pixel-tolerant rect equality — the heartbeat's cheap change guard.
 * Exported for tests.
 */
export function sameRect(a, b) {
  if (!a || !b) return false;
  return (
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

/** backdrop-filter support check — without it, callers keep whole blur. */
export function supportsRegionBlur() {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    (CSS.supports('backdrop-filter', 'blur(4px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(4px)'))
  );
}

// entries: Array<{ el, host, boxes, overlays, lastRect }>. Strong refs are
// fine: entries drop as soon as their element disconnects or clears, and
// the heartbeat prunes them.
var entries = [];
var wholeBlurClass = null;
var started = false;

function makeOverlay() {
  // Near-rectangular patch (owner 2026-08-24: heavy rounding read as
  // "weird"). z-index 2: above the <img> inside the thumbnail's own
  // stacking context, below page chrome — a fixed header naturally
  // covers it, which is the correct paint order.
  var d = document.createElement('div');
  d.className = PATCH_CLASS;
  d.style.cssText =
    'position:absolute;pointer-events:none;border-radius:8px;z-index:2;' +
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

function dropEntry(entry) {
  for (var i = 0; i < entry.overlays.length; i++) {
    if (entry.overlays[i].parentNode) {
      entry.overlays[i].parentNode.removeChild(entry.overlays[i]);
    }
  }
  entry.overlays.length = 0;
}

// Position (or re-position) one entry's patches from current geometry.
// Returns false when the element has no usable geometry yet.
function positionEntry(entry) {
  var elRect = entry.el.getBoundingClientRect();
  if (elRect.width === 0 || elRect.height === 0) return false;
  var parentRect = entry.host.getBoundingClientRect();
  while (entry.overlays.length < entry.boxes.length) {
    var o = makeOverlay();
    entry.overlays.push(o);
    entry.host.appendChild(o);
  }
  while (entry.overlays.length > entry.boxes.length) {
    var extra = entry.overlays.pop();
    if (extra.parentNode) extra.parentNode.removeChild(extra);
  }
  for (var i = 0; i < entry.boxes.length; i++) {
    place(entry.overlays[i], boxToParentRect(parentRect, elRect, entry.boxes[i]));
  }
  entry.lastRect = elRect;
  return true;
}

/**
 * Starts the tracker once. flaggedClass is the whole-blur class to fall
 * back to (dom.js FLAGGED_CLASS — passed in to keep the pure part of
 * this module dependency-free for unit tests).
 */
export function initRegionBlur(flaggedClass) {
  wholeBlurClass = flaggedClass;
  if (started) return;
  started = true;
  // Parent-anchored patches need no scroll handling at all. The
  // heartbeat only catches IN-PLACE geometry changes (responsive
  // reflow, virtualized recycling): one rect read per entry, 500ms,
  // only while entries exist.
  setInterval(function () {
    if (!entries.length || document.hidden) return;
    for (var i = entries.length - 1; i >= 0; i--) {
      var entry = entries[i];
      if (!entry.el.isConnected || !entry.host.isConnected) {
        dropEntry(entry);
        entries.splice(i, 1);
        continue;
      }
      var r = entry.el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        // Virtualized away: whole blur back on, park the patches.
        entry.el.classList.add(wholeBlurClass);
        dropEntry(entry);
        continue;
      }
      // Only the SIZE matters for repositioning (position changes ride
      // along with the parent for free) — but a recycled node can also
      // move within its parent, so compare the parent-relative offset.
      var pr = entry.host.getBoundingClientRect();
      var rel = { left: r.left - pr.left, top: r.top - pr.top, width: r.width, height: r.height };
      var lastRel = entry.lastRelRect;
      if (!lastRel || !sameRect(rel, lastRel)) {
        positionEntry(entry);
        entry.lastRelRect = rel;
      }
    }
  }, 500);
}

// The patch parent: the image's own parent element, promoted to a
// positioned box when static. Never the <html>/<body> fallback — no
// parent means whole blur stays.
function resolveHost(el) {
  var host = el.parentElement;
  if (!host) return null;
  try {
    if (window.getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
  } catch (e) {
    /* non-fatal */
  }
  return host;
}

/**
 * Switches a person-flagged element from whole-element blur to region
 * patches anchored in its parent. Caller guarantees the element wears
 * the whole-blur class; it comes off only after the patches are placed
 * (blur-first holds throughout). Falls back silently (whole blur stays)
 * when the element has no parent or no geometry yet.
 */
export function applyRegionBlur(el, boxes) {
  if (!started || !boxes || !boxes.length) return;
  var entry = null;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].el === el) {
      entry = entries[i];
      break;
    }
  }
  if (!entry) {
    var host = resolveHost(el);
    if (!host) return; // whole blur stays — fail covered
    entry = { el: el, host: host, boxes: boxes, overlays: [], lastRect: null, lastRelRect: null };
    entries.push(entry);
  } else {
    entry.boxes = boxes;
    // A src-swap can reparent the img in virtualized feeds — re-resolve.
    if (!entry.host.isConnected || entry.el.parentElement !== entry.host) {
      dropEntry(entry);
      var rehost = resolveHost(el);
      if (!rehost) return;
      entry.host = rehost;
    }
  }
  if (positionEntry(entry)) {
    el.classList.remove(wholeBlurClass);
  }
  // No geometry yet (display:none tab, image mid-layout): whole blur
  // stays on; the heartbeat will place the patches once it has a rect.
}

/** Removes region overlays for one element (verdict changed / cleared). */
export function clearRegionBlur(el) {
  for (var i = entries.length - 1; i >= 0; i--) {
    if (entries[i].el === el) {
      dropEntry(entries[i]);
      entries.splice(i, 1);
    }
  }
}

/** Fail-open sweep support: everything off, page untouched. */
export function clearAllRegionBlur() {
  for (var i = 0; i < entries.length; i++) dropEntry(entries[i]);
  entries.length = 0;
}
