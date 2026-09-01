// Person tracker + blur state machine (redesign 2026-08-24,
// docs/research/blur-pipeline-audit-2026-08-24.md). The hysteresis
// contract under test: blur is instant, clearing takes CLEAR_HOLD_MS of
// CONTINUOUS confident same-gender reads, uncertainty never un-clears a
// known person, and IoU association keeps two nearby identities apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  iou,
  updatePersonTracks,
  wipeIfEmpty,
  blurredTracks,
  CLEAR_HOLD_MS,
  PTRACK_MAX_MISS_MS,
} from '../src/person-track.mjs';
import * as pt from '../src/person-track.mjs';

const boxA = { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.8 };
const boxB = { x1: 0.6, y1: 0.1, x2: 0.9, y2: 0.8 };

function obs(box, flagged, certain) {
  return { box, flagged, certain };
}

test('iou: identical 1, disjoint 0, half overlap in between', () => {
  assert.equal(iou(boxA, boxA), 1);
  assert.equal(iou(boxA, boxB), 0);
  const shifted = { x1: 0.25, y1: 0.1, x2: 0.55, y2: 0.8 };
  const v = iou(boxA, shifted);
  assert.ok(v > 0.2 && v < 0.5);
});

test('new track starts BLURRED even on a confident clear observation', () => {
  const tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].state, 'blurred');
  assert.equal(blurredTracks(tracks).length, 1);
});

test('clearing: first confident read holds, consecutive confident reads clear (fast clear)', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'blurred'); // one read never clears
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'cleared'); // CLEAR_STREAK_N consecutive
  assert.equal(blurredTracks(tracks).length, 0);
  // The CLEAR_HOLD_MS accumulation path still exists for interleaved
  // reads (see the decay test below) — fast clear only rewards
  // CONSECUTIVE confident adult reads.
});

test('an uncertain read DECAYS the clear credit while blurred (never zeroes it)', () => {
  // Interleave confident/unreadable so the fast-clear streak never fires
  // — this pins the ACCUMULATION path (a person looking down at a phone
  // reads uncertain most frames).
  // R30: the interleaver has to fully SPEND the rung, or the fast-clear
  // streak fires and this stops testing accumulation at all. A plain
  // uncertain read holds one rung for a single pass, and since loop 40 so
  // does an abstention on an adult face the model could not read.
  //
  // The interleaver is therefore a read that found NO FACE, which is what
  // "face turned away" below has always meant and is the one case that
  // spends unconditionally -- back-turned, walked-in and substituted all
  // arrive this way, and the grace may never forgive them.
  const gap = { box: boxA, flagged: true, certain: false, abstained: true, faceFound: false };
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(tracks, [gap], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  const before = tracks[0].clearMs;
  assert.equal(tracks[0].state, 'blurred');
  tracks = updatePersonTracks(tracks, [gap], 250); // face turned away
  assert.equal(tracks[0].state, 'blurred');
  assert.ok(tracks[0].clearMs < before && tracks[0].clearMs > 0);
  // Interleaved confident reads still clear eventually (live 2026-08-24:
  // a person looking down reads uncertain most frames — a hard reset
  // meant they never cleared).
  for (let i = 0; i < 12; i++) {
    tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
    tracks = updatePersonTracks(tracks, [gap], 250);
  }
  assert.equal(tracks[0].state, 'cleared');
});

test('cleared + uncertain stays cleared (memory absorbs); 2 confident opposites revoke', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  const steps = Math.ceil(CLEAR_HOLD_MS / 250) + 1;
  for (let i = 0; i < steps; i++) tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'cleared');
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250);
  assert.equal(tracks[0].state, 'cleared'); // uncertainty absorbed
  // An EARNED clear takes 2 consecutive certain opposites (gender-sway
  // noise, owner 2026-08-24) — one read holds, the second revokes.
  tracks = updatePersonTracks(tracks, [obs(boxA, true, true)], 250);
  assert.equal(tracks[0].state, 'cleared');
  tracks = updatePersonTracks(tracks, [obs(boxA, true, true)], 250);
  assert.equal(tracks[0].state, 'blurred');
});

test('unmatched track coasts along its velocity, then expires', () => {
  let tracks = updatePersonTracks([], [obs(boxA, true, true)], 250);
  // Two moving observations to build velocity.
  const moved = { x1: 0.15, y1: 0.1, x2: 0.45, y2: 0.8 };
  tracks = updatePersonTracks(tracks, [obs(moved, true, true)], 250);
  assert.ok(tracks[0].vx > 0);
  const beforeX = tracks[0].box.x1;
  tracks = updatePersonTracks(tracks, [], 250); // miss: coast
  assert.equal(tracks.length, 1);
  assert.ok(tracks[0].box.x1 > beforeX);
  // A blurred track coasts to PTRACK_MAX_MISS_BLURRED_MS and no further:
  // a patch with nothing under it is a ghost, not protection (owner
  // frame 2026-08-25, an empty desk shot wearing four of them).
  const blurredSteps = Math.ceil(pt.PTRACK_MAX_MISS_BLURRED_MS / 250);
  for (let i = 0; i < blurredSteps; i++) tracks = updatePersonTracks(tracks, [], 250);
  assert.equal(tracks.length, 0);
});

test('cleared track reverts to blurred after CLEARED_TTL_MS without a confident clear', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  let tracks = updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: CLEAR_HOLD_MS }], 250);
  tracks = updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: CLEAR_HOLD_MS }], 250);
  assert.equal(tracks[0].state, 'cleared');
  // Only uncertain reads from here on (the absorbed-child scenario).
  const steps = Math.ceil(pt.CLEARED_TTL_MS / 500);
  for (let i = 0; i < steps; i++) {
    tracks = updatePersonTracks(tracks, [{ box, flagged: true, certain: false, verdictDt: 500 }], 250);
  }
  assert.equal(tracks[0].state, 'blurred');
});

test('descriptor mismatch on a matched read resets a cleared track to blurred', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  const descA = new Float32Array([1, 0]);
  const descB = new Float32Array([0, 1]); // orthogonal = different person
  let tracks = updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: CLEAR_HOLD_MS, desc: descA }], 250);
  tracks = updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: CLEAR_HOLD_MS, desc: descA }], 250);
  assert.equal(tracks[0].state, 'cleared');
  tracks = updatePersonTracks(tracks, [{ box, flagged: true, certain: false, verdictDt: 250, desc: descB }], 250);
  assert.equal(tracks[0].state, 'blurred');
});

test('IoU association keeps two nearby identities apart', () => {
  // A blurred and a cleared person side by side; a jittery frame where
  // both boxes shift toward each other must not swap their states.
  let tracks = updatePersonTracks([], [obs(boxA, true, true), obs(boxB, false, true)], 250);
  const steps = Math.ceil(CLEAR_HOLD_MS / 250) + 1;
  for (let i = 0; i < steps; i++) {
    tracks = updatePersonTracks(tracks, [obs(boxA, true, true), obs(boxB, false, true)], 250);
  }
  const stateByX = {};
  tracks.forEach((t) => {
    stateByX[t.box.x1 < 0.5 ? 'left' : 'right'] = t.state;
  });
  assert.equal(stateByX.left, 'blurred');
  assert.equal(stateByX.right, 'cleared');
  // Jitter both toward the middle — IoU with own previous box still wins.
  const jA = { x1: 0.18, y1: 0.1, x2: 0.48, y2: 0.8 };
  const jB = { x1: 0.52, y1: 0.1, x2: 0.82, y2: 0.8 };
  tracks = updatePersonTracks(tracks, [obs(jA, true, false), obs(jB, false, true)], 250);
  const after = {};
  tracks.forEach((t) => {
    after[t.box.x1 < 0.5 ? 'left' : 'right'] = t.state;
  });
  assert.equal(after.left, 'blurred');
  assert.equal(after.right, 'cleared');
});

test('blurredTracks pads the box and carries velocity', () => {
  const tracks = updatePersonTracks([], [obs(boxA, true, true)], 250);
  const out = blurredTracks(tracks);
  assert.equal(out.length, 1);
  assert.ok(out[0].box.x1 < boxA.x1);
  assert.ok(out[0].box.x2 > boxA.x2);
  assert.equal(typeof out[0].vx, 'number');
});

// R13 deleted identity memory. These two tests used to pin its behaviour;
// they now pin its ABSENCE, which is the thing that can regress silently —
// `obs.remembered` is still an easy field for a future change to start
// honouring again, and the measurement says it must not (see the block in
// init-entry.js: the bank saturates in seconds and 17% of different-person
// descriptor pairs match above the threshold).
test('a remembered flag no longer re-covers a cleared track', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'cleared');
  tracks = pt.updatePersonTracks(
    tracks,
    [{ box, flagged: true, certain: false, verdictDt: 250, remembered: 'blurred' }],
    250,
  );
  assert.equal(
    tracks[0].state,
    'cleared',
    'an uncertain read must not revoke an earned clear just because a descriptor bank recognised somebody',
  );
});

test('a remembered flag cannot suppress the first clear credit of a new track', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  const withMem = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, remembered: 'blurred' }], 250);
  const without = pt.updatePersonTracks([], [{ box, flagged: false, certain: true }], 250);
  // Both still start covered -- blur-first is untouched by any of this.
  assert.equal(withMem[0].state, 'blurred');
  assert.equal(without[0].state, 'blurred');
  assert.equal(withMem[0].clearStreak, without[0].clearStreak, 'remembered must have no effect at all');
});



test('cosineSim: identical normalized vectors 1, orthogonal 0, null 0', () => {
  const a = new Float32Array([1, 0]);
  const b = new Float32Array([0, 1]);
  assert.equal(pt.cosineSim(a, a), 1);
  assert.equal(pt.cosineSim(a, b), 0);
  assert.equal(pt.cosineSim(null, a), 0);
});

