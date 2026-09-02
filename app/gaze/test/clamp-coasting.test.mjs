// A COASTING neighbour's hull and head coast WITH its box (2026-09-02).
// R27 stood the clamp down on every coasted track because "the hull
// describes a position the subject has left" -- true while the hull was
// frozen and the box moved by velocity. Replay of the Redmi's run 3
// (spikes/gauntlet/events-linus55c.json): 4 of the 10 certain-male reads
// still covered after the head floor sat under a neighbour coasting
// 306-427ms with a fresh cleared face beside it. Moving the hull and
// head by the same displacement the box gets makes them exactly as
// current as the box they bound, so the clamp may use them. A
// cut-demoted track still stands down: a cut is the moment the geometry
// stops describing the shot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pt from '../src/person-track.mjs';

// Her box reaches LEFT over his face (his head spans 0.17-0.33); her
// evidence hull starts right of it, so the clamp has an edge to move.
const covered = { x1: 0.22, y1: 0.40, x2: 0.90, y2: 1.0 };
const core = { x1: 0.40, y1: 0.42, x2: 0.88, y2: 1.0 };
const herHead = { headX: 0.75, headY: 0.50, headW: 0.12, headH: 0.20 };
const clear = { x1: 0.05, y1: 0.10, x2: 0.45, y2: 1.0 };
const hisHead = { headX: 0.25, headY: 0.30, headW: 0.16, headH: 0.28 };

function twoShot(passes) {
  let tracks = [];
  for (let i = 0; i < passes; i++) {
    tracks = pt.updatePersonTracks(tracks, [
      { box: { ...covered, core, ...herHead }, flagged: true, certain: true, verdictDt: 250 },
      { box: { ...clear, ...hisHead }, flagged: false, certain: true, verdictDt: 250 },
    ], 250);
  }
  return tracks;
}

// Give the covered track a velocity by moving her one step, so the coast
// actually displaces the box.
function movingShot() {
  let tracks = twoShot(3);
  for (let i = 0; i < 3; i++) {
    const dx = 0.02 * (i + 1);
    tracks = pt.updatePersonTracks(tracks, [
      { box: { x1: covered.x1 + dx, y1: covered.y1, x2: covered.x2 + dx, y2: covered.y2,
        core: { x1: core.x1 + dx, y1: core.y1, x2: core.x2 + dx, y2: core.y2 },
        headX: herHead.headX + dx, headY: herHead.headY, headW: herHead.headW, headH: herHead.headH },
        flagged: true, certain: true, verdictDt: 250 },
      { box: { ...clear, ...hisHead }, flagged: false, certain: true, verdictDt: 250 },
    ], 250);
  }
  return tracks;
}

test('a coast moves the hull and the head by the displacement the box gets', () => {
  let tracks = movingShot();
  const her = tracks.find((t) => t.state === 'blurred');
  assert.ok(Math.abs(her.vx) > 0, 'fixture: she is moving');
  const before = { box: her.box, core: her.core, headX: her.headX };
  // Only he is observed: she coasts one pass.
  tracks = pt.updatePersonTracks(tracks, [
    { box: { ...clear, ...hisHead }, flagged: false, certain: true, verdictDt: 250 },
  ], 250);
  const after = tracks.find((t) => t.id === her.id);
  assert.ok(after.missMs > 0, 'fixture: coasting');
  const dx = after.box.x1 - before.box.x1;
  assert.ok(Math.abs(dx) > 1e-4, 'fixture: the coast displaced the box');
  assert.ok(Math.abs((after.core.x1 - before.core.x1) - dx) < 1e-9, 'hull moved with the box');
  assert.ok(Math.abs((after.headX - before.headX) - dx) < 1e-9, 'head moved with the box');
  assert.equal(after.coreFresh, false, 'still not a fresh read');
});

test('the clamp fires against a COASTING neighbour whose head is clear of his face', () => {
  let tracks = twoShot(4);
  tracks = pt.updatePersonTracks(tracks, [
    { box: { ...clear, ...hisHead }, flagged: false, certain: true, verdictDt: 250 },
  ], 250);
  const her = tracks.find((t) => t.state === 'blurred');
  const him = tracks.find((t) => t.state === 'cleared');
  assert.ok(her && him && her.missMs > 0, 'fixture: she coasts beside a cleared man');
  const face = pt.clearedFaceBox(him);
  const drawn = pt.blurredTracks(tracks)[0].box;
  assert.ok(drawn.x1 >= face.x2 - 1e-9, `coasting patch still reaches into his face: ${drawn.x1} < ${face.x2}`);
  assert.deepEqual(pt.presentTracks(tracks).find((e) => e.id === her.id).box, drawn);
});

test('a cut-demoted track still stands the clamp down', () => {
  let tracks = twoShot(4);
  tracks = pt.demoteTracks(tracks);
  const her = tracks.find((t) => t.state === 'blurred');
  assert.equal(her.demoted, true);
  assert.equal(her.coreFresh, false);
  // Re-observe only him after the cut; she coasts, demoted.
  tracks = pt.updatePersonTracks(tracks, [
    { box: { ...clear, ...hisHead }, flagged: false, certain: true, verdictDt: 250 },
  ], 250);
  const after = tracks.find((t) => t.id === her.id);
  assert.ok(after && after.demoted && after.missMs > 0);
  const drawn = pt.blurredTracks(tracks).find((e) => e.id === her.id).box;
  const w = covered.x2 - covered.x1;
  assert.ok(Math.abs(drawn.x1 - Math.max(0, after.box.x1 - w * pt.PTRACK_PAD)) < 1e-9, 'padded, unclamped');
});
