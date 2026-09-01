// The five frames from bar-blame, opened up: every face in the frame,
// its label, its read, and the tracks both arms hold. If a cleared
// neighbour is absorbing her, it shows here and nowhere else.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const LOW = makeArms(await import('./.cache/lowbar.mjs'));
const a = ARM({ hold: true }), b = LOW({ hold: true });
const thin = (w, n) => ({ ...w, frames: w.frames.map((fr, i) => (i % n === 0 ? fr
  : { ...fr, faces: [], _labelFaces: fr.faces })) });
const TARGET = { RcGyVTAoXEU: [96.5, 97.0], z86LGEFyQpo: [57.5, 58.0, 58.5] };
const bx = (o) => `[${o.x1.toFixed(2)},${o.x2.toFixed(2)}]`;
for (const win of wins) {
  const want = TARGET[win.vid]; if (!want) continue;
  const t = thin(win, 3), A = a(t, g), B = b(t, g);
  A.forEach((fa, i) => {
    if (!want.some((x) => Math.abs(fa.t - x) < 0.01)) return;
    console.log(`\n=== ${win.vid} t=${fa.t.toFixed(1)} ===`);
    fa.faces.forEach((f) => console.log(
      `  face ${bx(f)}  ${String(cropLabel.get(f.crop)).padEnd(9)} ` +
      `${String(f.gender).padEnd(7)} s=${f.score.toFixed(2)} nm=${f.nm.toFixed(1)}`));
    console.log(`  CONTROL patches: ${fa.patches.map(bx).join(' ') || '(none)'}`);
    console.log(`  LOWBAR  patches: ${B[i].patches.map(bx).join(' ') || '(none)'}`);
  });
}
