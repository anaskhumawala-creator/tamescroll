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

test('identity memory: a remembered FLAG re-covers a track immediately', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  // Earn a clear the normal way, then meet the remembered flag.
  let tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: false, certain: true, verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'cleared');
  tracks = pt.updatePersonTracks(tracks, [{ box, flagged: true, certain: false, verdictDt: 250, remembered: 'blurred' }], 250);
  assert.equal(tracks[0].state, 'blurred');
});

test('identity memory: a remembered clear does not exist (memory is blur-only)', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  const tracks = pt.updatePersonTracks([], [{ box, flagged: false, certain: true, remembered: 'cleared' }], 250);
  assert.equal(tracks[0].state, 'blurred'); // first read never clears, memory or not
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
  assert.ok(phone > 2.5 * 1500 - 200, `phone coast ${phone}ms must outlive a 1500ms verdict pass`);
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
