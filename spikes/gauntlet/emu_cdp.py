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
