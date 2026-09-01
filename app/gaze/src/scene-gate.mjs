// Scene-change gate (blur v2 Stage 1, docs/plan-blur-v2.md): a 16x16
// luma thumbnail per gate tick classifies the player's motion so the
// sampler can spend inference where pixels actually changed — a hard
// cut forces an immediate detection pass (cuts are where new people
// appear), a static scene relaxes cadence toward 1Hz, normal motion
// leaves the adaptive cadence alone. Pure math here; the canvas draw
// and scheduling live in init-entry.
//
// Knobs registered in docs/detection-engine.md.
export var GATE_SIZE = 16;
// Mean absolute gray delta (0..255 scale) at or above this = hard cut.
// A cut between unrelated shots measures 40-100.
//
// "SLOW PANS MEASURE UNDER ~15" IS FALSE FOR HANDHELD FOOTAGE, and it
// is what put this at 28. Read live off his phone's own 600-sample
// luma ring, on the vlog he was complaining about: deltas run p50 8.7,
// p75 16.3, **p90 28.2**, p95 54.9, max 108.5. So 28 sat exactly on the
// ninetieth percentile of ORDINARY CAMERA MOTION and fired on 10.2% of
// samples -- `cutDetected` 39 in a 90-second window.
//
// EVERY FALSE CUT COSTS A CLEARED MAN HIS CLEAR. A cut wipes the
// tracks, so he is re-born blurred and has to earn the clear again, and
// a cut landing while a pass is in flight DROPS that pass
// (`passDropped` 29 against those 39 cuts). That is the owner's report
// in one line: "Linus is fully blurred ... the blur stays up longer".
//
// 50 sits in the gap the same distribution shows between motion (p90
// 28.2) and cuts (p95 54.9), so it keeps every real cut and drops
// roughly half of the false ones.
//
// THE COST OF MISSING A CUT IS BOUNDED, AND IT RUNS THE OTHER WAY.
// Raising this can only move behaviour toward the cut-never-wipes arm,
// and on the 18-window labelled corpus that arm is BETTER on both of
// the numbers that matter -- man 81.0 -> 53.5s exposure and 218.0 ->
// 154.0s false cover, woman 85.0 -> 41.5s and 223.5 -> 196.0s -- and
// worse only on phantom (144 -> 165s, 141.5 -> 181.5s). Loop 39's
// caveat still applies and is why this is a bound and not a licence to
// delete the gate: that arm wipes WITHOUT the immediate full pass the
// app does, so its absolute exposure overstates and only the
// DIFFERENCE between two cut arms is fair.
export var CUT_DELTA = 50;
// At or below this = static scene (talking-head letterboxes, paused
// motion). Video noise on a still shot measures ~1-2.
export var STATIC_DELTA = 3;
// Floor between cut-forced passes: flash-edit sequences (music videos)
// must not turn the gate into a CPU spike.
export var CUT_MIN_GAP_MS = 250;
// Cadence floor while static (and nothing is mid-verdict): the scene
// isn't changing, so ~1Hz keeps a safety net without burning the GPU.
export var STATIC_INTERVAL_MS = 1000;

/** RGBA bytes -> per-pixel gray levels (0..255). */
export function lumaGrid(rgba, count) {
  var out = new Float32Array(count);
  for (var i = 0; i < count; i++) {
    out[i] = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3;
  }
  return out;
}

/** Mean absolute difference between two equal-length luma grids. */
export function meanAbsDelta(a, b) {
  var n = Math.min(a.length, b.length);
  if (!n) return 0;
  var sum = 0;
  for (var i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/** Delta -> 'cut' | 'static' | 'motion'. */
export function classifyScene(delta) {
  if (delta >= CUT_DELTA) return 'cut';
  if (delta <= STATIC_DELTA) return 'static';
  return 'motion';
}

/** OTA tuning setter (src/tuning.mjs owns the range and the clamp). */
export function setCutDelta(v) { CUT_DELTA = v; }
