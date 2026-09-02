// THE LETTERBOX WITH HYSTERESIS ON, WHICH IS THE ONLY THING THAT COULD
// REVIVE IT.
//
// `movenet-gated.mjs` at N=225 says the letterbox buys **nothing**
// through the shipped gate: 373 admissions against 373 (findings 18).
// It ran both arms with `held: null` -- symmetric, therefore fair, and
// NOT the shipped regime.
//
// WHY THAT MATTERS SPECIFICALLY HERE, and it is not a general "measure
// it properly" argument. `parsePersons` takes the PREVIOUS pass's
// admitted persons and applies an exit threshold to them, so an
// admission is sticky: one frame where a subject clears the bar keeps
// them admitted across frames where they would not have. The residual
// the flat result left behind is **8 frames where only the letterbox
// admits ANYBODY against 1**, and hysteresis is precisely the mechanism
// that turns one such frame into a RUN of covered frames. So the one
// measurement that could move a null into a real effect is this one, and
// it can only move it in that direction.
//
// AND THE OTHER BENCH COULD NOT HAVE RUN IT. Its picks are STRIDED --
// every Nth face-bearing frame, seconds apart -- and hysteresis across a
// two-second gap is meaningless. This one samples CONTIGUOUS RUNS, which
// is what the player actually sees.
//
//   RUNS   how many runs per video          (default 3)
//   LEN    frames per run                   (default 24)
//   FPS    sample rate inside a run         (default 2, his verdict
//                                            cadence is ~1.5-2s, so 2fps
//                                            is roughly one pass apart)
//
// WHAT WOULD MAKE THE CHANGE REAL, stated before running so the result
// cannot be read to taste:
//
//   COVERED-FRAMES  the letterbox arm ends more frames with at least one
//                   admitted person. That is the quantity that decides
//                   whether a subject gets a MEASURED body or a synthetic
//                   one projected from the face.
//   RUN LENGTH      the mean length of a covered run is longer. That is
//                   hysteresis doing the amplifying, and it is the
//                   mechanism this bench exists to test.
//   NOT TOTALS      persons-admitted totals are ALREADY known flat. If
//                   this bench reports a total difference it is measuring
//                   the sampling, not the arms.
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { fsHandler, grabRaw, W, H, ROOT } from './corpus-lib.mjs';
import { parsePersons, unpadPersons } from '../src/person-gate.mjs';
import { fitBox } from '../src/crop-geometry.mjs';

const RUNS = Number(process.env.RUNS || 3);
const LEN = Number(process.env.LEN || 24);
const FPS = Number(process.env.FPS || 2);
const scan = JSON.parse(fs.readFileSync(`${ROOT}/bank/scan.json`, 'utf8'));

// Run starts, spread across the face-bearing part of each video. A run
// that begins where nobody is on screen measures the gate's behaviour on
// an empty shot, which is not the question.
const starts = [];
for (const vid of Object.keys(scan)) {
  const withFace = scan[vid].rows.filter((r) => r.n > 0);
  if (withFace.length < 2) continue;
  const step = Math.max(1, Math.floor(withFace.length / RUNS));
  for (let i = 0, k = 0; k < RUNS && i < withFace.length; i += step, k++) {
    starts.push({ vid, t: withFace[i].t });
  }
}

await tf.setBackend('cpu');
const person = await tfconv.loadGraphModel(fsHandler('movenet-multipose'));

const S = 256;
const AR = W / H;
// Built from INTEGERS the way detector.js builds it, or this validates
// an inverse map against a forward pad the app does not use.
const f0 = fitBox(AR, 1, S);
const dwI = Math.max(1, Math.min(S, Math.round(f0.dw)));
const dhI = Math.max(1, Math.min(S, Math.round(f0.dh)));
const FIT = {
  dx: Math.floor((S - dwI) / 2),
  dy: Math.floor((S - dhI) / 2),
  dw: dwI,
  dh: dhI,
};

