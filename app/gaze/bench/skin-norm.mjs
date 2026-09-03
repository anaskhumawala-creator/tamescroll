// HIS SECOND COLOUR IDEA: PUT EVERY FACE ON THE SAME SKIN TONE.
//
// The grey arm removed colour entirely and cut the between-group gap from
// 31 to 21 points. This asks the narrower question underneath it: is it
// COLOUR the model leans on, or specifically SKIN TONE? Grey cannot tell
// those apart -- it deletes hue, tone, and whatever else the three
// channels were carrying, all at once.
//
// THE LINE THIS MUST NOT CROSS, and the reason the arms are shaped this
// way. "Detect their skin tone, then correct it" is inferring a sensitive
// characteristic about a person and treating them differently on it --
// biometric categorisation, the AI Hub Model License 2.c clause that
// killed the QNN delegate in loop 47, and refused on principle in finding
// 31. NOTHING HERE INFERS ANYTHING. Every crop gets the identical
// operation with the identical constants: make your channel statistics
// equal this fixed target. No branch, no classifier, no group label read
// at any point, and a pale face is moved exactly as hard as a dark one --
// just in the other direction. That is white balance.
//
// ARMS
//   rgb     untouched (ships today)
//   grey    luma to three channels -- the current winner, carried here as
//           the thing the colour arms have to beat
//   tone    per-channel MEAN forced to a fixed target, spread untouched.
//           Shifts tone, keeps contrast and texture.
//   tonesd  per-channel mean AND standard deviation forced to fixed
//           targets. Same tone and same contrast for everyone.
//
// TARGET is neutral mid-grey (128) rather than any group's measured skin,
// because nominating one group's tone as "the target" is exactly the
// framing this is avoiding.
//
// FAILURE MODE TO EXPECT, said before the numbers: forcing a per-channel
// mean over the WHOLE crop moves the background too, so a face against a
// bright wall gets shifted for reasons that have nothing to do with skin.
// The 1.4x FACE_ENLARGE crop is mostly face, which is what makes this
// worth trying, but it is not pure face and this arm cannot separate the
// two.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';

const DIR = 'Z:/tamescroll-corpus/fairface';
const RACES = (process.env.SN_RACES || 'Indian,Black,White,East Asian').split(',');
const PER = Number(process.env.SN_PER || 50);
const ARMS = ['rgb', 'grey', 'tone', 'tonesd'];
const TGT_MEAN = 128, TGT_SD = 52;

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
  return { w: nums[0], h: nums[1], data: b.subarray(i, i + nums[0] * nums[1] * 3) };
}
const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

