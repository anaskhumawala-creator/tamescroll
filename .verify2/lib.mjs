// Shared loader + scorer for the finding-32 vs track-mean contradiction.
// ONE copy of the exposure/false-cover rule, called from every arm, because
// a bench that re-derives a shipped rule per-arm is a check that cannot fail.
import fs from 'fs';

export const BANK = 'Z:/tamescroll-corpus/bank/gpu-grey-mirror.json';

export function load(arm = 'grey') {
  const rows = JSON.parse(fs.readFileSync(BANK, 'utf8'));
  const out = [];
  for (const r of rows) {
    if (!r[arm] || typeof r[arm].raw !== 'number') continue;
    const m = /_w([0-9.]+)\/f(\d+)_b(\d+)\./.exec(r.crop);
    if (!m) throw new Error('crop name did not parse: ' + r.crop);
    out.push({
      who: r.who,
      cid: r.cid,
      vid: r.vid,
      win: m[1],
      fi: Number(m[2]),
      bi: Number(m[3]),
      px: r.px,
      raw: r[arm].raw,
      nm: r[arm].nm,
      unit: r.cid + '|w' + m[1],
    });
  }
  return out;
}

// A man is CLEARED when his score is confidently male: score >= bar.
// Exposure = a woman cleared. False cover = a man NOT cleared.
// `key` names the field carrying the score under test (raw, or a track mean).
export function barFor(F, key, target) {
  for (let b = 0.0; b <= 1.0001; b += 0.001) {
    if (F.filter((r) => r[key] >= b).length / F.length <= target) return b;
  }
  return null;
}
export function falseCover(M, key, bar) {
  return M.filter((r) => r[key] < bar).length / M.length;
}
export function exposure(F, key, bar) {
  return F.filter((r) => r[key] >= bar).length / F.length;
}

// AUC = P(score of a man > score of a woman), ties at 0.5. Nothing a bar
// solver does can move this, which is why it prints beside every table.
export function auc(rows, key) {
  const m = rows.filter((r) => r.who === 'man').map((r) => r[key]).sort((a, b) => a - b);
  const f = rows.filter((r) => r.who === 'woman').map((r) => r[key]).sort((a, b) => a - b);
  if (!m.length || !f.length) return NaN;
  let i = 0, j = 0, acc = 0;
  // for each woman count men strictly above + half the ties
  for (const w of f) {
    while (i < m.length && m[i] < w) i++;
    let ties = 0, k = i;
    while (k < m.length && m[k] === w) { ties++; k++; }
    acc += (m.length - i - ties) + ties * 0.5;
  }
  return acc / (m.length * f.length);
}

export const pct = (x) => (100 * x).toFixed(1) + '%';

// Bootstrap over IDENTITIES, never reads. Returns [lo, hi] percentile CI.
export function bootIds(rows, fn, B = 600, seed = 12345) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const byId = new Map();
  for (const r of rows) { if (!byId.has(r.cid)) byId.set(r.cid, []); byId.get(r.cid).push(r); }
  const ids = [...byId.keys()];
  const vals = [];
  for (let b = 0; b < B; b++) {
    const samp = [];
    for (let i = 0; i < ids.length; i++) samp.push(...byId.get(ids[Math.floor(rnd() * ids.length)]));
    const v = fn(samp);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  if (!vals.length) return [NaN, NaN];
  return [vals[Math.floor(0.025 * vals.length)], vals[Math.min(vals.length - 1, Math.floor(0.975 * vals.length))]];
}

export function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
export function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1));
}

// Sorted-array fast paths. Same 0.001 grid and the same tie semantics as the
// scan above -- `test-fastpath` asserts they agree on the real bank.
export function sortedAsc(rows, key) { return rows.map((r) => r[key]).sort((a, b) => a - b); }
function countGE(sorted, b) {           // first index with value >= b
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < b) lo = m + 1; else hi = m; }
  return sorted.length - lo;
}
export function barForSorted(fSorted, target) {
  const n = fSorted.length;
  for (let b = 0; b <= 1.0001; b += 0.001) if (countGE(fSorted, b) / n <= target) return b;
  return null;
}
export function falseCoverSorted(mSorted, bar) {
  return (mSorted.length - countGE(mSorted, bar)) / mSorted.length;
}
