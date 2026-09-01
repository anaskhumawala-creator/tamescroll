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
// 2026-09-02, loop 41: SWEPT for the first time, and NOT MOVED. Loop 40 recorded "CUT_DELTA cannot
// be swept on the corpus at all" because bank/cuts.json holds booleans;
// that was true of the BANK and never of the corpus, since the deltas
// come from the video. `corpus-cuts.mjs <delta> <out>` re-derives a bank
// per value and bench/cut-sweep.mjs scores them. 18 labelled windows,
// his 1.5s cadence:
//
//   man   50 -> 60: exposure 71.0 -> 67.0, false cover 167.5 -> 163.5,
//                   phantom 149.0 -> 158.5, births 310 -> 270
//   woman 50 -> 60: exposure 60.5 -> 50.0, false cover 250.0 -> 259.0,
//                   phantom 180.0 -> 196.5
//
// EXPOSURE FALLS MONOTONICALLY IN BOTH MODES all the way to 90, where
// the gate is effectively off -- which is loop 39's finding quantified.
// 60 WAS BUILT AND THEN REVERTED, by this repo's own test. scene-gate's
// test pins CUT_DELTA <= 54.9, the p95 of 600 live luma deltas off his
// phone, on the reasoning that above it real cuts get missed. So the
// CORPUS and the DEVICE disagree: the corpus says missing cuts is cheap
// (exposure falls), his own footage says 60 sits above where real cuts
// start.
//
// Both can be true -- missing a cut costs exposure only when a stale
// CLEARED track absorbs a new person, and the corpus prices that as
// smaller than the churn a false cut causes. But it is corpus evidence
// against a device measurement, on a PROTECTION constant, with the cost
// landing on PHANTOM, which is his loudest complaint ("random blur marks
// here and there"). That is not a trade to take on one arm.
//
// Loop 39's caveat also still binds: the corpus wipes WITHOUT the
// immediate full pass the app runs, so only the DIFFERENCE between two
// cut arms is fair and the absolute exposure of every row overstates.
// WHAT WOULD SETTLE IT: the 54.9 is the p95 of ALL deltas on one video,
// not a measurement of where cuts start. Label real cuts on his footage
// and read the delta AT them.
//
// The floor is not up for negotiation: it may never return under the p90
// of his footage's ordinary motion (28.2), which is what made 28 fire on
// 10.2% of samples and cost a cleared man his clear 39 times in 90s.
export function setCutDelta(v) { CUT_DELTA = v; }
