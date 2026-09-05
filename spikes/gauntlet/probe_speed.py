"""Speed pass (owner 2026-09-05: "I'd like YouTube to feel blazing fast").
On his phone, in his shipped mode (smart), the numbers that make a page
FEEL slow, one run:

  open      launcher open_platform -> first meaningful paint of home
  nav       home -> subscriptions -> watch -> back, each as a wall-clock
            gap until the page's own content is on screen
  scroll    8 real flicks on Subscriptions: dropped rAF frames, long
            tasks, images cleared per second
  images    how long a thumbnail stays blurred before its verdict
            (diag ring: per-image ms, p50/p95)

  python spikes/gauntlet/probe_speed.py <port> <label>
"""
import json
import os
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]); LABEL = sys.argv[2] if len(sys.argv) > 2 else 'speed'
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
HERE = os.path.dirname(os.path.abspath(__file__))


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


def yt():
    t = Tab(page(port=PORT, want='youtube'))
    t.cmd('Page.enable'); t.cmd('Runtime.enable')
    return t


READY = {
    'home': "!!document.querySelector('ytm-pivot-bar-renderer')",
    'subs': "document.querySelectorAll('ytm-browse ytm-rich-grid-renderer ytm-media-item, ytm-browse ytm-rich-item-renderer').length>0",
    'watch': "(function(){var v=document.querySelector('#movie_player video');return !!v&&v.readyState>=2;})()",
    'search': "document.querySelectorAll('ytm-compact-video-renderer, ytm-video-with-context-renderer').length>0",
}


def wait_ready(kind, timeout=25):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            t = yt()
            if t.eval(READY[kind]) is True:
                return round(time.time() - t0, 2)
        except Exception:
            pass
        time.sleep(0.25)
    return None


out = {'label': LABEL}
adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop %s' % PKG)
time.sleep(2)
adb('shell', 'am start -n %s/.MainActivity' % PKG)
time.sleep(7)
attach()
t = Tab(page(port=PORT, want='tauri.localhost')); t.cmd('Runtime.enable')
t0 = time.time()
t.eval("""(async function(){var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:[]}); return 1;})()""")
out['open_home_s'] = wait_ready('home')
time.sleep(2)

# nav: subscriptions, then a watch page, then search
t = yt(); t.eval("location.href='https://m.youtube.com/feed/subscriptions'")
out['nav_subs_s'] = wait_ready('subs')
time.sleep(3)

# scroll on subscriptions
t = yt()
t.eval("""(function(){ window.__F=[]; window.__LT=[]; var last=performance.now();
  (function loop(){ var n=performance.now(); window.__F.push(n-last); last=n; requestAnimationFrame(loop); })();
  try{ new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ window.__LT.push(Math.round(e.duration)); }); }).observe({entryTypes:['longtask']}); }catch(e){}
  window.__TS_GAZE_IMGDIAG=[]; })()""")
time.sleep(0.5)
t.eval("window.__F=[]; window.__LT=[]")
s0 = t.eval('performance.now()')
for i in range(8):
    t.cmd('Input.synthesizeScrollGesture', x=540, y=1400, yDistance=-1200, speed=2500)
    time.sleep(0.9)
s1 = t.eval('performance.now()')
time.sleep(6)
s2 = t.eval('performance.now()')
r = json.loads(t.eval("""JSON.stringify({f:window.__F, lt:window.__LT, imgs:(window.__TS_GAZE_IMGDIAG||[]).map(function(x){return [x.at||x.t||0, x.ms||x.dt||0]})})"""))
f = r['f']; lt = r['lt']
dropped = [x for x in f if x > 32]
imgs = r['imgs']
during = [x for x in imgs if s0 <= x[0] <= s1]
after = [x for x in imgs if s1 < x[0] <= s2]
out['scroll'] = {
    'frames': len(f), 'dropped': len(dropped), 'dropped_pct': round(100.0 * len(dropped) / max(1, len(f)), 1),
    'worst_frame_ms': round(max(f or [0])), 'long_tasks': len(lt), 'long_total_ms': sum(lt), 'long_worst_ms': max(lt or [0]),
    'img_per_s_scrolling': round(len(during) / max(0.1, (s1 - s0) / 1000), 2),
    'img_per_s_after': round(len(after) / max(0.1, (s2 - s1) / 1000), 2),
}
ms = sorted([x[1] for x in imgs if x[1]])
out['image_ms_p50'] = ms[len(ms) // 2] if ms else None
out['image_ms_p95'] = ms[int(len(ms) * 0.95)] if ms else None
out['images_n'] = len(ms)

t = yt(); t.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
out['nav_watch_s'] = wait_ready('watch')
time.sleep(2)
t = yt(); t.eval("location.href='https://m.youtube.com/results?search_query=lofi'")
out['nav_search_s'] = wait_ready('search')

print('SPEED', json.dumps(out))
json.dump(out, open(os.path.join(HERE, 'speed-%s.json' % LABEL), 'w'), indent=1)
