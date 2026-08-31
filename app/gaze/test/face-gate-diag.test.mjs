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
  assert.match(page, /if \(noShape\) \{\s*\n\s*auditRefusedFace\(\s*\n\s*noteFaceGate\('gateRefused'/);
  assert.match(page, /\} else \{\s*\n\s*noteFaceGate\('gateKept'/);
  // AND THE BRANCH NO LONGER REFUSES (owner ruling, 2026-09-01). The
  // frame gate is a counter now; the mint decision moved to isNullRead
  // one scope down. A `continue` reappearing here is the regression.
  const branch = page.slice(page.indexOf("if (noShape) {"));
  const body = branch.slice(0, branch.indexOf("noteFaceGate('gateKept'"));
  assert.ok(!/\bcontinue;/.test(body), 'the frame gate started refusing faces again');
});

test('the ring carries three numbers and nothing else', () => {
  const body = page.slice(page.indexOf('function noteFaceGate'));
  const push = body.slice(body.indexOf('var entry = {'), body.indexOf('if (r.length'));
  for (const k of ['ms:', 'c:', 'px:', 'k:', 'cov:']) assert.ok(push.includes(k), k + ' missing');
  // A url or an element reference here is how the privacy promise gets
  // broken one convenient field at a time.
  assert.ok(!/src|url|href|node|el\b/.test(push), 'the ring grew a non-numeric field');
  assert.match(body, /if \(r\.length > 60\) r\.shift\(\);/);
});

test('the report carries both rings and stays clean', () => {
  const r = buildReport({
    ids: {
      gateRefused: [{ ms: null, c: 0.42, px: 71, k: 0.06, cov: 0, g: null, s: null }],
      gateKept: [{ ms: null, c: 0.88, px: 103, k: 0.31, cov: 1, g: null, s: null }],
    },
  });
  assert.deepEqual(r.player.gateRefused, [{ ms: null, c: 0.42, px: 71, k: 0.06, cov: 0, g: null, s: null }]);
  assert.deepEqual(r.player.gateKept, [{ ms: null, c: 0.88, px: 103, k: 0.31, cov: 1, g: null, s: null }]);
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

// THE FLOOR MOVED, AND THE REASON IT MOVED IS A MEASUREMENT.
// He ruled it on 2026-09-01 after the degradation curve: 28 real faces
// re-read at every size 32-160px agreed with their own full-resolution
// answer 28 of 28, with 0 certain-wrong. His player reads faces down to
// 53px and everything under the old 64 abstained and failed closed --
// the man he keeps reporting as blurred.
import { FACE_MIN_NATIVE_PX } from '../src/gender-verdict.mjs';

test('the size floor is 40, and it is still a real floor', () => {
  assert.equal(FACE_MIN_NATIVE_PX, 40);
  // R15: this constant shipped DEAD for six rounds because a
  // function-local `var` was minified to `var IY;` and every comparison
  // became `px < undefined`. A number, in a module, is the shape that
  // survives -- so assert it IS a number and not merely truthy.
  assert.equal(typeof FACE_MIN_NATIVE_PX, 'number');
  // Below his measured minimum face (53px), above the point where a
  // face is a handful of pixels.
  assert.ok(FACE_MIN_NATIVE_PX < 53 && FACE_MIN_NATIVE_PX >= 32);
});

test('the refused-face audit is diagnostic only and cannot run in a shipped build', () => {
  // It costs a crop and an inference per REFUSED face, on the very pass
  // the gate exists to make cheap, so a build that ran it by default
  // would be slower than one with no gate at all. Nothing in the app
  // sets __TS_GATE_AUDIT; a probe does.
  const fn = page.slice(page.indexOf('function auditRefusedFace'));
  const body = fn.slice(0, fn.indexOf('\n    }'));
  assert.ok(
    body.includes('if (!entry || !window.__TS_GATE_AUDIT) return;'),
    'the audit lost its flag guard'
  );
  // It reads, and mints nothing: no track, no patch, no memory.
  for (const forbidden of ['videoTracks', 'personFromFace', 'applyRegion', 'identityMemory']) {
    assert.ok(!body.includes(forbidden), 'the audit reached into ' + forbidden);
  }
  assert.ok(!/__TS_GATE_AUDIT\s*=/.test(page), 'the app sets the audit flag itself');
});

test('the mint gate refuses a null read, never a child, and only on a face-derived person', () => {
  // The whole fix, pinned. `nullRead` and not `abstained`: a child read
  // abstains too and is the one subject that must always be covered.
  // `box.fromFace`: a MoveNet-corroborated person is a measured human
  // and is never refused on the strength of a gender read.
  const i = page.indexOf('obs.verdictDt = verdictDt;');
  assert.ok(i > 0, 'observation push site moved');
  const site = page.slice(i, i + 1400);
  assert.ok(
    site.includes('obs.nullRead && obs.box && obs.box.fromFace'),
    'the mint gate lost a condition'
  );
  assert.ok(!/obs\.abstained/.test(site), 'the mint gate keyed off abstained and would refuse a child');
  assert.ok(site.includes("nullDropped"), 'a refusal nobody counts is a refusal nobody can audit');
});

test('a detected face is evidence the frame is not empty', () => {
  // The second way the gate reached her: a refused face zeroed
  // faceEvidence, the pass reported an EMPTY FRAME while faces were
  // plainly detected, and wipeIfEmpty erased the patch she already had.
  // Measured in his regime, 220s: wipeErased 10 over 21 blurred tracks.
  assert.ok(
    page.includes('var faceEvidence = faces.length;'),
    'faceEvidence is conditional again -- a refusal can erase a covered person'
  );
  assert.ok(
    !/faceEvidence = noShape \? 0/.test(page),
    'the noShape zeroing came back'
  );
});
