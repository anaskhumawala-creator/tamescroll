// CAN THE GENDER MODEL RUN AT A QUARTER OF THE PIXELS?
//
// faceres is the most expensive thing in a verdict. On the Redmi it is
// 220ms (174 at fp16) against BlazeFace's ~90, it is 7MB of the APK, and
// its input is 224x224x3. If the network runs at 112x112 the convolution
// cost falls roughly 4x, which is the single biggest performance lever
// left that does not need a new model or a native rewrite.
//
// THE INPUT SHAPE IS LOCKED AT [-1,224,224,3], BUT THAT IS A GUARD, NOT
// THE NETWORK. tfjs refuses a mismatched shape at `execute` time. The
// graph underneath is a ResNet ending in `global_pooling/Mean`, and a
// global average pool consumes any spatial size -- that is what makes
// this worth testing rather than assuming. So this bench builds a PATCHED
// COPY of the graph topology IN MEMORY, with the input dimension freed to
// -1, and runs it against the same weight bytes.
//
// THE SHIPPED MODEL IS NEVER TOUCHED. Nothing under app/gaze/models is
// written; the patch lives only in this process, and the 224 reference is
// deliberately run through the UNPATCHED graph so the reference cannot
// inherit a patching mistake. This repo has shipped a broken gender model
// once (mini-Xception, saturated output, every face one gender) and once
// is enough.
//
// WHAT IS MEASURED, both halves, because a speed win that changes verdicts
// is not a speed win:
//   ACCURACY  the same faces at 224 / 160 / 112 / 96, paired, scored as
//             agreement with the 224 answer AND as absolute correctness
//             against the FairFace label. Agreement is the one that
//             matters -- 224 is what ships, so a size that disagrees is a
//             size that changes who gets blurred.
//   SPEED     wall clock per inference at each size, warm, median of many.
//             CPU-backend JS timings are not the phone's, so the RATIO is
//             the number to read and the absolute ms is not.
//
// EXPECT IT TO FAIL. A ResNet trained only at 224 has learned filters at
// one scale; halving the input halves the receptive field in image terms
// and the features it looks for may simply not be there. A clean failure
// is a useful result -- it closes the largest remaining cheap perf idea.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { fsHandler, MODELS } from './corpus-lib.mjs';

const DIR = 'Z:/tamescroll-corpus/fairface';
const SIZES = [224, 192, 176];
const PER = Number(process.env.FI_PER || 10);

function readPPM(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0x50 || b[1] !== 0x36) throw new Error('not P6');
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

// Walk the graph JSON and free every 224 in an input-shaped dim list.
// Deliberately narrow: only `input_1`'s own shape entries are touched, so
// a 224 that happens to appear as a constant elsewhere is left alone.
function freeInputShape(j) {
  let hits = 0;
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.name === 'input_1' && node.attr && node.attr.shape && node.attr.shape.shape) {
      for (const d of node.attr.shape.shape.dim || []) {
        if (d.size === '224' || d.size === 224) { d.size = '-1'; hits++; }
      }
    }
    for (const k of Object.keys(node)) walk(node[k]);
  };
  walk(j);
  if (j.signature && j.signature.inputs) {
    for (const k of Object.keys(j.signature.inputs)) {
      const t = j.signature.inputs[k];
      for (const d of (t.tensorShape && t.tensorShape.dim) || []) {
        if (d.size === '224' || d.size === 224) { d.size = '-1'; hits++; }
      }
    }
  }
  return hits;
}

