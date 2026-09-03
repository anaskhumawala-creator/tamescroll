// HIS IDEA: TAKE THE COLOUR AWAY AND SEE IF THE BIAS GOES WITH IT.
//
// Finding 31 measured the gender head failing 52.6% of Indian women and
// 51.5% of Black women against 31.6% of White women, and diagnosed it as
// a SHIFT rather than a spread -- their raw sigmoid medians sit on the
// 0.50 fence (0.55, 0.53) while everyone else sits at 0.21-0.28. A shift
// that tracks skin tone is, mechanically, the model leaning on a channel
// it should not be leaning on for this question.
//
// So: remove that channel, IDENTICALLY FOR EVERY FACE, and re-measure.
//
// THE DISTINCTION THAT MAKES THIS ALLOWED. Finding 31 refused per-race
// calibration on principle, because inferring skin tone in order to treat
// a person differently is biometric categorisation on a sensitive
// characteristic -- the AI Hub Model License 2.c clause that killed the
// QNN delegate in loop 47. NOTHING HERE INFERS ANYTHING ABOUT A PERSON.
// Every crop gets the same fixed pixel transform, with no branch, no
// classification and no per-group parameter. That is preprocessing, not
// categorisation.
//
// ARMS, each one read by the SHIPPED classifyFaceGenders:
//   rgb      untouched (what ships today)
//   grey     luma replicated to three channels. The gender model this
//            repo used BEFORE faceres (Oarriaga mini-Xception) was
//            64x64 GRAYSCALE, so a grayscale face is not an exotic input
//            for this family of model.
//   eq       per-crop histogram equalisation on luma, colour discarded.
//            Stronger than grey: it also flattens exposure, so a
//            under-lit face and a well-lit one arrive with the same
//            tonal range.
//   norm     per-crop mean/std normalisation of luma, rescaled to 0-255.
//            Same idea as eq but linear, so it cannot invent contrast
//            that was not there.
//
// WHY THIS COULD FAIL, stated first: faceres was TRAINED on colour. A
// grayscale face is off-distribution for it, so all four arms could get
// worse together -- that is the null result this bench is shaped to
// show, and it is why the White and Latino cells are measured too rather
// than only the failing ones. The result that matters is not "grey is
// better" but "does the GAP between groups shrink".
//
// SAMPLE: the two worst cells (Indian, Black) plus two controls (White,
// East Asian), women AND men, so an arm that simply drags every read
// toward "female" is visible as men breaking rather than hiding as women
// improving. Men are the control that catches a cheap win.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';

const DIR = 'Z:/tamescroll-corpus/fairface';
const RACES = (process.env.CA_RACES || 'Indian,Black,White,East Asian').split(',');
const PER = Number(process.env.CA_PER || 60);      // per race x gender
const ARMS = ['rgb', 'grey', 'eq', 'norm'];

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

