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
// How fast a box may SHRINK across an observation-source flip. See the
// note in matchedStep: slower shrink only ever over-covers.
export var PTRACK_FLIP_SHRINK_ALPHA = 0.2;
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
// WEAK-EVIDENCE CLEAR (S6): BUILT, MEASURED, AND REFUSED ON A FRAME.
// Do not propose it again without reading this.
//
// The idea: on a wide multi-person shot faceres' certainty collapses with
// face size while its DIRECTION stays right (measured, runs/s6-cook-man,
// 76 unique reads: every read at native px >= 241 scored 0.84-0.95, every
// read at px 85-174 scored 0.03-0.58, i.e. below the clear bar). So one
// track in four or five ever produced a certain read and blur-first
// covered everybody else: 16 FALSE COVER instances across 10 frames, all
// three men in shot, on the owner's OWN direction. The proposed fix was
// to accumulate this many CONSECUTIVE same-direction reads that are
// directed, adult and non-null but BELOW the clear bar, and clear on
// them; any read that was not same-direction zeroed the streak.
//
// IT EXPOSED A CHILD, ON THE CANONICAL BASELINE VIDEO, IN TWO FRAMES.
// runs/s6e-base-man, NWoT1ZVd1Lo t=560, `man`: track 7 reached the streak
// and cleared at f001 (`ws:4`), and f001/f002 show the owner's daughter
// FULLY SHARP, f002 with no patch anywhere in the frame. The child gate
// cannot stop this: it demands childP < GENDER_CHILD_MASS 0.25, and R18
// measured a known 8-year-old's childP at 0.15-0.72 (median 0.42), so a
// minority of her reads pass it. The CERTAIN path survived that for six
// rounds only because it ALSO demands score >= GENDER_CLEAR_SCORE 0.6,
// and those same reads do not reach it. Lowering the certainty bar
// removes the second lock while leaving the first one leaky.
//
// So consistency does NOT substitute for certainty here, and the reason
// is structural rather than a mis-set constant: the two gates are not
// independent, and the weak band is exactly where the child reads live.
// The FALSE COVER problem above is real and still open, but its fix has
// to come from a better read on a small face, not from a lower bar on a
// bad one.
//
// What survives is measurement only: the streak is still counted and
// still reported (`ws` on the tracks probe, `weakBump`/`weakZero`/
// `weakWouldClear` in `life`), so a future round can size the population
// this rule would have touched without shipping it.
//
// R23 RE-PROPOSED THIS WITH A TIGHTER AGE GATE AND REFUSED IT AGAIN, for
// a different reason than S6 gave, so the next round does not think it
// has found a loophole. The proposal: since S6's failure was the child
// gate leaking (`childP < GENDER_CHILD_MASS 0.25` against an 8-year-old
// measured at 0.15-0.72), require every read in the weak streak to sit
// below the child's measured MINIMUM instead -- childP < 0.15 excludes
// 100% of R18's child reads and still admits 9 of 16 weak adult male
// reads measured on rotation entry 5.
//
// Refused because that constant is fitted to one child's observed
// minimum, from one round, on one video. R22 refused two person-gate
// rules on exactly this shape (a 10px gap in 17 samples from two videos;
// a 0.001-wide empty band) and the cost of being wrong here is strictly
// worse: the failure mode is a child rendered SHARP, which is the worst
// outcome this project has. A second child reading childP 0.08 defeats
// it silently and nothing in the pipeline would ever report that it had.
// The clear side does not get a threshold fitted to n=1.
export var GENDER_WEAK_STREAK_N = 4;

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
/**
 * Life counter from outside this module (S6). Same guarded increment,
 * same `life` bag, so the harness's existing `life_window` delta picks it
 * up with no harness change — and a probe still cannot throw.
 */
export function bumpLife(key) {
  bump(key);
}

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

