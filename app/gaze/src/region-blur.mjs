// Face-region blur (owner ask 2026-08-19): when the gender stage flags an
// image because of WHO is in it, blur just the face regions and leave the
// rest of the image visible — instead of the whole-element blur. Pure CSS
// overlays (backdrop-filter) so no pixels are copied and no CSP is hit.
//
// INSTANT rule under scroll (owner report 2026-08-19: fixed-position
// overlays lag composited scrolling — the page moves before any scroll
// event runs, exposing the face for a beat): overlays are DOCUMENT-
// anchored (absolute at the document origin), so scrolling moves them
// with the content and the blur stays pinned to the thumbnail. Only
// layout changes (virtualized feeds moving nodes, resize) can misplace
// them — those snap the whole-element blur back until a settle pass
// repositions. Over-blur, never under-blur.
//
// Videos deliberately keep whole-element blur: their content moves under
// a static overlay between samples, which is exactly the flash this
// design must never produce.

var OVERLAY_CONTAINER_ID = 'tamescroll-gaze-regions';
var SETTLE_MS = 150;

/**
 * Pure mapping: normalized face box (0..1 of the element) -> viewport
 * rect, clamped inside the element's bounding rect so overlays never
 * bleed onto surrounding UI. Exported for unit tests.
 */
export function mapBoxToRect(imgRect, box) {
  var x1 = Math.min(Math.max(box.x1, 0), 1);
  var y1 = Math.min(Math.max(box.y1, 0), 1);
  var x2 = Math.min(Math.max(box.x2, 0), 1);
  var y2 = Math.min(Math.max(box.y2, 0), 1);
  return {
    left: imgRect.left + x1 * imgRect.width,
    top: imgRect.top + y1 * imgRect.height,
    width: Math.max(0, (x2 - x1) * imgRect.width),
    height: Math.max(0, (y2 - y1) * imgRect.height),
  };
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

// entries: Array<{ el, boxes, overlays: HTMLElement[] }>. Strong refs are
// fine here: entries are dropped as soon as their element disconnects or
// clears, and the settle sweep prunes them on every scroll.
var entries = [];
var container = null;
var settleTimer = null;
var snapped = false;
var wholeBlurClass = null;
var started = false;

function ensureContainer() {
  if (container && container.isConnected) return container;
  container = document.getElementById(OVERLAY_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = OVERLAY_CONTAINER_ID;
    // The container is inert scaffolding at the top of the viewport
    // stack; children position themselves. pointer-events must never
    // eat a click meant for the page.
    container.style.cssText =
      'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483646;';
    (document.body || document.documentElement).appendChild(container);
  }
  return container;
}

function makeOverlay(rect) {
  var d = document.createElement('div');
  d.style.cssText =
    'position:absolute;pointer-events:none;' +
    'backdrop-filter:blur(var(--ts-blur-strong,24px));' +
    '-webkit-backdrop-filter:blur(var(--ts-blur-strong,24px));' +
    'border-radius:30%;';
  positionOverlay(d, rect);
  return d;
}

function positionOverlay(d, rect) {
  d.style.left = rect.left + window.scrollX + 'px';
  d.style.top = rect.top + window.scrollY + 'px';
  d.style.width = rect.width + 'px';
  d.style.height = rect.height + 'px';
}

function dropEntry(entry) {
  for (var i = 0; i < entry.overlays.length; i++) {
    if (entry.overlays[i].parentNode) {
      entry.overlays[i].parentNode.removeChild(entry.overlays[i]);
    }
  }
  entry.overlays.length = 0;
}

function repositionAll() {
  // Never run while snap() has the overlays display:none — stripping the
  // whole-blur class here would leave flagged faces fully exposed until
  // the settle timer re-shows the overlays (review 2026-08-23 #3: mobile
  // URL-bar collapse fires resize mid-scroll while new flags arrive).
  if (snapped) return;
  // Read phase first, then write: interleaving getBoundingClientRect
  // with style writes forces a synchronous layout per entry — at 4Hz
  // over a long-scroll entry list that is jank, not hygiene
  // (review 2026-08-23 #4).
  var rects = [];
  for (var r = 0; r < entries.length; r++) {
    rects.push(entries[r].el.isConnected ? entries[r].el.getBoundingClientRect() : null);
  }
  for (var i = entries.length - 1; i >= 0; i--) {
    var entry = entries[i];
    var rect = rects[i];
    if (!rect) {
      dropEntry(entry);
      entries.splice(i, 1);
      continue;
    }
    if (rect.width === 0 || rect.height === 0) {
      // Hidden (virtualized away): keep whole blur, park overlays.
      entry.el.classList.add(wholeBlurClass);
      dropEntry(entry);
      continue;
    }
    if (entry.overlays.length !== entry.boxes.length) {
      dropEntry(entry);
      var c = ensureContainer();
      for (var b = 0; b < entry.boxes.length; b++) {
        var o = makeOverlay(mapBoxToRect(rect, entry.boxes[b]));
        entry.overlays.push(o);
        c.appendChild(o);
      }
    } else {
      for (var j = 0; j < entry.boxes.length; j++) {
        positionOverlay(entry.overlays[j], mapBoxToRect(rect, entry.boxes[j]));
      }
    }
    entry.el.classList.remove(wholeBlurClass);
  }
}

// Layout genuinely changed (resize, orientation): overlays are stale in
// document space too — whole blur back on synchronously until settle.
function snap() {
  if (!snapped) {
    snapped = true;
    for (var i = 0; i < entries.length; i++) {
      entries[i].el.classList.add(wholeBlurClass);
      for (var j = 0; j < entries[i].overlays.length; j++) {
        entries[i].overlays[j].style.display = 'none';
      }
    }
  }
  scheduleSettle();
}

// Scroll: document-anchored overlays already move with the content, so
// nothing hides — the settle pass just re-verifies positions in case a
// virtualized feed moved nodes while scrolling.
function scheduleSettle() {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(function () {
    snapped = false;
    for (var i = 0; i < entries.length; i++) {
      for (var j = 0; j < entries[i].overlays.length; j++) {
        entries[i].overlays[j].style.display = '';
      }
    }
    repositionAll();
  }, SETTLE_MS);
}

/**
 * Starts the tracker once. flaggedClass is the whole-blur class to snap
 * back to (dom.js FLAGGED_CLASS — passed in to keep this module free of
 * imports so its pure part stays trivially unit-testable).
 */
export function initRegionBlur(flaggedClass) {
  wholeBlurClass = flaggedClass;
  if (started) return;
  started = true;
  // capture:true catches nested scrollers (feeds inside panels), not
  // just the window scroll.
  window.addEventListener('scroll', scheduleSettle, { capture: true, passive: true });
  window.addEventListener('resize', snap, { passive: true });
  // Owner report 2026-08-22 (phone): "blur boxes around where they
  // don't even belong" after tapping a thumbnail. m.youtube is an SPA —
  // in-page navigation and slow-load layout shifts fire neither scroll
  // nor resize, so overlays sat at stale document coords over the new
  // page forever. A cheap heartbeat reposition (getBoundingClientRect
  // per flagged entry, only while entries exist) prunes disconnected
  // elements and re-pins the rest; 250ms keeps any misplacement within
  // one glance, and the whole-blur snap still guards real layout jumps.
  setInterval(function () {
    if (entries.length && !snapped) repositionAll();
  }, 250);
}

/**
 * Switches a face-flagged element from whole-element blur to face-region
 * overlays. Caller guarantees the element currently wears the whole-blur
 * class (blur-first held while detection ran; it stays until the first
 * successful reposition removes it).
 */
export function applyRegionBlur(el, boxes) {
  if (!started || !boxes || !boxes.length) return;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].el === el) {
      entries[i].boxes = boxes;
      repositionAll();
      return;
    }
  }
  entries.push({ el: el, boxes: boxes, overlays: [] });
  repositionAll();
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
  if (container && container.parentNode) container.parentNode.removeChild(container);
  container = null;
}
