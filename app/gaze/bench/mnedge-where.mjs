// WHERE DOES THE MEASURED EDGE ACTUALLY DO ITS WORK?
//
// Findings 21 prices `mnBody EDGE ONLY` at -0.5s exposure / -1.0s false
// cover / -11.5s phantom in his mode -- better on all three, the only
// arm this session to manage that. It is also 11.5 seconds spread over
// 18 windows and 2,160 frames, and a total that small can be ONE window
// doing all the work while seventeen do nothing. `iou-where.mjs` exists
// because of exactly that lesson: quoting a total instead of a
// distribution is how a change looks general when it is local.
//
// So: per window, both genders, plus the counter. `mnEdgeMoved` fires
// only where an edge really moved; `mnEdgeInert` where the branch ran
// and changed nothing. A high inert count with a low moved count means
// the arm is nearly a no-op that happened to land well on one window,
// and that is a refusal, not a ship.
import fs from 'fs';
import { winFiles, ROOT } from './corpus-lib.mjs';
import { loadWin, makeArms, thinFrames, hisRegimeOpts, K_HIS, CONTROL } from './arch-arms.mjs';
import { score } from './corpus-score.mjs';
const S = await import('./.cache/shipped.mjs');

const K = Number(process.env.K || K_HIS);
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const files = winFiles();

const EDGE = { mnBody: true, ssdMin: 0, ssdEdge: true };

function runWin(w, g, extra) {
  const arm = makeArms(S)({ ...hisRegimeOpts(g), ...extra });
  globalThis.__TS_GAZE_IDS = { life: {} };
  const out = arm(thinFrames(w, K), g);
  const life = globalThis.__TS_GAZE_IDS.life;
  const s = score(out, g, (crop) => cropLabel.get(crop));
  return { s, moved: life.mnEdgeMoved || 0, inert: life.mnEdgeInert || 0,
    opp: life.mnEdgeOpportunity || 0, none: life.mnEdgeNoNeighbour || 0 };
}

console.log(`18 windows, k=${K} (${(K * 0.5).toFixed(1)}s/verdict), his regime`);
console.log(`arm: mnBody EDGE ONLY   control: ${CONTROL.config}`);

for (const g of ['man', 'woman']) {
  const rows = [];
  const tot = { e: 0, f: 0, p: 0, moved: 0, inert: 0, opp: 0, none: 0 };
  let ctlSum = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const file of files) {
    const w = loadWin(file);
    const c = runWin(w, g, {});
    const e = runWin(loadWin(file), g, EDGE);
    for (const k of Object.keys(ctlSum)) ctlSum[k] += c.s[k];
    const d = {
      win: w.tag,
      e: e.s.exposureS - c.s.exposureS,
      f: e.s.falseCoverS - c.s.falseCoverS,
      p: e.s.phantomS - c.s.phantomS,
      moved: e.moved, inert: e.inert, opp: e.opp, none: e.none,
    };
    tot.e += d.e; tot.f += d.f; tot.p += d.p; tot.moved += d.moved; tot.inert += d.inert;
    tot.opp += d.opp; tot.none += d.none;
    rows.push(d);
  }
  delete globalThis.__TS_GAZE_IDS;

  const want = CONTROL[g];
  const ok = Object.keys(want).every((k) => ctlSum[k] === want[k]);
  if (!ok) {
    console.error(`\nCONTROL does not reproduce for ${g}: ${JSON.stringify(ctlSum)} `
      + `want ${JSON.stringify(want)} -- refusing rather than printing a distribution `
      + `measured outside his regime.`);
    process.exit(2);
  }

  const moved = rows.filter((r) => r.moved > 0);
  const changed = rows.filter((r) => r.e || r.f || r.p);
  const helped = rows.filter((r) => r.e <= 0 && r.f <= 0 && r.p <= 0 && (r.f || r.p || r.e));
  const hurt = rows.filter((r) => r.e > 0);
  console.log(`\n-- ${g.toUpperCase()} --`);
  console.log(`edge moved in ${moved.length} of ${rows.length} windows`
    + `   moved ${tot.moved} times, inert ${tot.inert}`
    + `  (${tot.moved + tot.inert ? (100 * tot.moved / (tot.moved + tot.inert)).toFixed(1) : '0.0'}% of the branch)`);
  // THE HONEST RATE (phase-g G7). "% of the branch" counts every
  // frame-face the arm looked at, including the ones with no cleared
  // neighbour to give an edge to -- so it measures how often men clear,
  // not how active the arm is. Per OPPORTUNITY it is the arm's own rate.
  console.log(`  branch ran ${tot.opp + tot.none} times: ${tot.opp} with an eligible `
    + `neighbour, ${tot.none} with NONE (${tot.opp + tot.none ? (100 * tot.none / (tot.opp + tot.none)).toFixed(1) : '0.0'}%)`);
  console.log(`  per OPPORTUNITY the edge moves ${tot.opp ? (100 * tot.moved / tot.opp).toFixed(1) : '0.0'}%`);
  console.log(`windows whose SCORE changed at all: ${changed.length}`);
  console.log(`  better on every column: ${helped.length}    costing exposure: ${hurt.length}`);
  console.log(`total  exposure ${tot.e >= 0 ? '+' : ''}${tot.e.toFixed(1)}`
    + `  falseCover ${tot.f >= 0 ? '+' : ''}${tot.f.toFixed(1)}`
    + `  phantom ${tot.p >= 0 ? '+' : ''}${tot.p.toFixed(1)}`);
  console.log('');
  console.log('win'.padEnd(26) + '   dExp    dFalse   dPhantom    moved   inert');
  for (const r of rows.sort((a, b) => a.p - b.p)) {
    if (!r.moved && !r.e && !r.f && !r.p) continue;
    console.log(String(r.win).slice(0, 25).padEnd(26)
      + (r.e >= 0 ? '+' : '') + r.e.toFixed(1).padStart(6)
      + '  ' + (r.f >= 0 ? '+' : '') + r.f.toFixed(1).padStart(7)
      + '  ' + (r.p >= 0 ? '+' : '') + r.p.toFixed(1).padStart(8)
      + String(r.moved).padStart(9) + String(r.inert).padStart(8));
  }
}
console.log('');
console.log('THE TEST THIS HAS TO PASS: the gain is spread, and no window');
console.log('pays exposure for another window\'s phantom. One window doing');
console.log('all the work is a coincidence, not a mechanism.');
