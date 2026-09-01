// DOES A MEASURED PERSON BOX BEAT THE 7.4-FACE-HEIGHTS GUESS?
//
// Everything else is held: same tracker, same verdict layer, same
// clamp, same scene gate, same cadence. The ONLY change is where a
// body's extent comes from -- personFromFace, or a coco-ssd detection
// containing that face.
//
// `measured` reports how many faces actually got a detector box. A
// score without it is unreadable: an arm that fell back to the guess on
// every face would print as "no change" and look like a null result
// rather than a harness failure.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

// Only windows the ssd bank has reached, so a half-finished bank cannot
// silently score half the corpus as "no boxes available".
const all = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const have = new Set(fs.existsSync(`${ROOT}/bank/ssd`) ? fs.readdirSync(`${ROOT}/bank/ssd`) : []);
const files = all.filter((f) => have.has(f));
console.log(`gender=${g}   windows with ssd boxes: ${files.length} of ${all.length}`);
if (!files.length) { console.log('ssd bank empty -- run cocossd-bank.mjs first'); process.exit(0); }
const wins = files.map(loadWin);

const ARM = makeArms(await import('./.cache/shipped.mjs'));
function thin(win, every) {
  if (every <= 1) return win;
  return { ...win, frames: win.frames.map((fr, i) =>
    i % every === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) };
}

const BASE = { hold: true, clampPad: 0.02, cut: true };
const MEM = g === 'man' ? 'loose2' : 'loose';
const B = { ...BASE, mem: MEM, ssdMin: 0.35, ssdPad: 0.15 };
const P = { ...B, ssdPersons: true, ssdPersonsAccidentOnly: true };
const ARMS = [
  ['1082 (no ssd)', ARM({ ...BASE, mem: MEM })],
  ['ssd bodies only', ARM(B)],
  ['ssd EDGE toward cleared face', ARM({ ...BASE, mem: MEM, ssdMin: 0.35, ssdEdge: true })],
  ['ssd EDGE @0.20', ARM({ ...BASE, mem: MEM, ssdMin: 0.20, ssdEdge: true })],
];

console.log('\narm                             EXPOSURE  FALSECOVER   PHANTOM   measured/faces');
for (const [name, arm] of ARMS) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  let m = 0, ft = 0;
  for (const win of wins) {
    const out = arm(thin(win, 3), g);
    m += out.measured || 0; ft += out.faceTotal || 0;
    const s = score(out, g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(31) +
    (agg.exposureS.toFixed(1) + 's').padStart(10) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
    (agg.phantomS.toFixed(1) + 's').padStart(10) +
    ('  ' + m + '/' + ft).padStart(17));
}
