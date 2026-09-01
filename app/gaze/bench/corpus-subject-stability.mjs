// THE SECTION 2 DESIGN QUESTION, ASKED OF THE DATA.
//
//   "Given reads this weak, is a per-frame verdict the right
//    architecture at all -- or should the video path decide per SUBJECT
//    over a window, and hold the patch while it decides?"
//
// Answerable WITHOUT labels, because it asks about VARIANCE within one
// identity, not about correctness. Clustering is on faceres' identity
// descriptor, which is independent of the gender decision -- so this is
// not circular.
//
// The number that decides it: does ONE PERSON cross GENDER_CLEAR_SCORE
// back and forth between consecutive frames. If they do, a per-frame
// verdict is reading noise, and "covered in one frame, sharp in the
// next" is the architecture rather than a bug in it.
import fs from 'fs';
import { GENDER_CLEAR_SCORE, clearScoreFor } from './.cache/shipped.mjs';
import { ROOT } from './corpus-lib.mjs';

const clusters = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8'));
const q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;

let flips = 0, pairs = 0, mixedClusters = 0, big = 0;
console.log('cluster            n   raw p05/p50/p95   swing  clears  flips/adjacent');
for (const c of clusters) {
  if (c.members.length < 8) continue;
  big++;
  const ms = c.members.slice().sort((a, b) => a.t - b.t);
  const raws = ms.map((m) => m.raw).filter((v) => typeof v === 'number');
  const cl = ms.map((m) => (m.score ?? 0) >= clearScoreFor(m.gender));
  let f = 0;
  for (let i = 1; i < cl.length; i++) { pairs++; if (cl[i] !== cl[i - 1]) { f++; flips++; } }
  const nClear = cl.filter(Boolean).length;
  if (nClear > 0 && nClear < cl.length) mixedClusters++;
  console.log(`${c.id.padEnd(16)} ${String(c.members.length).padStart(4)}   ` +
    `${q(raws,0.05).toFixed(2)}/${q(raws,0.5).toFixed(2)}/${q(raws,0.95).toFixed(2)}      ` +
    `${(q(raws,0.95)-q(raws,0.05)).toFixed(2)}   ${String(nClear).padStart(3)}/${String(cl.length).padStart(3)}   ${f}`);
}
console.log('');
console.log(`clusters with >=8 reads: ${big}`);
console.log(`  clusters that are BOTH cleared and not-cleared at some point: ${mixedClusters}/${big}`);
console.log(`  consecutive-frame clear/not-clear FLIPS: ${flips} over ${pairs} adjacent pairs = ${(100*flips/pairs).toFixed(1)}%`);
console.log('');
console.log('A per-frame verdict is reading noise if one identity flips often.');
console.log('A per-SUBJECT window is only worth building if the flips are');
console.log('frequent AND the subject has a stable majority to fall back on.');
