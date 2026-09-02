// Phase-L critic (docs/critic/phase-l.md), one test per EXPOSURE row,
// each red against 9cc6cb8 on the critic's own fixture numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pt from '../src/person-track.mjs';
import { makeTimeline, pushSnapshot, pushCut, boxesAt } from '../src/track-timeline.mjs';

// --- L1 / L2: the merged head floor ---------------------------------------

// Fixture A: P blurred with NO head anchor (hull 0.32-0.88), Q blurred and
// contained in P with a head at 0.628-0.772, a cleared man whose face
// (0.32-0.44, centre 0.38) sits INSIDE P's hull.
const P = { id: 1, box: { x1: 0.30, y1: 0.10, x2: 0.90, y2: 1.0 }, state: 'blurred', core: { x1: 0.32, y1: 0.15, x2: 0.88, y2: 1.0 }, head: null };
const Q = { id: 2, box: { x1: 0.55, y1: 0.30, x2: 0.85, y2: 0.95 }, state: 'blurred', core: { x1: 0.60, y1: 0.35, x2: 0.80, y2: 0.90 },
  head: { x1: 0.628, y1: 0.38, x2: 0.772, y2: 0.62 }, headX: 0.70, headW: 0.12 };
const M = { id: 3, box: { x1: 0.10, y1: 0.20, x2: 0.50, y2: 1.0 }, state: 'cleared', face: { x1: 0.32, y1: 0.30, x2: 0.44, y2: 0.50 } };

test('L1 fixture A: a union with a member that has no head gets NO head floor -- the edge stays on the hull rule', () => {
  // Q first: on 9cc6cb8 mergedHead saw no anchors and took the FIRST
  // entry's head (critic L2), which masked this row in the other order.
  const out = pt.mergePresented([Q, P, M]);
  assert.equal(out.length, 1, 'P and Q merge');
  assert.equal(out[0].box.x1, 0.30, `edge moved to ${out[0].box.x1}: the face centre is inside the union hull, so nothing may move`);
});

test('L1 fixture B: the merged floor is the union of BOTH heads, so the edge never lands inside the other subject\'s head', () => {
  const Ph = { ...P, head: { x1: 0.324, y1: 0.15, x2: 0.396, y2: 0.35 }, headX: 0.36, headW: 0.06 };
  const Mh = { ...M, face: { x1: 0.24, y1: 0.30, x2: 0.36, y2: 0.50 } }; // centre 0.30, left of the hull
  const out = pt.mergePresented([Q, Ph, Mh]);
  assert.equal(out.length, 1);
  assert.ok(out[0].box.x1 <= 0.324 + 1e-9, `edge at ${out[0].box.x1} is inside P's own head box 0.324-0.396`);
  assert.ok(out[0].box.x1 >= 0.30, 'and it did move off his face');
});

test('L2: presented merged geometry does not depend on entry order', () => {
  const Ph = { ...P, head: { x1: 0.324, y1: 0.15, x2: 0.396, y2: 0.35 }, headX: 0.36, headW: 0.06 };
  const Mh = { ...M, face: { x1: 0.24, y1: 0.30, x2: 0.36, y2: 0.50 } };
  const a = pt.mergePresented([Ph, Q, Mh]);
  const b = pt.mergePresented([Q, Ph, Mh]);
  assert.deepEqual(a.map((e) => e.box), b.map((e) => e.box));
});

test('L2: presentTracks carries the head anchors mergedHead reads', () => {
  let tracks = pt.updatePersonTracks([], [
    { box: { x1: 0.5, y1: 0.4, x2: 0.9, y2: 1.0, headX: 0.7, headY: 0.5, headW: 0.12, headH: 0.2 }, flagged: true, certain: true, verdictDt: 250 },
  ], 250);
  const e = pt.presentTracks(tracks)[0];
  assert.equal(e.headX, 0.7);
  assert.equal(e.headW, 0.12);
});

// --- L3: a head at the person-gate width floor is not a floor -------------

function pair(headW) {
  const covered = { x1: 0.22, y1: 0.40, x2: 0.90, y2: 1.0 };
  const core = { x1: 0.22, y1: 0.42, x2: 0.88, y2: 1.0 }; // his face centre 0.25 is INSIDE her hull
  const herHead = { headX: 0.75, headY: 0.50, headW: headW, headH: 0.20 };
  const clear = { x1: 0.05, y1: 0.10, x2: 0.45, y2: 1.0 };
  const hisHead = { headX: 0.25, headY: 0.30, headW: 0.16, headH: 0.28 };
  let tracks = [];
  for (let i = 0; i < 4; i++) {
    tracks = pt.updatePersonTracks(tracks, [
      { box: { ...covered, core, ...herHead }, flagged: true, certain: true, verdictDt: 250 },
      { box: { ...clear, ...hisHead }, flagged: false, certain: true, verdictDt: 250 },
    ], 250);
  }
  return tracks;
}

