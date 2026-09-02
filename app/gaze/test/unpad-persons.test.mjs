// THE INVERSE OF THE LETTERBOX. If this is wrong, every person box on
// every YouTube video lands in the wrong place -- which is strictly
// worse than the squash it replaces, because a squash at least puts the
// patch on the right person while reading them distorted.
//
// So the property tested is the ROUND TRIP against `fitBox` itself,
// rather than against numbers written down here: forward and inverse
// share one source of truth and cannot drift apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unpadPersons, parsePersons } from '../src/person-gate.mjs';
import { fitBox } from '../src/crop-geometry.mjs';

const SIZE = 256;
const SLOT = 56;

// One MoveNet output buffer: 6 slots x 56 floats.
function buf() {
  return new Float32Array(6 * SLOT);
}

// Put a keypoint or box coordinate into MODEL space: where does a point
// at frame-normalized (fx, fy) land on the padded canvas?
function toModel(fit, fx, fy) {
  return {
    x: (fit.dx + fx * fit.dw) / SIZE,
    y: (fit.dy + fy * fit.dh) / SIZE,
  };
}

test('a keypoint round-trips through the pad exactly', () => {
  const fit = fitBox(640, 360, SIZE);
  // Precondition, or the whole test is about the identity case: a 16:9
  // frame in a square really is letterboxed.
  assert.ok(fit.dy > 0 && fit.dx === 0, 'precondition: vertical bars');

  const d = buf();
  const want = [
    [0.0, 0.0], [1.0, 1.0], [0.5, 0.5], [0.25, 0.8], [0.9, 0.1],
  ];
  want.forEach(([fx, fy], i) => {
    const m = toModel(fit, fx, fy);
    d[i * 3] = m.y;
    d[i * 3 + 1] = m.x;
    d[i * 3 + 2] = 0.9;
  });

  const out = unpadPersons(d, fit, SIZE);
  want.forEach(([fx, fy], i) => {
    assert.ok(Math.abs(out[i * 3] - fy) < 1e-6, `y${i}`);
    assert.ok(Math.abs(out[i * 3 + 1] - fx) < 1e-6, `x${i}`);
  });
});

test('the untouched axis is left exactly alone', () => {
  // On a 16:9 frame the WIDTH fills the square, so x must come back
  // bit-identical. A fix that quietly rescales the good axis too would
  // still round-trip in the test above, because the error cancels.
  const fit = fitBox(640, 360, SIZE);
  const d = buf();
  for (let i = 0; i < 17; i++) d[i * 3 + 1] = i / 17;
  // Compared against the STORED value, not the literal: the buffer is a
  // Float32Array, so `i / 17` is already rounded on the way in and a
  // comparison against the double fails on rounding rather than on
  // anything the function did.
  const before = Float32Array.from(d);
  const out = unpadPersons(d, fit, SIZE);
  for (let i = 0; i < 17; i++) {
    assert.equal(out[i * 3 + 1], before[i * 3 + 1], `x${i} moved on the filling axis`);
  }
});

test('the squash it replaces really did read 1.78x wrong', () => {
  // An executable statement of the defect: with no inverse map, a point
  // at the vertical middle of the PICTURE reads as 0.5 of the CANVAS,
  // and on 16:9 those are 0.28 apart -- most of a head.
  const fit = fitBox(640, 360, SIZE);
  const mid = toModel(fit, 0.5, 0.9);
  assert.ok(Math.abs(mid.y - 0.9) > 0.15,
    'raw model y is far from frame y, which is the whole bug');
  const d = buf();
  d[0] = mid.y;
  d[1] = mid.x;
  assert.ok(Math.abs(unpadPersons(d, fit, SIZE)[0] - 0.9) < 1e-6);
});

