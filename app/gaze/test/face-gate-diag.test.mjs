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
  // The floor no longer REFUSES (owner ruling 2026-09-01). `gateKept`
  // has to be guarded explicitly now, or every face lands in BOTH
  // rings and the comparison that found the defect stops meaning
  // anything.
  assert.match(page, /if \(!noShape\) noteFaceGate\('gateKept'/);
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
  // THE GATE NO LONGER REFUSES (owner ruling 2026-09-01, "she needs to
  // be blurred"). The audit still runs on the same faces, so the ring
  // keeps recording what the floor would have thrown away -- but there
  // must be no `continue` behind it, or the ruling is not shipped.
  const gate = page.slice(page.indexOf('if (noShape) {', page.indexOf('auditRefusedFace(')));
  const block = gate.slice(0, gate.indexOf("noteFaceGate('gateKept'"));
  assert.ok(block.includes('auditRefusedFace('), 'the audit left the gate branch');
  assert.ok(!/continue;/.test(block), 'the keypoint floor still refuses a detected face');
  assert.ok(!/__TS_GATE_AUDIT\s*=/.test(page), 'the app sets the audit flag itself');
});

test('a detected face is evidence of a face, whatever the keypoint floor thought', () => {
  // `faceEvidence = noShape ? 0 : faces.length` made a pass that
  // DETECTED faces report an EMPTY FRAME, so emptyStreak climbed and
  // wipeIfEmpty erased a patch that was already on her. Measured in his
  // regime over 220s: wipeErased 10, erasing 21 BLURRED tracks.
  assert.match(page, /var faceEvidence = faces\.length;/);
  assert.ok(
    !/faceEvidence\s*=\s*noShape\s*\?/.test(page),
    'the eraser can see a detected face as an empty frame again'
  );
});
