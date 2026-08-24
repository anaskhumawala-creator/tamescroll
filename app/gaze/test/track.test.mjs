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
  TRACK_MIN_HITS,
  TRACK_CONFIRM_CONFIDENCE,
  TRACK_GENDER_MEMORY,
  TRACK_STATIC_SAMPLES,
  TRACK_STATIC_MAX_CONF,
  suppressTorsoGhosts,
} from '../src/track.mjs';
import { expandToBody } from '../src/region-blur.mjs';

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

test('a low-confidence flagged detection renders only after TRACK_MIN_HITS', () => {
  const low = (x1, y1, x2, y2) => ({ x1, y1, x2, y2, confidence: TRACK_CONFIRM_CONFIDENCE - 0.1 });
  let tracks = updateTracks([], [{ box: low(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  assert.equal(tracks[0].flagged, true); // flagged internally...
  assert.equal(flaggedBoxes(tracks).length, 0); // ...but no patch yet
  for (let i = 1; i < TRACK_MIN_HITS; i++) {
    tracks = updateTracks(tracks, [{ box: low(0.4, 0.4, 0.6, 0.6), flagged: true }]);
  }
  assert.equal(tracks[0].hits, TRACK_MIN_HITS);
  assert.equal(flaggedBoxes(tracks).length, 1); // confirmed, patch renders
});

test('a confident flagged detection renders on its first frame', () => {
  const tracks = updateTracks([], [
    { box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6, confidence: TRACK_CONFIRM_CONFIDENCE }, flagged: true },
  ]);
  assert.equal(flaggedBoxes(tracks).length, 1);
});

test('a box with no confidence field counts as confident (fail-safe)', () => {
  const tracks = updateTracks([], [
    { box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, flagged: true },
  ]);
  assert.equal(flaggedBoxes(tracks).length, 1);
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

test('gender memory: after enough confident clears, an UNCERTAIN flag does not re-flag', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false, certain: true }]);
  for (let i = 1; i < TRACK_GENDER_MEMORY; i++) {
    tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false, certain: true }]);
  }
  assert.equal(tracks[0].clearWins, TRACK_GENDER_MEMORY);
  // person turns away: gender unreadable -> uncertain flag, absorbed
  tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true, certain: false }]);
  assert.equal(tracks[0].flagged, false);
});

test('gender memory: a CONFIDENT opposite flag overrides memory instantly and resets it', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false, certain: true }]);
  for (let i = 1; i <= TRACK_GENDER_MEMORY; i++) {
    tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false, certain: true }]);
  }
  tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true, certain: true }]);
  assert.equal(tracks[0].flagged, true);
  assert.equal(tracks[0].clearWins, 0);
});

test('gender memory: uncertain flags BEFORE memory builds still flag (fail-safe)', () => {
  let tracks = updateTracks([], [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: false, certain: true }]);
  tracks = updateTracks(tracks, [{ box: box(0.4, 0.4, 0.6, 0.6), flagged: true, certain: false }]);
  assert.equal(tracks[0].flagged, true);
});

test('static suppression: a motionless, never-certain, weak track stops rendering', () => {
  const weak = { x1: 0.4, y1: 0.4, x2: 0.5, y2: 0.5, confidence: TRACK_STATIC_MAX_CONF - 0.2 };
  let tracks = updateTracks([], [{ box: weak, flagged: true, certain: false }]);
  for (let i = 0; i < TRACK_STATIC_SAMPLES; i++) {
    tracks = updateTracks(tracks, [{ box: weak, flagged: true, certain: false }]);
  }
  assert.ok(tracks[0].staticCount >= TRACK_STATIC_SAMPLES);
  assert.equal(tracks[0].flagged, true); // still flagged internally
  assert.equal(flaggedBoxes(tracks).length, 0); // but no patch: it is furniture
});

