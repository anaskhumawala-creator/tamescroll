// THE HEAD TRAINER, SHARED. One copy, imported by every bench that fits a
// classifier on the banked [1024] faceres descriptor.
//
// WHY IT IS A MODULE AND NOT COPIED: phase-g caught me building three
// instruments in one session that each re-derived a rule they were meant
// to test, and each was a check that could not fail. The remedy worked all
// three times -- move it into a module, call it from both sides, delete
// the copy. A second copy of this trainer would drift from the first and
// the two benches would stop being comparable, which is exactly the
// failure that made findings 20/21/21a need re-running.
//
// *** THE DEFECT THIS TRAINER WAS BUILT AROUND, do not remove the
// validation split. The first version trained a fixed 60 epochs with
// hidden=128 on 1,348 rows -- 1,024 free parameters on 1,348 examples --
// and scored WORSE than a 6-epoch run (29.7% against 27.1% false cover at
// the <=1.6% exposure cell, and 100.0% at <=0.5%). Read straight that says
// "the trunk destroyed the information, no head can help", which is a
// conclusion that would have killed the whole head-retraining route. It
// was overfitting. Early stopping on a held-out slice of the TRAINING
// domain, with best-weight restore, is what makes the answer real.
//
// SELECTION NEVER TOUCHES THE TEST SET. `fitBest` sweeps its grid and
// picks by validation logloss inside the training domain only, so the
// evaluation domain stays clean.
//
// y = 1 for MAN. Clearing a woman is the EXPOSURE direction, so the
// scoring below is asymmetric on purpose and this label convention is
// load bearing -- flip it and every table inverts silently.

export const yOf = (r) => (r.who === 'man' ? 1 : 0);

export const featOf = (r, kind) => (kind === 'grey' ? r.greyDesc
  : kind === 'both' ? r.rgbDesc.concat(r.greyDesc)
    : r.rgbDesc);

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// One hidden ReLU layer (hidden 0 = plain logistic), Adam, L2 weight
// decay, early stopping on a held-out slice with best-weight restore.
export function trainMlp(X, Y, D, opts) {
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

  const mk = (a) => (a ? new Float64Array(a.length) : null);
  const mW1 = mk(W1); const vW1 = mk(W1); const mb1 = mk(b1); const vb1 = mk(b1);
  const mW2 = mk(W2); const vW2 = mk(W2);
  let mb2 = 0; let vb2 = 0; let t = 0;
  const B1 = 0.9; const B2 = 0.999; const EPS = 1e-8;

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
  let best = Infinity; let bestW = null; let bestEp = 0;

  for (let ep = 0; ep < epochs; ep++) {
    for (let i = n - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const q = idx[i]; idx[i] = idx[j]; idx[j] = q; }
    for (let s = 0; s < n; s += batch) {
      const end = Math.min(n, s + batch); const m = end - s;
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
      const bc1 = 1 - Math.pow(B1, t); const bc2 = 1 - Math.pow(B2, t);
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
  const f = (x) => fwd(x, 0);
  f.valLoss = best;
  f.epoch = bestEp;
  return f;
}

export function pack(rows, kind) {
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

// Stratified split of the TRAINING domain. Selection never touches test.
export function split(rows, frac, seed) {
  const rand = rng(seed);
  const by = { 0: [], 1: [] };
  for (const r of rows) by[yOf(r)].push(r);
  const tr = []; const va = [];
  for (const k of ['0', '1']) {
    const a = by[k].slice();
    for (let i = a.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const q = a[i]; a[i] = a[j]; a[j] = q; }
    const cut = Math.round(a.length * frac);
    va.push(...a.slice(0, cut));
    tr.push(...a.slice(cut));
  }
  return [tr, va];
}

// *** MATCHED EXPOSURE, AND EVERY TABLE IN THIS REPO DEPENDS ON IT.
// The clear bar sits far above the label boundary -- GENDER_CLEAR_SCORE
// 0.45 male means raw >= 0.725 -- so a label flip between 0.50 and 0.725
// changes NOTHING that ships. And any arm can win an accuracy column by
// simply leaning female, which is a threshold move in disguise. So each
// arm solves its OWN bar to a COMMON woman-exposure and only then is
// false cover on men read. Findings 29, 40, 41, 45 and 47 all turn on
// this, and each was nearly reported wrong without it.
export const TARGETS = [0.030, 0.024, 0.016, 0.010, 0.005];

export function scoreArm(rows, score) {
  const F = []; const M = [];
  for (const r of rows) (yOf(r) ? M : F).push(score(r));
  const cells = TARGETS.map((target) => {
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
  // AUC beside it, threshold-free: P(a random man scores above a random
  // woman). A matched-exposure table can be moved by the bar solver; AUC
  // cannot, so an arm that wins one and loses the other is a threshold
  // effect and not a better model.
  const all = F.map((v) => [v, 0]).concat(M.map((v) => [v, 1])).sort((a, b) => a[0] - b[0]);
  let sumR = 0;
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

export const FULL_GRID = [
  { hidden: 0, l2: 1e-4 }, { hidden: 0, l2: 1e-3 }, { hidden: 0, l2: 1e-2 },
  { hidden: 32, l2: 1e-3 }, { hidden: 32, l2: 1e-2 },
  { hidden: 128, l2: 1e-3 }, { hidden: 128, l2: 1e-2 },
];
export const QUICK_GRID = [{ hidden: 0, l2: 1e-3 }, { hidden: 64, l2: 1e-3 }];

export function fitBest(trainRows, kind, seed, opts) {
  const { epochs = 40, grid = FULL_GRID, tag = null, valFrac = 0.2 } = opts || {};
  const [tr, va] = split(trainRows, valFrac, 5150 + seed);
  const P = pack(tr, kind); const V = pack(va, kind);
  let best = null;
  for (const g of grid) {
    const f = trainMlp(P.X, P.Y, P.D, {
      hidden: g.hidden, l2: g.l2, epochs, seed, val: { X: V.X, Y: V.Y },
    });
    if (!best || f.valLoss < best.f.valLoss) best = { f, g };
  }
  if (tag) {
    console.log('    ' + tag + ' picked hidden=' + best.g.hidden
      + ' l2=' + best.g.l2 + ' epoch=' + best.f.epoch
      + ' valLoss=' + best.f.valLoss.toFixed(4)
      + '  (n=' + tr.length + ')');
  }
  best.f.config = best.g;
  return best.f;
}
