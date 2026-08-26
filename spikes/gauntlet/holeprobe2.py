import json, time, sys
import gauntlet as G
tab = G.pick("youtube.com")
tab.eval("(function(){var v=document.querySelector('video');v.currentTime=%s;v.play();})()" % sys.argv[1])
time.sleep(4)
tab.eval("(function(){var v=document.querySelector('video');v.pause();})()")
time.sleep(0.6)
r = tab.eval("""(function(){
  var v=document.querySelector('video'), host=document.querySelector('#movie_player');
  var vr=v.getBoundingClientRect();
  var k=host.querySelectorAll('.ts-gaze-vregion-host'); var out=[];
  for(var i=0;i<k.length;i++){
    var r=k[i].getBoundingClientRect(); var s=k[i].style;
    var mi=s.maskImage||s.webkitMaskImage||'';
    out.push({
      box:[+(((r.left-vr.left)/vr.width).toFixed(3)),+(((r.top-vr.top)/vr.height).toFixed(3)),
           +(((r.right-vr.left)/vr.width).toFixed(3)),+(((r.bottom-vr.top)/vr.height).toFixed(3))],
      px:[Math.round(r.width),Math.round(r.height)],
      size:(s.maskSize||s.webkitMaskSize||''), pos:(s.maskPosition||s.webkitMaskPosition||''),
      comp:(s.maskComposite||s.webkitMaskComposite||''),
      nrad:(mi.match(/radial-gradient/g)||[]).length
    });
  }
  var d=window.__TS_GAZE_IDS||{}; var tr=(d.tracks||[]).slice(-1)[0]||[];
  return JSON.stringify({vr:[Math.round(vr.width),Math.round(vr.height)], o:out,
    tracks: tr.map(function(t){return {id:t.id,st:t.st,b:t.b,hb:t.hb};})});
})()""")
print(json.dumps(json.loads(r), indent=1)[:4000])
