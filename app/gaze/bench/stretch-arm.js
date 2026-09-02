// THE WHOLE-FRAME VIDEO PATH SQUASHES 16:9 INTO A SQUARE BEFORE ANYONE
// LOOKS AT IT, AND THAT PATH IS THE ONLY ONE THE OTHER PLATFORMS HAVE.
//
// init-entry.js:4342, the fall-through under the person-primary path:
//
//     ctx2d.drawImage(video, 0, 0, detector.INPUT_SIZE, detector.INPUT_SIZE);
//
// Four-argument drawImage: no source rectangle, no aspect preservation.
// A 640x360 stream becomes a 256x256 square, so every face arrives
// **1.78x taller than wide**. `classifyFaceGenders(..., {square:true})`
// then cuts a square out of that buffer -- square in the STRETCHED
// space, which is a 16:9 rectangle in reality -- so crop-geometry's
// repair cannot undo it. The distortion is upstream of the fix.
//
// This is the identical defect fixed on the IMAGE path on 2026-08-28,
// where it made a clear front-facing man read `male` at 0.06 and cost
// four days. Section 16 of docs/engine-findings.md establishes that
// `isPlayer` (`closest('#movie_player')`) is false for every video on
// Reddit, X, Instagram and Facebook, so on those four platforms this is
// not a transient fallback -- it is the whole pipeline.
//
// TWO ARMS, SAME 16 NATIVE 640x360 FRAMES, SAME SHIPPING FUNCTIONS:
//
//   A  SHIPPED     drawImage(img, 0, 0, 256, 256)          stretched
//   B  LETTERBOX   aspect preserved, centred, black bars   undistorted
//
// Both then run `detectFaceBoxes` and `classifyFaceGenders` out of
// detector.js and `faceMeta` out of gender-verdict.mjs -- the exact
// calls `wholeFrameFlagged` makes (init-entry.js:1918). Nothing is
// re-implemented, so this measures the pipeline.
//
// TWO WAYS THIS HARNESS IS NOT THE SHIPPED DRAW, and both bias the same
// direction in both arms (phase-e E13):
//
//   1. it sets `imageSmoothingQuality = 'high'` and the shipped path
//      does not, so the resampler is not the one his phone runs;
//   2. it draws from an `<img>` decoded from a PNG, where the shipped
//      path draws from a `<video>` -- a different colour pipeline and a
//      different chroma history.
//
// CONSEQUENCE, and it bounds what may be quoted from here: the ABSOLUTE
// `nm` magnitudes below are NOT the numbers his device produces, and no
// threshold may be calibrated against them. What survives is the
// MATCHED-PAIR direction -- both arms see the identical bytes through
// the identical two differences, so a per-face A-vs-B comparison
// cancels them. The 16a result (17 of 18 faces higher undistorted, sign
// test p = 1.45e-4) is a paired test and rests only on that half.
//
// WHAT WOULD MAKE THE DEFECT REAL, stated before running so the result
// cannot be read to taste:
//
//   RECALL   arm B finds faces arm A misses. A face never detected is
//            never covered, and on this path that is EXPOSURE.
//   VERDICT  a face found by both reads a different GENDER, or crosses
//            GENDER_MIN_SCORE / the null band, between the arms.
//   FRAME    `anyFlagged` -- the single boolean this path actually
//            ships -- differs between the arms for the same frame.
//            This is the only column that changes what the user sees.
//
// A flat result is a real answer and must be reported as one: it would
// mean BlazeFace and faceres tolerate a 1.78x anisotropic squash at this
// scale, and the stretch is then a nit rather than a defect.
//
// Nothing renders. Every canvas is detached; the page holds no visible
// element.
//
// Build: node_modules/.bin/esbuild bench/stretch-arm.js --bundle \
//          --outfile=../../spikes/faceres-parity/stretch.js
// Serve: python -m http.server 8899 in spikes/faceres-parity, plus
//        adb reverse tcp:8899 tcp:8899
// Drive: spikes/gauntlet/probe_stretch.py
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import {
  loadModelUrl, detectFaceBoxes, classifyFaceGenders, INPUT_SIZE,
} from '../src/detector.js';
import { faceMeta, isNullRead } from '../src/gender-verdict.mjs';
import { fitBox } from '../src/crop-geometry.mjs';

function canvasOf(w, h) {
  var c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function loadImage(url) {
  return new Promise(function (res, rej) {
    var img = new Image();
    img.onload = function () { res(img); };
    img.onerror = function () { rej(new Error('img ' + url)); };
    img.src = url;
  });
}

// ARM A: exactly the shipped line.
function stretchCanvas(img) {
  var c = canvasOf(INPUT_SIZE, INPUT_SIZE);
  var g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, INPUT_SIZE, INPUT_SIZE);
  return c;
}

