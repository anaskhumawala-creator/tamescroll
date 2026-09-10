"""His 2026-09-10 evening report: on the watch page, scrolling down puts
something OVER the video, the player shrinks, a bar with "From the
series" shows up, and scrolling back up the mini player grows while our
icons stay where they were. Reproduce with a page that can scroll
(comments expanded), step the scroll down then up, and at every step
take a screenshot and a geometry census: the <video>, YouTube's player
container, our delay canvas, region patches, pill and gear, plus which
watch-next children are visible.

  python spikes/gauntlet/probe_watch_scroll.py <port> <outdir>
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


CENSUS = """(function(){
  function R(e){ if(!e) return null; var r=e.getBoundingClientRect(); var cs=getComputedStyle(e);
    return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height), cs.display, cs.position, cs.visibility, cs.opacity]; }
  var html=document.documentElement;
  var vis=[]; document.querySelectorAll('ytm-single-column-watch-next-results-renderer > *, ytm-item-section-renderer, ytm-shelf-renderer, ytm-horizontal-card-list-renderer, ytm-chip-cloud-renderer, .related-chips-slot-wrapper, ytm-comments-entry-point-header-renderer, ytm-engagement-panel-section-list-renderer').forEach(function(e){
    var r=e.getBoundingClientRect(); var cs=getComputedStyle(e); if(r.width>0&&r.height>0&&cs.display!=='none'&&r.bottom>0&&r.top<innerHeight) vis.push([e.tagName.toLowerCase(), e.getAttribute('section-identifier')||e.getAttribute('target-id')||'', Math.round(r.top), Math.round(r.height), (e.textContent||'').trim().slice(0,40)]); });
  return JSON.stringify({ url: location.pathname, scrollY: Math.round(scrollY), htmlClass: html.className, sticky: !!document.querySelector('.sticky-player, [class*=sticky]'),
    video: R(document.querySelector('#movie_player video, video')), player: R(document.querySelector('#player-container-id')), moviePlayer: R(document.querySelector('#movie_player')),
    canvas: R(document.querySelector('.ts-gaze-delay')), patches: [...document.querySelectorAll('[class*=ts-gaze-region], .ts-gaze-patch, [data-ts-patch]')].slice(0,4).map(R),
    pill: R(document.querySelector('.ts-gaze-pill')), gear: R(document.querySelector('.ts-gaze-gear')),
    playerHost: (function(){ var v=document.querySelector('#movie_player video'); var p=v; var chain=[]; while(p && chain.length<6){ chain.push(p.tagName.toLowerCase()+(p.id?'#'+p.id:'')+'.'+String(p.className).split(' ').slice(0,2).join('.')); p=p.parentElement; } return chain; })(),
    visible: vis });
})()"""

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
steps = []
t = yt()
steps.append(('s0_top', json.loads(t.eval(CENSUS)))); shot('s0_top')
# expand comments so the page has somewhere to go
t.eval("(function(){var c=document.querySelector('ytm-comments-entry-point-header-renderer'); if(c){c.click(); return 'clicked'} return 'no comments entry'})()")
time.sleep(3)
t = yt()
steps.append(('s1_comments', json.loads(t.eval(CENSUS)))); shot('s1_comments')
for i in range(5):
    t = yt()
    t.cmd('Input.synthesizeScrollGesture', x=200, y=650, yDistance=-400, speed=1000)
    time.sleep(1.2)
    steps.append(('s2_down%d' % i, json.loads(yt().eval(CENSUS)))); shot('s2_down%d' % i)
for i in range(5):
    t = yt()
    t.cmd('Input.synthesizeScrollGesture', x=200, y=300, yDistance=400, speed=1000)
    time.sleep(1.2)
    steps.append(('s3_up%d' % i, json.loads(yt().eval(CENSUS)))); shot('s3_up%d' % i)
json.dump(steps, open(os.path.join(OUT, 'steps.json'), 'w'), indent=1)
for name, s in steps:
    print(name, 'scrollY', s['scrollY'], 'video', s['video'] and s['video'][:4], 'canvas', s['canvas'] and s['canvas'][:4], 'pill', s['pill'] and s['pill'][:4], 'sticky', s['sticky'], 'vis', [v[0] + ':' + v[1] + '@' + str(v[2]) for v in s['visible']][:5])
