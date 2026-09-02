// THRESHOLD OR ASSIGNMENT? -- the fork E5 left open.
//
// At the corrected CUT_DELTA, 145 of 310 births (46.8%) had a track
// overlapping them and were born anyway: 48 nearMiss (overlap below
// PTRACK_IOU_MIN, a THRESHOLD problem) and 32 contended (overlap enough,
// lost the assignment). births.mjs says which is bigger; only this can
// say whether moving the threshold PAYS, because a looser threshold buys
// re-association at the price of associating a woman's observation onto
// a man's CLEARED track -- which is EXPOSURE, and is the mechanism
// bar-blame traced this corpus's single biggest exposure to.
//
// PTRACK_IOU_MIN is read by the shipped module at replay time (unlike
// CUT_DELTA, which the replay never reads), so a patched variant
// genuinely moves behaviour. _mkesm clears the variant cache per run, so
// these are built here and are strictly younger than the source.
//
// THREE PHASE-D DEFECTS FIXED HERE, and the first one invalidated the
// table this file published (findings 10e, re-derived).
//
// 1. IT RAN IN THE WRONG REGIME (D2). `O` carried three options where
//    `hisRegimeOpts` carries seven, and the one that mattered is
//    `fixedCadence`: with it absent the tracker was told the 500ms BANK
//    interval and coasted 1250ms, not his cap-pinned 2000/4000. Every
//    row was measured in a regime his phone is not in.
// 2. IT PATCHED A LITERAL. `/var PTRACK_IOU_MIN = 0\.2;/` is exactly the
//    shape that had three benches exiting on their own guard since loop
//    39 -- correct today, wrong the moment the constant moves. It goes
//    through `patchConsts` by NAME now, which throws if the declaration
//    is gone.
// 3. IT HAND-ROLLED `thin`. A private copy of `thinFrames` is a second
//    implementation that can drift from the one every other bench uses.
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms, K_HIS, thinFrames, hisRegimeOpts, HIS_EFFZOOM } from './arch-arms.mjs';
import { patchConsts, readConst } from './_patch.mjs';

const g = process.env.GENDER || 'man';
const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
const SHIPPED = readConst(src, 'PTRACK_IOU_MIN');
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);
const K = Number(process.env.K || K_HIS);
const TOLD = Number(process.env.TOLD || HIS_EFFZOOM);
const O = hisRegimeOpts(g, TOLD);

console.log(`gender=${g}  windows ${wins.length}  k=${K} (${(K * 0.5).toFixed(1)}s/verdict)  told ${TOLD}ms`);
console.log(`shipped PTRACK_IOU_MIN ${SHIPPED} -- the first row is the control
`);
console.log('IOU_MIN   EXPOSURE  FALSECOVER   PHANTOM   births  cleared  nearMiss');
for (const v of [SHIPPED, 0.15, 0.10, 0.05, 0.02]) {
  // Written by ABSOLUTE path: `./.cache/...` resolves against the CWD for
  // writeFileSync and against the MODULE for import(), so the two halves
  // disagreed unless the bench happened to be run from bench/.
  const f = fileURLToPath(new URL(`./.cache/iou${v}.mjs`, import.meta.url));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, patchConsts(src, { PTRACK_IOU_MIN: v }));
  const arm = makeArms(await import(pathToFileURL(f).href + '?v=' + v))(O);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  globalThis.__TS_GAZE_IDS = { life: {} };
  for (const w of wins) {
    const s = score(arm(thinFrames(w, K), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  const L = globalThis.__TS_GAZE_IDS.life;
  const births = (L.birthCleared || 0) + (L.birthBlurred || 0);
  console.log(String(v).padEnd(10)
    + (agg.exposureS.toFixed(1) + 's').padStart(9)
    + (agg.falseCoverS.toFixed(1) + 's').padStart(12)
    + (agg.phantomS.toFixed(1) + 's').padStart(10)
    + String(births).padStart(9) + String(L.birthCleared || 0).padStart(9)
    + String(L.birthNearMiss || 0).padStart(10));
}
delete globalThis.__TS_GAZE_IDS;
