// solid arm (TS plant): patches drawn as solid black, no backdrop blur, so
// the drops delta against the control arm is the blur filter's own cost.
(function () {
  function inject() {
    try {
      if (document.getElementById('ts-plant-solid')) return;
      var st = document.createElement('style');
      st.id = 'ts-plant-solid';
      st.textContent = '.ts-gaze-vregion-clip > div{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:#000!important;}';
      (document.head || document.documentElement).appendChild(st);
      window.__TS_PLANT_solid = true;
    } catch (e) {}
  }
  inject();
  document.addEventListener('DOMContentLoaded', inject);
})();
