// DO THE TWO WINS ADD UP?
//
// Two independent accuracy wins are now measured on this corpus and neither
// has ever been run against the other:
//   finding 41  GREY, a pixel transform. Women 25.8% -> 19.0% wrong,
//               paired z 5.56, 3.7-5.8 points of false cover at matched
//               exposure. Costs a build, costs no compute.
//   finding 40  MIRROR-AVERAGING, test-time augmentation. 18.0% -> 12.3%
//               false cover at matched exposure. Costs ~1.4-1.6x of the
//               gender inference (one batch of 2N crops, not two calls).
//
// If they are attacking the same errors, doing both buys little over the
// better one alone and the compute is wasted. If they are independent, the
// two stack and that is the accuracy ceiling this pipeline can reach without
// a new model.
//
// FOUR ARMS, 2x2: {rgb, grey} x {orig, mean of orig+mirror}.
//
// SCORED AT MATCHED EXPOSURE, ALWAYS. An arm can win a raw accuracy column
// by leaning female, which is a threshold move wearing a costume -- finding
// 29 was caught by it and finding 40 nearly was. So every comparison here
// tunes each arm's own bar to a common exposure and reads false cover, and
// the raw table is printed only as context.
//
// SELF-CONTAINED ON PURPOSE. It would be cheaper to reuse the rgb and grey
// originals already banked in grey-corpus-rows.json, but those rows carry no
// crop filename and rows are skipped on a missing crop or a failed detection,
// so an index join would silently drift. A join that can silently drift is
// worse than an hour of CPU.
import './_build.mjs';
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler } from './corpus-lib.mjs';

const BANK = 'Z:/tamescroll-corpus/bank';
const LIMIT = Number(process.env.GM_LIMIT || 0);
const NL = String.fromCharCode(10);

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

// One grey function, so a difference between arms cannot be an
// implementation difference. Rec.601, the arm finding 41 measured.
function toGrey(d, n) {
  const o = new Uint8Array(n * 3);
  for (let p = 0; p < n; p++) {
    const v = clamp(0.299 * d[p * 3] + 0.587 * d[p * 3 + 1] + 0.114 * d[p * 3 + 2]);
    o[p * 3] = v; o[p * 3 + 1] = v; o[p * 3 + 2] = v;
  }
  return o;
}

// Mirror the PIXELS, and re-express the box for the flipped frame so the
// classifier is handed the same face, mirrored, at the same crop.
function mirror(d, w, h) {
  const o = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 3;
      const t = (y * w + (w - 1 - x)) * 3;
      o[t] = d[s]; o[t + 1] = d[s + 1]; o[t + 2] = d[s + 2];
    }
  }
  return o;
}

const rawOf = g => (g.gender === 'male' ? 0.5 + g.score / 2 : 0.5 - g.score / 2);

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
  process.stderr.write('reads ' + use.length + ' x 4 inferences' + NL);

  await tf.setBackend('cpu');
  await tf.ready();
  const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const gen = await tfconv.loadGraphModel(fsHandler('faceres'));

  const rows = [];
  let done = 0, skip = 0;
  for (const w of use) {
    const ppm = readPPM(BANK + '/crops/' + w.crop);
    if (!ppm) { skip++; done++; continue; }
    const n = ppm.w * ppm.h;
    const rgb = new Uint8Array(ppm.data);
    const grey = toGrey(ppm.data, n);

    // Detect ONCE, on the untouched crop, and reuse. A gender difference
    // must never carry a detection difference.
    const base = tf.tensor3d(rgb, [ppm.h, ppm.w, 3], 'int32');
    let box = null;
    try {
      for (const b of await detectFaceBoxes(face, null, base)) {
        if (!box || (b.x2 - b.x1) * (b.y2 - b.y1) > (box.x2 - box.x1) * (box.y2 - box.y1)) box = b;
      }
    } finally { tf.dispose(base); }
    if (!box) { skip++; done++; continue; }
    const mbox = { x1: ppm.w - box.x2, x2: ppm.w - box.x1, y1: box.y1, y2: box.y2 };

    const row = { who: w.who, cid: w.cid, vid: w.vid, px: w.px, crop: w.crop };
    const plan = [
      ['rgb', rgb, box],
      ['grey', grey, box],
      ['rgbM', mirror(rgb, ppm.w, ppm.h), mbox],
      ['greyM', mirror(grey, ppm.w, ppm.h), mbox],
    ];
    for (const [name, pix, bx] of plan) {
      const img = tf.tensor3d(pix, [ppm.h, ppm.w, 3], 'int32');
      try {
        const g = (await classifyFaceGenders(gen, null, [bx], img, { square: true }))[0];
        row[name] = rawOf(g);
      } finally { tf.dispose(img); }
    }
    rows.push(row);
    if (++done % 50 === 0) {
      fs.writeFileSync(BANK + '/grey-mirror-rows.json', JSON.stringify(rows));
      process.stderr.write('  ' + done + '/' + use.length + NL);
    }
  }
  fs.writeFileSync(BANK + '/grey-mirror-rows.json', JSON.stringify(rows));
  score(rows, skip);
}

