# DOES OUR OWN HIDING SAVE ANY INFERENCE?
#
# We now hide a Breaking-news shelf on home that carries ~14 thumbnails.
# tagImage gates on naturalWidth only -- no visibility check anywhere in
# the queue path -- so the question is whether those thumbnails are still
# judged. Every judged thumbnail is ~1.6s of GPU work on his phone.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/")

READ = """(function(){
  function hiddenBy(el){
    // walk up: the first ancestor that removes it from layout
    for(var n=el; n && n.nodeType===1; n=n.parentElement){
      var cs;
      try{cs=getComputedStyle(n);}catch(e){return 'nostyle';}
      if(cs.display==='none') return n.tagName.toLowerCase();
      if(cs.visibility==='hidden') return n.tagName.toLowerCase()+':vis';
    }
    return null;
  }
  var imgs=[].slice.call(document.querySelectorAll('img'));
  var big=[], hidden=[], vis=[];
  imgs.forEach(function(im){
    var side=Math.min(im.naturalWidth||0, im.naturalHeight||0);
    if(side < 48) return;
    var s=(im.currentSrc||im.src||'').slice(0,90);
    var h=hiddenBy(im);
    var rec={s:s, side:side, hid:h};
    big.push(rec);
    (h?hidden:vis).push(rec);
  });
  var ring=(window.__TS_GAZE_IMGDIAG||[]).map(function(e){
    return {s:e.src||'', why:e.why||'', where:e.where||'', ms:e.ms||0, faces:e.faces};
  });
  var judged={}; ring.forEach(function(e){ if(e.s) judged[e.s]=e; });
  var hidJudged=hidden.filter(function(r){return r.s && judged[r.s];});
  var visJudged=vis.filter(function(r){return r.s && judged[r.s];});
  return {
    total: window.__TS_GAZE_IMGTOTAL||0,
    ringLen: ring.length,
    ready: !!window.__TS_GAZE_READY,
    imgsBig: big.length, imgsHidden: hidden.length, imgsVisible: vis.length,
    hiddenJudged: hidJudged.length, visibleJudged: visJudged.length,
    hiddenHosts: (function(){var m={};hidden.forEach(function(r){m[r.hid]=(m[r.hid]||0)+1});return m;})(),
    hiddenJudgedHosts: (function(){var m={};hidJudged.forEach(function(r){m[r.hid]=(m[r.hid]||0)+1});return m;})(),
    hiddenJudgedMs: hidJudged.reduce(function(a,r){return a+(judged[r.s].ms||0);},0),
    sampleHiddenJudged: hidJudged.slice(0,5).map(function(r){
      return {hid:r.hid, side:r.side, why:judged[r.s].why, ms:judged[r.s].ms};}),
    shelves: document.querySelectorAll('ytm-rich-section-renderer').length,
    shelvesVisible: [].slice.call(document.querySelectorAll('ytm-rich-section-renderer'))
      .filter(function(s){return getComputedStyle(s).display!=='none';}).length
  };})()"""

out=[]
for wait in (30, 25, 25):
    time.sleep(wait)
    r=t.eval(READ)
    r["atSec"]=sum(x for x in (30,25,25)[:len(out)+1])
    out.append(r)
print(json.dumps(out, indent=1))