function run(b, arm, held) {
  let input;
  if (arm === 'letterbox') {
    const fitted = tf.image.resizeBilinear(b, [FIT.dh, FIT.dw]);
    input = tf.pad(fitted, [
      [0, 0],
      [FIT.dy, S - FIT.dh - FIT.dy],
      [FIT.dx, S - FIT.dw - FIT.dx],
      [0, 0],
    ]);
    tf.dispose(fitted);
  } else {
    input = tf.image.resizeBilinear(b, [S, S]);
  }
  const out = person.execute(tf.cast(input, 'int32'));
  let data = out.dataSync();
  tf.dispose(out);
  tf.dispose(input);
  if (arm === 'letterbox') data = unpadPersons(data, FIT, S);
  // EACH ARM CARRIES ITS OWN HISTORY. Sharing one `held` across the arms
  // would let the letterbox's admissions prop up the squash and destroy
  // the very effect this bench measures -- the A-series ladder failure
  // (one arm printed five times) in a new shape.
  return parsePersons(data, undefined, AR, held);
}

const ARMS = ['squash', 'letterbox'];
const agg = {};
for (const a of ARMS) agg[a] = { covered: 0, persons: 0, runs: [], frames: 0 };

console.log(`runs ${starts.length}  x ${LEN} frames @ ${FPS}fps  ${W}x${H}`);
console.log(`pad ${FIT.dw}x${FIT.dh} at (${FIT.dx},${FIT.dy})   HYSTERESIS ON, per arm\n`);
console.log('video           t    frames   squash-covered  letterbox-covered');

for (const s of starts) {
  let bufs;
  try { bufs = grabRaw(`${ROOT}/video/${s.vid}.mp4`, s.t, LEN, FPS); } catch (e) { continue; }
  if (!bufs || bufs.length < 2) continue;

  const held = { squash: null, letterbox: null };
  const cov = { squash: 0, letterbox: 0 };
  // Covered-run lengths, so "did hysteresis lengthen the runs" is a
  // number rather than an impression.
  const cur = { squash: 0, letterbox: 0 };

  for (const buf of bufs) {
    const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
    const b = tf.expandDims(img, 0);
    for (const a of ARMS) {
      const p = run(b, a, held[a]);
      held[a] = p;
      agg[a].persons += p.length;
      agg[a].frames++;
      if (p.length) {
        cov[a]++;
        cur[a]++;
      } else if (cur[a]) {
        agg[a].runs.push(cur[a]);
        cur[a] = 0;
      }
    }
    tf.dispose([img, b]);
  }
  for (const a of ARMS) {
    if (cur[a]) agg[a].runs.push(cur[a]);
    agg[a].covered += cov[a];
  }

  console.log(`${s.vid.slice(0, 12).padEnd(14)} ${String(s.t).padStart(5)}`
    + `${String(bufs.length).padStart(9)}${String(cov.squash).padStart(17)}`
    + `${String(cov.letterbox).padStart(19)}`);
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
console.log('\n-- WITH HYSTERESIS, both arms, per arm history --');
for (const a of ARMS) {
  const g = agg[a];
  console.log(`  ${a.padEnd(10)} frames ${String(g.frames).padStart(4)}`
    + `   covered ${String(g.covered).padStart(4)}`
    + ` (${((g.covered / Math.max(1, g.frames)) * 100).toFixed(1)}%)`
    + `   persons ${String(g.persons).padStart(4)}`
    + `   covered runs ${String(g.runs.length).padStart(3)}`
    + `   mean run ${mean(g.runs).toFixed(2)}`);
}
const d = agg.letterbox.covered - agg.squash.covered;
console.log(`\n  COVERED-FRAME DELTA  ${d >= 0 ? '+' : ''}${d}`
  + `  of ${agg.squash.frames} frames`);
console.log('  (persons-admitted totals are already known FLAT at N=225 --'
  + ' findings 18 --\n   so a total difference here is the sampling, not the arms.)');
