// DELAY_MS 1500 arm (TS_PLANT_FILE for probe_events.py): pin the OTA
// tuning payload to DELAY_MS 1500 on every new document, so one build
// runs the longer delay line without pushing rules. Every other tunable
// keeps its module default, which rules/tuning.json equals.
(function () {
  try {
    Object.defineProperty(window, '__TS_GAZE_TUNING__', {
      get: function () { return '{"DELAY_MS":1500}'; },
      set: function () {},
      configurable: false,
    });
    window.__TS_PLANT_delay1500 = true;
  } catch (e) {}
})();