test('static suppression: a MOVING weak track keeps its patch', () => {
  let b = { x1: 0.4, y1: 0.4, x2: 0.5, y2: 0.5, confidence: 0.4 };
  let tracks = updateTracks([], [{ box: b, flagged: true, certain: false }]);
  for (let i = 0; i < TRACK_STATIC_SAMPLES + 2; i++) {
    b = { x1: b.x1 + 0.02, y1: b.y1, x2: b.x2 + 0.02, y2: b.y2, confidence: 0.4 };
    tracks = updateTracks(tracks, [{ box: b, flagged: true, certain: false }]);
  }
  assert.equal(tracks[0].staticCount, 0);
  assert.equal(flaggedBoxes(tracks).length, 1);
});

test('static suppression: a track once CONFIDENTLY gendered is never suppressed', () => {
  const still = { x1: 0.4, y1: 0.4, x2: 0.5, y2: 0.5, confidence: 0.4 };
  let tracks = updateTracks([], [{ box: still, flagged: true, certain: true }]);
  for (let i = 0; i < TRACK_STATIC_SAMPLES + 2; i++) {
    tracks = updateTracks(tracks, [{ box: still, flagged: true, certain: false }]);
  }
  assert.equal(flaggedBoxes(tracks).length, 1); // a real motionless woman stays covered
});

test('static suppression: a strong detection is never suppressed', () => {
  const strong = { x1: 0.4, y1: 0.4, x2: 0.5, y2: 0.5, confidence: TRACK_STATIC_MAX_CONF + 0.1 };
  let tracks = updateTracks([], [{ box: strong, flagged: true, certain: false }]);
  for (let i = 0; i < TRACK_STATIC_SAMPLES + 2; i++) {
    tracks = updateTracks(tracks, [{ box: strong, flagged: true, certain: false }]);
  }
  assert.equal(flaggedBoxes(tracks).length, 1);
});

test('torso ghosts: uncertain candidate inside a cleared face body column, below it, drops', () => {
  const cleared = { box: { x1: 0.45, y1: 0.1, x2: 0.55, y2: 0.2, confidence: 0.9 }, flagged: false, certain: true };
  const shirt = { box: { x1: 0.47, y1: 0.35, x2: 0.53, y2: 0.45, confidence: 0.4 }, flagged: true, certain: false };
  const out = suppressTorsoGhosts([cleared, shirt], expandToBody);
  assert.equal(out.length, 1);
  assert.equal(out[0], cleared);
});

test('torso ghosts: a CERTAIN opposite face at chest height is never dropped', () => {
  const cleared = { box: { x1: 0.45, y1: 0.1, x2: 0.55, y2: 0.2, confidence: 0.9 }, flagged: false, certain: true };
  const woman = { box: { x1: 0.47, y1: 0.35, x2: 0.53, y2: 0.45, confidence: 0.6 }, flagged: true, certain: true };
  const out = suppressTorsoGhosts([cleared, woman], expandToBody);
  assert.equal(out.length, 2);
});

test('torso ghosts: an uncertain face BESIDE (not inside) the body column survives', () => {
  const cleared = { box: { x1: 0.45, y1: 0.1, x2: 0.55, y2: 0.2, confidence: 0.9 }, flagged: false, certain: true };
  const other = { box: { x1: 0.8, y1: 0.35, x2: 0.9, y2: 0.45, confidence: 0.4 }, flagged: true, certain: false };
  const out = suppressTorsoGhosts([cleared, other], expandToBody);
  assert.equal(out.length, 2);
});

test('torso ghosts: nothing drops when there is no confidently-cleared host', () => {
  const a = { box: { x1: 0.45, y1: 0.1, x2: 0.55, y2: 0.2, confidence: 0.9 }, flagged: true, certain: false };
  const b = { box: { x1: 0.47, y1: 0.35, x2: 0.53, y2: 0.45, confidence: 0.4 }, flagged: true, certain: false };
  assert.equal(suppressTorsoGhosts([a, b], expandToBody).length, 2);
});
