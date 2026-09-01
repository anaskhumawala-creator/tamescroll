// HOW MUCH OF THE FALSE COVER IS JUST THE CLOCK?
//
// Clearing a man takes CLEAR_STREAK_N = 2 verdicts, so at his measured
// 1.5s per verdict the FLOOR on his blur after any track birth is 3
// seconds, whatever the model says. Before spending more effort on
// thresholds it is worth knowing how much of the 216.5s is that floor
// rather than a decision.
//
// `every` is the corpus frame stride: the bench banks a read every 0.5s,
// so 3 = 1.5s per verdict (his regime, every number this session is
// quoted in), 2 = 1.0s, 1 = 0.5s.
//
// This is NOT a proposal to raise the cadence -- that is a GPU cost on
// his phone and loop 35 measured what buying passes costs the frame
// rate. It is a measurement of the ceiling any threshold work is
// competing against.
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);
const thin = (win, e) => ({ ...win, frames: win.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const arm = ARM({ hold: true, clampPad: 0.02, cut: true, inertNoSignal: true,
  memSignal: true, mem: g === 'man' ? 'loose2' : 'loose' });
console.log(`gender=${g}   windows ${wins.length}${process.env.PXBAND ? '   PXBAND ' + process.env.PXBAND : ''}`);

// THE COAST RIDES THE CLOCK, and §13a read one table as two claims.
//
// `person-track.setVerdictCadence(ms)` sets `blurredCoastMs` and
// `clearedCoastMs` from the number it is handed, so thinning to k also
// shortens the coast: k=4 coasts 4000ms, k=1 coasts 1250ms. Every row
// of a plain cadence sweep therefore moves TWO variables, and the
// conclusion "every column improves as the clock speeds up, so there is
// no trade on this dial" was reading the coast and calling it the clock.
//
// BOTH FAMILIES ARE PRINTED, because both are true of different
// questions:
//
//   DIAL   the diagonal. On a device `effZoom` feeds setVerdictCadence,
//          so lowering VERDICT_MAX_INTERVAL_MS really does shorten the
//          coast alongside. This is the honest model of moving that one
//          constant -- and it is NOT a decomposition.
//   CLOCK  the coast pinned at the k=3 control's 1500ms while the
//          verdict frames are thinned as before. This is the only way to
//          ask what more verdicts alone are worth.
//
// AND THE TWO DISAGREE ON THE COLUMN HE CARES ABOUT MOST. §10n measured
// independently that verdict COUNT drives phantom; the CLOCK family
// agrees with it and the DIAL family appears to contradict it, because
// the shorter coast is paying the phantom back.
const CONTROL_MS = 1500;   // k=3, his measured regime
const ROWS = [['2.0s', 4], ['1.5s (his regime)', 3], ['1.0s', 2], ['0.5s', 1]];

function run(every, fixedCadence) {
  const arm = ARM({ hold: true, clampPad: 0.02, cut: true, inertNoSignal: true,
    memSignal: true, mem: g === 'man' ? 'loose2' : 'loose',
    ...(fixedCadence ? { fixedCadence } : {}) });
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of wins) {
    const s = score(arm(thin(win, every), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  return agg;
}
const row = (name, coast, a) => console.log(name.padEnd(21)
  + String(coast).padStart(7)
  + (a.exposureS.toFixed(1) + 's').padStart(10)
  + (a.falseCoverS.toFixed(1) + 's').padStart(12)
  + (a.phantomS.toFixed(1) + 's').padStart(10));

// blurredCoastMs as person-track computes it, so the table can show the
// variable that was riding along instead of leaving it to be inferred.
const coastOf = (ms) => Math.min(Math.max(2000, Math.round(2 * ms)),
  Math.max(900, Math.round(2.5 * ms)));

console.log('');
console.log('DIAL -- the honest model of VERDICT_MAX_INTERVAL_MS (clock AND coast move)');
console.log('verdict cadence       coast   EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, every] of ROWS) row(name, coastOf(500 * every), run(every, 0));

console.log('');
console.log('CLOCK -- coast PINNED at the k=3 control, only the verdict count varies');
console.log('verdict cadence       coast   EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, every] of ROWS) row(name, coastOf(CONTROL_MS), run(every, CONTROL_MS));

// REACHABILITY, because a table row nobody can buy is not a lever.
// tuning.mjs clamps VERDICT_MAX_INTERVAL_MS to [1200, 4000].
// COAST -- the lever the confound was hiding. Verdict COUNT pinned at
// k=3 (his regime, no extra GPU at all), coast varied on its own. If
// this column moves, the phantom the DIAL family appeared to buy was
// never bought with verdicts and does not have to be paid for with
// them.
console.log('');
console.log('COAST -- verdict count PINNED at k=3, only the coast window varies');
console.log('blurredCoast          told   EXPOSURE  FALSECOVER   PHANTOM');
for (const told of [400, 600, 1000, 1500, 2000]) {
  row(`${coastOf(told)}ms`, told, run(3, told));
}

console.log('');
console.log('OTA clamp on VERDICT_MAX_INTERVAL_MS is [1200, 4000]: the 1.0s and');
console.log('0.5s rows are UNREACHABLE by that constant, whatever they say.');
