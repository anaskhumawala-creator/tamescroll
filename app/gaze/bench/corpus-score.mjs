// THE SCORER. Replays the SHIPPED decision layer over banked frames and
// reports the three errors in SECONDS, because the unit the owner
// experiences is "how long was she sharp", not per-read accuracy. A
// per-read score cannot see the tracker at all, and the tracker is where
// every exposure this month lived.
//
// BOTH DIRECTIONS, ALWAYS. A number that reports only one is how "the
// gate catches 96% of non-faces" got published without "and refuses a
// real face forever" beside it:
//   EXPOSURE     a person he asked to cover is sharp        (severest)
//   PHANTOM      a patch with no person under it            (his "random blur")
//   FALSE COVER  the wrong gender covered                   (his oldest complaint)
//
// FIDELITY, and its limit. init-entry's assembly is entangled with the
// video element, MoveNet and a promise chain, so this does not copy it.
// It replays HIS REGIME, in which MoveNet admits nobody -- all twelve
// slots n:0, every run, on his hardware -- so every face takes the
// face path: personFromFace, dedupe, updatePersonTracks. That is the
// only regime that matters and it is the one the corpus was banked in.
//
// The OTHER limit, stated rather than buried: labels cover faces the
// DETECTOR FOUND. A person BlazeFace never detected is invisible here,
// so EXPOSURE means "the decision layer left a person sharp", not "she
// was never detected". The detector is out of scope per the handoff.
import fs from 'fs';
import {
  faceMeta, personFromFace, dedupeObservations, updatePersonTracks,
  setVerdictCadence, iou,
} from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';

const ASPECT = W / H;
const D = 1024;
// person-track's identity memory needs the descriptor or it cannot let a
// re-appearing face inherit a clear. Passing null made the shipped
// tracker look worse than it is.
function descOf(win, i) {
  if (!win.desc || i == null || i < 0) return null;
  const o = i * D;
  return o + D <= win.desc.length ? win.desc.subarray(o, o + D) : null;
}

/** Rebuild the read object faceMeta expects from a banked face. */
function readOf(f) {
  return { gender: f.gender, score: f.score, raw: f.raw, age: f.age,
    childP: f.childP, shape: f.shape, desc: null };
}

/** One window, one setting. Returns per-frame patch boxes. */
export function replay(win, userGender, tweak) {
  let tracks = [];
  const out = [];
  const dt = 1000 / win.fps;
  setVerdictCadence(dt);
  for (const fr of win.frames) {
    const reads = fr.faces.map(readOf);
    const meta = (tweak && tweak.faceMeta ? tweak.faceMeta : faceMeta)(userGender, reads);
    let obs = fr.faces.map((f, i) => {
      const m = meta[i] || {};
      return {
        box: personFromFace(f, ASPECT),
        flagged: m.flagged, certain: m.certain, abstained: m.abstained,
        instant: m.instant, weak: m.weak,
        // His regime: MoveNet admits nobody, so noShape holds for every
        // face and the mint tag is never scoped away.
        nullMint: !!m.nullRead,
        faceFound: true, verdictDt: dt, desc: descOf(win, f.descIdx),
      };
    });
    obs = dedupeObservations(obs);
    tracks = updatePersonTracks(tracks, obs, dt, tweak && tweak.hold);
    out.push({
      t: fr.t,
      patches: tracks.filter((t) => t.state !== 'cleared').map((t) => ({ ...t.box })),
      faces: fr.faces,
    });
  }
  return out;
}

const COVER = 0.15;   // a face is "covered" when this much of it is inside a patch
export function overlapFrac(face, box) {
  const x1 = Math.max(face.x1, box.x1), y1 = Math.max(face.y1, box.y1);
  const x2 = Math.min(face.x2, box.x2), y2 = Math.min(face.y2, box.y2);
  if (x2 <= x1 || y2 <= y1) return 0;
  const a = (face.x2 - face.x1) * (face.y2 - face.y1);
  return a > 0 ? ((x2 - x1) * (y2 - y1)) / a : 0;
}

/**
 * @param labelOf  crop path -> 'man'|'woman'|'child'|'notperson'|'mixed'
 * userGender 'man' means: cover WOMEN (and children), leave men sharp.
 */