function score(rows, skip) {
  const ARMS = {
    'rgb (ships)': r => r.rgb,
    'rgb + mirror': r => (r.rgb + r.rgbM) / 2,
    'grey': r => r.grey,
    'grey + mirror': r => (r.grey + r.greyM) / 2,
  };
  const F = rows.filter(r => r.who === 'woman');
  const M = rows.filter(r => r.who === 'man');
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
  console.log(NL + 'scored ' + rows.length + ' (skipped ' + skip + ')  women '
    + F.length + '  men ' + M.length);

  console.log(NL + 'RAW label accuracy -- CONTEXT ONLY, an arm can win this by leaning female');
  console.log('  ' + 'arm'.padEnd(16) + 'womenWrong'.padStart(12) + 'menWrong'.padStart(11));
  for (const k of Object.keys(ARMS)) {
    const f = ARMS[k];
    console.log('  ' + k.padEnd(16)
      + pct(F.filter(r => f(r) >= 0.5).length, F.length).padStart(12)
      + pct(M.filter(r => f(r) < 0.5).length, M.length).padStart(11));
  }

  // THE REAL TABLE. Each arm gets its own bar, solved so its exposure lands
  // at the target; false cover is then read at that bar. This is the only
  // way two arms with different score distributions can be compared.
  const targets = [0.024, 0.016, 0.010, 0.005];
  const bars = {};
  console.log(NL + 'MATCHED EXPOSURE -- false cover at a common exposure. THE DECIDING TABLE.');
  console.log('  ' + 'arm'.padEnd(16) + targets.map(t => ('<=' + (t * 100).toFixed(1) + '%').padStart(12)).join(''));
  for (const k of Object.keys(ARMS)) {
    const f = ARMS[k];
    const cells = [];
    bars[k] = [];
    for (const t of targets) {
      let best = null;
      for (let b = 0.50; b <= 0.999; b += 0.002) {
        if (F.filter(r => f(r) >= b).length / F.length <= t) { best = b; break; }
      }
      bars[k].push(best);
      cells.push(best === null ? '--'.padStart(12)
        : pct(M.filter(r => f(r) < best).length, M.length).padStart(12));
    }
    console.log('  ' + k.padEnd(16) + cells.join(''));
  }

  // DOES IT STACK? The question the whole bench exists for. Compare the
  // combined arm against the BETTER SINGLE lever, not against the baseline --
  // beating the baseline is already known for both halves.
  console.log(NL + 'STACKING -- does grey+mirror beat the better single lever?');
  for (let i = 0; i < targets.length; i++) {
    const val = k => {
      const b = bars[k][i];
      if (b === null) return null;
      return 100 * M.filter(r => ARMS[k](r) < b).length / M.length;
    };
    const base = val('rgb (ships)'), g = val('grey'), m = val('rgb + mirror'), gm = val('grey + mirror');
    if ([base, g, m, gm].some(v => v === null)) continue;
    const better = Math.min(g, m);
    console.log('  exposure <=' + (targets[i] * 100).toFixed(1) + '%'
      + '   ships ' + base.toFixed(1)
      + '   grey ' + g.toFixed(1) + '   mirror ' + m.toFixed(1)
      + '   BOTH ' + gm.toFixed(1)
      + '   vs best single ' + (better - gm >= 0 ? '+' : '') + (better - gm).toFixed(1) + ' pts');
  }

  // Per video: an arm that wins on one video won nothing.
  console.log(NL + 'per video, women wrong at raw 0.5 (context):');
  for (const v of [...new Set(rows.map(r => r.vid))].sort()) {
    const s = F.filter(r => r.vid === v);
    if (!s.length) continue;
    console.log('  ' + v.padEnd(14) + String(s.length).padStart(5)
      + Object.keys(ARMS).map(k => pct(s.filter(r => ARMS[k](r) >= 0.5).length, s.length).padStart(14)).join(''));
  }
  console.log(NL + 'banked to ' + BANK + '/grey-mirror-rows.json');
}

main().catch(e => { console.error(e); process.exit(1); });
