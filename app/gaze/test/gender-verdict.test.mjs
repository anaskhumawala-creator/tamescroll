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
  GENDER_IMAGE_MIN_SCORE,
  GENDER_CLEAR_SCORE,
  GENDER_CLEAR_SCORE_FEMALE,
  GENDER_ADULT_AGE,
} from '../src/gender-verdict.mjs';
import * as gv from '../src/gender-verdict.mjs';

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
  assert.equal(faceVerdict('man', [male(GENDER_IMAGE_MIN_SCORE - 0.01)]), 'flag');
  assert.equal(faceVerdict('man', [male(GENDER_IMAGE_MIN_SCORE)]), 'clear');
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
  // 0.9 is exactly GENDER_INSTANT_CLEAR, so the same-gender read also
  // carries `instant` - one read this confident clears without waiting
  // for CLEAR_STREAK_N. `instant` is never set on the flag side.
  assert.deepEqual(m[0], { flagged: false, certain: true, instant: true, weak: true });
  assert.deepEqual(m[1], { flagged: true, certain: true });
  // 0.1 is below GENDER_MIN_SCORE, so it is not even weak evidence.
  assert.deepEqual(m[2], { flagged: true, certain: false, instant: false, weak: false });
});

test('faceMeta: the CLEAR direction pays the high bar (asymmetric certainty)', () => {
  // A same-gender read below GENDER_CLEAR_SCORE must NOT count as a
  // confident clear (owner frame 2026-08-24: a misread child cleared at
  // the old shared 0.25 bar) — it stays covered, uncertain.
  const m = faceMeta('man', [male(GENDER_CLEAR_SCORE - 0.05), male(GENDER_CLEAR_SCORE)]);
  // ...but it IS weak same-direction evidence: S6 accumulates it.
  assert.deepEqual(m[0], { flagged: true, certain: false, instant: false, weak: true });
  // At the clear bar but well below the instant bar: certain, not instant.
  assert.deepEqual(m[1], { flagged: false, certain: true, instant: false, weak: true });
  // The flag direction keeps the LOW bar: a 0.3-certain opposite read
  // still flags with certainty (fail-safe stays cheap).
  const f = faceMeta('man', [female(0.3)]);
  assert.deepEqual(f[0], { flagged: true, certain: true });
});

test('faceMeta: child faces never clear — gender untrusted below GENDER_ADULT_AGE', () => {
  const kid = { gender: 'male', score: 0.95, age: GENDER_ADULT_AGE - 6 };
  const adult = { gender: 'male', score: 0.95, age: GENDER_ADULT_AGE + 10 };
  const m = faceMeta('man', [kid, adult]);
  // The child gate outranks the instant bar: 0.95 is far above
  // GENDER_INSTANT_CLEAR and the child still never clears. R18 also makes
  // it an ABSTENTION, so it cannot buy CLEARED_TTL_MS of absorption on a
  // track that was cleared on somebody else.
  assert.deepEqual(m[0], { flagged: true, certain: false, abstained: true, childAbstain: true });
  assert.deepEqual(m[1], { flagged: false, certain: true, instant: true, weak: true });
  // Child opposite-gender read: same treatment. It is still flagged, and
  // it may not act as a POSITIVE reading in either direction.
  const k2 = faceMeta('woman', [{ gender: 'male', score: 0.95, age: 10 }]);
  assert.deepEqual(k2[0], { flagged: true, certain: false, abstained: true, childAbstain: true });
});

test('faceMeta: child MASS gates the read even when the mean says adult', () => {
  // The R18 measurement: an eight-year-old whose 100-bin age posterior
  // splits between a young mode and faceres' adult prior reads `age 22`
  // at gender certainty 0.81 — two such reads in a row are exactly
  // CLEAR_STREAK_N and would render him sharp in man mode.
  const boy = { gender: 'male', score: 0.81, age: 22, childP: 0.49 };
  assert.deepEqual(faceMeta('man', [boy])[0], {
    flagged: true,
    certain: false,
    abstained: true,
    // A child abstention is NAMED, because person-track's clear grace
    // forgives an unreadable adult and must never forgive her.
    childAbstain: true,
  });
  // The teacher in the same footage: worst childP observed over 23 reads
  // was 0.18, and she must still be able to clear.
  const woman = { gender: 'female', score: 0.95, age: 33, childP: 0.18 };
  const w = faceMeta('woman', [woman])[0];
  assert.equal(w.flagged, false);
  assert.equal(w.certain, true);
});

