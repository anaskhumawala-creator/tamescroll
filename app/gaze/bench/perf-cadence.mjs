// DOES THE PER-SUBJECT ARM BUY BACK INFERENCE?
//
// The expensive thing in the video path is faceres: ~1.25s per face on
// his phone, one forward pass per face per verdict, and it is what sets
// the verdict cadence (his measured p50 was 795ms of which 785 is the
// worker reply). A per-frame verdict NEEDS a read every pass, because
// the decision is thrown away and remade each time. A pooled per-subject
// decision does not: once a subject has voted enough times the extra
// reads change nothing.
//
// So the perf question is not "is A5 faster per read" -- it is identical
// per read -- but "how many reads can A5 SKIP before its score falls
// back to A0's". That is a real lever on the one cost that matters, and
// it is measurable offline with no device.
//
// SKIP MEANS SKIP, NOT DOWNSAMPLE. A skipped frame still runs the
// tracker on positionOnly-style observations, exactly as a position
// pass does in the app -- boxes move, no gender is read, no verdict is
// remade. Skipping the frame entirely would delete the coast and flatter
// the result.
import fs from 'fs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, ARM_A0, armSubject } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);

/** Every Nth frame keeps its gender reads; the rest keep only their boxes. */
function thin(win, every) {
  if (every <= 1) return win;
  return { ...win, frames: win.frames.map((fr, i) => (i % every === 0 ? fr
    : { ...fr, faces: fr.faces.map((f) => ({ ...f, _noRead: true })) })) };
}

/**
 * Wrap an arm so a `_noRead` face contributes NO vote and NO verdict --
 * it only moves the track. That is what a position pass is.
 */
function thinned(arm, every) {
  return (win, gg) => arm(thin(win, every), gg);
}

const ARMS = [
  ['A0 shipped', ARM_A0],
  ['A5 per-subject', armSubject({ poolBar: 0.40 })],
];

console.log(`gender=${g}   read-rate thinning (reads = 1 frame in N)\n`);
console.log('arm             N   readsPerMin  EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, arm] of ARMS) {
  for (const every of [1, 2, 3, 4, 6]) {
    const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
    let reads = 0, durS = 0;
    for (const win of wins) {
      const frames = thinned(arm, every)(win, g);
      const s = score(frames, g, (c) => cropLabel.get(c));
      for (const k of Object.keys(agg)) agg[k] += s[k];
      durS += win.frames.length / win.fps;
      win.frames.forEach((fr, i) => { if (i % every === 0) reads += fr.faces.length; });
    }
    console.log(name.padEnd(15) + String(every).padStart(2) +
      (durS > 0 ? (reads / (durS / 60)).toFixed(0) : '0').padStart(13) +
      (agg.exposureS.toFixed(1) + 's').padStart(10) +
      (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
      (agg.phantomS.toFixed(1) + 's').padStart(10));
  }
  console.log('');
}