test('mergeTracks: near-duplicate boxes merge; side-by-side people do NOT', () => {
  // Two people standing together overlap slightly — they must stay two
  // patches (measured 2026-08-25: unioning them covered 66% of frame and
  // buried a cleared man under the daughter's patch).
  const pair = pt.mergeTracks([
    { key: '1', box: { x1: 0.1, y1: 0.1, x2: 0.45, y2: 0.9 }, vx: 0, vy: 0, vw: 0, vh: 0 },
    { key: '2', box: { x1: 0.42, y1: 0.1, x2: 0.8, y2: 0.9 }, vx: 0, vy: 0, vw: 0, vh: 0 },
  ]);
  assert.equal(pair.length, 2);
  // Near-duplicate boxes of the same person DO merge (IoU >= 0.5).
  const dup = pt.mergeTracks([
    { key: '1', box: { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.9 }, vx: 0.2, vy: 0, vw: 0, vh: 0 },
    { key: '2', box: { x1: 0.14, y1: 0.12, x2: 0.52, y2: 0.88 }, vx: 0, vy: 0, vw: 0, vh: 0 },
  ]);
  assert.equal(dup.length, 1);
  assert.ok(Math.abs(dup[0].vx - 0.1) < 1e-9);
});

test('earned clear survives ONE noisy opposite read, revoked on two consecutive', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  // earn the clear
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: CLEAR_HOLD_MS }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: CLEAR_HOLD_MS }], 250);
  assert.equal(tracks[0].state, 'cleared');
  // one noisy certain-opposite read: still cleared
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'cleared');
  // a clean read in between resets the streak
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'cleared');
  // two consecutive: revoked
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'blurred');
});

test('a NON-cleared track still blurs instantly on a certain flag', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  const tracks = pt.updatePersonTracks([], [{ box, flagged: true, certain: true }], 250);
  assert.equal(tracks[0].state, 'blurred');
});

test('fast clear: 2 consecutive certain adult clears lift the blur without the hold', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'blurred'); // first read: still covered
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'cleared'); // second consecutive: sharp
});

// R30 REVERSED THE PLAIN-UNCERTAIN HALF OF THIS TEST ON PURPOSE — see
// `a certain clear split by ONE unreadable pass still clears`. What was
// pinned here is the half that did NOT move: an abstention between two
// certain reads still breaks the streak, "because the age gate returns a
// child as an abstention and S6's derivation depends on that read being
// unable to accumulate anything."
//
// THAT REASON IS ABOUT THE CHILD, AND THE FIXTURE WAS NOT. `abstained`
// has two producers -- a child, and an adult face the model could not
// read -- and this test asserted the child's property using a fixture
// that is the other one. So the split below is not a weakening: the
// child half is pinned exactly as it was, and the half the stated reason
// never covered is pinned to the behaviour the grace already grants a
// plain non-certain read.
test('fast clear: a CHILD abstention in between still resets the streak', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks,
    [{ box, flagged: true, certain: false, abstained: true, childAbstain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'blurred'); // streak broken, one read again
});

// Measured live on his phone, which is why this half exists: 15
// abstentions against 9 clear-certain reads in one window, and 8 of 31
// tracks peaked at clear-streak exactly 1 -- one read short, with an
// unreadable pass in between spending the rung every time.
test('fast clear: an UNREADABLE ADULT in between does not reset the streak', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks,
    [{ box, flagged: true, certain: false, abstained: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'cleared');
});

// The grace forgives ONE pass, not a run of them: two unreadable passes
// in a row must still cost the rung, or a man could be cleared on one
// real read and a stream of nothing.
test('the grace is one pass only — two unreadable passes still reset', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  const dead = { box, flagged: true, certain: false, abstained: true, verdictDt: 250 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [dead], 250);
  tracks = pt.updatePersonTracks(tracks, [dead], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'blurred');
});

// A face that was never there cannot vouch for anyone: the back-turned,
// walked-in and SUBSTITUTED cases all arrive as a non-abstained
// no-face read, and the grace's own exposure note names them.
test('an unreadable pass that found NO FACE still resets the streak', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks,
    [{ box, flagged: true, certain: false, abstained: true, faceFound: false, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'blurred');
});


test('a faceless (back-turned) person stays covered — never expired by facelessness', () => {
  const box = { x1: 0.2, y1: 0.2, x2: 0.6, y2: 0.9 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: true, certain: false, faceFound: false }], 250);
  for (let i = 0; i < 12; i++) {
    tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: false, faceFound: false }], 250);
  }
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].state, 'blurred');
});

test('wipeIfEmpty: an empty frame erases every coasting ghost patch', () => {
  const tracks = [{ id: 1, state: 'blurred' }, { id: 2, state: 'blurred' }];
  assert.equal(wipeIfEmpty(tracks, 0, 0).length, 0);
});

test('wipeIfEmpty: any evidence at all keeps the tracks (eraser, not clearer)', () => {
  const tracks = [{ id: 1, state: 'blurred' }];
  assert.equal(wipeIfEmpty(tracks, 1, 0).length, 1);
  assert.equal(wipeIfEmpty(tracks, 0, 1).length, 1);
});

test('wipeIfEmpty: ONE empty pass is not enough — absence must be seen twice', () => {
  // Gauntlet R5: on a TED stage holding ~40 people, a wide shot made
  // MoveNet and BlazeFace fail together and the eraser cleared the
  // screen. Their agreement was one correlated blind spot counted twice,
  // not corroboration. A single empty pass now keeps the tracks.
  const tracks = [{ id: 1, state: 'blurred' }];
  const small = 0.1;
  assert.equal(wipeIfEmpty(tracks, 0, 0, 1, small).length, 1, 'first empty pass must not erase');
  assert.equal(wipeIfEmpty(tracks, 0, 0, 2, small).length, 0, 'second empty pass erases');
});

test('wipeIfEmpty: a BIG subject vanishing is a cut — erase on the first pass', () => {
  // r5b f003 regression: unconditional corroboration kept a stale
  // close-up track through a cut to a wide shot and painted a
  // near-full-frame blur. Corroboration is only for the small-subject
  // regime where the detectors are unreliable; when the last thing we
  // saw filled the frame, its disappearance is a cut, not a miss.
  const tracks = [{ id: 1, state: 'blurred' }];
  assert.equal(wipeIfEmpty(tracks, 0, 0, 1, 0.6).length, 0, 'big subject gone = erase now');
  assert.equal(wipeIfEmpty(tracks, 0, 0, 1, 0.1).length, 1, 'small subject gone = wait');
});

test('wipeIfEmpty: a BIG subject vanishing with NO cut is a miss, not a departure', () => {
  // r8b f009 regression, and it is the mirror image of the r5b test
  // above: a naval officer filling the frame (prevMaxH 0.78) tilted his
  // head DOWN for one pass, the face was lost, MoveNet was already
  // reporting 0 persons, and the `big` shortcut erased every track — a
  // fully covered opposite-gender man went completely sharp without ever
  // leaving the shot. Total EXPOSURE from one missed detection.
  // "Big subject gone" only means a cut if the shot actually CHANGED, and
  // the scene gate already knows. Same shot => the same two passes of
  // corroboration a small subject gets.
  const tracks = [{ id: 1, state: 'blurred' }];
  // Two passes is not enough either, measured in r8b2: the fix moved the
  // exposure from f009 to f005 because he looked down for two passes.
  // With no cut the eraser stands down and coastStep's time window ends
  // the track instead.
  assert.equal(wipeIfEmpty(tracks, 0, 0, 1, 0.6, false).length, 1, 'no cut: survive the miss');
  assert.equal(wipeIfEmpty(tracks, 0, 0, 9, 0.6, false).length, 1, 'no cut: never erased by pass count');
  assert.equal(wipeIfEmpty(tracks, 0, 0, 1, 0.1, false).length, 1, 'no cut, small: also survives');
  assert.equal(wipeIfEmpty(tracks, 0, 0, 1, 0.6, true).length, 0, 'cut + big: erase at once (r5b)');
  assert.equal(wipeIfEmpty(tracks, 0, 0, 1, 0.1, true).length, 1, 'cut + small: still corroborate');
  assert.equal(wipeIfEmpty(tracks, 0, 0, 2, 0.1, true).length, 0, 'cut + small, twice: erase');
});

test('setVerdictCadence: the blurred coast window never falls below the verdict pass', () => {
  // The 900ms floor is wall-time, but a track the position pass cannot
  // refresh is only fed at the verdict cadence. On a Helio G88 that
  // cadence reaches ~1500ms, so a fixed 900ms limit would expire BEFORE
  // the next pass could arrive and every covered person would flicker
  // once per pass. Desktop (400ms cadence) must stay ~unchanged so the
  // ghost tuning that produced 900 does not regress.
  const coastFor = (cadence, dt) => {
    pt.setVerdictCadence(cadence);
    let tracks = [{
      id: 1, box: boxA, state: 'blurred', missMs: 0, hits: 5,
      clearMs: 0, clearStreak: 0, flagStreak: 0, vx: 0, vy: 0,
    }];
    let elapsed = 0;
    while (tracks.length && elapsed < 10000) {
      tracks = updatePersonTracks(tracks, [], dt);
      elapsed += dt;
    }
    return elapsed;
  };
  const desktop = coastFor(400, 100);
  const phone = coastFor(1500, 100);
  assert.ok(desktop >= 900 && desktop <= 1200, `desktop coast ${desktop}ms should stay near 900`);
  // The requirement is that a covered person survives to the NEXT verdict
  // pass, not that the window grows without limit - it is capped at
  // PTRACK_MAX_COAST_MS so a slow device cannot carry a stale patch for
  // ten seconds.
  assert.ok(phone > 1500, `phone coast ${phone}ms must outlive a 1500ms verdict pass`);
  // The cap is cadence-aware, not flat: it floors at
  // PTRACK_MIN_COAST_PASSES verdict intervals so the window can never be
  // shorter than the pass that refreshes it.
  const phoneCap = Math.max(pt.PTRACK_MAX_COAST_MS, pt.PTRACK_MIN_COAST_PASSES * 1500);
  assert.ok(phone <= phoneCap + 200, `phone coast ${phone}ms must respect the cap`);
  // ...and the cap itself must never fall below the cadence it is capping.
  // A flat 2000ms cap goes SHORTER THAN ONE VERDICT INTERVAL as soon as
  // effZoom passes 2000, so one slow pass left a covered person sharp for
  // ~7s (R8 run A measured a 5973ms verdict => effZoom 8960 vs coast
  // 2000). Routine on a G88, impossible to see on this desktop.
  const slow = coastFor(3000, 100);
  assert.ok(slow > 3000, `slow-device coast ${slow}ms must outlive its own 3000ms cadence`);
  pt.setVerdictCadence(400);
});

