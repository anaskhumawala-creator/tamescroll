window.__PROG = 'idle'; window.__OUT = null; window.__ERR = null;
window.__RUN = function (names) {
  var w = new Worker('/movenet-frames-worker.js');
  w.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.prog) window.__PROG = m.prog;
    if (m.error) window.__ERR = m.error;
    if (m.done) window.__OUT = JSON.stringify(m);
  };
  w.onerror = function (e) { window.__ERR = 'worker: ' + (e.message || e); };
  w.postMessage({ names: names });
  return 'started';
};
window.__READY = 1;
