// SECTION 2, THE ARCHITECTURE A/B. The handoff asks one question before
// any product code is written:
//
//   "Given reads this weak, is a per-frame verdict the right
//    architecture at all -- or should the video path decide per SUBJECT
//    over a window, and hold the patch while it decides?"
//
// This answers it on the Section 1 corpus, in seconds, with labels, and
// scoring BOTH directions every run. Every arm is scored by the SAME
// scorer over the SAME frames, so the only variable is the decision.
//
// COSTS NO INFERENCE. Every quantity these arms read -- the identity
// descriptor, nm, raw -- is already computed by the shipped faceres
// pass and then thrown away. The arms add one 1024-float dot product
// per face per subject, against ~1.25s of model time per face.
//
// WHY THIS IS NOT pool-vs-single AGAIN. That bench pooled over TRACKS
// and scored per READ, and it lost (rescued 4 men, lost 75). Three
// things are different here and each of them is load bearing:
//   1. Subjects are found by the faceres IDENTITY DESCRIPTOR, which is
//      computed by a head that knows nothing about gender -- so the
//      grouping cannot be circular with the thing being decided. A
//      track is an IoU accident and dies at every cut; an identity
//      survives one.
//   2. The score is SECONDS with human labels, so an arm that flips a
//      man for one frame in twenty is penalised the way he sees it.
//   3. `nm` is used as a POOLING WEIGHT rather than a mint gate. Every
//      previous use of it refused a read outright; here a read with no
//      descriptor signal simply does not get a vote, which is what
//      "carries no signal" actually means.
import fs from 'fs';
import {
  faceMeta, personFromFace, dedupeObservations, updatePersonTracks,
  setVerdictCadence,
} from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';

const ASPECT = W / H;
const D = 1024;

const SIM = 0.60;            // MEM_SIM_CLEAR, the shipped identity threshold
const NM_FLOOR = 5;          // NULL_MINT_NM_FLOOR, shipped
const CLEAR = 0.60;          // GENDER_CLEAR_SCORE, shipped
const MIN_VOTES = 3;         // reads a subject needs before it may be decided
const GHOST_VOTES = 6;       // signal-free reads before a subject is called a graphic

const logit = (v) => Math.log(Math.max(1e-6, v) / Math.max(1e-6, 1 - v));
const sigm = (z) => 1 / (1 + Math.exp(-z));

function loadWin(file) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  const dp = `${ROOT}/bank/reads/${file.replace(/\.json$/, '.desc')}`;
  win.desc = fs.existsSync(dp)
    ? new Float32Array(fs.readFileSync(dp).buffer.slice(0))
    : new Float32Array(0);
  return win;
}
function descOf(win, i) {
  if (i == null || i < 0) return null;
  const o = i * D;
  if (o + D > win.desc.length) return null;
  return win.desc.subarray(o, o + D);
}
function cos(a, b) { let s = 0; for (let i = 0; i < D; i++) s += a[i] * b[i]; return s; }

/** Online identity memory. Descriptors are already L2-normed. */
function makeSubjects() {
  const subs = [];
  return {
    subs,
    match(d) {
      if (!d) return null;
      let best = null, bs = SIM;
      for (const s of subs) { const c = cos(d, s.proto); if (c > bs) { bs = c; best = s; } }
      if (best) {
        for (let i = 0; i < D; i++) best.proto[i] = best.proto[i] * 0.9 + d[i] * 0.1;
        return best;
      }
      const s = { proto: Float32Array.from(d), votes: 0, sumLogit: 0, quiet: 0,
        decided: null, ghost: false };
      subs.push(s);
      return s;
    },
  };
}

const readOf = (f) => ({ gender: f.gender, score: f.score, raw: f.raw, age: f.age,
  childP: f.childP, shape: f.shape, desc: null });
// THE OBSERVATION MUST CARRY THE DESCRIPTOR. init-entry.js:2967 passes
// `desc: faceDesc`, and person-track's identity memory is what lets a
// re-appearing face inherit a clear instead of re-earning it from
// scratch after every cut. Passing null here silently disabled that --
// which made the A0 baseline worse than the code that actually ships,
// and would have credited a rewrite with a win the shipped tracker
// already had. Same defect class as the `nm` parity line that compared
// undefined to undefined.
// `f._noRead` marks a frame the read-rate bench chose NOT to spend a
// faceres pass on. It becomes a POSITION-ONLY observation, which is
// exactly what a position pass is in the app: the box moves, no verdict
// is remade. Dropping the face entirely would delete the coast too and
// would flatter any arm that skips reads.
const obsOf = (f, m, dt, desc) => (f._noRead ? {
  box: personFromFace(f, ASPECT),
  positionOnly: true, faceFound: true, verdictDt: dt, desc: null,
} : {
  box: personFromFace(f, ASPECT),
  flagged: m.flagged, certain: m.certain, abstained: m.abstained,
  instant: m.instant, weak: m.weak, nullMint: !!m.nullRead,
  faceFound: true, verdictDt: dt, desc: desc || null,
});
const frameOut = (fr, tracks) => ({ t: fr.t, faces: fr.faces,
  patches: tracks.filter((t) => t.state !== 'cleared').map((t) => ({ ...t.box })) });

