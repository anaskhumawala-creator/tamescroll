// Person-primary tracking + blur state machine for the live player
// (redesign 2026-08-24, docs/research/blur-pipeline-audit-2026-08-24.md).
// The PERSON is the unit of blur; the face only decides gender. One
// observation per person per detection pass (~4Hz), produced by the
// person-first pipeline in init-entry.js:
//
//   { box, faceFound, flagged, certain, confidence }
//
// This module replaces track.mjs for video: IoU association (person
// boxes overlap frame-to-frame at 4Hz — centre-distance greedy is what
// swapped Linus/daughter identities), constant-velocity coast, and a
// per-track BLUR STATE MACHINE with real hysteresis so the rendered
// patch set changes only on state transitions, never on per-sample
// recomputation (the audit's #3 hit-and-miss cause):
//
//   BLURRED --(confident same-gender for >= CLEAR_HOLD_MS continuous)--> CLEARED
//   CLEARED --(confident opposite obs)--> BLURRED          [instant, fail-safe]
//   CLEARED --(uncertain obs)--> CLEARED                   [memory absorbs]
//
// New tracks start BLURRED (unknown ⇒ covered, blur-first doctrine).
// Blur transitions are always instant; only the clear direction is
// damped. Pure module: no DOM, no timers — the caller passes elapsed ms.
// Clean-room (SORT/IoU-tracker literature structure only; abewley/sort
// is GPL and was never read — see NOTICE).

export var PTRACK_IOU_MIN = 0.2; // below this, no association
export var PTRACK_EMA_ALPHA = 0.6; // new-box weight per matched sample (0.45 -> 0.6 2026-08-24: owner phone — patch trailed the person; at adaptive ~2Hz the smoothing lag dominates, snappier wins)
export var PTRACK_MAX_MISS_MS = 1000; // a lost track coasts this long, then expires
export var CLEAR_HOLD_MS = 1500; // accumulated confident-clear time before a patch lifts
// Fast clear (owner 2026-08-25, caps-lock: "WHY ARE YOU BLURRING A MAN
// — I only wanted the female blur"): this many CONSECUTIVE certain
// same-gender adult reads clear a track without waiting out the hold
// (~0.8s at the 400ms verdict cadence; instant when identity memory
// already knows the person). Children can never take this path — their
// reads are never certain (age gate) — and unreadable/backside persons
// still sit covered until a face proves otherwise.
export var CLEAR_STREAK_N = 2;
// Uncertain reads DECAY the accumulated clear credit at this fraction of
// elapsed time instead of zeroing it (live 2026-08-24: a cleared-gender
// person looking down at a phone reads uncertain for most frames — a
// hard reset meant they never cleared at all; decay still demands that
// confident clears dominate before the patch lifts).
export var CLEAR_DECAY = 0.5;
export var PTRACK_PAD = 0.05; // person box side/bottom padding at render
// Extra headroom: MoveNet's box can crop at the hairline (v10-her-120:
// the covered person's hair crown poked out above the patch).
export var PTRACK_PAD_TOP = 0.12;

// Identity memory thresholds (owner ask 2026-08-24: "keep the person in
// memory and always blur her/him"). Descriptors are the faceres [1024]
// recognition embedding, L2-normalized in detector.js, so similarity is
// a plain dot product. Inheriting a CLEAR from memory is the risky
// direction (under-blur) — it demands the higher bar; the blur
// direction never needs memory (unknown ⇒ covered is the default).
// MEASURED 2026-08-25 (live calibration run, Linus video, review B):
// same-person consecutive reads median 0.90, but DIFFERENT people in the
// same frame scored >=0.6 in 32% of pairs and >=0.9 in 17%. faceres'
// descriptor does NOT separate identity at our crop quality, at ANY
// threshold. Consequence: identity memory may never grant a CLEAR —
// a false match there exposes a person (and the owner's daughter is
// exactly the adversarial case). Memory keeps only the BLUR direction,
// where a false match costs over-blur, never exposure.
export var MEM_SIM_FLAG = 0.85; // remembered FLAG re-applies at this similarity
export var MEM_SIM_UPDATE = 0.85;
// Identity continuity on a live track: only a GROSS mismatch counts as
// "someone else is standing here" (review A1). Set below the measured
// same-person 5th percentile (0.28) so a bad crop of the same person
// rarely trips it — a false break re-blurs a cleared man, which is the
// owner's loudest complaint. The real guard against absorption is
// CLEARED_TTL_MS below; this only catches near-orthogonal swaps.
export var IDENT_SIM_MIN = 0.15;
// A cleared track must RE-PROVE itself: this long without a single
// confident same-gender read reverts it to blurred (review A1 backstop —
// bounds every absorption hole, not just the child one).
export var CLEARED_TTL_MS = 5000;

