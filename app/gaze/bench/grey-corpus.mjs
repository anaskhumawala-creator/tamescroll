// THE DECIDING RUN FOR GREY: HIS OWN FOOTAGE, NOT CLEAN PORTRAITS.
//
// Finding 36 measured grey beating colour on FairFace -- 224px studio
// portraits, front-facing, evenly lit, one face centred. That is not what
// his phone sees. His faces arrive off a 640x360 stream at px p50 38-62,
// at whatever angle and exposure the video had, and finding 37 showed the
// model behaving differently down there (women 34.3% wrong at 224px,
// 39.0% at 48px, and a cliff to 52.3% at 32px).
//
// So a grey win on FairFace is a hypothesis about his phone, not a
// measurement of it. This is the measurement: the same four arms over the
// 2,385 LABELLED CORPUS READS -- real frames, real sizes, real lighting,
// ten videos, hand-clustered into 107 identities.
//
// AND IT SCORES THE SHIPPED CONSEQUENCES, not label accuracy. A wrong
// read that never crosses the clear bar costs nothing; a right read that
// fails to cross it costs a false cover. So the columns are EXPOSURE (a
// woman cleared, in his man mode) and FALSE COVER (a man not cleared),
// under the shipped rule quoted from gender-verdict rather than restated.
//
// HELD OUT BY NOTHING, because nothing is fitted -- every arm is a fixed
// pixel transform with no parameters learned from this data. The
// leave-one-video-out discipline of findings 29 and 33 applies to FITTED
// things; there is nothing here to overfit.
//
// PER READ, not seconds.
import './_build.mjs';
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';
import { GENDER_CLEAR_SCORE } from '../src/gender-verdict.mjs';

const BANK = 'Z:/tamescroll-corpus/bank';
const LIMIT = Number(process.env.GC_LIMIT || 0);
const ARMS = ['rgb', 'grey', 'blueOnly', 'gammaUp'];

function readPPM(file) {
  let b;
  try { b = fs.readFileSync(file); } catch (e) { return null; }
  if (b[0] !== 0x50 || b[1] !== 0x36) return null;
  let i = 2; const nums = [];
  while (nums.length < 3) {
    while (i < b.length && /\s/.test(String.fromCharCode(b[i]))) i++;
    if (b[i] === 0x23) { while (i < b.length && b[i] !== 0x0a) i++; continue; }
    let s = '';
    while (i < b.length && !/\s/.test(String.fromCharCode(b[i]))) s += String.fromCharCode(b[i++]);
    nums.push(Number(s));
  }
  i++;
  const w = nums[0], h = nums[1];
  if (b.length - i < w * h * 3) return null;
  return { w: w, h: h, data: b.subarray(i, i + w * h * 3) };
}
const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
function greyBy(d, n, f) {
  const o = new Uint8Array(n * 3);
  for (let p = 0; p < n; p++) {
    const v = clamp(f(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]));
    o[p * 3] = v; o[p * 3 + 1] = v; o[p * 3 + 2] = v;
  }
  return o;
}
const L601 = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

