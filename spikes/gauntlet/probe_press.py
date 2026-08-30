"""Owner: scrolling the home feed shows a "pressing impression" on
thumbnails, unlike the native YouTube app.

Our injected CSS already kills -webkit-tap-highlight-color on platform
pages (lib.rs), so whatever he is seeing is the PAGE's own press
feedback. This drives a real touch-scroll through CDP and records every
class/attribute/style change while it happens, so the mechanism gets
named from the live DOM instead of guessed.
"""
import json
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

WATCH = r"""(function(){
  window.__ts_mut = [];
  if (window.__ts_obs) window.__ts_obs.disconnect();
  window.__ts_obs = new MutationObserver(function(recs){
    recs.forEach(function(r){
      if (window.__ts_mut.length > 200) return;
      var t = r.target;
      if (r.type === 'attributes') {
        window.__ts_mut.push({
          k: 'attr', name: r.attributeName,
          el: t.tagName ? t.tagName.toLowerCase() : String(t),
          cls: (t.className && t.className.baseVal !== undefined ? t.className.baseVal : t.className || '').toString().slice(0,60),
          val: (t.getAttribute && t.getAttribute(r.attributeName) || '').slice(0,60)
        });
      } else {
        [].forEach.call(r.addedNodes, function(n){
          if (!n.tagName) return;
          window.__ts_mut.push({k:'added', el:n.tagName.toLowerCase(),
            cls:(n.className||'').toString().slice(0,60)});
        });
      }
    });
  });
  window.__ts_obs.observe(document.documentElement,
    {subtree:true, attributes:true, childList:true,
     attributeFilter:['class','style','pressed','active','data-touch']});
  var t = document.querySelector('ytm-rich-item-renderer, ytm-video-with-context-renderer');
  if (!t) return JSON.stringify({target:null});
  var r = t.getBoundingClientRect();
  return JSON.stringify({target:t.tagName.toLowerCase(),
    x:Math.round(r.left+r.width/2), y:Math.round(r.top+Math.min(60,r.height/2))});
})()"""

for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau = pick("localhost:1420")
lau.eval(
    "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
    ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()"
)
time.sleep(10)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.eval("location.href='https://m.youtube.com/'")
time.sleep=getattr(time, 'sleep')
time.sleep(22)

info = json.loads(tab.eval(WATCH))
print("target:", info)
if info.get("target"):
    x, y = info["x"], info["y"]
    tab.cmd("Input.dispatchTouchEvent", type="touchStart",
            touchPoints=[{"x": x, "y": y}])
    # A scroll: the finger moves before it lifts, and never taps.
    for dy in range(20, 220, 20):
        tab.cmd("Input.dispatchTouchEvent", type="touchMove",
                touchPoints=[{"x": x, "y": y - dy}])
        time.sleep(0.03)
    tab.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1)
    muts = json.loads(tab.eval("JSON.stringify(window.__ts_mut.slice(0,40))"))
    print("mutations during the scroll:", len(muts))
    seen = {}
    for m in muts:
        key = (m.get("k"), m.get("el"), m.get("name"), m.get("cls"))
        seen[key] = seen.get(key, 0) + 1
    for k, n in sorted(seen.items(), key=lambda kv: -kv[1])[:15]:
        print("  x%-3d %s" % (n, k))
