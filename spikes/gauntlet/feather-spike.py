"""Pixel-test the feathered mask constructions in the REAL WebView.

S2's lesson, paid for once: CSS.supports returns true for constructions
that paint NOTHING here. Only a screenshot decides. Three patches are
drawn side by side over the same paused frame:

  A  what ships today -- hard rectangular patch, hard rectangular hole
  B  hard patch edge, FEATHERED hole (radial falloff)
  C  feathered patch edge (two linear gradients composited `intersect`)
     plus the feathered hole

Owner 2026-08-26: "the cropping through the square is just not working
correctly ... rather we could use translucent edges blur ... with the
edges being more towards transparency".
"""
import sys, time
from gauntlet import Tab, pick, open_platform

JS = r"""
(function () {
  var host = document.querySelector('#movie_player');
  var v = document.querySelector('video');
  if (!host || !v) return 'no player';
  v.pause();
  // The live pipeline's own patches sit over the same frame and made the
  // first spike unreadable. Take them out for the duration of the test --
  // the renderer re-creates them on the next setTracks.
  Array.prototype.forEach.call(host.querySelectorAll('.ts-spike'), function (n) { n.remove(); });
  Array.prototype.forEach.call(host.querySelectorAll('.ts-gaze-vregion-host'), function (n) { n.remove(); });
  var vr = v.getBoundingClientRect();
  var hr = host.getBoundingClientRect();
  var W = 260, H = 300, TOP = 60;
  var F = 26;            // feather width, px
  function mk(left) {
    var d = document.createElement('div');
    d.className = 'ts-spike';
    d.style.cssText =
      'position:absolute;top:' + TOP + 'px;left:' + left + 'px;width:' + W + 'px;height:' + H + 'px;' +
      'pointer-events:none;z-index:9999;' +
      'backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);';
    host.appendChild(d);
    return d;
  }
  var holeW = 110, holeH = 90, holeX = 70, holeY = 90;

  // A -- today
  var a = mk(40);
  a.style.maskImage = 'linear-gradient(#000,#000),linear-gradient(#000,#000)';
  a.style.webkitMaskImage = a.style.maskImage;
  a.style.maskSize = W + 'px ' + H + 'px,' + holeW + 'px ' + holeH + 'px';
  a.style.webkitMaskSize = a.style.maskSize;
  a.style.maskPosition = '0px 0px,' + holeX + 'px ' + holeY + 'px';
  a.style.webkitMaskPosition = a.style.maskPosition;
  a.style.maskRepeat = 'no-repeat'; a.style.webkitMaskRepeat = 'no-repeat';
  a.style.maskComposite = 'exclude'; a.style.webkitMaskComposite = 'xor';

  // B -- feathered hole. The hole box is grown so the FULLY revealed core
  // still matches A's hole; the ramp lives in the added margin.
  var g = 1.5, bw = holeW * g, bh = holeH * g;
  var bx = holeX - (bw - holeW) / 2, by = holeY - (bh - holeH) / 2;
  var b = mk(340);
  b.style.maskImage =
    'linear-gradient(#000,#000),' +
    'radial-gradient(ellipse closest-side at center, #000 0%, #000 66%, rgba(0,0,0,0) 100%)';
  b.style.webkitMaskImage = b.style.maskImage;
  b.style.maskSize = W + 'px ' + H + 'px,' + bw + 'px ' + bh + 'px';
  b.style.webkitMaskSize = b.style.maskSize;
  b.style.maskPosition = '0px 0px,' + bx + 'px ' + by + 'px';
  b.style.webkitMaskPosition = b.style.maskPosition;
  b.style.maskRepeat = 'no-repeat'; b.style.webkitMaskRepeat = 'no-repeat';
  b.style.maskComposite = 'exclude'; b.style.webkitMaskComposite = 'xor';

  // C -- feathered OUTER edge too: a horizontal fade INTERSECTed with a
  // vertical fade gives a rectangle with all four edges soft, then the
  // hole is excluded from it.
  var c = mk(640);
  c.style.maskImage =
    'linear-gradient(to right, rgba(0,0,0,0) 0px, #000 ' + F + 'px, #000 calc(100% - ' + F + 'px), rgba(0,0,0,0) 100%),' +
    'linear-gradient(to bottom, rgba(0,0,0,0) 0px, #000 ' + F + 'px, #000 calc(100% - ' + F + 'px), rgba(0,0,0,0) 100%),' +
    'radial-gradient(ellipse closest-side at center, #000 0%, #000 66%, rgba(0,0,0,0) 100%)';
  c.style.webkitMaskImage = c.style.maskImage;
  c.style.maskSize = W + 'px ' + H + 'px,' + W + 'px ' + H + 'px,' + bw + 'px ' + bh + 'px';
  c.style.webkitMaskSize = c.style.maskSize;
  c.style.maskPosition = '0px 0px,0px 0px,' + bx + 'px ' + by + 'px';
  c.style.webkitMaskPosition = c.style.maskPosition;
  c.style.maskRepeat = 'no-repeat'; c.style.webkitMaskRepeat = 'no-repeat';
  // One operator PER LAYER. The first spike passed two for three layers,
  // so the list repeated and the hole layer got `intersect` instead of
  // `exclude` -- computed style read back "source-in, xor, source-in".
  c.style.maskComposite = 'add,intersect,exclude';
  c.style.webkitMaskComposite = 'source-over,source-in,xor';

  return JSON.stringify({
    hostRect: [hr.left, hr.top, hr.width, hr.height],
    videoRect: [vr.left, vr.top, vr.width, vr.height],
    maskCompositeC: getComputedStyle(c).maskComposite || getComputedStyle(c).webkitMaskComposite,
    maskImageLenC: (getComputedStyle(c).maskImage || '').length
  });
})()
"""

def main(out, gender, video, start):
    tab = open_platform(gender)
    tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % video)
    time.sleep(20)
    tab = pick("youtube.com")
    tab.eval("(function(){var v=document.querySelector('video');v.currentTime=%d;v.play();})()" % start)
    time.sleep(3)
    info = tab.eval(JS)
    print(info)
    time.sleep(1.0)
    hr = tab.eval("(function(){var r=document.querySelector('#movie_player').getBoundingClientRect();return JSON.stringify([r.left,r.top,r.width,r.height]);})()")
    import json as _j
    l, t, w, h = _j.loads(hr)
    tab.clip_shot(out, {"x": l, "y": t, "w": w, "h": min(h, 460)})
    print("wrote", out)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]))