// ARM B: the same square, aspect preserved. Black bars rather than a
// crop, because cropping would remove content and change the RECALL
// question into a framing question.
//
// IT CALLS THE SHIPPED `fitBox` AND PAINTS THE BARS THE SAME WAY, so
// after 2026-09-02 this arm IS init-entry's whole-frame path and the A/B
// is old-code against new-code rather than against a bench idea of it.
function letterboxCanvas(img) {
  var W = img.naturalWidth, H = img.naturalHeight;
  var c = canvasOf(INPUT_SIZE, INPUT_SIZE);
  var g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#000';
  g.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  var fit = fitBox(W, H, INPUT_SIZE);
  g.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
  return { canvas: c, k: fit.dw / W, ox: fit.dx, oy: fit.dy };
}

// Both arms report boxes normalized to their OWN 256 square, which are
// different spaces. Map each back to the original frame's normalized
// space so a face can be matched across the arms at all.
function toFrameA(bx) {
  return { cx: (bx.x1 + bx.x2) / 2, cy: (bx.y1 + bx.y2) / 2 };
}
function toFrameB(bx, lb, W, H) {
  var px1 = bx.x1 * INPUT_SIZE, px2 = bx.x2 * INPUT_SIZE;
  var py1 = bx.y1 * INPUT_SIZE, py2 = bx.y2 * INPUT_SIZE;
  var cx = ((px1 + px2) / 2 - lb.ox) / lb.k;
  var cy = ((py1 + py2) / 2 - lb.oy) / lb.k;
  return { cx: cx / W, cy: cy / H };
}

var MATCH_DIST = 0.06; // normalized frame units — a face's own width is ~0.1

function readOf(r) {
  return {
    gender: r.gender,
    score: +r.score.toFixed(3),
    raw: +r.raw.toFixed(4),
    age: Math.round(r.age),
    childP: +(r.childP || 0).toFixed(3),
    nm: r.shape ? +r.shape.norm.toFixed(2) : null,
    nullRead: isNullRead(r) ? 1 : 0,
  };
}

async function armRun(face, gender, canvas) {
  var boxes = await detectFaceBoxes(face, canvas);
  if (!boxes.length) return { boxes: [], reads: [] };
  var reads = await classifyFaceGenders(gender, canvas, boxes, null, { square: true });
  return { boxes: boxes, reads: reads };
}

// The boolean the path actually ships (init-entry.js:1919).
function anyFlagged(userGender, reads) {
  var meta = faceMeta(userGender, reads);
  for (var i = 0; i < meta.length; i++) if (meta[i].flagged) return true;
  return false;
}

window.__RUN = async function (names) {
  await tf.setBackend('webgl');
  await tf.ready();
  var face = await loadModelUrl('/face/model.json');
  var gender = await loadModelUrl('/a/model.json');

  var frames = [];
  for (var i = 0; i < names.length; i++) {
    var img;
    try { img = await loadImage('/vframes/' + names[i]); } catch (e) { continue; }
    var W = img.naturalWidth, H = img.naturalHeight;

    var A = await armRun(face, gender, stretchCanvas(img));
    var lb = letterboxCanvas(img);
    var B = await armRun(face, gender, lb.canvas);

    // Match by centre in ORIGINAL frame space.
    var ca = A.boxes.map(toFrameA);
    var cb = B.boxes.map(function (b) { return toFrameB(b, lb, W, H); });
    var pairs = [], usedB = {};
    for (var a = 0; a < ca.length; a++) {
      var best = -1, bestD = MATCH_DIST;
      for (var b = 0; b < cb.length; b++) {
        if (usedB[b]) continue;
        var d = Math.hypot(ca[a].cx - cb[b].cx, ca[a].cy - cb[b].cy);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best >= 0) {
        usedB[best] = 1;
        pairs.push({ a: a, b: best, d: +bestD.toFixed(4),
          A: readOf(A.reads[a]), B: readOf(B.reads[best]) });
      }
    }
    var onlyA = [], onlyB = [];
    for (var a2 = 0; a2 < ca.length; a2++)
      if (!pairs.some(function (p) { return p.a === a2; }))
        onlyA.push({ c: ca[a2], read: readOf(A.reads[a2]) });
    for (var b2 = 0; b2 < cb.length; b2++)
      if (!usedB[b2]) onlyB.push({ c: cb[b2], read: readOf(B.reads[b2]) });

    frames.push({
      name: names[i], w: W, h: H,
      nA: A.boxes.length, nB: B.boxes.length,
      pairs: pairs, onlyA: onlyA, onlyB: onlyB,
      // Both gender settings, because the frame boolean depends on it.
      flagManA: anyFlagged('man', A.reads) ? 1 : 0,
      flagManB: anyFlagged('man', B.reads) ? 1 : 0,
      flagWomanA: anyFlagged('woman', A.reads) ? 1 : 0,
      flagWomanB: anyFlagged('woman', B.reads) ? 1 : 0,
    });
  }
  return JSON.stringify({ frames: frames, inputSize: INPUT_SIZE });
};

window.__READY = 1;
