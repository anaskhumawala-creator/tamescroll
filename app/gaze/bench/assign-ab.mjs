// IS THE ASSIGNMENT WORTH CHANGING? E5, re-derived, says it is the
// largest single class of birth.
//
// `birthContended` -- an observation that overlapped a live track well
// enough to match and LOST that track to another observation -- is 65 of
// 147 births in man mode and 75 of 147 in woman mode
// (spikes/gauntlet/births-hisregime.txt). A contended birth re-mints a
// subject who already had a track, and a re-minted subject is born
// BLURRED with no accumulated clear, so the cost lands on FALSE COVER --
// the second-biggest number on this corpus at 139.0s.
//
// `updatePersonTracks` claims greedily down an IoU-sorted pair list.
// `optimalAssign` (src/assign.mjs) is Hungarian with a cardinality term
// in the edge weight, so it maximises MATCHES first and overlap second.
// Both are called by the shipped tracker through the same switch, so
// this A/B differs in one function rather than in a rewrite.
//
// THE REGIME IS PINNED. `hisRegimeOpts` carries `fixedCadence`, which is
// the option whose absence reversed three of the four tables it touched
// (D2). The control row must reproduce the shipped triple -- man
// 23.0 / 139.0 / 561.0, woman 24.5 / 200.5 / 663.0 post-1090 -- and this
// file prints it first for exactly that reason.
//
// Usage: GENDER=man node bench/assign-ab.mjs
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms, K_HIS, thinFrames, hisRegimeOpts, HIS_EFFZOOM } from './arch-arms.mjs';
const S = await import('./.cache/shipped.mjs');

const g = process.env.GENDER || 'man';
const K = Number(process.env.K || K_HIS);
const TOLD = Number(process.env.TOLD || HIS_EFFZOOM);
const O = hisRegimeOpts(g, TOLD);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);

const KEYS = ['birthFresh', 'birthNearMiss', 'birthContended', 'birthSizeRejected',
  'coastExpired', 'birthCleared', 'birthBlurred'];

function run(mode) {
  // The switch lives in the shipped module, so both arms are the shipped
  // tracker. Restored in a finally: a bench that leaves a global mode set
  // poisons every arm after it in the same process.
  S.setAssign(mode);
  try {
    const arm = makeArms(S)(O);
    const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
    globalThis.__TS_GAZE_IDS = { life: {} };
    for (const w of wins) {
      const s = score(arm(thinFrames(w, K), g), g, (c) => cropLabel.get(c));
      for (const k of Object.keys(agg)) agg[k] += s[k];
    }
    const L = globalThis.__TS_GAZE_IDS.life;
    const life = Object.fromEntries(KEYS.map((k) => [k, L[k] || 0]));
    delete globalThis.__TS_GAZE_IDS;
    return { agg, life };
  } finally {
    S.setAssign('greedy');
  }
}

console.log(`gender=${g}  windows ${wins.length}  k=${K} (${(K * 0.5).toFixed(1)}s/verdict)  told ${TOLD}ms`);
console.log(`shipped PTRACK_ASSIGN '${S.PTRACK_ASSIGN}'  PTRACK_IOU_MIN ${S.PTRACK_IOU_MIN}`);
console.log('');
console.log('arm        EXPOSURE  FALSECOVER   PHANTOM    covered     sharp');

const out = {};
for (const mode of ['greedy', 'optimal']) {
  const r = run(mode);
  out[mode] = r;
  console.log(mode.padEnd(11)
    + (r.agg.exposureS.toFixed(1) + 's').padStart(8)
    + (r.agg.falseCoverS.toFixed(1) + 's').padStart(12)
    + (r.agg.phantomS.toFixed(1) + 's').padStart(10)
    + (r.agg.coveredS.toFixed(1) + 's').padStart(11)
    + (r.agg.sharpOkS.toFixed(1) + 's').padStart(10));
}
const d = (k) => out.optimal.agg[k] - out.greedy.agg[k];
console.log('delta'.padEnd(11)
  + (d('exposureS') >= 0 ? '+' : '') + d('exposureS').toFixed(1).padStart(7)
  + ((d('falseCoverS') >= 0 ? '+' : '') + d('falseCoverS').toFixed(1)).padStart(12)
  + ((d('phantomS') >= 0 ? '+' : '') + d('phantomS').toFixed(1)).padStart(10));

console.log('');
console.log('births'.padEnd(20) + KEYS.map((k) => k.replace('birth', '').slice(0, 8).padStart(9)).join(''));
for (const mode of ['greedy', 'optimal'])
  console.log(mode.padEnd(20) + KEYS.map((k) => String(out[mode].life[k]).padStart(9)).join(''));

// PER WINDOW, because 1.0s landing on one subject and 1.0s spread over
// eighteen windows are different events -- the discipline iou-where.mjs
// exists for. A total can hide a single window where somebody goes
// sharp for a second.
if (process.env.PERWIN) {
  const per = {};
  for (const mode of ['greedy', 'optimal']) {
    S.setAssign(mode);
    try {
      const arm = makeArms(S)(O);
      for (const w of wins) {
        const s = score(arm(thinFrames(w, K), g), g, (c) => cropLabel.get(c));
        (per[w.tag || w.name] ||= {})[mode] = s;
      }
    } finally { S.setAssign('greedy'); }
  }
  console.log('');
  console.log('window'.padEnd(26) + 'dEXPOSURE  dFALSECOVER   dPHANTOM');
  const rows = Object.entries(per).map(([k, v]) => ({
    k,
    e: v.optimal.exposureS - v.greedy.exposureS,
    f: v.optimal.falseCoverS - v.greedy.falseCoverS,
    p: v.optimal.phantomS - v.greedy.phantomS,
  })).sort((a, b) => b.e - a.e);
  for (const r of rows) {
    if (!r.e && !r.f && !r.p) continue;
    console.log(String(r.k).slice(0, 25).padEnd(26)
      + r.e.toFixed(1).padStart(9) + r.f.toFixed(1).padStart(13) + r.p.toFixed(1).padStart(11));
  }
  const moved = rows.filter((r) => r.e || r.f || r.p).length;
  console.log(`${moved} of ${rows.length} windows move at all`);
}
