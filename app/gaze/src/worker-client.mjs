// Main-thread half of the inference worker.
//
// Owns creating the worker, the request/response pairing, and the
// decision that the worker is not going to work. It knows nothing about
// verdicts or blur: it hands pixels over and gives back reads.
//
// EVERY failure here is a fallback, never a broken page. The caller
// keeps the in-page pipeline and uses it whenever `ready()` is false or
// a request rejects, so the worst case is exactly today's behaviour.

// The path our request interceptor answers on whatever origin asks
// (lib.rs synthetic_resource). It must be same-origin: YouTube's
// Trusted Types refuses a blob: worker and allows a same-origin script.
export var WORKER_PATH = '/__tamescroll/gaze-init.js';

// A worker that never says hello is a worker that is not coming. Long
// enough for a cold 16MB script on a slow device, short enough that the
// in-page path still starts while the user is on his first screen.
var UP_TIMEOUT_MS = 12000;
// One image should never take this long; if it does, something is wrong
// in the worker and the caller must not wait on it forever.
var REQUEST_TIMEOUT_MS = 15000;

export function createWorkerClient(opts) {
  var o = opts || {};
  var origin = o.origin || (typeof location !== 'undefined' ? location.origin : '');
  var onEvent = o.onEvent || function () {};
  var WorkerCtor = o.Worker || (typeof Worker === 'function' ? Worker : null);
  var state = {
    up: false,
    dead: false,
    face: false,
    gender: false,
    nsfw: false,
  };
  var pending = new Map();
  var nextId = 1;
  var worker = null;

  function die(why) {
    if (state.dead) return;
    state.dead = true;
    state.up = false;
    onEvent({ type: 'dead', why: why });
    pending.forEach(function (p) {
      clearTimeout(p.timer);
      p.reject(new Error('worker ' + why));
    });
    pending.clear();
    try {
      if (worker) worker.terminate();
    } catch (e) {
      /* already gone */
    }
    worker = null;
  }

  function url() {
    var u = origin + WORKER_PATH;
    // Trusted Types: the policy is ours and creating one is allowed
    // because the page sends require-trusted-types-for WITHOUT a
    // trusted-types allow-list. Where Trusted Types is absent entirely
    // (most pages), the plain string is what Worker wants anyway.
    try {
      if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
        return trustedTypes
          .createPolicy('tamescroll-gaze-worker', {
            createScriptURL: function (s) {
              return s;
            },
          })
          .createScriptURL(u);
      }
    } catch (e) {
      /* a refused policy just means we try the plain string */
    }
    return u;
  }

  try {
    if (!WorkerCtor) throw new Error('no Worker');
    worker = new WorkerCtor(url());
  } catch (e) {
    die('construct: ' + ((e && e.message) || e));
    return api();
  }

  var upTimer = setTimeout(function () {
    if (!state.up) die('no hello');
  }, UP_TIMEOUT_MS);

  worker.onerror = function (e) {
    // Fires for a script that fails to load OR throws at top level.
    die('error: ' + ((e && e.message) || 'no message'));
  };

  worker.onmessage = function (e) {
    var msg = e.data || {};
    if (msg.type === 'up') {
      clearTimeout(upTimer);
      state.up = true;
      onEvent({ type: 'up' });
      try {
        worker.postMessage({ type: 'init' });
      } catch (err) {
        die('init: ' + ((err && err.message) || err));
      }
      return;
    }
    if (msg.type === 'loaded') {
      state[msg.model] = true;
      onEvent(msg);
      return;
    }
    if (msg.type === 'loadFailed') {
      // A MODEL THAT FAILED HERE IS NOT "SETTLED", IT IS A DEAD WORKER.
      //
      // In page, a failed load has a defined degradation: no gender
      // model means presence-only flags, no NSFW model means face-only.
      // A worker missing a model has no such meaning -- it would answer
      // every image with "no faces, not nsfw", and the caller would
      // REVEAL images nothing had looked at. So a failure here hands the
      // whole path back to the in-page pipeline, which can still load
      // its own copy and degrade honestly.
      onEvent(msg);
      die('model failed: ' + msg.model);
      return;
    }
    if (msg.type === 'ready') {
      onEvent(msg);
      return;
    }
    var p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.type === 'verdict') p.resolve(msg);
    else p.reject(new Error(msg.message || 'worker error'));
  };

  function classifyImage(bitmap) {
    if (state.dead || !state.up) {
      try {
        bitmap.close();
      } catch (e) {
        /* nothing to release */
      }
      return Promise.reject(new Error('worker not ready'));
    }
    var id = nextId++;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        pending.delete(id);
        reject(new Error('worker timeout'));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve: resolve, reject: reject, timer: timer });
      try {
        // The bitmap is TRANSFERRED: no copy, and the main thread stops
        // owning the pixels the moment it hands them over.
        worker.postMessage({ type: 'image', id: id, bitmap: bitmap }, [bitmap]);
      } catch (err) {
        pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  function api() {
    return {
      // Ready to be ASKED (the script is alive). Model readiness is
      // reported separately, because the caller gates its queue on the
      // same staged signals the in-page path uses.
      ready: function () {
        return state.up && !state.dead;
      },
      settled: function () {
        return state.face && state.gender && state.nsfw;
      },
      dead: function () {
        return state.dead;
      },
      classifyImage: classifyImage,
      terminate: function () {
        die('terminated');
      },
    };
  }

  return api();
}
