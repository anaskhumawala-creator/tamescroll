"""Does the age head's CHILD verdict depend on the CROP, or on the face?

R25 measured an adult woman (Olivia Smith, 21) reading age 10-22 with
childP 0.49-0.94 on 40+ live reads, against the child gate's calibration
band (an adult teacher, childP max 0.18). In `woman` mode that covers the
video's primary subject on every frame — FALSE COVER, a terminal class.

Before touching GENDER_CHILD_MASS this has to answer one question that a
threshold cannot: is the young read a property of the FACE, or of the
crop we hand faceres? detector.js squarifies the BlazeFace box and
enlarges it by FACE_ENLARGE before cropAndResize to 224. If age walks
with the enlargement, the gate is being fed the wrong picture and the fix
is free. If it does not, the gate is at a MODEL ceiling and any change to
the constant trades an adult woman against an eight-year-old.

Runs in BENCH mode (__TS_BENCH__ set at document start, so the pipeline
never boots and nothing here can perturb a scored run) and sweeps the
enlargement over the SAME detected face.
"""
import json, sys, time
import gauntlet as G

vid = sys.argv[1]
at = float(sys.argv[2])
label = sys.argv[3] if len(sys.argv) > 3 else vid

tab = G.pick("youtube.com")
tab.cmd("Page.enable")
tab.cmd("Page.addScriptToEvaluateOnNewDocument", source="window.__TS_BENCH__=1;")
tab.eval("location.href='https://www.youtube.com/watch?v=%s&t=%ds'" % (vid, int(at)))
time.sleep(18)
tab = G.pick("youtube.com")
print("bench api:", tab.eval("!!window.__TS_BENCH_API"))

setup = r"""
(async function(){
  var api = window.__TS_BENCH_API;
  if (!api) return {err:'no bench api'};
  var v = document.querySelector('video');
  if (!v) return {err:'no video'};
  v.currentTime = %f; v.play();
  await new Promise(function(r){setTimeout(r,2500);});
  v.pause();
  await new Promise(function(r){setTimeout(r,400);});
  window.__AGE = {};
  __AGE.face = await api.loadFace();
  __AGE.gender = await api.loadGender();
  var boxes = await api.detect(__AGE.face, v);
  __AGE.boxes = boxes;
  return {t: v.currentTime, vw: v.videoWidth, vh: v.videoHeight,
          boxes: boxes.map(function(b){return [+b.x1.toFixed(3),+b.y1.toFixed(3),
                                               +b.x2.toFixed(3),+b.y2.toFixed(3),
                                               +(b.confidence||0).toFixed(2)];})};
})()
""" % at
print(json.dumps(tab.eval(setup)))

# FACE_ENLARGE is already baked into the boxes detect returns, so the
# sweep is RELATIVE to what ships: 1.0 is the shipped crop.
sweep = r"""
(async function(){
  var api = window.__TS_BENCH_API;
  var v = document.querySelector('video');
  var out = [];
  var scales = [0.55, 0.7, 0.85, 1.0, 1.2, 1.5, 1.9];
  for (var bi = 0; bi < __AGE.boxes.length; bi++) {
    var b = __AGE.boxes[bi];
    var cx = (b.x1+b.x2)/2, cy = (b.y1+b.y2)/2;
    var hw = (b.x2-b.x1)/2, hh = (b.y2-b.y1)/2;
    for (var si = 0; si < scales.length; si++) {
      var s = scales[si];
      var box = {x1: Math.max(0,cx-hw*s), y1: Math.max(0,cy-hh*s),
                 x2: Math.min(1,cx+hw*s), y2: Math.min(1,cy+hh*s)};
      var g = await api.genders(__AGE.gender, v, [box]);
      var r = g[0] || {};
      out.push({bi: bi, s: s,
                g: r.gender, sc: +(r.score||0).toFixed(3),
                age: +(r.age||0).toFixed(1), childP: +(r.childP||0).toFixed(3),
                bin: r.shape ? r.shape.ageBin : null,
                mass: r.shape ? +r.shape.ageMass.toFixed(3) : null,
                ent: r.shape ? +r.shape.ageEnt.toFixed(2) : null,
                raw: +(r.raw||0).toFixed(3),
                box: [+box.x1.toFixed(3),+box.y1.toFixed(3),+box.x2.toFixed(3),+box.y2.toFixed(3)]});
    }
  }
  return out;
})()
"""
rows = tab.eval(sweep)
print("== %s  t=%s" % (label, at))
for r in rows or []:
    print(json.dumps(r))
