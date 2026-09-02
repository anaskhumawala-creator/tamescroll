// face-decode.mjs is the ONE copy of "raw model outputs -> boxes /
// reads" that the WebGL Worker path (through detector.js) and the
// native TFLite path (native-client.mjs) both call. Tested here without
// a model or a device: synthetic outputs, arithmetic checked directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  faceRowsFromOutputs,
  facesFromRows,
  genderReadsFromOutputs,
  generateAnchors,
  FACE_MIN_CONFIDENCE,
} from '../src/face-decode.mjs';

test('faceRowsFromOutputs decodes a confident anchor to its own centre, with zero regressors', () => {
  // BlazeFace's four raw tensors: scores at 512 and 384 anchors, box+mark
  // regressors (16-wide) at the same two counts. Deliberately handed in
  // an order that does NOT match ascending size, because the decode must
  // sort by length itself -- TFLite output order is signature-key order,
  // not tfjs order (spikes/native/REPORT.md), so nothing here is allowed
  // to assume a fixed input order.
  // Every OTHER logit is -10 (sigmoid ~4.5e-5), well under
  // FACE_MIN_CONFIDENCE -- a logit of 0 sigmoids to 0.5, which would
  // clear the floor on every anchor at once and defeat the point of
  // this test (NMS keeping exactly the one confident row).
  const scores512 = new Float32Array(512).fill(-10);
  const scores384 = new Float32Array(384).fill(-10);
  const boxes512 = new Float32Array(512 * 16); // all-zero regressors
  const boxes384 = new Float32Array(384 * 16);
  // A high logit at anchor index 0 of the 512 (stride-16) scale --
  // sigmoid(10) clears FACE_MIN_CONFIDENCE (0.35) by a wide margin.
  scores512[0] = 10;
  const outputs = [boxes512, scores384, boxes384, scores512];

  const rows = faceRowsFromOutputs(outputs);
  assert.equal(rows.length, 896 * 17, 'the full [896,17] table, always');

  const anchors = generateAnchors(256);
  const [ax, ay] = anchors[0];
  // Row 0 of the table is the 512-scale's first row (stride-16 rows come
  // first, matching generateAnchors' own order) -- with zero w/h
  // regressors the box degenerates to a single point exactly at the
  // anchor, in MODEL-SPACE PIXELS (not yet normalised).
  assert.ok(Math.abs(rows[1] - ax) < 1e-3, 'row 0 x1 sits at the anchor x');
  assert.ok(Math.abs(rows[2] - ay) < 1e-3, 'row 0 y1 sits at the anchor y');
  assert.ok(Math.abs(rows[3] - ax) < 1e-3, 'row 0 x2 (zero width)');
  assert.ok(Math.abs(rows[4] - ay) < 1e-3, 'row 0 y2 (zero height)');
  assert.ok(rows[0] > 0.99, 'row 0 score is sigmoid(10), near 1');

  const kept = facesFromRows(rows);
  assert.equal(kept.length, 1, 'exactly the one confident row survives NMS');
  const cx = (kept[0].x1 + kept[0].x2) / 2;
  const cy = (kept[0].y1 + kept[0].y2) / 2;
  assert.ok(Math.abs(cx - ax / 256) < 1e-3, 'decoded box centre is the anchor, normalised to 0..1');
  assert.ok(Math.abs(cy - ay / 256) < 1e-3);
});

test('a row below FACE_MIN_CONFIDENCE is not kept', () => {
  // Every logit -10 (sigmoid ~4.5e-5): nothing anywhere clears the
  // floor, so nothing survives NMS.
  const scores512 = new Float32Array(512).fill(-10);
  const scores384 = new Float32Array(384).fill(-10);
  const boxes512 = new Float32Array(512 * 16);
  const boxes384 = new Float32Array(384 * 16);
  const rows = faceRowsFromOutputs([scores512, scores384, boxes512, boxes384]);
  assert.ok(rows[0] < FACE_MIN_CONFIDENCE);
  const kept = facesFromRows(rows);
  assert.equal(kept.length, 0);
});

