// Gender-stage verdict logic (handoff decision #3): opposite gender
// filtered by default; low-confidence/unknown stays covered (blur-first
// fail-safe); no declared user gender = v1 behavior (any face covers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  faceVerdict,
  flaggedFaceIndices,
  faceMeta,
  GENDER_MIN_SCORE,
  GENDER_CLEAR_SCORE,
  GENDER_ADULT_AGE,
} from '../src/gender-verdict.mjs';

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

test('faceMeta: the CLEAR direction pays the high bar (asymmetric certainty)', () => {
  // A same-gender read below GENDER_CLEAR_SCORE must NOT count as a
  // confident clear (owner frame 2026-08-24: a misread child cleared at
  // the old shared 0.25 bar) — it stays covered, uncertain.
  const m = faceMeta('man', [male(GENDER_CLEAR_SCORE - 0.05), male(GENDER_CLEAR_SCORE)]);
  assert.deepEqual(m[0], { flagged: true, certain: false });
  assert.deepEqual(m[1], { flagged: false, certain: true });
  // The flag direction keeps the LOW bar: a 0.3-certain opposite read
  // still flags with certainty (fail-safe stays cheap).
  const f = faceMeta('man', [female(0.3)]);
  assert.deepEqual(f[0], { flagged: true, certain: true });
});

test('faceMeta: child faces never clear — gender untrusted below GENDER_ADULT_AGE', () => {
  const kid = { gender: 'male', score: 0.95, age: GENDER_ADULT_AGE - 6 };
  const adult = { gender: 'male', score: 0.95, age: GENDER_ADULT_AGE + 10 };
  const m = faceMeta('man', [kid, adult]);
  assert.deepEqual(m[0], { flagged: true, certain: false }); // unknown => covered
  assert.deepEqual(m[1], { flagged: false, certain: true });
  // Child opposite-gender read is also uncertain (still flagged, but it
  // may not override a track's history as a POSITIVE reading).
  const k2 = faceMeta('woman', [{ gender: 'male', score: 0.95, age: 10 }]);
  assert.deepEqual(k2[0], { flagged: true, certain: false });
});

test('faceMeta: unset user gender flags everything as uncertain', () => {
  const m = faceMeta('unset', [male(0.9)]);
  assert.deepEqual(m[0], { flagged: true, certain: false });
});

test('clear bar is per-gender: faceres is ~0.4 less certain about women', () => {
  // Gauntlet R6, runs/r6-woman, one static 3-person panel, same lighting,
  // faces all 8-11% of frame height:
  //   male reads   (19): 0.87-0.97, median 0.94
  //   female reads  (5): 0.22-0.67, median 0.54
  // Direction was correct every time; only certainty differs. A single
  // 0.6 bar therefore cleared men instantly and left the woman covered
  // for ~6s in woman mode - FALSE COVER of the exact person the setting
  // exists to leave alone.
  const typicalWoman = [{ gender: 'female', score: 0.54, age: 47 }];
  assert.equal(
    faceMeta('woman', typicalWoman)[0].certain,
    true,
    'a typical female read must clear for a woman user'
  );

  // The same score from a MALE read must still NOT clear a man: the male
  // distribution sits at 0.87+, so 0.54 is genuinely anomalous there.
  const weakMan = [{ gender: 'male', score: 0.54, age: 47 }];
  assert.equal(
    faceMeta('man', weakMan)[0].certain,
    false,
    'the male clear bar must not be lowered by this change'
  );

  // Symmetry gate: a confident man is still COVERED in woman mode.
  const confidentMan = [{ gender: 'male', score: 0.94, age: 62 }];
  const inWomanMode = faceMeta('woman', confidentMan)[0];
  assert.equal(inWomanMode.flagged, true, 'a man must stay covered in woman mode');

  // ...and a woman below even the lowered bar stays covered.
  const unsureWoman = [{ gender: 'female', score: 0.22, age: 40 }];
  assert.equal(faceMeta('woman', unsureWoman)[0].certain, false);
});
