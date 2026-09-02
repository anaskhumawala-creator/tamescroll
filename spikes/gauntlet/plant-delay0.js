// delay0 arm (TS plant): pin the OTA tuning payload on every new document.
(function () {
  try {
    Object.defineProperty(window, '__TS_GAZE_TUNING__', {
      get: function () { return '{"DELAY_MS":0}'; },
      set: function () {},
      configurable: false,
    });
    window.__TS_PLANT_delay0 = true;
  } catch (e) {}
})();
