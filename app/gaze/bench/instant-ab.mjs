// HOW CERTAIN MUST ONE READ BE TO CLEAR A MAN ON ITS OWN?
//
// fc-why: 77% of the false cover that is his OWN read (115.0s of 149.0s,
// man mode) is a read that is male, carries signal, is an adult, and
// CLEARS THE BAR at score p50 0.71 -- and he is covered anyway, because
// clearing takes CLEAR_STREAK_N = 2 consecutive and GENDER_INSTANT_CLEAR
// is 0.8. Those men sit in the 0.45-0.80 band: certain, not certain
// enough to skip the queue.
//
// The exposure this risks is precise and already measured: a real woman
// misgendered at his player's sizes reads male raw 0.58-0.66, which is
// score 0.16-0.32 (loop 38). A bar anywhere at or above 0.6 is far above
// that population -- but "far above a distribution I measured elsewhere"
// is an argument, and EXPOSURE here is the check.
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);
const thin = (win, e) => ({ ...win, frames: win.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const O = { hold: true, clampPad: 0.02, cut: true, inertNoSignal: true, memSignal: true,
  mem: g === 'man' ? 'loose2' : 'loose' };
console.log(`gender=${g}   windows ${wins.length}`);
console.log('\nGENDER_INSTANT_CLEAR   EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, path] of [['0.80 (shipped)', './.cache/shipped.mjs'],
  ['0.75', './.cache/ic0.75.mjs'], ['0.70', './.cache/ic0.70.mjs'],
  ['0.65', './.cache/ic0.65.mjs'], ['0.60', './.cache/ic0.60.mjs']]) {
  const arm = makeArms(await import(path))(O);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(23) + (agg.exposureS.toFixed(1) + 's').padStart(8) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
}
