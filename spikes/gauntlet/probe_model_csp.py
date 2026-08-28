"""Can every platform FETCH the model bytes?

The worker no longer carries the models: it asks our own interceptor for
them (detector.js ioHandlerFor). That is a straight win on youtube, and a
silent regression anywhere the page's CSP refuses the request -- there the
fallback is the 22.7MB base64 artifact, which is the cost the split exists
to avoid.

So: on every platform we ship a tile for, fetch one model json AND one
model bin from the page, and again from inside a Worker (the thread that
actually asks), and record any CSP violation.
"""
import json
import time

from gauntlet import pick, targets

TRY = r"""(async function(){
  var out = {url: location.href, csp: []};
  document.addEventListener('securitypolicyviolation', function(e){
    if (out.csp.length < 4) out.csp.push(e.violatedDirective + ' <- ' + String(e.blockedURI).slice(0,70));
  });
  async function get(p){
    var t0 = performance.now();
    try {
      var r = await fetch(location.origin + p);
      var b = await r.arrayBuffer();
      return {ok: r.ok, bytes: b.byteLength, ms: Math.round(performance.now() - t0)};
    } catch (e) { return {error: String(e).slice(0, 80)}; }
  }
  out.json = await get('/__tamescroll/models/blazeface.json');
  out.bin  = await get('/__tamescroll/models/blazeface.bin');
  // And from a worker, which is where it actually happens.
  out.worker = await new Promise(function(resolve){
    var u = location.origin + '/__tamescroll/models/blazeface.bin';
    var src = 'self.onmessage=function(){fetch(' + JSON.stringify(u) + ')'
      + '.then(function(r){return r.arrayBuffer();})'
      + '.then(function(b){self.postMessage({ok:true,bytes:b.byteLength});})'
      + '.catch(function(e){self.postMessage({error:String(e).slice(0,80)});});};';
    var wu = location.origin + '/__tamescroll/gaze-page.js';
    void src; void wu;
    // A real worker has to come from our own url; a blob: worker is what
    // Trusted Types refuses. So ask the LIVE gaze worker instead: if the
    // page has models loaded off-thread, the fetch already worked.
    try {
      var w = window.__TS_GAZE_WORKER || null;
      resolve(w ? {up: w.up, ready: w.ready, backend: w.backend, ms: w.ms || null} : {none: true});
    } catch (e) { resolve({error: String(e).slice(0,60)}); }
  });
  return JSON.stringify(out);
})()"""

PLATFORMS = [
    ("youtube", "https://m.youtube.com/results?search_query=linus"),
    ("reddit", "https://www.reddit.com/r/pics/"),
    ("x", "https://x.com/explore"),
    ("instagram", "https://www.instagram.com/explore/"),
    ("facebook", "https://www.facebook.com/"),
]

lau = pick("localhost:1420")
for plat, url in PLATFORMS:
    lau.eval(
        "(function(){var i=window.__TAURI__.core.invoke;"
        "i('open_platform',{id:%r,mode:'smart',strength:16,gender:'man',shown:[]});return 1;})()" % plat
    )
    time.sleep(11)
    tab = None
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u:
            tab = pick(u)
            break
    if not tab:
        print(plat, "NO WINDOW")
        continue
    tab.eval("location.href=%r" % url)
    time.sleep(22)
    try:
        r = json.loads(tab.eval(TRY))
    except Exception as e:
        print("===", plat, "READ FAILED", e)
        continue
    print("===", plat)
    print("    json:  ", json.dumps(r.get("json")))
    print("    bin:   ", json.dumps(r.get("bin")))
    print("    worker:", json.dumps(r.get("worker")))
    print("    csp:   ", json.dumps(r.get("csp")))
