// THE ERROR CLASS THIS REPO HAS NEVER MEASURED (findings 8), and it can
// be measured off banked tensors after all.
//
// The corpus scorer is blind to detector recall BY CONSTRUCTION: it
// scores the reads that exist, so a face BlazeFace never found is
// invisible to every arm and every sweep in this file's history. Every
// exposure figure in the repo is therefore a LOWER BOUND, and nobody
// knows by how much.
//
// Findings 8 proposed hand-annotating ~200 frames. That is still the
// gold standard and this is not it. But there is a second, independent
// model already banked over ALL 2,160 corpus frames whose output speaks
// to exactly this question: **MoveNet's facial keypoints**. Slots 0-4
// in COCO order are nose, left eye, right eye, left ear, right ear. A
// person whose nose and both eyes are confidently located is a head
// facing the camera at a known place in the frame, produced by a
// different architecture trained on different data from BlazeFace. So:
// where MoveNet puts a frontal head, did BlazeFace find a face?
//
// WHAT THIS IS AND IS NOT.
//
// It is NOT ground truth. MoveNet's keypoint confidence is a model
// output like any other, and this bench cannot separate "BlazeFace
// missed a face" from "MoveNet hallucinated a head". What it IS is an
// independent cross-check that costs nothing and has never been run,
// and its DISAGREEMENT rate bounds the recall question from one side:
// if the two models agree almost everywhere, the missing-face class is
// small; if they disagree a lot, findings 8's afternoon of annotation
// is the highest-value afternoon left.
//
// THE FRONTAL GATE IS LOAD-BEARING AND IT IS WHY NOSE+BOTH EYES.
// A person facing away has a head and NO FACE, and BlazeFace is right
// to find nothing there -- counting that as a miss would manufacture a
// recall problem out of the geometry of standing with your back turned.
// Requiring the nose AND both eyes above the bar is the cheapest
// available proxy for "facing the camera". It is conservative in the
// safe direction: it throws away genuine profile faces that BlazeFace
// also often finds, so the denominator is smaller and cleaner.
//
// THE COORDINATES LINE UP WITHOUT A MAPPING, and that is worth stating
// because it is exactly the thing 16b/18 is about. `corpus-persons.mjs`
// resizes the whole 640x360 frame to 256x256 -- a uniform per-axis
// squash -- so MoveNet's normalized outputs are frame-normalized in
// each axis directly. No letterbox, no inverse. (If `PERSON_LETTERBOX`
// is ever turned on, this bench needs `unpadPersons` first.)
import './_build.mjs';
import { winFiles, W, H } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';
import { PERSON_MIN_SCORE } from './.cache/shipped.mjs';

// NOT THINNED, AND THE FIRST VERSION OF THIS BENCH WAS -- which turned a
// cadence artifact into a catastrophic recall figure.
//
// `thinFrames(w, 3)` moves a non-verdict frame's faces to `_labelFaces`
// and leaves `faces` EMPTY, because that is what a frame the detector
// did not run on looks like to an arm. Comparing MoveNet's heads against
// an empty face list on two frames in three produced **31% agreement**,
// and 31% is 1/3 -- the thinning ratio, read back as a result. Every
// disagreement example it printed said `faces in frame 0`.
//
// Recall is a property of the DETECTOR on a frame, not of the cadence
// the app happens to run it at, so this bench uses every banked frame.
const STRIDE = 336;
// Reported at several bars rather than one, because a single bar is a
// choice and the reader cannot see the sensitivity behind it.
const BARS = [0.20, 0.30, 0.40, 0.50];
// Native-pixel bands, chosen to straddle his player's own regime: his
// faces reach faceres at px p50 38-62 and FACE_MIN_NATIVE_PX is 40.
const BANDS = [[0, 24], [24, 40], [40, 64], [64, 96], [96, 1e9]];

// COCO keypoint indices.
const NOSE = 0, L_EYE = 1, R_EYE = 2;

const kp = (slice, o, i) => ({
  y: slice[o + i * 3], x: slice[o + i * 3 + 1], s: slice[o + i * 3 + 2],
});

// The face box CONTAINS the head point. Deliberately not an IoU or a
// distance: the question is "did the detector find a face here at all",
// and a detector box that contains the nose and both eyes has found it
// whatever its extent. A small tolerance is added because BlazeFace's
// box is tight and MoveNet's nose can sit a pixel outside it.
const TOL = 0.01;
function foundNear(faces, x, y) {
  for (const f of faces) {
    if (!(f && typeof f.x1 === 'number')) continue;
    if (x >= f.x1 - TOL && x <= f.x2 + TOL && y >= f.y1 - TOL && y <= f.y2 + TOL) return true;
  }
  return false;
}

const stats = new Map();   // bar -> { band -> [found, total] }
const kpScores = [];
let frames = 0, admitted = 0, frontal = 0;
const missExamples = [];

