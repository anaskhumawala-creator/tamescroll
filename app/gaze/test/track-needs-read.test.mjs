// GENDER ONLY FOR TRACKS THAT NEED A READ (latency-restructure Task 4,
// 2026-09-02). A crop + gender read costs ~536ms of faceres on the
// arm64 Redmi, so a track whose verdict is already settled -- a
// flag-certain blur, or a cleared track re-confirmed inside
// GENDER_REFRESH_MS -- must not pay for another one on this pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  trackNeedsRead, GENDER_REFRESH_MS, updatePersonTracks, iou, PTRACK_IOU_MIN,
} from '../src/person-track.mjs';

test('a settled flag-certain blurred track read just now needs no read', () => {
  assert.equal(trackNeedsRead({ state: 'blurred', lastVerdict: 'flag-certain', readAt: 1000 }, 1500), false);
});
test('a blurred track still on the ladder needs a read every pass', () => {
  assert.equal(trackNeedsRead({ state: 'blurred', lastVerdict: 'uncertain', readAt: 1000 }, 1500), true);
});
test('a cleared track needs a read once GENDER_REFRESH_MS has passed', () => {
  assert.equal(trackNeedsRead({ state: 'cleared', lastVerdict: 'clear-certain', readAt: 1000 }, 1000 + GENDER_REFRESH_MS - 1), false);
  assert.equal(trackNeedsRead({ state: 'cleared', lastVerdict: 'clear-certain', readAt: 1000 }, 1000 + GENDER_REFRESH_MS), true);
});
test('no track, or never read, always reads', () => {
  assert.equal(trackNeedsRead(null, 0), true);
  assert.equal(trackNeedsRead({ state: 'cleared', readAt: 0 }, 5000), true);
});

// THE PREDICATE ALONE IS NOT EVIDENCE THAT THE TRACKER ACTUALLY STAMPS
// `readAt`. A pure-function test of trackNeedsRead can be green while
// updatePersonTracks never writes the field it reads -- this runs the
// REAL state machine and checks the stamp both directions: a verdict
// observation advances it, a position-only observation (the fast pass
// between gender reads) must not.
test('updatePersonTracks stamps readAt from a verdict observation and never from a positionOnly one', () => {
  const box = { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.5 };
  // Birth: a certain, flagged (opposite-gender) verdict observation at
  // t=1000. newTrack's `readAt: obs.positionOnly ? 0 : (obs.at || 0)`.
  let tracks = updatePersonTracks([], [
    { box, flagged: true, certain: true, faceFound: true, at: 1000 },
  ], 0, []);
  assert.equal(tracks.length, 1, 'precondition: the observation bore a track');
  assert.equal(tracks[0].readAt, 1000, 'a verdict observation must stamp readAt from obs.at');

  // A positionOnly pass on the same track, later in wall time: box
  // barely moves so it still associates by IoU, and it must NOT move
  // readAt forward -- that is the entire point of the stamp.
  const movedBox = { x1: 0.11, y1: 0.1, x2: 0.31, y2: 0.5 };
  assert.ok(iou(box, movedBox) >= PTRACK_IOU_MIN, 'precondition: the moved box still associates');
  tracks = updatePersonTracks(tracks, [
    { box: movedBox, positionOnly: true, at: 4000 },
  ], 100, []);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].readAt, 1000,
    'a positionOnly observation must leave readAt exactly where the last real read set it');

  // A second verdict read, later, DOES advance it.
  tracks = updatePersonTracks(tracks, [
    { box: movedBox, flagged: true, certain: true, faceFound: true, at: 4500 },
  ], 100, []);
  assert.equal(tracks[0].readAt, 4500, 'a later verdict observation must re-stamp readAt');
});

// STRUCTURAL: the skip must live in the verdict branch of init-entry.js
// (the crop/gender loop over `all`, not the top-level position-only
// pass), and the OTA row must exist so the dial reaches devices without
// an install.
test('init-entry.js bumps genderReadSkipped inside the verdict branch', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const allForEach = src.indexOf('all.forEach(function (p, pi) {');
  const chainDone = src.indexOf("dbgX.log = (dbgX.log || []).concat(['  chainDone");
  const skip = src.indexOf("bumpLife('genderReadSkipped')");
  assert.ok(allForEach > 0, 'the crop/gender loop over `all` must exist');
  assert.ok(skip > allForEach && skip < chainDone,
    'genderReadSkipped must be bumped inside the per-person verdict loop, ' +
    'not in the top-level position-only pass');
  assert.ok(src.includes('trackNeedsRead('),
    'init-entry.js must consult trackNeedsRead before paying for a crop + gender read');
});

test('GENDER_REFRESH_MS is on the OTA tuning whitelist and rules/tuning.json agrees', async () => {
  const tuning = await import('../src/tuning.mjs');
  assert.ok(tuning.tunableNames().includes('GENDER_REFRESH_MS'),
    'GENDER_REFRESH_MS must be OTA-tunable, not only a source constant');
  const obj = JSON.parse(
    readFileSync(new URL('../../../rules/tuning.json', import.meta.url), 'utf8'));
  assert.equal(obj.GENDER_REFRESH_MS, GENDER_REFRESH_MS,
    'rules/tuning.json must agree with the shipped default or an OTA push reverts it');
});
