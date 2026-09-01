// WHY: 72% of FALSE COVER is a patch CENTRED on the wrong-gender face,
// so he is not absorbed into anyone -- his own read covered him.
// Blur-first means covering is the DEFAULT, so that has exactly two
// possible causes and they need opposite fixes:
//   MISGENDER  the read says the other gender. The gender MODEL is wrong.
//   NO CLEAR   the read is correct but never certain enough to earn a
//              clear, or no read landed at all. The BAR or the CADENCE.
// Nothing here re-derives a score: it reads the banked v/score/nm the
// corpus already holds and applies the SHIPPED constants.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';
const S = await import('./.cache/shipped.mjs');

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const YFE = S.GENDER_CLEAR_SCORE, VFE = S.GENDER_CLEAR_SCORE_FEMALE;
console.log(`shipped bars: male-clears ${YFE}  female-clears ${VFE}`);

const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const buckets = { noRead: 0, misgender: 0, weak: 0, clears: 0 };
const vs = [];
for (const f of files) {
  const w = loadWin(f);
  for (const fr of w.frames) for (const fc of fr.faces) {
    if (cropLabel.get(fc.crop) !== 'man') continue;          // user gender = man
    if (typeof fc.raw !== 'number') { buckets.noRead++; continue; }
    vs.push(fc.raw);
    const score = 2 * Math.abs(fc.raw - 0.5);
    if (fc.raw < 0.5) buckets.misgender++;                    // reads FEMALE
    else if (score < YFE) buckets.weak++;                     // right, not certain
    else buckets.clears++;
  }
}
vs.sort((a, b) => a - b);
const q = (p) => vs.length ? vs[Math.floor(p * (vs.length - 1))].toFixed(3) : 'n/a';
const tot = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
console.log(`\nfaces labelled MAN: ${tot}`);
for (const [k, v] of Object.entries(buckets))
  console.log('  ' + k.padEnd(11) + String(v).padStart(6) + '  ' + (100 * v / tot).toFixed(1) + '%');
console.log(`\nmale read v  p05 ${q(0.05)}  p50 ${q(0.5)}  p95 ${q(0.95)}   (>0.5 = male)`);
