// THE ARCHITECTURE ARMS, as a FACTORY over the shipped module.
//
// Taking the module as a parameter is what lets the matrix run a control
// that changes ONE SHIPPED CONSTANT and nothing else -- the control the
// first version of this file did not have, and without which "the
// architecture won" could not be told apart from "the bar got lower".
//
// WHAT EACH ARM IS
//   A0      the shipped per-frame verdict. `hold` selects 1078 (off) or
//           1079 (the bounded null-mint hold, which is what actually
//           ships and which the first version of this file omitted).
//   A5      decide per SUBJECT: group reads by the faceres identity
//           descriptor, pool the gender logits, hold the patch while
//           undecided.
//   CLAMP   A5 plus an adjacency clamp on the synthetic body box.
//
// HONEST NOTE ON THE POOLED BAR, because the previous version of this
// file claimed a mechanism that never fired. `bar = max(poolBar,
// CLEAR/sqrt(votes))` with MIN_VOTES 3 gives 0.60/sqrt(3) = 0.346, which
// is BELOW poolBar 0.40 -- so the sqrt term is dead and the bar is just
// the constant. The vote-scaling described in the old comment did not
// exist. It is kept as a plain constant now and named as one.
//
// HONEST NOTE ON THE IDENTITY GROUPING. The old comment claimed the
// descriptor "knows nothing about gender, so the grouping cannot be
// circular". MEASURED FALSE: two different people of the SAME gender
// cross the 0.60 merge threshold about five times as often as a
// cross-gender pair, and within a subject cos(i,j) correlates -0.34 with
// how differently the two reads score. The votes are NOT independent, so
// no standard-error argument applies to the pool.
import fs from 'fs';
import * as SHIPPED from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';

const ASPECT = W / H;
const D = 1024;

// SIM is OURS, not a shipped constant. The old comment cited
// MEM_SIM_CLEAR; `grep MEM_SIM app/gaze/src` returns nothing -- it was
// deleted in a69fa48 ("identity memory may never grant a clear"). It is
// a value fitted here, and it sits one notch above an 8x exposure cliff
// at 0.40, so it must be treated as a risk and not as a precedent.
export const SIM = 0.60;
export const NM_FLOOR = 5;      // NULL_MINT_NM_FLOOR, shipped
export const MIN_VOTES = 3;
export const POOL_BAR = 0.40;

const logit = (v) => Math.log(Math.max(1e-6, v) / Math.max(1e-6, 1 - v));
const sigm = (z) => 1 / (1 + Math.exp(-z));

const CUTS = (() => {
  try { return JSON.parse(fs.readFileSync(`${ROOT}/bank/cuts.json`, 'utf8')); }
  catch (e) { return {}; }
})();

export function loadWin(file) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  // Cut marks from the SHIPPED scene gate, run at the app's own 10Hz --
  // see corpus-cuts.mjs. Absent until that has been run, in which case
  // the `cut` arm is inert rather than wrong.
  win.cuts = CUTS[file.replace(/\.json$/, '')] || null;
  const dp = `${ROOT}/bank/reads/${file.replace(/\.json$/, '.desc')}`;
  win.desc = fs.existsSync(dp)
    ? new Float32Array(fs.readFileSync(dp).buffer.slice(0))
    : new Float32Array(0);
  return win;
}
export function descOf(win, i) {
  if (!win.desc || i == null || i < 0) return null;
  const o = i * D;
  return o + D <= win.desc.length ? win.desc.subarray(o, o + D) : null;
}
const cos = (a, b) => { let s = 0; for (let i = 0; i < D; i++) s += a[i] * b[i]; return s; };

/**
 * Pull `body`'s left/right edge back so it stops short of `other`, but
 * never past `face` itself. Horizontal only: a cleared man beside her is
 * the measured case, and pulling the BOTTOM edge up would give away the
 * torso of the person the patch is for. Moves ONE EDGE of ONE SOLID
 * RECTANGLE -- nothing is subtracted, split or windowed.
 */
export function clampAway(body, face, others, pad) {
  let { x1, x2 } = body;
  for (const o of others) {
    if (o.y2 < body.y1 || o.y1 > body.y2) continue;
    const ocx = (o.x1 + o.x2) / 2, fcx = (face.x1 + face.x2) / 2;
    if (ocx < fcx) x1 = Math.max(x1, Math.min(face.x1, o.x2 + pad));
    else x2 = Math.min(x2, Math.max(face.x2, o.x1 - pad));
  }
  return { ...body, x1, x2 };
}

const readOf = (f) => ({ gender: f.gender, score: f.score, raw: f.raw, age: f.age,
  childP: f.childP, shape: f.shape, desc: null });

/**
 * @param mod  the shipped module namespace (possibly with one constant
 *             patched, which is the whole point of the factory)
 */