test('faceMeta: a read with no childP falls back to the mean, unchanged', () => {
  // Older callers and the image path do not carry childP. They must
  // behave exactly as they did before the mass gate existed.
  const adult = { gender: 'female', score: 0.95, age: 33 };
  assert.equal(faceMeta('woman', [adult])[0].flagged, false);
  const kid = { gender: 'female', score: 0.95, age: 9 };
  assert.deepEqual(faceMeta('woman', [kid])[0], {
    flagged: true,
    certain: false,
    abstained: true,
    childAbstain: true,
  });
});

test('flaggedFaceIndices: the child mass gate applies on the image path too', () => {
  // Same defect, same fix, both call sites — the image path reads age
  // through the same helper.
  const boy = { gender: 'male', score: 0.9, age: 22, childP: 0.49 };
  assert.deepEqual(flaggedFaceIndices('man', [boy]), [0]);
  const man = { gender: 'male', score: 0.9, age: 22, childP: 0.1 };
  assert.deepEqual(flaggedFaceIndices('man', [man]), []);
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

  // THE GAP, NOT A FIXED SCORE. This half used to assert that a MALE
  // read at 0.54 does not clear a man, on the reasoning that "the male
  // distribution sits at 0.87+, so 0.54 is anomalous". That was measured
  // at NATIVE resolution on a 3-person panel. His player decodes 640x360
  // and faces reach faceres at px p50 38-62, where men read p50 0.786
  // over a wide spread -- 0.54 is ordinary there, not anomalous, and
  // both bars moved down on 2026-09-01 because of it.
  //
  // So the test is built FROM the constants and pins the PROPERTY that
  // survived the re-measurement: clearing a man takes more certainty
  // than clearing a woman. A fixed number here would have to be edited
  // every time the bars move, which is how an assertion silently stops
  // testing anything.
  const between = (GENDER_CLEAR_SCORE + GENDER_CLEAR_SCORE_FEMALE) / 2;
  assert.ok(GENDER_CLEAR_SCORE > GENDER_CLEAR_SCORE_FEMALE,
    'the male bar must stay above the female bar');
  assert.equal(
    faceMeta('woman', [{ gender: 'female', score: between, age: 47 }])[0].certain,
    true,
    'a score between the two bars must clear a woman'
  );
  assert.equal(
    faceMeta('man', [{ gender: 'male', score: between, age: 47 }])[0].certain,
    false,
    'the same score must NOT clear a man -- the two bars are not one bar'
  );

  // Symmetry gate: a confident man is still COVERED in woman mode.
  const confidentMan = [{ gender: 'male', score: 0.94, age: 62 }];
  const inWomanMode = faceMeta('woman', confidentMan)[0];
  assert.equal(inWomanMode.flagged, true, 'a man must stay covered in woman mode');

  // ...and a woman below even the lowered bar stays covered. Derived
  // from the constant for the same reason as above.
  const unsureWoman = [{ gender: 'female', score: GENDER_CLEAR_SCORE_FEMALE - 0.01, age: 40 }];
  assert.equal(faceMeta('woman', unsureWoman)[0].certain, false);
});

test('R12: the faceres null output is refused instead of believed', () => {
  // Measured constants, two independent videos. The null is a CONSTANT:
  // raw sigmoid 0.623-0.652 with the age head simultaneously returning
  // its training mean (36-37). Folded, that is score 0.25-0.30 -- above
  // GENDER_MIN_SCORE 0.25 -- so in woman mode every one of these was a
  // CERTAIN opposite-gender flag built on zero information.
  const nulls = [
    { gender: 'male', score: 0.25, age: 36, raw: 0.623 },
    { gender: 'male', score: 0.25, age: 36, raw: 0.627 },
    { gender: 'male', score: 0.28, age: 37, raw: 0.641 },
    { gender: 'male', score: 0.3, age: 36, raw: 0.652 },
  ];
  for (const n of nulls) {
    assert.equal(gv.isNullRead(n), true, `should be refused: raw ${n.raw}`);
    const [m] = gv.faceMeta('woman', [n]);
    // Covered (blur-first is untouched) but NOT certain, so it can no
    // longer condemn, or poison identity memory. `abstained` is what lets
    // person-track still revoke a clear in 2 reads rather than 5 seconds.
    // `nullRead` is the SEPARATE half: this read may keep a patch alive
    // and may never create one (person-track refuses the birth). It is
    // conditioned on the DESCRIPTOR too, so a fixture carrying no shape
    // fails OPEN -- it mints, exactly as it did before the gate existed.
    assert.deepEqual(m, { flagged: true, certain: false, abstained: true, nullRead: false });
    const [lo] = gv.faceMeta('woman', [{ ...n, shape: { norm: 2.9 } }]);
    assert.equal(lo.nullRead, true, 'no descriptor signal: refuse the birth');
    const [hi] = gv.faceMeta('woman', [{ ...n, shape: { norm: 12.6 } }]);
    assert.equal(hi.nullRead, false, 'real descriptor signal: this is a person, cover them');
    assert.equal(hi.abstained, true, 'exempting the birth must not make it evidence');
  }
});

