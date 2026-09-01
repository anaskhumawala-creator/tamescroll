// A NULL READ IS TAGGED AND COUNTED. IT IS NOT REFUSED.
//
// Three builds of this gate have now shipped an exposure, and the third
// was mine. Refusing the OBSERVATION took the blur off a covered woman
// in ~4s of coast (loop 37b). Refusing the BIRTH looked safe -- a live
// track is still refreshed -- and is not: a track DIES on coast expiry
// or on a cut plus wipeIfEmpty, and coming back needs a birth. Because
// the tag is a property of CONTENT it lands on the same subject every
// pass, so the refusal is PERMANENT. Reproduced against this tracker:
// 40 tagged passes after a death leave 0 tracks, where one UNtagged
// pass covers her immediately.
//
// So the tag now feeds two counters and changes no behaviour, and these
// tests pin THAT: the tag survives dedupe (loop 37c laundered it), a
// tagged observation still mints and still refreshes, and the counters
// can tell "400 transient graphics" from "one real person 400 times" --
// which is the number a bounded version of this gate needs.
//
// A bounded version -- refuse at most ONE consecutive birth -- is the
// next thing to build. It needs state updatePersonTracks does not have.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  updatePersonTracks, dedupeObservations, PTRACK_IOU_MIN,
} from '../src/person-track.mjs';
import { faceMeta, isNullRead } from '../src/gender-verdict.mjs';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

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

test('an unmatched null read is COUNTED and still creates its track', () => {
  const obs = { box: box(0.1, 0.1, 0.4, 0.9), flagged: true, certain: false, abstained: true, nullMint: true };
  const life = counters(() => {
    assert.equal(updatePersonTracks([], [obs], 300).length, 1, 'the tag must not refuse a birth');
  });
  assert.equal(life.nullWouldDrop, 1, 'a counter nobody can see fire is a claim');
  // The control: the identical observation without the tag behaves the
  // same way, because the tag costs nothing but a number now.
  const untagged = { ...obs, nullMint: false };
  assert.equal(updatePersonTracks([], [untagged], 300).length, 1);
});

test('A TAGGED SUBJECT IS COVERED AGAIN AFTER HER TRACK DIES', () => {
  // THE EXPOSURE THE THIRD BUILD OF THIS GATE SHIPPED, pinned so a
  // fourth cannot. Refusing the birth is safe only while the track is
  // alive; it dies on coast expiry (`coastExpired` 12 in one phone run)
  // and a birth is then the only way back.
  const b = box(0.3, 0.2, 0.5, 0.7);
  const tagged = { box: b, flagged: true, certain: false, abstained: true, nullMint: true };
  let t = updatePersonTracks([], [{ box: b, flagged: true, certain: true }], 250);
  assert.equal(t.length, 1);
  for (let i = 0; i < 40; i++) t = updatePersonTracks(t, [], 250);
  assert.equal(t.length, 0, 'the track has to actually die or this proves nothing');
  // One pass. Not forty.
  assert.equal(updatePersonTracks(t, [tagged], 250).length, 1);
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
  const life = counters(() => {
    assert.equal(updatePersonTracks([], out, 300).length, 1);
  });
  assert.equal(life.nullWouldDrop, 1, 'the merged tag must reach the counter');
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

test('a pass of nothing but tagged reads still covers everybody in it', () => {
  // In his regime MoveNet admits nobody, so EVERY observation comes from
  // a face. A gate that refused them all returned an empty list and the
  // caller cleared the player outright -- the exposure above, at frame
  // scale.
  const obs = [
    { box: box(0.05, 0.05, 0.30, 0.90), flagged: true, certain: false, abstained: true, nullMint: true },
    { box: box(0.60, 0.05, 0.90, 0.90), flagged: true, certain: false, abstained: true, nullMint: true },
  ];
  const life = counters(() => {
    assert.equal(updatePersonTracks([], obs, 300).length, 2, 'both must be covered');
  });
  assert.equal(life.nullWouldDrop, 2);
  assert.ok(!life.nullMatched, 'nothing matched -- this is the dangerous shape');
  assert.equal(life.birthFresh, 2, 'a counted birth is still a birth');
});

test('a tagged observation that refreshes a track is counted apart', () => {
  const b = box(0.2, 0.1, 0.5, 0.9);
  const tracks = updatePersonTracks([], [{ box: b, flagged: true, certain: true }], 300);
  const life = counters(() => {
    updatePersonTracks(tracks, [{ box: b, flagged: true, certain: false, abstained: true, nullMint: true }], 300);
  });
  assert.equal(life.nullMatched, 1, 'the harmless case needs its own number');
  assert.ok(!life.nullWouldDrop, 'a matched observation is never a birth');
});

test('a match just above PTRACK_IOU_MIN refreshes, just below is a fresh birth', () => {
  // The two counters split on "unmatched", so the association threshold
  // decides which one fires. The first version of this test compared two
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
    // The old track coasts AND the tagged observation mints its own.
    assert.equal(below.length, 2, 'below the threshold it is a separate person');
    assert.ok(below.some((t) => t.id !== id));
  });
  assert.equal(life.nullWouldDrop, 1, 'below the threshold it IS a birth');
});

test('init-entry copies the tag onto the observation, beside the others', () => {
  // THE BOUNDARY NO BEHAVIOUR TEST IN THIS FILE CROSSES. Everything
  // above hands an observation straight to updatePersonTracks, so if
  // init-entry stopped copying the field every one of them would still
  // pass and the gate would be silently dead -- which is exactly what
  // happened to `abstained` for two releases, and the warning about it
  // is written in that builder in this repo's own words.
  const b = page.slice(page.indexOf('              weak: !!mine.weak,'));
  const obs = b.slice(0, b.indexOf('faceFound: true'));
  assert.ok(obs.includes('nullMint: !!mine.nullRead,'), 'the observation lost the tag');
  // And the producer still emits it under the name the builder reads.
  assert.ok(
    /nullRead: mayNotMint\(f\)/.test(readFileSync(new URL('../src/gender-verdict.mjs', import.meta.url), 'utf8')),
    'faceMeta stopped emitting nullRead, or renamed it'
  );
});

test('nothing in the birth loop refuses a tagged observation', () => {
  // A STRING TEST THAT CANNOT FAIL is how this repo has been burned three
  // times, and the version of this test that shipped an hour ago was one:
  // `indexOf(a) < indexOf(b)` is TRUE when the first term is -1, so it
  // passed with the whole gate deleted. Assert both indexes exist first.
  const pt = readFileSync(new URL('../src/person-track.mjs', import.meta.url), 'utf8');
  const loop = pt.slice(pt.indexOf('for (j = 0; j < observations.length; j++)'));
  const body = loop.slice(0, loop.indexOf('return next;'));
  const would = body.indexOf("bump('nullWouldDrop')");
  const fresh = body.indexOf("bump('birthFresh')");
  assert.ok(would >= 0, 'the counter left the birth loop');
  assert.ok(fresh >= 0, 'the birth counters left the birth loop');
  assert.ok(would < fresh, 'the tag check moved below the birth counters');
  // The thing that actually matters: no early exit on the tag.
  const near = body.slice(Math.max(0, would - 300), would + 300);
  assert.ok(!/nullMint[\s\S]{0,120}continue/.test(near), 'the tag refuses a birth again');
});
