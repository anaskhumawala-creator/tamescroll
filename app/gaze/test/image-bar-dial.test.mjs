// THE THUMBNAIL BAR IS A DIAL NOW (1106), AND THE STILL-SCENE CLOCK IS
// A DIAL AT ALL.
//
// Both went in because a review found something that could not be turned
// without a build:
//
//   GENDER_IMAGE_MIN_SCORE -- finding 55. The image rule is INVERTED
//   relative to the video one: flaggedFaceIndices marks unless a read is
//   CONFIDENTLY his gender, so a weak read IS a patch, where on video a
//   weak read is evidence toward a clear. On 1,249 hand-labelled MAN
//   reads through the shipped rule, 80.3% of wrong blurs are a WEAK MALE
//   read and only 2.2% actually read female. It had no setter, no
//   whitelist entry and no gear label.
//
//   STATIC_VERDICT_MS -- scene-gate has classified every tick as
//   cut/static/motion since blur-v2 and `static` only ever reached the
//   POSITION clock, so a locked-off shot ran crop+gender at full rate.
//
// EACH ASSERTION HERE WAS RED-PROVED against the pre-1106 source: the
// bar tests fail with `Cannot find module`/no setter, and the clamp
// tests fail with the key refused by the whitelist.
import test from 'node:test';
import assert from 'node:assert';

import {
  flaggedFaceIndices, setImageMinScore, GENDER_IMAGE_MIN_SCORE,
} from '../src/gender-verdict.mjs';
import * as cadence from '../src/cadence.mjs';
import * as sceneGate from '../src/scene-gate.mjs';
import { applyTuning } from '../src/tuning.mjs';

const SHIPPED_BAR = 0.4;

test('the shipped thumbnail bar is unchanged by 1106', () => {
  // The dial was ADDED, not moved. Moving it is an exposure trade and
  // his ruling; shipping it changed would take that ruling away from him
  // under cover of a refactor.
  assert.equal(GENDER_IMAGE_MIN_SCORE, SHIPPED_BAR);
  assert.equal(cadence.STATIC_VERDICT_MS, 0, 'still-scene clock ships inert');
  assert.equal(sceneGate.STATIC_DELTA, 3);
});

test('lowering the thumbnail bar stops marking a weak SAME-gender read', () => {
  // raw 0.65 -> score 0.30. This is the 80.3% case: a man the model
  // called a man, without much confidence, blurred anyway.
  const weakMan = [{ gender: 'male', score: 0.30 }];
  try {
    setImageMinScore(SHIPPED_BAR);
    assert.deepEqual(flaggedFaceIndices('man', weakMan), [0],
      'at the shipped bar he is marked');
    setImageMinScore(0.25);
    assert.deepEqual(flaggedFaceIndices('man', weakMan), [],
      'below the bar he is left alone');
  } finally {
    setImageMinScore(SHIPPED_BAR);
  }
});

test('the bar never rescues an OPPOSITE-gender read, at any setting', () => {
  // The dial trades how sure the app must be, not WHO it covers. If a
  // low bar started clearing women the trade would be a different and
  // much worse one than the one that was measured.
  try {
    for (const bar of [0.25, 0.4, 0.6]) {
      setImageMinScore(bar);
      assert.deepEqual(flaggedFaceIndices('man', [{ gender: 'female', score: 0.99 }]), [0],
        `bar ${bar} must still cover a confident opposite read`);
      assert.deepEqual(flaggedFaceIndices('man', [{ gender: 'female', score: 0.05 }]), [0],
        `bar ${bar} must still cover a weak opposite read`);
    }
  } finally {
    setImageMinScore(SHIPPED_BAR);
  }
});

test('all three new dials travel over OTA and are clamped', () => {
  // A constant changed in source and not reachable from rules/tuning.json
  // silently reverts on every device the moment an OTA lands -- which is
  // the whole reason these are dials and not new numbers.
  try {
    applyTuning({
      GENDER_IMAGE_MIN_SCORE: 0.35,
      STATIC_VERDICT_MS: 3000,
      STATIC_DELTA: 5,
    });
    assert.equal(GENDER_IMAGE_MIN_SCORE, 0.35);
    assert.equal(cadence.STATIC_VERDICT_MS, 3000);
    assert.equal(sceneGate.STATIC_DELTA, 5);

    // Out of range is pulled to the nearest edge, never refused outright
    // and never applied raw.
    applyTuning({ GENDER_IMAGE_MIN_SCORE: 0.01, STATIC_VERDICT_MS: 99999, STATIC_DELTA: 40 });
    assert.equal(GENDER_IMAGE_MIN_SCORE, 0.25, 'floor');
    assert.equal(cadence.STATIC_VERDICT_MS, 4000, 'ceiling');
    assert.equal(sceneGate.STATIC_DELTA, 6,
      'STATIC_DELTA stops at 6: p50 on his own ring is 6.8, so a higher '
      + 'threshold would call half of ordinary camera motion still');
  } finally {
    applyTuning({
      GENDER_IMAGE_MIN_SCORE: SHIPPED_BAR, STATIC_VERDICT_MS: 0, STATIC_DELTA: 3,
    });
  }
});

test('STATIC_VERDICT_MS is allowed ABOVE the moving-scene cap', () => {
  // Deliberate, and the reason the dial is not simply folded into
  // VERDICT_MAX_INTERVAL_MS: that cap bounds how long a MOVING scene may
  // go unread. A still scene with nothing covered is the case it was
  // never about, so the ceiling here is the range's, not the cap's.
  try {
    applyTuning({ STATIC_VERDICT_MS: 4000 });
    assert.ok(cadence.STATIC_VERDICT_MS > cadence.VERDICT_MAX_INTERVAL_MS,
      'a still scene may relax past the moving-scene cap');
  } finally {
    applyTuning({ STATIC_VERDICT_MS: 0 });
  }
});