test('the mint refusal needs BOTH the band and a dead descriptor', () => {
  // The exposure a critic found in the first version, from this repo's
  // own ground-truth arm: a woman whose reference read at px 206 is
  // female lands in the band at 32px and again at 48px -- the modal face
  // size in his player. On the sigmoid alone her birth is refused and
  // she goes sharp. `nm` is the axis that is not a function of the band.
  const inBand = { gender: 'male', score: 0.24, raw: 0.62, age: 38, childP: 0.15 };
  assert.equal(gv.isNullRead(inBand), true);
  // The floor is 5. RETRACTED: the five reads floor 6 refuses are ONE
  // MAN (RcGyVTAoXEU, ref male 231px, nm 5.11-5.85), not the woman --
  // she reads nm 9.93 and 11.48 and is untouched until floor 10. 5.11 is
  // HIS lowest measured nm, and it is pinned here so the constant cannot
  // walk back up without this test moving with it.
  //
  // The tag no longer refuses a birth (person-track.mjs), so this pins
  // what the COUNTERS see, not what the tracker does.
  for (const [norm, refused] of [[0, true], [4.9, true], [5, false], [5.11, false], [12.4, false]]) {
    assert.equal(
      gv.faceMeta('man', [{ ...inBand, shape: { norm } }])[0].nullRead, refused,
      'norm ' + norm
    );
  }
  // A dead descriptor OUTSIDE the band is not refused either -- the gate
  // is an AND, and a directed read is evidence whatever its magnitude.
  const outOfBand = { gender: 'male', score: 0.9, raw: 0.95, age: 30, childP: 0.02, shape: { norm: 1.2 } };
  assert.ok(!gv.faceMeta('man', [outOfBand])[0].nullRead);
  // NaN and Infinity fail open. A NaN reaching the ring also fails the
  // report invariant, so this guards two things at once.
  for (const norm of [NaN, Infinity, undefined, null, 'small']) {
    assert.equal(gv.faceMeta('man', [{ ...inBand, shape: { norm } }])[0].nullRead, false, String(norm));
  }
});

test('a child in the null band keeps her patch', () => {
  // isNullRead ran AHEAD of the child branch, and a null read has its age
  // head pinned at the training prior (~36.9) which is inside
  // NULL_AGE_LO..HI by construction -- so a child carrying no signal was
  // classified as the prior. That was harmless while the branch only set
  // `abstained`; it decides whether she gets a patch at all now.
  const kid = { gender: 'male', score: 0.24, raw: 0.62, age: 38, childP: 0.4, shape: { norm: 1.5 } };
  const [m] = gv.faceMeta('man', [kid]);
  assert.equal(m.abstained, true, 'still covered');
  assert.ok(!m.nullRead, 'a child read may never refuse a birth');
});

test('a CHILD abstention is not a null read, and must never refuse a birth', () => {
  // The two abstentions look identical in every field the tracker reads,
  // and they must NOT be treated the same at the mint. A null read is the
  // model answering with its prior -- no evidence anybody is there. A
  // child read is evidence that somebody IS there whose gender we refuse
  // to trust, and refusing HER birth is the exposure that got the first
  // attempt at this gate reverted whole (loop 37c: tracks 1 -> 0 on the
  // person whose report started the round).
  for (const kid of [
    { gender: 'male', score: 0.95, age: 9 },
    { gender: 'male', score: 0.85, age: 31, childP: 0.3 },
    { gender: 'female', score: 0.6, age: 12 },
  ]) {
    const [m] = faceMeta('man', [kid]);
    assert.equal(m.abstained, true, 'a child read still abstains');
    assert.ok(!m.nullRead, 'a child read must not be tagged as the prior');
  }
});

