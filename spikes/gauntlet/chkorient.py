import json
from emu_cdp import page, Tab
t = Tab(page())
print(json.dumps(t.eval("""(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  var mp=document.querySelector('#movie_player');
  return {vp:[innerWidth,innerHeight],
    orient: (screen.orientation&&screen.orientation.type)||null,
    fs: !!(document.fullscreenElement||document.webkitFullscreenElement),
    fsEl: (document.fullscreenElement||{}).id||null,
    playerCls: mp?mp.className.slice(0,120):null,
    htmlCls: document.documentElement.className,
    box: r?[r.x|0,r.y|0,r.width|0,r.height|0]:null};})()"""), indent=1))
