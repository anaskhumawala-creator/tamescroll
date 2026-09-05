// WHY DOES THE THUMBNAIL PATH BLUR MEN? -- his 2026-09-05 complaint,
// "why does it blur bearded men ... At least in the thumbnails".
//
// TWO SEPARATE QUESTIONS, and this bench only answers the FIRST:
//
//   H1  the image rule flags a man who reads male WEAKLY. It is not a
//       misread at all -- `flaggedFaceIndices` demands score >=
//       GENDER_IMAGE_MIN_SCORE (0.40) in the SAME-gender direction and
//       marks everything else. score = 2|raw-0.5|, so 0.40 means a male
//       read must reach raw >= 0.70 to be left alone.
//   H2  faceres is genuinely weaker on bearded faces. Not this file --
//       see bench/beard-proxy.mjs.
//
// PART A replays finding 52's OWN 370 thumbnails (399 face reads,
// gpu-thumbs-detect.json, hq720 normalised to 640x360 through the full
// shipped chain) through the SHIPPED `flaggedFaceIndices` and attributes
// every mark to one cause. Nothing here re-derives the rule -- it is
// imported from src/, so it cannot drift (the check-that-cannot-fail
// defect this repo has written three times).
//
// PART B prices the bar. The thumbnails carry NO gender ground truth, so
// the two columns come from two populations and that is stated on the
// table:
//   BENEFIT (marks removed) -- measured on the 399 thumbnail reads.
//   COST (exposure)         -- measured on gpu-corpus-desc.json, 2,159
//                              HAND-LABELLED reads over ten real videos,
//                              52 identities, run through the SAME image
//                              rule. Those are VIDEO crops, not
//                              thumbnails; it is the only population in
//                              this repo with per-face truth.
//
//   node app/gaze/bench/image-weak-male.mjs [man|woman]
import fs from 'fs';
import {
  flaggedFaceIndices,
  refusedByNullGuard,
  GENDER_IMAGE_MIN_SCORE,
} from '../src/gender-verdict.mjs';

const MODE = process.argv[2] || 'man';
const SAME = MODE === 'man' ? 'male' : 'female';
const THUMBS = 'Z:/tamescroll-corpus/bank/gpu-thumbs-detect.json';
const CORPUS = 'Z:/tamescroll-corpus/bank/gpu-corpus-desc.json';

// The banks carry each face flat (`raw`, `s`, `g`, `age`, `childP`,
// `nm`); the shipped predicates read `score` and `shape.norm`. Convert
// here rather than loosening the rule -- an arm that has to relax the
// code it is testing is testing something else.
const asRead = (f) => ({
  gender: f.g,
  score: f.s,
  age: f.age,
  childP: f.childP,
  raw: f.raw,
  shape: { norm: f.nm },
});

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '--');
const med = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------------------------------------------------------------- A
const thumbs = JSON.parse(fs.readFileSync(THUMBS, 'utf8'));
const faces = [];
for (const t of thumbs) {
  for (const f of t.faces || []) faces.push({ t, f, r: asRead(f) });
}

// Finding 52's own JUNK definition, unchanged: a mark on a
// PERSON-FREE-SEARCH thumbnail where MoveNet admits nobody is junk.
const isJunk = (t) => t.expect === 'none' && t.nPersons === 0;

const cause = (r) => {
  if (refusedByNullGuard(r)) return 'refusedNullGuard';
  const adult = flaggedFaceIndices(MODE, [{ ...r, gender: SAME, score: 1 }]).length === 0;
  if (r.gender !== SAME) return 'oppositeRead';
  if (!adult) return 'notAdult';
  if (!(r.score >= GENDER_IMAGE_MIN_SCORE)) return 'weakSame';
  return 'cleared';
};

const tally = {};
let marked = 0;
for (const row of faces) {
  const flagged = flaggedFaceIndices(MODE, [row.r]).length > 0;
  row.flagged = flagged;
  row.cause = cause(row.r);
  const k = row.cause + (isJunk(row.t) ? ' (junk)' : ' (real)');
  tally[k] = (tally[k] || 0) + 1;
  if (flagged) marked++;
}

