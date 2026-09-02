// THE LETTERBOX THROUGH THE SHIPPED GATE, WITH THE COORDINATES MAPPED
// BACK.
//
// `movenet-aspect.mjs` answered the first half of 16b: on the same
// decoded bytes, letterboxing admits 219 -> 269 persons over 241 frames
// at a flat 0.35 slot threshold. It could not answer the second half,
// and the second half is the one that decides whether this ships:
//
//   1. THE SHIPPED GATE IS NOT A THRESHOLD. `parsePersons` runs an
//      anchor gate, a keypoint-evidence gate, a size gate, a keypoint
//      union and admission hysteresis. A raw-score win can vanish there
//      -- or grow. Quoting the raw number as if it were the shipped one
//      is the "a gate calibrated on a dead signal only restates itself"
//      trap that bench's own header warns about, run in reverse.
//
//   2. MoveNet NORMALIZES ITS OUTPUTS TO ITS OWN INPUT. Under a pad,
//      every coordinate is 0..1 of the PADDED CANVAS, so a letterbox arm
//      that does not un-map is measuring boxes in the wrong space. That
//      is exactly why 16b was recorded as "a round, not an edit" and not
//      shipped. `unpadPersons` is the map; this is the bench that has to
//      prove the map before the flag moves.
//
// So both arms go through the SHIPPING `parsePersons`, the letterbox arm
// through `unpadPersons` first, and the comparison is on ADMITTED
// PERSONS and their geometry in FRAME space -- the two things that reach
// the screen.
//
// THE ANSWER, N=225, and it is a NULL on the headline metric: persons
// admitted 373 against 373 (findings 18). The raw-score win does not
// survive the gate. At N=30 this same bench read +28.9% and that number
// reached a commit message -- loop 40's rule the other way round, and it
// is the one that bit: **a large effect at a small N is a claim about
// the sample.** What survives is 8 frames where only the letterbox
// admits ANYBODY against 1 (p = 0.039), and the inverse map itself:
// 315 matched people, median edge deltas exactly 0.000, and the map's
// worst UNCLAMPED overshoot 0.024 against a 0.05 tolerance -- see the
// note beside the sanity loop for why that reads as a magnitude and not
// a count, and why the first version of it could not fail at all.
//
// STILL UNMEASURED, and it is the one thing that could revive this: both
// arms run with `held: null`, so admission HYSTERESIS is off on both
// sides. Symmetric and therefore fair, but not the shipped regime -- and
// hysteresis is precisely the mechanism that turns one admission into a
// run of them, so it would amplify the residual and nothing else. Thread
// `held` before writing the letterbox off.
//
// WHAT WOULD MAKE THE CHANGE REAL, stated before running:
//
//   ADMISSION  the letterbox admits a person on frames the squash
//              admits nobody. On this path a person nobody admits gets a
//              SYNTHETIC body from the face instead of a measured one.
//   GEOMETRY   for a person BOTH arms admit, the boxes differ by more
//              than rounding -- and the squash's is the distorted one,
//              so a large delta is the placement error being removed.
//   SANITY     the letterbox arm's boxes stay inside 0..1 and are not
//              systematically shifted, which is what a broken inverse
//              map looks like and is worse than the squash it replaces.
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { fsHandler, grabRaw, W, H, ROOT } from './corpus-lib.mjs';
import { parsePersons, unpadPersons, PERSON_MIN_SCORE } from '../src/person-gate.mjs';
import { fitBox } from '../src/crop-geometry.mjs';

const N = Number(process.env.N || 120);
const scan = JSON.parse(fs.readFileSync(`${ROOT}/bank/scan.json`, 'utf8'));

const picks = [];
for (const vid of Object.keys(scan)) {
  const withFace = scan[vid].rows.filter((r) => r.n > 0);
  if (!withFace.length) continue;
  const per = Math.max(1, Math.round(N / Object.keys(scan).length));
  const step = Math.max(1, Math.floor(withFace.length / per));
  for (let i = 0; i < withFace.length && picks.filter((p) => p.vid === vid).length < per; i += step)
    picks.push({ vid, t: withFace[i].t });
}

await tf.setBackend('cpu');
const person = await tfconv.loadGraphModel(fsHandler('movenet-multipose'));

