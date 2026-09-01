import json, time
from emu_cdp import page, Tab
t=Tab(page(port=9226)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview"); time.sleep(55)
t.eval("(function(){var s=document.scrollingElement||document.body; s.scrollBy(0,1400); return 1;})()")
time.sleep(40)
print(json.dumps(t.eval("""(function(){
 var pend=document.querySelectorAll('.ts-gaze-pending').length;
 var pat=document.querySelectorAll('#tamescroll-gaze-regions > *').length;
 var ids=window.__TS_GAZE_IDS||{};
 var errs=(window.__TS_GAZE_IMGDIAG||[]).filter(function(e){return e.why==='error';}).length;
 var vis=0,imgs=document.querySelectorAll('img');
 for(var i=0;i<imgs.length;i++){var r=imgs[i].getBoundingClientRect();
   if(r.width>=120&&r.top<innerHeight&&r.bottom>0) vis++;}
 return {imgTotal:window.__TS_GAZE_IMGTOTAL||0, pending:pend, patches:pat,
   errors:errs, bigVisible:vis, bundle:window.__TS_GAZE_BUNDLE__};})()"""), indent=1))
