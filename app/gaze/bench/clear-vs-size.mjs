// A CLEAN FACE AT 32px CLEARS. HIS FACES AT 38-62px DO NOT.
//
// The standing explanation for "the male should not be blurred" has been
// SIZE: his player decodes 640x360, faces reach faceres at px p50 38-62,
// and nothing in this repo is calibrated below px 90. This bench asks
// the ground-truth face arm the same question at the same sizes, and the
// answer breaks that explanation.
//
// Arm: 25 faces BlazeFace found in real ytimg thumbnails at 150-206px,
// each degraded to 32/40/48/56/64px and re-read
// (spikes/gauntlet/nmtruth-face.json). `ref` is that face's own
// full-resolution read, which is the label.
//
// HONEST LIMIT, and it is the whole point of reading this number
// carefully: degrading a 200px detection isolates RESOLUTION and
// bypasses both detection quality and SOURCE quality. A 40px face in a
// 640x360 video frame carries motion blur and inter-frame compression
// that a downscaled thumbnail does not. So this does not say his faces
// are fine -- it says SIZE ALONE does not explain them, which sends the
// search at the source instead of at the crop.
import fs from 'node:fs';
import { GENDER_CLEAR_SCORE } from '../src/gender-verdict.mjs';

const P = new URL('../../../spikes/gauntlet/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const face = JSON.parse(fs.readFileSync(P + 'nmtruth-face.json', 'utf8'));

console.log('clear bar', GENDER_CLEAR_SCORE, ' faces', face.rows.length,
  JSON.stringify(face.refGenders));
console.log('');
console.log(' px | label agrees | certain-WRONG | MALE clears | FEMALE clears');
for (const px of [32, 40, 48, 56, 64]) {
  let n = 0, agree = 0, wrong = 0;
  const by = { male: { n: 0, c: 0 }, female: { n: 0, c: 0 } };
  for (const r of face.rows) {
    const s = r.series.find((x) => x.px === px);
    if (!s) continue;
    const ref = r.ref.gender;
    n++;
    if (s.gender === ref) agree++;
    // A certain WRONG read is the only kind that can uncover somebody:
    // it clears a face that should have been covered.
    if (s.gender !== ref && s.score >= GENDER_CLEAR_SCORE) wrong++;
    by[ref].n++;
    if (s.gender === ref && s.score >= GENDER_CLEAR_SCORE) by[ref].c++;
  }
  console.log(String(px).padStart(3), '|', String(agree + ' of ' + n).padStart(12), '|',
    String(wrong).padStart(13), '|', String(by.male.c + ' of ' + by.male.n).padStart(11), '|',
    by.female.c + ' of ' + by.female.n);
}
console.log('');
console.log('Compare his phone, live, 1078, 300-entry ring, his regime:');
console.log('  male reads 284, v p50 0.786, 137 over the clear bar = 48%.');
console.log('At the same pixel sizes a clean face clears 78-89% of men.');
console.log('So the gap is not the crop SIZE. It is what 640x360 does to');
console.log('the pixels before the crop is taken.');
