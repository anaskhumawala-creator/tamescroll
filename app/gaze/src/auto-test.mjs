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
// arms, sixty seconds each, same video, same media time, same counters.
// It is deliberately NOT a new instrument -- the fields below are the
// ones probe_drops_ab.py already prints, so a run off his phone and a
// run off the Redmi are comparable rows.
//
// WHY IT SURVIVES RELOADS. Some arms only take effect on a fresh
// document (DELAY_MS resizes a ring, CODEC_PROBE wraps page APIs before
// the player initialises, PRESENTER_GL attaches at the next attach).
// Applying them in place would measure the previous arm with a new
// label, which is exactly how `v1097-decomp` reported two delay0 arms
// as a duty sweep. So each arm is written down, the page is reloaded,
// and the run picks itself up at boot.
//
// WHY THE ARM IS NOT AN OVERRIDE. His saved dials live behind the
// TsTune bridge (tuning-override.mjs) and are HIS. The arm is a
// temporary layer in sessionStorage that is applied ON TOP at boot and
// thrown away at the end of the run -- so a run that is interrupted by
// closing the tab takes its arm with it, and a run that finishes
// restores nothing because it never overwrote anything. THE ARM STORE
// STAYS ON sessionStorage DELIBERATELY (phase-o O1): it never carries a
// value, only an INDEX into the fixed ARMS table below, which this
// build already knows every entry of -- a page can flip which of six
// fixed, perf-only, already-reviewed arms runs next, and nothing else.
import { applyOne } from './tuning.mjs';
import { overrideCount } from './tuning-override.mjs';

export var RUN_KEY = 'tamescroll.autotest';
export var RESULTS_KEY = 'tamescroll.autotest.results';
export var ARM_SECS = 60;
export var RESULTS_MAX = 12;
// A boot that does not reach a playing video inside this abandons the
// run and puts his own dials back. Without it, one arm that cannot
// start (a navigation away, a player that never attaches) leaves a
// phone running an experimental dial with nothing to switch it off.
// Six arms at ARM_SECS + SETTLE_MS each, plus slack for the reload
// itself and a slow boot -- generous on purpose, this is a ceiling on
// how long a STUCK run survives, not a target.
export var BOOT_TIMEOUT_MS = 30000;

// THE ARMS, IN A FIXED ORDER, BECAUSE THE INDEX IS THE REPORT'S ENUM.
// Never reorder or renumber one -- a stored row from an older build
// would silently change meaning. Append only, with ONE exception:
//
// O4 (phase-o): `noAv1` was removed rather than appended-around. It
// could never do what its label promised -- YouTube's player decides
// the codec via `MediaSource.isTypeSupported` at ~380-530ms after
// document start (measured, probe_av1_caps.py on the Redmi), and this
// arm's dial only reaches the page once the gaze bundle boots and calls
// perf.setNoAv1(), at ~1100-1930ms -- half a second to a second after
// the decision this arm exists to influence. The OTA channel reaches
// the same document-start script (lib.rs no_av1_script reads
// __TS_GAZE_TUNING__ at call time) and is the only channel that can;
// pushing NO_AV1 there is unaffected by this removal. Every reader of a
// stored index past the end already treats it as "no run" (readRun) or
// "unknown mode" (the panel's ARMS[i] || fallback), so an old build's
// leftover index 5 in sessionStorage fails safe rather than mislabels a
// measurement as a codec test that was never one.
export var ARMS = [
  { name: 'control', label: 'Current settings', over: {} },
  { name: 'blurInFrame', label: 'Blur into picture', over: { BLUR_IN_FRAME: 1 } },
  { name: 'presenterGl', label: 'GPU blur', over: { PRESENTER_GL: 1 } },
  { name: 'cpuMask', label: 'Faces on CPU', over: { NATIVE_CPU_MASK: 1 } },
  { name: 'renderEvery', label: 'Redraw every other frame', over: { RENDER_EVERY: 2 } },
];

