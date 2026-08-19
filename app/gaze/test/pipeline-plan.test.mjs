// Compulsory tier (handoff decision #1, owner-confirmed 2026-08-19):
// NSFW-flagged media is REMOVED from view in EVERY gaze mode — the
// pipeline boots even when blur is Off. Blur-first still holds where
// the static sheet doesn't already cover (INSTANT rule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planForMode } from '../src/pipeline-plan.mjs';

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
