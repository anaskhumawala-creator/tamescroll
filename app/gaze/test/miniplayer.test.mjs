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
