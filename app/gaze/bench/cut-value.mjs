// WHAT DOES THE SCENE GATE BUY, AND WHAT DOES MISSING A CUT COST?
//
// CUT_DELTA cannot be swept here -- bank/cuts.json holds BOOLEANS, not
// the raw luma deltas, so a variant constant has nothing to re-decide.
// Recomputing luma over 18 windows of video is a re-bank, and his own
// device already carries the better instrument for the THRESHOLD (600
// live deltas on the footage he is complaining about).
//
// What the corpus CAN bound is the other half: how much the gate is
// worth at all. Raising the threshold can only ever move behaviour
// toward the cut-OFF arm, so the gap between these two rows is the
// worst case for raising it.
//
// HONEST LIMIT, carried from loop 39: this arm WIPES without the
// immediate full pass the app does, because the corpus banks reads only
// at its own frames. So the absolute exposure of the cut-on row
// overstates; only the DIFFERENCE is fair.
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
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const B = { hold: true, clampPad: 0.02, mem: g === 'man' ? 'loose2' : 'loose',
  inertNoSignal: true, memSignal: true };
console.log(`gender=${g}   windows ${wins.length}`);
console.log('\narm                        EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, o] of [['every cut wipes', { ...B, cut: true }],
                         ['no cut ever wipes', { ...B, cut: false }]]) {
  const arm = ARM(o); const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(26) + (agg.exposureS.toFixed(1) + 's').padStart(9) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
}
