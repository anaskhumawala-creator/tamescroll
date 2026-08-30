# The round trip failed once with the moves dispatched back to back and
# passed with a read between each. Speed is the variable, so run the fast
# cadence three times and see whether the stuck frame is real.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Runtime.enable")
READ = """(function(){var pc=document.getElementById('player-container-id');
  if(!pc) return null;
  var b=pc.getBoundingClientRect();
  return {state:window.__TS_MINI_STATE||'full', inline:pc.style.transform||'',
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    rect:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)]};})()"""

def drag(dy, steps=8, settle=1.2):
    c = t.eval("""(function(){var b=document.getElementById('player-container-id').getBoundingClientRect();
      return [Math.round(b.left+b.width/2), Math.round(b.top+b.height/2)];})()""")
    cx, cy = c
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
    for i in range(1, steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":cx,"y":cy+dy*i//steps}])
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[{"x":cx,"y":cy+dy}])
    time.sleep(settle)
    return t.eval(READ)

out=[]
for cycle in range(3):
    out.append({"cycle":cycle, "minimise":drag(120), "restore":drag(-90)})
print(json.dumps(out, indent=1))
