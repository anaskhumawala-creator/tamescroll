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

// ---------------------------------------------------------------------
// THE WIRING. init-entry.js is a browser bundle entry and cannot be
// imported here, so these read its source -- the same technique the
// repo already uses for the eraser counters. Both assertions slice to a
// MARKER rather than a fixed character window: a fixed slice stopped
// covering the block it was written for twice in this repo once the
// comments above it grew, and an assertion that has drifted out of its
// own window passes forever.
import { readFileSync } from 'node:fs';
const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

test('the observation builder emits `signal` -- the field-drop failure', () => {
  // init-entry warns about this twice in its own comments: R12 shipped
  // `abstained` in gender-verdict AND person-track and forgot the one
  // line in this builder, so the consumer was unreachable for two
  // releases and every unit test passed, because they hand observations
  // straight to updatePersonTracks and never cross this boundary.
  const a = page.indexOf('nullMint: !!mine.nullRead,');
  const b = page.indexOf('desc: faceDesc,', a);
  assert.ok(a > 0 && b > a, 'the observation return block moved -- fix the markers');
  const block = page.slice(a, b);
  assert.match(block, /signal:\s*hasDescriptorSignal\(/,
    'the observation must carry `signal`, or clampBodies can never push an edge');
});

test('the clamp runs BEFORE the tracker, not after', () => {
  // updatePersonTracks dedupes internally (person-track.mjs), so the
  // clamp has to be a property of the box that enters the merge. Called
  // afterwards it would narrow a box the tracker had already used, and
  // every measurement behind it would be describing something else.
  const clamp = page.indexOf('clampBodies(observations');
  const track = page.indexOf('updatePersonTracks(videoTracks, observations');
  assert.ok(clamp > 0, 'clampBodies is not called from the video pass at all');
  assert.ok(track > 0, 'the updatePersonTracks call site moved -- fix the marker');
  assert.ok(clamp < track, 'clampBodies must run before updatePersonTracks');
});

test("the clamp counter does not collide with the geometry clamp's", () => {
  // region-blur already ships `clampFired` / `clampNoLegalEdge` /
  // `clampNoCore` for the PATCH-geometry clamp. Two unrelated events in
  // one counter silently rebases every reading any earlier round has
  // quoted of it, and the only place that is visible is the emitted
  // bundle.
  const a = page.indexOf('clampBodies(observations');
  const b = page.indexOf('updatePersonTracks(videoTracks, observations', a);
  const block = page.slice(a, b);
  assert.match(block, /bumpLife\('bodyClampFired'\)/);
  assert.ok(!/bumpLife\('clampFired'\)/.test(block),
    "the body clamp must not bump the geometry clamp's counter");
});

test('`signal` is read from a binding the observation builder can SEE', () => {
  // SHIPPED BROKEN IN 1080 AND CAUGHT ON A DEVICE, not by the suite.
  // `genders` is the parameter of the classifyBest .then, and that
  // callback CLOSES before the `metaP.then` that builds the
  // observation -- siblings, not nested. So `hasDescriptorSignal(
  // genders[own])` was a ReferenceError on EVERY read: observeThrew 84
  // on 84 reads, the chain rejected, the pass dropped, and every face
  // failed closed to covered. A correctly cleared man, blurred.
  //
  // 461 tests were green throughout, because none of them cross this
  // boundary -- they hand observations straight to updatePersonTracks.
  // So the assertion has to be structural: the identifier used at the
  // builder must be one that is in scope there.
  const a = page.indexOf('nullMint: !!mine.nullRead,');
  const b = page.indexOf('desc: faceDesc,', a);
  const block = page.slice(a, b);
  const m = block.match(/signal:\s*hasDescriptorSignal\(([^)]*)\)/);
  assert.ok(m, 'the observation must carry `signal`');
  assert.ok(!/genders/.test(m[1]),
    '`genders` is out of scope in the observation builder -- ' +
    'reading it there is a ReferenceError that drops the whole pass');
  // ...and the binding it DOES use must be assigned outside that closure.
  assert.match(page, /var genderReads = null;/);
  assert.match(page, /genderReads = genders;/);
});