test('mergeTracks: a small patch sitting inside a big one merges (stacked patches)', () => {
  // The runs/r2b-woman/f008 shape: a head-and-shoulders patch inside a
  // full-body patch on the SAME person. IoU is only ~0.14 here, so the
  // old IoU-only rule left both on screen with a visible seam.
  const big = { key: 'a', box: { x1: 0.1, y1: 0.05, x2: 0.6, y2: 1.0 } };
  const small = { key: 'b', box: { x1: 0.25, y1: 0.08, x2: 0.5, y2: 0.35 } };
  assert.ok(pt.iou(big.box, small.box) < pt.MERGE_IOU_MIN, 'precondition: IoU is low');
  assert.equal(pt.mergeTracks([big, small]).length, 1);
});

test('mergeTracks: overlapping patches become ONE, far heads or not', () => {
  // The f007 shape. S12 refused this union so a cleared neighbour would
  // not be swallowed; the owner has since ranked patch COUNT above that
  // cost in his own words, so it unions again -- see canMerge. The
  // association stage still splits this pair (next assertion), which is
  // where the failure being prevented is a DELETED human.
  const big = { key: 'a', box: { x1: 0.1, y1: 0.05, x2: 0.9, y2: 1.0 }, headX: 0.25, headW: 0.09 };
  const inner = { key: 'b', box: { x1: 0.5, y1: 0.08, x2: 0.75, y2: 0.5 }, headX: 0.62, headW: 0.09 };
  assert.ok(pt.containment(big.box, inner.box) >= pt.MERGE_CONTAIN_MIN, 'precondition: contained');
  assert.equal(pt.mergeTracks([big, inner]).length, 1);
  // sameHuman reads the head off the BOX (observations), mergeTracks off
  // the TRACK -- same numbers, two lifecycles.
  const obsA = { box: { ...big.box, headX: big.headX, headW: big.headW } };
  const obsB = { box: { ...inner.box, headX: inner.headX, headW: inner.headW } };
  assert.equal(pt.sameHuman(obsA, obsB), false, 'association stage still keeps them apart');
});

test('mergeTracks: two patches on ONE person still merge, and keep the wider head', () => {
  const body = { key: 'a', box: { x1: 0.1, y1: 0.05, x2: 0.6, y2: 1.0 }, headX: 0.34, headW: 0.08 };
  const head = { key: 'b', box: { x1: 0.25, y1: 0.08, x2: 0.5, y2: 0.35 }, headX: 0.37, headW: 0.12 };
  const merged = pt.mergeTracks([body, head]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].headW, 0.12, 'better-measured head survives the union');
});

test('mergeTracks: with no head anchor the old box-only rule is unchanged', () => {
  const big = { key: 'a', box: { x1: 0.1, y1: 0.05, x2: 0.9, y2: 1.0 } };
  const inner = { key: 'b', box: { x1: 0.5, y1: 0.08, x2: 0.75, y2: 0.5 }, headX: 0.62 };
  assert.equal(pt.mergeTracks([big, inner]).length, 1);
});

test('mergeTracks: people standing side by side still do NOT merge', () => {
  const left = { key: 'a', box: { x1: 0.05, y1: 0.1, x2: 0.45, y2: 0.95 } };
  const right = { key: 'b', box: { x1: 0.5, y1: 0.1, x2: 0.9, y2: 0.95 } };
  assert.equal(pt.mergeTracks([left, right]).length, 2);
});

test('mergeTracks: slight shoulder overlap between two people does not merge them', () => {
  const left = { key: 'a', box: { x1: 0.05, y1: 0.1, x2: 0.5, y2: 0.95 } };
  const right = { key: 'b', box: { x1: 0.45, y1: 0.1, x2: 0.9, y2: 0.95 } };
  assert.equal(pt.mergeTracks([left, right]).length, 2);
});

test('dedupeObservations: a duplicate sighting of one person collapses to one', () => {
  const body = { box: { x1: 0.1, y1: 0.05, x2: 0.6, y2: 1.0 }, positionOnly: true };
  const head = { box: { x1: 0.25, y1: 0.08, x2: 0.5, y2: 0.35 }, flagged: false, certain: true };
  const out = pt.dedupeObservations([body, head]);
  assert.equal(out.length, 1);
  // The one carrying a real verdict survives — a position-only sighting
  // must never outrank an actual gender read.
  assert.equal(out[0].certain, true);
});

test('dedupeObservations: two separate people are both kept', () => {
  const a = { box: { x1: 0.05, y1: 0.1, x2: 0.45, y2: 0.95 } };
  const b = { box: { x1: 0.5, y1: 0.1, x2: 0.9, y2: 0.95 } };
  assert.equal(pt.dedupeObservations([a, b]).length, 2);
});

test('association: an oversized stale track cannot swallow a small detection', () => {
  // r5f f003: a close-up-sized box left over from before a cut overlapped
  // every wide-shot detection, so on IoU alone it kept claiming them,
  // kept resetting its miss counter, and rendered as a near-full-frame
  // blur that never expired.
  const stale = {
    id: 1, box: { x1: 0, y1: 0, x2: 0.795, y2: 1 }, state: 'blurred',
    missMs: 0, hits: 9, clearMs: 0, clearStreak: 0, flagStreak: 0, vx: 0, vy: 0,
  };
  const small = { box: { x1: 0.32, y1: 0.48, x2: 0.44, y2: 0.93 }, flagged: false, certain: true };
  const next = updatePersonTracks([stale], [small], 400);
  const inherited = next.find((t) => t.id === 1);
  assert.ok(
    !inherited || inherited.missMs > 0,
    'the stale track must NOT be refreshed by a detection a third of its size'
  );
  assert.ok(next.some((t) => t.id !== 1), 'the real detection starts its own track');
});

test('identity break snaps the box to the new observation, never glides the old one', () => {
  // r5g f003: at a cut, a close-up track's descriptor stopped matching,
  // the verdict correctly reset to blurred, but the box kept EMA-gliding
  // from close-up geometry - painting a near-full-frame patch over a
  // speaker occupying 12% of the frame. A broken identity invalidates
  // the geometry as much as the verdict.
  const bigBox = { x1: 0.0, y1: 0.0, x2: 0.8, y2: 1.0 };
  // Close enough in size to still associate (the size guard rejects
  // anything beyond PTRACK_SIZE_RATIO_MAX), but clearly different
  // geometry - which is exactly the shape of a shot change.
  const smallBox = { x1: 0.1, y1: 0.1, x2: 0.6, y2: 0.9 };
  const descA = new Float32Array([1, 0]);
  const descB = new Float32Array([0, 1]);
  let tracks = updatePersonTracks([], [{ box: bigBox, flagged: false, certain: true, desc: descA }], 250);
  tracks = updatePersonTracks(tracks, [{ box: bigBox, flagged: false, certain: true, desc: descA }], 250);
  assert.equal(tracks[0].state, 'cleared');
  // Same slot, different person: identity breaks.
  tracks = updatePersonTracks(tracks, [{ box: smallBox, flagged: false, certain: false, desc: descB }], 250);
  const t = tracks[0];
  assert.equal(t.state, 'blurred');
  assert.equal(t.box.x2, smallBox.x2, 'box must SNAP to the observation, not glide');
  assert.equal(t.box.y2, smallBox.y2);
});

test('clearStreak decays on uncertainty but is erased by a certain opposite', () => {
  // R6: an uncertain read used to ZERO the streak, treating non-evidence
  // as evidence against - the mechanism behind ~6s of false cover on a
  // woman the model only reads confidently 40% of the time.
  // R30: the decay now needs TWO consecutive non-certain reads, so the
  // first one holds and the second spends.
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].clearStreak, 1);
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250); // uncertain
  assert.equal(tracks[0].clearStreak, 1, 'one non-certain read holds the rung');
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250); // uncertain
  assert.equal(tracks[0].clearStreak, 0, 'the second spends it, not below zero');
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250);
  assert.equal(tracks[0].clearStreak, 0, 'and never below zero');
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'cleared');

  // A CERTAIN OPPOSITE read must still wipe the streak outright.
  let t2 = updatePersonTracks([], [obs(boxA, false, true)], 250);
  t2 = updatePersonTracks(t2, [obs(boxA, true, true)], 250);
  assert.equal(t2[0].clearStreak, 0, 'a certain opposite read erases, not decays');
});

// R30 — THE FAILURE THIS ROUND WAS BUILT AROUND, in the exact shape the
// run recorded it: three certain-clear reads on one man inside 1.5s,
// interleaved with unreadable passes, and he stayed covered on every
// frame because the streak path demanded them ADJACENT.
// Measured on rotation entry 5 (`4u3jS_cTHH0` t=415, cuts at 0.87/s):
// 34 `c!` against 42 `F?` observations in one 15s window.
test('a certain clear split by ONE unreadable pass still clears', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'blurred', 'one read never clears on its own');
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250);
  assert.equal(tracks[0].state, 'blurred', 'and the gap does not clear either');
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'cleared', 'two certain reads, one gap between');
});

