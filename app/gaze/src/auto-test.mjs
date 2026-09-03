// THE A/B, RUN BY THE PHONE INSTEAD OF BY A LAPTOP.
//
// `spikes/gauntlet/probe_drops_ab.py` is the instrument every drops
// number in this repo came from: open a watch page, seek, let the ring
// refill, then read `getVideoPlaybackQuality()` and the renderer's rAF
// counter across a fixed window. It needs adb, CDP and one planted arm
// per invocation, so it only ever runs on the Redmi on this desk -- and
// the phone whose drops actually matter is his, five hundred miles away.
//
// This is the same measurement with nothing between it and the video:
// six arms, sixty seconds each, same video, same media time, same
// counters. It is deliberately NOT a new instrument -- the fields below
// are the ones probe_drops_ab.py already prints, so a run off his phone
// and a run off the Redmi are comparable rows.
//
// WHY IT SURVIVES RELOADS. Four of the six arms only take effect on a
// fresh document (DELAY_MS resizes a ring, NO_AV1 and CODEC_PROBE wrap
// page APIs before the player initialises, PRESENTER_GL attaches at the
// next attach). Applying them in place would measure the previous arm
// with a new label, which is exactly how `v1097-decomp` reported two
// delay0 arms as a duty sweep. So each arm is written down, the page is
// reloaded, and the run picks itself up at boot.
//
// WHY THE ARM IS NOT AN OVERRIDE. His saved dials live in
// localStorage['tamescroll.tuning'] and are HIS. The arm is a temporary
// layer in sessionStorage that is applied ON TOP at boot and thrown away
// at the end of the run -- so a run that is interrupted by closing the
// tab takes its arm with it, and a run that finishes restores nothing
// because it never overwrote anything.
import { applyOne } from './tuning.mjs';

export var RUN_KEY = 'tamescroll.autotest';
export var RESULTS_KEY = 'tamescroll.autotest.results';
export var ARM_SECS = 60;
export var RESULTS_MAX = 12;
// A boot that does not reach a playing video inside this abandons the
// run and puts his own dials back. Without it, one arm that cannot
// start (a navigation away, a player that never attaches) leaves a
// phone running an experimental dial with nothing to switch it off.
export var BOOT_TIMEOUT_MS = 30000;

// THE ARMS, IN A FIXED ORDER, BECAUSE THE INDEX IS THE REPORT'S ENUM.
// Never reorder or remove one -- a stored row from an older build would
// silently change meaning. Append only.
export var ARMS = [
  { name: 'control', label: 'Current settings', over: {} },
  { name: 'blurInFrame', label: 'Blur into picture', over: { BLUR_IN_FRAME: 1 } },
  { name: 'presenterGl', label: 'GPU blur', over: { PRESENTER_GL: 1 } },
  { name: 'cpuMask', label: 'Faces on CPU', over: { NATIVE_CPU_MASK: 1 } },
  { name: 'renderEvery', label: 'Redraw every other frame', over: { RENDER_EVERY: 2 } },
  { name: 'noAv1', label: 'No AV1', over: { NO_AV1: 1 } },
];

