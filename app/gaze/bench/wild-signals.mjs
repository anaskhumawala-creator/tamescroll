// FOUR CHEAP QUESTIONS, ANSWERED OFF DATA ALREADY ON DISK.
//
// The failure this is chasing is DETERMINISTIC and PER PERSON: 19 of 22
// corpus women never leak a single read, one leaks on all 8 of hers. So
// the useful questions are about whether ANY signal we already hold can
// separate that woman from the men around her.
//
// 1. IS THERE EVER A GOOD FRAME? If a leaking woman reads correctly on
//    even one frame, best-frame picking (and the 1.5s delay ring that
//    would make it possible) can save her. If she is wrong on every
//    frame she has, then every temporal trick in the plan is dead for
//    her and only a different model or a different signal can help.
//    This is the diagnostic that decides which half of the plan lives.
//
// 2. NEAREST NEIGHBOURS. The linear probe on the 1024-d descriptor lost
//    (desc-probe.mjs: 9.4% vs the head's 6.7%), but 1024 free parameters
//    fitted on 52 people is badly under-powered. k-NN has no parameters
//    at all -- it asks "who does this face look like, and what were they"
//    -- so it is the version of the same idea that a 52-person corpus can
//    actually support. Held out BY VIDEO, never by read.
//
// 3. IS IT THE PICTURE, NOT THE FACE? A 640x360 stream face is mush.
//    Laplacian variance over the banked crop measures how much real
//    detail reached the model. If wrong reads cluster in the blurry
//    band, the fix is stream resolution, which needs no model at all.
//
// 4. DO THE OTHER HEADS KNOW? faceres also emits age, an age-posterior
//    entropy and the descriptor magnitude `nm`, all banked. If a wrong
//    gender read comes with a strange age or a flat posterior, that is a
//    free per-read distrust signal.
//
// PER READ, not seconds. Nothing here is fitted except the k-NN, which
// is held out by video.
import fs from 'fs';

const BANK = 'Z:/tamescroll-corpus/bank';
const D = 1024;
const CLEAR = 0.725;

const labels = JSON.parse(fs.readFileSync(BANK + '/label/labels.json', 'utf8'));
const clusters = JSON.parse(fs.readFileSync(BANK + '/label/clusters.json', 'utf8'));
const byCrop = new Map();
for (const c of clusters) {
  const who = labels[c.id];
  if (who !== 'man' && who !== 'woman') continue;
  for (const m of c.members) byCrop.set(m.crop, { who: who, cid: c.id });
}

// ---- load reads + descriptors -------------------------------------------
const rows = [];
for (const f of fs.readdirSync(BANK + '/reads').filter(function (x) { return x.endsWith('.json'); })) {
  const win = JSON.parse(fs.readFileSync(BANK + '/reads/' + f, 'utf8'));
  const dp = BANK + '/reads/' + f.replace(/\.json$/, '.desc');
  let desc = null;
  if (fs.existsSync(dp)) {
    const b = fs.readFileSync(dp);
    desc = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  }
  for (const fr of win.frames) {
    for (const fa of fr.faces || []) {
      const lab = fa.crop && byCrop.get(fa.crop);
      if (!lab) continue;
      let v = null;
      if (desc && fa.descIdx >= 0 && (fa.descIdx + 1) * D <= desc.length) {
        const s = desc.subarray(fa.descIdx * D, (fa.descIdx + 1) * D);
        let n = 0; for (let i = 0; i < D; i++) n += s[i] * s[i];
        if (n > 0.5) v = s;   // an all-zero slot is a missing measurement
      }
      rows.push({
        vid: win.vid, cid: lab.cid, who: lab.who, man: lab.who === 'man',
        crop: fa.crop, px: fa.px, conf: fa.conf, nm: fa.nm,
        age: fa.age, childP: fa.childP,
        ageEnt: fa.shape ? fa.shape.ageEnt : undefined,
        raw: fa.raw, gender: fa.gender,
        clear: fa.gender === 'male' && fa.score >= 0.45,
        wrong: (fa.raw >= 0.5) !== (lab.who === 'man'),
        v: v,
      });
    }
  }
}

const pct = function (a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '--'; };
const q = function (a, p) {
  const s = a.filter(Number.isFinite).sort(function (x, y) { return x - y; });
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
};
const F = rows.filter(function (r) { return !r.man; });
const M = rows.filter(function (r) { return r.man; });
console.log('reads ' + rows.length + '   women ' + F.length + '   men ' + M.length
  + '   with descriptor ' + rows.filter(function (r) { return r.v; }).length + '\n');

// ---- 1. IS THERE EVER A GOOD FRAME? --------------------------------------
console.log('=== 1. IS THERE EVER A GOOD FRAME FOR A LEAKING WOMAN? ===\n');
const byCid = new Map();
for (const r of F) {
  if (!byCid.has(r.cid)) byCid.set(r.cid, []);
  byCid.get(r.cid).push(r);
}
let allBad = 0, someGood = 0;
for (const e of byCid) {
  const cid = e[0], a = e[1];
  const leaks = a.filter(function (r) { return r.clear; });
  if (!leaks.length) continue;
  const good = a.filter(function (r) { return !r.wrong; });
  const bestRaw = Math.min.apply(null, a.map(function (r) { return r.raw; }));
  console.log('  ' + cid.padEnd(20) + ' reads ' + String(a.length).padStart(3)
    + '   leaked ' + String(leaks.length).padStart(3)
    + '   frames read CORRECTLY ' + String(good.length).padStart(3)
    + '   best (lowest) raw ' + bestRaw.toFixed(2));
  if (good.length) someGood++; else allBad++;
}
console.log('\n  leaking women with at least one good frame: ' + someGood
  + '   with NO good frame ever: ' + allBad);
