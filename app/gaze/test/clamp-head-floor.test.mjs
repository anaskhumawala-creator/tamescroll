// THE HEAD FLOOR (person-track.clampPatchOffFaces, 2026-09-02). Geometry
// read off the Redmi at 222.9s of NWoT1ZVd1Lo: one MoveNet hull spanning
// the child AND the man beside her, his face centre inside it, her head
// well to the right of his face. R27's rule (edge travels only to the
// hull) refuses; the head floor lets the X edge travel to her head box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPatchOffFaces } from '../src/person-track.mjs';

const patch = { x1: 0.375, y1: 0.0, x2: 1.0, y2: 1.0 };
const core = { x1: 0.41, y1: 0.05, x2: 0.99, y2: 1.0 };
const head = { x1: 0.55, y1: 0.12, x2: 0.72, y2: 0.45 };
const hisFace = { x1: 0.38, y1: 0.15, x2: 0.55, y2: 0.42 }; // centre 0.465, inside core

test('without a head box the R27 rule stands: a face centred inside the hull moves nothing', () => {
  assert.deepEqual(clampPatchOffFaces(patch, core, [hisFace]), patch);
  assert.deepEqual(clampPatchOffFaces(patch, core, [hisFace], null), patch);
});

test('with a head box the X edge travels to the head, never inside it, never on Y', () => {
  const out = clampPatchOffFaces(patch, core, [hisFace], head);
  assert.equal(out.x1, 0.55, 'edge stops at min(face.x2, head.x1)');
  assert.equal(out.y1, patch.y1);
  assert.equal(out.y2, patch.y2);
  assert.equal(out.x2, patch.x2);
});

test('a face centred inside the head box itself moves nothing', () => {
  const inside = { x1: 0.56, y1: 0.15, x2: 0.70, y2: 0.42 };
  assert.deepEqual(clampPatchOffFaces(patch, core, [inside], head), patch);
});

test('a face wholly outside the hull is cleared to its own far edge, as under R27', () => {
  const far = { x1: 0.20, y1: 0.15, x2: 0.40, y2: 0.42 }; // centre 0.30 < core.x1
  const out = clampPatchOffFaces(patch, core, [far], head);
  assert.equal(out.x1, 0.40, 'min(face.x2, floor) = 0.40 whichever floor applies');
});

test('the head is the floor even when the face centre is just outside the hull (183.8s)', () => {
  // Redmi, 183.8s: her hull started at 0.452, his face box ran 0.386-0.509
  // (centre 0.4475, 0.005 outside the hull), her head box 0.578-0.658.
  const p = { x1: 0.422, y1: 0.288, x2: 0.882, y2: 1.0 };
  const c = { x1: 0.452, y1: 0.296, x2: 0.785, y2: 0.613 };
  const h = { x1: 0.578, y1: 0.375, x2: 0.658, y2: 0.518 };
  const his = { x1: 0.386, y1: 0.194, x2: 0.509, y2: 0.413 };
  assert.equal(clampPatchOffFaces(p, c, [his]).x1, 0.452, 'hull floor alone: 0.03 of relief, cheek still covered');
  assert.equal(clampPatchOffFaces(p, c, [his], h).x1, 0.509, 'head floor: his whole face is free');
});

test('mirror: a cleared face to the RIGHT travels the right edge to the head', () => {
  const p = { x1: 0.0, y1: 0.0, x2: 0.7, y2: 1.0 };
  const c = { x1: 0.02, y1: 0.05, x2: 0.65, y2: 1.0 };
  const h = { x1: 0.15, y1: 0.12, x2: 0.32, y2: 0.45 };
  const face = { x1: 0.40, y1: 0.15, x2: 0.60, y2: 0.42 }; // centre 0.50, inside core, right of head
  const out = clampPatchOffFaces(p, c, [face], h);
  assert.equal(out.x2, 0.40, 'max(face.x1, head.x2) = 0.40');
  assert.equal(out.x1, p.x1);
});
