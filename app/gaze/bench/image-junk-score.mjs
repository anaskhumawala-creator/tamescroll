// THE MATCHED CONTROL FOR THE IMAGE PATH.
//
// The first read of image-junk said grey DOUBLES junk marks on thumbnails
// (7.6% -> 16.5%), which is his exact complaint and reads as an argument
// against the finding-41 recommendation. Before that goes anywhere it needs
// the same control finding 41 used, because there is an obvious alternative
// explanation and it is the one this repo keeps getting caught by:
//
//   grey shifts the whole read distribution toward FEMALE. That is WHY it
//   fixes women (25.8% -> 19.0% wrong). In his man mode a junk crop is
//   marked unless it reads confidently MALE -- so a global female shift
//   marks more junk BY CONSTRUCTION, exactly as it covers more women.
//
// Both effects are one shift. Comparing the arms at a FIXED bar therefore
// measures the shift, not the arm, and answers a question nobody asked.
//
// THE FAIR COMPARISON solves each arm its OWN image bar so both protect the
// same fraction of real women, and only then reads what each costs in junk
// marks and in false cover on real men. That is the exact discipline
// finding 41 used on the video path and finding 40 was nearly published
// without.
//
// Offline, off the banked rows -- no inference, so it can be re-run against
// a partial bank while the collector is still going.
import fs from 'fs';
import { flaggedFaceIndices, setNmFloor, NULL_MINT_NM_FLOOR } from '../src/gender-verdict.mjs';

const ROWS = 'Z:/tamescroll-corpus/bank/image-junk-rows.json';
const NL = String.fromCharCode(10);

// The shipped rule with ONE substitution: the image score bar. Everything
// else -- the opposite-gender test, the child gate, the null-mint guard --
// is the shipped function, called and not restated.
function markedAt(face, bar) {
  if (!face) return true;
  if (flaggedFaceIndices('man', [face]).length) {
    // Already flagged by the shipped rule. If the ONLY reason was the score
    // bar, a lower bar can clear it; any other reason stands whatever the
    // bar is.
    const same = face.gender === 'male';
    const adult = !(face.childP >= 0.25);
    if (same && adult) return !(face.score >= bar);
    return true;
  }
  return !(face.score >= bar);
}

const rows = JSON.parse(fs.readFileSync(ROWS, 'utf8'));
const J = rows.filter(r => r.kind === 'junk');
const M = rows.filter(r => r.kind === 'man');
const F = rows.filter(r => r.kind === 'woman');
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
console.log(NL + 'rows ' + rows.length + '   junk ' + J.length + '  men ' + M.length + '  women ' + F.length
  + '   nm floor ' + NULL_MINT_NM_FLOOR);

// Protection first: what fraction of real women does each arm actually
// cover at a given bar. This is the axis to match on -- it is the thing the
// app exists to do.
console.log(NL + 'MATCHED PROTECTION -- each arm solves its own image bar so both');
console.log('cover the SAME share of real women. Then read what it costs.');
const targets = [1.00, 0.98, 0.95, 0.90];
console.log('  ' + 'arm'.padEnd(7) + 'womenCovered'.padStart(14) + 'bar'.padStart(8)
  + 'JUNK MARKED'.padStart(14) + 'men marked'.padStart(13));
for (const t of targets) {
  for (const arm of ['rgb', 'grey']) {
    // Raise the bar until coverage of women reaches the target; a higher
    // bar marks MORE, so coverage is monotone increasing in the bar.
    let bar = null;
    for (let b = 0.00; b <= 1.001; b += 0.005) {
      if (F.filter(r => markedAt(r[arm], b)).length / F.length >= t) { bar = b; break; }
    }
    if (bar === null) { console.log('  ' + arm.padEnd(7) + ('>=' + (t * 100).toFixed(0) + '%').padStart(14) + '   unreachable'); continue; }
    console.log('  ' + arm.padEnd(7) + ('>=' + (t * 100).toFixed(0) + '%').padStart(14) + bar.toFixed(3).padStart(8)
      + pct(J.filter(r => markedAt(r[arm], bar)).length, J.length).padStart(14)
      + pct(M.filter(r => markedAt(r[arm], bar)).length, M.length).padStart(13));
  }
}

// Is the whole difference a shift? If it is, the two arms' score
// distributions on the SAME crops differ by roughly a constant and the
// matched table above collapses.
console.log(NL + 'IS IT JUST A SHIFT? mean signed raw, per population');
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const rawOf = f => (f.gender === 'male' ? 0.5 + f.score / 2 : 0.5 - f.score / 2);
for (const [k, s] of [['junk', J], ['men', M], ['women', F]]) {
  if (!s.length) continue;
  const dr = s.map(r => rawOf(r.grey) - rawOf(r.rgb));
  const mean = dr.reduce((a, b) => a + b, 0) / dr.length;
  console.log('  ' + k.padEnd(7) + 'n ' + String(s.length).padStart(4)
    + '   grey-minus-rgb raw  mean ' + (mean >= 0 ? '+' : '') + mean.toFixed(4)
    + '   p50 ' + q(dr, 0.5).toFixed(4) + '   p05 ' + q(dr, 0.05).toFixed(4) + '   p95 ' + q(dr, 0.95).toFixed(4));
}
console.log('  A shift moves every population the SAME way. A real improvement moves');
console.log('  women toward female MORE than it moves men and junk.');

console.log(NL + 'nm (shape.norm) -- the axis the null-mint floor cuts on');
for (const [k, s] of [['junk', J], ['men', M], ['women', F]]) {
  const v = s.map(r => (r.rgb.shape || {}).norm).filter(x => typeof x === 'number');
  if (!v.length) continue;
  console.log('  ' + k.padEnd(7) + 'n ' + String(v.length).padStart(4)
    + '   p05 ' + q(v, 0.05).toFixed(2) + '   p50 ' + q(v, 0.5).toFixed(2) + '   p95 ' + q(v, 0.95).toFixed(2));
}

console.log(NL + 'nm FLOOR SWEEP at the shipped bar (OTA clamp stops at 5.5)');
console.log('  ' + 'floor'.padEnd(8) + 'JUNK marked'.padStart(13) + 'men marked'.padStart(13) + 'women covered'.padStart(15));
const saved = NULL_MINT_NM_FLOOR;
for (const fl of [0, 4, 5, 5.5, 6, 7, 8]) {
  setNmFloor(fl);
  const mk = f => flaggedFaceIndices('man', [f]).length > 0;
  console.log('  ' + String(fl).padEnd(8)
    + pct(J.filter(r => mk(r.rgb)).length, J.length).padStart(13)
    + pct(M.filter(r => mk(r.rgb)).length, M.length).padStart(13)
    + pct(F.filter(r => mk(r.rgb)).length, F.length).padStart(15));
}
setNmFloor(saved);
