import json, time, emu_cdp
t = emu_cdp.Tab(emu_cdp.page()); t.cmd("Input.enable")
name = """function(n){var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
  return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ').slice(0,2).join('.'):'');}"""
# reveal controls, list the buttons in the mobile control overlay
t.eval("(function(){var b=document.querySelector('#player-container-id').getBoundingClientRect();return 1})()")
print(json.dumps(t.eval("""(function(){
  var ov=document.querySelector('#player-control-overlay');
  if(!ov) return {err:'no overlay'};
  var name=%s;
  var out=[];
  ov.querySelectorAll('button,[role="button"]').forEach(function(el){
    var r=el.getBoundingClientRect();
    out.push({el:name(el), label:(el.getAttribute('aria-label')||'').slice(0,30),
              x:r.x|0,y:r.y|0,w:r.width|0,h:r.height|0});
  });
  return {n:out.length, btns:out};})()""" % name), indent=1))
