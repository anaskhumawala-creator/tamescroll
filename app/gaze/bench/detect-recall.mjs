// THE BLIND SPOT UNDER EVERY OTHER NUMBER: DO WE EVEN FIND THE FACE?
//
// Every accuracy figure this repo owns is CONDITIONAL ON DETECTION. The
// corpus reads exist because BlazeFace found a face; the FairFace bias
// table scores the 1,348 crops it found a face in. A face the detector
// walks past gets no read, no track, no patch -- the subject is simply
// sharp -- and it is invisible to all of it, by construction. We only
// grade the questions we asked.
//
// One number already hints the gap is real: on FairFace's clean,
// aligned, 224px portraits BlazeFace found nothing in 52 of 1,400 --
// 3.7% missed under ideal conditions. His phone gets faces at 38-62
// native px off a 640x360 stream.
//
// THE TEST: take FairFace crops, where exactly one face is known to be
// present and centred, and paste each one at a chosen NATIVE PIXEL SIZE
// into a 640x360 frame -- the exact frame size his player decodes. Then
// run the shipped detector and ask whether it found anything.
//
// WHY THIS IS A CONSERVATIVE (i.e. OPTIMISTIC) ESTIMATE, and it must be
// read that way: the background is flat grey, so there are no
// distractors, no motion blur, no compression artefacts, no occlusion
// and no odd pose beyond what FairFace already contains. A real 360p
// YouTube frame is harder in every one of those directions. So a miss
// here is definitely a miss; a hit here is not a promise of a hit in the
// wild.
//
// AND IT CANNOT SEE FALSE POSITIVES. One face is present, so this
// measures RECALL only. The precision side (patches minted on
// non-faces -- the "random blur marks" complaint) is a different bench
// and needs frames with no people in them.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';

const DIR = 'Z:/tamescroll-corpus/fairface';
const FW = 640, FH = 360;                 // what m.youtube actually decodes
const SIZES = [24, 32, 40, 48, 56, 64, 80, 96, 128];
const LIMIT = Number(process.env.DR_LIMIT || 0);

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
  return { w: w, h: h, data: b.subarray(i, i + w * h * 3) };
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(DIR + '/sample.json', 'utf8'));
  const work = LIMIT ? meta.slice(0, LIMIT) : meta;
  process.stderr.write('crops ' + work.length + ', sizes ' + SIZES.join(',') + '\n');

  await tf.setBackend('cpu');
  await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));

  // hits[size] = { found, total, byRace: {race: {found,total}} }
  const acc = {};
  for (const s of SIZES) acc[s] = { found: 0, total: 0, race: {}, sex: {} };

  let done = 0;
  for (const m of work) {
    const ppm = readPPM(path.join(DIR, 'sample', m.file));
    const src = tf.tensor3d(new Uint8Array(ppm.data), [ppm.h, ppm.w, 3], 'int32');
    try {
      for (const S of SIZES) {
        // Paste the crop, resized to S x S, into the middle of a flat
        // 640x360 frame. Mid-grey rather than black: a black surround
        // gives an unnaturally hard edge that a detector can key on.
        const frame = tf.tidy(function () {
          const small = tf.image.resizeBilinear(tf.cast(src, 'float32'), [S, S]);
          const x0 = Math.floor((FW - S) / 2), y0 = Math.floor((FH - S) / 2);
          const padded = tf.pad(small,
            [[y0, FH - S - y0], [x0, FW - S - x0], [0, 0]], 128);
          return tf.cast(padded, 'int32');
        });
        try {
          const boxes = await detectFaceBoxes(face, null, frame);
          const a = acc[S];
          a.total++;
          if (!a.race[m.race]) a.race[m.race] = { f: 0, t: 0 };
          if (!a.sex[m.gender]) a.sex[m.gender] = { f: 0, t: 0 };
          a.race[m.race].t++; a.sex[m.gender].t++;
          if (boxes.length) { a.found++; a.race[m.race].f++; a.sex[m.gender].f++; }
        } finally { tf.dispose(frame); }
      }
    } finally { tf.dispose(src); }
    if (++done % 25 === 0) process.stderr.write('  ' + done + '/' + work.length + '\n');
  }

  const pct = function (a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '--'; };
  console.log('\nRECALL by native face size, one known face in a 640x360 frame');
  console.log('(his player decodes 640x360; his faces land at 38-62 px)\n');
  for (const S of SIZES) {
    const a = acc[S];
    console.log('  ' + String(S).padStart(4) + ' px   found ' + String(a.found).padStart(4) + '/' + String(a.total).padEnd(4)
      + '  = ' + pct(a.found, a.total).padStart(6)
      + '   MISSED ' + pct(a.total - a.found, a.total).padStart(6));
  }
  console.log('\nMISS RATE by race, at the sizes his stream produces:');
  const races = Object.keys(acc[SIZES[0]].race).sort();
  const cols = SIZES.filter(function (s) { return s <= 64; });
  console.log('  ' + 'race'.padEnd(16) + cols.map(function (s) { return String(s + 'px').padStart(8); }).join(''));
  for (const r of races) {
    console.log('  ' + r.padEnd(16) + cols.map(function (s) {
      const c = acc[s].race[r];
      return pct(c.t - c.f, c.t).padStart(8);
    }).join(''));
  }
  console.log('\nMISS RATE by sex:');
  for (const g of Object.keys(acc[SIZES[0]].sex).sort()) {
    console.log('  ' + g.padEnd(16) + cols.map(function (s) {
      const c = acc[s].sex[g];
      return pct(c.t - c.f, c.t).padStart(8);
    }).join(''));
  }
  fs.writeFileSync(DIR + '/recall.json', JSON.stringify(acc));
  console.log('\nbanked to ' + DIR + '/recall.json');
}
main().catch(function (e) { console.error(e); process.exit(1); });
