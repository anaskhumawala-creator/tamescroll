# resolveHost sets `position: relative` on YouTube's own element so our
# patch can be anchored to it. That changes the containing block for any
# absolutely-positioned DESCENDANT of that element -- YouTube's duration
# badge, progress bar, hover chrome. Does anything actually move?
# JSON only, headless emulator.
import json, time
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = "https://m.youtube.com/results?search_query=linus+tech+tips"

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url=URL)
time.sleep(14)

print(json.dumps(t.eval("""(function(){
  // Every element we would ever host a patch on: the parent of a
  // thumbnail-sized <img>.
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    var r=i.getBoundingClientRect(); return r.width>=48 && r.height>=48;});
  var hosts=[]; var seen=new Set();
  imgs.forEach(function(i){ var h=i.parentElement;
    if(h && !seen.has(h)){ seen.add(h); hosts.push(h);} });
  var staticHosts=hosts.filter(function(h){
    return getComputedStyle(h).position==='static';});
  var moved=[], checked=0, absKids=0;
  staticHosts.forEach(function(h){
    var kids=[].slice.call(h.querySelectorAll('*')).filter(function(e){
      return getComputedStyle(e).position==='absolute';});
    absKids+=kids.length;
    var before=kids.map(function(e){var r=e.getBoundingClientRect();
      return {e:e, l:r.left, t:r.top, w:r.width, hh:r.height};});
    h.style.position='relative';
    void h.offsetHeight;
    before.forEach(function(b){
      checked++;
      var r=b.e.getBoundingClientRect();
      if(Math.abs(r.left-b.l)>0.5||Math.abs(r.top-b.t)>0.5||
         Math.abs(r.width-b.w)>0.5||Math.abs(r.height-b.hh)>0.5){
        moved.push({tag:b.e.tagName.toLowerCase(),
          c:(b.e.className||'').toString().slice(0,40),
          from:[Math.round(b.l),Math.round(b.t),Math.round(b.w),Math.round(b.hh)],
          to:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]});}});
    h.style.position='';
  });
  return {thumbImgs:imgs.length, hosts:hosts.length, staticHosts:staticHosts.length,
          absDescendants:absKids, checked:checked, movedCount:moved.length,
          moved:moved.slice(0,6)};})()"""), indent=1))
