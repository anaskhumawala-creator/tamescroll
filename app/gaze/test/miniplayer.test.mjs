// The miniplayer moves the ONE element the whole app exists around, so
// the arithmetic that decides where it lands is tested away from the DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as m from '../src/miniplayer.mjs';

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
