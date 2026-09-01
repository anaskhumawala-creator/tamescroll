// THE CPU ARM OF THE VIDEO-CORPUS PARITY GATE, plus the frames both
// arms read. Writes raw rgb24 buffers so the WebGL arm builds its
// tensor from THE SAME BYTES -- no image decoder between them.
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler, grabRaw, W, H, ROOT } from './corpus-lib.mjs';

const OUT = `${ROOT}/parity`;
const scan = JSON.parse(fs.readFileSync(`${ROOT}/bank/scan.json`, 'utf8'));

// Frames chosen for FACE COUNT, spread across every video, because a
// backend difference that only shows on one subject would otherwise be
// invisible. Frames with no face are useless to a parity test.
const picks = [];
for (const vid of Object.keys(scan)) {
  const withFace = scan[vid].rows.filter((r) => r.n > 0);
  const step = Math.max(1, Math.floor(withFace.length / 6));
  for (let i = 0; i < withFace.length && picks.filter((p) => p.vid === vid).length < 6; i += step)
    picks.push({ vid, t: withFace[i].t });
}
console.log('parity frames', picks.length);

fs.mkdirSync(`${OUT}/frames`, { recursive: true });
await tf.setBackend('cpu');
const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
const gender = await tfconv.loadGraphModel(fsHandler('faceres'));

const out = { backend: tf.getBackend(), frames: [] };
const names = [];
for (const p of picks) {
  const [buf] = grabRaw(`${ROOT}/video/${p.vid}.mp4`, p.t, 1);
  if (!buf) continue;
  const name = `${p.vid}_t${p.t}.raw`;
  fs.writeFileSync(`${OUT}/frames/${name}`, buf);
  names.push(name);
  const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
  const boxes = await detectFaceBoxes(face, null, img);
  const reads = boxes.length ? await classifyFaceGenders(gender, null, boxes, img, { square: true }) : [];
  img.dispose();
  out.frames.push({ name, faces: boxes.map((b, k) => {
    const r = reads[k] || {};
    return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, conf: b.confidence,
      gender: r.gender, score: r.score, raw: r.raw, age: r.age, childP: r.childP, nm: r.shape ? r.shape.norm : null, shape: r.shape || null };
  }) });
  console.log(name, boxes.length, 'faces');
}
fs.writeFileSync(`${OUT}/node-arm.json`, JSON.stringify(out, null, 1));
fs.writeFileSync(`${OUT}/frames.json`, JSON.stringify(names));
console.log('NODE ARM DONE', out.frames.length, 'frames');
