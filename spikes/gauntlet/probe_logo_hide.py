# HE SAID REPLACE IT WITH NOTHING. Before writing the rule: what exactly
# is in that corner, what wraps it, and does hiding the <img> cost the
# HOME TAP TARGET? A rule that blanks the corner is fine; one that takes
# away the way back to home is not.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs','home_chips']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(26)

READ = """(function(){
  function box(e){ if(!e) return null; var r=e.getBoundingClientRect();
    return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]; }
  var bar=document.querySelector('ytm-mobile-topbar-renderer');
  var img=document.querySelector('img.mobile-topbar-logo');
  var a=img?img.closest('a'):null;
  var chain=[]; for(var n=img;n&&n!==document.body;n=n.parentElement){
    chain.push(n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+
      (n.className&&n.className.baseVal===undefined&&n.className?'.'+String(n.className).trim().split(/\s+/).join('.'):''));
    if(chain.length>6) break; }
  var links=bar?[].slice.call(bar.querySelectorAll('a')).map(function(x){
      return {href:x.getAttribute('href'),box:box(x),label:(x.getAttribute('aria-label')||'').slice(0,40)};}):[];
  return {bar:box(bar), img:box(img), imgSrcHost:img?(img.currentSrc||img.src||'').split('/')[2]:null,
    imgAlt:img?img.alt:null, chain:chain, anchor:box(a),
    anchorHref:a?a.getAttribute('href'):null, links:links,
    imgs:bar?bar.querySelectorAll('img').length:0,
    svgs:bar?bar.querySelectorAll('svg').length:0};})()"""

before = t.eval(READ)
t.eval("""(function(){var s=document.createElement('style'); s.id='ts-probe-hide';
  s.textContent='img.mobile-topbar-logo{display:none !important}';
  document.documentElement.appendChild(s); return 1;})()""")
time.sleep(0.6)
after = t.eval(READ)
# is the home link still hittable where it used to be?
hit = t.eval("""(function(){
  var a=document.querySelector('ytm-mobile-topbar-renderer a[href="/"]')||
        document.querySelector('ytm-mobile-topbar-renderer a');
  if(!a) return {a:false};
  var r=a.getBoundingClientRect();
  if(r.width<1||r.height<1) return {a:true,zero:true,box:[r.width,r.height]};
  var el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  return {a:true, zero:false, w:Math.round(r.width), h:Math.round(r.height),
    hit:el?el.tagName.toLowerCase():null,
    inAnchor:!!(el&&el.closest&&el.closest('a')===a)};})()""")
t.eval("(function(){var s=document.getElementById('ts-probe-hide'); if(s) s.remove(); return 1;})()")
print(json.dumps({"before":before,"after":after,"homeHitAfterHide":hit}, indent=1))