function armGrey(d, n) {
  const o = new Uint8Array(n * 3);
  for (let p = 0; p < n; p++) {
    const v = clamp(0.299 * d[p * 3] + 0.587 * d[p * 3 + 1] + 0.114 * d[p * 3 + 2]);
    o[p * 3] = v; o[p * 3 + 1] = v; o[p * 3 + 2] = v;
  }
  return o;
}
// One code path for both colour arms -- `useSd` is the ONLY difference, so
// a gap between them cannot be an implementation difference.
function armTone(d, n, useSd) {
  const o = new Uint8Array(n * 3);
  for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let p = 0; p < n; p++) s += d[p * 3 + c];
    const mu = s / n;
    let v = 0;
    for (let p = 0; p < n; p++) v += (d[p * 3 + c] - mu) * (d[p * 3 + c] - mu);
    const sd = Math.sqrt(v / n) || 1;
    const k = useSd ? TGT_SD / sd : 1;
    for (let p = 0; p < n; p++) o[p * 3 + c] = clamp(TGT_MEAN + (d[p * 3 + c] - mu) * k);
  }
  return o;
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(DIR + '/sample.json', 'utf8'));
  const work = [];
  for (const race of RACES) {
    for (const sex of ['Female', 'Male']) {
      work.push(...meta.filter(m => m.race === race && m.gender === sex).slice(0, PER));
    }
  }
  process.stderr.write('crops ' + work.length + '\n');
  await tf.setBackend('cpu');
  await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const gen = await tfconv.loadGraphModel(fsHandler('faceres'));

  const rows = [];
  let done = 0, noFace = 0;
  for (const m of work) {
    const ppm = readPPM(path.join(DIR, 'sample', m.file));
    const n = ppm.w * ppm.h;
    const V = {
      rgb: new Uint8Array(ppm.data),
      grey: armGrey(ppm.data, n),
      tone: armTone(ppm.data, n, false),
      tonesd: armTone(ppm.data, n, true),
    };
    // Detect ONCE on the untouched crop; every arm reuses that box, so a
    // gender result here cannot be contaminated by a detection result.
    const base = tf.tensor3d(V.rgb, [ppm.h, ppm.w, 3], 'int32');
    let box = null;
    try {
      for (const b of await detectFaceBoxes(face, null, base)) {
        if (!box || (b.x2 - b.x1) * (b.y2 - b.y1) > (box.x2 - box.x1) * (box.y2 - box.y1)) box = b;
      }
    } finally { tf.dispose(base); }
    if (!box) { noFace++; done++; continue; }

    const row = { race: m.race, truth: m.gender === 'Male' ? 'male' : 'female', file: m.file };
    for (const a of ARMS) {
      const img = tf.tensor3d(V[a], [ppm.h, ppm.w, 3], 'int32');
      try {
        const g = (await classifyFaceGenders(gen, null, [box], img, { square: true }))[0];
        row[a] = g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2;
      } finally { tf.dispose(img); }
    }
    rows.push(row);
    if (++done % 25 === 0) process.stderr.write('  ' + done + '/' + work.length + '\n');
  }

  fs.writeFileSync(DIR + '/skin-rows.json', JSON.stringify(rows));
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
  const wrong = (r, a) => (r[a] >= 0.5) !== (r.truth === 'male');
  const F = rows.filter(r => r.truth === 'female');
  const M = rows.filter(r => r.truth === 'male');
  console.log('\nscored ' + rows.length + ' (no face in ' + noFace + ')\n');
  console.log('  ' + 'arm'.padEnd(8) + 'all'.padStart(8) + 'women'.padStart(9) + 'men'.padStart(8));
  for (const a of ARMS) {
    console.log('  ' + a.padEnd(8)
      + pct(rows.filter(r => wrong(r, a)).length, rows.length).padStart(8)
      + pct(F.filter(r => wrong(r, a)).length, F.length).padStart(9)
      + pct(M.filter(r => wrong(r, a)).length, M.length).padStart(8));
  }

  console.log('\nWOMEN WRONG by race x arm');
  console.log('  ' + 'race'.padEnd(14) + ARMS.map(a => a.padStart(9)).join(''));
  for (const race of RACES) {
    const s = rows.filter(r => r.race === race && r.truth === 'female');
    if (!s.length) continue;
    console.log('  ' + race.padEnd(14) + ARMS.map(a =>
      pct(s.filter(r => wrong(r, a)).length, s.length).padStart(9)).join(''));
  }

  console.log('\nGAP (worst female cell - best), per arm:');
  for (const a of ARMS) {
    const v = RACES.map(race => {
      const s = rows.filter(r => r.race === race && r.truth === 'female');
      return s.length ? 100 * s.filter(r => wrong(r, a)).length / s.length : NaN;
    }).filter(Number.isFinite);
    console.log('  ' + a.padEnd(8) + (Math.max(...v) - Math.min(...v)).toFixed(1) + ' pts');
  }

  // A net rate can hide two arms swapping equal numbers of errors. Only
  // the reads where they DISAGREE carry evidence about which is better.
  console.log('\npaired vs rgb (only faces where they disagree):');
  for (const a of ARMS.slice(1)) {
    let fx = 0, bk = 0;
    for (const r of rows) {
      const A = !wrong(r, 'rgb'), B = !wrong(r, a);
      if (!A && B) fx++; else if (A && !B) bk++;
    }
    const n = fx + bk;
    console.log('  ' + a.padEnd(8) + 'fixed ' + String(fx).padStart(3) + '  broke ' + String(bk).padStart(3)
      + '  net ' + (fx - bk >= 0 ? '+' : '') + (fx - bk)
      + '  z ' + (n ? ((Math.abs(fx - bk) - 1) / Math.sqrt(n)).toFixed(2) : '0.00'));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
