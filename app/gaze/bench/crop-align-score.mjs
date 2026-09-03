// SCORE THE THREE CROP GEOMETRIES BANKED BY crop-align-ab.mjs.
//
// The A/B run banks one row per labelled read carrying all three arms'
// answers on the SAME face, so the comparison is paired -- every arm sees
// the identical population and no arm can win by being asked easier
// questions. Scoring lives here rather than in the run so a re-cut costs
// no inference.
//
// ARMS
//   shipped  squareBox at FACE_ENLARGE 1.4 (what ships)
//   eye      a rectangle placed off the eye landmarks -- FREE, it is just
//            a different rect handed to the same cropAndResize
//   align    a full similarity transform putting the eyes on fixed pixels
//            -- COSTS: tf.image.transform takes ONE transform per image,
//            so N faces means N ops and N fence waits instead of one
//            batched crop. That cost is the whole reason the two are
//            measured apart.
//
// The decision rule is the SHIPPED one, quoted rather than re-derived:
// clear a man at GENDER_CLEAR_SCORE 0.45, which on the male branch is a
// raw sigmoid of 0.725.
import fs from 'fs';
const rows = JSON.parse(fs.readFileSync('Z:/tamescroll-corpus/bank/crop-ab-rows.json', 'utf8'));
const ARMS = [['shipped', 'shippedScore'], ['eye', 'eyeScore'], ['align', 'alignScore']];
const CLEAR = 0.45;
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
const F = rows.filter(r => r.who === 'woman');
const M = rows.filter(r => r.who === 'man');
console.log(`reads ${rows.length}   women ${F.length}   men ${M.length}   videos ${new Set(rows.map(r => r.vid)).size}\n`);

console.log('arm'.padEnd(9) + 'wrong'.padStart(8) + 'wrong F'.padStart(9) + 'wrong M'.padStart(9)
  + 'exposure'.padStart(10) + 'falsecov'.padStart(10));
for (const [g, s] of ARMS) {
  const bad = r => (r[g] === 'male') !== (r.who === 'man');
  // exposure = a woman CLEARED. false cover = a man not cleared. Both are
  // the shipped consequences, not label accuracy, because a wrong read
  // that never crosses the bar costs nothing.
  const clear = r => r[g] === 'male' && r[s] >= CLEAR;
  console.log(g.padEnd(9)
    + pct(rows.filter(bad).length, rows.length).padStart(8)
    + pct(F.filter(bad).length, F.length).padStart(9)
    + pct(M.filter(bad).length, M.length).padStart(9)
    + pct(F.filter(clear).length, F.length).padStart(10)
    + pct(M.filter(r => !clear(r)).length, M.length).padStart(10));
}

// PAIRED DISAGREEMENT. A net wrong-rate can hide two arms swapping equal
// numbers of errors; McNemar's counts only the reads where they differ,
// which is the only evidence about which is better.
console.log('\npaired, vs shipped (only reads where the two disagree):');
for (const [g] of ARMS.slice(1)) {
  let fix = 0, brk = 0;
  for (const r of rows) {
    const a = (r.shipped === 'male') === (r.who === 'man');
    const b = (r[g] === 'male') === (r.who === 'man');
    if (!a && b) fix++; else if (a && !b) brk++;
  }
  const n = fix + brk;
  // Normal approximation to the sign test; n is in the hundreds here.
  const z = n ? (Math.abs(fix - brk) - 1) / Math.sqrt(n) : 0;
  console.log(`  ${g.padEnd(8)} fixed ${String(fix).padStart(4)}   broke ${String(brk).padStart(4)}   net ${(fix - brk >= 0 ? '+' : '') + (fix - brk)}   z ${z.toFixed(2)}`);
}

console.log('\nper video, wrong rate (an arm that only wins on one video won nothing):');
const vids = [...new Set(rows.map(r => r.vid))].sort();
console.log('  ' + 'video'.padEnd(14) + ARMS.map(a => a[0].padStart(9)).join('') + '   n');
for (const v of vids) {
  const s = rows.filter(r => r.vid === v);
  console.log('  ' + v.padEnd(14) + ARMS.map(([g]) =>
    pct(s.filter(r => (r[g] === 'male') !== (r.who === 'man')).length, s.length).padStart(9)).join('')
    + '   ' + s.length);
}
