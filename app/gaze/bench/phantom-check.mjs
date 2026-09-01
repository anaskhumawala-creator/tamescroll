// Is the -40% PHANTOM real, or did the measured box simply change how
// many patches exist? phantom counts patch-seconds no labelled face
// claims, so an arm that draws FEWER patches scores better without
// covering anybody differently. Count them.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
import { overlapFrac } from './corpus-score.mjs';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const all = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const wins = all.map(loadWin);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const BASE = { hold: true, clampPad: 0.02, cut: true, mem: 'loose2' };
for (const [n, a] of [['1082', ARM(BASE)], ['+ ssd', ARM({ ...BASE, ssdMin: 0.35, ssdPad: 0.15 })]]) {
  let patches = 0, frames = 0, area = 0, unclaimed = 0;
  for (const w of wins) for (const fr of a(thin(w, 3), 'man')) {
    frames++; patches += fr.patches.length;
    const claimed = new Set();
    for (const f of fr.faces) {
      let b = -1, bf = 0;
      fr.patches.forEach((p, i) => { const o = overlapFrac(f, p); if (o > bf) { bf = o; b = i; } });
      if (bf >= 0.15 && b >= 0) claimed.add(b);
    }
    fr.patches.forEach((p, i) => { area += (p.x2 - p.x1) * (p.y2 - p.y1); if (!claimed.has(i)) unclaimed++; });
  }
  console.log(n.padEnd(8) + `patches ${patches}  per frame ${(patches / frames).toFixed(2)}` +
    `  mean area ${(area / patches).toFixed(3)}  unclaimed ${unclaimed} (${(100 * unclaimed / patches).toFixed(1)}%)`);
}
