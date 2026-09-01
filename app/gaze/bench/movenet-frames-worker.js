// THE WebGL ARM ON VIDEO FRAMES.
//
// Node/CPU reads maxKp p50 0.802 and admits 16 persons over these
// exact 15 frames (movenet-aspect.mjs). His phone and the emulator both
// read n:0 on the same footage inside the app, and both are WebGL. So
// the two candidate variables left are the BACKEND and the PIXEL
// SOURCE (a live <video> versus a decoded frame).
//
// This arm holds the pixels constant -- the same frames, exported as
// PNG by export-frames.mjs -- and changes only the backend. If it reads
// ~0.8, the model and the backend are both exonerated and the fault is
// in the live-video pixel path. If it reads ~0.05, our uint8 requant is
// dead on WebGL and the fix is the model file.
//
// Decoded at NATIVE 640x360 with no resize option, so detectPersons
// performs the same squash it performs in the app.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { loadModelUrl, detectPersons } from '../src/detector.js';

self.onmessage = async function (ev) {
  var names = ev.data && ev.data.names;
  if (!names) return;
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    var env = tf.env(), flags = {};
    ['WEBGL_VERSION', 'WEBGL_RENDER_FLOAT32_ENABLED', 'WEBGL_FORCE_F16_TEXTURES',
     'WEBGL_PACK'].forEach(function (f) {
      try { flags[f] = env.get(f); } catch (e) { flags[f] = null; }
    });
    self.postMessage({ prog: 'loading-model' });
    var model = await loadModelUrl('/person/model.json');
    self.postMessage({ prog: 'model-loaded', backend: tf.getBackend(), flags: flags });

    var rows = [];
    for (var i = 0; i < names.length; i++) {
      self.postMessage({ prog: 'infer-' + i });
      var bmp;
      try {
        var res = await fetch('/vframes/' + names[i]);
        bmp = await createImageBitmap(await res.blob());
      } catch (e) { continue; }
      var persons = await detectPersons(model, bmp, 16 / 9, null, null);
      bmp.close();
      rows.push({ name: names[i], w: bmp.width, admitted: persons.length,
        maxKp: typeof persons.maxKp === 'number' ? persons.maxKp : null,
        noShape: !!persons.noHumanShape });
    }
    model.dispose();
    var kps = rows.map(function (r) { return r.maxKp === null ? 0 : r.maxKp; })
                  .sort(function (a, b) { return a - b; });
    self.postMessage({ done: true, backend: tf.getBackend(), flags: flags, n: rows.length,
      admittedTotal: rows.reduce(function (a, r) { return a + r.admitted; }, 0),
      framesWithNobody: rows.filter(function (r) { return r.admitted === 0; }).length,
      maxKpP50: kps.length ? kps[Math.floor(kps.length / 2)] : null,
      maxKpMax: kps.length ? kps[kps.length - 1] : null, rows: rows });
  } catch (e) {
    self.postMessage({ error: String((e && e.stack) || e) });
  }
};
