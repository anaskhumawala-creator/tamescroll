# Where does the scroll cost go: our INFERENCE, or the pixels our blur
# asks the compositor for? Same page, same gesture, gaze smart in both
# runs -- the second one keeps every model running and only neutralises
# the blur CSS, so the delta is paint, not compute.
import json, time
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = "https://m.youtube.com/results?search_query=linus+tech+tips"
KILL = ("img.ts-gaze-pending,img.ts-gaze-flagged{filter:none !important}"
        ".ts-gaze-patch{backdrop-filter:none !important;"
        "-webkit-backdrop-filter:none !important}")

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

def run(label, kill_blur):
    open_youtube()
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=URL)
    time.sleep(35)
    if kill_blur:
        t.eval("""(function(){var s=document.createElement('style');
          s.id='ts-killblur'; s.textContent=%s;
          document.documentElement.appendChild(s);})()""" % json.dumps(KILL))
        time.sleep(1)
    pre = t.eval("""(function(){return {
      blurred:document.querySelectorAll('img.ts-gaze-pending,img.ts-gaze-flagged').length,
      patches:document.querySelectorAll('.ts-gaze-patch').length};})()""")
    t.eval("""(function(){window.__F=[];var last=performance.now();
      (function loop(){var n=performance.now();window.__F.push(n-last);last=n;
        requestAnimationFrame(loop);})();window.__Y0=window.scrollY;})()""")
    t0 = t.eval("performance.now()")
    for _ in range(8):
        t.eval("window.scrollBy(0,700)"); time.sleep(0.75)
    time.sleep(1.0)
    t1 = t.eval("performance.now()")
    r = t.eval("""(function(){var f=window.__F||[];
      return {frames:f.length, dropped:f.filter(function(d){return d>32;}).length,
        scrolled:Math.round(window.scrollY-(window.__Y0||0))};})()""")
    r.update(pre); r["run"] = label
    r["secs"] = round((t1 - t0) / 1000, 2)
    r["fps"] = round(r["frames"] / r["secs"], 1) if r["secs"] else None
    return r

out = {"blur_on": run("blur painting", False), "blur_off": run("blur neutralised", True)}
out["fps_gain_from_not_painting_blur"] = round(out["blur_off"]["fps"] - out["blur_on"]["fps"], 1)
print(json.dumps(out, indent=1))