export function makeArms(mod) {
  const { faceMeta, personFromFace, dedupeObservations, updatePersonTracks,
    setVerdictCadence, clampBodies } = mod;

  // `f._noRead` marks a frame the cadence bench chose not to spend a
  // faceres pass on. It becomes a POSITION-ONLY observation, which is
  // what a position pass is in the app: the box moves, no verdict is
  // remade. Dropping the face would delete the coast with it.
  const obsOf = (f, m, dt, desc, box) => (f._noRead ? {
    box: box || personFromFace(f, ASPECT),
    positionOnly: true, faceFound: true, verdictDt: dt, desc: null,
  } : {
    box: box || personFromFace(f, ASPECT),
    signal: f.nm >= NM_FLOOR,
    flagged: m.flagged, certain: m.certain, abstained: m.abstained,
    instant: m.instant, weak: m.weak, nullMint: !!m.nullRead,
    faceFound: true, verdictDt: dt, desc: desc || null,
  });
  // `_labelFaces` carries the ground truth on a frame the ARM was given
  // no observations for. Without it a coasted frame scores neither error
  // and the cadence comparison measures nothing.
  const frameOut = (fr, tracks) => ({ t: fr.t, faces: fr._labelFaces || fr.faces,
    patches: tracks.filter((t) => t.state !== 'cleared').map((t) => ({ ...t.box })) });

  /** opts: {hold, pool, clampPad} */
  return function arm(opts) {
    const o = opts || {};
    return function (win, g) {
      let tracks = [];
      // 1079 threads the bounded null-mint hold back out of the tracker.
      // Omitting it does not run the shipped decision layer at all.
      let held = o.hold ? [] : null;
      const out = [], dt = 1000 / win.fps;
      const subs = [];
      setVerdictCadence(dt);
      let fi = -1;
      for (const fr of win.frames) {
        fi++;
        // THE SHIPPED SCENE GATE. A cut wipes every track: IoU
        // association is meaningless across a shot change, and without
        // this the bench charges any change that clears more people for
        // a failure the app already prevents -- a woman's observation
        // re-associating onto a stale CLEARED track left by a man in
        // the previous shot (bar-blame, z86LGEFyQpo t=57.5).
        //
        // HALF-MODELLED, AND THE HALF THAT IS MISSING IS THE KIND ONE.
        // The app's cut handler is "wipe tracks AND run an immediate
        // full pass". The corpus banks reads only at its own frames, so
        // there is nothing here to re-read with, and every wipe costs a
        // full verdict interval of exposure that the app does not pay.
        // So the ABSOLUTE numbers on a `cut` arm overstate exposure --
        // read only the DIFFERENCE between two `cut` arms, where the
        // same handicap applies to both.
        if (o.cut && win.cuts && win.cuts[fi]) { tracks = []; held = o.hold ? [] : null; }
        const base = faceMeta(g, fr.faces.map(readOf));
        const decided = [];
        const meta = fr.faces.map((f, i) => {
          const b = base[i] || {};
          if (!o.pool || f._noRead) { decided.push(null); return b; }
          const d = descOf(win, f.descIdx);
          if (!d) { decided.push(null); return b; }
          let best = null, bs = SIM;
          for (const s of subs) { const c = cos(d, s.proto); if (c > bs) { bs = c; best = s; } }
          if (best) for (let k = 0; k < D; k++) best.proto[k] = best.proto[k] * 0.9 + d[k] * 0.1;
          else { best = { proto: Float32Array.from(d), votes: 0, sumLogit: 0, decided: null }; subs.push(best); }
          if (f.nm >= NM_FLOOR) {
            best.sumLogit += logit(g === 'man' ? 1 - f.raw : f.raw);
            best.votes++;
          }
          if (best.votes >= MIN_VOTES) {
            const p = sigm(best.sumLogit / best.votes);
            if (2 * Math.abs(p - 0.5) >= POOL_BAR) best.decided = p > 0.5 ? 'cover' : 'clear';
          }
          decided.push(best.decided);
          if (best.decided === 'clear') return { ...b, flagged: false, certain: true, abstained: false };
          return { ...b, flagged: true, certain: true, abstained: false, instant: true };
        });
        // Only a DECIDED-CLEAR face WITH DESCRIPTOR SIGNAL may push an
        // edge. Found by looking at the render: a projected graphic on a
        // TED backdrop is detected as a face, decided clear, and pulls
        // the speaker's patch off her side -- and the score cannot see
        // that harm, because a graphic carries no label.
        // WHOSE "CLEAR" DRIVES THE CLAMP. Coupling it to the POOL was a
        // defect: the pool needs MIN_VOTES reads, and at his measured
        // 1.5s verdict cadence it gets a third of the votes, so the
        // clamp almost never fired -- which is why it bought nothing at
        // his rate. The shipped per-frame verdict answers the same
        // question every pass, for free, at any cadence.
        let obs = fr.faces.map((f, i) => obsOf(f, meta[i] || {}, dt, descOf(win, f.descIdx)));
        // THE SHIPPED CALL, not a bench reimplementation of it. The
        // first version of this arm decided who may push an edge here,
        // which meant the number being reported was never produced by
        // code that could ship. clampBodies keys on the OBSERVATION --
        // `flagged === false && signal === true` -- so a position-only
        // pass carries no verdict and therefore pushes nothing, which is
        // what the app actually does between verdicts and is stricter
        // than what the bench used to model.
        if (o.clampPad != null) obs = clampBodies(obs, o.clampPad);
        obs = dedupeObservations(obs);
        tracks = updatePersonTracks(tracks, obs, dt, held);
        if (o.hold) held = tracks.nullHeld || [];
        out.push(frameOut(fr, tracks));
      }
      return out;
    };
  };
}

const ARM = makeArms(SHIPPED);
export const ARM_A0 = ARM({});                                   // 1078
export const ARM_A0_HOLD = ARM({ hold: true });                  // 1079, what ships
export const ARM_A5 = ARM({ hold: true, pool: true });
export const ARM_CLAMP = ARM({ hold: true, pool: true, clampPad: 0.02 });
export const armSubject = (opts) => ARM({ pool: true, ...(opts || {}) });
