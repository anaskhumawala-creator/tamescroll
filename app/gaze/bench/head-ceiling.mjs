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
const yOf = r => (r.who === 'man' ? 1 : 0);
const featOf = (r, kind) => kind === 'grey' ? r.greyDesc
  : kind === 'both' ? r.rgbDesc.concat(r.greyDesc)
    : r.rgbDesc;

console.log(NL + 'CEILING PROBE -- can ANY head beat the shipped one on this descriptor?');
console.log('  FairFace ' + ff.length + ' (train)   corpus ' + cp.length + ' (test)'
  + '   women ' + cp.filter(r => !yOf(r)).length + ' / men ' + cp.filter(yOf).length);

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// -------------------------------------------------------------- model
// One hidden ReLU layer (hidden 0 = plain logistic), Adam, L2 weight decay,
// early stopping on a held-out slice of the TRAINING domain.
function trainMlp(X, Y, D, opts) {
  const { hidden, epochs, seed, l2 = 1e-4, lr = 3e-3, batch = 64, val = null } = opts;
  const rand = rng(seed);
  const H = hidden | 0;
  const n = Y.length;
  const W1 = H ? new Float64Array(D * H) : null;
  const b1 = H ? new Float64Array(H) : null;
  if (H) { const s = Math.sqrt(2 / D); for (let i = 0; i < W1.length; i++) W1[i] = (rand() * 2 - 1) * s; }
  const W2 = new Float64Array(H || D);
  let b2 = 0;
  { const s = Math.sqrt(1 / (H || D)); for (let i = 0; i < W2.length; i++) W2[i] = (rand() * 2 - 1) * s; }

  const mk = a => (a ? new Float64Array(a.length) : null);
  const mW1 = mk(W1), vW1 = mk(W1), mb1 = mk(b1), vb1 = mk(b1);
  const mW2 = mk(W2), vW2 = mk(W2);
  let mb2 = 0, vb2 = 0, t = 0;
  const B1 = 0.9, B2 = 0.999, EPS = 1e-8;

  const fwd = (arr, off) => {
    let z = b2;
    if (H) {
      for (let j = 0; j < H; j++) {
        let a = b1[j]; const w = j * D;
        for (let d = 0; d < D; d++) a += W1[w + d] * arr[off + d];
        if (a > 0) z += W2[j] * a;
      }
    } else {
      for (let d = 0; d < D; d++) z += W2[d] * arr[off + d];
    }
    return 1 / (1 + Math.exp(-z));
  };
  const valLoss = () => {
    let L = 0;
    for (let i = 0; i < val.Y.length; i++) {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, fwd(val.X, i * D)));
      L += -(val.Y[i] * Math.log(p) + (1 - val.Y[i]) * Math.log(1 - p));
    }
    return L / val.Y.length;
  };
  const snap = () => ({ W1: W1 && W1.slice(), b1: b1 && b1.slice(), W2: W2.slice(), b2 });

  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  const h = H ? new Float64Array(H) : null;
  const gh = H ? new Float64Array(H) : null;
  let best = Infinity, bestW = null, bestEp = 0;

  for (let ep = 0; ep < epochs; ep++) {
    for (let i = n - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const q = idx[i]; idx[i] = idx[j]; idx[j] = q; }
    for (let s = 0; s < n; s += batch) {
      const end = Math.min(n, s + batch), m = end - s;
      t++;
      const gW1 = H ? new Float64Array(D * H) : null;
      const gb1 = H ? new Float64Array(H) : null;
      const gW2 = new Float64Array(W2.length);
      let gb2 = 0;
      for (let k = s; k < end; k++) {
        const off = idx[k] * D;
        let z = b2;
        if (H) {
          for (let j = 0; j < H; j++) {
            let a = b1[j]; const w = j * D;
            for (let d = 0; d < D; d++) a += W1[w + d] * X[off + d];
            h[j] = a > 0 ? a : 0;
            z += W2[j] * h[j];
          }
        } else {
          for (let d = 0; d < D; d++) z += W2[d] * X[off + d];
        }
        const dz = (1 / (1 + Math.exp(-z)) - Y[idx[k]]) / m;
        gb2 += dz;
        if (H) {
          for (let j = 0; j < H; j++) { gW2[j] += dz * h[j]; gh[j] = h[j] > 0 ? dz * W2[j] : 0; }
          for (let j = 0; j < H; j++) {
            const g = gh[j];
            if (g === 0) continue;
            const w = j * D;
            gb1[j] += g;
            for (let d = 0; d < D; d++) gW1[w + d] += g * X[off + d];
          }
        } else {
          for (let d = 0; d < D; d++) gW2[d] += dz * X[off + d];
        }
      }
      const bc1 = 1 - Math.pow(B1, t), bc2 = 1 - Math.pow(B2, t);
      const step = (P, G, M, V, i, wd) => {
        const g = G + wd * P[i];
        M[i] = B1 * M[i] + (1 - B1) * g;
        V[i] = B2 * V[i] + (1 - B2) * g * g;
        P[i] -= lr * (M[i] / bc1) / (Math.sqrt(V[i] / bc2) + EPS);
      };
      for (let i = 0; i < W2.length; i++) step(W2, gW2[i], mW2, vW2, i, l2);
      if (H) {
        for (let i = 0; i < W1.length; i++) step(W1, gW1[i], mW1, vW1, i, l2);
        for (let i = 0; i < H; i++) step(b1, gb1[i], mb1, vb1, i, 0);
      }
      mb2 = B1 * mb2 + (1 - B1) * gb2;
      vb2 = B2 * vb2 + (1 - B2) * gb2 * gb2;
      b2 -= lr * (mb2 / bc1) / (Math.sqrt(vb2 / bc2) + EPS);
    }
    if (val) { const L = valLoss(); if (L < best) { best = L; bestW = snap(); bestEp = ep + 1; } }
  }
  if (bestW) { if (W1) W1.set(bestW.W1); if (b1) b1.set(bestW.b1); W2.set(bestW.W2); b2 = bestW.b2; }
  const f = x => fwd(x, 0);
  f.valLoss = best;
  f.epoch = bestEp;
  return f;
}

