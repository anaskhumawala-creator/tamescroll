function setConstant(chain, rawValue) {
  // Clean-room implementation of the `set-constant` / `set` scriptlet
  // semantics (MPL-2.0, this project). Pins a window property chain to a
  // constant, surviving late and repeated assignment — YouTube assigns
  // ytInitialPlayerResponse after we run, so plain assignment would miss.
  // Unsupported value forms do nothing rather than risk breaking the page.
  "use strict";
  if (typeof chain !== "string" || chain.length === 0) return;
  var value;
  switch (rawValue) {
    case "undefined": value = undefined; break;
    case "null": value = null; break;
    case "true": value = true; break;
    case "false": value = false; break;
    case "": case "''": value = ""; break;
    case "[]": value = []; break;
    case "{}": value = {}; break;
    case "noopFunc": value = function () {}; break;
    case "trueFunc": value = function () { return true; }; break;
    case "falseFunc": value = function () { return false; }; break;
    default:
      if (/^-?\d+(\.\d+)?$/.test(rawValue)) { value = Number(rawValue); }
      else { return; }
  }
  var parts = chain.split(".");

  function pin(owner, index) {
    var prop = parts[index];
    if (index === parts.length - 1) {
      try {
        Object.defineProperty(owner, prop, {
          get: function () { return value; },
          set: function () {},
          configurable: true
        });
      } catch (e) {}
      return;
    }
    var existing;
    try { existing = owner[prop]; } catch (e) { return; }
    if (existing !== undefined && existing !== null && typeof existing === "object") {
      pin(existing, index + 1);
      return;
    }
    // Link not there yet: trap its assignment, then continue the walk on
    // whatever value the page assigns (re-pinning on every reassignment).
    var stored = existing;
    try {
      Object.defineProperty(owner, prop, {
        get: function () { return stored; },
        set: function (v) {
          stored = v;
          if (v !== undefined && v !== null && typeof v === "object") {
            pin(v, index + 1);
          }
        },
        configurable: true
      });
    } catch (e) {}
  }

  pin(window, 0);
}
