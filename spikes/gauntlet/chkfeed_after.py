import json, time
from emu_cdp import page, Tab
t = Tab(page())
for i in range(4):
    t.eval("(function(){window.scrollBy(0,800);document.scrollingElement.scrollTop+=800;return 1})()")
    time.sleep(7)
print(json.dumps(t.eval("""(function(){
  var imgs=[].slice.call(document.querySelectorAll('img'));
  var on=imgs.filter(function(im){var r=im.getBoundingClientRect();
    return r.bottom>0&&r.top<innerHeight&&r.width>=48;});
  var d=window.__TS_GAZE_IMGDIAG||[]; var why={};
  d.forEach(function(e){why[e.why]=(why[e.why]||0)+1;});
  var logo=document.querySelector('img.mobile-topbar-logo');
  return {imgTotal:window.__TS_GAZE_IMGTOTAL||0, onscreen:on.length,
    pendingOnScreen:on.filter(function(im){return im.classList.contains('ts-gaze-pending')}).length,
    patches:document.querySelectorAll('.ts-gaze-region-patch').length,
    ringWhy:why,
    logoFilter: logo?getComputedStyle(logo).filter:null};})()"""), indent=1))
