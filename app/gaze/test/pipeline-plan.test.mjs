// Compulsory tier (handoff decision #1, owner-confirmed 2026-08-19):
// NSFW-flagged media is REMOVED from view in EVERY gaze mode — the
// pipeline boots even when blur is Off. Blur-first still holds where
// the static sheet doesn't already cover (INSTANT rule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planForMode, rotateBudget } from '../src/pipeline-plan.mjs';

test('smart runs everything and removes NSFW', () => {
  const p = planForMode('smart');
  assert.deepEqual(p, {
    boot: true,
    preBlur: true,
    textFilter: true,
    faceGender: true,
    nsfw: true,
    revealClears: true,
  });
});

test('off boots for the compulsory tier: pre-blur, text, NSFW-remove, no gender', () => {
  const p = planForMode('off');
  assert.equal(p.boot, true);
  assert.equal(p.preBlur, true, 'blur-first holds while NSFW check runs');
  assert.equal(p.faceGender, false, 'Off means no gender blur');
  assert.equal(p.textFilter, true, 'Filters pane promises cover on every platform');
  assert.equal(p.nsfw, true);
  assert.equal(p.revealClears, true, 'non-NSFW media must come back sharp');
});

test('blur-all only adds NSFW removal on top of the static sheet', () => {
  const p = planForMode('blur');
  assert.equal(p.boot, true);
  assert.equal(p.preBlur, false, 'Stage A sheet already blankets everything');
  assert.equal(p.faceGender, false);
  assert.equal(p.textFilter, false, 'a text hit adds nothing under blanket blur');
  assert.equal(p.nsfw, true);
  assert.equal(p.revealClears, false, 'never clear — the static sheet owns blur');
});

test('unknown mode never boots', () => {
  assert.equal(planForMode('').boot, false);
  assert.equal(planForMode(undefined).boot, false);
  assert.equal(planForMode('parental').boot, false);
});

// --- crop budget rotation (gauntlet R24) ------------------------------

test('below the budget nothing rotates — every small-cast round stays bit-identical', () => {
  const list = ['a', 'b', 'c'];
  const r = rotateBudget(list, 3, 7);
  assert.deepEqual(r.take, list);
  assert.deepEqual(r.rest, []);
  assert.equal(r.cursor, 7, 'the cursor must not move when nobody was starved');
});

test('a six-person stage reads EVERYONE within two passes', () => {
  // R24's actual cast, in slot-score order: three of them had never been
  // read in 15 seconds before this rotation existed.
  const cast = ['W1', 'speaker', 'W3', 'W4', 'M1', 'M2'];
  const p1 = rotateBudget(cast, 3, 0);
  const p2 = rotateBudget(cast, 3, p1.cursor);
  assert.deepEqual(p1.take, ['W1', 'speaker', 'W3']);
  assert.deepEqual(p2.take, ['W4', 'M1', 'M2']);
  const seen = new Set([...p1.take, ...p2.take]);
  assert.equal(seen.size, cast.length, 'nobody may be starved across a full turn');
});

test('the leftovers are exactly the members not taken — they still get tracked', () => {
  const cast = ['a', 'b', 'c', 'd', 'e'];
  const r = rotateBudget(cast, 2, 3);
  assert.deepEqual(r.take, ['d', 'e']);
  assert.deepEqual(r.rest, ['a', 'b', 'c']);
  assert.equal(r.take.length + r.rest.length, cast.length);
});

test('the window wraps, and a full turn of an odd cast still covers everyone', () => {
  const cast = ['a', 'b', 'c', 'd', 'e'];
  let cursor = 0;
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    const r = rotateBudget(cast, 3, cursor);
    r.take.forEach((m) => seen.add(m));
    cursor = r.cursor;
  }
  assert.equal(seen.size, 5, 'a budget that does not divide the cast must still reach everyone');
});

test('empty and degenerate inputs never throw and never invent a member', () => {
  assert.deepEqual(rotateBudget([], 3, 0).take, []);
  assert.deepEqual(rotateBudget(null, 3, 0).take, []);
  assert.deepEqual(rotateBudget(['a', 'b'], 0, 0).take, []);
  assert.deepEqual(rotateBudget(['a', 'b'], 0, 0).rest, ['a', 'b']);
});
