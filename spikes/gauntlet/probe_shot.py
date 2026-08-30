import base64, time
from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
r=tab.cmd("Page.captureScreenshot", format="png")
open("faceless-repro.png","wb").write(base64.b64decode(r.get("result",r)["data"]))
print(tab.eval("JSON.stringify({url:location.href,"
  "clear:[].slice.call(document.images).filter(function(i){var r=i.getBoundingClientRect();"
  "return r.width>200&&!i.classList.contains('ts-gaze-pending')&&!i.classList.contains('ts-gaze-flagged');}).length,"
  "flag:document.querySelectorAll('.ts-gaze-flagged').length,"
  "regions:(document.getElementById('tamescroll-gaze-regions')||{children:[]}).children.length})"))
