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
  // Interleave confident/uncertain so the fast-clear streak never fires
  // — this pins the ACCUMULATION path (a person looking down at a phone
  // reads uncertain most frames).
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  const before = tracks[0].clearMs;
  assert.equal(tracks[0].state, 'blurred');
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250); // face turned away
  assert.equal(tracks[0].state, 'blurred');
  assert.ok(tracks[0].clearMs < before && tracks[0].clearMs > 0);
  // Interleaved confident reads still clear eventually (live 2026-08-24:
  // a person looking down reads uncertain most frames — a hard reset
  // meant they never cleared).
  for (let i = 0; i < 12; i++) {
    tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
    tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250);
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

test('fast clear: an uncertain read in between resets the streak', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: false, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'blurred'); // streak broken, one read again
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
  let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].clearStreak, 1);
  tracks = updatePersonTracks(tracks, [obs(boxA, true, false)], 250); // uncertain
  assert.equal(tracks[0].clearStreak, 0, 'decays by one, not below zero');
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  tracks = updatePersonTracks(tracks, [obs(boxA, false, true)], 250);
  assert.equal(tracks[0].state, 'cleared');

  // A CERTAIN OPPOSITE read must still wipe the streak outright.
  let t2 = updatePersonTracks([], [obs(boxA, false, true)], 250);
  t2 = updatePersonTracks(t2, [obs(boxA, true, true)], 250);
  assert.equal(t2[0].clearStreak, 0, 'a certain opposite read erases, not decays');
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

// The abstention must stay confined to the cleared branch. On a track that is
// already blurred, an unreadable read is not new information: it must behave
// exactly like the plain uncertain read it used to be folded into. Asserting
// EQUIVALENCE rather than a value keeps this true if CLEAR_DECAY is retuned.
test('abstention on a blurred track is indistinguishable from plain uncertain', () => {
  const grow = (extra) => {
    let tracks = updatePersonTracks([], [obs(boxA, false, true)], 250);
    return updatePersonTracks(
      tracks,
      [{ box: boxA, flagged: true, certain: false, ...extra }],
      250,
    )[0];
  };
  const plain = grow({});
  const abstained = grow({ abstained: true });
  assert.equal(abstained.state, 'blurred');
  assert.equal(abstained.state, plain.state);
  assert.equal(abstained.clearMs, plain.clearMs);
  assert.equal(abstained.clearStreak, plain.clearStreak);
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

// --- R19: a cleared person's detected face may not be covered ---------
// The gauntlet R19 failure, reproduced from the run's own numbers
// (runs/r19-man f005): the covered child's track sat at x 0.414-0.894
// while she really occupies ~0.50-0.72, so her padded patch was drawn
// across the cleared man's face on six of ten frames.

test('subtractBox: no overlap returns the patch untouched', () => {
  const p = { x1: 0.4, y1: 0.0, x2: 1.0, y2: 1.0 };
  const out = pt.subtractBox(p, { x1: 0.0, y1: 0.0, x2: 0.2, y2: 0.2 });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].box, p);
});

test('subtractBox: a hole biting one edge leaves three pieces and none of them covers it', () => {
  // Linus's face square from runs/r19-man f005, against that frame's patch.
  const patch = { x1: 0.388, y1: 0.045, x2: 1.0, y2: 0.999 };
  const hole = { x1: 0.341, y1: 0.157, x2: 0.479, y2: 0.403 };
  const parts = pt.subtractBox(patch, hole).map((p) => p.box);
  assert.equal(parts.length, 3); // top, bottom, right — no left band survives
  // The centre of his face must be inside NO piece.
  const cx = 0.44;
  const cy = 0.28;
  for (const b of parts) {
    assert.ok(
      !(cx > b.x1 && cx < b.x2 && cy > b.y1 && cy < b.y2),
      `piece ${JSON.stringify(b)} still covers the cleared face`
    );
  }
  // ...and every piece stays inside the original patch: subtraction may
  // only ever REMOVE cover, never add any.
  for (const b of parts) {
    assert.ok(b.x1 >= patch.x1 - 1e-9 && b.x2 <= patch.x2 + 1e-9);
    assert.ok(b.y1 >= patch.y1 - 1e-9 && b.y2 <= patch.y2 + 1e-9);
  }
});

test('subtractBox: a hole fully inside leaves four pieces', () => {
  const patch = { x1: 0, y1: 0, x2: 1, y2: 1 };
  const parts = pt.subtractBox(patch, { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 });
  assert.equal(parts.length, 4);
  // Sides, not indices: an index is not a stable identity because the
  // four pieces are emitted conditionally.
  assert.deepEqual(parts.map((p) => p.side).sort(), ['b', 'l', 'r', 't']);
});

