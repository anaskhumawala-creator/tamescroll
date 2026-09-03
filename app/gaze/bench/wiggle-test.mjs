// ASK THE SAME MODEL THE SAME QUESTION IN A SLIGHTLY DIFFERENT WAY.
//
// The head's failure is DETERMINISTIC per person: corpus woman
// KAWvDsghyc8#39 reads male on 8 of 8 reads. Same face, same pixels,
// same wrong answer. So nothing that averages over frames can help --
// there is no noise to average away, and the identity memory would only
// remember the wrong answer for longer.
//
// But "same pixels" is the load-bearing word. A deterministic wrong
// answer is a property of one exact input. Perturb the input slightly --
// mirror it, rotate it, zoom it -- and a robust answer survives while a
// brittle one flips. That is test-time augmentation, and disagreement
// under it is the only per-read uncertainty signal available that does
// not need a second model.
//
// ARMS, each one gender read on the SAME banked crop:
//   orig    the crop as banked (what ships today saw)
//   mirror  left-right flip. A face is near-symmetric, so a real read
//           should barely move.
//   zoom    1.12x centre crop -- less context, same face
//   rot     8 degrees
//
// COST IF SHIPPED: one extra gender pass per arm, on the ONE frame a
// clearance is decided on, not on every frame. ~50ms on GPU per arm.
//
// TRUTH IS THE HUMAN LABEL, 107 hand-labelled clusters.
//
// WHAT WOULD MAKE THIS WORTH SHIPPING: the arms must DISAGREE more on
// wrong reads than on right ones. If a wrong read is stable under
// perturbation too, the idea is dead and this bench must say so.
//
// NOTE ON THE CROPS: these are the BANKED 112x112 crops, already cut by
// squareBox. So `zoom` can only zoom IN, and none of the arms can add
// context the bank does not hold. A wider-crop arm needs the source
// frames and belongs in crop-align-ab.mjs, not here.
import './_build.mjs';
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';

const BANK = 'Z:/tamescroll-corpus/bank';
const FULL = { x1: 0, y1: 0, x2: 1, y2: 1 };
const LIMIT = Number(process.env.WG_LIMIT || 0);
const ARMS = ['orig', 'mirror', 'zoom', 'rot'];
const CLEAR = 0.725;   // GENDER_CLEAR_SCORE 0.45, in raw sigmoid terms

function readPPM(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0x50 || b[1] !== 0x36) throw new Error('not P6: ' + file);
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
  return { w, h, data: b.subarray(i, i + w * h * 3) };
}

async function readOne(model, img) {
  const out = await classifyFaceGenders(model, null, [FULL], img, { square: true });
  const g = out[0];
  return g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2;
}

