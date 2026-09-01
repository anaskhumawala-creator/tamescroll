# WHY DOES NOBODY CLEAR ON HIS PHONE?
#
# Measured off his device on 1078, m.youtube watch, gender man, ~2 min:
# 41 MALE reads, score p50 0.23, MAX 0.49 -- against GENDER_CLEAR_SCORE
# 0.60. Not one man in the window could ever be cleared, so every man
# stays covered. That is his "wrong blur" and it is arithmetic, not a
# tracker bug.
#
# The question this answers: is that the DEVICE or the FOOTAGE? MoveNet
# already reads n:0 on his hardware and 2-3 per pass on the emulator for
# the SAME frames (loop 36), so a device-specific weakness is not a
# hypothetical here. Same video, same timestamps, same build.
import json, sys, time
from emu_cdp import page, Tab

PORT  = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID   = sys.argv[2] if len(sys.argv) > 2 else "yFg1uAK1RC8"
SEEK  = int(sys.argv[3]) if len(sys.argv) > 3 else 48
DWELL = int(sys.argv[4]) if len(sys.argv) > 4 else 130

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

# The reads ring caps, so drain it into an accumulator rather than
# reading a saturated ring at the end.
t.eval("""(function(){
  window.__TS_ACC = {reads:[], seen:{}};
  setInterval(function(){
    var r = (window.__TS_GAZE_IDS||{}).reads || [];
    for (var i=0;i<r.length;i++){
      var k = [r[i].g,r[i].s,r[i].a,r[i].px,r[i].v].join('|');
      if (window.__TS_ACC.seen[k]) continue;
      window.__TS_ACC.seen[k]=1; window.__TS_ACC.reads.push(r[i]);
    }
  }, 700); return 1;})()""")
time.sleep(DWELL)
raw = t.eval("(function(){var a=window.__TS_ACC||{};var d=window.__TS_GAZE_IDS||{};"
             "var s=(d.slots||[]);var nz=0;for(var i=0;i<s.length;i++) if(s[i]&&s[i].n) nz++;"
             "return JSON.stringify({reads:a.reads||[], slotsNonZero:nz, slots:s.length,"
             "life:d.life||{}});})()")
open('emu-scoredist.json','w').write(raw)
d = json.loads(raw)
R = d['reads']
def q(v,p):
    v=sorted(v); return round(v[min(len(v)-1,int(len(v)*p))],3) if v else None
from collections import Counter
print('reads', len(R), Counter(r['g'] for r in R))
for g in ('male','female'):
    s=[r['s'] for r in R if r['g']==g and isinstance(r['s'],(int,float))]
    px=[r['px'] for r in R if r['g']==g and isinstance(r['px'],(int,float))]
    print(g, 'n', len(s), 'score p05/p50/p95/max', q(s,.05), q(s,.5), q(s,.95), max(s) if s else None,
          '| px p50', q(px,.5), '| >=0.6', sum(1 for x in s if x>=0.6))
print('slotsNonZero', d['slotsNonZero'], 'of', d['slots'])
print('life', json.dumps(d['life']))
