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

/// A TAP MUST NOT MOVE THE PLAYER.
///
/// 8 was inherited from the original `|dy| >= 8` gate, and it is below
/// the noise floor of a thumb tap. MEASURED 2026-08-31 on the emulator,
/// synthetic taps that drift downward before lifting: at 10px the player
/// already shrank to 386x217 and translated (24, 93); 14px -> 376x211;
/// 20px -> 360x203; 45px -> 296x166. None of them COMMITTED -- every one
/// sprang back to 412x232 on release -- so what he got for tapping the
/// player was a lurch and a snap back, plus the preventDefault that a
/// claimed gesture takes, on every tap that rolled more than ~9px. The
/// shrink follows the finger 1:1 by design (2026-08-26), so the claim
/// threshold is the only thing standing between a tap and that motion.
///
/// 16 is not a guess: Android's ViewConfiguration has TWO slops, and the
/// second one exists for exactly this gesture -- getScaledTouchSlop() is
/// 8dp, for "is this a scroll", and getScaledPagingTouchSlop() is 2x
/// that, 16dp, for "is this a deliberate drag of a page or panel". This
/// is the second kind. It also leaves the claim at a sixth of the 103px
/// commit threshold, so the finger can still catch the player and drag
/// it back out without letting go, which is why the claim is separate
/// from the commit in the first place.
export var CLAIM_PX = 16;

/// Which axis, if any, this drag belongs to us on -- null means the page
/// keeps it.
///
/// The SIGN is the whole point. MEASURED 2026-08-30 on a real watch page:
/// an upward flick starting on the player had 8 of 8 touchmoves
/// defaultPrevented and moved the player zero pixels, because a claim at
/// |dy| >= 8 ignored direction while `gestureVerdict` and `dragProgress`
/// both refuse the wrong way. The sticky player is a 412x232 band across
/// the top of the screen, so that flick -- scroll down to the comments --
/// is the most common gesture on the page, and we were eating it whole.
/// That is the owner's "the mini player is annoying ... it doesn't
/// function as it's supposed to".
///
/// So a drag is only ours in the direction that can actually do
/// something: down while full, up while mini. Sideways stays a mini-only
/// throw, because on the full player a horizontal swipe is YouTube's.
export function claimAxis(dx, dy, state) {
  var ax = Math.abs(dx);
  var ay = Math.abs(dy);
  var toward = state === 'full' ? dy : -dy;
  if (toward >= CLAIM_PX && ay >= DRAG_AXIS_RATIO * ax) return 'y';
  if (state === 'mini' && ax >= CLAIM_PX && ax >= DRAG_AXIS_RATIO * ay) return 'x';
  return null;
}

export var DRAG_DISMISS_FRAC = 0.25; // of viewport width, sideways, while mini

/// How far through the shrink a live drag is, 0..1.
///
/// The native app's player follows the finger the whole way and only
/// snaps when you let go; ours used to sit still and then jump, which is
/// the single biggest reason it did not feel like YouTube's.
export function dragProgress(dy, state) {
  if (state === 'full') return clamp01(dy / DRAG_ENTER_PX);
  if (state === 'mini') return 1 - clamp01(-dy / DRAG_EXIT_PX);
  return 0;
}

function clamp01(v) {
  if (!(v > 0)) return 0;
  return v > 1 ? 1 : v;
}

/// The transform partway between full size and the corner.
///
/// `t` is what miniTransform returned for this player; p 0 is untouched,
/// p 1 is parked. Linear, because the easing belongs to the release --
/// during the drag the finger IS the curve.
export function blendTransform(t, p) {
  var q = clamp01(p);
  return { tx: t.tx * q, ty: t.ty * q, k: 1 + (t.k - 1) * q };
}

/// A sideways fling on the mini player. YouTube's throws it off screen
/// and stops the video; ours does the same, then puts the page back the
/// way it was rather than leaving a collapsed hole with nothing in it.
export function dismissVerdict(dx, dy, vw, state) {
  if (state !== 'mini') return null;
  var ax = Math.abs(dx);
  if (ax < DRAG_AXIS_RATIO * Math.abs(dy)) return null;
  return ax >= Math.max(48, vw * DRAG_DISMISS_FRAC) ? (dx > 0 ? 'right' : 'left') : null;
}

