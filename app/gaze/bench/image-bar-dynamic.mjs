// DOES A *DYNAMIC* THUMBNAIL BAR BEAT A FIXED ONE? His question, and it
// is answerable with the ground truth finding 28 already assembled.
//
// A fixed bar asks one question of every read: "is the model sure enough
// to clear this face". A dynamic bar asks "sure enough GIVEN what else I
// know about this crop" -- and the point of the exercise is that only a
// signal carrying information the SCORE DOES NOT ALREADY CARRY can win.
// A dial keyed on something that is a function of the score is the same
// bar wearing a hat, and this repo has published exactly that mistake
// before (loop 38: "his male population IS the non-face population to
// three decimals" was circular, because score is 2|raw-0.5|).
//
// THREE CANDIDATE AXES, all already banked per read:
//   nm    faceres' pre-L2 descriptor magnitude. MEASURED NON-CIRCULAR:
//         overall pearson with |v-0.5| is 0.464, but INSIDE a narrow v
//         slice it collapses to -0.21..+0.30 (findings, loop 38). It is
//         the axis the null-mint floor already rides.
//   px    the face's native pixel size. Arm 1 of finding 28 put all four
//         of its misreads at 32-48px.
//   conf  BlazeFace's own detection confidence. Loop 35 measured refused
//         and kept faces at conf p50 0.74 vs 0.76 -- i.e. it separates
//         nothing there -- so it is on this list to be REFUTED, not
//         because it is expected to win.
//
// HOW THE SHIPPED RULE IS REUSED WITHOUT RE-IMPLEMENTING IT. The rule is
// `flagged = !same || !adult || !(score >= BAR)`, plus a nullMint branch
// that SKIPS a read entirely. Evaluating the SHIPPED `flaggedFaceIndices`
// at two bars decomposes every read exactly:
//
//   flagged@0 true                  -> ALWAYS flagged (!same or !adult).
//   flagged@0 false, flagged@1.01 true  -> SCORE-GATED: flagged iff
//                                          score < bar.
//   flagged@0 false, flagged@1.01 false -> SKIPPED by nullMint; no bar
//                                          can ever flag it.
//
// So a dynamic policy is applied to the score-gated set alone and the
// other two classes are carried through untouched. Nothing here restates
// the rule; it reads the rule's own answers at two points.
//
// THE COMPARISON IS AT MATCHED EXPOSURE, which is the only fair one. A
// policy that lowers false cover while raising exposure has not won
// anything -- it has moved along the fixed bar's own curve. The question
// is whether, AT THE SAME EXPOSURE, a dynamic rule covers fewer people
// it should not.
//
// Run: node bench/image-bar-dynamic.mjs [man|woman]
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import './_build.mjs';
import { patchConsts, readConst } from './_patch.mjs';
import { ROOT, winFiles } from './corpus-lib.mjs';

const G = process.argv[2] || process.env.GENDER || 'man';
const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
const NAME = 'GENDER_IMAGE_MIN_SCORE';
const SHIPPED = readConst(src, NAME);

async function variantAt(v) {
  const f = fileURLToPath(new URL(`./.cache/dynbar${v}.mjs`, import.meta.url));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, patchConsts(src, { [NAME]: v }));
  return import(pathToFileURL(f).href + '?v=' + v);
}
const lo = await variantAt(0);
const hi = await variantAt(1.01);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

// Every labelled read, pre-classified into the three bar classes ONCE.
const rows = [];
for (const file of winFiles()) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  for (const fr of win.frames) for (const f of (fr.faces || [])) {
    const lab = f.crop && cropLabel.get(f.crop);
    if (lab !== 'man' && lab !== 'woman' && lab !== 'notperson') continue;
    const rd = { gender: f.gender, score: f.score, raw: f.raw, age: f.age,
      childP: f.childP, shape: f.shape };
    const at0 = lo.flaggedFaceIndices(G, [rd]).length > 0;
    const at1 = hi.flaggedFaceIndices(G, [rd]).length > 0;
    rows.push({
      lab,
      cls: at0 ? 'always' : (at1 ? 'gated' : 'skipped'),
      score: f.score, nm: f.nm, px: f.px, conf: f.conf,
      vid: file.replace(/_w\d+\.json$/, ''),
    });
  }
}

