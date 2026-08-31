// THE GHOST GATE IS THROWING AWAY THREE FACES IN FOUR ON HIS PHONE, AND
// NOTHING RECORDS WHAT IT THREW.
//
// MEASURED live on 1073, one 250s watch page: `faceNoShape` 127 against
// roughly 41 gender reads, with all twelve MoveNet slots reading n:0 --
// the R21 regime, still. So on his hardware PFF_FRAME_KP_FLOOR alone
// decides whether a detected face becomes a patch, and that floor was
// calibrated on gauntlet footage. A refused REAL face is an uncovered
// person, which is his oldest complaint; the gate exists because of his
// other one ("random blur marks here and there"). Only the refused
// POPULATION can tell them apart.
//
// Diagnostic only -- no verdict changes. These tests pin that the two
// rings record the same three numbers on both sides of the branch, so
// they can actually be compared, and that they carry nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReport, reportViolations } from '../src/diag-report.mjs';
import { frameMaxKp } from '../src/person-gate.mjs';

const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

test('both sides of the gate are recorded, and only those sides', () => {
  // Refused inside the branch, kept after it. The first draft recorded
  // every face reaching the branch, which would have made the two rings
  // the same population and the comparison meaningless.
  assert.match(page, /if \(noShape\) \{\s*\n\s*noteFaceGate\('gateRefused'/);
  assert.match(page, /continue;\s*\n\s*\}\s*\n\s*noteFaceGate\('gateKept'/);
});

test('the ring carries three numbers and nothing else', () => {
  const body = page.slice(page.indexOf('function noteFaceGate'));
  const push = body.slice(body.indexOf('r.push('), body.indexOf('if (r.length'));
  for (const k of ['c:', 'px:', 'k:']) assert.ok(push.includes(k), k + ' missing');
  // A url or an element reference here is how the privacy promise gets
  // broken one convenient field at a time.
  assert.ok(!/src|url|href|node|el\b/.test(push), 'the ring grew a non-numeric field');
  assert.match(body, /if \(r\.length > 60\) r\.shift\(\);/);
});

test('the report carries both rings and stays clean', () => {
  const r = buildReport({
    ids: {
      gateRefused: [{ c: 0.42, px: 71, k: 0.06 }],
      gateKept: [{ c: 0.88, px: 103, k: 0.31 }],
    },
  });
  assert.deepEqual(r.player.gateRefused, [{ c: 0.42, px: 71, k: 0.06 }]);
  assert.deepEqual(r.player.gateKept, [{ c: 0.88, px: 103, k: 0.31 }]);
  assert.deepEqual(reportViolations(r, 'https://m.youtube.com/watch?v=abcdefghijk'), []);
});

test('frameMaxKp is the number the gate thresholds on', () => {
  assert.equal(frameMaxKp([{ maxKp: 0.05 }, { maxKp: 0.31 }, { maxKp: 0.02 }]), 0.31);
  // No pass at all is not evidence of an empty frame -- the gate's own
  // rule for a missing slotDiag is `false`, and this must not contradict
  // it by reporting 0.
  assert.equal(frameMaxKp([]), null);
  assert.equal(frameMaxKp(null), null);
});
