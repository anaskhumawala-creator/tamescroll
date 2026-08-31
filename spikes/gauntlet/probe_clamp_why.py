# WHY IS A PATCH RIDING UP INTO THE STICKY PLAYER'S BAND UNCLIPPED?
# Replicate occluderBottom's own arithmetic at its own sample point and
# compare with what the patch is actually doing.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

SAMPLE = """(function(){
  var pc=document.querySelector('#player-container-id');
  if(!pc) return {err:'no player'};
  var pr=pc.getBoundingClientRect();
  var vh=innerHeight;
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ')[0]:'');};
  function occluderBottom(x,y,el){
    var hits=document.elementsFromPoint(x,y);
    if(!hits||!hits.length) return {occ:0,why:'no hits'};
    for(var i=0;i<hits.length;i++){
      var node=hits[i];
      if(node===el||(node.contains&&node.contains(el))) return {occ:0,why:'our image on top: '+nm(node)};
      for(var up=node; up && up!==document.body; up=up.parentElement){
        if(up.contains&&up.contains(el)) break;
        var pos=getComputedStyle(up).position;
        if(pos==='fixed'||pos==='sticky'){
          var r=up.getBoundingClientRect();
          if(r.height>0&&r.bottom>y) return {occ:Math.round(r.bottom),why:nm(up)};
        }
      }
    }
    return {occ:0,why:'walked all hits, nothing fixed'};
  }
  var out=[];
  [].slice.call(document.querySelectorAll('.ts-gaze-region-patch')).forEach(function(p){
    var cs=getComputedStyle(p); var r=p.getBoundingClientRect();
    if(cs.display==='none'||r.height<=0) return;
    if(!(r.bottom>pr.top+1 && r.top<pr.bottom-1)) return;   // only band cases
    // find the image this patch belongs to: the host's own img
    var host=p.parentElement;
    var im=host?host.querySelector('img'):null;
    var er=im?im.getBoundingClientRect():null;
    var gate = er? (er.top < vh*0.6 && er.bottom>0) : null;
    var res = er? occluderBottom(Math.round(er.left+er.width/2), Math.max(1,Math.round(er.top+1)), im)
                : {occ:null,why:'no img in host'};
    out.push({patch:[r.left|0,r.top|0,r.width|0,r.height|0],
              img: er?[er.left|0,er.top|0,er.width|0,er.height|0]:null,
              gatePassed: gate, sampleY: er?Math.max(1,Math.round(er.top+1)):null,
              occWouldBe: res.occ, occFrom: res.why,
              patchClampedTo: (r.top|0)});
  });
  return {playerBand:[pr.top|0,pr.bottom|0], vh:vh, band:out,
          scrollY:Math.round(document.scrollingElement.scrollTop)};})()"""

def scroll(px):
    t.eval("(function(){window.scrollBy(0,%d);document.scrollingElement.scrollTop+=%d;document.body.scrollTop+=%d;return 1})()" % (px,px,px))

found=[]
for d in (110,110,-110):
    for i in range(16):
        scroll(d); time.sleep(0.5)
        s=t.eval(SAMPLE)
        if s.get("band"): found.append(s)
        if len(found)>=4: break
    if len(found)>=4: break
print(json.dumps({"hits":len(found), "detail":found[:4]}, indent=1))
