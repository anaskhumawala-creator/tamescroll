// THE PERSON PASS IS 63% OF A VERDICT AND SOMETIMES FINDS NOBODY.
//
// MEASURED on real hardware for the first time (M2010J19SI, Snapdragon
// 662, WebView 151, 2026-08-31): passP50 506ms inside a verdictP50 of
// 798ms, with all twelve diagnostic slots reading n:0. The owner's
// report is the same number from the other side: "so much more snappier
// and instantaneous ... our app was missing a lot of frames that should
// have been blurred."
//
// Skipping it is only safe because a skipped pass is INERT. These tests
// pin that, because the failure direction of getting it wrong is an
// uncovered person, not a wasted millisecond.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../src/worker-entry.js', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/worker-client.mjs', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

test('the worker skips the person pass only when the page asks', () => {
  assert.match(worker, /var wantPersons = msg\.withPersons !== false;/);
  // Absent flag must mean "run it" -- an older page must not silently
  // lose the person pass.
  assert.match(client, /withPersons: withPersons !== false/);
});

test('a skipped pass is inert, never "nobody is there"', () => {
  // The ghost gate refuses an uncorroborated face on
  // `length === 0 && noHumanShape === true`. A skipped pass reports
  // noHumanShape false, so the face fallback keeps covering.
  assert.match(worker, /noHumanShape: person \? !!persons\.noHumanShape : false/);
  assert.match(worker, /personsSkipped: !person/);
  assert.match(page, /var noShape = persons\.length === 0 && persons\.noHumanShape === true;/);
});









test('both pass paths honour the decision', () => {
  // The worker path and the in-page fallback. A skip on one and not the
  // other is how a fix ships half-applied.
  assert.match(page, /videoFrame\(bmp, aspect, heldPersons, withFaces, askPersons\)/);
  assert.match(page, /askPersons\s*\?\s*detector\.detectPersons\(/);
});

test('the person model runs on EVERY pass again', () => {
  // 1068-1070 skipped it after three empty passes. The cadence numbers
  // were real and the owner still reported the only thing that counts:
  // "it's not blurring the female". A pass the model never ran reports
  // an empty person list to the tracker and the eraser, and no held flag
  // fixes that -- one of the two directions is always wrong, and one of
  // them is an exposure.
  assert.match(page, /function wantPersons\(\) \{[^}]*return true;[^}]*\}/);
  assert.ok(!/PERSON_SKIP_EVERY/.test(page), 'the skip constants are gone');
  assert.ok(!/personEmptyStreak/.test(page), 'the streak is gone');
});

