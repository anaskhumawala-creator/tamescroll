// IN-DOMAIN TRAINING PIXELS FOR THE STUDENT, cut at NATIVE resolution
// through the SHIPPED crop geometry.
//
//   node app/gaze/bench/student-crops.mjs
//
// WHY NOT `bank/crops/*.ppm`, which already exists and would be free:
// those are 112px nearest-neighbour thumbnails made so a human could
// hand-label them. A student trained on them is trained on a resampling
// the model will never meet, and scored on one too. `frames-scan/` holds
// the 3,809 whole frames at 640x360 -- HIS PLAYER'S OWN RESOLUTION --
// and `bank/gpu-frames-detect.json` holds every face box the shipped
// detector found in them, so the native pixels are already on disk.
//
// THE GEOMETRY IS `squareBox` FROM src/, CALLED, NOT COPIED. This repo
// spent four days on a crop-geometry defect that existed because two
// files each had their own idea of the rectangle, and the correction
// note in crop-geometry.mjs is about exactly this stage of exactly this
// pipeline. A student trained on a differently-framed crop than the one
// it is served at runtime is a domain mismatch built in by hand.
//
// WHAT IT WRITES
//   Z:/tamescroll-corpus/student/crops/<vid>/<frame>_<i>.ppm   native px
//   Z:/tamescroll-corpus/student/index.json                    one row each
//
// Each row carries the shipped faceres read for that face (raw, age, nm,
// px) so a later stage can distil the age and descriptor heads against
// the model that ships, and `px` so the scale augmentation can be told
// what size this face really was rather than guessing.
import fs from 'fs';
import path from 'path';
import { squareBox } from '../src/crop-geometry.mjs';

// `--dense` cuts from the 2fps bank instead of frames-scan's one frame
// every four seconds. The student's domain gap is why: at 1 frame per 4s
// his own footage was 1.3% of the training set, against 0.9435 AUC on
// FairFace and 0.7891 on his corpus. Same function, two roots -- a second
// copy of the crop loop would drift from `squareBox`, which is the exact
// defect crop-geometry.mjs exists to prevent.
const DENSE = process.argv.includes('--dense');
const CORPUS = 'Z:/tamescroll-corpus';
const OUT = DENSE ? `${CORPUS}/student-dense` : `${CORPUS}/student`;
const FRAMES = DENSE ? `${CORPUS}/frames-dense` : `${CORPUS}/frames-scan`;
const DET = JSON.parse(fs.readFileSync(DENSE
  ? `${CORPUS}/bank/dense-detect.json`
  : `${CORPUS}/bank/gpu-frames-detect.json`, 'utf8'));

function readPpm(file) {
  const buf = fs.readFileSync(file);
  // P6 header: magic, [comments], "w h", maxval, then binary.
  let p = 0;
  const tok = () => {
    while (p < buf.length && /\s/.test(String.fromCharCode(buf[p]))) p++;
    if (buf[p] === 0x23) { while (buf[p] !== 0x0a) p++; return tok(); }
    let s = p;
    while (p < buf.length && !/\s/.test(String.fromCharCode(buf[p]))) p++;
    return buf.slice(s, p).toString('ascii');
  };
  const magic = tok();
  if (magic !== 'P6') throw new Error(`${file}: not P6 (${magic})`);
  const w = Number(tok());
  const h = Number(tok());
  const maxv = Number(tok());
  if (maxv !== 255) throw new Error(`${file}: maxval ${maxv}`);
  p++; // exactly one whitespace byte before the raster
  return { w, h, data: buf.slice(p, p + w * h * 3) };
}

function writePpm(file, w, h, data) {
  const head = Buffer.from(`P6\n${w} ${h}\n255\n`, 'ascii');
  fs.writeFileSync(file, Buffer.concat([head, data]));
}

