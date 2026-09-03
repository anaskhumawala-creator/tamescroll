import json, time
from emu_cdp import Tab, page
t = Tab(page(port=9227)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['home','watch_recs']});return 1;})()""")
time.sleep(12)
t = Tab(page(port=9227)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
print(t.eval("""(function(){
  var out=[]; var items=document.querySelectorAll('ytm-rich-item-renderer');
  for (var i=0;i<items.length && i<3;i++){
    var n=items[i].querySelectorAll('yt-touch-feedback-shape');
    for (var j=0;j<n.length;j++){
      var e=n[j], r=e.getBoundingClientRect();
      out.push({item:i, cls:String(e.className).replace(/ytSpecTouchFeedbackShape/g,''),
        host:(e.parentElement&&(e.parentElement.tagName+'.'+String(e.parentElement.className||'').slice(0,30))),
        box:[Math.round(r.width),Math.round(r.height)],
        pe:getComputedStyle(e).pointerEvents});
    }
  }
  var all=document.querySelectorAll('yt-touch-feedback-shape');
  return JSON.stringify({inItems:out, total:all.length}, null, 1);})()"""))
