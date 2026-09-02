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
