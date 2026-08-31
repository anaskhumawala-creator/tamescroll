// AT WHAT SIZE DOES faceres STOP ANSWERING AND START GUESSING?
//
// FACE_MIN_NATIVE_PX is 64: a face whose native square side is smaller
// abstains, and an abstain fails closed = covered. MEASURED on his phone
// (2026-08-31, 24 player face reads): facePx p50 74, MIN 53 -- so faces
// land on both sides of that line, and the ones below it are the man who
// gets blurred. Lowering the floor is an EXPOSURE trade and it is his
// call, so this exists to give him the number instead of an argument.
//
// The gate's own justification (init-entry genderFromNativeFace) is that
// a null read "arrives labelled male with a score that clears
// GENDER_MIN_SCORE" -- confident nonsense. That is a claim about
// RESOLUTION, so it is testable: take a face big enough to be read
// reliably, degrade only its pixel count, and watch where the answer
// stops tracking the full-resolution one.
//
// It runs the SHIPPING functions -- detectFaceBoxes and
// classifyFaceGenders out of detector.js, square crop included -- so
// this measures the pipeline, not a re-implementation of it.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import {
  loadModelUrl, detectFaceBoxes, classifyFaceGenders, INPUT_SIZE,
} from '../src/detector.js';
// THE BAND WAS HARDCODED AT [0.545, 0.705] AND THE SHIPPED ONE IS
// [0.53, 0.72], so every "caught by the null band" figure this bench has
// ever produced describes a predicate that does not exist. Worse, it
// checked the raw sigmoid ONLY -- isNullRead also requires age in
// [34, 42], and the non-face control never captured age at all, so the
// figure could not have evaluated the real predicate even in principle.
// Import both rather than restating them.
import { isNullRead, NULL_V_LO, NULL_V_HI } from '../src/gender-verdict.mjs';

var SIZES = [32, 40, 48, 56, 64, 72, 88, 112, 160];

async function loadImage(url) {
  return new Promise(function (res, rej) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () { res(img); };
    img.onerror = function () { rej(new Error('img')); };
    img.src = url;
  });
}

