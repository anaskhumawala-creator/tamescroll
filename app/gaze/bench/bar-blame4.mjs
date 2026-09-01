// Where do the two arms first diverge on this shot, and what is in the
// frame when they do?
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
const g = 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const A = makeArms(await import('./.cache/shipped.mjs'))({ hold: true });
const B = makeArms(await import('./.cache/lowbar.mjs'))({ hold: true });
const thin = (w, n) => ({ ...w, frames: w.frames.map((fr, i) => (i % n === 0 ? fr
  : { ...fr, faces: [], _labelFaces: fr.faces })) });
for (const win of wins) {
  if (win.vid !== 'z86LGEFyQpo') continue;
  const t = thin(win, 3), a = A(t, g), b = B(t, g);
  console.log(`window ${win.vid} t0=${win.frames[0].t.toFixed(1)} frames=${win.frames.length}\n`);
  console.log('    t    rd  faces (label/gender/score/nm)                       A  B');
  a.forEach((fa, i) => {
    const read = t.frames[i].faces.length > 0;
    const desc = fa.faces.map((f) => `${String(cropLabel.get(f.crop) || '?').slice(0,5)}/` +
      `${String(f.gender)[0]}${f.score.toFixed(2)}/n${f.nm.toFixed(0)}`).join(' ');
    const mark = fa.patches.length !== b[i].patches.length ? '  <<<' : '';
    console.log(`  ${fa.t.toFixed(1).padStart(5)}  ${read ? 'R' : '.'}  ${desc.padEnd(50)} ` +
      `${fa.patches.length}  ${b[i].patches.length}${mark}`);
  });
}
