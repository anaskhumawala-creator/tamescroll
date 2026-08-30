import json, time
from gauntlet import open_platform
tab = open_platform("woman")
time.sleep(8)
tab.eval("location.href='https://www.youtube.com/results?search_query=podcast+interview+face'")
time.sleep(25)
for i in range(4):
    tab.eval("window.scrollBy(0,900)")
    time.sleep(6)
print(tab.eval(r"""(function(){
  var d = window.__TS_GAZE_IMGDIAG || [];
  var why = {}; d.forEach(function(e){ why[e.why]=(why[e.why]||0)+1; });
  var faces = d.filter(function(e){return e.faces;});
  return JSON.stringify({images:d.length, why:why,
    withFaces: faces.length, flaggedEntries: d.filter(function(e){return e.flagged;}).length,
    domFlagged: document.querySelectorAll('.ts-gaze-flagged').length,
    regions: (document.getElementById('tamescroll-gaze-regions')||{children:[]}).children.length,
    mode: window.__TS_GAZE_MODE, gender: window.__TS_GAZE_GENDER});
})()"""))
