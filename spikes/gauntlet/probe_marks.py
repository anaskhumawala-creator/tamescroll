# DO BLAZEFACE'S OWN LANDMARKS SEPARATE THE TWO POPULATIONS THE GATE
# COULD NOT?
#
# Confidence does not (refused p50 0.78 vs kept 0.79, his phone), size
# does not (72 vs 79), and the frame keypoint max is the thing that was
# already refusing people (separator 0.098 against 0.101). The six facial
# landmarks are the only per-face signal we have that describes what is
# INSIDE the box, and they cost no inference -- the model already emits
# them.
#
# NOTHING IS GATED ON THEM YET. This reads the two rings and prints their
# distributions side by side. A rule may only be written if these
# separate; if they overlap the way confidence does, the honest answer is
# that this axis fails too and it goes in the findings as a dead end.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID  = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 110
DWELL= int(sys.argv[4]) if len(sys.argv) > 4 else 220

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%d; v.play();} return 1;})()" % SEEK)

# The rings cap at 60, so a long dwell SATURATES them and the counts
# below become floors. Drain periodically into a page-side accumulator
# instead -- the same saturation trap that produced the retracted
# `player.passes` cadence figure.
t.eval("""(function(){
  window.__TS_MARKACC = {refused:[], kept:[], seen:{}};
  function key(e){ return e.ms + '|' + e.c + '|' + e.px; }
  setInterval(function(){
    var d = window.__TS_GAZE_IDS || {};
    ['gateRefused','gateKept'].forEach(function(ring){
      var r = d[ring] || [];
      for (var i=0;i<r.length;i++){
        var k = ring + key(r[i]);
        if (window.__TS_MARKACC.seen[k]) continue;
        window.__TS_MARKACC.seen[k] = 1;
        window.__TS_MARKACC[ring === 'gateRefused' ? 'refused':'kept'].push(r[i]);
      }
    });
  }, 700);
  return 1;})()""")

time.sleep(DWELL)
raw = t.eval("(function(){var a=window.__TS_MARKACC||{};"
             "return JSON.stringify({refused:a.refused||[], kept:a.kept||[]});})()")
d = json.loads(raw)
open('marks-populations.json','w').write(raw)

FIELDS = ['es','md','nd','ea','ti','as','ib','sp']
def q(v, p):
    if not v: return None
    v = sorted(v); i = min(len(v)-1, int(len(v)*p))
    return round(v[i], 3)

def report(name, rows):
    withm = [r for r in rows if r.get('m')]
    print(name, 'n', len(rows), ' with landmarks', len(withm),
          ' degenerate', sum(1 for r in withm if r['m'].get('dg')))
    if not withm: return
    for f in FIELDS:
        vals = [r['m'][f] for r in withm if isinstance(r['m'].get(f), (int,float))]
        print('   %-3s p05 %-8s p50 %-8s p95 %-8s' % (f, q(vals,0.05), q(vals,0.5), q(vals,0.95)))

report('REFUSED', d['refused'])
report('KEPT   ', d['kept'])
print('LIFE', t.eval("(function(){var d=window.__TS_GAZE_IDS||{};"
                     "return JSON.stringify({life:d.life||{}});})()"))
