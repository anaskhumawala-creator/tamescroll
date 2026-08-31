import time, json
import emu_cdp
t = emu_cdp.Tab(emu_cdp.page()); t.cmd("Input.enable")
Q = """(function(){
  var pill=document.querySelector('.ts-gaze-pill');
  var q=pill?pill.getBoundingClientRect():null;
  var bg=document.querySelector('.player-controls-background');
  var cs=bg?getComputedStyle(bg):null;
  var br=bg?bg.getBoundingClientRect():null;
  var pc=pill?getComputedStyle(pill):null;
  var cx=q?Math.round(q.left+q.width/2):0, cy=q?Math.round(q.top+q.height/2):0;
  var e=document.elementFromPoint(cx,cy);
  var v=document.querySelector('#movie_player video');
  return {
    pillBox:q?[Math.round(q.left),Math.round(q.top),Math.round(q.width),Math.round(q.height)]:null,
    pillZ:pc?pc.zIndex:null, pillPE:pc?pc.pointerEvents:null,
    bgPresent:!!bg, bgZ:cs?cs.zIndex:null, bgOpacity:cs?cs.opacity:null,
    bgPE:cs?cs.pointerEvents:null, bgDisplay:cs?cs.display:null,
    bgBox:br?[Math.round(br.left),Math.round(br.top),Math.round(br.width),Math.round(br.height)]:null,
    hit:e?(e.className&&e.className.baseVal!==undefined?e.className.baseVal:String(e.className||e.tagName)):null,
    hitIsPill: !!(e&&e.closest&&e.closest('.ts-gaze-pill')),
    controlsShown: !!document.querySelector('#movie_player.ytp-autohide')===false,
    playerCls: (document.querySelector('#movie_player')||{}).className||'',
    paused: v?v.paused:null};})()"""
v = t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.play();} return 1;})()")
for label, wait in (("t+0",0.5),("t+4s",4),("t+8s",4),("t+13s",5)):
    time.sleep(wait)
    r=t.eval(Q)
    print(label, json.dumps(r))
