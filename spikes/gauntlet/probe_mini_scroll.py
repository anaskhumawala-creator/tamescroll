"""Does collapsing the band move what he is reading? Measure, don't guess."""
import time
from gauntlet import pick
tab = pick("youtube.com")
print(tab.eval(r"""(function(){
  window.__TS_MINI__.exit(); window.scrollTo(0,600); return 'reset';
})()"""))
time.sleep(0.6)
print(tab.eval(r"""(function(){
  // a stable landmark near the middle of the screen
  var el=document.elementFromPoint(200,500);
  window.__mark=el;
  return JSON.stringify({scrollY:window.scrollY, markY:Math.round(el.getBoundingClientRect().top),
    tag:el.tagName.toLowerCase()});
})()"""))
# instrument: what scrollY is right after the class lands, before our scrollTo
print(tab.eval(r"""(function(){
  var d=document, w=window, log={};
  log.before = w.scrollY;
  d.documentElement.classList.add('ts-mini');
  log.afterClass = w.scrollY;
  d.documentElement.classList.remove('ts-mini');
  log.afterRemove = w.scrollY;
  return JSON.stringify(log);
})()"""))
time.sleep(0.3)
print("--- enter via api (with compensation) ---")
print(tab.eval(r"""(function(){ window.__TS_MINI__.enter();
  return JSON.stringify({scrollY:window.scrollY,
    markY: window.__mark? Math.round(window.__mark.getBoundingClientRect().top):null});})()"""))
time.sleep(0.4)
print(tab.eval(r"""(function(){ return JSON.stringify({scrollY:window.scrollY,
  markY: window.__mark? Math.round(window.__mark.getBoundingClientRect().top):null});})()"""))
