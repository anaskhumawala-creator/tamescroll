// A NULL READ MAY NOT CREATE A PATCH, AND MUST STILL BE ABLE TO KEEP ONE.
//
// This gate has been built and reverted twice, both times for a real
// exposure, and both times the tests that were supposed to pin it COULD
// NOT HAVE FAILED -- one was a string match on source, the other handed
// its observation straight to updatePersonTracks and so never ran the
// path the defect lived in. These run the real tracker and every one of
// them fails against the pre-fix source.
//
// The two failures being guarded against, in order of severity:
//   1. Dropping the OBSERVATION rather than the BIRTH. coastStep expires
//      a blurred track in ~4s at his cadence, so three refused passes
//      take the blur off a woman who was already covered (loop 37b).
//   2. dedupeObservations LAUNDERING the tag. `preferred` picks by area
//      and never reads it, so a graphic's synthetic body -- usually the
//      larger box -- absorbed a real read and came out untagged
//      (loop 37c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  updatePersonTracks, dedupeObservations, PTRACK_IOU_MIN,
} from '../src/person-track.mjs';
import { faceMeta, isNullRead } from '../src/gender-verdict.mjs';

const box = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
// A face squarely inside the shipped null band, checked against the
// predicate itself rather than against remembered constants -- the band
// has moved twice and both times the figures quoted for it were stale.
// `shape.norm` is load bearing: the refusal is an AND over the band and
// a dead descriptor, so a fixture without one fails OPEN and this file
// would silently test nothing.
const NULL_FACE = { gender: 'male', score: 0.24, raw: 0.62, age: 38, childP: 0.15, shape: { norm: 2.9 } };

function counters(fn) {
  const prev = globalThis.__TS_GAZE_IDS;
  globalThis.__TS_GAZE_IDS = { life: {} };
  try { fn(); return globalThis.__TS_GAZE_IDS.life; }
  finally { globalThis.__TS_GAZE_IDS = prev; }
}

test('the fixture really is a null read, and it really produces the tag', () => {
  assert.equal(isNullRead(NULL_FACE), true);
  const [m] = faceMeta('man', [NULL_FACE]);
  assert.equal(m.nullRead, true);
  // A confident male read next to it must NOT be tagged, or the gate is
  // refusing everybody rather than the prior.
  const [ok] = faceMeta('man', [{ gender: 'male', score: 0.9, raw: 0.95, age: 30, childP: 0.02, shape: { norm: 12.4 } }]);
  assert.ok(!ok.nullRead);
});

test('an unmatched null read creates no track', () => {
  const obs = { box: box(0.1, 0.1, 0.4, 0.9), flagged: true, certain: false, abstained: true, nullMint: true };
  const life = counters(() => {
    assert.equal(updatePersonTracks([], [obs], 300).length, 0);
  });
  assert.equal(life.nullDropped, 1, 'the refusal must be counted or nobody can see it fire');
  // The control: the identical observation without the tag DOES mint.
  const untagged = { ...obs, nullMint: false };
  assert.equal(updatePersonTracks([], [untagged], 300).length, 1);
});

test('a null read still refreshes a track that already exists', () => {
  // THE HALF THAT MATTERS MOST. A covered subject must not be uncovered
  // by this gate, and the way that happens is the track expiring while
  // its refreshes are refused.
  const b = box(0.2, 0.1, 0.5, 0.9);
  let tracks = updatePersonTracks([], [{ box: b, flagged: true, certain: true }], 300);
  assert.equal(tracks.length, 1);
  const id = tracks[0].id;
  for (let i = 0; i < 10; i++) {
    tracks = updatePersonTracks(
      tracks,
      [{ box: b, flagged: true, certain: false, abstained: true, nullMint: true }],
      300
    );
    assert.equal(tracks.length, 1, 'the track died on pass ' + i);
    assert.equal(tracks[0].id, id, 'the identity was re-minted on pass ' + i);
    assert.equal(tracks[0].state, 'blurred', 'the subject went sharp on pass ' + i);
  }
});

test('a merge with real evidence untags the observation, whichever box is bigger', () => {
  // The laundering case, in the direction that actually happened: the
  // synthetic body built from a graphic is LARGER than the real person's
  // box, so `preferred` returns the tagged one.
  const big = { box: box(0.10, 0.00, 0.60, 1.00), flagged: true, certain: false, abstained: true, nullMint: true };
  const small = { box: box(0.20, 0.10, 0.45, 0.70), flagged: true, certain: true };
  const out = dedupeObservations([big, small]);
  assert.equal(out.length, 1, 'the two must merge for this test to mean anything');
  assert.ok(!out[0].nullMint, 'the merged observation may mint -- real evidence went into it');
  // And the merged observation does in fact create a track.
  assert.equal(updatePersonTracks([], out, 300).length, 1);
});

test('two null reads merged stay refused', () => {
  const a = { box: box(0.10, 0.00, 0.60, 1.00), flagged: true, certain: false, abstained: true, nullMint: true };
  const b = { box: box(0.20, 0.10, 0.45, 0.70), flagged: true, certain: false, abstained: true, nullMint: true };
  const out = dedupeObservations([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0].nullMint, true);
  assert.equal(updatePersonTracks([], out, 300).length, 0);
});

