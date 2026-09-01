import test from 'node:test';
import assert from 'node:assert';
import { clampAway, clampBodies, BODY_CLAMP_PAD } from '../src/body-clamp.mjs';
import { hasDescriptorSignal, NULL_MINT_NM_FLOOR } from '../src/gender-verdict.mjs';

// A synthetic body as personFromFace builds one: wide enough to swallow
// the neighbour, carrying the frame-space face it came from.
function body(faceCx, opts) {
  const o = opts || {};
  const h = 0.10, w = 0.06;
  const face = { x1: faceCx - w / 2, x2: faceCx + w / 2, y1: 0.20, y2: 0.20 + h };
  return {
    box: {
      x1: faceCx - 0.30, x2: faceCx + 0.30, y1: 0.06, y2: 0.80,
      fromFace: true, faceBox: face,
    },
    face,
    flagged: o.flagged !== false,
    signal: o.signal !== false,
  };
}

test('the edge stops short of a cleared face beside the subject', () => {
  const her = body(0.35);
  const him = body(0.60, { flagged: false });
  const out = clampBodies([her, him], 0.02);
  // Her patch reached 0.65 and swallowed his face at 0.67-0.73.
  assert.ok(her.box.x2 > him.box.faceBox.x1, 'fixture must actually overlap');
  assert.ok(out[0].box.x2 <= him.box.faceBox.x1 - 0.02 + 1e-9,
    `right edge ${out[0].box.x2} did not stop short of ${him.box.faceBox.x1}`);
  assert.strictEqual(out[0].box.x1, her.box.x1, 'the far edge must not move');
});

test('nothing moves when nobody is cleared beside the subject', () => {
  const her = body(0.35);
  const other = body(0.60);            // also flagged
  assert.ok(her.box.x2 > other.box.faceBox.x1, 'fixture must actually overlap');
  const out = clampBodies([her, other], 0.02);
  assert.strictEqual(out[0], her, 'unchanged observations pass through by reference');
  assert.strictEqual(out[1], other);
});

test('a cleared face with no descriptor signal may never push an edge', () => {
  // The RcGyVTAoXEU backdrop graphic: reads clear, carries the model's
  // prior, and would otherwise pull the speaker's patch off her side.
  const her = body(0.35);
  const graphic = body(0.60, { flagged: false, signal: false });
  assert.ok(her.box.x2 > graphic.box.faceBox.x1, 'fixture must actually overlap');
  const out = clampBodies([her, graphic], 0.02);
  assert.strictEqual(out[0], her, 'a graphic pushed a real subject\'s patch edge');
});

test('the edge never passes the subject\'s own face', () => {
  // He is cleared and standing where her face is -- the accepted cost.
  const her = body(0.50);
  const him = { ...body(0.50, { flagged: false }) };
  him.box = { ...him.box, faceBox: { x1: 0.44, x2: 0.50, y1: 0.20, y2: 0.30 } };
  const out = clampBodies([her, him], 0.02);
  assert.ok(out[0].box.x1 <= her.box.faceBox.x1 + 1e-9,
    'clamped past her own face: ' + out[0].box.x1 + ' > ' + her.box.faceBox.x1);
});

test('a face outside the patch vertical band cannot push an edge', () => {
  const her = body(0.35);
  const him = body(0.60, { flagged: false });
  him.box = { ...him.box, faceBox: { x1: 0.57, x2: 0.63, y1: 0.90, y2: 0.99 } };
  const out = clampBodies([her, him], 0.02);
  assert.strictEqual(out[0], her, 'a face below the patch pushed its edge');
});

test('a MEASURED body is never clamped -- only extrapolated ones', () => {
  const her = body(0.35);
  her.box = { ...her.box, fromFace: false };   // MoveNet admitted her
  const him = body(0.60, { flagged: false });
  assert.ok(her.box.x2 > him.box.faceBox.x1, 'fixture must actually overlap');
  const out = clampBodies([her, him], 0.02);
  assert.strictEqual(out[0], her, 'narrowed a body MoveNet actually measured');
});

test('the clamp copies, it never mutates the box it was handed', () => {
  const her = body(0.35);
  const him = body(0.60, { flagged: false });
  const before = her.box.x2;
  const out = clampBodies([her, him], 0.02);
  assert.strictEqual(her.box.x2, before, 'mutated the caller\'s box in place');
  assert.notStrictEqual(out[0].box, her.box);
  assert.strictEqual(out[0].box.fromFace, true, 'lost a box field in the copy');
  assert.ok(out[0].box.faceBox, 'lost faceBox in the copy');
});

test('the clamp preserves every observation field but the box', () => {
  const her = body(0.35);
  her.verdictDt = 1450; her.certain = true; her.nullMint = false;
  const out = clampBodies([her, body(0.60, { flagged: false })], 0.02);
  assert.notStrictEqual(out[0], her, 'fixture did not clamp -- the rest is vacuous');
  assert.strictEqual(out[0].verdictDt, 1450);
  assert.strictEqual(out[0].certain, true);
  assert.strictEqual(out[0].nullMint, false);
  assert.strictEqual(out[0].flagged, true);
});

test('clampAway returns the same object when no edge moves', () => {
  const b = { x1: 0.1, x2: 0.2, y1: 0.1, y2: 0.9 };
  const f = { x1: 0.14, x2: 0.16, y1: 0.1, y2: 0.2 };
  assert.strictEqual(clampAway(b, f, [{ x1: 0.8, x2: 0.9, y1: 0.1, y2: 0.2 }], 0.02), b);
});

test('hasDescriptorSignal is the MIRROR of the mint floor, and refuses on missing nm', () => {
  assert.strictEqual(hasDescriptorSignal({ shape: { norm: NULL_MINT_NM_FLOOR } }), true);
  assert.strictEqual(hasDescriptorSignal({ shape: { norm: NULL_MINT_NM_FLOOR - 0.01 } }), false);
  // The asymmetry that matters: no evidence means "may not push", where
  // for minting it means "may mint".
  assert.strictEqual(hasDescriptorSignal({}), false);
  assert.strictEqual(hasDescriptorSignal({ shape: {} }), false);
  assert.strictEqual(hasDescriptorSignal({ shape: { norm: NaN } }), false);
  assert.strictEqual(hasDescriptorSignal(null), false);
});

test('BODY_CLAMP_PAD is the value the corpus was scored at', () => {
  assert.strictEqual(BODY_CLAMP_PAD, 0.02);
});
