import time
from gauntlet import pick, targets
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau=pick("localhost:1420")
lau.eval("""(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');
 m.youtube=['watch_recs'];localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()""")
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile')).filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(9)
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab=pick(u); break
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(25)
tab.eval("window.scrollBy(0,600)"); time.sleep(4)
print(tab.eval(r"""(function(){
  function info(sel){
    var e=document.querySelectorAll(sel);
    if(!e.length) return sel+': 0';
    var f=e[0], cs=getComputedStyle(f), r=f.getBoundingClientRect();
    return sel+': n='+e.length+' disp='+cs.display+' h='+Math.round(r.height);
  }
  var out=['#secondary','#related','ytd-watch-next-secondary-results-renderer',
    'yt-lockup-view-model','ytd-compact-video-renderer','#secondary-inner',
    'ytd-item-section-renderer'].map(info);
  var sheet=document.getElementById('tamescroll-rules'); var css=sheet?sheet.textContent:'';
  out.push('sheetHasWatchNext='+(css.indexOf('ytd-watch-next-secondary-results-renderer')>=0));
  out.push('sheetBytes='+css.length);
  out.push('theaterOrWide='+document.querySelector('ytd-watch-flexy')?.getAttribute('theater'));
  out.push('windowW='+innerWidth);
  return out.join('\n');
})()"""))
