// HINDSIGHT RULES for track-timeline.boxesAt (2026-09-02, plan
// docs/superpowers/plans/2026-09-02-presented-geometry-and-hindsight.md
// Tasks 2 and 3). The delay line knows the NEXT verdict when it presents
// a frame, so three things the live renderer could only guess at are
// decidable:
//
//  3'. A man read certain-male at B, blurred at A only because the
//      ladder had not cleared him yet (A's last read was NOT a certain
//      opposite-gender read): the presented frame between A and B is
//      CLEARED. A blurred A that WAS a certain flag stays blurred -- the
//      covering direction still wins wherever there was evidence for it.
//  3c. A cut between the presented frame and one of the two verdicts
//      means only the verdict on the frame's own side of the cut
//      describes its shot: present that side's box and state, no lerp
//      across the cut.
//  6.  A track that only ever COASTED after its last observation and
//      then expired with no cut and nobody taking over its box was
//      chasing someone the detector never saw again. Its coasting
//      snapshots are DEAD: presented as absent. The one interval after
//      the last observation stays covered through rule 4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTimeline, pushSnapshot, pushCut, boxesAt } from '../src/track-timeline.mjs';

const box = { x1: 0.2, y1: 0.2, x2: 0.5, y2: 0.9 };
const box2 = { x1: 0.3, y1: 0.2, x2: 0.6, y2: 0.9 };

// --- 3': hindsight clear -----------------------------------------------

test("3': blurred at A without a certain flag, cleared at B, no cut -> presented cleared", () => {
  const tl = makeTimeline(5000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', flagCertain: false }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box2, state: 'cleared' }]);
  const out = boxesAt(tl, 11.0);
  assert.equal(out.length, 1);
  assert.equal(out[0].state, 'cleared');
});

test("3': a certain flag at A keeps the frame blurred even though B cleared him", () => {
  const tl = makeTimeline(5000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', flagCertain: true }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box2, state: 'cleared' }]);
  assert.equal(boxesAt(tl, 11.0)[0].state, 'blurred');
});

test("3': cleared at A, blurred at B still presents blurred (covering wins forward)", () => {
  const tl = makeTimeline(5000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'cleared' }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box2, state: 'blurred', flagCertain: false }]);
  assert.equal(boxesAt(tl, 11.0)[0].state, 'blurred');
});

test("3': a cut between A and B refuses the hindsight clear", () => {
  const tl = makeTimeline(5000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', flagCertain: false }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box2, state: 'cleared' }]);
  pushCut(tl, 11.5);
  // The frame is before the cut, so 3c hands it A's own state: blurred.
  assert.equal(boxesAt(tl, 11.0)[0].state, 'blurred');
});

// --- 3c: no lerp across a cut ------------------------------------------

test('3c: a cut after the presented frame presents A box and A state, unlerped', () => {
  const tl = makeTimeline(5000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', flagCertain: true }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box2, state: 'blurred', flagCertain: true }]);
  pushCut(tl, 11.5);
  const out = boxesAt(tl, 11.0);
  assert.deepEqual(out[0].box, box, 'A box, not the lerp');
});

test('3c: a cut before the presented frame presents B box and B state, unlerped', () => {
  const tl = makeTimeline(5000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'cleared' }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box2, state: 'blurred', flagCertain: false }]);
  pushCut(tl, 10.5);
  const out = boxesAt(tl, 11.0);
  assert.deepEqual(out[0].box, box2, 'B box, not the lerp');
  assert.equal(out[0].state, 'blurred');
});

test('3c: a cut before the frame with A cleared and B blurred presents B blurred (never a lerped cleared)', () => {
  const tl = makeTimeline(5000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', flagCertain: false }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box2, state: 'cleared' }]);
  pushCut(tl, 10.5);
  // Frame is in B's shot, B says cleared with no cut in (cut, B]: cleared.
  assert.equal(boxesAt(tl, 11.0)[0].state, 'cleared');
});

// --- 6: dead coast -------------------------------------------------------

function deadCoastTimeline() {
  const tl = makeTimeline(10000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', coasting: false }]);
  pushSnapshot(tl, 11.0, [{ id: 1, box, state: 'blurred', coasting: true }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box, state: 'blurred', coasting: true }]);
  pushSnapshot(tl, 13.0, []); // expired, no cut, nobody took the box
  return tl;
}

test('6: a coasting run that expired with no cut is presented absent after the grace interval', () => {
  const tl = deadCoastTimeline();
  // (10, 11]: last observation to first coasted snapshot -- rule 4's one
  // interval of cover after the last sighting.
  assert.equal(boxesAt(tl, 10.5).length, 1, 'still covered for one interval after the last observation');
  assert.equal(boxesAt(tl, 11.5).length, 0, 'dead: presented absent');
  assert.equal(boxesAt(tl, 12.5).length, 0, 'dead: presented absent');
  assert.equal(boxesAt(tl, 11.0).length, 0, 'dead exactly on the coasted snapshot');
});

test('6: a coasting run that ENDS in an observation is not dead', () => {
  const tl = makeTimeline(10000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', coasting: false }]);
  pushSnapshot(tl, 11.0, [{ id: 1, box, state: 'blurred', coasting: true }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box2, state: 'blurred', coasting: false }]);
  pushSnapshot(tl, 13.0, []);
  assert.equal(boxesAt(tl, 11.5).length, 1, 'the coast bridged a detector miss; it stays');
  assert.equal(boxesAt(tl, 12.5).length, 1, 'rule 4 grace after the last observation');
});

test('6: a coasting run that ended at a cut is not dead (the cut already ends it)', () => {
  const tl = makeTimeline(10000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', coasting: false }]);
  pushSnapshot(tl, 11.0, [{ id: 1, box, state: 'blurred', coasting: true }]);
  pushCut(tl, 11.5);
  pushSnapshot(tl, 12.0, []);
  assert.equal(boxesAt(tl, 10.5).length, 1);
  assert.equal(boxesAt(tl, 11.2).length, 1, 'coasted snapshot before the cut still presents');
  assert.equal(boxesAt(tl, 11.7).length, 0, 'the cut ends it');
});

test('6: a coasting run whose box a NEW track took over is not dead (re-minted subject)', () => {
  const tl = makeTimeline(10000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', coasting: false }]);
  pushSnapshot(tl, 11.0, [{ id: 1, box, state: 'blurred', coasting: true }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box, state: 'blurred', coasting: true }]);
  pushSnapshot(tl, 13.0, [{ id: 2, box: box2, state: 'blurred', coasting: false }]);
  const out = boxesAt(tl, 11.5);
  assert.ok(out.some((e) => e.id === 1), 'the coast was a bridge to a re-minted track; it stays');
});

test('6: a dead run does not reach back past the last observation', () => {
  const tl = deadCoastTimeline();
  const before = boxesAt(tl, 10.0);
  assert.equal(before.length, 1, 'the observed snapshot itself is untouched');
});
