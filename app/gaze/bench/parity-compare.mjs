// BOTH ARMS, BOTH DIRECTIONS. A parity result that reports only the
// median difference is how a backend that flips one decision in twelve
// gets called "identical" -- so this reports the DECISION flips the
// pipeline would actually make, not just the numeric drift.
import fs from 'fs';
import { GENDER_CLEAR_SCORE, GENDER_MIN_SCORE } from './.cache/shipped.mjs';
const ROOT = 'Z:/tamescroll-corpus/parity';
const A = JSON.parse(fs.readFileSync(`${ROOT}/node-arm.json`, 'utf8'));
const B = JSON.parse(fs.readFileSync(`${ROOT}/webgl-arm.json`, 'utf8'));
console.log('arms:', A.backend, 'vs', B.backend);

const byName = new Map(B.frames.map((f) => [f.name, f]));
let nA = 0, nB = 0, matched = 0, countMismatch = 0;
const dv = [], dage = [], dnm = [], dconf = [];
let genderFlip = 0, clearFlip = 0;
for (const fa of A.frames) {
  const fb = byName.get(fa.name);
  if (!fb) continue;
  nA += fa.faces.length; nB += fb.faces.length;
  if (fa.faces.length !== fb.faces.length) { countMismatch++; continue; }
  for (let i = 0; i < fa.faces.length; i++) {
    const a = fa.faces[i], b = fb.faces[i];
    matched++;
    dv.push(Math.abs((a.raw ?? 0) - (b.raw ?? 0)));
    dage.push(Math.abs((a.age ?? 0) - (b.age ?? 0)));
    dnm.push(Math.abs((a.nm ?? 0) - (b.nm ?? 0)));
    dconf.push(Math.abs(a.conf - b.conf));
    if (a.gender !== b.gender) genderFlip++;
    // The decision the pipeline actually makes: does this read clear.
    const ca = (a.score ?? 0) >= GENDER_CLEAR_SCORE, cb = (b.score ?? 0) >= GENDER_CLEAR_SCORE;
    if (ca !== cb) clearFlip++;
  }
}
const q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;
console.log(`frames ${A.frames.length}  faces ${nA} vs ${nB}  frames w/ different face COUNT: ${countMismatch}`);
console.log(`matched faces ${matched}`);
const row = (n, a) => console.log(`  ${n.padEnd(16)} p50 ${q(a,0.5).toFixed(5)}  p95 ${q(a,0.95).toFixed(5)}  max ${q(a,1).toFixed(5)}`);
row('|d raw sigmoid|', dv); row('|d age years|', dage); row('|d nm|', dnm); row('|d box conf|', dconf);
console.log(`DECISION FLIPS  gender label ${genderFlip}/${matched}   clears-the-bar ${clearFlip}/${matched}`);
console.log(clearFlip === 0 && genderFlip === 0 && countMismatch === 0
  ? 'PARITY OK -- no decision this corpus feeds the verdict layer changes across backends.'
  : 'PARITY BROKEN -- offline numbers do NOT transfer to his device. Do not calibrate on them.');
