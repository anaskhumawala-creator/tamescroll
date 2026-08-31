// THE ERASER HAD NO COUNTER, AND THAT IS HOW 1070 SHIPPED.
//
// 1068-1070 skipped the person pass, which made a skipped pass report an
// empty frame, which made `wipeIfEmpty` ERASE a covered woman's patch.
// Every probe in the repo looked at coverage, cadence and pass cost, and
// not one of them could see it -- from outside, a pass that erased a
// patch and a pass that never minted one both read as coverage 0. The
// owner found it in one sentence: "it's not blurring the female".
//
// So the eraser is instrumented the way the ghost gate already was
// (IDS.life.faceNoShape). These tests pin the instrument, because the
// next regression in this area is invisible without it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

test('the track count is captured BEFORE the wipe', () => {
  // Counted after, it is always 0 and the counter is worthless.
  const before = page.indexOf('var wipeBefore = videoTracks.length;');
  const call = page.indexOf('videoTracks = wipeIfEmpty(');
  const record = page.indexOf('dbgW.life.wipeErased =');
  assert.ok(before !== -1, 'wipeBefore is captured');
  assert.ok(call !== -1, 'wipeIfEmpty is still called');
  assert.ok(record !== -1, 'the erasure is recorded');
  assert.ok(before < call, 'captured before the wipe');
  assert.ok(call < record, 'recorded after the wipe');
});

test('an empty frame and an erasure are counted apart', () => {
  // They fail for different reasons: an empty frame that should not be
  // empty is a detector or skip defect, an erasure is that defect
  // reaching the screen. One number cannot say which happened.
  assert.match(page, /dbgW\.life\.emptyFrame = \(dbgW\.life\.emptyFrame \|\| 0\) \+ 1;/);
  assert.match(page, /if \(wipeBefore > 0 && videoTracks\.length === 0\)/);
});

test('the exposure number counts BLURRED tracks specifically', () => {
  // Erasing a cleared track costs nothing. Erasing a blurred one is a
  // person we had decided to cover going sharp -- the owner's report.
  assert.match(page, /if \(videoTracks\[wb\]\.state === 'blurred'\) wipeBlurred\+\+;/);
  assert.match(
    page,
    /dbgW\.life\.wipeErasedBlurred =\s*\(dbgW\.life\.wipeErasedBlurred \|\| 0\) \+ wipeBlurred;/
  );
});

test('the eraser counters reach the report, and a zero is evidence', () => {
  const report = readFileSync(new URL('../src/diag-report.mjs', import.meta.url), 'utf8');
  // They existed in the page and reached no report, so the artifact he
  // sends could not have shown the 1070 regression.
  for (const k of ['emptyFrame', 'wipeErased', 'wipeErasedTracks',
                   'wipeErasedBlurred', 'faceNoShape', 'bodyFromSlot']) {
    assert.ok(report.includes(k + ': num(life.' + k + ')'), k + ' missing from the report');
  }
  // Every counter is written as `(x || 0) + 1` at its own site, so an
  // absent key cannot be told from a missing hook. Seeded on the first
  // player pass.
  const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  assert.match(page, /lf\.wipeErased = lf\.wipeErased \|\| 0;/);
  assert.match(page, /lf\.emptyFrame = lf\.emptyFrame \|\| 0;/);
});
