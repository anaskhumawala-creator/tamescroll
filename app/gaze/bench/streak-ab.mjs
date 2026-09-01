// WHY: 65% of all wrongly-covered MAN time is a face that had already
// read clear-certain, with no scene cut, and 70% of that clear was
// 0-3 SECONDS OLD. That is the shape of CLEAR_STREAK_N 2 at his verdict
// cadence: two consecutive certain reads ~1.5s apart is ~3s of blur on
// a man the model already got right.
//
// The streak is not decoration -- it is what stops one stray read
// uncovering a woman. So this prices BOTH directions on the same
// footage: what streak 1 buys in false cover, and what it costs in
// EXPOSURE, in both gender modes.
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

const A2 = makeArms(await import('./.cache/shipped.mjs'));
const A1 = makeArms(await import('./.cache/streak1.mjs'));
const BASE = { hold: true, clampPad: 0.02, cut: true };

for (const g of ['man', 'woman']) {
  console.log(`\ngender=${g}` + '\narm                       EXPOSURE  FALSECOVER   PHANTOM');
  for (const [name, arm] of [['CLEAR_STREAK_N 2 (ships)', A2(BASE)], ['CLEAR_STREAK_N 1', A1(BASE)]]) {
    const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
    for (const win of wins) {
      const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
      for (const k of Object.keys(agg)) agg[k] += s[k];
    }
    console.log(name.padEnd(25) + (agg.exposureS.toFixed(1) + 's').padStart(10) +
      (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
  }
}
