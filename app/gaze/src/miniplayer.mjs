// Drag-to-miniplayer for m.youtube's watch page.
//
// Owner report, twice: "the drag to miniplayer still doesn't work". It
// never did, and not because of us -- MEASURED 2026-08-26: m.youtube
// ships zero minimized-player experiment flags and no minimized element,
// so the drag gesture he knows from the NATIVE app has nothing to talk
// to on the web. The swipe-down miniplayer is a native-app feature.
//
// So this is ours. What it is NOT, and cannot be: a player that keeps
// playing while you browse away. MEASURED 2026-08-28: m.youtube's back
// out of /watch is a HARD navigation (window globals gone, 0 video
// elements, container gone), so there is no surviving element to float
// over the next page. What survives a scroll is the watch page itself,
// and that is what this shrinks into a corner: the video keeps playing
// while the comments and recommendations get the whole screen.
//
// The geometry is a TRANSFORM, never a resize. YouTube's player sizes
// #movie_player in pixels from its own JS; shrinking the container would
// leave a 397px-wide video cropped inside a 227px box. A scale on the
// container keeps every child's layout intact -- including our gaze
// overlays, which live inside the player and read their coordinates from
// two getBoundingClientRects, so an ancestor transform cancels out.
//
// Selectors are from the live DOM (CLAUDE.md), read 2026-08-28 under a
// mobile UA on a watch page:
//   body > div#player-container-id.player-container.sticky-player
//          (position:fixed, top:48px, 412x232, z-index 2)
//   ytm-watch > div.player-size.player-placeholder  (height 223)
// The placeholder is the band the fixed player sits over; collapsing it
// is what stops a mini player leaving a hole at the top of the page.

export var MINI_MARGIN = 12;
export var MINI_TARGET_W = 0.56; // of viewport width
export var MINI_MAX_W = 280;
export var MINI_MIN_SCALE = 0.2;

export var DRAG_ENTER_PX = 70;
export var DRAG_EXIT_PX = 50;
export var DRAG_AXIS_RATIO = 1.4; // vertical must clearly beat horizontal

/// Where the scaled player lands, as a transform off its own fixed box.
///
/// Returns translate-then-scale values for `transform-origin: 0 0`, so
/// the caller writes exactly `translate(tx,ty) scale(k)` and nothing
/// else. Clamped so a broken measurement can never blow the player up
/// (k > 1) or make it disappear (k -> 0).
export function miniTransform(pw, ph, vw, vh, left0, top0, o) {
  o = o || {};
  var margin = o.margin == null ? MINI_MARGIN : o.margin;
  var maxW = o.maxW == null ? MINI_MAX_W : o.maxW;
  var frac = o.targetW == null ? MINI_TARGET_W : o.targetW;
  var want = Math.min(vw * frac, maxW, Math.max(1, vw - margin * 2));
  var k = pw > 0 ? Math.min(1, want / pw) : 1;
  // Never vanish -- but never at the cost of fitting. A player measured
  // absurdly wide (a mid-layout read) must still end up on screen, so
  // the floor only applies when the floor itself fits.
  if (k < MINI_MIN_SCALE && pw * MINI_MIN_SCALE <= vw - margin * 2) k = MINI_MIN_SCALE;
  var w = pw * k;
  var h = ph * k;
  return {
    k: k,
    tx: Math.round(vw - margin - w - left0),
    ty: Math.round(vh - margin - h - top0),
  };
}

/// What a finished drag means, given which state we are in.
/// null = not our gesture, leave it to the page.
export function gestureVerdict(dx, dy, state) {
  var ax = Math.abs(dx);
  var ay = Math.abs(dy);
  if (ay < DRAG_AXIS_RATIO * ax) return null;
  if (state === 'full') return dy >= DRAG_ENTER_PX ? 'mini' : null;
  if (state === 'mini') return -dy >= DRAG_EXIT_PX ? 'full' : null;
  return null;
}

var STYLE_ID = 'ts-mini-style';
var COVER_ID = 'ts-mini-cover';
var CSS =
  'html.ts-mini #player-container-id{' +
  'z-index:2147482000 !important;border-radius:10px !important;' +
  'overflow:hidden !important;box-shadow:0 8px 28px rgba(0,0,0,.5) !important;' +
  'transform-origin:0 0 !important;}' +
  // `padding` is not belt-and-braces here: MEASURED 2026-08-28, the
  // placeholder's 223px comes from a padding-bottom aspect-ratio
  // trick on .player-size, so height:0 alone computed to 0px and
  // still measured 223 tall.
  'html.ts-mini .player-placeholder{height:0 !important;min-height:0 !important;' +
  'padding:0 !important;overflow:hidden !important;}' +
  'html.ts-mini .ts-gaze-pill{display:none !important;}' +
  '#' +
  COVER_ID +
  '{position:absolute;inset:0;z-index:2147480000;background:transparent;cursor:pointer;}';

