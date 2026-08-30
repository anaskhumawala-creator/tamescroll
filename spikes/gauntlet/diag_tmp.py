import json
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable")
print(json.dumps(t.eval("""(function(){
  var b=getComputedStyle(document.body);
  var before=window.scrollY; window.scrollBy(0,400); var after=window.scrollY;
  return {href:location.href.slice(0,70), bodyPos:b.position, bodyOverflow:b.overflow,
    docH:document.documentElement.scrollHeight, innerH:innerHeight,
    scrolled:after-before, scrollY:after,
    consent:document.querySelectorAll('ytm-consent-bump-v2-renderer').length,
    modalAttr:document.body.hasAttribute('modal-open-body'),
    recs:document.querySelectorAll('ytm-video-with-context-renderer').length,
    imgs:document.querySelectorAll('img').length,
    pending:document.querySelectorAll('img.ts-gaze-pending').length,
    judged:window.__TS_GAZE_IMGTOTAL||0,
    scroller:(document.scrollingElement||{}).tagName};})()"""), indent=1))
