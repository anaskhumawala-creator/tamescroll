// MoveNet output parsing + person-crop geometry (person-primary
// pipeline, redesign 2026-08-24).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePersons, personCropRegion, PERSON_MIN_SCORE } from '../src/person-gate.mjs';

function rawOutput(persons) {
  // Builds a flat [6*56] array from {y1,x1,y2,x2,score} specs.
  const data = new Float32Array(6 * 56);
  persons.forEach((p, i) => {
    const o = i * 56;
    data[o + 51] = p.y1;
    data[o + 52] = p.x1;
    data[o + 53] = p.y2;
    data[o + 54] = p.x2;
    data[o + 55] = p.score;
  });
  return data;
}

test('parsePersons: keeps scoring slots, drops the rest', () => {
  const data = rawOutput([
    { y1: 0.1, x1: 0.2, y2: 0.6, x2: 0.4, score: 0.5 },
    { y1: 0, x1: 0, y2: 0, x2: 0, score: 0.05 },
  ]);
  const out = parsePersons(data);
  assert.equal(out.length, 1);
  assert.ok(Math.abs(out[0].x1 - 0.2) < 1e-6); // Float32Array storage
  assert.ok(out[0].confidence >= PERSON_MIN_SCORE);
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
