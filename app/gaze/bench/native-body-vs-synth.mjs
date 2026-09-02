// THE COVERAGE DROP, MECHANISM TEST (2026-09-02, after 1093).
//
// On the Redmi the native engine reads coverage 0.55-0.58 where the WebGL
// worker read 0.628-0.640 on the same video, in the exposure direction.
// Hypothesis: MoveNet's MEASURED body is tighter than the face-derived
// synthetic one, so the covered AREA shrinks while more people are
// admitted. This bench decides it on the parity dumps -- the same frames
// through both engines -- with the SHIPPED rules (personFromFace,
// synthFaceIndices out of the emitted bundle; never a copy).
//
//   worker set  = union of personFromFace(face) over every face (MoveNet
//                 admits nobody on that arm, measured: 0 of 16 frames)
//   native set  = union of MoveNet person boxes + personFromFace over the
//                 faces synthFaceIndices leaves unclaimed
//
// Per frame, on a 200x112 grid: area of each set, and the part of the
// WORKER set the native set does not cover ("uncovered"), split into
// pixels inside a FACE box (a head left sharp -- exposure) and the rest
// (body extrapolation the measurement disagrees with). Faces are the
// native engine's own; gender is ignored (this is geometry).
//
//   node bench/native-body-vs-synth.mjs spikes/gauntlet/native-parity-<ts>.json
import fs from 'fs';
import { personFromFace, synthFaceIndices } from './.cache/shipped.mjs';

const file = process.argv[2] || '../../spikes/gauntlet/native-parity-1788347487.json';
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const GW = 200, GH = 112;

function grid() { return new Uint8Array(GW * GH); }
function paint(g, b) {
  const x1 = Math.max(0, Math.floor(b.x1 * GW)), x2 = Math.min(GW, Math.ceil(b.x2 * GW));
  const y1 = Math.max(0, Math.floor(b.y1 * GH)), y2 = Math.min(GH, Math.ceil(b.y2 * GH));
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) g[y * GW + x] = 1;
}
function area(g) { let n = 0; for (let i = 0; i < g.length; i++) n += g[i]; return n / (GW * GH); }

const rows = [];
let sumW = 0, sumN = 0, sumUnc = 0, sumUncFace = 0, facesSharp = 0, facesTotal = 0, framesWithPersons = 0;
for (const fr of d.frames) {
  const faces = (fr.native && fr.native.faces) || [];
  const persons = (fr.native && fr.native.persons) || [];
  const ar = fr.aspect || 16 / 9;
  const w = grid(), n = grid(), fg = grid();
  for (const f of faces) { paint(w, personFromFace(f, ar)); paint(fg, f); }
  for (const p of persons) paint(n, p);
  const synth = synthFaceIndices(faces, persons);
  for (const fi of synth) paint(n, personFromFace(faces[fi], ar));
  let unc = 0, uncFace = 0;
  for (let i = 0; i < w.length; i++) if (w[i] && !n[i]) { unc++; if (fg[i]) uncFace++; }
  // a face is SHARP on native if any of its own pixels is uncovered there
  for (const f of faces) {
    facesTotal++;
    const g = grid(); paint(g, f);
    let sharp = 0; for (let i = 0; i < g.length; i++) if (g[i] && !n[i]) sharp++;
    if (sharp > 0) facesSharp++;
  }
  if (persons.length) framesWithPersons++;
  const aw = area(w), an = area(n);
  sumW += aw; sumN += an; sumUnc += unc / (GW * GH); sumUncFace += uncFace / (GW * GH);
  rows.push({ t: fr.t, faces: faces.length, persons: persons.length, synth: synth.length, worker: aw, native: an, uncovered: unc / (GW * GH), uncoveredFace: uncFace / (GW * GH) });
}
const N = d.frames.length;
console.log(`file ${file}\nframes ${N}, with MoveNet persons ${framesWithPersons}, faces ${facesTotal}`);
console.log('t     faces persons synth  worker  native  uncovered  ofWhichFace');
for (const r of rows) console.log(`${String(r.t).padEnd(5)} ${String(r.faces).padStart(5)} ${String(r.persons).padStart(7)} ${String(r.synth).padStart(5)}  ${r.worker.toFixed(3)}   ${r.native.toFixed(3)}   ${r.uncovered.toFixed(3)}      ${r.uncoveredFace.toFixed(3)}`);
console.log(`\nmean covered area: worker ${(sumW / N).toFixed(3)}  native ${(sumN / N).toFixed(3)}  (native/worker ${(sumN / sumW).toFixed(3)})`);
console.log(`mean of worker set NOT covered by native: ${(sumUnc / N).toFixed(3)} of frame, of which inside a face box ${(sumUncFace / N).toFixed(4)}`);
console.log(`faces with any sharp pixel on native: ${facesSharp} of ${facesTotal}`);
