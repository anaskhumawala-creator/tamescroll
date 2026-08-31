// Page half: spawns the worker and relays. Deliberately does no tfjs
// work of its own -- the point is that nothing heavy runs on the main
// thread, because on his phone that is where it hangs.
window.__PROG = 'idle';
window.__OUT = null;
window.__ERR = null;
window.__RUN = function (ids) {
  var w = new Worker('/movenet-worker.js');
  w.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.prog) window.__PROG = m.prog;
    if (m.error) window.__ERR = m.error;
    if (m.done) window.__OUT = JSON.stringify(m);
  };
  w.onerror = function (e) { window.__ERR = 'worker: ' + (e.message || e); };
  w.postMessage({ ids: ids });
  return 'started';
};
window.__READY = 1;
