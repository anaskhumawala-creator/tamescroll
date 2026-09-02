import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ps from '../src/person-skip.mjs';

test('personsLive is true until PERSON_EMPTY_STREAK empty passes, then false, and one admitted person revives it', () => {
  ps.resetPersonSkip();
  assert.equal(ps.personsLive(), true);
  for (let i = 0; i < ps.PERSON_EMPTY_STREAK; i++) {
    assert.equal(ps.personsLive(), true, 'still live before the streak completes');
    ps.notePersons([], false);
  }
  assert.equal(ps.personsLive(), false, 'dead after the streak');
  ps.notePersons([], true); // a skipped pass is not evidence either way
  assert.equal(ps.personsLive(), false);
  ps.notePersons([{ x1: 0, y1: 0, x2: 1, y2: 1 }], false);
  assert.equal(ps.personsLive(), true, 'one admitted person revives');
  ps.resetPersonSkip();
});

// STRUCTURAL (phase-i critic I3). `personsLive` appears in exactly one
// OTHER test file, and it imports src/person-skip.mjs alone -- it never
// loads init-entry.js, so Task 1's whole gate (bumpLife +
// `sampling = false` + return) can be deleted from init-entry.js with
// the suite fully green. `sampling = false` is the line that matters
// most: without it a skipped pass never clears the in-flight flag and
// EVERY future pass on that video is refused forever -- a permanently
// frozen player, not a skipped frame. Comments stripped first (the same
// G9 shape phase-i I4 and person-skip.test.mjs's loadstart test guard
// against), and the whole gate matched as one ordered block so a
// reordering that separates the bump from the reset from the return
// cannot pass either.
test('init-entry.js gates the position pass on personsLive() inside sampleOnce, in order', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const wasVerdictDecl = src.indexOf('var wasVerdict = !verdictBusy');
  assert.ok(wasVerdictDecl > 0, 'the wasVerdict declaration moved -- re-anchor this test');
  const verdictBusyBlock = src.indexOf('if (wasVerdict) {', wasVerdictDecl);
  assert.ok(verdictBusyBlock > wasVerdictDecl, 'the verdictBusy block moved -- re-anchor this test');
  const region = src.slice(wasVerdictDecl, verdictBusyBlock)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(
    region,
    /if\s*\(isPlayer\s*&&\s*!wasVerdict\s*&&\s*!personsLive\(\)\)\s*\{\s*bumpLife\('positionPassSkipped'\);\s*sampling\s*=\s*false;\s*return;\s*\}/,
    'the position-pass skip gate must exist, in order (bump, then ' +
    '`sampling = false`, then return), inside sampleOnce, comments stripped',
  );
});

// A HELD "MoveNet ADMITS NOBODY" ANSWER MUST NOT OUTLIVE ITS SHOT
// (phase-i critic I10). PERSON_SKIP_EVERY backs the model off for up to
// PERSON_EMPTY_STREAK + (PERSON_SKIP_EVERY - 1) passes on old footage's
// evidence, and nothing in the cut branch (demoteTracks, heldPersons=[],
// passEpoch++) touched that independent cycle -- a cut into a shot with
// a faceless subject waited out the same backoff a static shot would,
// up to ~5.4s measured on the arm64 Redmi (MoveNet running once every
// ~5.4s once backed off). Anchored on the cut branch's own per-cut
// counter, the way person-skip.test.mjs anchors on the per-video
// loadstart reset; comments stripped for the same reason.
test('a scene cut forces ONE person look and keeps the back-off, through the shipped entry', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const i = src.indexOf("bumpLife('cutDetected')");
  assert.ok(i > 0, 'the cut branch moved -- re-anchor this test');
  const end = src.indexOf('passEpoch++;', i);
  assert.ok(end > i, 'the per-cut reset block moved -- re-anchor this test');
  const block = src.slice(i, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(block, /forcePersonLook\(\)/,
    'a scene cut must force a person look, or a held "nobody admitted" ' +
    'answer can outlive the shot it was measured in');
  // A RESET here ran MoveNet 3x as often on footage that cuts every ~5s
  // (stageB2 on the Redmi: personPassSkipped 89 -> 29, verdict gap
  // 1201 -> 2068ms). One look per cut, never the whole cycle.
  assert.doesNotMatch(block, /resetPersonSkip\(\)/,
    'a scene cut must not reset the whole back-off cycle');
});

// `lastPassMs` HAS EXACTLY ONE WRITE SITE (the position-pass branch of
// the `.finally` below), and Task 1's gate above stops that branch from
// ever running once personsLive() goes false -- so lastPassMs freezes at
// a race (0, if the back-off started before a position pass ever
// completed) instead of describing anything live (phase-i critic I11).
// The floor must fall back to the design ceiling explicitly rather than
// feeding that frozen value into the throttle arithmetic (`0 *
// POSITION_DUTY`, indistinguishable from "the last position pass was
// instant"). Comments stripped for the same G9 reason as the tests
// above.
test('effInterval falls back to POSITION_MAX_INTERVAL_MS, not a frozen lastPassMs, once positions are being skipped', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const declSite = src.indexOf('var effInterval = isPlayer');
  assert.ok(declSite > 0, 'the effInterval declaration moved -- re-anchor this test');
  const end = src.indexOf(': sampleInterval;', declSite);
  assert.ok(end > declSite, 'the effInterval declaration moved -- re-anchor this test');
  const region = src.slice(declSite, end + ': sampleInterval;'.length)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(
    region,
    /var effInterval = isPlayer\s*\?\s*\(personsLive\(\)\s*\?\s*Math\.min\(POSITION_MAX_INTERVAL_MS,\s*Math\.max\(floor\s*\/\s*rate,\s*lastPassMs\s*\*\s*POSITION_DUTY\)\)\s*:\s*POSITION_MAX_INTERVAL_MS\)\s*:\s*sampleInterval;/,
    'once personsLive() is false, effInterval must fall back to ' +
    'POSITION_MAX_INTERVAL_MS explicitly rather than deriving from a ' +
    'lastPassMs that can no longer be written',
  );
});

// THE CADENCE ROW HAS NEVER BANKED EITHER VALUE (phase-i critic I11's
// second half): a stale lastPassMs was unreadable from outside the
// engine. Both must reach the same diagnostic bag the coast/told numbers
// already ride (dbgC.tuning), numeric, seeded per pass.
test('the pass throttle banks lastPassMs and effInterval for the cadence probe to read', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const i = src.indexOf('if (wasVerdict) lastVerdictMs = cost;');
  assert.ok(i > 0, 'the cost-write site moved -- re-anchor this test');
  const end = src.indexOf('sampling = false;\r\n            });', i);
  assert.ok(end > i, 'the finally block end moved -- re-anchor this test');
  const region = src.slice(i, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(region, /dbgC\.tuning\.lastPassMs\s*=\s*lastPassMs;/);
  assert.match(region, /dbgC\.tuning\.effInterval\s*=\s*effInterval;/);
});
