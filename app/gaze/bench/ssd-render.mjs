// WHAT THE NARROWED PATCH ACTUALLY LEAVES SHOWING.
//
// The corpus can only score where BlazeFace found a FACE, so it is
// structurally blind to BODY exposure -- shoulders, midriff, legs. That
// blindness is why the blanket narrowing (geometry-ab) priced well and
// was refused after body-arm rendered it: a podium speaker lost her
// dress.
//
// The argument for this one is different in kind: a detector box is the
// person's MEASURED extent, not a scaled-down guess, so narrowing to it
// should not cut anyone off. That is an argument, and the owner's rule
// on patch geometry was set by LOOKING. So this renders it.
//
// Patch painted SOLID GREY, not blurred: the question is "is body
// visible outside the patch", and the LOOK is frozen by owner ruling.
import fs from 'fs';
import { ROOT, W, H, grabRaw } from './corpus-lib.mjs';
import { encodePNG } from './png.mjs';
import { personFromFace } from './.cache/shipped.mjs';

const OUT = `${ROOT}/bank/ssdbody`;
fs.mkdirSync(OUT, { recursive: true });
const ASPECT = W / H;
const MIN = Number(process.env.SSD_MIN || 0.35);
const PER_WIN = Number(process.env.PER_WIN || 3);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropId = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  for (const m of c.members) cropId.set(m.crop, c.id);
const labOf = (f) => labels[cropId.get(f.crop)];

function paint(rgb, b, grey) {
  const x1 = Math.max(0, Math.round(b.x1 * W)), x2 = Math.min(W, Math.round(b.x2 * W));
  const y1 = Math.max(0, Math.round(b.y1 * H)), y2 = Math.min(H, Math.round(b.y2 * H));
  for (let y = y1; y < y2; y++) {
    let o = (y * W + x1) * 3;
    for (let x = x1; x < x2; x++) { rgb[o] = rgb[o + 1] = rgb[o + 2] = grey; o += 3; }
  }
}
function outline(rgb, b, r, g, bl) {
  const x1 = Math.max(0, Math.round(b.x1 * W)), x2 = Math.min(W - 1, Math.round(b.x2 * W));
  const y1 = Math.max(0, Math.round(b.y1 * H)), y2 = Math.min(H - 1, Math.round(b.y2 * H));
  const px = (x, y) => { const o = (y * W + x) * 3; rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = bl; };
  for (let x = x1; x <= x2; x++) { px(x, y1); px(x, y2); }
  for (let y = y1; y <= y2; y++) { px(x1, y); px(x2, y); }
}
const pick = (boxes, face) => {
  const fcx = (face.x1 + face.x2) / 2, fcy = (face.y1 + face.y2) / 2;
  let best = null;
  for (const b of boxes) {
    if (b.s < MIN) continue;
    if (fcx < b.x1 || fcx > b.x2 || fcy < b.y1 || fcy > b.y2) continue;
    const a = (b.x2 - b.x1) * (b.y2 - b.y1);
    if (!best || a < best.a) best = { a, b };
  }
  return best && best.b;
};

const index = [];
for (const file of fs.readdirSync(`${ROOT}/bank/ssd`)) {
  const reads = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  const ssd = JSON.parse(fs.readFileSync(`${ROOT}/bank/ssd/${file}`, 'utf8'));
  // Frames where somebody must be covered AND a detector box exists --
  // any other frame renders two identical pictures and proves nothing.
  const cand = [];
  reads.frames.forEach((fr, i) => {
    const boxes = (ssd[i] && ssd[i].p) || [];
    if (!boxes.length) return;
    const cover = fr.faces.filter((f) => { const l = labOf(f); return l === 'woman' || l === 'child'; });
    if (cover.length && cover.some((f) => pick(boxes, f))) cand.push({ i, fr, boxes, cover });
  });
  const step = Math.max(1, Math.floor(cand.length / PER_WIN));
  for (let k = 0; k < cand.length && index.filter((x) => x.file === file).length < PER_WIN; k += step) {
    const c = cand[k];
    let raw; try { [raw] = grabRaw(`${ROOT}/video/${reads.vid}.mp4`, c.fr.t, 1); } catch (e) { continue; }
    if (!raw) continue;
    const tag = `${reads.vid}_t${String(c.fr.t).replace('.', 'p')}`;
    for (const kind of ['guess', 'measured']) {
      const rgb = Buffer.from(raw);
      for (const f of c.cover) {
        const syn = personFromFace(f, ASPECT);
        let box = syn;
        if (kind === 'measured') {
          const b = pick(c.boxes, f);
          if (b) {
            const mw = (b.x2 - b.x1) * 0.045, mh = (b.y2 - b.y1) * 0.045;
            box = { x1: Math.max(0, Math.min(b.x1 - mw, f.x1)), y1: Math.max(0, Math.min(b.y1 - mh, f.y1)),
              x2: Math.min(1, Math.max(b.x2 + mw, f.x2)), y2: Math.min(1, Math.max(b.y2 + mh, f.y2)) };
          }
        }
        paint(rgb, box, 128);
      }
      // green = the face the patch is for; red = a face left sharp, so
      // a patch touching red is the failure the owner reported.
      for (const f of c.cover) outline(rgb, f, 0, 255, 0);
      for (const f of c.fr.faces) if (!c.cover.includes(f)) outline(rgb, f, 255, 40, 40);
      fs.writeFileSync(`${OUT}/${tag}_${kind}.png`, encodePNG(rgb, W, H));
    }
    index.push({ file, tag, t: c.fr.t, covered: c.cover.length, others: c.fr.faces.length - c.cover.length });
  }
}
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 1));
console.log(`wrote ${index.length} pairs to ${OUT}  (ssdMin=${MIN})`);
for (const x of index) console.log(' ', x.tag, 'cover', x.covered, 'others', x.others);
