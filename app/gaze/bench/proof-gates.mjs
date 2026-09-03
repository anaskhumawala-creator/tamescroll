// "PROVE THE MAN" -- WHAT DOES EACH PIECE OF EVIDENCE ACTUALLY BUY?
//
// Blur-first means the app never has to SPOT a woman. It only has to
// FAIL TO PROVE a man. So the question is not "is the classifier right"
// but "what should count as proof".
//
// Today proof is one read: gender male AND score >= GENDER_CLEAR_SCORE
// 0.45, i.e. raw >= 0.725. That bar is already high. What is NOT built is
// refusing to ASK when the face is not worth asking about -- and a
// question never asked costs nothing, because the subject stays blurred
// by default.
//
// Measured earlier today, women only, within-identity:
//   turned head (asym >= 0.20)  -10.0 pts     tilt >= 5 deg  -4.5 pts
//   detector conf >= 0.72       +7.3 pts
// Those are the candidate gates. This prices each one in the two
// currencies that matter.
//
// EXPOSURE   = a woman with a clearance (man mode: she goes sharp)
// FALSE COVER = a man with no clearance (he stays blurred)
//
// PER READ, not per second. The shipped system is temporal -- a track
// holds its state between reads, a cleared track stays cleared -- so
// these are the INPUT rates to that machine, not the on-screen result.
// A gate that halves exposure per read does not halve seconds of
// exposure. Do not quote these as seconds.
//
// HELD OUT: nothing is fitted here, so there is nothing to hold out.
// Every gate is a fixed rule read off measurements taken before it.
import fs from 'fs';

const rows = JSON.parse(fs.readFileSync('Z:/Apps/Disconnect/app/gaze/bench/.cache/yaw-rows.json', 'utf8'));
const CLEAR = 0.45;   // GENDER_CLEAR_SCORE, male

for (const r of rows) {
  // yaw-rows banked `right` + `score`; recover the label the head gave.
  r.head = r.right ? (r.who === 'man' ? 'male' : 'female')
                   : (r.who === 'man' ? 'female' : 'male');
  r.raw = r.head === 'male' ? 0.5 + r.score / 2 : 0.5 - r.score / 2;
  r.man = r.who === 'man';
  const m = /f(\d+)_b/.exec(r.crop);
  r.f = m ? Number(m[1]) : 0;
  r.clearNow = r.head === 'male' && r.score >= CLEAR;
}

const F = rows.filter((r) => !r.man), M = rows.filter((r) => r.man);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');

function price(name, ok) {
  // ok(r) = this read is allowed to grant a clearance.
  const exp = F.filter((r) => r.clearNow && ok(r)).length;
  const cov = M.filter((r) => !(r.clearNow && ok(r))).length;
  const asked = rows.filter(ok).length;
  console.log(`${name.padEnd(34)} exposure ${pct(exp, F.length).padStart(6)}`
    + `   false cover ${pct(cov, M.length).padStart(6)}`
    + `   asked ${pct(asked, rows.length).padStart(6)}`);
}

console.log(`women ${F.length}   men ${M.length}   people ${new Set(rows.map((r) => r.cid)).size}\n`);
console.log('SHIPPED, then one gate at a time:\n');
price('shipped (no gate)', () => true);
console.log();
for (const c of [0.30, 0.25, 0.20, 0.15]) price(`refuse turned head  asym < ${c}`, (r) => r.asym < c);
console.log();
for (const c of [10, 7, 5, 3]) price(`refuse tilt         tilt < ${c}`, (r) => r.tilt < c);
console.log();
for (const c of [0.60, 0.72, 0.80, 0.85]) price(`need detector conf  >= ${c}`, (r) => r.conf >= c);
console.log();
for (const c of [40, 56, 64, 80]) price(`need face px        >= ${c}`, (r) => r.px >= c);
console.log();
for (const c of [5, 8, 10, 12]) price(`need descriptor nm  >= ${c}`, (r) => r.nm >= c);

console.log('\nSTACKED (the "only ask about a good face" rule):\n');
const good = (a, t, c) => (r) => r.asym < a && r.tilt < t && r.conf >= c;
price('asym<.25 tilt<7  conf>=.72', good(0.25, 7, 0.72));
price('asym<.20 tilt<5  conf>=.72', good(0.20, 5, 0.72));
price('asym<.20 tilt<5  conf>=.80', good(0.20, 5, 0.80));
price('asym<.15 tilt<5  conf>=.80', good(0.15, 5, 0.80));

// ---- STEADINESS ---------------------------------------------------------
// Correlated error is the trap: the head gets a given woman wrong the SAME
// way every frame, so agreement across frames is not independent evidence.
// What agreement CAN rule out is a wobbling read. Require the last K reads
// of this person, in order, to all clear.
console.log('\nSTEADY: last K reads of this person all clear\n');
const byCid = new Map();
for (const r of rows) {
  if (!byCid.has(r.cid)) byCid.set(r.cid, []);
  byCid.get(r.cid).push(r);
}
for (const a of byCid.values()) a.sort((x, y) => x.f - y.f);
for (const K of [1, 2, 3, 4]) {
  for (const a of byCid.values()) {
    for (let i = 0; i < a.length; i++) {
      let ok = true;
      for (let j = i - K + 1; j <= i; j++) { if (j < 0 || !a[j].clearNow) { ok = false; break; } }
      a[i].steady = ok;
    }
  }
  const exp = F.filter((r) => r.steady).length, cov = M.filter((r) => !r.steady).length;
  console.log(`  K=${K}   exposure ${pct(exp, F.length).padStart(6)}   false cover ${pct(cov, M.length).padStart(6)}`);
}

console.log('\nSTEADY x GOOD FACE (both, K=2, asym<.20 tilt<5 conf>=.72)\n');
for (const a of byCid.values()) {
  const g = a.filter(good(0.20, 5, 0.72));
  for (const r of a) r.steady2 = false;
  for (let i = 1; i < g.length; i++) if (g[i].clearNow && g[i - 1].clearNow) g[i].steady2 = true;
}
{
  const exp = F.filter((r) => r.steady2).length, cov = M.filter((r) => !r.steady2).length;
  console.log(`  exposure ${pct(exp, F.length)}   false cover ${pct(cov, M.length)}`);
}
