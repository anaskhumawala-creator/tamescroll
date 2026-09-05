// IS THE STUDENT A SECOND OPINION, OR THE SAME OPINION?
//
//   node app/gaze/bench/student-ensemble.mjs
//
// The student reaches AUC ~0.87 on his corpus against the shipped
// model's 0.9855, so it cannot REPLACE faceres. That is not the only
// question worth asking about it.
//
// A weaker model that is WRONG IN DIFFERENT PLACES can still improve a
// stronger one -- that is the whole basis of ensembling, and it turns on
// correlation rather than on accuracy. Two models at 0.98 and 0.87 that
// agree everywhere are one model; the same two disagreeing on
// independent errors beat either alone.
//
// FINDING 46 IS WHY THIS FILE EXISTS AND WHY IT MUST BE MEASURED RATHER
// THAN ASSUMED IN EITHER DIRECTION. That round proposed a descriptor
// veto -- the faceres head proposes a clear, a probe on the faceres
// descriptor may only refuse it -- and it LOST at every matched-exposure
// point. The mechanism was measured: pearson(head raw, probe) = 0.893.
// It was the same signal read off an earlier layer, not a second
// opinion, and its per-group error split looked independent because of
// Simpson's paradox.
//
// The consequence that round drew was: "every remaining idea that
// re-reads another head, layer or view of faceres is drawing from one
// well." THE STUDENT IS NOT DRAWN FROM THAT WELL -- different
// architecture, different training data, and a different teacher
// (dima806, not faceres) -- so its correlation with the shipped head is
// an open question, and the answer decides whether ~0.87 is worthless
// or useful.
//
// WHAT IT PRINTS
//   pearson and spearman between the two scores, on his corpus
//   AUC of each alone, and of their average, at matched exposure
//   the per-read disagreement rate, split by who is right
//
// AUC IS THE COLUMN THAT MEANS SOMETHING. A bar solver can move a
// matched-exposure cell; nothing moves AUC. The false-cover column is
// printed beside it and is not to be read below ~0.97 AUC, where it is
// dominated by where the bar lands rather than by separation.
import fs from 'fs';

const CORPUS = 'Z:/tamescroll-corpus';
const RUN = process.env.RUN || 'run-w1-s112-grey-feat1.json';

const base = JSON.parse(fs.readFileSync(`${CORPUS}/bank/gpu-grey-mirror.json`, 'utf8'));
const byCrop = new Map(base.map((r) => [r.crop, r]));

const runPath = `${CORPUS}/student/${RUN}`;
if (!fs.existsSync(runPath)) {
  console.log(`no student run at ${runPath}`);
  console.log('pass RUN=<file> or train one first.');
  process.exit(1);
}
const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));

function auc(pos, neg) {
  if (!pos.length || !neg.length) return NaN;
  const all = pos.concat(neg);
  const order = all.map((v, i) => i).sort((a, b) => all[a] - all[b]);
  const rank = new Array(all.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && all[order[j + 1]] === all[order[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rank[order[k]] = r;
    i = j + 1;
  }
  let s = 0;
  for (let i = 0; i < pos.length; i++) s += rank[i];
  return (s - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma; const db = b[i] - mb;
    sab += da * db; saa += da * da; sbb += db * db;
  }
  return sab / Math.sqrt(saa * sbb);
}

function ranks(v) {
  const order = v.map((_, i) => i).sort((x, y) => v[x] - v[y]);
  const r = new Array(v.length);
  order.forEach((idx, i) => { r[idx] = i; });
  return r;
}

// EVERY FOLD'S READS, joined to the shipped model's banked run on the
// SAME crop. A student row that has no shipped counterpart is dropped
// rather than compared against a different population -- scoring 2,385
// rows against a baseline measured on 2,159 is a drift larger than the
// effect, and it happened once already this session.
const S = []; const F = []; const Y = [];
let unjoined = 0;
for (const fold of run.folds) {
  // `raw` is in the fold's own row order; `cid`/`who` ride along, but the
  // crop key does not, so the join goes through the eval order the
  // trainer used. It is reconstructed here the same way.
  if (!fold.crop) { unjoined += fold.raw.length; continue; }
  for (let i = 0; i < fold.raw.length; i++) {
    const b = byCrop.get(fold.crop[i]);
    if (!b) { unjoined++; continue; }
    S.push(fold.raw[i]);
    F.push(b.grey.raw);
    Y.push(fold.who[i]);
  }
}
if (!S.length) {
  console.log('*** THE RUN FILE CARRIES NO CROP KEYS, so student rows cannot be');
  console.log('*** joined to the shipped model read for read. student-train.py must');
  console.log('*** bank `crop` beside `raw`; without it this comparison would have to');
  console.log('*** assume two row orders match, which is the class of assumption that');
  console.log('*** produced four retracted tables in this repo.');
  process.exit(1);
}
console.log(`joined ${S.length} reads (${unjoined} unjoined)`);

const pos = (v) => v.filter((_, i) => Y[i] === 1);
const neg = (v) => v.filter((_, i) => Y[i] === 0);
const A = (v) => auc(pos(v), neg(v));

const rs = ranks(S); const rf = ranks(F);
console.log('');
console.log(`pearson (student, faceres)   ${pearson(S, F).toFixed(3)}`);
console.log(`spearman                     ${pearson(rs, rf).toFixed(3)}`);
console.log('  finding 46 killed the descriptor veto at pearson 0.893 -- that probe');
console.log('  was the same signal off an earlier layer. Well below that is a real');
console.log('  second opinion; near or above it is one well, drawn twice.');
console.log('');
console.log(`AUC faceres (shipped)        ${A(F).toFixed(4)}`);
console.log(`AUC student                  ${A(S).toFixed(4)}`);

// The average of two scores on different scales is not an ensemble, it
// is whichever one has the wider range. Rank-average instead: it is
// scale-free and it is what AUC itself measures.
const n = S.length;
const rankAvg = S.map((_, i) => (rs[i] + rf[i]) / (2 * n));
console.log(`AUC rank-average of the two  ${A(rankAvg).toFixed(4)}`);
for (const w of [0.1, 0.2, 0.3, 0.5]) {
  const mix = S.map((_, i) => ((1 - w) * rf[i] + w * rs[i]) / n);
  console.log(`  weighted ${(w * 100).toFixed(0).padStart(2)}% student   ${A(mix).toFixed(4)}`);
}

// WHERE THEY DISAGREE, and whether the student is ever right when
// faceres is wrong. If it never is, no combination rule can help.
let bothRight = 0; let onlyF = 0; let onlyS = 0; let neither = 0;
for (let i = 0; i < n; i++) {
  const f = (F[i] >= 0.5) === (Y[i] === 1);
  const s = (S[i] >= 0.5) === (Y[i] === 1);
  if (f && s) bothRight++;
  else if (f) onlyF++;
  else if (s) onlyS++;
  else neither++;
}
console.log('');
console.log('at the raw 0.5 boundary (a direction check, not an operating point):');
console.log(`  both right      ${bothRight}`);
console.log(`  only faceres    ${onlyF}`);
console.log(`  ONLY STUDENT    ${onlyS}   <- the reads a combination could rescue`);
console.log(`  neither         ${neither}`);
console.log('');
console.log('If ONLY STUDENT is near zero the student adds nothing anywhere and the');
console.log('rank-average above is noise. If it is large, the two models fail in');
console.log('different places and the combination is worth an exposure trade.');
