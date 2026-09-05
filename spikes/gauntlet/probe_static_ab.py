"""DOES THE STILL-SCENE CLOCK ACTUALLY SAVE WORK? A/B ON HIS PHONE.

  python spikes/gauntlet/probe_static_ab.py 9333

1106 shipped STATIC_VERDICT_MS at 0. It is verified present in the
emitted bundle, verified applied on the device, and the gate is verified
READ (`uf>0&&Yl==="static"&&!fR()&&(Ye=Math.max(Ye,uf))`, Ye being the
effZoom that gates verdictDue). NONE OF THAT IS EVIDENCE IT SAVES
ANYTHING -- a dial can be read on every tick and still never fire,
because the gate also needs the scene to actually go still with nothing
blurred.

THE MEASUREMENT. `player.verdicts` and `player.passes` in the app's own
diagnostics are the counters the cadence work has always used. Same
video, same seek, same window length, arm pushed over OTA between runs.

WHY OTA AND NOT THE AUTOTEST HARNESS: STATIC_VERDICT_MS is on
PROTECTION_DIALS, so a page-triggered arm may never touch it -- it
delays a verdict, which is the same class as VERDICT_MAX_INTERVAL_MS.
Pushing it is the only sanctioned route, and it also exercises the
channel end to end.

THE CONFOUND THIS CONTROLS FOR, and it is the one that would otherwise
ruin the number: the static fraction varies enormously by passage -- the
same video measured 34.2% and 100.0% still in two windows an hour apart.
Two arms on different sections would compare passages, not dials. So
both arms seek to the SAME media time and the still fraction is printed
beside each arm; if those two fractions disagree the run is not
comparable and says so.

READ THE RESULT AS:
  verdicts drop, still fraction similar   -> the clock works, by that much
  verdicts flat, still fraction high      -> the gate is not firing; look
                                             at anyBlurredTrack()
  still fractions differ a lot            -> not comparable, re-run
"""
import json
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9333
DEV = 'e3d369ee'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
REPO = 'Z:/Apps/Disconnect'
# BALANCED ON PURPOSE. NWoT1ZVd1Lo is 215 man / 203 woman reads in the
# labelled corpus. Ary1gIbaOTc, which the first run used, is 293 man and
# ZERO woman -- so in man mode no patch ever appears, `anyBlurredTrack()`
# is false for the whole run, and the gate this dial depends on is never
# exercised. That is a best case that never happens on his feed.
VIDEO = 'NWoT1ZVd1Lo'
SEEK = 120.0
WINDOW_S = 90


def adb(*a, timeout=120):
    return subprocess.run([ADB, '-s', DEV] + list(a),
                          capture_output=True, text=True, timeout=timeout).stdout


def sh(cmd, cwd=REPO):
    return subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True).stdout


def push_dial(value):
    """Rewrite rules/tuning.json, regen the manifest, commit, push. The
    24h refresh sleep means a running process will not see this -- every
    arm force-stops first, which is also what a real phone does when the
    user reopens the app."""
    p = REPO + '/rules/tuning.json'
    raw = open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n')
    import re
    s = re.sub(r'"STATIC_VERDICT_MS": [0-9]+,', '"STATIC_VERDICT_MS": %d,' % value, s)
    open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
    sh('node scripts/gen-rules-manifest.mjs')
    sh('git add rules/ && git commit -q -m "A/B arm: STATIC_VERDICT_MS %d" && git push -q' % value)
    # POLL UNTIL THE CDN SERVES IT. raw.githubusercontent caches for
    # minutes; the first run of this slept 30s, the phone fetched the
    # STALE copy, and BOTH arms read applied=0 -- which looks exactly
    # like "the dial does nothing" rather than "the arm never landed".
    # The probe now refuses to proceed on an unconfirmed push.
    import urllib.request
    want = '"STATIC_VERDICT_MS": %d' % value
    for i in range(40):
        time.sleep(15)
        try:
            body = urllib.request.urlopen(
                'https://raw.githubusercontent.com/anaskhumawala-creator/'
                'tamescroll/main/rules/tuning.json', timeout=20).read().decode()
        except Exception:
            continue
        if want in body:
            print('  pushed STATIC_VERDICT_MS=%d, served after %ds' % (value, (i + 1) * 15))
            return
    raise SystemExit('CDN never served STATIC_VERDICT_MS=%d -- aborting rather '
                     'than measuring a stale arm' % value)


def fetch_launch():
    """A PUSHED VALUE TAKES TWO LAUNCHES, and the second run of this
    probe is how that was found: the CDN was confirmed serving 3000 and
    the phone still reported applied=0.

    ota.rs rebuilds the rule set from CACHE at startup and only then
    spawns the refresh thread, so the download completes AFTER the page
    has already booted and applied its tuning. Launch one downloads;
    launch two applies. Combined with the 24h sleep after a successful
    refresh, a pushed dial is not 'live' in any sense -- it is 'the
    second cold start after up to a day'."""
    adb('shell', 'am force-stop app.tamescroll.client')
    time.sleep(2)
    adb('shell', 'monkey -p app.tamescroll.client -c android.intent.category.LAUNCHER 1')
    time.sleep(25)
    adb('shell', 'am force-stop app.tamescroll.client')
    time.sleep(2)


