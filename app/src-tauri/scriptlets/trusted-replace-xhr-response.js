function trustedReplaceXhrResponse(rawPattern, rawReplacement, propsToMatch) {
  // Clean-room implementation of the `trusted-replace-xhr-response`
  // scriptlet semantics (MPL-2.0, this project). Patches the
  // XMLHttpRequest prototype accessors so that responses to matching
  // URLs are rewritten pattern → replacement before ANY consumer reads
  // them — prototype-level interception is ordering-safe where an event
  // listener would race the page's own handlers.
  "use strict";
  if (typeof XMLHttpRequest === "undefined" || !rawPattern) return;

  function compile(spec) {
    var lastSlash = spec.lastIndexOf("/");
    if (spec.charAt(0) === "/" && lastSlash > 0) {
      try {
        return new RegExp(spec.slice(1, lastSlash), spec.slice(lastSlash + 1));
      } catch (e) {}
    }
    return new RegExp(spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }

  var pattern = rawPattern === "*" ? /[\s\S]*/ : compile(String(rawPattern));
  var replacement = String(rawReplacement || "");

  var urlSpec = String(propsToMatch || "");
  if (urlSpec.indexOf("url:") === 0) urlSpec = urlSpec.slice(4);
  var matchesUrl;
  var us = urlSpec.lastIndexOf("/");
  if (urlSpec.charAt(0) === "/" && us > 0) {
    try {
      var re = new RegExp(urlSpec.slice(1, us), urlSpec.slice(us + 1));
      matchesUrl = function (u) { return re.test(u); };
    } catch (e) {}
  }
  if (!matchesUrl) {
    matchesUrl = urlSpec
      ? function (u) { return u.indexOf(urlSpec) !== -1; }
      : function () { return true; };
  }

  var proto = XMLHttpRequest.prototype;
  var realOpen = proto.open;
  proto.open = function (method, url) {
    try { this.__tamescroll_url = String(url); } catch (e) {}
    return realOpen.apply(this, arguments);
  };

  function wrapAccessor(name) {
    var desc = Object.getOwnPropertyDescriptor(proto, name);
    if (!desc || typeof desc.get !== "function") return;
    Object.defineProperty(proto, name, {
      configurable: true,
      enumerable: desc.enumerable,
      get: function () {
        var value = desc.get.call(this);
        if (typeof value !== "string") return value;
        if (!this.__tamescroll_url || !matchesUrl(this.__tamescroll_url)) return value;
        try { return value.replace(pattern, replacement); } catch (e) { return value; }
      },
      set: desc.set
    });
  }

  wrapAccessor("responseText");
  wrapAccessor("response");
}
