// A READ THAT KNOWS WHEN IT IS PROBABLY WRONG.
//
// wild-signals.mjs found FIVE quantities, all already computed on every
// read, that lean the same way on a wrong read:
//
//              right p50   wrong p50
//   nm            9.70        7.23     descriptor magnitude
//   conf          0.75        0.65     BlazeFace confidence
//   ageEnt        3.73        4.06     age-posterior entropy
//   px           78.40       54.70     native face size
//   sharpness   425         284        Laplacian variance of the crop
//
// Each is weak on its own -- proof-gates.mjs priced them one at a time
// and every single gate cost far more false cover than it bought. The
// question this asks is whether they are weak in DIFFERENT directions,
// which is the only way a combination beats its parts.
//
// So: fit one small logistic regression on those five (plus the read's
// own certainty) to predict "this read is wrong", and use it as a VETO on
// top of the shipped clear rule. Six weights, ~50 bytes, no new model, no
// new inference -- every input is already on the read.
//
// HELD OUT BY VIDEO. Reads inside one video share a subject, a camera and
// a lighting setup; a read-level split lets the fit memorise the person
// (engine-findings 29). Every scored read is from a video the weights
// never saw.
//
// FEATURES ARE STANDARDISED using TRAIN-fold statistics only. Using the
// whole set's mean would leak the held-out video into the fit -- a small
// leak, and exactly the kind that makes a bench look better than the
// thing it is measuring.
//
// PER READ, not seconds.
import fs from 'fs';

const BANK = 'Z:/tamescroll-corpus/bank';
const labels = JSON.parse(fs.readFileSync(BANK + '/label/labels.json', 'utf8'));
const clusters = JSON.parse(fs.readFileSync(BANK + '/label/clusters.json', 'utf8'));
const byCrop = new Map();
for (const c of clusters) {
  const who = labels[c.id];
  if (who !== 'man' && who !== 'woman') continue;
  for (const m of c.members) byCrop.set(m.crop, { who: who, cid: c.id });
}

function sharpness(file) {
  let b;
  try { b = fs.readFileSync(file); } catch (e) { return NaN; }
  if (b[0] !== 0x50 || b[1] !== 0x36) return NaN;
  let i = 2; const nums = [];
  while (nums.length < 3) {
    while (i < b.length && /\s/.test(String.fromCharCode(b[i]))) i++;
    if (b[i] === 0x23) { while (i < b.length && b[i] !== 0x0a) i++; continue; }
    let s = '';
    while (i < b.length && !/\s/.test(String.fromCharCode(b[i]))) s += String.fromCharCode(b[i++]);
    nums.push(Number(s));
  }
  i++;
  const w = nums[0], h = nums[1], d = b.subarray(i);
  if (d.length < w * h * 3) return NaN;
  const g = new Float64Array(w * h);
  for (let p = 0; p < w * h; p++) g[p] = 0.299 * d[p * 3] + 0.587 * d[p * 3 + 1] + 0.114 * d[p * 3 + 2];
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    const L = 4 * g[p] - g[p - 1] - g[p + 1] - g[p - w] - g[p + w];
    s += L; s2 += L * L; n++;
  }
  return n ? s2 / n - (s / n) * (s / n) : NaN;
}

const rows = [];
for (const f of fs.readdirSync(BANK + '/reads').filter(function (x) { return x.endsWith('.json'); })) {
  const win = JSON.parse(fs.readFileSync(BANK + '/reads/' + f, 'utf8'));
  for (const fr of win.frames) {
    for (const fa of fr.faces || []) {
      const lab = fa.crop && byCrop.get(fa.crop);
      if (!lab) continue;
      const sh = sharpness(BANK + '/crops/' + fa.crop);
      if (!Number.isFinite(sh)) continue;
      if (!Number.isFinite(fa.nm) || !Number.isFinite(fa.conf) || !Number.isFinite(fa.px)) continue;
      const ent = fa.shape ? fa.shape.ageEnt : NaN;
      if (!Number.isFinite(ent)) continue;
      rows.push({
        vid: win.vid, cid: lab.cid, man: lab.who === 'man',
        raw: fa.raw,
        clear: fa.gender === 'male' && fa.score >= 0.45,
        wrong: (fa.raw >= 0.5) !== (lab.who === 'man') ? 1 : 0,
        x: [fa.nm, fa.conf, ent, fa.px, Math.log(1 + sh), Math.abs(fa.raw - 0.5)],
      });
    }
  }
}
const NF = 6;
const NAMES = ['nm', 'conf', 'ageEnt', 'px', 'log sharp', 'certainty'];
const vids = Array.from(new Set(rows.map(function (r) { return r.vid; }))).sort();
console.log('reads ' + rows.length + '   videos ' + vids.length
  + '   wrong ' + rows.filter(function (r) { return r.wrong; }).length + '\n');

