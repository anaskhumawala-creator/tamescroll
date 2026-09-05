// TRACK-MEAN, THROUGH THE REAL TRACKER.
//
// The offline result that motivated the dial regrouped his 2,159
// labelled reads BY IDENTITY -- using the labels -- and averaged each
// person's raw sigmoids. False cover on men fell 18.2% -> 5.9% and AUC
// rose 0.9855 -> 0.9964, for zero extra inference.
//
// THAT NUMBER IS NOT A PREDICTION ABOUT THE APP, and this file is why.
// The shipped tracker does not know who anybody is; it associates by
// IoU, and every read it puts on the wrong track pollutes a mean that
// then persists for the life of that track. The offline arm was
// estimated to break even near 10% mis-association and the real rate has
// never been measured. So the only honest way to price the dial is to
// run the SHIPPED `updatePersonTracks` over the corpus with the dial off
// and again with it on, and read the same three errors the control
// triple is written in.
//
//   node app/gaze/bench/track-mean-ab.mjs
//   GENDER=woman node app/gaze/bench/track-mean-ab.mjs
//
// WHAT MAKES THIS DIFFERENT FROM arch-ab's A1 POOL: A1 groups reads by
// the faceres DESCRIPTOR and pools logits outside the tracker. This
// changes nothing outside `person-track.mjs` -- the association, the
// clear ladder, the coast, the cut demotion and the merge are all the
// shipped ones, and the only difference between the two rows below is
// which number the verdict is derived from.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import * as SHIPPED from './.cache/shipped.mjs';
import { loadWin, ARM, HIS_EFFZOOM, K_HIS, thinFrames, hisRegimeOpts, CONTROL }
  from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const K = Number(process.env.K || K_HIS);
