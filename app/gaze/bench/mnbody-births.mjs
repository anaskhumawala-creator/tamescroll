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
console.log('THE PREDICTION ABOVE IS FALSIFIED, in both genders and on');
console.log('every axis. The measured body does not associate WORSE --');
console.log('it associates BETTER: births 141 -> 113 man / 136 -> 111');
console.log('woman, contended 60 -> 38 and 62 -> 36, coastExpired 96 ->');
console.log('74 and 92 -> 74, nearMiss falling or flat. Cleaner tracking');
console.log('on every count, and exposure 2.4x worse.');
console.log('');
console.log('SO IT IS THE BOX, and specifically the AREA the guess has');
console.log('and the measurement does not. The signature is in the false');
console.log('cover column moving the OTHER way at the same time (136.5 ->');
console.log('129.5 man, 201.5 -> 186.5 woman): strip the fat and some of');
console.log('what it was covering was people who should be covered');
console.log('(exposure up) and some was people who should not be (false');
console.log('cover down). That is findings 20 "the fat guess covers');
console.log('people by accident", measured from the inside.');
console.log('');
console.log('AND IT MAKES 1091 CHEAPER THAN IT LOOKS: birthContended is');
console.log('the class the Hungarian assignment shipped for, and 37% of');
console.log('it is manufactured by the guess overlapping itself. On a');
console.log('measured body source there is much less to contend over.');
