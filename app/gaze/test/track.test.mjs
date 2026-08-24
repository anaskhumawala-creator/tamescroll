// Person-track state machine for live-video blur (owner ask 2026-08-24:
// previous-frame awareness — patches persist, glide, and clear only on
// sustained evidence).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  updateTracks,
  flaggedBoxes,
  TRACK_MAX_MISSES,
  TRACK_CLEAR_STREAK,
} from '../src/track.mjs';

const box = (x1, y1, x2, y2) => ({ x1, y1, x2, y2, confidence: 0.9 });

test('a new flagged detection starts a flagged track', () => {
  const tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].flagged, true);
  assert.equal(flaggedBoxes(tracks).length, 1);
});

test('a matched detection eases the box (EMA), not a jump', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  tracks = updateTracks(tracks, [{ box: box(0.45, 0.4, 0.65, 0.6), flagged: true }]);
  assert.equal(tracks.length, 1);
  // moved 0.05 * alpha(0.3) = 0.015, not the full 0.05
  assert.ok(Math.abs(tracks[0].box.x1 - 0.415) < 1e-9);
  assert.ok(tracks[0].box.x1 < 0.45);
});

test('a missed detection HOLDS the patch, coasting on its velocity', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  // one rightward step to establish velocity
  tracks = updateTracks(tracks, [{ box: box(0.5, 0.4, 0.7, 0.6), flagged: true }]);
  const xAfterMatch = tracks[0].box.x1;
  tracks = updateTracks(tracks, []); // miss
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].flagged, true);
  assert.equal(tracks[0].misses, 1);
  assert.ok(tracks[0].box.x1 > xAfterMatch); // coasted right, not frozen
});

test('a track expires after TRACK_MAX_MISSES misses', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  for (let i = 0; i < TRACK_MAX_MISSES; i++) tracks = updateTracks(tracks, []);
  assert.equal(tracks.length, 1); // still holding at the limit
  tracks = updateTracks(tracks, []);
  assert.equal(tracks.length, 0); // gone one past it
});

test('one clear frame does NOT unflag; a full streak does', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false }]);
  assert.equal(tracks[0].flagged, true); // sticky
  for (let i = 1; i < TRACK_CLEAR_STREAK; i++) {
    tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false }]);
  }
  assert.equal(tracks[0].flagged, false);
});

test('clear -> flag flips back instantly (fail-safe)', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false }]);
  assert.equal(tracks[0].flagged, false);
  tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  assert.equal(tracks[0].flagged, true);
});

test('a flag mid-clear-streak resets the streak', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  for (let i = 0; i < TRACK_CLEAR_STREAK - 1; i++) {
    tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false }]);
  }
  tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  // one clear frame after the reset must NOT complete the old streak
  tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false }]);
  assert.equal(tracks[0].flagged, true);
});

test('a far-away detection starts a NEW track (cut reset), old one holds then dies', () => {
  let tracks = updateTracks([], [{ box: box(0.1, 0.1, 0.2, 0.2), flagged: true }]);
  tracks = updateTracks(tracks, [{ box: box(0.7, 0.7, 0.9, 0.9), flagged: false }]);
  assert.equal(tracks.length, 2); // old held (miss 1) + fresh clear track
  const flaggedT = tracks.filter((t) => t.flagged);
  assert.equal(flaggedT.length, 1);
  assert.ok(flaggedT[0].box.x1 < 0.3); // the held one is the old position
});

test('two people track independently', () => {
  let tracks = updateTracks([], [
    { box: box(0.1, 0.1, 0.3, 0.3), flagged: true },
    { box: box(0.6, 0.6, 0.8, 0.8), flagged: false },
  ]);
  tracks = updateTracks(tracks, [
    { box: box(0.12, 0.1, 0.32, 0.3), flagged: true },
    { box: box(0.6, 0.62, 0.8, 0.82), flagged: false },
  ]);
  assert.equal(tracks.length, 2);
  assert.equal(flaggedBoxes(tracks).length, 1);
  assert.ok(flaggedBoxes(tracks)[0].x1 < 0.4);
});
