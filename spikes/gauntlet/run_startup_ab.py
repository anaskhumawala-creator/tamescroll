"""Item e: first-60s dropped frames, control vs DELAY_LATE_ATTACH=1, each
arm from a cold app launch, alternating, N rounds.

  python spikes/gauntlet/run_startup_ab.py <port> [rounds]
"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1])
ROUNDS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
PLANT = os.path.join(HERE, 'plant-lateattach.js')


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
results = {'control': [], 'late': []}
for r in range(ROUNDS):
    for arm in ('control', 'late'):
        adb('shell', 'am force-stop %s' % PKG)
        time.sleep(2)
        adb('shell', 'am start -n %s/.MainActivity' % PKG)
        time.sleep(7)
        attach()
        env = dict(os.environ)
        if arm == 'late':
            env['TS_PLANT_FILE'] = PLANT
        label = '%s-r%d' % (arm, r)
        out = subprocess.run([sys.executable, os.path.join(HERE, 'probe_startup_drops.py'), str(PORT), label],
                             capture_output=True, text=True, env=env, timeout=200).stdout
        line = [l for l in out.splitlines() if l.startswith('STARTUP')]
        if not line:
            print(label, 'NO RESULT', out[-300:])
            continue
        d = json.loads(line[0][8:])
        rows = d['rows']
        first = rows[:2]
        f_d = sum(x['dropped'] for x in first); f_t = sum(x['total'] for x in first)
        a_d = sum(x['dropped'] for x in rows); a_t = sum(x['total'] for x in rows)
        rec = {'first10': (f_d, f_t), 'all': (a_d, a_t), 'playingAt': d['playingAt']}
        results[arm].append(rec)
        print('%-11s first10s %3d/%4d = %5.1f%%   60s %3d/%4d = %5.1f%%   playing at %ss'
              % (label, f_d, f_t, 100.0 * f_d / max(f_t, 1), a_d, a_t, 100.0 * a_d / max(a_t, 1), d['playingAt']))

for arm in ('control', 'late'):
    rs = results[arm]
    if not rs:
        continue
    f_d = sum(x['first10'][0] for x in rs); f_t = sum(x['first10'][1] for x in rs)
    a_d = sum(x['all'][0] for x in rs); a_t = sum(x['all'][1] for x in rs)
    print('%-8s pooled first10s %.1f%%  60s %.1f%%  (n=%d)' % (arm, 100.0 * f_d / max(f_t, 1), 100.0 * a_d / max(a_t, 1), len(rs)))
