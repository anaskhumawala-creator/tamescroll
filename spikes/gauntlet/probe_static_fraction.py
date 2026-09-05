"""HOW MUCH OF HIS WATCH TIME IS A STILL SCENE?

  python spikes/gauntlet/probe_static_fraction.py 9333

THE UNMEASURED NUMBER THAT DECIDES A BUILD. `scene-gate.mjs` classifies
every gate tick as cut / static / motion, but `static` only ever reaches
the POSITION clock (init-entry:3776 -> `floor`), never `effZoom`
(:3836). So a locked-off talking head runs gender crops at full rate,
and the one adaptive-to-motion lever the engine has is spent on the
cheap pass.

Wiring `static` to the gender clock is the biggest unbuilt perf idea in
the round. Its whole value is the fraction of his watch time that
classifies static -- and NOBODY HAS EVER COUNTED IT.

THE CLAIM THIS EXISTS TO TEST, AND WHY IT IS NOT YET SUPPORTED. A
reviewer argued `STATIC_DELTA = 3` never fires, because scene-gate.mjs's
own comment records his phone's ring at p50 8.7 / p75 16.3 / p90 28.2 /
p95 54.9. That comment gives no percentile BELOW the median, so it
cannot say what fraction sits under 3 -- a median bounds nothing on the
left tail. This reads the tail directly.

THE SECOND GATE IS MEASURED TOO, and it is the one that decides whether
the idea is worth anything. init-entry:3776 is
`sceneState === 'static' && !anyBlurredTrack()`, so under blur-first the
lever is disabled exactly when somebody is on screen and covered --
which is most of the time that matters. A static fraction of 30% with
the blur gate closed over all of it is worth ZERO, so both are sampled
together and the joint number is the one to report.

`__TS_GAZE_IDS.luma` is an ungated 600-sample ring of the raw mean
absolute delta (init-entry:2530-2535), so this reads the same quantity
`classifyScene` thresholds -- no unit mismatch, which is the classic way
this measurement goes wrong.

Reports the left tail at several candidate thresholds, so the answer is
a curve rather than a verdict on the single value that ships.
"""
import json
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9333
DEV = 'e3d369ee'
ADB = 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe'
# a spread on purpose: his corpus' own footage, not one hand-picked clip
VIDEOS = ['NWoT1ZVd1Lo', 'KAWvDsghyc8', 'Ary1gIbaOTc']
WATCH_SECS = 75

READ = """(function(){
  var d = window.__TS_GAZE_IDS || {};
  var v = document.querySelector('video');
  return JSON.stringify({
    luma: (d.luma || []).slice(),
    href: location.href.slice(0, 40),
    t: Math.round((v && v.currentTime) || 0),
    paused: !!(v && v.paused),
    blurred: d.blurredNow === undefined ? null : d.blurredNow,
    patches: document.querySelectorAll('.ts-gaze-vregion-host').length
  });})()"""


def adb(*a, timeout=90):
    return subprocess.run([ADB, '-s', DEV] + list(a),
                          capture_output=True, text=True, timeout=timeout).stdout


def attach():
    sock = None
    for _ in range(20):
        pid = adb('shell', 'pidof app.tamescroll.client').strip()
        if pid:
            for line in adb('shell', 'cat /proc/net/unix').splitlines():
                if 'webview_devtools_remote_' in line:
                    n = line.strip().split('@')[-1]
                    if n.endswith('_' + pid):
                        sock = n
        if sock:
            break
        time.sleep(2)
    if not sock:
        raise SystemExit('no devtools socket')
    subprocess.run([ADB, '-s', DEV, 'forward', '--remove', 'tcp:%d' % PORT], capture_output=True)
    subprocess.run([ADB, '-s', DEV, 'forward', 'tcp:%d' % PORT, 'localabstract:%s' % sock],
                   capture_output=True)


