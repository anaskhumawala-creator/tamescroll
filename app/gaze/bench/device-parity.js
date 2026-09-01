// IS THE GENDER MODEL ANSWERING AT ALL ON HIS DEVICE?
//
// Measured on his phone (1078, Snapdragon 662 / Adreno 610, m.youtube
// watch page, 2 minutes, 111 reads): the male raw sigmoid sits on
// 0.616 with a MAX of 0.745, i.e. |v-0.5| p50 0.116, while the banked
// corpus in this repo reads male p50 0.71-0.75 with 4,552 of 7,489
// reads at or above 0.6. Two faces at 100px and 108px read 0.528 and
// 0.530 -- a coin flip at a size where this model is not supposed to be
// guessing. Consequence: GENDER_CLEAR_SCORE is 0.6, so NOTHING can ever
// clear, and every man in his player stays blurred.
//
// That has exactly two explanations and they need different fixes:
//   DEVICE   the model (or this WebGL) answers differently here, and
//            every threshold in the repo was calibrated somewhere else.
//   INPUT    the model is fine and the PLAYER's pixel path hands it a
//            worse crop than the thumbnail path does.
//
// This isolates the first one: BYTE-IDENTICAL INPUTS -- a fixed list of
// ytimg thumbnails, no search, nothing rendered -- through the SHIPPING
// detectFaceBoxes and classifyFaceGenders, on whichever device runs the
// page. Run it on the emulator and on his phone and compare the raw
// sigmoid per face. If the two agree, the model is exonerated and the
// defect is in the video path, which is where the search goes next.
//
// It is deliberately NOT a search: driving his phone to a feed would put
// feed content on a screen he is looking at, which this project does not
// do. The ids are the ones already banked in
// spikes/gauntlet/movenet-baseline-emu.json.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import {
  loadModelUrl, detectFaceBoxes, classifyFaceGenders,
} from '../src/detector.js';

function load(url, crossOrigin) {
  return new Promise(function (res, rej) {
    var img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = function () { res(img); };
    img.onerror = function () { rej(new Error('load failed ' + url)); };
    img.src = url;
  });
}

// The same square crop the shipping path uses, drawn to a DETACHED
// canvas -- nothing is ever attached to the document, so no pixel of
// any of this reaches a screen.
function cropTo(img, box, side) {
  var w = img.naturalWidth || img.width;
  var h = img.naturalHeight || img.height;
  var cx = ((box.x1 + box.x2) / 2) * w;
  var cy = ((box.y1 + box.y2) / 2) * h;
  var half = Math.max((box.x2 - box.x1) * w, (box.y2 - box.y1) * h) / 2;
  var c = document.createElement('canvas');
  c.width = side; c.height = side;
  var g = c.getContext('2d');
  g.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, side, side);
  return { canvas: c, nativePx: Math.round(half * 2) };
}

window.__READY = false;

window.__RUN = async function (ids, sizes) {
  var out = { rows: [], errors: [], backend: null, flags: {} };
  await tf.setBackend('webgl');
  await tf.ready();
  out.backend = tf.getBackend();
  // WHICH WebGL we actually got. Every threshold in this repo was
  // calibrated on some machine; if these differ the numbers are not
  // comparable and that has to be visible in the artifact, not inferred.
  var FLAGS = ['WEBGL_VERSION', 'WEBGL_RENDER_FLOAT32_ENABLED',
    'WEBGL_FORCE_F16_TEXTURES', 'WEBGL_PACK', 'WEBGL_USE_SHAPES_UNIFORMS',
    'WEBGL_MAX_TEXTURE_SIZE', 'WEBGL_DOWNLOAD_FLOAT_ENABLED'];
  for (var fi = 0; fi < FLAGS.length; fi++) {
    try { out.flags[FLAGS[fi]] = tf.env().get(FLAGS[fi]); } catch (e) { out.flags[FLAGS[fi]] = null; }
  }
  try {
    var gl = document.createElement('canvas').getContext('webgl2');
    var dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    out.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
  } catch (e) { out.renderer = null; }

  var face = await loadModelUrl('http://localhost:8899/face/model.json');
  var gender = await loadModelUrl('http://localhost:8899/a/model.json');

  sizes = sizes && sizes.length ? sizes : [224];
  for (var i = 0; i < ids.length; i++) {
    var url = 'https://i.ytimg.com/vi/' + ids[i] + '/hqdefault.jpg';
    var img;
    try {
      img = await load(url, true);
    } catch (e) {
      out.errors.push({ id: ids[i], e: String(e && e.message || e) });
      continue;
    }
    var boxes;
    try {
      boxes = await detectFaceBoxes(face, img);
    } catch (e) {
      out.errors.push({ id: ids[i], e: 'detect ' + String(e && e.message || e) });
      continue;
    }
    for (var b = 0; b < boxes.length; b++) {
      for (var s = 0; s < sizes.length; s++) {
        var side = sizes[s];
        var crop = cropTo(img, boxes[b], side);
        var reads;
        try {
          reads = await classifyFaceGenders(gender, [crop.canvas], [
            { x1: 0, y1: 0, x2: 1, y2: 1 },
          ]);
        } catch (e) {
          out.errors.push({ id: ids[i], e: 'gender ' + String(e && e.message || e) });
          continue;
        }
        var r = reads && reads[0];
        out.rows.push({
          id: ids[i], b: b, side: side,
          nativePx: crop.nativePx,
          conf: Math.round((boxes[b].confidence || 0) * 1000) / 1000,
          // The RAW sigmoid is the number that matters -- `score` is a
          // derived certainty and hides which side of 0.5 the model sat
          // on. Every threshold in gender-verdict.mjs is downstream of
          // this one value.
          v: r && typeof r.raw === 'number' ? Math.round(r.raw * 10000) / 10000 : null,
          g: r ? r.gender : null,
          s: r && typeof r.score === 'number' ? Math.round(r.score * 10000) / 10000 : null,
          age: r && typeof r.age === 'number' ? Math.round(r.age * 100) / 100 : null,
          childP: r && typeof r.childP === 'number' ? Math.round(r.childP * 10000) / 10000 : null,
        });
      }
    }
  }
  return out;
};

window.__READY = true;
