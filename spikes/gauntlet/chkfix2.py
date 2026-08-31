import emu_cdp
t = emu_cdp.Tab(emu_cdp.page())
js = """(async()=>{
  const r = await fetch('/__tamescroll/gaze-page.js?v=1'); const s = await r.text();
  const NL = String.fromCharCode(10);
  const find=(x)=>s.indexOf(x)>=0;
  return {len:s.length,
    lit_btns_pill: find('#ts-mini-btns,.ts-gaze-pill'),
    lit_btns: find('ts-mini-btns'),
    gestureVerdict: find('gestureVerdict'),
    claimAxis: find('claimAxis'),
    lines: s.split(NL).length};
})()"""
print(t.eval(js))
