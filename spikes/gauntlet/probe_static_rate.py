"""Queue item c: passes and verdicts per second on a still-scene video,
under whatever STATIC_VERDICT_MS the local override store holds.

  python spikes/gauntlet/probe_static_rate.py <port> <label>

Reads __TS_GAZE_IDS.passesTotal / verdictsTotal at the start and end of a
window and prints the rates beside the luma-ring still share and the
applied STATIC_VERDICT_MS, so the two runs (clock off / on) can be laid
side by side. Screen must be on.
"""
import json
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1])
LABEL = sys.argv[2] if len(sys.argv) > 2 else ''
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
VIDEO = 'Ary1gIbaOTc'
WINDOW_S = 60

READ = """(function(){
  var d = window.__TS_GAZE_IDS || {};
  var v = document.querySelector('video');
  var t = d.tuning || {};
  return JSON.stringify({
    t: (v && v.currentTime) || 0,
    passes: d.passesTotal || 0, verdicts: d.verdictsTotal || 0,
    luma: (d.luma || []).slice(-120),
    svm: (t.applied || {}).STATIC_VERDICT_MS,
    over: (d.overrides || null),
    patches: document.querySelectorAll('.ts-gaze-vregion-host').length
  });})()"""


def adb(*a):
    return subprocess.run([ADB, '-s', DEV] + list(a), capture_output=True, text=True, timeout=120).stdout


def attach():
    for _ in range(25):
        pid = adb('shell', 'pidof %s' % PKG).strip()
        sock = None
        if pid:
            for line in adb('shell', 'cat /proc/net/unix').splitlines():
                if 'webview_devtools_remote_' + pid in line:
                    sock = line.strip().split('@')[-1]
        if sock:
            subprocess.run([ADB, '-s', DEV, 'forward', '--remove', 'tcp:%d' % PORT], capture_output=True)
            subprocess.run([ADB, '-s', DEV, 'forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock], capture_output=True)
            return
        time.sleep(2)
    raise SystemExit('no devtools socket')


adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop %s' % PKG)
time.sleep(2)
adb('shell', 'am start -n %s/.MainActivity' % PKG)
time.sleep(8)
attach()
t = Tab(page(port=PORT, want='tauri.localhost'))
t.cmd('Runtime.enable')
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['home','watch_recs']});
  return 1;})()""")
time.sleep(10)
tab = Tab(page(port=PORT, want='youtube'))
tab.cmd('Page.enable'); tab.cmd('Runtime.enable')
tab.cmd('Page.navigate', url='https://m.youtube.com/watch?v=%s' % VIDEO)
time.sleep(20)


def read():
    tb = Tab(page(port=PORT, want='youtube'))
    tb.cmd('Runtime.enable')
    return json.loads(tb.eval(READ))


a = read()
time.sleep(WINDOW_S)
b = read()
dt = b['t'] - a['t']
lu = b['luma']
still = sum(1 for v in lu if v <= 3) / len(lu) if lu else 0
print('%s: STATIC_VERDICT_MS applied=%s  played %.1fs  passes %.2f/s  verdicts %.2f/s  still<=3 %.0f%%  patches %d'
      % (LABEL, b['svm'], dt, (b['passes'] - a['passes']) / max(dt, 1), (b['verdicts'] - a['verdicts']) / max(dt, 1), 100 * still, b['patches']))
