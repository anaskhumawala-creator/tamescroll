// PRICING THE CLAMP'S PUSHER PREDICATE.
//
// The shipped clamp only lets a face the pipeline CLEARED push a
// neighbour's edge back. On his phone that fires 5-10 times in 90s,
// because he is read AND cleared in only about a third of passes -- so
// two passes in three nothing pushes and her 63%-of-frame synthetic
// body takes him.
//
// The candidate widens the pusher set to ANY detected face carrying
// descriptor signal, whatever its verdict. The argument that it is not
// an exposure: a face that needs covering mints its OWN patch in the
// same pass, so the strip uncovered by trimming the neighbour is
// covered by that face's own rectangle. This bench is what decides
// whether that argument survives contact with the corpus.
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

// The lowered bars (0.45 / 0.35) SHIP as of 1080, so there is nothing
// to patch -- the shipped module already is the candidate.
const ARM_LOW = makeArms(await import('./.cache/shipped.mjs'));

// HIS REGIME: a non-verdict pass observes NOBODY (MoveNet n:0), so the
// track coasts. Modelling it as a position pass measures a machine he
// does not own.
function thin(win, every) {
  if (every <= 1) return win;
  return { ...win, frames: win.frames.map((fr, i) =>
    i % every === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) };
}

const ARMS = [
  ['1081 SHIPPED (clamp: cleared)', ARM_LOW({ hold: true, clampPad: 0.02, cut: true })],
  ['candidate  (clamp: any signal)', ARM_LOW({ hold: true, clampPad: 0.02, clampMode: 'signal', cut: true })],
  ['no clamp at all  <- floor', ARM_LOW({ hold: true, cut: true })],
];

console.log(`gender=${g}   1.5s per verdict, his regime (coast), scene gate ON\n`);
console.log('arm                              EXPOSURE  FALSECOVER   PHANTOM   covered  sharp');
for (const [name, arm] of ARMS) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(32) +
    (agg.exposureS.toFixed(1) + 's').padStart(10) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
    (agg.phantomS.toFixed(1) + 's').padStart(10) +
    (agg.coveredS.toFixed(1) + 's').padStart(10) +
    (agg.sharpOkS.toFixed(1) + 's').padStart(8));
}
