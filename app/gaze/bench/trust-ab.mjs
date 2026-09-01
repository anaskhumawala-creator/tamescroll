// HOW MANY EARNED CLEARS BEFORE MEMORY MAY ACT?
//
// Live on his phone, 269 track-frames: 192 blurred, and 44 of those
// (23%) are on a track whose LAST read was clear-certain. 64 sit at
// clear-streak 1 -- one read short of CLEAR_STREAK_N. Memory matched on
// 137 frames and did not act, because it needs MEM_TRUST_MAN earned
// clears before it may, and the tracks die before they get there (19
// distinct ids stuck, each for 2-4 frames).
//
// Lowering trust is the lever, and it is OTA-tunable. The risk is
// obvious and is what this prices: trusting sooner means trusting on
// less evidence, so if it clears anyone it should not, EXPOSURE moves.
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
const B = { hold: true, clampPad: 0.02, cut: true, inertNoSignal: true, memSignal: true };

console.log(`gender=${g}   windows ${wins.length}`);
console.log('\narm                          EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, o] of [
  ['no memory at all', { ...B, mem: null }],
  ['trust 2 (shipped, man)', { ...B, mem: 'loose2' }],
  ['trust 1', { ...B, mem: 'loose' }],
]) {
  const arm = ARM(o); const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(29) + (agg.exposureS.toFixed(1) + 's').padStart(9) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
}