// Grow at `a`, shrink at `shrinkA`, per edge. "Grow" means the edge moves
// OUTWARD from the box's own centre, so this is a size test and not a
// direction test -- a translating box moves both edges the same way and
// so gets one grow and one shrink, which is correct: it converges at the
// mean of the two rates and keeps its extent.
function emaAsymmetric(prev, next, a, shrinkA) {
  var cx = (prev.x1 + prev.x2) / 2;
  var cy = (prev.y1 + prev.y2) / 2;
  function edge(p, n, outwardIsLess) {
    var grows = outwardIsLess ? n < p : n > p;
    return p + (n - p) * (grows ? a : shrinkA);
  }
  return {
    x1: edge(prev.x1, next.x1, true),
    y1: edge(prev.y1, next.y1, true),
    x2: edge(prev.x2, next.x2, false),
    y2: edge(prev.y2, next.y2, false),
  };
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
/**
 * HEAD-ANCHOR GUARD (gauntlet R17). Containment alone cannot tell one
 * person's two representations from two people standing side by side,
 * and getting that wrong DELETES a human: the loser's observation and
 * the gender verdict already paid for it are discarded, their track gets
 * nothing, coasts, and expires — after which the next sighting mints a
 * fresh track, which starts BLURRED.
 *
 * It is not hypothetical geometry. `personFromFace` paints a body
 * 4.4 face-heights wide, so on a chest-up two-shot each synthetic body
 * is 0.7-0.9 of the frame width and both get clamped at the frame edge,
 * which SHRINKS the smaller area and so RAISES containment. At
 * h_face 0.18 the pair sits at containment 0.50 and survives; at 0.22 it
 * is 0.67 and merges. Knife-edge on framing, which is why it fires on
 * some passes of a static shot and not others.
 *
 * Both sources already carry a head anchor — parsePersons averages the
 * confident head keypoints, personFromFace uses the face centre — and
 * nothing consulted it. Two heads half a body-width apart are two
 * people no matter how far their extrapolated torsos overlap.
 *
 * Deliberately inert when either anchor is null (a back-turned MoveNet
 * person has no head keypoints): there the old behaviour stands, because
 * a merge refused on no evidence is a second patch on one body, which is
 * the failure this dedupe was built to stop.
 *
 * TRIED AND REVERTED IN R18, with the measurement, so the next round does
 * not rebuild it. R18's critic pointed out — correctly — that
 * person-gate's new weak tier makes headX null for 59% of admitted
 * persons, so this guard is now SKIPPED on the majority of pairs, and
 * `dedupeMerged` went 8 -> 82 per 15s window the moment the tier landed.
 * The proposed fix was to fall back to the box's centre-x. It was built
 * and measured and it does nothing:
 *   * `dedupeMerged` 82 -> 83. Coverage of the classroom's children was
 *     unchanged frame for frame.
 *   * The arithmetic says why. Two boxes only reach this guard if
 *     containment >= 0.6, and heavy overlap drags their CENTRES together
 *     in proportion: the R17 side-by-side pair whose HEADS sit 0.46 apart
 *     have centres 0.246 apart against a 0.377 bar. The centre of an
 *     overlapping box is not a weak version of a head anchor, it is a
 *     measurement of the overlap itself.
 * There is a better reason it did nothing, and it is the one to keep: a
 * weak-tier box is MoveNet's raw box with no keypoint union (nothing it
 * carries clears PERSON_KEYPOINT_MIN), so it is tight. The pathological
 * merges this guard exists for come from personFromFace's sprawling
 * synthetic bodies — and those all HAVE head anchors, because a face is
 * what built them. The null-head population is precisely the population
 * that does not need the guard.
 */
export var MERGE_HEAD_SEP = 0.5; // in units of the narrower box's width

/**
 * Head separation bar when BOTH boxes carry a head width, in units of
 * the WIDER head (gauntlet R19).
 *
 * MERGE_HEAD_SEP above is denominated in the narrower BODY width, and
 * that is the wrong ruler in the exact way that matters: a body box
 * sprawls (MoveNet's keypoint union leaks a wrist onto a neighbour,
 * personFromFace extrapolates 3.9 face-heights per side), so the
 * guard's tolerance GROWS with the sprawl it exists to catch. Two people
 * shoulder to shoulder always have heads closer than half a body width,
 * so the guard could never fire on them.
 *
 * Measured, runs/r19-man f003, three humans in frame:
 *   containment(child, man) = 0.726, heads 0.15 apart,
 *   old bar = 0.5 x min(0.579, 0.588) = 0.290  -> MERGED
 * and `preferred` keeps the larger box, so the CHILD's observation and
 * the gender read already paid for it are discarded. `dedupeMerged` ran
 * 9 -> 115 over 13.7s, about one deletion per pass, and which of the
 * three people died was decided by iteration order rather than by
 * evidence. runs/r19d-man f002 is what that looks like on screen: two
 * tracks for three humans, and the child fully sharp. EXPOSURE.
 *
 * Head widths there are 0.125 (man) and 0.092 (child); at 1.0 x the
 * wider the bar is 0.125 against a 0.15 separation, so they stay two
 * people. Heads are rigid and cannot overlap, so different people sit
 * at >= ~1.5 head widths while two REPRESENTATIONS of one person (a
 * MoveNet keypoint average against a BlazeFace face centre) disagree by
 * a fraction of one. 1.0 sits between those populations.
 *
 * Strictly stricter than the old rule on every pair it applies to
 * (0.125 against 0.290 here), and refusing a merge can only ever ADD a
 * patch, never remove one -- so the class this can regress is the
 * stacked-patch cosmetic complaint MERGE_CONTAIN_MIN was built for, not
 * exposure. Watch `dedupeMerged` per pass in the next round.
 *
 * Falls back to the body rule when either side has no head: that is the
 * weak-tier population (R18 measured 59% null headX), whose boxes are
 * MoveNet's raw ones with no keypoint union, so they do not sprawl and
 * the old rule is not wrong about them.
 */
export var MERGE_HEAD_SEP_HEADW = 1.0;

export function sameHuman(a, b) {
  if (containment(a.box, b.box) < MERGE_CONTAIN_MIN) return false;
  var ax = a.box.headX;
  var bx = b.box.headX;
  if (typeof ax !== 'number' || typeof bx !== 'number') return true;
  var aw = a.box.headW;
  var bw = b.box.headW;
  if (typeof aw === 'number' && aw > 0 && typeof bw === 'number' && bw > 0) {
    return Math.abs(ax - bx) <= MERGE_HEAD_SEP_HEADW * Math.max(aw, bw);
  }
  var narrow = Math.min(a.box.x2 - a.box.x1, b.box.x2 - b.box.x1);
  return Math.abs(ax - bx) <= MERGE_HEAD_SEP * narrow;
}

export function dedupeObservations(observations) {
  var out = [];
  for (var i = 0; i < observations.length; i++) {
    var o = observations[i];
    var dup = -1;
    for (var j = 0; j < out.length; j++) {
      if (sameHuman(o, out[j])) {
        dup = j;
        break;
      }
      // Contained, but the heads are too far apart to be one person.
      // Counted separately: this is the branch that used to delete a
      // human, and a round has to be able to see how often it fires.
      if (containment(o.box, out[j].box) >= MERGE_CONTAIN_MIN) bump('dedupeHeadSplit');
    }
    if (dup === -1) {
      out.push(o);
      continue;
    }
    bump('dedupeMerged');
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
  // Best IoU each observation achieved against ANY live track, whether or
  // not the pair survived the gates. An observation that mints a new
  // track having scored 0.0 is a genuinely new person; one that scored
  // 0.15 is the SAME person the association threshold just refused, and
  // that difference is the whole of the churn question.
  var bestIou = new Array(observations.length).fill(0);
  // Was this observation ever refused a well-overlapping track purely on
  // size? Needed to attribute a birth below.
  var sizeBlocked = new Array(observations.length).fill(false);
  for (i = 0; i < tracks.length; i++) {
    for (j = 0; j < observations.length; j++) {
      var v = iou(tracks[i].box, observations[j].box);
      if (v > bestIou[j]) bestIou[j] = v;
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
        sizeBlocked[j] = true;
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
    // WHY a track ends, separated. `newTrack` alone cannot distinguish
    // "the detector found an extra person" from "an existing person was
    // dropped and re-minted", and those need opposite fixes.
    if (!coasted) bump('coastExpired');
    if (coasted) next.push(coasted);
  }
  for (j = 0; j < observations.length; j++) {
    if (obsClaimed[j]) continue;
    // Classify the birth by how close it came to matching. A birth at
    // bestIou 0 is a person who was not on screen before; a birth at
    // 0 < iou < PTRACK_IOU_MIN is the SAME person, re-minted because the
    // threshold refused them — that one is churn, and it costs the
    // subject their accumulated clear every time it happens.
    // birthClaimed covered two different causes at once — an
    // observation whose track was taken by a better-scoring pair
    // (contention), and one refused by sizeCompatible. They want
    // opposite fixes, and R17 lost a section of analysis to not being
    // able to tell them apart from the artifact.
    if (bestIou[j] <= 0) bump('birthFresh');
    else if (bestIou[j] < PTRACK_IOU_MIN) bump('birthNearMiss');
    else if (sizeBlocked[j]) bump('birthSizeRejected');
    else bump('birthContended');
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

/**
 * Move a stored head square by the same delta the track's box just
 * moved (gauntlet R19). The fast position-only pass runs several times
 * per gender read, so without this the hole would sit still while the
 * face it belongs to walks out from under it — a sharp rectangle over
 * whatever is behind, which is the DRIFT class wearing a hole's clothes.
 */
function shiftHead(head, from, to) {
  if (!head) return null;
  var dx = (to.x1 + to.x2) / 2 - (from.x1 + from.x2) / 2;
  var dy = (to.y1 + to.y2) / 2 - (from.y1 + from.y2) / 2;
  return { x1: head.x1 + dx, y1: head.y1 + dy, x2: head.x2 + dx, y2: head.y2 + dy };
}

/** Distance a shiftHead moved the hole -- the uncertainty it just added. */
function headShiftDist(from, to) {
  var dx = (to.x1 + to.x2) / 2 - (from.x1 + from.x2) / 2;
  var dy = (to.y1 + to.y2) / 2 - (from.y1 + from.y2) / 2;
  return Math.sqrt(dx * dx + dy * dy);
}

function matchedStep(t, obs, dt) {
  // Did this pass change WHICH detector is describing the person? See the
  // note on vw/vh below -- a source flip is a representation change, not
  // motion, and must not become a size velocity.
  //
  // S8 BUILT AND REFUTED THE OBVIOUS CLEANUP HERE. A position pass is
  // MoveNet by construction, so on a face-derived track it reports a
  // source change on every fast pass and again on the next verdict, for a
  // track whose source never moved -- 105 such events in a 90s run
  // against 51 genuine ones. Suppressing them, and carrying `fromFace`
  // through the position return so the following verdict stopped seeing a
  // phantom flip too, made the patch measurably BUSIER: paired by video
  // time against S7 over 39 buckets, rel-breathe-w 28 busier against 10
  // calmer, mean +0.133 -- several times the pairing noise this section
  // measured in S5.
  //
  // The reason is that the flip is not the event; the DISAGREEMENT is. A
  // MoveNet box and a personFromFace body describe one human and differ
  // 49-69% in width, and that disagreement is present on EVERY pass that
  // mixes them, not only on the transition. The phantom flips were
  // accidentally applying the shrink damper to most of that population,
  // and removing them handed the whole disagreement back to alpha 0.6.
  // So this stays as it is. The correct fix is to gate the damper on the
  // SIZE STEP rather than on provenance, which is a measurement, not a
  // tidy-up, and is the next thing to try here.
  var srcFlip = !!(obs.box && obs.box.fromFace) !== !!t.fromFace;
  if (srcFlip) bump('srcFlip');
  // ON A SOURCE FLIP, SMOOTH THE SIZE HARD -- BUT ONLY INWARD.
  //
  // S4 guarded the size VELOCITY on a flip and bought almost nothing
  // (breathe 0.372 -> 0.359), because the velocity is the derivative and
  // the STEP is the event. A MoveNet box and a personFromFace synthetic
  // body describe one human and, measured against the corpus table in
  // person-gate, now disagree about WIDTH by 49-69% in the face-height
  // band this footage lives in -- they used to agree to within 12%.
  // At alpha 0.6 that whole disagreement lands in the box in ONE pass.
  // Measured over the S4 trace: intervals carrying a flip are 11.5% of
  // all intervals and carry 30.3% of ALL absolute size change, with mean
  // |dw| 3.17x the non-flip intervals.
  //
  // ASYMMETRIC, and that is what makes it safe: GROWING keeps the full
  // alpha, so a person who genuinely got wider is covered as fast as
  // before. Only SHRINKING is slowed, and a patch that shrinks slower is
  // a patch that over-covers for longer -- it cannot open EXPOSURE or
  // PARTIAL. The centre is untouched at full alpha, so the patch still
  // tracks motion and does not trail.
  var smoothed = srcFlip
    ? emaAsymmetric(t.box, obs.box, PTRACK_EMA_ALPHA, PTRACK_FLIP_SHRINK_ALPHA)
    : ema(t.box, obs.box, PTRACK_EMA_ALPHA);
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
      abstainStreak: t.abstainStreak || 0,
      // `weakStreak` WAS THE ONE FIELD THIS RETURN DROPPED, AND IT MADE
      // GENDER_WEAK_STREAK_N STRUCTURALLY UNREACHABLE (S10 open item 5,
      // confirmed by R23's critic and by the counters). Position passes
      // run at the 120ms floor against a 400ms verdict cadence, so 2-3 of
      // them land between every pair of gender reads and each one handed
      // back `undefined`; the next verdict then read `t.weakStreak || 0`
      // as 0. The independent proof needs no code: `weakBump 50` against
      // `weakZero 1` in one window -- if a streak were ever carried, the
      // 12 female and 11 abstained reads in the same window would have
      // fired `weakZero` many times over.
      //
      // BEHAVIOUR IS UNCHANGED BY RESTORING IT: S6 removed the clear this
      // counter fed (it exposed a child) and left the counter as pure
      // measurement. What changes is that the measurement stops reporting
      // on a mechanism that could not run, so a future round sizing that
      // population gets a real number instead of a structural zero.
      weakStreak: t.weakStreak || 0,
      desc: t.desc || null,
      // The head hole rides the position pass so it stays on the face
      // between gender reads, but its AGE still advances: a position
      // observation is not evidence that the face is still there.
      headBox: shiftHead(t.headBox, t.box, smoothed),
      headAgeMs: (t.headAgeMs || 0) + dt,
      headDrift: (t.headDrift || 0) + (t.headBox ? headShiftDist(t.box, smoothed) : 0),
      lastVerdict: t.lastVerdict || 'uncertain',
      // `fromFace` is deliberately NOT carried here -- see the refuted
      // experiment at the top of matchedStep. `headH` is, because it is a
      // MEASUREMENT of the subject rather than a provenance flag: dropped
      // here it would be wiped by every fast pass and the head-scaled top
      // pad would revert to the body fraction one frame after it applied.
      headH: t.headH,
    };
  }
  // Verdict time-step: gender reads arrive at their own (slower)
  // cadence — credit moves by the gap between READS (obs.verdictDt),
  // not the pass interval, so the split cadence keeps the hold honest.
  var vdt = typeof obs.verdictDt === 'number' ? obs.verdictDt : dt;
  var flagStreak = t.flagStreak || 0;
  // How many of `flagStreak`'s contributions were ABSTENTIONS rather than
  // certain opposite reads. Measurement only this round -- it changes no
  // decision, it only makes the mix visible so the next round can decide
  // whether "2 consecutive certain opposite reads" should mean two of the
  // same kind. Carried wherever flagStreak is carried, or the mix would
  // read as pure-certain on every pass after the first.
  var abstainStreak = t.abstainStreak || 0;
  var clearStreak = t.clearStreak || 0;
  var clearAge = t.clearAge || 0;
  var weakStreak = t.weakStreak || 0;
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
    abstainStreak = 0;
    clearStreak = 0;
    clearAge = 0;
    // Someone else is standing here: weak evidence about the previous
    // occupant is evidence about nobody.
    weakStreak = 0;
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
    // A certain opposite read is the strongest contradiction there is, so
    // it kills the weak streak outright — and it must, or the block below
    // would re-clear on the very pass this one blurred (the streak is not
    // zeroed by `faceFound` here because callers on this path do not all
    // set it).
    weakStreak = 0;
    // ...but a track NOBODY HAS SEEN for over a verdict interval has no
    // claim to that protection. The streak exists to absorb one noisy
    // read on THE SAME PERSON; a track that has been coasting is exactly
    // as likely to be someone who walked into the departed person's
    // screen region, and the descriptor cannot tell us otherwise (a
    // back-turned newcomer has desc null, so identityBroken never even
    // runs). Without this, an inherited clear also inherits two-reads-to-
    // revoke, roughly doubling the exposure window it opened with.
    // missMs is 0 on every matched pass, so this is inert on desktop.
    var stale = (t.missMs || 0) > PTRACK_MAX_MISS_MS;
    // A WEAK clear never buys the two-read protection. That protection is
    // for a track that served the full hold on confident reads; a weak
    // clear is held on sub-bar evidence, so one CERTAIN opposite read —
    // strictly stronger evidence than anything that granted it — re-blurs
    // it immediately. Without this, the weak clear would widen the
    // exposure window rather than only the false-cover one.
    if (state !== 'cleared' || flagStreak >= 2 || stale) {
      // COUNT THE REVOCATIONS, SPLIT BY WHAT ACTUALLY REVOKED.
      //
      // S10 measured cleared->blurred on a SURVIVING track at 0.117/s,
      // and this branch was the only cleared->blurred path in the file
      // with no counter at all -- so "which path" was answered by
      // elimination in S9 and by correlation in S10, never directly.
      // Three-way, because the ordinary blurred-track case shares the
      // `if` and must not be counted as a revocation:
      //   flagBlurFresh  - a track that was not cleared. Not a revoke.
      //   flagDemoteStale - `stale` fired: ONE read revoked an earned
      //     clear with no streak. Must read 0 on desktop (missMs is 0 on
      //     every matched pass and coastStep deletes above the limit) --
      //     any nonzero here means the reachability argument at `stale`
      //     is wrong, and on the phone that path is live because the
      //     coast budget is cadence-scaled while PTRACK_MAX_MISS_MS is not.
      //   flagDemote     - the streak genuinely reached 2.
      // `mixed` records that the two contributing reads were of DIFFERENT
      // kinds: the design intent written above says "2 consecutive
      // certain opposite reads", but the abstain branch below advances
      // the SAME counter, so one certain flag plus one abstention also
      // revokes. Whether that is a meaningful share is unmeasured, and
      // the constant is not moved until it is.
      if (state !== 'cleared') bump('flagBlurFresh');
      else if (stale && flagStreak < 2) bump('flagDemoteStale');
      else {
        bump('flagDemote');
        if (abstainStreak > 0) bump('flagDemoteMixed');
      }
      state = 'blurred';
      clearMs = 0;
    }
  } else if (obs.abstained && state === 'cleared') {
    // ABSTENTION MUST NOT BUY MORE PROTECTION THAN THE READ IT REPLACED.
    // R12 started refusing the gender model's no-information output (see
    // isNullRead). That was right, but it moved those reads from the
    // branch above — where a cleared track is revoked by 2 consecutive
    // certain flags — into plain `uncertain`, which a cleared track
    // absorbs for the whole CLEARED_TTL_MS. Measured: 4800ms of an
    // opposite-gender subject sharp, against 400ms before the change.
    // The exposure case is a person SWAP: someone walks into a cleared
    // track's box and reads null, so the pipeline is holding a face crop
    // it cannot read on top of somebody else's earned clear.
    //
    // So an abstention advances the same revocation streak a certain flag
    // does, and 2 consecutive ones demote — exactly the pre-R12 bound, on
    // any device, because a streak is cadence-relative and a fixed ms
    // budget is not. It keeps everything the abstention was for: a null
    // still cannot condemn, cannot blur on its own, and cannot enter
    // identity memory.
    //
    // Deliberately NOT extended to plain uncertain reads. An uncertain
    // read is weak evidence pointing somewhere; a null is the model
    // returning its prior. Only the second is a face we demonstrably
    // could not read, and only the second used to be a flag.
    flagStreak += 1;
    abstainStreak += 1;
    if (flagStreak >= 2) {
      bump('abstainDemote');
      if (abstainStreak < flagStreak) bump('abstainDemoteMixed');
      state = 'blurred';
      clearMs = 0;
      weakStreak = 0;
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
  // WEAK-EVIDENCE STREAK (S6) — MEASUREMENT ONLY: this deliberately changes no state. See the
  // GENDER_WEAK_STREAK_N note: the clear transition that used to sit here
  // exposed a child on the baseline video and was removed the same round.
  if (obs.weak) {
    weakStreak = Math.min(GENDER_WEAK_STREAK_N, weakStreak + 1);
    bump('weakBump');
    if (weakStreak >= GENDER_WEAK_STREAK_N) bump('weakWouldClear');
  } else if (obs.faceFound) {
    if (weakStreak) bump('weakZero');
    weakStreak = 0;
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
  // The identity-memory override that used to sit here was DELETED in
  // R13 (the full measurement is in init-entry.js where the bank lived).
  // It read: a track matching a remembered certain-flag is slammed back
  // to blurred unless the current read is a confident clear. It looked
  // like pure fail-safe, and it was the opposite — the bank saturated
  // within seconds and 17% of DIFFERENT-person descriptor pairs score
  // above the threshold, so the entry doing the covering usually
  // belonged to somebody else, and a correctly-read same-gender person
  // was pinned covered for the rest of the video.
  //
  // `obs.remembered` is now ignored everywhere. If you are reintroducing
  // recognition, the bar is a descriptor test whose same-person and
  // different-person distributions actually separate — measure that
  // FIRST, on this footage, before wiring anything to it.
  return {
    id: t.id,
    box: smoothed,
    // PROVENANCE, on the TRACK and not on the box (gauntlet R20).
    // R19 added a `fromFace` flag so a round could ask whether an
    // offending patch came from a MEASURED MoveNet person or from a body
    // extrapolated off a face — and it read it off `track.box.fromFace`,
    // which is never there. `ema` below and `newTrack` both construct a
    // fresh four-field box literal, so every property the observation's
    // box carried is dropped on the first frame of every track's life.
    // Measured by R20's critic: 145 of 145 tracks across six runs report
    // `f: 0`, including a pass whose ONLY observation was `{f:1}`.
    // R19's log used that always-zero field to rule out `preferred`
    // keeping a synthetic body over a measured one. That conclusion was
    // unsupported — not necessarily wrong, but the probe could not have
    // shown it either way, and the next round should re-derive it.
    fromFace: !!(obs.box && obs.box.fromFace),
    // Head HEIGHT rides the track, not the box: ema() returns a bare
    // four-field literal, so anything hung on the box is dropped on the
    // first frame of every track's life. Same lifecycle as fromFace --
    // this is the field topPad() needs, and without it the head-scaled
    // cap is silently inert. Height, not width, because the pad it caps
    // is a y quantity and headW is normalized-x.
    headH: (obs.box && typeof obs.box.headH === 'number' && obs.box.headH > 0)
      ? obs.box.headH
      : t && typeof t.headH === 'number' ? t.headH : undefined,
    vx: ((sc[0] - tc[0]) / dt) * 1000,
    vy: ((sc[1] - tc[1]) / dt) * 1000,
    // SIZE VELOCITY IS MEANINGLESS ACROSS A CHANGE OF OBSERVATION SOURCE,
    // and measuring it there is most of why patches breathe.
    //
    // One human has two legitimate representations that differ several
    // fold in area: a MoveNet body box, and a synthetic body extrapolated
    // from a face by personFromFace. R7 raised PTRACK_SIZE_RATIO_MAX from
    // 3 to 6 precisely so those two would associate with each other, so a
    // matched pass can hand ema() a box up to 6x different in area from
    // the previous one. sizeVel turns that step into a velocity, and
    // interpolateBox then PREDICTS MORE OF IT, outward only, for up to
    // MAX_EXTRAPOLATE_MS. A 0.40 -> 0.70 height step over 400ms yields
    // vh 0.75/s, which grows the patch a further 0.15 on top and bottom
    // before the next pass snaps it back -- an inward step around 20% of
    // the edge's span, far above SHRINK_DEADBAND, so the render-side
    // damping cannot touch it.
    //
    // MEASURED, and it is the one number where the owner's "before any
    // gauntlet run you were better" is literally true: the pre-gauntlet
    // build (92e8fba, bundle v7) breathes 0.229/s against 0.372/s today,
    // on the same 45s of the same video. Patch COUNT went the other way
    // over those 55 commits (max 6 -> 2, dCount 1.22 -> 0.36/s), so the
    // regression is specifically SIZE stability, which is what reads as
    // "not smooth".
    //
    // The track already knows its provenance. A flip is not motion, so it
    // gets no velocity. Real scaling -- someone walking toward camera,
    // arms opening -- keeps its velocity, because there the source is
    // unchanged. Only ever removes PREDICTED GROWTH, so it cannot expose.
    vw: srcFlip ? 0 : sizeVel(t.box, smoothed, dt, 'x'),
    vh: srcFlip ? 0 : sizeVel(t.box, smoothed, dt, 'y'),
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
    // READ THE LOCAL `clearStreak`, NOT `t.clearStreak` (R11). The
    // decrement branch used to reach back to the PREVIOUS track, which
    // silently killed both places above that zero the local one: the
    // identityBroken block (:453) and the memory override (:542). Both
    // exist precisely because a different person is now standing in this
    // box, and both were being undone one line later.
    // The exposure that bought: a track at clearStreak 21 (measured —
    // this counter was also never clamped) suffers an identity break,
    // reads uncertain, and hands back 20. ONE confident same-gender read
    // from the NEW person then satisfies `>= CLEAR_STREAK_N` and clears
    // them. Blur-first says they owe two reads; they paid one.
    // Clamped to CLEAR_STREAK_N because the counter carries no
    // information above the bar — unclamped it made the decrement
    // hysteresis below a no-op for any track cleared more than twice.
    clearStreak: Math.min(
      CLEAR_STREAK_N,
      !obs.flagged && obs.certain
        ? clearStreak
        : obs.flagged && obs.certain
          ? 0
          : Math.max(0, clearStreak - 1)
    ),
    // The streak survives a certain flag OR an abstention — both count
    // against a clear (see the abstainDemote branch). Anything else
    // zeroes it, so only CONSECUTIVE evidence revokes.
    // Clamped, for the reason R11 had to fix the same shape on
    // clearStreak: the ONLY thing ever asked of this counter is
    // `>= 2`, so clamping there is behaviour-identical, and an
    // unbounded counter is a number nobody can read in a diagnostic.
    // R13 measured it at 12 on a single track in ten frames.
    flagStreak: obs.flagged && (obs.certain || obs.abstained) ? Math.min(2, flagStreak) : 0,
    abstainStreak: obs.flagged && (obs.certain || obs.abstained) ? Math.min(2, abstainStreak) : 0,
    // Already clamped and reset above; carried so the next pass sees it.
    weakStreak: weakStreak,
    desc: obs.desc || t.desc || null,
    // A fresh face square resets the age to zero; a verdict pass that
    // found no attributable face keeps the last one and lets it age out.
    headBox: obs.headBox || shiftHead(t.headBox, t.box, smoothed),
    // `dt`, NOT `vdt` (S6 critic finding 5). `vdt` is the gap between
    // GENDER READS; the position-only branch (:608) already added its own
    // `dt` for each of the ~3 position passes inside that gap, so using
    // `vdt` here re-counts them and the hole ages at ~2x real time.
    // Against HEAD_HOLE_MAX_AGE_MS 1000 that retires a cleared man's face
    // window after ~500ms of wall clock, and he is covered by his
    // neighbour's patch again — the owner's second bar, from one token.
    // `headDrift` on the next line is correct as it stands: distance
    // genuinely accrues on both cadences.
    headAgeMs: obs.headBox ? 0 : (t.headAgeMs || 0) + dt,
    headDrift: obs.headBox ? 0 : (t.headDrift || 0) + (t.headBox ? headShiftDist(t.box, smoothed) : 0),
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
  // THE CUT BUDGET IS THE ONE THAT NEVER GOT THIS TREATMENT (S6 critic
  // finding 1). It is compared against `missMs`, which accrues in PASS
  // intervals, so a flat 400ms silently means "fewer passes" the slower
  // the device gets — and a track whose only support is a face (a
  // close-up, or anyone MoveNet drops) is invisible to position passes
  // and can ONLY be refreshed by a verdict. At the target's stated
  // verdict range of 600-1000ms a demoted track therefore dies ~500ms
  // BEFORE the next verdict could see it: one chance, every cut,
  // guaranteed. Measured cost on this desktop: cutCoastExpired 10 of 15
  // total track deaths in a 15s window, against birthFresh 1 — i.e. the
  // system is re-minting people it already had.
  //
  // 1.0x, not the 2.5x above, because a box from the previous shot is
  // genuinely worth less than one from a detector miss (see
  // PTRACK_CUT_COAST_MS). At the desktop cadence (effZoom 400) this
  // evaluates to max(400, 400) = 400, i.e. BYTE-IDENTICAL to the flat
  // constant, so R15's Hell's Kitchen calibration cannot regress here;
  // the change is only ever visible on hardware slower than this.
  cutCoastMs = Math.min(cap, Math.max(PTRACK_CUT_COAST_MS, Math.round(ms)));
}

// A BOX FROM THE PREVIOUS SHOT IS WORTH ONE PASS, NOT THREE.
// demoteTracks keeps the geometry across a cut so coverage survives the
// gap between the cut and the forced pass. It was never meant to keep
// painting the OLD shot's people over the new one, and R15 measured
// exactly that: Hell's Kitchen cuts from a 16-person studio wide shot to
// a one-man close-up, the full-frame pass on the new shot returns ONE
// face (h 0.364) and zero MoveNet persons for two consecutive passes,
// and five patches from the old shot are still on screen — over a
// cloche, an appliance, blue tile, and the man's own eyes.
// The ordinary coast (2.5 verdict passes, ~1000ms) is calibrated for a
// detector MISS, where the box is still probably right. Across a cut the
// box is probably wrong, so the two cases must not share a budget.
// The flag clears itself: matchedStep builds a fresh track object, so a
// demoted track that gets re-observed loses `demoted` and goes straight
// back to the normal budget.
export var PTRACK_CUT_COAST_MS = 400;
// Live value, rescaled by setVerdictCadence. Read the note there.
var cutCoastMs = PTRACK_CUT_COAST_MS;
/** Effective cut-coast budget after cadence scaling (test/diagnostic). */
export function cutCoastBudgetMs() {
  return cutCoastMs;
}

function coastStep(t, dt) {
  var missMs = t.missMs + dt;
  var limit = t.demoted
    ? cutCoastMs
    : t.state === 'blurred'
      ? blurredCoastMs
      : clearedCoastMs;
  if (missMs > limit) {
    if (t.demoted) bump('cutCoastExpired');
    return null;
  }
  // R10 shipped the cadence-aware cleared coast claiming `clearAge`
  // bounded it via CLEARED_TTL_MS. It did not: clearAge was advanced here
  // and then tested only in matchedStep, which a COASTING track by
  // definition never reaches. At effZoom 3000 the window is 6000ms
  // against a 5000ms TTL, so the coast outlived the bound that was
  // supposed to contain it. The cost is not a ghost (a cleared track
  // paints nothing) — it is INHERITANCE: a newcomer entering that screen
  // region associates at IoU 0.2 against the coasted box and starts
  // `cleared`, sharp from frame one with zero reads. That is EXPOSURE,
  // and R10 introduced it. Demote rather than delete: the track is still
  // probably a person, it has simply stopped being a person we have
  // evidence about.
  var state = t.state;
  var clearAge = (t.clearAge || 0) + (state === 'cleared' ? dt : 0);
  if (state === 'cleared' && clearAge >= CLEARED_TTL_MS) state = 'blurred';
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
    state: state,
    // A coasting track's clear hold does not advance (no evidence).
    clearMs: state === 'blurred' ? 0 : t.clearMs,
    missMs: missMs,
    // Coasting ADVANCES the clear's age even though it does not advance
    // its hold: absence of evidence must still age a clear out, or the
    // longer cleared-coast window above would let an unconfirmed clear
    // ride indefinitely on a slow device.
    clearAge: clearAge,
    facelessReads: t.facelessReads || 0,
    clearStreak: t.clearStreak || 0,
    flagStreak: t.flagStreak || 0,
    abstainStreak: t.abstainStreak || 0,
    // A missed pass is not a contradicting read, so the weak streak is
    // CARRIED rather than zeroed — same treatment clearStreak gets. The
    // TTL above is what bounds an unrefreshed weak clear.
    weakStreak: t.weakStreak || 0,
    desc: t.desc || null,
    // Coasting moves the box by velocity, so the head moves with it —
    // and ages, which is what eventually retires the hole.
    headBox: t.headBox
      ? { x1: t.headBox.x1 + dx, y1: t.headBox.y1 + dy, x2: t.headBox.x2 + dx, y2: t.headBox.y2 + dy }
      : null,
    headAgeMs: (t.headAgeMs || 0) + dt,
    headDrift: (t.headDrift || 0) + Math.sqrt(dx * dx + dy * dy),
    lastVerdict: t.lastVerdict || 'uncertain',
    // Carried, or a demoted track would silently regain the full coast
    // budget on its second missed pass — the exact behaviour this is here
    // to remove.
    demoted: !!t.demoted,
    // Provenance survives a coast too, or a track would appear to change
    // origin every time a detector missed it once.
    fromFace: !!t.fromFace,
    headH: t.headH,
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
    // THE COST OF A CUT, COUNTED. `cutDetected` counts cuts; nothing has
    // ever counted how many EARNED clears each one throws away. S10
    // measured 6 of 7 cleared->blurred revocations landing within 0.21s
    // of a cutDetected, which makes this the dominant re-cover path in
    // the man direction -- and the comment at the call site still says
    // "identity memory, not stale association, decides who re-clears",
    // which has been false since R13 deleted identity memory. The
    // demotion itself is correct association hygiene; what is unpriced is
    // that nothing replaced the mechanism that made it cheap.
    var wasCleared = t.state === 'cleared';
    if (wasCleared) bump('cutDemoteCleared');
    // IDENTICAL TO THE LINE ABOVE TODAY, ON PURPOSE. `cutDemoteCleared`
    // is "what the cut destroyed"; `cutBankKept` is "what the bank
    // below preserved". They are the same population only because the
    // bank's gate is exactly `wasCleared` — narrow that gate and the two
    // diverge, and the divergence is the number that prices the change.
    // A run where these differ is a run where the gate moved.
    if (wasCleared) bump('cutBankKept');
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
      // AN EARNED CLEAR IS WORTH ONE RUNG AFTER A CUT. IT USED TO BE
      // WORTH ZERO, AND THAT IS ARITHMETICALLY UNPAYABLE (R23).
      //
      // The clear ladder is `obs.instant || clearMs >= CLEAR_HOLD_MS ||
      // clearStreak >= CLEAR_STREAK_N`, and on fast-cut footage only the
      // streak is live. Measured on rotation entry 5 (`4u3jS_cTHH0`,
      // studio kitchen, 3-4 men + 1 woman, `man` mode): cuts at 0.87/s
      // over 60s, so the mean shot is 1.15s; a person is gender-read on
      // about two of the ~3 verdict passes that fit in one; and the
      // expected number of reads to land TWO CONSECUTIVE successes at
      // that hit rate is several times the shot length. The score was
      // FALSE COVER on 9 frames of 10, and 89.7% of all track-samples
      // sat `blurred` -- in the owner's OWN direction.
      //
      // So the demotion was not merely resetting the counter, it was
      // resetting it faster than it could ever be re-paid. Banking one
      // rung makes the cost of a clear TWO certain reads exactly as
      // before; it just stops the cut from confiscating the first one.
      //
      // GATED ON `state === 'cleared'`, AND THIS IS A DELIBERATE
      // NARROWING OF WHAT R23'S CRITIC PROPOSED. It asked for
      // `state === 'cleared' || lastVerdict === 'clear-certain'`. The
      // second half banks a rung for a track that had paid ONE read and
      // never cleared, which makes a cut cost nothing at all and leaves
      // no earned precondition to point at. A track that reached
      // `cleared` demonstrably paid the full price in the previous shot,
      // and -- this is the part that matters -- reaching `cleared`
      // requires certain reads, which require the age gate, so a CHILD
      // can never bank. S6's derivation is untouched by this line.
      //
      // The exposure it opens, named: a woman who lands on a demoted box
      // (IoU + area gates) and reads `male`, adult, score >= 0.6 ONCE is
      // cleared, where before she owed two such reads. That is the same
      // single-read risk `GENDER_INSTANT_CLEAR` already accepts on a
      // never-seen track, conditioned additionally on a certain read
      // having happened at this screen position in the previous shot.
      // `cutBankKept` counts every bank so the next round can price it.
      clearStreak: wasCleared ? 1 : 0,
      flagStreak: 0,
      abstainStreak: 0,
      // A cut means these pixels are a different shot: every accumulated
      // verdict, weak or not, is about a frame that no longer exists.
      weakStreak: 0,
      // R23 PROPOSED AND REFUSED: keep a SEPARATE `clearedDesc` here (not
      // `desc`, so `identityBroken` stays inert across a cut as designed)
      // and let a demoted track re-clear on the FIRST certain-clear read
      // whose descriptor matches it, instead of paying CLEAR_STREAK_N
      // again. The argument was that R13's 17% false-match figure was a
      // MAX over a growing bank of up to 8 exemplars, and a single
      // exemplar compared once is a different statistic.
      //
      // It is not a different statistic. The bundle has logged both bands
      // all along (`intra` = consecutive reads of the SAME tracked
      // person, `cross` = two persons in the SAME frame, who are
      // definitionally different people) and no round had ever read them.
      // Measured on rotation entry 5, `man`, 60s: intra n=70 p50 0.74,
      // cross n=111 p50 0.38 -- and the tails overlap through the whole
      // useful range:
      //
      //   bar   intra pass (recall)   cross pass (FALSE MATCH)
      //   0.60      0.729                 0.180
      //   0.75      0.471                 0.126
      //   0.90      0.200                 0.054
      //
      // At 0.9 the rule would fire on one same-person pair in five while
      // still false-matching one different-person pair in eighteen -- and
      // it would be spending that false-match rate on the EXPOSURE side.
      // R13's deletion of identity memory is reproduced here on new
      // footage by a different measurement. Do not propose a descriptor
      // shortcut again without a new descriptor.
      desc: null,
      lastVerdict: 'uncertain',
      // ...and this box is now on borrowed time: see PTRACK_CUT_COAST_MS.
      demoted: true,
      // PROVENANCE SURVIVES A CUT, for the same reason coastStep carries
      // it (S6 critic finding 7). Without this the field comes back
      // `undefined`, so the next face-derived observation reads as a
      // source FLIP that never happened — and a flip selects S5's
      // asymmetric damper, shrinking the box 5x slower on manufactured
      // evidence. Measured: srcFlip 15 against 10 cut-demotions in one
      // 15s window, i.e. the anti-breathing damper was being fired by a
      // missing field.
      fromFace: !!t.fromFace,
      headH: t.headH,
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
    // See matchedStep: the box literal here is exactly why this cannot
    // live on the box.
    fromFace: !!(obs.box && obs.box.fromFace),
    headH: (obs.box && typeof obs.box.headH === 'number' && obs.box.headH > 0)
      ? obs.box.headH
      : undefined,
    vx: 0,
    vy: 0,
    vw: 0,
    vh: 0,
    // Unknown ⇒ covered from the first observation, always. Nothing
    // shortcuts this — not recognition, not a prior sighting; the
    // fast-clear streak is what lifts blur off a correctly-read
    // same-gender adult within ~0.8s.
    state: 'blurred',
    clearMs: 0,
    missMs: 0,
    clearAge: 0,
    clearStreak: !obs.flagged && obs.certain ? 1 : 0,
    flagStreak: 0,
    abstainStreak: 0,
    // A fresh track starts BLURRED regardless; this only records that its
    // first read already pointed same-direction, so the streak does not
    // restart from zero on the churn a wide shot produces.
    weakStreak: obs.weak ? 1 : 0,
    desc: obs.desc || null,
    headBox: obs.headBox || null,
    headAgeMs: 0,
    headDrift: 0,
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
/**
 * How long a cleared person's face square may keep punching its hole
 * after the last pass that actually detected that face.
 *
 * Matched to PTRACK_MAX_MISS_MS deliberately: the hole is evidence of
 * the same kind as the track's own position, it goes stale for the same
 * reason (the person moved, or the detector lost them), and it must not
 * outlive the box it is expressed against. A hole that outlives its
 * evidence is EXPOSURE, which is the class this whole file ranks worst.
 */
export var HEAD_HOLE_MAX_AGE_MS = 1000;

/**
 * `patch` minus `hole`, as up to four axis-aligned rectangles.
 *
 * WHY A HOLE AND NOT A NARROWER PATCH (gauntlet R19). Two people
 * standing together produce two boxes that genuinely overlap — MoveNet's
 * keypoint union leaks a shoulder or a wrist onto the neighbour, and
 * PTRACK_PAD widens the result again. On runs/r19-man the covered
 * child's track sat at x 0.414-0.894 while she really occupies
 * 0.50-0.72, so her patch was drawn straight across the cleared man's
 * face on six of ten frames. That is the owner's second bar failing
 * ("not a single frame where the wrong gender is blurred up").
 *
 * The tempting fix — clamp the patch's left edge to the right of his
 * head — exposes a FULL-HEIGHT band on nothing but a positional guess:
 * anything of hers at that x and a lower y goes sharp. Subtracting only
 * the head square cannot do that, because of what the square is: the
 * pixels a face detector found a face in, this pass. A visible face is
 * an unoccluded face, so those pixels are HIS. Covering them can only
 * ever be FALSE COVER; it can never be preventing an EXPOSURE, because
 * nobody behind his head is visible there to expose.
 *
 * That argument is sound for a HEAD and is NOT sound for a body: bodies
 * are not convex, and a gap between an arm and a torso shows whatever is
 * behind it. So this only ever subtracts head squares, and only ones a
 * cleared track earned.
 */
export function subtractBox(patch, hole) {
  var ix1 = Math.max(patch.x1, hole.x1);
  var iy1 = Math.max(patch.y1, hole.y1);
  var ix2 = Math.min(patch.x2, hole.x2);
  var iy2 = Math.min(patch.y2, hole.y2);
  // No overlap: the patch is untouched.
  if (!(ix2 > ix1 && iy2 > iy1)) return [{ side: '', box: patch }];
  // EACH PIECE CARRIES THE SIDE IT IS, NOT ITS INDEX (R19 critic, F2a).
  // The four pushes below are conditional, so an index is not a stable
  // identity: the moment the hole reaches the patch's top edge the top
  // slab stops being emitted and index 0 silently becomes the BOTTOM
  // slab. video-region keys its DOM nodes by this string and lerps each
  // one from its own previous rect, so that swap would glide a single
  // overlay from the top of the frame to the bottom -- and it is one
  // pass of drift away on r19-man f004, whose patch top edge is y 0.037
  // against a head hole reaching y 0.147.
  var out = [];
  if (iy1 > patch.y1) out.push({ side: 't', box: { x1: patch.x1, y1: patch.y1, x2: patch.x2, y2: iy1 } });
  if (iy2 < patch.y2) out.push({ side: 'b', box: { x1: patch.x1, y1: iy2, x2: patch.x2, y2: patch.y2 } });
  if (ix1 > patch.x1) out.push({ side: 'l', box: { x1: patch.x1, y1: iy1, x2: ix1, y2: iy2 } });
  if (ix2 < patch.x2) out.push({ side: 'r', box: { x1: ix2, y1: iy1, x2: patch.x2, y2: iy2 } });
  return out;
}

/**
 * The head squares that may be subtracted from this pass's patches:
 * every CLEARED track carrying face evidence younger than
 * HEAD_HOLE_MAX_AGE_MS. State, not last verdict — a track that has not
 * yet earned its clear is still a person we are covering, and punching a
 * hole in their own patch would be EXPOSURE.
 */
/**
 * How much of the hole's smaller side is given back at full age.
 *
 * The hole is only as trustworthy as the evidence behind it, and that
 * evidence decays two ways between gender reads: `shiftHead` translates
 * it by the track box's centre delta (which moves for reasons a head
 * does not -- EMA convergence, keypoint-union jitter, size
 * extrapolation), and the face itself may simply have turned. So the
 * hole SHRINKS instead of switching off -- by the distance it has been
 * translated on unverified evidence, which makes it a subset of where
 * the face plausibly still is, and by a fraction of its own size as it
 * ages. Shrinking also removes the flicker a hard on/off would cause
 * (R19 critic, F2c): a hole that fades geometrically never rekeys a
 * whole patch mid-shot.
 */
export var HEAD_HOLE_AGE_SHRINK = 0.25;

export function clearedHeadHoles(tracks) {
  var holes = [];
  for (var i = 0; i < (tracks ? tracks.length : 0); i++) {
    var t = tracks[i];
    if (!t || t.state !== 'cleared' || !t.headBox) continue;
    var age = t.headAgeMs || 0;
    if (age > HEAD_HOLE_MAX_AGE_MS) continue;
    var h = t.headBox;
    var w = h.x2 - h.x1;
    var hh = h.y2 - h.y1;
    if (!(w > 0 && hh > 0)) continue;
    var inset =
      (t.headDrift || 0) + (age / HEAD_HOLE_MAX_AGE_MS) * HEAD_HOLE_AGE_SHRINK * Math.min(w, hh);
    if (inset * 2 >= Math.min(w, hh)) continue; // nothing trustworthy left
    holes.push({ x1: h.x1 + inset, y1: h.y1 + inset, x2: h.x2 - inset, y2: h.y2 - inset });
  }
  return holes;
}

// TOP PAD, SCALED BY THE HEAD IT EXISTS TO PROTECT.
//
// PTRACK_PAD_TOP is a fraction of BODY height, but the defect it was built
// for -- MoveNet cropping at the hairline -- scales with HEAD size. On a
// close-up the head IS most of the box and 0.12 is about right. On a
// full-body subject the head is roughly an eighth of the box, so the same
// constant is ~8x larger than the thing it is protecting, and it is
// largest exactly where the box is already a slab.
//
// MEASURED over 2,568 observation boxes from 144 stored runs: the drawn
// patch is 1.66x the core box at p50, and the margin chain ALONE takes
// full-height patches from 0% to 39%. The cost lands on the owner's own
// complaint -- 71.2% of patches on multi-face passes contain two or more
// face centres, the margins add 0.77 face-widths per side at p50, and the
// median gap to the nearest other face is 2.5 face-widths. That is "a
// Linus still gets blurd sometimes", in arithmetic.
//
// So: cap the top pad at a share of the HEAD when we know the head's
// width, and fall back to the old body fraction when we do not. The cap
// only ever REDUCES the pad, and only above a crown the head anchor has
// already covered (person-gate puts headH*1.1 above the head keypoints),
// so it cannot uncover a face. R18 measured headX null on 59% of admitted
// persons in the weak tier -- those keep the old behaviour exactly.
export var PTRACK_TOP_PAD_HEADS = 0.6;

function topPad(t, h) {
  var full = h * PTRACK_PAD_TOP;
  var hh = t.headH;
  if (!(typeof hh === 'number' && hh > 0)) return full;
  var capped = hh * PTRACK_TOP_PAD_HEADS;
  return capped < full ? capped : full;
}

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
        y1: Math.max(0, t.box.y1 - topPad(t, h)),
        x2: Math.min(1, t.box.x2 + w * PTRACK_PAD),
        y2: Math.min(1, t.box.y2 + h * PTRACK_PAD),
      },
      vx: t.vx,
      vy: t.vy,
      vw: t.vw || 0,
      vh: t.vh || 0,
    });
  }
  var merged = mergeTracks(out);
  var holes = clearedHeadHoles(tracks);
  // Same shape either way: every patch carries a `holes` array, empty in
  // the common case, so no caller has to guard the field.
  if (!holes.length) {
    for (var e = 0; e < merged.length; e++) merged[e].holes = [];
    return merged;
  }
  // ONE PATCH WITH A HOLE, NOT FOUR PATCHES AROUND ONE (owner
  // 2026-08-26: "multiple boxes here and there"). Splitting a blurred
  // patch into up to four rectangles around each cleared head is what
  // that complaint IS: stability.py measured drawn patches exceeding
  // live tracks on 44% of covered samples, most commonly 3 patches from
  // 2 tracks, on a scene with exactly two people in it. Each piece is
  // also its own DOM node with its own backdrop-filter, so the seams
  // cost frame time as well as looking broken -- and the owner raised
  // performance in the same breath ("yt app already feels slow").
  //
  // The holes are still SUBTRACTED, pixel for pixel; they are just
  // subtracted by the renderer instead of by the geometry. Coverage is
  // unchanged, so no accuracy class can move: the same pixels are
  // covered and the same cleared head stays sharp.
  //
  // Holes ride along on the patch, clipped to it, and video-region turns
  // them into a two-layer mask. MEASURED LIVE in WebView2 before this
  // was built, because CSS.supports lies about this: it reports true for
  // `clip-path: path(evenodd, ...)`, and an element carrying one paints
  // NOTHING AT ALL next to an identical unclipped control. Two mask
  // layers composited with `exclude` do work, verified by pixel
  // (spikes/gauntlet/runs/clip-spike2.png).
  var withHoles = [];
  for (var m = 0; m < merged.length; m++) {
    var box = merged[m].box;
    var mine = [];
    for (var hI = 0; hI < holes.length; hI++) {
      var clipped = intersectBox(box, holes[hI]);
      if (clipped) mine.push(clipped);
    }
    withHoles.push({
      key: merged[m].key,
      box: box,
      holes: mine,
      vx: merged[m].vx,
      vy: merged[m].vy,
      vw: merged[m].vw || 0,
      vh: merged[m].vh || 0,
    });
  }
  return withHoles;
}

/** Overlap of two boxes, or null when they do not meet. */
export function intersectBox(a, b) {
  var x1 = Math.max(a.x1, b.x1);
  var y1 = Math.max(a.y1, b.y1);
  var x2 = Math.min(a.x2, b.x2);
  var y2 = Math.min(a.y2, b.y2);
  if (!(x2 > x1) || !(y2 > y1)) return null;
  return { x1: x1, y1: y1, x2: x2, y2: y2 };
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
// PROXIMITY MERGE: BUILT, REFUSED BY THE EXISTING TESTS, KEPT AS A NOTE.
// Owner 2026-08-26 reported "multiple boxes here and there", and
// stability.py measures it: 3-4 drawn patches peaking at 7 on a
// TWO-person scene, count changing 2.23 times a second. The obvious move
// is to also merge boxes that merely sit a hairline apart, gated on the
// union being cheap in area so distant boxes cannot bridge.
// It does not work, and the arithmetic says why: two full-height people
// standing side by side with a 0.05 gap have a union of 0.72 against a
// summed area of 0.68 -- CHEAPER, in relative terms, than two partial
// boxes on one person. Area cannot separate "two boxes on one person"
// from "two people", and the three tests that pin side-by-side people
// apart failed immediately.
// The lesson to carry: patch COUNT is not a rendering problem and must
// not be fixed here. Two patches on one person means the tracker made
// two tracks for one person, and merging drawn rectangles papers over
// that at the cost of the one property this function must never break.
// Fix it at association, or with a mask that has no rectangles at all.
function overlaps(a, b) {
  return iou(a, b) >= MERGE_IOU_MIN || containment(a, b) >= MERGE_CONTAIN_MIN;
}

// THE KEY IS THE OVERLAY'S IDENTITY, so it must depend on WHICH tracks
// merged and never on the order they merged in. Sorting the two COMPOSITE
// strings does not do that once a group has three members: merging 7 and
// 9 first gives "7+9", then "12+7+9"; merging 12 and 9 first gives
// "12+9", then "12+9+7". Same three tracks, two different keys.
//
// That matters because setTracks keys the DOM node by this string, so a
// permutation destroys and rebuilds the overlay -- and lerpRect(null, to)
// returns the target outright, the ONLY path in the renderer that skips
// both SHRINK_DEADBAND and SHRINK_LERP. The result is the largest
// single-frame size step the renderer can produce, with the patch COUNT
// unchanged, so dCount and stable_frac record nothing at all.
//
// The merge order really does permute: updatePersonTracks rebuilds its
// list matched-then-coasted-then-new in IoU-descending order, and
// person-gate documents MoveNet's slot order permuting independently.
// Flatten to member ids, sort those, dedupe.
export function mergedKey(a, b) {
  var parts = String(a || '').split('+').concat(String(b || '').split('+'));
  var seen = {};
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var pkey = parts[i];
    if (!pkey || seen[pkey]) continue;
    seen[pkey] = 1;
    out.push(pkey);
  }
  return out.sort().join('+');
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
          key: mergedKey(a.key, b.key),
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
