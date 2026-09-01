// Does remembering an identity across a track re-birth recover the
// clears that churn.mjs showed being destroyed?
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const BASE = { hold: true, clampPad: 0.02, cut: true };
for (const g of ['man', 'woman']) {
  console.log(`\ngender=${g}` + '\narm                     EXPOSURE  FALSECOVER   PHANTOM');
  for (const [n, a] of [['1081 SHIPPED', ARM(BASE)],
                        ['+ memory at birth (strict)', ARM({ ...BASE, mem: 'strict' })],
                        ['+ memory at birth (loose)', ARM({ ...BASE, mem: 'loose' })],
                        ['+ memory, 2 clears to trust', ARM({ ...BASE, mem: 'loose2' })],
                        ['+ mem loose2 + LEAN', ARM({ ...BASE, mem: 'loose2', lean: true })],
                        ['+ mem loose + LEAN', ARM({ ...BASE, mem: 'loose', lean: true })]]) {
    const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
    for (const w of wins) { const s = score(a(thin(w, 3), g), g, (c) => cropLabel.get(c));
      for (const k of Object.keys(agg)) agg[k] += s[k]; }
    console.log(n.padEnd(27) + (agg.exposureS.toFixed(1) + 's').padStart(8) +
      (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
  }
}
