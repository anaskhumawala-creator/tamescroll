# HONEST VERSION: the previous run's "unclipped" was a probe artifact --
# the bar filter caught a full-height (839px) fixed overlay, so every
# patch counted as "above the bar". A top bar is SHORT and at the TOP.
import json, time
from emu_cdp import page, Tab
t=Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

ASK = """(function(){
  var bars=[];
  [].slice.call(document.querySelectorAll('body *')).forEach(function(n){
    var cs; try{cs=getComputedStyle(n);}catch(e){return;}
    if(cs.position!=='fixed'&&cs.position!=='sticky') return;
    var r=n.getBoundingClientRect();
    if(r.height<8||r.height>200||r.width<200||r.top>8||r.bottom<=0) return;
    bars.push({tag:n.tagName.toLowerCase(),bottom:Math.round(r.bottom),
               h:Math.round(r.height),z:cs.zIndex});});
  var barBottom = bars.length ? Math.max.apply(null,bars.map(function(b){return b.bottom;})) : 0;
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var un=[];
  ps.forEach(function(p){var r=p.getBoundingClientRect();
    if(r.height>2 && r.top < barBottom-2 && r.bottom>0)
      un.push({top:Math.round(r.top),h:Math.round(r.height)});});
  return {patches:ps.length,barBottom:barBottom,bars:bars,
          unclipped:un.length,sample:un.slice(0,3)};})()"""

def scroll(px):
    return t.eval("""(function(px){var room=0,best=document.scrollingElement;
      [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
        if(!n)return; var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;}});
      var b=best.scrollTop; best.scrollTop=Math.max(0,b+px); return best.scrollTop-b;})(%d)""" % px)

t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(42)
tot=0; un=0; bb=set(); steps=[]
for i in range(10):
    scroll(340); time.sleep(4)
    r=t.eval(ASK); steps.append(r); tot+=r["patches"]; un+=r["unclipped"]; bb.add(r["barBottom"])
print(json.dumps({"patchSamples":tot,"unclippedUnderTopBar":un,
                  "barBottoms":sorted(bb),"bars":steps[-1]["bars"],
                  "worst":[s["sample"] for s in steps if s["unclipped"]][:3]}, indent=1))
