// THE ERROR CLASS NOBODY HAS EVER MEASURED: PEOPLE WE NEVER SAW.
//
// Every sweep in this repo prices a DECISION -- which gender, which
// threshold, which rung. All of them are downstream of a detection. If
// BlazeFace and MoveNet both come back empty on a frame that contains a
// person, no constant anywhere can cover her, and she is invisible to
// every arm we own: the corpus banks READS, so a frame with no read
// contributes nothing to it and quietly reads as a frame with nobody in
// it.
//
// E5 put a number next to the question: 76 of 310 births (24.5%) are
// GENUINELY FRESH -- no overlapping track at all, so either the person
// just walked into shot or we were late to her. Nothing here can tell
// those apart, and the difference is exactly the exposure this whole
// system exists to remove.
//
// THE INSTRUMENT: coco-ssd, banked per frame at the same frame times
// (bench/cocossd-bank.mjs). It is a genuinely independent detector --
// different architecture, different training set, whole-person boxes,
// and crucially NOT face-based and NOT luma-based, so it does not share
// a blind spot with either of ours. That matters: 10j is the record of
// what happens when ground truth turns out to share the blind spot it
// was brought in to measure.
//
// HONEST LIMITS, up front, because a recall number is easy to overstate:
//
//   - coco-ssd HAS ITS OWN MISSES. Every number here is our recall
//     against ITS recall, so it is an UPPER BOUND on how many people we
//     find and a LOWER BOUND on how many we miss. It cannot be run the
//     other way round to clear us.
//   - A person coco-ssd sees is not automatically a person we must
//     cover: gender decides that, and a MISS here is only an exposure
//     if she is the opposite gender. So misses are reported BOTH raw
//     and restricted to LABELLED clusters, where the label says who she
//     actually is.
//   - Our two detectors answer different questions. A face box is a
//     head; a MoveNet slot is a body. Overlap is tested accordingly.
//
// Usage: node bench/detector-recall.mjs [gender]
import fs from 'fs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import './_build.mjs';
import { parsePersons, lastSlotDiag, PERSON_MIN_SCORE } from './.cache/shipped.mjs';

const SSD_MIN = Number(process.env.SSD_MIN || 0.5);
// Below this a "person" is a few dozen pixels of background crowd. His
// complaint has never been about those, and coco-ssd's own precision
// falls off there, so counting them would inflate the miss rate with
// cases neither instrument is reliable about.
const MIN_H = Number(process.env.MIN_H || 0.15);   // fraction of frame height

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
// A HEAD IS AT THE TOP OF ITS OWN BODY, and this instrument's recall
// number is only as good as that test. In a two-shot, person A's face
// centre can fall inside person B's box, so bare containment credits us
// with seeing B when we only ever saw A -- inflating recall in the
// flattering direction. HEAD_BAND is a SENSITIVITY KNOB, not a claim:
// run at 1.0 (bare containment) and at 0.35 and compare. If recall moves
// a lot, the headline number is an artifact of the test rather than a
// property of the detector.
const HEAD_BAND = Number(process.env.HEAD_BAND || 1.0);
const headOf = (face, person) => {
  if (!centreIn(face, person)) return false;
  const cy = (face.y1 + face.y2) / 2;
  return cy <= person.y1 + HEAD_BAND * (person.y2 - person.y1);
};

let ssdPeople = 0, seenByFace = 0, seenByPose = 0, missed = 0;
let framesNoSsd = 0, framesWithSsd = 0;
const missHeights = [];
// FOR EVERY MISS: did MoveNet NEARLY see her? A rejected slot sitting on
// the missed person turns 'the detector is blind here' into 'a threshold
// refused her', which is a dial. A miss with no slot at all is the
// harder problem and needs a different model, not a different number.
const nearMissScores = [];
let missNoSlotAtAll = 0;
const missLabelled = { woman: 0, man: 0, child: 0, mixed: 0, other: 0 };
// LATENCY: for each contiguous appearance of a person, how many 0.5s
// frames pass before we produce ANY evidence for them. A miss that lasts
// one frame is a detector blink; one that lasts ten is a person on
// screen for five seconds with nothing over her.
const runs = [];

