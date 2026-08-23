// Face-region blur mapping (owner ask 2026-08-19: blur the face, not the
// whole image). Pure math under test: normalized face box -> viewport
// rect from the element's bounding rect, with padding clamped to the
// element so overlays never bleed outside the media.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBoxToRect, sameRect } from '../src/region-blur.mjs';

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