const same = G === 'man' ? 'man' : 'woman';
/** @param barFor read -> threshold. Returns the three errors. */
function errs(barFor, subset) {
  let fc = 0, sameN = 0, ex = 0, oppN = 0, ph = 0, phN = 0;
  for (const r of (subset || rows)) {
    const flagged = r.cls === 'always' ? true
      : r.cls === 'skipped' ? false
      : !(r.score >= barFor(r));
    if (r.lab === 'notperson') { phN++; if (flagged) ph++; continue; }
    if (r.lab === same) { sameN++; if (flagged) fc++; }
    else { oppN++; if (!flagged) ex++; }
  }
  return { fc, sameN, ex, oppN, ph, phN };
}

const nA = rows.filter((r) => r.cls === 'always').length;
const nG = rows.filter((r) => r.cls === 'gated').length;
const nS = rows.filter((r) => r.cls === 'skipped').length;
console.log(`DYNAMIC vs FIXED THUMBNAIL BAR -- gender=${G}, ${NAME} ships ${SHIPPED}`);
console.log(`labelled reads ${rows.length}:  always-flagged ${nA}`
  + `  score-GATED ${nG}  nullMint-skipped ${nS}`);
console.log('ONLY THE GATED SET CAN MOVE. Everything the bar decides lives there.\n');

// ---- the fixed curve, which every dynamic policy must beat ----
// THE TWO SEARCHES MUST SHARE A GRID. The first version swept the fixed
// bar at 0.01 and the dynamic pair at 0.05, so the "dynamic" search could
// not even express the fixed policy it was being scored against, and one
// row reported a dynamic LOSS of 8 that was purely the resolution gap.
// A comparison whose two arms search different spaces measures the
// spaces, not the policies.
const BARS = [];
for (let v = 0; v <= 0.9001; v += 0.01) BARS.push(Math.round(v * 100) / 100);
const FIXED = BARS.map((b) => ({ b, ...errs(() => b) }));
const atShipped = FIXED.find((r) => Math.abs(r.b - SHIPPED) < 1e-9);
console.log(`SHIPPED ${SHIPPED}: false cover ${atShipped.fc}, exposure ${atShipped.ex}, phantom ${atShipped.ph}`);

// The fixed policy's best false cover at or below a target exposure.
function fixedBestAt(maxEx) {
  let best = null;
  for (const r of FIXED) if (r.ex <= maxEx && (!best || r.fc < best.fc)) best = r;
  return best;
}

// ---- the dynamic families ----
const NMS = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const PXS = [0, 32, 40, 48, 56, 64, 80, 100, 120];
const CFS = [0, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9];

const families = [
  ['nm  ', NMS, (r) => r.nm],
  ['px  ', PXS, (r) => r.px],
  ['conf', CFS, (r) => r.conf],
];

console.log('\nAT MATCHED EXPOSURE, WHAT IS THE LOWEST FALSE COVER EACH FAMILY REACHES?');
console.log('(a dynamic policy that needs MORE exposure has not beaten anything --');
console.log(' it has just moved along the fixed bar\'s own curve)\n');
console.log('  target exposure   FIXED (bar)          best DYNAMIC                    gain');

for (const targetEx of [atShipped.ex, atShipped.ex + 2, atShipped.ex + 5]) {
  const fx = fixedBestAt(targetEx);
  let best = null;
  for (const [name, cuts, get] of families) {
    for (const cut of cuts) {
      for (const bLo of BARS) for (const bHi of BARS) {
        if (bHi < bLo) continue;             // a trusted read may not need MORE
        const e = errs((r) => {
          const v = get(r);
          return (typeof v === 'number' && isFinite(v) && v >= cut) ? bLo : bHi;
        });
        if (e.ex > targetEx) continue;
        if (!best || e.fc < best.e.fc) best = { name, cut, bLo, bHi, e };
      }
    }
  }
  const gain = best ? fx.fc - best.e.fc : 0;
  const dyn = best
    ? `${best.name} >=${String(best.cut).padEnd(5)}? ${best.bLo.toFixed(2)} : ${best.bHi.toFixed(2)}  fc ${String(best.e.fc).padStart(4)}`
    : '(none)';
  console.log('  ' + String(targetEx).padEnd(18)
    + `${String(fx.fc).padStart(4)} (bar ${fx.b.toFixed(2)})`.padEnd(21)
    + dyn.padEnd(38)
    + (gain > 0 ? `${gain} fewer` : gain === 0 ? 'none' : `${-gain} WORSE`));
}

