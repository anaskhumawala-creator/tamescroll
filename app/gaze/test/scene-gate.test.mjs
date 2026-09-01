// Scene gate math (blur v2 Stage 1). The thresholds are calibrated
// constants — these tests pin the CLASSIFICATION behaviour so a knob
// tweak that inverts a band fails loudly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lumaGrid,
  meanAbsDelta,
  classifyScene,
  CUT_DELTA,
  STATIC_DELTA,
} from '../src/scene-gate.mjs';

function rgbaFill(count, r, g, b) {
  var d = new Uint8ClampedArray(count * 4);
  for (var i = 0; i < count; i++) {
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  return d;
}

test('lumaGrid: averages RGB per pixel', () => {
  var grid = lumaGrid(rgbaFill(4, 30, 60, 90), 4);
  assert.equal(grid.length, 4);
  assert.equal(grid[0], 60);
});

test('meanAbsDelta: zero for identical grids, exact for uniform shift', () => {
  var a = lumaGrid(rgbaFill(16, 100, 100, 100), 16);
  var b = lumaGrid(rgbaFill(16, 140, 140, 140), 16);
  assert.equal(meanAbsDelta(a, a), 0);
  assert.equal(meanAbsDelta(a, b), 40);
  assert.equal(meanAbsDelta(new Float32Array(0), new Float32Array(0)), 0);
});

test('classifyScene: static / motion / cut bands', () => {
  assert.equal(classifyScene(0), 'static');
  assert.equal(classifyScene(STATIC_DELTA), 'static');
  assert.equal(classifyScene(STATIC_DELTA + 1), 'motion');
  assert.equal(classifyScene(CUT_DELTA - 1), 'motion');
  assert.equal(classifyScene(CUT_DELTA), 'cut');
  assert.equal(classifyScene(100), 'cut');
});

test('a real cut-sized frame change classifies as cut, noise as static', () => {
  // Dark shot -> bright shot (a scene cut).
  var dark = lumaGrid(rgbaFill(256, 20, 20, 20), 256);
  var bright = lumaGrid(rgbaFill(256, 120, 130, 110), 256);
  assert.equal(classifyScene(meanAbsDelta(dark, bright)), 'cut');
  // Same shot with ±2 sensor noise.
  var noisy = lumaGrid(rgbaFill(256, 22, 21, 19), 256);
  assert.equal(classifyScene(meanAbsDelta(dark, noisy)), 'static');
});

// THE CUT THRESHOLD MUST CLEAR THE MOTION FLOOR.
//
// It was 28, which is the NINETIETH PERCENTILE of ordinary camera
// motion on the owner's own footage (600 live luma deltas: p50 8.7,
// p75 16.3, p90 28.2, p95 54.9). A threshold sitting on the noise floor
// fires on motion, and every false cut wipes a cleared man's clear --
// the "blur stays up longer" report. That half stands.
//
// THE UPPER BOUND DID NOT, AND IT COST A CORRECT CHANGE A REVERT.
// This test used to also assert `CUT_DELTA <= 54.9` on the reasoning
// that "above it real cuts get missed". 54.9 was the p95 of ALL deltas
// on one video -- 5% of ORDINARY samples are above it -- so it was never
// a measurement of where cuts start, and reading it as one is the
// circularity this repo has been caught by before.
//
// MEASURED PROPERLY (bench/cut-truth.mjs): ffmpeg's `scdet` filter as
// ground truth -- an independent instrument, its own colour space and
// its own algorithm, knowing nothing about our 16x16 luma grid -- over
// all ten corpus videos, 152,376 samples at the app's own 10Hz.
//
//   AT A REAL CUT   p05 0.0   p25 2.4   p50 50.1   p95 138.7
//   EVERYWHERE      p50 0.8   p90 6.9   p95 13.4   p99 51.4
//
//   threshold   real cuts caught   ordinary frames wiped
//   28          52.8%              4088
//   50          50.4%              1678
//   60          45.5%               739
//   75          42.3%               190
//   90          26.0%                60
//
// So the gate catches only about HALF of real cuts at ANY threshold --
// a cut between two similarly-lit shots is invisible to a 16x16 luma
// grid and always was. Recall barely moves between 28 and 75 (52.8% ->
// 42.3%) while false wipes fall 21x. There is no cliff up there to
// protect, which is what the old bound claimed.
//
// So this pins the PROPERTY that survives: above the motion floor, and
// not so high that the gate stops being a gate.
test('CUT_DELTA clears the measured motion floor', () => {
  const MOTION_P90 = 28.2;   // his phone, 600 samples, handheld vlog
  assert.ok(CUT_DELTA > MOTION_P90,
    `CUT_DELTA ${CUT_DELTA} is at or under the measured p90 of ordinary motion`);
});

test('CUT_DELTA still catches a substantial share of real cuts', () => {
  // The measured knee. Past 75 recall falls off a cliff (42.3% -> 26.0%
  // between 75 and 90) while there is almost nothing left to win: false
  // wipes are already down to 190. A gate that catches a quarter of cuts
  // is not a gate, and the stale-cleared-track exposure it exists to
  // stop comes back.
  assert.ok(CUT_DELTA <= 75,
    `CUT_DELTA ${CUT_DELTA} is past the measured knee -- cut recall falls ` +
    'off a cliff above 75 (42.3% -> 26.0%) for almost no further gain');
});
