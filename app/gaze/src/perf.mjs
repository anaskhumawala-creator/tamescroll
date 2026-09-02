// Device performance dials (performance batch, 2026-09-03). Every one
// ships INERT (0) and travels over OTA; none touches a verdict. They act
// through `window.TsPerf`, the Kotlin bridge MainActivity installs on
// Android -- on desktop, or any page without the bridge, every setter is
// a no-op that records the requested value for the report.
//
//   SUSTAINED_PERF  1 = Window.setSustainedPerformanceMode(true): the
//                   phone holds clocks it can sustain instead of boosting
//                   and throttling. Can read SLOWER on a cool phone; only
//                   worth it where the throttling itself is the stutter.
//   REFRESH_CAP_HZ  >0 = ask the display for the mode nearest that rate
//                   (his 90Hz phone composes a third fewer frames at 60;
//                   the 60Hz Redmi is unaffected). 0 = leave the display
//                   alone.
//   THERMAL_DUTY    1 = read PowerManager.getThermalHeadroom every
//                   THERMAL_POLL_MS and, while the phone is within
//                   THERMAL_HOT of throttling, double the verdict duty
//                   (capped at 4, the pre-tunable value); restore the
//                   tuned duty once it cools below THERMAL_COOL. Fewer
//                   verdicts while hot = a wider coast window, priced in
//                   cadence.mjs; never fewer than the tuned duty allows.
import * as cadence from './cadence.mjs';

export var SUSTAINED_PERF = 0;
export var REFRESH_CAP_HZ = 0;
export var THERMAL_DUTY = 0;
export var THERMAL_POLL_MS = 10000;
export var THERMAL_HOT = 0.9;
export var THERMAL_COOL = 0.7;
export var THERMAL_DUTY_CEIL = 4;

var bridgeOverride = null;
/** Test seam: hand in a fake TsPerf (or null to read the window). */
export function _setBridgeForTest(b) { bridgeOverride = b; }

function bridge() {
  if (bridgeOverride) return bridgeOverride;
  try {
    var g = typeof window !== 'undefined' ? window : null;
    var b = g && g.TsPerf;
    return b && typeof b === 'object' ? b : null;
  } catch (e) {
    return null;
  }
}

function call(name, arg) {
  var b = bridge();
  if (!b || typeof b[name] !== 'function') return false;
  try {
    b[name](arg);
    return true;
  } catch (e) {
    return false;
  }
}

export function setSustainedPerf(v) {
  SUSTAINED_PERF = v > 0 ? 1 : 0;
  call('sustained', SUSTAINED_PERF === 1);
}

export function setRefreshCapHz(v) {
  REFRESH_CAP_HZ = Math.round(v);
  call('refreshCap', REFRESH_CAP_HZ);
}

// --- thermal duty --------------------------------------------------------
var baseDuty = cadence.VERDICT_DUTY;
var hot = false;
var timer = null;
var intervalFn = null; // test seam

/** The duty the OTA channel asked for; tuning.mjs calls this beside
 * cadence.setVerdictDuty so a thermal restore lands on the tuned value,
 * not on a stale module default. */
export function setBaseDuty(v) {
  baseDuty = v;
  if (!hot) return;
  cadence.setVerdictDuty(Math.min(THERMAL_DUTY_CEIL, baseDuty * 2));
}

export function thermalHot() { return hot; }

export function readHeadroom() {
  var b = bridge();
  if (!b || typeof b.thermalHeadroom !== 'function') return NaN;
  try {
    var h = Number(b.thermalHeadroom());
    return isFinite(h) ? h : NaN;
  } catch (e) {
    return NaN;
  }
}

/** One poll: hysteresis between THERMAL_HOT and THERMAL_COOL. Exported
 * so a test drives it without a clock. */
export function thermalTick(headroom) {
  var h = typeof headroom === 'number' ? headroom : readHeadroom();
  if (!isFinite(h)) return hot; // unsupported device: never hot
  if (!hot && h >= THERMAL_HOT) {
    hot = true;
    cadence.setVerdictDuty(Math.min(THERMAL_DUTY_CEIL, baseDuty * 2));
  } else if (hot && h < THERMAL_COOL) {
    hot = false;
    cadence.setVerdictDuty(baseDuty);
  }
  return hot;
}

function stopWatch() {
  if (timer !== null) {
    try { clearInterval(timer); } catch (e) { /* no timers here */ }
    timer = null;
  }
  if (hot) {
    hot = false;
    cadence.setVerdictDuty(baseDuty);
  }
}

export function _setIntervalForTest(fn) { intervalFn = fn; }

export function setThermalDuty(v) {
  THERMAL_DUTY = v > 0 ? 1 : 0;
  stopWatch();
  if (THERMAL_DUTY !== 1) return;
  if (!bridge()) return; // no phone underneath: nothing to poll
  var si = intervalFn || (typeof setInterval === 'function' ? setInterval : null);
  if (!si) return;
  timer = si(function () { thermalTick(); }, THERMAL_POLL_MS);
}

// --- ADPF hint + inference thread priority ----------------------------------
export var PERF_HINT = 0;
export var INFER_PRIO = 0;
export function setPerfHint(v) {
  PERF_HINT = v > 0 ? 1 : 0;
  call('hint', PERF_HINT === 1);
}
export function setInferPrio(v) {
  INFER_PRIO = Math.max(0, Math.min(2, Math.round(v)));
  call('inferPriority', INFER_PRIO);
}

