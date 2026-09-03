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
  return {
    sessionStorage: store(s), localStorage: store(l), _s: s, _l: l,
    location: { pathname: '/watch', reload() {} },
    document: { documentElement: { classList: { contains: () => false } }, hidden: false },
  };
}

/** A controllable setTimeout/clearTimeout pair for driving attachRun's
 * settle -> measure -> push sequence deterministically, one step at a
 * time, from a test -- O13's "an auto-test arm actually runs" proof. */
function fakeTimers(win) {
  const slots = [];
  win.setTimeout = (fn, ms) => { slots.push({ fn, ms }); return slots.length; };
  win.clearTimeout = (id) => { const t = slots[id - 1]; if (t) t.fn = null; };
  win._pendingCount = () => slots.filter((t) => t.fn).length;
  win._fireNext = () => {
    for (const t of slots) {
      if (t.fn) { const fn = t.fn; t.fn = null; fn(); return true; }
    }
    return false;
  };
  return win;
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

test('O13: no arm may ever move a protection dial -- perf-only, always', () => {
  // RED against a version of ARMS that adds, say, { over: { CUT_DELTA: 90 } }:
  // this is the test that would have caught it, not a grep.
  for (const a of at.ARMS) {
    for (const k of Object.keys(a.over)) {
      assert.equal(
        at.PROTECTION_DIALS.indexOf(k), -1,
        a.name + ' moves ' + k + ', which decides who gets covered',
      );
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

test('O2: staleness is measured on the wall clock, so it survives a reload', () => {
  // startRun/nextArm default `at` to Date.now()-shaped time, never
  // performance.now() -- the RED case this replaces is a run whose `at`
  // came from one document's performance.now() (small) being compared
  // against a LATER document's performance.now() (also small, reset to
  // near zero by the navigation): the subtraction used to land near
  // zero or negative and a stuck run could never be declared stale from
  // outside the document that armed it.
  const armedAt = Date.now() - 5000;
  const st = at.startRun(30, armedAt);
  assert.equal(at.staleRun(st, armedAt + at.BOOT_TIMEOUT_MS - 1), false);
  assert.equal(at.staleRun(st, armedAt + at.BOOT_TIMEOUT_MS + 1), true);
  assert.equal(at.staleRun(null, 9e9), false);
});

test('O2: a stale run is reclaimed at BOOT, before any player exists', () => {
  // applyPendingArm is called unconditionally at boot in init-entry,
  // whether or not a player ever attaches -- this is the RED case for
  // the old design, where the watchdog lived only inside attachRun and
  // a boot with no player never reached it at all.
  const w = fakeWin();
  const staleAt = Date.now() - at.BOOT_TIMEOUT_MS - 1000;
  at.writeRun(w, { i: 1, mediaTime: 30, at: staleAt });
  const applied = at.applyPendingArm(w);
  assert.deepEqual(applied, {}, 'a stale arm must not apply');
  assert.equal(at.readRun(w), null, 'a stale run must be thrown away, not merely skipped');
});

test('O2: a fresh run still applies its arm at boot', () => {
  const w = fakeWin();
  at.writeRun(w, at.startRun(30, Date.now()));
  const applied = at.applyPendingArm(w);
  assert.deepEqual(applied, {}, 'arm 0 (control) moves nothing');
  assert.ok(at.readRun(w), 'a fresh run must survive its own boot check');
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

test('O7: a non-integer arm index reads as no run, not as a crash waiting to happen', () => {
  // RED against the old readRun: `ARMS[1.5]` is `undefined` in every
  // reader that indexes with it (pendingArm, applyPendingArm, progress),
  // and the old guard only checked bounds, not integrality.
  const w = fakeWin({ session: { 'tamescroll.autotest': JSON.stringify({ i: 1.5, mediaTime: 0, at: 0 }) } });
  assert.equal(at.readRun(w), null);
  assert.equal(at.pendingArm(w), null);
  assert.deepEqual(at.applyPendingArm(w), {});
  // Even a state built by hand, bypassing readRun entirely, must not
  // throw -- progress()'s own fallback is the second line of defence.
  const p = at.progress({ i: 1.5 }, 0);
  assert.equal(p.label, 'mode 1.5');
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

test('O5: bestRow ignores a row that did not run long enough to trust', () => {
  const rows = [
    { arm: 0, dropPct: 5, mediaSecs: 60 },
    { arm: 1, dropPct: 1, mediaSecs: 20 }, // fewer drops, far too short a window
  ];
  assert.equal(at.bestRow(rows), 0, 'a short row must never win on a lower drop percentage alone');
  assert.equal(at.bestRow([{ arm: 0, dropPct: 1, mediaSecs: at.BEST_MIN_MEDIA_SECS }]), 0, 'exactly the floor still counts');
});

test('O5/O10: a pushed row carries the state and native fields the panel and the report need', () => {
  const w = fakeWin();
  const row = {
    arm: 0, dropPct: 5, rafHz: 50, mediaSecs: 60, wallSecs: 60,
    nativeBackend: 'gpu', nativeDead: true, faceBackend: 'gpu', genderBackend: 'npu', personBackend: 'cpu',
    codec: 'av01', gl: 1, blurOn: true, overrides: 2, paused: false, mini: true, hidden: false,
  };
  at.pushResult(w, row);
  const out = at.results(w)[0];
  assert.equal(out.nativeDead, 1);
  assert.equal(out.faceBackend, 'gpu');
  assert.equal(out.genderBackend, 'npu');
  assert.equal(out.personBackend, 'cpu');
  assert.equal(out.blurOn, 1);
  assert.equal(out.overrides, 2);
  assert.equal(out.paused, 0);
  assert.equal(out.mini, 1);
  assert.equal(out.hidden, 0);
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

test('O2: beginRun and attachRun both refuse off a watch page', () => {
  const w = fakeWin();
  w.location.pathname = '/';
  const reason = at.beginRun(w, { currentTime: 0 });
  assert.ok(reason && /watch page/i.test(reason), 'beginRun must name the reason, not silently do nothing');
  at.writeRun(w, at.startRun(10, Date.now()));
  const video = { currentTime: 10, play() { return { catch() {} }; } };
  assert.equal(at.attachRun(w, { video: video }), null, 'attachRun must not start off a watch page');
  at._resetForTest();
});

test('O2/O13: attachRun settles, measures, and pushes a full row -- driven end to end', () => {
  const w = fakeWin();
  fakeTimers(w);
  at.writeRun(w, at.startRun(10, Date.now()));
  let dropped = 0, total = 0, raf = 0;
  const video = {
    currentTime: 10, paused: false, muted: false,
    play() { return { catch() {} }; },
    getVideoPlaybackQuality: () => ({ droppedVideoFrames: dropped, totalVideoFrames: total }),
  };
  w.__TS_GAZE_RENDER = () => ({ raf: raf });
  const env = {
    video: video,
    blurOn: () => true,
    nativeInfo: () => ({ backend: 'gpu', dead: false, backends: { 1: 'gpu', 2: 'npu', 3: 'cpu' } }),
    codecInfo: () => ({ codec: 'av01' }),
  };
  const st = at.attachRun(w, env);
  assert.ok(st, 'attachRun refused to start on a watch page with a fresh run');
  assert.equal(w._pendingCount(), 1, 'the settle timer must be armed');
  assert.equal(at.results(w).length, 0, 'nothing is measured before the settle window ends');

  total = 100; dropped = 2; raf = 100;
  assert.ok(w._fireNext(), 'the settle timer never fired'); // arms the measure timer
  assert.equal(w._pendingCount(), 1, 'the measure timer must be armed after settle');

  total = 200; dropped = 12; raf = 200;
  video.currentTime = 70;
  assert.ok(w._fireNext(), 'the measure timer never fired'); // pushes the row, reloads

  const rows = at.results(w);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.arm, 0);
  assert.ok(row.dropPct > 0, 'dropped frames between the two samples must show up');
  assert.equal(row.nativeBackend, 'gpu');
  assert.equal(row.faceBackend, 'gpu');
  assert.equal(row.genderBackend, 'npu');
  assert.equal(row.personBackend, 'cpu');
  assert.equal(row.nativeDead, 0);
  assert.equal(row.codec, 'av01');
  assert.equal(row.blurOn, 1);
  assert.equal(row.paused, 0);
  assert.equal(row.mini, 0);
  assert.equal(row.hidden, 0);
  assert.equal(at.readRun(w).i, 1, 'the run must have advanced to the next arm');
  at._resetForTest();
});

test('O2: cancelRun drops an in-flight attempt without pushing a row or reloading', () => {
  const w = fakeWin();
  fakeTimers(w);
  at.writeRun(w, at.startRun(10, Date.now()));
  const video = {
    currentTime: 10, paused: false,
    play() { return { catch() {} }; },
    getVideoPlaybackQuality: () => ({ droppedVideoFrames: 0, totalVideoFrames: 0 }),
  };
  assert.ok(at.attachRun(w, { video: video }));
  assert.equal(w._pendingCount(), 1);
  at.cancelRun(w);
  assert.equal(w._pendingCount(), 0, 'the settle timer must be cleared, or a navigated-away document could still fire it');
  assert.equal(at.results(w).length, 0, 'a cancelled attempt must not record a row');
  assert.equal(at.readRun(w).i, 0, 'the arm itself is untouched -- it can be re-attempted');
  const st2 = at.attachRun(w, { video: video });
  assert.ok(st2, 'a cancelled run must be re-armable on the next attach');
  at.cancelRun(w);
});

test('O13: a full run puts his own dials back once the last arm finishes', () => {
  // O13's fix (1): "asserts the dial is back on the next boot". A run
  // that only ever advances readRun().i one step (the earlier
  // end-to-end test) does not exercise the one moment that actually
  // matters -- the LAST arm finishing -- so this drives every arm to
  // completion and then boots again as a fresh document would.
  const w = fakeWin();
  fakeTimers(w);
  at.writeRun(w, at.startRun(10, Date.now()));
  let dropped = 0, total = 0;
  const video = {
    currentTime: 10, paused: false, muted: false,
    play() { return { catch() {} }; },
    getVideoPlaybackQuality: () => ({ droppedVideoFrames: dropped, totalVideoFrames: total }),
  };
  const env = { video: video };

  for (let arm = 0; arm < at.ARMS.length; arm++) {
    assert.equal(at.readRun(w).i, arm, 'arm ' + arm + ' must be the one about to run');
    assert.ok(at.attachRun(w, env), 'attachRun refused to pick up arm ' + arm);
    total += 100; dropped += 1;
    assert.ok(w._fireNext(), 'settle timer never fired for arm ' + arm);
    total += 100; dropped += 1;
    assert.ok(w._fireNext(), 'measure timer never fired for arm ' + arm);
  }

  assert.equal(at.readRun(w), null, 'the run must be gone once the last arm has been measured');
  assert.equal(at.pendingArm(w), null, 'nothing may still be pending after the last arm');
  assert.equal(at.results(w).length, at.ARMS.length, 'every arm must have pushed exactly one row');

  // A fresh document booting after this is the case O13 asks for: his
  // own dials must be exactly where he left them, not stuck on
  // whichever arm ran last.
  assert.deepEqual(at.applyPendingArm(w), {}, 'a finished run must move nothing at the next boot');
  at._resetForTest();
});

test('device 1100: a loadstart on the SAME video (our own seek at arm start) must not cancel the arm; a different video must', () => {
  const w = fakeWin();
  w.location = { pathname: '/watch', search: '?v=AAAAAAAAAAA', reload() {} };
  fakeTimers(w);
  at.writeRun(w, at.startRun(10, Date.now()));
  const video = {
    currentTime: 10, paused: false,
    play() { return { catch() {} }; },
    getVideoPlaybackQuality: () => ({ droppedVideoFrames: 0, totalVideoFrames: 0 }),
  };
  assert.ok(at.attachRun(w, { video: video }));
  assert.equal(w._pendingCount(), 1);
  assert.equal(at.cancelRunOnLoad(w), false, 'same video: the seek we made fired loadstart, nothing to cancel');
  assert.equal(w._pendingCount(), 1, 'the settle timer must survive our own loadstart');
  w.location.search = '?v=BBBBBBBBBBB';
  assert.equal(at.cancelRunOnLoad(w), true, 'a different video under the run cancels it');
  assert.equal(w._pendingCount(), 0);
  assert.equal(at.videoIdOf({ search: '?x=1&v=abc_-9&t=3' }), 'abc_-9');
});
