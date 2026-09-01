// WHAT DOES LOWERING THE CLEAR BAR ACTUALLY LET THROUGH?
//
// The time-score cannot answer this: exposure reads 0.5-2.5s in EVERY
// arm, in BOTH gender modes, because the system is heavily fail-closed
// and a track that loses its clear for one pass is still covered by the
// neighbouring pass. That is a real property of the product, not a
// corpus defect -- but it means the bar change ships unpriced unless
// the question is asked directly.
//
// So ask it per READ, where the power is: for every face a HUMAN
// labelled as someone the user asked to cover, does the shipped bar
// cover it and the lower bar clear it? That is the exposure the change
// would buy, named face by face, with no tracker in between.
import fs from 'fs';
import { faceMeta } from './.cache/shipped.mjs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';
import { patchConsts, shippedBar } from './_patch.mjs';

// THE BAR IS READ, NOT ASSUMED. This file used to patch the literal
// `0.6`, which loop 39 replaced with 0.45 -- so it has been exiting on
// its own guard ever since. The variant is one step below whatever ships
// today (override with LOWBAR=0.30,0.25), and both numbers are printed,
// because a per-read exposure table is unreadable without them.
const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
const [SHIP_M, SHIP_F] = shippedBar(src);
const [LOW_M, LOW_F] = (process.env.LOWBAR || '0.30,0.25').split(',').map(Number);
if (!(LOW_M < SHIP_M)) throw new Error(
  `LOWBAR male ${LOW_M} is not below the shipped ${SHIP_M} -- there is no `
  + 'exposure to price if the two arms are the same bundle.');
console.log(`shipped bar ${SHIP_M}/${SHIP_F}   candidate ${LOW_M}/${LOW_F}`);
const p = patchConsts(src, {
  GENDER_CLEAR_SCORE: LOW_M, GENDER_CLEAR_SCORE_FEMALE: LOW_F,
});
fs.writeFileSync(new URL('./.cache/lowbar.mjs', import.meta.url), p);
const LOW = await import('./.cache/lowbar.mjs');

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropId = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  for (const m of c.members) cropId.set(m.crop, c.id);
const readOf = (f) => ({ gender: f.gender, score: f.score, raw: f.raw, age: f.age,
  childP: f.childP, shape: f.shape, desc: null });
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);

for (const g of ['man', 'woman']) {
  const mustCover = (l) => g === 'man' ? (l === 'woman' || l === 'child') : (l === 'man' || l === 'child');
  let cover = 0, newlyClear = 0, sharp = 0, newlySharpOK = 0;
  const victims = new Map();
  for (const win of wins) {
    for (const fr of win.frames) {
      const a = faceMeta(g, fr.faces.map(readOf));
      const b = LOW.faceMeta(g, fr.faces.map(readOf));
      fr.faces.forEach((f, i) => {
        const id = cropId.get(f.crop), lab = labels[id];
        if (!lab || lab === 'mixed' || lab === 'bodypart' || lab === 'notperson') return;
        const flip = a[i] && b[i] && a[i].flagged && !b[i].flagged;
        if (mustCover(lab)) { cover++; if (flip) { newlyClear++; victims.set(id, (victims.get(id) || 0) + 1); } }
        else { sharp++; if (flip) newlySharpOK++; }
      });
    }
  }
  console.log(`gender=${g}`);
  console.log(`  people he asked to COVER: ${cover} reads, newly CLEARED by bar .45: ` +
    `${newlyClear}  (${(100 * newlyClear / Math.max(1, cover)).toFixed(2)}%)  <- the exposure bought`);
  console.log(`  people he wants SHARP:    ${sharp} reads, newly cleared: ` +
    `${newlySharpOK}  (${(100 * newlySharpOK / Math.max(1, sharp)).toFixed(1)}%)  <- the win bought`);
  if (victims.size) {
    console.log('  newly-exposed subjects:');
    [...victims.entries()].sort((x, y) => y[1] - x[1]).forEach(([k, v]) =>
      console.log(`    ${k.padEnd(20)} ${v} reads   (${labels[k]})`));
  }
  console.log('');
}
