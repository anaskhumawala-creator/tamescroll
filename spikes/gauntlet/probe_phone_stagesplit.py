# WHERE DOES A VERDICT PASS ACTUALLY SPEND ITS 799ms ON HIS PHONE, and
# how much of it is the MAIN THREAD? The budget (SPEND_BUDGET_FRAC 0.25)
# is charged the FULL wall clock of a player pass, while the image path
# subtracts the worker's share -- so if most of a pass is a worker wait,
# the player is eating a main-thread budget it never spent, and position
# passes get starved.
#
# Reads the stage marks the pass already records: upload / persons /
# fullFaces / crops / tracks / end (each ms from pass start).
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9225
SECS=float(sys.argv[2]) if len(sys.argv)>2 else 120.0

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(26)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55; v.play();} return 1;})()")
time.sleep(12)

t.eval("""(function(){
  if(window.__TS_ST) return 'already';
  var rows=[];
  var iv=setInterval(function(){
    var r=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.stages)||[];
    for(var i=0;i<r.length;i++){ var e=r[i]; if(!e||e.__st) continue; e.__st=1;
      rows.push({v:e.v,n:e.n,up:e.upload,ps:e.persons,ff:e.fullFaces,
                 cr:e.crops,tr:e.tracks,en:e.end}); }
  },250);
  window.__TS_ST=function(){clearInterval(iv); return JSON.stringify(rows);};
  return 'started';})()""")
time.sleep(SECS)
raw=t.eval("(function(){return window.__TS_ST?window.__TS_ST():'[]';})()")
rows=json.loads(raw) if isinstance(raw,str) else (raw or [])

def p50(a):
    a=[x for x in a if isinstance(x,(int,float))]
    if not a: return None
    a.sort(); return a[len(a)//2]

def split(rs):
    out={}
    out["n"]=len(rs)
    out["end_p50"]=p50([r.get("en") for r in rs])
    out["upload_p50"]=p50([r.get("up") for r in rs])
    # worker waits
    out["personWait_p50"]=p50([r["ps"]-r["up"] for r in rs
        if isinstance(r.get("ps"),(int,float)) and isinstance(r.get("up"),(int,float))])
    out["cropWait_p50"]=p50([r["cr"]-(r.get("ff") if isinstance(r.get("ff"),(int,float)) else r["ps"]) for r in rs
        if isinstance(r.get("cr"),(int,float)) and isinstance(r.get("ps"),(int,float))])
    out["tracksWait_p50"]=p50([r["tr"]-r["cr"] for r in rs
        if isinstance(r.get("tr"),(int,float)) and isinstance(r.get("cr"),(int,float))])
    out["tail_p50"]=p50([r["en"]-r["tr"] for r in rs
        if isinstance(r.get("tr"),(int,float)) and isinstance(r.get("en"),(int,float))])
    # main-thread estimate: the ask + everything after the last worker reply
    out["mainEst_p50"]=p50([ (r.get("up") or 0) + (r["en"]-r["tr"]) for r in rs
        if isinstance(r.get("tr"),(int,float)) and isinstance(r.get("en"),(int,float))])
    out["personsN_p50"]=p50([r.get("n") for r in rs])
    return out

print(json.dumps({"verdicts":split([r for r in rows if r.get("v")]),
                  "positions":split([r for r in rows if not r.get("v")]),
                  "sample":rows[:3]}, indent=1))
