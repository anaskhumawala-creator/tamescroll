import json, time, sys
import gauntlet as G
tab = G.pick("youtube.com")
tab.eval("(function(){var v=document.querySelector('video');v.currentTime=%s;v.play();})()" % sys.argv[1])
time.sleep(3)
for i in range(6):
    r = tab.eval("""(function(){
      var host=document.querySelector('#movie_player');
      var k=host?host.querySelectorAll('.ts-gaze-vregion-host'):[];
      var out=[];
      for(var i=0;i<k.length;i++){
        var s=k[i].style;
        var mi=(s.maskImage||s.webkitMaskImage||'');
        out.push({mask: mi.slice(0,60), layers:(mi.match(/gradient/g)||[]).length, comp:(s.maskComposite||s.webkitMaskComposite||'')});
      }
      var d=window.__TS_GAZE_IDS||{};
      return JSON.stringify({n:k.length, o:out, life:{hh:(d.life||{}).headHole, hn:(d.life||{}).holeNone}});
    })()""")
    print(r)
    time.sleep(0.5)
