// Temporal track state for live-video person blur (owner ask 2026-08-24:
// "consider the previous frames — an object tracking system, continuously
// track the person and keep it blurred"). SORT-style association without
// the Kalman machinery: detections arrive at ~7Hz from BlazeFace, tracks
// match by centre distance (greedy nearest — 1-3 faces is the norm, the
// Hungarian algorithm buys nothing at that count), boxes ease by EMA so
// patches glide instead of twitching, and verdict state is STICKY:
//
//  - a flagged track that misses a detection HOLDS its patch for
//    MAX_MISSES samples (~0.5s) — detector flicker must never flash the
//    person it was covering;
//  - a flagged track unflags only after CLEAR_STREAK consecutive
//    same-gender-clear matches — one lucky frame is not evidence;
//  - a clear→flag flip is INSTANT (fail-safe direction, as everywhere).
//
// Pure module: no DOM, no timers. Caller owns the track array and feeds
// one updateTracks() per detection pass. Clean-room design (HaramBlur is
// a behaviour reference only — see NOTICE); association scheme follows
// the public SORT paper's structure (Bewley et al. 2016), reimplemented.

export var TRACK_EMA_ALPHA = 0.3; // new-box weight per matched sample
export var TRACK_SNAP_DIST = 0.18; // centre distance beyond which no match
export var TRACK_MAX_MISSES = 8; // samples a lost track survives (~1.1s @7Hz — small/distant faces flicker in and out of detection, and a lingering patch is the safe direction)
export var TRACK_CLEAR_STREAK = 5; // clear matches to unflag (~0.7s @7Hz)
// Phantom gate (owner 2026-08-24 "random blurs"): a LOW-confidence
// detection (the small-subject rescue band below TRACK_CONFIRM_CONFIDENCE
// = detector FACE_MIN_CONFIDENCE, kept in lockstep) must be seen
// TRACK_MIN_HITS times before its patch renders — one-frame phantoms
// (shirt graphics, wood grain) never accumulate that. A confident
// detection still blurs on its first frame (fail-safe direction).
export var TRACK_MIN_HITS = 3;
export var TRACK_CONFIRM_CONFIDENCE = 0.35;
// Gender memory (owner 2026-08-24: "remember the person you checked —
// don't repeatedly blur a male"): after this many CONFIDENT same-gender
// clears, an UNCERTAIN flag (face turned away, motion blur, too small
// to read) no longer re-flags the track — we already know who this is.
// A CONFIDENT opposite-gender flag still flips instantly (fail-safe):
// memory only ever absorbs uncertainty, never a positive detection.
export var TRACK_GENDER_MEMORY = 3;
// Static-texture suppression (owner 2026-08-24 "blur on random text and
// thumbnail elements"): face-like GRAPHICS (logo letters, crate labels)
// produce tracks that (a) never move, (b) never get a confident gender
// reading in either direction, (c) never score high. Real people move —
// or hold still long enough that the gender model reads them. A track
// that stays static for TRACK_STATIC_SAMPLES with no confident reading
// and a peak detector confidence under TRACK_STATIC_MAX_CONF stops
// rendering its patch. Measured 2026-08-24: the title-card letters ran
// conf 0.40 / zoom 0.59 — indistinguishable from small faces per-frame,
// cleanly separable by this track history.
export var TRACK_STATIC_SAMPLES = 10; // ~1.4s @7Hz
export var TRACK_STATIC_EPS = 0.025; // centre movement below this = static (live 2026-08-24: detection jitter on textures runs ~1-2% of frame; a standing talker sways less than this between 140ms samples)
export var TRACK_STATIC_MAX_CONF = 0.6;

