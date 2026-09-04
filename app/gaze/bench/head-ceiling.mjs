// THE CEILING PROBE -- IS THE GENDER HEAD THE WALL, OR IS THE TRUNK?
//
// faceres is a trunk plus thin heads. The [1024] descriptor is what the
// trunk extracted; the gender sigmoid is a small head reading it. Both
// fall out of ONE forward pass and both are banked (gpu-*-desc.json).
//
// Finding 46 measured pearson(head raw, probe) = 0.893 and concluded a
// LINEAR probe is the same opinion read one layer earlier. That kills the
// veto. It does NOT answer the question the accuracy programme now turns
// on:
//
//     Is there information in the descriptor that the shipped head is
//     THROWING AWAY -- enough to matter for women?
//
// If yes: retrain the head. ~4KB of weights, same forward pass, zero extra
// inference, no new model, no licence question. A day.
// If no: the trunk destroyed it before the head ever saw it, no head work
// of any kind can help, and every remaining head idea can be abandoned on
// this one number. The only route left is a different gender model.
//
// THIS IS A CEILING, NOT A PROPOSAL. It fits the best classifier it can on
// the descriptor with no regard for runtime cost, precisely so that a LOSS
// is decisive: nothing below a ceiling can beat it.
//
// TWO ARMS:
//  (1) TRANSFER -- train on FairFace real labels, test on HIS corpus.
//      Different people, footage and capture. The deployable test, and the
//      exact shape of the fine-tune the 2026-09-04 handoff proposed.
//  (2) LEAVE-ONE-VIDEO-OUT on the corpus itself. No domain gap, so this is
//      the PURE information-content bound -- what is recoverable from the
//      descriptor at all on his own footage. Under-powered (52 identities,
//      ten videos, mostly white presenters): a bound, not a plan.
//
// THREE CONTROLS, because this repo has shipped checks that could not fail:
//   * SHUFFLED LABELS must land at chance. If a shuffled arm wins, the
//     scoring leaks and every number here is void.
//   * the shipped head is re-scored from the same rows through the same
//     matched-exposure code, so the baseline cannot drift. It must
//     reproduce finding 47 (14.9/19.2/21.8/26.0/35.1) to the tenth.
//   * MODEL SELECTION IS ON A FAIRFACE VALIDATION SPLIT ONLY, never on the
//     corpus. Picking the config by test score would manufacture a ceiling.
//     Early stopping runs on that same split. The first version of this
//     bench trained a fixed 60 epochs and OVERFIT (1,024 free parameters on
//     1,348 rows) -- it scored WORSE than 6 epochs, which would have read
//     as "the trunk is the wall" when it was only a training defect.
//
// SCORED AT MATCHED EXPOSURE, always: any arm wins an accuracy column by
// leaning female, which is a threshold move in disguise. Each arm solves
// its OWN bar to a common woman-exposure, and only then is false cover on
// men read. AUC is printed beside it as the threshold-free check -- if an
// arm's AUC is higher but its matched table loses, that is a calibration
// story; if AUC is not higher, there is no information to recover.
import fs from 'fs';

const NL = String.fromCharCode(10);
const BANK = 'Z:/tamescroll-corpus/bank/';
// --ff=gpu-fairfull-desc selects the FULL 10,954-row validation split.
// The 1,348-row default is the sample every published FairFace figure
// was measured on; both are the same labelling (verified by pixel MD5).
const FAIRFACE = BANK + (process.argv.find(a => a.startsWith('--ff='))
  ? process.argv.find(a => a.startsWith('--ff=')).slice(5) : 'gpu-fairface-desc') + '.json';
const CORPUS = 'Z:/tamescroll-corpus/bank/gpu-corpus-desc.json';

const args = new Map(process.argv.slice(2).map(a => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), '1'] : [a.slice(2, i), a.slice(i + 1)];
}));
const EPOCHS = Number(args.get('epochs') || 80);
const SEEDS = Number(args.get('seeds') || 3);
const ARM = args.get('arm') || 'both';
const QUICK = args.has('quick');

