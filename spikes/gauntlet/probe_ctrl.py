import time, json
from gauntlet import Tab, pick
lau = pick("localhost:1420")
print("modes:", lau.eval("""(function(){
  var out=[];
  document.querySelectorAll('[id*=mode] .toggle-opt, #gaze-mode .toggle-opt, .toggle-opt').forEach(function(b){
    out.push((b.parentElement.getAttribute('aria-label')||b.parentElement.id||'?')+' :: '+b.dataset.value+' :: '+b.textContent.trim());
  });
  return JSON.stringify(out.slice(0,14));
})()"""))
print("ls:", lau.eval("JSON.stringify(Object.keys(localStorage).filter(function(k){return k.indexOf('tamescroll')===0;}).map(function(k){return k+'='+localStorage.getItem(k);}))"))
