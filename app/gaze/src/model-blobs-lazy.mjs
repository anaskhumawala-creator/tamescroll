// WHERE THE MODEL BYTES COME FROM (page artifact).
//
// Nothing here carries a model. The page build exists so a navigation
// does not parse 22MB it will not use: with the worker alive -- the
// normal case since 2026-08-28 -- no model is ever loaded on this
// thread, and ready() is never called.
//
// When neither the worker nor the fetched model assets are available,
// the in-page pipeline is the fail-safe, and it needs the real bytes.
// They come from a script our own request interceptor builds out of the
// same raw model files the fetch path serves (lib.rs models_script), so
// the models ship exactly once in the binary. Same-origin, which is the
// only shape YouTube's require-trusted-types-for 'script' allows.
//
// On a host where that interceptor is unreachable at all -- a service
// worker answers our urls itself, measured on www.youtube.com -- this
// cannot work either, and nothing here would fix it: there the page is
// injected with the models directly and publish() finds them before any
// of this runs.
var MODELS_PATH = '/__tamescroll/models.js';
var pending = null;

function publish() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.__TS_GAZE_MODELS : null;
  } catch (e) {
    return null;
  }
}

function scriptUrl(u) {
  // Same Trusted Types dance the worker client does: the policy is ours,
  // and pages that send require-trusted-types-for without an allow-list
  // permit creating one.
  try {
    if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
      return trustedTypes
        .createPolicy('tamescroll-gaze-models', {
          createScriptURL: function (s) {
            return s;
          },
        })
        .createScriptURL(u);
    }
  } catch (e) {
    /* no policy: the plain string is what src wants anyway */
  }
  return u;
}

/**
 * Resolves once the model blobs exist on this thread. Rejects if they
 * cannot be fetched -- callers must treat that as "no model", which is
 * the same degrade path a failed load already had.
 */
export function ready() {
  if (publish()) return Promise.resolve();
  if (pending) return pending;
  pending = new Promise(function (resolve, reject) {
    try {
      // In a worker there is no document, and importScripts is
      // synchronous. The flag stops the full artifact from starting a
      // SECOND worker on top of this one (init-entry).
      if (typeof document === 'undefined' && typeof importScripts === 'function') {
        self.__TS_GAZE_MODELS_ONLY = 1;
        importScripts(scriptUrl(self.location.origin + MODELS_PATH));
        if (publish()) resolve();
        else reject(new Error('models script loaded without publishing'));
        return;
      }
      var s = document.createElement('script');
      s.async = true;
      s.onload = function () {
        if (publish()) resolve();
        else reject(new Error('models script loaded without publishing'));
      };
      s.onerror = function () {
        reject(new Error('models script failed'));
      };
      s.src = scriptUrl(location.origin + MODELS_PATH);
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
  return pending;
}

/** [modelJson, weightsBase64] for one model name, or undefined. */
export function blob(name) {
  var b = publish();
  return b ? b[name] : undefined;
}
