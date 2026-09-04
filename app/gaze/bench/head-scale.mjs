// RETRAIN THE GENDER HEAD ON DELIBERATELY SHRUNK AND DEGRADED FACES.
//
// HIS ORDER: "Okay then retrain it on deliberately shrunk and degraded
// photos then. Do it properly."
//
// WHY IT IS THE RIGHT MOVE, and it comes out of a measured failure. The
// ceiling probe answered the head-vs-trunk question: a retrained head
// takes Indian women 44.4% -> 16.2% wrong and Black women 53.1% -> 30.3%
// on held-out FairFace, so THE TRUNK IS NOT THE WALL, THE HEAD IS. But
// the deployable arm -- train on FairFace, evaluate on HIS corpus at
// matched exposure -- came out WORSE than the shipped head (23.8% against
// 21.8% at the <=1.6% cell). The gap is the DOMAIN: FairFace is clean
// 224px portraits and his faces arrive at 34-192px off a 360p stream
// (finding 37), where finding 47 measured the model leaning male as
// resolution falls.
//
// So the training data has to look like his faces. Each FairFace crop is
// degraded to a native size through `bench/gpu/arms.degrade` -- box-filter
// down (no aliasing), bilinear up (what cropAndResize does) -- and banked
// at 24/32/40/48/64/96/128/192 px. That is the same transform the player
// imposes, applied on purpose.
//
// *** THE CONTROL THAT MAKES THIS HONEST: THE SPLIT IS BY FACE, NOT BY
// ROW. The same person appears eight times in the augmented set, once per
// size. Split at random and ff01234 trains at 24px and tests at 32px --
// the model has seen that exact face and the augmented arm wins by
// leakage, not by generalising. Splitting on the FairFace `row` id keeps
// every copy of a face on one side. Getting this wrong is the single
// easiest way to manufacture a result here.
//
// Judged PER RACE on the WORST group, per his ruling: "I need every
// single phase to work properly. People watch videos throughout the world.
// It isn't restricted to India or some other country." A change that
// improves the mean while Indian and Black women stay put is a failure.
//
//   node app/gaze/bench/head-scale.mjs
//   node app/gaze/bench/head-scale.mjs --quick=1
//   node app/gaze/bench/head-scale.mjs --kind=grey
import fs from 'fs';
import {
  yOf, fitBest, pack, featOf, scoreArm, TARGETS, split, rng,
  FULL_GRID, QUICK_GRID,
} from './head-train.mjs';

const NL = String.fromCharCode(10);
const BANK = 'Z:/tamescroll-corpus/bank/';
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith('--' + k + '='));
  return h ? h.slice(k.length + 3) : d;
};
const QUICK = arg('quick', '0') === '1';
const KIND = arg('kind', 'rgb');
const SEEDS = Number(arg('seeds', QUICK ? '1' : '3'));
const EPOCHS = Number(arg('epochs', QUICK ? '12' : '40'));
const GRID = QUICK ? QUICK_GRID : FULL_GRID;
const SIZES = arg('sizes', '24,32,40,48,64,96,128,192').split(',').map(Number);

