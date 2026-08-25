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

test('parsePersons: leg keypoints DO extend the patch (cover them fully)', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.2, 0.4, 0.5, 0.6, 0.6);
  upperBody(data, 0, 0.5, 0.25, 0.05);
  setKp(data, 0, 15, 0.9, 0.5, 0.9); // ankle below the model box
  const p = parsePersons(data)[0];
  assert.ok(p.y2 > 0.9, 'the patch must reach the feet, got ' + p.y2);
});

test('parsePersons: legs do NOT count as person evidence', () => {
  // Score passes and five confident LEG keypoints exist, but nothing
  // above the waist: still not a person.
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.1, 0.1, 0.9, 0.9, 0.6);
  for (let i = 13; i <= 16; i++) setKp(data, 0, i, 0.7 + i * 0.01, 0.5, 0.9);
  setKp(data, 0, 9, 0.6, 0.4, 0.9);
  assert.equal(parsePersons(data).length, 0);
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
  assert.ok(area < 0.55, 'crowd patch must not swallow the frame, got ' + area);
  assert.ok(region.y2 > 0.6, 'should reach well below the face for the body');
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

test('parsePersons: a full-height subject keeps a full-height patch', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.05, 0.4, 0.98, 0.6, 0.8);
  upperBody(data, 0, 0.5, 0.12, 0.05);
  setKp(data, 0, 11, 0.55, 0.45, 0.9);
  setKp(data, 0, 12, 0.55, 0.55, 0.9);
  const p = parsePersons(data, undefined, 16 / 9)[0];
  assert.ok(p.y2 > 0.95, 'covered people are covered to the feet, got ' + p.y2);
});

test('parsePersons: a low-scoring slot with a strong skeleton is still a person', () => {
  // Gauntlet R5, runs/r5c-man slot probe: on every zero-person wide
  // pass, slot 0 returned 0.24-0.35 with 10-11 of 13 confident keypoints
  // and a 0.30 box - the speaker in full view, discarded by the score
  // floor alone, while the audience went undetected and he was the only
  // one we could have covered. Noise slots scored ~0 with 0-4 keypoints.
  const strong = new Float32Array(6 * 56);
  for (let k = 0; k < 13; k++) {
    strong[k * 3] = 0.3 + k * 0.02;   // y
    strong[k * 3 + 1] = 0.4;          // x
    strong[k * 3 + 2] = 0.8;          // confident
  }
  strong[51] = 0.3; strong[52] = 0.3; strong[53] = 0.6; strong[54] = 0.5;
  strong[55] = 0.24;                  // below PERSON_MIN_SCORE 0.35
  assert.equal(parsePersons(strong).length, 1, 'strong skeleton must survive a low score');

  // Same low score, noise-level skeleton: still rejected.
  const noise = new Float32Array(6 * 56);
  for (let k = 0; k < 3; k++) {
    noise[k * 3 + 2] = 0.8;
  }
  noise[51] = 0.3; noise[52] = 0.3; noise[53] = 0.6; noise[54] = 0.5;
  noise[55] = 0.24;
  assert.equal(parsePersons(noise).length, 0, 'a weak skeleton at a low score stays out');
});

test('parsePersons: a low-scoring slot that claims most of the frame is noise', () => {
  // r5d f003: strong-skeleton admission also let in a slot whose
  // keypoints were scattered across the stage, unioning to 79% of the
  // frame and rendering as a near-full-frame blur. A person that large
  // is MoveNet's easiest case and would never score 0.14.
  const sprawl = new Float32Array(6 * 56);
  for (let k = 0; k < 13; k++) {
    sprawl[k * 3] = k % 2 ? 0.05 : 0.95;      // y alternating top/bottom
    sprawl[k * 3 + 1] = k % 3 ? 0.02 : 0.96;  // x alternating left/right
    sprawl[k * 3 + 2] = 0.8;
  }
  // MoveNet's own box is small; the keypoints disagree with it wildly.
  sprawl[51] = 0.40; sprawl[52] = 0.40; sprawl[53] = 0.60; sprawl[54] = 0.55;
  sprawl[55] = 0.14;
  assert.equal(parsePersons(sprawl).length, 0, 'sprawling low-score slot must be rejected');

  // A big, COHERENT low-score person (wide shot, keypoints inside the
  // model box) must still get in — that is the whole point of the tier.
  const coherent = new Float32Array(6 * 56);
  for (let k = 0; k < 13; k++) {
    coherent[k * 3] = 0.35 + (k / 13) * 0.5;
    coherent[k * 3 + 1] = 0.45 + (k % 2) * 0.05;
    coherent[k * 3 + 2] = 0.8;
  }
  coherent[51] = 0.30; coherent[52] = 0.40; coherent[53] = 0.90; coherent[54] = 0.55;
  coherent[55] = 0.14;
  assert.equal(parsePersons(coherent).length, 1, 'coherent low-score person is kept');
});

// The keypoint cushion is a DISTANCE, and normalized coordinates are not
// isotropic — it shipped unscaled in y, so a raised hand and the crown of
// a head got 1.78x less real cushion than an outstretched arm. Asserted as
// a SYMMETRY (square frame => square cushion) plus a direction, so the
// test survives a change to KEYPOINT_MARGIN or PATCH_MARGIN.
test('keypoint margin is isotropic in real pixels, not in normalized units', () => {
  // Square box, torso well inside it, and one wrist exactly on the
  // top-left corner: that wrist is then the ONLY keypoint that can push
  // the union outward, so the extension it produces IS the margin.
  const build = () => {
    const data = new Float32Array(6 * 56);
    setBox(data, 0, 0.3, 0.3, 0.7, 0.7, 0.9);
    upperBody(data, 0, 0.5, 0.45, 0.05);
    setKp(data, 0, 9, 0.3, 0.3, 0.9);
    return data;
  };
  const ext = (ar) => {
    const [p] = parsePersons(build(), 0.1, ar);
    assert.ok(p, 'setup: the slot must be accepted as a person');
    return { dx: 0.3 - p.x1, dy: 0.3 - p.y1 };
  };

  const square = ext(1);
  assert.ok(
    Math.abs(square.dy - square.dx) < 1e-6,
    `on a square frame the cushion must be square: dx ${square.dx}, dy ${square.dy}`,
  );

  const wide = ext(16 / 9);
  assert.ok(wide.dx > 0 && wide.dy > 0, 'the union must extend past the keypoint in both axes');
  assert.ok(
    // Not the full 1.78: PATCH_MARGIN is applied afterwards as a
    // fraction of the (now taller) box, which dilutes the ratio to ~1.49.
    wide.dy / wide.dx > 1.4,
    `on 16:9 the vertical cushion must grow with the aspect ratio, got ${(wide.dy / wide.dx).toFixed(3)}`,
  );
  assert.ok(
    wide.dy > square.dy,
    'the fix must ADD vertical cushion on a wide frame, not redistribute it',
  );
});
