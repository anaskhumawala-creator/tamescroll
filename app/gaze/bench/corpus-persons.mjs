// BANK MoveNet's RAW SLOT OUTPUT OVER THE WHOLE CORPUS, so the
// admission threshold can be priced offline instead of costing a device
// run per value.
//
// WHY THIS EXISTS. Every session since loop 35 has recorded "MoveNet
// admits nobody on his device" and built on it -- the ghost gate, the
// synthetic body, the adjacency clamp all exist because the person path
// was believed dead. Measured 2026-09-01 on his own live frames, it is
// not dead: maxSlot runs 0.07-0.68 with a MEDIAN of about 0.35, and
// PERSON_MIN_SCORE is 0.35. Half the frames fall a hair under the bar.
// `bodyFromSlot` 18-26 in the same probes says the same thing from the
// app's side -- that counter only rises when MoveNet MEASURED a box the
// gate then refused.
//
// So this banks the raw per-slot numbers at the corpus's own frame
// times. Nothing is thresholded here: the arms decide.
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { fsHandler, grabRaw, W, H, ROOT } from './corpus-lib.mjs';

const OUT = `${ROOT}/bank/persons`;
fs.mkdirSync(OUT, { recursive: true });
await tf.setBackend('cpu');
const person = await tfconv.loadGraphModel(fsHandler('movenet-multipose'));
const S = 256;

// RAW, not summarised. The arms call the SHIPPED parsePersons on these
// floats, so the box coordinates, the aspect unstretch, the hysteresis
// and rejectedSlotBoxes are all the app's own code rather than my
// re-derivation of it -- which is the difference between a number a
// change can be made on and a number about my arithmetic.
function raw(buf) {
  const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
  const out = tf.tidy(() => person.execute(
    tf.cast(tf.image.resizeBilinear(tf.expandDims(img, 0), [S, S]), 'int32')));
  const d = out.dataSync();
  tf.dispose(out); img.dispose();
  return Float32Array.from(d);            // [1,6,56] flattened = 336
}

const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const dst = `${OUT}/${file.replace(/\.json$/, '.f32')}`;
  if (fs.existsSync(dst) && !process.env.FORCE) { console.log('skip', file); continue; }
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  const per = new Float32Array(win.frames.length * 336);
  let bufs = [];
  try { bufs = grabRaw(`${ROOT}/video/${win.vid}.mp4`, win.frames[0].t, win.frames.length, win.fps); }
  catch (e) { console.log('ffmpeg failed', file, String(e).slice(0, 80)); continue; }
  let nz = 0, any = 0;
  for (let i = 0; i < win.frames.length; i++) {
    if (!bufs[i]) continue;
    const r = raw(bufs[i]);
    per.set(r, i * 336);
    let mx = 0;
    for (let sI = 0; sI < 6; sI++) mx = Math.max(mx, r[sI * 56 + 55]);
    if (mx > 0.01) any++;
    if (mx >= 0.35) nz++;
  }
  fs.writeFileSync(dst, Buffer.from(per.buffer));
  console.log(file.padEnd(30), 'frames', win.frames.length, 'anySlot', any, 'admit@0.35', nz);
}
console.log('done');
