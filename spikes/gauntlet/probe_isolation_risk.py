# ISOLATION IS A LIVE MUTATION ON SOMEONE ELSE'S PAGE.
#
# resolveHost now writes isolation:isolate on EVERY patch host (13/13
# last measured). That creates a stacking context on YouTube's own
# element, and anything inside it that relied on escaping to the root
# to paint over outside content can no longer do so.
#
# The question: does any descendant of a host actually paint outside
# the host's box? If none does, the write is visually inert.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)

SCAN = """(function(){
  // Every element our resolveHost would pick: the parent of a judged image.
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  var seen=[], hosts=[];
  imgs.forEach(function(im){
    var h=im.parentElement; if(!h||seen.indexOf(h)>=0) return; seen.push(h);
    var hr=h.getBoundingClientRect();
    var esc=[], zed=[];
    var kids=h.querySelectorAll('*');
    for(var k=0;k<kids.length;k++){
      var n=kids[k], cs;
      try{cs=getComputedStyle(n);}catch(e){continue;}
      if(cs.position==='static') continue;
      var z=cs.zIndex;
      if(z!=='auto' && Number(z)>0) zed.push({tag:n.tagName.toLowerCase(),z:z,pos:cs.position});
      var r=n.getBoundingClientRect();
      if(r.width===0||r.height===0) continue;
      // paints outside the host's own box?
      if(r.left<hr.left-1||r.top<hr.top-1||r.right>hr.right+1||r.bottom>hr.bottom+1){
        esc.push({tag:n.tagName.toLowerCase(),pos:cs.position,z:z,
          over:Math.round(Math.max(hr.left-r.left,r.right-hr.right,
                                   hr.top-r.top,r.bottom-hr.bottom))});
      }
    }
    hosts.push({tag:h.tagName.toLowerCase(),
      iso:getComputedStyle(h).isolation, pos:getComputedStyle(h).position,
      kids:kids.length, escapers:esc.length, positivZ:zed.length,
      esc:esc.slice(0,3), z:zed.slice(0,3)});
  });
  return {path:location.pathname, hosts:hosts.length,
    isolated:hosts.filter(function(h){return h.iso==='isolate';}).length,
    withEscapers:hosts.filter(function(h){return h.escapers>0;}).length,
    withPositiveZ:hosts.filter(function(h){return h.positivZ>0;}).length,
    detail:hosts.filter(function(h){return h.escapers>0||h.positivZ>0;}).slice(0,6),
    sample:hosts.slice(0,3)};})()"""

out={}
for name,url in (("search","https://m.youtube.com/results?search_query=podcast+interview"),
                 ("watch","https://m.youtube.com/watch?v=NWoT1ZVd1Lo")):
    t.cmd("Page.navigate", url=url); time.sleep(40)
    if name=="watch":
        t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
        time.sleep(12)
    out[name]=t.eval(SCAN)
print(json.dumps(out, indent=1))