function pack(rows, kind) {
  const D = featOf(rows[0], kind).length;
  const X = new Float64Array(rows.length * D);
  const Y = new Float64Array(rows.length);
  rows.forEach((r, i) => {
    const ft = featOf(r, kind);
    for (let d = 0; d < D; d++) X[i * D + d] = ft[d];
    Y[i] = yOf(r);
  });
  return { X, Y, D };
}

// Stratified split of the TRAINING domain. Selection never touches the test set.
function split(rows, frac, seed) {
  const rand = rng(seed);
  const by = { 0: [], 1: [] };
  for (const r of rows) by[yOf(r)].push(r);
  const tr = [], va = [];
  for (const k of ['0', '1']) {
    const a = by[k].slice();
    for (let i = a.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const q = a[i]; a[i] = a[j]; a[j] = q; }
    const cut = Math.round(a.length * frac);
    va.push(...a.slice(0, cut));
    tr.push(...a.slice(cut));
  }
  return [tr, va];
}

// ------------------------------------------------------- matched exposure
const TARGETS = [0.030, 0.024, 0.016, 0.010, 0.005];

function scoreArm(rows, score) {
  const F = [], M = [];
  for (const r of rows) (yOf(r) ? M : F).push(score(r));
  const cells = TARGETS.map(target => {
    let bar = null;
    for (let b = 0; b <= 1.0001; b += 0.0005) {
      let c = 0;
      for (const s of F) if (s >= b) c++;
      if (c / F.length <= target) { bar = b; break; }
    }
    if (bar === null) return null;
    let cov = 0;
    for (const s of M) if (!(s >= bar)) cov++;
    return cov / M.length;
  });
  // AUC, threshold-free: P(a random man scores above a random woman).
  const all = F.map(v => [v, 0]).concat(M.map(v => [v, 1])).sort((a, b) => a[0] - b[0]);
  let rank = 0, sumR = 0;
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j < all.length && all[j][0] === all[i][0]) j++;
    const avg = (i + j + 1) / 2;
    for (let k = i; k < j; k++) if (all[k][1] === 1) sumR += avg;
    i = j;
  }
  const auc = (sumR - M.length * (M.length + 1) / 2) / (M.length * F.length);
  return { cells, auc };
}

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

// The ceiling sweep. Selection is by FairFace validation logloss ONLY.
const GRID = QUICK
  ? [{ hidden: 0, l2: 1e-3 }, { hidden: 64, l2: 1e-3 }]
  : [
    { hidden: 0, l2: 1e-4 }, { hidden: 0, l2: 1e-3 }, { hidden: 0, l2: 1e-2 },
    { hidden: 32, l2: 1e-3 }, { hidden: 32, l2: 1e-2 },
    { hidden: 128, l2: 1e-3 }, { hidden: 128, l2: 1e-2 },
  ];

function fitBest(trainRows, kind, seed, tag) {
  const [tr, va] = split(trainRows, 0.2, 5150 + seed);
  const P = pack(tr, kind), V = pack(va, kind);
  let best = null;
  for (const g of GRID) {
    const f = trainMlp(P.X, P.Y, P.D, {
      hidden: g.hidden, l2: g.l2, epochs: EPOCHS, seed, val: { X: V.X, Y: V.Y },
    });
    if (!best || f.valLoss < best.f.valLoss) best = { f, g };
  }
  if (tag) console.log('    ' + tag + ' picked hidden=' + best.g.hidden
    + ' l2=' + best.g.l2 + ' epoch=' + best.f.epoch
    + ' valLoss=' + best.f.valLoss.toFixed(4));
  return best.f;
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
      const f = fitBest(ff, kind, 1234 + s * 977, s === 0 ? kind : null);
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
    const f = fitBest(sh, 'rgb', 7, 'shuffled');
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
        const f = fitBest(keep, kind, 808 + s * 131, null);
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
      const f = fitBest(cp.filter(r => r.vid !== v), kind, 555, null);
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
    const f = fitBest(tr, kind, 4711, 'race/' + kind);
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
