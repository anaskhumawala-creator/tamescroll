// HIS RANDOM BLUR MARKS, ON THE PATH HE ACTUALLY COMPLAINS ABOUT.
//
// "the random blur marks are pretty pretty annoying on random places on
// random thumbnails, like randomly just blur some text."  THUMBNAILS. Every
// number this repo owns about junk patches -- finding 35 included -- was
// measured on the VIDEO rule (`GENDER_CLEAR_SCORE`, clear-or-not). The IMAGE
// rule is a different function with a different failure mode and has never
// been measured at all:
//
//   flaggedFaceIndices: flag unless  same gender AND adult AND score >= 0.4
//
// Read the direction. On the video path a junk crop has to earn a CLEAR to
// go away. On the image path a junk crop is patched unless it reads
// CONFIDENTLY as his own gender -- so a weak read, the model shrugging, is
// a patch. Finding 35 measured that 89.2% of the junk that survives the null
// guard is exactly that: a weak male read. On the image path every one of
// those is a mark on a thumbnail.
//
// THE POPULATION IS THE HONEST ONE. 135 crops hand-labelled `notperson` and
// 59 `bodypart` out of 3,465 -- these are things BlazeFace ALREADY reported
// as a face in his own footage, not synthetic corner crops force-read. That
// makes this a measurement of what reaches the rule, and finding 35's own
// caveat applies unchanged: it cannot see how often the detector fires on
// text in the first place, so every rate here is conditional on detection.
//
// THREE QUESTIONS, and the control matters more than the first two:
//   1 how many junk crops get a mark under the shipped image rule
//   2 does GREY (findings 41/42) reduce that, or does flattening to luma
//     make the model MORE willing to call text a face
//   3 THE COST. Every refusal is measured against real labelled men AND
//     women from the same corpus, because a change that removes marks by
//     making the rule shy also uncovers a woman, and that trade is the only
//     thing that decides whether any of this is shippable.
import './_build.mjs';
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';
import { flaggedFaceIndices, setNmFloor, NULL_MINT_NM_FLOOR } from '../src/gender-verdict.mjs';

const BANK = 'Z:/tamescroll-corpus/bank';
const NL = String.fromCharCode(10);
const REAL_PER = Number(process.env.IJ_REAL || 120); // real faces per sex, control arm

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
function toGrey(d, n) {
  const o = new Uint8Array(n * 3);
  for (let p = 0; p < n; p++) {
    const v = clamp(0.299 * d[p * 3] + 0.587 * d[p * 3 + 1] + 0.114 * d[p * 3 + 2]);
    o[p * 3] = v; o[p * 3 + 1] = v; o[p * 3 + 2] = v;
  }
  return o;
}

async function main() {
  const labels = JSON.parse(fs.readFileSync(BANK + '/label/labels.json', 'utf8'));
  const clusters = JSON.parse(fs.readFileSync(BANK + '/label/clusters.json', 'utf8'));
  const pools = { junk: [], man: [], woman: [] };
  for (const c of clusters) {
    const who = labels[c.id];
    const bucket = (who === 'notperson' || who === 'bodypart') ? 'junk'
      : (who === 'man' || who === 'woman') ? who : null;
    if (!bucket) continue;
    for (const m of c.members) pools[bucket].push({ kind: bucket, cid: c.id, vid: c.vid, crop: m.crop, px: m.px });
  }
  // Every junk crop; a strided sample of the real ones so the control is
  // spread across all ten videos rather than the first two.
  const stride = a => {
    const k = Math.max(1, Math.floor(a.length / REAL_PER));
    return a.filter((_, i) => i % k === 0).slice(0, REAL_PER);
  };
  const work = [...pools.junk, ...stride(pools.man), ...stride(pools.woman)];
  process.stderr.write('junk ' + pools.junk.length + '  men ' + stride(pools.man).length
    + '  women ' + stride(pools.woman).length + '  = ' + work.length + ' x 2 arms' + NL);

  await tf.setBackend('cpu');
  await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const gen = await tfconv.loadGraphModel(fsHandler('faceres'));

  const rows = [];
  let done = 0, skip = 0;
  for (const w of work) {
    const ppm = readPPM(BANK + '/crops/' + w.crop);
    if (!ppm) { skip++; done++; continue; }
    const n = ppm.w * ppm.h;
    const rgb = new Uint8Array(ppm.data);
    const base = tf.tensor3d(rgb, [ppm.h, ppm.w, 3], 'int32');
    let box = null;
    try {
      for (const b of await detectFaceBoxes(face, null, base)) {
        if (!box || (b.x2 - b.x1) * (b.y2 - b.y1) > (box.x2 - box.x1) * (box.y2 - box.y1)) box = b;
      }
    } finally { tf.dispose(base); }
    if (!box) { skip++; done++; continue; }

    const row = { kind: w.kind, cid: w.cid, vid: w.vid, px: w.px, crop: w.crop };
    for (const [arm, pix] of [['rgb', rgb], ['grey', toGrey(ppm.data, n)]]) {
      const img = tf.tensor3d(pix, [ppm.h, ppm.w, 3], 'int32');
      try {
        // Keep the WHOLE face object -- flaggedFaceIndices reads gender,
        // score, age, childP and nm, and restating any of them here is how
        // a bench stops measuring the shipped rule.
        row[arm] = (await classifyFaceGenders(gen, null, [box], img, { square: true }))[0];
      } finally { tf.dispose(img); }
    }
    rows.push(row);
    if (++done % 40 === 0) {
      fs.writeFileSync(BANK + '/image-junk-rows.json', JSON.stringify(rows));
      process.stderr.write('  ' + done + '/' + work.length + NL);
    }
  }
  fs.writeFileSync(BANK + '/image-junk-rows.json', JSON.stringify(rows));
  score(rows, skip);
}

