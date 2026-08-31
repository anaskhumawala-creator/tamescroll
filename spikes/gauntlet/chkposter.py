import json
from emu_cdp import page, Tab
t = Tab(page())
print(json.dumps(t.eval("""(function(){
  var pcid=document.querySelector('#player-container-id');
  var im=pcid.querySelector('img');
  if(!im) return {err:'gone'};
  var cs=getComputedStyle(im);
  var r=im.getBoundingClientRect();
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ').slice(0,2).join('.'):'');};
  var chain=[]; for(var n=im;n&&chain.length<6;n=n.parentElement){
    var c=getComputedStyle(n);
    chain.push({el:nm(n), pos:c.position, z:c.zIndex, disp:c.display, vis:c.visibility, op:c.opacity});}
  var mid=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
  return {cls:im.className, box:[r.x|0,r.y|0,r.width|0,r.height|0],
    filter:cs.filter, display:cs.display, visibility:cs.visibility, opacity:cs.opacity,
    zIndex:cs.zIndex, natural:[im.naturalWidth,im.naturalHeight],
    srcLen:(im.currentSrc||im.src||'').length,
    hitAtCentre: nm(mid), chain:chain};})()"""), indent=1))
