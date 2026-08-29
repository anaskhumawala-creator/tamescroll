// www.youtube.com registers a service worker, and what it answers itself
// never reaches our request interceptor: `/__tamescroll/gaze-page.js`
// came back as YouTube's own 404 page, so the inference worker had never
// started on desktop YouTube at all.
//
// Measured on the live app 2026-08-29: the SAME path with a query string
// walks straight through to us — 200, our 1,027,768-byte bundle, 10ms,
// and a Worker built from it answers in 52ms. The bare path, asked for
// on the same page moments later, still fails.
//
// Both interceptors match on the path and drop the query before they
// look (synthetic_resource in lib.rs, substringBefore('?') in
// MainActivity.kt), so this changes nothing on any other host.
//
// The value is the bundle stamp when there is one, read late so module
// evaluation order cannot matter.
export function synthetic(path) {
  var v;
  try {
    v = globalThis.__TS_GAZE_BUNDLE__;
  } catch (e) {
    v = null;
  }
  return path + '?v=' + (v || '1');
}
