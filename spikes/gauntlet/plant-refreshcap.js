// REFRESH_CAP_HZ 60 arm (TS_ARMS plant for probe_drops_ab.py): pin the OTA tuning
// payload on every new document so one build runs this dial without a
// rules push. Every other tunable keeps its module default.
(function () {
  try {
    Object.defineProperty(window, '__TS_GAZE_TUNING__', {
      get: function () { return '{"REFRESH_CAP_HZ":60}'; },
      set: function () {},
      configurable: false,
    });
    window.__TS_PLANT_refreshcap = true;
  } catch (e) {}
})();
