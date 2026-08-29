# Drives the new miniplayer gesture on the headless emulator and reports
# JSON only -- nothing from the page is ever rendered on the owner's
# screen (CLAUDE.md, 2026-08-29).
import json, sys, time
from emu_cdp import page, Tab

WATCH = "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"

def main():
    t = Tab(page())
    t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=(
        "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36"))
    t.cmd("Page.navigate", url=WATCH)
    time.sleep(9)

    out = {}
    out["boot"] = t.eval("""(function(){
      return {mini: !!window.__TS_MINI__, path: location.pathname,
              pc: !!document.getElementById('player-container-id'),
              video: document.querySelectorAll('#player-container-id video').length};
    })()""")

    # Enter via the api, then read the parked geometry.
    out["enter"] = t.eval("""(function(){
      if(!window.__TS_MINI__) return null;
      window.__TS_MINI__.enter();
      var pc=document.getElementById('player-container-id');
      var r=pc.getBoundingClientRect();
      var cs=getComputedStyle(pc);
      return {state: window.__TS_MINI_STATE,
              w: Math.round(r.width), h: Math.round(r.height),
              right: Math.round(innerWidth-r.right), bottom: Math.round(innerHeight-r.bottom),
              k: cs.getPropertyValue('--ts-mini-k').trim(),
              transition: cs.transitionProperty,
              btns: document.querySelectorAll('#ts-mini-btns button').length,
              placeholder: (function(){var p=document.querySelector('.player-placeholder');
                 return p?Math.round(p.getBoundingClientRect().height):-1;})(),
              playing: (function(){var v=document.querySelector('#player-container-id video');
                 return v?!v.paused:null;})()};
    })()""")

    # A button in the corner must land at a real touch size despite the scale.
    out["button_px"] = t.eval("""(function(){
      var b=document.querySelector('#ts-mini-btns button');
      if(!b) return null; var r=b.getBoundingClientRect();
      return {w: Math.round(r.width), h: Math.round(r.height)};
    })()""")

    # Play/pause: the icon has to follow the video, not our own click.
    out["pause_btn"] = t.eval("""(function(){
      var b=document.querySelector('#ts-mini-btns button');
      var v=document.querySelector('#player-container-id video');
      if(!b||!v) return null;
      var before=!v.paused;
      b.click();
      return {was_playing: before, now_paused: v.paused,
              icon: document.querySelector('#ts-mini-btns path').getAttribute('d').slice(0,6)};
    })()""")

    # A live drag: synthesize the touch stream and sample the scale midway.
    out["drag"] = t.eval("""(function(){
      window.__TS_MINI__.exit();
      var pc=document.getElementById('player-container-id');
      var r=pc.getBoundingClientRect();
      var x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
      function touch(type, ty){
        var t=new Touch({identifier:1,target:pc,clientX:x,clientY:ty});
        pc.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],
          changedTouches:[t],bubbles:true,cancelable:true}));
      }
      var samples=[];
      touch('touchstart', y);
      [10,25,40,60].forEach(function(d){ touch('touchmove', y+d);
        var cs=getComputedStyle(pc);
        samples.push({dy:d, k:+(cs.getPropertyValue('--ts-mini-k').trim()||1),
                      drag: document.documentElement.classList.contains('ts-mini-drag')}); });
      touch('touchmove', y+90);
      touch('touchend', y+90);
      return {samples: samples, state: window.__TS_MINI_STATE};
    })()""")

    time.sleep(0.6)
    out["after_drag"] = t.eval("""(function(){
      var pc=document.getElementById('player-container-id');
      var r=pc.getBoundingClientRect();
      return {state: window.__TS_MINI_STATE, w: Math.round(r.width),
              right: Math.round(innerWidth-r.right), bottom: Math.round(innerHeight-r.bottom)};
    })()""")

    # And the dismiss: fling it sideways, video must stop and the page recover.
    out["dismiss"] = t.eval("""(function(){
      var pc=document.getElementById('player-container-id');
      var v=document.querySelector('#player-container-id video');
      if(v&&v.paused){var p=v.play(); if(p&&p.catch)p.catch(function(){});}
      var r=pc.getBoundingClientRect();
      var y=Math.round(r.top+r.height/2), x0=Math.round(r.left+r.width/2);
      function touch(type, tx){
        var t=new Touch({identifier:2,target:pc,clientX:tx,clientY:y});
        pc.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],
          changedTouches:[t],bubbles:true,cancelable:true}));
      }
      touch('touchstart', x0);
      touch('touchmove', x0+40);
      touch('touchmove', x0+200);
      touch('touchend', x0+200);
      return {state_at_release: window.__TS_MINI_STATE};
    })()""")
    time.sleep(0.8)
    out["after_dismiss"] = t.eval("""(function(){
      var pc=document.getElementById('player-container-id');
      var v=document.querySelector('#player-container-id video');
      var ph=document.querySelector('.player-placeholder');
      return {state: window.__TS_MINI_STATE, paused: v?v.paused:null,
              opacity: getComputedStyle(pc).opacity,
              transform: pc.style.transform||'(none)',
              placeholder: ph?Math.round(ph.getBoundingClientRect().height):-1,
              gone_class: document.documentElement.className.indexOf('ts-mini')>=0,
              btns: document.querySelectorAll('#ts-mini-btns button').length};
    })()""")
    print(json.dumps(out, indent=1))

main()