const load = (n) => {
  const p = BANK + n + '.json';
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

// Full-resolution FairFace (224px, the clean portraits) is the BASELINE
// training domain -- what the ceiling probe used and what lost.
const full = load('gpu-fairfull-desc');
if (!full) throw new Error('gpu-fairfull-desc.json missing -- bank it first');
for (const r of full) r.nativePx = 224;

// The degraded banks. A missing size is skipped LOUDLY rather than
// silently changing the experiment: an augmented arm quietly trained on
// two sizes instead of eight would read as "augmentation does not help".
const banks = [full];
const missing = [];
for (const s of SIZES) {
  const b = load('gpu-ff-s' + s);
  if (b) banks.push(b); else missing.push(s);
}
if (missing.length) {
  console.log(NL + '*** SIZES NOT BANKED, THIS RUN IS NOT THE FULL EXPERIMENT: '
    + missing.join(',') + ' ***');
}
const have = banks.map((b) => b[0].nativePx);

// Rows carrying a usable descriptor for the requested arm.
const usable = (r) => Array.isArray(r.rgbDesc) && Array.isArray(r.greyDesc)
  && (r.who === 'man' || r.who === 'woman');
const all = [];
for (const b of banks) for (const r of b) if (usable(r)) all.push(r);

console.log(NL + 'SCALE-AUGMENTED HEAD RETRAIN   arm ' + KIND
  + '   seeds ' + SEEDS + '   epochs ' + EPOCHS + (QUICK ? '  (QUICK)' : ''));
console.log('  sizes banked ' + have.join(', ') + ' px');
console.log('  rows ' + all.length + '  over ' + new Set(all.map((r) => r.row)).size + ' distinct faces');

// -------------------------------------------------- split BY FACE
const faces = [...new Set(all.map((r) => r.row))];
// Stratify the FACE split by gender so a small test set stays balanced.
const faceGender = new Map();
for (const r of all) faceGender.set(r.row, r.who);
function splitFaces(seed, frac) {
  const rand = rng(seed);
  const by = { man: [], woman: [] };
  for (const f of faces) by[faceGender.get(f)].push(f);
  const te = new Set();
  for (const k of ['man', 'woman']) {
    const a = by[k].slice();
    for (let i = a.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const q = a[i]; a[i] = a[j]; a[j] = q; }
    for (const f of a.slice(0, Math.round(a.length * frac))) te.add(f);
  }
  return te;
}

// ------------------------------------------------------------- report
const fmt = (c) => (c === null ? 'n/a' : (100 * c).toFixed(1) + '%').padStart(8);
function table(title, rows) {
  console.log(NL + '  ' + title);
  console.log('  ' + 'arm'.padEnd(24) + TARGETS.map((t) => ('<=' + (t * 100).toFixed(1) + '%').padStart(8)).join('') + '     AUC');
  for (const r of rows) {
    console.log('  ' + r.name.padEnd(24) + r.cells.map(fmt).join('')
      + '   ' + r.auc.toFixed(4) + (r.note ? '   ' + r.note : ''));
  }
}
const meanRuns = (runs) => ({
  cells: TARGETS.map((_, i) => {
    const v = runs.map((r) => r.cells[i]).filter((x) => x !== null);
    return v.length === runs.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }),
  auc: runs.reduce((a, r) => a + r.auc, 0) / runs.length,
});

// =====================================================================
// ARM 1 -- HELD-OUT FairFace, PER SIZE. Does augmentation buy anything
// where his faces actually live?
// =====================================================================
console.log(NL + '=== ARM 1: held-out FairFace, evaluated PER NATIVE SIZE');
console.log('    Split is BY FACE, so no face appears in train and test at any size.');
const perSize = {};
for (const s of have) perSize[s] = { base: [], aug: [] };
const raceRuns = { base: [], aug: [] };

for (let seed = 1; seed <= SEEDS; seed++) {
  const te = splitFaces(9000 + seed, 0.25);
  const trAll = all.filter((r) => !te.has(r.row));
  const teAll = all.filter((r) => te.has(r.row));
  const trFull = trAll.filter((r) => r.nativePx === 224);

  const fBase = fitBest(trFull, KIND, seed, { epochs: EPOCHS, grid: GRID, tag: 'seed ' + seed + ' BASE (224 only)' });
  const fAug = fitBest(trAll, KIND, seed, { epochs: EPOCHS, grid: GRID, tag: 'seed ' + seed + ' AUG  (all sizes)' });

  const scorer = (f) => {
    const cache = new Map();
    return (r) => {
      if (!cache.has(r)) cache.set(r, f(Float64Array.from(featOf(r, KIND))));
      return cache.get(r);
    };
  };
  const sB = scorer(fBase); const sA = scorer(fAug);

  for (const s of have) {
    const sub = teAll.filter((r) => r.nativePx === s);
    if (sub.length < 50) continue;
    perSize[s].base.push(scoreArm(sub, sB));
    perSize[s].aug.push(scoreArm(sub, sA));
  }
  // Per race, pooled over the sizes in HIS band (finding 37: 34-192px).
  const band = teAll.filter((r) => r.nativePx <= 192);
  // One global bar per arm, solved to a COMMON men-cover budget, so the
  // per-race table below compares two arms at the same protection cost
  // rather than at two different operating points.
  const MEN_COVER = Number(arg('cover', '0.10'));
  const solveBar = (s) => {
    const men = band.filter(yOf).map(s).sort((a, b) => a - b);
    // The bar that leaves at most MEN_COVER of men covered (scored below it).
    const idx = Math.min(men.length - 1, Math.floor(men.length * MEN_COVER));
    return men[idx];
  };
  raceRuns.base.push({ rows: band, s: sB, bar: solveBar(sB) });
  raceRuns.aug.push({ rows: band, s: sA, bar: solveBar(sA) });
}

const t1 = [];
for (const s of have) {
  if (!perSize[s].base.length) continue;
  const b = meanRuns(perSize[s].base); const a = meanRuns(perSize[s].aug);
  t1.push({ name: s + 'px  base (224 only)', cells: b.cells, auc: b.auc });
  t1.push({
    name: s + 'px  AUGMENTED',
    cells: a.cells,
    auc: a.auc,
    note: a.auc > b.auc ? 'AUC +' + (a.auc - b.auc).toFixed(4) : 'AUC ' + (a.auc - b.auc).toFixed(4),
  });
}
table('FALSE COVER ON MEN at a common woman-exposure -- lower is better', t1);
console.log('  If AUGMENTED only wins at 224px, augmentation did nothing and the');
console.log('  domain gap is elsewhere. If it wins at 24-64px -- his own band --');
console.log('  that is the result the corpus arm below has to confirm.');

// =====================================================================
// ARM 2 -- PER RACE, worst group, in his size band. His ruling.
// =====================================================================
console.log(NL + '=== ARM 2: PER RACE in his 24-192px band, WORST GROUP DECIDES');
console.log('  Each arm at its OWN single global bar, solved to the same men-cover');
console.log('  budget (' + (100 * Number(arg('cover', '0.10'))).toFixed(0) + '%), so the two are compared at equal protection cost.');
const races = [...new Set(all.map((r) => r.race))].filter(Boolean).sort();
console.log('  ' + 'race'.padEnd(18) + 'n(w)'.padStart(7) + 'base'.padStart(9) + 'aug'.padStart(9) + 'delta'.padStart(9));
const worst = { base: 0, aug: 0 };
for (const race of races) {
  const cells = { base: [], aug: [] };
  for (const k of ['base', 'aug']) {
    for (const run of raceRuns[k]) {
      const sub = run.rows.filter((r) => r.race === race);
      if (sub.length < 40) continue;
      const w = sub.filter((r) => !yOf(r));
      if (!w.length) continue;
      // *** AT THE ARM'S OWN MATCHED BAR, NOT THE 0.5 LABEL BOUNDARY.
      // The first version of this arm read women-wrong at raw >= 0.5 and
      // reported the augmented head making Black women 6.7 points WORSE
      // while ARM 1 showed it better at every size on every cell. Both
      // were right: the augmented head separates better AND sits at a
      // different operating point, and a raw-boundary read cannot tell
      // those apart. That is the rule findings 29, 40, 41, 45 and 47 each
      // nearly got reported wrong on -- an arm wins any accuracy column
      // by leaning, which is a threshold move in disguise.
      //
      // The shipped system has ONE global bar, so the honest per-race
      // read is: solve the arm's single bar on the whole band to a common
      // MEN-cover budget, then read each race at that one bar.
      cells[k].push(w.filter((r) => run.s(r) >= run.bar).length / w.length);
    }
  }
  if (!cells.base.length) continue;
  const mb = cells.base.reduce((a, b) => a + b, 0) / cells.base.length;
  const ma = cells.aug.reduce((a, b) => a + b, 0) / cells.aug.length;
  worst.base = Math.max(worst.base, mb);
  worst.aug = Math.max(worst.aug, ma);
  const n = raceRuns.base[0].rows.filter((r) => r.race === race && !yOf(r)).length;
  console.log('  ' + race.padEnd(18) + String(n).padStart(7)
    + (100 * mb).toFixed(1).padStart(8) + '%'
    + (100 * ma).toFixed(1).padStart(8) + '%'
    + ((ma - mb >= 0 ? '+' : '') + (100 * (ma - mb)).toFixed(1)).padStart(9));
}
console.log('  ' + 'WORST GROUP'.padEnd(18) + ''.padStart(7)
  + (100 * worst.base).toFixed(1).padStart(8) + '%'
  + (100 * worst.aug).toFixed(1).padStart(8) + '%'
  + ((worst.aug - worst.base >= 0 ? '+' : '') + (100 * (worst.aug - worst.base)).toFixed(1)).padStart(9));

// =====================================================================
// ARM 3 -- THE DEPLOYABLE ONE. Train on FairFace, evaluate on HIS
// corpus. Different people, different footage, so it cannot flatter
// itself -- and it is the arm the ceiling probe LOST.
// =====================================================================
const cp = (load('gpu-corpus-desc') || []).filter(usable);
if (!cp.length) {
  console.log(NL + '=== ARM 3 skipped: gpu-corpus-desc.json missing');
} else {
  console.log(NL + '=== ARM 3: TRAIN ON FairFace, EVALUATE ON HIS CORPUS (the deployable arm)');
  console.log('  ' + cp.length + ' labelled reads, women ' + cp.filter((r) => !yOf(r)).length
    + ' / men ' + cp.filter(yOf).length);
  const runs = { base: [], aug: [] };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const trFull = all.filter((r) => r.nativePx === 224);
    const fBase = fitBest(trFull, KIND, seed, { epochs: EPOCHS, grid: GRID, tag: 'seed ' + seed + ' BASE' });
    const fAug = fitBest(all, KIND, seed, { epochs: EPOCHS, grid: GRID, tag: 'seed ' + seed + ' AUG ' });
    const mk = (f) => (r) => f(Float64Array.from(featOf(r, KIND)));
    runs.base.push(scoreArm(cp, mk(fBase)));
    runs.aug.push(scoreArm(cp, mk(fAug)));
  }
  const b = meanRuns(runs.base); const a = meanRuns(runs.aug);
  // The two things that ALREADY ship, as the bar to beat. Reproducing
  // finding 47 to the tenth is the control that says the instrument is
  // sound -- rgb 21.8% / grey 18.2% at the <=1.6% cell.
  const shipRgb = scoreArm(cp, (r) => r.rgb.raw);
  const shipGrey = scoreArm(cp, (r) => r.grey.raw);
  table('FALSE COVER ON MEN at a common woman-exposure -- lower is better', [
    { name: 'SHIPPED head (rgb)', cells: shipRgb.cells, auc: shipRgb.auc, note: 'finding 47 control' },
    { name: 'SHIPPED head + GREY', cells: shipGrey.cells, auc: shipGrey.auc, note: 'the bar to beat' },
    { name: 'retrained, 224 only', cells: b.cells, auc: b.auc, note: 'the arm that LOST' },
    { name: 'retrained, AUGMENTED', cells: a.cells, auc: a.auc },
  ]);
  console.log(NL + '  THE GATE: the augmented head must beat SHIPPED+GREY at the <=1.6%');
  console.log('  cell AND on AUC. Beating "224 only" merely proves the degradation');
  console.log('  transform did something; beating grey is what would ship.');
}
console.log('');
