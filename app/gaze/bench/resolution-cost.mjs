// WHAT DOES HIS 360p STREAM COST US? -- PRICED WITHOUT TOUCHING HIS PHONE.
//
// m.youtube picks quality from the player box, so his 393px player decodes
// 640x360 and faces reach faceres at px p50 38-62. Every calibration this
// repo owns below that band is guesswork, and raising the stream is an
// open ruling of his that spends his data -- so it deserves a number
// before it is asked for again.
//
// THE TEST. FairFace crops are 224px portraits with a known gender. Read
// each one at its native 224, then read the SAME face downscaled to 32,
// 40, 48, 56, 64, 80, 112 and upscaled back to what the crop path would
// hand the model. The 224 answer is the ceiling; the gap to it at 40px is
// what the stream costs.
//
// WHY DOWN-THEN-UP AND NOT JUST DOWN: classifyFaceGenders resizes every
// crop to the model's fixed input regardless, so simply feeding a small
// tensor would measure nothing -- the model always sees the same tensor
// size. The DETAIL is what changes. Downscaling then upscaling destroys
// detail while keeping the tensor shape identical, which is exactly what
// a 360p stream does to a face before we ever see it.
//
// PAIRED: the same face at every size, so no arm gets an easier
// population. Split by gender AND race, because finding 31 measured the
// damage landing unevenly and a mean would hide it.
//
// LIMIT, stated up front: bicubic downscale is CLEANER than a real video
// pipeline, which also adds compression blocking, motion blur and chroma
// subsampling. So this is an OPTIMISTIC estimate of small-face cost -- a
// loss here is definitely a loss; a flat result is not proof 360p is free.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';

const DIR = 'Z:/tamescroll-corpus/fairface';
const SIZES = [224, 112, 80, 64, 56, 48, 40, 32];
const PER = Number(process.env.RC_PER || 40);   // per race x gender

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

async function main() {
  const meta = JSON.parse(fs.readFileSync(DIR + '/sample.json', 'utf8'));
  const races = [...new Set(meta.map(m => m.race))].sort();
  const work = [];
  for (const race of races) for (const sex of ['Female', 'Male']) {
    work.push(...meta.filter(m => m.race === race && m.gender === sex).slice(0, PER));
  }
  process.stderr.write(`crops ${work.length}, sizes ${SIZES.join(',')}\n`);

  await tf.setBackend('cpu'); await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const gen = await tfconv.loadGraphModel(fsHandler('faceres'));

  const rows = [];
  let done = 0, noFace = 0;
  for (const m of work) {
    const ppm = readPPM(path.join(DIR, 'sample', m.file));
    const src = tf.tensor3d(new Uint8Array(ppm.data), [ppm.h, ppm.w, 3], 'int32');
    try {
      // Detect ONCE at native resolution and reuse the box at every size.
      // Re-detecting per size would fold detection loss into a gender
      // number; detection is measured separately (detect-recall.mjs).
      let box = null;
      const boxes = await detectFaceBoxes(face, null, src);
      for (const b of boxes) {
        if (!box || (b.x2 - b.x1) * (b.y2 - b.y1) > (box.x2 - box.x1) * (box.y2 - box.y1)) box = b;
      }
      if (!box) { noFace++; done++; continue; }
      const row = { race: m.race, truth: m.gender === 'Male' ? 'male' : 'female', file: m.file };
      for (const S of SIZES) {
        const deg = S === ppm.w ? src : tf.tidy(() => {
          const f = tf.cast(src, 'float32');
          const small = tf.image.resizeBilinear(f, [S, S]);
          return tf.cast(tf.image.resizeBilinear(small, [ppm.h, ppm.w]), 'int32');
        });
        try {
          const out = await classifyFaceGenders(gen, null, [box], deg, { square: true });
          const g = out[0];
          row['s' + S] = g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2;
        } finally { if (deg !== src) tf.dispose(deg); }
      }
      rows.push(row);
    } finally { tf.dispose(src); }
    if (++done % 25 === 0) process.stderr.write(`  ${done}/${work.length}\n`);
  }

  fs.writeFileSync(DIR + '/resolution-rows.json', JSON.stringify(rows));
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
  const wrong = (r, S) => (r['s' + S] >= 0.5) !== (r.truth === 'male');
  const F = rows.filter(r => r.truth === 'female'), M = rows.filter(r => r.truth === 'male');
  console.log(`\nscored ${rows.length} (no face in ${noFace})\n`);
  console.log('WRONG RATE by face detail level');
  console.log('  ' + 'px'.padStart(5) + 'all'.padStart(9) + 'women'.padStart(9) + 'men'.padStart(9));
  for (const S of SIZES) {
    console.log('  ' + String(S).padStart(5)
      + pct(rows.filter(r => wrong(r, S)).length, rows.length).padStart(9)
      + pct(F.filter(r => wrong(r, S)).length, F.length).padStart(9)
      + pct(M.filter(r => wrong(r, S)).length, M.length).padStart(9));
  }
  console.log('\nHIS BAND: 38-62px is what 360p gives. 224 is the ceiling.');
  const at = S => 100 * F.filter(r => wrong(r, S)).length / F.length;
  console.log(`  women wrong at 48px ${at(48).toFixed(1)}%  vs at 224px ${at(224).toFixed(1)}%`
    + `   -> resolution costs ${(at(48) - at(224)).toFixed(1)} pts`);
  console.log('\nWOMEN WRONG by race x size');
  console.log('  ' + 'race'.padEnd(16) + SIZES.map(s => String(s).padStart(7)).join(''));
  for (const race of races) {
    const s = rows.filter(r => r.race === race && r.truth === 'female');
    if (!s.length) continue;
    console.log('  ' + race.padEnd(16) + SIZES.map(S =>
      pct(s.filter(r => wrong(r, S)).length, s.length).padStart(7)).join(''));
  }
  console.log('\nbanked to ' + DIR + '/resolution-rows.json');
}
main().catch(e => { console.error(e); process.exit(1); });