const TOLD = Number(process.env.TOLD || HIS_EFFZOOM);
const OPTS = hisRegimeOpts(g, TOLD);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`)
  .filter((f) => f.endsWith('.json')).map(loadWin);

// The dial and the declared gender are MODULE STATE, so the arms have to
// run one at a time and each has to set both. `setUserGender` is what
// init-entry calls once at boot; without it the tracker cannot name the
// direction and `metaFromMean` returns a covered verdict for everyone,
// which would read as "track-mean is catastrophic" rather than as "the
// bench forgot a line".
SHIPPED.setUserGender(g);

// THE PRIOR'S STRENGTH, so the bench can ask WHICH half loses. m0 = 0 is
// the plain mean: if that loses too, the loss is the ASSOCIATION and no
// shrinkage rescues it. If only m0 >= 1 loses, the prior is the problem
// and the estimator is worth another shape.
if (process.env.M0 !== undefined) SHIPPED._setTrackMeanM0(Number(process.env.M0));

// `bump` writes into globalThis.__TS_GAZE_IDS.life and NO-OPS when that
// bag does not exist -- which is every node process. Without this line
// the counters below print `{}` on a run where the dial fired on every
// read, i.e. a check that cannot fail in the dangerous direction.
globalThis.__TS_GAZE_IDS = globalThis.__TS_GAZE_IDS || {};

// THE SHIPPED BARS, so the sweep can put them back exactly.
const BAR0 = SHIPPED.GENDER_CLEAR_SCORE;
const BARF0 = SHIPPED.GENDER_CLEAR_SCORE_FEMALE;

function run(on, bar) {
  SHIPPED.setTrackMean(on ? 1 : 0);
  // THE ARM'S OWN BAR. Shrinking a track's reads toward 0.5 lowers every
  // synthetic score by construction, so the ON arm covers more of
  // EVERYBODY at the shipped bar -- which shows up as less exposure and
  // more false cover and is a threshold move wearing an accuracy result.
  // Findings 29, 40, 41, 45, 47 and 50 each turned on exactly this. The
  // bar is solved to a common exposure below and only then is false
  // cover read.
  SHIPPED.setClearScore(bar === undefined ? BAR0 : bar);
  SHIPPED.setClearScoreFemale(bar === undefined ? BARF0 : bar * (BARF0 / BAR0));
  // PROVE THE DIAL MOVED. A getter that reads back the wrong value means
  // the bundle is stale, and a stale bundle prints two identical rows --
  // which is a harness failure that looks exactly like a null result.
  if ((SHIPPED.GENDER_TRACK_MEAN >= 0.5) !== on) {
    throw new Error(`setTrackMean(${on}) did not take: the .cache bundle is stale`);
  }
  const arm = ARM(OPTS);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
  for (const win of wins) {
    const s = score(arm(thinFrames(win, K), g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  return agg;
}

const off = run(false);
const on = run(true);
SHIPPED.setTrackMean(0);
SHIPPED.setClearScore(BAR0);
SHIPPED.setClearScoreFemale(BARF0);

console.log(`gender=${g}  ${wins.length} windows  k=${K} (${(K * 0.5).toFixed(1)}s/verdict)  told ${TOLD}ms`);
console.log('');
const row = (name, a) => name.padEnd(30)
  + (a.exposureS.toFixed(1) + 's').padStart(10)
  + (a.falseCoverS.toFixed(1) + 's').padStart(12)
  + (a.phantomS.toFixed(1) + 's').padStart(10);
console.log('arm                             EXPOSURE  FALSECOVER   PHANTOM');
console.log(row('GENDER_TRACK_MEAN 0 (ships)', off));
console.log(row('GENDER_TRACK_MEAN 1', on));
console.log(row('  delta', {
  exposureS: on.exposureS - off.exposureS,
  falseCoverS: on.falseCoverS - off.falseCoverS,
  phantomS: on.phantomS - off.phantomS,
}));
console.log('');

// THE CONTROL TRIPLE IS THE INSTRUMENT CHECK, not decoration. If the
// dial-off row does not reproduce the published control for this gender,
// something else moved and neither row below means anything.
const ctl = CONTROL[g];
if (ctl) {
  const near = (a, b) => Math.abs(a - b) < 0.05;
  const okc = near(off.exposureS, ctl.exposureS) && near(off.falseCoverS, ctl.falseCoverS)
    && near(off.phantomS, ctl.phantomS);
  console.log(okc
    ? `control triple reproduced (${ctl.exposureS} / ${ctl.falseCoverS} / ${ctl.phantomS})`
    : `*** CONTROL DRIFT: dial-off is ${off.exposureS.toFixed(1)} / `
      + `${off.falseCoverS.toFixed(1)} / ${off.phantomS.toFixed(1)}, published is `
      + `${ctl.exposureS} / ${ctl.falseCoverS} / ${ctl.phantomS}. Fix this before reading the delta.`);
}

// COUNTERS, so a null delta can be told apart from a dial that never
// fired. `trackMean` counts the reads the mean actually rewrote and
// `trackMeanFlip` the ones where it changed the flag -- if the first is
// zero the observation builder is not carrying `raw`, and if the second
// is zero the mean agrees with the latest read everywhere and there is
// nothing here to ship.
const life = globalThis.__TS_GAZE_IDS && globalThis.__TS_GAZE_IDS.life;
console.log(`counters: ${JSON.stringify(life || {})}`);
if (!life || !life.trackMean) {
  console.log('*** trackMean fired 0 times. The observation builder is not carrying');
  console.log('*** `raw`, or every read abstained. The ON row above is the OFF row.');
}

// ---------------------------------------------------------------------
// MATCHED EXPOSURE. Everything above is unreadable on its own.
//
// The ON arm's synthetic score is 2*|mean - 0.5|, and the m0 = 1 prior
// pulls every mean toward 0.5 -- so at the shipped bar the ON arm is
// simply a MORE COVERING arm, which buys the exposure column and pays
// for it in false cover. The two rows are at different operating points
// and their difference is a threshold move, not an accuracy result.
//
// So: sweep the ON arm's own clear bar down until its exposure meets the
// shipped arm's, then read false cover THERE. The female bar moves with
// it in the shipped ratio, because moving one and not the other is a
// second change hiding inside the first.
const BARS = (process.env.BARS || '0.45,0.40,0.35,0.30,0.25,0.20,0.15,0.10,0.05')
  .split(',').map(Number);
console.log('');
console.log('MATCHED EXPOSURE -- the ON arm at its own bar');
console.log('clear bar   EXPOSURE  FALSECOVER   PHANTOM');
const sweep = [];
for (const b of BARS) {
  const a = run(true, b);
  sweep.push({ bar: b, ...a });
  console.log(b.toFixed(2).padEnd(12)
    + (a.exposureS.toFixed(1) + 's').padStart(9)
    + (a.falseCoverS.toFixed(1) + 's').padStart(12)
    + (a.phantomS.toFixed(1) + 's').padStart(10));
}
SHIPPED.setTrackMean(0);
SHIPPED.setClearScore(BAR0);
SHIPPED.setClearScoreFemale(BARF0);

// The nearest row at or above the shipped arm's exposure. Reading a row
// with LESS exposure would flatter the ON arm on the column that
// matters, so the tie is broken toward the shipped arm.
const at = sweep.filter((r) => r.exposureS >= off.exposureS)
  .sort((a, b) => a.exposureS - b.exposureS)[0];
console.log('');
if (!at) {
  console.log(`*** NO ROW REACHES ${off.exposureS.toFixed(1)}s OF EXPOSURE even at bar `
    + `${Math.min(...BARS)}. The ON arm cannot be brought to the shipped operating`);
  console.log('*** point by its bar alone, so no matched comparison exists. Widen BARS.');
} else {
  const d = at.falseCoverS - off.falseCoverS;
  console.log(`AT MATCHED EXPOSURE (${at.exposureS.toFixed(1)}s vs ${off.exposureS.toFixed(1)}s, `
    + `ON arm bar ${at.bar.toFixed(2)}):`);
  console.log(`  false cover ${off.falseCoverS.toFixed(1)}s -> ${at.falseCoverS.toFixed(1)}s `
    + `(${d >= 0 ? '+' : ''}${d.toFixed(1)}s)  ${d < 0 ? 'TRACK-MEAN WINS' : 'TRACK-MEAN LOSES'}`);
}