for (const file of winFiles()) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  const stem = file.replace(/\.json$/, '');
  let ssd = null;
  try { ssd = JSON.parse(fs.readFileSync(`${ROOT}/bank/ssd/${file}`, 'utf8')); } catch (e) {}
  if (!ssd) continue;
  let poseBuf = null;
  try {
    const b = fs.readFileSync(`${ROOT}/bank/persons/${stem}.f32`);
    poseBuf = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  } catch (e) {}

  const byTime = new Map(ssd.map((r) => [Math.round(r.t * 1000), r.p || []]));
  // open[] tracks an in-progress miss run per ssd box, keyed by rough position
  let open = [];

  for (let fi = 0; fi < win.frames.length; fi++) {
    const fr = win.frames[fi];
    const people = (byTime.get(Math.round(fr.t * 1000)) || [])
      .filter((p) => p.s >= SSD_MIN && (p.y2 - p.y1) >= MIN_H);
    if (!people.length) { framesNoSsd++; open = []; continue; }
    framesWithSsd++;

    const faces = fr.faces || [];
    let poses = [];
    let slotDiag = [];
    if (poseBuf) {
      const off = fi * 336;
      if (off + 336 <= poseBuf.length) {
        try {
          poses = parsePersons(poseBuf.subarray(off, off + 336)) || [];
          // lastSlotDiag is filled BY parsePersons, so it must be copied
          // immediately -- the next frame's call clears it.
          slotDiag = lastSlotDiag.slice();
        } catch (e) { poses = []; slotDiag = []; }
      }
    }

    const nextOpen = [];
    for (const p of people) {
      ssdPeople++;
      // A FACE counts if its centre is inside the person box -- a head is
      // inside its own body, and IoU between a head box and a body box is
      // tiny by construction, so IoU here would report a miss on every
      // person we are looking straight at.
      const face = faces.find((f) => headOf(f, p));
      const pose = poses.find((q) => iou(q, p) >= 0.2);
      if (face) seenByFace++;
      else if (pose) seenByPose++;
      else {
        missed++;
        missHeights.push(p.y2 - p.y1);
        // The REJECTED slots for this frame, from the shipped diagnostic
        // the gate itself fills in -- not a bench re-derivation of the
        // coordinate layout.
        let best = -1;
        for (const d of slotDiag) {
          if (!d || d.adm || !d.bb) continue;
          const b = { x1: d.bb[0], y1: d.bb[1], x2: d.bb[2], y2: d.bb[3] };
          if (!(b.x2 > b.x1) || !(b.y2 > b.y1)) continue;
          if (iou(b, p) >= 0.2 && d.score > best) best = d.score;
        }
        if (best >= 0) nearMissScores.push(best); else missNoSlotAtAll++;
        // Was anybody LABELLED at this spot in this window? The nearest
        // labelled face in any frame of this window tells us who tends to
        // stand here; it is weak attribution and is reported as such.
        let who = 'other';
        for (const g of win.frames) {
          const hit = (g.faces || []).find((f) => f.crop && cropLabel.has(f.crop) && centreIn(f, p));
          if (hit) { who = cropLabel.get(hit.crop); break; }
        }
        missLabelled[who] = (missLabelled[who] || 0) + 1;
      }
      const prev = open.find((o) => iou(o.box, p) >= 0.3);
      if (face || pose) { if (prev) runs.push(prev.n); continue; }
      nextOpen.push({ box: p, n: (prev ? prev.n : 0) + 1 });
    }
    for (const o of open) if (!nextOpen.some((n) => iou(n.box, o.box) >= 0.3)) runs.push(o.n);
    open = nextOpen;
  }
  for (const o of open) runs.push(o.n);
}

const pct = (n, d) => `${(100 * n / (d || 1)).toFixed(1)}%`;
const q = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))] : NaN);

console.log(`coco-ssd persons at s>=${SSD_MIN}, height>=${MIN_H} of frame`);
console.log(`  frames with a person   ${framesWithSsd}`);
console.log(`  frames with nobody     ${framesNoSsd}`);
console.log(`\nperson-instances       ${ssdPeople}`);
console.log(`  seen by a FACE       ${String(seenByFace).padStart(6)}  ${pct(seenByFace, ssdPeople)}`);
console.log(`  seen by a POSE only  ${String(seenByPose).padStart(6)}  ${pct(seenByPose, ssdPeople)}`);
console.log(`  MISSED ENTIRELY      ${String(missed).padStart(6)}  ${pct(missed, ssdPeople)}`);
if (missed) {
  console.log(`\n  missed person height  p05 ${q(missHeights, 0.05).toFixed(2)}`
    + `  p50 ${q(missHeights, 0.5).toFixed(2)}  p95 ${q(missHeights, 0.95).toFixed(2)} of frame`);
  console.log('  who stands there (weak attribution, nearest labelled face in window):');
  for (const [k, v] of Object.entries(missLabelled).sort((a, b) => b[1] - a[1]))
    if (v) console.log(`    ${k.padEnd(10)} ${String(v).padStart(5)}  ${pct(v, missed)}`);
}
if (missed) {
  console.log(`
DID MoveNet NEARLY SEE HER? (PERSON_MIN_SCORE ${PERSON_MIN_SCORE})`);
  console.log(`  a REJECTED slot sat on her   ${nearMissScores.length}  ${pct(nearMissScores.length, missed)}`);
  console.log(`  no slot there at all         ${missNoSlotAtAll}  ${pct(missNoSlotAtAll, missed)}`);
  if (nearMissScores.length) {
    console.log(`  their scores  p05 ${q(nearMissScores, 0.05).toFixed(3)}`
      + `  p50 ${q(nearMissScores, 0.5).toFixed(3)}  p95 ${q(nearMissScores, 0.95).toFixed(3)}`);
    for (const t of [0.30, 0.25, 0.20, 0.15, 0.10]) {
      const n = nearMissScores.filter((v) => v >= t).length;
      console.log(`    PERSON_MIN_SCORE ${t.toFixed(2)} would have admitted `
        + `${String(n).padStart(4)} of ${missed} misses  ${pct(n, missed)}`);
    }
    console.log('  THIS IS NOT A RECOMMENDATION. Lowering that floor admits');
    console.log('  noise slots too, and the corpus prices that as PHANTOM --');
    console.log('  run the arm that measures both sides before moving it.');
  }
}
if (runs.length) {
  const long = runs.filter((n) => n >= 3).length;
  console.log(`\nCONSECUTIVE-MISS RUNS  ${runs.length}`
    + `   p50 ${q(runs, 0.5)}  p95 ${q(runs, 0.95)}  max ${Math.max(...runs)} frames`);
  console.log(`  runs of 3+ frames (>=1.5s unseen)  ${long}  ${pct(long, runs.length)}`);
  console.log('  A one-frame run is a detector blink and the tracker coasts through it.');
  console.log('  A long run is a person on screen with nothing over her.');
}
console.log('\nUPPER BOUND ON US, LOWER BOUND ON THE MISS: coco-ssd has its own'
  + '\nmisses, and a person neither detector finds is in neither column.');
