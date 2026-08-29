// A TIMEOUT IS NOT A VERDICT.
//
// MEASURED on a real Android WebView 2026-08-30: the first two images of
// a navigation came back `worker timeout` at 20.6s, and the third -- the
// same avatar, judged normally -- landed at 23.8s. The worker was not
// broken; it was still compiling shaders for tensor shapes a blank
// warm-up frame never produces, and the 15s request timeout fired
// underneath it.
//
// Failing closed on that is right. Failing closed FOREVER is not: nothing
// put the image back on the queue, so it stayed covered for the life of
// the page and looked identical to one still waiting. That is the
// owner's oldest report -- "it processes some, then it halts".
//
// The decision lives here, away from the DOM, because the bound is the
// whole safety argument: an image that genuinely cannot be judged (CORS
// refused, decode failure) has to settle into staying covered rather
// than looping over a queue forever.

export var IMAGE_MAX_TRIES = 3;

/// Should a failed image go back on the queue?
///
/// `tries` is how many times it has already failed, INCLUDING the one
/// that just happened. Retrying is only ever safe because the image is
/// still covered while it waits: the worst case is that it stays exactly
/// as covered as it already was.
export function shouldRetry(tries, opts) {
  var o = opts || {};
  if (!(tries > 0)) return false;
  if (tries >= (o.max == null ? IMAGE_MAX_TRIES : o.max)) return false;
  // Gone from the document, or already waiting its turn again.
  if (o.connected === false) return false;
  if (o.queued) return false;
  return true;
}
