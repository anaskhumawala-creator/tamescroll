// MoveNet output parsing + person-crop geometry (person-primary
// pipeline, redesign 2026-08-24; evidence gate + aspect-correct head
// anchor 2026-08-25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePersons,
  personCropRegion,
  personFromFace,
  PERSON_MIN_SCORE,
} from '../src/person-gate.mjs';

// Keypoint layout: 17 x [y, x, score] then y1,x1,y2,x2,score.
function setKp(data, slot, idx, y, x, s) {
  const o = slot * 56 + idx * 3;
  data[o] = y;
  data[o + 1] = x;
  data[o + 2] = s;
}
function setBox(data, slot, y1, x1, y2, x2, score) {
  const o = slot * 56;
  data[o + 51] = y1;
  data[o + 52] = x1;
  data[o + 53] = y2;
  data[o + 54] = x2;
  data[o + 55] = score;
}
// A believable upper body: nose, both eyes, both ears, both shoulders.
function upperBody(data, slot, cx, cy, headW) {
  setKp(data, slot, 0, cy, cx, 0.9); // nose
  setKp(data, slot, 1, cy - 0.01, cx - headW * 0.2, 0.9); // left eye
  setKp(data, slot, 2, cy - 0.01, cx + headW * 0.2, 0.9); // right eye
  setKp(data, slot, 3, cy, cx - headW / 2, 0.9); // left ear
  setKp(data, slot, 4, cy, cx + headW / 2, 0.9); // right ear
  setKp(data, slot, 5, cy + 0.15, cx - headW, 0.9); // left shoulder
  setKp(data, slot, 6, cy + 0.15, cx + headW, 0.9); // right shoulder
}

test('parsePersons: keeps a real person, drops a low-scoring slot', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.1, 0.2, 0.6, 0.4, 0.5);
  upperBody(data, 0, 0.3, 0.2, 0.05);
  setBox(data, 1, 0, 0, 0, 0, 0.05);
  const out = parsePersons(data);
  assert.equal(out.length, 1);
  assert.ok(out[0].confidence >= PERSON_MIN_SCORE);
});

test('parsePersons: a slot with too few keypoints is NOT a person (phantom gate)', () => {
  // Score passes, but only two scattered keypoints — the hand/desk
  // close-up case that produced frame-sized phantom patches.
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.1, 0.1, 0.9, 0.9, 0.6);
  setKp(data, 0, 9, 0.5, 0.5, 0.8); // a wrist
  setKp(data, 0, 10, 0.6, 0.7, 0.7); // another wrist
  assert.equal(parsePersons(data).length, 0);
});

test('parsePersons: keypoints without a head OR both shoulders are rejected', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.1, 0.1, 0.9, 0.9, 0.6);
  // Six confident lower/arm keypoints, no head, only ONE shoulder.
  setKp(data, 0, 5, 0.4, 0.3, 0.8);
  for (let i = 7; i <= 11; i++) setKp(data, 0, i, 0.5 + i * 0.01, 0.4, 0.8);
  assert.equal(parsePersons(data).length, 0);
});

test('parsePersons: leg keypoints never extend the patch', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.2, 0.4, 0.5, 0.6, 0.6);
  upperBody(data, 0, 0.5, 0.25, 0.05);
  // A hallucinated ankle at the frame floor must be ignored (13-16).
  setKp(data, 0, 15, 0.98, 0.5, 0.9);
  setKp(data, 0, 16, 0.99, 0.55, 0.9);
  const p = parsePersons(data)[0];
  assert.ok(p.y2 < 0.9, 'ankle must not drag the patch to the floor: ' + p.y2);
});

test('parsePersons: wrists DO extend the patch (hands must be covered)', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.2, 0.4, 0.8, 0.6, 0.5);
  upperBody(data, 0, 0.5, 0.25, 0.05);
  setKp(data, 0, 10, 0.5, 0.75, 0.9); // right wrist, outside the box
  const p = parsePersons(data)[0];
  assert.ok(p.x2 > 0.75);
});

test('parsePersons: head anchor uses the frame aspect for its vertical margin', () => {
  const data = new Float32Array(6 * 56);
  // Torso box that crops the head off at y=0.3.
  setBox(data, 0, 0.3, 0.4, 0.8, 0.6, 0.9);
  upperBody(data, 0, 0.5, 0.26, 0.08); // ear span 0.08 -> headW 0.08
  const wide = parsePersons(data, undefined, 16 / 9)[0];
  const square = parsePersons(data, undefined, 1)[0];
  // headH = headW * aspect, so a 16:9 frame reserves MORE normalized-y.
  assert.ok(wide.y1 < square.y1);
  assert.ok(wide.y1 <= 0.26 - 0.08 * (16 / 9) * 1.1 + 1e-6);
  // Sides still cover the head width.
  assert.ok(wide.x1 <= 0.5 - 0.08 * 1.2 + 1e-6);
  assert.ok(wide.x2 >= 0.5 + 0.08 * 1.2 - 1e-6);
  assert.equal(typeof wide.headX, 'number');
});

test('personFromFace: face -> head+upper-torso region, not a full-frame patch', () => {
  const region = personFromFace({ x1: 0.4, y1: 0.1, x2: 0.5, y2: 0.24, confidence: 0.9 });
  const area = (region.x2 - region.x1) * (region.y2 - region.y1);
  assert.ok(area < 0.2, 'crowd patch must stay small, got ' + area);
  assert.ok(region.y2 > 0.24, 'should reach below the face for the torso');
  assert.equal(region.fromFace, true);
  assert.ok(Math.abs(region.headX - 0.45) < 1e-6);
});

test('personCropRegion: pads the person box, clamped to the frame', () => {
  const region = personCropRegion({ x1: 0.3, y1: 0.1, x2: 0.6, y2: 0.7 });
  assert.ok(region.x1 < 0.3 && region.x2 > 0.6);
  assert.ok(region.y1 < 0.1 && region.y2 > 0.7);
  const edge = personCropRegion({ x1: 0.0, y1: 0.0, x2: 0.5, y2: 1.0 });
  assert.equal(edge.x1, 0);
  assert.equal(edge.y1, 0);
  assert.equal(edge.y2, 1);
});
