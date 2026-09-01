// CRITIC SCRATCH: birth-ab re-run against an explicit cut bank.
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
const which = process.argv[2] || '60';
const A = await import(`./_critic-arch${which}.mjs`);
const { loadWin, makeArms } = A;
const g = process.env.GENDER || 'man';
const src = fs.readFileSync('./.cache/shipped.mjs', 'utf8');
const m = /(function bornCleared\([A-Za-z0-9_$]+\)\s*\{[\s\S]*?var\s+[A-Za-z0-9_$]+\s*=\s*)(!!\()/.exec(src);
if (!m) throw new Error('bornCleared not found');
fs.writeFileSync('./.cache/preBirthCritic.mjs', src.replace(m[0], m[1] + 'false && ('));
const OLD = await import('./.cache/preBirthCritic.mjs');
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m2 of c.members) cropLabel.set(m2.crop, labels[c.id]);
const wins = winFiles().map(loadWin);
const cutFrames = wins.reduce((a, w) => a + (w.cuts || []).filter(Boolean).length, 0);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const NEWARM = makeArms(await import('./.cache/shipped.mjs'));
const OLDARM = makeArms(OLD);
const OPTS = { hold: true, clampPad: 0.02, cut: true };
console.log(`bank=${which}  gender=${g}  windows=${wins.length}  cutFrames=${cutFrames}`);
for (const k of [3]) {
  const row = (name, arm) => {
    let e = 0, fc = 0, ph = 0;
    globalThis.__TS_GAZE_IDS = { life: {} };
    for (const w of wins) { const s = score(arm(thin(w, k), g), g, (c) => cropLabel.get(c));
      e += s.exposureS; fc += s.falseCoverS; ph += s.phantomS; }
    const L = globalThis.__TS_GAZE_IDS.life;
    console.log(`  ${name.padEnd(22)} exposure ${e.toFixed(1).padStart(7)}s  falseCover ${fc.toFixed(1).padStart(7)}s  phantom ${ph.toFixed(1).padStart(7)}s  births ${(L.birthCleared||0)+(L.birthBlurred||0)}  cleared ${L.birthCleared||0}`);
    return [e, fc, ph];
  };
  console.log(`k=${k} (${(k*0.5).toFixed(1)}s per verdict)`);
  const a = row('BEFORE (born blurred)', OLDARM(OPTS));
  const b = row('AFTER  (birth rung)', NEWARM(OPTS));
  console.log(`  delta                  exposure ${(b[0]-a[0]).toFixed(1)}s  falseCover ${(b[1]-a[1]).toFixed(1)}s  phantom ${(b[2]-a[2]).toFixed(1)}s`);
}
delete globalThis.__TS_GAZE_IDS;
