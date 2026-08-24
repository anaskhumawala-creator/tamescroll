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
