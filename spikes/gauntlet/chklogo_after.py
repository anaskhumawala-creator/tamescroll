import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(30)
print(json.dumps(t.eval("""(function(){
  var im=document.querySelector('img.mobile-topbar-logo');
  var bar=document.querySelector('ytm-mobile-topbar-renderer');
  var others=bar?[].slice.call(bar.querySelectorAll('img')).map(function(x){
    var c=(x.className&&x.className.baseVal!==undefined?x.className.baseVal:x.className)||'';
    return {cls:String(c).slice(0,50), filter:getComputedStyle(x).filter,
            pending:x.classList.contains('ts-gaze-pending')};}):[];
  if(!im) return {logo:'absent', barImgs:others};
  var cs=getComputedStyle(im);
  return {logo:'present', filter:cs.filter, pending:im.classList.contains('ts-gaze-pending'),
    flagged:im.classList.contains('ts-gaze-flagged'),
    host:(im.currentSrc||im.src||'').split('/')[2]||'', barImgs:others,
    gridVisible: !!document.querySelector('ytm-rich-grid-renderer'),
    feedImgsJudged: document.querySelectorAll('img.ts-gaze-pending,img.ts-gaze-flagged').length};})()"""), indent=1))
