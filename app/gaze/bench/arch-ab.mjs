// Runs every architecture arm over the Section 1 corpus and prints all
// three errors for each. See arch-arms.mjs for what the arms are and why.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, ARM_A0, armSubject } from './arch-arms.mjs';

const ARMS = [
  ['A0 shipped (per-frame verdict)', ARM_A0],
  ['A1 per-subject window + hold', armSubject({})],
  ['A2 A1 + nm-weighted pool', armSubject({ nmWeight: true })],
  ['A3 A2 + per-subject ghost drop', armSubject({ nmWeight: true, ghost: true })],
  ['A4 A3, pooled bar floor .40', armSubject({ nmWeight: true, ghost: true, poolBar: 0.40 })],
  // A5 ISOLATES THE GHOST DROP, which is where A3/A4's exposure came
  // from -- pooling alone cost 0.5s, the drop cost 3.0s more. Any arm
  // that moves exposure has to name which half did it.
  ['A5 pooled bar .40, NO ghost drop', armSubject({ nmWeight: true, poolBar: 0.40 })],
];

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);

console.log(`gender=${g}  ${wins.length} windows
`);
console.log('arm                                 EXPOSURE  FALSECOVER   PHANTOM   covered  sharp');
for (const [name, arm] of ARMS) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
  for (const win of wins) {
    const s = score(arm(win, g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(34) +
    (agg.exposureS.toFixed(1) + 's').padStart(9) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
    (agg.phantomS.toFixed(1) + 's').padStart(10) +
    (agg.coveredS.toFixed(1) + 's').padStart(10) +
    (agg.sharpOkS.toFixed(1) + 's').padStart(8));
}
