// WHERE DO REAL CUTS ACTUALLY START?
//
// scene-gate.test.mjs pins CUT_DELTA <= 54.9 and calls that "where real
// cuts start". It is not: 54.9 is the p95 of ALL 600 luma deltas on one
// of his videos -- 5% of ordinary samples are above it, cut or not. That
// number is the reason CUT_DELTA 60 was reverted tonight even though the
// corpus sweep wanted it, so it is worth measuring properly.
//
// GROUND TRUTH FROM AN INDEPENDENT INSTRUMENT. ffmpeg's `scdet` filter
// scores each frame against the previous one in its own colour space
// with its own algorithm; it knows nothing about our 16x16 luma grid.
// Two instruments that agree are evidence; our gate agreeing with itself
// is not. (This is the same reason corpus-cuts imports lumaGrid from the
// shipped bundle rather than reimplementing it.)
//
// Reads, at 10Hz -- the app's own gate rate:
//   CUT rows      the delta our gate measures AT a frame ffmpeg calls a
//                 cut. A threshold above this population MISSES cuts.
//   NON-CUT rows  the delta everywhere else. A threshold inside this
//                 population fires on ORDINARY MOTION, which is what
//                 cost a cleared man his clear 39 times in 90s at 28.
// The gap between them, if there is one, is where CUT_DELTA belongs.
import fs from 'fs';
import { spawnSync } from 'child_process';
import { ROOT } from './corpus-lib.mjs';
import './_build.mjs';
import { lumaGrid, meanAbsDelta, GATE_SIZE, CUT_DELTA } from './.cache/shipped.mjs';

const RATE = 10, N = GATE_SIZE, CELL = N * N * 3;
// ffmpeg's own default is 10; lower admits more candidates, and the
// point is to be GENEROUS with ground truth and let the delta
// distributions separate rather than to pre-filter them.
const SCDET = Number(process.env.SCDET || 8);

function grids(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file,
    '-vf', `fps=${RATE},scale=${N}:${N}:flags=area`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
  const out = [];
  for (let i = 0; i + CELL <= r.stdout.length; i += CELL) {
    const rgb = r.stdout.subarray(i, i + CELL);
    const rgba = new Uint8ClampedArray(N * N * 4);
    for (let p = 0, j = 0; p < CELL; p += 3, j += 4) {
      rgba[j] = rgb[p]; rgba[j + 1] = rgb[p + 1]; rgba[j + 2] = rgb[p + 2]; rgba[j + 3] = 255;
    }
    out.push(lumaGrid(rgba, N * N));
  }
  return out;
}

function sceneTimes(file) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', file,
    '-vf', `scdet=threshold=${SCDET}`, '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  const txt = (r.stderr || '').toString();
  const ts = [];
  const rx = /lavfi\.scd\.time:\s*([0-9.]+)/g;
  let m; while ((m = rx.exec(txt))) ts.push(parseFloat(m[1]));
  return ts;
}

const q = (a, p) => (a.length ? a[Math.floor(p * (a.length - 1))] : NaN);
const files = fs.readdirSync(`${ROOT}/video`).filter((f) => f.endsWith('.mp4'));
const cutD = [], restD = [];
let totalCuts = 0;

for (const f of files) {
  const path = `${ROOT}/video/${f}`;
  const g = grids(path);
  const times = sceneTimes(path);
  totalCuts += times.length;
  // A cut at time t lands between the 10Hz samples floor(t*10) and the
  // next one, so the delta that SEES it is the one at index ceil(t*10).
  const cutIdx = new Set(times.map((t) => Math.min(g.length - 1, Math.max(1, Math.ceil(t * RATE)))));
  for (let i = 1; i < g.length; i++) {
    const d = meanAbsDelta(g[i - 1], g[i]);
    (cutIdx.has(i) ? cutD : restD).push(d);
  }
  process.stdout.write(`${f.padEnd(20)} 10Hz ${String(g.length).padStart(5)}  scdet cuts ${times.length}\n`);
}
cutD.sort((a, b) => a - b); restD.sort((a, b) => a - b);
console.log(`\nscdet threshold ${SCDET}, ${totalCuts} cuts over ${files.length} videos`);
console.log(`AT A CUT      n ${cutD.length}  p05 ${q(cutD, 0.05).toFixed(1)}` +
  `  p25 ${q(cutD, 0.25).toFixed(1)}  p50 ${q(cutD, 0.5).toFixed(1)}` +
  `  p95 ${q(cutD, 0.95).toFixed(1)}  max ${q(cutD, 1).toFixed(1)}`);
console.log(`EVERYWHERE    n ${restD.length}  p50 ${q(restD, 0.5).toFixed(1)}` +
  `  p90 ${q(restD, 0.9).toFixed(1)}  p95 ${q(restD, 0.95).toFixed(1)}` +
  `  p99 ${q(restD, 0.99).toFixed(1)}  max ${q(restD, 1).toFixed(1)}`);
console.log('\nthreshold   cuts caught        ordinary frames wiped');
for (const t of [28, 40, 50, 54.9, 60, 75, 90]) {
  const c = cutD.filter((d) => d >= t).length;
  const r = restD.filter((d) => d >= t).length;
  console.log(String(t).padEnd(12)
    + `${c}/${cutD.length} (${(100 * c / (cutD.length || 1)).toFixed(1)}%)`.padEnd(19)
    + `${r} (${(100 * r / (restD.length || 1)).toFixed(2)}%)`
    + (t === CUT_DELTA ? '   <- shipped' : ''));
}
