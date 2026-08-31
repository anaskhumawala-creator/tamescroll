import json
from emu_cdp import page, Tab
t = Tab(page())
print(json.dumps(t.eval("""(function(){
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ')[0]:'');};
  var out={};
  [1,10,30,47,60,150,278,300].forEach(function(y){
    var st=document.elementsFromPoint(206,y);
    out['y'+y]=st.slice(0,4).map(nm);
  });
  var bar=document.querySelector('ytm-mobile-topbar-renderer');
  var br=bar?bar.getBoundingClientRect():null;
  var pc=document.querySelector('#player-container-id').getBoundingClientRect();
  return {stacks:out,
    topbar: bar? {box:[br.x|0,br.y|0,br.width|0,br.height|0], pos:getComputedStyle(bar).position}: null,
    player:[pc.x|0,pc.top|0,pc.width|0,pc.height|0],
    scrollY:Math.round(document.scrollingElement.scrollTop)};})()"""), indent=1))
