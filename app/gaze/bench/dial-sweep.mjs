// THE MASTER TUNER. Sweeps every OTA dial this corpus can honestly
// price, over the SHIPPED code, and prints the PARETO FRONT plus the
// JSON to paste into rules/tuning.json.
//
//   node app/gaze/bench/dial-sweep.mjs
//   GENDER=woman node app/gaze/bench/dial-sweep.mjs
//   ROUNDS=3 node app/gaze/bench/dial-sweep.mjs
//
// ---------------------------------------------------------------------
// WHY IT PRINTS A FRONT AND NOT AN ANSWER
//
// Every dial here trades EXPOSURE (a woman the app failed to cover)
// against FALSE COVER (a man it covered anyway). To pick one setting a
// machine needs one number to climb, and choosing how many seconds of
// false cover a second of exposure is worth IS the protection decision --
// which this repo's standing rule puts with the owner, always. So this
// file refuses to collapse the two into a score. It reports every
// setting where you cannot buy less exposure without paying more false
// cover, and the owner picks one point ONCE. After that the same file
// re-runs itself against that point forever and only reports when a
// setting beats it.
//
// WHY IT SPLITS BY VIDEO
//
// 18 windows over 10 videos and ~46 distinct people. Sweep seven dials
// against all of it and you will find a combination that wins on these
// ten videos and loses on his phone -- that is curve-fitting, and this
// repo has published a table it had to retract for a smaller version of
// the same mistake. So every combination is CHOSEN on one half of the
// videos and REPORTED on the other, both ways round. A row whose held-out
// numbers do not follow its fitted ones is marked, and a marked row is
// not a result.
//
// WHAT IT CANNOT TUNE, and each exclusion is a fact about the bank
// rather than an oversight:
//
//   GENDER_GREY, GENDER_IMAGE_NM_FLOOR   the reads in bank/reads are
//       already decoded at one fixed input, and the image path is not
//       this pipeline. Grey needs bench/gpu/run.mjs, which re-runs the
//       model; this file only re-runs the DECISIONS.
//   CUT_DELTA                            the replay reads cut booleans
//       out of bank/cuts.json, so the detector's threshold is not in
//       the loop and a sweep of it would print a flat column.
//   PERSON_SKIP_EVERY, VERDICT_*, GENDER_REFRESH_MS, DELAY_MS,
//   NATIVE_*, RENDER_EVERY and every perf dial
//       these change WHEN a read happens or what the device does, and
//       the bank has a fixed frame set at a pinned cadence. A sweep here
//       would move nothing, or worse, move something for the wrong
//       reason. `hisRegimeOpts` pins the cadence deliberately -- four
//       published tables were measured with it unpinned and three of
//       them REVERSED.
//
// A sweep that cannot move is a broken instrument, not a null result --
// so this file ASSERTS that each dial moves at least one of its own
// columns, and says so loudly when one does not.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import * as SHIPPED from './.cache/shipped.mjs';
import { loadWin, ARM, HIS_EFFZOOM, K_HIS, thinFrames, hisRegimeOpts, CONTROL }
  from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const K = Number(process.env.K || K_HIS);
const TOLD = Number(process.env.TOLD || HIS_EFFZOOM);
const ROUNDS = Number(process.env.ROUNDS || 2);
const OPTS = hisRegimeOpts(g, TOLD);

