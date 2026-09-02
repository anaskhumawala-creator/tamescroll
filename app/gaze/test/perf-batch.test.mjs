// Performance batch dials (2026-09-03): NO_AV1 capability override,
// PLAYBACK_SLOW decision, thermal duty hysteresis, and the TsPerf bridge
// calls. No window, no phone: every side effect lands on a fake.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const perf = await import('../src/perf.mjs');
const cadence = await import('../src/cadence.mjs');

function fakeGlobal() {
  const g = {};
  g.MediaSource = {
    isTypeSupported(t) {
      return t.indexOf('nope') === -1;
    },
  };
  g.HTMLMediaElement = { prototype: { canPlayType(t) { return t.indexOf('nope') === -1 ? 'probably' : ''; } } };
  return g;
}

test('NO_AV1 1 answers no for av01 on both capability questions and leaves VP9/H.264 alone', () => {
  const g = fakeGlobal();
  perf.setNoAv1(1, g);
  assert.equal(perf.NO_AV1, 1);
  assert.equal(g.MediaSource.isTypeSupported('video/mp4; codecs="av01.0.08M.08"'), false);
  assert.equal(g.MediaSource.isTypeSupported('video/webm; codecs="vp09.00.10.08"'), true);
  assert.equal(g.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'), true);
  assert.equal(g.HTMLMediaElement.prototype.canPlayType('video/mp4; codecs="av01.0.08M.08"'), '');
  assert.equal(g.HTMLMediaElement.prototype.canPlayType('video/mp4; codecs="avc1.42E01E"'), 'probably');
  // the original still answers everything else
  assert.equal(g.MediaSource.isTypeSupported('video/nope'), false);
  perf.setNoAv1(0, g);
  assert.equal(g.MediaSource.isTypeSupported('video/mp4; codecs="av01.0.08M.08"'), true, 'unpatched');
  assert.equal(g.HTMLMediaElement.prototype.canPlayType('video/mp4; codecs="av01.0.08M.08"'), 'probably');
});

test('NO_AV1 on a page without MediaSource is a no-op that does not throw', () => {
  assert.doesNotThrow(() => perf.setNoAv1(1, {}));
  perf.setNoAv1(0, {});
  assert.doesNotThrow(() => perf.setNoAv1(1, null));
  perf.setNoAv1(0, null);
});

test('PLAYBACK_SLOW: slows at >8% dropped, restores under 3%, never touches a user rate', () => {
  perf._resetSlowForTest();
  perf.setPlaybackSlow(0);
  assert.equal(perf.slowStep(0.5, 1), null, 'dial off: never slows');
  perf.setPlaybackSlow(1);
  assert.equal(perf.slowStep(0.05, 1), null, 'under the on-threshold');
  assert.equal(perf.slowStep(0.2, 1.5), null, 'a user-chosen rate is never touched');
  assert.equal(perf.slowStep(0.2, 1), perf.SLOW_RATE);
  assert.equal(perf.slowStep(0.05, perf.SLOW_RATE), null, 'between thresholds: hold');
  assert.equal(perf.slowStep(0.01, perf.SLOW_RATE), 1, 'restored');
  assert.deepEqual(perf.slowStats(), { slowed: 1, restored: 1, ours: false });
  // the user moved it under us: we stop owning it and never restore
  assert.equal(perf.slowStep(0.2, 1), perf.SLOW_RATE);
  assert.equal(perf.slowStep(0.0, 2), null);
  assert.equal(perf.slowStats().ours, false);
  assert.equal(perf.slowStep(0.0, 2), null);
  // dial switched off while ours: restore once
  assert.equal(perf.slowStep(0.2, 1), perf.SLOW_RATE);
  perf.setPlaybackSlow(0);
  assert.equal(perf.slowStep(0.2, perf.SLOW_RATE), 1);
  perf._resetSlowForTest();
});

test('watchPlayback reads the per-window dropped share and writes the rate; detach restores', () => {
  perf._resetSlowForTest();
  perf.setPlaybackSlow(1);
  let tick = null;
  const video = {
    playbackRate: 1,
    _q: { totalVideoFrames: 0, droppedVideoFrames: 0 },
    getVideoPlaybackQuality() { return this._q; },
  };
  const detach = perf.watchPlayback(video, (fn) => { tick = fn; return 1; });
  video._q = { totalVideoFrames: 100, droppedVideoFrames: 50 };
  tick(); // first sample only banks a baseline
  assert.equal(video.playbackRate, 1);
  video._q = { totalVideoFrames: 200, droppedVideoFrames: 70 }; // 20% this window
  tick();
  assert.equal(video.playbackRate, perf.SLOW_RATE);
  video._q = { totalVideoFrames: 300, droppedVideoFrames: 71 }; // 1%
  tick();
  assert.equal(video.playbackRate, 1);
  video._q = { totalVideoFrames: 400, droppedVideoFrames: 120 };
  tick();
  assert.equal(video.playbackRate, perf.SLOW_RATE);
  detach();
  assert.equal(video.playbackRate, 1, 'detach hands the rate back');
  perf.setPlaybackSlow(0);
  perf._resetSlowForTest();
});

test('thermal duty: doubles the verdict duty while hot, restores below the cool line, ceiling 4', () => {
  const base = cadence.VERDICT_DUTY;
  perf.setBaseDuty(base);
  assert.equal(perf.thermalTick(NaN), false, 'no headroom reading: never hot');
  assert.equal(perf.thermalTick(0.95), true);
  assert.equal(cadence.VERDICT_DUTY, Math.min(4, base * 2));
  assert.equal(perf.thermalTick(0.8), true, 'hysteresis: still hot between the lines');
  assert.equal(perf.thermalTick(0.6), false);
  assert.equal(cadence.VERDICT_DUTY, base);
  perf.setBaseDuty(3);
  perf.thermalTick(0.95);
  assert.equal(cadence.VERDICT_DUTY, 4, 'ceiling');
  perf.thermalTick(0.1);
  assert.equal(cadence.VERDICT_DUTY, 3);
  perf.setBaseDuty(base);
  cadence.setVerdictDuty(base);
});

test('the TsPerf bridge receives every dial and a missing bridge is a silent no-op', () => {
  const calls = [];
  perf._setBridgeForTest({
    sustained(v) { calls.push(['sustained', v]); },
    refreshCap(v) { calls.push(['refreshCap', v]); },
    hint(v) { calls.push(['hint', v]); },
    inferPriority(v) { calls.push(['inferPriority', v]); },
  });
  perf.setSustainedPerf(1);
  perf.setRefreshCapHz(60);
  perf.setPerfHint(1);
  perf.setInferPrio(2);
  assert.deepEqual(calls, [['sustained', true], ['refreshCap', 60], ['hint', true], ['inferPriority', 2]]);
  perf._setBridgeForTest(null);
  assert.doesNotThrow(() => {
    perf.setSustainedPerf(0);
    perf.setRefreshCapHz(0);
    perf.setPerfHint(0);
    perf.setInferPrio(0);
  });
  assert.equal(perf.SUSTAINED_PERF, 0);
  assert.equal(perf.REFRESH_CAP_HZ, 0);
  assert.equal(perf.PERF_HINT, 0);
  assert.equal(perf.INFER_PRIO, 0);
});
