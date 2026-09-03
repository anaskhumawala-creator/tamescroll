// PRICING THE ONE ERROR CLASS THIS PRODUCT HAS NEVER MEASURED, IN SECONDS.
//
// `corpus-score.mjs` says so in its own header: "labels cover faces the
// DETECTOR FOUND. A person BlazeFace never detected is invisible here."
// So its EXPOSURE of 7.5s (man mode) is a LOWER BOUND by construction,
// and every model-vs-pipeline argument this repo has had was conducted
// on the set where a detection already happened.
//
// `bench/detector-recall.mjs` found the missing set: 119 of 2,131
// person-instances (5.6%) seen by NEITHER model, running p50 0.38 of
// frame height, a third of them women, worst run 14 frames. What it
// could NOT say is what that costs, because it counts INSTANCES and the
// unit the owner experiences is SECONDS.
//
// This bench converts one into the other, and it exists to CLOSE a
// question rather than open one (`track-accuracy.md` s6.2):
//
//   X < 20s  -> the model question is closed. Every remaining accuracy
//               day belongs to the decision layer and the clock.
//   X > 60s  -> a detector project is justified on measurement for the
//               first time in this project's history.
//
// WHAT IS CHARGED, AND WHAT DELIBERATELY IS NOT. Only an ssd person with
// NO face evidence and NO pose evidence is charged here. A person either
// of our models DID see is already scored by corpus-score, and charging
// her twice would produce a total that is not comparable with any number
// this repo has published.
//
// THREE HONEST LIMITS, stated up front because a recall number is easy
// to overstate and this one decides a programme:
//
//   1. coco-ssd HAS ITS OWN MISSES, so this is an upper bound on how
//      many people we find and a LOWER bound on the seconds we miss. It
//      cannot be run the other way round to clear us.
//   2. ATTRIBUTION IS WEAK. A missed person has no face crop, so she has
//      no label. The nearest labelled face in the window says who tends
//      to stand there. Three arms are reported and the answer is a
//      RANGE, not a point: LABELLED (only misses attributed to a
//      cover-worthy label), PRIOR (unattributed misses charged at the
//      corpus's own woman:man ratio) and ALL (every miss cover-worthy,
//      the ceiling).
//   3. COVERED IS NOT THE SAME QUESTION AS FOUND. A missed person can
//      still be under a patch minted for somebody else, and that is not
//      exposure -- it is the solid-patch rule doing its job. Both a BOX
//      arm and a stricter HEAD-BAND arm are reported, because a patch
//      over her legs is not cover.
//
// Usage: node bench/recall-seconds.mjs [gender]
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import './_build.mjs';
import { replay, overlapFrac } from './corpus-score.mjs';
import { parsePersons } from './.cache/shipped.mjs';

const GENDER = process.argv[2] || process.env.GENDER || 'man';
// Same gates as detector-recall.mjs, so the instance count reconciles
// with the 119 that bench already publishes. Changing either here
// without changing it there produces two numbers that look like a
// disagreement and are a configuration difference.
const SSD_MIN = Number(process.env.SSD_MIN || 0.5);
const MIN_H = Number(process.env.MIN_H || 0.15);
const HEAD_BAND = Number(process.env.HEAD_BAND || 1.0);
// corpus-score's own threshold, reused rather than re-picked so the two
// benches agree about what "covered" means.
const COVER = 0.15;
// A patch over her legs is not cover. The head band is the top third of
// the person box -- MoveNet's own box is drawn round the keypoints, so
// a third is generous to us, which is the safe direction for an
// exposure number.
const HEAD_FRAC = Number(process.env.HEAD_FRAC || 0.33);

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const iou = (a, b) => {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (w <= 0 || h <= 0) return 0;
  const i = w * h;
  return i / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - i);
};
const centreIn = (inner, outer) => {
  const cx = (inner.x1 + inner.x2) / 2, cy = (inner.y1 + inner.y2) / 2;
  return cx >= outer.x1 && cx <= outer.x2 && cy >= outer.y1 && cy <= outer.y2;
};
const headOf = (face, person) => {
  if (!centreIn(face, person)) return false;
  const cy = (face.y1 + face.y2) / 2;
  return cy <= person.y1 + HEAD_BAND * (person.y2 - person.y1);
};
const headBand = (p) => ({
  x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y1 + HEAD_FRAC * (p.y2 - p.y1),
});
const bestCover = (target, patches) => {
  let b = 0;
  for (const q of patches) { const o = overlapFrac(target, q); if (o > b) b = o; }
  return b;
};
const shouldCover = (lab) => GENDER === 'man' ? (lab === 'woman' || lab === 'child')
                                              : (lab === 'man' || lab === 'child');