// Monotonic track ids (review A9): overlays key on identity, not array
// index, so same-count churn cannot smear one person's patch onto
// another between passes.
var nextTrackId = 1;

// Lifecycle counters. A track that keeps being REPLACED can never earn a
// clear (CLEAR_STREAK_N needs 2 consecutive certain reads on ONE track),
// and R7 saw 18 ids across a single unbroken close-up of one man. These
// say WHICH path is ending the identity instead of leaving it to guesswork.
// Plain increments on a plain object, guarded by existence: a probe must
// never be able to throw inside the pipeline.
function bump(key) {
  var g = typeof globalThis !== 'undefined' ? globalThis.__TS_GAZE_IDS : null;
  if (!g) return;
  if (!g.life) g.life = {};
  g.life[key] = (g.life[key] || 0) + 1;
}

/** Dot product of two L2-normalized descriptors = cosine similarity. */
export function cosineSim(a, b) {
  if (!a || !b) return 0;
  var n = Math.min(a.length, b.length);
  var s = 0;
  for (var i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function iou(a, b) {
  var x1 = Math.max(a.x1, b.x1);
  var y1 = Math.max(a.y1, b.y1);
  var x2 = Math.min(a.x2, b.x2);
  var y2 = Math.min(a.y2, b.y2);
  var iw = Math.max(0, x2 - x1);
  var ih = Math.max(0, y2 - y1);
  var inter = iw * ih;
  if (inter <= 0) return 0;
  var areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  var areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  return inter / (areaA + areaB - inter);
}

function ema(prev, next, a) {
  return {
    x1: prev.x1 + (next.x1 - prev.x1) * a,
    y1: prev.y1 + (next.y1 - prev.y1) * a,
    x2: prev.x2 + (next.x2 - prev.x2) * a,
    y2: prev.y2 + (next.y2 - prev.y2) * a,
  };
}

function center(b) {
  return [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
}

/**
 * One tracker step. tracks: array from the previous call (or []).
 * observations: person observations for this pass. dtMs: elapsed since
 * the previous pass (drives velocity, coast expiry and the clear hold).
 * Association is globally greedy on IoU: best-overlapping (track, obs)
 * pairs claim each other first, so a jittery frame cannot swap two
 * nearby identities the way per-track nearest-centre could.
 */
/**
 * NEGATIVE DETECTION (owner idea 2026-08-25: "the detection tells you
 * there are no humans in the frame and you don't have the blur").
 * A verdict pass that found neither a person nor a face is positive
 * evidence of an empty frame — every coasting track is a ghost and dies
 * NOW rather than riding out its coast window.
 *
 * Deliberately an ERASER, never a CLEARER: absence removes patches, it
 * never marks anyone same-gender. A person facing away or half out of
 * frame also reads as absent, so this only ever runs when the frame is
 * empty of BOTH signals, and only on a verdict pass (the position pass
 * does not look for faces, so its silence means nothing).
 */
/**
 * How many CONSECUTIVE empty verdict passes it takes before absence is
 * believed. Two, not one.
 *
 * The original one-pass version read "both detectors returned nothing"
 * as independent corroboration. It is not: at small subject scale both
 * detectors fail for the SAME reason, so their agreement is one
 * correlated blind spot being counted twice. Measured in gauntlet R5 on
 * a TED stage holding ~40 people — persons 0, faces 0, and the eraser
 * fired, clearing the screen in a room full of them.
 *
 * Two passes is the cheapest possible corroboration and still kills a
 * genuine ghost inside ~800ms, which is the case this eraser was built
 * for (the owner's four stacked patches over an empty desk).
 */
export var WIPE_EMPTY_STREAK = 2;

/**
 * Below this box height (fraction of frame) the detectors are near their
 * floor, so "I see nobody" is weak evidence and gets corroborated. Above
 * it they were seeing the subject comfortably, so a sudden nothing means
 * the shot really changed — believe it at once.
 */
export var WIPE_SMALL_H = 0.25;

export function wipeIfEmpty(tracks, personCount, faceCount, emptyStreak, prevMaxH, sceneCut) {
  if (personCount !== 0 || faceCount !== 0) return tracks;
  // MEASURED REGRESSION, r5b f003: requiring two empty passes
  // unconditionally kept a stale CLOSE-UP track alive through a cut to a
  // wide shot, and it rendered as a near-full-frame blur (x 0.086-0.813,
  // y 0-1) - the exact "what even is this mess" failure. Corroboration is
  // only justified where the detectors are actually unreliable, which is
  // at small subject scale. If the last thing we saw was BIG, its
  // disappearance is a cut, not a miss.
  // ...but "big subject vanished" is only evidence of a CUT if the shot
  // actually changed. MEASURED REGRESSION, r8b f009: a naval officer
  // filling the frame (prevMaxH 0.78) tilted his head DOWN for one pass.
  // BlazeFace lost the face, MoveNet reported 0 persons, `big` fired on
  // that single pass, and every track was erased — the frame went from
  // fully covered to a completely sharp opposite-gender man who had
  // never left the shot. Total EXPOSURE from one missed detection.
  //
  // The scene gate already knows the difference and the caller already
  // computes it, so the shortcut now requires corroboration from it: a
  // recent cut means believe the disappearance at once (r5b), no cut
  // means this is the same shot and a detector miss gets the same two
  // passes of corroboration a small subject gets. Callers that pass no
  // sceneCut keep the old behaviour so the r5b test still pins it.
  // ...and the first attempt at this — requiring two empty passes instead
  // of one when there was no cut — only MOVED the failure, measured in
  // r8b2: f009 gained its patch back and f005 lost its own, because the
  // same man looked down for two consecutive passes instead of one. No
  // pass count is large enough, because the thing being counted is the
  // detector's blindness and not the subject's absence.
  //
  // So with no cut, the eraser stands down entirely and coastStep's TIME
  // window (blurredCoastMs, 900-2000ms, scaled to the verdict cadence)
  // is what ends a stale track. That window is the right instrument: it
  // is wall-clock, it already scales to slow hardware, and it does not
  // pretend that "two blind passes" means "nobody there".
  // The cost is that a genuine ghost over an empty desk now survives up
  // to its coast window instead of ~800ms. Taken deliberately: the owner
  // ranks EXPOSURE above GHOST, and both of this eraser's own measured
  // misfires (R5's stage of ~40 people, r8b's officer) were it erasing
  // people who were still there.
  if (sceneCut === false) return tracks;
  var big = typeof prevMaxH === 'number' && prevMaxH >= WIPE_SMALL_H;
  if (big) return [];
  // Undefined streak keeps the original single-pass contract so callers
  // that genuinely know the frame is empty (and every existing test) are
  // unaffected; the live pipeline passes its real count.
  var streak = typeof emptyStreak === 'number' ? emptyStreak : WIPE_EMPTY_STREAK;
  return streak >= WIPE_EMPTY_STREAK ? [] : tracks;
}

/**
 * Two observations describing the SAME human in one pass.
 *
 * It happens routinely: MoveNet reports a person, the full-frame face
 * pass finds their face, `faceInsideAny` misses because the face box
 * pokes outside the person box, and personFromFace mints a second
 * person on top of the first. The tracker then keeps two tracks for one
 * body, each drawing its own patch — which is what the owner sees as
 * stacked, seamed, "randomly spawning" boxes.
 *
 * Merging at RENDER time hides the seam but not the cause: two tracks
 * still compete for the same person's gender reads, and a verdict that
 * lands on one of them leaves the other blurred. So they are collapsed
 * here, before association, and the survivor is chosen blur-first: a
 * real verdict beats a position-only sighting, and the larger box wins
 * ties so nothing shrinks off the person.
 */
export function dedupeObservations(observations) {
  var out = [];
  for (var i = 0; i < observations.length; i++) {
    var o = observations[i];
    var dup = -1;
    for (var j = 0; j < out.length; j++) {
      if (containment(o.box, out[j].box) >= MERGE_CONTAIN_MIN) {
        dup = j;
        break;
      }
    }
    if (dup === -1) {
      out.push(o);
      continue;
    }
    out[dup] = preferred(out[dup], o);
  }
  return out;
}

function preferred(a, b) {
  var aV = a.positionOnly ? 0 : 1;
  var bV = b.positionOnly ? 0 : 1;
  if (aV !== bV) return aV > bV ? a : b;
  var areaA = (a.box.x2 - a.box.x1) * (a.box.y2 - a.box.y1);
  var areaB = (b.box.x2 - b.box.x1) * (b.box.y2 - b.box.y1);
  return areaB > areaA ? b : a;
}

/**
 * Largest area ratio at which two boxes can still be the same person
 * between passes. A subject walking toward camera grows smoothly and
 * never comes close to this between two ~400ms passes; a stale patch
 * inherited from a different shot does immediately.
 */
// 3 -> 6, MEASURED r7probe: 30 size-rejections against 26 new tracks in
// eight frames. The gate was firing constantly, and each refusal mints a
// fresh track — which is fatal because CLEAR_STREAK_N needs 2
// CONSECUTIVE certain reads on ONE identity. R7 saw eighteen track ids
// across a single unbroken close-up of one man, who kept earning a clear
// and then losing it to a new id.
//
// The cause is that ONE human has two legitimate representations here: a
// MoveNet body box, and a personFromFace synthetic body (3.6 face-widths
// by 7 face-heights, often clipped at the frame edge). Those differ by
// several times in area, so whenever the observation source flipped
// between passes the gate declared them different people.
//
// 6 still blocks what the gate was built for: the r5f immortal ghost was
// a 0.795x1.0 stale box absorbing a 0.12x0.45 detection, a ratio of ~15.
// It no longer punishes a person for being seen a different way.
export var PTRACK_SIZE_RATIO_MAX = 6;

export function sizeCompatible(a, b) {
  var areaA = Math.max(1e-6, (a.x2 - a.x1) * (a.y2 - a.y1));
  var areaB = Math.max(1e-6, (b.x2 - b.x1) * (b.y2 - b.y1));
  var r = areaA > areaB ? areaA / areaB : areaB / areaA;
  return r <= PTRACK_SIZE_RATIO_MAX;
}

export function updatePersonTracks(tracks, observations, dtMs) {
  observations = dedupeObservations(observations);
  var dt = dtMs > 0 ? dtMs : 250;
  var pairs = [];
  var i, j;
  for (i = 0; i < tracks.length; i++) {
    for (j = 0; j < observations.length; j++) {
      var v = iou(tracks[i].box, observations[j].box);
      if (v < PTRACK_IOU_MIN) continue;
      // SIZE COMPATIBILITY, measured r5f f003. An oversized stale track
      // overlaps everything, so on IoU alone it claims whatever the next
      // pass finds, resets its own miss counter, and becomes immortal —
      // a close-up-sized box left over from before a cut kept absorbing
      // wide-shot detections and rendered as a near-full-frame blur that
      // never expired. Two boxes that differ this much in area are not
      // the same person seen twice; refusing the match lets the stale
      // one die on its coast timer and the real detection start a clean
      // track.
      if (!sizeCompatible(tracks[i].box, observations[j].box)) {
        bump('sizeRejected');
        continue;
      }
      pairs.push({ t: i, o: j, iou: v });
    }
  }
  pairs.sort(function (a, b) {
    return b.iou - a.iou;
  });
  var trackClaimed = new Array(tracks.length).fill(false);
  var obsClaimed = new Array(observations.length).fill(false);
  var next = [];
  for (var p = 0; p < pairs.length; p++) {
    var pair = pairs[p];
    if (trackClaimed[pair.t] || obsClaimed[pair.o]) continue;
    trackClaimed[pair.t] = true;
    obsClaimed[pair.o] = true;
    next.push(matchedStep(tracks[pair.t], observations[pair.o], dt));
  }
  for (i = 0; i < tracks.length; i++) {
    if (trackClaimed[i]) continue;
    var coasted = coastStep(tracks[i], dt);
    if (coasted) next.push(coasted);
  }
  for (j = 0; j < observations.length; j++) {
    if (obsClaimed[j]) continue;
    bump('newTrack');
    next.push(newTrack(observations[j]));
  }
  return next;
}

// NOTE (review F4, deliberately NOT implemented): expiring blurred
// tracks that never produce a face would also uncover a person standing
// with their back to camera — the exact case blur-first exists for. The
// phantom problem it targeted is fixed at the SOURCE instead: a MoveNet
// slot is only a person with a real box score, enough confident
// keypoints, and a head or both shoulders (person-gate.mjs). Tracks
// still carry facelessReads for diagnosis.

function matchedStep(t, obs, dt) {
  var smoothed = ema(t.box, obs.box, PTRACK_EMA_ALPHA);
  var tc = center(t.box);
  var sc = center(smoothed);
  var state = t.state;
  var clearMs = t.clearMs;
  // Position-only observation (the fast pass between gender reads):
  // move the box, leave verdict state and clear credit untouched.
  if (obs.positionOnly) {
    return {
      id: t.id,
      box: smoothed,
      vx: ((sc[0] - tc[0]) / dt) * 1000,
      vy: ((sc[1] - tc[1]) / dt) * 1000,
      vw: sizeVel(t.box, smoothed, dt, 'x'),
      vh: sizeVel(t.box, smoothed, dt, 'y'),
      state: state,
      clearMs: clearMs,
      missMs: 0,
      clearAge: t.clearAge || 0,
      facelessReads: t.facelessReads || 0,
      clearStreak: t.clearStreak || 0,
      flagStreak: t.flagStreak || 0,
      desc: t.desc || null,
      lastVerdict: t.lastVerdict || 'uncertain',
    };
  }
  // Verdict time-step: gender reads arrive at their own (slower)
  // cadence — credit moves by the gap between READS (obs.verdictDt),
  // not the pass interval, so the split cadence keeps the hold honest.
  var vdt = typeof obs.verdictDt === 'number' ? obs.verdictDt : dt;
  var flagStreak = t.flagStreak || 0;
  var clearStreak = t.clearStreak || 0;
  var clearAge = t.clearAge || 0;
  var facelessReads = obs.faceFound ? 0 : (t.facelessReads || 0) + 1;
  // Identity continuity check FIRST (review A1): if this read's face
  // descriptor contradicts the track's, someone else is standing here —
  // all verdict trust resets, blur-first for whoever this now is.
  var sameSim = obs.desc && t.desc ? cosineSim(obs.desc, t.desc) : null;
  // Calibration probe (review B): sim of CONSECUTIVE reads of the same
  // tracked person = the intra-person band.
  if (sameSim !== null && typeof globalThis !== 'undefined' && globalThis.__TS_GAZE_IDS) {
    var dbgS = globalThis.__TS_GAZE_IDS;
    dbgS.intra = dbgS.intra || [];
    dbgS.intra.push(Math.round(sameSim * 100) / 100);
    if (dbgS.intra.length > 400) dbgS.intra.shift();
  }
  var identityBroken = sameSim !== null && sameSim < IDENT_SIM_MIN;
  if (identityBroken) {
    bump(t.state === 'cleared' ? 'identityBrokeCleared' : 'identityBroke');
    // SNAP, do not glide. Measured r5g f003: at a cut from a close-up to
    // a wide stage shot, the close-up track's descriptor stopped
    // matching — correctly, it is a different view of a different size —
    // and the verdict reset to blurred. But the BOX kept EMA-gliding
    // from its close-up geometry, so for one pass the new blur was
    // painted at the old shot's scale: a near-full-frame patch over a
    // speaker who occupies 12% of it.
    //
    // If we have just decided this is not the same person, the stale
    // geometry has no more claim to be right than the stale verdict did.
    // Adopt the observation's box outright and let the smoothing restart
    // from there.
    smoothed = {
      x1: obs.box.x1,
      y1: obs.box.y1,
      x2: obs.box.x2,
      y2: obs.box.y2,
    };
    sc = center(smoothed);
    state = 'blurred';
    clearMs = 0;
    flagStreak = 0;
    clearStreak = 0;
    clearAge = 0;
  }
  if (obs.flagged && obs.certain) {
    // Positive opposite-gender reading: instant blur — EXCEPT on a
    // track that already EARNED its clear (served the full hold): the
    // gender model sways on angled/blurred faces (owner 2026-08-24),
    // and one noisy opposite read was re-blurring the cleared person
    // over and over. An earned clear takes 2 consecutive certain
    // opposite reads to revoke (~one verdict interval of risk on
    // someone who already passed the bar — bounded, and a child can
    // never be on this path: the age gate blocks earning a clear).
    flagStreak += 1;
    if (state !== 'cleared' || flagStreak >= 2) {
      state = 'blurred';
      clearMs = 0;
    }
  } else if (!obs.flagged && obs.certain) {
    // Confident same-gender reading accumulates toward the clear hold —
    // and CLEAR_STREAK_N consecutive ones clear outright (fast clear).
    clearMs += vdt;
    clearStreak += 1;
    // A read at GENDER_INSTANT_CLEAR is enough on its own. Measured in
    // R9: every gender read of a two-man interview was male at 0.71-0.99
    // and three of ten frames were STILL falsely covered, because a fresh
    // track needs a second consecutive read and handheld two-shots mint
    // fresh tracks constantly (7 newTrack in 10 frames). Waiting a second
    // pass to re-ask a question already answered at 0.97 is what the
    // owner sees as "it keeps blurring me".
    if (
      state === 'blurred' &&
      (obs.instant || clearMs >= CLEAR_HOLD_MS || clearStreak >= CLEAR_STREAK_N)
    ) {
      state = 'cleared';
    }
  } else if (state === 'blurred') {
    // Uncertain while blurred: not evidence either way — decay the
    // accumulated credit rather than zero it (see CLEAR_DECAY).
    clearMs = Math.max(0, clearMs - vdt * CLEAR_DECAY);
  }
  // Uncertain while cleared: absorbed — but only for so long. A cleared
  // track must re-prove itself with a confident same-gender read within
  // CLEARED_TTL_MS or it reverts to blurred (review A1: absorption was
  // unbounded, and a child who slipped onto a cleared track — whose
  // reads are structurally uncertain — stayed exposed indefinitely).
  if (state === 'cleared') {
    if (!obs.flagged && obs.certain) {
      clearAge = 0;
    } else {
      clearAge += vdt;
      if (clearAge >= CLEARED_TTL_MS) {
        bump('ttlDemote');
        state = 'blurred';
        clearMs = 0;
        clearAge = 0;
      }
    }
  }
  // Identity memory, BLUR direction only (see MEM_SIM_FLAG): a face
  // matching someone previously read as certainly opposite-gender is
  // covered again immediately, without re-earning the verdict.
  if (obs.remembered === 'blurred') {
    state = 'blurred';
    clearMs = 0;
    clearStreak = 0;
  }
  return {
    id: t.id,
    box: smoothed,
    vx: ((sc[0] - tc[0]) / dt) * 1000,
    vy: ((sc[1] - tc[1]) / dt) * 1000,
    vw: sizeVel(t.box, smoothed, dt, 'x'),
    vh: sizeVel(t.box, smoothed, dt, 'y'),
    state: state,
    clearMs: clearMs,
    missMs: 0,
    clearAge: clearAge,
    // DECREMENT, don't erase. An UNCERTAIN read is treated as non-evidence
    // everywhere else in this module (see CLEAR_DECAY) — zeroing the
    // streak treated it as evidence AGAINST, which contradicts that and
    // is what turned a 40%-certain read rate into ~6 seconds of false
    // cover on the R6 panel woman. Expected reads to reach 2 drops from
    // ~8.75 to ~4 at that rate.
    // A CERTAIN OPPOSITE read still hard-blurs instantly upstream, so
    // this loosens only the ambiguous case, and CLEARED_TTL_MS still
    // bounds how long an unrefreshed clear survives.
    clearStreak:
      !obs.flagged && obs.certain
        ? clearStreak
        : obs.flagged && obs.certain
          ? 0
          : Math.max(0, (t.clearStreak || 0) - 1),
    flagStreak: obs.flagged && obs.certain ? flagStreak : 0,
    desc: obs.desc || t.desc || null,
    lastVerdict: obs.flagged && obs.certain ? 'flag-certain' : !obs.flagged && obs.certain ? 'clear-certain' : 'uncertain',
  };
}

// Size velocity (normalized units/s) so the overlay can keep GROWING a
// patch between passes — a person walking toward camera or throwing
// their arms out scales faster than the pass cadence (owner ask
// 2026-08-24: "change the scale according to if the person is scaling
// up or his hands are moving").
function sizeVel(prev, next, dt, axis) {
  var p = axis === 'x' ? prev.x2 - prev.x1 : prev.y2 - prev.y1;
  var n = axis === 'x' ? next.x2 - next.x1 : next.y2 - next.y1;
  return ((n - p) / dt) * 1000;
}

// A BLURRED track lingers 3x longer before expiring: silently dropping
// a covered person on detector misses (back-of-head close-up = 0
// persons AND 0 faces) uncovered them by timeout (review A5). A cleared
// track expiring early costs nothing.
// A BLURRED track coasts longer than a cleared one — losing a covered
// person for a moment must not expose them. But 3000ms was far too
// generous: owner frame 2026-08-25 shows an overhead desk shot with NO
// people in it carrying four stacked ghost patches, all of them tracks
// coasting on evidence that stopped existing seconds earlier. A patch
// with nothing under it is not protection, it is the bug.
export var PTRACK_MAX_MISS_BLURRED_MS = 900;

// 900ms is denominated in WALL time, but a track that only the verdict
// pass can refresh gets fed at the verdict cadence — and that cadence is
// adaptive (effZoom = max(400, lastVerdictMs * 1.5)). On this desktop
// that is 400ms, so 900ms buys two chances and the constant looks fine.
// On the target Helio G88, a 600-1000ms verdict makes effZoom 900-1500ms:
// the limit expires BEFORE the next verdict pass can arrive, so a covered
// person's patch would drop out between every single pass. That is a
// phone-only flicker that no desktop round can ever reproduce.
//
// So the floor stays 900 and the limit becomes cadence-aware. On desktop
// this changes almost nothing (1000 vs 900), which is deliberate: the
// ghost behaviour that 900 was tuned against is desktop-measured and must
// not regress. It only opens up where the pass is genuinely slow.
var blurredCoastMs = PTRACK_MAX_MISS_BLURRED_MS;

/** Tell the tracker the current verdict cadence, in ms. */
// ...but CAPPED. effZoom is max(400, lastVerdictMs * 1.5) and has no
// upper bound, so a slow pass feeds straight into coast length: this
// desktop's worst verdict of 1618ms already implies effZoom 2427 and a
// 6-SECOND coast, and a phone at 3-4s verdicts would carry a stale patch
// for 10-15s. Every ghost complaint scales with this number, so the
// cadence may lengthen the window but not without limit.
export var PTRACK_MAX_COAST_MS = 2000;

// ...but the CAP cannot be a flat constant, because it is capping a
// number the cadence produces. R8's critic found the interaction and the
// arithmetic checks out: once effZoom exceeds 800ms, 2.5*effZoom exceeds
// the 2000 cap, and once effZoom exceeds 2000ms the coast window is
// SHORTER THAN ONE VERDICT INTERVAL. A single 5973ms verdict pass (R8
// run A, measured) puts the next verdict 8960ms away with every blurred
// track's coast pinned at 2000ms — and `sampling` blocks position passes
// for the whole verdict, so nothing refreshes them either. The covered
// opposite-gender person is sharp for ~7 seconds. That is EXPOSURE, the
// worst class, produced purely by two constants disagreeing, and it
// fires ROUTINELY on a G88 (p95 2-3s) while never once firing on this
// desktop — which is exactly why nine rounds of desktop frames missed it.
//
// So the cap floors at two verdict intervals: the window may never be
// too short to reach the next pass. On desktop (effZoom 400) the floor
// is 800, well under 2000, so the desktop-measured ghost tuning is
// untouched — the change only opens up where the pass is genuinely slow,
// which is where the exposure was.
export var PTRACK_MIN_COAST_PASSES = 2;

// The CLEARED limit needs exactly the same treatment, and not giving it
// the same treatment was the mirror of the bug above (R9 critic). `dt` is
// `now - lastPassAt` with `now` taken at pass START, so dt for pass N+1
// includes pass N's full cost, and `sampling` blocks every position pass
// for the duration of a verdict pass. Against a FLAT 1000ms limit:
//
//   verdict  120ms (this desktop p50) -> dt ~250ms  -> survives 4 misses
//   verdict 2109ms (R8 run B max)     -> dt ~2.5s   -> DELETED on ONE miss
//   verdict 3000ms (plausible G88)    -> dt ~3.4s   -> DELETED, every time
//
// A deleted cleared track's person is re-detected on the next pass and
// gets `newTrack`, which starts BLURRED. So a cleared same-gender man is
// re-covered after every slow verdict pass, on the phone, forever — and
// never once on this desktop, which is why ten rounds of desktop frames
// missed it. At effZoom 400 the formula returns max(1000, 2.5*400) = 1000,
// i.e. desktop behaviour is unchanged by construction; it only opens up
// where the pass is genuinely slow, which is where the failure was.
//
// The new risk — a cleared track surviving longer without evidence — is
// bounded by advancing `clearAge` during coast (see coastStep), so
// CLEARED_TTL_MS still expires a clear nobody has re-confirmed.
var clearedCoastMs = PTRACK_MAX_MISS_MS;

export function setVerdictCadence(effZoomMs) {
  var ms = typeof effZoomMs === 'number' && effZoomMs > 0 ? effZoomMs : 0;
  var cap = Math.max(PTRACK_MAX_COAST_MS, Math.round(PTRACK_MIN_COAST_PASSES * ms));
  blurredCoastMs = Math.min(cap, Math.max(PTRACK_MAX_MISS_BLURRED_MS, Math.round(2.5 * ms)));
  clearedCoastMs = Math.min(cap, Math.max(PTRACK_MAX_MISS_MS, Math.round(2.5 * ms)));
}

function coastStep(t, dt) {
  var missMs = t.missMs + dt;
  var limit = t.state === 'blurred' ? blurredCoastMs : clearedCoastMs;
  if (missMs > limit) return null;
  var dx = ((t.vx || 0) * dt) / 1000;
  var dy = ((t.vy || 0) * dt) / 1000;
  return {
    id: t.id,
    box: {
      x1: Math.max(0, Math.min(1, t.box.x1 + dx)),
      y1: Math.max(0, Math.min(1, t.box.y1 + dy)),
      x2: Math.max(0, Math.min(1, t.box.x2 + dx)),
      y2: Math.max(0, Math.min(1, t.box.y2 + dy)),
    },
    vx: (t.vx || 0) * 0.7,
    vy: (t.vy || 0) * 0.7,
    vw: (t.vw || 0) * 0.7,
    vh: (t.vh || 0) * 0.7,
    state: t.state,
    // A coasting track's clear hold does not advance (no evidence).
    clearMs: t.state === 'blurred' ? 0 : t.clearMs,
    missMs: missMs,
    // Coasting ADVANCES the clear's age even though it does not advance
    // its hold: absence of evidence must still age a clear out, or the
    // longer cleared-coast window above would let an unconfirmed clear
    // ride indefinitely on a slow device.
    clearAge: (t.clearAge || 0) + (t.state === 'cleared' ? dt : 0),
    facelessReads: t.facelessReads || 0,
    clearStreak: t.clearStreak || 0,
    flagStreak: t.flagStreak || 0,
    desc: t.desc || null,
    lastVerdict: t.lastVerdict || 'uncertain',
  };
}

/**
 * Scene-cut demotion (review C2 — replaces the track WIPE): boxes are
 * kept so existing patches persist through the pass gap, but every
 * verdict state resets to blurred-with-no-credit and the descriptor is
 * dropped — whoever stands there in the new shot is unknown ⇒ covered,
 * and identity memory decides fast re-clears, not stale association.
 */
export function demoteTracks(tracks) {
  var out = [];
  for (var i = 0; i < tracks.length; i++) {
    var t = tracks[i];
    out.push({
      id: t.id,
      box: t.box,
      vx: 0,
      vy: 0,
      vw: 0,
      vh: 0,
      state: 'blurred',
      clearMs: 0,
      missMs: 0,
      clearAge: 0,
      facelessReads: t.facelessReads || 0,
      clearStreak: 0,
      flagStreak: 0,
      desc: null,
      lastVerdict: 'uncertain',
    });
  }
  return out;
}

function newTrack(obs) {
  return {
    id: nextTrackId++,
    box: {
      x1: obs.box.x1,
      y1: obs.box.y1,
      x2: obs.box.x2,
      y2: obs.box.y2,
    },
    vx: 0,
    vy: 0,
    vw: 0,
    vh: 0,
    // Unknown ⇒ covered from the first observation, always. Memory
    // cannot shortcut this (identity similarity is not separable —
    // see MEM_SIM_FLAG); the fast-clear streak is what lifts blur off
    // a correctly-read same-gender adult within ~0.8s.
    state: 'blurred',
    clearMs: 0,
    missMs: 0,
    clearAge: 0,
    clearStreak: !obs.flagged && obs.certain && obs.remembered !== 'blurred' ? 1 : 0,
    flagStreak: 0,
    desc: obs.desc || null,
    lastVerdict:
      obs.flagged && obs.certain
        ? 'flag-certain'
        : !obs.flagged && obs.certain
          ? 'clear-certain'
          : 'uncertain',
  };
}

/**
 * Render list: padded boxes (+ velocities for the overlay interpolator)
 * of every track whose STATE is blurred. State, not per-sample verdict —
 * this is the hysteresis boundary.
 */
export function blurredTracks(tracks) {
  var out = [];
  for (var i = 0; i < tracks.length; i++) {
    var t = tracks[i];
    if (t.state !== 'blurred') continue;
    var w = t.box.x2 - t.box.x1;
    var h = t.box.y2 - t.box.y1;
    out.push({
      key: String(t.id || 0),
      box: {
        x1: Math.max(0, t.box.x1 - w * PTRACK_PAD),
        y1: Math.max(0, t.box.y1 - h * PTRACK_PAD_TOP),
        x2: Math.min(1, t.box.x2 + w * PTRACK_PAD),
        y2: Math.min(1, t.box.y2 + h * PTRACK_PAD),
      },
      vx: t.vx,
      vy: t.vy,
      vw: t.vw || 0,
      vh: t.vh || 0,
    });
  }
  return mergeTracks(out);
}

// Overlapping patches union into ONE (owner 2026-08-24: "if there are
// two blurs you could even merge them" — two swapping/overlapping
// squares over a close pair read as chaos; one patch over both reads
// as intended). Iterates until stable, velocities averaged.
// Merge ONLY genuinely-coincident patches. A 2% abutment margin (and
// before that, any overlap at all) unioned two side-by-side people into
// one frame-wide rectangle — measured 2026-08-25 at 66% of frame area
// for a two-shot, and it is the direct mechanism by which a CLEARED man
// ends up under a blur. Two people standing together must stay two
// patches; only near-duplicate boxes of the SAME person merge.
export var MERGE_IOU_MIN = 0.5;
// Containment threshold: intersection over the SMALLER box's area.
// IoU alone is the wrong test for stacked patches. Two patches on the
// same person are often very different sizes — a full-body track and a
// head-and-shoulders one — and IoU punishes that size difference hard
// enough that they never merge, so the player shows two boxes with a
// visible seam down the middle of one person. Owner frame
// runs/r2b-woman/f008: three stacked patches over two people, read by
// him as "boxes spawn randomly and float around". Intersection over the
// smaller area asks the question that actually matters — is this patch
// essentially inside that one — and it stays near zero for people
// standing side by side, so they still get their own patches.
export var MERGE_CONTAIN_MIN = 0.6;
export function containment(a, b) {
  var iw = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  var ih = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  var inter = iw * ih;
  if (inter <= 0) return 0;
  var areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  var areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  var small = Math.min(areaA, areaB);
  return small > 0 ? inter / small : 0;
}
function overlaps(a, b) {
  return iou(a, b) >= MERGE_IOU_MIN || containment(a, b) >= MERGE_CONTAIN_MIN;
}

export function mergeTracks(list) {
  var merged = list.slice();
  var changed = true;
  while (changed) {
    changed = false;
    outer: for (var i = 0; i < merged.length; i++) {
      for (var j = i + 1; j < merged.length; j++) {
        if (!overlaps(merged[i].box, merged[j].box)) continue;
        var a = merged[i];
        var b = merged[j];
        merged[i] = {
          key: [a.key, b.key].filter(Boolean).sort().join('+'),
          box: {
            x1: Math.min(a.box.x1, b.box.x1),
            y1: Math.min(a.box.y1, b.box.y1),
            x2: Math.max(a.box.x2, b.box.x2),
            y2: Math.max(a.box.y2, b.box.y2),
          },
          vx: (a.vx + b.vx) / 2,
          vy: (a.vy + b.vy) / 2,
          vw: ((a.vw || 0) + (b.vw || 0)) / 2,
          vh: ((a.vh || 0) + (b.vh || 0)) / 2,
        };
        merged.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }
  return merged;
}
