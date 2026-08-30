import time
from gauntlet import pick, targets
UA=("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36")
lau=pick("localhost:1420")
# Turn the Home feed surface back ON exactly as the settings pane does.
print("before:", lau.eval("localStorage.getItem('tamescroll.shown')"))
print("click:", lau.eval(r"""(function(){
  var out=[];
  document.querySelectorAll('[data-surface]').forEach(function(el){
    out.push(el.getAttribute('data-surface')+'|'+el.tagName+'|'+(el.textContent||'').trim().slice(0,40));
  });
  return out.join('\n') || 'no [data-surface] elements';
})()"""))
