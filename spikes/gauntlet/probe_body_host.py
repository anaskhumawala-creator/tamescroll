# COULD A PATCH EVER BE HOSTED ON <body>?
#
# resolveHost takes el.parentElement and, when that host is static,
# writes `position: relative` onto it, then `isolation: isolate`. There
# is no guard against the host being <body> or <html>. Body IS static on
# these pages, so an <img> that is a direct child of body would have us
# mutate the document's own layout root: position:relative on body
# re-anchors every absolutely-positioned descendant that currently
# resolves to the initial containing block.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
Q = """(function(){
  var b=document.body, h=document.documentElement;
  var imgs=[].slice.call(document.querySelectorAll('img'));
  var judgeable=imgs.filter(function(im){
    var r=im.getBoundingClientRect();
    return (im.naturalWidth||0)>=48 && r.width>=48 && (im.currentSrc||im.src);});
  var atRoot=judgeable.filter(function(im){
    return im.parentElement===b || im.parentElement===h;});
  return {url:location.href.slice(0,60), imgs:imgs.length, judgeable:judgeable.length,
    hostedAtRoot: atRoot.length,
    bodyPos: getComputedStyle(b).position, bodyIso: getComputedStyle(b).isolation,
    bodyInlinePos: b.style.position||'', bodyInlineIso: b.style.isolation||'',
    absKids: [].slice.call(b.children).filter(function(n){
      return getComputedStyle(n).position==='absolute';}).length};})()"""
def go(url, wait):
    t.cmd("Page.navigate", url=url); time.sleep(wait)
    for _ in range(3):
        t.eval("(function(){window.scrollBy(0,900);return 1})()"); time.sleep(4)
    return t.eval(Q)
for u,w in (("https://m.youtube.com/", 26),
            ("https://m.youtube.com/results?search_query=podcast+interview", 26),
            ("https://m.youtube.com/watch?v=NWoT1ZVd1Lo", 30)):
    print(json.dumps(go(u,w)))