async function main() {
  const labels = JSON.parse(fs.readFileSync(BANK + '/label/labels.json', 'utf8'));
  const clusters = JSON.parse(fs.readFileSync(BANK + '/label/clusters.json', 'utf8'));
  const work = [];
  for (const c of clusters) {
    const who = labels[c.id];
    if (who !== 'man' && who !== 'woman') continue;
    for (const m of c.members) work.push({ who: who, cid: c.id, vid: c.vid, crop: m.crop, px: m.px });
  }
  const use = LIMIT ? work.slice(0, LIMIT) : work;
  process.stderr.write('reads ' + use.length + ' x ' + ARMS.length + ' arms\n');

  await tf.setBackend('cpu');
  await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const gen = await tfconv.loadGraphModel(fsHandler('faceres'));

  const rows = [];
  let done = 0, noPPM = 0, noFace = 0;
  for (const w of use) {
    const ppm = readPPM(BANK + '/crops/' + w.crop);
    if (!ppm) { noPPM++; done++; continue; }
    const n = ppm.w * ppm.h;
    const V = { rgb: new Uint8Array(ppm.data) };
    V.grey = greyBy(ppm.data, n, L601);
    V.blueOnly = greyBy(ppm.data, n, (r, g, b) => b);
    V.gammaUp = greyBy(ppm.data, n, (r, g, b) => 255 * Math.pow(L601(r, g, b) / 255, 0.7));

    // The banked crop is ALREADY the region the pipeline cut, so detect
    // on it to get the box the classifier would be handed, once, and
    // reuse it -- a gender number must not carry a detection difference.
    const base = tf.tensor3d(V.rgb, [ppm.h, ppm.w, 3], 'int32');
    let box = null;
    try {
      for (const b of await detectFaceBoxes(face, null, base)) {
        if (!box || (b.x2 - b.x1) * (b.y2 - b.y1) > (box.x2 - box.x1) * (box.y2 - box.y1)) box = b;
      }
    } finally { tf.dispose(base); }
    if (!box) { noFace++; done++; continue; }

    const row = { who: w.who, cid: w.cid, vid: w.vid, px: w.px };
    for (const a of ARMS) {
      const img = tf.tensor3d(V[a], [ppm.h, ppm.w, 3], 'int32');
      try {
        const g = (await classifyFaceGenders(gen, null, [box], img, { square: true }))[0];
        row[a] = { raw: g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2, s: g.score, g: g.gender };
      } finally { tf.dispose(img); }
    }
    rows.push(row);
    if (++done % 50 === 0) process.stderr.write('  ' + done + '/' + use.length + '\n');
  }

  fs.writeFileSync(BANK + '/grey-corpus-rows.json', JSON.stringify(rows));
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
  const wrong = (r, a) => (r[a].raw >= 0.5) !== (r.who === 'man');
  // The SHIPPED clear rule, in his man mode.
  const clear = (r, a) => r[a].g === 'male' && r[a].s >= GENDER_CLEAR_SCORE;
  const F = rows.filter(r => r.who === 'woman');
  const M = rows.filter(r => r.who === 'man');
  console.log('\nscored ' + rows.length + '  (no crop ' + noPPM + ', no face ' + noFace + ')'
    + '   women ' + F.length + '  men ' + M.length + '\n');
  console.log('  ' + 'arm'.padEnd(10) + 'wrong'.padStart(8) + 'wrongF'.padStart(9) + 'wrongM'.padStart(9)
    + 'EXPOSURE'.padStart(11) + 'FALSECOV'.padStart(11));
  for (const a of ARMS) {
    console.log('  ' + a.padEnd(10)
      + pct(rows.filter(r => wrong(r, a)).length, rows.length).padStart(8)
      + pct(F.filter(r => wrong(r, a)).length, F.length).padStart(9)
      + pct(M.filter(r => wrong(r, a)).length, M.length).padStart(9)
      + pct(F.filter(r => clear(r, a)).length, F.length).padStart(11)
      + pct(M.filter(r => !clear(r, a)).length, M.length).padStart(11));
  }

  console.log('\npaired vs rgb (only reads where they disagree):');
  for (const a of ARMS.slice(1)) {
    let fx = 0, bk = 0;
    for (const r of rows) {
      const A = !wrong(r, 'rgb'), B = !wrong(r, a);
      if (!A && B) fx++; else if (A && !B) bk++;
    }
    const n = fx + bk;
    console.log('  ' + a.padEnd(10) + 'fixed ' + String(fx).padStart(4) + '  broke ' + String(bk).padStart(4)
      + '  net ' + ((fx - bk >= 0 ? '+' : '') + (fx - bk)).padStart(5)
      + '  z ' + (n ? ((Math.abs(fx - bk) - 1) / Math.sqrt(n)).toFixed(2) : '0.00'));
  }

  // Finding 37 put a cliff just below his band. If grey only helps on big
  // faces it is useless to him, so the size split is the load-bearing cut.
  console.log('\nWOMEN WRONG by native face size -- his faces land at 38-62px');
  const bands = [[0, 32], [32, 48], [48, 64], [64, 96], [96, 1e9]];
  console.log('  ' + 'band'.padEnd(12) + 'n'.padStart(6) + ARMS.map(a => a.padStart(10)).join(''));
  for (const [lo, hi] of bands) {
    const s = F.filter(r => r.px >= lo && r.px < hi);
    if (!s.length) continue;
    console.log('  ' + (lo + '-' + (hi > 1e8 ? '+' : hi) + 'px').padEnd(12) + String(s.length).padStart(6)
      + ARMS.map(a => pct(s.filter(r => wrong(r, a)).length, s.length).padStart(10)).join(''));
  }

  console.log('\nper video, women wrong (an arm that wins on one video won nothing):');
  const vids = [...new Set(rows.map(r => r.vid))].sort();
  for (const v of vids) {
    const s = F.filter(r => r.vid === v);
    if (!s.length) continue;
    console.log('  ' + v.padEnd(14) + String(s.length).padStart(5)
      + ARMS.map(a => pct(s.filter(r => wrong(r, a)).length, s.length).padStart(10)).join(''));
  }
  console.log('\nbanked to ' + BANK + '/grey-corpus-rows.json');
}
main().catch(e => { console.error(e); process.exit(1); });
