// THE BODY SOURCE, A/B, ON THE ONE DETECTOR THE APP ALREADY SHIPS.
//
// Findings 20: `arch-arms` paints `personFromFace`'s synthetic body for
// 100% of observations, and the app takes the ADMITTED MoveNet person
// where there is one -- which on this corpus is 88.0% of frames and
// 83.2% of banked faces. Every absolute corpus number and every extent
// claim was measured on the fallback path.
//
// This is the matched A/B that prices the difference. Both arms are
// byte-identical downstream of the box; only the body source changes.
// Both genders, because the A-series ladder and `births.mjs` both
// turned out to be one arm under two labels, and because a body change
// is exactly the kind that helps one gender and hurts the other (a
// wider guess covers a woman by accident AND covers the man beside
// her).
//
// WHAT WOULD MAKE THE MEASURED BODY RIGHT, stated before running:
//   PHANTOM      falls, because the guess paints 7.4 face-heights of
//                body onto whatever is behind the subject.
//   FALSE COVER  falls, because the guess is what reaches the man
//                beside her -- the owner's actual complaint.
//   EXPOSURE     rises, and this is the cost. A measured box is the
//                VISIBLE extent, so it stops at occlusions and crops
//                where the guess deliberately over-runs. The ssd arm
//                measured that cost at 15s.
//
// The floor arms (`ssdMinFaceW`) exist because of exactly that: take
// the measured WIDTH, refuse to shrink the HEIGHT below the guess.
import fs from 'fs';
import { winFiles } from './corpus-lib.mjs';
import { loadWin, makeArms, thinFrames, hisRegimeOpts, K_HIS, CONTROL } from './arch-arms.mjs';
import { score } from './corpus-score.mjs';
import { ROOT } from './corpus-lib.mjs';
const S = await import('./.cache/shipped.mjs');

const K = Number(process.env.K || K_HIS);
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);

function run(g, extra) {
  const arm = makeArms(S)({ ...hisRegimeOpts(g), ...extra });
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const w of wins) {
    const s = score(arm(thinFrames(w, K), g), g, (crop) => cropLabel.get(crop));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  return agg;
}

// ssdMin is the slot-confidence floor the arm applies to a body box.
// 0 admits every box parsePersons already admitted (it has run its own
// gates); the ladder above it asks whether a TIGHTER body floor helps.
const ARMS = [
  ['CONTROL  synthetic guess', {}],
  ['mnBody   s>=0.00', { mnBody: true, ssdMin: 0 }],
  ['mnBody   s>=0.00  faceW 2.0', { mnBody: true, ssdMin: 0, ssdMinFaceW: 2.0 }],
  ['mnBody   s>=0.00  faceW 3.0', { mnBody: true, ssdMin: 0, ssdMinFaceW: 3.0 }],
  ['mnBody   s>=0.40', { mnBody: true, ssdMin: 0.4 }],
  ['mnBody   EDGE ONLY', { mnBody: true, ssdMin: 0, ssdEdge: true }],
];

console.log(`18 windows, k=${K} (${(K * 0.5).toFixed(1)}s/verdict), his regime`);
console.log(`CONTROL must read ${CONTROL.config}`);
console.log('');
for (const g of ['man', 'woman']) {
  console.log(`-- ${g.toUpperCase()} --`);
  console.log('arm'.padEnd(30) + '  exposure  falseCover     phantom');
  let base = null;
  for (const [name, opts] of ARMS) {
    const r = run(g, opts);
    if (!base) {
      base = r;
      const want = CONTROL[g];
      const ok = Object.keys(want).every((k) => r[k] === want[k]);
      if (!ok) {
        console.error(`\nCONTROL does not reproduce: got ${JSON.stringify(r)} `
          + `want ${JSON.stringify(want)}. Every row below would be measured `
          + `outside his regime -- refusing rather than printing a table.`);
        process.exit(2);
      }
    }
    const d = (k) => (base === r ? '' : ` (${r[k] - base[k] >= 0 ? '+' : ''}${(r[k] - base[k]).toFixed(1)})`);
    console.log(name.padEnd(30)
      + r.exposureS.toFixed(1).padStart(10) + d('exposureS')
      + r.falseCoverS.toFixed(1).padStart(10) + d('falseCoverS')
      + r.phantomS.toFixed(1).padStart(10) + d('phantomS'));
  }
  console.log('');
}
console.log('READ THE SIGNS, NOT THE TOTALS: a body source that buys phantom');
console.log('and false cover while costing exposure is the trade this repo');
console.log('has refused twice already at 15s. It is an EXPOSURE trade and');
console.log('therefore HIS call, not one to push over OTA.');
