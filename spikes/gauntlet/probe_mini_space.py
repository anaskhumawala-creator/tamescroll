import time
from gauntlet import pick
UA = ("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = pick("youtube.com")
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.6, mobile=True)
tab.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(22)
print(tab.eval(r"""(function(){
  var pc=document.getElementById('player-container-id');
  if(!pc) return 'no player-container (desktop layout?) app='+(document.querySelector('ytm-app')?'ytm':'ytd');
  var below=document.elementFromPoint(200,300), chain=[], el=below;
  for(var i=0;i<7&&el;i++){var r=el.getBoundingClientRect(),cs=getComputedStyle(el);
    chain.push(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className?'.'+(el.className+'').trim().split(/\s+/).slice(0,3).join('.'):'')
      +' @y'+Math.round(r.top)+' h'+Math.round(r.height)+' mt:'+cs.marginTop+' pt:'+cs.paddingTop+' pos:'+cs.position);
    el=el.parentElement;}
  var app=document.querySelector('ytm-app'), a=app?getComputedStyle(app):null;
  var pcs=getComputedStyle(pc), r=pc.getBoundingClientRect();
  return JSON.stringify({
    html: document.documentElement.className,
    body: document.body.className,
    app: app? app.className : null,
    appPT: a?a.paddingTop:null, appMT: a?a.marginTop:null,
    pc: {w:Math.round(r.width),h:Math.round(r.height),y:Math.round(r.top),pos:pcs.position,z:pcs.zIndex,
         top:pcs.top, transform:pcs.transform.slice(0,40)},
    chain: chain
  },null,1);
})()"""))
