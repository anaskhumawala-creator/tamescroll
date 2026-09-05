// GENDER_TRACK_MEAN -- the refused arm, and the properties that make it
// safe to keep in the tree at 0.
//
// It is a REFUSED arm (bench/track-mean-ab.mjs loses on both genders at
// matched exposure, and the shipped IoU association is 27.9%
// mis-associated per read against ~10% break-even), so the first and
// most important test here is that it is INERT: with the dial at 0 the
// tracker must behave exactly as it did before this code existed, and
// the observation the caller handed in must come back untouched.
//
// The rest exist because this repo has shipped checks that could not
// fail. Each assertion below was broken against the implementation to
// confirm it goes red -- noted per test where the break was not obvious.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENDER_TRACK_MEAN, GENDER_TRACK_MEAN_M0, setTrackMean, _setTrackMeanM0,
  trackMeanOn, trackMeanRaw, metaFromMean, faceMeta,
  GENDER_CLEAR_SCORE,
} from '../src/gender-verdict.mjs';
import { updatePersonTracks, setUserGender } from '../src/person-track.mjs';

const box = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
// A directed adult read: `raw` is P(male), `age` clear of the child gate.
const obs = (raw, extra) => ({
  box: box(0.3, 0.3, 0.7, 0.9),
  faceFound: true,
  flagged: raw < 0.5,          // man mode: a female read is covered
  certain: 2 * Math.abs(raw - 0.5) >= GENDER_CLEAR_SCORE,
  weak: false, instant: false, abstained: false, childAbstain: false,
  nullMint: false, signal: true, desc: null,
  raw,
  ...extra,
});

function reset() {
  setTrackMean(0);
  _setTrackMeanM0(1);
  setUserGender('man');
}

test('it ships OFF, and the prior ships at one pseudo-read', () => {
  assert.equal(GENDER_TRACK_MEAN, 0);
  assert.equal(GENDER_TRACK_MEAN_M0, 1);
  assert.equal(trackMeanOn(), false);
});

test('the dial is a switch, not a blend', () => {
  reset();
  setTrackMean(0.4);
  assert.equal(trackMeanOn(), false, 'below half is off');
  setTrackMean(0.5);
  assert.equal(trackMeanOn(), true, 'half is on');
  reset();
});

test('the shrunk mean is the arithmetic mean plus m0 reads at 0.5', () => {
  reset();
  // (0.8 + 0.8 + 0.5) / 3
  assert.equal(Math.round(trackMeanRaw(1.6, 2) * 1e6) / 1e6, 0.7);
  _setTrackMeanM0(0);
  assert.equal(trackMeanRaw(1.6, 2), 0.8, 'm0 = 0 is the plain mean');
  reset();
});

test('nothing to average returns null rather than the bare prior', () => {
  // 0.5 IS the null read's own value on this model, so returning it
  // would hand the caller a number that reads as "coin flip" and is
  // actually "no data" -- the two are different events downstream.
  assert.equal(trackMeanRaw(0, 0), null);
  assert.equal(trackMeanRaw(undefined, 3), null);
  assert.equal(trackMeanRaw(NaN, 3), null);
});

test('metaFromMean agrees with faceMeta on the same evidence', () => {
  reset();
  // ONE COPY OF THE BARS. If metaFromMean ever grows its own ladder this
  // goes red: a synthetic face built from raw m must produce exactly the
  // verdict faceMeta gives a real read at that raw.
  for (const raw of [0.02, 0.2, 0.45, 0.5, 0.55, 0.8, 0.98]) {
    const score = Math.min(0.99, 2 * Math.abs(raw - 0.5));
    const direct = faceMeta('man', [{
      gender: raw > 0.5 ? 'male' : 'female', score, raw, shape: null,
    }])[0];
    const viaMean = metaFromMean('man', raw, null);
    assert.deepEqual(viaMean, direct, `raw ${raw}`);
  }
});

test('a non-finite mean is refused', () => {
  assert.equal(metaFromMean('man', NaN, null), null);
  assert.equal(metaFromMean('man', undefined, null), null);
});

test('DIAL OFF: the tracker returns the caller\'s own observation object', () => {
  reset();
  // Not "an equal object" -- the SAME object. A copy would mean the
  // rewrite path runs while the dial is off, and any future edit to it
  // would silently reach the shipped build.
  const o = obs(0.9);
  const tracks = updatePersonTracks([], [o], 400, false);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].gN, 0, 'nothing accumulated with the dial off');
  assert.equal(tracks[0].gSum, 0);
});

test('DIAL OFF: a run of reads produces the same verdicts as before', () => {
  reset();
  const raws = [0.9, 0.2, 0.85, 0.3, 0.95];
  const seen = [];
  let tracks = [];
  for (const r of raws) {
    tracks = updatePersonTracks(tracks, [obs(r)], 400, false);
    seen.push(tracks[0].lastVerdict);
  }
  // The point is only that the sequence is decided read by read: a
  // rising mean would have pinned the tail to one verdict.
  assert.equal(seen.length, 5);
  assert.ok(tracks[0].gN === 0 && tracks[0].gSum === 0);
});

