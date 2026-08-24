// Person-region blur pure math (v3, parent-anchored — owner report
// 2026-08-24: scroll briefly exposed document-anchored patches).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxToParentRect, sameRect, padBox, expandToBody } from '../src/region-blur.mjs';

test('boxToParentRect: element inset inside its parent maps to parent space', () => {
  // parent at viewport (80, 40); img at (100, 50) sized 200x100
  const r = boxToParentRect(
    { left: 80, top: 40, width: 240, height: 140 },
    { left: 100, top: 50, width: 200, height: 100 },
    { x1: 0.25, y1: 0.25, x2: 0.75, y2: 0.75 }
  );
  assert.deepEqual(r, { left: 70, top: 35, width: 100, height: 50 });
});

test('boxToParentRect: clamps boxes to the element bounds', () => {
  const r = boxToParentRect(
    { left: 0, top: 0, width: 200, height: 100 },
    { left: 0, top: 0, width: 200, height: 100 },
    { x1: -0.2, y1: 0, x2: 1.4, y2: 1.2 }
  );
  assert.deepEqual(r, { left: 0, top: 0, width: 200, height: 100 });
});

test('boxToParentRect: degenerate boxes yield zero-size rects, never negative', () => {
  const r = boxToParentRect(
    { left: 0, top: 0, width: 200, height: 100 },
    { left: 0, top: 0, width: 200, height: 100 },
    { x1: 0.9, y1: 0.9, x2: 0.9, y2: 0.9 }
  );
  assert.equal(r.width, 0);
  assert.equal(r.height, 0);
});

test('sameRect: equal within sub-pixel epsilon, unequal beyond it', () => {
  const a = { left: 10, top: 20, width: 100, height: 50 };
  assert.equal(sameRect(a, { left: 10, top: 20, width: 100, height: 50 }), true);
  assert.equal(sameRect(a, { left: 10.3, top: 20.2, width: 100, height: 50 }), true);
  assert.equal(sameRect(a, { left: 12, top: 20, width: 100, height: 50 }), false);
  assert.equal(sameRect(a, { left: 10, top: 20, width: 108, height: 50 }), false);
  assert.equal(sameRect(a, null), false);
  assert.equal(sameRect(null, a), false);
});

test('padBox: expands a box by a fraction of its own size, clamped to 0..1', () => {
  const p = padBox({ x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6, confidence: 0.9 }, 0.5);
  assert.equal(Math.round(p.x1 * 1000) / 1000, 0.3);
  assert.equal(Math.round(p.y1 * 1000) / 1000, 0.3);
  assert.equal(Math.round(p.x2 * 1000) / 1000, 0.7);
  assert.equal(Math.round(p.y2 * 1000) / 1000, 0.7);
  assert.equal(p.confidence, 0.9);
});

test('padBox: never pushes past the element edge', () => {
  const p = padBox({ x1: 0.05, y1: 0.9, x2: 0.25, y2: 1.0 }, 0.5);
  assert.equal(p.x1, 0);
  assert.equal(p.y2, 1);
  assert.ok(p.x2 <= 1 && p.y1 >= 0);
});

test('expandToBody: de-inflates the enlarged box, widens to shoulders, extends down the torso', () => {
  const b = expandToBody({ x1: 0.45, y1: 0.1, x2: 0.55, y2: 0.2, confidence: 0.9 });
  assert.ok(Math.abs(b.x1 - 0.4142857) < 1e-6);
  assert.ok(Math.abs(b.x2 - 0.5857143) < 1e-6);
  assert.ok(Math.abs(b.y1 - 0.0928571) < 1e-6);
  assert.ok(Math.abs(b.y2 - 0.6142857) < 1e-6);
  assert.equal(b.confidence, 0.9);
  // sanity: the body column must NOT balloon toward the full frame WIDTH
  // (visual probe 2026-08-24 caught exactly that).
  assert.ok(b.x2 - b.x1 < 0.25);
});

test('expandToBody: clamps to the element for edge faces', () => {
  const b = expandToBody({ x1: 0.0, y1: 0.6, x2: 0.3, y2: 0.95 });
  assert.equal(b.x1, 0);
  assert.equal(b.y2, 1);
  assert.ok(b.x2 <= 1 && b.y1 >= 0);
});
