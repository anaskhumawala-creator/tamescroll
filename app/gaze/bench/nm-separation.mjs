// THE SIGNAL THAT HAS BEEN IN EVERY READ AND NEVER LOOKED AT.
//
// `nm` is the faceres descriptor's magnitude before L2-normalisation --
// how much the network actually extracted from the crop, as opposed to
// which way it leaned. It was added in R22 with a note saying exactly
// that and nobody has analysed it since.
//
// The reason it matters: every gate this project has tried decides on
// the OUTSIDE of a detection (box confidence, pixel size, MoveNet's
// opinion of the frame) and all three were measured not to separate.
// isNullRead decides on the sigmoid, which is the same number the
// verdict uses -- so a read it refuses is a read the verdict could not
// have used anyway. `nm` is the first quantity in this pipeline that is
// about the CROP rather than about the answer.
//
// Measured live on his own phone, 300 reads: nm p50 12.66 on reads that
// clear GENDER_CLEAR_SCORE against 2.88 on null reads. This asks the
// corpus whether that holds, whether it is merely |v-0.5| restated, and
// what a bar on it would cost.
import fs from 'fs'; import path from 'path';

const files = [];
(function w(d) { let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = path.join(d, x.name); if (x.isDirectory()) w(p); else if (x.name === 'meta.json') files.push(p); } })('Z:/Apps/Disconnect/spikes/gauntlet/runs');

const R = [];
for (const f of files) { let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  for (const fr of (j.frames || [])) for (const r of (fr.reads || []))
    if (r && typeof r.nm === 'number' && typeof r.v === 'number') R.push({ ...r, vid: fr.vid }); }

const q = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
const f2 = (v) => (v == null ? '  -  ' : v.toFixed(2));

// Two populations that are NOT defined by the sigmoid, so the comparison
// is not circular: a read whose face BlazeFace was confident about and
// that is large, versus one it barely found and that is small.
const good = R.filter((r) => (r.fc || 0) >= 0.85 && (r.px || 0) >= 120);
const poor = R.filter((r) => (r.fc || 0) <= 0.55 && (r.px || 0) <= 80);
console.log('corpus reads carrying nm', R.length);
console.log('  fc>=0.85 & px>=120  n', String(good.length).padStart(5), ' nm p05/p50/p95', [q(good.map(r => r.nm), .05), q(good.map(r => r.nm), .5), q(good.map(r => r.nm), .95)].map(f2).join(' '));
console.log('  fc<=0.55 & px<=80   n', String(poor.length).padStart(5), ' nm p05/p50/p95', [q(poor.map(r => r.nm), .05), q(poor.map(r => r.nm), .5), q(poor.map(r => r.nm), .95)].map(f2).join(' '));
console.log('');

// Is nm just |v-0.5| restated? Partial correlation matters more than the
// raw one: within a NARROW sigmoid slice, does nm still vary?
const pear = (xs, ys) => { const m = (a) => a.reduce((s, x) => s + x, 0) / a.length; const mx = m(xs), my = m(ys);
  let n = 0, dx = 0, dy = 0; for (let i = 0; i < xs.length; i++) { n += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; } return n / Math.sqrt(dx * dy); };
console.log('pearson(|v-0.5|, nm) overall', pear(R.map(r => Math.abs(r.v - 0.5)), R.map(r => r.nm)).toFixed(3));
for (const [lo, hi] of [[0.53, 0.62], [0.62, 0.72], [0.75, 0.85]]) {
  const s = R.filter((r) => r.v >= lo && r.v < hi);
  if (s.length < 50) continue;
  console.log('  inside v', lo, '..', hi, ' n', String(s.length).padStart(5),
    ' nm p05/p50/p95', [q(s.map(r => r.nm), .05), q(s.map(r => r.nm), .5), q(s.map(r => r.nm), .95)].map(f2).join(' '),
    ' pearson within slice', pear(s.map(r => Math.abs(r.v - 0.5)), s.map(r => r.nm)).toFixed(3));
}
console.log('');
console.log('-- what an nm floor would refuse, INSIDE the null band only');
const band = R.filter((r) => r.v >= 0.53 && r.v <= 0.72);
// A patch that is on a REAL person is one whose read later cleared or
// flagged with certainty on the same video; the corpus cannot label a
// single read, so this reports volumes, not correctness.
for (const bar of [0, 2, 4, 6, 8, 10]) {
  const refused = band.filter((r) => r.nm < bar).length;
  const alsoOut = R.filter((r) => (r.v < 0.53 || r.v > 0.72) && r.nm < bar).length;
  console.log('  nm <', String(bar).padStart(2), ' refuses', String(refused).padStart(5), 'of', band.length,
    'in-band =', (100 * refused / band.length).toFixed(0) + '%',
    '  and', String(alsoOut).padStart(5), 'of', R.length - band.length, 'OUT-of-band reads =', (100 * alsoOut / (R.length - band.length)).toFixed(1) + '%');
}
console.log('');
console.log('OUT-of-band reads are the ones the verdict actually uses, so the');
console.log('second column is the cost of an nm floor in the exposure direction.');
