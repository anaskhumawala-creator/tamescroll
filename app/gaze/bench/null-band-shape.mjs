// HOW MUCH DOES THE RAW BAND OVERSTATE `isNullRead`?
//
// Every "the null band catches 30-33 of 34 non-faces" figure in this
// repo came from app/gaze/bench/small-face.js, which tested
// `raw >= 0.545 && raw <= 0.705` -- the wrong CONSTANTS (the shipped
// band is [0.53, 0.72]) and, much more importantly, only HALF THE
// PREDICATE. `isNullRead` also requires `gender === 'male'` and
// `age` in [34, 42], and the bench's non-face control never captured
// age, so it could not have evaluated the real predicate even in
// principle. Both are fixed in the bench now; this quantifies the gap on
// data we already own.
//
// The corpus is REAL FACES off the player and image rings, not the
// bench's non-face control, so this does not re-derive the non-face
// figure -- it bounds how much the age condition removes from a raw-band
// count ON FACES. That ratio must NOT be carried across to non-faces: it
// is a property of the age distribution, and nothing in this repo has
// measured what age a title card or a plank reads.
//
// THREE CORRECTIONS AFTER A CRITIC PASS, each of which moved a number:
//  1. `ab` -- isNullRead evaluated IN PAGE at FULL PRECISION -- is banked
//     beside the read. The rings bank `a: Math.round(age)`, so a read at
//     33.7 is banked as 34 and an offline reconstruction counts it as a
//     null read the pipeline would reject. Use the banked truth wherever
//     it exists and reconstruct only where it does not.
//  2. A sub-FACE_MIN_NATIVE_PX abstention banks
//     `gender:'unknown', score:0, age:0` -- sentinels, not a measurement.
//     Not a gender read, so not in the denominator.
//  3. The same ring is dumped into more than one probe artifact, so a
//     record count is not a sample size. Distinct signatures beside it.
//
// Run: node app/gaze/bench/null-band-shape.mjs [corpusRoot]
import fs from 'fs';
import path from 'path';

const V_LO = 0.53, V_HI = 0.72, AGE_LO = 34, AGE_HI = 42;
const BENCH_LO = 0.545, BENCH_HI = 0.705;
// The corpus is untracked scratch under spikes/, so a number derived here
// cannot be re-derived from a clean checkout. Overridable so a future run
// can point at whatever survived.
const ROOT = process.argv[2] || 'Z:/Apps/Disconnect/spikes';

const files = [];
(function walk(d) {
  let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p); else if (x.name.endsWith('.json')) files.push(p);
  }
})(ROOT);

const reads = [];
function scan(o, file) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) scan(x, file); return; }
  if ('g' in o && 'a' in o) {
    reads.push({
      g: o.g, s: o.s, a: o.a, v: o.v ?? null,
      ab: typeof o.ab === 'number' ? o.ab : (typeof o.ab === 'boolean' ? (o.ab ? 1 : 0) : null),
      box: Array.isArray(o.b) ? o.b.join(',') : null,
      file,
    });
  }
  for (const k of Object.keys(o)) scan(o[k], file);
}
for (const f of files) { try { scan(JSON.parse(fs.readFileSync(f, 'utf8')), f); } catch { } }

// detector.js: confidence = min(0.99, 2*|v-0.5|), label female iff
// v <= 0.5. So v is recoverable except at the clamp -- validated to max
// error 0.0020 in null-child-mine.mjs. Used only where `v` was not banked.
function raw(r) {
  if (typeof r.v === 'number') return r.v;
  if (typeof r.s !== 'number' || r.s >= 0.99) return null;
  return r.g === 'male' ? 0.5 + r.s / 2 : 0.5 - r.s / 2;
}

const abstain = reads.filter((r) => r.g === 'unknown');
const R = reads
  .filter((r) => r.g !== 'unknown')
  .map((r) => ({ g: r.g, a: r.a, v: raw(r), ab: r.ab, box: r.box }))
  .filter((r) => typeof r.a === 'number' && typeof r.v === 'number');

function sig(r) { return [r.g, r.a, r.v, r.box].join('|'); }
function distinct(list) { return new Set(list.map(sig)).size; }

