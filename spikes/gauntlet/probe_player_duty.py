# IS THE PLAYER BLUR ACTUALLY COVERING WHEN IT SHOULD?
#
# Loop 18 measured 25% of samples covered on a playing watch page and had
# no way to tell "nobody to cover" from "someone uncovered". This is the
# A/B that separates them: the SAME video and the SAME span, with the
# user's gender flipped. gender='woman' flags MEN, gender='man' clears
# them. If both arms read the same duty cycle, the player pass is not
# differentiating and that is a real defect. If woman >> man, it is
# working and loop 18's 25% was scene content.
import json, sys, time
from emu_cdp import page, Tab

VIDEO = "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"
START = 60

def arm(gender, seconds=60, gap=2.0):
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',
                                 shown:['home','watch_recs']}); return 1;})()""" % gender)
    time.sleep(5)
    t.cmd("Page.navigate", url=VIDEO); time.sleep(32)
    t.eval("(function(){var v=document.querySelector('#movie_player video');"
           "if(v){v.muted=true;v.currentTime=%d;v.play();} return 1})()" % START)
    # let the worker warm and the person model land
    time.sleep(25)
    Q = """(function(){
      var v=document.querySelector('#movie_player video');
      return {hosts:document.querySelectorAll('.ts-gaze-vregion-host').length,
        persons: (typeof window.__TS_GAZE_PERSONS==='number')?window.__TS_GAZE_PERSONS:null,
        whole: !!(v&&v.classList.contains('ts-gaze-pending')),
        t: v?Math.round(v.currentTime):null, paused:v?v.paused:null};})()"""
    rows=[]
    n=int(seconds/gap)
    for i in range(n):
        time.sleep(gap); rows.append(t.eval(Q))
    cov  = sum(1 for r in rows if r["hosts"]>0 or r["whole"])
    pplPresent = sum(1 for r in rows if (r["persons"] or 0)>0)
    uncovered  = sum(1 for r in rows if (r["persons"] or 0)>0 and r["hosts"]==0 and not r["whole"])
    return {"gender":gender, "samples":len(rows), "covered":cov,
            "duty": round(100.0*cov/len(rows)),
            "personsSeen": pplPresent, "personInFrameUncovered": uncovered,
            "tSpan":[rows[0]["t"], rows[-1]["t"]],
            "paused": sum(1 for r in rows if r["paused"])}

out=[arm("woman"), arm("man")]
print(json.dumps(out, indent=1))
