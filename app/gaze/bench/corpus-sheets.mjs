// CONTACT SHEETS so the clusters can be labelled by looking at them.
// Six clusters per sheet, one row each, with a coloured tab at the left
// of every row (red, green, blue, yellow, magenta, cyan, top to bottom)
// so a row can never be miscounted against the manifest.
import fs from 'fs';
import { encodePNG, readPPM } from './png.mjs';
import { ROOT } from './corpus-lib.mjs';

const PER_SHEET = 6, COLS = 8, C = 112, TAB = 10, GAP = 6;
const TABC = [[255,60,60],[60,220,60],[80,120,255],[240,220,50],[230,70,230],[60,220,220]];
const clusters = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8'))
  .sort((a, b) => b.members.length - a.members.length);

const W = TAB + GAP + COLS * (C + GAP);
const H = PER_SHEET * (C + GAP) + GAP;
fs.mkdirSync(`${ROOT}/bank/label/sheets`, { recursive: true });
const manifest = [];
for (let s = 0; s * PER_SHEET < clusters.length; s++) {
  const buf = Buffer.alloc(W * H * 3, 18);
  const rows = [];
  for (let r = 0; r < PER_SHEET; r++) {
    const c = clusters[s * PER_SHEET + r];
    if (!c) break;
    const y0 = GAP + r * (C + GAP);
    const col = TABC[r];
    for (let y = y0; y < y0 + C; y++) for (let x = 0; x < TAB; x++) {
      const d = (y * W + x) * 3; buf[d] = col[0]; buf[d+1] = col[1]; buf[d+2] = col[2];
    }
    // Spread the samples across the cluster's whole life, not its first
    // frames -- a subject only looks stable if you see the whole shot.
    const step = Math.max(1, Math.floor(c.members.length / COLS));
    const pick = [];
    for (let i = 0; i < c.members.length && pick.length < COLS; i += step) pick.push(c.members[i]);
    pick.forEach((m, k) => {
      const p = readPPM(fs.readFileSync(`${ROOT}/bank/crops/${m.crop}`));
      const x0 = TAB + GAP + k * (C + GAP);
      for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
        const sIdx = (y * p.w + x) * 3, d = ((y0 + y) * W + x0 + x) * 3;
        buf[d] = p.rgb[sIdx]; buf[d+1] = p.rgb[sIdx+1]; buf[d+2] = p.rgb[sIdx+2];
      }
    });
    const px = c.members.map((m) => m.px).sort((a, b) => a - b);
    rows.push({ row: r, colour: ['red','green','blue','yellow','magenta','cyan'][r],
      id: c.id, n: c.members.length, pxP50: Math.round(px[px.length >> 1]) });
  }
  const f = `sheet${String(s).padStart(2, '0')}.png`;
  fs.writeFileSync(`${ROOT}/bank/label/sheets/${f}`, encodePNG(buf, W, H));
  manifest.push({ sheet: f, rows });
}
fs.writeFileSync(`${ROOT}/bank/label/sheets/manifest.json`, JSON.stringify(manifest, null, 1));
console.log('sheets', manifest.length, 'clusters', clusters.length);
for (const m of manifest) console.log(m.sheet, m.rows.map((r) => `${r.colour}=${r.id}(${r.n})`).join(' '));
