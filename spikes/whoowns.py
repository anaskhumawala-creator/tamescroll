import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick, open_platform
tab=None
for _ in range(4):
    try: tab=pick("youtube.com"); break
    except BaseException:
        try: tab=open_platform("man"); break
        except BaseException: time.sleep(6)
if tab is None: raise SystemExit("no window")
DOC = """
(function(){
  window.__DEFS = [];
  var odp = Object.defineProperty;
  Object.defineProperty = function(o, p, d){
    try{
      if (o === window && p === 'ytInitialPlayerResponse'){
        var st = (new Error()).stack || '';
        window.__DEFS.push({at: Math.round(performance.now()),
          kind: d && d.get ? 'accessor' : 'data',
          who: st.split('\n').slice(1,4).join(' | ').slice(0,220)});
      }
    }catch(e){}
    return odp.apply(this, arguments);
  };
  var oda = Object.defineProperties;
  Object.defineProperties = function(o, ds){
    try{ if(o===window && ds && ds.ytInitialPlayerResponse){
      window.__DEFS.push({at:Math.round(performance.now()),kind:'defineProperties',who:'bulk'});
    } }catch(e){}
    return oda.apply(this, arguments);
  };
})();
"""
tab.cmd("Page.enable")
sid = tab.cmd("Page.addScriptToEvaluateOnNewDocument", source=DOC).get("identifier")
try:
    tab.eval("location.href='https://www.youtube.com/watch?v=DD54J5kecpg&t=0s'")
    time.sleep(14)
    out = tab.eval("""(function(){
      var r=window.ytInitialPlayerResponse;
      return JSON.stringify({defs:window.__DEFS||[], hasStream:!!(r&&r.streamingData),
        keys:r?Object.keys(r).length:0});})()""")
    d=json.loads(out)
    print("hasStream:", d['hasStream'], " keys:", d['keys'])
    for x in d['defs']:
        print("  %6dms %-14s %s" % (x['at'], x['kind'], x['who']))
finally:
    if sid: tab.cmd("Page.removeScriptToEvaluateOnNewDocument", identifier=sid)
