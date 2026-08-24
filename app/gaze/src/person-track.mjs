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
export var MEM_SIM_CLEAR = 0.6; // min similarity to inherit a remembered clear
// Update bar = clear bar (adversarial review 2026-08-25 A2/B: an update
// bar BELOW the inherit bar was a poisoning ramp — a face too dissimilar
// to inherit could still blend 30% into the entry per pass and walk the
// centroid toward the wrong person until it matched).
export var MEM_SIM_UPDATE = 0.6;
// Identity continuity on a live track: a matched verdict read whose
// descriptor disagrees with the track's by more than this is a DIFFERENT
// person standing where the track is (occlusion crossing, dissolve) —
// verdict state resets to blurred (review A1: a child absorbed onto a
// cleared track was invisible to the state machine, since child reads
// are structurally uncertain and uncertainty was absorbed forever).
export var IDENT_SIM_MIN = 0.3;
// A cleared track must RE-PROVE itself: this long without a single
// confident same-gender read reverts it to blurred (review A1 backstop —
// bounds every absorption hole, not just the child one).
export var CLEARED_TTL_MS = 5000;

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
export function updatePersonTracks(tracks, observations, dtMs) {
  var dt = dtMs > 0 ? dtMs : 250;
  var pairs = [];
  var i, j;
  for (i = 0; i < tracks.length; i++) {
    for (j = 0; j < observations.length; j++) {
      var v = iou(tracks[i].box, observations[j].box);
      if (v >= PTRACK_IOU_MIN) pairs.push({ t: i, o: j, iou: v });
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
    next.push(newTrack(observations[j]));
  }
  return next;
}

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
      box: smoothed,
      vx: ((sc[0] - tc[0]) / dt) * 1000,
      vy: ((sc[1] - tc[1]) / dt) * 1000,
      vw: sizeVel(t.box, smoothed, dt, 'x'),
      vh: sizeVel(t.box, smoothed, dt, 'y'),
      state: state,
      clearMs: clearMs,
      missMs: 0,
      clearAge: t.clearAge || 0,
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
  // Identity continuity check FIRST (review A1): if this read's face
  // descriptor contradicts the track's, someone else is standing here —
  // all verdict trust resets, blur-first for whoever this now is.
  var identityBroken =
    obs.desc && t.desc && cosineSim(obs.desc, t.desc) < IDENT_SIM_MIN;
  if (identityBroken) {
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
    if (state === 'blurred' && (clearMs >= CLEAR_HOLD_MS || clearStreak >= CLEAR_STREAK_N)) {
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
        state = 'blurred';
        clearMs = 0;
        clearAge = 0;
      }
    }
  }
  // Identity memory: this face MATCHES a person who already earned a
  // full clear hold, and the current read agrees confidently — skip
  // the rest of the hold (the hold was served once; cuts/misses don't
  // un-serve it). A certain FLAG above always wins first.
  if (obs.remembered === 'cleared' && !obs.flagged && obs.certain && state === 'blurred') {
    state = 'cleared';
    clearMs = Math.max(clearMs, CLEAR_HOLD_MS);
  }
  return {
    box: smoothed,
    vx: ((sc[0] - tc[0]) / dt) * 1000,
    vy: ((sc[1] - tc[1]) / dt) * 1000,
    vw: sizeVel(t.box, smoothed, dt, 'x'),
    vh: sizeVel(t.box, smoothed, dt, 'y'),
    state: state,
    clearMs: clearMs,
    missMs: 0,
    clearAge: clearAge,
    clearStreak: !obs.flagged && obs.certain ? clearStreak : 0,
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
export var PTRACK_MAX_MISS_BLURRED_MS = 3000;

function coastStep(t, dt) {
  var missMs = t.missMs + dt;
  var limit = t.state === 'blurred' ? PTRACK_MAX_MISS_BLURRED_MS : PTRACK_MAX_MISS_MS;
  if (missMs > limit) return null;
  var dx = ((t.vx || 0) * dt) / 1000;
  var dy = ((t.vy || 0) * dt) / 1000;
  return {
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
    clearAge: t.clearAge || 0,
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
      box: t.box,
      vx: 0,
      vy: 0,
      vw: 0,
      vh: 0,
      state: 'blurred',
      clearMs: 0,
      missMs: 0,
      clearAge: 0,
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
    // Unknown ⇒ covered from the first observation, even one that reads
    // confidently clear — the clear hold applies to everyone equally.
    // EXCEPT a remembered identity: someone who already served the full
    // hold this video, re-appearing after a cut or miss, whose face
    // matches at MEM_SIM_CLEAR and whose current read agrees. A certain
    // flag still always wins.
    state:
      obs.remembered === 'cleared' && !obs.flagged && obs.certain ? 'cleared' : 'blurred',
    clearMs: obs.remembered === 'cleared' && !obs.flagged && obs.certain ? CLEAR_HOLD_MS : 0,
    missMs: 0,
    clearAge: 0,
    clearStreak: !obs.flagged && obs.certain ? 1 : 0,
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
// Small margin so ABUTTING patches merge too (two squares kissing at an
// edge read as the same chaos as overlapping ones — review A13).
var MERGE_MARGIN = 0.02;
function overlaps(a, b) {
  return (
    a.x1 < b.x2 + MERGE_MARGIN &&
    b.x1 < a.x2 + MERGE_MARGIN &&
    a.y1 < b.y2 + MERGE_MARGIN &&
    b.y1 < a.y2 + MERGE_MARGIN
  );
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
