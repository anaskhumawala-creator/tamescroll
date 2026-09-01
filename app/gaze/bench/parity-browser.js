// THE WebGL ARM OF THE VIDEO-CORPUS PARITY GATE.
//
// The offline corpus is read by tfjs-backend-cpu in Node. His phone
// reads WebGL. Every threshold §2 derives from the corpus is therefore
// applied on a backend that never produced it, which is the same shape
// of mistake as calibrating video thresholds on thumbnails -- so it is
// measured rather than assumed.
//
// Byte-identical inputs by construction: both arms build the tensor
// from the SAME raw rgb24 buffer, so no image decoder sits between the
// two and there is nothing for a codec to differ about. The whole chain
// runs here -- detect, crop, read -- because a box that moves changes
// the crop, and comparing faceres alone would hide that.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as tfconv from '@tensorflow/tfjs-converter';
import { detectFaceBoxes, classifyFaceGenders } from '../src/detector.js';

var W = 640, H = 360;

function httpHandler(name) {
  return {
    load: function () {
      return Promise.all([
        fetch('models/' + name + '.json').then(function (r) { return r.json(); }),
        fetch('models/' + name + '.bin').then(function (r) { return r.arrayBuffer(); }),
      ]).then(function (a) {
        var j = a[0], specs = [];
        for (var g = 0; g < j.weightsManifest.length; g++)
          for (var w = 0; w < j.weightsManifest[g].weights.length; w++)
            specs.push(j.weightsManifest[g].weights[w]);
        return {
          modelTopology: j.modelTopology, weightSpecs: specs, weightData: a[1],
          format: j.format, generatedBy: j.generatedBy, convertedBy: j.convertedBy,
          signature: j.signature, userDefinedMetadata: j.userDefinedMetadata,
        };
      });
    },
  };
}

window.__RUN = async function (names) {
  await tf.setBackend('webgl');
  await tf.ready();
  var face = await tfconv.loadGraphModel(httpHandler('blazeface'));
  var gender = await tfconv.loadGraphModel(httpHandler('faceres'));
  var out = { backend: tf.getBackend(), frames: [] };
  for (var i = 0; i < names.length; i++) {
    var buf = await fetch('frames/' + names[i]).then(function (r) { return r.arrayBuffer(); });
    var img = tf.tensor3d(new Uint8Array(buf), [H, W, 3], 'int32');
    var boxes = await detectFaceBoxes(face, null, img);
    var reads = boxes.length ? await classifyFaceGenders(gender, null, boxes, img, { square: true }) : [];
    img.dispose();
    out.frames.push({
      name: names[i],
      faces: boxes.map(function (b, k) {
        var r = reads[k] || {};
        return {
          x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, conf: b.confidence,
          gender: r.gender, score: r.score, raw: r.raw, age: r.age,
          childP: r.childP, nm: r.shape ? r.shape.norm : null,
        };
      }),
    });
  }
  return JSON.stringify(out);
};
window.__READY = 1;
