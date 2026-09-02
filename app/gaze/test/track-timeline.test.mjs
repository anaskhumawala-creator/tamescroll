// Task 8 (docs/superpowers/plans/2026-09-02-latency-restructure-and-delay-line.md):
// track-timeline.mjs turns two known verdicts into one interpolated
// presentation frame. One test per rule of boxesAt, plus the keepMs
// pruning rule. The two example tests are copied from the plan
// verbatim (rule 4's cut case).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeTimeline,
  pushSnapshot,
  pushCut,
  boxesAt,
  latestSnapshot,
} from '../src/track-timeline.mjs';

// Rule: no B (no snapshot with mediaTime >= m) -> null.
test('boxesAt returns null when no verdict at or after the frame exists', () => {
  const tl = makeTimeline(3000);
  pushSnapshot(tl, 10.0, [{ id: 7, box: { x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2 }, state: 'blurred' }]);
  assert.equal(boxesAt(tl, 10.5), null);
  assert.equal(boxesAt(tl, 50), null);
});

// Rule: no A (no snapshot with mediaTime <= m) -> B's tracks as-is.
test('with no earlier verdict, boxesAt returns the next verdict as-is (blur-first)', () => {
  const tl = makeTimeline(3000);
  const bBox = { x1: 0.3, y1: 0.2, x2: 0.5, y2: 0.8 };
  pushSnapshot(tl, 11.0, [{ id: 7, box: bBox, state: 'blurred' }]);
  const out = boxesAt(tl, 5.0);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 7);
  assert.deepEqual(out[0].box, bBox);
  assert.equal(out[0].state, 'blurred');
});

// Rule: track in both A and B -> lerped box; state = blurred if either
// side says blurred (covering direction always wins).
test('a track in both verdicts is lerped by media-time fraction', () => {
  const tl = makeTimeline(3000);
  pushSnapshot(tl, 10.0, [{ id: 7, box: { x1: 0.0, y1: 0.0, x2: 0.2, y2: 0.2 }, state: 'cleared' }]);
  pushSnapshot(tl, 11.0, [{ id: 7, box: { x1: 1.0, y1: 1.0, x2: 1.2, y2: 1.2 }, state: 'cleared' }]);
  const out = boxesAt(tl, 10.25); // fraction 0.25
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 7);
  assert.equal(out[0].box.x1, 0.25);
  assert.equal(out[0].box.y1, 0.25);
  assert.equal(out[0].box.x2, 0.45);
  assert.equal(out[0].box.y2, 0.45);
  assert.equal(out[0].state, 'cleared');
});

test('state is blurred if either bracketing verdict says blurred, in both directions', () => {
  const tlBlurredThenCleared = makeTimeline(3000);
  pushSnapshot(tlBlurredThenCleared, 10.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'blurred' }]);
  pushSnapshot(tlBlurredThenCleared, 11.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'cleared' }]);
  assert.equal(boxesAt(tlBlurredThenCleared, 10.5)[0].state, 'blurred');

  const tlClearedThenBlurred = makeTimeline(3000);
  pushSnapshot(tlClearedThenBlurred, 10.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'cleared' }]);
  pushSnapshot(tlClearedThenBlurred, 11.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'blurred' }]);
  assert.equal(boxesAt(tlClearedThenBlurred, 10.5)[0].state, 'blurred');

  const tlBothCleared = makeTimeline(3000);
  pushSnapshot(tlBothCleared, 10.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'cleared' }]);
  pushSnapshot(tlBothCleared, 11.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'cleared' }]);
  assert.equal(boxesAt(tlBothCleared, 10.5)[0].state, 'cleared');
});

// Rule: track only in A (gone by B). Without a cut it survives A's
// box/state until B; with a cut in (A, B] it is omitted at/after the
// cut.
test('a track missing from the next verdict survives to the next verdict when there was no cut', () => {
  const tl = makeTimeline(3000);
  const aBox = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.9 };
  pushSnapshot(tl, 10.0, [{ id: 7, box: aBox, state: 'blurred' }]);
  pushSnapshot(tl, 11.0, []);
  const out = boxesAt(tl, 10.8);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 7);
  assert.deepEqual(out[0].box, aBox);
  assert.equal(out[0].state, 'blurred');
});

test('a track missing from the next verdict ends at the cut', () => {
  const tl = makeTimeline(3000);
  const aBox = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.9 };
  pushSnapshot(tl, 10.0, [{ id: 7, box: aBox, state: 'blurred' }]);
  pushCut(tl, 10.5);
  pushSnapshot(tl, 11.0, []);
  assert.equal(boxesAt(tl, 10.2).length, 1);
  assert.equal(boxesAt(tl, 10.5).length, 0);
  assert.equal(boxesAt(tl, 10.6).length, 0);
});

// Rule: track only in B (born by B), copied verbatim from the plan.
test('a track present in the next verdict is covered back to the previous verdict when there was no cut', () => {
  const tl = makeTimeline(3000);
  pushSnapshot(tl, 10.0, []);
  pushSnapshot(tl, 11.0, [{ id: 7, box: { x1: 0.4, y1: 0.1, x2: 0.6, y2: 0.9 }, state: 'blurred' }]);
  const out = boxesAt(tl, 10.2);
  assert.equal(out.length, 1); assert.equal(out[0].id, 7); assert.equal(out[0].state, 'blurred');
});

test('...but not across a cut that happened after the presented frame', () => {
  const tl = makeTimeline(3000);
  pushSnapshot(tl, 10.0, []); pushCut(tl, 10.5);
  pushSnapshot(tl, 11.0, [{ id: 7, box: { x1: 0.4, y1: 0.1, x2: 0.6, y2: 0.9 }, state: 'blurred' }]);
  assert.equal(boxesAt(tl, 10.2).length, 0);
  assert.equal(boxesAt(tl, 10.6).length, 1);
});

// keepMs pruning.
test('pushSnapshot drops snapshots older than keepMs behind the newest', () => {
  const tl = makeTimeline(1000); // keepMs 1000ms = 1.0s of media time
  pushSnapshot(tl, 10.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 0.1, y2: 0.1 }, state: 'blurred' }]);
  pushSnapshot(tl, 10.5, [{ id: 1, box: { x1: 0, y1: 0, x2: 0.1, y2: 0.1 }, state: 'blurred' }]);
  pushSnapshot(tl, 11.2, [{ id: 1, box: { x1: 0, y1: 0, x2: 0.1, y2: 0.1 }, state: 'cleared' }]);
  // Newest is 11.2; keepMs 1000ms drops anything older than 10.2, so
  // the 10.0 snapshot is gone and the 10.5 one survives.
  const latest = latestSnapshot(tl);
  assert.equal(latest.mediaTime, 11.2);
  // 10.0 was dropped, so boxesAt at 10.0 has no A: it falls back to
  // rule 2 (no A -> B's tracks as-is), where B is now the 10.5 snapshot.
  const out = boxesAt(tl, 10.0);
  assert.equal(out.length, 1);
  assert.equal(out[0].state, 'blurred');
});

test('latestSnapshot returns null on an empty timeline and the newest snapshot otherwise', () => {
  const tl = makeTimeline(3000);
  assert.equal(latestSnapshot(tl), null);
  pushSnapshot(tl, 5.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'blurred' }]);
  pushSnapshot(tl, 6.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'cleared' }]);
  assert.equal(latestSnapshot(tl).mediaTime, 6.0);
});
