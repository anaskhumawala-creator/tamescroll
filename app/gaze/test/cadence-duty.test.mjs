// VERDICT_DUTY WAS A LOCAL VAR IN init-entry.js, OFF THE OTA CHANNEL.
//
// latency-restructure Task 3 (2026-09-02): the multiplier effZoom uses
// on the last pass's own cost -- min(VERDICT_MAX_INTERVAL_MS,
// max(ZOOM_INTERVAL_MS, lastVerdictMs * VERDICT_DUTY)) -- shipped at a
// flat 4 that nobody could move without a 56MB install. 4x was
// calibrated for a device that was CAP-limited (both duty-table arms in
// cadence.mjs pin at VERDICT_MAX_INTERVAL_MS regardless of pass cost),
// so lowering pass cost alone could never move the clock. Now that
// person-skip and the position-pass gate cut the Redmi's verdict cost,
// 2x lands inside the cap instead of being clamped away by it -- but
// only if the value actually lives on the module cadence.mjs reads at
// every use, the same way VERDICT_MAX_INTERVAL_MS already does.
//
// A local copy taken at attachVideo time would freeze whatever the
// value was when THIS video was attached, so a pushed number would
// apply to the next video and not this one -- the silent half-applied
// state the tuning channel must never produce (see the comment beside
// VERDICT_MAX_INTERVAL_MS's own read in init-entry.js). This is the
// structural half of that guarantee: no local declaration, and the
// claim site reads the module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyTuning } from '../src/tuning.mjs';
import * as cadence from '../src/cadence.mjs';

const restore = () => applyTuning({ VERDICT_DUTY: cadence.VERDICT_DUTY === 2 ? 2 : 2 });

test('init-entry.js declares no local VERDICT_DUTY and reads the module at the claim site', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  // Comments mentioning the name are fine (there is a whole paragraph
  // above zoomBudget explaining the duty trade); a DECLARATION is not.
  // `var VERDICT_DUTY =` is the exact shape the old local copy took, and
  // is also what a re-introduced closure copy would look like.
  assert.doesNotMatch(src, /\bvar VERDICT_DUTY\s*=/,
    'VERDICT_DUTY must live in cadence.mjs, not as a per-video closure copy');
  // The use site: effZoom's own max() term, reading the module the same
  // way VERDICT_MAX_INTERVAL_MS is read a few lines above it.
  assert.match(src, /lastVerdictMs \* cadence\.VERDICT_DUTY/,
    'the claim site must read cadence.VERDICT_DUTY, not a bare identifier');
});

test('cadence.mjs exports the duty and a setter, at the shipped value', () => {
  assert.equal(cadence.VERDICT_DUTY, 2, 'shipped value, latency-restructure Task 3');
  assert.equal(typeof cadence.setVerdictDuty, 'function');
  cadence.setVerdictDuty(3);
  assert.equal(cadence.VERDICT_DUTY, 3);
  cadence.setVerdictDuty(2);
  assert.equal(cadence.VERDICT_DUTY, 2);
});

test('the tuning whitelist clamps VERDICT_DUTY into [1.5, 4]', () => {
  // Below 1.5 the GPU spends more of every second on verdicts than it
  // has free -- the same duty problem VERDICT_MAX_INTERVAL_MS's own
  // floor exists to avoid.
  applyTuning({ VERDICT_DUTY: 1.0 });
  assert.equal(cadence.VERDICT_DUTY, 1.5, 'clamped up to the floor');

  // The ceiling is the value this constant shipped at before it was
  // ever tunable -- the range brackets what has already run in
  // production rather than exceeding it.
  applyTuning({ VERDICT_DUTY: 9 });
  assert.equal(cadence.VERDICT_DUTY, 4, 'clamped down to the ceiling');

  applyTuning({ VERDICT_DUTY: 2.5 });
  assert.equal(cadence.VERDICT_DUTY, 2.5, 'an in-range push is not touched');

  restore();
  assert.equal(cadence.VERDICT_DUTY, 2);
});

test('rules/tuning.json ships VERDICT_DUTY at 2, agreeing with the code', () => {
  const shipped = JSON.parse(
    readFileSync(new URL('../../../rules/tuning.json', import.meta.url), 'utf8'),
  );
  assert.equal(shipped.VERDICT_DUTY, 2);
  assert.equal(shipped.VERDICT_DUTY, cadence.VERDICT_DUTY,
    'the file we ship must agree with the module default, or the OTA ' +
    'silently reverts the constant the moment it lands on a device that ' +
    'was never tuned away from it');
});
