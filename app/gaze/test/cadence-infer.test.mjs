// THE CADENCE INFERENCE HAS BEEN WRONG TWICE AND HAD NO TEST.
//
// `arch-arms` hands its answer straight to `person-track.setVerdictCadence`,
// which sets the coast windows -- so a wrong stride rebases every corpus
// number in the repo and nothing downstream looks unusual. Loop 41 found
// it telling the tracker 500ms for a k=3 arm; critic C5 then found the
// SAME defect surviving in `position` mode, guarded by a comment
// asserting it could not happen.
//
// This is a bench helper, not shipped code. It is tested anyway, because
// the numbers it produces are what protection decisions are made from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inferCadence } from '../bench/arch-arms.mjs';

const face = () => ({ gender: 'male', score: 0.9, nm: 8, raw: 0.9, age: 30 });

// COAST: faces emptied, truth parked on _labelFaces.
const coastThin = (n, k) => Array.from({ length: n }, (_, i) => (i % k === 0
  ? { t: i * 0.5, faces: [face()] }
  : { t: i * 0.5, faces: [], _labelFaces: [face()] }));

// POSITION: the face is KEPT and marked _noRead. `_labelFaces` stays
// undefined on every frame, which is what made this mode invisible.
const posThin = (n, k) => Array.from({ length: n }, (_, i) => (i % k === 0
  ? { t: i * 0.5, faces: [face()] }
  : { t: i * 0.5, faces: [{ ...face(), _noRead: true }] }));

for (const [mode, build] of [['coast', coastThin], ['position', posThin]]) {
  for (const k of [1, 2, 3, 4]) {
    test(`${mode} mode, k=${k}: the stride is inferred as ${k}`, () => {
      const { stride, verdictFrames } = inferCadence(build(120, k));
      assert.equal(stride, k);
      assert.equal(verdictFrames, Math.ceil(120 / k));
    });
  }
}

test('an unthinned window reads stride 1 in both modes', () => {
  assert.equal(inferCadence(coastThin(60, 1)).stride, 1);
  assert.equal(inferCadence(posThin(60, 1)).stride, 1);
});

test('MEDIAN, not first-gap: two adjacent verdicts do not read as k=1', () => {
  // The 13b placement policy can fire twice in a row at a cut. A
  // first-gap estimator would call the whole window k=1 and hand the
  // tracker a cadence three times faster than it runs.
  const f = coastThin(120, 3);
  f[1] = { t: 0.5, faces: [face()] };          // an extra verdict at frame 1
  assert.equal(inferCadence(f).stride, 3);
});

test('a frame with no faces at all is still a verdict frame', () => {
  // An empty frame the arm DID read is evidence -- it is how the eraser
  // learns nobody is there. Only `_labelFaces` (coast) or an all-_noRead
  // face list (position) means "not read".
  const f = [{ t: 0, faces: [] }, { t: 0.5, faces: [] }, { t: 1, faces: [] }];
  assert.equal(inferCadence(f).stride, 1);
  assert.equal(inferCadence(f).verdictFrames, 3);
});

test('no verdicts at all falls back to 1 rather than NaN', () => {
  // A NaN cadence reaches setVerdictCadence, which guards `ms > 0` and
  // silently uses 0 -- the coast collapses to its floor and the arm
  // reports a confident wrong number.
  const f = [{ t: 0, faces: [], _labelFaces: [face()] }];
  assert.equal(inferCadence(f).stride, 1);
});