test('R12: real male reads are NOT refused, in either direction', () => {
  // Every male read measured outside the null band in runs/r12-woman2.
  // The nearest one to the band is v = 0.759 against a null ceiling of
  // 0.652 -- if this test ever fails, the band has grown into real data
  // and must be re-derived, not widened.
  const real = [
    { gender: 'male', score: 0.52, age: 36, raw: 0.759 },
    { gender: 'male', score: 0.6, age: 35, raw: 0.799 },
    { gender: 'male', score: 0.69, age: 34, raw: 0.845 },
    { gender: 'male', score: 0.91, age: 31, raw: 0.954 },
    // Weak but genuinely directed reads, ages outside the null band.
    { gender: 'male', score: 0.32, age: 25, raw: 0.661 },
    { gender: 'male', score: 0.33, age: 32, raw: 0.664 },
  ];
  for (const r of real) {
    assert.equal(gv.isNullRead(r), false, `must not refuse raw ${r.raw} age ${r.age}`);
  }
  // In MAN mode the abstention is inert by construction: a null folds to
  // ~0.27, nowhere near GENDER_CLEAR_SCORE, so it never cleared anyone.
  const [asMan] = gv.faceMeta('man', [{ gender: 'male', score: 0.27, age: 36, raw: 0.635 }]);
  assert.equal(asMan.certain, false);
  assert.equal(asMan.flagged, true);
});

test('R12: a female read is never refused, and reads with no raw value are trusted', () => {
  // The band is male-only -- the null label is `male`. A weak female
  // read must keep its meaning, or woman mode loses the evidence that
  // clears women.
  assert.equal(gv.isNullRead({ gender: 'female', score: 0.14, age: 36, raw: 0.429 }), false);
  // Older callers carry no raw sigmoid. With nothing to test, trust the
  // read rather than inventing a refusal.
  assert.equal(gv.isNullRead({ gender: 'male', score: 0.3, age: 36 }), false);
  assert.equal(gv.isNullRead(null), false);
});

// The abstention is only safe in MAN mode because of an arithmetic accident,
// and an accident nobody has written down is a future regression. A read is
// only refused inside [NULL_V_LO, NULL_V_HI], and confidence folds to
// 2*|v-0.5|, so the most confident read the band can contain is worth
// 2*(NULL_V_HI-0.5). While that stays under the same-gender clear bar, no
// refused read could ever have cleared anyone and abstaining costs nothing.
// Widen the band past that point — or lower the bar — and man mode silently
// starts refusing reads that would have LIFTED blur off the owner.
test('the null band can never contain a read that would have cleared someone', () => {
  const worst = 2 * Math.max(gv.NULL_V_HI - 0.5, 0.5 - gv.NULL_V_LO);
  assert.ok(
    worst < gv.clearScoreFor('male'),
    `widening the null band past 2*|v-0.5| >= clear bar makes abstention unsafe in man mode: ` +
      `band tops out at ${worst.toFixed(3)} against a bar of ${gv.clearScoreFor('male')}`,
  );
});

test('an abstained read is marked so the tracker can tell it from plain uncertain', () => {
  const nul = { gender: 'male', score: 0.28, age: 36, raw: 0.641 };
  const [meta] = gv.faceMeta('woman', [nul]);
  assert.equal(meta.flagged, true);
  assert.equal(meta.certain, false);
  assert.equal(meta.abstained, true, 'person-track keys clear-revocation off this');

  // A real, weak, opposite-gender read must NOT be marked — it is evidence
  // pointing somewhere, and it keeps the powers the null loses.
  const real = { gender: 'male', score: 0.52, age: 36, raw: 0.759 };
  const [m2] = gv.faceMeta('woman', [real]);
  assert.notEqual(m2.abstained, true);
  assert.equal(m2.certain, true);
});

// --- S6: the `weak` flag ---------------------------------------------
test('faceMeta: same-gender read below the clear bar is weak, not nothing', () => {
  const [m] = faceMeta('man', [{ gender: 'male', score: 0.4, age: 30, raw: 0.8 }]);
  assert.equal(m.certain, false); // 0.4 < GENDER_CLEAR_SCORE
  assert.equal(m.flagged, true); // still covered on this read alone
  assert.equal(m.weak, true);
});

