"""The square-crop refactor must not change a single verdict.

It moved arithmetic out of detector.js into crop-geometry.mjs; the claim
is that the reads are identical, and the only way to say that honestly
is to run the real models on real thumbnails.
"""
import json, time
from gauntlet import open_platform
tab = open_platform("man")
time.sleep(8)
tab.eval("location.href='https://www.youtube.com/results?search_query=podcast+interview+face'")
time.sleep(30)
print(tab.eval(r"""(function(){
  var d = window.__TS_GAZE_IMGDIAG || [];
  var why = {};
  d.forEach(function(e){ why[e.why] = (why[e.why]||0)+1; });
  var reads = (window.__TS_GAZE_IDS||{}).reads || [];
  var g = {};
  reads.forEach(function(r){ g[r.g] = (g[r.g]||0)+1; });
  var scores = reads.map(function(r){ return +(+r.s).toFixed(2); }).sort(function(a,b){return a-b;});
  return JSON.stringify({images: d.length, why: why, genderReads: reads.length,
    byGender: g, scoreMin: scores[0], scoreMax: scores[scores.length-1],
    flagged: document.querySelectorAll('.ts-gaze-flagged').length,
    regions: (document.getElementById('tamescroll-gaze-regions')||{children:[]}).children.length,
    cleared: document.querySelectorAll('img.ts-gaze-clear, img[data-ts-clear]').length});
})()"""))