// ...but the COUNT of positive evidence is unchanged. Two non-certain
// reads in a row wipe the rung, so the third certain read is only the
// first of a fresh pair - it must not clear.
test('two consecutive unreadable passes still cost the whole rung', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'blurred', 'back to owing a second read');
  assert.equal(tracks[0].clearStreak, 1);
});

// THE CHILD PATH IS UNTOUCHED, and this is the assertion that keeps S6's
// derivation intact. The age gate returns a child as an ABSTENTION, and
// an abstention is exempt from the grace: it spends the rung in full, so
// a child-shaped read can never accumulate no matter how it interleaves
// with a certain read that belongs to somebody else in the same box.
// R30 critic F1 — THE GRACE'S OWN SAFETY ARGUMENT IS "the same person is
// still there, we just could not read them well", and that is a claim
// about a face that WAS found. A pass with no face at all is the
// back-turned / walked-in / SUBSTITUTED case — the exact swap the grace
// forgives — so it spends the rung like an abstention. `personNoFace`,
// `observeThrew` and the verdict timeout all emit this observation.
test('a pass that found NO FACE spends the rung, so it does not clear', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(
    tracks,
    [{ box: boxA, flagged: true, certain: false, faceFound: false }],
    250,
  );
  assert.equal(tracks[0].clearStreak, 0, 'no face found spends the rung');
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'blurred', 'still owes a second read');
});

// ...and the mirror: a face that WAS found and read badly keeps the
// grace. Without this the two tests above pass for the wrong reason.
test('a face found but unread keeps the rung', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(
    tracks,
    [{ box: boxA, flagged: true, certain: false, faceFound: true }],
    250,
  );
  assert.equal(tracks[0].clearStreak, 1);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'cleared');
});

// The fixture is a CHILD abstention on purpose. `abstained` has two
// producers and only one of them may never be forgiven; the other is an
// adult face the model could not read, which the test above
// ("a face found but unread keeps the rung") already grants the grace to.
test('a child abstention between two certain reads does NOT clear', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(
    tracks,
    [{ box: boxA, flagged: true, certain: false, abstained: true, childAbstain: true }],
    250,
  );
  assert.equal(tracks[0].clearStreak, 0, 'a child abstention spends the rung');
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'blurred');
});

test('a CLEARED track survives a slow verdict pass (the mirror bug)', () => {
  // R9 critic: blurredCoastMs got the cadence treatment, the cleared
  // limit stayed a flat PTRACK_MAX_MISS_MS 1000. `dt` includes the
  // previous pass's full cost and `sampling` blocks position passes for
  // the whole verdict, so after a 2-3s verdict the next dt exceeds 1000
  // and a cleared track is DELETED on one miss - then re-detected and
  // reborn `blurred`. A cleared same-gender man re-covered after every
  // slow pass, on the phone, never on this desktop.
  const survivesOneMiss = (cadence) => {
    pt.setVerdictCadence(cadence);
    const dt = Math.round(cadence + 400); // dt carries the pass cost
    let tracks = [{
      id: 1, box: boxA, state: 'cleared', missMs: 0, hits: 5,
      clearMs: CLEAR_HOLD_MS, clearStreak: 3, flagStreak: 0, clearAge: 0, vx: 0, vy: 0,
    }];
    tracks = updatePersonTracks(tracks, [], dt);
    return tracks.length === 1;
  };
  assert.ok(survivesOneMiss(400), 'desktop: a cleared track survives one miss');
  assert.ok(survivesOneMiss(2109), 'slow pass: a cleared track must NOT die on one miss');
  assert.ok(survivesOneMiss(3000), 'G88-speed pass: same');
  // ...and the longer window must not let an unconfirmed clear ride
  // forever: clearAge advances during coast so CLEARED_TTL_MS still bites.
  pt.setVerdictCadence(3000);
  let t = [{
    id: 1, box: boxA, state: 'cleared', missMs: 0, hits: 5,
    clearMs: CLEAR_HOLD_MS, clearStreak: 3, flagStreak: 0, clearAge: 0, vx: 0, vy: 0,
  }];
  t = updatePersonTracks(t, [], 3400);
  assert.ok((t[0].clearAge || 0) >= 3400, 'coasting must AGE a clear, not freeze it');
  pt.setVerdictCadence(400);
});

test('a coasting CLEARED track cannot outlive CLEARED_TTL_MS (R10 regression)', () => {
  // R10 made the cleared coast cadence-aware and claimed clearAge bounded
  // it. It did not - clearAge was advanced in coastStep and tested only in
  // matchedStep, which a coasting track never reaches. At effZoom 3000 the
  // window is 6000ms against a 5000ms TTL, so a newcomer associating with
  // the coasted box would START cleared: sharp, with zero reads. EXPOSURE.
  pt.setVerdictCadence(3000);
  let tracks = [{
    id: 1, box: boxA, state: 'cleared', missMs: 0, hits: 5,
    clearMs: CLEAR_HOLD_MS, clearStreak: 3, flagStreak: 0, clearAge: 0, vx: 0, vy: 0,
  }];
  let elapsed = 0;
  while (tracks.length && tracks[0].state === 'cleared' && elapsed < 20000) {
    tracks = updatePersonTracks(tracks, [], 500);
    elapsed += 500;
  }
  assert.ok(elapsed <= pt.CLEARED_TTL_MS + 500, `a clear survived ${elapsed}ms of coast unobserved`);
  // ...and what it demotes to must be blurred, not deleted: still probably
  // a person, just no longer one we have evidence about.
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].state, 'blurred');
  pt.setVerdictCadence(400);
});

test('a stale track loses the earned-clear protection (2 reads -> 1)', () => {
  // The flagStreak>=2 guard absorbs one noisy read on THE SAME PERSON. A
  // track nobody has seen for over a verdict interval has no claim to it.
  pt.setVerdictCadence(400);
  const staleCleared = () => ({
    id: 1, box: boxA, state: 'cleared', missMs: PTRACK_MAX_MISS_MS + 200, hits: 5,
    clearMs: CLEAR_HOLD_MS, clearStreak: 3, flagStreak: 0, clearAge: 0, vx: 0, vy: 0,
  });
  let t = updatePersonTracks([staleCleared()], [obs(boxA, true, true)], 250);
  assert.equal(t[0].state, 'blurred', 'one certain opposite read covers a STALE clear');
  // A freshly-observed clear still gets its two reads.
  const freshCleared = { ...staleCleared(), missMs: 0 };
  let f = updatePersonTracks([freshCleared], [obs(boxA, true, true)], 250);
  assert.equal(f[0].state, 'cleared', 'a fresh clear still absorbs one noisy read');
});


test('coast window is capped however slow the verdict pass gets', () => {
  // effZoom is uncapped above, so without this a 4s verdict on a phone
  // would carry a stale patch for 10-15s. The cap still bounds it - but
  // it bounds it to PTRACK_MIN_COAST_PASSES intervals, not to a flat
  // constant, because a flat 2000 goes SHORTER than one verdict interval
  // past effZoom 2000 and uncovers the subject entirely (R8 critic).
  pt.setVerdictCadence(4000);
  let tracks = [{
    id: 1, box: boxA, state: 'blurred', missMs: 0, hits: 5,
    clearMs: 0, clearStreak: 0, flagStreak: 0, vx: 0, vy: 0,
  }];
  let elapsed = 0;
  while (tracks.length && elapsed < 30000) {
    tracks = updatePersonTracks(tracks, [], 100);
    elapsed += 100;
  }
  const cap = Math.max(pt.PTRACK_MAX_COAST_MS, pt.PTRACK_MIN_COAST_PASSES * 4000);
  assert.ok(elapsed <= cap + 200, `coast ${elapsed}ms must respect the cap`);
  assert.ok(elapsed > 4000, `coast ${elapsed}ms must outlive its own 4000ms cadence`);
  // 2.5x cadence is still what sets it below the cap - the floor only
  // rescues the case where 2.5x would have been clipped below 1x.
  assert.ok(elapsed <= 2.5 * 4000 + 200, 'the 2.5x rule still governs');
  pt.setVerdictCadence(400);
});

test('R11: an identity break must not leave a clear streak the new person can spend', () => {
  // The exposure this closes: `clearStreak` is seeded from the previous
  // track and was returned as `t.clearStreak - 1`, so the two places
  // that zero it when someone ELSE is standing in the box -- the
  // identityBroken block and the memory override -- were both undone one
  // line later. A long-cleared track that suffers an identity break then
  // handed the newcomer a streak already past the bar, and ONE confident
  // read cleared them. Blur-first says they owe CLEAR_STREAK_N.
  const same = [1, 0, 0];
  const other = [0, 1, 0]; // cosine 0 < IDENT_SIM_MIN
  let tracks = [];
  // Earn a clear and let the streak run well past the bar.
  for (let i = 0; i < 8; i++) {
    tracks = updatePersonTracks(
      tracks,
      [{ box: boxA, flagged: false, certain: true, desc: same }],
      250,
    );
  }
  assert.equal(tracks[0].state, 'cleared');
  assert.ok(
    tracks[0].clearStreak <= pt.CLEAR_STREAK_N,
    `streak must be clamped, got ${tracks[0].clearStreak}`,
  );

  // A DIFFERENT person now occupies the box, and we cannot read them.
  tracks = updatePersonTracks(
    tracks,
    [{ box: boxA, flagged: true, certain: false, desc: other }],
    250,
  );
  assert.equal(tracks[0].state, 'blurred', 'identity break must blur');
  assert.equal(tracks[0].clearStreak, 0, 'identity break must reset the streak');

  // One confident same-gender read from the newcomer must NOT be enough.
  tracks = updatePersonTracks(
    tracks,
    [{ box: boxA, flagged: false, certain: true, desc: other }],
    250,
  );
  assert.equal(
    tracks[0].state,
    'blurred',
    'one read after an identity break must not clear a new person',
  );
});
// R12 opened this hole and R12's critic measured it: when the null-signature
// abstention moved no-information reads out of "certain flag" and into plain
// uncertain, a CLEARED track absorbed them for the whole CLEARED_TTL_MS —
// 4800ms of an opposite-gender subject sharp, against 400ms before. The
// exposure case is a person swap into a cleared track's box.
test('abstention on a cleared track revokes in 2 reads, not CLEARED_TTL_MS', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'cleared', 'setup: track must be cleared first');

  const nul = { box: boxA, flagged: true, certain: false, abstained: true };

  tracks = updatePersonTracks(tracks, [nul], 250);
  assert.equal(
    tracks[0].state,
    'cleared',
    'one abstention must not re-blur someone who earned a clear',
  );
  assert.equal(tracks[0].flagStreak, 1);

  tracks = updatePersonTracks(tracks, [nul], 250);
  assert.equal(
    tracks[0].state,
    'blurred',
    'two consecutive abstentions must revoke the clear',
  );
  assert.equal(tracks[0].clearMs, 0);
});

