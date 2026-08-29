"""Owner's phone: a full-body woman, distant, standing sharp on the home
feed. Images are judged by FACE + NSFW only -- no person model -- so a
body whose face BlazeFace cannot find is cleared. Measure it on the
channel from his screenshot, then ask MoveNet the same question.
"""
import time, json
from gauntlet import pick, targets

DIAG = r"""(function(){
  var d=(window.__TS_GAZE_IMGDIAG||[]).slice(-40).map(function(e){
    return {w:e.w,h:e.h,faces:e.faces,nsfw:e.nsfw,verdict:e.verdict,ms:e.ms};});
  return JSON.stringify({total:window.__TS_GAZE_IMGTOTAL||0,rows:d});
})()"""

PERSONS = r"""(async function(){
  var out=[];
  var imgs=[].slice.call(document.images).filter(function(i){
    var r=i.getBoundingClientRect(); return r.width>200&&r.height>120&&i.currentSrc;});
  var det=window.__TS_GAZE_DETECTOR;
  if(!det) return JSON.stringify({err:'no detector handle'});
  for(var i=0;i<Math.min(imgs.length,8);i++){
    var im=imgs[i];
    try{
      var f=await det.detect(det.models.face, im);
      var p=det.models.person? await det.persons(det.models.person, im) : null;
      out.push({w:im.naturalWidth,h:im.naturalHeight,
                faces:(f||[]).length,
                persons:p?(p.persons||p||[]).length:null,
                cls:im.className.indexOf('flagged')>=0?'flagged':
                    (im.className.indexOf('pending')>=0?'pending':'clear')});
    }catch(e){ out.push({err:String(e).slice(0,70)}); }
  }
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
tab.cmd("Emulation.setUserAgentOverride", userAgent=(
    "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"))
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/results?search_query=Balkan+Gains'")
time.sleep(25)
print("DIAG", tab.eval(DIAG))
print("PERS", tab.eval(PERSONS))
