import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(14)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)

def pill(want):
    return tab.eval("""(function(){
      var p=[].slice.call(document.querySelectorAll('#movie_player *')).filter(function(e){
        return /Blur (on|off)/.test(e.textContent||'') && e.children.length<4;});
      if(!p.length) return 'nopill'; var t=p[p.length-1];
      if(new RegExp('Blur %s').test(t.textContent)) return 'already';
      t.click(); return 'clicked';})()""" % want)

def run(label):
    tab.eval("window.scrollTo(0,0);")
    time.sleep(1.5)
    t0=time.time(); first=None; n=0
    for i in range(14):
        tab.eval("window.scrollBy(0,700);")
        time.sleep(1.2)
        n=tab.eval("document.querySelectorAll('#comments ytd-comment-thread-renderer').length")
        if n and first is None: first=round(time.time()-t0,1)
        if n>=20: break
    print(label, "firstCommentAt=%s s" % first, "threads=%s" % n, "elapsed=%.1f" % (time.time()-t0))

print("on:", pill("on")); time.sleep(2); run("BLUR ON ")
print("off:", pill("off")); time.sleep(2); run("BLUR OFF")
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
