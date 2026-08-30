# DOES AN IMAGE WE HAVE ALREADY PATCHED EVER CHANGE PARENT?
#
# region-blur caches `entry.host` at mint time. applyRegionBlur
# re-resolves it when the element has been reparented -- but only if a
# NEW verdict arrives for that element. The 4Hz sweep does not check it:
# it checks that host and element are still connected, and that the host
# has not BECOME the player. So an image reparented with no new verdict
# keeps a patch hosted by a stale container, and inherits that
# container's stacking context instead of its real parent's.
#
# Before changing anything: does m.youtube actually reparent images?
# probe_recycle answered the neighbouring question (src/srcset swaps: 0);
# this one watches parentElement itself across a real scroll.
import json, time, sys
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = sys.argv[1] if len(sys.argv) > 1 else \
    "https://m.youtube.com/results?search_query=interview"

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

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url=URL)
time.sleep(14)

# Remember every image's parent, then scroll, then compare. A WeakMap
# cannot be enumerated, so the identity is carried on the element.
t.eval("""(function(){
  window.__TS_RP={moved:0, seen:0, samples:[]};
  var n=0;
  [].slice.call(document.images).forEach(function(i){
    i.__tsRpId=++n; i.__tsRpParent=i.parentElement; window.__TS_RP.seen++;
  });
  return 1;})()""")
for _ in range(8):
    try:
        t.eval("window.scrollBy(0,1200);1")
    except Exception:
        break
    time.sleep(2)
    t.eval("""(function(){
      var s=window.__TS_RP;
      [].slice.call(document.images).forEach(function(i){
        if(!i.__tsRpId){ i.__tsRpId=-1; i.__tsRpParent=i.parentElement; s.seen++; return; }
        if(i.__tsRpParent && i.parentElement && i.__tsRpParent!==i.parentElement){
          s.moved++;
          if(s.samples.length<5) s.samples.push([
            (i.__tsRpParent.tagName||'')+'.'+((i.__tsRpParent.className||'')+'').slice(0,30),
            (i.parentElement.tagName||'')+'.'+((i.parentElement.className||'')+'').slice(0,30),
            Math.round(i.naturalWidth||0)]);
          i.__tsRpParent=i.parentElement;
        }
      });
      return 1;})()""")

print(json.dumps(t.eval("""(function(){
  var s=window.__TS_RP||{};
  // And the population that matters: elements that region-blur is
  // actually hosting a patch for right now.
  var patched=[].slice.call(document.querySelectorAll('[data-ts-region]')).length;
  return {seen:s.seen, movedParent:s.moved, samples:s.samples,
          patchedNow:patched, judged:window.__TS_GAZE_IMGTOTAL||0};
})()"""), indent=1))
