// WHERE DO REAL CUTS ACTUALLY START?
//
// GROUND TRUTH FROM AN INDEPENDENT INSTRUMENT. ffmpeg's `scdet` filter
// scores each frame against the previous one in its own colour space
// with its own algorithm; it knows nothing about our 16x16 luma grid.
// Two instruments that agree is evidence; our gate agreeing with itself
// is not. (Same reason corpus-cuts imports lumaGrid from the shipped
// bundle rather than reimplementing it.)
//
// THIS FILE HAS BEEN WRONG ONCE, IN TWO WAYS AT THE SAME TIME, AND BOTH
// ARE WHY IT LOOKS THE WAY IT DOES NOW (engine-findings 10j):
//
//  1. IT PAIRED A CUT WITH THE WRONG SAMPLE. A cut at time t was matched
//     to the delta at ceil(t*RATE); the correct sample is round(t*RATE).
//     They differ whenever frac(t*RATE) < 0.5, so about half the "at a
//     cut" rows were the post-cut STEADY frame. That is not a judgement
//     call now -- the pairing is swept below, and the correct offset
//     reads a median of 49.6 against ~2.0 for every neighbour, a 25x
//     separation. Any alignment argument loses to that table.
//     The tell it produced: p05 0.0 at a "real cut", a labelled shot
//     change where the picture did not move at all. It was written up as
//     "a cut between similarly-lit shots is invisible to a luma grid".
//     It was an off-by-one.
//
//  2. THE GROUND-TRUTH THRESHOLD WAS A HIDDEN DIAL. The committed
//     default was 8 and the committed table came from 30. Nobody could
//     reproduce it, and the two disagree by a factor of FOUR on the
//     number that decided a shipped constant.
//
// SO BOTH ARE SWEPT AND NEITHER IS CHOSEN HERE. scdet emits a SCORE per
// event, so one permissive run yields every stricter threshold by
// filtering, and the answer is read ACROSS the sweep.
//
// HOW TO READ THE SCDET AXIS: low-score events are gradual changes and
// camera motion, which do NOT invalidate identity association -- the
// tracker follows them and should. High-score events are hard shot
// changes, which is the only thing this gate exists to catch. The rows
// that bear on CUT_DELTA are the HIGH ones. Reading recall off a
// low-score row is measuring the gate against a job it does not have.
import fs from 'fs';
import { spawnSync } from 'child_process';
import { ROOT } from './corpus-lib.mjs';
import './_build.mjs';
import { lumaGrid, meanAbsDelta, GATE_SIZE, CUT_DELTA } from './.cache/shipped.mjs';

const RATE = 10, N = GATE_SIZE, CELL = N * N * 3;
const CACHE = `${ROOT}/bank/cut-truth-cache.json`;
const SCDET_SWEEP = (process.env.SCDET || '8,15,20,25,30').split(',').map(Number);

