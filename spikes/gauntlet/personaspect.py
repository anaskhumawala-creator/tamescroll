"""Is the person pass losing an edge-cropped person to the SQUASH?

R25 measured a woman at frame left whose MoveNet slot carried score 0.000
and maxKp 0.03-0.12 while the woman beside her scored 0.50. The person
pass draws a 16:9 frame into a 256x256 square (init-entry.js:711 and
detector.js:308), i.e. a 1.78x horizontal compression, where the model's
own documented preprocessing resizes WITH PAD. On her 192x853 native box
that renders her 1:7.9 instead of her true 1:4.4.

This runs the SAME model on the SAME paused frame three ways and prints
all six raw slots for each:

  squash    - 256x256 stretch, exactly what ships
  letterbox - aspect preserved inside 256x256, black bars
  half      - the left half of the frame, letterboxed (the tiling idea,
              measured rather than argued)

Bench mode only (__TS_BENCH__ at document start), so the pipeline never
boots and this cannot perturb a scored run.
"""
import json, sys, time
import gauntlet as G

vid = sys.argv[1]
at = float(sys.argv[2])

try:
    tab = G.pick("youtube.com")
except SystemExit:
    tab = G.open_platform("man")
tab.cmd("Page.enable")
tab.cmd("Page.addScriptToEvaluateOnNewDocument", source="window.__TS_BENCH__=1;")
tab.eval("location.href='https://www.youtube.com/watch?v=%s&t=%ds'" % (vid, int(at)))
time.sleep(18)
tab = G.pick("youtube.com")
print("bench api:", tab.eval("!!(window.__TS_BENCH_API&&window.__TS_BENCH_API.persons)"))

probe = r"""
(async function(){
  var api = window.__TS_BENCH_API;
  var tf = api.tf;
  var v = document.querySelector('video');
  v.currentTime = %f; v.play();
  await new Promise(function(r){setTimeout(r,2500);});
  v.pause();
  await new Promise(function(r){setTimeout(r,400);});
  var model = window.__PM || (window.__PM = await api.loadPerson());
  var S = 256;

  function canvasFor(mode){
    var c = document.createElement('canvas'); c.width=S; c.height=S;
    var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0,0,S,S);
    var vw = v.videoWidth, vh = v.videoHeight;
    if (mode === 'squash') { x.drawImage(v,0,0,S,S); }
    else if (mode === 'letterbox') {
      var h = Math.round(S * vh / vw);
      x.drawImage(v, 0, 0, vw, vh, 0, Math.round((S-h)/2), S, h);
    } else if (mode === 'half') {
      var hw = Math.round(vw/2);
      var hh = Math.round(S * vh / hw);
      x.drawImage(v, 0, 0, hw, vh, 0, Math.round((S-hh)/2), S, hh);
    }
    return x.getImageData(0,0,S,S);
  }

  function slots(px){
    var t0 = performance.now();
    var out = tf.tidy(function(){
      var img = tf.browser.fromPixels(px);
      return model.execute(tf.cast(tf.expandDims(img,0),'int32'));
    });
    var d = out.dataSync();
    tf.dispose(out);
    var ms = Math.round(performance.now()-t0);
    var rows = [];
    for (var p=0;p<6;p++){
      var o = p*56;
      var maxKp = 0, n15 = 0, n30 = 0;
      for (var k=0;k<13;k++){
        var s = d[o + k*3 + 2];
        if (s > maxKp) maxKp = s;
        if (s >= 0.15) n15++;
        if (s >= 0.3) n30++;
      }
      rows.push({score:+d[o+55].toFixed(3), maxKp:+maxKp.toFixed(3), n15:n15, n30:n30,
                 box:[+d[o+52].toFixed(3),+d[o+51].toFixed(3),+d[o+54].toFixed(3),+d[o+53].toFixed(3)]});
    }
    return {ms: ms, slots: rows};
  }

  var res = {};
  ['squash','letterbox','half'].forEach(function(m){ res[m] = slots(canvasFor(m)); });
  res.t = v.currentTime; res.vw = v.videoWidth; res.vh = v.videoHeight;
  return res;
})()
""" % at

r = tab.eval(probe)
print(json.dumps({k: r[k] for k in ('t', 'vw', 'vh')}))
for mode in ('squash', 'letterbox', 'half'):
    m = r[mode]
    print('--', mode, 'ms=%s' % m['ms'])
    for s in m['slots']:
        print('   ', json.dumps(s))
