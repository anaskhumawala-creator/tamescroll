// THE BODY BOX IS NOW THE DOMINANT CAUSE OF THE WRONG-GENDER BLUR, AND
// person-gate.mjs ASKED FOR THIS EXPERIMENT BY NAME.
//
// Under A5 the per-subject decision is right for essentially every man
// in the corpus, and about two thirds of the false cover that remains is
// a man standing inside a patch drawn for a woman the app is CORRECTLY
// covering. That is the accepted cost of a solid patch -- the owner has
// ruled twice that patches are solid and that the fix belongs upstream,
// in "better association, refusing a merge, tighter observation
// geometry", never in cutting a hole.
//
// personFromFace's own comment says the width constant is deliberately
// conservative and that narrowing it re-opens EXPOSURE, and closes with:
//
//   "let a round that can re-capture the R8 podium footage do the
//    narrowing with evidence."
//
// This is that evidence. It prices the narrowing in BOTH directions on
// labelled footage, which is the thing that did not exist when 3.911 was
// frozen.
//
// HOW THE NARROWING IS APPLIED, and why it is not the same as editing
// the constant. The synthetic body is shrunk toward the FACE centre
// after personFromFace has run, so the close-up cap and the aspect
// correction both still apply exactly as they ship. That makes this a
// price for a CLAMP -- which is also the safest shape for a real fix,
// because a clamp cannot make a patch bigger than the code that ships.
// The face itself is always kept fully inside, so no amount of
// narrowing can uncover the head it was drawn for.
import fs from 'fs';
import {
  faceMeta, personFromFace, dedupeObservations, updatePersonTracks, setVerdictCadence,
} from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin } from './arch-arms.mjs';

const ASPECT = W / H, D = 1024;
const SIM = 0.60, NM_FLOOR = 5, CLEAR = 0.60, MIN_VOTES = 3, POOL_BAR = 0.40;
const logit = (v) => Math.log(Math.max(1e-6, v) / Math.max(1e-6, 1 - v));
const sigm = (z) => 1 / (1 + Math.exp(-z));
const readOf = (f) => ({ gender: f.gender, score: f.score, raw: f.raw, age: f.age,
  childP: f.childP, shape: f.shape, desc: null });
const descOf = (win, i) => {
  const o = i * D;
  return (i != null && i >= 0 && o + D <= win.desc.length) ? win.desc.subarray(o, o + D) : null;
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < D; i++) s += a[i] * b[i]; return s; };

/** Shrink a synthetic body toward the face, never past the face itself. */
function narrow(body, face, kx, ky) {
  const cx = (face.x1 + face.x2) / 2;
  const cy = (face.y1 + face.y2) / 2;
  const x1 = Math.min(face.x1, cx - (cx - body.x1) * kx);
  const x2 = Math.max(face.x2, cx + (body.x2 - cx) * kx);
  const y1 = Math.min(face.y1, cy - (cy - body.y1) * ky);
  const y2 = Math.max(face.y2, cy + (body.y2 - cy) * ky);
  return { ...body, x1, y1, x2, y2 };
}

/** A5, with the body box scaled by (kx, ky). */
function arm(kx, ky) {
  return function (win, g) {
    let tracks = [];
    const out = [], dt = 1000 / win.fps;
    const subs = [];
    setVerdictCadence(dt);
    for (const fr of win.frames) {
      const base = faceMeta(g, fr.faces.map(readOf));
      const meta = fr.faces.map((f, i) => {
        const b = base[i] || {};
        const d = descOf(win, f.descIdx);
        if (!d) return b;
        let best = null, bs = SIM;
        for (const s of subs) { const c = cos(d, s.proto); if (c > bs) { bs = c; best = s; } }
        if (best) for (let k = 0; k < D; k++) best.proto[k] = best.proto[k] * 0.9 + d[k] * 0.1;
        else { best = { proto: Float32Array.from(d), votes: 0, sumLogit: 0, decided: null }; subs.push(best); }
        if (f.nm >= NM_FLOOR) { best.sumLogit += logit(1 - f.raw); best.votes++; }
        if (best.votes >= MIN_VOTES) {
          const p = sigm(best.sumLogit / best.votes);
          if (2 * Math.abs(p - 0.5) >= Math.max(POOL_BAR, CLEAR / Math.sqrt(best.votes))) {
            best.decided = p > 0.5 ? 'cover' : 'clear';
          }
        }
        if (best.decided === 'clear') return { ...b, flagged: false, certain: true, abstained: false };
        return { ...b, flagged: true, certain: true, abstained: false, instant: true };
      });
      let obs = fr.faces.map((f, i) => {
        const m = meta[i] || {};
        return { box: narrow(personFromFace(f, ASPECT), f, kx, ky),
          flagged: m.flagged, certain: m.certain, abstained: m.abstained,
          instant: m.instant, weak: m.weak, nullMint: !!m.nullRead,
          faceFound: true, verdictDt: dt, desc: descOf(win, f.descIdx) };
      });
      obs = dedupeObservations(obs);
      tracks = updatePersonTracks(tracks, obs, dt, null);
      out.push({ t: fr.t, faces: fr.faces,
        patches: tracks.filter((t) => t.state !== 'cleared').map((t) => ({ ...t.box })) });
    }
    return out;
  };
}

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);

console.log(`gender=${g}   A5 with the synthetic body scaled toward the face\n`);
console.log('  width  height   EXPOSURE  FALSECOVER   PHANTOM   covered  sharp');
const GRID = [[1, 1], [0.85, 1], [0.7, 1], [0.55, 1], [0.4, 1],
  [0.7, 0.7], [0.55, 0.55], [0.4, 0.4]];
for (const [kx, ky] of GRID) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
  for (const win of wins) {
    const s = score(arm(kx, ky)(win, g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log('  ' + kx.toFixed(2).padStart(5) + '   ' + ky.toFixed(2).padStart(5) +
    (agg.exposureS.toFixed(1) + 's').padStart(11) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
    (agg.phantomS.toFixed(1) + 's').padStart(10) +
    (agg.coveredS.toFixed(1) + 's').padStart(10) +
    (agg.sharpOkS.toFixed(1) + 's').padStart(8));
}
console.log('\n  EXPOSURE is the severest error and narrowing is the one knob that can');
console.log('  only ever raise it. A row is only interesting if exposure barely moves.');
