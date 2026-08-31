# THE GUARD, ON THE REAL DELIVERY PATH.
#   feed hosts (position: relative)  -> still isolated
#   the fixed top bar                -> never isolated
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(42); t.eval("window.scrollBy(0,1400);1"); time.sleep(28)

print(json.dumps(t.eval("""(function(){
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  var seen=[],rows=[];
  imgs.forEach(function(im){var h=im.parentElement; if(!h||seen.indexOf(h)>=0)return; seen.push(h);
    var cs=getComputedStyle(h);
    rows.push({tag:h.tagName.toLowerCase(),pos:cs.position,iso:cs.isolation,
               kids:h.querySelectorAll('*').length,
               patches:h.querySelectorAll('.ts-gaze-region,[data-ts-region]').length});});
  var fixed=rows.filter(function(r){return r.pos==='fixed';});
  return {hosts:rows.length,
    isolated:rows.filter(function(r){return r.iso==='isolate';}).length,
    fixedHosts:fixed.length,
    fixedIsolated:fixed.filter(function(r){return r.iso==='isolate';}).length,
    nonFixedIsolated:rows.filter(function(r){return r.pos!=='fixed'&&r.iso==='isolate';}).length,
    patchesTotal:document.querySelectorAll('#tamescroll-gaze-regions *').length,
    rows:rows};})()"""), indent=1))
