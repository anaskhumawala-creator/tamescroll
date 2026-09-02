"""Capture the DEVICE's presented frame at given media times, for looking
at a geometry question offline.

    python probe_frame_capture.py <cdpPort> <outDir> <t1> [t2 ...]

Page.captureScreenshot cannot see the video surface (measured
2026-09-02: a black player with the chrome around it), so this reads
the delay presenter's own canvas (`.ts-gaze-delay`, a 2D canvas painted
from the hidden video -- same-origin MSE, not tainted) via toDataURL,
plus every live patch box normalised to the VIDEO rect, and draws the
boxes on the saved JPEG offline. The picture exists only on the phone
and in the saved file. Prints presented media time + boxes so a frame
joins back to a banked events run.
"""
import base64
import json
import os
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1])
OUT = sys.argv[2]
TIMES = [float(x) for x in sys.argv[3:]]
os.makedirs(OUT, exist_ok=True)

GRAB = """(function(){
  var s=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;
  var v=document.querySelector('#movie_player video'); var r=v?v.getBoundingClientRect():null;
  var c=document.querySelector('.ts-gaze-delay'); var url=null; try{ url=c?c.toDataURL('image/jpeg',0.8):null; }catch(e){ url='ERR:'+e; }
  var out=[]; var n=document.querySelectorAll('.ts-gaze-vregion-clip > *');
  for(var i=0;i<n.length;i++){ var cs=getComputedStyle(n[i]); if(cs.display==='none')continue; var b=n[i].getBoundingClientRect(); if(b.width<1||!r||!r.width)continue;
    out.push([(b.left-r.left)/r.width,(b.top-r.top)/r.height,(b.right-r.left)/r.width,(b.bottom-r.top)/r.height]); }
  return JSON.stringify({t:v?v.currentTime:null, pm:s?s.presentedMediaTime:null, video:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null, canvas:c?[c.width,c.height]:null, patches:out, url:url});
})()"""


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    for m in TIMES:
        t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.muted=true; v.currentTime=%f; v.play();} return 1;})()" % (m - 2.5))
        time.sleep(4.5)
        t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.pause();} return 1;})()")
        time.sleep(0.6)
        raw = t.eval(GRAB)
        info = json.loads(raw) if isinstance(raw, str) else (raw or {})
        url = info.pop("url", None)
        name = os.path.join(OUT, "frame-%06.1f.jpg" % m)
        if url and url.startswith("data:"):
            with open(name, "wb") as f:
                f.write(base64.b64decode(url.split(",", 1)[1]))
            try:
                from PIL import Image, ImageDraw
                im = Image.open(name).convert("RGB")
                dr = ImageDraw.Draw(im)
                W, H = im.size
                for b in info.get("patches", []):
                    dr.rectangle([b[0] * W, b[1] * H, b[2] * W, b[3] * H], outline=(255, 0, 0), width=3)
                im.save(name, quality=85)
            except Exception as e:  # PIL absent: the raw frame is still saved
                info["draw"] = str(e)
        else:
            info["url"] = (url or "")[:80]
        print(name, json.dumps(info))
    t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.play();} return 1;})()")


if __name__ == "__main__":
    main()
