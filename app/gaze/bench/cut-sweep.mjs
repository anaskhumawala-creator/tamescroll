// THE CUT GATE IS THE LARGEST NAMED CAUSE OF TRACK CHURN, AND IT IS A
// DIAL ON THE OTA CHANNEL.
//
// E5: 89 of 310 births (28.7%) exist only because the gate wiped the
// tracks. Loop 40 already moved CUT_DELTA 28 -> 50 after measuring that
// 28 sat on the p90 of ORDINARY CAMERA MOTION in his footage. The
// question this answers is whether 50 is still under it.
//
// Loop 40 recorded "CUT_DELTA cannot be swept on the corpus at all"
// because bank/cuts.json holds BOOLEANS. That was true of the BANK and
// never of the corpus -- the deltas come from the video, so the bank can
// be re-derived per value (`corpus-cuts.mjs <delta> <out>`), which is
// what this reads.
//
// BOTH DIRECTIONS ARE REAL. Raising it keeps a cleared man cleared
// across ordinary motion (fewer births, less false cover). It also keeps
// a STALE CLEARED TRACK alive across a genuine shot change, which is the
// mechanism bar-blame traced this corpus's single biggest exposure to: a
// woman's observation re-associating onto a track a man left behind.
// EXPOSURE is the check, and it is the column that decides.
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms, setCutBank, K_HIS, thinFrames, hisRegimeOpts, HIS_EFFZOOM } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
// WHICH CUT HANDLER. `demote` is what the app ships and is the default;
// `wipe` reproduces the pre-2026-09-02 arm, whose manufactured post-cut
// exposure gap scaled with the very axis this file sweeps. A table from
// one may never be compared to a table from the other, so the header
// below STATES which one produced it -- a derivative that does not
// declare itself is how 10k's retracted numbers travelled.
// `full` is the whole shipped handler: demote AND the forced verdict
// pass. `demote` is that minus the forced pass, which is the residue
// that made a cut look more expensive than it is. `wipe` reproduces the
// pre-2026-09-02 arm and is kept only to re-derive retracted numbers.
const MODELS = { full: 1, demote: 1, wipe: 1 };
const CUT_MODEL = process.env.CUT_MODEL || 'full';
if (!MODELS[CUT_MODEL]) {
  throw new Error(`CUT_MODEL must be full|demote|wipe, got ${CUT_MODEL}`);
}
// D2: this carried three options where hisRegimeOpts carries seven, and
// without `fixedCadence` the tracker was told the 500ms BANK interval and
// coasted 1250ms instead of his cap-pinned 2000/4000. findings 10f is
// re-derived on the corrected regime.
const K = Number(process.env.K || K_HIS);
const TOLD = Number(process.env.TOLD || HIS_EFFZOOM);
const O = { ...hisRegimeOpts(g, TOLD),
  cutWipe: CUT_MODEL === 'wipe',
  cutNoPass: CUT_MODEL !== 'full' };

console.log(`gender=${g}  k=${K} (${(K * 0.5).toFixed(1)}s/verdict)  told ${TOLD}ms  cut handler=${CUT_MODEL}`
  + (CUT_MODEL === 'full' ? '  (shipped: demote + forced pass)'
    : CUT_MODEL === 'demote' ? '  (demote only -- overstates what a cut costs)'
    : '  <-- NOT WHAT THE APP DOES'));
console.log('');
console.log('CUT_DELTA  cutFrames  EXPOSURE  FALSECOVER   PHANTOM   births  cleared');
for (const v of [35, 40, 50, 60, 75, 90]) {
  // STAMP-DRIVEN, NEVER HARDCODED. This read `v === 50 ? cuts.json : ...`,
  // which silently encoded "the default bank holds 50" -- and the moment
  // the shipped constant moved to 60 the sweep asked cuts.json for 50 and
  // died. Same class as every other staleness this file guards against:
  // an assumption about a derivative that the derivative itself can state.
  let path = `${ROOT}/bank/cuts-${v}.json`;
  if (!fs.existsSync(path)) {
    const d = `${ROOT}/bank/cuts.json`;
    const stamp = fs.existsSync(d)
      && (JSON.parse(fs.readFileSync(d, 'utf8')).__meta || {}).CUT_DELTA;
    if (stamp === v) path = d;
    else { console.log(`${String(v).padEnd(11)} -- no bank, run: node bench/corpus-cuts.mjs ${v}`); continue; }
  }
  // The bank is swapped, not the constant: the replay wipes on
  // win.cuts[fi] and never reads a module's CUT_DELTA.
  setCutBank(path, v);
  const wins = winFiles().map(loadWin);
  const cutFrames = wins.reduce((a, w) => a + (w.cuts || []).filter(Boolean).length, 0);
  const arm = makeArms(await import('./.cache/shipped.mjs'))(O);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  globalThis.__TS_GAZE_IDS = { life: {} };
  for (const w of wins) {
    const s = score(arm(thinFrames(w, K), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  const L = globalThis.__TS_GAZE_IDS.life;
  console.log(String(v).padEnd(11) + String(cutFrames).padStart(9)
    + (agg.exposureS.toFixed(1) + 's').padStart(10)
    + (agg.falseCoverS.toFixed(1) + 's').padStart(12)
    + (agg.phantomS.toFixed(1) + 's').padStart(10)
    + String((L.birthCleared || 0) + (L.birthBlurred || 0)).padStart(9)
    + String(L.birthCleared || 0).padStart(9));
}
delete globalThis.__TS_GAZE_IDS;
