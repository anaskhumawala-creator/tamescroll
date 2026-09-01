// WHERE CAN THE CLEAR BAR ACTUALLY GO?
//
// "Just lower GENDER_CLEAR_SCORE" and "fit a temperature on the logit"
// are THE SAME MOVE: temperature scaling is monotone in v, so it cannot
// change the ranking, only where the bar sits on it. So the honest
// question is not which mechanism but what the trade looks like, and
// this repo already banked the only two populations that can answer it:
//
//   real faces  25 detections re-read at nine sizes 32..160px
//   non-faces   85 corner crops where BlazeFace found nothing
//
// A read that CLEARS is a person left sharp. So a non-face clearing is
// harmless (nothing to expose) -- but a non-face that FAILS to clear is
// a patch on nothing, which is his "random blur marks". And a real face
// of the opposite gender that clears is an EXPOSURE. Both directions are
// reported at every candidate bar; nothing here is recommended.
import fs from 'fs';

function blobs(f) {
  const s = fs.readFileSync(f, 'utf8'); const out = []; let i = s.indexOf('{');
  while (i >= 0) { let d = 0, j = i;
    for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { d--; if (!d) break; } }
    if (d) break;
    try { out.push(JSON.parse(s.slice(i, j + 1))); } catch {}
    i = s.indexOf('{', j + 1); }
  return out;
}
const FA = blobs('Z:/Apps/Disconnect/spikes/gauntlet/small-face-2026-09-01.txt')[0];
const NF = blobs('Z:/Apps/Disconnect/spikes/gauntlet/small-face-nonface-2026-09-01.txt')[0];

// Real faces, at the sizes his player actually produces.
const SIZES = [32, 40, 48, 56, 64];
const faces = [];
for (const row of FA.rows) for (const s of row.series) {
  if (SIZES.includes(s.px)) faces.push({ px: s.px, v: s.raw, score: s.score, ref: row.ref.gender, g: s.gender });
}
const nulls = [];
for (const row of NF.nullRows) for (const s of row.series) {
  if (SIZES.includes(s.px)) nulls.push({ px: s.px, v: s.raw, score: s.score, g: s.gender });
}
console.log('real-face reads', faces.length, ' (ref', JSON.stringify(FA.refGenders) + ')   non-face reads', nulls.length);
console.log('');

// In MAN mode a MALE read that clears leaves a man sharp -- correct. A
// FEMALE ground truth that reads male and clears is the exposure.
const men   = faces.filter((f) => f.ref === 'male');
const women = faces.filter((f) => f.ref === 'female');

console.log('bar (score) |  men cleared  | women EXPOSED | non-faces still patched');
for (const bar of [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.70, 0.80]) {
  const mc = men.filter((f) => f.g === 'male' && f.score >= bar).length;
  // A woman is exposed only if the model called her male AND cleared.
  const wx = women.filter((f) => f.g === 'male' && f.score >= bar).length;
  const np = nulls.filter((f) => !(f.g === 'male' && f.score >= bar)).length;
  console.log(
    String(bar.toFixed(2)).padStart(11), '|',
    (mc + '/' + men.length).padStart(7), (100 * mc / men.length).toFixed(0).padStart(4) + '%', '|',
    (wx + '/' + women.length).padStart(7), (100 * wx / women.length).toFixed(0).padStart(4) + '%', '|',
    (np + '/' + nulls.length).padStart(9), (100 * np / nulls.length).toFixed(0).padStart(4) + '%'
  );
}
console.log('');
console.log('GENDER_CLEAR_SCORE ships at 0.60.  His measured male MAX is score 0.49.');
console.log('');
// The number that decides whether ANY bar can work: how far apart are the
// two populations on the male side.
const q = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
const f3 = (v) => (v == null ? '  -  ' : v.toFixed(3));
const maleNull = nulls.filter((f) => f.g === 'male').map((f) => f.score);
const maleReal = men.filter((f) => f.g === 'male').map((f) => f.score);
console.log('score of MALE-LABELLED reads   p05/p25/p50/p75/p95');
console.log('  real men  n', String(maleReal.length).padStart(4), [q(maleReal,.05),q(maleReal,.25),q(maleReal,.5),q(maleReal,.75),q(maleReal,.95)].map(f3).join(' '));
console.log('  non-faces n', String(maleNull.length).padStart(4), [q(maleNull,.05),q(maleNull,.25),q(maleNull,.5),q(maleNull,.75),q(maleNull,.95)].map(f3).join(' '));
