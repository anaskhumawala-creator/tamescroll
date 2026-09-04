// dima806 vs WHAT SHIPS, ON HIS OWN CORPUS, AT MATCHED EXPOSURE.
//
// Joins dima806's reads to the shipped head's reads BY CROP, so all three
// arms score the SAME reads. The two banks have different row counts
// (the GPU bench drops crops where BlazeFace found no face on re-detect)
// and comparing them unjoined would compare three different populations
// while looking like one table -- which is how the mirror arm was
// nearly reported at 66% in finding 47.
//
// Matched exposure, per this repo's oldest scoring rule: each arm solves
// its OWN bar to a common woman-exposure, then false cover on men is
// read. The clear bar sits far above the label boundary, so a label flip
// between 0.50 and 0.725 changes nothing that ships, and any arm wins an
// accuracy column by leaning female.
//
//   node app/gaze/bench/dima-score.mjs
import fs from 'fs';
import { scoreArm, TARGETS } from './head-train.mjs';

const NL = String.fromCharCode(10);
const BANK = 'Z:/tamescroll-corpus/bank/';
const ship = JSON.parse(fs.readFileSync(BANK + 'gpu-corpus-desc.json', 'utf8'));
const dima = JSON.parse(fs.readFileSync(BANK + 'dima-corpus.json', 'utf8'));

const byCrop = new Map();
for (const r of dima) byCrop.set(r.crop, r);
const rows = [];
for (const r of ship) {
  const d = byCrop.get(r.crop);
  if (!d || !r.rgb || !r.grey) continue;
  if (r.who !== 'man' && r.who !== 'woman') continue;
  rows.push({ who: r.who, vid: r.vid, cid: r.cid, px: r.px,
    rgb: r.rgb.raw, grey: r.grey.raw, dima: d.raw });
}
console.log(NL + 'dima806 vs THE SHIPPED HEAD -- HIS OWN CORPUS, MATCHED EXPOSURE');
console.log('  joined by crop: ' + rows.length + ' reads scored by ALL THREE arms'
  + '   (shipped bank ' + ship.length + ', dima bank ' + dima.length + ')');
console.log('  women ' + rows.filter((r) => r.who === 'woman').length
  + ' / men ' + rows.filter((r) => r.who === 'man').length);

const arms = [
  ['SHIPPED head (rgb)', (r) => r.rgb, 'finding 47 control: 14.8/19.2/21.8/25.8/35.1'],
  ['SHIPPED + GREY', (r) => r.grey, 'ships behind GENDER_GREY'],
  ['dima806 ViT-base', (r) => r.dima, 'Apache-2.0, NEVER seen this footage'],
];
console.log(NL + '  FALSE COVER ON MEN at a common woman-exposure -- lower is better');
console.log('  ' + 'arm'.padEnd(22)
  + TARGETS.map((t) => ('<=' + (t * 100).toFixed(1) + '%').padStart(8)).join('') + '     AUC');
for (const [name, f, note] of arms) {
  const a = scoreArm(rows.map((r) => ({ who: r.who, v: f(r) })), (r) => r.v);
  console.log('  ' + name.padEnd(22)
    + a.cells.map((c) => (c === null ? 'n/a' : (100 * c).toFixed(1) + '%').padStart(8)).join('')
    + '   ' + a.auc.toFixed(4) + '   ' + note);
}

// PER VIDEO, because ten videos is the unit and 2,159 reads are not
// independent -- a handful of identities generate hundreds of rows. One
// video carrying the whole result is the shape phase-g G2 caught.
console.log(NL + '  PER VIDEO -- women read as men at the label boundary');
console.log('  ' + 'video'.padEnd(14) + 'women'.padStart(7)
  + 'rgb'.padStart(9) + 'grey'.padStart(9) + 'dima'.padStart(9));
let dimaBest = 0; let n = 0;
for (const v of [...new Set(rows.map((r) => r.vid))].sort()) {
  const w = rows.filter((r) => r.vid === v && r.who === 'woman');
  if (!w.length) continue;
  const pc = (f) => w.filter((r) => f(r) >= 0.5).length / w.length;
  const a = pc((r) => r.rgb); const b = pc((r) => r.grey); const c = pc((r) => r.dima);
  n++;
  if (c <= Math.min(a, b)) dimaBest++;
  console.log('  ' + v.padEnd(14) + String(w.length).padStart(7)
    + (100 * a).toFixed(1).padStart(8) + '%'
    + (100 * b).toFixed(1).padStart(8) + '%'
    + (100 * c).toFixed(1).padStart(8) + '%');
}
console.log('  dima806 is best or tied in ' + dimaBest + ' of ' + n + ' videos');

// BY FACE SIZE, which is where finding 49 said the shipped head collapses.
console.log(NL + '  BY NATIVE FACE SIZE -- women read as men');
console.log('  ' + 'px band'.padEnd(14) + 'women'.padStart(7)
  + 'rgb'.padStart(9) + 'grey'.padStart(9) + 'dima'.padStart(9));
for (const [lo, hi] of [[0, 32], [32, 48], [48, 64], [64, 96], [96, 1e9]]) {
  const w = rows.filter((r) => r.who === 'woman' && r.px >= lo && r.px < hi);
  if (w.length < 20) continue;
  const pc = (f) => w.filter((r) => f(r) >= 0.5).length / w.length;
  console.log('  ' + ((hi > 1e8 ? lo + '+' : lo + '-' + hi) + 'px').padEnd(14)
    + String(w.length).padStart(7)
    + (100 * pc((r) => r.rgb)).toFixed(1).padStart(8) + '%'
    + (100 * pc((r) => r.grey)).toFixed(1).padStart(8) + '%'
    + (100 * pc((r) => r.dima)).toFixed(1).padStart(8) + '%');
}
console.log(NL + '  WHAT THIS DOES AND DOES NOT SETTLE:');
console.log('  It settles that dima806 generalises -- this footage is not its');
console.log('  training domain and nothing here has ever seen it, so the FairFace');
console.log('  table (which may be its own training split) is no longer load');
console.log('  bearing. It settles NOTHING about shipping it: ViT-base is ~86M');
console.log('  parameters against faceres 3.5M, and finding 43 already refused a');
console.log('  1.96x speedup of the smaller model. The route is a STUDENT.' + NL);