// ---- pass 1: walk every window, classify every ssd person-instance ----
let instances = 0, seenByFace = 0, seenByPose = 0;
// One record per MISSED instance: its attribution, whether a patch
// covered it, and how long a frame lasts in that window.
const misses = [];
let dtSum = 0, dtN = 0;

for (const file of winFiles()) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  const stem = file.replace(/\.json$/, '');
  let ssd = null;
  try { ssd = JSON.parse(fs.readFileSync(`${ROOT}/bank/ssd/${file}`, 'utf8')); } catch (e) {}
  if (!ssd) continue;
  // The tracker's identity memory needs the descriptors or the replay
  // reports a decision layer worse than the one that ships.
  const dp = `${ROOT}/bank/reads/${stem}.desc`;
  if (fs.existsSync(dp)) win.desc = new Float32Array(fs.readFileSync(dp).buffer.slice(0));
  let poseBuf = null;
  try {
    const b = fs.readFileSync(`${ROOT}/bank/persons/${stem}.f32`);
    poseBuf = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  } catch (e) {}

  // THE PATCHES COME FROM THE SHIPPED DECISION LAYER, replayed by the
  // same function corpus-score uses. Re-deriving them here would be the
  // re-implemented-shipped-rule failure this repo has committed three
  // times (phase-g G1/G5/G9).
  const frames = replay(win, GENDER);
  const dtS = frames.length > 1 ? (frames[1].t - frames[0].t) : 0.5;
  dtSum += dtS; dtN++;

  const byTime = new Map(ssd.map((r) => [Math.round(r.t * 1000), r.p || []]));

  for (let fi = 0; fi < frames.length; fi++) {
    const fr = frames[fi];
    const people = (byTime.get(Math.round(fr.t * 1000)) || [])
      .filter((p) => p.s >= SSD_MIN && (p.y2 - p.y1) >= MIN_H);
    if (!people.length) continue;

    const faces = fr.faces || [];
    let poses = [];
    if (poseBuf) {
      const off = fi * 336;
      if (off + 336 <= poseBuf.length) {
        try { poses = parsePersons(poseBuf.subarray(off, off + 336)) || []; } catch (e) { poses = []; }
      }
    }

    for (const p of people) {
      instances++;
      const face = faces.find((f) => headOf(f, p));
      if (face) { seenByFace++; continue; }
      const pose = poses.find((q) => iou(q, p) >= 0.2);
      if (pose) { seenByPose++; continue; }

      // MISSED BY BOTH. Who is she? Weak attribution, reported as such.
      let who = null;
      for (const g of win.frames) {
        const hit = (g.faces || []).find((f) => f.crop && cropLabel.has(f.crop) && centreIn(f, p));
        if (hit) { who = cropLabel.get(hit.crop); break; }
      }
      misses.push({
        who,
        dtS,
        coveredBox: bestCover(p, fr.patches) >= COVER,
        coveredHead: bestCover(headBand(p), fr.patches) >= COVER,
        h: p.y2 - p.y1,
        win: stem,
      });
    }
  }
}

// ---- pass 2: price it, three attribution arms x two coverage arms ----
const pct = (n, d) => `${(100 * n / (d || 1)).toFixed(1)}%`;

// The corpus's own cover-worthy share among LABELLED misses is the only
// non-arbitrary prior available for the unattributed ones.
const labelled = misses.filter((m) => m.who && m.who !== 'mixed');
const labelledCover = labelled.filter((m) => shouldCover(m.who)).length;
const prior = labelled.length ? labelledCover / labelled.length : 0;

