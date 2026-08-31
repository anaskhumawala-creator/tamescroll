// HOW MUCH DOES THE RAW BAND OVERSTATE `isNullRead`?
//
// Every "the null band catches 30-33 of 34 non-faces" figure in this
// repo came from app/gaze/bench/small-face.js, which tested
// `raw >= 0.545 && raw <= 0.705` -- the wrong CONSTANTS (the shipped
// band is [0.53, 0.72]) and, much more importantly, only HALF THE
// PREDICATE. `isNullRead` also requires `gender === 'male'` and
// `age` in [34, 42], and the bench's non-face control never captured
// age at all, so it could not have evaluated the real predicate even in
// principle. Both are fixed in the bench now; this quantifies the gap on
// data we already own, so the correction does not have to wait for a
// device run.
//
// The corpus is REAL FACES off the player and image rings, not the
// bench's non-face control, so this does not re-derive the non-face
// figure -- it bounds how much the age condition removes from any
// raw-band count.
//
// Run: node app/gaze/bench/null-band-shape.mjs
import fs from 'fs';
import path from 'path';

const V_LO = 0.53, V_HI = 0.72, AGE_LO = 34, AGE_HI = 42;
const BENCH_LO = 0.545, BENCH_HI = 0.705;

const files = [];
(function walk(d) {
  let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p); else if (x.name.endsWith('.json')) files.push(p);
  }
})('Z:/Apps/Disconnect/spikes');

const reads = [];
function scan(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) scan(x); return; }
  if ('g' in o && 'a' in o) reads.push({ g: o.g, s: o.s, a: o.a, v: o.v ?? null });
  for (const k of Object.keys(o)) scan(o[k]);
}
for (const f of files) { try { scan(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch { } }

// The rings bank `s` (confidence) far more often than `v` (the raw
// sigmoid). detector.js: confidence = min(0.99, 2*|v-0.5|) and the label
// is female iff v <= 0.5, so v is recoverable except at the clamp --
// validated to max error 0.0020 in null-child-mine.mjs.
function raw(r) {
  if (typeof r.v === 'number') return r.v;
  if (typeof r.s !== 'number' || r.s >= 0.99) return null;
  return r.g === 'male' ? 0.5 + r.s / 2 : 0.5 - r.s / 2;
}

const R = reads
  .map((r) => ({ g: r.g, a: r.a, v: raw(r) }))
  .filter((r) => typeof r.a === 'number' && typeof r.v === 'number');

const inShipped = R.filter((r) => r.v >= V_LO && r.v <= V_HI);
const inBench = R.filter((r) => r.v >= BENCH_LO && r.v <= BENCH_HI);
const full = R.filter((r) => r.g === 'male' && r.v >= V_LO && r.v <= V_HI && r.a >= AGE_LO && r.a <= AGE_HI);

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
console.log('reads with age + recoverable raw:', R.length);
console.log('raw band, SHIPPED [0.53, 0.72]      :', inShipped.length, pct(inShipped.length, R.length));
console.log('raw band, BENCH   [0.545, 0.705]    :', inBench.length, pct(inBench.length, R.length),
  '  -- the bench band is', pct(inBench.length, inShipped.length), 'of the shipped one');
console.log('FULL isNullRead (male + raw + age)  :', full.length, pct(full.length, R.length));
console.log('  the age condition removes', inShipped.length - full.length, 'of', inShipped.length,
  '=', pct(inShipped.length - full.length, inShipped.length), 'of in-band reads');

// Where the removed ones sit, because "the age condition removes most of
// them" is only alarming if they are removed for being CHILDREN.
const removed = inShipped.filter((r) => !(r.g === 'male' && r.a >= AGE_LO && r.a <= AGE_HI));
const young = removed.filter((r) => r.a < AGE_LO);
const old = removed.filter((r) => r.a > AGE_HI);
const female = removed.filter((r) => r.g !== 'male');
console.log('  of those removed:', young.length, 'age <', AGE_LO, '/', old.length, 'age >', AGE_HI,
  '/', female.length, 'labelled female');
const ages = removed.map((r) => r.a).sort((a, b) => a - b);
if (ages.length) {
  console.log('  removed age p05/p50/p95 =', ages[Math.floor(ages.length * 0.05)],
    ages[Math.floor(ages.length / 2)], ages[Math.floor(ages.length * 0.95)]);
}
console.log('\nCONSEQUENCE: any figure quoted as "the null band catches N of M"');
console.log('is an UPPER BOUND on what isNullRead catches, and on this corpus the');
console.log('bound is loose by the fraction printed above. Re-run small-face.js');
console.log('for the real non-face number -- it now reports caughtByNullRead.');
