// SHOULD AN UNREADABLE ADULT SPEND A CLEARED MAN'S RUNG?
//
// The clear grace holds one rung after a certain clear read, but every
// abstention spends it -- because one kind of abstention is a CHILD.
// The other kind is an adult face the model could not read, which is
// the case the grace already forgives.
//
// Live on his phone: 15 abstentions to 9 clear-certain reads in one
// window, 8 of 31 tracks peaked at clear-streak exactly 1, only 7 ever
// cleared.
//
// EXPOSURE IS THE NUMBER THAT DECIDES THIS. Holding a rung keeps a
// clear alive one pass longer on a read that saw nothing, so if it ever
// keeps a clear on the wrong person the corpus will charge for it.
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
console.log('\narm                              EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, path] of [['1085/1086 (every abstain spends)', './.cache/base.mjs'],
  ['unreadable adult holds the rung', './.cache/shipped.mjs']]) {
  const arm = makeArms(await import(path))(O);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log(name.padEnd(33) + (agg.exposureS.toFixed(1) + 's').padStart(8) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
}
