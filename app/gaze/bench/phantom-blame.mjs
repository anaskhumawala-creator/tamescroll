// PHANTOM IS THE BIGGEST ERROR (272s of 600) AND NOBODY HAS EVER ASKED
// WHAT IT IS MADE OF. The scorer counts a patch as phantom in two very
// different situations and lumps them:
//
//   ON A GRAPHIC   a patch sitting on a face BlazeFace found and a human
//                  labelled `notperson` -- a logo, a hand, stage kit.
//   ON NOTHING     a patch no labelled face claims at all. That is a
//                  track that OUTLIVED its subject: coasting after the
//                  person left frame, or parked on a title card.
//
// They need opposite fixes. The first is a detector/verdict question and
// the second is purely the tracker's coast. Tuning either one blind is
// how the last three rounds went.
import fs from 'fs';
import {
  faceMeta, personFromFace, dedupeObservations, updatePersonTracks, setVerdictCadence,
} from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';

const ASPECT = W / H, COVER = 0.15;
const readOf = (f) => ({ gender: f.gender, score: f.score, raw: f.raw, age: f.age,
  childP: f.childP, shape: f.shape, desc: null });
function overlapFrac(face, box) {
  const x1 = Math.max(face.x1, box.x1), y1 = Math.max(face.y1, box.y1);
  const x2 = Math.min(face.x2, box.x2), y2 = Math.min(face.y2, box.y2);
  if (x2 <= x1 || y2 <= y1) return 0;
  const a = (face.x2 - face.x1) * (face.y2 - face.y1);
  return a > 0 ? ((x2 - x1) * (y2 - y1)) / a : 0;
}

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const g = process.env.GENDER || 'man';
let onGraphic = 0, onNothing = 0, onUnlabelled = 0, total = 0;
const ageHist = new Map();   // how old the track was when it painted nothing

for (const file of fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'))) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  const dt = 1000 / win.fps, dtS = 1 / win.fps;
  setVerdictCadence(dt);
  let tracks = [];
  for (const fr of win.frames) {
    const meta = faceMeta(g, fr.faces.map(readOf));
    let obs = fr.faces.map((f, i) => {
      const m = meta[i] || {};
      return { box: personFromFace(f, ASPECT), flagged: m.flagged, certain: m.certain,
        abstained: m.abstained, instant: m.instant, weak: m.weak, nullMint: !!m.nullRead,
        faceFound: true, verdictDt: dt, desc: null };
    });
    obs = dedupeObservations(obs);
    tracks = updatePersonTracks(tracks, obs, dt, null);
    const live = tracks.filter((t) => t.state !== 'cleared');
    for (const p of live) {
      total += dtS;
      // Which labelled face, if any, does this patch actually sit on?
      let bestLab = null, bestF = 0, sawUnlabelled = false;
      for (const f of fr.faces) {
        const o = overlapFrac(f, p.box);
        if (o < COVER) continue;
        const lab = cropLabel.get(f.crop);
        if (!lab || lab === 'mixed') { sawUnlabelled = true; continue; }
        if (o > bestF) { bestF = o; bestLab = lab; }
      }
      if (bestLab && bestLab !== 'notperson') continue;      // a real person: not phantom
      if (bestLab === 'notperson') { onGraphic += dtS; continue; }
      if (sawUnlabelled) { onUnlabelled += dtS; continue; }
      onNothing += dtS;
      // A patch on nothing: how many frames since this track last saw a face?
      const bucket = Math.round((p.missMs || 0) / 500) * 500;
      ageHist.set(bucket, (ageHist.get(bucket) || 0) + dtS);
    }
  }
}

console.log(`gender=${g}   patch-seconds total ${total.toFixed(1)}s\n`);
console.log(`  ON A GRAPHIC (labelled notperson)   ${onGraphic.toFixed(1)}s`);
console.log(`  ON NOTHING   (no face under it)     ${onNothing.toFixed(1)}s`);
console.log(`  on an unlabelled/mixed face         ${onUnlabelled.toFixed(1)}s   (not counted either way)`);
console.log('\n  patch-on-nothing by how long the track had been coasting:');
[...ageHist.entries()].sort((a, b) => a[0] - b[0]).forEach(([m, s]) =>
  console.log(`    coasting ${String(m).padStart(5)}ms   ${s.toFixed(1)}s`));
