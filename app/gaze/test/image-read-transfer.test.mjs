// THE IMAGE PATH'S NULL GUARD SHIPPED DEAD, AND THE WORKER BOUNDARY IS WHY.
//
// `flaggedFaceIndices` has refused a no-signal read since finding 45 was
// priced -- `if (adult && isNullRead(f) && mayNotMint(f)) continue;`. That
// line is live on the IN-PAGE image path (init-entry.js:1029 hands it the
// verdicts straight off `classifyFaceGenders`) and was DEAD on the WORKER
// image path (init-entry.js:1234), because worker-entry's reply trimmed
// each read to `{gender, score, age, childP, px}`.
//
// Both predicates it needs were in the dropped half:
//
//   isNullRead  needs `raw`   -- "with nothing to test, trust the read"
//   mayNotMint  needs `shape.norm` -- "a MISSING norm never refuses"
//
// Each of those defaults is correct in isolation and fails closed, so the
// guard did not throw and did not log; it simply never fired. Finding 52
// measured what that costs on 370 real thumbnails: 48 image marks on
// person-free thumbnails where MoveNet admits nobody, nm p50 3.44 against
// a floor of 5, signature `male s0.26` (raw 0.63, inside NULL_V_LO..HI).
//
// The fix is `imageRead` in face-decode.mjs -- ONE copy of "what an image
// verdict carries across a boundary", called from the worker, so the two
// image paths cannot answer differently again. The descriptor (1024
// floats) stays dropped; `raw` and `norm` are two numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { imageRead } from '../src/face-decode.mjs';
import { flaggedFaceIndices, countRefusedByNullGuard, refusedByNullGuard } from '../src/gender-verdict.mjs';
import { imgDiagRead } from '../src/diag-report.mjs';
import * as gv from '../src/gender-verdict.mjs';
import { applyTuning } from '../src/tuning.mjs';

// A junk mark off finding 52's own table: `male s0.26`, nm 1.4, on a
// minecraft-gameplay thumbnail where MoveNet admits nobody.
function junkRead() {
  return {
    gender: 'male',
    score: 0.26,
    age: 36.9,
    childP: 0.01,
    raw: 0.63,
    desc: new Float32Array(1024),
    shape: { norm: 1.4, ageBin: 37, ageMass: 0.04, ageEnt: 3.9 },
  };
}

// A real face the same path must keep covering: a woman read as a woman,
// full descriptor signal, so the guard must not touch her.
function realWoman() {
  return {
    gender: 'female',
    score: 0.88,
    age: 27,
    childP: 0.0,
    raw: 0.06,
    desc: new Float32Array(1024),
    shape: { norm: 11.2, ageBin: 26, ageMass: 0.11, ageEnt: 3.1 },
  };
}

test('imageRead carries the two numbers the null guard reads', () => {
  const r = imageRead(junkRead());
  assert.equal(r.raw, 0.63);
  assert.ok(r.shape && r.shape.norm === 1.4, 'shape.norm must survive the boundary');
});

test('imageRead still drops the 1024-float descriptor', () => {
  const r = imageRead(junkRead());
  assert.equal(r.desc, undefined, 'the descriptor is image-path dead weight');
});

test('imageRead keeps the fields the verdict already used', () => {
  const r = imageRead(junkRead());
  assert.equal(r.gender, 'male');
  assert.equal(r.score, 0.26);
  assert.equal(r.age, 36.9);
  assert.equal(r.childP, 0.01);
});

// THE END-TO-END ONE. This is the assertion that was red before the fix:
// the guard refuses the junk read when it is handed a read that crossed
// the worker boundary, not only one that never left the page.
test('a no-signal read does not mint an image patch after the boundary', () => {
  const junk = junkRead();
  assert.deepEqual(
    flaggedFaceIndices('man', [junk]),
    [],
    'in-page: the guard has always refused this'
  );
  assert.deepEqual(
    flaggedFaceIndices('man', [imageRead(junk)]),
    [],
    'worker: it must refuse it here too'
  );
});

test('a real opposite-gender face is still flagged across the boundary', () => {
  assert.deepEqual(flaggedFaceIndices('man', [imageRead(realWoman())]), [0]);
});

// Both halves of the guard are load bearing, so prove each one alone
// would have been enough to kill it -- that is what made this invisible.
test('dropping raw alone silently disables the guard', () => {
  const noRaw = imageRead(junkRead());
  delete noRaw.raw;
  assert.deepEqual(flaggedFaceIndices('man', [noRaw]), [0], 'isNullRead trusts a read it cannot test');
});

test('dropping shape alone silently disables the guard', () => {
  const noShape = imageRead(junkRead());
  delete noShape.shape;
  assert.deepEqual(flaggedFaceIndices('man', [noShape]), [0], 'a missing norm never refuses');
});

