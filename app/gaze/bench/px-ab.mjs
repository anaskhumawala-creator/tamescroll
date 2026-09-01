// WHY: FACE_MIN_NATIVE_PX 40 refuses 17.7% of every face this corpus
// labels MAN, and a refused face ABSTAINS -- which fails closed, so it
// is covered. His player decodes 640x360 and faces reach faceres at px
// p50 38-62, so the floor sits exactly on his modal face.
//
// The floor exists because a small crop can read CERTAIN off a non-face
// (loop 34: 38-53% of thumbnail corner crops). So lowering it is an
// EXPOSURE trade and both directions are priced here, in both modes.
// Loop 34 also measured the other half: 28 of 28 real faces agreed with
// their own full-resolution answer at every size down to 32px.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const BASE = { hold: true, clampPad: 0.02, cut: true };

const mods = [['px 40 (ships)', './.cache/shipped.mjs'], ['px 36', './.cache/px36.mjs'],
              ['px 32', './.cache/px32.mjs'], ['px 28', './.cache/px28.mjs']];
const arms = [];
for (const [n, p] of mods) arms.push([n, makeArms(await import(p))(BASE)]);

for (const g of ['man', 'woman']) {
  console.log(`\ngender=${g}` + '\narm               EXPOSURE  FALSECOVER   PHANTOM');
  for (const [name, arm] of arms) {
    const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
    for (const win of wins) {
      const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
      for (const k of Object.keys(agg)) agg[k] += s[k];
    }
    console.log(name.padEnd(17) + (agg.exposureS.toFixed(1) + 's').padStart(9) +
      (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
  }
}
