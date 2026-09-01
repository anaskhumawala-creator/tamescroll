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
// FIRST, and the order is load-bearing: this rebuilds .cache/shipped.mjs
// and must be evaluated before anything imports it. See _build.mjs.
import './_build.mjs';
import * as SHIPPED from './.cache/shipped.mjs';
import { createIdentityMemory, askIdentity, trustNeeded } from './.cache/shipped.mjs';
import { parsePersons, rejectedSlotBoxes, lastSlotDiag, boundBodyToSlot, PERSON_MIN_SCORE } from './.cache/shipped.mjs';
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

let CUTS = (() => {
  try { return JSON.parse(fs.readFileSync(`${ROOT}/bank/cuts.json`, 'utf8')); }
  catch (e) { return {}; }
})();

// SWEEPING CUT_DELTA MEANS SWAPPING THE BANK, not patching a constant --
// the replay wipes on `win.cuts[fi]` and never reads a module's
// CUT_DELTA. Re-derive a bank with `corpus-cuts.mjs <delta> <out>`, then
// point at it here. `expect` is asserted against the file's own stamp,
// so a sweep cannot mislabel one of its own rows.
export function setCutBank(path, expect) {
  CUTS = JSON.parse(fs.readFileSync(path, 'utf8'));
  const got = CUTS.__meta && CUTS.__meta.CUT_DELTA;
  if (expect !== undefined && got !== expect) throw new Error(
    `${path} is stamped CUT_DELTA ${got}, the sweep asked for ${expect}`);
  _cutBankDelta = got;
}
let _cutBankDelta;
/** The CUT_DELTA the loaded bank was derived at, from its own stamp. */
export function cutBankDelta() {
  return (CUTS.__meta && CUTS.__meta.CUT_DELTA) !== undefined
    ? CUTS.__meta.CUT_DELTA : null;
}

// A BANKED DERIVATIVE OF A SHIPPED CONSTANT MUST DECLARE THE CONSTANT.
// Throwing is deliberate: the failure this replaces was SILENT and ran
// in the flattering direction (see docs/engine-findings.md 10a), and a
// bench that quietly scores the wrong threshold is worse than one that
// will not start. Re-run bench/corpus-cuts.mjs.
export function assertCutsFresh(shipped) {
  // AGAINST THE SHIPPED BUNDLE, never the arm's variant. The replay
  // wipes on `win.cuts[fi]` -- banked booleans -- and never reads a
  // module's CUT_DELTA, so a variant that patches it is inert here and
  // refusing it would be a false alarm.
  shipped = shipped || SHIPPED;
  const meta = CUTS.__meta;
  if (!Object.keys(CUTS).length) return;                 // never banked: inert
  if (!meta) throw new Error(
    'bank/cuts.json has no __meta stamp -- it predates the check and its '
    + 'CUT_DELTA is unknown. Re-run bench/corpus-cuts.mjs.');
  // A sweep that deliberately swapped the bank is not stale.
  if (_cutBankDelta !== undefined) return;
  if (shipped && meta.CUT_DELTA !== shipped.CUT_DELTA) throw new Error(
    `bank/cuts.json was banked at CUT_DELTA ${meta.CUT_DELTA}, the bundle `
    + `ships ${shipped.CUT_DELTA}. Re-run bench/corpus-cuts.mjs.`);
}