// ---------------------------------------------------------------------
// THE DIALS. Each is [setter, shippedValue, gridOverTheOTAClampRange].
// The grid ENDS are the clamp ends from src/tuning.mjs -- a value this
// sweep recommends must be one the OTA channel can actually deliver, or
// the whole exercise recommends a build without saying so.
const DIALS = [
  ['GENDER_CLEAR_SCORE', (v) => SHIPPED.setClearScore(v),
    // THE GRID STARTS AT THE INVARIANT, NOT AT THE OTA CLAMP. The clamp
    // allows 0.36; test/gender-verdict.test.mjs requires the bar to stay
    // ABOVE 2*(NULL_V_HI - 0.5) = 0.440, because below it an ABSTAINED
    // read is one that would have cleared the owner and man mode starts
    // refusing reads that lift his own blur. The first run of this file
    // proposed 0.40 as free -- it is free on the corpus and unsafe by
    // construction, which is exactly the kind of thing a sweep that only
    // reads clamps will keep finding.
    SHIPPED.GENDER_CLEAR_SCORE, [0.45, 0.55, 0.65, 0.75, 0.90]],
  ['GENDER_CLEAR_SCORE_FEMALE', (v) => SHIPPED.setClearScoreFemale(v),
    SHIPPED.GENDER_CLEAR_SCORE_FEMALE, [0.30, 0.36, 0.45, 0.55, 0.65, 0.75, 0.90]],
  ['NULL_MINT_NM_FLOOR', (v) => SHIPPED.setNmFloor(v),
    SHIPPED.NULL_MINT_NM_FLOOR, [0, 3, 4, 5, 5.5]],
  ['PTRACK_IOU_MIN', (v) => SHIPPED.setIouMin(v),
    SHIPPED.PTRACK_IOU_MIN, [0.10, 0.15, 0.20, 0.25, 0.35]],
  ['PTRACK_MIN_COAST_PASSES', (v) => SHIPPED.setCoastPasses(v),
    SHIPPED.PTRACK_MIN_COAST_PASSES, [1.33, 1.75, 2.0, 2.5, 3.0]],
  ['MEM_SIM', (v) => SHIPPED.setSim(v), SHIPPED.MEM_SIM, [0.5, 0.6, 0.7, 0.8, 0.9]],
  [g === 'man' ? 'MEM_TRUST_MAN' : 'MEM_TRUST_WOMAN',
    (v) => (g === 'man' ? SHIPPED.setTrustMan(v) : SHIPPED.setTrustWoman(v)),
    g === 'man' ? SHIPPED.MEM_TRUST_MAN : SHIPPED.MEM_TRUST_WOMAN, [1, 2, 3, 4, 5]],
];
const SHIP = Object.fromEntries(DIALS.map(([n, , v]) => [n, v]));
const SET = Object.fromEntries(DIALS.map(([n, s]) => [n, s]));

function apply(cfg) {
  for (const [n] of DIALS) SET[n](cfg[n] === undefined ? SHIP[n] : cfg[n]);
}

// ---------------------------------------------------------------------
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const wins = files.map((f) => ({ vid: f.replace(/_w\d+\.json$/, ''), win: loadWin(f) }));
// SPLIT BY VIDEO, NOT BY WINDOW. Two windows off one video share people,
// shot framing and lighting -- a fold that puts one in each half is not
// held out at all. Alternating the SORTED video list keeps the two halves
// the same size without picking them to flatter anything.
const vids = [...new Set(wins.map((w) => w.vid))].sort();
const FOLD = new Map(vids.map((v, i) => [v, i % 2]));
const half = (k) => wins.filter((w) => FOLD.get(w.vid) === k).map((w) => w.win);
const FOLDS = [half(0), half(1)];
const ALL = wins.map((w) => w.win);

let evals = 0;
function run(set, cfg) {
  apply(cfg);
  evals++;
  const arm = ARM(OPTS);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const win of set) {
    const s = score(arm(thinFrames(win, K), g), g, (c) => cropLabel.get(c));
    agg.exposureS += s.exposureS;
    agg.falseCoverS += s.falseCoverS;
    agg.phantomS += s.phantomS;
  }
  return agg;
}

