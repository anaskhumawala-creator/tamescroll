import json
from emu_cdp import page, Tab
t=Tab(page())
print(json.dumps(t.eval("""(function(){
  var im=document.querySelector('img.mobile-topbar-logo');
  if(!im) return {err:'no logo'};
  var cs=getComputedStyle(im), r=im.getBoundingClientRect();
  var ring=(window.__TS_GAZE_IMGDIAG||[]);
  var mine=ring.filter(function(e){
    return (e.src||'').indexOf('79c8010334e767b424f9c9ebbf1a9bf0e6ff922d')>=0;});
  var host=(function(){try{return new URL(im.currentSrc).host;}catch(e){return null;}})();
  return {full:im.currentSrc, host:host,
    filter:cs.filter, opacity:cs.opacity,
    rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
    classes:im.className,
    crossOrigin:im.crossOrigin,
    inFixedBar:(function(){for(var n=im;n;n=n.parentElement){
      try{if(getComputedStyle(n).position==='fixed') return n.tagName.toLowerCase();}catch(e){}}
      return null;})(),
    ringEntriesForThisImage:mine.length, ringDetail:mine.slice(0,4),
    ringTotal:ring.length};})()"""), indent=1))
