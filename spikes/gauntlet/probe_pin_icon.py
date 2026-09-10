"""Ask the launcher to pin the YouTube shortcut and screencap the system's
pin dialog, which previews the shortcut icon and label exactly as the
home screen will draw them. Nothing is confirmed: the dialog is left for
the owner to accept or dismiss.

  python spikes/gauntlet/probe_pin_icon.py <port> <out.png>
"""
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]); OUT = sys.argv[2]
DEV = 'e3d369ee'
PKG = 'app.tamescroll.client'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'


def adb(*a):
    return subprocess.run([ADB, '-s', DEV] + list(a), capture_output=True, timeout=120)


adb('shell', 'svc power stayon usb')
adb('shell', 'am force-stop %s' % PKG)
time.sleep(1)
adb('shell', 'am start -n %s/.MainActivity' % PKG)
time.sleep(7)
pid = adb('shell', 'pidof %s' % PKG).stdout.decode().strip()
sock = [l.split('@')[-1].strip() for l in adb('shell', 'cat /proc/net/unix').stdout.decode().splitlines()
        if 'webview_devtools_remote_' + pid in l][0]
adb('forward', '--remove', 'tcp:%d' % PORT)
adb('forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock)
t = Tab(page(port=PORT, want='tauri.localhost')); t.cmd('Runtime.enable')
print('bridge', t.eval("(function(){try{ window.TsLinks.pinShortcut('youtube'); return 'called' }catch(e){ return 'ERR '+e }})()"))
time.sleep(2.5)
open(OUT, 'wb').write(adb('exec-out', 'screencap', '-p').stdout)
print('shot', OUT)
