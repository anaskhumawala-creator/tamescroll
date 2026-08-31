// SAME FRAME, SAME MODEL, TWO MACHINES.
//
// MEASURED tonight on the same video at the same seek point:
//   his phone (1073, 234 passes):  all twelve slots n:0, faceNoShape 127
//   emulator  (1075,  98 passes):  slots 2-3 per pass, faceNoShape 1
// BlazeFace finds faces on BOTH -- his phone produced 41 gender reads at
// 53-131px in that window -- so the frames are not black and the subject
// is there. MoveNet alone comes back empty on his device.
//
// That isolates it to the person model, and there is a precedent
// pointing straight at it: movenet-multipose.bin is OUR OWN hybrid
// uint8 requant of Google's f16 build (2026-08-24), whose full-uint8
// attempt produced DEAD OUTPUT on the depthwise convs at 2.8 absolute
// error. Tonight's faceres parity run showed the same class of damage
// is invisible to a smoke test.
//
// So: a FIXED input, deterministic on any machine, through the shipping
// detectPersons, reporting the raw numbers the gate thresholds on. If
// his phone reads near-zero on an input the emulator reads confidently,
// the footage is not the variable.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { loadModelUrl, detectPersons, PERSON_INPUT_SIZE } from '../src/detector.js';

async function loadImage(url) {
  return new Promise(function (res, rej) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () { res(img); };
    img.onerror = function () { rej(new Error('img')); };
    img.src = url;
  });
}

window.__RUN = async function (ids) {
  await tf.setBackend('webgl');
  await tf.ready();
  var env = tf.env();
  var flags = {};
  ['WEBGL_VERSION', 'WEBGL_RENDER_FLOAT32_CAPABLE', 'WEBGL_RENDER_FLOAT32_ENABLED',
   'WEBGL_FORCE_F16_TEXTURES', 'WEBGL_PACK', 'WEBGL_DOWNLOAD_FLOAT_ENABLED',
   'WEBGL_MAX_TEXTURE_SIZE'].forEach(function (f) {
    try { flags[f] = env.get(f); } catch (e) { flags[f] = null; }
  });

  window.__PROG = 'loading-model';
  var model = await loadModelUrl('/person/model.json');
  window.__PROG = 'model-loaded';
  var rows = [];
  for (var i = 0; i < ids.length; i++) {
    var img;
    window.__PROG = 'img-' + i;
    try { img = await loadImage('https://i.ytimg.com/vi/' + ids[i] + '/hqdefault.jpg'); }
    catch (e) { continue; }
    var c = document.createElement('canvas');
    c.width = PERSON_INPUT_SIZE; c.height = PERSON_INPUT_SIZE;
    c.getContext('2d').drawImage(img, 0, 0, PERSON_INPUT_SIZE, PERSON_INPUT_SIZE);
    var aspect = img.naturalWidth / (img.naturalHeight || 1);
    window.__PROG = 'infer-' + i;
    var persons = await detectPersons(model, c, aspect, null, null);
    rows.push({
      id: ids[i],
      admitted: persons.length,
      maxKp: typeof persons.maxKp === 'number' ? persons.maxKp : null,
      noShape: !!persons.noHumanShape,
      rejected: (persons.rejectedBoxes || []).length,
    });
    await tf.nextFrame();
  }
  model.dispose();
  var kps = rows.map(function (r) { return r.maxKp === null ? 0 : r.maxKp; })
                .sort(function (a, b) { return a - b; });
  return JSON.stringify({
    backend: tf.getBackend(),
    flags: flags,
    n: rows.length,
    admittedTotal: rows.reduce(function (a, r) { return a + r.admitted; }, 0),
    framesWithNobody: rows.filter(function (r) { return r.admitted === 0; }).length,
    // The number frameHasNoHumanShape compares against PFF_FRAME_KP_FLOOR 0.1.
    maxKpP50: kps.length ? kps[Math.floor(kps.length / 2)] : null,
    maxKpMax: kps.length ? kps[kps.length - 1] : null,
    noShapeFrames: rows.filter(function (r) { return r.noShape; }).length,
    rows: rows,
  });
};
window.__READY = 1;
