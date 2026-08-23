// JS-side NMS for the BlazeFace decode (perf: replaces
// tf.image.nonMaxSuppressionAsync + two extra GPU downloads with one
// download and pure JS over 896 candidates).
import test from 'node:test';
import assert from 'node:assert/strict';
import { nonMaxSuppression } from '../src/nms.mjs';

// boxes as flat [x1,y1,x2,y2] per row, scores parallel array
test('empty when nothing passes the score threshold', () => {
  const boxes = new Float32Array([0, 0, 10, 10, 20, 20, 30, 30]);
  const scores = new Float32Array([0.1, 0.19]);
  assert.deepEqual(nonMaxSuppression(boxes, scores, 20, 0.1, 0.2), []);
});

test('keeps the highest-scoring box of an overlapping pair', () => {
  // two near-identical boxes, one clear winner
  const boxes = new Float32Array([0, 0, 10, 10, 1, 1, 11, 11, 50, 50, 60, 60]);
  const scores = new Float32Array([0.9, 0.8, 0.7]);
  const kept = nonMaxSuppression(boxes, scores, 20, 0.1, 0.2);
  assert.deepEqual(kept, [0, 2]);
});

test('respects maxOutput', () => {
  const boxes = new Float32Array([0, 0, 10, 10, 50, 50, 60, 60, 100, 100, 110, 110]);
  const scores = new Float32Array([0.9, 0.8, 0.7]);
  assert.deepEqual(nonMaxSuppression(boxes, scores, 2, 0.1, 0.2), [0, 1]);
});

test('keeps disjoint boxes regardless of order', () => {
  const boxes = new Float32Array([50, 50, 60, 60, 0, 0, 10, 10]);
  const scores = new Float32Array([0.5, 0.95]);
  // sorted by score: index 1 first, then 0 (no overlap)
  assert.deepEqual(nonMaxSuppression(boxes, scores, 20, 0.1, 0.2), [1, 0]);
});

test('suppresses by IoU threshold boundary', () => {
  // IoU of these two = (5*10)/(10*10 + 10*10 - 5*10) = 50/150 = 0.333
  const boxes = new Float32Array([0, 0, 10, 10, 5, 0, 15, 10]);
  const scores = new Float32Array([0.9, 0.8]);
  assert.deepEqual(nonMaxSuppression(boxes, scores, 20, 0.34, 0.2), [0, 1]); // 0.333 < 0.34 survives
  assert.deepEqual(nonMaxSuppression(boxes, scores, 20, 0.33, 0.2), [0]);    // 0.333 > 0.33 suppressed
});

test('zero-area boxes never suppress others', () => {
  const boxes = new Float32Array([5, 5, 5, 5, 0, 0, 10, 10]);
  const scores = new Float32Array([0.9, 0.8]);
  assert.deepEqual(nonMaxSuppression(boxes, scores, 20, 0.1, 0.2), [0, 1]);
});
