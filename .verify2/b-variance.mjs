// PART 2 -- IS THE READ DETERMINISTIC PER PERSON?
// Finding 32 says the same face gets the same wrong answer. That is a claim
// about within-identity VARIANCE, and it has never been measured directly.
import { load, barFor, mean, sd, pct } from './lib.mjs';

const ARM = process.argv[2] || 'grey';
const rows = load(ARM);
const F = rows.filter((r) => r.who === 'woman');
const BAR = barFor(F, 'raw', 0.016);
console.log('arm ' + ARM + '   shipped-equivalent clear bar solved to exposure <=1.6%: ' + BAR.toFixed(3));
console.log('label boundary 0.500\n');

const byId = new Map();
for (const r of rows) { if (!byId.has(r.cid)) byId.set(r.cid, []); byId.get(r.cid).push(r); }

// ---- variance decomposition: between identity vs within identity
const all = rows.map((r) => r.raw);
const gm = mean(all);
let ssTot = 0, ssBet = 0, ssWit = 0;
for (const r of rows) ssTot += (r.raw - gm) ** 2;
for (const [, v] of byId) {
  const m = mean(v.map((r) => r.raw));
  ssBet += v.length * (m - gm) ** 2;
  for (const r of v) ssWit += (r.raw - m) ** 2;
}
console.log('VARIANCE DECOMPOSITION of raw over 2,159 reads / 51 identities');
console.log('  between identities  ' + (100 * ssBet / ssTot).toFixed(1) + '%   (eta^2)');
console.log('  within  identities  ' + (100 * ssWit / ssTot).toFixed(1) + '%');
console.log('  pooled within-identity sd  ' + Math.sqrt(ssWit / (rows.length - byId.size)).toFixed(3));

// ---- and within identity: between sampling window vs within window
let ssBW = 0, ssWW = 0;
for (const [, v] of byId) {
  const m = mean(v.map((r) => r.raw));
  const byW = new Map();
  for (const r of v) { if (!byW.has(r.win)) byW.set(r.win, []); byW.get(r.win).push(r); }
  for (const [, w] of byW) {
    const mw = mean(w.map((r) => r.raw));
    ssBW += w.length * (mw - m) ** 2;
    for (const r of w) ssWW += (r.raw - mw) ** 2;
  }
}
console.log('  of the within-identity part:  between sampling windows '
  + (100 * ssBW / ssWit).toFixed(1) + '%   within a window ' + (100 * ssWW / ssWit).toFixed(1) + '%\n');

// ---- per identity table
console.log('PER IDENTITY (arm ' + ARM + '). straddle = reads fall on BOTH sides of the bar.');
console.log('  ' + 'cid'.padEnd(18) + 'who'.padEnd(7) + 'n'.padStart(5) + 'mean'.padStart(8)
  + 'sd'.padStart(8) + 'min'.padStart(7) + 'max'.padStart(7) + 'range'.padStart(7)
  + '  side@0.5'.padEnd(12) + 'side@bar'.padEnd(12) + 'px p50'.padStart(8));
const per = [];
for (const [cid, v] of [...byId].sort((a, b) => b[1].length - a[1].length)) {
  const r = v.map((x) => x.raw);
  const m = mean(r), s = sd(r);
  const above5 = r.filter((x) => x >= 0.5).length;
  const aboveB = r.filter((x) => x >= BAR).length;
  const side5 = above5 === 0 ? 'all<0.5' : above5 === r.length ? 'all>=0.5' : 'STRADDLE';
  const sideB = aboveB === 0 ? 'all<bar' : aboveB === r.length ? 'all>=bar' : 'STRADDLE';
  const pxs = v.map((x) => x.px).sort((a, b) => a - b);
  per.push({ cid, who: v[0].who, n: r.length, m, s, side5, sideB, above5, aboveB });
  console.log('  ' + cid.padEnd(18) + v[0].who.padEnd(7) + String(r.length).padStart(5)
    + m.toFixed(3).padStart(8) + s.toFixed(3).padStart(8)
    + Math.min(...r).toFixed(3).padStart(7) + Math.max(...r).toFixed(3).padStart(7)
    + (Math.max(...r) - Math.min(...r)).toFixed(3).padStart(7)
    + ('  ' + side5).padEnd(12) + sideB.padEnd(12) + String(pxs[pxs.length >> 1]).padStart(8));
}

for (const who of ['woman', 'man']) {
  const g = per.filter((p) => p.who === who);
  const gm = g.filter((p) => p.n >= 5);
  console.log('\n' + who.toUpperCase() + ' summary (' + g.length + ' identities, ' + gm.length + ' with n>=5)');
  console.log('  median within-identity sd (n>=5): ' + median(gm.map((p) => p.s)).toFixed(3));
  console.log('  straddle the LABEL boundary 0.5 : ' + gm.filter((p) => p.side5 === 'STRADDLE').length + ' of ' + gm.length);
  console.log('  straddle the CLEAR bar          : ' + gm.filter((p) => p.sideB === 'STRADDLE').length + ' of ' + gm.length);
  console.log('  entirely one side of the bar    : ' + gm.filter((p) => p.sideB !== 'STRADDLE').length + ' of ' + gm.length);
}

function median(a) { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; }

// ---- does within-identity deviation track face size, or is it noise?
console.log('\nWHAT DRIVES THE WITHIN-IDENTITY DEVIATION');
const dev = [], pxv = [], nmv = [], fiv = [];
for (const [, v] of byId) {
  if (v.length < 5) continue;
  const m = mean(v.map((r) => r.raw));
  const mpx = mean(v.map((r) => r.px));
  for (const r of v) { dev.push(r.raw - m); pxv.push(r.px - mpx); nmv.push(r.nm); fiv.push(r.fi); }
}
console.log('  pearson(raw - identityMean, px - identityMeanPx) = ' + corr(dev, pxv).toFixed(3));
console.log('  pearson(|raw - identityMean|, px)                = ' + corr(dev.map(Math.abs), pxv).toFixed(3));
console.log('  n paired ' + dev.length);

// lag-1 autocorrelation of the deviation inside a CONTIGUOUS run of frames.
// High = a slowly drifting per-pose signal. Near 0 = independent draws, and
// independent draws are exactly what averaging is allowed to help with.
const runs = [];
for (const [, v] of byId) {
  const byW = new Map();
  for (const r of v) { const k = r.win + '|' + r.bi; if (!byW.has(k)) byW.set(k, []); byW.get(k).push(r); }
  for (const [, w] of byW) {
    w.sort((a, b) => a.fi - b.fi);
    let cur = [w[0]];
    for (let i = 1; i < w.length; i++) {
      if (w[i].fi === w[i - 1].fi + 1) cur.push(w[i]); else { runs.push(cur); cur = [w[i]]; }
    }
    runs.push(cur);
  }
}
const long = runs.filter((r) => r.length >= 6);
console.log('\n  contiguous runs (same cid, window, box slot, consecutive frames): '
  + runs.length + ' total, ' + long.length + ' of length >=6, longest ' + Math.max(...runs.map((r) => r.length)));
for (const lag of [1, 2, 4, 8]) {
  const x = [], y = [];
  for (const run of long) {
    const m = mean(run.map((r) => r.raw));
    for (let i = 0; i + lag < run.length; i++) { x.push(run[i].raw - m); y.push(run[i + lag].raw - m); }
  }
  console.log('  lag-' + lag + ' autocorrelation of within-run deviation: ' + corr(x, y).toFixed(3) + '   (n ' + x.length + ')');
}

function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
}