console.log(`\n== A. WHY EVERY THUMBNAIL MARK EXISTS -- ${MODE} mode`);
console.log(`   ${thumbs.length} thumbnails, ${faces.length} face reads, ${marked} marked`);
console.log(`   bar GENDER_IMAGE_MIN_SCORE=${GENDER_IMAGE_MIN_SCORE} (score=2|raw-0.5|, so a ${SAME} read needs raw >= ${(0.5 + GENDER_IMAGE_MIN_SCORE / 2).toFixed(3)})\n`);
const order = ['oppositeRead', 'weakSame', 'notAdult', 'refusedNullGuard', 'cleared'];
for (const c of order) {
  const j = tally[c + ' (junk)'] || 0;
  const rr = tally[c + ' (real)'] || 0;
  if (!j && !rr) continue;
  console.log(
    `   ${c.padEnd(18)} ${String(j + rr).padStart(4)}  ${pct(j + rr, faces.length).padStart(6)}   junk ${String(j).padStart(3)}  real ${String(rr).padStart(3)}`,
  );
}
const weak = faces.filter((x) => x.cause === 'weakSame');
const opp = faces.filter((x) => x.cause === 'oppositeRead');
console.log(`\n   OF THE ${marked} MARKS: ${pct(weak.length, marked)} are a ${SAME} read too weak to clear,`);
console.log(`                  ${pct(opp.length, marked)} read the opposite gender.`);
console.log(`   weak-${SAME} raw p50 ${med(weak.map((x) => x.f.raw)).toFixed(3)}  score p50 ${med(weak.map((x) => x.f.s)).toFixed(3)}  px p50 ${med(weak.map((x) => x.f.px)).toFixed(0)}  nm p50 ${med(weak.map((x) => x.f.nm)).toFixed(2)}`);

// A BENCH REPORTING A BOUND MUST NAME THE ROWS BEHIND IT.
console.log(`\n   THE 12 WEAK-${SAME.toUpperCase()} MARKS WITH THE HIGHEST raw (closest to clearing):`);
for (const x of [...weak].sort((a, b) => b.f.raw - a.f.raw).slice(0, 12)) {
  console.log(
    `     ${x.t.vid.padEnd(12)} px${String(x.f.px).padStart(4)} raw ${x.f.raw.toFixed(3)} s ${x.f.s.toFixed(3)} nm ${x.f.nm.toFixed(2)} nPersons ${x.t.nPersons}  "${x.t.q}"`,
  );
}

// ---------------------------------------------------------------- B
const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
const truth = corpus.map((c) => ({ who: c.who, r: asRead(c.rgb), px: c.px, cid: c.cid }));
const men = truth.filter((t) => t.who === 'man');
const women = truth.filter((t) => t.who === 'woman');

// AUC of `raw` separating the two truth classes. A bar solver can move
// any matched-exposure cell; nothing can move AUC.
const auc = (() => {
  const pos = men.map((t) => t.r.raw); // higher raw = more male
  const neg = women.map((t) => t.r.raw);
  let w = 0;
  for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0;
  return w / (pos.length * neg.length);
})();

const applyBar = (rows, bar) => {
  const back = GENDER_IMAGE_MIN_SCORE;
  // GENDER_IMAGE_MIN_SCORE has no OTA setter in src/tuning.mjs; the
  // sweep therefore re-implements ONLY the score comparison, keeping the
  // rest of the shipped rule by calling it at the shipped bar first.
  let flagged = 0;
  const out = [];
  for (const t of rows) {
    const shipped = flaggedFaceIndices(MODE, [t.r]).length > 0;
    // The bar can only change reads that are SAME-gender, adult, past
    // the null guard, and sitting between the two bars.
    let f = shipped;
    if (shipped && t.r.gender === SAME && !refusedByNullGuard(t.r) && t.r.score >= bar) {
      const adultOk = flaggedFaceIndices(MODE, [{ ...t.r, score: 1 }]).length === 0;
      if (adultOk) f = false;
    }
    if (bar > back && !shipped && t.r.gender === SAME && t.r.score < bar && !refusedByNullGuard(t.r)) f = true;
    if (f) flagged++;
    out.push(f);
  }
  void back;
  return { flagged, out };
};

