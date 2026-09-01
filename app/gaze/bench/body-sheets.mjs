// Contact sheets for the body-exposure arm: four frames per sheet, each
// at full 640x360 so a sliver of shoulder is actually visible -- the
// whole question is whether a NARROW patch leaves body showing, and a
// downscaled sheet would answer "no" by blurring the evidence away.
//
// Each cell is the NARROW render. The wide render stays on disk beside
// it so any cell that looks wrong can be checked against the shipped
// geometry without re-running ffmpeg.
import fs from 'fs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { encodePNG, readPPM } from './png.mjs';

const DIR = `${ROOT}/bank/body`;
const index = JSON.parse(fs.readFileSync(`${DIR}/index.json`, 'utf8'));
const PER = 4, COLS = 2;
const CW = W, CH = H, PAD = 6, TAB = 14;

// Decoding our own PNGs back would need an inflate reader; the raw
// frames are cheaper to re-render, so body-arm writes a .raw beside each
// pair when asked. If absent, fall back to reading the PNG is not
// supported -- say so loudly rather than emitting a blank sheet.
const KIND = process.env.KIND || 'narrow';
const rawPath = (tag) => `${DIR}/${tag}_${KIND}.raw`;
if (!fs.existsSync(rawPath(index[0].tag))) {
  console.log('no .raw sidecars -- re-run body-arm.mjs with RAW=1 first');
  process.exit(1);
}

const TABC = [[220, 60, 60], [60, 200, 90], [70, 120, 240], [230, 190, 60]];
let sheet = 0;
for (let i = 0; i < index.length; i += PER) {
  const group = index.slice(i, i + PER);
  const rows = Math.ceil(group.length / COLS);
  const SW = COLS * CW + (COLS + 1) * PAD;
  const SH = rows * (CH + TAB) + (rows + 1) * PAD;
  const out = Buffer.alloc(SW * SH * 3, 24);
  group.forEach((g, k) => {
    const cx = PAD + (k % COLS) * (CW + PAD);
    const cy = PAD + Math.floor(k / COLS) * (CH + TAB + PAD);
    const [r, gg, b] = TABC[k % TABC.length];
    for (let y = 0; y < TAB; y++) for (let x = 0; x < CW; x++) {
      const o = ((cy + y) * SW + cx + x) * 3;
      out[o] = r; out[o + 1] = gg; out[o + 2] = b;
    }
    const raw = fs.readFileSync(rawPath(g.tag));
    for (let y = 0; y < CH; y++) {
      raw.copy(out, ((cy + TAB + y) * SW + cx) * 3, y * CW * 3, (y + 1) * CW * 3);
    }
  });
  fs.writeFileSync(`${DIR}/${KIND}-sheet${String(sheet).padStart(2, '0')}.png`, encodePNG(out, SW, SH));
  console.log(`sheet${String(sheet).padStart(2, '0')}  ` +
    group.map((g, k) => ['red', 'green', 'blue', 'yellow'][k % 4] + '=' + g.tag).join('  '));
  sheet++;
}
