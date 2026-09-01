// BANK coco-ssd PERSON BOXES OVER THE CORPUS, at the same frame times
// as bank/reads, so a scoring arm can swap the extent source and every
// other stage stays identical.
//
// Boxes are banked at a LOW score floor with their scores kept, so the
// admission threshold is an arm parameter rather than something baked
// in here -- the same mistake that made PERSON_MIN_SCORE invisible for
// months.
//
// Coordinates: ssd emits ymin,xmin,ymax,xmax normalised to the frame it
// was given, and it is given the NATIVE 640x360 frame, so these are
// already frame-normalised. No squash and no unstretch, which is the
// other thing it buys over MoveNet.
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { grabRaw, W, H, ROOT } from './corpus-lib.mjs';

const MDIR = 'Z:/tamescroll-corpus/models/cocossd';
const OUT = `${ROOT}/bank/ssd`;
const FLOOR = 0.20;
fs.mkdirSync(OUT, { recursive: true });

function ssdHandler() {
  const j = JSON.parse(fs.readFileSync(`${MDIR}/model.json`, 'utf8'));
  const specs = [], parts = [];
  for (const g of j.weightsManifest) {
    for (const p of g.paths) parts.push(fs.readFileSync(`${MDIR}/${p}`));
    for (const w of g.weights) specs.push(w);
  }
  const all = Buffer.concat(parts);
  return { load: async () => ({ modelTopology: j.modelTopology, weightSpecs: specs,
    weightData: all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) }) };
}

await tf.setBackend('cpu');
const ssd = await tfconv.loadGraphModel(ssdHandler());

async function persons(buf) {
  const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
  const inp = tf.cast(tf.expandDims(img, 0), 'int32');
  const res = await ssd.executeAsync(inp);        // dynamic ops: no tidy
  const scores = res[0].dataSync(), boxes = res[1].dataSync();
  const nBox = res[0].shape[1], nCls = res[0].shape[2];
  tf.dispose(res); inp.dispose(); img.dispose();
  const cand = [];
  for (let i = 0; i < nBox; i++) {
    const s = scores[i * nCls + 0];               // class 0 = person
    if (s < FLOOR) continue;
    cand.push({ s: +s.toFixed(3), y1: boxes[i * 4], x1: boxes[i * 4 + 1],
      y2: boxes[i * 4 + 2], x2: boxes[i * 4 + 3] });
  }
  cand.sort((a, b) => b.s - a.s);
  const keep = [];
  for (const c of cand) {
    let dup = false;
    for (const k of keep) {
      const ix = Math.min(c.x2, k.x2) - Math.max(c.x1, k.x1);
      const iy = Math.min(c.y2, k.y2) - Math.max(c.y1, k.y1);
      if (ix <= 0 || iy <= 0) continue;
      const inter = ix * iy;
      const u = (c.x2 - c.x1) * (c.y2 - c.y1) + (k.x2 - k.x1) * (k.y2 - k.y1) - inter;
      if (inter / u > 0.5) { dup = true; break; }
    }
    if (!dup) keep.push({ s: c.s, x1: +c.x1.toFixed(4), y1: +c.y1.toFixed(4),
      x2: +c.x2.toFixed(4), y2: +c.y2.toFixed(4) });
  }
  return keep;
}

const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const dst = `${OUT}/${file}`;
  if (fs.existsSync(dst) && !process.env.FORCE) { console.log('skip', file); continue; }
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  let bufs = [];
  try { bufs = grabRaw(`${ROOT}/video/${win.vid}.mp4`, win.frames[0].t, win.frames.length, win.fps); }
  catch (e) { console.log('ffmpeg failed', file, String(e).slice(0, 70)); continue; }
  // STRIDE 3, matching the regime everything is scored in: at his
  // measured 1.5s verdict cadence only every third banked frame is a
  // verdict pass, and the others carry no observation at all. Banking
  // the other two thirds would triple a CPU run for frames no arm
  // reads. Non-verdict frames get an empty list, which is what the arm
  // already treats as "coast".
  const per = [];
  for (let i = 0; i < win.frames.length; i++) {
    const isVerdict = i % 3 === 0;
    per.push({ t: win.frames[i].t,
      p: (isVerdict && bufs[i]) ? await persons(bufs[i]) : [] });
  }
  fs.writeFileSync(dst, JSON.stringify(per));
  const withP = per.filter((r) => r.p.some((b) => b.s >= 0.5)).length;
  console.log(file.padEnd(30), 'frames', per.length, 'framesWithPerson@0.5', withP);
}
console.log('done');