const S = 256;
const AR = W / H;
// THE PAD IS BUILT THE WAY THE SHIPPED PATH BUILDS IT -- integers first,
// fit derived from the integers -- or the bench would validate an
// inverse map against a forward pad the app does not use.
const f0 = fitBox(AR, 1, S);
const dwI = Math.max(1, Math.min(S, Math.round(f0.dw)));
const dhI = Math.max(1, Math.min(S, Math.round(f0.dh)));
const FIT = {
  dx: Math.floor((S - dwI) / 2),
  dy: Math.floor((S - dhI) / 2),
  dw: dwI,
  dh: dhI,
};

function run(b, arm) {
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
  // THE SANITY CHECK HAS TO READ THE MAP, NOT ITS OUTPUT.
  // The first version asked whether the boxes `parsePersons` EMITS sit
  // inside 0..1 -- and `parsePersons` clamps every box it emits, and so
  // does `unpadPersons`, so a map off by a factor of three would have
  // read zero out-of-range and printed "the inverse map holds"
  // (phase-f F4). A check that cannot fail is not a check. So the
  // unclamped inverse is computed here, from the raw model floats,
  // exactly as `unpadPersons` computes it minus the clamp.
  let raw = null;
  if (arm === 'letterbox') {
    raw = [];
    const ox = FIT.dx / S, oy = FIT.dy / S, sx = FIT.dw / S, sy = FIT.dh / S;
    for (let pi = 0; pi < 6; pi++) {
      const o = pi * 56;
      if (!(data[o + 55] > 0)) continue;
      raw.push({
        scored: data[o + 55] >= PERSON_MIN_SCORE,
        y1: (data[o + 51] - oy) / sy,
        x1: (data[o + 52] - ox) / sx,
        y2: (data[o + 53] - oy) / sy,
        x2: (data[o + 54] - ox) / sx,
      });
    }
    data = unpadPersons(data, FIT, S);
  }
  // `held` null: this is a per-frame comparison and hysteresis would
  // carry one arm's history into the other's frame.
  const out2 = parsePersons(data, undefined, AR, null);
  if (raw) out2.rawBoxes = raw;
  return out2;
}

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2), y2 = Math.min(a.y2, b.y2);
  if (!(x2 > x1 && y2 > y1)) return 0;
  const i = (x2 - x1) * (y2 - y1);
  const ua = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - i;
  return ua > 0 ? i / ua : 0;
}

const tot = { squash: 0, letterbox: 0 };
let frames = 0, onlyLB = 0, onlySQ = 0, moreLB = 0, moreSQ = 0, rawBoxes = 0, rawScored = 0, worstAll = 0, worstScored = 0;
const pairIou = [], dTop = [], dBot = [], dH = [];

console.log(`frames requested ${picks.length}   ${W}x${H}  ar ${AR.toFixed(3)}`);
console.log(`pad: ${FIT.dw}x${FIT.dh} at (${FIT.dx},${FIT.dy}) in ${S}  `
  + `-- bars ${FIT.dy}px top and bottom\n`);
console.log('video           t     squash  letterbox');

