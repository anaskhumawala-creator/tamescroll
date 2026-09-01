# THE INVARIANT THAT MATTERS, NOW MEASURABLE: the drawn patch must
# CONTAIN the track the pipeline asked to cover. Under-cover is exposure;
# over-cover is the deadband doing its job. Sample continuously through
# playback, a scroll, and the parked mini player.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")

SAMPLE = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  if(!v) return null;
  var vr=v.getBoundingClientRect();
  if(!(vr.width>0)) return null;
  var drawn=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect();
    return [(r.left-vr.left)/vr.width, (r.top-vr.top)/vr.height,
            (r.left-vr.left+r.width)/vr.width, (r.top-vr.top+r.height)/vr.height];});
  var tracks=[];
  try{ var e=window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS();
    if(e&&e.length){ e.forEach(function(en){ (en.tracks||[]).forEach(function(b){
      tracks.push([+b[0],+b[1],+b[2],+b[3]]);});});}
  }catch(err){}
  // every track must be inside SOME drawn patch (patches merge, so a
  // track may be covered by a union rather than its own rectangle)
  var uncovered=[];
  tracks.forEach(function(tb){
    var ok=drawn.some(function(d){
      return d[0]<=tb[0]+0.005 && d[1]<=tb[1]+0.005 &&
             d[2]>=tb[2]-0.005 && d[3]>=tb[3]-0.005;});
    if(!ok) uncovered.push({track:tb.map(function(n){return +n.toFixed(3);}),
      drawn:drawn.map(function(d){return d.map(function(n){return +n.toFixed(3);});})});});
  return {mini:document.documentElement.classList.contains('ts-mini'),
    n:drawn.length, tracks:tracks.length, uncovered:uncovered,
    t:+v.currentTime.toFixed(1), paused:v.paused};})()"""

t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55; v.play();} return 1;})()")

samples=0; withTracks=0; bad=[]
phases={}
def run(label, n, between=None):
    global samples, withTracks
    c=0; w=0; b=0
    for i in range(n):
        s=t.eval(SAMPLE)
        if s:
            samples+=1; c+=1
            if s["tracks"]:
                withTracks+=1; w+=1
                if s["uncovered"]:
                    b+=1
                    if len(bad)<4: bad.append({"phase":label, **s})
        if between: between(i)
        time.sleep(0.7)
    phases[label]={"samples":c,"withTracks":w,"underCovered":b}

run("playing", 30)
def scroll(i):
    t.eval("(function(){var e=document.scrollingElement||document.body; e.scrollBy(0,220); return 1;})()")
run("playing+scroll", 15, scroll)
# park it and keep sampling
box=t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
  return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":box[0],"y":box[1]}])
for i in range(1,9):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":box[0],"y":box[1]+int(160*i/8)}])
    time.sleep(0.03)
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(2)
run("mini", 25)
print(json.dumps({"phases":phases,"totalSamples":samples,"samplesWithTracks":withTracks,
                  "examples":bad}, indent=1))