export function score(frames, userGender, labelOf) {
  const dtS = frames.length > 1 ? (frames[1].t - frames[0].t) : 0.5;
  let exposureS = 0, falseCoverS = 0, phantomS = 0, coveredS = 0, sharpOkS = 0, skipped = 0;
  const shouldCover = (lab) => userGender === 'man' ? (lab === 'woman' || lab === 'child')
                                                   : (lab === 'man' || lab === 'child');
  for (const fr of frames) {
    const claimed = new Set();
    // AN UNLABELLED FACE STILL CLAIMS ITS PATCH. Skipping the face but
    // not its patch counted the patch as "on nothing" -- which made the
    // first published phantom figure 272s when the real one is 88s, and
    // 136s of the difference was purely my own `mixed` labels. A face I
    // refused to label is a face the score must be silent about in BOTH
    // directions, not one direction.
    for (const f of fr.faces) {
      const lab = labelOf(f.crop);
      if (!lab || lab === 'mixed') {
        skipped++;
        // SYMMETRIC WITH A LABELLED FACE, which the first version was
        // not: it claimed EVERY overlapping patch while a labelled face
        // claims only its best one, so a face I refused to judge
        // absorbed more phantom than one I did. 143 patches under A0.
        let b = -1, bf = 0;
        fr.patches.forEach((p, i) => { const o = overlapFrac(f, p); if (o > bf) { bf = o; b = i; } });
        if (bf >= COVER && b >= 0) claimed.add(b);
        continue;
      }
      // A HAND IS PART OF A PERSON. This repo settled it in gauntlet R21
      // -- "a patch there is not GHOST and refusing the mint is
      // EXPOSURE" -- and person-track says the same about a back-turned
      // person: "the exact case blur-first exists for". Labelling those
      // crops `notperson` charged every arm PHANTOM for doing the thing
      // the product is supposed to do. A bodypart claims its patch and
      // scores neither error: it is a person, so covering it is not
      // phantom, and it carries no readable gender, so leaving it sharp
      // is not false cover either.
      if (lab === 'bodypart') {
        let b = -1, bf = 0;
        fr.patches.forEach((p, i) => { const o = overlapFrac(f, p); if (o > bf) { bf = o; b = i; } });
        if (bf >= COVER && b >= 0) claimed.add(b);
        continue;
      }
      let best = -1, bestF = 0;
      fr.patches.forEach((p, i) => { const o = overlapFrac(f, p); if (o > bestF) { bestF = o; best = i; } });
      const covered = bestF >= COVER;
      if (covered && best >= 0) claimed.add(best);
      if (lab === 'notperson') { if (covered) phantomS += dtS; continue; }
      if (shouldCover(lab)) { covered ? (coveredS += dtS) : (exposureS += dtS); }
      else { covered ? (falseCoverS += dtS) : (sharpOkS += dtS); }
    }
    // A patch no labelled face claims is a patch on nothing.
    fr.patches.forEach((p, i) => { if (!claimed.has(i)) phantomS += dtS; });
  }
  const durS = frames.length * dtS;
  return { durS, exposureS, falseCoverS, phantomS, coveredS, sharpOkS, skipped,
    exposurePct: coveredS + exposureS > 0 ? exposureS / (coveredS + exposureS) : 0,
    phantomPerMin: durS > 0 ? (phantomS / dtS) / (durS / 60) : 0 };
}

// ---- CLI ----
if (process.argv[1] && process.argv[1].endsWith('corpus-score.mjs')) {
  const userGender = process.env.GENDER || 'man';
  let labels = {};
  const LP = `${ROOT}/bank/label/labels.json`;
  const CP = `${ROOT}/bank/label/clusters.json`;
  let cropLabel = new Map();
  if (fs.existsSync(LP) && fs.existsSync(CP)) {
    labels = JSON.parse(fs.readFileSync(LP, 'utf8'));
    for (const c of JSON.parse(fs.readFileSync(CP, 'utf8')))
      if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
  } else {
    console.log('NO LABELS YET -- run corpus-label.mjs, label in label.html, save labels.json.');
    console.log('Reporting patch/read counts only; the three error numbers need labels.\n');
  }
  // NO LABELS MEANS NO SCORE, NOT A SCORE OF ZERO. With an empty label
  // map every patch is unclaimed and every face is skipped, so the three
  // errors print as "phantom 136s, exposure 0s" -- numbers that look
  // measured and mean nothing. Refuse to print them instead.
  const haveLabels = cropLabel.size > 0;
  const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
  let agg = { durS: 0, exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0, skipped: 0 };
  for (const f of files) {
    const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${f}`, 'utf8'));
    const dp = `${ROOT}/bank/reads/${f.replace(/\.json$/, '.desc')}`;
    if (fs.existsSync(dp)) win.desc = new Float32Array(fs.readFileSync(dp).buffer.slice(0));
    const frames = replay(win, userGender);
    const s = score(frames, userGender, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
    const patches = frames.reduce((a, x) => a + x.patches.length, 0);
    const reads = frames.reduce((a, x) => a + x.faces.length, 0);
    const head = f.replace(/\.json$/, '').padEnd(22) + ' ' + String(frames.length).padStart(4) +
      'fr  reads ' + String(reads).padStart(4) + '  patches ' + String(patches).padStart(5);
    console.log(haveLabels ? head + '  exposure ' + s.exposureS.toFixed(1) + 's  falseCover ' +
      s.falseCoverS.toFixed(1) + 's  phantom ' + s.phantomS.toFixed(1) + 's' : head);
  }
  if (!haveLabels) {
    console.log('');
    console.log('Replay works. The three error numbers are WITHHELD until labels exist --');
    console.log('with an empty label map every patch is unclaimed, so they would read as');
    console.log('measurements and mean nothing.');
    process.exit(0);
  }
  console.log('\n--- TOTAL, gender=' + userGender + ' ---');
  console.log(`  duration        ${agg.durS.toFixed(0)}s`);
  console.log(`  EXPOSURE        ${agg.exposureS.toFixed(1)}s   (person he asked to cover, sharp)`);
  console.log(`  FALSE COVER     ${agg.falseCoverS.toFixed(1)}s   (wrong gender covered)`);
  console.log(`  PHANTOM         ${agg.phantomS.toFixed(1)}s   (patch on nothing)`);
  console.log(`  covered ok      ${agg.coveredS.toFixed(1)}s`);
  console.log(`  sharp ok        ${agg.sharpOkS.toFixed(1)}s`);
  if (agg.skipped) console.log(`  unlabelled reads skipped: ${agg.skipped}`);
}