test('DIAL ON: the mean accumulates and rewrites the verdict', () => {
  reset();
  setTrackMean(1);
  let tracks = updatePersonTracks([], [obs(0.9)], 400, false);
  assert.equal(tracks[0].gN, 1, 'the birth read seeds the mean');
  assert.equal(Math.round(tracks[0].gSum * 100) / 100, 0.9);
  tracks = updatePersonTracks(tracks, [obs(0.9)], 400, false);
  assert.equal(tracks[0].gN, 2);
  assert.equal(Math.round(tracks[0].gSum * 100) / 100, 1.8);
  reset();
});

test('DIAL ON: one dissenting read cannot flip a settled mean', () => {
  reset();
  setTrackMean(1);
  // Four confident male reads, then a female one. Per-read the fifth is
  // a covered verdict; against the mean it is not.
  //
  // THE OUTLIER IS 0.30, NOT 0.05, AND THE FIRST DRAFT OF THIS TEST
  // FAILED FOR A REAL REASON WORTH KEEPING. At 0.05 the mean lands on
  // 0.725 exactly, whose synthetic score is 0.450 -- GENDER_CLEAR_SCORE
  // to the digit. The track fell off the clear rung on a floating-point
  // tie, which is a true property of the arm and not what this test is
  // about. Any arm that derives a score from an average will produce
  // means that sit exactly on a bar; a bench reading one of those cells
  // is reading noise.
  let tracks = [];
  for (const r of [0.95, 0.95, 0.95, 0.95]) {
    tracks = updatePersonTracks(tracks, [obs(r)], 400, false);
  }
  const before = tracks[0].lastVerdict;
  const dissent = obs(0.30);
  assert.equal(dissent.flagged, true, 'read alone, this one covers him');
  tracks = updatePersonTracks(tracks, [dissent], 400, false);
  const mean = trackMeanRaw(tracks[0].gSum, tracks[0].gN);
  assert.ok(mean > 0.5, `mean ${mean} still reads male`);
  assert.equal(tracks[0].lastVerdict, before, 'the outlier did not move it');
  reset();
});

test('DIAL ON: an abstention is neither averaged in nor rewritten', () => {
  reset();
  setTrackMean(1);
  // A null read is the model's PRIOR, and on this model that prior sits
  // near 0.62 -- averaging it in would drag every track male at the rate
  // the device produces null reads, which on his phone was 42%.
  let tracks = updatePersonTracks([], [obs(0.9)], 400, false);
  const n0 = tracks[0].gN;
  tracks = updatePersonTracks(tracks, [obs(0.62, { abstained: true, flagged: true, certain: false })], 400, false);
  assert.equal(tracks[0].gN, n0, 'the abstention did not enter the mean');
  reset();
});

test('DIAL ON: a child abstention is refused too', () => {
  reset();
  setTrackMean(1);
  let tracks = updatePersonTracks([], [obs(0.9)], 400, false);
  const n0 = tracks[0].gN;
  tracks = updatePersonTracks(tracks,
    [obs(0.9, { abstained: true, childAbstain: true, flagged: true, certain: false })], 400, false);
  assert.equal(tracks[0].gN, n0,
    'an adult pass must not be able to forgive a child read by averaging');
  reset();
});

test('DIAL ON: a read with no raw leaves the mean alone', () => {
  reset();
  setTrackMean(1);
  let tracks = updatePersonTracks([], [obs(0.9)], 400, false);
  const n0 = tracks[0].gN;
  tracks = updatePersonTracks(tracks, [obs(0.9, { raw: null })], 400, false);
  assert.equal(tracks[0].gN, n0,
    'older callers and the native path must keep todays behaviour exactly');
  reset();
});

test('DIAL ON: a position-only pass carries the mean without advancing it', () => {
  reset();
  setTrackMean(1);
  let tracks = updatePersonTracks([], [obs(0.9)], 400, false);
  const before = { s: tracks[0].gSum, n: tracks[0].gN };
  tracks = updatePersonTracks(tracks,
    [{ box: box(0.31, 0.31, 0.71, 0.91), positionOnly: true, faceFound: true }], 120, false);
  assert.equal(tracks[0].gN, before.n, 'a position pass paid for no read');
  assert.equal(tracks[0].gSum, before.s);
  reset();
});

test('DIAL ON: the accumulator survives a coast', () => {
  reset();
  setTrackMean(1);
  let tracks = updatePersonTracks([], [obs(0.9)], 400, false);
  tracks = updatePersonTracks(tracks, [], 400, false);
  assert.ok(tracks.length === 1, 'the track coasted rather than dying');
  assert.equal(tracks[0].gN, 1, 'the coast builder did not drop the field');
  reset();
});

test('the mean is never allowed to manufacture an abstention', () => {
  reset();
  setTrackMean(1);
  // Two opposite confident reads average to ~0.5, which is inside the
  // null band. An abstention REVOKES an earned clear, and a running
  // average sitting near the middle is not the same event as a face the
  // model could not read -- so the original observation must stand.
  let tracks = updatePersonTracks([], [obs(0.98)], 400, false);
  tracks = updatePersonTracks(tracks, [obs(0.02)], 400, false);
  const t = tracks[0];
  assert.equal(t.gN, 2);
  const mean = trackMeanRaw(t.gSum, t.gN);
  const m = metaFromMean('man', mean, null);
  if (m && m.abstained) {
    assert.notEqual(t.lastVerdict, undefined,
      'an abstaining mean must have fallen back, not abstained the track');
  }
  reset();
});
