import json, time
from emu_cdp import page, Tab
t=Tab(page())
t.eval("""(function(){var im=document.querySelector('img.mobile-topbar-logo');
  im.setAttribute('src', im.currentSrc); return 1;})()""")
time.sleep(14)
print(json.dumps(t.eval("""(function(){
  var ring=(window.__TS_GAZE_IMGDIAG||[]);
  return {last3:ring.slice(-3), total:window.__TS_GAZE_IMGTOTAL,
    logo:(function(){var im=document.querySelector('img.mobile-topbar-logo');
      return {pending:im.classList.contains('ts-gaze-pending'),
              flagged:im.classList.contains('ts-gaze-flagged'),
              filter:getComputedStyle(im).filter};})()};})()"""), indent=1))
