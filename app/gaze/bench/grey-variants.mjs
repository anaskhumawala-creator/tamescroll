// WHICH GREY? TEN WAYS TO THROW AWAY COLOUR, MEASURED AGAINST EACH OTHER.
//
// Finding 36 found plain luma grey beating colour (women 40.6% -> 35.0%,
// between-group gap 31 -> 21 pts) and, in the same run, killed the
// obvious explanation: forcing every face onto one neutral skin tone made
// things WORSE, not better. So grey is not working by removing skin tone,
// and the mechanism is unexplained. That makes this sweep worth running
// rather than assuming the first grey we tried is the best one.
//
// THE ONE REAL HYPOTHESIS IN HERE, and it is testable exactly once:
// our `grey` is Rec.601 luma -- 0.299 R + 0.587 G + 0.114 B. Skin tone
// varies most in the RED channel and least in BLUE. If the head is
// leaning on a tone cue at all, the BLUE channel alone should be the
// cleanest input we can hand it, and RED alone the dirtiest. If blue
// beats luma and red loses to it, that ordering is evidence about the
// mechanism, not just a better constant. If all three channels land in a
// heap, tone is not what grey is fixing and finding 36's mystery stands.
//
// ARMS
//   rgb        untouched (ships)
//   luma601    0.299/0.587/0.114 -- the current grey, carried as the
//              benchmark every other arm has to beat
//   luma709    0.2126/0.7152/0.0722 -- modern HD weights, greener
//   equal      flat 1/3 each -- no perceptual weighting at all
//   redOnly    R channel replicated. MOST tone-carrying.
//   greenOnly  G channel replicated. Where most luminance detail lives.
//   blueOnly   B channel replicated. LEAST tone-carrying.
//   gammaUp    luma601 then gamma 0.7 -- lifts shadows, which is where a
//              dark face loses detail to an 8-bit encode
//   gammaDown  luma601 then gamma 1.4 -- the control for gammaUp, so a
//              win cannot be "any gamma change helps"
//   stretch    luma601 rescaled so each crop uses the full 0-255 range
//   invert     255 - luma601. Pure sanity check: the model should not
//              care about absolute polarity if it is reading structure,
//              and should collapse if it is reading tone. Either result
//              is informative and it costs one arm.
//
// SAMPLE: all seven FairFace groups, women AND men. Men are the control
// that catches an arm which merely drags every read toward "female" --
// an arm can look like it fixes women while quietly breaking men, and
// the summary table would hide it.
//
// PAIRED: every arm sees the identical face and the identical detection
// box, so no arm can win by being asked easier questions.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';

const DIR = 'Z:/tamescroll-corpus/fairface';
const PER = Number(process.env.GV_PER || 15);   // per race x gender
const ARMS = ['rgb', 'luma601', 'luma709', 'equal', 'redOnly', 'greenOnly',
  'blueOnly', 'gammaUp', 'gammaDown', 'stretch', 'invert'];

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

// Every grey arm goes through this one function so a difference between
// arms cannot be an implementation difference -- only the mapping differs.
function greyBy(d, n, f) {
  const o = new Uint8Array(n * 3);
  for (let p = 0; p < n; p++) {
    const v = clamp(f(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]));
    o[p * 3] = v; o[p * 3 + 1] = v; o[p * 3 + 2] = v;
  }
  return o;
}
const L601 = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