test('a real read between two abstentions resets the revocation streak', () => {
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'cleared');

  const nul = { box: boxA, flagged: true, certain: false, abstained: true };
  tracks = updatePersonTracks(tracks, [nul], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(tracks, [nul], 250);
  assert.equal(
    tracks[0].state,
    'cleared',
    'only CONSECUTIVE abstentions revoke — an unreadable frame between two good ones is not evidence',
  );
});

// The abstention must stay confined to the cleared branch as far as STATE and
// CREDIT go. On a track that is already blurred, an unreadable read cannot
// demote it further and cannot move the clear hold. Asserting EQUIVALENCE
// rather than a value keeps this true if CLEAR_DECAY is retuned.
//
// R30 SPLIT THE TWO DELIBERATELY on the STREAK, and only on the streak: a
// plain uncertain read now holds one rung for a single pass, an abstention
// still spends it. The reason is the child, and it is the same reason the
// abstainDemote branch exists — the age gate returns a child as an
// abstention, so any grace extended to abstentions would be extended to
// children. The equivalence that remains is the one that was ever argued
// for: an unreadable read cannot change a blurred track's state or credit.
test('abstention on a blurred track cannot demote it or move its credit', () => {
  const grow = (extra) => {
    let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
    return updatePersonTracks(
      tracks,
      [{ box: boxA, flagged: true, certain: false, ...extra }],
      250,
    )[0];
  };
  const plain = grow({});
  // The child is the abstention the reason above is about, and she is
  // the one that must still spend the rung.
  const child = grow({ abstained: true, childAbstain: true });
  const unread = grow({ abstained: true });
  assert.equal(child.state, 'blurred');
  assert.equal(child.state, plain.state);
  assert.equal(child.clearMs, plain.clearMs);
  assert.equal(plain.clearStreak, 1, 'a plain uncertain read holds the rung');
  assert.equal(child.clearStreak, 0, 'a child abstention spends it');
  // And the equivalence the comment says was "ever argued for" holds for
  // BOTH kinds: an unreadable read still cannot change a blurred track's
  // state or its credit. Only the streak was split.
  assert.equal(unread.state, 'blurred');
  assert.equal(unread.clearMs, plain.clearMs);
  assert.equal(unread.clearStreak, 1, 'an unreadable adult holds the rung');
});

// ---------------------------------------------------------------------
// R15: a box that survived a scene cut is worth ONE pass, not three.
// Measured failure: a cut from a 16-person studio wide shot to a one-man
// close-up left five patches from the old shot painting furniture for at
// least two verdict passes after the new shot's pass returned a single
// face and zero MoveNet persons.
test('a cut-demoted track dies at PTRACK_CUT_COAST_MS, not the full coast window', () => {
  pt.setVerdictCadence(400);
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.9 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: true, certain: true }], 400);
  assert.equal(tracks.length, 1);
  tracks = pt.demoteTracks(tracks);
  assert.equal(tracks[0].demoted, true);
  // One pass of grace: coverage holds through the gap after the cut.
  tracks = pt.updatePersonTracks(tracks, [], 300);
  assert.equal(tracks.length, 1, 'still covered one pass after the cut');
  // Past the cut budget, and gone — where the ordinary blurred coast
  // (2.5 x 400 = 1000ms) would still be painting it.
  tracks = pt.updatePersonTracks(tracks, [], 200);
  assert.equal(tracks.length, 0, 'dropped at 500ms, well inside the 1000ms miss coast');
});

test('re-observing a demoted track restores the full coast budget', () => {
  pt.setVerdictCadence(400);
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.9 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: true, certain: true }], 400);
  tracks = pt.demoteTracks(tracks);
  // Somebody really is standing there in the new shot.
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: true }], 100);
  assert.equal(tracks.length, 1);
  assert.equal(!!tracks[0].demoted, false, 'evidence clears the cut flag');
  tracks = pt.updatePersonTracks(tracks, [], 700);
  assert.equal(tracks.length, 1, 'back on the ordinary 1000ms miss coast');
});

// --- head-anchor guard on the dedupe (gauntlet R17) ----------------
// The dedupe is the one place in the handoff that can DELETE a human.
// personFromFace paints a body 4.4 face-heights wide, so on a chest-up
// two-shot both synthetic bodies clamp at the frame edge, which shrinks
// the smaller area and pushes containment past MERGE_CONTAIN_MIN — two
// men, one observation, and the loser's track coasts out and re-mints
// BLURRED. The anchors were already on the boxes and nothing read them.

test('dedupeObservations: two side-by-side people are not merged by torso overlap', () => {
  // Both clamped to the frame edges, containment 0.67 — merged before
  // this guard existed. Heads a third of the frame apart.
  const left = { box: { x1: 0, y1: 0, x2: 0.754, y2: 1, headX: 0.27, headY: 0.3 } };
  const right = { box: { x1: 0.246, y1: 0, x2: 1, y2: 1, headX: 0.73, headY: 0.3 } };
  assert.ok(
    pt.containment(left.box, right.box) >= pt.MERGE_CONTAIN_MIN,
    'the containment that used to merge them must still be there'
  );
  assert.equal(pt.dedupeObservations([left, right]).length, 2);
});

test('dedupeObservations: one person seen twice still collapses', () => {
  // MoveNet body + the same person's synthetic body. Anchors are
  // near-coincident by construction, so the guard must stay out of it.
  const body = { box: { x1: 0.1, y1: 0.05, x2: 0.6, y2: 1.0, headX: 0.34, headY: 0.2 }, positionOnly: true };
  const synth = { box: { x1: 0.05, y1: 0.0, x2: 0.68, y2: 1.0, headX: 0.36, headY: 0.21 }, certain: true };
  assert.equal(pt.dedupeObservations([body, synth]).length, 1);
});

test('dedupeObservations: with no head anchor the old behaviour stands', () => {
  // A back-turned person has no confident head keypoints, so parsePersons
  // reports headX null. Refusing a merge on no evidence would put two
  // patches on one body — the failure the dedupe exists to stop.
  //
  // R18 tried replacing the null anchor with the box centre and reverted
  // it; the reasoning and the numbers are on MERGE_HEAD_SEP. This test
  // pins the behaviour that survived, so the revert cannot be silently
  // undone by someone reading only the diff.
  const a = { box: { x1: 0, y1: 0, x2: 0.754, y2: 1, headX: null, headY: null } };
  const b = { box: { x1: 0.246, y1: 0, x2: 1, y2: 1, headX: 0.73, headY: 0.3 } };
  assert.equal(pt.dedupeObservations([a, b]).length, 1);
});

test('dedupeObservations: one back-turned person seen twice still collapses', () => {
  // The weak tier's ordinary case: two tight boxes on one seated child.
  const a = { box: { x1: 0.10, y1: 0.6, x2: 0.36, y2: 1, headX: null, headY: null } };
  const b = { box: { x1: 0.12, y1: 0.62, x2: 0.38, y2: 1, headX: null, headY: null } };
  assert.equal(pt.dedupeObservations([a, b]).length, 1);
});

// --- patches are SOLID (owner 2026-08-26: no face cutouts) ------------
// R19's answer to "a covered neighbour's patch is drawn across a cleared
// man's face" was to subtract his head square from the patch. The owner
// rejected that twice, in both its forms -- the four-rectangle split and
// the mask hole -- so a patch now covers every point inside its box and
// the remedy for a patch that reaches the wrong person lives upstream, in
// association and geometry.
function coveredAt(patches, x, y) {
  return patches.some((p) => x > p.box.x1 && x < p.box.x2 && y > p.box.y1 && y < p.box.y2);
}

test('blurredTracks: a patch is SOLID — no cutout, even over a cleared head', () => {
  // The owner's decision, pinned so it is not quietly reverted the next
  // time a FALSE COVER frame shows up: a covered neighbour's patch that
  // reaches a cleared man's face COVERS it. That is a real cost and the
  // fix for it is upstream, never a window cut into the blur.
  const covered = { id: 11, state: 'blurred', box: { x1: 0.4, y1: 0.1, x2: 0.9, y2: 1 }, vx: 0, vy: 0 };
  const cleared = { id: 7, state: 'cleared', box: { x1: 0.1, y1: 0, x2: 0.7, y2: 1 }, vx: 0, vy: 0 };
  const patches = pt.blurredTracks([covered, cleared]);
  assert.equal(patches.length, 1);
  assert.ok(coveredAt(patches, 0.6, 0.3), 'a point inside the patch is covered, unconditionally');
  assert.ok(patches.every((p) => !p.holes), 'no patch may carry a holes array any more');
});

