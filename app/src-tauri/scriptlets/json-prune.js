function jsonPrune(rawPaths, rawRequired) {
  // Clean-room implementation of the `json-prune` scriptlet semantics
  // (MPL-2.0, this project). Hooks JSON.parse and Response.json and
  // deletes the given property paths from any parsed object. Path tokens
  // `*`, `[]` and `[-]` fan out over every element/property at that
  // level. `rawRequired` (optional) restricts pruning to objects where at
  // least one of those paths exists. The uBO marker words `important` /
  // `legacyImportant` are accepted and ignored.
  "use strict";
  var paths = String(rawPaths || "").split(/ +/).filter(function (p) {
    return p && p !== "important" && p !== "legacyImportant";
  });
  if (paths.length === 0) return;
  var required = String(rawRequired || "").split(/ +/).filter(Boolean);

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

  var realParse = JSON.parse;
  JSON.parse = function () {
    return prune(realParse.apply(JSON, arguments));
  };
  if (typeof Response !== "undefined" && Response.prototype.json) {
    var realJson = Response.prototype.json;
    Response.prototype.json = function () {
      return realJson.apply(this, arguments).then(prune);
    };
  }
}
