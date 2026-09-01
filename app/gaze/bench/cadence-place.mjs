// SAME NUMBER OF VERDICTS, SPENT WHERE THE PICTURE MOVED.
//
// 10n measured that 59 forced verdicts placed at cuts cost 14.5-15.5s
// LESS phantom than the same 59 scattered at random, in both gender
// arms. That is a statement about PLACEMENT at fixed cost, and it is the
// only cadence lever that does not also spend more GPU -- which matters
// because 10n's other surviving finding is that verdict COUNT is what
// drives phantom, his loudest complaint.
//
// So: hold the verdict budget exactly, and choose the frames.
//
// THE POLICY IS CAUSAL, and that is the whole difficulty. A "top-N by
// delta" arm would be an oracle -- it needs the whole window before it
// can pick -- and would prove nothing shippable. This is the rule the
// app could actually run, using only the delta the gate has ALREADY
// computed by the time it decides:
//
//     verdict at k  if  (k - last >= MAXGAP)                  starvation
//                   or  (peak[k] >= T and k - last >= MINGAP)  motion
//
// MAXGAP is the safety half: a static shot must still be re-read, or a
// person walking into an unchanging frame waits forever. MINGAP is the
// app's own ZOOM_INTERVAL_MS floor (400ms, ~1 banked frame).
//
// T IS SOLVED FOR, NOT CHOSEN. It is bisected until the arm spends the
// SAME total verdicts as uniform k=3 across the whole corpus, so the
// comparison is placement against placement and never budget against
// budget. A threshold picked by hand would let the arm win by simply
// doing more work, which is the mistake this file exists to avoid.
//
// Usage: node bench/cadence-place.mjs [MAXGAP]   (frames; 1 frame = 0.5s)
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const GAPS = (process.argv[2] || '4,5,6,8').split(',').map(Number);
const MINGAP = 1;
const K = 3;

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const dPath = `${ROOT}/bank/deltas.json`;
if (!fs.existsSync(dPath)) {
  throw new Error('no bank/deltas.json -- run: node bench/corpus-cuts.mjs');
}
const PEAK = JSON.parse(fs.readFileSync(dPath, 'utf8'));
const wins = winFiles().map(loadWin);

// The tag a window is banked under; deltas.json is keyed the same way.
const tagOf = (w) => w.tag || w.name || w.id;
for (const w of wins) {
  if (!PEAK[tagOf(w)]) throw new Error(`deltas.json has no entry for ${tagOf(w)}`);
}

// UNIFORM is the control and it defines the budget.
const uniformSet = (w) => {
  const s = new Set();
  for (let i = 0; i < w.frames.length; i += K) s.add(i);
  return s;
};
const BUDGET = wins.reduce((a, w) => a + uniformSet(w).size, 0);

function placedSet(w, T, MAXGAP) {
  const peak = PEAK[tagOf(w)];
  const s = new Set([0]);
  let last = 0;
  for (let i = 1; i < w.frames.length; i++) {
    const starved = i - last >= MAXGAP;
    const moved = peak[i] >= T && i - last >= MINGAP;
    if (starved || moved) { s.add(i); last = i; }
  }
  return s;
}

// Bisect T so the arm spends the uniform budget. Monotone: raising T can
// only remove motion-triggered verdicts, never add one.
function solveT(MAXGAP) {
  let lo = 0, hi = 1000;
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    const n = wins.reduce((a, w) => a + placedSet(w, mid, MAXGAP).size, 0);
    if (n > BUDGET) lo = mid; else hi = mid;
  }
  return hi;
}

const thinTo = (w, set) => ({ ...w, frames: w.frames.map((fr, i) =>
  set.has(i) ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

const mod = await import('./.cache/shipped.mjs');
const arm = makeArms(mod)({ hold: true, clampPad: 0.02, cut: true });

function run(setFor) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  let n = 0;
  globalThis.__TS_GAZE_IDS = { life: {} };
  for (const w of wins) {
    const set = setFor(w);
    n += set.size;
    const s = score(arm(thinTo(w, set), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  const L = globalThis.__TS_GAZE_IDS.life;
  agg.births = (L.birthCleared || 0) + (L.birthBlurred || 0);
  agg.n = n;
  return agg;
}

console.log(`gender=${g}  ${wins.length} windows  MINGAP ${MINGAP}  `
  + `uniform budget ${BUDGET} verdicts (k=${K}, max gap ${K} frames)`);
console.log('');
console.log('arm                    verdicts  T     EXPOSURE  FALSECOVER   PHANTOM  births');
// THE UNIFORM FAMILY IS THE SHIPPED DIAL'S OWN PRICE LIST. Here gap and
// budget move together (k frames of gap, 1/k of the frames spent), so it
// cannot separate the two -- that is what the PLACED family below is
// for. What it gives is the thing a push actually buys: k=4 is roughly
// today's 2000ms cap, k=2 roughly 1000ms.
for (const k of [4, 3, 2, 1]) {
  const set = (w) => { const s = new Set(); for (let i = 0; i < w.frames.length; i += k) s.add(i); return s; };
  const r = run(set);
  console.log(`UNIFORM k=${k} (${(k * 0.5).toFixed(1)}s)  `.padEnd(21)
    + String(r.n).padStart(9) + '  --   '
    + (r.exposureS.toFixed(1) + 's').padStart(9)
    + (r.falseCoverS.toFixed(1) + 's').padStart(12)
    + (r.phantomS.toFixed(1) + 's').padStart(10)
    + String(r.births).padStart(8));
}
console.log('');
const base = run(uniformSet);
console.log('UNIFORM k=3 (today)  ' + String(base.n).padStart(9) + '  --   '
  + (base.exposureS.toFixed(1) + 's').padStart(9)
  + (base.falseCoverS.toFixed(1) + 's').padStart(12)
  + (base.phantomS.toFixed(1) + 's').padStart(10)
  + String(base.births).padStart(8));
for (const MAXGAP of GAPS) {
  const T = solveT(MAXGAP);
  const r = run((w) => placedSet(w, T, MAXGAP));
  console.log(`PLACED, max gap ${String(MAXGAP).padEnd(2)}   `.padEnd(21)
    + String(r.n).padStart(9) + '  ' + T.toFixed(1).padStart(5) + ' '
    + (r.exposureS.toFixed(1) + 's').padStart(9)
    + (r.falseCoverS.toFixed(1) + 's').padStart(12)
    + (r.phantomS.toFixed(1) + 's').padStart(10)
    + String(r.births).padStart(8));
}
delete globalThis.__TS_GAZE_IDS;
