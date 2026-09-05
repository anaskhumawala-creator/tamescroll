"""1108: drive the front door over CDP and screenshot each screen.

  python spikes/gauntlet/probe_frontdoor.py <serial> <port> <mode>

mode home  : launcher -> links view (Set up) -> screenshots + TsLinks.state()
mode ob    : fresh onboarding, every step, screenshots (app data must be cleared)
Screenshots go to the scratch dir passed in SCRATCH env.
"""
import json
import os
import subprocess
import sys
import time

from emu_cdp import Tab, page

DEV, PORT, MODE = sys.argv[1], int(sys.argv[2]), sys.argv[3]
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
OUT = os.environ.get('SCRATCH', '.')


def adb(*a, timeout=120):
    return subprocess.run([ADB, '-s', DEV] + list(a), capture_output=True, text=True, timeout=timeout).stdout


def shot(name):
    png = subprocess.run([ADB, '-s', DEV, 'exec-out', 'screencap', '-p'], capture_output=True, timeout=60).stdout
    with open(os.path.join(OUT, '%s-%s.png' % (DEV[:4], name)), 'wb') as f:
        f.write(png)


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
            return pid
        time.sleep(2)
    raise SystemExit('no devtools socket')


def tab():
    t = Tab(page(port=PORT, want='tauri.localhost'))
    t.cmd('Runtime.enable')
    return t


def click(t, sel):
    return t.eval("(function(){var e=document.querySelector(%s); if(!e) return 'MISSING'; e.click(); return 'ok';})()" % json.dumps(sel))


adb('shell', 'am force-stop %s' % PKG)
time.sleep(1)
adb('shell', 'am start -n %s/.MainActivity' % PKG)
time.sleep(5)
attach()
t = tab()

if MODE == 'home':
    shot('home')
    print('state:', t.eval('window.TsLinks && TsLinks.state()'))
    print('card hidden:', t.eval("document.querySelector('#links-card').hidden"))
    print(click(t, '#links-card-btn'))
    time.sleep(0.6)
    shot('links')
    print('steps done:', t.eval("JSON.stringify([...document.querySelectorAll('#links-steps .step')].map(l=>l.dataset.step+':'+l.classList.contains('done')))"))
    print('note:', t.eval("document.querySelector('#links-note').textContent"))
    for act, name in [('yt-off', 'sys-yt'), ('ours-on', 'sys-ours')]:
        print(click(t, '[data-act="%s"]' % act))
        time.sleep(2.5)
        shot(name)
        adb('shell', 'input keyevent KEYCODE_BACK')
        time.sleep(1.5)
    print(click(t, '#links-back'))
    time.sleep(0.5)
    print('back on launcher:', t.eval("!document.querySelector('#view-launcher').hidden"))
    print(click(t, '#open-settings'))
    time.sleep(0.6)
    shot('settings')
    for pane in ['filters', 'blur', 'about']:
        print(click(t, '.nav-item[data-pane="%s"]' % pane))
        time.sleep(0.4)
        shot('settings-' + pane)

elif MODE == 'ob':
    print('onboard shown:', t.eval("!document.querySelector('#view-onboard').hidden"))
    shot('ob1')
    print(click(t, '#ob-start')); time.sleep(0.5); shot('ob2')
    t.eval("(function(){var i=document.querySelector('#ob-input'); i.value='you'; i.dispatchEvent(new Event('input')); })()")
    time.sleep(0.3); shot('ob2-match')
    print(click(t, '#ob-match button')); time.sleep(0.3); shot('ob2-chip')
    print(click(t, '#ob-continue')); time.sleep(0.5); shot('ob3')
    print('count:', t.eval("document.querySelector('#ob-count').textContent"))
    print(click(t, '.ob-card[data-gender="man"]')); time.sleep(0.5); shot('ob4')
    print(click(t, '#ob-blur-cards .ob-card[data-mode="smart"]')); time.sleep(0.5); shot('ob5')
    print('chosen committed:', t.eval("localStorage.getItem('tamescroll.chosen')"))
    print('links btn hidden:', t.eval("document.querySelector('#ob-links').hidden"))
    print(click(t, '#ob-links')); time.sleep(0.6); shot('ob-links')
    print(click(t, '#links-done')); time.sleep(0.6); shot('ob-home')
    print('launcher shown:', t.eval("!document.querySelector('#view-launcher').hidden"))
