// duty4 arm (TS plant): pin the OTA tuning payload on every new document.
(function () {
  try {
    Object.defineProperty(window, '__TS_GAZE_TUNING__', {
      get: function () { return '{"VERDICT_DUTY":4}'; },
      set: function () {},
      configurable: false,
    });
    window.__TS_PLANT_duty4 = true;
  } catch (e) {}
})();
