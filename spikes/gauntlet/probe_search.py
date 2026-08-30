import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/'")
time.sleep(10)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)

def pill_off():
    return tab.eval("""(function(){
      var p=[].slice.call(document.querySelectorAll('#movie_player *')).filter(function(e){
        return /Blur (on|off)/.test(e.textContent||'') && e.children.length<4;});
      if(!p.length) return 'nopill'; var t=p[p.length-1];
      if(/Blur off/.test(t.textContent)) return 'already'; t.click(); return 'clicked';})()""")

def run(label, q):
    tab.eval("location.href='https://www.youtube.com/'")
    time.sleep(8)
    t0=time.time()
    tab.eval("location.href='https://www.youtube.com/results?search_query=%s'" % q)
    first=None; n=0
    for i in range(40):
        time.sleep(0.5)
        n=tab.eval("document.querySelectorAll('ytd-video-renderer, yt-lockup-view-model').length")
        if isinstance(n,dict): n=0
        if n and first is None:
            first=round(time.time()-t0,1); break
    # time until thumbnails have pixels
    imgs=0
    for i in range(40):
        time.sleep(0.5)
        imgs=tab.eval("[].slice.call(document.querySelectorAll('ytd-video-renderer img, yt-lockup-view-model img')).filter(function(x){return x.naturalWidth>0;}).length")
        if isinstance(imgs,dict): imgs=0
        if imgs>=8: break
    print(label, "firstResult=%ss" % first, "imgsReady=%.1fs" % (time.time()-t0), "n=%s imgs=%s" % (n,imgs))

run("BLUR ON ", "linus+tech+tips")
print("off:", pill_off())
run("BLUR OFF", "marques+brownlee")
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