function priceArm(coverKey, weightOf) {
  let exposureS = 0, coveredS = 0;
  for (const m of misses) {
    const w = weightOf(m);
    if (w <= 0) continue;
    if (m[coverKey]) coveredS += w * m.dtS; else exposureS += w * m.dtS;
  }
  return { exposureS, coveredS };
}
const armLabelled = (m) => (m.who && m.who !== 'mixed' && shouldCover(m.who)) ? 1 : 0;
const armPrior = (m) => (m.who && m.who !== 'mixed') ? (shouldCover(m.who) ? 1 : 0) : prior;
const armAll = () => 1;

console.log(`RECALL PRICED IN SECONDS -- gender=${GENDER}`);
console.log(`(ssd s>=${SSD_MIN}, height>=${MIN_H}, head band ${HEAD_BAND}, cover ${COVER}, head frac ${HEAD_FRAC})\n`);
console.log(`person-instances       ${instances}`);
console.log(`  seen by a FACE       ${String(seenByFace).padStart(6)}  ${pct(seenByFace, instances)}`);
console.log(`  seen by a POSE only  ${String(seenByPose).padStart(6)}  ${pct(seenByPose, instances)}`);
console.log(`  MISSED ENTIRELY      ${String(misses.length).padStart(6)}  ${pct(misses.length, instances)}`);

if (!misses.length) {
  console.log('\nNo misses at these gates. Nothing to price.');
  process.exit(0);
}

const byWho = {};
for (const m of misses) { const k = m.who || '(unattributed)'; byWho[k] = (byWho[k] || 0) + 1; }
console.log('\nattribution of the misses (weak -- nearest labelled face in the window):');
for (const [k, v] of Object.entries(byWho).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(16)} ${String(v).padStart(5)}  ${pct(v, misses.length)}`);
console.log(`  cover-worthy share among LABELLED misses: ${(100 * prior).toFixed(1)}%`
  + `  (${labelledCover} of ${labelled.length})`);

// HOW OFTEN IS A MISSED PERSON UNDER SOMEBODY ELSE'S PATCH? This is the
// number that decides whether the class costs anything at all, and it is
// the half a detector-instance count cannot see.
const coveredBox = misses.filter((m) => m.coveredBox).length;
const coveredHead = misses.filter((m) => m.coveredHead).length;
console.log(`\nmissed AND already under a patch (someone else's):`);
console.log(`  by BOX overlap       ${String(coveredBox).padStart(6)}  ${pct(coveredBox, misses.length)}`);
console.log(`  by HEAD band         ${String(coveredHead).padStart(6)}  ${pct(coveredHead, misses.length)}`);

console.log('\n--- THE PRICE, in seconds of EXPOSURE this scorer has never charged ---');
const rows = [
  ['LABELLED only  (floor)', armLabelled],
  ['PRIOR-weighted (best) ', armPrior],
  ['ALL misses     (ceiling)', armAll],
];
for (const [name, w] of rows) {
  const b = priceArm('coveredBox', w);
  const h = priceArm('coveredHead', w);
  console.log(`  ${name}   BOX arm ${b.exposureS.toFixed(1)}s`
    + `   HEAD arm ${h.exposureS.toFixed(1)}s`);
}

const best = priceArm('coveredBox', armPrior).exposureS;
const bestHead = priceArm('coveredHead', armPrior).exposureS;
console.log(`\nSCORED EXPOSURE TODAY (corpus-score, ${GENDER} mode): 7.5s man / 7.0s woman`);
console.log(`ADDING THIS CLASS:  +${best.toFixed(1)}s (BOX)  ..  +${bestHead.toFixed(1)}s (HEAD)`);
console.log('\nTHE GATE (track-accuracy s6.2):');
console.log('  under  20s -> the model question is CLOSED; the clock and the');
console.log('                decision layer own every remaining accuracy day.');
console.log('  over   60s -> a detector project is justified on measurement.');
console.log('\nUPPER BOUND ON US, LOWER BOUND ON THE MISS: coco-ssd has its own');
console.log('misses, and a person neither detector finds is in neither column.');