test('faceMeta: weak is a SUPERSET of certain, so a certain read cannot reset the streak', () => {
  const [m] = faceMeta('man', [{ gender: 'male', score: 0.95, age: 30, raw: 0.97 }]);
  assert.equal(m.certain, true);
  assert.equal(m.weak, true);
});

test('faceMeta: a read below GENDER_MIN_SCORE is not weak evidence at all', () => {
  const [m] = faceMeta('man', [{ gender: 'male', score: 0.1, age: 30, raw: 0.95 }]);
  assert.equal(m.weak, false);
});

test('faceMeta: opposite-gender and child reads never carry weak', () => {
  const [opp] = faceMeta('man', [{ gender: 'female', score: 0.9, age: 30, raw: 0.05 }]);
  assert.ok(!opp.weak);
  const [kid] = faceMeta('man', [{ gender: 'male', score: 0.9, age: 30, childP: 0.6, raw: 0.95 }]);
  assert.ok(!kid.weak);
  assert.equal(kid.abstained, true);
});

test('faceMeta: a NULL read is abstained and never weak', () => {
  const [n] = faceMeta('man', [{ gender: 'male', score: 0.27, age: 36, raw: 0.635 }]);
  assert.equal(n.abstained, true);
  assert.ok(!n.weak);
});

// --- R23: the instant bar moved 0.9 -> 0.8, derived from a band --------
// The bar is the lowest at which the band's maximum childP (0.08 over
// 18 reads in [0.80,0.90) on rotation entry 5) still sits below the
// MINIMUM childP ever measured on a known 8-year-old (0.15, R18). The
// band below, [0.70,0.75), reaches childP 0.19 and is inside that child
// range, which is why 0.75 was refused. Pinned so a future round cannot
// slide the bar down from the diff alone.
test('R23 instant bar: 0.82 clears on one read, 0.72 still owes the streak', () => {
  const m = faceMeta('man', [
    { gender: 'male', score: 0.82, age: 31, childP: 0.05 },
    { gender: 'male', score: 0.72, age: 31, childP: 0.05 },
  ]);
  assert.equal(m[0].certain, true);
  assert.equal(m[0].instant, true, '0.82 is above the R23 bar');
  assert.equal(m[1].certain, true);
  assert.equal(m[1].instant, false, '0.72 is below it and pays CLEAR_STREAK_N');
});

// The age gate is the OTHER lock and it outranks the certainty bar in
// both directions. Lowering the instant bar must not make a child
// reachable through it: S6 pulled a whole feature for exactly this.
test('R23 instant bar: a child read at 0.85 is still never certain', () => {
  // A child read never reaches the instant BRANCH at all -- it is routed
  // to an abstention upstream (R18), which carries no `instant` field.
  // Asserting the whole object is the point: the guarantee is that this
  // read can never be mistaken for evidence, not merely that one flag on
  // it is false.
  const m = faceMeta('man', [{ gender: 'male', score: 0.85, age: 9, childP: 0.42 }]);
  assert.deepEqual(m[0], { flagged: true, certain: false, abstained: true, childAbstain: true });
  assert.ok(!m[0].instant);
  const byMass = faceMeta('man', [{ gender: 'male', score: 0.85, age: 31, childP: 0.3 }]);
  assert.deepEqual(byMass[0], { flagged: true, certain: false, abstained: true, childAbstain: true });
  assert.ok(!byMass[0].instant, 'childP mass alone blocks it too');
});

// The image bar is its own constant, and after the crop fix it is ABOVE
// the video one: a thumbnail now gets an aspect-correct crop and a
// separable certainty, where the video path's 0.25 is calibrated for a
// tracker that can absorb one bad read. Pinned because the two surfaces
// must not drift back into one constant.
test('the image gender bar is its own constant', () => {
  assert.equal(GENDER_IMAGE_MIN_SCORE, 0.4);
  assert.notEqual(GENDER_IMAGE_MIN_SCORE, GENDER_MIN_SCORE);
});

test('women misread as male on a thumbnail stay covered', () => {
  // Measured 2026-08-28 through the aspect-correct crop: six women read
  // `male` at 0.16-0.28, one of them a yoga thumbnail that was fully
  // sharp under the old 0.12 bar.
  for (const s of [0.16, 0.19, 0.2, 0.25, 0.28]) {
    assert.equal(faceVerdict('man', [{ gender: 'male', score: s, age: 34 }]), 'flag');
  }
  // And the men from the same measurement still clear.
  assert.equal(faceVerdict('man', [{ gender: 'male', score: 0.45, age: 33 }]), 'clear');
  assert.equal(faceVerdict('man', [{ gender: 'male', score: 0.91, age: 23 }]), 'clear');
});