// The reconstruction, on the ROUNDED age the ring banks.
function reconstructed(r) {
  return r.g === 'male' && r.v >= V_LO && r.v <= V_HI && r.a >= AGE_LO && r.a <= AGE_HI;
}
// The banked answer wherever it exists, the reconstruction elsewhere.
function isNull(r) { return r.ab != null ? r.ab === 1 : reconstructed(r); }

const inShipped = R.filter((r) => r.v >= V_LO && r.v <= V_HI);
const inBench = R.filter((r) => r.v >= BENCH_LO && r.v <= BENCH_HI);
const full = R.filter(isNull);
const male = R.filter((r) => r.g === 'male');

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
const line = (label, list) =>
  console.log(label.padEnd(38), String(list.length).padStart(6),
    pct(list.length, R.length).padStart(7), '  distinct', distinct(list));

console.log('files walked', files.length, '  raw records', reads.length);
console.log('ABSTENTIONS EXCLUDED (gender unknown, the sub-floor sentinel):', abstain.length);
line('denominator (real gender reads)', R);
line('raw band, SHIPPED [0.53, 0.72]', inShipped);
line('raw band, BENCH   [0.545, 0.705]', inBench);
line('FULL isNullRead (banked where known)', full);
console.log('  the bench band is', pct(inBench.length, inShipped.length), 'of the shipped one');
console.log('  the age condition removes', inShipped.length - full.length, 'of', inShipped.length,
  '=', pct(inShipped.length - full.length, inShipped.length), 'of in-band reads');
console.log('  as a share of MALE-labelled reads (the only ones it can fire on):',
  pct(full.length, male.length));

// HOW MUCH A ROUNDED-AGE RECONSTRUCTION OVERSTATES, against the banked
// truth. isNullRead reads the UNROUNDED age, so [33.5, 34) is banked as
// 34 and an offline reconstruction counts it.
const truth = R.filter((r) => r.ab != null);
let both = 0, fp = 0, fn = 0;
const fpAges = {};
for (const r of truth) {
  const rec = reconstructed(r);
  if (rec && r.ab === 1) both++;
  else if (rec && r.ab === 0) { fp++; fpAges[r.a] = (fpAges[r.a] || 0) + 1; }
  else if (!rec && r.ab === 1) fn++;
}
console.log('');
console.log('ROUNDED-AGE CHECK against the banked `ab` on', truth.length, 'reads:');
console.log('  agree', both, ' offline FALSE POSITIVES', fp, ' offline false negatives', fn);
console.log('  the reconstruction overstates by', pct(fp, both),
  ' false positives by banked age:', JSON.stringify(fpAges));

const removed = inShipped.filter((r) => !isNull(r));
const young = removed.filter((r) => r.a < AGE_LO).length;
const old = removed.filter((r) => r.a > AGE_HI).length;
const ages = removed.map((r) => r.a).sort((a, b) => a - b);
console.log('');
console.log('  of the in-band reads removed:', young, 'read younger than', AGE_LO,
  '/', old, 'older than', AGE_HI);
if (ages.length) {
  console.log('  removed age p05/p50/p95 =', ages[Math.floor(ages.length * 0.05)],
    ages[Math.floor(ages.length / 2)], ages[Math.floor(ages.length * 0.95)]);
}

// NOT A MEASUREMENT. NULL_V_LO 0.53 is above the 0.5 label boundary, so
// `raw >= 0.53` IMPLIES male by detector.js's own labelling rule. Printed
// as an identity check so nobody quotes it as evidence again.
const femaleInBand = inShipped.filter((r) => r.g !== 'male').length;
console.log('');
console.log('IDENTITY CHECK (NOT evidence): female labels inside the band =', femaleInBand,
  '-- guaranteed 0 by NULL_V_LO', V_LO, '> the 0.5 label boundary.');

console.log('');
console.log('CONSEQUENCE: a raw-band count is an UPPER BOUND on isNullRead. The');
console.log('looseness above is measured ON FACES and must not be carried across to');
console.log('non-faces -- that is a property of the age distribution, and nothing');
console.log('here has measured what a non-face reads. small-face.js reports');
console.log('caughtByNullRead on BOTH control producers now; that is the real number.');