test('L3: a measured head is the floor; a head at the 0.04 person-gate floor is not', () => {
  const measured = pair(0.12);
  const her = measured.find((t) => t.state === 'blurred');
  const drawnMeasured = pt.blurredTracks(measured).find((e) => e.id === her.id).box;
  assert.ok(drawnMeasured.x1 >= 0.33 - 1e-9, `measured head: edge travels to his face (${drawnMeasured.x1})`);

  const floored = pair(0.04);
  const her2 = floored.find((t) => t.state === 'blurred');
  const drawnFloored = pt.blurredTracks(floored).find((e) => e.id === her2.id).box;
  // The hull rule alone: his face centre is inside her hull on X, so no X
  // candidate exists (the R27 rule may still take the cheaper Y edge).
  assert.equal(drawnFloored.x1, pt.padTrackBox(her2).x1, 'unmeasured head: no X travel');
});

// --- L4: certain flag evidence survives an uncertain read ------------------

test('L4: three certain flags then one uncertain read still present flagCertain; a certain clear resets it', () => {
  const box = { x1: 0.5, y1: 0.4, x2: 0.9, y2: 1.0 };
  let tracks = [];
  for (let i = 0; i < 3; i++) tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: true, verdictDt: 250 }], 250);
  assert.equal(pt.presentTracks(tracks)[0].flagCertain, true);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: false, verdictDt: 250 }], 250);
  assert.equal(tracks[0].lastVerdict, 'uncertain', 'fixture: the uncertain read rewrote lastVerdict');
  assert.equal(pt.presentTracks(tracks)[0].flagCertain, true, 'the certain evidence is still on the track');
  // Coast and a cut keep it too.
  tracks = pt.updatePersonTracks(tracks, [], 250);
  assert.equal(pt.presentTracks(tracks)[0].flagCertain, true);
  tracks = pt.demoteTracks(tracks);
  assert.equal(pt.presentTracks(tracks)[0].flagCertain, true);
  // A certain clear is the only thing that resets it.
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].flagEvidence, false);
});

// --- L5: a dead run never crosses a cut -----------------------------------

test('L5: the walk-back stops at a cut, so a pre-cut coasted patch survives an expiry in the next shot', () => {
  const box = { x1: 0.2, y1: 0.2, x2: 0.5, y2: 0.9 };
  const tl = makeTimeline(10000);
  pushSnapshot(tl, 10.0, [{ id: 1, box, state: 'blurred', coasting: false }]);
  pushSnapshot(tl, 11.0, [{ id: 1, box, state: 'blurred', coasting: true }]);
  pushCut(tl, 11.5);
  pushSnapshot(tl, 12.0, [{ id: 1, box, state: 'blurred', coasting: true }]);
  pushSnapshot(tl, 13.0, []);
  assert.equal(boxesAt(tl, 11.0).length, 1, 'shot A, before the cut');
  assert.equal(boxesAt(tl, 11.2).length, 1, 'shot A, before the cut');
  assert.equal(boxesAt(tl, 11.7).length, 0, 'the cut ends it');
  assert.equal(boxesAt(tl, 12.5).length, 0, 'the post-cut coast is dead');
});

// --- L6: a cleared entry carries the drawn geometry -----------------------

test('L6: a cleared entry is presented with the padded box, so a cleared->blurred lerp never shows the raw box', () => {
  const box = { x1: 0.30, y1: 0.20, x2: 0.70, y2: 0.95 };
  let tracks = [];
  for (let i = 0; i < 8; i++) tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  const t = tracks[0];
  assert.equal(t.state, 'cleared', 'fixture: eight certain clears clear him');
  const e = pt.presentTracks(tracks)[0];
  assert.deepEqual(e.box, pt.padTrackBox(t));
  assert.ok(e.box.y1 < box.y1, 'the crown pad is on the cleared entry too');
});

// --- 1096: the ladder's pending clear rides the presented entry --------

test('presentTracks carries clearPending: one certain clear below the instant bar, no flag evidence', () => {
  const box = { x1: 0.5, y1: 0.4, x2: 0.9, y2: 1.0 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'blurred', 'fixture: one read is one rung, still blurred');
  assert.equal(pt.presentTracks(tracks)[0].clearPending, true);
  // A certain flag is not pending anything.
  let flagged = pt.updatePersonTracks([], [{ box, flagged: true, certain: true, verdictDt: 250 }], 250);
  assert.equal(pt.presentTracks(flagged)[0].clearPending, false);
  // Nor is an uncertain read on a fresh track.
  let unc = pt.updatePersonTracks([], [{ box, flagged: true, certain: false, verdictDt: 250 }], 250);
  assert.equal(pt.presentTracks(unc)[0].clearPending, false);
  // A certain clear after certain flag evidence: L4 says a certain clear
  // is the one thing that resets flagEvidence, so this IS pending -- and
  // the interval before it stays covered anyway, because the snapshot on
  // the A side still carries flagCertain (track-timeline rule 3').
  let rev = pt.updatePersonTracks([], [{ box, flagged: true, certain: true, verdictDt: 250 }], 250);
  assert.equal(pt.presentTracks(rev)[0].flagCertain, true);
  rev = pt.updatePersonTracks(rev, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(pt.presentTracks(rev)[0].clearPending, true);
});