var STYLE_ID = 'ts-mini-style';
var COVER_ID = 'ts-mini-cover';
var BTN_ID = 'ts-mini-btns';
// The release is eased, the drag is not -- see blendTransform. 220ms on
// a decelerating curve is what a native sheet uses; anything slower
// reads as lag on a gesture the finger already finished.
var EASE = 'cubic-bezier(.2,0,0,1)';
var CSS =
  'html.ts-mini #player-container-id,html.ts-mini-drag #player-container-id{' +
  'z-index:2147482000 !important;border-radius:10px !important;' +
  'overflow:hidden !important;box-shadow:0 8px 28px rgba(0,0,0,.5) !important;' +
  'transform-origin:0 0 !important;}' +
  'html.ts-mini #player-container-id{transition:transform .22s ' +
  EASE +
  ',opacity .18s linear !important;}' +
  // A finger mid-drag must not be chasing an animation: the transition
  // is only on while the gesture is NOT holding the player.
  'html.ts-mini-drag #player-container-id{transition:none !important;}' +
  'html.ts-mini-gone #player-container-id{opacity:0 !important;' +
  'pointer-events:none !important;}' +
  // Every child of the container is inside the scale, so a 36px button
  // would paint at 20px. Dividing by the live scale is what keeps the
  // controls the size a thumb expects.
  '#' +
  BTN_ID +
  '{position:absolute;top:0;left:0;right:0;display:flex;' +
  'justify-content:flex-end;gap:calc(6px / var(--ts-mini-k,1));' +
  'padding:calc(6px / var(--ts-mini-k,1));z-index:2147481000;}' +
  '#' +
  BTN_ID +
  ' button{all:unset;display:flex;align-items:center;justify-content:center;' +
  'width:calc(32px / var(--ts-mini-k,1));height:calc(32px / var(--ts-mini-k,1));' +
  'border-radius:50%;background:rgba(0,0,0,.55);cursor:pointer;' +
  'transition:background .12s linear,transform .12s ' +
  EASE +
  ';}' +
  '#' +
  BTN_ID +
  ' button:active{background:rgba(0,0,0,.8);transform:scale(.92);}' +
  '#' +
  BTN_ID +
  ' svg{width:calc(18px / var(--ts-mini-k,1));' +
  'height:calc(18px / var(--ts-mini-k,1));fill:#fff;display:block;}' +
  '@media (prefers-reduced-motion:reduce){html.ts-mini #player-container-id,' +
  '#' +
  BTN_ID +
  ' button{transition:none !important;}}' +
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
  var dragT = null;
  var dragAxis = 'y';
  var miniHref = null;

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

  // The parked transform for the player as it currently measures. Read
  // once per gesture, not per move: measuring inside a touchmove forces
  // a layout on every frame of a drag.
  function parked(pc) {
    // Measure the UNtransformed box: clearing the transform first is the
    // only way to read where the fixed container actually sits, and it
    // is a single synchronous write/read/write inside one frame.
    var prev = pc.style.transform;
    var prevT = pc.style.getPropertyValue('transition');
    var prevTP = pc.style.getPropertyPriority('transition');
    // getBoundingClientRect forces the layout, and a forced layout on a
    // cleared transform is enough to start the transition animating from
    // full size. Measure with it off -- and it takes `!important` to
    // turn it off. MEASURED 2026-08-30 on the live watch page: under
    // html.ts-mini the sheet's own `transition: ... !important` beats a
    // plain inline declaration, so `style.transition = 'none'` computed
    // to 0.22s and this rect was read MID-ANIMATION, off the box the
    // drag had already shrunk. miniTransform then returned an identity
    // transform (tx 0, ty 0, k 1) -- so committing the gesture put the
    // player back at FULL SIZE at the top of the page while every other
    // signal said mini. That is the owner's "it sometimes goes down and
    // it doesn't function as it's supposed to".
    pc.style.setProperty('transition', 'none', 'important');
    pc.style.transform = '';
    var r = pc.getBoundingClientRect();
    var t = miniTransform(r.width, r.height, win.innerWidth, win.innerHeight, r.left, r.top);
    pc.style.transform = prev;
    pc.style.removeProperty('transition');
    if (prevT) pc.style.setProperty('transition', prevT, prevTP);
    return t;
  }

  function writeTransform(pc, t) {
    pc.style.transform = 'translate(' + t.tx + 'px,' + t.ty + 'px) scale(' + t.k + ')';
    try {
      pc.style.setProperty('--ts-mini-k', String(t.k));
    } catch (e) {
      /* a container without CSS custom property support just gets 1 */
    }
  }

  function place() {
    var pc = container();
    if (!pc || state !== 'mini') return;
    writeTransform(pc, parked(pc));
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
    buttons(pc);
  }

  function icon(d) {
    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  var PLAY_D = 'M8 5v14l11-7z';
  var PAUSE_D = 'M6 5h4v14H6zm8 0h4v14h-4z';
  var CLOSE_D =
    'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z';

  // Play/pause and dismiss, the two controls the native mini player has.
  function buttons(pc) {
    if (doc.getElementById(BTN_ID)) return;
    var bar = doc.createElement('div');
    bar.id = BTN_ID;

    var pp = doc.createElement('button');
    pp.type = 'button';
    pp.setAttribute('aria-label', 'Play or pause');
    var v = doc.querySelector('#player-container-id video');
    pp.appendChild(icon(v && !v.paused ? PAUSE_D : PLAY_D));
    pp.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var vid = doc.querySelector('#player-container-id video');
      if (!vid) return;
      if (vid.paused) {
        var pr = vid.play();
        if (pr && pr.catch) pr.catch(function () {});
      } else {
        vid.pause();
      }
      syncPlayIcon();
    });

    var x = doc.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close mini player');
    x.appendChild(icon(CLOSE_D));
    x.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      dismiss(1);
    });

    bar.appendChild(pp);
    bar.appendChild(x);
    pc.appendChild(bar);
    // The page pauses the video too -- its own controls are under our
    // cover but a headphone button or an ad break is not.
    if (v) {
      v.addEventListener('play', syncPlayIcon);
      v.addEventListener('pause', syncPlayIcon);
    }
    syncPlayIcon();
  }

  function syncPlayIcon() {
    var bar = doc.getElementById(BTN_ID);
    if (!bar) return;
    var btn = bar.firstChild;
    var vid = doc.querySelector('#player-container-id video');
    if (!btn || !vid) return;
    var want = vid.paused ? PLAY_D : PAUSE_D;
    var path = btn.querySelector('path');
    if (path && path.getAttribute('d') !== want) path.setAttribute('d', want);
  }

  function killButtons() {
    var bar = doc.getElementById(BTN_ID);
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    var v = doc.querySelector('#player-container-id video');
    if (v) {
      v.removeEventListener('play', syncPlayIcon);
      v.removeEventListener('pause', syncPlayIcon);
    }
  }

  // A fling sideways, or the X. The native app throws the player off
  // screen and stops the video; we do the same and then restore the page
  // to its full-size layout, because unlike the native app our player
  // lives IN the page -- leaving it hidden would leave a collapsed band
  // with nothing in it and no way back.
  function dismiss(dir) {
    var pc = container();
    if (!pc || state !== 'mini') return;
    var vid = doc.querySelector('#player-container-id video');
    if (vid && !vid.paused) {
      try {
        vid.pause();
      } catch (e) {
        /* a player mid-teardown refuses; the exit below still runs */
      }
    }
    var t = parked(pc);
    pc.style.opacity = '';
    doc.documentElement.classList.add('ts-mini-gone');
    writeTransform(pc, { tx: t.tx + dir * win.innerWidth, ty: t.ty, k: t.k });
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      doc.documentElement.classList.remove('ts-mini-gone');
      setState('full');
    };
    pc.addEventListener('transitionend', finish, { once: true });
    win.setTimeout(finish, 300);
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
      try {
        miniHref = win.location.href;
      } catch (e) {
        miniHref = null;
      }
      cover(true);
      place();
    } else {
      state = 'full';
      cover(false);
      killButtons();
      doc.documentElement.classList.remove('ts-mini');
      pc.style.transform = '';
      try {
        pc.style.removeProperty('--ts-mini-k');
      } catch (e) {
        /* nothing set it in the first place */
      }
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
  //
  // AND IT ONLY EVER BINDS ON THE WATCH PAGE. m.youtube plays feed
  // previews into the SAME shared player, so on the home feed a finger
  // landing on a preview bound the non-passive listener and took the
  // fast scroll path away right there -- the browser had to hold the
  // touch for our JS, and the press state painted on a video the owner
  // was only scrolling past (2026-08-29: "the video gets highlighted
  // again and again ... I'm not tapping it"). The miniplayer is a watch
  // page behaviour anyway: leaving /watch on m.youtube is a hard
  // navigation, so there is nothing on a feed for this gesture to do.
  var boundHosts = typeof WeakSet === 'function' ? new WeakSet() : null;
  var bound = null;

  function watchPage() {
    try {
      return location.pathname.indexOf('/watch') === 0;
    } catch (e) {
      return false;
    }
  }

  // A single-page navigation off /watch leaves the listener attached to
  // a container the page keeps, so it has to come back off.
  function unbindHost() {
    if (!bound) return;
    try {
      bound.host.removeEventListener('touchmove', bound.fn, { capture: true });
    } catch (e) {
      /* the host may already be gone with its document */
    }
    if (boundHosts) boundHosts.delete(bound.host);
    bound = null;
  }

  function bindHost(pc) {
    if (!pc || typeof pc.addEventListener !== 'function') return;
    if (boundHosts) {
      if (boundHosts.has(pc)) return;
      boundHosts.add(pc);
    }
    var fn = function (e) {
      var p = touchXY(e);
      if (p) onMove(p.x, p.y, e);
    };
    pc.addEventListener('touchmove', fn, { capture: true, passive: false });
    bound = { host: pc, fn: fn };
  }

  function inButtons(el) {
    if (!el) return false;
    if (el.closest) return !!el.closest('#' + BTN_ID);
    for (var n = el; n; n = n.parentElement) {
      if (n.id === BTN_ID) return true;
    }
    return false;
  }

  function onDown(x, y, target) {
    if (!watchPage()) {
      unbindHost();
      start = null;
      return;
    }
    if (!inPlayer(target)) {
      start = null;
      return;
    }
    // THE TWO CONTROLS THE MINI PLAYER HAS MUST BE PRESSABLE.
    //
    // The buttons are children of the player container, so inPlayer() is
    // true for them and the gesture armed on top of a button press. On
    // release onUp ran first, gestureVerdict read a near-zero movement
    // while mini as the tap-to-restore, and the player expanded instead
    // of the button firing -- their click handlers stopPropagation, but
    // that is a click, and this decision was already made on touchend.
    // MEASURED 2026-08-31 on a built APK: a clean tap on "Play or pause"
    // left the video playing and put the player back to 412x232; the
    // same on "Close mini player" did not dismiss it either. Both
    // controls were dead. With 20px of thumb roll it was worse -- the
    // sideways claim faded the player to opacity 0.91 under the finger.
    //
    // A touch that starts on a button is the button's, entirely: no
    // arming, no host binding, so the click lands the way the page's
    // own controls do.
    if (inButtons(target)) {
      start = null;
      return;
    }
    bindHost(container());
    start = { x: x, y: y };
    claimed = false;
  }

  function endDrag(pc) {
    doc.documentElement.classList.remove('ts-mini-drag');
    if (!pc) return;
    pc.style.opacity = '';
    if (state === 'mini') place();
    else {
      pc.style.transform = '';
      try {
        pc.style.removeProperty('--ts-mini-k');
      } catch (e) {
        /* never set */
      }
    }
  }

  function onMove(x, y, ev) {
    if (!start) return;
    var dx = x - start.x;
    var dy = y - start.y;
    // The gesture is claimed the moment its DIRECTION is unambiguous,
    // not when it has travelled far enough to commit -- the finger has
    // to be able to drag the player back out again without letting go.
    if (!claimed) {
      var axis = claimAxis(dx, dy, state);
      var pc0 = axis ? container() : null;
      if (pc0) {
        claimed = true;
        dragAxis = axis;
        dragT = parked(pc0);
        doc.documentElement.classList.add('ts-mini-drag');
      }
    }
    // Only once the drag IS ours do we take the scroll away from the
    // page -- a preventDefault before that would break normal scrolling
    // that happens to begin on the player.
    if (!claimed) return;
    if (ev && ev.cancelable) ev.preventDefault();
    var pc = container();
    if (!pc || !dragT) return;
    if (dragAxis === 'x') {
      // Follows the finger 1:1, and fades as it goes -- the same read as
      // the native app's throw-away.
      var frac = Math.min(1, Math.abs(dx) / Math.max(1, win.innerWidth * DRAG_DISMISS_FRAC));
      pc.style.opacity = String(1 - 0.45 * frac);
      writeTransform(pc, { tx: dragT.tx + dx, ty: dragT.ty, k: dragT.k });
      return;
    }
    writeTransform(pc, blendTransform(dragT, dragProgress(dy, state)));
  }

  // A CANCELLED GESTURE IS NOT AN ENDED ONE, AND THE PLAYER WAS LEFT
  // MID-DRAG BY IT.
  //
  // Android WebView fires `touchcancel` instead of `touchend` whenever
  // the browser takes the gesture back -- a system edge swipe, a second
  // finger landing, the page navigating under it. Without a handler for
  // it `onUp` never ran, so `start`/`claimed`/`dragT` stayed armed,
  // `ts-mini-drag` stayed on <html> (which is `transition: none
  // !important` on the container) and the interpolated transform stayed
  // exactly where the finger left it -- a player frozen part-shrunk,
  // which is the owner's "it sometimes goes down and it doesn't function
  // as it's supposed to".
  //
  // Cancel ABORTS, it does not commit: a gesture the browser took away
  // is a gesture the user did not finish, so the state it started from
  // is the state it returns to. endDrag already restores exactly that.
  function onCancel() {
    if (!start) return;
    var pc = container();
    start = null;
    claimed = false;
    dragT = null;
    dragAxis = 'y';
    endDrag(pc);
  }

  function onUp(x, y) {
    if (!start) return;
    var dx = x - start.x;
    var dy = y - start.y;
    var pc = container();
    var away = dismissVerdict(dx, dy, win.innerWidth, state);
    var v = gestureVerdict(dx, dy, state);
    start = null;
    claimed = false;
    dragT = null;
    dragAxis = 'y';
    if (away) {
      endDrag(pc);
      dismiss(away === 'right' ? 1 : -1);
      return;
    }
    if (v) {
      // Land in the committed state first, so the eased transition runs
      // from wherever the finger left the player rather than from the
      // last frame's inline transform being thrown away.
      doc.documentElement.classList.remove('ts-mini-drag');
      if (pc) pc.style.opacity = '';
      setState(v);
      return;
    }
    endDrag(pc);
  }

  // A PARKED PLAYER MUST NOT SURVIVE THE VIDEO IT WAS PARKED FOR.
  //
  // ts-mini lives on <html> and setState is only ever called by a
  // gesture, so an in-page navigation from one watch page to another
  // kept the class, the cover, the buttons and the collapsed
  // placeholder -- while the page underneath was a different video the
  // user had just chosen to watch. MEASURED 2026-08-31: after a
  // pushState to another video the player was still parked at
  // (169, 697) 231x130 with the placeholder at 0. The native app
  // expands when you pick something; so does this now.
  //
  // It also matters off /watch: `ts-mini` hides the blur pill, and a
  // soft nav would have carried that to a page the gesture has nothing
  // to do with.
  function restoreFull() {
    if (state === 'full') return;
    if (container()) {
      setState('full');
      return;
    }
    // No player left to restore -- a navigation took it. The class still
    // has to come off, because it belongs to whatever page this is now.
    state = 'full';
    killButtons();
    doc.documentElement.classList.remove('ts-mini');
    doc.documentElement.classList.remove('ts-mini-drag');
    doc.documentElement.classList.remove('ts-mini-gone');
    try {
      win.__TS_MINI_STATE = state;
    } catch (e) {
      /* probe marker only */
    }
  }

  function navCheck() {
    if (state !== 'mini') return;
    var href;
    try {
      href = win.location.href;
    } catch (e) {
      return;
    }
    if (href === miniHref) return;
    restoreFull();
  }

  // `loadstart` does not bubble, so this listens in the capture phase --
  // the same reason video-region does. It is the earliest signal that
  // the player has been handed a different video.
  try {
    doc.addEventListener('loadstart', navCheck, true);
    win.addEventListener('popstate', navCheck);
    win.addEventListener('hashchange', navCheck);
  } catch (e) {
    /* a listener-less environment simply keeps the old behaviour */
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
  doc.addEventListener('touchcancel', onCancel, { capture: true, passive: true });

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