function fit(train) {
  const mu = new Float64Array(NF), sd = new Float64Array(NF);
  for (let j = 0; j < NF; j++) {
    let s = 0; for (const r of train) s += r.x[j];
    mu[j] = s / train.length;
    let v = 0; for (const r of train) v += (r.x[j] - mu[j]) * (r.x[j] - mu[j]);
    sd[j] = Math.sqrt(v / train.length) || 1;
  }
  const w = new Float64Array(NF); let b = 0;
  const nPos = train.filter(function (r) { return r.wrong; }).length || 1;
  const wPos = train.length / (2 * nPos), wNeg = train.length / (2 * (train.length - nPos) || 1);
  for (let s = 0; s < 800; s++) {
    const gw = new Float64Array(NF); let gb = 0, tot = 0;
    for (const r of train) {
      let z = b;
      for (let j = 0; j < NF; j++) z += w[j] * ((r.x[j] - mu[j]) / sd[j]);
      const p = 1 / (1 + Math.exp(-z));
      const cw = r.wrong ? wPos : wNeg;
      const g = cw * (p - r.wrong);
      for (let j = 0; j < NF; j++) gw[j] += g * ((r.x[j] - mu[j]) / sd[j]);
      gb += g; tot += cw;
    }
    for (let j = 0; j < NF; j++) w[j] -= 0.5 * (gw[j] / tot + 1e-3 * w[j]);
    b -= 0.5 * (gb / tot);
  }
  return { w: w, b: b, mu: mu, sd: sd };
}
const apply = function (m, r) {
  let z = m.b;
  for (let j = 0; j < NF; j++) z += m.w[j] * ((r.x[j] - m.mu[j]) / m.sd[j]);
  return 1 / (1 + Math.exp(-z));
};

const out = [];
const wsum = new Float64Array(NF);
for (const held of vids) {
  const train = rows.filter(function (r) { return r.vid !== held; });
  const test = rows.filter(function (r) { return r.vid === held; });
  if (!train.length || !test.length) continue;
  const m = fit(train);
  for (let j = 0; j < NF; j++) wsum[j] += m.w[j] / vids.length;
  for (const r of test) out.push(Object.assign({}, r, { d: apply(m, r) }));
}

const pct = function (a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '--'; };
const F = out.filter(function (r) { return !r.man; });
const M = out.filter(function (r) { return r.man; });
console.log('mean weight per feature (positive = pushes toward WRONG):');
for (let j = 0; j < NF; j++) console.log('  ' + NAMES[j].padEnd(11) + wsum[j].toFixed(3));

const q = function (a, p) {
  const s = a.slice().sort(function (x, y) { return x - y; });
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
};
console.log('\ndistrust score, right vs wrong reads:');
for (const g of [['right', out.filter(function (r) { return !r.wrong; })],
                 ['WRONG', out.filter(function (r) { return r.wrong; })]]) {
  const a = g[1].map(function (r) { return r.d; });
  console.log('  ' + g[0].padEnd(6) + ' n ' + String(g[1].length).padStart(4)
    + '   p10 ' + q(a, 0.1).toFixed(2) + '  p50 ' + q(a, 0.5).toFixed(2) + '  p90 ' + q(a, 0.9).toFixed(2));
}

console.log('\nVETO: clear only if the shipped rule says clear AND distrust < T');
console.log('  shipped          exposure ' + pct(F.filter(function (r) { return r.clear; }).length, F.length).padStart(6)
  + '   false cover ' + pct(M.filter(function (r) { return !r.clear; }).length, M.length).padStart(6));
for (const T of [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
  const ok = function (r) { return r.clear && r.d < T; };
  console.log('  distrust < ' + T.toFixed(2) + '   exposure ' + pct(F.filter(ok).length, F.length).padStart(6)
    + '   false cover ' + pct(M.filter(function (r) { return !ok(r); }).length, M.length).padStart(6));
}