test('the score column is never touched, on any slot', () => {
  // 55 is the slot score and 3i+2 are keypoint scores. Rewriting one as
  // if it were a coordinate is the exact bug this function exists to
  // make impossible, and it would read as a confidence change rather
  // than a geometry one -- which is far harder to see.
  const fit = fitBox(640, 360, SIZE);
  const d = buf();
  for (let p = 0; p < 6; p++) {
    d[p * SLOT + 55] = 0.1 + p * 0.1;
    for (let i = 0; i < 17; i++) d[p * SLOT + i * 3 + 2] = 0.42;
  }
  const before = Float32Array.from(d);
  const out = unpadPersons(d, fit, SIZE);
  for (let p = 0; p < 6; p++) {
    assert.equal(out[p * SLOT + 55], before[p * SLOT + 55], `slot ${p} score`);
    for (let i = 0; i < 17; i++) {
      assert.equal(out[p * SLOT + i * 3 + 2], before[p * SLOT + i * 3 + 2],
        `slot ${p} kp ${i} score`);
    }
  }
});

test('all six slots are mapped, not just the first', () => {
  const fit = fitBox(640, 360, SIZE);
  const m = toModel(fit, 0.3, 0.7);
  const d = buf();
  for (let p = 0; p < 6; p++) {
    d[p * SLOT + 51] = m.y;
    d[p * SLOT + 52] = m.x;
    d[p * SLOT + 53] = m.y;
    d[p * SLOT + 54] = m.x;
  }
  const out = unpadPersons(d, fit, SIZE);
  for (let p = 0; p < 6; p++) {
    assert.ok(Math.abs(out[p * SLOT + 51] - 0.7) < 1e-6, `slot ${p} ymin`);
    assert.ok(Math.abs(out[p * SLOT + 52] - 0.3) < 1e-6, `slot ${p} xmin`);
    assert.ok(Math.abs(out[p * SLOT + 53] - 0.7) < 1e-6, `slot ${p} ymax`);
    assert.ok(Math.abs(out[p * SLOT + 54] - 0.3) < 1e-6, `slot ${p} xmax`);
  }
});

