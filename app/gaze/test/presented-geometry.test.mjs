// The delay presenter draws from track-timeline snapshots, and until
// this test existed the snapshot was the RAW tracker box: no render
// padding, no R27 directional clamp, no merge. So the clamp that keeps a
// cleared man's face out of his neighbour's patch was verified in
// blurredTracks and never reached the screen on any build with the
// presenter attached (measured on the Redmi, 1094: 30 of 48 covered
// certain-male reads were a NEIGHBOUR's box with his own track cleared).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pt from '../src/person-track.mjs';

function twoShot() {
  // Her box reaches LEFT over his face (head 0.17-0.33); her hull starts
  // right of it, so the clamp has an edge to move -- the first fixture
  // never overlapped his face and the clamp assertion passed vacuously.
  const covered = { x1: 0.22, y1: 0.40, x2: 0.90, y2: 1.0 };
  const clear = { x1: 0.05, y1: 0.10, x2: 0.45, y2: 1.0 };
  const core = { x1: 0.40, y1: 0.40, x2: 0.90, y2: 1.0 };
  const head = { headX: 0.25, headY: 0.30, headW: 0.16, headH: 0.28 };
  let tracks = [];
  for (let i = 0; i < 4; i++) {
    tracks = pt.updatePersonTracks(tracks, [
      { box: { ...covered, core }, flagged: true, certain: true, verdictDt: 250 },
      { box: { ...clear, ...head }, flagged: false, certain: true, verdictDt: 250 },
    ], 250);
  }
  return tracks;
}

test('presentTracks hands the timeline the DRAWN box per track, ids intact, cleared tracks included', () => {
  const tracks = twoShot();
  const cleared = tracks.find((t) => t.state === 'cleared');
  const blurred = tracks.find((t) => t.state === 'blurred');
  assert.ok(cleared && blurred, 'fixture: one cleared, one blurred');
  const out = pt.presentTracks(tracks);
  assert.equal(out.length, 2);
  const b = out.find((e) => e.id === blurred.id);
  const c = out.find((e) => e.id === cleared.id);
  assert.equal(b.state, 'blurred');
  assert.equal(c.state, 'cleared');
  // The blurred entry is exactly what the render layer would draw for
  // this track: padded and clamped off the cleared face.
  assert.deepEqual(b.box, pt.blurredTracks(tracks)[0].box);
  const face = pt.clearedFaceBox(cleared);
  assert.ok(b.box.x1 >= face.x2 - 1e-9, `presented edge ${b.box.x1} reaches into his face (ends ${face.x2})`);
  assert.notDeepEqual(b.box, blurred.box, 'the raw tracker box is not what gets presented');
  // The cleared entry carries the face the merge re-clamp needs, and the
  // blurred one its evidence hull.
  assert.deepEqual(c.face, face);
  assert.deepEqual(b.core, blurred.core);
  assert.deepEqual(b.head, pt.clearedFaceBox(blurred));
  assert.equal(b.flagCertain, true);
  assert.equal(c.flagCertain, false);
  assert.equal(b.coasting, false);
});

test('presentTracks marks a coasting track', () => {
  let tracks = pt.updatePersonTracks([], [
    { box: { x1: 0.5, y1: 0.4, x2: 0.9, y2: 1.0 }, flagged: true, certain: true, verdictDt: 250 },
  ], 250);
  tracks = pt.updatePersonTracks(tracks, [], 250);
  assert.equal(pt.presentTracks(tracks)[0].coasting, true);
});

test('mergePresented unions overlapping blurred entries and re-clamps the union off a cleared face', () => {
  const face = { x1: 0.30, y1: 0.45, x2: 0.48, y2: 0.70 };
  const list = [
    { id: 1, box: { x1: 0.40, y1: 0.10, x2: 0.80, y2: 1.0 }, state: 'blurred', core: { x1: 0.50, y1: 0.40, x2: 0.80, y2: 0.99 } },
    { id: 2, box: { x1: 0.55, y1: 0.10, x2: 0.95, y2: 1.0 }, state: 'blurred', core: { x1: 0.60, y1: 0.40, x2: 0.93, y2: 0.99 } },
    { id: 3, box: { x1: 0.05, y1: 0.10, x2: 0.45, y2: 1.0 }, state: 'cleared', face },
  ];
  const out = pt.mergePresented(list);
  assert.equal(out.length, 1, 'a cleared entry is never a patch and the two overlapping patches are one');
  assert.equal(out[0].state, 'blurred');
  assert.equal(out[0].box.x2, 0.95);
  assert.equal(out[0].box.y1, 0.10);
  // The union would have reached 0.40, back over his face; the merged
  // hull starts at 0.50 so the edge stops at his face (0.48).
  assert.equal(out[0].box.x1, 0.48);
});

test('mergePresented leaves non-overlapping patches alone and keeps their ids', () => {
  const list = [
    { id: 1, box: { x1: 0.10, y1: 0.10, x2: 0.30, y2: 0.90 }, state: 'blurred', core: null },
    { id: 2, box: { x1: 0.60, y1: 0.10, x2: 0.90, y2: 0.90 }, state: 'blurred', core: null },
  ];
  const out = pt.mergePresented(list);
  assert.deepEqual(out.map((e) => String(e.id)).sort(), ['1', '2']);
  assert.deepEqual(out.map((e) => e.box), list.map((e) => e.box));
});
