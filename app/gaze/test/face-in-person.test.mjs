// THE RULE THAT DECIDES WHICH EXTENT SOURCE A FACE GETS, and it had no
// test at all while it lived in a closure in init-entry.
//
// Phase-g G1: `bench/extent-reach.mjs` re-implemented it -- unpadded,
// and with no one-face-per-person rule -- and reported that 16.8% of
// corpus faces fall through to `personFromFace`. Through the shipped
// rule it is 27.5%, half again as large, and that figure bounds every
// EXTENT claim findings 20 and 21 make. A number that load-bearing may
// not rest on a rule with no test.
//
// Both properties below are the reason the private version was wrong,
// and they pull in opposite directions: the pad ADMITS faces a bare box
// misses, and `claimed` sends every SECOND face in one box away anyway.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  faceInsideIndex,
  faceOrderBySize,
  synthFaceIndices,
} from '../src/person-gate.mjs';

const face = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const person = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });

test('the person box is padded 10% per axis, and that is load-bearing', () => {
  // MoveNet draws its box round the KEYPOINTS, so a head leaning past
  // the shoulder line sits slightly OUTSIDE the person it plainly
  // belongs to. Built from the pad rather than from a magic number, so
  // it moves if the constant does.
  const p = person(0.40, 0.20, 0.60, 0.80);
  const padW = (p.x2 - p.x1) * 0.1;
  // Centre just outside the raw box, inside the pad.
  const lean = 0.5 * padW;
  const f = face(p.x2 + lean - 0.01, 0.30, p.x2 + lean + 0.01, 0.34);
  assert.equal(faceInsideIndex(f, [p]), 0, 'inside the pad is inside');

  // And past the pad it is not, or the pad would be an unbounded reach.
  const far = face(p.x2 + padW * 3, 0.30, p.x2 + padW * 3 + 0.02, 0.34);
  assert.equal(faceInsideIndex(far, [p]), -1);
});

test('the INDEX is returned, not a boolean', () => {
  // One box can contain several people's faces and only one of them is
  // that person -- the `claimed` rule below needs to know WHICH.
  const a = person(0.00, 0.00, 0.20, 1.00);
  const b = person(0.60, 0.00, 0.80, 1.00);
  assert.equal(faceInsideIndex(face(0.68, 0.1, 0.72, 0.2), [a, b]), 1);
  assert.equal(faceInsideIndex(face(0.08, 0.1, 0.12, 0.2), [a, b]), 0);
  assert.equal(faceInsideIndex(face(0.40, 0.1, 0.44, 0.2), [a, b]), -1);
});

test('largest face first', () => {
  const faces = [face(0, 0, 0.02, 0.02), face(0, 0, 0.20, 0.20), face(0, 0, 0.10, 0.10)];
  assert.deepEqual(faceOrderBySize(faces), [1, 2, 0]);
});

test('ONE box to ONE face -- the second face inside it falls through', () => {
  // This is the half the bench's private version had no notion of, and
  // it is why 194 became 317. Two faces, one person box: the larger
  // claims the measured body and the smaller gets a synthetic one.
  const p = person(0.20, 0.00, 0.80, 1.00);
  const big = face(0.30, 0.10, 0.46, 0.26);
  const small = face(0.60, 0.10, 0.68, 0.18);
  assert.equal(faceInsideIndex(big, [p]), 0, 'precondition: both are inside');
  assert.equal(faceInsideIndex(small, [p]), 0, 'precondition: both are inside');

  const synth = synthFaceIndices([big, small], [p]);
  assert.deepEqual(synth, [1], 'the SMALLER face falls through, the larger claims');

  // Swap the sizes and the other one falls through -- it is size, not
  // array order.
  const synth2 = synthFaceIndices([small, big], [p]);
  assert.deepEqual(synth2, [0], 'still the smaller, whatever the input order');
});

test('two boxes, two faces: neither falls through', () => {
  const a = person(0.00, 0.00, 0.30, 1.00);
  const b = person(0.60, 0.00, 0.90, 1.00);
  const fa = face(0.10, 0.10, 0.20, 0.20);
  const fb = face(0.70, 0.10, 0.78, 0.18);
  assert.deepEqual(synthFaceIndices([fa, fb], [a, b]), []);
});

test('no admitted persons at all: every face is synthetic', () => {
  // His phone's regime (findings 36: twelve slots n:0), and the one the
  // whole corpus arm models.
  const faces = [face(0.1, 0.1, 0.2, 0.2), face(0.5, 0.1, 0.6, 0.2)];
  assert.deepEqual(synthFaceIndices(faces, []), [0, 1]);
});

test('the app and the bench read ONE copy of this rule', () => {
  // The defect class G1 belongs to is a second copy drifting from the
  // first. `init-entry` imports both halves; a copy reintroduced there
  // fails this.
  //
  // H6 (phase-h critic): the two `doesNotMatch` checks below used to
  // name an exact syntax shape -- `function faceInsideIndex (` and
  // `order.sort(function` -- so a re-derivation written as an arrow
  // function under a suffixed name (`faceInsideIndex2`, an unpadded
  // copy, plus `order.sort((a, b) => ...)`) passed both, imports and
  // all, exactly as the appendix `onecopy.mjs` demonstrated. Neither
  // check may name a keyword or a function-vs-arrow shape again:
  //   - any IDENTIFIER that starts with one of these three names but is
  //     not the exact imported name (`faceInsideIndex2`,
  //     `faceOrderBySizeV2`, ...) is refused outright, whatever it is
  //     bound to;
  //   - `order` is exactly and only the array `faceOrderBySize` already
  //     returns (line ~3697) -- it is sorted once, by the import, so
  //     `order.sort(` calling anything back onto it, arrow or
  //     `function`, can only be a second, competing ordering rule.
  // KNOWN LIMIT, not fixed: a re-derivation under a wholly unrelated
  // name (matching neither pattern) still passes. Closing that needs
  // behavioural comparison against the real functions, not source text,
  // and is out of scope for this pass -- recorded in the ledger as OPEN.
  const page = new URL('../src/init-entry.js', import.meta.url);
  const src = readFileSync(page, 'utf8');
  assert.match(src, /faceOrderBySize,/, 'imported, not re-derived');
  assert.match(src, /faceInsideIndex,/);
  assert.doesNotMatch(src, /\bfaceInsideIndex\w+/,
    'a suffixed variant (faceInsideIndex2, ...) is a re-definition');
  assert.doesNotMatch(src, /\bfaceOrderBySize\w+/,
    'a suffixed variant is a re-definition');
  assert.doesNotMatch(src, /\bsynthFaceIndices\w+/,
    'a suffixed variant is a re-definition');
  assert.doesNotMatch(src, /\border\.sort\(/,
    'the size ordering is faceOrderBySize -- `order` is already sorted '
    + 'once, so sorting it again, arrow or `function`, is a second rule');
});
