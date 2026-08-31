// THE SAME FIXED-INPUT MoveNet BENCH, IN A WORKER.
//
// The main-thread version hangs on his phone: the model loads and the
// FIRST inference never returns, twice, with the app's gaze on and off.
// The app does not hang, and the difference is that the app runs this
// model in a WORKER. So the second attempt is a different approach
// rather than a retry -- if it completes here, the hang is a
// main-thread WebGL property of his device and the numbers below are
// the real answer to "does MoveNet see anyone on his phone".
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { loadModelUrl, detectPersons, PERSON_INPUT_SIZE } from '../src/detector.js';

async function bitmapOf(url) {
  var res = await fetch(url, { mode: 'cors' });
  var blob = await res.blob();
  // Resize on decode: no canvas needed, and it is the same bilinear
  // path the page-side draw would take.
  return createImageBitmap(blob, {
    resizeWidth: PERSON_INPUT_SIZE,
    resizeHeight: PERSON_INPUT_SIZE,
    resizeQuality: 'high',
  });
}

self.onmessage = async function (ev) {
  var ids = ev.data && ev.data.ids;
  if (!ids) return;
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    var env = tf.env();
    var flags = {};
    ['WEBGL_VERSION', 'WEBGL_RENDER_FLOAT32_CAPABLE', 'WEBGL_RENDER_FLOAT32_ENABLED',
     'WEBGL_FORCE_F16_TEXTURES', 'WEBGL_PACK', 'WEBGL_DOWNLOAD_FLOAT_ENABLED',
     'WEBGL_MAX_TEXTURE_SIZE'].forEach(function (f) {
      try { flags[f] = env.get(f); } catch (e) { flags[f] = null; }
    });
    self.postMessage({ prog: 'loading-model' });
    var model = await loadModelUrl('/person/model.json');
    self.postMessage({ prog: 'model-loaded', backend: tf.getBackend(), flags: flags });

    var rows = [];
    for (var i = 0; i < ids.length; i++) {
      self.postMessage({ prog: 'infer-' + i });
      var bmp;
      try { bmp = await bitmapOf('https://i.ytimg.com/vi/' + ids[i] + '/hqdefault.jpg'); }
      catch (e) { continue; }
      var persons = await detectPersons(model, bmp, 16 / 9, null, null);
      bmp.close();
      rows.push({
        id: ids[i],
        admitted: persons.length,
        maxKp: typeof persons.maxKp === 'number' ? persons.maxKp : null,
        noShape: !!persons.noHumanShape,
        rejected: (persons.rejectedBoxes || []).length,
      });
    }
    model.dispose();
    var kps = rows.map(function (r) { return r.maxKp === null ? 0 : r.maxKp; })
                  .sort(function (a, b) { return a - b; });
    self.postMessage({
      done: true,
      backend: tf.getBackend(),
      flags: flags,
      n: rows.length,
      admittedTotal: rows.reduce(function (a, r) { return a + r.admitted; }, 0),
      framesWithNobody: rows.filter(function (r) { return r.admitted === 0; }).length,
      maxKpP50: kps.length ? kps[Math.floor(kps.length / 2)] : null,
      maxKpMax: kps.length ? kps[kps.length - 1] : null,
      noShapeFrames: rows.filter(function (r) { return r.noShape; }).length,
      rows: rows,
    });
  } catch (e) {
    self.postMessage({ error: String((e && e.stack) || e) });
  }
};
