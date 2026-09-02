# WHAT WOULD `isPlayer` HAVE TO MATCH ON THE OTHER PLATFORMS?
#
# findings 16: the entire per-person pipeline -- tracking, the coast, the
# clear bar, the identity memory, body-clamp, the null-mint guard, every
# number loops 37-43 measured -- is gated on
#
#     var isPlayer = !!(video.closest && video.closest('#movie_player'));
#
# so on Reddit, X, Instagram and Facebook a video gets whole-frame blur
# and one boolean. Widening that selector is the only way the tuned path
# reaches them, and it CANNOT be guessed from memory (this repo's rule:
# selectors are read from the live DOM).
#
# A host is usable by region-blur only if ALL of these hold, and each is
# read here rather than assumed:
#
#   CONTAINS   it contains the <video> (or the patch cannot clip to it)
#   POSITIONED it is or can be made a containing block -- resolveHost
#              writes `position: relative` on a static host, and refuses
#              <body> (loop 16)
#   NOT FIXED  resolveHost skips `isolation: isolate` on a fixed host, so
#              a fixed host has nothing holding its patch in the band
#   REACHABLE  `video.closest(sel)` finds it. **closest() STOPS AT A
#              SHADOW BOUNDARY**, so a video inside an open shadow root
#              (Reddit's shreddit player, 2026-08-19) can never reach a
#              light-DOM ancestor by closest() at all -- which would make
#              a widened selector silently inert, the failure mode this
#              repo has shipped more than once.
#   STABLE     it survives the SPA navigation the platform uses
#
# Reads only. Nothing is written to the page, nothing renders that the
# page was not already showing, and the app is force-stopped by the
# caller afterwards.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9240
URL = sys.argv[2] if len(sys.argv) > 2 else None
WAIT = int(sys.argv[3]) if len(sys.argv) > 3 else 25

JS = r"""
(function(){
  function chain(el){
    var out=[], n=el, depth=0;
    while(n && depth<14){
      var cs=null; try{cs=getComputedStyle(n);}catch(e){}
      var r=null; try{r=n.getBoundingClientRect();}catch(e){}
      out.push({
        tag:(n.tagName||'').toLowerCase(),
        id:n.id||'',
        cls:(typeof n.className==='string'?n.className:'').slice(0,60),
        pos:cs?cs.position:null,
        tf:cs&&cs.transform!=='none'?1:0,
        ov:cs?cs.overflow:null,
        z:cs?cs.zIndex:null,
        iso:cs?cs.isolation:null,
        w:r?Math.round(r.width):0, h:r?Math.round(r.height):0,
        shadowHost: n.shadowRoot?1:0
      });
      var p=n.parentNode;
      if(p && p.nodeType===11){ out.push({tag:'#SHADOW-ROOT-BOUNDARY', host:(p.host&&p.host.tagName||'').toLowerCase()}); p=p.host; }
      n=p && p.nodeType===1 ? p : null;
      depth++;
    }
    return out;
  }
  function allVideos(root, acc, depth){
    if(depth>6) return acc;
    try{ [].forEach.call(root.querySelectorAll('video'), function(v){ if(acc.indexOf(v)<0) acc.push(v); }); }catch(e){}
    try{ [].forEach.call(root.querySelectorAll('*'), function(e){ if(e.shadowRoot) allVideos(e.shadowRoot, acc, depth+1); }); }catch(e){}
    return acc;
  }
  var vids = allVideos(document, [], 0);
  return JSON.stringify({
    host: location.host, path: location.pathname.slice(0,60),
    nVideos: vids.length,
    movie: !!document.querySelector('#movie_player'),
    videos: vids.slice(0,4).map(function(v){
      var r=v.getBoundingClientRect();
      var inShadow = v.getRootNode && v.getRootNode() !== document;
      return {
        w:Math.round(r.width), h:Math.round(r.height),
        vw:v.videoWidth, vh:v.videoHeight,
        readyState:v.readyState, paused:v.paused,
        src:(v.currentSrc||'').slice(0,50),
        inShadowRoot: inShadow?1:0,
        closestMoviePlayer: !!(v.closest && v.closest('#movie_player')),
        chain: chain(v)
      };
    })
  });
})()
"""

t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
if URL:
    t.eval("(function(){location.href=%s;return 1;})()" % json.dumps(URL))
    time.sleep(WAIT)
r = t.eval("(function(){return 1;})()")
out = t.eval(JS)
if not isinstance(out, str):
    print("EVAL FAILED", out); sys.exit(2)
d = json.loads(out)
print("host %s  path %s   videos %d   #movie_player %s"
      % (d["host"], d["path"], d["nVideos"], d["movie"]))
for i, v in enumerate(d["videos"]):
    print("\n  video %d  %dx%d css / %dx%d native  readyState %d  paused %s"
          % (i, v["w"], v["h"], v["vw"], v["vh"], v["readyState"], v["paused"]))
    print("    inShadowRoot %d   closest('#movie_player') %s   src %s"
          % (v["inShadowRoot"], v["closestMoviePlayer"], v["src"]))
    for c in v["chain"]:
        if c.get("tag") == "#SHADOW-ROOT-BOUNDARY":
            print("      ---- SHADOW BOUNDARY (host <%s>) -- closest() STOPS HERE ----" % c["host"])
            continue
        print("      <%-28s %-9s tf%d ov:%-8s z:%-6s iso:%-6s %4dx%-4d%s"
              % ((c["tag"] + ("#" + c["id"] if c["id"] else "")
                  + ("." + c["cls"].split()[0] if c["cls"].strip() else ""))[:28],
                 c["pos"], c["tf"], str(c["ov"])[:8], str(c["z"])[:6],
                 str(c["iso"])[:6], c["w"], c["h"],
                 "  [shadow host]" if c["shadowHost"] else ""))
