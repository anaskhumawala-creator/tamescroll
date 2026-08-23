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

/**
 * Sub-pixel-tolerant rect equality — the heartbeat's cheap change guard.
 * Compositor scroll leaves fractional jitter in getBoundingClientRect
 * that must not read as movement, so compare with a <1px epsilon. Null
 * (disconnected element) is never equal to anything. Exported for tests.
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

// entries: Array<{ el, boxes, overlays: HTMLElement[] }>. Strong refs are
// fine here: entries are dropped as soon as their element disconnects or
// clears, and the settle sweep prunes them on every scroll.
var entries = [];
var container = null;
var settleTimer = null;
var snapped = false;
var wholeBlurClass = null;
var started = false;
// Last rect of the probe entry (entries[0]), so the idle heartbeat can
// detect "nothing moved" with ONE getBoundingClientRect instead of N
// (review 2026-08-23: the 4Hz N-read pass was 146ms/15s of forced
// layout during playback). Any real reflow moves the whole page, so the
// probe moves too; per-entry drift is still caught by scroll/resize/
// mutation observers.
var probeRect = null;
var lastCount = -1;

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

// Clamp a viewport-space overlay rect to a top inset (the fixed header
// band). Overlays are document-anchored at a very high z-index, so a
// thumbnail scrolled up behind a position:fixed top bar would paint its
// blur OVER the bar (owner report 2026-08-23: "blur shows above the menu
// or a title"). Clipping the overlay's top to the header line removes the
// punch-through while keeping the still-visible part of the face covered
// (over-blur preserved — the part behind the header is hidden by the
// header itself, never exposed). Pure + exported for tests.
export function clampToInset(rect, inset) {
  var bottom = rect.top + rect.height;
  if (bottom <= inset) {
    // Entirely behind the header — the header already covers it.
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, hidden: true };
  }
  var top = Math.max(rect.top, inset);
  return {
    left: rect.left,
    top: top,
    width: rect.width,
    height: bottom - top,
    hidden: false,
  };
}

// Bottom Y of the page's fixed/sticky top bar, or 0 if none. Cheap
// elementsFromPoint probe near the top-center; recomputed per reposition
// pass (one call) rather than cached, so it stays correct across SPA
// layout changes without a separate invalidation path.
// Pure inset finder: given the elementsFromPoint hits at the top-center,
// walk EACH hit's ancestor chain looking for a top-anchored fixed/sticky
// bar and return the greatest such bottom. Walking ancestors (not just the
// direct hits) is load-bearing: on m.youtube the hit at (cx,2) is a STATIC
// <button> nested inside the position:fixed topbar, so a direct-hit-only
// scan finds inset 0 and the overlay punches over the menu. `top<=2` keeps
// it to bars actually pinned at the top; `bottom < viewportH/2` rejects
// full-height fixed overlays (search sheets, modals). Exported for tests.
export function insetFromChain(topEls, style, rect, viewportH) {
  var inset = 0;
  for (var i = 0; i < topEls.length; i++) {
    var n = topEls[i];
    var d = 0;
    while (n && d < 8) {
      var pos = style(n);
      if (pos === 'fixed' || pos === 'sticky') {
        var r = rect(n);
        if (r.top <= 2 && r.bottom < viewportH / 2 && r.bottom > inset) {
          inset = r.bottom;
        }
      }
      n = n.parentElement;
      d++;
    }
  }
  return inset;
}

function topInset() {
  try {
    var cx = Math.floor(window.innerWidth / 2);
    var els = document.elementsFromPoint(cx, 2);
    return insetFromChain(
      els,
      function (n) { return window.getComputedStyle(n).position; },
      function (n) { return n.getBoundingClientRect(); },
      window.innerHeight
    );
  } catch (e) {
    return 0;
  }
}

function makeOverlay(rect, inset) {
  var d = document.createElement('div');
  d.style.cssText =
    'position:absolute;pointer-events:none;' +
    'backdrop-filter:blur(var(--ts-blur-strong,24px));' +
    '-webkit-backdrop-filter:blur(var(--ts-blur-strong,24px));' +
    'border-radius:30%;';
  positionOverlay(d, rect, inset);
  return d;
}

function positionOverlay(d, rect, inset) {
  var c = clampToInset(rect, inset || 0);
  if (c.hidden) {
    d.style.display = 'none';
    return;
  }
  d.style.display = '';
  d.style.left = c.left + window.scrollX + 'px';
  d.style.top = c.top + window.scrollY + 'px';
  d.style.width = c.width + 'px';
  d.style.height = c.height + 'px';
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
  var inset = topInset();
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
        var o = makeOverlay(mapBoxToRect(rect, entry.boxes[b]), inset);
        entry.overlays.push(o);
        c.appendChild(o);
      }
    } else {
      for (var j = 0; j < entry.boxes.length; j++) {
        positionOverlay(entry.overlays[j], mapBoxToRect(rect, entry.boxes[j]), inset);
      }
    }
    entry.el.classList.remove(wholeBlurClass);
  }
  // Refresh the heartbeat probe from the CURRENT first entry (splices
  // above shift indices, so rects[0] no longer maps to entries[0]). One
  // extra read, only on a full reposition — steady state skips this
  // whole function and pays just the guard read.
  probeRect =
    entries.length && entries[0].el.isConnected
      ? entries[0].el.getBoundingClientRect()
      : null;
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
    if (!entries.length || snapped || document.hidden) return;
    // Cheap guard: read only the probe entry. If it hasn't moved and the
    // entry count is unchanged, the page is static — skip the N-read
    // reposition entirely. A reflow (SPA nav, URL-bar collapse) shifts
    // the probe, falling through to the full pass that re-pins all.
    var probe = entries[0].el.isConnected ? entries[0].el.getBoundingClientRect() : null;
    if (probe && entries.length === lastCount && sameRect(probe, probeRect)) return;
    lastCount = entries.length;
    repositionAll();
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
