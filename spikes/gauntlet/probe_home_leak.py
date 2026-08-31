# WHAT IS STILL VISIBLE ON HIS HOME PAGE, IN HIS OWN CONFIGURATION.
#
# Read off his phone, 2026-08-31: tamescroll.shown =
# {"youtube":["watch_recs"]}. So HOME IS HIDDEN on his device -- the
# standing note ("his home feed is SHOWN, which is why the shelf rules
# cannot fire", loop 17) is inferred from a 1053 diagnostics report and
# is stale. If home is hidden and he still sees "random homepage
# elements", then those elements are OUTSIDE what the hide covers, and
# this enumerates exactly what they are: every element on the page that
# still paints, with its height, in his configuration.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
SHOWN = json.loads(sys.argv[2]) if len(sys.argv) > 2 else ["watch_recs"]

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:%s}); return 1;})()""" % json.dumps(SHOWN))
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(28)

VIS = """(function(){
  function txt(e){return (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,80);}
  var o={url:location.href.slice(0,40),visible:[],hiddenCount:0,
         sheetBytes:(function(){var s=document.getElementById('tamescroll-rules');
           return s?(s.textContent||'').length:null;})()};
  // Walk every ytm-* / yt-* renderer in the document and keep the ones
  // that actually paint, taking the OUTERMOST painting one so a visible
  // card is one entry and not forty.
  var all=document.querySelectorAll('*');
  var keep=[];
  for(var i=0;i<all.length;i++){
    var e=all[i], n=e.tagName.toLowerCase();
    if(n.indexOf('ytm-')!==0 && n.indexOf('yt-')!==0) continue;
    var r=e.getBoundingClientRect();
    if(r.height<8 || r.width<8){ o.hiddenCount++; continue; }
    keep.push(e);
  }
  for(var j=0;j<keep.length;j++){
    var e=keep[j], inside=false;
    for(var k=0;k<keep.length;k++){ if(k!==j && keep[k].contains(e)){inside=true;break;} }
    if(inside) continue;
    var r=e.getBoundingClientRect();
    o.visible.push({tag:e.tagName.toLowerCase(),h:Math.round(r.height),
      y:Math.round(r.top),
      watch:e.querySelectorAll('a[href*="/watch"]').length,
      shorts:e.querySelectorAll('a[href^="/shorts/"]').length,
      t:txt(e)});
  }
  o.grid=(function(){var g=document.querySelector('ytm-rich-grid-renderer');
    return g?Math.round(g.getBoundingClientRect().height):null;})();
  o.items=document.querySelectorAll('ytm-rich-item-renderer').length;
  o.sections=document.querySelectorAll('ytm-rich-section-renderer').length;
  o.bodyH=Math.round(document.body.scrollHeight);
  return o;})()"""

out = {"top": t.eval(VIS)}
for k in range(1, 4):
    t.eval("(function(){var b=document.body,e=document.scrollingElement||document.documentElement;"
           "var s=(b.scrollHeight>e.scrollHeight)?b:e; s.scrollBy(0,1500); window.scrollBy(0,1500);"
           "return 1;})()")
    time.sleep(2.5)
    out["s%d" % k] = t.eval(VIS)
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(3)
out["restored"] = t.eval("location.href")
print(json.dumps(out, indent=1)[:7000])
