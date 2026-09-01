# Does hiding the <img> take the HOME BUTTON with it? The tap target is a
# <button>, not a link, and its width may come entirely from the image.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable")
READ = """(function(){
  function box(e){ if(!e) return null; var r=e.getBoundingClientRect();
    return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]; }
  var b=document.querySelector('button.mobile-topbar-header-endpoint');
  var host=document.querySelector('ytm-home-logo');
  var out={btn:box(b), host:box(host), label:b?(b.getAttribute('aria-label')||''):null};
  if(b){var r=b.getBoundingClientRect();
    if(r.width>1&&r.height>1){var el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      out.hit=el?el.tagName.toLowerCase():null;
      out.inBtn=!!(el&&el.closest&&el.closest('button')===b);}}
  return out;})()"""
before = t.eval(READ)
t.eval("""(function(){var s=document.createElement('style'); s.id='ts-probe-hide';
  s.textContent='img.mobile-topbar-logo{display:none !important}';
  document.documentElement.appendChild(s); return 1;})()""")
time.sleep(0.6)
afterImg = t.eval(READ)
t.eval("""(function(){document.getElementById('ts-probe-hide').textContent=
  'ytm-logo-entity{display:none !important}'; return 1;})()""")
time.sleep(0.6)
afterEntity = t.eval(READ)
t.eval("(function(){var s=document.getElementById('ts-probe-hide'); if(s) s.remove(); return 1;})()")
print(json.dumps({"before":before,"hideImg":afterImg,"hideEntity":afterEntity}, indent=1))
