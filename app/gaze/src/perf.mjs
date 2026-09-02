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

// THE BRIDGE ANSWERS ONLY TO A TOKEN THE PAGE CANNOT GET (phase-n N8).
// window.TsPerf is a @JavascriptInterface on the WebView that loads
// YouTube, reachable by every script on the page; inferPriority(2)
// backgrounds the inference thread (a wider gap, a wider coast, more
// exposure -- chosen by the page), refreshCap changes the display mode,
// sustained caps the clocks. So MainActivity hands out ONE token per
// document to the first caller of TsPerf.claim(), which is the
// document-start stash lib.rs injects (perf_token_stash_script), and
// the stash exposes it once through a non-configurable
// __TS_TAKE_PERF_TOKEN -- the same one-shot door the native port uses.
// A page script that finds the bridge gets "" from claim() and a
// silent no-op from every method. Read once, the first time a dial
// needs the phone.
var perfToken = null;
var perfTokenTaken = false;
export function _setTokenForTest(t) { perfToken = t; perfTokenTaken = true; }
function token() {
  if (perfTokenTaken) return perfToken;
  perfTokenTaken = true;
  try {
    var g = typeof window !== 'undefined' ? window : null;
    var take = g && g.__TS_TAKE_PERF_TOKEN;
    perfToken = typeof take === 'function' ? take() : null;
  } catch (e) {
    perfToken = null;
  }
  return perfToken;
}

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
    b[name](token(), arg);
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
    var h = Number(b.thermalHeadroom(token()));
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
// the page composites with. MEASURED on the Redmi (probe_av1_caps.py,
// 2026-09-03): the player asks navigator.mediaCapabilities.decodingInfo
// for av01 at ~380ms and MediaSource.isTypeSupported at ~530ms after
// document start, and this bundle boots at ~1100ms -- so a wrapper
// installed here is too late for the first stream, and one that leaves
// decodingInfo alone is ignored (the first 1098 arm read av01 with the
// dial at 1). The wrappers therefore live in the DOCUMENT-START script
// lib.rs injects (no_av1_script: isTypeSupported, canPlayType,
// decodingInfo) and consult a flag at CALL time: window.__TS_NO_AV1
// once this setter has run, the tuning payload before that. decodingInfo
// is polled on every ABR decision, so a dial pushed mid-playback takes
// effect at the next quality step, not the next navigation. Every av01
// answer refused is counted in __TS_AV1_REFUSED (report perf.av1Refused)
// so "0 refused" and "no wrapper" can be told apart. A capability answer,
// not a page mutation: same class as the request shaper; the MIT
// precedent is enhanced-h264ify.
export var NO_AV1 = 0;
export function isAv1Type(t) {
  return /av01|av1/i.test(String(t || ''));
}
export function setNoAv1(v, g) {
  NO_AV1 = v > 0 ? 1 : 0;
  var w = g || (typeof window !== 'undefined' ? window : null);
  if (!w) return;
  try {
    w.__TS_NO_AV1 = NO_AV1;
  } catch (e) {
    /* a page that refuses the write keeps its own answer */
  }
}
export function av1Refused(g) {
  var w = g || (typeof window !== 'undefined' ? window : null);
  var n = w ? Number(w.__TS_AV1_REFUSED) : 0;
  return isFinite(n) && n > 0 ? n : 0;
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
export function slowStats() { return { slowed: slowState.slowed, restored: slowState.restored, ours: slowState.ours, av1Refused: av1Refused() }; }
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
