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
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
const RX = /var PTRACK_IOU_MIN = 0\.2;/;
if (!RX.test(src)) throw new Error('PTRACK_IOU_MIN not found -- the bundle changed shape');
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const O = { hold: true, clampPad: 0.02, cut: true };

console.log(`gender=${g}  windows ${wins.length}  k=3 (his 1.5s)\n`);
console.log('IOU_MIN   EXPOSURE  FALSECOVER   PHANTOM   births  cleared  nearMiss');
for (const v of [0.20, 0.15, 0.10, 0.05, 0.02]) {
  const f = `./.cache/iou${v}.mjs`;
  fs.writeFileSync(f, src.replace(RX, `var PTRACK_IOU_MIN = ${v};`));
  const arm = makeArms(await import(f))(O);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  globalThis.__TS_GAZE_IDS = { life: {} };
  for (const w of wins) {
    const s = score(arm(thin(w, 3), g), g, (c) => cropLabel.get(c));
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
