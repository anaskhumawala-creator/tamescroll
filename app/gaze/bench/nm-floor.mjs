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
// THE DENOMINATOR IS THE IN-BAND POPULATION, AND THE FIRST VERSION OF
// THIS BENCH USED THE WHOLE ARM.
//
// The gate is an AND, so a read outside the band can never be refused
// whatever its nm. Dividing by every read counted 118 of 125 real-face
// reads that were never eligible, which flatters the face column, and
// printed non-face percentages against 425 while the write-up quoted 403
// -- so nobody re-running this could reconcile it with the source
// comment. Both columns are over the IN-BAND population now.
//
// AND THE READS ARE NOT INDEPENDENT. The face arm's in-band reads come
// from a HANDFUL of distinct faces, and a subject refused at every size
// is uncoverable while one refused at a single size is not -- so the
// per-FACE count is the one that describes the harm.
const faceOf = new Map();
for (const r of face.rows) for (const s of r.series) faceOf.set(s, r);
const idsIn = new Set(fB.map((s) => faceOf.get(s).id));
console.log('  in-band real faces come from', idsIn.size, 'distinct subjects:',
  [...idsIn].map((id) => id + '(' + face.rows.find((r) => r.id === id).ref.gender + ')').join(' '));
console.log('');

console.log('floor | real FACE reads |  faces wholly | in-band NON-FACE reads');
for (const floor of [0, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const hit = (s) => typeof s.nm === 'number' && s.nm < floor;
  const fr = fB.filter(hit);
  const nr = nB.filter(hit).length;
  // A subject every one of whose in-band reads is refused is the one
  // that matters: at his cadence there is no size at which she recovers.
  let whole = 0;
  for (const id of idsIn) {
    const mine = fB.filter((s) => faceOf.get(s).id === id);
    if (mine.length && mine.every(hit)) whole++;
  }
  console.log(
    String(floor).padStart(5), '|',
    String(fr.length + ' of ' + fB.length).padStart(15), '|',
    String(whole + ' of ' + idsIn.size).padStart(13), '|',
    String(nr + ' of ' + nB.length).padStart(14),
    (100 * nr / (nB.length || 1)).toFixed(1).padStart(6) + '%'
  );
}
console.log('');
console.log('floor 0 is the control: the gate off. Anything it refuses is a bug.');
console.log('');
console.log('WHO the face column is, at every floor that touches anybody:');
for (const s of fB.slice().sort((a, b) => a.nm - b.nm)) {
  const r = faceOf.get(s);
  console.log('  nm', String(s.nm).padStart(6), ' px', String(s.px).padStart(3),
    ' ref', r.ref.gender, ' (refPx ' + r.ref.px + ')', r.id);
}
console.log('');
console.log('OVERLAP in the deciding region -- the arms are NOT far apart here:');
const nms = (a) => a.map((x) => x.nm).filter((v) => typeof v === 'number').sort((x, y) => x - y);
const fN = nms(fB), nN = nms(nB);
const qq = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
console.log('  in-band real faces  n=' + fN.length, ' min', fN[0], ' p50', qq(fN, 0.5), ' max', fN[fN.length - 1]);
console.log('  in-band non-faces   n=' + nN.length, ' min', nN[0], ' p50', qq(nN, 0.5),
  ' p95', qq(nN, 0.95), ' max', nN[nN.length - 1]);
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