/// Wires the gesture onto whatever watch page this document turns out to
/// be. Safe to call on every page and twice per page (Android evals the
/// boot script at Started AND Finished); everything is looked up lazily
/// because on a mobile watch page the player container is built after us.
export function installMiniplayer(win) {
  var doc = win && win.document;
  if (!doc) return null;
  if (win.__TS_MINI__) return win.__TS_MINI__;

  var state = 'full';
  var start = null;
  var claimed = false;

  function container() {
    return doc.getElementById('player-container-id');
  }

  function style() {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function place() {
    var pc = container();
    if (!pc || state !== 'mini') return;
    // Measure the UNtransformed box: clearing the transform first is the
    // only way to read where the fixed container actually sits, and it
    // is a single synchronous write/read/write inside one frame.
    pc.style.transform = '';
    var r = pc.getBoundingClientRect();
    var t = miniTransform(r.width, r.height, win.innerWidth, win.innerHeight, r.left, r.top);
    pc.style.transform = 'translate(' + t.tx + 'px,' + t.ty + 'px) scale(' + t.k + ')';
  }

  function cover(on) {
    var pc = container();
    if (!pc) return;
    var c = doc.getElementById(COVER_ID);
    if (!on) {
      if (c && c.parentNode) c.parentNode.removeChild(c);
      return;
    }
    if (c) return;
    c = doc.createElement('div');
    c.id = COVER_ID;
    // A tap anywhere on the mini player restores it. The cover also
    // keeps YouTube's own controls out of a 227px-wide box, where every
    // hit target would be a mis-tap.
    c.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setState('full');
    });
    pc.appendChild(c);
  }

  function setState(next) {
    if (next === state) return;
    var pc = container();
    if (!pc) return;
    // NO SCROLL COMPENSATION, and that is a measurement not an omission.
    // Collapsing a 223px band above the fold should push what you are
    // reading down by 223px, so the first version subtracted it back --
    // and made it JUMP. MEASURED 2026-08-28 on the live watch page:
    // adding the class alone moved scrollY 600 -> 377 (the band exactly),
    // i.e. Chromium's scroll anchoring already holds the position, and
    // our correction moved the landmark 453 -> 676. The browser is doing
    // it; doing it twice is the bug.
    if (next === 'mini') {
      style();
      doc.documentElement.classList.add('ts-mini');
      state = 'mini';
      cover(true);
      place();
    } else {
      state = 'full';
      cover(false);
      doc.documentElement.classList.remove('ts-mini');
      pc.style.transform = '';
    }
    try {
      win.__TS_MINI_STATE = state;
    } catch (e) {}
  }

  function inPlayer(target) {
    var pc = container();
    return !!(pc && target && pc.contains(target));
  }

  // A NON-PASSIVE touchmove on the DOCUMENT costs every scroll on the
  // page, everywhere, forever: the browser cannot run its fast scroll
  // path until our JS has had a chance to preventDefault, so the touch
  // holds, the press state paints, and the scroll starts late. That is
  // what the owner reported the day this shipped -- "when scrolling
  // through thumbnails show a pressing impression when I'm just
  // scrolling", "make it feel like native yt app".
  //
  // The gesture only ever acts on a touch that STARTED inside the
  // player, so only the player's own subtree needs to give up the fast
  // path. Bound on touchstart, which fires before the touchmoves of the
  // same gesture, so the first drag is already covered -- and a page
  // nobody drags never pays anything.
  var boundHosts = typeof WeakSet === 'function' ? new WeakSet() : null;
  function bindHost(pc) {
    if (!pc || typeof pc.addEventListener !== 'function') return;
    if (boundHosts) {
      if (boundHosts.has(pc)) return;
      boundHosts.add(pc);
    }
    pc.addEventListener(
      'touchmove',
      function (e) {
        var p = touchXY(e);
        if (p) onMove(p.x, p.y, e);
      },
      { capture: true, passive: false }
    );
  }

  function onDown(x, y, target) {
    if (!inPlayer(target)) {
      start = null;
      return;
    }
    bindHost(container());
    start = { x: x, y: y };
    claimed = false;
  }

  function onMove(x, y, ev) {
    if (!start) return;
    var dx = x - start.x;
    var dy = y - start.y;
    if (!claimed && gestureVerdict(dx, dy, state)) claimed = true;
    // Only once the drag IS ours do we take the scroll away from the
    // page -- a preventDefault before that would break normal scrolling
    // that happens to begin on the player.
    if (claimed && ev && ev.cancelable) ev.preventDefault();
  }

  function onUp(x, y) {
    if (!start) return;
    var v = gestureVerdict(x - start.x, y - start.y, state);
    start = null;
    claimed = false;
    if (v) setState(v);
  }

  function touchXY(ev) {
    var t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]);
    return t ? { x: t.clientX, y: t.clientY } : null;
  }

  doc.addEventListener(
    'touchstart',
    function (e) {
      var p = touchXY(e);
      if (p) onDown(p.x, p.y, e.target);
    },
    { capture: true, passive: true }
  );
  // Tracking only -- no event, so nothing here can ever preventDefault.
  // The cancelling half lives on the player (bindHost).
  doc.addEventListener(
    'touchmove',
    function (e) {
      var p = touchXY(e);
      if (p) onMove(p.x, p.y, null);
    },
    { capture: true, passive: true }
  );
  doc.addEventListener(
    'touchend',
    function (e) {
      var p = touchXY(e);
      if (p) onUp(p.x, p.y);
    },
    { capture: true, passive: true }
  );

  // Mouse is here so the gesture is drivable on the desktop dev app,
  // which is the only surface with a debugger attached.
  doc.addEventListener(
    'mousedown',
    function (e) {
      onDown(e.clientX, e.clientY, e.target);
    },
    true
  );
  doc.addEventListener(
    'mousemove',
    function (e) {
      onMove(e.clientX, e.clientY, e);
    },
    true
  );
  doc.addEventListener(
    'mouseup',
    function (e) {
      onUp(e.clientX, e.clientY);
    },
    true
  );

  win.addEventListener('resize', place, { passive: true });
  win.addEventListener('orientationchange', place, { passive: true });

  var api = {
    enter: function () {
      setState('mini');
    },
    exit: function () {
      setState('full');
    },
    state: function () {
      return state;
    },
  };
  win.__TS_MINI__ = api;
  return api;
}