export function loadWin(file) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
  // Cut marks from the SHIPPED scene gate, run at the app's own 10Hz --
  // see corpus-cuts.mjs. Absent until that has been run, in which case
  // the `cut` arm is inert rather than wrong.
  // The bank key, kept on the window: every side bank in this directory
  // (cuts, ssd, persons, deltas) is keyed by it, and a bench that has
  // only the loaded window had to re-derive it or guess.
  win.tag = file.replace(/\.json$/, '');
  win.cuts = CUTS[win.tag] || null;
  // coco-ssd person boxes at the same frame times (bench/cocossd-bank.mjs).
  // Absent until that has run, in which case an `ssd` arm falls back to
  // the synthetic body everywhere and is simply the control again --
  // inert, never silently half-measured.
  try {
    win.ssd = JSON.parse(fs.readFileSync(`${ROOT}/bank/ssd/${file}`, 'utf8'));
  } catch (e) { win.ssd = null; }
  // Raw MoveNet [1,6,56] per frame (bench/corpus-persons.mjs), so a
  // slot arm can call the SHIPPED parsePersons/rejectedSlotBoxes rather
  // than a bench re-derivation of the coordinate layout.
  try {
    const b = fs.readFileSync(`${ROOT}/bank/persons/${file.replace(/\.json$/, '.f32')}`);
    win.persons = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  } catch (e) { win.persons = null; }
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

/**
 * THE MEASURED EXTENT, in place of the 7.4-face-heights guess.
 *
 * personFromFace paints a body 63% of frame width at his measured face
 * sizes, which is why a two-shot puts the neighbour inside her patch.
 * A detector box is the person's ACTUAL extent, so the patch stops
 * where they do. Falls back to the guess whenever no box contains the
 * face -- the arm must never be a mix of "measured" and "nothing".
 *
 * The box is padded by PATCH_MARGIN, the same margin boundBodyToSlot
 * applies, so this is the shipped geometry with a better rectangle
 * rather than a second set of constants nobody has calibrated.
 */
function bodyFromSsd(boxes, face, minScore, margin) {
  if (!boxes || !boxes.length) return null;
  const fcx = (face.x1 + face.x2) / 2, fcy = (face.y1 + face.y2) / 2;
  let best = null;
  for (const b of boxes) {
    if (b.s < minScore) continue;
    if (fcx < b.x1 || fcx > b.x2 || fcy < b.y1 || fcy > b.y2) continue;
    // Smallest containing box: with two people overlapping, the tighter
    // one is the person whose face this is. Taking the largest would
    // reintroduce exactly the swallowing this exists to remove.
    const a = (b.x2 - b.x1) * (b.y2 - b.y1);
    if (!best || a < best.a) best = { a, b };
  }
  if (!best) return null;
  const b = best.b;
  const mw = (b.x2 - b.x1) * margin, mh = (b.y2 - b.y1) * margin;
  // The face is never given up, whatever the detector says.
  return {
    x1: Math.max(0, Math.min(b.x1 - mw, face.x1)),
    y1: Math.max(0, Math.min(b.y1 - mh, face.y1)),
    x2: Math.min(1, Math.max(b.x2 + mw, face.x2)),
    y2: Math.min(1, Math.max(b.y2 + mh, face.y2)),
    fromFace: true, faceBox: face, fromSsd: true,
  };
}

const readOf = (f) => ({ gender: f.gender, score: f.score, raw: f.raw, age: f.age,
  childP: f.childP, shape: f.shape, desc: null });

/**
 * @param mod  the shipped module namespace (possibly with one constant
 *             patched, which is the whole point of the factory)
 */
