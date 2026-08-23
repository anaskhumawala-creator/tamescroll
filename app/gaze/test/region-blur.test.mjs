// Face-region blur mapping (owner ask 2026-08-19: blur the face, not the
// whole image). Pure math under test: normalized face box -> viewport
// rect from the element's bounding rect, with padding clamped to the
// element so overlays never bleed outside the media.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBoxToRect, sameRect, clampToInset, insetFromChain } from '../src/region-blur.mjs';

const imgRect = { left: 100, top: 50, width: 200, height: 100 };

test('maps a centered box to viewport coordinates', () => {
  const r = mapBoxToRect(imgRect, { x1: 0.25, y1: 0.25, x2: 0.75, y2: 0.75 });
  assert.deepEqual(r, { left: 150, top: 75, width: 100, height: 50 });
});

test('clamps boxes to the element bounds', () => {
  const r = mapBoxToRect(imgRect, { x1: -0.2, y1: 0, x2: 1.4, y2: 1.2 });
  assert.deepEqual(r, { left: 100, top: 50, width: 200, height: 100 });
});

test('degenerate boxes yield zero-size rects, never negative', () => {
  const r = mapBoxToRect(imgRect, { x1: 0.9, y1: 0.9, x2: 0.9, y2: 0.9 });
  assert.equal(r.width, 0);
  assert.equal(r.height, 0);
});

test('sameRect: equal within sub-pixel epsilon, unequal beyond it', () => {
  const a = { left: 10, top: 20, width: 100, height: 50 };
  assert.equal(sameRect(a, { left: 10, top: 20, width: 100, height: 50 }), true);
  // sub-pixel jitter (compositor rounding) must not count as movement
  assert.equal(sameRect(a, { left: 10.3, top: 20.2, width: 100, height: 50 }), true);
  // a real shift does
  assert.equal(sameRect(a, { left: 12, top: 20, width: 100, height: 50 }), false);
  assert.equal(sameRect(a, { left: 10, top: 20, width: 108, height: 50 }), false);
  // null on either side (element disconnected) is never "same"
  assert.equal(sameRect(a, null), false);
  assert.equal(sameRect(null, a), false);
  assert.equal(sameRect(null, null), false);
});

test('clampToInset: fully below the header inset is unchanged', () => {
  const r = { left: 10, top: 200, width: 100, height: 60 };
  assert.deepEqual(clampToInset(r, 56), { left: 10, top: 200, width: 100, height: 60, hidden: false });
});

test('clampToInset: straddling the header clips the top, no under-blur below', () => {
  // element face box from viewport y=30..90, header bottom=56
  const r = { left: 10, top: 30, width: 100, height: 60 };
  const c = clampToInset(r, 56);
  assert.equal(c.hidden, false);
  assert.equal(c.top, 56);       // clipped to the header line
  assert.equal(c.height, 34);    // 90 - 56
  assert.equal(c.left, 10);
  assert.equal(c.width, 100);
});

test('clampToInset: fully behind the header hides (header already covers it)', () => {
  const r = { left: 10, top: -40, width: 100, height: 30 }; // bottom = -10, above inset
  assert.equal(clampToInset(r, 56).hidden, true);
});

test('clampToInset: zero inset never clips', () => {
  const r = { left: 0, top: 0, width: 50, height: 50 };
  assert.deepEqual(clampToInset(r, 0), { left: 0, top: 0, width: 50, height: 50, hidden: false });
});

// topInset must find a fixed top bar even when elementsFromPoint hits a
// STATIC child of it (m.youtube: the hit at the top-center is a static
// <button> inside a position:fixed ytm-mobile-topbar-renderer). Walking
// only the direct hits misses the bar and the overlay punches over the
// menu (owner report 2026-08-23). insetFromChain walks each hit's
// ancestor chain.
test('insetFromChain: finds a fixed top bar reached via a static child hit', () => {
  const bar = { parentElement: null, _pos: 'fixed', _rect: { top: 0, bottom: 48 } };
  const button = { parentElement: bar, _pos: 'static', _rect: { top: 4, bottom: 44 } };
  const style = (n) => n._pos;
  const rect = (n) => n._rect;
  assert.equal(insetFromChain([button], style, rect, 800), 48);
});

test('insetFromChain: ignores full-height fixed overlays and non-top bars', () => {
  const modal = { parentElement: null, _pos: 'fixed', _rect: { top: 0, bottom: 700 } };
  const lower = { parentElement: null, _pos: 'sticky', _rect: { top: 300, bottom: 340 } };
  const style = (n) => n._pos;
  const rect = (n) => n._rect;
  assert.equal(insetFromChain([modal, lower], style, rect, 800), 0);
});
