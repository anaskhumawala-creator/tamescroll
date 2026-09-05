"""1105: A STARVED GPU TRIAL MUST RETRY, AND MUST SAY SO.

  python spikes/gauntlet/probe_starve_retry.py 9333

WHAT 1104 DID. `snapshotInput` waits for a real frame OF THAT MODEL,
30 tries x 1000ms. faceres is only invoked once BlazeFace has found a
face (classifyFaceGenders returns early on an empty box list), and the
thumbnail path runs on the WORKER, not native -- so a feed page hands
native faceres nothing at all. On timeout 1104 called decide(win=false),
which ran lost.add("gpu:2"); `lost` is never cleared, so the most
expensive model stayed on CPU for the life of the process, and no reason
was written anywhere. The report row was byte-identical to "never
scheduled", which is why five builds went by unanswered.

WHAT 1105 SHOULD DO. Close the trial interpreter, leave the id eligible,
log `starved, retry n/3`, and re-post the trial after STARVE_RETRY_MS.
When a face finally arrives the trial completes and faceres swaps to the
GPU -- measured on this very phone at 12.1ms against 48.8ms on CPU.

THE TEST IS THE ORDER, and it has to be this way round:
  1. open the app on the FEED and hold there past the 30s window, so the
     trial genuinely starves. Holding on /watch would let the trial win
     first time and prove nothing about the retry.
  2. THEN open a video. The retry must fire and win.

READ THE RESULT AS:
  "starved, retry 1/3" in the log      -> the timeout is no longer silent
  gpuOk:faceres-1105-* after step 2    -> the retry ran and WON
  neither                              -> the fix did not take; the log
                                          says which half failed

A 1104 phone shows neither line and gains no faceres entry, which is the
control this was written against.
"""
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9333
DEV = 'e3d369ee'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
VIDEO = 'NWoT1ZVd1Lo'
PREFS = '/data/data/app.tamescroll.client/shared_prefs/ts-native.xml'
FEED_HOLD = 55   # > the 30s snapshot window, with room for a slow load
RETRY_HOLD = 70  # > STARVE_RETRY_MS (20s) plus a trial


def adb(*args, timeout=90):
    return subprocess.run([ADB, '-s', DEV] + list(args),
                          capture_output=True, text=True, timeout=timeout).stdout


def prefs():
    out = adb('shell', 'run-as app.tamescroll.client cat %s' % PREFS)
    return sorted(l.strip() for l in out.splitlines() if 'gpuOk' in l)


def tsnative():
    return [l for l in adb('logcat', '-d', '-v', 'time', '-s', 'TsNative:*').splitlines()
            if 'TsNative' in l]


def attach():
    """The devtools socket is named after the PID, so a force-stop
    invalidates any forward set up before it -- /json/list then closes
    with no response, which reads like devtools being off rather than
    like the wrong pid."""
    sock = None
    for _ in range(20):
        pid = adb('shell', 'pidof app.tamescroll.client').strip()
        if pid:
            for line in adb('shell', 'cat /proc/net/unix').splitlines():
                if 'webview_devtools_remote_' in line:
                    name = line.strip().split('@')[-1]
                    if name.endswith('_' + pid):
                        sock = name
        if sock:
            break
        time.sleep(2)
    if not sock:
        raise SystemExit('no devtools socket')
    subprocess.run([ADB, '-s', DEV, 'forward', '--remove', 'tcp:%d' % PORT], capture_output=True)
    subprocess.run([ADB, '-s', DEV, 'forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock],
                   capture_output=True)
    return sock


print('installed build:', adb('shell', 'dumpsys package app.tamescroll.client')
      .split('versionCode=')[1].split()[0] if 'versionCode=' in
      adb('shell', 'dumpsys package app.tamescroll.client') else '?')

before = prefs()
print('\n--- prefs BEFORE ---')
for l in before:
    print('   ', l)
print('    faceres-1105 present:', any('faceres-1105' in l for l in before))

adb('shell', 'am force-stop app.tamescroll.client')
time.sleep(2)
adb('logcat', '-c')
adb('shell', 'monkey -p app.tamescroll.client -c android.intent.category.LAUNCHER 1')
time.sleep(8)
print('\nforwarded ->', attach())

t = Tab(page(port=PORT))
t.cmd('Page.enable')
t.cmd('Runtime.enable')
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)
        ||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']});
  return 1;})()""")

print('\nSTEP 1: holding on the FEED for %ds so the trial starves' % FEED_HOLD)
time.sleep(FEED_HOLD)
mid = tsnative()
starved = [l for l in mid if 'starved' in l]
print('  starve lines:', starved if starved else '(none yet)')
print('  faceres in prefs:', any('faceres-1105' in l for l in prefs()))

print('\nSTEP 2: opening a video; the retry must fire and win')
t = Tab(page(port=PORT))
t.cmd('Page.enable')
t.cmd('Runtime.enable')
t.cmd('Page.navigate', url='https://m.youtube.com/watch?v=%s' % VIDEO)
time.sleep(RETRY_HOLD)

after = prefs()
print('\n--- prefs AFTER ---')
for l in after:
    print('   ', l)
gained = [l for l in after if l not in before]
print('\nNEW:', gained if gained else '(none)')
print('faceres-1105 present:', any('faceres-1105' in l for l in after))

print('\n--- TsNative ---')
for l in tsnative():
    print('   ', l)
