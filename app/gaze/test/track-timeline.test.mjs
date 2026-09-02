// Task 8 (docs/superpowers/plans/2026-09-02-latency-restructure-and-delay-line.md):
// track-timeline.mjs turns two known verdicts into one interpolated
// presentation frame. One test per rule of boxesAt, plus the keepMs
// pruning rule. The two example tests are copied from the plan
// verbatim (rule 4's cut case).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeTimeline,
  LATE_HOLD_MS,
  LOOKAHEAD_MS,
  BACK_JUMP_S,
  resetTimeline,
  pushSnapshot,
  pushCut,
  boxesAt,
  latestSnapshot,
  BIRTH_BACKDATE_PAD,
} from '../src/track-timeline.mjs';

// Rule: no B (no snapshot with mediaTime >= m) -> null.
// Rule 1 (1096): a frame later than the newest verdict HOLDS that
// verdict's boxes (padded outward with lateness, one solid rectangle)
// rather than answering null. On the Redmi 6.9% of presented frames ran
// past the newest snapshot (a dropped pass at a cut doubles the gap), and
// null sent the renderer to the LIVE tracks -- 1.5s ahead of the picture
// -- which is where 5 of 23 covered certain-male reads and the
// exposure classifier's 69 'late' frames came from. The newest verdict is
// at most one gap stale; the live one is a delay further away.
test('a frame later than the newest verdict holds that verdict, padded; too old or across a cut it is null', () => {
  const tl = makeTimeline(3000);
  const box = { x1: 0.3, y1: 0.3, x2: 0.5, y2: 0.7 };
  pushSnapshot(tl, 10.0, [{ id: 7, box: box, state: 'blurred' }]);
  const held = boxesAt(tl, 10.5);
  assert.equal(held.length, 1);
  assert.equal(held[0].id, 7);
  assert.equal(held[0].state, 'blurred');
  assert.ok(held[0].box.x1 < box.x1 && held[0].box.x2 > box.x2, 'padded outward');
  assert.ok(held[0].box.x1 > box.x1 - 0.1, 'but not by more than the birth pad');
  const later = boxesAt(tl, 11.0);
  assert.ok(later[0].box.x1 <= held[0].box.x1, 'the pad grows with lateness');
  assert.equal(boxesAt(tl, 10.0 + LATE_HOLD_MS / 1000 + 0.01), null, 'past the hold bound it is null again');
  assert.equal(boxesAt(tl, 50), null);
  pushCut(tl, 10.2);
  assert.equal(boxesAt(tl, 10.5), null, 'a cut after the newest verdict ends its shot: nothing to hold');
});

