# WHERE THE COLD SECONDS GO, decomposed off the marks the boot already
# records: __TS_GAZE_WORKER carries a timestamp per stage AND a duration
# per model, plus the warm-up split.
import json, subprocess, sys, time, os
from emu_cdp import page, Tab
ADB=os.environ.get('ANDROID_HOME','')+"/platform-tools/adb.exe"
DEV="192.168.99.194:42305"; PORT=9225
N=int(sys.argv[1]) if len(sys.argv)>1 else 2
def sh(*a):
    e=dict(os.environ); e['MSYS2_ARG_CONV_EXCL']='*'
    return subprocess.run([ADB,"-s",DEV]+list(a),capture_output=True,text=True,env=e).stdout.strip()
rows=[]
for run in range(N):
    sh("shell","am","force-stop","app.tamescroll.client"); time.sleep(3)
    sh("shell","am","start","-n","app.tamescroll.client/.MainActivity"); time.sleep(7)
    pid=sh("shell","pidof","app.tamescroll.client")
    sh("forward","--remove","tcp:%d"%PORT)
    sh("forward","tcp:%d"%PORT,"localabstract:webview_devtools_remote_%s"%pid)
    t=Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(3)
    t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
    time.sleep(30)
    r=t.eval("""(function(){
      var w=window.__TS_GAZE_WORKER||{}; var b=window.__TS_GAZE_BOOT||null;
      var ring=window.__TS_GAZE_IMGDIAG||[];
      var firstMs=null,firstT=null;
      for(var i=0;i<ring.length;i++){ if(typeof ring[i].t==='number' && (firstT===null||ring[i].t<firstT)){
        firstT=ring[i].t; firstMs=ring[i].ms; } }
      var o={}; for(var k in w) o[k]=w[k];
      o.boot=b; o.firstImgT=firstT?Math.round(firstT):null; o.firstImgMs=firstMs;
      o.imgTotal=window.__TS_GAZE_IMGTOTAL||0;
      o.eval0=(typeof window.__TS_GAZE_EVAL0==='number')?Math.round(window.__TS_GAZE_EVAL0):null;
      return o;})()""")
    rows.append(r); print(json.dumps(r))
