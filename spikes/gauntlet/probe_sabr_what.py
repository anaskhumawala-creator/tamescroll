from gauntlet import pick, targets
def platform_tab():
    for t in targets():
        u=t.get("url","")
        if "localhost:1420" in u or "tauri.localhost" in u or "devtools" in u: continue
        if u.startswith("http"): return pick(u)
    raise SystemExit("no platform window")
tab=platform_tab()
print(tab.eval(r"""(function(){
  var r=window.ytInitialPlayerResponse;
  var keys = r? Object.keys(r) : null;
  var pd = window.ytInitialData? Object.keys(window.ytInitialData).length : null;
  // is there a player response anywhere else on mobile?
  var globals = Object.keys(window).filter(function(k){return /ytInitial|ytcfg|playerResponse/i.test(k);});
  var cfgKeys = null;
  try { cfgKeys = window.ytcfg && window.ytcfg.data_ ? Object.keys(window.ytcfg.data_).filter(function(k){return /PLAYER|player/.test(k);}) : null; } catch(e){}
  return JSON.stringify({href: location.pathname, hasIPR: !!r, iprKeys: keys,
    hasSD: !!(r&&r.streamingData), ytInitialDataKeys: pd, globals: globals, cfgPlayerKeys: cfgKeys}, null, 1);
})()"""))
