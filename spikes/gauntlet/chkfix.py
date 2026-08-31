import emu_cdp
t = emu_cdp.Tab(emu_cdp.page())
print(t.eval("""(async()=>{
  // our own bundle is served same-origin from the interceptor
  const u = (window.__TS_SYNTH_URL||'/__tamescroll/gaze-page.js?v=1');
  try{
    const r = await fetch(u); const s = await r.text();
    return {len:s.length,
            inOurControls: s.indexOf('inOurControls')>=0,
            OUR_CONTROLS: s.indexOf('OUR_CONTROLS')>=0,
            pillSel: s.indexOf('.ts-gaze-pill')>=0,
            claim16: /CLAIM_PX\s*=\s*16/.test(s)};
  }catch(e){ return {err:String(e)} }
})()"""))
