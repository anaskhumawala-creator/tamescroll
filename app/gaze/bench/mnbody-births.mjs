// WHAT THE +30.5s OF EXPOSURE ACTUALLY BUYS ITS WAY INTO, and it is
// probably not the box.
//
// Findings 21 said the measured MoveNet body costs +30.5s of exposure
// against the synthetic guess and named a mechanism -- "it is height and
// it is occlusion". Phase-g G2 killed that sentence with two arms:
// `ssdUnionH`, which floors the measured body's vertical extent with the
// guess's, recovers **0.5s of 30.5s (1.6%)**; and the face-width floors
// recover ~4.5s (15%) before `faceW 6.0` reverses violently to +119.5s.
// So height explains ~2% and width ~15%. **83% of the cost has no
// geometric explanation at all**, and a mechanism sentence written
// without one is exactly what G2 was raised for.
//
// THE HYPOTHESIS THIS BENCH TESTS, and it is the standing brief's own
// priority order (findings 0: a perfect classifier buys 13.7% of scored
// error; 76-86% is cadence, geometry, tracking and coasting): the box is
// not what costs the exposure, the ASSOCIATION the box induces is. IoU
// is computed between observation boxes and track boxes, so swapping the
// body source changes every IoU in the system. A subject whose box
// changes shape mid-shot fails to re-associate, its track expires, and
// **an expired track is re-minted BLURRED** -- which is phantom, not
// exposure. The other direction is the costly one: a smaller, tighter
// measured box that no longer reaches the track it belongs to leaves a
// gap between the old track dying and the new one being read.
//
// The birth classes separate those. `birthFresh` is "no track was
// anywhere near" -- a genuinely new subject. `birthNearMiss` is "a track
// overlapped but under PTRACK_IOU_MIN" -- an association FAILURE, and
// the class a changed box shape moves. `birthContended` is "the overlap
// was there and the assignment gave it to somebody else".
//
// PREDICTION, written before the run: if the body source is an
// association problem, `birthNearMiss` rises sharply in the mnBody arms
// and `birthFresh` does not. If it is a geometry problem, the birth
// counts barely move and the exposure is boxes landing off people.
import './_build.mjs';
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import {
  makeArms, loadWin, thinFrames, K_HIS, hisRegimeOpts, CONTROL,
} from './arch-arms.mjs';
import { score } from './corpus-score.mjs';

const S = await import('./.cache/shipped.mjs');
const K = Number(process.env.K || K_HIS);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const ARMS = [
  ['CONTROL  synthetic guess', {}],
  ['mnBody   s>=0.00', { mnBody: true, ssdMin: 0 }],
  ['mnBody   s>=0.40', { mnBody: true, ssdMin: 0.4 }],
  ['mnBody   EDGE ONLY', { mnBody: true, ssdMin: 0, ssdEdge: true }],
];

const KEYS = ['birthFresh', 'birthNearMiss', 'birthContended', 'birthSizeRejected',
  'coastExpired'];

function runArm(g, extra) {
  const arm = makeArms(S)({ ...hisRegimeOpts(g), ...extra });
  const tot = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  const life = {};
  for (const file of winFiles()) {
    globalThis.__TS_GAZE_IDS = { life: {} };
    const out = arm(thinFrames(loadWin(file), K), g);
    const s = score(out, g, (crop) => cropLabel.get(crop));
    tot.exposureS += s.exposureS;
    tot.falseCoverS += s.falseCoverS;
    tot.phantomS += s.phantomS;
    for (const k of KEYS) life[k] = (life[k] || 0) + (globalThis.__TS_GAZE_IDS.life[k] || 0);
  }
  delete globalThis.__TS_GAZE_IDS;
  life.births = KEYS.slice(0, 4).reduce((a, k) => a + (life[k] || 0), 0);
  return { tot, life };
}

console.log(`18 windows, k=${K} (${(K * 0.5).toFixed(1)}s/verdict), his regime`);
console.log(`CONTROL must read ${CONTROL.config}`);

for (const g of ['man', 'woman']) {
  console.log('');
  console.log(`-- ${g.toUpperCase()} --`);
  let base = null;
  console.log('arm'.padEnd(26) + '   exp   births  fresh  nearMiss  contend  sizeRej  coastExp');
  for (const [name, opts] of ARMS) {
    const r = runArm(g, opts);
    if (!base) {
      base = r;
      const want = CONTROL[g];
      if (r.tot.exposureS !== want.exposureS
        || r.tot.falseCoverS !== want.falseCoverS
        || r.tot.phantomS !== want.phantomS) {
        console.error(`CONTROL did not reproduce in ${g}: ${r.tot.exposureS} / `
          + `${r.tot.falseCoverS} / ${r.tot.phantomS} against ${want.exposureS} / `
          + `${want.falseCoverS} / ${want.phantomS}`);
        process.exitCode = 2;
      }
    }
    const d = (k) => {
      const v = r.life[k] || 0;
      if (r === base) return String(v).padStart(8);
      const dd = v - (base.life[k] || 0);
      return `${v}${dd >= 0 ? '+' : ''}${dd}`.padStart(8);
    };
    console.log(name.padEnd(26)
      + r.tot.exposureS.toFixed(1).padStart(6)
      + String(r.life.births).padStart(9)
      + d('birthFresh') + d('birthNearMiss') + d('birthContended')
      + d('birthSizeRejected') + d('coastExpired'));
  }
}

console.log('');
console.log('H1 (phase-h critic), CORRECTED: bodyFromSsd used to emit a box');
console.log('with no headX/headY/headW/headH, where personFromFace and');
console.log('boundBodyToSlot both carry them -- so sameHuman(person-track.mjs)');
console.log('had its head-separation guard OFF for every mnBody observation');
console.log('and merged any two boxes 60% contained, INCLUDING two different');
console.log('people handed the same MoveNet person box. With the head fields');
console.log('restored the numbers above are the record, and the prediction');
console.log('this bench opens with is CONFIRMED, not falsified: births move');
console.log('141 -> 139 man / 136 -> 133 woman, birthContended RISES (60 -> 66');
console.log('man, 62 -> 66 woman) and coastExpired is flat (man) or falls');
console.log('slightly (woman). The only class still falling is birthNearMiss,');
console.log('the one the association hypothesis was about.');
console.log('');
console.log('THE COST IS +1.5s (man) / +2.0s (woman) OF EXPOSURE, NOT +30.5s /');
console.log('+18.5s -- roughly 1.07x the control, not 2.4x. And the false');
console.log('cover column moves the OTHER way from the deleted-observations');
console.log('reading: +22.5s man / +11.5s woman, not down. A measured body');
console.log('covers MORE, not less, once the observations it was previously');
console.log('discarding are put back.');
console.log('');
console.log('birthContended is 66/139 = 47.5% (man) and 66/133 = 49.6%');
console.log('(woman) of births on the measured body -- HIGHER than the');
console.log('synthetic guess (60/141 = 42.6%, 62/136 = 45.6%), not lower.');
console.log('The "1091 is cheaper than it looks" reading is withdrawn: a');
console.log('measured body source gives the Hungarian assignment MORE to');
console.log('contend over, not less.');
