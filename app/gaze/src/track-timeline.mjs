// Verdict snapshots keyed by media time, and the interpolation rules
// that turn them into one presentation frame (Stage B, "option 1",
// docs/superpowers/plans/2026-09-02-latency-restructure-and-delay-line.md,
// Task 8).
//
// The delay presenter shows a frame D ms late, so for the media time
// actually on screen both the verdict BEFORE it and the verdict AFTER
// it are usually already known -- the renderer never has to guess
// where a track is going, it only has to interpolate between two
// measurements. That turns every prior extrapolation problem (a track
// coasting past the last verdict on pure velocity) into interpolation,
// which cannot overshoot.
//
// The covering direction always wins, everywhere in boxesAt: a track
// blurred on either side of the presented frame is presented blurred;
// a track that appears in the next verdict is covered back to the
// previous one (one interval of false cover, never exposure); a track
// that is gone by the next verdict keeps its last box until that
// verdict (bounded phantom, never a flash of skin from a detector
// miss) unless a scene cut proves the shot changed, in which case it
// is dropped exactly at the cut instead of riding into a shot it was
// never seen in.
//
// Pure module: no DOM, no video element, no globals. `mediaTime` is
// the video's own currentTime domain, not wall-clock ms.

/**
 * @typedef {{id: any, box: {x1:number,y1:number,x2:number,y2:number}, state: 'blurred'|'cleared'}} TimelineTrack
 */

/**
 * Create a new, empty timeline.
 * @param {number} keepMs how far back (in media-time milliseconds) to
 *   keep snapshots behind the newest one. Callers should pass
 *   delayMs + 2000 so a snapshot never gets pruned while a frame that
 *   still needs it could be presented.
 */
export function makeTimeline(keepMs) {
  return {
    keepMs: keepMs > 0 ? keepMs : 0,
    // Ascending by mediaTime. Entries: { mediaTime, tracks }.
    snapshots: [],
    // Ascending by mediaTime. Cut times only, no per-cut payload.
    cuts: [],
  };
}

/**
 * Forget every snapshot and cut, keep the window. Called at a seek: the
 * tracker is wiped there (init-entry `seeked`), so every snapshot held
 * describes tracks that no longer exist, at media times playback is no
 * longer adjacent to.
 * @param {ReturnType<typeof makeTimeline>} tl
 */
export function resetTimeline(tl) {
  tl.snapshots = [];
  tl.cuts = [];
}

// A snapshot keyed this far BEHIND the newest one is a discontinuity
// (a seek back), not an earlier verdict. Snapshots are keyed at the
// ring's newest frame when the pass starts, so during playback they
// are monotone to within one frame; a position pass a few ms behind a
// verdict it overlapped is ordinary and is inserted in order.
//
// Why this is here and not only on the `seeked` listener: the owner
// found it (2026-09-02, "one blur patch at the same position, not
// changing at all" after seeking back). The prune below measured keepMs
// against the NEWEST media time held, so after a seek back of more
// than keepMs every snapshot pushed at the new position was shifted
// out as it arrived, and boxesAt answered rule 2 with the one old
// snapshot from the future -- one solid patch, frozen, until playback
// reached it. A seek back inside keepMs interleaved two watches with
// different track ids instead. The listener is the primary reset; this
// is the guarantee that a media clock jumping back without one (a
// stream re-init, a discontinuity the element does not announce) can
// never leave the timeline holding a future.
export var BACK_JUMP_S = 0.5;

/**
 * Record a verdict (or position-only) snapshot at mediaTime. Snapshots
 * older than keepMs behind the newest snapshot are dropped -- keepMs
 * is measured against media time, in the same seconds/ms domain as
 * mediaTime itself (mediaTime is seconds, keepMs is milliseconds, so
 * the comparison converts once here).
 * @param {ReturnType<typeof makeTimeline>} tl
 * @param {number} mediaTime
 * @param {TimelineTrack[]} tracks
 */