export function makeArms(mod) {
  assertCutsFresh(SHIPPED);
  // FROM `mod`, not from the top-level import. The first version of the
  // slot arm called the module-level boundBodyToSlot, so every variant
  // bundle scored identically (bound/faces pinned at 81 across a
  // threshold sweep from 0.8 to 0.3) -- a constant sweep that cannot
  // move is a harness failure, not a null result.
  const { faceMeta, personFromFace, dedupeObservations, updatePersonTracks,
    setVerdictCadence, clampBodies, demoteTracks } = mod;
  const modBound = mod.boundBodyToSlot;
  // FROM THE VARIANT, NOT THE MODULE SCOPE. These were imported from
  // .cache/shipped.mjs at the top of this file, so a constant sweep
  // built by rewriting a variant bundle could not move them and every
  // row printed identical. That has now broken three sweeps in one
  // session; a sweep that cannot move is a broken instrument, not a
  // null result.
  const modMakeMem = mod.createIdentityMemory;
  const modAsk = mod.askIdentity;
  const modTrust = mod.trustNeeded;
  const modParse = mod.parsePersons;
  const modRejected = mod.rejectedSlotBoxes;
  const modMinScore = mod.PERSON_MIN_SCORE;

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
    // `id`/`state`/`born` are BENCH-ONLY provenance. newTrack builds its
    // box as a literal, so nothing about which track drew a patch
    // survives to the score -- which is why "one patch, two people" had
    // to be inferred from geometry. An attribution that has to guess
    // its own inputs is the thing that made three rounds unreadable.
    patches: tracks.filter((t) => t.state !== 'cleared')
      .map((t) => ({ ...t.box, id: t.id, state: t.state, born: t.born })) });

  /** opts: {hold, pool, clampPad} */
  return function arm(opts) {
    const o = opts || {};
    return function (win, g) {
      let tracks = [];
      const mem = modMakeMem();
      let measured = 0, faceTotal = 0;
      // 1079 threads the bounded null-mint hold back out of the tracker.
      // Omitting it does not run the shipped decision layer at all.
      let held = o.hold ? [] : null;
      const out = [], dt = 1000 / win.fps;
      const subs = [];
      // THE CADENCE THE TRACKER IS TOLD MUST BE THE CADENCE IT GETS.
      //
      // This passed `dt` -- the BANK's frame interval, 500ms -- in every
      // arm, including the k=3 and k=4 arms where a verdict actually
      // lands every 1500ms or 2000ms. That is not a label: person-track
      // SIZES ITS COAST WINDOWS from this number, and sizing them for a
      // cadence three times faster than the real one makes a track
      // expire between every pair of verdicts.
      //
      //   effZoom   cap = max(2000, 2*ms)   blurredCoast    gap at that k
      //     500            2000                1250            1500  k=3
      //    1500            3000                3000            1500  k=3
      //    2000            4000                4000            2000  k=4
      //
      // So the arm gave a k=3 run a 1250ms coast against a 1500ms gap
      // where the app gives 3000ms, and PTRACK_MIN_COAST_PASSES -- the
      // constant whose entire job is "the window may never be too short
      // to reach the next pass" -- was floored at 2x500 instead of
      // 2x1500 and could not do it. Same shape as the cut-wipe defect
      // (10k/10m): the arm contradicted the module it was replaying.
      //
      // INFERRED, NOT PASSED IN. A caller-supplied option is a thing 30
      // bench files can forget; `thin` marks every frame it silenced by
      // moving the reads to `_labelFaces`, so the stride is a property
      // of the window the arm was handed and cannot disagree with it.
      // MEDIAN GAP, not the first one. A uniform arm gives the same
      // answer either way, but an IRREGULAR policy (cadence-place, which
      // spends its verdicts where the picture moved) can open with two
      // adjacent verdict frames and would have been handed a stride of
      // 1 -- reintroducing the very defect this block fixes, in exactly
      // the arm built to be compared against it.
      const vAt = [];
      for (let i = 0; i < win.frames.length; i++) {
        if (win.frames[i]._labelFaces === undefined) vAt.push(i);
      }
      const gaps = [];
      for (let i = 1; i < vAt.length; i++) gaps.push(vAt[i] - vAt[i - 1]);
      gaps.sort((a, b) => a - b);
      const stride = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 1;
      setVerdictCadence(dt * stride);
      let fi = -1;
      for (const fr0 of win.frames) {
        fi++;
        const cutHere = !!(o.cut && win.cuts && win.cuts[fi]);
        // THE OTHER HALF OF THE SHIPPED CUT HANDLER: a forced verdict.
        // init-entry sets `lastSample = 0; lastZoomAt = 0` at a cut, so
        // the very next pass re-reads gender rather than only positions.
        // The corpus thins to k=3 to model his 1.5s cadence, which parks
        // the real reads on `_labelFaces` -- so on a cut frame they can
        // be handed straight back as INPUT. Same banked reads a verdict
        // frame gets; nothing synthetic.
        //
        // WITHOUT THIS THE ARM OVERSTATES WHAT A CUT COSTS, and that
        // bias runs toward RAISING CUT_DELTA -- the direction a decision
        // was about to be made in. An instrument may not be left biased
        // toward the change it is being asked to price.
        // DEFAULT IS THE APP. Opting IN to the forced pass would leave
        // every other arm in this directory (birth-ab, cut-value,
        // matrix) silently on a model the app does not run, which is
        // the whole defect this section exists to fix. The opt-out is
        // named for what it removes.
        // `cutNoDemote` splits the handler's two halves so they can be
        // priced apart: a cut both DEMOTES (association hygiene) and
        // FORCES A VERDICT (more reads). Those are different goods and
        // the sweep in 10m charges CUT_DELTA for both at once.
        const fr = (cutHere && !o.cutNoPass && fr0.faces.length === 0 && fr0._labelFaces)
          ? { ...fr0, faces: fr0._labelFaces }
          : fr0;
        // THE SHIPPED SCENE GATE. A cut wipes every track: IoU
        // association is meaningless across a shot change, and without
        // this the bench charges any change that clears more people for
        // a failure the app already prevents -- a woman's observation
        // re-associating onto a stale CLEARED track left by a man in
        // the previous shot (bar-blame, z86LGEFyQpo t=57.5).
        //
        // IT CALLS THE SHIPPED HANDLER, AND FOR TWO ROUNDS IT DID NOT.
        // Until 2026-09-02 this line was `tracks = []` under a comment
        // asserting "a cut wipes every track". THE APP HAS NEVER WIPED:
        // init-entry is `videoTracks = demoteTracks(videoTracks)`, whose
        // own comment says "DEMOTE, don't wipe (review C2): boxes
        // persist so coverage holds through the pass gap". A wipe leaves
        // NOBODY COVERED until the next verdict frame -- 1.5s at his
        // cadence -- so the arm manufactured one exposure gap per cut.
        //
        // AND THE OLD DEFENCE BELOW IT WAS EXACTLY BACKWARDS. It said to
        // read only the DIFFERENCE between two cut arms because "the
        // same handicap applies to both". The handicap is paid ONCE PER
        // WIPE and `cutFrames` varies 100x across the CUT_DELTA axis
        // (200 -> 59 -> 12 -> 2), so the difference between two arms is
        // mostly the difference in how many gaps each one manufactured.
        // That is how a flat exposure column was published as a fall of
        // 67.0s -> 57.0s (engine-findings 10k, RETRACTED).
        //
        // STILL HALF-MODELLED, in the direction that overstates
        // exposure: the app also forces an IMMEDIATE full pass at a cut,
        // and the corpus banks reads only at its own frames, so there is
        // nothing here to re-read with. That residue no longer scales
        // with the swept axis the way the wipe did, but it is why a cut
        // arm's ABSOLUTE exposure is still a bound rather than a figure.
        if (cutHere && !o.cutNoDemote) {
          tracks = o.cutWipe ? [] : demoteTracks(tracks);
          held = o.hold ? [] : null;
        }
        let base = faceMeta(g, fr.faces.map(readOf));
        // A READ THAT CARRIED NO SIGNAL IS NOT AN ANSWER.
        // Measured LIVE on his phone (1082, 116 reads, one face per
        // read): faceres' descriptor magnitude alternates 11.0, 1.1,
        // 3.8, 11.0, 0.2, 0.2 ... on the SAME subject at px p50 140 and
        // face confidence 0.80 -- 57 flips in 116 reads. The two
        // populations are indistinguishable on size, confidence,
        // position and frame-edge contact, and every low one reads
        // v~0.62 age~37, which is the model's prior. That is an
        // execution failure on his GPU, not a property of the picture,
        // and the corpus never reproduces it because it decodes frames
        // from files.
        //
        // Today such a read ABSTAINS, and an abstain is an event: it
        // fails closed AND it revokes an earned clear. So a man who has
        // been cleared is re-covered by a read that contains nothing.
        // Making it INERT keeps the track exactly where the last real
        // read left it -- blurred stays blurred, cleared stays cleared.
        if (o.inertNoSignal) {
          base = base.map((b, i) => {
            const f = fr.faces[i];
            if (!f || f._noRead || typeof f.nm !== 'number' || f.nm >= NM_FLOOR) return b;
            return { ...b, positionOnly: true, abstained: false, certain: false,
                     instant: false, weak: false };
          });
        }
        const decided = [];
        // IDENTITY MEMORY AT BIRTH. churn.mjs measured the covering
        // track over a MAN changing 260 times in 482 covered frames,
        // median run ONE frame -- and a track is born blurred, so an
        // earned clear dies with the id that earned it and the next id
        // starts from scratch. That is why CLEAR_STREAK_N 1 recovered
        // 4.5% and every geometry lever recovered ~1s: the clear never
        // gets a second pass on the same track to accumulate on.
        //
        // The descriptor memory this app already ships stores EARNED
        // clear states and is consulted on a read. It is not consulted
        // at BIRTH, which is the exact moment being destroyed.
        //
        // `obs.instant` is the shipped escape: person-track clears a
        // blurred track on `obs.instant` without waiting for the streak.
        // So remembering an identity costs no new state machine.
        //   'strict' the CURRENT read must still be clear-certain; the
        //            memory only removes the SECOND-pass requirement.
        //   'loose'  a remembered identity clears on any read that is
        //            not certain-opposite. Strictly more exposure, so it
        //            is priced rather than assumed.
        const memMark = [];
        if (o.mem) {
          for (let i = 0; i < fr.faces.length; i++) {
            const f = fr.faces[i], b = base[i] || {};
            const d = f._noRead ? null : descOf(win, f.descIdx);
            // THE SHIPPED CALL, not a bench reimplementation of it. The
            // first version of this arm carried its own copy of the
            // memory, so the number being reported was produced by code
            // that could not ship -- the same defect the clamp arm was
            // fixed for. askIdentity owns the trust counter, the
            // revocation and the lean guard; the arm only supplies the
            // read.
            memMark.push(modAsk(mem, d, {
              readClear: b.flagged === false && b.certain === true,
              certainOpposite: b.flagged === true && b.certain === true,
              leansOwn: g === 'man' ? f.raw >= 0.5 : f.raw < 0.5,
              hasSignal: f.nm >= NM_FLOOR,
              need: o.mem === 'loose' ? 1 : (o.mem === 'loose2' ? 2 : modTrust(g)),
            }));
            if (memMark[i] && o.memAudit)
              o.memAudit.push({ crop: f.crop, sim: 0, raw: f.raw, px: f.px, nm: f.nm });
          }
        }
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
            // `o.poolBar` IS READ HERE NOW, and until 2026-09-02 it was
            // not. Eight call sites across six files passed it -- one of
            // them (critic-lovo) SWEPT it over a grid and reported a
            // "best" -- and `ARM` never looked at it, so every one of
            // those arms ran at the module constant. Proved by running
            // arch-ab.mjs: A1 through A5 printed IDENTICAL rows
            // (5.5 / 210.0 / 314.0 / 557.5 / 495.0), five labels on one
            // arm. Same for `ghost` and `nmWeight`, which are read
            // nowhere at all and have been deleted from the call sites
            // rather than given invented behaviour.
            const bar = typeof o.poolBar === 'number' ? o.poolBar : POOL_BAR;
            if (2 * Math.abs(p - 0.5) >= bar) best.decided = p > 0.5 ? 'cover' : 'clear';
          }
          decided.push(best.decided);
          if (best.decided === 'clear') return { ...b, flagged: false, certain: true, abstained: false };
          return { ...b, flagged: true, certain: true, abstained: false, instant: true };
        });
        // MEASURED EXTENT ARM. `ssdMin` selects the detector score floor;
        // absent, every body is the synthetic guess exactly as today.
        // MEASURED MoveNet EXTENT. boundBodyToSlot already ships and
        // already shrinks the synthetic body onto a REJECTED slot box;
        // guard-why.mjs measured that SLOT_BOUND_FACE_INSIDE 0.8 is what
        // refuses 77.4% of them, against 0.6% and 2.3% for the other
        // two, with a box available for 96.8% of faces. So this arm
        // changes nothing except how often the shipped path is allowed
        // to use a measurement it already has.
        let slotBoxes = null;
        if (o.slotBound && win.persons) {
          const off = fi * 336;
          if (off + 336 <= win.persons.length) {
            try {
              modParse(win.persons.subarray(off, off + 336), modMinScore, W / H, null);
              slotBoxes = modRejected(mod.lastSlotDiag);
            } catch (e) { slotBoxes = null; }
          }
        }
        let ssdBoxes = null;
        if (o.ssdMin != null && win.ssd && win.ssd[fi]) ssdBoxes = win.ssd[fi].p;
        let nMeasured = 0;
        let obs = fr.faces.map((f, i) => {
          let box = null;
          // ONLY WHERE IT MATTERS. Replacing every body with the
          // measured extent buys -55s of phantom and costs +7.5s of
          // exposure, because the fat guess was covering people by
          // accident all over the corpus. But the owner's complaint is
          // specific: HER patch reaches the man beside her. So apply
          // the measurement only on a frame that actually has a
          // same-gender face to protect -- which is the same condition
          // the adjacency clamp already fires on -- and leave a lone
          // subject with the guess that was never hurting anybody.
          const adjacent = !o.ssdAdjacentOnly || fr.faces.some((h, hi) => {
            if (hi === i) return false;
            const hb = base[hi] || {};
            return hb.flagged === false && h.nm >= NM_FLOOR;
          });
          // MEASURED EDGE, GUESSED BODY. Replacing the body outright
          // costs 7.5s of exposure, because the guess was covering
          // people by accident all over the corpus and the score counts
          // that as protection. But the owner's complaint is one edge:
          // HER patch reaching the man beside her. So keep the guess --
          // nothing loses coverage anywhere -- and let the measured
          // extent pull back ONLY the side that faces a cleared face.
          // It cannot expose anyone the guess was covering except on
          // the side where somebody who should be sharp is standing,
          // which is the whole point.
          if (o.ssdEdge && ssdBoxes && !f._noRead) {
            const meas = bodyFromSsd(ssdBoxes, f, o.ssdMin, 0);
            const guess = personFromFace(f, W / H);
            if (meas && guess) {
              const fcx = (f.x1 + f.x2) / 2;
              let x1 = guess.x1, x2 = guess.x2;
              for (let hi = 0; hi < fr.faces.length; hi++) {
                if (hi === i) continue;
                const hb = base[hi] || {}, h = fr.faces[hi];
                if (!(hb.flagged === false && h.nm >= NM_FLOOR)) continue;
                const hcx = (h.x1 + h.x2) / 2;
                if (hcx > fcx) x2 = Math.min(x2, Math.max(meas.x2, f.x2));
                else x1 = Math.max(x1, Math.min(meas.x1, f.x1));
              }
              if (x2 - x1 > 0) { box = { ...guess, x1: x1, x2: x2, faceBox: guess.faceBox }; nMeasured++; }
            }
          }
          if (!o.ssdEdge && ssdBoxes && !f._noRead && adjacent) {
            box = bodyFromSsd(ssdBoxes, f, o.ssdMin, o.ssdPad != null ? o.ssdPad : 0.045);
            if (box) nMeasured++;
            // WIDTH IS MEASURED, HEIGHT IS NOT TRUSTED SMALLER.
            // On all 18 windows the detector box cut PHANTOM 142.5s ->
            // 84s (-41%) -- it is the "random blur marks" complaint,
            // measured -- and cost 15s of EXPOSURE. A person detector's
            // box is the VISIBLE extent, so it stops at frame edges,
            // at occlusions and at the crop of a seated subject, while
            // the synthetic body deliberately over-runs downward. So
            // take the measured WIDTH, which is what stops a patch
            // reaching the man beside her, and refuse to shrink the
            // HEIGHT below the guess, which is what keeps her covered.
            // A MINIMUM IN FACE WIDTHS. The measured box is the
            // VISIBLE extent, so a seated, occluded or edge-cropped
            // subject gets a head-and-shoulders rectangle -- and the
            // 15s of exposure the detector costs is exactly that,
            // coverage the fat guess was providing by accident. A floor
            // expressed in FACE widths scales with the subject instead
            // of pinning a frame fraction that means different things
            // at different distances.
            if (box && o.ssdMinFaceW) {
              const fw = f.x2 - f.x1, cx = (box.x1 + box.x2) / 2;
              const want = fw * o.ssdMinFaceW;
              if (box.x2 - box.x1 < want) {
                box = { ...box,
                  x1: Math.max(0, cx - want / 2),
                  x2: Math.min(1, cx + want / 2) };
              }
            }
            if (box && o.ssdUnionH) {
              const g0 = personFromFace(f, W / H);
              if (g0) {
                box = { ...box,
                  y1: Math.min(box.y1, g0.y1),
                  y2: Math.max(box.y2, g0.y2) };
              }
            }
          }
          if (slotBoxes && slotBoxes.length && !box && !f._noRead) {
            const g0 = personFromFace(f, W / H);
            const bound = g0 ? modBound(g0, f, slotBoxes) : null;
            if (bound && bound !== g0) { box = { ...bound, faceBox: g0.faceBox, fromFace: true }; nMeasured++; }
          }
          const m = meta[i] || {};
          // A REMEMBERED IDENTITY MAY PUSH AN EDGE.
          // clampBodies only lets `flagged === false && signal === true`
          // push a neighbour's patch back, and `signal` is THIS read's
          // descriptor magnitude -- absent 36-42% of the time on his
          // phone. So on the passes where faceres failed, the man
          // standing beside her could not push her patch off his own
          // face. The trust counter is the evidence the guard wanted:
          // it only rises on reads that carried nm >= NM_FLOOR.
          const mm = memMark[i]
            ? { ...m, flagged: false, certain: true, abstained: false, instant: true,
                ...(o.memSignal ? { signal: true } : {}) }
            : m;
          return obsOf(f, mm, dt, descOf(win, f.descIdx), box);
        });
        // A DETECTED PERSON NOBODY READ IS STILL A PERSON.
        // Rendering the worst exposure window showed what the narrowing
        // costs: the 63%-of-frame synthetic body was covering a girl
        // seated beside the subject BY ACCIDENT, and she has no patch of
        // her own because no face read ever reached her. The detector
        // found her -- it is a person detector, and it is the only thing
        // in the pipeline that did.
        //
        // Blur-first says an unread person is covered, so an ssd box
        // that no face claims becomes its own FLAGGED observation. It
        // carries no gender read, so it can never CLEAR anybody; the
        // only thing it can do is cover someone nothing else was
        // covering, which is the direction blur-first already runs in.
        if (o.ssdPersons && ssdBoxes) {
          for (const p of ssdBoxes) {
            if (p.s < (o.ssdPersonMin != null ? o.ssdPersonMin : o.ssdMin)) continue;
            const claimed = fr.faces.some((f) => {
              const cx = (f.x1 + f.x2) / 2, cy = (f.y1 + f.y2) / 2;
              return cx >= p.x1 && cx <= p.x2 && cy >= p.y1 && cy <= p.y2;
            });
            if (claimed) continue;
            // ONLY THE ACCIDENT, not every person in the shot. Minting
            // every unread detection halves EXPOSURE (82.0s -> 42.5s)
            // and takes PHANTOM to 500s, and that number is not all
            // scorer blindness -- the owner's rule is no random
            // patches. What the narrowing actually LOST is narrower
            // than that: people the 63%-of-frame guess was covering by
            // accident. So mint only where the guess itself would have
            // covered this box, which recovers exactly the loss and
            // adds no patch anywhere the old build did not already
            // have one.
            if (o.ssdPersonsAccidentOnly) {
              const covered = fr.faces.some((f) => {
                const g0 = personFromFace(f, W / H);
                if (!g0) return false;
                const ix = Math.min(g0.x2, p.x2) - Math.max(g0.x1, p.x1);
                const iy = Math.min(g0.y2, p.y2) - Math.max(g0.y1, p.y1);
                if (ix <= 0 || iy <= 0) return false;
                return (ix * iy) / ((p.x2 - p.x1) * (p.y2 - p.y1)) >= 0.5;
              });
              if (!covered) continue;
            }
            const pad = o.ssdPad != null ? o.ssdPad : 0.045;
            const w = (p.x2 - p.x1) * pad, h = (p.y2 - p.y1) * pad;
            obs.push({
              box: { x1: Math.max(0, p.x1 - w), y1: Math.max(0, p.y1 - h),
                     x2: Math.min(1, p.x2 + w), y2: Math.min(1, p.y2 + h) },
              flagged: true, certain: false, abstained: false, instant: false,
              weak: false, nullMint: false, signal: false, faceFound: false,
              verdictDt: dt, desc: null,
            });
          }
        }
        measured += nMeasured;
        faceTotal += fr.faces.length;
        // THE SHIPPED CALL, not a bench reimplementation of it. The
        // first version of this arm decided who may push an edge here,
        // which meant the number being reported was never produced by
        // code that could ship. clampBodies keys on the OBSERVATION --
        // `flagged === false && signal === true` -- so a position-only
        // pass carries no verdict and therefore pushes nothing, which is
        // what the app actually does between verdicts and is stricter
        // than what the bench used to model.
        if (o.clampPad != null) obs = clampBodies(obs, o.clampPad, o.clampMode);
        obs = dedupeObservations(obs);
        tracks = updatePersonTracks(tracks, obs, dt, held);
        if (o.hold) held = tracks.nullHeld || [];
        out.push(frameOut(fr, tracks));
      }
      // Reported on the result so an arm cannot claim a measured extent
      // it never had -- the coverage of the new source is the first
      // thing to check before reading its score.
      out.measured = measured;
      out.faceTotal = faceTotal;
      return out;
    };
  };
}