console.log('  -> if "no good frame" dominates, best-frame picking and the delay');
console.log('     ring cannot save them and only a new signal can.');

// ---- 2. NEAREST NEIGHBOUR ON THE DESCRIPTOR ------------------------------
console.log('\n=== 2. k-NN ON THE FACE FINGERPRINT (held out by video) ===\n');
const withV = rows.filter(function (r) { return r.v; });
const vids = Array.from(new Set(withV.map(function (r) { return r.vid; }))).sort();
const dot = function (a, b) { let s = 0; for (let i = 0; i < D; i++) s += a[i] * b[i]; return s; };
for (const K of [1, 5, 15]) {
  let wrongAll = 0, wrongF = 0, nF = 0, wrongM = 0, nM = 0;
  for (const held of vids) {
    const train = withV.filter(function (r) { return r.vid !== held; });
    const test = withV.filter(function (r) { return r.vid === held; });
    for (const t of test) {
      const sims = train.map(function (r) { return { s: dot(t.v, r.v), man: r.man }; });
      sims.sort(function (a, b) { return b.s - a.s; });
      let men = 0;
      for (let i = 0; i < K && i < sims.length; i++) if (sims[i].man) men++;
      const saysMan = men * 2 > K;
      const bad = saysMan !== t.man;
      if (bad) wrongAll++;
      if (t.man) { nM++; if (bad) wrongM++; } else { nF++; if (bad) wrongF++; }
    }
  }
  console.log('  K=' + String(K).padStart(2) + '   wrong ' + pct(wrongAll, withV.length).padStart(6)
    + '   women ' + pct(wrongF, nF).padStart(6) + '   men ' + pct(wrongM, nM).padStart(6));
}
{
  const w = withV.filter(function (r) { return r.wrong; }).length;
  const wf = F.filter(function (r) { return r.v && r.wrong; }).length;
  const nf = F.filter(function (r) { return r.v; }).length;
  console.log('  HEAD, same reads   wrong ' + pct(w, withV.length).padStart(6)
    + '   women ' + pct(wf, nf).padStart(6));
}

// ---- 3. IS IT THE PICTURE? ----------------------------------------------
console.log('\n=== 3. IS A WRONG READ A BLURRY PICTURE? ===\n');
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
  // Laplacian variance -- the standard blur measure. High = real detail.
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    const L = 4 * g[p] - g[p - 1] - g[p + 1] - g[p - w] - g[p + w];
    s += L; s2 += L * L; n++;
  }
  return n ? s2 / n - (s / n) * (s / n) : NaN;
}
let sN = 0;
for (const r of rows) {
  if (sN >= 2600) break;
  r.sharp = sharpness(BANK + '/crops/' + r.crop);
  sN++;
}
const haveS = rows.filter(function (r) { return Number.isFinite(r.sharp); });
console.log('  crops measured ' + haveS.length);
for (const g of [['right reads', haveS.filter(function (r) { return !r.wrong; })],
                 ['WRONG reads', haveS.filter(function (r) { return r.wrong; })]]) {
  const a = g[1].map(function (r) { return r.sharp; });
  console.log('  ' + g[0].padEnd(12) + ' n ' + String(g[1].length).padStart(4)
    + '   sharpness p10 ' + q(a, 0.1).toFixed(0) + '  p50 ' + q(a, 0.5).toFixed(0)
    + '  p90 ' + q(a, 0.9).toFixed(0));
}
console.log('\n  gate on sharpness (only clear a face with real detail):');
for (const c of [50, 100, 200, 400]) {
  const ok = function (r) { return r.clear && r.sharp >= c; };
  const Fs = haveS.filter(function (r) { return !r.man; });
  const Ms = haveS.filter(function (r) { return r.man; });
  console.log('    sharp >= ' + String(c).padStart(4) + '   exposure ' + pct(Fs.filter(ok).length, Fs.length).padStart(6)
    + '   false cover ' + pct(Ms.filter(function (r) { return !ok(r); }).length, Ms.length).padStart(6));
}

// ---- 4. DO THE OTHER HEADS KNOW? ----------------------------------------
console.log('\n=== 4. DO THE OTHER HEADS SEE THE WRONG READ COMING? ===\n');
for (const key of ['age', 'childP', 'nm', 'ageEnt', 'conf', 'px']) {
  const rg = rows.filter(function (r) { return !r.wrong && Number.isFinite(r[key]); }).map(function (r) { return r[key]; });
  const wr = rows.filter(function (r) { return r.wrong && Number.isFinite(r[key]); }).map(function (r) { return r[key]; });
  if (!wr.length) { console.log('  ' + key.padEnd(8) + ' (not banked)'); continue; }
  console.log('  ' + key.padEnd(8) + ' right p25 ' + q(rg, 0.25).toFixed(2) + ' p50 ' + q(rg, 0.5).toFixed(2) + ' p75 ' + q(rg, 0.75).toFixed(2)
    + '   |   WRONG p25 ' + q(wr, 0.25).toFixed(2) + ' p50 ' + q(wr, 0.5).toFixed(2) + ' p75 ' + q(wr, 0.75).toFixed(2));
}
