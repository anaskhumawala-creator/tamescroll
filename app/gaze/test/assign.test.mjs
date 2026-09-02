// THE ASSIGNMENT ARM, AND THE CASE THAT DECIDES IT.
//
// `birthContended` is the largest class of birth in both gender arms
// once the bench runs in his regime (E5, re-derived). A contended birth
// is a subject re-minted because greedy handed their track to somebody
// else, and a re-minted subject loses their earned clear -- FALSE COVER.
//
// Every test below is built from a concrete pair list rather than from
// boxes, because the thing under test is the assignment and not the
// geometry. A fixture whose precondition does not hold has cost this
// repo three vacuous assertions before, so each case asserts what greedy
// does BEFORE asserting what optimal does differently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greedyAssign, optimalAssign } from '../src/assign.mjs';

const ids = (r) => r.map((p) => `${p.t}-${p.o}`).sort().join(',');
const total = (r) => r.reduce((a, p) => a + p.iou, 0);

test('the crosswise case: greedy strands a track AND mints a birth', () => {
  // track 0 overlaps both observations, track 1 only the second.
  const pairs = [
    { t: 0, o: 0, iou: 0.45 },
    { t: 0, o: 1, iou: 0.50 },
    { t: 1, o: 1, iou: 0.48 },
  ];
  const g = greedyAssign(pairs, 2, 2);
  // The precondition: greedy really does take the single highest number
  // and strand the rest. Without this the test below proves nothing.
  assert.equal(ids(g), '0-1', 'greedy takes 0.50 and matches nobody else');
  assert.equal(g.length, 1);

  const o = optimalAssign(pairs, 2, 2);
  assert.equal(o.length, 2, 'optimal matches both');
  assert.equal(ids(o), '0-0,1-1');
  // And it pays for it, which is the trade being made deliberately.
  assert.ok(total(o) < total(g) + 0.5, 'cardinality is bought with overlap');
});

test('a lone strong edge never beats two weaker ones', () => {
  // The failure mode of a pure max-WEIGHT objective: 0.90 alone outscores
  // 0.20 + 0.20, and taking it would make the birth count worse. This is
  // why the edge weight carries a cardinality term.
  const pairs = [
    { t: 0, o: 0, iou: 0.90 },
    { t: 0, o: 1, iou: 0.20 },
    { t: 1, o: 0, iou: 0.20 },
  ];
  const o = optimalAssign(pairs, 2, 2);
  assert.equal(o.length, 2, 'two matches beat one better one');
  assert.equal(ids(o), '0-1,1-0');
});

test('a match is never invented for a pair nobody offered', () => {
  // The cost matrix has to be complete for the algorithm to run, so every
  // cell that carries no pair is filled with a forbidden cost. If those
  // ever leaked out, the tracker would associate an observation with a
  // track that failed PTRACK_IOU_MIN or sizeCompatible -- an association
  // the gates refused, arriving through the back door.
  const pairs = [{ t: 0, o: 0, iou: 0.30 }];
  const o = optimalAssign(pairs, 3, 4);
  assert.equal(o.length, 1);
  assert.equal(ids(o), '0-0');
});

test('optimal never matches fewer than greedy, over 2000 random frames', () => {
  // Deterministic: Math.random cannot be reproduced and a property test
  // that cannot be re-run is an anecdote.
  let seed = 20260902;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let better = 0, worseCard = 0;
  for (let n = 0; n < 2000; n++) {
    const nT = 1 + Math.floor(rnd() * 6);
    const nO = 1 + Math.floor(rnd() * 6);
    const pairs = [];
    for (let t = 0; t < nT; t++) {
      for (let o = 0; o < nO; o++) {
        // Sparse, the way a real frame is: most (track, obs) pairs do not
        // overlap at all and never reach the pair list.
        if (rnd() < 0.55) continue;
        pairs.push({ t, o, iou: 0.15 + rnd() * 0.85 });
      }
    }
    const g = greedyAssign(pairs, nT, nO);
    const o2 = optimalAssign(pairs, nT, nO);
    if (o2.length < g.length) worseCard++;
    if (o2.length > g.length) better++;
    // Whatever it returns must be a legal matching drawn from the offered
    // pairs -- no track twice, no observation twice, nothing invented.
    const ts = new Set(), os = new Set();
    for (const p of o2) {
      assert.ok(!ts.has(p.t) && !os.has(p.o), 'a legal matching');
      ts.add(p.t); os.add(p.o);
      assert.ok(pairs.some((q) => q.t === p.t && q.o === p.o), 'offered');
    }
  }
  assert.equal(worseCard, 0, 'optimal may never match fewer than greedy');
  // And the whole point: on sparse frames greedy really does lose matches,
  // so this arm is not a no-op dressed up as a fix.
  assert.ok(better > 0, `greedy loses matches on ${better} of 2000 frames`);
});