function center(b) {
  return [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
}

function ema(prev, next, a) {
  return {
    x1: prev.x1 + (next.x1 - prev.x1) * a,
    y1: prev.y1 + (next.y1 - prev.y1) * a,
    x2: prev.x2 + (next.x2 - prev.x2) * a,
    y2: prev.y2 + (next.y2 - prev.y2) * a,
    confidence: next.confidence,
  };
}

/**
 * One tracker step. tracks: the array returned by the previous call (or
 * []). detections: [{ box, flagged }] — box normalized 0..1, flagged =
 * this face must stay covered (opposite/unknown gender, low score).
 * Returns the next tracks array: [{ box, flagged, misses, clearStreak }].
 * A cut/jump beyond TRACK_SNAP_DIST starts a fresh track — easing across
 * a scene change would trail the blur behind the person.
 */
export function updateTracks(tracks, detections) {
  var next = [];
  var claimed = new Array(detections.length).fill(false);
  for (var i = 0; i < tracks.length; i++) {
    var t = tracks[i];
    var tc = center(t.box);
    var best = -1;
    var bestD = Infinity;
    for (var j = 0; j < detections.length; j++) {
      if (claimed[j]) continue;
      var dc = center(detections[j].box);
      var d = Math.hypot(dc[0] - tc[0], dc[1] - tc[1]);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0 && bestD <= TRACK_SNAP_DIST) {
      claimed[best] = true;
      var det = detections[best];
      var flagged = t.flagged;
      var clearStreak = t.clearStreak;
      var clearWins = t.clearWins || 0;
      // det.certain: the gender stage read a real direction this frame
      // (see gender-verdict faceMeta). An uncertain flag on a track with
      // enough confident-clear history is absorbed by the memory.
      var detFlag = det.flagged;
      if (detFlag && det.certain === false && clearWins >= TRACK_GENDER_MEMORY) {
        detFlag = false;
      }
      if (!det.flagged && det.certain) clearWins++;
      if (detFlag) {
        flagged = true; // clear -> flag is instant, always
        clearStreak = 0;
        if (det.certain) clearWins = 0; // a real opposite reading resets memory
      } else if (t.flagged) {
        clearStreak++;
        if (clearStreak >= TRACK_CLEAR_STREAK) {
          flagged = false;
          clearStreak = 0;
        }
      }
      var smoothed = ema(t.box, det.box, TRACK_EMA_ALPHA);
      var sc = center(smoothed);
      // Static/certainty history for the texture-suppression rule: RAW
      // detection movement (not the EMA'd box, which always creeps).
      var dcRaw = center(det.box);
      var moved = Math.hypot(dcRaw[0] - tc[0], dcRaw[1] - tc[1]) >= TRACK_STATIC_EPS;
      var staticCount = moved ? 0 : (t.staticCount || 0) + 1;
      var everCertain = !!t.everCertain || det.certain === true;
      var maxConf = Math.max(t.maxConf || 0, det.box.confidence || 0);
      next.push({
        box: smoothed,
        // Per-sample centre velocity (EMA'd like the box): carried into
        // misses so a moving person's patch keeps travelling with them
        // through detection gaps instead of freezing behind them
        // (constant-velocity idea from the MOT literature — see
        // docs/research/video-tracking.md; a cut still resets via the
        // SNAP_DIST bound above).
        vx: sc[0] - tc[0],
        vy: sc[1] - tc[1],
        flagged: flagged,
        hits: (t.hits || 0) + 1,
        misses: 0,
        clearStreak: clearStreak,
        clearWins: clearWins,
        staticCount: staticCount,
        everCertain: everCertain,
        maxConf: maxConf,
      });
    } else {
      // No detection this pass: coast the patch along the track's last
      // velocity (decayed), never freeze it behind a mover.
      if (t.misses + 1 <= TRACK_MAX_MISSES) {
        var vx = (t.vx || 0) * 0.8;
        var vy = (t.vy || 0) * 0.8;
        next.push({
          box: {
            x1: Math.max(0, Math.min(1, t.box.x1 + vx)),
            y1: Math.max(0, Math.min(1, t.box.y1 + vy)),
            x2: Math.max(0, Math.min(1, t.box.x2 + vx)),
            y2: Math.max(0, Math.min(1, t.box.y2 + vy)),
            confidence: t.box.confidence,
          },
          vx: vx,
          vy: vy,
          flagged: t.flagged,
          hits: t.hits || 0,
          misses: t.misses + 1,
          clearStreak: t.clearStreak,
          clearWins: t.clearWins || 0,
          staticCount: t.staticCount || 0,
          everCertain: !!t.everCertain,
          maxConf: t.maxConf || 0,
        });
      }
      // else: track expires, patch goes with it.
    }
  }
  for (var k = 0; k < detections.length; k++) {
    if (!claimed[k]) {
      next.push({
        box: detections[k].box,
        vx: 0,
        vy: 0,
        flagged: detections[k].flagged,
        hits: 1,
        misses: 0,
        clearStreak: 0,
        clearWins: !detections[k].flagged && detections[k].certain ? 1 : 0,
        staticCount: 0,
        everCertain: detections[k].certain === true,
        maxConf: detections[k].box.confidence || 0,
      });
    }
  }
  return next;
}

/**
 * Torso-ghost suppression (owner 2026-08-24, live evidence: a cleared
 * speaker's SHIRT GRAPHIC detects as an uncertain "face" riding on his
 * chest — it moves with him, so the static rule can't touch it). Rule:
 * an UNCERTAIN flagged detection whose centre sits inside the body
 * column of a CONFIDENTLY-CLEARED face in the same frame, BELOW that
 * face, is that person's clothing — drop it. A real face at someone's
 * chest height that reads its gender confidently is never dropped
 * (certain flags bypass this entirely). bodyOf: face box -> body box
 * (caller passes region-blur's expandToBody — kept injected so this
 * module stays dependency-free). Pure; exported for tests.
 */
export function suppressTorsoGhosts(detections, bodyOf) {
  var out = [];
  for (var i = 0; i < detections.length; i++) {
    var d = detections[i];
    if (!d.flagged || d.certain) {
      out.push(d);
      continue;
    }
    var dc = center(d.box);
    var ghost = false;
    for (var j = 0; j < detections.length; j++) {
      if (j === i) continue;
      var e = detections[j];
      if (e.flagged || !e.certain) continue; // only confidently-cleared hosts
      var body = bodyOf(e.box);
      var ec = center(e.box);
      if (dc[0] >= body.x1 && dc[0] <= body.x2 && dc[1] >= body.y1 && dc[1] <= body.y2 && dc[1] > ec[1]) {
        ghost = true;
        break;
      }
    }
    if (!ghost) out.push(d);
  }
  return out;
}

/**
 * Boxes of every currently-flagged track (patch render list). Tracks
 * whose latest detection sits in the low-confidence rescue band render
 * only after TRACK_MIN_HITS sightings (see the phantom gate above);
 * a missing confidence counts as confident (fail-safe).
 */
export function flaggedBoxes(tracks) {
  var out = [];
  for (var i = 0; i < tracks.length; i++) {
    var t = tracks[i];
    if (!t.flagged) continue;
    var conf = typeof t.box.confidence === 'number' ? t.box.confidence : 1;
    if (conf < TRACK_CONFIRM_CONFIDENCE && (t.hits || 0) < TRACK_MIN_HITS) continue;
    // Static-texture suppression (see constants above): motionless,
    // never confidently gendered, never strongly detected = graphics.
    if (
      (t.staticCount || 0) >= TRACK_STATIC_SAMPLES &&
      !t.everCertain &&
      (t.maxConf || 0) < TRACK_STATIC_MAX_CONF
    ) {
      continue;
    }
    out.push(t.box);
  }
  return out;
}
