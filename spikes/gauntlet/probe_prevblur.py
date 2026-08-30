"""Owner 2026-08-27 (phone): scrolling the feed, image patches paint over
the PLAYING preview video. Reproduce under a mobile UA and report why the
stand-down (previewCovers) did not fire: the host it looked for, the host
that actually exists, whether its <video> is paused, and the coverage
fraction it computed."""
import time
from gauntlet import open_platform

MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)

JS = r"""(function(){
  function rect(e){var r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};}
  function inter(a,b){var w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
    var h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    if(!(w>0&&h>0))return 0; return +(w*h/(b.w*b.h)).toFixed(2);}
  var vids=[].slice.call(document.querySelectorAll('video')).filter(function(v){return !v.paused;});
  var patches=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var out={playing:vids.length, patches:patches.length, over:[]};
  vids.forEach(function(v){
    var vr=rect(v);
    out.video=vr;
    out.videoChain=(function(n,a){while(n&&a.length<6){a.push(n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(n.className&&n.className.slice?'.'+String(n.className).trim().split(/\s+/).slice(0,2).join('.'):''));n=n.parentElement;}return a;})(v,[]);
    patches.forEach(function(p){
      var pr=rect(p);
      var f=inter(vr,pr);
      if(f>0.2){
        var host=p.parentElement;
        out.over.push({patch:pr, frac:f,
          host:host?host.tagName.toLowerCase()+(host.className&&host.className.slice?'.'+String(host.className).trim().split(/\s+/).slice(0,2).join('.'):''):null,
          hostInPlayer: host?!!host.closest('#movie_player, .ytmVideoPreviewHost, ytm-video-preview'):null,
          hostRect: host?rect(host):null});
      }
    });
  });
  out.hostsFound={
    ytmVideoPreview: document.querySelectorAll('ytm-video-preview').length,
    ytmVideoPreviewHost: document.querySelectorAll('.ytmVideoPreviewHost').length,
    ytdVideoPreview: document.querySelectorAll('ytd-video-preview').length,
    moviePlayer: document.querySelectorAll('#movie_player').length};
  var mp=document.querySelector('#movie_player');
  if(mp){out.moviePlayerRect=rect(mp);out.mpHasPlaying=!!(mp.querySelector('video')&&!mp.querySelector('video').paused);}
  return JSON.stringify(out);
})()"""

tab.eval("location.href='https://m.youtube.com/'")
time.sleep(18)
for i in range(10):
    tab.eval("window.scrollBy(0,420);")
    time.sleep(2.5)
    r = tab.eval(JS)
    print(i, r)
    if isinstance(r, str) and '"over":[{' in r:
        break
