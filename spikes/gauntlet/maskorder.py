"""Pixel test of the mask LAYER ORDER, in the real WebView2, over the live player.

Draws two identical blurred overlays side by side on a paused frame: one
with the shipped list (base, base, hole) and one with the reversed list
(hole, base, base). If only the reversed one shows a sharp window, the
shipped order has never punched a hole.
"""
import json, time, sys
import gauntlet as G

tab = G.pick("youtube.com")
tab.eval("(function(){var v=document.querySelector('video');v.currentTime=%s;v.play();})()" % sys.argv[1])
time.sleep(3.5)
tab.eval("(function(){var v=document.querySelector('video');v.pause();})()")
time.sleep(0.6)
p = tab.eval(G.PROBE)
rect = p["rect"] if "rect" in p else None
r = tab.eval("""(function(){
  var host=document.querySelector('#movie_player'), v=document.querySelector('video');
  var vr=v.getBoundingClientRect();
  // hide the real overlays so only the test cells are in shot
  host.querySelectorAll('.ts-gaze-vregion-host').forEach(function(e){e.style.visibility='hidden';});
  document.querySelectorAll('.ts-maskspike').forEach(function(e){e.remove();});
  var W=Math.round(vr.width*0.22), H=Math.round(vr.height*0.5);
  function cell(left, order){
    var d=document.createElement('div');
    d.className='ts-maskspike';
    d.style.cssText='position:absolute;z-index:2147483000;pointer-events:none;left:'+left+'px;top:'+Math.round(vr.height*0.25)+'px;width:'+W+'px;height:'+H+'px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);';
    var full=W+'px '+H+'px';
    var hw=Math.round(W*0.5), hh=Math.round(H*0.35);
    var hole='radial-gradient(ellipse closest-side at center, #000 0%, #000 66%, rgba(0,0,0,0) 100%)';
    var hg='linear-gradient(to right, rgba(0,0,0,0) 0px, #000 12px, #000 calc(100% - 12px), rgba(0,0,0,0) 100%)';
    var vg='linear-gradient(to bottom, rgba(0,0,0,0) 0px, #000 12px, #000 calc(100% - 12px), rgba(0,0,0,0) 100%)';
    var hpos=Math.round((W-hw)/2)+'px '+Math.round((H-hh)/2)+'px';
    var img,size,pos,comp;
    if(order==='shipped'){
      img=[hg,vg,hole]; size=[full,full,hw+'px '+hh+'px']; pos=['0px 0px','0px 0px',hpos];
      comp=['source-over','source-in','xor'];
    } else {
      img=[hole,vg,hg]; size=[hw+'px '+hh+'px',full,full]; pos=[hpos,'0px 0px','0px 0px'];
      comp=['xor','source-in','source-over'];
    }
    d.style.webkitMaskImage=img.join(','); d.style.maskImage=img.join(',');
    d.style.webkitMaskSize=size.join(','); d.style.maskSize=size.join(',');
    d.style.webkitMaskPosition=pos.join(','); d.style.maskPosition=pos.join(',');
    d.style.webkitMaskRepeat='no-repeat,no-repeat,no-repeat'; d.style.maskRepeat='no-repeat,no-repeat,no-repeat';
    d.style.webkitMaskComposite=comp.join(','); d.style.maskComposite=comp.join(',');
    host.appendChild(d);
    return d;
  }
  cell(Math.round(vr.width*0.06),'shipped');
  cell(Math.round(vr.width*0.36),'reversed');
  var got=document.querySelectorAll('.ts-maskspike');
  return JSON.stringify({n:got.length, comp:[got[0].style.webkitMaskComposite, got[1].style.webkitMaskComposite],
                         rect:{x:vr.left,y:vr.top,w:vr.width,h:vr.height}});
})()""")
print(r)
info = json.loads(r)
time.sleep(0.5)
tab.clip_shot("runs/maskorder-webview2.png", info["rect"])
tab.eval("(function(){document.querySelectorAll('.ts-maskspike').forEach(function(e){e.remove();});"
         "document.querySelector('#movie_player').querySelectorAll('.ts-gaze-vregion-host').forEach(function(e){e.style.visibility='';});})()")
print("shot runs/maskorder-webview2.png")
