// FINDING 48's LAST OPEN ITEM, PRICED ON BOTH SIDES AT LAST.
//
// A detection under `FACE_MIN_NATIVE_PX` 40 is never asked
// (`init-entry.js` genderFromNativeFace abstains and returns
// `{gender:'unknown', score:0}`), so `nm` -- the only signal in this
// pipeline that is about the CROP rather than the answer -- is never
// consulted, and the read fails closed into a patch. Finding 48 priced
// the BENEFIT of applying the existing floor to that class (68 of 2,127
// video patches, 3.2%) and wrote "Not built".
//
// WHAT IT DID NOT PRICE IS THE COST, and the cost is not a threshold: to
// have an `nm` you must RUN FACERES on crops the shipped code refuses to
// run it on. That is added inference per frame on his phone, which is
// the thing his other standing complaint is about. This bench answers
// how much.
//
// Population is finding 48's own: 3,809 whole frames at his player's
// 640x360, banked through the full shipped chain, so every detection is
// present with its px and its nm regardless of the shipped size gate.
//
//   node app/gaze/bench/sub40-floor-cost.mjs
import fs from 'fs';
import { FACE_MIN_NATIVE_PX, NULL_MINT_NM_FLOOR } from '../src/gender-verdict.mjs';

const BANK = 'Z:/tamescroll-corpus/bank/gpu-frames-detect.json';
const rows = JSON.parse(fs.readFileSync(BANK, 'utf8'));

let frames = 0;
let dets = 0;
let sub = 0;
let framesWithSub = 0;
let subMaxOnAFrame = 0;
const subs = [];

for (const f of rows) {
  frames++;
  const fs_ = f.faces || [];
  dets += fs_.length;
  let n = 0;
  for (const d of fs_) {
    if (typeof d.px === 'number' && d.px < FACE_MIN_NATIVE_PX) {
      sub++;
      n++;
      subs.push(d);
    }
  }
  if (n) framesWithSub++;
  if (n > subMaxOnAFrame) subMaxOnAFrame = n;
}

const pct = (x, y) => (y ? ((100 * x) / y).toFixed(1) + '%' : '--');
const pad = (v, w) => String(v).padStart(w);

console.log('SUB-' + FACE_MIN_NATIVE_PX + 'px DETECTIONS ON HIS OWN FRAMES');
console.log('frames ' + frames + '   detections ' + dets);
console.log('');
console.log('detections under the gate        ' + pad(sub, 5) + '   (' + pct(sub, dets) + ' of all detections)');
console.log('frames carrying at least one     ' + pad(framesWithSub, 5) + '   (' + pct(framesWithSub, frames) + ' of frames)');
console.log('most on any single frame         ' + pad(subMaxOnAFrame, 5));
console.log('mean extra crops per frame        ' + (sub / frames).toFixed(3));
console.log('mean extra crops per AFFECTED fr  ' + (framesWithSub ? sub / framesWithSub : 0).toFixed(3));
console.log('');

// THE BENEFIT SIDE, recomputed here rather than quoted, and split by
// whether the detection sits inside an admitted person box. A face
// inside one is ALREADY COVERED by that person's patch, so refusing it
// changes nothing on screen -- this is exactly the column finding 48's
// own cost table got wrong in the other direction (it counted 572
// corroborated faces as exposure).
for (const floor of [3, NULL_MINT_NM_FLOOR, 6]) {
  let refuse = 0;
  let covered = 0;
  for (const d of subs) {
    if (typeof d.nm === 'number' && d.nm < floor) {
      refuse++;
      if (d.inP) covered++;
    }
  }
  console.log('floor ' + String(floor).padEnd(4) + ' refuses ' + pad(refuse, 3) + ' of ' + sub +
    '   ' + pad(covered, 3) + ' already inside a person box   ' +
    pad(refuse - covered, 3) + ' face-ONLY (the risk)');
}

// A BENCH THAT REPORTS A BOUND MUST NAME THE ROWS BEHIND IT.
const risky = subs
  .filter((d) => typeof d.nm === 'number' && d.nm < NULL_MINT_NM_FLOOR && !d.inP)
  .sort((a, b) => b.nm - a.nm);
console.log('');
console.log('THE FACE-ONLY REFUSALS AT FLOOR ' + NULL_MINT_NM_FLOOR +
  ', HIGHEST nm FIRST (' + risky.length + ') -- these go sharp:');
for (const d of risky.slice(0, 12)) {
  console.log('  px ' + pad(d.px, 2) + ' conf ' + d.conf.toFixed(2) + '  ' + d.g.padEnd(6) +
    ' s' + d.s.toFixed(2) + ' raw ' + d.raw.toFixed(2) + '  nm ' + d.nm.toFixed(2));
}
if (risky.length > 12) console.log('  ... ' + (risky.length - 12) + ' more');

// AND THE SEPARABILITY QUESTION, which decides whether the floor is even
// the right instrument down here. Finding 38's ground-truth arm measured
// real faces at 32px reading nm p05 8.34 against non-faces p95 4.56 --
// but that was a FORCED read on clean crops, not his player's frames.
const nms = subs.filter((d) => typeof d.nm === 'number').map((d) => d.nm).sort((a, b) => a - b);
const q = (p) => (nms.length ? nms[Math.floor(p * (nms.length - 1))].toFixed(2) : '--');
console.log('');
console.log('nm over every sub-gate read: p05 ' + q(0.05) + '  p25 ' + q(0.25) +
  '  p50 ' + q(0.5) + '  p75 ' + q(0.75) + '  p95 ' + q(0.95));
const inP = subs.filter((d) => d.inP && typeof d.nm === 'number').map((d) => d.nm).sort((a, b) => a - b);
const outP = subs.filter((d) => !d.inP && typeof d.nm === 'number').map((d) => d.nm).sort((a, b) => a - b);
const med = (a) => (a.length ? a[Math.floor(0.5 * (a.length - 1))].toFixed(2) : '--');
console.log('nm p50 inside a person box ' + med(inP) + ' (n ' + inP.length + ')   outside one ' +
  med(outP) + ' (n ' + outP.length + ')');
console.log('');
console.log('If those two medians are close, nm is NOT separating people from');
console.log('graphics at this size and the floor is the wrong instrument here.');
