// WHERE THE PEOPLE ARE. A coarse pass over every corpus video at one
// frame per SCAN_EVERY seconds, running only the detector, so the
// expensive banking pass can be pointed at windows that actually hold
// faces instead of at 2.4 hours of footage.
//
// Detect-only on purpose: a face count is all this needs, and the
// gender head costs 1330ms per face against the detector's 651ms.
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes } from './.cache/shipped.mjs';
import { fsHandler, grabRaw, nativePx, W, H, ROOT, VIDEOS, dur } from './corpus-lib.mjs';

const SCAN_EVERY = 10;
await tf.setBackend('cpu');
const face = await tfconv.loadGraphModel(fsHandler('blazeface'));

const out = {};
for (const vid of VIDEOS) {
  const file = `${ROOT}/video/${vid}.mp4`;
  const D = dur(file);
  const rows = [];
  for (let t = 2; t < D - 2; t += SCAN_EVERY) {
    const [buf] = grabRaw(file, t, 1);
    if (!buf) continue;
    const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
    const b = await detectFaceBoxes(face, null, img);
    img.dispose();
    rows.push({ t, n: b.length, px: b.map((x) => Math.round(nativePx(x))) });
  }
  out[vid] = { duration: D, scanEvery: SCAN_EVERY, rows };
  const withFace = rows.filter((r) => r.n > 0);
  const allPx = withFace.flatMap((r) => r.px).sort((a, b) => a - b);
  console.log(`${vid}  dur=${Math.round(D)}s  sampled=${rows.length}  withFace=${withFace.length}`,
    allPx.length ? `px p05/p50/p95=${allPx[Math.floor(allPx.length*0.05)]}/${allPx[allPx.length>>1]}/${allPx[Math.floor(allPx.length*0.95)]}` : '');
  fs.mkdirSync(`${ROOT}/bank`, { recursive: true });
  fs.writeFileSync(`${ROOT}/bank/scan.json`, JSON.stringify(out));
}
console.log('SCAN DONE', `${ROOT}/bank/scan.json`);