/**
 * Cut a normalised box out of a decoded frame. NEAREST NEIGHBOUR AND NO
 * RESIZE: this writes the crop at whatever pixel size it really is, so
 * the training stage owns every resampling decision and can apply the
 * SAME one the runtime applies. Resizing here would bake one scale into
 * the bank and make the scale augmentation a lie.
 *
 * A box can run off the frame edge (squareBox expands to the longer
 * side), so it is clamped and the clamp is RECORDED -- a crop that lost
 * a third of a face to the frame edge is a different training example
 * from one that did not, and a bench that cannot tell them apart will
 * blame the model.
 */
function cut(frame, box) {
  const x1 = Math.round(box.x1 * frame.w);
  const y1 = Math.round(box.y1 * frame.h);
  const x2 = Math.round(box.x2 * frame.w);
  const y2 = Math.round(box.y2 * frame.h);
  const cx1 = Math.max(0, x1);
  const cy1 = Math.max(0, y1);
  const cx2 = Math.min(frame.w, x2);
  const cy2 = Math.min(frame.h, y2);
  const w = cx2 - cx1;
  const h = cy2 - cy1;
  if (!(w > 0) || !(h > 0)) return null;
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    frame.data.copy(out, y * w * 3, ((cy1 + y) * frame.w + cx1) * 3,
      ((cy1 + y) * frame.w + cx1) * 3 + w * 3);
  }
  const wanted = (x2 - x1) * (y2 - y1);
  return { w, h, data: out, clipped: wanted > 0 ? 1 - (w * h) / wanted : 1 };
}

fs.mkdirSync(`${OUT}/crops`, { recursive: true });
const rows = [];
let frames = 0;
let noFile = 0;
let empty = 0;
for (const fr of DET) {
  const src = `${FRAMES}/${fr.crop}`;
  if (!fs.existsSync(src)) { noFile++; continue; }
  if (!fr.faces || !fr.faces.length) { empty++; continue; }
  const frame = readPpm(src);
  fs.mkdirSync(`${OUT}/crops/${fr.vid}`, { recursive: true });
  for (let i = 0; i < fr.faces.length; i++) {
    const f = fr.faces[i];
    const b = { x1: f.box[0], y1: f.box[1], x2: f.box[2], y2: f.box[3] };
    const sq = squareBox(b, frame.w, frame.h);
    const c = cut(frame, sq);
    if (!c) continue;
    const name = `${fr.vid}/${fr.frame.replace(/\.ppm$/, '')}_${i}.ppm`;
    writePpm(`${OUT}/crops/${name}`, c.w, c.h, c.data);
    rows.push({
      crop: name, vid: fr.vid, frame: fr.frame, i,
      w: c.w, h: c.h, clipped: Math.round(c.clipped * 1000) / 1000,
      // the SHIPPED read on this face, for the age/descriptor heads and
      // for a sanity join against anything already banked
      px: f.px, raw: f.raw, g: f.g, age: f.age, childP: f.childP, nm: f.nm,
      conf: f.conf, inP: f.inP,
    });
  }
  frames++;
  if (frames % 500 === 0) process.stdout.write(`  ${frames} frames, ${rows.length} crops\n`);
}
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(rows));

const px = rows.map((r) => Math.max(r.w, r.h)).sort((a, b) => a - b);
const pct = (q) => px[Math.min(px.length - 1, Math.floor(q * px.length))];
console.log('');
console.log(`frames read      ${frames}  (missing ${noFile}, no faces ${empty})`);
console.log(`crops written    ${rows.length}`);
console.log(`native size      p05 ${pct(0.05)}  p50 ${pct(0.5)}  p95 ${pct(0.95)}  max ${px[px.length - 1]}`);
console.log(`clipped by edge  ${rows.filter((r) => r.clipped > 0.02).length} crops lost >2% to the frame edge`);
console.log(`videos           ${new Set(rows.map((r) => r.vid)).size}`);
console.log('');
console.log(`banked ${OUT}/index.json`);
