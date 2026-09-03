// DOES STRAIGHTENING THE CROP MAKE THE GENDER READ BETTER?
//
// Three arms on the SAME decoded frames, the SAME detections and the
// SAME model. Only the rectangle handed to faceres changes.
//
//   1 SHIPPED   squareBox -- grow the detector box to a square about its
//               own centre. What runs on his phone today.
//   2 EYE-RECT  a square centred on the EYE MIDPOINT, sized so eye
//               separation is a fixed fraction of it. Still one
//               rectangle, so `cropAndResize` takes it at exactly the
//               price the shipped path already pays: ZERO extra GPU ops,
//               zero extra memory, zero extra fence waits.
//   3 ALIGNED   full similarity transform -- eye-rect PLUS rotation, so
//               a tilted head comes out upright. Needs
//               `tf.image.transform`, which transforms one image per
//               transform, so N faces is N ops and N fence waits against
//               the shipped path's one. NOT FREE, and it has to beat arm
//               2 by enough to be worth that on a Helio G85.
//
// The performance split is the point of running arm 2 at all. If most of
// the gain is centring and scaling, we ship the free arm and never pay
// for rotation.
//
// WHY THE FRAMES AND NOT THE BANKED CROPS: the bank's 112x112 crops were
// ALREADY CUT BY squareBox. Re-cropping a crop measures arm 1 against
// arm 1. So the frames are re-decoded from the ten source videos with
// the same ffmpeg call `corpus-bank.mjs` used to build the bank.
//
// TRUTH IS THE HUMAN LABEL. 107 hand-labelled clusters; a read is wrong
// when the gender head disagrees with the person who looked at it.
//
// EVERY ARM GOES THROUGH THE SHIPPED `classifyFaceGenders`, including
// arm 3 -- which hands it an already-aligned square image and a
// full-frame box, so `squareBox` is the identity there. This repo has
// published the wrong number three times by re-implementing a shipped
// rule inside an instrument (phase-g G1/G5/G9); no arm here owns a copy
// of the reader.
//
// HELD OUT BY VIDEO. If a target geometry is swept, it is refit per
// fold -- reads inside one video share a subject, a camera and a
// lighting setup, so a read-level split leaks (engine-findings 29).
import './_build.mjs';
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders, squareBox } from './.cache/shipped.mjs';
import { eyeRect, alignTransform, setAlignTarget } from '../src/face-align.mjs';
import { fsHandler, grabRaw, ROOT, BANK, W, H } from './corpus-lib.mjs';

const GENDER_INPUT = 224;
const LIMIT = Number(process.env.AB_LIMIT || 0);
const FULL_BOX = { x1: 0, y1: 0, x2: 1, y2: 1 };

if (process.env.EYE_Y || process.env.EYE_DX) {
  setAlignTarget(Number(process.env.EYE_Y || 0.38), Number(process.env.EYE_DX || 0.32));
}

const iou = (a, b) => {
  const x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2), y2 = Math.min(a.y2, b.y2);
  if (x2 <= x1 || y2 <= y1) return 0;
  const i = (x2 - x1) * (y2 - y1);
  return i / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - i);
};

