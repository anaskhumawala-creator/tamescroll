"""1107: DOES A YOUTUBE LINK OPEN INSIDE TAMESCROLL, AND HOW FAST?

  python spikes/gauntlet/probe_link_open.py [9333]

The owner's test for whether the app is useful at all: "someone sends a
link on WhatsApp and we open it and the normal YouTube opens, so there
is no point." Four checks, in the order a phone meets them:

  cold   app stopped, VIEW youtu.be/<id>?t=15 aimed at our package
         -> expect m.youtube.com/watch?v=<id>&t=15s, and the TIMELINE:
            launcher page start, "adblock engine warmed", open_platform,
            watch page start. The gap launcher->open_platform is the
            number that matters; before 1107 it was 20s because
            start() awaited a rule-count caption that built the engine.
  warm   app on a watch page, VIEW www.youtube.com/watch?v=<other>
         -> the page changes (onNewIntent path, ?open=&url=)
  send   ACTION_SEND text/plain with a url buried in prose
         -> watch page (share-sheet path, no default-app setting needed)
  neg    VIEW https://example.com/x aimed at our package
         -> Android refuses to resolve (manifest claims no such host)
            and the app's page is untouched

The package is passed explicitly (`app.tamescroll.client`) so none of
this depends on the user's Open-by-default choice, which is theirs and
which Android gives us no API to set. `pm get-app-links` is printed at
the end for whoever wants to know what the system would do on a bare
tap.

Screen must be on: `adb shell svc power stayon usb` (MIUI may refuse;
then Developer options -> Stay awake).
"""
import json
import re
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9333
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
COLD = 'https://youtu.be/NWoT1ZVd1Lo?t=15'
WARM = 'https://www.youtube.com/watch?v=KAWvDsghyc8'
SEND_TEXT = 'look at this https://youtu.be/4u3jS_cTHH0 lol'
NEG = 'https://example.com/x'


def adb(*a, timeout=120):
    return subprocess.run([ADB, '-s', DEV] + list(a),
                          capture_output=True, text=True, timeout=timeout).stdout


def attach():
    pid = ''
    sock = None
    for _ in range(25):
        pid = adb('shell', 'pidof %s' % PKG).strip()
        if pid:
            for line in adb('shell', 'cat /proc/net/unix').splitlines():
                if 'webview_devtools_remote_' + pid in line:
                    sock = line.strip().split('@')[-1]
        if sock:
            break
        time.sleep(2)
    if not sock:
        raise SystemExit('no devtools socket')
    subprocess.run([ADB, '-s', DEV, 'forward', '--remove', 'tcp:%d' % PORT], capture_output=True)
    subprocess.run([ADB, '-s', DEV, 'forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock],
                   capture_output=True)
    return pid


def href():
    t = Tab(page(port=PORT))
    t.cmd('Runtime.enable')
    return json.loads(t.eval("""(function(){var v=document.querySelector('video');
      return JSON.stringify({href:location.href.slice(0,100), t:v?Math.round(v.currentTime):null});})()"""))


def start(action, extra):
    out = adb('shell', 'am start -W -a %s %s %s' % (action, extra, PKG))
    m = re.search(r'^(Status|Error).*$', out, re.M)
    return m.group(0) if m else out.strip()[:120]


def timeline(pid):
    log = adb('logcat', '-d', '--pid=' + pid, '-v', 'time')
    rows = []
    for line in log.splitlines():
        if re.search(r'page start|open_platform id|engine warmed', line):
            ts = line[6:18]
            msg = line.split(': ', 1)[-1]
            rows.append((ts, msg))
    return rows


adb('shell', 'svc power stayon usb')
print('build:', adb('shell', 'dumpsys package %s' % PKG).split('versionCode=')[1].split()[0])

# ---- cold -------------------------------------------------------------
adb('shell', 'am force-stop %s' % PKG)
time.sleep(2)
adb('logcat', '-c')
print('\ncold  ', start('android.intent.action.VIEW', '-d "%s"' % COLD))
time.sleep(30)
pid = attach()
r = href()
ok_cold = 'm.youtube.com/watch?v=NWoT1ZVd1Lo' in r['href'] and 't=15s' in r['href']
print('       ->', r, 'OK' if ok_cold else '*** WRONG PAGE')
for ts, msg in timeline(pid):
    print('       ', ts, msg)

# ---- warm -------------------------------------------------------------
print('\nwarm  ', start('android.intent.action.VIEW', '-d "%s"' % WARM))
time.sleep(14)
r = href()
print('       ->', r, 'OK' if 'KAWvDsghyc8' in r['href'] else '*** WRONG PAGE')

# ---- send -------------------------------------------------------------
print('\nsend  ', start('android.intent.action.SEND',
                        '-t text/plain --es android.intent.extra.TEXT "\'%s\'"' % SEND_TEXT))
time.sleep(14)
r = href()
print('       ->', r, 'OK' if '4u3jS_cTHH0' in r['href'] else '*** WRONG PAGE')

# ---- negative ---------------------------------------------------------
before = href()['href']
print('\nneg   ', start('android.intent.action.VIEW', '-d "%s"' % NEG))
time.sleep(6)
after = href()['href']
print('       -> page before/after:', before[:60], '|', after[:60],
      'OK' if after == before and 'example.com' not in after else '*** MOVED')

# ---- what the SYSTEM would do on a bare tap ----------------------------
print('\nopen-by-default state (the user\'s, not ours):')
st = adb('shell', 'dumpsys package %s' % PKG)
i = st.find('Domain verification status')
print('   ' + st[i:i + 400].replace('\n', '\n   ') if i >= 0 else '   (not reported)')