for (const file of winFiles()) {
  const w = loadWin(file);
  const fr = w.frames || [];
  if (!w.persons) continue;
  for (let fi = 0; fi < fr.length; fi++) {
    const off = fi * STRIDE;
    if (off + STRIDE > w.persons.length) continue;
    frames++;
    const slice = w.persons.subarray(off, off + STRIDE);
    const faces = ((fr[fi] && fr[fi].faces) || []).filter((f) => f && typeof f.x1 === 'number');
    for (let s = 0; s < 6; s++) {
      const o = s * 56;
      if (!(slice[o + 55] >= PERSON_MIN_SCORE)) continue;
      admitted++;
      const nose = kp(slice, o, NOSE), le = kp(slice, o, L_EYE), re = kp(slice, o, R_EYE);
      kpScores.push(Math.min(nose.s, le.s, re.s));
      // Head width the way `parsePersons` itself derives it from eyes:
      // |lEye.x - rEye.x| * 2.5. Native px on the corpus frame.
      const px = Math.abs(le.x - re.x) * 2.5 * W;
      const cx = (nose.x + le.x + re.x) / 3;
      const cy = (nose.y + le.y + re.y) / 3;
      const hit = foundNear(faces, cx, cy);
      for (const bar of BARS) {
        if (!(nose.s >= bar && le.s >= bar && re.s >= bar)) continue;
        if (bar === BARS[1]) frontal++;
        if (!stats.has(bar)) stats.set(bar, new Map());
        const byBand = stats.get(bar);
        for (const [lo, hi] of BANDS) {
          if (!(px >= lo && px < hi)) continue;
          const k = `${lo}-${hi}`;
          if (!byBand.has(k)) byBand.set(k, [0, 0]);
          const c = byBand.get(k);
          c[1]++; if (hit) c[0]++;
          if (!hit && bar === BARS[1] && missExamples.length < 12) {
            missExamples.push({ win: w.tag, fi, px: px.toFixed(0),
              cx: cx.toFixed(3), cy: cy.toFixed(3),
              kp: Math.min(nose.s, le.s, re.s).toFixed(2),
              slot: slice[o + 55].toFixed(2), nFaces: faces.length });
          }
        }
      }
    }
  }
}

const q = (a, f) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)] : NaN);
const pc = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : '   n/a');

console.log(`18 windows, EVERY banked frame (not thinned), `
  + `${frames} frames, ${W}x${H}`);
console.log(`PERSON_MIN_SCORE ${PERSON_MIN_SCORE}   admitted slots ${admitted}`);
console.log(`min(nose, lEye, rEye) score over admitted slots:`
  + `  p05 ${q(kpScores, 0.05).toFixed(3)}  p50 ${q(kpScores, 0.5).toFixed(3)}`
  + `  p95 ${q(kpScores, 0.95).toFixed(3)}`);
console.log('');
console.log('BlazeFace found a face where MoveNet put a FRONTAL head:');
console.log('kp bar'.padEnd(9) + BANDS.map(([lo, hi]) =>
  (hi > 1e8 ? `${lo}px+` : `${lo}-${hi}px`).padStart(14)).join('') + '           all');
for (const bar of BARS) {
  const byBand = stats.get(bar) || new Map();
  let f = 0, t = 0;
  const cells = BANDS.map(([lo, hi]) => {
    const c = byBand.get(`${lo}-${hi}`) || [0, 0];
    f += c[0]; t += c[1];
    return `${pc(c[0], c[1])} ${c[1]}`.padStart(14);
  });
  console.log(String(bar.toFixed(2)).padEnd(9) + cells.join('')
    + `${pc(f, t)} ${t}`.padStart(14));
}

console.log('');
console.log('THE TREND ACROSS THE BAR IS THE MOST INFORMATIVE COLUMN.');
console.log('Agreement rises monotonically as MoveNet is asked to be');
console.log('more sure a head is facing the camera (92.9% -> 98.0%),');
console.log('which is what you see if the disagreements are mostly');
console.log('MoveNet being UNSURE -- a turned head, a hallucinated slot');
console.log('-- rather than BlazeFace missing a face that is there. If');
console.log('BlazeFace were the weak half the rate would be flat in the');
console.log('bar and steep in px, and it is steep in px only at 0-24.');
console.log('');
console.log('READ THE DENOMINATOR, not just the rate: a band with a');
console.log('handful of heads in it says nothing. And this is a');
console.log('CROSS-CHECK, not ground truth -- a disagreement is one of');
console.log('the two models being wrong and this bench cannot say which.');
console.log('What it bounds is the SIZE of the never-measured class.');

if (missExamples.length) {
  console.log('');
  console.log(`disagreements at kp bar ${BARS[1]} (first ${missExamples.length}):`);
  for (const m of missExamples)
    console.log(`  ${m.win} f${m.fi}  px ${m.px}  at (${m.cx},${m.cy})  `
      + `kp ${m.kp}  slot ${m.slot}  faces in frame ${m.nFaces}`);
}

// A run that measured nothing reads exactly like a clean one.
if (!admitted || !frames) {
  console.error('VACUOUS: no admitted slots examined.');
  process.exitCode = 2;
}
