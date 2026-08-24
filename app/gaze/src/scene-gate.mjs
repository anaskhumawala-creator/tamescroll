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
// A cut between unrelated shots measures 40-100; slow pans measure
// under ~15. 28 splits them with margin either side.
export var CUT_DELTA = 28;
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
