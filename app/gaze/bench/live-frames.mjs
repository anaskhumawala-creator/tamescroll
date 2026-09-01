// THE SAME BENCH THAT READS maxKp 0.802 ON CORPUS FRAMES, POINTED AT
// PIXELS TAKEN OUT OF THE RUNNING APP.
//
// The page did createImageBitmap(video) on the live player and drew it
// to a 256x256 canvas -- exactly the squash detectPersons performs --
// so these bytes ARE what MoveNet is handed on the device. Everything
// else in this arm is the arm that works.
import fs from 'fs';
import { execFileSync } from 'child_process';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { fsHandler } from './corpus-lib.mjs';

const DIR = 'Z:/Apps/Disconnect/spikes/faceres-parity/liveframes';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.png')).sort();
await tf.setBackend('cpu');
const person = await tfconv.loadGraphModel(fsHandler('movenet-multipose'));

// ffmpeg rather than a PNG reader: the corpus arm decodes with ffmpeg
// too, so the decoder is not a new variable.
function rgb(path, S) {
  const out = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-vf', `scale=${S}:${S}`,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: S * S * 3 + (1 << 20) });
  return new Uint8Array(out);
}

console.log('file            maxKp   maxSlot  admitted');
for (const f of files) {
  const img = tf.tensor3d(rgb(`${DIR}/${f}`, 256), [256, 256, 3], 'int32');
  const out = tf.tidy(() => person.execute(tf.cast(tf.expandDims(img, 0), 'int32')));
  const d = out.dataSync();
  let maxKp = 0, maxSlot = 0, admitted = 0;
  for (let s = 0; s < 6; s++) {
    const o = s * 56, sc = d[o + 55];
    if (sc > maxSlot) maxSlot = sc;
    if (sc >= 0.35) admitted++;
    for (let k = 0; k < 17; k++) { const v = d[o + k * 3 + 2]; if (v > maxKp) maxKp = v; }
  }
  tf.dispose(out); img.dispose();
  console.log(f.padEnd(16) + maxKp.toFixed(3).padStart(6) + maxSlot.toFixed(3).padStart(10) + String(admitted).padStart(10));
}
