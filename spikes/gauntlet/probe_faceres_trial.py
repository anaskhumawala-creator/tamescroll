"""DOES faceres' GPU TRIAL COMPLETE WHEN A FACE ARRIVES EARLY?

  python spikes/gauntlet/probe_faceres_trial.py 9333

HIS SHARE (1104, seven watch documents) reads, for the gender model:

    tried:false ran:false agree:false won:false gpuMs:-1 cpuMs:-1 whyR:null

while face and person both report ran/agree/won on the GPU (16 vs 20 and
48 vs 68 ms). His phone's own `ts-native.xml` carries
`gpuOk:faceres-1102-13956708` but has NO faceres entry for 1104 -- so on
1102 the trial ran and won, and on 1104 it never recorded an outcome.

THE HYPOTHESIS, from NativeInfer.kt: `snapshotInput` waits for a REAL
FRAME for that specific model, 30 tries x 1000ms. Native model 2 is only
ever invoked from `classifyFaceGenders`, which returns early on
`!boxes.length` (detector.js:792) -- so faceres sees no frame until
BlazeFace finds a face. Models 1 and 3 run on every frame and their
trials complete. If no face appears inside that 30s window the trial
calls decide(win=false), adds "gpu:2" to `lost` -- which is NEVER
cleared -- and writes no reason, producing a row byte-identical to
"never scheduled".

THE TEST: put a face in front of it IMMEDIATELY, well inside 30s, and
see whether an outcome gets recorded at all. The read is `ts-native.xml`
on the device rather than the report block, because the prefs file is
written by the arbiter itself and cannot be confused by the report's
worst-of aggregation (worstBackend() paints the whole field "cpu" when
any one model is on CPU, which is why he believes nothing is on GPU).

READ THE RESULT AS:
  gpuOk:faceres-1104-* appears        -> trial ran AND won. The 30s
                                         starvation is the cause, and a
                                         retry fixes it.
  still absent, no other change       -> it ran and lost, or never ran.
                                         Distinguishing those needs the
                                         reason string that does not
                                         exist yet -- that is the finding.

Nothing here writes to the device beyond driving the app the way he
drives it. The launcher is opened through `open_platform` rather than by
navigating straight to m.youtube, because a probe that skips it builds
the sheet from DEFAULTS and measures a configuration he does not run.
"""
import json
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9333
DEV = 'e3d369ee'
ADB = subprocess.check_output(['cygpath', '-w', '/c/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe']).decode().strip() \
    if False else 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
# a talking-head video: BlazeFace finds a face in the first seconds, so
# faceres is handed a real frame far inside the 30s snapshot window
VIDEO = 'NWoT1ZVd1Lo'
PREFS = '/data/data/app.tamescroll.client/shared_prefs/ts-native.xml'


def adb(*args, timeout=60):
    return subprocess.run([ADB, '-s', DEV] + list(args),
                          capture_output=True, text=True, timeout=timeout).stdout


def prefs():
    out = adb('shell', 'run-as app.tamescroll.client cat %s' % PREFS)
    return sorted(l.strip() for l in out.splitlines() if 'gpuOk' in l or 'crash' in l)


print('--- BEFORE (cold, app stopped) ---')
adb('shell', 'am force-stop app.tamescroll.client')
time.sleep(2)
before = prefs()
for l in before:
    print('   ', l)
print('    faceres-1104 present:', any('faceres-1104' in l for l in before))

adb('logcat', '-c')
adb('shell', 'monkey -p app.tamescroll.client -c android.intent.category.LAUNCHER 1')
print('\nlaunched; waiting for the launcher page')
time.sleep(8)

# THE FORWARD IS KEYED TO THE PID. A force-stop gives the app a new one,
# so a forward set up before the restart points at a socket that no
# longer exists and /json/list closes the connection with no response --
# which reads exactly like "devtools is off" rather than "wrong pid".
sock = None
for _ in range(20):
    for line in adb('shell', 'cat /proc/net/unix').splitlines():
        if 'webview_devtools_remote_' in line:
            name = line.strip().split('@')[-1]
            pid = adb('shell', 'pidof app.tamescroll.client').strip()
            if pid and name.endswith('_' + pid):
                sock = name
    if sock:
        break
    time.sleep(2)
if not sock:
    raise SystemExit('no devtools socket for the app; is it running?')
subprocess.run([ADB, '-s', DEV, 'forward', '--remove', 'tcp:%d' % PORT],
               capture_output=True)
subprocess.run([ADB, '-s', DEV, 'forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock],
               capture_output=True)
print('forwarded %d -> %s' % (PORT, sock))

t = Tab(page(port=PORT))
t.cmd('Page.enable')
t.cmd('Runtime.enable')
print('opening youtube through open_platform (not a bare navigate)')
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)
        ||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']});
  return 1;})()""")
time.sleep(10)

# straight onto a watch page so a face reaches the engine early
t = Tab(page(port=PORT))
t.cmd('Page.enable')
t.cmd('Runtime.enable')
t.cmd('Page.navigate', url='https://m.youtube.com/watch?v=%s' % VIDEO)
print('on /watch; holding 75s so the trial window (30s) closes either way')

for s in (15, 30, 45, 60, 75):
    time.sleep(15)
    try:
        tt = Tab(page(port=PORT))
        tt.cmd('Runtime.enable')
        seen = tt.eval("""(function(){
          var d=window.__TS_GAZE_IDS||{};
          var v=document.querySelector('video');
          return JSON.stringify({t:Math.round((v&&v.currentTime)||0),
            faces:d.lastFaces===undefined?null:d.lastFaces,
            path:location.pathname});})()""")
    except Exception as e:
        seen = 'read failed: %s' % e
    print('  %3ds  %s' % (s, seen))

print('\n--- AFTER ---')
after = prefs()
for l in after:
    print('   ', l)
gained = [l for l in after if l not in before]
print('\nNEW ENTRIES:', gained if gained else '(none)')
print('faceres-1104 present:', any('faceres-1104' in l for l in after))

log = adb('logcat', '-d', '-v', 'time', '-s', 'TsNative:*')
print('\n--- TsNative log ---')
for line in log.splitlines():
    print('   ', line)
