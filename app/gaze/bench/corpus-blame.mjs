// WHO IS ACTUALLY BEING COVERED WRONGLY. The totals say 36% of
// man-seconds are blurred; this says which men, so a fix can be aimed
// instead of guessed at.
import fs from 'fs';
import { replay } from './corpus-score.mjs';
import { ROOT } from './corpus-lib.mjs';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const clusters = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8'));
const cropLabel = new Map(), cropCluster = new Map();
for (const c of clusters) for (const m of c.members) { cropLabel.set(m.crop, labels[c.id]); cropCluster.set(m.crop, c.id); }
const ov = (f, b) => { const x1 = Math.max(f.x1, b.x1), y1 = Math.max(f.y1, b.y1),
  x2 = Math.min(f.x2, b.x2), y2 = Math.min(f.y2, b.y2);
  if (x2 <= x1 || y2 <= y1) return 0; const a = (f.x2 - f.x1) * (f.y2 - f.y1);
  return a > 0 ? ((x2 - x1) * (y2 - y1)) / a : 0; };
const tally = {};
for (const f of fs.readdirSync(`${ROOT}/bank/reads`).filter((x) => x.endsWith('.json'))) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${f}`, 'utf8'));
  for (const fr of replay(win, 'man')) for (const face of fr.faces) {
    const lab = cropLabel.get(face.crop); if (lab !== 'man') continue;
    const id = cropCluster.get(face.crop);
    const t = (tally[id] = tally[id] || { covered: 0, sharp: 0 });
    (Math.max(0, ...fr.patches.map((p) => ov(face, p))) >= 0.15) ? t.covered++ : t.sharp++;
  }
}
console.log('MEN, by subject          covered/total   % wrongly blurred');
for (const [id, t] of Object.entries(tally).sort((a, b) => b[1].covered - a[1].covered)) {
  const n = t.covered + t.sharp;
  console.log(`  ${id.padEnd(20)} ${String(t.covered).padStart(4)}/${String(n).padStart(4)}      ${(100 * t.covered / n).toFixed(0)}%`);
}