test('blurredTracks: a cleared track with no head evidence changes nothing', () => {
  const covered = { id: 11, state: 'blurred', box: { x1: 0.4, y1: 0.1, x2: 0.9, y2: 1 }, vx: 0, vy: 0 };
  const cleared = { id: 7, state: 'cleared', box: { x1: 0.1, y1: 0, x2: 0.7, y2: 1 }, vx: 0, vy: 0 };
  assert.deepEqual(pt.blurredTracks([covered, cleared]), pt.blurredTracks([covered]));
});

test('sameHuman: two people shoulder to shoulder are not one person', () => {
  // runs/r19-man f003, measured: the child's box is 0.726 contained in
  // the man's, their heads sit 0.15 apart, and the OLD body-denominated
  // bar (0.5 x 0.579 = 0.290) merged them -- deleting one of the three
  // humans in frame and leaving her sharp on runs/r19d-man f002.
  const man = {
    box: { x1: 0.151, y1: 0, x2: 0.739, y2: 1, headX: 0.45, headW: 0.125 },
  };
  const child = {
    box: { x1: 0.319, y1: 0.201, x2: 0.898, y2: 1, headX: 0.6, headW: 0.092 },
  };
  assert.ok(pt.containment(child.box, man.box) >= pt.MERGE_CONTAIN_MIN, 'precondition: contained');
  assert.equal(sameHumanBodyRule(man, child), true, 'precondition: the old rule merged them');
  assert.equal(pt.sameHuman(man, child), false);
});

// The rule as it stood before R19, kept here so the regression this
// replaces stays visible rather than becoming folklore.
function sameHumanBodyRule(a, b) {
  if (pt.containment(a.box, b.box) < pt.MERGE_CONTAIN_MIN) return false;
  const narrow = Math.min(a.box.x2 - a.box.x1, b.box.x2 - b.box.x1);
  return Math.abs(a.box.headX - b.box.headX) <= pt.MERGE_HEAD_SEP * narrow;
}

test('sameHuman: two representations of ONE person still merge', () => {
  // A MoveNet body and the personFromFace body built from the same face:
  // the head anchors are a keypoint average against a face centre, which
  // disagree by a fraction of a head width.
  const movenet = { box: { x1: 0.30, y1: 0.10, x2: 0.70, y2: 1, headX: 0.50, headW: 0.11 } };
  const synthetic = { box: { x1: 0.26, y1: 0.02, x2: 0.76, y2: 1, headX: 0.54, headW: 0.10 } };
  assert.equal(pt.sameHuman(movenet, synthetic), true);
  assert.equal(pt.dedupeObservations([movenet, synthetic]).length, 1);
});

test('sameHuman: with no head width the body rule still applies', () => {
  const a = { box: { x1: 0.30, y1: 0.10, x2: 0.70, y2: 1, headX: 0.50 } };
  const b = { box: { x1: 0.26, y1: 0.02, x2: 0.76, y2: 1, headX: 0.54 } };
  assert.equal(pt.sameHuman(a, b), true);
});

// --- track provenance (R20) -----------------------------------------

test('updatePersonTracks: a track remembers whether its box was measured', () => {
  // R19 added this flag and read it off `track.box.fromFace`. newTrack,
  // ema and coastStep each build a bare four-field box literal, so it was
  // undefined on every track ever recorded: 145 of 145 across six runs
  // reported 0, including a pass whose only observation was a synthetic
  // body. The flag lives on the TRACK now.
  const synth = { box: { x1: 0.2, y1: 0.1, x2: 0.6, y2: 0.9, fromFace: true } };
  let tracks = pt.updatePersonTracks([], [synth], 400);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].fromFace, true, 'a synthetic body must say so at birth');

  // And it must survive a match, which is where ema rebuilds the box.
  tracks = pt.updatePersonTracks(tracks, [synth], 400);
  assert.equal(tracks[0].fromFace, true, 'and after ema rebuilds the box');
});

test('updatePersonTracks: a measured track never claims to be extrapolated', () => {
  const measured = { box: { x1: 0.2, y1: 0.1, x2: 0.6, y2: 0.9 } };
  let tracks = pt.updatePersonTracks([], [measured], 400);
  assert.equal(tracks[0].fromFace, false);
  // A coast must not change a track's origin either.
  tracks = pt.updatePersonTracks(tracks, [], 400);
  assert.equal(tracks.length, 1, 'still coasting');
  assert.equal(tracks[0].fromFace, false);
});

// --- S6: the weak-evidence streak (measurement only) -----------------
// The CLEAR transition this streak was built for was measured to expose a
// child on the baseline video and was removed the same round; see the
// GENDER_WEAK_STREAK_N note in person-track.mjs. What these pin is that
// the counter still measures what it claims to, and — the part that
// matters — that it moves NO state.
const weakObs = (box) => ({ box, flagged: true, certain: false, weak: true, faceFound: true });
const oppUncertain = (box) => ({ box, flagged: true, certain: false, faceFound: true });
// A pass that attributed NO face to this track: not part of the read
// sequence at all, so it must neither advance nor reset the streak.
const noFace = (box) => ({ box, flagged: true, certain: false });

test('weak streak: any number of weak reads NEVER clears a track', () => {
  let tracks = updatePersonTracks([], [weakObs(boxA)], 250);
  for (let i = 0; i < 30; i++) {
    tracks = updatePersonTracks(tracks, [weakObs(boxA)], 250);
    assert.equal(tracks[0].state, 'blurred', `weak evidence cleared at read ${i}`);
  }
  assert.equal(tracks[0].weakStreak, pt.GENDER_WEAK_STREAK_N); // clamped
});

test('weak streak: counts consecutive same-direction reads, zeroed by a contradicting one', () => {
  let tracks = updatePersonTracks([], [weakObs(boxA)], 250);
  tracks = updatePersonTracks(tracks, [weakObs(boxA)], 250);
  tracks = updatePersonTracks(tracks, [weakObs(boxA)], 250);
  assert.equal(tracks[0].weakStreak, 3);
  tracks = updatePersonTracks(tracks, [oppUncertain(boxA)], 250);
  assert.equal(tracks[0].weakStreak, 0);
});

test('weak streak: a pass with no attributed face neither advances nor resets it', () => {
  let tracks = updatePersonTracks([], [weakObs(boxA)], 250);
  tracks = updatePersonTracks(tracks, [weakObs(boxA)], 250);
  assert.equal(tracks[0].weakStreak, 2);
  for (let i = 0; i < 6; i++) {
    tracks = updatePersonTracks(tracks, [noFace(boxA)], 250);
    assert.equal(tracks[0].weakStreak, 2, `no-face pass ${i} moved the streak`);
  }
});

test('weak streak: an ABSTAINED read zeroes it', () => {
  let tracks = updatePersonTracks([], [weakObs(boxA)], 250);
  tracks = updatePersonTracks(tracks, [weakObs(boxA)], 250);
  tracks = updatePersonTracks(
    tracks,
    [{ box: boxA, flagged: true, certain: false, abstained: true, faceFound: true }],
    250
  );
  assert.equal(tracks[0].weakStreak, 0);
});

test('weak streak: with no `weak` on any obs the tracker behaves exactly as before S6', () => {
  let tracks = updatePersonTracks([], [obs(boxA, true, false)], 250);
  for (let i = 0; i < 20; i++) {
    tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250);
    assert.equal(tracks[0].state, 'blurred');
  }
  assert.equal(tracks[0].weakStreak, 0);
});

// --- S6: the cut-coast budget is cadence-relative ---------------------
// It is compared against missMs, which accrues in PASS intervals, so a
// flat 400ms means fewer and fewer passes as the device slows. Desktop
// behaviour must be byte-identical or R15's calibration regresses.
test('cut coast: desktop cadence leaves the budget exactly at PTRACK_CUT_COAST_MS', () => {
  pt.setVerdictCadence(400);
  assert.equal(pt.cutCoastBudgetMs(), pt.PTRACK_CUT_COAST_MS);
  pt.setVerdictCadence(250);
  assert.equal(pt.cutCoastBudgetMs(), pt.PTRACK_CUT_COAST_MS);
});

test('cut coast: a slow device gets a proportionally longer budget, capped', () => {
  pt.setVerdictCadence(900);
  assert.equal(pt.cutCoastBudgetMs(), 900);
  pt.setVerdictCadence(1500);
  assert.equal(pt.cutCoastBudgetMs(), 1500);
  // ...and never past the shared cap.
  pt.setVerdictCadence(400);
});

test('demoteTracks: provenance survives a cut, so no phantom source flip', () => {
  let tracks = updatePersonTracks([], [{ box: { ...boxA, fromFace: true }, flagged: true, certain: false }], 250);
  assert.equal(tracks[0].fromFace, true);
  const demoted = pt.demoteTracks(tracks);
  assert.equal(demoted[0].fromFace, true);
});

// S8: the top pad is capped at a share of the HEAD when the head's size
// is known. The pad exists to cover hair and a raised arm above the box;
// PTRACK_PAD_TOP is a fraction of the BODY, so on a full-height person it
// asks for eight times the thing it protects, and above the frame it just
// clamps — which is how 39% of patches became full-height.
test('topPad is capped by the head on a tall box and untouched on a short one', () => {
  const tall = { x1: 0.3, y1: 0.20, x2: 0.7, y2: 0.95, headH: 0.06 };
  const short = { x1: 0.3, y1: 0.40, x2: 0.7, y2: 0.55, headH: 0.06 };
  const padded = (box) => blurredTracks(updatePersonTracks([], [obs(box, true, true)], 250))[0].box;

  const tallPad = tall.y1 - padded(tall).y1;
  const shortPad = short.y1 - padded(short).y1;

  // Head cap wins on the tall box: 0.06 * 0.6 = 0.036, well under
  // 0.75 * PTRACK_PAD_TOP.
  assert.ok(tallPad < 0.75 * pt.PTRACK_PAD_TOP - 1e-9, `tall pad ${tallPad}`);
  assert.ok(Math.abs(tallPad - 0.06 * pt.PTRACK_TOP_PAD_HEADS) < 1e-9, `tall pad ${tallPad}`);
  // Short box: the body fraction is already smaller than the head cap,
  // so a close-up keeps exactly the pad it had before this change.
  assert.ok(Math.abs(shortPad - 0.15 * pt.PTRACK_PAD_TOP) < 1e-9, `short pad ${shortPad}`);
});