test('subtractBox: a hole covering the patch leaves nothing', () => {
  const parts = pt.subtractBox({ x1: 0.3, y1: 0.3, x2: 0.5, y2: 0.5 }, { x1: 0, y1: 0, x2: 1, y2: 1 });
  assert.equal(parts.length, 0);
});

test('clearedHeadHoles: only CLEARED tracks, only fresh evidence', () => {
  const head = { x1: 0.3, y1: 0.1, x2: 0.45, y2: 0.35 };
  assert.equal(pt.clearedHeadHoles([{ state: 'cleared', headBox: head, headAgeMs: 0 }]).length, 1);
  // A blurred track's own head must never be punched out — that is the
  // covered person, and a hole in their patch is EXPOSURE.
  assert.equal(pt.clearedHeadHoles([{ state: 'blurred', headBox: head, headAgeMs: 0 }]).length, 0);
  // Stale evidence retires.
  assert.equal(
    pt.clearedHeadHoles([
      { state: 'cleared', headBox: head, headAgeMs: pt.HEAD_HOLE_MAX_AGE_MS + 1 },
    ]).length,
    0
  );
  assert.equal(pt.clearedHeadHoles([{ state: 'cleared', headBox: null, headAgeMs: 0 }]).length, 0);
});

// Is this point actually covered? A patch covers a point when the point
// is inside its box AND not inside one of the holes punched in it.
function coveredAt(patches, x, y) {
  return patches.some(
    (p) =>
      x > p.box.x1 &&
      x < p.box.x2 &&
      y > p.box.y1 &&
      y < p.box.y2 &&
      !(p.holes || []).some((h) => x > h.x1 && x < h.x2 && y > h.y1 && y < h.y2)
  );
}

test('blurredTracks: a covered neighbour cannot cover a cleared face', () => {
  const covered = {
    id: 11,
    state: 'blurred',
    box: { x1: 0.414, y1: 0.148, x2: 0.894, y2: 1 },
    vx: 0,
    vy: 0,
  };
  const clearedMan = {
    id: 7,
    state: 'cleared',
    box: { x1: 0.138, y1: 0, x2: 0.694, y2: 1 },
    headBox: { x1: 0.341, y1: 0.157, x2: 0.479, y2: 0.403 },
    headAgeMs: 0,
    vx: 0,
    vy: 0,
  };
  const before = pt.blurredTracks([covered]);
  assert.equal(before.length, 1);
  const cx = 0.44;
  const cy = 0.28;
  assert.ok(
    before.some((r) => cx > r.box.x1 && cx < r.box.x2 && cy > r.box.y1 && cy < r.box.y2),
    'precondition: without the cleared track his face IS covered'
  );
  const after = pt.blurredTracks([covered, clearedMan]);
  // The patch is no longer SPLIT into pieces around his head - it is one
  // patch carrying a hole, subtracted by the renderer's mask instead of
  // by the geometry (owner 2026-08-26: "multiple boxes here and there").
  // So the property to assert is the PIXEL one, which is what it always
  // meant: is that point actually covered.
  assert.ok(!coveredAt(after, cx, cy), 'his face must be sharp once his track is cleared');
  assert.equal(after.length, 1, 'one patch, not four pieces');
  assert.ok(after[0].holes.length >= 1, 'the hole is carried, not cut');
  assert.equal(new Set(after.map((r) => r.key)).size, after.length);
});

test('blurredTracks: a hole is clipped to the patch that carries it', () => {
  // A hole hanging outside its patch would translate into mask layers
  // with negative offsets, and the renderer would be subtracting from
  // pixels the patch never covered.
  const covered = { id: 1, state: 'blurred', box: { x1: 0.4, y1: 0.2, x2: 0.7, y2: 0.9 }, vx: 0, vy: 0 };
  const cleared = {
    id: 2,
    state: 'cleared',
    box: { x1: 0.0, y1: 0.0, x2: 0.5, y2: 1 },
    headBox: { x1: 0.1, y1: 0.1, x2: 0.45, y2: 0.4 },
    headAgeMs: 0,
    vx: 0,
    vy: 0,
  };
  const out = pt.blurredTracks([covered, cleared]);
  for (const p of out) {
    for (const h of p.holes) {
      assert.ok(h.x1 >= p.box.x1 - 1e-9 && h.x2 <= p.box.x2 + 1e-9, 'hole inside horizontally');
      assert.ok(h.y1 >= p.box.y1 - 1e-9 && h.y2 <= p.box.y2 + 1e-9, 'hole inside vertically');
    }
  }
});

test('blurredTracks: a patch with nothing cleared near it carries no holes', () => {
  const covered = { id: 1, state: 'blurred', box: { x1: 0.4, y1: 0.2, x2: 0.7, y2: 0.9 }, vx: 0, vy: 0 };
  const out = pt.blurredTracks([covered]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].holes, [], 'no mask work for the common case');
});

