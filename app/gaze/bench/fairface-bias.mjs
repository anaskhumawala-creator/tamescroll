// THE BLIND SPOT NOBODY HAS EVER LOOKED AT.
//
// Every accuracy number this repo owns comes from ten YouTube videos of
// mostly white tech presenters. So the question "is the gender head
// worse on some skin tones than others" has never been asked, in either
// direction, and a protection app that quietly fails on one group is a
// defect whether or not anyone reports it.
//
// FairFace exists for exactly this: 108,501 Flickr faces (YFCC-100M),
// deliberately balanced across seven race groups, labelled male/female.
// Dataset licence CC BY 4.0 -- commercial use permitted with attribution
// (re-read live 2026-09-03; the September research had flagged the
// licence column as never web-verified). Their trained CHECKPOINTS carry
// no licence at all and are NOT used here; only the images.
//   https://github.com/joojs/fairface  -- Karkkainen & Joo, WACV 2021
//
// SAMPLE: 100 faces per race x gender = 1,400, adults only (the app has
// a separate child gate, so gender on minors is a different question),
// fixed seed, from the 0.25-padding validation split -- the padding
// nearest our own FACE_ENLARGE 1.4. 100 per cell gives +-6 points per
// cell at 95%, and a real bias gap is 10-20 points, so this is sized to
// SEE a gap, not to put three decimals on one. 11,000 would buy +-1
// point and no decision depends on that.
//
// WHAT THIS CAN SAY: whether faceres, run through our own shipped chain,
// is systematically worse on some group.
//
// WHAT IT CANNOT SAY, and the reason it must never become the main
// scoreboard: FairFace crops are ALREADY ALIGNED -- their own README
// says the faces were cropped with dlib's `get_face_chip()`, which
// rotates and centres on the eyes. Our production input is a raw
// detector box off a 640x360 video frame, unaligned. So this measures
// the model under IDEAL conditions and will FLATTER it. It has no video,
// no motion, no thumbnails and no cadence, which is where 72-86% of our
// scored error lives (track-accuracy.md).
//
// AND THAT SAME FACT IS WHY THE ALIGNMENT FIX IS NOT TESTED HERE. To
// test alignment on FairFace I would have to deliberately UN-align an
// aligned face, which is a synthetic distortion of my own invention.
// The honest alignment A/B runs on our own corpus crops, where the
// misalignment is the real one. See yaw-slice.mjs.
//
// THE CHAIN IS THE SHIPPED ONE: detectFaceBoxes -> classifyFaceGenders
// with square:true, the same two calls the worker makes, so a crop or
// preprocessing defect shows up here rather than being bypassed.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';

const DIR = 'Z:/tamescroll-corpus/fairface';
const LIMIT = Number(process.env.FF_LIMIT || 0);

function readPPM(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0x50 || b[1] !== 0x36) throw new Error(`not P6: ${file}`);
  let i = 2; const nums = [];
  while (nums.length < 3) {
    while (i < b.length && /\s/.test(String.fromCharCode(b[i]))) i++;
    if (b[i] === 0x23) { while (i < b.length && b[i] !== 0x0a) i++; continue; }
    let s = '';
    while (i < b.length && !/\s/.test(String.fromCharCode(b[i]))) s += String.fromCharCode(b[i++]);
    nums.push(Number(s));
  }
  i++;
  const [w, h] = nums;
  return { w, h, data: b.subarray(i, i + w * h * 3) };
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
// Wilson interval, because a cell of 100 at 4% wrong has a wildly
// asymmetric error bar and a normal approximation would put its lower
// bound below zero -- which is how a "gap" gets reported that isn't one.
function wilson(k, n) {
  if (!n) return [NaN, NaN];
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [100 * (c - m) / d, 100 * (c + m) / d];
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(`${DIR}/sample.json`, 'utf8'));
  const work = LIMIT ? meta.slice(0, LIMIT) : meta;
  process.stderr.write(`fairface sample ${meta.length}, measuring ${work.length}\n`);

  await tf.setBackend('cpu');
  await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const gender = await tfconv.loadGraphModel(fsHandler('faceres'));

  let noFace = 0, done = 0;
  const rows = [];
  for (const m of work) {
    const ppm = readPPM(path.join(DIR, 'sample', m.file));
    const img = tf.tensor3d(new Uint8Array(ppm.data), [ppm.h, ppm.w, 3], 'int32');
    try {
      const boxes = await detectFaceBoxes(face, null, img);
      if (!boxes.length) { noFace++; continue; }
      let best = boxes[0];
      for (const b of boxes) {
        if ((b.x2 - b.x1) * (b.y2 - b.y1) > (best.x2 - best.x1) * (best.y2 - best.y1)) best = b;
      }
      const out = await classifyFaceGenders(gender, null, [best], img, { square: true });
      const g = out[0];
      rows.push({
        race: m.race, truth: m.gender === 'Male' ? 'male' : 'female',
        got: g.gender, score: g.score, age: g.age, conf: best.confidence,
        right: g.gender === (m.gender === 'Male' ? 'male' : 'female'),
      });
    } finally {
      tf.dispose(img);
    }
    if (++done % 100 === 0) process.stderr.write(`  ${done}/${work.length}\n`);
  }

  console.log(`\nread ${rows.length} of ${work.length}   (BlazeFace found no face in ${noFace})`);
  const W = rows.filter((r) => !r.right);
  const [lo, hi] = wilson(W.length, rows.length);
  console.log(`OVERALL wrong ${W.length}/${rows.length} = ${pct(W.length, rows.length)}`
    + `   95% CI ${lo.toFixed(1)}-${hi.toFixed(1)}%`);

  for (const truth of ['female', 'male']) {
    const s = rows.filter((r) => r.truth === truth);
    const w = s.filter((r) => !r.right);
    console.log(`  truth ${truth.padEnd(6)} n ${String(s.length).padStart(4)}`
      + `   wrong ${pct(w.length, s.length)}`);
  }

  console.log('\nBY RACE x TRUE GENDER (wrong %, 95% CI):');
  const races = [...new Set(rows.map((r) => r.race))].sort();
  for (const race of races) {
    const line = [race.padEnd(16)];
    for (const truth of ['female', 'male']) {
      const s = rows.filter((r) => r.race === race && r.truth === truth);
      const k = s.filter((r) => !r.right).length;
      const [a, b] = wilson(k, s.length);
      line.push(`${truth[0]}: ${String(k).padStart(3)}/${String(s.length).padEnd(3)} `
        + `${pct(k, s.length).padStart(6)} [${a.toFixed(0)}-${b.toFixed(0)}]`);
    }
    console.log('  ' + line.join('   '));
  }

  // The gap that matters is the WORST cell against the BEST, with the
  // intervals beside it -- two cells whose bars overlap are not a gap.
  const cells = [];
  for (const race of races) for (const truth of ['female', 'male']) {
    const s = rows.filter((r) => r.race === race && r.truth === truth);
    if (s.length) cells.push({ race, truth, rate: 100 * s.filter((r) => !r.right).length / s.length, n: s.length });
  }
  cells.sort((a, b) => b.rate - a.rate);
  console.log(`\nworst cell  ${cells[0].race} ${cells[0].truth} ${cells[0].rate.toFixed(1)}%`
    + `   best cell  ${cells[cells.length - 1].race} ${cells[cells.length - 1].truth} `
    + `${cells[cells.length - 1].rate.toFixed(1)}%`);

  fs.writeFileSync(`${DIR}/bias-rows.json`, JSON.stringify(rows));
  console.log(`rows banked to ${DIR}/bias-rows.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
