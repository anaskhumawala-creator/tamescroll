"""Owner: "the home screen, all the thumbnails are blurred".

Blur-first means an image stays covered until something judges it, so
"all blurred" is either no models, a dead drain, or every verdict
coming back flagged. Those are different bugs. Read the home feed on
both youtube hosts and print which one it is.
"""
import time
from gauntlet import pick, targets

READ = r"""(function(){
  var imgs=[].slice.call(document.images).filter(function(i){
    var r=i.getBoundingClientRect(); return r.width>60&&r.height>40&&i.currentSrc;});
  var pend=0,flag=0,clear=0;
  imgs.forEach(function(i){
    if(i.classList.contains('ts-gaze-pending'))pend++;
    else if(i.classList.contains('ts-gaze-flagged'))flag++;
    else clear++;});
  var w=window.__TS_GAZE_WORKER||{};
  return JSON.stringify({t:Math.round(performance.now()),n:imgs.length,
    pend:pend,flag:flag,clear:clear,
    total:window.__TS_GAZE_IMGTOTAL||0,
    ring:(window.__TS_GAZE_IMGDIAG||[]).length,
    boot:window.__TS_GAZE_BOOT||null,
    wrk:{dead:!!w.dead,ready:!!w.ready,backend:w.backend||null,ms:w.ms||null},
    models:!!window.__TS_GAZE_MODELS, mode:window.__TS_GAZE_MODE});
})()"""

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval("(function(){var i=window.__TAURI__.core.invoke;"
         "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:[]});return 1;})()")
time.sleep(10)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u); break

for label, ua, mob, url in [
    ("m.youtube home", "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36", True,
     "https://m.youtube.com/"),
    ("www.youtube home", "", False, "https://www.youtube.com/"),
]:
    tab.cmd("Emulation.setUserAgentOverride", userAgent=ua)
    if mob:
        tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
                deviceScaleFactor=2.0, mobile=True)
    else:
        tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900,
                deviceScaleFactor=1.0, mobile=False)
    tab.eval("location.href='%s'" % url)
    print("==", label)
    for i in range(6):
        time.sleep(5)
        print("  ", tab.eval(READ))
