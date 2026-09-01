// Export the EXACT frames movenet-aspect.mjs scored on CPU, as PNGs the
// WebGL arm can fetch. Same picks, same decode, so the two backends are
// compared on identical pixels rather than on similar ones.
import fs from 'fs';
import { grabRaw, W, H, ROOT } from './corpus-lib.mjs';
import { encodePNG } from './png.mjs';

const OUT = 'Z:/Apps/Disconnect/spikes/faceres-parity/vframes';
fs.mkdirSync(OUT, { recursive: true });
const N = Number(process.env.N || 16);
const scan = JSON.parse(fs.readFileSync(`${ROOT}/bank/scan.json`, 'utf8'));
const picks = [];
for (const vid of Object.keys(scan)) {
  const withFace = scan[vid].rows.filter((r) => r.n > 0);
  if (!withFace.length) continue;
  const per = Math.max(1, Math.round(N / Object.keys(scan).length));
  const step = Math.max(1, Math.floor(withFace.length / per));
  for (let i = 0; i < withFace.length && picks.filter((p) => p.vid === vid).length < per; i += step)
    picks.push({ vid, t: withFace[i].t, faces: withFace[i].n });
}
const list = [];
for (const p of picks) {
  let buf; try { [buf] = grabRaw(`${ROOT}/video/${p.vid}.mp4`, p.t, 1); } catch (e) { continue; }
  if (!buf) continue;
  const name = `${p.vid}_t${p.t}.png`;
  fs.writeFileSync(`${OUT}/${name}`, encodePNG(Buffer.from(buf), W, H));
  list.push({ name, vid: p.vid, t: p.t, faces: p.faces });
}
fs.writeFileSync(`${OUT}/list.json`, JSON.stringify(list, null, 1));
console.log('wrote', list.length, 'frames to', OUT);
