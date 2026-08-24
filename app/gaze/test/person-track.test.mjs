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
  // A BLURRED track holds 3x longer (review A5: a covered person must
  // not be uncovered by a detector-miss timeout).
  const missSteps = Math.ceil(PTRACK_MAX_MISS_MS / 250);
  for (let i = 0; i < missSteps; i++) tracks = updatePersonTracks(tracks, [], 250);
  assert.equal(tracks.length, 1);
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

test('identity memory: remembered clear + agreeing read clears a NEW track instantly', () => {
  const obs = [{ box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 }, flagged: false, certain: true, remembered: 'cleared' }];
  const tracks = pt.updatePersonTracks([], obs, 250);
  assert.equal(tracks[0].state, 'cleared');
});

test('identity memory: remembered clear NEVER overrides a certain flag', () => {
  const obs = [{ box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 }, flagged: true, certain: true, remembered: 'cleared' }];
  const tracks = pt.updatePersonTracks([], obs, 250);
  assert.equal(tracks[0].state, 'blurred');
});

test('identity memory: remembered clear with an UNCERTAIN read stays blurred', () => {
  const obs = [{ box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 }, flagged: true, certain: false, remembered: 'cleared' }];
  const tracks = pt.updatePersonTracks([], obs, 250);
  assert.equal(tracks[0].state, 'blurred');
});

test('identity memory: existing blurred track skips the rest of the hold on remembered clear', () => {
  let tracks = pt.updatePersonTracks([], [{ box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 }, flagged: true, certain: false }], 250);
  assert.equal(tracks[0].state, 'blurred');
  tracks = pt.updatePersonTracks(tracks, [{ box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 }, flagged: false, certain: true, remembered: 'cleared', verdictDt: 250 }], 250);
  assert.equal(tracks[0].state, 'cleared');
});

test('cosineSim: identical normalized vectors 1, orthogonal 0, null 0', () => {
  const a = new Float32Array([1, 0]);
  const b = new Float32Array([0, 1]);
  assert.equal(pt.cosineSim(a, a), 1);
  assert.equal(pt.cosineSim(a, b), 0);
  assert.equal(pt.cosineSim(null, a), 0);
});

test('mergeTracks: overlapping render boxes union into one, disjoint stay apart', () => {
  const merged = pt.mergeTracks([
    { box: { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.6 }, vx: 0.2, vy: 0, vw: 0, vh: 0 },
    { box: { x1: 0.3, y1: 0.2, x2: 0.6, y2: 0.7 }, vx: 0, vy: 0, vw: 0, vh: 0 },
    { box: { x1: 0.8, y1: 0.1, x2: 0.95, y2: 0.5 }, vx: 0, vy: 0, vw: 0, vh: 0 },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].box, { x1: 0.1, y1: 0.1, x2: 0.6, y2: 0.7 });
  assert.ok(Math.abs(merged[0].vx - 0.1) < 1e-9);
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
