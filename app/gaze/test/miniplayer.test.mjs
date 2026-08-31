// The miniplayer moves the ONE element the whole app exists around, so
// the arithmetic that decides where it lands is tested away from the DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as m from '../src/miniplayer.mjs';

const stripComments = (s) => s.replace(/^[ 	]*\/\/.*$/gm, '');

// The live watch page, measured 2026-08-28 under a mobile UA:
// player container 412x232 fixed at left 0 / top 48, viewport 412x915.
const PW = 412;
const PH = 232;
const VW = 412;
const VH = 915;

test('the mini player lands in the bottom-right corner, inside the margin', () => {
  const t = m.miniTransform(PW, PH, VW, VH, 0, 48);
  const left = 0 + t.tx;
  const top = 48 + t.ty;
  const w = PW * t.k;
  const h = PH * t.k;
  assert.equal(Math.round(left + w), VW - m.MINI_MARGIN);
  assert.equal(Math.round(top + h), VH - m.MINI_MARGIN);
  assert.ok(left > 0 && top > 0, 'never off the top or left edge');
});

test('the shrink keeps the video aspect, because it only ever scales', () => {
  const t = m.miniTransform(PW, PH, VW, VH, 0, 48);
  assert.ok(Math.abs((PW * t.k) / (PH * t.k) - PW / PH) < 1e-9);
  assert.ok(t.k < 1 && t.k > 0.4);
});

test('a broken measurement can neither grow the player nor vanish it', () => {
  // A zero-width read (player not laid out yet) and a viewport wider
  // than the player are the two ways this gets called with nonsense.
  assert.equal(m.miniTransform(0, 0, VW, VH, 0, 48).k, 1);
  assert.equal(m.miniTransform(50, 28, 4000, 2000, 0, 0).k, 1, 'never scales UP');
  const huge = m.miniTransform(9000, 5000, VW, VH, 0, 48);
  assert.ok(huge.k > 0 && 9000 * huge.k <= VW - 2 * m.MINI_MARGIN);
});

test('on a narrow viewport the margin wins over the target width', () => {
  const t = m.miniTransform(PW, PH, 40, 400, 0, 0);
  assert.ok(PW * t.k <= 40, 'the mini player fits the screen it is on');
});

test('a downward drag minimises, an upward drag restores, and only those', () => {
  assert.equal(m.gestureVerdict(0, 90, 'full'), 'mini');
  assert.equal(m.gestureVerdict(0, -90, 'mini'), 'full');
  // wrong direction for the state
  assert.equal(m.gestureVerdict(0, -90, 'full'), null);
  assert.equal(m.gestureVerdict(0, 90, 'mini'), null);
});

test('a scroll that merely starts on the player is not our gesture', () => {
  // Short drags are the page scrolling. This is the difference between a
  // feature and a player that shrinks every time you flick past it.
  assert.equal(m.gestureVerdict(0, m.DRAG_ENTER_PX - 1, 'full'), null);
  assert.equal(m.gestureVerdict(0, 20, 'full'), null);
  assert.equal(m.gestureVerdict(0, 0, 'full'), null);
});

test('a sideways swipe is never a minimise, however far it travels', () => {
  assert.equal(m.gestureVerdict(300, 60, 'full'), null);
  assert.equal(m.gestureVerdict(-300, 100, 'full'), null, 'diagonal stays the page’s');
  assert.equal(m.gestureVerdict(10, 100, 'full'), 'mini', 'a slight wobble still counts');
});

test('nothing in this module compensates scroll -- the browser already does', () => {
  // Regression guard for a fix that was itself the bug. Collapsing the
  // placeholder shrinks the document above the fold, and MEASURED on the
  // live page Chromium's scroll anchoring absorbs it (scrollY 600 -> 377
  // on the class alone). A second correction here moved the landmark
  // 453 -> 676: a visible jump. If a scroll write ever comes back to
  // this module, it needs new measurements first.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  assert.equal(/scrollTo|scrollTop\s*=/.test(src), false);
});

test('installMiniplayer is inert without a document and never installs twice', () => {
  assert.equal(m.installMiniplayer(undefined), null);
  assert.equal(m.installMiniplayer({}), null);
  const win = { document: {}, __TS_MINI__: { state: () => 'full' } };
  assert.equal(m.installMiniplayer(win), win.__TS_MINI__);
});