test('a track with no head measurement keeps the old body-fraction pad', () => {
  const box = { x1: 0.3, y1: 0.20, x2: 0.7, y2: 0.95 };
  const out = blurredTracks(updatePersonTracks([], [obs(box, true, true)], 250))[0];
  assert.ok(Math.abs((box.y1 - out.box.y1) - 0.75 * pt.PTRACK_PAD_TOP) < 1e-9);
});

// The head measurement has to survive a POSITION pass. Those return an
// early four-field literal, and every field not explicitly carried there
// is wiped -- which would silently restore the full pad on the very next
// fast pass, one frame after the cap took effect.
test('headH survives a position-only pass', () => {
  const box = { x1: 0.3, y1: 0.20, x2: 0.7, y2: 0.95, headH: 0.06 };
  let tracks = updatePersonTracks([], [obs(box, true, true)], 250);
  assert.equal(tracks[0].headH, 0.06);
  tracks = updatePersonTracks(tracks, [{ box, positionOnly: true }], 120);
  assert.equal(tracks[0].headH, 0.06);
});

// S9/F5: the merged key is the overlay's DOM identity. Sorting the two
// composite strings is order-dependent once a group has three members,
// and a permuted key destroys and rebuilds the node -- which is the one
// renderer path that skips every shrink damper, at an unchanged patch
// count, so no existing metric sees it.
test('mergedKey does not depend on the order members merged in', () => {
  const left = pt.mergedKey(pt.mergedKey('7', '9'), '12');
  const right = pt.mergedKey(pt.mergedKey('12', '9'), '7');
  const third = pt.mergedKey('12', pt.mergedKey('9', '7'));
  assert.equal(left, right);
  assert.equal(left, third);
  assert.equal(left, '12+7+9');
});

test('mergedKey dedupes and tolerates an empty side', () => {
  assert.equal(pt.mergedKey('7+9', '9'), '7+9');
  assert.equal(pt.mergedKey('', '4'), '4');
  assert.equal(pt.mergedKey('4', ''), '4');
});

test('a three-way merge yields one patch with a stable key either way', () => {
  const mk = (id, x1, x2) => ({ key: String(id), box: { x1, y1: 0.2, x2, y2: 0.9 }, vx: 0, vy: 0 });
  const a = pt.mergeTracks([mk(7, 0.10, 0.50), mk(9, 0.20, 0.60), mk(12, 0.30, 0.70)]);
  const b = pt.mergeTracks([mk(12, 0.30, 0.70), mk(9, 0.20, 0.60), mk(7, 0.10, 0.50)]);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].key, b[0].key);
});

// --- R23: an earned clear is worth ONE RUNG after a cut ---------------
// Rotation entry 5 scored FALSE COVER on 9 frames of 10 in the owner's
// own direction, and the mechanism was that `demoteTracks` reset
// `clearStreak` to 0 faster than two consecutive certain reads could be
// re-earned (cuts at 0.87/s against a 400ms verdict cadence and a
// per-person read rate well under 1). Banking one rung keeps the price of
// a clear at exactly two certain reads; it stops the cut confiscating the
// first one. Pinned in all four directions so a future round has to face
// the frames rather than the diff.
test('a cut-demoted CLEARED track re-clears on ONE certain read', () => {
  pt.setVerdictCadence(400);
  let tracks = pt.updatePersonTracks([], [obs(boxA, false, true)], 400);
  tracks = pt.updatePersonTracks(tracks, [obs(boxA, false, true)], 400);
  assert.equal(tracks[0].state, 'cleared', 'earned the clear before the cut');
  tracks = pt.demoteTracks(tracks);
  assert.equal(tracks[0].state, 'blurred', 'the cut still covers, blur-first');
  assert.equal(tracks[0].clearStreak, 1, 'one rung banked, not two');
  tracks = pt.updatePersonTracks(tracks, [obs(boxA, false, true)], 400);
  assert.equal(tracks[0].state, 'cleared', 'one read pays the second rung');
});

test('a cut-demoted BLURRED track still owes TWO certain reads', () => {
  pt.setVerdictCadence(400);
  let tracks = pt.updatePersonTracks([], [obs(boxA, false, true)], 400);
  assert.equal(tracks[0].state, 'blurred', 'never earned a clear');
  tracks = pt.demoteTracks(tracks);
  assert.equal(tracks[0].clearStreak, 0, 'nothing earned, nothing banked');
  tracks = pt.updatePersonTracks(tracks, [obs(boxA, false, true)], 400);
  assert.equal(tracks[0].state, 'blurred', 'still owes the second read');
  tracks = pt.updatePersonTracks(tracks, [obs(boxA, false, true)], 400);
  assert.equal(tracks[0].state, 'cleared');
});

// The bank is not a licence, it is a rung: the first read after the cut
// that is NOT a certain clear spends it. This is what bounds the exposure
// the bank opens to a single verdict read.
test('the banked rung decays on the first non-clear read after the cut', () => {
  pt.setVerdictCadence(400);
  let tracks = pt.updatePersonTracks([], [obs(boxA, false, true)], 400);
  tracks = pt.updatePersonTracks(tracks, [obs(boxA, false, true)], 400);
  assert.equal(tracks[0].state, 'cleared');
  tracks = pt.demoteTracks(tracks);
  // Somebody is standing there, but we cannot read them.
  tracks = pt.updatePersonTracks(tracks, [obs(boxA, true, false)], 400);
  assert.equal(tracks[0].clearStreak, 0, 'the rung is spent');
  tracks = pt.updatePersonTracks(tracks, [obs(boxA, false, true)], 400);
  assert.equal(tracks[0].state, 'blurred', 'back to owing two reads');
});

// A CHILD CAN NEVER BANK, and this is the line that keeps S6's derivation
// intact: banking requires having reached `cleared`, reaching `cleared`
// requires certain reads, and a child read is never certain (the age gate
// in gender-verdict returns it as an abstention). The tracker sees that
// as `{flagged, !certain}`, which cannot clear at any streak length.
test('a track fed only child-shaped reads never clears, so never banks', () => {
  pt.setVerdictCadence(400);
  let tracks = pt.updatePersonTracks([], [obs(boxA, true, false)], 400);
  for (let i = 0; i < 12; i++) {
    tracks = pt.updatePersonTracks(tracks, [obs(boxA, true, false)], 400);
  }
  assert.equal(tracks[0].state, 'blurred');
  tracks = pt.demoteTracks(tracks);
  assert.equal(tracks[0].clearStreak, 0);
});

// S10 open item 5, fixed in R23: the position pass dropped `weakStreak`,
// so GENDER_WEAK_STREAK_N could never be reached and every artifact since
// S6 reported a structural zero rather than a population. Behaviour is
// unchanged (S6 removed the clear this counter fed); the measurement is
// not. Position passes outnumber verdict passes 2-3 to 1, so a single
// dropped carry is enough to make the counter dead.
test('weakStreak survives a position-only pass', () => {
  pt.setVerdictCadence(400);
  let tracks = pt.updatePersonTracks(
    [],
    [{ box: boxA, flagged: true, certain: false, weak: true, faceFound: true }],
    400
  );
  assert.equal(tracks[0].weakStreak, 1);
  tracks = pt.updatePersonTracks(tracks, [{ box: boxA, positionOnly: true }], 120);
  assert.equal(tracks[0].weakStreak, 1, 'a position pass is not evidence against it');
  tracks = pt.updatePersonTracks(
    tracks,
    [{ box: boxA, flagged: true, certain: false, weak: true, faceFound: true }],
    400
  );
  assert.equal(tracks[0].weakStreak, 2, 'the streak is over READS, not passes');
});

// S11: a position pass is evidence about WHERE, not about HOW BIG. It
// carries no verdict and no new information about the subject's extent,
// yet it ran at ~8Hz with no size damper at all -- 43% of all measured
// box size change. Grow must stay instant (a person walking toward
// camera; PARTIAL is the failure that guards); only shrink is slowed.
test('a position pass damps SHRINK but never damps growth', () => {
  const start = { x1: 0.30, y1: 0.20, x2: 0.70, y2: 0.90 };
  let tracks = updatePersonTracks([], [obs(start, true, true)], 250);
  const w0 = tracks[0].box.x2 - tracks[0].box.x1;

  // Same track, observed much SMALLER on a position-only pass.
  const small = { x1: 0.40, y1: 0.30, x2: 0.60, y2: 0.80 };
  const shrunk = updatePersonTracks(tracks, [{ box: small, positionOnly: true }], 120);
  const w1 = shrunk[0].box.x2 - shrunk[0].box.x1;
  const moved = (w0 - w1) / (w0 - (small.x2 - small.x1));
  assert.ok(
    Math.abs(moved - pt.PTRACK_POSITION_SHRINK_ALPHA) < 1e-6,
    `shrink moved ${moved} of the way, expected ${pt.PTRACK_POSITION_SHRINK_ALPHA}`
  );

  // ...and observed much LARGER on a position-only pass: full alpha.
  const big = { x1: 0.10, y1: 0.10, x2: 0.90, y2: 0.95 };
  const grown = updatePersonTracks(tracks, [{ box: big, positionOnly: true }], 120);
  const w2 = grown[0].box.x2 - grown[0].box.x1;
  const grew = (w2 - w0) / ((big.x2 - big.x1) - w0);
  assert.ok(
    Math.abs(grew - pt.PTRACK_EMA_ALPHA) < 1e-6,
    `grow moved ${grew} of the way, expected ${pt.PTRACK_EMA_ALPHA}`
  );
});