async function main() {
  const labels = JSON.parse(fs.readFileSync(BANK + '/label/labels.json', 'utf8'));
  const clusters = JSON.parse(fs.readFileSync(BANK + '/label/clusters.json', 'utf8'));
  const work = [];
  for (const c of clusters) {
    const who = labels[c.id];
    if (who !== 'man' && who !== 'woman') continue;
    for (const m of c.members) work.push({ crop: m.crop, who: who, cid: c.id });
  }
  const jobs = LIMIT ? work.slice(0, LIMIT) : work;
  process.stderr.write('crops ' + jobs.length + '\n');

  await tf.setBackend('cpu');
  await tf.ready();
  const gen = await tfconv.loadGraphModel(fsHandler('faceres'));

  const rows = [];
  let done = 0, missing = 0;
  for (const j of jobs) {
    const p = BANK + '/crops/' + j.crop;
    if (!fs.existsSync(p)) { missing++; continue; }
    const ppm = readPPM(p);
    const base = tf.tensor3d(new Uint8Array(ppm.data), [ppm.h, ppm.w, 3], 'int32');
    const made = [];
    try {
      const arms = { orig: base };
      arms.mirror = tf.tidy(function () { return tf.reverse(base, [1]); });
      made.push(arms.mirror);
      arms.zoom = tf.tidy(function () {
        const c = 0.5 - 0.5 / 1.12, d = 0.5 + 0.5 / 1.12;
        return tf.squeeze(tf.cast(tf.image.cropAndResize(
          tf.expandDims(tf.cast(base, 'float32'), 0),
          [[c, c, d, d]], [0], [ppm.h, ppm.w]), 'int32'), [0]);
      });
      made.push(arms.zoom);
      // Rotate about the centre. tf.image.transform takes the INVERSE
      // map (output pixel -> input pixel), same convention as
      // face-align.mjs; getting it backwards produces a plausible image
      // that is wrong in a way no assertion catches.
      arms.rot = tf.tidy(function () {
        const a = (8 * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
        const cx = ppm.w / 2, cy = ppm.h / 2;
        const t = [co, -si, cx - co * cx + si * cy, si, co, cy - si * cx - co * cy, 0, 0];
        return tf.squeeze(tf.cast(tf.image.transform(
          tf.expandDims(tf.cast(base, 'float32'), 0),
          tf.tensor2d([t], [1, 8]), 'bilinear', 'nearest', 0), 'int32'), [0]);
      });
      made.push(arms.rot);

      const row = { crop: j.crop, who: j.who, cid: j.cid };
      for (let k = 0; k < ARMS.length; k++) row[ARMS[k]] = await readOne(gen, arms[ARMS[k]]);
      rows.push(row);
    } finally {
      tf.dispose(base);
      for (let k = 0; k < made.length; k++) tf.dispose(made[k]);
    }
    if (++done % 100 === 0) process.stderr.write('  ' + done + '/' + jobs.length + '\n');
  }

  fs.writeFileSync(BANK + '/wiggle-rows.json', JSON.stringify(rows));
  process.stderr.write('missing crops ' + missing + '\n');

  const pct = function (a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '--'; };
  const q = function (a, p) {
    const s = a.slice().sort(function (x, y) { return x - y; });
    return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
  };
  for (const r of rows) {
    const v = ARMS.map(function (a) { return r[a]; });
    r.spread = Math.max.apply(null, v) - Math.min.apply(null, v);
    r.allClear = v.every(function (x) { return x >= CLEAR; });
    r.origClear = r.orig >= CLEAR;
    r.wrong = (r.orig >= 0.5) !== (r.who === 'man');
  }
  const F = rows.filter(function (r) { return r.who === 'woman'; });
  const M = rows.filter(function (r) { return r.who === 'man'; });

  console.log('\nscored ' + rows.length + '   women ' + F.length + '   men ' + M.length + '\n');
  console.log('DOES PERTURBING MOVE A WRONG READ MORE THAN A RIGHT ONE?');
  const groups = [['right reads', rows.filter(function (r) { return !r.wrong; })],
                  ['WRONG reads', rows.filter(function (r) { return r.wrong; })]];
  for (const g of groups) {
    const sp = g[1].map(function (r) { return r.spread; });
    console.log('  ' + g[0].padEnd(12) + ' n ' + String(g[1].length).padStart(4)
      + '   spread p25 ' + q(sp, 0.25).toFixed(3) + '  p50 ' + q(sp, 0.5).toFixed(3)
      + '  p75 ' + q(sp, 0.75).toFixed(3) + '  p95 ' + q(sp, 0.95).toFixed(3));
  }

  console.log('\nPER ARM ALONE, wrong rate:');
  for (const a of ARMS) {
    const w = rows.filter(function (r) { return (r[a] >= 0.5) !== (r.who === 'man'); }).length;
    const fw = F.filter(function (r) { return r[a] >= 0.5; }).length;
    console.log('  ' + a.padEnd(7) + ' wrong ' + pct(w, rows.length).padStart(6)
      + '   women wrong ' + pct(fw, F.length).padStart(6));
  }

  console.log('\nCLEAR RULE:');
  console.log('  orig only         exposure ' + pct(F.filter(function (r) { return r.origClear; }).length, F.length).padStart(6)
    + '   false cover ' + pct(M.filter(function (r) { return !r.origClear; }).length, M.length).padStart(6));
  console.log('  all 4 arms clear  exposure ' + pct(F.filter(function (r) { return r.allClear; }).length, F.length).padStart(6)
    + '   false cover ' + pct(M.filter(function (r) { return !r.allClear; }).length, M.length).padStart(6));
  for (const s of [0.05, 0.10, 0.20]) {
    const ok = function (r) { return r.origClear && r.spread < s; };
    console.log('  orig + spread<' + s.toFixed(2) + '  exposure ' + pct(F.filter(ok).length, F.length).padStart(6)
      + '   false cover ' + pct(M.filter(function (r) { return !ok(r); }).length, M.length).padStart(6));
  }

  console.log('\nTHE LEAKING WOMEN under perturbation:');
  const leakers = new Set(F.filter(function (r) { return r.origClear; }).map(function (r) { return r.cid; }));
  for (const cid of leakers) {
    const s = F.filter(function (r) { return r.cid === cid && r.origClear; });
    console.log('  ' + cid.padEnd(20) + ' leaked ' + String(s.length).padStart(3)
      + '   still leak under all-4 rule ' + s.filter(function (r) { return r.allClear; }).length
      + '   spread p50 ' + q(s.map(function (r) { return r.spread; }), 0.5).toFixed(3));
  }
  console.log('\nrows banked to ' + BANK + '/wiggle-rows.json');
}
main().catch(function (e) { console.error(e); process.exit(1); });
