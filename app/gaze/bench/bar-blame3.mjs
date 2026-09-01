// Her whole shot, read by read: what did the low bar clear her ON?
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';
import { isNullRead } from './.cache/shipped.mjs';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
console.log('  t      label   gender  score   raw    nm    age   null adult   >=.45? >=.60?');
for (const win of wins) {
  if (win.vid !== 'z86LGEFyQpo') continue;
  win.frames.forEach((fr, i) => {
    if (fr.t < 48 || fr.t > 59) return;
    if (i % 3 !== 0) return;                  // verdict frames only
    fr.faces.forEach((f) => {
      const lab = cropLabel.get(f.crop);
      if (lab !== 'woman') return;
      const same = f.gender === 'male';       // man mode
      console.log(`  ${f && String(fr.t.toFixed(1)).padStart(5)}  ${String(lab).padEnd(6)}  ` +
        `${String(f.gender).padEnd(7)} ${f.score.toFixed(2)}  ${f.raw.toFixed(3)}  ` +
        `${f.nm.toFixed(1).padStart(5)}  ${f.age.toFixed(0).padStart(4)}  ` +
        `${isNullRead(f) ? ' Y' : ' .'}   ${f.age >= 18 ? 'Y' : '.'}      ` +
        `${same && f.score >= 0.45 ? 'CLEAR' : '  .  '}  ${same && f.score >= 0.60 ? 'CLEAR' : '  .  '}`);
    });
  });
}
