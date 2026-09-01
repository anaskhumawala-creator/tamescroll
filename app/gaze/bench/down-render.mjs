// WHAT DOES A SHORTER BODY PATCH LEAVE SHOWING?
//
// The corpus scores only where BlazeFace found a FACE, so it is
// structurally blind to BODY exposure -- shoulders, midriff, legs. That
// blindness already priced one narrowing well and it was refused after
// rendering showed a podium speaker losing her dress.
//
// PFF_BODY_DOWN 6.0 -> 3.5 prices better on every axis in man mode and
// buys 9.5s of phantom in woman mode for 2.5s of false cover. The owner's
// rule is that patch geometry is settled by LOOKING, so this renders it.
//
// Patch painted SOLID GREY: the question is "is body visible below the
// patch", and the LOOK is frozen by owner ruling.
import fs from 'fs';
import { ROOT, W, H, grabRaw } from './corpus-lib.mjs';
import { encodePNG } from './png.mjs';
import { personFromFace } from './.cache/shipped.mjs';

const OUT = `${ROOT}/bank/downbody`;
fs.mkdirSync(OUT, { recursive: true });
const ASPECT = W / H;
const DOWN = Number(process.env.DOWN || 3.5);
const PER_WIN = Number(process.env.PER_WIN || 2);

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
const index = [];
for (const file of fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'))) {
  const reads = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  // Only frames with a CLOSE-UP subject who must be covered -- that is
  // the only place the cap binds, so any other frame renders two
  // identical pictures and proves nothing.
  const cand = [];
  reads.frames.forEach((fr) => {
    // WHERE THE CHANGE ACTUALLY BITES. In a true close-up both settings
    // clamp to y2 = 1 and render byte-identical pictures -- the first
    // run of this produced 25 such pairs and proved nothing. The frames
    // that matter are the mid-shots: shipped reaches the frame floor,
    // the shorter one stops inside it, so the difference is visible and
    // is exactly the strip that could leave a body showing.
    const cover = fr.faces.filter((f) => {
      const l = labOf(f);
      if (l !== 'woman' && l !== 'child') return false;
      const h = f.y2 - f.y1, cy = (f.y1 + f.y2) / 2;
      return cy + h * 6.0 >= 1 && cy + h * DOWN < 0.97;
    });
    if (cover.length) cand.push({ fr, cover });
  });
  const step = Math.max(1, Math.floor(cand.length / PER_WIN));
  let made = 0;
  for (let k = 0; k < cand.length && made < PER_WIN; k += step) {
    const c = cand[k];
    let raw; try { [raw] = grabRaw(`${ROOT}/video/${reads.vid}.mp4`, c.fr.t, 1); } catch (e) { continue; }
    if (!raw) continue;
    const tag = `${reads.vid}_t${String(c.fr.t).replace('.', 'p')}`;
    for (const kind of ['a-shipped6', 'b-down' + DOWN]) {
      const rgb = Buffer.from(raw);
      for (const f of c.cover) {
        const box = personFromFace(f, ASPECT);
        if (kind !== 'a-shipped6') {
          const h = f.y2 - f.y1, cy = (f.y1 + f.y2) / 2;
          box.y2 = Math.min(1, cy + h * DOWN);
        }
        paint(rgb, box, 128);
      }
      fs.writeFileSync(`${OUT}/${tag}_${kind}.png`, encodePNG(rgb, W, H));
    }
    index.push({ tag, t: c.fr.t, covered: c.cover.length });
    made++;
  }
}
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 1));
console.log(`wrote ${index.length} pairs to ${OUT}  (DOWN=${DOWN})`);
