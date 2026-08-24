// Face-region blur mapping (owner ask 2026-08-19: blur the face, not the
// whole image). Pure math under test: normalized face box -> viewport
// rect from the element's bounding rect, with padding clamped to the
// element so overlays never bleed outside the media.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBoxToRect, sameRect, clampToInset, insetFromChain, padBox, expandToBody } from '../src/region-blur.mjs';

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

test('padBox: expands a box by a fraction of its own size, clamped to 0..1', () => {
  const p = padBox({ x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6, confidence: 0.9 }, 0.5);
  // width/height 0.2, pad 0.5 -> ±0.1 each side
  assert.equal(Math.round(p.x1 * 1000) / 1000, 0.3);
  assert.equal(Math.round(p.y1 * 1000) / 1000, 0.3);
  assert.equal(Math.round(p.x2 * 1000) / 1000, 0.7);
  assert.equal(Math.round(p.y2 * 1000) / 1000, 0.7);
  assert.equal(p.confidence, 0.9);
});

test('padBox: never pushes past the element edge', () => {
  const p = padBox({ x1: 0.05, y1: 0.9, x2: 0.25, y2: 1.0 }, 0.5);
  assert.equal(p.x1, 0); // 0.05 - 0.1 clamped to 0
  assert.equal(p.y2, 1); // 1.0 + pad clamped to 1
  assert.ok(p.x2 <= 1 && p.y1 >= 0);
});

test('expandToBody: de-inflates the enlarged box, widens to shoulders, extends down the torso', () => {
  // Input is a detector box (already 1.4x-enlarged): 0.1 wide -> true
  // face ~0.0714. Shoulders ±1.4 true-widths of centre, torso 3.2
  // true-heights below the chin, hair margin 0.3 above.
  const b = expandToBody({ x1: 0.45, y1: 0.1, x2: 0.55, y2: 0.2, confidence: 0.9 });
  assert.ok(Math.abs(b.x1 - 0.3857143) < 1e-6);
  assert.ok(Math.abs(b.x2 - 0.6142857) < 1e-6);
  assert.ok(Math.abs(b.y1 - 0.0928571) < 1e-6);
  assert.ok(Math.abs(b.y2 - 0.6142857) < 1e-6);
  assert.equal(b.confidence, 0.9);
  // sanity: the body column must NOT balloon toward the full frame WIDTH
  // (visual probe 2026-08-24 caught exactly that); height runs long by
  // design — a standing person is ~7 face-heights tall.
  assert.ok(b.x2 - b.x1 < 0.25);
});

test('expandToBody: clamps to the element for edge faces', () => {
  const b = expandToBody({ x1: 0.0, y1: 0.6, x2: 0.3, y2: 0.95 });
  assert.equal(b.x1, 0);
  assert.equal(b.y2, 1); // torso extension runs off the bottom -> clamp
  assert.ok(b.x2 <= 1 && b.y1 >= 0);
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
