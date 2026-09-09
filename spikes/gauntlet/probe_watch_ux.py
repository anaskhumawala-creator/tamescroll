"""His two watch-page complaints (2026-09-10), reproduced with evidence:
  1. scrolling down the watch page, "the recommendation bar" shows up
  2. closing the mini player reloads the previous page fully
Home -> tap a video (in-page, SPA) -> scroll the watch page with frames
-> Android back (minimises to the mini player) -> frames -> tap the mini
player's close -> was the document replaced? (a window marker survives an
SPA nav and dies on a reload).

  python spikes/gauntlet/probe_watch_ux.py <port> <outdir>
"""
import json
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


def shot(name):
    open(os.path.join(OUT, name + '.png'), 'wb').write(adb('exec-out', 'screencap', '-p').stdout)


def wait(expr, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if yt().eval(expr) is True:
                return round(time.time() - t0, 2)
        except Exception:
            pass
        time.sleep(0.25)
    return None


VISIBLE_SURFACES = """(function(){
  var sel = ['ytm-item-section-renderer', 'ytm-watch-next-secondary-results-renderer', 'ytm-compact-video-renderer',
    'ytm-video-with-context-renderer', 'ytm-chip-cloud-renderer', 'ytm-shelf-renderer', 'ytm-reel-shelf-renderer',
    'ytm-comments-entry-point-header-renderer', 'ytm-engagement-panel-section-list-renderer', 'ytm-pivot-bar-renderer',
    'ytm-watch-next-feed', '.related-chips-slot-wrapper', 'ytm-single-column-watch-next-results-renderer'];
  var out = {};
  sel.forEach(function(s){ var n=0, vis=0; document.querySelectorAll(s).forEach(function(e){ n++; var r=e.getBoundingClientRect();
    var cs=getComputedStyle(e); if(r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'&&r.bottom>0&&r.top<innerHeight) vis++; });
    if(n) out[s]=[n,vis]; });
  return JSON.stringify({url: location.pathname, page: document.documentElement.getAttribute('data-ts-page'), scrollY: scrollY, surfaces: out});
})()"""

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
# go to subscriptions (home is empty by design) and tap the first video IN PAGE
t = yt(); t.eval("location.href='https://m.youtube.com/feed/subscriptions'")
wait("document.querySelectorAll('ytm-rich-item-renderer a[href*=watch], ytm-media-item a[href*=watch]').length>0")
time.sleep(2)
t = yt()
t.eval("window.__TS_PROBE_MARK = 'alive-' + Date.now(); 1")
mark = t.eval("window.__TS_PROBE_MARK")
t.eval("(function(){var a=document.querySelector('ytm-rich-item-renderer a[href*=watch], ytm-media-item a[href*=watch]'); a.click(); return 1})()")
out['watch_playing_s'] = wait("(function(){var v=document.querySelector('#movie_player video');return !!v&&v.readyState>=2;})()")
time.sleep(3)
t = yt()
out['mark_after_open'] = t.eval("window.__TS_PROBE_MARK") == mark
shot('w0_top')
out['top'] = json.loads(t.eval(VISIBLE_SURFACES))
# scroll the watch page in steps, frames + surface census each step
scroll = []
for i in range(6):
    t = yt()
    t.cmd('Input.synthesizeScrollGesture', x=200, y=600, yDistance=-450, speed=1200)
    time.sleep(0.9)
    shot('w1_scroll%d' % i)
    scroll.append(json.loads(yt().eval(VISIBLE_SURFACES)))
out['scroll'] = scroll
# Android back: m.youtube minimises the player
adb('shell', 'input keyevent 4')
time.sleep(2.5)
shot('w2_after_back')
t = yt()
out['after_back'] = json.loads(t.eval(VISIBLE_SURFACES))
out['after_back_mark'] = t.eval("window.__TS_PROBE_MARK") == mark
out['miniplayer'] = t.eval("""(function(){var m=document.querySelector('ytm-miniplayer, .miniplayer, [class*=miniplayer]'); if(!m) return null;
  var r=m.getBoundingClientRect(); var btns=[...m.querySelectorAll('button')].map(function(b){return b.getAttribute('aria-label')});
  return {tag:m.tagName, cls:String(m.className).slice(0,80), rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], btns:btns};})()""")
# close the mini player
closed = t.eval("""(function(){var m=document.querySelector('ytm-miniplayer, .miniplayer, [class*=miniplayer]'); if(!m) return 'no miniplayer';
  var b=[...m.querySelectorAll('button')].find(function(b){return /close|dismiss/i.test(b.getAttribute('aria-label')||'')}); if(!b) return 'no close btn';
  b.click(); return 'clicked'})()""")
out['close_click'] = closed
time.sleep(0.4); shot('w3_closing_0')
time.sleep(1.5); shot('w3_closing_1')
time.sleep(2.5); shot('w3_closing_2')
t = yt()
out['after_close_mark'] = t.eval("window.__TS_PROBE_MARK") == mark
out['after_close'] = json.loads(t.eval(VISIBLE_SURFACES))
out['nav_entries'] = t.eval("performance.getEntriesByType('navigation').length")
print('WATCHUX', json.dumps(out))
json.dump(out, open(os.path.join(OUT, 'watchux.json'), 'w'), indent=1)
