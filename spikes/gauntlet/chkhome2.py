# The grid's direct children are wrapper DIVs now, so the previous census
# walked the wrong level. Enumerate every custom element inside the grid
# by tag, with its height and what it contains.
import json, time, collections
from emu_cdp import page, Tab
t=Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

CENSUS = """(function(){
  var grid=document.querySelector('ytm-rich-grid-renderer');
  if(!grid) return {err:'no grid'};
  var seen=[];
  [].slice.call(grid.querySelectorAll('*')).forEach(function(n){
    var tg=n.tagName.toLowerCase();
    if(tg.indexOf('-')<0) return;
    // outermost custom element only
    var p=n.parentElement, nested=false;
    while(p && p!==grid){ if(p.tagName.toLowerCase().indexOf('-')>=0){nested=true;break;} p=p.parentElement; }
    if(nested) return;
    var r=n.getBoundingClientRect();
    seen.push({tag:tg, h:Math.round(r.height),
      display:getComputedStyle(n).display,
      watch:n.querySelectorAll('a[href*="/watch?v="]').length,
      shorts:n.querySelectorAll('a[href*="/shorts/"]').length,
      text:(n.textContent||'').replace(/\s+/g,' ').trim().slice(0,46)});});
  return {n:seen.length, items:seen};})()"""

tags=collections.Counter(); nonvideo=[]
for i in range(4):
    t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(26)
    t.eval("window.scrollBy(0,3000);1"); time.sleep(8)
    c=t.eval(CENSUS)
    if c.get("err"): print("load",i,c); continue
    for it in c["items"]:
        tags[it["tag"]]+=1
        if it["watch"]==0 and it["h"]>12:
            nonvideo.append(it)
print(json.dumps({"tagCounts":dict(tags),
  "nonVideoElements":nonvideo[:25]}, indent=1))