function store(g, which) {
  try {
    var w = g || (typeof window !== 'undefined' ? window : null);
    var s = w && w[which];
    return s && typeof s.getItem === 'function' ? s : null;
  } catch (e) {
    return null;
  }
}
function readJson(s, key) {
  if (!s) return null;
  try {
    var raw = s.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function writeJson(s, key, val) {
  if (!s) return false;
  try {
    if (val === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    return false;
  }
}

// --- the state machine, pure --------------------------------------------

/** A fresh run, pinned to the media time it started at so every arm
 * measures the same sixty seconds of footage rather than whatever the
 * video happened to be showing after a reload. */
export function startRun(mediaTime, nowMs) {
  return {
    i: 0,
    mediaTime: typeof mediaTime === 'number' && isFinite(mediaTime) ? mediaTime : 0,
    at: typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : 0,
  };
}

/** The next arm, or null when the last one has been measured. */
export function nextArm(state, nowMs) {
  if (!state) return null;
  var i = state.i + 1;
  if (i >= ARMS.length) return null;
  return { i: i, mediaTime: state.mediaTime, at: typeof nowMs === 'number' ? nowMs : 0 };
}

/** A run state is only a run if it names an arm this build has. An
 * index off the end -- an older build reading a newer store -- reads as
 * no run at all, never as arm NaN. */
export function readRun(g) {
  var st = readJson(store(g, 'sessionStorage'), RUN_KEY);
  if (!st || typeof st !== 'object') return null;
  if (typeof st.i !== 'number' || !isFinite(st.i) || st.i < 0 || st.i >= ARMS.length) return null;
  return { i: st.i, mediaTime: typeof st.mediaTime === 'number' ? st.mediaTime : 0, at: typeof st.at === 'number' ? st.at : 0 };
}

export function writeRun(g, state) {
  return writeJson(store(g, 'sessionStorage'), RUN_KEY, state || null);
}

/** The run is over: no arm pending, nothing to restore, his own
 * overrides are exactly where he left them. */
export function endRun(g) {
  return writeJson(store(g, 'sessionStorage'), RUN_KEY, null);
}

/** The temporary override layer for the arm now due, or null. */
export function pendingArm(g) {
  var st = readRun(g);
  return st ? ARMS[st.i].over : null;
}

/** Apply the pending arm on top of the OTA values and his own overrides.
 * Called once at boot, after both. Returns what took effect. */
export function applyPendingArm(g) {
  var over = pendingArm(g);
  var applied = {};
  if (!over) return applied;
  for (var k in over) {
    if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
    var c = applyOne(k, over[k]);
    if (c !== null) applied[k] = c;
  }
  return applied;
}

/** A run whose arm was armed and never came back. */
export function staleRun(state, nowMs) {
  if (!state) return false;
  return nowMs - state.at > BOOT_TIMEOUT_MS;
}

/** Arm n of m and the seconds elapsed, for the progress bar. */
export function progress(state, secs) {
  if (!state) return null;
  var s = typeof secs === 'number' && isFinite(secs) ? Math.max(0, secs) : 0;
  var done = state.i + Math.min(1, s / ARM_SECS);
  return {
    arm: state.i + 1,
    arms: ARMS.length,
    label: ARMS[state.i].label,
    secs: Math.round(s),
    frac: Math.max(0, Math.min(1, done / ARMS.length)),
  };
}

// --- results -------------------------------------------------------------

/** One measured arm. Numbers, plus the two fields that already have
 * enums in the report; anything else is dropped here rather than at the
 * report's violation walker, where it would kill the whole artifact. */
export function normalizeRow(r) {
  var n = function (x) { return typeof x === 'number' && isFinite(x) ? Math.round(x * 100) / 100 : null; };
  return {
    arm: n(r && r.arm),
    dropPct: n(r && r.dropPct),
    rafHz: n(r && r.rafHz),
    mediaSecs: n(r && r.mediaSecs),
    wallSecs: n(r && r.wallSecs),
    nativeBackend: r && typeof r.nativeBackend === 'string' ? r.nativeBackend : 'none',
    codec: r && typeof r.codec === 'string' ? r.codec : 'none',
    gl: n(r && r.gl),
  };
}

export function results(g) {
  var rows = readJson(store(g, 'localStorage'), RESULTS_KEY);
  if (!Array.isArray(rows)) return [];
  return rows.slice(-RESULTS_MAX).map(normalizeRow);
}

export function pushResult(g, row) {
  var s = store(g, 'localStorage');
  var rows = results(g);
  rows.push(normalizeRow(row));
  while (rows.length > RESULTS_MAX) rows.shift();
  writeJson(s, RESULTS_KEY, rows);
  return rows;
}

export function clearResults(g) {
  writeJson(store(g, 'localStorage'), RESULTS_KEY, null);
  return [];
}

/** Index of the arm with the fewest dropped frames, or -1. Ties keep the
 * earlier arm, so "current settings" wins a tie and nothing gets
 * recommended on noise. */
export function bestRow(rows) {
  var best = -1;
  var bestPct = Infinity;
  for (var i = 0; i < (rows || []).length; i++) {
    var p = rows[i] && rows[i].dropPct;
    if (typeof p !== 'number' || !isFinite(p)) continue;
    if (p < bestPct) { bestPct = p; best = i; }
  }
  return best;
}

/** The report block. */
export function resultsBlock(g) {
  return results(g);
}

// --- the runner ----------------------------------------------------------
//
// The impure half: seek, wait, read two counters sixty seconds apart,
// write the row, reload. Every step is wrapped, because a diagnostic
// that throws into a watch page is worse than no diagnostic -- and this
// one runs unattended for six minutes.

export var SHOW_KEY = 'tamescroll.autotest.show';
// The probe waits this long after the seek before it opens its window:
// the delay ring has to refill and the first verdicts have to land, or
// the first seconds of every arm measure a refill rather than the dial.
// Same 8s probe_drops_ab.py uses.
export var SETTLE_MS = 8000;

var armStartedAt = 0;
var running = false;

function now(g) {
  try {
    if (g && g.performance && typeof g.performance.now === 'function') return g.performance.now();
  } catch (e) { /* fall through */ }
  return Date.now();
}
function later(g, fn, ms) {
  try {
    return (g && typeof g.setTimeout === 'function' ? g.setTimeout : setTimeout)(fn, ms);
  } catch (e) {
    return null;
  }
}
function reload(g) {
  try { g.location.reload(); } catch (e) { /* nothing else to try */ }
}

/** Leave a note for the panel to open itself once, after the final
 * reload, so the table he waited six minutes for is on screen. */
export function markShow(g) { writeJson(store(g, 'sessionStorage'), SHOW_KEY, 1); }
export function takeShow(g) {
  var s = store(g, 'sessionStorage');
  var v = readJson(s, SHOW_KEY);
  if (v) writeJson(s, SHOW_KEY, null);
  return !!v;
}

/**
 * Start a run. Returns null on success, or a one-line reason it will
 * not start -- the panel prints that rather than doing nothing, because
 * a button that silently does nothing is the bug he reports most.
 */
export function beginRun(g, video) {
  if (!video) return 'Open a video first — this measures the player.';
  var t = 0;
  try { t = video.currentTime; } catch (e) { t = 0; }
  if (typeof t !== 'number' || !isFinite(t)) return 'The player is not ready yet.';
  if (!store(g, 'sessionStorage')) return 'This page cannot remember the test between reloads.';
  clearResults(g);
  writeRun(g, startRun(t, now(g)));
  reload(g);
  return null;
}

/** Stop a run where it is and put his own dials back on the next load. */
export function abortRun(g) {
  endRun(g);
  running = false;
  reload(g);
}

/** Arm n of m plus the seconds this arm has been measuring, or null. */
export function runProgress(g) {
  var st = readRun(g);
  if (!st) return null;
  return progress(st, armStartedAt ? (now(g) - armStartedAt) / 1000 : 0);
}

function sample(g, video) {
  var q = null;
  try {
    q = video && typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null;
  } catch (e) { q = null; }
  var render = null;
  try { render = typeof g.__TS_GAZE_RENDER === 'function' ? g.__TS_GAZE_RENDER() : null; } catch (e) { render = null; }
  var t = 0;
  try { t = video.currentTime; } catch (e) { t = 0; }
  return {
    now: now(g),
    media: typeof t === 'number' ? t : 0,
    dropped: q && typeof q.droppedVideoFrames === 'number' ? q.droppedVideoFrames : null,
    total: q && typeof q.totalVideoFrames === 'number' ? q.totalVideoFrames : null,
    raf: render && typeof render.raf === 'number' ? render.raf : null,
  };
}

/**
 * Pick the run up on a fresh document. Called once per attached watch
 * player; a second call while a run is in flight is a no-op, because
 * one player attaching twice must not measure the same arm twice.
 *
 * `env` is {video, nativeInfo, codecInfo, onChange}.
 */
export function attachRun(g, env) {
  if (running) return null;
  var st = readRun(g);
  if (!st) return null;
  var video = env && env.video;
  if (!video) return null;
  // The watchdog: an arm armed and never reached a player closes the
  // run rather than leaving an experimental dial on his phone.
  if (staleRun(st, now(g))) { endRun(g); return null; }
  running = true;
  armStartedAt = now(g);

  try {
    video.muted = true;
    video.currentTime = st.mediaTime;
    var p = video.play();
    if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay refused; the counters still move if he presses play */ });
  } catch (e) { /* a seek that fails still measures, just from wherever it is */ }

  later(g, function () {
    var a = sample(g, video);
    armStartedAt = now(g);
    if (env && env.onChange) { try { env.onChange(); } catch (e) { /* the panel is optional */ } }
    later(g, function () {
      var b = sample(g, video);
      var native = null;
      try { native = env && typeof env.nativeInfo === 'function' ? env.nativeInfo() : null; } catch (e) { native = null; }
      var codec = null;
      try { codec = env && typeof env.codecInfo === 'function' ? env.codecInfo() : null; } catch (e) { codec = null; }
      var paint = null;
      try { paint = typeof g.__TS_DELAY_STATS === 'function' ? g.__TS_DELAY_STATS() : null; } catch (e) { paint = null; }
      var totalD = a.total !== null && b.total !== null ? b.total - a.total : 0;
      var wall = (b.now - a.now) / 1000;
      pushResult(g, {
        arm: st.i,
        dropPct: totalD > 0 ? (100 * (b.dropped - a.dropped)) / totalD : null,
        rafHz: a.raf !== null && b.raf !== null && wall > 0 ? (b.raf - a.raf) / wall : null,
        mediaSecs: b.media - a.media,
        wallSecs: wall,
        nativeBackend: (native && native.backend) || 'none',
        codec: (codec && codec.codec) || 'none',
        gl: paint && paint.stats && paint.stats.gl ? 1 : 0,
      });
      var next = nextArm(st, now(g));
      if (next) writeRun(g, next);
      else { endRun(g); markShow(g); }
      running = false;
      reload(g);
    }, ARM_SECS * 1000);
  }, SETTLE_MS);
  return st;
}

export function _resetForTest() { running = false; armStartedAt = 0; }
