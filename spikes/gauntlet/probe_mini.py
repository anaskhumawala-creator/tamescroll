"""The mini player on his phone, recommendations shown: swipe the player
down, scroll, drag the mini up, tap it. Frames and a census at each
step: where the title sits (must be below the 48px top bar), where the
chips bar sits (must be at 48, never mid-screen), the mini's box, and
the state class.

  python spikes/gauntlet/probe_mini.py <port> <outdir>
"""
import json
import os
import subprocess
import sys
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
    t = Tab(page(port=PORT, want='youtube')); t.cmd('Runtime.enable'); return t


def shot(name):
    open(os.path.join(OUT, name + '.png'), 'wb').write(adb('exec-out', 'screencap', '-p').stdout)


def drag(t, x0, y0, x1, y1, steps=12):
    t.cmd('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': x0, 'y': y0}])
    for i in range(1, steps + 1):
        t.cmd('Input.dispatchTouchEvent', type='touchMove',
              touchPoints=[{'x': x0 + (x1 - x0) * i / steps, 'y': y0 + (y1 - y0) * i / steps}])
        time.sleep(0.02)
    t.cmd('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])


def tap(t, x, y):
    t.cmd('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': x, 'y': y}])
    time.sleep(0.05)
    t.cmd('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])


C = """(function(){function R(e){if(!e)return null;var r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];}
 return JSON.stringify({state:window.__TS_MINI_STATE||null, mini:document.documentElement.classList.contains('ts-mini'), scrollY:Math.round(scrollY),
   title:R(document.querySelector('h2.slim-video-information-title')), chips:R(document.querySelector('ytm-related-chip-cloud-renderer')),
   pc:R(document.querySelector('#player-container-id')), canvas:R(document.querySelector('.ts-gaze-delay')), pill:R(document.querySelector('.ts-gaze-pill')),
   overHeader:document.elementsFromPoint(200,24).slice(0,1).map(function(e){return e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0]})});})()"""

adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop %s' % PKG)
time.sleep(2)
adb('shell', 'am start -n %s/.MainActivity' % PKG)
time.sleep(7)
attach()
t = Tab(page(port=PORT, want='tauri.localhost')); t.cmd('Runtime.enable')
t.eval("""(async function(){var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:['watch_recs'],url:'https://m.youtube.com/watch?v=NWoT1ZVd1Lo'}); return 1;})()""")
time.sleep(9)
out = []
def step(name):
    out.append((name, json.loads(yt().eval(C)))); shot(name)
step('a_full')
drag(yt(), 200, 150, 200, 700); time.sleep(2.5)
step('b_mini')
t = yt(); t.cmd('Input.synthesizeScrollGesture', x=200, y=500, yDistance=-600, speed=1000); time.sleep(1.5)
step('c_mini_scrolled')
t = yt(); t.cmd('Input.synthesizeScrollGesture', x=200, y=300, yDistance=600, speed=1000); time.sleep(1.5)
step('d_mini_scrolled_up')
m = out[-1][1]['pc']
if m:
    drag(yt(), m[0] + m[2] // 2, m[1] + m[3] // 2, m[0] + m[2] // 2, 200); time.sleep(2.5)
step('e_after_drag_mini_up')
m = out[-1][1]['pc']
if out[-1][1]['mini'] and m:
    tap(yt(), m[0] + m[2] // 2, m[1] + m[3] // 2); time.sleep(2.5)
step('f_after_tap_mini')
json.dump(out, open(os.path.join(OUT, 'steps.json'), 'w'), indent=1)
for n, s in out:
    print(n, 'state', s['state'], 'scrollY', s['scrollY'], 'title', s['title'], 'chips', s['chips'], 'pc', s['pc'], 'over', s['overHeader'])