// The SHIPPED image rule, called rather than restated: one face in, is it
// flagged. His mode is 'man'.
const marked = f => flaggedFaceIndices('man', [f]).length > 0;

function score(rows, skip) {
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
  const J = rows.filter(r => r.kind === 'junk');
  const M = rows.filter(r => r.kind === 'man');
  const F = rows.filter(r => r.kind === 'woman');
  console.log(NL + 'scored ' + rows.length + ' (skipped ' + skip + ')   junk ' + J.length
    + '  men ' + M.length + '  women ' + F.length);
  console.log('nm floor in force: ' + NULL_MINT_NM_FLOOR);

  console.log(NL + 'THE SHIPPED IMAGE RULE, his man mode');
  console.log('  ' + 'arm'.padEnd(8) + 'JUNK MARKED'.padStart(14) + 'men marked'.padStart(13)
    + 'women marked'.padStart(15) + '   (men marked = false cover, women UNmarked = exposure)');
  for (const a of ['rgb', 'grey']) {
    console.log('  ' + a.padEnd(8)
      + pct(J.filter(r => marked(r[a])).length, J.length).padStart(14)
      + pct(M.filter(r => marked(r[a])).length, M.length).padStart(13)
      + pct(F.filter(r => marked(r[a])).length, F.length).padStart(15));
  }

  // WHY a junk crop gets marked. The rule has three ways to fire and they
  // want completely different fixes, so an aggregate is not actionable.
  console.log(NL + 'WHY the junk that IS marked gets marked (rgb):');
  const reasons = { 'read female (opposite)': 0, 'read child': 0, 'weak read, score < 0.4': 0 };
  for (const r of J) {
    const f = r.rgb;
    if (!marked(f)) continue;
    if (f.gender !== 'male') reasons['read female (opposite)']++;
    else if (f.childP >= 0.25) reasons['read child']++;
    else reasons['weak read, score < 0.4']++;
  }
  const nMarked = J.filter(r => marked(r.rgb)).length;
  for (const k of Object.keys(reasons))
    console.log('  ' + k.padEnd(26) + String(reasons[k]).padStart(5) + '  ' + pct(reasons[k], nMarked));

  // The one dial that reaches this without a build, swept against its cost.
  console.log(NL + 'nm FLOOR SWEEP (OTA clamp stops at 5.5; 6+ needs a build)');
  console.log('  ' + 'floor'.padEnd(8) + 'JUNK marked'.padStart(14) + 'men marked'.padStart(13)
    + 'women marked'.padStart(15));
  const saved = NULL_MINT_NM_FLOOR;
  for (const fl of [0, 4, 5, 5.5, 6, 7, 8]) {
    setNmFloor(fl);
    console.log('  ' + String(fl).padEnd(8)
      + pct(J.filter(r => marked(r.rgb)).length, J.length).padStart(14)
      + pct(M.filter(r => marked(r.rgb)).length, M.length).padStart(13)
      + pct(F.filter(r => marked(r.rgb)).length, F.length).padStart(15));
  }
  setNmFloor(saved);

  console.log(NL + 'nm distribution -- the axis the floor cuts on');
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
  for (const [k, s] of [['junk', J], ['men', M], ['women', F]]) {
    const v = s.map(r => (r.rgb.shape || {}).norm).filter(x => typeof x === 'number');
    console.log('  ' + k.padEnd(8) + 'n ' + String(v.length).padStart(4)
      + '   p05 ' + q(v, 0.05).toFixed(2) + '   p50 ' + q(v, 0.5).toFixed(2)
      + '   p95 ' + q(v, 0.95).toFixed(2));
  }
  console.log(NL + 'banked to ' + BANK + '/image-junk-rows.json');
}

main().catch(e => { console.error(e); process.exit(1); });
