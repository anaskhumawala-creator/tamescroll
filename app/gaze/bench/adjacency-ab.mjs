// THE CLAMP THAT KNOWS WHO IS STANDING THERE.
//
// geometry-ab priced a BLANKET narrowing and body-arm shows why it
// cannot ship: at 0.70 the Linus frames are fixed (his daughter's head
// and torso stay covered, he goes sharp) but a TED speaker at a podium
// loses her dress and legs. Those are two different failures wearing one
// number:
//
//   Linus      HORIZONTAL overlap with a man the app has CLEARED
//   TED        VERTICAL extent on a full-body shot with nobody adjacent
//
// A single scale factor has to trade one against the other. An
// ADJACENCY clamp does not: pull the patch edge back only where it would
// otherwise swallow a face the app has decided to leave sharp, and leave
// it at full extent everywhere else. The podium shot has no cleared face
// inside the patch, so nothing moves; the Linus shot does, so the edge
// stops short of him.
//
// THIS IS NOT CUTTING A HOLE. The owner has ruled twice that patches are
// SOLID and that the fix belongs in "better association, refusing a
// merge, tighter observation geometry". This moves ONE EDGE of ONE
// RECTANGLE. Nothing is subtracted, split, windowed or silhouetted, and
// the covered person's own face is never given up: the clamp refuses to
// pull the edge past the face the patch was drawn for, so a subject
// standing directly in front of a cleared man keeps her full patch and
// he stays covered -- the accepted cost, unchanged.
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

/**
 * Pull `body`'s left/right edge back so it stops short of `other`, but
 * never past `face` itself. Horizontal only: a cleared man beside her is
 * the measured case, and pulling the BOTTOM edge up would give away the
 * torso of the person the patch is for.
 */
function clampAway(body, face, others, pad) {
  let { x1, x2 } = body;
  const fy1 = face.y1, fy2 = face.y2;
  for (const o of others) {
    // Only a face that actually shares this patch's vertical band can be
    // swallowed by its width. A face far above or below is not what the
    // side extension is covering.
    if (o.y2 < body.y1 || o.y1 > body.y2) continue;
    const ocx = (o.x1 + o.x2) / 2;
    const fcx = (face.x1 + face.x2) / 2;
    if (ocx < fcx) x1 = Math.max(x1, Math.min(face.x1, o.x2 + pad));
    else x2 = Math.min(x2, Math.max(face.x2, o.x1 - pad));
    void fy1; void fy2;
  }
  return { ...body, x1, y1: body.y1, x2, y2: body.y2 };
}

/** A5 plus an optional adjacency clamp with padding `pad` (normalised). */
function arm(pad) {
  return function (win, g) {
    let tracks = [];
    const out = [], dt = 1000 / win.fps;
    const subs = [];
    setVerdictCadence(dt);
    for (const fr of win.frames) {
      const base = faceMeta(g, fr.faces.map(readOf));
      const decided = [];
      const meta = fr.faces.map((f, i) => {
        const b = base[i] || {};
        const d = descOf(win, f.descIdx);
        if (!d) { decided.push(null); return b; }
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
        decided.push(best.decided);
        if (best.decided === 'clear') return { ...b, flagged: false, certain: true, abstained: false };
        return { ...b, flagged: true, certain: true, abstained: false, instant: true };
      });
      // Faces the arm has DECIDED to leave sharp. Only a decided clear
      // may push an edge -- an undecided face is still a candidate for
      // covering, and clamping away from it would be giving up coverage
      // on a maybe.
      // ONLY A FACE WITH DESCRIPTOR SIGNAL MAY PUSH AN EDGE.
      // Found by LOOKING at the render, not in the score: on the
      // RcGyVTAoXEU stage a projected GRAPHIC on the backdrop is
      // detected as a face, decided `clear`, and pulls the speaker's
      // patch in off her side. The score cannot see that harm at all --
      // a graphic carries no label, so the strip it uncovers contains
      // no labelled face and costs zero. Exactly the blindness that
      // made the blanket narrowing look cheap.
      // `nm` is the faceres descriptor magnitude before L2: p50 12.66
      // on reads that carry signal, 2.88 on the model's prior. A
      // backdrop graphic is the second population.
      const clears = fr.faces.filter((f, i) => decided[i] === 'clear' && f.nm >= NM_FLOOR);
      let obs = fr.faces.map((f, i) => {
        const m = meta[i] || {};
        let box = personFromFace(f, ASPECT);
        if (pad != null && decided[i] !== 'clear') {
          box = clampAway(box, f, clears.filter((o) => o !== f), pad);
        }
        return { box, flagged: m.flagged, certain: m.certain, abstained: m.abstained,
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

console.log(`gender=${g}   A5 + adjacency clamp (edge stops short of a DECIDED-CLEAR face)\n`);
console.log('  pad      EXPOSURE  FALSECOVER   PHANTOM   covered  sharp');
for (const pad of [null, 0.10, 0.05, 0.02, 0.0]) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
  for (const win of wins) {
    const s = score(arm(pad)(win, g), g, (c) => cropLabel.get(c));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  console.log('  ' + (pad == null ? 'off ' : pad.toFixed(2)).padStart(5) +
    (agg.exposureS.toFixed(1) + 's').padStart(13) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
    (agg.phantomS.toFixed(1) + 's').padStart(10) +
    (agg.coveredS.toFixed(1) + 's').padStart(10) +
    (agg.sharpOkS.toFixed(1) + 's').padStart(8));
}
console.log('\n  `pad` is the gap left between the patch edge and the cleared face,');
console.log('  in normalised frame units. Smaller pad = the edge comes closer to him.');
