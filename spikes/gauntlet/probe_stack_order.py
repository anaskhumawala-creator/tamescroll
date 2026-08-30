# WHO PAINTS ON TOP: a recommendation's patch, or the sticky player?
#
# The clamp is stale (see probe_clamp_stale.py), so a patch CAN end up
# overlapping the player's box. What that looks like is decided by the
# cascade, not by us: the player is position:fixed z-index 2, and a patch
# is position:absolute z-index 2 inside a host we promote to
# position:relative -- which does NOT create a stacking context. If no
# ancestor between the patch and the root creates one either, the two
# z-index-2 boxes are siblings in the ROOT stacking context and DOM order
# decides. #player-container-id is body's child; ytm-watch comes after
# it. Later wins.
#
# This stages exactly the geometry the stale clamp permits and asks
# elementsFromPoint who is on top. No synthetic z-index, no guessing:
# the patch is built with region-blur's own cssText.
import json
from emu_cdp import page, Tab

PATCH_CSS = ("position:absolute;pointer-events:none;border-radius:8px;z-index:2;"
             "backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);")

t = Tab(page()); t.cmd("Runtime.enable")
print(json.dumps(t.eval("""(function(){
  var pc=document.getElementById('player-container-id');
  if(!pc) return {err:'no player', href:location.href.slice(0,60)};
  var p=pc.getBoundingClientRect();
  // A real recommendation thumbnail, below the player.
  var imgs=[].slice.call(document.querySelectorAll('ytm-video-with-context-renderer img'))
    .filter(function(i){var b=i.getBoundingClientRect(); return b.width>=60;});
  if(!imgs.length){
    imgs=[].slice.call(document.querySelectorAll('ytm-video-with-context-renderer'))
      .filter(function(n){return n.getBoundingClientRect().width>=60;});
  }
  if(!imgs.length) return {err:'no recommendation element with a box',
                           recs:document.querySelectorAll('ytm-video-with-context-renderer').length};
  var el=imgs[0];
  // resolveHost, exactly as region-blur does it.
  var host=el.parentElement;
  if(getComputedStyle(host).position==='static') host.style.position='relative';
  var hr=host.getBoundingClientRect();

  // Every stacking context between the patch and the root -- this is
  // what actually decides the answer.
  function makesContext(n){
    var s=getComputedStyle(n);
    if(s.position==='fixed'||s.position==='sticky') return 'position:'+s.position;
    if(s.zIndex!=='auto' && s.position!=='static') return 'z-index:'+s.zIndex+' '+s.position;
    if(s.opacity!=='1') return 'opacity:'+s.opacity;
    if(s.transform!=='none') return 'transform';
    if(s.filter!=='none') return 'filter';
    if(s.isolation==='isolate') return 'isolation';
    if(s.willChange&&/transform|opacity|filter/.test(s.willChange)) return 'will-change';
    if(/paint|layout|strict|content/.test(s.contain||'')) return 'contain:'+s.contain;
    if(s.mixBlendMode&&s.mixBlendMode!=='normal') return 'mix-blend-mode';
    return null;
  }
  var chain=[];
  for(var up=host; up && up!==document.documentElement; up=up.parentElement){
    var why=makesContext(up);
    if(why) chain.push({tag:up.tagName.toLowerCase(), why:why});
  }

  var o=document.createElement('div');
  o.className='ts-gaze-region-patch ts-probe-patch';
  o.style.cssText=%s;
  // The geometry a stale clamp allows: the patch reaching up over the
  // player, expressed in the host's own coordinate space exactly the way
  // boxToParentRect would express it.
  var wantTop = p.top + 40;              // 40px INTO the player box
  o.style.left=Math.round(el.getBoundingClientRect().left-hr.left)+'px';
  o.style.top=Math.round(wantTop-hr.top)+'px';
  o.style.width='160px'; o.style.height='90px';
  host.appendChild(o);

  var b=o.getBoundingClientRect();
  var x=Math.round(b.left+8), y=Math.round(b.top+8);
  var hits=document.elementsFromPoint(x,y)||[];
  var iP=hits.indexOf(o), iPl=-1;
  for(var k=0;k<hits.length;k++){ if(pc.contains(hits[k])){iPl=k;break;} }
  var names=hits.slice(0,6).map(function(n){return n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(n.className&&typeof n.className==='string'?'.'+n.className.split(' ')[0]:'')});
  var res={player:[Math.round(p.left),Math.round(p.top),Math.round(p.width),Math.round(p.height)],
    playerZ:getComputedStyle(pc).zIndex, playerPos:getComputedStyle(pc).position,
    hostTag:host.tagName.toLowerCase(), hostPos:getComputedStyle(host).position,
    stackingChainAboveHost:chain,
    patchRect:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
    hitAt:[x,y], hits:names, iPatch:iP, iPlayer:iPl,
    PATCH_PAINTS_OVER_PLAYER: iP>=0 && (iPl<0 || iP<iPl)};
  o.remove();
  return res;})()""" % json.dumps(PATCH_CSS)), indent=1))
