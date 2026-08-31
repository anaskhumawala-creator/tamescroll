# ONE on-screen image stayed pending at EVERY step of the scroll back up
# and at the top. Same element each time, or a rolling just-arrived one?
import json, time
from emu_cdp import page, Tab
t=Tab(page())
ASK = """(function(){
  var vh=window.innerHeight||0;
  var big=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  var pend=big.filter(function(i){return i.classList.contains('ts-gaze-pending');});
  function on(i){var r=i.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.bottom>0&&r.top<vh;}
  return pend.filter(on).map(function(i){
    var r=i.getBoundingClientRect();
    return {w:Math.round(r.width),h:Math.round(r.height),
      top:Math.round(r.top),left:Math.round(r.left),
      nat:[i.naturalWidth,i.naturalHeight],
      cls:(i.className||'').slice(0,60),
      parent:(i.parentElement||{}).tagName,
      alt:(i.alt||'').slice(0,40),
      src:(i.currentSrc||'').slice(-52)};});})()"""
for k in range(4):
    print(json.dumps(t.eval(ASK)))
    time.sleep(9)