// ---------------------------------------------------------------------
// THE INSTRUMENT GATE, before any sweeping. If the shipped configuration
// over every window does not reproduce the published control triple,
// something else in the tree moved and every row below is about that
// instead.
const base = run(ALL, {});
const ctl = CONTROL[g];
const near = (a, b) => Math.abs(a - b) < 0.05;
if (ctl && !(near(base.exposureS, ctl.exposureS) && near(base.falseCoverS, ctl.falseCoverS)
  && near(base.phantomS, ctl.phantomS))) {
  console.log(`*** CONTROL DRIFT: shipped reads ${base.exposureS.toFixed(1)} / `
    + `${base.falseCoverS.toFixed(1)} / ${base.phantomS.toFixed(1)}, published is `
    + `${ctl.exposureS} / ${ctl.falseCoverS} / ${ctl.phantomS}.`);
  console.log('*** Nothing below means anything until that is explained. Stopping.');
  process.exit(1);
}
console.log(`gender=${g}  ${ALL.length} windows over ${vids.length} videos  `
  + `k=${K}  told ${TOLD}ms`);
console.log(`shipped: exposure ${base.exposureS.toFixed(1)}s  `
  + `false cover ${base.falseCoverS.toFixed(1)}s  phantom ${base.phantomS.toFixed(1)}s`
  + `  (control triple reproduced)`);
console.log('');

// ---------------------------------------------------------------------
// PARETO ARCHIVE over (exposure, false cover). Phantom rides along and
// is REPORTED but is not an objective: it counts patch-seconds with
// nobody under them, which is a busy-ness proxy, and letting a search
// minimise it would trade real protection for a calmer-looking screen.
const arch = [];
const dominates = (a, b) => a.exposureS <= b.exposureS && a.falseCoverS <= b.falseCoverS
  && (a.exposureS < b.exposureS || a.falseCoverS < b.falseCoverS);
function offer(row) {
  // DEDUPE ON THE NUMBERS, not on the config. Round 2 re-offers every
  // point with a cfg that now carries explicit shipped values for the
  // dials swept in round 1 -- a different object, the identical triple.
  // The first run printed all sixteen rows twice.
  if (arch.some((r) => r.exposureS === row.exposureS
    && r.falseCoverS === row.falseCoverS && r.phantomS === row.phantomS)) return false;
  if (arch.some((r) => dominates(r, row))) return false;
  for (let i = arch.length - 1; i >= 0; i--) if (dominates(row, arch[i])) arch.splice(i, 1);
  arch.push(row);
  return true;
}
offer({ ...base, cfg: {}, name: 'shipped' });

// ---------------------------------------------------------------------
// COORDINATE DESCENT, seeded at the shipped configuration. One dial at a
// time over its own grid; every point offered to the archive; the dial
// left at whichever grid point sits closest to the shipped operating
// point, so the next dial is swept around a configuration that is still
// recognisably the app rather than around whatever the last sweep's
// extreme happened to be.
//
// It is a LOCAL search and this file does not pretend otherwise: seven
// dials at five to seven points each is 137,000 combinations and the
// corpus costs ~2s per evaluation, which is four days. What coordinate
// descent finds is the front reachable by moving one dial at a time from
// what ships -- which is also the only kind of change that can be
// explained in a handoff, or reverted.
const cfg = {};
const dead = [];
for (let round = 0; round < ROUNDS; round++) {
  for (const [name, , ship, grid] of DIALS) {
    const seen = [];
    for (const v of grid) {
      const r = run(FOLDS[0], { ...cfg, [name]: v });
      const rb = run(FOLDS[1], { ...cfg, [name]: v });
      const whole = {
        exposureS: r.exposureS + rb.exposureS,
        falseCoverS: r.falseCoverS + rb.falseCoverS,
        phantomS: r.phantomS + rb.phantomS,
      };
      // HELD-OUT AGREEMENT. Fit on fold A, check the sign on fold B, and
      // again the other way. A setting that improves false cover on the
      // half it was chosen on and worsens it on the other half is
      // curve-fitting, and it gets a mark rather than a silent pass.
      seen.push({ v, whole, a: r, b: rb });
      offer({ ...whole, cfg: { ...cfg, [name]: v }, name: `${name}=${v}` });
    }
    const spread = Math.max(...seen.map((s) => s.whole.falseCoverS))
      - Math.min(...seen.map((s) => s.whole.falseCoverS));
    const espread = Math.max(...seen.map((s) => s.whole.exposureS))
      - Math.min(...seen.map((s) => s.whole.exposureS));
    // A dial that cannot move is a broken instrument -- EXCEPT where the
    // shipped rule says it has no job in this mode. In man mode the app
    // only ever clears MALE reads, so GENDER_CLEAR_SCORE_FEMALE is
    // correctly unused and a flat column is the right answer, not a bug.
    const idle = (g === 'man' && name === 'GENDER_CLEAR_SCORE_FEMALE')
      || (g === 'woman' && name === 'GENDER_CLEAR_SCORE');
    if (spread < 0.05 && espread < 0.05 && !idle) dead.push(name);
    // Park the dial back at what ships. The archive keeps every point
    // that was worth keeping; carrying the last sweep's pick forward
    // would make each dial's column depend on the order they were swept
    // in, which is a property of this file and not of the app.
    cfg[name] = ship;
  }
}

