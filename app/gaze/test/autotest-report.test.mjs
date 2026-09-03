// The panel's two new blocks have to leave the phone under the SAME
// rule as everything else in the report: numbers, or a value from a
// closed set. An A/B row is all numbers except the two fields that were
// already enums (`nativeBackend`, `codec`) -- and they are NAMED after
// their enums, because the violation walker looks a string up by the key
// it sits under. That naming rule cost one red run when the perf batch
// landed; this test is what stops it costing a second.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, reportViolations } from '../src/diag-report.mjs';

const HREF = 'https://m.youtube.com/watch?v=NWoT1ZVd1Lo';

function snap(tune) {
  return {
    id: 'a1b2c3d4e5f60718',
    platform: 'youtube',
    kind: 'watch',
    os: 'android',
    tune: tune,
  };
}

test('a full A/B table and a set of local overrides pass the report invariant', () => {
  const r = buildReport(snap({
    count: 2,
    applied: { BLUR_IN_FRAME: 1, DELAY_MS: 1000 },
    autotest: [
      { arm: 0, dropPct: 13.24, rafHz: 50.1, mediaSecs: 60, wallSecs: 60.2, nativeBackend: 'gpu', codec: 'av01', gl: 0 },
      { arm: 1, dropPct: 9.12, rafHz: 51.4, mediaSecs: 60, wallSecs: 60.1, nativeBackend: 'npu', codec: 'vp09', gl: 1 },
    ],
  }));
  assert.deepEqual(reportViolations(r, HREF), []);
  assert.equal(r.tune.overrides, 2);
  assert.deepEqual(r.tune.applied, { BLUR_IN_FRAME: 1, DELAY_MS: 1000 });
  assert.equal(r.tune.autotest.length, 2);
  assert.equal(r.tune.autotest[1].nativeBackend, 'npu');
});

test('a hostile store cannot put a string, a url or an unbounded table into the report', () => {
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push({ arm: i, dropPct: i, codec: 'av01' });
  const r = buildReport(snap({
    count: 'lots',
    applied: { CUT_DELTA: 60, evil: 'https://tracker.example/x', worse: NaN },
    autotest: rows.concat([{ arm: 0, codec: 'made up', nativeBackend: 'sideways', dropPct: 'x' }]),
  }));
  assert.deepEqual(reportViolations(r, HREF), []);
  assert.equal(r.tune.overrides, null, 'a non-number count is dropped, not coerced');
  assert.deepEqual(Object.keys(r.tune.applied), ['CUT_DELTA']);
  assert.ok(r.tune.autotest.length <= 12, 'the table is capped');
  const last = r.tune.autotest[r.tune.autotest.length - 1];
  assert.equal(last.codec, 'none');
  assert.equal(last.nativeBackend, 'none');
  assert.equal(last.dropPct, null);
});

test('a page that never opened the panel reports an empty block, not a missing one', () => {
  const r = buildReport(snap(null));
  assert.deepEqual(reportViolations(r, HREF), []);
  assert.equal(r.tune.overrides, null);
  assert.deepEqual(r.tune.applied, {});
  assert.deepEqual(r.tune.autotest, []);
});

// O10: the arm row used to record native.backend alone. A row measured
// with native dead, or with NATIVE_CPU_MASK moving one model onto the
// CPU while the others stayed on the GPU, read identically to a clean
// one -- these fields are what tells them apart.
test('O10: nativeDead and the three per-model backends reach the report', () => {
  const r = buildReport(snap({
    count: 0,
    applied: {},
    autotest: [
      {
        arm: 3, dropPct: 11.65, rafHz: 50.1, mediaSecs: 60, wallSecs: 60,
        nativeBackend: 'gpu', nativeDead: 1, faceBackend: 'cpu', genderBackend: 'gpu',
        personBackend: 'gpu', codec: 'av01', gl: 0,
        blurOn: 1, overrides: 0, paused: 0, mini: 0, hidden: 0,
      },
    ],
  }));
  assert.deepEqual(reportViolations(r, HREF), []);
  const row = r.tune.autotest[0];
  assert.equal(row.nativeDead, 1, 'a row measured with native dead must say so');
  assert.equal(row.faceBackend, 'cpu', 'NATIVE_CPU_MASK only moves the face model in this row');
  assert.equal(row.genderBackend, 'gpu');
  assert.equal(row.personBackend, 'gpu');
  assert.equal(row.blurOn, 1);
  assert.equal(row.overrides, 0);
  assert.equal(row.paused, 0);
  assert.equal(row.mini, 0);
  assert.equal(row.hidden, 0);
});

test('O10: a hostile per-model backend cannot smuggle text past the walker', () => {
  const r = buildReport(snap({
    count: 0,
    applied: {},
    autotest: [
      {
        arm: 0, faceBackend: 'https://evil.example/x', genderBackend: 'sideways',
        personBackend: 42, nativeDead: 'yes',
      },
    ],
  }));
  assert.deepEqual(reportViolations(r, HREF), []);
  const row = r.tune.autotest[0];
  assert.equal(row.faceBackend, 'none');
  assert.equal(row.genderBackend, 'none');
  assert.equal(row.personBackend, 'none');
  assert.equal(row.nativeDead, null, 'a non-number nativeDead is dropped, not coerced');
});

// O12: `tuneBlock` claimed lifeCounters' key-regex-and-cap standard for
// itself without implementing it. `applied` used to filter values only
// and count nothing.
test('O12: a hostile key in `applied` is dropped and counted, not carried', () => {
  const r = buildReport(snap({
    count: 1,
    applied: { 'drop tables; --': 5, GOOD_ONE: 2, 'evil.example.com': 9 },
    autotest: [],
  }));
  assert.deepEqual(reportViolations(r, HREF), [], 'a hostile key must not make the whole report unshareable');
  assert.deepEqual(r.tune.applied, { GOOD_ONE: 2 });
  assert.equal(r.tune.tuneDropped, 2);
});

test('O12: a clean applied block reports no drops at all', () => {
  const r = buildReport(snap({ count: 1, applied: { CUT_DELTA: 60, VERDICT_DUTY: 1.5 }, autotest: [] }));
  assert.deepEqual(reportViolations(r, HREF), []);
  assert.deepEqual(r.tune.applied, { CUT_DELTA: 60, VERDICT_DUTY: 1.5 });
  assert.equal(r.tune.tuneDropped, undefined, 'nothing was dropped, so the key must not appear at all');
});
