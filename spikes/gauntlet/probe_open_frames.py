"""What the eye sees between the tile tap and YouTube's first paint.
Launches cold, taps YouTube through open_platform, then screencaps the
device as fast as adb allows for N seconds and stamps each frame with its
offset from the tap. Frames land in OUT (default: scratchpad).

  python spikes/gauntlet/probe_open_frames.py <port> <outdir> [seconds]
"""
import os
import subprocess
import sys
import threading
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]); OUT = sys.argv[2]; SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
os.makedirs(OUT, exist_ok=True)


def adb(*a, **kw):
    return subprocess.run([ADB, '-s', DEV] + list(a), capture_output=True, timeout=120, **kw)


def attach():
    for _ in range(25):
        pid = adb('shell', 'pidof %s' % PKG).stdout.decode().strip()
        sock = None
        if pid:
            for line in adb('shell', 'cat /proc/net/unix').stdout.decode().splitlines():
                if 'webview_devtools_remote_' + pid in line:
                    sock = line.strip().split('@')[-1]
        if sock:
            adb('forward', '--remove', 'tcp:%d' % PORT)
            adb('forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock)
            return
        time.sleep(2)
    raise SystemExit('no devtools socket')


adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop %s' % PKG)
time.sleep(2)
adb('shell', 'am start -n %s/.MainActivity' % PKG)
time.sleep(7)
attach()
t = Tab(page(port=PORT, want='tauri.localhost')); t.cmd('Runtime.enable')

stamps = []
stop = False


def shooter():
    i = 0
    while not stop:
        t1 = time.time()
        r = adb('exec-out', 'screencap', '-p')
        off = round((t1 - t0) * 1000)
        open(os.path.join(OUT, 'f%02d_%05dms.png' % (i, off)), 'wb').write(r.stdout)
        stamps.append(off)
        i += 1


t0 = time.time()
# Tap through the tile itself so the launcher's own tap feedback is in the
# frames; fire it from a thread so the first screencap starts at once.
tap = threading.Thread(target=lambda: t.eval(
    "(function(){var b=[...document.querySelectorAll('.tile')].find(function(x){return /YouTube/.test(x.textContent)}); b.click(); return 1;})()"))
tap.start()
time.sleep(0.12)
th = threading.Thread(target=shooter); th.start()
time.sleep(SECS)
stop = True
th.join()
print('FRAMES', stamps)
