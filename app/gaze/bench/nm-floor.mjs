// WHERE THE DESCRIPTOR FLOOR GOES, ON GROUND TRUTH.
//
// `NULL_MINT_NM_FLOOR` decides whether a null read may create a patch,
// and every number behind the first choice of 6 was a DISTRIBUTION --
// his phone, the video corpus. A distribution cannot say whether a given
// read was a person. These two arms can: one is real faces BlazeFace
// found and this repo re-read at nine sizes, the other is corner crops
// where BlazeFace found nothing.
//
// Both directions, at every candidate floor:
//   REAL FACES REFUSED  a person who goes sharp on first detection
//   NON-FACES REFUSED   a patch on nothing that never appears
//
// Read them together. A floor that refuses no non-faces is a gate that
// earns nothing and should be deleted rather than tuned.
import fs from 'fs';
const P = 'Z:/Apps/Disconnect/spikes/gauntlet/';
const face = JSON.parse(fs.readFileSync(P + 'nmtruth-face.json', 'utf8'));
let nonface = null;
try { nonface = JSON.parse(fs.readFileSync(P + 'nmtruth-nonface.json', 'utf8')); } catch {}

// The shipped predicate, reconstructed rather than remembered.
import { NULL_V_LO, NULL_V_HI, NULL_AGE_LO, NULL_AGE_HI } from '../src/gender-verdict.mjs';
const inBand = (s) => s.gender === 'male' && s.raw >= NULL_V_LO && s.raw <= NULL_V_HI
  && s.age >= NULL_AGE_LO && s.age <= NULL_AGE_HI;

const SIZES = [32, 40, 48, 56, 64];
const faceSeries = face.rows.flatMap((r) => r.series.filter((s) => SIZES.includes(s.px)));
const nullSeries = nonface
  ? nonface.nullRows.flatMap((r) => r.series.filter((s) => SIZES.includes(s.px)))
  : [];

console.log('band', [NULL_V_LO, NULL_V_HI], 'age', [NULL_AGE_LO, NULL_AGE_HI]);
console.log('real-face reads', faceSeries.length, ' non-face reads', nullSeries.length);
const fB = faceSeries.filter(inBand), nB = nullSeries.filter(inBand);
console.log('  in band:', fB.length, 'of', faceSeries.length, 'real faces  |',
  nB.length, 'of', nullSeries.length, 'non-faces');
if (!nullSeries.length) { console.log('\nNON-FACE ARM MISSING -- nothing can be concluded.'); process.exit(0); }
console.log('');
console.log('floor | real FACES refused        | NON-FACES refused         | ratio');
for (const floor of [0, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const fr = fB.filter((s) => typeof s.nm === 'number' && s.nm < floor).length;
  const nr = nB.filter((s) => typeof s.nm === 'number' && s.nm < floor).length;
  console.log(
    String(floor).padStart(5), '|',
    String(fr).padStart(4), 'of', String(faceSeries.length).padStart(4),
    (100 * fr / faceSeries.length).toFixed(1).padStart(5) + '%  |',
    String(nr).padStart(4), 'of', String(nullSeries.length).padStart(4),
    (100 * nr / nullSeries.length).toFixed(1).padStart(5) + '%  |',
    fr ? (nr / fr).toFixed(1) : (nr ? 'inf' : '-')
  );
}
console.log('');
console.log('floor 0 is the control: the gate off. Anything it refuses is a bug.');
console.log('');
const q = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
const f2 = (v) => (v == null ? '  -  ' : v.toFixed(2));
console.log('nm distribution, by size and arm');
for (const px of SIZES) {
  const f = faceSeries.filter((s) => s.px === px && typeof s.nm === 'number').map((s) => s.nm);
  const n = nullSeries.filter((s) => s.px === px && typeof s.nm === 'number').map((s) => s.nm);
  console.log('  px', String(px).padStart(3),
    ' faces p05/p50', [q(f, .05), q(f, .5)].map(f2).join('/'),
    '  non-faces p50/p95', [q(n, .5), q(n, .95)].map(f2).join('/'));
}
