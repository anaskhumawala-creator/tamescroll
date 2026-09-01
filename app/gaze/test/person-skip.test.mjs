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
import {
  wantPersons,
  notePersons,
  resetPersonSkip,
  setPersonSkipEvery,
  PERSON_EMPTY_STREAK,
} from '../src/person-skip.mjs';

const worker = readFileSync(new URL('../src/worker-entry.js', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/worker-client.mjs', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

// The policy is pure arithmetic in its own module, so RUN it rather than
// asserting on its text. A string match would pass against a policy that
// skips every pass, which is the failure that matters.
function fresh(every) {
  resetPersonSkip();
  setPersonSkipEvery(every);
}

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

test('IT SHIPS INERT: the default never skips a pass', () => {
  // The whole reason the mechanism can sit in a build at all.
  // PERSON_SKIP_EVERY rides the OTA tuning channel, so a build carrying
  // it must behave exactly like the build before it until a number is
  // deliberately pushed. Its cost is PHANTOM -- his "random blur marks
  // here and there" -- so it has to be reversible in seconds, not in a
  // release.
  // BOTH SOURCES OF THE VALUE, because they can disagree and only one of
  // them decides what a device with no rules cache runs. This checked
  // only tuning.json, so `PERSON_SKIP_EVERY = 3` in the module left this
  // file fully green -- the test named for the inert default did not
  // test the default.
  // FROM THE DECLARATION, not from the live binding: setPersonSkipEvery
  // mutates the export and the tests above it do exactly that, so an
  // imported value says what the last test left behind, not what ships.
  const src = readFileSync(new URL('../src/person-skip.mjs', import.meta.url), 'utf8');
  assert.match(src, /^export var PERSON_SKIP_EVERY = 1;/m,
    'the MODULE default is what a device with no rules cache runs, and a '
    + 'build must behave like the one before it until a number is pushed');
  const shipped = JSON.parse(
    readFileSync(new URL('../../../rules/tuning.json', import.meta.url), 'utf8'),
  );
  assert.equal(shipped.PERSON_SKIP_EVERY, 1, 'the shipped value must be the off value');
  fresh(shipped.PERSON_SKIP_EVERY);
  for (let i = 0; i < 20; i++) {
    assert.equal(wantPersons(), true, 'pass ' + i + ' must run the model');
    notePersons([], false);
  }
});

test('the model runs every pass until it has admitted nobody three times', () => {
  fresh(3);
  assert.equal(PERSON_EMPTY_STREAK, 3);
  assert.equal(wantPersons(), true);
  for (let i = 0; i < 2; i++) {
    notePersons([], false);
    assert.equal(wantPersons(), true, 'still asked after ' + (i + 1) + ' empty passes');
  }
  notePersons([], false);
  assert.equal(wantPersons(), false, 'backs off on the third');
});

test('one admitted person resets it instantly', () => {
  fresh(3);
  for (let i = 0; i < 5; i++) notePersons([], false);
  assert.equal(wantPersons(), false);
  // On footage where MoveNet works, this whole mechanism is inert.
  notePersons([{ x1: 0, y1: 0, x2: 1, y2: 1 }], false);
  assert.equal(wantPersons(), true);
  notePersons([{ x1: 0, y1: 0, x2: 1, y2: 1 }], false);
  assert.equal(wantPersons(), true);
});

test('backed off, it still runs one pass in three -- never none', () => {
  fresh(3);
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

test('a fresh video starts from an unbacked-off state', () => {
  // A backed-off run surviving a navigation would carry "MoveNet finds
  // nobody on this footage" into footage where it does.
  fresh(3);
  for (let i = 0; i < 5; i++) notePersons([], false);
  assert.equal(wantPersons(), false);
  resetPersonSkip();
  assert.equal(wantPersons(), true);
});

test('the page reads the policy from the module, not from a copy', () => {
  // An inline duplicate is how the crop-geometry defect lived four days
  // across three model swaps.
  assert.match(page, /from '\.\/person-skip\.mjs'/);
  assert.match(page, /var askPersons = wantPersons\(\);/);
  assert.match(page, /notePersons\(/);
});

test('a new stream clears the back-off, through the shipped entry', () => {
  // NOT by calling resetPersonSkip directly -- that is what the previous
  // test did, and it passed for a fortnight against an init-entry that
  // imported the function and never called it, so the reset was
  // tree-shaken out of the emitted bundle entirely. A behaviour test
  // that does not run the path the defect lives in is not evidence.
  //
  // The path is init-entry's `loadstart` handler, so this asserts on the
  // SOURCE of that handler: the reset has to be inside the per-video
  // reset block, beside the other stale-per-stream state.
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const i = src.indexOf("video.addEventListener('loadstart'");
  assert.ok(i > 0, 'the loadstart handler moved -- re-anchor this test');
  const handler = src.slice(i, src.indexOf('passEpoch++', i));
  assert.match(handler, /resetPersonSkip\(\)/,
    'the person-skip back-off is per-stream evidence and must be cleared '
    + 'on loadstart, or a new video inherits the last one\'s emptiness');
});

test('the back-off actually decays once reset', () => {
  // The property the source check above cannot give: that calling it
  // puts the module back in the never-skip state.
  setPersonSkipEvery(3);
  for (let i = 0; i < 10; i++) notePersons([], false);   // drive it into back-off
  assert.equal(wantPersons(), false, 'precondition: it must be skipping');
  resetPersonSkip();
  assert.equal(wantPersons(), true, 'a reset stream must run the model again');
  setPersonSkipEvery(1);
});
