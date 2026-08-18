function jsonPruneFetchResponse(rawPaths, rawRequired, name1, value1, name2, value2) {
  // Clean-room implementation of the `json-prune-fetch-response`
  // scriptlet semantics (MPL-2.0, this project). Wraps window.fetch; for
  // responses whose request URL matches the optional `propsToMatch`
  // named argument, parses the JSON body, deletes the given property
  // paths (same token rules as json-prune) and returns a rebuilt
  // Response. Anything unparseable passes through untouched.
  "use strict";
  var paths = String(rawPaths || "").split(/ +/).filter(function (p) {
    return p && p !== "important" && p !== "legacyImportant";
  });
  if (paths.length === 0 || typeof window.fetch !== "function") return;
  var required = String(rawRequired || "").split(/ +/).filter(Boolean);

  var urlSpec = "";
  var named = [name1, value1, name2, value2];
  for (var n = 0; n + 1 < named.length; n += 2) {
    if (named[n] === "propsToMatch") urlSpec = String(named[n + 1] || "");
  }
  if (urlSpec.indexOf("url:") === 0) urlSpec = urlSpec.slice(4);

  var matchesUrl;
  var lastSlash = urlSpec.lastIndexOf("/");
  if (urlSpec.charAt(0) === "/" && lastSlash > 0) {
    try {
      var re = new RegExp(urlSpec.slice(1, lastSlash), urlSpec.slice(lastSlash + 1));
      matchesUrl = function (u) { return re.test(u); };
    } catch (e) {}
  }
  if (!matchesUrl) {
    matchesUrl = urlSpec
      ? function (u) { return u.indexOf(urlSpec) !== -1; }
      : function () { return true; };
  }

  function collect(root, tokens, index, out) {
    if (root === null || typeof root !== "object") return;
    var token = tokens[index];
    var last = index === tokens.length - 1;
    if (token === "*" || token === "[]" || token === "[-]") {
      var keys = Array.isArray(root)
        ? root.map(function (_, k) { return k; })
        : Object.keys(root);
      for (var i = 0; i < keys.length; i++) {
        if (last) out.push([root, keys[i]]);
        else collect(root[keys[i]], tokens, index + 1, out);
      }
      return;
    }
    if (!(token in Object(root))) return;
    if (last) { out.push([root, token]); return; }
    collect(root[token], tokens, index + 1, out);
  }

  function prune(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (required.length) {
      var found = false;
      for (var i = 0; i < required.length && !found; i++) {
        var probe = [];
        collect(obj, required[i].split("."), 0, probe);
        found = probe.length > 0;
      }
      if (!found) return obj;
    }
    for (var j = 0; j < paths.length; j++) {
      var owners = [];
      collect(obj, paths[j].split("."), 0, owners);
      for (var k = 0; k < owners.length; k++) {
        try { delete owners[k][0][owners[k][1]]; } catch (e) {}
      }
    }
    return obj;
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
          var body;
          try {
            body = JSON.stringify(prune(JSON.parse(text)));
          } catch (e) {
            return response;
          }
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
