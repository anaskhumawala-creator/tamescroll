// HOW ALIKE MUST TWO FACES BE TO COUNT AS THE SAME PERSON?
//
// Live, 269 track-frames: memory MATCHED on 137 and acted on almost
// none, because trust needs 2 earned clears and the tracks die at 1.
// Trust 1 was measured and REFUSED -- it takes one corpus window from
// 0.0s to 3.5s of exposure for no false cover at all.
//
// PFF_BODY_DOWNis the other way to the same place: if one person's reads
// fragment across several prototypes, trust never accumulates on any of
// them, and merging them is not the same as trusting sooner. The risk
// runs the opposite way and is what this prices -- merge too eagerly
// and two different people become one identity, so a man's earned clear
// lands on the woman beside him. That is EXPOSURE.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const thin = (win, e) => ({ ...win, frames: win.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const O = { hold: true, clampPad: 0.02, cut: true, inertNoSignal: true, memSignal: true,
  mem: g === 'man' ? 'loose2' : 'loose' };

console.log(`gender=${g}   windows ${wins.length}`);
console.log('\nPFF_BODY_DOWN             EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, path] of [['6.0 (shipped)', './.cache/shipped.mjs'], ['4.5', './.cache/down4.5.mjs'],
  ['3.5', './.cache/down3.5.mjs'], ['2.5', './.cache/down2.5.mjs']]) {
  const arm = makeArms(await import(path))(O);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(21) + (agg.exposureS.toFixed(1) + 's').padStart(9) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
}
