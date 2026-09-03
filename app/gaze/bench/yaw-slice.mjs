// IS THE WOMAN THE MODEL GETS WRONG A FACE THAT IS TURNED AWAY?
//
// His read, in his own words: "it's generally the more more smaller, a
// bit smaller opposite gender frame, or like the pose which isn't
// directly on camera, that kind of poses or like side face etc."
//
// The SIZE half is already answered and it is NO. M-4a's within-identity
// paired test over 18 clusters puts the accuracy delta (big minus small)
// at -1.6 points, zero for 9 of 18, with the largest moves in BOTH
// directions -- and the same control re-run on this corpus's woman reads
// alone reads +0.1 points, 3 clusters better, 4 worse, 2 flat. The raw
// gradient is real (24.6% wrong at 40-64px against 5.0% above 96px) and
// it is CONFOUNDED BY IDENTITY: a few women in this corpus are always
// filmed at a distance and are independently hard, so size rides along
// with subject and gets the credit.
//
// The POSE half has never been measured, and the one proxy already in
// hand -- BlazeFace confidence -- survives the identical control: +8.1
// points, six clusters better, ZERO worse. Low detector confidence is
// what a head turned off-axis produces. That is suggestive and it is not
// a pose measurement.
//
// THIS IS THE POSE MEASUREMENT, AND IT COSTS NO INFERENCE IN PRODUCTION.
// BlazeFace regresses six facial landmarks beside every box and this
// project threw them away for eighteen months; `face-marks.mjs` decodes
// them into a scale-free shape, of which two describe yaw directly:
//
//   asym    how far the nose sits from the eye midpoint SIDEWAYS, in
//           interocular units. A face square to the camera is roughly
//           symmetric about that midpoint; turn the head and the nose
//           slides toward the near eye. THIS IS THE YAW PROXY.
//   earSpan ear separation over eye separation. Turning the head
//           foreshortens the ear baseline against the eye baseline.
//
// WHY THE CROPS AND NOT THE FRAMES. The bank holds no frames -- 137MB of
// 112x112 PPM face crops is what survived, one per read, already
// enlarged and squarified by the shipped crop geometry. So BlazeFace is
// re-run ON THE CROP, which measures the arrangement of a face that has
// already been found. That is fine for a scale-free shape and it is NOT
// fine for anything about detection: a crop is not a frame, this cannot
// say what the detector would have done, and any crop it fails to
// re-detect is reported rather than dropped silently.
//
// THE JOIN IS THE HUMAN LABEL, NOT THE MODEL'S OWN ANSWER. 107 clusters
// carry a hand label; a read is WRONG when the shipped gender head
// disagrees with the human. Scoring against the model's own confidence
// would be the circularity loop 38 published and retracted.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import { detectFaceBoxes, markShape } from './.cache/shipped.mjs';
import { fsHandler, ROOT, BANK } from './corpus-lib.mjs';

const CROPS = `${ROOT}/${BANK}/crops`;
const LIMIT = Number(process.env.YAW_LIMIT || 0);   // 0 = every read

/** P6 binary PPM -> { w, h, data } with data as RGB bytes. */
function readPPM(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0x50 || b[1] !== 0x36) throw new Error(`not P6: ${file}`);
  // Header is three whitespace-separated ASCII numbers after "P6",
  // possibly with # comment lines between them.
  let i = 2, nums = [];
  while (nums.length < 3) {
    while (i < b.length && /\s/.test(String.fromCharCode(b[i]))) i++;
    if (b[i] === 0x23) { while (i < b.length && b[i] !== 0x0a) i++; continue; }
    let s = '';
    while (i < b.length && !/\s/.test(String.fromCharCode(b[i]))) s += String.fromCharCode(b[i++]);
    nums.push(Number(s));
  }
  i++;                                            // single whitespace after maxval
  const [w, h] = nums;
  return { w, h, data: b.subarray(i, i + w * h * 3) };
}

const q = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))] : NaN);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);

