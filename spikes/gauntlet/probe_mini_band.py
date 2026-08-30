import time, base64
from gauntlet import pick
tab = pick("youtube.com")
print(tab.eval(r"""(function(){
  var api=window.__TS_MINI__; api.enter();
  var ph=document.querySelectorAll('.player-placeholder');
  var out=[];
  for(var i=0;i<ph.length;i++){var e=ph[i],r=e.getBoundingClientRect(),cs=getComputedStyle(e);
    out.push(i+' h='+Math.round(r.height)+' cssH='+cs.height+' inline='+(e.getAttribute('style')||'-')
      +' cls='+e.className);}
  var st=document.getElementById('ts-mini-style');
  return JSON.stringify({htmlCls:document.documentElement.className,
    sheet: !!st, sheetLen: st?st.textContent.length:0,
    placeholders: out, state: window.__TS_MINI_STATE}, null, 1);
})()"""))
time.sleep(0.4)
tab.eval("window.scrollTo(0,0)")
time.sleep(0.6)
d=tab.cmd("Page.captureScreenshot", format="png")
open("mini-top.png","wb").write(base64.b64decode(d["data"]))
print(tab.eval(r"""(function(){var e=document.elementFromPoint(200,120);
 var ph=document.querySelector('.player-placeholder');
 return JSON.stringify({scrollY:window.scrollY, atY120: e? e.tagName.toLowerCase()+'.'+(e.className+'').split(' ')[0]:'-',
  phH: ph?Math.round(ph.getBoundingClientRect().height):null});})()"""))
