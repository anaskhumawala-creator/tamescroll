// IS THE FACE FINGERPRINT A BETTER GENDER SIGNAL THAN THE GENDER HEAD?
//
// faceres is a face-RECOGNITION model. Its main output is a 1024-d
// descriptor, trained hard on huge diverse face sets. Gender is a small
// auxiliary head bolted onto the same trunk. We read the head and throw
// the trunk's gender information away.
//
// FairFace measured the head: 19.4% wrong overall, 36.0% on women,
// 52.6% on Indian women. So the head is the weak part.
//
// This fits ONE LINEAR LAYER on the descriptor -- 1024 weights + bias,
// ~4KB, no new inference, no APK growth, the descriptor is already
// computed on every read -- and scores it against the head on the same
// reads and the same human labels.
//
// HELD OUT BY VIDEO, never by read. Reads inside one video share a
// subject, a camera and a lighting setup; a read-level split lets the
// probe memorise the person and report its own training data back
// (engine-findings 29 killed a bar that looked like free money on
// exactly that mistake). Leave-one-video-out means every scored read is
// of a person the weights never saw.
//
// WHAT IT CANNOT SAY: our corpus is 10 videos of mostly white presenters.
// A win here does NOT transfer to the FairFace bias result. If the probe
// wins, the next run is FairFace descriptors, which is where the 52.6%
// lives.
import fs from 'fs';

const ROOT = 'Z:/tamescroll-corpus';
const BANK = `${ROOT}/bank`;
const D = 1024;

const labels = JSON.parse(fs.readFileSync(`${BANK}/label/labels.json`, 'utf8'));
const clusters = JSON.parse(fs.readFileSync(`${BANK}/label/clusters.json`, 'utf8'));
const byCrop = new Map();
for (const c of clusters) {
  const who = labels[c.id];
  if (who !== 'man' && who !== 'woman') continue;
  for (const m of c.members) byCrop.set(m.crop, { who, cid: c.id });
}

// ---- load every labelled read with its descriptor -----------------------
const rows = [];
for (const f of fs.readdirSync(`${BANK}/reads`).filter((x) => x.endsWith('.json'))) {
  const win = JSON.parse(fs.readFileSync(`${BANK}/reads/${f}`, 'utf8'));
  const dp = `${BANK}/reads/${f.replace(/\.json$/, '.desc')}`;
  if (!fs.existsSync(dp)) continue;
  const b = fs.readFileSync(dp);
  const desc = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  for (const fr of win.frames) {
    for (const fa of fr.faces || []) {
      const lab = fa.crop && byCrop.get(fa.crop);
      if (!lab) continue;
      if (!(fa.descIdx >= 0) || (fa.descIdx + 1) * D > desc.length) continue;
      const v = desc.subarray(fa.descIdx * D, (fa.descIdx + 1) * D);
      // A descriptor that never got written is all zeros; scoring it
      // would count a missing measurement as a wrong one.
      let n = 0; for (let i = 0; i < D; i++) n += v[i] * v[i];
      if (!(n > 0.5)) continue;
      rows.push({
        vid: win.vid, cid: lab.cid, who: lab.who,
        y: lab.who === 'man' ? 1 : 0,            // 1 = man
        head: fa.gender, raw: fa.raw, px: fa.px,
        v,
      });
    }
  }
}

const vids = [...new Set(rows.map((r) => r.vid))].sort();
console.log(`reads with a descriptor AND a human label: ${rows.length}`);
console.log(`  men ${rows.filter((r) => r.y === 1).length}   women ${rows.filter((r) => r.y === 0).length}`);
console.log(`  videos ${vids.length}   people ${new Set(rows.map((r) => r.cid)).size}`);

