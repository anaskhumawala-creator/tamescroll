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
    // CROWN + HAIR, not just the crown (owner 2026-08-27: "why is the
    // hair visible of women... I've noticed this in all blurs").
    //
    // The detector's box runs roughly brow-to-chin, so the crown alone
    // already sits ~0.4 box-heights above `top`; 0.3 was covering less
    // than the skull, and everything above it -- volume, a bun, long
    // hair swept up -- was drawn sharp on every thumbnail. 1.0 clears a
    // typical crown by ~0.6 box-heights, which is what hair occupies.
    // Vertical only: the sideways number is 1.2 because 1.6 swallowed
    // the face NEXT to the covered person, and hair does not escape
    // sideways the way it escapes upward.
    y1: Math.max(0, top - h * 1.0),
    x2: Math.min(1, cx + w * 1.2),
    y2: Math.min(1, bottom + h * 6.0),
    confidence: box.confidence,
  };
}

/**
 * Merge overlapping normalized boxes into their unions (owner 2026-08-24:
 * "double triple blur don't look good" — two people close together, or a
 * face patch + person patch on the same body, rendered as stacked
 * translucent rectangles). Iterates until no pair overlaps, so chains
 * (A∩B, B∩C) collapse into one. Pure — shared by image + video paths.
 */
