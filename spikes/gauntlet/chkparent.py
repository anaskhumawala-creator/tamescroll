import json, emu_cdp
t = emu_cdp.Tab(emu_cdp.page())
print(json.dumps(t.eval("""(function(){
  var p=document.querySelector('.ts-gaze-pill');
  if(!p) return {err:'no pill'};
  var n=p.parentElement;
  var box=p.getBoundingClientRect();
  return {parent:n.tagName+(n.id?'#'+n.id:''),
          box:[box.x|0,box.y|0,box.width|0,box.height|0],
          marker: window.__TS_GAZE_BUNDLE__||null};})()"""), indent=1))