test('gender verdict loop: v=0.9 is a confident male read (score 0.8)', () => {
  const boxes = [{}];
  const gender = new Float32Array([0.9]);
  const age = new Float32Array(100);
  const desc = new Float32Array(1024);
  const reads = genderReadsFromOutputs(gender, age, desc, boxes, true);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].gender, 'male');
  // Float32Array storage: 0.9 is not exactly representable, so the
  // tolerance has to clear float32 epsilon, not float64's.
  assert.ok(Math.abs(reads[0].score - 0.8) < 1e-6);
  assert.ok(Math.abs(reads[0].raw - 0.9) < 1e-6);
});

test('gender verdict loop: v=0.5 (dead centre) reads zero confidence', () => {
  const boxes = [{}];
  const gender = new Float32Array([0.5]);
  const age = new Float32Array(100);
  const desc = new Float32Array(1024);
  const reads = genderReadsFromOutputs(gender, age, desc, boxes, true);
  assert.equal(reads[0].score, 0);
});

test('a read with no gender head reports zero confidence regardless of v', () => {
  const boxes = [{}];
  // Would be a confident male read (score 0.8) if trusted -- hadGenderHead
  // false must still report zero, never a fabricated verdict from a
  // zeros-fallback tensor (review A12, detector.js).
  const gender = new Float32Array([0.9]);
  const age = new Float32Array(100);
  const desc = new Float32Array(1024);
  const reads = genderReadsFromOutputs(gender, age, desc, boxes, false);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].score, 0);
});

test('the age loop reports childP as the mass under 18, not the mean', () => {
  const boxes = [{}];
  const gender = new Float32Array([0.9]);
  const age = new Float32Array(100);
  age[10] = 0.6; // most mass at age 10 (a child bin)
  age[30] = 0.4;
  const desc = new Float32Array(1024);
  const reads = genderReadsFromOutputs(gender, age, desc, boxes, true);
  assert.ok(Math.abs(reads[0].childP - 0.6) < 1e-6);
  assert.ok(Math.abs(reads[0].age - (10 * 0.6 + 30 * 0.4)) < 1e-4);
});

test('the descriptor is L2-normalised and its pre-normalise magnitude survives as shape.norm', () => {
  const boxes = [{}];
  const gender = new Float32Array([0.9]);
  const age = new Float32Array(100);
  const desc = new Float32Array(1024);
  desc[0] = 3;
  desc[1] = 4; // magnitude 5
  const reads = genderReadsFromOutputs(gender, age, desc, boxes, true);
  assert.ok(Math.abs(reads[0].shape.norm - 5) < 1e-6, '3-4-5 triangle, exact in float32');
  // The QUOTIENT (3/5, 4/5) is written back into a Float32Array, which
  // is where the float32 rounding enters -- the tolerance has to clear
  // that, not float64's.
  assert.ok(Math.abs(reads[0].desc[0] - 0.6) < 1e-6); // 3/5
  assert.ok(Math.abs(reads[0].desc[1] - 0.8) < 1e-6); // 4/5
});

test('detector.js delegates to face-decode.mjs rather than carrying a second copy', () => {
  // The class-level guarantee, same shape as crop-geometry.test.mjs's
  // check on squareBox: the anchor decode and the verdict loop each
  // exist exactly once.
  const src = readFileSync(new URL('../src/detector.js', import.meta.url), 'utf8');
  assert.match(src, /from '\.\/face-decode\.mjs'/, 'detector.js imports the shared decode');
  assert.doesNotMatch(src, /function generateAnchors\(/, 'no local anchor generator left behind');
  assert.doesNotMatch(src, /var verdicts = \[\];/, 'no local verdict-loop copy left behind');
});
