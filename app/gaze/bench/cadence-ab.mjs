// HOW MUCH OF THE FALSE COVER IS JUST THE CLOCK?
//
// Clearing a man takes CLEAR_STREAK_N = 2 verdicts, so at his measured
// 1.5s per verdict the FLOOR on his blur after any track birth is 3
// seconds, whatever the model says. Before spending more effort on
// thresholds it is worth knowing how much of the 216.5s is that floor
// rather than a decision.
//
// `every` is the corpus frame stride: the bench banks a read every 0.5s,
// so 3 = 1.5s per verdict (his regime, every number this session is
// quoted in), 2 = 1.0s, 1 = 0.5s.
//
// This is NOT a proposal to raise the cadence -- that is a GPU cost on
// his phone and loop 35 measured what buying passes costs the frame
// rate. It is a measurement of the ceiling any threshold work is
// competing against.
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
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const arm = ARM({ hold: true, clampPad: 0.02, cut: true, inertNoSignal: true,
  memSignal: true, mem: g === 'man' ? 'loose2' : 'loose' });
console.log(`gender=${g}   windows ${wins.length}${process.env.PXBAND ? '   PXBAND ' + process.env.PXBAND : ''}`);
console.log('\nverdict cadence      EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, every] of [['1.5s (his regime)', 3], ['1.0s', 2], ['0.5s', 1]]) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, every), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(21) + (agg.exposureS.toFixed(1) + 's').padStart(8) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
}