test('a portrait frame is the mirror case', () => {
  const fit = fitBox(360, 640, SIZE);
  assert.ok(fit.dx > 0 && fit.dy === 0, 'precondition: horizontal bars');
  const m = toModel(fit, 0.2, 0.6);
  const d = buf();
  d[0] = m.y;
  d[1] = m.x;
  const out = unpadPersons(d, fit, SIZE);
  assert.ok(Math.abs(out[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(out[1] - 0.2) < 1e-6);
});

test('a square frame is the identity, and the SAME buffer comes back', () => {
  // Cheap, but the point is stronger than that: returning the input
  // unchanged means an unpadded path cannot be told from a padded one
  // that happened to need no padding, which is correct -- they are the
  // same picture.
  const fit = fitBox(512, 512, SIZE);
  const d = buf();
  d[0] = 0.33;
  assert.equal(unpadPersons(d, fit, SIZE), d);
});

test('a degenerate fit is refused rather than dividing by zero', () => {
  // Called mid-layout a video reports 0x0, and fitBox falls back to
  // filling. NaN coordinates here would put a box everywhere or nowhere
  // on arithmetic alone -- the failure `squareBox` already guards on the
  // crop path.
  const d = buf();
  d[0] = 0.4;
  const kept = d[0]; // Float32, not the double literal
  for (const fit of [fitBox(0, 0, SIZE), null, { dx: 0, dy: 0, dw: 0, dh: 0 }]) {
    const out = unpadPersons(d, fit, SIZE);
    assert.equal(out[0], kept);
    assert.ok(Number.isFinite(out[0]));
  }
  assert.equal(unpadPersons(d, fitBox(640, 360, SIZE), 0)[0], kept, 'size 0');
});

test('the BOX is clamped into frame, because every consumer needs 0..1', () => {
  const fit = fitBox(640, 360, SIZE);
  const d = buf();
  d[51] = 0.01; // ymin, up in the top black bar
  d[53] = 0.99; // ymax, down in the bottom one
  const out = unpadPersons(d, fit, SIZE);
  assert.equal(out[51], 0);
  assert.equal(out[53], 1);
});

test('a KEYPOINT is not clamped, because clamping one UNCOVERS a head', () => {
  // THE FIRST VERSION OF THIS FUNCTION CLAMPED KEYPOINTS and it was an
  // exposure. `parsePersons` consumes them as DIFFERENCES -- headW is
  // |lEar.x - rEar.x|, and headH = headW * ar sets the patch's TOP edge
  // through HEAD_ANCHOR_UP -- and a difference of clamped values is
  // monotonically SMALLER. So clamping shrinks the head anchor and
  // RAISES the top edge: hair and crown left sharp, the exact class
  // HEAD_ANCHOR_UP 1.1 -> 1.6 was raised for.
  //
  // Pillars, not bars, so the axis a width is taken along is the padded
  // one -- which is the case the shipped 16:9 regime does NOT exercise
  // and the flag exists to allow.
  const fit = fitBox(360, 640, SIZE);
  assert.ok(fit.dx > 0, 'precondition: the padded axis is x');
  const d = buf();
  const inBar = -0.05; // left of the picture, in the pillar
  d[3 * 3 + 1] = inBar; // an ear regressed into the bar
  d[4 * 3 + 1] = 0.9;
  const out = unpadPersons(d, fit, SIZE);
  const wantX = (inBar - fit.dx / SIZE) / (fit.dw / SIZE);
  assert.ok(wantX < 0, 'precondition: it maps outside the frame');
  assert.ok(Math.abs(out[3 * 3 + 1] - wantX) < 1e-6,
    'the ear keeps its true offset, so the width it feeds stays true');
  // And the property that actually matters, stated as a width:
  const clampedW = Math.abs(1 * 0 - (out[4 * 3 + 1]));
  const trueW = Math.abs(out[3 * 3 + 1] - out[4 * 3 + 1]);
  assert.ok(trueW > clampedW,
    'clamping would have shrunk this width, which raises the patch top');
});

test('the head anchor survives the map, measured through parsePersons', () => {
  // The class-level version of the test above: the pure function is
  // faithful AND the thing downstream of it produces the same head. Run
  // against a clamping variant this goes red on `top`.
  const fit = fitBox(360, 640, SIZE);
  const AR = 360 / 640;
  const d = buf();
  const put = (i, fx, fy, s) => {
    const m = toModel(fit, fx, fy);
    d[i * 3] = m.y;
    d[i * 3 + 1] = m.x;
    d[i * 3 + 2] = s;
  };
  // A subject at the left edge, one ear regressed past it.
  put(0, 0.06, 0.50, 0.9);
  put(1, 0.03, 0.49, 0.85);
  put(2, 0.10, 0.49, 0.85);
  put(3, -0.02, 0.49, 0.80);
  put(4, 0.16, 0.49, 0.80);
  put(5, -0.02, 0.62, 0.80);
  put(6, 0.24, 0.62, 0.80);
  // One ear regressed WELL into the pillar -- a raw model x of 0.02
  // where the pillar runs to 0.219. That is the case the critic
  // measured; a keypoint a hair outside the frame moves nothing, which
  // is why the first version of this test passed against the defect.
  d[3 * 3 + 1] = 0.02;
  const a = toModel(fit, 0, 0.45);
  const b = toModel(fit, 0.30, 0.95);
  d[51] = a.y; d[52] = a.x; d[53] = b.y; d[54] = b.x; d[55] = 0.9;

  // BOTH ARMS, IN THE TEST. Asserting an absolute threshold on the
  // shipped arm alone pins whatever this fixture happens to produce; the
  // property is a COMPARISON, so both arms are built here and the
  // clamping one is the defect written out.
  const clampVariant = (src) => {
    const o = new Float32Array(src.length);
    o.set(src);
    const ox = fit.dx / SIZE, oy = fit.dy / SIZE;
    const sx = fit.dw / SIZE, sy = fit.dh / SIZE;
    const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    for (let p = 0; p < 6; p++) {
      const bo = p * SLOT;
      for (let i = 0; i < 17; i++) {
        o[bo + i * 3] = cl((src[bo + i * 3] - oy) / sy);
        o[bo + i * 3 + 1] = cl((src[bo + i * 3 + 1] - ox) / sx);
      }
      o[bo + 51] = cl((src[bo + 51] - oy) / sy);
      o[bo + 52] = cl((src[bo + 52] - ox) / sx);
      o[bo + 53] = cl((src[bo + 53] - oy) / sy);
      o[bo + 54] = cl((src[bo + 54] - ox) / sx);
    }
    return o;
  };

  const ship = parsePersons(unpadPersons(Float32Array.from(d), fit, SIZE), undefined, AR, null)[0];
  const clamped = parsePersons(clampVariant(d), undefined, AR, null)[0];
  assert.ok(ship && clamped, 'precondition: both arms admit the slot');
  assert.ok(ship.headW > clamped.headW + 0.05,
    `headW ${ship.headW} vs clamped ${clamped.headW} -- the shrink is the defect`);
  assert.ok(ship.y1 < clamped.y1 - 0.05,
    `top ${ship.y1} vs clamped ${clamped.y1} -- clamping drops the patch off the crown`);
});

test('parsePersons reads the mapped buffer and puts the box in frame space', () => {
  // The class-level check: the pure function is correct AND the thing
  // downstream of it agrees. `assign-wired` exists for the same reason --
  // a unit test one layer above the defect has passed against broken
  // code in this repo before (loop 37c).
  const fit = fitBox(640, 360, SIZE);
  const d = buf();
  // A person filling the lower half of the PICTURE, head keypoints and
  // both shoulders confident so the anchor gate admits the slot.
  const put = (i, fx, fy) => {
    const m = toModel(fit, fx, fy);
    d[i * 3] = m.y;
    d[i * 3 + 1] = m.x;
    d[i * 3 + 2] = 0.8;
  };
  put(0, 0.50, 0.55); // nose
  put(1, 0.47, 0.53); // l eye
  put(2, 0.53, 0.53); // r eye
  put(5, 0.42, 0.65); // l shoulder
  put(6, 0.58, 0.65); // r shoulder
  const bb = [toModel(fit, 0.40, 0.50), toModel(fit, 0.60, 0.98)];
  d[51] = bb[0].y;
  d[52] = bb[0].x;
  d[53] = bb[1].y;
  d[54] = bb[1].x;
  d[55] = 0.9;

  const raw = parsePersons(d, undefined, 640 / 360, null);
  const mapped = parsePersons(unpadPersons(d, fit, SIZE), undefined, 640 / 360, null);
  assert.equal(mapped.length, 1, 'precondition: the mapped slot is admitted');
  // The unmapped read puts the subject too high AND too short, because
  // the picture occupies the middle 56% of the canvas.
  if (raw.length) {
    assert.ok(raw[0].y2 < mapped[0].y2 - 0.05,
      'the squashed read stops well short of where the person actually ends');
  }
  assert.ok(mapped[0].y2 > 0.9, 'the mapped box reaches the bottom of the frame');
});

test('the flag ships OFF, and the squash arm is bit-identical', () => {
  // A default nobody measured does not get to be the default, in either
  // direction. The letterbox is a MEASURED +22.8% in admissions (findings
  // 16b) and the geometry fix above is correct -- but the entire labelled
  // corpus was banked against squashed person extents, so flipping this
  // moves the placement layer under every exposure, false-cover and
  // phantom number the repo owns at once. The flag exists so both arms
  // run on one build; it flips when the corpus has been re-scored.
  const src = readFileSync(new URL('../src/detector.js', import.meta.url), 'utf8');
  assert.match(src, /export var PERSON_LETTERBOX = false;/);
  // And OFF must mean the OLD PATH EXACTLY, not a differently-spelled
  // equivalent: `unpadPersons` returns the input buffer untouched for a
  // null fit, and the resize falls through to the square.
  assert.match(src, /unpadPersons\(data, lbFit, PERSON_INPUT_SIZE\)/);
  assert.match(src, /if \(PERSON_LETTERBOX\) \{/);
  const d = buf();
  d[0] = 0.7;
  assert.equal(unpadPersons(d, null, 256), d, 'a null fit is the identity');
});