// ---------------------------------------------------------------- data
function load(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8')).filter(r =>
    (r.who === 'man' || r.who === 'woman')
    && Array.isArray(r.rgbDesc) && Array.isArray(r.greyDesc)
    && r.rgb && Number.isFinite(r.rgb.raw)
    && r.grey && Number.isFinite(r.grey.raw));
}
const ff = load(FAIRFACE);
const cp = load(CORPUS);

// y = 1 for MAN. Clearing a man is the action; clearing a WOMAN is exposure.
// The trainer, the packer, the face/label convention and the
// matched-exposure scorer all live in head-train.mjs -- ONE copy, shared
// with head-scale.mjs. Two copies would drift and the two benches would
// stop being comparable, which is the phase-g G1 failure.
import {
  yOf, featOf, trainMlp, pack, split, scoreArm, TARGETS, rng,
  fitBest as FITBEST_, FULL_GRID, QUICK_GRID,
} from './head-train.mjs';

const GRID = QUICK ? QUICK_GRID : FULL_GRID;
const FITBEST = (rows, kind, seed, tag) =>
  FITBEST_(rows, kind, seed, { epochs: EPOCHS, grid: GRID, tag });

console.log(NL + 'CEILING PROBE -- can ANY head beat the shipped one on this descriptor?');
console.log('  FairFace ' + ff.length + ' (train)   corpus ' + cp.length + ' (test)'
  + '   women ' + cp.filter(r => !yOf(r)).length + ' / men ' + cp.filter(yOf).length);

// ------------------------------------------------------- matched exposure
const table = [];
const row = (name, r, note) => table.push({ name, cells: r.cells, auc: r.auc, note });
function printTable(title) {
  console.log(NL + title);
  console.log('  FALSE COVER ON MEN at a common woman-exposure -- lower is better');
  console.log('  ' + 'arm'.padEnd(26) + TARGETS.map(t => ('<=' + (t * 100).toFixed(1) + '%').padStart(8)).join('') + '     AUC');
  for (const r of table) {
    console.log('  ' + r.name.padEnd(26)
      + r.cells.map(c => (c === null ? 'n/a' : (100 * c).toFixed(1) + '%').padStart(8)).join('')
      + '   ' + r.auc.toFixed(4)
      + (r.note ? '   ' + r.note : ''));
  }
  table.length = 0;
}

