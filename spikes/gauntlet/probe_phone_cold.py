# COLD NAVIGATION COST ON THE REAL DEVICE -- the lever the plan names and
# the one every number so far described on a machine he does not own.
# Force-stop, launch, open YouTube, and record when the worker is up,
# when each model lands, and when the FIRST thumbnail verdict arrives.
import json, subprocess, sys, time, os
from emu_cdp import page, Tab
ADB=os.environ.get('ANDROID_HOME','')+"/platform-tools/adb.exe"
DEV=sys.argv[1] if len(sys.argv)>1 else "192.168.99.194:42305"
PORT=int(sys.argv[2]) if len(sys.argv)>2 else 9225
N=int(sys.argv[3]) if len(sys.argv)>3 else 3
URL=sys.argv[4] if len(sys.argv)>4 else "https://m.youtube.com/results?search_query=podcast+interview"

def sh(*a):
    e=dict(os.environ); e['MSYS2_ARG_CONV_EXCL']='*'
    return subprocess.run([ADB,"-s",DEV]+list(a),capture_output=True,text=True,env=e).stdout.strip()

def forward():
    pid=sh("shell","pidof","app.tamescroll.client")
    sh("forward","--remove","tcp:%d"%PORT)
    sh("forward","tcp:%d"%PORT,"localabstract:webview_devtools_remote_%s"%pid)
    return pid

READ = """(function(){
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){return {err:1};}
  var w=(d&&d.worker)||{}; var im=(d&&d.images)||{};
  var ring=window.__TS_GAZE_IMGDIAG||[];
  var firstT=null; for(var i=0;i<ring.length;i++){ if(typeof ring[i].t==='number'){
    if(firstT===null||ring[i].t<firstT) firstT=ring[i].t; } }
  return {up:w.up, evalMs:w.evalMs, ready:w.ready, face:w.loadedFace, gender:w.loadedGender,
    nsfw:w.loadedNsfw, person:w.loadedPerson, asked:w.askedPerson,
    backend:w.backend, dead:w.dead,
    imgTotal:window.__TS_GAZE_IMGTOTAL||0, firstImgT:firstT?Math.round(firstT):null,
    pendingOnScreen:(function(){var n=0,e=document.querySelectorAll('.ts-gaze-pending');
      for(var i=0;i<e.length;i++){var r=e[i].getBoundingClientRect();
        if(r.width>=120&&r.top<innerHeight&&r.bottom>0) n++;} return n;})(),
    bundle:window.__TS_GAZE_BUNDLE__||null};})()"""

rows=[]
for run in range(N):
    sh("shell","am","force-stop","app.tamescroll.client")
    time.sleep(3)
    sh("shell","am","start","-n","app.tamescroll.client/.MainActivity")
    time.sleep(7)
    forward()
    t=Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(3)
    nav0=time.time()
    t.cmd("Page.navigate", url=URL)
    first=None
    for _ in range(60):
        time.sleep(1.0)
        r=t.eval(READ)
        if isinstance(r,dict) and (r.get("imgTotal") or 0)>0:
            first=round((time.time()-nav0)*1000); break
    time.sleep(12)
    r=t.eval(READ) or {}
    r["firstJudgedMsFromNav"]=first
    r["run"]=run
    rows.append(r)
    print(json.dumps(r))
def p(k):
    v=[x.get(k) for x in rows if isinstance(x.get(k),(int,float))]
    return sorted(v)[len(v)//2] if v else None
print(json.dumps({"runs":len(rows),"median":{k:p(k) for k in
  ["up","evalMs","ready","face","gender","nsfw","person","firstJudgedMsFromNav","imgTotal"]},
  "backend":rows[-1].get("backend"),"bundle":rows[-1].get("bundle")}, indent=1))
