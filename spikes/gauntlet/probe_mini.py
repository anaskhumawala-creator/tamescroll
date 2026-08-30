import json, time
from gauntlet import Tab, open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
import time as _t; _t.sleep(9)
time.sleep(8)
js = r"""
(function(){
  var out = {};
  out.url = location.href;
  out.miniEl = !!document.querySelector('ytd-miniplayer');
  var m = document.querySelector('ytd-miniplayer');
  out.miniStyle = m ? getComputedStyle(m).display : null;
  out.miniBtn = !!document.querySelector('.ytp-miniplayer-button');
  out.pipBtn = !!document.querySelector('.ytp-pip-button');
  out.playerCls = (document.querySelector('#movie_player')||{}).className || null;
  // which of OUR injected rules would match a miniplayer node?
  var hits = [];
  var sheets = document.querySelectorAll('style[id^="tamescroll"], style[id*="ts-"]');
  out.ourSheets = [].map.call(sheets, function(s){ return {id:s.id, len:(s.textContent||'').length}; });
  [].forEach.call(sheets, function(s){
    (s.textContent||'').split('}').forEach(function(chunk){
      var sel = chunk.split('{')[0].trim();
      if (!sel || sel[0]==='@') return;
      if (/mini/i.test(sel)) hits.push(sel);
    });
  });
  out.miniSelectorsInOurCss = hits;
  // does YouTube think miniplayer is enabled?
  try { out.ytcfgMini = !!(window.ytcfg && ytcfg.get('WEB_PLAYER_CONTEXT_CONFIGS')); } catch(e){ out.ytcfgMini='err'; }
  out.appShell = !!document.querySelector('ytd-app');
  return JSON.stringify(out);
})()
"""
print(tab.eval(js))
