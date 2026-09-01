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
const START = '>>> PERSON-SKIP POLICY (person-skip.test.mjs runs this block)';
const END = '<<< PERSON-SKIP POLICY';

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

test('a skipped pass can never report an empty frame', () => {
  // THIS IS THE LINE 1070 GOT WRONG, and the only reason that revert
  // was necessary. There, a skipped pass contributed
  // `persons.length === 0` to emptyFrame; emptyStreak climbed on passes
  // that had looked at nothing, wipeIfEmpty fired, and the owner
  // reported "it's not blurring the female". The eraser may only ever
  // act on evidence a pass actually gathered.
  assert.match(page, /emptyFrame = !persons\.skipped[\s\S]{0,40}persons\.length === 0 && faceEvidence === 0;/);
  // ...which needs the flag to survive both pass paths.
  assert.match(page, /persons\.skipped = !!r\.personsSkipped;/);
  assert.match(page, /if \(!askPersons\) persons\.skipped = true;/);
});

// The policy is pure arithmetic, so run the SHIPPED text rather than
// asserting on it. A string match here would pass against a policy that
// skips every pass, which is the failure that matters.
function policy() {
  // Sliced to a MARKER, never a fixed length -- a fixed window stops
  // covering the block the moment a comment grows, which has cost this
  // repo two rounds.
  const a = page.indexOf(START), b = page.indexOf(END);
  const m = a >= 0 && b > a ? [null, page.slice(a + START.length, b)] : null;
  assert.ok(m, 'could not find the skip policy block');
  // The slice ends on a dangling line comment, so the appended return
  // needs its own line or it is commented out.
  return new Function(m[1] + '\n; return { wantPersons, notePersons };')();
}

test('the model runs every pass until it has admitted nobody three times', () => {
  const { wantPersons, notePersons } = policy();
  assert.equal(wantPersons(), true);
  for (let i = 0; i < 2; i++) {
    notePersons([], false);
    assert.equal(wantPersons(), true, 'still asked after ' + (i + 1) + ' empty passes');
  }
  notePersons([], false);
  assert.equal(wantPersons(), false, 'backs off on the third');
});

test('one admitted person resets it instantly', () => {
  const { wantPersons, notePersons } = policy();
  for (let i = 0; i < 5; i++) notePersons([], false);
  assert.equal(wantPersons(), false);
  // On footage where MoveNet works, this whole mechanism is inert.
  notePersons([{ x1: 0, y1: 0, x2: 1, y2: 1 }], false);
  assert.equal(wantPersons(), true);
  notePersons([{ x1: 0, y1: 0, x2: 1, y2: 1 }], false);
  assert.equal(wantPersons(), true);
});

test('backed off, it still runs one pass in three -- never none', () => {
  const { wantPersons, notePersons } = policy();
  for (let i = 0; i < 3; i++) notePersons([], false);
  // A model that is never asked again can never notice a person walking
  // into frame, and the streak would never reset.
  const ran = [];
  for (let i = 0; i < 12; i++) {
    const ask = wantPersons();
    ran.push(ask);
    notePersons(ask ? [] : null, !ask);
  }
  const n = ran.filter(Boolean).length;
  assert.equal(n, 4, 'ran ' + n + ' of 12 passes, expected one in three');
  // and never two real passes back to back
  for (let i = 1; i < ran.length; i++)
    assert.ok(!(ran[i] && ran[i - 1]), 'two consecutive real passes at ' + i);
});