console.log('\nHOW TO READ IT. A gain of 0 or a negative gain means the axis carries');
console.log('no information the score does not already carry, and a dynamic bar on');
console.log('it is the fixed bar with extra code and an extra thing to get wrong.');
console.log('A LARGE gain is only believable if the winning cut is not sitting on');
console.log('a handful of reads -- check the gated-set size printed above.');
for (const f of fs.readdirSync(fileURLToPath(new URL('./.cache/', import.meta.url))))
  if (f.startsWith('dynbar')) fs.rmSync(fileURLToPath(new URL('./.cache/' + f, import.meta.url)));

// ---------------------------------------------------------------------
// HELD OUT, BECAUSE THE TABLE ABOVE IS A SEARCH OVER ~670,000 POLICIES
// ON ONE DATASET AND THAT IS HOW A DATA DREDGE LOOKS FROM THE INSIDE.
//
// LEAVE ONE VIDEO OUT, not one read out: reads within a video share a
// subject, a camera and a lighting setup, so a read-level split leaks
// the answer across the fold. `critic-lovo.mjs` set this precedent in
// this repo for exactly that reason.
//
// The fixed bar is refitted on each training fold too. Comparing a
// refitted dynamic policy against a FROZEN fixed bar would credit the
// dynamic family with the refit, which is the commonest way this kind of
// table lies.
const vids = [...new Set(rows.map((r) => r.vid))];
console.log(`
HELD OUT -- leave one video out, ${vids.length} folds`);
console.log('  both policies are REFITTED on the training fold, then scored');
console.log('  on the held-out video at ITS OWN matched exposure.\n');

function fitFixed(train, maxEx) {
  let best = null;
  for (const b of BARS) {
    const e = errs(() => b, train);
    if (e.ex <= maxEx && (!best || e.fc < best.fc)) best = { b, fc: e.fc };
  }
  return best;
}
function fitDynamic(train, maxEx) {
  let best = null;
  for (const [name, cuts, get] of families) {
    for (const cut of cuts) {
      for (const bLo of BARS) for (const bHi of BARS) {
        if (bHi < bLo) continue;
        const e = errs((r) => {
          const v = get(r);
          return (typeof v === 'number' && isFinite(v) && v >= cut) ? bLo : bHi;
        }, train);
        if (e.ex > maxEx) continue;
        if (!best || e.fc < best.fc) best = { name, cut, bLo, bHi, fc: e.fc };
      }
    }
  }
  return best;
}

let sumFixFc = 0, sumDynFc = 0, sumFixEx = 0, sumDynEx = 0, wins = 0, losses = 0;
for (const v of vids) {
  const train = rows.filter((r) => r.vid !== v);
  const test = rows.filter((r) => r.vid === v);
  // The exposure budget is the SHIPPED bar's own exposure on the
  // training fold, so neither family gets to pick a friendlier budget.
  const budget = errs(() => SHIPPED, train).ex;
  const fx = fitFixed(train, budget);
  const dy = fitDynamic(train, budget);
  if (!fx || !dy) continue;
  const fxT = errs(() => fx.b, test);
  const dyT = errs((r) => {
    const fam = families.find((f) => f[0] === dy.name);
    const val = fam[2](r);
    return (typeof val === 'number' && isFinite(val) && val >= dy.cut) ? dy.bLo : dy.bHi;
  }, test);
  sumFixFc += fxT.fc; sumDynFc += dyT.fc;
  sumFixEx += fxT.ex; sumDynEx += dyT.ex;
  if (dyT.fc < fxT.fc) wins++; else if (dyT.fc > fxT.fc) losses++;
}
console.log(`  FIXED    false cover ${sumFixFc}   exposure ${sumFixEx}`);
console.log(`  DYNAMIC  false cover ${sumDynFc}   exposure ${sumDynEx}`);
console.log(`  folds where dynamic won ${wins}, lost ${losses}, tied ${vids.length - wins - losses}`);
console.log('');
if (sumDynFc < sumFixFc && sumDynEx <= sumFixEx) {
  console.log('  DYNAMIC SURVIVES THE HELD-OUT SPLIT. The in-sample gain is real.');
} else {
  console.log('  DYNAMIC DOES NOT SURVIVE. The in-sample gain was the search');
  console.log('  fitting this corpus, not a property of the axis. Ship the');
  console.log('  fixed bar and say so.');
}
