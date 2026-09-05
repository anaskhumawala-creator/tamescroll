"""YouTube bring-back sweep: for each surface, open the platform with ONLY
that surface shown, land on the page where it lives, screenshot.

  python spikes/gauntlet/probe_bringback.py <port>

Screenshots: $SCRATCH/bb-<surface>.png plus bb-none-<page>.png baselines.
"""
import os
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1])
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
OUT = os.environ.get('SCRATCH', '.')

# surface -> page it should appear on
SURFACES = {
    'home': 'https://m.youtube.com/',
    'home_shelves': 'https://m.youtube.com/',
    'home_chips': 'https://m.youtube.com/',
    'shorts': 'https://m.youtube.com/',
    'watch_recs': 'https://m.youtube.com/watch?v=NWoT1ZVd1Lo',
    'previews': 'https://m.youtube.com/',
    'search_inserts': 'https://m.youtube.com/results?search_query=lofi',
    'promoted': 'https://m.youtube.com/results?search_query=vpn',
    'mobile_nags': 'https://m.youtube.com/watch?v=NWoT1ZVd1Lo',
    'press_flash': 'https://m.youtube.com/',
}


def adb(*a):
    return subprocess.run([ADB, '-s', DEV] + list(a), capture_output=True, text=True, timeout=120).stdout


def shot(name):
    png = subprocess.run([ADB, '-s', DEV, 'exec-out', 'screencap', '-p'], capture_output=True, timeout=60).stdout
    open(os.path.join(OUT, 'bb-%s.png' % name), 'wb').write(png)


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


def open_with(shown, url):
    t = Tab(page(port=PORT, want='tauri.localhost'))
    t.cmd('Runtime.enable')
    t.eval("""(async function(){var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'off',strength:16,gender:'man',shown:%s,url:%r}); return 1;})()""" % (shown, url))
    time.sleep(9)


adb('shell', 'svc power stayon usb')
seen_pages = set()
for surface, url in SURFACES.items():
    adb('shell', 'am force-stop %s' % PKG)
    time.sleep(1.5)
    adb('shell', 'am start -n %s/.MainActivity' % PKG)
    time.sleep(6)
    attach()
    if url not in seen_pages:
        open_with('[]', url)
        shot('none-' + url.split('/')[-1][:12].replace('?', '_').replace('=', '_') or 'home')
        seen_pages.add(url)
        adb('shell', 'am force-stop %s' % PKG)
        time.sleep(1.5)
        adb('shell', 'am start -n %s/.MainActivity' % PKG)
        time.sleep(6)
        attach()
    open_with('["%s"]' % surface, url)
    shot(surface)
    print('shot', surface)
