# IS THE FIRST IMAGE OF EVERY DISTINCT SIZE PAYING FOR SHADER COMPILATION?
#
# The warm-up compiles the three graphs on ONE blank 256x256 frame with
# ONE face box. Real thumbnails arrive at their natural size
# (createImageBitmap(el), no resize) and carry 0..N faces, and tfjs keys
# its compiled WebGL programs by TENSOR SHAPE -- so a feed of mixed
# thumbnail sizes could be recompiling the whole chain per new size.
#
# This reads the diagnostic ring and asks the only question that settles
# it: within one page, is the FIRST image of a given width much more
# expensive than the later ones at that same width?  JSON only, headless.
import json, time, sys, io
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = sys.argv[1] if len(sys.argv) > 1 else \
    "https://m.youtube.com/results?search_query=interview"

def open_youtube():
    t = Tab(page()); t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      var shown=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}').youtube||[];
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
        gender:localStorage.getItem('tamescroll.gender')||'man',shown:shown});
      return 1;})()""")
    time.sleep(5)

open_youtube()
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url=URL)

def settle(tab, rounds=40):
    last, stable = -1, 0
    for _ in range(rounds):
        time.sleep(2)
        try:
            n = tab.eval("window.__TS_GAZE_IMGTOTAL||0")
        except Exception:
            return None
        if n == last and n > 0:
            stable += 1
            if stable >= 3:
                return tab
        else:
            stable = 0
        last = n
    return tab

t = settle(t) or t
# More images, and more DISTINCT sizes: a search feed mixes 16:9 poster
# thumbnails with square avatars and channel art.
for _ in range(4):
    try:
        t.eval("window.scrollBy(0,1400);1")
    except Exception:
        break
    time.sleep(1)
    settle(t, rounds=12)

out = t.eval("""(function(){
  var d=(window.__TS_GAZE_IMGDIAG||[]).filter(function(e){return e && e.where==='worker';});
  var byW={};
  d.forEach(function(e){
    var k=String(e.w||0)+'x'+String(e.faces==null?'?':e.faces);
    (byW[k]=byW[k]||[]).push({face:e.face,ms:e.ms,main:e.main});
  });
  var byWidth={};
  d.forEach(function(e){ (byWidth[String(e.w||0)]=byWidth[String(e.w||0)]||[]).push(e.face); });
  return {
    total: window.__TS_GAZE_IMGTOTAL||0,
    n: d.length,
    seq: d.map(function(e){return [e.t,e.face,e.ms,e.main,e.w,e.faces,e.why];}),
    byWidthFaces: byW,
    byWidth: byWidth,
    widths: Object.keys(byWidth).length
  };})()""")
io.open("shape-cost.json","w",encoding="utf-8").write(json.dumps(out,indent=1))

def med(v):
    v = sorted(x for x in v if isinstance(x, (int, float)))
    return None if not v else v[len(v)//2]

# The question is not "how long", it is "what drives it". Drop the first
# three images of the page -- they are still paying the warm-up tail --
# and group what is left by source width and by face count.
seq = [e for e in out["seq"] if e[1] is not None][3:]
byw, byf = {}, {}
for t, face, ms, main, w, faces, why in seq:
    byw.setdefault(w, []).append(face)
    byf.setdefault(faces, []).append(face)
print(json.dumps({
    "n_settled": len(seq),
    "by_source_width": {str(k): [len(v), med(v)] for k, v in sorted(byw.items(), key=lambda kv: kv[0] or 0)},
    "by_face_count": {str(k): [len(v), med(v)] for k, v in sorted(byf.items(), key=lambda kv: kv[0] or 0)},
    "rare_widths": [[e[4], e[5], e[1], e[6]] for e in seq if byw.get(e[4]) and len(byw[e[4]]) == 1],
    "main_thread_ms_max": max((e[3] or 0) for e in seq) if seq else None,
}, indent=1))
