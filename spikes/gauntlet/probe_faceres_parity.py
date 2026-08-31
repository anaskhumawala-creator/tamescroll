# SAME INPUT, BOTH MODELS -- the parity gate on re-quantising faceres.
#
# faceres is 6.98MB of the bundle and it is float16; our own hybrid
# uint8 requant (build/requant-uint8.py, written for MoveNet) takes it
# to 3.51MB. THAT IS A BYTE COUNT, NOT EVIDENCE. Full uint8 produced
# DEAD OUTPUT on MoveNet's depthwise convs (2.8 abs error, 2026-08-24),
# and faceres is the model that decides WHO GETS BLURRED -- so the gate
# is output parity on real inputs, measured on the device that matters.
#
# Runs on his phone (the WebGL that ships), fetches real ytimg
# thumbnails, and compares all three heads: the gender sigmoid, the age
# posterior's child mass, and the 1024-d identity descriptor.
# Nothing is rendered -- the page holds no visible element, the crops
# are drawn to a detached canvas.
#
# Host side: python -m http.server 8899 in spikes/faceres-parity, plus
# `adb reverse tcp:8899 tcp:8899`.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
QUERY = sys.argv[2] if len(sys.argv) > 2 else 'podcast interview'

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")

# 1. A REAL POPULATION, not a fixture list I chose. Search results are
#    the pixels the image path actually judges.
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=" + QUERY.replace(' ', '+'))
time.sleep(22)
ids = t.eval("""(function(){
  var out=[], seen={};
  var as=document.querySelectorAll('a[href*="/watch?v="]');
  for(var i=0;i<as.length;i++){
    var m=/[?&]v=([A-Za-z0-9_-]{11})/.exec(as[i].getAttribute('href')||'');
    if(m && !seen[m[1]]){ seen[m[1]]=1; out.push(m[1]); }
  }
  return JSON.stringify(out.slice(0,24));})()""")
ids = json.loads(ids) if isinstance(ids, str) else []
print("ids", len(ids), ids[:6])
if not ids:
    print("NO IDS -- search did not render; nothing to measure"); sys.exit(1)

# 2. The bench is a plain local page. Our interceptor only answers
#    /__tamescroll/, so http://localhost:8899 reaches the host server
#    through `adb reverse` untouched.
t.cmd("Page.navigate", url="http://localhost:8899/bench.html")
for _ in range(40):
    time.sleep(1)
    if t.eval("(function(){return window.__READY?1:0;})()") == 1: break
print("bench ready", t.eval("(function(){return !!window.__RUN;})()"))

t.eval("(function(){window.__OUT=null;window.__ERR=null;"
       "window.__RUN(%s).then(function(r){window.__OUT=r;})"
       ".catch(function(e){window.__ERR=String(e&&e.stack||e);});return 1;})()"
       % json.dumps(ids))

for _ in range(180):
    time.sleep(2)
    err = t.eval("(function(){return window.__ERR;})()")
    if err: print("ERROR", err); sys.exit(2)
    out = t.eval("(function(){return window.__OUT;})()")
    if out:
        print(json.dumps(json.loads(out), indent=1)); sys.exit(0)
print("TIMED OUT", t.eval("(function(){return window.__ERR||'no result';})()"))