test('a VERDICT pass still shrinks at full alpha, so the box converges', () => {
  const start = { x1: 0.30, y1: 0.20, x2: 0.70, y2: 0.90 };
  let tracks = updatePersonTracks([], [obs(start, true, true)], 250);
  const w0 = tracks[0].box.x2 - tracks[0].box.x1;
  const small = { x1: 0.40, y1: 0.30, x2: 0.60, y2: 0.80 };
  const after = updatePersonTracks(tracks, [obs(small, true, true)], 250);
  const w1 = after[0].box.x2 - after[0].box.x1;
  const moved = (w0 - w1) / (w0 - (small.x2 - small.x1));
  assert.ok(
    Math.abs(moved - pt.PTRACK_EMA_ALPHA) < 1e-6,
    `verdict shrink moved ${moved}, expected ${pt.PTRACK_EMA_ALPHA}`
  );
});

// --- R27: directional margin ------------------------------------------
// The patch keeps its cushion into empty air and gives it back where a
// CLEARED person's face is. One solid rectangle throughout: an edge
// moves, nothing is cut out and nothing is split.

test('clampPatchOffFaces pulls the edge off a cleared face, but only to core', () => {
  const patch = { x1: 0.30, y1: 0.10, x2: 1.0, y2: 1.0 };
  const core = { x1: 0.50, y1: 0.40, x2: 0.90, y2: 0.99 };
  // A cleared face wholly left of core: the left edge may travel to it.
  const face = { x1: 0.33, y1: 0.20, x2: 0.48, y2: 0.45 };
  const out = pt.clampPatchOffFaces(patch, core, [face]);
  assert.equal(out.x1, 0.48);
  assert.equal(out.y1, patch.y1);
  assert.equal(out.x2, patch.x2);
  assert.equal(out.y2, patch.y2);
});

test('clampPatchOffFaces stops at the evidence hull, never inside it', () => {
  const patch = { x1: 0.30, y1: 0.10, x2: 1.0, y2: 1.0 };
  const core = { x1: 0.43, y1: 0.40, x2: 0.90, y2: 0.99 };
  // The face reaches PAST core.x1 (the neighbour's cheek and the
  // subject's shoulder abut). Partial relief: the edge travels to the
  // hull and stops, so 0.12 of cushion comes off his face and not one
  // pixel of her evidence is given up.
  const face = { x1: 0.30, y1: 0.45, x2: 0.50, y2: 0.70 };
  const out = pt.clampPatchOffFaces(patch, core, [face]);
  assert.equal(out.x1, core.x1);
  assert.equal(out.y1, patch.y1);
  assert.equal(out.x2, patch.x2);
});

test('a face CENTRED inside the evidence hull moves nothing', () => {
  const patch = { x1: 0.30, y1: 0.10, x2: 1.0, y2: 1.0 };
  const core = { x1: 0.43, y1: 0.40, x2: 0.90, y2: 0.99 };
  // Standing inside the covered subject's own evidence. Nothing an edge
  // can do reaches him, and chasing him would only shave her.
  const face = { x1: 0.55, y1: 0.50, x2: 0.70, y2: 0.70 };
  assert.deepEqual(pt.clampPatchOffFaces(patch, core, [face]), patch);
});

test('clampPatchOffFaces picks the cheapest of the four edges', () => {
  const patch = { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 };
  const core = { x1: 0.40, y1: 0.40, x2: 0.60, y2: 0.60 };
  // Clearing this face costs 0.34 of area from the top edge or 0.38
  // from the left. The top edge wins; the left one never moves.
  const face = { x1: 0.02, y1: 0.30, x2: 0.38, y2: 0.34 };
  const out = pt.clampPatchOffFaces(patch, core, [face]);
  assert.equal(out.y1, 0.34);
  assert.equal(out.x1, 0.0);
});

test('a cleared neighbour pulls the blurred patch off his face end to end', () => {
  // Two people side by side. The right one is covered; the left one has
  // earned a clear. The covered subject's evidence starts at 0.50, his
  // face ends at 0.44, and the cushion used to reach past it.
  const covered = { x1: 0.50, y1: 0.40, x2: 0.90, y2: 1.0 };
  const clear = { x1: 0.05, y1: 0.10, x2: 0.45, y2: 1.0 };
  const core = { x1: 0.50, y1: 0.40, x2: 0.90, y2: 1.0 };
  const head = { headX: 0.25, headY: 0.30, headW: 0.16, headH: 0.28 };
  let tracks = [];
  for (let i = 0; i < 4; i++) {
    tracks = pt.updatePersonTracks(tracks, [
      { box: { ...covered, core }, flagged: true, certain: true, verdictDt: 250 },
      { box: { ...clear, ...head }, flagged: false, certain: true, verdictDt: 250 },
    ], 250);
  }
  const cleared = tracks.filter((t) => t.state === 'cleared');
  assert.equal(cleared.length, 1);
  const out = blurredTracks(tracks);
  assert.equal(out.length, 1);
  const face = pt.clearedFaceBox(cleared[0]);
  assert.ok(face, 'the cleared track carries a head anchor');
  // No part of his face is under the patch, and the patch still contains
  // every pixel of the covered subject's evidence.
  assert.ok(out[0].box.x1 >= face.x2 - 1e-9, `${out[0].box.x1} vs ${face.x2}`);
  assert.ok(out[0].box.x1 <= core.x1 + 1e-9);
  assert.ok(out[0].box.x2 >= core.x2);
});

test('a STALE core stands the clamp down (coasting or cut-demoted)', () => {
  const covered = { x1: 0.50, y1: 0.40, x2: 0.90, y2: 1.0 };
  const core = { x1: 0.50, y1: 0.40, x2: 0.90, y2: 1.0 };
  let tracks = pt.updatePersonTracks([], [
    { box: { ...covered, core }, flagged: true, certain: true, verdictDt: 250 },
  ], 250);
  assert.equal(tracks[0].coreFresh, true);
  // A pass with no observation for it: the box coasts, the hull does not.
  tracks = pt.updatePersonTracks(tracks, [], 250);
  assert.equal(tracks[0].coreFresh, false);
  assert.ok(tracks[0].core, 'the hull is kept for continuity');
});

// --- R29: a composite separates people on Y, not X ---------------------
//
// runs/r29-man f003, exact numbers: man A's synthetic body against man C's
// MoveNet observation one PiP window below. Containment 0.645, heads 0.004
// apart in X and 0.330 apart in Y.

test('sameHuman: two PiP windows stacked vertically are two people', () => {
  const synthA = {
    box: { x1: 0, y1: 0.156, x2: 0.445, y2: 0.799, headX: 0.2, headY: 0.28, headW: 0.054, headH: 0.074 },
    positionOnly: true,
  };
  const manC = {
    box: { x1: 0.079, y1: 0.434, x2: 0.352, y2: 1, headX: 0.196, headY: 0.61, headW: 0.064, headH: 0.087 },
    positionOnly: true,
  };
  assert.ok(
    pt.containment(synthA.box, manC.box) >= pt.MERGE_CONTAIN_MIN,
    'the containment that used to merge them must still be there'
  );
  assert.ok(
    Math.abs(synthA.box.headX - manC.box.headX) <=
      pt.MERGE_HEAD_SEP_HEADW * Math.max(synthA.box.headW, manC.box.headW),
    'and X alone must still say "one person" — otherwise the test proves nothing'
  );
  assert.equal(pt.sameHuman(synthA, manC), false);
  assert.equal(pt.dedupeObservations([synthA, manC]).length, 2);
});

test('sameHuman: the Y leg does not split one person seen twice', () => {
  // Same human, two representations: MoveNet's keypoint-averaged head
  // against a BlazeFace face centre. Sub-head-height disagreement.
  const body = {
    box: { x1: 0.1, y1: 0.05, x2: 0.6, y2: 1, headX: 0.34, headY: 0.2, headW: 0.06, headH: 0.08 },
    positionOnly: true,
  };
  const synth = {
    box: { x1: 0.05, y1: 0, x2: 0.68, y2: 1, headX: 0.36, headY: 0.24, headW: 0.058, headH: 0.078 },
    certain: true,
  };
  assert.equal(pt.sameHuman(body, synth), true);
  assert.equal(pt.dedupeObservations([body, synth]).length, 1);
});

test('sameHuman: with no headH the Y leg stands down', () => {
  const a = { box: { x1: 0, y1: 0.156, x2: 0.445, y2: 0.799, headX: 0.2, headY: 0.28, headW: 0.054 } };
  const b = { box: { x1: 0.079, y1: 0.434, x2: 0.352, y2: 1, headX: 0.196, headY: 0.61, headW: 0.064 } };
  assert.equal(pt.sameHuman(a, b), true, 'X-only behaviour is the documented fallback');
});

test('mergeTracks: the union carries headY and headH through', () => {
  const out = pt.mergeTracks([
    // mergeTracks reads the head off the TRACK; sameHuman reads it off
    // the observation's box. Both plumbings now carry all four fields.
    { key: '1', box: { x1: 0, y1: 0, x2: 0.5, y2: 0.6 }, headX: 0.2, headY: 0.1, headW: 0.05, headH: 0.07, vx: 0, vy: 0 },
    { key: '2', box: { x1: 0.05, y1: 0.1, x2: 0.45, y2: 0.55 }, headX: 0.5, headY: 0.3, headW: 0.09, headH: 0.12, vx: 0, vy: 0 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].headY, 0.3, 'the wider head wins, on both axes');
  assert.equal(out[0].headH, 0.12);
});
