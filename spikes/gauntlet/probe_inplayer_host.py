# THE LAST TWO ANGLES ON HIS BUG:
#   (a) a patch whose HOST is inside the player subtree -- m.youtube
#       plays feed previews into the SHARED #movie_player, so a thumbnail
#       that is previewing has its <img> inside the player. resolveHost
#       refuses that host, and the 500ms sweep is supposed to catch an
#       element that MOVED in afterwards. Verify it fires.
#   (b) the occluder clamp failing to sample -- count patches whose top
#       is above a fixed bar's bottom while carrying no clamp.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','search_inserts','watch_recs','previews']});
  return 1;})()""")
time.sleep(5)

ASK = """(function(){
  var mp=document.querySelector('#movie_player');
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var inPlayer=0, unclipped=[], bars=[];
  // every fixed/sticky box that is page chrome
  [].slice.call(document.querySelectorAll('body *')).forEach(function(n){
    var cs; try{cs=getComputedStyle(n);}catch(e){return;}
    if(cs.position!=='fixed'&&cs.position!=='sticky') return;
    var r=n.getBoundingClientRect();
    if(r.height<8||r.width<80||r.top>200) return;
    bars.push({tag:n.tagName.toLowerCase(),bottom:Math.round(r.bottom),z:cs.zIndex});
  });
  var barBottom = bars.length ? Math.max.apply(null,bars.map(function(b){return b.bottom;})) : 0;
  ps.forEach(function(p){
    if(mp && mp.contains(p)) inPlayer++;
    var r=p.getBoundingClientRect();
    if(r.height>2 && r.top < barBottom - 2 && r.bottom > 0){
      unclipped.push({top:Math.round(r.top),h:Math.round(r.height),
                      barBottom:barBottom});
    }
  });
  return {path:location.pathname, patches:ps.length,
    hostInPlayer:inPlayer, barBottom:barBottom, bars:bars.slice(0,3),
    unclipped:unclipped.length, sample:unclipped.slice(0,4),
    previewPlaying:!!(mp && mp.querySelector('video') &&
                      !mp.querySelector('video').paused)};})()"""

def scroll(px):
    return t.eval("""(function(px){var room=0,best=document.scrollingElement;
      [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
        if(!n)return; var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;}});
      var b=best.scrollTop; best.scrollTop=Math.max(0,b+px); return best.scrollTop-b;})(%d)""" % px)

out={}
for name,url in (("home","https://m.youtube.com/"),
                 ("search","https://m.youtube.com/results?search_query=podcast+interview")):
    t.cmd("Page.navigate", url=url); time.sleep(42)
    steps=[]
    for i in range(9):
        scroll(340); time.sleep(4)
        steps.append(t.eval(ASK))
    out[name]={"totalPatchSamples":sum(s["patches"] for s in steps),
               "hostInPlayer":sum(s["hostInPlayer"] for s in steps),
               "unclipped":sum(s["unclipped"] for s in steps),
               "previewPlayingSteps":sum(1 for s in steps if s["previewPlaying"]),
               "barBottom":[s["barBottom"] for s in steps],
               "steps":steps}
print(json.dumps(out, indent=1))
