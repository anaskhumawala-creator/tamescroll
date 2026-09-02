// Task 5 kill-switch arm (TS_PLANT_FILE for probe_latency_ab.py): pin the
// OTA tuning payload the app injects to CUT_PERSON_LOOK":1 on every new
// document, so the same build runs with the native engine adopted and
// ready but never USED -- the WebGL worker carries the player exactly as
// 1092 did. The setter swallows the app's own assignment; every other
// tunable keeps its module default, which rules/tuning.json equals.
(function () {
  try {
    Object.defineProperty(window, '__TS_GAZE_TUNING__', {
      get: function () { return '{"CUT_PERSON_LOOK":1}'; },
      set: function () {},
      configurable: false,
    });
    window.__TS_PLANT_cutlook = true;
  } catch (e) {}
})();
