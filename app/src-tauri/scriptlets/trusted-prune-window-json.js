function trustedPruneWindowJson(propName) {
  // Clean-room inline-JSON pruner (MPL-2.0, this project).
  //
  // Removes dotted paths from a global object AS IT IS ASSIGNED, by
  // installing an accessor on `window` before the page's own inline
  // script runs.
  //
  // Why this exists (measured 2026-08-25): blocking ad REQUESTS kills
  // the tracking and serving calls, but not the pre-roll video itself.
  // That stream comes from googlevideo.com, the same origin as the real
  // content stream, so no URL rule can touch it without breaking all
  // playback. And on a hard navigation there is no client-side
  // /youtubei/v1/player request to reshape either — YouTube embeds the
  // whole player response in the page HTML as `ytInitialPlayerResponse`
  // (measured: 4 entries in `adSlots`). The ad slots have to come out of
  // that object before the player reads it, which means before the
  // inline script that assigns it — hence an accessor, not a timer.
  //
  // Provenance: the idea of pruning ad fields from a player response is
  // public knowledge and predates every adblocker implementation of it;
  // this code is written from the shape of the object as observed live,
  // not adapted from uBO/AdGuard sources.
  // Paths come from `arguments`, NOT a rest parameter: a rest parameter
  // makes "use strict" a SyntaxError, and this whole file is injected as
  // source into a page — a parse error means the scriptlet silently
  // never runs. Caught by the unit test before the browser saw it.
  "use strict";
  if (typeof propName !== "string" || !propName) return;
  var wanted = [];
  for (var a = 1; a < arguments.length; a++) {
    if (typeof arguments[a] === "string" && arguments[a].length > 0) wanted.push(arguments[a]);
  }
  if (!wanted.length) return;

  function prune(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    for (var i = 0; i < wanted.length; i++) {
      var tokens = wanted[i].split(".");
      var node = obj;
      var ok = true;
      for (var t = 0; t < tokens.length - 1; t++) {
        node = node[tokens[t]];
        if (node === null || typeof node !== "object") {
          ok = false;
          break;
        }
      }
      if (ok) delete node[tokens[tokens.length - 1]];
    }
    return obj;
  }

  // If the property is already there (a late injection, or a second
  // scriptlet pass), prune what exists rather than doing nothing.
  var current;
  try {
    current = window[propName];
  } catch (e) {}
  if (current !== undefined) current = prune(current);

  // ANOTHER SCRIPTLET MAY ALREADY OWN THIS PROPERTY, and clobbering it is
  // how a pre-roll got through to the owner twice (measured 2026-08-25).
  // `set-constant` walks a dotted chain and, finding the first link not
  // yet assigned, installs its OWN accessor on `window.<propName>` — so
  // whichever of the two scriptlets the engine emits LAST silently
  // destroys the other's interception. On a watch page the vendored
  // `set-constant ytInitialPlayerResponse.playerAds` rule is emitted
  // after this one, so this pruner never saw a single assignment:
  // `adSlots` still held 5 entries and the ad played.
  //
  // Composing rather than replacing fixes the whole class, in both
  // orders: prune on the way in, then hand the CLEANED value to whoever
  // was here first, and read back through their getter so their view and
  // ours can never diverge.
  var prev;
  try {
    prev = Object.getOwnPropertyDescriptor(window, propName);
  } catch (e) {}
  if (prev && prev.configurable && typeof prev.get === "function" && typeof prev.set === "function") {
    var prevGet = prev.get;
    var prevSet = prev.set;
    try {
      Object.defineProperty(window, propName, {
        configurable: true,
        get: function () {
          return prevGet.call(window);
        },
        set: function (value) {
          prevSet.call(window, prune(value));
        },
      });
    } catch (e) {}
    return;
  }

  try {
    Object.defineProperty(window, propName, {
      configurable: true,
      get: function () {
        return current;
      },
      set: function (value) {
        // Prune on the way IN, so every reader — including the one that
        // decides whether to play an ad — sees the cleaned object. A
        // getter that pruned on read would be too late: the page can
        // hold its own reference from before the first read.
        current = prune(value);
      },
    });
  } catch (e) {
    // Non-configurable already, or a hardened page. Leave the page
    // working rather than half-patched: an ad is better than a blank
    // player.
  }
}
