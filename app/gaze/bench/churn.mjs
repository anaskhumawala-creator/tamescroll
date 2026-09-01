// WHY: every geometry lever moved FALSE COVER by ~1s (patch area 7x,
// streak 2->1, px floor). 72.6% of male reads survive every verdict
// gate. So the clear is reaching the verdict layer and not reaching the
// SCREEN, which leaves the tracker.
//
// This counts, for each face labelled MAN that is covered: how many
// DISTINCT track ids covered him across the window, and what state the
// covering track is in. A man who is covered by a long-lived blurred
// track has an association problem; a man covered by a parade of new
// ids has a CHURN problem -- his clear dies with each track and the
// next one is born blurred, which no threshold can fix.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
import { overlapFrac } from './corpus-score.mjs';
const S = await import('./.cache/shipped.mjs');

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const arm = makeArms(S)({ hold: true, clampPad: 0.02, cut: true });
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

const COVER = 0.15;
let coveredFrames = 0, idsSeen = 0, blurred = 0, other = 0;
const runs = [];
const allIds = new Set();                                   // consecutive frames per covering id
for (const f of fs.readdirSync(`${ROOT}/bank/reads`).filter((x) => x.endsWith('.json'))) {
  const out = arm(thin(loadWin(f), 3), 'man');
  const perFace = new Map();                       // crude identity: nearest previous man box
  let lastId = null, run = 0;
  for (const fr of out) {
    for (const fc of fr.faces) {
      if (cropLabel.get(fc.crop) !== 'man') continue;
      let best = null, bf = 0;
      for (const p of fr.patches) { const o = overlapFrac(fc, p); if (o > bf) { bf = o; best = p; } }
      // DO NOT reset lastId on an uncovered frame. The first version
      // did, so every gap in coverage was counted as a NEW covering
      // track and the churn figure was inflated by exactly the number
      // of gaps -- an instrument that manufactures the effect it is
      // looking for.
      if (bf < COVER || !best) { if (run) { runs.push(run); run = 0; } continue; }
      coveredFrames++;
      best.state === 'blurred' ? blurred++ : other++;
      if (best.id === lastId) run++;
      else { if (run) runs.push(run); run = 1; lastId = best.id; idsSeen++; }
      allIds.add(best.id);
    }
  }
  if (run) runs.push(run);
}
runs.sort((a, b) => a - b);
const q = (p) => runs.length ? runs[Math.floor(p * (runs.length - 1))] : 0;
console.log(`man-covered frames ${coveredFrames}`);
console.log(`  covering track state: blurred ${blurred}  other ${other}`);
console.log(`  covering-id CHANGES: ${idsSeen}   distinct ids overall: ${allIds.size}`);
console.log(`  frames a single id keeps covering him: p50 ${q(0.5)}  p90 ${q(0.9)}  max ${q(1)}`);
console.log(`  -> ${(coveredFrames / (idsSeen || 1)).toFixed(1)} frames per id (${(0.5 * coveredFrames / (idsSeen || 1)).toFixed(1)}s)`);
