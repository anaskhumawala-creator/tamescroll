import time, json
from gauntlet import pick, targets
UA=("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36")
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau=pick("localhost:1420")
lau.eval("""(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');
 m.youtube=['home','shorts','watch_recs','previews','search_inserts'];
 localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()""")
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile')).filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(9)
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab=pick(u); break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(20)
tab.eval("window.scrollTo(0,1500)"); time.sleep(3)
print(tab.eval(r"""(function(){
  var sel='ytm-video-with-context-renderer:has(a[href^="/shorts/"])';
  var els=document.querySelectorAll(sel);
  var out=[];
  for(var i=0;i<els.length;i++){
    var e=els[i], cs=getComputedStyle(e), r=e.getBoundingClientRect();
    var chain=[], p=e;
    while(p && p!==document.body){
      var pcs=getComputedStyle(p);
      if(pcs.display==='none') chain.push(p.tagName.toLowerCase()+(p.className?'.'+(p.className+'').trim().split(/\s+/).slice(0,2).join('.'):''));
      p=p.parentElement;
    }
    out.push({disp:cs.display, h:Math.round(r.height), hiddenAncestors:chain});
  }
  var sheet=document.getElementById('tamescroll-rules'); var css=sheet?sheet.textContent:'';
  return JSON.stringify({n:els.length, items:out,
    ruleStillInSheet: css.indexOf('a[href^="/shorts/"]')>=0,
    shortsRuleLines: css.split('\n').filter(function(l){return l.indexOf('shorts')>=0;}).slice(0,6)},null,1);
})()"""))
