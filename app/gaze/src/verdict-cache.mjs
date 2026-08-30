// THE SAME AVATAR, JUDGED AGAIN AND AGAIN.
//
// Loop 9 measured what an image costs: ~310ms to detect plus ~1.25s per
// face, and it does not care how big the source is. So a url we have
// already judged is that whole cost paid a second time for pixels that
// cannot have changed.
//
// An older note in this repo says a url verdict cache hits 4-8% and is
// not worth it. That was measured over THUMBNAILS, whose `sqp` parameter
// varies the crop per surface, and it is still true: 28 thumbnails on a
// settled m.youtube search, 28 distinct urls, 0 repeats. AVATARS are a
// different population -- a channel picture has no sqp and the same
// channel appears repeatedly. Same page: 20 avatars, 14 distinct,
// **30% repeats**.
//
// Two things make replaying a verdict safe here, and both are load
// bearing:
//
//   1. The key is the EXACT, untruncated url. The old objection -- that
//      a flagged verdict carries boxes which would land wrong on another
//      crop -- is an objection to a PATH-only key. Identical urls are
//      identical pixels, so the boxes land exactly where they were
//      measured. Boxes are normalised 0..1, so the rendered size of the
//      element does not enter into it either.
//   2. The cache lives and dies with the page. Nothing is persisted, so
//      the worst staleness possible is one page view, and the failure
//      mode that a persisted cache would have -- a clear verdict
//      outliving the bytes it was made from -- cannot happen.
//
// It is bounded, because a long infinite-scroll session must not grow a
// map forever. Map preserves insertion order, so the oldest key is the
// first one iteration yields.

export var VERDICT_CACHE_MAX = 200;

// The nsfw question is asked of thumbnails and skipped for avatars
// (IMAGE_MIN_FACE_SIZE), so a face-only verdict must never be served to
// a caller that needed the nsfw answer as well. That is what the flag in
// the key is for.
export function verdictKey(url, noNsfw) {
  if (typeof url !== 'string') return null;
  if (url.length < 8) return null;
  // A data: url is the image itself; keying on it would put the whole
  // payload in the map for no benefit, since it cannot repeat cheaply.
  if (url.slice(0, 5) === 'data:') return null;
  return url + (noNsfw ? '|f' : '|n');
}

export function makeVerdictCache(max) {
  var cap = typeof max === 'number' && max > 0 ? max : VERDICT_CACHE_MAX;
  var map = new Map();
  return {
    get: function (key) {
      if (!key) return null;
      var v = map.get(key);
      return v === undefined ? null : v;
    },
    set: function (key, verdict) {
      if (!key || !verdict) return false;
      // An error is not a verdict. Replaying one would turn a single
      // transient failure into a permanently covered image everywhere
      // that url appears.
      if (verdict.error) return false;
      if (map.has(key)) map.delete(key);
      map.set(key, verdict);
      while (map.size > cap) {
        var oldest = map.keys().next();
        if (oldest.done) break;
        map.delete(oldest.value);
      }
      return true;
    },
    get size() {
      return map.size;
    },
  };
}
