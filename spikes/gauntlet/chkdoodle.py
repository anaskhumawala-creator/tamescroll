import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(26)
print(json.dumps(t.eval("""(function(){
  var bar=document.querySelector('ytm-mobile-topbar-renderer');
  if(!bar) return {err:'no bar'};
  var nm=function(n){var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ').slice(0,3).join('.'):'');};
  var imgs=[].slice.call(bar.querySelectorAll('img')).map(function(x){
    var r=x.getBoundingClientRect();
    return {el:nm(x), src:(x.currentSrc||x.src||''), box:[r.x|0,r.y|0,r.width|0,r.height|0],
            alt:(x.alt||'').slice(0,50), disp:getComputedStyle(x).display};});
  var svgs=[].slice.call(bar.querySelectorAll('svg')).map(function(x){
    var r=x.getBoundingClientRect();
    return {el:nm(x), box:[r.x|0,r.y|0,r.width|0,r.height|0], disp:getComputedStyle(x).display,
            vis:getComputedStyle(x).visibility,
            parent:nm(x.parentElement)};});
  var logoHost=document.querySelector('ytm-logo, .mobile-topbar-logo-container, a[href="/"]');
  return {imgs:imgs, svgCount:svgs.length, svgs:svgs.slice(0,6),
          logoHost: logoHost?nm(logoHost):null,
          logoHostHTMLlen: logoHost?logoHost.innerHTML.length:null};})()"""), indent=1))
