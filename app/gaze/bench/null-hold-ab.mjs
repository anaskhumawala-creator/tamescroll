// NULL_HOLD_PASSES sweep over the Section 1 corpus: the shipped arm with
// the weak-read hold at 0 (no hold), 1 (shipped), 2 and 3, printing the
// control triple for each. Same harness as test/control-triple.test.mjs,
// so 1 MUST reproduce arch-arms.CONTROL or the instrument is broken.
//
//   node bench/null-hold-ab.mjs
import fs from 'node:fs';
import { loadWin, makeArms, thinFrames, hisRegimeOpts, K_HIS, CONTROL } from './arch-arms.mjs';
import { winFiles, ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import * as SHIPPED from './.cache/shipped.mjs';

const files = winFiles();
if (!files.length) throw new Error('corpus not present');
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = files.map(loadWin);

function runArm(g) {
  const arm = makeArms(SHIPPED)(hisRegimeOpts(g));
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const w of wins) {
    const s = score(arm(thinFrames(w, K_HIS), g), g, (crop) => cropLabel.get(crop));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  return agg;
}

const HOLDS = (process.env.HOLDS || '0,1,2,3').split(',').map(Number);
console.log('hold  gender  exposureS  falseCoverS  phantomS   (CONTROL man ' +
  `${CONTROL.man.exposureS}/${CONTROL.man.falseCoverS}/${CONTROL.man.phantomS}, ` +
  `woman ${CONTROL.woman.exposureS}/${CONTROL.woman.falseCoverS}/${CONTROL.woman.phantomS})`);
for (const h of HOLDS) {
  SHIPPED.setNullHoldPasses(h);
  for (const g of ['man', 'woman']) {
    const r = runArm(g);
    console.log(String(h).padEnd(5), g.padEnd(7), String(r.exposureS).padStart(9),
      String(r.falseCoverS).padStart(12), String(r.phantomS).padStart(9));
  }
}
SHIPPED.setNullHoldPasses(1);
