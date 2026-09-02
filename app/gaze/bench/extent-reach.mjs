// HOW MUCH OF THE EXTENT LAYER CAN THE CORPUS SEE AT ALL?
//
// Phase-f F3: `control-triple.test.mjs` claimed it fails when ANY
// shipped decision constant moves, and `PATCH_MARGIN` 0.045 -> 0.500,
// `PERSON_MIN_SCORE` -> 0.99 and `HEAD_ANCHOR_UP` -> 0.0 all leave it
// green. The claim was narrowed rather than the test widened, and the
// reason given was structural: the corpus banks PARSED PERSONS, so the
// arm sits downstream of `parsePersons` and a constant inside that
// function cannot move it.
//
// That answer is only half of one. The OTHER half decides whether it
// matters, and nobody has measured it: **on this footage, does MoveNet
// admit anybody at all?** Findings 16/36 say his phone reads all twelve
// slots `n:0` and the FACE path carries the entire player blur. If the
// corpus is in that regime too, then the extent that reaches the screen
// is `personFromFace`'s synthetic body -- and `PERSON_MIN_SCORE` and
// `HEAD_ANCHOR_UP` are not a blind spot in the instrument, they are
// constants with no reachable effect on this footage, which is a very
// different statement and a much more useful one.
//
// So this reads the RAW banked [1,6,56] tensors -- the same bytes the
// slot arm uses -- through the SHIPPED `parsePersons`, and counts:
//
//   ADMITTED    frames where parsePersons returns at least one person
//   REACHED     of those, how many the arm would actually consult
//   SYNTHETIC   frames where every body on screen came from a face
//
// It changes nothing and sweeps nothing. It is the prior question:
// which half of the geometry layer this corpus is able to price.
import fs from 'fs';
import { ROOT, winFiles, W, H } from './corpus-lib.mjs';
import { loadWin, thinFrames, K_HIS } from './arch-arms.mjs';
import { parsePersons, PERSON_MIN_SCORE, synthFaceIndices } from './.cache/shipped.mjs';

const K = Number(process.env.K || K_HIS);
const STRIDE = 336; // 6 slots * 56 floats

let frames = 0, withTensor = 0, admittedFrames = 0, admittedPersons = 0;
let facesTotal = 0, facesInsideAPerson = 0;
const perSlotMax = [];
const rows = [];


for (const file of winFiles()) {
  const w = thinFrames(loadWin(file), K);
  const fr = w.frames || [];
  if (!w.persons) { rows.push([w.tag, fr.length, 0, 0, 0]); continue; }
  let wAdmit = 0, wPersons = 0, wFrames = 0;
  for (let fi = 0; fi < fr.length; fi++) {
    frames++;
    const off = fi * STRIDE;
    if (off + STRIDE > w.persons.length) continue;
    withTensor++; wFrames++;
    const slice = w.persons.subarray(off, off + STRIDE);
    let best = 0;
    for (let s = 0; s < 6; s++) best = Math.max(best, slice[s * 56 + 55]);
    perSlotMax.push(best);
    let persons = [];
    try { persons = parsePersons(slice, undefined, W / H, null) || []; } catch (e) { persons = []; }
    if (persons.length) { admittedFrames++; wAdmit++; }
    admittedPersons += persons.length;
    wPersons += persons.length;
    // THE SHIPPED RULE, CALLED, NOT RE-DERIVED. The first version of
    // this bench used a private unpadded containment test with no
    // one-face-per-person rule and under-counted the synthetic share
    // (phase-g G1). Both halves matter and they pull opposite ways: the
    // 10% pad admits faces a bare box misses, and `claimed` sends every
    // SECOND face inside one box to personFromFace anyway.
    const faces = ((fr[fi] && fr[fi].faces) || [])
      .filter((f) => f && typeof f.x1 === 'number');
    facesTotal += faces.length;
    const synth = synthFaceIndices(faces, persons);
    facesInsideAPerson += faces.length - synth.length;
  }
  rows.push([w.tag, wFrames, wAdmit, wPersons, wFrames ? wAdmit / wFrames : 0]);
}

const q = (a, f) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)] : NaN);
const pc = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : 'n/a');

console.log(`${rows.length} windows, k=${K} (${(K * 0.5).toFixed(1)}s/verdict), `
  + `${frames} frames, ${withTensor} with a banked MoveNet tensor`);
console.log(`PERSON_MIN_SCORE ${PERSON_MIN_SCORE}`);
console.log('');
console.log(`frames where parsePersons ADMITS anybody   ${admittedFrames}`
  + `  (${pc(admittedFrames, withTensor)})`);
console.log(`persons admitted, total                    ${admittedPersons}`);
console.log(`slot score, best in frame   p05 ${q(perSlotMax, 0.05).toFixed(3)}`
  + `  p50 ${q(perSlotMax, 0.5).toFixed(3)}`
  + `  p95 ${q(perSlotMax, 0.95).toFixed(3)}`
  + `  max ${q(perSlotMax, 0.999).toFixed(3)}`);
console.log('');
console.log(`banked faces                               ${facesTotal}`);
console.log(`  that CLAIM an admitted person's box        ${facesInsideAPerson}`
  + `  (${pc(facesInsideAPerson, facesTotal)})`);
console.log(`  falling through to personFromFace         ${facesTotal - facesInsideAPerson}`
  + `  (${pc(facesTotal - facesInsideAPerson, facesTotal)})`);
console.log('  -- "claim", not "fall inside": a SECOND face in one box');
console.log('     gets a synthetic body too (shipped `claimed` rule).');
console.log('');
console.log('THE READING: the right-hand number is the share of the corpus');
console.log('whose extent comes from personFromFace rather than from a');
console.log('measurement. Constants inside parsePersons can only reach the');
console.log('other share, and no sweep of them can move a window that has');
console.log('none of it.');
console.log('');
console.log('win'.padEnd(26) + 'frames  admitFrames  persons   admit%');
for (const r of rows.sort((a, b) => b[4] - a[4]))
  console.log(String(r[0]).slice(0, 25).padEnd(26)
    + String(r[1]).padStart(6) + String(r[2]).padStart(13)
    + String(r[3]).padStart(9) + (100 * r[4]).toFixed(1).padStart(8) + '%');
