"""What the eye sees on the most-used path: home -> search icon -> type ->
results -> tap a result -> playing. Screencaps as fast as adb allows,
stamped from each step's start. Frames land in OUT.

  python spikes/gauntlet/probe_search_frames.py <port> <outdir>
"""
import os
import subprocess
import sys
import threading
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]); OUT = sys.argv[2]
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
os.makedirs(OUT, exist_ok=True)


def adb(*a):
    return subprocess.run([ADB, '-s', DEV] + list(a), capture_output=True, timeout=120)


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


def yt():
    t = Tab(page(port=PORT, want='youtube'))
    t.cmd('Runtime.enable')
    return t


class Shooter:
    def __init__(self, tag):
        self.tag = tag; self.stop = False; self.stamps = []
        self.t0 = time.time(); self.th = threading.Thread(target=self.run); self.th.start()

    def run(self):
        i = 0
        while not self.stop:
            t1 = time.time()
            r = adb('exec-out', 'screencap', '-p')
            off = round((t1 - self.t0) * 1000)
            open(os.path.join(OUT, '%s_%02d_%05dms.png' % (self.tag, i, off)), 'wb').write(r.stdout)
            self.stamps.append(off); i += 1

    def end(self):
        self.stop = True; self.th.join(); return self.stamps


def wait(expr, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if yt().eval(expr) is True:
                return round(time.time() - t0, 2)
        except Exception:
            pass
        time.sleep(0.2)
    return None


adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop %s' % PKG)
time.sleep(2)
adb('shell', 'am start -n %s/.MainActivity' % PKG)
time.sleep(7)
attach()
t = Tab(page(port=PORT, want='tauri.localhost')); t.cmd('Runtime.enable')
t.eval("""(async function(){var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:[]}); return 1;})()""")
wait("!!document.querySelector('ytm-pivot-bar-renderer')")
time.sleep(2)

out = {}
# 1. tap the search icon (real tap through the DOM), screencap until the box is focused
s = Shooter('search_open')
t = yt()
t.eval("(function(){var b=document.querySelector('button.topbar-button-search-button'); b&&b.click(); return !!b})()")
out['search_box_s'] = wait("!!document.querySelector('input.ytSearchboxComponentInput')", 8)
time.sleep(0.8)
out['search_open_frames'] = s.end()

# 2. type + submit, screencap until results
s = Shooter('results')
t = yt()
t.eval("""(function(){var i=document.querySelector('input.ytSearchboxComponentInput'); if(!i) return 0;
  i.focus(); i.value='lofi'; i.dispatchEvent(new Event('input',{bubbles:true}));
  var s=document.querySelector('button.ytSearchboxComponentSearchButton'); if(s) s.click(); else i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}));
  return 1;})()""")
out['results_s'] = wait("document.querySelectorAll('ytm-compact-video-renderer, ytm-video-with-context-renderer').length>0", 15)
time.sleep(1.5)
out['results_frames'] = s.end()

# 3. tap the first result, screencap until playing
s = Shooter('watch')
t = yt()
t.eval("(function(){var a=document.querySelector('ytm-compact-video-renderer a, ytm-video-with-context-renderer a'); a&&a.click(); return !!a})()")
out['playing_s'] = wait("(function(){var v=document.querySelector('#movie_player video');return !!v&&v.readyState>=2&&!v.paused;})()", 20)
time.sleep(1.5)
out['watch_frames'] = s.end()

print('SEARCH', out)
