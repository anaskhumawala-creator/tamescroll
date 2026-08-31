// SAME INPUT, BOTH MODELS. The parity gate for re-quantising faceres.
//
// faceres is the model that decides who gets blurred, and full uint8 is
// exactly what produced DEAD OUTPUT on MoveNet's depthwise convs
// (2.8 abs error, 2026-08-24). A byte count is not evidence, and neither
// is "the net still returns numbers" -- so this runs the SHIPPED model
// and the candidate over byte-identical inputs and compares the gender
// head directly.
//
// Model semantics (detector.js classifyFaceGenders): input is a
// 224x224 RGB crop, values 0..255 float; the gender head is the [N,1]
// output, a sigmoid where <=0.5 reads female and >0.5 male, and the
// confidence the pipeline thresholds on is 2*|v-0.5|.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as tfconv from '@tensorflow/tfjs-converter';

var SIZE = 224;

async function loadImage(url) {
  return new Promise(function (res, rej) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () { res(img); };
    img.onerror = function () { rej(new Error('img ' + url)); };
    img.src = url;
  });
}

// Deterministic crops of a real thumbnail. No face detector here on
// purpose: the question is whether two graphs agree on identical
// tensors, and adding a detector would let a detector difference be
// mistaken for a model difference.
function cropsOf(img) {
  var c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  var g = c.getContext('2d');
  var out = [];
  var w = img.naturalWidth, h = img.naturalHeight;
  var side = Math.min(w, h);
  var spots = [
    [(w - side) / 2, (h - side) / 2, side],          // centre
    [(w - side) / 2, 0, side],                        // top centre
    [0, (h - side) / 2, side],                        // left
    [w - side, (h - side) / 2, side],                 // right
    [(w - side) / 2, (h - side) / 2, side * 0.6],     // tight centre
  ];
  for (var i = 0; i < spots.length; i++) {
    var s = spots[i];
    var sw = s[2];
    g.clearRect(0, 0, SIZE, SIZE);
    g.drawImage(img, Math.max(0, s[0]), Math.max(0, s[1]), sw, sw, 0, 0, SIZE, SIZE);
    out.push(g.getImageData(0, 0, SIZE, SIZE));
  }
  return out;
}

// EVERY HEAD THE PIPELINE READS, not just the one that is easy to
// compare. faceres is multi-head and all three heads are load bearing:
// the [N,1] sigmoid is the gender, the [N,100] softmax's mass under 18
// is the CHILD GATE (an untrusted gender that can never clear), and the
// [N,1024] pooling output is the identity descriptor the per-video
// memory matches on at cos >= 0.6. A re-quantisation that only moved
// the descriptor would still change who gets revealed.
function headsOf(model, t) {
  var res = model.execute(t);
  var list = Array.isArray(res) ? res : [res];
  var g = null, a = null, d = null;
  for (var i = 0; i < list.length; i++) {
    var s = list[i].shape;
    if (s.length !== 2) continue;
    if (s[1] === 1) g = list[i];
    else if (s[1] === 100) a = list[i];
    else if (s[1] === 1024) d = list[i];
  }
  var out = {
    v: g ? g.dataSync()[0] : NaN,
    age: 0, childP: 0,
    desc: d ? Array.prototype.slice.call(d.dataSync()) : null,
  };
  if (a) {
    var ad = a.dataSync();
    for (var k = 0; k < 100; k++) { out.age += k * ad[k]; if (k < 18) out.childP += ad[k]; }
  }
  for (var j = 0; j < list.length; j++) list[j].dispose();
  return out;
}

function cosine(x, y) {
  if (!x || !y) return null;
  var d = 0, nx = 0, ny = 0;
  for (var i = 0; i < x.length; i++) { d += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; }
  if (nx <= 0 || ny <= 0) return null;
  return d / (Math.sqrt(nx) * Math.sqrt(ny));
}

window.__RUN = async function (ids) {
  await tf.setBackend('webgl');
  await tf.ready();
  var A = await tfconv.loadGraphModel('/a/model.json');
  var B = await tfconv.loadGraphModel('/b/model.json');
  var rows = [];
  var errs = [];
  for (var i = 0; i < ids.length; i++) {
    var img;
    try {
      img = await loadImage('https://i.ytimg.com/vi/' + ids[i] + '/hqdefault.jpg');
    } catch (e) { errs.push(String(e.message || e)); continue; }
    var cs = cropsOf(img);
    for (var k = 0; k < cs.length; k++) {
      var t = tf.tidy(function () {
        return tf.expandDims(tf.cast(tf.browser.fromPixels(cs[k]), 'float32'), 0);
      });
      var a = headsOf(A, t);
      var b = headsOf(B, t);
      t.dispose();
      rows.push({
        id: ids[i], crop: k,
        a: a.v, b: b.v,
        ageA: a.age, ageB: b.age,
        childA: a.childP, childB: b.childP,
        cos: cosine(a.desc, b.desc),
      });
    }
    await tf.nextFrame();
  }
  A.dispose(); B.dispose();

  function stats(arr) {
    var d = arr.slice().sort(function (x, y) { return x - y; });
    if (!d.length) return null;
    return {
      p50: +d[Math.floor(d.length * 0.5)].toFixed(4),
      p95: +d[Math.min(d.length - 1, Math.floor(d.length * 0.95))].toFixed(4),
      max: +d[d.length - 1].toFixed(4),
    };
  }
  // The decision the pipeline actually makes. A disagreement below the
  // score bar changes nothing on screen, so raw error is the wrong unit
  // -- 0.25 is the video path (GENDER_MIN_SCORE) and 0.4 the image path
  // (GENDER_IMAGE_MIN_SCORE).
  function decide(v, thresh) {
    var conf = Math.min(0.99, 2 * Math.abs(v - 0.5));
    if (conf < thresh) return 'abstain';
    return v > 0.5 ? 'male' : 'female';
  }
  function flips(thresh) {
    return rows.filter(function (r) { return decide(r.a, thresh) !== decide(r.b, thresh); }).length;
  }
  // isNullRead's band: a read inside it is treated as the model's prior,
  // not an answer, so crossing the edge changes a verdict too.
  function inNull(v) { return v >= 0.545 && v <= 0.705; }
  var CHILD = 0.15;
  return JSON.stringify({
    n: rows.length, errs: errs.slice(0, 3),
    gender: stats(rows.map(function (r) { return Math.abs(r.a - r.b); })),
    age: stats(rows.map(function (r) { return Math.abs(r.ageA - r.ageB); })),
    childP: stats(rows.map(function (r) { return Math.abs(r.childA - r.childB); })),
    descCosMin: rows.length ? +Math.min.apply(null, rows.map(function (r) { return r.cos === null ? 1 : r.cos; })).toFixed(5) : null,
    signFlips: rows.filter(function (r) { return (r.a > 0.5) !== (r.b > 0.5); }).length,
    flips025: flips(0.25), flips040: flips(0.4),
    nullFlips: rows.filter(function (r) { return inNull(r.a) !== inNull(r.b); }).length,
    childFlips: rows.filter(function (r) { return (r.childA >= CHILD) !== (r.childB >= CHILD); }).length,
    worst: rows.slice().sort(function (x, y) {
      return Math.abs(y.a - y.b) - Math.abs(x.a - x.b);
    }).slice(0, 5).map(function (r) {
      return { id: r.id, crop: r.crop, a: +r.a.toFixed(4), b: +r.b.toFixed(4), cos: r.cos === null ? null : +r.cos.toFixed(4) };
    }),
  });
};
window.__READY = 1;
