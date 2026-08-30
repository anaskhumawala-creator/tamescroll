import time
from gauntlet import pick
lau = pick("localhost:1420")
print("refresh:", lau.eval("""(async function(){
  try { const {invoke} = window.__TAURI__.core; return String(await invoke('refresh_rules')); }
  catch(e){ return 'err '+e; }
})()"""))
