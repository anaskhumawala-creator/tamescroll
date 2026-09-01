// The landmark geometry is a MEASUREMENT, not a gate -- these tests pin
// that it measures what it says and that it cannot throw on the shapes a
// real detector produces (missing landmarks, a collapsed regression, a
// face at the frame edge). A NaN reaching the diagnostic ring would fail
// the report invariant and take the whole artifact with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markShape, markRing } from '../src/face-marks.mjs';

// An upright face: eyes level, nose below and centred, mouth lower,
// ears outside the eyes.
function upright() {
  return {
    x1: 0.3, y1: 0.3, x2: 0.5, y2: 0.5,
    marks: [
      0.37, 0.37, // right eye
      0.43, 0.37, // left eye
      0.40, 0.41, // nose
      0.40, 0.45, // mouth
      0.33, 0.38, // right ear
      0.47, 0.38, // left ear
    ],
  };
}

test('an upright face measures like one', () => {
  const s = markShape(upright());
  assert.equal(s.degenerate, 0);
  assert.ok(s.mouthDrop > s.noseDrop, 'the mouth must sit below the nose');
  assert.ok(s.noseDrop > 0, 'the nose must sit below the eye line');
  assert.ok(s.earSpan > 1, 'ears sit outside the eyes');
  assert.ok(s.tilt < 1, 'a level eye line is ~0 degrees');
  assert.ok(s.asym < 0.1, 'the nose is on the midline');
  assert.equal(s.inBox, 1);
  assert.ok(Math.abs(s.eyeSpan - 0.3) < 1e-6, 'eye span is a fraction of box width');
});

test('the measurement is scale free and rotation aware', () => {
  const a = markShape(upright());
  // Same face, twice the size, moved: every ratio must be unchanged.
  const big = upright();
  big.x1 = 0.0; big.y1 = 0.0; big.x2 = 0.4; big.y2 = 0.4;
  big.marks = upright().marks.map((v) => (v - 0.3) * 2);
  const b = markShape(big);
  for (const k of ['eyeSpan', 'mouthDrop', 'noseDrop', 'earSpan', 'asym', 'spread']) {
    assert.ok(Math.abs(a[k] - b[k]) < 1e-6, k + ' moved with scale: ' + a[k] + ' vs ' + b[k]);
  }
});

test('a rotated face keeps its mouth below its eyes', () => {
  // 90 degrees: the eye line is vertical. `below` is measured
  // perpendicular to the eye line, so the mouth must STILL read below --
  // a box-relative measurement would report it sideways.
  const f = { x1: 0, y1: 0, x2: 1, y2: 1,
    marks: [0.5, 0.4, 0.5, 0.6, 0.46, 0.5, 0.42, 0.5, 0.51, 0.36, 0.51, 0.64] };
  const s = markShape(f);
  assert.ok(s.mouthDrop > 0, 'mouth below the eye line under rotation');
  assert.ok(s.mouthDrop > s.noseDrop);
  assert.ok(s.tilt > 80 && s.tilt <= 90, 'tilt reports the rotation: ' + s.tilt);
});

test('a collapsed regression reports itself instead of dividing by zero', () => {
  const f = { x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2, marks: new Array(12).fill(0.15) };
  const s = markShape(f);
  assert.equal(s.degenerate, 1);
  for (const k of Object.keys(s)) {
    assert.ok(isFinite(s[k]), k + ' is not finite on a collapsed regression');
  }
});

test('no landmarks means no measurement, never a guess', () => {
  assert.equal(markShape(null), null);
  assert.equal(markShape({ x1: 0, y1: 0, x2: 1, y2: 1 }), null);
  assert.equal(markShape({ x1: 0, y1: 0, x2: 1, y2: 1, marks: [1, 2, 3] }), null);
  // A synthetic body carries no landmarks and must not fabricate any.
  assert.equal(markShape({ x1: 0, y1: 0, x2: 1, y2: 1, marks: new Array(12).fill(NaN) }), null);
  assert.equal(markRing(null), null);
});

test('the ring is all-numeric and rounded to 3dp', () => {
  const r = markRing(markShape(upright()));
  for (const k of Object.keys(r)) {
    assert.equal(typeof r[k], 'number', k + ' is not a number');
    assert.ok(isFinite(r[k]), k + ' is not finite');
    // 3dp, deliberately: PFF_FRAME_KP_FLOOR was calibrated against a
    // 2dp ring and the real separator was 0.098 vs 0.101.
    assert.equal(Math.round(r[k] * 1000) / 1000, r[k], k + ' carries more than 3dp');
  }
});

test('points outside the box are counted, not clamped', () => {
  const f = upright();
  f.marks[8] = 0.05; // right ear far outside
  f.marks[10] = 0.95; // left ear far outside
  const s = markShape(f);
  assert.ok(Math.abs(s.inBox - 4 / 6) < 1e-9, 'inBox must fall to 4 of 6');
  assert.ok(s.spread > 1, 'spread must grow with the outliers');
});
