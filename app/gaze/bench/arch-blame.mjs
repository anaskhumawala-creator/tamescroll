// A0 vs A5, PER SUBJECT. The total moved, but he does not watch a total
// -- he watches one man go blurry. He named Linus tonight, so the arm
// has to be checked against the subject he named and not only the sum.
// An arm that halves the total by rescuing eight strangers while leaving
// Linus exactly as he was has not fixed the thing he reported.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { ARM_A0, ARM_A5, loadWin } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropId = new Map();
const idLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8'))) {
  idLabel.set(c.id, labels[c.id]);
  for (const m of c.members) cropId.set(m.crop, c.id);
}
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);

function overlapFrac(f, p) {
  const x1 = Math.max(f.x1, p.x1), y1 = Math.max(f.y1, p.y1);
  const x2 = Math.min(f.x2, p.x2), y2 = Math.min(f.y2, p.y2);
  if (x2 <= x1 || y2 <= y1) return 0;
  const a = (f.x2 - f.x1) * (f.y2 - f.y1);
  return a > 0 ? ((x2 - x1) * (y2 - y1)) / a : 0;
}

const tally = new Map();
for (const [key, arm] of [['a0', ARM_A0], ['a5', ARM_A5]]) {
  for (const win of wins) {
    for (const fr of arm(win, g)) {
      for (const f of fr.faces) {
        const id = cropId.get(f.crop);
        if (id == null || idLabel.get(id) !== 'man') continue;
        let best = 0;
        for (const p of fr.patches) best = Math.max(best, overlapFrac(f, p));
        const t = tally.get(id) || { a0cov: 0, a0n: 0, a5cov: 0, a5n: 0 };
        t[key + 'n']++;
        if (best >= 0.15) t[key + 'cov']++;
        tally.set(id, t);
      }
    }
  }
}

const pc = (c, n) => (n ? (100 * c / n).toFixed(0) : '-').padStart(3) + '%';
console.log('MEN wrongly blurred, per subject       A0 shipped        ->          A5');
let a0 = 0, a5 = 0, n = 0;
[...tally.entries()].sort((x, y) => y[1].a0cov - x[1].a0cov).forEach(([id, t]) => {
  a0 += t.a0cov; a5 += t.a5cov; n += t.a0n;
  if (t.a0n < 3) return;
  console.log('  ' + id.padEnd(20) +
    (t.a0cov + '/' + t.a0n).padStart(10) + ' ' + pc(t.a0cov, t.a0n) +
    '   ->' + (t.a5cov + '/' + t.a5n).padStart(10) + ' ' + pc(t.a5cov, t.a5n));
});
console.log('  ' + 'ALL MEN'.padEnd(20) + (a0 + '/' + n).padStart(10) + ' ' + pc(a0, n) +
  '   ->' + (a5 + '/' + n).padStart(10) + ' ' + pc(a5, n));
