// WHY: a man's face reads male at p50 0.864 and clears the bar 87% of
// the time, yet 65% of his covered time sits on a clear that is 0-3s
// old with no cut -- and CLEAR_STREAK_N 1 recovers only 4.5% of it. So
// the clear is not being DELAYED, it is being REFUSED before it reaches
// the tracker.
//
// The verdict layer stacks vetoes in three files. This runs every one
// of them over the same 1410 faces the score calls MAN and reports
// which fires. Order matters: a face can trip several, so it is charged
// to the FIRST that would reject it, exactly as the code does.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';
const S = await import('./.cache/shipped.mjs');

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const names = Object.keys(S).filter((k) => /NULL|NM|ADULT|CHILD|CLEAR|MIN_SCORE|FACE_MIN/.test(k));
console.log('shipped constants in play:');
for (const n of names) if (typeof S[n] === 'number') console.log('  ' + n.padEnd(28) + S[n]);

const YFE = S.GENDER_CLEAR_SCORE;
const tally = {};
const bump = (k) => (tally[k] = (tally[k] || 0) + 1);
let n = 0;
for (const f of fs.readdirSync(`${ROOT}/bank/reads`).filter((x) => x.endsWith('.json'))) {
  const w = loadWin(f);
  for (const fr of w.frames) for (const fc of fr.faces) {
    if (cropLabel.get(fc.crop) !== 'man') continue;
    n++;
    const score = 2 * Math.abs(fc.raw - 0.5);
    if (fc.raw < 0.5) { bump('1 reads FEMALE'); continue; }
    if (typeof S.FACE_MIN_NATIVE_PX === 'number' && fc.px < S.FACE_MIN_NATIVE_PX) { bump('2 face too small (abstains)'); continue; }
    if (S.isAdultRead && !S.isAdultRead(fc)) { bump('3 child gate'); continue; }
    if (S.isNullRead && S.isNullRead(fc)) { bump('4 null read (band+age)'); continue; }
    if (typeof S.NULL_MINT_NM_FLOOR === 'number' && !(fc.nm >= S.NULL_MINT_NM_FLOOR)) { bump('5 nm floor'); continue; }
    if (S.hasDescriptorSignal && !S.hasDescriptorSignal(fc)) { bump('6 no descriptor signal'); continue; }
    if (score < YFE) { bump('7 male but under the clear bar'); continue; }
    bump('0 SURVIVES -- should clear him');
  }
}
console.log(`\nfaces labelled MAN: ${n}`);
for (const k of Object.keys(tally).sort())
  console.log('  ' + k.padEnd(30) + String(tally[k]).padStart(6) + '  ' + (100 * tally[k] / n).toFixed(1) + '%');
