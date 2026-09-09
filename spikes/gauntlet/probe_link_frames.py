"""What the eye sees between a YouTube link tap and the watch page, cold.
His 2026-09-10: "it first shows the tamescroll page and then gets me to
YouTube". Force-stops the app, fires a VIEW intent for a youtu.be link,
screencaps as fast as adb allows, stamps each frame from the intent.

  python spikes/gauntlet/probe_link_frames.py <outdir> [seconds]
"""
import os
import subprocess
import sys
import threading
import time

OUT = sys.argv[1]; SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 5.0
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
os.makedirs(OUT, exist_ok=True)


def adb(*a):
    return subprocess.run([ADB, '-s', DEV] + list(a), capture_output=True, timeout=120)


adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop %s' % PKG)
time.sleep(2)
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
th = threading.Thread(target=shooter); th.start()
adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'https://youtu.be/NWoT1ZVd1Lo', '-n', PKG + '/.MainActivity')
time.sleep(SECS)
stop = True
th.join()
print('FRAMES', stamps)