console.log(`\n== B. THE BAR, PRICED. AUC(raw | man vs woman, hand-labelled corpus) = ${auc.toFixed(4)}`);
console.log(`   BENEFIT population: 399 thumbnail reads (no gender truth).`);
console.log(`   COST population:    ${truth.length} hand-labelled VIDEO reads, ${men.length} man / ${women.length} woman, ${new Set(truth.map((t) => t.cid)).size} clusters.`);
console.log(`   These are DIFFERENT populations -- the cost column is not measured on thumbnails.\n`);
console.log(`   bar    thumb marks   men covered (false cover)   women uncovered (EXPOSURE)`);
const bars = [0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.1, 0.0];
for (const bar of bars) {
  const th = applyBar(faces.map((x) => ({ r: x.r })), bar);
  const fm = applyBar(men, bar).flagged;
  const fw = applyBar(women, bar).flagged;
  const tag = Math.abs(bar - GENDER_IMAGE_MIN_SCORE) < 1e-9 ? '  <- SHIPS' : '';
  console.log(
    `   ${bar.toFixed(2)}   ${String(th.flagged).padStart(3)}/${faces.length}      ${String(fm).padStart(4)}/${men.length}  ${pct(fm, men.length).padStart(6)}          ${String(women.length - fw).padStart(3)}/${women.length}  ${pct(women.length - fw, women.length).padStart(6)}${tag}`,
  );
}
console.log('');

// ---------------------------------------------------------------- C
// THE SAME DECOMPOSITION, ON READS WITH TRUTH. The thumbnails have no
// gender labels, so "oppositeRead" there could be a real woman or a
// misread man. Here it cannot: these are 1,249 reads of HAND-LABELLED
// MEN. Every mark below is FALSE COVER on his own direction.
// CAVEAT ON THE SAME LINE: these are VIDEO crops off ten real videos,
// pushed through the IMAGE rule. Thumbnails are sharper and bigger
// (thumbnail px p50 differs), so this is the rule's behaviour, not the
// thumbnail population's.
console.log(`== C. THE IMAGE RULE OVER ${men.length} HAND-LABELLED MAN READS (${new Set(men.map((t) => t.cid)).size} identities) -- every mark is FALSE COVER`);
const ct = {};
let mMark = 0;
for (const t of men) {
  const c = cause(t.r);
  ct[c] = (ct[c] || 0) + 1;
  if (flaggedFaceIndices(MODE, [t.r]).length > 0) mMark++;
}
for (const c of order) {
  if (!ct[c]) continue;
  console.log(`   ${c.padEnd(18)} ${String(ct[c]).padStart(4)}  ${pct(ct[c], men.length).padStart(6)}`);
}
console.log(`   marked ${mMark} (${pct(mMark, men.length)}).  Of those marks: weak-male ${pct(ct.weakSame || 0, mMark)}, read-female ${pct(ct.oppositeRead || 0, mMark)}.`);
const mw = men.filter((t) => cause(t.r) === 'weakSame');
const mo = men.filter((t) => cause(t.r) === 'oppositeRead');
console.log(`   weak-male  n${String(mw.length).padStart(4)}  raw p50 ${med(mw.map((t) => t.r.raw)).toFixed(3)}  px p50 ${med(mw.map((t) => t.px)).toFixed(0)}`);
console.log(`   read-female n${String(mo.length).padStart(4)}  raw p50 ${med(mo.map((t) => t.r.raw)).toFixed(3)}  px p50 ${med(mo.map((t) => t.px)).toFixed(0)}`);
// Male-reading faces that still fail the bar -- the H1 rate, truthed.
const maleReading = men.filter((t) => t.r.gender === SAME && !refusedByNullGuard(t.r));
const failing = maleReading.filter((t) => t.r.score < GENDER_IMAGE_MIN_SCORE);
console.log(`   H1 RATE: of ${maleReading.length} labelled men the model READS male, ${failing.length} (${pct(failing.length, maleReading.length)}) are too weak to clear the 0.40 bar and are blurred anyway.`);
const thMale = faces.filter((x) => x.r.gender === SAME && !refusedByNullGuard(x.r) && x.cause !== 'notAdult');
const thFail = thMale.filter((x) => x.r.score < GENDER_IMAGE_MIN_SCORE);
console.log(`   SAME RATE ON THUMBNAILS (no truth, model's own label): ${thFail.length}/${thMale.length} = ${pct(thFail.length, thMale.length)}\n`);