async function main() {
  // The models are two flat files (faceres.json + faceres.bin), so the
  // patched copy is built IN MEMORY and the shipped weights are reused by
  // reference. Nothing under app/gaze/models is read-modify-written --
  // this repo has shipped a broken gender model once and once is enough.
  const j = JSON.parse(fs.readFileSync(MODELS + 'faceres.json', 'utf8'));
  const hits = freeInputShape(j.modelTopology) + freeInputShape(j);
  const bin = fs.readFileSync(MODELS + 'faceres.bin');
  const specs = [];
  for (const g of j.weightsManifest) for (const w of g.weights) specs.push(w);
  const flexHandler = { load: async () => ({
    modelTopology: j.modelTopology, weightSpecs: specs,
    weightData: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
    format: j.format, generatedBy: j.generatedBy, convertedBy: j.convertedBy,
    signature: j.signature, userDefinedMetadata: j.userDefinedMetadata }) };
  process.stderr.write('freed ' + hits + ' input dims (in memory)' + String.fromCharCode(10));

  await tf.setBackend('cpu');
  await tf.ready();
  const flex = await tfconv.loadGraphModel(flexHandler);
  const ship = await tfconv.loadGraphModel(fsHandler('faceres'));

  // Does it even run at a smaller size? Answer that before spending an
  // hour scoring faces.
  const ok = {};
  for (const S of SIZES) {
    try {
      const t = tf.zeros([1, S, S, 3]);
      const r = flex.execute(t);
      const a = Array.isArray(r) ? r : [r];
      ok[S] = true;
      process.stderr.write('  ' + S + ' runs -> ' + a.map(x => x.shape.join('x')).join(' ') + '\n');
      tf.dispose([t, ...a]);
    } catch (e) {
      ok[S] = false;
      process.stderr.write('  ' + S + ' REFUSED: ' + String(e.message).slice(0, 100) + '\n');
    }
  }
  const live = SIZES.filter(S => ok[S]);
  if (live.length < 2) {
    console.log('\nthe network refuses every smaller input. Idea closed: the shape guard was');
    console.log('not the only thing holding it at 224.');
    return;
  }

  // SPEED first -- it is cheap and decides whether accuracy is worth
  // measuring at all. A size that is not materially faster is not a lever
  // however accurate it is.
  console.log('\nSPEED, warm, median of 12 (CPU JS -- read the RATIO, not the ms)');
  const speed = {};
  for (const S of live) {
    const t = tf.fill([1, S, S, 3], 128);
    for (let i = 0; i < 3; i++) tf.dispose(flex.execute(t));
    const ms = [];
    for (let i = 0; i < 12; i++) {
      const t0 = Date.now();
      const r = flex.execute(t);
      const a = Array.isArray(r) ? r : [r];
      a.forEach(x => x.dataSync());
      tf.dispose(a);
      ms.push(Date.now() - t0);
    }
    tf.dispose(t);
    ms.sort((a, b) => a - b);
    speed[S] = ms[6];
    console.log('  ' + String(S).padStart(4) + 'px   ' + String(speed[S]).padStart(6) + ' ms'
      + '   ' + (speed[224] ? (speed[224] / speed[S]).toFixed(2) + 'x faster than 224' : ''));
  }

  // ACCURACY. Agreement with the 224 answer is the load-bearing column:
  // 224 is what ships, so a size that disagrees changes who gets blurred.
  const meta = JSON.parse(fs.readFileSync(DIR + '/sample.json', 'utf8'));
  const races = [...new Set(meta.map(m => m.race))].sort();
  const work = [];
  for (const race of races) for (const sex of ['Female', 'Male']) {
    work.push(...meta.filter(m => m.race === race && m.gender === sex).slice(0, PER));
  }
  process.stderr.write('scoring ' + work.length + ' faces\n');

  const rows = [];
  for (const m of work) {
    const ppm = readPPM(path.join(DIR, 'sample', m.file));
    // faceres takes a 0..255 FLOAT, NOT a 0..1 one -- detector.js:797/825
    // build the crop with cropAndResize straight off a 0..255 float source
    // and never divide. The first version of this bench divided by 255, the
    // network saturated to a constant 0.627 on every face, and the run
    // reported 100% agreement / 50% accuracy at every size. A constant
    // output agrees with itself perfectly. Do not reintroduce the divide.
    const base = tf.tidy(() => tf.expandDims(
      tf.cast(tf.tensor3d(new Uint8Array(ppm.data), [ppm.h, ppm.w, 3], 'int32'), 'float32'), 0));
    const row = { truth: m.gender === 'Male' ? 'male' : 'female', race: m.race };
    try {
      // The shipped model at 224 is the reference, run through the
      // SHIPPED graph -- not the patched one -- so the reference cannot
      // inherit a patching mistake.
      const r0 = ship.execute(tf.image.resizeBilinear(base, [224, 224]));
      const a0 = Array.isArray(r0) ? r0 : [r0];
      row.ref = a0.find(x => x.shape.length === 2 && x.shape[1] === 1).dataSync()[0];
      tf.dispose(a0);
      for (const S of live) {
        const t = tf.image.resizeBilinear(base, [S, S]);
        const r = flex.execute(t);
        const a = Array.isArray(r) ? r : [r];
        row['s' + S] = a.find(x => x.shape.length === 2 && x.shape[1] === 1).dataSync()[0];
        tf.dispose([t, ...a]);
      }
    } finally { tf.dispose(base); }
    rows.push(row);
  }

  fs.writeFileSync(DIR + '/faceres-size-rows.json', JSON.stringify(rows));

  // DEGENERACY GUARD. A constant output agrees with itself 100% of the time
  // and scores exactly chance against a balanced label set, which is how the
  // first run of this bench reported a 4x free speed win that did not exist.
  // If the 224 reference does not SPREAD across faces, nothing below means
  // anything and the run must say so rather than print a table.
  const refs = rows.map(r => r.ref);
  const spread = Math.max(...refs) - Math.min(...refs);
  const sexGap = Math.abs(
    refs.filter((_, i) => rows[i].truth === 'male').reduce((a, b) => a + b, 0) / Math.max(1, rows.filter(r => r.truth === 'male').length)
    - refs.filter((_, i) => rows[i].truth === 'female').reduce((a, b) => a + b, 0) / Math.max(1, rows.filter(r => r.truth === 'female').length));
  console.log(String.fromCharCode(10) + 'reference sanity: spread ' + spread.toFixed(3) + '   male-minus-female mean ' + sexGap.toFixed(3));
  if (spread < 0.2 || sexGap < 0.05) {
    console.log('REFERENCE IS DEGENERATE -- the 224 model is not responding to the input.');
    console.log('Almost certainly a preprocessing mismatch (faceres wants 0..255 float, not 0..1).');
    console.log('No accuracy number below is meaningful. Speed above still stands.');
    return;
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
  const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  console.log('\nACCURACY, ' + rows.length + ' faces');
  console.log('  ' + 'px'.padStart(5) + 'agrees with 224'.padStart(18) + 'abs diff p50'.padStart(14)
    + 'p95'.padStart(9) + 'wrong vs label'.padStart(16) + 'speed'.padStart(9));
  for (const S of live) {
    const d = rows.map(r => Math.abs(r['s' + S] - r.ref));
    console.log('  ' + String(S).padStart(5)
      + pct(rows.filter(r => (r['s' + S] >= 0.5) === (r.ref >= 0.5)).length, rows.length).padStart(18)
      + q(d, 0.5).toFixed(4).padStart(14) + q(d, 0.95).toFixed(4).padStart(9)
      + pct(rows.filter(r => (r['s' + S] >= 0.5) !== (r.truth === 'male')).length, rows.length).padStart(16)
      + ((speed[224] / speed[S]).toFixed(2) + 'x').padStart(9));
  }
  console.log('\n  224 wrong vs label ' + pct(rows.filter(r => (r.ref >= 0.5) !== (r.truth === 'male')).length, rows.length));
  console.log('\nREAD IT AS: agreement is the bar. Loop 34 refused a uint8 requant of this');
  console.log('same model at 8 decision flips in 100; anything worse than ~99% agreement');
  console.log('changes who gets blurred and is not a free speed win.');
}
main().catch(e => { console.error(e); process.exit(1); });