function armMean(runs) {
  const cells = TARGETS.map((_, i) => {
    const v = runs.map(r => r.cells[i]).filter(x => x !== null);
    return v.length === runs.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
  const auc = runs.reduce((a, r) => a + r.auc, 0) / runs.length;
  const spread = TARGETS.map((_, i) => {
    const v = runs.map(r => r.cells[i]).filter(x => x !== null);
    return v.length ? (100 * (Math.max(...v) - Math.min(...v))).toFixed(1) : '--';
  });
  return { cells, auc, spread };
}

// ============================================================ ARM 1
if (ARM === 'both' || ARM === 'transfer') {
  console.log(NL + '=== ARM 1 -- TRAIN ON FAIRFACE REAL LABELS, TEST ON HIS CORPUS ===');
  row('head alone (SHIPS)', scoreArm(cp, r => r.rgb.raw), 'must match finding 47');
  row('grey head', scoreArm(cp, r => r.grey.raw), 'finding 41/47 control');

  for (const kind of ['rgb', 'grey', 'both']) {
    const runs = [];
    for (let s = 0; s < SEEDS; s++) {
      const f = FITBEST(ff, kind, 1234 + s * 977, s === 0 ? kind : null);
      const cache = new Map();
      for (const r of cp) cache.set(r, f(featOf(r, kind)));
      runs.push(scoreArm(cp, r => cache.get(r)));
    }
    const m = armMean(runs);
    row('CEILING on ' + kind + 'Desc', m, 'seed spread ' + m.spread.join('/') + ' pts');
  }

  // CONTROL: labels shuffled inside the training domain. Must be chance.
  {
    const sh = ff.map(r => ({ ...r }));
    const rand = rng(99);
    const lab = sh.map(yOf);
    for (let i = lab.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const q = lab[i]; lab[i] = lab[j]; lab[j] = q; }
    sh.forEach((r, i) => { r.who = lab[i] ? 'man' : 'woman'; });
    const f = FITBEST(sh, 'rgb', 7, 'shuffled');
    const cache = new Map();
    for (const r of cp) cache.set(r, f(featOf(r, 'rgb')));
    row('CONTROL shuffled labels', scoreArm(cp, r => cache.get(r)), 'AUC must be ~0.5');
  }

  printTable('ARM 1 RESULT -- FairFace -> corpus (deployable)');
}

// ======================================================= LEARNING CURVE
// THE CONFOUND THIS CONTROLS FOR, and without it the whole bench is void.
// The shipped head was trained by its authors on a large face corpus. The
// ceiling above is refit on 1,348 FairFace rows. So "the probe is worse"
// has TWO possible causes and they demand opposite decisions:
//   (a) the trunk destroyed the information  -> different model, stop
//       spending nights on heads;
//   (b) 1,348 rows is simply not enough to relearn it -> get more labels,
//       the head is still the cheap fix.
// A learning curve separates them. Train on a growing fraction and watch
// test AUC. PLATEAUED means more data will not rescue it and (a) holds.
// STILL CLIMBING means the bench is under-powered and (b) is live -- and
// the honest report is "unknown", not "the trunk is the wall".
if (ARM === 'both' || ARM === 'curve') {
  console.log(NL + '=== SAMPLE-SIZE CONTROL -- is the ceiling data-starved? ===');
  console.log('  Test AUC on his corpus against training rows. The shipped head sits');
  console.log('  at ' + scoreArm(cp, r => r.rgb.raw).auc.toFixed(4) + ' (rgb) / '
    + scoreArm(cp, r => r.grey.raw).auc.toFixed(4) + ' (grey).');
  console.log('  ' + 'train rows'.padEnd(12) + 'AUC rgbDesc'.padStart(14) + 'AUC greyDesc'.padStart(14));
  for (const frac of [0.25, 0.5, 0.75, 1.0]) {
    const [keep] = split(ff, 1 - frac, 31337);
    const cells = [];
    for (const kind of ['rgb', 'grey']) {
      const runs = [];
      for (let s = 0; s < Math.min(2, SEEDS); s++) {
        const f = FITBEST(keep, kind, 808 + s * 131, null);
        const cache = new Map();
        for (const r of cp) cache.set(r, f(featOf(r, kind)));
        runs.push(scoreArm(cp, r => cache.get(r)).auc);
      }
      cells.push((runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(4));
    }
    console.log('  ' + String(keep.length).padEnd(12) + cells[0].padStart(14) + cells[1].padStart(14));
  }
  console.log('  Flat across the last two rows = more FairFace labels do not rescue it.');
}

// ============================================================ ARM 2
if (ARM === 'both' || ARM === 'lovo') {
  console.log(NL + '=== ARM 2 -- LEAVE-ONE-VIDEO-OUT ON HIS CORPUS (pure bound) ===');
  row('head alone (SHIPS)', scoreArm(cp, r => r.rgb.raw));
  row('grey head', scoreArm(cp, r => r.grey.raw));

  for (const kind of ['rgb', 'grey']) {
    const vids = [...new Set(cp.map(r => r.vid))];
    const cache = new Map();
    for (const v of vids) {
      const f = FITBEST(cp.filter(r => r.vid !== v), kind, 555, null);
      for (const r of cp) if (r.vid === v) cache.set(r, f(featOf(r, kind)));
    }
    row('LOVO CEILING on ' + kind + 'Desc', scoreArm(cp, r => cache.get(r)));
  }

  printTable('ARM 2 RESULT -- leave-one-video-out on the corpus');
}

// ================================================== ARM 3 -- PER RACE
// THE ARM THAT ACTUALLY DECIDES IT, and the one the first version of this
// bench was missing.
//
// Arms 1 and 2 score on HIS corpus: ten videos, 52 identities, mostly
// white presenters. Judging a global product on that is the exact mistake
// finding 31 exists to prevent -- the shipped head is 31.6% wrong on white
// women and 52.6% wrong on Indian women, so a corpus-only score hides the
// worst half of the defect and would ship a head tuned for one population.
//
// So: train on FairFace, test on HELD-OUT FairFace, and report WOMEN WRONG
// PER RACE. The number that matters is the WORST GROUP, never the mean.
//
// Held out by ROW, stratified on (race,gender). FairFace crops are one
// image per identity, so a row split does not leak a person across the
// fence the way the corpus would.
//
// SCORED AT THE LABEL BOUNDARY (0.5) rather than at matched exposure,
// because finding 31's published table is scored that way and this arm has
// to reproduce it for the shipped column or the harness is not trustworthy.
// The matched-exposure question is arms 1 and 2's job.
if (ARM === 'both' || ARM === 'race') {
  console.log(NL + '=== ARM 3 -- TRAIN ON FAIRFACE, TEST ON HELD-OUT FAIRFACE, PER RACE ===');
  console.log('Women wrong at the 0.5 label boundary. WORST GROUP is the number that');
  console.log('matters -- a global product cannot be judged on his ten videos.');

  const [tr, te] = split(ff, 0.25, 20260904);
  console.log('  train ' + tr.length + '   held-out ' + te.length);

  const races = [...new Set(ff.map(r => r.race))].sort();
  const wrongBy = (rows, score) => {
    const out = {};
    for (const race of races) {
      const w = rows.filter(r => r.race === race && !yOf(r));
      const m = rows.filter(r => r.race === race && yOf(r));
      out[race] = {
        w: w.length ? w.filter(r => score(r) >= 0.5).length / w.length : null,
        m: m.length ? m.filter(r => score(r) < 0.5).length / m.length : null,
        n: w.length,
      };
    }
    const aw = rows.filter(r => !yOf(r));
    out.ALL = { w: aw.filter(r => score(r) >= 0.5).length / aw.length, m: null, n: aw.length };
    return out;
  };

  const cols = races.concat(['ALL']);
  const lines = [];
  const add = (name, score, note) => {
    const t = wrongBy(te, score);
    const worst = races.reduce((a, r) => Math.max(a, t[r].w), 0);
    lines.push({ name, t, worst, note });
  };

  add('head alone (SHIPS)', r => r.rgb.raw, 'cf finding 31');
  add('grey head', r => r.grey.raw, '');
  for (const kind of ['rgb', 'grey']) {
    const f = FITBEST(tr, kind, 4711, 'race/' + kind);
    const cache = new Map();
    for (const r of te) cache.set(r, f(featOf(r, kind)));
    add('RETRAINED head on ' + kind, r => cache.get(r), '');
  }

  console.log(NL + '  WOMEN WRONG, by race (held-out FairFace)');
  console.log('  ' + 'arm'.padEnd(24) + cols.map(c => c.slice(0, 7).padStart(9)).join('') + '    WORST');
  for (const L of lines) {
    console.log('  ' + L.name.padEnd(24)
      + cols.map(c => (L.t[c].w === null ? '--' : (100 * L.t[c].w).toFixed(1) + '%').padStart(9)).join('')
      + '   ' + (100 * L.worst).toFixed(1) + '%'
      + (L.note ? '   ' + L.note : ''));
  }
  console.log(NL + '  MEN WRONG, by race (the cost side -- false cover)');
  console.log('  ' + 'arm'.padEnd(24) + races.map(c => c.slice(0, 7).padStart(9)).join(''));
  for (const L of lines) {
    console.log('  ' + L.name.padEnd(24)
      + races.map(c => (L.t[c].m === null ? '--' : (100 * L.t[c].m).toFixed(1) + '%').padStart(9)).join(''));
  }
  console.log(NL + '  A retrained head is only worth shipping if it moves the WORST group.');
  console.log('  Improving the mean while Indian and Black women stay where they are');
  console.log('  is the failure mode this arm exists to catch.');
}
console.log(NL + 'READ IT THIS WAY:');
console.log('  A ceiling BEATING the shipped head at his operating point (exposure');
console.log('  <= 1.6%) means the HEAD is the wall -- retrain it, ~4KB of weights,');
console.log('  same forward pass, no new model, no licence question.');
console.log('  A ceiling LOSING -- and losing on AUC especially -- means the TRUNK');
console.log('  destroyed the information before the head saw it. No head work of any');
console.log('  kind can help, and the only route left is a different gender model.' + NL);