function build(d, n) {
  const V = { rgb: new Uint8Array(d) };
  V.luma601 = greyBy(d, n, L601);
  V.luma709 = greyBy(d, n, (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b);
  V.equal = greyBy(d, n, (r, g, b) => (r + g + b) / 3);
  V.redOnly = greyBy(d, n, r => r);
  V.greenOnly = greyBy(d, n, (r, g) => g);
  V.blueOnly = greyBy(d, n, (r, g, b) => b);
  V.gammaUp = greyBy(d, n, (r, g, b) => 255 * Math.pow(L601(r, g, b) / 255, 0.7));
  V.gammaDown = greyBy(d, n, (r, g, b) => 255 * Math.pow(L601(r, g, b) / 255, 1.4));
  V.invert = greyBy(d, n, (r, g, b) => 255 - L601(r, g, b));
  // stretch needs the crop's own min/max, so it cannot be a pure pixel
  // map like the others -- two passes.
  let lo = 255, hi = 0;
  for (let p = 0; p < n; p++) {
    const v = L601(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = Math.max(1, hi - lo);
  V.stretch = greyBy(d, n, (r, g, b) => ((L601(r, g, b) - lo) / span) * 255);
  return V;
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(DIR + '/sample.json', 'utf8'));
  const races = [...new Set(meta.map(m => m.race))].sort();
  const work = [];
  for (const race of races) {
    for (const sex of ['Female', 'Male']) {
      work.push(...meta.filter(m => m.race === race && m.gender === sex).slice(0, PER));
    }
  }
  process.stderr.write('crops ' + work.length + ' x ' + ARMS.length + ' arms\n');
  await tf.setBackend('cpu');
  await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const gen = await tfconv.loadGraphModel(fsHandler('faceres'));

  const rows = [];
  let done = 0, noFace = 0;
  for (const m of work) {
    const ppm = readPPM(path.join(DIR, 'sample', m.file));
    const n = ppm.w * ppm.h;
    const V = build(ppm.data, n);
    // Detect ONCE on the untouched crop and reuse the box everywhere: a
    // gender result must not be contaminated by a detection result.
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
    if (++done % 10 === 0) process.stderr.write('  ' + done + '/' + work.length + '\n');
  }

  fs.writeFileSync(DIR + '/grey-variant-rows.json', JSON.stringify(rows));
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
  const wrong = (r, a) => (r[a] >= 0.5) !== (r.truth === 'male');
  const F = rows.filter(r => r.truth === 'female');
  const M = rows.filter(r => r.truth === 'male');
  console.log('\nscored ' + rows.length + ' (no face in ' + noFace + ')\n');
  console.log('  ' + 'arm'.padEnd(11) + 'all'.padStart(8) + 'women'.padStart(9) + 'men'.padStart(8)
    + 'gap'.padStart(9) + 'fixed'.padStart(8) + 'broke'.padStart(7) + 'z'.padStart(7));
  for (const a of ARMS) {
    const v = races.map(race => {
      const s = F.filter(r => r.race === race);
      return s.length ? 100 * s.filter(r => wrong(r, a)).length / s.length : NaN;
    }).filter(Number.isFinite);
    let fx = 0, bk = 0;
    if (a !== 'rgb') {
      for (const r of rows) {
        const A = !wrong(r, 'rgb'), B = !wrong(r, a);
        if (!A && B) fx++; else if (A && !B) bk++;
      }
    }
    const nn = fx + bk;
    console.log('  ' + a.padEnd(11)
      + pct(rows.filter(r => wrong(r, a)).length, rows.length).padStart(8)
      + pct(F.filter(r => wrong(r, a)).length, F.length).padStart(9)
      + pct(M.filter(r => wrong(r, a)).length, M.length).padStart(8)
      + ((Math.max(...v) - Math.min(...v)).toFixed(1) + 'p').padStart(9)
      + (a === 'rgb' ? '--' : String(fx)).padStart(8)
      + (a === 'rgb' ? '--' : String(bk)).padStart(7)
      + (a === 'rgb' ? '--' : (nn ? ((Math.abs(fx - bk) - 1) / Math.sqrt(nn)).toFixed(2) : '0.00')).padStart(7));
  }

  console.log('\nCHANNEL ORDERING -- the hypothesis. red carries the most skin tone, blue the least.');
  for (const a of ['redOnly', 'greenOnly', 'blueOnly', 'luma601']) {
    console.log('  ' + a.padEnd(11) + 'women wrong ' + pct(F.filter(r => wrong(r, a)).length, F.length));
  }

  console.log('\nWOMEN WRONG by race x arm');
  console.log('  ' + 'race'.padEnd(16) + ARMS.map(a => a.slice(0, 8).padStart(9)).join(''));
  for (const race of races) {
    const s = F.filter(r => r.race === race);
    if (!s.length) continue;
    console.log('  ' + race.padEnd(16) + ARMS.map(a =>
      pct(s.filter(r => wrong(r, a)).length, s.length).padStart(9)).join(''));
  }
  console.log('\nbanked to ' + DIR + '/grey-variant-rows.json');
}
main().catch(e => { console.error(e); process.exit(1); });
