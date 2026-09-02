// THE ASSIGNMENT IS REACHED THROUGH THE TRACKER, NOT JUST THROUGH ITS
// OWN MODULE.
//
// `test/assign.test.mjs` exercises `optimalAssign` directly. That is not
// enough here: this repo has shipped a regression test that passed
// against broken code because it called the pure function while the
// defect lived one layer up in `init-entry` (loop 37c, C3). So every
// assertion below goes through `updatePersonTracks` -- the function the
// player actually calls -- and reads the birth counters the artifact
// reports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updatePersonTracks, PTRACK_ASSIGN, setAssign } from '../src/person-track.mjs';

const SHIPPED_DEFAULT = PTRACK_ASSIGN;

// A crosswise frame. Track A overlaps both observations; track B only the
// second, and slightly less than A does. Greedy takes the single biggest
// number (A-obs2) and leaves B unmatched and obs1 unclaimed; the optimal
// pairing matches both.
//
// The boxes are built from actual overlaps rather than asserted, and the
// first test checks the precondition -- a fixture that does not overlap
// has made three assertions in this repo pass vacuously.
// Measured, not asserted: A-o1 0.391, A-o2 0.524, B-o1 0.000,
// B-o2 0.333. The globally highest pair is A-o2, and taking it leaves
// obs1 with no partner at all -- which is the greedy failure.
const trackA = { x1: 0.30, y1: 0.10, x2: 0.62, y2: 0.90 };
const trackB = { x1: 0.56, y1: 0.10, x2: 0.88, y2: 0.90 };
const obs1 = { x1: 0.16, y1: 0.10, x2: 0.48, y2: 0.90 };
const obs2 = { x1: 0.40, y1: 0.10, x2: 0.72, y2: 0.90 };

function seed() {
  // Two live tracks, one per box, born the ordinary way. Seeding is done
  // BEFORE the counter ring is reset, or its own two births would land in
  // the numbers the tests read.
  const t = updatePersonTracks([], [
    { box: trackA, flagged: true, certain: true },
    { box: trackB, flagged: true, certain: true },
  ], 250);
  assert.equal(t.length, 2, 'precondition: two tracks exist');
  return t;
}

function step(mode) {
  setAssign(mode);
  try {
    const before = seed();
    globalThis.__TS_GAZE_IDS = { life: {} };
    const t = updatePersonTracks(before, [
      { box: obs1, flagged: true, certain: true },
      { box: obs2, flagged: true, certain: true },
    ], 250);
    const life = globalThis.__TS_GAZE_IDS.life;
    delete globalThis.__TS_GAZE_IDS;
    return { tracks: t, life };
  } finally {
    // Back to the SHIPPED default, captured at import time. Reading
    // PTRACK_ASSIGN here would read the value this call just set, so the
    // restore would be a no-op and every later test would inherit the
    // previous one's mode.
    setAssign(SHIPPED_DEFAULT);
  }
}

test('the shipped default is the measured one', () => {
  // 1091 ships `optimal`: on the corpus, in his regime, man mode is
  // better on all three numbers (-0.5s exposure, -2.5s false cover,
  // -13.5s phantom) and woman mode pays 1.0s of exposure for 35.0s of
  // phantom. A default nobody measured does not get to be the default,
  // in either direction -- so this pins which one it is.
  assert.equal(PTRACK_ASSIGN, 'optimal');
});

test('greedy strands a track on the crosswise frame -- the precondition', () => {
  const g = step('greedy');
  // One observation could not be matched, so it was BORN, and it is
  // counted as contended rather than fresh or a near-miss: it overlapped
  // a live track well enough to match and lost it. And the track it lost
  // is still alive, so the frame ends with THREE tracks covering two
  // people -- the churn E5 counts.
  assert.equal(g.tracks.length, 3, 'greedy leaves a third track behind');
  assert.equal(g.life.birthContended, 1, 'greedy mints a contended birth');
  assert.equal(g.life.birthFresh || 0, 0);
  assert.equal(g.life.birthNearMiss || 0, 0);
});

test('optimal matches both, so nothing is re-minted', () => {
  const o = step('optimal');
  assert.equal(o.tracks.length, 2, 'two people, two tracks');
  assert.equal(o.life.birthContended || 0, 0, 'no contended birth');
  assert.equal(o.life.birthFresh || 0, 0);
});

test('and the switch is real -- the two modes disagree through the tracker', () => {
  // The whole point of the wiring. If setAssign stopped reaching
  // updatePersonTracks, both arms would read identically and every
  // corpus number produced by assign-ab.mjs would be one arm printed
  // twice -- which is exactly what the A-series ladder turned out to be.
  const g = step('greedy');
  const o = step('optimal');
  assert.notEqual(g.life.birthContended || 0, o.life.birthContended || 0);
});
