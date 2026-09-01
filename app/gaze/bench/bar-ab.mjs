// THE CLEAR BAR, PRICED ON LABELS.
//
// Live on his phone, 300 reads: male reads sit at score p50 0.31
// against GENDER_CLEAR_SCORE 0.45, so the MEDIAN man does not clear and
// only 108 of 267 signal-carrying male reads do. That is the false
// cover he is looking at.
//
// It cannot simply be lowered. Loop 38 measured a real woman reading
// `male raw 0.58-0.66` when degraded to the sizes his player produces
// -- score 0.16-0.32 -- so a bar under ~0.35 starts CLEARING WOMEN. The
// corpus is the only instrument that prices both halves, because its
// faces are labelled.
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
const O = { hold: true, clampPad: 0.02, cut: true, mem: g === 'man' ? 'loose2' : 'loose',
  inertNoSignal: true, memSignal: true };

console.log(`gender=${g}   windows ${wins.length}`);
console.log('\nbar                  EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, path] of [['0.45 (shipped)', './.cache/shipped.mjs'],
  ['0.40', './.cache/bar0.40.mjs'], ['0.35', './.cache/bar0.35.mjs'],
  ['0.30', './.cache/bar0.30.mjs']]) {
  const arm = makeArms(await import(path))(O);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(21) + (agg.exposureS.toFixed(1) + 's').padStart(9) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
}