async function main() {
  // ---- human labels, crop -> { who, clusterId } -------------------------
  const labels = JSON.parse(fs.readFileSync(`${ROOT}/${BANK}/label/labels.json`, 'utf8'));
  const clusters = JSON.parse(fs.readFileSync(`${ROOT}/${BANK}/label/clusters.json`, 'utf8'));
  const byCrop = new Map();
  for (const c of clusters) {
    const who = labels[c.id];
    if (who !== 'man' && who !== 'woman') continue;     // mixed/child/notperson/bodypart out
    for (const m of c.members) byCrop.set(m.crop, { who, cid: c.id });
  }

  // ---- reads, joined to the label ---------------------------------------
  const rows = [];
  for (const f of fs.readdirSync(`${ROOT}/${BANK}/reads`).filter((x) => x.endsWith('.json'))) {
    const w = JSON.parse(fs.readFileSync(`${ROOT}/${BANK}/reads/${f}`, 'utf8'));
    for (const fr of w.frames) {
      for (const fa of fr.faces || []) {
        const lab = fa.crop && byCrop.get(fa.crop);
        if (!lab) continue;
        rows.push({
          crop: fa.crop, who: lab.who, cid: lab.cid, vid: w.vid,
          px: fa.px, conf: fa.conf, nm: fa.nm, score: fa.score,
          right: fa.gender === (lab.who === 'man' ? 'male' : 'female'),
        });
      }
    }
  }
  const work = LIMIT ? rows.slice(0, LIMIT) : rows;
  process.stderr.write(`labelled reads ${rows.length}, measuring ${work.length}\n`);

  // ---- re-run BlazeFace on each crop for its landmarks ------------------
  await tf.setBackend('cpu');
  await tf.ready();
  const model = await (await import('@tensorflow/tfjs-converter'))
    .loadGraphModel(fsHandler('blazeface'));

  let noRedetect = 0, noShape = 0, done = 0;
  for (const r of work) {
    const p = path.join(CROPS, r.crop);
    let img;
    try {
      const ppm = readPPM(p);
      img = tf.tensor3d(new Uint8Array(ppm.data), [ppm.h, ppm.w, 3], 'int32');
    } catch { noRedetect++; continue; }
    try {
      const faces = await detectFaceBoxes(model, null, img);
      if (!faces.length) { noRedetect++; continue; }
      // The crop is one face, enlarged and squarified around it, so the
      // biggest detection is that face. A second detection here is a
      // neighbour's head that the enlargement pulled in.
      let best = faces[0];
      for (const f of faces) {
        const a = (f.x2 - f.x1) * (f.y2 - f.y1);
        if (a > (best.x2 - best.x1) * (best.y2 - best.y1)) best = f;
      }
      const s = markShape(best);
      if (!s || s.degenerate) { noShape++; continue; }
      r.asym = s.asym;
      r.earSpan = s.earSpan;
      r.eyeSpan = s.eyeSpan;
      r.tilt = s.tilt;
      r.reconf = best.confidence;
    } finally {
      tf.dispose(img);
    }
    if (++done % 250 === 0) process.stderr.write(`  ${done}/${work.length}\n`);
  }

  const got = work.filter((r) => typeof r.asym === 'number');
  console.log(`\nre-detected ${got.length} of ${work.length}  `
    + `(no re-detect ${noRedetect}, degenerate/no landmarks ${noShape})`);

  // ---- the slice --------------------------------------------------------
  for (const who of ['woman', 'man']) {
    const sub = got.filter((r) => r.who === who);
    const W = sub.filter((r) => !r.right), R = sub.filter((r) => r.right);
    console.log(`\n${who.toUpperCase()}  n=${sub.length}  WRONG ${W.length} `
      + `(${(100 * W.length / (sub.length || 1)).toFixed(1)}%)`);
    for (const [k, f] of [['asym', (r) => r.asym], ['earSpan', (r) => r.earSpan],
                          ['eyeSpan', (r) => r.eyeSpan], ['tilt', (r) => r.tilt]]) {
      const a = R.map(f).filter(Number.isFinite), b = W.map(f).filter(Number.isFinite);
      console.log(`   ${k.padEnd(8)} right p25/p50/p75 `
        + `${q(a, .25).toFixed(3)}/${q(a, .5).toFixed(3)}/${q(a, .75).toFixed(3)}`
        + `    WRONG ${q(b, .25).toFixed(3)}/${q(b, .5).toFixed(3)}/${q(b, .75).toFixed(3)}`);
    }
  }

  // ---- wrong-rate by yaw band, women ------------------------------------
  const wom = got.filter((r) => r.who === 'woman');
  const bands = [[0, .05], [.05, .1], [.1, .2], [.2, 1e9]];
  console.log('\nWOMEN wrong-rate by asym (yaw proxy):');
  for (const [lo, hi] of bands) {
    const s = wom.filter((r) => r.asym >= lo && r.asym < hi);
    if (s.length) console.log(`   asym ${lo}-${hi > 1e8 ? '+' : hi}   n ${String(s.length).padStart(4)}`
      + `   wrong ${(100 * s.filter((r) => !r.right).length / s.length).toFixed(1)}%`);
  }

  // ---- THE CONTROL. Within-identity, the same test that killed size. ----
  // A cluster is one subject in one video, so comparing high-yaw against
  // low-yaw reads INSIDE a cluster holds subject, camera and lighting
  // fixed. Without this the aggregate table above is worth nothing --
  // that is exactly how the size story survived three loops.
  for (const [key, cut] of [['asym', 0.1], ['earSpan', 1.8], ['conf', 0.72]]) {
    const by = new Map();
    for (const r of wom) {
      if (!Number.isFinite(r[key])) continue;
      if (!by.has(r.cid)) by.set(r.cid, []);
      by.get(r.cid).push(r);
    }
    const d = [];
    let pos = 0, neg = 0, flat = 0;
    for (const [cid, rs] of by) {
      const hi = rs.filter((r) => r[key] >= cut), lo = rs.filter((r) => r[key] < cut);
      if (hi.length < 8 || lo.length < 8) continue;
      const a = 100 * hi.filter((r) => r.right).length / hi.length;
      const b = 100 * lo.filter((r) => r.right).length / lo.length;
      d.push({ cid, delta: a - b });
      if (a - b > 0.5) pos++; else if (a - b < -0.5) neg++; else flat++;
    }
    console.log(`\nwithin-identity, ${key} >= ${cut} vs below   clusters ${d.length}`
      + `   mean accuracy delta (high minus low) ${mean(d.map((x) => x.delta)).toFixed(1)} pts`
      + `   [better ${pos} / worse ${neg} / flat ${flat}]`);
    d.sort((a, b) => b.delta - a.delta);
    if (d.length) console.log('   ' + d.slice(0, 3).map((x) => `${x.cid} ${x.delta.toFixed(0)}`).join(', ')
      + '  ...  ' + d.slice(-3).map((x) => `${x.cid} ${x.delta.toFixed(0)}`).join(', '));
  }

  fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)),
    '.cache/yaw-rows.json'), JSON.stringify(got));
  console.log('\nrows banked to bench/.cache/yaw-rows.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
