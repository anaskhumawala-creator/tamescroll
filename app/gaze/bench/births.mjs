// E5 -- WHAT KIND OF BIRTH IS THE CHURN?
//
// churn.mjs measured the effect: the id covering ONE labelled man
// changes 260 times over 479 frames, median run ONE FRAME. It could not
// say WHY, and the two answers need opposite fixes:
//
//   birthFresh       no previous track overlapped this observation AT
//                    ALL. The tracker was handed a box that appeared
//                    from nowhere -- a detector/geometry problem, and
//                    no association threshold can touch it.
//   birthNearMiss    a track DID overlap, but under PTRACK_IOU_MIN.
//                    An association-THRESHOLD problem, and the cheapest
//                    fix in the repo.
//   birthContended   overlapped enough, and lost the assignment to
//                    another observation. An assignment problem.
//   birthSizeRejected  overlapped enough and was refused on size.
//
// The counters have existed since loop 25 and have never been read. They
// bump into globalThis.__TS_GAZE_IDS.life, so this costs NO new
// instrumentation -- which is the point: an instrument written for the
// question it answers is an instrument that can be written to agree.
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
const S = await import('./.cache/shipped.mjs');

// A CUT WIPES EVERY TRACK, so every observation after one is birthFresh
// BY CONSTRUCTION. Reporting the cut arm alone would attribute the
// tracker's churn to geometry when the scene gate caused it. Both arms
// run; the difference is the honest number.
const armCut = makeArms(S)({ hold: true, clampPad: 0.02, cut: true });
const armNoCut = makeArms(S)({ hold: true, clampPad: 0.02, cut: false });
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

const KEYS = ['birthFresh', 'birthNearMiss', 'birthContended', 'birthSizeRejected',
  'coastExpired', 'nullDropped', 'nullMintedHeld', 'birthClaimed'];
const total = Object.fromEntries(KEYS.map((k) => [k, 0]));
const totalNC = Object.fromEntries(KEYS.map((k) => [k, 0]));
const rows = [];
const mode = process.argv[2] || 'man';
let cuts = 0;

for (const f of winFiles()) {
  const w = thin(loadWin(f), 3);
  cuts += w.cuts ? w.cuts.filter(Boolean).length : 0;
  globalThis.__TS_GAZE_IDS = { life: {} };
  const out = armCut(w, mode);
  const life = globalThis.__TS_GAZE_IDS.life;
  const row = { win: f.replace(/\.json$/, ''), frames: out.length };
  for (const k of KEYS) { row[k] = life[k] || 0; total[k] += row[k]; }
  globalThis.__TS_GAZE_IDS = { life: {} };
  armNoCut(thin(loadWin(f), 3), mode);
  const nc = globalThis.__TS_GAZE_IDS.life;
  for (const k of KEYS) { row['nc_' + k] = nc[k] || 0; totalNC[k] += nc[k] || 0; }
  rows.push(row);
}
delete globalThis.__TS_GAZE_IDS;

const births = total.birthFresh + total.birthNearMiss + total.birthContended
  + total.birthSizeRejected;
console.log(`${rows.length} windows, mode ${mode}, ${rows.reduce((a, r) => a + r.frames, 0)} frames`);
console.log(`BIRTHS ${births}`);
for (const k of ['birthFresh', 'birthNearMiss', 'birthContended', 'birthSizeRejected'])
  console.log(`  ${k.padEnd(18)} ${String(total[k]).padStart(5)}` +
    `  ${births ? (100 * total[k] / births).toFixed(1) : '0.0'}%`);
console.log(`deaths  coastExpired ${total.coastExpired}`);
console.log(`null    dropped ${total.nullDropped}  mintedHeld ${total.nullMintedHeld}`);
const bNC = totalNC.birthFresh + totalNC.birthNearMiss + totalNC.birthContended
  + totalNC.birthSizeRejected;
console.log('');
console.log(`CUTS ${cuts} across the corpus. The cut arm wipes every track, so`);
console.log('the SAME arm with the gate off bounds how much of birthFresh is geometry:');
console.log(`  cut ON   births ${births}  fresh ${total.birthFresh}` +
  `  nearMiss ${total.birthNearMiss}  contend ${total.birthContended}`);
console.log(`  cut OFF  births ${bNC}  fresh ${totalNC.birthFresh}` +
  `  nearMiss ${totalNC.birthNearMiss}  contend ${totalNC.birthContended}`);
console.log('');
console.log('win'.padEnd(26) + 'fresh nearMiss contend  size  coastExp');
for (const r of rows.sort((a, b) => b.birthFresh + b.birthNearMiss - a.birthFresh - a.birthNearMiss))
  console.log(r.win.slice(0, 25).padEnd(26)
    + String(r.birthFresh).padStart(5) + String(r.birthNearMiss).padStart(9)
    + String(r.birthContended).padStart(8) + String(r.birthSizeRejected).padStart(6)
    + String(r.coastExpired).padStart(10));
