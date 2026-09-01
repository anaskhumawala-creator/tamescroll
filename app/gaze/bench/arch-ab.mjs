// Runs every architecture arm over the Section 1 corpus and prints all
// three errors for each. See arch-arms.mjs for what the arms are and why.
//
// THE A-SERIES LADDER WAS FIVE LABELS ON ONE ARM, and this file is what
// proved it (2026-09-02): A1 through A5 printed IDENTICAL rows --
// 5.5 / 210.0 / 314.0 / 557.5 / 495.0 -- because `nmWeight`, `ghost` and
// `poolBar` were all passed to `armSubject` and NONE of them were read
// by `ARM`. So "pooling alone cost 0.5s, the ghost drop cost 3.0s more"
// could never have been measured here: A2 - A1 is zero by construction.
//
// `poolBar` is real now (arch-arms.mjs threads it). `nmWeight` and
// `ghost` are read NOWHERE, so they are gone from the call sites rather
// than given behaviour nobody specified -- an arm invented to justify a
// label is worse than a missing arm.
//
// What is left is the one dimension that exists: the pooled decision bar.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, ARM_A0, armSubject } from './arch-arms.mjs';

const BARS = (process.env.POOLBARS || '0.25,0.40,0.60,0.80').split(',').map(Number);
const ARMS = [
  ['A0 shipped (per-frame verdict)', ARM_A0],
  ...BARS.map((b) => [`A1 per-subject pool, bar ${b.toFixed(2)}`,
    armSubject({ poolBar: b })]),
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
