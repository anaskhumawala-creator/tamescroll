"""End to end: our own script, served on youtube.com, running in a Worker."""
import time, json
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=worker+spike'")
time.sleep(12)
print(tab.eval("""(function(){
  window.__ws = {state: 'starting'};
  try {
    var pol = trustedTypes.createPolicy('tamescroll-worker', { createScriptURL: function(s){ return s; } });
    var w = new Worker(pol.createScriptURL('/__tamescroll/worker-spike.js'));
    window.__ws.state = 'constructed';
    w.onmessage = function(e){
      if (e.data && e.data.hello) { window.__ws.hello = e.data.hello; w.postMessage({ping: 1}); }
      else { window.__ws.result = e.data; window.__ws.state = 'answered'; }
    };
    w.onerror = function(e){ window.__ws.state = 'error'; window.__ws.err = (e.message || 'no-message') + ' @' + (e.filename||''); };
  } catch (e) { window.__ws.state = 'threw'; window.__ws.err = e.name + ' ' + e.message; }
  return 'started';
})()"""))
for i in range(12):
    time.sleep(1.5)
    st = tab.eval("JSON.stringify(window.__ws)")
    if isinstance(st, str) and ('answered' in st or 'error' in st or 'threw' in st):
        break
print(st)