// AND THE COPY MUST NOT COME BACK. This repo's standing rule is that a
// rule with two implementations drifts silently (crop-geometry lived four
// days wrong across three model swaps); worker-entry must CALL the shared
// trimmer rather than re-inline an object literal.
test('worker-entry trims image reads through the shared imageRead', () => {
  const worker = fs.readFileSync(new URL('../src/worker-entry.js', import.meta.url), 'utf8');
  assert.ok(/imageRead/.test(worker), 'worker-entry must import and call imageRead');
  assert.ok(
    !/reads:\s*reads\.map\(function\s*\(r\)\s*\{\s*return\s*\{\s*gender:/.test(worker),
    'the hand-written read literal must be gone, not merely joined'
  );
});

// -- THE REPORTING HALF ------------------------------------------------
//
// `faces` minus `flagged` cannot say whether the new guard fired: a
// same-gender CLEAR subtracts there too. `nr` is the only number that
// separates them, and without it his Share cannot answer "did 1104 do
// anything on my phone".

test('the guard predicate has ONE implementation and both callers agree', () => {
  const junk = imageRead(junkRead());
  assert.equal(refusedByNullGuard(junk), true);
  assert.equal(countRefusedByNullGuard([junk, imageRead(realWoman()), junk]), 2);
  // and the decision it drives matches the count, on the same input
  assert.deepEqual(flaggedFaceIndices('man', [junk]), []);
});

test('the guard refuses nothing it was never handed', () => {
  assert.equal(refusedByNullGuard(null), false);
  assert.equal(countRefusedByNullGuard(null), 0);
  assert.equal(countRefusedByNullGuard([]), 0);
});

test('a child carrying no signal is NOT refused -- adult first', () => {
  const kid = imageRead(junkRead());
  kid.childP = 0.9;
  assert.equal(refusedByNullGuard(kid), false, 'loop-37b: refusing her patch is the exposure that got reverted');
  assert.deepEqual(flaggedFaceIndices('man', [kid]), [0], 'she stays covered');
});

test('imgDiagRead stamps the number the guard decided on', () => {
  const row = imgDiagRead(junkRead(), { x1: 0.1, x2: 0.3, confidence: 0.63 }, 640);
  assert.equal(row.n, 1.4, 'nm is what says graphic vs person');
  assert.equal(row.g, 'male');
  assert.equal(row.s, 0.26);
  assert.equal(row.k, 0.63);
  assert.equal(row.p, 128);
});

test('imgDiagRead reports absent rather than guessing', () => {
  const row = imgDiagRead({ gender: 'unknown', score: 0 }, null, 0);
  assert.equal(row.n, null);
  assert.equal(row.k, null);
  assert.equal(row.p, null);
  assert.equal(row.a, null);
});

// The two image paths built this row from two hand-written literals, and
// a field added to fix one left the other reporting the old shape -- so a
// probe reads a difference between populations that is really a
// difference between literals.
test('both image paths build the diag row through the one mapper', () => {
  const init = fs.readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const calls = init.match(/imgDiagRead\(/g) || [];
  assert.equal(calls.length, 2, 'worker path and in-page path, no third and no copy');
  assert.ok(!/\bg:\s*r\.gender,/.test(init), 'the hand-written read literal must be gone from init-entry');
  const nr = init.match(/nr:\s*countRefusedByNullGuard\(/g) || [];
  assert.equal(nr.length, 2, 'both paths must report what the guard refused');
});

// -- THE TWO FLOORS ARE INDEPENDENT ------------------------------------
//
// They shared one number, which meant handing back the thumbnail trade
// also gave up the video path's guard. They are not the same trade: the
// video floor refuses a BIRTH, so a face inside an already-admitted
// person box stays covered, while a thumbnail with one mark on it goes
// to zero marks and the picture is sharp. Finding 52 measured 16 of 370
// thumbnails going fully uncovered, so the image half needs its own
// revert.
test('the image floor moves without touching the video floor', () => {
  const before = gv.NULL_MINT_NM_FLOOR;
  applyTuning({ GENDER_IMAGE_NM_FLOOR: 0 });
  assert.equal(gv.GENDER_IMAGE_NM_FLOOR, 0);
  assert.equal(gv.NULL_MINT_NM_FLOOR, before, 'the video path must not move with it');
  // ...and at 0 the thumbnail guard refuses nothing, which is the revert.
  assert.deepEqual(flaggedFaceIndices('man', [imageRead(junkRead())]), [0]);
  applyTuning({ GENDER_IMAGE_NM_FLOOR: 5 });
  assert.deepEqual(flaggedFaceIndices('man', [imageRead(junkRead())]), []);
});

test('the image floor is clamped like every other dial', () => {
  applyTuning({ GENDER_IMAGE_NM_FLOOR: 99 });
  assert.ok(gv.GENDER_IMAGE_NM_FLOOR <= 6, 'over-range is pulled to the edge, not accepted');
  applyTuning({ GENDER_IMAGE_NM_FLOOR: -4 });
  assert.ok(gv.GENDER_IMAGE_NM_FLOOR >= 0);
  applyTuning({ GENDER_IMAGE_NM_FLOOR: 5 });
});
