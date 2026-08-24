// Person-gate pure logic (owner "humanoid" ask 2026-08-24): MoveNet
// person boxes gate ambiguous face candidates and cover backside views.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePersons,
  gateDetections,
  facelessPersons,
  PERSON_MIN_SCORE,
  PERSON_GATE_BYPASS_CONFIDENCE,
  personCropRegion,
  mapCropBoxToFrame,
  centerInAny,
} from '../src/person-gate.mjs';

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

const person = { y1: 0.1, x1: 0.3, y2: 0.7, x2: 0.6, confidence: 0.5 };

test('gate: ambiguous candidate outside every person region drops', () => {
  const graphic = { box: { x1: 0.8, y1: 0.8, x2: 0.9, y2: 0.9, confidence: 0.4 }, flagged: true, certain: false };
  assert.equal(gateDetections([graphic], [person]).length, 0);
});

test('gate: ambiguous candidate inside a person region survives', () => {
  const face = { box: { x1: 0.4, y1: 0.15, x2: 0.5, y2: 0.3, confidence: 0.4 }, flagged: true, certain: false };
  assert.equal(gateDetections([face], [person]).length, 1);
});

test('gate: certain flags and strong detections bypass even outside persons', () => {
  const certain = { box: { x1: 0.8, y1: 0.8, x2: 0.9, y2: 0.9, confidence: 0.4 }, flagged: true, certain: true };
  const strong = {
    box: { x1: 0.8, y1: 0.8, x2: 0.9, y2: 0.9, confidence: PERSON_GATE_BYPASS_CONFIDENCE },
    flagged: true,
    certain: false,
  };
  const cleared = { box: { x1: 0.8, y1: 0.1, x2: 0.9, y2: 0.2, confidence: 0.3 }, flagged: false, certain: true };
  assert.equal(gateDetections([certain, strong, cleared], [person]).length, 3);
});

test('gate: null persons (model not run) drops nothing; empty array is real evidence', () => {
  const graphic = { box: { x1: 0.8, y1: 0.8, x2: 0.9, y2: 0.9, confidence: 0.4 }, flagged: true, certain: false };
  assert.equal(gateDetections([graphic], null).length, 1);
  assert.equal(gateDetections([graphic], []).length, 0);
});

test('faceless: person with no face and no track is returned (backside)', () => {
  const out = facelessPersons([person], [], []);
  assert.equal(out.length, 1);
  assert.equal(out[0], person);
});

test('faceless: a face candidate or an existing track inside the region owns it', () => {
  const face = { x1: 0.4, y1: 0.15, x2: 0.5, y2: 0.3 };
  assert.equal(facelessPersons([person], [face], []).length, 0);
  assert.equal(facelessPersons([person], [], [face]).length, 0);
});

test('mapCropBoxToFrame: crop-space box lands at the right full-frame spot', () => {
  const region = { x1: 0.2, y1: 0.4, x2: 0.6, y2: 0.8 };
  const b = mapCropBoxToFrame(region, { x1: 0.25, y1: 0.5, x2: 0.75, y2: 1, confidence: 0.9 });
  assert.ok(Math.abs(b.x1 - 0.3) < 1e-9);
  assert.ok(Math.abs(b.y1 - 0.6) < 1e-9);
  assert.ok(Math.abs(b.x2 - 0.5) < 1e-9);
  assert.ok(Math.abs(b.y2 - 0.8) < 1e-9);
  assert.equal(b.confidence, 0.9);
});

test('personCropRegion pads and clamps; centerInAny agrees with it', () => {
  const region = personCropRegion({ x1: 0.3, y1: 0.1, x2: 0.6, y2: 0.7 });
  assert.ok(region.x1 < 0.3 && region.x2 > 0.6);
  assert.ok(centerInAny({ x1: 0.4, y1: 0.3, x2: 0.5, y2: 0.4 }, [region]));
  assert.ok(!centerInAny({ x1: 0.85, y1: 0.85, x2: 0.95, y2: 0.95 }, [region]));
});
