# THE QUESTION THE LAST THREE ROUNDS NEVER ASKED.
#
# Every earlier probe asked "does a patch escape today". This asks what
# happens WHEN one does, which is the part the owner keeps photographing.
#
# The sticky player is position:fixed z-index 2. A patch is
# position:absolute z-index 2 inside a host we promote to
# position:relative -- and position:relative with z-index:auto does NOT
# create a stacking context. If nothing between the patch and the root
# creates one either, the two z-index-2 boxes are painted in the SAME
# stacking context and DOM ORDER decides. #player-container-id is a child
# of <body>; the recommendations come after it. Later wins.
#
# The patch is built from region-blur's own cssText and hosted through
# resolveHost's own rule, so nothing here is a stand-in.
import json, time
from emu_cdp import page, Tab

PATCH_CSS = ("position:absolute;pointer-events:none;border-radius:8px;z-index:2;"
             "backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);")

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['home','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(35)
t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
time.sleep(25)

print(json.dumps(t.eval("""(function(){
  var pc=document.getElementById('player-container-id');
  if(!pc) return {err:'no player'};
  var p=pc.getBoundingClientRect();
  var pcs=getComputedStyle(pc);

  // Any element below the player that a thumbnail could live in.
  var cands=[].slice.call(document.querySelectorAll(
    'ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-item-section-renderer div, ytm-watch img'))
    .filter(function(n){var b=n.getBoundingClientRect(); return b.width>=80 && b.height>=40;});
  if(!cands.length) return {err:'nothing below the player has a box',
    recs:document.querySelectorAll('ytm-video-with-context-renderer').length,
    docH:document.documentElement.scrollHeight, bodyH:document.body.scrollHeight,
    innerH:innerHeight};

  var el=cands[0];
  var host=el.parentElement;
  // resolveHost, exactly as the shipped module does it -- position for
  // the coordinate space, isolation so the patch's z-index is scoped to
  // the thumbnail instead of competing with page chrome in the root.
  if(getComputedStyle(host).position==='static') host.style.position='relative';
  host.style.isolation='isolate';
  var hr=host.getBoundingClientRect();

  function makesContext(n){
    var s=getComputedStyle(n);
    if(s.position==='fixed'||s.position==='sticky') return 'position:'+s.position;
    if(s.zIndex!=='auto' && s.position!=='static') return 'z-index:'+s.zIndex+' '+s.position;
    if(s.opacity!=='1') return 'opacity:'+s.opacity;
    if(s.transform!=='none') return 'transform';
    if(s.filter!=='none') return 'filter';
    if(s.isolation==='isolate') return 'isolation';
    if(s.willChange&&/transform|opacity|filter/.test(s.willChange)) return 'will-change:'+s.willChange;
    if(/paint|layout|strict|content/.test(s.contain||'')) return 'contain:'+s.contain;
    if(s.mixBlendMode&&s.mixBlendMode!=='normal') return 'mix-blend-mode';
    return null;
  }
  var chain=[];
  for(var up=host; up && up!==document.documentElement; up=up.parentElement){
    var why=makesContext(up);
    if(why) chain.push({tag:up.tagName.toLowerCase()+(up.id?'#'+up.id:''), why:why});
  }

  var o=document.createElement('div');
  o.className='ts-gaze-region-patch ts-probe-patch';
  o.style.cssText=%s;
  // POINTER-EVENTS:NONE MAKES A PATCH INVISIBLE TO elementsFromPoint.
  // Every "the player wins" measurement in this repo -- 232 patch
  // samples, 900 in-player hit-tests, eight walk-under samples -- asked
  // a hit test about an element the hit test is specified to skip. Paint
  // order and hit order follow the SAME tree order, so turning hit
  // testing on changes what we can observe and not what is painted.
  o.style.pointerEvents='auto';
  // Put it exactly where a stale clamp would leave it: reaching up into
  // the player's box. Expressed in the host's own coordinates, the way
  // boxToParentRect expresses every real patch.
  o.style.left=Math.round(p.left+20-hr.left)+'px';
  o.style.top=Math.round(p.top+60-hr.top)+'px';
  o.style.width='180px'; o.style.height='100px';
  host.appendChild(o);

  var b=o.getBoundingClientRect();
  var x=Math.round(b.left+10), y=Math.round(b.top+10);
  var hits=document.elementsFromPoint(x,y)||[];
  var iP=hits.indexOf(o), iPl=-1;
  for(var k=0;k<hits.length;k++){ if(pc===hits[k]||pc.contains(hits[k])){iPl=k;break;} }
  var res={
    player:[Math.round(p.left),Math.round(p.top),Math.round(p.width),Math.round(p.height)],
    playerPos:pcs.position, playerZ:pcs.zIndex,
    hostTag:host.tagName.toLowerCase(), hostPos:getComputedStyle(host).position,
    stackingContextsBetweenPatchAndRoot:chain,
    patchRect:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
    overlapsPlayer: b.top<p.bottom&&b.bottom>p.top&&b.left<p.right&&b.right>p.left,
    hitAt:[x,y],
    hits:hits.slice(0,6).map(function(n){return n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(typeof n.className==='string'&&n.className?'.'+n.className.split(' ')[0]:'')}),
    iPatch:iP, iPlayer:iPl,
    PATCH_PAINTS_OVER_PLAYER: iP>=0 && (iPl<0 || iP<iPl)};
  o.remove();
  return res;})()""" % json.dumps(PATCH_CSS)), indent=1))
