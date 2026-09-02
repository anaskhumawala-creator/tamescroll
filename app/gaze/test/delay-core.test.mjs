import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringBudget, pickPresent, presentTarget, refillStep, RING_BYTES_MAX } from '../src/delay-core.mjs';

test('ringBudget keeps native size when it fits and downscales to 640 wide when it does not', () => {
  const a = ringBudget(640, 360, 30, 1000); // 45 frames x 0.92MB = 41MB
  assert.equal(a.scale, 1); assert.equal(a.frames, 45); assert.ok(a.bytes <= RING_BYTES_MAX);
  const b = ringBudget(1280, 720, 60, 1000); // 90 x 3.7MB does not fit
  assert.equal(b.w, 640); assert.equal(b.h, 360); assert.equal(b.frames, 90); assert.equal(b.bytes, 90 * 640 * 360 * 4); assert.equal(b.over, false);
});
test('pickPresent returns the newest entry at or before target, -1 when none', () => {
  const ring = [{ mediaTime: 1.0 }, { mediaTime: 1.033 }, { mediaTime: 1.066 }];
  assert.equal(pickPresent(ring, 0.9), -1);
  assert.equal(pickPresent(ring, 1.04), 1);
  assert.equal(pickPresent(ring, 5), 2);
});
test('presentTarget scales the delay by playback rate', () => {
  assert.equal(presentTarget(10, 1000, 1), 9);
  assert.equal(presentTarget(10, 1000, 2), 8);
});
test('refillStep: flush -> refilling, picked -> live, picked while live stays live', () => {
  assert.equal(refillStep('live', 'flush'), 'refilling');
  assert.equal(refillStep('refilling', 'picked'), 'live');
  assert.equal(refillStep('live', 'picked'), 'live');
});
