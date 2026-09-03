// THE ON-DEVICE A/B, AS A STATE MACHINE.
//
// probe_drops_ab.py measures one arm per invocation from a laptop over
// CDP. This is the same measurement with the phone doing the driving:
// each arm is a temporary override layer, a reload, sixty seconds of
// dropped/total, then the next arm. Every step of it survives a reload,
// which means the ONLY thing standing between a half-finished run and a
// phone stuck on somebody's experimental dials is the restore path --
// so that is what these tests are about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as at from '../src/auto-test.mjs';
import { tunableNames } from '../src/tuning.mjs';

function fakeWin(seed) {
  const s = new Map(Object.entries((seed && seed.session) || {}));
  const l = new Map(Object.entries((seed && seed.local) || {}));
  const store = (m) => ({
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  });
  return { sessionStorage: store(s), localStorage: store(l), _s: s, _l: l };
}

test('every arm moves a key the whitelist knows, and arm 0 moves nothing', () => {
  assert.equal(at.ARMS[0].over && Object.keys(at.ARMS[0].over).length, 0, 'arm 0 is the control');
  for (const a of at.ARMS) {
    assert.equal(typeof a.label, 'string');
    for (const k of Object.keys(a.over)) {
      assert.ok(tunableNames().indexOf(k) !== -1, k + ' is not on the whitelist');
    }
  }
});

test('a run walks the arms in order and then stops', () => {
  let st = at.startRun(120.5, 1000);
  assert.equal(st.i, 0);
  assert.equal(st.mediaTime, 120.5);
  for (let i = 1; i < at.ARMS.length; i++) {
    st = at.nextArm(st, 1000 + i);
    assert.equal(st.i, i);
    assert.equal(st.mediaTime, 120.5, 'every arm is measured at the same point in the video');
  }
  assert.equal(at.nextArm(st, 9999), null, 'past the last arm the run is over');
});

test('the pending arm is the override layer, and it is separate from his own dials', () => {
  const w = fakeWin();
  at.writeRun(w, at.startRun(30, 0));
  assert.deepEqual(at.pendingArm(w), at.ARMS[0].over);
  at.writeRun(w, at.nextArm(at.readRun(w), 0));
  assert.deepEqual(at.pendingArm(w), at.ARMS[1].over);
  // It lives in sessionStorage, so his saved overrides are untouched.
  assert.equal(w._l.has('tamescroll.tuning'), false);
  assert.deepEqual(at.pendingArm(fakeWin()), null, 'no run, no arm');
});

test('finishing restores: the run state is gone and nothing is pending', () => {
  const w = fakeWin();
  at.writeRun(w, at.startRun(30, 0));
  at.endRun(w);
  assert.equal(at.readRun(w), null);
  assert.equal(at.pendingArm(w), null);
});

test('a run that does not come back is aborted rather than left armed', () => {
  const st = at.startRun(30, 1000);
  assert.equal(at.staleRun(st, 1000 + at.BOOT_TIMEOUT_MS - 1), false);
  assert.equal(at.staleRun(st, 1000 + at.BOOT_TIMEOUT_MS + 1), true);
  assert.equal(at.staleRun(null, 9e9), false);
  // A malformed run state reads as no run at all -- never as arm NaN.
  const w = fakeWin({ session: { 'tamescroll.autotest': '{broken' } });
  assert.equal(at.readRun(w), null);
  const bad = fakeWin({ session: { 'tamescroll.autotest': JSON.stringify({ i: 99 }) } });
  assert.equal(at.readRun(bad), null, 'an arm index off the end is not a run');
});

test('results accumulate as numbers and enums, capped, best row = fewest drops', () => {
  const w = fakeWin();
  at.pushResult(w, { arm: 0, dropPct: 13.2, rafHz: 50, mediaSecs: 60, wallSecs: 60, nativeBackend: 'gpu', codec: 'av01', gl: 0 });
  at.pushResult(w, { arm: 1, dropPct: 9.1, rafHz: 51, mediaSecs: 60, wallSecs: 60, nativeBackend: 'gpu', codec: 'av01', gl: 0 });
  const rows = at.results(w);
  assert.equal(rows.length, 2);
  assert.equal(at.bestRow(rows), 1);
  assert.equal(at.bestRow([]), -1);
  for (let i = 0; i < at.RESULTS_MAX + 5; i++) at.pushResult(w, { arm: 0, dropPct: i });
  assert.ok(at.results(w).length <= at.RESULTS_MAX);
  at.clearResults(w);
  assert.deepEqual(at.results(w), []);
});

test('a garbage results store is an empty table, not a thrown overlay', () => {
  const w = fakeWin({ local: { 'tamescroll.autotest.results': '[[[' } });
  assert.deepEqual(at.results(w), []);
  assert.deepEqual(at.results(null), []);
});

test('progress reads as an arm count and a second count, for the bar', () => {
  const st = at.startRun(30, 0);
  const p = at.progress(st, 41);
  assert.equal(p.arm, 1);
  assert.equal(p.arms, at.ARMS.length);
  assert.equal(p.secs, 41);
  assert.ok(p.frac > 0 && p.frac < 1);
  assert.equal(at.progress(null, 0), null);
});
