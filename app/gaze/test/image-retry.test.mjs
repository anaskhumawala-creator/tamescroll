// A failed image used to stay covered for the life of the page. These
// pin the bound that makes putting it back on the queue safe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldRetry, IMAGE_MAX_TRIES } from '../src/image-retry.mjs';

const ok = { connected: true, queued: false };

test('a first failure is retried, because it is usually the worker warming', () => {
  assert.equal(shouldRetry(1, ok), true);
});

test('the retries are bounded, so an unjudgeable image settles into covered', () => {
  assert.equal(shouldRetry(IMAGE_MAX_TRIES - 1, ok), true);
  assert.equal(shouldRetry(IMAGE_MAX_TRIES, ok), false);
  assert.equal(shouldRetry(IMAGE_MAX_TRIES + 5, ok), false);
});

test('an image that left the document is not chased', () => {
  assert.equal(shouldRetry(1, { connected: false, queued: false }), false);
});

test('an image already waiting its turn is not queued twice', () => {
  assert.equal(shouldRetry(1, { connected: true, queued: true }), false);
});

test('a zero-failure call never queues anything', () => {
  // Guards the caller incrementing before it asks.
  assert.equal(shouldRetry(0, ok), false);
  assert.equal(shouldRetry(-1, ok), false);
});

test('both failure paths in the image pipeline put the image back', () => {
  // The worker path and the in-page path had the SAME defect and the
  // same comment about staying covered forever; fixing one is how it
  // comes back on the other.
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  // Three matches: the definition and the two call sites.
  const calls = src.match(/requeueAfterFailure\(img\)/g) || [];
  assert.equal(calls.length, 3, 'worker failure and in-page failure both retry');
  assert.match(src, /shouldRetry\(/, 'the bound comes from the tested module');
});