// LAZY, AND THAT IS THE WHOLE POINT.
// These were eager `const ARM = makeArms(SHIPPED)` at module scope, so
// assertCutsFresh ran at IMPORT -- and the arm whose entire job is to
// swap the bank (cut-sweep, which calls setCutBank first) could not
// even import the function it needed to call. Every corpus arm at HEAD
// died on a guard that was correct about a bank nobody had re-derived.
// A guard that refuses the fix for the thing it is guarding is a
// blocker, not a check.
//
// Importing is now side-effect-free; the first USE still asserts, which
// is where the assertion was always meant to bite.
let _arm;
const ARM = (o) => (_arm || (_arm = makeArms(SHIPPED)))(o);
export const lazyArm = (make) => {
  let v;
  return new Proxy(function () {}, {
    apply(t, s, a) { return (v || (v = make()))(...a); },
    get(t, k) { return (v || (v = make()))[k]; },
  });
};
export const ARM_A0 = lazyArm(() => ARM({}));                    // 1078
export const ARM_A0_HOLD = lazyArm(() => ARM({ hold: true }));   // 1079, what ships
export const ARM_A5 = lazyArm(() => ARM({ hold: true, pool: true }));
export const ARM_CLAMP = lazyArm(() => ARM({ hold: true, pool: true, clampPad: 0.02 }));
export const armSubject = (opts) => ARM({ pool: true, ...(opts || {}) });