// All four transforms are done in plain JS on the byte buffer rather than
// as tf ops: histogram equalisation has no tf primitive, and doing three
// of the four one way and one the other invites an off-by-one difference
// between arms that would read as a result.
function luma(d, n) {
  const g = new Float64Array(n);
  for (let p = 0; p < n; p++) g[p] = 0.299 * d[p * 3] + 0.587 * d[p * 3 + 1] + 0.114 * d[p * 3 + 2];
  return g;
}
function toRGB(g, n) {
  const o = new Uint8Array(n * 3);
  for (let p = 0; p < n; p++) {
    const v = Math.max(0, Math.min(255, Math.round(g[p])));
    o[p * 3] = v; o[p * 3 + 1] = v; o[p * 3 + 2] = v;
  }
  return o;
}
function armGrey(d, n) { return toRGB(luma(d, n), n); }
function armEq(d, n) {
  const g = luma(d, n);
  const hist = new Float64Array(256);
  for (let p = 0; p < n; p++) hist[Math.max(0, Math.min(255, Math.round(g[p])))]++;
  const cdf = new Float64Array(256);
  let acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; cdf[i] = acc; }
  let lo = 0; while (lo < 255 && cdf[lo] === 0) lo++;
  const denom = Math.max(1, n - cdf[lo]);
  const out = new Float64Array(n);
  for (let p = 0; p < n; p++) {
    const v = Math.max(0, Math.min(255, Math.round(g[p])));
    out[p] = ((cdf[v] - cdf[lo]) / denom) * 255;
  }
  return toRGB(out, n);
}
function armNorm(d, n) {
  const g = luma(d, n);
  let s = 0; for (let p = 0; p < n; p++) s += g[p];
  const mu = s / n;
  let v = 0; for (let p = 0; p < n; p++) v += (g[p] - mu) * (g[p] - mu);
  const sd = Math.sqrt(v / n) || 1;
  const out = new Float64Array(n);
  // Target mean 128, sd 52 -- roughly the tonal range of a well-exposed
  // face crop, so the result stays inside the model's input range instead
  // of clipping half the pixels flat.
  for (let p = 0; p < n; p++) out[p] = 128 + ((g[p] - mu) / sd) * 52;
  return toRGB(out, n);
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(DIR + '/sample.json', 'utf8'));
  const work = [];
  for (const race of RACES) {
    for (const sex of ['Female', 'Male']) {
      const pool = meta.filter(function (m) { return m.race === race && m.gender === sex; });
      for (let i = 0; i < Math.min(PER, pool.length); i++) work.push(pool[i]);
    }
  }
  process.stderr.write('crops ' + work.length + ' over ' + RACES.join('/') + '\n');

  await tf.setBackend('cpu');
  await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const gen = await tfconv.loadGraphModel(fsHandler('faceres'));

  const rows = [];
  let done = 0, noFace = 0;
  for (const m of work) {
    const ppm = readPPM(path.join(DIR, 'sample', m.file));
    const n = ppm.w * ppm.h;
    const variants = {
      rgb: new Uint8Array(ppm.data),
      grey: armGrey(ppm.data, n),
      eq: armEq(ppm.data, n),
      norm: armNorm(ppm.data, n),
    };
    // Detect ONCE on the untouched crop and reuse that box for every arm.
    // Detecting per arm would confound a gender result with a detector
    // result, and the detector is a separate question (detect-recall.mjs).
    const base = tf.tensor3d(variants.rgb, [ppm.h, ppm.w, 3], 'int32');
    let box = null;
    try {
      const boxes = await detectFaceBoxes(face, null, base);
      if (boxes.length) {
        box = boxes[0];
        for (const b of boxes) {
          if ((b.x2 - b.x1) * (b.y2 - b.y1) > (box.x2 - box.x1) * (box.y2 - box.y1)) box = b;
        }
      }
    } finally { tf.dispose(base); }
    if (!box) { noFace++; done++; continue; }

    const row = { race: m.race, truth: m.gender === 'Male' ? 'male' : 'female', file: m.file };
    for (const a of ARMS) {
      const img = tf.tensor3d(variants[a], [ppm.h, ppm.w, 3], 'int32');
      try {
        const out = await classifyFaceGenders(gen, null, [box], img, { square: true });
        const g = out[0];
        row[a] = g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2;
      } finally { tf.dispose(img); }
    }
    rows.push(row);
    if (++done % 25 === 0) process.stderr.write('  ' + done + '/' + work.length + '\n');
  }

  fs.writeFileSync(DIR + '/colour-rows.json', JSON.stringify(rows));
  const pct = function (a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '--'; };
  const q = function (a, p) {
    const s = a.slice().sort(function (x, y) { return x - y; });
    return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
  };
  const wrong = function (r, a) { return (r[a] >= 0.5) !== (r.truth === 'male'); };

  console.log('\nscored ' + rows.length + ' (no face in ' + noFace + ')\n');
  console.log('WRONG RATE by arm:');
  console.log('  ' + 'arm'.padEnd(7) + 'all'.padStart(8) + 'women'.padStart(9) + 'men'.padStart(8));
  for (const a of ARMS) {
    const F = rows.filter(function (r) { return r.truth === 'female'; });
    const M = rows.filter(function (r) { return r.truth === 'male'; });
    console.log('  ' + a.padEnd(7)
      + pct(rows.filter(function (r) { return wrong(r, a); }).length, rows.length).padStart(8)
      + pct(F.filter(function (r) { return wrong(r, a); }).length, F.length).padStart(9)
      + pct(M.filter(function (r) { return wrong(r, a); }).length, M.length).padStart(8));
  }

  console.log('\nWOMEN WRONG, by race x arm  <- the gap is the result, not any single cell');
  console.log('  ' + 'race'.padEnd(14) + ARMS.map(function (a) { return a.padStart(8); }).join(''));
  for (const race of RACES) {
    const s = rows.filter(function (r) { return r.race === race && r.truth === 'female'; });
    console.log('  ' + race.padEnd(14) + ARMS.map(function (a) {
      return pct(s.filter(function (r) { return wrong(r, a); }).length, s.length).padStart(8);
    }).join(''));
  }
  console.log('\nMEN WRONG, by race x arm  <- control: an arm that just drags everything female breaks these');
  console.log('  ' + 'race'.padEnd(14) + ARMS.map(function (a) { return a.padStart(8); }).join(''));
  for (const race of RACES) {
    const s = rows.filter(function (r) { return r.race === race && r.truth === 'male'; });
    console.log('  ' + race.padEnd(14) + ARMS.map(function (a) {
      return pct(s.filter(function (r) { return wrong(r, a); }).length, s.length).padStart(8);
    }).join(''));
  }

  console.log('\nRAW MEDIAN for WOMEN (0 = woman, 1 = man; the shift finding 31 measured)');
  console.log('  ' + 'race'.padEnd(14) + ARMS.map(function (a) { return a.padStart(8); }).join(''));
  for (const race of RACES) {
    const s = rows.filter(function (r) { return r.race === race && r.truth === 'female'; });
    console.log('  ' + race.padEnd(14) + ARMS.map(function (a) {
      return q(s.map(function (r) { return r[a]; }), 0.5).toFixed(2).padStart(8);
    }).join(''));
  }

  console.log('\nGAP: worst female cell minus best female cell, per arm');
  for (const a of ARMS) {
    const rates = RACES.map(function (race) {
      const s = rows.filter(function (r) { return r.race === race && r.truth === 'female'; });
      return s.length ? 100 * s.filter(function (r) { return wrong(r, a); }).length / s.length : NaN;
    }).filter(Number.isFinite);
    console.log('  ' + a.padEnd(7) + (Math.max.apply(null, rates) - Math.min.apply(null, rates)).toFixed(1) + ' pts');
  }
  console.log('\nrows banked to ' + DIR + '/colour-rows.json');
}
main().catch(function (e) { console.error(e); process.exit(1); });