// ---- logistic regression, plain gradient descent -------------------------
// Class-weighted: the corpus is ~60/40 men, and an unweighted fit on an
// imbalanced set buys accuracy by leaning to the majority -- which is
// exactly the failure mode we are trying to measure our way out of.
function fit(train, steps = 400, lr = 4.0, l2 = 1e-3) {
  const w = new Float64Array(D); let b = 0;
  const nPos = train.filter((r) => r.y === 1).length || 1;
  const nNeg = train.length - nPos || 1;
  const wPos = train.length / (2 * nPos), wNeg = train.length / (2 * nNeg);
  const gw = new Float64Array(D);
  for (let s = 0; s < steps; s++) {
    gw.fill(0); let gb = 0, tot = 0;
    for (const r of train) {
      let z = b; const v = r.v;
      for (let i = 0; i < D; i++) z += w[i] * v[i];
      const p = 1 / (1 + Math.exp(-z));
      const cw = r.y === 1 ? wPos : wNeg;
      const g = cw * (p - r.y);
      for (let i = 0; i < D; i++) gw[i] += g * v[i];
      gb += g; tot += cw;
    }
    for (let i = 0; i < D; i++) w[i] -= lr * (gw[i] / tot + l2 * w[i]);
    b -= lr * (gb / tot);
  }
  return { w, b };
}
const score = (m, v) => { let z = m.b; for (let i = 0; i < D; i++) z += m.w[i] * v[i]; return 1 / (1 + Math.exp(-z)); };

// ---- leave one VIDEO out ------------------------------------------------
const out = [];
for (const held of vids) {
  const train = rows.filter((r) => r.vid !== held);
  const test = rows.filter((r) => r.vid === held);
  if (!train.length || !test.length) continue;
  const m = fit(train);
  for (const r of test) out.push({ ...r, probe: score(m, r.v) });
  process.stderr.write(`  fitted without ${held}, scored ${test.length}\n`);
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
function report(name, wrongOf) {
  const all = out.length, w = out.filter(wrongOf).length;
  const F = out.filter((r) => r.y === 0), M = out.filter((r) => r.y === 1);
  console.log(`${name.padEnd(22)} wrong ${pct(w, all).padStart(6)}`
    + `   women ${pct(F.filter(wrongOf).length, F.length).padStart(6)}`
    + `   men ${pct(M.filter(wrongOf).length, M.length).padStart(6)}`);
}
console.log(`\nSCORED ${out.length} held-out reads\n`);
report('faceres gender head', (r) => (r.head === 'male') !== (r.y === 1));
report('descriptor probe', (r) => (r.probe >= 0.5) !== (r.y === 1));

console.log('\nPROBE at other lines (man needs probe >= L):');
for (const L of [0.5, 0.6, 0.7, 0.8, 0.9]) {
  const F = out.filter((r) => r.y === 0), M = out.filter((r) => r.y === 1);
  console.log(`  L ${L.toFixed(2)}   women slipping through ${pct(F.filter((r) => r.probe >= L).length, F.length).padStart(6)}`
    + `   men wrongly covered ${pct(M.filter((r) => r.probe < L).length, M.length).padStart(6)}`);
}
console.log('\nHEAD at other lines, same reads, for comparison:');
for (const L of [0.5, 0.6, 0.7, 0.8, 0.9]) {
  const F = out.filter((r) => r.y === 0), M = out.filter((r) => r.y === 1);
  console.log(`  L ${L.toFixed(2)}   women slipping through ${pct(F.filter((r) => r.raw >= L).length, F.length).padStart(6)}`
    + `   men wrongly covered ${pct(M.filter((r) => r.raw < L).length, M.length).padStart(6)}`);
}

console.log('\nPER VIDEO (wrong %, head vs probe):');
for (const v of vids) {
  const s = out.filter((r) => r.vid === v);
  if (!s.length) continue;
  const h = s.filter((r) => (r.head === 'male') !== (r.y === 1)).length;
  const p = s.filter((r) => (r.probe >= 0.5) !== (r.y === 1)).length;
  console.log(`  ${v.padEnd(14)} n ${String(s.length).padStart(4)}   head ${pct(h, s.length).padStart(6)}   probe ${pct(p, s.length).padStart(6)}`);
}

fs.writeFileSync(`${BANK}/desc-probe-rows.json`,
  JSON.stringify(out.map(({ v, ...r }) => r)));
console.log(`\nrows banked to ${BANK}/desc-probe-rows.json`);
