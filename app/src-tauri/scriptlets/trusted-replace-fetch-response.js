function trustedReplaceFetchResponse(rawPattern, rawReplacement, propsToMatch) {
  // Clean-room implementation of the `trusted-replace-fetch-response`
  // scriptlet semantics (MPL-2.0, this project). Wraps window.fetch; for
  // responses whose request URL matches `propsToMatch`, rewrites the
  // body text by pattern → replacement. Pattern is a /regex/flags form
  // or a literal (replaced once, like uBO's non-global default);
  // replacement supports $1-style backreferences via String.replace.
  // This is what keeps YouTube's /player responses ad-free on SPA
  // navigations, where the initial-page `set` pins never see the data.
  "use strict";
  if (typeof window.fetch !== "function" || !rawPattern) return;

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

  var realFetch = window.fetch;
  window.fetch = function (input) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var call = realFetch.apply(this, arguments);
    if (!matchesUrl(String(url))) return call;
    return call.then(function (response) {
      return response
        .clone()
        .text()
        .then(function (text) {
          var body = text.replace(pattern, replacement);
          if (body === text) return response;
          return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        })
        .catch(function () { return response; });
    });
  };
}
