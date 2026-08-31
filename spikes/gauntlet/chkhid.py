import json
from emu_cdp import page, Tab
t=Tab(page())
print(json.dumps(t.eval("""(function(){
  var secs=[].slice.call(document.querySelectorAll('ytm-rich-section-renderer'));
  return secs.map(function(s){
    var ims=[].slice.call(s.querySelectorAll('img'));
    return {display:getComputedStyle(s).display,
      h:Math.round(s.getBoundingClientRect().height),
      imgs:ims.length,
      withSrc:ims.filter(function(i){return !!(i.currentSrc||i.getAttribute('src'));}).length,
      loaded:ims.filter(function(i){return (i.naturalWidth||0)>0;}).length,
      big:ims.filter(function(i){return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;}).length,
      watchLinks:s.querySelectorAll('a[href*="/watch?v="]').length,
      title:(s.textContent||'').trim().slice(0,45)};});})()"""), indent=1))
