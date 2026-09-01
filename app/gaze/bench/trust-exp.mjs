// WHERE DO THE 4 SECONDS OF EXPOSURE COME FROM?
//
// Trust 1 buys 12.0s of false cover in man mode and costs 4.0s of
// exposure. Exposure is the protection failure, so "4s" is not a number
// to trade on until it is attributed: four seconds spread over a dozen
// hard frames is a different decision from one woman sharp for four
// seconds, and the corpus can tell them apart because it is labelled.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const thin = (win, e) => ({ ...win, frames: win.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const B = { hold: true, clampPad: 0.02, cut: true, inertNoSignal: true, memSignal: true };
const a2 = ARM({ ...B, mem: 'loose2' }), a1 = ARM({ ...B, mem: 'loose' });

console.log('window                      exp t2    exp t1     delta    fc delta');
let worst = null;
for (const f of files) {
  const win = thin(loadWin(f), 3);
  const s2 = score(a2(win, g), g, (c) => cropLabel.get(c));
  const s1 = score(a1(win, g), g, (c) => cropLabel.get(c));
  const d = s1.exposureS - s2.exposureS;
  if (Math.abs(d) > 0.01)
    console.log(f.replace('.json', '').padEnd(26) +
      (s2.exposureS.toFixed(1)).padStart(7) + (s1.exposureS.toFixed(1)).padStart(10) +
      ((d > 0 ? '+' : '') + d.toFixed(1) + 's').padStart(10) +
      ((s1.falseCoverS - s2.falseCoverS).toFixed(1) + 's').padStart(11));
  if (!worst || d > worst.d) worst = { f, d };
}
console.log('\nworst single window:', worst.f, worst.d.toFixed(1) + 's');
