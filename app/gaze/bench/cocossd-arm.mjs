// COCO-SSD (ssdlite_mobilenet_v2) AGAINST MoveNet, ON THE SAME FRAMES.
//
// WHY A DETECTOR AND NOT A POSE MODEL. MoveNet is a POSE estimator; we
// use it purely as a person DETECTOR, and every gate in person-gate.mjs
// exists to turn keypoint confidences into a yes/no about a person
// being there. coco-ssd answers that question directly, and its
// training distribution contains people cut off by the frame edge --
// the chest-up medium shot that is most of a talking-head video.
//
// Licence: Apache-2.0 (TensorFlow models). Size: 18MB float32 as
// downloaded, which is over budget beside MoveNet's 4.9MB -- our own
// requant-uint8.py is the answer if the accuracy holds, and that is a
// SECOND question, deliberately not mixed into this one.
//
// Output tensors, read off the graph rather than assumed:
//   Postprocessor/ExpandDims_1  boxes  [1, N, 1, 4] as ymin,xmin,ymax,xmax
//   Postprocessor/Reshape_2     scores [1, N, 90]   (COCO class 1 = person)
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { fsHandler, grabRaw, W, H, ROOT } from './corpus-lib.mjs';

const MDIR = 'Z:/tamescroll-corpus/models/cocossd';
function ssdHandler() {
  const j = JSON.parse(fs.readFileSync(`${MDIR}/model.json`, 'utf8'));
  const specs = [];
  const parts = [];
  for (const g of j.weightsManifest) {
    for (const p of g.paths) parts.push(fs.readFileSync(`${MDIR}/${p}`));
    for (const w of g.weights) specs.push(w);
  }
  const all = Buffer.concat(parts);
  return { load: async () => ({ modelTopology: j.modelTopology, weightSpecs: specs,
    weightData: all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength),
    format: j.format, generatedBy: j.generatedBy, convertedBy: j.convertedBy }) };
}

const N = Number(process.env.N || 16);
const scan = JSON.parse(fs.readFileSync(`${ROOT}/bank/scan.json`, 'utf8'));
const picks = [];
for (const vid of Object.keys(scan)) {
  const wf = scan[vid].rows.filter((r) => r.n > 0);
  if (!wf.length) continue;
  const per = Math.max(1, Math.round(N / Object.keys(scan).length));
  const step = Math.max(1, Math.floor(wf.length / per));
  for (let i = 0; i < wf.length && picks.filter((p) => p.vid === vid).length < per; i += step)
    picks.push({ vid, t: wf[i].t, faces: wf[i].n });
}

await tf.setBackend('cpu');
const ssd = await tfconv.loadGraphModel(ssdHandler());
const mv = await tfconv.loadGraphModel(fsHandler('movenet-multipose'));

function movenet(buf) {
  const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
  const out = tf.tidy(() => mv.execute(
    tf.cast(tf.image.resizeBilinear(tf.expandDims(img, 0), [256, 256]), 'int32')));
  const d = out.dataSync(); tf.dispose(out); img.dispose();
  let admitted = 0, maxSlot = 0;
  for (let s = 0; s < 6; s++) { const sc = d[s * 56 + 55]; if (sc > maxSlot) maxSlot = sc; if (sc >= 0.35) admitted++; }
  return { admitted, maxSlot };
}

// NOTE FOR ANY PORT: this graph carries dynamic ops (Preprocessor's
// while-loop), so it needs executeAsync and cannot run inside tf.tidy.
// That is a real cost against MoveNet's straight execute, and it has to
// be measured on the device before this could ship.
// Outputs read off the graph by RUNNING it, not by guessing names --
// the first attempt named Postprocessor/Reshape_2 as scores and it is
// [1,1917,4], which produced 650 "people" a frame. Defaults are
// scores [1,1917,90] then boxes [1,1917,1,4]; class 0 is person.
async function persons(buf, thr) {
  const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
  const inp = tf.cast(tf.expandDims(img, 0), 'int32');
  const res = await ssd.executeAsync(inp);
  const scores = res[0].dataSync();
  const boxes = res[1].dataSync();
  const nBox = res[0].shape[1], nCls = res[0].shape[2];
  tf.dispose(res); inp.dispose(); img.dispose();
  const cand = [];
  for (let i = 0; i < nBox; i++) {
    const sc = scores[i * nCls + 0];
    if (sc < thr) continue;
    cand.push({ s: sc, y1: boxes[i * 4], x1: boxes[i * 4 + 1],
      y2: boxes[i * 4 + 2], x2: boxes[i * 4 + 3] });
  }
  // Plain greedy NMS at 0.5 -- the graph stops before the postprocess,
  // so without this one person arrives as a dozen overlapping anchors.
  cand.sort((p1, p2) => p2.s - p1.s);
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
    if (!dup) keep.push(c);
  }
  return keep;
}

console.log('video         t    faces |  MoveNet adm/maxSlot |  coco-ssd persons@.5  widest');
let mvAdm = 0, ssdAdm = 0, frames = 0;
for (const p of picks) {
  let buf; try { [buf] = grabRaw(`${ROOT}/video/${p.vid}.mp4`, p.t, 1); } catch (e) { continue; }
  if (!buf) continue;
  const m = movenet(buf);
  const ps = await persons(buf, 0.5);
  const widest = ps.length ? Math.max(...ps.map((b) => b.x2 - b.x1)) : 0;
  mvAdm += m.admitted; ssdAdm += ps.length; frames++;
  console.log(p.vid.padEnd(13) + String(p.t).padEnd(5) + String(p.faces).padEnd(7) + '| ' +
    (m.admitted + '  ' + m.maxSlot.toFixed(3)).padEnd(20) + '| ' +
    String(ps.length).padEnd(20) + widest.toFixed(2));
}
console.log(`\nframes ${frames}   MoveNet admitted ${mvAdm}   coco-ssd persons ${ssdAdm}`);
