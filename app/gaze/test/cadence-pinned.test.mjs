// THE DEFECT CLASS THAT PRODUCED FOUR WRONG TABLES, MADE LOUD.
//
// `makeArms`' replay derives the cadence it tells the tracker from
// `dt * stride` when the options carry no `fixedCadence`. On an
// unthinned window that is the 500ms BANK interval, and
// `setVerdictCadence(500)` derives a 1250ms coast -- while his phone is
// told 2000 and coasts 4000. Four published tables were measured that
// way (13a, critic-lowbar, 10g, 10h) and THREE OF THEM REVERSED when
// re-run in his regime.
//
// Roughly thirty benches in this directory still build their options by
// hand. Changing the default silently would make every number they have
// ever printed unreproducible with no warning, so the derivation stays
// and the SILENCE is what was removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  warnDerivedCadence, _resetCadenceWarning, HIS_EFFZOOM,
} from '../bench/arch-arms.mjs';

function capture(fn) {
  const orig = process.stderr.write;
  let out = '';
  process.stderr.write = (s) => { out += s; return true; };
  try { fn(); } finally { process.stderr.write = orig; }
  return out;
}

test('an unpinned cadence is announced, and names both numbers', () => {
  _resetCadenceWarning();
  let fired;
  const out = capture(() => { fired = warnDerivedCadence(500); });
  assert.equal(fired, true, 'the first unpinned run must warn');
  assert.match(out, /CADENCE NOT PINNED/);
  // The number it actually used, and the number his phone uses. A
  // warning that names neither cannot tell a reader which table to
  // distrust.
  assert.match(out, /500ms/);
  assert.match(out, new RegExp(String(HIS_EFFZOOM) + 'ms'));
  assert.match(out, new RegExp(String(HIS_EFFZOOM * 2) + 'ms'), 'the coast it implies');
  assert.match(out, /hisRegimeOpts/, 'it must say what to do instead');
});

// THIS TEST WAS FLAKY AND THE PACKET'S OWN ORACLE CAUGHT IT: one run in
// four failed under `node --test` over the whole directory while passing
// alone. `capture` replaces the PROCESS-WIDE `process.stderr.write`, so
// anything else that writes to stderr inside the window -- a node
// ExperimentalWarning, the runner's own diagnostics under load -- landed
// in `out`, and `assert.equal(out, '')` failed on a warning that is not
// ours. A guard against a defect class may not itself be a coin flip.
//
// The property is "OUR warning does not re-print", so that is what is
// asserted. A stray unrelated line on stderr is not a second warning.
test('and it is printed ONCE per process, so a sweep cannot bury it', () => {
  _resetCadenceWarning();
  const first = capture(() => warnDerivedCadence(500));
  assert.match(first, /CADENCE NOT PINNED/, 'precondition: the first one warned');
  let again;
  const out = capture(() => { again = warnDerivedCadence(750); });
  assert.equal(again, false);
  assert.doesNotMatch(out, /CADENCE NOT PINNED/,
    'a second unpinned arm must not re-print the warning');
  assert.doesNotMatch(out, /750ms/, 'nor name the second arm at all');
});

// AND IT HAS TO FIRE FROM THE ARM, NOT ONLY FROM ITS OWN FUNCTION.
//
// The phase-E critic deleted the guard's ONLY call site -- the
// `warnDerivedCadence(told)` line in `makeArms`' replay -- and both tests
// above stayed green, because both called the function directly. That is
// the shape this repo has shipped three times: a test that pins a
// property without running the path the property lives in (C3). These
// two run a real arm over a real corpus window.
import { loadWin, makeArms, thinFrames, hisRegimeOpts, K_HIS } from '../bench/arch-arms.mjs';
import { winFiles } from '../bench/corpus-lib.mjs';
import * as SHIPPED from '../bench/.cache/shipped.mjs';

function armWarns(opts) {
  // The corpus is a build artifact like the bundle, so an absent one
  // SKIPS rather than fails -- a stale checkout is not a regression.
  let files = [];
  try { files = winFiles(); } catch { return null; }
  if (!files.length) return null;
  const w = loadWin(files[0]);
  _resetCadenceWarning();
  return capture(() => { makeArms(SHIPPED)(opts)(thinFrames(w, K_HIS), 'man'); });
}

test('an arm built without fixedCadence warns THROUGH makeArms', () => {
  // Deliberately the shape ~30 benches still use: options built by hand,
  // no cadence pinned. This is the call site that matters.
  const out = armWarns({ hold: true, clampPad: 0.02, cut: true });
  if (out === null) return; // corpus not present in this checkout
  assert.match(out, /CADENCE NOT PINNED/,
    'the arm itself must announce it -- deleting the call site goes red here');
});

test('and hisRegimeOpts is silent, so the warning is not just always on', () => {
  const out = armWarns(hisRegimeOpts('man'));
  if (out === null) return;
  assert.doesNotMatch(out, /CADENCE NOT PINNED/,
    'a pinned arm must not warn, or the guard is noise nobody reads');
});
