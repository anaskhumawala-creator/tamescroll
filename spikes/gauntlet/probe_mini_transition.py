# Does the inline `transition:none` in parked() actually take effect?
# The stylesheet sets it with !important under html.ts-mini, and an
# author !important beats a plain inline declaration -- so the measure
# in parked() would be reading a box that is still animating.
import json
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable")
print(json.dumps(t.eval("""(function(){
  var pc=document.getElementById('player-container-id');
  if(!pc) return {err:'no pc', path:location.pathname};
  var de=document.documentElement;
  var had=de.classList.contains('ts-mini');
  de.classList.add('ts-mini'); de.classList.remove('ts-mini-drag');
  var before=getComputedStyle(pc).transitionDuration;
  pc.style.transition='none';
  var plain=getComputedStyle(pc).transitionDuration;
  pc.style.setProperty('transition','none','important');
  var bang=getComputedStyle(pc).transitionDuration;
  pc.style.removeProperty('transition');
  if(!had) de.classList.remove('ts-mini');
  return {sheetOnly:before, inlinePlain:plain, inlineImportant:bang};})()"""), indent=1))