test('nothing this installs may slow down a scroll it is not part of', () => {
  // A non-passive touch listener on the document disables the browser's
  // fast scroll path for the WHOLE page: the touch is held until our JS
  // has had its chance to cancel it, which paints a press state and
  // starts the scroll late. The owner reported exactly that the day this
  // file shipped. Only the player's own subtree may give that up.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const docListeners = src.match(/doc\.addEventListener\([\s\S]*?\}\s*\);/g) || [];
  assert.ok(docListeners.length > 0, 'the gesture does listen on the document');
  for (const listener of docListeners) {
    if (!/touch/.test(listener)) continue;
    assert.match(listener, /passive:\s*true/, `document touch listener must be passive: ${listener.slice(0, 60)}`);
  }
  // And the one place that may cancel is bound to the player, not doc.
  assert.match(src, /pc\.addEventListener\(\s*'touchmove'/);
});

// --- "make mini player function exactly like yt" (owner, 2026-08-29) ---
// The native player follows the finger the whole way, throws away
// sideways, and carries play/pause + close. These test the arithmetic
// behind all three; the DOM half is verified on the emulator.

test('the shrink follows the finger instead of waiting for the commit', () => {
  assert.equal(m.dragProgress(0, 'full'), 0);
  assert.equal(m.dragProgress(m.DRAG_ENTER_PX / 2, 'full'), 0.5);
  assert.equal(m.dragProgress(m.DRAG_ENTER_PX, 'full'), 1);
  // Past the commit distance it stays parked -- never overshoots.
  assert.equal(m.dragProgress(500, 'full'), 1);
  // Dragging the wrong way for the state moves nothing.
  assert.equal(m.dragProgress(-200, 'full'), 0);
});

test('dragging the mini player back up unwinds the same way', () => {
  assert.equal(m.dragProgress(0, 'mini'), 1);
  assert.equal(m.dragProgress(-m.DRAG_EXIT_PX / 2, 'mini'), 0.5);
  assert.equal(m.dragProgress(-m.DRAG_EXIT_PX, 'mini'), 0);
  assert.equal(m.dragProgress(-500, 'mini'), 0);
});

test('a partway drag is partway between full size and the corner', () => {
  const t = m.miniTransform(PW, PH, VW, VH, 0, 48);
  assert.deepEqual(m.blendTransform(t, 0), { tx: 0, ty: 0, k: 1 }, 'p=0 is untouched');
  const done = m.blendTransform(t, 1);
  assert.equal(done.tx, t.tx);
  assert.equal(done.ty, t.ty);
  assert.equal(done.k, t.k);
  const half = m.blendTransform(t, 0.5);
  assert.ok(half.k < 1 && half.k > t.k, 'between the two sizes, never outside them');
  assert.ok(half.tx > 0 && half.tx < t.tx);
  // Out-of-range progress cannot blow the player up or invert it.
  assert.equal(m.blendTransform(t, 5).k, t.k);
  assert.equal(m.blendTransform(t, -5).k, 1);
});

test('a sideways fling dismisses the mini player, and only the mini one', () => {
  const far = VW * m.DRAG_DISMISS_FRAC + 1;
  assert.equal(m.dismissVerdict(far, 0, VW, 'mini'), 'right');
  assert.equal(m.dismissVerdict(-far, 0, VW, 'mini'), 'left');
  // The full-size player owns its own horizontal gestures (seek).
  assert.equal(m.dismissVerdict(far, 0, VW, 'full'), null);
  // A short swipe, or one that is really a scroll, is not a dismiss.
  assert.equal(m.dismissVerdict(20, 0, VW, 'mini'), null);
  assert.equal(m.dismissVerdict(far, far, VW, 'mini'), null);
});

test('the dismiss distance never asks for more travel than the screen has', () => {
  const t = m.dismissVerdict(60, 0, 120, 'mini');
  assert.equal(t, 'right', 'a narrow viewport still has a reachable threshold');
});

test('the controls are sized against the live scale, not in raw pixels', () => {
  // Everything inside the container is inside the scale, so a button in
  // flat px paints ~half size. The regression is silent and visual.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  assert.match(src, /--ts-mini-k/, 'the live scale is published as a custom property');
  assert.match(src, /calc\(32px \/ var\(--ts-mini-k,1\)\)/);
  assert.match(src, /prefers-reduced-motion/, 'the transitions respect the OS setting');
});

test('the drag itself is never animated', () => {
  // A transition running under a finger is the "chasing" feel; the ease
  // belongs to the release only.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  assert.match(src, /html\.ts-mini-drag #player-container-id\{transition:none/);
});

test('an upward flick starting on the player belongs to the page, not to us', () => {
  // MEASURED 2026-08-30, probe_mini_steal.py on a live watch page: the
  // old claim was `|dy| >= 8` with no sign, so an upward flick took 8 of
  // 8 touchmoves with defaultPrevented and moved the player 0px --
  // gestureVerdict and dragProgress both refuse that direction while
  // full. The sticky player is a 412x232 band across the top of the
  // screen, so "flick up to reach the comments" is the commonest gesture
  // on the page and it did nothing at all.
  assert.equal(m.claimAxis(0, -40, 'full'), null);
  assert.equal(m.claimAxis(0, -8, 'full'), null);
  assert.equal(m.claimAxis(0, 40, 'full'), 'y');
});

test('a downward drag on the mini player is the page scrolling too', () => {
  // Same defect mirrored: while mini, dragProgress clamps a downward
  // drag to full progress and nothing moves.
  assert.equal(m.claimAxis(0, 40, 'mini'), null);
  assert.equal(m.claimAxis(0, -40, 'mini'), 'y');
});

test('the claim needs a real direction before it takes the scroll', () => {
  assert.equal(m.claimAxis(0, m.CLAIM_PX - 1, 'full'), null);
  assert.equal(m.claimAxis(0, m.CLAIM_PX, 'full'), 'y');
  // A drag that is mostly sideways is not a minimise at any length.
  assert.equal(m.claimAxis(60, 20, 'full'), null);
});

test('sideways is claimed only once the player is in the corner', () => {
  assert.equal(m.claimAxis(60, 0, 'full'), null);
  assert.equal(m.claimAxis(60, 0, 'mini'), 'x');
  assert.equal(m.claimAxis(-60, 0, 'mini'), 'x');
});

test('parked() can actually stop the transition it measures through', () => {
  // MEASURED 2026-08-30 on the live watch page: under html.ts-mini the
  // sheet sets `transition: ... !important`, and an author !important
  // beats a plain inline declaration -- computed transitionDuration read
  // 0.22s with `style.transition = 'none'` and 0s only with
  // setProperty(..., 'important'). Measuring through a running
  // transition read the already-shrunk box, so miniTransform returned an
  // identity transform and committing the gesture sprang the player back
  // to full size while every other signal said mini.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  assert.match(src, /setProperty\(\s*'transition',\s*'none',\s*'important'\s*\)/);
  assert.equal(
    /style\.transition\s*=\s*'none'/.test(stripComments(src)),
    false,
    'a plain inline transition write cannot beat the sheet'
  );
});

test('a parked player does not survive the video it was parked for', () => {
  // MEASURED 2026-08-31: minimise, then pushState to another video, and
  // the player was STILL parked at (169,697) 231x130 with the cover, the
  // buttons and a placeholder collapsed to 0 -- on a different video the
  // user had just chosen to watch. ts-mini lives on <html> and setState
  // is only ever called by a gesture, so nothing put it back.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const code = stripComments(src);
  // The href it was parked at has to be remembered, or "did we navigate"
  // is unanswerable.
  assert.match(code, /miniHref = win\.location\.href;/);
  assert.match(code, /function navCheck\(\)/);
  // loadstart does not bubble: capture phase or it never fires.
  assert.match(code, /addEventListener\('loadstart', navCheck, true\)/);
  assert.match(code, /addEventListener\('popstate', navCheck\)/);
  // And the class must come off even when the navigation took the player
  // with it -- ts-mini hides the blur pill, which belongs to every page.
  assert.match(code, /classList\.remove\('ts-mini'\)/);
});


test('a cancelled touch aborts the drag instead of stranding it', () => {
  // Android WebView fires touchcancel, not touchend, whenever the
  // browser takes a gesture back -- a system edge swipe, a navigation
  // under it. (NOT a second finger: MEASURED 2026-08-31 by logging the
  // real event stream, a second finger fires an ordinary touchstart and
  // no cancel at all. The multi-touch guard is a separate test.)
  // With no handler onUp never ran, so start /
  // claimed / dragT stayed armed, ts-mini-drag stayed on <html> (which
  // is `transition: none !important` on the container) and the
  // interpolated transform stayed exactly where the finger left it: a
  // player frozen part-shrunk. Seen once at scale 0.906, never
  // committed.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const code = stripComments(src);
  assert.match(code, /addEventListener\(\s*'touchcancel'/);
  assert.match(code, /onCancel\(\);/);
  const fn = code.slice(code.indexOf('function onCancel()'));
  const body = fn.slice(0, fn.indexOf('function onUp('));
  // ABORT, never commit: a gesture the browser took away is one the user
  // did not finish, so no verdict may be read from it.
  assert.equal(/gestureVerdict|dismissVerdict|setState|dismiss\(/.test(body), false,
    'a cancelled gesture must not commit a state change');
  // And it must actually let go of the drag.
  assert.match(body, /claimed = false;/);
  assert.match(body, /dragT = null;/);
  assert.match(body, /endDrag\(pc\);/);
});

test('a tap that rolls under the paging slop does not move the player', () => {
  // MEASURED 2026-08-31: with CLAIM_PX 8, a tap drifting 10px shrank the
  // player to 386x217 and translated it (24, 93) before springing back;
  // 14px -> 376x211, 20px -> 360x203, 45px -> 296x166. None committed.
  // That lurch-and-snap on an ordinary tap is the owner's "annoying".
  // 16 is Android's getScaledPagingTouchSlop (2x the 8dp touch slop),
  // the constant that exists for deliberate page/panel drags.
  assert.equal(m.CLAIM_PX, 16);
  // Realistic tap jitter stays the page's.
  for (const dy of [0, 5, 8, 10, 14, 15]) {
    assert.equal(m.claimAxis(0, dy, 'full'), null, `${dy}px must not claim`);
  }
  // A deliberate drag still claims early -- well before the commit
  // threshold, so the finger can drag it back out without letting go.
  assert.equal(m.claimAxis(0, 16, 'full'), 'y');
  assert.equal(m.claimAxis(0, 40, 'full'), 'y');
  // And the same floor applies to the upward drag out of mini.
  assert.equal(m.claimAxis(0, -14, 'mini'), null);
  assert.equal(m.claimAxis(0, -16, 'mini'), 'y');
});

test('a touch that starts on a mini button belongs to the button', () => {
  // MEASURED 2026-08-31 on a built APK: the mini player's two controls
  // were BOTH dead. A clean tap on "Play or pause" left the video
  // playing and expanded the player to 412x232; the same on "Close mini
  // player" did not dismiss it. The buttons are children of the player
  // container, so inPlayer() was true for them, the gesture armed, and
  // onUp's tap-to-restore ran on touchend -- before the click their
  // handlers stopPropagation on could ever happen. With 20px of thumb
  // roll the sideways claim also faded the player to opacity 0.91.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const code = stripComments(src);
  assert.match(code, /function onAControl\(el\)/);
  // The refusal must come BEFORE the host is bound and before start is
  // set, or the gesture is armed anyway.
  const down = code.slice(code.indexOf('function onDown('));
  const body = down.slice(0, down.indexOf('function endDrag('));
  const guard = body.indexOf('onAControl(target)');
  // NB: `unbindHost()` contains the substring `bindHost(`.
  const bind = body.indexOf('bindHost(container())');
  assert.ok(guard > -1, 'onDown must refuse a touch that starts on a control of ours');
  // THE PILL IS THE SAME DEFECT AND THE WORSE ONE: it is appended to
  // #movie_player, and on a FULL player the claim axis is downward --
  // exactly where a thumb slides off a pill at the top right. MEASURED
  // 2026-08-31: pressing "Blur on" and sliding 20px shrank the player to
  // 360x203, 30px to 334x188, 60px to 257x144, and 110px MINIMISED it.
  assert.match(code, /ts-gaze-pill/, 'the blur pill must be covered too');
  assert.ok(guard < bind, 'the refusal must come before bindHost');
  // AND THE PAGE'S OWN CONTROLS ARE THE SAME CLASS. MEASURED
  // 2026-08-31: pressing Subtitles, Playback Settings, Previous video,
  // Next video, View Chapters or Enter full screen and rolling 25px
  // shrank the player to 347x195 every time. They live in
  // #player-control-container, a sibling of #player under the same
  // container inPlayer() tests.
  assert.match(code, /PAGE_CONTROLS = 'button,a\[href\]/);
  // But the test has to be the CONTROL, not the container: YouTube's
  // .player-controls-background is a plain div over the whole player and
  // is the touch target for a drag started on the video, so refusing on
  // the container would kill the gesture outright.
  assert.ok(
    !/closest\('#player-control/.test(code),
    'never refuse on the control container -- that is the whole player'
  );
});

test('the blur pill is mounted where YouTube\'s control chrome cannot cover it', () => {
  // MEASURED 2026-08-31 on a live m.youtube watch page. #movie_player
  // carries a transform, so it creates a stacking context and caps the
  // pill's z-index at its own level. `.player-controls-background`
  // (opacity 0, pointer-events auto, the full 412x231 player box) lives
  // under #player-control-container -- a LATER SIBLING of #player, not
  // inside #movie_player -- so it took every hit at the pill's centre.
  // YouTube builds it on the first tap on the video, and it stays: after
  // that tap a press on the pill did nothing ("Blur off" -> "Blur off")
  // and a 25px roll shrank the player to 347x195 instead.
  const entry = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const block = entry.slice(entry.indexOf('var pillHost = null;'), entry.indexOf('pillHost.appendChild(pill)'));
  assert.ok(
    block.includes("closest('#player-container-id')"),
    'the pill must prefer the player container, which is a sibling of the control chrome'
  );
  assert.ok(
    block.indexOf("closest('#movie_player')") < block.indexOf("closest('#player-container-id')"),
    'and fall back to #movie_player where there is no container (desktop)'
  );
  assert.ok(/\|\| moviePlayer \|\| null/.test(block), 'the fallback must actually be reachable');
});

test('one finger owns the gesture, and every event is about that finger', () => {
  // MEASURED 2026-08-31 on the emulator, logging the real event stream
  // with a second finger resting on the player:
  //   touchstart n:2 ch:[2]  pick = finger ONE, at its current point
  //   touchend   n:1 ch:[2]  pick = finger ONE, while it was still down
  // The old touchXY() read `ev.touches[0]` -- the first touch in the
  // list, never the one the event is about -- so a resting thumb
  // re-armed the drag origin, and LIFTING that thumb ran onUp with the
  // dragging finger's coordinates and committed the player to mini
  // mid-gesture (caught at 310x174 in transition). A thumb resting on
  // the video is how a phone is held.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const code = stripComments(src);
  // touches[0] is the defect itself. It must not come back anywhere.
  assert.equal(/touches\[0\]/.test(code), false, 'no handler may read touches[0]');
  // A second finger is not a second gesture (the release condition is
  // pinned by the stranding test below).
  assert.match(code, /if \(start\) \{/);
  // Arming reads the touch the event is actually about...
  assert.match(code, /e\.changedTouches && e\.changedTouches\[0\]/);
  // ...and every later event is matched back to it by identifier.
  assert.match(code, /function findTouch\(list, id\)/);
  assert.match(code, /findTouch\(e\.touches, touchId\)/);
  assert.match(code, /findTouch\(e\.changedTouches, touchId\)/);
});

test('a foreign finger can neither end our gesture nor cancel the page scroll', () => {
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const code = stripComments(src);
  // touchend: no match, no onUp. This is the line that was committing
  // the state change on somebody else's finger.
  const end = code.slice(code.indexOf("'touchend'"));
  const endBody = end.slice(0, end.indexOf('doc.addEventListener'));
  assert.match(endBody, /if \(!p\) return;/);
  // The non-passive handler on the player is the only one that can take
  // the scroll away, so it must be identifier-matched too.
  const bind = code.slice(code.indexOf('function bindHost('));
  assert.match(bind.slice(0, 400), /findTouch\(e\.touches, touchId\)/);
});

test('a cancel never leaves the gesture armed with nothing left to end it', () => {
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const code = stripComments(src);
  const c = code.slice(code.indexOf("'touchcancel'"));
  const body = c.slice(0, c.indexOf('doc.addEventListener('));
  // Ours was cancelled, OR the screen is now empty -- either way, let go.
  assert.match(body, /e\.touches && e\.touches\.length > 0/);
  assert.match(body, /onCancel\(\);/);
});

test('a lost touchend cannot strand the gesture forever', () => {
  // Binding the gesture to one finger introduces a new way to strand it:
  // if that finger's touchend is lost (a backgrounded WebView, a dropped
  // sequence), `start` stays set and no later touch could ever arm. The
  // old code self-healed by re-arming on every touchstart. So the
  // refusal is conditional on the owning finger still being on screen.
  const src = readFileSync(new URL('../src/miniplayer.mjs', import.meta.url), 'utf8');
  const code = stripComments(src);
  const st = code.slice(code.indexOf("'touchstart'"));
  const body = st.slice(0, st.indexOf('doc.addEventListener('));
  assert.match(body, /if \(touchId === null \|\| findTouch\(e\.touches, touchId\)\) return;/);
  assert.match(body, /onCancel\(\);/);
});