async function main() {
  const labels = JSON.parse(fs.readFileSync(`${ROOT}/${BANK}/label/labels.json`, 'utf8'));
  const clusters = JSON.parse(fs.readFileSync(`${ROOT}/${BANK}/label/clusters.json`, 'utf8'));
  const byCrop = new Map();
  for (const c of clusters) {
    const who = labels[c.id];
    if (who !== 'man' && who !== 'woman') continue;
    for (const m of c.members) byCrop.set(m.crop, { who, cid: c.id });
  }

  await tf.setBackend('cpu');
  await tf.ready();
  const faceM = await tfconv.loadGraphModel(fsHandler('blazeface'));
  const genM = await tfconv.loadGraphModel(fsHandler('faceres'));

  const winFiles = fs.readdirSync(`${ROOT}/${BANK}/reads`).filter((x) => x.endsWith('.json'));
  const rows = [];
  let noMatch = 0, noMarks = 0, frames = 0;

  for (const wf of LIMIT ? winFiles.slice(0, LIMIT) : winFiles) {
    const win = JSON.parse(fs.readFileSync(`${ROOT}/${BANK}/reads/${wf}`, 'utf8'));
    // Only frames that actually carry a LABELLED face are worth decoding.
    const want = new Map();
    for (const fr of win.frames) {
      const keep = (fr.faces || []).filter((fa) => fa.crop && byCrop.has(fa.crop));
      if (keep.length) want.set(fr.i, keep);
    }
    if (!want.size) continue;
    const maxI = Math.max(...want.keys());
    const raw = grabRaw(`${ROOT}/video/${win.vid}.mp4`, win.t0, maxI + 1, win.fps);
    process.stderr.write(`${wf}  frames wanted ${want.size}, decoded ${raw.length}\n`);

    for (const [i, banked] of want) {
      if (!raw[i]) continue;
      frames++;
      const frame = tf.tensor3d(new Uint8Array(raw[i]), [H, W, 3], 'int32');
      try {
        const dets = await detectFaceBoxes(faceM, null, frame);
        for (const b of banked) {
          const lab = byCrop.get(b.crop);
          // Re-detection is deterministic, but match by overlap rather
          // than by index: a box list that shifted by one would silently
          // score every face against the wrong human label.
          let best = null, bestI = 0;
          for (const d of dets) { const v = iou(d, b); if (v > bestI) { bestI = v; best = d; } }
          if (!best || bestI < 0.5) { noMatch++; continue; }
          if (!best.marks || best.marks.length < 12) { noMarks++; continue; }

          const truth = lab.who === 'man' ? 'male' : 'female';
          const row = { vid: win.vid, cid: lab.cid, who: lab.who, truth, crop: b.crop };

          // ---- arm 1, SHIPPED -------------------------------------------
          const a1 = await classifyFaceGenders(genM, null, [best], frame, { square: true });
          row.shipped = a1[0].gender; row.shippedScore = a1[0].score;

          // ---- arm 2, EYE-RECT (free) -----------------------------------
          const er = eyeRect(best, W, H);
          if (er) {
            // squareBox on an already pixel-square rect is the identity,
            // so the shipped call crops exactly this rectangle.
            const a2 = await classifyFaceGenders(genM, null,
              [{ ...er, marks: best.marks }], frame, { square: true });
            row.eye = a2[0].gender; row.eyeScore = a2[0].score;
          }

          // ---- arm 3, ALIGNED (costs a per-face op) ---------------------
          const t = alignTransform(best, W, H, GENDER_INPUT);
          if (t) {
            const aligned = tf.tidy(() => tf.squeeze(tf.image.transform(
              tf.expandDims(tf.cast(frame, 'float32'), 0),
              tf.tensor2d([t], [1, 8]),
              'bilinear', 'constant', 0,
              [GENDER_INPUT, GENDER_INPUT],
            ), [0]));
            try {
              const a3 = await classifyFaceGenders(genM, null, [FULL_BOX], aligned, { square: true });
              row.align = a3[0].gender; row.alignScore = a3[0].score;
            } finally { tf.dispose(aligned); }
          }
          rows.push(row);
        }
      } finally { tf.dispose(frame); }
    }
    process.stderr.write(`  rows so far ${rows.length}\n`);
  }

  console.log(`\nframes ${frames}, rows ${rows.length}  (no box match ${noMatch}, no landmarks ${noMarks})`);
  const arms = [['shipped', 'shipped'], ['eye-rect (free)', 'eye'], ['aligned (costs)', 'align']];
  for (const who of ['woman', 'man']) {
    const sub = rows.filter((r) => r.who === who);
    console.log(`\n${who.toUpperCase()}  n=${sub.length}`);
    for (const [name, key] of arms) {
      const have = sub.filter((r) => r[key]);
      const wrong = have.filter((r) => r[key] !== r.truth).length;
      console.log(`   ${name.padEnd(16)} n ${String(have.length).padStart(4)}`
        + `   wrong ${String(wrong).padStart(4)} = `
        + `${have.length ? (100 * wrong / have.length).toFixed(1) : '--'}%`);
    }
    // Paired: only reads where all three answered, so the arms are
    // compared on the identical population.
    const all = sub.filter((r) => r.shipped && r.eye && r.align);
    if (all.length) {
      console.log(`   -- paired on ${all.length} reads all three answered --`);
      for (const [name, key] of arms) {
        const wrong = all.filter((r) => r[key] !== r.truth).length;
        console.log(`      ${name.padEnd(16)} wrong ${String(wrong).padStart(4)} = ${(100 * wrong / all.length).toFixed(1)}%`);
      }
      for (const [name, key] of [['eye-rect', 'eye'], ['aligned', 'align']]) {
        const fixed = all.filter((r) => r.shipped !== r.truth && r[key] === r.truth).length;
        const broke = all.filter((r) => r.shipped === r.truth && r[key] !== r.truth).length;
        console.log(`      ${name.padEnd(10)} vs shipped:  FIXED ${fixed}   BROKE ${broke}   net ${fixed - broke > 0 ? '+' : ''}${fixed - broke}`);
      }
    }
  }

  // Per video, so one dominant subject cannot carry the whole result.
  console.log('\nPER VIDEO, women, paired (wrong counts):');
  const vids = [...new Set(rows.map((r) => r.vid))].sort();
  for (const v of vids) {
    const s = rows.filter((r) => r.vid === v && r.who === 'woman' && r.shipped && r.eye && r.align);
    if (!s.length) continue;
    const w = (k) => s.filter((r) => r[k] !== r.truth).length;
    console.log(`  ${v.padEnd(14)} n ${String(s.length).padStart(4)}`
      + `   shipped ${String(w('shipped')).padStart(3)}   eye ${String(w('eye')).padStart(3)}   aligned ${String(w('align')).padStart(3)}`);
  }

  fs.writeFileSync(`${ROOT}/${BANK}/crop-ab-rows.json`, JSON.stringify(rows));
  console.log(`\nrows banked to ${ROOT}/${BANK}/crop-ab-rows.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
