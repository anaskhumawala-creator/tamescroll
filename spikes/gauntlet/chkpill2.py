import time, json
import emu_cdp
t = emu_cdp.Tab(emu_cdp.page()); t.cmd("Input.enable")
print(json.dumps(t.eval("""(function(){
  var pill=document.querySelector('.ts-gaze-pill');
  if(!pill) return {err:'no pill'};
  var cs=getComputedStyle(pill);
  var chain=[]; for(var n=pill; n && chain.length<7; n=n.parentElement){
    var c=getComputedStyle(n);
    var cl=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    chain.push({tag:n.tagName, id:n.id, cls:String(cl).slice(0,40),
                pos:c.position, z:c.zIndex, iso:c.isolation, op:c.opacity, tr:c.transform!=='none'});
  }
  var bg=document.querySelector('.player-controls-background');
  var order = bg? (pill.compareDocumentPosition(bg)&4 ? 'bg AFTER pill' : 'bg BEFORE pill') : null;
  return {pillPos:cs.position, pillZ:cs.zIndex, sameParent: bg&&bg.parentElement===pill.parentElement,
          bgParent: bg? (bg.parentElement.id||bg.parentElement.className||'').toString().slice(0,40):null,
          domOrder:order, chain:chain};})()"""), indent=1))
# does a clean tap toggle it?
st=lambda: t.eval("(function(){var p=document.querySelector('.ts-gaze-pill');return p?(p.textContent||'').trim():null})()")
q=t.eval("(function(){var p=document.querySelector('.ts-gaze-pill').getBoundingClientRect();return [Math.round(p.left+p.width/2),Math.round(p.top+p.height/2)]})()")
before=st()
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":q[0],"y":q[1]}]); time.sleep(0.05)
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(1.5)
print("clean tap:", before, "->", st())
