import json, emu_cdp
t = emu_cdp.Tab(emu_cdp.page())
print(t.eval("""(()=>{
  const has = typeof window.__TS_MINI_OUR_CONTROLS!=='undefined';
  const p=document.querySelector('#movie_player');
  if(!p) return {err:'no player', url:location.href};
  // every element inside the player that a finger can land on
  const out=[];
  p.querySelectorAll('*').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.width<12||r.height<12) return;
    const cs=getComputedStyle(el);
    if(cs.pointerEvents==='none') return;
    // only leaf-ish interactive things
    const tag=el.tagName.toLowerCase();
    const cls=(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className)||'';
    const interactive = tag==='button'||el.getAttribute('role')==='button'||/ytp-|player-controls|scrubber|progress|seek/i.test(String(cls));
    if(!interactive) return;
    out.push({tag, cls:String(cls).slice(0,60), id:el.id||'', x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});
  });
  return {url:location.href, playerBox:(()=>{const r=p.getBoundingClientRect();return [r.x|0,r.y|0,r.width|0,r.height|0]})(), n:out.length, ctrls:out.slice(0,40)};
})()"""))
