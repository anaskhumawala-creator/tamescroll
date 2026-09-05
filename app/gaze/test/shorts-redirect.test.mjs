import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchUrlForShorts, watchUrlForShortsHref } from '../src/shorts-redirect.mjs';

test('a /shorts/ path becomes the watch page for the same video', () => {
  assert.equal(watchUrlForShorts('/shorts/jNQXAC9IVRw', ''), '/watch?v=jNQXAC9IVRw');
  assert.equal(watchUrlForShorts('/shorts/jNQXAC9IVRw/', '?t=15'), '/watch?v=jNQXAC9IVRw&t=15s');
});

test('anything that is not a short is left alone', () => {
  assert.equal(watchUrlForShorts('/watch?v=x', ''), null);
  assert.equal(watchUrlForShorts('/shorts', ''), null);
  assert.equal(watchUrlForShorts('/shorts/', ''), null);
  assert.equal(watchUrlForShorts('/feed/subscriptions', ''), null);
});

test('hrefs resolve relative to the page and stay on youtube', () => {
  assert.equal(watchUrlForShortsHref('/shorts/abcdefg', 'https://m.youtube.com'), '/watch?v=abcdefg');
  assert.equal(watchUrlForShortsHref('https://www.youtube.com/shorts/abcdefg', 'https://m.youtube.com'), '/watch?v=abcdefg');
  assert.equal(watchUrlForShortsHref('https://example.com/shorts/abcdefg', 'https://m.youtube.com'), null);
  assert.equal(watchUrlForShortsHref('/watch?v=abcdefg', 'https://m.youtube.com'), null);
});
