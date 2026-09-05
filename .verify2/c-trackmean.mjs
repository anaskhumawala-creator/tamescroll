// PART 3+4 -- THE TRACK-MEAN ARM, ITS CONFOUNDS, AND THE DECISIVE SPLIT.
import { load, barFor, falseCover, exposure, auc, pct, bootIds, mean } from './lib.mjs';

const ARM = process.argv[2] || 'grey';
const rows = load(ARM);
const TARGET = 0.016;

// ---- build every averaging arm as an extra FIELD on the same row, so the
// exposure denominator and the bar solver are identical across arms.
function groupMean(rows, keyfn, field) {
  const g = new Map();
  for (const r of rows) { const k = keyfn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  for (const [, v] of g) { const m = mean(v.map((r) => r.raw)); for (const r of v) r[field] = m; }
  return g.size;
}
const nCid = groupMean(rows, (r) => r.cid, 'mCid');
const nUnit = groupMean(rows, (r) => r.unit, 'mUnit');
const nSlot = groupMean(rows, (r) => r.cid + '|' + r.win + '|' + r.bi, 'mSlot');

// contiguous runs: same cid + window + box slot + consecutive frame index.
// This is the tightest unit a runtime tracker could plausibly hold.
const runs = [];
{
  const g = new Map();
  for (const r of rows) { const k = r.cid + '|' + r.win + '|' + r.bi; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  for (const [, v] of g) {
    v.sort((a, b) => a.fi - b.fi);
    let cur = [v[0]];
    for (let i = 1; i < v.length; i++) {
      if (v[i].fi === v[i - 1].fi + 1) cur.push(v[i]); else { runs.push(cur); cur = [v[i]]; }
    }
    runs.push(cur);
  }
}
for (const run of runs) { const m = mean(run.map((r) => r.raw)); for (const r of run) r.mRun = m; }

// CAUSAL trailing mean inside a run -- the only thing a live tracker can do:
// it can average what it has already seen, never what it has not.
for (const K of [2, 4, 8, 16]) {
  for (const run of runs) {
    for (let i = 0; i < run.length; i++) {
      const lo = Math.max(0, i - K + 1);
      run[i]['c' + K] = mean(run.slice(lo, i + 1).map((r) => r.raw));
    }
  }
}

const ARMS = [
  ['raw', 'per read (baseline)'],
  ['c2', 'causal trailing mean, K=2, inside a run'],
  ['c4', 'causal trailing mean, K=4'],
  ['c8', 'causal trailing mean, K=8'],
  ['c16', 'causal trailing mean, K=16'],
  ['mRun', 'whole contiguous run (oracle: uses the future)'],
  ['mSlot', 'whole (cid, window, box slot)'],
  ['mUnit', 'whole (cid, sampling window)'],
  ['mCid', 'whole cid -- the arm under dispute'],
];

function table(rows, label) {
  const F = rows.filter((r) => r.who === 'woman');
  const M = rows.filter((r) => r.who === 'man');
  console.log('\n' + label + '   (women ' + F.length + ' reads, men ' + M.length + ')');
  console.log('  ' + 'arm'.padEnd(8) + 'bar'.padStart(7) + 'expo'.padStart(8) + 'falseCover'.padStart(12)
    + '  95% CI over IDS'.padEnd(20) + 'AUC'.padStart(8) + '   what it averages');
  for (const [k, desc] of ARMS) {
    const b = barFor(F, k, TARGET);
    if (b === null) { console.log('  ' + k.padEnd(8) + ' n/a'); continue; }
    const fc = falseCover(M, k, b);
    const ci = bootIds(rows, (s) => {
      const f = s.filter((r) => r.who === 'woman'), m = s.filter((r) => r.who === 'man');
      if (!f.length || !m.length) return NaN;
      const bb = barFor(f, k, TARGET);
      return bb === null ? NaN : falseCover(m, k, bb);
    }, 400);
    console.log('  ' + k.padEnd(8) + b.toFixed(3).padStart(7) + pct(exposure(F, k, b)).padStart(8)
      + pct(fc).padStart(12) + ('   [' + pct(ci[0]) + ' - ' + pct(ci[1]) + ']').padEnd(20)
      + auc(rows, k).toFixed(4).padStart(8) + '   ' + desc);
  }
}

console.log('arm ' + ARM + '   units: ' + nCid + ' cids, ' + nUnit + ' (cid,window), '
  + nSlot + ' (cid,window,slot), ' + runs.length + ' contiguous runs');
console.log('run length p50 ' + med(runs.map((r) => r.length)) + '  mean ' + mean(runs.map((r) => r.length)).toFixed(1));
table(rows, 'ALL 2,159 READS -- matched exposure <=1.6%');

// ---------------------------------------------------------------- CONFOUND 1
// Does the whole-cid arm win because a cid joins reads across sampling
// windows that a runtime tracker could never join?
const multi = new Set();
{
  const g = new Map();
  for (const r of rows) { if (!g.has(r.cid)) g.set(r.cid, new Set()); g.get(r.cid).add(r.win); }
  for (const [k, v] of g) if (v.size > 1) multi.add(k);
}
console.log('\nCONFOUND 1 -- cids spanning more than one sampling window: '
  + multi.size + ' of ' + nCid + ' (' + rows.filter((r) => multi.has(r.cid)).length + ' reads)');
console.log('  Compare mCid against mUnit in the table above: that IS the test.');

// ---------------------------------------------------------------- CONFOUND 2
// Is the win coming from identities with very few reads (where a "track mean"
// is one or two reads and the arm is nearly the baseline)?
table(rows.filter((r) => {
  const n = rows.filter((x) => x.cid === r.cid).length; return n >= 10;
}), 'CONFOUND 2 -- identities with >=10 reads only');

// ---------------------------------------------------------------- CONFOUND 3
// Is the BAR SOLVER doing the work? Solve the bar on 9 videos, score the
// tenth. If the win is a solver artefact it dies here.
console.log('\nCONFOUND 3 -- leave-one-VIDEO-out bar. Bar solved on the other 9 videos.');
const vids = [...new Set(rows.map((r) => r.vid))];
console.log('  ' + 'arm'.padEnd(8) + 'expo(held-out)'.padStart(16) + 'falseCover'.padStart(12) + 'AUC'.padStart(9));
for (const [k] of ARMS) {
  let fe = 0, fn = 0, mc = 0, mn = 0;
  for (const v of vids) {
    const tr = rows.filter((r) => r.vid !== v), te = rows.filter((r) => r.vid === v);
    const b = barFor(tr.filter((r) => r.who === 'woman'), k, TARGET);
    if (b === null) continue;
    const F = te.filter((r) => r.who === 'woman'), M = te.filter((r) => r.who === 'man');
    fe += F.filter((r) => r[k] >= b).length; fn += F.length;
    mc += M.filter((r) => r[k] < b).length; mn += M.length;
  }
  console.log('  ' + k.padEnd(8) + pct(fe / fn).padStart(16) + pct(mc / mn).padStart(12) + auc(rows, k).toFixed(4).padStart(9));
}
console.log('  Exposure is NOT matched here by construction -- read the pair, not the column.');

// ---------------------------------------------------------------- DECISIVE
// FINDING 32's CLAIM, TESTED WHERE IT LIVES. Split identities by whether the
// identity's MEAN read is on the correct side of the label boundary.
console.log('\nTHE DECISIVE SPLIT -- identities whose MEAN read is already wrong.');
const byId = new Map();
for (const r of rows) { if (!byId.has(r.cid)) byId.set(r.cid, []); byId.get(r.cid).push(r); }
const idInfo = new Map();
for (const [cid, v] of byId) {
  const m = mean(v.map((r) => r.raw));
  const who = v[0].who;
  const meanWrong = who === 'woman' ? m >= 0.5 : m < 0.5;
  const readsWrong = v.filter((r) => (who === 'woman' ? r.raw >= 0.5 : r.raw < 0.5)).length;
  idInfo.set(cid, { who, m, meanWrong, n: v.length, readsWrong });
}
for (const who of ['woman', 'man']) {
  const g = [...idInfo].filter(([, i]) => i.who === who);
  const wrongIds = g.filter(([, i]) => i.meanWrong);
  console.log('  ' + who + ': ' + g.length + ' identities, mean read WRONG for '
    + wrongIds.length + ' -> ' + wrongIds.map(([c, i]) => c + '(n' + i.n + ', mean ' + i.m.toFixed(2) + ')').join(', '));
}
// At the matched bar, what does each arm do to the reads of each group?
const barsFor = {};
{
  const F = rows.filter((r) => r.who === 'woman');
  for (const [k] of ARMS) barsFor[k] = barFor(F, k, TARGET);
}
console.log('\n  Per-group error at each arm’s OWN matched bar (exposure <=1.6% overall).');
console.log('  A woman is EXPOSED when cleared; a man is FALSELY COVERED when not cleared.');
console.log('  ' + 'group'.padEnd(28) + 'n'.padStart(6) + ARMS.map(([k]) => k.padStart(9)).join(''));
for (const who of ['woman', 'man']) {
  for (const flag of [false, true]) {
    const s = rows.filter((r) => r.who === who && idInfo.get(r.cid).meanWrong === flag);
    if (!s.length) continue;
    const lab = who + (flag ? ' / identity mean WRONG' : ' / identity mean right');
    console.log('  ' + lab.padEnd(28) + String(s.length).padStart(6)
      + ARMS.map(([k]) => {
        const bad = who === 'woman' ? s.filter((r) => r[k] >= barsFor[k]).length
          : s.filter((r) => r[k] < barsFor[k]).length;
        return pct(bad / s.length).padStart(9);
      }).join(''));
  }
}

function med(a) { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; }