test('the merge does not write the tag back into the caller\'s observation', () => {
  const big = { box: box(0.10, 0.00, 0.60, 1.00), flagged: true, certain: false, nullMint: true };
  const small = { box: box(0.20, 0.10, 0.45, 0.70), flagged: true, certain: true };
  dedupeObservations([big, small]);
  assert.equal(big.nullMint, true, 'the input observation was mutated');
});

test('a female LABEL is never refused, and that is not the same as a woman', () => {
  // WHAT THIS DOES AND DOES NOT PROVE. `isNullRead` returns false on its
  // first line for any non-male label, so this can only fail if someone
  // deletes that line -- it is an alarm on the band moving below the 0.5
  // boundary, not a safety proof.
  //
  // IT IS NOT A PROOF ABOUT WOMEN. A critic found the counterexample in
  // this repo's own ground-truth arm: a face whose reference read at
  // px 206 is FEMALE reads `male, raw 0.58-0.66` when degraded to 32px
  // and 48px -- the modal face size in his player -- so the label and
  // the person disagree exactly where it matters. The descriptor floor
  // is what stands between that woman and a refused birth, which is why
  // the refusal is an AND and not a band test.
  for (const raw of [0.02, 0.2, 0.44, 0.499]) {
    const f = { gender: 'female', score: Math.min(0.99, 2 * Math.abs(raw - 0.5)), raw, age: 38, childP: 0.15, shape: { norm: 1.0 } };
    assert.equal(isNullRead(f), false, 'female raw ' + raw + ' was refused');
    assert.ok(!faceMeta('man', [f])[0].nullRead);
  }
  // The misread woman herself: in band, female in truth, and saved only
  // by carrying descriptor signal.
  const misread = { gender: 'male', score: 0.16, raw: 0.58, age: 37, childP: 0.217, shape: { norm: 11.4 } };
  assert.equal(isNullRead(misread), true, 'she really is in the band');
  assert.ok(!faceMeta('man', [misread])[0].nullRead, 'and her birth is not refused');
});

test('a pass whose every observation is refused leaves NOTHING, and says so', () => {
  // THE EXPOSURE A CRITIC NAMED, pinned rather than argued. In his regime
  // MoveNet admits nobody, so every observation comes from a face -- and
  // if the gate refuses them all, `updatePersonTracks` returns an empty
  // list and the caller clears the player outright. This test does not
  // claim that is wrong; it claims the artifact must be able to SEE it,
  // because a run cannot otherwise tell "400 graphics refused" from "one
  // real person refused 400 times".
  const obs = [
    { box: box(0.05, 0.05, 0.30, 0.90), flagged: true, certain: false, abstained: true, nullMint: true },
    { box: box(0.60, 0.05, 0.90, 0.90), flagged: true, certain: false, abstained: true, nullMint: true },
  ];
  const life = counters(() => {
    assert.equal(updatePersonTracks([], obs, 300).length, 0);
  });
  assert.equal(life.nullDropped, 2);
  assert.ok(!life.nullMatched, 'nothing matched -- this is the dangerous shape');
  assert.ok(!life.birthFresh, 'a refused birth is not a birth');
});

test('a tagged observation that refreshes a track is counted apart', () => {
  const b = box(0.2, 0.1, 0.5, 0.9);
  const tracks = updatePersonTracks([], [{ box: b, flagged: true, certain: true }], 300);
  const life = counters(() => {
    updatePersonTracks(tracks, [{ box: b, flagged: true, certain: false, abstained: true, nullMint: true }], 300);
  });
  assert.equal(life.nullMatched, 1, 'the harmless case needs its own number');
  assert.ok(!life.nullDropped, 'a matched observation is never a refused birth');
});

test('a match just above PTRACK_IOU_MIN still refreshes, just below is a refused birth', () => {
  // The birth refusal keys off "unmatched", so the association threshold
  // became load bearing. The first version of this test compared two
  // boxes at IoU 0.835 against a threshold of 0.2 and proved nothing.
  // These are built FROM the constant, so they move with it.
  const base = box(0.2, 0.1, 0.5, 0.9);
  const tagged = (b) => ({ box: b, flagged: true, certain: false, abstained: true, nullMint: true });
  // Two boxes of equal area overlapping by fraction f have IoU f/(2-f).
  const shifted = (iouTarget) => {
    const f = (2 * iouTarget) / (1 + iouTarget);       // overlap fraction
    const w = 0.3;
    return box(0.2 + w * (1 - f), 0.1, 0.5 + w * (1 - f), 0.9);
  };
  let tracks = updatePersonTracks([], [{ box: base, flagged: true, certain: true }], 300);
  const id = tracks[0].id;
  const above = updatePersonTracks(tracks, [tagged(shifted(PTRACK_IOU_MIN + 0.08))], 300);
  assert.equal(above.length, 1, 'a match above the threshold must refresh');
  assert.equal(above[0].id, id);

  const life = counters(() => {
    const below = updatePersonTracks(tracks, [tagged(shifted(Math.max(0.01, PTRACK_IOU_MIN - 0.1)))], 300);
    // The old track coasts; the tagged observation mints nothing.
    assert.ok(below.every((t) => t.id === id), 'a refused birth must not appear as a track');
  });
  assert.equal(life.nullDropped, 1, 'below the threshold it IS a birth, and it is refused');
});
