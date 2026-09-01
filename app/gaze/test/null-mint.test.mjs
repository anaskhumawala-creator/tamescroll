// A NULL READ MINTS ON ITS SECOND SIGHTING, NEVER ITS FIRST.
//
// Three earlier builds of this gate shipped an exposure. Refusing the
// OBSERVATION took the blur off a covered woman in ~4s of coast (loop
// 37b). Refusing the BIRTH unboundedly looked safe -- a live track is
// still refreshed -- and was not: a track DIES on coast expiry or on a
// cut plus wipeIfEmpty, and coming back needs a birth. The tag is a
// property of CONTENT, so it lands on the same subject every pass and
// the refusal was PERMANENT: 40 tagged passes after a death left 0
// tracks where one UNtagged pass covered her.
//
// The bound separates the two populations on the axis that actually
// distinguishes them -- PERSISTENCE. A graphic that reads as a face is
// transient; a person is not. Worst case is ONE pass of exposure
// (~1.5s at his measured cadence) rather than forever.
//
// Every test below runs the real tracker. The exposure test FAILS
// against the unbounded source (0 tracks there, 1 here), which is the
// bar this file exists to meet -- three earlier rounds shipped tests
// that could not have failed.
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

test('a null read is refused ONCE and mints on the second sighting', () => {
  const obs = () => ({ box: box(0.1, 0.1, 0.4, 0.9), flagged: true, certain: false, abstained: true, nullMint: true });
  let hold = [];
  const life = counters(() => {
    const first = updatePersonTracks([], [obs()], 300, hold);
    assert.equal(first.length, 0, 'a first sighting must not mint');
    hold = first.nullHeld;
    assert.equal(hold.length, 1, 'the refusal has to be carried or it is unbounded');
    const second = updatePersonTracks(first, [obs()], 300, hold);
    assert.equal(second.length, 1, 'a second sighting MUST mint');
    assert.equal(second[0].state, 'blurred');
  });
  assert.equal(life.nullDropped, 1);
  assert.equal(life.nullMintedHeld, 1, 'the cost of the hold needs its own number');
  // The control: the identical observation without the tag mints at once.
  assert.equal(updatePersonTracks([], [{ ...obs(), nullMint: false }], 300, []).length, 1);
});

test('A TRANSIENT TAGGED READ NEVER MINTS, AND THE HOLD DOES NOT ACCUMULATE', () => {
  // The population the gate exists for: a graphic that reads as a face
  // for one pass. It must cost nothing, and the hold must not grow into
  // a list that eventually matches everything.
  const obs = { box: box(0.1, 0.1, 0.4, 0.9), flagged: true, certain: false, abstained: true, nullMint: true };
  let t = updatePersonTracks([], [obs], 300, []);
  assert.equal(t.length, 0);
  t = updatePersonTracks(t, [], 300, t.nullHeld);
  assert.equal(t.length, 0);
  assert.equal(t.nullHeld.length, 0, 'a hold nobody re-sighted must be dropped');
});

test('A TAGGED SUBJECT IS COVERED AGAIN AFTER HER TRACK DIES', () => {
  // THE EXPOSURE THE UNBOUNDED BUILD SHIPPED, pinned so a fourth cannot.
  // Refusing the birth is safe only while the track is alive; it dies on
  // coast expiry (`coastExpired` 12 in one phone run) and a birth is
  // then the only way back. This test FAILS against the unbounded
  // source, where the answer is 0 at every pass.
  const b = box(0.3, 0.2, 0.5, 0.7);
  const tagged = () => ({ box: { ...b }, flagged: true, certain: false, abstained: true, nullMint: true });
  let hold = [];
  let t = updatePersonTracks([], [{ box: b, flagged: true, certain: true }], 250, hold);
  assert.equal(t.length, 1);
  for (let i = 0; i < 40; i++) { hold = t.nullHeld; t = updatePersonTracks(t, [], 250, hold); }
  assert.equal(t.length, 0, 'the track has to actually die or this proves nothing');
  let covered = 0;
  for (let i = 0; i < 10; i++) {
    hold = t.nullHeld;
    t = updatePersonTracks(t, [tagged()], 250, hold);
    if (t.length) { covered = i + 1; break; }
  }
  assert.equal(covered, 2, 'she must come back on the SECOND pass, not never');
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
    assert.equal(updatePersonTracks([], out, 300, []).length, 0);
  });
  assert.equal(life.nullDropped, 1, 'the merged tag must reach the refusal');
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
  let out;
  const life = counters(() => {
    out = updatePersonTracks([], obs, 300, []);
    assert.equal(out.length, 0, 'first sighting of both');
  });
  assert.equal(life.nullDropped, 2);
  assert.ok(!life.nullMatched, 'nothing matched -- this is the dangerous shape');
  // AND THE FRAME RECOVERS. Both are held, so the very next pass covers
  // them -- which is the whole difference from the reverted build.
  const again = updatePersonTracks(out, obs, 300, out.nullHeld);
  assert.equal(again.length, 2, 'both must be covered one pass later');
});

