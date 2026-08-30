# THE WATCH-PAGE CHROME, READ OFF THE LIVE DOM.
#
# ReVanced hides info cards, the related-video overlay, player flyout
# items, the timestamp and the action-button row. All five are pure
# hiding, which is what this app already is. Selectors are read here, not
# remembered -- and the player is the red line, so every candidate is
# printed with its box so a rule can never be written against something
# that contains the video.
import json, time, sys
from emu_cdp import page, Tab
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
WATCH = sys.argv[1] if len(sys.argv) > 1 else "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"
t = Tab(page()); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
    shown:['home','watch_recs','previews','search_inserts']});
  return 1;})()""")
time.sleep(5)
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url=WATCH)
time.sleep(16)
# A CUED player builds none of the below-player chrome: the first read
# came back with zero candidates and a thumbnail overlay still up. Start
# playback and scroll, then enumerate what is ACTUALLY there rather than
# testing names from memory.
try:
    t.eval("(function(){var v=document.querySelector('video');if(v){v.muted=true;v.play&&v.play();}return 1;})()")
except Exception:
    pass
time.sleep(8)
for _ in range(3):
    try:
        t.eval("window.scrollBy(0,900);1")
    except Exception:
        break
    time.sleep(3)
try:
    t.eval("window.scrollTo(0,0);1")
except Exception:
    pass
time.sleep(3)
# The mobile player hides its controls while playing, so a read taken
# mid-playback sees no timestamp and no menu button. Reveal them.
try:
    t.eval("""(function(){
      var p=document.querySelector('#movie_player')||document.querySelector('.player-container');
      if(!p) return 0;
      var r=p.getBoundingClientRect();
      ['pointerdown','mousedown','mouseup','click'].forEach(function(ev){
        p.dispatchEvent(new MouseEvent(ev,{bubbles:true,clientX:r.left+r.width/2,
          clientY:r.top+r.height/2}));});
      return 1;})()""")
except Exception:
    pass
time.sleep(3)
print(json.dumps(t.eval("""(function(){
  var v=document.querySelector('video');
  var pl=document.querySelector('#movie_player');
  function look(sel){
    var out=[];
    try{
      [].slice.call(document.querySelectorAll(sel)).forEach(function(e){
        var r=e.getBoundingClientRect();
        out.push({sel:sel, tag:e.tagName.toLowerCase(),
          w:Math.round(r.width), h:Math.round(r.height),
          containsVideo: !!(v && e.contains(v)),
          inPlayer: !!(pl && pl.contains(e))});
      });
    }catch(e){ return [{sel:sel, err:String(e).slice(0,40)}]; }
    return out;
  }
  var cands=['.ytp-cards-button','.ytp-cards-teaser','.iv-branding','.annotation',
    '.ytp-ce-element','.ytp-endscreen-content',
    'ytm-companion-slot','.player-controls-background',
    '.ytp-settings-menu','.ytp-panel-menu','ytm-menu-item',
    'ytm-video-action-bar-renderer','ytm-slim-video-action-bar-renderer',
    'ytm-engagement-panel-title-header-renderer',
    '.ytp-time-display','.ytp-time-current','.ytp-time-duration',
    'ytm-time-status','ytm-timestamp'];
  var res=[];
  cands.forEach(function(s){ look(s).forEach(function(o){ if(o.err||o.w||o.h) res.push(o); }); });
  // Anything named like a card or an overlay, so a name we did not guess
  // still shows up.
  var extra=[];
  document.querySelectorAll('*').forEach(function(e){
    var n=e.tagName.toLowerCase(), c=(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||'';
    if(typeof c!=='string') c='';
    if(/card|overlay|action-bar|timestamp/i.test(n+' '+c)){
      var r=e.getBoundingClientRect();
      if(r.width>30&&r.height>10) extra.push({tag:n, cls:c.slice(0,54),
        w:Math.round(r.width), h:Math.round(r.height), containsVideo:!!(v&&e.contains(v))});
    }});
  // Every custom element on the page with a real box, so the rule is
  // written against what exists rather than what we remember.
  var all={};
  document.querySelectorAll('*').forEach(function(e){
    var n=e.tagName.toLowerCase();
    if(n.indexOf('-')===-1) return;
    var r=e.getBoundingClientRect();
    if(r.width<40||r.height<12) return;
    if(!all[n]) all[n]={n:0,h:0,containsVideo:false};
    all[n].n++; all[n].h=Math.max(all[n].h,Math.round(r.height));
    if(v&&e.contains(v)) all[n].containsVideo=true;
  });
  var playerCls={};
  if(pl) pl.querySelectorAll('*').forEach(function(e){
    var c=(typeof e.className==='string'?e.className:'')||'';
    c.split(/\s+/).forEach(function(k){ if(k.indexOf('ytp-')===0) playerCls[k]=(playerCls[k]||0)+1; });
  });
  // Filter HERE: the probe artifact truncated at 4.5KB and lost the
  // answer twice. Only the chrome we are actually hunting comes back.
  var want=/action|card|overlay|time|menu|panel|engagement|sheet/i;
  var chrome={};
  Object.keys(all).forEach(function(k){ if(want.test(k)) chrome[k]=all[k]; });
  var pcls=Object.keys(playerCls).filter(function(c){
    return /card|time|ce-|endscreen|menu|panel|overlay/i.test(c); }).sort();
  return {player:!!pl, video:!!v, playing: !!(v&&!v.paused),
          namedHits:res, chrome:chrome, playerClasses:pcls,
          kinds:Object.keys(all).length};
})()"""), indent=1))