export function pushSnapshot(tl, mediaTime, tracks) {
  var copy = (tracks || []).map(function (t) {
    return {
      id: t.id,
      box: t.box,
      state: t.state,
      // Carried for the presentation-time merge and its re-clamp
      // (person-track.mergePresented): the evidence hull of a blurred
      // entry, the face box of a cleared one.
      core: t.core || null,
      head: t.head || null,
      face: t.face || null,
      headX: t.headX,
      headW: t.headW,
      headY: t.headY,
      headH: t.headH,
      // Carried for the hindsight rules: a track whose last read was a
      // certain opposite-gender read, and a track that was coasting
      // (no observation) at this snapshot.
      flagCertain: !!t.flagCertain,
      coasting: !!t.coasting,
      // A certain clear was credited at this snapshot but the ladder had
      // not finished (person-track.presentTracks). Read by rule 3'': the
      // verdict AFTER this one decides whether the interval before it is
      // presented cleared.
      clearPending: !!t.clearPending,
      // Set in hindsight by markDeadCoasts: a coasted snapshot of a
      // track that then expired with no cut and nobody taking its box.
      dead: false,
    };
  });
  var snap = { mediaTime: mediaTime, tracks: copy };
  if (tl.snapshots.length && mediaTime < tl.snapshots[tl.snapshots.length - 1].mediaTime - BACK_JUMP_S) {
    resetTimeline(tl);
  }
  tl.snapshots.push(snap);
  tl.snapshots.sort(function (a, b) {
    return a.mediaTime - b.mediaTime;
  });
  markDeadCoasts(tl, snap);
  var newest = tl.snapshots[tl.snapshots.length - 1].mediaTime;
  var floor = newest - tl.keepMs / 1000;
  while (tl.snapshots.length > 1 && tl.snapshots[0].mediaTime < floor) {
    tl.snapshots.shift();
  }
  // A cut behind the retained window can never bracket a live query;
  // drop it too so the array cannot grow without bound over a long
  // watch session.
  while (tl.cuts.length && tl.cuts[0] < floor) {
    tl.cuts.shift();
  }
}

/**
 * Record a scene-gate cut at mediaTime -- the media time separating
 * the previous shot from the next one.
 * @param {ReturnType<typeof makeTimeline>} tl
 * @param {number} mediaTime
 */
export function pushCut(tl, mediaTime) {
  tl.cuts.push(mediaTime);
  tl.cuts.sort(function (a, b) {
    return a - b;
  });
}

