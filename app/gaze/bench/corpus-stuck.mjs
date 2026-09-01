// THE MEN WHO CAN NEVER CLEAR.
//
// GENDER_CLEAR_SCORE 0.6 is a score, and score = 2|raw-0.5|, so clearing
// as male needs raw >= 0.80. The null band is raw in [0.53, 0.72]. A man
// who reads STABLY at 0.60-0.72 is therefore two things at once: too low
// to ever clear, and inside the band that marks a read as carrying no
// signal. He is covered for the whole shot, every shot, forever.
//
// That is the owner's standing definition of done, failing:
//   "the male should not be blurred, like the wrong gender should not
//    be blurred."
import fs from 'fs';
import { NULL_V_LO, NULL_V_HI, GENDER_CLEAR_SCORE, NULL_MINT_NM_FLOOR, clearScoreFor } from './.cache/shipped.mjs';
import { ROOT } from './corpus-lib.mjs';
const q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;
const clusters = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8'));

const rawNeeded = 0.5 + GENDER_CLEAR_SCORE / 2;
console.log(`clearing as male needs score >= ${GENDER_CLEAR_SCORE}, i.e. raw >= ${rawNeeded.toFixed(2)}`);
console.log(`the null band is raw in [${NULL_V_LO}, ${NULL_V_HI}]  ->  overlap [${NULL_V_LO}, ${Math.min(NULL_V_HI, rawNeeded).toFixed(2)}] is UNCLEARABLE AND TAGGED\n`);

let stuck = 0, stuckReads = 0, big = 0;
console.log('subject          n   raw p50  nm p50   clears   verdict');
for (const c of clusters) {
  if (c.members.length < 8) continue;
  big++;
  const raws = c.members.map((m) => m.raw).filter((v) => typeof v === 'number');
  const nms = c.members.map((m) => m.nm).filter((v) => typeof v === 'number');
  const clears = c.members.filter((m) => (m.score ?? 0) >= clearScoreFor(m.gender)).length;
  const p50 = q(raws, 0.5), nm50 = q(nms, 0.5);
  const inBand = p50 >= NULL_V_LO && p50 <= NULL_V_HI;
  const never = clears === 0;
  if (inBand && never) { stuck++; stuckReads += c.members.length;
    console.log(`${c.id.padEnd(15)} ${String(c.members.length).padStart(3)}   ${p50.toFixed(2)}     ${nm50.toFixed(1).padStart(5)}   ${String(clears).padStart(3)}/${String(c.members.length).padStart(3)}   STUCK COVERED` +
      (nm50 >= NULL_MINT_NM_FLOOR ? '  (nm says REAL FACE)' : '  (nm below floor)'));
  }
}
console.log(`\n${stuck} of ${big} subjects with >=8 reads are PERMANENTLY COVERED: ${stuckReads} reads.`);
console.log('Every one sits in the null band, so the pipeline treats them as carrying no signal.');
console.log('');
console.log('WHAT THIS DOES *NOT* SHOW, and the first write-up of it got this wrong:');
console.log('nm does NOT rescue them. 9 of the 10 read nm 2.9-4.9, BELOW NULL_MINT_NM_FLOOR,');
console.log('so the orthogonal axis AGREES with the band rather than contradicting it. These');
console.log('reads are therefore EITHER real men covered forever -- his standing');
console.log('complaint -- OR graphics the gate is correctly refusing, and no statistic in');
console.log('this corpus can separate those two. That is precisely what the labels are for,');
console.log('and it is why the handoff made them requirement 3.');
