// THE BODY-EXPOSURE ARM. The one measurement the corpus cannot make and
// the one thing blocking the geometry clamp.
//
// geometry-ab.mjs prices narrowing the synthetic body box at FALSE COVER
// 97s -> 71.5s for +0.5s of exposure -- but that exposure number counts
// only faces BlazeFace found, and narrowing a body patch uncovers a
// BODY: shoulders, midriff, legs, skin with no face in it. A label only
// exists where a face was detected, so the corpus is structurally blind
// to exactly the failure the constant 3.911 was set to prevent (R8: a
// podium subject whose SLEEVE was sharp to x~0.79).
//
// So this renders what the USER WOULD SEE. For each sampled frame that
// contains someone the app must cover, it paints the patch SOLID at the
// candidate narrowing and writes the real 640x360 frame beside the
// full-width version. The judgement is then the only one that can settle
// it: look at the narrow version and say whether that person's body is
// showing.
//
// The patch is painted SOLID GREY, not blurred, on purpose. A blur at
// this scale still shows shape, and the question is "is body visible
// outside the patch", not "is the blur strong enough" -- the LOOK is
// frozen by owner ruling and is not what is being judged.
import fs from 'fs';
import { ROOT, W, H, FRAME, VIDEOS, grabRaw } from './corpus-lib.mjs';
import { encodePNG } from './png.mjs';

const OUT = `${ROOT}/bank/body`;
fs.mkdirSync(OUT, { recursive: true });

const KX = Number(process.env.KX || 0.70);
const KY = Number(process.env.KY || 0.70);
const PER_VIDEO = Number(process.env.PER_VIDEO || 8);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropId = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  for (const m of c.members) cropId.set(m.crop, c.id);
const labOf = (f) => labels[cropId.get(f.crop)];

// The shipped body box, replayed here rather than imported, because this
// script must not depend on the arms module while it is being reviewed.
import { personFromFace } from './.cache/shipped.mjs';
const ASPECT = W / H;

function narrow(body, face, kx, ky) {
  const cx = (face.x1 + face.x2) / 2, cy = (face.y1 + face.y2) / 2;
  return { x1: Math.min(face.x1, cx - (cx - body.x1) * kx),
    x2: Math.max(face.x2, cx + (body.x2 - cx) * kx),
    y1: Math.min(face.y1, cy - (cy - body.y1) * ky),
    y2: Math.max(face.y2, cy + (body.y2 - cy) * ky) };
}

// Same clamp as adjacency-ab.mjs. Duplicated deliberately: this script
// renders EVIDENCE, and evidence that imports the thing it is checking
// can only ever agree with it.
function clampAway(body, face, others, pad) {
  let { x1, x2 } = body;
  for (const o of others) {
    if (o.y2 < body.y1 || o.y1 > body.y2) continue;
    const ocx = (o.x1 + o.x2) / 2, fcx = (face.x1 + face.x2) / 2;
    if (ocx < fcx) x1 = Math.max(x1, Math.min(face.x1, o.x2 + pad));
    else x2 = Math.min(x2, Math.max(face.x2, o.x1 - pad));
  }
  return { ...body, x1, x2 };
}

function paint(rgb, box, grey) {
  const x1 = Math.max(0, Math.round(box.x1 * W)), x2 = Math.min(W, Math.round(box.x2 * W));
  const y1 = Math.max(0, Math.round(box.y1 * H)), y2 = Math.min(H, Math.round(box.y2 * H));
  for (let y = y1; y < y2; y++) {
    let o = (y * W + x1) * 3;
    for (let x = x1; x < x2; x++) { rgb[o] = grey; rgb[o + 1] = grey; rgb[o + 2] = grey; o += 3; }
  }
}
function outline(rgb, box, r, g, b) {
  const x1 = Math.max(0, Math.round(box.x1 * W)), x2 = Math.min(W - 1, Math.round(box.x2 * W));
  const y1 = Math.max(0, Math.round(box.y1 * H)), y2 = Math.min(H - 1, Math.round(box.y2 * H));
  const px = (x, y) => { const o = (y * W + x) * 3; rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b; };
  for (let x = x1; x <= x2; x++) { px(x, y1); px(x, y2); }
  for (let y = y1; y <= y2; y++) { px(x1, y); px(x2, y); }
}

// Pick frames: those containing someone to cover, spread evenly through
// each window so a single shot cannot dominate the sample.
const picks = [];
for (const vid of VIDEOS) {
  const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.startsWith(vid + '_') && f.endsWith('.json'));
  const cand = [];
  for (const file of files) {
    const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
    win.frames.forEach((fr) => {
      const cover = fr.faces.filter((f) => { const l = labOf(f); return l === 'woman' || l === 'child'; });
      if (cover.length) cand.push({ vid, t: fr.t, faces: fr.faces, cover });
    });
  }
  const step = Math.max(1, Math.floor(cand.length / PER_VIDEO));
  for (let i = 0; i < cand.length && picks.length % PER_VIDEO !== PER_VIDEO - 1 + 1; i += step) {
    picks.push(cand[i]);
    if (picks.filter((p) => p.vid === vid).length >= PER_VIDEO) break;
  }
}

const index = [];
for (const p of picks) {
  const file = `${ROOT}/video/${p.vid}.mp4`;
  let raw;
  try { raw = grabRaw(file, p.t, 1)[0]; } catch (e) { continue; }
  if (!raw || raw.length < FRAME) continue;
  const tag = `${p.vid}_t${p.t.toFixed(2).replace('.', 'p')}`;

  // `adj` renders the ADJACENCY clamp instead of a blanket scale: the
  // patch edge stops short of a face the app is leaving sharp, and is
  // untouched when there is no such face -- which is the whole reason it
  // can be safe on a podium shot where a blanket narrowing is not.
  const sharp = p.faces.filter((f) => !p.cover.includes(f));
  for (const [kind, kx, ky] of [['wide', 1, 1], ['narrow', KX, KY], ['adj', null, null]]) {
    const rgb = Buffer.from(raw);
    for (const f of p.cover) {
      const body = personFromFace(f, ASPECT);
      paint(rgb, kind === 'adj' ? clampAway(body, f, sharp, 0.02) : narrow(body, f, kx, ky), 128);
    }
    if (kind === 'adj') for (const f of sharp) outline(rgb, f, 255, 40, 40);
    // green = the person the patch is for; every covered face outlined
    // so the judgement knows WHOSE body to look for.
    for (const f of p.cover) outline(rgb, f, 0, 255, 0);
    fs.writeFileSync(`${OUT}/${tag}_${kind}.png`, encodePNG(rgb, W, H));
    // Raw sidecar so the sheet builder can composite without needing a
    // PNG inflate reader. Deleted by body-sheets once the sheets exist.
    if (process.env.RAW) fs.writeFileSync(`${OUT}/${tag}_${kind}.raw`, rgb);
  }
  index.push({ tag, vid: p.vid, t: p.t, covered: p.cover.length,
    others: p.faces.length - p.cover.length });
}
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 1));
console.log(`wrote ${index.length} frame pairs to ${OUT}  (kx=${KX} ky=${KY})`);
console.log('each pair: _wide.png = shipped body box, _narrow.png = candidate clamp');
console.log('green outline marks the face the patch is drawn for.');