function canvasOf(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

window.__RUN = async function (ids) {
  await tf.setBackend('webgl');
  await tf.ready();
  var face = await loadModelUrl('/face/model.json');
  var gender = await loadModelUrl('/a/model.json');
  var rows = [];
  var nulls = [];
  var seen = 0, big = 0;

  for (var i = 0; i < ids.length; i++) {
    var img;
    try { img = await loadImage('https://i.ytimg.com/vi/' + ids[i] + '/hqdefault.jpg'); }
    catch (e) { continue; }
    var W = img.naturalWidth, H = img.naturalHeight;
    var full = canvasOf(W, H);
    full.getContext('2d').drawImage(img, 0, 0);

    // Detection runs on the stretched 256 square, exactly as the page does.
    var det = canvasOf(INPUT_SIZE, INPUT_SIZE);
    det.getContext('2d').drawImage(img, 0, 0, INPUT_SIZE, INPUT_SIZE);
    var boxes = await detectFaceBoxes(face, det);
    seen += boxes.length;

    // MORE CONTROL SAMPLES, from the images that have no face in them
    // at all. The first version only placed a null crop in the corner
    // opposite a detected face and clashed away nearly all of them (2
    // samples from 40 thumbnails), which is not enough to say anything.
    if (!boxes.length) {
      var nside = Math.min(W, H) * 0.5;
      var spots = [[0, 0], [W - nside, 0], [0, H - nside], [W - nside, H - nside]];
      for (var sp = 0; sp < spots.length; sp++) {
        var ser = [];
        for (var si = 0; si < SIZES.length; si++) {
          var SN = SIZES[si];
          var cc = canvasOf(SN, SN);
          var cg = cc.getContext('2d');
          cg.imageSmoothingQuality = 'high';
          cg.drawImage(full, spots[sp][0], spots[sp][1], nside, nside, 0, 0, SN, SN);
          var co = await classifyFaceGenders(
            gender, cc, [{ x1: 0, y1: 0, x2: 1, y2: 1 }], null, { square: true });
          ser.push({ px: SN, gender: co[0].gender, score: +co[0].score.toFixed(3), raw: +co[0].raw.toFixed(4) });
        }
        nulls.push({ id: ids[i], noFace: true, series: ser });
      }
    }

    for (var b = 0; b < boxes.length; b++) {
      var bx = boxes[b];
      // The square the pipeline would cut, in native pixels.
      var side = Math.min((bx.x2 - bx.x1) * W, (bx.y2 - bx.y1) * H);
      // Only faces with enough real pixels to establish a ground truth.
      // A reference read that is itself a guess proves nothing.
      if (side < 150) continue;
      big++;
      var cx = ((bx.x1 + bx.x2) / 2) * W;
      var cy = ((bx.y1 + bx.y2) / 2) * H;
      var half = side / 2;
      var sx = Math.max(0, cx - half), sy = Math.max(0, cy - half);

      var ref = null;
      var series = [];
      for (var s = -1; s < SIZES.length; s++) {
        var N = s < 0 ? Math.round(side) : SIZES[s];
        if (s >= 0 && N > side) continue;
        // Degrade ONLY the pixel count: the same square, resampled to N
        // and handed over as the whole frame. That is what the pipeline
        // sees when a face is natively N px across.
        var small = canvasOf(N, N);
        var g = small.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(full, sx, sy, side, side, 0, 0, N, N);
        var out = await classifyFaceGenders(
          gender, small, [{ x1: 0, y1: 0, x2: 1, y2: 1 }], null, { square: true });
        var r = out[0];
        var rec = {
          px: N, gender: r.gender, score: +r.score.toFixed(3),
          raw: +r.raw.toFixed(4),
          age: Math.round(r.age), child: +(r.childP || 0).toFixed(3),
        };
        if (s < 0) { ref = rec; } else { series.push(rec); }
      }
      if (ref) rows.push({ id: ids[i], ref: ref, series: series });

      // THE CONTROL ARM, and it is the one the floor actually exists
      // for. genderFromNativeFace refuses a small face because "the null
      // answer arrives labelled male with a score that clears
      // GENDER_MIN_SCORE" -- a claim about what the model says when
      // handed something that is NOT a face. Feeding it only real faces
      // could never test that. Same square size, placed where no
      // detected face overlaps.
      var nx = sx > W / 2 ? 0 : Math.max(0, W - side);
      var ny = Math.max(0, Math.min(H - side, cy > H / 2 ? 0 : H - side));
      var clash = false;
      for (var o = 0; o < boxes.length; o++) {
        var ob = boxes[o];
        if (ob.x2 * W > nx && ob.x1 * W < nx + side &&
            ob.y2 * H > ny && ob.y1 * H < ny + side) clash = true;
      }
      if (!clash) {
        var nseries = [];
        for (var ns = 0; ns < SIZES.length; ns++) {
          var NN = SIZES[ns];
          if (NN > side) continue;
          var nc = canvasOf(NN, NN);
          var ng = nc.getContext('2d');
          ng.imageSmoothingQuality = 'high';
          ng.drawImage(full, nx, ny, side, side, 0, 0, NN, NN);
          var nout = await classifyFaceGenders(
            gender, nc, [{ x1: 0, y1: 0, x2: 1, y2: 1 }], null, { square: true });
          var nr = nout[0];
          nseries.push({
            px: NN, gender: nr.gender, score: +nr.score.toFixed(3),
            raw: +nr.raw.toFixed(4),
            age: Math.round(nr.age), child: +(nr.childP || 0).toFixed(3),
            nullRead: isNullRead(nr) ? 1 : 0,
          });
        }
        nulls.push({ id: ids[i], series: nseries });
      }
    }
    await tf.nextFrame();
  }

  // Per size: does the answer still match the full-resolution one, and
  // how confident is it when it does not? A WRONG read at high
  // confidence is the failure that matters -- it is what revokes a
  // clear or condemns a woman.
  var per = {};
  for (var k = 0; k < SIZES.length; k++) per[SIZES[k]] = { n: 0, agree: 0, confWrong: 0, scores: [], nullBand: 0, nullRead: 0 };
  for (var q = 0; q < rows.length; q++) {
    var R = rows[q];
    for (var z = 0; z < R.series.length; z++) {
      var e = R.series[z];
      var p = per[e.px];
      if (!p) continue;
      p.n++;
      p.scores.push(e.score);
      if (e.gender === R.ref.gender) p.agree++;
      // GENDER_MIN_SCORE is 0.25: a disagreement above it is a CERTAIN
      // wrong answer, which is the thing the floor exists to prevent.
      else if (e.score >= 0.25) p.confWrong++;
      // `nullBand` is the RAW SIGMOID condition alone, at the shipped
      // constants. `nullRead` is the whole predicate, age condition
      // included -- these two are not the same number and conflating
      // them is what produced the "30-33 of 34 non-faces caught" figure.
      if (e.raw >= NULL_V_LO && e.raw <= NULL_V_HI) p.nullBand++;
      if (isNullRead({ gender: e.gender, raw: e.raw, age: e.age })) p.nullRead++;
    }
  }
  var nper = {};
  for (var kk = 0; kk < SIZES.length; kk++) nper[SIZES[kk]] = { n: 0, certain: 0, band: 0, nullRead: 0, scores: [] };
  for (var qq = 0; qq < nulls.length; qq++) {
    var NR = nulls[qq];
    for (var zz = 0; zz < NR.series.length; zz++) {
      var ne = NR.series[zz];
      var np = nper[ne.px];
      if (!np) continue;
      np.n++;
      np.scores.push(ne.score);
      if (ne.score >= 0.25) np.certain++;
      if (ne.raw >= NULL_V_LO && ne.raw <= NULL_V_HI) np.band++;
      if (ne.nullRead) np.nullRead++;
    }
  }
  var nullTable = SIZES.map(function (S) {
    var np = nper[S];
    var nsc = np.scores.slice().sort(function (a, b) { return a - b; });
    return {
      px: S, n: np.n,
      // A non-face read that CLEARS the score bar is a confident answer
      // about nothing -- the exact failure FACE_MIN_NATIVE_PX prevents.
      certain: np.certain,
      // The raw-sigmoid condition alone -- an UPPER BOUND on what the
      // shipped predicate catches, never the predicate itself.
      caughtByRawBand: np.band,
      caughtByNullRead: np.nullRead,
      scoreP50: nsc.length ? nsc[Math.floor(nsc.length / 2)] : null,
    };
  });
  var table = SIZES.map(function (S) {
    var p = per[S];
    var sc = p.scores.slice().sort(function (a, b) { return a - b; });
    return {
      px: S, n: p.n,
      agree: p.n ? +(p.agree / p.n).toFixed(3) : null,
      certainWrong: p.confWrong,
      scoreP50: sc.length ? sc[Math.floor(sc.length / 2)] : null,
      // Raw-sigmoid condition alone, then the whole predicate. On the
      // FACE side these are false positives: a real face treated as the
      // model's prior is a face the gate would refuse.
      inRawBand: p.nullBand,
      isNullRead: p.nullRead,
    };
  });
  return JSON.stringify({
    faces: rows.length, detected: seen, bigEnough: big,
    refGenders: rows.reduce(function (a, r) { a[r.ref.gender] = (a[r.ref.gender] || 0) + 1; return a; }, {}),
    table: table,
    nulls: nulls.length,
    nullTable: nullTable,
    // THE FULL SERIES, BOTH ARMS. The previous run of this bench banked
    // a summary sentence and nothing else, so when the band constants
    // turned out wrong the figures could not be re-derived and the whole
    // measurement had to be re-run on a device. Every entry carries px,
    // gender, score, raw, age and childP, so any future predicate can be
    // evaluated offline against exactly these pixels.
    rows: rows,
    nullRows: nulls,
  });
};
window.__READY = 1;