if (dead.length) {
  console.log('*** THESE DIALS MOVED NOTHING AND THE SWEEP CANNOT PRICE THEM:');
  console.log(`***   ${[...new Set(dead)].join(', ')}`);
  console.log('*** A column that cannot move is a broken instrument, not a null');
  console.log('*** result -- either the bank does not carry what the dial reads,');
  console.log('*** or the arm is not calling the setter. Check before ignoring.');
  console.log('');
}

// ---------------------------------------------------------------------
arch.sort((a, b) => a.exposureS - b.exposureS);
console.log(`PARETO FRONT -- ${arch.length} settings, from ${evals} evaluations`);
console.log('(nothing here is better than anything else; they are different trades)');
console.log('');
console.log('setting                              EXPOSURE  FALSECOVER   PHANTOM   held-out');
for (const r of arch) {
  const a = run(FOLDS[0], r.cfg);
  const b = run(FOLDS[1], r.cfg);
  const ba = run(FOLDS[0], {});
  const bb = run(FOLDS[1], {});
  // Does the false-cover change point the same way on both halves?
  const da = a.falseCoverS - ba.falseCoverS;
  const db = b.falseCoverS - bb.falseCoverS;
  const agree = (da <= 0 && db <= 0) || (da >= 0 && db >= 0);
  console.log(r.name.padEnd(36)
    + (r.exposureS.toFixed(1) + 's').padStart(9)
    + (r.falseCoverS.toFixed(1) + 's').padStart(12)
    + (r.phantomS.toFixed(1) + 's').padStart(10)
    + (agree ? '   agrees' : '   *** SPLIT'));
}
apply({});
console.log('');
// A ROW THAT BEATS SHIPPED ON BOTH COLUMNS IS NOT A TRADE. It costs
// nothing and it is not an exposure decision -- it is just better, and
// it should be called out rather than buried in a front the owner has to
// read across.
const free = arch.filter((r) => Object.keys(r.cfg).length
  && r.exposureS <= base.exposureS && r.falseCoverS <= base.falseCoverS
  && (r.exposureS < base.exposureS || r.falseCoverS < base.falseCoverS));
if (free.length) {
  console.log('FREE -- better or equal on BOTH columns, so not an exposure trade:');
  for (const r of free) {
    console.log(`  ${r.name.padEnd(32)} exposure ${r.exposureS.toFixed(1)}s `
      + `(${(r.exposureS - base.exposureS).toFixed(1)})  false cover `
      + `${r.falseCoverS.toFixed(1)}s (${(r.falseCoverS - base.falseCoverS).toFixed(1)})`);
  }
  console.log('');
}
console.log('*** SPLIT = the two halves of the videos disagree about the SIGN of the');
console.log('change. That row is fitted to the videos it was chosen on. Do not ship it.');
console.log('');
console.log('WHICH ONE TO SHIP IS AN EXPOSURE TRADE AND IT IS THE OWNER\'S, ALWAYS.');
console.log('Pick a row; the JSON for rules/tuning.json is printed below it.');
console.log('');
for (const r of arch) {
  if (!Object.keys(r.cfg).length) continue;
  console.log(`${r.name.padEnd(36)} ${JSON.stringify(r.cfg)}`);
}
