// THE COAST DIAL, MEASURED AS THE CONSTANT AN OTA PUSH WOULD ACTUALLY
// MOVE -- not as a side effect of lying to the tracker about the clock.
//
// §15 found the coast window is the biggest lever in the system and
// costs no GPU, by pinning the verdict count at k=3 and varying the
// cadence handed to `setVerdictCadence`. That is a decomposition, not a
// shippable dial: the same call also sets `cutCoastMs = min(cap,
// max(400, ms))`, so the "2000ms coast" row there ran with a 1000ms cut
// coast while a real OTA push would leave it at 1500. The rows do not
// transfer and must not be quoted as if they do.
//
// So sweep the CONSTANT. At his measured 1500ms cadence:
//
//     cap   = max(PTRACK_MAX_COAST_MS 2000, PASSES * 1500)
//     blur  = min(cap, max(900,  3750))   -> the cap binds
//     clear = min(cap, max(1000, 3750))   -> the cap binds
//     cut   = min(cap, max(400,  1500))   -> 1500 throughout
//
// which makes `PTRACK_MIN_COAST_PASSES` the whole dial, and floors it at
// 2000ms whatever is pushed -- the OTA channel cannot drive the coast
// below what the code already treats as the minimum cap, and therefore
// cannot reach the 50.0s-exposure end of the §15 table. That floor is a
// protection property, not a convenience.
//
// Usage: node bench/coast-ab.mjs [passes,...]
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
import { patchConsts, readConst } from './_patch.mjs';

const g = process.env.GENDER || 'man';
const K = Number(process.env.K || 3);
const PASSES = (process.argv[2] || '1.0,1.33,1.5,2,3').split(',').map(Number);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);
const thin = (win, e) => ({ ...win, frames: win.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
const SHIPPED = readConst(src, 'PTRACK_MIN_COAST_PASSES');
const MAXCOAST = readConst(src, 'PTRACK_MAX_COAST_MS');
const OPTS = { hold: true, clampPad: 0.02, cut: true, inertNoSignal: true,
  memSignal: true, mem: g === 'man' ? 'loose2' : 'loose' };

console.log(`gender=${g}  ${wins.length} windows  k=${K} (${(K * 0.5).toFixed(1)}s/verdict)`);
console.log(`shipped PTRACK_MIN_COAST_PASSES ${SHIPPED}   PTRACK_MAX_COAST_MS ${MAXCOAST}`);
console.log('');
console.log('passes   coast   EXPOSURE  FALSECOVER   PHANTOM  births');

for (const passes of PASSES) {
  // A variant per point, imported under its own cache-busting specifier.
  const p = new URL(`./.cache/coast-${passes}.mjs`, import.meta.url);
  fs.writeFileSync(p, patchConsts(src, { PTRACK_MIN_COAST_PASSES: passes }));
  const mod = await import(p.href + '?v=' + passes);
  const arm = makeArms(mod)(OPTS);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  globalThis.__TS_GAZE_IDS = { life: {} };
  for (const win of wins) {
    const s = score(arm(thin(win, K), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  const L = globalThis.__TS_GAZE_IDS.life;
  const births = (L.birthCleared || 0) + (L.birthBlurred || 0);
  // What the constant actually produces at this cadence, printed rather
  // than asserted -- the cap floors it and that is the point.
  const ms = K * 500;
  const coast = Math.min(Math.max(MAXCOAST, Math.round(passes * ms)),
    Math.max(900, Math.round(2.5 * ms)));
  console.log(String(passes).padEnd(8) + (coast + 'ms').padStart(6)
    + (agg.exposureS.toFixed(1) + 's').padStart(11)
    + (agg.falseCoverS.toFixed(1) + 's').padStart(12)
    + (agg.phantomS.toFixed(1) + 's').padStart(10)
    + String(births).padStart(7)
    + (passes === SHIPPED ? '   <- SHIPPED' : ''));
}
delete globalThis.__TS_GAZE_IDS;
