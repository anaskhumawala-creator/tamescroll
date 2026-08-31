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

test('a skipped pass never counts as evidence about the streak', () => {
  // Otherwise the streak feeds on itself and the person pass never
  // comes back.
  const i = page.indexOf('function notePersons(persons, skipped)');
  assert.ok(i > 0);
  const seg = page.slice(i, i + 700);
  const skipEnd = seg.indexOf('return;');
  assert.ok(skipEnd > 0, 'the skipped branch returns early');
  assert.ok(seg.indexOf('personEmptyStreak') > skipEnd, 'streak counters live after it');
});

test('a skipped pass INHERITS the last measured human-shape reading', () => {
  // MEASURED on his phone, 150s of one watch page: the ghost gate
  // refused 63 faces -- title cards and graphics that would each
  // otherwise become a patch. A skipped pass reporting "no evidence"
  // mints every one of them, and "random blur marks here and there" is
  // his complaint verbatim. So the skip carries the last real reading.
  assert.match(page, /var heldNoShape = false;/);
  assert.match(page, /if \(persons\) persons\.noHumanShape = heldNoShape;/);
  assert.match(page, /heldNoShape = !!\(persons && persons\.noHumanShape\);/);
});

test('a cut forces a real person pass, so a held reading cannot outlive its shot', () => {
  // A cut is exactly when someone new can walk into frame; carrying the
  // previous shot's "nothing human here" across one is an exposure.
  assert.match(page, /if \(lastCutAt > lastPersonAt\) return true;/);
  assert.match(page, /lastPersonAt = nowMsSafe\(\);/);
});

test('any admitted person restores every-pass cadence immediately', () => {
  assert.match(page, /if \(persons && persons\.length > 0\) personEmptyStreak = 0;/);
});

test('both pass paths honour the decision', () => {
  // The worker path and the in-page fallback. A skip on one and not the
  // other is how a fix ships half-applied.
  assert.match(page, /videoFrame\(bmp, aspect, heldPersons, withFaces, askPersons\)/);
  assert.match(page, /askPersons\s*\?\s*detector\.detectPersons\(/);
});

test('the skip is bounded and small', () => {
  const streak = /PERSON_EMPTY_STREAK = (\d+)/.exec(page);
  const every = /PERSON_SKIP_EVERY = (\d+)/.exec(page);
  assert.ok(streak && every, 'both constants are named, not inline numbers');
  assert.ok(Number(streak[1]) >= 2 && Number(streak[1]) <= 10, streak[1]);
  assert.ok(Number(every[1]) >= 2 && Number(every[1]) <= 5, every[1]);
});
