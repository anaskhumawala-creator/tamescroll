"""1118 on his phone: (1) the tile lands on Subscriptions, (2) the logo
tap in-page lands on Subscriptions, (3) onboarding's last step offers the
home-screen icon. Onboarding is reached by clearing the chosen list in
the launcher's localStorage and reloading; it is restored afterwards.

  python spikes/gauntlet/probe_1118.py <port> <outdir>
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


def tab(want):
    t = Tab(page(port=PORT, want=want)); t.cmd('Runtime.enable'); return t


def shot(name):
    open(os.path.join(OUT, name + '.png'), 'wb').write(adb('exec-out', 'screencap', '-p').stdout)


def wait_url(frag, timeout=15):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if frag in tab('youtube').eval('location.href'):
                return round(time.time() - t0, 2)
        except Exception:
            pass
        time.sleep(0.3)
    return None


out = {}
adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop %s' % PKG)
time.sleep(2)
adb('shell', 'am start -n %s/.MainActivity' % PKG)
time.sleep(7)
attach()
t = tab('tauri.localhost')
out['shown'] = t.eval("localStorage.getItem('tamescroll.shown')")
# 1. real tile tap
t.eval("(function(){var b=[...document.querySelectorAll('.tile')].find(function(x){return /YouTube/.test(x.textContent)}); b.click(); return 1})()")
out['tile_to_subs_s'] = wait_url('/feed/subscriptions')
time.sleep(2)
shot('p1_tile')
# 2. the logo, in page
t = tab('youtube')
t.eval("(function(){var b=document.querySelector('button[aria-label=\"YouTube Home\"]'); b&&b.click(); return !!b})()")
time.sleep(1.2)
out['logo_mid_url'] = tab('youtube').eval('location.pathname')
out['logo_to_subs_s'] = wait_url('/feed/subscriptions')
time.sleep(1.5)
shot('p2_logo')
out['after_logo'] = tab('youtube').eval("JSON.stringify({url:location.pathname, items:document.querySelectorAll('ytm-rich-item-renderer, ytm-media-item').length})")
# 3. onboarding step 5: clear chosen, reload the launcher, walk the steps
t = tab('youtube')
t.eval("(function(){var b=document.querySelector('#tamescroll-home'); b&&b.click(); return !!b})()")
time.sleep(3)
t = tab('tauri.localhost')
saved = t.eval("localStorage.getItem('tamescroll.chosen')")
out['chosen_saved'] = saved
t.eval("localStorage.removeItem('tamescroll.chosen'); location.reload(); 1")
time.sleep(4)
t = tab('tauri.localhost')
t.eval("document.querySelector('#ob-start').click(); 1"); time.sleep(0.5)
t.eval("(function(){var i=document.querySelector('#ob-input'); i.value='you'; i.dispatchEvent(new Event('input',{bubbles:true})); return 1})()"); time.sleep(0.5)
t.eval("(function(){var b=[...document.querySelectorAll('#ob-match button')].find(function(x){return /Add/.test(x.textContent)}); b&&b.click(); return !!b})()"); time.sleep(0.4)
t.eval("document.querySelector('#ob-continue').click(); 1"); time.sleep(0.5)
t.eval("document.querySelector('.ob-card[data-gender=man]').click(); 1"); time.sleep(0.5)
t.eval("document.querySelector('#ob-blur-cards .ob-card').click(); 1"); time.sleep(0.8)
out['step5'] = t.eval("JSON.stringify({step:[...document.querySelectorAll('.ob-step')].findIndex(function(e){return !e.hidden})+1, pinBtnHidden:document.querySelector('#ob-pin').hidden, pinText:document.querySelector('#ob-pin').textContent, linksHidden:document.querySelector('#ob-links').hidden})")
shot('p3_onboarding_step5')
# restore
t.eval("localStorage.setItem('tamescroll.chosen', %s); 1" % json.dumps(saved))
out['chosen_restored'] = t.eval("localStorage.getItem('tamescroll.chosen')") == saved
print('P1118', json.dumps(out))