test('the near-coin-flip regime is still refused', () => {
  // The weakest reads were always inversions; below the floor either way.
  assert.equal(faceVerdict('man', [{ gender: 'male', score: 0.04, age: 30 }]), 'flag');
});

// THE THUMBNAIL PATH REFUSES A READ THAT CARRIED NO SIGNAL (2026-09-02).
//
// The video path has done this since 1079; the image path never did, and
// the asymmetry drew patches on nothing. `score` is `2|raw - 0.5|`, so a
// null read at raw ~0.62 folds to ~0.24, fails GENDER_IMAGE_MIN_SCORE
// 0.4, and is FLAGGED -- a patch on a crop the model said nothing about.
//
// These run the LIVE function the image path calls (`init-entry.js:800`),
// not `faceVerdict`, which nothing in src/ calls.
const nullRead = (over) => Object.assign({
  gender: 'male',      // the null label; isNullRead requires it
  raw: 0.62,           // inside [NULL_V_LO, NULL_V_HI]
  age: 37,             // inside [NULL_AGE_LO, NULL_AGE_HI] -- the prior
  childP: 0.10,
  score: 2 * Math.abs(0.62 - 0.5),   // 0.24, under the 0.4 image bar
  shape: { norm: 2.0 },              // no descriptor signal
}, over || {});

test('image path: a null read with no descriptor signal mints no patch', () => {
  const f = nullRead();
  // Precondition, asserted so this can never pass vacuously: without the
  // guard this face is flagged purely by failing the score bar.
  assert.ok(f.score < GENDER_IMAGE_MIN_SCORE, 'precondition: under the bar');
  assert.ok(gv.isNullRead(f), 'precondition: it is a null read');
  assert.deepEqual(flaggedFaceIndices('man', [f]), []);
  // and in the other direction too -- a prior is not evidence either way
  assert.deepEqual(flaggedFaceIndices('woman', [f]), []);
});

test('image path: the nm FLOOR is what does the work, not the band', () => {
  // Same read, but the crop carried real descriptor magnitude. The band
  // alone must not be enough to refuse a patch -- loop 38 measured a real
  // woman landing in the band at 32px and 48px.
  const withSignal = nullRead({ shape: { norm: gv.NULL_MINT_NM_FLOOR } });
  assert.ok(gv.isNullRead(withSignal), 'still in the band');
  assert.deepEqual(flaggedFaceIndices('man', [withSignal]), [0],
    'at or above the floor the read still mints');
  const under = nullRead({ shape: { norm: gv.NULL_MINT_NM_FLOOR - 0.01 } });
  assert.deepEqual(flaggedFaceIndices('man', [under]), []);
});

test('image path: a CHILD carrying no signal still gets her patch', () => {
  // The loop-37b ordering defect, which is why `adult` is tested first:
  // a null read has its age head pinned at the prior (~36.9), INSIDE the
  // null age window by construction, so a child with no signal looks
  // exactly like a null read. Refusing her patch is the exposure that got
  // the first version of the video-side gate reverted whole.
  const child = nullRead({ childP: 0.40 });
  assert.equal(gv.isNullRead(child), true, 'she still matches the band');
  assert.deepEqual(flaggedFaceIndices('man', [child]), [0],
    'a child may never be refused a patch by the null gate');
});

test('image path: a missing nm mints, because absent is not zero', () => {
  // mayNotMint returns false without a finite nm, so an older caller (or
  // a read the shape stage never reached) fails toward COVERING.
  const noShape = nullRead({ shape: undefined });
  assert.deepEqual(flaggedFaceIndices('man', [noShape]), [0]);
});

test('faceVerdict delegates, so it cannot drift from the live rule', () => {
  // It carried a byte-for-byte copy of the predicate and twenty tests
  // while shipping to nobody. Same input, same answer, by construction.
  const f = nullRead();
  assert.equal(faceVerdict('man', [f]),
    flaggedFaceIndices('man', [f]).length ? 'flag' : 'clear');
  const m = { gender: 'male', score: 0.9, age: 30 };
  const w = { gender: 'female', score: 0.9, age: 30 };
  assert.equal(faceVerdict('man', [m, w]),
    flaggedFaceIndices('man', [m, w]).length ? 'flag' : 'clear');
});
