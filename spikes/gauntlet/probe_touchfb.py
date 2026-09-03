import json, sys, time
from emu_cdp import Tab, page
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
print(t.eval("""(function(){
  var n = document.querySelectorAll('yt-touch-feedback-shape');
  var out = [];
  for (var i=0;i<n.length && i<4;i++){
    var e=n[i], cs=getComputedStyle(e), r=e.getBoundingClientRect();
    var kids=[];
    for (var j=0;j<e.children.length;j++){
      var k=e.children[j], ks=getComputedStyle(k);
      kids.push({t:k.tagName, c:String(k.className), bg:ks.backgroundColor, op:ks.opacity, d:ks.display});
    }
    out.push({cls:String(e.className), d:cs.display, op:cs.opacity, bg:cs.backgroundColor,
              box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
              host:(e.parentElement&&e.parentElement.tagName)||null, kids:kids});
  }
  return JSON.stringify({count:n.length, sample:out}, null, 1);})()"""))
# now watch one gesture and log every class value in full
t.eval("""(function(){
  window.__FB=[]; var t0=performance.now();
  var mo=new MutationObserver(function(rs){
    for (var i=0;i<rs.length && window.__FB.length<80;i++){
      var r=rs[i];
      window.__FB.push({t:Math.round(performance.now()-t0), n:r.target.tagName,
                        c:String(r.target.className||''),
                        op:getComputedStyle(r.target).opacity,
                        bg:getComputedStyle(r.target).backgroundColor});
    }
  });
  mo.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class','style']});
  return 1;})()""")
it = t.eval("""(function(){var i=document.querySelectorAll('ytm-rich-item-renderer')[1]||document.querySelector('ytm-rich-item-renderer');
  var r=i.getBoundingClientRect(); return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
cx, cy = it
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": cx, "y": cy}])
time.sleep(0.05)
for i in range(1, 16):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x": cx, "y": cy - i*14}])
    time.sleep(0.03)
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(1.0)
print(t.eval("JSON.stringify(window.__FB.filter(function(f){return /TouchFeedback|touch-feedback/i.test(f.n+f.c);}), null, 1)"))
