"""Owner, 2026-09-02: the mini player's X re-expands the player instead
of closing it, and "the title bar kind of stays showing" while parked.
Park the player with a real drag, list what is VISIBLE inside the parked
container (tag/id/class/text/rect), screenshot the parked box for
evidence (scratchpad, deleted after reading), then tap X and report
where the page went.

    python probe_mini_close.py <port> <label> [videoId] [screenshotDir]
"""
import base64, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402

PORT = int(sys.argv[1]); LABEL = sys.argv[2]
VIDEO = sys.argv[3] if len(sys.argv) > 3 else "NWoT1ZVd1Lo"
SHOT = sys.argv[4] if len(sys.argv) > 4 else None

def drag(t, x, y, dy, steps=8):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": x, "y": y}]); time.sleep(0.05)
    for i in range(1, steps + 1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x": x, "y": y + int(dy * i / steps)}]); time.sleep(0.04)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(1.5)

def tap(t, x, y):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": x, "y": y}]); time.sleep(0.06)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(2.0)

STATE = r"""(function(){ var pc=document.getElementById('player-container-id'); var r=pc?pc.getBoundingClientRect():null;
  var v=document.querySelector('#player-container-id video');
  var x=document.querySelector('#ts-mini-btns button[aria-label="Close mini player"]'); var xr=x?x.getBoundingClientRect():null;
  return JSON.stringify({href:location.href, mini:document.documentElement.classList.contains('ts-mini'), gone:document.documentElement.classList.contains('ts-mini-gone'),
    state:window.__TS_MINI_STATE, pc:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null, paused:v?v.paused:null,
    x:xr?[Math.round(xr.left+xr.width/2),Math.round(xr.top+xr.height/2)]:null,
    nav:(window.navigation&&window.navigation.entries)?window.navigation.entries().map(function(e){return e.url;}):null, navIdx:window.navigation&&window.navigation.currentEntry?window.navigation.currentEntry.index:null}); })()"""

VISIBLE = r"""(function(){ var pc=document.getElementById('player-container-id'); if(!pc) return '[]'; var pr=pc.getBoundingClientRect(); var out=[];
  var all=pc.querySelectorAll('*');
  for(var i=0;i<all.length;i++){ var e=all[i]; var cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) continue;
    var r=e.getBoundingClientRect(); if(r.width<8||r.height<8) continue;
    var tx=(e.childElementCount===0?(e.textContent||''):'').trim().slice(0,40);
    var bg=cs.backgroundColor; var img=cs.backgroundImage!=='none';
    if(!tx && !img && (bg==='rgba(0, 0, 0, 0)'||bg==='transparent') && e.tagName!=='VIDEO' && e.tagName!=='CANVAS' && e.tagName!=='IMG' && e.tagName!=='BUTTON' && e.tagName!=='svg') continue;
    out.push({t:e.tagName.toLowerCase(), id:e.id||undefined, c:(typeof e.className==='string'?e.className:'').slice(0,60), tx:tx||undefined, bg:bg!=='rgba(0, 0, 0, 0)'?bg:undefined,
      r:[Math.round(r.left-pr.left),Math.round(r.top-pr.top),Math.round(r.width),Math.round(r.height)], z:cs.zIndex, op:cs.opacity}); }
  return JSON.stringify(out); })()"""

def main():
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
    if "youtube" not in (t.eval("location.href") or ""):
        t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(12)
    # arrive at the watch page the way he does: from a page, via SPA, so history has somewhere to go back to
    t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=linus+tech+tips"); time.sleep(15)
    print("before", t.eval(STATE))
    href = t.eval("(function(){var a=document.querySelector('a[href^=\"/watch?v=\"]'); if(!a) return null; a.click(); return a.getAttribute('href');})()")
    print("clicked", href); time.sleep(14)
    t.eval("(function(){var v=document.querySelector('#player-container-id video'); if(v){v.muted=true; v.currentTime=55; v.play();} return 1;})()"); time.sleep(6)
    s0 = json.loads(t.eval(STATE)); print("full", json.dumps(s0))
    pc = s0["pc"]; cx, cy = pc[0] + pc[2] // 2, pc[1] + pc[3] // 2
    drag(t, cx, cy, 200)
    time.sleep(4)  # controls autohide window
    s1 = json.loads(t.eval(STATE)); print("mini", json.dumps(s1))
    print("visible-in-mini", t.eval(VISIBLE))
    if SHOT and s1.get("pc"):
        r = s1["pc"]; shot = t.cmd("Page.captureScreenshot", format="png", clip={"x": r[0]-4, "y": r[1]-4, "width": r[2]+8, "height": r[3]+8, "scale": 2})
        data = shot.get("result", shot).get("data") if isinstance(shot, dict) else None
        if data:
            p = os.path.join(SHOT, "mini-%s.png" % LABEL); open(p, "wb").write(base64.b64decode(data)); print("shot", p)
    if s1.get("x"):
        tap(t, s1["x"][0], s1["x"][1])
        time.sleep(2)
        print("afterX", t.eval(STATE))
    else:
        print("afterX no-x-button")

main()