test('a tagged observation that refreshes a track is counted apart', () => {
  const b = box(0.2, 0.1, 0.5, 0.9);
  const tracks = updatePersonTracks([], [{ box: b, flagged: true, certain: true }], 300);
  const life = counters(() => {
    updatePersonTracks(tracks, [{ box: b, flagged: true, certain: false, abstained: true, nullMint: true }], 300);
  });
  assert.equal(life.nullMatched, 1, 'the harmless case needs its own number');
  assert.ok(!life.nullDropped, 'a matched observation is never a birth');
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
    const below = updatePersonTracks(tracks, [tagged(shifted(Math.max(0.01, PTRACK_IOU_MIN - 0.1)))], 300, []);
    // The old track coasts; the tagged observation is a BIRTH, so it is
    // held for one pass rather than refreshing anything.
    assert.ok(below.every((t) => t.id === id), 'a held birth is not a track yet');
  });
  assert.equal(life.nullDropped, 1, 'below the threshold it IS a birth');
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

test('the refusal sits above the birth counters, and both really exist', () => {
  // A STRING TEST THAT CANNOT FAIL is how this repo has been burned four
  // times: `indexOf(a) < indexOf(b)` is TRUE when the first term is -1,
  // so the previous version of this test passed with the gate deleted.
  // Both indexes are asserted present before they are compared.
  //
  // The ordering matters because below the bumps, birthFresh and its
  // three siblings would change meaning from "a track was born" to "a
  // birth was attempted", rebasing every earlier round's reading of them.
  const pt = readFileSync(new URL('../src/person-track.mjs', import.meta.url), 'utf8');
  const loop = pt.slice(pt.indexOf('for (j = 0; j < observations.length; j++)'));
  const body = loop.slice(0, loop.indexOf('return next;'));
  const dropped = body.indexOf("bump('nullDropped')");
  const fresh = body.indexOf("bump('birthFresh')");
  assert.ok(dropped >= 0, 'the refusal left the birth loop');
  assert.ok(fresh >= 0, 'the birth counters left the birth loop');
  assert.ok(dropped < fresh, 'the refusal moved below the birth counters');
});

test('THE HOLD IS THREADED, NEVER A MODULE GLOBAL', () => {
  // ONE detector serves every video element on a page. A module-global
  // hold read from inside a promise is the R21 defect this repo has
  // already paid for once -- a watch page plus a feed preview would read
  // each other's refusals.
  const pt = readFileSync(new URL('../src/person-track.mjs', import.meta.url), 'utf8');
  const fn = pt.slice(pt.indexOf('export function updatePersonTracks'));
  const body = fn.slice(0, fn.indexOf('\nexport '));
  assert.ok(/updatePersonTracks\(tracks, observations, dtMs, hold\)/.test(pt),
    'the hold stopped being a parameter');
  assert.ok(body.includes('next.nullHeld = nextHeld;'), 'the hold stopped riding out');
  // Two independent videos cannot see each other's holds: the function
  // reads nothing but its arguments.
  const decls = pt.slice(0, pt.indexOf('export function updatePersonTracks'));
  assert.ok(!/^\s*var\s+\w*[Hh]eld/m.test(decls), 'a module-level hold appeared');

  // And the caller keeps it beside videoTracks rather than on it --
  // wipeIfEmpty and demoteTracks both replace that array.
  assert.match(page, /var nullHeld = \[\];/);
  assert.match(page, /updatePersonTracks\(videoTracks, observations, dt, nullHeld\)/);
  assert.match(page, /nullHeld = videoTracks\.nullHeld \|\| \[\];/);
});
