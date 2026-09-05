// GATE 0: does this scorer reproduce finding 47's published table?
// If it does not, nothing below it means anything.
import { load, barFor, falseCover, exposure, auc, pct } from './lib.mjs';

for (const arm of ['rgb', 'grey', 'rgbMir', 'greyMir']) {
  const rows = load(arm);
  const F = rows.filter((r) => r.who === 'woman');
  const M = rows.filter((r) => r.who === 'man');
  const b = barFor(F, 'raw', 0.016);
  console.log(arm.padEnd(8), 'n', rows.length, 'bar', b.toFixed(3),
    'exposure', pct(exposure(F, 'raw', b)),
    'falseCover', pct(falseCover(M, 'raw', b)),
    'AUC', auc(rows, 'raw').toFixed(4));
}
console.log('\nfinding 47 published: rgb 21.8  grey 18.2  rgbMir 21.5  greyMir 17.2');
console.log('handoff published AUC: shipped 0.9808, +grey 0.9855');

// CAN THIS INSTRUMENT FAIL? Shuffle the labels; false cover must collapse
// toward the bar's own quantile and AUC toward 0.5.
const rows = load('grey');
let s = 7;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const shuf = rows.map((r) => ({ ...r }));
for (let i = shuf.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = shuf[i].who; shuf[i].who = shuf[j].who; shuf[j].who = t; }
const F2 = shuf.filter((r) => r.who === 'woman');
const M2 = shuf.filter((r) => r.who === 'man');
const b2 = barFor(F2, 'raw', 0.016);
console.log('\nLABELS SHUFFLED (must be near-chance): falseCover',
  pct(falseCover(M2, 'raw', b2)), 'AUC', auc(shuf, 'raw').toFixed(4));
