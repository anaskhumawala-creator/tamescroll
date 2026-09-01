// A CUT DOES TWO DIFFERENT THINGS, AND 10m CHARGED CUT_DELTA FOR BOTH.
//
// The shipped handler DEMOTES (association hygiene: a stale cleared
// track must not absorb the next shot's stranger) and FORCES A VERDICT
// (`lastSample = 0; lastZoomAt = 0`, so the next pass re-reads gender).
// Those are different goods bought with one constant, and the sweep in
// 10m cannot tell them apart: lowering CUT_DELTA buys BOTH more
// demotions and more verdicts, and "exposure falls" is consistent with
// either.
//
// IT MATTERS BECAUSE THE TWO HAVE DIFFERENT PRICES ON HIS PHONE. A
// demotion is free -- it is arithmetic on a list. A forced verdict is
// ~730-1250ms of GPU (12a), and it is the same good that
// VERDICT_MAX_INTERVAL_MS buys directly and much more cheaply, since
// that one does not also re-cover every cleared man in frame.
//
// AND IT EXPLAINS A DISCREPANCY NOBODY HAD RECONCILED. 12a measured
// `effZoom = min(2000, cost * 4) = 2000ms` on his Redmi, yet the same
// window shows 58 verdicts in 90s = **1.55s** per verdict. The gap is
// forced passes: cuts drag the next verdict forward, so his OBSERVED
// cadence is faster than his nominal one, and the scene gate has been
// acting as an unpriced cadence mechanism the whole time.
//
// THE ARMS, and what each difference isolates:
//
//   1 OFF              no gate at all
//   2 RANDOM PASS      N forced verdicts at deterministic-random frames
//   3 CUT PASS         the same N, at the REAL cut frames
//   4 CUT DEMOTE       demotion at the real cuts, no forced verdict
//   5 SHIPPED          both
//
//   2 - 1  = what N extra verdicts are worth ANYWHERE
//   3 - 2  = what putting them AT cuts is worth (timing, not count)
//   4 - 1  = what demotion alone is worth
//   5 - 3  = what demotion adds on top of the forced verdict
//
// N is matched PER WINDOW, not in total: cuts cluster in fast-cut
// footage, and a global count would hand the control's extra verdicts
// to windows that never earned them.
//
// Usage: node bench/cut-vs-random.mjs [CUT_DELTA]
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms, setCutBank } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const DELTA = Number(process.argv[2] || 60);
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

let path = `${ROOT}/bank/cuts-${DELTA}.json`;
if (!fs.existsSync(path)) {
  const d = `${ROOT}/bank/cuts.json`;
  const stamp = fs.existsSync(d)
    && (JSON.parse(fs.readFileSync(d, 'utf8')).__meta || {}).CUT_DELTA;
  if (stamp === DELTA) path = d;
  else throw new Error(`no bank for ${DELTA} -- run: node bench/corpus-cuts.mjs ${DELTA}`);
}
setCutBank(path, DELTA);
const wins = winFiles().map(loadWin);

const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

// DETERMINISTIC, because Math.random would make this unreproducible and
// a control nobody can re-run is not a control. One LCG per window,
// seeded by the window's own index, drawing WITHOUT replacement so the
// count matches exactly rather than in expectation.
function scatter(win, wi) {
  const n = (win.cuts || []).filter(Boolean).length;
  const len = win.frames.length;
  const cuts = new Array(len).fill(false);
  let seed = (wi + 1) * 2654435761 >>> 0;
  const pool = [];
  // Frame 0 is excluded: a forced verdict there is what every arm
  // already gets on its first frame, so seeding one would be free.
  for (let i = 1; i < len; i++) pool.push(i);
  for (let k = 0; k < n && pool.length; k++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    cuts[pool.splice(seed % pool.length, 1)[0]] = true;
  }
  return { ...win, cuts };
}

const ARMS = [
  ['1 OFF            ', { cut: false }],
  ['2 RANDOM PASS    ', { cut: true, cutNoDemote: true, scatter: true }],
  ['3 CUT PASS       ', { cut: true, cutNoDemote: true }],
  ['4 CUT DEMOTE     ', { cut: true, cutNoPass: true }],
  ['5 SHIPPED        ', { cut: true }],
];

const cutFrames = wins.reduce((a, w) => a + (w.cuts || []).filter(Boolean).length, 0);
console.log(`gender=${g}  k=3 (his 1.5s)  CUT_DELTA ${DELTA}  `
  + `${wins.length} windows  ${cutFrames} cut frames`);
console.log('');
console.log('arm                EXPOSURE  FALSECOVER   PHANTOM   births');

const mod = await import('./.cache/shipped.mjs');
const rows = {};
for (const [name, opt] of ARMS) {
  const arm = makeArms(mod)({ hold: true, clampPad: 0.02, ...opt });
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  globalThis.__TS_GAZE_IDS = { life: {} };
  wins.forEach((w, wi) => {
    const src = opt.scatter ? scatter(w, wi) : w;
    const s = score(arm(thin(src, 3), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  });
  const L = globalThis.__TS_GAZE_IDS.life;
  const births = (L.birthCleared || 0) + (L.birthBlurred || 0);
  rows[name.trim().slice(0, 1)] = agg;
  console.log(name + (agg.exposureS.toFixed(1) + 's').padStart(8)
    + (agg.falseCoverS.toFixed(1) + 's').padStart(12)
    + (agg.phantomS.toFixed(1) + 's').padStart(10)
    + String(births).padStart(9));
}
delete globalThis.__TS_GAZE_IDS;

const d = (a, b, k) => (rows[a][k] - rows[b][k]).toFixed(1) + 's';
console.log('');
console.log('what each difference isolates      EXPOSURE  FALSECOVER   PHANTOM');
for (const [label, a, b] of [
  ['N verdicts ANYWHERE   (2-1)', '2', '1'],
  ['...placed AT cuts     (3-2)', '3', '2'],
  ['demotion alone        (4-1)', '4', '1'],
  ['demotion on top       (5-3)', '5', '3'],
]) {
  console.log(label.padEnd(35) + d(a, b, 'exposureS').padStart(7)
    + d(a, b, 'falseCoverS').padStart(12) + d(a, b, 'phantomS').padStart(10));
}
