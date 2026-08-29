"""A query string walked straight past www.youtube's service worker on
the first try. Confirm it is the query and not the order: ask for the
query form FIRST on a fresh page, then the bare one, then build a real
Worker from the query url and wait for it to speak.
"""
import time
from gauntlet import pick, targets

JS = r"""(async function(){
  var out={controller:!!(navigator.serviceWorker&&navigator.serviceWorker.controller),r:[]};
  async function get(p){
    try{var t0=performance.now();var res=await fetch(p,{cache:'no-store'});
        var txt=await res.text();
        return {p:p,s:res.status,len:txt.length,ms:Math.round(performance.now()-t0),
                ours:txt.slice(0,20).indexOf('__TS_GAZE')>=0};}
    catch(e){return {p:p,err:String(e).slice(0,60)};}
  }
  out.r.push(await get('/__tamescroll/gaze-page.js?v=1'));
  out.r.push(await get('/__tamescroll/gaze-page.js'));
  out.r.push(await get('/__tamescroll/models/blazeface.json?v=1'));
  out.r.push(await get('/__tamescroll/models/blazeface.json'));
  out.worker = await new Promise(function(res){
    var done=false;
    try{
      var url='/__tamescroll/gaze-page.js?v=1';
      if(window.trustedTypes&&trustedTypes.createPolicy){
        var pol=trustedTypes.createPolicy('ts-probe',{createScriptURL:function(u){return u;}});
        url=pol.createScriptURL(url);
      }
      var t0=performance.now();
      var w=new Worker(url);
      w.onmessage=function(e){ if(done)return; done=true;
        res({ok:true,msg:(e.data||{}).type||'?',ms:Math.round(performance.now()-t0)}); w.terminate();};
      w.onerror=function(e){ if(done)return; done=true;
        res({ok:false,err:String(e.message||e).slice(0,80)});};
      w.postMessage({type:'init'});
      setTimeout(function(){ if(!done){done=true;res({ok:false,err:'no message in 25s'});}},25000);
    }catch(e){ res({ok:false,err:String(e).slice(0,80)}); }
  });
  return JSON.stringify(out);
})()"""

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval("(function(){var i=window.__TAURI__.core.invoke;"
         "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:[]});return 1;})()")
time.sleep(10)
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
tab.cmd("Emulation.setUserAgentOverride", userAgent="")
tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900,
        deviceScaleFactor=1.0, mobile=False)
tab.eval("location.href='https://www.youtube.com/results?search_query=podcast'")
time.sleep(14)
print(tab.eval(JS))
