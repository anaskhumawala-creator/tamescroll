// Gender-stage verdict logic (handoff decision #3): opposite gender
// filtered by default; low-confidence/unknown stays covered (blur-first
// fail-safe); no declared user gender = v1 behavior (any face covers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faceVerdict, GENDER_MIN_SCORE } from '../src/gender-verdict.mjs';

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