// --- NO_AV1 -------------------------------------------------------------------
// A phone without an AV1 hardware decoder still gets AV1 from YouTube
// (Android 12+, since 2024-03) and decodes it in software on the cores
// the page composites with. When this is 1 the page answers "no" for
// av01 in the two capability questions the player asks --
// MediaSource.isTypeSupported and HTMLMediaElement.canPlayType -- so it
// picks VP9 or H.264, which both phones decode in hardware. A capability
// answer, not a page mutation: same class as the request shaper, and the
// MIT precedent is enhanced-h264ify. Takes effect at the player's NEXT
// init (the override is installed at bundle boot; a player already
// running keeps the stream it chose).
export var NO_AV1 = 0;
var av1Saved = null;
export function isAv1Type(t) {
  return /av01|av1/i.test(String(t || ''));
}
function av1Patch(g) {
  if (av1Saved) return;
  var MS = g && g.MediaSource;
  var ME = g && g.HTMLMediaElement && g.HTMLMediaElement.prototype;
  if (!MS || typeof MS.isTypeSupported !== 'function') return;
  var saved = { ms: MS, isType: MS.isTypeSupported, me: ME, canPlay: ME && ME.canPlayType };
  MS.isTypeSupported = function (t) {
    if (isAv1Type(t)) return false;
    return saved.isType.apply(this, arguments);
  };
  if (ME && typeof saved.canPlay === 'function') {
    ME.canPlayType = function (t) {
      if (isAv1Type(t)) return '';
      return saved.canPlay.apply(this, arguments);
    };
  }
  av1Saved = saved;
}
function av1Unpatch() {
  if (!av1Saved) return;
  try { av1Saved.ms.isTypeSupported = av1Saved.isType; } catch (e) { /* frozen global */ }
  try { if (av1Saved.me && av1Saved.canPlay) av1Saved.me.canPlayType = av1Saved.canPlay; } catch (e) { /* same */ }
  av1Saved = null;
}
export function setNoAv1(v, g) {
  NO_AV1 = v > 0 ? 1 : 0;
  var w = g || (typeof window !== 'undefined' ? window : null);
  if (!w) return;
  try {
    if (NO_AV1 === 1) av1Patch(w);
    else av1Unpatch();
  } catch (e) {
    /* a page that refuses the write keeps its own answer */
  }
}

// --- PLAYBACK_SLOW ---------------------------------------------------------------
// 0.95x while the decoder is dropping frames: 5% slower, pitch kept
// (preservesPitch defaults true), stutter traded for a few seconds. The
// decision is pure so a test drives it without a video: `slowStep` takes
// the window's dropped share and the video's CURRENT rate and returns the
// rate to write, or null for "leave it". A rate the user picked (anything
// that is not 1 and not our 0.95) is never touched; if the rate we set was
// changed under us, we stop owning it.
export var PLAYBACK_SLOW = 0;
export var SLOW_RATE = 0.95;
export var SLOW_ON_SHARE = 0.08;
export var SLOW_OFF_SHARE = 0.03;
export var SLOW_POLL_MS = 5000;
var slowState = { ours: false, slowed: 0, restored: 0 };
export function slowStats() { return { slowed: slowState.slowed, restored: slowState.restored, ours: slowState.ours }; }
export function _resetSlowForTest() { slowState = { ours: false, slowed: 0, restored: 0 }; }
export function slowStep(share, rate) {
  if (slowState.ours && Math.abs(rate - SLOW_RATE) > 1e-6) {
    slowState.ours = false; // the user moved it: theirs now
    return null;
  }
  if (PLAYBACK_SLOW !== 1) {
    if (slowState.ours) { slowState.ours = false; slowState.restored++; return 1; }
    return null;
  }
  if (!slowState.ours && rate === 1 && share > SLOW_ON_SHARE) {
    slowState.ours = true; slowState.slowed++; return SLOW_RATE;
  }
  if (slowState.ours && share < SLOW_OFF_SHARE) {
    slowState.ours = false; slowState.restored++; return 1;
  }
  return null;
}
export function setPlaybackSlow(v) { PLAYBACK_SLOW = v > 0 ? 1 : 0; }
/** Attach the poll to a player video; returns a detach function. The
 * dropped SHARE is per window (delta dropped / delta total), never the
 * cumulative figure, so a bad first second does not slow the whole video. */
export function watchPlayback(video, intervalFn) {
  var si = intervalFn || (typeof setInterval === 'function' ? setInterval : null);
  if (!si || !video) return function () {};
  var last = null;
  var timer = si(function () {
    var q;
    try { q = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null; } catch (e) { q = null; }
    if (!q) return;
    if (last) {
      var dt = q.totalVideoFrames - last.total;
      var dd = q.droppedVideoFrames - last.dropped;
      var share = dt > 0 ? dd / dt : 0;
      var next = slowStep(share, video.playbackRate);
      if (next !== null) {
        try { video.playbackRate = next; } catch (e) { /* the page owns the element */ }
      }
    }
    last = { total: q.totalVideoFrames, dropped: q.droppedVideoFrames };
  }, SLOW_POLL_MS);
  return function () {
    try { clearInterval(timer); } catch (e) { /* no timers */ }
    if (slowState.ours) {
      slowState.ours = false;
      try { video.playbackRate = 1; } catch (e) { /* same */ }
    }
  };
}
