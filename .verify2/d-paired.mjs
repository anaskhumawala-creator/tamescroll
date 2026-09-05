// PART 4b -- the unit was too strict, and the gain must be priced PAIRED.
// mRun above split a real track every time the detector re-ordered its boxes
// (`bi` is a box slot, not an identity). Rebuilt on frame contiguity alone.
import { load, barFor, falseCover, exposure, auc, pct, mean, sortedAsc, barForSorted, falseCoverSorted } from './lib.mjs';

const rows = load(process.argv[2] || 'grey');
const TARGET = 0.016;

// contiguous run = same cid + same sampling window + consecutive frame index,
// box slot IGNORED. One read per (cid, win, fi) -- if the same cid appears
// twice in one frame, keep the first (it is a labelling artefact, 0 rows here).
const g = new Map();
for (const r of rows) { const k = r.cid + '|' + r.win; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
const runs = [];
let dupFrames = 0;
for (const [, v] of g) {
  v.sort((a, b) => a.fi - b.fi || a.bi - b.bi);
  let cur = [v[0]];
  for (let i = 1; i < v.length; i++) {
    if (v[i].fi === v[i - 1].fi) { dupFrames++; cur.push(v[i]); }
    else if (v[i].fi === v[i - 1].fi + 1) cur.push(v[i]);
    else { runs.push(cur); cur = [v[i]]; }
  }
  runs.push(cur);
}
console.log('runs (cid+window+frame-contiguous): ' + runs.length
  + '   p50 len ' + med(runs.map((r) => r.length)) + '   mean ' + mean(runs.map((r) => r.length)).toFixed(1)
  + '   max ' + Math.max(...runs.map((r) => r.length)) + '   same-frame duplicate reads ' + dupFrames);

for (const run of runs) { const m = mean(run.map((r) => r.raw)); for (const r of run) r.mRun2 = m; }
for (const K of [2, 3, 4, 6, 8, 12, 16, 32]) {
  for (const run of runs) {
    for (let i = 0; i < run.length; i++) {
      run[i]['k' + K] = mean(run.slice(Math.max(0, i - K + 1), i + 1).map((r) => r.raw));
    }
  }
}
{
  const gm = new Map();
  for (const r of rows) { if (!gm.has(r.cid)) gm.set(r.cid, []); gm.get(r.cid).push(r); }
  for (const [, v] of gm) { const m = mean(v.map((r) => r.raw)); for (const r of v) r.mCid = m; }
  const gu = new Map();
  for (const r of rows) { if (!gu.has(r.unit)) gu.set(r.unit, []); gu.get(r.unit).push(r); }
  for (const [, v] of gu) { const m = mean(v.map((r) => r.raw)); for (const r of v) r.mUnit = m; }
}

const ARMS = ['raw', 'k2', 'k3', 'k4', 'k6', 'k8', 'k12', 'k16', 'k32', 'mRun2', 'mUnit', 'mCid'];
const LABEL = {
  raw: 'per read -- what ships', k2: 'causal, last 2 reads (1.0s of track)',
  k3: 'causal, last 3', k4: 'causal, last 4 (1.5s -- his DELAY_MS)',
  k6: 'causal, last 6', k8: 'causal, last 8 (3.5s)', k12: 'causal, last 12',
  k16: 'causal, last 16', k32: 'causal, last 32',
  mRun2: 'whole run, ACAUSAL (uses the future)', mUnit: 'whole (cid, window), acausal',
  mCid: 'whole cid, acausal + joins across windows',
};

const F = rows.filter((r) => r.who === 'woman');
const M = rows.filter((r) => r.who === 'man');

// PAIRED identity bootstrap: resample the 51 identities, recompute BOTH arms
// on the same resample, and take the difference. Unpaired CIs on this corpus
// are dominated by which identities got drawn, and hide the effect.
function pairedBoot(base, k, B = 2000) {
  let s = 99991;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const byId = new Map();
  for (const r of rows) { if (!byId.has(r.cid)) byId.set(r.cid, []); byId.get(r.cid).push(r); }
  const ids = [...byId.keys()];
  const d = [];
  for (let b = 0; b < B; b++) {
    const fB = [], fK = [], mB = [], mK = [];
    for (let i = 0; i < ids.length; i++) {
      for (const r of byId.get(ids[Math.floor(rnd() * ids.length)])) {
        if (r.who === 'woman') { fB.push(r[base]); fK.push(r[k]); } else { mB.push(r[base]); mK.push(r[k]); }
      }
    }
    if (!fB.length || !mB.length) continue;
    fB.sort((x, y) => x - y); fK.sort((x, y) => x - y); mB.sort((x, y) => x - y); mK.sort((x, y) => x - y);
    const b1 = barForSorted(fB, TARGET), b2 = barForSorted(fK, TARGET);
    if (b1 === null || b2 === null) continue;
    d.push(falseCoverSorted(mB, b1) - falseCoverSorted(mK, b2));
  }
  d.sort((x, y) => x - y);
  return [d[Math.floor(0.025 * d.length)], d[Math.floor(0.975 * d.length)], d.filter((x) => x <= 0).length / d.length];
}

// THE FAST PATH MUST AGREE WITH THE SCAN THAT REPRODUCED FINDING 47.
{
  const fs_ = sortedAsc(rows.filter((r) => r.who === 'woman'), 'raw');
  const ms_ = sortedAsc(rows.filter((r) => r.who === 'man'), 'raw');
  const a1 = barForSorted(fs_, TARGET), b1 = barFor(rows.filter((r) => r.who === 'woman'), 'raw', TARGET);
  const c1 = falseCoverSorted(ms_, a1), d1 = falseCover(rows.filter((r) => r.who === 'man'), 'raw', b1);
  if (Math.abs(a1 - b1) > 1e-9 || Math.abs(c1 - d1) > 1e-12) throw new Error('fast path disagrees: ' + [a1, b1, c1, d1]);
  console.log('fast-path check: bar ' + a1.toFixed(3) + ' falseCover ' + pct(c1) + ' -- agrees with the scan that reproduced finding 47');
}

console.log('\nMATCHED EXPOSURE <=1.6%.  gain = false cover saved vs per-read.');
console.log('  ' + 'arm'.padEnd(7) + 'bar'.padStart(7) + 'expo'.padStart(7) + 'fCover'.padStart(9)
  + 'gain'.padStart(8) + '   95% CI on the GAIN (paired, by id)'.padEnd(38) + 'p(<=0)'.padStart(8) + 'AUC'.padStart(9) + '  ' + 'unit');
for (const k of ARMS) {
  const b = barFor(F, k, TARGET);
  const fc = falseCover(M, k, b);
  const base = falseCover(M, 'raw', barFor(F, 'raw', TARGET));
  let ci = ['', '', ''];
  if (k !== 'raw') ci = pairedBoot('raw', k);
  console.log('  ' + k.padEnd(7) + b.toFixed(3).padStart(7) + pct(exposure(F, k, b)).padStart(7)
    + pct(fc).padStart(9) + (k === 'raw' ? '--' : ((base - fc) * 100).toFixed(1) + ' pts').padStart(8)
    + (k === 'raw' ? '' : '   [' + (ci[0] * 100).toFixed(1) + ' - ' + (ci[1] * 100).toFixed(1) + ' pts]').padEnd(38)
    + (k === 'raw' ? '' : ci[2].toFixed(3)).padStart(8)
    + auc(rows, k).toFixed(4).padStart(9) + '  ' + LABEL[k]);
}
console.log('  p(<=0) is the bootstrap fraction where the arm did NOT beat per-read.');

// WHO PAYS AND WHO IS PAID. Per-identity, not per-read.
console.log('\nPER IDENTITY at each arm’s own matched bar (identities with n>=5).');
const byId = new Map();
for (const r of rows) { if (!byId.has(r.cid)) byId.set(r.cid, []); byId.get(r.cid).push(r); }
const bars = {}; for (const k of ARMS) bars[k] = barFor(F, k, TARGET);
const show = ['raw', 'k4', 'k8', 'mRun2', 'mUnit', 'mCid'];
console.log('  ' + 'cid'.padEnd(17) + 'who'.padEnd(6) + 'n'.padStart(5) + 'mean'.padStart(7)
  + show.map((k) => k.padStart(9)).join('') + '   (% of that id’s reads in error)');
for (const [cid, v] of [...byId].sort((a, b) => b[1].length - a[1].length)) {
  if (v.length < 5) continue;
  const who = v[0].who;
  const cells = show.map((k) => {
    const bad = who === 'woman' ? v.filter((r) => r[k] >= bars[k]).length : v.filter((r) => r[k] < bars[k]).length;
    return pct(bad / v.length).padStart(9);
  });
  console.log('  ' + cid.padEnd(17) + who.padEnd(6) + String(v.length).padStart(5)
    + mean(v.map((r) => r.raw)).toFixed(3).padStart(7) + cells.join(''));
}

// Where does mCid's extra win over the causal arms actually come from?
console.log('\nWHERE THE ACAUSAL ARMS’ EXTRA WIN SITS -- men falsely covered, by identity');
console.log('  ' + 'cid'.padEnd(17) + 'n'.padStart(5) + show.map((k) => k.padStart(9)).join(''));
let tot = {}; for (const k of show) tot[k] = 0;
for (const [cid, v] of [...byId].sort((a, b) => b[1].length - a[1].length)) {
  if (v[0].who !== 'man') continue;
  const cells = show.map((k) => { const n = v.filter((r) => r[k] < bars[k]).length; tot[k] += n; return String(n).padStart(9); });
  if (cells.some((c) => Number(c) > 0)) console.log('  ' + cid.padEnd(17) + String(v.length).padStart(5) + cells.join(''));
}
console.log('  ' + 'TOTAL'.padEnd(17) + String(M.length).padStart(5) + show.map((k) => String(tot[k]).padStart(9)).join(''));

function med(a) { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; }
