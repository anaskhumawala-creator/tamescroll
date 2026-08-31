import emu_cdp
t = emu_cdp.Tab(emu_cdp.page())
print(t.eval("""(()=>{
  const s=(window.__TS_GAZE_SRC||'');
  return {bundleMarker: window.__TS_GAZE_BUNDLE__||null,
          mode: window.__TS_GAZE_MODE||null,
          hasPill: !!document.querySelector('.ts-gaze-pill'),
          player: !!document.querySelector('#movie_player')};
})()"""))
