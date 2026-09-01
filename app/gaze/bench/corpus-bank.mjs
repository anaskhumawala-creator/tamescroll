// THE BANK. Real frames from his own pixel path, read by the SHIPPED
// detector and gender head, with the crop kept beside every read.
//
// Why frames and not reads: the read rings bank {g,s,a,px,ab,v,pc,fc,nm}
// with NO BOX and NO PIXELS, so nothing offline can re-run a decision or
// ask whether two reads are the same subject. Everything here exists so
// a source change can be re-scored without a device.
//
// Windows are CONTIGUOUS and sampled at a fixed rate, because the unit
// the owner experiences is "seconds of a person sharp", not per-read
// accuracy -- a per-read corpus cannot see the tracker at all, and the
// tracker is where this month's exposures lived.
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from './.cache/shipped.mjs';
import { fsHandler, grabRaw, nativePx, W, H, FRAME, ROOT, VIDEOS, BANK } from './corpus-lib.mjs';

const WINDOW_S = Number(process.env.WINDOW_S || 60);
const FPS = Number(process.env.BANK_FPS || 2);
const PER_VIDEO = Number(process.env.WINDOWS_PER_VIDEO || 2);

const scan = JSON.parse(fs.readFileSync(`${ROOT}/${BANK}/scan.json`, 'utf8'));

/** Contiguous stretches of face-bearing samples, densest first, spread
 *  across the video so one long interview cannot supply every window. */
function pickWindows(rows, every, duration) {
  const runs = [];
  let cur = null;
  for (const r of rows) {
    if (r.n > 0) { if (!cur) cur = { t0: r.t, t1: r.t, faces: 0 }; cur.t1 = r.t; cur.faces += r.n; }
    else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  // A VIDEO WITH FACES THROUGHOUT IS ONE RUN, AND THE FIRST VERSION
  // TOOK ONE WINDOW FROM IT. Ary1gIbaOTc has faces in 465 of 467
  // samples and z86LGEFyQpo in 136 of 136, so both collapsed to a
  // single run and yielded a single window -- the two videos with the
  // MOST footage contributed the least. Long runs are sliced into
  // window-sized candidates instead.
  const long = [];
  for (const r of runs) {
    if (r.t1 - r.t0 < WINDOW_S) continue;
    const perS = r.faces / ((r.t1 - r.t0) / every + 1);
    for (let t = r.t0; t + WINDOW_S <= r.t1; t += WINDOW_S)
      long.push({ t0: t, t1: t + WINDOW_S, faces: perS * WINDOW_S });
  }
  long.sort((a, b) => (b.faces / (b.t1 - b.t0 + every)) - (a.faces / (a.t1 - a.t0 + every)));
  const out = [];
  for (const r of long) {
    const t0 = r.t0;
    if (out.some((o) => Math.abs(o - t0) < WINDOW_S * 3)) continue;   // spread
    if (t0 + WINDOW_S > duration - 2) continue;
    out.push(t0);
    if (out.length >= PER_VIDEO) break;
  }
  return out;
}

await tf.setBackend('cpu');
const face = await tfconv.loadGraphModel(fsHandler('blazeface'));
const gender = await tfconv.loadGraphModel(fsHandler('faceres'));
fs.mkdirSync(`${ROOT}/${BANK}/reads`, { recursive: true });
fs.mkdirSync(`${ROOT}/${BANK}/crops`, { recursive: true });

const CROP = 112;   // labelling thumbnail; the READ is unaffected by it
function writeCrop(buf, box, file) {
  // Nearest-neighbour into a P6 PPM. No image library, and the crop is
  // for a HUMAN to look at -- the model never sees this resampling.
  const x0 = Math.max(0, Math.round(box.x1 * W)), y0 = Math.max(0, Math.round(box.y1 * H));
  const x1 = Math.min(W, Math.round(box.x2 * W)), y1 = Math.min(H, Math.round(box.y2 * H));
  const cw = Math.max(1, x1 - x0), ch = Math.max(1, y1 - y0);
  const head = Buffer.from(`P6\n${CROP} ${CROP}\n255\n`, 'ascii');
  const px = Buffer.alloc(CROP * CROP * 3);
  for (let y = 0; y < CROP; y++) {
    const sy = y0 + Math.min(ch - 1, Math.floor((y * ch) / CROP));
    for (let x = 0; x < CROP; x++) {
      const sx = x0 + Math.min(cw - 1, Math.floor((x * cw) / CROP));
      const s = (sy * W + sx) * 3, d = (y * CROP + x) * 3;
      px[d] = buf[s]; px[d + 1] = buf[s + 1]; px[d + 2] = buf[s + 2];
    }
  }
  fs.writeFileSync(file, Buffer.concat([head, px]));
}

let totalFrames = 0, totalFaces = 0;
// ONLY_VID lets several processes bank different videos at once (16
// cores here, one tfjs-cpu process uses few), and an already-written
// window is skipped so a restart never redoes work or half-writes one.
const ONLY = (process.env.ONLY_VID || '').split(',').filter(Boolean);
for (const vid of VIDEOS) {
  const s = scan[vid];
  if (!s) continue;
  if (ONLY.length && !ONLY.includes(vid)) continue;
  const windows = pickWindows(s.rows, s.scanEvery, s.duration);
  for (const t0 of windows) {
    const tag = `${vid}_w${t0}`;
    if (fs.existsSync(`${ROOT}/${BANK}/reads/${tag}.json`)) { console.log(tag, 'exists, skip'); continue; }
    const nFrames = WINDOW_S * FPS;
    const bufs = grabRaw(`${ROOT}/video/${vid}.mp4`, t0, nFrames, FPS);
    const descs = [];
    const frames = [];
    fs.mkdirSync(`${ROOT}/${BANK}/crops/${tag}`, { recursive: true });
    for (let i = 0; i < bufs.length; i++) {
      const img = tf.tensor3d(new Uint8Array(bufs[i]), [H, W, 3], 'int32');
      const boxes = await detectFaceBoxes(face, null, img);
      const reads = boxes.length ? await classifyFaceGenders(gender, null, boxes, img, { square: true }) : [];
      img.dispose();
      const faces = boxes.map((b, k) => {
        const r = reads[k] || {};
        const descIdx = r.desc ? (descs.push(Float32Array.from(r.desc)) - 1) : -1;
        const crop = `${tag}/f${String(i).padStart(4, '0')}_b${k}.ppm`;
        writeCrop(bufs[i], b, `${ROOT}/${BANK}/crops/${crop}`);
        return {
          x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, conf: b.confidence,
          px: nativePx(b), gender: r.gender, score: r.score, raw: r.raw,
          age: r.age, childP: r.childP,
          nm: r.shape ? r.shape.norm : null, shape: r.shape || null,
          descIdx, crop,
        };
      });
      frames.push({ i, t: t0 + i / FPS, faces });
      totalFaces += faces.length;
    }
    totalFrames += frames.length;
    const flat = new Float32Array(descs.length * 1024);
    descs.forEach((d, i) => flat.set(d, i * 1024));
    fs.writeFileSync(`${ROOT}/${BANK}/reads/${tag}.desc`, Buffer.from(flat.buffer));
    fs.writeFileSync(`${ROOT}/${BANK}/reads/${tag}.json`, JSON.stringify({
      vid, t0, fps: FPS, windowS: WINDOW_S, w: W, h: H, frames,
    }));
    console.log(`${tag}  frames=${frames.length}  faces=${frames.reduce((a, f) => a + f.faces.length, 0)}`);
  }
}
console.log(`BANK DONE  frames=${totalFrames}  faces=${totalFaces}`);
