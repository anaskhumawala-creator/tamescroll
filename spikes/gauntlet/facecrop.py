"""Does GENDER certainty on a SMALL face depend on the CROP we hand faceres?

R26 scored FALSE COVER 10/10 on an adult woman whose face is 65-83 native
px. The corpus says why: over 8776 reads carrying both `px` and `score`,
only 23% of reads in the 64-80px band reach GENDER_CLEAR_SCORE 0.6, against
71% at 260-400px. person-track's own header (S6, re-refused by R23) says
the remaining route is "a better read on a small face, not a lower bar on
a bad one".

agecrop.py sweeps the enlargement but only ever sees the faces the
FULL-FRAME BlazeFace pass finds -- on this footage that is one of ten. So
this discovers faces the way the pipeline does (person slots -> native
per-person crop -> BlazeFace inside the crop -> map back) and THEN sweeps
the enlargement on each, so every person in the shot gets a row.

Bench mode only, so the pipeline never boots and this cannot perturb a
scored run.

Usage: python facecrop.py <videoId> <atSec> [label]
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
print("bench api:", tab.eval("!!(window.__TS_BENCH_API&&window.__TS_BENCH_API.persons)"))

setup = r"""
(async function(){
  var api = window.__TS_BENCH_API;
  if (!api) return {err:'no bench api'};
  var v = document.querySelector('video');
  v.currentTime = %f; v.play();
  await new Promise(function(r){setTimeout(r,2500);});
  v.pause();
  await new Promise(function(r){setTimeout(r,500);});
  var F = window.__FC = {};
  F.face = await api.loadFace();
  F.gender = await api.loadGender();
  F.person = await api.loadPerson();
  var vw = v.videoWidth, vh = v.videoHeight;

  // Person slots exactly as the pipeline gets them.
  var S = 256;
  var pc = document.createElement('canvas'); pc.width=S; pc.height=S;
  var px = pc.getContext('2d'); px.drawImage(v,0,0,S,S);
  var persons = await api.persons(F.person, px.getImageData(0,0,S,S), vw/vh);

  // A NATIVE-RES crop per person, then BlazeFace inside it -- the same
  // two-stage discovery the verdict pass runs, which is why it finds
  // faces the full-frame pass misses.
  var faces = [];
  for (var i = 0; i < persons.length; i++) {
    var p = persons[i];
    var sx = Math.max(0, Math.round(p.x1*vw)), sy = Math.max(0, Math.round(p.y1*vh));
    var sw = Math.min(vw-sx, Math.round((p.x2-p.x1)*vw));
    var sh = Math.min(vh-sy, Math.round((p.y2-p.y1)*vh));
    if (sw < 32 || sh < 32) continue;
    var c = document.createElement('canvas'); c.width=sw; c.height=sh;
    c.getContext('2d').drawImage(v, sx,sy,sw,sh, 0,0,sw,sh);
    var fb = await api.detect(F.face, c);
    for (var j = 0; j < fb.length; j++) {
      faces.push({
        pi: i,
        x1: (sx + fb[j].x1*sw)/vw, y1: (sy + fb[j].y1*sh)/vh,
        x2: (sx + fb[j].x2*sw)/vw, y2: (sy + fb[j].y2*sh)/vh,
        conf: +(fb[j].confidence||0).toFixed(2),
        npx: Math.round(Math.min((fb[j].x2-fb[j].x1)*sw, (fb[j].y2-fb[j].y1)*sh))
      });
    }
  }
  // Dedupe: the same face can be found from two overlapping person crops.
  var keep = [];
  for (var a = 0; a < faces.length; a++) {
    var dup = false;
    for (var b = 0; b < keep.length; b++) {
      var dx = ((faces[a].x1+faces[a].x2) - (keep[b].x1+keep[b].x2))/2;
      var dy = ((faces[a].y1+faces[a].y2) - (keep[b].y1+keep[b].y2))/2;
      if (Math.sqrt(dx*dx+dy*dy) < 0.02) { dup = true; break; }
    }
    if (!dup) keep.push(faces[a]);
  }
  F.faces = keep;
  return {t:+v.currentTime.toFixed(2), vw:vw, vh:vh, persons:persons.length,
          faces: keep.map(function(f){return [+f.x1.toFixed(3),+f.y1.toFixed(3),
                                              +f.x2.toFixed(3),+f.y2.toFixed(3),f.conf,f.npx];})};
})()
""" % at
info = tab.eval(setup)
print(json.dumps(info))

sweep = r"""
(async function(){
  var api = window.__TS_BENCH_API;
  var v = document.querySelector('video');
  var F = window.__FC;
  var scales = [0.55, 0.7, 0.85, 1.0, 1.2, 1.5, 1.9];
  var out = [];
  for (var i = 0; i < F.faces.length; i++) {
    var b = F.faces[i];
    var cx=(b.x1+b.x2)/2, cy=(b.y1+b.y2)/2, hw=(b.x2-b.x1)/2, hh=(b.y2-b.y1)/2;
    for (var s = 0; s < scales.length; s++) {
      var k = scales[s];
      var box = {x1:Math.max(0,cx-hw*k), y1:Math.max(0,cy-hh*k),
                 x2:Math.min(1,cx+hw*k), y2:Math.min(1,cy+hh*k)};
      var g = await api.genders(F.gender, v, [box]);
      var r = g[0]||{};
      out.push({fi:i, npx:b.npx, cx:+cx.toFixed(3), cy:+cy.toFixed(3), s:k,
                g:r.gender, sc:+(r.score||0).toFixed(3), raw:+(r.raw||0).toFixed(3),
                age:+(r.age||0).toFixed(1), childP:+(r.childP||0).toFixed(3)});
    }
  }
  return out;
})()
"""
rows = tab.eval(sweep) or []
print("== %s t=%s  rows=%d" % (label, at, len(rows)))
for r in rows:
    print(json.dumps(r))
