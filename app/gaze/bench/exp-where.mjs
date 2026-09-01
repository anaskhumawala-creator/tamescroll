import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const BASE = { hold: true, clampPad: 0.02, cut: true, mem: 'loose2' };
const a0 = ARM(BASE), a1 = ARM({ ...BASE, ssdMin: 0.35, ssdPad: 0.15 });
const rows = [];
for (const f of files) {
  const w = loadWin(f);
  const s0 = score(a0(thin(w, 3), 'man'), 'man', (c) => cropLabel.get(c));
  const s1 = score(a1(thin(w, 3), 'man'), 'man', (c) => cropLabel.get(c));
  rows.push([f, s1.exposureS - s0.exposureS, s1.phantomS - s0.phantomS]);
}
rows.sort((a, b) => b[1] - a[1]);
console.log('window'.padEnd(30) + 'dEXPOSURE  dPHANTOM');
for (const [f, de, dp] of rows)
  console.log(f.replace('.json', '').padEnd(30) + (de >= 0 ? '+' : '') + de.toFixed(1) + 's'.padEnd(6) + (dp >= 0 ? '+' : '') + dp.toFixed(1) + 's');