for (const p of picks) {
  let buf;
  try { [buf] = grabRaw(`${ROOT}/video/${p.vid}.mp4`, p.t, 1); } catch (e) { continue; }
  if (!buf) continue;
  const img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
  const b = tf.expandDims(img, 0);
  const sq = run(b, 'squash');
  const lb = run(b, 'letterbox');
  tf.dispose([img, b]);

  frames++;
  tot.squash += sq.length;
  tot.letterbox += lb.length;
  if (lb.length && !sq.length) onlyLB++;
  if (sq.length && !lb.length) onlySQ++;
  if (lb.length > sq.length) moreLB++;
  if (sq.length > lb.length) moreSQ++;

  // SANITY: a broken inverse map shows up here first, and it is the
  // failure that is worse than the defect. Read on the UNCLAMPED
  // inverse -- see the note in run().
  // A MAGNITUDE, NOT A COUNT, and the reason is measured. MoveNet's box
  // regression overshoots its own content box by a couple of model
  // pixels, and the inverse divides the padded axis by sy = 0.5625,
  // which amplifies that to ~0.024 in frame units. Both examples found
  // at N=10 are y-only, at the pad edge, on real people:
  //   NWoT1ZVd1Lo t=2  raw y[0.2051, 0.7914] -> y[-0.024, 1.018]
  //   z86LGEFyQpo t=2  raw y[0.4042, 0.7949] -> y[ 0.330, 1.024]
  // (the pad's own bottom edge is (56+144)/256 = 0.78125, so the model
  // is reaching ~3.5px into the black bar). x never overshoots because
  // sx is 1.0 and there is nothing to amplify. So a hard 0.02 count
  // cries wolf on a CORRECT map. The worst overshoot is the honest
  // statistic: model noise is hundredths, a wrong map is tenths --
  // deliberately breaking sx to sx/3 reads 0.699 here.
  for (const q of (lb.rawBoxes || [])) {
    const over = Math.max(-q.x1, -q.y1, q.x2 - 1, q.y2 - 1, 0);
    rawBoxes++;
    if (over > worstAll) worstAll = over;
    if (q.scored) { rawScored++; if (over > worstScored) worstScored = over; }
  }

  // GEOMETRY, on people BOTH arms admit: greedy nearest by IoU.
  const taken = new Array(lb.length).fill(false);
  for (const a of sq) {
    let best = -1, bi = -1;
    for (let j = 0; j < lb.length; j++) {
      if (taken[j]) continue;
      const v = iou(a, lb[j]);
      if (v > best) { best = v; bi = j; }
    }
    if (bi >= 0 && best > 0.1) {
      taken[bi] = true;
      pairIou.push(best);
      dTop.push(lb[bi].y1 - a.y1);
      dBot.push(lb[bi].y2 - a.y2);
      dH.push((lb[bi].y2 - lb[bi].y1) - (a.y2 - a.y1));
    }
  }

  console.log(`${p.vid.slice(0, 12).padEnd(14)} ${String(p.t).padStart(5)}`
    + `${String(sq.length).padStart(8)}${String(lb.length).padStart(11)}`);
}

const q = (a, f) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)] : NaN);
const sg = (n) => (n >= 0 ? '+' : '') + n.toFixed(3);

console.log(`\n-- ADMISSION, through the SHIPPED gate, ${frames} frames --`);
console.log(`  persons admitted   squash ${tot.squash}   letterbox ${tot.letterbox}`
  + `   (${tot.squash ? sg((tot.letterbox / tot.squash - 1) * 100) + '%' : 'n/a'})`);
console.log(`  frames where only ONE arm admits anybody:  letterbox ${onlyLB}   squash ${onlySQ}`);
console.log(`  frames where one admits MORE:              letterbox ${moreLB}   squash ${moreSQ}`);

console.log(`\n-- GEOMETRY, ${pairIou.length} matched people --`);
if (pairIou.length) {
  console.log(`  IoU between the two arms' boxes   p05 ${q(pairIou, 0.05).toFixed(3)}`
    + `  p50 ${q(pairIou, 0.5).toFixed(3)}  p95 ${q(pairIou, 0.95).toFixed(3)}`);
  console.log(`  top edge   letterbox - squash     p50 ${sg(q(dTop, 0.5))}`);
  console.log(`  bottom edge                       p50 ${sg(q(dBot, 0.5))}`);
  console.log(`  height                            p50 ${sg(q(dH, 0.5))}`);
}
console.log(`\n-- SANITY --`);
const MAP_TOL = 0.05;
console.log(`  unclamped inverse boxes checked: ${rawBoxes}`
  + `  (${rawScored} at or above PERSON_MIN_SCORE ${PERSON_MIN_SCORE})`);
console.log(`  worst overshoot outside 0..1   all slots ${worstAll.toFixed(3)}`
  + `   scored slots ${worstScored.toFixed(3)}   (tol ${MAP_TOL})`
  + (worstScored > MAP_TOL ? '  *** THE INVERSE MAP IS WRONG ***' : '  (the inverse map holds)'));
if (!rawScored) {
  console.log('  *** ZERO SCORED BOXES CHECKED -- this row is VACUOUS, not clean ***');
  process.exitCode = 2;
}