def attach():
    sock = None
    for _ in range(20):
        pid = adb('shell', 'pidof app.tamescroll.client').strip()
        if pid:
            for line in adb('shell', 'cat /proc/net/unix').splitlines():
                if 'webview_devtools_remote_' + pid in line:
                    sock = line.strip().split('@')[-1]
        if sock:
            break
        time.sleep(2)
    if not sock:
        raise SystemExit('no devtools socket')
    subprocess.run([ADB, '-s', DEV, 'forward', '--remove', 'tcp:%d' % PORT], capture_output=True)
    subprocess.run([ADB, '-s', DEV, 'forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock],
                   capture_output=True)


READ = """(function(){
  var d = window.__TS_GAZE_IDS || {};
  var v = document.querySelector('video');
  return JSON.stringify({
    t: Math.round((v && v.currentTime) || 0),
    luma: (d.luma || []).slice(),
    applied: (d.tuning && d.tuning.applied) ? d.tuning.applied.STATIC_VERDICT_MS : null,
    patches: document.querySelectorAll('.ts-gaze-vregion-host').length,
    cropHead: (d.life || {}).cropHead || 0,
    nativePasses: (d.life || {}).nativePasses || 0,
    now: Date.now()
  });})()"""


def run_arm(label):
    adb('shell', 'am force-stop app.tamescroll.client')
    time.sleep(2)
    adb('shell', 'monkey -p app.tamescroll.client -c android.intent.category.LAUNCHER 1')
    time.sleep(9)
    attach()
    t = Tab(page(port=PORT))
    t.cmd('Page.enable')
    t.cmd('Runtime.enable')
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)
            ||(window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']});
      return 1;})()""")
    time.sleep(10)
    tab = Tab(page(port=PORT))
    tab.cmd('Page.enable')
    tab.cmd('Runtime.enable')
    tab.cmd('Page.navigate', url='https://m.youtube.com/watch?v=%s' % VIDEO)
    time.sleep(16)
    # SAME MEDIA TIME FOR BOTH ARMS. Two arms on different passages
    # compare passages, not dials.
    tb = Tab(page(port=PORT))
    tb.cmd('Runtime.enable')
    tb.eval("(function(){var v=document.querySelector('video'); if(v) v.currentTime=%f; return 1;})()" % SEEK)
    time.sleep(4)

    # A RATE, NOT A COUNT. `life.cropHead` is the running number of crops
    # through the gender head -- the expensive work this dial exists to
    # avoid -- and it is live, so this does not have to wait for the
    # app's ~5-minute diagnostics document. The first run tried exactly
    # that and both arms produced no row at all.
    def snap():
        tc = Tab(page(port=PORT))
        tc.cmd('Runtime.enable')
        return json.loads(tc.eval(READ))

    first = snap()
    last = first
    for _ in range(WINDOW_S // 10):
        time.sleep(10)
        try:
            last = snap()
        except Exception as e:
            print('   read failed:', e)
    secs = max(1e-3, (last.get('now', 0) - first.get('now', 0)) / 1000.0)
    dcrop = last.get('cropHead', 0) - first.get('cropHead', 0)
    dpass = last.get('nativePasses', 0) - first.get('nativePasses', 0)
    lu = last.get('luma') or []
    still = sum(1 for v in lu if v <= 3) / len(lu) if lu else 0
    print('  %-10s applied=%-5s  crops %d in %.0fs = %.2f/s   nativePasses %.2f/s'
          % (label, last.get('applied'), dcrop, secs, dcrop / secs, dpass / secs))
    print('             still<=3 %.1f%%   patches=%s   t=%ss'
          % (100 * still, last.get('patches'), last.get('t')))
    return {'still': still, 'applied': last.get('applied'),
            'cropRate': dcrop / secs, 'passRate': dpass / secs, 'secs': secs}


print('--- ARM A: clock OFF (0) ---')
push_dial(0)
fetch_launch()
a = run_arm('off')

print('\n--- ARM B: clock ON (3000) ---')
push_dial(3000)
fetch_launch()
b = run_arm('on 3000')

print('\n--- restoring the shipped value ---')
push_dial(0)

print('\n=== read ===')
if b['applied'] != 3000:
    print('  THE ARM NEVER LANDED (applied=%s). Nothing below is a result.' % b['applied'])
elif abs(a['still'] - b['still']) > 0.15:
    print('  NOT COMPARABLE: still fractions %.1f%% vs %.1f%% -- the two arms saw'
          % (100 * a['still'], 100 * b['still']))
    print('  different passages, which is the confound this run exists to avoid.')
else:
    print('  comparable: still %.1f%% vs %.1f%%' % (100 * a['still'], 100 * b['still']))
    d = 100 * (b['cropRate'] - a['cropRate']) / a['cropRate'] if a['cropRate'] else 0
    print('  gender crops/s   %.2f -> %.2f   (%+.1f%%)' % (a['cropRate'], b['cropRate'], d))
    print('  native passes/s  %.2f -> %.2f' % (a['passRate'], b['passRate']))
    print()
    if d < -5:
        print('  THE CLOCK SAVES WORK, by that much, on a scene this still.')
    else:
        print('  NO SAVING MEASURED. With only %.0f%% of ticks still and a patch on'
              % (100 * b['still']))
        print('  screen, the gate spends most of its time closed -- which is the')
        print('  realistic case, and the honest answer for this footage.')
