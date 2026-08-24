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
