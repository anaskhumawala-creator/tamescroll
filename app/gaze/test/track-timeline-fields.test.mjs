// Presented geometry (2026-09-02): the snapshot carries what the
// presentation merge and the hindsight rules need, and boxesAt hands it
// back on every branch (both sides, A only, B only, no A).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTimeline, pushSnapshot, boxesAt, latestSnapshot } from '../src/track-timeline.mjs';

const core = { x1: 0.5, y1: 0.4, x2: 0.8, y2: 0.9 };
const face = { x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2 };
const blurredBox = { x1: 0.4, y1: 0.1, x2: 0.9, y2: 1 };
const clearedBox = { x1: 0.0, y1: 0.0, x2: 0.3, y2: 1 };

test('a snapshot keeps core, face, flagCertain and coasting', () => {
  const tl = makeTimeline(3000);
  pushSnapshot(tl, 10.0, [
    { id: 1, box: blurredBox, state: 'blurred', core, flagCertain: true, coasting: true },
    { id: 2, box: clearedBox, state: 'cleared', face, flagCertain: false, coasting: false },
  ]);
  const snap = latestSnapshot(tl);
  assert.deepEqual(snap.tracks[0].core, core);
  assert.equal(snap.tracks[0].flagCertain, true);
  assert.equal(snap.tracks[0].coasting, true);
  assert.deepEqual(snap.tracks[1].face, face);
  assert.equal(snap.tracks[1].flagCertain, false);
});

test('boxesAt returns core and face on every branch', () => {
  const tl = makeTimeline(3000);
  pushSnapshot(tl, 10.0, [
    { id: 1, box: blurredBox, state: 'blurred', core, flagCertain: true, coasting: false },
    { id: 3, box: blurredBox, state: 'blurred', core, flagCertain: false, coasting: false },
  ]);
  pushSnapshot(tl, 11.0, [
    { id: 1, box: blurredBox, state: 'blurred', core, flagCertain: true, coasting: false },
    { id: 2, box: clearedBox, state: 'cleared', face, flagCertain: false, coasting: false },
  ]);
  // both sides (1), A only (3), B only (2)
  const out = boxesAt(tl, 10.5);
  assert.deepEqual(out.find((t) => t.id === 1).core, core);
  assert.deepEqual(out.find((t) => t.id === 3).core, core);
  assert.deepEqual(out.find((t) => t.id === 2).face, face);
  // no A (blur-first): B is the 10.0 snapshot, which holds ids 1 and 3
  assert.deepEqual(boxesAt(tl, 5.0).find((t) => t.id === 3).core, core);
  // exactly on a snapshot
  assert.deepEqual(boxesAt(tl, 11.0).find((t) => t.id === 1).core, core);
});
