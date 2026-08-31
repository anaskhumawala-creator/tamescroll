# WHY is the logo pending but never judged? Ask the page, do not guess.
import json, time
from emu_cdp import page, Tab
t=Tab(page())
print("state:", json.dumps(t.eval("""(function(){
  var im=document.querySelector('img.mobile-topbar-logo');
  return {complete:im.complete, natW:im.naturalWidth, natH:im.naturalHeight,
    pending:im.classList.contains('ts-gaze-pending'),
    imgTotal:window.__TS_GAZE_IMGTOTAL||0};})()""")))

# Force the src-swap path the MutationObserver watches. If the pipeline
# is healthy this must produce a ring entry for it.
print("swap:", json.dumps(t.eval("""(function(){
  var im=document.querySelector('img.mobile-topbar-logo');
  var s=im.currentSrc; im.setAttribute('src', s);
  return {before:window.__TS_GAZE_IMGTOTAL||0};})()""")))
time.sleep(14)
print("after:", json.dumps(t.eval("""(function(){
  var im=document.querySelector('img.mobile-topbar-logo');
  var ring=(window.__TS_GAZE_IMGDIAG||[]);
  var mine=ring.filter(function(e){return (e.src||'').indexOf('gstatic')>=0;});
  return {imgTotal:window.__TS_GAZE_IMGTOTAL||0,
    pending:im.classList.contains('ts-gaze-pending'),
    filter:getComputedStyle(im).filter,
    gstaticEntries:mine.length, detail:mine.slice(0,3)};})()""")))