export function mergeOverlapping(boxes) {
  var out = boxes.slice();
  var merged = true;
  while (merged) {
    merged = false;
    outer: for (var i = 0; i < out.length; i++) {
      for (var j = i + 1; j < out.length; j++) {
        var a = out[i];
        var b = out[j];
        if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) {
          out[i] = {
            x1: Math.min(a.x1, b.x1),
            y1: Math.min(a.y1, b.y1),
            x2: Math.max(a.x2, b.x2),
            y2: Math.max(a.y2, b.y2),
            confidence: Math.max(a.confidence || 0, b.confidence || 0),
          };
          out.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return out;
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

/**
 * The bottom edge of whatever fixed/sticky chrome is painted OVER this
 * point, or 0 when nothing is.
 *
 * A patch lives inside its own thumbnail, which is the right anchor --
 * but it does not share a stacking context with the page's sticky video
 * player, so a recommendation scrolling up UNDER the player carried its
 * patch over the top of the video (owner, 2026-08-30, screenshot: a
 * blur rectangle standing on the player while he scrolled). The patch
 * has to stop where the thing covering its image starts.
 *
 * elementsFromPoint answers what actually paints there, so no selector
 * is guessed: walk each hit's ancestors, take the first fixed or sticky
 * box that is not an ancestor of our own element.
 */
function occluderBottom(x, y, el) {
  if (typeof document.elementsFromPoint !== 'function') return 0;
  var hits;
  try {
    hits = document.elementsFromPoint(x, y);
  } catch (e) {
    return 0;
  }
  if (!hits || !hits.length) return 0;
  for (var i = 0; i < hits.length; i++) {
    var node = hits[i];
    if (node === el || (node.contains && node.contains(el))) return 0; // our own image is on top
    for (var up = node; up && up !== document.body; up = up.parentElement) {
      if (up.contains && up.contains(el)) break;
      var pos;
      try {
        pos = getComputedStyle(up).position;
      } catch (e) {
        break;
      }
      if (pos === 'fixed' || pos === 'sticky') {
        var r = up.getBoundingClientRect();
        if (r.height > 0 && r.bottom > y) return r.bottom;
      }
    }
  }
  return 0;
}

function makeOverlay(radius) {
  // Near-rectangular patch (owner 2026-08-24: heavy rounding read as
  // "weird"). z-index 2: above the <img> inside the thumbnail's own
  // stacking context, below page chrome — a fixed header naturally
  // covers it, which is the correct paint order.
  var d = document.createElement('div');
  d.className = PATCH_CLASS;
  d.style.cssText =
    'position:absolute;pointer-events:none;border-radius:' +
    (radius || '8px') +
    ';z-index:2;' +
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

// Patches whose shape changed have to be rebuilt: the radius is baked
// into the element's style when it is made.
function dropOverlays(entry) {
  for (var i = 0; i < entry.overlays.length; i++) {
    if (entry.overlays[i].parentNode) {
      entry.overlays[i].parentNode.removeChild(entry.overlays[i]);
    }
  }
  entry.overlays.length = 0;
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
    var o = makeOverlay(entry.radius);
    entry.overlays.push(o);
    entry.host.appendChild(o);
  }
  while (entry.overlays.length > entry.boxes.length) {
    var extra = entry.overlays.pop();
    if (extra.parentNode) extra.parentNode.removeChild(extra);
  }
  // Only images that have scrolled into the top of the viewport can be
  // under sticky chrome, and that check costs a hit-test -- so ask once
  // per entry, and only up there.
  var occ = 0;
  var vh = window.innerHeight || 0;
  if (elRect.top < vh * 0.6 && elRect.bottom > 0) {
    // An image half above the fold is exactly the one sliding under the
    // chrome, and a hit-test off the top of the viewport answers
    // nothing -- so sample at the first row of it that is on screen.
    occ = occluderBottom(
      elRect.left + elRect.width / 2,
      Math.max(1, elRect.top + 1),
      entry.el
    );
  }
  for (var i = 0; i < entry.boxes.length; i++) {
    var rect = boxToParentRect(parentRect, elRect, entry.boxes[i]);
    var overlay = entry.overlays[i];
    if (occ > 0) {
      var vTop = parentRect.top + rect.top;
      var cut = occ - vTop;
      if (cut >= rect.height) {
        // Entirely behind the chrome: the pixels it was covering are not
        // on screen, so nothing is exposed by standing down.
        overlay.style.display = 'none';
        continue;
      }
      if (cut > 0) {
        rect.top += cut;
        rect.height -= cut;
      }
    }
    overlay.style.display = '';
    place(overlay, rect);
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
  function sweep() {
    if (!entries.length || document.hidden) return;
    for (var i = entries.length - 1; i >= 0; i--) {
      var entry = entries[i];
      if (!entry.el.isConnected || !entry.host.isConnected) {
        dropEntry(entry);
        entries.splice(i, 1);
        continue;
      }
      // A host can BECOME the player without the entry moving: on
      // m.youtube the same subtree is recycled from a feed preview into
      // the watch player, so a patch minted legitimately can end up
      // orphaned inside it. resolveHost refuses the host at mint time;
      // this catches the ones that were minted before the recycle.
      try {
        if (isPlayerSubtree(entry.host)) {
          entry.el.classList.add(wholeBlurClass);
          dropEntry(entry);
          entries.splice(i, 1);
          continue;
        }
      } catch (e) {
        /* non-fatal */
      }
      // A HOST IS ONLY CORRECT WHILE IT IS STILL THE PARENT.
      //
      // applyRegionBlur re-resolves the host when the element has been
      // reparented -- but only when a NEW verdict arrives for that
      // element. Nothing re-checks it otherwise, so an image moved by a
      // virtualising feed keeps a patch hosted by a container it no
      // longer belongs to, and inherits THAT container's stacking
      // context rather than its real parent's. The arithmetic still
      // lands the patch on the image (the host's own offset cancels),
      // which is why this hides rather than showing up as drift -- what
      // changes is what the patch paints in front of.
      //
      // MEASURED on m.youtube search 2026-08-30, 116 images over eight
      // scroll steps: 0 reparented. So this is a NET, in the same family
      // as the occluder clamp, not a reproduction of the owner's frame.
      // Covered in both directions: re-host if there is a host to take,
      // whole blur if there is not.
      try {
        if (entry.el.parentElement !== entry.host) {
          var moved = resolveHost(entry.el);
          if (!moved) {
            entry.el.classList.add(wholeBlurClass);
            dropEntry(entry);
            entries.splice(i, 1);
            continue;
          }
          dropOverlays(entry);
          entry.host = moved;
          entry.lastRect = null;
          entry.lastRelRect = null;
        }
      } catch (e) {
        /* non-fatal: the entry keeps the host it had */
      }
      var r = entry.el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        // Virtualized away: whole blur back on, park the patches.
        entry.el.classList.add(wholeBlurClass);
        dropEntry(entry);
        continue;
      }
      // A PLAYING PREVIEW OWNS THE PIXELS, SO THE STILL'S PATCH STANDS
      // DOWN. (owner 2026-08-27: "when the video is playing in the
      // preview the existing blur to disappear so it doesn't look
      // incorrectly blurred")
      //
      // Only reachable when the user has turned the Video previews
      // surface back ON -- hidden is the default. m.youtube moves a
      // single preview host over whichever thumbnail is in view and
      // plays inside it, so for a moment the same subject is covered
      // twice: our still-image patches underneath, and the video path's
      // own whole-video blur on top of them. The two disagree about
      // where the person is, and the seam is what reads as wrong.
      //
      // Hidden, not destroyed: the preview is transient and the patches
      // are correct for the still, so they come straight back when it
      // moves on. NOT covered by the containment test alone -- the
      // preview must actually be PLAYING, because a parked preview host
      // shows nothing and hiding the patch under it would expose.
      var hidden = previewCovers(entry.el);
      if (hidden !== entry.previewHidden) {
        entry.previewHidden = hidden;
        for (var k = 0; k < entry.overlays.length; k++) {
          entry.overlays[k].style.display = hidden ? 'none' : '';
        }
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
  }

  setInterval(sweep, 500);
  // A PREVIEW STARTS BETWEEN HEARTBEATS. Half a second of patches drawn
  // across a video that has already taken over the pixels is exactly
  // what the owner sees while scrolling a feed, so the two events that
  // change the answer run the sweep themselves. Capture phase: `playing`
  // and `pause` do not bubble.
  try {
    document.addEventListener('playing', sweep, true);
    document.addEventListener('pause', sweep, true);
  } catch (e) {
    /* listener-less environment: the heartbeat still covers it */
  }
}

// The patch parent: the image's own parent element, promoted to a
// positioned box when static. Never the <html>/<body> fallback — no
// parent means whole blur stays.
// Is a PLAYING preview covering this element? Cheap: the preview host is
// a singleton on m.youtube, so this is one querySelector and at most one
// rect comparison, and it only runs for elements that already carry
// patches. Exported for tests.
export function coversRect(a, b) {
  if (!a || !b || !(b.width > 0) || !(b.height > 0)) return false;
  var w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (!(w > 0) || !(h > 0)) return false;
  return (w * h) / (b.width * b.height) >= PREVIEW_COVER_MIN;
}

// 0.9, not 1.0: the preview host and the thumbnail are laid out
// independently and differ by a pixel or two of rounding. Well short of
// this and part of the still is uncovered, where a face could sit.
var PREVIEW_COVER_MIN = 0.9;

// THE PREVIEW HOST ON m.youtube IS #movie_player, AND ONLY #movie_player.
//
// Owner 2026-08-28, phone screenshot: patch rectangles sitting across a
// playing feed preview, describing nothing that is on screen. The
// stand-down below was written for it and never fired, because it looked
// for `ytm-video-preview` / `.ytmVideoPreviewHost` -- MEASURED on the
// live mobile-UA feed, both are 0 elements and #movie_player is 1. The
// shared player IS the preview host on mobile web, which is the same
// fact rules/youtube.txt records as the reason the preview surface
// cannot be hidden.
//
// Adding it costs nothing on a watch page: the query only decides
// whether a STILL IMAGE that already carries patches is covered by a
// PLAYING video, and on a watch page no thumbnail sits under the player.
var PREVIEW_HOST_QUERY = 'ytm-video-preview, .ytmVideoPreviewHost, ytd-video-preview, #movie_player';

/**
 * Should this element's patches stand down? Only when a PLAYING video
 * owns essentially all of the element's pixels: a parked host shows the
 * still through it, and hiding a patch under that would expose.
 * Pure — exported for tests.
 */
export function shouldStandDown(hostRect, playing, elRect) {
  if (!playing) return false;
  return coversRect(hostRect, elRect);
}

function previewCovers(el) {
  try {
    var hosts = document.querySelectorAll(PREVIEW_HOST_QUERY);
    for (var i = 0; i < hosts.length; i++) {
      var vid = hosts[i].querySelector('video');
      if (
        shouldStandDown(
          hosts[i].getBoundingClientRect(),
          !!(vid && !vid.paused && vid.readyState >= 2),
          el.getBoundingClientRect()
        )
      ) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

// The shared-player subtree, in one place because two call sites need
// the same answer and a selector that drifts in one of them is a bug
// that only shows up on a phone. Exported for tests.
export var PLAYER_SUBTREE_SELECTOR = '#movie_player, .ytmVideoPreviewHost, ytm-video-preview';

export function isPlayerSubtree(node) {
  try {
    return !!(node && typeof node.closest === 'function' && node.closest(PLAYER_SUBTREE_SELECTOR));
  } catch (e) {
    return false;
  }
}

function resolveHost(el) {
  var host = el.parentElement;
  if (!host) return null;
  // NEVER INSIDE THE PLAYER. (owner 2026-08-27, phone screenshot: a blur
  // rectangle floating across the playing video, anchored to nothing,
  // plus "the blur marks end up showing on the title bar" while
  // scrolling fast.)
  //
  // m.youtube reuses ONE #movie_player for the watch player AND for the
  // feed's autoplay thumbnail previews -- that is already recorded in
  // rules/youtube.txt as the reason the preview surface cannot be hidden.
  // So a thumbnail that happens to be previewing puts its <img> inside
  // the shared player subtree, we host a patch there, and when the
  // preview ends or the element is recycled for the real player the
  // patch is orphaned INSIDE the player: it stops tracking anything,
  // paints over the video, and rides the sticky player up under the top
  // bar. It also outranks page chrome, because video-region's own
  // overlays live at z-index 20 in exactly that subtree.
  //
  // An image patch has no business in the player subtree at all -- the
  // player has its own region path. Refusing the host here means whole
  // blur stays for that element, which is the covered direction.
  if (isPlayerSubtree(host)) return null;
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
export function applyRegionBlur(el, boxes, opts) {
  if (!started || !boxes || !boxes.length) return;
  // An avatar is round, and a square patch over a round picture is the
  // owner's "blur spreaded all over, not confined to the profile
  // picture" -- so the caller can hand the patch the element's own
  // corner radius.
  var radius = (opts && opts.radius) || null;
  boxes = mergeOverlapping(boxes); // stacked translucent patches look broken (owner)
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
    entry = {
      el: el,
      host: host,
      boxes: boxes,
      overlays: [],
      lastRect: null,
      lastRelRect: null,
      radius: radius,
    };
    entries.push(entry);
  } else {
    entry.boxes = boxes;
    if (radius !== entry.radius) {
      entry.radius = radius;
      dropOverlays(entry);
    }
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

// SCROLL-ORDER PRIORITY FOR THE IMAGE QUEUE (owner 2026-08-27: "can't
// you preload the thumbnail blurs before my scrolling so it becomes
// more smooth").
//
// The queue is filled in LOAD order, which is not view order: YouTube
// lazy-loads a screenful ahead, an SPA nav appends a whole new feed
// behind what is already queued, and a src swap re-queues an item at
// the back. So the thumbnail he is about to scroll onto can sit behind
// thirty images he has already passed, and the reveal lands seconds
// after he has gone by -- which is exactly what "not smooth" looks
// like, even though every one of them was blurred the whole time.
//
// Ordering cannot make the work cheaper; it makes it land in the right
// place. Nearest-below-the-fold first is the lookahead: by the time a
// row reaches the viewport its verdict is usually already in.
//
// Above the viewport is not dropped -- blur-first means those are
// covered, and he can scroll back up -- it is just parked behind
// everything ahead of him.
export var PRIORITY_BEHIND = 1e7;

/** Sort key for one queued image: smaller runs sooner. */
export function imagePriority(rect, viewportH) {
  if (!rect) return PRIORITY_BEHIND * 2;
  var vh = viewportH > 0 ? viewportH : 1;
  // On screen now: he is looking at it, nothing outranks that.
  if (rect.bottom > 0 && rect.top < vh) return 0;
  // Below the fold: ahead of him, nearest first.
  if (rect.top >= vh) return rect.top - vh + 1;
  // Above the fold: already passed. Behind everything ahead, nearest
  // first among themselves so scrolling back up also resolves in order.
  return PRIORITY_BEHIND - rect.bottom;
}