test('blurredTracks: a cleared track with no head evidence changes nothing', () => {
  const covered = { id: 11, state: 'blurred', box: { x1: 0.4, y1: 0.1, x2: 0.9, y2: 1 }, vx: 0, vy: 0 };
  const cleared = { id: 7, state: 'cleared', box: { x1: 0.1, y1: 0, x2: 0.7, y2: 1 }, vx: 0, vy: 0 };
  assert.deepEqual(pt.blurredTracks([covered, cleared]), pt.blurredTracks([covered]));
});

test('the head hole rides the track and ages out', () => {
  const head = { x1: 0.3, y1: 0.1, x2: 0.45, y2: 0.35 };
  let tracks = updatePersonTracks(
    [],
    [{ box: boxA, flagged: false, certain: true, headBox: head }],
    250
  );
  assert.deepEqual(tracks[0].headBox, head);
  assert.equal(tracks[0].headAgeMs, 0);
  // A position-only pass moves the box; the hole moves with it and ages.
  const moved = { x1: 0.2, y1: 0.1, x2: 0.5, y2: 0.8 };
  tracks = updatePersonTracks(tracks, [{ box: moved, positionOnly: true }], 250);
  assert.ok(tracks[0].headBox.x1 > head.x1, 'hole followed the box');
  assert.equal(tracks[0].headAgeMs, 250);
  // Coasting with no observation at all keeps ageing it.
  tracks = updatePersonTracks(tracks, [], 250);
  assert.equal(tracks[0].headAgeMs, 500);
});

test('a hole that has drifted on unverified evidence shrinks instead of switching off', () => {
  const head = { x1: 0.30, y1: 0.10, x2: 0.42, y2: 0.32 };
  const fresh = pt.clearedHeadHoles([
    { state: 'cleared', headBox: head, headAgeMs: 0, headDrift: 0 },
  ])[0];
  assert.deepEqual(fresh, head);
  const drifted = pt.clearedHeadHoles([
    { state: 'cleared', headBox: head, headAgeMs: 0, headDrift: 0.02 },
  ])[0];
  assert.ok(drifted.x1 > fresh.x1 && drifted.x2 < fresh.x2, 'drift insets the hole');
  const aged = pt.clearedHeadHoles([
    { state: 'cleared', headBox: head, headAgeMs: pt.HEAD_HOLE_MAX_AGE_MS, headDrift: 0 },
  ])[0];
  assert.ok(aged.x1 > fresh.x1, 'age insets the hole');
  // Drift past half the short side leaves nothing worth trusting.
  assert.equal(
    pt.clearedHeadHoles([{ state: 'cleared', headBox: head, headAgeMs: 0, headDrift: 0.07 }]).length,
    0
  );
});

test('one patch and a stable key however the hole is shaped', () => {
  // WAS 'piece keys survive a sibling disappearing'. That test existed
  // because a hole SPLIT the patch into up to four sibling rectangles
  // whose keys had to stay distinct and stable, or video-region would
  // lerp one piece's rect onto another piece's overlay. The split is
  // gone (owner 2026-08-26: "multiple boxes here and there") -- the hole
  // is now carried and subtracted by the renderer's mask -- so the
  // property worth pinning is the one that replaced it: the patch count
  // does NOT change with the hole's shape, the key never churns, and the
  // cleared head is sharp either way.
  const covered = { id: 4, state: 'blurred', box: { x1: 0.3, y1: 0.2, x2: 0.9, y2: 0.9 }, vx: 0, vy: 0 };
  const inside = {
    id: 1,
    state: 'cleared',
    box: { x1: 0.3, y1: 0.2, x2: 0.9, y2: 0.9 },
    headBox: { x1: 0.5, y1: 0.4, x2: 0.6, y2: 0.5 },
    headAgeMs: 0,
    headDrift: 0,
    vx: 0,
    vy: 0,
  };
  const mid = pt.blurredTracks([covered, inside]);
  assert.equal(mid.length, 1, 'a hole in the middle is still ONE patch');
  assert.ok(!coveredAt(mid, 0.55, 0.45), 'his head is sharp');

  // Same hole, now running off the top of the patch. Under the old code
  // this changed four pieces into three; now nothing about the patch
  // count or its key may move at all.
  const topped = { ...inside, headBox: { x1: 0.5, y1: 0.1, x2: 0.6, y2: 0.5 } };
  const over = pt.blurredTracks([covered, topped]);
  assert.equal(over.length, 1);
  assert.equal(over[0].key, mid[0].key, 'key does not churn with hole shape');
  assert.ok(!coveredAt(over, 0.55, 0.45), 'still sharp');
  assert.ok(coveredAt(over, 0.35, 0.85), 'the rest of her is still covered');
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
