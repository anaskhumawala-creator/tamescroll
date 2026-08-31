# WHAT IS ON HIS HOME PAGE AS HE SCROLLS IT, with his real toggles.
#
# Measured on his phone first, not assumed: the injected sheet carries
# the SHELF rule (ytm-rich-section-renderer) and NOT the grid rule, so
# on his device the Home feed is SHOWN and Feed shelves are HIDDEN.
# `home_shelves` covers exactly one element type, so the question his
# "random homepage elements" asks is whether anything that is not a
# video and not a rich-section reaches the grid.
#
# Loop 11 answered that SIGNED OUT (four kinds of thing and nothing
# else). This is the signed-in answer, over a real scroll.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
STEPS = int(sys.argv[2]) if len(sys.argv) > 2 else 10

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
# HIS PATH, NOT A CDP NAVIGATION. A probe that navigates straight to
# m.youtube never calls open_platform, so the sheet is built from the
# DEFAULTS rather than his stored toggles -- the documented loop-2
# gotcha, and it cost this probe a whole run: the first census read 76
# visible feed items on a phone whose Home feed is switched OFF.
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(7)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  var map=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');
  await inv('open_platform',{id:'youtube',
    mode:localStorage.getItem('tamescroll.blur')||'smart', strength:24,
    gender:localStorage.getItem('tamescroll.gender')||'man',
    shown:map['youtube']||[]});
  return 1;})()""")
time.sleep(22)

CENSUS = """(function(){
  var g=document.querySelector('ytm-rich-grid-renderer');
  if(!g) return JSON.stringify({grid:false});
  // The grid's own direct children are wrapper DIVs now, so a census at
  // that level sees two enormous "rows" and learns nothing (loop 24).
  // Go one level deeper and take the custom elements.
  var kinds={}, vis={}, tallest={};
  var walk=g.querySelectorAll('*');
  for(var i=0;i<walk.length;i++){
    var e=walk[i], tag=e.tagName.toLowerCase();
    if(tag.indexOf('ytm-')!==0) continue;
    // Only the top-most custom element of each subtree: a nested
    // lockup/view-model reports the same item several times.
    var p=e.parentElement, nested=false;
    while(p && p!==g){ if(p.tagName.toLowerCase().indexOf('ytm-')===0){nested=true;break;} p=p.parentElement; }
    if(nested) continue;
    kinds[tag]=(kinds[tag]||0)+1;
    var r=e.getBoundingClientRect();
    var cs=getComputedStyle(e);
    if(r.height>2 && cs.display!=='none'){
      vis[tag]=(vis[tag]||0)+1;
      if(!tallest[tag]||r.height>tallest[tag]) tallest[tag]=Math.round(r.height);
    }
  }
  var se=document.scrollingElement||document.documentElement;
  var b=document.body;
  var s=(b.scrollHeight>se.scrollHeight)?b:se;
  return JSON.stringify({grid:true,kinds:kinds,vis:vis,tallest:tallest,
    scrollTop:Math.round(s.scrollTop),scrollH:Math.round(s.scrollHeight)});})()"""

agg = {}
for step in range(STEPS):
    raw = t.eval(CENSUS)
    d = json.loads(raw) if isinstance(raw, str) else {}
    if d.get('grid'):
        for k, v in d.get('kinds', {}).items():
            a = agg.setdefault(k, {'seen': 0, 'visible': 0, 'maxH': 0})
            a['seen'] = max(a['seen'], v)
            a['visible'] = max(a['visible'], d.get('vis', {}).get(k, 0))
            a['maxH'] = max(a['maxH'], d.get('tallest', {}).get(k, 0))
    before = d.get('scrollTop', 0)
    # DRIVE THE ELEMENT WITH THE MOST SCROLL ROOM AND PRINT THE
    # DISTANCE -- on m.youtube the scroller is sometimes <body>, and a
    # probe that moves 0px reads a healthy feed as a three-item one. The
    # first run of this probe did exactly that from step 2 onward.
    t.eval("""(function(){
      var cands=[document.scrollingElement,document.documentElement,document.body];
      var all=document.querySelectorAll('div,ytm-app,#app');
      for(var i=0;i<all.length && cands.length<400;i++) cands.push(all[i]);
      var best=null,room=0;
      for(var c=0;c<cands.length;c++){
        var e=cands[c]; if(!e) continue;
        var r=e.scrollHeight-e.clientHeight;
        if(r>room){room=r;best=e;}
      }
      if(best) best.scrollTop=best.scrollTop+1400;
      window.scrollBy(0,1400);
      return 1;})()""")
    time.sleep(2.5)
    after = json.loads(t.eval(CENSUS)).get('scrollTop', 0)
    print("step %d scrolled %d -> %d" % (step, before, after))

rows = sorted(([k] + [v['seen'], v['visible'], v['maxH']] for k, v in agg.items()),
              key=lambda r: -r[3])
print()
print("%-42s %6s %8s %6s" % ("element", "seen", "visible", "maxH"))
for r in rows:
    print("%-42s %6d %8d %6d" % (r[0], r[1], r[2], r[3]))
