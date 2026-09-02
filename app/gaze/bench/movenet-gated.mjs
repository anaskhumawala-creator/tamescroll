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
import { parsePersons, unpadPersons } from '../src/person-gate.mjs';
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
  if (arm === 'letterbox') data = unpadPersons(data, FIT, S);
  // `held` null: this is a per-frame comparison and hysteresis would
  // carry one arm's history into the other's frame.
  return parsePersons(data, undefined, AR, null);
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
let frames = 0, onlyLB = 0, onlySQ = 0, moreLB = 0, moreSQ = 0, outOfRange = 0;
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
  // failure that is worse than the defect.
  for (const q of lb) {
    if (!(q.x1 >= -1e-6 && q.y1 >= -1e-6 && q.x2 <= 1 + 1e-6 && q.y2 <= 1 + 1e-6)) outOfRange++;
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
console.log(`  letterbox boxes outside 0..1: ${outOfRange}`
  + (outOfRange ? '   *** THE INVERSE MAP IS WRONG ***' : '   (the inverse map holds)'));