// Rule 3'' (1096): a verdict that CREDITED a certain clear but had not
// finished the ladder (clearPending), confirmed cleared by the verdict
// after it, is presented cleared for the interval before it too. The
// live path clears at C either way; hindsight only moves that clear one
// interval earlier for a person the ladder was about to clear. 7 of 23
// covered certain-male reads on the Redmi were this ladder interval
// (pendingClearLadder 3, demotedAtCut 3, bornBlurredAtCut 1).
test('a pending clear confirmed by the next verdict is presented cleared one interval earlier', () => {
  const box = { x1: 0.3, y1: 0.3, x2: 0.5, y2: 0.7 };
  function tl3(aFlag, cState, cut) {
    const tl = makeTimeline(10000);
    pushSnapshot(tl, 10.0, [{ id: 1, box: box, state: 'blurred', flagCertain: aFlag }]);
    pushSnapshot(tl, 11.0, [{ id: 1, box: box, state: 'blurred', clearPending: true }]);
    if (cut) pushCut(tl, 11.5);
    if (cState) pushSnapshot(tl, 12.0, [{ id: 1, box: box, state: cState }]);
    return tl;
  }
  assert.equal(boxesAt(tl3(false, 'cleared', false), 10.5)[0].state, 'cleared', 'A uncertain, B pending, C cleared');
  assert.equal(boxesAt(tl3(false, 'cleared', false), 11.5)[0].state, 'cleared', '(B,C) was already cleared by rule 3');
  assert.equal(boxesAt(tl3(false, null, false), 10.5)[0].state, 'blurred', 'no C yet: the ladder stands');
  assert.equal(boxesAt(tl3(false, 'blurred', false), 10.5)[0].state, 'blurred', 'C blurred: the ladder was right');
  assert.equal(boxesAt(tl3(true, 'cleared', false), 10.5)[0].state, 'blurred', 'a certain flag at A keeps it covered');
  assert.equal(boxesAt(tl3(false, 'cleared', true), 10.5)[0].state, 'blurred', 'a cut between B and C: C is another shot');
  // Born at B with the clear pending, confirmed at C: cleared from birth.
  const tl = makeTimeline(10000);
  pushSnapshot(tl, 10.0, []);
  pushSnapshot(tl, 11.0, [{ id: 1, box: box, state: 'blurred', clearPending: true }]);
  pushSnapshot(tl, 12.0, [{ id: 1, box: box, state: 'cleared' }]);
  assert.equal(boxesAt(tl, 10.5)[0].state, 'cleared', 'the back-dated birth is cleared too');
  // And with no A at all (rule 2) the same lookahead applies.
  const tl2 = makeTimeline(10000);
  pushSnapshot(tl2, 11.0, [{ id: 1, box: box, state: 'blurred', clearPending: true }]);
  pushSnapshot(tl2, 12.0, [{ id: 1, box: box, state: 'cleared' }]);
  assert.equal(boxesAt(tl2, 5.0)[0].state, 'cleared');
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

// Rule 3' (test/timeline-hindsight.test.mjs) narrows the A-blurred half
// to a CERTAIN flag at A: a blur the ladder had merely not cleared yet
// is presented cleared once B clears him.
test('state is blurred if either bracketing verdict says blurred, in both directions', () => {
  const tlBlurredThenCleared = makeTimeline(3000);
  pushSnapshot(tlBlurredThenCleared, 10.0, [{ id: 1, box: { x1: 0, y1: 0, x2: 1, y2: 1 }, state: 'blurred', flagCertain: true }]);
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

// Phase-i I8: a born track's back-dated box is PADDED toward the swept
// region, not held at B's own box unadjusted -- a moving entrant would
// otherwise be covered at their arrival position and sharp at their
// real one for up to a whole verdict interval. The pad shrinks to
// exactly zero at B itself (frac 1), so the box is unmodified there.
test('a born track is padded outward for the back-dated segment, and exact at its own verdict', () => {
  const tl = makeTimeline(3000);
  const bBox = { x1: 0.4, y1: 0.1, x2: 0.6, y2: 0.9 };
  pushSnapshot(tl, 10.0, []);
  pushSnapshot(tl, 11.0, [{ id: 7, box: bBox, state: 'blurred' }]);

  // t=10.2 -> frac 0.2 -> pad amount BIRTH_BACKDATE_PAD * (1 - 0.2).
  const w = bBox.x2 - bBox.x1, h = bBox.y2 - bBox.y1;
  const amt = BIRTH_BACKDATE_PAD * (1 - 0.2);
  const out = boxesAt(tl, 10.2);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 7);
  assert.equal(out[0].state, 'blurred');
  assert.ok(Math.abs(out[0].box.x1 - (bBox.x1 - w * amt)) < 1e-9, out[0].box.x1);
  assert.ok(Math.abs(out[0].box.x2 - (bBox.x2 + w * amt)) < 1e-9, out[0].box.x2);
  assert.ok(Math.abs(out[0].box.y1 - (bBox.y1 - h * amt)) < 1e-9, out[0].box.y1);
  assert.ok(Math.abs(out[0].box.y2 - (bBox.y2 + h * amt)) < 1e-9, out[0].box.y2);
  // Genuinely padded, not a no-op -- catches a fix that computes `amt`
  // but never applies it.
  assert.ok(out[0].box.x1 < bBox.x1);
  assert.ok(out[0].box.x2 > bBox.x2);

  // Exactly at B (frac 1): unpadded, byte-exact.
  const atB = boxesAt(tl, 11.0);
  assert.deepEqual(atB[0].box, bBox);
});

test("the born-track pad clamps to the timeline's own [0,1] domain", () => {
  const tl = makeTimeline(3000);
  // Wide box near the left/top edge, queried just after A (frac ~0.01,
  // near-maximal pad -- mediaTime cannot equal A's own snapshot time and
  // still enter this branch, since that collapses A and B to one
  // snapshot -- rule 3's shortcut, not rule 5). The pad would push
  // x1/y1 negative without the clamp.
  pushSnapshot(tl, 10.0, []);
  pushSnapshot(tl, 11.0, [{ id: 9, box: { x1: 0.01, y1: 0.01, x2: 0.5, y2: 0.5 }, state: 'blurred' }]);
  const outLow = boxesAt(tl, 10.01);
  assert.equal(outLow[0].box.x1, 0);
  assert.equal(outLow[0].box.y1, 0);

  // Wide box near the right/bottom edge: pad would push x2/y2 past 1.
  const tl2 = makeTimeline(3000);
  pushSnapshot(tl2, 10.0, []);
  pushSnapshot(tl2, 11.0, [{ id: 9, box: { x1: 0.5, y1: 0.5, x2: 0.99, y2: 0.99 }, state: 'blurred' }]);
  const outHigh = boxesAt(tl2, 10.01);
  assert.equal(outHigh[0].box.x2, 1);
  assert.equal(outHigh[0].box.y2, 1);
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

// Rule 3'' walks over UNDECIDED snapshots (1096e). On the Redmi the
// timeline gets a snapshot per pass and most passes are position passes
// (no gender read), so "the snapshot after B" was a position pass still
// carrying the pending clear, and the lookahead answered 'blurred'.
// Track 28, events-v1096d: born at a cut at 181.382, certain male 0.75
// (pending), position passes at 182.483 and 183.05 still pending,
// verdict at 183.35 cleared -- 2.0s covered with two certain male reads
// and nothing against him. The walk stops at the first DECIDING snapshot
// (cleared, blurred-without-pending, or the id gone), at a cut, and at
// LOOKAHEAD_MS.
test('a pending clear confirmed after intervening position passes is presented cleared from B', () => {
  const box = { x1: 0.3, y1: 0.3, x2: 0.5, y2: 0.7 };
  function build(decide, extra) {
    const tl = makeTimeline(10000);
    pushSnapshot(tl, 10.0, [{ id: 1, box: box, state: 'blurred', clearPending: true }]);
    pushSnapshot(tl, 10.3, [{ id: 1, box: box, state: 'blurred', clearPending: true }]);
    pushSnapshot(tl, 10.6, [{ id: 1, box: box, state: 'blurred', clearPending: true }]);
    if (extra) extra(tl);
    if (decide) pushSnapshot(tl, 11.2, decide === 'gone' ? [] : [{ id: 1, box: box, state: decide }]);
    return tl;
  }
  assert.equal(boxesAt(build('cleared'), 10.1)[0].state, 'cleared', '(B, pos1)');
  assert.equal(boxesAt(build('cleared'), 10.45)[0].state, 'cleared', '(pos1, pos2)');
  assert.equal(boxesAt(build('cleared'), 10.9)[0].state, 'cleared', '(pos2, C)');
  assert.equal(boxesAt(build('blurred'), 10.1)[0].state, 'blurred', 'C decided blurred: the ladder was right');
  assert.equal(boxesAt(build('gone'), 10.1)[0].state, 'blurred', 'the track died undecided');
  assert.equal(boxesAt(build(null), 10.1)[0].state, 'blurred', 'nothing decided yet');
  assert.equal(boxesAt(build('cleared', (tl) => pushCut(tl, 10.7)), 10.1)[0].state, 'blurred', 'a cut before C: C is another shot');
  // Past the walk bound the answer stays blurred even if a later snapshot
  // clears: pending snapshots every 0.3s for longer than LOOKAHEAD_MS
  // from B, then a clear. The walk from B must give up before it.
  const far = makeTimeline(20000);
  const stepS = 0.3;
  let t = 10.0;
  while (t - 10.0 <= LOOKAHEAD_MS / 1000 + stepS) {
    pushSnapshot(far, t, [{ id: 1, box: box, state: 'blurred', clearPending: true }]);
    t += stepS;
  }
  pushSnapshot(far, t, [{ id: 1, box: box, state: 'cleared' }]);
  assert.equal(boxesAt(far, 10.1)[0].state, 'blurred', 'the walk from B outran LOOKAHEAD_MS');
  // ...while a frame bracketed by the LAST pending snapshot is one step from the clear.
  assert.equal(boxesAt(far, t - stepS / 2)[0].state, 'cleared');
});

// A SEEK BACK IS A DISCONTINUITY, NOT AN EARLIER SNAPSHOT (1097).
//
// Owner, 2026-09-02 night: after seeking back on the timeline one patch
// froze at one position and never moved again. The timeline was keyed
// by media time and pruned against the NEWEST media time it held, so
// after a seek back of more than keepMs every snapshot pushed at the
// new position was shifted out the moment it arrived, and boxesAt kept
// answering rule 2 ("no A, B as-is") with the one old snapshot from the
// future -- one solid patch, frozen, until playback caught up with it.
// A seek back shorter than keepMs interleaved two watches with
// different track ids instead. Either way the old snapshots describe a
// tracker that was wiped at the seek.
test('a snapshot pushed at an earlier media time than the newest resets the timeline (seek back)', () => {
  const box = { x1: 0.3, y1: 0.3, x2: 0.5, y2: 0.7 };
  const tl = makeTimeline(3500);
  pushSnapshot(tl, 80.0, [{ id: 1, box: box, state: 'blurred' }]);
  pushSnapshot(tl, 80.6, [{ id: 1, box: box, state: 'blurred' }]);
  pushCut(tl, 80.3);
  const newBox = { x1: 0.6, y1: 0.2, x2: 0.8, y2: 0.6 };
  pushSnapshot(tl, 55.4, [{ id: 9, box: newBox, state: 'blurred' }]);
  assert.equal(tl.snapshots.length, 1, 'the old watch is gone');
  assert.equal(tl.cuts.length, 0, 'and its cuts');
  const at = boxesAt(tl, 55.6);
  assert.equal(at.length, 1);
  assert.equal(at[0].id, 9, 'the presented patch is the NEW track, not the frozen old one');
  assert.equal(boxesAt(tl, 80.3), null, 'the old future is unreachable');
  // A seek back shorter than keepMs is the same discontinuity.
  const tl2 = makeTimeline(3500);
  pushSnapshot(tl2, 60.0, [{ id: 1, box: box, state: 'blurred' }]);
  pushSnapshot(tl2, 61.0, [{ id: 1, box: box, state: 'blurred' }]);
  pushSnapshot(tl2, 59.0, [{ id: 7, box: newBox, state: 'blurred' }]);
  assert.equal(tl2.snapshots.length, 1);
  assert.equal(boxesAt(tl2, 59.5)[0].id, 7);
  // Ordinary jitter is not a seek: a snapshot a few ms behind the newest
  // (a position pass keyed at a ring frame the verdict already passed)
  // is inserted in order and prunes nothing.
  const tl3 = makeTimeline(3500);
  pushSnapshot(tl3, 60.0, [{ id: 1, box: box, state: 'blurred' }]);
  pushSnapshot(tl3, 60.0 - BACK_JUMP_S / 2, [{ id: 1, box: box, state: 'blurred' }]);
  assert.equal(tl3.snapshots.length, 2);
  assert.equal(tl3.snapshots[0].mediaTime, 60.0 - BACK_JUMP_S / 2);
});

test('resetTimeline empties snapshots and cuts and keeps the window', () => {
  const tl = makeTimeline(3500);
  pushSnapshot(tl, 10.0, [{ id: 1, box: { x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2 }, state: 'blurred' }]);
  pushCut(tl, 10.5);
  resetTimeline(tl);
  assert.deepEqual(tl.snapshots, []);
  assert.deepEqual(tl.cuts, []);
  assert.equal(tl.keepMs, 3500);
  assert.equal(boxesAt(tl, 10.2), null);
});