function boxesTouch(a, b) {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

// RULE 6, THE DEAD COAST (2026-09-02). A track that only ever COASTED
// after its last observation and then expired -- with no cut in between
// and no blurred track in the new snapshot touching the box it left --
// was following someone the detector never saw again. Live, the coast
// was the right call (a miss must not uncover anyone); in hindsight,
// with the expiry known, its coasting snapshots describe nobody. They
// are marked `dead` and boxesAt presents them as absent. The observed
// snapshot before the run is untouched, so rule 4 still covers the one
// interval after the last sighting. Run 3 on the Redmi: 83 of 255
// blurred track-passes were coasting, p50 946ms (the phantom he reports);
// of those this rule retires 8 passes in 4 runs, 4.97s of presented time
// (critic L7) -- the population is not the yield.
function markDeadCoasts(tl, snap) {
  var idx = tl.snapshots.indexOf(snap);
  if (idx < 1) return;
  var prev = tl.snapshots[idx - 1];
  if (cutBetween(tl, prev.mediaTime, snap.mediaTime)) return;
  var present = {};
  for (var i = 0; i < snap.tracks.length; i++) present[snap.tracks[i].id] = true;
  for (var j = 0; j < prev.tracks.length; j++) {
    var t = prev.tracks[j];
    if (!t.coasting || present[t.id] || t.state !== 'blurred') continue;
    var taken = false;
    for (var k = 0; k < snap.tracks.length && !taken; k++) {
      var n = snap.tracks[k];
      if (n.state === 'blurred' && boxesTouch(n.box, t.box)) taken = true;
    }
    if (taken) continue;
    // Walk back through the consecutive coasting run of this id, and
    // never across a cut: a coasted patch in the PREVIOUS shot is not
    // retired by an expiry in the next one (critic L5).
    for (var s = idx - 1; s >= 0; s--) {
      if (s < idx - 1 && cutBetween(tl, tl.snapshots[s].mediaTime, tl.snapshots[s + 1].mediaTime)) break;
      var hit = null;
      for (var q = 0; q < tl.snapshots[s].tracks.length; q++) {
        if (tl.snapshots[s].tracks[q].id === t.id) { hit = tl.snapshots[s].tracks[q]; break; }
      }
      if (!hit || !hit.coasting) break;
      hit.dead = true;
    }
  }
}

function liveTracks(snap) {
  var out = [];
  for (var i = 0; i < snap.tracks.length; i++) if (!snap.tracks[i].dead) out.push(snap.tracks[i]);
  return out;
}

function findA(tl, mediaTime) {
  // Newest snapshot with mediaTime <= m.
  var found = null;
  for (var i = 0; i < tl.snapshots.length; i++) {
    var s = tl.snapshots[i];
    if (s.mediaTime <= mediaTime) found = s;
    else break;
  }
  return found;
}

function findB(tl, mediaTime) {
  // Oldest snapshot with mediaTime >= m.
  for (var i = 0; i < tl.snapshots.length; i++) {
    var s = tl.snapshots[i];
    if (s.mediaTime >= mediaTime) return s;
  }
  return null;
}

// True if any recorded cut falls in (fromExclusive, toInclusive].
function cutBetween(tl, fromExclusive, toInclusive) {
  for (var i = 0; i < tl.cuts.length; i++) {
    var c = tl.cuts[i];
    if (c > fromExclusive && c <= toInclusive) return true;
  }
  return false;
}

// Rule 3'': the state a B-side entry counts as. A pending clear at B is
// 'cleared' iff the snapshot right after B has the same id cleared and no
// cut separates the two; otherwise B's own state stands.
function stateAt(tl, B, tb) {
  if (tb.state !== 'blurred' || !tb.clearPending) return tb.state;
  var idx = tl.snapshots.indexOf(B);
  if (idx === -1) return tb.state;
  // WALK OVER THE UNDECIDED SNAPSHOTS. The timeline gets a snapshot per
  // pass and most passes are POSITION passes (no gender read), so the
  // snapshot right after B usually carries the same pending clear and
  // says nothing. Redmi, events-v1096d: track 28 born at a cut, certain
  // male at 181.382 (pending), position passes at 182.483 and 183.05
  // still pending, cleared at the 183.35 verdict -- 2.0s covered by a
  // lookahead that read one position pass and stopped. The first
  // DECIDING snapshot answers: cleared, blurred without the pending
  // clear (an uncertain or opposite read -- the ladder was right), or
  // the id gone. A cut ends the shot, and LOOKAHEAD_MS bounds the walk.
  var prev = B;
  for (var k = idx + 1; k < tl.snapshots.length; k++) {
    var C = tl.snapshots[k];
    if ((C.mediaTime - B.mediaTime) * 1000 > LOOKAHEAD_MS) return tb.state;
    if (cutBetween(tl, prev.mediaTime, C.mediaTime)) return tb.state;
    var tc = null;
    for (var i = 0; i < C.tracks.length; i++) {
      if (C.tracks[i].id === tb.id) { tc = C.tracks[i]; break; }
    }
    if (!tc) return tb.state;
    if (tc.state === 'cleared') return 'cleared';
    if (!(tc.state === 'blurred' && tc.clearPending)) return tb.state;
    prev = C;
  }
  return tb.state;
}

function lerp(a, b, frac) {
  return a + (b - a) * frac;
}

function lerpBox(boxA, boxB, frac) {
  return {
    x1: lerp(boxA.x1, boxB.x1, frac),
    y1: lerp(boxA.y1, boxB.y1, frac),
    x2: lerp(boxA.x2, boxB.x2, frac),
    y2: lerp(boxA.y2, boxB.y2, frac),
  };
}

// I8: how far the only-in-B (born) branch pads B's box outward, as a
// fraction of the box's own width/height, on every side. `boxesAt`
// scales this by (1 - frac) so the pad is maximal at A (frac 0, the
// oldest media time the back-dated box is presented for) and shrinks to
// exactly zero at B itself (frac 1) -- covering the SWEPT region a
// moving entrant crossed between A and B, never just their B-time
// endpoint. One rectangle, still solid -- a pad, never a split.
export var BIRTH_BACKDATE_PAD = 0.15;

// Rule 1 (1096): how long past the newest verdict a presented frame may
// still HOLD that verdict's boxes before boxesAt gives up and answers null
// (the caller then falls back to the live tracks). On the Redmi 6.9% of
// presented frames ran past the newest snapshot -- a dropped pass at a
// cut doubles the verdict gap -- and null sent the renderer to the LIVE
// tracks, a whole delay ahead of the picture, which is where 5 of 23
// covered certain-male reads and the exposure classifier's 69 'late'
// frames came from. The newest verdict is at most one gap stale; holding
// it, padded outward with lateness (one solid rectangle), is the closest
// measurement there is. Past this bound something upstream has stopped
// (a dead worker, a stalled pass) and the live path is the right owner.
export var LATE_HOLD_MS = 3000;
// The held box's outward pad reaches BIRTH_BACKDATE_PAD at this lateness.
export var LATE_PAD_FULL_MS = 1000;
// How far past B the rule-3'' lookahead may walk for a DECIDING snapshot.
export var LOOKAHEAD_MS = 3000;

// One presented entry: the resolved box/state plus the fields the
// presentation merge needs (person-track.mergePresented), read off the
// snapshot entry the box came from.
function present(src, box, state) {
  return { id: src.id, box: box, state: state, core: src.core || null, head: src.head || null, face: src.face || null,
    headX: src.headX, headW: src.headW, headY: src.headY, headH: src.headH };
}

function padBoxTowardBirth(box, frac) {
  var amt = BIRTH_BACKDATE_PAD * (1 - frac);
  var px = (box.x2 - box.x1) * amt;
  var py = (box.y2 - box.y1) * amt;
  return {
    x1: Math.max(0, box.x1 - px),
    y1: Math.max(0, box.y1 - py),
    x2: Math.min(1, box.x2 + px),
    y2: Math.min(1, box.y2 + py),
  };
}

/**
 * Boxes to present for mediaTime, following the six rules:
 *
 * 1. No B (no snapshot with mediaTime >= m) -> A's live tracks held at
 *    A's box/state, padded outward with lateness, while m is within
 *    LATE_HOLD_MS of A and no cut fell in (A.t, m]; otherwise null, and
 *    the caller falls back to the live tracks and counts it as late.
 * 2. No A (no snapshot with mediaTime <= m) -> B's tracks as-is
 *    (blur-first: cover before the first verdict has even arrived).
 * 3. A track present in both A and B -> box lerped by
 *    (m - A.t) / (B.t - A.t); state is 'blurred' if EITHER side says
 *    blurred, else 'cleared' -- the covering direction always wins.
 * 4. A track only in A (gone by B): if a cut falls in (A.t, m] it is
 *    omitted (the shot it belonged to has ended); otherwise it rides
 *    at A's box/state until B, because a detector miss must not
 *    uncover anyone.
 * 5. A track only in B (born by B): if a cut falls in (m, B.t] it is
 *    omitted (it was not in the presented frame's shot); otherwise it
 *    is back-dated to B's box/state from A onward, padded outward by up
 *    to BIRTH_BACKDATE_PAD (shrinking to zero exactly at B) rather than
 *    held at B's own box unpadded -- a moving entrant is covered along
 *    the swept region between where they were seen and where the
 *    back-dated frame presents them, not just their B-time position
 *    (phase-i I8: an unpadded hold left a walking-in subject sharp at
 *    their real position for up to one verdict interval, exactly what
 *    the delay line exists to remove).
 * 3''. A track blurred at B with `clearPending` (a certain clear credited,
 *    ladder unfinished) whose id is CLEARED at the snapshot after B, with
 *    no cut between, is treated as cleared at B -- so the interval before
 *    it is presented cleared unless A carried a certain flag. The live
 *    path clears at C either way; hindsight moves that clear one interval
 *    earlier for a person it was about to clear (1096: 7 of 23 covered
 *    certain-male reads on the Redmi were this interval).
 *
 * @param {ReturnType<typeof makeTimeline>} tl
 * @param {number} mediaTime
 * @returns {TimelineTrack[] | null}
 */
export function boxesAt(tl, mediaTime) {
  var A = findA(tl, mediaTime);
  var B = findB(tl, mediaTime);

  if (!B) {
    // Rule 1: hold the newest verdict while it is recent and still in
    // the presented frame's shot.
    if (!A) return null;
    var lateMs = (mediaTime - A.mediaTime) * 1000;
    if (lateMs > LATE_HOLD_MS) return null;
    if (cutBetween(tl, A.mediaTime, mediaTime)) return null;
    var padFrac = 1 - Math.min(1, lateMs / LATE_PAD_FULL_MS);
    return liveTracks(A).map(function (t) {
      return present(t, padBoxTowardBirth(t.box, padFrac), t.state);
    });
  }
  var bTracks = liveTracks(B);
  if (!A) {
    return bTracks.map(function (t) {
      return present(t, t.box, stateAt(tl, B, t));
    });
  }
  var aTracks = liveTracks(A);

  if (A.mediaTime === B.mediaTime) {
    // Same snapshot brackets both sides (mediaTime landed exactly on
    // a verdict); nothing to lerp.
    return aTracks.map(function (t) {
      return present(t, t.box, stateAt(tl, B, t));
    });
  }

  var byIdB = {};
  for (var i = 0; i < bTracks.length; i++) byIdB[bTracks[i].id] = bTracks[i];
  var seenB = {};
  var out = [];
  var frac = (mediaTime - A.mediaTime) / (B.mediaTime - A.mediaTime);
  // 3c: a cut on either side of the presented frame means only the
  // verdict on the frame's own side describes its shot.
  var cutAfter = cutBetween(tl, mediaTime, B.mediaTime);
  var cutBefore = cutBetween(tl, A.mediaTime, mediaTime);

  for (var j = 0; j < aTracks.length; j++) {
    var ta = aTracks[j];
    var tb = byIdB[ta.id];
    if (tb) {
      seenB[ta.id] = true;
      if (cutAfter) {
        out.push(present(ta, ta.box, ta.state));
      } else if (cutBefore) {
        out.push(present(tb, tb.box, stateAt(tl, B, tb)));
      } else {
        // 3': B cleared him and A's blur was not a certain
        // opposite-gender read (the ladder had simply not cleared him
        // yet, or he was coasting): the frame between is CLEARED in
        // hindsight. A certain flag at either side keeps it blurred.
        // 3'': B's own pending clear counts as cleared once the verdict
        // after B confirms it (stateAt).
        var state = stateAt(tl, B, tb) === 'blurred' || (ta.state === 'blurred' && ta.flagCertain)
          ? 'blurred' : 'cleared';
        out.push(present(tb, lerpBox(ta.box, tb.box, frac), state));
      }
    } else {
      // Only in A: gone by B. A cut at or before mediaTime (and after
      // A) ends it there; otherwise it survives at A's own box/state.
      if (cutBetween(tl, A.mediaTime, mediaTime)) continue;
      out.push(present(ta, ta.box, ta.state));
    }
  }

  for (var k = 0; k < bTracks.length; k++) {
    var tb2 = bTracks[k];
    if (seenB[tb2.id]) continue;
    // Only in B: born by B. A cut strictly after mediaTime (and at or
    // before B) means the presented frame is in a shot before the one
    // this track was ever seen in -- omit it. Otherwise back-date it,
    // padded toward the swept region (I8) rather than held at B's own
    // box unpadded.
    if (cutBetween(tl, mediaTime, B.mediaTime)) continue;
    out.push(present(tb2, padBoxTowardBirth(tb2.box, frac), stateAt(tl, B, tb2)));
  }

  return out;
}

/**
 * The newest recorded snapshot, or null if the timeline is empty. For
 * the late fallback: when boxesAt returns null there is no verdict at
 * or after the presented frame yet, and the caller extrapolates from
 * whatever was last known.
 * @param {ReturnType<typeof makeTimeline>} tl
 */
export function latestSnapshot(tl) {
  if (!tl.snapshots.length) return null;
  return tl.snapshots[tl.snapshots.length - 1];
}
