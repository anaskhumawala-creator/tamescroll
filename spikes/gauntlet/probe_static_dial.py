"""1106: DO THE THREE NEW DIALS EXIST ON THE PHONE, AND DOES THE STILL-
SCENE CLOCK ACTUALLY MOVE THE VERDICT CADENCE?

  python spikes/gauntlet/probe_static_dial.py 9333

TWO THINGS THAT A SOURCE READ CANNOT SETTLE.

1. THE WHITELIST IS COMPILED IN. A key the shipped binary does not know
   is DROPPED, not applied -- that is why GENDER_IMAGE_NM_FLOOR could
   not travel to a 1103 phone. So "I added it to tuning.mjs" is a claim
   about this machine; `tuning.refused` on the device is the fact.

2. A DIAL CAN SHIP DEAD. This repo has shipped a constant as `var IY;`
   for six rounds, and shipped the image null guard dead for five. The
   gate was verified READ in the emitted bundle
   (`uf>0&&Yl==="static"&&!fR()&&(Ye=Math.max(Ye,uf))`, where Ye is
   effZoom) -- but read is not the same as REACHED, because the gate also
   needs sceneState to actually be 'static' and nothing to be blurred on
   a real page.

WHAT IT DOES. Plays a video with the clock OFF and samples the gap
between verdicts, then turns it on to 4000ms and samples again. If the
gap does not move, the dial is decoration.

READ THE RESULT AS:
  refused 0 and all three in `applied`  -> the compiled whitelist knows them
  p50 gap grows with the clock on       -> the gate is REACHED, not just read
  gap unchanged                         -> either the scene never went still
                                           (the `static` share is printed
                                           beside it, so the two are
                                           distinguishable) or the gate is dead

THE SCREEN MUST BE ON. A blanked screen pauses playback, the luma ring
stays empty, and this reads exactly like "the scene was never still" --
which is how two videos were silently discarded from an earlier run.
`adb shell svc power stayon usb` pins it.
"""
import json
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9333
DEV = 'e3d369ee'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
VIDEO = 'Ary1gIbaOTc'
SAMPLE_S = 70


def adb(*a, timeout=90):
    return subprocess.run([ADB, '-s', DEV] + list(a),
                          capture_output=True, text=True, timeout=timeout).stdout


def attach():
    sock = None
    for _ in range(20):
        pid = adb('shell', 'pidof app.tamescroll.client').strip()
        if pid:
            for line in adb('shell', 'cat /proc/net/unix').splitlines():
                if 'webview_devtools_remote_' in line:
                    n = line.strip().split('@')[-1]
                    if n.endswith('_' + pid):
                        sock = n
        if sock:
            break
        time.sleep(2)
    if not sock:
        raise SystemExit('no devtools socket')
    subprocess.run([ADB, '-s', DEV, 'forward', '--remove', 'tcp:%d' % PORT], capture_output=True)
    subprocess.run([ADB, '-s', DEV, 'forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock],
                   capture_output=True)


READ = """(function(){
  var d = window.__TS_GAZE_IDS || {};
  var v = document.querySelector('video');
  return JSON.stringify({
    t: Math.round((v && v.currentTime) || 0),
    luma: (d.luma || []).slice(-120),
    zooms: d.zoomAts ? d.zoomAts.slice() : null,
    tuning: d.tuning || null,
    patches: document.querySelectorAll('.ts-gaze-vregion-host').length
  });})()"""

adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop app.tamescroll.client')
time.sleep(2)
adb('shell', 'monkey -p app.tamescroll.client -c android.intent.category.LAUNCHER 1')
time.sleep(8)
attach()
t = Tab(page(port=PORT))
t.cmd('Page.enable')
t.cmd('Runtime.enable')
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)
        ||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']});
  return 1;})()""")
time.sleep(10)

tab = Tab(page(port=PORT))
tab.cmd('Page.enable')
tab.cmd('Runtime.enable')
tab.cmd('Page.navigate', url='https://m.youtube.com/watch?v=%s' % VIDEO)
time.sleep(15)


def sample(label):
    """Sample the luma ring over a window. The ring is the honest read of
    how still the scene was; the verdict gap is what the dial is supposed
    to move."""
    lu = []
    pat = 0
    n = 0
    last = {}
    for _ in range(SAMPLE_S // 5):
        time.sleep(5)
        try:
            tb = Tab(page(port=PORT))
            tb.cmd('Runtime.enable')
            last = json.loads(tb.eval(READ))
        except Exception as e:
            print('  read failed:', e)
            continue
        lu = last.get('luma') or lu
        n += 1
        if (last.get('patches') or 0) > 0:
            pat += 1
    still = sum(1 for v in lu if v <= 3) / len(lu) if lu else 0
    print('%-14s t=%ss  ring %d  still<=3 %.1f%%  patch-on-screen %d/%d'
          % (label, last.get('t'), len(lu), 100 * still, pat, n))
    return last


print('\n--- clock OFF (shipped default) ---')
a = sample('off')
tun = a.get('tuning') or {}
applied = (tun.get('applied') or {}) if isinstance(tun, dict) else {}
print('\ntuning.refused =', tun.get('refused'), ' clamped =', tun.get('clamped'))
for k in ('GENDER_IMAGE_MIN_SCORE', 'STATIC_VERDICT_MS', 'STATIC_DELTA'):
    print('  %-24s %s' % (k, applied.get(k, '*** ABSENT -- the compiled whitelist refused it')))

print('\n--- turning the still-scene clock on to 4000ms ---')
tb = Tab(page(port=PORT))
tb.cmd('Runtime.enable')
print(tb.eval("""(function(){
  try {
    var g = window.__TS_GAZE__ || {};
    if (g.applyTuning) { g.applyTuning({STATIC_VERDICT_MS: 4000}); return 'applied via __TS_GAZE__'; }
    return 'NO PAGE-SIDE HANDLE -- push it over OTA instead';
  } catch (e) { return 'threw: ' + e; }})()"""))
b = sample('on 4000')
