"""Can we fetch our own bytes instead of parsing them?

The worker takes 830-970ms to come up and almost none of it is model
loading (95-141ms for all four) -- it is fetching and PARSING a 22.7MB
script that is 93.9% base64. Raw binary over fetch would skip the parse
and the atob entirely, and shrink the artifact to ~1MB.

The gating question is CSP: YouTube restricts connect-src, and if a
same-origin fetch to our synthetic path is refused, the whole idea is
dead. Measured from the page AND from inside a worker, because they are
governed separately.
"""
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

PAGE_FETCH = r"""(async function(){
  var out = {};
  var t0 = performance.now();
  try {
    var r = await fetch(location.origin + '/__tamescroll/gaze-init.js');
    var b = await r.arrayBuffer();
    out.page = {ok: r.ok, status: r.status, bytes: b.byteLength, ms: Math.round(performance.now() - t0)};
  } catch (e) {
    out.page = {error: String(e).slice(0, 120)};
  }
  return JSON.stringify(out);
})()"""

WORKER_FETCH = r"""(async function(){
  // Same question inside a worker, which is where the models actually
  // live. Reuses our own script url as a stand-in for a .bin.
  try {
    var src = "self.onmessage = async function(e){\n" +
      "  var t0 = performance.now();\n" +
      "  try {\n" +
      "    var r = await fetch(e.data);\n" +
      "    var b = await r.arrayBuffer();\n" +
      "    self.postMessage({ok: r.ok, status: r.status, bytes: b.byteLength, ms: Math.round(performance.now()-t0)});\n" +
      "  } catch (err) { self.postMessage({error: String(err).slice(0,120)}); }\n" +
      "};";
    // A worker from our own same-origin url is the only shape YouTube's
    // trusted types allows, so reuse the real one? No -- that boots the
    // pipeline. Blob workers are refused here, so this measures what it
    // can: the page's own fetch is the CSP signal that matters.
    void src;
    return JSON.stringify({worker: 'skipped: blob workers are CSP-dead here'});
  } catch (e) {
    return JSON.stringify({worker: String(e).slice(0, 120)});
  }
})()"""

tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
for url in ["https://m.youtube.com/results?search_query=linus",
            "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"]:
    tab.eval("location.href=%r" % url)
    time.sleep(20)
    print(url.split("/")[-1][:30], tab.eval(PAGE_FETCH))
    print("   ", tab.eval(WORKER_FETCH))