// ---- ARMS ----
// Every arm returns per-frame { t, patches, faces } for the scorer.

/** A0: the shipped decision layer, unchanged. */
function armShipped(win, g) {
  let tracks = [];
  const out = [], dt = 1000 / win.fps;
  setVerdictCadence(dt);
  for (const fr of win.frames) {
    const meta = faceMeta(g, fr.faces.map(readOf));
    let obs = fr.faces.map((f, i) => obsOf(f, meta[i] || {}, dt, descOf(win, f.descIdx)));
    obs = dedupeObservations(obs);
    tracks = updatePersonTracks(tracks, obs, dt, null);
    out.push(frameOut(fr, tracks));
  }
  return out;
}

/**
 * A1/A2/A3: decide per SUBJECT over a window, hold the patch while deciding.
 *
 * A subject is COVERED from its first sighting and stays covered until
 * enough evidence accumulates to clear it -- so the arm is fail-closed
 * by construction and cannot trade exposure for the other two errors
 * without the score saying so.
 *
 * opts.nmWeight  drop reads below the nm floor from the pool
 * opts.ghost     a subject whose reads are ALL signal-free stops being
 *                covered after GHOST_VOTES sightings (per SUBJECT, over
 *                a window -- never per read, which is the refusal that
 *                shipped an exposure three times)
 */
function armSubject(opts) {
  return function (win, g) {
    let tracks = [];
    const out = [], dt = 1000 / win.fps;
    const mem = makeSubjects();
    setVerdictCadence(dt);
    for (const fr of win.frames) {
      const base = faceMeta(g, fr.faces.map(readOf));
      const meta = fr.faces.map((f, i) => {
        const b = base[i] || {};
        if (f._noRead) return b;          // no read, no vote
        const s = mem.match(descOf(win, f.descIdx));
        if (!s) return b;
        const signal = f.nm >= NM_FLOOR;
        if (signal) s.quiet = 0; else s.quiet++;
        if (!opts.nmWeight || signal) {
          // raw is P(male); fold it to "P(the gender he wants covered)"
          const pCover = g === 'man' ? 1 - f.raw : f.raw;
          s.sumLogit += logit(pCover);
          s.votes++;
        }
        if (opts.ghost && !s.ghost && s.quiet >= GHOST_VOTES && s.votes === 0) s.ghost = true;
        if (s.ghost) return { ...b, flagged: false, certain: true, abstained: false };
        if (s.votes >= MIN_VOTES) {
          const p = sigm(s.sumLogit / s.votes);
          const conf = 2 * Math.abs(p - 0.5);
          // THE BAR EXISTS TO SURVIVE ONE NOISY READ. Once a subject has
          // n independent reads the mean's standard error falls like
          // 1/sqrt(n), so holding a POOLED decision to the SINGLE-READ
          // bar is not caution, it is arithmetic left undone -- and it
          // is why A1/A2 still cover a man whose reads average 0.70:
          // conf 0.4 never reaches 0.6, so he is held forever, which is
          // WORSE for him than the per-frame flicker it replaced.
          // Floor it so a 3-vote pool is not treated like a 30-vote one.
          const bar = opts.poolBar
            ? Math.max(opts.poolBar, CLEAR / Math.sqrt(s.votes))
            : CLEAR;
          if (conf >= bar) s.decided = p > 0.5 ? 'cover' : 'clear';
        }
        if (s.decided === 'clear') return { ...b, flagged: false, certain: true, abstained: false };
        // undecided OR decided-cover: HOLD THE PATCH.
        return { ...b, flagged: true, certain: true, abstained: false, instant: true };
      });
      let obs = fr.faces.map((f, i) => obsOf(f, meta[i] || {}, dt, descOf(win, f.descIdx)));
      obs = dedupeObservations(obs);
      tracks = updatePersonTracks(tracks, obs, dt, null);
      out.push(frameOut(fr, tracks));
    }
    return out;
  };
}

export { loadWin, armShipped as ARM_A0 };
export const ARM_A5 = armSubject({ nmWeight: true, poolBar: 0.40 });
export { armSubject };