// O13 (phase-o): the whitelist an arm's `over` object must never touch.
// Not tuning.mjs's OTA whitelist (which rightly allows both classes) --
// this is the narrower one that keeps a page-triggered A/B run from
// ever being able to move a dial that decides who gets covered. A test
// walks every ARMS entry against this list; it is meant to fail the day
// someone appends an arm that reaches for one of these by mistake.
export var PROTECTION_DIALS = [
  'CUT_DELTA', 'GENDER_CLEAR_SCORE', 'GENDER_CLEAR_SCORE_FEMALE',
  'NULL_MINT_NM_FLOOR', 'MEM_TRUST_MAN', 'MEM_TRUST_WOMAN', 'MEM_SIM',
  'PERSON_SKIP_EVERY', 'PTRACK_MIN_COAST_PASSES', 'PTRACK_IOU_MIN',
  'VERDICT_MAX_INTERVAL_MS', 'VERDICT_DUTY', 'GENDER_REFRESH_MS',
  'CUT_PERSON_LOOK', 'DELAY_MS', 'NATIVE_INFER',
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

// O2 (phase-o): WALL CLOCK, NEVER performance.now(), for anything that
// has to survive a reload. performance.now() is zeroed at the start of
// EVERY document, so `nowMs - state.at` across a navigation was
// comparing a fresh small number against a stale one from a document
// that no longer exists -- staleRun's subtraction went negative and a
// run could never be judged stale from outside the document that armed
// it. Date.now() is the same clock before and after a reload.
function wallNow() {
  return Date.now();
}

// --- the state machine, pure --------------------------------------------

/** A fresh run, pinned to the media time it started at so every arm
 * measures the same sixty seconds of footage rather than whatever the
 * video happened to be showing after a reload. */
export function startRun(mediaTime, nowMs) {
  return {
    i: 0,
    mediaTime: typeof mediaTime === 'number' && isFinite(mediaTime) ? mediaTime : 0,
    at: typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : wallNow(),
  };
}

/** The next arm, or null when the last one has been measured. */
export function nextArm(state, nowMs) {
  if (!state) return null;
  var i = state.i + 1;
  if (i >= ARMS.length) return null;
  return { i: i, mediaTime: state.mediaTime, at: typeof nowMs === 'number' ? nowMs : wallNow() };
}

/** A run state is only a run if it names an arm this build has AND that
 * arm is a whole number -- a non-integer index (a hand-edited store, a
 * float that leaked in from somewhere) would otherwise reach `ARMS[i]`
 * as `undefined` in every reader below and throw partway through a
 * boot. An index off the end -- an older build reading a newer store --
 * reads as no run at all, never as arm NaN. */
export function readRun(g) {
  var st = readJson(store(g, 'sessionStorage'), RUN_KEY);
  if (!st || typeof st !== 'object') return null;
  if (typeof st.i !== 'number' || !isFinite(st.i) || st.i % 1 !== 0) return null;
  if (st.i < 0 || st.i >= ARMS.length) return null;
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

/** The temporary override layer for the arm now due, or null. Bounds
 * are already enforced by readRun, so ARMS[st.i] is always defined when
 * st is non-null -- the `||` below is a second line of defence, not the
 * first. */
export function pendingArm(g) {
  var st = readRun(g);
  if (!st) return null;
  var arm = ARMS[st.i];
  return arm ? arm.over : null;
}

/**
 * Apply the pending arm on top of the OTA values and his own overrides.
 * Called once at boot, unconditionally -- BEFORE anything checks
 * whether a player exists.
 *
 * O2 (phase-o): the stale-run check used to live only inside
 * `attachRun`, which a boot with no player (a navigation away, a
 * platform without a watch page, a player that fails to attach) never
 * reaches -- so a stuck arm from a run that never finished could keep
 * re-applying itself, boot after boot, forever, on a page that was
 * never going to finish measuring it. The check is here now, ahead of
 * the apply, so every boot reclaims a stale run before it can move a
 * single dial.
 */
export function applyPendingArm(g) {
  var st = readRun(g);
  if (!st) return {};
  if (staleRun(st, wallNow())) {
    endRun(g);
    return {};
  }
  var arm = ARMS[st.i];
  var over = arm ? arm.over : null;
  var applied = {};
  if (!over) return applied;
  for (var k in over) {
    if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
    var c = applyOne(k, over[k]);
    if (c !== null) applied[k] = c;
  }
  return applied;
}

/** A run whose arm was armed and never came back. `nowMs` and
 * `state.at` must both be Date.now()-shaped -- see wallNow() above. */
export function staleRun(state, nowMs) {
  if (!state) return false;
  var n = typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : wallNow();
  return n - state.at > BOOT_TIMEOUT_MS;
}

/** True once the location is a watch page -- the only place this run is
 * allowed to attach or begin. A home-feed preview reuses the same
 * shared player element a watch page does, so checking the element is
 * not enough; the pathname is the same test `feedPreview()` already
 * uses elsewhere in the gaze runtime (`location.pathname.indexOf(
 * '/watch') !== 0`), inverted and made reusable here so this module
 * does not depend on that closure. */
export function onWatchPage(loc) {
  try {
    var p = loc && loc.pathname;
    return typeof p === 'string' && p.indexOf('/watch') === 0;
  } catch (e) {
    return false;
  }
}

/** Arm n of m and the seconds elapsed, for the progress bar. */
export function progress(state, secs) {
  if (!state) return null;
  var arm = ARMS[state.i] || { label: 'mode ' + state.i };
  var s = typeof secs === 'number' && isFinite(secs) ? Math.max(0, secs) : 0;
  var done = state.i + Math.min(1, s / ARM_SECS);
  return {
    arm: state.i + 1,
    arms: ARMS.length,
    label: arm.label,
    secs: Math.round(s),
    frac: Math.max(0, Math.min(1, done / ARMS.length)),
  };
}

// --- results -------------------------------------------------------------

// The four-value set every native-backend field in this report uses.
// Kept local (not imported from diag-report.mjs, which is the report's
// OWN belt-and-suspenders validator and must not depend on the module
// it validates) -- this is only the FIRST, permissive pass: coerce to a
// safe type, never throw. diag-report.mjs's enumOr does the real
// enum check when the row is folded into the artifact.
function backendOrNone(x) {
  return typeof x === 'string' ? x : 'none';
}

/** One measured arm. Numbers, plus the fields that already have enums
 * in the report; anything else is dropped here rather than at the
 * report's violation walker, where it would kill the whole artifact. */
export function normalizeRow(r) {
  var n = function (x) { return typeof x === 'number' && isFinite(x) ? Math.round(x * 100) / 100 : null; };
  var b01 = function (x) { return x ? 1 : 0; };
  return {
    arm: n(r && r.arm),
    dropPct: n(r && r.dropPct),
    rafHz: n(r && r.rafHz),
    mediaSecs: n(r && r.mediaSecs),
    wallSecs: n(r && r.wallSecs),
    nativeBackend: backendOrNone(r && r.nativeBackend),
    nativeDead: b01(r && r.nativeDead),
    faceBackend: backendOrNone(r && r.faceBackend),
    genderBackend: backendOrNone(r && r.genderBackend),
    personBackend: backendOrNone(r && r.personBackend),
    codec: r && typeof r.codec === 'string' ? r.codec : 'none',
    gl: n(r && r.gl),
    // O5 (phase-o): whether the row can be trusted at all. blurOn is 1
    // only if the pill was ON at BOTH ends of the window -- an arm
    // measured with the pill off measured nothing the dial in question
    // could touch. paused/mini/hidden are 1 if that state was seen at
    // EITHER end, because any one of them can suppress rAF or decoding
    // for part of the window and there is no way to tell how much from
    // outside. overrides is a plain count, taken once at the start.
    blurOn: b01(r && r.blurOn),
    overrides: n(r && r.overrides) || 0,
    paused: b01(r && r.paused),
    mini: b01(r && r.mini),
    hidden: b01(r && r.hidden),
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

// O5 (phase-o): a row measuring less than this much MEDIA TIME is not a
// measurement -- it is a video that was paused, backgrounded, or lost
// most of its window to a slow boot, and its dropPct is measuring
// almost nothing. ARM_SECS is 60; 45 leaves room for the settle-to-play
// slop without accepting a row that mostly measured silence.
export var BEST_MIN_MEDIA_SECS = 45;

/** Index of the arm with the fewest dropped frames among rows that
 * actually ran long enough to trust, or -1. Ties keep the earlier arm,
 * so "current settings" wins a tie and nothing gets recommended on
 * noise. */
export function bestRow(rows) {
  var best = -1;
  var bestPct = Infinity;
  for (var i = 0; i < (rows || []).length; i++) {
    var row = rows[i];
    if (!row) continue;
    var p = row.dropPct;
    if (typeof p !== 'number' || !isFinite(p)) continue;
    var m = row.mediaSecs;
    if (typeof m !== 'number' || !isFinite(m) || m < BEST_MIN_MEDIA_SECS) continue;
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
// The video id the in-flight arm attached to. `attachRun` seeks the
// video, and a seek fires `loadstart` on the SAME element -- so the
// unconditional cancel init-entry ran on loadstart cancelled the arm it
// had just started, and every run on the Redmi sat at arm 0 forever
// (1100). cancelRunOnLoad cancels only when the video under the run
// has actually changed.
var attachedVideo = null;
var settleTimer = null;
var armTimer = null;

function now(g) {
  // Elapsed-time display only (the progress bar) -- staleness above
  // uses wallNow() exclusively, never this. performance.now() is fine
  // here because both reads happen inside the SAME document.
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
function clearLater(g, id) {
  if (id === null || id === undefined) return;
  try {
    (g && typeof g.clearTimeout === 'function' ? g.clearTimeout : clearTimeout)(id);
  } catch (e) { /* nothing to clear */ }
}
function reload(g) {
  try { g.location.reload(); } catch (e) { /* nothing else to try */ }
}

/** O2 (phase-o): drop any in-flight settle/measure timer without
 * recording a row and without reloading. Called on navigation away
 * from the page a run started measuring on -- an SPA hop to another
 * /watch, a hop off /watch entirely, or the document unloading -- so a
 * timer armed by THIS document can never fire against a DIFFERENT one
 * and push a corrupted row or an unwanted reload. The run's own stored
 * state is left untouched: if the next video to attach is on a watch
 * page again, `attachRun` picks the same arm back up and measures it
 * from scratch. */
export function cancelRun(g) {
  clearLater(g, settleTimer);
  clearLater(g, armTimer);
  settleTimer = null;
  armTimer = null;
  running = false;
  attachedVideo = null;
}

/** The `v` parameter of a watch location, or null. */
export function videoIdOf(loc) {
  try {
    var src = loc && loc.search != null ? loc.search : loc;
    var m = /[?&]v=([^&#]+)/.exec(String(src));
    return m ? m[1] : null;
  } catch (e) {
    return null;
  }
}

/** The loadstart hook. A loadstart on the video the arm attached to is
 * our own seek (or a quality change) and must not cancel the arm; a
 * loadstart under a different video id is a real navigation and does.
 * Returns true when it cancelled. */
export function cancelRunOnLoad(g) {
  if (!running) return false;
  var idNow = videoIdOf(g && g.location);
  if (attachedVideo && idNow === attachedVideo) return false;
  cancelRun(g);
  return true;
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
  if (g && g.location && !onWatchPage(g.location)) return 'Open a watch page first — this measures the player.';
  if (!video) return 'Open a video first — this measures the player.';
  var t = 0;
  try { t = video.currentTime; } catch (e) { t = 0; }
  if (typeof t !== 'number' || !isFinite(t)) return 'The player is not ready yet.';
  if (!store(g, 'sessionStorage')) return 'This page cannot remember the test between reloads.';
  clearResults(g);
  writeRun(g, startRun(t, wallNow()));
  reload(g);
  return null;
}

/** Stop a run where it is and put his own dials back on the next load. */
export function abortRun(g) {
  cancelRun(g);
  endRun(g);
  reload(g);
}

/** Arm n of m plus the seconds this arm has been measuring, or null. */
export function runProgress(g) {
  var st = readRun(g);
  if (!st) return null;
  return progress(st, armStartedAt ? (now(g) - armStartedAt) / 1000 : 0);
}

function sample(g, video, env) {
  var q = null;
  try {
    q = video && typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null;
  } catch (e) { q = null; }
  var render = null;
  try { render = typeof g.__TS_GAZE_RENDER === 'function' ? g.__TS_GAZE_RENDER() : null; } catch (e) { render = null; }
  var t = 0;
  try { t = video.currentTime; } catch (e) { t = 0; }
  var paused = false;
  try { paused = !!(video && video.paused); } catch (e) { paused = false; }
  var mini = false;
  try { mini = !!(g && g.document && g.document.documentElement && g.document.documentElement.classList.contains('ts-mini')); } catch (e) { mini = false; }
  var hidden = false;
  try { hidden = !!(g && g.document && g.document.hidden); } catch (e) { hidden = false; }
  var blurOn = false;
  try { blurOn = !!(env && typeof env.blurOn === 'function' && env.blurOn()); } catch (e) { blurOn = false; }
  return {
    now: now(g),
    media: typeof t === 'number' ? t : 0,
    dropped: q && typeof q.droppedVideoFrames === 'number' ? q.droppedVideoFrames : null,
    total: q && typeof q.totalVideoFrames === 'number' ? q.totalVideoFrames : null,
    raf: render && typeof render.raf === 'number' ? render.raf : null,
    paused: paused,
    mini: mini,
    hidden: hidden,
    blurOn: blurOn,
  };
}

/**
 * Pick the run up on a fresh document. Called once per attached watch
 * player; a second call while a run is in flight is a no-op, because
 * one player attaching twice must not measure the same arm twice.
 *
 * O2 (phase-o): refuses off a watch page (a feed preview reuses the
 * same player element a real watch page does, and this run is only
 * meaningful pinned to the media time of a video he actually opened).
 *
 * `env` is {video, nativeInfo, codecInfo, blurOn, onChange}.
 */
export function attachRun(g, env) {
  if (running) return null;
  if (g && g.location && !onWatchPage(g.location)) return null;
  var st = readRun(g);
  if (!st) return null;
  var video = env && env.video;
  if (!video) return null;
  // The watchdog also runs at boot (applyPendingArm) before any dial
  // moves; this second check is for a run that went stale WHILE this
  // document was already open and waiting for a player to attach.
  if (staleRun(st, wallNow())) { endRun(g); return null; }
  running = true;
  attachedVideo = videoIdOf(g && g.location);
  armStartedAt = now(g);

  try {
    video.muted = true;
    video.currentTime = st.mediaTime;
    var p = video.play();
    if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay refused; the counters still move if he presses play */ });
  } catch (e) { /* a seek that fails still measures, just from wherever it is */ }

  settleTimer = later(g, function () {
    settleTimer = null;
    var a = sample(g, video, env);
    var overridesAtStart = 0;
    try { overridesAtStart = overrideCount(g); } catch (e) { overridesAtStart = 0; }
    armStartedAt = now(g);
    if (env && env.onChange) { try { env.onChange(); } catch (e) { /* the panel is optional */ } }
    armTimer = later(g, function () {
      armTimer = null;
      var b = sample(g, video, env);
      var native = null;
      try { native = env && typeof env.nativeInfo === 'function' ? env.nativeInfo() : null; } catch (e) { native = null; }
      var backends = (native && native.backends) || {};
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
        nativeDead: !!(native && native.dead),
        faceBackend: backends['1'] || 'none',
        genderBackend: backends['2'] || 'none',
        personBackend: backends['3'] || 'none',
        codec: (codec && codec.codec) || 'none',
        gl: paint && paint.stats && paint.stats.gl ? 1 : 0,
        blurOn: a.blurOn && b.blurOn,
        overrides: overridesAtStart,
        paused: a.paused || b.paused,
        mini: a.mini || b.mini,
        hidden: a.hidden || b.hidden,
      });
      var next = nextArm(st, wallNow());
      if (next) writeRun(g, next);
      else { endRun(g); markShow(g); }
      running = false;
      reload(g);
    }, ARM_SECS * 1000);
  }, SETTLE_MS);
  return st;
}

export function _resetForTest() { running = false; armStartedAt = 0; settleTimer = null; armTimer = null; attachedVideo = null; }
