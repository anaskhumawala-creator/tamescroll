# WITH HOME HIDDEN, WHAT IS ACTUALLY LEFT ON HIS HOME PAGE?
#
# His stored `tamescroll.shown` reads {"youtube":["watch_recs"]} -- the
# home surface is HIDDEN on his phone. Every earlier round chased which
# SHELF to hide; nobody asked the obvious question that follows from
# that state: with the feed switched off, what does he still see? "Random
# homepage elements" has to be one of those, because the rest is gone.
#
# JSON only, on his phone, signed in. Nothing is screenshotted and
# nothing renders on his monitor.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="https://m.youtube.com/")
time.sleep(20)

out = t.eval("""(function(){
  function vis(e){
    var r=e.getBoundingClientRect();
    if(r.width<2||r.height<2) return false;
    var cs=getComputedStyle(e);
    return cs.display!=='none' && cs.visibility!=='hidden' && cs.opacity!=='0';
  }
  // Everything CUSTOM the page renders, one level of nesting only -- a
  // census that walks into every yt-*-view-model reports the same shelf
  // five times and teaches nothing (the loop-33 lesson).
  var all=document.querySelectorAll('*');
  var counts={}, vcounts={}, heights={};
  for(var i=0;i<all.length;i++){
    var tag=all[i].tagName.toLowerCase();
    if(tag.indexOf('ytm-')!==0 && tag.indexOf('ytd-')!==0) continue;
    counts[tag]=(counts[tag]||0)+1;
    if(vis(all[i])){
      vcounts[tag]=(vcounts[tag]||0)+1;
      var h=Math.round(all[i].getBoundingClientRect().height);
      if(!heights[tag]||h>heights[tag]) heights[tag]=h;
    }
  }
  var rows=[];
  for(var k in vcounts) rows.push({tag:k, visible:vcounts[k], total:counts[k], maxH:heights[k]});
  rows.sort(function(a,b){return b.maxH-a.maxH;});
  // And the text a person would actually read, top to bottom, so a
  // "random element" can be named rather than guessed at.
  var texts=[];
  var seen={};
  var cands=document.querySelectorAll('h1,h2,h3,[role="heading"],span.yt-core-attributed-string');
  for(var c=0;c<cands.length && texts.length<25;c++){
    if(!vis(cands[c])) continue;
    var tx=(cands[c].textContent||'').replace(/[^\x20-\x7e]/g,'').trim().slice(0,70);
    if(!tx || seen[tx]) continue;
    seen[tx]=1;
    var rr=cands[c].getBoundingClientRect();
    texts.push({y:Math.round(rr.top+ (document.scrollingElement?document.scrollingElement.scrollTop:0)), t:tx});
  }
  var body=document.body;
  return JSON.stringify({
    path: location.pathname,
    shown: localStorage.getItem('tamescroll.shown'),
    mode: window.__TS_GAZE_MODE || null,
    scrollH: Math.max(document.documentElement.scrollHeight, body.scrollHeight),
    watchLinks: document.querySelectorAll('a[href*="/watch?v="]').length,
    shortsLinks: document.querySelectorAll('a[href^="/shorts/"]').length,
    rows: rows.slice(0,24),
    texts: texts
  });})()""")
d = json.loads(out) if isinstance(out, str) else {}
print(json.dumps(d, indent=1)[:6000])
