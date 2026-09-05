"""Queue item h: how long does the adblock engine take to warm on a cold
start, first launch of a build (parse) against the next (deserialise)?

  python spikes/gauntlet/probe_engine_warm.py <serial> [launches]

Reads every "adblock engine warmed in" line the Rust side prints per
launch (there are two per start: run()'s warm thread and the rebuild
after the OTA cache loads) and the engine cache directory afterwards.
"""
import re
import subprocess
import sys
import time

DEV = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 3
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'


def adb(*a):
    return subprocess.run([ADB, '-s', DEV] + list(a), capture_output=True, text=True, timeout=120).stdout


for i in range(N):
    adb('shell', 'am force-stop %s' % PKG)
    time.sleep(1.5)
    adb('logcat', '-c')
    t0 = time.time()
    adb('shell', 'am start -n %s/.MainActivity' % PKG)
    time.sleep(30)
    log = adb('logcat', '-d', '-v', 'time')
    warms = re.findall(r'adblock engine warmed in ([0-9.]+m?s)', log)
    print('launch %d: warmed %s' % (i + 1, warms or 'NOT SEEN in 30s'))

print(adb('shell', 'run-as %s ls -l files/rules-cache' % PKG) or adb('shell', 'run-as %s find . -name "engine-*.bin" -exec ls -l {} \\;' % PKG))
