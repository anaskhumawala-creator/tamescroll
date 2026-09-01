// DOES LETTING THE SHIPPED CODE USE THE MEASUREMENT IT ALREADY HAS HELP?
//
// boundBodyToSlot shrinks the synthetic body onto a rejected MoveNet
// slot box, and guard-why.mjs measured which guard refuses:
//   SLOT_BOUND_FACE_INSIDE 0.8   77.4% of faces
//   SLOT_BOUND_FACE_TOP_FRAC     2.3%
//   SLOT_BOUND_MIN_FACE_HEIGHTS  0.6%
//   no slot box at all           3.2%
// So one constant decides almost everything, and a box exists for 96.8%
// of faces. This is the same measured-extent question coco-ssd asked --
// with a model that already ships and costs no APK bytes.
//
// Only windows whose MoveNet floats are banked are scored, so a
// half-finished bank cannot silently read as "no change".
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const all = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const have = new Set(fs.readdirSync(`${ROOT}/bank/persons`).map((f) => f.replace('.f32', '.json')));
const files = all.filter((f) => have.has(f));
console.log(`gender=${g}   windows with MoveNet floats: ${files.length} of ${all.length}`);
const wins = files.map(loadWin);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const MEM = g === 'man' ? 'loose2' : 'loose';
const BASE = { hold: true, clampPad: 0.02, cut: true, mem: MEM };

const arms = [['1083 (no slot bound)', makeArms(await import('./.cache/shipped.mjs'))(BASE)]];
for (const v of ['0.8', '0.6', '0.45', '0.3'])
  arms.push([`slot bound, faceInside ${v}`,
    makeArms(await import(`./.cache/inside${v}.mjs`))({ ...BASE, slotBound: true })]);

console.log('\narm                          EXPOSURE  FALSECOVER   PHANTOM   bound/faces');
for (const [name, arm] of arms) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  let m = 0, ft = 0;
  for (const w of wins) {
    const out = arm(thin(w, 3), g);
    m += out.measured || 0; ft += out.faceTotal || 0;
    const s = score(out, g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(28) + (agg.exposureS.toFixed(1) + 's').padStart(9) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10) +
    ('  ' + m + '/' + ft).padStart(14));
}
