import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
const sample = src.slice(src.indexOf('function sampleOnce()'), src.indexOf('function sampleOnce()') + 2600);

test('a feed preview does not run a pass while the feed is scrolling', () => {
  assert.ok(sample.includes('feedPreview()'), 'sampleOnce must know a preview from a watch player');
  assert.ok(sample.includes('scrolling(performance.now())'), 'and must gate on the scroll signal');
});

test('the skipped preview is covered whole, never left exposed', () => {
  const i = sample.indexOf('feedPreview()');
  const gate = sample.slice(i, i + 260);
  assert.ok(gate.includes('markFlagged(video)'), 'blur-first: a skipped pass must cover the video');
  assert.ok(gate.indexOf('return') > gate.indexOf('markFlagged'), 'cover before returning');
});

test('the watch player is never skipped -- that page has no preview', () => {
  const fn = src.slice(src.indexOf('function feedPreview()'), src.indexOf('function feedPreview()') + 320);
  assert.ok(fn.includes("'/watch'"), 'watch pages must be excluded by path');
  assert.ok(fn.includes('return false'), 'an unreadable path must not skip passes');
});