function build() {
  const files = fs.readdirSync(`${ROOT}/video`).filter((f) => f.endsWith('.mp4'));
  const out = {};
  for (const f of files) {
    const p = `${ROOT}/video/${f}`;
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', p,
      '-vf', `fps=${RATE},scale=${N}:${N}:flags=area`,
      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
    const g = [];
    for (let i = 0; i + CELL <= r.stdout.length; i += CELL) {
      const rgb = r.stdout.subarray(i, i + CELL);
      const rgba = new Uint8ClampedArray(N * N * 4);
      for (let q = 0, j = 0; q < CELL; q += 3, j += 4) {
        rgba[j] = rgb[q]; rgba[j + 1] = rgb[q + 1]; rgba[j + 2] = rgb[q + 2]; rgba[j + 3] = 255;
      }
      g.push(lumaGrid(rgba, N * N));
    }
    const d = [];
    for (let i = 1; i < g.length; i++) d.push(meanAbsDelta(g[i - 1], g[i]));
    // ONE permissive run at threshold 1; every stricter ground truth is
    // a filter on the score it already reports. This is what makes the
    // scdet axis a sweep instead of a choice.
    const s = spawnSync('ffmpeg', ['-v', 'info', '-i', p,
      '-vf', 'scdet=threshold=1', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
    const ev = [];
    const rx = /lavfi\.scd\.score:\s*([0-9.]+),\s*lavfi\.scd\.time:\s*([0-9.]+)/g;
    let m; while ((m = rx.exec((s.stderr || '').toString()))) ev.push([parseFloat(m[1]), parseFloat(m[2])]);
    out[f] = { d, ev };
    process.stdout.write(`${f.padEnd(20)} ${String(d.length + 1).padStart(6)} samples  ${ev.length} scdet events\n`);
  }
  fs.writeFileSync(CACHE, JSON.stringify(out));
  return out;
}

const cache = fs.existsSync(CACHE) && !process.env.REBUILD
  ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : build();

const q = (a, p) => (a.length ? a[Math.floor(p * (a.length - 1))] : NaN);
// d[i] is the delta between sample i and sample i+1, so sample s reads d[s-1].
function populations(scdet, off) {
  const cut = [], rest = [];
  for (const f in cache) {
    const { d, ev } = cache[f];
    const idx = new Set();
    for (const [sc, t] of ev) {
      if (sc < scdet) continue;
      const i = Math.round(t * RATE) + off - 1;
      if (i >= 0 && i < d.length) idx.add(i);
    }
    for (let i = 0; i < d.length; i++) (idx.has(i) ? cut : rest).push(d[i]);
  }
  cut.sort((a, b) => a - b); rest.sort((a, b) => a - b);
  return { cut, rest };
}

// --- the pairing, established rather than assumed ---
console.log('\n=== PAIRING SWEEP (scdet >= 20) ===');
console.log('offset     n     p05     p25     p50     p75');
let best = null;
for (const off of [-2, -1, 0, 1, 2]) {
  const { cut } = populations(20, off);
  const p50 = q(cut, 0.5);
  console.log(`${String(off).padStart(6)}  ${String(cut.length).padStart(5)}`
    + [0.05, 0.25, 0.5, 0.75].map((p) => q(cut, p).toFixed(1).padStart(8)).join('')
    + (off === 0 ? '   <- round(t*RATE), what this file uses' : ''));
  if (!best || p50 > best.p50) best = { off, p50 };
}
if (best.off !== 0) throw new Error(
  `the correct pairing is round(t*RATE)${best.off > 0 ? '+' : ''}${best.off}, not round(t*RATE). `
  + 'Every number below would be measured against the wrong sample. Fix populations() before reading it.');
console.log('  offset 0 wins by a wide margin -- a wrong pairing substitutes the\n'
  + '  post-cut steady frame and collapses the median toward the ordinary one.');

// --- and the answer, across ground truths rather than at one ---
for (const sc of SCDET_SWEEP) {
  const { cut, rest } = populations(sc, 0);
  console.log(`\n--- scdet >= ${sc}: ${cut.length} cuts, ${rest.length} ordinary`
    + `  (at a cut: p05 ${q(cut, 0.05).toFixed(1)}  p50 ${q(cut, 0.5).toFixed(1)}`
    + `  p95 ${q(cut, 0.95).toFixed(1)}) ---`);
  console.log('  CUT_DELTA  cuts caught          ordinary wiped');
  for (const t of [28, 40, 50, 60, 75, 90]) {
    const c = cut.filter((d) => d >= t).length, r = rest.filter((d) => d >= t).length;
    console.log(`  ${String(t).padEnd(10)} ${`${c}/${cut.length} (${(100 * c / (cut.length || 1)).toFixed(1)}%)`.padEnd(21)}`
      + `${r} (${(100 * r / (rest.length || 1)).toFixed(2)}%)`
      + (t === CUT_DELTA ? '   <- shipped' : ''));
  }
}
