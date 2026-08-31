import json
from emu_cdp import page, Tab
t=Tab(page())
print(json.dumps(t.eval("""(function(){
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  var seen=[],iso=0,esc=0,tot=0,escIso=0;
  imgs.forEach(function(im){var h=im.parentElement; if(!h||seen.indexOf(h)>=0)return; seen.push(h);
    tot++; var hr=h.getBoundingClientRect();
    var isIso=getComputedStyle(h).isolation==='isolate'; if(isIso) iso++;
    var kids=h.querySelectorAll('*'), e=0;
    for(var k=0;k<kids.length;k++){var n=kids[k],cs;try{cs=getComputedStyle(n);}catch(x){continue;}
      if(cs.position==='static')continue; var r=n.getBoundingClientRect();
      if(r.width===0||r.height===0)continue;
      if(r.left<hr.left-1||r.top<hr.top-1||r.right>hr.right+1||r.bottom>hr.bottom+1)e++;}
    if(e){esc++; if(isIso) escIso++;}});
  return {path:location.pathname,hosts:tot,isolated:iso,withEscapers:esc,
          isolatedWithEscapers:escIso};})()"""),indent=1))
