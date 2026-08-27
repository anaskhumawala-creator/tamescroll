// SPIKE (not the shipped worker): does OUR script, served on the page's
// own origin, actually run GPU work off the main thread inside YouTube?
//
// Trusted Types blocks blob: workers, which is where every earlier
// session stopped. A same-origin script url is allowed -- proven by
// running one of YouTube's own scripts inside a Worker there. This
// answers the half that proof did not: WebGL, in a worker, in that
// document, which is what every model pass needs.
self.onmessage = function (e) {
  var out = { got: e.data };
  try {
    var canvas = new OffscreenCanvas(256, 256);
    var gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    out.gl = !!gl;
    if (gl) {
      out.version = gl.getParameter(gl.VERSION);
      out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      // A real upload plus a fence wait: the shape of every model pass.
      var t0 = performance.now();
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      var px = new Uint8Array(256 * 256 * 4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.finish();
      out.uploadMs = Math.round((performance.now() - t0) * 100) / 100;
    }
    out.createImageBitmap = typeof createImageBitmap === 'function';
    out.wasm = typeof WebAssembly === 'object';
  } catch (err) {
    out.error = String((err && err.message) || err);
  }
  self.postMessage(out);
};
self.postMessage({ hello: 'worker up' });
