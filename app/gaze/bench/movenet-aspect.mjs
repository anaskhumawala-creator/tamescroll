// DOES THE SQUASH KILL MoveNet?
//
// detectPersons resizes the WHOLE frame to 256x256 with no aspect
// preservation (detector.js:591). On his 16:9 decode that compresses
// every person to 0.5625 of natural width. The stills bench that admits
// 25 people over 20 images draws a 4:3 hqdefault into the same square
// -- 0.75 -- so "same preprocessing" is true of the CODE and false of
// the GEOMETRY the model sees. MoveNet MultiPose is a COCO-trained
// detector; a chest-up shot at 56% width is plausibly under its floor.
//
// Four arms on the SAME decoded bytes. If letterbox or crop resurrects
// keypoints, the person path comes back and every synthetic body box
// gets replaced by a measured one. If nothing does, MoveNet is content-
// limited on this footage and must be replaced as the extent source.
//
// The metric is the RAW model output -- max slot score and max keypoint
// score -- not the shipped gate. A gate calibrated on a dead signal
// would only restate itself.
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { fsHandler, grabRaw, W, H, ROOT } from './corpus-lib.mjs';

const N = Number(process.env.N || 16);
const scan = JSON.parse(fs.readFileSync(`${ROOT}/bank/scan.json`, 'utf8'));

// Frames that CONTAIN people -- a frame with no face proves nothing
// about a person detector returning nothing.
const picks = [];
for (const vid of Object.keys(scan)) {
  const withFace = scan[vid].rows.filter((r) => r.n > 0);
  if (!withFace.length) continue;
  const per = Math.max(1, Math.round(N / Object.keys(scan).length));
  const step = Math.max(1, Math.floor(withFace.length / per));
  for (let i = 0; i < withFace.length && picks.filter((p) => p.vid === vid).length < per; i += step)
    picks.push({ vid, t: withFace[i].t, faces: withFace[i].n });
}

await tf.setBackend('cpu');
const person = await tfconv.loadGraphModel(fsHandler('movenet-multipose'));

const S = 256;
function arms(img) {                       // img: [H,W,3] int32
  const b = tf.expandDims(img, 0);
  const squash = tf.image.resizeBilinear(b, [S, S]);
  // letterbox: preserve aspect, pad the short axis with black
  const lh = Math.round(S * H / W), pad = Math.floor((S - lh) / 2);
  const fit = tf.image.resizeBilinear(b, [lh, S]);
  const letterbox = tf.pad(fit, [[0, 0], [pad, S - lh - pad], [0, 0], [0, 0]]);
  // centre crop to square, then scale -- natural aspect, loses the sides
  const x0 = Math.floor((W - H) / 2);
  const crop = tf.image.resizeBilinear(tf.slice(b, [0, 0, x0, 0], [1, H, H, 3]), [S, S]);
  // half-frame zoom: natural aspect at 2x the pixels per person
  const half = tf.image.resizeBilinear(tf.slice(b, [0, 0, 0, 0], [1, H, H, 3]), [S, S]);
  return { squash, letterbox, crop, zoomL: half };
}

function readOut(t) {
  const d = t.dataSync();                  // [1,6,56]
  let maxSlot = 0, maxKp = 0, admitted = 0;
  for (let s = 0; s < 6; s++) {
    const o = s * 56;
    const sc = d[o + 55];
    if (sc > maxSlot) maxSlot = sc;
    if (sc >= 0.35) admitted++;
    for (let k = 0; k < 17; k++) { const v = d[o + k * 3 + 2]; if (v > maxKp) maxKp = v; }
  }
  return { maxSlot, maxKp, admitted };
}

const NAMES = ['squash', 'letterbox', 'crop', 'zoomL'];
const agg = {}; for (const n of NAMES) agg[n] = { maxKp: [], admitted: 0, frames: 0 };
console.log('frames', picks.length, '(all contain at least one detected face)\n');
console.log('video         t      faces   ' + NAMES.map((n) => n.padStart(10)).join(''));

for (const p of picks) {
  let buf; try { [buf] = grabRaw(`${ROOT}/video/${p.vid}.mp4`, p.t, 1); } catch (e) { continue; }
  if (!buf) continue;
  const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
  const a = arms(img);
  const row = [];
  for (const n of NAMES) {
    const out = person.execute(tf.cast(a[n], 'int32'));
    const r = readOut(out);
    tf.dispose(out);
    agg[n].maxKp.push(r.maxKp); agg[n].admitted += r.admitted; agg[n].frames++;
    row.push((r.maxKp.toFixed(2) + '/' + r.admitted).padStart(10));
  }
  for (const n of NAMES) a[n].dispose();
  img.dispose();
  console.log(p.vid.padEnd(13) + String(p.t).padEnd(7) + String(p.faces).padEnd(8) + row.join(''));
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log('\narm          maxKp p50   maxKp max   persons admitted (score>=0.35)');
for (const n of NAMES) {
  const g = agg[n];
  console.log(n.padEnd(13) + med(g.maxKp).toFixed(3).padStart(9) +
    Math.max(...g.maxKp).toFixed(3).padStart(12) + String(g.admitted).padStart(20));
}
console.log('\ncell = maxKeypoint/personsAdmitted.  PFF_FRAME_KP_FLOOR is 0.10;');
console.log('his phone reads maxKp p50 0.049 max 0.098 in the failing regime.');
