from gauntlet import pick
t = pick("youtube.com")
print("bundle", t.eval("window.__TS_GAZE_BUNDLE__"))
print(t.eval(r"""(function(){
  var im=window.__TSPROBE&&window.__TSPROBE.img;
  if(!im) return 'no probe img';
  function R(e){var r=e.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height};}
  var hosts=document.querySelectorAll('ytm-video-preview, .ytmVideoPreviewHost, ytd-video-preview, #movie_player');
  var ir=R(im);
  var out={imgRect:ir, hosts:[]};
  for(var i=0;i<hosts.length;i++){
    var v=hosts[i].querySelector('video');
    var hr=R(hosts[i]);
    var w=Math.min(hr.x+hr.w,ir.x+ir.w)-Math.max(hr.x,ir.x);
    var h=Math.min(hr.y+hr.h,ir.y+ir.h)-Math.max(hr.y,ir.y);
    out.hosts.push({tag:hosts[i].tagName+(hosts[i].id?'#'+hosts[i].id:''), rect:hr,
      playing: !!(v&&!v.paused&&v.readyState>=2), rs: v?v.readyState:null,
      frac: (w>0&&h>0)? +( (w*h)/(ir.w*ir.h) ).toFixed(3) : 0});
  }
  out.connected = im.isConnected;
  out.parentIsPlayer = !!im.parentElement.closest('#movie_player, .ytmVideoPreviewHost, ytm-video-preview');
  return JSON.stringify(out);
})()"""))
