// THE ONLY EVIDENCE FOUR PLATFORMS HAVE, AND IT HAD NO COUNTER.
//
// On Reddit, X, Instagram and Facebook `isPlayer` is false (findings 16),
// so `wholeFrameFlagged` IS the pipeline: one boolean per frame, four
// clean samples to reveal the video. A frame where the detector finds
// nothing is indistinguishable from a frame with nobody in it --
// `cleanStreak++` either way.
//
// 16a asserted the 1089 letterbox could not make a frame blind. The
// phase-E critic measured 3 blind frames in 241 where the squash had 0,
// 79% of the lost detections under 64px -- his own band. The claim was
// wrong because nothing counted it, which is the loop-34 shape: a
// counter that does not exist reads exactly like a counter at zero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReport } from '../src/diag-report.mjs';

const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

test('BOTH detector paths count a frame that found nothing', () => {
  // There are two, and instrumenting one is worse than instrumenting
  // neither: the worker path is what runs on his phone and the in-page
  // path is what runs when the worker is dead or on CPU, so a counter on
  // one arm silently describes a different population run to run. The
  // 08-31 small-face bench had exactly this defect -- two producers of
  // control crops, one patched -- and it read 1 of 81 instead of 77.
  const hits = page.match(/wholeFrameLife\('wholeFrameNoFaces'\)/g) || [];
  assert.equal(hits.length, 2, 'the worker path AND the in-page path');
});

test('the reveal is counted apart from the blind frame', () => {
  // They are different events and they want different fixes. A blind
  // frame is a detector question; a reveal is the blind frames REACHING
  // the user, and only the second is an exposure. Counting one number
  // for both is how `birthClaimed` lost a round of analysis (R17).
  const idx = page.indexOf("wholeFrameLife('wholeFrameCleared')");
  const clear = page.indexOf('clearEl(video)', idx);
  assert.ok(idx !== -1, 'the reveal is counted');
  assert.ok(clear !== -1 && clear - idx < 200, 'counted at the reveal itself');
  // And the denominator, or a count of blind frames says nothing about
  // a rate.
  assert.match(page, /wholeFrameLife\('wholeFrameSamples'\)/);
});

test('all three are seeded, so absent cannot be mistaken for never-hooked', () => {
  assert.match(page, /d\.life\.wholeFrameSamples === undefined/);
  assert.match(page, /d\.life\.wholeFrameNoFaces = 0;/);
  assert.match(page, /d\.life\.wholeFrameCleared = 0;/);
});

test('and they reach the report, zeros included', () => {
  // `player.life` is a shape-checked pass-through since loop 37e, so this
  // should hold for any numeric key -- and it is asserted rather than
  // assumed, because for a fortnight it was a six-key WHITELIST and
  // roughly thirty counters never left the device.
  const r = buildReport({
    ids: { life: { wholeFrameSamples: 240, wholeFrameNoFaces: 3, wholeFrameCleared: 0 } },
  });
  assert.equal(r.player.life.wholeFrameSamples, 240);
  assert.equal(r.player.life.wholeFrameNoFaces, 3);
  assert.equal(r.player.life.wholeFrameCleared, 0, 'a zero is evidence and must survive');
});

test('the name is new -- it does not rebase an existing counter', () => {
  // A new counter reusing an old name merges two unrelated events into
  // one number and silently rebases every reading any earlier round has
  // quoted. `clampFired` was already taken once (loop 39) and this is the
  // check that caught it.
  for (const name of ['wholeFrameSamples', 'wholeFrameNoFaces', 'wholeFrameCleared']) {
    const uses = (page.match(new RegExp(name, 'g')) || []).length;
    // Seed + bump sites only. If this rises sharply somebody has started
    // bumping it from a second, unrelated place.
    assert.ok(uses >= 2 && uses <= 6, `${name} appears ${uses} times`);
  }
});
