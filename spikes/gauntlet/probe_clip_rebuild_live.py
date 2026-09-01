# DOES THE RE-PARENT ACTUALLY RESTORE A PATCH ON A BUILT APK?
#
# probe_clip_strand.py found 4 removals of our clip layer in a real
# session and every one had `kids: 0` -- which is OUR OWN `clear(video)`
# (it removes the overlays first, then the layer), not the page. So the
# exposure is UNPROVEN in the wild and `clipRebuilt` 0 is explained
# rather than merely observed.
#
# That leaves the other half: if the page ever DOES take a populated
# layer, does 52df023 bring the patches back? The test asserts it against
# a stub. This asserts it against the shipping bundle on a device, by
# removing the layer the way a page would while a subject is covered.
import sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(30)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=217; v.play();} return 1;})()")

STATE = r"""(function(){
  var r = window.__TS_GAZE_RENDER ? window.__TS_GAZE_RENDER() : null;
  var vt = window.__TS_GAZE_VTRACKS ? window.__TS_GAZE_VTRACKS() : [];
  var tracks=0; for(var i=0;i<(vt||[]).length;i++) tracks += ((vt[i].tracks||[]).length);
  var vis=0, ov=document.querySelectorAll('.ts-gaze-vregion-clip > *');
  for(var k=0;k<ov.length;k++){ var pr=ov[k].getBoundingClientRect();
    if(pr.width>0&&pr.height>0&&getComputedStyle(ov[k]).display!=='none') vis++; }
  return JSON.stringify({tracks:tracks, layers:document.querySelectorAll('.ts-gaze-vregion-clip').length,
    overlaysInLayer:ov.length, visible:vis, clipRebuilt:r&&r.clipRebuilt,
    orphans:document.querySelectorAll('#movie_player > .ts-gaze-region, #movie_player > div[style*="backdrop"]').length});
})()"""

# An arm that measures nothing reads exactly like a clean one: refuse to
# run unless somebody is actually covered.
covered = False
for _ in range(20):
    time.sleep(5)
    import json as J
    s = J.loads(t.eval(STATE))
    if s["visible"] > 0:
        covered = True
        break
print("BEFORE", t.eval(STATE))
if not covered:
    print("ABORT nobody covered -- this arm measures nothing"); sys.exit(1)

# Remove the layer the way a page rebuilding its own subtree would:
# the layer goes WITH its children still inside it.
print("REMOVED_KIDS", t.eval(
  "(function(){var c=document.querySelector('.ts-gaze-vregion-clip'); if(!c) return 'none';"
  "var n=c.childElementCount; c.parentNode.removeChild(c); return String(n);})()"))
for i in range(6):
    time.sleep(2)
    print("AFTER+%ds" % ((i+1)*2), t.eval(STATE))
