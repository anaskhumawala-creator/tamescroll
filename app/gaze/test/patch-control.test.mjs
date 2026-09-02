// THE SWEEP INSTRUMENT'S CONTROL POINT, PINNED.
//
// `bench/_patch.mjs` rewrites a named constant out of the built bundle so
// an arm can sweep it. Its contract has two halves and only one of them
// had ever been checked:
//
//   1. A name that is gone must THROW. This is what caught three benches
//      that had been exiting on their own guard since loop 39 -- they
//      patched the literal `0.6` and 0.45 shipped, so they swept nothing.
//   2. Patching a constant to its OWN shipped value is the control point
//      of every sweep. `_patch.mjs` claimed that produces a byte-identical
//      source; for `PTRACK_MAX_COAST_MS` it does not, because esbuild
//      writes 2000 as `2e3` (phase-D D7). Number-identical, not
//      byte-identical, and the difference is a trap for the next sweep
//      that picks such a constant as its control.
//
// The bundle is a build artifact, so this test SKIPS when it is absent
// rather than failing -- a missing bundle is a stale checkout, not a
// regression. Run `node bench/_build.mjs` to make it.
import { test, skip } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  readConst, patchConsts, controlIsByteIdentical,
} from '../bench/_patch.mjs';

const P = new URL('../bench/.cache/shipped.mjs', import.meta.url);
const src = fs.existsSync(P) ? fs.readFileSync(P, 'utf8') : null;

test('a constant that is gone throws instead of sweeping nothing', () => {
  if (!src) return skip('bench/.cache/shipped.mjs not built');
  assert.throws(() => readConst(src, 'NOT_A_REAL_CONSTANT_XYZ'), /no 'var/);
  assert.throws(() => patchConsts(src, { NOT_A_REAL_CONSTANT_XYZ: 1 }), /no 'var/);
});

test('the control point is NUMBER-identical for every swept constant', () => {
  if (!src) return skip('bench/.cache/shipped.mjs not built');
  // Every constant any live bench sweeps. Re-writing one at its own
  // value must leave the constant reading the same number.
  for (const name of [
    'GENDER_CLEAR_SCORE',
    'GENDER_CLEAR_SCORE_FEMALE',
    'PTRACK_MIN_COAST_PASSES',
    'PTRACK_MAX_COAST_MS',
  ]) {
    const was = readConst(src, name);
    const out = patchConsts(src, { [name]: was });
    assert.equal(readConst(out, name), was,
      `${name}: the control point must not change the value`);
  }
});

test('and it is BYTE-identical only for plain decimal literals', () => {
  if (!src) return skip('bench/.cache/shipped.mjs not built');
  // The two constants tonight's sweeps use really are byte-identical, so
  // their `=== src` self-checks are sound.
  assert.equal(controlIsByteIdentical(src, 'GENDER_CLEAR_SCORE'), true);
  assert.equal(controlIsByteIdentical(src, 'PTRACK_MIN_COAST_PASSES'), true);
  // And the one _patch.mjs's own comment names is not, which is the
  // whole point of writing this down. If esbuild ever stops emitting
  // `2e3` this goes red and the comment above it should be corrected.
  assert.equal(controlIsByteIdentical(src, 'PTRACK_MAX_COAST_MS'), false,
    'esbuild writes 2000 as 2e3; a byte-identity contract is false here');
});
