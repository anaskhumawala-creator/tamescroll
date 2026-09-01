// CAN A REMEMBERED IDENTITY PUSH A PATCH OFF ITS OWN FACE?
//
// The adjacency clamp refuses a pusher whose read carried no descriptor
// signal, and on his phone 36-42% of reads carry none (loop 40). So the
// man beside her stopped pushing on exactly the passes where the model
// failed -- measured live: bodyClampFired 2-3 in 75 seconds while her
// synthetic body spanned x 0.371-0.916 and his head sat at x 0.463.
//
// FALSE COVER is the number this must move. Exposure must not rise: a
// wider set of pushers can only ever make a patch SMALLER.
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
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const thin = (win, every) => ({ ...win, frames: win.frames.map((fr, i) =>
  i % every === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

const MEM = g === 'man' ? 'loose2' : 'loose';
const B = { hold: true, clampPad: 0.02, cut: true, mem: MEM, inertNoSignal: true };
const ARMS = [
  ['1083 (shipped)', B],
  ['+ memory may push', { ...B, memSignal: true }],
  ['+ memory may push, no clamp', { ...B, memSignal: true, clampPad: null }],
];
console.log(`gender=${g}   windows ${wins.length}`);
console.log('\narm                              EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, o] of ARMS) {
  const arm = ARM(o);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(32) +
    (agg.exposureS.toFixed(1) + 's').padStart(10) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
    (agg.phantomS.toFixed(1) + 's').padStart(10));
}
