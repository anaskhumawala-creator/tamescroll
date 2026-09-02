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
    return { id: t.id, box: t.box, state: t.state };
  });
  tl.snapshots.push({ mediaTime: mediaTime, tracks: copy });
  tl.snapshots.sort(function (a, b) {
    return a.mediaTime - b.mediaTime;
  });
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

/**
 * Boxes to present for mediaTime, following the six rules:
 *
 * 1. No B (no snapshot with mediaTime >= m) -> null. Caller falls back
 *    to extrapolating latestSnapshot and should count it as late.
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
 *    is back-dated to B's box/state from A onward -- zero exposure,
 *    at most one verdict interval of false cover.
 *
 * @param {ReturnType<typeof makeTimeline>} tl
 * @param {number} mediaTime
 * @returns {TimelineTrack[] | null}
 */
export function boxesAt(tl, mediaTime) {
  var A = findA(tl, mediaTime);
  var B = findB(tl, mediaTime);

  if (!B) return null;
  if (!A) {
    return B.tracks.map(function (t) {
      return { id: t.id, box: t.box, state: t.state };
    });
  }

  if (A.mediaTime === B.mediaTime) {
    // Same snapshot brackets both sides (mediaTime landed exactly on
    // a verdict); nothing to lerp.
    return A.tracks.map(function (t) {
      return { id: t.id, box: t.box, state: t.state };
    });
  }

  var byIdB = {};
  for (var i = 0; i < B.tracks.length; i++) byIdB[B.tracks[i].id] = B.tracks[i];
  var seenB = {};
  var out = [];
  var frac = (mediaTime - A.mediaTime) / (B.mediaTime - A.mediaTime);

  for (var j = 0; j < A.tracks.length; j++) {
    var ta = A.tracks[j];
    var tb = byIdB[ta.id];
    if (tb) {
      seenB[ta.id] = true;
      out.push({
        id: ta.id,
        box: lerpBox(ta.box, tb.box, frac),
        state: ta.state === 'blurred' || tb.state === 'blurred' ? 'blurred' : 'cleared',
      });
    } else {
      // Only in A: gone by B. A cut at or before mediaTime (and after
      // A) ends it there; otherwise it survives at A's own box/state.
      if (cutBetween(tl, A.mediaTime, mediaTime)) continue;
      out.push({ id: ta.id, box: ta.box, state: ta.state });
    }
  }

  for (var k = 0; k < B.tracks.length; k++) {
    var tb2 = B.tracks[k];
    if (seenB[tb2.id]) continue;
    // Only in B: born by B. A cut strictly after mediaTime (and at or
    // before B) means the presented frame is in a shot before the one
    // this track was ever seen in -- omit it. Otherwise back-date it.
    if (cutBetween(tl, mediaTime, B.mediaTime)) continue;
    out.push({ id: tb2.id, box: tb2.box, state: tb2.state });
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
