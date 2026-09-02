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
// So sweep the CONSTANT. At the cadence his device TELLS the tracker --
// `HIS_EFFZOOM` 2000, which is what this file now defaults to. An
// earlier version of this header worked the arithmetic at 1500, his
// ACHIEVED gap, which is a different number and the regime 15a
// retracted (phase-D D8):
//
//     cap   = max(PTRACK_MAX_COAST_MS 2000, PASSES * 2000)
//     blur  = min(cap, max(900,  5000))   -> the cap binds below 2.5
//     clear = min(cap, max(1000, 5000))   -> the cap binds below 2.5
//     cut   = min(cap, max(400,  2000))   -> 2000 throughout
//
// which makes `PTRACK_MIN_COAST_PASSES` the whole dial over the shipped
// range, and floors the coast at PTRACK_MAX_COAST_MS whatever is pushed.
//
// THAT ms FLOOR IS THE PROTECTION PROPERTY -- not the OTA clamp's
// `passes >= 1.33`, which only adds anything above told 1504 and is
// decoration at 1200 or 1500 (phase-D D1). Do not read the paragraph
// above as support for the clamp floor: it supports
// PTRACK_MAX_COAST_MS, which is a different guarantee and the one that
// actually holds at every cadence. See src/tuning.mjs.
//
// Usage: node bench/coast-ab.mjs [passes,...]
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms, HIS_EFFZOOM, K_HIS, thinFrames, hisRegimeOpts } from './arch-arms.mjs';
import { patchConsts, readConst } from './_patch.mjs';

const g = process.env.GENDER || 'man';
const K = Number(process.env.K || K_HIS);
const PASSES = (process.argv[2] || '1.0,1.33,1.5,2,3').split(',').map(Number);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);

const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
const SHIPPED = readConst(src, 'PTRACK_MIN_COAST_PASSES');
const MAXCOAST = readConst(src, 'PTRACK_MAX_COAST_MS');
// TOLD IS NOT THE ARRIVAL GAP ON HIS DEVICE, and this dial lives inside
// the function that consumes it -- so sweeping it in the wrong regime
// prices the wrong window. k=3 is when verdicts ARRIVE for him; 2000 is
// what his effZoom HANDS the tracker. See HIS_EFFZOOM.
const TOLD = Number(process.env.TOLD || HIS_EFFZOOM);
// SHARED, not restated -- see arch-arms.hisRegimeOpts and phase-D D5.
const OPTS = hisRegimeOpts(g, TOLD);

console.log(`gender=${g}  ${wins.length} windows  k=${K} (${(K * 0.5).toFixed(1)}s/verdict)`);
console.log(`shipped PTRACK_MIN_COAST_PASSES ${SHIPPED}   PTRACK_MAX_COAST_MS ${MAXCOAST}`);
console.log(`cadence TOLD to the tracker ${TOLD}ms (his effZoom; override with TOLD=)`);
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
    const s = score(arm(thinFrames(win, K), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  const L = globalThis.__TS_GAZE_IDS.life;
  const births = (L.birthCleared || 0) + (L.birthBlurred || 0);
  // What the constant actually produces at this cadence, printed rather
  // than asserted -- the cap floors it and that is the point.
  const ms = TOLD;
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