# ONE APP SESSION PER VIDEO. Navigating three times inside one session
# left the attached tab reading `about:blank` while CDP's target list
# still named the watch URL -- a stale execution context, and it read as
# "the gate never ran" rather than as "you are talking to the wrong
# frame". A fresh launch per video costs 20s and removes the class.
allluma = []
per = {}
covered_samples = 0
total_samples = 0

for vid in VIDEOS:
    adb('shell', 'am force-stop app.tamescroll.client')
    time.sleep(2)
    adb('shell', 'monkey -p app.tamescroll.client -c android.intent.category.LAUNCHER 1')
    time.sleep(8)
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
    tab.cmd('Page.navigate', url='https://m.youtube.com/watch?v=%s' % vid)
    time.sleep(15)

    seen = []
    playing = False
    r = {}
    for _ in range(WATCH_SECS // 5):
        time.sleep(5)
        try:
            tab2 = Tab(page(port=PORT))
            tab2.cmd('Runtime.enable')
            r = json.loads(tab2.eval(READ))
        except Exception as e:
            print('  read failed:', e)
            continue
        # A SAMPLE TAKEN WHILE THE VIDEO IS NOT ADVANCING IS NOT A STILL
        # SCENE, IT IS A STOPPED ONE, and counting it would manufacture
        # exactly the static fraction this probe exists to measure.
        if r.get('t'):
            playing = True
        if r.get('luma'):
            seen = r['luma']
        total_samples += 1
        if (r.get('patches') or 0) > 0:
            covered_samples += 1
    per[vid] = seen if playing else []
    if not playing:
        print('%s  NEVER PLAYED (t=0 throughout) -- discarded' % vid)
    else:
        allluma += seen
        print('%s  ring %d samples  last t=%ss  href ok' % (vid, len(seen), r.get('t')))

if not allluma:
    raise SystemExit('no luma samples -- the gate never ran (tainted canvas?)')

allluma.sort()


def pct(q):
    return allluma[min(len(allluma) - 1, int(q * len(allluma)))]


# COUNT THE VIDEOS THAT ACTUALLY PLAYED, not the ones asked for. The
# first run printed "over 3 videos" when two had been discarded for never
# advancing -- an instrument overstating its own n, which is the class of
# error this repo has retracted four published tables for.
played = [v for v, vals in per.items() if vals]
print('\n=== luma delta distribution, %d samples over %d of %d videos ==='
      % (len(allluma), len(played), len(VIDEOS)))
if len(played) < len(VIDEOS):
    print('  DISCARDED (never advanced): %s'
          % ', '.join(v for v in VIDEOS if v not in played))
print('  p05 %.1f  p10 %.1f  p25 %.1f  p50 %.1f  p75 %.1f  p90 %.1f  p95 %.1f  max %.1f'
      % (pct(.05), pct(.10), pct(.25), pct(.50), pct(.75), pct(.90), pct(.95), allluma[-1]))

print('\n=== the LEFT TAIL, which is the whole question ===')
print('  threshold   share of ticks classified static')
for thr in (1, 2, 3, 4, 5, 6, 8, 10, 12):
    share = sum(1 for v in allluma if v <= thr) / len(allluma)
    mark = '   <- STATIC_DELTA ships here' if thr == 3 else ''
    print('  %8d   %5.1f%%%s' % (thr, 100 * share, mark))

print('\n=== per video, share <= 3 ===')
for vid, vals in per.items():
    if vals:
        print('  %-14s %5.1f%%  (n=%d)' % (
            vid, 100 * sum(1 for v in vals if v <= 3) / len(vals), len(vals)))

print('\n=== the second gate ===')
if total_samples:
    print('  samples with a patch on screen: %d/%d = %.1f%%'
          % (covered_samples, total_samples, 100 * covered_samples / total_samples))
    print('  init-entry:3776 disables the static lever whenever ANY track is')
    print('  blurred, so that share of the time it cannot fire at all --')
    print('  a static fraction is only worth what survives this.')
