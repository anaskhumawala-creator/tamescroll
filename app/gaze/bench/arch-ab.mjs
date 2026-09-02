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
// `ghost` are RETIRED, not missing -- both were specified and
// implemented in 6f0b7ff and deleted by 5974e9d, which left the labels
// behind; arch-arms.mjs records what each one did and why re-adding the
// bare name would be worse than the gap. An arm invented to justify a
// label is worse than a missing arm.
//
// AND THIS FILE RAN UNTHINNED WHILE ITS OWN TABLE WAS PUBLISHED AS
// "same k=3" (phase-D D2). Every window was handed whole, so
// `inferCadence` returned stride 1 on all eighteen, the tracker was told
// 500ms and coasted 1250ms -- the exact row 13 names as the broken one,
// in the table printed beside it. Phantom was understated by roughly 2x
// and one published sentence inverted: at k=1 the 0.80 bar reads
// 1.5 / 430.0, at k=3 it reads 19.5 / 218.5.
//
// It thins at K and takes the shipped option set from
// `hisRegimeOpts` now, so this file and coast-ab.mjs cannot drift apart
// again. Override with K= and TOLD= to look at another device.
//
// What is left is the one dimension that exists: the pooled decision bar.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import {
  loadWin, ARM, armSubject, HIS_EFFZOOM, K_HIS, thinFrames, hisRegimeOpts,
} from './arch-arms.mjs';

const BARS = (process.env.POOLBARS || '0.25,0.40,0.60,0.80').split(',').map(Number);
const g = process.env.GENDER || 'man';
const K = Number(process.env.K || K_HIS);
const TOLD = Number(process.env.TOLD || HIS_EFFZOOM);
// THE BASELINE IS THE SHIPPED ARM, NOT `ARM_A0`. `ARM_A0` is `ARM({})`,
// labelled "1078" in arch-arms -- no hold, no cut, no adjacency clamp,
// no identity memory, none of which the app has been without since loop
// 39. It was printed as "A0 shipped" (phase-D D2).
const OPTS = hisRegimeOpts(g, TOLD);
const ARMS = [
  ['A0 shipped (per-frame verdict)', ARM(OPTS)],
  ...BARS.map((b) => [`A1 per-subject pool, bar ${b.toFixed(2)}`,
    armSubject({ ...OPTS, poolBar: b })]),
];
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);

console.log(`gender=${g}  ${wins.length} windows  k=${K} (${(K * 0.5).toFixed(1)}s/verdict)  told ${TOLD}ms`);
console.log('');
console.log('arm                                 EXPOSURE  FALSECOVER   PHANTOM   covered  sharp');
for (const [name, arm] of ARMS) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
  for (const win of wins) {
    const s = score(arm(thinFrames(win, K), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(34) +
    (agg.exposureS.toFixed(1) + 's').padStart(9) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
    (agg.phantomS.toFixed(1) + 's').padStart(10) +
    (agg.coveredS.toFixed(1) + 's').padStart(10) +
    (agg.sharpOkS.toFixed(1) + 's').padStart(8));
}
