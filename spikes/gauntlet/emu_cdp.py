import json, urllib.request
try:
    from websocket import create_connection
except ImportError:
    raise SystemExit("pip install websocket-client")

def page(port=9224, want="youtube"):
    ts = json.load(urllib.request.urlopen("http://127.0.0.1:%d/json/list" % port))
    for t in ts:
        if t.get("type") == "page" and want in t.get("url", ""):
            return t["webSocketDebuggerUrl"]
    for t in ts:
        if t.get("type") == "page":
            return t["webSocketDebuggerUrl"]
    raise SystemExit("no page")

class Tab:
    def __init__(self, url):
        self.ws = create_connection(url, suppress_origin=True, timeout=90)
        self.i = 0
    def cmd(self, method, **params):
        self.i += 1
        self.ws.send(json.dumps({"id": self.i, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.i:
                return m
    def eval(self, expr):
        r = self.cmd("Runtime.evaluate", expression=expr, returnByValue=True,
                     awaitPromise=True)
        res = r.get("result", {}).get("result", {})
        return res.get("value", res)


# A `display: none` overlay is still in the DOM and still in
# entry.tracks -- video-region sets it when the clip falls entirely
# outside the picture, or when the video rect measures zero. Its
# getBoundingClientRect is 0x0 at the origin, so a probe that counts or
# normalizes it reports coverage that paints nothing. That produced a
# 6.3673 "shortfall" twice and it was arithmetic, not a defect
# (docs/technical-findings.md).
#
# Usage inside an evaluated snippet:
#     var patches = (SNIPPET)('.ts-gaze-vregion-host');
VISIBLE_PATCHES_JS = """(function(sel){
  return [].slice.call(document.querySelectorAll(sel)).filter(function(o){
    if (getComputedStyle(o).display === 'none') return false;
    var r = o.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
})"""
