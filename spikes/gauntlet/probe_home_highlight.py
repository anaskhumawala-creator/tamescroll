"""His 2026-09-03 report: on the HOME FEED, scrolling "highlights" each
video under the finger.

    python probe_home_highlight.py <cdpPort> [mode]

Drives a real touch scroll on m.youtube home and records, in page:
every touchmove's defaultPrevented (bubble phase at window, so it runs
after every page handler), the elements matching :active on each frame
with the background they compute, the scroll offset per frame (so a
scroll that starts LATE is visible), and every class/style attribute
change under the finger. Banks home-highlight-<mode>-<ts>.json and
writes one mid-gesture screenshot.
"""
import base64
import json
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
MODE = sys.argv[2] if len(sys.argv) > 2 else "smart"

INSTALL = """(function(){
  var H = { moves: [], frames: [], muts: [], t0: performance.now() };
  window.__HL = H;
  window.addEventListener('touchmove', function(e){
    H.moves.push({ t: Math.round(performance.now()-H.t0), p: e.defaultPrevented?1:0 });
  }, { passive: true });
  window.addEventListener('touchstart', function(e){
    var el = e.target;
    H.target = el && el.tagName ? (el.tagName + '.' + (el.className||'').toString().slice(0,60)) : null;
    var item = el && el.closest ? el.closest('ytm-rich-item-renderer,ytm-video-with-context-renderer,ytm-media-item') : null;
    H.item = item ? item.tagName : null;
    if (item) {
      try {
        var mo = new MutationObserver(function(rs){
          for (var i=0;i<rs.length && H.muts.length<60;i++) {
            var r = rs[i];
            H.muts.push({ t: Math.round(performance.now()-H.t0), a: r.attributeName,
                          n: r.target.tagName,
                          v: String((r.target.getAttribute&&r.target.getAttribute(r.attributeName))||'').slice(0,80) });
          }
        });
        mo.observe(item, { attributes: true, subtree: true,
                           attributeFilter: ['class','style','hidden','aria-selected'] });
        H.mo = mo;
      } catch (e) {}
    }
  }, { passive: true, capture: true });
  function frame(){
    var a = document.querySelectorAll(':active');
    var last = a.length ? a[a.length-1] : null;
    var bg = null, hl = null;
    if (last) {
      var cs = getComputedStyle(last);
      bg = cs.backgroundColor;
      hl = cs.webkitTapHighlightColor || null;
    }
    if (H.frames.length < 400) {
      H.frames.push({ t: Math.round(performance.now()-H.t0),
                      y: Math.round(window.scrollY),
                      n: a.length,
                      el: last ? (last.tagName + (last.className ? '.' + String(last.className).slice(0,40) : '')) : null,
                      bg: bg, hl: hl });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return 1;
})()"""


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(5)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'%s',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""" % MODE)
    time.sleep(12)

    t = Tab(page(port=PORT))
    t.cmd("Page.enable"); t.cmd("Runtime.enable")
    pre = t.eval("""(function(){
      var items = document.querySelectorAll('ytm-rich-item-renderer');
      var it = items[2] || items[0];
      var r = it ? it.getBoundingClientRect() : null;
      return { url: location.href, items: items.length, w: innerWidth, h: innerHeight,
               rect: r ? [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)] : null,
               bundle: window.__TS_GAZE_BUNDLE__ || null };})()""")
    print("pre", json.dumps(pre))
    if not pre or not pre.get("rect"):
        print("NO FEED ITEMS -- nothing to scroll"); return
    t.eval(INSTALL)

    L, T, W, Hh = pre["rect"]
    cx, cy = L + W // 2, max(T + Hh // 2, 200)
    # a slow, deliberate drag up: the gesture he is making
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": cx, "y": cy}])
    shot = None
    for i in range(1, 25):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x": cx, "y": cy - i * 12}])
        if i == 4:
            try:
                shot = t.cmd("Page.captureScreenshot", format="png")["result"]["data"]
            except Exception as e:
                print("shot failed", e)
        time.sleep(0.02)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.5)

    out = t.eval("""(function(){
      var H = window.__HL || {};
      try { if (H.mo) H.mo.disconnect(); } catch(e) {}
      var f = H.frames || [];
      var act = f.filter(function(x){ return x.n > 0; });
      return { target: H.target, item: H.item,
               moves: (H.moves||[]).length,
               prevented: (H.moves||[]).filter(function(m){return m.p;}).length,
               firstMoveT: (H.moves||[]).length ? H.moves[0].t : null,
               frames: f.length,
               activeFrames: act.length,
               activeSample: act.slice(0, 12),
               scrolled: f.length ? (f[f.length-1].y - f[0].y) : null,
               yFirst: f.length ? f[0].y : null, yLast: f.length ? f[f.length-1].y : null,
               muts: (H.muts||[]).slice(0, 30) };})()""")
    print(json.dumps(out, indent=1))
    ts = int(time.time())
    with open("home-highlight-%s-%d.json" % (MODE, ts), "w") as fh:
        json.dump({"pre": pre, "run": out}, fh, indent=1)
    if shot:
        with open("home-highlight-%s-%d.png" % (MODE, ts), "wb") as fh:
            fh.write(base64.b64decode(shot))
        print("shot home-highlight-%s-%d.png" % (MODE, ts))


main()
