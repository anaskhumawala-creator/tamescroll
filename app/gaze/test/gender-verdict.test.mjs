// Gender-stage verdict logic (handoff decision #3): opposite gender
// filtered by default; low-confidence/unknown stays covered (blur-first
// fail-safe); no declared user gender = v1 behavior (any face covers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faceVerdict, flaggedFaceIndices, faceMeta, GENDER_MIN_SCORE } from '../src/gender-verdict.mjs';

const male = (s = 0.9) => ({ gender: 'male', score: s });
const female = (s = 0.9) => ({ gender: 'female', score: s });

test('no faces clears regardless of user gender', () => {
  assert.equal(faceVerdict('man', []), 'clear');
  assert.equal(faceVerdict('unset', []), 'clear');
});

test('unset user gender flags any face (v1 presence behavior)', () => {
  assert.equal(faceVerdict('unset', [male()]), 'flag');
  assert.equal(faceVerdict('unset', [female()]), 'flag');
});

test('man: confident male faces clear, any female face flags', () => {
  assert.equal(faceVerdict('man', [male(), male()]), 'clear');
  assert.equal(faceVerdict('man', [male(), female()]), 'flag');
});

test('woman: confident female faces clear, any male face flags', () => {
  assert.equal(faceVerdict('woman', [female()]), 'clear');
  assert.equal(faceVerdict('woman', [female(), male()]), 'flag');
});

test('low-confidence same-gender face stays covered (fail-safe)', () => {
  assert.equal(faceVerdict('man', [male(GENDER_MIN_SCORE - 0.01)]), 'flag');
  assert.equal(faceVerdict('man', [male(GENDER_MIN_SCORE)]), 'clear');
});

test('unknown gender stays covered', () => {
  assert.equal(faceVerdict('man', [{ gender: 'unknown', score: 0 }]), 'flag');
});

test('garbage user gender behaves as unset', () => {
  assert.equal(faceVerdict('banana', [male()]), 'flag');
  assert.equal(faceVerdict(null, [male()]), 'flag');
});

test('threshold pinned at 0.25 (faceres recalibration 2026-08-24)', () => {
  // faceres score = 2*|sigmoid-0.5| certainty; direction was 7/7 correct
  // on the live-thumbnail spike, so the bar is a low certainty floor.
  // Registered in docs/detection-engine.md.
  assert.equal(GENDER_MIN_SCORE, 0.25);
});

test('flaggedFaceIndices: only the failing faces come back', () => {
  const idx = flaggedFaceIndices('man', [
    { gender: 'male', score: 0.95 },   // confident same — clear
    { gender: 'female', score: 0.9 },  // opposite — flag
    { gender: 'male', score: 0.1 },    // low certainty — flag
  ]);
  assert.deepEqual(idx, [1, 2]);
});

test('flaggedFaceIndices: all clear when every face passes', () => {
  assert.deepEqual(flaggedFaceIndices('man', [{ gender: 'male', score: 0.9 }]), []);
});

test('flaggedFaceIndices: unset gender flags every face', () => {
  assert.deepEqual(flaggedFaceIndices('unset', [
    { gender: 'male', score: 0.99 },
    { gender: 'female', score: 0.99 },
  ]), [0, 1]);
});

test('faceMeta: certain same-gender clears, certain opposite flags, low score flags UNCERTAIN', () => {
  const m = faceMeta('man', [male(0.9), female(0.9), male(0.1)]);
  assert.deepEqual(m[0], { flagged: false, certain: true });
  assert.deepEqual(m[1], { flagged: true, certain: true });
  assert.deepEqual(m[2], { flagged: true, certain: false });
});

test('faceMeta: unset user gender flags everything as uncertain', () => {
  const m = faceMeta('unset', [male(0.9)]);
  assert.deepEqual(m[0], { flagged: true, certain: false });
});
