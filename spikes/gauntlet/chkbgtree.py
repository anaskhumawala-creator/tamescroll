import json, emu_cdp
t = emu_cdp.Tab(emu_cdp.page())
print(json.dumps(t.eval("""(function(){
  var bg=document.querySelector('.player-controls-background');
  if(!bg) return {err:'no bg -- tap the video first'};
  var name=function(n){var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ').slice(0,2).join('.'):'');};
  var chain=[]; for(var n=bg;n&&chain.length<9;n=n.parentElement){
    var cs=getComputedStyle(n);
    chain.push({el:name(n), pos:cs.position, z:cs.zIndex, op:cs.opacity, tr:cs.transform!=='none', pe:cs.pointerEvents});
  }
  var mp=document.querySelector('#movie_player');
  var pcid=document.querySelector('#player-container-id');
  return {chain:chain, inMoviePlayer: mp?mp.contains(bg):null,
          inPlayerContainer: pcid?pcid.contains(bg):null,
          bgBox:(function(){var r=bg.getBoundingClientRect();return [r.x|0,r.y|0,r.width|0,r.height|0]})()};})()"""), indent=1))
