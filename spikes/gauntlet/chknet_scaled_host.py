# 1067's image-path change is a NET: no feed host is scaled today, so it
# never fires. A net nobody has seen fire is a claim, not a fix. Scale a
# real thumbnail host on a live feed, force a reposition, and measure
# whether the patch still lands on the image.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(28)
for i in range(4):
    t.eval("(function(){var e=document.scrollingElement||document.body; e.scrollBy(0,600); return 1;})()")
    time.sleep(3)
time.sleep(10)

MEASURE = """(function(scaleIt){
  var pats=[].slice.call(document.querySelectorAll('div')).filter(function(d){
    return d.style && d.style.backdropFilter && d.style.position==='absolute';});
  if(!pats.length) return {err:'no patches'};
  var p=pats[0], host=p.parentElement, img=host.querySelector('img');
  if(!img) return {err:'no image in host'};
  if(scaleIt){ host.style.transform='scale(0.5)'; host.style.transformOrigin='top left'; }
  // force the sweep to reposition: nudge the element rect it compares on
  window.dispatchEvent(new Event('resize'));
  var ir=img.getBoundingClientRect(), pr=p.getBoundingClientRect();
  return {scaled:!!scaleIt,
    hostScale:+(host.getBoundingClientRect().width/host.offsetWidth).toFixed(3),
    img:[Math.round(ir.left),Math.round(ir.top),Math.round(ir.width),Math.round(ir.height)],
    patch:[Math.round(pr.left),Math.round(pr.top),Math.round(pr.width),Math.round(pr.height)],
    normOnImg:[+((pr.left-ir.left)/ir.width).toFixed(3), +((pr.top-ir.top)/ir.height).toFixed(3),
               +(pr.width/ir.width).toFixed(3), +(pr.height/ir.height).toFixed(3)],
    inside: pr.left>=ir.left-2 && pr.top>=ir.top-2 &&
            pr.right<=ir.right+2 && pr.bottom<=ir.bottom+2};})"""

before = t.eval("(%s)(false)" % MEASURE)
t.eval("(%s)(true)" % MEASURE)
time.sleep(1.2)
after = t.eval("(%s)(false)" % MEASURE)
# put the page back the way it was
t.eval("""(function(){var pats=[].slice.call(document.querySelectorAll('div')).filter(function(d){
  return d.style && d.style.backdropFilter && d.style.position==='absolute';});
  if(pats.length){var h=pats[0].parentElement; h.style.transform=''; h.style.transformOrigin='';}
  return 1;})()""")
print(json.dumps({"unscaled":before,"scaledHost":after}, indent=1))
