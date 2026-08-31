import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(30)
print(json.dumps(t.eval("""(function(){
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ').join('.'):'');};
  var bar=document.querySelector('ytm-mobile-topbar-renderer');
  var out=[];
  (bar?[].slice.call(bar.querySelectorAll('img')):[]).forEach(function(im){
    var r=im.getBoundingClientRect(); var cs=getComputedStyle(im);
    out.push({el:nm(im), box:[r.x|0,r.y|0,r.width|0,r.height|0],
      nat:[im.naturalWidth,im.naturalHeight],
      host:(im.currentSrc||im.src||'').split('/')[2]||'',
      filter:cs.filter, pending:im.classList.contains('ts-gaze-pending'),
      flagged:im.classList.contains('ts-gaze-flagged'),
      alt:(im.alt||'').slice(0,40)});});
  var av=document.querySelector('ytm-profile-icon img, ytm-mobile-topbar-renderer button img');
  return {barPresent:!!bar, imgs:out,
    avatarSel: av?nm(av):null};})()"""), indent=1))
