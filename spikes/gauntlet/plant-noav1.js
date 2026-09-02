// NO_AV1 1 arm (TS_ARMS plant for probe_drops_ab.py): pin the OTA tuning
// payload on every new document so one build runs this dial without a
// rules push. Every other tunable keeps its module default.
(function () {
  try {
    Object.defineProperty(window, '__TS_GAZE_TUNING__', {
      get: function () { return '{"NO_AV1":1}'; },
      set: function () {},
      configurable: false,
    });
    window.__TS_PLANT_noav1 = true;
  } catch (e) {}
})();
