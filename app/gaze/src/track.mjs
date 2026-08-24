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
export var TRACK_MAX_MISSES = 4; // samples a lost track survives (~0.5s @7Hz)
export var TRACK_CLEAR_STREAK = 5; // clear matches to unflag (~0.7s @7Hz)

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
      if (det.flagged) {
        flagged = true; // clear -> flag is instant, always
        clearStreak = 0;
      } else if (t.flagged) {
        clearStreak++;
        if (clearStreak >= TRACK_CLEAR_STREAK) {
          flagged = false;
          clearStreak = 0;
        }
      }
      var smoothed = ema(t.box, det.box, TRACK_EMA_ALPHA);
      var sc = center(smoothed);
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
        misses: 0,
        clearStreak: clearStreak,
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
          misses: t.misses + 1,
          clearStreak: t.clearStreak,
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
        misses: 0,
        clearStreak: 0,
      });
    }
  }
  return next;
}

/** Boxes of every currently-flagged track (patch render list). */
export function flaggedBoxes(tracks) {
  var out = [];
  for (var i = 0; i < tracks.length; i++) {
    if (tracks[i].flagged) out.push(tracks[i].box);
  }
  return out;
}
